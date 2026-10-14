"""
PointCloud Pro - Quality Assurance & Validation Rules Engine
Automated rules for validating 3D bounding boxes, checking coordinate integrity,
detecting suspicious bounding box intersections, and managing review states.
"""

import math
from typing import List, Dict, Any, Tuple, Optional
from pointcloud_pro.models import (
    BoundingBox3D,
    QAIssue,
    QASeverity,
    ReviewStatus,
    DEFAULT_CLASS_DIMENSIONS,
    SemanticClass,
)
from pointcloud_pro.io import PointCloudData
from pointcloud_pro.segmentation import is_point_inside_box


def calculate_aabb(box: BoundingBox3D) -> Tuple[Tuple[float, float, float], Tuple[float, float, float]]:
    """Calculates axis-aligned bounding box bounds (min_corner, max_corner) from oriented box."""
    cx, cy, cz = box.center
    dx, dy, dz = box.dimensions
    yaw = box.rotation[0]

    cos_y = abs(math.cos(yaw))
    sin_y = abs(math.sin(yaw))

    # Extended extents under yaw rotation
    ext_x = (dx * cos_y + dy * sin_y) / 2.0
    ext_y = (dx * sin_y + dy * cos_y) / 2.0
    ext_z = dz / 2.0

    min_pt = (cx - ext_x, cy - ext_y, cz - ext_z)
    max_pt = (cx + ext_x, cy + ext_y, cz + ext_z)
    return min_pt, max_pt


def compute_aabb_iou(box_a: BoundingBox3D, box_b: BoundingBox3D) -> float:
    """Computes volumetric Intersection-over-Union (IoU) of bounding box AABBs."""
    min_a, max_a = calculate_aabb(box_a)
    min_b, max_b = calculate_aabb(box_b)

    inter_min_x = max(min_a[0], min_b[0])
    inter_max_x = min(max_a[0], max_b[0])
    inter_min_y = max(min_a[1], min_b[1])
    inter_max_y = min(max_a[1], max_b[1])
    inter_min_z = max(min_a[2], min_b[2])
    inter_max_z = min(max_a[2], max_b[2])

    dx = max(0.0, inter_max_x - inter_min_x)
    dy = max(0.0, inter_max_y - inter_min_y)
    dz = max(0.0, inter_max_z - inter_min_z)

    intersection_volume = dx * dy * dz
    if intersection_volume <= 0.0:
        return 0.0

    vol_a = box_a.volume()
    vol_b = box_b.volume()
    union_volume = (vol_a + vol_b) - intersection_volume

    if union_volume <= 0.0:
        return 0.0

    return min(1.0, intersection_volume / union_volume)


