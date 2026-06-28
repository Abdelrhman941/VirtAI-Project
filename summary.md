# VirtAI Project: Conversation Summary

This document summarizes the ongoing development and refactoring conversation for the VirtAI project, providing context for any AI joining the session to seamlessly pick up where we left off.

## 1. The Basics: Project Context and Workflow
We are working on **VirtAI**, specifically focusing on stabilizing and refactoring the WebSocket (WS), real-time functionality, and document upload pipelines across both the frontend (React/TypeScript) and backend (FastAPI/Python). 

The work is strictly structured into **Batches**. There are strict rules governing each batch to ensure that we do not touch or modify logic outside the current scope (e.g., no touching auth/JWT, no restructuring folders, no touching DB indexes unless explicitly requested). We must show BEFORE/AFTER diffs and explain the implementation for approval before proceeding to the next batch.

## 2. High-Level Progress (Batches 1-3)
- **BATCH 1 (WS State & Cleanup):** Fixed memory leaks by properly implementing `off()` unsubscription chains and added environment validation for WebSocket URLs to ensure they throw errors in PROD and warn in DEV.
- **BATCH 2 (Reconnection & Heartbeat):** Implemented an exponential backoff formula for reconnection. Fixed a critical bug where idle sessions disconnected after 30 seconds by adding an explicit backend `pong` response handler in `protocol_router.py`. Ensured `clearHeartbeat()` is correctly invoked when the socket closes.
- **BATCH 3 (Session Persistence & Recovery):** Implemented logic to restore a session upon WS reconnection without spawning ghost chats. Addressed a flaw in the manual reconnect button where the retry attempt counter wasn't resetting, preventing fresh retry cycles.

## 3. Current Focus: BATCH 4 (Document Upload Stability)
**We have just completed the implementation for BATCH 4**, which focused on killing aggressive HTTP polling and replacing it with a real-time event-driven architecture, as well as handling edge cases in document uploads.

### What was just implemented:
1. **Backend Event Emission (`ingestion_state_repository.py`):** 
   - Created a private `_emit_doc_status` helper function.
   - Used Redis PubSub (`virtai:ws:events:doc_status`) to publish document state changes asynchronously whenever a document transitions between stages (queued, processing, failed, cancelled, completed).
2. **Backend PubSub Routing (`connection_manager.py`):**
   - Extended the `WSConnectionManager`'s Redis PubSub listener to catch the `doc_status` events. 
   - The manager now actively pushes these events directly through the active WebSocket connection associated with the `session_id`, including stamping the messages in the replay history.
3. **Frontend Subscription & Hydration (`useDocumentList.ts`):**
   - **Killed the Polling Loop:** Deleted the aggressive `setInterval` polling that constantly hit the `/status` endpoint.
   - **Real-Time Updates:** Introduced `wsManager.on('doc_status', ...)` to listen for server-side processing ACKs and update the React state efficiently.
   - **Session Hydration:** Bound `wsManager.on('ready', ...)` to trigger a one-time DB fetch (`fetchDocuments()`) so the UI is always hydrated with the correct document list upon a WS reconnect or hard refresh.
4. **Duplicate File Detection:**
   - Updated the backend endpoints (`documents.py`) and frontend types (`types.ts`) to expose `file_size`.
   - Modified `enqueueUpload` in the frontend to check the existing document list for an exact match on **both** `filename` and `file_size`. If a duplicate is detected, it triggers a `window.confirm` warning before allowing the upload.

### Next Steps:
We are currently awaiting the user's review and approval of the BATCH 4 implementation. Once BATCH 4 is approved, we will proceed directly to **BATCH 5**.


| **BATCH** | **SCOPE & ISSUES ADDRESSED** |
| :--- | :--- |
| **BATCH 1** <br> *(WebSocket Core Architecture)* | **Issues:** ISSUE-1 <br> • Single WS manager (singleton pattern) <br> • Env-driven URL <br> • Proper cleanup on unmount <br> • Listener accumulation fix |
| **BATCH 2** <br> *(Reconnection & Heartbeat)* | **Issues:** ISSUE-2, ISSUE-3 <br> • Exponential backoff with jitter <br> • Max retry limit + user notification <br> • Ping/pong heartbeat <br> • Real "Reconnect" button wired to manager |
| **BATCH 3** <br> *(Session Persistence & Recovery)* | **Issues:** ISSUE-4 <br> • Session ID storage + DB lookup on rejoin <br> • Reconnect restores existing session <br> • Refresh does NOT create new chat |
| **BATCH 4** <br> *(Document Upload Stability)* | **Issues:** ISSUE-5, ISSUE-6 <br> • Sidebar state from DB, not transient RAM <br> • Documents survive reconnect/refresh <br> • Upload progress with server ACK <br> • Ingestion status events from WS |
| **BATCH 5** <br> *(Database Hardening)* | **Issues:** ISSUE-9 <br> • DB indexes for session_id, document_id <br> • Transactional session + doc creation <br> • Orphan cleanup |
| **BATCH 6** <br> *(Security Fixes)* | **Issues:** ISSUE-7, ISSUE-8 <br> • Move JWT from WS URL to first WS message <br> • Server-side WS message validation |
| **BATCH 7** <br> *(Modularity Refactor)* | **Issues:** ISSUE-10 <br> • Centralize WS into /services/wsManager <br> • Extract session utils to /services/session <br> • Remove business logic from UI components |
| **BATCH 8** <br> *(Performance & UX Polish)* | **Issues:** All remaining polish <br> • Memoize WS handlers <br> • Debounce state updates from WS events <br> • Loading states (connecting/reconnecting/uploading/processing) — all real, not fake |


