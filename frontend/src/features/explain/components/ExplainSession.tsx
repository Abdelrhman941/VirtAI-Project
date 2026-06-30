import React, { useEffect, useState } from 'react';
import MarkdownRenderer from '../../../shared/components/MarkdownRenderer';
import { FiStopCircle, FiPauseCircle } from 'react-icons/fi';
import { PresentationState } from '../hooks/useExplainWS';
import { SlideQuestionInput } from './SlideQuestionInput';
import './ExplainSession.css';

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
  documentId,
  currentState,
  currentSlide,
  totalSlides,
  content,
  onQuestion,
  onContinue,
  onPauseOrStop,
  onClose
}: ExplainSessionProps) {
  // Auto-scroll to bottom of content
  const contentRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <div className="explain-session-container">
      <div className="explain-header">
        <div className="explain-title">
          <div><span className="explain-pill-badge">Presentation Mode</span></div>
          <h2 className="explain-progress">
            Slide {currentSlide + 1} {totalSlides > 0 ? `of ${totalSlides}` : ''}
          </h2>
        </div>
      </div>
      
      <div className="explain-progress-bar-container">
        <div 
          className="explain-progress-bar" 
          style={{ transform: `scaleX(${totalSlides > 0 ? (currentSlide + 1) / totalSlides : 0})` }} 
        />
      </div>

      <div className="explain-content" ref={contentRef}>
        <div className="explain-content-wrapper">
          <div className="markdown-body">
            <MarkdownRenderer
              content={content || "Analyzing slide context and preparing instructional content..."}
              streaming={currentState === 'EXPLAINING'}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col p-4 bg-black/20">
        {currentState === 'AWAITING' && (
          <SlideQuestionInput onQuestion={onQuestion} onContinue={onContinue} />
        )}
        
        <div className="flex items-center justify-between w-full mt-4 pt-4 border-t border-white/5">
          <div className="explain-status-indicator">
            <span className={`status-dot ${currentState.toLowerCase()}`}></span>
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
