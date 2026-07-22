'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';


function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const SV_COLOR = { scheduled: '#F9A825', completed: '#2E7D32', no_show: '#B71C1C', cancelled: '#9E9E9E' };
const TABS = [
  { key: 'today',     label: "Today's" },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'no_show',   label: 'No Show' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all',       label: 'All' },
];

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const endOfToday   = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };

const lbl = { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'block' };
const inp = { width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none', background: '#FAFAFA' };
const btnPrimary = { padding: '9px 16px', background: 'linear-gradient(135deg, #182350 0%, #3D5AFE 100%)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const smBtn = (bg, color, border) => ({ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${border}`, color, background: bg, cursor: 'pointer' });

export function SiteVisitsContent({ adminView = false }) {
  const router    = useRouter();
  const user      = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);

  // Record Closure now opens the project picker → unit map flow. Stash the site
  // visit so the closure step can POST against the right lead/SV after the STM
  // picks an available unit. sessionStorage survives the client-side navigation.
  function startClosure(sv) {
    try { sessionStorage.setItem('closure_sv', JSON.stringify(sv)); } catch (_) {}
    router.push(`/sales/closure?sv=${sv.id}`);
  }
  const [visits,  setVisits]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('today');
  // Allow deep-linking to a tab (e.g. dashboard Site Visits card → ?tab=completed).
  // Read in an effect — window.location isn't committed yet when a lazy useState
  // initializer runs during Next client navigation.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (['today', 'scheduled', 'completed', 'no_show', 'cancelled', 'all'].includes(t)) setFilter(t);
  }, []);

  // schedule modal
  const [schedOpen, setSchedOpen] = useState(false);
  const [leads,     setLeads]     = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [form,      setForm]      = useState({ lead: '', project: '', scheduled_at: '' });
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');

  // closure modal
  const [closureSv, setClosureSv] = useState(null);
  const [closure,   setClosure]   = useState({ closure_date: new Date().toISOString().slice(0, 10), unit_no: '', unit_type: '', booking_amount: '', total_amount: '', remarks: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = adminView ? `${SALES_ENDPOINTS.siteVisits}?admin_view=1` : SALES_ENDPOINTS.siteVisits;
      const res = await fetch(url, { headers: authHeaders() });
      if (res.ok) setVisits(await res.json());
    } catch (_) {}
    setLoading(false);
  }, [companyId, adminView]);

  useEffect(() => { load(); }, [load]);

  async function openSchedule() {
    setErr('');
    setForm({ lead: '', project: '', scheduled_at: '' });
    setSchedOpen(true);
    // Load the STM's own leads + active projects for the pickers
    try {
      const [lRes, pRes] = await Promise.all([
        fetch(`${SALES_ENDPOINTS.leads}?page=1`, { headers: authHeaders() }),
        fetch(SALES_ENDPOINTS.projects, { headers: authHeaders() }),
      ]);
      if (lRes.ok) { const d = await lRes.json(); setLeads(Array.isArray(d) ? d : (d.results || [])); }
      if (pRes.ok) { const d = await pRes.json(); setProjects(Array.isArray(d) ? d : (d.results || [])); }
    } catch (_) {}
  }

  async function scheduleVisit() {
    if (!form.lead || !form.scheduled_at) { setErr('Lead and date & time are required.'); return; }
    setSaving(true); setErr('');
    const lead = leads.find((l) => String(l.id) === String(form.lead));
    try {
      const res = await fetch(SALES_ENDPOINTS.siteVisits, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          lead: form.lead,
          project: form.project || null,
          scheduled_at: form.scheduled_at,
          status: 'scheduled',
          stm: user?.id,
          referred_by_telecaller: lead?.telecaller || null,
        }),
      });
      if (res.ok) {
        // Keep the lead pipeline in sync
        await fetch(SALES_ENDPOINTS.lead(form.lead), {
          method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ stm_status: 'sv_scheduled' }),
        }).catch(() => {});
        setSchedOpen(false);
        load();
      } else {
        setErr(JSON.stringify(await res.json().catch(() => ({}))));
      }
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  async function updateStatus(sv, status) {
    const body = { status };
    if (status === 'completed') body.visited_at = new Date().toISOString();
    const res = await fetch(SALES_ENDPOINTS.siteVisit(sv.id), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body),
    });
    if (res.ok) {
      if (status === 'completed') {
        await fetch(SALES_ENDPOINTS.lead(sv.lead), {
          method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ stm_status: 'sv_done' }),
        }).catch(() => {});
      }
      const updated = await res.json();
      setVisits((list) => list.map((v) => (v.id === sv.id ? updated : v)));
    }
  }

  async function recordClosure() {
    if (!closure.booking_amount) { setErr('Booking amount is required.'); return; }
    setSaving(true); setErr('');
    const sv = closureSv;
    try {
      const res = await fetch(SALES_ENDPOINTS.closures, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          lead: sv.lead, site_visit: sv.id, project: sv.project || null,
          stm: sv.stm || user?.id, referred_by_telecaller: sv.referred_by_telecaller || null,
          status: 'booked',
          closure_date: closure.closure_date,
          unit_no: closure.unit_no, unit_type: closure.unit_type,
          booking_amount: closure.booking_amount,
          total_amount: closure.total_amount || null,
          remarks: closure.remarks,
        }),
      });
      if (res.ok) {
        await fetch(SALES_ENDPOINTS.lead(sv.lead), {
          method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ stm_status: 'closed' }),
        }).catch(() => {});
        setClosureSv(null);
        setClosure({ closure_date: new Date().toISOString().slice(0, 10), unit_no: '', unit_type: '', booking_amount: '', total_amount: '', remarks: '' });
        load();
      } else {
        setErr(JSON.stringify(await res.json().catch(() => ({}))));
      }
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  const visible = visits.filter((v) => {
    if (filter === 'all') return true;
    if (filter === 'today') {
      const at = new Date(v.scheduled_at);
      return v.status === 'scheduled' && at >= startOfToday() && at <= endOfToday();
    }
    return v.status === filter;
  });

  return (
    <div style={{ padding: '24px 28px', maxWidth: 920 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', margin: 0 }}>Site Visits</h1>
          <p style={{ fontSize: 13, color: '#8492A6', margin: '4px 0 0' }}>{visible.length} visit{visible.length === 1 ? '' : 's'}</p>
        </div>
        <button onClick={openSchedule} style={btnPrimary}>+ Schedule Visit</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E4E8F0', margin: '18px 0 20px', overflowX: 'auto' }}>
        {TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button key={t.key} onClick={() => setFilter(t.key)}
              style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', whiteSpace: 'nowrap',
                color: active ? '#3D5AFE' : '#8492A6', borderBottom: active ? '2px solid #3D5AFE' : '2px solid transparent' }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: '#8492A6', textAlign: 'center', padding: '40px 0' }}>Loading…</p>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#5A6B85', margin: 0 }}>No site visits</p>
          <p style={{ fontSize: 13, color: '#B0BAC9', margin: '4px 0 0' }}>Schedule one from your pipeline</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map((sv) => (
            <div key={sv.id} style={{ border: '1.5px solid #E4E8F0', background: '#fff', borderRadius: 12, padding: '14px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{sv.lead_name || 'Lead'}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'capitalize',
                    backgroundColor: (SV_COLOR[sv.status] || '#9E9E9E') + '18', color: SV_COLOR[sv.status] || '#9E9E9E' }}>
                    {(sv.status || '').replace('_', ' ')}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#8492A6', margin: '4px 0 0' }}>
                  {sv.lead_phone || ''}{sv.project_name ? ` · ${sv.project_name}` : ''}
                </p>
                {sv.referred_by_telecaller_name && <p style={{ fontSize: 11, color: '#B0BAC9', margin: '2px 0 0' }}>via TC: {sv.referred_by_telecaller_name}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', marginTop: 8, fontSize: 12, color: '#8492A6' }}>
                  <span>Scheduled: {fmtDateTime(sv.scheduled_at)}</span>
                  {sv.visited_at && <span>Visited: {fmtDateTime(sv.visited_at)}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
                {sv.status === 'scheduled' && (
                  <>
                    <button onClick={() => updateStatus(sv, 'completed')} style={smBtn('#fff', '#2E7D32', '#2E7D32')}>✓ Done</button>
                    <button onClick={() => updateStatus(sv, 'no_show')} style={smBtn('#fff', '#B45309', '#F59E0B')}>No Show</button>
                    <button onClick={() => updateStatus(sv, 'cancelled')} style={smBtn('#fff', '#9CA3AF', '#D1D5DB')}>Cancel</button>
                  </>
                )}
                {sv.status === 'completed' && (
                  <button onClick={() => startClosure(sv)} style={btnPrimary}>Record Closure</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Schedule Modal ── */}
      {schedOpen && (
        <Overlay onClose={() => setSchedOpen(false)}>
          <ModalCard title="Schedule Site Visit" onClose={() => setSchedOpen(false)}>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Lead *</label>
              <select value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">Select lead</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.phone}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Project</label>
              <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">Select project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Date &amp; Time *</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} style={inp} />
            </div>
            {err && <ErrBox>{err}</ErrBox>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button onClick={() => setSchedOpen(false)} style={{ padding: '9px 16px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={scheduleVisit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Schedule'}</button>
            </div>
          </ModalCard>
        </Overlay>
      )}

      {/* ── Closure Modal ── */}
      {closureSv && (
        <Overlay onClose={() => setClosureSv(null)}>
          <ModalCard title="Record Closure" onClose={() => setClosureSv(null)}>
            <p style={{ fontSize: 13, color: '#8492A6', margin: '0 0 14px' }}>{closureSv.lead_name} · {closureSv.lead_phone}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px', marginBottom: 12 }}>
              <div>
                <label style={lbl}>Closure Date *</label>
                <input type="date" value={closure.closure_date} onChange={(e) => setClosure({ ...closure, closure_date: e.target.value })} style={inp} />
              </div>
              <div>
                <label style={lbl}>Unit No.</label>
                <input value={closure.unit_no} onChange={(e) => setClosure({ ...closure, unit_no: e.target.value })} style={inp} placeholder="A-101" />
              </div>
              <div>
                <label style={lbl}>Unit Type</label>
                <input value={closure.unit_type} onChange={(e) => setClosure({ ...closure, unit_type: e.target.value })} style={inp} placeholder="2BHK" />
              </div>
              <div>
                <label style={lbl}>Booking Amount *</label>
                <input type="number" value={closure.booking_amount} onChange={(e) => setClosure({ ...closure, booking_amount: e.target.value })} style={inp} placeholder="₹" />
              </div>
              <div>
                <label style={lbl}>Total Amount</label>
                <input type="number" value={closure.total_amount} onChange={(e) => setClosure({ ...closure, total_amount: e.target.value })} style={inp} placeholder="₹" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Remarks</label>
              <textarea value={closure.remarks} onChange={(e) => setClosure({ ...closure, remarks: e.target.value })} rows={2}
                style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} placeholder="Notes…" />
            </div>
            {err && <ErrBox>{err}</ErrBox>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button onClick={() => setClosureSv(null)} style={{ padding: '9px 16px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={recordClosure} disabled={saving} style={{ padding: '9px 16px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Record Closure'}</button>
            </div>
          </ModalCard>
        </Overlay>
      )}
    </div>
  );
}

export default function SiteVisitsPage() {
  return <SiteVisitsContent />;
}

function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {children}
    </div>
  );
}

function ModalCard({ title, children, onClose }) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: '92%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(24,35,80,0.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F0F3FA' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E' }}>{title}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#B0BAC9', cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function ErrBox({ children }) {
  return <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#DC2626', wordBreak: 'break-word' }}>{children}</div>;
}
