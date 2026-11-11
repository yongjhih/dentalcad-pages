import { LocaleMode } from '../types/dental';

export const LOCALE_STORAGE_KEY = 'dentalcad_locale';

/**
 * Simple bilingual helper: returns English string when locale === 'en',
 * or Traditional Chinese string when locale === 'zh-TW'.
 */
export function tr(locale: LocaleMode, zhTW: string, en: string): string {
  return locale === 'en' ? en : zhTW;
}

/**
 * Automatically detect the user's preferred locale:
 * 1. User's explicit choice stored in localStorage ('en' or 'zh-TW')
 * 2. URL query parameter (?lang= or ?locale=)
 * 3. Browser language (navigator.languages / navigator.language):
 *    returns 'zh-TW' if the primary browser language starts with 'zh',
 *    otherwise defaults to 'en' (English) when non-Chinese or undetectable.
 */
export function detectInitialLocale(
  customNav?: { language?: string; languages?: readonly string[] },
  searchString?: string
): LocaleMode {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === 'en' || saved === 'zh-TW') {
        return saved;
      }
    }
  } catch {
    // ignore storage errors
  }

  try {
    const rawSearch =
      searchString !== undefined
        ? searchString
        : typeof window !== 'undefined'
        ? window.location.search
        : '';
    if (rawSearch) {
      const params = new URLSearchParams(rawSearch);
      const qLang = (params.get('lang') || params.get('locale') || '').trim().toLowerCase();
      if (qLang.startsWith('zh')) return 'zh-TW';
      if (qLang.startsWith('en')) return 'en';
    }
  } catch {
    // ignore URL parse errors
  }

  try {
    const nav =
      customNav !== undefined
        ? customNav
        : typeof navigator !== 'undefined'
        ? navigator
        : undefined;
    if (nav) {
      const candidates: string[] = [];
      if (Array.isArray(nav.languages) && nav.languages.length > 0) {
        candidates.push(...nav.languages);
      }
      if (typeof nav.language === 'string' && nav.language.trim()) {
        candidates.push(nav.language);
      }
      const primary = candidates.find((c) => typeof c === 'string' && c.trim().length > 0);
      if (primary && primary.trim().toLowerCase().startsWith('zh')) {
        return 'zh-TW';
      }
    }
  } catch {
    // ignore navigator access errors
  }

  return 'en';
}

/**
 * Localizes preset or dynamic 3D caliper measurement labels when switching between zh-TW and en.
 */
export function localizeCaliperLabel(label: string, locale: LocaleMode): string {
  const map: Record<string, { zh: string; en: string }> = {
    '上顎尖牙間距 (U3-U3)': {
      zh: '上顎尖牙間距 (U3-U3)',
      en: 'Upper Intercanine (U3-U3)',
    },
    'Upper Intercanine (U3-U3)': {
      zh: '上顎尖牙間距 (U3-U3)',
      en: 'Upper Intercanine (U3-U3)',
    },
    '大臼齒間寬 (U6-U6)': {
      zh: '大臼齒間寬 (U6-U6)',
      en: 'Upper Intermolar (U6-U6)',
    },
    'Upper Intermolar (U6-U6)': {
      zh: '大臼齒間寬 (U6-U6)',
      en: 'Upper Intermolar (U6-U6)',
    },
    '下顎尖牙間寬 (L3-L3)': {
      zh: '下顎尖牙間寬 (L3-L3)',
      en: 'Lower Intercanine (L3-L3)',
    },
    'Lower Intercanine (L3-L3)': {
      zh: '下顎尖牙間寬 (L3-L3)',
      en: 'Lower Intercanine (L3-L3)',
    },
    '前牙水平覆蓋 (Overjet)': {
      zh: '前牙水平覆蓋 (Overjet)',
      en: 'Anterior Overjet (OJ)',
    },
    'Anterior Overjet (OJ)': {
      zh: '前牙水平覆蓋 (Overjet)',
      en: 'Anterior Overjet (OJ)',
    },
  };

  if (map[label]) {
    return locale === 'en' ? map[label].en : map[label].zh;
  }

  const dynMatch = label.match(/^(?:3D 測距|3D Caliper) #(\d+)$/);
  if (dynMatch) {
    return locale === 'en' ? `3D Caliper #${dynMatch[1]}` : `3D 測距 #${dynMatch[1]}`;
  }

  return label;
}
