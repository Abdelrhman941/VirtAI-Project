import React, { useState } from 'react';
import { useSummarySession } from '../hooks/useSummarySession';
import { DocumentPicker } from '@/features/diagrams/components/DocumentPicker';
import { SummaryViewer } from './SummaryViewer';

interface SummaryContainerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
}

export function SummaryContainer({ isOpen, onClose, sessionId }: SummaryContainerProps) {
  const { summaryState, summaryData, startSummaryGeneration, resetSummary } = useSummarySession();
  const [showViewer, setShowViewer] = useState(false);

  if (!isOpen) return null;

  const handleSelectDocument = (documentId: string) => {
    setShowViewer(true);
    startSummaryGeneration(documentId, 'en'); // You can modify the locale logic later if needed
  };

  const handleClose = () => {
    resetSummary();
    setShowViewer(false);
    onClose();
  };

  return (
    <section className="w-full h-full flex flex-col relative bg-dark-tertiary overflow-hidden min-w-0">
      {!showViewer ? (
        <div className="w-full h-full overflow-y-auto p-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-2xl w-[600px] max-w-[90vw]">
            <DocumentPicker 
              sessionId={sessionId} 
              onSelect={handleSelectDocument} 
              onCancel={handleClose} 
            />
          </div>
        </div>
      ) : (
        <SummaryViewer 
          summaryData={summaryData}
          isLoading={summaryState === 'generating'}
          onClose={handleClose}
        />
      )}
    </section>
  );
}
