import React from 'react';
import {
  ViewportSettings,
  SegmentedToothInfo,
  LocaleMode,
  PlacedLibraryTooth,
} from '../../types/dental';
import {
  DEFAULT_MODEL_EDIT_SETTINGS,
  getLibraryItemMeta,
} from '../../utils/modelEditor';
import { tr } from '../../utils/i18n';
import {
  Wand2,
  MousePointer,
  Move,
  Trash2,
  RotateCcw,
  Copy,
  ClipboardPaste,
  X,
} from 'lucide-react';

export interface ViewportEditorBannerProps {
  settings: ViewportSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<ViewportSettings>>;
  segmentedTeeth: SegmentedToothInfo[];
  locale?: LocaleMode;
}

export const ViewportEditorBanner: React.FC<ViewportEditorBannerProps> = ({
  settings,
  onSettingsChange,
  segmentedTeeth,
  locale = 'en',
}) => {
  const modelEdit = settings.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
  if (!modelEdit.enabled) return null;

  const selectedTarget = modelEdit.selectedTarget;
  const selectedNative =
    selectedTarget?.kind === 'native' && selectedTarget.fdi
      ? segmentedTeeth.find((t) => t.fdi === selectedTarget.fdi) || null
      : null;
  const selectedPlaced =
    selectedTarget?.kind === 'placed' && selectedTarget.placedId
      ? modelEdit.placedTeeth.find((p) => p.id === selectedTarget.placedId) || null
      : null;

  const isNativeDeleted = Boolean(
    selectedNative && modelEdit.nativeEdits[selectedNative.fdi]?.deleted
  );

  const handleToggleDeleteSelected = () => {
    if (!selectedTarget) return;
    if (selectedTarget.kind === 'placed' && selectedTarget.placedId) {
      const targetId = selectedTarget.placedId;
      onSettingsChange((prev) => {
        const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
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

    if (selectedTarget.kind === 'native' && selectedTarget.fdi) {
      const fdi = selectedTarget.fdi;
      onSettingsChange((prev) => {
        const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
        const prevOp = cur.nativeEdits[fdi] || {
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
            nativeEdits: {
              ...cur.nativeEdits,
              [fdi]: {
                ...prevOp,
                deleted: !prevOp.deleted,
              },
            },
          },
        };
      });
    }
  };

  const handleCopySelected = () => {
    if (selectedPlaced) {
      onSettingsChange((prev) => {
        const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
        return {
          ...prev,
          modelEdit: {
            ...cur,
            clipboard: {
              sourceLabelZh: selectedPlaced.labelZh,
              sourceLabelEn: selectedPlaced.labelEn,
              morphology: selectedPlaced.morphology,
              isUpper: selectedPlaced.isUpper,
              rotationDeg: selectedPlaced.rotationDeg,
              scale: selectedPlaced.scale,
            },
          },
        };
      });
      return;
    }

    if (selectedNative) {
      const edit = modelEdit.nativeEdits[selectedNative.fdi];
      onSettingsChange((prev) => {
        const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
        return {
          ...prev,
          modelEdit: {
            ...cur,
            clipboard: {
              sourceLabelZh: `#${selectedNative.fdi} ${selectedNative.labelZh}`,
              sourceLabelEn: `#${selectedNative.fdi} ${selectedNative.labelEn}`,
              morphology: selectedNative.morphology,
              isUpper: selectedNative.isUpper,
              sourceFdi: selectedNative.fdi,
              rotationDeg: edit?.rotationDeg || 0,
              scale: edit?.scale || 1,
            },
          },
        };
      });
    }
  };

  const handlePasteClipboard = () => {
    const clip = modelEdit.clipboard;
    if (!clip) return;

    // Place near the currently selected tooth or slightly offset on the arch
    let targetPos = { x: 0, y: -14, z: clip.isUpper ? 1.5 : -1.5 };
    let targetIsUpper = clip.isUpper;

    if (selectedNative) {
      const edit = modelEdit.nativeEdits[selectedNative.fdi];
      const isDeletedSite = Boolean(edit?.deleted) || !selectedNative.presentInBaseline;
      targetIsUpper = selectedNative.isUpper;
      targetPos = {
        x: Number((selectedNative.center.x + (isDeletedSite ? 0 : 3.2)).toFixed(2)),
        y: Number((selectedNative.center.y + (isDeletedSite ? 0 : 1.5)).toFixed(2)),
        z: Number(selectedNative.zOcclusal.toFixed(2)),
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
    };

    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      return {
        ...prev,
        modelEdit: {
          ...cur,
          placedTeeth: [...cur.placedTeeth, newTooth],
          selectedTarget: { kind: 'placed', placedId: newId },
        },
      };
    });
  };

  const handleResetAllEdits = () => {
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
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

  return (
    <div
      data-testid="viewport-editor-banner"
      className="absolute top-14 left-12 sm:left-14 right-2.5 sm:right-auto z-30 bg-white/95 dark:bg-[#0f172a]/95 border border-violet-500/50 rounded-lg px-2.5 py-1.5 shadow-lg flex flex-wrap items-center gap-1.5 text-xs max-w-2xl"
    >
      <div className="flex items-center gap-1.5 pr-1.5 border-r border-slate-200 dark:border-slate-800">
        <Wand2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 flex-shrink-0" />
        <span className="font-semibold text-violet-700 dark:text-violet-300 whitespace-nowrap">
          {tr(locale, '3D 齒列編輯模式', '3D Tooth Editor')}
        </span>
      </div>

      {/* Tool Mode Switcher: Select vs Drag */}
      <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-900 p-0.5 rounded border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          data-testid="viewport-editor-mode-select"
          onClick={() =>
            onSettingsChange((prev) => ({
              ...prev,
              modelEdit: {
                ...(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS),
                toolMode: 'select',
              },
            }))
          }
          className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
            modelEdit.toolMode === 'select'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MousePointer className="w-3 h-3" />
          <span>{tr(locale, '點選', 'Select')}</span>
        </button>
        <button
          type="button"
          data-testid="viewport-editor-mode-drag"
          onClick={() =>
            onSettingsChange((prev) => ({
              ...prev,
              modelEdit: {
                ...(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS),
                toolMode: 'drag',
              },
            }))
          }
          className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
            modelEdit.toolMode === 'drag'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Move className="w-3 h-3" />
          <span>{tr(locale, '3D 拖動牙齒', 'Drag Tooth')}</span>
        </button>
      </div>

      {/* Active Selected Tooth Badge */}
      <div
        data-testid="viewport-editor-selected-badge"
        className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-800 dark:text-violet-200 font-mono text-[11px] truncate max-w-[190px]"
      >
        {selectedNative
          ? `#${selectedNative.fdi} ${tr(locale, selectedNative.labelZh, selectedNative.labelEn)}`
          : selectedPlaced
          ? tr(locale, selectedPlaced.labelZh, selectedPlaced.labelEn)
          : tr(locale, '點擊任意 3D 牙齒以選取/拖動', 'Click any 3D tooth to select/drag')}
      </div>

      {/* Quick Actions for Selected Tooth */}
      {(selectedNative || selectedPlaced) && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="viewport-editor-delete-btn"
            onClick={handleToggleDeleteSelected}
            className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
              isNativeDeleted
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            <Trash2 className="w-3 h-3" />
            <span>
              {isNativeDeleted
                ? tr(locale, '復原牙齒', 'Restore')
                : tr(locale, '刪除牙齒', 'Delete')}
            </span>
          </button>

          <button
            type="button"
            data-testid="viewport-editor-copy-btn"
            onClick={handleCopySelected}
            className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-medium flex items-center gap-1 border border-slate-300 dark:border-slate-700"
          >
            <Copy className="w-3 h-3" />
            <span>{tr(locale, '複製', 'Copy')}</span>
          </button>
        </div>
      )}

      {/* Paste Button */}
      {modelEdit.clipboard && (
        <button
          type="button"
          data-testid="viewport-editor-paste-btn"
          onClick={handlePasteClipboard}
          className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium flex items-center gap-1 shadow-sm"
        >
          <ClipboardPaste className="w-3 h-3" />
          <span>{tr(locale, '貼上牙齒', 'Paste')}</span>
        </button>
      )}

      {/* Reset All & Close */}
      <div className="flex items-center gap-1 ml-auto">
        <button
          type="button"
          data-testid="viewport-editor-reset-btn"
          onClick={handleResetAllEdits}
          title={tr(locale, '重置所有牙齒編輯', 'Reset all tooth edits')}
          className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          data-testid="viewport-editor-close-btn"
          onClick={() =>
            onSettingsChange((prev) => ({
              ...prev,
              modelEdit: {
                ...(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS),
                enabled: false,
              },
            }))
          }
          title={tr(locale, '退出 3D 齒列編輯模式', 'Exit 3D editor mode')}
          className="p-1 rounded text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
