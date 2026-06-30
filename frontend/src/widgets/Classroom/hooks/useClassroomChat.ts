import { useCallback, useEffect, useRef, useMemo, useLayoutEffect, useState } from 'react';
import useWSClient, { ConnectionState } from '@/core/realtime/useWSClient';
import { useChatUIStore } from '@/features/chat/store/useChatUIStore';
import useConversationReducer from '@/features/chat/hooks/useConversationReducer';
import { toast } from '@/shared/utils/toast';
import { WSPayloadSchema, WSPayload, Viseme } from '../types';
import { PCMRecorder } from '@/features/voice/audio/pcmRecorder';
import type { WSOutgoingMessage } from '@/core/realtime/types';

const TOAST_DURATION_MS = 5000;

export function buildWsUrl(avatarId: string, voiceId: string, sessionId?: string | null) {
  const configuredBase = import.meta.env.VITE_WS_BASE_URL;
  const base =
    configuredBase ||
    `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
  const url = new URL(`/api/v1/ws/${avatarId}`, base);
  url.searchParams.set('voice', voiceId);
  if (sessionId) {
    url.searchParams.set('session_id', sessionId);
  }
  return url.toString();
}

interface UseClassroomChatProps {
  wsAvatarId: string;
  activeVoiceId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any; // Using the type from useSessionManager
  onTtsReady: (messageId: string | undefined, url: string, duration_ms?: number) => void;
  onVisemesReady: (messageId: string, cues: Viseme[]) => void;
  forceAdvanceSequence: (baseId: string) => void;
  resetAvatarAudio: (messageId?: string | null) => void;
  getAudioContext: () => AudioContext;
  /** C1: Called when animation.timeline.v2 is received from the backend. */
  onAnimationTimeline?: (messageId: string, timeline: unknown[], meta: Record<string, unknown>) => void;
}

export function useClassroomChat({
  wsAvatarId,
  activeVoiceId,
  session,
  onTtsReady,
  onVisemesReady,
  forceAdvanceSequence,
  resetAvatarAudio,
  getAudioContext,
  onAnimationTimeline,
}: UseClassroomChatProps) {
  const [conversationState, dispatch] = useConversationReducer();
  const currentSessionId = session.currentSessionId;
  const status = session.status;
  
  // Decouple WS lifecycle from lazy session creation
  const [wsSessionId, setWsSessionId] = useState(currentSessionId);
  const previousSessionIdRef = useRef(currentSessionId);

  useEffect(() => {
    if (currentSessionId !== previousSessionIdRef.current) {
      if (previousSessionIdRef.current === null && currentSessionId) {
        // Lazy creation: do not update wsSessionId to prevent WS disconnect
      } else {
        // Explicit navigation: update wsSessionId
        setWsSessionId(currentSessionId);
      }
      previousSessionIdRef.current = currentSessionId;
    }
  }, [currentSessionId]);

  const WS_URL = status === 'success' 
    ? buildWsUrl(wsAvatarId, activeVoiceId, wsSessionId || undefined) 
    : null;

  const { connectionState, isConnected, send, onMessage, reconnect, reconnectError, disconnect } =
    useWSClient(WS_URL);
  
  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  const sessionRef = useRef(session);
  const isCreatingSessionRef = useRef<boolean>(false);
  const conversationStateRef = useRef(conversationState);

  // Sync refs safely
  useLayoutEffect(() => {
    currentSessionIdRef.current = currentSessionId;
    sessionRef.current = session;
    conversationStateRef.current = conversationState;
  }, [currentSessionId, session, conversationState]);

  // Relying on core useWSMessageQueue for offline-queue delivery instead of custom manual queue.


  useEffect(() => {
    dispatch({ type: 'RESET' });
    useChatUIStore.getState().resetStream();
    resetAvatarAudio();
  }, [currentSessionId, dispatch, resetAvatarAudio]);

  useEffect(() => {
    if (connectionState === ConnectionState.RECONNECTING || connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.FAILED) { // RECONNECTING or OFFLINE
      if (conversationState.pipelineState === 'thinking' || conversationState.pipelineState === 'speaking') {
        dispatch({ type: 'ERROR', payload: { message: 'Connection interrupted' } });
        useChatUIStore.getState().setPipelineState('error');
        resetAvatarAudio(conversationState.activeMessageId);
      }
    } else if (connectionState === ConnectionState.CONNECTED) { // ONLINE
      if (conversationState.pipelineState === 'error' && conversationState.error === 'Connection interrupted') {
        dispatch({ type: 'CLEAR_ERROR' });
        useChatUIStore.getState().setPipelineState('idle');
      }
    }
  }, [connectionState, conversationState.pipelineState, conversationState.activeMessageId, dispatch, resetAvatarAudio]);

  const commitAndSend = useCallback(
    (text: string) => {
      PCMRecorder.preWarmWorklet();
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      let activeId = currentSessionId;
      if (!activeId) {
        // DEFENSIVE: Prevent Concurrent Session Creation Race Condition
        if (isCreatingSessionRef.current) return;
        isCreatingSessionRef.current = true;

        const message_id = crypto.randomUUID();
        const prevMsgId = conversationStateRef.current.activeMessageId;
        resetAvatarAudio(prevMsgId);
        dispatch({ type: 'USER_MESSAGE', payload: { message_id, text } });
        dispatch({ type: 'PIPELINE_STATE', payload: { state: 'thinking' } });
        useChatUIStore.getState().setPipelineState('thinking');
        sessionRef.current.handleFirstMessage(text).then((newId: string | null) => {
          isCreatingSessionRef.current = false;
          if (!newId) {
            dispatch({ type: 'PIPELINE_STATE', payload: { state: 'idle' } });
            useChatUIStore.getState().setPipelineState('idle');
            toast.error('Error', 'Failed to start a new conversation.');
          } else {
            // The handleFirstMessage successfully created a session, so the currentSessionId will update shortly.
            sessionRef.current.addUserMessage(
              { id: message_id, role: 'user', content: text, status: 'pending' },
              newId
            );
            // Pass the new session_id to the backend so it binds this existing websocket to the new session
            send({ type: 'chat.user_message', data: { session_id: newId, message_id, text } });
          }
        }).catch((err: unknown) => {
          isCreatingSessionRef.current = false;
          dispatch({ type: 'PIPELINE_STATE', payload: { state: 'idle' } });
          useChatUIStore.getState().setPipelineState('idle');
          console.error(err);
        });
      } else {
        const message_id = crypto.randomUUID();
        const prevMsgId = conversationStateRef.current.activeMessageId;
        resetAvatarAudio(prevMsgId);
        dispatch({ type: 'USER_MESSAGE', payload: { message_id, text } });
        dispatch({ type: 'PIPELINE_STATE', payload: { state: 'thinking' } });
        useChatUIStore.getState().setPipelineState('thinking');
        sessionRef.current.addUserMessage(
          { id: message_id, role: 'user', content: text, status: 'pending' },
          activeId
        );
        send({ type: 'chat.user_message', data: { session_id: activeId, message_id, text } });
      }
    },
    [dispatch, send, currentSessionId, resetAvatarAudio, getAudioContext]
  );

  const safeSend = useCallback(
    (message: Record<string, unknown>) => {
      send(message as unknown as WSOutgoingMessage);
    },
    [send]
  );

  useEffect(() => {
    const checkSession = (d: WSPayload) => {
      if (d && d.session_id && currentSessionIdRef.current && d.session_id !== currentSessionIdRef.current) return false;
      return true;
    };

    const validatePayload = (rawData: unknown): WSPayload | null => {
      const result = WSPayloadSchema.safeParse(rawData);
      if (!result.success) {
        if (import.meta.env.DEV) {
          console.warn('[WS] Payload validation failed:', result.error);
        } else {
          console.error('[WS] Payload validation failed:', result.error);
        }
        const message = 'Network protocol mismatch detected. Please refresh.';
        dispatch({ type: 'ERROR', payload: { message } });
        toast.error('Connection Error', message, TOAST_DURATION_MS);
        return null;
      }
      return result.data;
    };

    const unsubs = [
      onMessage('user.message.echo', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        if (!d.message_id || !d.text) return;
        
        const echoSessionId = d.session_id || currentSessionId;
        dispatch({ type: 'USER_MESSAGE', payload: { message_id: d.message_id, text: d.text } });
        sessionRef.current.addUserMessage(
          { id: d.message_id, role: 'user', content: d.text, created_at: d.created_at ?? undefined },
          echoSessionId
        );
        if (echoSessionId) {
          sessionRef.current.generateTitleForSession(echoSessionId, d.text);
        }
      }),
      onMessage('chat.delta', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        const delta = d.delta ? d.delta.replace(/\[.*?\]/g, '') : '';
        if (!delta) return;
        
        useChatUIStore.getState().pushDelta(delta);
      }),
      onMessage('chat.final', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        
        const safePayload = { ...d, text: d.text ? d.text.replace(/\[.*?\]/g, '') : undefined };
        
        useChatUIStore.getState().commitFinal();
        dispatch({ type: 'CHAT_FINAL', payload: safePayload });
        if (safePayload.text) {
          sessionRef.current.addAssistantMessage(
            d.db_message_id ? `${d.db_message_id}-assistant` : `${d.message_id}-assistant`,
            safePayload.text,
            d.session_id,
            d.created_at
          );
        }
        if (d.message_id) {
          forceAdvanceSequence(d.message_id);
        }
      }),
      onMessage('pipeline.state', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        const state = (d.state as 'idle' | 'thinking' | 'speaking' | 'error') || 'idle';
        
        if (state === 'idle' || state === 'thinking' || state === 'error') {
          useChatUIStore.getState().resetStream();
        }

        dispatch({ type: 'PIPELINE_STATE', payload: { state, message_id: d.message_id } });
        
        // Guard against late events matching reducer logic
        const isActiveMsg = !d.message_id || 
          !conversationStateRef.current.activeMessageId || 
          d.message_id === conversationStateRef.current.activeMessageId;
          
        if (isActiveMsg) {
          useChatUIStore.getState().setPipelineState(state);
        }
        
        if (state === 'idle' && d.message_id) {
          forceAdvanceSequence(d.message_id);
        }
      }),
      onMessage('tts.ready', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        const url = d.audio?.url;
        if (!url) return;
        
        onTtsReady(d.message_id, url, d.audio?.duration_ms);
      }),
      onMessage('visemes.ready', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        
        if (d.message_id) {
          onVisemesReady(d.message_id, d.mouthCues || []);
        }
      }),
      onMessage('error', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        const message = d.message || 'An error occurred';
        dispatch({ type: 'ERROR', payload: { message } });
        useChatUIStore.getState().setPipelineState('error');
        toast.error('Error', message, TOAST_DURATION_MS);
      }),
      onMessage('transcript', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        if (d.is_final) {
          useChatUIStore.getState().setInterimTranscript('');
        } else {
          useChatUIStore.getState().setInterimTranscript(d.text || '');
        }
      }),
      // C1: Register handler for animation.timeline.v2 so the message is received
      // instead of being silently dropped. Forwards data to onAnimationTimeline callback.
      onMessage('animation.timeline.v2', (rawData: unknown) => {
        const d = validatePayload(rawData);
        if (!d || !checkSession(d)) return;
        const messageId = d.message_id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const timeline: unknown[] = (d as any).timeline ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meta: Record<string, unknown> = (d as any).meta ?? {};
        console.debug('[WS] animation.timeline.v2 received | message_id:', messageId, '| segments:', timeline.length);
        if (messageId && onAnimationTimeline) {
          onAnimationTimeline(messageId, timeline, meta);
        }
      }),
    ];
    return () => unsubs.forEach((fn) => fn?.());
  }, [
    onMessage,
    dispatch,
    currentSessionId,
    onTtsReady,
    onVisemesReady,
    forceAdvanceSequence,
    onAnimationTimeline,
  ]);

  const abortGeneration = useCallback(() => {
    safeSend({
      type: 'chat.abort',
      data: {
        session_id: currentSessionIdRef.current || undefined,
        message_id: conversationStateRef.current.activeMessageId || undefined
      }
    });

    const uiStore = useChatUIStore.getState();
    const currentText = uiStore.currentMessage || uiStore._buffer;
    const safeText = currentText ? currentText.replace(/\[.*?\]/g, '') : undefined;
    
    uiStore.commitFinal();
    uiStore.setPipelineState('idle');
    
    dispatch({ 
      type: 'CHAT_FINAL', 
      payload: { 
        message_id: conversationStateRef.current.activeMessageId,
        text: safeText 
      } 
    });
    dispatch({ type: 'PIPELINE_STATE', payload: { state: 'idle' } });
    
    if (safeText && conversationStateRef.current.activeMessageId && currentSessionIdRef.current) {
      sessionRef.current.addAssistantMessage(
        `${conversationStateRef.current.activeMessageId}-assistant`,
        safeText,
        currentSessionIdRef.current,
        new Date().toISOString()
      );
    }
  }, [safeSend, dispatch]);

  const wsClient = useMemo(() => ({ send: safeSend, onMessage }), [safeSend, onMessage]);

  return {
    conversationState,
    connectionState,
    isConnected,
    reconnect,
    reconnectError,
    disconnect,
    safeSend,
    commitAndSend,
    onMessage,
    wsClient,
    abortGeneration
  };
}
