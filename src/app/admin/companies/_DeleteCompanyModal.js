'use client';
import { useState } from 'react';
import { COMPANY_ENDPOINTS, SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import Icon from '../../../components/Icon';
import { downloadInBackground } from '../../../lib/downloadInBackground';

// Deleting a company takes every module's data with it and leaves nothing to restore
// into, so it asks for what a reset asks for and more: the reset key, the company's
// own code typed out, and it backs the company up and downloads that backup first.
// The server enforces the same gates; this is where they are gathered.
const STAGES = {
  check:    'Checking the reset key and company code…',
  backup:   'Taking a full backup…',
  download: 'Downloading the backup…',
  delete:   'Deleting the company…',
  confirm:  'Still deleting — checking with the server until it is done…',
};

async function downloadBackup(companyId) {
  const b = await fetch(SALES_ENDPOINTS.backupSchedule(companyId), {
    method: 'POST', headers: authHeaders() });
  const bd = await b.json().catch(() => ({}));
  const latest = (bd.history || [])[0];
  if (!b.ok || !latest?.id) throw new Error(bd.detail || 'The backup could not be taken.');
  return latest.id;
}

async function startDownload(backupId, companyId) {
  const r = await fetch(SALES_ENDPOINTS.backupStored(backupId, companyId), { headers: authHeaders() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.url) throw new Error(d.detail || 'The backup could not be downloaded.');
  downloadInBackground(d.url);
}

// A big company takes longer to delete than the proxy keeps the connection open;
// the server still finishes. Gone from the server means deleted.
async function waitUntilGone(companyId) {
  for (let i = 0; i < 120; i++) {                 // up to 10 minutes
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const r = await fetch(COMPANY_ENDPOINTS.detail(companyId), { headers: authHeaders() });
      if (r.status === 404) return true;
    } catch (e) { /* keep asking */ }
  }
  return false;
}

export default function DeleteCompanyModal({ company, onClose, onDeleted }) {
  const [key, setKey] = useState('');
  const [typed, setTyped] = useState('');
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  if (!company) return null;

  const busy = !!stage;
  const codeOk = typed.trim().toUpperCase() === company.code.toUpperCase();

  async function run() {
    setError('');
    try {
      // Refuse a wrong key or code straight away, before minutes of backup.
      setStage('check');
      const chk = await fetch(COMPANY_ENDPOINTS.detail(company.id), {
        method: 'DELETE', headers: authHeaders(),
        body: JSON.stringify({ reset_key: key, confirm: typed.trim(), check_only: true }) });
      if (!chk.ok) {
        const cd = await chk.json().catch(() => ({}));
        setError(cd.detail || `The server returned ${chk.status}. Nothing was deleted.`);
        setStage(''); return;
      }
      setStage('backup');
      const backupId = await downloadBackup(company.id);
      setStage('download');
      await startDownload(backupId, company.id);

      setStage('delete');
      let res = null, d = {};
      try {
        res = await fetch(COMPANY_ENDPOINTS.detail(company.id), {
          method: 'DELETE', headers: authHeaders(),
          body: JSON.stringify({ reset_key: key, confirm: typed.trim() }) });
        if (res.status !== 204) d = await res.json().catch(() => ({}));
      } catch (e) { res = null; }

      if (!res || res.status === 502 || res.status === 504) {
        setStage('confirm');
        if (await waitUntilGone(company.id)) { onDeleted(company); return; }
        setError('Could not confirm the delete. The server may still be working — refresh in a minute.');
      } else if (res.ok) {
        onDeleted(company); return;
      } else {
        setError(d.detail || `The server returned ${res.status}. Nothing was deleted.`);
      }
    } catch (e) {
      setError(`${e.message} Nothing was deleted.`);
    }
    setStage('');
  }

  return (
    <div className="nx-modal-backdrop cdel-backdrop" onClick={busy ? undefined : onClose}>
      <div className="nx-modal cdel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nx-modal-head cdel-head">
          <span>Delete {company.name}</span>
          {!busy && <button className="cdel-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>}
        </div>
        <div className="cdel-body">
          <p className="cdel-text">
            This permanently deletes <b>{company.name}</b> and everything in it — users, leads,
            bookings, projects, AR, Club 1000, tasks and its backups list. A full backup is taken
            and downloaded first, but it can only be restored into this company, which will no
            longer exist.
          </p>

          <label className="nx-field stack">
            <span className="nx-field-label">Reset key</span>
            <input className="nx-input" type="password" autoComplete="off" disabled={busy}
              placeholder="From the server environment" value={key} onChange={(e) => setKey(e.target.value)} />
          </label>
          <label className="nx-field stack">
            <span className="nx-field-label">Type the company code <b>{company.code}</b> to confirm</span>
            <input className="nx-input" autoComplete="off" disabled={busy}
              placeholder={company.code} value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>

          {busy && <div className="nx-note info"><span className="dbx-spin" />{STAGES[stage]}</div>}
          {error && <div className="nx-note bad">{error}</div>}

          <div className="cdel-actions">
            <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="nx-btn nx-btn-md nx-btn-danger" onClick={run}
              disabled={busy || !key || !codeOk}>
              {busy ? 'Working…' : 'Back up & delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
