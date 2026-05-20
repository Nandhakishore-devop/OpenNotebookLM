import asyncio
import logging
from app.worker.celery_app import celery_app
from app.services import run_pipeline
from app.db.database import AsyncSessionLocal
from app.models.document import Document, DocumentStatus
from sqlalchemy.future import select

logger = logging.getLogger(__name__)

@celery_app.task(name="app.worker.tasks.ingest_document")
def ingest_document_task(document_id: str, file_path: str, file_type: str, notebook_id: str):
    """
    Celery task to run the complete ingestion pipeline on a document.
    """
    try:
        logger.info(f"Celery task triggered for document {document_id}")
        
        async def _run():
            async with AsyncSessionLocal() as session:
                await run_pipeline(
                    document_id=document_id,
                    file_path=file_path,
                    file_type=file_type,
                    notebook_id=notebook_id,
                    db=session
                )
                
        asyncio.run(_run())
        logger.info(f"Celery task completed successfully for document {document_id}")
    except Exception as e:
        logger.error(f"Celery task failed for document {document_id}: {e}", exc_info=True)
        # Update status to failed in case run_pipeline failed before updating it
        asyncio.run(_update_document_status(document_id, DocumentStatus.failed, str(e)))

async def _update_document_status(document_id: str, status: DocumentStatus, error_msg: str):
    async with AsyncSessionLocal() as session:
        stmt = select(Document).where(Document.id == document_id)
        result = await session.execute(stmt)
        doc = result.scalars().first()
        if doc:
            doc.status = status
            doc.meta_data = {"error": error_msg}
            await session.commit()

