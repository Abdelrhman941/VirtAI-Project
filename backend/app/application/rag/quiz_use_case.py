import uuid
from typing import Any

from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.chat.entities import ConversationHistory
from app.domain.chat.ports import BaseLLMProvider
from app.domain.rag.task_types import Locale, TaskType
from app.infrastructure.db.models import DocumentChunk, Quiz, QuizQuestion
from app.application.prompts.rag.registry import get_prompt_set
from app.shared.errors import RAGException


class QuizQuestionModel(BaseModel):
    question_text: str
    options: list[str]
    correct_option_index: int
    explanation: str
    citations: list[int]


class QuizModel(BaseModel):
    questions: list[QuizQuestionModel]

class QuizAttemptAnswerModel(BaseModel):
    question_id: str
    selected_option: int | None
    is_correct: bool
    time_spent_ms: int
    hesitation_count: int

class QuizAttemptModel(BaseModel):
    score: int
    answers: list[QuizAttemptAnswerModel]


QUIZ_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "quiz",
        "schema": {
            "type": "object",
            "properties": {
                "questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "question_text": {"type": "string"},
                            "options": {"type": "array", "items": {"type": "string"}},
                            "correct_option_index": {"type": "integer"},
                            "explanation": {"type": "string"},
                            "citations": {"type": "array", "items": {"type": "integer"}},
                        },
                        "required": [
                            "question_text",
                            "options",
                            "correct_option_index",
                            "explanation",
                            "citations",
                        ],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["questions"],
            "additionalProperties": False,
        },
        "strict": True,
    },
}


class QuizDomainException(RAGException):
    pass


