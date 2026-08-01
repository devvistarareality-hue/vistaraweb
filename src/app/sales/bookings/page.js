'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, loiHref, authHeaders } from '../../../constants/api';


// Open the confidential LOI via a short-lived signed URL (never a public link).
async function openLoi(id) {
  try {
    const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(id), { headers: authHeaders() });
    const d = await r.json();
    if (r.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
    else alert('Could not open the LOI.');
  } catch { alert('Could not open the LOI.'); }
}

const TABS = [['pending', 'Pending'], ['sold', 'Approved'], ['rejected', 'Rejected'], ['', 'All']];

export function BookingsContent({ adminView = false }) {
  const router = useRouter();
  const me = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const cq = (sep) => (companyId ? `${sep}company_id=${companyId}` : '');
  const isApprover = me?.role === 'Admin' || me?.role === 'Manager' || me?.is_staff;
  const isAdmin = me?.role === 'Admin' || me?.is_staff || (me?.admin_modules || []).includes('Sales');
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [managers, setManagers] = useState([]);
  const [projects, setProjects] = useState([]);   // each carries booking_approvers
  const [cfgOpen, setCfgOpen] = useState(false);
  const [savedCfg, setSavedCfg] = useState('');
  const [openProj, setOpenProj] = useState({});   // project name → expanded?
  const toggleProj = (pn) => setOpenProj((o) => ({ ...o, [pn]: !o[pn] }));
  const [q, setQ] = useState('');
  const [toCancel, setToCancel] = useState(null);   // booking awaiting cancel confirmation

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
    const q = '?' + [tab ? `status=${tab}` : '', companyId ? `company_id=${companyId}` : '', adminView ? 'admin_view=1' : ''].filter(Boolean).join('&');
    fetch(SALES_ENDPOINTS.bookings + q, { headers: authHeaders() })
      .then((r) => r.json()).then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  // Collapse state is per project name, so reset it whenever the visible set changes.
  useEffect(() => { load(); setOpenProj({}); }, [tab, companyId, adminView]);

  async function act(id, action) {
    setBusy(id);
    await fetch(`${SALES_ENDPOINTS.bookings}${id}/action/${cq('?')}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action }) }).catch(() => {});
    setBusy(null); load();
  }

  // Cancelling an approved booking goes through its closure: that endpoint frees the
  // plot(s), purges the signed LOI from storage and marks the booking CANCELLED.
  // Irreversible, so it always runs behind the confirmation modal below.
  async function cancelBooking(b) {
    setBusy(b.id);
    try {
      const r = await fetch(SALES_ENDPOINTS.closureCancel(b.closure) + cq('?'), { method: 'POST', headers: authHeaders() });
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert('Cancel failed: ' + (d.detail || r.status)); }
    } catch (e) { alert(e.message); }
    setToCancel(null); setBusy(null); load();
  }

  const rupee = (n) => '₹ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

  // Search across client name, phone and the LOI/unit number. Phones are stored with
  // spaces ("81408 05999") so digit queries are compared digits-only; the LOI's stored
  // filename and the booking id are matched too, since either can be quoted as "LOI no".
  const ql = q.trim().toLowerCase();
  const qDigits = ql.replace(/\D/g, '');
  // Only treat the query as a phone/id when it is ALL digits and separators — otherwise
  // "shop1" would strip to "1" and match every phone containing a 1.
  const numericQuery = !!qDigits && /^[\d\s+()-]+$/.test(ql);
  const matches = (b) => {
    if (!ql) return true;
    const text = [b.client_name, b.plot_numbers, b.plot_number, b.area, b.loi_document];
    if (text.some((v) => String(v || '').toLowerCase().includes(ql))) return true;
    if (!numericQuery) return false;
    if (String(b.id) === qDigits) return true;
    // Need a few digits before matching phones, or "1" would hit almost everything.
    return qDigits.length >= 3 && String(b.phone || '').replace(/\D/g, '').includes(qDigits);
  };
  const visible = rows.filter(matches);

  // Project-wise grouping (same shape as the Accounts & Finance bookings view), but
  // applied to whichever tab is selected so approvers keep their per-booking actions.
  const groups = {};
  visible.forEach((b) => { const k = b.project_name || '—'; (groups[k] = groups[k] || []).push(b); });
  const projectNames = Object.keys(groups).sort();
  projectNames.forEach((pn) => groups[pn].sort((a, b) => String(b.booking_date || '').localeCompare(String(a.booking_date || ''))));
  const projectTotal = (pn) => groups[pn].reduce((s, b) => s + (Number(b.final_amount) || 0), 0);
  const grandTotal = projectNames.reduce((s, pn) => s + projectTotal(pn), 0);
  // Short lists (a handful of pending approvals) are more useful open than collapsed —
  // only make the user click through when there's actually a lot to scroll past.
  // Rejected is archival, though: always start it collapsed however few there are.
  // While searching, always open: hits are the point of the search.
  const autoOpen = !!ql || (tab !== 'rejected' && visible.length <= 10);
  const isOpen = (pn) => (openProj[pn] === undefined ? autoOpen : openProj[pn]);
  const tabLabel = (TABS.find(([k]) => k === tab) || ['', 'All'])[1];

  return (
    <div style={{ padding: '24px 28px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Bookings &amp; Approvals</h1>
      <p style={{ fontSize: 13, color: '#8492A6', marginBottom: 16 }}>
        {ql ? `${visible.length} of ${rows.length}` : rows.length} {tab || 'total'} bookings
      </p>

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

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: tab === k ? '#3D5AFE' : '#EEF1F7', color: tab === k ? '#fff' : '#8492A6' }}>{label}</button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8492A6', fontSize: 13 }}>🔍</span>
          {/* Collapse state is keyed by project, so drop it as the query changes —
              otherwise a group the user collapsed earlier would hide its own hits. */}
          <input value={q} onChange={(e) => { setQ(e.target.value); setOpenProj({}); }}
            placeholder="Search name, phone or LOI / unit no…"
            style={{ width: '100%', height: 36, padding: '0 32px 0 32px', borderRadius: 8, border: '1.5px solid #E0E6F0',
              background: '#fff', fontSize: 13, color: '#1A1A2E', boxSizing: 'border-box' }} />
          {!!q && (
            <button onClick={() => { setQ(''); setOpenProj({}); }} title="Clear search"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none',
                color: '#8492A6', fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
          )}
        </div>
      </div>

      {!loading && visible.length > 0 && (
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          background: 'linear-gradient(135deg,#3D5AFE,#1E3A8A)', borderRadius: 14, padding: '16px 20px', boxShadow: '0 2px 8px rgba(61,90,254,0.25)' }}>
          <div style={{ color: '#DBEAFE', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {ql ? 'Matching' : 'Total'} {tabLabel} · {visible.length} booking{visible.length === 1 ? '' : 's'} · {projectNames.length} project{projectNames.length === 1 ? '' : 's'}
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{rupee(grandTotal)}</div>
        </div>
      )}

      {loading ? <p style={{ color: '#8492A6' }}>Loading…</p> : visible.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8492A6', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' }}>
          {ql ? <>No bookings match “{q.trim()}”.</> : 'No bookings here.'}
        </div>
      ) : projectNames.map((pn) => (
        <div key={pn} style={{ marginBottom: 12 }}>
          <div onClick={() => toggleProj(pn)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff', borderRadius: 12,
              padding: '14px 18px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)', border: isOpen(pn) ? '1.5px solid #C7D2FE' : '1.5px solid transparent' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#3D5AFE', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              🏢 {pn} <span style={{ color: '#8492A6', fontWeight: 600 }}>· {groups[pn].length} booking{groups[pn].length === 1 ? '' : 's'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0D47A1' }}>{rupee(projectTotal(pn))}</span>
              <span style={{ color: '#8492A6', fontSize: 13, fontWeight: 800, transform: isOpen(pn) ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
            </div>
          </div>
          {isOpen(pn) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
              {groups[pn].map((b) => (
                <div key={b.id} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>
                        {b.client_name || '—'} {b.revision_no > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: 20 }}>R{b.revision_no}</span>}
                      </div>
                      {/* Project lives in the group header now — don't repeat it on every card. */}
                      <div style={{ fontSize: 12, color: '#8492A6', marginTop: 2 }}>{b.phone} · Unit {b.plot_numbers || b.plot_number || b.area}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>STM: {b.stm_name || '—'} · Booked {b.booking_date || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0D47A1' }}>{rupee(b.final_amount)}</div>
                      <span style={statusPill(b.status)}>{(b.approval_status || b.status || '').toUpperCase()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    {b.loi_document && <button onClick={() => openLoi(b.id)} style={{ ...linkBtn, background: '#fff', cursor: 'pointer' }}>📄 Signed LOI</button>}
                    {b.status === 'pending' && isApprover && (
                      <>
                        <button onClick={() => act(b.id, 'approve')} disabled={busy === b.id} style={{ ...actBtn, background: '#16A34A' }}>✓ Approve</button>
                        <button onClick={() => act(b.id, 'reject')} disabled={busy === b.id} style={{ ...actBtn, background: '#DC2626' }}>✕ Reject</button>
                      </>
                    )}
                    {b.status === 'sold' && (() => {
                      const isEoi = String(b.plot_numbers || '').toUpperCase().startsWith('EOI');
                      return (
                        <>
                          {isEoi && <button onClick={() => router.push(`/sales/closure/${b.project}?convertEoi=${b.id}`)} style={{ ...actBtn, background: '#E4571A' }}>→ Convert to LOI</button>}
                          <button onClick={() => router.push(`/sales/booking?revise=${b.id}${isEoi ? '&eoi=1' : ''}`)} style={{ ...actBtn, background: '#7C3AED' }}>↻ {isEoi ? 'Revise EOI' : 'Revise LOI'}</button>
                          {/* Only an approver can cancel, and only once the booking has a
                              closure to cancel through. */}
                          {isApprover && b.closure && (
                            <button onClick={() => setToCancel(b)} disabled={busy === b.id}
                              style={{ ...actBtn, background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FECACA' }}>✕ Cancel Booking</button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {toCancel && (
        <CancelBookingModal b={toCancel} rupee={rupee} busy={busy === toCancel.id}
          onClose={() => setToCancel(null)} onConfirm={() => cancelBooking(toCancel)} />
      )}
    </div>
  );
}

// Cancelling frees the unit and destroys the signed LOI — irreversible, so spell out
// exactly which booking is going and what it costs before letting it through.
function CancelBookingModal({ b, rupee, busy, onClose, onConfirm }) {
  const unit = b.plot_numbers || b.plot_number || b.area || '—';
  return (
    <div onClick={busy ? undefined : onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 20px 50px rgba(15,23,42,0.3)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#DC2626', marginBottom: 6 }}>Cancel this booking?</div>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 1.6 }}>
          This frees the unit back to <b>available</b>, permanently deletes the signed
          {' '}{String(b.plot_numbers || '').toUpperCase().startsWith('EOI') ? 'EOI' : 'LOI'} from storage,
          and removes it from conversions. <b>This cannot be undone.</b>
        </p>
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
          {[['Client', b.client_name || '—'], ['Project', b.project_name || '—'], ['Unit', unit], ['Amount', rupee(b.final_amount)]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: '#8492A6', fontWeight: 600 }}>{k}</span>
              <span style={{ fontSize: 13, color: '#1A1A2E', fontWeight: 700, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={busy}
            style={{ padding: '10px 18px', borderRadius: 9, border: '1.5px solid #CBD5E1', background: '#fff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
            Keep Booking
          </button>
          <button onClick={onConfirm} disabled={busy}
            style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: busy ? '#F3B4B4' : '#DC2626', color: '#fff', fontSize: 13, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Cancelling…' : 'Yes, Cancel Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BookingsPage() {
  return <BookingsContent />;
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
