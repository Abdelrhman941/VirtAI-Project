import apiClient from '@/core/api/apiClient';
import { CSRF_HEADER_NAME, ensureCsrfToken } from '@/core/api/csrfService';

export const generateSummaryStream = async (
  documentId: string,
  locale: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
) => {
  try {
    const csrfToken = await ensureCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }

    const response = await fetch(`/api/v1/rag/summarize/${documentId}?locale=${locale}`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Summary failed with status ${response.status}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream not supported in this browser.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    }
    
    // Final flush
    const finalChunk = decoder.decode();
    if (finalChunk) {
      onChunk(finalChunk);
    }
    
    onComplete();
  } catch (error) {
    if (error instanceof Error) {
      onError(error);
    } else {
      onError(new Error('An unknown error occurred during summarization.'));
    }
  }
};
