import logging
import uuid
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from app.models.chunk import Chunk

logger = logging.getLogger(__name__)


async def save_chunks_to_db(
    db: AsyncSession,
    chunks: List[Dict[str, Any]],
    document_id: str,
    notebook_id: str
):
    """
    Saves document text chunks into the PostgreSQL 'chunks' table.
    """
    if not chunks:
        logger.warning("No chunks provided to save to database.")
        return

    try:
        # 1. Clean up any existing chunks for this document (idempotency support)
        stmt_delete = delete(Chunk).where(Chunk.document_id == document_id)
        await db.execute(stmt_delete)

        # 2. Add new chunks
        for chunk in chunks:
            db_chunk = Chunk(
                id=uuid.UUID(chunk["chunk_id"]),
                document_id=uuid.UUID(document_id),
                notebook_id=uuid.UUID(notebook_id),
                text=chunk["text"],
                token_count=chunk["token_count"],
                chunk_index=chunk["chunk_index"],
                meta_data=chunk["metadata"]
            )
            db.add(db_chunk)

        await db.commit()
        logger.info(f"Saved {len(chunks)} chunks to PostgreSQL database for document {document_id}")
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to save chunks to PostgreSQL: {e}")
        raise e
