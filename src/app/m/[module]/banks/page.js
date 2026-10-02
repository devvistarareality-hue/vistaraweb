'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AR_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import Loader from '../../../../components/Loader';
import { notify, confirmDialog } from '../../../../lib/notify';
import { rupee, cleanAmount, groupINR } from '../_ar';

// Bank Master — the company's own bank accounts. A Loan payment recorded in a ledger
// names one of these, and its balance is opening balance + those payments (worked
// out by the server every time, so editing or deleting a payment moves it too).
export default function ARBanksPage({ params }) {
  if (params.module !== 'ar') notFound();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const cq = companyId ? `?company_id=${companyId}` : '';
  const [rows, setRows] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(null);      // { id?, name, account_no, opening_balance }
  const [formErr, setFormErr] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await apiFetch(AR_ENDPOINTS.banks + cq);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.detail || 'Could not load the banks.'); setRows([]); return; }
      setRows(d.results || []); setCanManage(!!d.can_manage);
    } catch { setErr('Could not load the banks. Check your connection.'); setRows([]); }
  }, [cq]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setFormErr({}); setForm({ name: '', account_no: '', opening_balance: '' }); };
  const openEdit = (b) => { setFormErr({}); setForm({ id: b.id, name: b.name, account_no: b.account_no, opening_balance: String(b.opening_balance) }); };

  async function save() {
    setSaving(true); setFormErr({});
    try {
      const r = await apiFetch((form.id ? AR_ENDPOINTS.bank(form.id) : AR_ENDPOINTS.banks) + cq, {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify({ name: form.name, account_no: form.account_no, opening_balance: form.opening_balance || 0 }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setFormErr(d.detail ? { _: d.detail } : d); setSaving(false); return; }
      setForm(null);
      notify(form.id ? 'Bank updated' : 'Bank added', 'success');
      await load();
    } catch { setFormErr({ _: 'Could not save. Check your connection.' }); }
    setSaving(false);
  }

  async function setActive(b, active) {
    const r = await apiFetch(AR_ENDPOINTS.bank(b.id) + cq, { method: 'PATCH', body: JSON.stringify({ is_active: active }) });
    if (r.ok) { notify(active ? 'Bank reactivated' : 'Bank retired', 'success'); load(); } else notify('Could not update the bank', 'error');
  }

  async function remove(b) {
    const ok = await confirmDialog(
      b.received > 0
        ? `${b.name} has payments recorded against it, so it will be retired (kept for history, not offered for new payments).`
        : `Remove ${b.name}? It has no payments recorded against it.`,
      { title: b.received > 0 ? 'Retire bank?' : 'Remove bank?', confirmText: b.received > 0 ? 'Retire' : 'Remove', tone: 'danger' },
    );
    if (!ok) return;
    const r = await apiFetch(AR_ENDPOINTS.bank(b.id) + cq, { method: 'DELETE' });
    if (r.ok) { notify(r.status === 204 ? 'Bank removed' : 'Bank retired', 'success'); load(); } else notify('Could not remove the bank', 'error');
  }

  const active = (rows || []).filter((b) => b.is_active);
  const totalBalance = active.reduce((a, b) => a + (b.balance || 0), 0);

  return (
    <div className="nx-page">
      <div className="arb-head">
        <div>
          <h1 className="nx-page-title">Bank Master</h1>
          <p className="nx-page-sub">Your bank accounts. A Loan payment is recorded into one of these and its balance goes up by that amount. Click a bank for its statement.</p>
        </div>
        {canManage && <button className="nx-btn nx-btn-md nx-btn-primary" onClick={openNew}>+ Add bank</button>}
      </div>

      {err && <div className="nx-note bad">{err}</div>}
      {rows === null ? <Loader label="Loading banks…" /> : (
        <div className="nx-card arb-card">
          {rows.length === 0 ? (
            <div className="arb-empty">No banks yet.{canManage ? ' Add your first bank with its opening balance.' : ''}</div>
          ) : (
            <div className="arb-scroll">
              <table className="nx-table arb-table">
                <thead>
                  <tr><th>Bank</th><th>Account no.</th><th className="num">Opening balance</th><th className="num">Loan payments received</th><th className="num">Current balance</th>{canManage && <th />}</tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className={b.is_active ? '' : 'is-retired'}>
                      <td className="arb-name"><Link href={`/m/${params.module}/banks/${b.id}`} className="arb-link">{b.name}</Link>{!b.is_active && <span className="nx-badge arb-retired">Retired</span>}</td>
                      <td>{b.account_no || '—'}</td>
                      <td className="num">{rupee(b.opening_balance)}</td>
                      <td className="num">{rupee(b.received)}</td>
                      <td className="num arb-balance">{rupee(b.balance)}</td>
                      {canManage && (
                        <td className="arb-actions">
                          <Link href={`/m/${params.module}/banks/${b.id}`} className="nx-btn nx-btn-sm nx-btn-secondary">Statement</Link>
                          <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => openEdit(b)}>Edit</button>
                          {b.is_active
                            ? <button className="nx-btn nx-btn-sm nx-btn-danger" onClick={() => remove(b)}>{b.received > 0 ? 'Retire' : 'Remove'}</button>
                            : <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setActive(b, true)}>Reactivate</button>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {active.length > 1 && (
                  <tfoot><tr><td colSpan={4}>Total across active banks</td><td className="num arb-balance">{rupee(totalBalance)}</td>{canManage && <td />}</tr></tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {form && (
        <div className="ar-backdrop" onClick={() => !saving && setForm(null)}>
          <div className="nx-card nx-modal ar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ar-modal-title">{form.id ? 'Edit bank' : 'Add bank'}</div>
            {formErr._ && <div className="nx-note bad">{formErr._}</div>}
            <div className="nx-field">
              <label className="nx-field-label" htmlFor="arb-name">Bank name</label>
              <input id="arb-name" className={`nx-input${formErr.name ? ' is-invalid' : ''}`} placeholder="e.g. HDFC Current A/c" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {formErr.name && <span className="nx-note bad">{formErr.name}</span>}
            </div>
            <div className="nx-field">
              <label className="nx-field-label" htmlFor="arb-acno">Account no. (optional)</label>
              <input id="arb-acno" className="nx-input" value={form.account_no} onChange={(e) => setForm({ ...form, account_no: e.target.value })} />
            </div>
            <div className="nx-field">
              <label className="nx-field-label" htmlFor="arb-open">Opening balance (₹)</label>
              <input id="arb-open" type="text" inputMode="decimal" autoComplete="off" placeholder="0" className={`nx-input${formErr.opening_balance ? ' is-invalid' : ''}`} value={groupINR(form.opening_balance)} onChange={(e) => setForm({ ...form, opening_balance: cleanAmount(e.target.value) })} />
              {formErr.opening_balance && <span className="nx-note bad">{formErr.opening_balance}</span>}
            </div>
            <div className="ar-modal-foot">
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
              <button className="nx-btn nx-btn-md nx-btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving…' : form.id ? 'Update' : 'Add bank'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
