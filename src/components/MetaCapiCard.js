'use client';
import { useState } from 'react';
import { SALES_ENDPOINTS, authHeaders } from '../constants/api';
import { notify } from '../lib/notify';
import { errText } from '../lib/apiError';

// Lead Setup → "Send results back to Meta" (Conversions API for CRM). When a Meta lead
// is qualified, gets a site visit or books, Nexora tells Meta (backend sales/meta_capi.py)
// so Meta finds more people who actually visit. Needs the CRM dataset's ID and token.
const STAGE_HELP = {
  Lead_Received: 'Meta form lead arrives',
  Qualified: 'TC or STM marks it warm, or a visit is booked',
  Site_Visit_Scheduled: 'Site visit booked',
  Site_Visit_Done: 'Site visit completed',
  Booked: 'Booking approved',
  Disqualified: 'Not qualified / not interested',
};

export default function MetaCapiCard({ cfg, companyId, onSaved }) {
  const [datasetId, setDatasetId] = useState(cfg?.capi_dataset_id || '');
  const [token, setToken] = useState('');
  const [testCode, setTestCode] = useState(cfg?.capi_test_code || '');
  const [enabled, setEnabled] = useState(!!cfg?.capi_enabled);
  const [busy, setBusy] = useState('');
  const tokenSet = !!cfg?.capi_token_set;
  const cid = companyId ? { company_id: companyId } : {};
  const stats = cfg?.capi?.by_event || [];
  const recent = cfg?.capi?.recent || [];

  async function call(action, extra) {
    const res = await fetch(SALES_ENDPOINTS.metaWebhookConfig, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ action, ...extra, ...cid }),
    });
    const d = await res.json().catch(() => ({}));
    return { res, d };
  }

  async function save() {
    setBusy('save');
    const { res, d } = await call('save_capi', { capi_dataset_id: datasetId, capi_token: token, capi_test_code: testCode, capi_enabled: enabled });
    setBusy('');
    if (!res.ok) { notify(errText(d, 'Could not save.'), 'error'); return; }
    setToken(''); setEnabled(!!d.capi_enabled);
    notify(d.capi_enabled ? 'Saved — lead stages will now be sent to Meta.'
      : (enabled ? 'Saved, but it stays off until both the dataset ID and token are filled in.' : 'Saved (switched off).'), 'success');
    onSaved && onSaved(d);
  }

  async function test() {
    setBusy('test');
    const { d } = await call('capi_test', {});
    setBusy('');
    notify(d.detail || (d.ok ? 'Meta accepted the test event.' : 'Meta refused it.'), d.ok ? 'success' : 'error');
  }

  return (
    <div className="nx-card capi-card">
      <div className="capi-head">
        <div>
          <div className="capi-title">Send results back to Meta</div>
          <div className="capi-sub">When a Meta lead is qualified, visits or books, Nexora tells Meta the same day, so your ads find more people who actually visit.</div>
        </div>
        <button type="button" className={`nx-btn nx-btn-sm nx-toggle capi-switch${enabled ? ' is-on' : ''}`}
          onClick={() => setEnabled((v) => !v)} aria-pressed={enabled}>
          <span className="capi-dot" />{enabled ? 'On' : 'Off'}
        </button>
      </div>
      <div className="capi-grid">
        <label className="nx-field stack capi-f"><span className="nx-field-label">Dataset ID</span>
          <input className="nx-input" value={datasetId} onChange={(e) => setDatasetId(e.target.value)} placeholder="From Events Manager → dataset" inputMode="numeric" />
        </label>
        <label className="nx-field stack capi-f"><span className="nx-field-label">Access token</span>
          <input className="nx-input" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off"
            placeholder={tokenSet ? 'Saved · type to replace' : 'Paste the access token'} />
        </label>
        <label className="nx-field stack capi-f"><span className="nx-field-label">Test event code (optional)</span>
          <input className="nx-input" value={testCode} onChange={(e) => setTestCode(e.target.value)} placeholder="e.g. TEST12345" />
        </label>
      </div>
      <div className="capi-actions">
        <button type="button" className="nx-btn nx-btn-md nx-btn-primary" onClick={save} disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
        <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={test} disabled={!!busy || !tokenSet || !cfg?.capi_dataset_id}>
          {busy === 'test' ? 'Sending…' : 'Send a test event'}</button>
      </div>
      <table className="nx-table capi-table">
        <thead><tr><th>Stage sent to Meta</th><th>When</th><th className="capi-num">Sent (30 days)</th><th className="capi-num">Failed</th></tr></thead>
        <tbody>{stats.map((s) => (
          <tr key={s.event}><td><code className="capi-code">{s.event}</code></td><td>{STAGE_HELP[s.event]}</td>
            <td className="capi-num">{s.sent}</td><td className={`capi-num${s.failed ? ' capi-bad' : ''}`}>{s.failed}</td></tr>
        ))}</tbody>
      </table>
      {recent.some((r) => r.status === 'failed') && (
        <div className="nx-note bad capi-note">Latest error from Meta: {recent.find((r) => r.status === 'failed').error || 'no reason given'}</div>
      )}
    </div>
  );
}
