'use client';
import { useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import { fmtMoney } from './_StatCard';

import Loader from '../../components/Loader';
import { errText } from '../../lib/apiError';
import { C1Modal, C1Error } from './_Form';

const TYPE_COLOR = {
  investment: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  interest: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  maturity: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  premature_redemption: { bg: 'var(--warning-soft)', fg: 'var(--warning-2)' },
};
const STATUS_COLOR = {
  completed: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  paid: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  pending: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
};

// Type / status pill — the colour comes from the maps above.
function Badge({ label, color }) {
  return <span className="c1l-badge" style={{ background: color.bg, color: color.fg }}>{label.replace(/_/g, ' ')}</span>;{/* inline-ok: colour per type/status */}
}

export default function LedgerModal({ investorId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch(CLUB1000_ENDPOINTS.investorLedger(investorId))
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.ok) setData(d); else setErr(errText(d, 'Could not load the ledger.'));
      })
      .catch((e) => !cancelled && setErr(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [investorId]);

  const inv = data?.investor;
  const s = data?.summary;

  return (
    <C1Modal wide title={`Ledger${inv ? ` — ${inv.name}` : ''}`} sub={inv ? `${inv.phone} · ${inv.scheme_name}` : null} onClose={onClose}>
      {loading ? <Loader label="Loading…" /> : err ? <C1Error>{err}</C1Error> : (
        <>
          <div className="c1l-sum">
            {[
              ['Invested', s.total_invested, ''],
              ['Total scheduled', s.total_payout_due, ''],
              ['Paid out', s.total_paid, 'good'],
              ['Pending', s.total_pending, 'warn'],
            ].map(([label, val, tone]) => (
              <div key={label} className={`ard-money ${tone}`}><span>{label}</span><b>{fmtMoney(val)}</b></div>
            ))}
          </div>
          <div className="nx-card c1l-table">
            <table className="nx-table">
              <thead>
                <tr>{['Date', 'Type', 'Amount', 'Status', 'Paid on'].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.entries.map((e, i) => (
                  <tr key={i}>
                    <td>{formatDMY(e.date)}</td>
                    <td><Badge label={e.label} color={TYPE_COLOR[e.type] || { bg: 'var(--surface-2)', fg: 'var(--text-3)' }} /></td>
                    <td className="c1l-amt">
                      {fmtMoney(e.amount)}
                      {e.paid_amount != null && Number(e.paid_amount) !== Number(e.amount) && <div className="c1l-paid">Paid {fmtMoney(e.paid_amount)}</div>}
                      {!!e.notes && <div className="c1l-note">“{e.notes}”</div>}
                    </td>
                    <td><Badge label={e.status} color={STATUS_COLOR[e.status] || { bg: 'var(--surface-2)', fg: 'var(--text-3)' }} /></td>
                    <td className="c1l-muted">{e.paid_date ? formatDMY(e.paid_date) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </C1Modal>
  );
}
