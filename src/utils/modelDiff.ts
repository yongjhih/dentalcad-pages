import * as THREE from 'three';
import {
  ModelDiffSettings,
  ModelDiffSimulatedPreset,
  ModelDiffStats,
  Point3D,
} from '../types/dental';

export const DEFAULT_MODEL_DIFF_SETTINGS: ModelDiffSettings = {
  enabled: false,
  displayMode: 'both',
  compareTargetId: 'simulated:ortho_alignment',
  maxRangeMm: 1.5,
  toleranceMm: 0.2,
  overlayOpacity: 0.42,
  overlayWireframe: false,
  autoAlignCentroids: false,
  offsetMm: { x: 0, y: 0, z: 0 },
};

export const DEFAULT_MODEL_DIFF_STATS: ModelDiffStats = {
  rmsdMm: 0.52,
  meanAbsDiffMm: 0.38,
  signedMeanDiffMm: 0.05,
  maxPositiveMm: 1.18,
  maxNegativeMm: -1.08,
  inTolerancePercent: 46.5,
  positivePercent: 29.8,
  negativePercent: 23.7,
  upperRmsdMm: 0.54,
  lowerRmsdMm: 0.49,
  comparedVertexCount: 20330,
};

/**
 * Maps a signed 3D surface deviation (in mm) to an RGB color [r, g, b] in [0..1].
 * - Within [-toleranceMm, +toleranceMm]: Clinical Green (#22c55e)
 * - Positive (> +toleranceMm up to +maxRangeMm): Green -> Yellow -> Orange -> Red
 * - Negative (< -toleranceMm down to -maxRangeMm): Green -> Cyan -> Blue -> Deep Indigo
 */
export function deviationToDiffRGB(
  signedDistanceMm: number,
  maxRangeMm = 1.5,
  toleranceMm = 0.2
): [number, number, number] {
  if (!Number.isFinite(signedDistanceMm)) {
    return [0.13, 0.77, 0.37];
  }

  const maxR = Math.max(0.2, maxRangeMm);
  const tol = Math.max(0.01, Math.min(maxR * 0.8, toleranceMm));
  const absD = Math.abs(signedDistanceMm);

  const green: [number, number, number] = [0.13, 0.77, 0.37]; // #22c55e

  if (absD <= tol) {
    return green;
  }

  const span = Math.max(0.001, maxR - tol);
  const t = Math.min(1, Math.max(0, (absD - tol) / span));

  const lerpRGB = (
    a: [number, number, number],
    b: [number, number, number],
    u: number
  ): [number, number, number] => [
    Number((a[0] + (b[0] - a[0]) * u).toFixed(4)),
    Number((a[1] + (b[1] - a[1]) * u).toFixed(4)),
    Number((a[2] + (b[2] - a[2]) * u).toFixed(4)),
  ];

  if (signedDistanceMm > 0) {
    // Positive outward deviation: Green -> Yellow -> Orange -> Red
    const yellow: [number, number, number] = [0.95, 0.78, 0.08];
    const orange: [number, number, number] = [0.98, 0.45, 0.09];
    const red: [number, number, number] = [0.94, 0.18, 0.22];

    if (t < 0.4) {
      return lerpRGB(green, yellow, t / 0.4);
    } else if (t < 0.75) {
      return lerpRGB(yellow, orange, (t - 0.4) / 0.35);
    } else {
      return lerpRGB(orange, red, (t - 0.75) / 0.25);
    }
  } else {
    // Negative inward deviation: Green -> Cyan -> Cobalt Blue -> Deep Blue
    const cyan: [number, number, number] = [0.04, 0.78, 0.88];
    const blue: [number, number, number] = [0.18, 0.48, 0.96];
    const deepBlue: [number, number, number] = [0.11, 0.24, 0.85];

    if (t < 0.4) {
      return lerpRGB(green, cyan, t / 0.4);
    } else if (t < 0.75) {
      return lerpRGB(cyan, blue, (t - 0.4) / 0.35);
    } else {
      return lerpRGB(blue, deepBlue, (t - 0.75) / 0.25);
    }
  }
}

/**
 * Compute centroid of a 3D position buffer [x0, y0, z0, x1, y1, z1, ...].
 */
export function computePositionsCentroid(positions: ArrayLike<number>): Point3D {
  const n = Math.floor(positions.length / 3);
  if (n <= 0) return { x: 0, y: 0, z: 0 };

  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    sx += positions[idx];
    sy += positions[idx + 1];
    sz += positions[idx + 2];
  }
  return {
    x: sx / n,
    y: sy / n,
    z: sz / n,
  };
}

