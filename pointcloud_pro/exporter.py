"""
PointCloud Pro - Dataset Export and Roundtrip Verification Engine
Supports JSON, CSV, and QA Validation Reports. Validates schema consistency on re-import.
"""

import json
import csv
import io
from datetime import datetime
from typing import List, Dict, Any, Tuple
from pointcloud_pro.models import (
    BoundingBox3D,
    PointCloudMetadata,
    QAIssue,
    ReviewStatus,
)


def export_to_json(
    boxes: List[BoundingBox3D],
    metadata: PointCloudMetadata,
    qa_issues: List[QAIssue],
    audit_log: List[Dict[str, Any]],
) -> str:
    """Exports annotations, scene metadata, and QA audit report to structured JSON."""
    approved_count = sum(1 for b in boxes if b.review_status == ReviewStatus.APPROVED)
    needs_corr_count = sum(1 for b in boxes if b.review_status == ReviewStatus.NEEDS_CORRECTION)
    pending_count = sum(1 for b in boxes if b.review_status == ReviewStatus.PENDING)

    data = {
        "version": "1.0.0",
        "format": "pointcloud_pro_v1",
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "scene_metadata": metadata.to_dict(),
        "summary": {
            "total_annotations": len(boxes),
            "approved": approved_count,
            "needs_correction": needs_corr_count,
            "pending": pending_count,
            "qa_issues_detected": len(qa_issues),
        },
        "annotations": [b.to_dict() for b in boxes],
        "qa_report": [issue.to_dict() for issue in qa_issues],
        "audit_trail": audit_log,
    }
    return json.dumps(data, indent=2)


def export_to_csv(boxes: List[BoundingBox3D]) -> str:
    """Exports 3D annotations to standard CSV tabular format."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id",
        "class_name",
        "center_x",
        "center_y",
        "center_z",
        "dim_length",
        "dim_width",
        "dim_height",
        "rot_yaw",
        "rot_pitch",
        "rot_roll",
        "review_status",
        "point_count",
        "confidence",
        "review_note",
    ])
    for b in boxes:
        writer.writerow([
            b.id,
            b.class_name,
            f"{b.center[0]:.4f}",
            f"{b.center[1]:.4f}",
            f"{b.center[2]:.4f}",
            f"{b.dimensions[0]:.4f}",
            f"{b.dimensions[1]:.4f}",
            f"{b.dimensions[2]:.4f}",
            f"{b.rotation[0]:.4f}",
            f"{b.rotation[1]:.4f}",
            f"{b.rotation[2]:.4f}",
            b.review_status.value,
            b.point_count,
            f"{b.confidence:.2f}",
            b.review_note,
        ])
    return output.getvalue()


def import_and_validate_json(json_str: str) -> Tuple[List[BoundingBox3D], Dict[str, Any]]:
    """
    Parses exported JSON and rigorously verifies schema consistency.
    Raises ValueError with actionable messages if malformed.
    """
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON format: {e}")

    if not isinstance(data, dict):
        raise ValueError("JSON payload root must be a dictionary.")

    if "annotations" not in data:
        raise ValueError("Missing 'annotations' key in JSON schema.")

    boxes: List[BoundingBox3D] = []
    for idx, item in enumerate(data["annotations"]):
        try:
            box = BoundingBox3D.from_dict(item)
            boxes.append(box)
        except Exception as e:
            raise ValueError(f"Annotation record at index {idx} failed schema validation: {e}")

    return boxes, data
