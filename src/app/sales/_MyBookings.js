'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, loiHref, authHeaders } from '../../constants/api';
import { unitLabel } from './../../lib/bookingUnit';
import DateFilter from './_DateFilter';

// Same tabs as Bookings & Approvals, minus Drafts: this list is what you submitted,
// and a draft has not been. Statuses are the stored ones — 'sold' is an approved
// booking, which is why the label and the value differ.
const TABS = [['', 'All'], ['pending', 'Pending'], ['sold', 'Approved'], ['rejected', 'Rejected']];

const rupee = (n) => '₹ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

// Open the confidential LOI via a short-lived signed URL (never a public link).
async function openLoi(id) {
  try {
    const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(id), { headers: authHeaders() });
    const d = await r.json();
    if (r.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
    else alert('Could not open the LOI.');
  } catch { alert('Could not open the LOI.'); }
}

// "My Bookings" — the bookings the logged-in user submitted, grouped project → plot,
// with a Revise LOI action. Rendered inside the Booking page under a toggle.
export function MyBookingsList({ cpOnly = false }) {
  const router = useRouter();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState({});   // which project groups are expanded
  const toggle = (pn) => setOpen((o) => ({ ...o, [pn]: !o[pn] }));
  // Filtering happens here rather than server-side: the list is already everything
  // this person submitted, so narrowing it is instant and costs no round trip.
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [proj, setProj] = useState('');

  function load() {
    setLoading(true);
    // cp_only tells the server this is the Channel Partner module, where My Bookings
    // also covers the CP pool. Without it the same screen in Sales shows only own and
    // team work, which is the intended difference between the two.
    fetch(SALES_ENDPOINTS.bookings + '?mine=1' + (cpOnly ? '&cp_only=true' : '')
      + (companyId ? `&company_id=${companyId}` : ''), { headers: authHeaders() })
      .then((r) => r.json()).then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(load, [companyId, cpOnly]);

  async function discardDraft(id) {
    if (!window.confirm('Discard this draft? This can\'t be undone.')) return;
    await fetch(SALES_ENDPOINTS.bookingDiscard(id) + (companyId ? `?company_id=${companyId}` : ''), { method: 'POST', headers: authHeaders() }).catch(() => {});
    load();
  }

  // Search and date behave exactly as they do in Bookings & Approvals, so a query
  // that finds a booking there finds it here.
  const ql = q.trim().toLowerCase();
  const qDigits = ql.replace(/\D/g, '');
  // Only treat the query as a phone/id when it is ALL digits and separators — else
  // "shop1" strips to "1" and matches every phone containing a 1.
  const numericQuery = !!qDigits && /^[\d\s+()-]+$/.test(ql);
  const matches = (b) => {
    if (!ql) return true;
    const text = [b.client_name, b.plot_numbers, b.plot_number, b.area, b.loi_document];
    if (text.some((v) => String(v || '').toLowerCase().includes(ql))) return true;
    if (!numericQuery) return false;
    if (String(b.id) === qDigits) return true;
    return qDigits.length >= 3 && String(b.phone || '').replace(/\D/g, '').includes(qDigits);
  };
  const dated = !!(range.from || range.to);
  // Booking date is a plain YYYY-MM-DD, so the range compares as strings. One with no
  // date cannot be placed in time, so a live range excludes it rather than guessing.
  const inRange = (b) => {
    if (!dated) return true;
    const d = String(b.booking_date || '');
    if (!d) return false;
    return (!range.from || d >= range.from) && (!range.to || d <= range.to);
  };
  const projName = (b) => b.project_name || '—';
  // Built from every row, not the filtered ones, so picking a project never removes
  // the other options from the dropdown.
  const projOptions = [...new Set(rows.map(projName))].sort((a, b) => a.localeCompare(b));
  const visible = rows.filter((b) => (!tab || b.status === tab) && matches(b) && inRange(b)
    && (!proj || projName(b) === proj));

  const groups = {};
  visible.forEach((b) => { const k = b.project_name || '—'; (groups[k] = groups[k] || []).push(b); });
  const projectNames = Object.keys(groups).sort();
  projectNames.forEach((pn) => groups[pn].sort((a, b) => String(a.plot_numbers || a.plot_number || a.area).localeCompare(String(b.plot_numbers || b.plot_number || b.area))));

  return (
    <>
      <p style={{ fontSize: 13, color: '#8492A6', marginBottom: 14 }}>
        {visible.length === rows.length
          ? `${rows.length} booking${rows.length === 1 ? '' : 's'} you submitted · revise the LOI anytime`
          : `${visible.length} of ${rows.length} bookings · revise the LOI anytime`}
      </p>

      <DateFilter onChange={setRange} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => { setTab(k); setOpen({}); }}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: tab === k ? '#3D5AFE' : '#EEF1F7', color: tab === k ? '#fff' : '#8492A6' }}>{label}</button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8492A6', fontSize: 13 }}>🔍</span>
          {/* Collapse state is keyed by project, so drop it as the query changes —
              otherwise a group collapsed earlier would hide its own hits. */}
          <input value={q} onChange={(e) => { setQ(e.target.value); setOpen({}); }}
            placeholder="Search name, phone or LOI / unit no…"
            style={{ width: '100%', height: 36, padding: '0 32px', borderRadius: 8, border: '1.5px solid #E0E6F0',
              background: '#fff', fontSize: 13, color: '#1A1A2E', boxSizing: 'border-box' }} />
          {!!q && (
            <button onClick={() => { setQ(''); setOpen({}); }} title="Clear search"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none',
                color: '#8492A6', fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
          )}
        </div>
        {projOptions.length > 1 && (
          <select value={proj} onChange={(e) => { setProj(e.target.value); setOpen({}); }}
            style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E0E6F0', background: '#fff', fontSize: 13, color: '#1A1A2E', cursor: 'pointer' }}>
            <option value="">All Projects</option>
            {projOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {loading ? <p style={{ color: '#8492A6' }}>Loading…</p> : projectNames.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8492A6', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' }}>
          {/* Distinguish "nothing matched" from "nothing exists" — telling someone
              they have never booked a unit while a filter hides 121 of them is worse
              than saying nothing at all. */}
          {rows.length ? 'No bookings match these filters.' : <>You haven&apos;t booked any units yet.</>}
        </div>
      ) : projectNames.map((pn) => (
        <div key={pn} style={{ marginBottom: 12 }}>
          <div onClick={() => toggle(pn)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)', border: open[pn] ? '1.5px solid #C7D2FE' : '1.5px solid transparent' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#3D5AFE', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              🏢 {pn} <span style={{ color: '#8492A6', fontWeight: 600 }}>· {groups[pn].length} unit{groups[pn].length === 1 ? '' : 's'}</span>
            </div>
            <span style={{ color: '#8492A6', fontSize: 13, fontWeight: 800, transform: open[pn] ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
          </div>
          {open[pn] && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {groups[pn].map((b) => (
              <div key={b.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>
                      {unitLabel(b).isUnit ? `Plot ${unitLabel(b).text}` : unitLabel(b).text} <span style={{ color: '#8492A6', fontWeight: 600 }}>· {b.client_name || '—'}</span>
                      {b.revision_no > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: 20, marginLeft: 6 }}>R{b.revision_no}</span>}
                    </div>
                    {/* STM alongside the unit, as Bookings & Approvals shows it. Usually
                        the viewer, since this list is their own submissions — but a kiosk
                        booking records the assisting salesperson in manual_stm_name, which
                        stm_name prefers, so it is not always. */}
                    <div style={{ fontSize: 12, color: '#8492A6', marginTop: 3 }}>
                      {b.phone} · Booked {b.booking_date || '—'}
                      {b.stm_name ? ` · STM: ${b.stm_name}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0D47A1' }}>{rupee(b.final_amount)}</div>
                    <span style={statusPill(b.status)}>{(b.approval_status || b.status || '').toUpperCase()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  {b.loi_document && <button onClick={() => openLoi(b.id)} style={{ ...linkBtn, background: '#fff', cursor: 'pointer' }}>📄 Signed LOI</button>}
                  {b.status === 'draft' && (
                    <>
                      <button onClick={() => router.push(`/sales/booking?draft=${b.id}`)} style={{ ...actBtn, background: '#3D5AFE' }}>▸ Resume</button>
                      <button onClick={() => discardDraft(b.id)} style={{ ...actBtn, background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FECACA' }}>✕ Discard</button>
                    </>
                  )}
                  {b.status === 'sold' && String(b.plot_numbers || '').toUpperCase().startsWith('EOI') && (
                    <>
                      <button onClick={() => router.push(`/sales/closure/${b.project}?convertEoi=${b.id}`)} style={{ ...actBtn, background: '#E4571A' }}>→ Convert to LOI</button>
                      <button onClick={() => router.push(`/sales/booking?revise=${b.id}&eoi=1`)} style={{ ...actBtn, background: '#7C3AED' }}>↻ Revise EOI</button>
                    </>
                  )}
                  {b.status === 'sold' && !String(b.plot_numbers || '').toUpperCase().startsWith('EOI') && (
                    <button onClick={() => router.push(`/sales/booking?revise=${b.id}`)} style={{ ...actBtn, background: '#7C3AED' }}>↻ Revise LOI</button>
                  )}
                  {b.status === 'pending' && <span style={{ fontSize: 12, color: '#B45309', alignSelf: 'center' }}>Awaiting approval</span>}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      ))}
    </>
  );
}

function statusPill(s) {
  const map = { draft: ['#3D5AFE', '#EEF1FF'], pending: ['#B45309', '#FEF3C7'], sold: ['#15803D', '#E8F5E9'], rejected: ['#DC2626', '#FEE2E2'], hold: ['#B45309', '#FEF3C7'] };
  const [c, bg] = map[s] || ['#6B7280', '#F3F4F6'];
  return { display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 800, color: c, background: bg, padding: '3px 9px', borderRadius: 20 };
}
const actBtn = { padding: '8px 16px', borderRadius: 8, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const linkBtn = { padding: '8px 14px', borderRadius: 8, border: '1.5px solid #C7D2FE', color: '#3D5AFE', fontSize: 13, fontWeight: 700, textDecoration: 'none' };
