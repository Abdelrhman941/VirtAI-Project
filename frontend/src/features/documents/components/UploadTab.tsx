import { Document } from '@/features/documents/types';
import { DangerAlert } from '@/shared/components/ui/alert-variants';
import { notify } from '@/shared/utils/notify';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FiFileText, FiUploadCloud, FiX } from 'react-icons/fi';

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
  compact?: boolean;
}

export function UploadTab({ onSkip, enqueueUpload, documents, compact = false }: UploadTabProps) {
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

    const successfulUploads = selectedFiles.filter(f => !localErrors[f.name]);
    if (successfulUploads.length > 0) {
      notify.success('Upload complete', `${successfulUploads.length} document(s) uploaded successfully.`);
    }

    setIsProcessing(false);
  }, [selectedFiles, hashWorker, enqueueUpload, removeFile, localErrors]);

  const hasFiles = selectedFiles.length > 0;
  const isDisabled = isProcessing || isLimitReached;

  return (
    <div className={`${compact ? '' : 'min-h-full'} flex items-center justify-center ltr fade-in`}>
      <div className={`w-full ${compact ? '' : 'max-w-[620px] p-6 rounded-[18px] border border-white/10 bg-gradient-to-b from-white/[0.055] to-white/[0.025] bg-[#121212]/56 shadow-[0_18px_44px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-[18px] sm:gap-4'} flex flex-col gap-5 modern-glass-card`}>
        <div className="flex flex-col items-center text-center">
          <h2 className={`${compact ? 'text-[18px] font-bold' : 'setup-section-title'}`}>Upload Curriculum Documents</h2>
          {!compact && (
            <p className="setup-section-subtitle">
              Provide syllabus, textbooks, or course notes to inform your virtual teaching assistant&apos;s curriculum awareness (Maximum 10 files per session).
            </p>
          )}
        </div>

        {isLimitReached && (
          <DangerAlert className="mb-4">
            This session has reached the limit of 10 curriculum documents. Please remove an existing document to upload a new one.
          </DangerAlert>
        )}

        <div
          className={`${compact ? 'min-h-[140px] p-3' : 'min-h-[210px] sm:min-h-[190px] sm:px-4 sm:py-[22px] p-7'} flex flex-col items-center justify-center rounded-[18px] border-2 border-dashed transition-all duration-200 ease-out
            ${isDisabled ? 'cursor-progress opacity-80 border-primary/30 bg-black/15' : 'cursor-pointer border-primary/30 bg-black/15 hover:border-primary/70 hover:bg-primary/10 hover:shadow-[0_12px_30px_rgba(0,0,0,0.18)] hover:-translate-y-px'}
            ${hasFiles ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !isDisabled && fileInputRef.current?.click()}
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
            <div className="w-full flex flex-col items-center justify-center gap-3 text-center">
              <span className="w-[66px] h-[66px] grid place-items-center rounded-[20px] bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <FiUploadCloud className="w-[34px] h-[34px]" />
              </span>
              <p className={`m-0 text-foreground font-[650] ${compact ? 'text-[13px] mt-2 mb-1' : 'text-[15px]'}`}>Drag reference documents here, or click to browse files</p>
              <span className={`text-muted-foreground ${compact ? 'text-[12px]' : 'text-[13px]'}`}>Supports PDF, TXT, or MD formats up to 25MB</span>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-2 max-h-[250px] overflow-y-auto p-1 custom-scrollbar" onClick={(e) => e.stopPropagation()}>
              <AnimatePresence>
                {selectedFiles.map((file) => {
                  const fileError = localErrors[file.name];

                  return (
                    <motion.div
                      key={file.name}
                      className={`flex items-center gap-3 px-4 py-3 border rounded-xl relative transition-all duration-200 hover:bg-black/30
                        ${fileError ? 'border-red-500/30 bg-red-500/5' : 'bg-black/20 border-white/10'}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <FiFileText className={`w-6 h-6 shrink-0 ${fileError ? 'text-red-500' : 'text-primary'}`} />
                      <div className="flex flex-col flex-1 min-w-0 text-left">
                        <span className="text-foreground text-[14px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap block w-full" dir="auto" title={file.name}>{file.name}</span>
                        <span className="text-muted-foreground text-[12px]">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        {fileError && (
                          <span className="text-red-300 text-[12px] mt-0.5">{fileError}</span>
                        )}
                      </div>

                      {!isProcessing && (
                        <button
                          className="w-7 h-7 grid place-items-center border border-white/10 rounded-full bg-white/5 text-muted-foreground cursor-pointer transition-all duration-200 shrink-0 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-300 hover:scale-105"
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

        <div className="flex justify-center w-full gap-3.5 flex-wrap mt-5 sm:flex-col-reverse">
          {onSkip && (
            <button
              className="min-w-[150px] min-h-[44px] inline-flex items-center justify-center rounded-xl px-[18px] py-2 border text-[14px] font-bold font-sans cursor-pointer transition-all duration-200 text-muted-foreground bg-white/5 border-white/15 hover:not:disabled:text-foreground hover:not:disabled:border-white/25 hover:not:disabled:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed hover:not:disabled:-translate-y-px sm:w-full"
              onClick={onSkip}
              disabled={isProcessing}
            >
              Skip Document Upload
            </button>
          )}

          <button
            className="min-w-[150px] min-h-[44px] inline-flex items-center justify-center rounded-xl px-[18px] py-2 border text-[14px] font-bold font-sans cursor-pointer transition-all duration-200 text-[#121212] bg-primary border-primary/70 hover:not:disabled:bg-[#c9bf9c] hover:not:disabled:shadow-[0_14px_24px_rgba(255,255,255,0.08)] disabled:opacity-40 disabled:cursor-not-allowed hover:not:disabled:-translate-y-px sm:w-full"
            onClick={handleUpload}
            disabled={!hasFiles || isDisabled}
          >
            {isProcessing ? (
              <span className="shimmer shimmer-once shimmer-duration-1100">Indexing document…</span>
            ) : (
              'Upload Reference Materials'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
