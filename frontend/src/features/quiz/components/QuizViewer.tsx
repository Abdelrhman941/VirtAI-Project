import React, { useState, useEffect } from 'react';
import { QuizData, QuizQuestion } from '../hooks/useQuizSession';
import { FiCheckCircle, FiXCircle, FiBarChart2 } from 'react-icons/fi';

interface QuizViewerProps {
  quiz: QuizData;
  onRetake?: () => void;
}

export function QuizViewer({ quiz, onRetake }: QuizViewerProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Load from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`quiz_state_${quiz.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedAnswers) setSelectedAnswers(parsed.selectedAnswers);
        if (parsed.isSubmitted) setIsSubmitted(parsed.isSubmitted);
      }
    } catch (e) {
      console.error('Failed to parse quiz state from sessionStorage', e);
    }
  }, [quiz.id]);

  // Save to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(
        `quiz_state_${quiz.id}`,
        JSON.stringify({ selectedAnswers, isSubmitted })
      );
    } catch (e) {
      console.error('Failed to save quiz state to sessionStorage', e);
    }
  }, [selectedAnswers, isSubmitted, quiz.id]);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (isSubmitted) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleSubmit = () => {
    if (Object.keys(selectedAnswers).length < quiz.questions.length) {
      // Could show a toast here to warn the user about unanswered questions
      if (!window.confirm("You haven't answered all questions. Submit anyway?")) {
        return;
      }
    }
    setIsSubmitted(true);
  };

  // // TODO (Tech Debt P3): Client-side evaluation is fragile and vulnerable to cheating. 
  // // In future versions, this should be sent to a backend endpoint like POST /api/v1/rag/quiz/{quizId}/attempt 
  // // which returns the score and explanations to prevent leaking correct answers to the client ahead of time.
  const score = quiz.questions.reduce((acc, q) => {
    const qId = q.id || q.question_text; // Fallback to text if id is missing
    return acc + (selectedAnswers[qId] === q.correct_option_index ? 1 : 0);
  }, 0);

  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-4 flex flex-col gap-8 text-white/90">
      
      {/* Result Card */}
      {isSubmitted && (
        <div className="bg-dark-secondary/50 border border-white/10 rounded-2xl p-6 text-center shadow-lg backdrop-blur-sm animate-in fade-in zoom-in duration-300">
          <h3 className="text-xl font-bold mb-4">Your Score</h3>
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className={`text-4xl font-extrabold ${score > quiz.questions.length / 2 ? 'text-green-400' : 'text-red-400'}`}>
              {score}
            </span>
            <span className="text-2xl text-gray-500">/</span>
            <span className="text-2xl font-bold text-gray-300">{quiz.questions.length}</span>
          </div>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                // Placeholder for future feature
                alert("More statistics will be available in future updates!");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors font-medium text-sm"
            >
              <FiBarChart2 />
              For More Stats
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="flex flex-col gap-8">
        {quiz.questions.map((q, idx) => {
          const qId = q.id || q.question_text;
          const selectedIdx = selectedAnswers[qId];
          const isCorrect = selectedIdx === q.correct_option_index;
          
          return (
            <div key={idx} className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-gray-400">
                  {idx + 1}
                </div>
                <h4 className="text-lg font-medium leading-relaxed mt-1">{q.question_text}</h4>
              </div>

              <div className="flex flex-col gap-3 ml-12">
                {q.options.map((opt, optIdx) => {
                  const isSelected = selectedIdx === optIdx;
                  let optionStyles = "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20";
                  
                  if (isSubmitted) {
                    if (optIdx === q.correct_option_index) {
                      optionStyles = "bg-green-500/10 border-green-500/50 text-green-300";
                    } else if (isSelected && !isCorrect) {
                      optionStyles = "bg-red-500/10 border-red-500/50 text-red-300";
                    } else {
                      optionStyles = "bg-white/5 border-transparent opacity-50";
                    }
                  } else if (isSelected) {
                    optionStyles = "bg-gold/10 border-gold/50 text-white";
                  }

                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleSelectOption(qId, optIdx)}
                      disabled={isSubmitted}
                      className={`text-left px-5 py-4 rounded-xl border transition-colors duration-200 flex items-center gap-4 ${optionStyles} ${!isSubmitted ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors
                        ${isSelected && !isSubmitted ? 'border-gold' : 'border-white/20'}
                        ${isSubmitted && optIdx === q.correct_option_index ? 'border-green-500 bg-green-500/20' : ''}
                        ${isSubmitted && isSelected && !isCorrect ? 'border-red-500 bg-red-500/20' : ''}
                      `}>
                        {isSelected && !isSubmitted && <div className="w-2.5 h-2.5 rounded-full bg-gold" />}
                        {isSubmitted && optIdx === q.correct_option_index && <FiCheckCircle className="text-green-500" size={14} />}
                        {isSubmitted && isSelected && !isCorrect && <FiXCircle className="text-red-500" size={14} />}
                      </div>
                      <span className="flex-1 leading-relaxed">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {isSubmitted && (
                <div className={`mt-6 ml-12 p-4 rounded-xl border ${isCorrect ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                  <div className="flex items-center gap-2 mb-2 font-medium">
                    {isCorrect ? (
                      <span className="text-green-400 flex items-center gap-2"><FiCheckCircle /> Correct</span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-2"><FiXCircle /> Incorrect</span>
                    )}
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex justify-end mt-4 mb-16">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            className="px-8 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-colors shadow-lg disabled:opacity-50"
          >
            Submit Quiz
          </button>
        ) : (
          <button
            onClick={() => {
              // Clear session storage and reset
              sessionStorage.removeItem(`quiz_state_${quiz.id}`);
              setSelectedAnswers({});
              setIsSubmitted(false);
              if (onRetake) onRetake();
            }}
            className="px-8 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors shadow-lg border border-white/10"
          >
            Retake Quiz
          </button>
        )}
      </div>
    </div>
  );
}
