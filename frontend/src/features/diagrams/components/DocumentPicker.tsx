import React, { useState } from 'react';
import { useDocumentList } from '@/features/documents/useDocumentList';
import { PiFilePdfDuotone } from 'react-icons/pi';
import { FiCheck } from 'react-icons/fi';
import { LoadingState, EmptyState } from '@/shared/components/UIStates';

interface DocumentPickerProps {
  sessionId: string | null;
  onSelect: (documentId: string, filename: string) => void;
  onCancel: () => void;
  title?: string;
  buttonText?: string;
}

export function DocumentPicker({ 
  sessionId, 
  onSelect, 
  onCancel,
  title = "Select Document for Tree Map",
  buttonText = "Generate Tree Map"
}: DocumentPickerProps) {
  const { documents, isLoading } = useDocumentList(sessionId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedId) {
      const selectedDoc = documents.find(d => d.id === selectedId);
      onSelect(selectedId, selectedDoc?.filename || 'Document');
    }
  };

  if (isLoading && documents.length === 0) {
    return (
      <div className="p-8 flex flex-col min-h-[300px]">
        <LoadingState 
          isAbsolute={false} 
          message="Loading documents..." 
          className="flex-1 justify-center items-center" 
        />
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col relative">
      <h2 className="text-2xl font-bold font-display text-white/90 tracking-wide mb-6 text-center">
        {title}
      </h2>

      {documents.length === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={<PiFilePdfDuotone className="w-8 h-8 text-white/50" />}
            title="No Documents"
            description="No documents found for this session."
            isAbsolute={false}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {documents.map((doc) => {
            const isSelected = selectedId === doc.id;
            const isProcessing = !doc.id;

            return (
              <label
                key={doc.id || doc.temp_id}
                className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-colors duration-300 group ${
                  isSelected
                    ? 'bg-white/10 border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                    : isProcessing
                    ? 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 hover:shadow-lg hover:-translate-y-0.5'
                }`}
              >
                <input
                  type="radio"
                  name="document_selection"
                  value={doc.id || ''}
                  checked={isSelected}
                  onChange={() => !isProcessing && doc.id && setSelectedId(doc.id)}
                  disabled={isProcessing}
                  className="sr-only"
                />
                
                <div className="flex-shrink-0">
                  <PiFilePdfDuotone className={`w-6 h-6 transition-colors ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className={`text-sm font-medium truncate block w-full overflow-hidden text-ellipsis ${isSelected ? 'text-white' : 'text-white/80'}`} dir="auto" title={doc.filename}>
                    {doc.filename}
                  </span>
                  {isProcessing && (
                    <span className="text-xs text-white/40 mt-0.5">Processing...</span>
                  )}
                </div>

                <div className="flex-shrink-0 ml-2">
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                      <FiCheck className="text-black w-3 h-3" strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-white/20 group-hover:border-white/40 transition-colors" />
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-4 pt-6 border-t border-white/5">
        <button
          onClick={onCancel}
          className="px-6 py-2.5 rounded-full text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!selectedId}
          className="px-8 py-2.5 rounded-full text-sm font-semibold text-black bg-white hover:bg-gray-100 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed transition-colors duration-300 shadow-xl"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
