import {
  CameraPreset,
  LocaleMode,
  ViewportSettings,
} from '../types/dental';
import { DEFAULT_MODEL_DIFF_SETTINGS } from './modelDiff';
import { tr } from './i18n';

export type ShowcaseActiveTab = 'dossier' | 'gallery' | 'articulator' | 'diff' | 'editor' | 'tools' | 'xml';

export type ShowcaseScenarioId =
  | 'editor'
  | 'articulator'
  | 'occlusogram'
  | 'diff_both'
  | 'diff_heatmap'
  | 'diff_overlay'
  | 'texture'
  | 'caliper'
  | 'clipping'
  | 'ask_ai';

export type ShowcaseFeatureIconKey =
  | 'activity'
  | 'git-compare'
  | 'flame'
  | 'image'
  | 'ruler'
  | 'sparkles'
  | 'wand';

export interface ShowcaseFeatureItem {
  id: ShowcaseScenarioId;
  badge: string;
  iconKey: ShowcaseFeatureIconKey;
  accent: string;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  ctaLabel: string;
  secondaryActions?: {
    id: ShowcaseScenarioId;
    label: string;
  }[];
}

export interface ShowcaseQuickLinkItem {
  label: string;
  query: string;
  scenario: ShowcaseScenarioId;
}

export interface ShowcaseScenarioResolution {
  activeTab?: ShowcaseActiveTab;
  cameraPreset?: CameraPreset;
  settings: ViewportSettings;
  openAskAi?: boolean;
}

/**
 * Pure state-transition builder for launching any interactive showcase scenario.
 * Can be called by `App.tsx` or any custom host application consuming `@dentalcad-pages/core`.
 */
export function resolveShowcaseScenarioState(
  scenario: ShowcaseScenarioId,
  prevSettings: ViewportSettings
): ShowcaseScenarioResolution {
  const baseDiff = prevSettings.modelDiff || DEFAULT_MODEL_DIFF_SETTINGS;

  switch (scenario) {
    case 'editor':
      return {
        activeTab: 'editor',
        cameraPreset: 'isometric',
        settings: {
          ...prevSettings,
          modelDiff: { ...baseDiff, enabled: false },
          modelEdit: {
            enabled: true,
            toolMode: 'drag',
            selectedTarget: { kind: 'native', fdi: 25 },
            nativeEdits: {},
            placedTeeth: [],
            clipboard: null,
            showFdiLabels: true,
          },
        },
      };

    case 'articulator':
      return {
        activeTab: 'articulator',
        cameraPreset: 'right',
        settings: {
          ...prevSettings,
          modelDiff: { ...baseDiff, enabled: false },
          articulator: {
            ...prevSettings.articulator,
            mode: 'compound',
            strokes: { hinge: 0.28, protrusion: 0.48, lateral: 0.2, parallel: 0 },
            progress: 1.0,
            showTrajectoryGizmo: true,
          },
        },
      };

    case 'occlusogram':
      return {
        activeTab: 'articulator',
        cameraPreset: 'upper',
        settings: {
          ...prevSettings,
          occlusogramEnabled: true,
          modelDiff: { ...baseDiff, enabled: false },
          articulator: {
            ...prevSettings.articulator,
            progress: 0,
          },
        },
      };

    case 'diff_both':
    case 'diff_heatmap':
    case 'diff_overlay': {
      const displayMode =
        scenario === 'diff_heatmap'
          ? 'heatmap'
          : scenario === 'diff_overlay'
          ? 'overlay'
          : 'both';
      return {
        activeTab: 'diff',
        cameraPreset: scenario === 'diff_both' ? 'isometric' : 'front',
        settings: {
          ...prevSettings,
          occlusogramEnabled: false,
          modelDiff: {
            ...baseDiff,
            enabled: true,
            displayMode,
            compareTargetId: 'simulated:ortho_alignment',
          },
        },
      };
    }

    case 'texture':
      return {
        activeTab: 'gallery',
        cameraPreset: 'front',
        settings: {
          ...prevSettings,
          shadingMode: 'texture',
          photoTextureMapped: true,
          occlusogramEnabled: false,
          modelDiff: { ...baseDiff, enabled: false },
        },
      };

    case 'caliper':
      return {
        activeTab: 'articulator',
        cameraPreset: 'upper',
        settings: {
          ...prevSettings,
          caliperToolActive: true,
          showMeasurements: true,
          modelDiff: { ...baseDiff, enabled: false },
        },
      };

    case 'clipping':
      return {
        activeTab: 'tools',
        cameraPreset: 'isometric',
        settings: {
          ...prevSettings,
          clippingEnabled: true,
          clippingAxis: 'x',
          clippingOffset: 2.0,
          modelDiff: { ...baseDiff, enabled: false },
        },
      };

    case 'ask_ai':
      return {
        settings: prevSettings,
        openAskAi: true,
      };
  }
}

