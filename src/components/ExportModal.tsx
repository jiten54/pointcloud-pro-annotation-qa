import React, { useState } from 'react';
import {
  AuditLogEntry,
  BoundingBox3D,
  PointCloudMetadata,
  QAIssue,
} from '../types/pointcloud';
import {
  generateCSVExport,
  generateJSONExport,
  generateQAMarkdownReport,
  validateAndParseImportedJSON,
} from '../utils/exporter';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: BoundingBox3D[];
  metadata: PointCloudMetadata;
  qaIssues: QAIssue[];
  auditLog: AuditLogEntry[];
  onImportVerifiedBoxes: (boxes: BoundingBox3D[]) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  boxes,
  metadata,
  qaIssues,
  auditLog,
  onImportVerifiedBoxes,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'reimport'>('export');
  const [copied, setCopied] = useState(false);
  const [reimportText, setReimportText] = useState('');
  const [validationResult, setValidationResult] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
    parsedBoxes?: BoundingBox3D[];
  }>({ status: 'idle', message: '' });

  if (!isOpen) return null;

  const jsonExport = generateJSONExport(boxes, metadata, qaIssues, auditLog);
  const csvExport = generateCSVExport(boxes);
  const qaMarkdown = generateQAMarkdownReport(boxes, metadata, qaIssues);

  const handleDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(jsonExport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleValidateReimport = () => {
    if (!reimportText.trim()) {
      setValidationResult({
        status: 'error',
        message: 'Please paste a JSON payload to validate.',
      });
      return;
    }

    const res = validateAndParseImportedJSON(reimportText);
    if (res.success && res.boxes) {
      setValidationResult({
        status: 'success',
        message: `Schema Verification Passed! Successfully extracted ${res.boxes.length} valid 3D bounding boxes.`,
        parsedBoxes: res.boxes,
      });
    } else {
      setValidationResult({
        status: 'error',
        message: res.error || 'Schema validation failed.',
      });
    }
  };

  const handleApplyReimport = () => {
    if (validationResult.parsedBoxes) {
      onImportVerifiedBoxes(validationResult.parsedBoxes);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Download className="text-cyan-400" size={20} />
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Dataset Export & Schema Verification
              </h3>
              <p className="text-[11px] text-slate-400">
                Export validated annotations or verify external dataset schema compliance
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
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'export'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Export Annotations & QA Report
          </button>
          <button
            onClick={() => {
              setActiveTab('reimport');
              if (!reimportText) setReimportText(jsonExport);
            }}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'reimport'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Re-Import & Schema Validator
          </button>
        </div>

        {/* Tab 1: Export */}
        {activeTab === 'export' && (
          <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
            <div className="grid grid-cols-3 gap-3">
              {/* Option 1: JSON */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-cyan-400 mb-2">
                    <FileJson size={22} />
                    <span className="font-bold text-xs">JSON Package</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-4 leading-normal">
                    Complete schema with 3D boxes, scene metadata, QA findings, and audit log.
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleDownload(
                      jsonExport,
                      `${metadata.fileName.replace(/\.[^/.]+$/, '')}_annotations.json`,
                      'application/json'
                    )
                  }
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                >
                  <Download size={13} />
                  <span>Download JSON</span>
                </button>
              </div>

              {/* Option 2: CSV */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <FileSpreadsheet size={22} />
                    <span className="font-bold text-xs">CSV Table</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-4 leading-normal">
                    Tabular 3D bounding boxes with coordinates, dimensions, yaw, and review notes.
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleDownload(
                      csvExport,
                      `${metadata.fileName.replace(/\.[^/.]+$/, '')}_boxes.csv`,
                      'text/csv'
                    )
                  }
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                >
                  <Download size={13} />
                  <span>Download CSV</span>
                </button>
              </div>

              {/* Option 3: QA Markdown Report */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <FileText size={22} />
                    <span className="font-bold text-xs">QA Audit Report</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-4 leading-normal">
                    Formatted Markdown audit report detailing issue severity, rule IDs, and actions.
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleDownload(
                      qaMarkdown,
                      `${metadata.fileName.replace(/\.[^/.]+$/, '')}_qa_report.md`,
                      'text/markdown'
                    )
                  }
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white rounded-lg py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                >
                  <Download size={13} />
                  <span>Download Report</span>
                </button>
              </div>
            </div>

            {/* Live JSON Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Export JSON Preview
                </span>
                <button
                  onClick={handleCopyJSON}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-48">
                {jsonExport}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 2: Re-Import Validator */}
        {activeTab === 'reimport' && (
          <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
            <p className="text-xs text-slate-400">
              Paste exported JSON payload below to test roundtrip schema consistency, coordinate validation, and dimension invariants.
            </p>

            <textarea
              rows={8}
              value={reimportText}
              onChange={e => setReimportText(e.target.value)}
              placeholder="Paste JSON content here..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={handleValidateReimport}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-medium flex items-center gap-1.5 transition"
              >
                <RefreshCw size={13} />
                <span>Verify Schema Invariants</span>
              </button>
            </div>

            {validationResult.status === 'success' && (
              <div className="bg-emerald-950/60 border border-emerald-800 rounded-lg p-3 text-xs text-emerald-200 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Validation Succeeded</strong>
                    <span>{validationResult.message}</span>
                  </div>
                </div>
                <button
                  onClick={handleApplyReimport}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded transition shrink-0"
                >
                  Load into Studio
                </button>
              </div>
            )}

            {validationResult.status === 'error' && (
              <div className="bg-rose-950/60 border border-rose-800 rounded-lg p-3 text-xs text-rose-200 flex items-start gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Schema Invalidation Error</strong>
                  <span>{validationResult.message}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Format complies with PointCloud Pro Perception Schema v1.0.0</span>
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
