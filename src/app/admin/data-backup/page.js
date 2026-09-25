'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import { fetchCompanies } from '../../../redux/actions/companiesActions';
import { canBackUp, isSuperAdmin } from '../../../lib/moduleAccess';

import Icon from '../../../components/Icon';

export default function DataBackupPage() {
  const user = useSelector((s) => s.auth.user);
  const superAdmin = isSuperAdmin(user);
  const mayBackUp = canBackUp(user);
  const dispatch = useDispatch();
  // A platform admin picks the company in the sidebar — the same selector Data
  // Reset works off, so the two always agree. A company's own Admin has only
  // one to back up, so there is nothing to pick: the id is left off and the
  // server pins it to them.
  const pickedId = useSelector((s) => s.adminFilter?.companyId);
  const companies = useSelector((s) => s.companies?.companies || []);
  const companyId = superAdmin ? pickedId : null;
  const company = superAdmin
    ? (companies.find((c) => c.id === pickedId) || null)
    : (user?.company_name ? { name: user.company_name } : null);
  // Only a platform admin has a company to choose; everyone else is ready at once.
  const ready = superAdmin ? !!pickedId : mayBackUp;

  const [excelBusy, setExcelBusy] = useState(false);
  const [excelMsg, setExcelMsg] = useState('');
  const [restoreFile, setRestoreFile] = useState(null);
  const [preview, setPreview] = useState(null);      // a clean dry run, ready to commit
  const [restoreMsg, setRestoreMsg] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const fileRef = useRef(null);

  const [resetInfo, setResetInfo] = useState(null);   // what a reset would delete
  const [resetKey, setResetKey] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!mayBackUp) return;
    if (superAdmin) dispatch(fetchCompanies());
  }, [mayBackUp, superAdmin, dispatch]);

  // A new file, or a different company, invalidates whatever was previewed.
  useEffect(() => { setPreview(null); setRestoreMsg(''); }, [restoreFile, companyId]);

  const loadReset = useCallback(() => {
    if (!ready) { setResetInfo(null); return; }
    fetch(SALES_ENDPOINTS.backupReset(companyId), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then(setResetInfo)
      .catch(() => setResetInfo(null));
  }, [ready, companyId]);

  useEffect(() => { loadReset(); }, [loadReset]);

  async function runReset() {
    setResetBusy(true); setResetMsg('');
    try {
      const res = await fetch(SALES_ENDPOINTS.backupReset(companyId), {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ reset_key: resetKey, confirm: resetConfirm }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setResetMsg(d.detail || `Failed (${res.status}).`);
      else {
        setResetMsg(`✅ ${d.detail}`);
        setResetKey(''); setResetConfirm('');
      }
      loadReset();
    } catch (e) { setResetMsg(e.message); }
    setResetBusy(false);
  }

  async function downloadExcel() {
    setExcelBusy(true); setExcelMsg('Building the workbook — a large company takes a minute.');
    try {
      const res = await fetch(SALES_ENDPOINTS.backupExcel(companyId), { headers: authHeaders() });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setExcelMsg('Could not build the backup: ' + (d.detail || res.status));
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(company?.name || 'company').replace(/[^A-Za-z0-9]+/g, '-')}-backup.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        setExcelMsg('✅ Downloaded.');
        loadReset();
      }
    } catch (e) { setExcelMsg(e.message); }
    setExcelBusy(false);
  }

  async function sendRestore(commit) {
    setRestoreBusy(true); setRestoreMsg('');
    try {
      const fd = new FormData();
      fd.append('file', restoreFile);
      if (companyId) fd.append('company_id', String(companyId));
      if (commit) fd.append('commit', '1');
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      // No Content-Type here on purpose — the browser sets the multipart boundary.
      const res = await fetch(SALES_ENDPOINTS.backupRestore, {
        method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setPreview(null);
        setRestoreMsg(d.detail || 'Those records already exist.');
      } else if (!res.ok) {
        setPreview(null);
        setRestoreMsg(d.detail || `Failed (${res.status}).`);
      } else if (commit) {
        setPreview(null);
        setRestoreFile(null);
        if (fileRef.current) fileRef.current.value = '';
        setRestoreMsg(`✅ Restored ${d.total} record${d.total === 1 ? '' : 's'}.`);
      } else {
        setPreview(d);
        setRestoreMsg('');
      }
    } catch (e) { setRestoreMsg(e.message); }
    setRestoreBusy(false);
  }

  if (!mayBackUp) {
    return <div className="dbx-denied">Admin access only.</div>;
  }

  return (
    <div className="nx-page nx-page-center nx-w-sm">
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Data Backup</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
        Take an Excel copy of a company&apos;s records whenever you want one, and put it back
        when you need it. A backup covers every module, only ever covers one company, and can
        only be restored into that same company.
      </p>

      {/* Excel snapshot — readable, and the thing Restore below reads back. */}
      <div className="nx-card dbx-card">
        <div className="dbx-head">Excel Backup</div>
        <div className="dbx-row">
          <div>
            <div className="dbx-title">{superAdmin ? 'Download one company as Excel' : 'Download your data as Excel'}</div>
            <div className="dbx-sub">
              {company
                ? <>A sheet per module for <b>{company.name}</b> — Sales, Channel Partner, HR, AR, Task Allocation and Club 1000, as they stand right now.</>
                : 'Pick a company in the sidebar first — a backup is always of one company.'}
            </div>
          </div>
          <button className="nx-btn nx-btn-md nx-btn-primary" onClick={downloadExcel}
            disabled={!ready || excelBusy}>
            {excelBusy ? 'Building…' : 'Download Excel'}
          </button>
        </div>
        {!!excelMsg && (
          <p className={`dbx-msg ${excelMsg[0] === '✅' ? 'is-good' : excelMsg.startsWith('Building') ? 'is-plain' : 'is-bad'}`}>
            {excelMsg[0] === '✅' ? <Icon name="check-circle" /> : null}
            {excelMsg.replace(/^[^\p{L}\p{N}]+/u, '')}
          </p>
        )}
      </div>

      {/* Restore — the other half of the export → Data Reset → restore loop. */}
      <div className="nx-card dbx-card">
        <div className="dbx-head">Restore from Excel</div>
        <div className="dbx-title">Put a backup&apos;s Sales records back</div>
        <div className="dbx-sub">
          Rebuilds this company from the workbook — every module, with the original ids, so
          everything still points where it did. Records that are already there are left alone,
          so this fills what is missing and never overwrites what is live: it works the same
          whether the company was wiped completely or only had a Data Reset. Restored user
          accounts come back without a password, so set one for each before they sign in.
        </div>

        <input className="dbx-file" type="file" accept=".xlsx" ref={fileRef}
          onChange={(e) => setRestoreFile(e.target.files?.[0] || null)} />

        <div className="dbx-actions">
          <button className="nx-btn nx-btn-md nx-btn-secondary"
            onClick={() => sendRestore(false)}
            disabled={!ready || !restoreFile || restoreBusy}>
            {restoreBusy && !preview ? 'Checking…' : 'Check file'}
          </button>
          <button className="nx-btn nx-btn-md nx-btn-primary"
            onClick={() => sendRestore(true)}
            disabled={!preview || restoreBusy}>
            {restoreBusy && preview ? 'Restoring…' : 'Restore'}
          </button>
        </div>

        {superAdmin && !pickedId && <p className="dbx-msg is-plain">Pick a company in the sidebar first.</p>}

        {preview && (
          <div className="dbx-plan">
            {preview.plan.filter((p) => p.restore > 0).map((p) => (
              <div className="dbx-plan-row" key={p.table}>
                <span>{p.table}</span><b>{p.restore.toLocaleString('en-IN')}</b>
              </div>
            ))}
            {preview.already_there > 0 && (
              <div className="dbx-plan-row">
                <span>Already there, left alone</span>
                <b>{preview.already_there.toLocaleString('en-IN')}</b>
              </div>
            )}
            <div className="dbx-plan-total">
              <span>Will be restored into {company?.name}</span>
              <b>{preview.total.toLocaleString('en-IN')}</b>
            </div>
          </div>
        )}

        {!!restoreMsg && (
          <p className={`dbx-msg ${restoreMsg[0] === '✅' ? 'is-good' : 'is-bad'}`}>
            <Icon name={restoreMsg[0] === '✅' ? 'check-circle' : 'alert'} />
            {restoreMsg.replace(/^[^\p{L}\p{N}]+/u, '')}
          </p>
        )}
      </div>

      {/* Reset — the destructive half, and the reason the backup above exists. */}
      <div className="nx-card dbx-card is-danger">
        <div className="dbx-head">Reset</div>
        <div className="dbx-title">Delete everything in this company</div>
        <div className="dbx-sub">
          Empties every module — leads, bookings, projects, plots, users, AR, tasks, Club 1000 —
          back to nothing. Your own account is kept so you can sign back in and restore. There is
          no undo except the Excel backup above, which is why one is required first.
        </div>

        <div className="dbx-gate is-met"><span className="dbx-gate-mark">1</span>
          <span>Download the Excel backup above{resetInfo?.backup_taken_at
            ? ` — taken ${new Date(resetInfo.backup_taken_at).toLocaleString('en-IN')}`
            : ''}</span>
        </div>
        <div className={`dbx-gate ${resetInfo?.can_reset ? 'is-met' : 'is-unmet'}`}>
          <span className="dbx-gate-mark">{resetInfo?.can_reset ? '✓' : '✕'}</span>
          <span>{resetInfo?.can_reset
            ? 'Backup taken — a reset is allowed for 2 hours'
            : 'No recent backup, so a reset is blocked'}</span>
        </div>
        <div className={`dbx-gate ${resetInfo?.key_configured ? 'is-met' : 'is-unmet'}`}>
          <span className="dbx-gate-mark">{resetInfo?.key_configured ? '✓' : '✕'}</span>
          <span>{resetInfo?.key_configured
            ? 'Reset key is configured on the server'
            : 'No DATA_RESET_KEY set on the server — reset is disabled'}</span>
        </div>

        {resetInfo?.total > 0 && (
          <div className="dbx-plan">
            {Object.entries(resetInfo.counts).map(([table, n]) => (
              <div className="dbx-plan-row" key={table}><span>{table}</span><b>{n.toLocaleString('en-IN')}</b></div>
            ))}
            <div className="dbx-plan-total">
              <span>Would be deleted</span><b>{resetInfo.total.toLocaleString('en-IN')}</b>
            </div>
          </div>
        )}

        <div className="dbx-fields">
          <input className="nx-input" type="password" placeholder="Reset key"
            value={resetKey} onChange={(e) => setResetKey(e.target.value)}
            autoComplete="off" disabled={!resetInfo?.can_reset || !resetInfo?.key_configured} />
          <input className="nx-input" placeholder="Type DELETE to confirm"
            value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)}
            disabled={!resetInfo?.can_reset || !resetInfo?.key_configured} />
        </div>

        <button className="nx-btn nx-btn-md nx-btn-danger" onClick={runReset}
          disabled={resetBusy || !resetInfo?.can_reset || !resetInfo?.key_configured
                    || !resetKey || resetConfirm !== 'DELETE'}>
          {resetBusy ? 'Deleting…' : 'Reset this company'}
        </button>

        {!!resetMsg && (
          <p className={`dbx-msg ${resetMsg[0] === '✅' ? 'is-good' : 'is-bad'}`}>
            <Icon name={resetMsg[0] === '✅' ? 'check-circle' : 'alert'} />
            {resetMsg.replace(/^[^\p{L}\p{N}]+/u, '')}
          </p>
        )}
      </div>
    </div>
  );
}
