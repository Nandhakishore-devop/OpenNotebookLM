import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.models.user import User
from app.models.notebook import Notebook
from app.models.workspace import Workspace
from app.models.document import Document
from app.schemas.document import Document as DocumentSchema
from app.core.storage import get_minio_client, upload_file_to_minio
from app.worker.tasks import ingest_document_task

router = APIRouter()
MINIO_BUCKET = "sourcemind-documents"

@router.post("/", response_model=DocumentSchema, status_code=status.HTTP_201_CREATED)
async def upload_document(
    notebook_id: str = Form(...),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Upload a document to a notebook."""
    
    # 1. Verify notebook and workspace ownership
    stmt = select(Notebook, Workspace).join(Workspace).where(
        Notebook.id == notebook_id,
        Workspace.owner_id == current_user.id
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    # 2. Upload file to MinIO
    minio_client = get_minio_client()
    file_content = await file.read()
    
    # Generate unique path for MinIO
    file_ext = file.filename.split(".")[-1] if "." in file.filename else ""
    object_name = f"{current_user.id}/{notebook_id}/{uuid.uuid4()}.{file_ext}"
    
    try:
        upload_file_to_minio(
            client=minio_client,
            bucket_name=MINIO_BUCKET,
            object_name=object_name,
            data=file_content,
            content_type=file.content_type or "application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")

    # 3. Create document record in database
    document = Document(
        title=file.filename,
        notebook_id=notebook_id,
        file_path=f"{MINIO_BUCKET}/{object_name}",
        file_type=file_ext,
        status="pending"
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
                    file_path=document.file_path,
                    file_type=file_ext,
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

@router.get("/notebook/{notebook_id}", response_model=List[DocumentSchema])
async def read_documents(
    notebook_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Retrieve documents for a specific notebook."""
    # Verify notebook ownership
    stmt = select(Notebook, Workspace).join(Workspace).where(
        Notebook.id == notebook_id,
        Workspace.owner_id == current_user.id
    )
    result = await db.execute(stmt)
    if not result.first():
        raise HTTPException(status_code=404, detail="Notebook not found")

    # Fetch documents
    doc_stmt = select(Document).where(Document.notebook_id == notebook_id)
    doc_result = await db.execute(doc_stmt)
    return doc_result.scalars().all()
