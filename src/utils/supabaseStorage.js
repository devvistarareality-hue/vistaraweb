// Uploads/deletes now go through the backend (service-role key) instead of using
// the public anon key directly — so the Supabase anon INSERT policy can be revoked.
import { SALES_ENDPOINTS } from '../constants/api';

function authToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
}

export async function uploadToSupabase(file, folder = 'erp/media', onProgress) {
  onProgress?.(10);
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  // Note: no Content-Type header — the browser sets the multipart boundary.
  const res = await fetch(SALES_ENDPOINTS.mediaUpload, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken()}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed (${res.status})`);
  }
  onProgress?.(100);
  const data = await res.json();
  return { url: data.url, path: data.path };
}

export async function deleteFromSupabase(path) {
  if (!path) return;
  try {
    await fetch(SALES_ENDPOINTS.mediaDelete, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken()}` },
      body: JSON.stringify({ path }),
    });
  } catch {}
}

export function extractStoragePath(url) {
  if (!url || !url.includes('supabase')) return null;
  const m = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/);
  return m ? decodeURIComponent(m[1].split('?')[0]) : null;
}
