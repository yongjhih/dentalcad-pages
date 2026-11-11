import {
  ArticulatorSettings,
  ArticulationCurvePresetId,
  BezierControlPoints,
  Point3D,
} from '../types/dental';

export interface ArticulationCurvePreset {
  id: ArticulationCurvePresetId;
  name: string;
  description: string;
  bezier: BezierControlPoints;
  condylarGuidanceAngleDeg?: number;
  incisalGuidanceAngleDeg?: number;
}

export const ARTICULATION_CURVE_PRESETS: Record<
  Exclude<ArticulationCurvePresetId, 'custom'>,
  ArticulationCurvePreset
> = {
  posselt: {
    id: 'posselt',
    name: 'Posselt 生理雙相曲線',
    description: '初段 (0–40%) 以雙側髁頭純樞軸旋轉為主，中後段耦合關節結節前下滑動 (TMJ 生理開合)。',
    bezier: { p1x: 0.42, p1y: 0.12, p2x: 0.68, p2y: 0.88 },
    condylarGuidanceAngleDeg: 33,
    incisalGuidanceAngleDeg: 40,
  },
  pure_hinge: {
    id: 'pure_hinge',
    name: '純樞軸定軸旋轉 (Pure Hinge)',
    description: '模擬全可調咬合器固定樞軸開合，僅繞雙側髁頭連線旋轉而不產生前下滑動。',
    bezier: { p1x: 0.85, p1y: 0.02, p2x: 0.95, p2y: 0.15 },
    condylarGuidanceAngleDeg: 25,
    incisalGuidanceAngleDeg: 30,
  },
  early_translation: {
    id: 'early_translation',
    name: '早期髁頭滑動 (Early Translation)',
    description: '張口初期即伴隨明顯的下顎前下移位，常見於關節窩較淺或韌帶鬆弛型態。',
    bezier: { p1x: 0.12, p1y: 0.58, p2x: 0.38, p2y: 0.94 },
    condylarGuidanceAngleDeg: 28,
    incisalGuidanceAngleDeg: 32,
  },
  steep_guidance: {
    id: 'steep_guidance',
    name: '深咬陡峭切導 (Steep Guidance)',
    description: '前牙覆咬較深，前突與開合初期需較陡峭之垂直打開角度以避開切端干擾。',
    bezier: { p1x: 0.25, p1y: 0.05, p2x: 0.5, p2y: 0.96 },
    condylarGuidanceAngleDeg: 45,
    incisalGuidanceAngleDeg: 55,
  },
};

/**
 * In STL model coordinates:
 * - Anterior (Incisors / 前牙切端) is at Y ≈ -43.5 mm (-Y direction)
 * - Posterior (Molars / 後牙大臼齒) is at Y ≈ +5 to +10.7 mm (+Y direction)
 * - Therefore, the TMJ Intercondylar Hinge Axis is posterior to the molars at Y = +42 mm, Z = +28 mm
 */
export const DEFAULT_ARTICULATOR_SETTINGS: ArticulatorSettings = {
  mode: 'hinge',
  progress: 0,
  isPlaying: false,
  playbackSpeed: 1.0,
  maxOpeningAngleDeg: 22,
  condylarGuidanceAngleDeg: 33,
  incisalGuidanceAngleDeg: 40,
  bennettAngleDeg: 15,
  hingeAxisY: 42,
  hingeAxisZ: 28,
  showTrajectoryGizmo: true,
  curvePresetId: 'posselt',
  bezier: { ...ARTICULATION_CURVE_PRESETS.posselt.bezier },
};

export const DEFAULT_INCISAL_REF_POINT: Point3D = {
  x: 0,
  y: -43.5,
  z: 0.5,
};

