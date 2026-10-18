// Additional locale bundles (hi, ar). index.ts should spread `extraTranslations` into `translations`.
import hiCommon from './hi/common.json';
import hiStages from './hi/stages.json';
import hiTimer from './hi/timer.json';
import hiHistory from './hi/history.json';
import hiStats from './hi/stats.json';
import hiLogs from './hi/logs.json';
import hiOnboarding from './hi/onboarding.json';
import hiPaywall from './hi/paywall.json';
import hiSettings from './hi/settings.json';
import hiNotifications from './hi/notifications.json';
import hiShare from './hi/share.json';
import hiAppearance from './hi/appearance.json';
import arCommon from './ar/common.json';
import arStages from './ar/stages.json';
import arTimer from './ar/timer.json';
import arHistory from './ar/history.json';
import arStats from './ar/stats.json';
import arLogs from './ar/logs.json';
import arOnboarding from './ar/onboarding.json';
import arPaywall from './ar/paywall.json';
import arSettings from './ar/settings.json';
import arNotifications from './ar/notifications.json';
import arShare from './ar/share.json';
import arAppearance from './ar/appearance.json';

const merge = (...parts: Record<string, unknown>[]) => Object.assign({}, ...parts);

export const extraTranslations: Record<string, Record<string, unknown>> = {
  hi: merge(
    hiCommon, hiStages, hiTimer, hiHistory, hiStats, hiLogs, hiOnboarding, hiPaywall,
    hiSettings, hiNotifications, hiShare, hiAppearance,
  ),
  ar: merge(
    arCommon, arStages, arTimer, arHistory, arStats, arLogs, arOnboarding, arPaywall,
    arSettings, arNotifications, arShare, arAppearance,
  ),
};
