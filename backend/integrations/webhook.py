"""Signed webhook helpers for CareOS integration events."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence


def canonical_payload(payload: Any) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")


def sign_payload(payload: Any, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), canonical_payload(payload), hashlib.sha256).hexdigest()


def verify_signature(payload: Any, signature: str, secret: str, tolerance_seconds: int = 300) -> bool:
    expected = sign_payload(payload, secret)
    if not hmac.compare_digest(expected, signature):
        return False
    if tolerance_seconds <= 0:
        return True
    timestamp = _payload_timestamp(payload)
    if timestamp is None:
        return True
    return abs(time.time() - timestamp) <= tolerance_seconds


def _payload_timestamp(payload: Any) -> Optional[float]:
    if not isinstance(payload, Mapping):
        return None
    for key in ("timestamp", "sentAt", "sent_at"):
        value = payload.get(key)
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


@dataclass
class WebhookEvent:
    event_id: str
    topic: str
    payload: Dict[str, Any]
    timestamp: float = field(default_factory=time.time)
    attempts: int = 0
    delivered: bool = False

    def envelope(self, secret: str) -> Dict[str, Any]:
        body = {"id": self.event_id, "topic": self.topic, "timestamp": self.timestamp, "data": self.payload}
        return {"headers": {"X-CareOS-Signature": sign_payload(body, secret)}, "body": body}


class WebhookDispatcher:
    def __init__(self, secret: str) -> None:
        self.secret = secret
        self._handlers: Dict[str, List[Callable[[WebhookEvent], None]]] = {}

    def subscribe(self, topic: str, handler: Callable[[WebhookEvent], None]) -> None:
        self._handlers.setdefault(topic, []).append(handler)

    def dispatch(self, event: WebhookEvent) -> List[str]:
        errors: List[str] = []
        envelope = event.envelope(self.secret)
        if not verify_signature(envelope["body"], envelope["headers"]["X-CareOS-Signature"], self.secret, tolerance_seconds=0):
            return ["Signature verification failed"]
        for handler in self._handlers.get(event.topic, []):
            event.attempts += 1
            try:
                handler(event)
                event.delivered = True
            except Exception as exc:  # noqa: BLE001 - dispatcher records handler failures
                errors.append(f"{event.topic}: {exc}")
        return errors

    def topics(self) -> List[str]:
        return sorted(self._handlers)
