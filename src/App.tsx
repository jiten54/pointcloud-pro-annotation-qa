import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AuditLogEntry,
  BoundingBox3D,
  CameraPreset,
  ColorMode,
  PointCloudData,
  SemanticClassName,
} from './types/pointcloud';
import { generateSyntheticScene } from './utils/syntheticData';
import { isPointInsideBox, runQAChecks } from './utils/qaEngine';
import { SEMANTIC_CLASSES } from './constants/classes';
import { PointCloudCanvas } from './components/PointCloudCanvas';
import { AnnotationSidebar } from './components/AnnotationSidebar';
import { QAPanel } from './components/QAPanel';
import { SegmentationPanel } from './components/SegmentationPanel';
import { DashboardView } from './components/DashboardView';
import { SceneLoaderModal } from './components/SceneLoaderModal';
import { ExportModal } from './components/ExportModal';
import { AuditTrailModal } from './components/AuditTrailModal';
import { PythonSuiteModal } from './components/PythonSuiteModal';
import {
  Layers,
  ShieldAlert,
  Palette,
  LayoutDashboard,
  UploadCloud,
  Download,
  History,
  Terminal,
  Eye,
  Crosshair,
  Sliders,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Box,
} from 'lucide-react';

export default function App() {
  // Initialize with realistic benchmark scene
  const initialData = useMemo(() => generateSyntheticScene('urban_intersection', 5000), []);

  const [pcd, setPcd] = useState<PointCloudData>(initialData.pcd);
  const [boxes, setBoxes] = useState<BoundingBox3D[]>(initialData.boxes);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(
    initialData.boxes.length > 0 ? initialData.boxes[0].id : null
  );

  // Visualization settings
  const [colorMode, setColorMode] = useState<ColorMode>('semantic');
  const [pointSize, setPointSize] = useState<number>(3);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('perspective');

  // Active top-level workspace view
  const [activeView, setActiveView] = useState<'studio' | 'qa' | 'segmentation' | 'dashboard'>('studio');

  // Modals state
  const [isSceneLoaderOpen, setIsSceneLoaderOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState<boolean>(false);
  const [isPythonSuiteOpen, setIsPythonSuiteOpen] = useState<boolean>(false);

  // Scene count tracking
  const [sceneCount, setSceneCount] = useState<number>(1);

  // Audit trail log
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toISOString(),
      operator: 'Lead-Annotator',
      action: 'Initialized PointCloud Pro Studio with Urban Intersection benchmark scene',
      details: 'Loaded 5,000 LiDAR points and 6 ground truth 3D oriented bounding boxes.',
    },
  ]);

  // Log an action to audit trail
  const addAuditEntry = useCallback((action: string, details?: string) => {
    setAuditLog(prev => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        operator: 'Annotator-1',
        action,
        details,
      },
    ]);
  }, []);

  // Compute QA issues whenever boxes or point cloud change
  const qaIssues = useMemo(() => {
    return runQAChecks(boxes, pcd.points);
  }, [boxes, pcd.points]);

  const criticalIssuesCount = useMemo(() => {
    return qaIssues.filter(i => i.severity === 'CRITICAL').length;
  }, [qaIssues]);

  const warningIssuesCount = useMemo(() => {
    return qaIssues.filter(i => i.severity === 'WARNING').length;
  }, [qaIssues]);

  // Box manipulation handlers
  const handleAddBox = useCallback(
    (className: SemanticClassName) => {
      const classDef = SEMANTIC_CLASSES[className] || SEMANTIC_CLASSES.other;
      const dims = classDef.defaultDimensions;
      const nextIndex = boxes.length + 1;
      const newId = `box-${className}-${nextIndex < 10 ? '0' + nextIndex : nextIndex}`;

      // Place box in unobstructed viewing location near center
      const newBox: BoundingBox3D = {
        id: newId,
        className,
        center: [0.0, 0.0, dims[2] / 2.0],
        dimensions: [...dims],
        rotation: [0.0, 0.0, 0.0],
        reviewStatus: 'Pending',
        reviewNote: '',
        pointCount: 0,
        confidence: 1.0,
      };

      setBoxes(prev => [...prev, newBox]);
      setSelectedBoxId(newId);
      addAuditEntry(`Created 3D bounding box "${newId}"`, `Class: ${classDef.label}`);
    },
    [boxes.length, addAuditEntry]
  );

  const handleUpdateBox = useCallback(
    (updated: BoundingBox3D) => {
      setBoxes(prev => prev.map(b => (b.id === updated.id ? updated : b)));
      addAuditEntry(`Updated bounding box "${updated.id}"`, `Status: ${updated.reviewStatus}`);
    },
    [addAuditEntry]
  );

  const handleDeleteBox = useCallback(
    (id: string) => {
      setBoxes(prev => {
        const next = prev.filter(b => b.id !== id);
        if (selectedBoxId === id) {
          setSelectedBoxId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
      addAuditEntry(`Deleted bounding box "${id}"`);
    },
    [selectedBoxId, addAuditEntry]
  );

  const handleDuplicateBox = useCallback(
    (id: string) => {
      const source = boxes.find(b => b.id === id);
      if (!source) return;

      const dupId = `${source.id}-copy`;
      const duplicated: BoundingBox3D = {
        ...source,
        id: dupId,
        center: [source.center[0] + 1.5, source.center[1] + 1.5, source.center[2]],
        reviewStatus: 'Pending',
        reviewNote: 'Duplicated instance',
      };

      setBoxes(prev => [...prev, duplicated]);
      setSelectedBoxId(dupId);
      addAuditEntry(`Duplicated bounding box "${id}" as "${dupId}"`);
    },
    [boxes, addAuditEntry]
  );

  // Point-in-box semantic segmentation
  const handleSegmentPointsInBox = useCallback(
    (box: BoundingBox3D) => {
      const classDef = SEMANTIC_CLASSES[box.className];
      if (!classDef) return;

      let modifiedCount = 0;
      const updatedPoints = pcd.points.map(pt => {
        if (isPointInsideBox(pt, box)) {
          modifiedCount++;
          return {
            ...pt,
            label: classDef.id,
            instanceId: box.instanceId || 1,
          };
        }
        return pt;
      });

      setPcd(prev => ({
        ...prev,
        points: updatedPoints,
      }));

      // Update box point count
      handleUpdateBox({
        ...box,
        pointCount: modifiedCount,
      });

      addAuditEntry(
        `Segmented points inside box "${box.id}"`,
        `Assigned ${modifiedCount} points to ${classDef.label}`
      );
    },
    [pcd.points, handleUpdateBox, addAuditEntry]
  );

  // Batch assign classes
  const handleBatchAssignClass = useCallback(
    (sourceClassId: number, targetClassName: SemanticClassName) => {
      const targetDef = SEMANTIC_CLASSES[targetClassName];
      if (!targetDef) return;

      let count = 0;
      const updatedPoints = pcd.points.map(pt => {
        if (pt.label === sourceClassId) {
          count++;
          return { ...pt, label: targetDef.id };
        }
        return pt;
      });

      setPcd(prev => ({
        ...prev,
        points: updatedPoints,
      }));

      addAuditEntry(
        `Batch remapped class ID ${sourceClassId} to ${targetDef.label}`,
        `Updated ${count.toLocaleString()} point records.`
      );
    },
    [pcd.points, addAuditEntry]
  );

  // Load new scene
  const handleLoadScene = useCallback(
    (newPcd: PointCloudData, newBoxes: BoundingBox3D[], sceneName: string) => {
      setPcd(newPcd);
      setBoxes(newBoxes);
      setSelectedBoxId(newBoxes.length > 0 ? newBoxes[0].id : null);
      setSceneCount(c => c + 1);
      addAuditEntry(
        `Loaded point cloud scene "${sceneName}"`,
        `${newPcd.points.length.toLocaleString()} points, ${newBoxes.length} annotations.`
      );
    },
    [addAuditEntry]
  );

  // QA Bulk actions
  const handleBulkApproveClean = useCallback(() => {
    // Collect IDs of boxes involved in critical or warning issues
    const problematicIds = new Set<string>();
    qaIssues.forEach(i => {
      if (i.severity === 'CRITICAL' || i.severity === 'WARNING') {
        if (i.annotationId) {
          i.annotationId.split('&').forEach(part => problematicIds.add(part.trim()));
        }
      }
    });

    let approvedCount = 0;
    setBoxes(prev =>
      prev.map(b => {
        if (!problematicIds.has(b.id) && b.reviewStatus !== 'Approved') {
          approvedCount++;
          return { ...b, reviewStatus: 'Approved', reviewNote: 'Automated clean QA approval' };
        }
        return b;
      })
    );

    addAuditEntry(
      `Bulk approved ${approvedCount} clean annotations`,
      `Zero critical or warning rule violations detected.`
    );
  }, [qaIssues, addAuditEntry]);

  const handleBulkFlagCorrection = useCallback(() => {
    const flaggedIds = new Set<string>();
    qaIssues.forEach(i => {
      if (i.annotationId) {
        i.annotationId.split('&').forEach(part => flaggedIds.add(part.trim()));
      }
    });

    let flaggedCount = 0;
    setBoxes(prev =>
      prev.map(b => {
        if (flaggedIds.has(b.id) && b.reviewStatus !== 'Needs Correction') {
          flaggedCount++;
          return { ...b, reviewStatus: 'Needs Correction', reviewNote: 'Flagged by QA audit' };
        }
        return b;
      })
    );

    addAuditEntry(`Flagged ${flaggedCount} bounding boxes for human correction`);
  }, [qaIssues, addAuditEntry]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Top Application Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-30">
        {/* Brand & Scene Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Box className="text-white" size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>PointCloud Pro</span>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                  LiDAR Studio
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">
                3D Annotation & Quality Assurance Workstation
              </p>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-800 mx-1" />

          {/* Active Scene Trigger */}
          <button
            onClick={() => setIsSceneLoaderOpen(true)}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-200 transition"
          >
            <UploadCloud size={13} className="text-cyan-400" />
            <span className="font-mono text-xs">{pcd.metadata.fileName}</span>
            <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 rounded">
              Switch Scene
            </span>
          </button>
        </div>

        {/* View Mode Switcher Pills */}
        <nav className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveView('studio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeView === 'studio'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Eye size={14} />
            <span>3D Studio</span>
          </button>

          <button
            onClick={() => setActiveView('qa')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all relative ${
              activeView === 'qa'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ShieldAlert size={14} className={criticalIssuesCount > 0 ? 'text-rose-400' : ''} />
            <span>QA Inspector</span>
            {qaIssues.length > 0 && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  criticalIssuesCount > 0
                    ? 'bg-rose-500 text-white'
                    : 'bg-amber-500/80 text-black'
                }`}
              >
                {qaIssues.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView('segmentation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeView === 'segmentation'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Palette size={14} />
            <span>Segmentation</span>
          </button>

          <button
            onClick={() => setActiveView('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeView === 'dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <LayoutDashboard size={14} />
            <span>Dashboard</span>
          </button>
        </nav>

        {/* Global Action Modals */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsPythonSuiteOpen(true)}
            title="Inspect Python Core, Pytest suite (28 tests), and Docker setup"
            className="bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition shadow"
          >
            <Terminal size={13} className="text-emerald-400" />
            <span>Python Suite</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </button>

          <button
            onClick={() => setIsAuditTrailOpen(true)}
            title="View chronological operator & QA audit log"
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <History size={13} />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => setIsExportOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition shadow"
          >
            <Download size={13} />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* View 1: 3D Studio (Left Annotation Sidebar + Center Canvas) */}
        {activeView === 'studio' && (
          <div className="flex-1 flex w-full h-full overflow-hidden">
            <AnnotationSidebar
              boxes={boxes}
              selectedBoxId={selectedBoxId}
              onSelectBox={setSelectedBoxId}
              onAddBox={handleAddBox}
              onUpdateBox={handleUpdateBox}
              onDeleteBox={handleDeleteBox}
              onDuplicateBox={handleDuplicateBox}
              onSegmentPointsInBox={handleSegmentPointsInBox}
            />

            <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
              {/* Studio Canvas Sub-Toolbar */}
              <div className="h-10 border-b border-slate-800/80 bg-slate-900/60 px-4 flex items-center justify-between text-xs text-slate-300 shrink-0">
                {/* Left: Shading Mode */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">Shading:</span>
                  {(['semantic', 'elevation', 'intensity', 'instance'] as ColorMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setColorMode(mode)}
                      className={`px-2 py-0.5 rounded text-xs capitalize transition ${
                        colorMode === mode
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {mode === 'elevation' ? 'Z-Height' : mode}
                    </button>
                  ))}
                </div>

                {/* Right: Point size, axes, grid */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500">Size:</span>
                    <input
                      type="range"
                      min={1}
                      max={7}
                      value={pointSize}
                      onChange={e => setPointSize(Number(e.target.value))}
                      className="w-16 accent-cyan-500 cursor-pointer"
                    />
                    <span className="font-mono text-cyan-300 w-3">{pointSize}</span>
                  </div>

                  <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-400 hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={showAxes}
                      onChange={e => setShowAxes(e.target.checked)}
                      className="accent-cyan-500"
                    />
                    <span>XYZ Triad</span>
                  </label>

                  <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-400 hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={e => setShowGrid(e.target.checked)}
                      className="accent-cyan-500"
                    />
                    <span>Ground Grid</span>
                  </label>
                </div>
              </div>

              {/* Three.js Interactive 3D Canvas */}
              <div className="flex-1 w-full h-full relative overflow-hidden">
                <PointCloudCanvas
                  points={pcd.points}
                  metadata={pcd.metadata}
                  boxes={boxes}
                  selectedBoxId={selectedBoxId}
                  onSelectBox={setSelectedBoxId}
                  colorMode={colorMode}
                  pointSize={pointSize}
                  showAxes={showAxes}
                  showGrid={showGrid}
                  activePreset={cameraPreset}
                  onPresetChange={setCameraPreset}
                />
              </div>
            </div>
          </div>
        )}

        {/* View 2: QA Inspector Panel */}
        {activeView === 'qa' && (
          <div className="flex-1 w-full h-full overflow-hidden">
            <QAPanel
              issues={qaIssues}
              boxes={boxes}
              selectedBoxId={selectedBoxId}
              onSelectBox={id => {
                setSelectedBoxId(id);
                setActiveView('studio');
              }}
              onUpdateBox={handleUpdateBox}
              onRecheckQA={() => {
                addAuditEntry('Manually re-evaluated Quality Assurance rules');
              }}
              onBulkApproveClean={handleBulkApproveClean}
              onBulkFlagCorrection={handleBulkFlagCorrection}
            />
          </div>
        )}

        {/* View 3: Semantic Segmentation Panel */}
        {activeView === 'segmentation' && (
          <div className="flex-1 w-full h-full overflow-hidden">
            <SegmentationPanel
              points={pcd.points}
              metadata={pcd.metadata}
              onBatchAssignClass={handleBatchAssignClass}
            />
          </div>
        )}

        {/* View 4: Analytics Dashboard View */}
        {activeView === 'dashboard' && (
          <div className="flex-1 w-full h-full overflow-hidden">
            <DashboardView
              metadata={pcd.metadata}
              points={pcd.points}
              boxes={boxes}
              qaIssues={qaIssues}
              scenesCount={sceneCount}
            />
          </div>
        )}
      </main>

      {/* Bottom Status Bar */}
      <footer className="h-7 border-t border-slate-800 bg-slate-950 px-4 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>WebGL Hardware Render Ready</span>
          </span>
          <span className="text-slate-600">|</span>
          <span>Point Count: <strong className="text-cyan-300">{pcd.points.length.toLocaleString()}</strong></span>
          <span className="text-slate-600">|</span>
          <span>3D Objects: <strong className="text-indigo-300">{boxes.length}</strong></span>
        </div>

        <div className="flex items-center gap-4">
          <span>
            QA Status:{' '}
            <strong className={qaIssues.length === 0 ? 'text-emerald-400' : 'text-amber-400'}>
              {qaIssues.length === 0 ? '0 Anomaly Violations' : `${qaIssues.length} Anomaly Flags`}
            </strong>
          </span>
          <span className="text-slate-600">|</span>
          <span>
            Approved:{' '}
            <strong className="text-slate-200">
              {boxes.filter(b => b.reviewStatus === 'Approved').length} / {boxes.length}
            </strong>
          </span>
        </div>
      </footer>

      {/* Modals */}
      <SceneLoaderModal
        isOpen={isSceneLoaderOpen}
        onClose={() => setIsSceneLoaderOpen(false)}
        onLoadScene={handleLoadScene}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        boxes={boxes}
        metadata={pcd.metadata}
        qaIssues={qaIssues}
        auditLog={auditLog}
        onImportVerifiedBoxes={imported => {
          setBoxes(imported);
          setSelectedBoxId(imported.length > 0 ? imported[0].id : null);
          addAuditEntry(`Imported and verified ${imported.length} 3D annotations from external JSON payload`);
        }}
      />

      <AuditTrailModal
        isOpen={isAuditTrailOpen}
        onClose={() => setIsAuditTrailOpen(false)}
        auditLog={auditLog}
      />

      <PythonSuiteModal
        isOpen={isPythonSuiteOpen}
        onClose={() => setIsPythonSuiteOpen(false)}
      />
    </div>
  );
}
