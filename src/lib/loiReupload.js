// A booking's signed LOI that is missing from storage (lost, never stored) can be put
// back from wherever it is opened: say so, pick the signed file, upload, open it.
import { SALES_ENDPOINTS, authHeaders } from '../constants/api';
import { notify, confirmDialog } from './notify';

const MAX_MB = 100;

function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Upload the signed LOI for a booking again. Resolves true once it is stored.
export async function reuploadLoi(id) {
  const file = await pickFile();
  if (!file) return false;
  if (file.size > MAX_MB * 1024 * 1024) { notify(`The file is over ${MAX_MB} MB.`, 'error'); return false; }
  notify('Uploading the signed LOI…', 'info');
  try {
    const data = await toBase64(file);
    const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(id), {
      method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ loi_file: { name: file.name, type: file.type, data } }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notify(d.detail || 'Could not upload the signed LOI.', 'error'); return false; }
    notify('Signed LOI uploaded', 'success');
    return true;
  } catch {
    notify('Could not upload the signed LOI.', 'error');
    return false;
  }
}

// After a failed open: when the LOI is missing, offer to upload it again (and open it
// once it is back); otherwise show what went wrong.
export async function loiOpenFailed(id, d, fallback = 'Could not open the LOI.') {
  if (d?.code !== 'loi_missing') { notify(d?.detail || fallback, 'error'); return; }
  const ok = await confirmDialog(`${d.detail} Do you have the signed copy? Upload it now and it is saved on this booking.`,
    { title: 'Signed LOI missing', confirmText: 'Upload signed LOI' });
  if (!ok || !(await reuploadLoi(id))) return;
  const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(id), { headers: authHeaders() }).catch(() => null);
  const again = r ? await r.json().catch(() => ({})) : {};
  if (r?.ok && again.url) window.open(again.url, '_blank', 'noopener,noreferrer');
}
