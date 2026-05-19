import io
from typing import List
import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer
import uuid

from app.core.config import settings
from app.core.storage import get_minio_client

# Initialize models and clients globally for reuse
embed_model = SentenceTransformer("BAAI/bge-small-en-v1.5")
qdrant_client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)

VECTOR_COLLECTION = "sourcemind_documents"

def init_qdrant():
    """Ensure the Qdrant collection exists."""
    collections = qdrant_client.get_collections().collections
    if not any(c.name == VECTOR_COLLECTION for c in collections):
        # BAAI/bge-small-en-v1.5 has an embedding dimension of 384
        qdrant_client.create_collection(
            collection_name=VECTOR_COLLECTION,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )

def process_document(document_id: str, file_path: str, file_type: str, notebook_id: str):
    """
    Background task to download file from MinIO, parse it, chunk it, embed it, and store in Qdrant.
    """
    minio_client = get_minio_client()
    
    # 1. Download from MinIO
    response = minio_client.get_object("sourcemind-documents", file_path.split("sourcemind-documents/")[1])
    file_bytes = response.read()
    response.close()
    response.release_conn()

    # 2. Parse text
    text = ""
    if file_type.lower() == "pdf":
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            text += page.get_text() + "\n\n"
    else:
        # Assume text for now
        text = file_bytes.decode("utf-8", errors="ignore")

    # 3. Chunking
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )
    chunks = text_splitter.split_text(text)

    if not chunks:
        return

    # 4. Embeddings
    embeddings = embed_model.encode(chunks, convert_to_numpy=True)

    # 5. Store in Qdrant
    points = []
    for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=embedding.tolist(),
            payload={
                "document_id": str(document_id),
                "notebook_id": str(notebook_id),
                "text": chunk_text,
                "chunk_index": i
            }
        ))
    
    init_qdrant()
    qdrant_client.upsert(
        collection_name=VECTOR_COLLECTION,
        points=points
    )
