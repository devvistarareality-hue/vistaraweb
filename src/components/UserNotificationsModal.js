'use client';
// One person's notification settings, from User Management. Each kind follows their
// designation ("Default") unless set here on purpose — e.g. turn pushes off for one
// person without changing everyone with the same title.
import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import NotificationPrefsEditor from './NotificationPrefsEditor';
import { DESIGNATION_ENDPOINTS, USER_ENDPOINTS } from '../constants/api';
import { apiFetch } from '../utils/apiFetch';

export default function UserNotificationsModal({ user, onClose }) {
  const [catalogue, setCatalogue] = useState(null);
  const [data, setData] = useState(null);
  const [value, setValue] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiFetch(DESIGNATION_ENDPOINTS.capabilities).then((r) => r.json()).then(setCatalogue)
      .catch(() => setErr('Could not load the notification list.'));
    apiFetch(USER_ENDPOINTS.notifications(user.id)).then((r) => r.json())
      .then((d) => { setData(d); setValue(d.overrides || {}); })
      .catch(() => setErr('Could not load this person’s settings.'));
  }, [user.id]);

  async function save() {
    setSaving(true); setErr('');
    try {
      const r = await apiFetch(USER_ENDPOINTS.notifications(user.id), {
        method: 'PATCH', body: JSON.stringify({ notification_overrides: value }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.detail || 'Could not save.'); return; }
      onClose();
    } catch {
      setErr('Could not save. Check your connection.');
    } finally { setSaving(false); }
  }

  const ready = catalogue && data;
  return (
    <div className="ar-backdrop" onClick={() => !saving && onClose()}>
      <div className="nx-card nx-modal perm-modal" onClick={(e) => e.stopPropagation()}>
        <header className="perm-head">
          <span className="perm-head-icon"><Bell size={18} /></span>
          <div className="perm-head-text">
            <h2>{user.name} — Notifications</h2>
            <p>{data?.designation_name ? `Follows ${data.designation_name} unless set here` : 'No designation — set what they get here'}</p>
          </div>
          <button type="button" className="perm-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        {err && <div className="nx-note bad">{String(err)}</div>}
        <div className="perm-body">
          {!ready ? <div className="act-empty">Loading…</div> : (
            <NotificationPrefsEditor kinds={catalogue.notifications || []} fallback={catalogue.notification_default}
              value={value} onChange={setValue} inherit={data.designation || {}}
              inheritLabel={data.designation_name || 'the designation'} />
          )}
        </div>
        <footer className="perm-foot">
          <p className="perm-summary">{Object.keys(value).length} set for this person · the rest follow the designation</p>
          <div className="perm-foot-btns">
            <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="nx-btn nx-btn-md nx-btn-primary" onClick={save} disabled={saving || !ready}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
