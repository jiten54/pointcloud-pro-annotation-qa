import React, { useState } from 'react';
import { PointCloudData, BoundingBox3D } from '../types/pointcloud';
import { generateSyntheticScene, ScenePresetType } from '../utils/syntheticData';
import { parsePointCloudFile } from '../utils/fileParsers';
import {
  UploadCloud,
  FileCode,
  Sparkles,
  AlertOctagon,
  CheckCircle2,
  X,
  Compass,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface SceneLoaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadScene: (pcd: PointCloudData, boxes: BoundingBox3D[], sceneName: string) => void;
}

export const SceneLoaderModal: React.FC<SceneLoaderModalProps> = ({
  isOpen,
  onClose,
  onLoadScene,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<ScenePresetType>('urban_intersection');
  const [targetPoints, setTargetPoints] = useState<number>(6000);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleGeneratePreset = () => {
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const { pcd, boxes } = generateSyntheticScene(selectedPreset, targetPoints);
        const nameMap: Record<ScenePresetType, string> = {
          urban_intersection: 'Urban Intersection Benchmark',
          dense_highway: 'Highway Congestion LiDAR',
          suburban_crosswalk: 'Suburban Pedestrian Zone',
        };
        onLoadScene(pcd, boxes, nameMap[selectedPreset]);
        onClose();
      } catch (err: any) {
        setUploadError(err.message || 'Scene generation failed.');
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const content = event.target?.result as string;
        if (!content) {
          throw new Error('Uploaded file is empty.');
        }

        const pcd = parsePointCloudFile(content, file.name);
        onLoadScene(pcd, [], file.name);
        onClose();
      } catch (err: any) {
        setUploadError(err.message || 'Error parsing point cloud file.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setUploadError('Failed to read file from filesystem.');
      setIsProcessing(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <UploadCloud className="text-cyan-400" size={20} />
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Dataset Ingestion & Scene Loader
              </h3>
              <p className="text-[11px] text-slate-400">
                Load benchmark perception datasets or upload custom point cloud files
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

        {/* Body Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Error Banner */}
          {uploadError && (
            <div className="bg-rose-950/70 border border-rose-800 rounded-lg p-3 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertOctagon size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">File Ingestion Error</strong>
                <span>{uploadError}</span>
              </div>
            </div>
          )}

          {/* Section 1: Pre-Configured Benchmark Scenes */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-cyan-400" />
              <span>Synthetic Benchmark Scenes (Instant Loading)</span>
            </h4>

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  id: 'urban_intersection',
                  title: 'Urban Intersection',
                  subtitle: 'Cars, turning truck, pedestrian crosswalk & curbs',
                  objects: '6 3D Boxes',
                },
                {
                  id: 'dense_highway',
                  title: 'Dense Highway',
                  subtitle: 'Multi-lane traffic, bus, motorcycle, high speed',
                  objects: '6 3D Boxes',
                },
                {
                  id: 'suburban_crosswalk',
                  title: 'Suburban Pedestrians',
                  subtitle: 'Group of pedestrians, cyclist, roadside tree canopy',
                  objects: '5 3D Boxes',
                },
              ].map(preset => (
                <div
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id as ScenePresetType)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedPreset === preset.id
                      ? 'bg-blue-950/50 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="font-semibold text-xs text-slate-200 mb-1">{preset.title}</div>
                  <p className="text-[10px] text-slate-400 leading-normal mb-2">
                    {preset.subtitle}
                  </p>
                  <span className="text-[10px] font-mono font-medium text-cyan-300 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                    {preset.objects}
                  </span>
                </div>
              ))}
            </div>

            {/* Density Slider */}
            <div className="mt-3 bg-slate-950/40 border border-slate-800/80 rounded-lg p-3">
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Target Point Cloud Density:</span>
                <span className="font-mono text-cyan-300 font-bold">{targetPoints.toLocaleString()} points</span>
              </div>
              <input
                type="range"
                min={2000}
                max={12000}
                step={500}
                value={targetPoints}
                onChange={e => setTargetPoints(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <button
              onClick={handleGeneratePreset}
              disabled={isProcessing}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
            >
              <Sparkles size={14} />
              <span>Load Selected Benchmark Scene</span>
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-[11px] text-slate-500 uppercase tracking-widest font-mono">
              or upload custom point cloud
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Section 2: Upload Custom Point Cloud */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileCode size={14} className="text-indigo-400" />
              <span>Upload Custom Point Cloud File (.pcd, .ply, .xyz)</span>
            </h4>

            <label className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-950/30 hover:bg-slate-900/40 transition group">
              <UploadCloud size={32} className="text-slate-500 group-hover:text-cyan-400 mb-2 transition" />
              <span className="text-xs font-semibold text-slate-300 group-hover:text-slate-100">
                Click to browse or drop point cloud file here
              </span>
              <span className="text-[11px] text-slate-500 mt-1 font-mono">
                Supports ASCII PCD (v0.7), ASCII PLY, and XYZ / PTS coordinate text
              </span>
              <input
                type="file"
                accept=".pcd,.ply,.xyz,.txt,.pts"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>All uploaded files are validated locally in-memory.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
