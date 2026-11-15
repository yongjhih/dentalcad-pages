import React, { useCallback, useRef, useState } from 'react';
import { CircleDot, Pause, Play } from 'lucide-react';
import { LocaleMode, ViewportSettings } from '../../types/dental';
import { tr } from '../../utils/i18n';

export interface MandibularJoystickBarProps {
  settings: ViewportSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<ViewportSettings>>;
  locale?: LocaleMode;
}

export const MandibularJoystickBar: React.FC<MandibularJoystickBarProps> = ({
  settings,
  onSettingsChange,
  locale = 'en',
}) => {
  const [joystickActive, setJoystickActive] = useState<boolean>(false);
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const joystickContainerRef = useRef<HTMLDivElement>(null);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const container = joystickContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxRadius = rect.width / 2 - 14;

      const rawDx = clientX - centerX;
      const rawDy = clientY - centerY;
      const distance = Math.hypot(rawDx, rawDy);
      const angle = Math.atan2(rawDy, rawDx);
      const clampedDist = Math.min(distance, maxRadius);

      const normX =
        clampedDist > 0 ? (Math.cos(angle) * clampedDist) / maxRadius : 0;
      const normY =
        clampedDist > 0 ? (Math.sin(angle) * clampedDist) / maxRadius : 0;

      setJoystickPos({
        x: normX * maxRadius,
        y: normY * maxRadius,
      });

      const mag = Math.min(1, clampedDist / maxRadius);
      const roundedMag = Number(mag.toFixed(3));

      onSettingsChange((prev) => ({
        ...prev,
        occlusionSeparation: Math.round(roundedMag * 35),
        articulator: {
          ...prev.articulator,
          manualExcursion: { x: normX, y: normY },
          progress: roundedMag,
          isPlaying: false,
        },
      }));
    },
    [onSettingsChange]
  );

  const handleJoystickPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setJoystickActive(true);
      updateFromPointer(e.clientX, e.clientY);
    },
    [updateFromPointer]
  );

  const handleJoystickPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!joystickActive) return;
      updateFromPointer(e.clientX, e.clientY);
    },
    [joystickActive, updateFromPointer]
  );

  const handleJoystickPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore if pointer capture already released
      }
      setJoystickActive(false);
      setJoystickPos({ x: 0, y: 0 });

      onSettingsChange((prev) => ({
        ...prev,
        occlusionSeparation: 0,
        articulator: {
          ...prev.articulator,
          manualExcursion: undefined,
          progress: 0,
          isPlaying: false,
        },
      }));
    },
    [onSettingsChange]
  );

  return (
    <div className="absolute top-20 sm:top-24 left-2.5 sm:left-4 z-30 flex flex-col items-center gap-3 bg-white/95 dark:bg-[#0f172a]/95 border border-slate-200 dark:border-slate-800 p-2 sm:p-2.5 rounded-xl backdrop-blur shadow-xl">
      {/* Play / Pause Toggle Button */}
      <button
        type="button"
        data-testid="vertical-play-toggle-btn"
        onClick={() =>
          onSettingsChange((prev) => ({
            ...prev,
            articulator: {
              ...prev.articulator,
              isPlaying: !prev.articulator.isPlaying,
            },
          }))
        }
        className={`p-1.5 rounded-lg transition-all shadow-sm ${
          settings.articulator.isPlaying
            ? 'bg-amber-500 text-white hover:bg-amber-600 animate-pulse'
            : 'bg-sky-600 text-white hover:bg-sky-500'
        }`}
        title={
          settings.articulator.isPlaying
            ? tr(locale, '暫停下顎運動 (垂直 SeekBar)', 'Pause articulation')
            : tr(locale, '自動播放下顎運動 (垂直 SeekBar)', 'Auto-play articulation')
        }
      >
        {settings.articulator.isPlaying ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Vertical Seek Bar */}
      <div className="flex flex-col items-center gap-1.5 h-36 sm:h-44">
        <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 font-semibold uppercase tabular-nums">
          100%
        </span>
        <div className="relative flex-1 flex items-center justify-center w-6">
          <input
            type="range"
            data-testid="vertical-articulation-seekbar"
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
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
            }}
            className="w-1.5 h-28 sm:h-36 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            title={tr(locale, '垂直咬合行程拉桿', 'Vertical Articulation Slider')}
          />
        </div>
        <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 font-semibold uppercase">
          CO
        </span>
      </div>

      {/* Readout Pill */}
      <div className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-medium text-sky-600 dark:text-sky-400 text-center tabular-nums">
        {Math.round(settings.articulator.progress * 100)}%
      </div>

      <div className="w-full h-px bg-slate-200 dark:bg-slate-800" />

      {/* Spring-Back Mandibular Joystick (蘑菇頭控制器 - 鬆開自動彈回中立位) */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 text-[9px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <CircleDot className="w-3 h-3 text-sky-500" />
          <span>{tr(locale, '搖桿', 'Stick')}</span>
        </div>

        <div
          ref={joystickContainerRef}
          data-testid="mandibular-joystick-pad"
          onPointerDown={handleJoystickPointerDown}
          onPointerMove={handleJoystickPointerMove}
          onPointerUp={handleJoystickPointerUp}
          onPointerCancel={handleJoystickPointerUp}
          className={`relative w-14 h-14 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/90 flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none shadow-inner transition-colors ${
            joystickActive ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40' : ''
          }`}
          title={tr(
            locale,
            '咬合運動蘑菇頭搖桿（拖曳模擬前突與側方運動，鬆開自動回到中立位 CO）',
            'Mandibular joystick: drag to articulate in any excursion direction; release to spring back to neutral CO.'
          )}
        >
          {/* Crosshairs & Direction Indicators */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <div className="w-full h-px bg-slate-400 dark:bg-slate-600" />
            <div className="h-full w-px bg-slate-400 dark:bg-slate-600 absolute" />
          </div>

          {/* Thumbstick Puck (蘑菇頭本體) */}
          <div
            data-testid="mandibular-joystick-thumb"
            style={{
              transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              transition: joystickActive
                ? 'none'
                : 'transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
            className={`w-6 h-6 rounded-full shadow-md flex items-center justify-center pointer-events-none transition-colors ${
              joystickActive
                ? 'bg-sky-500 text-white shadow-sky-500/40'
                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-current opacity-70" />
          </div>
        </div>
        <span className="text-[8px] text-slate-400 text-center leading-tight">
          {joystickActive
            ? tr(locale, '運動中', 'Active')
            : tr(locale, '鬆開回中', 'Spring CO')}
        </span>
      </div>
    </div>
  );
};
