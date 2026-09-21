'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AR_ENDPOINTS } from '../../../../../constants/api';
import { apiFetch } from '../../../../../utils/apiFetch';
import { confirmDialog, notify } from '../../../../../lib/notify';
import { formatDMY } from '../../../../../lib/dateFormat';
import Loader from '../../../../../components/Loader';
import { rupee, MODES, AGE_LABELS, STATUS, today, printStatement } from '../../_ar';

const MODE_LABEL = Object.fromEntries(MODES.map((m) => [m.value, m.label]));

// Account Ledger — the old workbook's "Ledger Format" for one booking, plus the
// Payment Received Form. Receipts are the only thing typed in; everything else
// (allocation, status, interest, ageing) comes back computed from the server.
export default function ARLedgerPage({ params }) {
  if (params.module !== 'ar') notFound();
  const id = params.id;
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [asOf, setAsOf] = useState(today());
  const [form, setForm] = useState(null);         // null | { id?, paid_on, amount, mode, remarks }
  const [formErr, setFormErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [legalDate, setLegalDate] = useState('');
  const [audit, setAudit] = useState(null);       // null | { receipt, rows }

  const qs = useCallback(() => {
    const p = [`as_of=${asOf}`];
    if (companyId) p.push(`company_id=${companyId}`);
    return `?${p.join('&')}`;
  }, [asOf, companyId]);

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await apiFetch(AR_ENDPOINTS.account(id) + qs());
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.detail || 'Could not load this account.'); return; }
      setData(d);
      setLegalDate(d.legal_due_date || '');
    } catch { setErr('Could not load this account. Check your connection.'); }
  }, [id, qs]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setFormErr({}); setForm({ paid_on: today(), amount: '', mode: 'bank', remarks: '' }); };
  const openEdit = (rc) => { setFormErr({}); setForm({ id: rc.id, paid_on: rc.paid_on, amount: String(rc.amount), mode: rc.mode, remarks: rc.remarks }); };

  async function saveReceipt() {
    const amt = Number(form.amount);
    const verb = form.id ? 'Update this receipt to' : 'Record';
    const ok = await confirmDialog(
      `${verb} ${rupee(amt)} from ${data.client_name || 'this client'} on ${formatDMY(form.paid_on)} (${MODE_LABEL[form.mode]})?`,
      { title: form.id ? 'Update receipt?' : 'Record payment?', confirmText: form.id ? 'Update' : 'Record' },
    );
    if (!ok) return;
    setSaving(true); setFormErr({});
    try {
      const url = form.id ? AR_ENDPOINTS.receipt(form.id) : AR_ENDPOINTS.receipts(id);
      const r = await apiFetch(url + (companyId ? `?company_id=${companyId}` : ''), {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify({ paid_on: form.paid_on, amount: form.amount, mode: form.mode, remarks: form.remarks }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setFormErr(d.detail ? { _: d.detail } : d); setSaving(false); return; }
      setForm(null);
      notify(form.id ? 'Receipt updated' : 'Payment recorded', 'success');
      await load();
    } catch { setFormErr({ _: 'Could not save. Check your connection.' }); }
    setSaving(false);
  }

  async function deleteReceipt(rc) {
    const ok = await confirmDialog(
      `Delete the ${rupee(rc.amount)} receipt of ${formatDMY(rc.paid_on)}? It stays in the history but no longer counts.`,
      { title: 'Delete receipt?', confirmText: 'Delete', tone: 'danger' },
    );
    if (!ok) return;
    const r = await apiFetch(AR_ENDPOINTS.receipt(rc.id) + (companyId ? `?company_id=${companyId}` : ''), { method: 'DELETE' });
    if (r.ok) { notify('Receipt deleted', 'success'); load(); } else notify('Could not delete the receipt', 'error');
  }

  async function showAudit(rc) {
    setAudit({ receipt: rc, rows: null });
    const r = await apiFetch(AR_ENDPOINTS.receiptAudit(rc.id) + (companyId ? `?company_id=${companyId}` : ''));
    const d = await r.json().catch(() => []);
    setAudit({ receipt: rc, rows: r.ok ? d : [] });
  }

  async function saveLegalDate() {
    const r = await apiFetch(AR_ENDPOINTS.account(id) + qs(), {
      method: 'PATCH', body: JSON.stringify({ legal_due_date: legalDate || null }),
    });
    if (r.ok) { notify('Due date saved', 'success'); setData(await r.json()); } else notify('Could not save the date', 'error');
  }

  async function statement() {
    const e = await printStatement(AR_ENDPOINTS.statement(id) + qs(), apiFetch);
    if (e) notify(e, 'error');
  }

  if (err && !data) return <div className="nx-page nx-page-center nx-w-md"><div className="nx-note bad">{err}</div></div>;
  if (!data) return <Loader label="Calculating ledger…" />;

  const frozen = data.status === 'frozen';
  const interestTotal = data.interest_rows.reduce((t, r) => t + r.interest, 0);

  return (
    <div className="nx-page">
      <div className="ar-head">
        <div>
          <Link href="/m/ar/register" className="nx-btn nx-btn-sm nx-btn-link">← Register</Link>
          <h1 className="nx-page-title">{data.client_name || 'Account'}</h1>
          <p className="nx-page-sub">
            {data.project} · Plot {data.plots}{data.phone ? ` · ${data.phone}` : ''}
            {data.booking_date ? ` · booked ${formatDMY(data.booking_date)}` : ''}
          </p>
        </div>
        <div className="ar-head-actions">
          <label className="nx-field-inline" htmlFor="ar-asof">Ledger date</label>
          <input id="ar-asof" type="date" className="nx-input nx-input-sm" value={asOf} onChange={(e) => setAsOf(e.target.value || today())} />
          <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={statement}>Statement PDF</button>
          {!frozen && <button className="nx-btn nx-btn-md nx-btn-primary" onClick={openNew}>+ Record payment</button>}
        </div>
      </div>

      {frozen && <div className="nx-note warn">This booking was cancelled, so its account is frozen. Receipts and history are kept; no new payments can be recorded.</div>}
      {data.no_schedule && (
        <div className="nx-note warn">
          The booking has no installment schedule{String(data.plots).toUpperCase().startsWith('EOI') ? ' (an EOI)' : ''}, so AR cannot tell what is due when: the unscheduled amount shows as one undated Balance line with no interest.
          {' '}Ask Sales to add the installments to the booking and they appear here.
        </div>
      )}
      {data.suspect_amount && (
        <div className="nx-note bad">
          The deal amount on this booking is only {rupee(data.total_deal)}, which looks like a typing mistake. Correct the booking in Sales before relying on these figures.
        </div>
      )}
      {data.plan_mismatch !== 0 && (
        <div className="nx-note warn">
          The LOI schedule adds up to {rupee(data.collectable)}, which is {rupee(Math.abs(data.plan_mismatch))} {data.plan_mismatch > 0 ? 'more' : 'less'} than Total Deal − Stamp Duty − Registration. Check the booking&apos;s installments.
        </div>
      )}

      <div className="ar-grid-2">
        <div className="nx-card ar-card">
          <div className="ar-card-head"><div className="ar-card-title">Summary</div></div>
          <div className="ar-card-body">
            <div className="ar-kv">
              <div className="k">Total Deal</div><div className="f">b</div><div className="v">{rupee(data.total_deal)}</div>
              <div className="k">Stamp Duty</div><div className="f">c</div><div className="v">{rupee(data.stamp_duty)}</div>
              <div className="k">Registration</div><div className="f">d</div><div className="v">{rupee(data.reg_fees)}</div>
              <div className="k">Total payment received</div><div className="f">e</div><div className="v">{rupee(data.received)}</div>
              <div className="k">O/s</div><div className="f">b−c−d−e</div><div className="v">{rupee(data.outstanding)}</div>
              <div className="k">Interest due</div><div className="f">f</div><div className="v">{rupee(data.net_interest)}</div>
              <div className="k total">O/s with interest</div><div className="f total">b−c−d−e+f</div><div className="v total">{rupee(data.os_with_interest)}</div>
            </div>
          </div>
        </div>

        <div className="nx-card ar-card">
          <div className="ar-card-head"><div className="ar-card-title">O/s summary &amp; ageing</div></div>
          <div className="ar-card-body ar-grid-2">
            <table className="ar-table">
              <thead><tr><th>Month</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {data.os_summary.map((m) => <tr key={m.label}><td>{m.label}</td><td className="num">{m.amount ? rupee(m.amount) : '—'}</td></tr>)}
              </tbody>
              <tfoot><tr><td>Total</td><td className="num">{rupee(data.os_summary.reduce((t, m) => t + m.amount, 0))}</td></tr></tfoot>
            </table>
            <table className="ar-table">
              <thead><tr><th>Days</th><th className="num">Overdue</th></tr></thead>
              <tbody>
                {AGE_LABELS.map((a) => <tr key={a}><td>{a}</td><td className="num">{data.ageing[a] ? rupee(data.ageing[a]) : '—'}</td></tr>)}
              </tbody>
              <tfoot><tr><td>Total</td><td className="num">{rupee(data.overdue)}</td></tr></tfoot>
            </table>
          </div>
        </div>
      </div>

      <div className="nx-card ar-card">
        <div className="ar-card-head">
          <div><div className="ar-card-title">Payment plan</div>
            <div className="ar-card-sub">From the approved LOI</div></div>
        </div>
        <div className="ar-scroll">
          <table className="ar-table">
            <thead><tr><th>Inst</th><th>Description</th><th>Due</th><th className="num">Amount</th><th className="num">Paid</th><th className="num">Pending</th><th>Status</th></tr></thead>
            <tbody>
              {data.plan.map((p) => (
                <tr key={p.key}>
                  <td>{p.no}</td>
                  <td>{p.label}</td>
                  <td>
                    {p.kind === 'legal' && !frozen ? (
                      <span className="ar-inline-date">
                        <input type="date" className="nx-input" value={legalDate} onChange={(e) => setLegalDate(e.target.value)} />
                        <button className="nx-btn nx-btn-sm nx-btn-soft" onClick={saveLegalDate} disabled={(legalDate || null) === (data.legal_due_date || null)}>Save</button>
                      </span>
                    ) : (p.due ? formatDMY(p.due) : <span className="muted">{p.kind === 'balance' ? 'No schedule' : 'No date'}</span>)}
                  </td>
                  <td className="num">{rupee(p.amount)}</td>
                  <td className="num">{rupee(p.paid)}</td>
                  <td className="num">{rupee(p.pending)}</td>
                  <td><span className={`nx-status ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="nx-card ar-card">
        <div className="ar-card-head">
          <div><div className="ar-card-title">Payments received</div><div className="ar-card-sub">{data.receipts.length} receipt{data.receipts.length === 1 ? '' : 's'}</div></div>
        </div>
        {data.receipts.length === 0 ? <div className="ar-empty">No payments recorded yet.</div> : (
          <div className="ar-scroll">
            <table className="ar-table">
              <thead><tr><th>Date</th><th className="num">Amount</th><th>Mode</th><th>Remarks</th><th>Entered by</th><th /></tr></thead>
              <tbody>
                {data.receipts.map((rc) => (
                  <tr key={rc.id}>
                    <td>{formatDMY(rc.paid_on)}</td>
                    <td className="num">{rupee(rc.amount)}</td>
                    <td>{rc.mode_label}</td>
                    <td className="wrap">{rc.remarks || <span className="muted">—</span>}</td>
                    <td className="muted">{rc.source === 'import' ? 'Excel import' : (rc.created_by || '—')}</td>
                    <td>
                      <span className="ar-actions">
                        {!frozen && <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => openEdit(rc)}>Edit</button>}
                        {!frozen && <button className="nx-btn nx-btn-sm nx-btn-danger-soft" onClick={() => deleteReceipt(rc)}>Delete</button>}
                        <button className="nx-btn nx-btn-sm nx-btn-ghost" onClick={() => showAudit(rc)}>History</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="nx-card ar-card">
        <div className="ar-card-head">
          <div><div className="ar-card-title">Interest summary</div>
            <div className="ar-card-sub">2% a month when paid more than 10 days late (every day counts) · 1% a month credit when paid early (not on Legal &amp; Other Charges)</div></div>
        </div>
        {data.interest_rows.length === 0 ? <div className="ar-empty">Nothing allocated yet.</div> : (
          <div className="ar-scroll">
            <table className="ar-table">
              <thead><tr><th>Inst</th><th>Due on</th><th>Paid on</th><th className="num">Amount</th><th className="num">Days</th><th className="num">Interest</th></tr></thead>
              <tbody>
                {data.interest_rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.inst_no}</td>
                    <td>{r.due ? formatDMY(r.due) : '—'}</td>
                    <td>{r.paid_on ? formatDMY(r.paid_on) : <span className="nx-status bad">Unpaid</span>}</td>
                    <td className="num">{rupee(r.amount)}</td>
                    <td className="num">{r.days ?? '—'}</td>
                    <td className={`num${r.interest < 0 ? ' ar-neg' : ''}`}>{rupee(r.interest)}</td>
                  </tr>
                ))}
                {data.overpaid > 0 && (
                  <tr><td colSpan={3} className="muted">Overpaid {rupee(data.overpaid)} — credit to date</td><td /><td />
                    <td className="num ar-neg">{rupee(data.overpaid_credit)}</td></tr>
                )}
              </tbody>
              <tfoot><tr><td colSpan={5}>Net interest</td><td className="num">{rupee(interestTotal + (data.overpaid_credit || 0))}</td></tr></tfoot>
            </table>
          </div>
        )}
      </div>

      {form && (
        <div className="ar-backdrop" onClick={() => !saving && setForm(null)}>
          <div className="nx-card nx-modal ar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ar-modal-title">{form.id ? 'Edit receipt' : 'Record payment'}</div>
            <div className="ar-modal-sub">{data.client_name} · {data.project} · Plot {data.plots} · Outstanding {rupee(data.outstanding)}</div>
            {formErr._ && <div className="nx-note bad">{formErr._}</div>}
            <div className="nx-field">
              <label className="nx-field-label" htmlFor="ar-date">Paid on</label>
              <input id="ar-date" type="date" max={today()} className={`nx-input${formErr.paid_on ? ' is-invalid' : ''}`} value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} />
              {formErr.paid_on && <span className="nx-note bad">{formErr.paid_on}</span>}
            </div>
            <div className="nx-field">
              <label className="nx-field-label" htmlFor="ar-amount">Amount (₹)</label>
              <input id="ar-amount" type="number" min="1" inputMode="decimal" className={`nx-input${formErr.amount ? ' is-invalid' : ''}`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              {formErr.amount && <span className="nx-note bad">{formErr.amount}</span>}
            </div>
            <div className="nx-field">
              <label className="nx-field-label" htmlFor="ar-mode">Mode</label>
              <select id="ar-mode" className="nx-input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="nx-field">
              <label className="nx-field-label" htmlFor="ar-remarks">Remarks</label>
              <input id="ar-remarks" className="nx-input" placeholder="e.g. REC IN VISTARA HDFC" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </div>
            <div className="ar-modal-foot">
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
              <button className="nx-btn nx-btn-md nx-btn-primary" onClick={saveReceipt} disabled={saving || !form.paid_on || !(Number(form.amount) > 0)}>
                {saving ? 'Saving…' : form.id ? 'Update' : 'Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {audit && (
        <div className="ar-backdrop" onClick={() => setAudit(null)}>
          <div className="nx-card nx-modal ar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ar-modal-title">Receipt history</div>
            <div className="ar-modal-sub">{rupee(audit.receipt.amount)} · {formatDMY(audit.receipt.paid_on)}</div>
            {audit.rows === null ? <Loader label="Loading…" /> : (
              <div className="ar-audit">
                {audit.rows.map((a, i) => (
                  <div key={i} className="ar-audit-item">
                    <div className="ar-audit-meta">
                      {{ create: 'Created', update: 'Edited', delete: 'Deleted' }[a.action]} by {a.changed_by || '—'} · {new Date(a.changed_at).toLocaleString('en-IN')}
                    </div>
                    {a.before && <div>Before: {rupee(a.before.amount)} · {formatDMY(a.before.paid_on)} · {MODE_LABEL[a.before.mode] || a.before.mode}{a.before.remarks ? ` · ${a.before.remarks}` : ''}</div>}
                    {a.after && <div>After: {rupee(a.after.amount)} · {formatDMY(a.after.paid_on)} · {MODE_LABEL[a.after.mode] || a.after.mode}{a.after.remarks ? ` · ${a.after.remarks}` : ''}</div>}
                  </div>
                ))}
              </div>
            )}
            <div className="ar-modal-foot"><button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setAudit(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

