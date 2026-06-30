import numpy as np
import numpy.typing as npt

from app.domain.rag.ports import EmbeddingProvider


class IntentClassifier:
    """
    Fast local semantic intent classifier for Voice Avatar to avoid expensive retrieval
    for simple greetings and conversational acknowledgments.
    """

    def __init__(self, embedder: EmbeddingProvider):
        self.embedder = embedder
        self.is_initialized = False
        self.anchor_embeddings_normalized: npt.NDArray[np.float64] | None = None

    async def initialize(self) -> None:
        """Initialize the embedding model and anchor embeddings."""
        import logging

        try:
            raw_anchors = [
                # English Anchors
                "hello",
                "hi",
                "hey",
                "greetings",
                "good morning",
                "good evening",
                "good afternoon",
                "how are you",
                "what's up",
                "how's it going",
                "how are you doing",
                "thanks",
                "thank you",
                "thanks a lot",
                "thx",
                "appreciate it",
                "ok",
                "okay",
                "got it",
                "makes sense",
                "understood",
                "i see",
                "sure",
                "alright",
                "fine",
                "bye",
                "goodbye",
                "see you",
                "cya",
                "catch you later",
                "yes",
                "no",
                "yep",
                "nope",
                "yeah",
                "nah",
                # Arabic Anchors
                "مرحبا",
                "أهلا",
                "هلا",
                "سلام",
                "السلام عليكم",
                "السلام عليكم ورحمة الله",
                "صباح الخير",
                "مساء الخير",
                "كيفك",
                "كيف حالك",
                "شخبارك",
                "عامل ايه",
                "شكرا",
                "شكراً",
                "يعطيك العافية",
                "تسلم",
                "مشكور",
                "الف شكر",
                "تمام",
                "حسنا",
                "حسناً",
                "مفهوم",
                "طيب",
                "اوكي",
                "ماشي",
                "زين",
                "مع السلامة",
                "وداعا",
                "وداعاً",
                "باي",
                "الى اللقاء",
                "نعم",
                "لا",
                "اه",
                "ايوه",
                "أجل",
                "كلا",
                "يا هندسة",
                "السلام عليكم، يا هندسة",
            ]

            # The embedder will add the prefix if configured (FastEmbed handles "query:" internally for some models)
            embeddings_list = await self.embedder.embed_batch(raw_anchors)
            anchor_embeddings: npt.NDArray[np.float64] = np.array(embeddings_list, dtype=np.float64)

            # Pre-normalize anchor embeddings to speed up cosine similarity calculation
            norms = np.linalg.norm(anchor_embeddings, axis=1, keepdims=True)
            self.anchor_embeddings_normalized = anchor_embeddings / norms
            self.is_initialized = True
        except Exception as e:
            logging.getLogger(__name__).error(
                f"[IntentClassifier] Initialization failed: {e}. Semantic routing will be disabled."
            )
            self.is_initialized = False

    async def async_is_casual_chat(self, text: str, threshold: float = 0.82) -> bool:
        text = text.strip()
        if not text:
            return True

        # Fast-path fallback for long queries (likely domain questions)
        if len(text) > 80:
            return False

        if not self.is_initialized or self.anchor_embeddings_normalized is None:
            return False

        try:
            # Embed the incoming query text
            query_embedding_list = await self.embedder.embed_batch([text])
            if not query_embedding_list:
                return False

            query_embedding: npt.NDArray[np.float64] = np.array(
                query_embedding_list[0], dtype=np.float64
            )

            # Normalize the query embedding
            query_norm = np.linalg.norm(query_embedding)
            if query_norm == 0:
                return False

            query_normalized: npt.NDArray[np.float64] = query_embedding / query_norm

            # Calculate cosine similarities using vectorized dot product
            scores = np.dot(self.anchor_embeddings_normalized, query_normalized)
            max_score = float(np.max(scores))

            return max_score > threshold
        except Exception:
            # Fallback to standard RAG retrieval on model failure (e.g. timeout, OOM)
            return False