/**
 * Generates an anatomically realistic simulated comparison BufferGeometry from a baseline geometry
 * so clinicians can test and inspect 3D orthodontic / prosthodontic diffs on any case.
 */
export function generateSimulatedComparisonGeometry(
  baseGeom: THREE.BufferGeometry,
  isUpper: boolean,
  preset: ModelDiffSimulatedPreset = 'ortho_alignment'
): THREE.BufferGeometry {
  const cloned = baseGeom.clone();
  const posAttr = cloned.getAttribute('position');
  if (!posAttr) return cloned;

  const arr = new Float32Array(posAttr.array.length);
  const src = posAttr.array;
  const count = posAttr.count;

  const smoothstep = (e0: number, e1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const x = src[idx];
    const y = src[idx + 1];
    const z = src[idx + 2];

    // Crown proximity weight (strongest near occlusal/incisal plane Z ≈ 0, tapering to 0 at gingival base)
    const crownMask = isUpper
      ? 1.0 - smoothstep(2.0, 12.5, z)
      : 1.0 - smoothstep(2.0, 11.5, -z);

    let dx = 0;
    let dy = 0;
    let dz = 0;

    if (preset === 'ortho_alignment') {
      // 1. Anterior incisor retraction (lingual movement +Y & slight intrusion)
      const anteriorMask = (1.0 - smoothstep(-36, -20, y)) * (1.0 - smoothstep(8, 22, Math.abs(x)));
      dy += 1.15 * anteriorMask * crownMask;
      dz += (isUpper ? 0.42 : -0.42) * anteriorMask * crownMask;

      // 2. Premolar & Canine transverse arch rounding/expansion
      const premolarMask =
        smoothstep(-38, -26, y) * (1.0 - smoothstep(-18, -6, y)) * smoothstep(8, 18, Math.abs(x));
      dx += Math.sign(x) * 0.88 * premolarMask * crownMask;
    } else if (preset === 'arch_expansion') {
      // Transverse arch expansion across premolars and molars (+X/-X outward)
      const posteriorLateralMask = smoothstep(-36, -12, y) * smoothstep(10, 24, Math.abs(x));
      dx += Math.sign(x) * 1.32 * posteriorLateralMask * crownMask;
      // Mild anterior leveling
      const antMask = 1.0 - smoothstep(-38, -24, y);
      dy += 0.45 * antMask * crownMask;
    } else if (preset === 'occlusal_wear') {
      // Occlusal attrition on cusp tips & incisal edges (loss of vertical height)
      const occlusalTipMask = isUpper
        ? 1.0 - smoothstep(0.5, 5.5, z)
        : 1.0 - smoothstep(0.5, 5.5, -z);
      const cuspWave = 0.65 + 0.35 * Math.cos(x * 0.45) * Math.cos(y * 0.35);
      dz += (isUpper ? 0.95 : -0.95) * occlusalTipMask * cuspWave;

      // Mild cervical gingival recession mid-arch
      const cervicalMask = isUpper
        ? smoothstep(4.5, 8.5, z) * (1.0 - smoothstep(9.0, 13.0, z))
        : smoothstep(4.0, 8.0, -z) * (1.0 - smoothstep(8.5, 12.5, -z));
      const radialSignX = Math.abs(x) > 2 ? Math.sign(x) : 0;
      dx -= radialSignX * 0.52 * cervicalMask;
    }

    arr[idx] = x + dx;
    arr[idx + 1] = y + dy;
    arr[idx + 2] = z + dz;
  }

  cloned.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  cloned.computeVertexNormals();
  cloned.computeBoundingBox();
  return cloned;
}

/**
 * Computes per-vertex signed surface deviation (in mm) from a reference mesh (`refPositions`, `refNormals`)
 * to a target comparison mesh (`targetPositions`) using a 3D spatial hash grid.
 */
