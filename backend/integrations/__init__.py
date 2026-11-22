"""CareOS integration adapters.

These dependency-free helpers model the external-system concerns that a
production healthcare deployment needs: retries, idempotency, webhook signing,
and notification delivery. They are used by analytics review and can be reused
by the Express API when migrating off the preview JSON store.
"""

from .idempotency import IdempotencyStore
from .retry import RetryPolicy, retry_call
from .webhook import WebhookDispatcher, WebhookEvent, sign_payload, verify_signature

__all__ = [
    "IdempotencyStore",
    "RetryPolicy",
    "retry_call",
    "WebhookDispatcher",
    "WebhookEvent",
    "sign_payload",
    "verify_signature",
]
