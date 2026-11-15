import { describe, it, expect } from 'vitest';
import { createProceduralDentalArchGeometry } from '../utils/proceduralArch';
import {
  segmentArchGeometryTeeth,
  identifyToothAtPoint3D,
  createLibraryToothGeometry,
  applyNativeToothEditsToGeometry,
  restoreNativeGeometryBeforeEdits,
  exportEditedArchToBinaryStl,
  TOOTH_LIBRARY_ITEMS,
} from '../utils/modelEditor';

describe('3D Dental Model & Tooth Editor Engine (modelEditor.ts)', () => {
  it('automatically segments all 14 maxillary and 14 mandibular FDI teeth with calibrated 3D centers', () => {
    const upperGeom = createProceduralDentalArchGeometry(true);
    const lowerGeom = createProceduralDentalArchGeometry(false);

    const upperTeeth = segmentArchGeometryTeeth(upperGeom, true);
    const lowerTeeth = segmentArchGeometryTeeth(lowerGeom, false);

    expect(upperTeeth).toHaveLength(14);
    expect(lowerTeeth).toHaveLength(14);

    const tooth25 = upperTeeth.find((t) => t.fdi === 25);
    expect(tooth25).toBeDefined();
    expect(tooth25?.isUpper).toBe(true);
    expect(tooth25?.morphology).toBe('premolar');
    expect(tooth25?.presentInBaseline).toBe(true);

    const tooth46 = lowerTeeth.find((t) => t.fdi === 46);
    expect(tooth46).toBeDefined();
    expect(tooth46?.isUpper).toBe(false);
    expect(tooth46?.morphology).toBe('molar1');
    expect(tooth46?.presentInBaseline).toBe(true);
  });

  it('identifies native and placed teeth from a 3D raycast point', () => {
    const upperGeom = createProceduralDentalArchGeometry(true);
    const upperTeeth = segmentArchGeometryTeeth(upperGeom, true);
    const tooth11 = upperTeeth.find((t) => t.fdi === 11)!;

    const hitNative = identifyToothAtPoint3D(
      tooth11.center,
      true,
      upperTeeth,
      [],
      {}
    );
    expect(hitNative).toEqual({ kind: 'native', fdi: 11 });

    // Placed library tooth at the same location takes priority when closer
    const hitPlaced = identifyToothAtPoint3D(
      tooth11.center,
      true,
      upperTeeth,
      [
        {
          id: 'placed-implant-11',
          labelZh: '上顎 中門齒',
          labelEn: 'Upper Central Incisor',
          morphology: 'central',
          isUpper: true,
          position: { ...tooth11.center },
          rotationDeg: 0,
          scale: 1,
        },
      ],
      {}
    );
    expect(hitPlaced).toEqual({ kind: 'placed', placedId: 'placed-implant-11' });
  });

  it('deletes an existing tooth into a healed gingival saddle, drags an existing tooth, and restores cleanly', () => {
    const upperGeom = createProceduralDentalArchGeometry(true);
    const upperTeeth = segmentArchGeometryTeeth(upperGeom, true);
    const origPos = new Float32Array(
      (upperGeom.attributes.position.array as Float32Array).slice(0, 120)
    );

    // Delete #25 and drag #11 forward by +4mm
    applyNativeToothEditsToGeometry(upperGeom, true, upperTeeth, {
      25: {
        fdi: 25,
        deleted: true,
        offsetMm: { x: 0, y: 0, z: 0 },
        rotationDeg: 0,
        scale: 1,
      },
      11: {
        fdi: 11,
        deleted: false,
        offsetMm: { x: 2.5, y: 4.0, z: 0.5 },
        rotationDeg: 10,
        scale: 1.05,
      },
    });

    expect(upperGeom.attributes.color).toBeDefined();

    // Restore back to unedited baseline
    restoreNativeGeometryBeforeEdits(upperGeom);
    const restoredPos = (upperGeom.attributes.position.array as Float32Array).slice(0, 120);
    expect(Array.from(restoredPos)).toEqual(Array.from(origPos));
  });

  it('generates 3D anatomical tooth library geometries and exports edited arch + placed teeth to binary STL', () => {
    for (const item of TOOTH_LIBRARY_ITEMS) {
      const geom = createLibraryToothGeometry(item.morphology, true);
      expect(geom.attributes.position.count).toBeGreaterThan(200);
      expect(geom.attributes.color).toBeDefined();
    }

    const upperGeom = createProceduralDentalArchGeometry(true);
    const stlBuffer = exportEditedArchToBinaryStl(
      upperGeom,
      [
        {
          id: 'placed-25',
          labelZh: '上顎 小臼齒',
          labelEn: 'Upper Premolar',
          morphology: 'premolar',
          isUpper: true,
          position: { x: 22.8, y: -15.5, z: 1.4 },
          rotationDeg: -15,
          scale: 1,
        },
      ],
      true
    );

    expect(stlBuffer.byteLength).toBeGreaterThan(84);
    const view = new DataView(stlBuffer);
    const triCount = view.getUint32(80, true);
    expect(triCount).toBeGreaterThan(1000);
    expect(stlBuffer.byteLength).toBe(84 + triCount * 50);
  });
});
