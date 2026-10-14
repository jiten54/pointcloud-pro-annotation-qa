import { BoundingBox3D, Point3D, PointCloudData, SemanticClassName } from '../types/pointcloud';
import { SEMANTIC_CLASSES } from '../constants/classes';
import { computeMetadata } from './fileParsers';

export type ScenePresetType = 'urban_intersection' | 'dense_highway' | 'suburban_crosswalk';

export function generateSyntheticScene(
  preset: ScenePresetType = 'urban_intersection',
  targetPoints: number = 6000
): { pcd: PointCloudData; boxes: BoundingBox3D[] } {
  const points: Point3D[] = [];
  const boxes: BoundingBox3D[] = [];

  // Seeded pseudo-random generator
  let seed = preset === 'urban_intersection' ? 12345 : (preset === 'dense_highway' ? 67890 : 24680);
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const roadId = SEMANTIC_CLASSES.road.id;
  const bldgId = SEMANTIC_CLASSES.building.id;
  const vegId = SEMANTIC_CLASSES.vegetation.id;

  // 1. Road Ground Plane
  const roadCount = Math.floor(targetPoints * 0.45);
  for (let i = 0; i < roadCount; i++) {
    const x = (random() - 0.5) * 50.0;
    const y = (random() - 0.5) * 50.0;
    const z = (random() - 0.5) * 0.05; // Road level around 0

    // Reflectivity: high for lane markings
    const isDivider = (Math.abs(x) < 0.25 && Math.abs(y % 4.0) < 1.5) ||
                      (Math.abs(y) < 0.25 && Math.abs(x % 4.0) < 1.5);
    const intensity = isDivider ? 0.95 : 0.15 + random() * 0.25;

    points.push({
      x,
      y,
      z,
      intensity,
      label: roadId,
      instanceId: 0,
    });
  }

  // 2. Curbs and Sidewalks
  const curbCount = Math.floor(targetPoints * 0.12);
  for (let i = 0; i < curbCount; i++) {
    const side = random() > 0.5 ? 1 : -1;
    const isX = random() > 0.5;
    let x: number, y: number;
    if (isX) {
      x = side * (12.0 + random() * 5.0);
      y = (random() - 0.5) * 45.0;
    } else {
      x = (random() - 0.5) * 45.0;
      y = side * (12.0 + random() * 5.0);
    }
    const z = 0.15 + (random() - 0.5) * 0.02; // Sidewalk elevation ~15cm
    points.push({
      x,
      y,
      z,
      intensity: 0.35 + random() * 0.2,
      label: roadId,
      instanceId: 0,
    });
  }

  // 3. Buildings / Facades
  const bldgCount = Math.floor(targetPoints * 0.15);
  for (let i = 0; i < bldgCount; i++) {
    const side = random() > 0.5 ? 1 : -1;
    const x = side * (20.0 + random() * 6.0);
    const y = (random() - 0.5) * 48.0;
    const z = random() * 10.0;
    points.push({
      x,
      y,
      z,
      intensity: 0.4 + random() * 0.4,
      label: bldgId,
      instanceId: 0,
    });
  }

  // 4. Trees / Street Vegetation
  const treeCount = Math.floor(targetPoints * 0.10);
  const treeLocations = [
    [-15.0, -14.0],
    [-15.0, 14.0],
    [15.0, -12.0],
    [15.0, 16.0],
  ];
  for (let i = 0; i < treeCount; i++) {
    const loc = treeLocations[i % treeLocations.length];
    const r = random() * 2.2;
    const theta = random() * 2 * Math.PI;
    const phi = random() * Math.PI;
    const x = loc[0] + r * Math.sin(phi) * Math.cos(theta);
    const y = loc[1] + r * Math.sin(phi) * Math.sin(theta);
    const z = 2.5 + r * Math.cos(phi);
    points.push({
      x,
      y,
      z,
      intensity: 0.2 + random() * 0.3,
      label: vegId,
      instanceId: 0,
    });
  }

  // 5. Perception Objects (Vehicles, Pedestrians, Cyclists)
  interface ObjectSpec {
    id: string;
    className: SemanticClassName;
    cx: number;
    cy: number;
    cz: number;
    yawDeg: number;
    pts: number;
  }

  let objectSpecs: ObjectSpec[] = [];

  if (preset === 'urban_intersection') {
    objectSpecs = [
      { id: 'box-car-01', className: 'car', cx: 6.5, cy: 3.8, cz: 0.8, yawDeg: 12.0, pts: 220 },
      { id: 'box-car-02', className: 'car', cx: -5.5, cy: 9.5, cz: 0.8, yawDeg: -8.0, pts: 190 },
      { id: 'box-truck-01', className: 'truck', cx: 8.2, cy: -13.0, cz: 1.6, yawDeg: 90.0, pts: 320 },
      { id: 'box-ped-01', className: 'pedestrian', cx: -3.8, cy: 3.2, cz: 0.88, yawDeg: 45.0, pts: 55 },
      { id: 'box-ped-02', className: 'pedestrian', cx: -3.2, cy: 4.1, cz: 0.88, yawDeg: 40.0, pts: 50 },
      { id: 'box-cyclist-01', className: 'cyclist', cx: 3.5, cy: -4.8, cz: 0.85, yawDeg: -25.0, pts: 80 },
    ];
  } else if (preset === 'dense_highway') {
    objectSpecs = [
      { id: 'box-car-01', className: 'car', cx: 4.0, cy: 2.0, cz: 0.8, yawDeg: 0.0, pts: 250 },
      { id: 'box-car-02', className: 'car', cx: 16.5, cy: 2.2, cz: 0.8, yawDeg: 2.0, pts: 180 },
      { id: 'box-truck-01', className: 'truck', cx: -8.0, cy: -2.5, cz: 1.6, yawDeg: 0.0, pts: 360 },
      { id: 'box-bus-01', className: 'bus', cx: 12.0, cy: -6.5, cz: 1.7, yawDeg: 0.0, pts: 420 },
      { id: 'box-motorcycle-01', className: 'motorcycle', cx: -2.0, cy: 6.5, cz: 0.65, yawDeg: -5.0, pts: 70 },
      { id: 'box-car-03', className: 'car', cx: -15.0, cy: 2.1, cz: 0.8, yawDeg: 1.0, pts: 160 },
    ];
  } else {
    // suburban_crosswalk
    objectSpecs = [
      { id: 'box-ped-01', className: 'pedestrian', cx: 1.2, cy: 2.5, cz: 0.88, yawDeg: 90.0, pts: 75 },
      { id: 'box-ped-02', className: 'pedestrian', cx: 2.0, cy: 2.7, cz: 0.88, yawDeg: 85.0, pts: 70 },
      { id: 'box-ped-03', className: 'pedestrian', cx: -4.5, cy: -2.0, cz: 0.88, yawDeg: -45.0, pts: 60 },
      { id: 'box-cyclist-01', className: 'cyclist', cx: -1.5, cy: -6.0, cz: 0.85, yawDeg: 15.0, pts: 85 },
      { id: 'box-car-01', className: 'car', cx: 9.0, cy: 0.0, cz: 0.8, yawDeg: 0.0, pts: 210 },
    ];
  }

  objectSpecs.forEach((spec, idx) => {
    const classDef = SEMANTIC_CLASSES[spec.className];
    const dims = classDef.defaultDimensions;
    const yawRad = (spec.yawDeg * Math.PI) / 180.0;
    const classId = classDef.id;
    const instanceId = idx + 1;

    const halfL = dims[0] / 2.0;
    const halfW = dims[1] / 2.0;
    const halfH = dims[2] / 2.0;

    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);

    let actualContainedPts = 0;

    for (let p = 0; p < spec.pts; p++) {
      // Points distributed along surface / volume
      const lx = (random() - 0.5) * dims[0] * 0.92;
      const ly = (random() - 0.5) * dims[1] * 0.92;
      const lz = (random() - 0.5) * dims[2] * 0.92;

      // Rotate local point by yaw
      const rx = lx * cosY - ly * sinY;
      const ry = lx * sinY + ly * cosY;

      const wx = spec.cx + rx;
      const wy = spec.cy + ry;
      const wz = spec.cz + lz;

      points.push({
        x: wx,
        y: wy,
        z: wz,
        intensity: 0.55 + random() * 0.4,
        label: classId,
        instanceId,
      });
      actualContainedPts++;
    }

    boxes.push({
      id: spec.id,
      className: spec.className,
      center: [spec.cx, spec.cy, spec.cz],
      dimensions: [dims[0], dims[1], dims[2]],
      rotation: [yawRad, 0.0, 0.0],
      reviewStatus: 'Pending',
      reviewNote: '',
      pointCount: actualContainedPts,
      confidence: 0.98,
      instanceId,
    });
  });

  const pcd: PointCloudData = {
    points,
    metadata: computeMetadata(points, `${preset}.pcd`, 'PCD'),
  };

  return { pcd, boxes };
}
