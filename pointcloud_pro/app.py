"""
PointCloud Pro - Streamlit 3D Point Cloud Annotation & QA Studio
Full-featured Python user interface powered by Streamlit, NumPy, and Pydantic/dataclasses.
Provides 3D point cloud inspection, annotation editing, QA audits, and dataset export.
"""

import os
import json
import io
import math
from datetime import datetime

try:
    import streamlit as st
    import pandas as pd
    import numpy as np
    STREAMLIT_AVAILABLE = True
except ImportError:
    STREAMLIT_AVAILABLE = False

from pointcloud_pro.models import (
    BoundingBox3D,
    SemanticClass,
    ReviewStatus,
    QASeverity,
    DEFAULT_CLASS_DIMENSIONS,
    SEMANTIC_CLASS_COLORS,
    SEMANTIC_CLASS_ID_MAP,
)
from pointcloud_pro.io import (
    load_point_cloud_file,
    parse_xyz,
    parse_pcd,
    parse_ply,
    export_to_pcd_ascii,
)
from pointcloud_pro.scene_generator import generate_synthetic_scene
from pointcloud_pro.segmentation import (
    filter_points_in_box,
    assign_points_to_class,
    compute_segmentation_stats,
)
from pointcloud_pro.qa import QARunner
from pointcloud_pro.exporter import (
    export_to_json,
    export_to_csv,
    import_and_validate_json,
)


