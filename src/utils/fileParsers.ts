import { Point3D, PointCloudData, PointCloudMetadata } from '../types/pointcloud';

export function computeMetadata(points: Point3D[], fileName: string, format: string): PointCloudMetadata {
  if (points.length === 0) {
    return {
      fileName,
      pointCount: 0,
      boundsMin: [0, 0, 0],
      boundsMax: [0, 0, 0],
      dimensions: [0, 0, 0],
      format: format.toUpperCase(),
      hasIntensity: false,
      hasRgb: false,
      hasLabels: false,
    };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let hasIntensity = false;
  let hasRgb = false;
  let hasLabels = false;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;

    if (p.intensity !== undefined) hasIntensity = true;
    if (p.r !== undefined) hasRgb = true;
    if (p.label !== undefined && p.label > 0) hasLabels = true;
  }

  const dimX = maxX - minX;
  const dimY = maxY - minY;
  const dimZ = maxZ - minZ;

  return {
    fileName,
    pointCount: points.length,
    boundsMin: [minX, minY, minZ],
    boundsMax: [maxX, maxY, maxZ],
    dimensions: [dimX, dimY, dimZ],
    format: format.toUpperCase(),
    hasIntensity,
    hasRgb,
    hasLabels,
  };
}

export function parseXYZ(content: string, fileName: string = 'pointcloud.xyz'): PointCloudData {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) {
    throw new Error('XYZ file is empty or contains only comments.');
  }

  const points: Point3D[] = [];

  for (let i = 0; i < lines.length; i++) {
    const tokens = lines[i].split(/\s+/);
    if (tokens.length < 3) {
      throw new Error(`Line ${i + 1} has fewer than 3 coordinate tokens: "${lines[i]}"`);
    }

    const x = parseFloat(tokens[0]);
    const y = parseFloat(tokens[1]);
    const z = parseFloat(tokens[2]);

    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
      throw new Error(`Line ${i + 1} contains non-numeric coordinates: [${tokens.slice(0, 3).join(', ')}]`);
    }

    const pt: Point3D = { x, y, z };

    if (tokens.length === 4) {
      const val = parseFloat(tokens[3]);
      pt.intensity = isFinite(val) ? val : 1.0;
    } else if (tokens.length >= 6) {
      const r = parseInt(tokens[3], 10);
      const g = parseInt(tokens[4], 10);
      const b = parseInt(tokens[5], 10);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        pt.r = r;
        pt.g = g;
        pt.b = b;
      }
      if (tokens.length >= 7) {
        const lbl = parseInt(tokens[6], 10);
        if (!isNaN(lbl)) pt.label = lbl;
      }
    }

    points.push(pt);
  }

  return {
    points,
    metadata: computeMetadata(points, fileName, 'XYZ'),
  };
}

export function parsePCD(content: string, fileName: string = 'pointcloud.pcd'): PointCloudData {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || content.trim().length === 0) {
    throw new Error('PCD file is completely empty.');
  }

  const header: Record<string, string> = {};
  let dataIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const tokens = line.split(/\s+/);
    const tag = tokens[0].toUpperCase();

    if (tag === 'DATA') {
      const mode = (tokens[1] || '').toLowerCase();
      if (mode === 'binary') {
        throw new Error('Binary PCD is not supported directly in the browser parser. Please upload ASCII PCD.');
      }
      dataIndex = i + 1;
      break;
    } else {
      header[tag] = tokens.slice(1).join(' ');
    }
  }

  if (dataIndex === -1) {
    throw new Error('Malformed PCD: Missing DATA header specifier.');
  }

  const fields = (header['FIELDS'] || 'x y z').toLowerCase().split(/\s+/);
  const xIdx = fields.indexOf('x');
  const yIdx = fields.indexOf('y');
  const zIdx = fields.indexOf('z');

  if (xIdx === -1 || yIdx === -1 || zIdx === -1) {
    throw new Error(`PCD FIELDS must contain x, y, and z coordinates. Found: ${fields.join(', ')}`);
  }

  const intensityIdx = fields.indexOf('intensity') !== -1 ? fields.indexOf('intensity') : fields.indexOf('i');
  const labelIdx = fields.indexOf('label');

  const points: Point3D[] = [];

  for (let i = dataIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const tokens = line.split(/\s+/);
    if (tokens.length < fields.length) continue;

    const x = parseFloat(tokens[xIdx]);
    const y = parseFloat(tokens[yIdx]);
    const z = parseFloat(tokens[zIdx]);

    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
      throw new Error(`Line ${i + 1} contains non-numeric coordinates: [${tokens.slice(0, 3).join(', ')}]`);
    }

    const pt: Point3D = { x, y, z };
    if (intensityIdx !== -1) {
      const val = parseFloat(tokens[intensityIdx]);
      if (isFinite(val)) pt.intensity = val;
    }
    if (labelIdx !== -1) {
      const lbl = parseInt(tokens[labelIdx], 10);
      if (!isNaN(lbl)) pt.label = lbl;
    }

    points.push(pt);
  }

  if (points.length === 0) {
    throw new Error('PCD file contains 0 valid point records.');
  }

  return {
    points,
    metadata: computeMetadata(points, fileName, 'PCD'),
  };
}

