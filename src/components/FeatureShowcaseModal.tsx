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
} from 'lucide-react';
import { LocaleMode } from '../types/dental';
import { tr } from '../utils/i18n';

export type ShowcaseScenarioId =
  | 'articulator'
  | 'occlusogram'
  | 'diff_both'
  | 'diff_heatmap'
  | 'diff_overlay'
  | 'texture'
  | 'caliper'
  | 'clipping'
  | 'ask_ai';

interface FeatureShowcaseModalProps {
  open: boolean;
  onClose: () => void;
  onLaunchScenario: (scenario: ShowcaseScenarioId) => void;
  locale?: LocaleMode;
}

export const FeatureShowcaseModal: React.FC<FeatureShowcaseModalProps> = ({
  open,
  onClose,
  onLaunchScenario,
  locale = 'en',
}) => {
  if (!open) return null;

  const features = [
    {
      id: 'articulator' as ShowcaseScenarioId,
      badge: '6-DOF Kinematics',
      icon: Activity,
      accent: 'sky',
      title: tr(
        locale,
        '1. 6-DOF 虛擬咬合器與多行程混用控制台',
        '1. 6-DOF Virtual Articulator & Compound Stroke Mixer'
      ),
      subtitle: tr(
        locale,
        '生理雙相 Posselt 軌跡、蘑菇頭回彈搖桿與 5 軸向獨立行程疊加',
        'Anatomical Posselt envelope, spring-back thumbstick & 5-axis stroke mixer'
      ),
      description: tr(
        locale,
        '模擬真實顳顎關節（TMJ）髁頭樞軸旋轉與前突／側方 Bennett 滑移。支援單一運動模式與「複合混用行程（Compound Mixer）」，可同時獨立微調開合、前突、左側方、右側方與垂直平行開離，並即時繪製 3D 切端運動軌跡與雙髁連軸線。',
        'Simulates anatomical TMJ condylar hinge rotation and protrusive/lateral Bennett translation. Supports single excursion modes and a 5-channel Compound Stroke Mixer with real-time 3D incisal trajectory gizmos.'
      ),
      highlights: [
        tr(locale, 'Posselt 雙相貝茲曲線（拖曳 P1/P2 即時調整切導斜度）', 'Interactive Posselt dual-phase Bezier curve editor (P1/P2)'),
        tr(locale, '5 通道統一佈局控制台 + 3D 視窗左側垂直拉桿與回彈搖桿', 'Unified 5-channel stroke console + vertical seekbar & spring-back joystick'),
        tr(locale, '即時 3D 切端軌跡線與雙側髁頭樞軸連桿視覺化', 'Live 3D incisal path curve & intercondylar hinge axis gizmo'),
      ],
      ctaLabel: tr(locale, '立即體驗複合咬合運動', 'Launch Compound Articulator'),
    },
    {
      id: 'diff_both' as ShowcaseScenarioId,
      badge: '3D Mesh Deviation',
      icon: GitCompare,
      accent: 'cyan',
      title: tr(
        locale,
        '2. 3D 數位模型差異比對 (3D Model Diff)',
        '2. 3D Model Diff (Signed Deviation & Superimposition)'
      ),
      subtitle: tr(
        locale,
        '逐頂點有向表面偏差色溫圖（RMSD）+ 半透明雙網格疊影比對',
        'Per-vertex signed distance heatmap (RMSD) + translucent ghost mesh overlay'
      ),
      description: tr(
        locale,
        '透過 3D 空間體素雜湊網格（Spatial Hash Grid）快速計算基準牙弓（Scan A）與目標模型（Scan B）之有向表面距離誤差。支援「色溫圖 + 疊影」、「3D 偏差色溫圖」與「雙模型疊影」三種模式，內建前牙內收排齊、橫向擴弓、咬合磨耗三種模擬預設，亦可直接比對多筆載入案例或自訂 STL。',
        'Computes per-vertex signed surface deviations between Reference (Scan A) and Target (Scan B) using a 3D spatial hash grid. Supports Heatmap, Ghost Overlay, and Combined modes with live RMSD & In-Tolerance % telemetry.'
      ),
      highlights: [
        tr(locale, '紅/黃（+mm 外擴突出）⟷ 綠（±公差吻合）⟷ 青/藍（-mm 內縮磨耗）', 'Red/Yellow (+mm outward) ⟷ Green (±tolerance) ⟷ Cyan/Blue (-mm inward)'),
        tr(locale, '即時計算 RMSD、平均絕對誤差、吻合公差率與上下顎獨立偏差', 'Real-time RMSD, Mean |Δ|, In-Tolerance %, and per-arch deviation telemetry'),
        tr(locale, '支援自動質心對位（Auto-Centroid ICP）與手動 ΔX/ΔY/ΔZ 微調', 'Auto-centroid registration alignment + manual ΔX/ΔY/ΔZ fine-tuning'),
      ],
      ctaLabel: tr(locale, '立即體驗 3D 差異比對', 'Launch 3D Model Diff'),
      secondaryActions: [
        {
          id: 'diff_heatmap' as ShowcaseScenarioId,
          label: tr(locale, '純偏差色溫圖', 'Heatmap Mode'),
        },
        {
          id: 'diff_overlay' as ShowcaseScenarioId,
          label: tr(locale, '雙模型疊影', 'Overlay Mode'),
        },
      ],
    },
    {
      id: 'occlusogram' as ShowcaseScenarioId,
      badge: 'GPU GLSL Shader',
      icon: Flame,
      accent: 'rose',
      title: tr(
        locale,
        '3. 即時 GPU 咬合接觸熱力圖 (Occlusogram)',
        '3. Real-Time GPU Occlusogram Bite Contact Heatmap'
      ),
      subtitle: tr(
        locale,
        '隨下顎 6-DOF 運動即時重算對咬間隙與重度早接觸碰撞區',
        'Dynamic occlusal clearance & premature contact collision mapping'
      ),
      description: tr(
        locale,
        '建立上下顎 96×96 高程資料紋理（Elevation DataTextures），由自訂 GLSL Fragment Shader 於每個像素即時投射對咬面距離，直接疊加於五方位臨床貼圖、琺瑯質或石膏材質之上，並同步統計左右側與前後牙接觸面積百分比。',
        'Projects opposing arch elevation DataTextures in a custom GLSL shader to render real-time occlusal clearance (0.0mm red collision to 1.6mm blue clearance) directly over active materials.'
      ),
      highlights: [
        tr(locale, '0.0mm 穿透碰撞（亮紅）至 1.6mm 咬合間隙（深藍）連續色階', 'Continuous 0.0mm collision (red) to 1.6mm clearance (blue) spectrum'),
        tr(locale, '可與五方位攝影貼圖、琺瑯質、石膏等任意材質同步疊加顯示', 'Layers seamlessly over 5-View Photo Texture, Enamel, or Plaster shaders'),
        tr(locale, '即時統計最小間隙、接觸面積 (mm²) 與左/右/前/後咬合分佈平衡', 'Live minimum clearance, contact area (mm²), and L/R & A/P balance'),
      ],
      ctaLabel: tr(locale, '立即體驗咬合熱力圖', 'Launch Occlusogram Heatmap'),
    },
    {
      id: 'texture' as ShowcaseScenarioId,
      badge: '5-View Tri-Planar',
      icon: ImageIcon,
      accent: 'amber',
      title: tr(
        locale,
        '4. 五方位臨床攝影貼圖投射與自然牙齦形態',
        '4. 5-View Clinical Photo Texture Shader & Anatomical Arch'
      ),
      subtitle: tr(
        locale,
        '法向量權重多視角混合著色器 + 扇貝狀齒間乳頭高解析程序化模型',
        'Normal-weighted 5-view projection shader + scalloped anatomical gingiva'
      ),
      description: tr(
        locale,
        '將正視、上顎咬合、下顎咬合、右側頰、左側頰五張口內臨床照片透過 GLSL 法向量權重無縫投射至 3D 齒列網格；內建高解析度程序化人體牙弓（平滑連續犬齒—小臼齒過渡、尖起齒間乳頭與自然釉質光澤）。',
        'Projects Frontal, Upper, Lower, Right, and Left intraoral photographs onto 3D meshes via normal-weighted GLSL blending, paired with a high-resolution anatomical arch.'
      ),
      highlights: [
        tr(locale, '五方位照片點擊即可一鍵同步 3D 攝影機視角與 Lightbox 放大檢視', 'Click any 5-view photo to sync 3D camera preset or inspect in Lightbox'),
        tr(locale, '支援 6 種臨床材質：五方位貼圖、琺瑯質、石膏、法線、線框、X-Ray 半透', '6 clinical shaders: 5-View Texture, Enamel, Plaster, Normals, Wireframe, X-Ray'),
        tr(locale, '符合人體牙齒形態（門牙平切緣、尖銳犬齒尖、雙尖小臼齒與飽滿牙齦）', 'Anatomical tooth morphology with smooth C2 canine-premolar transition'),
      ],
      ctaLabel: tr(locale, '立即體驗五方位貼圖與相簿', 'Launch 5-View Photo Shader'),
    },
    {
      id: 'caliper' as ShowcaseScenarioId,
      badge: 'Metrological CAD',
      icon: Ruler,
      accent: 'emerald',
      title: tr(
        locale,
        '5. 3D 數位游標尺測距與動態剖面分析',
        '5. 3D Digital Caliper & Cross-Section Clipping Planes'
      ),
      subtitle: tr(
        locale,
        '3D 射線點選雙點直線測距 + 自動牙弓診斷指標 + X/Y/Z 剖面切層',
        'Raycast point-to-point 3D caliper + automated arch metrics + XYZ clipping'
      ),
      description: tr(
        locale,
        '開啟 3D 測距工具即可於齒列模型任意點選兩點，即時計算歐氏直線距離與 ΔX/ΔY/ΔZ 分量；自動分析上下顎尖牙間寬（U3-U3 / L3-L3）、大臼齒間寬（U6-U6 / L6-L6）、Overjet 與 Overbite，並支援 X/Y/Z 三軸動態剖面。',
        'Click any two points on the 3D mesh for exact Euclidean and ΔX/ΔY/ΔZ distances. Automatically computes U3-U3, U6-U6, Overjet, Overbite, and supports interactive XYZ clipping planes.'
      ),
      highlights: [
        tr(locale, '支援 3D 視窗直接點選測距、一鍵帶入臨床預設測距點與顯隱切換', 'Interactive 3D raycast picking, clinical preset markers & show/hide toggle'),
        tr(locale, 'X（矢狀）、Y（冠狀）、Z（水平）三軸即時動態剖面檢視內部咬合', 'Real-time Sagittal (X), Coronal (Y), and Axial (Z) cross-section clipping'),
        tr(locale, '自動計算牙弓寬深比（Arch Form Ratio）與正中線偏移量', 'Automated arch form ratio and anterior midline deviation telemetry'),
      ],
      ctaLabel: tr(locale, '立即體驗 3D 數位測距', 'Launch 3D Digital Caliper'),
      secondaryActions: [
        {
          id: 'clipping' as ShowcaseScenarioId,
          label: tr(locale, '開啟 3D 剖面切層', 'Launch XYZ Clipping'),
        },
      ],
    },
    {
      id: 'ask_ai' as ShowcaseScenarioId,
      badge: 'Zero-PHI & WebMCP',
      icon: Sparkles,
      accent: 'purple',
      title: tr(
        locale,
        '6. 零個資瀏覽器沙盒、ZIP 直讀與 WebMCP AI 助手',
        '6. Zero-PHI Browser Sandbox, ZIP Loader & WebMCP AI'
      ),
      subtitle: tr(
        locale,
        '100% 本地端解壓縮與 IndexedDB 持久化 + Ask AI 雙向操控 3D 視窗',
        '100% client-side ZIP extraction & IndexedDB cache + Ask AI 3D control'
      ),
      description: tr(
        locale,
        '支援直接拖曳單一或多筆口掃 `.zip` 壓縮檔（自動去重並解析 `.stl`、`.xml`、`.jpg`、`.pdf`）或透過 `?url=` 參數載入。所有醫療資料 100% 留存於瀏覽器本地沙盒，預設啟用 HIPAA 病患與醫療機構去識別化遮罩，並內建 Ask AI 助手與 WebMCP (`mcp.html`) 工具端點。',
        'Drag-and-drop single or multiple `.zip` scanner archives with automatic deduplication and IndexedDB persistence. Default HIPAA/GDPR anonymization plus Ask AI & WebMCP (`mcp.html`) integration.'
      ),
      highlights: [
        tr(locale, '預設隱藏病患、醫師與診所個資，頂部案例選單僅顯示訂單編號與術式', 'Default PHI masking for patient, doctor, and clinic names across UI & XML'),
        tr(locale, '支援網址狀態即時同步（視角、咬合行程、熱力圖、3D 比對一鍵分享）', 'Full URL state synchronization for instant clinical view sharing'),
        tr(locale, '內建 Ask AI 智慧抽屜與 WebMCP 端點，可用自然語言切換視角與模式', 'Ask AI drawer & WebMCP endpoint for natural-language 3D viewport control'),
      ],
      ctaLabel: tr(locale, '開啟 Ask AI 臨床助手', 'Open Ask AI Assistant'),
    },
  ];

  const quickLinks = [
    {
      label: tr(locale, '預設正視咬合', 'Default Frontal View'),
      query: '?view=front&tab=articulator',
      scenario: 'articulator' as ShowcaseScenarioId,
    },
    {
      label: tr(locale, '3D 模型差異比對 (色溫+疊影)', '3D Model Diff (Both)'),
      query: '?diff=1&diffMode=both&tab=diff&view=isometric',
      scenario: 'diff_both' as ShowcaseScenarioId,
    },
    {
      label: tr(locale, '3D 偏差色溫圖 (正視)', '3D Diff Heatmap (Front)'),
      query: '?diff=1&diffMode=heatmap&tab=diff&view=front',
      scenario: 'diff_heatmap' as ShowcaseScenarioId,
    },
    {
      label: tr(locale, '即時咬合接觸熱力圖', 'Live Occlusogram Heatmap'),
      query: '?occ=1&view=upper&tab=articulator',
      scenario: 'occlusogram' as ShowcaseScenarioId,
    },
    {
      label: tr(locale, '五方位臨床貼圖相簿', '5-View Clinical Photo Gallery'),
      query: '?tex=1&tab=gallery&view=front',
      scenario: 'texture' as ShowcaseScenarioId,
    },
  ];

  return (
    <div
      data-testid="feature-showcase-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="showcase-modal-title"
    >
      <div className="relative w-full max-w-6xl max-h-[92dvh] flex flex-col rounded-2xl bg-white dark:bg-[#0b111e] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-7 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#090d16]/90 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center text-white font-mono text-xs font-bold shadow-md flex-shrink-0">
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
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
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
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-500/10 via-cyan-500/10 to-emerald-500/10 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              const Icon = feat.icon;
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
