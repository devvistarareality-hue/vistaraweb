'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, loiHref } from '../../../constants/api';

function authHeaders() {
  const t = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` };
}

const TABS = [['pending', 'Pending'], ['sold', 'Approved'], ['rejected', 'Rejected'], ['', 'All']];

export default function BookingsPage() {
  const router = useRouter();
  const me = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const cq = (sep) => (companyId ? `${sep}company_id=${companyId}` : '');
  const isApprover = me?.role === 'Admin' || me?.role === 'Manager' || me?.is_staff;
  const isAdmin = me?.role === 'Admin' || me?.is_staff;
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [managers, setManagers] = useState([]);
  const [projects, setProjects] = useState([]);   // each carries booking_approvers
  const [cfgOpen, setCfgOpen] = useState(false);
  const [savedCfg, setSavedCfg] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    fetch(SALES_ENDPOINTS.distSettings + cq('?'), { headers: authHeaders() }).then(r => r.json()).then((d) => setManagers(d.managers || [])).catch(() => {});
    fetch(SALES_ENDPOINTS.projects + cq('?'), { headers: authHeaders() }).then(r => r.json()).then((d) => setProjects(Array.isArray(d) ? d : [])).catch(() => {});
  }, [isAdmin, companyId]);

  async function toggleApprover(projId, mgrId) {
    let next = [];
    setProjects((ps) => ps.map((p) => {
      if (p.id !== projId) return p;
      const arr = p.booking_approvers || [];
      next = arr.includes(mgrId) ? arr.filter((x) => x !== mgrId) : [...arr, mgrId];
      return { ...p, booking_approvers: next };
    }));
    await fetch(SALES_ENDPOINTS.project(projId) + cq('?'), { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ booking_approvers: next }) }).catch(() => {});
    setSavedCfg('Saved ✓'); setTimeout(() => setSavedCfg(''), 1500);
  }

  function load() {
    setLoading(true);
    const q = '?' + [tab ? `status=${tab}` : '', companyId ? `company_id=${companyId}` : ''].filter(Boolean).join('&');
    fetch(SALES_ENDPOINTS.bookings + q, { headers: authHeaders() })
      .then((r) => r.json()).then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, [tab, companyId]);

  async function act(id, action) {
    setBusy(id);
    await fetch(`${SALES_ENDPOINTS.bookings}${id}/action/${cq('?')}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action }) }).catch(() => {});
    setBusy(null); load();
  }

  const rupee = (n) => '₹ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

  return (
    <div style={{ padding: '24px 28px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Bookings &amp; Approvals</h1>
      <p style={{ fontSize: 13, color: '#8492A6', marginBottom: 16 }}>{rows.length} {tab || 'total'} bookings</p>

      {isAdmin && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(184,196,214,0.18)' }}>
          <button onClick={() => setCfgOpen((o) => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#3D5AFE', padding: 0 }}>
            ⚙ Booking Approvers — by project {cfgOpen ? '▴' : '▾'} {savedCfg && <span style={{ color: '#15803D', fontWeight: 700 }}> {savedCfg}</span>}
          </button>
          {cfgOpen && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: '#8492A6', marginBottom: 8 }}>For each project, pick the managers who approve its bookings. They get a push notification on each new booking for that project.</div>
              {managers.length === 0 ? <div style={{ fontSize: 13, color: '#8492A6' }}>No managers in this company.</div> : projects.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderTop: '1px solid #F0F3FA' }}>
                  <div style={{ width: 180, minWidth: 180, fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{p.name}</div>
                  <ApproverDropdown project={p} managers={managers} onToggle={toggleApprover} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: tab === k ? '#3D5AFE' : '#EEF1F7', color: tab === k ? '#fff' : '#8492A6' }}>{label}</button>
        ))}
      </div>

      {loading ? <p style={{ color: '#8492A6' }}>Loading…</p> : rows.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8492A6', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' }}>No bookings here.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((b) => (
            <div key={b.id} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>
                    {b.client_name || '—'} {b.revision_no > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: 20 }}>R{b.revision_no}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#8492A6', marginTop: 2 }}>{b.phone} · {b.project_name} · Unit {b.plot_number || b.area}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>STM: {b.stm_name || '—'} · Booked {b.booking_date || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0D47A1' }}>{rupee(b.final_amount)}</div>
                  <span style={statusPill(b.status)}>{(b.approval_status || b.status || '').toUpperCase()}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                {b.loi_document && <a href={loiHref(b.loi_document)} target="_blank" rel="noreferrer" style={linkBtn}>📄 Signed LOI</a>}
                {b.status === 'pending' && isApprover && (
                  <>
                    <button onClick={() => act(b.id, 'approve')} disabled={busy === b.id} style={{ ...actBtn, background: '#16A34A' }}>✓ Approve</button>
                    <button onClick={() => act(b.id, 'reject')} disabled={busy === b.id} style={{ ...actBtn, background: '#DC2626' }}>✕ Reject</button>
                  </>
                )}
                {b.status === 'sold' && (
                  <button onClick={() => router.push(`/sales/booking?revise=${b.id}`)} style={{ ...actBtn, background: '#7C3AED' }}>↻ Revise LOI</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApproverDropdown({ project, managers, onToggle }) {
  const [open, setOpen] = useState(false);
  const sel = project.booking_approvers || [];
  const selNames = managers.filter((m) => sel.includes(m.id)).map((m) => m.name);
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 460 }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E0E6F0', background: '#fff', cursor: 'pointer',
        fontSize: 13, color: selNames.length ? '#1A1A2E' : '#9CA3AF', textAlign: 'left',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: selNames.length ? 600 : 400 }}>
          {selNames.length ? selNames.join(', ') : 'Select approvers…'}
        </span>
        <span style={{ color: '#8492A6', flexShrink: 0 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30, background: '#fff',
            border: '1px solid #E4E8F0', borderRadius: 10, boxShadow: '0 10px 30px rgba(90,110,150,0.18)', maxHeight: 260, overflowY: 'auto', padding: 4 }}>
            {managers.map((m) => {
              const on = sel.includes(m.id);
              return (
                <div key={m.id} onClick={() => onToggle(project.id, m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 7, cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F5F7FC'} onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#fff', background: on ? '#3D5AFE' : '#fff', border: `1.5px solid ${on ? '#3D5AFE' : '#CBD5E1'}` }}>{on ? '✓' : ''}</span>
                  <span style={{ fontSize: 13, color: '#1A1A2E', fontWeight: 600 }}>{m.name}</span>
                  {m.designation && <span style={{ fontSize: 11, color: '#8492A6' }}>· {m.designation}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function statusPill(s) {
  const map = { pending: ['#B45309', '#FEF3C7'], sold: ['#15803D', '#E8F5E9'], rejected: ['#DC2626', '#FEE2E2'], hold: ['#B45309', '#FEF3C7'] };
  const [c, bg] = map[s] || ['#6B7280', '#F3F4F6'];
  return { display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 800, color: c, background: bg, padding: '3px 9px', borderRadius: 20 };
}
const actBtn = { padding: '8px 16px', borderRadius: 8, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const linkBtn = { padding: '8px 14px', borderRadius: 8, border: '1.5px solid #C7D2FE', color: '#3D5AFE', fontSize: 13, fontWeight: 700, textDecoration: 'none' };
