import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheckCircle, FiClock, FiFileText, FiXCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { ISession } from '../types';

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

  if (!triggerElement) return null;
  if (!session.documents || session.documents.length === 0) return null;

  const rect = triggerElement.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  const left = rect.right + window.scrollX + 10;

  const maxFiles = 3;
  const displayedFiles = session.documents.slice(0, maxFiles);
  const remainingFiles = session.documents.length - maxFiles;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          className="bg-card border border-border rounded-lg p-3 w-[250px] shadow-[0_4px_12px_rgba(0,0,0,0.5)] pointer-events-none text-foreground font-sans"
          style={{
            position: 'absolute',
            top: `${top}px`,
            left: `${left}px`,
            zIndex: 9999,
          }}
        >
          <div className="text-[0.8rem] font-semibold uppercase tracking-wider text-muted-foreground mb-2 border-b border-border pb-1">
            Attached Documents
          </div>
          <div className="flex flex-col gap-1.5">
            {displayedFiles.map((doc: any) => (
              <div key={doc.id} className="flex items-center gap-2 text-[0.85rem]">
                <FiFileText className="text-muted-foreground shrink-0" />
                <span className="grow whitespace-nowrap overflow-hidden text-ellipsis" title={doc.filename}>
                  {doc.filename}
                </span>
                {doc.status === 'QUEUED' && <FiClock className="shrink-0 text-yellow-500" />}
                {doc.status === 'READY' && <FiCheckCircle className="shrink-0 text-green-500" />}
                {doc.status === 'FAILED' && <FiXCircle className="shrink-0 text-red-500" />}
              </div>
            ))}
            {remainingFiles > 0 && (
              <div className="text-[0.8rem] text-muted-foreground italic mt-1">
                +{remainingFiles} more {remainingFiles === 1 ? 'file' : 'files'}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
