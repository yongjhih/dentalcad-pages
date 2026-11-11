import { describe, it, expect } from 'vitest';
import { computePentaProjectedUVs } from '../pentaTextureShader';

describe('pentaTextureShader 5-View Orthographic Registration', () => {
  const uMin = { x: -31.584, y: -47.398, z: -1.5 };
  const uMax = { x: 34.915, y: 3.721, z: 17.996 };
  const lMin = { x: -32.328, y: -43.825, z: -15.525 };
  const lMax = { x: 32.797, y: 10.683, z: 6.659 };
  const cMin = { x: -32.328, y: -47.398, z: -15.525 };
  const cMax = { x: 34.915, y: 10.683, z: 17.996 };

  const rects = {
    front: { x: 0.22, y: 0.78, z: 0.25, w: 0.75 },
    occlusal: { x: 0.14, y: 0.86, z: 0.01, w: 0.99 },
    right: { x: 0.26, y: 0.74, z: 0.25, w: 0.75 },
    left: { x: 0.26, y: 0.74, z: 0.25, w: 0.75 },
  };

  it('maps Upper Anterior Incisors (Y_min) to TOP of penta_upper (vMax) and Posterior Molars (Y_max) to BOTTOM (vMin)', () => {
    const incisorUV = computePentaProjectedUVs({
      point: { x: 0, y: uMin.y, z: 2 },
      isUpper: true,
      archMin: uMin,
      archMax: uMax,
      combMin: cMin,
      combMax: cMax,
      rects,
    });
    const molarUV = computePentaProjectedUVs({
      point: { x: 0, y: uMax.y, z: 2 },
      isUpper: true,
      archMin: uMin,
      archMax: uMax,
      combMin: cMin,
      combMax: cMax,
      rects,
    });

    expect(incisorUV.uvOcclusal.v).toBeCloseTo(rects.occlusal.w, 4);
    expect(molarUV.uvOcclusal.v).toBeCloseTo(rects.occlusal.z, 4);
  });

  it('maps Lower Anterior Incisors (Y_min) to BOTTOM of penta_lower (vMin) and Posterior Molars (Y_max) to TOP (vMax)', () => {
    const incisorUV = computePentaProjectedUVs({
      point: { x: 0, y: lMin.y, z: -2 },
      isUpper: false,
      archMin: lMin,
      archMax: lMax,
      combMin: cMin,
      combMax: cMax,
      rects,
    });
    const molarUV = computePentaProjectedUVs({
      point: { x: 0, y: lMax.y, z: -2 },
      isUpper: false,
      archMin: lMin,
      archMax: lMax,
      combMin: cMin,
      combMax: cMax,
      rects,
    });

    expect(incisorUV.uvOcclusal.v).toBeCloseTo(rects.occlusal.z, 4);
    expect(molarUV.uvOcclusal.v).toBeCloseTo(rects.occlusal.w, 4);
  });

  it('maps Anterior (Y_min) to RIGHT (uMax) on Right Buccal and LEFT (uMin) on Left Buccal', () => {
    const anteriorUV = computePentaProjectedUVs({
      point: { x: 0, y: cMin.y, z: 0 },
      isUpper: true,
      archMin: uMin,
      archMax: uMax,
      combMin: cMin,
      combMax: cMax,
      rects,
    });
    const posteriorUV = computePentaProjectedUVs({
      point: { x: 0, y: cMax.y, z: 0 },
      isUpper: true,
      archMin: uMin,
      archMax: uMax,
      combMin: cMin,
      combMax: cMax,
      rects,
    });

    expect(anteriorUV.uvRight.u).toBeCloseTo(rects.right.y, 4);
    expect(posteriorUV.uvRight.u).toBeCloseTo(rects.right.x, 4);

    expect(anteriorUV.uvLeft.u).toBeCloseTo(rects.left.x, 4);
    expect(posteriorUV.uvLeft.u).toBeCloseTo(rects.left.y, 4);
  });
});
