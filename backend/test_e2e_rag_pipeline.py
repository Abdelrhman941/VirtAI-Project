import time
import requests
import uuid

API_URL = "http://localhost:8000/api/v1"

def test_e2e_rag():
    print("Starting E2E RAG Pipeline Test...")

    # 1. Login or Create User
    session = requests.Session()
    
    unique_id = uuid.uuid4().hex[:8]
    login_data = {
        "email": f"test_{unique_id}@example.com",
        "password": "testpassword123"
    }
    
    session.headers.update({"x-csrf-token": "dummy"})
    session.headers.update({"X-Forwarded-For": f"192.168.1.{int(unique_id[:2], 16) % 254 + 1}"})
    session.cookies.set("csrf_token", "dummy")

    # Try register
    register_data = {
        "email": login_data["email"],
        "full_name": f"Test_{unique_id} User",
        "password": login_data["password"]
    }
    reg_resp = session.post(f"{API_URL}/auth/signup", json=register_data)
    print(f"Register response: {reg_resp.text}")
    
    # Login
    resp = session.post(f"{API_URL}/auth/login", json=login_data)
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        return
        
    login_json = resp.json()
    token = login_json.get("access_token")

    if not token:
        print("Failed to get token!")
        return

    print("Got token, starting ingestion...")
    headers = {"Authorization": f"Bearer {token}"}

    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=15)
    pdf.cell(200, 10, txt="Cohere + Gemini E2E Test", ln=True, align='C')
    pdf.cell(200, 10, txt="This is a dummy document for testing RAG.", ln=True, align='C')
    pdf.cell(200, 10, txt="It contains some test facts. The secret word is PINEAPPLE_COHERE_2026.", ln=True, align='C')
    pdf.output("dummy.pdf")

    # 2. Upload Document
    with open("dummy.pdf", "rb") as f:
        files = {
            'file': ('dummy.pdf', f, 'application/pdf')
        }
        data = {
            'scope': 'GLOBAL'
        }
        upload_resp = session.post(f"{API_URL}/documents/upload", files=files, data=data, headers=headers)
        
    upload_json = upload_resp.json()
    print(f"Upload response: {upload_json}")
    doc_id = upload_json.get("id")

    if not doc_id:
        print("Failed to upload document!")
        return

    # Wait for ingestion to complete
    for _ in range(30):
        status_resp = session.get(f"{API_URL}/documents/{doc_id}/status", headers=headers)
        status_json = status_resp.json()
        print(f"Status: {status_json}")
        if status_json.get("status") == "COMPLETE":
            print("Ingestion complete!")
            break
        elif status_json.get("status") == "FAILED":
            print("Ingestion failed!")
            return
        time.sleep(2)
    else:
        print("Ingestion timed out!")
        return

    # 3. Query the RAG
    query_data = {
        "query": "What is the secret word in the dummy document?"
    }
    query_resp = session.post(f"{API_URL}/chat/query", json=query_data, headers=headers)
    query_json = query_resp.json()
    print(f"Query response: {query_json}")

    response_text = query_json.get("response", "")
    if "PINEAPPLE_COHERE_2026" in response_text or "pineapple_cohere_2026" in response_text.lower():
        print("E2E RAG Pipeline SUCCESS!")
    else:
        print("E2E RAG Pipeline FAILED to return expected response.")


if __name__ == "__main__":
    test_e2e_rag()
