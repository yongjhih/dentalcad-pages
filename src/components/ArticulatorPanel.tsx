import React, { useRef, useState, useMemo } from 'react';
import {
  ViewportSettings,
  ArticulationMode,
  ArticulationCurvePresetId,
  OcclusogramStats,
  OrthoArchMetrics,
  CaliperMeasurement,
  LocaleMode,
} from '../types/dental';
import { tr } from '../utils/i18n';
import {
  ARTICULATION_CURVE_PRESETS,
  computeMandibularKinematics,
  sampleArticulationTrajectory,
} from '../utils/articulatorKinematics';
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Flame,
  Ruler,
  Eye,
  Trash2,
  Plus,
  Compass,
} from 'lucide-react';

interface ArticulatorPanelProps {
  settings: ViewportSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<ViewportSettings>>;
  occlusogramStats: OcclusogramStats;
  archMetrics: OrthoArchMetrics;
  caliperMeasurements: CaliperMeasurement[];
  onClearCaliperMeasurements: () => void;
  onAddPresetCaliperMeasurement: () => void;
  locale?: LocaleMode;
}

export const ArticulatorPanel: React.FC<ArticulatorPanelProps> = ({
  settings,
  onSettingsChange,
  occlusogramStats,
  archMetrics,
  caliperMeasurements,
  onClearCaliperMeasurements,
  onAddPresetCaliperMeasurement,
  locale = 'zh-TW',
}) => {
  const { articulator } = settings;
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingHandle, setDraggingHandle] = useState<'p1' | 'p2' | null>(null);
  const [curveViewMode, setCurveViewMode] = useState<'bezier' | 'sagittal'>('bezier');

  // Compute live kinematics & sampled trajectory for the curve preview
  const kinematics = useMemo(
    () => computeMandibularKinematics(articulator),
    [articulator]
  );

  const trajectorySamples = useMemo(
    () => sampleArticulationTrajectory(articulator, 36),
    [articulator]
  );

  const updateArticulator = (patch: Partial<typeof articulator>) => {
    onSettingsChange((prev) => {
      const nextArt = { ...prev.articulator, ...patch };
      return {
        ...prev,
        occlusionSeparation: Math.round(nextArt.progress * 35),
        articulator: nextArt,
      };
    });
  };

  const handleSelectCurvePreset = (presetId: Exclude<ArticulationCurvePresetId, 'custom'>) => {
    const preset = ARTICULATION_CURVE_PRESETS[presetId];
    updateArticulator({
      curvePresetId: presetId,
      bezier: { ...preset.bezier },
      condylarGuidanceAngleDeg:
        preset.condylarGuidanceAngleDeg ?? articulator.condylarGuidanceAngleDeg,
      incisalGuidanceAngleDeg:
        preset.incisalGuidanceAngleDeg ?? articulator.incisalGuidanceAngleDeg,
    });
  };

  // Interactive SVG Bezier handle drag
  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingHandle || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const pad = 24;
    const plotW = Math.max(1, rect.width - pad * 2);
    const plotH = Math.max(1, rect.height - pad * 2);

    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left - pad) / plotW));
    const normY = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top - pad) / plotH));

    const nextBezier = {
      ...articulator.bezier,
      ...(draggingHandle === 'p1'
        ? { p1x: Number(normX.toFixed(2)), p1y: Number(normY.toFixed(2)) }
        : { p2x: Number(normX.toFixed(2)), p2y: Number(normY.toFixed(2)) }),
    };

    updateArticulator({
      curvePresetId: 'custom',
      bezier: nextBezier,
    });
  };

  const movementModes: { id: ArticulationMode; label: string; sub: string }[] = [
    {
      id: 'hinge',
      label: tr(locale, '生理樞軸開合', 'TMJ Hinge & Glide'),
      sub: tr(locale, 'TMJ 旋轉 + 髁導滑動', 'TMJ Rotation + Condylar Slip'),
    },
    {
      id: 'protrusion',
      label: tr(locale, '前突切導運動', 'Protrusive Guidance'),
      sub: 'Anterior Incisal Guidance',
    },
    {
      id: 'lateral_left',
      label: tr(locale, '左側方運動', 'Left Lateral Excursion'),
      sub: 'Left Working / Bennett',
    },
    {
      id: 'lateral_right',
      label: tr(locale, '右側方運動', 'Right Lateral Excursion'),
      sub: 'Right Working / Bennett',
    },
    {
      id: 'chewing',
      label: tr(locale, '咀嚼循環模擬', 'Chewing Envelope'),
      sub: 'Tear-Drop Mastication',
    },
    {
      id: 'parallel',
      label: tr(locale, '垂直平行開離', 'Parallel Z-Split'),
      sub: 'Parallel CAD Z-Split',
    },
  ];

  // SVG coordinate helper for Bezier view (viewBox 0 0 280 180, plot area [28..252] x [18..154])
  const toBezierSvgX = (x: number) => 28 + x * 224;
  const toBezierSvgY = (y: number) => 154 - y * 136;

  // SVG coordinate helper for Sagittal Trajectory view (mm coordinates)
  const sagittalPathD = useMemo(() => {
    if (trajectorySamples.length === 0) return '';
    const ys = trajectorySamples.map((s) => s.incisalWorld.y);
    const zs = trajectorySamples.map((s) => s.incisalWorld.z);
    const minY = Math.min(...ys) - 2;
    const maxY = Math.max(...ys) + 2;
    const minZ = Math.min(...zs) - 2;
    const maxZ = Math.max(...zs) + 2;
    const spanY = Math.max(4, maxY - minY);
    const spanZ = Math.max(4, maxZ - minZ);

    return trajectorySamples
      .map((s, idx) => {
        const sx = 36 + ((s.incisalWorld.y - minY) / spanY) * 208;
        const sy = 150 - ((s.incisalWorld.z - minZ) / spanZ) * 124;
        return `${idx === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
      })
      .join(' ');
  }, [trajectorySamples]);

  return (
    <div className="space-y-6 text-xs text-slate-700 dark:text-slate-300">
      {/* 1. iTero Virtual Articulator Mode & Playback */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <span>
              {tr(
                locale,
                'iTero 虛擬咬合器與下顎運動模擬',
                'Virtual Articulator & 6-DOF Mandibular Kinematics'
              )}
            </span>
          </h2>
          <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/30 font-mono text-[10px]">
            6-DOF Kinematics
          </span>
        </div>

        {/* 6 Movement Modes Grid */}
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="咬合運動模式">
          {movementModes.map((m) => {
            const active = articulator.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                data-testid={`articulation-mode-${m.id}`}
                onClick={() => updateArticulator({ mode: m.id })}
                className={`p-2 rounded-lg border text-left transition-colors ${
                  active
                    ? 'bg-sky-500/15 dark:bg-sky-950/60 border-sky-500 text-slate-900 dark:text-white shadow-sm'
                    : 'bg-white dark:bg-[#0b0f17] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                  {m.label}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {m.sub}
                </div>
              </button>
            );
          })}
        </div>

        {/* Playback Bar & Progress Slider */}
        <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3 rounded-lg space-y-3 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="articulator-play-toggle"
                onClick={() => updateArticulator({ isPlaying: !articulator.isPlaying })}
                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  articulator.isPlaying
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'bg-sky-500 hover:bg-sky-600 text-white'
                }`}
              >
                {articulator.isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>暫停模擬</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>自動播放運動</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="articulator-reset-btn"
                onClick={() => updateArticulator({ progress: 0, isPlaying: false })}
                title="回到中心咬合 (MIP / CO)"
                className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Playback Speed Selector */}
            <div className="flex items-center gap-1">
              {[0.5, 1.0, 1.5].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => updateArticulator({ playbackSpeed: spd })}
                  className={`px-2 py-0.5 rounded font-mono text-[10px] border transition-colors ${
                    articulator.playbackSpeed === spd
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-600 dark:text-sky-300 font-semibold'
                      : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Progress Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>咬合運動行程進度 (Motion Phase)</span>
              <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold tabular-nums">
                {Math.round(articulator.progress * 100)}%
              </span>
            </div>
            <input
              type="range"
              data-testid="articulator-progress-slider"
              min="0"
              max="1"
              step="0.01"
              value={articulator.progress}
              onChange={(e) =>
                updateArticulator({
                  progress: parseFloat(e.target.value),
                  isPlaying: false,
                })
              }
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>

          {/* Real-time 6-DOF Kinematic Readouts */}
          <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-center font-mono">
            <div className="bg-slate-50 dark:bg-slate-900/70 p-1.5 rounded border border-slate-200/70 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">切端位移</div>
              <div
                data-testid="kinematic-incisal-opening"
                className="text-xs font-semibold text-sky-600 dark:text-sky-300 tabular-nums"
              >
                {kinematics.incisalOpeningMm.toFixed(1)} mm
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/70 p-1.5 rounded border border-slate-200/70 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">樞軸轉角</div>
              <div
                data-testid="kinematic-rotation-deg"
                className="text-xs font-semibold text-amber-600 dark:text-amber-300 tabular-nums"
              >
                {kinematics.rotationAngleDeg.toFixed(1)}°
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/70 p-1.5 rounded border border-slate-200/70 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">髁頭滑動</div>
              <div
                data-testid="kinematic-condylar-slip"
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 tabular-nums"
              >
                {kinematics.condylarTranslationMm.toFixed(1)} mm
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/70 p-1.5 rounded border border-slate-200/70 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">側方偏移</div>
              <div className="text-xs font-semibold text-purple-600 dark:text-purple-300 tabular-nums">
                {kinematics.lateralShiftMm.toFixed(1)} mm
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Occlusal Movement Curve Editor */}
      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <span>咬合運動曲線與髁導參數編輯器</span>
          </h2>
          <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-900 p-0.5 rounded border border-slate-300 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCurveViewMode('bezier')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                curveViewMode === 'bezier'
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-300 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              Bezier 曲線
            </button>
            <button
              type="button"
              onClick={() => setCurveViewMode('sagittal')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                curveViewMode === 'sagittal'
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-300 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              矢狀面軌跡
            </button>
          </div>
        </div>

        {/* Curve Presets */}
        <div className="grid grid-cols-2 gap-1.5">
          {(
            Object.keys(ARTICULATION_CURVE_PRESETS) as Array<
              Exclude<ArticulationCurvePresetId, 'custom'>
            >
          ).map((presetKey) => {
            const preset = ARTICULATION_CURVE_PRESETS[presetKey];
            const isSelected = articulator.curvePresetId === presetKey;
            return (
              <button
                key={presetKey}
                type="button"
                data-testid={`curve-preset-${presetKey}`}
                onClick={() => handleSelectCurvePreset(presetKey)}
                className={`px-2.5 py-1.5 rounded border text-left transition-colors ${
                  isSelected
                    ? 'bg-sky-500/15 dark:bg-sky-950/50 border-sky-500 text-sky-700 dark:text-sky-200 font-medium'
                    : 'bg-white dark:bg-[#0b0f17] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="text-[11px] font-semibold truncate">{preset.name}</div>
              </button>
            );
          })}
        </div>

        {/* Interactive SVG Curve Canvas */}
        <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3 rounded-lg space-y-2.5 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              {curveViewMode === 'bezier'
                ? '拖曳控制點 P1 / P2 調整張口旋轉與髁頭滑移耦合曲線'
                : '下顎切端於矢狀面 (Y-Z) 之即時運動軌跡包絡線'}
            </span>
            <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400">
              {articulator.curvePresetId === 'custom'
                ? 'Custom Curve'
                : ARTICULATION_CURVE_PRESETS[articulator.curvePresetId].name}
            </span>
          </div>

          <svg
            ref={svgRef}
            data-testid="occlusal-curve-svg"
            viewBox="0 0 280 180"
            onPointerMove={handleSvgPointerMove}
            onPointerUp={() => setDraggingHandle(null)}
            onPointerLeave={() => setDraggingHandle(null)}
            className="w-full h-44 bg-slate-50 dark:bg-[#070b12] rounded border border-slate-200 dark:border-slate-800/90 select-none touch-none"
          >
            {/* Background Grid Lines */}
            {[0.25, 0.5, 0.75].map((g) => (
              <g key={g}>
                <line
                  x1={toBezierSvgX(g)}
                  y1={18}
                  x2={toBezierSvgX(g)}
                  y2={154}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800/80"
                  strokeDasharray="2 2"
                />
                <line
                  x1={28}
                  y1={toBezierSvgY(g)}
                  x2={252}
                  y2={toBezierSvgY(g)}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800/80"
                  strokeDasharray="2 2"
                />
              </g>
            ))}

            {/* Axes */}
            <rect
              x={28}
              y={18}
              width={224}
              height={136}
              fill="none"
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700"
            />

            {curveViewMode === 'bezier' ? (
              <>
                {/* Linear reference diagonal */}
                <line
                  x1={toBezierSvgX(0)}
                  y1={toBezierSvgY(0)}
                  x2={toBezierSvgX(1)}
                  y2={toBezierSvgY(1)}
                  stroke="currentColor"
                  className="text-slate-300 dark:text-slate-700"
                  strokeDasharray="4 4"
                />

                {/* Control tangent lines */}
                <line
                  x1={toBezierSvgX(0)}
                  y1={toBezierSvgY(0)}
                  x2={toBezierSvgX(articulator.bezier.p1x)}
                  y2={toBezierSvgY(articulator.bezier.p1y)}
                  stroke="#f59e0b"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                />
                <line
                  x1={toBezierSvgX(1)}
                  y1={toBezierSvgY(1)}
                  x2={toBezierSvgX(articulator.bezier.p2x)}
                  y2={toBezierSvgY(articulator.bezier.p2y)}
                  stroke="#10b981"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                />

                {/* Cubic Bezier Path */}
                <path
                  d={`M ${toBezierSvgX(0)} ${toBezierSvgY(0)} C ${toBezierSvgX(
                    articulator.bezier.p1x
                  )} ${toBezierSvgY(articulator.bezier.p1y)}, ${toBezierSvgX(
                    articulator.bezier.p2x
                  )} ${toBezierSvgY(articulator.bezier.p2y)}, ${toBezierSvgX(1)} ${toBezierSvgY(
                    1
                  )}`}
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="2.5"
                />

                {/* Current progress marker on curve */}
                <circle
                  cx={toBezierSvgX(kinematics.bezierPoint.x)}
                  cy={toBezierSvgY(kinematics.bezierPoint.y)}
                  r="4.5"
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {/* Control Point P1 */}
                <g
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDraggingHandle('p1');
                  }}
                >
                  <circle
                    cx={toBezierSvgX(articulator.bezier.p1x)}
                    cy={toBezierSvgY(articulator.bezier.p1y)}
                    r="6"
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={toBezierSvgX(articulator.bezier.p1x) + 8}
                    y={toBezierSvgY(articulator.bezier.p1y) + 4}
                    className="fill-amber-600 dark:fill-amber-400 text-[10px] font-mono font-semibold"
                  >
                    P1
                  </text>
                </g>

                {/* Control Point P2 */}
                <g
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDraggingHandle('p2');
                  }}
                >
                  <circle
                    cx={toBezierSvgX(articulator.bezier.p2x)}
                    cy={toBezierSvgY(articulator.bezier.p2y)}
                    r="6"
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={toBezierSvgX(articulator.bezier.p2x) - 20}
                    y={toBezierSvgY(articulator.bezier.p2y) - 8}
                    className="fill-emerald-600 dark:fill-emerald-400 text-[10px] font-mono font-semibold"
                  >
                    P2
                  </text>
                </g>

                {/* Axis labels */}
                <text
                  x={140}
                  y={172}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  張口行程進度 t (0% → 100%)
                </text>
              </>
            ) : (
              <>
                {/* Sagittal Incisal Path (Y-Z) */}
                <path
                  d={sagittalPathD}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <text
                  x={140}
                  y={172}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  矢狀面切端軌跡 (Posterior -Y ↔ Anterior +Y)
                </text>
              </>
            )}
          </svg>

          {/* Numeric Fine-tuning Sliders for P1 & P2 */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                <span>P1 初段斜率 (X/Y)</span>
                <span>
                  ({articulator.bezier.p1x.toFixed(2)}, {articulator.bezier.p1y.toFixed(2)})
                </span>
              </div>
              <input
                type="range"
                aria-label="控制點 P1 Y"
                data-testid="bezier-p1y-slider"
                min="0"
                max="1"
                step="0.02"
                value={articulator.bezier.p1y}
                onChange={(e) =>
                  updateArticulator({
                    curvePresetId: 'custom',
                    bezier: { ...articulator.bezier, p1y: parseFloat(e.target.value) },
                  })
                }
                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                <span>P2 後段滑移 (X/Y)</span>
                <span>
                  ({articulator.bezier.p2x.toFixed(2)}, {articulator.bezier.p2y.toFixed(2)})
                </span>
              </div>
              <input
                type="range"
                aria-label="控制點 P2 Y"
                data-testid="bezier-p2y-slider"
                min="0"
                max="1"
                step="0.02"
                value={articulator.bezier.p2y}
                onChange={(e) =>
                  updateArticulator({
                    curvePresetId: 'custom',
                    bezier: { ...articulator.bezier, p2y: parseFloat(e.target.value) },
                  })
                }
                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* TMJ Condylar & Incisal Guidance Angle Sliders */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                <span>矢狀髁導斜度 (Condylar Guidance SCI)</span>
                <span className="font-mono text-sky-600 dark:text-sky-400 tabular-nums">
                  {articulator.condylarGuidanceAngleDeg}°
                </span>
              </div>
              <input
                type="range"
                data-testid="condylar-angle-slider"
                min="10"
                max="60"
                step="1"
                value={articulator.condylarGuidanceAngleDeg}
                onChange={(e) =>
                  updateArticulator({
                    condylarGuidanceAngleDeg: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                <span>前牙切導斜度 (Incisal Guidance Angle)</span>
                <span className="font-mono text-sky-600 dark:text-sky-400 tabular-nums">
                  {articulator.incisalGuidanceAngleDeg}°
                </span>
              </div>
              <input
                type="range"
                data-testid="incisal-angle-slider"
                min="10"
                max="65"
                step="1"
                value={articulator.incisalGuidanceAngleDeg}
                onChange={(e) =>
                  updateArticulator({
                    incisalGuidanceAngleDeg: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>班奈特角 (Bennett)</span>
                  <span className="font-mono text-sky-600 dark:text-sky-400 tabular-nums">
                    {articulator.bennettAngleDeg}°
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="35"
                  step="1"
                  value={articulator.bennettAngleDeg}
                  onChange={(e) =>
                    updateArticulator({
                      bennettAngleDeg: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>最大張口角 (Max θ)</span>
                  <span className="font-mono text-sky-600 dark:text-sky-400 tabular-nums">
                    {articulator.maxOpeningAngleDeg}°
                  </span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="32"
                  step="1"
                  value={articulator.maxOpeningAngleDeg}
                  onChange={(e) =>
                    updateArticulator({
                      maxOpeningAngleDeg: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </div>

            {/* 3D Trajectory Gizmo Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/60">
              <span className="text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-500" />
                於 3D 視窗顯示運動軌跡曲線與髁頭樞軸
              </span>
              <button
                type="button"
                onClick={() =>
                  updateArticulator({
                    showTrajectoryGizmo: !articulator.showTrajectoryGizmo,
                  })
                }
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                  articulator.showTrajectoryGizmo
                    ? 'bg-sky-500 text-white border-sky-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                }`}
              >
                {articulator.showTrajectoryGizmo ? '顯示中' : '已隱藏'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. iTero Occlusogram (咬合接觸熱力圖與左右咬合平衡) */}
      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-500" />
            <span>
              {tr(
                locale,
                'iTero Occlusogram 咬合接觸熱力圖',
                'Occlusogram Bite Contact Heatmap'
              )}
            </span>
          </h2>
          <button
            type="button"
            data-testid="occlusogram-toggle-btn"
            onClick={() =>
              onSettingsChange((prev) => ({
                ...prev,
                occlusogramEnabled: !prev.occlusogramEnabled,
              }))
            }
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
              settings.occlusogramEnabled
                ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {settings.occlusogramEnabled
              ? tr(locale, '熱力圖已開啟', 'Heatmap Active')
              : tr(locale, '開啟咬合熱力圖', 'Enable Occlusogram')}
          </button>
        </div>

        <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3 rounded-lg space-y-3 shadow-sm dark:shadow-none">
          {/* Color Scale Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
              <span className="text-rose-500 font-semibold">≤0.0mm 干擾</span>
              <span className="text-orange-500">0.25mm</span>
              <span className="text-amber-500">0.55mm</span>
              <span className="text-emerald-500">0.95mm</span>
              <span className="text-sky-500">{settings.occlusogramMaxRangeMm.toFixed(1)}mm 間隙</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gradient-to-r from-rose-600 via-amber-400 to-sky-500" />
          </div>

          {/* Left vs Right Arch Occlusal Balance Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] font-medium">
              <span className="text-sky-600 dark:text-sky-400 font-mono tabular-nums">
                右側牙弓 (R): {occlusogramStats.rightContactPercent}%
              </span>
              <span className="text-slate-500 text-[10px]">左右咬合接觸對稱比</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                左側牙弓 (L): {occlusogramStats.leftContactPercent}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                className="bg-sky-500 h-full transition-all duration-300"
                style={{ width: `${occlusogramStats.rightContactPercent}%` }}
              />
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${occlusogramStats.leftContactPercent}%` }}
              />
            </div>
          </div>

          {/* Occlusogram Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-center">
            <div className="bg-slate-50 dark:bg-slate-900/70 p-2 rounded border border-slate-200/70 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">最小咬合間隙</div>
              <div
                data-testid="occlusogram-min-clearance"
                className="text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums"
              >
                {occlusogramStats.minClearanceMm > 50
                  ? '> 5.0 mm'
                  : `${occlusogramStats.minClearanceMm.toFixed(2)} mm`}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/70 p-2 rounded border border-slate-200/70 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">有效接觸面積</div>
              <div
                data-testid="occlusogram-contact-area"
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums"
              >
                {occlusogramStats.contactAreaMm2.toFixed(1)} mm²
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/70 p-2 rounded border border-slate-200/70 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">緊密/干擾區</div>
              <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                {occlusogramStats.heavyCollisionAreaMm2.toFixed(1)} mm²
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. OrthoCAD 3D Digital Caliper & Automated Arch Metrics */}
      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <span>
              {tr(
                locale,
                'OrthoCAD 牙弓分析與 3D 數位游標尺',
                'OrthoCAD Arch Biometrics & 3D Digital Caliper'
              )}
            </span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="caliper-toggle-btn"
              onClick={() =>
                onSettingsChange((prev) => ({
                  ...prev,
                  caliperToolActive: !prev.caliperToolActive,
                }))
              }
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                settings.caliperToolActive
                  ? 'bg-amber-500 border-amber-600 text-slate-950 font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {settings.caliperToolActive
                ? tr(locale, '3D 點選測距中', '3D Caliper Active')
                : tr(locale, '啟用 3D 游標尺', 'Enable 3D Caliper')}
            </button>
          </div>
        </div>

        {/* Automated OrthoCAD Arch Indices */}
        <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3 rounded-lg space-y-3 shadow-sm dark:shadow-none">
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">
                尖牙間寬 (U3-U3 / L3-L3)
              </span>
              <span
                data-testid="arch-canine-width"
                className="text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums"
              >
                {archMetrics.upperIntercanineWidthMm} / {archMetrics.lowerIntercanineWidthMm} mm
              </span>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">
                大臼齒間寬 (U6-U6 / L6-L6)
              </span>
              <span
                data-testid="arch-molar-width"
                className="text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums"
              >
                {archMetrics.upperIntermolarWidthMm} / {archMetrics.lowerIntermolarWidthMm} mm
              </span>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">
                水平覆蓋 Overjet / 垂直覆咬 Overbite
              </span>
              <span
                data-testid="arch-overjet-overbite"
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 tabular-nums"
              >
                OJ {archMetrics.overjetMm} mm · OB {archMetrics.overbiteMm} mm
              </span>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">
                上下中線偏移 / 牙弓長寬比
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                ΔX {archMetrics.midlineDeviationMm} mm · {archMetrics.archFormRatio}
              </span>
            </div>
          </div>

          {/* 3D Point-to-Point Caliper Measurements List */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-amber-500" />
                3D 游標尺測量紀錄 ({caliperMeasurements.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="add-sample-caliper-btn"
                  onClick={onAddPresetCaliperMeasurement}
                  className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30 text-[10px] flex items-center gap-1 hover:bg-sky-500/25"
                >
                  <Plus className="w-3 h-3" />
                  <span>新增示範測距</span>
                </button>
                {caliperMeasurements.length > 0 && (
                  <button
                    type="button"
                    data-testid="clear-caliper-btn"
                    onClick={onClearCaliperMeasurements}
                    className="p-1 rounded text-slate-400 hover:text-rose-500"
                    title="清除所有測量"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {caliperMeasurements.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                點擊上方「啟用 3D 游標尺」後，可直接在左側 3D 齒列模型上任選兩點測量真實毫米距離。
              </p>
            ) : (
              <div className="space-y-1.5">
                {caliperMeasurements.map((m) => (
                  <div
                    key={m.id}
                    data-testid="caliper-measurement-item"
                    className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 font-mono text-[11px]"
                  >
                    <div>
                      <span className="font-sans font-medium text-slate-800 dark:text-slate-200 mr-2">
                        {m.label}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        (ΔX:{m.deltaX} ΔY:{m.deltaY} ΔZ:{m.deltaZ})
                      </span>
                    </div>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {m.distanceMm.toFixed(2)} mm
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
