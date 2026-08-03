import { pdfToImageBlob } from './pdfToImage';
import { uploadToSupabase } from './supabaseStorage';

/* Architects hand over plans as PDFs, so every plan picker accepts them — but plans
   are displayed as <img> (in setup and to the buyer picking a unit), so render the
   first page to PNG and store that instead. Returns the original URL unchanged for
   images, and falls back to the PDF if rendering fails: keeping an un-previewable
   upload beats losing it. */
export async function toPlanImage(url, folder, name) {
  if (!/\.pdf(\?|$)/i.test(url || '')) return { url, converted: false };
  try {
    const blob = await pdfToImageBlob(url, 2);
    const file = new File([blob], `${name}.png`, { type: 'image/png' });
    const up = await uploadToSupabase(file, folder);
    return { url: up.url, converted: true };
  } catch (err) {
    return { url, converted: false, error: err.message || 'unknown error' };
  }
}
