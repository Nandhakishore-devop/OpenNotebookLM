from typing import Generator
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import AsyncSessionLocal

async def get_db() -> Generator:
    async with AsyncSessionLocal() as session:
        yield session

# Mock current user for now until full Auth is implemented
from app.models.user import User
import uuid

async def get_current_user(db: AsyncSession = Depends(get_db)) -> User:
    # In a real implementation, we would extract the JWT token from the Authorization header
    # For now, just return a dummy user ID to allow API development
    user = User(
        id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
        email="test@sourcemind.ai",
        is_active=True
    )
    return user
