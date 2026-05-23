from typing import List, Dict, Any
from sqlalchemy.orm import Session
from openai import AsyncOpenAI
from app.core.config import settings
from app.core.logging import logger
from app.services.retrieval import RetrievalService
from app.models.database import ChatMessageModel

class RAGService:
    def __init__(self, retrieval_service: RetrievalService):
        self.retrieval_service = retrieval_service
        self.openai_client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL
        )

    async def generate_response(
        self, db: Session, query: str, session_id: str, top_k: int = 5
    ) -> Dict[str, Any]:
        """Retrieve context, compile history, query LLM, and persist chat message logs."""
        logger.info(f"RAG: Processing question for session: {session_id}")
        
        # 1. Retrieve relevant contexts
        relevant_chunks = self.retrieval_service.retrieve_context(query, top_k=top_k)
        
        # Extract source filenames and formats
        source_filenames = list(set([chunk["metadata"]["filename"] for chunk in relevant_chunks]))
        
        # 2. Build context string
        context_str = ""
        for i, chunk in enumerate(relevant_chunks):
            context_str += f"\nDocument [{i+1}]: {chunk['metadata']['filename']}\nContent: {chunk['text']}\n"
            
        system_prompt = (
            "You are a helpful, senior AI assistant designed to answer user queries using the provided text context.\n\n"
            "INSTRUCTIONS:\n"
            "1. Answer the user's question accurately using ONLY the provided Document Context segments.\n"
            "2. If the context does not contain enough information to answer the question, state that you do not have sufficient information in the documents. Do not hallucinate or make up answers.\n"
            "3. Be concise, clear, and direct. Refer to the sources/documents by name when referencing them.\n\n"
            f"DOCUMENT CONTEXT SECTIONS:\n{context_str}"
        )

        # 3. Retrieve past chat history from SQL database
        # Limit to the last 10 messages (5 exchanges) to manage context length
        history_messages = (
            db.query(ChatMessageModel)
            .filter(ChatMessageModel.session_id == session_id)
            .order_by(ChatMessageModel.timestamp.desc())
            .limit(10)
            .all()
        )
        # Reverse to get chronological order (oldest to newest)
        history_messages.reverse()

        # 4. Construct messages payload for OpenAI Chat Completion
        openai_messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Add past history
        for msg in history_messages:
            openai_messages.append({"role": msg.role, "content": msg.content})
            
        # Add current user prompt
        openai_messages.append({"role": "user", "content": query})

        # 5. Call OpenAI-compatible LLM
        answer = "No response generated."
        try:
            logger.info(f"RAG: Calling LLM API ({settings.OPENAI_MODEL})...")
            completion = await self.openai_client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=openai_messages,
                temperature=0.3
            )
            answer = completion.choices[0].message.content
            logger.info("RAG: LLM completed response generation.")
        except Exception as e:
            logger.error(f"RAG: Error calling LLM completion: {e}")
            answer = f"Error generating answer: {str(e)}"

        # 6. Save current interaction to SQLite
        try:
            user_msg = ChatMessageModel(
                session_id=session_id,
                role="user",
                content=query
            )
            assistant_msg = ChatMessageModel(
                session_id=session_id,
                role="assistant",
                content=answer
            )
            db.add(user_msg)
            db.add(assistant_msg)
            db.commit()
            logger.info("RAG: Saved interaction to SQL database history.")
        except Exception as db_err:
            logger.error(f"RAG: Failed to write history to DB: {db_err}")
            db.rollback()

        return {
            "answer": answer,
            "retrieved_chunks": relevant_chunks,
            "source_filenames": source_filenames
        }
