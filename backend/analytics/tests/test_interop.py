import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from backend.analytics.config import AnalyticsConfig
from backend.analytics.dicom import build_worklist, modality_for_exam, validate_item, validate_worklist, worklist_item
from backend.analytics.export import export_snapshot, rows_to_csv, rows_to_jsonl
from backend.analytics.fhir import build_bundle, diagnostic_report_resource, patient_resource, validate_bundle
from backend.analytics.hl7 import build_messages, build_orm_message, validate_message
from backend.analytics.ingest import build_snapshot
from backend.analytics.simulation import SimulationInput, run_scenarios, simulate


def payload():
    return {
        "patients": [{"id": "p1", "mrn": "MRN-1", "fullName": "Asha Rao", "gender": "Female", "age": 34, "phone": "+91 98480 10001", "email": "asha@example.com"}],
        "appointments": [{
            "id": "a1", "patientId": "p1", "patientName": "Asha Rao", "department": "Emergency",
            "doctorName": "Dr. Mehta", "date": "2026-01-01", "time": "08:30", "status": "Completed",
            "waitingMinutes": 18, "createdAt": "2026-01-01T08:00:00Z", "queueJoinedAt": "2026-01-01T08:20:00Z",
        }],
        "radiologyOrders": [{
            "id": "r1", "appointmentId": "a1", "patientId": "p1", "patientName": "Asha Rao",
            "examType": "Chest X-Ray", "reason": "Cough", "priority": "Urgent", "status": "Completed",
            "doctorName": "Dr. Mehta", "createdAt": "2026-01-01T09:00:00Z",
            "reportFindings": "Clear lung fields", "reportImpression": "No acute abnormality",
        }],
        "bills": [{"id": "b1", "patientId": "p1", "patientName": "Asha Rao", "amount": 150, "status": "Paid", "currency": "USD", "createdAt": "2026-01-01T10:00:00Z", "description": "X-ray"}],
        "departments": [{"id": "d1", "name": "Emergency"}],
        "notifications": [],
        "auditLogs": [],
        "moduleRecords": [],
    }


class InteropTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = build_snapshot(payload(), datetime(2026, 1, 1, tzinfo=timezone.utc))
        self.config = AnalyticsConfig()

    def test_fhir_patient_and_bundle(self):
        resource = patient_resource(self.snapshot.patients[0])
        self.assertEqual(resource["resourceType"], "Patient")
        self.assertEqual(resource["identifier"][0]["value"], "MRN-1")
        bundle = build_bundle(self.snapshot)
        self.assertEqual(bundle["total"], 5)
        self.assertEqual(validate_bundle(bundle), [])

    def test_fhir_diagnostic_report_contains_conclusion(self):
        report = diagnostic_report_resource(self.snapshot.radiology_orders[0])
        self.assertIn("Clear lung fields", report["conclusion"])

    def test_hl7_message_segments(self):
        message = build_orm_message(self.snapshot.radiology_orders[0], "CAR000001")
        self.assertIn("ORM^O01", message)
        self.assertIn("OBR", message)
        self.assertEqual(validate_message(message), [])

    def test_hl7_messages_for_snapshot(self):
        messages = build_messages(self.snapshot)
        self.assertEqual(list(messages), ["r1"])
        for error in validate_message(messages["r1"]):
            self.fail(error)

    def test_dicom_worklist(self):
        self.assertEqual(modality_for_exam("Chest X-Ray"), "DX")
        item = worklist_item(self.snapshot.radiology_orders[0])
        self.assertEqual(item["AccessionNumber"], "r1")
        self.assertEqual(item["Modality"], "DX")
        self.assertEqual(validate_item(item), [])
        result = validate_worklist(build_worklist(self.snapshot))
        self.assertTrue(result["ok"])
        self.assertEqual(result["itemCount"], 1)

    def test_export_writes_expected_files(self):
        with tempfile.TemporaryDirectory() as directory:
            written = export_snapshot(self.snapshot, Path(directory), self.config)
            self.assertIn("patients.csv", written)
            self.assertIn("fhir-bundle.json", written)
            self.assertIn("hl7-orm-messages.txt", written)
            self.assertGreater(json.loads((Path(directory) / "fhir-bundle.json").read_text(encoding="utf-8"))["total"], 0)

    def test_csv_and_jsonl_helpers(self):
        csv_text = rows_to_csv([{"id": "1", "meta": {"a": 1}}, {"id": "2", "meta": {"b": 2}}])
        self.assertIn("id,meta", csv_text)
        jsonl = rows_to_jsonl([{"email": "a@example.com"}], redact=True)
        self.assertIn("[email-redacted]", jsonl)

    def test_simulation_is_deterministic(self):
        first = simulate("base", SimulationInput(arrivals=20, service_minutes=10, servers=2))
        second = simulate("base", SimulationInput(arrivals=20, service_minutes=10, servers=2))
        self.assertEqual(first.as_dict(), second.as_dict())
        self.assertGreaterEqual(first.served, 1)
        self.assertLessEqual(first.utilization, 1.0)

    def test_snapshot_scenarios(self):
        result = run_scenarios(self.snapshot, self.config)
        self.assertEqual(len(result["results"]), 3)
        self.assertTrue(result["recommendation"])


if __name__ == "__main__":
    unittest.main()
