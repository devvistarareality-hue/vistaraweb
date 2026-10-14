'use client';
// Payment Plans for one project — the installments a new booking starts with. Two
// plans: an LOI booked directly, and an EOI converted to an LOI. Each lists the Extra
// Work Amount and Unit Price installments (% · days after the booking date · stage)
// and the Legal & Other Charges line. Everything stays editable on each booking.
import { useState } from 'react';
import Icon from './Icon';
import { SALES_ENDPOINTS, authHeaders } from '../constants/api';
import { PLAN_KEYS, balance, emptyPlan, pctTotal, whenText } from '../lib/paymentPlans';

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
  // The last installment takes whatever % the others leave, so a section always adds up
  // to 100 — the same way the booking form fills its last row.
  const setRow = (sec, i, k, v) => setPlan((p) => ({ ...p, [sec]: balance(p[sec].map((r, idx) => (idx === i ? { ...r, [k]: v } : r))) }));
  // "No. of Installments", as on the booking form: rows already filled are kept, new
  // ones start empty, and the last one takes the remaining %.
  const setCount = (sec, n) => setPlan((p) => {
    const count = Math.min(24, Math.max(0, parseInt(n, 10) || 0));
    return { ...p, [sec]: balance(Array.from({ length: count }, (_, i) => p[sec][i] || { pct: '', days: '', stage: '' })) };
  });
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
            {' '}Due is in days after the booking date — 0 means on the booking date. The last installment&apos;s share fills itself so each section totals 100%.
          </p>
          {err && <div className="nx-note bad">{String(err)}</div>}

          {SECTIONS.map(([sec, label]) => {
            const rows = plan[sec] || [];
            const total = pctTotal(rows);
            const ok = Math.abs(total - 100) < 0.01;
            return (
              <section className="pp-sec" key={sec}>
                <div className="pp-sec-head">
                  <h3>{label}</h3>
                  {rows.length > 0 && <span className={`pp-total${ok ? ' ok' : ' bad'}`}>{total.toFixed(2)}%</span>}
                </div>
                <label className="pp-count">
                  <span>No. of Installments</span>
                  <span className="pp-f-box pp-count-box">
                    <input className="pp-f-input" inputMode="numeric" value={rows.length || ''} placeholder="0"
                      onChange={(e) => setCount(sec, e.target.value.replace(/[^0-9]/g, ''))} />
                  </span>
                </label>
                {rows.length > 0 && (
                  <div className="pp-bar"><span className={`pp-bar-fill${ok ? ' ok' : ' bad'}`} style={{ width: `${Math.min(100, total)}%` }} /></div> // inline-ok: share of 100% filled
                )}
                {rows.length === 0 && <p className="pp-empty">0 = no installments; the booking starts this section blank.</p>}
                {rows.map((r, i) => {
                  const isLast = i === rows.length - 1;
                  return (
                    <div className="pp-item" key={i}>
                      <span className="pp-no">{i + 1}</span>
                      <label className="pp-field pp-f-pct">
                        <span className="pp-f-label">Share{isLast && <em className="pp-auto">auto</em>}</span>
                        <span className="pp-f-box">
                          <input className="pp-f-input" inputMode="decimal" value={r.pct} placeholder="0"
                            readOnly={isLast} onChange={(e) => setRow(sec, i, 'pct', e.target.value)} />
                          <span className="pp-f-unit">%</span>
                        </span>
                      </label>
                      <label className="pp-field pp-f-days">
                        <span className="pp-f-label">Due</span>
                        <span className="pp-f-box">
                          <input className="pp-f-input" inputMode="numeric" value={r.days} placeholder="0"
                            onChange={(e) => setRow(sec, i, 'days', e.target.value.replace(/[^0-9]/g, ''))} />
                          <span className="pp-f-unit">days</span>
                        </span>
                        <span className="pp-when">{whenText(r.days)}</span>
                      </label>
                      <label className="pp-field pp-f-stage">
                        <span className="pp-f-label">Stage</span>
                        <span className="pp-f-box">
                          <input className="pp-f-input" value={r.stage} placeholder="Optional, e.g. On booking"
                            onChange={(e) => setRow(sec, i, 'stage', e.target.value)} />
                        </span>
                      </label>
                    </div>
                  );
                })}
              </section>
            );
          })}

          <section className="pp-sec">
            <div className="pp-sec-head"><h3>Legal &amp; Other Charges</h3></div>
            <div className="pp-item pp-item-legal">
              <label className="pp-field pp-f-days">
                <span className="pp-f-label">Due</span>
                <span className="pp-f-box">
                  <input className="pp-f-input" inputMode="numeric" value={plan.legal.days} placeholder="—"
                    onChange={(e) => setLegal('days', e.target.value.replace(/[^0-9]/g, ''))} />
                  <span className="pp-f-unit">days</span>
                </span>
                <span className="pp-when">{plan.legal.days === '' ? 'No date (sale deed or possession)' : whenText(plan.legal.days)}</span>
              </label>
              <label className="pp-field pp-f-stage">
                <span className="pp-f-label">Stage</span>
                <span className="pp-f-box">
                  <input className="pp-f-input" value={plan.legal.stage} placeholder="Optional, e.g. At sale deed"
                    onChange={(e) => setLegal('stage', e.target.value)} />
                </span>
              </label>
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
