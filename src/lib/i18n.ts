import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import { translations } from '../locales';

export const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

const deviceLang = () => getLocales()[0]?.languageTag ?? 'en';
i18n.locale = deviceLang();

export const RTL_LANGS = ['ar'];

export function setLanguage(tag: string) {
  i18n.locale = tag || deviceLang();
}

export const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
