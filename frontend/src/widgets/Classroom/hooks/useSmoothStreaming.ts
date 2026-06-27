import { useRef, useState, useCallback, useEffect } from 'react';

export function useSmoothStreaming() {
  const [displayText, setDisplayText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  
  const bufferRef = useRef('');
  const frameRef = useRef<number | null>(null);

  const pushDelta = useCallback((chunk: string) => {
    bufferRef.current += chunk;
    if (!isStreaming) {
      setIsStreaming(true);
    }
    
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        setDisplayText(bufferRef.current);
        frameRef.current = null;
      });
    }
  }, [isStreaming]);

  const commitFinal = useCallback((finalText: string) => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    bufferRef.current = '';
    setDisplayText(''); // The final text is saved into the chat history, so we clear the streaming state here.
    setIsStreaming(false);
  }, []);

  const resetStream = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    bufferRef.current = '';
    setDisplayText('');
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    displayText,
    isStreaming,
    pushDelta,
    commitFinal,
    resetStream
  };
}
