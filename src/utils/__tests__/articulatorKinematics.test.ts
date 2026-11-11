import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ARTICULATOR_SETTINGS,
  ARTICULATION_CURVE_PRESETS,
  evaluateCubicBezier1D,
  evaluateCubicBezier2D,
  evaluateBezierYForProgress,
  invertRigidMatrix4,
  transformPoint3DByMatrix4,
  computeMandibularKinematics,
  sampleArticulationTrajectory,
} from '../articulatorKinematics';

describe('articulatorKinematics', () => {
  describe('Cubic Bezier Curve Evaluation', () => {
    it('evaluates endpoints t=0 as (0,0) and t=1 as (1,1)', () => {
      const p0 = evaluateCubicBezier2D(0, DEFAULT_ARTICULATOR_SETTINGS.bezier);
      const p1 = evaluateCubicBezier2D(1, DEFAULT_ARTICULATOR_SETTINGS.bezier);
      expect(p0.x).toBeCloseTo(0, 5);
      expect(p0.y).toBeCloseTo(0, 5);
      expect(p1.x).toBeCloseTo(1, 5);
      expect(p1.y).toBeCloseTo(1, 5);
    });

    it('matches linear identity y = x when control points lie on the diagonal', () => {
      const linearBezier = { p1x: 0.33, p1y: 0.33, p2x: 0.67, p2y: 0.67 };
      expect(evaluateCubicBezier1D(0.5, 0.33, 0.67)).toBeCloseTo(0.5, 2);
      expect(evaluateBezierYForProgress(0.25, linearBezier)).toBeCloseTo(0.25, 2);
      expect(evaluateBezierYForProgress(0.75, linearBezier)).toBeCloseTo(0.75, 2);
    });

    it('produces distinct non-linear response between Pure Hinge and Early Translation presets', () => {
      const pureHingeY = evaluateBezierYForProgress(
        0.35,
        ARTICULATION_CURVE_PRESETS.pure_hinge.bezier
      );
      const earlyTransY = evaluateBezierYForProgress(
        0.35,
        ARTICULATION_CURVE_PRESETS.early_translation.bezier
      );
      expect(earlyTransY).toBeGreaterThan(pureHingeY + 0.3);
    });
  });

  describe('Rigid 4x4 Matrix Inversion & Point Transformation', () => {
    it('accurately inverts a 6-DOF mandibular transformation matrix', () => {
      const kin = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'lateral_left',
        progress: 0.65,
      });

      const originalPt = { x: 14.2, y: -18.5, z: -2.1 };
      const worldPt = transformPoint3DByMatrix4(originalPt, kin.lowerMatrixElements);
      const recoveredPt = transformPoint3DByMatrix4(
        worldPt,
        kin.lowerInverseMatrixElements
      );

      expect(recoveredPt.x).toBeCloseTo(originalPt.x, 4);
      expect(recoveredPt.y).toBeCloseTo(originalPt.y, 4);
      expect(recoveredPt.z).toBeCloseTo(originalPt.z, 4);

      const doubleInverted = invertRigidMatrix4(kin.lowerInverseMatrixElements);
      for (let i = 0; i < 16; i++) {
        expect(doubleInverted[i]).toBeCloseTo(kin.lowerMatrixElements[i], 4);
      }
    });
  });

  describe('6-DOF Mandibular Kinematics Modes', () => {
    it('places the TMJ hinge axis posterior (+Y) to the molars and incisal point anterior (-Y)', () => {
      expect(DEFAULT_ARTICULATOR_SETTINGS.hingeAxisY).toBeGreaterThan(20);
      const kin = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'hinge',
        progress: 0,
      });
      expect(kin.hingePivot.y).toBeGreaterThan(20);
      expect(kin.incisalWorldPoint.y).toBeLessThan(-35);
      expect(kin.incisalOpeningMm).toBeCloseTo(0, 4);
    });

    it('simulates anatomical TMJ hinge rotation + condylar slip (non-parallel opening)', () => {
      const kin = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'hinge',
        progress: 0.75,
      });

      // Upper arch remains fixed to cranium in anatomical hinge mode
      expect(kin.upperPosition.z).toBe(0);
      // Lower arch rotates around posterior X-axis (positive rx opens anterior -Y incisors downward in -Z)
      expect(kin.rotationAngleDeg).toBeGreaterThan(10);
      expect(kin.lowerRotation.x).toBeGreaterThan(0);
      // Anterior incisor moves downward (-Z) AND along an arc in Y
      expect(kin.incisalDisplacementMm.z).toBeLessThan(-15);
      expect(Math.abs(kin.incisalDisplacementMm.y)).toBeGreaterThan(0.5);
      expect(kin.condylarTranslationMm).toBeGreaterThan(2);
    });

    it('changes the incisal and condylar path when user adjusts the Bezier curve or Condylar Guidance Angle', () => {
      const shallowCondyle = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'hinge',
        progress: 0.6,
        condylarGuidanceAngleDeg: 15,
        bezier: { p1x: 0.2, p1y: 0.7, p2x: 0.5, p2y: 0.9 },
      });

      const steepCondyle = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'hinge',
        progress: 0.6,
        condylarGuidanceAngleDeg: 55,
        bezier: { p1x: 0.8, p1y: 0.1, p2x: 0.9, p2y: 0.2 },
      });

      expect(shallowCondyle.condylarTranslationMm).toBeGreaterThan(
        steepCondyle.condylarTranslationMm
      );
      expect(shallowCondyle.incisalWorldPoint.y).not.toBeCloseTo(
        steepCondyle.incisalWorldPoint.y,
        1
      );
    });

    it('simulates anterior protrusion in the -Y (Anterior) and -Z (Inferior) direction', () => {
      const kin = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'protrusion',
        progress: 0.8,
      });

      // Mandible translates anteriorly (-Y) and inferiorly (-Z)
      expect(kin.incisalDisplacementMm.y).toBeLessThan(-3.0);
      expect(kin.incisalDisplacementMm.z).toBeLessThan(-1.5);
      expect(kin.incisalDisplacementMm.x).toBeCloseTo(0, 3);
    });

    it('simulates symmetric Left (+X) and Right (-X) lateral Bennett excursions', () => {
      const leftKin = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'lateral_left',
        progress: 0.8,
      });
      const rightKin = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'lateral_right',
        progress: 0.8,
      });

      expect(leftKin.lateralShiftMm).toBeGreaterThan(2.0);
      expect(rightKin.lateralShiftMm).toBeLessThan(-2.0);
      expect(Math.abs(leftKin.lateralShiftMm)).toBeCloseTo(
        Math.abs(rightKin.lateralShiftMm),
        2
      );
    });

    it('simulates a closed tear-drop chewing cycle returning to MIP at t=1', () => {
      const startKin = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'chewing',
        progress: 0,
      });
      const midKin = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'chewing',
        progress: 0.45,
      });
      const endKin = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'chewing',
        progress: 1,
      });

      expect(startKin.incisalOpeningMm).toBeCloseTo(0, 3);
      expect(midKin.incisalOpeningMm).toBeGreaterThan(10);
      expect(Math.abs(midKin.lateralShiftMm)).toBeGreaterThan(0.5);
      expect(endKin.incisalOpeningMm).toBeCloseTo(0, 3);
    });

    it('supports classic parallel vertical Z separation without rotation', () => {
      const kin = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'parallel',
        progress: 1,
      });

      expect(kin.rotationAngleDeg).toBe(0);
      expect(kin.upperPosition.z).toBeCloseTo(17.5, 2);
      expect(kin.lowerPosition.z).toBeCloseTo(-17.5, 2);
    });
  });

  describe('Trajectory Sampling', () => {
    it('samples a continuous 3D trajectory across [0, 1]', () => {
      const samples = sampleArticulationTrajectory(DEFAULT_ARTICULATOR_SETTINGS, 20);
      expect(samples).toHaveLength(21);
      expect(samples[0].t).toBe(0);
      expect(samples[20].t).toBe(1);
      expect(samples[20].incisalWorld.z).toBeLessThan(samples[0].incisalWorld.z - 15);
    });
  });
});
