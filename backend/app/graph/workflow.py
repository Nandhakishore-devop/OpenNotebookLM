import asyncio
import logging
import uuid
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from sqlalchemy import text, insert
from sqlalchemy.future import select

from app.models.chat_message import ChatMessage
from app.models.citation import Citation as CitationModel
from app.models.retrieval_log import RetrievalLog as RetrievalLogModel
from app.embeddings import embedding_service
from app.storage import vector_storage
from app.services.retrieval.hybrid import cosine_similarity
from app.services.memory.manager import memory_manager
from app.services.llm.provider import llm_provider
from app.services.prompts.templates import SYSTEM_QUERY_REWRITER, SYSTEM_RAG_ANSWER
from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny

logger = logging.getLogger(__name__)

# Minimum cosine similarity required between query and any retrieved chunk.
# Below this threshold the query is considered out-of-scope and the LLM is
# NOT called — a hard refusal is returned instead.
#
# Calibrated from diagnostic measurements against real document chunks:
#   Out-of-scope queries ("who is pm of india", etc.) → best ≈ 0.36–0.38
#   In-scope queries ("what is precision formula")    → best ≈ 0.73+
# Threshold of 0.45 sits cleanly between both groups.
RELEVANCE_THRESHOLD = 0.45
OUT_OF_SCOPE_REPLY = "I don't have information about that in the uploaded sources."

# Define state structure
class GraphState(TypedDict):
    session_id: str
    notebook_id: str
    user_message: str
    user_message_id: str  # ID of user message in DB
    chat_history: List[Dict[str, str]]
    memory_summary: Optional[str]
    memory_vectors: List[Dict[str, Any]]
    rewritten_query: str
    vector_results: List[Dict[str, Any]]
    keyword_results: List[Dict[str, Any]]
    reranked_chunks: List[Dict[str, Any]]
    prompt: str
    response_text: str
    citations: List[Dict[str, Any]]
    db_session: Any       # AsyncSession
    token_queue: Any      # asyncio.Queue

# Graph Node 1: Load Recent Chat History
async def load_history_node(state: GraphState) -> Dict[str, Any]:
    db = state["db_session"]
    session_id = state["session_id"]
    logger.info(f"[Graph] Node 'load_history' for session {session_id}")
    history = await memory_manager.get_recent_history(db, session_id, limit=8)
    return {"chat_history": history}

# Graph Node 2: Retrieve Memory (SQL summary and vector memories)
async def retrieve_memory_node(state: GraphState) -> Dict[str, Any]:
    db = state["db_session"]
    notebook_id = state["notebook_id"]
    user_msg = state["user_message"]
    logger.info(f"[Graph] Node 'retrieve_memory' for notebook {notebook_id}")
    
    summary = await memory_manager.get_summary_memory(db, notebook_id)
    vector_mems = await memory_manager.get_vector_memory(notebook_id, user_msg, limit=3)
    
    return {
        "memory_summary": summary,
        "memory_vectors": vector_mems
    }

# Graph Node 3: Query Rewriting
async def rewrite_query_node(state: GraphState) -> Dict[str, Any]:
    user_msg = state["user_message"]
    history = state["chat_history"]
    memory_summary = state["memory_summary"]
    
    logger.info("[Graph] Node 'rewrite_query'")
    
    # If no history, no rewrite is needed
    if not history:
        return {"rewritten_query": user_msg}
        
    # Build query rewriting prompt with context
    history_str = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in history])
    memory_str = f"Notebook Memory Summary:\n{memory_summary}\n" if memory_summary else ""
    
    user_prompt = (
        f"{memory_str}\n"
        f"Conversation History:\n{history_str}\n\n"
        f"Latest User Message: {user_msg}\n\n"
        f"Rewrite this user message into a standalone search query:"
    )
    
    rewritten = ""
    try:
        tokens = []
        async for token in llm_provider.generate_stream(
            system_prompt=SYSTEM_QUERY_REWRITER,
            messages=[{"role": "user", "content": user_prompt}]
        ):
            tokens.append(token)
        rewritten = "".join(tokens).strip()
    except Exception as e:
        logger.warning(f"Query rewriting failed: {e}. Using original message.")
        rewritten = user_msg
        
    if not rewritten:
        rewritten = user_msg
        
    logger.info(f"Query rewritten: '{user_msg}' -> '{rewritten}'")
    return {"rewritten_query": rewritten}

