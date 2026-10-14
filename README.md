# PointCloud Pro — 3D Point Cloud Annotation & Quality Assurance Studio

[![Tests](https://img.shields.io/badge/tests-28%20passed-brightgreen.svg)](#testing-and-engineering)
[![Python](https://img.shields.io/badge/python-3.10%2B-blue.svg)](#technology-stack)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](#docker-deployment)
[![License](https://img.shields.io/badge/license-Apache--2.0-lightgrey.svg)](LICENSE)

A portfolio-grade 3D LiDAR annotation, semantic segmentation, and automated Quality Assurance (QA) studio tailored to the high-standard workflows of a **Remote 3D Point Cloud Annotator & Perception QA Specialist**.

---

## 🌟 Key Capabilities

1. **Multi-Format Dataset Ingestion**
   - High-performance parsers for **PCD** (ASCII v0.7), **PLY** (ASCII), and **XYZ / PTS / TXT** point clouds.
   - Rigorous file integrity validation: immediate detection and descriptive error reporting for empty files, truncated lines, non-numeric values, or missing headers.
   - Real-time metadata computation: total point counts, coordinate span extents ($X, Y, Z$ dimensions), spatial bounds ($\min/\max$), and attribute detection (reflectivity intensity, RGB, semantic labels).

2. **Interactive 3D Scene Perception Viewer**
   - Dual-engine architecture:
     - **Web Studio (Port 3000)**: Hardware-accelerated Three.js WebGL canvas with camera presets (Perspective 3D, Top-Down BEV, Front, Side), OrbitControls, point sizing, and coordinate triad ($X=\text{Red}, Y=\text{Green}, Z=\text{Blue}$).
     - **Python Studio (Streamlit + Open3D)**: Native Python workstation with 3D scatter plots and point attribute inspectors.
   - Dynamic point cloud colorization:
     - **Semantic Class** (color-coded by perception classes)
     - **Elevation / Z-Height** (Turbo / Viridis elevation gradient)
     - **Reflectivity Intensity** (LiDAR return signal strength)
     - **Instance ID** (unique per-object grouping)

3. **3D Oriented Bounding Box Annotation**
   - Standard 10 perception classes: `car`, `truck`, `bus`, `pedestrian`, `cyclist`, `motorcycle`, `road`, `vegetation`, `building`, `other`.
   - Complete 3D bounding box parameterization:
     - Center coordinates: $[x, y, z]$ in sensor frame (meters)
     - Bounding extents: $[dx, dy, dz]$ (length, width, height in meters)
     - Orientation: $[\text{yaw}, \text{pitch}, \text{roll}]$ in radians / degrees
     - Directional heading arrow displaying vehicle forward trajectory
   - Interactive creation, selection, fine-tuning, coordinate translation, yaw rotation, and dimension scaling.
   - Invariant enforcement: strictly positive dimensions ($>0$), finite numeric coordinates, and uniqueness of annotation IDs.

4. **Point-Level Semantic & Instance Segmentation**
   - Precise point-to-label correspondence preservation.
   - Point-in-oriented-box algorithm testing spatial containment in rotated 3D boxes.
   - Distinction between semantic class IDs (e.g., class 4 = Car) and instance IDs (e.g., Car #1 vs Car #2).
   - In-box point auto-labeling and semantic distribution analytics.

5. **Automated Quality Assurance (QA) Engine**
   - **RULE-QA-001**: Duplicate annotation ID collision detection.
   - **RULE-QA-002**: Invalid or unmapped semantic class verification.
   - **RULE-QA-003**: Non-positive or infinite box dimension errors.
   - **RULE-QA-004**: Out-of-bounds sensor range validation ($>120\text{m}$).
   - **RULE-QA-005**: Ground penetration check ($z_{\text{base}} < -1.5\text{m}$).
   - **RULE-QA-006 / 007**: Physical dimension anomaly detection (oversized or undersized envelopes compared to nominal vehicle/pedestrian dimensions).
   - **RULE-QA-008**: 3D bounding box overlap / penetration detection via volumetric AABB Intersection-over-Union (IoU).
   - **RULE-QA-009**: Ghost annotation detection ($0$ points inside bounding box).
   - **RULE-QA-010**: Low-density point warning ($<5$ points).
   - Human Review Workflow: Three-state sign-off (`Pending`, `Approved`, `Needs Correction`) with reviewer audit notes.

6. **Dataset Export & Audit Trail**
   - Formats: Industry-standard **JSON** (schema-validated with scene metadata and QA report) and **CSV** tabular export.
   - Built-in JSON re-import validator for roundtrip integrity verification.
   - Audit trail capturing timestamps, operator signatures, and granular actions.

7. **Perception Analytics Dashboard**
   - Real-time project metrics: total points, annotated 3D objects, approval progress bar, class distribution histogram, and QA issue severity breakdown.

---

## 🛠️ Technology Stack

- **Frontend / WebGL**: React 19, TypeScript, Three.js, Tailwind CSS, Lucide Icons, Motion.
- **Python Backend**: Python 3.10+, NumPy, pandas, Pydantic, Open3D, Streamlit.
- **Testing**: `pytest` and Python `unittest` test suite.
- **DevOps**: Docker, Docker Compose.

---

## 📂 Repository Structure

```text
├── Dockerfile                   # Reproducible container configuration
├── requirements.txt             # Python dependencies
├── run_tests.py                 # Automated unit test runner
├── data/
│   └── samples/                 # Sample datasets (PCD, XYZ, JSON, QA report)
│       ├── urban_intersection.pcd
│       ├── pedestrian_crossing.xyz
│       ├── sample_annotations.json
│       └── sample_qa_report.json
├── pointcloud_pro/              # Core Python library
│   ├── __init__.py
│   ├── models.py                # BoundingBox3D, PointCloudMetadata, ReviewStatus
│   ├── io.py                    # Parsers for PCD, PLY, and XYZ formats
│   ├── scene_generator.py       # Realistic synthetic LiDAR scene generator
│   ├── segmentation.py          # Point-in-box and semantic labeling
│   ├── qa.py                    # Automated QA rules engine and 3D IoU calculator
│   ├── exporter.py              # JSON/CSV export and re-import schema validator
│   └── app.py                   # Streamlit interactive application
├── tests/                       # Unit tests
│   ├── test_models.py
│   ├── test_io.py
│   ├── test_qa_rules.py
│   ├── test_segmentation.py
│   └── test_export.py
└── src/                         # Interactive Three.js WebGL Studio (Port 3000)
    ├── App.tsx
    ├── types/pointcloud.ts
    ├── constants/classes.ts
    ├── utils/fileParsers.ts
    ├── utils/syntheticData.ts
    ├── utils/qaEngine.ts
    ├── utils/exporter.ts
    └── components/
        ├── PointCloudCanvas.tsx
        ├── AnnotationSidebar.tsx
        ├── QAPanel.tsx
        ├── SegmentationPanel.tsx
        ├── DashboardView.tsx
        ├── SceneLoaderModal.tsx
        ├── AuditTrailModal.tsx
        └── ExportModal.tsx
```

---

## 🚀 Quick Start Guide

### Option 1: Running the Live Web Application (Port 3000)
The web studio runs directly in the current workspace via Vite:
```bash
npm run dev
```
Open `http://localhost:3000` to interact with the full 3D LiDAR annotation workstation in your browser.

### Option 2: Running the Python Streamlit Application
Install dependencies and run:
```bash
pip install -r requirements.txt
streamlit run pointcloud_pro/app.py
```

### Option 3: Running via Docker
```bash
docker build -t pointcloud-pro .
docker run -p 8501:8501 pointcloud-pro
```
Navigate to `http://localhost:8501`.

---

## 🧪 Testing and Engineering

To execute the automated unit test suite:
```bash
python3 run_tests.py
# Or with pytest:
pytest tests/ -v
```

### Test Coverage Highlights:
- **Geometry & Constraints**: Validates strictly positive dimensions, rejects `NaN`/`Inf` coordinates, validates class enums, and computes 3D volume.
- **IO Robustness**: Verifies header parsing, coordinate tokenization, and graceful failure on empty or malformed files.
- **QA Rules**: Tests duplicate ID detection, out-of-bounds alerts, dimensional anomalies, and 3D box collisions.
- **Segmentation**: Tests oriented bounding box point containment and label correspondence.
- **Roundtrip Export**: Tests JSON schema conformance, CSV serialization, and re-import deserialization.

---

## 📋 Sample Workflow for Remote Annotator

1. **Ingest Scene**:
   - Choose a sample synthetic scene or upload your own `.pcd`, `.ply`, or `.xyz` file.
   - Inspect the metadata panel for point count and coordinate bounds.
2. **Orient 3D Perception**:
   - Switch between **Perspective**, **Top-Down (BEV)**, and **Side** camera angles.
   - Toggle color modes (e.g., Z-Height for curb detection, Intensity for lane markings).
3. **Annotate 3D Bounding Boxes**:
   - Click **Add Box** and select a target class (`car`, `pedestrian`, etc.).
   - Adjust $[x, y, z]$ center position and yaw angle to align with the point cloud cluster.
   - Observe the heading indicator arrow to ensure proper vehicle orientation.
4. **Segment Points**:
   - Use the **Segment In Box** tool to transfer 3D bounding box class labels to the enclosed points.
5. **Run Quality Assurance**:
   - Open the **QA Inspector** tab to review heuristic warnings (overlaps, ghost boxes, low density).
   - Resolve critical issues and mark boxes as `Approved` or `Needs Correction`.
6. **Export & Audit**:
   - Download the final validated **JSON** or **CSV** dataset with complete audit history.

---

## ⚖️ Synthetic vs. Real Data Notice
All sample datasets bundled in `data/samples/` and generated dynamically in the application are **synthetically generated** mathematical representations designed for safe, open-source testing and portfolio demonstration without licensing or privacy constraints.
