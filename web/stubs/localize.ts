// Safety net: native-only (react-native-localize). Derives values from the browser.
const nav = typeof navigator !== 'undefined' ? navigator : undefined;
export const getLocales = () =>
  (nav?.languages?.length ? [...nav.languages] : ['en']).map((tag) => {
    const [languageCode = 'en', countryCode = ''] = tag.split('-');
    return { languageCode, languageTag: tag, countryCode, isRTL: ['ar', 'he', 'fa', 'ur'].includes(languageCode) };
  });
export const uses24HourClock = () => !/AM|PM/i.test(new Date(2020, 0, 1, 15).toLocaleTimeString([], { hour: 'numeric' }));
export const getTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const getCalendar = () => 'gregorian';
export const addEventListener = () => ({ remove: () => undefined });
export const removeEventListener = () => undefined;
export const useLocalize = () => ({ locales: getLocales() });
