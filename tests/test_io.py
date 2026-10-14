"""
Unit tests for Point Cloud File IO and Ingestion
"""

import unittest
from pointcloud_pro.io import (
    parse_xyz,
    parse_pcd,
    parse_ply,
    load_point_cloud_file,
    export_to_pcd_ascii,
)


class TestPointCloudIO(unittest.TestCase):

    def test_parse_valid_xyz(self):
        sample_xyz = """
        # Sample XYZ point cloud
        0.0 0.0 0.0
        1.5 2.5 0.5 0.8
        -3.0 4.0 1.2 255 0 0
        """
        pcd = parse_xyz(sample_xyz, "test.xyz")
        self.assertEqual(len(pcd.points), 3)
        self.assertEqual(pcd.points[0], (0.0, 0.0, 0.0))
        self.assertEqual(pcd.points[1], (1.5, 2.5, 0.5))
        self.assertEqual(pcd.metadata.format, "XYZ")

    def test_reject_empty_xyz(self):
        with self.assertRaises(ValueError):
            parse_xyz("", "empty.xyz")

    def test_reject_malformed_xyz_coordinates(self):
        corrupt_xyz = "1.0 2.0 NOT_A_NUMBER"
        with self.assertRaises(ValueError):
            parse_xyz(corrupt_xyz, "corrupt.xyz")

    def test_parse_valid_ascii_pcd(self):
        sample_pcd = """# .PCD v0.7
VERSION 0.7
FIELDS x y z intensity
SIZE 4 4 4 4
TYPE F F F F
COUNT 1 1 1 1
WIDTH 2
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS 2
DATA ascii
1.0 2.0 3.0 0.5
4.0 5.0 6.0 0.9
"""
        pcd = parse_pcd(sample_pcd, "sample.pcd")
        self.assertEqual(len(pcd.points), 2)
        self.assertEqual(pcd.points[0], (1.0, 2.0, 3.0))
        self.assertEqual(pcd.points[1], (4.0, 5.0, 6.0))
        self.assertEqual(pcd.metadata.point_count, 2)
        self.assertEqual(pcd.metadata.format, "PCD")

    def test_reject_pcd_missing_data_header(self):
        broken_pcd = """VERSION 0.7
FIELDS x y z
POINTS 1
1.0 2.0 3.0
"""
        with self.assertRaises(ValueError):
            parse_pcd(broken_pcd, "bad.pcd")

    def test_parse_valid_ascii_ply(self):
        sample_ply = """ply
format ascii 1.0
element vertex 2
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
0.5 1.0 1.5 255 128 0
-0.5 -1.0 -1.5 0 255 128
"""
        pcd = parse_ply(sample_ply, "sample.ply")
        self.assertEqual(len(pcd.points), 2)
        self.assertEqual(pcd.points[0], (0.5, 1.0, 1.5))
        self.assertEqual(pcd.metadata.format, "PLY")
        self.assertEqual(pcd.colors[0], (255, 128, 0))

    def test_reject_unsupported_format(self):
        with self.assertRaises(ValueError):
            load_point_cloud_file("model.obj", "v 0 0 0")

    def test_export_ascii_pcd_roundtrip(self):
        sample_xyz = "0.0 0.0 0.0\n1.0 1.0 1.0\n"
        pcd = parse_xyz(sample_xyz)
        exported_str = export_to_pcd_ascii(pcd)
        reparsed = parse_pcd(exported_str)
        self.assertEqual(len(reparsed.points), 2)
        self.assertEqual(reparsed.points[0], (0.0, 0.0, 0.0))
        self.assertEqual(reparsed.points[1], (1.0, 1.0, 1.0))


if __name__ == "__main__":
    unittest.main()
