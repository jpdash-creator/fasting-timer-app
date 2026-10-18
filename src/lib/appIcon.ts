import { NativeModules, Platform } from 'react-native';
import type { AccentTheme } from './themePalettes';

/**
 * Names understood by react-native-change-icon. They MUST match the native side:
 *  - Android: `<activity-alias android:name=".MainActivity<Name>">` in AndroidManifest.xml
 *    (`MainActivityDefault` is the enabled default launcher alias),
 *  - iOS: `CFBundleAlternateIcons` keys in Info.plist (`Default` = the primary AppIcon, alternate icon nil).
 * Teal is the default icon.
 */
const ICON_NAME: Record<AccentTheme, string> = {
  teal: 'Default', ocean: 'Ocean', dusk: 'Dusk', sunrise: 'Sunrise',
};

export type AppIconResult = 'ok' | 'unsupportedWeb' | 'unsupportedBuild' | 'failed';

type IconModule = {
  changeIcon: (iconName?: string) => Promise<string>;
  getIcon: () => Promise<string>;
};

const isWeb = () => Platform.OS === 'web';

/**
 * Loads the library lazily. The library calls `NativeModules.ChangeIcon` (old-architecture module,
 * served by the interop layer); when it is not linked (web, tests, stale build) this reports
 * "unsupported" instead of crashing.
 */
async function load(): Promise<IconModule | null> {
  if (isWeb() || !NativeModules?.ChangeIcon) return null;
  try {
    return (await import('react-native-change-icon')) as IconModule;
  } catch {
    return null;
  }
}

/** The library rejects with a string code (`ANDROID:ICON_ALREADY_USED:..` / `IOS:ICON_ALREADY_USED`). */
function errorText(e: unknown): string {
  const x = e as { code?: unknown; message?: unknown } | string | null | undefined;
  if (typeof x === 'string') return x;
  return `${String(x?.code ?? '')} ${String(x?.message ?? '')}`;
}

/**
 * The theme whose launcher icon is currently installed (teal when unknown).
 * Android caveat: the library derives the icon from the running activity's alias name, so a cold start
 * through a deep link or notification (which targets MainActivity, not an alias) reports 'Default'.
 */
export async function getCurrentIconTheme(): Promise<AccentTheme> {
  const m = await load();
  if (!m) return 'teal';
  try {
    const name = await m.getIcon();
    const hit = (Object.keys(ICON_NAME) as AccentTheme[]).find((k) => ICON_NAME[k] === name);
    return hit ?? 'teal';
  } catch {
    return 'teal';
  }
}

export async function setAppIconTheme(theme: AccentTheme): Promise<AppIconResult> {
  if (isWeb()) return 'unsupportedWeb';
  const m = await load();
  if (!m) return 'unsupportedBuild';
  try {
    await m.changeIcon(ICON_NAME[theme]);
    return 'ok';
  } catch (e) {
    const t = errorText(e);
    if (t.includes('ICON_ALREADY_USED')) return 'ok'; // already the active icon
    if (t.includes('NOT_SUPPORTED')) return 'unsupportedBuild'; // iOS: supportsAlternateIcons == NO
    return 'failed';
  }
}
