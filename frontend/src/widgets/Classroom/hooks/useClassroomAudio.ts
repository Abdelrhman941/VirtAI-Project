import { useRef, useCallback } from 'react';
import { useGaplessAudioQueue, Viseme } from '@/features/voice/hooks/useGaplessAudioQueue';

export function useClassroomAudio() {
  // Structure: { baseId: { chunkIndex: { url, cues } } }
  const chunksRef = useRef<Record<string, Record<string, { url?: string; cues?: Viseme[] }>>>({});
  const expectedChunkRef = useRef<Record<string, number>>({});
  const missingChunkTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  const mouthCuesRef = useRef<Viseme[]>([]);
  const playedAudioIdsRef = useRef<Set<string>>(new Set());

  // DEFENSIVE: Kill the "Late Chunk" Zombie. 
  // Store aborted message IDs to instantly drop late-arriving packets from the network.
  const abortedMessageIdsRef = useRef<Set<string>>(new Set());

  const { enqueueAudioUrl, flushQueue, getAudioContext, playbackStartTimeRef, getIsAudioPlaying, getNextPlaybackTime } = useGaplessAudioQueue();

  const tryPlayChunk = useCallback(function tryPlayChunkInner(baseId: string) {
    if (abortedMessageIdsRef.current.has(baseId)) {
      delete chunksRef.current[baseId];
      return;
    }
    
    const sessionChunks = chunksRef.current[baseId];
    if (!sessionChunks) return;

    // Handle filler separately (no sequence waiting)
    const fillerChunk = sessionChunks['filler'];
    if (fillerChunk && fillerChunk.url && fillerChunk.cues) {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      enqueueAudioUrl(fillerChunk.url, fillerChunk.cues, mouthCuesRef);
      delete sessionChunks['filler'];
    }

    // Process sequential chunks
    let expected = expectedChunkRef.current[baseId] || 0;
    let playedAny = false;
    while (true) {
      const nextChunk = sessionChunks[expected.toString()];
      if (nextChunk && nextChunk.url && nextChunk.cues) {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        enqueueAudioUrl(nextChunk.url, nextChunk.cues, mouthCuesRef);
        
        if (chunksRef.current[baseId]?.[expected.toString()]) {
          delete chunksRef.current[baseId][expected.toString()];
        }
        
        expected++;
        playedAny = true;
      } else {
        break;
      }
    }
    expectedChunkRef.current[baseId] = expected;

    if (playedAny && missingChunkTimeoutsRef.current[baseId]) {
      clearTimeout(missingChunkTimeoutsRef.current[baseId]);
      delete missingChunkTimeoutsRef.current[baseId];
    }

    // Sequence Deadlock Fallback: If we have future chunks but are blocked on 'expected'
    const hasFutureChunks = Object.keys(sessionChunks).some(k => {
      const idx = parseInt(k, 10);
      return !isNaN(idx) && idx > expected;
    });

    if (hasFutureChunks && !missingChunkTimeoutsRef.current[baseId]) {
      missingChunkTimeoutsRef.current[baseId] = setTimeout(() => {
        console.warn(`[AudioSequence] Timeout waiting for chunk ${expected}. Skipping.`);
        expectedChunkRef.current[baseId]++;
        delete missingChunkTimeoutsRef.current[baseId];
        tryPlayChunkInner(baseId);
      }, 3000);
    }
  }, [getAudioContext, enqueueAudioUrl]);

  const handleTtsReady = useCallback((messageId: string | undefined, url: string) => {
    if (!messageId) return;
    const isChunked = messageId.includes('_');
    const baseId = isChunked ? messageId.split('_')[0] : messageId;
    const chunkIdx = isChunked ? messageId.split('_')[1] : '0';

    if (abortedMessageIdsRef.current.has(baseId)) return;
    
    if (!chunksRef.current[baseId]) chunksRef.current[baseId] = {};
    if (!chunksRef.current[baseId][chunkIdx]) chunksRef.current[baseId][chunkIdx] = {};
    
    chunksRef.current[baseId][chunkIdx].url = url;

    // Fix filler deadlock: provide empty visemes automatically if it's a filler
    if (chunkIdx === 'filler' && !chunksRef.current[baseId][chunkIdx].cues) {
      chunksRef.current[baseId][chunkIdx].cues = [];
    }
    
    tryPlayChunk(baseId);
  }, [tryPlayChunk]);

  const handleVisemesReady = useCallback((messageId: string, cues: Viseme[]) => {
    const isChunked = messageId.includes('_');
    const baseId = isChunked ? messageId.split('_')[0] : messageId;
    const chunkIdx = isChunked ? messageId.split('_')[1] : '0';

    if (abortedMessageIdsRef.current.has(baseId)) return;
    
    if (!chunksRef.current[baseId]) chunksRef.current[baseId] = {};
    if (!chunksRef.current[baseId][chunkIdx]) chunksRef.current[baseId][chunkIdx] = {};
    
    chunksRef.current[baseId][chunkIdx].cues = cues;
    
    tryPlayChunk(baseId);
  }, [tryPlayChunk]);

  const forceAdvanceSequence = useCallback((baseId: string) => {
    setTimeout(() => {
      if (abortedMessageIdsRef.current.has(baseId)) return;
      const sessionChunks = chunksRef.current[baseId];
      if (!sessionChunks) return;
      
      const keys = Object.keys(sessionChunks)
        .map(k => parseInt(k, 10))
        .filter(k => !isNaN(k));

      if (keys.length === 0) return;

      keys.sort((a, b) => a - b);
      
      let maxIndex = expectedChunkRef.current[baseId] || 0;
      
      keys.forEach(idx => {
        const chunk = sessionChunks[idx.toString()];
        if (chunk && chunk.url && chunk.cues) {
          const ctx = getAudioContext();
          if (ctx.state === 'suspended') ctx.resume();
          console.warn(`[AudioSequence] Eager reconciliation flush. Pushing out-of-order chunk ${idx}`);
          enqueueAudioUrl(chunk.url, chunk.cues, mouthCuesRef);
          
          if (chunksRef.current[baseId]?.[idx.toString()]) {
            delete chunksRef.current[baseId][idx.toString()];
          }
        }
        if (idx >= maxIndex) maxIndex = idx + 1;
      });

      expectedChunkRef.current[baseId] = maxIndex;

      if (missingChunkTimeoutsRef.current[baseId]) {
        clearTimeout(missingChunkTimeoutsRef.current[baseId]);
        delete missingChunkTimeoutsRef.current[baseId];
      }
    }, 300);
  }, [getAudioContext, enqueueAudioUrl]);

  const resetAvatarAudio = useCallback((abortedMessageId?: string | null) => {
    if (abortedMessageId) {
      abortedMessageIdsRef.current.add(abortedMessageId);
      if (abortedMessageIdsRef.current.size > 50) {
        const iter = abortedMessageIdsRef.current.values();
        for (let i = 0; i < 20; i++) abortedMessageIdsRef.current.delete(iter.next().value as string);
      }
    }
    chunksRef.current = {};
    expectedChunkRef.current = {};
    Object.values(missingChunkTimeoutsRef.current).forEach(clearTimeout);
    missingChunkTimeoutsRef.current = {};
    mouthCuesRef.current = [];
    flushQueue();
    playedAudioIdsRef.current.clear();
  }, [flushQueue]);

  return {
    mouthCuesRef,
    getAudioContext,
    playbackStartTimeRef,
    handleTtsReady,
    handleVisemesReady,
    forceAdvanceSequence,
    resetAvatarAudio,
    flushQueue,
    playedAudioIdsRef,
    getIsAudioPlaying,
    getNextPlaybackTime
  };
}
