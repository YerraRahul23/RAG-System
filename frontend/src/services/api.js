import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  /**
   * Check connection and system status
   */
  async getHealth() {
    const response = await apiClient.get('/health');
    return response.data;
  },

  /**
   * Fetch all uploaded documents metadata
   */
  async getDocuments() {
    const response = await apiClient.get('/documents');
    return response.data;
  },

  /**
   * Upload a file with progress tracking
   * @param {File} file - The file to upload
   * @param {Function} onProgress - Callback for progress updates
   */
  async uploadDocument(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    return response.data;
  },

  /**
   * Delete a document by ID
   */
  async deleteDocument(documentId) {
    const response = await apiClient.delete(`/documents/${documentId}`);
    return response.data;
  },

  /**
   * Search for top-k document chunks matching a query
   */
  async search(query, topK = 5) {
    const response = await apiClient.post('/search', { query, top_k: topK });
    return response.data;
  },

  /**
   * Send a query to the chat engine with session tracking
   */
  async chat(query, sessionId, topK = 5) {
    const response = await apiClient.post('/chat', {
      query,
      session_id: sessionId,
      top_k: topK,
    });
    return response.data;
  },
};
