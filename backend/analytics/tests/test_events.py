import unittest
from datetime import datetime, timezone

from backend.analytics.events import DomainEvent, EventStream, ProjectionEngine, build_event_report, events_from_snapshot
from backend.analytics.ingest import build_snapshot


def payload():
    return {
        "appointments": [{"id": "a1", "patientId": "p1", "department": "Emergency", "createdAt": "2026-01-01T08:00:00Z"}],
        "prescriptions": [{"id": "rx1", "patientId": "p1", "fileName": "rx.pdf", "createdAt": "2026-01-01T09:00:00Z"}],
        "radiologyOrders": [
            {
                "id": "rad1",
                "patientId": "p1",
                "examType": "Chest X-Ray",
                "createdAt": "2026-01-01T10:00:00Z",
                "reportFindings": "Clear",
                "reportUploadedAt": "2026-01-01T11:00:00Z",
                "billId": "b1",
            }
        ],
        "bills": [{"id": "b1", "patientId": "p1", "amount": 150, "status": "Paid", "createdAt": "2026-01-01T11:05:00Z"}],
        "workflowExecutions": [
            {
                "id": "wfe1",
                "workflowCode": "WF-XRAY",
                "status": "Completed",
                "executedAt": "2026-01-01T11:10:00Z",
                "instruction": "Coordinate imaging",
                "intentSummary": "xray",
                "interAgentMessages": [],
                "departmentalAlerts": [],
                "pendingApprovals": [],
                "reportSections": [],
            }
        ],
    }


class EventTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = build_snapshot(payload(), datetime(2026, 1, 1, 12, tzinfo=timezone.utc))

    def test_events_from_snapshot(self):
        stream = events_from_snapshot(self.snapshot)
        kinds = {event.kind for event in stream.events}
        self.assertIn("appointment.created", kinds)
        self.assertIn("radiology.reported", kinds)
        self.assertIn("bill.paid", kinds)
        self.assertIn("workflow.completed", kinds)

    def test_stream_ordering_and_filters(self):
        stream = EventStream("test")
        stream.append(DomainEvent("e2", "bill.created", "b1", datetime(2026, 1, 2, tzinfo=timezone.utc)))
        stream.append(DomainEvent("e1", "appointment.created", "a1", datetime(2026, 1, 1, tzinfo=timezone.utc)))
        self.assertEqual([event.event_id for event in stream.events], ["e1", "e2"])
        self.assertEqual(len(stream.since(datetime(2026, 1, 2, tzinfo=timezone.utc))), 1)
        self.assertEqual(len(stream.by_kind("bill.created")), 1)

    def test_invalid_kind_rejected(self):
        stream = EventStream("test")
        with self.assertRaises(ValueError):
            stream.append(DomainEvent("e1", "unknown.event", "x", datetime.now(timezone.utc)))

    def test_projection_engine(self):
        engine = ProjectionEngine()
        engine.register("throughput")
        engine.project(events_from_snapshot(self.snapshot).events)
        state = engine.as_dict()["projections"]["throughput"]["state"]
        self.assertEqual(state["appointment.created_count"], 1)
        self.assertEqual(state["bill.paid_count"], 1)

    def test_build_event_report(self):
        report = build_event_report(self.snapshot)
        self.assertIn("stream", report)
        self.assertIn("projections", report)
        self.assertGreater(report["stream"]["count"], 0)


if __name__ == "__main__":
    unittest.main()
