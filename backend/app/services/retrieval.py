from typing import List, Dict, Any
from app.services.embedding import EmbeddingService
from app.services.vector_store import VectorStoreService
from app.core.logging import logger

class RetrievalService:
    def __init__(self, embedding_service: EmbeddingService, vector_store_service: VectorStoreService):
        self.embedding_service = embedding_service
        self.vector_store_service = vector_store_service

    def retrieve_context(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Generate query embedding and retrieve matching documents from ChromaDB."""
        logger.info(f"Retrieving top {top_k} context chunks for query: '{query[:50]}...'")
        
        # 1. Get embedding for user query
        query_embedding = self.embedding_service.get_embedding(query)
        
        # 2. Query the vector store
        similar_chunks = self.vector_store_service.query_similar(query_embedding, top_k=top_k)
        
        return similar_chunks