class QARunner:
    """Runs automated rule validations across a collection of 3D bounding boxes and point cloud."""

    def __init__(
        self,
        iou_overlap_threshold: float = 0.15,
        min_point_threshold: int = 5,
        max_sensor_range: float = 120.0,
    ):
        self.iou_overlap_threshold = iou_overlap_threshold
        self.min_point_threshold = min_point_threshold
        self.max_sensor_range = max_sensor_range

    def run_all_checks(
        self,
        boxes: List[BoundingBox3D],
        pcd: Optional[PointCloudData] = None,
    ) -> List[QAIssue]:
        """
        Executes complete QA rule suite.
        Note: Flags reflect heuristic rule checks for human review and do not
        unilaterally assert ground-truth inaccuracy without review confirmation.
        """
        issues: List[QAIssue] = []

        issues.extend(self.check_duplicate_ids(boxes))
        issues.extend(self.check_geometry_and_coordinates(boxes))
        issues.extend(self.check_class_dimension_anomalies(boxes))
        issues.extend(self.check_bounding_box_overlaps(boxes))

        if pcd is not None:
            issues.extend(self.check_point_densities(boxes, pcd))

        return issues

    def check_duplicate_ids(self, boxes: List[BoundingBox3D]) -> List[QAIssue]:
        """Detects duplicate annotation IDs."""
        issues: List[QAIssue] = []
        seen_ids: Dict[str, int] = {}
        for b in boxes:
            seen_ids[b.id] = seen_ids.get(b.id, 0) + 1

        for bid, count in seen_ids.items():
            if count > 1:
                issues.append(
                    QAIssue(
                        severity=QASeverity.CRITICAL,
                        rule_id="RULE-QA-001",
                        annotation_id=bid,
                        message=f"Duplicate annotation ID '{bid}' found {count} times.",
                        recommended_action="Assign unique identifier to every individual bounding box instance.",
                    )
                )
        return issues

    def check_geometry_and_coordinates(self, boxes: List[BoundingBox3D]) -> List[QAIssue]:
        """Validates coordinate finiteness, positive dimensions, and LiDAR sensor range."""
        issues: List[QAIssue] = []
        valid_classes = set(c.value for c in SemanticClass)

        for b in boxes:
            # 1. Class validity
            if b.class_name not in valid_classes:
                issues.append(
                    QAIssue(
                        severity=QASeverity.CRITICAL,
                        rule_id="RULE-QA-002",
                        annotation_id=b.id,
                        message=f"Invalid or missing class '{b.class_name}'.",
                        recommended_action=f"Select a supported semantic class: {sorted(list(valid_classes))}.",
                    )
                )

            # 2. Dimensions check
            dx, dy, dz = b.dimensions
            if dx <= 0 or dy <= 0 or dz <= 0:
                issues.append(
                    QAIssue(
                        severity=QASeverity.CRITICAL,
                        rule_id="RULE-QA-003",
                        annotation_id=b.id,
                        message=f"Non-positive dimensions detected: ({dx:.2f}, {dy:.2f}, {dz:.2f})m.",
                        recommended_action="Set all dimensions (length, width, height) to strictly positive values.",
                    )
                )

            # 3. Coordinate range
            dist_from_origin = math.sqrt(b.center[0] ** 2 + b.center[1] ** 2 + b.center[2] ** 2)
            if dist_from_origin > self.max_sensor_range:
                issues.append(
                    QAIssue(
                        severity=QASeverity.WARNING,
                        rule_id="RULE-QA-004",
                        annotation_id=b.id,
                        message=f"Object center is {dist_from_origin:.1f}m away, exceeding nominal sensor range ({self.max_sensor_range}m).",
                        recommended_action="Verify if the object is within effective LiDAR range or an erroneous coordinate entry.",
                    )
                )

            # 4. Severe ground penetration
            bottom_z = b.center[2] - (dz / 2.0)
            if bottom_z < -1.5 and b.class_name not in ["other", "road"]:
                issues.append(
                    QAIssue(
                        severity=QASeverity.WARNING,
                        rule_id="RULE-QA-005",
                        annotation_id=b.id,
                        message=f"Box base sits at z={bottom_z:.2f}m, noticeably below ground plane (z=0m).",
                        recommended_action="Snap bottom of bounding box flush with detected ground elevation.",
                    )
                )

        return issues

    def check_class_dimension_anomalies(self, boxes: List[BoundingBox3D]) -> List[QAIssue]:
        """Flags boxes whose dimensions deviate dramatically (> 3.5x or < 0.25x) from typical physical envelopes."""
        issues: List[QAIssue] = []
        for b in boxes:
            if b.class_name not in DEFAULT_CLASS_DIMENSIONS:
                continue
            def_l, def_w, def_h = DEFAULT_CLASS_DIMENSIONS[b.class_name]
            cur_l, cur_w, cur_h = b.dimensions

            # Check if volume or any dimension is unrealistic
            if cur_l > def_l * 3.5 or cur_w > def_w * 3.5 or cur_h > def_h * 3.5:
                issues.append(
                    QAIssue(
                        severity=QASeverity.WARNING,
                        rule_id="RULE-QA-006",
                        annotation_id=b.id,
                        message=f"{b.class_name.capitalize()} dimensions ({cur_l:.1f}x{cur_w:.1f}x{cur_h:.1f}m) are unusually oversized compared to standard ({def_l:.1f}x{def_w:.1f}x{def_h:.1f}m).",
                        recommended_action="Inspect 3D bounding box boundaries to ensure adjacent clutter or objects are not accidentally enclosed.",
                    )
                )
            elif cur_l < def_l * 0.25 or cur_w < def_w * 0.25 or cur_h < def_h * 0.25:
                issues.append(
                    QAIssue(
                        severity=QASeverity.WARNING,
                        rule_id="RULE-QA-007",
                        annotation_id=b.id,
                        message=f"{b.class_name.capitalize()} dimensions ({cur_l:.1f}x{cur_w:.1f}x{cur_h:.1f}m) are unusually undersized.",
                        recommended_action="Review box tight fit to enclose full object silhouette.",
                    )
                )
        return issues

    def check_bounding_box_overlaps(self, boxes: List[BoundingBox3D]) -> List[QAIssue]:
        """Detects suspicious overlaps or penetration between distinct object instances."""
        issues: List[QAIssue] = []
        n = len(boxes)

        for i in range(n):
            for j in range(i + 1, n):
                b1 = boxes[i]
                b2 = boxes[j]

                # Exempt roads and large background elements from collision check
                if b1.class_name in ["road", "other"] or b2.class_name in ["road", "other"]:
                    continue

                iou = compute_aabb_iou(b1, b2)
                if iou >= self.iou_overlap_threshold:
                    issues.append(
                        QAIssue(
                            severity=QASeverity.WARNING,
                            rule_id="RULE-QA-008",
                            annotation_id=f"{b1.id} & {b2.id}",
                            message=f"Suspicious 3D overlap detected between '{b1.id}' ({b1.class_name}) and '{b2.id}' ({b2.class_name}) with AABB IoU={iou:.2f}.",
                            recommended_action="Check if these represent two separate colliding objects, an incorrect duplicate, or overlapping pedestrian group.",
                        )
                    )
        return issues

    def check_point_densities(self, boxes: List[BoundingBox3D], pcd: PointCloudData) -> List[QAIssue]:
        """Flags empty or low-density bounding boxes (possible ghost annotations or misalignments)."""
        issues: List[QAIssue] = []

        for b in boxes:
            count = 0
            for pt in pcd.points:
                if is_point_inside_box(pt, b):
                    count += 1

            b.point_count = count
            if count == 0:
                issues.append(
                    QAIssue(
                        severity=QASeverity.CRITICAL,
                        rule_id="RULE-QA-009",
                        annotation_id=b.id,
                        message=f"Ghost annotation detected: 0 points found inside box '{b.id}'.",
                        recommended_action="Verify object presence in scene or remove hallucinated/empty bounding box.",
                    )
                )
            elif count < self.min_point_threshold and b.class_name not in ["pedestrian", "cyclist"]:
                issues.append(
                    QAIssue(
                        severity=QASeverity.INFO,
                        rule_id="RULE-QA-010",
                        annotation_id=b.id,
                        message=f"Low point density: only {count} points in '{b.id}'.",
                        recommended_action="Ensure box is accurately placed over sparse reflections or mark confidence accordingly.",
                    )
                )

        return issues
