from typing import Optional
from pydantic import BaseModel, UUID4
from datetime import datetime

class NotebookBase(BaseModel):
    name: str

class NotebookCreate(NotebookBase):
    workspace_id: UUID4

class NotebookUpdate(BaseModel):
    name: Optional[str] = None

class NotebookInDBBase(NotebookBase):
    id: UUID4
    workspace_id: UUID4
    created_at: datetime

    model_config = {"from_attributes": True}

class Notebook(NotebookInDBBase):
    pass
