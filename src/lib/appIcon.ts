import type { AccentTheme } from './themePalettes';

/** Names registered in app.json (expo-alternate-app-icons PascalCases them). Teal = the default icon (reset to null). */
const ICON_NAME: Record<AccentTheme, string | null> = {
  teal: null, ocean: 'Ocean', dusk: 'Dusk', sunrise: 'Sunrise',
};

export type AppIconResult = 'ok' | 'unsupportedWeb' | 'unsupportedBuild' | 'failed';

type IconModule = {
  supportsAlternateIcons: boolean;
  setAlternateAppIcon: (name: string | null) => Promise<string | null>;
  getAppIconName: () => string | null;
};

/**
 * Loads the native module lazily. Expo Go, web and builds without the plugin throw on import,
 * so a failed import means "unsupported" and never crashes the app.
 */
async function load(): Promise<IconModule | null> {
  try {
    return (await import('expo-alternate-app-icons')) as IconModule;
  } catch {
    return null;
  }
}

const isWeb = () => process.env.EXPO_OS === 'web';

/** The theme whose launcher icon is currently installed (teal when unknown). */
export async function getCurrentIconTheme(): Promise<AccentTheme> {
  if (isWeb()) return 'teal';
  const m = await load();
  if (!m) return 'teal';
  try {
    const name = m.getAppIconName();
    const hit = (Object.keys(ICON_NAME) as AccentTheme[]).find((k) => ICON_NAME[k] === name);
    return hit ?? 'teal';
  } catch {
    return 'teal';
  }
}

export async function setAppIconTheme(theme: AccentTheme): Promise<AppIconResult> {
  if (isWeb()) return 'unsupportedWeb';
  const m = await load();
  if (!m || !m.supportsAlternateIcons) return 'unsupportedBuild';
  try {
    await m.setAlternateAppIcon(ICON_NAME[theme]);
    return 'ok';
  } catch {
    return 'failed';
  }
}