# Graph Node 4: Semantic Vector Retrieval (Qdrant)
async def vector_retrieval_node(state: GraphState) -> Dict[str, Any]:
    db = state["db_session"]
    notebook_id = state["notebook_id"]
    query = state["rewritten_query"]
    logger.info(f"[Graph] Node 'vector_retrieval' with query: '{query}'")
    
    results = []
    try:
        # Get active/ready documents from PG to prevent orphaned vector leaks
        from app.models.document import Document
        stmt = select(Document.id).where(Document.notebook_id == uuid.UUID(notebook_id))
        res = await db.execute(stmt)
        active_doc_ids = [str(uid) for uid in res.scalars().all()]
        
        # If there are no active documents, we don't query Qdrant
        if active_doc_ids:
            query_vector = embedding_service.generate_embeddings([query])[0]
            search_res = vector_storage.client.search(
                collection_name=vector_storage.collection_name,
                query_vector=query_vector,
                query_filter=Filter(
                    must=[
                        FieldCondition(
                            key="notebook_id",
                            match=MatchValue(value=notebook_id)
                        ),
                        FieldCondition(
                            key="document_id",
                            match=MatchAny(any=active_doc_ids)
                        )
                    ]
                ),
                limit=8
            )
            
            for point in search_res:
                payload = point.payload or {}
                meta = payload.get("metadata", {})
                results.append({
                    "chunk_id": payload.get("chunk_id") or point.id,
                    "document_id": payload.get("document_id"),
                    "notebook_id": payload.get("notebook_id"),
                    "text": payload.get("text", ""),
                    "chunk_index": payload.get("chunk_index", 0),
                    "filename": meta.get("filename") or "Document Source",
                    "page_number": meta.get("page_number"),
                    "section_title": meta.get("section_title"),
                    "slide_number": meta.get("slide_number"),
                    "timestamp": meta.get("timestamp"),
                    "source_url": meta.get("source_url")
                })
    except Exception as e:
        logger.warning(f"Qdrant vector retrieval failed/offline: {e}")
        
    return {"vector_results": results}

# Graph Node 5: Keyword Retrieval (Postgres Full-Text Search)
async def keyword_retrieval_node(state: GraphState) -> Dict[str, Any]:
    db = state["db_session"]
    notebook_id = state["notebook_id"]
    query = state["rewritten_query"]
    logger.info(f"[Graph] Node 'keyword_retrieval' with query: '{query}'")
    
    results = []
    try:
        # JOIN with documents to guard against orphaned chunks from deleted docs
        sql_query = text("""
            SELECT c.id, c.document_id, c.notebook_id, c.text, c.chunk_index, c.meta_data,
                   ts_rank_cd(to_tsvector('english', c.text), plainto_tsquery('english', :query)) AS rank
            FROM chunks c
            INNER JOIN documents d ON d.id = c.document_id
            WHERE c.notebook_id = :notebook_id 
              AND to_tsvector('english', c.text) @@ plainto_tsquery('english', :query)
            ORDER BY rank DESC
            LIMIT 8
        """)
        
        res = await db.execute(sql_query, {
            "notebook_id": uuid.UUID(notebook_id),
            "query": query
        })
        rows = res.all()
        
        # Fallback to basic ILIKE matching — also JOINed to guard against orphans
        if not rows:
            fallback_query = text("""
                SELECT c.id, c.document_id, c.notebook_id, c.text, c.chunk_index, c.meta_data, 1.0 AS rank
                FROM chunks c
                INNER JOIN documents d ON d.id = c.document_id
                WHERE c.notebook_id = :notebook_id AND c.text ILIKE :like_query
                LIMIT 5
            """)
            res = await db.execute(fallback_query, {
                "notebook_id": uuid.UUID(notebook_id),
                "like_query": f"%{query}%"
            })
            rows = res.all()

        for row in rows:
            meta = row.meta_data or {}
            results.append({
                "chunk_id": str(row.id),
                "document_id": str(row.document_id),
                "notebook_id": str(row.notebook_id),
                "text": row.text,
                "chunk_index": row.chunk_index,
                "filename": meta.get("filename") or "Document Source",
                "page_number": meta.get("page_number"),
                "section_title": meta.get("section_title"),
                "slide_number": meta.get("slide_number"),
                "timestamp": meta.get("timestamp"),
                "source_url": meta.get("source_url")
            })
    except Exception as e:
        logger.warning(f"PostgreSQL keyword retrieval failed: {e}")
        
    return {"keyword_results": results}

