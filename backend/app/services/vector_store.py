import chromadb
from typing import List, Dict, Any
from app.core.config import settings
from app.core.logging import logger

class VectorStoreService:
    def __init__(self):
        self.host = settings.CHROMA_HOST
        self.port = settings.CHROMA_PORT
        self.collection_name = settings.CHROMA_COLLECTION
        self._client = None
        self._collection = None

    @property
    def client(self):
        if self._client is None:
            logger.info(f"Connecting to ChromaDB at http://{self.host}:{self.port}...")
            try:
                self._client = chromadb.HttpClient(host=self.host, port=self.port)
            except Exception as e:
                logger.error(f"Failed to connect to ChromaDB: {e}")
                raise e
        return self._client

    @property
    def collection(self):
        if self._collection is None:
            try:
                self._collection = self.client.get_or_create_collection(
                    name=self.collection_name,
                    metadata={"hnsw:space": "cosine"}  # Use cosine similarity
                )
            except Exception as e:
                logger.error(f"Failed to get/create ChromaDB collection {self.collection_name}: {e}")
                raise e
        return self._collection

    def add_documents(self, chunks: List[Dict[str, Any]], embeddings: List[List[float]]) -> bool:
        """Add chunks and embeddings to ChromaDB."""
        if not chunks:
            return False
            
        ids = []
        metadatas = []
        documents = []
        
        for chunk in chunks:
            metadata = chunk["metadata"]
            doc_id = metadata["document_id"]
            chunk_idx = metadata["chunk_index"]
            
            # Create a unique ID for each chunk
            ids.append(f"{doc_id}_chunk_{chunk_idx}")
            metadatas.append(metadata)
            documents.append(chunk["text"])

        try:
            self.collection.upsert(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=documents
            )
            logger.info(f"Successfully added {len(chunks)} chunks to ChromaDB collection {self.collection_name}.")
            return True
        except Exception as e:
            logger.error(f"Error adding documents to ChromaDB: {e}")
            raise e

    def delete_document(self, document_id: str) -> bool:
        """Delete all chunks belonging to a document ID."""
        try:
            # Delete where document_id matches
            self.collection.delete(where={"document_id": document_id})
            logger.info(f"Successfully deleted document {document_id} from ChromaDB.")
            return True
        except Exception as e:
            logger.error(f"Error deleting document {document_id} from ChromaDB: {e}")
            raise e

    def query_similar(self, query_embedding: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        """Query ChromaDB for top_k similar chunks."""
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k
            )
            
            formatted_results = []
            if not results or not results["documents"] or not results["documents"][0]:
                return formatted_results

            documents = results["documents"][0]
            metadatas = results["metadatas"][0]
            distances = results["distances"][0]
            ids = results["ids"][0]

            for idx in range(len(documents)):
                # Chroma distance is cosine distance (1 - cosine_similarity)
                # Let's convert to similarity score: similarity = 1 - distance
                similarity_score = 1.0 - distances[idx]
                formatted_results.append({
                    "id": ids[idx],
                    "text": documents[idx],
                    "metadata": metadatas[idx],
                    "similarity": round(float(similarity_score), 4)
                })
            
            # Sort by similarity descending
            formatted_results.sort(key=lambda x: x["similarity"], reverse=True)
            return formatted_results
        except Exception as e:
            logger.error(f"Error querying ChromaDB: {e}")
            raise e
