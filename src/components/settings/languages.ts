/** Native names are intentionally not translated. '' = follow the device language. */
export const LANGUAGES: { tag: string; native: string }[] = [
  { tag: 'en', native: 'English' },
  { tag: 'es', native: 'Español' },
  { tag: 'pt-BR', native: 'Português (Brasil)' },
  { tag: 'de', native: 'Deutsch' },
  { tag: 'hi', native: 'हिन्दी' },
  { tag: 'ar', native: 'العربية' },
];

export function languageName(tag: string, deviceLabel: string): string {
  if (!tag) return deviceLabel;
  return LANGUAGES.find((l) => l.tag === tag)?.native ?? tag;
}
