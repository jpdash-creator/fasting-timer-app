import { useEffect } from 'react';
import { Platform } from 'react-native';
import { RTL_LANGS } from '../lib/i18n';

// The RN tsconfig has no DOM lib: reach the browser document through a minimal structural type.
/* eslint-disable @typescript-eslint/no-explicit-any */
const doc = (): any => (Platform.OS === 'web' ? (globalThis as any).document : undefined);

/** Web only: <html lang/dir> (WCAG 3.1.1), visible keyboard focus ring (2.4.7 / 2.4.11), Space activates radio/tab/checkbox/switch. */
export function useWebDocumentEffects(language: string, accent: string) {
  useEffect(() => {
    const d = doc();
    if (!d) return;
    const rtl = RTL_LANGS.includes((language || '').split('-')[0]);
    const nav = (globalThis as any).navigator;
    const tag = language || nav?.language || 'en';
    d.documentElement.lang = tag;
    d.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    const d = doc();
    if (!d) return;
    let el = d.getElementById('fl-focus-style');
    if (!el) { el = d.createElement('style'); el.id = 'fl-focus-style'; d.head.appendChild(el); }
    el.textContent = `[tabindex]:focus-visible,button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid ${accent} !important;outline-offset:2px !important;}`;
  }, [accent]);

  useEffect(() => {
    const d = doc();
    if (!d) return;
    const onKey = (e: any) => {
      if (e.key !== ' ' || e.repeat) return;
      const el = e.target;
      const role = el?.getAttribute?.('role');
      if (!el || el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'TEXTAREA') return;
      if (role === 'radio' || role === 'tab' || role === 'checkbox' || role === 'switch') { e.preventDefault(); el.click(); }
    };
    d.addEventListener('keydown', onKey);
    return () => d.removeEventListener('keydown', onKey);
  }, []);
}