# Graph Node 6: Reranking (RRF Merge + Semantic Cosine similarity reranker)
async def rerank_node(state: GraphState) -> Dict[str, Any]:
    vecs = state["vector_results"]
    keys = state["keyword_results"]
    query = state["rewritten_query"]
    logger.info("[Graph] Node 'rerank'")
    
    # 1. RRF Merging
    rrf_scores = {}
    chunks_map = {}
    
    def apply_rrf(results_list):
        for rank, chunk in enumerate(results_list):
            cid = chunk["chunk_id"]
            chunks_map[cid] = chunk
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (60.0 + rank))
            
    apply_rrf(vecs)
    apply_rrf(keys)
    
    sorted_cids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
    candidates = [chunks_map[cid] for cid in sorted_cids[:10]] # limit candidates
    
    if not candidates:
        # Ultimate DB safety fallback
        logger.warning("No candidates after RRF. Loading fallback chunks.")
        try:
            db = state["db_session"]
            notebook_id = state["notebook_id"]
            from app.models.chunk import Chunk
            from app.models.document import Document
            # JOIN against documents to guard against orphaned chunks from deleted sources
            stmt = (
                select(Chunk)
                .join(Document, Document.id == Chunk.document_id)
                .where(Chunk.notebook_id == uuid.UUID(notebook_id))
                .limit(4)
            )
            res = await db.execute(stmt)
            db_chunks = res.scalars().all()
            for c in db_chunks:
                meta = c.meta_data or {}
                chunk_data = {
                    "chunk_id": str(c.id),
                    "document_id": str(c.document_id),
                    "notebook_id": str(c.notebook_id),
                    "text": c.text,
                    "chunk_index": c.chunk_index,
                    "filename": meta.get("filename") or "Document Source",
                    "page_number": meta.get("page_number"),
                    "section_title": meta.get("section_title"),
                    "slide_number": meta.get("slide_number"),
                    "timestamp": meta.get("timestamp"),
                    "source_url": meta.get("source_url")
                }
                candidates.append(chunk_data)
        except Exception as e:
            logger.error(f"Ultimate fallback retrieval failed: {e}")

    # 2. Embedding Semantic similarity reranker
    reranked = candidates
    try:
        query_vector = embedding_service.generate_embeddings([query])[0]
        candidate_texts = [c["text"] for c in candidates]
        embeddings = embedding_service.generate_embeddings(candidate_texts)
        
        for chunk, embedding in zip(candidates, embeddings):
            chunk["rerank_score"] = cosine_similarity(query_vector, embedding)
            
        reranked = sorted(candidates, key=lambda x: x.get("rerank_score", 0.0), reverse=True)
    except Exception as e:
        logger.warning(f"Reranking scoring failed: {e}")
        
    return {"reranked_chunks": reranked[:5]} # Top 5 chunks passed to LLM

