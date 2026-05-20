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

from sqlalchemy.future import select

async def get_current_user(db: AsyncSession = Depends(get_db)) -> User:
    # Fetch seed user from database to ensure it's a persistent instance
    user_id = uuid.UUID("4a8f6d6f-7d12-4632-bd88-6629f1709405")
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if not user:
        # Fallback if db is not seeded
        user = User(
            id=user_id,
            email="test@sourcemind.ai",
            is_active=True
        )
    return user
