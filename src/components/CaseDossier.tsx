import React from 'react';
import { DentalCaseBundle, MeshGeometryStats, LocaleMode } from '../types/dental';
import { getDisplayMetadata } from '../utils/anonymize';
import { tr } from '../utils/i18n';
import {
  User,
  Stethoscope,
  Building2,
  FileCode,
  Download,
  ExternalLink,
  Box,
  Shield,
  ShieldAlert,
} from 'lucide-react';

interface CaseDossierProps {
  caseBundle: DentalCaseBundle;
  meshStats: MeshGeometryStats;
  anonymizePatient: boolean;
  onToggleAnonymize?: () => void;
  locale?: LocaleMode;
}

export const CaseDossier: React.FC<CaseDossierProps> = ({
  caseBundle,
  meshStats,
  anonymizePatient,
  onToggleAnonymize,
  locale = 'zh-TW',
}) => {
  const { assets } = caseBundle;
  const metadata = getDisplayMetadata(caseBundle.metadata, anonymizePatient);

  return (
    <div className="space-y-6 text-sm text-slate-700 dark:text-slate-300">
      {/* 1. Primary 3D Mesh Geometry & Dimensions Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {tr(locale, '3D 齒列網格與掃描技術規格', '3D Dental Mesh & Scanner Specifications')}
          </h2>
          <span className="text-xs font-mono font-normal text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 dark:bg-emerald-950/60 border border-emerald-500/40 dark:border-emerald-800/60 px-2 py-0.5 rounded">
            {caseBundle.source === 'custom'
              ? tr(locale, 'IndexedDB 案例', 'IndexedDB Case')
              : tr(locale, '數位印模完成', 'Sandbox Ready')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f17] p-3 rounded-lg space-y-2 shadow-sm dark:shadow-none">
            <div className="flex justify-between items-center">
              <span className="font-medium text-amber-700 dark:text-amber-200 flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                上顎牙弓 (Maxilla)
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {meshStats.upperTriangles.toLocaleString()} Δ
              </span>
            </div>
            <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 tabular-nums">
              <p>寬 (W): {meshStats.upperDimensions.width} mm</p>
              <p>深 (D): {meshStats.upperDimensions.depth} mm</p>
              <p>高 (H): {meshStats.upperDimensions.height} mm</p>
            </div>
            <a
              href={assets.upperStlUrl}
              download={assets.upperStlFileName}
              className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-slate-800 transition-colors w-full justify-center truncate"
              title={assets.upperStlFileName}
            >
              <Download className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">下載上顎 STL</span>
            </a>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f17] p-3 rounded-lg space-y-2 shadow-sm dark:shadow-none">
            <div className="flex justify-between items-center">
              <span className="font-medium text-sky-700 dark:text-sky-200 flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                下顎牙弓 (Mandible)
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {meshStats.lowerTriangles.toLocaleString()} Δ
              </span>
            </div>
            <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 tabular-nums">
              <p>寬 (W): {meshStats.lowerDimensions.width} mm</p>
              <p>深 (D): {meshStats.lowerDimensions.depth} mm</p>
              <p>高 (H): {meshStats.lowerDimensions.height} mm</p>
            </div>
            <a
              href={assets.lowerStlUrl}
              download={assets.lowerStlFileName}
              className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-slate-800 transition-colors w-full justify-center truncate"
              title={assets.lowerStlFileName}
            >
              <Download className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">下載下顎 STL</span>
            </a>
          </div>
        </div>
      </div>

      {/* 2. Orthodontic Technical Specifications */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs shadow-sm dark:shadow-none">
        <div className="bg-slate-100 dark:bg-slate-900/80 px-3 py-2 border-b border-slate-200 dark:border-slate-800 font-medium text-slate-800 dark:text-slate-200">
          齒科數位規格 (Orthodontic Specifications)
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-[#0b0f17]">
          <div className="grid grid-cols-3 p-2.5">
            <span className="text-slate-500">訂單編號</span>
            <span className="col-span-2 text-slate-800 dark:text-slate-200 font-mono tabular-nums">
              #{metadata.orderId} ({metadata.orderCode})
            </span>
          </div>
          <div className="grid grid-cols-3 p-2.5">
            <span className="text-slate-500">處方項目</span>
            <span className="col-span-2 text-slate-800 dark:text-slate-200 font-medium">
              {metadata.procedure} ({metadata.procedureType})
            </span>
          </div>
          <div className="grid grid-cols-3 p-2.5">
            <span className="text-slate-500">掃描牙弓範圍</span>
            <div className="col-span-2 space-y-0.5">
              <p className="text-slate-800 dark:text-slate-200">{metadata.upperAdaRange}</p>
              <p className="text-slate-800 dark:text-slate-200">{metadata.lowerAdaRange}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 p-2.5">
            <span className="text-slate-500">比色系統</span>
            <span className="col-span-2 text-slate-800 dark:text-slate-200 font-mono">
              {metadata.toothShadeSystem}
            </span>
          </div>
          <div className="grid grid-cols-3 p-2.5">
            <span className="text-slate-500">掃描日期 / 匯出</span>
            <div className="col-span-2 font-mono text-[11px] text-slate-700 dark:text-slate-300 tabular-nums">
              <p>掃描: {metadata.scanDate}</p>
              <p className="text-slate-500 dark:text-slate-400">匯出: {metadata.exportTime}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 p-2.5">
            <span className="text-slate-500">系統與掃描儀版本</span>
            <span className="col-span-2 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
              iTero v{metadata.iteroVersion} / CaaS v{metadata.caasVersion}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Raw Files & Documentation Links */}
      {(assets.rxPdfUrl || assets.rxHtmlUrl) && (
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            相關檔案與原始報告
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            {assets.rxPdfUrl && (
              <a
                href={assets.rxPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm dark:shadow-none"
              >
                <FileCode className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                <span>{assets.rxPdfFileName || 'Rx.pdf'}</span>
                <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              </a>
            )}
            {assets.rxHtmlUrl && (
              <a
                href={assets.rxHtmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm dark:shadow-none"
              >
                <FileCode className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                <span>{assets.rxHtmlFileName || 'Rx.html'}</span>
                <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* 4. Secondary Administrative & Privacy Archive Section (Patient / Practitioner / Clinic) */}
      <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            次要行政與去識別化歸檔資訊
          </h3>
          {onToggleAnonymize && (
            <button
              onClick={onToggleAnonymize}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border transition-colors ${
                anonymizePatient
                  ? 'bg-amber-500/15 dark:bg-amber-950/50 border-amber-500/40 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {anonymizePatient ? (
                <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              ) : (
                <Shield className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              )}
              <span>{anonymizePatient ? '匿名已啟用' : '顯示完整資訊'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="bg-slate-100/70 dark:bg-[#0b0f17]/70 border border-slate-200/80 dark:border-slate-800/70 p-2.5 rounded-lg space-y-0.5">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" />
              病患姓名 (Patient)
            </span>
            <p className="font-medium text-slate-800 dark:text-slate-200 text-xs">
              {metadata.patientName}
            </p>
            <p className="font-mono text-[10px] text-slate-400 truncate" title={metadata.patientId}>
              UID: {metadata.patientId}
            </p>
          </div>

          <div className="bg-slate-100/70 dark:bg-[#0b0f17]/70 border border-slate-200/80 dark:border-slate-800/70 p-2.5 rounded-lg space-y-0.5">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Stethoscope className="w-3 h-3 text-slate-400" />
              主治醫師 (Practitioner)
            </span>
            <p className="font-medium text-slate-800 dark:text-slate-200 text-xs">
              {metadata.doctorName}
            </p>
            <p className="font-mono text-[10px] text-slate-400">
              執照: #{metadata.doctorLicense} | ID: {metadata.doctorId}
            </p>
          </div>
        </div>

        <div className="bg-slate-100/70 dark:bg-[#0b0f17]/70 border border-slate-200/80 dark:border-slate-800/70 p-2.5 rounded-lg text-xs space-y-0.5">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-400" />
            診療機構 (Clinic & Practice)
          </span>
          <p className="font-medium text-slate-800 dark:text-slate-200">{metadata.clinicName}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {metadata.clinicAddress}
          </p>
        </div>
      </div>
    </div>
  );
};
