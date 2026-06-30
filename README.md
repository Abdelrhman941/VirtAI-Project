# **VirtAI**

Welcome to VirtAI! This is the central repository for the VirtAI project. We utilize a strict Clean Architecture pattern to ensure maintainability, testability, and stability across our real-time generation features.

<div style="width: 100%; height: 15px; background: linear-gradient(to right, rgb(235, 238, 212), rgb(235, 238, 212));"></div>

## **📚 Developer Documentation Network**

To understand how VirtAI is built and operated, please refer to our world-class documentation network:

- **[Visual Architecture](backend/docs/ARCHITECTURE.md)**: Explore the Database ERD, WebSocket Flows, and RAG Task pipelines via Mermaid diagrams.
- **[The Developer Code Tour](backend/docs/CODE_TOUR.md)**: A narrative guide to onboarding, explaining our Clean Architecture layers and request flows.
- **[The DevOps Runbook](backend/docs/RUNBOOK.md)**: Operational guides, Environment Variables, Alembic DB Commands, and Troubleshooting.
- **[Historical Refactor Decisions](backend/docs/refactor/README.md)**: Architecture Decision Records (ADRs) that guided our development.

<div style="width: 100%; height: 15px; background: linear-gradient(to right, rgb(235, 238, 212), rgb(235, 238, 212));"></div>

## **🚀 Quickstart Guide**

### 1. Prerequisites
- Docker & Docker Compose
- Python 3.11+
- PostgreSQL & Redis (if running locally without Docker)

### 2. Setup
Clone the repository and set up your environment variables:
```bash
cp .env.example .env
# Edit .env with your specific OPENAI_API_KEY and connection strings
```

### 3. Running the Application
Using Docker Compose is the easiest way to get started:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```
This will spin up the database, Redis, the backend FastAPI server, and the frontend.

### 4. Running Tests
To ensure the system is healthy and everything is working, run the test suite using our provided script:
```bash
./backend/scripts/run_tests.sh
```
*Note: You may safely ignore `locust` module errors during standard test runs, as they are designated for specific load testing environments.*

To run the tests, you need to install locust. You can do this by running the following command:
```bash
pip install locust
```

---

## **Team members:**
- [Abdelrhman Ezzat](https://www.linkedin.com/in/abdelrhman-a-ezzat/)
- [Hassan Zoghly](https://www.linkedin.com/in/hassan-zoghly/)
- [Mohamed sharaf](https://www.linkedin.com/in/mohamed-ali-658b8b2b8/)
- [Mostafa Nasser](https://www.linkedin.com/in/mostafa-nasser-876442322/)
- [Abdallah Alhesh](https://www.linkedin.com/in/abdallah-mohamed-alhesh/)
