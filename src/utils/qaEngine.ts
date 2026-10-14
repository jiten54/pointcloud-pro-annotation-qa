import { BoundingBox3D, Point3D, QAIssue, QASeverity } from '../types/pointcloud';
import { SEMANTIC_CLASSES } from '../constants/classes';

/**
 * Checks if a 3D point is inside an oriented bounding box (OBB).
 */
export function isPointInsideBox(
  point: Point3D,
  box: BoundingBox3D,
  margin: number = 0.05
): boolean {
  const [cx, cy, cz] = box.center;
  const [dx, dy, dz] = box.dimensions;
  const yaw = box.rotation[0];

  const relX = point.x - cx;
  const relY = point.y - cy;
  const relZ = point.z - cz;

  // Inverse yaw rotation
  const cosY = Math.cos(-yaw);
  const sinY = Math.sin(-yaw);
  const localX = relX * cosY - relY * sinY;
  const localY = relX * sinY + relY * cosY;
  const localZ = relZ;

  const halfL = dx / 2.0 + margin;
  const halfW = dy / 2.0 + margin;
  const halfH = dz / 2.0 + margin;

  return (
    Math.abs(localX) <= halfL &&
    Math.abs(localY) <= halfW &&
    Math.abs(localZ) <= halfH
  );
}

/**
 * Computes axis-aligned bounding box (AABB) bounds [minX, minY, minZ], [maxX, maxY, maxZ]
 */
export function getBoxAABB(box: BoundingBox3D): {
  min: [number, number, number];
  max: [number, number, number];
} {
  const [cx, cy, cz] = box.center;
  const [dx, dy, dz] = box.dimensions;
  const yaw = box.rotation[0];

  const cosY = Math.abs(Math.cos(yaw));
  const sinY = Math.abs(Math.sin(yaw));

  const extX = (dx * cosY + dy * sinY) / 2.0;
  const extY = (dx * sinY + dy * cosY) / 2.0;
  const extZ = dz / 2.0;

  return {
    min: [cx - extX, cy - extY, cz - extZ],
    max: [cx + extX, cy + extY, cz + extZ],
  };
}

/**
 * Computes 3D AABB Intersection-over-Union (IoU) between two bounding boxes.
 */
export function computeBoxIoU(boxA: BoundingBox3D, boxB: BoundingBox3D): number {
  const aabbA = getBoxAABB(boxA);
  const aabbB = getBoxAABB(boxB);

  const interMinX = Math.max(aabbA.min[0], aabbB.min[0]);
  const interMaxX = Math.min(aabbA.max[0], aabbB.max[0]);
  const interMinY = Math.max(aabbA.min[1], aabbB.min[1]);
  const interMaxY = Math.min(aabbA.max[1], aabbB.max[1]);
  const interMinZ = Math.max(aabbA.min[2], aabbB.min[2]);
  const interMaxZ = Math.min(aabbA.max[2], aabbB.max[2]);

  const interX = Math.max(0, interMaxX - interMinX);
  const interY = Math.max(0, interMaxY - interMinY);
  const interZ = Math.max(0, interMaxZ - interMinZ);

  const interVolume = interX * interY * interZ;
  if (interVolume <= 0) return 0;

  const volA = boxA.dimensions[0] * boxA.dimensions[1] * boxA.dimensions[2];
  const volB = boxB.dimensions[0] * boxB.dimensions[1] * boxB.dimensions[2];
  const unionVolume = volA + volB - interVolume;

  if (unionVolume <= 0) return 0;
  return Math.min(1.0, interVolume / unionVolume);
}

/**
 * Counts points inside each box and updates box.pointCount.
 */
export function updateContainedPoints(boxes: BoundingBox3D[], points: Point3D[]): void {
  for (const box of boxes) {
    let count = 0;
    for (const pt of points) {
      if (isPointInsideBox(pt, box)) {
        count++;
      }
    }
    box.pointCount = count;
  }
}

/**
 * Runs the complete suite of automated Quality Assurance rules.
 */
