const SUPABASE_URL  = 'https://lftvumbhogcixihjydwx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdHZ1bWJob2djaXhpaGp5ZHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTE1MDMsImV4cCI6MjA5NzI2NzUwM30.BXi352GOwxIJDEafjZD-fLFE-SwcmmAFZCCiPX9sNTg';
const BUCKET = 'erp-media';

export async function uploadToSupabase(file, folder = 'erp/media', onProgress) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  onProgress?.(10);

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'apikey': SUPABASE_ANON,
        'Content-Type': file.type,
        'Cache-Control': '3600',
      },
      body: file,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Upload failed (${res.status})`);
  }

  onProgress?.(100);

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  return { url: publicUrl, path };
}

export async function deleteFromSupabase(path) {
  if (!path) return;
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON}`, 'apikey': SUPABASE_ANON },
    });
  } catch {}
}

export function extractStoragePath(url) {
  if (!url || !url.includes('supabase')) return null;
  const m = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/);
  return m ? decodeURIComponent(m[1].split('?')[0]) : null;
}
