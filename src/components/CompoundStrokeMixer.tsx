import React from 'react';
import { RotateCcw, Sliders, Sparkles } from 'lucide-react';
import {
  ArticulatorSettings,
  ArticulationStrokes,
  LocaleMode,
} from '../types/dental';
import { DEFAULT_ARTICULATOR_STROKES } from '../utils/articulatorKinematics';
import { tr } from '../utils/i18n';

export interface CompoundStrokeMixerProps {
  articulator: ArticulatorSettings;
  onUpdateArticulator: (patch: Partial<ArticulatorSettings>) => void;
  locale?: LocaleMode;
  variant?: 'panel' | 'hud';
}

const JUMP_STEPS = [
  { label: '0%', val: 0 },
  { label: '25%', val: 0.25 },
  { label: '50%', val: 0.5 },
  { label: '75%', val: 0.75 },
  { label: '100%', val: 1.0 },
] as const;

export const CompoundStrokeMixer: React.FC<CompoundStrokeMixerProps> = ({
  articulator,
  onUpdateArticulator,
  locale = 'en',
  variant = 'panel',
}) => {
  const strokes: ArticulationStrokes =
    articulator.strokes ?? DEFAULT_ARTICULATOR_STROKES;
  const hingeVal = strokes.hinge ?? 0;
  const protrusionVal = strokes.protrusion ?? 0;
  const rawLateral = strokes.lateral ?? 0;
  const lateralLeftVal = Math.max(0, rawLateral);
  const lateralRightVal = Math.max(0, -rawLateral);
  const parallelVal = strokes.parallel ?? 0;

  const activeCount = [
    hingeVal > 0.001,
    protrusionVal > 0.001,
    lateralLeftVal > 0.001,
    lateralRightVal > 0.001,
    parallelVal > 0.001,
  ].filter(Boolean).length;

  const updateChannel = (patch: Partial<ArticulationStrokes>) => {
    onUpdateArticulator({
      strokes: { ...strokes, ...patch },
      progress: Math.max(articulator.progress, 0.01),
    });
  };

  const resetAllToCO = () => {
    onUpdateArticulator({
      strokes: { hinge: 0, protrusion: 0, lateral: 0, parallel: 0 },
      progress: 0,
    });
  };

  const strokeConfigs = [
    {
      id: 'hinge' as const,
      badgeNum: '1',
      name: tr(locale, '生理髁突開閉 (Hinge)', 'Hinge Axis Opening'),
      shortLabel: tr(locale, '1. 開合', '1. Hinge'),
      sub: tr(locale, '純髁頭旋轉', 'Pure Condylar Rotation'),
      value: hingeVal,
      displayValue: `${Math.round(hingeVal * 100)}% · ${(
        hingeVal * articulator.maxOpeningAngleDeg
      ).toFixed(1)}°`,
      panelTestId: 'stroke-slider-hinge',
      hudTestId: 'hud-stroke-hinge',
      onChange: (val: number) => updateChannel({ hinge: val }),
    },
    {
      id: 'protrusion' as const,
      badgeNum: '2',
      name: tr(locale, '前突運動 (Protrusion)', 'Anterior Protrusion'),
      shortLabel: tr(locale, '2. 前突', '2. Protr'),
      sub: tr(locale, '切導向前滑移', 'Forward Incisal Slide'),
      value: protrusionVal,
      displayValue: `${Math.round(protrusionVal * 100)}% · ${(
        protrusionVal * 8.5
      ).toFixed(1)} mm`,
      panelTestId: 'stroke-slider-protrusion',
      hudTestId: 'hud-stroke-protrusion',
      onChange: (val: number) => updateChannel({ protrusion: val }),
    },
    {
      id: 'lateral_left' as const,
      badgeNum: '3',
      name: tr(locale, '左側方運動 (Left Lateral)', 'Left Lateral Excursion'),
      shortLabel: tr(locale, '3. 左側方', '3. Lat L'),
      sub: tr(locale, '左側工作側導引', 'Working Left Guidance'),
      value: lateralLeftVal,
      displayValue: `${Math.round(lateralLeftVal * 100)}% · ${(
        lateralLeftVal * 4.5
      ).toFixed(1)} mm`,
      panelTestId: 'stroke-slider-lateral-left',
      hudTestId: 'hud-stroke-lateral-left',
      onChange: (val: number) => updateChannel({ lateral: val }),
    },
    {
      id: 'lateral_right' as const,
      badgeNum: '4',
      name: tr(locale, '右側方運動 (Right Lateral)', 'Right Lateral Excursion'),
      shortLabel: tr(locale, '4. 右側方', '4. Lat R'),
      sub: tr(locale, '右側工作側導引', 'Working Right Guidance'),
      value: lateralRightVal,
      displayValue: `${Math.round(lateralRightVal * 100)}% · ${(
        lateralRightVal * 4.5
      ).toFixed(1)} mm`,
      panelTestId: 'stroke-slider-lateral-right',
      hudTestId: 'hud-stroke-lateral-right',
      onChange: (val: number) => updateChannel({ lateral: -val }),
    },
    {
      id: 'parallel' as const,
      badgeNum: '5',
      name: tr(locale, '垂直平行開離 (Parallel)', 'Parallel Z-Separation'),
      shortLabel: tr(locale, '5. 垂直平行開離', '5. Parallel Z-Sep'),
      sub: tr(locale, '垂直 CAD 開離', 'Vertical CAD Z-Split'),
      value: parallelVal,
      displayValue: `${Math.round(parallelVal * 100)}% · ${(
        parallelVal * 35
      ).toFixed(1)} mm`,
      panelTestId: 'stroke-slider-parallel',
      hudTestId: 'hud-stroke-parallel',
      onChange: (val: number) => updateChannel({ parallel: val }),
    },
  ];

  if (variant === 'hud') {
    return (
      <div
        data-testid="hud-compound-strokes"
        className="p-2 rounded bg-slate-100/90 dark:bg-slate-800/80 border border-sky-500/30 space-y-1.5 text-[10px]"
      >
        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium">
          <span>{tr(locale, '獨立行程混用微調：', 'Stroke Mixer:')}</span>
          <button
            type="button"
            data-testid="hud-compound-reset-co"
            onClick={resetAllToCO}
            className="text-sky-600 dark:text-sky-400 hover:underline font-mono tabular-nums"
          >
            CO (0%)
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          {strokeConfigs.map((cfg) => (
            <div
              key={cfg.id}
              className={cfg.id === 'parallel' ? 'col-span-2' : undefined}
            >
              <div className="flex justify-between text-[9px] text-slate-500 dark:text-slate-400">
                <span>{cfg.shortLabel}</span>
                <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400">
                  {Math.round(cfg.value * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                data-testid={cfg.hudTestId}
                value={cfg.value}
                onChange={(e) => cfg.onChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-300 dark:bg-slate-700 rounded appearance-none cursor-pointer accent-sky-500"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="compound-mixed-strokes-console"
      className="bg-sky-500/5 dark:bg-sky-950/20 border border-sky-500/30 rounded-xl p-3 space-y-3 shadow-sm"
    >
      {/* Header: Title, Active Counter & Global CO Reset */}
      <div className="flex items-center justify-between border-b border-sky-500/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-300">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-sky-950 dark:text-sky-100">
                {tr(
                  locale,
                  '多行程混用控制台 (各行程獨立調整)',
                  'Compound Excursion Mixer (Independent Axes)'
                )}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums font-medium ${
                  activeCount > 0
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {activeCount > 0
                  ? tr(locale, `${activeCount} 行程混用中`, `${activeCount} Active`)
                  : tr(locale, 'CO 中心咬合', 'CO Neutral')}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {tr(
                locale,
                '5 項獨立自由度運動行程，皆具備統一的 0%~100% 刻度與快速跳轉邏輯',
                '5 independent DOF strokes sharing unified 0%~100% scales & quick jumps'
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          data-testid="compound-reset-co-btn"
          onClick={resetAllToCO}
          className="flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:border-sky-500 font-medium shadow-xs transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{tr(locale, '全部重設為 CO', 'Reset All to CO')}</span>
        </button>
      </div>

      {/* Symmetrical 2-Column Grid of 5 Stroke Channels + 1 Clinical Presets Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {strokeConfigs.map((cfg) => {
          const isEngaged = cfg.value > 0.001;
          return (
            <div
              key={cfg.id}
              className={`p-2.5 rounded-lg border transition-all ${
                isEngaged
                  ? 'bg-white dark:bg-[#0b0f17] border-sky-500/60 shadow-xs ring-1 ring-sky-500/20'
                  : 'bg-white/80 dark:bg-[#0b0f17]/80 border-slate-200/90 dark:border-slate-800/90'
              }`}
            >
              {/* Channel Header */}
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono tabular-nums font-bold ${
                      isEngaged
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {cfg.badgeNum}
                  </span>
                  <div className="truncate">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {cfg.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <span
                    className={`font-mono text-xs tabular-nums font-semibold ${
                      isEngaged
                        ? 'text-sky-600 dark:text-sky-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {cfg.displayValue}
                  </span>
                  <button
                    type="button"
                    onClick={() => cfg.onChange(0)}
                    title={tr(locale, '歸零此行程', 'Zero this stroke')}
                    className={`p-0.5 rounded text-[10px] transition-colors ${
                      isEngaged
                        ? 'text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer'
                        : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Continuous Excursion Slider */}
              <div className="py-0.5">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  data-testid={cfg.panelTestId}
                  value={cfg.value}
                  onChange={(e) => cfg.onChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              {/* Consistent Quick Jump Percentage Buttons (0%, 25%, 50%, 75%, 100%) */}
              <div className="grid grid-cols-5 gap-1 pt-1.5">
                {JUMP_STEPS.map((jump) => {
                  const isJumpActive = Math.abs(cfg.value - jump.val) < 0.015;
                  return (
                    <button
                      key={jump.label}
                      type="button"
                      data-testid={`${cfg.panelTestId}-jump-${jump.val * 100}`}
                      onClick={() => cfg.onChange(jump.val)}
                      className={`py-0.5 rounded text-[10px] font-mono tabular-nums transition-colors text-center ${
                        isJumpActive
                          ? 'bg-sky-500 text-white font-semibold shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {jump.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Slot 6: Clinical Combination Presets Card */}
        <div className="p-2.5 rounded-lg border bg-white/90 dark:bg-[#0b0f17]/90 border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full flex items-center justify-center bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  <Sparkles className="w-2.5 h-2.5" />
                </span>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                  {tr(locale, '臨床常用混用組合預設', 'Clinical Presets')}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Presets
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
              {tr(
                locale,
                '快速套用常見的多行程複合咬合運動狀態',
                'Quick-apply standard compound mandibular motions'
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <button
              type="button"
              data-testid="preset-mix-protrusion-open"
              onClick={() =>
                onUpdateArticulator({
                  strokes: { hinge: 0.2, protrusion: 0.65, lateral: 0, parallel: 0 },
                  progress: 1.0,
                })
              }
              className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500 text-left truncate text-slate-700 dark:text-slate-300 transition-colors"
            >
              {tr(locale, '前突切導 + 開合', 'Protrusion + Open')}
            </button>
            <button
              type="button"
              data-testid="preset-mix-left-open"
              onClick={() =>
                onUpdateArticulator({
                  strokes: { hinge: 0.18, protrusion: 0, lateral: 0.6, parallel: 0 },
                  progress: 1.0,
                })
              }
              className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500 text-left truncate text-slate-700 dark:text-slate-300 transition-colors"
            >
              {tr(locale, '左側方 + 開合', 'Left Lat + Open')}
            </button>
            <button
              type="button"
              data-testid="preset-mix-right-open"
              onClick={() =>
                onUpdateArticulator({
                  strokes: { hinge: 0.18, protrusion: 0, lateral: -0.6, parallel: 0 },
                  progress: 1.0,
                })
              }
              className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500 text-left truncate text-slate-700 dark:text-slate-300 transition-colors"
            >
              {tr(locale, '右側方 + 開合', 'Right Lat + Open')}
            </button>
            <button
              type="button"
              data-testid="preset-mix-tripod"
              onClick={() =>
                onUpdateArticulator({
                  strokes: { hinge: 0.15, protrusion: 0.35, lateral: 0.3, parallel: 0 },
                  progress: 1.0,
                })
              }
              className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500 text-left truncate text-slate-700 dark:text-slate-300 transition-colors"
            >
              {tr(locale, '咬合干擾 (Tripod)', 'Tripod Contact')}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden alias slider for backward compatibility with stroke-slider-lateral queries */}
      <input
        type="range"
        min="-1"
        max="1"
        step="0.01"
        data-testid="stroke-slider-lateral"
        aria-hidden="true"
        tabIndex={-1}
        value={rawLateral}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          updateChannel({ lateral: val });
        }}
        className="sr-only"
      />
    </div>
  );
};
