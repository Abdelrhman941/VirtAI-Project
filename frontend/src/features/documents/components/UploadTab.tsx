import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FiFileText, FiUploadCloud, FiX } from 'react-icons/fi';
import { Document } from '../types';

const MAX_FILE_SIZE_MB = 25;
const ACCEPTED_EXTENSIONS = new Set(['pdf', 'txt', 'md']);

function validateSelectedFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !ACCEPTED_EXTENSIONS.has(extension)) {
    return 'Please select a document in PDF, TXT, or Markdown format.';
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `The selected file exceeds the ${MAX_FILE_SIZE_MB}MB size limit. Please compress the file or choose a smaller resource.`;
  }
  return null;
}

interface UploadTabProps {
  onUploaded?: () => void;
  onSkip?: () => void;
  enqueueUpload: (file: File, tempId: string, fileHash: string, confirmedDuplicate?: boolean) => Promise<{ isDuplicate: boolean } | void>;
  documents: Document[];
}

export function UploadTab({ onSkip, enqueueUpload, documents }: UploadTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [hashWorker, setHashWorker] = useState<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/hashWorker.ts', import.meta.url), { type: 'module' });
    setHashWorker(worker);
    return () => worker.terminate();
  }, []);

  const totalFiles = documents.length;
  const isLimitReached = totalFiles >= 10;

  const setFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const validFiles: File[] = [];
    const errors = { ...localErrors };

    let projectedCount = totalFiles + selectedFiles.length;

    newFiles.forEach(file => {
      if (selectedFiles.some(f => f.name === file.name)) {
        return;
      }

      if (projectedCount >= 10) {
        errors[file.name] = 'You have reached the maximum limit of 10 uploaded documents for this session.';
        return;
      }

      const validationError = validateSelectedFile(file);
      if (validationError) {
        errors[file.name] = validationError;
      } else {
        validFiles.push(file);
        projectedCount++;
      }
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setLocalErrors(errors);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setFiles(e.dataTransfer.files);
  };

  const removeFile = useCallback((fileName: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
    setLocalErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fileName];
      return newErrors;
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0 || !hashWorker) return;
    setIsProcessing(true);

    for (const file of selectedFiles) {
      if (localErrors[file.name]) continue;

      try {
        const hashResult = await new Promise<{ hash?: string, fileName: string }>((resolve, reject) => {
          let onMessage: (e: MessageEvent) => void;

          const timeoutId = setTimeout(() => {
            hashWorker.removeEventListener('message', onMessage);
            reject(new Error('Hashing timed out after 10 seconds'));
          }, 30000);

          onMessage = (e: MessageEvent) => {
            if (e.data.fileName === file.name) {
              clearTimeout(timeoutId);
              hashWorker.removeEventListener('message', onMessage);
              if (e.data.error) {
                reject(new Error(e.data.error));
              } else {
                resolve(e.data);
              }
            }
          };
          hashWorker.addEventListener('message', onMessage);
          hashWorker.postMessage(file);
        });

        // Generate UUID tempId for optimistic UI tracking
        const tempId = crypto.randomUUID();

        const result = await enqueueUpload(file, tempId, hashResult.hash!);
        if (result && result.isDuplicate) {
          if (window.confirm(`A file named "${file.name}" with the exact same size already exists. Are you sure you want to upload it again?`)) {
            await enqueueUpload(file, tempId, hashResult.hash!, true);
          } else {
            removeFile(file.name);
            continue;
          }
        }
        
        removeFile(file.name);

      } catch (err: unknown) {
        setLocalErrors(prev => ({ ...prev, [file.name]: 'Failed to calculate file hash: ' + (err instanceof Error ? err.message : 'Unknown checksum error') + '. Please try uploading the file again.' }));
        console.error("Hashing error", err);
      }
    }

    setIsProcessing(false);
  }, [selectedFiles, hashWorker, enqueueUpload, removeFile, localErrors]);

  const hasFiles = selectedFiles.length > 0;

  return (
    <div className="tab-pane upload-tab fade-in">
      <div className="upload-card modern-glass-card">
        <div className="upload-header">
          <h2 className="setup-section-title">Upload Curriculum Documents</h2>
          <p className="setup-section-subtitle">
            Provide syllabus, textbooks, or course notes to inform your virtual teaching assistant&apos;s curriculum awareness (Maximum 10 files per session).
          </p>
        </div>

        {isLimitReached && (
          <div className="error-banner" style={{ marginBottom: '1rem' }}>
            This session has reached the limit of 10 curriculum documents. Please remove an existing document to upload a new one.
          </div>
        )}

        <div
          className={`upload-area ${hasFiles ? 'has-file' : ''} ${(isProcessing || isLimitReached) ? 'disabled' : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !isProcessing && !isLimitReached && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            className="sr-only"
            multiple
            disabled={isLimitReached}
          />

          {!hasFiles ? (
            <div className="upload-prompt">
              <span className="upload-icon-wrap">
                <FiUploadCloud />
              </span>
              <p>Drag reference documents here, or click to browse files</p>
              <span className="upload-formats">Supports PDF, TXT, or MD formats up to 25MB</span>
            </div>
          ) : (
            <div className="selected-files-list" onClick={(e) => e.stopPropagation()}>
              <AnimatePresence>
                {selectedFiles.map((file) => {
                  const fileError = localErrors[file.name];

                  return (
                    <motion.div
                      key={file.name}
                      className={`file-list-item ${fileError ? 'error' : ''}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <FiFileText className="file-list-icon" />
                      <div className="file-list-details min-w-0">
                        <span className="file-list-name truncate block w-full overflow-hidden text-ellipsis" dir="auto" title={file.name}>{file.name}</span>
                        <span className="file-list-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        {fileError && (
                          <span className="file-list-error-text">{fileError}</span>
                        )}
                      </div>

                      {!isProcessing && (
                        <button
                          className="icon-btn remove-btn-small"
                          onClick={() => removeFile(file.name)}
                          aria-label="Remove selected file"
                        >
                          <FiX />
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="tab-actions">
          {onSkip && (
            <button className="btn secondary" onClick={onSkip} disabled={isProcessing}>
              Skip Document Upload
            </button>
          )}

          <button
            className="btn primary"
            onClick={handleUpload}
            disabled={!hasFiles || isProcessing || isLimitReached}
          >
            {isProcessing ? 'Hashing & Analyzing...' : 'Upload Reference Materials'}
          </button>
        </div>
      </div>
    </div>
  );
}
