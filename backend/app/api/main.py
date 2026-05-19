from fastapi import APIRouter
from app.api.endpoints import workspaces, notebooks, documents

api_router = APIRouter()

# Register routers
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["workspaces"])
api_router.include_router(notebooks.router, prefix="/notebooks", tags=["notebooks"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])

# Placeholder for actual routers
# api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
# api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
