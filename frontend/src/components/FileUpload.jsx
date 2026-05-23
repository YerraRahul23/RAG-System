import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function FileUpload({ onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState({ type: null, message: '' });
  const fileInputRef = useRef(null);

  const allowedExtensions = ['pdf', 'txt', 'docx', 'md', 'markdown'];

  const validateFile = (file) => {
    if (!file) return false;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setStatus({
        type: 'error',
        message: `Unsupported format. Allowed: ${allowedExtensions.join(', ')}`,
      });
      return false;
    }
    return true;
  };

  const handleUpload = async (file) => {
    if (!validateFile(file)) return;

    setUploading(true);
    setProgress(0);
    setStatus({ type: null, message: '' });

    try {
      await api.uploadDocument(file, (percent) => {
        setProgress(percent);
      });
      
      setStatus({
        type: 'success',
        message: `Successfully processed and indexed "${file.name}"!`,
      });
      setProgress(100);
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }

      // Reset success status after a delay
      setTimeout(() => {
        setStatus({ type: null, message: '' });
      }, 5000);
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail || 'An error occurred during indexing.';
      setStatus({
        type: 'error',
        message: detail,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="file-upload-container">
      <div 
        className={`dropzone ${dragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={!uploading ? triggerFileInput : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden-file-input"
          accept=".pdf,.txt,.docx,.md,.markdown"
          onChange={handleFileChange}
          disabled={uploading}
        />

        <div className="dropzone-content">
          {uploading ? (
            <div className="upload-progress-state">
              <Loader2 className="animate-spin upload-spinner" />
              <p className="upload-title">Ingesting document...</p>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <span className="progress-percentage">{progress}%</span>
              <p className="upload-subtitle">Parsing text, creating embeddings & indexing...</p>
            </div>
          ) : (
            <>
              <UploadCloud className="upload-cloud-icon" />
              <p className="upload-title">
                Drag & drop document or <span className="browse-link">browse</span>
              </p>
              <p className="upload-subtitle">
                Supports PDF, DOCX, TXT, or Markdown
              </p>
            </>
          )}
        </div>
      </div>

      {status.type && (
        <div className={`upload-status-alert alert-${status.type}`}>
          {status.type === 'success' ? (
            <CheckCircle2 className="alert-status-icon" />
          ) : (
            <AlertTriangle className="alert-status-icon" />
          )}
          <span className="status-message">{status.message}</span>
        </div>
      )}
    </div>
  );
}
