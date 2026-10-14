'use client';
// Payment Plans for one project — the installments a new booking starts with. Two
// plans: an LOI booked directly, and an EOI converted to an LOI. Each lists the Extra
// Work Amount and Unit Price installments (% · days after the booking date · stage)
// and the Legal & Other Charges line. Everything stays editable on each booking.
import { useState } from 'react';
import Icon from './Icon';
import { SALES_ENDPOINTS, authHeaders } from '../constants/api';
import { PLAN_KEYS, emptyPlan, pctTotal } from '../lib/paymentPlans';

const SECTIONS = [
  ['extra', 'Extra Work Amount Installments'],
  ['unit', 'Unit Price Installments'],
];

function seed(project) {
  const saved = project.payment_plans || {};
  return Object.fromEntries(PLAN_KEYS.map(([k]) => {
    const p = saved[k] || {};
    return [k, {
      extra: (p.extra || []).map((r) => ({ pct: String(r.pct ?? ''), days: String(r.days ?? ''), stage: r.stage || '' })),
      unit: (p.unit || []).map((r) => ({ pct: String(r.pct ?? ''), days: String(r.days ?? ''), stage: r.stage || '' })),
      legal: { days: p.legal?.days != null ? String(p.legal.days) : '', stage: p.legal?.stage || '' },
    }];
  }));
}

export default function PaymentPlansModal({ project, onClose, onSaved }) {
  const [plans, setPlans] = useState(() => seed(project));
  const [tab, setTab] = useState('direct');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const plan = plans[tab] || emptyPlan();

  const setPlan = (fn) => setPlans((all) => ({ ...all, [tab]: fn(all[tab] || emptyPlan()) }));
  const setRow = (sec, i, k, v) => setPlan((p) => ({ ...p, [sec]: p[sec].map((r, idx) => (idx === i ? { ...r, [k]: v } : r)) }));
  const addRow = (sec) => setPlan((p) => ({ ...p, [sec]: [...p[sec], { pct: '', days: '', stage: '' }] }));
  const dropRow = (sec, i) => setPlan((p) => ({ ...p, [sec]: p[sec].filter((_, idx) => idx !== i) }));
  const setLegal = (k, v) => setPlan((p) => ({ ...p, legal: { ...p.legal, [k]: v } }));
  const copyDirect = () => setPlans((all) => ({ ...all, eoi: JSON.parse(JSON.stringify(all.direct || emptyPlan())) }));

  async function save() {
    // A section with rows must add up to 100%, the same rule the booking form enforces.
    for (const [k, label] of PLAN_KEYS) {
      for (const [sec, secLabel] of SECTIONS) {
        const rows = plans[k]?.[sec] || [];
        if (rows.length && Math.abs(pctTotal(rows) - 100) > 0.01) {
          setTab(k); setErr(`${label} — ${secLabel} add up to ${pctTotal(rows).toFixed(2)}%. They must total 100%.`);
          return;
        }
      }
    }
    setSaving(true); setErr('');
    const body = Object.fromEntries(PLAN_KEYS.map(([k]) => [k, {
      extra: (plans[k].extra || []).map((r) => ({ pct: Number(r.pct) || 0, days: parseInt(r.days, 10) || 0, stage: r.stage.trim() })),
      unit: (plans[k].unit || []).map((r) => ({ pct: Number(r.pct) || 0, days: parseInt(r.days, 10) || 0, stage: r.stage.trim() })),
      legal: { days: plans[k].legal.days === '' ? '' : parseInt(plans[k].legal.days, 10) || 0, stage: plans[k].legal.stage.trim() },
    }]));
    try {
      const r = await fetch(SALES_ENDPOINTS.project(project.id), {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ payment_plans: body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.payment_plans || d.detail || 'Could not save.'); return; }
      onSaved?.(d);
      onClose();
    } catch {
      setErr('Could not save. Check your connection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ar-backdrop" onClick={() => !saving && onClose()}>
      <div className="nx-card nx-modal pp-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pp-head">
          <div>
            <h2>Payment Plans</h2>
            <p>{project.name} — prefilled on every new booking, editable per booking.</p>
          </div>
          <button type="button" className="pp-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>

        <nav className="pp-tabs">
          {PLAN_KEYS.map(([k, label]) => (
            <button type="button" key={k} className={`pp-tab${tab === k ? ' is-on' : ''}`} onClick={() => setTab(k)}>{label}</button>
          ))}
          {tab === 'eoi' && (
            <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary pp-copy" onClick={copyDirect}>Copy from Direct LOI</button>
          )}
        </nav>

        <div className="pp-body">
          <p className="pp-lead">
            {tab === 'direct' ? 'Used when an LOI is booked directly.' : 'Used when an EOI is converted to an LOI.'}
            {' '}Days count from the booking date (0 = on the booking date). Leave a section empty to start it blank.
          </p>
          {err && <div className="nx-note bad">{String(err)}</div>}

          {SECTIONS.map(([sec, label]) => {
            const rows = plan[sec] || [];
            const total = pctTotal(rows);
            return (
              <section className="pp-sec" key={sec}>
                <div className="pp-sec-head">
                  <h3>{label}</h3>
                  {rows.length > 0 && <span className={`pp-total${Math.abs(total - 100) < 0.01 ? ' ok' : ' bad'}`}>Total {total.toFixed(2)}%</span>}
                </div>
                {rows.length > 0 && (
                  <div className="pp-row pp-row-head"><span>#</span><span>%</span><span>Days after booking</span><span>Stage</span><span /></div>
                )}
                {rows.map((r, i) => (
                  <div className="pp-row" key={i}>
                    <span className="pp-no">{i + 1}</span>
                    <input className="nx-input" inputMode="decimal" value={r.pct} onChange={(e) => setRow(sec, i, 'pct', e.target.value)} placeholder="%" />
                    <input className="nx-input" inputMode="numeric" value={r.days} onChange={(e) => setRow(sec, i, 'days', e.target.value)} placeholder="0" />
                    <input className="nx-input" value={r.stage} onChange={(e) => setRow(sec, i, 'stage', e.target.value)} placeholder="Optional, e.g. On booking" />
                    <button type="button" className="nx-btn nx-btn-sm nx-icon-btn nx-btn-ghost" aria-label="Remove" onClick={() => dropRow(sec, i)}><Icon name="x" /></button>
                  </div>
                ))}
                <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => addRow(sec)}>+ Add installment</button>
              </section>
            );
          })}

          <section className="pp-sec">
            <div className="pp-sec-head"><h3>Legal &amp; Other Charges</h3></div>
            <div className="pp-row pp-row-legal pp-row-head"><span>Days after booking</span><span>Stage</span></div>
            <div className="pp-row pp-row-legal">
              <input className="nx-input" inputMode="numeric" value={plan.legal.days} onChange={(e) => setLegal('days', e.target.value)} placeholder="Blank = no date" />
              <input className="nx-input" value={plan.legal.stage} onChange={(e) => setLegal('stage', e.target.value)} placeholder="Optional, e.g. At sale deed" />
            </div>
          </section>
        </div>

        <footer className="pp-foot">
          <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="nx-btn nx-btn-md nx-btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save plans'}</button>
        </footer>
      </div>
    </div>
  );
}
