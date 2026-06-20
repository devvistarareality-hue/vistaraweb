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
  const localAvailable = await probeUrl(LOCAL_URL);
  if (localAvailable) {
    setBaseUrl(LOCAL_URL);
    console.log('[API] Using local server:', LOCAL_URL);
  } else {
    setBaseUrl(RAILWAY_URL);
    console.log('[API] Local server not found, using Railway:', RAILWAY_URL);
  }
}
