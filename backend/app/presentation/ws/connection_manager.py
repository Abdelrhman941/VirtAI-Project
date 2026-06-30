"""
WebSocket connection manager with lightweight outbound replay support.

Responsibilities:
- Track the active socket per session
- Keep a short history of outbound messages for reconnect resume
- Provide per-session sequence numbers for ordered replay
"""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict, deque
from typing import Any

from fastapi import WebSocket


class WSConnectionManager:
    def __init__(self, history_size: int = 200):
        self._history_size = history_size
        self._active: dict[str, WebSocket] = {}
        # Reverse lookups for session revocation:
        self._user_to_ws: dict[str, set[WebSocket]] = defaultdict(set)
        self._family_to_ws: dict[str, set[WebSocket]] = defaultdict(set)
        self._ws_metadata: dict[WebSocket, dict[str, str]] = {}

        self._history: dict[str, deque[tuple[int, str]]] = defaultdict(
            lambda: deque(maxlen=self._history_size)
        )
        self._seq: dict[str, int] = defaultdict(int)
        self._acked: dict[str, int] = defaultdict(int)
        self._lock = asyncio.Lock()
        self._pubsub_task: asyncio.Task | None = None

    async def register(
        self,
        session_id: str,
        websocket: WebSocket,
        user_id: str | None = None,
        family_id: str | None = None,
    ) -> None:
        """Register/replace active websocket for a session."""
        async with self._lock:
            old = self._active.get(session_id)
            self._active[session_id] = websocket

            if user_id:
                self._user_to_ws[user_id].add(websocket)
            if family_id:
                self._family_to_ws[family_id].add(websocket)

            self._ws_metadata[websocket] = {
                "session_id": session_id,
                "user_id": user_id or "",
                "family_id": family_id or "",
            }

        if old and old is not websocket:
            try:
                await old.close(code=1012, reason="Replaced by new connection")
            except Exception:
                pass
            await self._cleanup_websocket(old)

    async def unregister(self, session_id: str, websocket: WebSocket) -> bool:
        """Unregister socket only if it is still the active one. Returns True if it was active."""
        was_active = False
        async with self._lock:
            current = self._active.get(session_id)
            if current is websocket:
                self._active.pop(session_id, None)
                was_active = True
        await self._cleanup_websocket(websocket)
        return was_active

    async def cleanup_session(self, session_id: str) -> None:
        """Completely clean up memory tracking for a session when it is permanently destroyed."""
        async with self._lock:
            self._active.pop(session_id, None)
            self._history.pop(session_id, None)
            self._seq.pop(session_id, None)
            self._acked.pop(session_id, None)

    async def _cleanup_websocket(self, websocket: WebSocket) -> None:
        async with self._lock:
            meta = self._ws_metadata.pop(websocket, None)
            if meta:
                uid = meta.get("user_id")
                fid = meta.get("family_id")
                if uid and uid in self._user_to_ws:
                    self._user_to_ws[uid].discard(websocket)
                    if not self._user_to_ws[uid]:
                        del self._user_to_ws[uid]
                if fid and fid in self._family_to_ws:
                    self._family_to_ws[fid].discard(websocket)
                    if not self._family_to_ws[fid]:
                        del self._family_to_ws[fid]

    async def stamp_and_record(self, session_id: str, payload: dict[str, Any]) -> str:
        """Attach seq_id, persist message to replay history, and return serialized JSON."""
        async with self._lock:
            self._seq[session_id] += 1
            seq = self._seq[session_id]
            payload["seq_id"] = seq
            serialized = json.dumps(payload)
            self._history[session_id].append((seq, serialized))
            return serialized

    async def record_outbound(self, session_id: str, payload: str, seq: int | None = None) -> int:
        """Record an already serialized payload and return sequence number."""
        async with self._lock:
            if seq is None:
                self._seq[session_id] += 1
                seq = self._seq[session_id]
            else:
                self._seq[session_id] = max(self._seq[session_id], seq)
            self._history[session_id].append((seq, payload))
            return seq

    async def acknowledge(self, session_id: str, last_seq: int) -> int:
        """Persist client ACK and trim replay history for acknowledged messages."""
        async with self._lock:
            if last_seq <= self._acked[session_id]:
                return 0

            self._acked[session_id] = last_seq
            history = self._history.get(session_id)
            if not history:
                return 0

            removed = 0
            while history and history[0][0] <= last_seq:
                history.popleft()
                removed += 1
            return removed

    async def get_replay_batch(self, session_id: str, after_seq: int = 0) -> list[str]:
        """Return ordered payloads newer than after_seq for reconnect replay."""
        async with self._lock:
            return [
                payload for seq, payload in self._history.get(session_id, ()) if seq > after_seq
            ]

    @property
    def active_count(self) -> int:
        return len(self._active)

    def latest_sequence(self, session_id: str) -> int:
        return self._seq.get(session_id, 0)

    def latest_acked(self, session_id: str) -> int:
        return self._acked.get(session_id, 0)

    async def start_pubsub_listener(self) -> None:
        """Listen for session revocation events cluster-wide and close sockets."""
        from loguru import logger

        from app.infrastructure.cache.redis_client import get_redis

        async def _listen():
            while True:
                pubsub = None
                try:
                    redis = get_redis()
                    pubsub = redis.pubsub()
                    await pubsub.psubscribe("virtai:ws:events:*")
                    logger.info("[WSManager] Started pub/sub listener for session revocations")

                    # Use get_message() so idle read timeouts stay inside this inner
                    # loop and never cause a reconnect or a spurious ERROR log.
                    while True:
                        try:
                            message = await pubsub.get_message(
                                ignore_subscribe_messages=True, timeout=5.0
                            )
                        except (TimeoutError, asyncio.TimeoutError):
                            # Expected: channel idle, no message within the timeout window.
                            # Keep listening without logging or reconnecting.
                            continue

                        if message is None:
                            # No message ready yet; yield control and poll again.
                            await asyncio.sleep(0.05)
                            continue

                        if message["type"] != "pmessage":
                            continue

                        try:
                            data = json.loads(message["data"])
                            event = data.get("event")
                            if event in ("session_invalidated", "chat_session_deleted"):
                                uid = data.get("user_id")
                                fid = data.get("family_id")
                                sid = data.get("session_id")
                                if not uid:
                                    continue

                                sockets_to_close: set = set()
                                async with self._lock:
                                    if event == "chat_session_deleted":
                                        if sid:
                                            ws = self._active.get(sid)
                                            if ws:
                                                sockets_to_close.add(ws)
                                    else:
                                        if fid == "all":
                                            sockets_to_close = set(self._user_to_ws.get(uid, []))
                                        else:
                                            sockets_to_close = set(self._family_to_ws.get(fid, []))

                                for ws in sockets_to_close:
                                    try:
                                        await ws.close(code=4001, reason="Session invalidated")
                                    except Exception:
                                        pass
                                        logger.info(
                                            f"[WSManager] Closed connection | user={uid} | session_id={sid or 'all'} | "
                                            f"reason=Session invalidated via PubSub"
                                        )
                            elif event == "doc_status":
                                sid = data.get("session_id")
                                uid = data.get("user_id")
                                if uid:
                                    async with self._lock:
                                        # If session_id is tied, we could prioritize it, but generally progress should go to all user tabs
                                        sockets = set(self._user_to_ws.get(uid, []))
                                        
                                        payload = {
                                            "type": "doc_status",
                                            "data": data.get("data", {})
                                        }
                                        for ws in sockets:
                                            try:
                                                await ws.send_text(json.dumps(payload))
                                            except Exception:
                                                pass
                        except Exception as e:
                            logger.error(f"[WSManager] Error processing pubsub message: {e}")

                except asyncio.CancelledError:
                    logger.info("[WSManager] PubSub listener stopped")
                    if pubsub is not None:
                        try:
                            await pubsub.punsubscribe()
                        except Exception:
                            pass
                    break
                except Exception as e:
                    # Only genuine connection failures reach here (e.g. Redis unreachable).
                    logger.error(
                        f"[WSManager] Redis pub/sub connection error: {e}, reconnecting in 5s..."
                    )
                    await asyncio.sleep(5)

        self._pubsub_task = asyncio.create_task(_listen(), name="ws_pubsub_listener")


_connection_manager: WSConnectionManager | None = None


def init_connection_manager(manager: WSConnectionManager) -> None:
    global _connection_manager
    _connection_manager = manager


def get_connection_manager() -> WSConnectionManager:
    if _connection_manager is None:
        raise RuntimeError("Connection manager not initialized")
    return _connection_manager
