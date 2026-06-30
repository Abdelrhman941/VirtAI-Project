import { useState, useCallback } from 'react';
import { generateDiagram, getDiagram, DiagramData } from '../api/diagramApi';
import { toast } from '@/shared/utils/toast';

export type DiagramState = 'idle' | 'generating' | 'active' | 'error';

export function useDiagramSession() {
  const [diagramState, setDiagramState] = useState<DiagramState>('idle');
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const startDiagramGeneration = useCallback(async (documentId: string, locale: string = 'en') => {
    setDiagramState('generating');
    setDiagramData(null);
    setSelectedDocumentId(documentId);

    try {
      const diagramId = await generateDiagram(documentId, locale);
      const data = await getDiagram(diagramId);
      setDiagramData(data);
      setDiagramState('active');
    } catch (error) {
      setDiagramState('error');
      toast.error('Diagram Error', 'Failed to generate diagram. Please try again.');
    }
  }, []);

  const resetDiagram = useCallback(() => {
    setDiagramState('idle');
    setDiagramData(null);
    setSelectedDocumentId(null);
  }, []);

  return {
    diagramState,
    diagramData,
    selectedDocumentId,
    startDiagramGeneration,
    resetDiagram
  };
}
