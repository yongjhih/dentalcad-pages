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
  computeEffectiveAlignmentOffset,
  DEFAULT_MODEL_DIFF_SETTINGS,
} from '../modelDiff';
import { DEFAULT_ARTICULATOR_SETTINGS } from '../articulatorKinematics';
import { createProceduralDentalArchGeometry } from '../proceduralArch';
import { detectMeshFormat, parseMeshGeometryBuffer } from '../meshLoader';
import {
  resolveShowcaseScenarioState,
  getShowcaseFeatures,
  getShowcaseQuickLinks,
} from '../showcasePresets';
import { ViewportSettings } from '../../types/dental';

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

  it('computes unified alignment offset combining centroid registration and manual XYZ offset', () => {
    const refPos = new Float32Array([0, 0, 0, 6, 0, 0, 3, 6, 0]);
    const tgtPos = new Float32Array([10, 5, 2, 16, 5, 2, 13, 11, 2]);
    const eff = computeEffectiveAlignmentOffset(refPos, tgtPos, {
      autoAlignCentroids: true,
      offsetMm: { x: 1.5, y: -0.5, z: 0.25 },
    });
    expect(eff.x).toBeCloseTo(-10 + 1.5, 3);
    expect(eff.y).toBeCloseTo(-5 - 0.5, 3);
    expect(eff.z).toBeCloseTo(-2 + 0.25, 3);
  });

  it('detects and parses STL, PLY, and OBJ mesh buffers via meshLoader', () => {
    expect(detectMeshFormat('upper_scan.stl')).toBe('stl');
    expect(detectMeshFormat('arch_target.ply')).toBe('ply');
    expect(detectMeshFormat('crown_waxup.obj')).toBe('obj');

    const objText = [
      '# Dental Crown OBJ',
      'v 0.0 0.0 0.0',
      'v 1.0 0.0 0.0',
      'v 0.0 1.0 0.0',
      'f 1 2 3',
    ].join('\n');
    const objBuffer = new TextEncoder().encode(objText).buffer;
    expect(detectMeshFormat(undefined, objBuffer)).toBe('obj');
    const objGeom = parseMeshGeometryBuffer(objBuffer, 'obj');
    expect(objGeom.attributes.position.count).toBe(3);

    const plyText = [
      'ply',
      'format ascii 1.0',
      'element vertex 3',
      'property float x',
      'property float y',
      'property float z',
      'element face 1',
      'property list uchar int vertex_indices',
      'end_header',
      '0 0 0',
      '2 0 0',
      '0 2 0',
      '3 0 1 2',
    ].join('\n');
    const plyBuffer = new TextEncoder().encode(plyText).buffer;
    expect(detectMeshFormat(undefined, plyBuffer)).toBe('ply');
    const plyGeom = parseMeshGeometryBuffer(plyBuffer, 'ply');
    expect(plyGeom.attributes.position.count).toBeGreaterThanOrEqual(3);
  });

  it('resolves showcase scenario presets cleanly via showcasePresets module', () => {
    const baseSettings: ViewportSettings = {
      showUpper: true,
      showLower: true,
      occlusionSeparation: 0,
      shadingMode: 'enamel',
      photoTextureMapped: false,
      occlusogramEnabled: false,
      occlusogramMaxRangeMm: 1.6,
      caliperToolActive: false,
      showMeasurements: true,
      archDistinction: false,
      wireframeOverlay: false,
      clippingEnabled: false,
      clippingAxis: 'z',
      clippingOffset: 0,
      autoRotate: false,
      lightingIntensity: 1.0,
      articulator: DEFAULT_ARTICULATOR_SETTINGS,
      modelDiff: DEFAULT_MODEL_DIFF_SETTINGS,
    };

    const diffState = resolveShowcaseScenarioState('diff_both', baseSettings);
    expect(diffState.activeTab).toBe('diff');
    expect(diffState.cameraPreset).toBe('isometric');
    expect(diffState.settings.modelDiff?.enabled).toBe(true);
    expect(diffState.settings.modelDiff?.displayMode).toBe('both');

    const artState = resolveShowcaseScenarioState('articulator', baseSettings);
    expect(artState.activeTab).toBe('articulator');
    expect(artState.settings.articulator.mode).toBe('compound');

    expect(getShowcaseFeatures('zh-TW').length).toBe(7);
    expect(getShowcaseQuickLinks('en').length).toBe(6);
  });
});
