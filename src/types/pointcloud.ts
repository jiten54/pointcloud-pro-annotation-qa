/**
 * PointCloud Pro - TypeScript Definitions
 */

export type SemanticClassName =
  | 'car'
  | 'truck'
  | 'bus'
  | 'pedestrian'
  | 'cyclist'
  | 'motorcycle'
  | 'road'
  | 'vegetation'
  | 'building'
  | 'other';

export type ReviewStatus = 'Pending' | 'Approved' | 'Needs Correction';

export type QASeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type ColorMode = 'semantic' | 'elevation' | 'intensity' | 'instance';

export type CameraPreset = 'perspective' | 'bev' | 'front' | 'side';

export interface Point3D {
  x: number;
  y: number;
  z: number;
  intensity?: number;
  r?: number;
  g?: number;
  b?: number;
  label?: number;
  instanceId?: number;
}

export interface BoundingBox3D {
  id: string;
  className: SemanticClassName;
  center: [number, number, number];       // [x, y, z] in meters
  dimensions: [number, number, number];   // [length(dx), width(dy), height(dz)] in meters
  rotation: [number, number, number];     // [yaw, pitch, roll] in radians
  reviewStatus: ReviewStatus;
  reviewNote: string;
  pointCount: number;
  confidence: number;
  instanceId?: number;
}

export interface PointCloudMetadata {
  fileName: string;
  pointCount: number;
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  dimensions: [number, number, number];
  format: string;
  hasIntensity: boolean;
  hasRgb: boolean;
  hasLabels: boolean;
}

export interface PointCloudData {
  points: Point3D[];
  metadata: PointCloudMetadata;
}

export interface QAIssue {
  id: string;
  severity: QASeverity;
  ruleId: string;
  annotationId?: string;
  message: string;
  recommendedAction: string;
  timestamp: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  details?: string;
}

export interface SegmentationClassStat {
  className: SemanticClassName;
  classId: number;
  color: string;
  pointCount: number;
  percentage: number;
}
