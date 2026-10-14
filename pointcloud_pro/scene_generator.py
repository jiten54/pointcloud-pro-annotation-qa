"""
PointCloud Pro - Realistic Synthetic 3D LiDAR Scene Generator
Generates realistic multi-class autonomous driving LiDAR point clouds
with ground truth bounding boxes and semantic labels.
"""

import math
import random
from typing import Tuple, List, Dict, Any
from pointcloud_pro.models import (
    BoundingBox3D,
    SemanticClass,
    SEMANTIC_CLASS_ID_MAP,
    DEFAULT_CLASS_DIMENSIONS,
    ReviewStatus,
)
from pointcloud_pro.io import PointCloudData


def generate_synthetic_scene(
    scene_type: str = "urban_intersection",
    num_points_target: int = 4000,
    seed: int = 42,
) -> Tuple[PointCloudData, List[BoundingBox3D]]:
    """
    Generates a structured LiDAR point cloud representing autonomous vehicle sensor data.
    Returns:
        (PointCloudData, List[BoundingBox3D])
    """
    rng = random.Random(seed)
    points: List[Tuple[float, float, float]] = []
    intensities: List[float] = []
    labels: List[int] = []
    instance_ids: List[int] = []
    boxes: List[BoundingBox3D] = []

    # 1. Ground Plane (Road + Sidewalk)
    road_id = SEMANTIC_CLASS_ID_MAP["road"]
    num_road_points = int(num_points_target * 0.40)
    for _ in range(num_road_points):
        x = rng.uniform(-25.0, 25.0)
        y = rng.uniform(-25.0, 25.0)
        z = rng.gauss(0.0, 0.03)  # slight road roughness
        
        # Lane markings have higher LiDAR reflectivity (intensity)
        is_lane_marking = (abs(x) < 0.2 and abs(y % 4.0) < 1.5) or (abs(y) < 0.2 and abs(x % 4.0) < 1.5)
        intensity = 0.95 if is_lane_marking else rng.uniform(0.15, 0.35)

        points.append((x, y, z))
        intensities.append(intensity)
        labels.append(road_id)
        instance_ids.append(0)

    # 2. Buildings / Walls along the street edges
    building_id = SEMANTIC_CLASS_ID_MAP["building"]
    num_bldg_points = int(num_points_target * 0.15)
    for _ in range(num_bldg_points):
        side = rng.choice([-1, 1])
        x = side * rng.uniform(18.0, 24.0)
        y = rng.uniform(-25.0, 25.0)
        z = rng.uniform(0.0, 8.0)
        points.append((x, y, z))
        intensities.append(rng.uniform(0.4, 0.7))
        labels.append(building_id)
        instance_ids.append(0)

    # 3. Trees / Vegetation on curbs
    veg_id = SEMANTIC_CLASS_ID_MAP["vegetation"]
    tree_centers = [(-15.0, -12.0), (-15.0, 10.0), (15.0, -8.0), (15.0, 14.0)]
    for tc in tree_centers:
        for _ in range(int(num_points_target * 0.03)):
            # Crown
            r = rng.uniform(0.2, 1.8)
            theta = rng.uniform(0, 2 * math.pi)
            phi = rng.uniform(0, math.pi)
            px = tc[0] + r * math.sin(phi) * math.cos(theta)
            py = tc[1] + r * math.sin(phi) * math.sin(theta)
            pz = 2.5 + r * math.cos(phi)
            points.append((px, py, pz))
            intensities.append(rng.uniform(0.2, 0.5))
            labels.append(veg_id)
            instance_ids.append(0)

    # 4. Foreground Objects & Bounding Boxes
    object_configs = [
        # (id, class_name, center_x, center_y, center_z, yaw_deg, num_pts)
        ("box-car-01", "car", 6.5, 4.2, 0.8, 15.0, 180),
        ("box-car-02", "car", -5.2, 11.0, 0.8, -10.0, 150),
        ("box-truck-01", "truck", 7.8, -12.5, 1.6, 90.0, 240),
        ("box-ped-01", "pedestrian", -3.5, 2.8, 0.88, 45.0, 45),
        ("box-ped-02", "pedestrian", -3.0, 3.4, 0.88, 40.0, 40),
        ("box-cyclist-01", "cyclist", 3.2, -4.5, 0.85, -30.0, 65),
    ]

    for obj_idx, (box_id, cname, cx, cy, cz, yaw_deg, n_pts) in enumerate(object_configs, start=1):
        dims = DEFAULT_CLASS_DIMENSIONS[cname]
        yaw_rad = math.radians(yaw_deg)
        c_label = SEMANTIC_CLASS_ID_MAP[cname]

        # Generate points on the surfaces of the 3D box
        half_l = dims[0] / 2.0
        half_w = dims[1] / 2.0
        half_h = dims[2] / 2.0

        for _ in range(n_pts):
            # Sample point on surface or interior
            local_x = rng.uniform(-half_l * 0.95, half_l * 0.95)
            local_y = rng.uniform(-half_w * 0.95, half_w * 0.95)
            local_z = rng.uniform(-half_h * 0.95, half_h * 0.95)

            # Apply yaw rotation
            cos_y = math.cos(yaw_rad)
            sin_y = math.sin(yaw_rad)
            rot_x = local_x * cos_y - local_y * sin_y
            rot_y = local_x * sin_y + local_y * cos_y

            world_x = cx + rot_x
            world_y = cy + rot_y
            world_z = cz + local_z

            points.append((world_x, world_y, world_z))
            intensities.append(rng.uniform(0.5, 0.9))
            labels.append(c_label)
            instance_ids.append(obj_idx)

        box = BoundingBox3D(
            id=box_id,
            class_name=cname,
            center=(cx, cy, cz),
            dimensions=dims,
            rotation=(yaw_rad, 0.0, 0.0),
            review_status=ReviewStatus.PENDING,
            point_count=n_pts,
            confidence=0.98,
            instance_id=obj_idx,
        )
        boxes.append(box)

    pcd_data = PointCloudData(
        points=points,
        intensities=intensities,
        semantic_labels=labels,
        instance_ids=instance_ids,
    )
    pcd_data.metadata = pcd_data._compute_metadata(f"{scene_type}.pcd", "PCD")
    return pcd_data, boxes
