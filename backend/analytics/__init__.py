"""CareOS Python analytics and compliance service.

This package is intentionally dependency-free so it can run in CI, local
preview, and minimal containers without a separate install step.
"""

from .config import AnalyticsConfig
from .models import AnalyticsReport, HospitalSnapshot

__all__ = ["AnalyticsConfig", "AnalyticsReport", "HospitalSnapshot"]
__version__ = "1.0.0"
