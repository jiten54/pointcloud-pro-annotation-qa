import React from 'react';
import { Point3D, PointCloudMetadata, SemanticClassName } from '../types/pointcloud';
import { SEMANTIC_CLASSES, ID_TO_CLASS_NAME } from '../constants/classes';
import {
  Palette,
  Layers,
  PieChart,
  Tag,
  CheckCircle2,
  Info,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface SegmentationPanelProps {
  points: Point3D[];
  metadata: PointCloudMetadata;
  onBatchAssignClass: (sourceClassId: number, targetClassName: SemanticClassName) => void;
}

export const SegmentationPanel: React.FC<SegmentationPanelProps> = ({
  points,
  metadata,
  onBatchAssignClass,
}) => {
  // Compute point counts per semantic class and unique instances
  const classCounts: Record<number, number> = {};
  const instanceSet = new Set<number>();

  for (const p of points) {
    const label = p.label ?? 0;
    classCounts[label] = (classCounts[label] || 0) + 1;
    if (p.instanceId && p.instanceId > 0) {
      instanceSet.add(p.instanceId);
    }
  }

  const totalPoints = Math.max(1, points.length);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-y-auto select-none p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Palette className="text-cyan-400" size={20} />
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Semantic & Instance Segmentation
            </h2>
            <p className="text-[11px] text-slate-400">
              Point-level categorization & label correspondence manager
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="bg-slate-800 px-2 py-1 rounded text-cyan-300">
            {points.length.toLocaleString()} Total Pts
          </span>
          <span className="bg-slate-800 px-2 py-1 rounded text-indigo-300">
            {instanceSet.size} Active Instances
          </span>
        </div>
      </div>

      {/* Semantic vs Instance Concept Card */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
            <Tag size={14} />
            <span>Semantic Class ID</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Assigns category ontology (e.g. Class 4 = Car, Class 7 = Pedestrian). Every LiDAR point shares the same semantic ID regardless of object instance.
          </p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
            <Layers size={14} />
            <span>Instance ID</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Differentiates distinct object entities (e.g. Car #1 vs Car #2). Grouped by 3D bounding box envelopes for downstream tracking.
          </p>
        </div>
      </div>

      {/* Point Distribution Visual Bar */}
      <div>
        <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
          <span>Point Cloud Class Composition</span>
          <span className="text-[11px] font-mono text-slate-500">100% Normalized</span>
        </div>

        <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex shadow-inner border border-slate-800">
          {Object.values(SEMANTIC_CLASSES).map(cls => {
            const count = classCounts[cls.id] || 0;
            const pct = (count / totalPoints) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={cls.name}
                style={{ width: `${pct}%`, backgroundColor: cls.color }}
                title={`${cls.label}: ${count.toLocaleString()} pts (${pct.toFixed(1)}%)`}
                className="h-full hover:brightness-125 transition-all"
              />
            );
          })}
        </div>
      </div>

      {/* Semantic Classes Distribution Table */}
      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="py-2 px-3">Class</th>
              <th className="py-2 px-3">ID</th>
              <th className="py-2 px-3 text-right">Points</th>
              <th className="py-2 px-3 text-right">Coverage</th>
              <th className="py-2 px-3 text-center">Batch Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {Object.values(SEMANTIC_CLASSES).map(cls => {
              const count = classCounts[cls.id] || 0;
              const pct = ((count / totalPoints) * 100).toFixed(1);

              return (
                <tr key={cls.name} className="hover:bg-slate-800/40 transition">
                  <td className="py-2 px-3 flex items-center gap-2 font-sans font-medium text-slate-200">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: cls.color }}
                    />
                    <span>{cls.label}</span>
                  </td>
                  <td className="py-2 px-3 text-slate-400 font-mono">{cls.id}</td>
                  <td className="py-2 px-3 text-right text-slate-300">
                    {count.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right text-cyan-400 font-bold">
                    {pct}%
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => onBatchAssignClass(cls.id, 'road')}
                      disabled={count === 0 || cls.name === 'road'}
                      className="text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none hover:underline"
                    >
                      Remap → Road
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Technical Limitations Documentation Notice */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 font-bold text-amber-400">
          <AlertCircle size={14} />
          <span>Viewer & Segmentation Interaction Scope</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          1. <strong>Spatial Discretization</strong>: Point-in-box containment utilizes an analytic 3D inverse yaw coordinate transformation with a calibrated 5cm edge margin.
          <br />
          2. <strong>Browser WebGL Point Bounds</strong>: Native browser WebGL limits single-pass rendering to ~1.5 million vertex records smoothly. Larger raw datasets are automatically subsampled or parsed in chunks.
          <br />
          3. <strong>Instance Clustering</strong>: Instances outside oriented bounding box boundaries retain instance ID 0 (unclustered background).
        </p>
      </div>
    </div>
  );
};
