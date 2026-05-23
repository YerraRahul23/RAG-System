import React, { useState, useEffect, useCallback } from 'react';
import DocumentSidebar from '../components/DocumentSidebar';
import FileUpload from '../components/FileUpload';
import ChatInterface from '../components/ChatInterface';
import { api } from '../services/api';
import { Info, HelpCircle } from 'lucide-react';

// Simple UUID generator for browser environment
const generateUUID = () => {
  try {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
  } catch (e) {}
  
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function Home() {
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [healthStatus, setHealthStatus] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [errorAlert, setErrorAlert] = useState('');

  // Generate session ID on mount
  useEffect(() => {
    setSessionId(generateUUID());
  }, []);

  // Fetch documents from backend
  const fetchDocuments = useCallback(async () => {
    try {
      setLoadingDocs(true);
      const docs = await api.getDocuments();
      setDocuments(docs);
      setErrorAlert('');
    } catch (error) {
      console.error("Error fetching documents:", error);
      setErrorAlert("Failed to sync documents with backend server.");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  // Check backend health status
  const checkHealth = useCallback(async () => {
    try {
      const health = await api.getHealth();
      if (health.status === 'healthy') {
        setHealthStatus(health.chromadb === 'connected' ? 'healthy' : 'degraded');
      } else {
        setHealthStatus('disconnected');
      }
    } catch (error) {
      console.error("Health check failed:", error);
      setHealthStatus('disconnected');
    }
  }, []);

  // Initial loading and periodic health checks
  useEffect(() => {
    checkHealth();
    fetchDocuments();

    // Set up polling intervals
    const healthInterval = setInterval(checkHealth, 10000); // 10s health check
    const docsInterval = setInterval(fetchDocuments, 30000); // 30s list refresh

    return () => {
      clearInterval(healthInterval);
      clearInterval(docsInterval);
    };
  }, [checkHealth, fetchDocuments]);

  // Handle document deletion
  const handleDeleteDocument = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this document? All associated search indices will be purged.");
    if (!confirmDelete) return;

    try {
      await api.deleteDocument(id);
      fetchDocuments();
    } catch (error) {
      console.error("Failed to delete document:", error);
      alert(error.response?.data?.detail || "Failed to delete document.");
    }
  };

  // Reset chat session
  const handleResetSession = () => {
    setSessionId(generateUUID());
  };

  return (
    <div className="app-layout">
      {/* Sidebar with Documents */}
      <DocumentSidebar 
        documents={documents} 
        onDelete={handleDeleteDocument} 
        loading={loadingDocs} 
        healthStatus={healthStatus}
      />

      {/* Main Work Area */}
      <main className="main-viewport">
        {errorAlert && (
          <div className="global-error-bar">
            <span className="error-text">⚠️ {errorAlert}</span>
            <button onClick={fetchDocuments} className="retry-btn">Retry Sync</button>
          </div>
        )}

        <div className="workspace-container">
          {/* File Upload Zone */}
          <section className="upload-section">
            <div className="section-info">
              <h2>Add to Knowledge Base</h2>
              <p>Upload files to parse and store in your vector database.</p>
            </div>
            <FileUpload onUploadSuccess={fetchDocuments} />
          </section>

          {/* RAG Chat Engine */}
          <section className="chat-section">
            <ChatInterface 
              sessionId={sessionId} 
              onResetSession={handleResetSession} 
              documents={documents}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
