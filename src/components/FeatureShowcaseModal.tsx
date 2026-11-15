import React from 'react';
import {
  X,
  Activity,
  Flame,
  GitCompare,
  Image as ImageIcon,
  Ruler,
  Shield,
  Sparkles,
  Play,
  ExternalLink,
  Layers,
  CheckCircle2,
  Link as LinkIcon,
  Wand2,
} from 'lucide-react';
import { LocaleMode } from '../types/dental';
import { tr } from '../utils/i18n';
import {
  ShowcaseFeatureIconKey,
  ShowcaseScenarioId,
  getShowcaseFeatures,
  getShowcaseQuickLinks,
} from '../utils/showcasePresets';

export type { ShowcaseScenarioId };

interface FeatureShowcaseModalProps {
  open: boolean;
  onClose: () => void;
  onLaunchScenario: (scenario: ShowcaseScenarioId) => void;
  locale?: LocaleMode;
}

const ICON_MAP: Record<ShowcaseFeatureIconKey, React.ComponentType<{ className?: string }>> = {
  wand: Wand2,
  activity: Activity,
  'git-compare': GitCompare,
  flame: Flame,
  image: ImageIcon,
  ruler: Ruler,
  sparkles: Sparkles,
};

export const FeatureShowcaseModal: React.FC<FeatureShowcaseModalProps> = ({
  open,
  onClose,
  onLaunchScenario,
  locale = 'en',
}) => {
  if (!open) return null;

  const features = getShowcaseFeatures(locale);
  const quickLinks = getShowcaseQuickLinks(locale);

  return (
    <div
      data-testid="feature-showcase-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="showcase-modal-title"
    >
      <div className="relative w-full max-w-6xl max-h-[92dvh] flex flex-col rounded-xl bg-white dark:bg-[#0b111e] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-7 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090d16] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white font-mono text-xs font-bold shadow-sm flex-shrink-0">
              CAD
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="showcase-modal-title"
                  className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white"
                >
                  {tr(
                    locale,
                    'DentalCAD Pages — 3D 數位牙科工作站功能展示與導覽',
                    'DentalCAD Pages — Interactive 3D Dental Workstation Showcase'
                  )}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                  Zero-PHI Client-Side WebGL
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {tr(
                  locale,
                  '點擊任一功能卡片下方「立即體驗」按鈕，即可自動切換 3D 視窗狀態並實機操作該功能。',
                  'Click any "Launch" button below to immediately configure the 3D workstation and test the feature live.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="./features.html"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="showcase-standalone-page-link"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-500" />
              <span>{tr(locale, '獨立功能介紹頁 (features.html)', 'Standalone Showcase Page')}</span>
            </a>
            <button
              type="button"
              data-testid="showcase-close-btn"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title={tr(locale, '關閉功能導覽', 'Close Showcase')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {/* Quick Interactive Scenario Pills */}
          <div className="p-4 rounded-xl bg-sky-500/10 dark:bg-sky-950/30 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                <span>
                  {tr(
                    locale,
                    '快速情境體驗（一鍵載入預設 3D 展示狀態）：',
                    'Quick Interactive Scenarios (1-Click 3D State Presets):'
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {tr(
                  locale,
                  '所有情境皆支援透過網址參數（Query Params）直接保存與分享給臨床團隊。',
                  'Every scenario is backed by shareable URL query parameters.'
                )}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {quickLinks.map((q) => (
                <button
                  key={q.query}
                  type="button"
                  onClick={() => onLaunchScenario(q.scenario)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 hover:bg-sky-500 hover:text-white dark:hover:bg-sky-600 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm transition-all flex items-center gap-1"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 6 Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {features.map((feat) => {
              const Icon = ICON_MAP[feat.iconKey] || Activity;
              return (
                <div
                  key={feat.id}
                  data-testid={`showcase-card-${feat.id}`}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0f172a]/80 p-5 hover:border-sky-500/50 transition-all shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {feat.title}
                          </h3>
                          <p className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                            {feat.subtitle}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex-shrink-0">
                        {feat.badge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {feat.description}
                    </p>

                    <ul className="space-y-1.5 pt-1">
                      {feat.highlights.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      data-testid={`showcase-launch-${feat.id}`}
                      onClick={() => onLaunchScenario(feat.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{feat.ctaLabel}</span>
                    </button>

                    {feat.secondaryActions && (
                      <div className="flex items-center gap-1.5">
                        {feat.secondaryActions.map((sec) => (
                          <button
                            key={sec.id}
                            type="button"
                            data-testid={`showcase-launch-${sec.id}`}
                            onClick={() => onLaunchScenario(sec.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-medium transition-colors"
                          >
                            {sec.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* URL Deep-Link & Architecture Reference Footer */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-[#090d16] p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-sky-500" />
                <span>
                  {tr(
                    locale,
                    '網址參數與深度連結速查表 (URL Deep-Link Parameters)',
                    'URL Deep-Link Parameters Cheat Sheet'
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {tr(
                    locale,
                    '100% 靜態前端部署（GitHub Pages 相容），不向任何外部伺服器傳輸個資',
                    '100% static client-side architecture (GitHub Pages ready), zero external PHI transmission'
                  )}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-sky-600 dark:text-sky-400 font-semibold">
                  ?diff=1&diffMode=both&tab=diff
                </span>
                <p className="text-[10px] font-sans text-slate-500 mt-0.5">
                  {tr(locale, '開啟 3D 模型差異比對與偏差色溫面板', 'Enable 3D Model Diff & telemetry tab')}
                </p>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  ?occ=1&view=upper
                </span>
                <p className="text-[10px] font-sans text-slate-500 mt-0.5">
                  {tr(locale, '開啟即時 GPU 咬合接觸熱力圖並切至上顎面', 'Enable GPU Occlusogram in upper view')}
                </p>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  ?art=compound&strokes=h0.3,p0.5
                </span>
                <p className="text-[10px] font-sans text-slate-500 mt-0.5">
                  {tr(locale, '載入多行程混用模式（開合 30% + 前突 50%）', 'Compound stroke mixer preset')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
