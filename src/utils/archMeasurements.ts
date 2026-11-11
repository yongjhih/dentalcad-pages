import { CaliperMeasurement, OrthoArchMetrics, Point3D } from '../types/dental';

export const DEFAULT_ORTHO_ARCH_METRICS: OrthoArchMetrics = {
  upperIntercanineWidthMm: 34.8,
  lowerIntercanineWidthMm: 27.4,
  upperIntermolarWidthMm: 52.6,
  lowerIntermolarWidthMm: 47.2,
  upperArchDepthMm: 41.5,
  lowerArchDepthMm: 38.2,
  overjetMm: 2.6,
  overbiteMm: 2.4,
  midlineDeviationMm: 0.4,
  archFormRatio: 1.27,
};

/**
 * Compute a 3D point-to-point digital caliper measurement in millimeters
 */
export function createCaliperMeasurement(
  id: string,
  label: string,
  pointA: Point3D,
  pointB: Point3D
): CaliperMeasurement {
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const dz = pointB.z - pointA.z;
  const dist = Math.hypot(dx, dy, dz);

  return {
    id,
    label,
    pointA: {
      x: Number(pointA.x.toFixed(2)),
      y: Number(pointA.y.toFixed(2)),
      z: Number(pointA.z.toFixed(2)),
    },
    pointB: {
      x: Number(pointB.x.toFixed(2)),
      y: Number(pointB.y.toFixed(2)),
      z: Number(pointB.z.toFixed(2)),
    },
    distanceMm: Number(dist.toFixed(2)),
    deltaX: Number(Math.abs(dx).toFixed(2)),
    deltaY: Number(Math.abs(dy).toFixed(2)),
    deltaZ: Number(Math.abs(dz).toFixed(2)),
  };
}

interface ArchBandSummary {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  canineWidth: number;
  molarWidth: number;
  incisalY: number;
  incisalZ: number;
  incisalMidlineX: number;
}

function analyzeArchVertices(positions: ArrayLike<number>, isUpper: boolean): ArchBandSummary | null {
  const n = Math.floor(positions.length / 3);
  if (n < 12) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  // Step 1: Bounding box
  const step = Math.max(1, Math.floor(n / 15000));
  for (let i = 0; i < n; i += step) {
    const idx = i * 3;
    const x = positions[idx];
    const y = positions[idx + 1];
    const z = positions[idx + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const depthY = Math.max(1, maxY - minY);
  // In STL coordinates: Anterior (Incisors) is near minY (-47 mm) and Posterior (Molars) is near maxY (+10 mm)
  // Canine coronal band is approximately 20% to 32% from anterior (minY) toward posterior (maxY)
  const canineYMin = minY + depthY * 0.20;
  const canineYMax = minY + depthY * 0.32;

  // First molar coronal band is approximately 54% to 70% from anterior (minY) toward posterior (maxY)
  const molarYMin = minY + depthY * 0.54;
  const molarYMax = minY + depthY * 0.70;

  // Anterior incisal band is the frontmost 14% near minY and midline
  const incisalYMax = minY + depthY * 0.14;
  const centerX = 0.5 * (minX + maxX);

  let cLeftMax = -Infinity;
  let cRightMin = Infinity;
  let mLeftMax = -Infinity;
  let mRightMin = Infinity;

  let incisalY = Infinity;
  let incisalZ = isUpper ? Infinity : -Infinity;
  let incisalXSum = 0;
  let incisalCount = 0;

  for (let i = 0; i < n; i += step) {
    const idx = i * 3;
    const x = positions[idx];
    const y = positions[idx + 1];
    const z = positions[idx + 2];

    // Focus on tooth crown height band (exclude outer base rim)
    if (isUpper && z > minZ + (maxZ - minZ) * 0.55) continue;
    if (!isUpper && z < maxZ - (maxZ - minZ) * 0.55) continue;

    if (y >= canineYMin && y <= canineYMax) {
      if (x > cLeftMax) cLeftMax = x;
      if (x < cRightMin) cRightMin = x;
    }

    if (y >= molarYMin && y <= molarYMax) {
      if (x > mLeftMax) mLeftMax = x;
      if (x < mRightMin) mRightMin = x;
    }

    if (y <= incisalYMax && Math.abs(x - centerX) <= 8.5) {
      if (y < incisalY) incisalY = y;
      if (isUpper) {
        if (z < incisalZ) incisalZ = z;
      } else {
        if (z > incisalZ) incisalZ = z;
      }
      incisalXSum += x;
      incisalCount++;
    }
  }

  const totalWidth = maxX - minX;
  // Convert outer buccal width at canine/molar band to clinical cusp-tip intercanine/intermolar width (~0.80 factor)
  const rawCanineSpan =
    Number.isFinite(cLeftMax) && Number.isFinite(cRightMin) && cLeftMax > cRightMin
      ? (cLeftMax - cRightMin) * 0.78
      : totalWidth * 0.54;
  const rawMolarSpan =
    Number.isFinite(mLeftMax) && Number.isFinite(mRightMin) && mLeftMax > mRightMin
      ? (mLeftMax - mRightMin) * 0.82
      : totalWidth * 0.79;

  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    canineWidth: Number(rawCanineSpan.toFixed(1)),
    molarWidth: Number(rawMolarSpan.toFixed(1)),
    incisalY: Number.isFinite(incisalY) ? incisalY : maxY,
    incisalZ: Number.isFinite(incisalZ) ? incisalZ : 0,
    incisalMidlineX: incisalCount > 0 ? incisalXSum / incisalCount : centerX,
  };
}

/**
 * Compute clinical arch and occlusal metrics from Upper and Lower 3D mesh vertices
 */
export function computeOrthoArchMetrics(
  upperPositions: ArrayLike<number>,
  lowerPositions: ArrayLike<number>
): OrthoArchMetrics {
  const upper = analyzeArchVertices(upperPositions, true);
  const lower = analyzeArchVertices(lowerPositions, false);

  if (!upper || !lower) {
    return { ...DEFAULT_ORTHO_ARCH_METRICS };
  }

  const upperDepth = Number(((upper.maxY - upper.minY) * 0.82).toFixed(1));
  const lowerDepth = Number(((lower.maxY - lower.minY) * 0.78).toFixed(1));

  const rawOverjet = Math.max(0.2, Math.abs(upper.incisalY - lower.incisalY));
  const rawOverbite = Math.max(0.1, Math.abs(lower.incisalZ - upper.incisalZ));
  const midlineDev = Math.abs(upper.incisalMidlineX - lower.incisalMidlineX);

  const ratio = upperDepth > 0 ? upper.molarWidth / upperDepth : 1.25;

  return {
    upperIntercanineWidthMm: upper.canineWidth,
    lowerIntercanineWidthMm: lower.canineWidth,
    upperIntermolarWidthMm: upper.molarWidth,
    lowerIntermolarWidthMm: lower.molarWidth,
    upperArchDepthMm: upperDepth,
    lowerArchDepthMm: lowerDepth,
    overjetMm: Number(Math.min(12, rawOverjet).toFixed(1)),
    overbiteMm: Number(Math.min(10, rawOverbite).toFixed(1)),
    midlineDeviationMm: Number(Math.min(5, midlineDev).toFixed(2)),
    archFormRatio: Number(ratio.toFixed(2)),
  };
}
