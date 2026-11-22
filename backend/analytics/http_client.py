"""Small standard-library HTTP client with circuit breaker for CareOS adapters."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, Mapping, Optional, Sequence

from .security import redact_mapping


@dataclass
class HttpResponse:
    status: int
    body: bytes
    headers: Dict[str, str] = field(default_factory=dict)

    def json(self) -> Any:
        return json.loads(self.body.decode("utf-8"))

    def text(self) -> str:
        return self.body.decode("utf-8")

    def as_dict(self) -> Dict[str, Any]:
        return {"status": self.status, "bytes": len(self.body), "headers": dict(self.headers)}


class CircuitOpenError(RuntimeError):
    pass


@dataclass
class CircuitBreaker:
    failure_threshold: int = 3
    cooldown_seconds: float = 30.0
    failures: int = 0
    opened_at: Optional[float] = None

    def allow(self) -> bool:
        if self.opened_at is None:
            return True
        if time.time() - self.opened_at >= self.cooldown_seconds:
            self.reset()
            return True
        return False

    def record_success(self) -> None:
        self.reset()

    def record_failure(self) -> None:
        self.failures += 1
        if self.failures >= self.failure_threshold:
            self.opened_at = time.time()

    def reset(self) -> None:
        self.failures = 0
        self.opened_at = None

    def as_dict(self) -> Dict[str, Any]:
        return {
            "state": "open" if self.opened_at and not self.allow() else "closed",
            "failures": self.failures,
            "cooldownSeconds": self.cooldown_seconds,
        }


class CareOSHttpClient:
    def __init__(self, base_url: str = "", timeout_seconds: float = 5.0, breaker: Optional[CircuitBreaker] = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.breaker = breaker or CircuitBreaker()

    def url_for(self, path: str, query: Optional[Mapping[str, Any]] = None) -> str:
        url = f"{self.base_url}/{path.lstrip('/')}" if self.base_url else path
        if query:
            clean = {key: value for key, value in query.items() if value is not None}
            url += ("&" if "?" in url else "?") + urllib.parse.urlencode(clean)
        return url

    def request(
        self,
        method: str,
        path: str,
        payload: Any = None,
        headers: Optional[Mapping[str, str]] = None,
        query: Optional[Mapping[str, Any]] = None,
    ) -> HttpResponse:
        if not self.breaker.allow():
            raise CircuitOpenError("Circuit breaker is open")
        request_headers = {"Accept": "application/json", **(headers or {})}
        data: Optional[bytes] = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            request_headers.setdefault("Content-Type", "application/json")
        request = urllib.request.Request(self.url_for(path, query), data=data, headers=request_headers, method=method.upper())
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                result = HttpResponse(
                    status=response.status,
                    body=response.read(),
                    headers={key: value for key, value in response.headers.items()},
                )
            self.breaker.record_success()
            return result
        except urllib.error.HTTPError as exc:
            self.breaker.record_failure()
            return HttpResponse(status=exc.code, body=exc.read(), headers=dict(exc.headers.items()))
        except Exception:
            self.breaker.record_failure()
            raise

    def get(self, path: str, query: Optional[Mapping[str, Any]] = None, headers: Optional[Mapping[str, str]] = None) -> HttpResponse:
        return self.request("GET", path, query=query, headers=headers)

    def post(self, path: str, payload: Any, headers: Optional[Mapping[str, str]] = None) -> HttpResponse:
        return self.request("POST", path, payload=payload, headers=headers)

    def health(self, path: str = "/health") -> Dict[str, Any]:
        try:
            response = self.get(path)
            return {"ok": response.status == 200, "status": response.status, "breaker": self.breaker.as_dict()}
        except CircuitOpenError:
            return {"ok": False, "status": None, "breaker": self.breaker.as_dict()}

    def audit_request(self, method: str, path: str, payload: Any) -> Dict[str, Any]:
        return redact_mapping({"method": method, "path": path, "payload": payload})
