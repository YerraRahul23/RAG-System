from typing import List
from sentence_transformers import SentenceTransformer
from app.core.logging import logger

class EmbeddingService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        logger.info(f"Loading embedding model: {model_name}...")
        self.model = SentenceTransformer(model_name)
        logger.info(f"Embedding model {model_name} loaded successfully.")

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate list of embeddings (float lists) for a list of texts."""
        embeddings = self.model.encode(texts)
        # Convert numpy array to list of float lists
        return embeddings.tolist()

    def get_embedding(self, text: str) -> List[float]:
        """Generate a single embedding for a query string."""
        embedding = self.model.encode(text)
        return embedding.tolist()
