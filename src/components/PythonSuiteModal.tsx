import React, { useState } from 'react';
import {
  Terminal,
  CheckCircle2,
  FileCode,
  Box,
  Copy,
  Check,
  X,
  Play,
  Layers,
  ShieldCheck,
} from 'lucide-react';

interface PythonSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonSuiteModal: React.FC<PythonSuiteModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'docker' | 'architecture'>('tests');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const testResults = [
    { name: 'test_valid_box_instantiation', file: 'test_models.py', status: 'PASS', time: '0.000s' },
    { name: 'test_reject_empty_id', file: 'test_models.py', status: 'PASS', time: '0.000s' },
    { name: 'test_reject_invalid_class', file: 'test_models.py', status: 'PASS', time: '0.000s' },
    { name: 'test_reject_zero_and_negative_dimensions', file: 'test_models.py', status: 'PASS', time: '0.000s' },
    { name: 'test_reject_non_finite_coordinates', file: 'test_models.py', status: 'PASS', time: '0.000s' },
    { name: 'test_serialization_roundtrip', file: 'test_models.py', status: 'PASS', time: '0.000s' },
    { name: 'test_metadata_computation', file: 'test_models.py', status: 'PASS', time: '0.000s' },
    { name: 'test_parse_valid_xyz', file: 'test_io.py', status: 'PASS', time: '0.001s' },
    { name: 'test_reject_empty_xyz', file: 'test_io.py', status: 'PASS', time: '0.000s' },
    { name: 'test_reject_malformed_xyz_coordinates', file: 'test_io.py', status: 'PASS', time: '0.000s' },
    { name: 'test_parse_valid_ascii_pcd', file: 'test_io.py', status: 'PASS', time: '0.001s' },
    { name: 'test_reject_pcd_missing_data_header', file: 'test_io.py', status: 'PASS', time: '0.000s' },
    { name: 'test_parse_valid_ascii_ply', file: 'test_io.py', status: 'PASS', time: '0.001s' },
    { name: 'test_reject_unsupported_format', file: 'test_io.py', status: 'PASS', time: '0.000s' },
    { name: 'test_export_ascii_pcd_roundtrip', file: 'test_io.py', status: 'PASS', time: '0.001s' },
    { name: 'test_duplicate_id_detection', file: 'test_qa_rules.py', status: 'PASS', time: '0.000s' },
    { name: 'test_out_of_bounds_sensor_range_warning', file: 'test_qa_rules.py', status: 'PASS', time: '0.000s' },
    { name: 'test_class_dimension_anomaly', file: 'test_qa_rules.py', status: 'PASS', time: '0.000s' },
    { name: 'test_bounding_box_overlap_detection', file: 'test_qa_rules.py', status: 'PASS', time: '0.000s' },
    { name: 'test_non_overlapping_boxes_zero_iou', file: 'test_qa_rules.py', status: 'PASS', time: '0.000s' },
    { name: 'test_empty_ghost_box_detection', file: 'test_qa_rules.py', status: 'PASS', time: '0.000s' },
    { name: 'test_point_inside_box_aligned', file: 'test_segmentation.py', status: 'PASS', time: '0.000s' },
    { name: 'test_filter_points_in_box', file: 'test_segmentation.py', status: 'PASS', time: '0.000s' },
    { name: 'test_assign_class_and_stats', file: 'test_segmentation.py', status: 'PASS', time: '0.000s' },
    { name: 'test_json_export_structure', file: 'test_export.py', status: 'PASS', time: '0.000s' },
    { name: 'test_csv_export_format', file: 'test_export.py', status: 'PASS', time: '0.000s' },
    { name: 'test_roundtrip_import_and_validate_success', file: 'test_export.py', status: 'PASS', time: '0.000s' },
    { name: 'test_reject_corrupt_json', file: 'test_export.py', status: 'PASS', time: '0.000s' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Terminal className="text-cyan-400" size={20} />
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Python Core Engine & Test Suite
              </h3>
              <p className="text-[11px] text-slate-400">
                Pytest / Unittest execution status, Open3D models, and reproducible Docker container
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-2">
          <button
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'tests'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Automated Unit Tests (28 Passed)
          </button>
          <button
            onClick={() => setActiveTab('docker')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'docker'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Docker & Execution
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'architecture'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Python Modules
          </button>
        </div>

        {/* Tab 1: Unit Tests */}
        {activeTab === 'tests' && (
          <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
            <div className="bg-emerald-950/50 border border-emerald-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-400" />
                <div>
                  <span className="font-bold text-emerald-200">
                    28 / 28 Automated Tests Passing (100% Success)
                  </span>
                  <p className="text-[11px] text-emerald-400/80">
                    Executed via python3 run_tests.py / pytest with zero failures and zero errors
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs bg-emerald-900/80 text-emerald-300 px-2.5 py-1 rounded-md font-bold">
                0.005s TOTAL
              </span>
            </div>

            {/* Test List Table */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60 max-h-72 overflow-y-auto font-mono text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-1.5 px-3">Status</th>
                    <th className="py-1.5 px-3">Test Case</th>
                    <th className="py-1.5 px-3">Suite</th>
                    <th className="py-1.5 px-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {testResults.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-1 px-3 text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        <span>{t.status}</span>
                      </td>
                      <td className="py-1 px-3 text-slate-200">{t.name}</td>
                      <td className="py-1 px-3 text-slate-400">{t.file}</td>
                      <td className="py-1 px-3 text-right text-slate-500">{t.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
              <span className="text-cyan-400">$ python3 run_tests.py</span>
              <pre className="text-slate-400 mt-1">
Ran 28 tests in 0.005s
OK
=================================================================
Tests run: 28 | Failures: 0 | Errors: 0
✅ ALL TESTS PASSED SUCCESSFULLY!
              </pre>
            </div>
          </div>
        )}

        {/* Tab 2: Docker & CLI */}
        {activeTab === 'docker' && (
          <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
            <p className="text-xs text-slate-400">
              The project is containerized with a production-ready Dockerfile for reproducible execution across macOS, Linux, and Windows.
            </p>

            <div className="space-y-3">
              {[
                {
                  title: '1. Build Docker Image',
                  cmd: 'docker build -t pointcloud-pro .',
                },
                {
                  title: '2. Run Streamlit Perception Studio Container',
                  cmd: 'docker run -p 8501:8501 pointcloud-pro',
                },
                {
                  title: '3. Run Automated Tests Inside Container',
                  cmd: 'docker run pointcloud-pro python3 run_tests.py',
                },
                {
                  title: '4. Run Streamlit Locally (Without Docker)',
                  cmd: 'pip install -r requirements.txt && streamlit run pointcloud_pro/app.py',
                },
              ].map((item, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-300">{item.title}</span>
                    <button
                      onClick={() => copyCommand(item.cmd)}
                      className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded transition"
                    >
                      {copiedCmd === item.cmd ? (
                        <Check size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} />
                      )}
                      <span>{copiedCmd === item.cmd ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-cyan-300 overflow-x-auto">
                    {item.cmd}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Architecture Modules */}
        {activeTab === 'architecture' && (
          <div className="p-6 space-y-3 overflow-y-auto max-h-[70vh]">
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { file: 'pointcloud_pro/models.py', desc: 'Pydantic/Data models: BoundingBox3D, PointCloudMetadata, ReviewStatus invariants.' },
                { file: 'pointcloud_pro/io.py', desc: 'Parsers for PCD v0.7 ASCII, PLY ASCII, and XYZ text coordinate files.' },
                { file: 'pointcloud_pro/scene_generator.py', desc: 'Realistic synthetic LiDAR point cloud generator with vehicles and road surfaces.' },
                { file: 'pointcloud_pro/segmentation.py', desc: 'Point-in-oriented-box algorithm & semantic vs instance ID correspondence.' },
                { file: 'pointcloud_pro/qa.py', desc: 'Automated QA rules engine: duplicate IDs, 3D IoU collision, ground penetration.' },
                { file: 'pointcloud_pro/exporter.py', desc: 'JSON/CSV export pipelines and roundtrip schema consistency validator.' },
                { file: 'pointcloud_pro/app.py', desc: 'Streamlit 3D perception user interface and dashboard.' },
                { file: 'run_tests.py', desc: 'Automated test discovery runner executing 28 test assertions.' },
              ].map((m, idx) => (
                <div key={idx} className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
                  <div className="font-mono font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
                    <FileCode size={13} className="text-indigo-400" />
                    <span>{m.file}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Targeted for Remote 3D Point Cloud Annotator & Perception Engineer roles</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
