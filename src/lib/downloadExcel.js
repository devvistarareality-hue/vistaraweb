import { authHeaders } from '../constants/api';
import { explainApiError, explainNetworkError } from './apiError';

// Download an Excel file the server builds (Leads, Site Visits …). Sent with the
// person's sign-in, saved under the name the server gives it. Returns '' when it
// worked, or the reason it did not — the server's own words when it refused.
export async function downloadExcel(url, fallbackName = 'export.xlsx') {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return explainApiError(res, body, 'Could not download the file.');
    }
    const cd = res.headers.get('Content-Disposition') || '';
    const name = (cd.match(/filename="?([^";]+)"?/) || [])[1] || fallbackName;
    const href = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60000);
    return '';
  } catch (e) {
    return explainNetworkError(e);
  }
}

// Who sees the Download Excel button on Leads and Site Visits: granted per person in
// User Management (Download leads & site visits Excel), and admins.
export const canExportLeads = (user) => !!(user && (user.can_export_leads || user.role === 'Admin' || user.is_staff));
