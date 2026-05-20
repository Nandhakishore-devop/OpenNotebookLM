import asyncio
from app.db.database import Base, engine
from app.models.user import User
from app.models.workspace import Workspace
from app.models.notebook import Notebook
from app.models.document import Document
from app.models.chunk import Chunk
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.citation import Citation
from app.models.retrieval_log import RetrievalLog
from app.models.memory_summary import MemorySummary


async def init_models():
    async with engine.begin() as conn:
        print("Creating database tables...")
        # For development, you can drop tables first if needed, but create_all is safe if they don't exist
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created successfully!")

if __name__ == "__main__":
    asyncio.run(init_models())
