import { getLocales } from 'react-native-localize';

/** BCP 47 tag of the preferred device locale among the natively declared ones (en, ar, de, es, hi, pt-BR). */
export function deviceLanguageTag(): string {
  try { return getLocales()[0]?.languageTag ?? 'en'; } catch { return 'en'; }
}
