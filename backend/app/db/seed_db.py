import asyncio
import uuid
from sqlalchemy import delete
from app.db.database import AsyncSessionLocal
from app.models.user import User
from app.models.workspace import Workspace
from app.models.notebook import Notebook

async def seed_data():
    async with AsyncSessionLocal() as db:
        # Clear existing tables to avoid duplicate key conflicts or foreign key violations
        print("Clearing tables...")
        await db.execute(delete(Notebook))
        await db.execute(delete(Workspace))
        await db.execute(delete(User))
        await db.commit()

        # Seed User
        user_id = uuid.UUID("4a8f6d6f-7d12-4632-bd88-6629f1709405")
        print("Creating seed user...")
        user = User(
            id=user_id,
            email="test@sourcemind.ai",
            hashed_password="dummy_hashed_password",
            full_name="Dr. Aris",
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # Seed Workspace
        workspace_id = uuid.UUID("92a3fcd6-ec3c-4467-b5bf-73c15320c29f")
        print("Creating seed workspace...")
        workspace = Workspace(
            id=workspace_id,
            name="Quantum Physics Research",
            owner_id=user.id
        )
        db.add(workspace)
        await db.commit()
        await db.refresh(workspace)

        # Seed Notebook
        notebook_id = uuid.UUID("0eb2fa05-b049-43c2-bf72-46ccbd6c903e")
        print("Creating seed notebook...")
        notebook = Notebook(
            id=notebook_id,
            name="Schrödinger Wave Analysis",
            workspace_id=workspace.id
        )
        db.add(notebook)
        await db.commit()
        await db.refresh(notebook)

        print("Seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
