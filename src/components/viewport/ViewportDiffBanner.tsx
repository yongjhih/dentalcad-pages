import React from 'react';
import { GitCompare } from 'lucide-react';
import {
  LocaleMode,
  ModelDiffDisplayMode,
  ModelDiffStats,
  ViewportSettings,
} from '../../types/dental';
import { DEFAULT_MODEL_DIFF_SETTINGS } from '../../utils/modelDiff';
import { tr } from '../../utils/i18n';

export interface ViewportDiffBannerProps {
  settings: ViewportSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<ViewportSettings>>;
  diffStats: ModelDiffStats;
  locale?: LocaleMode;
}

export const ViewportDiffBanner: React.FC<ViewportDiffBannerProps> = ({
  settings,
  onSettingsChange,
  diffStats,
  locale = 'en',
}) => {
  if (!settings.modelDiff?.enabled) {
    return null;
  }

  return (
    <div
      data-testid="viewport-diff-banner"
      className="absolute top-32 sm:top-28 left-20 sm:left-24 z-30 bg-white/95 dark:bg-[#0f172a]/95 border border-cyan-500/50 text-slate-900 dark:text-slate-100 px-3 py-2 rounded-xl text-xs flex flex-col gap-1.5 shadow-lg backdrop-blur max-w-xs sm:max-w-md"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 font-semibold text-cyan-600 dark:text-cyan-400">
          <GitCompare className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{tr(locale, '3D 數位模型差異比對', '3D Model Diff')}</span>
        </div>
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'both', label: tr(locale, '熱圖+疊影', 'Both') },
              { id: 'heatmap', label: tr(locale, '偏差熱圖', 'Heatmap') },
              { id: 'overlay', label: tr(locale, '雙模疊影', 'Overlay') },
            ] as { id: ModelDiffDisplayMode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              data-testid={`viewport-diff-mode-${m.id}`}
              onClick={() =>
                onSettingsChange((prev) => ({
                  ...prev,
                  modelDiff: {
                    ...(prev.modelDiff || DEFAULT_MODEL_DIFF_SETTINGS),
                    displayMode: m.id,
                  },
                }))
              }
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                (settings.modelDiff?.displayMode || 'both') === m.id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="h-2 w-full rounded-full"
        style={{
          background:
            'linear-gradient(90deg, #1d4ed8 0%, #06b6d4 28%, #10b981 50%, #eab308 72%, #ef4444 100%)',
        }}
      />
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 dark:text-slate-300 tabular-nums gap-2">
        <span className="text-blue-600 dark:text-blue-400">
          -{(settings.modelDiff?.maxRangeMm || 2.0).toFixed(1)}mm
        </span>
        <span className="text-emerald-600 dark:text-emerald-400">
          ±{(settings.modelDiff?.toleranceMm || 0.25).toFixed(2)}mm (
          {diffStats.inTolerancePercent.toFixed(1)}%)
        </span>
        <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
          RMSD {diffStats.rmsdMm.toFixed(2)}mm
        </span>
        <span className="text-rose-600 dark:text-rose-400">
          +{(settings.modelDiff?.maxRangeMm || 2.0).toFixed(1)}mm
        </span>
      </div>
    </div>
  );
};
