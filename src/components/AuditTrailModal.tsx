import React from 'react';
import { AuditLogEntry } from '../types/pointcloud';
import { History, X, Clock, User, Activity } from 'lucide-react';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLog: AuditLogEntry[];
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  auditLog,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <History className="text-cyan-400" size={20} />
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Annotation & QA Audit Trail
              </h3>
              <p className="text-[11px] text-slate-400">
                Immutable chronological log of operator actions, status transitions, and QA events
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

        {/* Audit Log Timeline */}
        <div className="p-6 space-y-3 overflow-y-auto max-h-[65vh]">
          {auditLog.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No audit log entries recorded yet.
            </div>
          ) : (
            auditLog
              .slice()
              .reverse()
              .map((entry, idx) => (
                <div
                  key={entry.id || idx}
                  className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs flex items-start gap-3 hover:border-slate-700 transition"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-cyan-400">
                    <Activity size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-200">{entry.action}</span>
                      <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    {entry.details && (
                      <p className="text-[11px] text-slate-400 font-mono mb-1">
                        {entry.details}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-medium">
                      <User size={10} />
                      <span>{entry.operator}</span>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>{auditLog.length} events logged in current session</span>
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
