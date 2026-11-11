import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from '@dentalcad-pages/core';
import {
  Header,
  DentalViewer3D,
  CaseDossier,
  PentaGallery,
  ArticulatorPanel,
  CadToolsPanel,
  XmlInspector,
} from '@dentalcad-pages/viewer';
import {
  FileText,
  Image as ImageIcon,
  Sliders,
  Code,
  Activity,
} from 'lucide-react';

type TabType = 'dossier' | 'articulator' | 'gallery' | 'tools' | 'xml';

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

const THEME_STORAGE_KEY = 'orthocad_theme';

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

  // Language / Locale state (Traditional Chinese 'zh-TW' & English 'en')
  const [locale, setLocale] = useState<LocaleMode>(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === 'en' || saved === 'zh-TW') return saved;
    } catch {
      // ignore
    }
    return 'zh-TW';
  });

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

  // Load both manifest.json AND persisted IndexedDB cases on startup
  useEffect(() => {
    Promise.all([fetchCaseManifest(), loadAllCasesFromIndexedDB()]).then(
      ([manifest, storedCases]) => {
        const storedIds = new Set(storedCases.map((c) => c.id));
        const builtinCases = manifest.cases.filter((c) => !storedIds.has(c.id));
        const mergedCases = [...storedCases, ...builtinCases];
        setCases(mergedCases);

        const urlParams = new URLSearchParams(window.location.search);
        const requestedCase = urlParams.get('case');
        const lastSavedCaseId = getLastActiveCaseId();

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
  }, []);

  // Select case and remember in localStorage
  const handleSelectCase = useCallback((caseId: string) => {
    setActiveCaseId(caseId);
    saveLastActiveCaseId(caseId);
  }, []);

  const activeCase = useMemo(
    () => cases.find((c) => c.id === activeCaseId) || cases[0] || DEFAULT_CASE_BUNDLE,
    [cases, activeCaseId]
  );

  // Dynamic mesh statistics computed directly from the loaded STL geometries
  const [meshStats, setMeshStats] = useState<MeshGeometryStats>(
    activeCase.defaultMeshStats || FALLBACK_STATS
  );

  // iTero Occlusogram & OrthoCAD Arch Metrics
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

  // Camera presets
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('front');

  // Viewport 3D settings (with 5-view photo texture mapping, iTero Occlusogram & Virtual Articulator)
  const [viewportSettings, setViewportSettings] = useState<ViewportSettings>({
    showUpper: true,
    showLower: true,
    occlusionSeparation: 0,
    shadingMode: 'enamel',
    photoTextureMapped: true,
    occlusogramEnabled: false,
    occlusogramMaxRangeMm: 1.6,
    caliperToolActive: false,
    archDistinction: false,
    wireframeOverlay: false,
    clippingEnabled: false,
    clippingAxis: 'z',
    clippingOffset: 0,
    autoRotate: false,
    lightingIntensity: 1.0,
    articulator: { ...DEFAULT_ARTICULATOR_SETTINGS },
  });

  // Import an entire new case bundle (e.g. .stl + .xml + .jpg + .pdf) at runtime and persist to IndexedDB
  const handleImportCaseFiles = async (fileList: FileList) => {
    const newBundle = await buildCaseBundleFromFiles(fileList, activeCase);
    setCases((prev) => {
      const filtered = prev.filter((c) => c.id !== newBundle.id);
      return [newBundle, ...filtered];
    });
    handleSelectCase(newBundle.id);
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 font-sans transition-colors">
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
      />

      {/* Main CAD Workspace Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left: 3D Dental CAD Viewport Canvas */}
        <section className="flex-1 relative h-[50vh] lg:h-full overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
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
        </section>

        {/* Right: Clinical Dossier, Articulator/OrthoCAD, 5-View Gallery, Tools, & XML Tabs */}
        <aside className="w-full lg:w-[490px] xl:w-[550px] flex-shrink-0 flex flex-col h-[50vh] lg:h-full bg-slate-50 dark:bg-[#0c1220] overflow-hidden transition-colors">
          {/* Tab Selection Bar */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090d16] px-2 pt-2 flex-shrink-0 gap-1 overflow-x-auto transition-colors">
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
    </div>
  );
};

export default App;
