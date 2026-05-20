import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from app.api import deps
from app.models.user import User
from app.models.notebook import Notebook
from app.models.workspace import Workspace
from app.models.document import Document, DocumentStatus
from app.schemas.document import Document as DocumentSchema
from app.core.storage import get_minio_client, upload_file_to_minio
from app.worker.tasks import ingest_document_task
from app.storage import vector_storage

router = APIRouter()
MINIO_BUCKET = "sourcemind-documents"


@router.post("/upload", response_model=DocumentSchema, status_code=status.HTTP_201_CREATED)
async def upload_source(
    notebook_id: str = Form(...),
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Ingestion Endpoint: Upload a File or submit a URL (website or YouTube) to a notebook.
    Creates a PostgreSQL record and kicks off the background Celery parser worker.
    """
    # 1. Verify notebook exists and belongs to a workspace owned by current user
    stmt = select(Notebook, Workspace).join(Workspace).where(
        Notebook.id == notebook_id,
        Workspace.owner_id == current_user.id
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Notebook not found or unauthorized")

    document_id = uuid.uuid4()
    file_path = ""
    file_type = ""
    title = ""

    # 2. Process based on source type (File vs URL)
    if file:
        title = file.filename
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "txt"
        file_type = file_ext.lower()
        
        # Upload file content to MinIO
        minio_client = get_minio_client()
        file_content = await file.read()
        
        # Unique object path in MinIO
        object_name = f"{current_user.id}/{notebook_id}/{document_id}.{file_ext}"
        file_path = f"{MINIO_BUCKET}/{object_name}"
        
        try:
            upload_file_to_minio(
                client=minio_client,
                bucket_name=MINIO_BUCKET,
                object_name=object_name,
                data=file_content,
                content_type=file.content_type or "application/octet-stream"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to store uploaded file: {str(e)}")

    elif url:
        # Validate URL structure
        if not (url.startswith("http://") or url.startswith("https://")):
            raise HTTPException(status_code=400, detail="Invalid URL format. Must start with http:// or https://")
            
        file_path = url
        # Detect if it's a YouTube URL
        if "youtube" in url or "youtu.be" in url:
            file_type = "youtube"
            title = f"YouTube Video ({url[-11:]})"
        else:
            file_type = "url"
            # Simple hostname title extraction
            from urllib.parse import urlparse
            parsed = urlparse(url)
            title = f"Webpage ({parsed.netloc})"
    else:
        raise HTTPException(status_code=400, detail="You must provide either a 'file' or a 'url' source.")

    # 3. Create document record in PostgreSQL database
    document = Document(
        id=document_id,
        title=title,
        notebook_id=notebook_id,
        file_path=file_path,
        file_type=file_type,
        status=DocumentStatus.pending
    )
    
    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Run ingestion asynchronously in FastAPI BackgroundTasks
    async def run_ingestion_background():
        from app.db.database import AsyncSessionLocal
        from app.services.ingestion_pipeline import run_pipeline
        from app.models.document import DocumentStatus
        
        async with AsyncSessionLocal() as session:
            try:
                await run_pipeline(
                    document_id=str(document.id),
                    file_path=file_path,
                    file_type=file_type,
                    notebook_id=str(notebook_id),
                    db=session
                )
            except Exception as e:
                # Fallback to failed status if ingestion error occurs
                stmt_err = select(Document).where(Document.id == document.id)
                res_err = await session.execute(stmt_err)
                doc_err = res_err.scalars().first()
                if doc_err:
                    doc_err.status = DocumentStatus.failed
                    doc_err.meta_data = {"error": str(e)}
                    await session.commit()
    
    background_tasks.add_task(run_ingestion_background)

    return document


@router.get("/document/{document_id}/status")
async def get_document_status(
    document_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Ingestion Endpoint: Retrieve the current parsing/ingestion status and metadata of a document.
    """
    stmt = select(Document, Notebook, Workspace).join(Notebook, Document.notebook_id == Notebook.id).join(Workspace).where(
        Document.id == document_id,
        Workspace.owner_id == current_user.id
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized")
        
    doc = row[0]
    return {
        "document_id": str(doc.id),
        "title": doc.title,
        "status": doc.status,
        "file_type": doc.file_type,
        "metadata": doc.meta_data,
        "created_at": doc.created_at
    }


@router.get("/notebook/{notebook_id}/documents", response_model=List[DocumentSchema])
async def get_notebook_documents(
    notebook_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Ingestion Endpoint: List all documents linked to a specific notebook.
    """
    # Verify ownership of the notebook
    stmt = select(Notebook, Workspace).join(Workspace).where(
        Notebook.id == notebook_id,
        Workspace.owner_id == current_user.id
    )
    result = await db.execute(stmt)
    if not result.first():
        raise HTTPException(status_code=404, detail="Notebook not found or unauthorized")

    # Fetch document records
    doc_stmt = select(Document).where(Document.notebook_id == notebook_id)
    doc_result = await db.execute(doc_stmt)
    return doc_result.scalars().all()


@router.delete("/document/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> None:
    """
    Ingestion Endpoint: Delete a document.
    Cascades deletion to PostgreSQL chunks and Qdrant vector points.
    """
    # Verify document ownership
    stmt = select(Document, Notebook, Workspace).join(Notebook, Document.notebook_id == Notebook.id).join(Workspace).where(
        Document.id == document_id,
        Workspace.owner_id == current_user.id
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized")

    # 1. Delete vectors from Qdrant vector store
    try:
        vector_storage.delete_document_vectors(document_id=document_id)
    except Exception as q_err:
        # Log warning but do not block PostgreSQL deletion
        import logging
        logging.getLogger(__name__).warning(f"Failed to clear Qdrant vectors for doc {document_id}: {q_err}")

    # 2. Delete document from PostgreSQL (foreign key CASCADE handles postgres chunks deletion)
    delete_stmt = delete(Document).where(Document.id == document_id)
    await db.execute(delete_stmt)
    await db.commit()
    
    return None
