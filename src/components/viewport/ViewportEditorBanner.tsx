import React, { useState, useEffect } from 'react';
import {
  ViewportSettings,
  SegmentedToothInfo,
  LocaleMode,
} from '../../types/dental';
import {
  DEFAULT_MODEL_EDIT_SETTINGS,
  canUndo,
  canRedo,
  undoModelEdit,
  redoModelEdit,
  pushModelEditSnapshot,
  deleteSelectedTooth,
  autoAddMatchingTooth,
  copySelectedTooth,
  pasteToothFromClipboard,
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
  Undo2,
  Redo2,
  Sparkles,
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

  const isNativeDeleted = Boolean(
    selectedNative && modelEdit.nativeEdits[selectedNative.fdi]?.deleted
  );

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

  const handleDeleteSelected = () => {
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      if (!cur.selectedTarget) return prev;
      return {
        ...prev,
        modelEdit: deleteSelectedTooth(cur),
      };
    });
  };

  const handleToggleDeleteSelected = () => {
    if (!selectedTarget) return;
    if (selectedTarget.kind === 'placed' && selectedTarget.placedId) {
      handleDeleteSelected();
      return;
    }

    if (selectedTarget.kind === 'native' && selectedTarget.fdi) {
      const fdi = selectedTarget.fdi;
      onSettingsChange((prev) => {
        const cur = pushModelEditSnapshot(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS);
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

  const handleAutoAddMatchingTooth = () => {
    onSettingsChange((prev) => {
      const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
      const isUpper = selectedPlaced ? selectedPlaced.isUpper : selectedNative ? selectedNative.isUpper : true;
      return {
        ...prev,
        modelEdit: autoAddMatchingTooth(cur, segmentedTeeth, isUpper),
      };
    });
  };

  const handleResetAllEdits = () => {
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

      // Delete / Backspace key to delete selected tooth
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (modelEdit.selectedTarget) {
          e.preventDefault();
          e.stopImmediatePropagation?.();
          handleDeleteSelected();
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

  if (!modelEdit.enabled) return null;

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
            title={tr(locale, '刪除選取牙齒 (鍵盤快捷鍵：Delete / Backspace)', 'Delete selected tooth (Key: Delete / Backspace)')}
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
                : tr(locale, '刪除 (Del)', 'Delete')}
            </span>
          </button>

          <button
            type="button"
            data-testid="viewport-editor-copy-btn"
            onClick={handleCopySelected}
            title={tr(locale, '複製選取牙齒 (鍵盤快捷鍵：⌘C / Ctrl+C)', 'Copy tooth (Key: ⌘C / Ctrl+C)')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 border transition-colors ${
              copiedFeedback
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
          >
            <Copy className={`w-3 h-3 ${copiedFeedback ? 'text-emerald-500' : ''}`} />
            <span>
              {copiedFeedback
                ? tr(locale, '已複製！', 'Copied!')
                : tr(locale, '複製 (⌘C)', 'Copy (⌘C)')}
            </span>
          </button>

          <button
            type="button"
            data-testid="viewport-editor-auto-add-btn"
            onClick={handleAutoAddMatchingTooth}
            title={tr(locale, '依選取的牙齒區域自動新增對應齒形', 'Auto add matching anatomical tooth for selected area')}
            className="px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-medium flex items-center gap-1 shadow-sm transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            <span>{tr(locale, '依位新增齒形', 'Auto Add Tooth')}</span>
          </button>
        </div>
      )}

      {/* Paste Button */}
      {modelEdit.clipboard && (
        <button
          type="button"
          data-testid="viewport-editor-paste-btn"
          onClick={handlePasteClipboard}
          title={tr(locale, '貼上剪貼簿牙齒 (鍵盤快捷鍵：⌘V / Ctrl+V)', 'Paste tooth (Key: ⌘V / Ctrl+V)')}
          className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium flex items-center gap-1 shadow-sm transition-colors"
        >
          <ClipboardPaste className="w-3 h-3" />
          <span>{tr(locale, '貼上 (⌘V)', 'Paste (⌘V)')}</span>
        </button>
      )}

      {/* Undo / Redo / Reset All & Close */}
      <div className="flex items-center gap-1 ml-auto">
        <button
          type="button"
          data-testid="viewport-editor-undo-btn"
          onClick={handleUndo}
          disabled={!canUndo(modelEdit)}
          title={tr(locale, '復原 (⌘Z / Ctrl+Z)', 'Undo (⌘Z / Ctrl+Z)')}
          className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          data-testid="viewport-editor-redo-btn"
          onClick={handleRedo}
          disabled={!canRedo(modelEdit)}
          title={tr(locale, '重做 (⌘⇧Z / Ctrl+Shift+Z / Ctrl+Y)', 'Redo (⌘⇧Z / Ctrl+Shift+Z / Ctrl+Y)')}
          className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
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
