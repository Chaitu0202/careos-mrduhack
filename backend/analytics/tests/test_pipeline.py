import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from backend.analytics.config import AnalyticsConfig
from backend.analytics.pipeline import (
    PipelineRun,
    run_pipeline,
    stage_governance,
    stage_ingest,
    stage_interoperability,
    stage_metrics,
)
from backend.analytics.ingest import build_snapshot


def payload():
    return {
        "patients": [{"id": "p1", "mrn": "MRN-1", "attendingDoctor": "Dr. X"}],
        "appointments": [{"id": "a1", "patientId": "p1", "status": "Completed", "waitingMinutes": 5}],
        "radiologyOrders": [],
        "bills": [],
        "departments": [{"id": "d1", "name": "Cardiology"}],
        "notifications": [],
        "auditLogs": [],
        "moduleRecords": [],
        "users": [],
        "workflowExecutions": [],
    }


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.config = AnalyticsConfig()
        self.snapshot = build_snapshot(payload(), datetime(2026, 1, 1, tzinfo=timezone.utc))

    def test_stage_ingest(self):
        stage = stage_ingest(self.snapshot, self.config)
        self.assertTrue(stage.ok)
        self.assertEqual(stage.output["summary"]["patients"], 1)

    def test_stage_metrics(self):
        stage = stage_metrics(self.snapshot, self.config)
        self.assertTrue(stage.ok)
        self.assertIn("agents", stage.output["families"])

    def test_stage_governance(self):
        stage = stage_governance(self.snapshot, self.config)
        self.assertTrue(stage.ok)
        self.assertIn("complianceScore", stage.output)

    def test_stage_interoperability(self):
        stage = stage_interoperability(self.snapshot, self.config)
        self.assertTrue(stage.ok)
        self.assertEqual(stage.output["hl7Messages"], 0)

    def test_run_pipeline_with_custom_stages(self):
        run = PipelineRun(datetime.now(timezone.utc), datetime.now(timezone.utc), [
            stage_ingest(self.snapshot, self.config),
            stage_metrics(self.snapshot, self.config),
        ])
        self.assertTrue(run.ok)
        self.assertEqual(run.as_dict()["stageCount"], 2)

    def test_run_pipeline_uses_disk_when_configured(self):
        with tempfile.TemporaryDirectory() as directory:
            previous = os.environ.get("CAREOS_REPORT_DIR")
            os.environ["CAREOS_REPORT_DIR"] = str(Path(directory) / "reports")
            try:
                run = run_pipeline(self.config, persist=True)
                self.assertTrue(run.ok)
                self.assertTrue((Path(directory) / "reports" / "pipeline-run.json").exists())
            finally:
                if previous is None:
                    os.environ.pop("CAREOS_REPORT_DIR", None)
                else:
                    os.environ["CAREOS_REPORT_DIR"] = previous


if __name__ == "__main__":
    unittest.main()
