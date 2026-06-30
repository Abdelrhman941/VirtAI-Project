import { ChatInput, MessageList } from '@/features/chat';
import { DiagramContainer } from '@/features/diagrams/components/DiagramContainer';
import { DocumentsDrawer } from '@/features/documents/components/DocumentsDrawer';
import { useDocumentList } from '@/features/documents/useDocumentList';
import { ExplainSession } from '@/features/explain/components/ExplainSession';
import { PresentationState, useExplainWS } from '@/features/explain/hooks/useExplainWS';
import { SettingsDrawer, useSessionManager } from '@/features/session';
import { PCMRecorder } from '@/features/voice/audio/pcmRecorder';
import { toast } from '@/shared/utils/toast';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { AssistantPanel } from './AssistantPanel';

const AvatarCanvasWrapper = lazy(() => import('./AvatarCanvasWrapper').then(m => ({ default: m.AvatarCanvasWrapper })));
import { AvatarTopBar } from './AvatarTopBar';
import { SCROLL_STICK_THRESHOLD_PX } from './constants';
import { useClassroomAudio } from './hooks/useClassroomAudio';
import { useClassroomChat } from './hooks/useClassroomChat';
import { useClassroomState } from './hooks/useClassroomState';
import { useChatUIStore } from '@/features/chat/store/useChatUIStore';

import { FiMonitor, FiShare2, FiEdit3, FiMessageSquare, FiFileText } from 'react-icons/fi';
import { ErrorState } from '@/shared/components/UIStates';

import { AudioVisemePacket, VisemeSchema, Viseme, PendingFirstMessage, WSPayloadSchema, WSPayload } from './types';

