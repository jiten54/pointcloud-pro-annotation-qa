"""
PointCloud Pro - Point Cloud File Parsers and Ingestion Engine
Supports ASCII PCD (v0.7), ASCII PLY, and XYZ text point cloud formats.
Provides comprehensive malformed, empty, and corrupt file validation.
"""

import os
from typing import Tuple, List, Dict, Any, Optional
from pointcloud_pro.models import PointCloudMetadata


class PointCloudData:
    """In-memory representation of loaded point cloud points and attributes."""

    def __init__(
        self,
        points: List[Tuple[float, float, float]],
        intensities: Optional[List[float]] = None,
        colors: Optional[List[Tuple[int, int, int]]] = None,
        semantic_labels: Optional[List[int]] = None,
        instance_ids: Optional[List[int]] = None,
        metadata: Optional[PointCloudMetadata] = None,
    ):
        self.points = points
        self.intensities = intensities if intensities else [1.0] * len(points)
        self.colors = colors if colors else [(200, 200, 200)] * len(points)
        self.semantic_labels = semantic_labels if semantic_labels else [0] * len(points)
        self.instance_ids = instance_ids if instance_ids else [0] * len(points)
        self.metadata = metadata or self._compute_metadata("in_memory")

    def _compute_metadata(self, file_name: str, fmt: str = "MEMORY") -> PointCloudMetadata:
        if not self.points:
            return PointCloudMetadata(
                file_name=file_name,
                point_count=0,
                bounds_min=(0.0, 0.0, 0.0),
                bounds_max=(0.0, 0.0, 0.0),
                format=fmt,
            )
        xs = [p[0] for p in self.points]
        ys = [p[1] for p in self.points]
        zs = [p[2] for p in self.points]
        return PointCloudMetadata(
            file_name=file_name,
            point_count=len(self.points),
            bounds_min=(min(xs), min(ys), min(zs)),
            bounds_max=(max(xs), max(ys), max(zs)),
            format=fmt,
            has_intensity=bool(self.intensities),
            has_rgb=bool(self.colors),
            has_labels=any(lbl != 0 for lbl in self.semantic_labels),
        )


def parse_xyz(content: str, file_name: str = "pointcloud.xyz") -> PointCloudData:
    """Parses whitespace-separated XYZ point cloud files.
    Supports columns: X Y Z [Intensity] [R G B] [Label]
    """
    lines = [line.strip() for line in content.strip().splitlines() if line.strip() and not line.strip().startswith("#")]
    if not lines:
        raise ValueError("XYZ file is empty or contains only comments.")

    points: List[Tuple[float, float, float]] = []
    intensities: List[float] = []
    colors: List[Tuple[int, int, int]] = []
    labels: List[int] = []

    for line_num, line in enumerate(lines, 1):
        tokens = line.split()
        if len(tokens) < 3:
            raise ValueError(f"Line {line_num} has fewer than 3 coordinates: '{line}'")
        try:
            x, y, z = float(tokens[0]), float(tokens[1]), float(tokens[2])
        except ValueError as e:
            raise ValueError(f"Line {line_num} contains invalid numeric coordinates: {tokens[:3]}") from e

        points.append((x, y, z))

        if len(tokens) == 4:
            intensities.append(float(tokens[3]))
        elif len(tokens) >= 6:
            try:
                r, g, b = int(float(tokens[3])), int(float(tokens[4])), int(float(tokens[5]))
                colors.append((r, g, b))
            except ValueError:
                colors.append((200, 200, 200))
            if len(tokens) >= 7:
                try:
                    labels.append(int(tokens[6]))
                except ValueError:
                    labels.append(0)

    pcd = PointCloudData(points, intensities=intensities or None, colors=colors or None, semantic_labels=labels or None)
    pcd.metadata = pcd._compute_metadata(file_name, "XYZ")
    return pcd


def parse_pcd(content: str, file_name: str = "pointcloud.pcd") -> PointCloudData:
    """Parses ASCII Point Cloud Data (PCD v0.7) format."""
    lines = content.strip().splitlines()
    if not lines:
        raise ValueError("PCD file is completely empty.")

    header_fields: Dict[str, str] = {}
    data_start_idx = -1
    is_ascii = False

    for idx, raw_line in enumerate(lines):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        tokens = line.split()
        tag = tokens[0].upper()
        if tag == "DATA":
            if len(tokens) > 1 and tokens[1].lower() == "ascii":
                is_ascii = True
            elif len(tokens) > 1 and tokens[1].lower() == "binary":
                raise ValueError("Binary PCD format is not supported in ASCII parser. Please supply ASCII PCD.")
            data_start_idx = idx + 1
            break
        else:
            header_fields[tag] = " ".join(tokens[1:])

    if data_start_idx == -1:
        raise ValueError("Malformed PCD file: Missing DATA header specifier.")

    fields = header_fields.get("FIELDS", "x y z").split()
    if "x" not in fields or "y" not in fields or "z" not in fields:
        raise ValueError(f"PCD FIELDS header must include x, y, and z coordinates. Found: {fields}")

    x_idx = fields.index("x")
    y_idx = fields.index("y")
    z_idx = fields.index("z")
    intensity_idx = fields.index("intensity") if "intensity" in fields else (fields.index("i") if "i" in fields else None)
    rgb_idx = fields.index("rgb") if "rgb" in fields else None
    label_idx = fields.index("label") if "label" in fields else None

    points: List[Tuple[float, float, float]] = []
    intensities: List[float] = []
    labels: List[int] = []

    for row_idx, raw_line in enumerate(lines[data_start_idx:], data_start_idx + 1):
        line = raw_line.strip()
        if not line:
            continue
        vals = line.split()
        if len(vals) < len(fields):
            raise ValueError(f"Line {row_idx}: expected {len(fields)} values, found {len(vals)}")
        try:
            x = float(vals[x_idx])
            y = float(vals[y_idx])
            z = float(vals[z_idx])
        except ValueError as e:
            raise ValueError(f"Line {row_idx}: non-numeric coordinate values: {vals}") from e

        points.append((x, y, z))
        if intensity_idx is not None:
            try:
                intensities.append(float(vals[intensity_idx]))
            except ValueError:
                intensities.append(1.0)
        if label_idx is not None:
            try:
                labels.append(int(float(vals[label_idx])))
            except ValueError:
                labels.append(0)

    if not points:
        raise ValueError("PCD file contains 0 valid point records.")

    pcd = PointCloudData(points, intensities=intensities or None, semantic_labels=labels or None)
    pcd.metadata = pcd._compute_metadata(file_name, "PCD")
    return pcd


