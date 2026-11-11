import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DEFAULT_CASE_BUNDLE,
  fetchCaseManifest,
  buildCaseBundleFromFiles,
  updateCaseStlInIndexedDB,
  loadAllCasesFromIndexedDB,
  deleteCaseFromIndexedDB,
  updateStoredCaseMeshStats,
  saveLastActiveCaseId,
  getLastActiveCaseId,
  ViewportSettings,
  CameraPreset,
  DentalCaseBundle,
  MeshGeometryStats,
  ThemeMode,
  LocaleMode,
  OcclusogramStats,
  OrthoArchMetrics,
  CaliperMeasurement,
  Point3D,
  DEFAULT_ARTICULATOR_SETTINGS,
  DEFAULT_ORTHO_ARCH_METRICS,
  createCaliperMeasurement,
  LOCALE_STORAGE_KEY,
  tr,
  detectInitialLocale,
  parseUrlDataParameter,
  ParsedUrlDataParam,
} from '@dentalcad-pages/core';
import {
  Header,
  DentalViewer3D,
  CaseDossier,
  PentaGallery,
  ArticulatorPanel,
  CadToolsPanel,
  XmlInspector,
  AskAiDrawer,
  ViewerControlPayload,
} from '@dentalcad-pages/viewer';
import {
  FileText,
  Image as ImageIcon,
  Sliders,
  Code,
  Activity,
  Upload,
  Link as LinkIcon,
  Copy,
  Check,
  X,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type TabType = 'dossier' | 'articulator' | 'gallery' | 'tools' | 'xml';
type MobileLayoutMode = 'split' | '3d' | 'panel';

const FALLBACK_STATS: MeshGeometryStats = {
  upperTriangles: 0,
  lowerTriangles: 0,
  upperDimensions: { width: 0, depth: 0, height: 0 },
  lowerDimensions: { width: 0, depth: 0, height: 0 },
};

const DEFAULT_OCCLUSOGRAM_STATS: OcclusogramStats = {
  minClearanceMm: 0.08,
  meanContactClearanceMm: 0.42,
  contactAreaMm2: 38.4,
  heavyCollisionAreaMm2: 4.2,
  leftContactPercent: 49,
  rightContactPercent: 51,
  anteriorContactPercent: 24,
  posteriorContactPercent: 76,
  totalContactPoints: 142,
};

const THEME_STORAGE_KEY = 'dentalcad_theme';

export const App: React.FC = () => {
  // Theme state (Light / Dark mode)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Language / Locale state: auto-detect browser language; default to English ('en') if non-Chinese or undetectable
  const [locale, setLocale] = useState<LocaleMode>(() => detectInitialLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // ignore
    }
  }, [locale]);

  const handleToggleLocale = useCallback(() => {
    setLocale((prev) => (prev === 'zh-TW' ? 'en' : 'zh-TW'));
  }, []);

  // Case Registry state (builtin manifest + browser IndexedDB persisted cases)
  const [cases, setCases] = useState<DentalCaseBundle[]>([DEFAULT_CASE_BUNDLE]);
  const [activeCaseId, setActiveCaseId] = useState<string>(DEFAULT_CASE_BUNDLE.id);
  const [pendingUrlDataParam, setPendingUrlDataParam] = useState<ParsedUrlDataParam | null>(null);
  const [copiedUrlPath, setCopiedUrlPath] = useState<boolean>(false);
  const urlParamFileInputRef = useRef<HTMLInputElement>(null);

  // Select case and remember in localStorage
  const handleSelectCase = useCallback((caseId: string) => {
    setActiveCaseId(caseId);
    saveLastActiveCaseId(caseId);
  }, []);

  // Load both manifest.json, persisted IndexedDB cases, AND ?url= query parameter on startup
  useEffect(() => {
    Promise.all([fetchCaseManifest(), loadAllCasesFromIndexedDB()]).then(
      async ([manifest, storedCases]) => {
        const storedIds = new Set(storedCases.map((c) => c.id));
        const builtinCases = manifest.cases.filter((c) => !storedIds.has(c.id));
        const mergedCases = [...storedCases, ...builtinCases];
        setCases(mergedCases);

        const urlParams = new URLSearchParams(window.location.search);
        const requestedCase = urlParams.get('case');
        const rawUrlParam = urlParams.get('url');
        const lastSavedCaseId = getLastActiveCaseId();

        // Handle ?url="..." query parameter (e.g. ?url="/Users/.../Export_297077963.zip" or https://.../case.zip)
        if (rawUrlParam) {
          const parsedUrl = parseUrlDataParameter(rawUrlParam);

          // 1. If the inferred case ID is already persisted in browser IndexedDB, activate it immediately!
          const existingMatch = parsedUrl.inferredCaseId
            ? mergedCases.find((c) => c.id === parsedUrl.inferredCaseId)
            : undefined;
          if (existingMatch) {
            handleSelectCase(existingMatch.id);
            return;
          }

          // 2. If it is a remote HTTP/HTTPS URL (or localhost HTTP relay), attempt direct fetch + ZIP unpack
          if (parsedUrl.isRemoteHttpUrl) {
            try {
              const resp = await fetch(parsedUrl.cleanedUrlOrPath);
              if (resp.ok) {
                const blob = await resp.blob();
                const fetchedFile = new File([blob], parsedUrl.fileName, {
                  type: blob.type || 'application/octet-stream',
                });
                const imported = await buildCaseBundleFromFiles(
                  [fetchedFile],
                  DEFAULT_CASE_BUNDLE
                );
                setCases((prev) => [
                  imported,
                  ...prev.filter((c) => c.id !== imported.id),
                ]);
                handleSelectCase(imported.id);
                return;
              }
            } catch {
              // Fall through to interactive local/manual picker banner
            }
          }

          // 3. Local filesystem path (/Users/..., file://...) or blocked CORS URL:
          // Browser security sandbox blocks silent reading of local disk paths without user gesture,
          // so present a 1-click pre-targeted loader banner for that exact path/ZIP.
          setPendingUrlDataParam(parsedUrl);
        }

        if (requestedCase && mergedCases.some((c) => c.id === requestedCase)) {
          setActiveCaseId(requestedCase);
        } else if (lastSavedCaseId && mergedCases.some((c) => c.id === lastSavedCaseId)) {
          setActiveCaseId(lastSavedCaseId);
        } else if (storedCases.length > 0) {
          setActiveCaseId(storedCases[0].id);
        } else if (manifest.defaultCaseId) {
          setActiveCaseId(manifest.defaultCaseId);
        }
      }
    );
  }, [handleSelectCase]);

  const activeCase = useMemo(
    () => cases.find((c) => c.id === activeCaseId) || cases[0] || DEFAULT_CASE_BUNDLE,
    [cases, activeCaseId]
  );

  // Dynamic mesh statistics computed directly from the loaded STL geometries
  const [meshStats, setMeshStats] = useState<MeshGeometryStats>(
    activeCase.defaultMeshStats || FALLBACK_STATS
  );

  // Occlusogram & Arch Metrics
  const [occlusogramStats, setOcclusogramStats] = useState<OcclusogramStats>(
    DEFAULT_OCCLUSOGRAM_STATS
  );
  const [archMetrics, setArchMetrics] = useState<OrthoArchMetrics>(
    DEFAULT_ORTHO_ARCH_METRICS
  );
  const [caliperMeasurements, setCaliperMeasurements] = useState<CaliperMeasurement[]>([
    createCaliperMeasurement(
      'init-u3',
      '上顎尖牙間距 (U3-U3)',
      { x: -17.4, y: -6.2, z: 1.5 },
      { x: 17.4, y: -6.2, z: 1.5 }
    ),
  ]);

  useEffect(() => {
    if (activeCase.defaultMeshStats) {
      setMeshStats(activeCase.defaultMeshStats);
    }
  }, [activeCase]);

  const handleMeshStatsComputed = useCallback(
    (stats: MeshGeometryStats) => {
      setMeshStats(stats);
      if (activeCase.source === 'custom') {
        updateStoredCaseMeshStats(activeCase.id, stats);
      }
    },
    [activeCase.id, activeCase.source]
  );

  const handleAddCaliperMeasurement = useCallback((pointA: Point3D, pointB: Point3D) => {
    setCaliperMeasurements((prev) => {
      const nextIdx = prev.length + 1;
      const m = createCaliperMeasurement(
        `caliper-${Date.now()}-${nextIdx}`,
        `3D 測距 #${nextIdx}`,
        pointA,
        pointB
      );
      return [m, ...prev];
    });
  }, []);

  const handleAddPresetCaliperMeasurement = useCallback(() => {
    setCaliperMeasurements((prev) => {
      const nextIdx = prev.length + 1;
      const presets: Array<{ label: string; a: Point3D; b: Point3D }> = [
        {
          label: '大臼齒間寬 (U6-U6)',
          a: { x: -26.3, y: -28.0, z: 1.2 },
          b: { x: 26.3, y: -28.0, z: 1.2 },
        },
        {
          label: '下顎尖牙間寬 (L3-L3)',
          a: { x: -13.7, y: -5.4, z: 0.4 },
          b: { x: 13.7, y: -5.4, z: 0.4 },
        },
        {
          label: '前牙水平覆蓋 (Overjet)',
          a: { x: 0.0, y: 8.6, z: 1.2 },
          b: { x: 0.0, y: 6.0, z: 1.2 },
        },
      ];
      const pick = presets[(nextIdx - 1) % presets.length];
      const m = createCaliperMeasurement(
        `preset-${Date.now()}-${nextIdx}`,
        pick.label,
        pick.a,
        pick.b
      );
      return [m, ...prev];
    });
  }, []);

  const handleClearCaliperMeasurements = useCallback(() => {
    setCaliperMeasurements([]);
  }, []);

  // Privacy toggle (HIPAA / clinical presentation - default ON)
  const [anonymizePatient, setAnonymizePatient] = useState<boolean>(true);

  // Active right pane tab (default to Articulator & Occlusogram)
  const [activeTab, setActiveTab] = useState<TabType>('articulator');

  // Collapsible right/bottom sidebar panel state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Ask AI Assistant slide-over drawer state
  const [askAiOpen, setAskAiOpen] = useState<boolean>(false);

  // Mobile layout ratio mode ('split' | '3d' | 'panel') for small screens
  const [mobileLayoutMode, setMobileLayoutMode] = useState<MobileLayoutMode>('split');
  const mobileBundleInputRef = useRef<HTMLInputElement>(null);
  const mobileUpperInputRef = useRef<HTMLInputElement>(null);
  const mobileLowerInputRef = useRef<HTMLInputElement>(null);

  // Camera presets
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('front');

  // Viewport 3D settings (with 5-view photo texture mapping, Occlusogram & Virtual Articulator)
  const [viewportSettings, setViewportSettings] = useState<ViewportSettings>({
    showUpper: true,
    showLower: true,
    occlusionSeparation: 0,
    shadingMode: 'enamel',
    photoTextureMapped: true,
    occlusogramEnabled: false,
    occlusogramMaxRangeMm: 1.6,
    caliperToolActive: false,
    showMeasurements: true,
    archDistinction: false,
    wireframeOverlay: false,
    clippingEnabled: false,
    clippingAxis: 'z',
    clippingOffset: 0,
    autoRotate: false,
    lightingIntensity: 1.0,
    articulator: { ...DEFAULT_ARTICULATOR_SETTINGS },
  });

  // Apply live 3D viewer control commands from Ask AI or WebMCP (mcp.html via BroadcastChannel)
  const handleApplyViewerControl = useCallback((payload: ViewerControlPayload) => {
    if (payload.cameraPreset) {
      setCameraPreset(payload.cameraPreset);
    }
    setViewportSettings((prev) => ({
      ...prev,
      shadingMode: payload.shadingMode ?? prev.shadingMode,
      occlusogramEnabled:
        typeof payload.occlusogramEnabled === 'boolean'
          ? payload.occlusogramEnabled
          : prev.occlusogramEnabled,
      occlusionSeparation:
        typeof payload.occlusionSeparation === 'number'
          ? payload.occlusionSeparation
          : prev.occlusionSeparation,
      articulator: {
        ...prev.articulator,
        mode: payload.articulationMode ?? prev.articulator.mode,
        progress:
          typeof payload.articulationProgress === 'number'
            ? payload.articulationProgress
            : prev.articulator.progress,
      },
    }));
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('dentalcad_mcp_channel');
      channel.onmessage = (ev) => {
        if (ev?.data?.type === 'DENTALCAD_MCP_CONTROL' && ev.data.payload) {
          handleApplyViewerControl(ev.data.payload);
        }
      };
    } catch {
      // ignore if BroadcastChannel is unsupported in test env
    }
    return () => {
      try {
        channel?.close();
      } catch {
        // ignore
      }
    };
  }, [handleApplyViewerControl]);

  // Import an entire new case bundle (e.g. .zip or .stl + .xml + .jpg + .pdf) at runtime and persist to IndexedDB
  const handleImportCaseFiles = async (fileList: FileList) => {
    const newBundle = await buildCaseBundleFromFiles(fileList, activeCase);
    setCases((prev) => {
      const filtered = prev.filter((c) => c.id !== newBundle.id);
      return [newBundle, ...filtered];
    });
    handleSelectCase(newBundle.id);
    setPendingUrlDataParam(null);
  };

  // Replace only upper or lower STL on the current active case and persist to IndexedDB
  const handleCustomStlSelected = async (upper?: File, lower?: File) => {
    const updatedBundle = await updateCaseStlInIndexedDB(activeCase, upper, lower);
    setCases((prev) => {
      const filtered = prev.filter((c) => c.id !== updatedBundle.id);
      return [updatedBundle, ...filtered];
    });
    handleSelectCase(updatedBundle.id);
  };

  // Delete a custom case from IndexedDB
  const handleDeleteCustomCase = async (caseId: string) => {
    await deleteCaseFromIndexedDB(caseId);
    const manifest = await fetchCaseManifest();
    const storedCases = await loadAllCasesFromIndexedDB();
    const storedIds = new Set(storedCases.map((c) => c.id));
    const builtinCases = manifest.cases.filter((c) => !storedIds.has(c.id));
    const nextCases = [...storedCases, ...builtinCases];
    setCases(nextCases.length > 0 ? nextCases : [DEFAULT_CASE_BUNDLE]);

    if (activeCaseId === caseId) {
      const fallbackId = nextCases[0]?.id || DEFAULT_CASE_BUNDLE.id;
      handleSelectCase(fallbackId);
    }
  };

  return (
    <div className="flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] w-screen overflow-hidden bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 font-sans transition-colors">
      {/* Top Navigation Bar */}
      <Header
        cases={cases}
        activeCase={activeCase}
        onSelectCase={handleSelectCase}
        onImportCaseFiles={handleImportCaseFiles}
        onDeleteCustomCase={handleDeleteCustomCase}
        anonymizePatient={anonymizePatient}
        onToggleAnonymize={() => setAnonymizePatient((v) => !v)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        locale={locale}
        onToggleLocale={handleToggleLocale}
        onOpenAskAi={() => setAskAiOpen((v) => !v)}
      />

      {/* Smart ?url= Local Path / ZIP Quick Loader Banner */}
      {pendingUrlDataParam && (
        <div
          data-testid="url-param-loader-banner"
          className="bg-sky-500/10 dark:bg-sky-950/80 border-b border-sky-500/40 dark:border-sky-800/80 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs z-30 flex-shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <LinkIcon className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                <span>
                  {tr(
                    locale,
                    '偵測到網址指定載入檔案：',
                    'URL target data detected:'
                  )}
                </span>
                <code className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900 border border-sky-500/30 font-mono text-[11px] text-sky-700 dark:text-sky-300 truncate max-w-xs sm:max-w-md">
                  {pendingUrlDataParam.cleanedUrlOrPath}
                </code>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                {tr(
                  locale,
                  '瀏覽器安全沙盒限制網頁直接讀取本機路徑；請點選下方按鈕授權載入該 ZIP/STL（自動解壓並存入 IndexedDB，下次開啟相同網址即可直接秒開！）',
                  'Browser security requires 1 click to read local disk paths. Select the ZIP/STL once to unpack & cache in IndexedDB for instant loading next time.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input
              ref={urlParamFileInputRef}
              data-testid="url-param-file-input"
              type="file"
              multiple
              accept=".zip,.stl,.xml,.jpg,.jpeg,.png,.pdf,.html,application/zip,application/x-zip-compressed,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream,image/*,application/pdf,text/xml,application/xml"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleImportCaseFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              data-testid="url-param-copy-path-btn"
              onClick={() => {
                navigator.clipboard?.writeText(pendingUrlDataParam.cleanedUrlOrPath).catch(() => {});
                setCopiedUrlPath(true);
                setTimeout(() => setCopiedUrlPath(false), 2000);
              }}
              className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1 transition-colors"
              title={tr(
                locale,
                '複製完整本地路徑（於 macOS 檔案對話框按 ⌘+Shift+G 貼上即可直達）',
                'Copy full local path (press ⌘+Shift+G in macOS file dialog to paste directly)'
              )}
            >
              {copiedUrlPath ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{tr(locale, '已複製路徑', 'Path Copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-sky-500" />
                  <span>{tr(locale, '複製路徑 (⌘+Shift+G)', 'Copy Path')}</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="url-param-pick-btn"
              onClick={() => {
                navigator.clipboard?.writeText(pendingUrlDataParam.cleanedUrlOrPath).catch(() => {});
                urlParamFileInputRef.current?.click();
              }}
              className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-1 shadow-sm transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                {tr(
                  locale,
                  `選擇 ${pendingUrlDataParam.fileName} 載入`,
                  `Load ${pendingUrlDataParam.fileName}`
                )}
              </span>
            </button>

            <button
              type="button"
              data-testid="url-param-dismiss-btn"
              onClick={() => setPendingUrlDataParam(null)}
              className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white"
              title={tr(locale, '關閉提示', 'Dismiss banner')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main CAD Workspace Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left: 3D Dental CAD Viewport Canvas */}
        <section
          className={`relative overflow-hidden border-b lg:border-b-0 ${
            sidebarCollapsed ? 'lg:border-r-0 flex-1 h-full' : 'lg:border-r'
          } border-slate-200 dark:border-slate-800 lg:flex-1 lg:h-full transition-all ${
            sidebarCollapsed
              ? 'flex-1'
              : mobileLayoutMode === '3d'
              ? 'h-[66dvh]'
              : mobileLayoutMode === 'panel'
              ? 'h-[26dvh]'
              : 'h-[45dvh]'
          }`}
        >
          <DentalViewer3D
            upperStlUrl={activeCase.assets.upperStlUrl}
            lowerStlUrl={activeCase.assets.lowerStlUrl}
            photos={activeCase.photos}
            theme={theme}
            settings={viewportSettings}
            onSettingsChange={setViewportSettings}
            activePreset={cameraPreset}
            onPresetSelect={setCameraPreset}
            onMeshStatsComputed={handleMeshStatsComputed}
            onOcclusogramStatsComputed={setOcclusogramStats}
            onArchMetricsComputed={setArchMetrics}
            caliperMeasurements={caliperMeasurements}
            onAddCaliperMeasurement={handleAddCaliperMeasurement}
            onClearCaliperMeasurements={handleClearCaliperMeasurements}
            onCustomFilesDrop={handleImportCaseFiles}
            locale={locale}
          />

          {/* Floating Expand Sidebar Button when Sidebar is Collapsed */}
          {sidebarCollapsed && (
            <button
              type="button"
              data-testid="sidebar-expand-btn"
              onClick={() => setSidebarCollapsed(false)}
              title={tr(locale, '展開側欄面板', 'Expand Sidebar Panel')}
              className="absolute right-2.5 bottom-14 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 z-30 flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/95 dark:bg-slate-900/95 hover:bg-sky-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium shadow-lg backdrop-blur-md transition-all"
            >
              <PanelRightOpen className="w-4 h-4 text-sky-500" />
              <span>{tr(locale, '展開側欄', 'Expand Panel')}</span>
            </button>
          )}
        </section>

        {/* Mobile Quick Upload & Viewport Layout Bar (Dedicated Touch-Friendly Upload & Split Controls) */}
        <div
          data-testid="mobile-quick-bar"
          className="lg:hidden flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-white dark:bg-[#0b101b] border-b border-slate-200 dark:border-slate-800 flex-shrink-0 overflow-x-auto"
        >
          {/* Hidden Mobile File Inputs */}
          <input
            ref={mobileBundleInputRef}
            data-testid="mobile-bundle-file-input"
            type="file"
            multiple
            accept=".zip,.stl,.xml,.jpg,.jpeg,.png,.pdf,.html,application/zip,application/x-zip-compressed,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream,image/*,application/pdf,text/xml,application/xml"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleImportCaseFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <input
            ref={mobileUpperInputRef}
            data-testid="mobile-upper-file-input"
            type="file"
            accept=".stl,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleCustomStlSelected(e.target.files[0], undefined);
                e.target.value = '';
              }
            }}
          />
          <input
            ref={mobileLowerInputRef}
            data-testid="mobile-lower-file-input"
            type="file"
            accept=".stl,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleCustomStlSelected(undefined, e.target.files[0]);
                e.target.value = '';
              }
            }}
          />

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              data-testid="mobile-upload-bundle-btn"
              onClick={() => mobileBundleInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium shadow-sm whitespace-nowrap transition-colors"
            >
              <Upload className="w-3 h-3" />
              <span>{tr(locale, '加載', 'Load')}</span>
            </button>
            <button
              type="button"
              data-testid="mobile-upload-upper-btn"
              onClick={() => mobileUpperInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/15 dark:bg-amber-950/60 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-[11px] font-medium whitespace-nowrap transition-colors"
            >
              <Upload className="w-3 h-3" />
              <span>{tr(locale, '上顎 STL', 'Upper STL')}</span>
            </button>
            <button
              type="button"
              data-testid="mobile-upload-lower-btn"
              onClick={() => mobileLowerInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded bg-sky-500/15 dark:bg-sky-950/60 border border-sky-500/40 text-sky-800 dark:text-sky-300 text-[11px] font-medium whitespace-nowrap transition-colors"
            >
              <Upload className="w-3 h-3" />
              <span>{tr(locale, '下顎 STL', 'Lower STL')}</span>
            </button>
          </div>

          {/* Mobile Viewport Height Switcher & Sidebar Collapse Toggle */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-900 p-0.5 rounded border border-slate-200 dark:border-slate-800 flex-shrink-0">
            {(
              [
                { id: '3d', label: tr(locale, '3D 放大', '3D Max') },
                { id: 'split', label: tr(locale, '分割', 'Split') },
                { id: 'panel', label: tr(locale, '面板放大', 'Panel') },
              ] as { id: MobileLayoutMode; label: string }[]
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                data-testid={`mobile-layout-${mode.id}`}
                onClick={() => {
                  setSidebarCollapsed(false);
                  setMobileLayoutMode(mode.id);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                  !sidebarCollapsed && mobileLayoutMode === mode.id
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {mode.label}
              </button>
            ))}
            <button
              type="button"
              data-testid="mobile-sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                sidebarCollapsed
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
              title={
                sidebarCollapsed
                  ? tr(locale, '展開側欄面板', 'Expand Panel')
                  : tr(locale, '收折側欄面板', 'Collapse Panel')
              }
            >
              {sidebarCollapsed ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>{tr(locale, '展開', 'Expand')}</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>{tr(locale, '收折', 'Collapse')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Clinical Dossier, Articulator, 5-View Gallery, Tools, & XML Tabs */}
        <aside
          data-testid="right-sidebar-panel"
          className={`${
            sidebarCollapsed
              ? 'hidden'
              : 'w-full lg:w-[490px] xl:w-[550px] flex-shrink-0 flex flex-col flex-1 lg:h-full'
          } bg-slate-50 dark:bg-[#0c1220] overflow-hidden transition-all`}
        >
          {/* Tab Selection Bar */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090d16] px-2 pt-2 flex-shrink-0 gap-1 overflow-x-auto transition-colors">
            <div className="flex items-center gap-1 overflow-x-auto min-w-0">
              <button
                data-testid="tab-articulator"
                onClick={() => setActiveTab('articulator')}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'articulator'
                    ? 'border-sky-500 dark:border-sky-400 text-sky-600 dark:text-sky-300 bg-sky-500/5 dark:bg-slate-900/60 rounded-t'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>{tr(locale, '咬合模擬與熱力圖', 'Articulator & Occlusogram')}</span>
              </button>

              <button
                data-testid="tab-gallery"
                onClick={() => setActiveTab('gallery')}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'gallery'
                    ? 'border-sky-500 dark:border-sky-400 text-sky-600 dark:text-sky-300 bg-sky-500/5 dark:bg-slate-900/60 rounded-t'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{tr(locale, '五方位攝影', '5-View Photos')}</span>
              </button>

              <button
                data-testid="tab-tools"
                onClick={() => setActiveTab('tools')}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'tools'
                    ? 'border-sky-500 dark:border-sky-400 text-sky-600 dark:text-sky-300 bg-sky-500/5 dark:bg-slate-900/60 rounded-t'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{tr(locale, '材質與剖面', 'Shaders & Clipping')}</span>
              </button>

              <button
                data-testid="tab-dossier"
                onClick={() => setActiveTab('dossier')}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'dossier'
                    ? 'border-sky-500 dark:border-sky-400 text-sky-600 dark:text-sky-300 bg-sky-500/5 dark:bg-slate-900/60 rounded-t'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{tr(locale, '規格與歸檔', 'Specs & Archive')}</span>
              </button>

              <button
                data-testid="tab-xml"
                onClick={() => setActiveTab('xml')}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'xml'
                    ? 'border-sky-500 dark:border-sky-400 text-sky-600 dark:text-sky-300 bg-sky-500/5 dark:bg-slate-900/60 rounded-t'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>{tr(locale, '原始 XML', 'Raw XML')}</span>
              </button>
            </div>

            {/* Collapse Sidebar Button */}
            <button
              type="button"
              data-testid="sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed(true)}
              title={tr(locale, '收折側欄面板', 'Collapse Sidebar Panel')}
              className="flex items-center gap-1 px-2 py-1.5 mb-1 ml-1 rounded text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0 transition-colors"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tr(locale, '收折', 'Collapse')}</span>
            </button>
          </div>

          {/* Tab Content Panel (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {activeTab === 'dossier' && (
              <CaseDossier
                caseBundle={activeCase}
                meshStats={meshStats}
                anonymizePatient={anonymizePatient}
                onToggleAnonymize={() => setAnonymizePatient((v) => !v)}
                locale={locale}
              />
            )}
            {activeTab === 'articulator' && (
              <ArticulatorPanel
                settings={viewportSettings}
                onSettingsChange={setViewportSettings}
                occlusogramStats={occlusogramStats}
                archMetrics={archMetrics}
                caliperMeasurements={caliperMeasurements}
                onClearCaliperMeasurements={handleClearCaliperMeasurements}
                onAddPresetCaliperMeasurement={handleAddPresetCaliperMeasurement}
                locale={locale}
              />
            )}
            {activeTab === 'gallery' && (
              <PentaGallery
                photos={activeCase.photos}
                onSyncCameraPreset={(preset) => {
                  setCameraPreset(preset);
                }}
                photoTextureMapped={viewportSettings.photoTextureMapped}
                onTogglePhotoTexture={() =>
                  setViewportSettings((s) => ({
                    ...s,
                    photoTextureMapped: !s.photoTextureMapped,
                  }))
                }
                onImportCaseFiles={handleImportCaseFiles}
                locale={locale}
              />
            )}
            {activeTab === 'tools' && (
              <CadToolsPanel
                settings={viewportSettings}
                onSettingsChange={setViewportSettings}
                onCustomFilesSelected={handleCustomStlSelected}
                onImportCaseFiles={handleImportCaseFiles}
                cases={cases}
                activeCaseId={activeCase.id}
                onSelectCase={handleSelectCase}
                onDeleteCustomCase={handleDeleteCustomCase}
                anonymizePatient={anonymizePatient}
                locale={locale}
              />
            )}
            {activeTab === 'xml' && (
              <XmlInspector
                caseBundle={activeCase}
                anonymizePatient={anonymizePatient}
                locale={locale}
              />
            )}
          </div>
        </aside>
      </main>

      {/* Ask AI Assistant Slide-Over Drawer (ai-proxy /v1 & MCP Pages) */}
      <AskAiDrawer
        open={askAiOpen}
        onClose={() => setAskAiOpen(false)}
        locale={locale}
        activeCase={activeCase}
        archMetrics={archMetrics}
        occlusogramStats={occlusogramStats}
        viewportSettings={viewportSettings}
        cameraPreset={cameraPreset}
        onApplyViewerControl={handleApplyViewerControl}
      />
    </div>
  );
};

export default App;
