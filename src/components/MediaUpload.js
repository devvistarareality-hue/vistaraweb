'use client';
import { useRef, useState } from 'react';
import { uploadToSupabase, deleteFromSupabase, extractStoragePath } from '../utils/supabaseStorage';

const isImage = (url) => url && /\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(url);
const isPdf   = (url) => url && /\.pdf(\?|$)/i.test(url);

export default function MediaUpload({ label, value, onChange, folder = 'erp/media', accept = 'image/*,application/pdf', hint }) {
  const fileRef   = useRef();
  const [progress, setProgress] = useState(null);
  const [error,    setError]    = useState('');

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const maxMb = 30;
    if (file.size > maxMb * 1024 * 1024) { setError(`Max ${maxMb}MB`); return; }
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
      {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 6 }}>{label}</label>}

      {value ? (
        <div style={{ border: '1.5px solid #E0E6F0', borderRadius: 10, overflow: 'hidden', background: '#FAFBFF' }}>
          {isImage(value) ? (
            <div style={{ position: 'relative' }}>
              <img src={value} alt="preview" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
              <button onClick={handleRemove}
                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>
          ) : isPdf(value) ? (
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>📄</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E' }}>PDF Uploaded</div>
                  <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#3D5AFE' }}>View PDF ↗</a>
                </div>
              </div>
              <button onClick={handleRemove} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Remove</button>
            </div>
          ) : (
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#3D5AFE', wordBreak: 'break-all' }}>
                {value.split('/').pop()?.split('?')[0] || 'View file ↗'}
              </a>
              <button onClick={handleRemove} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>Remove</button>
            </div>
          )}
        </div>
      ) : (
        <div onClick={() => !progress && fileRef.current?.click()}
          style={{
            border: '2px dashed #C8D5E8', borderRadius: 10, minHeight: 90,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 6, cursor: progress ? 'default' : 'pointer', background: '#FAFBFF',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => !progress && (e.currentTarget.style.borderColor = '#3D5AFE')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#C8D5E8')}
        >
          {progress !== null ? (
            <>
              <div style={{ width: '70%', height: 5, background: '#E0E6F0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#3D5AFE,#7C3AED)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: 11, color: '#8492A6' }}>Uploading… {progress}%</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 22 }}>☁</span>
              <span style={{ fontSize: 12, color: '#8492A6', fontWeight: 500 }}>{hint || 'Click to upload'}</span>
              <span style={{ fontSize: 11, color: '#B0BAC9' }}>Images or PDF up to 30MB</span>
            </>
          )}
        </div>
      )}

      {error && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{error}</p>}
      <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}
