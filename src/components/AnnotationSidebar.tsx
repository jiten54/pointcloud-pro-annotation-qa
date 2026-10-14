import React, { useState } from 'react';
import {
  BoundingBox3D,
  ReviewStatus,
  SemanticClassName,
} from '../types/pointcloud';
import { SEMANTIC_CLASSES } from '../constants/classes';
import {
  Plus,
  Trash2,
  Copy,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  RotateCcw,
  Compass,
  ArrowDownToLine,
  Sliders,
  Sparkles,
  Search,
} from 'lucide-react';

interface AnnotationSidebarProps {
  boxes: BoundingBox3D[];
  selectedBoxId: string | null;
  onSelectBox: (id: string | null) => void;
  onAddBox: (className: SemanticClassName) => void;
  onUpdateBox: (updated: BoundingBox3D) => void;
  onDeleteBox: (id: string) => void;
  onDuplicateBox: (id: string) => void;
  onSegmentPointsInBox: (box: BoundingBox3D) => void;
}

export const AnnotationSidebar: React.FC<AnnotationSidebarProps> = ({
  boxes,
  selectedBoxId,
  onSelectBox,
  onAddBox,
  onUpdateBox,
  onDeleteBox,
  onDuplicateBox,
  onSegmentPointsInBox,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [newBoxClass, setNewBoxClass] = useState<SemanticClassName>('car');

  const selectedBox = boxes.find(b => b.id === selectedBoxId);

  // Filter boxes
  const filteredBoxes = boxes.filter(b => {
    const matchesSearch = b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.className.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = filterClass === 'all' || b.className === filterClass;
    const matchesStatus = filterStatus === 'all' || b.reviewStatus === filterStatus;
    return matchesSearch && matchesClass && matchesStatus;
  });

  // Handlers for modifying selected box
  const handleUpdate = (partial: Partial<BoundingBox3D>) => {
    if (!selectedBox) return;
    onUpdateBox({ ...selectedBox, ...partial });
  };

  const handleCenterChange = (axis: 0 | 1 | 2, delta: number) => {
    if (!selectedBox) return;
    const nextCenter: [number, number, number] = [...selectedBox.center];
    nextCenter[axis] = Number((nextCenter[axis] + delta).toFixed(2));
    handleUpdate({ center: nextCenter });
  };

  const handleDimensionChange = (axis: 0 | 1 | 2, delta: number) => {
    if (!selectedBox) return;
    const nextDims: [number, number, number] = [...selectedBox.dimensions];
    const updated = Math.max(0.1, Number((nextDims[axis] + delta).toFixed(2)));
    nextDims[axis] = updated;
    handleUpdate({ dimensions: nextDims });
  };

  const handleYawStep = (degDelta: number) => {
    if (!selectedBox) return;
    const currentDeg = (selectedBox.rotation[0] * 180) / Math.PI;
    let nextDeg = currentDeg + degDelta;
    if (nextDeg > 180) nextDeg -= 360;
    if (nextDeg < -180) nextDeg += 360;
    handleUpdate({
      rotation: [(nextDeg * Math.PI) / 180, selectedBox.rotation[1], selectedBox.rotation[2]],
    });
  };

  const handleSnapToGround = () => {
    if (!selectedBox) return;
    const halfH = selectedBox.dimensions[2] / 2.0;
    handleUpdate({
      center: [selectedBox.center[0], selectedBox.center[1], halfH],
    });
  };

  const handleResetDimensions = () => {
    if (!selectedBox) return;
    const defaultDims = SEMANTIC_CLASSES[selectedBox.className]?.defaultDimensions || [2, 2, 2];
    handleUpdate({ dimensions: [...defaultDims] });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-200 w-80 shrink-0 select-none">
      {/* Top Header & Add Action */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="text-cyan-400" size={18} />
            <span className="font-semibold text-sm tracking-wide text-slate-100">
              3D Annotations
            </span>
          </div>
          <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300">
            {boxes.length} objects
          </span>
        </div>

        {/* Quick Add Bounding Box */}
        <div className="flex items-center gap-1.5 pt-1">
          <select
            value={newBoxClass}
            onChange={e => setNewBoxClass(e.target.value as SemanticClassName)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {Object.values(SEMANTIC_CLASSES).map(cls => (
              <option key={cls.name} value={cls.name}>
                {cls.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => onAddBox(newBoxClass)}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-md px-3 py-1.5 text-xs font-medium flex items-center gap-1 shadow transition-all shrink-0"
          >
            <Plus size={14} />
            <span>Add Box</span>
          </button>
        </div>

        {/* Search & Filter */}
        <div className="relative pt-1">
          <Search size={14} className="absolute left-2.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ID or class..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-md pl-8 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700"
          />
        </div>
      </div>

      {/* Scrollable Annotations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-slate-800/40">
        {filteredBoxes.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No bounding boxes match filters.
          </div>
        ) : (
          filteredBoxes.map(b => {
            const isSelected = b.id === selectedBoxId;
            const classDef = SEMANTIC_CLASSES[b.className] || SEMANTIC_CLASSES.other;

            return (
              <div
                key={b.id}
                onClick={() => onSelectBox(b.id)}
                className={`p-2.5 rounded-lg cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-blue-950/40 border-cyan-500/80 shadow-md ring-1 ring-cyan-500/40'
                    : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: classDef.color }}
                    />
                    <span className="font-mono text-xs font-semibold text-slate-200">
                      {b.id}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${
                      b.reviewStatus === 'Approved'
                        ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/60'
                        : b.reviewStatus === 'Needs Correction'
                        ? 'bg-rose-950/70 text-rose-400 border border-rose-800/60'
                        : 'bg-amber-950/70 text-amber-400 border border-amber-800/60'
                    }`}
                  >
                    {b.reviewStatus === 'Approved' ? (
                      <CheckCircle2 size={11} />
                    ) : b.reviewStatus === 'Needs Correction' ? (
                      <AlertTriangle size={11} />
                    ) : (
                      <Clock size={11} />
                    )}
                    {b.reviewStatus}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>{classDef.label}</span>
                  <span className={b.pointCount === 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                    {b.pointCount} pts
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Box Fine-Tuning Drawer */}
      {selectedBox && (
        <div className="border-t border-slate-800 bg-slate-950/90 p-3 space-y-3 overflow-y-auto max-h-[46%]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300 font-mono flex items-center gap-1.5">
              <Sliders size={14} />
              {selectedBox.id}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDuplicateBox(selectedBox.id)}
                title="Duplicate Box"
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
              >
                <Copy size={13} />
              </button>
              <button
                onClick={() => onDeleteBox(selectedBox.id)}
                title="Delete Box"
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded transition"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Class & Review Status */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 font-medium">Class</label>
              <select
                value={selectedBox.className}
                onChange={e => handleUpdate({ className: e.target.value as SemanticClassName })}
                className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200 text-xs"
              >
                {Object.values(SEMANTIC_CLASSES).map(cls => (
                  <option key={cls.name} value={cls.name}>
                    {cls.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-medium">Review Status</label>
              <select
                value={selectedBox.reviewStatus}
                onChange={e => handleUpdate({ reviewStatus: e.target.value as ReviewStatus })}
                className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200 text-xs"
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Needs Correction">Needs Correction</option>
              </select>
            </div>
          </div>

          {/* Center Coordinates Controls */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Center [X, Y, Z] (m)
            </div>
            <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
              {(['X', 'Y', 'Z'] as const).map((axisName, idx) => (
                <div key={axisName} className="bg-slate-900 border border-slate-800 rounded p-1 text-center">
                  <div className="text-[10px] text-slate-500 font-bold">{axisName}</div>
                  <div className="text-slate-200 py-0.5">{selectedBox.center[idx].toFixed(2)}</div>
                  <div className="flex justify-center gap-1 mt-0.5">
                    <button
                      onClick={() => handleCenterChange(idx as 0 | 1 | 2, -0.2)}
                      className="px-1 text-[11px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                    >
                      -
                    </button>
                    <button
                      onClick={() => handleCenterChange(idx as 0 | 1 | 2, 0.2)}
                      className="px-1 text-[11px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dimensions Controls */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <span>Dimensions [L, W, H] (m)</span>
              <button
                onClick={handleResetDimensions}
                title="Reset to standard class dimensions"
                className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
              >
                Reset
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
              {[
                { name: 'Length (dx)', val: selectedBox.dimensions[0], idx: 0 },
                { name: 'Width (dy)', val: selectedBox.dimensions[1], idx: 1 },
                { name: 'Height (dz)', val: selectedBox.dimensions[2], idx: 2 },
              ].map(d => (
                <div key={d.name} className="bg-slate-900 border border-slate-800 rounded p-1 text-center">
                  <div className="text-[10px] text-slate-500 font-bold">{d.name.split(' ')[0]}</div>
                  <div className="text-slate-200 py-0.5">{d.val.toFixed(2)}</div>
                  <div className="flex justify-center gap-1 mt-0.5">
                    <button
                      onClick={() => handleDimensionChange(d.idx as 0 | 1 | 2, -0.1)}
                      className="px-1 text-[11px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                    >
                      -
                    </button>
                    <button
                      onClick={() => handleDimensionChange(d.idx as 0 | 1 | 2, 0.1)}
                      className="px-1 text-[11px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rotation / Yaw Controls */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <span>Yaw Heading</span>
              <span className="font-mono text-cyan-300 text-xs">
                {((selectedBox.rotation[0] * 180) / Math.PI).toFixed(1)}°
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleYawStep(-45)}
                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] text-slate-300 flex items-center gap-0.5"
              >
                <RotateCcw size={11} /> -45°
              </button>
              <button
                onClick={() => handleYawStep(-5)}
                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] text-slate-300"
              >
                -5°
              </button>
              <button
                onClick={() => handleYawStep(5)}
                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] text-slate-300"
              >
                +5°
              </button>
              <button
                onClick={() => handleYawStep(45)}
                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] text-slate-300 flex items-center gap-0.5"
              >
                +45° <RotateCw size={11} />
              </button>
            </div>
          </div>

          {/* Quick Actions: Snap to Ground & Segment Inside Box */}
          <div className="pt-1 flex flex-col gap-1.5">
            <button
              onClick={handleSnapToGround}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded py-1.5 text-xs text-slate-200 font-medium flex items-center justify-center gap-1.5 transition"
            >
              <ArrowDownToLine size={13} className="text-amber-400" />
              <span>Snap Bottom to Ground (Z=0)</span>
            </button>

            <button
              onClick={() => onSegmentPointsInBox(selectedBox)}
              className="w-full bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/60 rounded py-1.5 text-xs text-indigo-200 font-medium flex items-center justify-center gap-1.5 transition shadow"
            >
              <Sparkles size={13} className="text-indigo-400" />
              <span>Segment Contained Points ({selectedBox.pointCount})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
