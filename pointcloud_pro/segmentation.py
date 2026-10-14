"""
PointCloud Pro - Semantic and Instance Segmentation Engine
Manages point-level classifications, label correspondences, spatial filtering,
and point-in-oriented-box intersection testing.
"""

import math
from typing import List, Tuple, Dict, Any, Set
from pointcloud_pro.models import (
    BoundingBox3D,
    SEMANTIC_CLASS_ID_MAP,
    SemanticClass,
)
from pointcloud_pro.io import PointCloudData


def is_point_inside_box(
    point: Tuple[float, float, float],
    box: BoundingBox3D,
    tolerance_margin: float = 0.05,
) -> bool:
    """
    Tests if a 3D point lies inside an oriented bounding box (OBB) using inverse yaw transform.
    tolerance_margin adds a slight buffer (in meters) to account for discretization.
    """
    px, py, pz = point
    cx, cy, cz = box.center
    dx, dy, dz = box.dimensions
    yaw = box.rotation[0]

    # Translate relative to box center
    rel_x = px - cx
    rel_y = py - cy
    rel_z = pz - cz

    # Rotate by -yaw to align with box local frame
    cos_y = math.cos(-yaw)
    sin_y = math.sin(-yaw)
    local_x = rel_x * cos_y - rel_y * sin_y
    local_y = rel_x * sin_y + rel_y * cos_y
    local_z = rel_z

    half_l = (dx / 2.0) + tolerance_margin
    half_w = (dy / 2.0) + tolerance_margin
    half_h = (dz / 2.0) + tolerance_margin

    return (
        abs(local_x) <= half_l and
        abs(local_y) <= half_w and
        abs(local_z) <= half_h
    )


def filter_points_in_box(
    pcd: PointCloudData,
    box: BoundingBox3D,
) -> List[int]:
    """Returns list of point indices that lie inside the bounding box."""
    inside_indices: List[int] = []
    for idx, pt in enumerate(pcd.points):
        if is_point_inside_box(pt, box):
            inside_indices.append(idx)
    return inside_indices


def assign_points_to_class(
    pcd: PointCloudData,
    indices: List[int],
    class_name: str,
    instance_id: int = 0,
) -> int:
    """
    Assigns point-level semantic class and optional instance ID.
    Preserves exact point-to-label correspondence.
    Returns number of points modified.
    """
    if class_name not in SEMANTIC_CLASS_ID_MAP:
        raise ValueError(f"Unknown class name: {class_name}")

    class_id = SEMANTIC_CLASS_ID_MAP[class_name]
    valid_indices = set(i for i in indices if 0 <= i < len(pcd.points))

    for idx in valid_indices:
        pcd.semantic_labels[idx] = class_id
        if instance_id > 0:
            pcd.instance_ids[idx] = instance_id

    return len(valid_indices)


def compute_segmentation_stats(pcd: PointCloudData) -> Dict[str, Any]:
    """Computes distribution of semantic classes and distinct instances across points."""
    id_to_class = {v: k for k, v in SEMANTIC_CLASS_ID_MAP.items()}
    class_counts: Dict[str, int] = {k: 0 for k in SEMANTIC_CLASS_ID_MAP.keys()}
    instance_set: Set[int] = set()

    for idx, label_id in enumerate(pcd.semantic_labels):
        cname = id_to_class.get(label_id, "other")
        class_counts[cname] = class_counts.get(cname, 0) + 1
        inst = pcd.instance_ids[idx]
        if inst > 0:
            instance_set.add(inst)

    total_pts = max(len(pcd.points), 1)
    class_percentages = {k: round((count / total_pts) * 100.0, 2) for k, count in class_counts.items()}

    return {
        "total_points": len(pcd.points),
        "class_counts": class_counts,
        "class_percentages": class_percentages,
        "active_instance_count": len(instance_set),
    }