/**
 * Returns localized feature showcase cards for both in-app modals and documentation views.
 */
export function getShowcaseFeatures(locale: LocaleMode = 'en'): ShowcaseFeatureItem[] {
  return [
    {
      id: 'editor',
      badge: '3D CAD Tooth Editor',
      iconKey: 'wand',
      accent: 'violet',
      title: tr(
        locale,
        '1. 3D 齒列互動編輯器 (Tooth & Model Editor)',
        '1. 3D Model & Tooth Editor'
      ),
      subtitle: tr(
        locale,
        '28 顆 FDI 牙位自動辨識、拔牙齒槽骨平滑癒合、3D 拖曳排牙、複製貼上與牙齒庫植牙',
        'Auto 28 FDI tooth identification, tooth extraction gingival saddle, 3D dragging, copy/paste & library placement'
      ),
      description: tr(
        locale,
        '點擊 3D 齒列或 2D FDI 牙位圖譜即可直接選取任意牙齒，支援非破壞性拔牙刪除（平滑壓入齒槽脊模擬癒合牙齦鞍部）、3D 畫布直接按住拖動原生牙齒移位矯正、複製牙齒貼上、以及內建 6 種標準解剖牙冠庫（正中門齒、側門齒、犬齒、小臼齒、第一/第二大臼齒），可直接將牙冠拖放至 3D 齒列任意位置並自由調整。',
        'Click any 3D tooth or 2D FDI chart to select. Supports non-destructive tooth extraction into healed alveolar saddles, direct 3D dragging of native teeth, copy/paste, and dragging standard crowns from the 3D tooth library.'
      ),
      highlights: [
        tr(
          locale,
          '自動 28 顆 FDI 牙位分割與 3D Raycast 拾取光環與三軸指示器',
          'Automatic 28 FDI tooth segmentation & 3D selection ring/axis gizmo'
        ),
        tr(
          locale,
          '3D 視窗直接按住拖動原生牙齒，或使用 ΔX/ΔY/ΔZ、旋轉、縮放滑桿精密微調',
          'Drag native teeth directly on 3D canvas or fine-tune with ΔX/ΔY/ΔZ sliders'
        ),
        tr(
          locale,
          '標準解剖牙齒庫卡片支援 HTML5 拖曳放開（Drag-and-Drop）至 3D 牙弓',
          '3D anatomical tooth library with drag-and-drop onto the 3D dental arch'
        ),
      ],
      ctaLabel: tr(locale, '立即體驗 3D 齒列編輯', 'Launch 3D Tooth Editor'),
    },
    {
      id: 'articulator',
      badge: '6-DOF Kinematics',
      iconKey: 'activity',
      accent: 'sky',
      title: tr(
        locale,
        '2. 6-DOF 虛擬咬合器與多行程混用控制台',
        '2. 6-DOF Virtual Articulator & Compound Stroke Mixer'
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
        tr(
          locale,
          'Posselt 雙相貝茲曲線（拖曳 P1/P2 即時調整切導斜度）',
          'Interactive Posselt dual-phase Bezier curve editor (P1/P2)'
        ),
        tr(
          locale,
          '5 通道統一佈局控制台 + 3D 視窗左側垂直拉桿與回彈搖桿',
          'Unified 5-channel stroke console + vertical seekbar & spring-back joystick'
        ),
        tr(
          locale,
          '即時 3D 切端軌跡線與雙側髁頭樞軸連桿視覺化',
          'Live 3D incisal path curve & intercondylar hinge axis gizmo'
        ),
      ],
      ctaLabel: tr(locale, '立即體驗複合咬合運動', 'Launch Compound Articulator'),
    },
    {
      id: 'diff_both',
      badge: '3D Mesh Deviation',
      iconKey: 'git-compare',
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
        '透過 3D 空間體素雜湊網格（Spatial Hash Grid）快速計算基準牙弓（Scan A）與目標模型（Scan B）之有向表面距離誤差。支援「色溫圖 + 疊影」、「3D 偏差色溫圖」與「雙模型疊影」三種模式，內建前牙內收排齊、橫向擴弓、咬合磨耗三種模擬預設，亦可直接比對多筆載入案例或自訂 STL / PLY / OBJ。',
        'Computes per-vertex signed surface deviations between Reference (Scan A) and Target (Scan B) using a 3D spatial hash grid. Supports Heatmap, Ghost Overlay, and Combined modes with live RMSD & In-Tolerance % telemetry.'
      ),
      highlights: [
        tr(
          locale,
          '紅/黃（+mm 外擴突出）⟷ 綠（±公差吻合）⟷ 青/藍（-mm 內縮磨耗）',
          'Red/Yellow (+mm outward) ⟷ Green (±tolerance) ⟷ Cyan/Blue (-mm inward)'
        ),
        tr(
          locale,
          '即時計算 RMSD、平均絕對誤差、吻合公差率與上下顎獨立偏差',
          'Real-time RMSD, Mean |Δ|, In-Tolerance %, and per-arch deviation telemetry'
        ),
        tr(
          locale,
          '支援自動質心對位（Auto-Centroid ICP）與手動 ΔX/ΔY/ΔZ 微調',
          'Auto-centroid registration alignment + manual ΔX/ΔY/ΔZ fine-tuning'
        ),
      ],
      ctaLabel: tr(locale, '立即體驗 3D 差異比對', 'Launch 3D Model Diff'),
      secondaryActions: [
        {
          id: 'diff_heatmap',
          label: tr(locale, '純偏差色溫圖', 'Heatmap Mode'),
        },
        {
          id: 'diff_overlay',
          label: tr(locale, '雙模型疊影', 'Overlay Mode'),
        },
      ],
    },
    {
      id: 'occlusogram',
      badge: 'GPU GLSL Shader',
      iconKey: 'flame',
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
        tr(
          locale,
          '0.0mm 穿透碰撞（亮紅）至 1.6mm 咬合間隙（深藍）連續色階',
          'Continuous 0.0mm collision (red) to 1.6mm clearance (blue) spectrum'
        ),
        tr(
          locale,
          '可與五方位攝影貼圖、琺瑯質、石膏等任意材質同步疊加顯示',
          'Layers seamlessly over 5-View Photo Texture, Enamel, or Plaster shaders'
        ),
        tr(
          locale,
          '即時統計最小間隙、接觸面積 (mm²) 與左/右/前/後咬合分佈平衡',
          'Live minimum clearance, contact area (mm²), and L/R & A/P balance'
        ),
      ],
      ctaLabel: tr(locale, '立即體驗咬合熱力圖', 'Launch Occlusogram Heatmap'),
    },
    {
      id: 'texture',
      badge: '5-View Tri-Planar',
      iconKey: 'image',
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
        tr(
          locale,
          '五方位照片點擊即可一鍵同步 3D 攝影機視角與 Lightbox 放大檢視',
          'Click any 5-view photo to sync 3D camera preset or inspect in Lightbox'
        ),
        tr(
          locale,
          '支援 6 種臨床材質：五方位貼圖、琺瑯質、石膏、法線、線框、X-Ray 半透',
          '6 clinical shaders: 5-View Texture, Enamel, Plaster, Normals, Wireframe, X-Ray'
        ),
        tr(
          locale,
          '符合人體牙齒形態（門牙平切緣、尖銳犬齒尖、雙尖小臼齒與飽滿牙齦）',
          'Anatomical tooth morphology with smooth C2 canine-premolar transition'
        ),
      ],
      ctaLabel: tr(locale, '立即體驗五方位貼圖與相簿', 'Launch 5-View Photo Shader'),
    },
    {
      id: 'caliper',
      badge: 'Metrological CAD',
      iconKey: 'ruler',
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
        tr(
          locale,
          '支援 3D 視窗直接點選測距、一鍵帶入臨床預設測距點與顯隱切換',
          'Interactive 3D raycast picking, clinical preset markers & show/hide toggle'
        ),
        tr(
          locale,
          'X（矢狀）、Y（冠狀）、Z（水平）三軸即時動態剖面檢視內部咬合',
          'Real-time Sagittal (X), Coronal (Y), and Axial (Z) cross-section clipping'
        ),
        tr(
          locale,
          '自動計算牙弓寬深比（Arch Form Ratio）與正中線偏移量',
          'Automated arch form ratio and anterior midline deviation telemetry'
        ),
      ],
      ctaLabel: tr(locale, '立即體驗 3D 數位測距', 'Launch 3D Digital Caliper'),
      secondaryActions: [
        {
          id: 'clipping',
          label: tr(locale, '開啟 3D 剖面切層', 'Launch XYZ Clipping'),
        },
      ],
    },
    {
      id: 'ask_ai',
      badge: 'Zero-PHI & WebMCP',
      iconKey: 'sparkles',
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
        tr(
          locale,
          '預設隱藏病患、醫師與診所個資，頂部案例選單僅顯示訂單編號與術式',
          'Default PHI masking for patient, doctor, and clinic names across UI & XML'
        ),
        tr(
          locale,
          '支援網址狀態即時同步（視角、咬合行程、熱力圖、3D 比對一鍵分享）',
          'Full URL state synchronization for instant clinical view sharing'
        ),
        tr(
          locale,
          '內建 Ask AI 智慧抽屜與 WebMCP 端點，可用自然語言切換視角與模式',
          'Ask AI drawer & WebMCP endpoint for natural-language 3D viewport control'
        ),
      ],
      ctaLabel: tr(locale, '開啟 Ask AI 臨床助手', 'Open Ask AI Assistant'),
    },
  ];
}

