'use client';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { CLUB1000_ENDPOINTS, SALES_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import {isClub1000Manager, isManagerRole, can} from '../../../lib/moduleAccess';
import DateFilter from '../../sales/_DateFilter';
import MultiSelect from '../../../components/MultiSelect';
import { formatDMY } from '../../../lib/dateFormat';
import { fmtMoney } from '../_StatCard';

import Icon from '../../../components/Icon';
import { notify } from '../../../lib/notify';
import Loader from '../../../components/Loader';
import AddInvestorModal from '../_AddInvestorModal';
import { errText } from '../../../lib/apiError';
const TEAL = 'var(--success)';

const APPROVAL_COLORS = {
  draft: { bg: 'var(--surface-2)', fg: 'var(--text-3)' },
  pending: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  approved: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  rejected: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
};
// Drafts first because that is the step before Pending. The server only ever
// returns your own, so this tab is personal even though the page is shared.
const TABS = [['draft', 'Drafts'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']];

// `label` overrides the text (e.g. "Revision R1 pending") but the colour follows the status.
function ApprovalBadge({ approvalStatus, label }) {
  const c = APPROVAL_COLORS[approvalStatus] || { bg: 'var(--surface-2)', fg: 'var(--text-3)' };
  return <span className="nx-badge" style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: c.bg, color: c.fg, textTransform: 'uppercase' }}>{label || approvalStatus}</span>;{/* inline-ok: colour per status */}
}

function ApproverDropdown({ scheme, managers, onToggle }) {
  const [open, setOpen] = useState(false);
  const sel = scheme.investor_approvers || [];
  const selNames = managers.filter((m) => sel.includes(m.id)).map((m) => m.name);
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 460 }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer',
        fontSize: 13, color: selNames.length ? 'var(--text)' : 'var(--faint)', textAlign: 'left',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: selNames.length ? 600 : 400 }}>
          {selNames.length ? selNames.join(', ') : 'Select approvers…'}
        </span>
        <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
          <div className="nx-popover" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30, background: 'var(--surface)',
            border: '1px solid var(--surface-3)', borderRadius: 14, boxShadow: '0 10px 30px rgba(110,114,120,0.18)', maxHeight: 260, overflowY: 'auto', padding: 4 }}>
            {managers.map((m) => {
              const on = sel.includes(m.id);
              return (
                <div key={m.id} onClick={() => onToggle(scheme.id, m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 7, cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#fff', background: on ? 'var(--success-solid)' : 'var(--surface)', border: `1.5px solid ${on ? TEAL : 'var(--border-strong)'}` }}>{on ? <Icon name="check" /> : ''}</span>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{m.name}</span>
                  {m.designation && <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {m.designation}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function InvestorApprovalsPage() {
  const user = useSelector((s) => s.auth.user);
  const router = useRouter();
  const manager = isClub1000Manager(user);
  // Being a Club 1000 manager gets you onto this page, but approval authority
  // itself is scoped to the scheme's configured Investor Approvers (or a real
  // admin) — mirrors backend can_approve_investor. Without this, every manager
  // saw live Approve/Reject buttons for every scheme regardless of who was
  // actually picked in "Investor Approvers — by scheme" above, which only
  // 403'd on click instead of not being offered at all.
  const isRealAdmin = user?.is_staff || user?.role === 'Admin';
  // Who can SEE (let alone change) the "Investor Approvers — by scheme"
  // picker — deliberately narrower than `manager` (which just gets you onto
  // this page at all): only Directors and real admins get to decide who
  // approves each scheme, same as Sales' "Booking Approvers — by project"
  // panel restricts to isAdmin rather than every booking-approving manager.
  const canConfigureApprovers = isRealAdmin || user?.role === 'Director';
  function canApprove(inv) {
    if (isRealAdmin) return true;
    const scheme = schemes.find((s) => s.id === inv.scheme);
    return !!scheme && (scheme.investor_approvers || []).includes(user?.id);
  }

  const [tab, setTab] = useState('pending');
  const [investors, setInvestors] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  // A draft is edited from here, because it deliberately does not appear in the
  // Investors list — there is nowhere else to open it from.
  const [editDraft, setEditDraft] = useState(null);
  // An approved investor opened in Revise LOI — the Add Investor form, prefilled.
  const [revising, setRevising] = useState(null);
  // Filters, as on Sales' Booking Approvals: the investment-date range, schemes and
  // who added them. Applied here, over the tab the server returned.
  const [range, setRange] = useState({ from: '', to: '' });
  const [schemeSel, setSchemeSel] = useState([]);
  const [addedBySel, setAddedBySel] = useState([]);
  const [openGroup, setOpenGroup] = useState({});

  const [managers, setManagers] = useState([]);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [savedCfg, setSavedCfg] = useState('');
  const [search, setSearch] = useState('');
  // Search box is debounced: typing updates `searchText` instantly (responsive UI)
  // but only commits to `search` (which triggers the fetch) after a pause.
  const [searchText, setSearchText] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText), 400);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    if (user && !manager) router.replace('/club1000');
  }, [user]);

  useEffect(() => {
    if (!manager) return;
    apiFetch(SALES_ENDPOINTS.usersSlim).then((r) => (r.ok ? r.json() : []))
      .then((d) => setManagers(Array.isArray(d) ? d.filter((u) => isManagerRole(u) || u.role === 'Admin') : []))
      .catch(() => {});
  }, [manager]);

  // Per-scheme sequence counter — purely to stop a slow, out-of-order response
  // from visually flickering the display backwards after a newer toggle for
  // the same scheme has already landed. It's cosmetic only: the actual
  // save-without-loss guarantee comes from the backend's atomic toggle
  // endpoint (see SchemeToggleApproverView) — PATCHing the whole computed
  // array from here raced the moment two toggles for the same scheme were in
  // flight together, since whichever write landed LAST at the DB won
  // regardless of send order, silently dropping the other click with no
  // error either side. The toggle endpoint instead sends just the one
  // manager id and lets the DB row lock serialize concurrent toggles, so
  // nothing is lost no matter how the requests interleave.
  const approverPatchSeq = useRef({});

  async function toggleApprover(schemeId, mgrId) {
    // Optimistic instant feedback — the atomic call below reconciles this
    // with the server's authoritative result once it returns.
    setSchemes((ss) => ss.map((s) => {
      if (s.id !== schemeId) return s;
      const cur = s.investor_approvers || [];
      return { ...s, investor_approvers: cur.includes(mgrId) ? cur.filter((x) => x !== mgrId) : [...cur, mgrId] };
    }));

    const seq = (approverPatchSeq.current[schemeId] || 0) + 1;
    approverPatchSeq.current[schemeId] = seq;

    let result = null;
    try {
      const res = await apiFetch(CLUB1000_ENDPOINTS.schemeToggleApprover(schemeId), { method: 'POST', body: JSON.stringify({ manager_id: mgrId }) });
      if (res.ok) result = await res.json();
    } catch { /* result stays null */ }

    if (approverPatchSeq.current[schemeId] !== seq) return;

    if (result) {
      setSchemes((ss) => ss.map((s) => (s.id === schemeId ? { ...s, investor_approvers: result.investor_approvers } : s)));
      setSavedCfg('Saved'); setTimeout(() => setSavedCfg(''), 1500);
    } else {
      // Undo the optimistic toggle — it never actually reached the DB, so the
      // UI shouldn't keep showing it as selected.
      setSchemes((ss) => ss.map((s) => {
        if (s.id !== schemeId) return s;
        const cur = s.investor_approvers || [];
        return { ...s, investor_approvers: cur.includes(mgrId) ? cur.filter((x) => x !== mgrId) : [...cur, mgrId] };
      }));
      setSavedCfg('⚠ Could not save — try again'); setTimeout(() => setSavedCfg(''), 3000);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ approval_status: tab });
      if (search) params.set('search', search);
      const [invRes, schemesRes] = await Promise.all([
        apiFetch(`${CLUB1000_ENDPOINTS.investors}?${params.toString()}`),
        apiFetch(CLUB1000_ENDPOINTS.schemes),
      ]);
      if (invRes.ok) setInvestors(await invRes.json());
      if (schemesRes.ok) setSchemes(await schemesRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (manager) load(); }, [manager, tab, search]);

  async function openLoi(id, pending) {
    const res = await apiFetch(`${CLUB1000_ENDPOINTS.investorLoiUrl(id)}${pending ? '?pending=1' : ''}`);
    const data = await res.json();
    if (res.ok && data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    else notify(errText(data, 'Could not open the LOI.'));
  }

  // A revision can change anything on the Add Investor form, so every field it may
  // carry gets a readable name — and the scheme its name, not its number.
  const FIELD_LABELS = {
    amount_invested: 'Amount', total_return_pct: 'Return %', interest_payout: 'Payout', security: 'Security', notes: 'Notes',
    scheme: 'Scheme', email: 'Email', pan: 'PAN', source: 'Source', reference_name: 'Reference', reference_phone: 'Reference no.',
    name: 'Name', phone: 'Mobile', revision_date: 'Revision date',
  };
  function revisionSummary(inv) {
    const pr = inv.pending_revision;
    if (!pr) return null;
    const isRenew = inv.pending_revision_type === 'renew';
    return Object.entries(pr).filter(([k]) => k !== 'payout_schedule').map(([k, v]) => {
      if (k === 'document_name') return 'New KYC scan';
      if (k === 'investment_date') return `${isRenew ? 'Renewal Date' : 'Investment date'}: ${v}`;
      if (k === 'scheme') return `Scheme: ${(schemes.find((sc) => String(sc.id) === String(v)) || {}).name || v}`;
      return `${FIELD_LABELS[k] || k}: ${v === '' ? '—' : v}`;
    }).join(' · ');
  }

  async function act(id, action) {
    setBusy(id);
    try {
      const res = await apiFetch(CLUB1000_ENDPOINTS.investorAction(id), { method: 'POST', body: JSON.stringify({ action }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(errText(data, `Could not ${action} this investor.`));
        return;
      }
      load();
    } finally {
      setBusy(null);
    }
  }

  // Filtered list and its scheme groups, as Sales groups bookings by project.
  const schemeOptions = [...new Set(investors.map((i) => i.scheme_name).filter(Boolean))].sort();
  const addedByOptions = [...new Set(investors.map((i) => i.added_by_name).filter(Boolean))].sort();
  const visible = investors.filter((i) => {
    const d = String(i.investment_date || '');
    if (range.from && d < range.from) return false;
    if (range.to && d > range.to) return false;
    if (schemeSel.length && !schemeSel.includes(i.scheme_name)) return false;
    if (addedBySel.length && !addedBySel.includes(i.added_by_name)) return false;
    return true;
  });
  const narrowed = !!(range.from || range.to || schemeSel.length || addedBySel.length || search);
  const groups = {};
  visible.forEach((i) => { const k = i.scheme_name || '—'; (groups[k] = groups[k] || []).push(i); });
  const groupNames = Object.keys(groups).sort();
  groupNames.forEach((g) => groups[g].sort((a, b) => String(b.investment_date || '').localeCompare(String(a.investment_date || ''))));
  const grandTotal = visible.reduce((t, i) => t + (Number(i.amount_invested) || 0), 0);
  const tabLabel = (TABS.find(([k]) => k === tab) || ['', 'All'])[1];
  // Short lists open by default; a long one starts folded so the scheme totals read first.
  const isOpen = (g) => (openGroup[g] === undefined ? (narrowed || visible.length <= 12) : openGroup[g]);

  if (!manager) return null;

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Investor Approvals</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{investors.length} {tab === 'all' ? 'total' : tab} investor{investors.length === 1 ? '' : 's'}</p>

      {canConfigureApprovers && (
        <div className="nx-card" style={{ background: 'var(--surface)', borderRadius: 18, padding: '14px 18px', marginTop: 18, border: '1px solid var(--surface-3)' }}>
          <button className="nx-btn nx-btn-sm nx-btn-ghost" onClick={() => setCfgOpen((o) => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: TEAL, padding: 0 }}>
            <Icon name="settings" /> Investor Approvers — by scheme {cfgOpen ? '▴' : '▾'} {savedCfg && <span style={{ color: savedCfg.startsWith('⚠') ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}> <Icon name={savedCfg.startsWith('⚠') ? 'alert' : 'check-circle'} /> {savedCfg.replace(/^[^\p{L}\p{N}]+/u, '')}</span>}
          </button>
          {cfgOpen && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>For each scheme, pick the managers who approve investors added under it. They get a notification on each new submission for that scheme.</div>
              {managers.length === 0 ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>No managers in this company.</div> : schemes.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderTop: '1px solid var(--surface-2)' }}>
                  <div style={{ width: 180, minWidth: 180, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.name}</div>
                  <ApproverDropdown scheme={s} managers={managers} onToggle={toggleApprover} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Investment-date range — the same control as Sales' approvals and the dashboards. */}
      <div className="c1a-dates"><DateFilter onChange={setRange} /></div>

      <div className="c1a-bar">
        <div className="c1a-tabs">
          {TABS.map(([k, label]) => (
            <button key={k} className={`nx-btn nx-btn-md nx-toggle${tab === k ? ' is-on' : ''}`} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <div className="nx-search-wrap c1a-search">
          <span className="nx-search-icon"><Icon name="search" /></span>
          <input className="nx-input nx-search-input" value={searchText} onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search name, phone, email, investor no.…" />
        </div>
        {schemeOptions.length > 1 && (
          <MultiSelect allLabel="All Schemes" noun="schemes" value={schemeSel} onChange={setSchemeSel}
            options={schemeOptions.map((n) => ({ value: n, label: n }))} />
        )}
        {addedByOptions.length > 1 && (
          <MultiSelect allLabel="All Added By" noun="people" value={addedBySel} onChange={setAddedBySel}
            options={addedByOptions.map((n) => ({ value: n, label: n }))} />
        )}
      </div>

      {!loading && visible.length > 0 && (
        <div className="c1a-total">
          <div className="c1a-total-label">
            {narrowed ? 'Matching' : 'Total'} {tabLabel} · {visible.length} investor{visible.length === 1 ? '' : 's'} · {groupNames.length} scheme{groupNames.length === 1 ? '' : 's'}
            {(range.from || range.to) && <span className="c1a-total-range"> · invested {range.from ? formatDMY(range.from) : '…'} → {range.to ? formatDMY(range.to) : '…'}</span>}
          </div>
          <div className="c1a-total-amt">{fmtMoney(grandTotal)}</div>
        </div>
      )}

      {loading ? <div className="c1a-loading"><Loader label="Loading…" /></div> : visible.length === 0 ? (
        <div className="nx-card c1a-empty">{search ? 'No investors match your search.' : narrowed ? 'No investors match these filters.' : 'No investors here.'}</div>
      ) : groupNames.map((gn) => (
        <div key={gn} className="c1a-group">
          <div className={`nx-card c1a-group-head${isOpen(gn) ? ' is-open' : ''}`} onClick={() => setOpenGroup((o) => ({ ...o, [gn]: !isOpen(gn) }))}>
            <div className="c1a-group-name"><Icon name="folder" /> {gn} <span className="c1a-group-count">· {groups[gn].length} investor{groups[gn].length === 1 ? '' : 's'}</span></div>
            <div className="c1a-group-right">
              <span className="c1a-group-amt">{fmtMoney(groups[gn].reduce((t, i) => t + (Number(i.amount_invested) || 0), 0))}</span>
              <span className={`c1a-chev${isOpen(gn) ? ' is-open' : ''}`}>›</span>
            </div>
          </div>
          {isOpen(gn) && (
            <div className="c1a-cards">
              {groups[gn].map((inv) => {
                const isRevision = !!inv.pending_revision;
                const isRenewal = isRevision && inv.pending_revision_type === 'renew';
                return (
                  <div className="nx-card c1a-card" key={inv.id}>
                    <div className="c1a-card-top">
                      <div className="c1a-card-main">
                        <div className="c1a-name">
                          {inv.name}
                          {inv.revision_no > 0 && <span className={`c1a-rev${isRenewal ? ' renew' : ''}`}>{isRenewal ? 'RENEW' : `R${inv.revision_no}`}</span>}
                        </div>
                        <div className="c1a-sub">{inv.phone || '—'}{inv.loi_no ? ` · LOI ${inv.loi_no}` : ''}</div>
                        <div className="c1a-sub2">Added by {inv.added_by_name || '—'} · Invested {inv.investment_date ? formatDMY(inv.investment_date) : '—'}{inv.maturity_date ? ` · Matures ${formatDMY(inv.maturity_date)}` : ''}</div>
                        {inv.approval_status === 'approved' && (
                          <div className="c1a-decided ok">Approved by {inv.approved_by_name || '—'}{inv.approved_at ? ` · ${formatDMY(String(inv.approved_at).slice(0, 10))}` : ''}</div>
                        )}
                        {isRevision && <div className="c1a-proposed">Proposed: {revisionSummary(inv)}</div>}
                      </div>
                      <div className="c1a-card-side">
                        <div className="c1a-amt">{fmtMoney(inv.amount_invested)}</div>
                        <ApprovalBadge approvalStatus={inv.approval_status} label={isRevision && inv.approval_status === 'pending' ? (isRenewal ? 'Renewal pending' : `Revision R${inv.revision_no} pending`) : ''} />
                      </div>
                    </div>
                    <div className="c1a-actions">
                      {isRevision
                        ? (inv.pending_loi_document_url && <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => openLoi(inv.id, true)}><Icon name="file" /> {isRenewal ? 'Renewed' : 'Revised'} LOI</button>)
                        : (inv.loi_document_url && <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => openLoi(inv.id)}><Icon name="file" /> Signed LOI</button>)}
                      {inv.approval_status === 'draft' && (
                        <button className="nx-btn nx-btn-sm nx-btn-secondary inv-draft-edit" onClick={() => setEditDraft(inv)}><Icon name="pencil" /> Edit &amp; Submit</button>
                      )}
                      {inv.approval_status === 'approved' && can(user, 'club.investor.manage') && (
                        <button className="nx-btn nx-btn-sm nx-btn-soft" onClick={() => setRevising(inv)}>↻ Revise LOI</button>
                      )}
                      {inv.approval_status === 'pending' && (canApprove(inv) ? <>
                        <button className="nx-btn nx-btn-sm nx-btn-success" onClick={() => act(inv.id, 'approve')} disabled={busy === inv.id}><Icon name="check" /> Approve</button>
                        <button className="nx-btn nx-btn-sm nx-btn-danger" onClick={() => act(inv.id, 'reject')} disabled={busy === inv.id}><Icon name="x" /> Reject</button>
                      </> : <span className="c1a-note">Not an approver</span>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {revising && (
        <AddInvestorModal schemes={schemes} revise={revising}
          onClose={() => setRevising(null)} onCreated={() => { setRevising(null); load(); }} />
      )}

      {editDraft && (
        <AddInvestorModal
          schemes={schemes}
          draft={editDraft}
          onClose={() => setEditDraft(null)}
          onCreated={() => { setEditDraft(null); load(); }}
        />
      )}
    </div>
  );
}
