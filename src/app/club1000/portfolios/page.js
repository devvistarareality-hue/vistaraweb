'use client';
// Investor Portfolios — one card per person (same number and name), whatever number
// of investments, renewals and schemes they hold; a card opens the full portfolio.
import { useEffect, useMemo, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import { formatDMY } from '../../../lib/dateFormat';
import { errText } from '../../../lib/apiError';
import Icon from '../../../components/Icon';
import Loader from '../../../components/Loader';
import { fmtMoney } from '../_StatCard';
import PortfolioModal from '../_PortfolioModal';

const SORTS = [
  ['active', 'Biggest active holding', (r) => -Number(r.active_amount)],
  ['times', 'Most times invested', (r) => -r.times_invested],
  ['referrals', 'Most people referred', (r) => -r.referrals],
  ['since', 'Longest with us', (r) => String(r.since || '9999')],
];

export default function PortfoliosPage() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [scheme, setScheme] = useState('');
  const [sort, setSort] = useState('active');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    apiFetch(CLUB1000_ENDPOINTS.portfolios)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.ok) setRows(d); else { setErr(errText(d, 'Could not load portfolios.')); setRows([]); }
      })
      .catch(() => { setErr('Could not reach the server.'); setRows([]); });
  }, []);

  const schemes = useMemo(() => [...new Set((rows || []).flatMap((r) => r.schemes.map((s) => s.scheme)))].sort(), [rows]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    const by = SORTS.find((s) => s[0] === sort)[2];
    return (rows || [])
      .filter((r) => !q || (r.name || '').toLowerCase().includes(q) || (digits && String(r.phone || '').replace(/\D/g, '').includes(digits)))
      .filter((r) => !scheme || r.schemes.some((s) => s.scheme === scheme))
      .sort((a, b) => (by(a) < by(b) ? -1 : by(a) > by(b) ? 1 : 0));
  }, [rows, search, scheme, sort]);

  const totals = useMemo(() => (rows || []).reduce((t, r) => ({
    people: t.people + 1, active: t.active + Number(r.active_amount), repeat: t.repeat + (r.times_invested > 1 ? 1 : 0),
    referrers: t.referrers + (r.referrals > 0 ? 1 : 0),
  }), { people: 0, active: 0, repeat: 0, referrers: 0 }), [rows]);

  return (
    <div className="nx-page ard">
      <h1 className="nx-page-title">Investor Portfolios</h1>
      <p className="club-inv-sub">Each person once — every investment and renewal under their number and name, the schemes they hold and the people they brought in.</p>

      {rows && rows.length > 0 && (
        <div className="c1hx-stats c1pf-top">
          <div><span>Investors</span><b>{totals.people}</b></div>
          <div><span>Active with the club</span><b>{fmtMoney(totals.active)}</b></div>
          <div><span>Invested more than once</span><b>{totals.repeat}</b></div>
          <div><span>Brought someone in</span><b>{totals.referrers}</b></div>
        </div>
      )}

      <div className="club-pay-search">
        <span className="club-pay-search-ico"><Icon name="search" /></span>
        <input className="nx-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or mobile" />
        {search && <button type="button" className="club-pay-clear" onClick={() => setSearch('')}><Icon name="x" /></button>}
      </div>
      <div className="club-inv-filters">
        <select className="nx-input club-inv-sel" value={scheme} onChange={(e) => setScheme(e.target.value)}>
          <option value="">All schemes</option>
          {schemes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="nx-input club-inv-sel" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {err && <div className="nx-note bad">{err}</div>}
      {!rows ? <Loader size="sm" /> : shown.length === 0 ? (
        <div className="nx-card club-empty-cell">{rows.length ? 'No one matches these filters.' : 'No investors yet.'}</div>
      ) : (
        <div className="c1pf-grid">
          {shown.map((r) => (
            <button key={r.id} type="button" className="nx-card c1pf-card" onClick={() => setOpen(r.id)}>
              <div className="c1pf-card-head">
                <div>
                  <div className="c1pf-name">{r.name}</div>
                  <div className="c1pf-phone">{r.phone}{r.since ? ` · since ${formatDMY(r.since)}` : ''}</div>
                </div>
                <div className="c1pf-amt">{fmtMoney(r.active_amount)}<small>active</small></div>
              </div>
              <div className="c1pf-chips">
                <span className="c1pf-chip"><Icon name="refresh" /> {r.times_invested}× invested</span>
                <span className="c1pf-chip"><Icon name="book" /> {r.schemes.length} scheme{r.schemes.length === 1 ? '' : 's'}</span>
                <span className={`c1pf-chip${r.referrals ? ' is-ref' : ''}`}><Icon name="users" /> {r.referrals} referred</span>
                {Number(r.due_now) > 0 && <span className="c1pf-chip is-due"><Icon name="clock" /> {fmtMoney(r.due_now)} due</span>}
              </div>
              <div className="c1pf-foot">
                <span>Ever invested <b>{fmtMoney(r.total_invested)}</b></span>
                <span>Paid out <b>{fmtMoney(r.paid_out)}</b></span>
                <span>{r.schemes.map((s) => s.scheme).join(' · ')}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && <PortfolioModal investorId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
