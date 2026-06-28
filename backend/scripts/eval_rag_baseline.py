import asyncio
import numpy as np
from uuid import uuid4


from app.shared.config import get_settings
settings = get_settings()

from app.infrastructure.rag.cohere_embedder import CohereEmbedder
from app.infrastructure.rag.fastembed_provider import FastEmbedProvider
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

EVAL_CASES = [
    {
        "query": "What is the capital of France?",
        "expected_chunks": ["Paris is the capital of France."],
        "distractors": [
            "Lyon is a major city in France.",
            "Berlin is the capital of Germany.",
            "France has many beautiful capitals of culture."
        ]
    },
    {
        "query": "كيف يتم حساب الضريبة؟",
        "expected_chunks": ["يتم حساب الضريبة بضرب القيمة الإجمالية في 15 بالمائة."],
        "distractors": [
            "الضريبة هي مبلغ مالي يدفعه المواطن للدولة.",
            "كيف يتم دفع الرسوم الجمركية في الميناء؟",
            "حساب التفاضل والتكامل مهم جداً في الرياضيات الهندسية."
        ]
    }
]

def cosine_similarity(v1, v2):
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

async def run_baseline_eval():
    print("--- RAGAS Baseline Evaluation ---")
    
    # Initialize embedder as configured
    if settings.EMBEDDING_PROVIDER == "cohere":
        embedder = CohereEmbedder(
            model_name=settings.EMBEDDING_MODEL,
            api_key=settings.COHERE_API_KEY or "dummy_key"
        )
    else:
        embedder = FastEmbedProvider(
            model_name=settings.EMBEDDING_MODEL,
            cache_dir=settings.FASTEMBED_CACHE_DIR,
        )

    precisions = []
    recalls = []

    for case in EVAL_CASES:
        query = case["query"]
        expected = set(case["expected_chunks"])
        distractors = case["distractors"]

        all_texts = list(expected) + distractors
        
        try:
            # Embed query and documents
            query_vector = await embedder.embed(query)
            doc_vectors = await embedder.embed_batch(all_texts)
        except Exception as e:
            print(f"Failed to embed (check API key or model): {e}")
            return

        # Calculate similarities (simulating pgvector cosine distance)
        scored_texts = []
        for text, vec in zip(all_texts, doc_vectors):
            score = cosine_similarity(query_vector, vec)
            scored_texts.append((score, text))
        
        # Sort by score desc
        scored_texts.sort(key=lambda x: x[0], reverse=True)
        
        # Take Top K=2
        top_k = 2
        retrieved_texts = [text for score, text in scored_texts[:top_k]]

        relevant_retrieved = [t for t in retrieved_texts if t in expected]
        
        precision = len(relevant_retrieved) / len(retrieved_texts) if retrieved_texts else 0.0
        recall = len(relevant_retrieved) / len(expected) if expected else 0.0

        precisions.append(precision)
        recalls.append(recall)

        print(f"Query: {query}")
        print(f"  Expected: {list(expected)}")
        print(f"  Retrieved: {retrieved_texts}")
        print(f"  Precision@2: {precision:.2f}, Recall@2: {recall:.2f}\n")

    avg_precision = sum(precisions) / len(precisions)
    avg_recall = sum(recalls) / len(recalls)

    print(f"Average Context Precision: {avg_precision:.2f}")
    print(f"Average Context Recall: {avg_recall:.2f}")

if __name__ == "__main__":
    asyncio.run(run_baseline_eval())
