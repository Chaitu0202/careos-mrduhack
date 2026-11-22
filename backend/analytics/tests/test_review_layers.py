import unittest
from datetime import datetime, timezone
from pathlib import Path

from backend.analytics.audit import audit_chain_export, build_hash_chain, verify_audit_trail
from backend.analytics.clinical_rules import (
    oversight_findings,
    radiology_pathway_report,
    require_human_approval,
    suggest_pathway,
    triage_appointment,
    triage_queue,
)
from backend.analytics.config import AnalyticsConfig
from backend.analytics.ingest import build_snapshot
from backend.analytics.observability import (
    CounterRegistry,
    EventLog,
    LatencyRecorder,
    build_observability_report,
    evaluate_slos,
    health_score,
)
from backend.analytics.quality import QualityEngine, rule_catalog
from backend.integrations import IdempotencyStore, RetryPolicy, WebhookDispatcher, retry_call, sign_payload, verify_signature


def payload():
    return {
        "users": [],
        "patients": [{"id": "p1", "mrn": "", "fullName": "Patient", "attendingDoctor": "Dr. X", "department": "Emergency"}],
        "appointments": [
            {"id": "a1", "patientName": "Patient", "department": "Emergency", "waitingMinutes": 50, "priority": "STAT", "type": "New"},
            {"id": "a2", "patientName": "Other", "department": "Cardiology", "waitingMinutes": 5, "type": "Follow-up"},
        ],
        "radiologyOrders": [{"id": "r1", "patientName": "Patient", "reason": "Chest pain", "priority": "STAT", "status": "Pending", "examType": "Chest X-Ray"}],
        "bills": [{"id": "b1", "amount": 750, "status": "Pending", "currency": "USD"}],
        "auditLogs": [
            {"id": "log1", "timestamp": "2026-01-01T08:00:00Z", "actorEmail": "a@example.com", "actorRole": "admin", "action": "CREATE", "resource": "a1", "outcome": "Allowed"},
            {"id": "log2", "timestamp": "2026-01-01T09:00:00Z", "actorEmail": "a@example.com", "actorRole": "admin", "action": "VIEW", "resource": "a1", "outcome": "Allowed"},
        ],
        "agents": [],
        "workflows": [],
        "moduleRecords": [],
        "departments": [],
        "notifications": [],
    }


class ReviewLayerTests(unittest.TestCase):
    def setUp(self):
        self.config = AnalyticsConfig()
        self.snapshot = build_snapshot(payload(), datetime(2026, 1, 1, 12, tzinfo=timezone.utc))

    def test_quality_engine_flags_missing_mrn(self):
        findings = QualityEngine().evaluate(self.snapshot)
        self.assertTrue(any(f.id.startswith("DQ-PAT-001") for f in findings))
        self.assertGreaterEqual(rule_catalog(), [])

    def test_audit_verification_and_chain(self):
        verification = verify_audit_trail(self.snapshot, self.config)
        self.assertTrue(verification.ok)
        self.assertEqual(verification.total, 2)
        chain = audit_chain_export(self.snapshot)
        self.assertEqual(chain["algorithm"], "sha256")
        self.assertEqual(len(build_hash_chain(self.snapshot.audit_logs)), 2)

    def test_clinical_triage_priority(self):
        first = triage_appointment(self.snapshot.appointments[0])
        second = triage_appointment(self.snapshot.appointments[1])
        self.assertEqual(first.priority, "Immediate")
        self.assertEqual(second.priority, "Routine")
        self.assertEqual(triage_queue(self.snapshot)[0].appointment_id, "a1")

    def test_clinical_pathways_and_oversight(self):
        self.assertIn("ECG", suggest_pathway("Chest pain"))
        pathways = radiology_pathway_report(self.snapshot)
        self.assertEqual(pathways[0]["pathway"][1], "ECG")
        self.assertTrue(require_human_approval(self.snapshot.bills[0]))
        findings = oversight_findings(self.snapshot)
        self.assertTrue(any(f.id == "CLIN-STAT-r1" for f in findings))

    def test_observability_primitives(self):
        counters = CounterRegistry()
        counters.increment("requests", 2, service="api")
        self.assertEqual(counters.value("requests"), 2)
        latency = LatencyRecorder()
        latency.record_ms(10)
        latency.record_ms(20)
        self.assertGreaterEqual(latency.as_dict()["p95Ms"], 10)
        events = EventLog()
        events.emit("info", "test", key="value")
        self.assertEqual(len(events.recent()), 1)
        breaches = evaluate_slos({"p90_wait_minutes": 90, "agent_success_rate": 95})
        self.assertTrue(any(f.id == "SLO-patient-wait-p90" for f in breaches))
        self.assertLessEqual(health_score(breaches), 100)

    def test_observability_report(self):
        report = build_observability_report(self.snapshot, self.config, {"p90_wait_minutes": 20, "agent_success_rate": 90})
        self.assertIn("healthScore", report)
        self.assertEqual(len(report["slos"]), 5)

    def test_retry_policy(self):
        attempts = {"n": 0}

        def flaky():
            attempts["n"] += 1
            if attempts["n"] < 3:
                raise ConnectionError("down")
            return "ok"

        result = retry_call(flaky, RetryPolicy(max_attempts=4), sleeper=lambda _seconds: None)
        self.assertTrue(result.ok)
        self.assertEqual(result.value, "ok")
        self.assertEqual(result.attempts, 3)

    def test_idempotency_store(self):
        store = IdempotencyStore()
        store.begin("order-1", {"amount": 150})
        store.complete("order-1", {"billId": "b1"})
        self.assertEqual(store.replay("order-1"), {"billId": "b1"})
        with self.assertRaises(ValueError):
            store.begin("order-1", {"amount": 200})

    def test_webhook_signature_and_dispatch(self):
        secret = "test-secret"
        body = {"id": "evt1", "topic": "bill.created", "timestamp": 0, "data": {"billId": "b1"}}
        signature = sign_payload(body, secret)
        self.assertTrue(verify_signature(body, signature, secret, tolerance_seconds=0))
        dispatcher = WebhookDispatcher(secret)
        received = []
        dispatcher.subscribe("bill.created", lambda event: received.append(event.event_id))
        from backend.integrations import WebhookEvent

        errors = dispatcher.dispatch(WebhookEvent("evt1", "bill.created", {"billId": "b1"}))
        self.assertEqual(errors, [])
        self.assertEqual(received, ["evt1"])


if __name__ == "__main__":
    unittest.main()
