import logging
import uuid
import asyncio
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.document import Document, DocumentStatus
from app.ingestion.parsers import (
    extract_pdf_content,
    extract_docx_content,
    extract_pptx_content,
    extract_web_content,
    extract_youtube_content,
    extract_audio_transcript
)
from app.chunking import create_semantic_chunks
from app.embeddings import embedding_service
from app.storage import vector_storage, save_chunks_to_db
from app.core.storage import get_minio_client

logger = logging.getLogger(__name__)


async def run_pipeline(
    document_id: str,
    file_path: str,
    file_type: str,
    notebook_id: str,
    db: AsyncSession
) -> None:
    """
    Executes the multi-format ingestion pipeline:
    1. Downloads file from MinIO (or reads URL direct)
    2. Invokes target file/URL parser to extract raw text & structural metadata
    3. Standardizes and cleans the extracted text
    4. Segments text into sentence-boundary aligned semantic chunks
    5. Batch generates vector embeddings using SentenceTransformers
    6. Stores vectors in Qdrant
    7. Stores chunk strings and metadata payload in PostgreSQL
    8. Updates document status to 'ready'
    """
    logger.info(f"Starting ingestion pipeline for document: {document_id}")
    
    # 1. Fetch document record to update its progress
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalars().first()
    if not doc:
        logger.error(f"Document {document_id} not found in database.")
        return

    doc.status = DocumentStatus.processing
    await db.commit()

    try:
        raw_text = ""
        pages_meta = []
        global_meta = {}
        filename = doc.title

        # 2. Extract content based on file/source type
        source_type = file_type.lower()
        
        # Check if source is a URL or a file path in MinIO
        is_url = file_path.startswith("http://") or file_path.startswith("https://")
        
        if is_url:
            logger.info(f"Ingesting URL source: {file_path}")
            if "youtube" in file_path or "youtu.be" in file_path or source_type == "youtube":
                raw_text, pages_meta, global_meta = await asyncio.to_thread(extract_youtube_content, file_path)
            else:
                raw_text, pages_meta, global_meta = await extract_web_content(file_path)
        else:
            # Load file bytes from MinIO
            logger.info(f"Downloading file {file_path} from MinIO")
            minio_client = get_minio_client()
            bucket_name = file_path.split("/")[0]
            object_name = "/".join(file_path.split("/")[1:])
            
            try:
                response = await asyncio.to_thread(minio_client.get_object, bucket_name, object_name)
                file_bytes = await asyncio.to_thread(response.read)
                response.close()
                response.release_conn()
            except Exception as minio_err:
                logger.error(f"MinIO download failed for {file_path}: {minio_err}")
                raise minio_err

            if source_type == "pdf":
                raw_text, pages_meta, global_meta = await asyncio.to_thread(extract_pdf_content, file_bytes, filename)
            elif source_type in ["docx", "doc"]:
                raw_text, pages_meta, global_meta = await asyncio.to_thread(extract_docx_content, file_bytes, filename)
            elif source_type in ["pptx", "ppt"]:
                raw_text, pages_meta, global_meta = await asyncio.to_thread(extract_pptx_content, file_bytes, filename)
            elif source_type in ["mp3", "wav", "m4a", "ogg", "flac"]:
                # Audio transcription via Whisper
                raw_text, pages_meta, global_meta = await asyncio.to_thread(extract_audio_transcript, file_bytes, filename)
            elif source_type in ["txt", "md", "markdown"]:
                raw_text = file_bytes.decode("utf-8", errors="ignore")
                pages_meta = []
                global_meta = {"filename": filename}
            else:
                # Default raw text decoding
                raw_text = file_bytes.decode("utf-8", errors="ignore")
                global_meta = {"filename": filename}

        if not raw_text.strip():
            raise ValueError("No text content could be extracted from source.")

        # 3. Clean and Chunk semantically
        logger.info(f"Chunking document text of length {len(raw_text)}")
        raw_chunks = await asyncio.to_thread(create_semantic_chunks, raw_text)
        logger.info(f"Generated {len(raw_chunks)} semantic chunks.")

        if not raw_chunks:
            raise ValueError("Document was chunked but returned 0 chunks.")

        # 4. Map chunks to target metadata structure (Requirement 14)
        processed_chunks = []
        for c in raw_chunks:
            chunk_idx = c["chunk_index"]
            chunk_text = c["text"]
            token_count = c["token_count"]

            # Infer source tracking properties (page, slide, timestamps)
            page_num = None
            slide_num = None
            timestamp = None
            section_title = None

            # Try to associate chunks back to specific page/slide/timestamp structural markers
            if source_type == "pdf":
                # Basic page matching approximation: partition by index
                ratio = chunk_idx / len(raw_chunks)
                if pages_meta:
                    idx_meta = min(int(ratio * len(pages_meta)), len(pages_meta) - 1)
                    page_num = pages_meta[idx_meta].get("page_number")
            elif source_type in ["pptx", "ppt"]:
                ratio = chunk_idx / len(raw_chunks)
                if pages_meta:
                    idx_meta = min(int(ratio * len(pages_meta)), len(pages_meta) - 1)
                    slide_num = pages_meta[idx_meta].get("slide_number")
                    section_title = pages_meta[idx_meta].get("section_title")
            elif "youtube" in file_path or source_type == "youtube":
                # Find matching segment timestamp
                ratio = chunk_idx / len(raw_chunks)
                if pages_meta:
                    idx_meta = min(int(ratio * len(pages_meta)), len(pages_meta) - 1)
                    timestamp = pages_meta[idx_meta].get("timestamp")
            elif source_type in ["mp3", "wav", "m4a", "ogg", "flac"]:
                ratio = chunk_idx / len(raw_chunks)
                if pages_meta:
                    idx_meta = min(int(ratio * len(pages_meta)), len(pages_meta) - 1)
                    timestamp = pages_meta[idx_meta].get("timestamp")

            # Map the exact chunk object payload format requested
            chunk_payload = {
                "chunk_id": str(uuid.uuid4()),
                "text": chunk_text,
                "token_count": token_count,
                "chunk_index": chunk_idx,
                "metadata": {
                    "filename": filename,
                    "page_number": page_num,
                    "section_title": section_title,
                    "slide_number": slide_num,
                    "timestamp": timestamp,
                    "source_url": global_meta.get("source_url") or file_path if is_url else None,
                    "chunk_index": chunk_idx
                }
            }
            processed_chunks.append(chunk_payload)

        # 5. Generate Vector Embeddings
        logger.info("Generating embeddings for chunks...")
        chunk_texts = [c["text"] for c in processed_chunks]
        embeddings = await asyncio.to_thread(embedding_service.generate_embeddings, chunk_texts)
        logger.info("Successfully generated embeddings.")

        # 6. Upsert to Qdrant (Vector storage)
        logger.info("Upserting vectors to Qdrant...")
        await asyncio.to_thread(
            vector_storage.upsert_chunks,
            chunks=processed_chunks,
            embeddings=embeddings,
            document_id=document_id,
            notebook_id=notebook_id
        )

        # 7. Save to PostgreSQL database (relational metadata storage)
        logger.info("Saving chunks to PostgreSQL...")
        await save_chunks_to_db(
            db=db,
            chunks=processed_chunks,
            document_id=document_id,
            notebook_id=notebook_id
        )

        # 8. Mark document as ready and save metadata
        doc.status = DocumentStatus.ready
        doc.meta_data = {
            "total_chunks": len(processed_chunks),
            "char_length": len(raw_text),
            "global_metadata": global_meta
        }
        await db.commit()
        logger.info(f"Ingestion pipeline completed successfully for document: {document_id}")

    except Exception as e:
        logger.error(f"Ingestion pipeline failed for document {document_id}: {e}", exc_info=True)
        # Update document status to failed
        doc.status = DocumentStatus.failed
        doc.meta_data = {"error": str(e)}
        await db.commit()
        raise e
