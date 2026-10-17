'use client';
// Investor Portfolios — one row per mobile number, ranked: everything invested under
// it (each reinvestment counted), the schemes, what is active and due, and the people
// brought in. A row opens the full portfolio in a side panel.
import { useEffect, useMemo, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import { errText } from '../../../lib/apiError';
import Icon from '../../../components/Icon';
import Loader from '../../../components/Loader';
import { fmtMoney } from '../_StatCard';
import PortfolioModal, { Avatar } from '../_PortfolioModal';

const SORTS = [
  ['active', 'Biggest active holding', (r) => -Number(r.active_amount)],
  ['times', 'Most times invested', (r) => -r.times_invested],
  ['referrals', 'Most people referred', (r) => -r.referrals],
  ['due', 'Most due now', (r) => -Number(r.due_now)],
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
      .filter((r) => !q || (r.names || [r.name]).some((n) => (n || '').toLowerCase().includes(q))
        || (digits && String(r.phone || '').replace(/\D/g, '').includes(digits)))
      .filter((r) => !scheme || r.schemes.some((s) => s.scheme === scheme))
      .sort((a, b) => (by(a) < by(b) ? -1 : by(a) > by(b) ? 1 : 0));
  }, [rows, search, scheme, sort]);
  const top = Math.max(1, ...(rows || []).map((r) => Number(r.active_amount)));

  const t = useMemo(() => (rows || []).reduce((a, r) => ({
    people: a.people + 1, active: a.active + Number(r.active_amount), ever: a.ever + Number(r.total_invested),
    repeat: a.repeat + (r.times_invested > 1 ? 1 : 0), due: a.due + Number(r.due_now), referred: a.referred + r.referrals,
  }), { people: 0, active: 0, ever: 0, repeat: 0, due: 0, referred: 0 }), [rows]);

  return (
    <div className="nx-page ard">
      <h1 className="nx-page-title">Investor Portfolios</h1>
      <p className="club-inv-sub">One line per mobile number — every investment and reinvestment under it, its schemes, and the people it brought in.</p>

      {rows && rows.length > 0 && (
        <div className="nx-card c1pf-band">
          <div className="c1pf-band-hero"><span>Active with the club</span><b>{fmtMoney(t.active)}</b><small>Ever invested {fmtMoney(t.ever)}</small></div>
          <div><span>Portfolios</span><b>{t.people}</b><small>{t.repeat} invested more than once</small></div>
          <div><span>Brought in by investors</span><b>{t.referred}</b><small>people referred</small></div>
          <div className={t.due > 0 ? 'is-due' : ''}><span>Due now</span><b>{fmtMoney(t.due)}</b><small>payouts past their date</small></div>
        </div>
      )}

      <div className="c1pf-tools">
        <div className="club-pay-search c1pf-search">
          <span className="club-pay-search-ico"><Icon name="search" /></span>
          <input className="nx-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or mobile" />
          {search && <button type="button" className="club-pay-clear" onClick={() => setSearch('')}><Icon name="x" /></button>}
        </div>
        <select className={`nx-input club-inv-sel${scheme ? ' is-on' : ''}`} value={scheme} onChange={(e) => setScheme(e.target.value)}>
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
        <div className="nx-card c1pf-list">
          <div className="c1pf-lhead">
            <span>Investor</span><span>Invested</span><span>Schemes</span><span>Active holding</span><span>Due now</span><span>Referred</span>
          </div>
          {shown.map((r, i) => (
            <button key={r.id} type="button" className="c1pf-row" onClick={() => setOpen(r.id)}>
              <span className="c1pf-who">
                <span className="c1pf-rank">{i + 1}</span>
                <Avatar name={r.name} seed={r.phone} />
                <span className="c1pf-who-txt">
                  <b>{r.name}{r.names?.length > 1 && <em className="c1pf-more">+{r.names.length - 1} name{r.names.length > 2 ? 's' : ''}</em>}</b>
                  <small>{r.phone}{r.since ? ` · since ${String(r.since).slice(0, 4)}` : ''}</small>
                </span>
              </span>
              <span className="c1pf-times" data-label="Invested">
                <b>{r.times_invested}×</b>
                <small>{r.renewals ? `${r.investments} + ${r.renewals} reinvested` : `${r.investments} investment${r.investments === 1 ? '' : 's'}`}</small>
              </span>
              <span className="c1pf-schips" data-label="Schemes">
                {r.schemes.map((s) => <em key={s.scheme}>{s.scheme}{s.count > 1 ? ` ×${s.count}` : ''}</em>)}
              </span>
              <span className="c1pf-hold" data-label="Active">
                <b>{fmtMoney(r.active_amount)}</b>
                <span className="c1pf-meter"><i style={{ width: `${(Number(r.active_amount) / top) * 100}%` }} /></span>{/* inline-ok: share of the biggest holding */}
                <small>ever {fmtMoney(r.total_invested)}</small>
              </span>
              <span className={`c1pf-due${Number(r.due_now) > 0 ? ' is-due' : ''}`} data-label="Due now">
                {Number(r.due_now) > 0 ? fmtMoney(r.due_now) : '—'}
              </span>
              <span className={`c1pf-ref${r.referrals ? ' has' : ''}`} data-label="Referred">
                <Icon name="users" /> {r.referrals}
              </span>
              <span className="c1pf-go">›</span>
            </button>
          ))}
        </div>
      )}

      {open && <PortfolioModal investorId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