export interface MandibularKinematicsResult {
  upperPosition: Point3D;
  upperRotation: Point3D;
  lowerPosition: Point3D;
  lowerRotation: Point3D;
  /** 16-element column-major 4x4 transformation matrix for lower arch */
  lowerMatrixElements: number[];
  /** 16-element column-major 4x4 inverse matrix for lower arch */
  lowerInverseMatrixElements: number[];
  /** Pivot center in model coordinates */
  hingePivot: Point3D;
  /** Left & Right TMJ condyle world positions */
  condyleLeftWorld: Point3D;
  condyleRightWorld: Point3D;
  /** Transformed lower central incisor position in world coordinates */
  incisalWorldPoint: Point3D;
  /** Displacement vector of the lower central incisor from Centric Occlusion (mm) */
  incisalDisplacementMm: Point3D;
  /** Total Euclidean opening distance at the incisors (mm) */
  incisalOpeningMm: number;
  /** Current sagittal opening rotation angle (degrees) */
  rotationAngleDeg: number;
  /** Current condylar translation distance along the eminence (mm) */
  condylarTranslationMm: number;
  /** Current lateral shift at the incisors (mm) */
  lateralShiftMm: number;
  /** Evaluated Bezier curve point (bx, by) at current progress */
  bezierPoint: { x: number; y: number };
}

export interface TrajectorySamplePoint {
  t: number;
  incisalWorld: Point3D;
  condyleWorld: Point3D;
  rotationAngleDeg: number;
  condylarTranslationMm: number;
  bezierX: number;
  bezierY: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Evaluate 1D Cubic Bezier with endpoints P0=0 and P3=1:
 * B(s) = 3*(1-s)^2*s*p1 + 3*(1-s)*s^2*p2 + s^3
 */
export function evaluateCubicBezier1D(s: number, p1: number, p2: number): number {
  const u = clamp(s, 0, 1);
  const inv = 1 - u;
  return 3 * inv * inv * u * p1 + 3 * inv * u * u * p2 + u * u * u;
}

/**
 * Evaluate 2D Cubic Bezier from (0,0) to (1,1) at parameter s in [0,1]
 */
export function evaluateCubicBezier2D(
  s: number,
  bezier: BezierControlPoints
): { x: number; y: number } {
  return {
    x: evaluateCubicBezier1D(s, clamp(bezier.p1x, 0, 1), clamp(bezier.p2x, 0, 1)),
    y: evaluateCubicBezier1D(s, clamp(bezier.p1y, 0, 1), clamp(bezier.p2y, 0, 1)),
  };
}

/**
 * Solve for y(x) on the 2D Cubic Bezier curve given horizontal progress x in [0,1]
 * using binary search over parameter s in [0,1].
 */
export function evaluateBezierYForProgress(
  progressX: number,
  bezier: BezierControlPoints
): number {
  const targetX = clamp(progressX, 0, 1);
  if (targetX <= 0) return 0;
  if (targetX >= 1) return 1;

  let low = 0;
  let high = 1;
  let mid = targetX;
  for (let i = 0; i < 14; i++) {
    mid = 0.5 * (low + high);
    const xVal = evaluateCubicBezier1D(mid, clamp(bezier.p1x, 0, 1), clamp(bezier.p2x, 0, 1));
    if (xVal < targetX) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return evaluateCubicBezier1D(mid, clamp(bezier.p1y, 0, 1), clamp(bezier.p2y, 0, 1));
}

/**
 * Build a column-major 4x4 matrix from Euler XYZ angles (radians) and translation (tx, ty, tz)
 */
function composeMatrix4EulerXYZ(
  rx: number,
  ry: number,
  rz: number,
  tx: number,
  ty: number,
  tz: number
): number[] {
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);

  // R = Rx * Ry * Rz (Three.js default 'XYZ' Euler order)
  const m00 = cy * cz;
  const m01 = -cy * sz;
  const m02 = sy;

  const m10 = sx * sy * cz + cx * sz;
  const m11 = -sx * sy * sz + cx * cz;
  const m12 = -sx * cy;

  const m20 = -cx * sy * cz + sx * sz;
  const m21 = cx * sy * sz + sx * cz;
  const m22 = cx * cy;

  return [
    m00, m10, m20, 0,
    m01, m11, m21, 0,
    m02, m12, m22, 0,
    tx,  ty,  tz,  1,
  ];
}

/**
 * Compute inverse of a rigid-body 4x4 transformation matrix (R^T and -R^T * t)
 */
export function invertRigidMatrix4(m: number[]): number[] {
  const r00 = m[0], r01 = m[1], r02 = m[2];
  const r10 = m[4], r11 = m[5], r12 = m[6];
  const r20 = m[8], r21 = m[9], r22 = m[10];

  const tx = m[12], ty = m[13], tz = m[14];

  const itx = -(r00 * tx + r01 * ty + r02 * tz);
  const ity = -(r10 * tx + r11 * ty + r12 * tz);
  const itz = -(r20 * tx + r21 * ty + r22 * tz);

  return [
    r00, r10, r20, 0,
    r01, r11, r21, 0,
    r02, r12, r22, 0,
    itx, ity, itz, 1,
  ];
}

/**
 * Transform a 3D point by a column-major 4x4 matrix
 */
export function transformPoint3DByMatrix4(p: Point3D, m: number[]): Point3D {
  return {
    x: m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
    y: m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
    z: m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14],
  };
}

