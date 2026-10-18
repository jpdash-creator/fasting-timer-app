import { Platform } from 'react-native';
import { getStateFromPath, type LinkingOptions } from '@react-navigation/native';
import { buildLinkingScreens, normalizeIncomingPath } from './hrefs';
import type { RootParamList } from './types';

/**
 * Deep links (native): fastline://timer, fastline://paywall, fastline://history?date=YYYY-MM-DD.
 * Already declared natively: Android intent-filter (scheme fastline) on MainActivity; iOS CFBundleURLTypes + SceneDelegate
 * forwarding openURLContexts to RCTLinkingManager.
 * Web: paths are the plain URLs of the former Expo web app (/history?date=..., /paywall?trigger=gate&feature=themes, ...).
 */
function prefixes(): string[] {
  const p = ['fastline://', 'http://localhost', 'https://localhost'];
  const origin = (globalThis as { location?: { origin?: string } }).location?.origin;
  if (Platform.OS === 'web' && origin) p.push(origin);
  return p;
}

export const linking: LinkingOptions<RootParamList> = {
  prefixes: prefixes(),
  config: { screens: buildLinkingScreens() },
  // '/timer' and '/(group)/..' variants -> canonical paths.
  getStateFromPath: (path, options) => getStateFromPath(normalizeIncomingPath(path), options),
};
