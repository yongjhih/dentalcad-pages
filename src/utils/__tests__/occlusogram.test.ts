import { describe, it, expect } from 'vitest';
import {
  clearanceToOcclusogramRGB,
  buildOcclusalElevationMap,
  sampleElevationMapAtXY,
  computeOcclusogramStats,
} from '../occlusogram';
import {
  DEFAULT_ARTICULATOR_SETTINGS,
  computeMandibularKinematics,
} from '../articulatorKinematics';

describe('occlusogram (Bite Contact Heatmap Engine)', () => {
  describe('clearanceToOcclusogramRGB color scale', () => {
    it('returns null when clearance exceeds maxRangeMm', () => {
      expect(clearanceToOcclusogramRGB(2.2, 1.6)).toBeNull();
      expect(clearanceToOcclusogramRGB(Infinity, 1.6)).toBeNull();
    });

    it('maps heavy collision (<= 0.0 mm) to clinical crimson red', () => {
      const rgb = clearanceToOcclusogramRGB(-0.15, 1.6);
      expect(rgb).not.toBeNull();
      expect(rgb![0]).toBeGreaterThan(0.9);
      expect(rgb![1]).toBeLessThan(0.25);
    });

    it('transitions smoothly from Orange (0.25mm) -> Yellow (0.55mm) -> Green (0.95mm) -> Cyan (1.6mm)', () => {
      const orange = clearanceToOcclusogramRGB(0.25, 1.6)!;
      const yellow = clearanceToOcclusogramRGB(0.55, 1.6)!;
      const green = clearanceToOcclusogramRGB(0.95, 1.6)!;
      const cyan = clearanceToOcclusogramRGB(1.55, 1.6)!;

      expect(orange[0]).toBeGreaterThan(0.9);
      expect(yellow[0]).toBeGreaterThan(0.85);
      expect(yellow[1]).toBeGreaterThan(0.65);
      expect(green[1]).toBeGreaterThan(green[0]);
      expect(cyan[2]).toBeGreaterThan(cyan[0]);
    });
  });

  describe('buildOcclusalElevationMap & computeOcclusogramStats', () => {
    // Generate synthetic upper & lower dental arch point clouds with bilateral molar contacts
    function createSyntheticArches() {
      const upperPts: number[] = [];
      const lowerPts: number[] = [];

      // Left side (X in [10, 20]) and Right side (X in [-20, -10]), Y in [-30, -10]
      for (let y = -30; y <= -10; y += 1.0) {
        for (let x = -20; x <= -10; x += 1.0) {
          upperPts.push(x, y, 0.35); // 0.35 mm above Z=0
          lowerPts.push(x, y, 0.0);
        }
        for (let x = 10; x <= 20; x += 1.0) {
          upperPts.push(x, y, 0.12); // Tighter contact on Left side (0.12 mm)
          lowerPts.push(x, y, 0.0);
        }
      }

      // Anterior incisors (X in [-6, 6], Y in [2, 8])
      for (let y = 2; y <= 8; y += 1.0) {
        for (let x = -6; x <= 6; x += 1.0) {
          upperPts.push(x, y, 0.6);
          lowerPts.push(x, y, 0.0);
        }
      }

      const uMap = buildOcclusalElevationMap(new Float32Array(upperPts), null, true);
      const lMap = buildOcclusalElevationMap(new Float32Array(lowerPts), null, false);
      return { uMap, lMap };
    }

    it('samples accurate Z heights from upper and lower elevation maps', () => {
      const { uMap, lMap } = createSyntheticArches();
      const uSample = sampleElevationMapAtXY(uMap, 15, -20);
      const lSample = sampleElevationMapAtXY(lMap, 15, -20);

      expect(uSample).toBeCloseTo(0.12, 2);
      expect(lSample).toBeCloseTo(0.0, 2);
      // Outside arch returns NaN
      expect(Number.isNaN(sampleElevationMapAtXY(uMap, 0, -48))).toBe(true);
    });

    it('computes accurate contact area, min clearance, and L/R balance at Centric Occlusion (t=0)', () => {
      const { uMap, lMap } = createSyntheticArches();
      const closedKin = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        progress: 0,
      });

      const stats = computeOcclusogramStats(uMap, lMap, closedKin, 1.6);
      expect(stats.minClearanceMm).toBeCloseTo(0.12, 2);
      expect(stats.contactAreaMm2).toBeGreaterThan(20);
      expect(stats.heavyCollisionAreaMm2).toBeGreaterThan(5);
      expect(stats.leftContactPercent + stats.rightContactPercent).toBe(100);
      expect(stats.anteriorContactPercent + stats.posteriorContactPercent).toBe(100);
    });

    it('reduces contact area to zero when the mandible opens wide (t=0.8)', () => {
      const { uMap, lMap } = createSyntheticArches();
      const openKin = computeMandibularKinematics({
        ...DEFAULT_ARTICULATOR_SETTINGS,
        mode: 'hinge',
        progress: 0.8,
      });

      const stats = computeOcclusogramStats(uMap, lMap, openKin, 1.6);
      expect(stats.contactAreaMm2).toBe(0);
      expect(stats.totalContactPoints).toBe(0);
      expect(stats.minClearanceMm).toBeGreaterThan(5);
    });
  });

  describe('createOcclusogramMaterial layered rendering', () => {
    it('creates MeshPhysicalMaterial configured with custom shader hooks and layered base properties', async () => {
      const { createOcclusogramMaterial, createElevationDataTexture, DEFAULT_OCCLUSAL_BOUNDS } = await import('../occlusogram');
      const THREE = await import('three');

      const dummyMap = {
        isUpper: true,
        resolution: 16,
        bounds: DEFAULT_OCCLUSAL_BOUNDS,
        heights: new Float32Array(16 * 16),
        cellAreaMm2: 1.0,
      };
      const tex = createElevationDataTexture(dummyMap);

      const { material, updateKinematicsUniforms } = createOcclusogramMaterial({
        isUpper: true,
        opposingElevationTex: tex,
        bounds: DEFAULT_OCCLUSAL_BOUNDS,
        maxRangeMm: 1.6,
        lowerMatrix: new THREE.Matrix4(),
        lowerInverseMatrix: new THREE.Matrix4(),
        upperZOffset: 0,
        wireframe: false,
        clippingPlanes: [],
        baseColor: 0xfef3c7,
        baseRoughness: 0.75,
        baseMetalness: 0.02,
        baseTransmission: 0.65,
      });

      expect(material).toBeDefined();
      expect(material.roughness).toBe(0.75);
      expect(material.transmission).toBe(0.65);
      expect(typeof updateKinematicsUniforms).toBe('function');

      // Test shader onBeforeCompile hook injects occlusogram logic
      const mockShader = {
        uniforms: {},
        vertexShader: 'void main() { #include <begin_vertex> }',
        fragmentShader: 'void main() { #include <color_fragment> }',
      };
      material.onBeforeCompile(mockShader as any, {} as any);
      expect(mockShader.vertexShader).toContain('vOccLocalPos');
      expect(mockShader.fragmentShader).toContain('occlusogramHeatColor');
    });
  });
});