export function parsePLY(content: string, fileName: string = 'pointcloud.ply'): PointCloudData {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== 'ply') {
    throw new Error('Invalid PLY file: Header must begin with "ply".');
  }

  const properties: string[] = [];
  let dataIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const tokens = line.split(/\s+/);

    if (tokens[0] === 'property') {
      if (tokens.length >= 3) {
        properties.push(tokens[2].toLowerCase());
      }
    } else if (tokens[0] === 'end_header') {
      dataIndex = i + 1;
      break;
    }
  }

  if (dataIndex === -1) {
    throw new Error('Malformed PLY file: Missing "end_header" marker.');
  }

  const xIdx = properties.indexOf('x');
  const yIdx = properties.indexOf('y');
  const zIdx = properties.indexOf('z');

  if (xIdx === -1 || yIdx === -1 || zIdx === -1) {
    throw new Error(`PLY properties must include x, y, and z. Found: ${properties.join(', ')}`);
  }

  const redIdx = properties.indexOf('red') !== -1 ? properties.indexOf('red') : properties.indexOf('r');
  const greenIdx = properties.indexOf('green') !== -1 ? properties.indexOf('green') : properties.indexOf('g');
  const blueIdx = properties.indexOf('blue') !== -1 ? properties.indexOf('blue') : properties.indexOf('b');

  const points: Point3D[] = [];

  for (let i = dataIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const tokens = line.split(/\s+/);
    if (tokens.length < properties.length) continue;

    const x = parseFloat(tokens[xIdx]);
    const y = parseFloat(tokens[yIdx]);
    const z = parseFloat(tokens[zIdx]);

    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
      throw new Error(`Line ${i + 1} contains non-numeric coordinates: [${tokens.slice(0, 3).join(', ')}]`);
    }

    const pt: Point3D = { x, y, z };
    if (redIdx !== -1 && greenIdx !== -1 && blueIdx !== -1) {
      pt.r = parseInt(tokens[redIdx], 10);
      pt.g = parseInt(tokens[greenIdx], 10);
      pt.b = parseInt(tokens[blueIdx], 10);
    }

    points.push(pt);
  }

  if (points.length === 0) {
    throw new Error('PLY file contains 0 valid point records.');
  }

  return {
    points,
    metadata: computeMetadata(points, fileName, 'PLY'),
  };
}

export function parsePointCloudFile(content: string, fileName: string): PointCloudData {
  const ext = fileName.slice(((fileName.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
  if (ext === 'pcd') {
    return parsePCD(content, fileName);
  } else if (ext === 'ply') {
    return parsePLY(content, fileName);
  } else if (ext === 'xyz' || ext === 'txt' || ext === 'pts') {
    return parseXYZ(content, fileName);
  } else {
    throw new Error(`Unsupported file extension ".${ext}". Please upload .pcd, .ply, or .xyz point clouds.`);
  }
}
