"""
Unit tests for PointCloud Pro Quality Assurance Rules Engine
"""

import unittest
from pointcloud_pro.models import (
    BoundingBox3D,
    QASeverity,
    ReviewStatus,
)
from pointcloud_pro.qa import (
    QARunner,
    compute_aabb_iou,
    calculate_aabb,
)
from pointcloud_pro.io import PointCloudData


class TestQARulesEngine(unittest.TestCase):

    def setUp(self):
        self.qa = QARunner(iou_overlap_threshold=0.15)

    def test_duplicate_id_detection(self):
        box1 = BoundingBox3D("dup-id-1", "car", (0, 0, 0), (4, 2, 1.5))
        box2 = BoundingBox3D("dup-id-1", "car", (10, 10, 0), (4, 2, 1.5))
        issues = self.qa.check_duplicate_ids([box1, box2])
        self.assertTrue(any(i.rule_id == "RULE-QA-001" and i.severity == QASeverity.CRITICAL for i in issues))

    def test_out_of_bounds_sensor_range_warning(self):
        far_box = BoundingBox3D("far-box", "car", (200.0, 0.0, 0.0), (4.5, 2.0, 1.5))
        issues = self.qa.check_geometry_and_coordinates([far_box])
        self.assertTrue(any(i.rule_id == "RULE-QA-004" for i in issues))

    def test_class_dimension_anomaly(self):
        # Giant pedestrian (10 meters tall)
        giant_ped = BoundingBox3D("ped-giant", "pedestrian", (0, 0, 5), (10.0, 5.0, 10.0))
        issues = self.qa.check_class_dimension_anomalies([giant_ped])
        self.assertTrue(any(i.rule_id == "RULE-QA-006" for i in issues))

    def test_bounding_box_overlap_detection(self):
        # Two cars placed in nearly identical position
        car_a = BoundingBox3D("car-a", "car", (5.0, 0.0, 0.8), (4.5, 2.0, 1.5))
        car_b = BoundingBox3D("car-b", "car", (5.2, 0.1, 0.8), (4.5, 2.0, 1.5))
        iou = compute_aabb_iou(car_a, car_b)
        self.assertGreater(iou, 0.5)

        issues = self.qa.check_bounding_box_overlaps([car_a, car_b])
        self.assertTrue(any(i.rule_id == "RULE-QA-008" for i in issues))

    def test_non_overlapping_boxes_zero_iou(self):
        car_1 = BoundingBox3D("car-1", "car", (0.0, 0.0, 0.0), (4.0, 2.0, 1.5))
        car_2 = BoundingBox3D("car-2", "car", (20.0, 20.0, 0.0), (4.0, 2.0, 1.5))
        self.assertEqual(compute_aabb_iou(car_1, car_2), 0.0)

    def test_empty_ghost_box_detection(self):
        pcd = PointCloudData(points=[(0.0, 0.0, 0.0), (1.0, 1.0, 0.0)])
        ghost_box = BoundingBox3D("ghost-1", "car", (50.0, 50.0, 0.0), (4.0, 2.0, 1.5))
        issues = self.qa.check_point_densities([ghost_box], pcd)
        self.assertTrue(any(i.rule_id == "RULE-QA-009" and i.severity == QASeverity.CRITICAL for i in issues))


if __name__ == "__main__":
    unittest.main()
