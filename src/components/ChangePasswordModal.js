'use client';
import { useState } from 'react';
import { AUTH_ENDPOINTS, authHeaders } from '../constants/api';

// Self-contained "change my password" modal. Opened from the profile popovers.
export default function ChangePasswordModal({ open, onClose, onSuccess }) {
  const [cur, setCur]   = useState('');
  const [nw, setNw]     = useState('');
  const [conf, setConf] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState(null); // { type: 'ok'|'err', text }

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (nw.length < 6) { setMsg({ type: 'err', text: 'New password must be at least 6 characters.' }); return; }
    if (nw !== conf)   { setMsg({ type: 'err', text: 'New passwords do not match.' }); return; }
    setBusy(true);
    try {
      const res = await fetch(AUTH_ENDPOINTS.changePassword, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ current_password: cur, new_password: nw }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        // Password change invalidates all sessions (web + app) → sign out & re-login.
        setMsg({ type: 'ok', text: 'Password changed. Please sign in again…' });
        setCur(''); setNw(''); setConf('');
        setTimeout(() => (onSuccess ? onSuccess() : onClose()), 1400);
      }
      else setMsg({ type: 'err', text: d.detail || 'Could not change password.' });
    } catch { setMsg({ type: 'err', text: 'Could not change password.' }); }
    setBusy(false);
  };

  const inp = { width: '100%', padding: '10px 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none', marginBottom: 10 };
  const disabled = busy || !cur || !nw || !conf;

  return (
    <div className="nx-modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="nx-modal" onClick={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: '100%', background: 'var(--surface)', borderRadius: 20, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Change Password</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>Enter your current password and choose a new one.</div>
        <form onSubmit={submit}>
          <input className="nx-input" type="password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} style={inp} autoFocus />
          <input className="nx-input" type="password" placeholder="New password" value={nw} onChange={(e) => setNw(e.target.value)} style={inp} />
          <input className="nx-input" type="password" placeholder="Confirm new password" value={conf} onChange={(e) => setConf(e.target.value)} style={inp} />
          {msg && <div style={{ fontSize: 12, fontWeight: 600, color: msg.type === 'ok' ? 'var(--success)' : 'var(--danger)', marginBottom: 10 }}>{msg.text}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="nx-btn nx-btn-md nx-btn-secondary" type="button" onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button className="nx-btn nx-btn-md nx-btn-primary" type="submit" disabled={disabled} style={{ flex: 1, padding: '10px 0', borderRadius: 14, border: 'none', background: 'var(--strong)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Change Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
