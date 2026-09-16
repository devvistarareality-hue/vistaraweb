'use client';
import { useRef, useState } from 'react';
import { uploadToSupabase, deleteFromSupabase, extractStoragePath } from '../utils/supabaseStorage';

import Icon from './Icon';
const isImage = (url) => url && /\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(url);
const isPdf   = (url) => url && /\.pdf(\?|$)/i.test(url);
// Keep in step with MEDIA_UPLOAD_MAX_MB in sales/views.py — this check only fails fast
// before the upload starts; the server is the one that enforces it.
const MAX_MB = 100;

export default function MediaUpload({ label, value, onChange, folder = 'erp/media', accept = 'image/*,application/pdf', hint }) {
  const fileRef   = useRef();
  const [progress, setProgress] = useState(null);
  const [error,    setError]    = useState('');

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) { setError(`Max ${MAX_MB}MB`); return; }
    setError('');
    setProgress(10);
    try {
      const { url } = await uploadToSupabase(file, folder, p => setProgress(p));
      onChange(url);
    } catch (err) {
      setError('Upload failed: ' + (err.message || 'unknown error'));
    } finally {
      setProgress(null);
      e.target.value = '';
    }
  }

  async function handleRemove() {
    const path = extractStoragePath(value);
    if (path) deleteFromSupabase(path).catch(() => {});
    onChange('');
  }

  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{label}</label>}

      {value ? (
        <div style={{ border: '1.5px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--accent-softer)' }}>
          {isImage(value) ? (
            <div style={{ position: 'relative' }}>
              <img src={value} alt="preview" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
              <button onClick={handleRemove}
                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="x" />
              </button>
            </div>
          ) : isPdf(value) ? (
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}><Icon name="file" /></span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>PDF Uploaded</div>
                  <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)' }}>View PDF ↗</a>
                </div>
              </div>
              <button onClick={handleRemove} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Remove</button>
            </div>
          ) : (
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all' }}>
                {value.split('/').pop()?.split('?')[0] || 'View file ↗'}
              </a>
              <button onClick={handleRemove} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>Remove</button>
            </div>
          )}
        </div>
      ) : (
        <div onClick={() => !progress && fileRef.current?.click()}
          style={{
            border: '2px dashed var(--border-strong)', borderRadius: 14, minHeight: 90,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 6, cursor: progress ? 'default' : 'pointer', background: 'var(--accent-softer)',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => !progress && (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
        >
          {progress !== null ? (
            <>
              <div style={{ width: '70%', height: 5, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Uploading… {progress}%</span>
            </>
          ) : (
            <>
              <Icon name="upload" size={24} />
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{hint || 'Click to upload'}</span>
              {/* Describe what this picker will actually take — the file dialog is
                  filtered by `accept`, so promising PDF when it only allows images
                  reads as the upload being broken. */}
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>
                {accept.includes('pdf') ? 'Images or PDF' : 'Images'} up to {MAX_MB}MB
              </span>
            </>
          )}
        </div>
      )}

      {error && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{error}</p>}
      <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}