export function runQAChecks(
  boxes: BoundingBox3D[],
  points?: Point3D[],
  maxSensorRange: number = 120.0,
  overlapIoUThreshold: number = 0.15
): QAIssue[] {
  const issues: QAIssue[] = [];
  const now = new Date().toISOString();

  // Rule 1: Duplicate ID check
  const idCounts: Record<string, number> = {};
  for (const b of boxes) {
    idCounts[b.id] = (idCounts[b.id] || 0) + 1;
  }
  for (const [id, count] of Object.entries(idCounts)) {
    if (count > 1) {
      issues.push({
        id: `qa-dup-${id}`,
        severity: 'CRITICAL',
        ruleId: 'RULE-QA-001',
        annotationId: id,
        message: `Duplicate annotation ID "${id}" detected ${count} times.`,
        recommendedAction: 'Rename conflicting bounding box instances to ensure globally unique identifiers.',
        timestamp: now,
      });
    }
  }

  // Rule 2 & 3: Dimensions, coordinates, and ground penetration
  for (const b of boxes) {
    const [dx, dy, dz] = b.dimensions;
    const [cx, cy, cz] = b.center;

    if (!SEMANTIC_CLASSES[b.className]) {
      issues.push({
        id: `qa-class-${b.id}`,
        severity: 'CRITICAL',
        ruleId: 'RULE-QA-002',
        annotationId: b.id,
        message: `Unknown or unmapped semantic class: "${b.className}".`,
        recommendedAction: 'Select a standard perception class (car, truck, pedestrian, etc.).',
        timestamp: now,
      });
    }

    if (dx <= 0 || dy <= 0 || dz <= 0 || !isFinite(dx) || !isFinite(dy) || !isFinite(dz)) {
      issues.push({
        id: `qa-dim-zero-${b.id}`,
        severity: 'CRITICAL',
        ruleId: 'RULE-QA-003',
        annotationId: b.id,
        message: `Non-positive or non-finite box dimensions: [${dx.toFixed(2)}, ${dy.toFixed(2)}, ${dz.toFixed(2)}]m.`,
        recommendedAction: 'Ensure all dimensions (length, width, height) are strictly positive real numbers.',
        timestamp: now,
      });
    }

    const dist = Math.sqrt(cx * cx + cy * cy + cz * cz);
    if (dist > maxSensorRange) {
      issues.push({
        id: `qa-range-${b.id}`,
        severity: 'WARNING',
        ruleId: 'RULE-QA-004',
        annotationId: b.id,
        message: `Object is at ${dist.toFixed(1)}m from sensor origin, exceeding nominal LiDAR range (${maxSensorRange}m).`,
        recommendedAction: 'Verify if points are reliable returns or distant sensor multipath noise.',
        timestamp: now,
      });
    }

    const bottomZ = cz - dz / 2.0;
    if (bottomZ < -1.5 && b.className !== 'road' && b.className !== 'other') {
      issues.push({
        id: `qa-ground-${b.id}`,
        severity: 'WARNING',
        ruleId: 'RULE-QA-005',
        annotationId: b.id,
        message: `Box base sinks to z=${bottomZ.toFixed(2)}m, substantially penetrating below road surface (z=0m).`,
        recommendedAction: 'Snap bottom face of bounding box to contact the ground elevation.',
        timestamp: now,
      });
    }

    // Dimension anomaly checks vs class defaults
    const defClass = SEMANTIC_CLASSES[b.className];
    if (defClass) {
      const [defL, defW, defH] = defClass.defaultDimensions;
      if (dx > defL * 3.2 || dy > defW * 3.2 || dz > defH * 3.2) {
        issues.push({
          id: `qa-oversize-${b.id}`,
          severity: 'WARNING',
          ruleId: 'RULE-QA-006',
          annotationId: b.id,
          message: `${defClass.label} dimensions (${dx.toFixed(1)}x${dy.toFixed(1)}x${dz.toFixed(1)}m) are unusually oversized compared to standard (${defL.toFixed(1)}x${defW.toFixed(1)}x${defH.toFixed(1)}m).`,
          recommendedAction: 'Check for accidental inclusion of background foliage or adjacent street furniture.',
          timestamp: now,
        });
      } else if (dx < defL * 0.25 || dy < defW * 0.25 || dz < defH * 0.25) {
        issues.push({
          id: `qa-undersize-${b.id}`,
          severity: 'WARNING',
          ruleId: 'RULE-QA-007',
          annotationId: b.id,
          message: `${defClass.label} dimensions (${dx.toFixed(1)}x${dy.toFixed(1)}x${dz.toFixed(1)}m) appear undersized.`,
          recommendedAction: 'Ensure full object silhouette is completely enclosed within box extents.',
          timestamp: now,
        });
      }
    }
  }

  // Rule 4: Overlaps and collisions between pairs
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const b1 = boxes[i];
      const b2 = boxes[j];

      if (b1.className === 'road' || b2.className === 'road') continue;
      if (b1.className === 'other' || b2.className === 'other') continue;

      const iou = computeBoxIoU(b1, b2);
      if (iou >= overlapIoUThreshold) {
        issues.push({
          id: `qa-overlap-${b1.id}-${b2.id}`,
          severity: 'WARNING',
          ruleId: 'RULE-QA-008',
          annotationId: `${b1.id} & ${b2.id}`,
          message: `Suspicious 3D overlap between "${b1.id}" (${b1.className}) and "${b2.id}" (${b2.className}) with IoU=${(iou * 100).toFixed(1)}%.`,
          recommendedAction: 'Verify if two separate entities are colliding, or if this is a duplicated duplicate box.',
          timestamp: now,
        });
      }
    }
  }

  // Rule 5: Point density / Ghost boxes
  if (points && points.length > 0) {
    updateContainedPoints(boxes, points);

    for (const b of boxes) {
      if (b.pointCount === 0) {
        issues.push({
          id: `qa-ghost-${b.id}`,
          severity: 'CRITICAL',
          ruleId: 'RULE-QA-009',
          annotationId: b.id,
          message: `Ghost annotation detected: 0 points found inside 3D box "${b.id}".`,
          recommendedAction: 'Align box center with real LiDAR point reflections, or delete empty annotation.',
          timestamp: now,
        });
      } else if (b.pointCount < 5 && b.className !== 'pedestrian' && b.className !== 'cyclist') {
        issues.push({
          id: `qa-sparse-${b.id}`,
          severity: 'INFO',
          ruleId: 'RULE-QA-010',
          annotationId: b.id,
          message: `Sparse point count: only ${b.pointCount} points contained in "${b.id}".`,
          recommendedAction: 'Check object occlusion level or adjust confidence score accordingly.',
          timestamp: now,
        });
      }
    }
  }

  return issues;
}
