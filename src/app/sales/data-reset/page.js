'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';

const RED = '#DC2626';

// Trial-data reset (admin only). Wipes transactional CRM data and resets plots —
// keeps company, users, projects, plot definitions, sources and config.
const ITEMS = [
  ['leads', 'Leads'],
  ['lead_history', 'Lead history'],
  ['follow_ups', 'Follow-ups'],
  ['site_visits', 'Site visits'],
  ['bookings', 'Bookings'],
  ['closures', 'Closures / conversions'],
  ['distribution_log', 'Distribution log'],
  ['availability', 'Availability records'],
  ['notifications', 'Notifications'],
  ['plots_to_reset', 'Plots to reset → available'],
];

export default function DataResetPage() {
  const user = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const cq = (sep) => (companyId ? `${sep}company_id=${companyId}` : '');

  const isAdmin = !!(user && (user.is_staff || user.role === 'Admin'));

  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [withAttendance, setWithAttendance] = useState(false);
  const [withLoi, setWithLoi] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(SALES_ENDPOINTS.dataReset + cq('?'), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setCounts(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { if (isAdmin) load(); else setLoading(false); }, [load, isAdmin]);

  const total = counts ? Object.entries(counts).reduce((a, [k, v]) => a + (k === 'plots_to_reset' ? 0 : v), 0) : 0;

  async function doReset() {
    if (confirmText !== 'DELETE') return;
    if (!window.confirm('This permanently deletes all trial leads, bookings, closures and related data for this company. This cannot be undone. Continue?')) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch(SALES_ENDPOINTS.dataReset + cq('?'), {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ confirm: 'DELETE', with_attendance: withAttendance, with_loi_files: withLoi }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setMsg('✅ Trial data cleared. Your CRM is now a clean slate.'); setConfirmText(''); load(); }
      else setMsg('Error: ' + (d.detail || res.status));
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  if (!isAdmin) {
    return <div style={{ padding: 40, color: '#8492A6' }}>Admin access only.</div>;
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 680 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Data Reset</h1>
      <p style={{ fontSize: 13, color: '#8492A6', marginBottom: 20 }}>
        Clear trial CRM data before go-live. This <b>keeps</b> your company, users, projects, plot
        definitions, lead sources and configuration — it only deletes transactional data and resets plots.
      </p>

      {/* What will be deleted */}
      <div style={{ background: '#fff', border: '1px solid #E6EBF4', borderRadius: 14, padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12 }}>
          What will be cleared {loading ? '…' : ''}
        </div>
        {loading ? <p style={{ color: '#8492A6', fontSize: 13 }}>Loading counts…</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 18px' }}>
            {ITEMS.map(([k, label]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
                <span>{label}</span>
                <span style={{ fontWeight: 800, color: (counts?.[k] || 0) > 0 ? (k === 'plots_to_reset' ? '#2E7D32' : RED) : '#9CA3AF' }}>{counts?.[k] ?? 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Options */}
      <div style={{ background: '#fff', border: '1px solid #E6EBF4', borderRadius: 14, padding: 18, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={withLoi} onChange={(e) => setWithLoi(e.target.checked)} />
          Also delete signed LOI PDFs from storage
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={withAttendance} onChange={(e) => setWithAttendance(e.target.checked)} />
          Also clear attendance & leave records
        </label>
      </div>

      {/* Danger zone */}
      <div style={{ background: '#FEF2F2', border: `1.5px solid ${RED}`, borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: RED, marginBottom: 6 }}>⚠️ Danger zone — this cannot be undone</div>
        <p style={{ fontSize: 13, color: '#7F1D1D', marginBottom: 12 }}>
          Take a Railway database backup first. Then type <b>DELETE</b> to enable the button.
        </p>
        <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE"
          style={{ width: '100%', maxWidth: 240, height: 40, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${RED}66`, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }} />
        <div>
          <button onClick={doReset} disabled={confirmText !== 'DELETE' || busy}
            style={{ padding: '11px 22px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 800,
              background: (confirmText === 'DELETE' && !busy) ? RED : '#F3B4B4', color: '#fff',
              cursor: (confirmText === 'DELETE' && !busy) ? 'pointer' : 'not-allowed' }}>
            {busy ? 'Clearing…' : `Permanently delete ${total} records`}
          </button>
        </div>
        {!!msg && <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: msg[0] === '✅' ? '#15803D' : RED }}>{msg}</p>}
      </div>
    </div>
  );
}
