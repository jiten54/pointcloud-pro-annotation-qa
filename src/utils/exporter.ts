import { AuditLogEntry, BoundingBox3D, PointCloudMetadata, QAIssue, SemanticClassName } from '../types/pointcloud';
import { SEMANTIC_CLASSES } from '../constants/classes';

export interface ExportPayload {
  version: string;
  format: string;
  exportedAt: string;
  sceneMetadata: PointCloudMetadata;
  summary: {
    totalAnnotations: number;
    approved: number;
    needsCorrection: number;
    pending: number;
    qaIssuesCount: number;
  };
  annotations: Array<{
    id: string;
    className: SemanticClassName;
    center: [number, number, number];
    dimensions: [number, number, number];
    rotation: [number, number, number];
    reviewStatus: string;
    reviewNote: string;
    pointCount: number;
    confidence: number;
    instanceId?: number;
  }>;
  qaReport: QAIssue[];
  auditTrail: AuditLogEntry[];
}

export function generateJSONExport(
  boxes: BoundingBox3D[],
  metadata: PointCloudMetadata,
  qaIssues: QAIssue[],
  auditLog: AuditLogEntry[]
): string {
  const approved = boxes.filter(b => b.reviewStatus === 'Approved').length;
  const needsCorrection = boxes.filter(b => b.reviewStatus === 'Needs Correction').length;
  const pending = boxes.filter(b => b.reviewStatus === 'Pending').length;

  const payload: ExportPayload = {
    version: '1.0.0',
    format: 'pointcloud_pro_v1',
    exportedAt: new Date().toISOString(),
    sceneMetadata: metadata,
    summary: {
      totalAnnotations: boxes.length,
      approved,
      needsCorrection,
      pending,
      qaIssuesCount: qaIssues.length,
    },
    annotations: boxes.map(b => ({
      id: b.id,
      className: b.className,
      center: [Number(b.center[0].toFixed(4)), Number(b.center[1].toFixed(4)), Number(b.center[2].toFixed(4))],
      dimensions: [Number(b.dimensions[0].toFixed(4)), Number(b.dimensions[1].toFixed(4)), Number(b.dimensions[2].toFixed(4))],
      rotation: [Number(b.rotation[0].toFixed(4)), Number(b.rotation[1].toFixed(4)), Number(b.rotation[2].toFixed(4))],
      reviewStatus: b.reviewStatus,
      reviewNote: b.reviewNote || '',
      pointCount: b.pointCount || 0,
      confidence: b.confidence ?? 1.0,
      instanceId: b.instanceId,
    })),
    qaReport: qaIssues,
    auditTrail: auditLog,
  };

  return JSON.stringify(payload, null, 2);
}