export function computeMeshSignedDeviations(
  refPositions: ArrayLike<number>,
  refNormals: ArrayLike<number> | null | undefined,
  targetPositions: ArrayLike<number>,
  options?: {
    autoAlignCentroids?: boolean;
    offsetMm?: Point3D;
    cellSizeMm?: number;
  }
): Float32Array {
  const refCount = Math.floor(refPositions.length / 3);
  const targetCount = Math.floor(targetPositions.length / 3);
  const deviations = new Float32Array(refCount);

  if (refCount === 0 || targetCount === 0) {
    return deviations;
  }

  const offsetX = options?.offsetMm?.x || 0;
  const offsetY = options?.offsetMm?.y || 0;
  const offsetZ = options?.offsetMm?.z || 0;

  let alignX = offsetX;
  let alignY = offsetY;
  let alignZ = offsetZ;

  if (options?.autoAlignCentroids) {
    const cRef = computePositionsCentroid(refPositions);
    const cTgt = computePositionsCentroid(targetPositions);
    alignX += cRef.x - cTgt.x;
    alignY += cRef.y - cTgt.y;
    alignZ += cRef.z - cTgt.z;
  }

  // Subsample target vertices if target mesh is very dense to guarantee < 10ms interactive performance
  const maxTargetSamples = 9000;
  const stride = Math.max(1, Math.floor(targetCount / maxTargetSamples));
  const sampleCount = Math.ceil(targetCount / stride);

  const tgtX = new Float32Array(sampleCount);
  const tgtY = new Float32Array(sampleCount);
  const tgtZ = new Float32Array(sampleCount);

  const cellSize = Math.max(1.0, options?.cellSizeMm || 3.5);
  const invCell = 1.0 / cellSize;

  // Spatial hash map: key -> array of sample indices
  const grid = new Map<string, number[]>();

  let sIdx = 0;
  for (let i = 0; i < targetCount && sIdx < sampleCount; i += stride) {
    const base = i * 3;
    const tx = targetPositions[base] + alignX;
    const ty = targetPositions[base + 1] + alignY;
    const tz = targetPositions[base + 2] + alignZ;

    tgtX[sIdx] = tx;
    tgtY[sIdx] = ty;
    tgtZ[sIdx] = tz;

    const gx = Math.floor(tx * invCell);
    const gy = Math.floor(ty * invCell);
    const gz = Math.floor(tz * invCell);
    const key = `${gx},${gy},${gz}`;

    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(sIdx);
    sIdx++;
  }

  const actualSamples = sIdx;
  const coarseStep = Math.max(1, Math.floor(actualSamples / 400));

  for (let i = 0; i < refCount; i++) {
    const idx = i * 3;
    const px = refPositions[idx];
    const py = refPositions[idx + 1];
    const pz = refPositions[idx + 2];

    const gx = Math.floor(px * invCell);
    const gy = Math.floor(py * invCell);
    const gz = Math.floor(pz * invCell);

    let bestDistSq = Infinity;
    let bestDx = 0;
    let bestDy = 0;
    let bestDz = 0;

    // 1. Check homologous vertex index first if vertex counts match (O(1) exact upper bound)
    if (refCount === targetCount) {
      const hx = targetPositions[idx] + alignX - px;
      const hy = targetPositions[idx + 1] + alignY - py;
      const hz = targetPositions[idx + 2] + alignZ - pz;
      bestDistSq = hx * hx + hy * hy + hz * hz;
      bestDx = hx;
      bestDy = hy;
      bestDz = hz;
    }

    // 2. Search 3x3x3 neighborhood cells in spatial hash grid
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const bucket = grid.get(`${gx + dx},${gy + dy},${gz + dz}`);
          if (!bucket) continue;
          for (let k = 0; k < bucket.length; k++) {
            const j = bucket[k];
            const vx = tgtX[j] - px;
            const vy = tgtY[j] - py;
            const vz = tgtZ[j] - pz;
            const dSq = vx * vx + vy * vy + vz * vz;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestDx = vx;
              bestDy = vy;
              bestDz = vz;
            }
          }
        }
      }
    }

    // 3. Fallback coarse search if no neighbor was found in local 3x3x3 neighborhood
    if (!Number.isFinite(bestDistSq)) {
      for (let j = 0; j < actualSamples; j += coarseStep) {
        const vx = tgtX[j] - px;
        const vy = tgtY[j] - py;
        const vz = tgtZ[j] - pz;
        const dSq = vx * vx + vy * vy + vz * vz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestDx = vx;
          bestDy = vy;
          bestDz = vz;
        }
      }
    }

    const dist = Math.sqrt(Math.max(0, bestDistSq));
    if (dist < 1e-5) {
      deviations[i] = 0;
      continue;
    }

    // Determine outward normal for signed distance (+ = outward expansion, - = inward contraction/wear)
    let nx = 0;
    let ny = 0;
    let nz = 0;
    if (refNormals && refNormals.length >= idx + 3) {
      nx = refNormals[idx];
      ny = refNormals[idx + 1];
      nz = refNormals[idx + 2];
    } else {
      // Fallback outward radial direction from arch center (0, -18, 0)
      const rx = px;
      const ry = py + 18;
      const rz = pz;
      const rLen = Math.hypot(rx, ry, rz) || 1;
      nx = rx / rLen;
      ny = ry / rLen;
      nz = rz / rLen;
    }

    const dot = bestDx * nx + bestDy * ny + bestDz * nz;
    deviations[i] = dot >= 0 ? dist : -dist;
  }

  return deviations;
}

