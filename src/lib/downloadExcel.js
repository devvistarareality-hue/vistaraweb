import { authHeaders, getBaseUrl } from '../constants/api';
import { explainApiError, explainNetworkError } from './apiError';

// Download an Excel file the server builds (Leads, Site Visits …), sent with the
// person's sign-in. A big list is built in the background on the server (see
// backend sales/exports.py): the first call answers at once with a job, which is
// polled until the file is ready, reporting progress through onProgress(done, total).
// Returns '' when it worked, or the reason it did not — the server's own words when
// it refused.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function saveBlob(res, fallbackName) {
  const cd = res.headers.get('Content-Disposition') || '';
  const name = (cd.match(/filename="?([^";]+)"?/) || [])[1] || fallbackName;
  const href = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}

export async function downloadExcel(url, fallbackName = 'export.xlsx', onProgress) {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return explainApiError(res, body, 'Could not download the file.');
    }
    if (res.status !== 202) { await saveBlob(res, fallbackName); return ''; }

    const { job, total, filename } = await res.json();
    onProgress?.(0, total);
    const statusUrl = `${getBaseUrl()}/api/sales/exports/${job}/`;
    for (let i = 0; i < 600; i += 1) {          // up to ~20 minutes
      await sleep(2000);
      const s = await fetch(statusUrl, { headers: authHeaders() });
      const st = await s.json().catch(() => ({}));
      if (!s.ok) return explainApiError(s, st, 'Could not download the file.');
      onProgress?.(st.done || 0, st.total || total);
      if (st.status === 'error') return st.detail || 'Could not build the file.';
      if (st.status === 'done') {
        const f = await fetch(`${statusUrl}file/`, { headers: authHeaders() });
        if (!f.ok) {
          const body = await f.json().catch(() => ({}));
          return explainApiError(f, body, 'Could not download the file.');
        }
        await saveBlob(f, filename || fallbackName);
        return '';
      }
    }
    return 'The file is taking too long to build. Narrow the filters and try again.';
  } catch (e) {
    return explainNetworkError(e);
  }
}

// Who sees the Download Excel button on Leads and Site Visits: granted per person in
// User Management (Download leads & site visits Excel), and admins.
export const canExportLeads = (user) => !!(user && (user.can_export_leads || user.role === 'Admin' || user.is_staff));