/**
 * Compute full 6-DOF mandibular articulation kinematics at the current progress
 * based on anatomical TMJ parameters and the user-adjustable Bezier movement curve.
 *
 * Coordinate convention of the STL models:
 * - X: Patient Right (-X) to Patient Left (+X)
 * - Y: Anterior / Incisors (-Y, ~ -43.5 mm) to Posterior / Molars (+Y, ~ +10 mm) & TMJ (+Y, ~ +42 mm)
 * - Z: Inferior (-Z) to Superior (+Z)
 */
export function computeMandibularKinematics(
  settings: ArticulatorSettings,
  incisalRefPoint: Point3D = DEFAULT_INCISAL_REF_POINT
): MandibularKinematicsResult {
  const t = clamp(settings.progress, 0, 1);
  const bezierEval = evaluateCubicBezier2D(t, settings.bezier);
  const curveFactor = evaluateBezierYForProgress(t, settings.bezier);

  const pivot: Point3D = {
    x: 0,
    y: settings.hingeAxisY,
    z: settings.hingeAxisZ,
  };

  const condylarRad = (settings.condylarGuidanceAngleDeg * Math.PI) / 180;
  const incisalRad = (settings.incisalGuidanceAngleDeg * Math.PI) / 180;
  const bennettRad = (settings.bennettAngleDeg * Math.PI) / 180;

  let upperPos: Point3D = { x: 0, y: 0, z: 0 };
  const upperRot: Point3D = { x: 0, y: 0, z: 0 };

  let rx = 0; // Sagittal opening rotation around +X (positive rx opens anterior -Y incisors downward in -Z)
  let ry = 0; // Frontal roll around Y axis
  let rz = 0; // Horizontal yaw around Z axis
  let condyleShift: Point3D = { x: 0, y: 0, z: 0 };
  let condylarTranslationMm = 0;

  if (settings.mode === 'parallel') {
    const totalSep = curveFactor * 35;
    upperPos = { x: 0, y: 0, z: totalSep * 0.5 };
    const lowerPos: Point3D = { x: 0, y: 0, z: -totalSep * 0.5 };
    const mat = composeMatrix4EulerXYZ(0, 0, 0, lowerPos.x, lowerPos.y, lowerPos.z);
    const invMat = invertRigidMatrix4(mat);
    const incisalWorld = transformPoint3DByMatrix4(incisalRefPoint, mat);
    const disp = {
      x: incisalWorld.x - incisalRefPoint.x,
      y: incisalWorld.y - incisalRefPoint.y,
      z: incisalWorld.z - incisalRefPoint.z - upperPos.z,
    };
    return {
      upperPosition: upperPos,
      upperRotation: upperRot,
      lowerPosition: lowerPos,
      lowerRotation: { x: 0, y: 0, z: 0 },
      lowerMatrixElements: mat,
      lowerInverseMatrixElements: invMat,
      hingePivot: pivot,
      condyleLeftWorld: { x: 50, y: pivot.y, z: pivot.z + lowerPos.z },
      condyleRightWorld: { x: -50, y: pivot.y, z: pivot.z + lowerPos.z },
      incisalWorldPoint: incisalWorld,
      incisalDisplacementMm: disp,
      incisalOpeningMm: Math.hypot(disp.x, disp.y, disp.z),
      rotationAngleDeg: 0,
      condylarTranslationMm: 0,
      lateralShiftMm: 0,
      bezierPoint: bezierEval,
    };
  }

  if (settings.mode === 'hinge') {
    // Anatomical two-phase TMJ opening:
    // Phase 1: Hinge rotation around posterior intercondylar axis (Y = +42, Z = +28)
    // Phase 2: Anterior (-Y) and Inferior (-Z) condylar translation along the Articular Eminence
    const rotBlend = 0.55 * t + 0.45 * curveFactor;
    const thetaDeg = rotBlend * settings.maxOpeningAngleDeg;
    rx = +(thetaDeg * Math.PI) / 180;

    const maxTransMm = 11.0 * clamp(1 - settings.bezier.p1x * 0.5, 0.25, 1.2);
    condylarTranslationMm = curveFactor * maxTransMm;
    condyleShift = {
      x: 0,
      y: -condylarTranslationMm * Math.cos(condylarRad), // Anterior is -Y
      z: -condylarTranslationMm * Math.sin(condylarRad), // Inferior is -Z
    };
  } else if (settings.mode === 'protrusion') {
    // Protrusive excursion: mandible slides anteriorly (-Y up to 8.5 mm) and inferiorly (-Z)
    const maxProtrusionMm = 8.5;
    const forwardMm = curveFactor * maxProtrusionMm;
    const verticalDropMm = forwardMm * Math.tan(incisalRad * 0.55 + condylarRad * 0.45);
    condylarTranslationMm = Math.hypot(forwardMm, verticalDropMm);

    const clearanceDeg = Math.sin(t * Math.PI) * 2.2 + curveFactor * 2.0;
    rx = +(clearanceDeg * Math.PI) / 180;

    condyleShift = {
      x: 0,
      y: -forwardMm, // Anterior is -Y
      z: -verticalDropMm * 0.65,
    };
  } else if (settings.mode === 'lateral_left' || settings.mode === 'lateral_right') {
    // Lateral excursion: +X is Patient Left, -X is Patient Right
    const dir = settings.mode === 'lateral_left' ? 1 : -1;
    const maxYawDeg = 6.5;
    const yawDeg = curveFactor * maxYawDeg;
    rz = dir * ((yawDeg * Math.PI) / 180);

    const canineRiseDeg = curveFactor * (2.5 + settings.incisalGuidanceAngleDeg * 0.06);
    rx = +(canineRiseDeg * Math.PI) / 180;
    ry = -dir * ((curveFactor * 1.8 * Math.PI) / 180);

    const bennettShiftMm = curveFactor * 3.8;
    condylarTranslationMm = bennettShiftMm;
    condyleShift = {
      x: dir * bennettShiftMm * Math.sin(bennettRad),
      y: -bennettShiftMm * Math.cos(condylarRad) * 0.6, // Anterior is -Y
      z: -bennettShiftMm * Math.sin(condylarRad) * 0.6,
    };
  } else if (settings.mode === 'chewing') {
    // Mastication Tear-drop Loop (Posselt chewing envelope)
    const phaseAngle = t * Math.PI * 2;
    const openEnv = Math.pow(Math.sin(t * Math.PI), 0.85) * (0.65 + 0.35 * curveFactor);
    const lateralEnv = Math.sin(phaseAngle - 0.55) * Math.sin(t * Math.PI);

    const thetaDeg = openEnv * (settings.maxOpeningAngleDeg * 0.75);
    rx = +(thetaDeg * Math.PI) / 180;
    rz = ((lateralEnv * 4.2) * Math.PI) / 180;
    ry = -((lateralEnv * 1.4) * Math.PI) / 180;

    condylarTranslationMm = openEnv * 6.5;
    condyleShift = {
      x: lateralEnv * 2.4 * Math.cos(bennettRad),
      y: -condylarTranslationMm * Math.cos(condylarRad), // Anterior is -Y
      z: -condylarTranslationMm * Math.sin(condylarRad),
    };
  }

  // Rigid body translation T so mandible rotates around posterior `pivot` and translates by `condyleShift`
  const rotOnlyMat = composeMatrix4EulerXYZ(rx, ry, rz, 0, 0, 0);
  const rotatedPivot = transformPoint3DByMatrix4(pivot, rotOnlyMat);

  const lowerPos: Point3D = {
    x: pivot.x - rotatedPivot.x + condyleShift.x,
    y: pivot.y - rotatedPivot.y + condyleShift.y,
    z: pivot.z - rotatedPivot.z + condyleShift.z,
  };

  const fullMat = composeMatrix4EulerXYZ(rx, ry, rz, lowerPos.x, lowerPos.y, lowerPos.z);
  const invMat = invertRigidMatrix4(fullMat);

  const incisalWorld = transformPoint3DByMatrix4(incisalRefPoint, fullMat);
  const condyleLeftWorld = transformPoint3DByMatrix4({ x: 50, y: pivot.y, z: pivot.z }, fullMat);
  const condyleRightWorld = transformPoint3DByMatrix4({ x: -50, y: pivot.y, z: pivot.z }, fullMat);

  const disp: Point3D = {
    x: incisalWorld.x - incisalRefPoint.x,
    y: incisalWorld.y - incisalRefPoint.y,
    z: incisalWorld.z - incisalRefPoint.z,
  };

  return {
    upperPosition: upperPos,
    upperRotation: upperRot,
    lowerPosition: lowerPos,
    lowerRotation: { x: rx, y: ry, z: rz },
    lowerMatrixElements: fullMat,
    lowerInverseMatrixElements: invMat,
    hingePivot: pivot,
    condyleLeftWorld,
    condyleRightWorld,
    incisalWorldPoint: incisalWorld,
    incisalDisplacementMm: disp,
    incisalOpeningMm: Math.hypot(disp.x, disp.y, disp.z),
    rotationAngleDeg: Number(((rx * 180) / Math.PI).toFixed(2)),
    condylarTranslationMm: Number(condylarTranslationMm.toFixed(2)),
    lateralShiftMm: Number(disp.x.toFixed(2)),
    bezierPoint: bezierEval,
  };
}

/**
 * Sample the 3D mandibular incisal and condylar trajectories across t in [0, 1]
 */
export function sampleArticulationTrajectory(
  settings: ArticulatorSettings,
  steps = 40,
  incisalRefPoint: Point3D = DEFAULT_INCISAL_REF_POINT
): TrajectorySamplePoint[] {
  const count = Math.max(2, steps);
  const samples: TrajectorySamplePoint[] = [];

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const kin = computeMandibularKinematics(
      {
        ...settings,
        progress: t,
      },
      incisalRefPoint
    );
    samples.push({
      t,
      incisalWorld: kin.incisalWorldPoint,
      condyleWorld: {
        x: 0.5 * (kin.condyleLeftWorld.x + kin.condyleRightWorld.x),
        y: 0.5 * (kin.condyleLeftWorld.y + kin.condyleRightWorld.y),
        z: 0.5 * (kin.condyleLeftWorld.z + kin.condyleRightWorld.z),
      },
      rotationAngleDeg: kin.rotationAngleDeg,
      condylarTranslationMm: kin.condylarTranslationMm,
      bezierX: kin.bezierPoint.x,
      bezierY: kin.bezierPoint.y,
    });
  }

  return samples;
}
