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

  // Which modules to back up, and which to reset. Empty means all.
  const [backupMods, setBackupMods] = useState([]);
  const [resetMods, setResetMods] = useState([]);
  const [sched, setSched] = useState(null);
  const [schedBusy, setSchedBusy] = useState('');

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
    fetch(SALES_ENDPOINTS.backupReset(companyId, resetMods), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then(setResetInfo)
      .catch(() => setResetInfo(null));
  }, [ready, companyId, resetMods]);

  const loadSched = useCallback(() => {
    if (!ready) { setSched(null); return; }
    fetch(SALES_ENDPOINTS.backupSchedule(companyId), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSched)
      .catch(() => setSched(null));
  }, [ready, companyId]);

  useEffect(() => { loadSched(); }, [loadSched]);

  const modules = sched?.modules || resetInfo?.modules || [];
  // What a reset would actually empty: the ticks, plus whatever they drag in.
  const destroys = resetInfo?.destroys || [];
  const toggle = (list, setList) => (m) =>
    setList(list.includes(m) ? list.filter((x) => x !== m) : [...list, m]);

  async function saveSched(patch) {
    setSchedBusy('save');
    try {
      const r = await fetch(SALES_ENDPOINTS.backupSchedule(companyId), {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify(patch) });
      if (r.ok) setSched(await r.json());
    } catch (e) { /* the panel just stays as it was */ }
    setSchedBusy('');
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

  useEffect(() => { loadReset(); }, [loadReset]);

  async function runReset() {
    setResetBusy(true); setResetMsg('');
    try {
      const res = await fetch(SALES_ENDPOINTS.backupReset(companyId), {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ reset_key: resetKey, confirm: resetConfirm,
                               modules: resetMods.join(',') }),
      });
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

  async function downloadExcel() {
    setExcelBusy(true); setExcelMsg('Building the workbook — a large company takes a minute.');
    try {
      const res = await fetch(SALES_ENDPOINTS.backupExcel(companyId, backupMods), { headers: authHeaders() });
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

        {modules.length > 0 && (<>
          <div className="dbx-mods">
            {modules.map((m) => (
              <button type="button" key={m}
                className={`dbx-mod${backupMods.includes(m) ? ' is-on' : ''}`}
                onClick={() => toggle(backupMods, setBackupMods)(m)}>{m}</button>
            ))}
          </div>
          <p className="dbx-modnote">
            {backupMods.length
              ? `${backupMods.length} module${backupMods.length === 1 ? '' : 's'} — a reset is only allowed for what a backup covers.`
              : 'Nothing picked, so the backup covers every module.'}
          </p>
        </>)}
        {!!excelMsg && (
          <p className={`dbx-msg ${excelMsg[0] === '✅' ? 'is-good' : excelMsg.startsWith('Building') ? 'is-plain' : 'is-bad'}`}>
            {excelMsg[0] === '✅' ? <Icon name="check-circle" /> : null}
            {excelMsg.replace(/^[^\p{L}\p{N}]+/u, '')}
          </p>
        )}
      </div>

      {/* Automatic backups, kept server-side so there is one even if nobody remembers. */}
      <div className="nx-card dbx-card">
        <div className="dbx-head">Automatic Backup</div>
        <div className="dbx-title">Take one on a schedule</div>
        <div className="dbx-sub">
          Runs unattended and keeps the workbook, so there is always a recent one to fall back
          on. The download above is the on-demand copy and is never stored.
        </div>

        <div className="dbx-sched">
          <label>
            <input type="checkbox" checked={!!sched?.is_enabled} disabled={!ready || !!schedBusy}
              onChange={(e) => saveSched({ is_enabled: e.target.checked })} />
            Enabled
          </label>
          <select className="nx-input" value={sched?.frequency || 'weekly'}
            disabled={!ready || !!schedBusy}
            onChange={(e) => saveSched({ frequency: e.target.value })}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <label>
            Keep last
            <input className="nx-input" type="number" min="1" max="50"
              value={sched?.keep_last ?? 10} disabled={!ready || !!schedBusy}
              onChange={(e) => saveSched({ keep_last: e.target.value })} />
          </label>
          <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={takeStored}
            disabled={!ready || !!schedBusy}>
            {schedBusy === 'take' ? 'Taking…' : 'Take one now'}
          </button>
        </div>

        {modules.length > 0 && (
          <div className="dbx-mods">
            {modules.map((m) => {
              const on = (sched?.selected_modules || []).includes(m);
              return (
                <button type="button" key={m} className={`dbx-mod${on ? ' is-on' : ''}`}
                  disabled={!ready || !!schedBusy}
                  onClick={() => saveSched({ modules: on
                    ? (sched.selected_modules || []).filter((x) => x !== m)
                    : [...(sched?.selected_modules || []), m] })}>{m}</button>
              );
            })}
          </div>
        )}
        <p className="dbx-modnote">
          {(sched?.selected_modules || []).length
            ? 'The scheduled backup covers only these modules.'
            : 'Nothing picked, so the scheduled backup covers every module.'}
        </p>

        <div className="dbx-history">
          {(sched?.history || []).length === 0
            ? <p className="dbx-empty">No stored backups yet.</p>
            : sched.history.map((h) => (
              <div className="dbx-hrow" key={h.id}>
                <span className="dbx-hwhen">{new Date(h.taken_at).toLocaleString('en-IN')}</span>
                <span className="dbx-hmeta">
                  {h.rows?.toLocaleString('en-IN')} rows
                  {h.size ? ` · ${(h.size / 1024 / 1024).toFixed(1)} MB` : ''}
                  {` · ${h.modules?.length ? h.modules.join(', ') : 'every module'}`}
                  {h.by ? ` · ${h.by}` : ''}
                </span>
                <button className="nx-btn nx-btn-sm nx-btn-secondary"
                  onClick={() => openStored(h.id)}>Download</button>
              </div>
            ))}
        </div>
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
        <div className="dbx-title">
          {resetMods.length ? 'Delete these modules' : 'Delete everything in this company'}
        </div>
        <div className="dbx-sub">
          Empties the modules below back to nothing. There is no undo except a backup that
          covers what goes. Your own account survives with its password, so you can sign back in
          and restore — but everyone else comes back from the workbook <b>without a password</b>,
          since hashes are deliberately never written to a backup file. Set one for each of them
          in User Management afterwards.
        </div>

        {modules.length > 0 && (<>
          <div className="dbx-mods">
            {modules.map((m) => {
              const picked = resetMods.includes(m);
              const dragged = !picked && destroys.includes(m);
              return (
                <button type="button" key={m}
                  className={`dbx-mod${picked ? ' is-on' : ''}${dragged ? ' is-forced' : ''}`}
                  onClick={() => toggle(resetMods, setResetMods)(m)}>
                  {m}{dragged ? ' ·' : ''}
                </button>
              );
            })}
          </div>
          <p className="dbx-modnote">
            {resetMods.length === 0
              ? 'Nothing picked, so every module goes.'
              : destroys.length > resetMods.length
                ? `Also empties ${destroys.filter((m) => !resetMods.includes(m)).join(', ')} — those records hang off what you picked and cannot survive it.`
                : 'Only these modules go.'}
          </p>
        </>)}

        <div className={`dbx-gate ${resetInfo?.can_reset ? 'is-met' : 'is-unmet'}`}>
          <span className="dbx-gate-mark">{resetInfo?.can_reset ? '✓' : '✕'}</span>
          <span>{resetInfo?.can_reset
            ? `Backup covers ${(resetInfo.backup_covers || []).join(', ') || 'every module'} — a reset is allowed for 2 hours`
            : `No recent backup covering ${destroys.join(', ') || 'these modules'}`}</span>
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
          {resetBusy ? 'Deleting…'
            : resetMods.length ? `Reset ${destroys.length} module${destroys.length === 1 ? '' : 's'}`
            : 'Reset this company'}
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
