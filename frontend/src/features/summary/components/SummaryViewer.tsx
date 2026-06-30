import React, { useRef, useEffect } from 'react';
import { FiX, FiFileText } from 'react-icons/fi';
import MarkdownRenderer from '@/shared/components/MarkdownRenderer';

interface SummaryViewerProps {
  summaryData: string;
  isLoading: boolean;
  onClose: () => void;
}

export function SummaryViewer({ summaryData, isLoading, onClose }: SummaryViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when generating
  useEffect(() => {
    if (isLoading && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [summaryData, isLoading]);

  return (
    <div className="w-full h-full relative flex flex-col bg-dark overflow-hidden">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-dark to-transparent z-40 flex items-center justify-between px-6 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center border border-gold/20 shadow-[0_0_15px_rgba(255,215,0,0.1)]">
            <FiFileText size={20} className="text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Document Summary</h2>
            <p className="text-xs text-white/50 font-medium">Auto-generated synopsis</p>
          </div>
        </div>
      </header>

      {/* Floating Overlay Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-dark/60 backdrop-blur-md border border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200"
        >
          <FiX size={18} />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full h-full relative z-10 pt-20 pb-6 px-6 lg:px-12 overflow-y-auto custom-scrollbar" ref={contentRef}>
        <div className="max-w-3xl mx-auto pb-20">
          <div className="bg-dark-secondary/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 lg:p-8 shadow-2xl">
            {summaryData ? (
              <MarkdownRenderer content={summaryData} streaming={isLoading} />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-white/40">
                <span className="animate-pulse">Analyzing document structure...</span>
              </div>
            )}
            
            {isLoading && summaryData && (
              <div className="mt-6 flex items-center gap-2 text-gold-soft text-sm font-medium animate-pulse">
                <div className="w-2 h-2 rounded-full bg-gold" />
                Generating summary...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
