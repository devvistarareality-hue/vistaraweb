// localStorage cache for Sales CRM pages — persists across browser sessions
// Key → { ts, data }  |  TTL in ms

const TTLS = {
  stats:    2 * 60 * 1000,
  projects: 5 * 60 * 1000,
  sources:  5 * 60 * 1000,
  team:     2 * 60 * 1000,
  distLog:  60 * 1000,
  reports:  2 * 60 * 1000,
};
const DEFAULT_TTL = 20 * 1000;

function store() {
  return typeof window !== 'undefined' ? localStorage : null;
}

// Returns data only if fresh (within TTL)
export function getCache(key) {
  const s = store(); if (!s) return null;
  try {
    const raw = s.getItem(`sc_${key}`);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    const baseKey = key.split('_')[0];
    const ttl = TTLS[key] ?? TTLS[baseKey] ?? DEFAULT_TTL;
    if (Date.now() - ts > ttl) { s.removeItem(`sc_${key}`); return null; }
    return data;
  } catch { return null; }
}

// Returns data even if stale, plus whether it's fresh
export function getCacheWithStatus(key) {
  const s = store(); if (!s) return { data: null, fresh: false };
  try {
    const raw = s.getItem(`sc_${key}`);
    if (!raw) return { data: null, fresh: false };
    const { ts, data } = JSON.parse(raw);
    const baseKey = key.split('_')[0];
    const ttl = TTLS[key] ?? TTLS[baseKey] ?? DEFAULT_TTL;
    return { data, fresh: Date.now() - ts <= ttl };
  } catch { return { data: null, fresh: false }; }
}

export function setCache(key, data) {
  const s = store(); if (!s) return;
  try { s.setItem(`sc_${key}`, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

export function bustCache(...keys) {
  const s = store(); if (!s) return;
  keys.forEach((k) => s.removeItem(`sc_${k}`));
}
