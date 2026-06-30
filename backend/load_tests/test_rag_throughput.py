from locust import HttpUser, task, between

class RAGThroughputUser(HttpUser):
    wait_time = between(1, 2)

    @task
    def rag_query(self):
        payload = {
            "query": "What is the main topic of this document?",
            "document_id": "test-doc-id"
        }
        with self.client.post("/v1/rag/chat", json=payload, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed with {response.status_code}")
