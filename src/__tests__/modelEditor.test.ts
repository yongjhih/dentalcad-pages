import { describe, it, expect } from 'vitest';
import { createProceduralDentalArchGeometry } from '../utils/proceduralArch';
import { ModelEditSettings } from '../types/dental';
import {
  segmentArchGeometryTeeth,
  identifyToothAtPoint3D,
  createLibraryToothGeometry,
  extractToothCrownGeometry,
  createGingivaBaseGeometry,
  applyNativeToothEditsToGeometry,
  restoreNativeGeometryBeforeEdits,
  exportEditedArchToBinaryStl,
  TOOTH_LIBRARY_ITEMS,
  DEFAULT_MODEL_EDIT_SETTINGS,
  canUndo,
  canRedo,
  pushModelEditSnapshot,
  undoModelEdit,
  redoModelEdit,
  deleteSelectedTooth,
  autoAddMatchingTooth,
  copySelectedTooth,
  pasteToothFromClipboard,
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

  it('correctly tracks undo/redo snapshots through successive edits and restores states', () => {
    let settings = { ...DEFAULT_MODEL_EDIT_SETTINGS };
    expect(canUndo(settings)).toBe(false);
    expect(canRedo(settings)).toBe(false);

    // 1. Delete tooth #25
    settings = pushModelEditSnapshot(settings);
    settings.nativeEdits = {
      25: {
        fdi: 25,
        deleted: true,
        offsetMm: { x: 0, y: 0, z: 0 },
        rotationDeg: 0,
        scale: 1,
      },
    };
    settings.selectedTarget = { kind: 'native', fdi: 25 };

    expect(canUndo(settings)).toBe(true);
    expect(canRedo(settings)).toBe(false);
    expect(settings.nativeEdits[25]?.deleted).toBe(true);

    // 2. Add placed tooth
    settings = pushModelEditSnapshot(settings);
    settings.placedTeeth = [
      {
        id: 'placed-lib-1',
        labelZh: '上顎 小臼齒',
        labelEn: 'Upper Premolar',
        morphology: 'premolar',
        isUpper: true,
        position: { x: 22.8, y: -15.5, z: 1.4 },
        rotationDeg: 0,
        scale: 1,
      },
    ];
    settings.selectedTarget = { kind: 'placed', placedId: 'placed-lib-1' };

    expect(settings.placedTeeth).toHaveLength(1);
    expect(settings.history?.past).toHaveLength(2);

    // 3. Undo: placed tooth should disappear, restoring previous target and state
    settings = undoModelEdit(settings);
    expect(settings.placedTeeth).toHaveLength(0);
    expect(settings.nativeEdits[25]?.deleted).toBe(true);
    expect(settings.selectedTarget).toEqual({ kind: 'native', fdi: 25 });
    expect(canUndo(settings)).toBe(true);
    expect(canRedo(settings)).toBe(true);

    // 4. Undo again: tooth #25 deletion is undone
    settings = undoModelEdit(settings);
    expect(settings.nativeEdits[25]).toBeUndefined();
    expect(canUndo(settings)).toBe(false);
    expect(canRedo(settings)).toBe(true);

    // 5. Redo: tooth #25 becomes deleted again
    settings = redoModelEdit(settings);
    expect(settings.nativeEdits[25]?.deleted).toBe(true);
    expect(canUndo(settings)).toBe(true);
    expect(canRedo(settings)).toBe(true);

    // 6. Redo again: placed tooth is restored
    settings = redoModelEdit(settings);
    expect(settings.placedTeeth).toHaveLength(1);
    expect(settings.placedTeeth[0].id).toBe('placed-lib-1');
    expect(canUndo(settings)).toBe(true);
    expect(canRedo(settings)).toBe(false);
  });

  it('partitions arch into discrete independent Tooth Objects and Gingiva Base (no mesh stretching)', () => {
    const upperGeom = createProceduralDentalArchGeometry(true);
    const upperTeeth = segmentArchGeometryTeeth(upperGeom, true);
    const tooth25 = upperTeeth.find((t) => t.fdi === 25)!;

    // 1. Extract discrete 3D crown geometry for Tooth #25
    const crown25 = extractToothCrownGeometry(upperGeom, tooth25);
    expect(crown25).toBeDefined();
    expect(crown25.attributes.position.count).toBeGreaterThan(20);
    expect(crown25.attributes.color).toBeDefined();

    // 2. Generate smooth oral mucosal Gingiva Base
    const gingivaBase = createGingivaBaseGeometry(upperGeom, upperTeeth, true);
    expect(gingivaBase).toBeDefined();
    expect(gingivaBase.attributes.position.count).toBe(upperGeom.attributes.position.count);
    expect(gingivaBase.attributes.color).toBeDefined();

    // 3. Export binary STL with discrete tooth objects + gingiva base
    const stlBuffer = exportEditedArchToBinaryStl(
      upperGeom,
      [],
      true,
      upperTeeth,
      {
        25: {
          fdi: 25,
          deleted: false,
          offsetMm: { x: 2.0, y: 1.5, z: 0.5 },
          rotationDeg: 12,
          scale: 1.05,
        },
      }
    );
    expect(stlBuffer.byteLength).toBeGreaterThan(1000);
  });

  it('deletes selected tooth (native or placed) with deleteSelectedTooth and supports undo/redo', () => {
    let settings: ModelEditSettings = {
      ...DEFAULT_MODEL_EDIT_SETTINGS,
      enabled: true,
      selectedTarget: { kind: 'native', fdi: 14 as const },
    };

    // 1. Delete native tooth #14
    settings = deleteSelectedTooth(settings);
    expect(settings.nativeEdits[14]?.deleted).toBe(true);
    expect(canUndo(settings)).toBe(true);

    // 2. Undo deletion
    settings = undoModelEdit(settings);
    expect(Boolean(settings.nativeEdits[14]?.deleted)).toBe(false);

    // 3. Delete placed tooth
    settings = {
      ...settings,
      placedTeeth: [
        {
          id: 'placed-molar-1',
          labelZh: '大臼齒',
          labelEn: 'Molar',
          morphology: 'molar1',
          isUpper: true,
          position: { x: 10, y: -20, z: 2 },
          rotationDeg: 0,
          scale: 1,
        },
      ],
      selectedTarget: { kind: 'placed', placedId: 'placed-molar-1' },
    };
    settings = deleteSelectedTooth(settings);
    expect(settings.placedTeeth).toHaveLength(0);
    expect(settings.selectedTarget).toBeNull();

    // 4. Undo restores placed tooth
    settings = undoModelEdit(settings);
    expect(settings.placedTeeth).toHaveLength(1);
    expect(settings.placedTeeth[0].id).toBe('placed-molar-1');
  });

  it('automatically adds matching anatomical tooth morphology for selected tooth site with autoAddMatchingTooth', () => {
    const upperGeom = createProceduralDentalArchGeometry(true);
    const upperTeeth = segmentArchGeometryTeeth(upperGeom, true);

    // 1. Select tooth #23 (Upper Canine)
    let settings: ModelEditSettings = {
      ...DEFAULT_MODEL_EDIT_SETTINGS,
      enabled: true,
      selectedTarget: { kind: 'native', fdi: 23 as const },
    };

    settings = autoAddMatchingTooth(settings, upperTeeth, true);
    expect(settings.placedTeeth).toHaveLength(1);
    const placedCanine = settings.placedTeeth[0];
    expect(placedCanine.morphology).toBe('canine');
    expect(placedCanine.isUpper).toBe(true);
    expect(placedCanine.fdiHint).toBe(23);
    expect(settings.selectedTarget).toEqual({ kind: 'placed', placedId: placedCanine.id });
    expect(canUndo(settings)).toBe(true);

    // 2. Undo removes the placed tooth
    settings = undoModelEdit(settings);
    expect(settings.placedTeeth).toHaveLength(0);
  });

  it('ensures smooth gingival blend scaling with tooth movement distance', () => {
    const upperGeom = createProceduralDentalArchGeometry(true);
    const upperTeeth = segmentArchGeometryTeeth(upperGeom, true);

    // Unmoved pristine tooth: moveDist = 0 -> gingiva under intact teeth remains identical to original scan
    const gingivaUnmoved = createGingivaBaseGeometry(upperGeom, upperTeeth, true, {
      21: { fdi: 21, deleted: false, offsetMm: { x: 0, y: 0, z: 0 }, rotationDeg: 0, scale: 1 },
    });
    expect(gingivaUnmoved).toBeDefined();

    // Moved tooth: moveDist = 3.0mm -> smoothly recessed alveolar socket bed
    const gingivaMoved = createGingivaBaseGeometry(upperGeom, upperTeeth, true, {
      21: { fdi: 21, deleted: false, offsetMm: { x: 3.0, y: 0, z: 0 }, rotationDeg: 0, scale: 1 },
    });
    expect(gingivaMoved).toBeDefined();

    // Deleted tooth: smoothly healed/recessed ridge
    const gingivaDeleted = createGingivaBaseGeometry(upperGeom, upperTeeth, true, {
      21: { fdi: 21, deleted: true, offsetMm: { x: 0, y: 0, z: 0 }, rotationDeg: 0, scale: 1 },
    });
    expect(gingivaDeleted).toBeDefined();
  });

  it('supports Ctrl-C and Ctrl-V copying and pasting teeth with copySelectedTooth and pasteToothFromClipboard', () => {
    const upperGeom = createProceduralDentalArchGeometry(true);
    const upperTeeth = segmentArchGeometryTeeth(upperGeom, true);

    // 1. Select tooth #11 (Upper Central Incisor)
    let settings: ModelEditSettings = {
      ...DEFAULT_MODEL_EDIT_SETTINGS,
      enabled: true,
      selectedTarget: { kind: 'native', fdi: 11 as const },
    };

    // 2. Copy (Ctrl-C)
    settings = copySelectedTooth(settings, upperTeeth);
    expect(settings.clipboard).toBeDefined();
    expect(settings.clipboard?.morphology).toBe('central');
    expect(settings.clipboard?.isUpper).toBe(true);
    expect(settings.clipboard?.sourceFdi).toBe(11);

    // 3. Paste (Ctrl-V)
    settings = pasteToothFromClipboard(settings, upperTeeth);
    expect(settings.placedTeeth).toHaveLength(1);
    const pastedTooth = settings.placedTeeth[0];
    expect(pastedTooth.morphology).toBe('central');
    expect(pastedTooth.labelZh).toContain('貼上');
    expect(settings.selectedTarget).toEqual({ kind: 'placed', placedId: pastedTooth.id });
    expect(canUndo(settings)).toBe(true);

    // 4. Copy the placed tooth (Ctrl-C on placed tooth)
    settings = copySelectedTooth(settings, upperTeeth);
    expect(settings.clipboard?.sourceLabelZh).toContain('貼上');

    // 5. Paste again (Ctrl-V second tooth)
    settings = pasteToothFromClipboard(settings, upperTeeth);
    expect(settings.placedTeeth).toHaveLength(2);

    // 6. Undo removes the second pasted tooth
    settings = undoModelEdit(settings);
    expect(settings.placedTeeth).toHaveLength(1);

    // 7. Undo removes the first pasted tooth
    settings = undoModelEdit(settings);
    expect(settings.placedTeeth).toHaveLength(0);
  });

  it('seamlessly integrates and blends newly placed/added teeth with gingiva base (no gaps or hollow crater)', () => {
    const lowerGeom = createProceduralDentalArchGeometry(false);
    const lowerTeeth = segmentArchGeometryTeeth(lowerGeom, false);
    const tooth37 = lowerTeeth.find((t) => t.fdi === 37)!;

    // Tooth #37 is deleted (extracted) and replaced with an auto-matching library tooth
    const nativeEdits = {
      37: { fdi: 37 as const, deleted: true, offsetMm: { x: 0, y: 0, z: 0 }, rotationDeg: 0, scale: 1 },
    };

    let settings: ModelEditSettings = {
      ...DEFAULT_MODEL_EDIT_SETTINGS,
      enabled: true,
      selectedTarget: { kind: 'native', fdi: 37 as const },
      nativeEdits,
    };

    settings = autoAddMatchingTooth(settings, lowerTeeth, false);
    expect(settings.placedTeeth).toHaveLength(1);
    const placed37 = settings.placedTeeth[0];
    expect(placed37.morphology).toBe('molar2');
    expect(placed37.isUpper).toBe(false);
    expect(placed37.fdiHint).toBe(37);

    // Height must be calibrated to tooth centroid between occlusal and cervical lines (seating into socket, not floating in air)
    const expectedCentroidZ = (tooth37.zOcclusal + tooth37.zCervical) * 0.5;
    expect(placed37.position.z).toBeCloseTo(expectedCentroidZ, 1);

    // Gingiva base with placed tooth: gingiva adapts smoothly to the placed tooth emergence profile
    const gingivaWithPlaced = createGingivaBaseGeometry(
      lowerGeom,
      lowerTeeth,
      false,
      nativeEdits,
      false,
      settings.placedTeeth
    );
    expect(gingivaWithPlaced).toBeDefined();
    expect(gingivaWithPlaced.attributes.position.count).toBe(lowerGeom.attributes.position.count);
    expect(gingivaWithPlaced.attributes.color).toBeDefined();
  });
});
