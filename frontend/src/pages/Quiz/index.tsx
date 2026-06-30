import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { LectureMultiSelect } from './LectureMultiSelect';
import { toast } from '@/shared/utils/toast';
import styles from './Quiz.module.css';

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
          className={styles.backBtn}
          onClick={() => navigate('/classroom')}
          aria-label="Back to classroom"
        >
          <FiArrowLeft /> Back to classroom
        </button>

        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <div className={styles.quizCardContainer}>
            <h1 className={styles.quizTitle}>Take a Quiz</h1>
            <p className={styles.quizSubtitle}>Pick one or more lectures to generate questions from.</p>
            
            <div className={styles.selectContainer}>
              <LectureMultiSelect selectedIds={selectedIds} onChange={setSelectedIds} />
            </div>

            <button 
              className={styles.quizStartBtn}
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
