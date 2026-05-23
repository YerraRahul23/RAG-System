import os
from pydantic import Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "RAG System"
    API_V1_STR: str = ""
    
    # Database
    DATABASE_URL: str = Field(default="sqlite:///./rag.db")
    
    # ChromaDB
    CHROMA_HOST: str = Field(default="chromadb")
    CHROMA_PORT: int = Field(default=8000)
    CHROMA_COLLECTION: str = Field(default="rag_documents")
    
    # LLM Settings (OpenAI-compatible)
    OPENAI_API_KEY: str = Field(default="sk-placeholder")
    OPENAI_BASE_URL: str = Field(default="https://api.openai.com/v1")
    OPENAI_MODEL: str = Field(default="gpt-4o-mini")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()
