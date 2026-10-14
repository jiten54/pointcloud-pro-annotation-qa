"""
Unit tests for Segmentation & Spatial Point Filtering
"""

import unittest
from pointcloud_pro.models import BoundingBox3D, SEMANTIC_CLASS_ID_MAP
from pointcloud_pro.io import PointCloudData
from pointcloud_pro.segmentation import (
    is_point_inside_box,
    filter_points_in_box,
    assign_points_to_class,
    compute_segmentation_stats,
)


class TestSegmentation(unittest.TestCase):

    def test_point_inside_box_aligned(self):
        box = BoundingBox3D("b1", "car", (0.0, 0.0, 0.0), (4.0, 2.0, 2.0))
        self.assertTrue(is_point_inside_box((0.0, 0.0, 0.0), box))
        self.assertTrue(is_point_inside_box((1.5, 0.8, 0.5), box))
        self.assertFalse(is_point_inside_box((3.0, 0.0, 0.0), box))
        self.assertFalse(is_point_inside_box((0.0, 2.0, 0.0), box))

    def test_filter_points_in_box(self):
        pts = [
            (0.0, 0.0, 0.0),
            (1.0, 0.5, 0.2),
            (10.0, 10.0, 10.0),
        ]
        pcd = PointCloudData(points=pts)
        box = BoundingBox3D("b1", "car", (0.0, 0.0, 0.0), (3.0, 3.0, 3.0))

        inside_indices = filter_points_in_box(pcd, box)
        self.assertEqual(inside_indices, [0, 1])

    def test_assign_class_and_stats(self):
        pts = [(0, 0, 0), (1, 1, 1), (2, 2, 2)]
        pcd = PointCloudData(points=pts)
        assigned = assign_points_to_class(pcd, [0, 1], "car", instance_id=101)

        self.assertEqual(assigned, 2)
        car_id = SEMANTIC_CLASS_ID_MAP["car"]
        self.assertEqual(pcd.semantic_labels[0], car_id)
        self.assertEqual(pcd.semantic_labels[1], car_id)
        self.assertEqual(pcd.semantic_labels[2], 0)
        self.assertEqual(pcd.instance_ids[0], 101)

        stats = compute_segmentation_stats(pcd)
        self.assertEqual(stats["total_points"], 3)
        self.assertEqual(stats["class_counts"]["car"], 2)
        self.assertEqual(stats["active_instance_count"], 1)


if __name__ == "__main__":
    unittest.main()
