import React, { RefObject } from 'react';
import { ExplainSession } from '@/features/explain/components/ExplainSession';
import { DiagramContainer } from '@/features/diagrams/components/DiagramContainer';
import { DocumentPicker } from '@/features/diagrams/components/DocumentPicker';
import { QuizContainer } from '@/features/quiz/components/QuizContainer';
import { MessageList, ChatInput } from '@/features/chat';
import { PresentationState } from '@/features/explain/hooks/useExplainWS';
import { ISession } from '@/features/session/types';

export type PipelineState = 'idle' | 'thinking' | 'speaking' | 'error';

export interface AssistantPanelProps {
  // Mode states
  isExplainActive: boolean;
  isDiagramOpen: boolean;
  isSummaryOpen: boolean;
  isQuizOpen?: boolean;
  
  // Explain Props
  explainDocumentId?: string;
  explainState: PresentationState;
  explainSlide: number;
  explainTotalSlides: number;
  explainContent: string;
  onExplainQuestion: (text: string) => void;
  onExplainContinue: () => void;
  onExplainPauseOrStop: () => void;
  onExplainClose: () => void;
  
  // Diagram Props
  onDiagramClose: () => void;

  // Summary Props
  onSummaryClose: () => void;
  onSummarizeDocument?: (filename: string) => void;

  // Quiz Props
  onQuizClose?: () => void;
  onStartQuizDocument?: (filename: string) => void;

  currentSessionId: string | null;
  
  // Chat Props
  messages?: ISession['messages'];
  currentMessage: string;
  interimTranscript: string;
  chatError: string | null;
  avatarName: string;
  chatScrollRef: RefObject<HTMLDivElement>;
  messagesEndRef: RefObject<HTMLDivElement>;
  onChatScroll: () => void;
  pipelineState: PipelineState | string;
  
  // Input Props
  inputValue: string;
  onInputChange: (val: string) => void;
  onSendMessage: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  onToggleDocuments: () => void;
  onBeforeVoiceStart: () => Promise<boolean>;
  onStop: () => void;
  wsClient?: any;
}

export function AssistantPanel({
  isExplainActive,
  isDiagramOpen,
  isSummaryOpen,
  explainDocumentId,
  explainState,
  explainSlide,
  explainTotalSlides,
  explainContent,
  onExplainQuestion,
  onExplainContinue,
  onExplainPauseOrStop,
  onExplainClose,
  onDiagramClose,
  onSummaryClose,
  onSummarizeDocument,
  isQuizOpen,
  onQuizClose,
  currentSessionId,
  messages,
  currentMessage,
  interimTranscript,
  chatError,
  avatarName,
  chatScrollRef,
  messagesEndRef,
  onChatScroll,
  pipelineState,
  inputValue,
  onInputChange,
  onSendMessage,
  onKeyDown,
  textareaRef,
  onToggleDocuments,
  onBeforeVoiceStart,
  onStop,
  wsClient
}: AssistantPanelProps) {
  if (isExplainActive) {
    return (
      <div className="flex-1 overflow-y-auto">
        <ExplainSession
          documentId={explainDocumentId || ''}
          currentState={explainState}
          currentSlide={explainSlide}
          totalSlides={explainTotalSlides}
          content={explainContent}
          onQuestion={onExplainQuestion}
          onContinue={onExplainContinue}
          onPauseOrStop={onExplainPauseOrStop}
          onClose={onExplainClose}
        />
      </div>
    );
  }

  if (isDiagramOpen) {
    return (
      <DiagramContainer
        isOpen={isDiagramOpen}
        onClose={onDiagramClose}
        sessionId={currentSessionId}
      />
    );
  }

  if (isSummaryOpen) {
    return (
      <div className="w-full h-full flex flex-col relative bg-dark-tertiary overflow-hidden min-w-0">
        <div className="w-full h-full overflow-y-auto p-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-2xl w-[600px] max-w-[90vw]">
            <DocumentPicker 
              title="Select Document to Summarize"
              buttonText="Summarize Document"
              sessionId={currentSessionId} 
              onSelect={(docId, filename) => {
                if (onSummarizeDocument) {
                  onSummarizeDocument(filename);
                }
              }} 
              onCancel={onSummaryClose} 
            />
          </div>
        </div>
      </div>
    );
  }

  if (isQuizOpen) {
    return (
      <QuizContainer 
        isOpen={isQuizOpen} 
        onClose={onQuizClose || (() => {})} 
        sessionId={currentSessionId} 
      />
    );
  }

  return (
    <>
      <MessageList
        messages={messages || []}
        currentMessage={currentMessage}
        interimTranscript={interimTranscript}
        error={chatError}
        avatarName={avatarName}
        chatScrollRef={chatScrollRef}
        messagesEndRef={messagesEndRef}
        onScroll={onChatScroll}
        pipelineState={pipelineState as any}
      />
      <div className="mt-auto">
        <ChatInput
          inputValue={inputValue}
          onInputChange={onInputChange}
          onSend={onSendMessage}
          onKeyDown={onKeyDown}
          textareaRef={textareaRef}
          pipelineState={pipelineState as any}
          onToggleDocuments={onToggleDocuments}
          onBeforeVoiceStart={onBeforeVoiceStart}
          onStop={onStop}
          wsClient={wsClient}
        />
      </div>
    </>
  );
}
