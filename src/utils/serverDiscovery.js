import { RAILWAY_URL, setBaseUrl } from '../constants/api';

const LOCAL_URL = 'http://localhost:8000';
// Probe the dedicated health endpoint (GET, no auth, returns JSON) instead of
// the POST-only login endpoint — the latter logs a 405 on every probe.
const PROBE_PATH = '/health/';
const TIMEOUT_MS = 2000;

async function probeUrl(url) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${url}${PROBE_PATH}`, { signal: controller.signal });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}

export async function discoverServer() {
  // Only probe for a local server when the web app itself runs on localhost.
  // On production use a same-origin relative base ('') so /api/* is proxied by Vercel
  // to Railway (next.config rewrites) — the browser never resolves *.up.railway.app,
  // which some ISPs (e.g. Jio) fail to resolve on mobile data.
  if (typeof window !== 'undefined'
      && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    setBaseUrl('');
    return;
  }
  const localAvailable = await probeUrl(LOCAL_URL);
  if (localAvailable) {
    setBaseUrl(LOCAL_URL);
    console.log('[API] Using local server:', LOCAL_URL);
  } else {
    setBaseUrl(RAILWAY_URL);
    console.log('[API] Local server not found, using Railway:', RAILWAY_URL);
  }
}
