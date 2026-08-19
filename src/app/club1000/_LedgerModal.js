'use client';
import { useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import { fmtMoney } from './_StatCard';

const TEAL = '#00838F';

const TYPE_COLOR = {
  investment: { bg: '#E3F2FD', fg: '#1565C0' },
  interest: { bg: '#E8F5E9', fg: '#2E7D32' },
  maturity: { bg: '#F3E5F5', fg: '#7B1FA2' },
  premature_redemption: { bg: '#FFF3E0', fg: '#E65100' },
};
const STATUS_COLOR = {
  completed: { bg: '#E8F5E9', fg: '#2E7D32' },
  paid: { bg: '#E8F5E9', fg: '#2E7D32' },
  pending: { bg: '#FFF8E1', fg: '#B45309' },
};

function Badge({ label, color }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: color.bg, color: color.fg, textTransform: 'capitalize' }}>{label.replace(/_/g, ' ')}</span>;
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
        if (r.ok) setData(d); else setErr(d?.detail || 'Could not load the ledger.');
      })
      .catch((e) => !cancelled && setErr(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [investorId]);

  const inv = data?.investor;
  const s = data?.summary;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 720, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(24,35,80,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #F0F3FA', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E' }}>Ledger{inv ? ` — ${inv.name}` : ''}</div>
            {inv && <div style={{ fontSize: 12, color: '#8492A6', marginTop: 2 }}>{inv.phone} · {inv.scheme_name}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#B0BAC9', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#8492A6', padding: '32px 0' }}>Loading…</p>
          ) : err ? (
            <p style={{ textAlign: 'center', color: '#DC2626', padding: '32px 0' }}>{err}</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
                {[
                  ['Invested', s.total_invested, '#1565C0'],
                  ['Total Scheduled', s.total_payout_due, '#7B1FA2'],
                  ['Paid Out', s.total_paid, '#2E7D32'],
                  ['Pending', s.total_pending, '#B45309'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ background: '#F8FAFC', border: '1px solid #EDF1F7', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color }}>{fmtMoney(val)}</div>
                  </div>
                ))}
              </div>

              <div style={{ border: '1px solid #EDF1F7', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                      {['Date', 'Type', 'Amount', 'Status', 'Paid On'].map((h) => (
                        <th key={h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((e, i) => (
                      <tr key={i}>
                        <td style={{ padding: '10px 14px', borderTop: '1px solid #F5F6FA' }}>{formatDMY(e.date)}</td>
                        <td style={{ padding: '10px 14px', borderTop: '1px solid #F5F6FA' }}>
                          <Badge label={e.label} color={TYPE_COLOR[e.type] || { bg: '#F3F4F6', fg: '#6B7280' }} />
                        </td>
                        <td style={{ padding: '10px 14px', borderTop: '1px solid #F5F6FA', fontWeight: 700, color: '#1A1A2E' }}>
                          {fmtMoney(e.amount)}
                          {e.paid_amount != null && Number(e.paid_amount) !== Number(e.amount) && (
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#B45309' }}>Paid {fmtMoney(e.paid_amount)}</div>
                          )}
                          {!!e.notes && <div style={{ fontSize: 11, fontWeight: 400, color: '#8492A6', fontStyle: 'italic', marginTop: 2 }}>"{e.notes}"</div>}
                        </td>
                        <td style={{ padding: '10px 14px', borderTop: '1px solid #F5F6FA' }}>
                          <Badge label={e.status} color={STATUS_COLOR[e.status] || { bg: '#F3F4F6', fg: '#6B7280' }} />
                        </td>
                        <td style={{ padding: '10px 14px', borderTop: '1px solid #F5F6FA', color: '#8492A6' }}>{e.paid_date ? formatDMY(e.paid_date) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
