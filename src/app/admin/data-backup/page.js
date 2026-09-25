'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import { fetchCompanies } from '../../../redux/actions/companiesActions';
import { canBackUp, isSuperAdmin } from '../../../lib/moduleAccess';

import Icon from '../../../components/Icon';

const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '');
const fmtSize = (b) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : '—');

export default function DataBackupPage() {
  const user = useSelector((s) => s.auth.user);
  const superAdmin = isSuperAdmin(user);
  const mayBackUp = canBackUp(user);
  const dispatch = useDispatch();
  // A platform admin picks the company in the sidebar — the same selector Data
  // Reset works off, so the two always agree. A company's own Admin has only one
  // to back up, so there is nothing to pick: the id is left off and the server
  // pins it to them.
  const pickedId = useSelector((s) => s.adminFilter?.companyId);
  const companies = useSelector((s) => s.companies?.companies || []);
  const companyId = superAdmin ? pickedId : null;
  const company = superAdmin
    ? (companies.find((c) => c.id === pickedId) || null)
    : (user?.company_name ? { name: user.company_name } : null);
  const ready = superAdmin ? !!pickedId : mayBackUp;

  const [excelBusy, setExcelBusy] = useState(false);
  const [excelMsg, setExcelMsg] = useState('');

  const [sched, setSched] = useState(null);
  const [schedBusy, setSchedBusy] = useState('');

  const [restoreFile, setRestoreFile] = useState(null);
  const [preview, setPreview] = useState(null);      // a clean dry run, ready to commit
  const [restoreMsg, setRestoreMsg] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const fileRef = useRef(null);

  const [resetInfo, setResetInfo] = useState(null);  // what a reset would delete
  const [resetKey, setResetKey] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    if (mayBackUp && superAdmin) dispatch(fetchCompanies());
  }, [mayBackUp, superAdmin, dispatch]);

  // A new file, or a different company, invalidates whatever was previewed.
  useEffect(() => { setPreview(null); setRestoreMsg(''); }, [restoreFile, companyId]);

  const loadReset = useCallback(() => {
    if (!ready) { setResetInfo(null); return; }
    fetch(SALES_ENDPOINTS.backupReset(companyId), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null)).then(setResetInfo).catch(() => setResetInfo(null));
  }, [ready, companyId]);

  const loadSched = useCallback(() => {
    if (!ready) { setSched(null); return; }
    fetch(SALES_ENDPOINTS.backupSchedule(companyId), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null)).then(setSched).catch(() => setSched(null));
  }, [ready, companyId]);

  useEffect(() => { loadReset(); }, [loadReset]);
  useEffect(() => { loadSched(); }, [loadSched]);

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

  async function saveSched(patch) {
    setSchedBusy('save');
    try {
      const r = await fetch(SALES_ENDPOINTS.backupSchedule(companyId), {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify(patch) });
      if (r.ok) setSched(await r.json());
    } catch (e) { /* the panel just stays as it was */ }
    setSchedBusy('');
  }

  // "Keep last" is typed, so it needs a draft of its own: the field follows the
  // saved value except while you are editing it.
  const [keepDraft, setKeepDraft] = useState('10');
  useEffect(() => {
    if (sched?.keep_last != null) setKeepDraft(String(sched.keep_last));
  }, [sched?.keep_last]);

  function commitKeep() {
    const n = parseInt(keepDraft, 10);
    if (!Number.isFinite(n)) {                 // emptied, or not a number
      setKeepDraft(String(sched?.keep_last ?? 10));
      return;
    }
    const clamped = Math.max(1, Math.min(50, n));   // same bounds the server applies
    setKeepDraft(String(clamped));
    if (clamped !== sched?.keep_last) saveSched({ keep_last: clamped });
  }

  async function takeStored() {
    setSchedBusy('take');
    try {
      const r = await fetch(SALES_ENDPOINTS.backupSchedule(companyId), {
        method: 'POST', headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setSched(d); loadReset(); }
      else setExcelMsg(d.detail || 'Could not store the backup.');
    } catch (e) { setExcelMsg(e.message); }
    setSchedBusy('');
  }

  async function openStored(id) {
    try {
      const r = await fetch(SALES_ENDPOINTS.backupStored(id, companyId), { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
      else setExcelMsg(d.detail || 'Could not get a download link.');
    } catch (e) { setExcelMsg(e.message); }
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
        method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPreview(null);
        setRestoreMsg(d.detail || `Failed (${res.status}).`);
      } else if (commit) {
        setPreview(null); setRestoreFile(null);
        if (fileRef.current) fileRef.current.value = '';
        setRestoreMsg(`✅ Restored ${d.total} record${d.total === 1 ? '' : 's'}.`);
        loadReset(); loadSched();
      } else {
        setPreview(d); setRestoreMsg('');
      }
    } catch (e) { setRestoreMsg(e.message); }
    setRestoreBusy(false);
  }

  async function runReset() {
    setResetBusy(true); setResetMsg('');
    try {
      const res = await fetch(SALES_ENDPOINTS.backupReset(companyId), {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ reset_key: resetKey, confirm: resetConfirm }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setResetMsg(d.detail || `Failed (${res.status}).`);
      else {
        setResetMsg(`✅ ${d.detail}`);
        setResetKey(''); setResetConfirm(''); loadSched();
      }
      loadReset();
    } catch (e) { setResetMsg(e.message); }
    setResetBusy(false);
  }

  if (!mayBackUp) return <div className="dbx-denied">Admin access only.</div>;

  const canReset = !!resetInfo?.can_reset && !!resetInfo?.key_configured;

  return (
    <div className="nx-page nx-page-center nx-w-sm">
      <h1 className="nx-page-title">Data Backup &amp; Reset</h1>
      <p className="nx-page-sub">
        An Excel copy of one company&apos;s records — every module in one workbook, because the
        modules reference each other and a partial copy could not be put back on its own. It
        restores only into the company it came from, and it carries password hashes so restored
        accounts can sign in, so keep the file somewhere private.
      </p>

      {/* ── Take one now ── */}
      <section className="nx-card dbx-card">
        <div className="dbx-head">Excel backup</div>
        <div className="dbx-row">
          <div className="dbx-rowtext">
            <div className="dbx-title">Download this company</div>
            <div className="dbx-sub">
              {company
                ? <>Every module for <b>{company.name}</b>, as it stands right now.</>
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
      </section>

      {/* ── On a schedule ── */}
      <section className="nx-card dbx-card">
        <div className="dbx-head">Automatic backup</div>
        <div className="dbx-row">
          <div className="dbx-rowtext">
            <div className="dbx-title">Take one on a schedule</div>
            <div className="dbx-sub">
              Runs unattended and keeps the workbook, so there is always a recent one to fall
              back on. The download above is the on-demand copy and is never stored.
            </div>
          </div>
          <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={takeStored}
            disabled={!ready || !!schedBusy}>
            {schedBusy === 'take' ? 'Taking…' : 'Take one now'}
          </button>
        </div>

        <div className="dbx-fields">
          <label className="dbx-field dbx-field-toggle">
            <input type="checkbox" checked={!!sched?.is_enabled} disabled={!ready || !!schedBusy}
              onChange={(e) => saveSched({ is_enabled: e.target.checked })} />
            <span>Enabled</span>
          </label>
          <label className="dbx-field">
            <span className="dbx-label">Frequency</span>
            <select className="nx-input" value={sched?.frequency || 'weekly'}
              disabled={!ready || !!schedBusy}
              onChange={(e) => saveSched({ frequency: e.target.value })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="dbx-field dbx-field-sm">
            <span className="dbx-label">Keep last</span>
            {/* Saved when you leave the field, not on every keystroke — a
                per-keystroke save disabled the input mid-typing and replaced
                what you had typed with the half-number the server had just
                stored, so "10" could never be reached from "1". */}
            <input className="nx-input" type="number" min="1" max="50" inputMode="numeric"
              value={keepDraft} disabled={!ready || schedBusy === 'take'}
              onChange={(e) => setKeepDraft(e.target.value)}
              onBlur={commitKeep}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          </label>
        </div>

        <div className="dbx-history">
          {(sched?.history || []).length === 0
            ? <p className="dbx-empty">No stored backups yet.</p>
            : sched.history.map((h) => (
              <div className="dbx-hrow" key={h.id}>
                <span className="dbx-hwhen">{fmtWhen(h.taken_at)}</span>
                <span className="dbx-hmeta">
                  {h.rows?.toLocaleString('en-IN')} rows · {fmtSize(h.size)}{h.by ? ` · ${h.by}` : ''}
                </span>
                <button className="nx-btn nx-btn-sm nx-btn-secondary"
                  onClick={() => openStored(h.id)}>Download</button>
              </div>
            ))}
        </div>
      </section>

      {/* ── Put one back ── */}
      <section className="nx-card dbx-card">
        <div className="dbx-head">Restore</div>
        <div className="dbx-title">Put a backup back</div>
        <div className="dbx-sub">
          Rebuilds this company from the workbook — every module, with the original ids, so
          everything still points where it did and restored accounts keep the passwords they
          had. Records already there are left alone, so this fills what is missing and never
          overwrites what is live.
        </div>

        <label className="dbx-file">
          <input type="file" accept=".xlsx" ref={fileRef}
            onChange={(e) => setRestoreFile(e.target.files?.[0] || null)} />
          <span className="dbx-file-name">{restoreFile ? restoreFile.name : 'Choose a backup file'}</span>
          <span className="dbx-file-btn">Browse</span>
        </label>

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
              <span>Will be restored</span><b>{preview.total.toLocaleString('en-IN')}</b>
            </div>
          </div>
        )}

        <div className="dbx-actions">
          <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => sendRestore(false)}
            disabled={!ready || !restoreFile || restoreBusy}>
            {restoreBusy && !preview ? 'Checking…' : 'Check file'}
          </button>
          <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => sendRestore(true)}
            disabled={!preview || restoreBusy}>
            {restoreBusy && preview ? 'Restoring…' : 'Restore'}
          </button>
        </div>

        {!!restoreMsg && (
          <p className={`dbx-msg ${restoreMsg[0] === '✅' ? 'is-good' : 'is-bad'}`}>
            <Icon name={restoreMsg[0] === '✅' ? 'check-circle' : 'alert'} />
            {restoreMsg.replace(/^[^\p{L}\p{N}]+/u, '')}
          </p>
        )}
      </section>

      {/* ── Empty it ── */}
      <section className="nx-card dbx-card is-danger">
        <div className="dbx-head">Reset</div>
        <div className="dbx-title">Delete everything in this company</div>
        <div className="dbx-sub">
          Empties every module back to nothing. Your own account survives so you can sign back
          in and restore, and everyone else comes back able to sign in with the password they
          had. There is no undo except the backup.
        </div>

        <div className="dbx-gates">
          <div className={`dbx-gate ${resetInfo?.can_reset ? 'is-met' : 'is-unmet'}`}>
            <span className="dbx-gate-mark">{resetInfo?.can_reset ? '✓' : '✕'}</span>
            <span>{resetInfo?.can_reset
              ? `Backup taken ${fmtWhen(resetInfo.backup_taken_at)} — a reset is allowed for 2 hours`
              : 'No recent backup — download one above first'}</span>
          </div>
          <div className={`dbx-gate ${resetInfo?.key_configured ? 'is-met' : 'is-unmet'}`}>
            <span className="dbx-gate-mark">{resetInfo?.key_configured ? '✓' : '✕'}</span>
            <span>{resetInfo?.key_configured
              ? 'Reset key is configured on the server'
              : 'No DATA_RESET_KEY set on the server — reset is disabled'}</span>
          </div>
        </div>

        {resetInfo?.total > 0 && (
          <div className="dbx-plan">
            {Object.entries(resetInfo.counts).map(([table, n]) => (
              <div className="dbx-plan-row" key={table}>
                <span>{table}</span><b>{n.toLocaleString('en-IN')}</b>
              </div>
            ))}
            <div className="dbx-plan-total">
              <span>Would be deleted</span><b>{resetInfo.total.toLocaleString('en-IN')}</b>
            </div>
          </div>
        )}

        <div className="dbx-fields">
          <label className="dbx-field">
            <span className="dbx-label">Reset key</span>
            <input className="nx-input" type="password" placeholder="From the server environment"
              value={resetKey} onChange={(e) => setResetKey(e.target.value)}
              autoComplete="off" disabled={!canReset} />
          </label>
          <label className="dbx-field">
            <span className="dbx-label">Confirm</span>
            <input className="nx-input" placeholder="Type DELETE"
              value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)}
              disabled={!canReset} />
          </label>
        </div>

        <button className="nx-btn nx-btn-md nx-btn-danger" onClick={runReset}
          disabled={resetBusy || !canReset || !resetKey || resetConfirm !== 'DELETE'}>
          {resetBusy ? 'Deleting…' : 'Reset this company'}
        </button>

        {!!resetMsg && (
          <p className={`dbx-msg ${resetMsg[0] === '✅' ? 'is-good' : 'is-bad'}`}>
            <Icon name={resetMsg[0] === '✅' ? 'check-circle' : 'alert'} />
            {resetMsg.replace(/^[^\p{L}\p{N}]+/u, '')}
          </p>
        )}
      </section>
    </div>
  );
}
