import { useRef, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/features/auth/store/authStore';

const IMMEDIATE_STOP_TIME = 0;
const WATCHDOG_TIMEOUT_MS = 2000;

export interface Viseme {
  start: number;
  end: number;
  value: string;
}

export function useGaplessAudioQueue() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlaybackTimeRef = useRef<number>(0);
  const scheduledNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const visemeBaseStartTimeRef = useRef<number | null>(null);
  const processingQueueRef = useRef<Promise<void>>(Promise.resolve());
  const flushTokenRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController>(new AbortController());
  const activeSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isMountedRef = useRef(true);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const getIsAudioPlaying = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state !== 'running') return false;
    return ctx.currentTime >= (visemeBaseStartTimeRef.current ?? Infinity) && ctx.currentTime < nextPlaybackTimeRef.current;
  }, []);

  const getNextPlaybackTime = useCallback(() => {
    return nextPlaybackTimeRef.current;
  }, []);

  const flushQueue = useCallback(() => {
    flushTokenRef.current += 1;

    processingQueueRef.current = Promise.resolve();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
    }

    if (activeSourceNodeRef.current) {
      try {
        if (typeof activeSourceNodeRef.current.stop === 'function') {
          try {
            activeSourceNodeRef.current.stop(IMMEDIATE_STOP_TIME);
          } catch (stopErr: any) {
            if (stopErr.name !== 'InvalidStateError') throw stopErr;
          }
        }
        if (typeof activeSourceNodeRef.current.disconnect === 'function') {
          activeSourceNodeRef.current.disconnect();
        }
      } catch (e) {
        console.warn('[GaplessAudio] Failed to disconnect activeSourceNode:', e);
      }
      activeSourceNodeRef.current = null;
    }

    scheduledNodesRef.current.forEach((node) => {
      if (!node) return;
      try {
        if (typeof node.stop === 'function') {
          try {
            node.stop(IMMEDIATE_STOP_TIME);
          } catch (stopErr: any) {
            if (stopErr.name !== 'InvalidStateError') throw stopErr;
          }
        }
        if (typeof node.disconnect === 'function') {
          node.disconnect();
        }
      } catch (e) {
        console.warn('[GaplessAudio] Failed to disconnect scheduled node:', e);
      }
    });

    scheduledNodesRef.current = [];

    if (audioContextRef.current) {
      nextPlaybackTimeRef.current = audioContextRef.current.currentTime;
    } else {
      nextPlaybackTimeRef.current = 0;
    }

    visemeBaseStartTimeRef.current = null;
  }, []);

  const enqueueAudioUrl = useCallback(
    (url: string, visemes: Viseme[] = [], mouthCuesRef: React.MutableRefObject<Viseme[]> | null = null) => {
      const currentToken = flushTokenRef.current;

      processingQueueRef.current = processingQueueRef.current
        .then(async () => {
          if (currentToken !== flushTokenRef.current) return;

          const ctx = getAudioContext();
          const token = useAuthStore.getState().accessToken;
          const headers = token ? { Authorization: `Bearer ${token}` } : {};

          const response = await fetch(url, {
            headers,
            signal: abortControllerRef.current.signal,
          });

          if (!isMountedRef.current) return;

          if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
          const arrayBuffer = await response.arrayBuffer();

          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }

          if (currentToken !== flushTokenRef.current) return;

          if (ctx.currentTime >= nextPlaybackTimeRef.current) {
            visemeBaseStartTimeRef.current = null;
            if (mouthCuesRef) {
              mouthCuesRef.current = [];
            }
          }

          const scheduleTime = Math.max(ctx.currentTime, nextPlaybackTimeRef.current);
          if (visemeBaseStartTimeRef.current === null) {
            visemeBaseStartTimeRef.current = scheduleTime;
          }

          const chunkOffset = scheduleTime - visemeBaseStartTimeRef.current;

          const source = ctx.createBufferSource();
          activeSourceNodeRef.current = source;
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          scheduledNodesRef.current.push(source);

          source.onended = () => {
            if (!source) return;
            try {
              if (typeof source.disconnect === 'function') {
                source.disconnect();
              }
              // Defensive GC: Nullify buffer to prevent memory leaks from retained audio buffers
              source.buffer = null;
            } catch (e) {
              console.warn('[GaplessAudio] Failed to cleanup activeSourceNode onended:', e);
            }
            if (activeSourceNodeRef.current === source) {
              activeSourceNodeRef.current = null;
            }
            scheduledNodesRef.current = scheduledNodesRef.current.filter((n) => n !== source);
          };

          source.start(scheduleTime);
          nextPlaybackTimeRef.current = scheduleTime + audioBuffer.duration;

          if (visemes.length > 0 && mouthCuesRef) {
            console.log(`[Runtime Evidence] Raw Visemes Payload. Count: ${visemes.length}, First: ${JSON.stringify(visemes[0])}, Last: ${JSON.stringify(visemes[visemes.length - 1])}, Audio Duration: ${audioBuffer.duration}`);
            // DEFENSIVE FIX: Automatically normalize viseme timestamps.
            // Some TTS backends output visemes in milliseconds while Web Audio uses seconds.
            // If the last viseme ends at a time > 100, it is safely assumed to be in milliseconds.
            const isMilliseconds = visemes[visemes.length - 1].end > 100;
            const timeScale = isMilliseconds ? 1000 : 1;

            const shiftedVisemes = visemes.map((v) => ({
              ...v,
              start: (v.start / timeScale) + chunkOffset,
              end: (v.end / timeScale) + chunkOffset,
            }));
            mouthCuesRef.current = [...mouthCuesRef.current, ...shiftedVisemes];
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          console.error('[GaplessAudio] Processing Queue failed:', err);
        });
    },
    [getAudioContext]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      flushQueue();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [flushQueue]);

  useEffect(() => {
    // DEFENSIVE: Stalled Audio Queue Watchdog
    // Polls the AudioContext state. If suspended while nodes are scheduled, forces resume.
    // If playback is irreparably desynced (stuck 2000ms past intended end), flushes queue to recover.
    const watchdog = window.setInterval(() => {
      const ctx = audioContextRef.current;
      if (!ctx || scheduledNodesRef.current.length === 0) return;
      
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      } else if (ctx.state === 'running' && ctx.currentTime > nextPlaybackTimeRef.current + (WATCHDOG_TIMEOUT_MS / 1000)) {
        console.warn('[GaplessAudio] Watchdog triggered: Audio context stalled. Flushing queue.');
        flushQueue();
      }
    }, WATCHDOG_TIMEOUT_MS);

    return () => window.clearInterval(watchdog);
  }, [flushQueue]);

  return {
    enqueueAudioUrl,
    flushQueue,
    getAudioContext,
    playbackStartTimeRef: visemeBaseStartTimeRef,
    getIsAudioPlaying,
    getNextPlaybackTime,
  };
}
