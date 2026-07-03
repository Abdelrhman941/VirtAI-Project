import React, { useEffect, useRef } from 'react';
import { FiPauseCircle, FiStopCircle } from 'react-icons/fi';
import { StreamingMarkdownRenderer } from '@/shared/markdown';
import type { PresentationState } from '../hooks/useExplainWS';
import { SlideQuestionInput } from './SlideQuestionInput';

interface ExplainSessionProps {
  documentId: string;
  currentState: PresentationState;
  currentSlide: number;
  totalSlides: number;
  content: string;
  onQuestion: (text: string) => void;
  onContinue: () => void;
  onPauseOrStop: () => void;
  onClose: () => void;
}

export function ExplainSession({
  currentState,
  currentSlide,
  totalSlides,
  content,
  onQuestion,
  onContinue,
  onPauseOrStop,
  onClose,
}: ExplainSessionProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  const progressScale = totalSlides > 0 ? (currentSlide + 1) / totalSlides : 0;

  return (
    <div className="flex h-full flex-col bg-dark">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div>
          <span className="inline-block rounded-full bg-gold/10 border border-gold/30 px-3 py-0.5 text-[11px] font-medium tracking-wide text-gold-soft">
            Presentation Mode
          </span>
          <h2 className="mt-2 text-lg font-semibold text-offwhite">
            Slide {currentSlide + 1} {totalSlides > 0 ? `of ${totalSlides}` : ''}
          </h2>
        </div>
      </header>

      <div className="h-[3px] bg-white/5 overflow-hidden">
        {/* Progress uses a dynamic transform → must remain inline. */}
        <div
          className="h-full bg-gold origin-left transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${progressScale})` }}
        />
      </div>

      <div ref={contentRef} className="slide-mode flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <StreamingMarkdownRenderer
            content={content || 'Analyzing slide context and preparing instructional content...'}
            streaming={currentState === 'EXPLAINING'}
            variant="explain"
          />
        </div>
      </div>

      <div className="flex flex-col p-4 bg-black/20">
        {currentState === 'AWAITING' && (
          <SlideQuestionInput onQuestion={onQuestion} onContinue={onContinue} />
        )}

        <div className="flex items-center justify-between w-full mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span
              className={
                'w-2 h-2 rounded-full ' +
                (currentState === 'EXPLAINING'
                  ? 'bg-gold animate-pulse'
                  : currentState === 'AWAITING'
                    ? 'bg-white/40'
                    : 'bg-crimson-glow animate-pulse')
              }
            />
            {currentState === 'EXPLAINING' && 'Delivering presentation analysis...'}
            {currentState === 'AWAITING' && 'Awaiting educator inquiry...'}
            {currentState === 'ANSWERING' && 'Synthesizing explanation...'}
          </div>

          <div className="flex gap-3">
            {currentState !== 'AWAITING' && (
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-white/90 backdrop-blur-sm transition-[background-color,border-color,transform] duration-300 hover:bg-gold/5 hover:border-gold/30 hover:text-gold-soft hover:scale-[1.02]"
                onClick={onPauseOrStop}
                title="Pause / Interrupt"
              >
                <FiPauseCircle size={18} /> Pause
              </button>
            )}
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-white/90 backdrop-blur-sm transition-[background-color,border-color,transform] duration-300 hover:bg-crimson/15 hover:text-crimson-glow hover:border-crimson/40 hover:scale-[1.02]"
              onClick={onClose}
              title="Stop Presentation"
            >
              <FiStopCircle size={18} /> Stop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
