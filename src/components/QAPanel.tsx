import React, { useState } from 'react';
import { BoundingBox3D, QAIssue, QASeverity } from '../types/pointcloud';
import {
  ShieldAlert,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  Crosshair,
  ArrowRight,
  Filter,
  CheckCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { SEMANTIC_CLASSES } from '../constants/classes';

interface QAPanelProps {
  issues: QAIssue[];
  boxes: BoundingBox3D[];
  selectedBoxId: string | null;
  onSelectBox: (id: string) => void;
  onUpdateBox: (updated: BoundingBox3D) => void;
  onRecheckQA: () => void;
  onBulkApproveClean: () => void;
  onBulkFlagCorrection: () => void;
}

export const QAPanel: React.FC<QAPanelProps> = ({
  issues,
  boxes,
  selectedBoxId,
  onSelectBox,
  onUpdateBox,
  onRecheckQA,
  onBulkApproveClean,
  onBulkFlagCorrection,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | QASeverity>('ALL');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('ALL');

  const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
  const warningCount = issues.filter(i => i.severity === 'WARNING').length;
  const infoCount = issues.filter(i => i.severity === 'INFO').length;

  const filteredIssues = issues.filter(issue => {
    const matchesSeverity = severityFilter === 'ALL' || issue.severity === severityFilter;
    const matchesRule = selectedRuleId === 'ALL' || issue.ruleId === selectedRuleId;
    return matchesSeverity && matchesRule;
  });

  const ruleIds = Array.from(new Set(issues.map(i => i.ruleId)));

  // Auto-Fix / Quick-Fix helper
  const handleAutoFix = (issue: QAIssue) => {
    if (!issue.annotationId) return;
    const box = boxes.find(b => b.id === issue.annotationId);
    if (!box) return;

    if (issue.ruleId === 'RULE-QA-005') {
      // Snap to ground
      const halfH = box.dimensions[2] / 2.0;
      onUpdateBox({
        ...box,
        center: [box.center[0], box.center[1], halfH],
        reviewNote: 'Auto-aligned base with ground plane (z=0m)',
      });
    } else if (issue.ruleId === 'RULE-QA-006' || issue.ruleId === 'RULE-QA-007') {
      // Reset to class default dimensions
      const defDims = SEMANTIC_CLASSES[box.className]?.defaultDimensions || [2, 2, 2];
      onUpdateBox({
        ...box,
        dimensions: [...defDims],
        reviewNote: 'Re-centered to nominal vehicle envelope',
      });
    } else {
      // Flag for correction with explanation
      onUpdateBox({
        ...box,
        reviewStatus: 'Needs Correction',
        reviewNote: `QA Flag: ${issue.message}`,
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-hidden select-none">
      {/* Top Banner & Summary Cards */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-cyan-400" size={20} />
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Automated Quality Assurance Engine
              </h2>
              <p className="text-[11px] text-slate-400">
                Rule-based perception audit & human review dispatch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRecheckQA}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md px-2.5 py-1 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <RefreshCw size={12} />
              <span>Re-Scan Scene</span>
            </button>
            <button
              onClick={onBulkApproveClean}
              className="bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-700/60 text-emerald-300 rounded-md px-2.5 py-1 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <CheckCheck size={13} />
              <span>Approve All Clean</span>
            </button>
          </div>
        </div>

        {/* Severity Metrics Bar */}
        <div className="grid grid-cols-4 gap-2">
          <div
            onClick={() => setSeverityFilter('ALL')}
            className={`p-2.5 rounded-lg border cursor-pointer transition ${
              severityFilter === 'ALL'
                ? 'bg-slate-800 border-cyan-500 shadow-md ring-1 ring-cyan-500/40'
                : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'
            }`}
          >
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Issues</div>
            <div className="text-xl font-mono font-bold text-slate-100">{issues.length}</div>
          </div>

          <div
            onClick={() => setSeverityFilter('CRITICAL')}
            className={`p-2.5 rounded-lg border cursor-pointer transition ${
              severityFilter === 'CRITICAL'
                ? 'bg-rose-950/60 border-rose-500 shadow-md ring-1 ring-rose-500/40'
                : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'
            }`}
          >
            <div className="text-[10px] text-rose-400 uppercase font-semibold flex items-center gap-1">
              <AlertOctagon size={11} /> Critical
            </div>
            <div className="text-xl font-mono font-bold text-rose-400">{criticalCount}</div>
          </div>

          <div
            onClick={() => setSeverityFilter('WARNING')}
            className={`p-2.5 rounded-lg border cursor-pointer transition ${
              severityFilter === 'WARNING'
                ? 'bg-amber-950/60 border-amber-500 shadow-md ring-1 ring-amber-500/40'
                : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'
            }`}
          >
            <div className="text-[10px] text-amber-400 uppercase font-semibold flex items-center gap-1">
              <AlertTriangle size={11} /> Warnings
            </div>
            <div className="text-xl font-mono font-bold text-amber-400">{warningCount}</div>
          </div>

          <div
            onClick={() => setSeverityFilter('INFO')}
            className={`p-2.5 rounded-lg border cursor-pointer transition ${
              severityFilter === 'INFO'
                ? 'bg-sky-950/60 border-sky-500 shadow-md ring-1 ring-sky-500/40'
                : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'
            }`}
          >
            <div className="text-[10px] text-sky-400 uppercase font-semibold flex items-center gap-1">
              <Info size={11} /> Info
            </div>
            <div className="text-xl font-mono font-bold text-sky-400">{infoCount}</div>
          </div>
        </div>

        {/* Disclaimer Callout */}
        <div className="text-[11px] text-slate-400 bg-slate-900/90 border border-slate-800 rounded-md p-2 flex items-start gap-2">
          <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
          <span>
            <strong>Perception QA Protocol:</strong> Automated checks are heuristic validation guards designed to spotlight suspicious box fits, collisions, or missing points for expert annotator verification. They do not unilaterally prove ground-truth inaccuracy without review sign-off.
          </span>
        </div>
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {filteredIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <CheckCircle2 size={40} className="text-emerald-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-200">
              No Issues in Selected Category
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              All quality assurance constraints for this filter are currently satisfied.
            </p>
          </div>
        ) : (
          filteredIssues.map((issue, idx) => {
            const isCritical = issue.severity === 'CRITICAL';
            const isWarning = issue.severity === 'WARNING';
            const isTargetSelected = issue.annotationId && issue.annotationId.includes(selectedBoxId || '');

            return (
              <div
                key={issue.id}
                className={`p-3.5 rounded-lg border transition-all ${
                  isTargetSelected
                    ? 'ring-2 ring-cyan-500 bg-slate-800/90 border-cyan-500'
                    : isCritical
                    ? 'bg-rose-950/20 border-rose-900/60 hover:border-rose-700'
                    : isWarning
                    ? 'bg-amber-950/20 border-amber-900/60 hover:border-amber-700'
                    : 'bg-sky-950/20 border-sky-900/60 hover:border-sky-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase ${
                        isCritical
                          ? 'bg-rose-900/80 text-rose-200'
                          : isWarning
                          ? 'bg-amber-900/80 text-amber-200'
                          : 'bg-sky-900/80 text-sky-200'
                      }`}
                    >
                      {issue.severity}
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-400">
                      {issue.ruleId}
                    </span>
                    {issue.annotationId && (
                      <span className="font-mono text-xs bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded">
                        {issue.annotationId}
                      </span>
                    )}
                  </div>

                  {issue.annotationId && (
                    <button
                      onClick={() => onSelectBox(issue.annotationId!)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 bg-slate-800/80 hover:bg-slate-800 px-2 py-1 rounded transition"
                    >
                      <Crosshair size={12} />
                      <span>Focus 3D</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-200 font-medium mb-1.5">
                  {issue.message}
                </p>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded p-2 text-[11px] text-slate-300 flex items-start gap-2">
                  <ArrowRight size={13} className="text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-400">Recommended Correction: </span>
                    <span>{issue.recommendedAction}</span>
                  </div>
                </div>

                {/* Inline Action Buttons */}
                {issue.annotationId && (
                  <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => handleAutoFix(issue)}
                      className="bg-blue-600/80 hover:bg-blue-600 text-white text-[11px] font-medium px-2.5 py-1 rounded flex items-center gap-1 transition"
                    >
                      <Sparkles size={11} />
                      <span>Apply Recommended Fix</span>
                    </button>

                    <button
                      onClick={() => {
                        const box = boxes.find(b => b.id === issue.annotationId);
                        if (box) {
                          onUpdateBox({
                            ...box,
                            reviewStatus: 'Needs Correction',
                            reviewNote: issue.message,
                          });
                        }
                      }}
                      className="bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[11px] font-medium px-2.5 py-1 rounded transition"
                    >
                      Mark Needs Correction
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
