import * as THREE from 'three';
import {
  EmergenceProfileType,
  FdiToothNumber,
  ModelEditSettings,
  ModelEditSnapshot,
  NativeToothEditOperation,
  PlacedLibraryTooth,
  Point3D,
  SegmentedToothInfo,
  SelectedToothTarget,
  ToothMorphologyType,
} from '../types/dental';

export const DEFAULT_MODEL_EDIT_SETTINGS: ModelEditSettings = {
  enabled: false,
  toolMode: 'drag',
  selectedTarget: { kind: 'native', fdi: 25 },
  nativeEdits: {},
  placedTeeth: [],
  clipboard: null,
  showFdiLabels: true,
  showToothObjects: true,
  showGingivaBase: true,
  history: {
    past: [],
    future: [],
  },
};

/**
 * Creates an immutable snapshot of the current 3D tooth editor state
 */
export function createModelEditSnapshot(settings: ModelEditSettings): ModelEditSnapshot {
  return {
    nativeEdits: JSON.parse(JSON.stringify(settings.nativeEdits || {})),
    placedTeeth: JSON.parse(JSON.stringify(settings.placedTeeth || [])),
    selectedTarget: settings.selectedTarget ? { ...settings.selectedTarget } : null,
  };
}

/**
 * Checks whether an undo operation can be performed
 */
export function canUndo(settings?: ModelEditSettings): boolean {
  return Boolean(settings?.history && settings.history.past.length > 0);
}

/**
 * Checks whether a redo operation can be performed
 */
export function canRedo(settings?: ModelEditSettings): boolean {
  return Boolean(settings?.history && settings.history.future.length > 0);
}

/**
 * Pushes the current state snapshot onto the undo history stack before applying an edit mutation
 */
export function pushModelEditSnapshot(
  settings: ModelEditSettings,
  maxHistory = 32
): ModelEditSettings {
  const currentSnapshot = createModelEditSnapshot(settings);
  const prevPast = settings.history?.past || [];
  return {
    ...settings,
    history: {
      past: [...prevPast.slice(-maxHistory + 1), currentSnapshot],
      future: [],
    },
  };
}

/**
 * Reverts the 3D model editor to the previous snapshot in the history stack
 */
export function undoModelEdit(settings: ModelEditSettings): ModelEditSettings {
  if (!settings.history || settings.history.past.length === 0) return settings;
  const currentSnapshot = createModelEditSnapshot(settings);
  const newPast = [...settings.history.past];
  const previousSnapshot = newPast.pop()!;
  return {
    ...settings,
    nativeEdits: previousSnapshot.nativeEdits,
    placedTeeth: previousSnapshot.placedTeeth,
    selectedTarget: previousSnapshot.selectedTarget,
    history: {
      past: newPast,
      future: [currentSnapshot, ...(settings.history.future || [])],
    },
  };
}

/**
 * Re-applies the next undone snapshot from the redo history stack
 */
export function redoModelEdit(settings: ModelEditSettings): ModelEditSettings {
  if (!settings.history || settings.history.future.length === 0) return settings;
  const currentSnapshot = createModelEditSnapshot(settings);
  const newFuture = [...settings.history.future];
  const nextSnapshot = newFuture.shift()!;
  return {
    ...settings,
    nativeEdits: nextSnapshot.nativeEdits,
    placedTeeth: nextSnapshot.placedTeeth,
    selectedTarget: nextSnapshot.selectedTarget,
    history: {
      past: [...(settings.history.past || []), currentSnapshot],
      future: newFuture,
    },
  };
}

export interface ToothLibraryPresetItem {
  morphology: ToothMorphologyType;
  titleZh: string;
  titleEn: string;
  subtitleZh: string;
  subtitleEn: string;
  defaultWidthMm: number;
  defaultLengthMm: number;
  defaultUpperFdi: FdiToothNumber;
  defaultLowerFdi: FdiToothNumber;
}

export const TOOTH_LIBRARY_ITEMS: ToothLibraryPresetItem[] = [
  {
    morphology: 'central',
    titleZh: '正中門齒 (Central)',
    titleEn: 'Central Incisor',
    subtitleZh: '#11 / #21 / #31 / #41 平切緣門牙',
    subtitleEn: '#11 / #21 / #31 / #41 Chisel Incisor',
    defaultWidthMm: 8.6,
    defaultLengthMm: 9.5,
    defaultUpperFdi: 21,
    defaultLowerFdi: 31,
  },
  {
    morphology: 'lateral',
    titleZh: '側門齒 (Lateral)',
    titleEn: 'Lateral Incisor',
    subtitleZh: '#12 / #22 / #32 / #42 圓角側門牙',
    subtitleEn: '#12 / #22 / #32 / #42 Rounded Incisor',
    defaultWidthMm: 6.8,
    defaultLengthMm: 8.6,
    defaultUpperFdi: 22,
    defaultLowerFdi: 32,
  },
  {
    morphology: 'canine',
    titleZh: '犬齒 / 虎牙 (Canine)',
    titleEn: 'Canine (Cuspid)',
    subtitleZh: '#13 / #23 / #33 / #43 尖錐咬頭犬齒',
    subtitleEn: '#13 / #23 / #33 / #43 Pointed Cuspid',
    defaultWidthMm: 7.8,
    defaultLengthMm: 9.8,
    defaultUpperFdi: 23,
    defaultLowerFdi: 33,
  },
  {
    morphology: 'premolar',
    titleZh: '小臼齒 (Premolar)',
    titleEn: 'Premolar (Bicuspid)',
    subtitleZh: '#14–#15 / #24–#25 / #34–#45 雙咬頭小臼齒',
    subtitleEn: '#14–#15 / #24–#25 / #34–#45 Bicuspid Crown',
    defaultWidthMm: 7.4,
    defaultLengthMm: 8.4,
    defaultUpperFdi: 25,
    defaultLowerFdi: 35,
  },
  {
    morphology: 'molar1',
    titleZh: '第一大臼齒 (1st Molar)',
    titleEn: '1st Molar',
    subtitleZh: '#16 / #26 / #36 / #46 四咬頭大臼齒',
    subtitleEn: '#16 / #26 / #36 / #46 4-Cusp Molar Crown',
    defaultWidthMm: 10.4,
    defaultLengthMm: 8.2,
    defaultUpperFdi: 16,
    defaultLowerFdi: 46,
  },
  {
    morphology: 'molar2',
    titleZh: '第二大臼齒 (2nd Molar)',
    titleEn: '2nd Molar',
    subtitleZh: '#17 / #27 / #37 / #47 後牙第二大臼齒',
    subtitleEn: '#17 / #27 / #37 / #47 Posterior Molar Crown',
    defaultWidthMm: 9.6,
    defaultLengthMm: 7.8,
    defaultUpperFdi: 27,
    defaultLowerFdi: 37,
  },
];

export function getLibraryItemMeta(morphology: ToothMorphologyType): ToothLibraryPresetItem {
  return (
    TOOTH_LIBRARY_ITEMS.find((item) => item.morphology === morphology) ||
    TOOTH_LIBRARY_ITEMS[3]
  );
}

/**
 * Deletes or extracts the currently selected tooth object (placed library tooth or native tooth).
 * Records an undoable snapshot in history.
 */
export function deleteSelectedTooth(settings: ModelEditSettings): ModelEditSettings {
  const target = settings.selectedTarget;
  if (!target) return settings;

  const next = pushModelEditSnapshot(settings);
  if (target.kind === 'placed' && target.placedId) {
    return {
      ...next,
      placedTeeth: next.placedTeeth.filter((p) => p.id !== target.placedId),
      selectedTarget: null,
    };
  }

  if (target.kind === 'native' && target.fdi) {
    const fdi = target.fdi;
    const curOp = next.nativeEdits[fdi] || {
      fdi,
      deleted: false,
      offsetMm: { x: 0, y: 0, z: 0 },
      rotationDeg: 0,
      scale: 1,
    };
    return {
      ...next,
      nativeEdits: {
        ...next.nativeEdits,
        [fdi]: {
          ...curOp,
          deleted: true,
        },
      },
    };
  }

  return next;
}

/**
 * Automatically creates and places the matching anatomical tooth morphology
 * based on the currently selected tooth, missing site, or active arch.
 */
