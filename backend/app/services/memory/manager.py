import logging
import uuid
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, insert
from qdrant_client.models import Filter, FieldCondition, MatchValue, PointStruct

from app.core.config import settings
from app.models.memory_summary import MemorySummary
from app.models.chat_message import ChatMessage
from app.embeddings import embedding_service
from app.storage import vector_storage
from app.services.llm.provider import llm_provider
from app.services.prompts.templates import SYSTEM_MEMORY_SUMMARIZER

logger = logging.getLogger(__name__)

class MemoryManager:
    def __init__(self):
        self.vector_storage = vector_storage
        self.embedding_service = embedding_service
        self.collection_name = "memory"

    def init_memory_collection(self, vector_size: int = 384):
        """
        Ensures the memory vector collection exists in Qdrant.
        """
        try:
            collections = self.vector_storage.client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)
            
            if not exists:
                logger.info(f"Creating Qdrant memory collection '{self.collection_name}' with size {vector_size}")
                from qdrant_client.models import Distance, VectorParams
                self.vector_storage.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
                )
                self.vector_storage.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="notebook_id",
                    field_schema="keyword",
                )
            else:
                logger.debug(f"Qdrant memory collection '{self.collection_name}' already exists.")
        except Exception as e:
            logger.warning(f"Failed to initialize Qdrant memory collection: {e}")

    async def get_recent_history(
        self,
        db: AsyncSession,
        session_id: str,
        limit: int = 10
    ) -> List[Dict[str, str]]:
        """
        Loads the recent chat history from PostgreSQL.
        """
        try:
            stmt = (
                select(ChatMessage)
                .where(ChatMessage.session_id == uuid.UUID(session_id))
                .order_by(ChatMessage.created_at.asc())
            )
            result = await db.execute(stmt)
            messages = result.scalars().all()
            
            # Keep only the last limit * 2 messages (e.g. 5 turns)
            messages = messages[-limit:]
            
            return [
                {"role": m.role, "content": m.content}
                for m in messages
            ]
        except Exception as e:
            logger.error(f"Failed to load recent history: {e}")
            return []

    async def get_summary_memory(
        self,
        db: AsyncSession,
        notebook_id: str
    ) -> Optional[str]:
        """
        Retrieves the persistent notebook-level memory summary from PostgreSQL.
        """
        try:
            stmt = select(MemorySummary).where(MemorySummary.notebook_id == uuid.UUID(notebook_id))
            result = await db.execute(stmt)
            summary_record = result.scalars().first()
            return summary_record.summary if summary_record else None
        except Exception as e:
            logger.error(f"Failed to retrieve summary memory: {e}")
            return None

    async def get_vector_memory(
        self,
        notebook_id: str,
        query: str,
        limit: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Retrieves matching memory snippets from Qdrant vector memory collection.
        """
        try:
            query_vector = self.embedding_service.generate_embeddings([query])[0]
            self.init_memory_collection(len(query_vector))
            
            search_res = self.vector_storage.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=Filter(
                    must=[
                        FieldCondition(
                            key="notebook_id",
                            match=MatchValue(value=notebook_id)
                        )
                    ]
                ),
                limit=limit
            )
            
            memories = []
            for point in search_res:
                payload = point.payload or {}
                memories.append({
                    "text": payload.get("text", ""),
                    "session_id": payload.get("session_id"),
                    "created_at": payload.get("created_at")
                })
            return memories
        except Exception as e:
            logger.warning(f"Failed to retrieve vector memory: {e}")
            return []

    async def update_memory(
        self,
        db: AsyncSession,
        notebook_id: str,
        session_id: str,
        user_msg: str,
        assistant_msg: str
    ) -> None:
        """
        Updates the memory system at the end of a conversation turn:
        1. Summarizes the new turn into the PostgreSQL notebook summary.
        2. Embeds and upserts the conversational turn to Qdrant memory collection.
        """
        logger.info(f"Updating memory systems for session: {session_id} in notebook: {notebook_id}...")
        
        # 1. Update SQL Summary
        existing_summary = await self.get_summary_memory(db, notebook_id)
        
        # Prepare LLM input
        user_prompt = (
            f"Existing Summary:\n{existing_summary or 'No existing summary.'}\n\n"
            f"New Turn:\n"
            f"User: {user_msg}\n"
            f"Assistant: {assistant_msg}"
        )
        
        updated_summary = ""
        try:
            tokens = []
            # Call LLM provider
            async for token in llm_provider.generate_stream(
                system_prompt=SYSTEM_MEMORY_SUMMARIZER,
                messages=[{"role": "user", "content": user_prompt}]
            ):
                tokens.append(token)
            updated_summary = "".join(tokens).strip()
        except Exception as e:
            logger.error(f"Failed to generate updated summary via LLM: {e}")

        if updated_summary:
            try:
                if existing_summary is not None:
                    # Update existing record
                    stmt = (
                        update(MemorySummary)
                        .where(MemorySummary.notebook_id == uuid.UUID(notebook_id))
                        .values(summary=updated_summary)
                    )
                    await db.execute(stmt)
                else:
                    # Insert new record
                    stmt = insert(MemorySummary).values(
                        id=uuid.uuid4(),
                        notebook_id=uuid.UUID(notebook_id),
                        summary=updated_summary
                    )
                    await db.execute(stmt)
                await db.commit()
                logger.info("Successfully updated PostgreSQL memory summary.")
            except Exception as e:
                await db.rollback()
                logger.error(f"SQL update memory summary failed: {e}")

        # 2. Update Vector Memory in Qdrant
        try:
            memory_text = f"[User]: {user_msg}\n[AI Assistant]: {assistant_msg}"
            embedding = self.embedding_service.generate_embeddings([memory_text])[0]
            
            self.init_memory_collection(len(embedding))
            
            point_id = str(uuid.uuid4())
            payload = {
                "memory_id": point_id,
                "notebook_id": notebook_id,
                "session_id": session_id,
                "text": memory_text,
                "created_at": datetime.datetime.utcnow().isoformat()
            }
            
            self.vector_storage.client.upsert(
                collection_name=self.collection_name,
                points=[PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload
                )]
            )
            logger.info("Successfully upserted memory vector to Qdrant.")
        except Exception as e:
            logger.warning(f"Failed to save vector memory to Qdrant: {e}")

# Global memory manager instance
memory_manager = MemoryManager()