export function generateCSVExport(boxes: BoundingBox3D[]): string {
  const headers = [
    'id',
    'class_name',
    'center_x',
    'center_y',
    'center_z',
    'dim_length',
    'dim_width',
    'dim_height',
    'rot_yaw_rad',
    'rot_pitch_rad',
    'rot_roll_rad',
    'rot_yaw_deg',
    'review_status',
    'point_count',
    'confidence',
    'review_note',
  ];

  const rows = boxes.map(b => [
    `"${b.id}"`,
    `"${b.className}"`,
    b.center[0].toFixed(4),
    b.center[1].toFixed(4),
    b.center[2].toFixed(4),
    b.dimensions[0].toFixed(4),
    b.dimensions[1].toFixed(4),
    b.dimensions[2].toFixed(4),
    b.rotation[0].toFixed(4),
    b.rotation[1].toFixed(4),
    b.rotation[2].toFixed(4),
    ((b.rotation[0] * 180) / Math.PI).toFixed(2),
    `"${b.reviewStatus}"`,
    b.pointCount || 0,
    (b.confidence ?? 1.0).toFixed(2),
    `"${(b.reviewNote || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function generateQAMarkdownReport(
  boxes: BoundingBox3D[],
  metadata: PointCloudMetadata,
  qaIssues: QAIssue[]
): string {
  const critical = qaIssues.filter(i => i.severity === 'CRITICAL').length;
  const warning = qaIssues.filter(i => i.severity === 'WARNING').length;
  const info = qaIssues.filter(i => i.severity === 'INFO').length;

  return `# PointCloud Pro — Quality Assurance Audit Report

- **Scene File**: \`${metadata.fileName}\` (${metadata.format})
- **Total Points**: ${metadata.pointCount.toLocaleString()}
- **Annotated Objects**: ${boxes.length}
- **Timestamp**: ${new Date().toISOString()}

## Summary Statistics
- 🔴 **Critical Violations**: ${critical}
- 🟡 **Warnings**: ${warning}
- 🔵 **Informational**: ${info}
- **Overall QA Score**: ${Math.max(0, 100 - critical * 25 - warning * 8)} / 100

## Detailed Findings
${
  qaIssues.length === 0
    ? '✅ *No anomalies detected. All quality rules satisfied.*'
    : qaIssues
        .map(
          (issue, idx) => `
### ${idx + 1}. [${issue.severity}] ${issue.ruleId} — ${issue.annotationId || 'Scene'}
- **Message**: ${issue.message}
- **Recommended Action**: ${issue.recommendedAction}
`
        )
        .join('\n')
}
`;
}

export function validateAndParseImportedJSON(jsonString: string): {
  success: boolean;
  boxes?: BoundingBox3D[];
  error?: string;
  metadata?: PointCloudMetadata;
  auditTrail?: AuditLogEntry[];
} {
  try {
    const data = JSON.parse(jsonString);

    if (typeof data !== 'object' || data === null) {
      return { success: false, error: 'JSON payload root must be a valid object.' };
    }

    if (!Array.isArray(data.annotations)) {
      return { success: false, error: 'Missing required array field "annotations".' };
    }

    const boxes: BoundingBox3D[] = [];

    for (let i = 0; i < data.annotations.length; i++) {
      const item = data.annotations[i];
      if (!item.id || typeof item.id !== 'string') {
        return { success: false, error: `Annotation #${i + 1} has missing or invalid "id".` };
      }
      if (!item.className || !SEMANTIC_CLASSES[item.className as SemanticClassName]) {
        return {
          success: false,
          error: `Annotation "${item.id}" has invalid class "${item.className}". Supported: ${Object.keys(SEMANTIC_CLASSES).join(', ')}`,
        };
      }
      if (!Array.isArray(item.center) || item.center.length !== 3 || item.center.some((v: any) => !isFinite(v))) {
        return { success: false, error: `Annotation "${item.id}" has invalid center coordinates [x, y, z].` };
      }
      if (
        !Array.isArray(item.dimensions) ||
        item.dimensions.length !== 3 ||
        item.dimensions.some((v: any) => !isFinite(v) || v <= 0)
      ) {
        return { success: false, error: `Annotation "${item.id}" has invalid dimensions (must be 3 positive numbers).` };
      }

      boxes.push({
        id: item.id,
        className: item.className as SemanticClassName,
        center: [Number(item.center[0]), Number(item.center[1]), Number(item.center[2])],
        dimensions: [Number(item.dimensions[0]), Number(item.dimensions[1]), Number(item.dimensions[2])],
        rotation: Array.isArray(item.rotation) && item.rotation.length === 3
          ? [Number(item.rotation[0]), Number(item.rotation[1]), Number(item.rotation[2])]
          : [0, 0, 0],
        reviewStatus: item.reviewStatus === 'Approved' || item.reviewStatus === 'Needs Correction' ? item.reviewStatus : 'Pending',
        reviewNote: item.reviewNote || '',
        pointCount: Number(item.pointCount) || 0,
        confidence: Number(item.confidence) || 1.0,
        instanceId: item.instanceId,
      });
    }

    return {
      success: true,
      boxes,
      metadata: data.sceneMetadata,
      auditTrail: data.auditTrail,
    };
  } catch (err: any) {
    return { success: false, error: `JSON Parse Syntax Error: ${err.message}` };
  }
}
