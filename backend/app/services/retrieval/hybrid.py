import logging
import uuid
import numpy as np
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from qdrant_client.models import Filter, FieldCondition, MatchValue

from app.core.config import settings
from app.embeddings import embedding_service
from app.storage import vector_storage

logger = logging.getLogger(__name__)

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    dot_product = np.dot(v1, v2)
    norm_v1 = np.linalg.norm(v1)
    norm_v2 = np.linalg.norm(v2)
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return float(dot_product / (norm_v1 * norm_v2))

class HybridRetrievalService:
    def __init__(self):
        self.vector_storage = vector_storage
        self.embedding_service = embedding_service

    async def retrieve(
        self,
        db: AsyncSession,
        notebook_id: str,
        query: str,
        limit: int = 6
    ) -> List[Dict[str, Any]]:
        """
        Executes hybrid retrieval:
        1. Semantic Search (Qdrant documents collection)
        2. Keyword Search (PostgreSQL full-text search)
        3. Reciprocal Rank Fusion (RRF) to merge rankings
        4. Embedding Cosine Similarity Reranking
        """
        logger.info(f"Initiating hybrid retrieval for query: '{query}' in notebook: {notebook_id}")
        
        # 1. Embed query
        try:
            query_vector = self.embedding_service.generate_embeddings([query])[0]
        except Exception as e:
            logger.error(f"Failed to generate query embedding: {e}. Falling back to keyword-only search.")
            query_vector = None

        # 2. Semantic retrieval from Qdrant
        semantic_results = []
        if query_vector:
            try:
                search_res = self.vector_storage.client.search(
                    collection_name=self.vector_storage.collection_name,
                    query_vector=query_vector,
                    query_filter=Filter(
                        must=[
                            FieldCondition(
                                key="notebook_id",
                                match=MatchValue(value=notebook_id)
                            )
                        ]
                    ),
                    limit=limit * 2
                )
                
                for point in search_res:
                    payload = point.payload or {}
                    meta = payload.get("metadata", {})
                    semantic_results.append({
                        "chunk_id": payload.get("chunk_id") or point.id,
                        "document_id": payload.get("document_id"),
                        "notebook_id": payload.get("notebook_id"),
                        "text": payload.get("text", ""),
                        "chunk_index": payload.get("chunk_index", 0),
                        "filename": meta.get("filename") or "Document Source",
                        "page_number": meta.get("page_number"),
                        "section_title": meta.get("section_title"),
                        "slide_number": meta.get("slide_number"),
                        "timestamp": meta.get("timestamp"),
                        "source_url": meta.get("source_url")
                    })
            except Exception as e:
                logger.warning(f"Semantic search failed or refused: {e}")

        # 3. Keyword retrieval from PostgreSQL full-text search
        keyword_results = []
        try:
            # Postgres Full-Text Search
            sql_query = text("""
                SELECT id, document_id, notebook_id, text, chunk_index, meta_data,
                       ts_rank_cd(to_tsvector('english', text), plainto_tsquery('english', :query)) AS rank
                FROM chunks
                WHERE notebook_id = :notebook_id 
                  AND to_tsvector('english', text) @@ plainto_tsquery('english', :query)
                ORDER BY rank DESC
                LIMIT :limit
            """)
            
            result = await db.execute(sql_query, {"notebook_id": uuid.UUID(notebook_id), "query": query, "limit": limit * 2})
            rows = result.all()
            
            # If no results, try fallback basic ILIKE matching
            if not rows:
                fallback_query = text("""
                    SELECT id, document_id, notebook_id, text, chunk_index, meta_data, 1.0 AS rank
                    FROM chunks
                    WHERE notebook_id = :notebook_id AND text ILIKE :like_query
                    LIMIT :limit
                """)
                result = await db.execute(fallback_query, {
                    "notebook_id": uuid.UUID(notebook_id), 
                    "like_query": f"%{query}%", 
                    "limit": limit
                })
                rows = result.all()

            for row in rows:
                meta = row.meta_data or {}
                keyword_results.append({
                    "chunk_id": str(row.id),
                    "document_id": str(row.document_id),
                    "notebook_id": str(row.notebook_id),
                    "text": row.text,
                    "chunk_index": row.chunk_index,
                    "filename": meta.get("filename") or "Document Source",
                    "page_number": meta.get("page_number"),
                    "section_title": meta.get("section_title"),
                    "slide_number": meta.get("slide_number"),
                    "timestamp": meta.get("timestamp"),
                    "source_url": meta.get("source_url")
                })
        except Exception as e:
            logger.error(f"Keyword search failed: {e}")

        # If both failed and we found nothing, let's query raw SQL chunk list as last resort fallback
        if not semantic_results and not keyword_results:
            try:
                from app.models.chunk import Chunk
                from sqlalchemy.future import select
                stmt = select(Chunk).where(Chunk.notebook_id == uuid.UUID(notebook_id)).limit(limit)
                result = await db.execute(stmt)
                db_chunks = result.scalars().all()
                for chunk in db_chunks:
                    meta = chunk.meta_data or {}
                    keyword_results.append({
                        "chunk_id": str(chunk.id),
                        "document_id": str(chunk.document_id),
                        "notebook_id": str(chunk.notebook_id),
                        "text": chunk.text,
                        "chunk_index": chunk.chunk_index,
                        "filename": meta.get("filename") or "Document Source",
                        "page_number": meta.get("page_number"),
                        "section_title": meta.get("section_title"),
                        "slide_number": meta.get("slide_number"),
                        "timestamp": meta.get("timestamp"),
                        "source_url": meta.get("source_url")
                    })
            except Exception as e:
                logger.error(f"Ultimate chunk list fallback failed: {e}")

        # 4. Merge results using Reciprocal Rank Fusion (RRF)
        rrf_scores = {}
        chunks_map = {}
        
        # Helper to compute RRF terms
        def add_rrf_scores(results_list):
            for rank, chunk in enumerate(results_list):
                chunk_id = chunk["chunk_id"]
                chunks_map[chunk_id] = chunk
                # RRF Formula: 1 / (60 + rank)
                score = 1.0 / (60 + rank)
                rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + score

        add_rrf_scores(semantic_results)
        add_rrf_scores(keyword_results)

        # Sort by RRF score descending
        sorted_chunk_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
        candidate_chunks = [chunks_map[cid] for cid in sorted_chunk_ids[:limit * 2]]

        if not candidate_chunks:
            logger.warning("No candidate chunks retrieved during search.")
            return []

        # 5. Reranking Layer (using Query-to-Chunk Semantic Similarity Scorer)
        if query_vector:
            try:
                candidate_texts = [c["text"] for c in candidate_chunks]
                candidate_embeddings = self.embedding_service.generate_embeddings(candidate_texts)
                
                # Compute similarities
                for chunk, embedding in zip(candidate_chunks, candidate_embeddings):
                    similarity = cosine_similarity(query_vector, embedding)
                    chunk["rerank_score"] = similarity
                
                # Sort by rerank score descending
                candidate_chunks = sorted(candidate_chunks, key=lambda x: x.get("rerank_score", 0.0), reverse=True)
                logger.info("Hybrid search results successfully reranked using semantic similarity.")
            except Exception as e:
                logger.warning(f"Reranking layer failed: {e}. Returning RRF order.")
        
        return candidate_chunks[:limit]

# Global hybrid retrieval service instance
hybrid_retrieval_service = HybridRetrievalService()
