import { toast } from '@/shared/utils/toast';
import { useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { LectureMultiSelect } from './LectureMultiSelect';

export default function QuizPage() {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleStartQuiz = () => {
    console.info('Selected lecture IDs for Quiz:', selectedIds);
    toast.info('Quiz generation will be implemented next', 3000);
  };

  /* TODO: Analytics - Knowledge-Gap Heatmap */
  /* TODO: Analytics - Confidence Bars */
  /* TODO: Analytics - RAG-Failure Chart */
  /* TODO: Analytics - Dashboard Wrapper */

  return (
    <div className="classroom-shell w-full h-full flex bg-[#0A0908]">
      <div className="relative flex-1 flex">
        <button
          className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 bg-transparent text-[#b0b0b0] border-none text-[0.95rem] font-medium cursor-pointer transition-colors duration-200 z-50 hover:text-white"
          onClick={() => navigate('/classroom')}
          aria-label="Back to classroom"
        >
          <FiArrowLeft /> Back to classroom
        </button>

        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto">
          {/* Quiz card */}
          <div className="relative bg-[#1a1a1a] border border-[#b4ab8b]/15 rounded-2xl p-12 w-full min-w-[320px] max-w-[640px] flex flex-col gap-8 shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute -top-12 -right-12 w-[200px] h-[200px] bg-[radial-gradient(circle,#6d001a_0%,transparent_70%)] blur-[60px] opacity-[0.15] pointer-events-none z-0" />

            <div className="relative z-[1]">
              <h1 className="font-display text-[2rem] font-bold text-white m-0">Take a Quiz</h1>
              <p className="text-[1rem] text-white/60 m-0 mt-1">Pick one or more lectures to generate questions from.</p>
            </div>

            <div className="mt-4 mb-4 max-h-[400px] overflow-y-auto relative z-[1]">
              <LectureMultiSelect selectedIds={selectedIds} onChange={setSelectedIds} />
            </div>

            <button
              className="relative z-[1] bg-gradient-to-br from-[#B4AB8B] to-[#C9C0A0] text-[#0A0908] font-semibold text-[1.125rem] h-14 rounded-xl transition-all duration-250 cursor-pointer border-none flex items-center justify-center shadow-[0_4px_14px_rgba(180,171,139,0.18)] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale disabled:shadow-none hover:not:disabled:-translate-y-0.5 hover:not:disabled:from-[#C9C0A0] hover:not:disabled:to-[#B4AB8B] hover:not:disabled:shadow-[0_6px_20px_rgba(180,171,139,0.3)] active:not:disabled:translate-y-0"
              onClick={handleStartQuiz}
              disabled={selectedIds.length === 0}
            >
              Start Quiz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
