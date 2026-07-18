'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import { isClub1000Manager } from '../../../lib/moduleAccess';

const TEAL = '#00838F';
const inp  = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid #C6D0DB', fontSize: 13, boxSizing: 'border-box' };
const lbl  = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 5 };
const th   = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5 };
const td   = { padding: '12px 16px', borderTop: '1px solid #F5F6FA', color: '#1A1A2E' };

const EMPTY_FORM = {
  name: '', tenure_months: 12, fixed_return_pct: '', loyalty_benefit_pct: '0',
  min_ticket_size: '', premature_redemption_allowed: false,
  premature_redemption_lock_months: '', premature_redemption_rate_pct_per_month: '1.00',
  interest_payout_options: ['maturity'],
};

const INTEREST_PAYOUT_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', maturity: 'At Maturity' };

function SchemeModal({ onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = (Number(form.fixed_return_pct) || 0) + (Number(form.loyalty_benefit_pct) || 0);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleInterestPayoutOption(key, checked) {
    setForm((f) => ({
      ...f,
      interest_payout_options: checked
        ? [...f.interest_payout_options, key]
        : f.interest_payout_options.filter((k) => k !== key),
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.interest_payout_options.length) {
      setError('Select at least one interest payout option.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(CLUB1000_ENDPOINTS.schemes, {
        method: 'POST',
        body: JSON.stringify({ ...form, total_return_pct: total }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || Object.values(data || {})[0] || 'Could not create scheme.');
        return;
      }
      onSaved(data);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(24,35,80,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #F0F3FA' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E' }}>New Scheme</div>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Scheme Name</label>
            <input style={inp} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. RISE" required />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Tenure (months)</label>
              <input style={inp} type="number" min="1" value={form.tenure_months} onChange={(e) => set('tenure_months', e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Min Ticket Size (₹)</label>
              <input style={inp} type="number" min="0" value={form.min_ticket_size} onChange={(e) => set('min_ticket_size', e.target.value)} required />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Fixed Return %</label>
              <input style={inp} type="number" step="0.01" min="0" value={form.fixed_return_pct} onChange={(e) => set('fixed_return_pct', e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Loyalty Benefit %</label>
              <input style={inp} type="number" step="0.01" min="0" value={form.loyalty_benefit_pct} onChange={(e) => set('loyalty_benefit_pct', e.target.value)} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#8492A6' }}>Total Return: <strong style={{ color: TEAL }}>{total}%</strong></div>
          <div>
            <label style={lbl}>Interest Payout Options</label>
            <div style={{ display: 'flex', gap: 16 }}>
              {Object.entries(INTEREST_PAYOUT_LABELS).map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={form.interest_payout_options.includes(key)}
                    onChange={(e) => toggleInterestPayoutOption(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#8492A6', marginTop: 5 }}>Only the checked option(s) will be selectable when adding investors to this scheme.</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#334155' }}>
            <input type="checkbox" checked={form.premature_redemption_allowed} onChange={(e) => set('premature_redemption_allowed', e.target.checked)} />
            Allow premature redemption
          </label>
          {form.premature_redemption_allowed && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Lock-in (months)</label>
                <input style={inp} type="number" min="0" value={form.premature_redemption_lock_months} onChange={(e) => set('premature_redemption_lock_months', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Redemption rate %/month</label>
                <input style={inp} type="number" step="0.01" min="0" value={form.premature_redemption_rate_pct_per_month} onChange={(e) => set('premature_redemption_rate_pct_per_month', e.target.value)} />
              </div>
            </div>
          )}
          {error && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 22px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={busy} style={{ padding: '9px 20px', background: TEAL, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Saving…' : 'Create Scheme'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SchemesPage() {
  const user = useSelector((s) => s.auth.user);
  const router = useRouter();
  const manager = isClub1000Manager(user);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (user && !manager) router.replace('/club1000');
  }, [user]);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch(CLUB1000_ENDPOINTS.schemes);
      if (res.ok) setSchemes(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (manager) load(); }, [manager]);

  async function disableScheme(id) {
    if (!confirm('Disable this scheme?')) return;
    const res = await apiFetch(CLUB1000_ENDPOINTS.scheme(id), { method: 'DELETE' });
    if (res.status === 204 || res.ok) load();
  }

  if (!manager) return null;

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E' }}>Schemes</h1>
          <p style={{ fontSize: 13, color: '#8492A6', marginTop: 4 }}>Define investment plans investors can be added against</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ padding: '10px 18px', background: TEAL, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New Scheme</button>
      </div>

      <div style={{ marginTop: 24, background: '#fff', borderRadius: 16, border: '1px solid #EDF1F7', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
              <th style={th}>Name</th>
              <th style={th}>Tenure</th>
              <th style={th}>Fixed</th>
              <th style={th}>Loyalty</th>
              <th style={th}>Total</th>
              <th style={th}>Min Ticket</th>
              <th style={th}>Interest Payout</th>
              <th style={th}>Premature Exit</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: '#8492A6' }}>Loading…</td></tr>
            ) : schemes.length === 0 ? (
              <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: '#8492A6' }}>No schemes yet — create one to get started.</td></tr>
            ) : schemes.map((s) => (
              <tr key={s.id}>
                <td style={td}>{s.name}</td>
                <td style={td}>{s.tenure_months}mo</td>
                <td style={td}>{s.fixed_return_pct}%</td>
                <td style={td}>{s.loyalty_benefit_pct}%</td>
                <td style={{ ...td, fontWeight: 700, color: TEAL }}>{s.total_return_pct}%</td>
                <td style={td}>₹{Number(s.min_ticket_size).toLocaleString('en-IN')}</td>
                <td style={td}>{(s.interest_payout_options || []).map((k) => INTEREST_PAYOUT_LABELS[k] || k).join(', ') || '—'}</td>
                <td style={td}>{s.premature_redemption_allowed ? `After ${s.premature_redemption_lock_months || 0}mo` : 'N/A'}</td>
                <td style={td}>
                  <button onClick={() => disableScheme(s.id)} style={{ padding: '5px 10px', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Disable</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <SchemeModal onClose={() => setShowNew(false)} onSaved={() => load()} />
      )}
    </div>
  );
}
