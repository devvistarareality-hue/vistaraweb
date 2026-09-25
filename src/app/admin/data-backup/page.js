'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import { fetchCompanies } from '../../../redux/actions/companiesActions';
import { canBackUp, isSuperAdmin } from '../../../lib/moduleAccess';

import Icon from '../../../components/Icon';
import { notify } from '../../../lib/notify';
import Loader from '../../../components/Loader';
const GREEN = 'var(--success)';
const RED   = 'var(--danger)';
const AMBER = 'var(--warning)';

const STATUS_CFG = {
  success: { label: 'Success', color: GREEN, bg: 'var(--surface-2)' },
  failed:  { label: 'Failed',  color: RED,   bg: 'var(--danger-soft)' },
  running: { label: 'Running', color: AMBER, bg: 'var(--warning-soft)' },
};

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

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

  const [settings, setSettings] = useState(null);
  const [frequency, setFrequency] = useState('weekly');
  const [enabled, setEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  const loadSettings = useCallback(() => {
    fetch(SALES_ENDPOINTS.backupSettings, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setSettings(d); setFrequency(d.frequency); setEnabled(d.is_enabled); } });
  }, []);

  const loadRecords = useCallback(() => {
    setLoading(true);
    fetch(SALES_ENDPOINTS.backups, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setRecords(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mayBackUp) return;
    if (superAdmin) { loadSettings(); loadRecords(); dispatch(fetchCompanies()); }
  }, [mayBackUp, superAdmin, loadSettings, loadRecords, dispatch]);

  // A new file, or a different company, invalidates whatever was previewed.
  useEffect(() => { setPreview(null); setRestoreMsg(''); }, [restoreFile, companyId]);

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

  async function saveSettings() {
    setSavingSettings(true); setSettingsMsg('');
    try {
      const res = await fetch(SALES_ENDPOINTS.backupSettings, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ frequency, is_enabled: enabled }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setSettings(d); setSettingsMsg('✅ Saved.'); }
      else setSettingsMsg('Error: ' + (d.detail || res.status));
    } catch (e) { setSettingsMsg(e.message); }
    setSavingSettings(false);
  }

  async function runNow() {
    setRunning(true); setRunMsg('');
    try {
      const res = await fetch(SALES_ENDPOINTS.backupRun, { method: 'POST', headers: authHeaders() });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setRunMsg('✅ Backup completed.');
      else setRunMsg('Backup failed: ' + (d.error_message || d.detail || res.status));
      loadRecords();
    } catch (e) { setRunMsg(e.message); }
    setRunning(false);
  }

  async function download(id) {
    setDownloadingId(id);
    try {
      const res = await fetch(SALES_ENDPOINTS.backupDownload(id), { headers: authHeaders() });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
      else notify('Could not get a download link: ' + (d.detail || res.status));
    } catch (e) { notify(e.message); }
    setDownloadingId(null);
  }

  if (!mayBackUp) {
    return <div className="dbx-denied">Admin access only.</div>;
  }

  const dirty = settings && (frequency !== settings.frequency || enabled !== settings.is_enabled);

  return (
    <div className="nx-page nx-page-center nx-w-sm">
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Data Backup</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
        {superAdmin
          ? <>A full backup of every business record (leads, bookings, projects, Club 1000, users) is
            taken automatically on the schedule below and stored securely. Restoring one of those
            scheduled backups is a deliberate, assisted operation — ask your platform admin. The
            Excel backup below is the one you can take and put back yourself, around a Data Reset.</>
          : <>Take an Excel copy of your company&apos;s records whenever you want one, and put it back
            after a Data Reset. A backup only ever covers your own company, and can only be restored
            into it.</>}
      </p>

      {/* Schedule — the platform-wide JSON dump, which is not a per-company thing. */}
      {superAdmin && <>
      <div className="nx-card" style={{ background: 'var(--surface)', border: '1px solid var(--surface-3)', borderRadius: 18, padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: 'var(--faint)', textTransform: 'uppercase', marginBottom: 14 }}>
          Backup Schedule
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 }}>Frequency</label>
            <select className="nx-input" value={frequency} onChange={(e) => setFrequency(e.target.value)}
              style={{ height: 40, padding: '0 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, fontWeight: 600, cursor: 'pointer', minWidth: 160 }}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer', height: 40 }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Automatic backups enabled
          </label>
          <button className="nx-btn nx-btn-sm nx-btn-primary" onClick={saveSettings} disabled={!dirty || savingSettings}
            style={{ height: 40, padding: '0 20px', borderRadius: 14, border: 'none', fontSize: 13, fontWeight: 700,
              background: dirty ? 'var(--strong)' : 'var(--blue-2)', color: '#fff', cursor: dirty && !savingSettings ? 'pointer' : 'not-allowed' }}>
            {savingSettings ? 'Saving…' : 'Save'}
          </button>
        </div>
        {settings?.updated_by_name && (
          <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 10 }}>
            Last changed by {settings.updated_by_name} · {fmtDateTime(settings.updated_at)}
          </p>
        )}
        {!!settingsMsg && <p style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: settingsMsg[0] === '✅' ? GREEN : RED, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name={settingsMsg[0] === '✅' ? 'check-circle' : 'alert'} />{settingsMsg.replace(/^[^\p{L}\p{N}]+/u, '')}</p>}
      </div>

      {/* Run now */}
      <div className="nx-card" style={{ background: 'var(--surface)', border: '1px solid var(--surface-3)', borderRadius: 18, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Run a backup right now</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Doesn't affect the schedule above — useful before a risky change.</div>
        </div>
        <button className="nx-btn nx-btn-md nx-btn-primary" onClick={runNow} disabled={running}
          style={{ padding: '11px 22px', borderRadius: 14, border: 'none', fontSize: 13, fontWeight: 800,
            background: running ? 'var(--blue)' : 'var(--primary)', color: '#fff', cursor: running ? 'not-allowed' : 'pointer' }}>
          {running ? 'Backing up…' : 'Run Backup Now'}
        </button>
      </div>
      {!!runMsg && <p style={{ marginTop: -8, marginBottom: 18, fontSize: 13, fontWeight: 600, color: runMsg[0] === '✅' ? GREEN : RED, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name={runMsg[0] === '✅' ? 'check-circle' : 'alert'} />{runMsg.replace(/^[^\p{L}\p{N}]+/u, '')}</p>}
      </>}

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
          For after Data Reset: this writes back the leads, follow-ups, site visits, bookings,
          closures, distribution log, availability and notifications from the file, with their
          original ids. It refuses if any of those records still exist, so it can only ever fill
          data that has been cleared — never overwrite what is live.
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
            {preview.plan.filter((p) => p.rows > 0).map((p) => (
              <div className="dbx-plan-row" key={p.table}>
                <span>{p.table}</span><b>{p.rows.toLocaleString('en-IN')}</b>
              </div>
            ))}
            <div className="dbx-plan-total">
              <span>Ready to restore into {company?.name}</span>
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

      {/* History — of the scheduled platform dump, so platform admins only. */}
      {superAdmin && <div className="nx-card dbx-panel">
        <div style={{ padding: '14px 18px', fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: 'var(--faint)', textTransform: 'uppercase', borderBottom: '1px solid var(--surface-2)' }}>
          Backup History
        </div>
        {loading ? (
          <Loader label="Loading backups…" />
        ) : records.length === 0 ? (
          <p style={{ padding: 18, color: 'var(--muted)', fontSize: 13 }}>No backups yet.</p>
        ) : (
          <table className="nx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                <th style={th}>Date</th>
                <th style={th}>Status</th>
                <th style={th}>Size</th>
                <th style={th}>Triggered By</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const cfg = STATUS_CFG[r.status] || STATUS_CFG.running;
                return (
                  <tr key={r.id}>
                    <td style={td}>{fmtDateTime(r.started_at)}</td>
                    <td style={td}>
                      <span className="nx-badge" style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </td>
                    <td style={td}>{fmtSize(r.file_size_bytes)}</td>
                    <td style={{ ...td, color: 'var(--muted)' }}>{r.triggered_by_name || 'Automatic'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {r.status === 'success' && (
                        <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => download(r.id)} disabled={downloadingId === r.id}>
                          {downloadingId === r.id ? '…' : '⬇ Download'}
                        </button>
                      )}
                      {r.status === 'failed' && r.error_message && (
                        <span title={r.error_message} style={{ fontSize: 11, color: RED }}><Icon name="alert" /> {r.error_message.slice(0, 40)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>}
    </div>
  );
}

const th = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', borderTop: '1px solid var(--surface-2)', color: 'var(--text)' };
