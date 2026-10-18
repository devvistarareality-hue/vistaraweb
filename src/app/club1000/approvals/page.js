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
import { notify, confirmDialog, reasonDialog } from '../../../lib/notify';
import Loader from '../../../components/Loader';
import AddInvestorModal from '../_AddInvestorModal';
import { errText } from '../../../lib/apiError';

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
  return <span className="nx-badge c1a-badge" style={{ background: c.bg, color: c.fg }}>{label || approvalStatus}</span>;{/* inline-ok: colour per status */}
}

// Who approves investors under one scheme — the shared multi-select; each tick or
// untick is sent as one atomic toggle (see toggleApprover below).
function ApproverDropdown({ scheme, managers, onToggle, level = 1 }) {
  const key = level === 2 ? 'investor_approvers_l2' : 'investor_approvers';
  const sel = (scheme[key] || []).map(String);
  function change(next) {
    const now = new Set(next);
    managers.forEach((m) => {
      const id = String(m.id);
      if (now.has(id) !== sel.includes(id)) onToggle(scheme.id, m.id, level);
    });
  }
  return (
    <div className="c1a-approvers">
      <MultiSelect allLabel={level === 2 ? 'Level 2 (final) — none' : 'Level 1 approvers…'} noun={level === 2 ? 'level 2' : 'approvers'} value={sel} onChange={change}
        options={managers.map((m) => ({ value: String(m.id), label: m.designation ? `${m.name} · ${m.designation}` : m.name }))} />
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
  // Two-level schemes: level 1 approvers act first; once level 1 is done only
  // level 2 approvers can finish it (mirrors backend approval_gate).
  function canApprove(inv) {
    const scheme = schemes.find((s) => s.id === inv.scheme);
    const l2 = (scheme?.investor_approvers_l2 || []);
    const inL1 = isRealAdmin || (!!scheme && (scheme.investor_approvers || []).includes(user?.id));
    const inL2 = isRealAdmin || l2.includes(user?.id);
    if (!l2.length) return inL1;
    return inv.approval_step ? inL2 : inL1;
  }
  function approveLabel(inv) {
    const scheme = schemes.find((s) => s.id === inv.scheme);
    if (!(scheme?.investor_approvers_l2 || []).length) return 'Approve';
    return inv.approval_step ? 'Final approve' : 'Approve (level 1)';
  }

  const [tab, setTab] = useState('pending');
  const [investors, setInvestors] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [busyAct, setBusyAct] = useState('');   // which action the busy row is running
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

  async function toggleApprover(schemeId, mgrId, level = 1) {
    const key = level === 2 ? 'investor_approvers_l2' : 'investor_approvers';
    // Optimistic instant feedback — the atomic call below reconciles this
    // with the server's authoritative result once it returns.
    setSchemes((ss) => ss.map((s) => {
      if (s.id !== schemeId) return s;
      const cur = s[key] || [];
      return { ...s, [key]: cur.includes(mgrId) ? cur.filter((x) => x !== mgrId) : [...cur, mgrId] };
    }));

    const seq = (approverPatchSeq.current[schemeId] || 0) + 1;
    approverPatchSeq.current[schemeId] = seq;

    let result = null;
    try {
      const res = await apiFetch(CLUB1000_ENDPOINTS.schemeToggleApprover(schemeId), { method: 'POST', body: JSON.stringify({ manager_id: mgrId, level }) });
      if (res.ok) result = await res.json();
    } catch { /* result stays null */ }

    if (approverPatchSeq.current[schemeId] !== seq) return;

    if (result) {
      setSchemes((ss) => ss.map((s) => (s.id === schemeId ? { ...s, investor_approvers: result.investor_approvers, investor_approvers_l2: result.investor_approvers_l2 } : s)));
      setSavedCfg('Saved'); setTimeout(() => setSavedCfg(''), 1500);
    } else {
      // Undo the optimistic toggle — it never actually reached the DB, so the
      // UI shouldn't keep showing it as selected.
      setSchemes((ss) => ss.map((s) => {
        if (s.id !== schemeId) return s;
        const cur = s[key] || [];
        return { ...s, [key]: cur.includes(mgrId) ? cur.filter((x) => x !== mgrId) : [...cur, mgrId] };
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
    const inv = (investors || []).find((x) => x.id === id);
    const who = `${inv ? inv.name : 'this investor'}${inv?.scheme_name ? ` · ${inv.scheme_name}` : ''}`;
    // Approve asks to confirm; Reject asks why — required, and sent to whoever added it.
    let reason = '';
    if (action === 'approve') {
      if (!(await confirmDialog(`Approve ${who}?`, { title: 'Approve investor?', confirmText: 'Approve' }))) return;
    } else {
      reason = await reasonDialog(`Reject ${who}? Write why — whoever added it sees this.`,
        { title: 'Reject investor', confirmText: 'Reject', placeholder: 'e.g. Signed LOI missing, KYC unclear' });
      if (!reason) return;
    }
    setBusy(id); setBusyAct(action);
    try {
      const res = await apiFetch(CLUB1000_ENDPOINTS.investorAction(id), { method: 'POST', body: JSON.stringify(reason ? { action, reason } : { action }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(errText(data, `Could not ${action} this investor.`));
        return;
      }
      const out = await res.json().catch(() => ({}));
      notify(action === 'approve' ? (out.level === 1 ? 'Approved at level 1 — sent to level 2' : 'Investor approved') : 'Investor rejected', 'success');
      load();
    } finally {
      setBusy(null); setBusyAct('');
    }
  }

  // A requested delete / undo-renewal: approve carries it out, reject says why.
  async function actRequest(inv, action) {
    const what = inv.pending_action?.type === 'delete' ? 'delete' : 'undo the renewal of';
    let reason = '';
    if (action === 'approve') {
      if (!(await confirmDialog(`Approve: ${what} ${inv.name}${inv.loi_no ? ` (LOI ${inv.loi_no})` : ''}? ${inv.pending_action?.type === 'delete' ? 'The investment, its payouts and rewards are deleted.' : 'It goes back to the term before.'} This can't be undone.`,
        { title: 'Approve request?', confirmText: 'Approve', tone: 'danger' }))) return;
    } else {
      reason = await reasonDialog(`Reject the request to ${what} ${inv.name}? Write why — whoever asked sees this.`,
        { title: 'Reject request', confirmText: 'Reject', placeholder: 'e.g. Keep it — payment is genuine' });
      if (!reason) return;
    }
    setBusy(inv.id); setBusyAct(action);
    try {
      const res = await apiFetch(CLUB1000_ENDPOINTS.investorPendingAction(inv.id), { method: 'POST', body: JSON.stringify(reason ? { action, reason } : { action }) });
      if (!res.ok) { notify(errText(await res.json().catch(() => ({})), 'Could not complete it.'), 'error'); return; }
      const out = await res.json().catch(() => ({}));
      notify(action === 'approve' ? (out.level === 1 ? 'Approved at level 1 — sent to level 2' : (inv.pending_action?.type === 'delete' ? 'Investor deleted' : 'Renewal undone')) : 'Request rejected', 'success');
      load();
    } finally { setBusy(null); setBusyAct(''); }
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
    <div className="nx-page ard">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Investor Approvals</h1>
          <p className="nx-page-sub">{investors.length} {tab === 'all' ? 'total' : tab} investor{investors.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      {canConfigureApprovers && (
        <div className="nx-card c1a-cfg">
          <button type="button" className="nx-btn nx-btn-sm nx-btn-ghost c1a-cfg-toggle" onClick={() => setCfgOpen((o) => !o)}>
            <Icon name="settings" /> Investor Approvers — by scheme {cfgOpen ? '▴' : '▾'}
            {savedCfg && <span className={savedCfg.startsWith('⚠') ? 'c1a-cfg-bad' : 'c1a-cfg-ok'}> {savedCfg.replace(/^[^\p{L}\p{N}]+/u, '')}</span>}
          </button>
          {cfgOpen && (
            <div className="c1a-cfg-body">
              <div className="c1-help">For each scheme, pick who approves investors added under it. <b>Level 1</b> approves first; if <b>Level 2</b> is set, their approval is the final one (a level 1 approval only passes it on). Leave Level 2 empty for single-step approval.</div>
              <div className="c1a-cfg-row c1a-cfg-head"><div className="c1a-cfg-name">Scheme</div><span>Level 1</span><span>Level 2 · final</span></div>
              {managers.length === 0 ? <div className="c1-help">No managers in this company.</div> : schemes.map((sc) => (
                <div key={sc.id} className="c1a-cfg-row">
                  <div className="c1a-cfg-name">{sc.name}</div>
                  <ApproverDropdown scheme={sc} managers={managers} onToggle={toggleApprover} />
                  <ApproverDropdown scheme={sc} managers={managers} onToggle={toggleApprover} level={2} />
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
                        {inv.approval_status === 'rejected' && inv.rejected_reason && (
                          <div className="bk-reason"><b>Rejected — reason</b><span>{inv.rejected_reason}</span></div>
                        )}
                        {/* Revisions / renewals turned down — the investment stays on its old terms. */}
                        {inv.approval_step && (
                          <div className="c1a-decided ok">Level 1 approved by {inv.approval_step.by_name || '—'}{inv.approval_step.at ? ` · ${formatDMY(String(inv.approval_step.at).slice(0, 10))}` : ''} — waiting for level 2</div>
                        )}
                        {inv.pending_action && (
                          <div className="bk-reason c1-request">
                            <b>{inv.pending_action.type === 'delete' ? 'Delete requested' : 'Undo renewal requested'} by {inv.pending_action.by_name || '—'}{inv.pending_action.at ? ` · ${formatDMY(String(inv.pending_action.at).slice(0, 10))}` : ''}{inv.pending_action.include_paid ? ' · payments already made go with it' : ''}</b>
                            <span>{inv.pending_action.reason}</span>
                          </div>
                        )}
                        {(inv.rejections || []).slice().reverse().map((rj, k) => (
                          <div key={k} className="bk-reason">
                            <b>{rj.kind === 'renewal' ? 'Renewal' : rj.kind === 'delete' ? 'Delete request' : rj.kind === 'undo-renewal' ? 'Undo-renewal request' : rj.kind === 'undone-renewal' ? 'Renewal' : 'Revision'} {rj.kind === 'delete' || rj.kind === 'undo-renewal' ? '' : `R${rj.no} `}{rj.kind === 'undone-renewal' ? 'undone' : 'rejected'}{rj.by ? ` by ${rj.by}` : ''}{rj.at ? ` · ${formatDMY(String(rj.at).slice(0, 10))}` : ''}{Number(rj.amount) ? ` · proposed ${fmtMoney(rj.amount)}` : ''}</b>
                            <span>{rj.reason}</span>
                          </div>
                        ))}
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
                      {inv.pending_action && (canApprove(inv) ? <>
                        <button className="nx-btn nx-btn-sm nx-btn-danger" onClick={() => actRequest(inv, 'approve')} disabled={busy === inv.id}>{busy === inv.id && busyAct === 'approve' ? <><span className="nx-spin" aria-hidden="true" /> Working…</> : <><Icon name="check" /> {approveLabel(inv) === 'Approve' ? 'Approve' : approveLabel(inv)} {inv.pending_action.type === 'delete' ? 'delete' : 'undo'}</>}</button>
                        <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => actRequest(inv, 'reject')} disabled={busy === inv.id}>{busy === inv.id && busyAct === 'reject' ? <><span className="nx-spin" aria-hidden="true" /> Rejecting…</> : <><Icon name="x" /> Reject</>}</button>
                      </> : <span className="c1a-note">Not an approver</span>)}
                      {inv.approval_status === 'pending' && (canApprove(inv) ? <>
                        <button className="nx-btn nx-btn-sm nx-btn-success" onClick={() => act(inv.id, 'approve')} disabled={busy === inv.id}>{busy === inv.id && busyAct === 'approve' ? <><span className="nx-spin" aria-hidden="true" /> Approving…</> : <><Icon name="check" /> {approveLabel(inv)}</>}</button>
                        <button className="nx-btn nx-btn-sm nx-btn-danger" onClick={() => act(inv.id, 'reject')} disabled={busy === inv.id}>{busy === inv.id && busyAct === 'reject' ? <><span className="nx-spin" aria-hidden="true" /> Rejecting…</> : <><Icon name="x" /> Reject</>}</button>
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
