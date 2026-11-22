import unittest
from datetime import datetime, timezone

from backend.analytics.config import AnalyticsConfig
from backend.analytics.forecasting import exponential_smoothing, fit_linear, forecast_series
from backend.analytics.ingest import build_snapshot
from backend.analytics.models import Timeseries
from backend.analytics.reports import build_report, render_json, render_markdown
from backend.analytics.anomalies import detect_iqr_outliers


def minimal_payload():
    return {
        "patients": [{"id": "p1", "mrn": "MRN-1", "attendingDoctor": "Dr. X"}],
        "appointments": [
            {
                "id": "a1",
                "department": "Cardiology",
                "waitingMinutes": 10,
                "createdAt": "2026-01-01T08:00:00Z",
                "status": "Completed",
            }
        ],
        "radiologyOrders": [{"id": "r1", "status": "Completed"}],
        "bills": [{"id": "b1", "amount": 150, "status": "Paid"}],
        "resources": [{"id": "res1", "name": "Beds", "total": 10, "available": 5, "inUse": 5, "maintenance": 0}],
        "agents": [
            {
                "id": "agent1",
                "name": "Agent",
                "shortName": "AG",
                "status": "Active",
                "assignedTasks": 5,
                "completedTasks": 5,
                "pendingTasks": 0,
                "avgResponseSeconds": 1.0,
                "recentActivity": [],
            }
        ],
        "workflowExecutions": [],
        "moduleRecords": [],
        "users": [],
        "auditLogs": [],
    }


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.config = AnalyticsConfig()
        self.snapshot = build_snapshot(minimal_payload(), datetime(2026, 1, 1, tzinfo=timezone.utc))

    def test_build_report_has_expected_shape(self):
        report = build_report(self.snapshot, self.config)
        payload = report.as_dict()
        for key in ("generatedAt", "summary", "metrics", "timeseries", "agents", "findings", "blocks"):
            self.assertIn(key, payload)
        self.assertGreater(len(report.blocks), 0)

    def test_markdown_contains_executive_summary(self):
        report = build_report(self.snapshot, self.config)
        markdown = render_markdown(report)
        self.assertIn("# CareOS Operational Intelligence Report", markdown)
        self.assertIn("## Executive Summary", markdown)

    def test_json_is_parseable(self):
        import json

        report = build_report(self.snapshot, self.config)
        payload = json.loads(render_json(report))
        self.assertEqual(payload["summary"]["appointments"], 1)

    def test_linear_fit_and_forecast(self):
        fit = fit_linear([0, 1, 2, 3], [2, 4, 6, 8])
        self.assertIsNotNone(fit)
        self.assertAlmostEqual(fit.slope, 2.0)
        self.assertAlmostEqual(fit.intercept, 2.0)

        series = Timeseries("test")
        for index, value in enumerate([2, 4, 6, 8]):
            series.add(type("P", (), {"name": "test", "value": float(value), "timestamp": datetime(2026, 1, 1, tzinfo=timezone.utc), "labels": {}, "as_dict": lambda: {}})())
        result = forecast_series(series, 2)
        self.assertEqual(result["method"], "linear_trend_with_smoothing")
        self.assertEqual(len(result["forecast"]), 2)

    def test_exponential_smoothing_and_iqr(self):
        self.assertEqual(exponential_smoothing([]), [])
        self.assertEqual(exponential_smoothing([1, 2, 3])[0], 1)
        self.assertIn(200.0, detect_iqr_outliers([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 200]))


if __name__ == "__main__":
    unittest.main()
