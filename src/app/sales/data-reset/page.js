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
  // Which categories to clear — default all ticked (matches the old "wipe all" behaviour).
  const [selected, setSelected] = useState(() => new Set(ITEMS.map(([k]) => k)));
  const toggle = (k) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const allOn = selected.size === ITEMS.length;
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(ITEMS.map(([k]) => k)));
  // Deleting leads cascades their children in the DB — show those as implied.
  const CASCADE = ['closures', 'site_visits', 'follow_ups', 'lead_history'];
  const implied = (k) => selected.has('leads') && CASCADE.includes(k);

  const load = useCallback(() => {
    setLoading(true);
    fetch(SALES_ENDPOINTS.dataReset + cq('?'), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setCounts(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { if (isAdmin) load(); else setLoading(false); }, [load, isAdmin]);

  // Count of records that will actually be removed = ticked categories (+ implied
  // cascade children when Leads is ticked), excluding the plot-reset row.
  const willClear = (k) => (selected.has(k) || implied(k)) && k !== 'plots_to_reset';
  const total = counts ? Object.entries(counts).reduce((a, [k, v]) => a + (willClear(k) ? v : 0), 0) : 0;
  const nothingSelected = selected.size === 0;

  async function doReset() {
    if (confirmText !== 'DELETE' || nothingSelected) return;
    if (!window.confirm('This permanently deletes the selected trial data for this company. This cannot be undone. Continue?')) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch(SALES_ENDPOINTS.dataReset + cq('?'), {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ confirm: 'DELETE', targets: [...selected], with_attendance: withAttendance, with_loi_files: withLoi }),
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

      {/* Select what to clear */}
      <div style={{ background: '#fff', border: '1px solid #E6EBF4', borderRadius: 14, padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: '#9CA3AF', textTransform: 'uppercase' }}>
            Select what to clear {loading ? '…' : ''}
          </div>
          {!loading && (
            <button onClick={toggleAll}
              style={{ fontSize: 12, fontWeight: 700, color: '#3D5AFE', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {allOn ? 'Clear all' : 'Select all'}
            </button>
          )}
        </div>
        {loading ? <p style={{ color: '#8492A6', fontSize: 13 }}>Loading counts…</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 18px' }}>
            {ITEMS.map(([k, label]) => {
              const isImplied = implied(k) && !selected.has(k);
              const checked = selected.has(k) || isImplied;
              return (
                <label key={k} title={isImplied ? 'Deleted together with Leads' : ''}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13,
                    color: '#374151', cursor: isImplied ? 'not-allowed' : 'pointer', padding: '5px 0', opacity: isImplied ? 0.7 : 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <input type="checkbox" checked={checked} disabled={isImplied} onChange={() => toggle(k)} />
                    {label}{isImplied && <span style={{ fontSize: 10, color: '#9CA3AF' }}>(via Leads)</span>}
                  </span>
                  <span style={{ fontWeight: 800, color: (counts?.[k] || 0) > 0 ? (k === 'plots_to_reset' ? '#2E7D32' : RED) : '#9CA3AF' }}>{counts?.[k] ?? 0}</span>
                </label>
              );
            })}
          </div>
        )}
        {!loading && selected.has('leads') && (
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
            Deleting <b>Leads</b> also removes their history, follow-ups, site visits &amp; closures.
          </p>
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
          {(() => {
            const ready = confirmText === 'DELETE' && !busy && !nothingSelected;
            return (
              <button onClick={doReset} disabled={!ready}
                style={{ padding: '11px 22px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 800,
                  background: ready ? RED : '#F3B4B4', color: '#fff', cursor: ready ? 'pointer' : 'not-allowed' }}>
                {busy ? 'Clearing…' : nothingSelected ? 'Select at least one item' : `Permanently delete ${total} records`}
              </button>
            );
          })()}
        </div>
        {!!msg && <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: msg[0] === '✅' ? '#15803D' : RED }}>{msg}</p>}
      </div>
    </div>
  );
}
