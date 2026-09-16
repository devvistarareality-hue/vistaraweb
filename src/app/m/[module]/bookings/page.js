'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../../constants/api';
import DateFilter from '../../../sales/_DateFilter';
import { unitLabel } from '../../../../lib/bookingUnit';
import BookingDetails, { fmtDateTime } from '../../../../components/BookingDetails';

const rupee = (n) => '₹ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const isEoi = (b) => String(b.plot_numbers || '').toUpperCase().startsWith('EOI');
// Project / STM pickers — sized to sit under the date filter in this module's teal.
const modSel = { height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid #DFE2E6',
  background: '#fff', fontSize: 13, cursor: 'pointer', outline: 'none', maxWidth: 240 };

// Open the confidential LOI/EOI PDF via a short-lived signed URL (never a public link).
async function openLoi(id) {
  try {
    const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(id), { headers: authHeaders() });
    const d = await r.json();
    if (r.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
    else alert('Could not open the document.');
  } catch { alert('Could not open the document.'); }
}

// Download the signed PDF to disk (fetch the blob so it saves instead of opening).
async function downloadLoi(b) {
  try {
    const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(b.id), { headers: authHeaders() });
    const d = await r.json();
    if (!r.ok || !d.url) { alert('Could not download the document.'); return; }
    const name = `${isEoi(b) ? 'EOI' : 'LOI'}_${(b.project_name || '').replace(/\s+/g, '_')}_${(b.plot_numbers || b.plot_number || '').replace(/[\s,]+/g, '')}_${(b.client_name || '').replace(/\s+/g, '_')}.pdf`;
    try {
      const blob = await (await fetch(d.url)).blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = objUrl; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
    } catch { window.open(d.url, '_blank', 'noopener,noreferrer'); }  // CORS fallback → open
  } catch { alert('Could not download the document.'); }
}

function statusPill(s) {
  const map = { pending: ['#A3671A', '#FFF3E0'], sold: ['#23874A', '#E9FBEA'], rejected: ['#D9434B', '#FDECEC'], hold: ['#A3671A', '#FFF3E0'] };
  const [c, bg] = map[s] || ['#55585E', '#F4F5F7'];
  return { display: 'inline-block', fontSize: 10, fontWeight: 800, color: c, background: bg, padding: '3px 9px', borderRadius: 20 };
}

const TABS = [['approved', 'Approved'], ['cancelled', 'Cancelled']];

