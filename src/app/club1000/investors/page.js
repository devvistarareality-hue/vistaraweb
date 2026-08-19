'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import { isClub1000Manager } from '../../../lib/moduleAccess';
import { formatDMY } from '../../../lib/dateFormat';
import { fmtMoney } from '../_StatCard';
import AddInvestorModal from '../_AddInvestorModal';
import ReviseInvestorModal from '../_ReviseInvestorModal';
import RenewInvestorModal from '../_RenewInvestorModal';
import LedgerModal from '../_LedgerModal';

const TEAL = '#00838F';
const PURPLE = '#7C3AED';
const AMBER = '#D97706';
const th = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', borderTop: '1px solid #F5F6FA', color: '#1A1A2E' };

const STATUS_COLORS = {
  active: { bg: '#E8F5E9', fg: '#2E7D32' },
  matured: { bg: '#E3F2FD', fg: '#1565C0' },
  redeemed: { bg: '#F3E5F5', fg: '#7B1FA2' },
  premature_redeemed: { bg: '#FFF3E0', fg: '#E65100' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: '#F3F4F6', fg: '#6B7280' };
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: c.bg, color: c.fg, textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</span>;
}

export default function InvestorsPage() {
  const user = useSelector((s) => s.auth.user);
  const manager = isClub1000Manager(user);
  const [investors, setInvestors] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [revising, setRevising] = useState(null);
  const [renewing, setRenewing] = useState(null);
  const [ledgerFor, setLedgerFor] = useState(null);
  const [schemeFilter, setSchemeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  // Search box is debounced: typing updates `searchText` instantly (responsive UI)
  // but only commits to `search` (which triggers the fetch) after a pause.
  const [searchText, setSearchText] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText), 400);
    return () => clearTimeout(t);
  }, [searchText]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (schemeFilter) params.set('scheme_id', schemeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      // The approved portfolio only — pending/rejected submissions live on the
      // dedicated Approvals page (managers) until they're actioned.
      params.set('approval_status', 'approved');
      const qs = `?${params.toString()}`;
      const [invRes, schemesRes] = await Promise.all([
        apiFetch(`${CLUB1000_ENDPOINTS.investors}${qs}`),
        apiFetch(CLUB1000_ENDPOINTS.schemes),
      ]);
      if (invRes.ok) setInvestors(await invRes.json());
      if (schemesRes.ok) setSchemes(await schemesRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [schemeFilter, statusFilter, search]);

  async function openLoi(id) {
    const res = await apiFetch(CLUB1000_ENDPOINTS.investorLoiUrl(id));
    const data = await res.json();
    if (res.ok && data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    else alert(data?.detail || 'Could not open the LOI.');
  }

  async function redeem(id) {
    if (!confirm('Redeem this investment now? This applies the premature-redemption rate for the elapsed period.')) return;
    const res = await apiFetch(CLUB1000_ENDPOINTS.investorRedeem(id), { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.detail || 'Could not redeem.');
      return;
    }
    load();
  }

  async function maturePayout(id) {
    if (!confirm('Pay out this matured investment now? The investor will be marked redeemed — mark the scheduled maturity payout paid separately from the Payouts screen.')) return;
    const res = await apiFetch(CLUB1000_ENDPOINTS.investorMaturePayout(id), { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.detail || 'Could not process the payout.');
      return;
    }
    load();
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E' }}>Investors</h1>
          <p style={{ fontSize: 13, color: '#8492A6', marginTop: 4 }}>
            {manager ? 'All approved investors across Club 1000' : 'Your approved investors'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button onClick={() => setShowAdd(true)} disabled={!schemes.length} style={{ padding: '10px 18px', background: TEAL, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: schemes.length ? 'pointer' : 'default', opacity: schemes.length ? 1 : 0.6 }}>+ Add Investor</button>
          {!loading && !schemes.length && (
            <div style={{ fontSize: 11, color: '#E65100' }}>{manager ? 'Create a scheme first.' : 'No schemes yet — ask your manager to create one.'}</div>
          )}
        </div>
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

      <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
        <select value={schemeFilter} onChange={(e) => setSchemeFilter(e.target.value)} style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid #C6D0DB', fontSize: 12 }}>
          <option value="">All Schemes</option>
          {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid #C6D0DB', fontSize: 12 }}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="matured">Matured</option>
          <option value="redeemed">Redeemed</option>
          <option value="premature_redeemed">Premature Redeemed</option>
        </select>
      </div>

      <div style={{ marginTop: 18, background: '#fff', borderRadius: 16, border: '1px solid #EDF1F7', overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
              <th style={th}>Name</th>
              <th style={th}>Mobile</th>
              <th style={th}>Scheme</th>
              <th style={th}>Reference</th>
              <th style={th}>Amount</th>
              <th style={th}>Return %</th>
              <th style={th}>Payout</th>
              <th style={th}>Invested</th>
              <th style={th}>Matures</th>
              <th style={th}>Document</th>
              <th style={th}>LOI</th>
              <th style={th}>Status</th>
              {manager && <th style={th}>Added By</th>}
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} style={{ ...td, textAlign: 'center', color: '#8492A6' }}>Loading…</td></tr>
            ) : investors.length === 0 ? (
              <tr><td colSpan={14} style={{ ...td, textAlign: 'center', color: '#8492A6' }}>{search ? 'No investors match your search.' : 'No investors yet.'}</td></tr>
            ) : investors.map((inv) => (
              <tr key={inv.id}>
                <td style={td}>
                  {inv.name}
                  {inv.revision_no > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: PURPLE, background: '#F3E8FF', padding: '2px 7px', borderRadius: 20 }}>R{inv.revision_no}</span>}
                  {inv.is_matured && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: AMBER, background: '#FEF3C7', padding: '2px 7px', borderRadius: 20 }}>MATURED</span>}
                </td>
                <td style={td}>{inv.phone || '—'}</td>
                <td style={td}>{inv.scheme_name}</td>
                <td style={td}>{inv.reference_name ? `${inv.reference_name}${inv.reference_phone ? ` — ${inv.reference_phone}` : ''}` : '—'}</td>
                <td style={td}>{fmtMoney(inv.amount_invested)}</td>
                <td style={td}>{inv.total_return_pct}%</td>
                <td style={td}>{inv.interest_payout === 'monthly' ? 'Monthly' : inv.interest_payout === 'quarterly' ? 'Quarterly' : 'Maturity'}</td>
                <td style={td}>{formatDMY(inv.investment_date)}</td>
                <td style={td}>{formatDMY(inv.maturity_date)}</td>
                <td style={td}>
                  {inv.document_url ? <a href={inv.document_url} target="_blank" rel="noreferrer" style={{ color: TEAL, fontWeight: 700, textDecoration: 'none' }}>View</a> : '—'}
                </td>
                <td style={td}>
                  {inv.loi_document_url ? <button onClick={() => openLoi(inv.id)} style={{ background: 'none', border: 'none', color: TEAL, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 13 }}>View LOI</button> : '—'}
                </td>
                <td style={td}><StatusBadge status={inv.status} /></td>
                {manager && <td style={td}>{inv.added_by_name || '—'}</td>}
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setLedgerFor(inv.id)} style={{ padding: '5px 10px', background: '#E0F2F1', color: TEAL, border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>📒 Ledger</button>
                    <button onClick={() => setRevising(inv)} style={{ padding: '5px 10px', background: '#F3E8FF', color: PURPLE, border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↻ Revise LOI</button>
                    {inv.is_matured ? (
                      <>
                        <button onClick={() => setRenewing(inv)} style={{ padding: '5px 10px', background: '#FEF3C7', color: AMBER, border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↻ Renew</button>
                        {manager && (
                          <button onClick={() => maturePayout(inv.id)} style={{ padding: '5px 10px', background: '#FFF3E0', color: '#E65100', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Payout</button>
                        )}
                      </>
                    ) : (
                      manager && inv.status === 'active' && (
                        <button onClick={() => redeem(inv.id)} style={{ padding: '5px 10px', background: '#FFF3E0', color: '#E65100', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Redeem</button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddInvestorModal schemes={schemes} onClose={() => setShowAdd(false)} onCreated={() => load()} />
      )}
      {revising && (
        <ReviseInvestorModal
          investor={revising}
          scheme={schemes.find((s) => String(s.id) === String(revising.scheme))}
          onClose={() => setRevising(null)}
          onSaved={() => load()}
        />
      )}
      {renewing && (
        <RenewInvestorModal
          investor={renewing}
          scheme={schemes.find((s) => String(s.id) === String(renewing.scheme))}
          onClose={() => setRenewing(null)}
          onSaved={() => load()}
        />
      )}
      {ledgerFor && (
        <LedgerModal investorId={ledgerFor} onClose={() => setLedgerFor(null)} />
      )}
    </div>
  );
}
