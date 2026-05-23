import React from 'react';
import { 
  FileText, 
  Trash2, 
  Database, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Calendar,
  Layers
} from 'lucide-react';

export default function DocumentSidebar({ 
  documents, 
  onDelete, 
  loading, 
  healthStatus 
}) {
  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    return <FileText className={`file-icon icon-${ext}`} />;
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <aside className="document-sidebar">
      <div className="sidebar-header">
        <div className="brand-logo">
          <div className="logo-glow"></div>
          <span className="logo-emoji">🧠</span>
        </div>
        <div className="brand-text">
          <h1>DocuMind</h1>
          <p>AI Knowledge RAG</p>
        </div>
      </div>

      <div className="sidebar-section-title">
        <span>Knowledge Base</span>
        <span className="badge">{documents.length} Files</span>
      </div>

      <div className="document-list-container">
        {loading ? (
          <div className="sidebar-loader">
            <Loader2 className="animate-spin" />
            <p>Loading files...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="sidebar-empty">
            <p>No documents uploaded yet. Drag one in to begin!</p>
          </div>
        ) : (
          <div className="document-list">
            {documents.map((doc) => (
              <div key={doc.id} className="document-item">
                <div className="doc-meta-left">
                  {getFileIcon(doc.filename)}
                </div>
                <div className="doc-details">
                  <div className="doc-name" title={doc.filename}>
                    {doc.filename}
                  </div>
                  <div className="doc-meta-sub">
                    <span className="meta-item">
                      <Calendar className="sub-icon" />
                      {formatDate(doc.upload_date)}
                    </span>
                    <span className="meta-item">
                      <Layers className="sub-icon" />
                      {doc.chunk_count} chunks
                    </span>
                  </div>
                </div>
                <button 
                  className="delete-btn" 
                  onClick={() => onDelete(doc.id)}
                  title="Remove document"
                >
                  <Trash2 className="trash-icon" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="health-status">
          <div className="status-indicator">
            {healthStatus === 'healthy' ? (
              <div className="status-dot green"></div>
            ) : healthStatus === 'disconnected' ? (
              <div className="status-dot red"></div>
            ) : (
              <div className="status-dot amber animate-pulse"></div>
            )}
            <span className="status-text">
              Backend: {healthStatus || 'Connecting...'}
            </span>
          </div>
          <div className="db-info">
            <Database className="db-icon" />
            <span>SQLite & ChromaDB</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
