import { useState, useCallback } from 'react';
import { generateSummaryStream } from '../api/summaryApi';

type SummaryState = 'idle' | 'generating' | 'success' | 'error';

export function useSummarySession() {
  const [summaryState, setSummaryState] = useState<SummaryState>('idle');
  const [summaryData, setSummaryData] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const startSummaryGeneration = useCallback((documentId: string, locale: string = 'en') => {
    setSummaryState('generating');
    setSummaryData('');
    setError(null);

    generateSummaryStream(
      documentId,
      locale,
      (chunk) => {
        setSummaryData((prev) => prev + chunk);
      },
      () => {
        setSummaryState('success');
      },
      (err) => {
        setError(err.message);
        setSummaryState('error');
      }
    );
  }, []);

  const resetSummary = useCallback(() => {
    setSummaryState('idle');
    setSummaryData('');
    setError(null);
  }, []);

  return {
    summaryState,
    summaryData,
    error,
    startSummaryGeneration,
    resetSummary
  };
}
