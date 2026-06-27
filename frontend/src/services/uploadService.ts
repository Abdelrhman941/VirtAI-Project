import { documentApi } from '@/features/documents/documentApi';
import wsManager from '@/services/wsManager';
import { Document } from '@/features/documents/types';
import { isAxiosError } from 'axios';

export interface UploadQueueItem {
  file: File;
  tempId: string;
  fileHash: string;
}

export type UploadServiceState = {
  documents: Document[];
  uploadQueue: UploadQueueItem[];
  activeUploads: number;
  isLoading: boolean;
  error: string | null;
};

type Listener = (state: UploadServiceState) => void;

export class UploadService {
  private state: UploadServiceState = {
    documents: [],
    uploadQueue: [],
    activeUploads: 0,
    isLoading: true,
    error: null,
  };
  
  private listeners: Set<Listener> = new Set();
  private uploadAbortControllers: Map<string, AbortController> = new Map();
  private wsPatchTimes: Map<string, number> = new Map();
  private pendingDocUpdates: Map<string, any> = new Map();
  private docStatusTimer: ReturnType<typeof setTimeout> | null = null;
  private isFetching = false;
  private currentSessionId: string | null = null;
  private unsubDocStatus?: () => void;
  private unsubReady?: () => void;

  constructor() {
    this.unsubDocStatus = wsManager.on('doc_status', (activeDoc: any) => {
      this.pendingDocUpdates.set(activeDoc.document_id, activeDoc);
      
      if (this.docStatusTimer) {
        clearTimeout(this.docStatusTimer);
      }
      
      this.docStatusTimer = setTimeout(() => {
        this.docStatusTimer = null;
        let changed = false;
        let needsFetch = false;
        
        let newDocs = this.state.documents;
        
        this.pendingDocUpdates.forEach((doc, docId) => {
          this.wsPatchTimes.set(docId, Date.now());
          
          let found = false;
          newDocs = newDocs.map(d => {
            if (d.id === docId) {
              found = true;
              if (
                d.current_stage !== doc.current_stage ||
                d.progress_pct !== doc.progress_pct ||
                d.status !== doc.status ||
                d.chunks_processed !== doc.processed_chunks
              ) {
                changed = true;
                return {
                  ...d,
                  ...doc,
                  id: docId,
                  chunks_processed: doc.processed_chunks
                };
              }
            }
            return d;
          });
          
          if (!found) {
            needsFetch = true;
          }
        });
        
        this.pendingDocUpdates.clear();
        
        if (changed) {
          this.setState({ documents: newDocs });
        }
        
        if (needsFetch) {
          this.fetchDocuments();
        }
      }, 50);
    });

    this.unsubReady = wsManager.on('ready', () => {
      this.fetchDocuments();
    });
  }

  public initSession(sessionId: string | null) {
    if (this.currentSessionId !== sessionId) {
      this.currentSessionId = sessionId;
      this.cancelAllUploads();
      this.setState({ uploadQueue: [], documents: [], isLoading: true });
      this.fetchDocuments();
    }
  }

