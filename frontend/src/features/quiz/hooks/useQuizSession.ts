import { useState, useCallback } from 'react';
import { z } from 'zod';
import { toast } from '@/shared/utils/toast';
import apiClient from '@/core/api/apiClient';

export const QuizQuestionSchema = z.object({
  id: z.string().optional(),
  question_text: z.string(),
  options: z.array(z.string()).min(2),
  correct_option_index: z.number().int().min(0),
  explanation: z.string(),
  citations: z.array(z.number()).optional(),
});

export const QuizSchema = z.object({
  id: z.string(),
  document_id: z.string(),
  questions: z.array(QuizQuestionSchema).min(1),
});

export type QuizData = z.infer<typeof QuizSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

type QuizState = 'idle' | 'generating' | 'ready' | 'error';

export function useQuizSession() {
  const [state, setState] = useState<QuizState>('idle');
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startQuiz = useCallback(async (documentId: string) => {
    setState('generating');
    setError(null);
    setQuizData(null);

    try {
      // 1. Trigger Generation
      const postRes = await apiClient.post<{ quiz_id: string }>(`/rag/quiz/${documentId}?num_questions=5`);
      const quizId = postRes.data.quiz_id;

      if (!quizId) {
        throw new Error('No quiz_id returned from server');
      }

      // 2. Poll for results (Addressing Architect P1: Polling mechanism)
      let attempts = 0;
      const maxAttempts = 10;
      let fetchedQuiz: any = null;

      while (attempts < maxAttempts) {
        try {
          const getRes = await apiClient.get(`/rag/quiz/${quizId}`);
          fetchedQuiz = getRes.data;
          if (fetchedQuiz && fetchedQuiz.questions && fetchedQuiz.questions.length > 0) {
            break; // Quiz is ready
          }
        } catch (e) {
          // Ignore 404s while polling
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Quiz generation timed out or failed to complete.');
        }
        // Wait 3 seconds before polling again
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // 3. Zod Validation (Addressing Architect P3: LLM Hallucinations)
      try {
        const validatedQuiz = QuizSchema.parse(fetchedQuiz);
        setQuizData(validatedQuiz);
        setState('ready');
      } catch (validationError) {
        console.error('Zod Validation Error:', validationError);
        throw new Error('The generated quiz data is malformed. Please try again.');
      }

    } catch (err: any) {
      console.error('Quiz Generation Error:', err);
      setError(err.message || 'An unexpected error occurred while generating the quiz.');
      setState('error');
      toast.error(err.message || 'Failed to generate quiz');
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setQuizData(null);
    setError(null);
  }, []);

  return {
    state,
    quizData,
    error,
    startQuiz,
    reset,
  };
}
