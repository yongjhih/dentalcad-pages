import React from 'react';
import { Eye, EyeOff, Ruler, Trash2 } from 'lucide-react';
import {
  CaliperMeasurement,
  LocaleMode,
  Point3D,
  ViewportSettings,
} from '../../types/dental';
import { tr } from '../../utils/i18n';

export interface ViewportCaliperBannerProps {
  settings: ViewportSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<ViewportSettings>>;
  caliperMeasurements: CaliperMeasurement[];
  pendingCaliperPoint: Point3D | null;
  onClearAllCaliper: () => void;
  locale?: LocaleMode;
}

export const ViewportCaliperBanner: React.FC<ViewportCaliperBannerProps> = ({
  settings,
  onSettingsChange,
  caliperMeasurements,
  pendingCaliperPoint,
  onClearAllCaliper,
  locale = 'en',
}) => {
  if (
    !settings.caliperToolActive &&
    caliperMeasurements.length === 0 &&
    !pendingCaliperPoint
  ) {
    return null;
  }

  return (
    <div className="absolute top-24 sm:top-16 left-2.5 sm:left-4 z-30 bg-white/95 dark:bg-[#0f172a]/95 border border-amber-500/50 text-slate-900 dark:text-slate-100 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-md backdrop-blur max-w-[calc(100%-1.25rem)]">
      <Ruler className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
      <span className="font-medium truncate">
        {settings.caliperToolActive
          ? pendingCaliperPoint
            ? tr(
                locale,
                '請點選第二點 (Point B) 完成測距',
                'Click second point (Point B) to measure'
              )
            : tr(
                locale,
                '3D 測距中：請於齒列模型上點選兩點',
                '3D Caliper active: click two points on the arch'
              )
          : tr(
              locale,
              `已標記 ${caliperMeasurements.length} 組 3D 測距`,
              `${caliperMeasurements.length} 3D measurement(s)`
            )}
      </span>
      {caliperMeasurements.length > 0 && (
        <span className="font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums border-l border-slate-200 dark:border-slate-700 pl-2 flex-shrink-0">
          {caliperMeasurements[0].distanceMm.toFixed(2)} mm
        </span>
      )}
      {caliperMeasurements.length > 0 && (
        <button
          type="button"
          data-testid="viewport-toggle-measurements-banner-btn"
          onClick={() =>
            onSettingsChange((prev) => ({
              ...prev,
              showMeasurements: prev.showMeasurements === false ? true : false,
            }))
          }
          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors flex-shrink-0"
          title={
            settings.showMeasurements === false
              ? tr(locale, '顯示 3D 測距線與標記點', 'Show 3D measurements')
              : tr(locale, '隱藏 3D 測距線與標記點', 'Hide 3D measurements')
          }
        >
          {settings.showMeasurements === false ? (
            <>
              <Eye className="w-3 h-3 text-amber-500" />
              <span>{tr(locale, '顯示測距', 'Show')}</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3 h-3 text-slate-400" />
              <span>{tr(locale, '隱藏測距', 'Hide')}</span>
            </>
          )}
        </button>
      )}
      {(caliperMeasurements.length > 0 || pendingCaliperPoint) && (
        <button
          type="button"
          data-testid="viewport-clear-caliper-btn"
          onClick={onClearAllCaliper}
          className="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors flex-shrink-0"
          title={tr(
            locale,
            '直接清除 3D 視窗中的所有測距線與標記點',
            'Clear all 3D caliper lines and markers'
          )}
        >
          <Trash2 className="w-3 h-3" />
          <span>{tr(locale, '清除測距', 'Clear')}</span>
        </button>
      )}
    </div>
  );
};
