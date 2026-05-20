from typing import Optional
from pydantic import BaseModel, UUID4
from datetime import datetime
from app.models.document import DocumentStatus

class DocumentBase(BaseModel):
    title: str

class DocumentCreate(DocumentBase):
    notebook_id: UUID4
    file_type: str
    file_path: str

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[DocumentStatus] = None

class DocumentInDBBase(DocumentBase):
    id: UUID4
    notebook_id: UUID4
    file_path: str
    file_type: str
    status: DocumentStatus
    meta_data: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}

class Document(DocumentInDBBase):
    pass
