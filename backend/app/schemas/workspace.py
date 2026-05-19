from typing import Optional
from pydantic import BaseModel, UUID4
from datetime import datetime

class WorkspaceBase(BaseModel):
    name: str

class WorkspaceCreate(WorkspaceBase):
    pass

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None

class WorkspaceInDBBase(WorkspaceBase):
    id: UUID4
    owner_id: UUID4
    created_at: datetime

    model_config = {"from_attributes": True}

class Workspace(WorkspaceInDBBase):
    pass
