import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flame,
  GitCompare,
  Layers,
  Pause,
  Play,
} from 'lucide-react';
import {
  ArticulationMode,
  ArticulatorSettings,
  LocaleMode,
  ViewportSettings,
} from '../../types/dental';
import { DEFAULT_MODEL_DIFF_SETTINGS } from '../../utils/modelDiff';
import {
  MandibularKinematicsResult,
  resolveActiveStrokes,
} from '../../utils/articulatorKinematics';
import { tr } from '../../utils/i18n';
import { CompoundStrokeMixer } from '../CompoundStrokeMixer';

export interface ViewportBottomHudProps {
  settings: ViewportSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<ViewportSettings>>;
  currentKinematics: MandibularKinematicsResult;
  triangleStats: { upper: number; lower: number };
  fps: number;
  locale?: LocaleMode;
}

export const ViewportBottomHud: React.FC<ViewportBottomHudProps> = ({
  settings,
  onSettingsChange,
  currentKinematics,
  triangleStats,
  fps,
  locale = 'en',
}) => {
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);

  const handleUpdateArticulator = (patch: Partial<ArticulatorSettings>) => {
    onSettingsChange((prev) => ({
      ...prev,
      articulator: {
        ...prev.articulator,
        ...patch,
      },
    }));
  };

  return (
    <div className="absolute bottom-2.5 sm:bottom-4 left-2.5 sm:left-4 right-2.5 sm:right-auto z-30 flex flex-col gap-1.5 sm:gap-2 max-w-full sm:max-w-md">
      <div className="bg-white/95 dark:bg-[#0f172a]/95 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 rounded-lg backdrop-blur shadow-lg text-xs space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
            <Layers className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 flex-shrink-0" />
            <span className="truncate">
              {tr(locale, '咬合運動模擬與牙弓檢視', 'Articulation & Arch Control')}
            </span>
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() =>
                onSettingsChange((prev) => ({
                  ...prev,
                  showUpper: !prev.showUpper,
                }))
              }
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                settings.showUpper
                  ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-200 border border-amber-500/40'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 border border-transparent'
              }`}
            >
              {settings.showUpper ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
              {tr(locale, '上顎 (U)', 'Upper (U)')}
            </button>
            <button
              type="button"
              onClick={() =>
                onSettingsChange((prev) => ({
                  ...prev,
                  showLower: !prev.showLower,
                }))
              }
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                settings.showLower
                  ? 'bg-sky-500/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-200 border border-sky-500/40'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 border border-transparent'
              }`}
            >
              {settings.showLower ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
              {tr(locale, '下顎 (L)', 'Lower (L)')}
            </button>
            <button
              type="button"
              data-testid="viewport-hud-toggle"
              onClick={() => setHudCollapsed((v) => !v)}
              className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors"
              title={
                hudCollapsed
                  ? tr(locale, '展開 3D 浮動控制面板', 'Expand 3D HUD Controls')
                  : tr(locale, '收合 3D 浮動控制面板（釋放手機視野）', 'Collapse 3D HUD Controls')
              }
            >
              {hudCollapsed ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {!hudCollapsed && (
          <>
            {/* Quick Articulation Mode Pills */}
            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  { id: 'hinge', label: tr(locale, '生理樞軸', 'Hinge') },
                  { id: 'protrusion', label: tr(locale, '前突', 'Protrusion') },
                  { id: 'lateral_left', label: tr(locale, '左側方', 'Lat L') },
                  { id: 'lateral_right', label: tr(locale, '右側方', 'Lat R') },
                  { id: 'chewing', label: tr(locale, '咀嚼循環', 'Chewing') },
                  { id: 'parallel', label: tr(locale, '平行', 'Parallel') },
                  { id: 'compound', label: tr(locale, '混用', 'Mix') },
                ] as { id: ArticulationMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    onSettingsChange((prev) => {
                      if (m.id === 'compound') {
                        const currentStrokes =
                          prev.articulator.strokes ??
                          resolveActiveStrokes(prev.articulator);
                        return {
                          ...prev,
                          articulator: {
                            ...prev.articulator,
                            mode: 'compound',
                            strokes: currentStrokes,
                            progress:
                              prev.articulator.progress > 0
                                ? prev.articulator.progress
                                : 1.0,
                          },
                        };
                      }
                      return {
                        ...prev,
                        articulator: {
                          ...prev.articulator,
                          mode: m.id,
                        },
                      };
                    })
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                    settings.articulator.mode === m.id
                      ? 'bg-sky-500 text-white border-sky-600'
                      : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Compact Mixed Strokes Sub-Panel in HUD when Compound Mode is Active */}
            {settings.articulator.mode === 'compound' && (
              <CompoundStrokeMixer
                articulator={settings.articulator}
                onUpdateArticulator={handleUpdateArticulator}
                locale={locale}
                variant="hud"
              />
            )}

            {/* Articulation Progress Slider & Play Button */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onSettingsChange((prev) => ({
                        ...prev,
                        articulator: {
                          ...prev.articulator,
                          isPlaying: !prev.articulator.isPlaying,
                        },
                      }))
                    }
                    className="p-1 rounded bg-sky-500 text-white hover:bg-sky-600 transition-colors"
                    title={
                      settings.articulator.isPlaying
                        ? tr(locale, '暫停咬合運動', 'Pause articulation')
                        : tr(locale, '自動播放咬合運動', 'Auto-play articulation')
                    }
                  >
                    {settings.articulator.isPlaying ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                  </button>
                  <span>{tr(locale, '下顎運動行程', 'Excursion Progress')}</span>
                </div>
                <span className="font-mono text-sky-600 dark:text-sky-400 tabular-nums">
                  {settings.articulator.progress === 0
                    ? tr(locale, '中心咬合 CO (0%)', 'Centric CO (0%)')
                    : `${Math.round(settings.articulator.progress * 100)}% · ${currentKinematics.incisalOpeningMm.toFixed(1)}mm / ${currentKinematics.rotationAngleDeg.toFixed(1)}°`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.articulator.progress}
                onChange={(e) => {
                  const p = parseFloat(e.target.value);
                  onSettingsChange((prev) => ({
                    ...prev,
                    occlusionSeparation: Math.round(p * 35),
                    articulator: {
                      ...prev.articulator,
                      progress: p,
                      isPlaying: false,
                    },
                  }));
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            {/* Occlusogram & 3D Model Diff Quick Toggles */}
            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <button
                type="button"
                data-testid="hud-occlusogram-btn"
                onClick={() =>
                  onSettingsChange((prev) => ({
                    ...prev,
                    occlusogramEnabled: !prev.occlusogramEnabled,
                  }))
                }
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors border flex items-center justify-center gap-1.5 ${
                  settings.occlusogramEnabled
                    ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>{tr(locale, '咬合熱力圖', 'Occlusogram')}</span>
              </button>
              <button
                type="button"
                data-testid="hud-diff-toggle"
                onClick={() =>
                  onSettingsChange((prev) => {
                    const cur = prev.modelDiff || DEFAULT_MODEL_DIFF_SETTINGS;
                    return {
                      ...prev,
                      modelDiff: {
                        ...cur,
                        enabled: !cur.enabled,
                      },
                    };
                  })
                }
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors border flex items-center justify-center gap-1.5 ${
                  settings.modelDiff?.enabled
                    ? 'bg-cyan-600 border-cyan-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>{tr(locale, '3D 差異比對', '3D Model Diff')}</span>
              </button>
            </div>

            {/* Quick shading pills */}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800/80 gap-1.5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {tr(locale, '材質', 'Shader')}
              </span>
              <div className="flex items-center gap-1">
                {[
                  { id: 'texture', label: tr(locale, '貼圖', 'Texture') },
                  { id: 'enamel', label: tr(locale, '琺瑯質', 'Enamel') },
                  { id: 'plaster', label: tr(locale, '石膏', 'Plaster') },
                  { id: 'normal', label: tr(locale, '法線', 'Normals') },
                  { id: 'wireframe', label: tr(locale, '線框', 'Wire') },
                  { id: 'translucent', label: tr(locale, '半透', 'X-Ray') },
                ].map((m) => {
                  const isSelected =
                    m.id === 'texture'
                      ? settings.shadingMode === 'texture' ||
                        settings.photoTextureMapped
                      : settings.shadingMode === m.id &&
                        !settings.photoTextureMapped;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        onSettingsChange((prev) => ({
                          ...prev,
                          shadingMode: m.id as ViewportSettings['shadingMode'],
                          photoTextureMapped: m.id === 'texture',
                        }))
                      }
                      className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                        isSelected
                          ? 'bg-sky-500/15 dark:bg-slate-700 text-sky-700 dark:text-sky-300 font-medium'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Real-time CAD Mesh & System Stats Badge */}
      <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-white/90 dark:bg-[#090d16]/80 border border-slate-200 dark:border-slate-800/80 rounded-md text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums shadow-sm">
        <span>
          {tr(locale, '上顎', 'Maxilla')}:{' '}
          <strong className="text-slate-800 dark:text-slate-200 font-semibold">
            {triangleStats.upper.toLocaleString()}
          </strong>{' '}
          Δ
        </span>
        <span>
          {tr(locale, '下顎', 'Mandible')}:{' '}
          <strong className="text-slate-800 dark:text-slate-200 font-semibold">
            {triangleStats.lower.toLocaleString()}
          </strong>{' '}
          Δ
        </span>
        <span>
          {tr(locale, '總計', 'Total')}:{' '}
          <strong className="text-sky-600 dark:text-sky-300 font-semibold">
            {(triangleStats.upper + triangleStats.lower).toLocaleString()}
          </strong>
        </span>
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
          {fps} FPS
        </span>
      </div>
    </div>
  );
};
