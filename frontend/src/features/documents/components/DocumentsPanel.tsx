import { FiCheckCircle, FiClock, FiFileText, FiLoader, FiTrash2, FiXCircle } from 'react-icons/fi';
import { useDocumentList } from '../useDocumentList';
import './DocumentsPanel.css';
import { UploadTab } from './UploadTab';
import { formatDateOnly } from '@/shared/utils/date';

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

  const getStatusIcon = (stage: string | undefined) => {
    if (stage === 'COMPLETE') return <FiCheckCircle className="status-icon success" />;
    if (stage === 'FAILED' || stage === 'CANCELLED') return <FiXCircle className="status-icon error" />;
    if (stage === 'QUEUED') return <FiClock className="status-icon pending" />;
    return <FiLoader className="status-icon spinning" />;
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
    return <div className="documents-panel-loading">Syncing curricular library...</div>;
  }

  return (
    <div className="documents-panel-container">
      <div className="documents-panel" style={{ position: 'relative' }}>
        {onClose && (
          <button
            type="button"
            aria-label="Close documents drawer"
            className="documents-drawer-close"
            onClick={onClose}
          >
            &times;
          </button>
        )}
        <UploadTab
          onUploaded={refresh}
          enqueueUpload={enqueueUpload}
          documents={documents}
        />
        {uploadQueueLength > 0 && (
          <div className="upload-queue-status" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', textAlign: 'center' }}>
            {uploadQueueLength} file(s) waiting in queue... ({activeUploads} uploading)
          </div>
        )}
      </div>

      <section className="documents-panel list-panel">
        <div className="documents-panel-header">
          <h3 className="display-h3">Curricular Library</h3>
          <span className="badge">{(documents || []).length} of 10 Resources</span>
        </div>

        {error && (
          <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{error}</span>
            <button type="button" onClick={clearError} className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Clear error">
              <FiXCircle />
            </button>
          </div>
        )}

        {(!documents || documents.length === 0) ? (
          <div className="empty-state">
            <FiFileText size={48} />
            <p>No curricular documents have been uploaded to this session yet.</p>
          </div>
        ) : (
          <ul className="document-list">
            {documents.map((doc) => (
              <li key={doc.id || doc.temp_id} className={`document-item ${doc.current_stage?.toLowerCase()}`}>
                <div className="doc-icon flex-shrink-0">
                  <FiFileText size={24} />
                </div>
                <div className="doc-info min-w-0">
                  <div className="doc-name truncate text-ellipsis overflow-hidden whitespace-nowrap" title={doc.filename || 'Unknown'}>
                    {doc.filename || 'Unknown'}
                  </div>
                  <div className="doc-meta">
                    <span className="doc-status" title={doc.current_stage === 'FAILED' ? 'Delete and Re-upload' : ''}>
                      {getStatusIcon(doc.current_stage)}
                      {getStatusText(doc.current_stage, doc.progress_pct, doc.chunks_processed, doc.total_chunks)}
                    </span>
                    <span className="doc-date">{formatDateOnly(doc.upload_date)}</span>
                    {doc.tokens_used !== undefined && doc.tokens_used > 0 && (
                      <span className="doc-tokens" style={{ marginLeft: '0.5rem', fontSize: '0.8em', color: 'var(--text-muted)' }}>
                        ({doc.tokens_used} tokens)
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="icon-button delete"
                  onClick={() => doc.id && deleteDocument(doc.id)}
                  title="Delete Resource"
                  disabled={!doc.id}
                >
                  <FiTrash2 />
                </button>
                {!['COMPLETE', 'FAILED', 'CANCELLED', 'QUEUED'].includes(doc.current_stage) && (
                  <div className="mini-progress-bar">
                    <div
                      className="mini-progress-fill"
                      style={{ width: `${doc.progress_pct || 0}%` }}
                    ></div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