export function autoAddMatchingTooth(
  settings: ModelEditSettings,
  segmentedTeeth: SegmentedToothInfo[],
  fallbackIsUpper: boolean = true
): ModelEditSettings {
  const target = settings.selectedTarget;
  const next = pushModelEditSnapshot(settings);

  let morphology: ToothMorphologyType = 'central';
  let isUpper = fallbackIsUpper;
  let spawnPos = { x: 0, y: -12, z: fallbackIsUpper ? 3.8 : -3.8 };
  let spawnRotDeg = 0;
  let labelZh = '齒形';
  let labelEn = 'Tooth';
  let fdiHint: FdiToothNumber | undefined = undefined;

  if (target?.kind === 'native' && target.fdi) {
    const native = segmentedTeeth.find((t) => t.fdi === target.fdi);
    if (native) {
      morphology = native.morphology;
      isUpper = native.isUpper;
      fdiHint = native.fdi;
      const edit = next.nativeEdits[native.fdi];
      const isDeletedOrMissing = Boolean(edit?.deleted) || !native.presentInBaseline;
      const cuspOffsetZ = (native.isUpper ? -1 : 1) * 2.4;
      const alignedZ = Number((native.zOcclusal - cuspOffsetZ).toFixed(2));
      spawnPos = {
        x: Number((native.center.x + (isDeletedOrMissing ? 0 : 2.5)).toFixed(2)),
        y: Number((native.center.y + (isDeletedOrMissing ? 0 : 1.5)).toFixed(2)),
        z: alignedZ,
      };
      spawnRotDeg = Math.round(native.angleDeg);
      labelZh = native.labelZh;
      labelEn = native.labelEn;
    }
  } else if (target?.kind === 'placed' && target.placedId) {
    const placed = next.placedTeeth.find((p) => p.id === target.placedId);
    if (placed) {
      morphology = placed.morphology;
      isUpper = placed.isUpper;
      fdiHint = placed.fdiHint;
      spawnPos = {
        x: Number((placed.position.x + 3.2).toFixed(2)),
        y: Number((placed.position.y + 1.2).toFixed(2)),
        z: Number(placed.position.z.toFixed(2)),
      };
      spawnRotDeg = placed.rotationDeg;
      labelZh = placed.labelZh;
      labelEn = placed.labelEn;
    }
  } else {
    // If no target selected, select the first deleted tooth or default seed on the arch
    const deletedSeed = segmentedTeeth.find(
      (t) => t.isUpper === fallbackIsUpper && Boolean(next.nativeEdits[t.fdi]?.deleted)
    );
    if (deletedSeed) {
      morphology = deletedSeed.morphology;
      isUpper = deletedSeed.isUpper;
      fdiHint = deletedSeed.fdi;
      const cuspOffsetZ = (deletedSeed.isUpper ? -1 : 1) * 2.4;
      const alignedZ = Number((deletedSeed.zOcclusal - cuspOffsetZ).toFixed(2));
      spawnPos = {
        x: Number(deletedSeed.center.x.toFixed(2)),
        y: Number(deletedSeed.center.y.toFixed(2)),
        z: alignedZ,
      };
      spawnRotDeg = Math.round(deletedSeed.angleDeg);
      labelZh = deletedSeed.labelZh;
      labelEn = deletedSeed.labelEn;
    } else {
      const defaultSeed = FDI_ARCH_SEEDS.find(
        (s) => s.isUpper === fallbackIsUpper && (s.fdi === 11 || s.fdi === 41)
      ) || FDI_ARCH_SEEDS[0];
      morphology = defaultSeed.morphology;
      isUpper = defaultSeed.isUpper;
      fdiHint = defaultSeed.fdi;
      labelZh = defaultSeed.labelZh;
      labelEn = defaultSeed.labelEn;
      spawnPos = { x: 0, y: -12, z: fallbackIsUpper ? 3.2 : -2.6 };
    }
  }

  const meta = getLibraryItemMeta(morphology);
  const newId = `auto-${morphology}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const toothTitleZh = labelZh || `${isUpper ? '上顎' : '下顎'} ${meta.titleZh}`;
  const toothTitleEn = labelEn || `${isUpper ? 'Upper' : 'Lower'} ${meta.titleEn}`;
  const newTooth: PlacedLibraryTooth = {
    id: newId,
    labelZh: `${toothTitleZh} (自動配對)`,
    labelEn: `${toothTitleEn} (Auto Match)`,
    morphology,
    isUpper,
    fdiHint,
    position: spawnPos,
    rotationDeg: spawnRotDeg,
    scale: 1.0,
    emergenceProfile: 'anatomical',
    subgingivalDepthMm: 0,
    gingivalAdaptation: 1.0,
  };

  return {
    ...next,
    enabled: true,
    toolMode: 'drag',
    placedTeeth: [...next.placedTeeth, newTooth],
    selectedTarget: { kind: 'placed', placedId: newId },
  };
}

/**
 * Copies the currently selected tooth (native tooth or placed library tooth) into the clipboard.
 */
export function copySelectedTooth(
  settings: ModelEditSettings,
  segmentedTeeth: SegmentedToothInfo[]
): ModelEditSettings {
  const target = settings.selectedTarget;
  if (!target) return settings;

  if (target.kind === 'placed' && target.placedId) {
    const placed = settings.placedTeeth.find((p) => p.id === target.placedId);
    if (!placed) return settings;
    return {
      ...settings,
      clipboard: {
        sourceLabelZh: placed.labelZh,
        sourceLabelEn: placed.labelEn,
        morphology: placed.morphology,
        isUpper: placed.isUpper,
        sourceFdi: placed.fdiHint,
        rotationDeg: placed.rotationDeg,
        scale: placed.scale,
        emergenceProfile: placed.emergenceProfile || 'anatomical',
        subgingivalDepthMm: placed.subgingivalDepthMm || 0,
        gingivalAdaptation: placed.gingivalAdaptation !== undefined ? placed.gingivalAdaptation : 1.0,
      },
    };
  }

  if (target.kind === 'native' && target.fdi) {
    const native = segmentedTeeth.find((t) => t.fdi === target.fdi);
    if (!native) return settings;
    const edit = settings.nativeEdits[native.fdi];
    return {
      ...settings,
      clipboard: {
        sourceLabelZh: `#${native.fdi} ${native.labelZh}`,
        sourceLabelEn: `#${native.fdi} ${native.labelEn}`,
        morphology: native.morphology,
        isUpper: native.isUpper,
        sourceFdi: native.fdi,
        rotationDeg: edit?.rotationDeg || 0,
        scale: edit?.scale || 1,
      },
    };
  }

  return settings;
}

/**
 * Pastes a tooth from the clipboard onto the dental arch near the current selected target or arch center.
 * Records an undoable snapshot in history.
 */
