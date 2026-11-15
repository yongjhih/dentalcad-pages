import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
  segmentArchGeometryTeeth,
  extractToothCrownGeometry,
  createGingivaBaseGeometry,
  identifyToothAtPoint3D,
} from '../utils/modelEditor';

describe('Real patient OrthoCAD_Export_297077963 tooth segmentation & selection', () => {
  const dir = '/Users/yongjhih/Downloads/OrthoCAD_Export_297077963';
  const loader = new STLLoader();

  it('analyzes real scan model coordinates, tooth centers, and extraction', () => {
    if (!fs.existsSync(`${dir}/297077963_shell_occlusion_u.stl`)) {
      console.log('OrthoCAD_Export_297077963 not found, skipping');
      return;
    }

    const upperBuf = fs.readFileSync(`${dir}/297077963_shell_occlusion_u.stl`);
    const lowerBuf = fs.readFileSync(`${dir}/297077963_shell_occlusion_l.stl`);

    const upperGeom = loader.parse(upperBuf.buffer.slice(upperBuf.byteOffset, upperBuf.byteOffset + upperBuf.byteLength));
    const lowerGeom = loader.parse(lowerBuf.buffer.slice(lowerBuf.byteOffset, lowerBuf.byteOffset + lowerBuf.byteLength));

    upperGeom.computeBoundingBox();
    lowerGeom.computeBoundingBox();

    console.log('Upper bbox:', upperGeom.boundingBox);
    console.log('Lower bbox:', lowerGeom.boundingBox);

    const upperTeeth = segmentArchGeometryTeeth(upperGeom, true);
    const lowerTeeth = segmentArchGeometryTeeth(lowerGeom, false);

    console.log('--- Upper Teeth (14) ---');
    for (const t of upperTeeth) {
      console.log(`FDI #${t.fdi} (${t.labelZh}): center=(${t.center.x.toFixed(1)}, ${t.center.y.toFixed(1)}, ${t.center.z.toFixed(1)}), zOcc=${t.zOcclusal}, zCerv=${t.zCervical}, present=${t.presentInBaseline}`);
    }

    console.log('--- Lower Teeth (14) ---');
    for (const t of lowerTeeth) {
      console.log(`FDI #${t.fdi} (${t.labelZh}): center=(${t.center.x.toFixed(1)}, ${t.center.y.toFixed(1)}, ${t.center.z.toFixed(1)}), zOcc=${t.zOcclusal}, zCerv=${t.zCervical}, present=${t.presentInBaseline}`);
    }

    // Try extracting crown geometry for each lower tooth
    console.log('--- Lower Tooth Crown Extraction ---');
    for (const t of lowerTeeth) {
      const crown = extractToothCrownGeometry(lowerGeom, t);
      const vertCount = crown.getAttribute('position') ? crown.getAttribute('position').count : 0;
      console.log(`Tooth #${t.fdi} extracted crown vertices: ${vertCount}`);
    }

    // Test deleting a lower molar (e.g. 36 or 46) and upper incisor (11) on real scan
    console.log('--- Test Deleting Tooth #36 on Real Scan ---');
    const gingivaLowerDeleted36 = createGingivaBaseGeometry(
      lowerGeom,
      lowerTeeth,
      false,
      { 36: { fdi: 36, deleted: true, offsetMm: { x: 0, y: 0, z: 0 }, rotationDeg: 0, scale: 1 } },
      false
    );

    const posOrig = lowerGeom.getAttribute('position') as THREE.BufferAttribute;
    const posDel = gingivaLowerDeleted36.getAttribute('position') as THREE.BufferAttribute;

    const t36 = lowerTeeth.find((t) => t.fdi === 36)!;
    let alteredCount = 0;
    let maxProtrusionDelta = 0;
    for (let i = 0; i < posOrig.count; i++) {
      const dx = posOrig.getX(i) - t36.center.x;
      const dy = posOrig.getY(i) - t36.center.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4.0) {
        const oz = posOrig.getZ(i);
        const dz = posDel.getZ(i);
        if (Math.abs(dz - oz) > 0.05) {
          alteredCount++;
          const delta = Math.abs(dz - oz);
          if (delta > maxProtrusionDelta) maxProtrusionDelta = delta;
        }
      }
    }
    console.log(`Deleted #36: altered vertices=${alteredCount}, maxDeltaZ=${maxProtrusionDelta.toFixed(2)}mm, zOcc=${t36.zOcclusal}, zCerv=${t36.zCervical}`);

    // Collect occlusal surface vertices for lower and upper arches
    const posL = lowerGeom.getAttribute('position') as THREE.BufferAttribute;
    const occlusalVertsL: Array<{ x: number; y: number; z: number }> = [];
    for (let i = 0; i < posL.count; i++) {
      const z = posL.getZ(i);
      if (z > 4.0) {
        occlusalVertsL.push({ x: posL.getX(i), y: posL.getY(i), z });
      }
    }

    const posU = upperGeom.getAttribute('position') as THREE.BufferAttribute;
    const occlusalVertsU: Array<{ x: number; y: number; z: number }> = [];
    for (let i = 0; i < posU.count; i++) {
      const z = posU.getZ(i);
      // For upper arch, occlusal surface is at LOW Z (near 0)
      if (z < 2.5) {
        occlusalVertsU.push({ x: posU.getX(i), y: posU.getY(i), z });
      }
    }

    // Let us test adaptive coronal arch fitting & tooth peak refinement
    console.log('--- Adaptive Coronal Arch Fitting Test ---');

    // Calibrate coronal arch parameters
    function calibrateArchFromOcclusalSurface(
      geom: THREE.BufferGeometry,
      isUpper: boolean
    ) {
      const pos = geom.getAttribute('position') as THREE.BufferAttribute;
      const count = pos.count;

      let bMinZ = Infinity, bMaxZ = -Infinity;
      for (let i = 0; i < count; i += 20) {
        const z = pos.getZ(i);
        if (z < bMinZ) bMinZ = z;
        if (z > bMaxZ) bMaxZ = z;
      }

      // Filter coronal horizon vertices (teeth tips)
      const coronalThresholdZ = isUpper ? bMinZ + 4.5 : bMaxZ - 4.5;
      const coronalVerts: Array<{ x: number; y: number; z: number }> = [];
      const step = Math.max(1, Math.floor(count / 15000));
      for (let i = 0; i < count; i += step) {
        const z = pos.getZ(i);
        const isCoronal = isUpper ? z <= coronalThresholdZ : z >= coronalThresholdZ;
        if (isCoronal) {
          coronalVerts.push({ x: pos.getX(i), y: pos.getY(i), z });
        }
      }

      console.log(`Coronal vertices count (${isUpper ? 'Upper' : 'Lower'}): ${coronalVerts.length}`);

      let cMinX = Infinity, cMaxX = -Infinity;
      let cMinY = Infinity, cMaxY = -Infinity;
      for (const v of coronalVerts) {
        if (v.x < cMinX) cMinX = v.x;
        if (v.x > cMaxX) cMaxX = v.x;
        if (v.y < cMinY) cMinY = v.y;
        if (v.y > cMaxY) cMaxY = v.y;
      }

      console.log(`Coronal bounds: X=[${cMinX.toFixed(1)}, ${cMaxX.toFixed(1)}], Y=[${cMinY.toFixed(1)}, ${cMaxY.toFixed(1)}]`);

      const centerX = (cMinX + cMaxX) * 0.5;
      const halfWidth = (cMaxX - cMinX) * 0.5;
      const minY = cMinY;
      const spanY = cMaxY - cMinY;

      return { centerX, halfWidth, minY, spanY, coronalVerts };
    }

    const fitL = calibrateArchFromOcclusalSurface(lowerGeom, false);
    const fitU = calibrateArchFromOcclusalSurface(upperGeom, true);

    // Test peak-centroid refinement on each tooth
    console.log('--- Refined Tooth Centers on Real Scan ---');
    for (const t of lowerTeeth) {
      // Search coronal vertices near initial center
      const rSearch = 6.0;
      const near = fitL.coronalVerts.filter((v) => Math.hypot(v.x - t.center.x, v.y - t.center.y) < rSearch);
      if (near.length >= 8) {
        // Find peak Z
        let peakZ = -Infinity;
        for (const v of near) {
          if (v.z > peakZ) peakZ = v.z;
        }
        // Top 35% cusp table vertices
        const cuspTable = near.filter((v) => v.z >= peakZ - 1.5);
        const refX = cuspTable.reduce((s, v) => s + v.x, 0) / cuspTable.length;
        const refY = cuspTable.reduce((s, v) => s + v.y, 0) / cuspTable.length;
        console.log(`Refined Tooth #${t.fdi}: initial=(${t.center.x.toFixed(1)}, ${t.center.y.toFixed(1)}) -> refined=(${refX.toFixed(1)}, ${refY.toFixed(1)}, zOcc=${peakZ.toFixed(1)}), shift=${Math.hypot(refX - t.center.x, refY - t.center.y).toFixed(2)}mm`);
      } else {
        console.log(`Tooth #${t.fdi}: NO CROWN FOUND (Missing/Edentulous site)`);
      }
    }

    // Now test Upper teeth refinement
    console.log('--- Refined Upper Tooth Centers on Real Scan ---');
    for (const t of upperTeeth) {
      const rSearch = 6.0;
      const near = fitU.coronalVerts.filter((v) => Math.hypot(v.x - t.center.x, v.y - t.center.y) < rSearch);
      if (near.length >= 8) {
        let peakZ = Infinity;
        for (const v of near) {
          if (v.z < peakZ) peakZ = v.z;
        }
        const cuspTable = near.filter((v) => v.z <= peakZ + 1.5);
        const refX = cuspTable.reduce((s, v) => s + v.x, 0) / cuspTable.length;
        const refY = cuspTable.reduce((s, v) => s + v.y, 0) / cuspTable.length;
        console.log(`Refined Upper Tooth #${t.fdi}: initial=(${t.center.x.toFixed(1)}, ${t.center.y.toFixed(1)}) -> refined=(${refX.toFixed(1)}, ${refY.toFixed(1)}, zOcc=${peakZ.toFixed(1)}), shift=${Math.hypot(refX - t.center.x, refY - t.center.y).toFixed(2)}mm`);
      } else {
        console.log(`Upper Tooth #${t.fdi}: NO CROWN FOUND (Missing/Edentulous site)`);
      }
    }
    console.log('--- Lower Arch Occlusal Extents ---');
    let minOccY = Infinity, maxOccY = -Infinity, minOccX = Infinity, maxOccX = -Infinity;
    for (const v of occlusalVertsL) {
      if (v.x < minOccX) minOccX = v.x;
      if (v.x > maxOccX) maxOccX = v.x;
      if (v.y < minOccY) minOccY = v.y;
      if (v.y > maxOccY) maxOccY = v.y;
    }
    console.log(`Lower occlusal verts bounds: X=[${minOccX.toFixed(1)}, ${maxOccX.toFixed(1)}], Y=[${minOccY.toFixed(1)}, ${maxOccY.toFixed(1)}]`);

    // Trace actual occlusal crest points on upper arch
    console.log('--- Upper Arch Occlusal Extents ---');
    let minOccYU = Infinity, maxOccYU = -Infinity, minOccXU = Infinity, maxOccXU = -Infinity;
    for (const v of occlusalVertsU) {
      if (v.x < minOccXU) minOccXU = v.x;
      if (v.x > maxOccXU) maxOccXU = v.x;
      if (v.y < minOccYU) minOccYU = v.y;
      if (v.y > maxOccYU) maxOccYU = v.y;
    }
    console.log(`Upper occlusal verts bounds: X=[${minOccXU.toFixed(1)}, ${maxOccXU.toFixed(1)}], Y=[${minOccYU.toFixed(1)}, ${maxOccYU.toFixed(1)}]`);

    console.log('--- Lower Arch Actual Peaks vs Predicted Centers ---');
    for (const t of lowerTeeth) {
      const near = occlusalVertsL.filter((v) => Math.hypot(v.x - t.center.x, v.y - t.center.y) < 6.0);
      if (near.length > 0) {
        let maxZ = -Infinity;
        let peak = near[0];
        for (const v of near) {
          if (v.z > maxZ) {
            maxZ = v.z;
            peak = v;
          }
        }
        const offset = Math.hypot(t.center.x - peak.x, t.center.y - peak.y);
        console.log(`Tooth #${t.fdi}: predicted=(${t.center.x.toFixed(1)}, ${t.center.y.toFixed(1)}), actual_peak=(${peak.x.toFixed(1)}, ${peak.y.toFixed(1)}, z=${maxZ.toFixed(1)}), offset=${offset.toFixed(2)}mm`);
      } else {
        console.log(`Tooth #${t.fdi}: predicted=(${t.center.x.toFixed(1)}, ${t.center.y.toFixed(1)}), NO OCCLUSAL VERTS NEARBY!`);
      }
    }

    // Check actual occlusal peaks vs predicted centers for upper teeth
    console.log('--- Upper Arch Actual Peaks vs Predicted Centers ---');
    for (const t of upperTeeth) {
      const near = occlusalVertsU.filter((v) => Math.hypot(v.x - t.center.x, v.y - t.center.y) < 6.0);
      if (near.length > 0) {
        let minZ = Infinity;
        let peak = near[0];
        for (const v of near) {
          if (v.z < minZ) {
            minZ = v.z;
            peak = v;
          }
        }
        const offset = Math.hypot(t.center.x - peak.x, t.center.y - peak.y);
        console.log(`Tooth #${t.fdi}: predicted=(${t.center.x.toFixed(1)}, ${t.center.y.toFixed(1)}), actual_peak=(${peak.x.toFixed(1)}, ${peak.y.toFixed(1)}, z=${minZ.toFixed(1)}), offset=${offset.toFixed(2)}mm`);
      } else {
        console.log(`Tooth #${t.fdi}: predicted=(${t.center.x.toFixed(1)}, ${t.center.y.toFixed(1)}), NO OCCLUSAL VERTS NEARBY!`);
      }
    }
    console.log('--- Test identifyToothAtPoint3D on Real Scan ---');
    const pick36 = identifyToothAtPoint3D(
      new THREE.Vector3(t36.center.x, t36.center.y, t36.zOcclusal),
      false,
      lowerTeeth
    );
    console.log('Pick at tooth 36 center:', pick36);
    expect(pick36).toEqual({ kind: 'native', fdi: 36 });

    const pick37 = identifyToothAtPoint3D(
      new THREE.Vector3(24.4, -2.2, 6.2),
      false,
      lowerTeeth
    );
    console.log('Pick at tooth 37 center:', pick37);
    expect(pick37).toEqual({ kind: 'native', fdi: 37 });

    const t11 = upperTeeth.find((t) => t.fdi === 11)!;
    const pick11 = identifyToothAtPoint3D(
      new THREE.Vector3(t11.center.x, t11.center.y, t11.zOcclusal),
      true,
      upperTeeth
    );
    console.log('Pick at tooth 11 center:', pick11);
    expect(pick11).toEqual({ kind: 'native', fdi: 11 });

    const t21 = upperTeeth.find((t) => t.fdi === 21)!;
    const pick21 = identifyToothAtPoint3D(
      new THREE.Vector3(t21.center.x, t21.center.y, t21.zOcclusal),
      true,
      upperTeeth
    );
    console.log('Pick at tooth 21 center:', pick21);
    expect(pick21).toEqual({ kind: 'native', fdi: 21 });

    // Verify deletion on real scan:
    // Tooth #36 is cleanly recessed
    expect(alteredCount).toBeGreaterThan(500);
    expect(maxProtrusionDelta).toBeGreaterThan(2.5);

    // Verify adjacent tooth #35 and #37 crowns are NOT altered
    const t35 = lowerTeeth.find((t) => t.fdi === 35)!;
    for (let i = 0; i < posOrig.count; i++) {
      const dx = posOrig.getX(i) - t35.center.x;
      const dy = posOrig.getY(i) - t35.center.y;
      if (Math.hypot(dx, dy) < 2.5) {
        const oz = posOrig.getZ(i);
        const dz = posDel.getZ(i);
        // Adjacent tooth #35 crown should be intact
        expect(Math.abs(dz - oz)).toBeLessThan(0.05);
      }
    }

    // Verify edentulous / missing tooth detection
    const t15 = upperTeeth.find((t) => t.fdi === 15)!;
    expect(t15).toBeDefined();
    expect(t15.presentInBaseline).toBe(false);
  });
});
