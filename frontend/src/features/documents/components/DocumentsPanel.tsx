import { useState } from 'react';
import { FiCheckCircle, FiClock, FiFileText, FiLoader, FiTrash2, FiXCircle } from 'react-icons/fi';
import { useDocumentList } from '../useDocumentList';
import { DangerAlert } from '@/shared/components/ui/alert-variants';
import { UploadTab } from './UploadTab';
import { formatDateOnly } from '@/shared/utils/date';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';


interface DocumentsPanelProps {
  sessionId?: string | null;
  onEnsureSession?: () => Promise<string | null>;
  onClose?: () => void;
}

export function DocumentsPanel({ sessionId = null, onEnsureSession, onClose }: DocumentsPanelProps) {
  const {
    documents,
    isLoading,
    error,
    deleteDocument,
    refresh,
    enqueueUpload,
    uploadQueueLength,
    activeUploads,
    clearError
  } = useDocumentList(sessionId, onEnsureSession);

  const [docToDelete, setDocToDelete] = useState<{ id: string; filename: string } | null>(null);

  const getStatusIcon = (stage: string | undefined) => {
    if (stage === 'COMPLETE') return <FiCheckCircle className="text-green-500 shrink-0" />;
    if (stage === 'FAILED' || stage === 'CANCELLED') return <FiXCircle className="text-red-500 shrink-0" />;
    if (stage === 'QUEUED') return <FiClock className="text-amber-500 shrink-0" />;
    return <FiLoader className="text-primary animate-spin shrink-0" />;
  };

  const getStatusText = (stage: string | undefined, progress_pct: number, chunks_processed?: number, total_chunks?: number) => {
    if (stage === 'COMPLETE') return 'Curricular Resource Active';
    if (stage === 'FAILED') return 'Analysis Failed (Delete and Retry)';
    if (stage === 'CANCELLED') return 'Cancelled';
    if (stage === 'QUEUED') return 'Awaiting Analysis...';

    let text = `${stage || 'Analyzing'} (${Math.round(progress_pct || 0)}%)`;
    if (chunks_processed !== undefined && total_chunks !== undefined && total_chunks > 0) {
      text += ` - ${chunks_processed}/${total_chunks} Chunks`;
    }
    return text;
  };

  if (isLoading && documents.length === 0) {
    return <div className="rounded-xl px-4 py-3.5 bg-white/5 text-muted-foreground">Syncing curricular library...</div>;
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto no-scrollbar">
      <div className="relative flex flex-col gap-4 bg-white/[0.035] border border-white/10 rounded-2xl p-4 text-foreground shrink-0">
        {onClose && (
          <button
            type="button"
            aria-label="Close documents drawer"
            className="absolute top-2.5 right-2.5 z-10 w-7 h-7 grid place-items-center border border-white/10 rounded-full bg-white/5 text-muted-foreground text-[1.15rem] leading-none cursor-pointer transition-all duration-200 hover:bg-white/10 hover:border-white/[0.22] hover:text-foreground hover:scale-105"
            onClick={onClose}
          >
            &times;
          </button>
        )}
        <UploadTab
          onUploaded={refresh}
          enqueueUpload={enqueueUpload}
          documents={documents}
          compact={true}
        />
        {uploadQueueLength > 0 && (
          <div className="text-[0.85rem] text-muted-foreground mt-2 text-center">
            {uploadQueueLength} file(s) waiting in queue... ({activeUploads} uploading)
          </div>
        )}
      </div>

      <section className="flex flex-col gap-4 flex-1 overflow-hidden bg-white/[0.035] border border-white/10 rounded-2xl p-4 text-foreground shrink-0">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h3 className="m-0 text-[1.1rem] text-foreground font-display font-semibold">Curricular Library</h3>
          <span className="bg-primary/10 text-primary px-2 py-1 rounded-xl text-xs font-semibold">{(documents || []).length} of 10 Resources</span>
        </div>

        {error && (
          <DangerAlert className="mb-4">
            <div className="flex justify-between items-center w-full">
              <span>{error}</span>
              <button type="button" onClick={clearError} className="text-crimson-glow hover:text-white" aria-label="Clear error">
                <FiXCircle className="w-4 h-4" />
              </button>
            </div>
          </DangerAlert>
        )}

        {(!documents || documents.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4 text-center">
            <FiFileText size={48} />
            <p>No curricular documents have been uploaded to this session yet.</p>
          </div>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-2 overflow-y-auto flex-1 custom-scrollbar">
            {documents.map((doc) => (
              <li key={doc.id || doc.temp_id} className={`flex items-center p-3 rounded-xl border transition-all duration-200 relative overflow-hidden group hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(0,0,0,0.05)] ${doc.current_stage === 'FAILED' ? 'border-red-500/40 bg-red-900/10' : 'bg-white/5 border-white/10 hover:border-primary/25'}`}>
                <div className="flex items-center justify-center w-10 h-10 bg-black/20 rounded-lg text-primary mr-4 shrink-0">
                  <FiFileText size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis mb-1 text-[13px]" title={doc.filename || 'Unknown'}>
                    {doc.filename || 'Unknown'}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1" title={doc.current_stage === 'FAILED' ? 'Delete and Re-upload' : ''}>
                      {getStatusIcon(doc.current_stage)}
                      {getStatusText(doc.current_stage, doc.progress_pct, doc.chunks_processed, doc.total_chunks)}
                    </span>
                    <span className="text-[11px]">{formatDateOnly(doc.upload_date)}</span>
                    {doc.tokens_used !== undefined && doc.tokens_used > 0 && (
                      <span className="ml-2 text-[0.8em] text-muted-foreground">
                        ({doc.tokens_used} tokens)
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="bg-transparent border-none text-muted-foreground cursor-pointer p-2 rounded transition-all duration-200 opacity-0 group-hover:opacity-100 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-0"
                  onClick={() => doc.id && setDocToDelete({ id: doc.id, filename: doc.filename })}
                  title="Delete Resource"
                  disabled={!doc.id}
                >
                  <FiTrash2 />
                </button>
                {!['COMPLETE', 'FAILED', 'CANCELLED', 'QUEUED'].includes(doc.current_stage) && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/5">
                    <div
                      className="h-full bg-gradient-to-r from-[#6d001a] to-primary"
                      style={{ width: `${doc.progress_pct || 0}%` }}
                    ></div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent className="bg-dark-secondary border border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete &quot;{docToDelete?.filename}&quot;? This will permanently remove the resource from the active session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border border-white/10 hover:bg-white/10 text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => {
                if (docToDelete) {
                  deleteDocument(docToDelete.id);
                  setDocToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
