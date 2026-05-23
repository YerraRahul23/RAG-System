from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database.session import get_db
from app.models.database import DocumentModel, ChatMessageModel
from app.services.document_processor import DocumentProcessor
from app.services.embedding import EmbeddingService
from app.services.vector_store import VectorStoreService
from app.services.retrieval import RetrievalService
from app.services.rag import RAGService
from app.core.logging import logger

router = APIRouter()

# Singletons initialized on module import
document_processor = DocumentProcessor()
embedding_service = EmbeddingService()
vector_store_service = VectorStoreService()
retrieval_service = RetrievalService(embedding_service, vector_store_service)
rag_service = RAGService(retrieval_service)

# Pydantic Schemas
class DocumentResponse(BaseModel):
    id: str
    filename: str
    upload_date: datetime
    chunk_count: int

    class Config:
        from_attributes = True

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

class SearchResultChunk(BaseModel):
    id: str
    text: str
    metadata: Dict[str, Any]
    similarity: float

class ChatRequest(BaseModel):
    query: str
    session_id: str
    top_k: int = 5

class ChatResponse(BaseModel):
    answer: str
    retrieved_chunks: List[SearchResultChunk]
    source_filenames: List[str]

class HealthResponse(BaseModel):
    status: str
    chromadb: str
    embedding_model: str

# Endpoints
@router.get("/health", response_model=HealthResponse)
def health_check():
    """Verify system health and vector store connection status."""
    chroma_status = "connected"
    try:
        # Ping ChromaDB
        vector_store_service.client.heartbeat()
    except Exception as e:
        logger.error(f"Health check: ChromaDB connection error: {e}")
        chroma_status = "disconnected"

    return HealthResponse(
        status="healthy",
        chromadb=chroma_status,
        embedding_model="all-MiniLM-L6-v2"
    )

@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    """Retrieve metadata of all uploaded documents."""
    docs = db.query(DocumentModel).order_by(DocumentModel.upload_date.desc()).all()
    return docs

@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a document, extract text, chunk, embed, and store in vector database."""
    # 1. Validate file extension
    filename = file.filename
    allowed_extensions = {"pdf", "txt", "docx", "md", "markdown"}
    ext = filename.split(".")[-1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(allowed_extensions)}"
        )

    # 2. Read contents and check for duplicate using hash
    try:
        contents = await file.read()
    except Exception as e:
        logger.error(f"Failed to read upload file {filename}: {e}")
        raise HTTPException(status_code=500, detail="Could not read uploaded file.")

    file_hash = document_processor.compute_hash(contents)
    existing_doc = db.query(DocumentModel).filter(DocumentModel.file_hash == file_hash).first()
    if existing_doc:
        raise HTTPException(
            status_code=400,
            detail=f"Document already exists: '{filename}' (identical content already uploaded)."
        )

    # 3. Extract text
    try:
        extracted_text = document_processor.extract_text(contents, filename)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as parse_err:
        logger.error(f"Parsing error: {parse_err}")
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {str(parse_err)}")

    # 4. Generate metadata & document ID
    doc_model = DocumentModel(
        filename=filename,
        file_hash=file_hash,
        chunk_count=0
    )
    db.add(doc_model)
    db.flush()  # Gen ID

    # 5. Chunk text
    try:
        chunks = document_processor.split_text(extracted_text, doc_model.id, filename)
    except Exception as split_err:
        logger.error(f"Text splitting error: {split_err}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to partition document text.")

    if not chunks:
        db.rollback()
        raise HTTPException(status_code=400, detail="Document contains no chunkable text content.")

    # 6. Generate embeddings
    try:
        chunk_texts = [chunk["text"] for chunk in chunks]
        embeddings = embedding_service.get_embeddings(chunk_texts)
    except Exception as embed_err:
        logger.error(f"Embedding error: {embed_err}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to generate document embeddings.")

    # 7. Write chunks to Vector DB
    try:
        vector_store_service.add_documents(chunks, embeddings)
    except Exception as chroma_err:
        logger.error(f"ChromaDB write error: {chroma_err}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to store document in ChromaDB.")

    # 8. Update DB metadata
    doc_model.chunk_count = len(chunks)
    db.commit()
    db.refresh(doc_model)
    
    logger.info(f"Document '{filename}' successfully uploaded and chunked into {len(chunks)} pieces.")
    return doc_model

@router.delete("/documents/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    """Delete a document from metadata database and remove its vector chunks from ChromaDB."""
    doc = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        # Delete from ChromaDB
        vector_store_service.delete_document(document_id)
    except Exception as chroma_err:
        logger.error(f"ChromaDB deletion error: {chroma_err}")
        raise HTTPException(status_code=500, detail="Failed to delete chunks from ChromaDB.")

    try:
        # Delete from SQLite
        db.delete(doc)
        db.commit()
    except Exception as db_err:
        logger.error(f"SQLite deletion error: {db_err}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete document metadata.")

    return {"message": f"Successfully deleted document '{doc.filename}'."}

@router.post("/search", response_model=List[SearchResultChunk])
def search_documents(request: SearchRequest):
    """Retrieve top-k document chunks relevant to the user query."""
    try:
        results = retrieval_service.retrieve_context(request.query, top_k=request.top_k)
        return results
    except Exception as e:
        logger.error(f"Search endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@router.post("/chat", response_model=ChatResponse)
async def chat_interaction(request: ChatRequest, db: Session = Depends(get_db)):
    """Perform RAG search, query LLM with context/history, and return answer and sources."""
    try:
        response = await rag_service.generate_response(
            db=db,
            query=request.query,
            session_id=request.session_id,
            top_k=request.top_k
        )
        return response
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {str(e)}")
