from locust import HttpUser, task, between

class SummaryConcurrentUser(HttpUser):
    wait_time = between(1, 2)

    @task
    def summarize_document(self):
        # We simulate the MAP-REDUCE summary request
        document_id = "test-doc-id"
        with self.client.post(f"/v1/rag/summarize/{document_id}", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed with {response.status_code}")
