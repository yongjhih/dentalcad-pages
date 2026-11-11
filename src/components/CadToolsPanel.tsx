import React, { useRef } from 'react';
import { ViewportSettings, ShadingMode, DentalCaseBundle, LocaleMode } from '../types/dental';
import { getDisplayMetadata } from '../utils/anonymize';
import { tr } from '../utils/i18n';
import {
  Scissors,
  Palette,
  RotateCw,
  Upload,
  FolderOpen,
  Sparkles,
  Grid,
  Database,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';

interface CadToolsPanelProps {
  settings: ViewportSettings;
  onSettingsChange: (settings: ViewportSettings) => void;
  onCustomFilesSelected: (upper?: File, lower?: File) => void;
  onImportCaseFiles?: (files: FileList) => void;
  cases?: DentalCaseBundle[];
  activeCaseId?: string;
  onSelectCase?: (caseId: string) => void;
  onDeleteCustomCase?: (caseId: string) => void;
  anonymizePatient?: boolean;
  locale?: LocaleMode;
}

export const CadToolsPanel: React.FC<CadToolsPanelProps> = ({
  settings,
  onSettingsChange,
  onCustomFilesSelected,
  onImportCaseFiles,
  cases = [],
  activeCaseId,
  onSelectCase,
  onDeleteCustomCase,
  anonymizePatient = true,
  locale = 'en',
}) => {
  const upperFileInputRef = useRef<HTMLInputElement>(null);
  const lowerFileInputRef = useRef<HTMLInputElement>(null);
  const bundleInputRef = useRef<HTMLInputElement>(null);

  const customCases = cases.filter((c) => c.source === 'custom');

  const shadingModes: { id: ShadingMode; name: string; desc: string }[] = [
    {
      id: 'texture',
      name: tr(locale, '五方位臨床貼圖 (5-View Photo Texture)', '5-View Photo Texture'),
      desc: tr(
        locale,
        '將正視、上顎、下顎、左右頰面共 5 張臨床照片依據法向量權重投影貼合至 3D 齒列上。',
        'Projects and normal-blends 5 intraoral clinical photos directly onto the 3D dental arch meshes.'
      ),
    },
    {
      id: 'enamel',
      name: tr(locale, '臨床琺瑯質 (Enamel)', 'Clinical Enamel'),
      desc: tr(
        locale,
        '真實牙科光學折射 (IOR 1.55)，帶有細緻清漆與微透珠光。',
        'Physical dental enamel refraction (IOR 1.55) with clearcoat and subtle subsurface sheen.'
      ),
    },
    {
      id: 'plaster',
      name: tr(locale, '石膏模型 (Plaster)', 'Dental Stone (Plaster)'),
      desc: tr(
        locale,
        '啞光高漫射白石膏模型，適合清楚觀察齒列窩溝與形態學特徵。',
        'High-diffuse matte orthodontic stone model for inspecting occlusal grooves and cusp morphology.'
      ),
    },
    {
      id: 'normal',
      name: tr(locale, '法向量圖 (Normals)', 'Surface Normals'),
      desc: tr(
        locale,
        '以 RGB 色彩對應幾何面法線方向，利於檢視曲面平滑度與咬合斜面。',
        'Maps XYZ surface normals to RGB colors to inspect curvature smoothness and cusp inclines.'
      ),
    },
    {
      id: 'wireframe',
      name: tr(locale, '拓撲線框 (Wireframe)', 'Topology Wireframe'),
      desc: tr(
        locale,
        '顯示原始 3D 網格三角形拓撲分佈與密度 (Triangle Mesh)。',
        'Displays raw 3D triangle mesh topology and vertex density.'
      ),
    },
    {
      id: 'translucent',
      name: tr(locale, '半透明 X 光 (Translucent)', 'Translucent X-Ray'),
      desc: tr(
        locale,
        '半透明透視效果，便於分析上下牙弓內外側重疊與牙齒長軸。',
        'Semi-transparent optical shader for analyzing internal overbite/overjet overlap.'
      ),
    },
  ];

  return (
    <div className="space-y-6 text-xs text-slate-700 dark:text-slate-300">
      {/* 5-View Photo Texture Mapping Section */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          <span>
            {tr(
              locale,
              '五方攝影照片貼圖渲染 (Photo Texture Mapping)',
              '5-View Photo Texture Projection'
            )}
          </span>
        </h2>

        <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3 rounded-lg flex items-center justify-between gap-3 shadow-sm dark:shadow-none">
          <div className="space-y-0.5">
            <span className="font-medium text-slate-900 dark:text-slate-200">
              {tr(
                locale,
                '多視角正交投影貼圖 (Multi-View Projection)',
                'Multi-View Orthographic Texture Projection'
              )}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {tr(
                locale,
                '將正視、上顎、下顎、左右頰面共 5 張臨床照片依據法向量權重自動貼合渲染至 3D STL 齒列模型上。',
                'Automatically blends 5 clinical intraoral photos (frontal, upper, lower, left & right buccal) onto the 3D STL dental arches by surface normal weights.'
              )}
            </p>
          </div>
          <button
            data-testid="tools-photo-texture-btn"
            onClick={() => {
              const nextMapped = !(settings.photoTextureMapped || settings.shadingMode === 'texture');
              onSettingsChange({
                ...settings,
                photoTextureMapped: nextMapped,
                shadingMode: nextMapped
                  ? 'texture'
                  : settings.shadingMode === 'texture'
                  ? 'enamel'
                  : settings.shadingMode,
              });
            }}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border flex-shrink-0 ${
              settings.photoTextureMapped || settings.shadingMode === 'texture'
                ? 'bg-sky-500 border-sky-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {settings.photoTextureMapped || settings.shadingMode === 'texture'
              ? tr(locale, '已開啟貼圖', 'Texture ON')
              : tr(locale, '開啟貼圖', 'Enable Texture')}
          </button>
        </div>
      </div>

      {/* Dental Shading Modes */}
      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Palette className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          <span>{tr(locale, '幾何材質與光學渲染 (Shaders)', 'Surface Shaders & Optical Materials')}</span>
        </h2>
        <div className="space-y-2">
          {shadingModes.map((mode) => {
            const isSelected =
              mode.id === 'texture'
                ? settings.shadingMode === 'texture' || settings.photoTextureMapped
                : settings.shadingMode === mode.id && !settings.photoTextureMapped;
            return (
              <label
                key={mode.id}
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    photoTextureMapped: mode.id === 'texture',
                    shadingMode: mode.id,
                  })
                }
                className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-sky-500/10 dark:bg-sky-950/40 border-sky-500/60 text-slate-900 dark:text-slate-200'
                    : 'bg-white dark:bg-[#0b0f17] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="shadingMode"
                  checked={isSelected}
                  onChange={() =>
                    onSettingsChange({
                      ...settings,
                      photoTextureMapped: mode.id === 'texture',
                      shadingMode: mode.id,
                    })
                  }
                  className="mt-0.5 accent-sky-500"
                />
                <div className="space-y-0.5">
                  <p className="font-medium text-slate-900 dark:text-slate-200">{mode.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {mode.desc}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Arch Color Distinction Toggle */}
        <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3 rounded-lg flex items-center justify-between shadow-sm dark:shadow-none">
          <div className="space-y-0.5">
            <span className="font-medium text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              {tr(locale, '上下顎色彩區隔 (Arch Distinction)', 'Maxilla / Mandible Color Distinction')}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {tr(
                locale,
                '分別賦予上顎溫潤白與下顎微冷白色調，利於辨別咬合接觸邊界。',
                'Applies distinct warm/cool tints to upper and lower arches to clarify occlusal boundaries.'
              )}
            </p>
          </div>
          <button
            onClick={() =>
              onSettingsChange({
                ...settings,
                archDistinction: !settings.archDistinction,
              })
            }
            className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
              settings.archDistinction
                ? 'bg-sky-600 border-sky-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            {settings.archDistinction
              ? tr(locale, '已啟用', 'Enabled')
              : tr(locale, '停用', 'Disabled')}
          </button>
        </div>

        {/* Wireframe Overlay Checkbox */}
        <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3 rounded-lg flex items-center justify-between shadow-sm dark:shadow-none">
          <div className="space-y-0.5">
            <span className="font-medium text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              {tr(locale, '疊加三角形網格線 (Wireframe Overlay)', 'Triangle Wireframe Overlay')}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {tr(
                locale,
                '在現有材質或照片貼圖表面顯示三角網格拓撲結構。',
                'Overlays triangle mesh edges on top of the active shader or photo texture.'
              )}
            </p>
          </div>
          <button
            onClick={() =>
              onSettingsChange({
                ...settings,
                wireframeOverlay: !settings.wireframeOverlay,
              })
            }
            className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
              settings.wireframeOverlay
                ? 'bg-sky-600 border-sky-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            {settings.wireframeOverlay
              ? tr(locale, '已啟用', 'Enabled')
              : tr(locale, '停用', 'Disabled')}
          </button>
        </div>
      </div>

      {/* Cross-Section Clipping */}
      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Scissors className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          <span>{tr(locale, '剖面剖切分析 (Cross-Section Clipping)', 'Cross-Section Clipping Plane')}</span>
        </h2>
        <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3 rounded-lg space-y-3 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-900 dark:text-slate-200">
              {tr(locale, '剖切面狀態', 'Clipping Plane')}
            </span>
            <button
              data-testid="tools-clipping-toggle-btn"
              onClick={() =>
                onSettingsChange({
                  ...settings,
                  clippingEnabled: !settings.clippingEnabled,
                })
              }
              className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
                settings.clippingEnabled
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {settings.clippingEnabled
                ? tr(locale, '剖切中', 'Active')
                : tr(locale, '未開啟', 'Off')}
            </button>
          </div>

          {settings.clippingEnabled && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/60">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {tr(locale, '剖切軸向', 'Clipping Axis')}
                </span>
                <div className="flex gap-1">
                  {(['z', 'y', 'x'] as const).map((axis) => (
                    <button
                      key={axis}
                      onClick={() => onSettingsChange({ ...settings, clippingAxis: axis })}
                      className={`px-2.5 py-1 rounded text-xs font-mono ${
                        settings.clippingAxis === axis
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {axis === 'z'
                        ? tr(locale, '水平 (Z 軸)', 'Axial (Z)')
                        : axis === 'y'
                        ? tr(locale, '冠狀 (Y 軸)', 'Coronal (Y)')
                        : tr(locale, '矢狀 (X 軸)', 'Sagittal (X)')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                  <span>{tr(locale, '剖面切面深度', 'Clipping Offset')}</span>
                  <span className="font-mono text-sky-600 dark:text-sky-400 tabular-nums">
                    {settings.clippingOffset} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="0.5"
                  value={settings.clippingOffset}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      clippingOffset: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Auto-Rotation */}
      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
        <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 p-3 rounded-lg flex items-center justify-between shadow-sm dark:shadow-none">
          <div className="space-y-0.5">
            <span className="font-medium text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              {tr(locale, '自動展示旋轉 (Auto-Spin)', 'Auto-Rotate Turntable')}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {tr(locale, '啟用緩慢旋轉展示齒列全景。', 'Slowly rotates the 3D dental model around the vertical axis.')}
            </p>
          </div>
          <button
            onClick={() =>
              onSettingsChange({
                ...settings,
                autoRotate: !settings.autoRotate,
              })
            }
            className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
              settings.autoRotate
                ? 'bg-sky-600 border-sky-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            {settings.autoRotate
              ? tr(locale, '旋轉中', 'Spinning')
              : tr(locale, '靜止', 'Paused')}
          </button>
        </div>
      </div>

      {/* External Data Load & Saved Cases */}
      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{tr(locale, '加載案例檔案', 'Load Case Files')}</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
          {tr(
            locale,
            '加載的案例檔案（.zip、.xml、.stl、.jpg、.pdf）會自動保存在瀏覽器中，關閉或重新整理網頁後依然完整保留，隨時可切換檢視。',
            'Loaded case files (.zip, .xml, .stl, .jpg, .pdf) are automatically saved in your browser so you can switch or reload anytime.'
          )}
        </p>

        {onImportCaseFiles && (
          <div>
            <input
              type="file"
              ref={bundleInputRef}
              multiple
              accept=".zip,.stl,.xml,.jpg,.jpeg,.png,.pdf,.html,application/zip,application/x-zip-compressed,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream,image/*,application/pdf,text/xml,application/xml"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onImportCaseFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              data-testid="tools-load-bundle-btn"
              onClick={() => bundleInputRef.current?.click()}
              className="w-full py-2 px-3 rounded-lg bg-sky-500/15 dark:bg-sky-950/60 hover:bg-sky-500/25 dark:hover:bg-sky-900/70 border border-sky-500/40 dark:border-sky-800/70 text-sky-800 dark:text-sky-200 flex items-center justify-center gap-1.5 transition-colors font-medium"
            >
              <FolderOpen className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>
                {tr(
                  locale,
                  '加載案例檔案 (.zip / .xml / .stl / .jpg)',
                  'Load Case Files (.zip / .xml / .stl / .jpg)'
                )}
              </span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <input
              type="file"
              ref={upperFileInputRef}
              accept=".stl,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onCustomFilesSelected(e.target.files[0], undefined);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              data-testid="tools-load-upper-btn"
              onClick={() => upperFileInputRef.current?.click()}
              className="w-full py-2 px-3 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm dark:shadow-none"
            >
              <Upload className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>{tr(locale, '加載上顎 STL', 'Load Upper STL')}</span>
            </button>
          </div>

          <div>
            <input
              type="file"
              ref={lowerFileInputRef}
              accept=".stl,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onCustomFilesSelected(undefined, e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              data-testid="tools-load-lower-btn"
              onClick={() => lowerFileInputRef.current?.click()}
              className="w-full py-2 px-3 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm dark:shadow-none"
            >
              <Upload className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              <span>{tr(locale, '加載下顎 STL', 'Load Lower STL')}</span>
            </button>
          </div>
        </div>

        {/* Saved Cases List */}
        {customCases.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <Database className="w-3 h-3" />
              {tr(locale, '已儲存案例', 'Saved Cases')} ({customCases.length})
            </span>
            <div className="space-y-1.5">
              {customCases.map((c) => {
                const cMeta = getDisplayMetadata(c.metadata, anonymizePatient);
                return (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between p-2 rounded border ${
                      c.id === activeCaseId
                        ? 'bg-emerald-500/15 dark:bg-emerald-950/30 border-emerald-500/50 dark:border-emerald-700/60 text-slate-900 dark:text-slate-100'
                        : 'bg-white dark:bg-[#0b0f17] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectCase && onSelectCase(c.id)}
                      className="flex-1 text-left truncate font-mono text-[11px] hover:text-sky-600 dark:hover:text-sky-300 transition-colors"
                    >
                      #{cMeta.orderId} — {cMeta.patientName} ({cMeta.doctorName})
                    </button>
                    {onDeleteCustomCase && (
                      <button
                        type="button"
                        onClick={() => onDeleteCustomCase(c.id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-red-600 dark:text-red-400 hover:bg-red-500/15 transition-colors ml-2 whitespace-nowrap"
                        title={tr(locale, '清除此案例存檔', 'Clear saved case')}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{tr(locale, '清除存檔', 'Clear Saved')}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
