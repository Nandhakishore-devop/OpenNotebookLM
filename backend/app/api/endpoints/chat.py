import asyncio
import json
import logging
import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, UUID4
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from app.api import deps
from app.models.user import User
from app.models.notebook import Notebook
from app.models.workspace import Workspace
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.citation import Citation as CitationModel
from app.graph.workflow import compiled_graph

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic Schemas for Requests and Responses
class SessionCreateRequest(BaseModel):
    notebook_id: str
    title: Optional[str] = "New Chat"

class SessionResponse(BaseModel):
    id: UUID4
    notebook_id: UUID4
    title: str
    created_at: Any
    updated_at: Any

    class Config:
        from_attributes = True

class MessageCreateRequest(BaseModel):
    message: str

class CitationSchema(BaseModel):
    id: int
    document_name: str
    page_number: Optional[int] = None
    timestamp: Optional[str] = None
    chunk_preview: str

class MessageResponse(BaseModel):
    id: UUID4
    role: str
    content: str
    created_at: Any
    citations: List[CitationSchema] = []

    class Config:
        from_attributes = True

# 1. Create a new chat session
@router.post("/session", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    request: SessionCreateRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Create a new chat session under a specific notebook, verifying ownership first.
    """
    # Verify the notebook exists and belongs to a workspace owned by the current user
    stmt = (
        select(Notebook, Workspace)
        .join(Workspace, Notebook.workspace_id == Workspace.id)
        .where(Notebook.id == uuid.UUID(request.notebook_id), Workspace.owner_id == current_user.id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Notebook not found or access denied")
    
    session = ChatSession(
        id=uuid.uuid4(),
        notebook_id=uuid.UUID(request.notebook_id),
        title=request.title or "New Chat"
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session

# 1b. List all chat sessions for a notebook
@router.get("/notebook/{notebook_id}/sessions", response_model=List[SessionResponse])
async def get_notebook_sessions(
    notebook_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    List all chat sessions associated with a specific notebook.
    """
    stmt = (
        select(ChatSession)
        .join(Notebook, ChatSession.notebook_id == Notebook.id)
        .join(Workspace, Notebook.workspace_id == Workspace.id)
        .where(Notebook.id == uuid.UUID(notebook_id), Workspace.owner_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


# 2. Get chat session history
@router.get("/{session_id}/history", response_model=List[MessageResponse])
async def get_chat_history(
    session_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Retrieve message history for a chat session, including citations.
    """
    # Verify session and ownership
    stmt = (
        select(ChatSession, Notebook, Workspace)
        .join(Notebook, ChatSession.notebook_id == Notebook.id)
        .join(Workspace, Notebook.workspace_id == Workspace.id)
        .where(ChatSession.id == uuid.UUID(session_id), Workspace.owner_id == current_user.id)
    )
    result = await db.execute(stmt)
    if not result.first():
        raise HTTPException(status_code=404, detail="Chat session not found")

    # Fetch messages
    msg_stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == uuid.UUID(session_id))
        .order_by(ChatMessage.created_at.asc())
    )
    msg_result = await db.execute(msg_stmt)
    messages = msg_result.scalars().all()

    # Map to schema with citations
    response_messages = []
    for msg in messages:
        # Load citations for assistant messages
        citations_list = []
        if msg.role == "assistant":
            cite_stmt = select(CitationModel).where(CitationModel.message_id == msg.id)
            cite_res = await db.execute(cite_stmt)
            cites = cite_res.scalars().all()
            for idx, c in enumerate(cites):
                citations_list.append(CitationSchema(
                    id=idx + 1,
                    document_name=c.document_name,
                    page_number=c.page_number,
                    timestamp=c.timestamp,
                    chunk_preview=c.chunk_preview
                ))
        
        response_messages.append(MessageResponse(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            created_at=msg.created_at,
            citations=citations_list
        ))

    return response_messages

# 3. Post a message to a session and get a streamed response
@router.post("/{session_id}/message")
async def send_message_stream(
    session_id: str,
    request: MessageCreateRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Handles conversational multi-turn Q&A:
    1. Loads history and memories
    2. Rewrites queries
    3. Runs hybrid search
    4. Reranks and builds custom prompt
    5. Streams responses back in real-time via Server-Sent Events (SSE)
    6. Saves chat history, citation metadata, and updates memory asynchronously
    """
    # Verify session and ownership
    stmt = (
        select(ChatSession, Notebook, Workspace)
        .join(Notebook, ChatSession.notebook_id == Notebook.id)
        .join(Workspace, Notebook.workspace_id == Workspace.id)
        .where(ChatSession.id == uuid.UUID(session_id), Workspace.owner_id == current_user.id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    session, notebook, workspace = row

    # Auto-update session title if it's currently default "New Chat"
    if session.title == "New Chat":
        title_snippet = request.message[:40]
        session.title = title_snippet + "..." if len(request.message) > 40 else title_snippet
        db.add(session)
        await db.commit()

    # 1. Save user query to Database
    user_msg_id = uuid.uuid4()
    user_msg = ChatMessage(
        id=user_msg_id,
        session_id=session.id,
        role="user",
        content=request.message
    )
    db.add(user_msg)
    await db.commit()

    # 2. Run LangGraph workflow with background queue listener
    queue = asyncio.Queue()
    
    initial_state = {
        "session_id": str(session.id),
        "notebook_id": str(notebook.id),
        "user_message": request.message,
        "user_message_id": str(user_msg_id),
        "chat_history": [],
        "memory_summary": None,
        "memory_vectors": [],
        "rewritten_query": "",
        "vector_results": [],
        "keyword_results": [],
        "reranked_chunks": [],
        "prompt": "",
        "response_text": "",
        "citations": [],
        "db_session": db,
        "token_queue": queue
    }

    # Execute LangGraph in background task
    graph_task = asyncio.create_task(compiled_graph.ainvoke(initial_state))

    # Event generator yielding SSE format chunks
    async def event_generator():
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                
                # Check for sentinel completion events
                if event["type"] == "done":
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    queue.task_done()
                    break
                
                # Yield standard tokens and citations
                yield f"data: {json.dumps(event)}\n\n"
                queue.task_done()
                
            # Await the final background task execution (saving memory summaries, etc.)
            await graph_task
        except asyncio.CancelledError:
            logger.warning(f"Client disconnected early from SSE stream for session {session_id}.")
            if not graph_task.done():
                graph_task.cancel()
        except Exception as e:
            logger.error(f"SSE generator encountered exception: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# 4. Delete chat session
@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_session(
    session_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> None:
    """
    Deletes an active chat session and cascade deletes all message content.
    """
    # Verify session ownership
    stmt = (
        select(ChatSession, Notebook, Workspace)
        .join(Notebook, ChatSession.notebook_id == Notebook.id)
        .join(Workspace, Notebook.workspace_id == Workspace.id)
        .where(ChatSession.id == uuid.UUID(session_id), Workspace.owner_id == current_user.id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    session = row[0]
    await db.delete(session)
    await db.commit()


# --- Direct Query Compat Endpoint for Workspace Search Page ---

class QueryRequest(BaseModel):
    notebook_id: str
    message: str

class CitationQueryResponse(BaseModel):
    id: int
    source: str
    snippet: str

class QueryResponse(BaseModel):
    response: str
    citations: List[CitationQueryResponse] = []

@router.post("/query", response_model=QueryResponse)
async def query_notebook_direct(
    request: QueryRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Direct, non-streaming query compatibility endpoint for the main workspace view.
    """
    # Verify the notebook exists and belongs to a workspace owned by the current user
    stmt = (
        select(Notebook, Workspace)
        .join(Workspace, Notebook.workspace_id == Workspace.id)
        .where(Notebook.id == uuid.UUID(request.notebook_id), Workspace.owner_id == current_user.id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Notebook not found or access denied")
    
    notebook, workspace = row

    # Perform hybrid retrieval using our new service
    try:
        from app.services.retrieval.hybrid import hybrid_retrieval_service
        chunks = await hybrid_retrieval_service.retrieve(
            db=db,
            notebook_id=request.notebook_id,
            query=request.message,
            limit=5
        )
    except Exception as e:
        logger.error(f"Direct query hybrid retrieval failed: {e}")
        chunks = []

    # Format RAG prompt
    from app.services.prompts.templates import SYSTEM_RAG_ANSWER
    if not chunks:
        context_str = "No document chunks retrieved for context."
    else:
        context_parts = []
        for idx, c in enumerate(chunks):
            source_tag = f"Source [{idx + 1}]: {c['filename']}"
            if c.get("page_number"):
                source_tag += f" (Page {c['page_number']})"
            context_parts.append(f"{source_tag}\nContent: {c['text']}")
        context_str = "\n\n".join(context_parts)
    
    prompt = SYSTEM_RAG_ANSWER.format(context=context_str)

    # Generate response from primary/fallback LLM providers
    from app.services.llm.provider import llm_provider
    tokens = []
    try:
        async for token in llm_provider.generate_stream(
            system_prompt=prompt,
            messages=[{"role": "user", "content": request.message}]
        ):
            tokens.append(token)
    except Exception as e:
        logger.error(f"Direct query LLM call failed: {e}")
        tokens = ["Failed to generate response due to LLM provider offline."]

    response_text = "".join(tokens)

    # Build citations list matching the workspace view schema
    citations = []
    for idx, c in enumerate(chunks):
        citations.append(CitationQueryResponse(
            id=idx + 1,
            source=c["filename"],
            snippet=c["text"]
        ))

    return QueryResponse(response=response_text, citations=citations)

