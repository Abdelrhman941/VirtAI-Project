import React from 'react';
import { useQuizSession } from '../hooks/useQuizSession';
import { QuizViewer } from './QuizViewer';
import { QuizDashboard } from './Dashboard/QuizDashboard';
import { DocumentPicker } from '@/features/diagrams/components/DocumentPicker';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';

interface QuizContainerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
}

export function QuizContainer({ isOpen, onClose, sessionId }: QuizContainerProps) {
  const { state, quizData, error, startQuiz, reset } = useQuizSession();
  const [dashboardAttemptId, setDashboardAttemptId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectDocument = (documentId: string) => {
    startQuiz(documentId);
  };

  const handleClose = () => {
    reset();
    setDashboardAttemptId(null);
    onClose();
  };

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden min-w-0">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-dark-secondary/50 shrink-0">
        <h2 className="text-white/90 font-medium">Knowledge Check</h2>
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          ×
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col relative">
        
        {state === 'idle' && (
          <div className="w-full h-full p-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-2xl w-[600px] max-w-[90vw]">
              <DocumentPicker 
                title="Select Document for Quiz"
                buttonText="Generate Quiz"
                sessionId={sessionId} 
                onSelect={handleSelectDocument} 
                onCancel={handleClose} 
              />
            </div>
          </div>
        )}

        {state === 'generating' && (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/70">
            <FiLoader className="animate-spin mb-4" size={32} />
            <p className="text-lg font-medium">Generating your quiz...</p>
            <p className="text-sm opacity-50 mt-2">Our AI is analyzing the document to create meaningful questions.</p>
          </div>
        )}

        {state === 'error' && (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/70">
            <FiAlertCircle className="text-red-400 mb-4" size={48} />
            <p className="text-lg font-medium text-red-400 mb-2">Failed to generate quiz</p>
            <p className="text-sm opacity-50 max-w-md text-center">{error}</p>
            <button
              onClick={reset}
              className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {state === 'ready' && quizData && (
          dashboardAttemptId ? (
            <QuizDashboard 
              quizId={quizData.id} 
              attemptId={dashboardAttemptId} 
              onBack={() => setDashboardAttemptId(null)} 
            />
          ) : (
            <QuizViewer 
              quiz={quizData} 
              onRetake={reset} 
              onViewAnalytics={(attemptId) => setDashboardAttemptId(attemptId)}
            />
          )
        )}

      </div>
    </div>
  );
}
