"""
PointCloud Pro - Data Models and Validation Schemas
Defines core representations for 3D oriented bounding boxes, point cloud metadata,
semantic segmentation records, and QA inspection reports.
"""

from enum import Enum
from typing import List, Tuple, Optional, Dict, Any
import math


class SemanticClass(str, Enum):
    CAR = "car"
    TRUCK = "truck"
    BUS = "bus"
    PEDESTRIAN = "pedestrian"
    CYCLIST = "cyclist"
    MOTORCYCLE = "motorcycle"
    ROAD = "road"
    VEGETATION = "vegetation"
    BUILDING = "building"
    OTHER = "other"


# Semantic Class IDs for segmentation mapping
SEMANTIC_CLASS_ID_MAP: Dict[str, int] = {
    SemanticClass.OTHER.value: 0,
    SemanticClass.ROAD.value: 1,
    SemanticClass.BUILDING.value: 2,
    SemanticClass.VEGETATION.value: 3,
    SemanticClass.CAR.value: 4,
    SemanticClass.TRUCK.value: 5,
    SemanticClass.BUS.value: 6,
    SemanticClass.PEDESTRIAN.value: 7,
    SemanticClass.CYCLIST.value: 8,
    SemanticClass.MOTORCYCLE.value: 9,
}

SEMANTIC_CLASS_COLORS: Dict[str, str] = {
    "car": "#3B82F6",         # Blue
    "truck": "#6366F1",       # Indigo
    "bus": "#8B5CF6",         # Violet
    "pedestrian": "#EF4444",  # Red
    "cyclist": "#F97316",     # Orange
    "motorcycle": "#EC4899",  # Pink
    "road": "#64748B",        # Slate Gray
    "vegetation": "#10B981",  # Emerald Green
    "building": "#EAB308",    # Amber
    "other": "#94A3B8",       # Light Slate
}

# Standard realistic dimensions (length, width, height) in meters for validation
DEFAULT_CLASS_DIMENSIONS: Dict[str, Tuple[float, float, float]] = {
    "car": (4.5, 1.9, 1.6),
    "truck": (8.5, 2.5, 3.2),
    "bus": (11.5, 2.6, 3.4),
    "pedestrian": (0.6, 0.6, 1.75),
    "cyclist": (1.8, 0.7, 1.7),
    "motorcycle": (2.1, 0.8, 1.3),
    "road": (20.0, 10.0, 0.2),
    "vegetation": (3.0, 3.0, 4.0),
    "building": (10.0, 10.0, 8.0),
    "other": (2.0, 2.0, 2.0),
}


