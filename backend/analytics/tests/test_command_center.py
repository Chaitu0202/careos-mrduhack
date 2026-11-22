import unittest
from datetime import datetime, timezone

from backend.analytics.audit import verify_audit_trail
from backend.analytics.clinical_rules import oversight_findings
from backend.analytics.command_center import (
    CommandCenterCache,
    agent_snapshot_cards,
    build_command_center,
    collect_findings,
    hospital_performance,
    live_activity,
    to_attention_items,
)
from backend.analytics.config import AnalyticsConfig
from backend.analytics.events import build_event_report
from backend.analytics.ingest import build_snapshot
from backend.analytics.nlp import analyze_command, ground_command
from backend.analytics.quality import QualityEngine, rule_catalog
from backend.analytics.reports_extra import (
    block_outline,
    executive_digest,
    finding_matrix,
    render_csv,
    render_html,
)
from backend.analytics.reports import build_report


def payload():
    return {
        "hospitals": [{"id": "h1", "hospitalId": "HSP-00001", "hospitalName": "Demo Hospital", "workspaceStatus": "Active", "bedsCount": 100}],
        "patients": [{"id": "p1", "mrn": "MRN-1", "fullName": "Asha Rao", "department": "Emergency", "attendingDoctor": "Dr. X"}],
        "appointments": [{"id": "a1", "patientId": "p1", "department": "Emergency", "waitingMinutes": 5, "priority": "Routine"}],
        "radiologyOrders": [],
        "bills": [{"id": "b1", "status": "Pending", "amount": 150}],
        "staff": [{"id": "s1", "name": "Nurse A", "department": "Emergency", "shift": "Morning", "availability": "Available", "activeCases": 2}],
        "departments": [{"id": "d1", "name": "Emergency", "activePatients": 6}],
        "agents": [{"id": "ag1", "name": "Ops Agent", "shortName": "Ops", "status": "Active", "assignedTasks": 10, "completedTasks": 9, "recentActivity": ["done"]}],
        "workflowExecutions": [{"id": "w1", "workflowCode": "WF-A", "status": "Completed", "executedAt": "2026-01-01T10:00:00Z", "instruction": "Coordinate", "intentSummary": "ops", "interAgentMessages": []}],
        "auditLogs": [{"id": "log1", "timestamp": "2026-01-01T08:00:00Z", "actorEmail": "a@example.com", "actorRole": "admin", "action": "VIEW", "resource": "a1", "outcome": "Allowed"}],
        "moduleRecords": [],
        "platformActivity": [{"id": "act1", "message": "Seed applied", "category": "system", "timestamp": "2026-01-01T07:00:00Z"}],
    }


class CommandCenterTests(unittest.TestCase):
    def setUp(self):
        self.config = AnalyticsConfig()
        self.snapshot = build_snapshot(payload(), datetime(2026, 1, 1, 12, tzinfo=timezone.utc))

    def test_collect_findings_from_multiple_sources(self):
        findings = collect_findings(self.snapshot, self.config)
        self.assertIsInstance(findings, list)
        self.assertTrue(all(hasattr(item, "severity") for item in findings))
        self.assertIsInstance(to_attention_items(findings), list)

    def test_command_center_shape(self):
        center = build_command_center(self.snapshot, self.config)
        for key in ("summary", "healthScore", "attentionItems", "triage", "agents", "scheduling", "hospitals", "liveActivity", "intentCatalog"):
            self.assertIn(key, center)
        self.assertEqual(len(center["agents"]), 1)
        self.assertEqual(center["agents"][0]["name"], "Ops Agent")
        self.assertEqual(center["hospitals"][0]["name"], "Demo Hospital")
        self.assertGreater(len(center["liveActivity"]), 0)

    def test_cache_reuses_payload(self):
        cache = CommandCenterCache(ttl_seconds=60)
        first = cache.get(self.snapshot, self.config)
        second = cache.get(self.snapshot, self.config)
        self.assertIs(first, second)
        cache.invalidate()
        self.assertIsNot(cache.get(self.snapshot, self.config), first)

    def test_helper_functions(self):
        self.assertEqual(len(agent_snapshot_cards(self.snapshot)), 1)
        self.assertEqual(len(hospital_performance(self.snapshot)), 1)
        self.assertGreater(len(live_activity(self.snapshot)), 0)
        self.assertEqual(len(rule_catalog()), len(QualityEngine().rules))
        self.assertEqual(len(oversight_findings(self.snapshot)), 0)
        self.assertTrue(verify_audit_trail(self.snapshot, self.config).ok)

    def test_event_report_includes_workflow(self):
        report = build_event_report(self.snapshot)
        self.assertIn("workflow.completed", report["kinds"])

    def test_nlp_grounding(self):
        analysis = analyze_command("Show patient Asha Rao in emergency")
        grounded = ground_command(analysis, self.snapshot)
        self.assertEqual(grounded["patient"]["name"], "Asha Rao")
        self.assertEqual(grounded["department"], "emergency")

    def test_report_extra_renderers(self):
        report = build_report(self.snapshot, self.config)
        self.assertTrue(render_html(report).startswith("<!doctype html>"))
        self.assertIn("metric,value", render_csv(report, "metrics"))
        self.assertIn("CareOS digest", executive_digest(report))
        self.assertIsInstance(finding_matrix(report.findings), dict)
        self.assertIsInstance(block_outline(report), list)


if __name__ == "__main__":
    unittest.main()
