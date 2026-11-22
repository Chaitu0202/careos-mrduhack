"""Lightweight, dependency-free forecasting for CareOS capacity planning."""

from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from statistics import mean
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .config import AnalyticsConfig
from .models import Timeseries


@dataclass(frozen=True)
class LinearFit:
    slope: float
    intercept: float
    r_squared: float

    def predict(self, x: float) -> float:
        return self.slope * x + self.intercept


def fit_linear(xs: Sequence[float], ys: Sequence[float]) -> Optional[LinearFit]:
    if len(xs) != len(ys) or len(xs) < 2:
        return None
    x_mean = mean(xs)
    y_mean = mean(ys)
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    denominator = sum((x - x_mean) ** 2 for x in xs)
    if denominator == 0:
        return None
    slope = numerator / denominator
    intercept = y_mean - slope * x_mean
    predicted = [slope * x + intercept for x in xs]
    residual_ss = sum((y - p) ** 2 for y, p in zip(ys, predicted))
    total_ss = sum((y - y_mean) ** 2 for y in ys)
    r_squared = 1 - residual_ss / total_ss if total_ss else 1.0
    return LinearFit(slope, intercept, r_squared)


def exponential_smoothing(values: Sequence[float], alpha: float = 0.4) -> List[float]:
    if not values:
        return []
    smoothed = [values[0]]
    for value in values[1:]:
        smoothed.append(alpha * value + (1 - alpha) * smoothed[-1])
    return smoothed


def forecast_series(series: Timeseries, horizon: int = 3) -> Dict[str, Any]:
    values = series.values()
    if not values:
        return {"metric": series.name, "horizon": horizon, "forecast": [], "confidence": 0.0}
    xs = list(range(len(values)))
    fit = fit_linear(xs, values)
    if fit is None:
        return {
            "metric": series.name,
            "horizon": horizon,
            "forecast": [values[-1]] * horizon,
            "confidence": 0.0,
            "method": "last_value",
        }
    smoothed = exponential_smoothing(values)
    last_level = smoothed[-1]
    projections: List[float] = []
    for step in range(1, horizon + 1):
        trend = fit.predict(len(values) - 1 + step)
        level_component = last_level + fit.slope * step
        projections.append(max(0.0, 0.6 * trend + 0.4 * level_component))
    residuals = [abs(y - fit.predict(x)) for x, y in zip(xs, values)]
    error = mean(residuals) if residuals else 0.0
    scale = abs(mean(values)) or 1.0
    confidence = max(0.0, min(1.0, fit.r_squared * (1 - min(error / scale, 1.0))))
    return {
        "metric": series.name,
        "horizon": horizon,
        "forecast": [round(value, 3) for value in projections],
        "confidence": round(confidence, 4),
        "method": "linear_trend_with_smoothing",
        "slope": round(fit.slope, 4),
        "rSquared": round(fit.r_squared, 4),
    }


def forecast_all(registry: Dict[str, Timeseries], config: AnalyticsConfig) -> Dict[str, Any]:
    if not config.enable_forecasts:
        return {"enabled": False, "series": {}}
    horizon = max(1, min(12, config.window_minutes // 20 or 3))
    return {
        "enabled": True,
        "horizon": horizon,
        "series": {name: forecast_series(series, horizon) for name, series in registry.items()},
    }


def simple_rolling_average(values: Sequence[float], window: int = 3) -> List[float]:
    """Compatibility helper retained for older notebook imports."""
    if window <= 0:
        return []
    return [mean(values[max(0, index - window + 1) : index + 1]) for index in range(len(values))]
