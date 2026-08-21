'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { CLUB1000_ENDPOINTS, SALES_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import {isClub1000Manager, isManagerRole} from '../../../lib/moduleAccess';
import { fmtMoney } from '../_StatCard';

const TEAL = '#00838F';
const PURPLE = '#7C3AED';
const AMBER = '#D97706';
const th = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', borderTop: '1px solid #F5F6FA', color: '#1A1A2E' };

const APPROVAL_COLORS = {
  pending: { bg: '#FEF3C7', fg: '#B45309' },
  approved: { bg: '#E8F5E9', fg: '#15803D' },
  rejected: { bg: '#FEE2E2', fg: '#DC2626' },
};
const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']];

function ApprovalBadge({ approvalStatus }) {
  const c = APPROVAL_COLORS[approvalStatus] || { bg: '#F3F4F6', fg: '#6B7280' };
  return <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: c.bg, color: c.fg, textTransform: 'uppercase' }}>{approvalStatus}</span>;
}

function ApproverDropdown({ scheme, managers, onToggle }) {
  const [open, setOpen] = useState(false);
  const sel = scheme.investor_approvers || [];
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
                <div key={m.id} onClick={() => onToggle(scheme.id, m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 7, cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F5F7FC'} onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#fff', background: on ? TEAL : '#fff', border: `1.5px solid ${on ? TEAL : '#CBD5E1'}` }}>{on ? '✓' : ''}</span>
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

export default function InvestorApprovalsPage() {
  const user = useSelector((s) => s.auth.user);
  const router = useRouter();
  const manager = isClub1000Manager(user);

  const [tab, setTab] = useState('pending');
  const [investors, setInvestors] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

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

  async function toggleApprover(schemeId, mgrId) {
    let next = [];
    setSchemes((ss) => ss.map((s) => {
      if (s.id !== schemeId) return s;
      const arr = s.investor_approvers || [];
      next = arr.includes(mgrId) ? arr.filter((x) => x !== mgrId) : [...arr, mgrId];
      return { ...s, investor_approvers: next };
    }));
    await apiFetch(CLUB1000_ENDPOINTS.scheme(schemeId), { method: 'PATCH', body: JSON.stringify({ investor_approvers: next }) }).catch(() => {});
    setSavedCfg('Saved ✓'); setTimeout(() => setSavedCfg(''), 1500);
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
    else alert(data?.detail || 'Could not open the LOI.');
  }

  const FIELD_LABELS = { amount_invested: 'Amount', total_return_pct: 'Return %', interest_payout: 'Payout', security: 'Security', notes: 'Notes', investment_date: 'Renewal Date' };
  function revisionSummary(inv) {
    const pr = inv.pending_revision;
    if (!pr) return null;
    return Object.entries(pr).filter(([k]) => k !== 'payout_schedule').map(([k, v]) => `${FIELD_LABELS[k] || k}: ${v}`).join(' · ');
  }

  async function act(id, action) {
    setBusy(id);
    try {
      const res = await apiFetch(CLUB1000_ENDPOINTS.investorAction(id), { method: 'POST', body: JSON.stringify({ action }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.detail || `Could not ${action} this investor.`);
        return;
      }
      load();
    } finally {
      setBusy(null);
    }
  }

  if (!manager) return null;

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E' }}>Investor Approvals</h1>
      <p style={{ fontSize: 13, color: '#8492A6', marginTop: 4 }}>{investors.length} {tab === 'all' ? 'total' : tab} investor{investors.length === 1 ? '' : 's'}</p>

      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginTop: 18, border: '1px solid #EDF1F7' }}>
        <button onClick={() => setCfgOpen((o) => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: TEAL, padding: 0 }}>
          ⚙ Investor Approvers — by scheme {cfgOpen ? '▴' : '▾'} {savedCfg && <span style={{ color: '#15803D', fontWeight: 700 }}> {savedCfg}</span>}
        </button>
        {cfgOpen && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#8492A6', marginBottom: 8 }}>For each scheme, pick the managers who approve investors added under it. They get a notification on each new submission for that scheme.</div>
            {managers.length === 0 ? <div style={{ fontSize: 13, color: '#8492A6' }}>No managers in this company.</div> : schemes.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderTop: '1px solid #F0F3FA' }}>
                <div style={{ width: 180, minWidth: 180, fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{s.name}</div>
                <ApproverDropdown scheme={s} managers={managers} onToggle={toggleApprover} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, position: 'relative', maxWidth: 360 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#B0BAD0' }}>🔍</span>
        <input value={searchText} onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search name, phone, email, investor no.…"
          style={{ width: '100%', height: 38, padding: '0 12px 0 36px', borderRadius: 8, border: '1.5px solid #C6D0DB', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
        {searchText && (
          <button onClick={() => setSearchText('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8492A6', cursor: 'pointer', fontSize: 14 }}>✕</button>
        )}
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: tab === k ? TEAL : '#EEF1F7', color: tab === k ? '#fff' : '#8492A6' }}>{label}</button>
        ))}
      </div>

      {loading ? <p style={{ color: '#8492A6', marginTop: 18 }}>Loading…</p> : investors.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8492A6', marginTop: 18, border: '1px solid #EDF1F7' }}>{search ? 'No investors match your search.' : 'No investors here.'}</div>
      ) : (
        <div style={{ marginTop: 18, background: '#fff', borderRadius: 16, border: '1px solid #EDF1F7', overflow: 'hidden', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                <th style={th}>Name</th>
                <th style={th}>Mobile</th>
                <th style={th}>Scheme</th>
                <th style={th}>Amount</th>
                <th style={th}>Added By</th>
                <th style={th}>Submitted</th>
                <th style={th}>LOI</th>
                <th style={th}>Approval</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {investors.map((inv) => {
                const isRevision = !!inv.pending_revision;
                const isRenewal = isRevision && inv.pending_revision_type === 'renew';
                const accent = isRenewal ? AMBER : PURPLE;
                return (
                <tr key={inv.id}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {inv.name}
                    {inv.revision_no > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: accent, background: isRenewal ? '#FEF3C7' : '#F3E8FF', padding: '2px 7px', borderRadius: 20 }}>{isRenewal ? 'RENEW' : 'R'}{isRenewal ? '' : inv.revision_no}</span>}
                    {isRevision && <div style={{ fontSize: 11, fontWeight: 500, color: '#8492A6', marginTop: 3 }}>Proposed: {revisionSummary(inv)}</div>}
                  </td>
                  <td style={td}>{inv.phone || '—'}</td>
                  <td style={td}>{inv.scheme_name}</td>
                  <td style={td}>{fmtMoney(inv.amount_invested)}</td>
                  <td style={td}>{inv.added_by_name || '—'}</td>
                  <td style={td}>{new Date(inv.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td style={td}>
                    {isRevision
                      ? (inv.pending_loi_document_url ? <button onClick={() => openLoi(inv.id, true)} style={{ background: 'none', border: 'none', color: accent, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 13 }}>📄 {isRenewal ? 'Renewed' : 'Revised'} LOI</button> : '—')
                      : (inv.loi_document_url ? <button onClick={() => openLoi(inv.id)} style={{ background: 'none', border: 'none', color: TEAL, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 13 }}>📄 Signed LOI</button> : '—')}
                  </td>
                  <td style={td}><ApprovalBadge approvalStatus={inv.approval_status} /></td>
                  <td style={td}>
                    {inv.approval_status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => act(inv.id, 'approve')} disabled={busy === inv.id} style={{ padding: '5px 10px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Approve</button>
                        <button onClick={() => act(inv.id, 'reject')} disabled={busy === inv.id} style={{ padding: '5px 10px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕ Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
