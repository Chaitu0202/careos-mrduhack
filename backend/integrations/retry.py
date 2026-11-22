"""Deterministic retry policy helpers for CareOS outbound calls."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Callable, Iterable, List, Optional, Sequence, Type


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 3
    base_delay_seconds: float = 0.25
    multiplier: float = 2.0
    max_delay_seconds: float = 4.0
    retryable: Sequence[Type[BaseException]] = (ConnectionError, TimeoutError, OSError)

    def delays(self) -> List[float]:
        values: List[float] = []
        delay = self.base_delay_seconds
        for _ in range(max(0, self.max_attempts - 1)):
            values.append(min(delay, self.max_delay_seconds))
            delay *= self.multiplier
        return values

    def should_retry(self, error: BaseException) -> bool:
        return any(isinstance(error, error_type) for error_type in self.retryable)


@dataclass
class RetryResult:
    value: Any = None
    attempts: int = 0
    delays: List[float] = None  # type: ignore[assignment]
    error: Optional[BaseException] = None

    def __post_init__(self) -> None:
        if self.delays is None:
            self.delays = []

    @property
    def ok(self) -> bool:
        return self.error is None

    def as_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "attempts": self.attempts,
            "delays": list(self.delays or []),
            "error": str(self.error) if self.error else None,
        }


def retry_call(
    function: Callable[[], Any],
    policy: RetryPolicy | None = None,
    sleeper: Callable[[float], None] = time.sleep,
) -> RetryResult:
    resolved = policy or RetryPolicy()
    result = RetryResult()
    for index in range(resolved.max_attempts):
        result.attempts = index + 1
        try:
            result.value = function()
            result.error = None
            return result
        except BaseException as exc:  # noqa: BLE001 - policy decides retryability
            result.error = exc
            if index >= resolved.max_attempts - 1 or not resolved.should_retry(exc):
                break
            delay = resolved.delays()[index]
            result.delays.append(delay)
            sleeper(delay)
    return result


def retry_pipeline(steps: Iterable[Callable[[], Any]], policy: RetryPolicy | None = None) -> List[RetryResult]:
    return [retry_call(step, policy, sleeper=lambda _seconds: None) for step in steps]
