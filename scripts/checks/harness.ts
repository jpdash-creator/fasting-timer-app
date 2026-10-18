/// <reference types="node" />
/**
 * Tiny dependency-free test harness for the pure-logic checks (run with `npm run check`).
 * - stubs the React Native / native modules that stores import, so stores can be exercised in Node
 * - check() queues a named test; run.ts executes them in order and prints a summary
 */
import assert from 'node:assert/strict';
import Module from 'node:module';
import type { Fast } from '../../src/types';

export { assert };

/* ---------------------------------------------------------------- native stubs */

const memory = new Map<string, string>();
export const asyncStorageStub = {
  getItem: async (k: string) => (memory.has(k) ? (memory.get(k) as string) : null),
  setItem: async (k: string, v: string) => { memory.set(k, v); },
  removeItem: async (k: string) => { memory.delete(k); },
  clear: async () => { memory.clear(); },
};

const STUBS: Record<string, unknown> = {
  'react-native': {
    Platform: { OS: 'android' },
    Alert: { alert: () => {} },
    AppState: { addEventListener: () => ({ remove: () => {} }) },
    I18nManager: { isRTL: false },
  },
  '@react-native-async-storage/async-storage': { __esModule: true, default: asyncStorageStub },
  'expo-localization': { getLocales: () => [{ languageTag: 'en' }] },
};

export function installStubs() {
  const M = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
  const orig = M._load;
  M._load = function patched(this: unknown, request: string, ...rest: unknown[]) {
    if (request in STUBS) return STUBS[request];
    return orig.call(this, request, ...rest);
  };
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
}

/* ---------------------------------------------------------------- queue */

interface Case { suite: string; name: string; fn: () => void | Promise<void> }
export const queue: Case[] = [];
let suite = 'misc';
export const describe = (name: string) => { suite = name; };
export function check(name: string, fn: () => void | Promise<void>) {
  queue.push({ suite, name, fn });
}

/**
 * Baseline zone for every check so results do not depend on the machine (override: CHECK_TZ=Asia/Kolkata).
 * A DST-observing zone is the default on purpose.
 */
export const BASE_TZ = process.env.CHECK_TZ || 'America/New_York';
process.env.TZ = BASE_TZ;

/** Runs `fn` with the process time zone temporarily set (Node re-reads TZ on assignment), then restores BASE_TZ. */
export function withTZ<T>(tz: string, fn: () => T): T {
  process.env.TZ = tz;
  try { return fn(); } finally { process.env.TZ = BASE_TZ; }
}

/* ---------------------------------------------------------------- fixtures */

export const MIN = 60_000;
export const H = 3_600_000;
export const D = 86_400_000;

/** Local wall-clock time (month is 1-based). */
export const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

let n = 0;
export function mkFast(o: Partial<Fast> & { startAt: number }): Fast {
  n++;
  const endAt = o.endAt === undefined ? null : o.endAt;
  return {
    id: o.id ?? `f${n}`, protocolId: o.protocolId ?? '16_8', startAt: o.startAt, endAt,
    targetMinutes: o.targetMinutes ?? 960,
    goalMet: o.goalMet === undefined ? (endAt === null ? null : true) : o.goalMet,
    mood: o.mood ?? null, note: o.note ?? '', stagesReached: o.stagesReached ?? [],
    createdAt: o.createdAt ?? 0, updatedAt: o.updatedAt ?? 0,
  };
}

/** A goal-met fast that ended at the given local day/time. */
export const metOn = (y: number, mo: number, d: number, h = 12) =>
  mkFast({ startAt: at(y, mo, d, h) - 16 * H, endAt: at(y, mo, d, h), goalMet: true });
