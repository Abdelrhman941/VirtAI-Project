import React, { useState } from 'react';
import { useDiagramSession } from '../hooks/useDiagramSession';
import { DocumentPicker } from './DocumentPicker';
import { DiagramViewer } from './DiagramViewer';

interface DiagramContainerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
}

export function DiagramContainer({ isOpen, onClose, sessionId }: DiagramContainerProps) {
  const { diagramState, diagramData, startDiagramGeneration, resetDiagram } = useDiagramSession();
  const [showViewer, setShowViewer] = useState(false);

  if (!isOpen) return null;

  const handleSelectDocument = (documentId: string) => {
    setShowViewer(true);
    startDiagramGeneration(documentId, 'en');
  };

  const handleClose = () => {
    resetDiagram();
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
        <DiagramViewer 
          diagramData={diagramData}
          isLoading={diagramState === 'generating'}
          onClose={handleClose}
        />
      )}
    </section>
  );
}
