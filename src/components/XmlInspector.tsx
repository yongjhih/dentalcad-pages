import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check, FileCode, Download } from 'lucide-react';
import { DentalCaseBundle, LocaleMode } from '../types/dental';
import { anonymizeXmlString } from '../utils/anonymize';
import { tr } from '../utils/i18n';

interface XmlInspectorProps {
  caseBundle: DentalCaseBundle;
  anonymizePatient?: boolean;
  locale?: LocaleMode;
}

export const XmlInspector: React.FC<XmlInspectorProps> = ({
  caseBundle,
  anonymizePatient = true,
  locale = 'en',
}) => {
  const [xmlVersion, setXmlVersion] = useState<'v50' | 'v30'>('v50');
  const [xmlContent, setXmlContent] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const { assets, metadata } = caseBundle;

  useEffect(() => {
    let cancelled = false;
    const rawCached = xmlVersion === 'v50' ? caseBundle.rawXmlV50 : caseBundle.rawXmlV30;
    const url = xmlVersion === 'v50' ? assets.xmlV50Url : assets.xmlV30Url;

    if (rawCached) {
      setXmlContent(rawCached);
      return;
    }

    if (url) {
      fetch(url)
        .then((res) => res.text())
        .then((text) => {
          if (!cancelled) setXmlContent(text);
        })
        .catch(() => {
          if (!cancelled)
            setXmlContent(
              tr(locale, '<!-- 無法讀取 XML 原始檔案 -->', '<!-- Failed to load raw XML file -->')
            );
        });
    } else {
      setXmlContent(
        tr(
          locale,
          '<!-- 此案例未包含對應版本之 XML 檔案 -->',
          '<!-- No XML file available for this version -->'
        )
      );
    }

    return () => {
      cancelled = true;
    };
  }, [caseBundle, xmlVersion, assets.xmlV50Url, assets.xmlV30Url, locale]);

  const displayedXml = useMemo(
    () => anonymizeXmlString(xmlContent, anonymizePatient),
    [xmlContent, anonymizePatient]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(displayedXml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeFileName =
    xmlVersion === 'v50'
      ? assets.xmlV50FileName || `scanner_export_#${metadata.orderId}_v50.xml`
      : assets.xmlV30FileName || `scanner_export_#${metadata.orderId}_v30.xml`;

  const activeDownloadUrl = xmlVersion === 'v50' ? assets.xmlV50Url : assets.xmlV30Url;

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <span>
              {tr(locale, '口掃匯出 Metadata (XML)', 'Scanner Export Metadata (XML)')}
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            {tr(
              locale,
              '包含咬合變換矩陣 (ActualUsedTransforms)、ADA 牙位代碼及處方物件關聯。',
              'Contains occlusal transformation matrices (ActualUsedTransforms), ADA tooth ranges, and Rx metadata.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Version Toggle (v5.0 / v3.0) */}
          {(assets.xmlV50Url || caseBundle.rawXmlV50) &&
            (assets.xmlV30Url || caseBundle.rawXmlV30) && (
              <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-0.5 mr-1">
                <button
                  onClick={() => setXmlVersion('v50')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    xmlVersion === 'v50'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  v5.0
                </button>
                <button
                  onClick={() => setXmlVersion('v30')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    xmlVersion === 'v30'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  v3.0
                </button>
              </div>
            )}

          <button
            data-testid="xml-copy-btn"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-transparent transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>
              {copied ? tr(locale, '已複製', 'Copied') : tr(locale, '複製 XML', 'Copy XML')}
            </span>
          </button>

          {activeDownloadUrl && (
            <a
              href={activeDownloadUrl}
              download={activeFileName}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500/15 dark:bg-sky-950/60 border border-sky-500/40 dark:border-sky-800/60 text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{tr(locale, '下載原始檔', 'Download XML')}</span>
            </a>
          )}
        </div>
      </div>

      {/* Code Container */}
      <div className="bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm dark:shadow-none">
        <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-500 dark:text-slate-400 flex justify-between items-center">
          <span>
            {activeFileName}{' '}
            {anonymizePatient ? tr(locale, '(匿名遮罩檢視)', '(Anonymized View)') : ''}
          </span>
          <span>
            {xmlVersion === 'v50' ? 'Version 5.0' : 'Version 3.0'} (CaaS {metadata.caasVersion})
          </span>
        </div>
        <pre className="p-4 font-mono text-[11px] text-slate-800 dark:text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed selection:bg-sky-500/30">
          <code>{displayedXml}</code>
        </pre>
      </div>
    </div>
  );
};
