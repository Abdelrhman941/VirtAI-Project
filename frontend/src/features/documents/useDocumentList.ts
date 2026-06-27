import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { documentApi } from './documentApi';
import { Document, RAGStage } from './types';

export function useDocumentList(sessionId: string | null = null) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadQueue, setUploadQueue] = useState<{ file: File, tempId: string, fileHash: string }[]>([]);
  const [activeUploads, setActiveUploads] = useState<number>(0);

  const consecutiveFailures = useRef(0);
  const isPolling = useRef(false);
  const uploadAbortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const addOptimisticDocument = useCallback((file: File, temp_id: string) => {
    setDocuments(prev => {
      if (prev.some(d => d.temp_id === temp_id)) return prev;
      const optimisticDoc: Document = {
        temp_id,
        filename: file.name,
        upload_date: new Date().toISOString(),
        status: 'PENDING',
        current_stage: 'QUEUED',
        progress_pct: 0,
      };
      return [optimisticDoc, ...prev];
    });
  }, []);

  const removeOptimisticDocument = useCallback((temp_id: string) => {
    setDocuments(prev => prev.filter(doc => doc.temp_id !== temp_id));
  }, []);

  const replaceOptimisticDocument = useCallback((temp_id: string, real_id: string, newStage: RAGStage = 'QUEUED') => {
    setDocuments(prev => prev.map(doc =>
      doc.temp_id === temp_id
        ? { ...doc, id: real_id, temp_id: undefined, current_stage: newStage }
        : doc
    ));
  }, []);

  const fetchDocuments = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await documentApi.list(sessionId);
      
      if (signal?.aborted) return;

      setDocuments(prev => {
        // Preserve optimistic documents that don't have an ID yet
        const optimisticDocs = prev.filter(doc => doc.temp_id !== undefined);
        return [...optimisticDocs, ...data];
      });
      setError(null);
    } catch (err: unknown) {
      if (signal?.aborted) return;
      setError(isAxiosError(err) ? err.response?.data?.detail || 'Failed to fetch documents' : 'Failed to fetch documents');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const pollActive = async () => {
      if (!isPolling.current) return;

      try {
        const activeDocs = await documentApi.listActive(sessionId);
        consecutiveFailures.current = 0;
        let needsFullRefresh = false;

        setDocuments(prev => {
          const newDocs = [...prev];
          let changed = false;
          const serverActiveIds = new Set(activeDocs.map(d => d.id));

          activeDocs.forEach(activeDoc => {
            const index = newDocs.findIndex(d => d.id === activeDoc.id);
            if (index !== -1) {
              if (
                newDocs[index].current_stage !== activeDoc.current_stage ||
                newDocs[index].progress_pct !== activeDoc.progress_pct ||
                newDocs[index].status !== activeDoc.status ||
                newDocs[index].chunks_processed !== activeDoc.chunks_processed
              ) {
                newDocs[index] = { ...newDocs[index], ...activeDoc };
                changed = true;
              }
            } else {
              newDocs.push(activeDoc);
              changed = true;
            }
          });

          // If a document was active but is no longer in the listActive response, it likely completed or failed.
          prev.forEach(doc => {
            if (doc.id && !['COMPLETE', 'FAILED', 'CANCELLED'].includes(doc.current_stage)) {
              if (!serverActiveIds.has(doc.id)) {
                needsFullRefresh = true;
              }
            }
          });

          return changed ? newDocs : prev;
        });

        if (needsFullRefresh) {
          await fetchDocuments();
        }

        if (isPolling.current) {
          timeoutId = setTimeout(pollActive, 5000);
        }

      } catch {
        consecutiveFailures.current++;
        const maxDelay = 20000;
        const baseDelay = 5000;
        const retryDelay = Math.min(baseDelay * Math.pow(2, consecutiveFailures.current), maxDelay);

        if (isPolling.current) {
          timeoutId = setTimeout(pollActive, retryDelay);
        }
      }
    };

    isPolling.current = true;
    pollActive();

    return () => {
      isPolling.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchDocuments, sessionId]);

  // Clear upload queue and abort active uploads implicitly when session changes
  useEffect(() => {
    setUploadQueue([]);
    
    // Abort all active uploads to prevent them from completing in the background
    uploadAbortControllersRef.current.forEach(controller => controller.abort());
    uploadAbortControllersRef.current.clear();
  }, [sessionId]);

  useEffect(() => {
    const processQueue = async () => {
      if (uploadQueue.length === 0 || activeUploads >= 3) {
        return;
      }

      const nextItem = uploadQueue[0];
      setUploadQueue(prev => prev.slice(1));
      setActiveUploads(prev => prev + 1);

      const abortController = new AbortController();
      uploadAbortControllersRef.current.set(nextItem.tempId, abortController);
      const timeoutId = setTimeout(() => abortController.abort(), 60000);

      try {
        setDocuments(prev => prev.map(doc =>
          doc.temp_id === nextItem.tempId
            ? { ...doc, current_stage: 'UPLOADING' }
            : doc
        ));

        const response = await documentApi.upload(nextItem.file, sessionId, abortController.signal, nextItem.fileHash);

        replaceOptimisticDocument(nextItem.tempId, response.id, response.current_stage);
      } catch (err: unknown) {
        removeOptimisticDocument(nextItem.tempId);

        if (isAxiosError(err) && (err.response?.status === 400 || err.response?.status === 403)) {
          setError('Session document limit (10) reached or upload forbidden.');
        } else if (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) {
          setError(`Upload cancelled for ${nextItem.file.name}`);
        } else {
          setError(isAxiosError(err) ? err.response?.data?.detail || `Failed to upload ${nextItem.file.name}` : `Failed to upload ${nextItem.file.name}`);
        }
      } finally {
        clearTimeout(timeoutId);
        uploadAbortControllersRef.current.delete(nextItem.tempId);
        setActiveUploads(prev => prev - 1);
      }
    };

    processQueue();
  }, [uploadQueue, activeUploads, sessionId, removeOptimisticDocument, replaceOptimisticDocument]);

  const enqueueUpload = useCallback((file: File, tempId: string, fileHash: string) => {
    addOptimisticDocument(file, tempId);
    setUploadQueue(prev => [...prev, { file, tempId, fileHash }]);
  }, [addOptimisticDocument]);

  const deleteDocument = useCallback(async (id: string) => {
    try {
      await documentApi.delete(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      setError(null);
    } catch (err: unknown) {
      throw new Error(isAxiosError(err) ? err.response?.data?.detail || 'Failed to delete document' : 'Failed to delete document');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchDocuments(controller.signal);
    return () => controller.abort();
  }, [fetchDocuments]);

  return {
    documents,
    isLoading,
    error,
    refresh: fetchDocuments,
    deleteDocument,
    enqueueUpload,
    uploadQueueLength: uploadQueue.length,
    activeUploads,
    clearError: () => setError(null)
  };
}
