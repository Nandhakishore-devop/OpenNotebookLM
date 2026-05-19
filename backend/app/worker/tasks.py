import asyncio
from app.worker.celery_app import celery_app
from app.rag.ingestion import process_document
from app.db.database import AsyncSessionLocal
from app.models.document import Document, DocumentStatus
from sqlalchemy.future import select

@celery_app.task(name="app.worker.tasks.ingest_document")
def ingest_document_task(document_id: str, file_path: str, file_type: str, notebook_id: str):
    """
    Celery task to ingest a document. Runs synchronously, but calls async DB if needed.
    """
    try:
        # Run the ingestion pipeline (CPU intensive)
        process_document(document_id, file_path, file_type, notebook_id)
        
        # Update document status to done
        asyncio.run(_update_document_status(document_id, DocumentStatus.done))
    except Exception as e:
        print(f"Error processing document {document_id}: {e}")
        # Update document status to error
        asyncio.run(_update_document_status(document_id, DocumentStatus.error))

async def _update_document_status(document_id: str, status: DocumentStatus):
    async with AsyncSessionLocal() as session:
        stmt = select(Document).where(Document.id == document_id)
        result = await session.execute(stmt)
        doc = result.scalars().first()
        if doc:
            doc.status = status
            await session.commit()
