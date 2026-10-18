import { I18n } from 'i18n-js';
import { deviceLanguageTag } from '../platform/locale';
import { translations } from '../locales';

export const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

const deviceLang = () => deviceLanguageTag();
i18n.locale = deviceLang();

export const RTL_LANGS = ['ar'];

export function setLanguage(tag: string) {
  i18n.locale = tag || deviceLang();
}

export const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