// Accounts & Finance — Bookings: the ledger of Sales/CP + Accounts-approved deals
// (LOI + EOI), project-wise. A booking lands here once approved in the Approvals tab
// and stays until (if ever) cancelled there — a cancelled one shows in its own tab,
// with the unit already back to available. View-only besides opening/downloading the
// signed document; approve/reject/cancel all live on the Approvals page.
export default function ModuleBookingsPage() {
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('approved');
  const [open, setOpen] = useState({});
  const toggle = (pn) => setOpen((o) => ({ ...o, [pn]: !o[pn] }));
  const [detailsOpen, setDetailsOpen] = useState({});
  const toggleDetails = (id) => setDetailsOpen((o) => ({ ...o, [id]: !o[id] }));
  // Revision history, fetched per booking on demand: only a handful of deals are
  // ever revised, so loading every chain up front would be work for nothing.
  const [revs, setRevs] = useState({});      // booking id → array of versions
  const [revOpen, setRevOpen] = useState({});
  // Details inside the history get their own key space, separate from the card's: the
  // current version shares the booking's id, so one shared map let a single toggle
  // open two blocks at once. Cleared on every open so the history starts collapsed —
  // it is opened to scan the versions, and a panel left open buries that list.
  const [revDetails, setRevDetails] = useState({});
  const toggleRevDetails = (id) => setRevDetails((o) => ({ ...o, [id]: !o[id] }));
  async function toggleRevisions(id) {
    setRevDetails({});
    setRevOpen((o) => ({ ...o, [id]: !o[id] }));
    if (revs[id]) return;                      // already loaded, just reopening
    try {
      const r = await fetch(SALES_ENDPOINTS.bookingRevisions(id)
        + (companyId ? `?company_id=${companyId}` : ''), { headers: authHeaders() });
      const d = await r.json();
      setRevs((m) => ({ ...m, [id]: Array.isArray(d) ? d : [] }));
    } catch {
      setRevs((m) => ({ ...m, [id]: [] }));
    }
  }
  // Same filters as the Approvals view: search, booking date, project, STM.
  const [q, setQ] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [proj, setProj] = useState('');   // '' = every project
  const [stm, setStm] = useState('');     // '' = every STM

  function load() {
    setLoading(true); setErr('');
    fetch(SALES_ENDPOINTS.bookingsAll + (companyId ? `?company_id=${companyId}` : ''), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch((s) => { setErr(s === 403 ? 'You do not have access to bookings.' : 'Could not load bookings.'); setLoading(false); });
  }
  useEffect(() => { load(); }, [companyId]);

  // Cancelled sits on approval_status, not accounts_status — cancelling (from the
  // Approvals page) marks the whole booking CANCELLED the same way Sales' own
  // Cancel Booking does, regardless of which side's approver triggered it. Matched
  // as a substring (not an exact 'CANCELLED') so any historical variant of the
  // string still lands here rather than silently falling through both tabs.
  const isCancelled = (b) => String(b.approval_status || '').toUpperCase().includes('CANCEL');
  const inTab = {
    approved:  (b) => b.status === 'sold' && b.accounts_status === 'approved' && !isCancelled(b),
    cancelled: isCancelled,
  }[tab];
  const tabRows = rows.filter(inTab);

  // Search across client name, phone and the LOI/unit number — same rules as the
  // Sales approvals search. Phones are stored with spaces ("81408 05999") so digit
  // queries compare digits-only; the LOI's stored filename and the booking id are
  // matched too, since either can be quoted as "LOI no".
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
    return qDigits.length >= 3 && String(b.phone || '').replace(/\D/g, '').includes(qDigits);
  };

  // Booking date is a plain YYYY-MM-DD, so the range compares as strings. A booking
  // with no date can't be placed in time, so a live range excludes it rather than
  // silently counting it in every period.
  const dated = !!(range.from || range.to);
  const inRange = (b) => {
    if (!dated) return true;
    const d = String(b.booking_date || '');
    if (!d) return false;
    return (!range.from || d >= range.from) && (!range.to || d <= range.to);
  };
  // Both option lists come from every booking in this tab, not the filtered set, so
  // choosing one value never removes the other options from its dropdown.
  const stmName = (b) => b.stm_name || '—';
  const projName = (b) => b.project_name || '—';
  const stmOptions = [...new Set(tabRows.map(stmName))].sort((a, b) => a.localeCompare(b));
  const projOptions = [...new Set(tabRows.map(projName))].sort((a, b) => a.localeCompare(b));
  const narrowed = !!ql || dated || !!stm || !!proj;

  const groups = {};
  tabRows
    .filter((b) => matches(b) && inRange(b) && (!stm || stmName(b) === stm) && (!proj || projName(b) === proj))
    .forEach((b) => { const k = b.project_name || '—'; (groups[k] = groups[k] || []).push(b); });
  const projectNames = Object.keys(groups).sort();
  // Latest first — by accounts approval time for the ledger, falling back to the
  // Sales approval for historical bookings grandfathered in before that field existed.
  const sortKey = (b) => (b.accounts_approved_at || b.approved_at || '');
  projectNames.forEach((pn) => groups[pn].sort((a, b) => sortKey(b).localeCompare(sortKey(a))));
  const projectTotal = (pn) => groups[pn].reduce((s, b) => s + (Number(b.final_amount) || 0), 0);
  const grandTotal = projectNames.reduce((s, pn) => s + projectTotal(pn), 0);
  const grandCount = projectNames.reduce((s, pn) => s + groups[pn].length, 0);
  const tabLabel = (TABS.find(([k]) => k === tab) || ['', ''])[1];

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1D1D1F' }}>Bookings</h1>
      <p style={{ fontSize: 13, color: '#6E7278', marginTop: 4 }}>Approved bookings and cancellations, project-wise · view only — approve, reject or cancel from Approvals</p>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => { setTab(k); setOpen({}); }} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: tab === k ? '#23874A' : '#ECEEF0', color: tab === k ? '#fff' : '#6E7278' }}>{label}</button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6E7278', fontSize: 13 }}>🔍</span>
          {/* Collapse state is keyed by project, so drop it as the query changes —
              otherwise a group the user collapsed earlier would hide its own hits. */}
          <input value={q} onChange={(e) => { setQ(e.target.value); setOpen({}); }}
            placeholder="Search name, phone or LOI / unit no…"
            style={{ width: '100%', height: 36, padding: '0 32px 0 32px', borderRadius: 8, border: '1.5px solid #DFE2E6',
              background: '#fff', fontSize: 13, color: '#1D1D1F', boxSizing: 'border-box' }} />
          {!!q && (
            <button onClick={() => { setQ(''); setOpen({}); }} title="Clear search"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none',
                color: '#6E7278', fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
          )}
        </div>
      </div>

      {!loading && !err && tabRows.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {/* Booking-date range — the same control the dashboards and Sales approvals
              use, so a period picked here means the same thing there. */}
          <DateFilter onChange={setRange} />
          {(projOptions.length > 1 || stmOptions.length > 1) && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: -8, marginBottom: 4 }}>
              {projOptions.length > 1 && (
                <select value={proj} onChange={(e) => { setProj(e.target.value); setOpen({}); }}
                  style={{ ...modSel, borderColor: proj ? '#23874A' : '#DFE2E6', fontWeight: proj ? 700 : 500, color: proj ? '#1D1D1F' : '#6E7278' }}>
                  <option value="">All Projects</option>
                  {projOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
              {stmOptions.length > 1 && (
                <select value={stm} onChange={(e) => { setStm(e.target.value); setOpen({}); }}
                  style={{ ...modSel, borderColor: stm ? '#23874A' : '#DFE2E6', fontWeight: stm ? 700 : 500, color: stm ? '#1D1D1F' : '#6E7278' }}>
                  <option value="">All STMs</option>
                  {stmOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && !err && projectNames.length > 0 && (
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: tab === 'cancelled' ? '#1D1D1F' : '#23874A', borderRadius: 18, padding: '16px 20px', boxShadow: tab === 'cancelled' ? '0 2px 8px rgba(58,60,64,0.25)' : '0 2px 8px rgba(35,135,74,0.25)' }}>
          <div style={{ color: tab === 'cancelled' ? '#DFE2E6' : '#C9F8CA', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {narrowed ? 'Matching' : 'Total'} {tabLabel} · {grandCount} booking{grandCount === 1 ? '' : 's'} · {projectNames.length} project{projectNames.length === 1 ? '' : 's'}
            {dated && <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}> · booked {range.from || '…'} → {range.to || '…'}</span>}
            {!!proj && <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}> · {proj}</span>}
            {!!stm && <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}> · STM {stm}</span>}
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{rupee(grandTotal)}</div>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        {loading ? <p style={{ color: '#6E7278' }}>Loading…</p>
        : err ? <div style={{ background: '#FDECEC', border: '1px solid #F7C3C6', color: '#D9434B', borderRadius: 16, padding: '14px 18px', fontSize: 13 }}>{err}</div>
        : projectNames.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 18, padding: 40, textAlign: 'center', color: '#6E7278', boxShadow: '0 2px 8px rgba(140,148,160,0.18)' }}>
            {narrowed ? `No ${tabLabel.toLowerCase()} bookings match these filters.` : `No ${tabLabel.toLowerCase()} bookings.`}
          </div>
        ) : projectNames.map((pn) => (
          <div key={pn} style={{ marginBottom: 12 }}>
            <div onClick={() => toggle(pn)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff', borderRadius: 16, padding: '14px 18px', boxShadow: '0 2px 8px rgba(140,148,160,0.18)', border: open[pn] ? '1.5px solid #C9F8CA' : '1.5px solid transparent' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#23874A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                🏢 {pn} <span style={{ color: '#6E7278', fontWeight: 600 }}>· {groups[pn].length} booking{groups[pn].length === 1 ? '' : 's'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#245A96' }}>{rupee(projectTotal(pn))}</span>
                <span style={{ color: '#6E7278', fontSize: 13, fontWeight: 800, transform: open[pn] ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
              </div>
            </div>
            {open[pn] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {groups[pn].map((b) => (
                  <div key={b.id} style={{ background: '#fff', borderRadius: 18, padding: '14px 18px', boxShadow: '0 2px 8px rgba(140,148,160,0.18)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F' }}>
                          {isEoi(b)
                            ? <span style={{ color: '#D98A1F' }}>{b.plot_numbers}</span>
                            : <>{unitLabel(b).isUnit ? `Plot ${unitLabel(b).text}` : unitLabel(b).text}</>}
                          <span style={{ color: '#6E7278', fontWeight: 600 }}> · {b.client_name || '—'}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#23874A', background: '#C9F8CA', padding: '2px 6px', borderRadius: 20, marginLeft: 6 }}>{isEoi(b) ? 'EOI' : 'LOI'}</span>
                          {b.revision_no > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#A3671A', background: '#FFF3E0', padding: '2px 6px', borderRadius: 20, marginLeft: 6 }}>R{b.revision_no}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#6E7278', marginTop: 3 }}>{b.phone} · STM {b.stm_name || '—'}</div>
                        <div style={{ fontSize: 11, color: '#6E7278', marginTop: 2 }}>Booked {fmtDateTime(b.created_at)}</div>
                        {/* The Sales/CP decision. Accounts already shows its own stage
                            on the right; this is who put the deal on the books, or
                            took it off them. */}
                        {b.cancelled_by_name && (
                          <div style={{ fontSize: 11, color: '#3A3C40', marginTop: 2, fontWeight: 600 }}>
                            Cancelled by {b.cancelled_by_name}{b.cancelled_at ? ` · ${fmtDateTime(b.cancelled_at)}` : ''}
                          </div>
                        )}
                        {!b.cancelled_by_name && b.rejected_by_name && (
                          <div style={{ fontSize: 11, color: '#D9434B', marginTop: 2, fontWeight: 600 }}>
                            Rejected by {b.rejected_by_name}{b.rejected_at ? ` · ${fmtDateTime(b.rejected_at)}` : ''}
                          </div>
                        )}
                        {!b.cancelled_by_name && !b.rejected_by_name && b.approved_by_name && (
                          <div style={{ fontSize: 11, color: '#23874A', marginTop: 2, fontWeight: 600 }}>
                            Approved by {b.approved_by_name}{b.approved_at ? ` · ${fmtDateTime(b.approved_at)}` : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#245A96' }}>{rupee(b.final_amount)}</div>
                        <div style={{ marginTop: 4 }}><span style={statusPill(b.status)}>{(b.approval_status || b.status || '').toUpperCase()}</span></div>
                        {tab === 'approved' && b.accounts_approved_at && <div style={{ fontSize: 11, color: '#23874A', marginTop: 4 }}>Accounts approved {fmtDateTime(b.accounts_approved_at)}{b.accounts_approved_by_name ? ` · ${b.accounts_approved_by_name}` : ''}</div>}
                        {tab === 'approved' && !b.accounts_approved_at && b.approved_at && <div style={{ fontSize: 11, color: '#6E7278', marginTop: 4 }}>Approved {fmtDateTime(b.approved_at)}</div>}
                      </div>
                    </div>
                    {tab === 'cancelled' && (
                      <div style={{ marginTop: 10, background: '#FDECEC', border: '1px solid #F7C3C6', borderRadius: 14, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#D9434B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Cancelled — unit released back to available
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {/* A revised deal gets its Details per version inside the
                          history instead — the current version is one of them, so a
                          card-level copy is the same figures twice. It also shares an
                          id with that row, which rendered the block twice at once. */}
                      {!b.revision_no && (
                        <button onClick={() => toggleDetails(b.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #C9CDD2', background: '#fff', color: '#1D1D1F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          {detailsOpen[b.id] ? '▲ Hide Details' : '▾ Details'}
                        </button>
                      )}
                      {b.loi_document && <>
                        <button onClick={() => openLoi(b.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #C9F8CA', background: '#fff', color: '#23874A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📄 View {isEoi(b) ? 'EOI' : 'LOI'}</button>
                        <button onClick={() => downloadLoi(b)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#23874A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⬇ Download {isEoi(b) ? 'EOI' : 'LOI'}</button>
                      </>}
                      {/* Only the latest version is listed here, at its current terms.
                          The earlier ones are what was signed at the time — which for
                          a team reconciling payments against documents is the whole
                          question when a deal carries an R1. */}
                      {b.revision_no > 0 && (
                        <button onClick={() => toggleRevisions(b.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #C9CDD2', background: '#fff', color: '#1D1D1F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          ⟲ Revisions {revOpen[b.id] ? '▲' : '▾'}
                        </button>
                      )}
                    </div>
                    {!b.revision_no && detailsOpen[b.id] && <BookingDetails b={b} />}
                    {revOpen[b.id] && (
                      <div style={{ marginTop: 12, borderTop: '1px dashed #C9CDD2', paddingTop: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#23874A', letterSpacing: 0.6, marginBottom: 8 }}>
                          REVISION HISTORY
                        </div>
                        {!revs[b.id] ? <p style={{ fontSize: 12, color: '#6E7278', margin: 0 }}>Loading…</p>
                         : revs[b.id].length === 0 ? <p style={{ fontSize: 12, color: '#6E7278', margin: 0 }}>Couldn&apos;t load the history.</p>
                         : revs[b.id].map((v) => (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                            padding: '7px 0', borderBottom: '1px solid #F4F5F7' }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: v.id === b.id ? '#23874A' : '#55585E',
                              background: v.id === b.id ? '#C9F8CA' : '#F4F5F7', padding: '3px 8px', borderRadius: 20 }}>
                              R{v.revision_no || 0}
                            </span>
                            <span style={{ fontSize: 12, color: '#1D1D1F', fontWeight: 700 }}>{rupee(v.final_amount)}</span>
                            <span style={{ fontSize: 12, color: '#6E7278' }}>
                              Booked {v.booking_date || '—'} · {(v.approval_status || v.status || '').toUpperCase()}
                              {v.stm_name ? ` · ${v.stm_name}` : ''}
                            </span>
                            {/* The version marked current is the one the card shows; the
                                rest are superseded and say so rather than looking live. */}
                            {v.id === b.id
                              ? <span style={{ fontSize: 10, fontWeight: 800, color: '#23874A' }}>CURRENT</span>
                              : <span style={{ fontSize: 10, fontWeight: 700, color: '#6E7278' }}>superseded</span>}
                            <span style={{ flex: 1 }} />
                            {v.loi_document ? <>
                              <button onClick={() => openLoi(v.id)} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #C9F8CA', background: '#fff', color: '#23874A', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📄 View</button>
                              <button onClick={() => downloadLoi(v)} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: '#23874A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⬇ Download</button>
                            </> : <span style={{ fontSize: 11, color: '#9A9EA5' }}>no document on file</span>}
                            <button onClick={() => toggleRevDetails(v.id)} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #C9CDD2', background: '#fff', color: '#1D1D1F', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              {revDetails[v.id] ? '▲ Details' : '▾ Details'}
                            </button>
                            {revDetails[v.id] && <div style={{ width: '100%' }}><BookingDetails b={v} /></div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
