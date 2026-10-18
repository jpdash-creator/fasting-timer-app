import { Platform } from 'react-native';
import { Config } from '../platform/config';

/**
 * Legal / support links. fastline.app is NOT owned by the publisher, so the placeholder URLs below
 * must never be opened. Host the policy (e.g. GitHub Pages) and set PRIVACY_URL (and
 * optionally TERMS_URL / SUPPORT_EMAIL) in .env.production before store submission.
 */
export const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

const clean = (v: string | undefined): string => (v ?? '').trim();
const envPrivacy = clean(Config.PRIVACY_URL);
const envTerms = clean(Config.TERMS_URL);
const envSupport = clean(Config.SUPPORT_EMAIL);

const PLACEHOLDER_PRIVACY = 'https://fastline.app/privacy';
const PLACEHOLDER_TERMS = 'https://fastline.app/terms';

/** True when a real, publisher-hosted privacy policy URL is configured. */
export const HAS_PRIVACY_URL = /^https:\/\//i.test(envPrivacy);
/** True when a real terms URL is available (env override, or Apple's standard EULA on iOS). */
export const HAS_TERMS_URL = /^https:\/\//i.test(envTerms) || Platform.OS === 'ios';

export const PRIVACY_URL: string = HAS_PRIVACY_URL ? envPrivacy : PLACEHOLDER_PRIVACY;
export const TERMS_URL: string = /^https:\/\//i.test(envTerms)
  ? envTerms
  : Platform.OS === 'ios' ? APPLE_EULA_URL : PLACEHOLDER_TERMS;
export const SUPPORT_EMAIL: string = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(envSupport) ? envSupport : 'jpdash.creator@gmail.com';
