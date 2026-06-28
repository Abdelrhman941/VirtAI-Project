import { useEffect, useMemo, useState } from 'react';
import { UploadService } from '../../services/uploadService';

const globalUploadService = new UploadService();

export function useDocumentList(sessionId: string | null = null) {
  const uploadService = globalUploadService;
  const [state, setState] = useState(uploadService.getState());

  useEffect(() => {
    uploadService.initSession(sessionId);
    const unsub = uploadService.subscribe(setState);
    
    return () => {
      unsub();
    };
  }, [sessionId, uploadService]);

  return {
    documents: state.documents,
    isLoading: state.isLoading,
    error: state.error,
    refresh: () => uploadService.fetchDocuments(),
    deleteDocument: (id: string) => uploadService.deleteDocument(id),
    enqueueUpload: (file: File, tempId: string, fileHash: string, confirmedDuplicate = false) => uploadService.enqueueUpload(file, tempId, fileHash, confirmedDuplicate),
    cancelUpload: (tempId: string) => uploadService.cancelUpload(tempId),
    uploadQueueLength: state.uploadQueue.length,
    activeUploads: state.activeUploads,
    clearError: () => uploadService.clearError()
  };
}