export function pasteToothFromClipboard(
  settings: ModelEditSettings,
  segmentedTeeth: SegmentedToothInfo[]
): ModelEditSettings {
  const clip = settings.clipboard;
  if (!clip) return settings;

  const target = settings.selectedTarget;
  const selectedNative =
    target?.kind === 'native' && target.fdi
      ? segmentedTeeth.find((t) => t.fdi === target.fdi) || null
      : null;
  const selectedPlaced =
    target?.kind === 'placed' && target.placedId
      ? settings.placedTeeth.find((p) => p.id === target.placedId) || null
      : null;

  let targetPos = { x: 0, y: -14, z: clip.isUpper ? 3.2 : -2.6 };
  let targetIsUpper = clip.isUpper;

  if (selectedNative) {
    const edit = settings.nativeEdits[selectedNative.fdi];
    const isDeletedSite = Boolean(edit?.deleted) || !selectedNative.presentInBaseline;
    targetIsUpper = selectedNative.isUpper;
    const cuspOffsetZ = (selectedNative.isUpper ? -1 : 1) * 2.4;
    const alignedZ = Number((selectedNative.zOcclusal - cuspOffsetZ).toFixed(2));
    targetPos = {
      x: Number((selectedNative.center.x + (isDeletedSite ? 0 : 3.2)).toFixed(2)),
      y: Number((selectedNative.center.y + (isDeletedSite ? 0 : 1.5)).toFixed(2)),
      z: alignedZ,
    };
  } else if (selectedPlaced) {
    targetIsUpper = selectedPlaced.isUpper;
    targetPos = {
      x: Number((selectedPlaced.position.x + 3.5).toFixed(2)),
      y: Number((selectedPlaced.position.y + 1.5).toFixed(2)),
      z: Number(selectedPlaced.position.z.toFixed(2)),
    };
  }

  const meta = getLibraryItemMeta(clip.morphology);
  const newId = `placed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newTooth: PlacedLibraryTooth = {
    id: newId,
    labelZh: `${clip.sourceLabelZh} (貼上)`,
    labelEn: `${clip.sourceLabelEn} (Pasted)`,
    morphology: clip.morphology || meta.morphology,
    isUpper: targetIsUpper,
    fdiHint: selectedNative?.fdi || clip.sourceFdi,
    position: targetPos,
    rotationDeg: clip.rotationDeg,
    scale: clip.scale,
    emergenceProfile: clip.emergenceProfile || 'anatomical',
    subgingivalDepthMm: clip.subgingivalDepthMm || 0,
    gingivalAdaptation: clip.gingivalAdaptation !== undefined ? clip.gingivalAdaptation : 1.0,
  };

  const next = pushModelEditSnapshot(settings);
  return {
    ...next,
    enabled: true,
    toolMode: 'drag',
    placedTeeth: [...next.placedTeeth, newTooth],
    selectedTarget: { kind: 'placed', placedId: newId },
  };
}

interface FdiSeedEntry {
  fdi: FdiToothNumber;
  isUpper: boolean;
  sParam: number; // Normalized arch curve parameter in [-1, 1] (- = Patient Right, + = Patient Left)
  morphology: ToothMorphologyType;
  rx: number;
  ry: number;
  labelZh: string;
  labelEn: string;
}

export const FDI_ARCH_SEEDS: FdiSeedEntry[] = [
  // Upper Right (Q1: #17 -> #11)
  { fdi: 17, isUpper: true, sParam: -0.92, morphology: 'molar2', rx: 5.2, ry: 4.8, labelZh: '#17 右上第二大臼齒', labelEn: '#17 UR 2nd Molar' },
  { fdi: 16, isUpper: true, sParam: -0.76, morphology: 'molar1', rx: 5.4, ry: 5.0, labelZh: '#16 右上第一大臼齒', labelEn: '#16 UR 1st Molar' },
  { fdi: 15, isUpper: true, sParam: -0.61, morphology: 'premolar', rx: 4.2, ry: 4.0, labelZh: '#15 右上第二小臼齒', labelEn: '#15 UR 2nd Premolar' },
  { fdi: 14, isUpper: true, sParam: -0.47, morphology: 'premolar', rx: 4.2, ry: 4.0, labelZh: '#14 右上第一小臼齒', labelEn: '#14 UR 1st Premolar' },
  { fdi: 13, isUpper: true, sParam: -0.33, morphology: 'canine', rx: 4.1, ry: 4.1, labelZh: '#13 右上犬齒', labelEn: '#13 UR Canine' },
  { fdi: 12, isUpper: true, sParam: -0.195, morphology: 'lateral', rx: 3.6, ry: 3.6, labelZh: '#12 右上側門齒', labelEn: '#12 UR Lateral Incisor' },
  { fdi: 11, isUpper: true, sParam: -0.065, morphology: 'central', rx: 4.3, ry: 4.0, labelZh: '#11 右上正中門齒', labelEn: '#11 UR Central Incisor' },

  // Upper Left (Q2: #21 -> #27)
  { fdi: 21, isUpper: true, sParam: 0.065, morphology: 'central', rx: 4.3, ry: 4.0, labelZh: '#21 左上正中門齒', labelEn: '#21 UL Central Incisor' },
  { fdi: 22, isUpper: true, sParam: 0.195, morphology: 'lateral', rx: 3.6, ry: 3.6, labelZh: '#22 左上側門齒', labelEn: '#22 UL Lateral Incisor' },
  { fdi: 23, isUpper: true, sParam: 0.33, morphology: 'canine', rx: 4.1, ry: 4.1, labelZh: '#23 左上犬齒', labelEn: '#23 UL Canine' },
  { fdi: 24, isUpper: true, sParam: 0.47, morphology: 'premolar', rx: 4.2, ry: 4.0, labelZh: '#24 左上第一小臼齒', labelEn: '#24 UL 1st Premolar' },
  { fdi: 25, isUpper: true, sParam: 0.61, morphology: 'premolar', rx: 4.3, ry: 4.1, labelZh: '#25 左上第二小臼齒', labelEn: '#25 UL 2nd Premolar' },
  { fdi: 26, isUpper: true, sParam: 0.76, morphology: 'molar1', rx: 5.4, ry: 5.0, labelZh: '#26 左上第一大臼齒', labelEn: '#26 UL 1st Molar' },
  { fdi: 27, isUpper: true, sParam: 0.92, morphology: 'molar2', rx: 5.2, ry: 4.8, labelZh: '#27 左上第二大臼齒', labelEn: '#27 UL 2nd Molar' },

  // Lower Right (Q4: #47 -> #41)
  { fdi: 47, isUpper: false, sParam: -0.92, morphology: 'molar2', rx: 5.1, ry: 4.8, labelZh: '#47 右下第二大臼齒', labelEn: '#47 LR 2nd Molar' },
  { fdi: 46, isUpper: false, sParam: -0.76, morphology: 'molar1', rx: 5.4, ry: 5.1, labelZh: '#46 右下第一大臼齒', labelEn: '#46 LR 1st Molar' },
  { fdi: 45, isUpper: false, sParam: -0.61, morphology: 'premolar', rx: 4.0, ry: 3.9, labelZh: '#45 右下第二小臼齒', labelEn: '#45 LR 2nd Premolar' },
  { fdi: 44, isUpper: false, sParam: -0.47, morphology: 'premolar', rx: 4.0, ry: 3.9, labelZh: '#44 右下第一小臼齒', labelEn: '#44 LR 1st Premolar' },
  { fdi: 43, isUpper: false, sParam: -0.33, morphology: 'canine', rx: 3.8, ry: 3.8, labelZh: '#43 右下犬齒', labelEn: '#43 LR Canine' },
  { fdi: 42, isUpper: false, sParam: -0.195, morphology: 'lateral', rx: 3.3, ry: 3.4, labelZh: '#42 右下側門齒', labelEn: '#42 LR Lateral Incisor' },
  { fdi: 41, isUpper: false, sParam: -0.065, morphology: 'central', rx: 3.1, ry: 3.3, labelZh: '#41 右下正中門齒', labelEn: '#41 LR Central Incisor' },

  // Lower Left (Q3: #31 -> #37)
  { fdi: 31, isUpper: false, sParam: 0.065, morphology: 'central', rx: 3.1, ry: 3.3, labelZh: '#31 左下正中門齒', labelEn: '#31 LL Central Incisor' },
  { fdi: 32, isUpper: false, sParam: 0.195, morphology: 'lateral', rx: 3.3, ry: 3.4, labelZh: '#32 左下側門齒', labelEn: '#32 LL Lateral Incisor' },
  { fdi: 33, isUpper: false, sParam: 0.33, morphology: 'canine', rx: 3.8, ry: 3.8, labelZh: '#33 左下犬齒', labelEn: '#33 LL Canine' },
  { fdi: 34, isUpper: false, sParam: 0.47, morphology: 'premolar', rx: 4.0, ry: 3.9, labelZh: '#34 左下第一小臼齒', labelEn: '#34 LL 1st Premolar' },
  { fdi: 35, isUpper: false, sParam: 0.61, morphology: 'premolar', rx: 4.0, ry: 3.9, labelZh: '#35 左下第二小臼齒', labelEn: '#35 LL 2nd Premolar' },
  { fdi: 36, isUpper: false, sParam: 0.76, morphology: 'molar1', rx: 5.4, ry: 5.1, labelZh: '#36 左下第一大臼齒', labelEn: '#36 LL 1st Molar' },
  { fdi: 37, isUpper: false, sParam: 0.92, morphology: 'molar2', rx: 5.1, ry: 4.8, labelZh: '#37 左下第二大臼齒', labelEn: '#37 LL 2nd Molar' },
];

export const UPPER_FDI_ORDER: FdiToothNumber[] = [
  17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27,
];

export const LOWER_FDI_ORDER: FdiToothNumber[] = [
  47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37,
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Segment and calibrate 28 FDI teeth on the Upper and Lower 3D dental arch geometries.
 * Automatically adapts to both the procedural demo arch and real intraoral STL scans.
 */
export function segmentArchGeometryTeeth(
  geom: THREE.BufferGeometry | null | undefined,
  isUpper: boolean
): SegmentedToothInfo[] {
  const seeds = FDI_ARCH_SEEDS.filter((s) => s.isUpper === isUpper);
  const posAttr = geom?.getAttribute('position');
  const origPos =
    (geom?.userData?.origEditPos as Float32Array | undefined) ||
    (posAttr?.array as ArrayLike<number> | undefined);

  // Default arch dimensions matching standard dental anatomy
  const defaultHalfWidth = isUpper ? 29.5 : 27.5;
  const defaultMinY = isUpper ? -44.7 : -42.9;
  const defaultSpanY = 50.0;

  let halfWidth = defaultHalfWidth;
  let minY = defaultMinY;
  let spanY = defaultSpanY;
  let centerX = 0;

  if (origPos && origPos.length >= 9) {
    let bxMin = Infinity,
      bxMax = -Infinity,
      byMin = Infinity,
      byMax = -Infinity;
    const count = Math.floor(origPos.length / 3);
    const step = Math.max(1, Math.floor(count / 8000));
    for (let i = 0; i < count; i += step) {
      const idx = i * 3;
      const x = origPos[idx];
      const y = origPos[idx + 1];
      if (x < bxMin) bxMin = x;
      if (x > bxMax) bxMax = x;
      if (y < byMin) byMin = y;
      if (y > byMax) byMax = y;
    }
    if (Number.isFinite(bxMin) && bxMax > bxMin + 10) {
      halfWidth = Math.max(22, Math.min(34, (bxMax - bxMin) * 0.455));
      centerX = (bxMin + bxMax) * 0.5 * 0.25;
      minY = byMin + 2.2;
      spanY = Math.max(38, Math.min(56, (byMax - byMin) * 0.92));
    }
  }

  return seeds.map((seed) => {
    const s = seed.sParam;
    const absS = Math.abs(s);

    // Parabolic arch centerline in (X, Y)
    let cx = centerX + Math.sign(s) * Math.pow(absS, 0.78) * halfWidth;
    let cy = minY + Math.pow(absS, 1.55) * spanY;

    const dX = 0.78 * Math.pow(Math.max(0.02, absS), -0.22) * halfWidth;
    const dY = Math.sign(s) * 1.55 * Math.pow(Math.max(0.02, absS), 0.55) * spanY;
    const angleDeg = Number(((Math.atan2(-dX, dY) * 180) / Math.PI).toFixed(1));

    let zOcclusal = isUpper ? 0.8 : -0.2;
    let zCervical = isUpper ? 7.2 : -5.5;
    let presentInBaseline = true;

    // Refine tooth centroid & occlusal height from actual mesh vertices inside the seed search window
    if (origPos && origPos.length >= 9) {
      const count = Math.floor(origPos.length / 3);
      const stride = Math.max(1, Math.floor(count / 16000));
      const rSearchX = seed.rx * 1.35;
      const rSearchY = seed.ry * 1.35;

      let peakZ = isUpper ? Infinity : -Infinity;
      let baseZ = isUpper ? -Infinity : Infinity;
      let crownSumX = 0;
      let crownSumY = 0;
      let crownCount = 0;

      for (let i = 0; i < count; i += stride) {
        const idx = i * 3;
        const vx = origPos[idx];
        const vy = origPos[idx + 1];
        const vz = origPos[idx + 2];

        if (Math.abs(vx - cx) <= rSearchX && Math.abs(vy - cy) <= rSearchY) {
          if (isUpper) {
            if (vz < peakZ) peakZ = vz;
            if (vz > baseZ) baseZ = vz;
          } else {
            if (vz > peakZ) peakZ = vz;
            if (vz < baseZ) baseZ = vz;
          }
        }
      }

      if (Number.isFinite(peakZ) && Number.isFinite(baseZ)) {
        zOcclusal = Number(peakZ.toFixed(2));
        const clinicalCrownH =
          seed.morphology === 'molar1' || seed.morphology === 'molar2'
            ? 4.2
            : seed.morphology === 'premolar'
            ? 4.4
            : 4.6;
        zCervical = Number(
          (isUpper
            ? peakZ + clinicalCrownH
            : peakZ - clinicalCrownH
          ).toFixed(2)
        );
        // If occlusal peak is very close to the gingival base, the site is edentulous in baseline scan
        const verticalRelief = Math.abs(baseZ - peakZ);
        presentInBaseline = isUpper ? peakZ < 5.2 && verticalRelief > 3.8 : peakZ > -1.2 && verticalRelief > 3.8;

        // Refine XY center toward the occlusal cusp vertices
        const zCut = isUpper ? peakZ + 3.2 : peakZ - 3.2;
        for (let i = 0; i < count; i += stride) {
          const idx = i * 3;
          const vx = origPos[idx];
          const vy = origPos[idx + 1];
          const vz = origPos[idx + 2];
          if (
            Math.abs(vx - cx) <= rSearchX &&
            Math.abs(vy - cy) <= rSearchY &&
            (isUpper ? vz <= zCut : vz >= zCut)
          ) {
            crownSumX += vx;
            crownSumY += vy;
            crownCount++;
          }
        }
        if (crownCount >= 4) {
          cx = cx * 0.35 + (crownSumX / crownCount) * 0.65;
          cy = cy * 0.35 + (crownSumY / crownCount) * 0.65;
        }
      }
    }

    const cz = Number(((zOcclusal + zCervical) * 0.5).toFixed(2));

    return {
      fdi: seed.fdi,
      isUpper,
      morphology: seed.morphology,
      labelZh: seed.labelZh,
      labelEn: seed.labelEn,
      center: {
        x: Number(cx.toFixed(2)),
        y: Number(cy.toFixed(2)),
        z: cz,
      },
      radiusXY: { rx: seed.rx, ry: seed.ry },
      angleDeg,
      zCervical,
      zOcclusal,
      presentInBaseline,
    };
  });
}

/**
 * Identify the closest tooth (either a placed library/pasted tooth OR a native FDI tooth)
 * to a 3D hit point on the dental arch.
 */
export function identifyToothAtPoint3D(
  point: Point3D,
  isUpper: boolean,
  segmentedTeeth: SegmentedToothInfo[],
  placedTeeth: PlacedLibraryTooth[] = [],
  nativeEdits: Record<number, NativeToothEditOperation> = {}
): SelectedToothTarget | null {
  // 1. Check placed library/pasted teeth on this arch first
  let bestPlacedId: string | null = null;
  let bestPlacedDist = 8.5;

  for (const p of placedTeeth) {
    if (p.isUpper !== isUpper) continue;
    const d = Math.hypot(
      point.x - p.position.x,
      point.y - p.position.y,
      (point.z - p.position.z) * 0.75
    );
    if (d < bestPlacedDist) {
      bestPlacedDist = d;
      bestPlacedId = p.id;
    }
  }

  if (bestPlacedId) {
    return { kind: 'placed', placedId: bestPlacedId };
  }

  // 2. Check native FDI teeth on this arch (using oriented dental arch ellipse & 3D Z occlusal-cervical bounds)
  let bestFdi: FdiToothNumber | null = null;
  let bestScore = 2.4;

  for (const t of segmentedTeeth) {
    if (t.isUpper !== isUpper) continue;
    const edit = nativeEdits[t.fdi];
    const ox = edit && !edit.deleted ? edit.offsetMm.x : 0;
    const oy = edit && !edit.deleted ? edit.offsetMm.y : 0;
    const oz = edit && !edit.deleted ? edit.offsetMm.z : 0;

    const rad = (t.angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    const tx = point.x - (t.center.x + ox);
    const ty = point.y - (t.center.y + oy);
    const u = (tx * cosA + ty * sinA) / Math.max(2.5, t.radiusXY.rx);
    const v = (-tx * sinA + ty * cosA) / Math.max(2.5, t.radiusXY.ry);
    const distXY = Math.hypot(u, v);

    // Occlusal-to-cervical vertical distance factor
    const crownZ = (t.zOcclusal + t.zCervical) * 0.5 + oz;
    const halfH = Math.max(3.0, Math.abs(t.zCervical - t.zOcclusal) * 0.5);
    const distZ = Math.abs(point.z - crownZ) / halfH;

    const totalScore = Math.hypot(distXY, distZ * 0.55);
    if (totalScore < bestScore) {
      bestScore = totalScore;
      bestFdi = t.fdi;
    }
  }

  if (bestFdi !== null) {
    return { kind: 'native', fdi: bestFdi };
  }

  return null;
}

/**
 * Extracts a discrete, independent 3D Tooth Object crown BufferGeometry
 * from a source dental arch BufferGeometry for a specific segmented tooth.
 * Vertices are centered at (0, 0, 0) relative to the tooth centroid so that
 * rigid translation, rotation, and scaling can be applied directly to the Tooth Object mesh.
 * Preserves the exact scanned patient tooth anatomy, cusps, and vertex colors.
 */
export function extractToothCrownGeometry(
  sourceGeom: THREE.BufferGeometry | null | undefined,
  tooth: SegmentedToothInfo
): THREE.BufferGeometry {
  if (!sourceGeom) {
    return createLibraryToothGeometry(tooth.morphology, tooth.isUpper);
  }

  const posAttr = sourceGeom.getAttribute('position');
  if (!posAttr) {
    return createLibraryToothGeometry(tooth.morphology, tooth.isUpper);
  }

  // Use unmutated original scan positions if available
  const origPos =
    (sourceGeom.userData?.origEditPos as Float32Array | undefined) ||
    (posAttr.array as Float32Array);
  const origColAttr = sourceGeom.getAttribute('color') as THREE.BufferAttribute | undefined;

  const rad = (tooth.angleDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const cx = tooth.center.x;
  const cy = tooth.center.y;
  const cz = tooth.center.z;
  const rx = Math.max(3.2, tooth.radiusXY.rx * 1.15);
  const ry = Math.max(3.2, tooth.radiusXY.ry * 1.15);
  const isUpper = tooth.isUpper;
  const zCerv = tooth.zCervical + (isUpper ? 0.8 : -0.8);

  const index = sourceGeom.getIndex();
  const triPositions: number[] = [];
  const triColors: number[] = [];

  const getVertex = (vIdx: number) => {
    const base = vIdx * 3;
    return {
      x: origPos[base],
      y: origPos[base + 1],
      z: origPos[base + 2],
    };
  };

  const checkTriangle = (i0: number, i1: number, i2: number) => {
    const v0 = getVertex(i0);
    const v1 = getVertex(i1);
    const v2 = getVertex(i2);

    const mx = (v0.x + v1.x + v2.x) / 3;
    const my = (v0.y + v1.y + v2.y) / 3;
    const mz = (v0.z + v1.z + v2.z) / 3;

    const dx = mx - cx;
    const dy = my - cy;
    const u = (dx * cosA + dy * sinA) / rx;
    const v = (-dx * sinA + dy * cosA) / ry;
    if (u * u + v * v > 1.15) return;

    if (isUpper ? mz > zCerv : mz < zCerv) return;

    // Triangle belongs to this discrete tooth crown object
    triPositions.push(
      v0.x - cx, v0.y - cy, v0.z - cz,
      v1.x - cx, v1.y - cy, v1.z - cz,
      v2.x - cx, v2.y - cy, v2.z - cz
    );

    if (origColAttr) {
      triColors.push(
        origColAttr.getX(i0), origColAttr.getY(i0), origColAttr.getZ(i0),
        origColAttr.getX(i1), origColAttr.getY(i1), origColAttr.getZ(i1),
        origColAttr.getX(i2), origColAttr.getY(i2), origColAttr.getZ(i2)
      );
    } else {
      // Natural pearl enamel gradient coloring with warm cervical roll
      const tZ = isUpper
        ? Math.max(0, Math.min(1, (mz - tooth.zOcclusal) / Math.max(1, tooth.zCervical - tooth.zOcclusal)))
        : Math.max(0, Math.min(1, (tooth.zOcclusal - mz) / Math.max(1, tooth.zOcclusal - tooth.zCervical)));

      const r = 0.96 - tZ * 0.06;
      const g = 0.95 - tZ * 0.10;
      const b = 0.91 - tZ * 0.15;
      triColors.push(r, g, b, r, g, b, r, g, b);
    }
  };

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      checkTriangle(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    }
  } else {
    const vertCount = Math.floor(origPos.length / 3);
    for (let i = 0; i < vertCount; i += 3) {
      checkTriangle(i, i + 1, i + 2);
    }
  }

  // If sufficient triangles were extracted from the scan (at least 24 triangles), return the extracted crown!
  if (triPositions.length >= 72) {
    // Build smooth anatomical cervical emergence profile / sealing floor
    // so the tooth object is a watertight manifold entity that smoothly interfaces with gingival tissue
    const cervicalRingPoints: Array<{ x: number; y: number; z: number; angle: number }> = [];
    const zThreshold = 1.35;
    const count = Math.floor(triPositions.length / 3);
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const x = triPositions[idx];
      const y = triPositions[idx + 1];
      const z = triPositions[idx + 2];
      const worldZ = z + cz;
      if (Math.abs(worldZ - zCerv) <= zThreshold) {
        const u = x * cosA + y * sinA;
        const v = -x * sinA + y * cosA;
        const angle = Math.atan2(v, u);
        cervicalRingPoints.push({ x, y, z, angle });
      }
    }

    if (cervicalRingPoints.length >= 12) {
      cervicalRingPoints.sort((a, b) => a.angle - b.angle);
      const numSectors = 24;
      const sectorBest: Array<{ x: number; y: number; z: number } | null> = new Array(numSectors).fill(null);
      for (const pt of cervicalRingPoints) {
        const normAngle = (pt.angle + Math.PI) / (2 * Math.PI);
        const sIdx = Math.min(numSectors - 1, Math.floor(normAngle * numSectors));
        if (!sectorBest[sIdx]) {
          sectorBest[sIdx] = pt;
        }
      }

      const ringPts = sectorBest.filter(Boolean) as Array<{ x: number; y: number; z: number }>;
      if (ringPts.length >= 8) {
        const apexZ = zCerv - cz + (isUpper ? 0.85 : -0.85);
        const apexX = 0;
        const apexY = 0;

        for (let i = 0; i < ringPts.length; i++) {
          const nextIdx = (i + 1) % ringPts.length;
          const p0 = ringPts[i];
          const p1 = ringPts[nextIdx];

          if (isUpper) {
            triPositions.push(apexX, apexY, apexZ, p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
          } else {
            triPositions.push(apexX, apexY, apexZ, p1.x, p1.y, p1.z, p0.x, p0.y, p0.z);
          }

          // Natural warm cervical root dentin / mucosal collar transition (RGB: 0.92, 0.86, 0.76)
          triColors.push(
            0.92, 0.86, 0.76,
            0.94, 0.90, 0.82,
            0.94, 0.90, 0.82
          );
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(triPositions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(triColors, 3));
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    return geom;
  }

  // Fallback to anatomical tooth library preset for edentulous/missing baseline sites
  return createLibraryToothGeometry(tooth.morphology, tooth.isUpper);
}

/**
 * Generates an oral mucosal Gingiva Base BufferGeometry with smoothed alveolar ridges / tooth sockets.
 * Sites of deleted or displaced teeth are smoothly recessed into healed mucosal sockets,
 * while intact teeth sites retain their natural full geometry without tearing or jagged cliffs.
 */
export function createGingivaBaseGeometry(
  sourceGeom: THREE.BufferGeometry,
  segmentedTeeth: SegmentedToothInfo[],
  isUpper: boolean,
  nativeEdits?: Record<number, NativeToothEditOperation>,
  forceAllRecessed?: boolean,
  placedTeeth?: PlacedLibraryTooth[]
): THREE.BufferGeometry {
  const geom = sourceGeom.clone();
  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
  if (!posAttr) return geom;

  const count = posAttr.count;
  const pos = posAttr.array as Float32Array;

  // Cache original unedited positions on geom.userData
  if (!geom.userData.origEditPos) {
    geom.userData.origEditPos = new Float32Array(pos);
  }
  const origPos = geom.userData.origEditPos as Float32Array;

  // Setup per-vertex colors
  const origColAttr = sourceGeom.getAttribute('color') as THREE.BufferAttribute | undefined;
  let col: Float32Array;
  if (origColAttr && origColAttr.array.length === count * 3) {
    col = new Float32Array(origColAttr.array);
  } else {
    col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      col[i * 3] = 0.96;
      col[i * 3 + 1] = 0.95;
      col[i * 3 + 2] = 0.91;
    }
  }

  const archTeeth = segmentedTeeth.filter((t) => t.isUpper === isUpper);
  const archPlaced = (placedTeeth || []).filter((p) => p.isUpper === isUpper);

  // Determine which tooth sites require alveolar socket recessing:
  // - Sites where the native tooth is deleted (extracted) -> ALWAYS recess native crown to alveolar ridge!
  // - Sites where the native tooth has been moved away from its native position
  // - Or all sites if forceAllRecessed is explicitly set (e.g. edentulous base inspection)
  const recessedFdis = new Set<number>();
  for (const t of archTeeth) {
    const edit = nativeEdits?.[t.fdi];
    const isDeleted = Boolean(edit?.deleted);
    const isMoved = Boolean(
      edit &&
      !isDeleted &&
      (Math.hypot(edit.offsetMm.x, edit.offsetMm.y, edit.offsetMm.z) > 0.35 ||
        Math.abs(edit.rotationDeg) > 0.5 ||
        Math.abs(edit.scale - 1.0) > 0.05)
    );

    if (forceAllRecessed || isDeleted || isMoved) {
      recessedFdis.add(t.fdi);
    }
  }

  const smoothstep = (e0: number, e1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  const hasModifications = recessedFdis.size > 0 || archPlaced.length > 0;

  if (hasModifications) {
    const targetTeeth = archTeeth.filter((t) => recessedFdis.has(t.fdi));
    const intactTeeth = archTeeth.filter((t) => !recessedFdis.has(t.fdi));

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const x = origPos[idx];
      const y = origPos[idx + 1];
      let z = origPos[idx + 2];

      // A. Intact native teeth protection: Protect intact tooth crown enamel while allowing embrasure soft-tissue blending
      let isInsideIntactTooth = false;
      for (const it of intactTeeth) {
        const rad = (it.angleDeg * Math.PI) / 180;
        const dx = x - it.center.x;
        const dy = y - it.center.y;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        const u = (dx * cosA + dy * sinA) / it.radiusXY.rx;
        const v = (-dx * sinA + dy * cosA) / it.radiusXY.ry;
        if (u * u + v * v <= 0.98) {
          isInsideIntactTooth = true;
          break;
        }
      }
      if (isInsideIntactTooth) {
        pos[idx + 2] = z;
        continue;
      }

      // B. Smooth continuous alveolar ridge for deleted or displaced native teeth
      let maxRecessWeight = 0;
      let targetRidgeZ = z;

      for (const t of targetTeeth) {
        const rad = (t.angleDeg * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        const dx = x - t.center.x;
        const dy = y - t.center.y;
        const u = (dx * cosA + dy * sinA) / t.radiusXY.rx;
        const v = (-dx * sinA + dy * cosA) / t.radiusXY.ry;
        const edit = nativeEdits?.[t.fdi];
        const isDeleted = Boolean(edit?.deleted);
        const moveDist = edit ? Math.hypot(edit.offsetMm.x, edit.offsetMm.y, edit.offsetMm.z) : 0;
        const moveScale =
          isDeleted || forceAllRecessed
            ? 1.0
            : moveDist < 0.05
            ? 0.0
            : Math.min(1.0, moveDist / 1.5);
        const dist2 = u * u + v * v;
        if (dist2 <= 1.69) {
          const dist = Math.sqrt(dist2);
          // Recess 100% of the tooth crown envelope (dist <= 0.95), then smooth organic fade to dist = 1.30
          const weight = (1.0 - smoothstep(0.92, 1.28, dist)) * moveScale;
          if (weight > maxRecessWeight) {
            maxRecessWeight = weight;
            targetRidgeZ = t.zCervical + (isUpper ? 0.25 : -0.25);
          }
        }
      }

      if (maxRecessWeight > 0.01) {
        const origZ = origPos[idx + 2];
        const isCoronalTissue = isUpper
          ? origZ <= targetRidgeZ + 2.5
          : origZ >= targetRidgeZ - 2.5;

        if (isCoronalTissue) {
          const protrusion = isUpper ? targetRidgeZ - z : z - targetRidgeZ;
          if (protrusion > 0) {
            z = z + (isUpper ? protrusion : -protrusion) * maxRecessWeight * 0.96;

            // Oral mucosal coral pink color for healed/exposed alveolar ridge
            const mucosalR = 0.933;
            const mucosalG = 0.450;
            const mucosalB = 0.540;
            col[idx] = col[idx] * (1 - maxRecessWeight) + mucosalR * maxRecessWeight;
            col[idx + 1] = col[idx + 1] * (1 - maxRecessWeight) + mucosalG * maxRecessWeight;
            col[idx + 2] = col[idx + 2] * (1 - maxRecessWeight) + mucosalB * maxRecessWeight;
          }
        }
      }

      // C. Human anatomical gingival integration (Free gingival margin collar, interdental papillae, and alveolar juga)
      for (const p of archPlaced) {
        const meta = getLibraryItemMeta(p.morphology);
        const rx = meta.defaultWidthMm * 0.5 * p.scale;
        const ry = meta.defaultLengthMm * 0.5 * p.scale;
        const rad = (p.rotationDeg * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        const dx = x - p.position.x;
        const dy = y - p.position.y;
        const u = (dx * cosA + dy * sinA) / rx;
        const v = (-dx * sinA + dy * cosA) / ry;
        const dist2 = u * u + v * v;

        // Soft-tissue adaptation zone: dist <= 1.60
        if (dist2 <= 2.56) {
          const origZ = origPos[idx + 2];
          // Cervical reference height
          const refCervicalZ = p.position.z + (isUpper ? 1 : -1) * 1.8 * p.scale;

          // STRICT DEPTH GUARD: Only coronal alveolar ridge & gingival tissue adapts.
          // Deep mandibular/palatal base vertices MUST NOT be altered!
          const isCoronalTissue = isUpper
            ? origZ <= refCervicalZ + 2.5
            : origZ >= refCervicalZ - 2.5;

          if (!isCoronalTissue) {
            continue;
          }

          const dist = Math.sqrt(dist2);
          const phi = Math.atan2(v, u); // Local angle: +v is mesial (towards adjacent tooth #36), +u is buccal

          // 1. Interdental Papilla Elevation (rises in mesial & distal embrasures)
          // Peaks higher on mesial side (v > 0) to bridge into the adjacent tooth embrasure
          const mesialWeight = smoothstep(-0.1, 0.7, v);
          const papillaPeakMm = (isUpper ? -1.35 : 1.35) * Math.sin(phi) ** 2 * (0.7 + 0.3 * mesialWeight) * p.scale;

          // 2. Buccal Gingival Zenith Dip (scalloped U-shape curve on buccal facial surface)
          const zenithDipMm = (isUpper ? 0.30 : -0.30) * Math.max(0, Math.cos(phi)) ** 2 * p.scale;

          // Target height for the free gingival margin collar
          const targetMarginZ = refCervicalZ + papillaPeakMm + zenithDipMm;

          // 3. Emergence Profile Adaptation:
          // - Ovate Pontic: smooth convex depression for tissue conditioning (0.4 - 0.7mm)
          // - Anatomical / Implant: gentle collar seal with free margin elevation
          const isOvate = p.emergenceProfile === 'ovate';
          const subDepth = p.subgingivalDepthMm ?? (isOvate ? 0.5 : 0.2);

          let targetZ = z;
          let zoneWeight = 0;

          if (dist <= 0.88) {
            // Intaglio / receptor bed directly beneath crown base
            if (isOvate) {
              const domeFactor = Math.cos(dist / 0.88 * Math.PI * 0.5);
              const ovateDepression = (isUpper ? 1 : -1) * subDepth * domeFactor;
              targetZ = refCervicalZ + ovateDepression;
              zoneWeight = 0.85;
            } else {
              targetZ = refCervicalZ + (isUpper ? 0.2 : -0.2);
              zoneWeight = 0.75;
            }
          } else if (dist <= 1.22) {
            // Free gingival margin collar hugging tooth CEJ
            const collarPeak = smoothstep(0.88, 1.05, dist) * (1.0 - smoothstep(1.08, 1.22, dist));
            targetZ = targetMarginZ;
            zoneWeight = 0.55 + 0.40 * collarPeak;
          } else {
            // Attached gingiva fade-out to the native alveolar ridge
            const fade = 1.0 - smoothstep(1.22, 1.60, dist);
            const isBuccal = u > 0;
            const rootBulgeMm = isBuccal
              ? (isUpper ? -0.35 : 0.35) * Math.sin(smoothstep(1.20, 1.58, dist) * Math.PI) * (u / dist)
              : 0;
            targetZ = refCervicalZ * fade + z * (1 - fade) + rootBulgeMm;
            zoneWeight = fade * 0.75;
          }

          const adaptation = p.gingivalAdaptation !== undefined ? p.gingivalAdaptation : 1.0;
          const blendStrength = zoneWeight * adaptation * 0.88;

          // CLAMP DISPLACEMENT: Biological gingival drape displacement is strictly bounded
          // Elevation (papilla/collar): max 1.5mm. Depression (socket/zenith): max 0.8mm.
          const rawDeltaZ = (targetZ - z) * blendStrength;
          const maxElevation = 1.5;
          const maxDepression = 0.8;
          let clampedDeltaZ = rawDeltaZ;
          if (isUpper) {
            // Upper: negative delta is coronal elevation, positive is apical depression
            clampedDeltaZ = Math.max(-maxElevation, Math.min(maxDepression, rawDeltaZ));
          } else {
            // Lower: positive delta is coronal elevation, negative is apical depression
            clampedDeltaZ = Math.min(maxElevation, Math.max(-maxDepression, rawDeltaZ));
          }

          z += clampedDeltaZ;

          // 4. Clinical mucosal coloration matching natural gingival histology:
          // - Free margin & papillae (dist <= 1.22): Light vibrant coral-pink (RGB: 0.965, 0.537, 0.620)
          // - Attached gingiva (1.22 < dist <= 1.50): Vibrant coral (RGB: 0.933, 0.412, 0.510)
          // - Alveolar mucosa (dist > 1.50): Deep rose (RGB: 0.859, 0.298, 0.408)
          let gR = 0.933, gG = 0.412, gB = 0.510;
          if (dist <= 1.22) {
            gR = 0.965; gG = 0.537; gB = 0.620;
          } else if (dist <= 1.45) {
            const tZone = (dist - 1.22) / 0.23;
            gR = 0.965 * (1 - tZone) + 0.933 * tZone;
            gG = 0.537 * (1 - tZone) + 0.412 * tZone;
            gB = 0.620 * (1 - tZone) + 0.510 * tZone;
          } else {
            const tZone = Math.min(1.0, (dist - 1.45) / 0.15);
            gR = 0.933 * (1 - tZone) + 0.859 * tZone;
            gG = 0.412 * (1 - tZone) + 0.298 * tZone;
            gB = 0.510 * (1 - tZone) + 0.408 * tZone;
          }

          const colorBlend = Math.min(1.0, blendStrength * 1.35);
          col[idx] = col[idx] * (1 - colorBlend) + gR * colorBlend;
          col[idx + 1] = col[idx + 1] * (1 - colorBlend) + gG * colorBlend;
          col[idx + 2] = col[idx + 2] * (1 - colorBlend) + gB * colorBlend;
        }
      }

      pos[idx + 2] = z;
    }
  } else {
    pos.set(origPos);
  }

  posAttr.needsUpdate = true;
  geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geom.computeVertexNormals();
  return geom;
}

const libraryGeometryCache = new Map<string, THREE.BufferGeometry>();

/**
 * Generates a high-resolution, closed, anatomically realistic 3D prosthetic tooth crown BufferGeometry
 * for the 3D Tooth Library and Copy/Paste system.
 * Incorporates 3D scalloped CEJ margins and clinical emergence profile modes (Anatomical, Ovate Pontic, Implant).
 * Cached by morphology, arch & emergence mode for <0.1ms cloning.
 */
export function createLibraryToothGeometry(
  morphology: ToothMorphologyType,
  isUpper: boolean,
  emergenceProfile: EmergenceProfileType = 'anatomical'
): THREE.BufferGeometry {
  const cacheKey = `${morphology}:${isUpper ? 'u' : 'l'}:${emergenceProfile}`;
  const cached = libraryGeometryCache.get(cacheKey);
  if (cached) {
    return cached.clone();
  }

  const segU = 36;
  const segV = 24;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Anatomical dimensions in mm:
  // u axis = Buccal (+u) to Lingual (-u), v axis = Mesial (+v) to Distal (-v)
  let ru = 4.2;
  let rv = 4.0;
  let crownHeight = 5.2;

  if (morphology === 'central') {
    ru = 3.6;
    rv = isUpper ? 4.3 : 3.0;
    crownHeight = isUpper ? 6.2 : 5.4;
  } else if (morphology === 'lateral') {
    ru = 3.4;
    rv = isUpper ? 3.5 : 3.1;
    crownHeight = isUpper ? 5.8 : 5.2;
  } else if (morphology === 'canine') {
    ru = 4.1;
    rv = 3.9;
    crownHeight = isUpper ? 6.4 : 5.8;
  } else if (morphology === 'premolar') {
    ru = 4.4;
    rv = 3.7;
    crownHeight = 5.2;
  } else if (morphology === 'molar1') {
    ru = 5.2;
    rv = 5.1;
    crownHeight = 5.2;
  } else if (morphology === 'molar2') {
    ru = 4.9;
    rv = 4.7;
    crownHeight = 5.0;
  }

  const sign = isUpper ? -1 : 1; // Upper crown tip points toward -Z, cervical collar toward +Z

  for (let iv = 0; iv <= segV; iv++) {
    // t in [0, 1]: 0 = occlusal/incisal center, 0.80 = cervical CEJ line, 1.0 = closed apical emergence base
    const t = iv / segV;

    for (let iu = 0; iu <= segU; iu++) {
      const theta = (iu / segU) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Superellipse radial profile for realistic squarish-rounded molar/incisor outlines
      const p = morphology === 'molar1' || morphology === 'molar2' ? 2.45 : 2.15;
      const denom = Math.pow(
        Math.pow(Math.abs(cosT), p) + Math.pow(Math.abs(sinT), p),
        1 / p
      ) || 1;
      const baseU = (cosT / denom) * smoothstep(0.0, 0.85, t);
      const baseV = (sinT / denom) * smoothstep(0.0, 0.85, t);

      // Equatorial anatomical bulge & subgingival emergence root profile
      let radialEnv = 1.0;
      if (t <= 0.80) {
        radialEnv = Math.sin((t / 0.80) * Math.PI * 0.78) * 1.06;
      } else {
        const rootT = (t - 0.80) / 0.20; // 0 (CEJ) -> 1 (Apex)
        if (emergenceProfile === 'ovate') {
          // Ovate Pontic (smooth convex egg-dome for aligners and tissue conditioning)
          radialEnv = Math.sqrt(Math.max(0, 1.0 - rootT * rootT)) * 0.76;
        } else if (emergenceProfile === 'implant') {
          // Implant Subcritical Contour (Su & Weisgold concave S-curve flare into platform)
          const concave = 0.74 * Math.pow(1.0 - rootT, 1.5) + 0.32 * (1.0 - rootT);
          radialEnv = Math.max(0, concave);
        } else {
          // Anatomical Natural root trunk collar
          radialEnv = Math.max(0, (1.0 - Math.pow(rootT, 1.25)) * 0.72);
        }
      }

      const uNorm = baseU * radialEnv;
      const vNorm = baseV * radialEnv;

      // Occlusal / Incisal 3D Cusp & Fissure Morphology (active on coronal table t < 0.58)
      const tableEnv = 1.0 - smoothstep(0.28, 0.62, t);
      let anatomyOffset = 0;
      let fissureDepth = 0;
      let cuspPeak = 0;

      if (morphology === 'molar1' || morphology === 'molar2') {
        const cMB = Math.exp(-((uNorm - 0.44) ** 2 / 0.16 + (vNorm + 0.42) ** 2 / 0.16)) * 1.0;
        const cDB = Math.exp(-((uNorm - 0.40) ** 2 / 0.15 + (vNorm - 0.42) ** 2 / 0.15)) * 0.9;
        const cML = Math.exp(-((uNorm + 0.42) ** 2 / 0.18 + (vNorm + 0.36) ** 2 / 0.18)) * 0.96;
        const cDL = Math.exp(-((uNorm + 0.38) ** 2 / 0.14 + (vNorm - 0.44) ** 2 / 0.14)) * 0.84;
        const grooveMD = Math.exp(-(uNorm * uNorm) / 0.032) * Math.exp(-(vNorm * vNorm) / 0.5);
        const grooveBL = Math.exp(-(vNorm * vNorm) / 0.03) * Math.exp(-(uNorm * uNorm) / 0.48);
        const margRidge =
          Math.exp(-((Math.abs(vNorm) - 0.7) ** 2) / 0.04) *
          Math.exp(-(uNorm * uNorm) / 0.36) *
          0.46;

        cuspPeak = Math.max(cMB, cDB, cML, cDL, margRidge);
        fissureDepth = Math.max(grooveMD, grooveBL * 0.82);
        anatomyOffset = 1.35 * cuspPeak - 1.05 * fissureDepth;
      } else if (morphology === 'premolar') {
        const cB = Math.exp(-((uNorm - 0.44) ** 2 / 0.18 + (vNorm * vNorm) / 0.3)) * 1.05;
        const cL = Math.exp(-((uNorm + 0.42) ** 2 / 0.16 + (vNorm * vNorm) / 0.26)) * 0.9;
        const grooveMD = Math.exp(-(uNorm * uNorm) / 0.03) * Math.exp(-(vNorm * vNorm) / 0.38);
        cuspPeak = Math.max(cB, cL);
        fissureDepth = grooveMD;
        anatomyOffset = 1.25 * cuspPeak - 0.95 * fissureDepth;
      } else if (morphology === 'canine') {
        const coneTip = Math.exp(-((uNorm - 0.18) ** 2 / 0.22 + (vNorm * vNorm) / 0.22)) * 1.45;
        const cingulum = Math.exp(-((uNorm + 0.45) ** 2 / 0.18 + (vNorm * vNorm) / 0.28)) * 0.45;
        cuspPeak = Math.max(coneTip, cingulum);
        anatomyOffset = cuspPeak;
      } else {
        // Central / Lateral Incisor chisel blade + lingual fossa + cingulum
        const incisalBlade =
          Math.exp(-((uNorm - 0.22) ** 2) / 0.09) *
          (1.0 - 0.22 * Math.pow(vNorm, 2)) *
          1.25;
        const lingualFossa =
          Math.exp(-((uNorm + 0.15) ** 2 / 0.16 + (vNorm * vNorm) / 0.28)) * 0.45;
        const cingulum =
          Math.exp(-((uNorm + 0.52) ** 2 / 0.16 + (vNorm * vNorm) / 0.28)) * 0.55;
        cuspPeak = Math.max(incisalBlade, cingulum);
        fissureDepth = lingualFossa;
        anatomyOffset = incisalBlade + cingulum - lingualFossa;
      }

      const x = uNorm * ru;
      const y = vNorm * rv;

      // 3D Anatomical Scalloped CEJ Curve (peaks coronally at mesial/distal, dips apically at buccal/lingual)
      const cejScallop = (Math.sin(theta) ** 2 * 0.40 - Math.cos(theta) * 0.15) * smoothstep(0.65, 0.85, t);

      // Vertical Z coordinate centered around 0 (occlusal at sign * crownHeight * 0.46, cervical at -sign * crownHeight * 0.35)
      const zBase = (0.46 - smoothstep(0.08, 0.92, t) * 0.94) * crownHeight;
      const z = sign * (zBase + anatomyOffset * tableEnv - cejScallop);

      positions.push(x, y, z);

      // Clinical VITA Enamel -> Cervical Dentin -> Subgingival Collar Shading
      const cervFactor = smoothstep(0.45, 0.80, t);
      const rootCollarMask = smoothstep(0.78, 0.86, t);
      const fisShade = Math.min(1, fissureDepth * tableEnv * 1.1);

      // Warm translucent pearl-ivory enamel (RGB in 0..1)
      const eR = 0.96 - cervFactor * 0.04 - fisShade * 0.14 + cuspPeak * 0.02;
      const eG = 0.94 - cervFactor * 0.08 - fisShade * 0.20 + cuspPeak * 0.02;
      const eB = 0.89 - cervFactor * 0.12 - fisShade * 0.23 + cuspPeak * 0.015;

      // Subgingival tissue-adapted cervical collar (warm mucosal-cementum tone RGB: 0.88, 0.70, 0.65)
      const gR = emergenceProfile === 'implant' ? 0.82 : 0.88;
      const gG = emergenceProfile === 'implant' ? 0.64 : 0.70;
      const gB = emergenceProfile === 'implant' ? 0.62 : 0.65;

      colors.push(
        eR * (1 - rootCollarMask) + gR * rootCollarMask,
        eG * (1 - rootCollarMask) + gG * rootCollarMask,
        eB * (1 - rootCollarMask) + gB * rootCollarMask
      );
    }
  }

  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = iv * stride + (iu + 1);
      const c = (iv + 1) * stride + (iu + 1);
      const d = (iv + 1) * stride + iu;

      if (iv === 0) {
        // Occlusal apex closure fan (non-degenerate)
        if (isUpper) {
          indices.push(a, b, c);
        } else {
          indices.push(a, c, b);
        }
      } else if (iv === segV - 1) {
        // Apical root / pontic base closure fan (non-degenerate)
        if (isUpper) {
          indices.push(a, b, d);
        } else {
          indices.push(a, d, b);
        }
      } else {
        // Manifold quad body
        if (isUpper) {
          indices.push(a, b, c, a, c, d);
        } else {
          indices.push(a, c, b, a, d, c);
        }
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingBox();

  libraryGeometryCache.set(cacheKey, geom);
  return geom.clone();
}

/**
 * Restores a BufferGeometry's original unedited vertex positions and colors before applying new edits.
 */
export function restoreNativeGeometryBeforeEdits(geom: THREE.BufferGeometry): void {
  const origPos = geom.userData.origEditPos as Float32Array | undefined;
  if (origPos) {
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (posAttr && posAttr.array.length === origPos.length) {
      (posAttr.array as Float32Array).set(origPos);
      posAttr.needsUpdate = true;
    } else {
      geom.setAttribute('position', new THREE.Float32BufferAttribute(origPos.slice(), 3));
    }
  }

  const origCol = geom.userData.origEditCol as Float32Array | undefined;
  if (origCol) {
    const colAttr = geom.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (colAttr && colAttr.array.length === origCol.length) {
      (colAttr.array as Float32Array).set(origCol);
      colAttr.needsUpdate = true;
    } else {
      geom.setAttribute('color', new THREE.Float32BufferAttribute(origCol.slice(), 3));
    }
  } else if (geom.userData.hadOrigEditCol === false) {
    geom.deleteAttribute('color');
  }
}

/**
 * Applies native tooth edits (Tooth Deletions / Extractions + 3D Dragging / Rotation / Scaling of existing teeth)
 * directly to an Upper or Lower BufferGeometry in real time.
 * Returns true if any vertex was modified.
 */
export function applyNativeToothEditsToGeometry(
  geom: THREE.BufferGeometry,
  isUpper: boolean,
  segmentedTeeth: SegmentedToothInfo[],
  nativeEdits: Record<number, NativeToothEditOperation>
): boolean {
  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!posAttr) return false;

  // Backup pristine vertex positions & colors once before the first edit
  if (!geom.userData.origEditPos) {
    geom.userData.origEditPos = new Float32Array(posAttr.array as ArrayLike<number>);
    const colAttr = geom.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (colAttr) {
      geom.userData.origEditCol = new Float32Array(colAttr.array as ArrayLike<number>);
      geom.userData.hadOrigEditCol = true;
    } else {
      geom.userData.hadOrigEditCol = false;
    }
  }

  const activeOps: Array<{ info: SegmentedToothInfo; op: NativeToothEditOperation }> = [];
  for (const info of segmentedTeeth) {
    if (info.isUpper !== isUpper) continue;
    const op = nativeEdits[info.fdi];
    if (!op) continue;
    const hasTransform =
      Math.abs(op.offsetMm.x) > 0.001 ||
      Math.abs(op.offsetMm.y) > 0.001 ||
      Math.abs(op.offsetMm.z) > 0.001 ||
      Math.abs(op.rotationDeg) > 0.01 ||
      Math.abs(op.scale - 1.0) > 0.005;
    if (op.deleted || hasTransform) {
      activeOps.push({ info, op });
    }
  }

  if (activeOps.length === 0) {
    restoreNativeGeometryBeforeEdits(geom);
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    return false;
  }

  const origPos = geom.userData.origEditPos as Float32Array;
  const origCol = geom.userData.origEditCol as Float32Array | undefined;
  const count = posAttr.count;

  const dstPos = posAttr.array as Float32Array;
  dstPos.set(origPos);

  let colAttr = geom.getAttribute('color') as THREE.BufferAttribute | undefined;
  let dstCol: Float32Array;
  if (colAttr && colAttr.array instanceof Float32Array && colAttr.array.length === count * 3) {
    dstCol = colAttr.array;
    if (origCol) {
      dstCol.set(origCol);
    } else {
      dstCol.fill(0.96);
    }
  } else {
    dstCol = origCol ? new Float32Array(origCol) : new Float32Array(count * 3).fill(0.96);
    colAttr = new THREE.Float32BufferAttribute(dstCol, 3);
    geom.setAttribute('color', colAttr);
  }

  for (const { info, op } of activeOps) {
    const cx = info.center.x;
    const cy = info.center.y;
    const rx = Math.max(3.0, info.radiusXY.rx * 1.12);
    const ry = Math.max(3.0, info.radiusXY.ry * 1.12);
    const zCerv = info.zCervical;

    if (op.deleted) {
      // Smoothly extract/delete the tooth crown into a healed alveolar gingival ridge saddle
      const rad = (info.angleDeg * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const x = dstPos[idx];
        const y = dstPos[idx + 1];
        const z = dstPos[idx + 2];

        const dx = x - cx;
        const dy = y - cy;
        const u = (dx * cosA + dy * sinA) / rx;
        const v = (-dx * sinA + dy * cosA) / ry;
        const rEll = Math.hypot(u, v);
        if (rEll >= 1.22) continue;

        const wXY = 1.0 - smoothstep(0.68, 1.20, rEll);
        const uClamped = Math.max(-1.1, Math.min(1.1, u));
        const zSaddle = isUpper
          ? zCerv + 1.8 * (uClamped * uClamped)
          : zCerv - 1.8 * (uClamped * uClamped);

        const crownProtrusion = isUpper ? zSaddle - z : z - zSaddle;
        if (crownProtrusion > 0) {
          const wZ = wXY * smoothstep(0.0, 0.6, crownProtrusion);
          dstPos[idx + 2] = isUpper
            ? z + wZ * crownProtrusion
            : z - wZ * crownProtrusion;

          // Slight ridge narrowing where crown was extracted
          const contract = wZ * 0.34 * Math.min(1, crownProtrusion / 5.5);
          const uNew = u * (1 - contract) * rx;
          const vNew = v * (1 - contract * 0.25) * ry;
          dstPos[idx] = cx + uNew * cosA - vNew * sinA;
          dstPos[idx + 1] = cy + uNew * sinA + vNew * cosA;

          // Blend vertex color to healthy healed gingival mucosa coral-rose
          const cBlend = wXY * smoothstep(0.0, 1.0, crownProtrusion);
          const gR = 0.88;
          const gG = 0.46;
          const gB = 0.54;
          dstCol[idx] = dstCol[idx] * (1 - cBlend) + gR * cBlend;
          dstCol[idx + 1] = dstCol[idx + 1] * (1 - cBlend) + gG * cBlend;
          dstCol[idx + 2] = dstCol[idx + 2] * (1 - cBlend) + gB * cBlend;
        }
      }
    } else {
      // Smoothly drag/translate, rotate, and scale the existing tooth crown on the arch
      const tx = op.offsetMm.x;
      const ty = op.offsetMm.y;
      const tz = op.offsetMm.z;
      const rotRad = (op.rotationDeg * Math.PI) / 180;
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);
      const scale = Math.max(0.7, Math.min(1.35, op.scale || 1.0));

      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const x = dstPos[idx];
        const y = dstPos[idx + 1];
        const z = dstPos[idx + 2];

        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const r2 = dx * dx + dy * dy;
        if (r2 >= 2.25) continue;

        const wXY = 1.0 - smoothstep(0.55, 1.48, Math.sqrt(r2));
        const crownDist = isUpper ? zCerv - z : z - zCerv;
        const wZ = smoothstep(-2.8, 1.4, crownDist);
        const w = wXY * wZ;
        if (w <= 0.001) continue;

        const lx = x - cx;
        const ly = y - cy;
        const lz = z - zCerv;

        const sx = lx * scale;
        const sy = ly * scale;
        const sz = lz * scale;

        const rxOff = sx * cosR - sy * sinR - lx;
        const ryOff = sx * sinR + sy * cosR - ly;
        const rzOff = sz - lz;

        dstPos[idx] = x + w * (tx + rxOff);
        dstPos[idx + 1] = y + w * (ty + ryOff);
        dstPos[idx + 2] = z + w * (tz + rzOff);
      }
    }
  }

  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  return true;
}

/**
 * Exports an edited arch BufferGeometry combined with any placed 3D library/pasted teeth on that arch
 * into a standard binary STL ArrayBuffer.
 */
export function exportEditedArchToBinaryStl(
  archGeom: THREE.BufferGeometry,
  placedTeeth: PlacedLibraryTooth[],
  isUpper: boolean,
  segmentedTeeth?: SegmentedToothInfo[],
  nativeEdits: Record<number, NativeToothEditOperation> = {}
): ArrayBuffer {
  const triangles: number[] = [];

  const appendGeometryTriangles = (
    geom: THREE.BufferGeometry,
    matrix?: THREE.Matrix4
  ) => {
    const pos = geom.getAttribute('position');
    if (!pos) return;
    const index = geom.getIndex();
    const v = new THREE.Vector3();

    const pushVertex = (vIdx: number) => {
      v.fromBufferAttribute(pos, vIdx);
      if (matrix) v.applyMatrix4(matrix);
      triangles.push(v.x, v.y, v.z);
    };

    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        pushVertex(index.getX(i));
        pushVertex(index.getX(i + 1));
        pushVertex(index.getX(i + 2));
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        pushVertex(i);
        pushVertex(i + 1);
        pushVertex(i + 2);
      }
    }
  };

  const hasDiscreteNativeEdits =
    segmentedTeeth &&
    segmentedTeeth.length > 0 &&
    Object.values(nativeEdits).some(
      (op) =>
        op.deleted ||
        Math.abs(op.offsetMm.x) > 0.01 ||
        Math.abs(op.offsetMm.y) > 0.01 ||
        Math.abs(op.offsetMm.z) > 0.01 ||
        Math.abs(op.rotationDeg) > 0.1 ||
        Math.abs(op.scale - 1) > 0.01
    );

  if (hasDiscreteNativeEdits && segmentedTeeth) {
    const gingivaGeom = createGingivaBaseGeometry(
      archGeom,
      segmentedTeeth,
      isUpper,
      nativeEdits,
      false,
      placedTeeth
    );
    appendGeometryTriangles(gingivaGeom);

    for (const t of segmentedTeeth) {
      if (t.isUpper !== isUpper) continue;
      const op = nativeEdits[t.fdi];
      if (!op || op.deleted) continue;
      const isMoved =
        Math.hypot(op.offsetMm.x, op.offsetMm.y, op.offsetMm.z) > 0.01 ||
        Math.abs(op.rotationDeg) > 0.1 ||
        Math.abs(op.scale - 1) > 0.01;
      if (!isMoved) continue;

      const tGeom = extractToothCrownGeometry(archGeom, t);
      const ox = op.offsetMm.x || 0;
      const oy = op.offsetMm.y || 0;
      const oz = op.offsetMm.z || 0;
      const rot = op.rotationDeg || 0;
      const scale = op.scale || 1.0;

      const mat = new THREE.Matrix4();
      const pos = new THREE.Vector3(t.center.x + ox, t.center.y + oy, t.center.z + oz);
      const quat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, 0, (rot * Math.PI) / 180)
      );
      const scl = new THREE.Vector3(scale, scale, scale);
      mat.compose(pos, quat, scl);
      appendGeometryTriangles(tGeom, mat);
    }
  } else {
    appendGeometryTriangles(archGeom);
  }

  for (const item of placedTeeth) {
    if (item.isUpper !== isUpper) continue;
    const tGeom = createLibraryToothGeometry(item.morphology, item.isUpper, item.emergenceProfile);
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3(item.position.x, item.position.y, item.position.z);
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, 0, (item.rotationDeg * Math.PI) / 180)
    );
    const scl = new THREE.Vector3(item.scale, item.scale, item.scale);
    mat.compose(pos, quat, scl);
    appendGeometryTriangles(tGeom, mat);
  }

  const triCount = Math.floor(triangles.length / 9);
  const buffer = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buffer);

  const headerText = `DentalCAD Edited ${isUpper ? 'Upper' : 'Lower'} Arch STL`;
  for (let i = 0; i < Math.min(80, headerText.length); i++) {
    view.setUint8(i, headerText.charCodeAt(i));
  }
  view.setUint32(80, triCount, true);

  let offset = 84;
  for (let t = 0; t < triCount; t++) {
    const base = t * 9;
    const ax = triangles[base],
      ay = triangles[base + 1],
      az = triangles[base + 2];
    const bx = triangles[base + 3],
      by = triangles[base + 4],
      bz = triangles[base + 5];
    const cx = triangles[base + 6],
      cy = triangles[base + 7],
      cz = triangles[base + 8];

    const ux = bx - ax,
      uy = by - ay,
      uz = bz - az;
    const vx = cx - ax,
      vy = cy - ay,
      vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);

    view.setFloat32(offset + 12, ax, true);
    view.setFloat32(offset + 16, ay, true);
    view.setFloat32(offset + 20, az, true);

    view.setFloat32(offset + 24, bx, true);
    view.setFloat32(offset + 28, by, true);
    view.setFloat32(offset + 32, bz, true);

    view.setFloat32(offset + 36, cx, true);
    view.setFloat32(offset + 40, cy, true);
    view.setFloat32(offset + 44, cz, true);

    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }

  return buffer;
}
