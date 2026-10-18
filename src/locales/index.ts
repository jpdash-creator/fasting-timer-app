// Namespaced locale bundles. One JSON per namespace per language folder.
// Each file's top-level key is the namespace name (e.g. en/timer.json => { "timer": {...} }).
// Keys are looked up as t('timer.start'). Missing keys in other languages fall back to English.
import enCommon from './en/common.json';
import enStages from './en/stages.json';
import enTimer from './en/timer.json';
import enHistory from './en/history.json';
import enStats from './en/stats.json';
import enLogs from './en/logs.json';
import enOnboarding from './en/onboarding.json';
import enPaywall from './en/paywall.json';
import enSettings from './en/settings.json';
import enNotifications from './en/notifications.json';
import enShare from './en/share.json';
import enAppearance from './en/appearance.json';
import esCommon from './es/common.json';
import esStages from './es/stages.json';
import esTimer from './es/timer.json';
import esHistory from './es/history.json';
import esStats from './es/stats.json';
import esLogs from './es/logs.json';
import esOnboarding from './es/onboarding.json';
import esPaywall from './es/paywall.json';
import esSettings from './es/settings.json';
import esNotifications from './es/notifications.json';
import esShare from './es/share.json';
import esAppearance from './es/appearance.json';
import ptBRCommon from './pt-BR/common.json';
import ptBRStages from './pt-BR/stages.json';
import ptBRTimer from './pt-BR/timer.json';
import ptBRHistory from './pt-BR/history.json';
import ptBRStats from './pt-BR/stats.json';
import ptBRLogs from './pt-BR/logs.json';
import ptBROnboarding from './pt-BR/onboarding.json';
import ptBRPaywall from './pt-BR/paywall.json';
import ptBRSettings from './pt-BR/settings.json';
import ptBRNotifications from './pt-BR/notifications.json';
import ptBRShare from './pt-BR/share.json';
import ptBRAppearance from './pt-BR/appearance.json';
import deCommon from './de/common.json';
import deStages from './de/stages.json';
import deTimer from './de/timer.json';
import deHistory from './de/history.json';
import deStats from './de/stats.json';
import deLogs from './de/logs.json';
import deOnboarding from './de/onboarding.json';
import dePaywall from './de/paywall.json';
import deSettings from './de/settings.json';
import deNotifications from './de/notifications.json';
import deShare from './de/share.json';
import deAppearance from './de/appearance.json';

import { extraTranslations } from './extra';

const merge = (...parts: Record<string, unknown>[]) => Object.assign({}, ...parts);

const base: Record<string, Record<string, unknown>> = {
  en: merge(
    enCommon, enStages, enTimer, enHistory, enStats, enLogs, enOnboarding, enPaywall,
    enSettings, enNotifications, enShare, enAppearance,
  ),
  'es': merge(
    esCommon, esStages, esTimer, esHistory, esStats, esLogs, esOnboarding, esPaywall, esSettings, esNotifications, esShare, esAppearance,
  ),
  'pt-BR': merge(
    ptBRCommon, ptBRStages, ptBRTimer, ptBRHistory, ptBRStats, ptBRLogs, ptBROnboarding, ptBRPaywall, ptBRSettings, ptBRNotifications, ptBRShare, ptBRAppearance,
  ),
  'de': merge(
    deCommon, deStages, deTimer, deHistory, deStats, deLogs, deOnboarding, dePaywall, deSettings, deNotifications, deShare, deAppearance,
  ),
};

export const translations: Record<string, Record<string, unknown>> = { ...base, ...extraTranslations };
