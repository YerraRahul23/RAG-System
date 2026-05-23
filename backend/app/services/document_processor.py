import io
import hashlib
from typing import List, Dict, Any
from pypdf import PdfReader
import docx
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.core.logging import logger

class DocumentProcessor:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            is_separator_regex=False
        )

    @staticmethod
    def compute_hash(content: bytes) -> str:
        """Compute SHA-256 hash of file content to prevent duplicates."""
        return hashlib.sha256(content).hexdigest()

    def extract_text(self, file_content: bytes, filename: str) -> str:
        """Extract text from supported file types (PDF, DOCX, TXT, MD)."""
        ext = filename.split(".")[-1].lower()
        text = ""

        if ext == "pdf":
            try:
                pdf_file = io.BytesIO(file_content)
                reader = PdfReader(pdf_file)
                pages_text = []
                for i, page in enumerate(reader.pages):
                    page_text = page.extract_text()
                    if page_text:
                        pages_text.append(page_text)
                text = "\n\n".join(pages_text)
            except Exception as e:
                logger.error(f"Error parsing PDF file {filename}: {e}")
                raise ValueError(f"Failed to parse PDF: {str(e)}")

        elif ext in ("docx", "doc"):
            try:
                docx_file = io.BytesIO(file_content)
                doc = docx.Document(docx_file)
                text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            except Exception as e:
                logger.error(f"Error parsing DOCX file {filename}: {e}")
                raise ValueError(f"Failed to parse DOCX: {str(e)}")

        elif ext in ("txt", "md", "markdown"):
            try:
                text = file_content.decode("utf-8", errors="replace")
            except Exception as e:
                logger.error(f"Error parsing text file {filename}: {e}")
                raise ValueError(f"Failed to parse text file: {str(e)}")

        else:
            raise ValueError(f"Unsupported file format: {ext}")

        if not text.strip():
            raise ValueError("No text could be extracted from the document.")

        return text

    def split_text(self, text: str, document_id: str, filename: str) -> List[Dict[str, Any]]:
        """Split text into chunks and return with metadata."""
        chunks = self.text_splitter.split_text(text)
        
        chunk_dicts = []
        for index, chunk_text in enumerate(chunks):
            chunk_dicts.append({
                "text": chunk_text,
                "metadata": {
                    "document_id": document_id,
                    "filename": filename,
                    "chunk_index": index
                }
            })
        return chunk_dicts
