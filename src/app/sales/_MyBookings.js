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

// Everyone at or under `rootId` in the reporting tree. Cycle-safe on purpose: a
// manager loop in the data is a typo someone can make in User Management, and it
// should not hang the page that surfaces it.
function subtreeIds(rootId, childrenOf) {
  const out = new Set([String(rootId)]);
  const queue = [String(rootId)];
  while (queue.length) {
    for (const kid of childrenOf[queue.shift()] || []) {
      if (out.has(kid)) continue;
      out.add(kid);
      queue.push(kid);
    }
  }
  return out;
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
  const [who, setWho] = useState('');     // 'booked by' — a user id, '' for everyone
  const me = useSelector((s) => s.auth?.user);
  const [team, setTeam] = useState([]);   // the viewer's reporting subtree

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

  // The reporting tree, for the 'Booked by' filter. Failing quietly is right here:
  // someone with no reports gets an empty list and simply never sees the dropdown,
  // which is the same outcome as the request erroring.
  useEffect(() => {
    fetch(SALES_ENDPOINTS.myTeam + (companyId ? `?company_id=${companyId}` : ''), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : [])).then((d) => setTeam(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [companyId]);

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

  // Everything except the person filter, which is what the 'Booked by' counts are
  // taken over: the number beside a name has to be what you get when you pick it.
  // Counting over all rows instead kept the numbers still as you switched tabs, but
  // on Approved they then summed to the full 244 next to a list of 229 — a filter
  // that misreports its own result is worse than one that moves.
  const preWho = rows.filter((b) => (!tab || b.status === tab) && matches(b) && inRange(b)
    && (!proj || projName(b) === proj));

  // 'Booked by' — a manager's list holds their whole reporting subtree, so let them
  // narrow it to one person. Picking a manager keeps that manager's own reports in
  // view, because on an org chart the question is "what did this branch close", not
  // "what did this one desk close". 'Only me' is the exception, and says so.
  const bookedById = (b) => (b.stm == null ? '' : String(b.stm));
  const myId = me?.id == null ? '' : String(me.id);
  const childrenOf = {}, teamById = {}, nameById = {}, countsBy = {};
  team.forEach((m) => {
    teamById[String(m.id)] = m;
    const parent = m.reporting_manager_id == null ? '' : String(m.reporting_manager_id);
    (childrenOf[parent] = childrenOf[parent] || []).push(String(m.id));
  });
  preWho.forEach((b) => {
    const k = bookedById(b);
    if (!k) return;
    countsBy[k] = (countsBy[k] || 0) + 1;
  });
  // Names come from every row, not just the counted ones: someone with nothing in
  // the current tab can still be the selected person, and their option needs a name.
  rows.forEach((b) => {
    const k = bookedById(b);
    if (k && !nameById[k]) nameById[k] = b.stm_name;
  });
  const personName = (id) => teamById[id]?.name || nameById[id] || 'Unknown';
  const subtreeCount = (id) =>
    [...subtreeIds(id, childrenOf)].reduce((n, k) => n + (countsBy[k] || 0), 0);

  // Depth-first from the viewer's direct reports down, so the dropdown reads as the
  // org chart does. Anyone whose branch booked nothing here is left out — an option
  // that filters to an empty list is just a way to waste a click — except whoever is
  // currently picked, who has to stay or the dropdown would blank out under them.
  const peopleOptions = [];
  const walked = new Set();
  const walk = (id, depth) => {
    if (walked.has(id) || id === myId) return;
    walked.add(id);
    if (subtreeCount(id) || id === who) {
      peopleOptions.push({ id, depth, label: personName(id), count: subtreeCount(id) });
    }
    (childrenOf[id] || []).forEach((kid) => walk(kid, depth + 1));
  };
  team.filter((m) => {
    const parent = m.reporting_manager_id == null ? '' : String(m.reporting_manager_id);
    return parent === myId || !teamById[parent];   // tops of the subtree we were given
  }).forEach((m) => walk(String(m.id), 0));
  // People who booked but sit outside the tree — in the CP module the pool carries
  // Channel-Partner deals closed by others. They belong in the filter all the same.
  const otherIds = new Set(Object.keys(countsBy).filter((k) => k !== myId && !teamById[k]));
  if (who && who !== 'cp' && who !== myId && !teamById[who]) otherIds.add(who);   // keep the picked one
  const others = [...otherIds]
    .map((k) => ({ id: k, label: personName(k), count: countsBy[k] || 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // 'Source: CP' sits in the same dropdown because it answers the same question —
  // which slice of this list am I looking at — even though it cuts across people
  // rather than down the tree. The flag is the server's: whether a deal is
  // Channel-Partner-sourced depends on the lead as well as the booking's own Source,
  // and the lead half never reaches the client.
  const isCp = (b) => !!b.is_cp_sourced;
  const cpCount = preWho.filter(isCp).length;
  const nonCpCount = preWho.length - cpCount;
  const showSource = cpCount > 0 && nonCpCount > 0;

  const whoSet = !who || who === 'cp' || who === 'noncp' ? null
    : who === myId ? new Set([myId]) : subtreeIds(who, childrenOf);
  const byWho = (b) => (!who ? true
    : who === 'cp' ? isCp(b)
    : who === 'noncp' ? !isCp(b)
    : whoSet.has(bookedById(b)));

  const visible = preWho.filter(byWho);

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
          <select value={proj} onChange={(e) => { setProj(e.target.value); setOpen({}); }} style={selectStyle}>
            <option value="">All Projects</option>
            {projOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {(peopleOptions.length > 0 || others.length > 0 || showSource) && (
          <select value={who} onChange={(e) => { setWho(e.target.value); setOpen({}); }} style={selectStyle}
            title="Filter by who booked it — a manager includes their own reports">
            <option value="">{`All People (${preWho.length})`}</option>
            {/* Two complete ways to slice the same list, each adding up to it on its
                own. They are not meant to be added together — one booking has both a
                person and a source — so they are separated and each group says what
                it sums to. Flat in one list, "Source: CP" read as another person and
                invited 108 + 67 + 11 against a list of 119. */}
            <optgroup label={`By person · adds up to ${preWho.length}`}>
              {(!!countsBy[myId] || who === myId) && <option value={myId}>{`Only me (${countsBy[myId] || 0})`}</option>}
              {/* Indented with non-breaking spaces: a native select renders no markup,
                  so depth has to be carried by the text itself. A nested name is part
                  of the one above it, the way a folder holds its files. */}
              {peopleOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {'\u00a0'.repeat(p.depth * 3) + (p.depth ? '└ ' : '') + p.label + ` (${p.count})`}
                </option>
              ))}
              {/* Booked by people who report elsewhere — in the CP module they are on
                  this list because the deal was partner-sourced. */}
              {others.map((p) => <option key={p.id} value={p.id}>{`${p.label} (${p.count})`}</option>)}
            </optgroup>
            {/* Both modules: a Sales manager's list carries partner-sourced deals too,
                through whoever on their team closed them. Shown only when the split
                is a real one — an all-or-nothing source tells you nothing, and the
                zero half is a dead option. */}
            {(showSource || who === 'cp' || who === 'noncp') && (
              <optgroup label={`By source · adds up to ${preWho.length}`}>
                <option value="cp">{`Source: CP (${cpCount})`}</option>
                <option value="noncp">{`Every other source (${nonCpCount})`}</option>
              </optgroup>
            )}
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
const selectStyle = { height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E0E6F0', background: '#fff', fontSize: 13, color: '#1A1A2E', cursor: 'pointer', maxWidth: 260 };
const linkBtn = { padding: '8px 14px', borderRadius: 8, border: '1.5px solid #C7D2FE', color: '#3D5AFE', fontSize: 13, fontWeight: 700, textDecoration: 'none' };
