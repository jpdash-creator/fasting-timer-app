import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOUR } from './fastMath';

const KEY = 'fw.timer.safetySeen';
export type SafetyLevel = 24 | 48 | 72;

/** Highest safety level the elapsed time has crossed, or 0. */
export function levelFor(elapsedMs: number): 0 | SafetyLevel {
  const h = elapsedMs / HOUR;
  return h >= 72 ? 72 : h >= 48 ? 48 : h >= 24 ? 24 : 0;
}

async function readAll(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export async function getSeenLevel(fastId: string): Promise<number> {
  return (await readAll())[fastId] ?? 0;
}

export async function markSeenLevel(fastId: string, level: number): Promise<void> {
  try {
    const all = await readAll();
    // keep the map small: only the latest few fasts
    const entries = Object.entries({ ...all, [fastId]: Math.max(all[fastId] ?? 0, level) }).slice(-20);
    await AsyncStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* in-memory state still protects this session */
  }
}
