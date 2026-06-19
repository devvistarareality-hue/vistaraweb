// Shared sessionStorage cache for Sales CRM pages
// Key → { ts, data }  |  TTL in ms

const TTLS = {
  stats:    2 * 60 * 1000,    // 2 min
  projects: 5 * 60 * 1000,   // 5 min
  sources:  5 * 60 * 1000,
  team:     2 * 60 * 1000,
  distLog:  60 * 1000,
  reports:  2 * 60 * 1000,
};
const DEFAULT_TTL = 20 * 1000; // 20s for leads_* and any other dynamic keys

export function getCache(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`sc_${key}`);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    const baseKey = key.split('_')[0];
    const ttl = TTLS[key] ?? TTLS[baseKey] ?? DEFAULT_TTL;
    if (Date.now() - ts > ttl) { sessionStorage.removeItem(`sc_${key}`); return null; }
    return data;
  } catch { return null; }
}

export function setCache(key, data) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(`sc_${key}`, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

export function bustCache(...keys) {
  if (typeof window === 'undefined') return;
  keys.forEach((k) => sessionStorage.removeItem(`sc_${k}`));
}
