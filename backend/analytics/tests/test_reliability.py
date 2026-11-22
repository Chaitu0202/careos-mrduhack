import unittest
from datetime import datetime, timezone

from backend.analytics.config import AnalyticsConfig
from backend.analytics.ingest import build_snapshot
from backend.analytics.metrics import calculate_all
from backend.analytics.observability import DEFAULT_SLOS, SLO
from backend.analytics.reliability import (
    ErrorBudget,
    assess_dependencies,
    build_error_budgets,
    build_reliability_report,
    burn_rate_findings,
    dependency_findings,
    incident_triggers,
    reliability_score,
)


def payload():
    return {
        "integrations": [
            {"id": "int-ehr", "name": "Electronic Health Record", "category": "clinical", "availability": "supported", "protocol": "FHIR R4", "connected": True},
            {"id": "int-ris", "name": "Radiology Information System", "category": "clinical", "availability": "supported", "protocol": "HL7 v2", "connected": False},
        ],
        "appointments": [{"id": "a1", "waitingMinutes": 10}],
        "agents": [{"id": "ag1", "name": "Ops", "shortName": "Ops", "assignedTasks": 10, "completedTasks": 9}],
        "bills": [],
        "hospitals": [],
        "workflowExecutions": [],
    }


class ReliabilityTests(unittest.TestCase):
    def setUp(self):
        self.config = AnalyticsConfig()
        self.snapshot = build_snapshot(payload(), datetime(2026, 1, 1, tzinfo=timezone.utc))
        self.metrics = calculate_all(self.snapshot, self.config)["core"]

    def test_error_budget_calculation(self):
        budgets = build_error_budgets({"p90_wait_minutes": 20, "agent_success_rate": 95})
        self.assertEqual(len(budgets), len(DEFAULT_SLOS))
        wait = next(budget for budget in budgets if budget.slo == "patient-wait-p90")
        self.assertTrue(wait.compliant)
        self.assertIn(wait.status, {"healthy", "watch"})
        self.assertGreaterEqual(wait.remaining_ratio, 0.0)

    def test_breached_budget_produces_finding(self):
        budget = ErrorBudget("slow", "p90_wait_minutes", 45, 200, "<=")
        self.assertFalse(budget.compliant)
        self.assertGreater(budget.burn_rate, 1.0)
        findings = burn_rate_findings([budget])
        self.assertTrue(any(finding.id == "REL-BURN-slow" for finding in findings))
        self.assertTrue(findings)
        self.assertIn(findings[0].severity, {"low", "medium", "high", "critical"})

    def test_custom_slo_comparators(self):
        greater = ErrorBudget("rate", "success", 80, 90, ">=")
        self.assertTrue(greater.compliant)
        equal = ErrorBudget("exact", "count", 5, 5, "==")
        self.assertTrue(equal.compliant)
        custom = build_error_budgets({"p90_wait_minutes": 10}, [SLO("custom", "p90_wait_minutes", 45, "<=", 1440)])
        self.assertEqual(custom[0].window_days, 1)

    def test_dependency_health(self):
        rows = assess_dependencies(self.snapshot, {})
        ehr = next(row for row in rows if row.name == "Electronic Health Record")
        ris = next(row for row in rows if row.name == "Radiology Information System")
        self.assertTrue(ehr.healthy)
        self.assertFalse(ris.healthy)
        findings = dependency_findings(rows)
        self.assertTrue(any("Radiology Information System" in finding.title for finding in findings))

    def test_optional_dependencies_do_not_fail(self):
        rows = assess_dependencies(self.snapshot, {"GEMINI_API_KEY1": "key"})
        gemini = next(row for row in rows if row.name == "Gemini Orchestration")
        self.assertTrue(gemini.configured)
        self.assertTrue(gemini.healthy)

    def test_score_and_triggers(self):
        budgets = build_error_budgets({"p90_wait_minutes": 300, "agent_success_rate": 10})
        rows = assess_dependencies(self.snapshot, {})
        score = reliability_score(budgets, rows)
        self.assertLess(score, 100)
        triggers = incident_triggers(budgets, rows)
        self.assertGreater(len(triggers), 0)
        self.assertTrue(all({"id", "severity", "title", "action"} <= set(item) for item in triggers))

    def test_full_report(self):
        report = build_reliability_report(self.snapshot, self.config, self.metrics, {})
        data = report.as_dict()
        for key in ("generatedAt", "score", "budgets", "dependencies", "findings", "triggers"):
            self.assertIn(key, data)
        self.assertGreaterEqual(len(data["budgets"]), 5)


if __name__ == "__main__":
    unittest.main()