def run_streamlit_app():
    if not STREAMLIT_AVAILABLE:
        print("Streamlit is not installed in current Python environment. Please run: pip install -r requirements.txt")
        return

    st.set_page_config(
        page_title="PointCloud Pro — 3D LiDAR Annotation Studio",
        page_icon="🧊",
        layout="wide",
        initial_sidebar_state="expanded",
    )

    st.markdown(
        """
        <style>
        .metric-card {
            background-color: #1e293b;
            border-radius: 8px;
            padding: 12px 16px;
            border: 1px solid #334155;
            color: #f8fafc;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

    # Initialize Session State
    if "pcd_data" not in st.session_state:
        pcd, boxes = generate_synthetic_scene("urban_intersection", 4000)
        st.session_state.pcd_data = pcd
        st.session_state.boxes = boxes
        st.session_state.audit_trail = [
            {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "operator": "Auto-Init",
                "action": "Loaded synthetic urban intersection scene",
            }
        ]
        st.session_state.selected_box_id = boxes[0].id if boxes else None

    # Sidebar: Dataset Ingestion & Configuration
    with st.sidebar:
        st.title("🧊 PointCloud Pro")
        st.caption("3D Point Cloud Annotation & QA Studio")
        st.markdown("---")

        st.subheader("1. Dataset Ingestion")
        scene_choice = st.selectbox(
            "Sample Scenes",
            ["Urban Intersection", "Dense Highway", "Suburban Crosswalk"],
        )
        if st.button("Generate / Reset Scene", use_container_width=True):
            scene_map = {
                "Urban Intersection": "urban_intersection",
                "Dense Highway": "dense_highway",
                "Suburban Crosswalk": "suburban_crosswalk",
            }
            pcd, boxes = generate_synthetic_scene(scene_map[scene_choice], 4500)
            st.session_state.pcd_data = pcd
            st.session_state.boxes = boxes
            st.session_state.selected_box_id = boxes[0].id if boxes else None
            st.session_state.audit_trail.append({
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "operator": "Annotator-1",
                "action": f"Switched to sample scene '{scene_choice}'",
            })
            st.rerun()

        uploaded_file = st.file_uploader(
            "Upload Point Cloud (.pcd, .ply, .xyz)",
            type=["pcd", "ply", "xyz", "txt"],
        )
        if uploaded_file is not None:
            try:
                content = uploaded_file.getvalue().decode("utf-8")
                loaded_pcd = load_point_cloud_file(uploaded_file.name, content)
                st.session_state.pcd_data = loaded_pcd
                st.session_state.boxes = []
                st.session_state.selected_box_id = None
                st.success(f"Loaded {uploaded_file.name}: {len(loaded_pcd.points):,} points")
            except Exception as e:
                st.error(f"Failed to ingest file: {e}")

        st.markdown("---")
        st.subheader("Point Cloud Metadata")
        meta = st.session_state.pcd_data.metadata
        st.text(f"File: {meta.file_name}")
        st.text(f"Points: {meta.point_count:,}")
        st.text(f"Format: {meta.format}")
        st.text(f"Span X: {meta.dimensions[0]:.1f}m")
        st.text(f"Span Y: {meta.dimensions[1]:.1f}m")
        st.text(f"Span Z: {meta.dimensions[2]:.1f}m")

    # Main Application Tabs
    tab_scene, tab_annotate, tab_qa, tab_segment, tab_export, tab_dash = st.tabs([
        "🌐 3D Scene Viewer",
        "📦 3D Bounding Boxes",
        "🛡️ Quality Assurance (QA)",
        "🎨 Semantic Segmentation",
        "💾 Export & Import",
        "📊 Dashboard",
    ])

    pcd = st.session_state.pcd_data
    boxes = st.session_state.boxes

    # Tab 1: 3D Scene Viewer
    with tab_scene:
        st.header("Interactive 3D LiDAR Perception Viewer")
        st.info("💡 Navigation: Rotate = Left Click Drag | Pan = Right Click Drag | Zoom = Scroll Wheel")

        col_ctrl1, col_ctrl2, col_ctrl3 = st.columns(3)
        with col_ctrl1:
            color_mode = st.selectbox("Coloring Mode", ["Semantic Class", "Elevation (Z-Height)", "Reflectivity Intensity"])
        with col_ctrl2:
            point_size = st.slider("Point Render Size", 1, 8, 3)
        with col_ctrl3:
            show_axes = st.checkbox("Show Coordinate Triad (XYZ)", value=True)

        # Plotly 3D Scatter or Fallback Display
        try:
            import plotly.graph_objects as go

            sample_step = max(1, len(pcd.points) // 2500)
            sampled_pts = pcd.points[::sample_step]
            xs = [p[0] for p in sampled_pts]
            ys = [p[1] for p in sampled_pts]
            zs = [p[2] for p in sampled_pts]

            if color_mode == "Elevation (Z-Height)":
                colors = zs
                colorscale = "Viridis"
            elif color_mode == "Reflectivity Intensity":
                colors = pcd.intensities[::sample_step]
                colorscale = "Cividis"
            else:
                colors = pcd.semantic_labels[::sample_step]
                colorscale = "Turbo"

            fig = go.Figure(data=[go.Scatter3d(
                x=xs, y=ys, z=zs,
                mode="markers",
                marker=dict(
                    size=point_size,
                    color=colors,
                    colorscale=colorscale,
                    opacity=0.8,
                )
            )])

            fig.update_layout(
                scene=dict(
                    xaxis_title="X (Forward)",
                    yaxis_title="Y (Left/Right)",
                    zaxis_title="Z (Up)",
                    aspectmode="data",
                ),
                margin=dict(l=0, r=0, b=0, t=20),
                height=520,
            )
            st.plotly_chart(fig, use_container_width=True)
        except ImportError:
            st.warning("Plotly is not installed. Displaying point cloud spatial statistics table:")
            df_pts = pd.DataFrame(pcd.points[:20], columns=["X", "Y", "Z"])
            st.dataframe(df_pts)

    # Tab 2: 3D Bounding Boxes
    with tab_annotate:
        st.header("3D Oriented Bounding Box Annotations")
        col_list, col_edit = st.columns([1, 2])

        with col_list:
            st.subheader("Annotations List")
            box_names = [f"{b.id} ({b.class_name})" for b in boxes]
            sel_idx = 0
            if st.session_state.selected_box_id:
                for i, b in enumerate(boxes):
                    if b.id == st.session_state.selected_box_id:
                        sel_idx = i
                        break

            chosen = st.radio("Select Box", box_names, index=sel_idx if box_names else 0)
            if chosen and boxes:
                curr_id = chosen.split()[0]
                st.session_state.selected_box_id = curr_id

            st.markdown("---")
            st.subheader("Create New Box")
            new_class = st.selectbox("Class", [c.value for c in SemanticClass])
            if st.button("➕ Add Box", use_container_width=True):
                new_id = f"box-{new_class}-{len(boxes)+1:02d}"
                def_dims = DEFAULT_CLASS_DIMENSIONS[new_class]
                new_box = BoundingBox3D(
                    id=new_id,
                    class_name=new_class,
                    center=(0.0, 0.0, def_dims[2] / 2.0),
                    dimensions=def_dims,
                    rotation=(0.0, 0.0, 0.0),
                    review_status=ReviewStatus.PENDING,
                )
                boxes.append(new_box)
                st.session_state.selected_box_id = new_id
                st.session_state.audit_trail.append({
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "operator": "Annotator-1",
                    "action": f"Created new 3D box '{new_id}'",
                })
                st.rerun()

        with col_edit:
            selected_box = next((b for b in boxes if b.id == st.session_state.selected_box_id), None)
            if selected_box:
                st.subheader(f"Edit Box: {selected_box.id}")

                c1, c2, c3 = st.columns(3)
                with c1:
                    new_cname = st.selectbox("Class", [c.value for c in SemanticClass], index=[c.value for c in SemanticClass].index(selected_box.class_name))
                with c2:
                    new_status = st.selectbox("Review Status", [s.value for s in ReviewStatus], index=[s.value for s in ReviewStatus].index(selected_box.review_status.value))
                with c3:
                    st.metric("Contained Points", selected_box.point_count)

                st.markdown("##### Center Coordinates (meters)")
                cx, cy, cz = st.columns(3)
                with cx:
                    nx = st.number_input("Center X", value=selected_box.center[0], step=0.1)
                with cy:
                    ny = st.number_input("Center Y", value=selected_box.center[1], step=0.1)
                with cz:
                    nz = st.number_input("Center Z", value=selected_box.center[2], step=0.1)

                st.markdown("##### Dimensions (Length, Width, Height in meters)")
                dl, dw, dh = st.columns(3)
                with dl:
                    nl = st.number_input("Length (dx)", value=selected_box.dimensions[0], min_value=0.1, step=0.1)
                with dw:
                    nw = st.number_input("Width (dy)", value=selected_box.dimensions[1], min_value=0.1, step=0.1)
                with dh:
                    nh = st.number_input("Height (dz)", value=selected_box.dimensions[2], min_value=0.1, step=0.1)

                st.markdown("##### Rotation (Yaw in degrees)")
                yaw_deg = st.slider("Yaw Angle", -180.0, 180.0, math.degrees(selected_box.rotation[0]))

                review_note = st.text_input("Reviewer Notes", value=selected_box.review_note)

                btn_save, btn_del = st.columns(2)
                with btn_save:
                    if st.button("💾 Apply Changes", use_container_width=True):
                        selected_box.class_name = new_cname
                        selected_box.review_status = ReviewStatus(new_status)
                        selected_box.center = (nx, ny, nz)
                        selected_box.dimensions = (nl, nw, nh)
                        selected_box.rotation = (math.radians(yaw_deg), 0.0, 0.0)
                        selected_box.review_note = review_note
                        st.session_state.audit_trail.append({
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                            "operator": "Annotator-1",
                            "action": f"Updated box '{selected_box.id}' parameters",
                        })
                        st.success("Box parameters updated!")
                        st.rerun()
                with btn_del:
                    if st.button("🗑️ Delete Box", use_container_width=True):
                        boxes.remove(selected_box)
                        st.session_state.selected_box_id = boxes[0].id if boxes else None
                        st.session_state.audit_trail.append({
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                            "operator": "Annotator-1",
                            "action": f"Deleted box '{selected_box.id}'",
                        })
                        st.warning(f"Deleted {selected_box.id}")
                        st.rerun()

    # Tab 3: Quality Assurance
    with tab_qa:
        st.header("Automated Quality Assurance Rules Engine")
        st.caption("Heuristic detection of anomalies, duplicate IDs, collisions, and missing labels.")

        runner = QARunner()
        qa_issues = runner.run_all_checks(boxes, pcd)

        c1, c2, c3, c4 = st.columns(4)
        crit_count = sum(1 for i in qa_issues if i.severity == QASeverity.CRITICAL)
        warn_count = sum(1 for i in qa_issues if i.severity == QASeverity.WARNING)
        info_count = sum(1 for i in qa_issues if i.severity == QASeverity.INFO)
        with c1:
            st.metric("Total Issues", len(qa_issues))
        with c2:
            st.metric("Critical Errors", crit_count)
        with c3:
            st.metric("Warnings", warn_count)
        with c4:
            st.metric("Informational", info_count)

        st.markdown("---")
        if qa_issues:
            for issue in qa_issues:
                color = "red" if issue.severity == QASeverity.CRITICAL else ("orange" if issue.severity == QASeverity.WARNING else "blue")
                with st.expander(f":{color}[{issue.severity.value}] [{issue.rule_id}] {issue.annotation_id or 'Scene'}: {issue.message}"):
                    st.write(f"**Explanation:** {issue.message}")
                    st.write(f"**Recommended Action:** {issue.recommended_action}")
        else:
            st.success("✅ All Quality Assurance rules passed with 0 violations!")

    # Tab 4: Segmentation
    with tab_segment:
        st.header("Point-Level Semantic Segmentation")
        seg_stats = compute_segmentation_stats(pcd)
        st.write(f"**Total Points:** {seg_stats['total_points']:,} | **Distinct Instances:** {seg_stats['active_instance_count']}")

        df_seg = pd.DataFrame([
            {"Class": k, "Point Count": v, "Percentage": f"{seg_stats['class_percentages'][k]}%"}
            for k, v in seg_stats["class_counts"].items()
        ])
        st.dataframe(df_seg, use_container_width=True)

    # Tab 5: Export & Import
    with tab_export:
        st.header("Dataset Export & Roundtrip Verification")
        runner = QARunner()
        qa_issues = runner.run_all_checks(boxes, pcd)

        json_export = export_to_json(boxes, pcd.metadata, qa_issues, st.session_state.audit_trail)
        csv_export = export_to_csv(boxes)

        col_exp1, col_exp2 = st.columns(2)
        with col_exp1:
            st.download_button(
                "📥 Download Annotation JSON",
                data=json_export,
                file_name="annotations_pointcloud_pro.json",
                mime="application/json",
                use_container_width=True,
            )
        with col_exp2:
            st.download_button(
                "📥 Download Annotation CSV",
                data=csv_export,
                file_name="annotations_pointcloud_pro.csv",
                mime="text/csv",
                use_container_width=True,
            )

        st.markdown("---")
        st.subheader("Re-Import & Schema Verification")
        reimport_text = st.text_area("Paste JSON Payload to verify", height=150)
        if st.button("Verify Schema Integrity"):
            try:
                imp_boxes, parsed = import_and_validate_json(reimport_text)
                st.success(f"Verification Successful: {len(imp_boxes)} valid 3D bounding boxes extracted!")
            except Exception as e:
                st.error(f"Schema Validation Failed: {e}")

    # Tab 6: Dashboard
    with tab_dash:
        st.header("Annotation Project Dashboard")
        d1, d2, d3, d4 = st.columns(4)
        with d1:
            st.metric("Total Points", f"{len(pcd.points):,}")
        with d2:
            st.metric("3D Objects", len(boxes))
        with d3:
            approved = sum(1 for b in boxes if b.review_status == ReviewStatus.APPROVED)
            st.metric("Approved Objects", f"{approved} / {len(boxes)}")
        with d4:
            st.metric("Audit Trail Events", len(st.session_state.audit_trail))


if __name__ == "__main__":
    run_streamlit_app()
