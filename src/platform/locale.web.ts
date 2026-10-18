/** BCP 47 tag from the browser. */
export function deviceLanguageTag(): string {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.languages?.[0] ?? navigator.language ?? 'en';
}
