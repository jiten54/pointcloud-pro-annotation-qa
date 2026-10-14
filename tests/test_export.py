"""
Unit tests for Export Utilities and Roundtrip Schema Validation
"""

import unittest
import json
from pointcloud_pro.models import (
    BoundingBox3D,
    PointCloudMetadata,
    ReviewStatus,
    QASeverity,
    QAIssue,
)
from pointcloud_pro.exporter import (
    export_to_json,
    export_to_csv,
    import_and_validate_json,
)


class TestExportRoundtrip(unittest.TestCase):

    def setUp(self):
        self.boxes = [
            BoundingBox3D(
                id="car-01",
                class_name="car",
                center=(5.0, 2.0, 0.8),
                dimensions=(4.5, 2.0, 1.6),
                rotation=(0.2, 0.0, 0.0),
                review_status=ReviewStatus.APPROVED,
                review_note="Verified accurate fit",
                point_count=120,
            ),
            BoundingBox3D(
                id="ped-01",
                class_name="pedestrian",
                center=(-2.0, 3.0, 0.85),
                dimensions=(0.6, 0.6, 1.7),
                rotation=(0.0, 0.0, 0.0),
                review_status=ReviewStatus.NEEDS_CORRECTION,
                review_note="Bounding box cuts off feet",
                point_count=35,
            ),
        ]
        self.metadata = PointCloudMetadata(
            file_name="highway_scene.pcd",
            point_count=2000,
            bounds_min=(-20, -20, -1),
            bounds_max=(20, 20, 5),
            format="PCD",
        )
        self.qa_issues = [
            QAIssue(
                severity=QASeverity.WARNING,
                rule_id="RULE-QA-008",
                annotation_id="ped-01",
                message="Pedestrian box near curb",
                recommended_action="Inspect proximity to obstacle",
            )
        ]
        self.audit_log = [
            {"timestamp": "2026-10-14T12:00:00Z", "operator": "QA-Lead", "action": "Approved car-01"}
        ]

    def test_json_export_structure(self):
        json_output = export_to_json(self.boxes, self.metadata, self.qa_issues, self.audit_log)
        parsed = json.loads(json_output)

        self.assertEqual(parsed["version"], "1.0.0")
        self.assertEqual(parsed["summary"]["total_annotations"], 2)
        self.assertEqual(parsed["summary"]["approved"], 1)
        self.assertEqual(parsed["summary"]["needs_correction"], 1)
        self.assertEqual(len(parsed["annotations"]), 2)
        self.assertEqual(len(parsed["qa_report"]), 1)

    def test_csv_export_format(self):
        csv_output = export_to_csv(self.boxes)
        lines = csv_output.strip().splitlines()
        self.assertGreaterEqual(len(lines), 3)  # header + 2 rows
        self.assertTrue(lines[0].startswith("id,class_name,center_x"))
        self.assertIn("car-01", lines[1])
        self.assertIn("ped-01", lines[2])

    def test_roundtrip_import_and_validate_success(self):
        json_output = export_to_json(self.boxes, self.metadata, self.qa_issues, self.audit_log)
        imported_boxes, raw_dict = import_and_validate_json(json_output)

        self.assertEqual(len(imported_boxes), 2)
        self.assertEqual(imported_boxes[0].id, "car-01")
        self.assertEqual(imported_boxes[0].class_name, "car")
        self.assertEqual(imported_boxes[0].review_status, ReviewStatus.APPROVED)
        self.assertEqual(imported_boxes[1].id, "ped-01")

    def test_reject_corrupt_json(self):
        corrupt_json = '{"annotations": [{"id": "bad-box", "class_name": "car", "dimensions": [-1, 2, 3]}]}'
        with self.assertRaises(ValueError):
            import_and_validate_json(corrupt_json)


if __name__ == "__main__":
    unittest.main()