/**
 * Returns localized quick-launch preset items for the Feature Showcase.
 */
export function getShowcaseQuickLinks(locale: LocaleMode = 'en'): ShowcaseQuickLinkItem[] {
  return [
    {
      label: tr(locale, '3D 齒列互動編輯 (辨識/拔牙/拖動/牙齒庫)', '3D Tooth Editor (Segment/Drag/Library)'),
      query: '?tab=editor&edit=1&view=isometric',
      scenario: 'editor',
    },
    {
      label: tr(locale, '預設正視咬合', 'Default Frontal View'),
      query: '?view=front&tab=articulator',
      scenario: 'articulator',
    },
    {
      label: tr(locale, '3D 模型差異比對 (色溫+疊影)', '3D Model Diff (Both)'),
      query: '?diff=1&diffMode=both&tab=diff&view=isometric',
      scenario: 'diff_both',
    },
    {
      label: tr(locale, '3D 偏差色溫圖 (正視)', '3D Diff Heatmap (Front)'),
      query: '?diff=1&diffMode=heatmap&tab=diff&view=front',
      scenario: 'diff_heatmap',
    },
    {
      label: tr(locale, '即時咬合接觸熱力圖', 'Live Occlusogram Heatmap'),
      query: '?occ=1&view=upper&tab=articulator',
      scenario: 'occlusogram',
    },
    {
      label: tr(locale, '五方位臨床貼圖相簿', '5-View Clinical Photo Gallery'),
      query: '?tex=1&tab=gallery&view=front',
      scenario: 'texture',
    },
  ];
}
