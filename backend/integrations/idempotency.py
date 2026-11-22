"""In-memory idempotency store for CareOS integration events."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional


@dataclass
class IdempotencyRecord:
    key: str
    payload_hash: str
    created_at: float
    result: Any = None
    completed: bool = False

    def as_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "payloadHash": self.payload_hash,
            "createdAt": self.created_at,
            "completed": self.completed,
        }


def payload_hash(payload: Any) -> str:
    import hashlib

    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class IdempotencyStore:
    def __init__(self, ttl_seconds: float = 3600.0) -> None:
        self.ttl_seconds = ttl_seconds
        self._records: Dict[str, IdempotencyRecord] = {}

    def _prune(self, now: float) -> None:
        expired = [key for key, record in self._records.items() if now - record.created_at > self.ttl_seconds]
        for key in expired:
            self._records.pop(key, None)

    def begin(self, key: str, payload: Any) -> IdempotencyRecord:
        now = time.time()
        self._prune(now)
        digest = payload_hash(payload)
        existing = self._records.get(key)
        if existing:
            if existing.payload_hash != digest:
                raise ValueError(f"Idempotency key {key!r} was reused with a different payload")
            return existing
        record = IdempotencyRecord(key=key, payload_hash=digest, created_at=now)
        self._records[key] = record
        return record

    def complete(self, key: str, result: Any) -> IdempotencyRecord:
        record = self._records.get(key)
        if not record:
            raise KeyError(f"Unknown idempotency key {key!r}")
        record.result = result
        record.completed = True
        return record

    def get(self, key: str) -> Optional[IdempotencyRecord]:
        self._prune(time.time())
        return self._records.get(key)

    def replay(self, key: str) -> Any:
        record = self.get(key)
        if not record:
            return None
        return record.result if record.completed else None

    def stats(self) -> Dict[str, int]:
        self._prune(time.time())
        return {
            "keys": len(self._records),
            "completed": sum(1 for record in self._records.values() if record.completed),
            "pending": sum(1 for record in self._records.values() if not record.completed),
        }
