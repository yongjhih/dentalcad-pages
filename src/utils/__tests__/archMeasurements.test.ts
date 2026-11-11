import { describe, it, expect } from 'vitest';
import {
  createCaliperMeasurement,
  computeOrthoArchMetrics,
  DEFAULT_ORTHO_ARCH_METRICS,
} from '../archMeasurements';

describe('archMeasurements (Digital Caliper & Arch Analysis)', () => {
  it('computes exact 3D Euclidean distance and axis deltas for caliper measurements', () => {
    const m = createCaliperMeasurement(
      'test-1',
      'Intercanine U3-U3',
      { x: -17.0, y: -5.0, z: 1.0 },
      { x: 17.0, y: -5.0, z: 1.0 }
    );

    expect(m.distanceMm).toBe(34);
    expect(m.deltaX).toBe(34);
    expect(m.deltaY).toBe(0);
    expect(m.deltaZ).toBe(0);
  });

  it('computes 3D diagonal distance accurately (3-4-5 right triangle in 3D)', () => {
    const m = createCaliperMeasurement(
      'test-2',
      'Diagonal Check',
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 4, z: 12 }
    );
    expect(m.distanceMm).toBe(13);
    expect(m.deltaX).toBe(3);
    expect(m.deltaY).toBe(4);
    expect(m.deltaZ).toBe(12);
  });

  it('returns fallback metrics when vertex arrays are too small', () => {
    const metrics = computeOrthoArchMetrics(new Float32Array([0, 0, 0]), new Float32Array([]));
    expect(metrics).toEqual(DEFAULT_ORTHO_ARCH_METRICS);
  });

  it('computes realistic arch metrics from synthetic upper and lower vertex clouds (Anterior = -Y, Posterior = +Y)', () => {
    const upper: number[] = [];
    const lower: number[] = [];

    // Populate a synthetic parabolic dental arch where Anterior (Incisors) is Y=-45 and Posterior (Molars) is Y=+10
    for (let y = -45; y <= 10; y += 2) {
      const anteriorToPosterior = (y - -45) / 55; // 0 (anterior incisors) to 1 (posterior molars)
      const halfWidthU = 12 + 20 * Math.sqrt(anteriorToPosterior);
      const halfWidthL = 10 + 19 * Math.sqrt(anteriorToPosterior);

      upper.push(-halfWidthU, y, 1.0, halfWidthU, y, 1.0, 0, y, 2.5);
      lower.push(-halfWidthL, y + 2.2, 2.8, halfWidthL, y + 2.2, 2.8, 0, y + 2.2, -2.0);
    }

    const metrics = computeOrthoArchMetrics(new Float32Array(upper), new Float32Array(lower));
    expect(metrics.upperIntermolarWidthMm).toBeGreaterThan(metrics.upperIntercanineWidthMm);
    expect(metrics.lowerIntermolarWidthMm).toBeGreaterThan(metrics.lowerIntercanineWidthMm);
    expect(metrics.overjetMm).toBeGreaterThan(0);
    expect(metrics.overbiteMm).toBeGreaterThan(0);
    expect(metrics.upperArchDepthMm).toBeGreaterThan(30);
  });
});
