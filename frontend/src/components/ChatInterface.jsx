import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Send, 
  Bot, 
  User, 
  Loader, 
  RefreshCw, 
  Sliders, 
  ChevronDown, 
  ChevronRight,
  BookOpen,
  Info
} from 'lucide-react';
import { api } from '../services/api';

export default function ChatInterface({ sessionId, onResetSession, documents }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [topK, setTopK] = useState(5);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState({}); // messageIndex -> boolean
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const samplePrompts = [
    "What are the main concepts covered in the uploaded documents?",
    "Can you compile a high-level summary of the files?",
    "Find any specific figures, dates, or key definitions in the text.",
    "Explain the relationship between the main topics discussed."
  ];

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSend = async (e, textToSend = '') => {
    if (e) e.preventDefault();
    const finalQuery = textToSend || input;
    if (!finalQuery.trim() || loading) return;

    // Append user message
    const userMessage = {
      role: 'user',
      content: finalQuery,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.chat(finalQuery, sessionId, topK);
      
      const assistantMessage = {
        role: 'assistant',
        content: response.answer,
        retrievedChunks: response.retrieved_chunks || [],
        sourceFilenames: response.source_filenames || [],
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail || 'Failed to generate a response from the AI.';
      setMessages(prev => [
        ...prev, 
        {
          role: 'assistant',
          content: `⚠️ **Error**: ${detail}. Please check backend logs and LLM API credentials.`,
          timestamp: new Date().toISOString(),
          isError: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleCitations = (index) => {
    setExpandedCitations(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-interface-container">
      {/* Top Header Bar */}
      <header className="chat-header">
        <div className="header-info">
          <h2>RAG Discussion Hub</h2>
          <span className="session-pill">Session: {sessionId.substring(0, 8)}...</span>
        </div>

        <div className="header-actions">
          <button 
            className={`action-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Search Settings"
          >
            <Sliders className="action-icon" />
            <span>Config</span>
          </button>
          
          <button 
            className="action-btn reset-btn"
            onClick={() => {
              setMessages([]);
              onResetSession();
            }}
            title="Clear Chat Session"
          >
            <RefreshCw className="action-icon" />
            <span>New Chat</span>
          </button>
        </div>
      </header>

      {/* Slide-out or Toggleable Settings Drawer */}
      {showSettings && (
        <div className="chat-settings-drawer">
          <div className="settings-field">
            <div className="settings-label-row">
              <label htmlFor="top-k-slider">Context Retrieval Limit (Top-K Chunks)</label>
              <span className="settings-value">{topK} chunks</span>
            </div>
            <input 
              id="top-k-slider"
              type="range" 
              min="1" 
              max="15" 
              value={topK} 
              onChange={(e) => setTopK(parseInt(e.target.value))}
              className="settings-slider"
            />
            <p className="settings-help">
              Determines how many matching text fragments from your documents are fed to the LLM model.
            </p>
          </div>
        </div>
      )}

      {/* Main Messages Area */}
      <div className="messages-viewport">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="hero-sphere"></div>
            <h1 className="hero-title">Ask your Knowledge Base</h1>
            <p className="hero-subtitle">
              Upload documents in the sidebar, and I will search their semantic contents, assemble contexts, and synthesize answers.
            </p>

            {documents.length === 0 && (
              <div className="warning-card">
                <Info className="warning-icon" />
                <p>You haven't uploaded any documents yet. Upload a PDF, TXT, DOCX, or Markdown file first to run document-guided chat.</p>
              </div>
            )}

            <div className="sample-prompts-grid">
              {samplePrompts.map((prompt, idx) => (
                <button 
                  key={idx} 
                  className="sample-prompt-card"
                  onClick={() => handleSend(null, prompt)}
                  disabled={documents.length === 0}
                >
                  <span className="prompt-text">"{prompt}"</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="message-list">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`message-row ${msg.role === 'user' ? 'row-user' : 'row-assistant'}`}
              >
                <div className="avatar-wrapper">
                  {msg.role === 'user' ? (
                    <div className="avatar user-avatar"><User size={16} /></div>
                  ) : (
                    <div className="avatar bot-avatar"><Bot size={16} /></div>
                  )}
                </div>

                <div className="message-bubble-wrapper">
                  <div className="message-bubble">
                    <div className="message-content">
                      {msg.role === 'user' ? (
                        <p>{msg.content}</p>
                      ) : (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({node, ...props}) => <div className="table-responsive"><table className="markdown-table" {...props} /></div>,
                            pre: ({node, ...props}) => <pre className="markdown-pre" {...props} />,
                            code: ({node, ...props}) => <code className="markdown-code" {...props} />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                  </div>

                  {/* Render citations for assistant messages */}
                  {msg.role === 'assistant' && msg.sourceFilenames && msg.sourceFilenames.length > 0 && (
                    <div className="citations-container">
                      <div 
                        className="citations-header"
                        onClick={() => toggleCitations(index)}
                      >
                        <BookOpen size={14} className="citations-icon" />
                        <span>Sources cited ({msg.sourceFilenames.length})</span>
                        {expandedCitations[index] ? (
                          <ChevronDown size={14} className="chevron" />
                        ) : (
                          <ChevronRight size={14} className="chevron" />
                        )}
                      </div>

                      {expandedCitations[index] && (
                        <div className="citations-body">
                          {/* File list pills */}
                          <div className="source-pills-row">
                            {msg.sourceFilenames.map((fname, fidx) => (
                              <span key={fidx} className="source-pill">
                                {fname}
                              </span>
                            ))}
                          </div>

                          {/* Matching chunks with scores */}
                          <div className="matching-chunks-list">
                            {msg.retrievedChunks.map((chunk, cidx) => (
                              <div key={cidx} className="chunk-card">
                                <div className="chunk-card-header">
                                  <span className="chunk-source-name">{chunk.metadata.filename} (Chunk #{chunk.metadata.chunk_index})</span>
                                  <span className="chunk-score">
                                    {(chunk.similarity * 100).toFixed(1)}% match
                                  </span>
                                </div>
                                <div className="chunk-card-text">
                                  "{chunk.text}"
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="message-row row-assistant">
                <div className="avatar-wrapper">
                  <div className="avatar bot-avatar"><Bot size={16} /></div>
                </div>
                <div className="message-bubble-wrapper">
                  <div className="message-bubble loading-bubble">
                    <Loader className="animate-spin loader-icon" />
                    <span>Searching vectors and synthesizing reply...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Input Area */}
      <footer className="chat-footer-input">
        <form onSubmit={handleSend} className="input-form">
          <div className="input-field-wrapper">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Submit on Enter, insert newline on Shift+Enter
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={documents.length === 0 ? "Upload documents first to start chatting..." : "Ask a question about the indexed knowledge..."}
              disabled={documents.length === 0 || loading}
              className="chat-textarea"
            />
            <button 
              type="submit" 
              disabled={!input.trim() || loading || documents.length === 0}
              className="send-button"
              title="Send Message"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
        <div className="footer-credits">
          Contextual RAG Assistant using SQLite + ChromaDB
        </div>
      </footer>
    </div>
  );
}
