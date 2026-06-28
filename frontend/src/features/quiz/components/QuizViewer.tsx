import React, { useState, useEffect, useRef } from 'react';
import { QuizData, QuizQuestion } from '../hooks/useQuizSession';
import { FiCheckCircle, FiXCircle, FiBarChart2, FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import apiClient from '@/core/api/apiClient';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';

interface QuizViewerProps {
  quiz: QuizData;
  onRetake?: () => void;
  onViewAnalytics?: (attemptId: string) => void;
}

export function QuizViewer({ quiz, onRetake, onViewAnalytics }: QuizViewerProps) {
  // Telemetry state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});
  const [hesitations, setHesitations] = useState<Record<string, number>>({});

  // UI State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);

  // Timer Ref
  const startTimeRef = useRef<number>(Date.now());

  // Load from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`quiz_state_${quiz.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedAnswers) setSelectedAnswers(parsed.selectedAnswers);
        if (parsed.isSubmitted) setIsSubmitted(parsed.isSubmitted);
        if (parsed.attemptId) setAttemptId(parsed.attemptId);
      }
    } catch (e) {
      console.error('Failed to parse quiz state from sessionStorage', e);
    }
    startTimeRef.current = Date.now();
  }, [quiz.id]);

  // Save to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(
        `quiz_state_${quiz.id}`,
        JSON.stringify({ selectedAnswers, isSubmitted, attemptId })
      );
    } catch (e) {
      console.error('Failed to save quiz state to sessionStorage', e);
    }
  }, [selectedAnswers, isSubmitted, attemptId, quiz.id]);

  const commitTime = () => {
    if (isSubmitted) return;
    const qId = quiz.questions[currentQuestionIndex].id || quiz.questions[currentQuestionIndex].question_text;
    const elapsed = Date.now() - startTimeRef.current;
    setTimeSpent(prev => ({
      ...prev,
      [qId]: (prev[qId] || 0) + elapsed
    }));
  };

  const handleNext = () => {
    commitTime();
    setCurrentQuestionIndex(prev => Math.min(prev + 1, quiz.questions.length - 1));
    startTimeRef.current = Date.now();
  };

  const handlePrev = () => {
    commitTime();
    setCurrentQuestionIndex(prev => Math.max(prev - 1, 0));
    startTimeRef.current = Date.now();
  };

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (isSubmitted) return;

    setSelectedAnswers(prev => {
      // If there's an existing answer and it's different, count as hesitation
      if (prev[questionId] !== undefined && prev[questionId] !== optionIndex) {
        setHesitations(h => ({
          ...h,
          [questionId]: (h[questionId] || 0) + 1
        }));
      }
      return {
        ...prev,
        [questionId]: optionIndex
      };
    });
  };

  const executeSubmit = async () => {
    setIsConfirmSubmitOpen(false);
    setIsSubmitting(true);

    try {
      // Calculate score and build payload
      let score = 0;
      const answersPayload = quiz.questions.map(q => {
        const qId = q.id || q.question_text;
        const selected = selectedAnswers[qId];
        const isCorrect = selected === q.correct_option_index;
        if (isCorrect) score += 1;

        return {
          question_id: q.id,
          selected_option: selected !== undefined ? selected : null,
          is_correct: isCorrect,
          time_spent_ms: timeSpent[qId] || 0,
          hesitation_count: hesitations[qId] || 0
        };
      });

      const payload = {
        score,
        answers: answersPayload
      };

      const res = await apiClient.post(`/api/v1/rag/quiz/${quiz.id}/attempt`, payload);
      setAttemptId(res.data.attempt_id);
      setIsSubmitted(true);
      toast.success("Quiz submitted successfully!");
    } catch (error) {
      console.error("Failed to submit quiz attempt", error);
      toast.error("Failed to submit quiz attempt. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    commitTime();

    if (Object.keys(selectedAnswers).length < quiz.questions.length) {
      setIsConfirmSubmitOpen(true);
      startTimeRef.current = Date.now();
      return;
    }

    executeSubmit();
  };

  const score = quiz.questions.reduce((acc, q) => {
    const qId = q.id || q.question_text;
    return acc + (selectedAnswers[qId] === q.correct_option_index ? 1 : 0);
  }, 0);

  // If submitted, show full results page (scrollable)
  if (isSubmitted) {
    return (
      <div className="w-full max-w-3xl mx-auto py-8 px-4 flex flex-col gap-8 text-white/90">
        <div className="py-8 text-center animate-in fade-in zoom-in duration-300 border-b border-white/5 mb-8">
          <h3 className="text-xl font-bold mb-4">Your Score</h3>
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className={`text-4xl font-extrabold ${score > quiz.questions.length / 2 ? 'text-green-400' : 'text-red-400'}`}>
              {score}
            </span>
            <span className="text-2xl text-gray-500">/</span>
            <span className="text-2xl font-bold text-gray-300">{quiz.questions.length}</span>
          </div>

          <div className="flex justify-center gap-4">
            {attemptId && onViewAnalytics && (
              <button
                onClick={() => onViewAnalytics(attemptId)}
                className="flex items-center gap-2 px-6 py-3 bg-gold hover:bg-gold/90 text-black rounded-xl transition-colors font-bold text-sm shadow-lg shadow-gold/20"
              >
                <FiBarChart2 size={18} />
                View Deep Analytics
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {quiz.questions.map((q, idx) => {
            const qId = q.id || q.question_text;
            const selectedIdx = selectedAnswers[qId];
            const isCorrect = selectedIdx === q.correct_option_index;

            return (
              <div key={idx} className="py-6 border-b border-white/5 last:border-0">
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-gray-400">
                    {idx + 1}
                  </div>
                  <h4 className="text-base font-semibold leading-relaxed mt-1 text-white">{q.question_text}</h4>
                </div>

                <div className="flex flex-col gap-3 ml-12">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = selectedIdx === optIdx;
                    let optionStyles = "opacity-50";
                    if (optIdx === q.correct_option_index) {
                      optionStyles = "text-green-300";
                    } else if (isSelected && !isCorrect) {
                      optionStyles = "text-red-300";
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`text-left py-3 flex items-center gap-4 ${optionStyles}`}
                      >
                        <div className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center
                          ${optIdx === q.correct_option_index ? 'border-green-500 bg-green-500/20' : ''}
                          ${isSelected && !isCorrect ? 'border-red-500 bg-red-500/20' : ''}
                          ${!isSelected && optIdx !== q.correct_option_index ? 'border-white/20' : ''}
                        `}>
                          {optIdx === q.correct_option_index && <FiCheckCircle className="text-green-500" size={14} />}
                          {isSelected && !isCorrect && <FiXCircle className="text-red-500" size={14} />}
                        </div>
                        <span className="flex-1 leading-relaxed text-sm">{opt}</span>
                      </div>
                    );
                  })}
                </div>

                <div className={`mt-4 ml-12 pl-4 border-l-2 ${isCorrect ? 'border-green-500/50' : 'border-red-500/50'}`}>
                  <div className="flex items-center gap-2 mb-2 font-medium">
                    {isCorrect ? (
                      <span className="text-green-400 flex items-center gap-2"><FiCheckCircle /> Correct</span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-2"><FiXCircle /> Incorrect</span>
                    )}
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{q.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-4 mb-16">
          <button
            onClick={() => {
              sessionStorage.removeItem(`quiz_state_${quiz.id}`);
              setSelectedAnswers({});
              setIsSubmitted(false);
              setAttemptId(null);
              if (onRetake) onRetake();
            }}
            className="px-8 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors shadow-lg border border-white/10"
          >
            Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  // Active Quiz View (Paginated)
  const q = quiz.questions[currentQuestionIndex];
  const qId = q.id || q.question_text;
  const selectedIdx = selectedAnswers[qId];

  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-4 flex flex-col min-h-[500px] text-white/90">

      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-sm font-medium text-gray-400 mb-2">
          <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
          <span>{Math.round(((currentQuestionIndex + 1) / quiz.questions.length) * 100)}%</span>
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="py-4 animate-in slide-in-from-right-4 fade-in duration-300 relative flex flex-col w-full h-fit">
        <div className="flex items-start gap-4 mb-5">
          <h4 className="text-lg font-medium leading-snug text-white">{q.question_text}</h4>
        </div>

        <div className="flex flex-col gap-4">
          {q.options.map((opt, optIdx) => {
            const isSelected = selectedIdx === optIdx;
            return (
              <button
                key={optIdx}
                onClick={() => handleSelectOption(qId, optIdx)}
                className={`text-left py-4 px-2 border-b transition-colors duration-200 flex items-center gap-4 cursor-pointer
                  ${isSelected ? 'border-gold text-white' : 'border-white/5 hover:border-white/20'}
                `}
              >
                <div className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors
                  ${isSelected ? 'border-gold' : 'border-white/20'}
                `}>
                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-gold" />}
                </div>
                <span className="flex-1 leading-relaxed text-sm text-gray-300">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-8">
        <button
          onClick={handlePrev}
          disabled={currentQuestionIndex === 0}
          className="flex items-center gap-2 px-6 py-3 bg-white/5 text-white font-medium rounded-xl hover:bg-white/10 transition-colors disabled:opacity-30 disabled:hover:bg-white/5"
        >
          <FiArrowLeft /> Previous
        </button>

        {currentQuestionIndex < quiz.questions.length - 1 ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-colors shadow-lg"
          >
            Next <FiArrowRight />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-3 bg-gold hover:bg-gold-soft text-black font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? 'Submitting...' : (currentQuestionIndex === quiz.questions.length - 1 ? 'Submit Quiz' : 'Submit')}
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmSubmitOpen}
        title="Unanswered Questions"
        message="You haven't answered all questions. Are you sure you want to submit anyway?"
        confirmText="Submit Anyway"
        cancelText="Keep Answering"
        onConfirm={executeSubmit}
        onCancel={() => setIsConfirmSubmitOpen(false)}
        isDestructive={true}
      />
    </div>
  );
}
