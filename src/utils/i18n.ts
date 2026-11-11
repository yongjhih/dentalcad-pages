import { LocaleMode } from '../types/dental';

export const LOCALE_STORAGE_KEY = 'ios_pages_locale';

/**
 * Simple bilingual helper: returns English string when locale === 'en',
 * or Traditional Chinese string when locale === 'zh-TW'.
 */
export function tr(locale: LocaleMode, zhTW: string, en: string): string {
  return locale === 'en' ? en : zhTW;
}
