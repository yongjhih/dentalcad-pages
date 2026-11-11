import React, { useRef } from 'react';
import {
  Shield,
  ShieldAlert,
  FileText,
  FolderOpen,
  ChevronDown,
  Trash2,
  Database,
  Sun,
  Moon,
  Globe,
} from 'lucide-react';
import { DentalCaseBundle, ThemeMode, LocaleMode } from '../types/dental';
import { getDisplayMetadata } from '../utils/anonymize';
import { tr } from '../utils/i18n';

interface HeaderProps {
  cases: DentalCaseBundle[];
  activeCase: DentalCaseBundle;
  onSelectCase: (caseId: string) => void;
  onImportCaseFiles: (files: FileList) => void;
  onDeleteCustomCase?: (caseId: string) => void;
  anonymizePatient: boolean;
  onToggleAnonymize: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  locale?: LocaleMode;
  onToggleLocale?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cases,
  activeCase,
  onSelectCase,
  onImportCaseFiles,
  onDeleteCustomCase,
  anonymizePatient,
  onToggleAnonymize,
  theme,
  onToggleTheme,
  locale = 'zh-TW',
  onToggleLocale,
}) => {
  const bundleInputRef = useRef<HTMLInputElement>(null);
  const { assets } = activeCase;
  const displayMeta = getDisplayMetadata(activeCase.metadata, anonymizePatient);

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090d16] px-4 flex items-center justify-between flex-shrink-0 z-20 gap-2 transition-colors">
      {/* Brand & Dynamic Case Selector */}
      <div className="flex items-center space-x-3 min-w-0">
        <div className="flex items-center space-x-2 flex-shrink-0">
          <div className="w-7 h-7 rounded bg-sky-500/15 dark:bg-sky-950/80 border border-sky-500/40 dark:border-sky-800/70 flex items-center justify-center text-sky-600 dark:text-sky-400 font-mono text-[11px] font-bold">
            CAD
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
              DentalCAD Pages
            </span>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              Universal IOS 3D
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

        {/* Case Switcher Dropdown (Focused on Order ID & Procedure, not Patient Name) */}
        <div className="relative flex items-center gap-1.5">
          <div className="relative flex items-center">
            <select
              aria-label="選擇臨床案例"
              value={activeCase.id}
              onChange={(e) => onSelectCase(e.target.value)}
              className="appearance-none bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-xs text-slate-800 dark:text-slate-200 font-mono rounded pl-2.5 pr-7 py-1 cursor-pointer transition-colors tabular-nums"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.metadata.orderId} · {c.metadata.procedure}{' '}
                  {c.source === 'custom' ? '(IndexedDB)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 pointer-events-none absolute right-2" />
          </div>

          {activeCase.source === 'custom' && (
            <span
              className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 dark:bg-emerald-950/60 border border-emerald-500/40 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-[11px]"
              title={tr(
                locale,
                '此案例已持久化儲存於瀏覽器 IndexedDB，下次開啟網頁仍可直接檢視',
                'Case persisted in browser IndexedDB for offline access'
              )}
            >
              <Database className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>{tr(locale, '已存於 IndexedDB', 'Saved in IndexedDB')}</span>
            </span>
          )}

          {activeCase.source === 'custom' && onDeleteCustomCase && (
            <button
              onClick={() => onDeleteCustomCase(activeCase.id)}
              className="p-1 rounded bg-red-100 dark:bg-red-950/50 hover:bg-red-200 dark:hover:bg-red-900/70 border border-red-300 dark:border-red-800/60 text-red-600 dark:text-red-300 transition-colors"
              title={tr(
                locale,
                '從瀏覽器 IndexedDB 移除此自訂案例',
                'Remove custom case from browser IndexedDB'
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="hidden xl:flex items-center space-x-1.5">
          <span className="px-2 py-0.5 rounded bg-sky-500/15 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-500/30 dark:border-sky-800/60 text-[11px] font-medium">
            {displayMeta.procedureType}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 text-[11px]">
            {tr(locale, '掃描', 'Scan')}: {displayMeta.scanDate}
          </span>
        </div>
      </div>

      {/* Actions: Data Import, Anonymize Toggle, PDF, Locale, Theme & GitHub */}
      <div className="flex items-center space-x-2 flex-shrink-0">
        {/* Load External Case Bundle Button */}
        <input
          ref={bundleInputRef}
          type="file"
          multiple
          accept=".stl,.xml,.jpg,.jpeg,.png,.pdf,.html"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onImportCaseFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <button
          onClick={() => bundleInputRef.current?.click()}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs bg-sky-500/15 dark:bg-sky-950/60 hover:bg-sky-500/25 dark:hover:bg-sky-900/70 border border-sky-500/40 dark:border-sky-800/70 text-sky-700 dark:text-sky-200 transition-colors font-medium"
          title={tr(
            locale,
            '選取其他案例的 STL / XML / JPG / PDF 檔案組，即時抽換並自動存入瀏覽器 IndexedDB',
            'Select local STL / XML / JPG / PDF scanner files to render and persist in browser IndexedDB'
          )}
        >
          <FolderOpen className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span className="hidden sm:inline">
            {tr(locale, '抽換並存入瀏覽器', 'Upload Scan Bundle')}
          </span>
        </button>

        {/* Privacy Anonymize Toggle (Default Active) */}
        <button
          onClick={onToggleAnonymize}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition-colors border ${
            anonymizePatient
              ? 'bg-amber-500/15 dark:bg-amber-950/50 border-amber-500/40 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 dark:hover:bg-amber-900/60'
              : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
          title={
            anonymizePatient
              ? '目前為匿名保護模式（已遮罩病患、醫師與醫療機構名稱），點擊可顯示完整資訊'
              : '點擊開啟匿名保護模式（遮罩病患、醫師與醫療機構名稱）'
          }
        >
          {anonymizePatient ? (
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          ) : (
            <Shield className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          )}
          <span>
            {anonymizePatient
              ? tr(locale, '匿名已啟用', 'Anonymized')
              : tr(locale, '顯示原始個資', 'Raw PHI Visible')}
          </span>
        </button>

        {/* Prescription PDF Link */}
        {assets.rxPdfUrl && (
          <a
            href={assets.rxPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded text-xs bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title={`開啟處方 PDF (${assets.rxPdfFileName || 'Rx.pdf'})`}
          >
            <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{tr(locale, '處方箋 PDF', 'Rx PDF')}</span>
          </a>
        )}

        {/* English / Traditional Chinese Language Switcher */}
        {onToggleLocale && (
          <button
            data-testid="locale-toggle-btn"
            onClick={onToggleLocale}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title={
              locale === 'zh-TW'
                ? 'Switch interface language to English (EN)'
                : '切換介面語系為繁體中文 (zh-TW)'
            }
          >
            <Globe className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            <span>{locale === 'zh-TW' ? 'EN' : '中文'}</span>
          </button>
        )}

        {/* Light / Dark Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title={theme === 'dark' ? '切換為亮色佈景 (Light Mode)' : '切換為暗色佈景 (Dark Mode)'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">{tr(locale, '亮色', 'Light')}</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-sky-600" />
              <span className="hidden md:inline">{tr(locale, '暗色', 'Dark')}</span>
            </>
          )}
        </button>

        {/* GitHub link */}
        <a
          href="https://github.com/yongjhih/dentalcad-pages"
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
          title="檢視 GitHub 倉庫原始碼"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            />
          </svg>
        </a>
      </div>
    </header>
  );
};