  public getState(): UploadServiceState {
    return this.state;
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private setState(partial: Partial<UploadServiceState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(l => l(this.state));
  }

  public clearError() {
    this.setState({ error: null });
  }

  public async fetchDocuments() {
    if (this.isFetching) return;
    this.isFetching = true;
    const fetchStartTime = Date.now();
    try {
      const data = await documentApi.list(this.currentSessionId);
      
      const newDocs = data.map(fetchedDoc => {
        const existingLocal = this.state.documents.find(d => d.id === fetchedDoc.id);
        if (existingLocal) {
          const lastWsPatch = this.wsPatchTimes.get(fetchedDoc.id) || 0;
          if (lastWsPatch > fetchStartTime) {
            return existingLocal;
          }
        }
        return fetchedDoc;
      });

      const optimisticDocs = this.state.documents.filter(doc => doc.temp_id !== undefined);
      this.setState({ documents: [...optimisticDocs, ...newDocs], error: null, isLoading: false });
    } catch (err: unknown) {
      this.setState({ error: isAxiosError(err) ? err.response?.data?.detail || 'Failed to fetch documents' : 'Failed to fetch documents', isLoading: false });
    } finally {
      this.isFetching = false;
    }
  }

  public enqueueUpload(file: File, tempId: string, fileHash: string, confirmedDuplicate = false): { isDuplicate: boolean } | void {
    const isDuplicate = this.state.documents.some(
      doc => doc.filename === file.name && doc.file_size === file.size
    );

    if (isDuplicate && !confirmedDuplicate) {
      return { isDuplicate: true };
    }

    // INTENTIONAL OPTIMISTIC UPDATE: 
    // We instantly add a 'QUEUED' document to the state here to provide immediate 
    // UX feedback in the DocumentsPanel while the actual file upload occurs in the background.
    const optimisticDoc: Document = {
      temp_id: tempId,
      filename: file.name,
      upload_date: new Date().toISOString(),
      status: 'PENDING',
      current_stage: 'QUEUED',
      progress_pct: 0,
      file_size: file.size,
    };

    this.setState({
      documents: [optimisticDoc, ...this.state.documents],
      uploadQueue: [...this.state.uploadQueue, { file, tempId, fileHash }]
    });

    this.processQueue();
  }

  private async processQueue() {
    if (this.state.uploadQueue.length === 0 || this.state.activeUploads >= 3) {
      return;
    }

    const nextItem = this.state.uploadQueue[0];
    this.setState({
      uploadQueue: this.state.uploadQueue.slice(1),
      activeUploads: this.state.activeUploads + 1
    });

    const abortController = new AbortController();
    this.uploadAbortControllers.set(nextItem.tempId, abortController);
    const timeoutId = setTimeout(() => abortController.abort(), 60000);

    this.setState({
      documents: this.state.documents.map(doc =>
        doc.temp_id === nextItem.tempId ? { ...doc, current_stage: 'UPLOADING' } : doc
      )
    });

    try {
      const response = await documentApi.upload(nextItem.file, this.currentSessionId, abortController.signal, nextItem.fileHash);
      
      this.setState({
        documents: this.state.documents.map(doc =>
          doc.temp_id === nextItem.tempId
            ? { ...doc, id: response.id, temp_id: undefined, current_stage: response.current_stage }
            : doc
        )
      });
    } catch (err: unknown) {
      this.setState({
        documents: this.state.documents.filter(doc => doc.temp_id !== nextItem.tempId)
      });
      
      if (isAxiosError(err) && (err.response?.status === 400 || err.response?.status === 403)) {
        this.setState({ error: 'Session document limit (10) reached or upload forbidden.' });
      } else if (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) {
        this.setState({ error: `Upload cancelled for ${nextItem.file.name}` });
      } else {
        this.setState({ error: isAxiosError(err) ? err.response?.data?.detail || `Failed to upload ${nextItem.file.name}` : `Failed to upload ${nextItem.file.name}` });
      }
    } finally {
      clearTimeout(timeoutId);
      this.uploadAbortControllers.delete(nextItem.tempId);
      this.setState({ activeUploads: this.state.activeUploads - 1 });
      this.processQueue();
    }
  }

  public cancelUpload(tempId: string) {
    const controller = this.uploadAbortControllers.get(tempId);
    if (controller) {
      controller.abort();
    } else {
      this.setState({
        uploadQueue: this.state.uploadQueue.filter(item => item.tempId !== tempId),
        documents: this.state.documents.filter(doc => doc.temp_id !== tempId)
      });
    }
  }

  private cancelAllUploads() {
    this.uploadAbortControllers.forEach(controller => controller.abort());
    this.uploadAbortControllers.clear();
  }

  public deleteDocument = async (id: string) => {
    try {
      await documentApi.delete(id);
      this.setState({
        documents: this.state.documents.filter((doc) => doc.id !== id),
        error: null
      });
    } catch (err: unknown) {
      throw new Error(isAxiosError(err) ? err.response?.data?.detail || 'Failed to delete document' : 'Failed to delete document');
    }
  }

  public destroy() {
    if (this.docStatusTimer) clearTimeout(this.docStatusTimer);
    if (this.unsubDocStatus) this.unsubDocStatus();
    if (this.unsubReady) this.unsubReady();
    this.cancelAllUploads();
    this.listeners.clear();
  }
}
