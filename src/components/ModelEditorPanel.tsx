import React, { useState, useEffect } from 'react';
import {
  ViewportSettings,
  SegmentedToothInfo,
  LocaleMode,
  FdiToothNumber,
  ToothMorphologyType,
  PlacedLibraryTooth,
  NativeToothEditOperation,
} from '../types/dental';
import {
  DEFAULT_MODEL_EDIT_SETTINGS,
  TOOTH_LIBRARY_ITEMS,
  UPPER_FDI_ORDER,
  LOWER_FDI_ORDER,
  FDI_ARCH_SEEDS,
  canUndo,
  canRedo,
  undoModelEdit,
  redoModelEdit,
  pushModelEditSnapshot,
  deleteSelectedTooth,
  autoAddMatchingTooth,
  copySelectedTooth,
  pasteToothFromClipboard,
} from '../utils/modelEditor';
import { tr } from '../utils/i18n';
import {
  Wand2,
  MousePointer,
  Move,
  Trash2,
  Copy,
  ClipboardPaste,
  Plus,
  RotateCcw,
  Undo2,
  Redo2,
  Download,
  Sparkles,
  CheckCircle2,
  GripVertical,
} from 'lucide-react';

export interface ModelEditorPanelProps {
  settings: ViewportSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<ViewportSettings>>;
  segmentedTeeth: SegmentedToothInfo[];
  onExportEditedStl?: (isUpper: boolean) => void;
  locale?: LocaleMode;
}

