import unittest
from datetime import datetime, timezone

from backend.analytics.compliance import compliance_score, run_compliance
from backend.analytics.config import AnalyticsConfig
from backend.analytics.ingest import build_snapshot
from backend.analytics.security import redact_mapping, stable_hash


def base_payload():
    return {
        "users": [
            {
                "id": "u1",
                "fullName": "Admin",
                "email": "admin@example.com",
                "role": "admin",
                "status": "active",
                "contactNumber": "Ext 1",
            }
        ],
        "patients": [{"id": "p1", "fullName": "Patient", "mrn": "MRN-1", "userId": "u1", "portalUsername": "PAT-1"}],
        "appointments": [],
        "workflowExecutions": [
            {
                "id": "wfe1",
                "workflowCode": "WF-1",
                "status": "Completed",
                "instruction": "Test",
                "pendingApprovals": [],
                "interAgentMessages": [{"id": "m1"}],
                "reportSections": [{"title": "T", "items": []}],
            }
        ],
        "auditLogs": [
            {
                "id": "a1",
                "timestamp": "2026-01-01T10:00:00Z",
                "actorEmail": "admin@example.com",
                "actorRole": "admin",
                "action": "TEST",
                "resource": "WF-1",
                "outcome": "Allowed",
            }
        ],
    }


class ComplianceTests(unittest.TestCase):
    def setUp(self):
        self.config = AnalyticsConfig()
        self.snapshot = build_snapshot(base_payload(), datetime(2026, 1, 1, 12, tzinfo=timezone.utc))

    def test_clean_dataset_produces_no_findings(self):
        findings = run_compliance(self.snapshot, self.config)
        self.assertEqual(findings, [])
        self.assertEqual(compliance_score(findings), 100.0)

    def test_missing_user_field_is_flagged(self):
        payload = base_payload()
        payload["users"][0].pop("contactNumber")
        snapshot = build_snapshot(payload, datetime(2026, 1, 1, 12, tzinfo=timezone.utc))
        findings = run_compliance(snapshot, self.config)
        self.assertTrue(any(f.id == "GOV-USER-u1" for f in findings))

    def test_open_approval_is_flagged(self):
        payload = base_payload()
        payload["workflowExecutions"][0]["pendingApprovals"] = [
            {"id": "apr1", "title": "Approve", "department": "Finance", "description": "x", "approved": False}
        ]
        snapshot = build_snapshot(payload, datetime(2026, 1, 1, 12, tzinfo=timezone.utc))
        findings = run_compliance(snapshot, self.config)
        self.assertTrue(any(f.id == "GOV-APPR-wfe1" for f in findings))

    def test_redaction_removes_pii_and_secrets(self):
        redacted = redact_mapping(
            {
                "email": "user@example.com",
                "phone": "+91 98480 10001",
                "mrn": "MRN-10001",
                "passwordHash": "abc",
                "nested": {"token": "secret"},
            }
        )
        self.assertEqual(redacted["email"], "[email-redacted]")
        self.assertEqual(redacted["passwordHash"], "[redacted]")
        self.assertEqual(redacted["nested"]["token"], "[redacted]")
        self.assertIn("mrn", redacted)

    def test_stable_hash_is_deterministic(self):
        self.assertEqual(stable_hash("patient-1"), stable_hash("patient-1"))
        self.assertNotEqual(stable_hash("patient-1"), stable_hash("patient-2"))


if __name__ == "__main__":
    unittest.main()