/**
 * Computes comprehensive clinical 3D deviation metrics from upper & lower deviation arrays.
 */
export function computeModelDiffStatsFromDeviations(
  upperDeviations: ArrayLike<number>,
  lowerDeviations: ArrayLike<number>,
  toleranceMm = 0.2
): ModelDiffStats {
  const tol = Math.max(0.01, toleranceMm);

  const calcArchRmsd = (arr: ArrayLike<number>): number => {
    if (arr.length === 0) return 0;
    let sq = 0;
    for (let i = 0; i < arr.length; i++) {
      const d = arr[i];
      sq += d * d;
    }
    return Math.sqrt(sq / arr.length);
  };

  const upperRmsd = calcArchRmsd(upperDeviations);
  const lowerRmsd = calcArchRmsd(lowerDeviations);

  const totalCount = upperDeviations.length + lowerDeviations.length;
  if (totalCount === 0) {
    return {
      ...DEFAULT_MODEL_DIFF_STATS,
      comparedVertexCount: 0,
    };
  }

  let sumSq = 0;
  let sumAbs = 0;
  let sumSigned = 0;
  let maxPos = 0;
  let maxNeg = 0;
  let inTolCount = 0;
  let posCount = 0;
  let negCount = 0;

  const processArray = (arr: ArrayLike<number>) => {
    for (let i = 0; i < arr.length; i++) {
      const d = arr[i];
      if (!Number.isFinite(d)) continue;
      sumSq += d * d;
      sumAbs += Math.abs(d);
      sumSigned += d;

      if (d > maxPos) maxPos = d;
      if (d < maxNeg) maxNeg = d;

      if (Math.abs(d) <= tol) {
        inTolCount++;
      } else if (d > tol) {
        posCount++;
      } else {
        negCount++;
      }
    }
  };

  processArray(upperDeviations);
  processArray(lowerDeviations);

  const rmsd = Math.sqrt(sumSq / totalCount);
  const meanAbs = sumAbs / totalCount;
  const signedMean = sumSigned / totalCount;

  return {
    rmsdMm: Number(rmsd.toFixed(2)),
    meanAbsDiffMm: Number(meanAbs.toFixed(2)),
    signedMeanDiffMm: Number(signedMean.toFixed(2)),
    maxPositiveMm: Number(maxPos.toFixed(2)),
    maxNegativeMm: Number(maxNeg.toFixed(2)),
    inTolerancePercent: Number(((inTolCount / totalCount) * 100).toFixed(1)),
    positivePercent: Number(((posCount / totalCount) * 100).toFixed(1)),
    negativePercent: Number(((negCount / totalCount) * 100).toFixed(1)),
    upperRmsdMm: Number(upperRmsd.toFixed(2)),
    lowerRmsdMm: Number(lowerRmsd.toFixed(2)),
    comparedVertexCount: totalCount,
  };
}

/**
 * Applies per-vertex signed deviation heatmap colors to a Three.js BufferGeometry
 * while preserving the original vertex colors in `origColor` so they can be restored cleanly.
 */
export function applyDiffHeatmapColorsToGeometry(
  geom: THREE.BufferGeometry,
  signedDeviations: ArrayLike<number>,
  maxRangeMm = 1.5,
  toleranceMm = 0.2
): void {
  const posAttr = geom.getAttribute('position');
  if (!posAttr) return;

  // Backup original vertex colors once before overwriting 'color'
  if (!geom.getAttribute('origColor') && geom.getAttribute('color')) {
    geom.setAttribute('origColor', geom.getAttribute('color').clone());
    geom.userData.hadOrigColor = true;
  } else if (geom.userData.hadOrigColor === undefined) {
    geom.userData.hadOrigColor = false;
  }

  const count = posAttr.count;
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const d = i < signedDeviations.length ? signedDeviations[i] : 0;
    const [r, g, b] = deviationToDiffRGB(d, maxRangeMm, toleranceMm);
    const idx = i * 3;
    colors[idx] = r;
    colors[idx + 1] = g;
    colors[idx + 2] = b;
  }

  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

/**
 * Restores the original vertex colors on a BufferGeometry after turning off the 3D Diff heatmap.
 */
export function restoreOriginalColorsOnGeometry(geom: THREE.BufferGeometry): void {
  if (geom.userData.hadOrigColor === undefined) return;

  const orig = geom.getAttribute('origColor');
  if (geom.userData.hadOrigColor && orig) {
    geom.setAttribute('color', orig.clone());
  } else if (geom.userData.hadOrigColor === false) {
    geom.deleteAttribute('color');
  }
}
