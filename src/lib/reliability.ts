// Per-station reliability tracker.
// - Counts attempts and successes per station/channel id.
// - After 5 unsuccessful attempts -> "dead" -> sorted to the bottom.
// - On success -> reset and bumped to the top.
// - Whole store auto-resets weekly so streams that come back online get re-tested.

const KEY = "wavebox.reliability.v1";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEAD_THRESHOLD = 5;

export type RelEntry = {
  attempts: number;
  successes: number;
  lastSuccess: number;
  lastFailure: number;
  dead: boolean;
};

type Store = { resetAt: number; data: Record<string, RelEntry> };

const empty = (): Store => ({ resetAt: Date.now() + WEEK_MS, data: {} });

const read = (): Store => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const s = JSON.parse(raw) as Store;
    if (!s.resetAt || Date.now() > s.resetAt) return empty();
    return s;
  } catch {
    return empty();
  }
};

const write = (s: Store) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
};

export const getEntry = (id: string): RelEntry | undefined => read().data[id];

export const recordAttempt = (id: string) => {
  const s = read();
  const e = s.data[id] || { attempts: 0, successes: 0, lastSuccess: 0, lastFailure: 0, dead: false };
  e.attempts += 1;
  s.data[id] = e;
  write(s);
};

export const recordSuccess = (id: string) => {
  const s = read();
  s.data[id] = {
    attempts: 0,
    successes: (s.data[id]?.successes || 0) + 1,
    lastSuccess: Date.now(),
    lastFailure: 0,
    dead: false,
  };
  write(s);
};

export const recordFailure = (id: string) => {
  const s = read();
  const e = s.data[id] || { attempts: 0, successes: 0, lastSuccess: 0, lastFailure: 0, dead: false };
  e.lastFailure = Date.now();
  // attempts is incremented separately by recordAttempt; mark dead once threshold reached.
  if (e.attempts >= DEAD_THRESHOLD && e.successes === 0) e.dead = true;
  s.data[id] = e;
  write(s);
};

// Sort helper. Stable. Live (or unknown) before dead. Among live, recent successes first.
export function sortByReliability<T>(items: T[], getId: (t: T) => string): T[] {
  const s = read();
  return [...items]
    .map((item, idx) => ({ item, idx, e: s.data[getId(item)] }))
    .sort((a, b) => {
      const aDead = a.e?.dead ? 1 : 0;
      const bDead = b.e?.dead ? 1 : 0;
      if (aDead !== bDead) return aDead - bDead;
      const aSucc = a.e?.lastSuccess || 0;
      const bSucc = b.e?.lastSuccess || 0;
      if (aSucc !== bSucc) return bSucc - aSucc;
      return a.idx - b.idx;
    })
    .map((x) => x.item);
}

export const isDead = (id: string) => !!read().data[id]?.dead;
export const DEAD_TRIES = DEAD_THRESHOLD;
