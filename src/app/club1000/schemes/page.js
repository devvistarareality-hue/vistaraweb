'use client';
// Club 1000 schemes — a card per scheme: its terms, its payout rates and how much of
// the book sits in it; New / Edit open the Sales-style form (sections of fields).
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Layers, Users, Wallet } from 'lucide-react';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import { isClub1000Manager } from '../../../lib/moduleAccess';
import { confirmDialog } from '../../../lib/notify';
import { rupee, inrShort } from '../../../lib/inr';
import { errText } from '../../../lib/apiError';
import Loader from '../../../components/Loader';
import { C1Modal, C1Section, C1Field, C1Error } from '../_Form';

const EMPTY_FORM = {
  name: '', tenure_months: 12, min_ticket_size: '',
  premature_redemption_allowed: false,
  premature_redemption_lock_months: '', premature_redemption_rate_pct_per_month: '1.00',
  interest_payout_options: ['maturity'],
  payout_rates: { maturity: '' },
};

const INTEREST_PAYOUT_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', maturity: 'At Maturity' };

function SchemeModal({ scheme, onClose, onSaved }) {
  const isEdit = !!scheme;
  const [form, setForm] = useState(() => (scheme ? {
    name: scheme.name, tenure_months: scheme.tenure_months,
    min_ticket_size: scheme.min_ticket_size,
    premature_redemption_allowed: scheme.premature_redemption_allowed,
    premature_redemption_lock_months: scheme.premature_redemption_lock_months || '',
    premature_redemption_rate_pct_per_month: scheme.premature_redemption_rate_pct_per_month,
    interest_payout_options: scheme.interest_payout_options || ['maturity'],
    payout_rates: { ...(scheme.payout_rates || {}) },
  } : EMPTY_FORM));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setRate = (key, value) => setForm((f) => ({ ...f, payout_rates: { ...f.payout_rates, [key]: value } }));
  function toggleOption(key, checked) {
    setForm((f) => ({
      ...f,
      interest_payout_options: checked ? [...f.interest_payout_options, key] : f.interest_payout_options.filter((k) => k !== key),
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.interest_payout_options.length) { setError('Select at least one interest payout option.'); return; }
    const missingRate = form.interest_payout_options.find((k) => form.payout_rates[k] === '' || form.payout_rates[k] == null);
    if (missingRate) { setError(`Enter a return % for ${INTEREST_PAYOUT_LABELS[missingRate] || missingRate}.`); return; }
    setBusy(true);
    try {
      const payout_rates = Object.fromEntries(form.interest_payout_options.map((k) => [k, form.payout_rates[k]]));
      // premature_redemption_lock_months is a PositiveIntegerField(null=True) on the
      // backend — an empty string fails "a valid integer is required", so send null.
      const lock_months = form.premature_redemption_lock_months === '' ? null : form.premature_redemption_lock_months;
      const res = await apiFetch(isEdit ? CLUB1000_ENDPOINTS.scheme(scheme.id) : CLUB1000_ENDPOINTS.schemes, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, payout_rates, premature_redemption_lock_months: lock_months }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(errText(data, `Could not ${isEdit ? 'save' : 'create'} the scheme.`)); return; }
      onSaved(data);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <C1Modal title={isEdit ? 'Edit Scheme' : 'New Scheme'} sub={isEdit ? scheme.name : 'An investment plan investors can be added against'}
      onClose={onClose} onSubmit={submit}
      footer={<>
        <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="nx-btn nx-btn-md nx-btn-success" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Scheme'}</button>
      </>}>
      <C1Section title="Scheme">
        <C1Field label="Scheme name" required>
          <input className="nx-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. RISE" required />
        </C1Field>
        <C1Field label="Tenure" hint="Months until maturity" required>
          <input className="nx-input" type="number" min="1" value={form.tenure_months} onChange={(e) => set('tenure_months', e.target.value)} required />
        </C1Field>
        <C1Field label="Min ticket size (₹)" required>
          <input className="nx-input" type="number" min="0" value={form.min_ticket_size} onChange={(e) => set('min_ticket_size', e.target.value)} required />
        </C1Field>
      </C1Section>

      <C1Section title="Interest payout & return">
        {Object.entries(INTEREST_PAYOUT_LABELS).map(([key, label]) => {
          const checked = form.interest_payout_options.includes(key);
          return (
            <C1Field key={key} label={(
              <span className="c1s-opt"><input type="checkbox" checked={checked} onChange={(e) => toggleOption(key, e.target.checked)} /> {label}</span>
            )}>
              <div className="c1s-rate">
                <input className="nx-input" type="number" step="0.01" min="0" placeholder="Return %" disabled={!checked}
                  value={form.payout_rates[key] ?? ''} onChange={(e) => setRate(key, e.target.value)} />
                <span>%</span>
              </div>
            </C1Field>
          );
        })}
        <div className="c1-help">Only the ticked options can be picked when adding investors to this scheme — each carries its own total return %.</div>
      </C1Section>

      <C1Section title="Premature redemption">
        <C1Field label="Allow it">
          <label className="c1s-opt"><input type="checkbox" checked={form.premature_redemption_allowed} onChange={(e) => set('premature_redemption_allowed', e.target.checked)} /> Investors may exit before maturity</label>
        </C1Field>
        {form.premature_redemption_allowed && <>
          <C1Field label="Lock-in" hint="Months before an exit is allowed">
            <input className="nx-input" type="number" min="0" value={form.premature_redemption_lock_months} onChange={(e) => set('premature_redemption_lock_months', e.target.value)} />
          </C1Field>
          <C1Field label="Redemption rate" hint="% per month">
            <input className="nx-input" type="number" step="0.01" min="0" value={form.premature_redemption_rate_pct_per_month} onChange={(e) => set('premature_redemption_rate_pct_per_month', e.target.value)} />
          </C1Field>
        </>}
      </C1Section>
      <C1Error>{error}</C1Error>
    </C1Modal>
  );
}

export default function SchemesPage() {
  const user = useSelector((s) => s.auth.user);
  const manager = isClub1000Manager(user);
  const [schemes, setSchemes] = useState([]);
  const [book, setBook] = useState({});        // scheme name → {investors, amount}
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [res, st] = await Promise.all([apiFetch(CLUB1000_ENDPOINTS.schemes), apiFetch(CLUB1000_ENDPOINTS.stats)]);
      if (res.ok) setSchemes(await res.json());
      if (st.ok) {
        const d = await st.json();
        setBook(Object.fromEntries((d.by_scheme || []).map((r) => [r.scheme, r])));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (user) load(); }, [user]);

  async function disableScheme(id) {
    if (!(await confirmDialog('Disable this scheme?'))) return;
    const res = await apiFetch(CLUB1000_ENDPOINTS.scheme(id), { method: 'DELETE' });
    if (res.status === 204 || res.ok) load();
  }

  return (
    <div className="nx-page ard">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Schemes</h1>
          <p className="nx-page-sub">{manager ? 'The investment plans investors are added against' : 'Investment plans investors can be added against'}{schemes.length ? ` · ${schemes.length} scheme${schemes.length === 1 ? '' : 's'}` : ''}</p>
        </div>
        {manager && <button type="button" className="nx-btn nx-btn-md nx-btn-success" onClick={() => setShowNew(true)}>+ New Scheme</button>}
      </div>

      {loading ? <Loader label="Loading schemes…" /> : schemes.length === 0 ? (
        <div className="nx-card ar-card"><div className="ar-empty">No schemes yet — create one to get started.</div></div>
      ) : (
        <div className="c1s-grid">
          {schemes.map((s) => {
            const b = book[s.name] || { investors: 0, amount: 0 };
            return (
              <article key={s.id} className="nx-card c1s-card">
                <header className="c1s-head">
                  <div className="c1s-icon"><Layers size={18} /></div>
                  <div className="c1s-title">
                    <h3>{s.name}</h3>
                    <span>{s.tenure_months} months · min ₹{Number(s.min_ticket_size).toLocaleString('en-IN')}</span>
                  </div>
                </header>
                <div className="c1s-rates">
                  {(s.interest_payout_options || []).length ? (s.interest_payout_options || []).map((k) => (
                    <span key={k} className="c1s-rate-chip"><span>{INTEREST_PAYOUT_LABELS[k] || k}</span><b>{s.payout_rates?.[k] ?? '—'}%</b></span>
                  )) : <span className="c1-help">No payout options set</span>}
                </div>
                <div className="coll-figs c1s-figs">
                  <div className="coll-fig"><span><Users size={11} /> Investors</span><b>{b.investors || 0}</b></div>
                  <div className="coll-fig"><span><Wallet size={11} /> Invested</span><b title={rupee(b.amount)}>{b.amount ? inrShort(b.amount) : '—'}</b></div>
                  <div className="coll-fig"><span>Premature exit</span><b>{s.premature_redemption_allowed ? `After ${s.premature_redemption_lock_months || 0} mo` : 'Not allowed'}</b></div>
                </div>
                {manager && (
                  <footer className="c1s-foot">
                    <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setEditing(s)}>Edit</button>
                    <button type="button" className="nx-btn nx-btn-sm nx-btn-danger-soft" onClick={() => disableScheme(s.id)}>Disable</button>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}

      {showNew && <SchemeModal onClose={() => setShowNew(false)} onSaved={() => load()} />}
      {editing && <SchemeModal scheme={editing} onClose={() => setEditing(null)} onSaved={() => load()} />}
    </div>
  );
}
