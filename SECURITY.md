# 🛡️ VirtAI Security Policy

At **VirtAI**, the security of our users' data, voice models, and conversational history is our highest priority. We are committed to maintaining a robust, secure, and privacy-focused platform. This document outlines our security practices, supported versions, and the procedure for reporting vulnerabilities.

## 🟢 Supported Versions

We actively maintain and provide security updates for the following versions of the VirtAI application. We strongly recommend always running the latest minor release of the current major version.

| Version | Release Type | Security Updates | Notes |
| :--- | :--- | :--- | :--- |
| **v1.x** | Current Stable | ✅ Supported | Full support, active feature development, and security patches. |
| **v0.9.x**| Beta / Pre-release | ❌ Unsupported | Deprecated. Please upgrade to v1.x immediately. |

*Note: For self-hosted instances using our Docker Compose configurations, ensure you are pulling the `latest` tags or the most recent specific version tag.*

---

## 🔒 Security Architecture Highlights

VirtAI employs several layers of security to protect users and the platform:

*   **Authentication & Authorization:** 
    *   Secure integration with Google OAuth 2.0.
    *   Stateless JWT (JSON Web Tokens) access tokens.
    *   Secure, `HTTPOnly`, `Secure`, and `SameSite` cookies for Refresh Tokens to mitigate XSS attacks.
    *   Robust JWT Blacklisting mechanism via Redis to ensure logged-out tokens cannot be reused.
*   **API & WebSocket Protection:**
    *   Strict Cross-Site Request Forgery (CSRF) protection using the Double Submit Cookie pattern (`X-CSRF-Token`).
    *   WebSocket connections are securely authenticated on the first message (not in the URL) to prevent token leakage in server logs.
*   **Data Protection:**
    *   MongoDB collections utilize sparse unique indexes to prevent data duplication correctly.
    *   Insecure Direct Object Reference (IDOR) protection on all sensitive endpoints (e.g., retrieving generated TTS audio).
*   **Rate Limiting & Abuse Prevention:**
    *   Sliding-window rate limiting backed by Redis, with in-memory fallbacks, to prevent brute-force attacks and abuse of external APIs (like Groq LLM and Edge-TTS).

---

## 🚨 Reporting a Vulnerability

We deeply appreciate the efforts of the security research community and users who find and report vulnerabilities in VirtAI.

**Please DO NOT report security vulnerabilities through public GitHub issues, discussions, or pull requests.** 

Instead, please report them responsibly by following these steps:

1.  **Contact Us Directly:** Send an email detailing the vulnerability to **[ضع بريدك الإلكتروني هنا، مثلاً: security@virtai-project.com أو إيميلك الشخصي]**.
2.  **Include Details:** In your email, please provide:
    *   A summary of the vulnerability.
    *   The specific component affected (e.g., WebSocket Gateway, JWT validation, React UI).
    *   Steps to reproduce the vulnerability (proof of concept, screenshots, or scripts are highly appreciated).
    *   The potential impact or exploit scenario.
3.  **Response Timeline:** 
    *   We aim to acknowledge receipt of your vulnerability report within **48 hours**.
    *   We will provide a preliminary assessment and estimated timeline for a fix within **5 business days**.
4.  **Remediation:** We will work diligently to validate the report, develop a patch, and release a security update. 
5.  **Disclosure:** Please maintain confidentiality until we have released a fix. We will coordinate public disclosure with you and, if desired, acknowledge your contribution in our release notes.

## 🛡️ Best Practices for Self-Hosting VirtAI

If you are running VirtAI on your own infrastructure using our Docker configurations, please ensure you follow these operational security best practices:

*   **Secret Management:** **NEVER** commit `.env` files, API keys (e.g., Groq API Key), or JWT secrets to version control. Always use secure environment variables.
*   **Redis Security:** Ensure your Redis instance is protected with a strong password (`REDIS_PASSWORD`) and is not exposed directly to the public internet.
*   **HTTPS/TLS:** Always run the application behind a reverse proxy (like Nginx, which is provided in our `prod` setup) configured with valid SSL/TLS certificates.
*   **Docker Volumes:** Protect the `.data` directory, which contains generated audio and database files, with appropriate host-level file permissions.

---

*Thank you for helping us keep VirtAI secure!*