def parse_ply(content: str, file_name: str = "pointcloud.ply") -> PointCloudData:
    """Parses ASCII Polygon File Format (PLY) files."""
    lines = content.strip().splitlines()
    if not lines or lines[0].strip() != "ply":
        raise ValueError("Invalid PLY file: Must start with 'ply' magic header.")

    in_header = True
    vertex_count = 0
    element_properties: List[str] = []
    data_start_idx = -1
    is_ascii = False

    for idx, raw_line in enumerate(lines[1:], 1):
        line = raw_line.strip()
        tokens = line.split()
        if not tokens:
            continue
        if tokens[0] == "format":
            if "ascii" in tokens:
                is_ascii = True
            else:
                raise ValueError(f"Only ASCII PLY format supported. Got: {line}")
        elif tokens[0] == "element" and len(tokens) >= 3 and tokens[1] == "vertex":
            vertex_count = int(tokens[2])
        elif tokens[0] == "property":
            # property <type> <name>
            if len(tokens) >= 3:
                element_properties.append(tokens[2])
        elif tokens[0] == "end_header":
            data_start_idx = idx + 1
            break

    if data_start_idx == -1:
        raise ValueError("Malformed PLY file: Missing 'end_header' token.")

    if not ("x" in element_properties and "y" in element_properties and "z" in element_properties):
        raise ValueError(f"PLY vertex properties must include x, y, and z. Found: {element_properties}")

    x_idx = element_properties.index("x")
    y_idx = element_properties.index("y")
    z_idx = element_properties.index("z")
    red_idx = element_properties.index("red") if "red" in element_properties else (element_properties.index("r") if "r" in element_properties else None)
    green_idx = element_properties.index("green") if "green" in element_properties else (element_properties.index("g") if "g" in element_properties else None)
    blue_idx = element_properties.index("blue") if "blue" in element_properties else (element_properties.index("b") if "b" in element_properties else None)

    points: List[Tuple[float, float, float]] = []
    colors: List[Tuple[int, int, int]] = []

    for row_idx, raw_line in enumerate(lines[data_start_idx:], data_start_idx + 1):
        line = raw_line.strip()
        if not line:
            continue
        vals = line.split()
        if len(vals) < len(element_properties):
            continue
        try:
            x = float(vals[x_idx])
            y = float(vals[y_idx])
            z = float(vals[z_idx])
        except ValueError as e:
            raise ValueError(f"Line {row_idx}: non-numeric coordinates: {vals}") from e

        points.append((x, y, z))
        if red_idx is not None and green_idx is not None and blue_idx is not None:
            try:
                colors.append((int(vals[red_idx]), int(vals[green_idx]), int(vals[blue_idx])))
            except ValueError:
                colors.append((200, 200, 200))

    if not points:
        raise ValueError("PLY file contains 0 point records.")

    pcd = PointCloudData(points, colors=colors or None)
    pcd.metadata = pcd._compute_metadata(file_name, "PLY")
    return pcd


def load_point_cloud_file(file_path_or_name: str, content: str) -> PointCloudData:
    """Routes point cloud loading to the appropriate parser by file extension."""
    ext = os.path.splitext(file_path_or_name)[1].lower()
    if ext == ".pcd":
        return parse_pcd(content, file_path_or_name)
    elif ext == ".ply":
        return parse_ply(content, file_path_or_name)
    elif ext in [".xyz", ".txt", ".pts"]:
        return parse_xyz(content, file_path_or_name)
    else:
        raise ValueError(f"Unsupported point cloud format '{ext}'. Supported formats: .pcd, .ply, .xyz")


def export_to_pcd_ascii(pcd: PointCloudData) -> str:
    """Exports PointCloudData to ASCII PCD v0.7 string."""
    num_pts = len(pcd.points)
    header = [
        "# .PCD v0.7 - Point Cloud Data file format",
        "VERSION 0.7",
        "FIELDS x y z intensity label",
        "SIZE 4 4 4 4 4",
        "TYPE F F F F U",
        "COUNT 1 1 1 1 1",
        f"WIDTH {num_pts}",
        "HEIGHT 1",
        "VIEWPOINT 0 0 0 1 0 0 0",
        f"POINTS {num_pts}",
        "DATA ascii",
    ]
    lines = header + [
        f"{p[0]:.4f} {p[1]:.4f} {p[2]:.4f} {pcd.intensities[i]:.2f} {pcd.semantic_labels[i]}"
        for i, p in enumerate(pcd.points)
    ]
    return "\n".join(lines)
