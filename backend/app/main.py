from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.database.session import engine, Base
from app.api.endpoints import router as api_router

# Initialize SQLite tables on startup
logger.info("Initializing SQLite database tables...")
try:
    Base.metadata.create_all(bind=engine)
    logger.info("SQLite database tables verified/created.")
except Exception as e:
    logger.critical(f"Failed to create database tables: {e}")

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production-grade Retrieval-Augmented Generation (RAG) backend API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Set CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production security if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include main router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "message": f"Welcome to the {settings.PROJECT_NAME} API. Access Swagger documentation at /docs",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
