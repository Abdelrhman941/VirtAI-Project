import api from '@/core/api/apiClient';
import { Document, UploadResponse } from './types';

export const documentApi = {
  /**
   * Upload a document for ingestion
   * Returns 202 Accepted with a document ID
   */
  upload: async (file: File, sessionId: string | null = null, signal?: AbortSignal, fileHash?: string): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }
    if (fileHash) {
      formData.append('file_hash', fileHash);
    }

    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal, // Attach AbortSignal for timeout cancellation
    });
    return response.data;
  },

  /**
   * Get the status of all documents
   */
  list: async (sessionId: string | null = null): Promise<Document[]> => {
    let url = `/documents/?t=${Date.now()}`;
    if (sessionId) {
      url += `&session_id=${sessionId}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  /**
   * Get the status of all active documents (processing, queued, etc)
   */
  listActive: async (sessionId: string | null = null): Promise<Document[]> => {
    let url = '/documents/status?active_only=true';
    if (sessionId) {
      url += `&session_id=${sessionId}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  /**
   * Get the detailed status of a specific document
   */
  getStatus: async (documentId: string): Promise<Document> => {
    const response = await api.get(`/documents/${documentId}/status`);
    return response.data;
  },

  /**
   * Cancel an ongoing document ingestion
   */
  cancel: async (documentId: string): Promise<any> => {
    const response = await api.post(`/documents/${documentId}/cancel`);
    return response.data;
  },

  /**
   * Delete a document completely
   */
  delete: async (documentId: string): Promise<any> => {
    const response = await api.delete(`/documents/${documentId}`);
    return response.data;
  },
};
