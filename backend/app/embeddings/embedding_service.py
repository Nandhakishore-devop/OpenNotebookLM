import logging
from typing import List, Union
import numpy as np

logger = logging.getLogger(__name__)

try:
    from sentence_transformers import SentenceTransformer
    import torch
except ImportError:
    SentenceTransformer = None
    torch = None


class EmbeddingService:
    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.model_name = model_name
        self.model = None
        self.dimension = 384  # both BGE-small and all-MiniLM-L6-v2 are 384 dimensions

    def load_model(self):
        """
        Lazily loads the SentenceTransformer model on the appropriate device.
        """
        if self.model is not None:
            return

        if not SentenceTransformer:
            logger.error("sentence-transformers package is not installed.")
            return

        try:
            device = "cuda" if torch and torch.cuda.is_available() else "cpu"
            logger.info(f"Loading embedding model '{self.model_name}' on device: {device}")
            self.model = SentenceTransformer(self.model_name, device=device)
            # Fetch model dimension dynamically
            if hasattr(self.model, "get_sentence_embedding_dimension"):
                self.dimension = self.model.get_sentence_embedding_dimension()
            logger.info(f"Loaded '{self.model_name}'. Dimension: {self.dimension}")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise e

    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generates list of embeddings (lists of floats) for a list of input texts.
        """
        if not texts:
            return []

        self.load_model()
        
        if not self.model:
            # Fallback mock embeddings for local execution if dependency fails
            logger.warning("Embedding model not loaded. Generating fallback mock embeddings.")
            return [np.random.randn(self.dimension).tolist() for _ in texts]

        try:
            # Generate embeddings
            embeddings = self.model.encode(
                texts,
                batch_size=32,
                show_progress_bar=False,
                convert_to_numpy=True
            )
            # Convert NumPy arrays to standard lists of floats
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            raise e


# Global instance of the service
embedding_service = EmbeddingService()
