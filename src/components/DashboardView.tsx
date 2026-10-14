import React from 'react';
import {
  BoundingBox3D,
  Point3D,
  PointCloudMetadata,
  QAIssue,
} from '../types/pointcloud';
import { SEMANTIC_CLASSES } from '../constants/classes';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Box,
  MapPin,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface DashboardViewProps {
  metadata: PointCloudMetadata;
  points: Point3D[];
  boxes: BoundingBox3D[];
  qaIssues: QAIssue[];
  scenesCount: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metadata,
  points,
  boxes,
  qaIssues,
  scenesCount,
}) => {
  // Compute genuine statistics directly from current application state
  const totalBoxes = boxes.length;
  const approvedBoxes = boxes.filter(b => b.reviewStatus === 'Approved').length;
  const needsCorrectionBoxes = boxes.filter(b => b.reviewStatus === 'Needs Correction').length;
  const pendingBoxes = boxes.filter(b => b.reviewStatus === 'Pending').length;

  const approvalRate = totalBoxes > 0 ? (approvedBoxes / totalBoxes) * 100 : 0;

  const criticalIssues = qaIssues.filter(i => i.severity === 'CRITICAL').length;
  const warningIssues = qaIssues.filter(i => i.severity === 'WARNING').length;
  const infoIssues = qaIssues.filter(i => i.severity === 'INFO').length;

  // Genuine perception quality score: starts at 100, penalized by critical and warnings
  const rawScore = 100 - criticalIssues * 20 - warningIssues * 6;
  const qualityScore = Math.max(0, Math.min(100, totalBoxes === 0 ? 100 : rawScore));

  // Compute class frequency among 3D boxes
  const classBreakdown: Record<string, number> = {};
  for (const b of boxes) {
    classBreakdown[b.className] = (classBreakdown[b.className] || 0) + 1;
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-y-auto select-none p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Activity className="text-cyan-400" size={22} />
            <span>Perception Project Dashboard & QA Analytics</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time computed metrics from active LiDAR point cloud and 3D bounding box records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-950 border border-slate-800 px-3 py-1 rounded-md text-xs font-mono text-cyan-300">
            Active Scene: {metadata.fileName}
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-4 gap-4">
        {/* Metric 1: Total Points */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Point Cloud Density</span>
            <MapPin size={16} className="text-blue-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100">
            {points.length.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
            <span>Dimensions: {metadata.dimensions[0].toFixed(1)}m × {metadata.dimensions[1].toFixed(1)}m × {metadata.dimensions[2].toFixed(1)}m</span>
          </div>
        </div>

        {/* Metric 2: Annotated 3D Objects */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Annotated Objects</span>
            <Box size={16} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-indigo-300">
            {totalBoxes}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {Object.keys(classBreakdown).length} distinct object classes
          </div>
        </div>

        {/* Metric 3: Review Progress */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Review Approval Rate</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400">
            {approvalRate.toFixed(1)}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${approvalRate}%` }}
            />
          </div>
        </div>

        {/* Metric 4: Perception QA Quality Index */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Perception QA Index</span>
            {qualityScore >= 80 ? (
              <ShieldCheck size={16} className="text-emerald-400" />
            ) : (
              <ShieldAlert size={16} className="text-amber-400" />
            )}
          </div>
          <div
            className={`text-2xl font-mono font-bold ${
              qualityScore >= 80
                ? 'text-emerald-400'
                : qualityScore >= 60
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {qualityScore.toFixed(0)} / 100
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {qaIssues.length} total heuristic flags
          </div>
        </div>
      </div>

      {/* Review Progress Breakdown & QA Severity Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Review Status Distribution */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={15} className="text-cyan-400" />
            <span>Human Review Workflow Status</span>
          </h3>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 size={13} /> Approved
                </span>
                <span>{approvedBoxes} / {totalBoxes} ({((approvedBoxes / Math.max(1, totalBoxes)) * 100).toFixed(1)}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${(approvedBoxes / Math.max(1, totalBoxes)) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Clock size={13} /> Pending Review
                </span>
                <span>{pendingBoxes} / {totalBoxes} ({((pendingBoxes / Math.max(1, totalBoxes)) * 100).toFixed(1)}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full"
                  style={{ width: `${(pendingBoxes / Math.max(1, totalBoxes)) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
                <span className="flex items-center gap-1.5 text-rose-400">
                  <AlertTriangle size={13} /> Needs Correction
                </span>
                <span>{needsCorrectionBoxes} / {totalBoxes} ({((needsCorrectionBoxes / Math.max(1, totalBoxes)) * 100).toFixed(1)}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full"
                  style={{ width: `${(needsCorrectionBoxes / Math.max(1, totalBoxes)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* QA Anomaly Breakdown */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert size={15} className="text-amber-400" />
            <span>QA Rule Violations & Anomaly Breakdown</span>
          </h3>

          <div className="grid grid-cols-3 gap-3 pt-2 text-center">
            <div className="bg-rose-950/40 border border-rose-900/60 rounded-lg p-3">
              <div className="text-[10px] text-rose-400 uppercase font-bold">Critical</div>
              <div className="text-2xl font-mono font-bold text-rose-400 mt-1">{criticalIssues}</div>
              <div className="text-[10px] text-slate-400 mt-1">Requires Immediate Fix</div>
            </div>

            <div className="bg-amber-950/40 border border-amber-900/60 rounded-lg p-3">
              <div className="text-[10px] text-amber-400 uppercase font-bold">Warnings</div>
              <div className="text-2xl font-mono font-bold text-amber-400 mt-1">{warningIssues}</div>
              <div className="text-[10px] text-slate-400 mt-1">Suspicious Overlaps / Dims</div>
            </div>

            <div className="bg-sky-950/40 border border-sky-900/60 rounded-lg p-3">
              <div className="text-[10px] text-sky-400 uppercase font-bold">Info</div>
              <div className="text-2xl font-mono font-bold text-sky-400 mt-1">{infoIssues}</div>
              <div className="text-[10px] text-slate-400 mt-1">Sparse Point Counts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Class Frequency Breakdown Histogram */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Layers size={15} className="text-cyan-400" />
          <span>Annotated Object Class Breakdown</span>
        </h3>

        <div className="grid grid-cols-5 gap-3">
          {Object.values(SEMANTIC_CLASSES).map(cls => {
            const count = classBreakdown[cls.name] || 0;
            return (
              <div
                key={cls.name}
                className="bg-slate-900/70 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: cls.color }}
                  />
                  <span className="text-xs text-slate-300 font-medium">{cls.label}</span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-100">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