# Graph Node 7: Prompt Building
async def build_prompt_node(state: GraphState) -> Dict[str, Any]:
    chunks = state["reranked_chunks"]
    logger.info("[Graph] Node 'build_prompt'")
    
    if not chunks:
        context_str = "No document chunks retrieved for context. Please note that no files are active or matching."
    else:
        context_parts = []
        for idx, c in enumerate(chunks):
            citation_num = idx + 1
            source_tag = f"Source [{citation_num}]: {c['filename']}"
            if c.get("page_number"):
                source_tag += f" (Page {c['page_number']})"
            elif c.get("slide_number"):
                source_tag += f" (Slide {c['slide_number']})"
            elif c.get("timestamp"):
                source_tag += f" (Time {c['timestamp']})"
            
            context_parts.append(f"{source_tag}\nContent: {c['text']}")
        context_str = "\n\n".join(context_parts)
        
    prompt = SYSTEM_RAG_ANSWER.format(context=context_str)
    return {"prompt": prompt}

# Graph Node 8: Response Generation
async def generate_response_node(state: GraphState) -> Dict[str, Any]:
    prompt = state["prompt"]
    user_msg = state["user_message"]
    queue = state["token_queue"]
    chunks = state["reranked_chunks"]
    history = state["chat_history"]
    
    logger.info("[Graph] Node 'generate_response'")

    # ── Relevance Gate ────────────────────────────────────────────────────────
    # Compute cosine similarity between the user query and every retrieved chunk.
    # If the best score is below RELEVANCE_THRESHOLD the question is out-of-scope
    # and we short-circuit WITHOUT calling the LLM so it cannot hallucinate.
    is_out_of_scope = False
    if chunks:
        try:
            query_vec = await asyncio.to_thread(
                embedding_service.generate_embeddings, [user_msg]
            )
            query_vec = query_vec[0]
            chunk_texts = [c["text"] for c in chunks]
            chunk_vecs = await asyncio.to_thread(
                embedding_service.generate_embeddings, chunk_texts
            )
            best_score = max(cosine_similarity(query_vec, cv) for cv in chunk_vecs)
            logger.info(f"[Gate] Best chunk relevance score: {best_score:.4f} (threshold={RELEVANCE_THRESHOLD})")
            if best_score < RELEVANCE_THRESHOLD:
                is_out_of_scope = True
        except Exception as gate_err:
            logger.warning(f"[Gate] Relevance check failed, allowing LLM call: {gate_err}")
    else:
        # No chunks at all — definitely out of scope
        is_out_of_scope = True

    if is_out_of_scope:
        logger.info("[Gate] Query is out-of-scope. Returning hard refusal without calling LLM.")
        refusal = OUT_OF_SCOPE_REPLY
        if queue:
            await queue.put({"type": "token", "content": refusal})
            await queue.put({"type": "citations", "content": []})
            await queue.put({"type": "done"})
        return {"response_text": refusal, "citations": []}
    # ── End Relevance Gate ───────────────────────────────────────────────────

    # format LLM messages input (recent history)
    llm_messages = []
    for m in history[-4:]: # last 2 turns
        llm_messages.append({"role": m["role"], "content": m["content"]})
    llm_messages.append({"role": "user", "content": f"Answer this question: {user_msg}"})
    
    tokens = []
    try:
        async for token in llm_provider.generate_stream(system_prompt=prompt, messages=llm_messages):
            tokens.append(token)
            if queue:
                await queue.put({"type": "token", "content": token})
    except Exception as e:
        logger.error(f"Response generation failed: {e}")
        fallback_msg = "I encountered an error while formulating my response. Please check endpoints."
        tokens = [fallback_msg]
        if queue:
            await queue.put({"type": "token", "content": fallback_msg})

    response_text = "".join(tokens)
    
    # Build citations
    citations = []
    for idx, c in enumerate(chunks):
        cite_id = idx + 1
        source_label = c["filename"]
        if c.get("page_number"):
            source_label += f" (Page {c['page_number']})"
        elif c.get("slide_number"):
            source_label += f" (Slide {c['slide_number']})"
        elif c.get("timestamp"):
            source_label += f" (Time {c['timestamp']})"

        citations.append({
            "id": cite_id,
            "document_name": c["filename"],
            "page_number": c.get("page_number"),
            "timestamp": str(c.get("timestamp")) if c.get("timestamp") else None,
            "chunk_preview": c["text"][:200] + "...",
            "source_label": source_label
        })
        
    if queue:
        await queue.put({"type": "citations", "content": citations})
        await queue.put({"type": "done"})
        
    return {"response_text": response_text, "citations": citations}

