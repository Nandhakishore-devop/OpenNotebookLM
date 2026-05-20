import logging
import uuid
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from app.core.config import settings

logger = logging.getLogger(__name__)


class VectorStorage:
    def __init__(self):
        # Fallback to local address if settings does not specify
        host = getattr(settings, "QDRANT_HOST", "localhost")
        port = getattr(settings, "QDRANT_PORT", 6333)
        self.client = QdrantClient(host=host, port=port)
        self.collection_name = "documents"

    def init_collection(self, vector_size: int = 384):
        """
        Ensures the target Qdrant collection exists and matches the embedding dimension.
        """
        try:
            collections = self.client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)
            
            if not exists:
                logger.info(f"Creating Qdrant collection '{self.collection_name}' with size {vector_size}")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
                )
                
                # Create payload indexes for efficient notebook/document filtering
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="notebook_id",
                    field_schema="keyword",
                )
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="document_id",
                    field_schema="keyword",
                )
            else:
                logger.debug(f"Qdrant collection '{self.collection_name}' already exists.")
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant collection: {e}")
            raise e

    def upsert_chunks(
        self, 
        chunks: List[Dict[str, Any]], 
        embeddings: List[List[float]], 
        document_id: str, 
        notebook_id: str
    ):
        """
        Upserts document chunks and their embeddings to Qdrant.
        """
        if not chunks or not embeddings:
            logger.warning("No chunks or embeddings provided for Qdrant upsert.")
            return

        vector_size = len(embeddings[0])
        self.init_collection(vector_size=vector_size)

        points = []
        for chunk, embedding in zip(chunks, embeddings):
            chunk_id = chunk.get("chunk_id", str(uuid.uuid4()))
            text = chunk.get("text", "")
            chunk_index = chunk.get("chunk_index", 0)
            token_count = chunk.get("token_count", 0)
            metadata = chunk.get("metadata", {})

            # Prepare the complete payload as requested in Requirement 14 & 16
            payload = {
                "chunk_id": chunk_id,
                "document_id": document_id,
                "notebook_id": notebook_id,
                "text": text,
                "token_count": token_count,
                "chunk_index": chunk_index,
                "metadata": metadata
            }

            points.append(PointStruct(
                id=chunk_id,
                vector=embedding,
                payload=payload
            ))

        try:
            logger.info(f"Upserting {len(points)} points to Qdrant collection '{self.collection_name}'")
            self.client.upsert(
                collection_name=self.collection_name,
                points=points
            )
            logger.info("Qdrant upsert completed successfully.")
        except Exception as e:
            logger.error(f"Qdrant upsert failed: {e}")
            raise e

    def delete_document_vectors(self, document_id: str):
        """
        Deletes all vector points associated with a specific document.
        """
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        try:
            logger.info(f"Deleting vectors in Qdrant for document: {document_id}")
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id)
                        )
                    ]
                )
            )
        except Exception as e:
            logger.error(f"Failed to delete document vectors: {e}")
            raise e

    def delete_notebook_vectors(self, notebook_id: str):
        """
        Deletes all vector points associated with a specific notebook.
        """
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        try:
            logger.info(f"Deleting vectors in Qdrant for notebook: {notebook_id}")
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="notebook_id",
                            match=MatchValue(value=notebook_id)
                        )
                    ]
                )
            )
        except Exception as e:
            logger.error(f"Failed to delete notebook vectors: {e}")
            raise e


# Global vector storage instance
vector_storage = VectorStorage()
