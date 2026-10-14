import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BoundingBox3D,
  CameraPreset,
  ColorMode,
  Point3D,
  PointCloudMetadata,
} from '../types/pointcloud';
import { SEMANTIC_CLASSES } from '../constants/classes';
import {
  Maximize2,
  Minimize2,
  Compass,
  Eye,
  Crosshair,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';

interface PointCloudCanvasProps {
  points: Point3D[];
  metadata: PointCloudMetadata;
  boxes: BoundingBox3D[];
  selectedBoxId: string | null;
  onSelectBox: (id: string | null) => void;
  colorMode: ColorMode;
  pointSize: number;
  showAxes: boolean;
  showGrid: boolean;
  activePreset: CameraPreset;
  onPresetChange: (preset: CameraPreset) => void;
}

// Convert Hex string to RGB floats 0..1
function hexToRgbFloats(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255.0;
  const g = parseInt(clean.substring(2, 4), 16) / 255.0;
  const b = parseInt(clean.substring(4, 6), 16) / 255.0;
  return [r, g, b];
}

// Turbo / Viridis elevation colormap approximation
function getElevationColor(z: number, minZ: number, maxZ: number): [number, number, number] {
  const span = Math.max(0.1, maxZ - minZ);
  const t = Math.max(0, Math.min(1, (z - minZ) / span));

  // Spectral / Turbo smooth palette
  const r = Math.sin(t * Math.PI * 1.5);
  const g = Math.sin((t * Math.PI) + 0.2);
  const b = Math.cos(t * Math.PI * 1.2);

  return [
    Math.max(0.1, Math.min(1.0, r * 0.8 + 0.2)),
    Math.max(0.1, Math.min(1.0, g * 0.85 + 0.15)),
    Math.max(0.1, Math.min(1.0, b * 0.85 + 0.15)),
  ];
}

// Instance color hash
function getInstanceColor(instanceId: number): [number, number, number] {
  if (instanceId <= 0) return [0.55, 0.60, 0.65];
  const hue = ((instanceId * 137.5) % 360) / 360;
  const color = new THREE.Color().setHSL(hue, 0.85, 0.55);
  return [color.r, color.g, color.b];
}

export const PointCloudCanvas: React.FC<PointCloudCanvasProps> = ({
  points,
  metadata,
  boxes,
  selectedBoxId,
  onSelectBox,
  colorMode,
  pointSize,
  showAxes,
  showGrid,
  activePreset,
  onPresetChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsMeshRef = useRef<THREE.Points | null>(null);
  const boxGroupRef = useRef<THREE.Group | null>(null);
  const axesRef = useRef<THREE.AxesHelper | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);

  const [webglError, setWebglError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);

  // Initialize Three.js WebGL Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 500;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0f1d);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(20, -25, 18);
      camera.up.set(0, 0, 1); // Z is Up for standard LiDAR autonomous vehicle coordinates
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      rendererRef.current = renderer;

      // Mount canvas
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxDistance = 300;
      controls.minDistance = 1;
      controls.target.set(0, 0, 1.0);
      controlsRef.current = controls;

      // Coordinate axes
      const axesHelper = new THREE.AxesHelper(5);
      axesHelper.visible = showAxes;
      scene.add(axesHelper);
      axesRef.current = axesHelper;

      // Ground plane grid
      const grid = new THREE.GridHelper(80, 80, 0x334155, 0x1e293b);
      grid.rotation.x = Math.PI / 2; // Lie on XY plane (Z=0)
      grid.position.z = -0.01;
      grid.visible = showGrid;
      scene.add(grid);
      gridRef.current = grid;

      // Group for bounding boxes
      const boxGroup = new THREE.Group();
      scene.add(boxGroup);
      boxGroupRef.current = boxGroup;

      let animationFrameId: number;
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        controls.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
    } catch (err: any) {
      console.error('WebGL Initialization Failed:', err);
      setWebglError(err.message || 'WebGL 3D Context could not be initialized.');
    }
  }, []);

  // Update Axes and Grid visibility
  useEffect(() => {
    if (axesRef.current) axesRef.current.visible = showAxes;
    if (gridRef.current) gridRef.current.visible = showGrid;
  }, [showAxes, showGrid]);

  // Update Point Cloud Geometry and Color Mode
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || points.length === 0) return;

    // Remove existing points mesh
    if (pointsMeshRef.current) {
      scene.remove(pointsMeshRef.current);
      pointsMeshRef.current.geometry.dispose();
      (pointsMeshRef.current.material as THREE.Material).dispose();
      pointsMeshRef.current = null;
    }

    const count = points.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const minZ = metadata.boundsMin[2];
    const maxZ = metadata.boundsMax[2];

    for (let i = 0; i < count; i++) {
      const pt = points[i];
      positions[i * 3 + 0] = pt.x;
      positions[i * 3 + 1] = pt.y;
      positions[i * 3 + 2] = pt.z;

      let r = 0.8, g = 0.8, b = 0.8;

      if (colorMode === 'semantic') {
        const classObj = Object.values(SEMANTIC_CLASSES).find(c => c.id === pt.label);
        if (classObj) {
          [r, g, b] = hexToRgbFloats(classObj.color);
        } else {
          [r, g, b] = [0.6, 0.65, 0.7];
        }
      } else if (colorMode === 'elevation') {
        [r, g, b] = getElevationColor(pt.z, minZ, maxZ);
      } else if (colorMode === 'intensity') {
        const val = Math.max(0.1, Math.min(1.0, pt.intensity ?? 0.5));
        r = val;
        g = val;
        b = val;
      } else if (colorMode === 'instance') {
        [r, g, b] = getInstanceColor(pt.instanceId || 0);
      }

      colors[i * 3 + 0] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.88,
    });

    const pointsMesh = new THREE.Points(geometry, material);
    scene.add(pointsMesh);
    pointsMeshRef.current = pointsMesh;
  }, [points, colorMode, pointSize, metadata]);

  // Update 3D Oriented Bounding Box Meshes
  useEffect(() => {
    const boxGroup = boxGroupRef.current;
    if (!boxGroup) return;

    // Clear previous boxes
    while (boxGroup.children.length > 0) {
      const child = boxGroup.children[0] as any;
      boxGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose());
        else child.material.dispose();
      }
    }

    boxes.forEach(box => {
      const isSelected = box.id === selectedBoxId;
      const isHovered = box.id === hoveredBoxId;
      const classDef = SEMANTIC_CLASSES[box.className] || SEMANTIC_CLASSES.other;
      const baseColor = new THREE.Color(classDef.color);

      const [dx, dy, dz] = box.dimensions;
      const [cx, cy, cz] = box.center;
      const [yaw, pitch, roll] = box.rotation;

      const objContainer = new THREE.Group();
      objContainer.position.set(cx, cy, cz);
      objContainer.rotation.set(roll, pitch, yaw, 'ZYX');
      objContainer.userData = { boxId: box.id };

      // 1. Solid / transparent inner volume
      const boxGeo = new THREE.BoxGeometry(dx, dy, dz);
      const boxMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0x38bdf8 : baseColor,
        transparent: true,
        opacity: isSelected ? 0.38 : (isHovered ? 0.25 : 0.12),
        depthWrite: false,
      });
      const solidMesh = new THREE.Mesh(boxGeo, boxMat);
      solidMesh.userData = { boxId: box.id };
      objContainer.add(solidMesh);

      // 2. Wireframe edges
      const edges = new THREE.EdgesGeometry(boxGeo);
      const edgeMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0x00f0ff : (isHovered ? 0xffffff : baseColor),
        linewidth: isSelected ? 3 : 1.5,
      });
      const wireframe = new THREE.LineSegments(edges, edgeMat);
      objContainer.add(wireframe);

      // 3. Directional heading indicator (forward along local +X)
      const arrowLength = Math.min(dx * 0.45, 1.8);
      const arrowDir = new THREE.Vector3(1, 0, 0);
      const arrowOrigin = new THREE.Vector3(dx / 4, 0, dz * 0.2);
      const arrowHelper = new THREE.ArrowHelper(
        arrowDir,
        arrowOrigin,
        arrowLength,
        isSelected ? 0x00f0ff : baseColor.getHex(),
        Math.min(arrowLength * 0.4, 0.45),
        Math.min(arrowLength * 0.25, 0.25)
      );
      objContainer.add(arrowHelper);

      // 4. Center pivot point
      const centerSphereGeo = new THREE.SphereGeometry(Math.min(0.12, dx * 0.05), 8, 8);
      const centerSphereMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xffffff : baseColor,
      });
      const centerSphere = new THREE.Mesh(centerSphereGeo, centerSphereMat);
      objContainer.add(centerSphere);

      boxGroup.add(objContainer);
    });
  }, [boxes, selectedBoxId, hoveredBoxId]);

  // Handle Raycasting for Box Click Selection
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const camera = cameraRef.current;
      const boxGroup = boxGroupRef.current;
      if (!container || !camera || !boxGroup) return;

      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const intersects = raycaster.intersectObjects(boxGroup.children, true);
      if (intersects.length > 0) {
        let current: THREE.Object3D | null = intersects[0].object;
        while (current && !current.userData?.boxId && current.parent) {
          current = current.parent;
        }
        if (current && current.userData?.boxId) {
          onSelectBox(current.userData.boxId);
          return;
        }
      }
    },
    [onSelectBox]
  );

  // Camera Presets handler
  const setCameraPreset = useCallback(
    (preset: CameraPreset) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;

      onPresetChange(preset);

      const target = controls.target.clone();

      if (preset === 'perspective') {
        camera.position.set(target.x + 18, target.y - 22, target.z + 16);
      } else if (preset === 'bev') {
        // Top-Down Bird's Eye View
        camera.position.set(target.x, target.y, target.z + 45);
      } else if (preset === 'front') {
        camera.position.set(target.x + 35, target.y, target.z + 4);
      } else if (preset === 'side') {
        camera.position.set(target.x, target.y + 35, target.z + 4);
      }

      camera.lookAt(target);
      controls.update();
    },
    [onPresetChange]
  );

  // Reset Camera View
  const resetCamera = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    controls.target.set(0, 0, 1.0);
    camera.position.set(22, -26, 18);
    controls.update();
  }, []);

  // Focus on Selected Box
  const focusSelectedBox = useCallback(() => {
    if (!selectedBoxId) return;
    const box = boxes.find(b => b.id === selectedBoxId);
    if (!box || !cameraRef.current || !controlsRef.current) return;

    const [cx, cy, cz] = box.center;
    controlsRef.current.target.set(cx, cy, cz);
    cameraRef.current.position.set(cx + 8, cy - 10, cz + 6);
    controlsRef.current.update();
  }, [selectedBoxId, boxes]);

  if (webglError) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-slate-900 border border-red-800 rounded-xl p-8 text-center text-slate-200">
        <div className="w-16 h-16 rounded-full bg-red-900/50 flex items-center justify-center mb-4 text-red-400">
          <Info size={32} />
        </div>
        <h3 className="text-xl font-bold text-red-400 mb-2">3D WebGL Context Fallback</h3>
        <p className="max-w-md text-sm text-slate-400 mb-6">
          Unable to initialize WebGL hardware acceleration. The fallback inspection interface has been engaged.
        </p>
        <div className="bg-slate-800/80 p-4 rounded-lg text-left text-xs font-mono max-w-lg overflow-x-auto text-slate-300">
          <div>Point Count: {metadata.pointCount.toLocaleString()}</div>
          <div>Bounds X: [{metadata.boundsMin[0].toFixed(2)}, {metadata.boundsMax[0].toFixed(2)}]m</div>
          <div>Bounds Y: [{metadata.boundsMin[1].toFixed(2)}, {metadata.boundsMax[1].toFixed(2)}]m</div>
          <div>Bounds Z: [{metadata.boundsMin[2].toFixed(2)}, {metadata.boundsMax[2].toFixed(2)}]m</div>
          <div className="mt-2 text-amber-300">Active Annotations: {boxes.length} bounding boxes</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full min-h-[480px] bg-slate-950 rounded-xl overflow-hidden select-none border border-slate-800/80 shadow-2xl ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      {/* 3D WebGL Canvas Mount */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Top Left: Scene HUD Spec Badge */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-lg px-3 py-1.5 shadow-lg flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          <span className="text-xs font-mono font-medium text-slate-200">
            {metadata.fileName || 'LiDAR Scene'}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-xs font-mono text-cyan-400 font-semibold">
            {points.length.toLocaleString()} pts
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-xs font-mono text-indigo-300 font-semibold">
            {boxes.length} boxes
          </span>
        </div>
      </div>

      {/* Top Right: Viewport Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {selectedBoxId && (
          <button
            onClick={focusSelectedBox}
            title="Focus on Selected Box (F)"
            className="bg-slate-900/90 hover:bg-cyan-900/40 text-cyan-400 hover:text-cyan-300 border border-cyan-800/60 rounded-lg px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 shadow-lg transition-all"
          >
            <Crosshair size={14} />
            <span>Focus Box</span>
          </button>
        )}

        <button
          onClick={resetCamera}
          title="Reset Camera View"
          className="bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/60 rounded-lg p-2 text-xs shadow-lg transition-all"
        >
          <RotateCcw size={14} />
        </button>

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen 3D Canvas'}
          className="bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/60 rounded-lg p-2 text-xs shadow-lg transition-all"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Bottom Center Unified HUD Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-2 shadow-2xl max-w-[95vw] overflow-x-auto">
        {/* Camera Presets */}
        <div className="flex items-center gap-1 pr-2 border-r border-slate-700/70">
          <button
            onClick={() => setCameraPreset('perspective')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
              activePreset === 'perspective'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            3D Orbit
          </button>
          <button
            onClick={() => setCameraPreset('bev')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
              activePreset === 'bev'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            BEV (Top)
          </button>
          <button
            onClick={() => setCameraPreset('front')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
              activePreset === 'front'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Front
          </button>
          <button
            onClick={() => setCameraPreset('side')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
              activePreset === 'side'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Side
          </button>
        </div>

        {/* Selected Box Quick Tag */}
        {selectedBoxId ? (
          <div className="flex items-center gap-2 pl-2 text-xs">
            <span className="text-slate-400">Selected:</span>
            <span className="font-mono font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded">
              {selectedBoxId}
            </span>
            <button
              onClick={() => onSelectBox(null)}
              className="text-slate-400 hover:text-rose-400 text-xs px-1"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="pl-2 text-xs text-slate-400 flex items-center gap-1.5">
            <Info size={13} className="text-slate-500" />
            <span>Click any 3D box or select from list</span>
          </div>
        )}
      </div>

      {/* Coordinate triad key bottom left */}
      <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 rounded-md px-2.5 py-1.5 text-[10px] font-mono text-slate-400 flex items-center gap-2.5 pointer-events-none">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> X (Fwd)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Y (Left)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Z (Up)
        </span>
      </div>
    </div>
  );
};
