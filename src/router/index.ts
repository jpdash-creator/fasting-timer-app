// Router compatibility layer over React Navigation 7. Screens keep the expo-router style API:
// router.push('/history'), router.push({ pathname: '/paywall', params: { trigger } }), useLocalSearchParams(), ...
// Hrefs are the old expo-router paths; see src/navigation/hrefs.ts for the mapping to named routes.
import { createElement, useEffect, useMemo, type ReactElement } from 'react';
import {
  CommonActions, StackActions, useFocusEffect as rnUseFocusEffect, useRoute, type NavigationAction,
} from '@react-navigation/native';
import { navigationRef } from '../navigation/navigationRef';
import { resolveHref, type Href, type Target } from '../navigation/hrefs';

export type { Href };

export interface Router {
  push(href: Href): void;
  replace(href: Href): void;
  back(): void;
  canGoBack(): boolean;
  dismiss(): void;
  navigate(href: Href): void;
}

type Mode = 'push' | 'navigate' | 'replace';

const pending: Array<() => void> = [];

/** Run queued navigations (called by App when the NavigationContainer is ready). */
export function flushPendingNavigation() {
  while (pending.length) pending.shift()?.();
}

function rootState() {
  return navigationRef.getRootState();
}
function focusedRootName(): string | undefined {
  const s = rootState();
  return s?.routes[s.index]?.name;
}
function dispatchRoot(action: NavigationAction) {
  navigationRef.dispatch({ ...action, target: rootState()?.key });
}
const hasParams = (p: Record<string, string>) => Object.keys(p).length > 0;

function go(mode: Mode, target: Target) {
  const { name, params } = target;
  const p = hasParams(params) ? params : undefined;
  const root = rootState();

  if (target.kind === 'tab') {
    const nested = { screen: name, params: p };
    if (mode === 'replace') {
      // Pop back to an existing Tabs route (closing modals above it), otherwise rebuild the root stack.
      if (root?.routes.some((r) => r.name === 'Tabs')) dispatchRoot(StackActions.popTo('Tabs', nested));
      else dispatchRoot(CommonActions.reset({ index: 0, routes: [{ name: 'Tabs', params: nested }] }));
    } else {
      dispatchRoot(CommonActions.navigate({ name: 'Tabs', params: nested }));
    }
    return;
  }

  if (target.kind === 'onboarding') {
    const inOnboarding = focusedRootName() === 'Onboarding';
    if (mode === 'replace') {
      if (inOnboarding) navigationRef.dispatch(StackActions.replace(name, p));
      else dispatchRoot(CommonActions.reset({ index: 0, routes: [{ name: 'Onboarding', params: { screen: name, params: p } }] }));
    } else if (inOnboarding && mode === 'push') {
      navigationRef.dispatch(StackActions.push(name, p));
    } else {
      dispatchRoot(CommonActions.navigate({ name: 'Onboarding', params: { screen: name, params: p } }));
    }
    return;
  }

  // Root-level modal screens.
  if (mode === 'replace') dispatchRoot(StackActions.replace(name, p));
  else if (mode === 'push') dispatchRoot(StackActions.push(name, p));
  else dispatchRoot(CommonActions.navigate({ name, params: p }));
}

function run(mode: Mode, href: Href) {
  const target = resolveHref(href);
  if (!target) {
    if (__DEV__) console.warn('[router] unknown href', href);
    return;
  }
  if (!navigationRef.isReady()) { pending.push(() => run(mode, href)); return; }
  go(mode, target);
}

/** Pop one screen; a deep-linked modal (page reload / shared URL) has nothing below it, so fall back to the Timer tab. */
function goBackOrHome() {
  if (!navigationRef.isReady()) return;
  if (navigationRef.canGoBack()) navigationRef.goBack();
  else run('replace', '/');
}

export const router: Router = {
  push: (href) => run('push', href),
  replace: (href) => run('replace', href),
  navigate: (href) => run('navigate', href),
  back: () => goBackOrHome(),
  dismiss: () => goBackOrHome(),
  canGoBack: () => navigationRef.isReady() && navigationRef.canGoBack(),
};

/** Stable object (same identity every render), safe in hook dependency lists. */
export function useRouter(): Router {
  return router;
}

/** Params of the current route, stringified like expo-router's useLocalSearchParams. */
export function useLocalSearchParams<
  T extends Record<string, string | string[] | undefined> = Record<string, string | undefined>,
>(): T {
  const route = useRoute();
  const raw = route.params as Record<string, unknown> | undefined;
  return useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw ?? {})) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'object') continue; // nested navigator params (screen/params/state)
      out[k] = String(v);
    }
    return out as unknown as T;
  }, [raw]);
}

/** Runs `effect` when the screen gains focus (wrap it in useCallback, as with expo-router). */
export function useFocusEffect(effect: () => void | (() => void)): void {
  rnUseFocusEffect(effect);
}

export function Redirect({ href }: { href: Href }): ReactElement | null {
  useEffect(() => { router.replace(href); }, [href]);
  return createElement(NullView);
}
function NullView() { return null; }