export default function ClassroomShell() {
  const { sessionId: urlSessionId } = useParams();
  const navigate = useNavigate();

  const {
    activeAvatarId,
    activeVoiceId,
    movementEnabled,
    avatarName,
    isSettingsOpen,
    isDocumentsOpen,
    sidebarWidth,
    setSidebarWidth,
    openSettings,
    closeSettings,
    toggleDocuments,
  } = useClassroomState();

  const session = useSessionManager(urlSessionId, navigate);
  const currentSessionId = session.currentSessionId;
  const currentSession = session.currentSession;
  const status = session.status;

  const { documents } = useDocumentList(currentSessionId);
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);

  const handleGenerateDiagram = () => {
    setIsDiagramOpen(true);
  };

  const handleGenerateSummary = () => {
    setIsSummaryOpen(true);
  };

  const handleGenerateQuiz = () => {
    setIsQuizOpen(true);
  };

  const {
    mouthCuesRef,
    getAudioContext,
    unlockAudioContext,
    playbackStartTimeRef,
    handleTtsReady,
    handleVisemesReady,
    forceAdvanceSequence,
    resetAvatarAudio,
    getIsAudioPlaying,
    getNextPlaybackTime,
    getAnalyserNode
  } = useClassroomAudio();

  const [isExplainActive, setIsExplainActive] = useState(false);
  const [explainContent, setExplainContent] = useState('');
  const [explainState, setExplainState] = useState<PresentationState>('EXPLAINING');
  const [explainSlide, setExplainSlide] = useState(0);
  const [explainTotalSlides, setExplainTotalSlides] = useState(0);

  const {
    isConnected: isExplainConnected,
    sendQuestion: explainSendQuestion,
    sendContinue: explainSendContinue,
    sendPauseOrStop: explainSendPauseOrStop,
    disconnect: explainDisconnect
  } = useExplainWS({
    documentId: isExplainActive && documents.length > 0 ? documents[0].id : null,
    onTokens: (tokens) => {
      setExplainContent(prev => prev + tokens);
    },
    onStateChange: (state) => {
      setExplainState(state);
    },
    onSlideChange: (index, total) => {
      setExplainSlide(index);
      setExplainTotalSlides(total);
      setExplainContent('');
    },
    onEnd: () => {
      setIsExplainActive(false);
    }
  });

  const handleStartExplain = useCallback(() => {
    setIsExplainActive(true);
    setExplainContent('');
  }, []);

  const handleExplainQuestion = useCallback((text: string) => {
    explainSendQuestion(text);
    setExplainContent(prev => prev + `\n\n**You:** ${text}\n\n`);
    resetAvatarAudio();
  }, [explainSendQuestion, resetAvatarAudio]);

  const handleExplainContinue = useCallback(() => {
    explainSendContinue();
    resetAvatarAudio();
  }, [explainSendContinue, resetAvatarAudio]);

  const handleExplainPauseOrStop = useCallback(() => {
    explainSendPauseOrStop();
    resetAvatarAudio();
  }, [explainSendPauseOrStop, resetAvatarAudio]);

  const handleExplainClose = useCallback(() => {
    setIsExplainActive(false);
    explainDisconnect();
    resetAvatarAudio();
  }, [explainDisconnect, resetAvatarAudio]);

  const handleDiagramClose = useCallback(() => setIsDiagramOpen(false), []);
  const handleSummaryClose = useCallback(() => setIsSummaryOpen(false), []);
  const handleQuizClose = useCallback(() => setIsQuizOpen(false), []);

  const {
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
  } = useClassroomChat({
    wsAvatarId: activeAvatarId,
    activeVoiceId,
    session,
    onTtsReady: handleTtsReady,
    onVisemesReady: handleVisemesReady as any,
    forceAdvanceSequence,
    resetAvatarAudio,
    getAudioContext
  });

  const handleClearAllSessions = useCallback(async () => {
    disconnect();
    await session.clearAllSessions();
  }, [disconnect, session]);

  const handleSummarizeDocument = useCallback((filename: string) => {
    setIsSummaryOpen(false);
    commitAndSend(`Please summarize the document: ${filename}`);
  }, [commitAndSend]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) {
      disconnect();
    }
    await session.deleteSession(sessionId);
  }, [disconnect, session, currentSessionId]);

  // Desktop Refs
  const desktopMessagesEndRef = useRef<HTMLDivElement>(null);
  const desktopChatScrollRef = useRef<HTMLDivElement>(null);
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Mobile Refs
  const mobileMessagesEndRef = useRef<HTMLDivElement>(null);
  const mobileChatScrollRef = useRef<HTMLDivElement>(null);
  const mobileTextareaRef = useRef<HTMLTextAreaElement>(null);

  const shouldStickToBottom = useRef<boolean>(true);

  // Helper to get currently active/visible refs
  const getActiveRefs = useCallback(() => {
    if (desktopChatScrollRef.current && desktopChatScrollRef.current.clientHeight > 0) {
      return {
        chatScrollRef: desktopChatScrollRef,
        messagesEndRef: desktopMessagesEndRef,
        textareaRef: desktopTextareaRef
      };
    }
    return {
      chatScrollRef: mobileChatScrollRef,
      messagesEndRef: mobileMessagesEndRef,
      textareaRef: mobileTextareaRef
    };
  }, []);
  const scrollPositionsRef = useRef<Map<string | null, number>>(new Map());
  const prevSessionIdRef = useRef<string | null>(currentSessionId);
  const isCreatingSessionRef = useRef<boolean>(false);

  useEffect(() => {
    const prevId = prevSessionIdRef.current;
    const nextId = currentSessionId;
    if (prevId !== nextId) {
      resetAvatarAudio();

      const { chatScrollRef } = getActiveRefs();
      if (chatScrollRef.current) {
        scrollPositionsRef.current.set(prevId, chatScrollRef.current.scrollTop);
      }
      requestAnimationFrame(() => {
        const saved = scrollPositionsRef.current.get(nextId);
        const { chatScrollRef: activeRef } = getActiveRefs();
        if (activeRef.current && saved !== null && saved !== undefined) {
          activeRef.current.scrollTop = saved;
          shouldStickToBottom.current = false;
        } else {
          shouldStickToBottom.current = true;
        }
      });
      prevSessionIdRef.current = nextId;
    }
  }, [currentSessionId, resetAvatarAudio, getActiveRefs]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleOpenSessions = () => openSettings();
    window.addEventListener('open-sessions', handleOpenSessions);
    return () => window.removeEventListener('open-sessions', handleOpenSessions);
  }, [openSettings]);

  const handleChatScroll = useCallback(() => {
    const { chatScrollRef } = getActiveRefs();
    const el = chatScrollRef.current;
    if (!el) return;

    // Add a small 1px buffer to account for subpixel rendering issues
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_STICK_THRESHOLD_PX + 1;
    shouldStickToBottom.current = isAtBottom;
  }, [getActiveRefs]);

  const prevMessagesLength = useRef(currentSession?.messages?.length || 0);
  const prevPipelineState = useRef(conversationState.pipelineState);

  useLayoutEffect(() => {
    const { chatScrollRef, messagesEndRef } = getActiveRefs();
    const el = chatScrollRef.current;
    const endEl = messagesEndRef.current;
    if (!el || !endEl) return;

    const currentLength = currentSession?.messages?.length || 0;
    const isNewMessage = currentLength > prevMessagesLength.current;
    const isNewThinkingState = conversationState.pipelineState === 'thinking' && prevPipelineState.current !== 'thinking';

    prevMessagesLength.current = currentLength;
    prevPipelineState.current = conversationState.pipelineState;

    // Force stick to bottom when a new message block or thinking bubble appears
    if (isNewMessage || isNewThinkingState) {
      shouldStickToBottom.current = true;
    }

    if (shouldStickToBottom.current) {
      // Determine if we are actively streaming high-frequency chunks
      // Check Zustand store directly since we removed it from React state
      const isStreaming = !!useChatUIStore.getState().currentMessage || !!useChatUIStore.getState().interimTranscript;

      // Use 'auto' during streaming to prevent browser smooth-scroll cancellation (jitter/stuck).
      // Use 'smooth' for new message initialization or when thinking state starts for premium UX.
      const behavior = (isNewMessage || isNewThinkingState) && !isStreaming ? 'smooth' : 'auto';

      endEl.scrollIntoView({ behavior, block: 'end' });
    }
  }, [
    currentSession?.messages,
    conversationState.pipelineState,
    getActiveRefs
  ]);

  const handleStop = useCallback(() => {
    abortGeneration();
    resetAvatarAudio(conversationState.activeMessageId);
  }, [abortGeneration, resetAvatarAudio, conversationState.activeMessageId]);

  useEffect(() => {
    const handleVoiceBargeIn = () => {
      handleStop();
    };
    window.addEventListener('voice-barge-in', handleVoiceBargeIn);
    return () => window.removeEventListener('voice-barge-in', handleVoiceBargeIn);
  }, [handleStop]);

  const handleSendMessage = useCallback((text?: string) => {
    const payload = text?.trim();
    if (!payload) return;

    // Await audio context unlock so it's strictly bound to this gesture
    unlockAudioContext().catch(console.warn);

    // Force scroll to bottom when user explicitly sends a message
    shouldStickToBottom.current = true;

    commitAndSend(payload);

    const { textareaRef } = getActiveRefs();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    if (!isConnected && currentSessionId !== null) {
      toast.warning('Offline', 'Message queued. Will send when connected.', 3000);
    }
  }, [isConnected, currentSessionId, commitAndSend, getActiveRefs]);



  const ensureVoiceSession = useCallback(async () => {
    PCMRecorder.preWarmWorklet();
    await unlockAudioContext();

    if (currentSessionId) return true;
    if (isCreatingSessionRef.current) return false;

    isCreatingSessionRef.current = true;
    try {
      const activeId = await session.createPersistedSession();
      if (!activeId) {
        toast.error('Error', 'Failed to initialize voice session');
        return false;
      }
      return true;
    } finally {
      isCreatingSessionRef.current = false;
    }
  }, [currentSessionId, session, getAudioContext]);

  if (status === 'error') {
    return (
      <div className="flex flex-col h-screen bg-dark text-white">
        <ErrorState
          title="Classroom Session Load Failure"
          message="We encountered an issue retrieving your academic sessions. This may be due to a temporary network disruption or an expired security token."
          isAbsolute={false}
          action={
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-full bg-gold text-[#0A0908] font-semibold text-sm hover:bg-gold-soft hover:scale-[1.02] active:scale-[0.98] transition-colors duration-200 cursor-pointer shadow-lg"
            >
              Reload Classroom
            </button>
          }
        />
      </div>
    );
  }

  const isSidebarOpen = isSettingsOpen || isDocumentsOpen;

  const chatWsClient = {
    connectionState,
    isConnected,
    send: safeSend,
    onMessage,
    currentSessionId,
  };

  const pipelineState = useChatUIStore((s) => s.pipelineState);

  return (
    <>
      <Helmet>
        <title>{avatarName} — VirtAI Classroom</title>
      </Helmet>

      {/* Root Layout: Handled by AppLayout, we just provide the full width/height container */}
      <div className="flex w-full h-full relative text-white font-sans">

        {/* Floating Sidebars/Drawers */}
        <SettingsDrawer
          isOpen={isSettingsOpen}
          onClose={closeSettings}
          sessions={session.sessions}
          currentSessionId={currentSessionId}
          onSessionSelect={session.switchSession}
          onNewSession={session.createNewSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={session.renameSession}
          onClearAllSessions={handleClearAllSessions}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          resizable={true}
        />
        <DocumentsDrawer
          isOpen={isDocumentsOpen}
          onClose={toggleDocuments}
          sessionId={currentSessionId}
          onEnsureSession={session.createPersistedSession}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          resizable={true}
        />

        {/* Main Content Area */}
        <main
          className="flex flex-col flex-1 gap-4 p-4 lg:p-6 lg:gap-8 relative min-w-0"
          style={{ marginRight: isSidebarOpen && (typeof window !== 'undefined' && window.innerWidth >= 1024) ? `${sidebarWidth}px` : '0' }}
        >

          {/* Top Navbar */}
          <AvatarTopBar
            avatarName={avatarName || 'AI Tutor'}
            connectionState={connectionState}
            currentSessionId={currentSessionId}
            reconnectError={reconnectError}
            reconnect={reconnect}
            hasDocuments={documents.length > 0}
            hasMessages={currentSession?.messages?.length ? currentSession.messages.length > 0 : false}
            onGenerateDiagram={handleGenerateDiagram}
            onGenerateSummary={handleGenerateSummary}
            onStartExplain={handleStartExplain}
            onStartQuiz={handleGenerateQuiz}
            onOpenSettings={openSettings}
          />

          {/* Desktop Content Layout (lg screens and up) */}
          <div className="hidden lg:flex flex-row w-full flex-1 min-h-0 gap-6">

            {/* Avatar Panel (Left) */}
            <aside className="flex-[3] min-w-0 min-h-0 relative overflow-hidden flex items-center justify-center bg-dark-secondary/50 backdrop-blur-md border border-white/5 rounded-2xl shadow-xl">
              <Suspense fallback={<div className="w-full h-full animate-pulse bg-white/5 rounded-2xl" />}>
                <AvatarCanvasWrapper
                  avatarId={activeAvatarId}
                  pipelineState={conversationState.pipelineState}
                  movementEnabled={movementEnabled}
                  mouthCuesRef={mouthCuesRef}
                  getAudioContext={getAudioContext}
                  playbackStartTimeRef={playbackStartTimeRef}
                  getIsAudioPlaying={getIsAudioPlaying}
                  getNextPlaybackTime={getNextPlaybackTime}
                  getAnalyserNode={getAnalyserNode}
                />
              </Suspense>
            </aside>

            {/* Chat Panel (Right) */}
            <section className="flex-[7] min-w-0 min-h-0 flex flex-col relative bg-dark-secondary/50 backdrop-blur-md border border-white/5 rounded-2xl shadow-xl">
              <AssistantPanel
                isExplainActive={isExplainActive}
                isDiagramOpen={isDiagramOpen}
                isSummaryOpen={isSummaryOpen}
                explainDocumentId={documents.length > 0 ? documents[0].id : undefined}
                explainState={explainState}
                explainSlide={explainSlide}
                explainTotalSlides={explainTotalSlides}
                explainContent={explainContent}
                onExplainQuestion={handleExplainQuestion}
                onExplainContinue={handleExplainContinue}
                onExplainPauseOrStop={handleExplainPauseOrStop}
                onExplainClose={handleExplainClose}
                onDiagramClose={handleDiagramClose}
                onSummaryClose={handleSummaryClose}
                onSummarizeDocument={handleSummarizeDocument}
                isQuizOpen={isQuizOpen}
                onQuizClose={handleQuizClose}
                currentSessionId={currentSessionId}
                messages={currentSession?.messages}
                chatError={conversationState.error}
                avatarName={avatarName}
                chatScrollRef={desktopChatScrollRef}
                messagesEndRef={desktopMessagesEndRef}
                onChatScroll={handleChatScroll}
                pipelineState={pipelineState}
                onSendMessage={handleSendMessage}

                textareaRef={desktopTextareaRef}
                onToggleDocuments={toggleDocuments}
                onBeforeVoiceStart={ensureVoiceSession}
                onStop={handleStop}
                wsClient={chatWsClient}
              />
            </section>

          </div>

          {/* Mobile Content Layout (sm/md screens: hidden on lg) */}
          <div className="flex lg:hidden flex-col w-full flex-1 min-h-0 gap-4 pb-16">

            {/* Avatar Container: exactly 40% of available height */}
            <aside className="h-[40%] min-h-0 relative overflow-hidden flex items-center justify-center bg-dark-secondary/50 backdrop-blur-md border border-white/5 rounded-2xl shadow-xl mx-4">
              <Suspense fallback={<div className="w-full h-full animate-pulse bg-white/5 rounded-2xl" />}>
                <AvatarCanvasWrapper
                  avatarId={activeAvatarId}
                  pipelineState={conversationState.pipelineState}
                  movementEnabled={movementEnabled}
                  mouthCuesRef={mouthCuesRef}
                  getAudioContext={getAudioContext}
                  playbackStartTimeRef={playbackStartTimeRef}
                  getIsAudioPlaying={getIsAudioPlaying}
                  getNextPlaybackTime={getNextPlaybackTime}
                  getAnalyserNode={getAnalyserNode}
                />
              </Suspense>
            </aside>

            {/* Chat Container: remaining 60% height */}
            <section className="h-[60%] min-h-0 flex flex-col relative bg-dark-secondary/50 backdrop-blur-md border border-white/5 rounded-2xl shadow-xl mx-4">
              <AssistantPanel
                isSummaryOpen={isSummaryOpen}
                onSummaryClose={handleSummaryClose}
                isExplainActive={isExplainActive}
                isDiagramOpen={isDiagramOpen}
                explainDocumentId={documents.length > 0 ? documents[0].id : undefined}
                explainState={explainState}
                explainSlide={explainSlide}
                explainTotalSlides={explainTotalSlides}
                explainContent={explainContent}
                onExplainQuestion={handleExplainQuestion}
                onExplainContinue={handleExplainContinue}
                onExplainPauseOrStop={handleExplainPauseOrStop}
                onExplainClose={handleExplainClose}
                onDiagramClose={handleDiagramClose}
                onSummarizeDocument={handleSummarizeDocument}
                isQuizOpen={isQuizOpen}
                onQuizClose={handleQuizClose}
                currentSessionId={currentSessionId}
                messages={currentSession?.messages}
                chatError={conversationState.error}
                avatarName={avatarName}
                chatScrollRef={mobileChatScrollRef}
                messagesEndRef={mobileMessagesEndRef}
                onChatScroll={handleChatScroll}
                pipelineState={pipelineState}
                onSendMessage={handleSendMessage}

                textareaRef={mobileTextareaRef}
                onToggleDocuments={toggleDocuments}
                onBeforeVoiceStart={ensureVoiceSession}
                onStop={handleStop}
                wsClient={chatWsClient}
              />
            </section>

          </div>

          {/* Fixed Bottom Navigation Bar (Mobile Only) */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-dark/95 backdrop-blur-md border-t border-gold/15 flex items-center justify-around px-4 z-[100]">
            {/* Chat Tab */}
            <button
              onClick={() => {
                setIsExplainActive(false);
                setIsDiagramOpen(false);
              }}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 cursor-pointer transition-colors duration-200 ${
                (!isExplainActive && !isDiagramOpen)
                  ? 'text-gold'
                  : 'text-gray-400 active:text-white'
              }`}
            >
              <FiMessageSquare size={20} />
              <span className="text-[10px] font-semibold tracking-wide font-display">Chat</span>
            </button>

            {/* Explain Tab */}
            <button
              onClick={handleStartExplain}
              disabled={!documents.length}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 cursor-pointer transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
                isExplainActive
                  ? 'text-gold font-bold'
                  : 'text-gray-400 active:text-white'
              }`}
            >
              <FiMonitor size={20} />
              <span className="text-[10px] font-semibold tracking-wide font-display">Explain</span>
            </button>

            {/* Diagram Tab */}
            <button
              onClick={handleGenerateDiagram}
              disabled={!documents.length}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 cursor-pointer transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
                isDiagramOpen
                  ? 'text-gold font-bold'
                  : 'text-gray-400 active:text-white'
              }`}
            >
              <FiShare2 size={20} />
              <span className="text-[10px] font-semibold tracking-wide font-display">Diagram</span>
            </button>

            {/* Summary Tab */}
            <button
              onClick={handleGenerateSummary}
              disabled={!documents.length}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 cursor-pointer transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
                isSummaryOpen
                  ? 'text-gold font-bold'
                  : 'text-gray-400 active:text-white'
              }`}
            >
              <FiFileText size={20} />
              <span className="text-[10px] font-semibold tracking-wide font-display">Summary</span>
            </button>

            {/* Quiz Tab */}
            <button
              onClick={handleGenerateQuiz}
              disabled={!documents.length}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 cursor-pointer transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
                isQuizOpen
                  ? 'text-gold font-bold'
                  : 'text-gray-400 active:text-white'
              }`}
            >
              <FiEdit3 size={20} />
              <span className="text-[10px] font-semibold tracking-wide font-display">Quiz</span>
            </button>
          </nav>

        </main>
      </div>
    </>
  );
}
