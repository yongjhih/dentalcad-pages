import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  deviationToDiffRGB,
  computePositionsCentroid,
  generateSimulatedComparisonGeometry,
  computeMeshSignedDeviations,
  computeModelDiffStatsFromDeviations,
  applyDiffHeatmapColorsToGeometry,
  restoreOriginalColorsOnGeometry,
} from '../modelDiff';
import { createProceduralDentalArchGeometry } from '../proceduralArch';

describe('3D Model Diff Engine (modelDiff.ts)', () => {
  it('maps signed deviations in mm to clinical heatmap RGB colors', () => {
    const green = deviationToDiffRGB(0.05, 2.0, 0.25);
    expect(green[1]).toBeGreaterThan(green[0]);
    expect(green[1]).toBeGreaterThan(green[2]);

    const red = deviationToDiffRGB(1.8, 2.0, 0.25);
    expect(red[0]).toBeGreaterThan(0.8);
    expect(red[0]).toBeGreaterThan(red[2]);

    const blue = deviationToDiffRGB(-1.8, 2.0, 0.25);
    expect(blue[2]).toBeGreaterThan(0.75);
    expect(blue[2]).toBeGreaterThan(blue[0]);
  });

  it('computes accurate 3D centroid of a vertex buffer', () => {
    const positions = new Float32Array([0, 0, 0, 6, 3, 9, 3, 6, 3]);
    const c = computePositionsCentroid(positions);
    expect(c.x).toBeCloseTo(3.0, 3);
    expect(c.y).toBeCloseTo(3.0, 3);
    expect(c.z).toBeCloseTo(4.0, 3);
  });

  it('generates simulated comparison geometries for ortho_alignment, arch_expansion, and occlusal_wear', () => {
    const baseUpper = createProceduralDentalArchGeometry(true);
    const orthoGeom = generateSimulatedComparisonGeometry(baseUpper, true, 'ortho_alignment');
    const expGeom = generateSimulatedComparisonGeometry(baseUpper, true, 'arch_expansion');
    const wearGeom = generateSimulatedComparisonGeometry(baseUpper, true, 'occlusal_wear');

    expect(orthoGeom.attributes.position.count).toBe(baseUpper.attributes.position.count);
    expect(expGeom.attributes.position.count).toBe(baseUpper.attributes.position.count);
    expect(wearGeom.attributes.position.count).toBe(baseUpper.attributes.position.count);
  });

  it('computes per-vertex signed deviations and clinical telemetry statistics', () => {
    const baseUpper = createProceduralDentalArchGeometry(true);
    const baseLower = createProceduralDentalArchGeometry(false);
    const targetUpper = generateSimulatedComparisonGeometry(baseUpper, true, 'arch_expansion');
    const targetLower = generateSimulatedComparisonGeometry(baseLower, false, 'arch_expansion');

    const uDevs = computeMeshSignedDeviations(
      baseUpper.attributes.position.array,
      baseUpper.attributes.normal?.array,
      targetUpper.attributes.position.array,
      { autoAlignCentroids: false }
    );
    const lDevs = computeMeshSignedDeviations(
      baseLower.attributes.position.array,
      baseLower.attributes.normal?.array,
      targetLower.attributes.position.array,
      { autoAlignCentroids: false }
    );

    expect(uDevs.length).toBeGreaterThan(100);
    const stats = computeModelDiffStatsFromDeviations(
      uDevs,
      lDevs,
      0.25
    );

    expect(stats.rmsdMm).toBeGreaterThan(0.1);
    expect(stats.maxPositiveMm).toBeGreaterThan(0.25);
    expect(
      stats.inTolerancePercent + stats.positivePercent + stats.negativePercent
    ).toBeCloseTo(100, 0);
    expect(stats.comparedVertexCount).toBe(
      uDevs.length + lDevs.length
    );
  });

  it('backs up original vertex colors when applying heatmap and restores them cleanly when disabled', () => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)
    );
    const origColors = new Float32Array([0.95, 0.94, 0.9, 0.95, 0.94, 0.9, 0.85, 0.45, 0.52]);
    geom.setAttribute('color', new THREE.BufferAttribute(origColors.slice(), 3));

    const deviations = new Float32Array([1.5, 0.0, -1.5]);
    applyDiffHeatmapColorsToGeometry(geom, deviations, 2.0, 0.25);

    const heatmapArr = geom.getAttribute('color').array as Float32Array;
    // First vertex (+1.5mm) should be reddish, not original enamel
    expect(heatmapArr[0]).not.toBeCloseTo(origColors[0], 2);

    // Restore original colors
    restoreOriginalColorsOnGeometry(geom);
    const restoredArr = geom.getAttribute('color').array as Float32Array;
    expect(restoredArr[0]).toBeCloseTo(origColors[0], 4);
    expect(restoredArr[6]).toBeCloseTo(origColors[6], 4);
    expect(restoredArr[7]).toBeCloseTo(origColors[7], 4);
  });
});