export const ModelEditorPanel: React.FC<ModelEditorPanelProps> = ({
  settings,
  onSettingsChange,
  segmentedTeeth,
  onExportEditedStl,
  locale = 'en',
}) => {
  const modelEdit = settings.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
  const [libraryIsUpper, setLibraryIsUpper] = useState<boolean>(true);
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);

  const selectedTarget = modelEdit.selectedTarget;
  const selectedNative =
    selectedTarget?.kind === 'native' && selectedTarget.fdi
      ? segmentedTeeth.find((t) => t.fdi === selectedTarget.fdi) || null
      : null;
  const selectedPlaced =
    selectedTarget?.kind === 'placed' && selectedTarget.placedId
      ? modelEdit.placedTeeth.find((p) => p.id === selectedTarget.placedId) || null
      : null;

  const activeNativeEdit: NativeToothEditOperation | null = selectedNative
    ? modelEdit.nativeEdits[selectedNative.fdi] || {
        fdi: selectedNative.fdi,
        deleted: false,
        offsetMm: { x: 0, y: 0, z: 0 },
        rotationDeg: 0,
        scale: 1,
      }
    : null;

  const handleUndo = () => {
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      if (!canUndo(cur)) return prev;
      return {
        ...prev,
        modelEdit: undoModelEdit(cur),
      };
    });
  };

  const handleRedo = () => {
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      if (!canRedo(cur)) return prev;
      return {
        ...prev,
        modelEdit: redoModelEdit(cur),
      };
    });
  };

  const handleSliderPointerDown = () => {
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      return {
        ...prev,
        modelEdit: pushModelEditSnapshot(cur),
      };
    });
  };

  const handleToggleEnabled = () => {
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      const nextEnabled = !cur.enabled;
      return {
        ...prev,
        caliperToolActive: nextEnabled ? false : prev.caliperToolActive,
        modelEdit: {
          ...cur,
          enabled: nextEnabled,
          selectedTarget:
            nextEnabled && !cur.selectedTarget
              ? { kind: 'native', fdi: 25 }
              : cur.selectedTarget,
        },
      };
    });
  };

  const handleSelectNativeTooth = (fdi: FdiToothNumber) => {
    const seed = FDI_ARCH_SEEDS.find((s) => s.fdi === fdi);
    if (seed) setLibraryIsUpper(seed.isUpper);
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      return {
        ...prev,
        caliperToolActive: false,
        modelEdit: {
          ...cur,
          enabled: true,
          selectedTarget: { kind: 'native', fdi },
        },
      };
    });
  };

  const handleSelectPlacedTooth = (placedId: string, isUpper: boolean) => {
    setLibraryIsUpper(isUpper);
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      return {
        ...prev,
        caliperToolActive: false,
        modelEdit: {
          ...cur,
          enabled: true,
          selectedTarget: { kind: 'placed', placedId },
        },
      };
    });
  };

  const updateSelectedNativeEdit = (
    updater: (prevOp: NativeToothEditOperation) => NativeToothEditOperation
  ) => {
    if (!selectedNative) return;
    const fdi = selectedNative.fdi;
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      const currentOp: NativeToothEditOperation = cur.nativeEdits[fdi] || {
        fdi,
        deleted: false,
        offsetMm: { x: 0, y: 0, z: 0 },
        rotationDeg: 0,
        scale: 1,
      };
      const updatedOp = updater(currentOp);
      return {
        ...prev,
        modelEdit: {
          ...cur,
          enabled: true,
          nativeEdits: {
            ...cur.nativeEdits,
            [fdi]: updatedOp,
          },
        },
      };
    });
  };

  const updateSelectedPlacedTooth = (
    updater: (prevTooth: PlacedLibraryTooth) => PlacedLibraryTooth
  ) => {
    if (!selectedPlaced) return;
    const targetId = selectedPlaced.id;
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      return {
        ...prev,
        modelEdit: {
          ...cur,
          enabled: true,
          placedTeeth: cur.placedTeeth.map((p) => (p.id === targetId ? updater(p) : p)),
        },
      };
    });
  };

  const handleDeleteOrRestoreSelected = () => {
    if (selectedPlaced) {
      const targetId = selectedPlaced.id;
      onSettingsChange((prev) => {
        const cur = pushModelEditSnapshot(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS);
        return {
          ...prev,
          modelEdit: {
            ...cur,
            placedTeeth: cur.placedTeeth.filter((p) => p.id !== targetId),
            selectedTarget: null,
          },
        };
      });
      return;
    }

    if (selectedNative) {
      const fdi = selectedNative.fdi;
      onSettingsChange((prev) => {
        const cur = pushModelEditSnapshot(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS);
        const currentOp: NativeToothEditOperation = cur.nativeEdits[fdi] || {
          fdi,
          deleted: false,
          offsetMm: { x: 0, y: 0, z: 0 },
          rotationDeg: 0,
          scale: 1,
        };
        return {
          ...prev,
          modelEdit: {
            ...cur,
            enabled: true,
            nativeEdits: {
              ...cur.nativeEdits,
              [fdi]: {
                ...currentOp,
                deleted: !currentOp.deleted,
              },
            },
          },
        };
      });
    }
  };

  const handleAutoAddMatchingTooth = () => {
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      return {
        ...prev,
        modelEdit: autoAddMatchingTooth(cur, segmentedTeeth, libraryIsUpper),
      };
    });
  };

  const handleCopySelected = () => {
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      if (!cur.selectedTarget) return prev;
      return {
        ...prev,
        modelEdit: copySelectedTooth(cur, segmentedTeeth),
      };
    });
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 1500);
  };

  const handlePasteClipboard = () => {
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      if (!cur.clipboard) return prev;
      return {
        ...prev,
        modelEdit: pasteToothFromClipboard(cur, segmentedTeeth),
      };
    });
  };

  useEffect(() => {
    if (!modelEdit.enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (modelEdit.selectedTarget) {
          e.preventDefault();
          e.stopImmediatePropagation?.();
          onSettingsChange((prev) => ({
            ...prev,
            modelEdit: deleteSelectedTooth(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS),
          }));
        }
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      const key = e.key.toLowerCase();
      if (key === 'c') {
        const hasTextSelection = Boolean(window.getSelection()?.toString().trim().length);
        if (!hasTextSelection && modelEdit.selectedTarget) {
          e.preventDefault();
          e.stopImmediatePropagation?.();
          handleCopySelected();
        }
        return;
      }

      if (key === 'v') {
        if (modelEdit.clipboard) {
          e.preventDefault();
          e.stopImmediatePropagation?.();
          handlePasteClipboard();
        }
        return;
      }

      if (key === 'z') {
        e.preventDefault();
        e.stopImmediatePropagation?.();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (key === 'y') {
        e.preventDefault();
        e.stopImmediatePropagation?.();
        handleRedo();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    modelEdit.enabled,
    modelEdit.selectedTarget,
    modelEdit.clipboard,
    segmentedTeeth,
    onSettingsChange,
  ]);

  const handleAddToothFromLibrary = (morphology: ToothMorphologyType) => {
    const libMeta =
      TOOTH_LIBRARY_ITEMS.find((item) => item.morphology === morphology) ||
      TOOTH_LIBRARY_ITEMS[3];

    let spawnPos = { x: 0, y: -12, z: libraryIsUpper ? 3.8 : -3.8 };
    let targetIsUpper = libraryIsUpper;
    let spawnRotDeg = 0;

    if (selectedNative) {
      targetIsUpper = selectedNative.isUpper;
      const edit = modelEdit.nativeEdits[selectedNative.fdi];
      const isDeletedOrMissing = Boolean(edit?.deleted) || !selectedNative.presentInBaseline;
      const nativeCentroidZ = Number(((selectedNative.zOcclusal + selectedNative.zCervical) * 0.5).toFixed(2));
      spawnPos = {
        x: Number((selectedNative.center.x + (isDeletedOrMissing ? 0 : 2.5)).toFixed(2)),
        y: Number((selectedNative.center.y + (isDeletedOrMissing ? 0 : 1.5)).toFixed(2)),
        z: nativeCentroidZ,
      };
      spawnRotDeg = Math.round(selectedNative.angleDeg);
    } else if (selectedPlaced) {
      targetIsUpper = selectedPlaced.isUpper;
      spawnPos = {
        x: Number((selectedPlaced.position.x + 3.5).toFixed(2)),
        y: Number((selectedPlaced.position.y + 1.5).toFixed(2)),
        z: Number(selectedPlaced.position.z.toFixed(2)),
      };
      spawnRotDeg = selectedPlaced.rotationDeg;
    }

    const newId = `lib-${morphology}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTooth: PlacedLibraryTooth = {
      id: newId,
      labelZh: `${targetIsUpper ? '上顎' : '下顎'} ${libMeta.titleZh}`,
      labelEn: `${targetIsUpper ? 'Upper' : 'Lower'} ${libMeta.titleEn}`,
      morphology,
      isUpper: targetIsUpper,
      fdiHint: selectedNative?.fdi,
      position: spawnPos,
      rotationDeg: spawnRotDeg,
      scale: 1.0,
    };

    onSettingsChange((prev) => {
      const cur = pushModelEditSnapshot(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS);
      return {
        ...prev,
        caliperToolActive: false,
        modelEdit: {
          ...cur,
          enabled: true,
          toolMode: 'drag',
          placedTeeth: [...cur.placedTeeth, newTooth],
          selectedTarget: { kind: 'placed', placedId: newId },
        },
      };
    });
  };

  const handleResetAll = () => {
    onSettingsChange((prev) => {
      const cur = pushModelEditSnapshot(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS);
      return {
        ...prev,
        modelEdit: {
          ...cur,
          nativeEdits: {},
          placedTeeth: [],
          selectedTarget: null,
        },
      };
    });
  };

  const renderOdontogramRow = (fdiList: FdiToothNumber[], archLabel: string) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>{archLabel}</span>
        <span className="font-mono text-[10px]">
          {tr(locale, '患者右側 (R) ↔ 患者左側 (L)', 'Patient Right (R) ↔ Left (L)')}
        </span>
      </div>
      <div className="grid grid-cols-7 sm:grid-cols-14 gap-1">
        {fdiList.map((fdi) => {
          const seg = segmentedTeeth.find((t) => t.fdi === fdi);
          const edit = modelEdit.nativeEdits[fdi];
          const isSelected =
            selectedTarget?.kind === 'native' && selectedTarget.fdi === fdi;
          const isDeleted = Boolean(edit?.deleted);
          const isMoved =
            !isDeleted &&
            Boolean(
              edit &&
                (Math.abs(edit.offsetMm.x) > 0.05 ||
                  Math.abs(edit.offsetMm.y) > 0.05 ||
                  Math.abs(edit.offsetMm.z) > 0.05 ||
                  Math.abs(edit.rotationDeg) > 0.5 ||
                  Math.abs(edit.scale - 1) > 0.02)
            );
          const isMissingBaseline = seg ? !seg.presentInBaseline : false;

          let btnStyle =
            'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-violet-400';
          if (isSelected) {
            btnStyle =
              'bg-violet-600 text-white border-violet-400 ring-2 ring-violet-500/40 font-bold shadow-sm';
          } else if (isDeleted) {
            btnStyle =
              'bg-rose-500/15 dark:bg-rose-950/70 text-rose-600 dark:text-rose-300 border-rose-500/50 line-through';
          } else if (isMoved) {
            btnStyle =
              'bg-amber-500/15 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-500/50 font-semibold';
          } else if (isMissingBaseline) {
            btnStyle =
              'bg-slate-200/60 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 border-dashed border-slate-300 dark:border-slate-700';
          }

          return (
            <button
              key={fdi}
              type="button"
              data-testid={`odontogram-tooth-${fdi}`}
              onClick={() => handleSelectNativeTooth(fdi)}
              title={
                seg
                  ? `#${fdi} ${tr(locale, seg.labelZh, seg.labelEn)}`
                  : `#${fdi}`
              }
              className={`py-1.5 px-0.5 rounded border text-[11px] font-mono text-center transition-all ${btnStyle}`}
            >
              {fdi}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Current transform values for the inspector sliders
  const currentDx = selectedPlaced
    ? selectedPlaced.position.x
    : activeNativeEdit?.offsetMm.x || 0;
  const currentDy = selectedPlaced
    ? selectedPlaced.position.y
    : activeNativeEdit?.offsetMm.y || 0;
  const currentDz = selectedPlaced
    ? selectedPlaced.position.z
    : activeNativeEdit?.offsetMm.z || 0;
  const currentRot = selectedPlaced
    ? selectedPlaced.rotationDeg
    : activeNativeEdit?.rotationDeg || 0;
  const currentScale = selectedPlaced
    ? selectedPlaced.scale
    : activeNativeEdit?.scale || 1;

  return (
    <div data-testid="model-editor-panel" className="space-y-4">
      {/* Header & Master Enable Toggle */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-600 dark:text-violet-400 flex-shrink-0">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>
                  {tr(
                    locale,
                    '3D 齒列模型互動編輯器',
                    '3D Dental Model & Tooth Editor'
                  )}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tr(
                  locale,
                  '具備真正「牙齒物件」與「牙齦基底」分離架構，支援 28 顆 FDI 牙齒點選、剛體搬移、拔牙齒槽脊癒合、複製貼上與 3D 牙齒庫排牙，無拉扯破圖',
                  'Discrete Tooth Objects & Gingiva Base architecture with rigid 3D movement, extraction healing, copy/paste & library placement'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="model-editor-enable-toggle"
            onClick={handleToggleEnabled}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${
              modelEdit.enabled
                ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-violet-500/10 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {modelEdit.enabled
                ? tr(locale, '編輯中 (已啟用)', 'Editor Active')
                : tr(locale, '啟用 3D 編輯', 'Enable 3D Editor')}
            </span>
          </button>
        </div>

        {/* Interactive Mode Switcher & Reset/Export Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              data-testid="editor-tool-select-btn"
              onClick={() =>
                onSettingsChange((prev) => ({
                  ...prev,
                  modelEdit: {
                    ...(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS),
                    enabled: true,
                    toolMode: 'select',
                  },
                }))
              }
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                modelEdit.toolMode === 'select'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>{tr(locale, '3D 點選辨識', 'Select Tooth')}</span>
            </button>

            <button
              type="button"
              data-testid="editor-tool-drag-btn"
              onClick={() =>
                onSettingsChange((prev) => ({
                  ...prev,
                  modelEdit: {
                    ...(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS),
                    enabled: true,
                    toolMode: 'drag',
                  },
                }))
              }
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                modelEdit.toolMode === 'drag'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              <span>{tr(locale, '3D 拖動牙齒', 'Drag Tooth in 3D')}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {onExportEditedStl && (
              <>
                <button
                  type="button"
                  data-testid="editor-export-upper-stl-btn"
                  onClick={() => onExportEditedStl(true)}
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span>{tr(locale, '匯出上顎 STL', 'Export Upper STL')}</span>
                </button>
                <button
                  type="button"
                  data-testid="editor-export-lower-stl-btn"
                  onClick={() => onExportEditedStl(false)}
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span>{tr(locale, '匯出下顎 STL', 'Export Lower STL')}</span>
                </button>
              </>
            )}

            <button
              type="button"
              data-testid="editor-undo-btn"
              onClick={handleUndo}
              disabled={!canUndo(modelEdit)}
              title={tr(locale, '復原 (⌘Z / Ctrl+Z)', 'Undo (⌘Z / Ctrl+Z)')}
              className="px-2.5 py-1 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Undo2 className="w-3 h-3" />
              <span>{tr(locale, '復原', 'Undo')}</span>
            </button>
            <button
              type="button"
              data-testid="editor-redo-btn"
              onClick={handleRedo}
              disabled={!canRedo(modelEdit)}
              title={tr(locale, '重做 (⌘⇧Z / Ctrl+Shift+Z / Ctrl+Y)', 'Redo (⌘⇧Z / Ctrl+Shift+Z / Ctrl+Y)')}
              className="px-2.5 py-1 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Redo2 className="w-3 h-3" />
              <span>{tr(locale, '重做', 'Redo')}</span>
            </button>

            <button
              type="button"
              data-testid="editor-reset-all-btn"
              onClick={handleResetAll}
              className="px-2.5 py-1 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{tr(locale, '全部還原', 'Reset All')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: Interactive 2D FDI Tooth Identification & Selection Odontogram */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-violet-500" />
            <span>
              {tr(
                locale,
                '智慧牙位辨識圖譜 (點擊 3D 齒列或下方 FDI 牙號選取)',
                'FDI Tooth Segmentation Chart (Click 3D model or tooth #)'
              )}
            </span>
          </h3>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {segmentedTeeth.filter((t) => t.presentInBaseline).length} / 28{' '}
            {tr(locale, '顆原生牙位', 'Teeth Detected')}
          </span>
        </div>

        {renderOdontogramRow(UPPER_FDI_ORDER, tr(locale, '上顎齒列 (Maxillary #17–#27)', 'Upper Arch (#17–#27)'))}
        {renderOdontogramRow(LOWER_FDI_ORDER, tr(locale, '下顎齒列 (Mandibular #47–#37)', 'Lower Arch (#47–#37)'))}

        {/* Status Legend & Object Visibility Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-violet-600 inline-block" />
              {tr(locale, '已選取', 'Selected')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
              {tr(locale, '已剛體位移', 'Moved/Edited')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
              {tr(locale, '已拔牙 (齒槽脊癒合)', 'Deleted/Extracted')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="toggle-show-tooth-objects"
                checked={modelEdit.showToothObjects !== false}
                onChange={(e) =>
                  onSettingsChange((prev) => ({
                    ...prev,
                    modelEdit: {
                      ...(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS),
                      showToothObjects: e.target.checked,
                    },
                  }))
                }
                className="w-3.5 h-3.5 rounded text-violet-600 accent-violet-600"
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {tr(locale, '獨立牙齒物件', 'Tooth Objects')}
              </span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="toggle-show-gingiva-base"
                checked={modelEdit.showGingivaBase !== false}
                onChange={(e) =>
                  onSettingsChange((prev) => ({
                    ...prev,
                    modelEdit: {
                      ...(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS),
                      showGingivaBase: e.target.checked,
                    },
                  }))
                }
                className="w-3.5 h-3.5 rounded text-violet-600 accent-violet-600"
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {tr(locale, '牙齦基底模型', 'Gingiva Base')}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Section 2: Selected Tooth Action & 3D Drag / Transform Inspector */}
      <div
        data-testid="selected-tooth-inspector"
        className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-medium text-violet-600 dark:text-violet-400">
              {selectedPlaced
                ? tr(locale, '目前選取：3D 庫選/貼上牙齒物件 (Discrete Placed Tooth)', 'Selected: Discrete Placed / Pasted Tooth Object')
                : selectedNative
                ? tr(locale, '目前選取：原生獨立 3D 牙齒物件 (Discrete Native Tooth)', 'Selected: Discrete Native Tooth Object')
                : tr(locale, '尚未選取牙齒', 'No Tooth Selected')}
            </div>
            <div
              data-testid="inspector-selected-label"
              className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <span>
                {selectedPlaced
                  ? tr(locale, selectedPlaced.labelZh, selectedPlaced.labelEn)
                  : selectedNative
                  ? `#${selectedNative.fdi} ${tr(locale, selectedNative.labelZh, selectedNative.labelEn)}`
                  : tr(locale, '請在 3D 視窗直接點擊牙齒或由上方圖譜選取', 'Click any 3D tooth or chart to select')}
              </span>
              {activeNativeEdit?.deleted && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  {tr(locale, '已拔除 (齒槽脊)', 'Extracted')}
                </span>
              )}
            </div>
          </div>

          {/* Delete / Copy / Paste / Auto-Add Quick Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(selectedNative || selectedPlaced) && (
              <>
                <button
                  type="button"
                  data-testid="editor-delete-tooth-btn"
                  onClick={handleDeleteOrRestoreSelected}
                  title={tr(
                    locale,
                    '刪除選取牙齒 (鍵盤快捷鍵：Delete 或 Backspace)',
                    'Delete selected tooth (Key: Delete or Backspace)'
                  )}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeNativeEdit?.deleted
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {activeNativeEdit?.deleted
                      ? tr(locale, '復原牙齒', 'Restore Tooth')
                      : tr(locale, '刪除牙齒', 'Delete Tooth')}
                  </span>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-black/20 font-mono font-normal">
                    Del
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="editor-copy-tooth-btn"
                  onClick={handleCopySelected}
                  title={tr(locale, '複製選取牙齒 (鍵盤快捷鍵：⌘C / Ctrl+C)', 'Copy tooth (Key: ⌘C / Ctrl+C)')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                    copiedFeedback
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <Copy className={`w-3.5 h-3.5 ${copiedFeedback ? 'text-emerald-500' : 'text-sky-500'}`} />
                  <span>
                    {copiedFeedback
                      ? tr(locale, '已複製！', 'Copied!')
                      : tr(locale, '複製牙齒', 'Copy Tooth')}
                  </span>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-black/10 dark:bg-black/30 font-mono font-normal">
                    Ctrl+C
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="editor-auto-add-matching-btn"
                  onClick={handleAutoAddMatchingTooth}
                  title={tr(
                    locale,
                    '依選取的牙位區域自動新增對應齒形',
                    'Auto add matching anatomical tooth for selected area'
                  )}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-sm flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{tr(locale, '依此牙位新增齒形', 'Auto Add Tooth')}</span>
                </button>
              </>
            )}

            <button
              type="button"
              data-testid="editor-paste-tooth-btn"
              disabled={!modelEdit.clipboard}
              onClick={handlePasteClipboard}
              title={tr(locale, '貼上剪貼簿牙齒 (鍵盤快捷鍵：⌘V / Ctrl+V)', 'Paste tooth (Key: ⌘V / Ctrl+V)')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                modelEdit.clipboard
                  ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>
                {modelEdit.clipboard
                  ? tr(
                      locale,
                      `貼上 (${modelEdit.clipboard.sourceLabelZh.split(' ')[0]})`,
                      'Paste Tooth'
                    )
                  : tr(locale, '貼上牙齒', 'Paste Tooth')}
              </span>
              <span className="text-[10px] px-1 py-0.5 rounded bg-black/20 font-mono font-normal">
                Ctrl+V
              </span>
            </button>
          </div>
        </div>

        {/* 3D Position & Orientation Sliders (works for both Existing Native Teeth and Placed Library Teeth) */}
        {(selectedNative || selectedPlaced) && (
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                {tr(
                  locale,
                  '可在 3D 視窗直接按住拖動牙齒，或使用下方精密滑桿微調位置：',
                  'Drag directly in 3D viewport or fine-tune with sliders below:'
                )}
              </span>
              {selectedNative && (
                <button
                  type="button"
                  data-testid="editor-reset-tooth-btn"
                  onClick={() =>
                    updateSelectedNativeEdit((op) => ({
                      ...op,
                      deleted: false,
                      offsetMm: { x: 0, y: 0, z: 0 },
                      rotationDeg: 0,
                      scale: 1,
                    }))
                  }
                  className="text-violet-600 dark:text-violet-400 hover:underline font-medium"
                >
                  {tr(locale, '重設此牙位移', 'Reset Tooth')}
                </button>
              )}
            </div>

            {/* X Position / Offset */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">
                  {selectedPlaced
                    ? tr(locale, 'X 軸座標 (左右橫向)', 'Position X (Left/Right)')
                    : tr(locale, 'ΔX 左右平移 (頰舌/近遠中)', 'Offset ΔX (Left/Right)')}
                </span>
                <span className="font-mono tabular-nums font-semibold text-violet-600 dark:text-violet-400">
                  {currentDx.toFixed(1)} mm
                </span>
              </div>
              <input
                type="range"
                data-testid="editor-slider-dx"
                min={selectedPlaced ? -32 : -15}
                max={selectedPlaced ? 32 : 15}
                step={0.2}
                value={currentDx}
                onPointerDown={handleSliderPointerDown}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (selectedPlaced) {
                    updateSelectedPlacedTooth((p) => ({
                      ...p,
                      position: { ...p.position, x: val },
                    }));
                  } else {
                    updateSelectedNativeEdit((op) => ({
                      ...op,
                      offsetMm: { ...op.offsetMm, x: val },
                    }));
                  }
                }}
                className="w-full accent-violet-600"
              />
            </div>

            {/* Y Position / Offset */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">
                  {selectedPlaced
                    ? tr(locale, 'Y 軸座標 (前後矢狀)', 'Position Y (Anterior/Posterior)')
                    : tr(locale, 'ΔY 前後平移 (矢狀向)', 'Offset ΔY (Anterior/Posterior)')}
                </span>
                <span className="font-mono tabular-nums font-semibold text-violet-600 dark:text-violet-400">
                  {currentDy.toFixed(1)} mm
                </span>
              </div>
              <input
                type="range"
                data-testid="editor-slider-dy"
                min={selectedPlaced ? -42 : -15}
                max={selectedPlaced ? 14 : 15}
                step={0.2}
                value={currentDy}
                onPointerDown={handleSliderPointerDown}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (selectedPlaced) {
                    updateSelectedPlacedTooth((p) => ({
                      ...p,
                      position: { ...p.position, y: val },
                    }));
                  } else {
                    updateSelectedNativeEdit((op) => ({
                      ...op,
                      offsetMm: { ...op.offsetMm, y: val },
                    }));
                  }
                }}
                className="w-full accent-violet-600"
              />
            </div>

            {/* Z Position / Extrusion-Intrusion */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">
                  {selectedPlaced
                    ? tr(locale, 'Z 軸咬合高度', 'Position Z (Occlusal Height)')
                    : tr(locale, 'ΔZ 垂直挺出/壓入高度', 'Offset ΔZ (Extrusion/Intrusion)')}
                </span>
                <span className="font-mono tabular-nums font-semibold text-violet-600 dark:text-violet-400">
                  {currentDz.toFixed(1)} mm
                </span>
              </div>
              <input
                type="range"
                data-testid="editor-slider-dz"
                min={selectedPlaced ? -12 : -8}
                max={selectedPlaced ? 12 : 8}
                step={0.2}
                value={currentDz}
                onPointerDown={handleSliderPointerDown}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (selectedPlaced) {
                    updateSelectedPlacedTooth((p) => ({
                      ...p,
                      position: { ...p.position, z: val },
                    }));
                  } else {
                    updateSelectedNativeEdit((op) => ({
                      ...op,
                      offsetMm: { ...op.offsetMm, z: val },
                    }));
                  }
                }}
                className="w-full accent-violet-600"
              />
            </div>

            {/* Rotation & Scale */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300">
                    {tr(locale, '旋轉角度 (Rotation)', 'Rotation (°)')}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-violet-600 dark:text-violet-400">
                    {Math.round(currentRot)}°
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="editor-slider-rotation"
                  min={-180}
                  max={180}
                  step={2}
                  value={currentRot}
                  onPointerDown={handleSliderPointerDown}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (selectedPlaced) {
                      updateSelectedPlacedTooth((p) => ({ ...p, rotationDeg: val }));
                    } else {
                      updateSelectedNativeEdit((op) => ({ ...op, rotationDeg: val }));
                    }
                  }}
                  className="w-full accent-violet-600"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300">
                    {tr(locale, '牙冠尺寸 (Scale)', 'Crown Scale')}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-violet-600 dark:text-violet-400">
                    {Math.round(currentScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="editor-slider-scale"
                  min={0.65}
                  max={1.45}
                  step={0.05}
                  value={currentScale}
                  onPointerDown={handleSliderPointerDown}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (selectedPlaced) {
                      updateSelectedPlacedTooth((p) => ({ ...p, scale: val }));
                    } else {
                      updateSelectedNativeEdit((op) => ({ ...op, scale: val }));
                    }
                  }}
                  className="w-full accent-violet-600"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: 3D Anatomical Tooth Library (Drag-and-Drop onto 3D Canvas or Click to Add) */}
      <div
        data-testid="tooth-library-section"
        className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-sky-500" />
              <span>
                {tr(
                  locale,
                  '3D 標準解剖牙齒庫 (拖曳至 3D 齒列或點擊新增)',
                  '3D Anatomical Tooth Library (Drag to 3D or Click to Add)'
                )}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {tr(
                locale,
                '可將下方牙齒卡片直接拖拉放開至 3D 牙弓任一位置，或點擊「+ 新增並拖動」植入缺牙區',
                'Drag any tooth card onto the 3D arch or click "+ Add" to place at selected site'
              )}
            </p>
          </div>

          {/* Target Arch Selector & Auto-Add for Library */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              data-testid="library-auto-add-matching-btn"
              onClick={handleAutoAddMatchingTooth}
              title={tr(
                locale,
                '依目前選取的牙齒或缺牙區域自動新增對應齒形',
                'Auto add matching anatomical tooth for selected area'
              )}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white flex items-center gap-1 shadow-sm transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{tr(locale, '依選取牙位自動新增', 'Auto Add Matching')}</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                data-testid="library-target-upper"
                onClick={() => setLibraryIsUpper(true)}
                className={`px-2 py-1 rounded font-medium transition-colors ${
                  libraryIsUpper
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tr(locale, '上顎牙冠', 'Upper')}
              </button>
              <button
                type="button"
                data-testid="library-target-lower"
                onClick={() => setLibraryIsUpper(false)}
                className={`px-2 py-1 rounded font-medium transition-colors ${
                  !libraryIsUpper
                    ? 'bg-sky-500 text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tr(locale, '下顎牙冠', 'Lower')}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TOOTH_LIBRARY_ITEMS.map((item) => (
            <div
              key={item.morphology}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  'application/x-dentalcad-tooth',
                  JSON.stringify({
                    morphology: item.morphology,
                    isUpper: libraryIsUpper,
                  })
                );
              }}
              data-testid={`library-card-${item.morphology}`}
              className="group p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="w-4 h-4 text-slate-400 group-hover:text-sky-500 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {tr(locale, item.titleZh, item.titleEn)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {tr(locale, item.subtitleZh, item.subtitleEn)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid={`library-add-${item.morphology}`}
                onClick={() => handleAddToothFromLibrary(item.morphology)}
                className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 shadow-sm transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>{tr(locale, '新增', 'Add')}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Placed / Pasted Teeth List */}
        {modelEdit.placedTeeth.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {tr(
                locale,
                `已新增 / 貼上之 3D 牙齒 (${modelEdit.placedTeeth.length})：`,
                `Placed / Pasted 3D Teeth (${modelEdit.placedTeeth.length}):`
              )}
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {modelEdit.placedTeeth.map((pt) => {
                const isSelected =
                  selectedTarget?.kind === 'placed' && selectedTarget.placedId === pt.id;
                return (
                  <div
                    key={pt.id}
                    data-testid={`placed-tooth-row-${pt.id}`}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                      isSelected
                        ? 'bg-violet-500/15 border-violet-500/50 text-violet-900 dark:text-violet-100 font-semibold'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectPlacedTooth(pt.id, pt.isUpper)}
                      className="flex items-center gap-2 text-left truncate flex-1"
                    >
                      <span className="truncate">
                        {tr(locale, pt.labelZh, pt.labelEn)}
                      </span>
                      <span className="font-mono tabular-nums text-[10px] text-slate-400">
                        ({pt.position.x.toFixed(1)}, {pt.position.y.toFixed(1)},{' '}
                        {pt.position.z.toFixed(1)})
                      </span>
                    </button>
                    <button
                      type="button"
                      data-testid={`delete-placed-tooth-${pt.id}`}
                      onClick={() =>
                        onSettingsChange((prev) => {
                          const cur = pushModelEditSnapshot(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS);
                          return {
                            ...prev,
                            modelEdit: {
                              ...cur,
                              placedTeeth: cur.placedTeeth.filter((p) => p.id !== pt.id),
                              selectedTarget:
                                cur.selectedTarget?.kind === 'placed' &&
                                cur.selectedTarget.placedId === pt.id
                                  ? null
                                  : cur.selectedTarget,
                            },
                          };
                        })
                      }
                      className="p-1 text-rose-500 hover:bg-rose-500/15 rounded"
                      title={tr(locale, '移除此新增牙齒', 'Remove placed tooth')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
