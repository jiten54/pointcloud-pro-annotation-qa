"""
Unit tests for PointCloud Pro Data Models and Schema Validation
"""

import unittest
import math
from pointcloud_pro.models import (
    BoundingBox3D,
    SemanticClass,
    ReviewStatus,
    QASeverity,
    PointCloudMetadata,
)


class TestBoundingBox3D(unittest.TestCase):

    def test_valid_box_instantiation(self):
        box = BoundingBox3D(
            id="box-car-01",
            class_name="car",
            center=(10.0, 5.0, 1.2),
            dimensions=(4.5, 2.0, 1.6),
            rotation=(0.5, 0.0, 0.0),
            review_status=ReviewStatus.PENDING,
        )
        self.assertEqual(box.id, "box-car-01")
        self.assertEqual(box.class_name, "car")
        self.assertAlmostEqual(box.volume(), 4.5 * 2.0 * 1.6, places=4)

    def test_reject_empty_id(self):
        with self.assertRaises(ValueError):
            BoundingBox3D(
                id="",
                class_name="car",
                center=(0, 0, 0),
                dimensions=(1, 1, 1),
            )

    def test_reject_invalid_class(self):
        with self.assertRaises(ValueError):
            BoundingBox3D(
                id="box-alien-01",
                class_name="alien_ufo",
                center=(0, 0, 0),
                dimensions=(1, 1, 1),
            )

    def test_reject_zero_and_negative_dimensions(self):
        # Zero length
        with self.assertRaises(ValueError):
            BoundingBox3D(
                id="box-err-01",
                class_name="car",
                center=(0, 0, 0),
                dimensions=(0.0, 2.0, 1.5),
            )
        # Negative height
        with self.assertRaises(ValueError):
            BoundingBox3D(
                id="box-err-02",
                class_name="truck",
                center=(0, 0, 0),
                dimensions=(8.0, 2.5, -1.0),
            )

    def test_reject_non_finite_coordinates(self):
        with self.assertRaises(ValueError):
            BoundingBox3D(
                id="box-err-nan",
                class_name="pedestrian",
                center=(float("nan"), 0.0, 0.0),
                dimensions=(0.6, 0.6, 1.7),
            )
        with self.assertRaises(ValueError):
            BoundingBox3D(
                id="box-err-inf",
                class_name="pedestrian",
                center=(0.0, float("inf"), 0.0),
                dimensions=(0.6, 0.6, 1.7),
            )

    def test_serialization_roundtrip(self):
        box = BoundingBox3D(
            id="box-roundtrip",
            class_name="pedestrian",
            center=(1.5, -2.0, 0.9),
            dimensions=(0.7, 0.7, 1.8),
            rotation=(0.1, 0.0, 0.0),
            review_status=ReviewStatus.APPROVED,
            review_note="Verified by lead annotator",
            point_count=52,
        )
        data = box.to_dict()
        reconstructed = BoundingBox3D.from_dict(data)

        self.assertEqual(reconstructed.id, box.id)
        self.assertEqual(reconstructed.class_name, box.class_name)
        self.assertEqual(reconstructed.center, box.center)
        self.assertEqual(reconstructed.dimensions, box.dimensions)
        self.assertEqual(reconstructed.review_status, ReviewStatus.APPROVED)
        self.assertEqual(reconstructed.point_count, 52)


class TestPointCloudMetadata(unittest.TestCase):

    def test_metadata_computation(self):
        meta = PointCloudMetadata(
            file_name="test.pcd",
            point_count=1000,
            bounds_min=(-10.0, -5.0, -1.0),
            bounds_max=(10.0, 15.0, 4.0),
            format="PCD",
        )
        self.assertEqual(meta.dimensions, (20.0, 20.0, 5.0))
        d = meta.to_dict()
        self.assertEqual(d["file_name"], "test.pcd")
        self.assertEqual(d["point_count"], 1000)


if __name__ == "__main__":
    unittest.main()
