import unittest
from datetime import datetime, timezone

from backend.analytics.clinical_rules import triage_queue
from backend.analytics.http_client import CareOSHttpClient, CircuitBreaker, CircuitOpenError
from backend.analytics.ingest import build_snapshot
from backend.analytics.migrations import MIGRATIONS, current_version, migrate_payload, migration_catalog
from backend.analytics.nlp import analyze_command, extract_entities, intent_catalog, render_summary
from backend.analytics.privacy import assess_privacy, k_anonymity, minimum_necessary, pseudonymize
from backend.analytics.scheduling import build_shift_plans, coverage_gaps, normalize_staff, scheduling_summary


def payload():
    return {
        "patients": [
            {"id": "p1", "fullName": "Asha Rao", "mrn": "MRN-1", "department": "Emergency", "attendingDoctor": "Dr. X", "email": "asha@example.com"},
            {"id": "p2", "fullName": "Ravi Kumar", "mrn": "MRN-2", "department": "Emergency", "attendingDoctor": "Dr. X"},
            {"id": "p3", "fullName": "Meera Iyer", "mrn": "MRN-3", "department": "Cardiology", "attendingDoctor": "Dr. Y"},
        ],
        "appointments": [{"id": "a1", "patientId": "p1", "department": "Emergency", "waitingMinutes": 30}],
        "bills": [{"id": "b1", "status": "Pending", "amount": 150}],
        "staff": [
            {"id": "s1", "name": "Nurse A", "role": "Nurse", "department": "Emergency", "shift": "Morning", "availability": "Available", "activeCases": 5},
            {"id": "s2", "name": "Nurse B", "role": "Nurse", "department": "Emergency", "shift": "Morning", "availability": "Available", "activeCases": 1},
            {"id": "s3", "name": "Tech C", "role": "Tech", "department": "Radiology", "shift": "Evening", "availability": "On Duty", "activeCases": 2},
        ],
        "departments": [{"id": "d1", "name": "Emergency", "activePatients": 12}, {"id": "d2", "name": "Radiology", "activePatients": 4}],
        "auditLogs": [],
        "moduleRecords": [],
        "workflowExecutions": [],
        "version": 1,
    }


class OperationModuleTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = build_snapshot(payload(), datetime(2026, 1, 1, tzinfo=timezone.utc))

    def test_nlp_intent_and_entities(self):
        analysis = analyze_command("Create an urgent STAT chest X-Ray bill for patient Asha Rao in radiology")
        self.assertEqual(analysis.intent.name, "radiology")
        self.assertIn(analysis.intent.entities["priority"].lower(), {"urgent", "stat"})
        self.assertTrue(analysis.voice_confirmation)
        self.assertIn("Patient:", render_summary(analysis))
        self.assertGreaterEqual(len(intent_catalog()), 8)

    def test_nlp_entity_extraction(self):
        entities = extract_entities("Invoice for $150.00 on 2026-01-01 in cardiology")
        self.assertEqual(entities["amount"], "150.00")
        self.assertEqual(entities["date"], "2026-01-01")
        self.assertEqual(entities["department"], "cardiology")

    def test_privacy_helpers(self):
        limited = minimum_necessary(self.snapshot.patients[0], ("id", "mrn", "email"))
        self.assertEqual(set(limited), {"id", "mrn", "email"})
        self.assertEqual(k_anonymity(self.snapshot.patients, ("department", "attendingDoctor")), 1)
        self.assertTrue(pseudonymize("p1").startswith("anon-"))
        report = assess_privacy(self.snapshot)
        self.assertGreaterEqual(report.records_scanned, 3)
        self.assertIn("ok", report.as_dict())

    def test_scheduling_plans(self):
        members = normalize_staff(self.snapshot)
        self.assertEqual(len(members), 3)
        plans = build_shift_plans(self.snapshot)
        self.assertGreaterEqual(len(plans), 6)
        self.assertIsInstance(coverage_gaps(plans), list)
        summary = scheduling_summary(self.snapshot)
        self.assertEqual(summary["staffCount"], 3)
        self.assertGreaterEqual(summary["planCount"], 6)

    def test_http_client_helpers(self):
        client = CareOSHttpClient("http://example.test")
        self.assertEqual(client.url_for("/health"), "http://example.test/health")
        self.assertIn("a=1", client.url_for("path", {"a": 1, "b": None}))
        self.assertEqual(client.audit_request("POST", "/api", {"token": "secret"})["payload"]["token"], "[redacted]")
        breaker = CircuitBreaker(failure_threshold=2, cooldown_seconds=60)
        self.assertTrue(breaker.allow())
        breaker.record_failure()
        breaker.record_failure()
        self.assertFalse(breaker.allow())
        with self.assertRaises(CircuitOpenError):
            CareOSHttpClient("", breaker=breaker).get("/health")

    def test_migrations(self):
        migrated, result = migrate_payload(payload())
        self.assertEqual(result.from_version, 1)
        self.assertEqual(result.to_version, MIGRATIONS[-1].version)
        self.assertTrue(result.changed)
        self.assertEqual(current_version(migrated), MIGRATIONS[-1].version)
        self.assertIn("integrations", migrated)
        self.assertGreaterEqual(len(migration_catalog()), 4)

    def test_triage_still_available(self):
        self.assertTrue(triage_queue(self.snapshot))


if __name__ == "__main__":
    unittest.main()