class QuizUseCase:
    """Use case for generating a quiz from a document."""

    def __init__(self, llm: BaseLLMProvider):
        self.llm = llm

    async def generate_quiz(
        self,
        db: AsyncSession,
        document_id: str,
        user_id: str,
        num_questions: int = 5,
        locale: Locale = Locale.EN,
    ) -> str:
        """
        Generates a quiz from the document chunks, parses JSON with fallback,
        and saves it to the DB. Returns the quiz_id.
        """
        doc_uuid = uuid.UUID(document_id)
        user_uuid = uuid.UUID(user_id)

        # 1. Fetch chunks
        chunks_query = await db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == doc_uuid)
            .order_by(DocumentChunk.chunk_order)
        )
        chunks = chunks_query.scalars().all()

        if not chunks:
            raise QuizDomainException("No content found to generate a quiz.")

        blocks = []
        for chunk in chunks:
            text = (chunk.chunk_text or "").strip()
            if not text:
                continue
            meta = chunk.chunk_metadata or {}
            label = f"Chunk: {meta.get('chunk_index', chunk.chunk_order)}"
            blocks.append(f"[{label}]\n{text}")

        max_chars = 12000
        current_len = 0
        selected_blocks = []
        for b in blocks:
            if current_len + len(b) > max_chars:
                break
            selected_blocks.append(b)
            current_len += len(b)

        lecture_text = "\n\n".join(selected_blocks)

        prompt_set = get_prompt_set(TaskType.QUIZ, locale)
        sys_prompt = prompt_set.system.substitute(num_questions=num_questions)
        footer = prompt_set.footer.substitute(num_questions=num_questions)

        user_text = f"--- Document Content ---\n\n{lecture_text}\n\n{footer}"

        # 2. Call LLM with JSON format
        logger.info("Generating quiz via structured output")
        history = ConversationHistory(system_prompt=sys_prompt)
        history.add_user_message(user_text)

        quiz_data = None
        for attempt in range(3):
            logger.info(f"Generating quiz via structured output, attempt {attempt + 1}")
            try:
                res = await self.llm.complete(history, response_format=QUIZ_SCHEMA)
                response_text = res.full_text.strip()

                quiz_data = QuizModel.model_validate_json(response_text)

                if not quiz_data.questions:
                    raise ValueError("LLM returned an empty questions list")
                break
            except Exception as e:
                logger.error(f"Quiz generation parsing failed: {e}")
                quiz_data = None

        if not quiz_data:
            raise QuizDomainException("Failed to generate a valid quiz JSON after 3 attempts.")

        # 3. Save Quiz
        quiz = Quiz(document_id=doc_uuid, user_id=user_uuid)
        db.add(quiz)
        await db.flush()  # get quiz.id

        # 4. Save QuizQuestions
        for q_data in quiz_data.questions:
            question = QuizQuestion(
                quiz_id=quiz.id,
                question_text=q_data.question_text,
                options=q_data.options,
                correct_option_index=q_data.correct_option_index,
                explanation=q_data.explanation,
                citations=q_data.citations,
            )
            db.add(question)

        await db.commit()
        return str(quiz.id)

    async def get_quiz(self, db: AsyncSession, quiz_id: str, user_id: str) -> dict[str, Any]:
        """Fetch a generated quiz for replay."""
        quiz_uuid = uuid.UUID(quiz_id)
        user_uuid = uuid.UUID(user_id)

        quiz_query = await db.execute(
            select(Quiz).where(Quiz.id == quiz_uuid, Quiz.user_id == user_uuid)
        )
        quiz = quiz_query.scalar_one_or_none()
        if not quiz:
            raise QuizDomainException("Quiz not found or unauthorized.")

        questions_query = await db.execute(
            select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id)
        )
        questions = questions_query.scalars().all()

        return {
            "id": str(quiz.id),
            "document_id": str(quiz.document_id),
            "created_at": quiz.created_at.isoformat() if quiz.created_at else None,
            "questions": [
                {
                    "id": str(q.id),
                    "question_text": q.question_text,
                    "options": q.options,
                    "correct_option_index": q.correct_option_index,
                    "explanation": q.explanation,
                    "citations": q.citations,
                }
                for q in questions
            ],
        }

    async def submit_attempt(self, db: AsyncSession, quiz_id: str, user_id: str, attempt_data: QuizAttemptModel) -> str:
        from app.infrastructure.db.models import QuizAttempt, QuizAttemptAnswer
        quiz_uuid = uuid.UUID(quiz_id)
        user_uuid = uuid.UUID(user_id)

        # verify quiz exists and user owns it
        quiz_query = await db.execute(
            select(Quiz).where(Quiz.id == quiz_uuid, Quiz.user_id == user_uuid)
        )
        if not quiz_query.scalar_one_or_none():
            raise QuizDomainException("Quiz not found or unauthorized.")

        attempt = QuizAttempt(quiz_id=quiz_uuid, user_id=user_uuid, score=attempt_data.score)
        db.add(attempt)
        await db.flush()

        for ans in attempt_data.answers:
            attempt_answer = QuizAttemptAnswer(
                attempt_id=attempt.id,
                question_id=uuid.UUID(ans.question_id),
                selected_option=ans.selected_option,
                is_correct=ans.is_correct,
                time_spent_ms=ans.time_spent_ms,
                hesitation_count=ans.hesitation_count,
            )
            db.add(attempt_answer)

        await db.commit()
        return str(attempt.id)

    async def get_analytics(self, db: AsyncSession, quiz_id: str, user_id: str) -> dict[str, Any]:
        from app.infrastructure.db.models import QuizAttempt, QuizAttemptAnswer
        quiz_uuid = uuid.UUID(quiz_id)
        user_uuid = uuid.UUID(user_id)

        # verify quiz exists and user owns it
        quiz_query = await db.execute(
            select(Quiz).where(Quiz.id == quiz_uuid, Quiz.user_id == user_uuid)
        )
        if not quiz_query.scalar_one_or_none():
            raise QuizDomainException("Quiz not found or unauthorized.")

        # Get all attempts for this quiz
        attempts_query = await db.execute(
            select(QuizAttempt).where(QuizAttempt.quiz_id == quiz_uuid).order_by(QuizAttempt.created_at)
        )
        attempts = attempts_query.scalars().all()

        if not attempts:
            return {
                "mastery_score": 0,
                "avg_time_ms": 0,
                "total_hesitations": 0,
                "trend": [],
                "blind_spot_matrix": []
            }

        trend = [{"attempt": i + 1, "score": a.score} for i, a in enumerate(attempts)]
        latest_attempt = attempts[-1]

        # Get answers for latest attempt for the matrix
        answers_query = await db.execute(
            select(QuizAttemptAnswer).where(QuizAttemptAnswer.attempt_id == latest_attempt.id)
        )
        answers = answers_query.scalars().all()

        total_time = sum(a.time_spent_ms for a in answers)
        total_hesitations = sum(a.hesitation_count for a in answers)
        avg_time = int(total_time / len(answers)) if answers else 0

        blind_spot_matrix = [
            {
                "question_id": str(a.question_id),
                "time_spent_ms": a.time_spent_ms,
                "is_correct": a.is_correct,
            }
            for a in answers
        ]

        return {
            "mastery_score": latest_attempt.score,
            "avg_time_ms": avg_time,
            "total_hesitations": total_hesitations,
            "trend": trend,
            "blind_spot_matrix": blind_spot_matrix
        }

    async def get_insights(self, db: AsyncSession, attempt_id: str, user_id: str, locale: Locale) -> str:
        from app.infrastructure.db.models import QuizAttempt, QuizAttemptAnswer, QuizQuestion
        attempt_uuid = uuid.UUID(attempt_id)
        user_uuid = uuid.UUID(user_id)

        # Get the attempt and verify ownership
        attempt_query = await db.execute(
            select(QuizAttempt).where(QuizAttempt.id == attempt_uuid, QuizAttempt.user_id == user_uuid)
        )
        attempt = attempt_query.scalar_one_or_none()
        if not attempt:
            raise QuizDomainException("Quiz attempt not found or unauthorized.")

        # Get incorrect answers and their corresponding questions
        answers_query = await db.execute(
            select(QuizAttemptAnswer, QuizQuestion)
            .join(QuizQuestion, QuizQuestion.id == QuizAttemptAnswer.question_id)
            .where(QuizAttemptAnswer.attempt_id == attempt_uuid, QuizAttemptAnswer.is_correct == False)
        )
        incorrect_items = answers_query.all()

        if not incorrect_items:
            return "Excellent work! You answered all questions correctly. You have mastered this material." if locale == Locale.EN else "عمل ممتاز! لقد أجبت على جميع الأسئلة بشكل صحيح. لقد أتقنت هذه المادة."

        # Compile mistakes for the LLM
        mistakes_context = []
        for ans, q in incorrect_items:
            mistakes_context.append(
                f"Question: {q.question_text}\n"
                f"Correct Answer: {q.options[q.correct_option_index]}\n"
                f"Student Chose: {q.options[ans.selected_option] if ans.selected_option is not None else 'Skipped'}\n"
            )
        
        prompt = (
            "You are an expert AI tutor. Review the following incorrect answers from a student's quiz attempt.\n"
            "Generate a short, encouraging, and highly actionable paragraph (maximum 3-4 sentences) advising the student on which concepts they need to review based on their specific mistakes.\n"
            "Do NOT list the questions. Just summarize the underlying concepts they missed and advise them.\n"
            f"Respond in {'Arabic' if locale == Locale.AR else 'English'}.\n\n"
            "Mistakes:\n" + "\n".join(mistakes_context)
        )
        
        response = await self._llm.generate(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        return response.content