class ReviewStatus(str, Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    NEEDS_CORRECTION = "Needs Correction"


class QASeverity(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


class BoundingBox3D:
    """3D Oriented Bounding Box representation with physical validation."""

    def __init__(
        self,
        id: str,
        class_name: str,
        center: Tuple[float, float, float],
        dimensions: Tuple[float, float, float],
        rotation: Tuple[float, float, float] = (0.0, 0.0, 0.0),
        review_status: ReviewStatus = ReviewStatus.PENDING,
        review_note: str = "",
        point_count: int = 0,
        confidence: float = 1.0,
        instance_id: Optional[int] = None,
    ):
        self.id = str(id).strip()
        self.class_name = str(class_name).lower().strip()
        self.center = (float(center[0]), float(center[1]), float(center[2]))
        self.dimensions = (float(dimensions[0]), float(dimensions[1]), float(dimensions[2]))
        self.rotation = (float(rotation[0]), float(rotation[1]), float(rotation[2]))  # [yaw, pitch, roll] in rad
        self.review_status = ReviewStatus(review_status)
        self.review_note = review_note
        self.point_count = int(point_count)
        self.confidence = float(confidence)
        self.instance_id = int(instance_id) if instance_id is not None else None

        self.validate()

    def validate(self) -> None:
        """Enforces schema invariants: positive dimensions, finite coordinates, valid class."""
        if not self.id:
            raise ValueError("Bounding box ID cannot be empty.")
        
        valid_classes = [c.value for c in SemanticClass]
        if self.class_name not in valid_classes:
            raise ValueError(f"Invalid class '{self.class_name}'. Must be one of {valid_classes}")

        for i, val in enumerate(self.center):
            if not math.isfinite(val):
                raise ValueError(f"Center coordinate index {i} must be finite: {val}")

        for i, dim in enumerate(self.dimensions):
            if not math.isfinite(dim) or dim <= 0:
                axis_name = ["length (dx)", "width (dy)", "height (dz)"][i]
                raise ValueError(f"Bounding box {axis_name} must be strictly positive and finite. Got {dim}")

        for i, rot in enumerate(self.rotation):
            if not math.isfinite(rot):
                raise ValueError(f"Rotation index {i} must be finite: {rot}")

    def volume(self) -> float:
        """Returns 3D volume in cubic meters."""
        return self.dimensions[0] * self.dimensions[1] * self.dimensions[2]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "class_name": self.class_name,
            "center": list(self.center),
            "dimensions": list(self.dimensions),
            "rotation": list(self.rotation),
            "review_status": self.review_status.value,
            "review_note": self.review_note,
            "point_count": self.point_count,
            "confidence": self.confidence,
            "instance_id": self.instance_id,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BoundingBox3D":
        return cls(
            id=data["id"],
            class_name=data["class_name"],
            center=tuple(data["center"]),
            dimensions=tuple(data["dimensions"]),
            rotation=tuple(data.get("rotation", (0.0, 0.0, 0.0))),
            review_status=ReviewStatus(data.get("review_status", ReviewStatus.PENDING.value)),
            review_note=data.get("review_note", ""),
            point_count=data.get("point_count", 0),
            confidence=data.get("confidence", 1.0),
            instance_id=data.get("instance_id"),
        )


class QAIssue:
    """Represents a rule-violation or anomaly detected by the QA engine."""

    def __init__(
        self,
        severity: QASeverity,
        rule_id: str,
        annotation_id: Optional[str],
        message: str,
        recommended_action: str,
    ):
        self.severity = QASeverity(severity)
        self.rule_id = rule_id
        self.annotation_id = annotation_id
        self.message = message
        self.recommended_action = recommended_action

    def to_dict(self) -> Dict[str, Any]:
        return {
            "severity": self.severity.value,
            "rule_id": self.rule_id,
            "annotation_id": self.annotation_id,
            "message": self.message,
            "recommended_action": self.recommended_action,
        }


class PointCloudMetadata:
    """Metadata describing a loaded point cloud dataset."""

    def __init__(
        self,
        file_name: str,
        point_count: int,
        bounds_min: Tuple[float, float, float],
        bounds_max: Tuple[float, float, float],
        format: str,
        has_intensity: bool = False,
        has_rgb: bool = False,
        has_labels: bool = False,
    ):
        self.file_name = file_name
        self.point_count = int(point_count)
        self.bounds_min = bounds_min
        self.bounds_max = bounds_max
        self.format = format.upper()
        self.has_intensity = has_intensity
        self.has_rgb = has_rgb
        self.has_labels = has_labels

    @property
    def dimensions(self) -> Tuple[float, float, float]:
        return (
            self.bounds_max[0] - self.bounds_min[0],
            self.bounds_max[1] - self.bounds_min[1],
            self.bounds_max[2] - self.bounds_min[2],
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_name": self.file_name,
            "point_count": self.point_count,
            "bounds_min": list(self.bounds_min),
            "bounds_max": list(self.bounds_max),
            "dimensions": list(self.dimensions),
            "format": self.format,
            "has_intensity": self.has_intensity,
            "has_rgb": self.has_rgb,
            "has_labels": self.has_labels,
        }
