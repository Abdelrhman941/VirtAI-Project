import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheckCircle, FiClock, FiFileText, FiXCircle } from 'react-icons/fi';
import { ISession } from '../types';
import './SessionHoverPreview.css';

export interface SessionHoverPreviewProps {
  session: ISession;
  triggerElement: HTMLElement | null;
  isHovered: boolean;
}

export default function SessionHoverPreview({
  session,
  triggerElement,
  isHovered,
}: SessionHoverPreviewProps) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isHovered) {
      timerRef.current = setTimeout(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShow(true);
      }, 2000); // 2s delay
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isHovered, session.id]);

  if (!show || !triggerElement) return null;
  if (!session.documents || session.documents.length === 0) return null;

  const rect = triggerElement.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  const left = rect.right + window.scrollX + 10;

  const maxFiles = 3;
  const displayedFiles = session.documents.slice(0, maxFiles);
  const remainingFiles = session.documents.length - maxFiles;

  return createPortal(
    <div
      className="session-hover-preview"
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 9999,
      }}
    >
      <div className="preview-header">Attached Documents</div>
      <div className="preview-files">
        {displayedFiles.map((doc: any) => (
          <div key={doc.id} className="preview-file-item">
            <FiFileText className="preview-file-icon" />
            <span className="preview-file-name" title={doc.filename}>
              {doc.filename}
            </span>
            {doc.status === 'QUEUED' && <FiClock className="preview-status-icon pending" />}
            {doc.status === 'READY' && <FiCheckCircle className="preview-status-icon success" />}
            {doc.status === 'FAILED' && <FiXCircle className="preview-status-icon error" />}
          </div>
        ))}
        {remainingFiles > 0 && (
          <div className="preview-file-more">
            +{remainingFiles} more {remainingFiles === 1 ? 'file' : 'files'}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
