import React, { useRef } from 'react';
import {
  ViewportSettings,
  DentalCaseBundle,
  ModelDiffStats,
  ModelDiffDisplayMode,
  LocaleMode,
} from '../types/dental';
import { DEFAULT_MODEL_DIFF_SETTINGS } from '../utils/modelDiff';
import { getDisplayMetadata } from '../utils/anonymize';
import { tr } from '../utils/i18n';
import {
  GitCompare,
  Layers,
  Eye,
  Upload,
  RotateCcw,
  CheckCircle2,
  Crosshair,
  Activity,
} from 'lucide-react';

interface ModelDiffPanelProps {
  settings: ViewportSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<ViewportSettings>>;
  diffStats: ModelDiffStats;
  cases: DentalCaseBundle[];
  activeCaseId: string;
  anonymizePatient?: boolean;
  locale?: LocaleMode;
}

export const ModelDiffPanel: React.FC<ModelDiffPanelProps> = ({
  settings,
  onSettingsChange,
  diffStats,
  cases,
  activeCaseId,
  anonymizePatient = true,
  locale = 'en',
}) => {
  const upperDiffStlInputRef = useRef<HTMLInputElement>(null);
  const lowerDiffStlInputRef = useRef<HTMLInputElement>(null);

  const diff = settings.modelDiff || DEFAULT_MODEL_DIFF_SETTINGS;
  const otherCases = cases.filter((c) => c.id !== activeCaseId);
  const activeCase = cases.find((c) => c.id === activeCaseId) || cases[0];
  const activeMeta = activeCase
    ? getDisplayMetadata(activeCase.metadata, anonymizePatient)
    : null;

  const updateDiff = (patch: Partial<typeof diff>) => {
    onSettingsChange((prev) => ({
      ...prev,
      modelDiff: {
        ...(prev.modelDiff || DEFAULT_MODEL_DIFF_SETTINGS),
        ...patch,
      },
    }));
  };

  const handleCustomDiffStlUpload = (isUpper: boolean, file?: File) => {
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    if (isUpper) {
      updateDiff({
        enabled: true,
        compareTargetId: 'custom_stl',
        customUpperStlUrl: blobUrl,
        customUpperStlFileName: file.name,
      });
    } else {
      updateDiff({
        enabled: true,
        compareTargetId: 'custom_stl',
        customLowerStlUrl: blobUrl,
        customLowerStlFileName: file.name,
      });
    }
  };

  const displayModes: Array<{
    id: ModelDiffDisplayMode;
    label: string;
    sub: string;
  }> = [
    {
      id: 'both',
      label: tr(locale, '色溫圖 + 疊影', 'Heatmap + Overlay'),
      sub: tr(locale, '偏差色溫與半透明目標網格', 'Signed map & ghost mesh'),
    },
    {
      id: 'heatmap',
      label: tr(locale, '3D 偏差色溫圖', 'Deviation Heatmap'),
      sub: tr(locale, '頂點有向距離著色', 'Per-vertex signed distance'),
    },
    {
      id: 'overlay',
      label: tr(locale, '雙模型疊影', 'Ghost Superimposition'),
      sub: tr(locale, '原始材質與目標疊影', 'Original shader + ghost'),
    },
  ];

  const simulatedPresets = [
    {
      id: 'simulated:ortho_alignment',
      label: tr(
        locale,
        '模擬矯正：前牙內收與排齊 (Ortho Alignment & Retraction)',
        'Simulated Ortho: Anterior Retraction & Alignment'
      ),
      desc: tr(
        locale,
        '前牙舌側內收 -1.15mm、壓入 0.42mm 與小臼齒微擴弓 +0.88mm',
        'Incisor lingual retraction (-1.15mm), intrusion (0.42mm) & premolar rounding (+0.88mm)'
      ),
    },
    {
      id: 'simulated:arch_expansion',
      label: tr(
        locale,
        '模擬矯正：橫向擴弓治療 (Transverse Arch Expansion)',
        'Simulated Ortho: Transverse Arch Expansion'
      ),
      desc: tr(
        locale,
        '雙側小臼齒與大臼齒頰側橫向擴弓 +1.32mm',
        'Bilateral premolar and molar buccal expansion (+1.32mm)'
      ),
    },
    {
      id: 'simulated:occlusal_wear',
      label: tr(
        locale,
        '臨床追蹤：咬合磨耗與牙齦萎縮 (Occlusal Wear & Recession)',
        'Clinical Follow-up: Occlusal Wear & Gingival Recession'
      ),
      desc: tr(
        locale,
        '咬合面牙尖磨耗 -0.95mm 與齒頸部游離齦緣萎縮 -0.52mm',
        'Occlusal cusp attrition (-0.95mm) & cervical gingival margin recession (-0.52mm)'
      ),
    },
  ];

  return (
    <div
      data-testid="model-diff-panel"
      className="space-y-5 text-xs text-slate-700 dark:text-slate-300"
    >
      {/* Header & Master Switch */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <span>
              {tr(
                locale,
                '3D 模型差異比對 (3D Model Diff)',
                '3D Model Diff & Superimposition'
              )}
            </span>
          </h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            3D Mesh Deviation
          </span>
        </div>

        <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl flex items-center justify-between gap-3 shadow-sm dark:shadow-none">
          <div className="space-y-0.5 min-w-0">
            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>
                {tr(
                  locale,
                  '啟用 3D 齒列差異比對模式',
                  'Enable 3D Dental Mesh Diff'
                )}
              </span>
              {diff.enabled && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {tr(
                locale,
                '比對基準牙弓與目標模型之 3D 表面有向距離誤差 (RMSD)、矯正前後位移與雙網格疊影。',
                'Compare baseline arch against target scans or treatment stages with signed deviation heatmaps and ghost overlays.'
              )}
            </p>
          </div>

          <button
            type="button"
            data-testid="diff-master-toggle"
            onClick={() => updateDiff({ enabled: !diff.enabled })}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 flex-shrink-0 ${
              diff.enabled
                ? 'bg-sky-600 hover:bg-sky-500 border-sky-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>
              {diff.enabled
                ? tr(locale, '比對已開啟', 'Diff ON')
                : tr(locale, '開啟 3D 比對', 'Enable Diff')}
            </span>
          </button>
        </div>
      </div>

      {/* Baseline vs Target Selection */}
      <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-3 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-500" />
            {tr(locale, '基準案例與比對目標 (Reference vs Target)', 'Reference vs Comparison Target')}
          </span>
        </div>

        {/* Baseline Reference Case Info */}
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400">
            {tr(locale, '基準模型 (Scan A):', 'Baseline (Scan A):')}
          </span>
          <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate max-w-[230px]">
            {activeMeta
              ? `#${activeMeta.orderId} — ${activeMeta.patientName}`
              : activeCaseId}
          </span>
        </div>

        {/* Target Model Dropdown Selector */}
        <div className="space-y-1.5">
          <label
            htmlFor="diff-target-select"
            className="block text-[11px] font-medium text-slate-600 dark:text-slate-400"
          >
            {tr(locale, '選擇比對目標模型 (Target Scan B):', 'Select Comparison Target (Scan B):')}
          </label>
          <select
            id="diff-target-select"
            data-testid="diff-target-select"
            value={diff.compareTargetId}
            onChange={(e) =>
              updateDiff({
                enabled: true,
                compareTargetId: e.target.value,
              })
            }
            className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {otherCases.length > 0 && (
              <optgroup
                label={tr(
                  locale,
                  `已載入之案例庫 (${otherCases.length} 組可比對)`,
                  `Loaded Cases (${otherCases.length} available)`
                )}
              >
                {otherCases.map((c) => {
                  const meta = getDisplayMetadata(c.metadata, anonymizePatient);
                  return (
                    <option key={c.id} value={c.id}>
                      #{meta.orderId} — {meta.patientName} ({meta.scanDate})
                    </option>
                  );
                })}
              </optgroup>
            )}
            <optgroup
              label={tr(
                locale,
                '內建臨床矯正與磨耗模擬目標 (Simulated Clinical Stages)',
                'Simulated Clinical & Orthodontic Stages'
              )}
            >
              {simulatedPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
            {(diff.customUpperStlUrl || diff.customLowerStlUrl || diff.compareTargetId === 'custom_stl') && (
              <optgroup label={tr(locale, '自訂上傳比對 STL', 'Custom Uploaded STL')}>
                <option value="custom_stl">
                  {tr(locale, '自訂比對 STL 模型', 'Custom Comparison STL')} (
                  {diff.customUpperStlFileName || diff.customLowerStlFileName || 'STL'})
                </option>
              </optgroup>
            )}
          </select>
        </div>

        {/* Quick Preset Cards for Simulated Targets */}
        <div className="grid grid-cols-1 gap-1.5 pt-1">
          {simulatedPresets.map((preset) => {
            const active = diff.compareTargetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`diff-preset-${preset.id.replace('simulated:', '')}`}
                onClick={() =>
                  updateDiff({
                    enabled: true,
                    compareTargetId: preset.id,
                  })
                }
                className={`text-left p-2 rounded-lg border transition-colors ${
                  active
                    ? 'bg-sky-500/10 dark:bg-sky-950/50 border-sky-500/60 text-slate-900 dark:text-slate-100'
                    : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="font-medium text-[11px] flex items-center justify-between">
                  <span>{preset.label}</span>
                  {active && <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {preset.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Direct Custom Comparison STL File Upload */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
          <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
            {tr(
              locale,
              '或直接載入欲比對之目標 STL 檔案 (Scan B):',
              'Or load custom target STL files for comparison (Scan B):'
            )}
          </span>
          <div className="grid grid-cols-2 gap-2">
            <input
              ref={upperDiffStlInputRef}
              data-testid="diff-upper-stl-input"
              type="file"
              accept=".stl,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleCustomDiffStlUpload(true, e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              data-testid="diff-upload-upper-stl-btn"
              onClick={() => upperDiffStlInputRef.current?.click()}
              className="py-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 text-[11px] font-medium transition-colors"
            >
              <Upload className="w-3 h-3 text-amber-500" />
              <span className="truncate">
                {diff.customUpperStlFileName ||
                  tr(locale, '比對上顎 STL', 'Target Upper STL')}
              </span>
            </button>

            <input
              ref={lowerDiffStlInputRef}
              data-testid="diff-lower-stl-input"
              type="file"
              accept=".stl,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleCustomDiffStlUpload(false, e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              data-testid="diff-upload-lower-stl-btn"
              onClick={() => lowerDiffStlInputRef.current?.click()}
              className="py-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 text-[11px] font-medium transition-colors"
            >
              <Upload className="w-3 h-3 text-sky-500" />
              <span className="truncate">
                {diff.customLowerStlFileName ||
                  tr(locale, '比對下顎 STL', 'Target Lower STL')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Visualization Mode: Heatmap / Ghost Overlay / Both */}
      <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-3 shadow-sm dark:shadow-none">
        <span className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-sky-500" />
          {tr(locale, '3D 差異視覺化模式 (Visualization Mode)', '3D Diff Visualization Mode')}
        </span>

        <div className="grid grid-cols-3 gap-1.5">
          {displayModes.map((m) => {
            const active = diff.displayMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                data-testid={`diff-mode-${m.id}`}
                onClick={() => updateDiff({ enabled: true, displayMode: m.id })}
                className={`p-2 rounded-lg border text-left transition-all ${
                  active
                    ? 'bg-sky-500/15 dark:bg-sky-950/60 border-sky-500 text-sky-700 dark:text-sky-300 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold text-[11px] leading-tight">{m.label}</div>
                <div className="text-[10px] opacity-75 mt-0.5 leading-tight">{m.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Signed Deviation Color Scale Legend */}
        <div className="pt-1 space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
            <span className="text-blue-500 font-semibold">
              -{diff.maxRangeMm.toFixed(1)} mm ({tr(locale, '內縮/磨耗', 'Inward')})
            </span>
            <span className="text-emerald-500 font-semibold">
              ±{diff.toleranceMm.toFixed(2)} mm ({tr(locale, '吻合公差', 'In-Tol')})
            </span>
            <span className="text-red-500 font-semibold">
              +{diff.maxRangeMm.toFixed(1)} mm ({tr(locale, '外擴/突出', 'Outward')})
            </span>
          </div>
          <div
            className="h-2.5 w-full rounded-full border border-slate-300 dark:border-slate-700"
            style={{
              background:
                'linear-gradient(90deg, #1d4ed8 0%, #06b6d4 28%, #22c55e 44%, #22c55e 56%, #eab308 72%, #ef4444 100%)',
            }}
          />
        </div>

        {/* Sliders for Range, Tolerance, and Ghost Opacity */}
        <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/70">
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">
                {tr(locale, '最大色溫量程 (Max Deviation Scale)', 'Max Deviation Scale')}
              </span>
              <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">
                ±{diff.maxRangeMm.toFixed(2)} mm
              </span>
            </div>
            <input
              type="range"
              data-testid="diff-max-range-slider"
              min="0.5"
              max="3.0"
              step="0.1"
              value={diff.maxRangeMm}
              onChange={(e) => updateDiff({ maxRangeMm: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">
                {tr(locale, '綠色吻合公差區間 (Green Tolerance Zone)', 'Green Tolerance Zone')}
              </span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                ±{diff.toleranceMm.toFixed(2)} mm
              </span>
            </div>
            <input
              type="range"
              data-testid="diff-tolerance-slider"
              min="0.05"
              max="0.50"
              step="0.05"
              value={diff.toleranceMm}
              onChange={(e) => updateDiff({ toleranceMm: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {(diff.displayMode === 'overlay' || diff.displayMode === 'both') && (
            <div className="space-y-2 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">
                    {tr(locale, '目標疊影不透明度 (Ghost Opacity)', 'Ghost Overlay Opacity')}
                  </span>
                  <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                    {Math.round(diff.overlayOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="diff-overlay-opacity-slider"
                  min="0.15"
                  max="0.85"
                  step="0.05"
                  value={diff.overlayOpacity}
                  onChange={(e) =>
                    updateDiff({ overlayOpacity: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {tr(locale, '目標疊影線框模式 (Ghost Wireframe)', 'Ghost Mesh Wireframe')}
                </span>
                <button
                  type="button"
                  data-testid="diff-overlay-wireframe-btn"
                  onClick={() =>
                    updateDiff({ overlayWireframe: !diff.overlayWireframe })
                  }
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                    diff.overlayWireframe
                      ? 'bg-cyan-600 border-cyan-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {diff.overlayWireframe
                    ? tr(locale, '線框開啟', 'Wireframe ON')
                    : tr(locale, '實體半透明', 'Solid Ghost')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quantitative 3D Deviation Telemetry */}
      <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-3 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            {tr(
              locale,
              '3D 偏差量化統計報表 (Deviation Metrics)',
              'Quantitative 3D Deviation Metrics'
            )}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {diffStats.comparedVertexCount.toLocaleString()} pts
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {tr(locale, 'RMS 均方根誤差', 'RMS Deviation')}
            </div>
            <div
              data-testid="diff-stat-rmsd"
              className="text-sm font-mono font-bold text-sky-600 dark:text-sky-400 mt-0.5 tabular-nums"
            >
              {diffStats.rmsdMm.toFixed(2)} mm
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {tr(locale, '公差內吻合率', 'In-Tolerance Rate')}
            </div>
            <div
              data-testid="diff-stat-in-tolerance"
              className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums"
            >
              {diffStats.inTolerancePercent.toFixed(1)}%
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {tr(locale, '平均絕對偏差', 'Mean Abs Diff')}
            </div>
            <div
              data-testid="diff-stat-mean-abs"
              className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums"
            >
              {diffStats.meanAbsDiffMm.toFixed(2)} mm
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {tr(locale, '最大外擴正偏差', 'Max Outward (+)')}
            </div>
            <div
              data-testid="diff-stat-max-pos"
              className="text-sm font-mono font-bold text-red-500 mt-0.5 tabular-nums"
            >
              +{diffStats.maxPositiveMm.toFixed(2)} mm
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {tr(locale, '最大內縮負偏差', 'Max Inward (-)')}
            </div>
            <div
              data-testid="diff-stat-max-neg"
              className="text-sm font-mono font-bold text-blue-500 mt-0.5 tabular-nums"
            >
              {diffStats.maxNegativeMm.toFixed(2)} mm
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {tr(locale, '上顎 / 下顎 RMSD', 'Upper / Lower RMSD')}
            </div>
            <div className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 mt-1 tabular-nums">
              U: {diffStats.upperRmsdMm.toFixed(2)} / L: {diffStats.lowerRmsdMm.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Distribution Bar */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-blue-500">
              {tr(locale, '內縮', 'Inward')} {diffStats.negativePercent}%
            </span>
            <span className="text-emerald-500">
              {tr(locale, '吻合', 'Match')} {diffStats.inTolerancePercent}%
            </span>
            <span className="text-red-500">
              {tr(locale, '外擴', 'Outward')} {diffStats.positivePercent}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
            <div
              style={{ width: `${diffStats.negativePercent}%` }}
              className="bg-blue-500 transition-all"
            />
            <div
              style={{ width: `${diffStats.inTolerancePercent}%` }}
              className="bg-emerald-500 transition-all"
            />
            <div
              style={{ width: `${diffStats.positivePercent}%` }}
              className="bg-red-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Registration & Spatial Alignment Controls */}
      <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-3 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-amber-500" />
            {tr(locale, '空間對位與微調 (Spatial Registration)', '3D Registration & Alignment')}
          </span>
          <button
            type="button"
            data-testid="diff-reset-offset-btn"
            onClick={() =>
              updateDiff({
                autoAlignCentroids: false,
                offsetMm: { x: 0, y: 0, z: 0 },
              })
            }
            className="text-[11px] text-slate-500 hover:text-sky-500 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{tr(locale, '重置對位', 'Reset')}</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200">
              {tr(locale, '自動幾何重心對齊 (Auto-Centroid Align)', 'Auto-Centroid Alignment')}
            </span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {tr(
                locale,
                '自動消除不同次口掃座標系之平移偏移量。',
                'Automatically aligns the 3D bounding centroids of two independent scans.'
              )}
            </p>
          </div>
          <button
            type="button"
            data-testid="diff-auto-align-btn"
            onClick={() =>
              updateDiff({ autoAlignCentroids: !diff.autoAlignCentroids })
            }
            className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
              diff.autoAlignCentroids
                ? 'bg-amber-500 border-amber-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            {diff.autoAlignCentroids
              ? tr(locale, '已自動對齊', 'Aligned')
              : tr(locale, '原始座標', 'Raw Coords')}
          </button>
        </div>

        {/* Manual ΔX, ΔY, ΔZ Sliders */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <div key={axis} className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="uppercase text-slate-500">Δ{axis}</span>
                <span className="text-sky-600 dark:text-sky-400">
                  {diff.offsetMm[axis] >= 0 ? '+' : ''}
                  {diff.offsetMm[axis].toFixed(1)}mm
                </span>
              </div>
              <input
                type="range"
                data-testid={`diff-offset-${axis}-slider`}
                min="-4.0"
                max="4.0"
                step="0.1"
                value={diff.offsetMm[axis]}
                onChange={(e) =>
                  updateDiff({
                    offsetMm: {
                      ...diff.offsetMm,
                      [axis]: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