# Graph Node 9: Memory Update
async def update_memory_node(state: GraphState) -> Dict[str, Any]:
    db = state["db_session"]
    notebook_id = state["notebook_id"]
    session_id = state["session_id"]
    user_msg = state["user_message"]
    response_text = state["response_text"]
    citations = state["citations"]
    query = state["rewritten_query"]
    chunks = state["reranked_chunks"]
    
    logger.info("[Graph] Node 'update_memory'")
    
    try:
        # 1. Save assistant response message to Database
        assistant_msg_id = uuid.uuid4()
        stmt_msg = insert(ChatMessage).values(
            id=assistant_msg_id,
            session_id=uuid.UUID(session_id),
            role="assistant",
            content=response_text
        )
        await db.execute(stmt_msg)
        
        # 2. Save citations to Database
        for cite in citations:
            stmt_cite = insert(CitationModel).values(
                id=uuid.uuid4(),
                message_id=assistant_msg_id,
                document_name=cite["document_name"],
                page_number=cite["page_number"],
                timestamp=cite["timestamp"],
                chunk_preview=cite["chunk_preview"]
            )
            await db.execute(stmt_cite)
            
        # 3. Save retrieval logs to Database
        retrieved_log_data = [
            {
                "chunk_id": c["chunk_id"],
                "filename": c["filename"],
                "score": c.get("rerank_score", 0.0)
            }
            for c in chunks
        ]
        stmt_log = insert(RetrievalLogModel).values(
            id=uuid.uuid4(),
            message_id=assistant_msg_id,
            query=user_msg,
            rewritten_query=query,
            retrieved_chunks=retrieved_log_data,
            engine="hybrid"
        )
        await db.execute(stmt_log)
        
        await db.commit()
        logger.info("[Graph] Assistant message, citations, and retrieval logs saved to PG.")
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to save assistant turn to PG: {e}")

    # 4. Trigger memory updates asynchronously
    try:
        await memory_manager.update_memory(
            db=db,
            notebook_id=notebook_id,
            session_id=session_id,
            user_msg=user_msg,
            assistant_msg=response_text
        )
    except Exception as e:
        logger.error(f"Failed to update memory summaries: {e}")
        
    return {}

# ----------------- Build and Compile Graph -----------------

workflow = StateGraph(GraphState)

# Add nodes
workflow.add_node("load_history", load_history_node)
workflow.add_node("retrieve_memory", retrieve_memory_node)
workflow.add_node("rewrite_query", rewrite_query_node)
workflow.add_node("vector_retrieval", vector_retrieval_node)
workflow.add_node("keyword_retrieval", keyword_retrieval_node)
workflow.add_node("rerank", rerank_node)
workflow.add_node("build_prompt", build_prompt_node)
workflow.add_node("generate_response", generate_response_node)
workflow.add_node("update_memory", update_memory_node)

# Set edges
workflow.set_entry_point("load_history")
workflow.add_edge("load_history", "retrieve_memory")
workflow.add_edge("retrieve_memory", "rewrite_query")
workflow.add_edge("rewrite_query", "vector_retrieval")
workflow.add_edge("vector_retrieval", "keyword_retrieval")
workflow.add_edge("keyword_retrieval", "rerank")
workflow.add_edge("rerank", "build_prompt")
workflow.add_edge("build_prompt", "generate_response")
workflow.add_edge("generate_response", "update_memory")
workflow.add_edge("update_memory", END)

# Compile graph
compiled_graph = workflow.compile()
