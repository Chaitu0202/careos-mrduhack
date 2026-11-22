import unittest
from datetime import datetime, timezone

from backend.analytics.config import AnalyticsConfig, Thresholds
from backend.analytics.ingest import build_snapshot
from backend.analytics.metrics import (
    build_metric_registry,
    calculate_all,
    compute_core_metrics,
    percentile,
    safe_divide,
)


def sample_payload():
    return {
        "users": [{"id": "u1", "fullName": "Admin"}],
        "patients": [
            {"id": "p1", "mrn": "MRN-1", "admissionStatus": "Admitted"},
            {"id": "p2", "mrn": "MRN-2", "admissionStatus": "Discharged"},
        ],
        "appointments": [
            {
                "id": "a1",
                "department": "Emergency",
                "waitingMinutes": 12,
                "createdAt": "2026-01-01T08:00:00Z",
                "status": "Completed",
            },
            {
                "id": "a2",
                "department": "Cardiology",
                "waitingMinutes": 30,
                "createdAt": "2026-01-01T09:00:00Z",
                "status": "Checked In",
            },
        ],
        "radiologyOrders": [
            {"id": "r1", "status": "Completed"},
            {"id": "r2", "status": "Pending"},
        ],
        "bills": [
            {"id": "b1", "amount": 150, "status": "Pending"},
            {"id": "b2", "amount": 320, "status": "Paid"},
        ],
        "resources": [
            {
                "id": "res1",
                "name": "Inpatient Ward & ICU Beds",
                "total": 100,
                "available": 25,
                "inUse": 70,
                "maintenance": 5,
            }
        ],
        "agents": [
            {
                "id": "agent1",
                "name": "Clinical Assistant",
                "shortName": "Clinical",
                "status": "Active",
                "assignedTasks": 10,
                "completedTasks": 8,
                "pendingTasks": 2,
                "avgResponseSeconds": 1.5,
                "recentActivity": [{"outcome": "Completed"}],
            }
        ],
        "workflowExecutions": [
            {
                "id": "wfe1",
                "workflowCode": "WF-1",
                "instruction": "Test",
                "status": "Completed",
                "executionMs": 2000,
                "pendingApprovals": [],
                "interAgentMessages": [{"id": "m1"}],
                "reportSections": [{"title": "S1", "items": []}],
            }
        ],
        "moduleRecords": [
            {"id": "m1", "module": "billing", "status": "Flagged"},
            {"id": "m2", "module": "billing", "status": "Completed"},
        ],
    }


class MetricTests(unittest.TestCase):
    def setUp(self):
        self.config = AnalyticsConfig(thresholds=Thresholds())
        self.snapshot = build_snapshot(sample_payload(), datetime(2026, 1, 1, tzinfo=timezone.utc))

    def test_safe_divide_handles_zero(self):
        self.assertEqual(safe_divide(10, 0), 0.0)
        self.assertEqual(safe_divide(10, 4), 2.5)

    def test_percentile_interpolates(self):
        self.assertEqual(percentile([1, 2, 3, 4], 0.5), 2.5)
        self.assertEqual(percentile([], 0.5), 0.0)

    def test_core_metrics_are_populated(self):
        metrics = compute_core_metrics(self.snapshot, self.config)
        self.assertEqual(metrics["patient_count"], 2.0)
        self.assertEqual(metrics["appointment_count"], 2.0)
        self.assertEqual(metrics["average_wait_minutes"], 21.0)
        self.assertEqual(metrics["radiology_completion_rate"], 50.0)
        self.assertEqual(metrics["billing_total_usd"], 470.0)
        self.assertEqual(metrics["billing_collection_rate"], 320 / 470 * 100)

    def test_metric_registry_has_all_series(self):
        registry = build_metric_registry(self.snapshot)
        expected = {
            "appointments",
            "waiting_patients",
            "average_wait_minutes",
            "bed_occupancy",
            "radiology_queue",
            "open_approvals",
            "agent_completed_tasks",
            "agent_success_rate",
            "workflow_execution_ms",
            "module_flagged_records",
        }
        self.assertEqual(set(registry), expected)
        self.assertGreater(len(registry["appointments"].points), 0)

    def test_calculate_all_contains_families(self):
        result = calculate_all(self.snapshot, self.config)
        for key in ("core", "agents", "departments", "modules", "finance", "throughput"):
            self.assertIn(key, result)


if __name__ == "__main__":
    unittest.main()
