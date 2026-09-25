'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import { downloadInBackground } from '../../../lib/downloadInBackground';
import { fetchCompanies } from '../../../redux/actions/companiesActions';
import { canBackUp, isSuperAdmin } from '../../../lib/moduleAccess';

import Icon from '../../../components/Icon';

const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '');
const fmtSize = (b) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : '—');

// These operations run for minutes on a large company. A disabled button reads
// as a hung page, so anything long-running shows this instead.
function Working({ label, note }) {
  return (
    <div className="dbx-working" role="status" aria-live="polite">
      <div className="dbx-working-bar"><span /></div>
      <div className="dbx-working-label"><span className="dbx-spin" />{label}</div>
      {note ? <div className="dbx-working-note">{note}</div> : null}
    </div>
  );
}

// The answer to "did that work?", stated once it is known.
function Result({ value }) {
  if (!value) return null;
  return (
    <div className={`dbx-result is-${value.tone}`} role="status" aria-live="polite">
      <span className="dbx-result-mark">
        <Icon name={value.tone === 'good' ? 'check' : value.tone === 'bad' ? 'alert' : 'info'} />
      </span>
      <div className="dbx-result-text">
        <div className="dbx-result-title">{value.title}</div>
        {value.detail ? <div className="dbx-result-sub">{value.detail}</div> : null}
      </div>
    </div>
  );
}

const good = (title, detail) => ({ tone: 'good', title, detail });
const bad  = (title, detail) => ({ tone: 'bad', title, detail });

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
  const [excelMsg, setExcelMsg] = useState(null);

  const [sched, setSched] = useState(null);
  const [schedBusy, setSchedBusy] = useState('');
  const [schedMsg, setSchedMsg] = useState(null);

  const [restoreFile, setRestoreFile] = useState(null);
  const [preview, setPreview] = useState(null);      // a clean dry run, ready to commit
  const [restoreMsg, setRestoreMsg] = useState(null);
  const [restoreBusy, setRestoreBusy] = useState('');   // '' | 'check' | 'commit'
  const fileRef = useRef(null);

  const [resetInfo, setResetInfo] = useState(null);  // what a reset would delete
  const [resetKey, setResetKey] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetStage, setResetStage] = useState('');   // backup → download → reset
  const [resetMsg, setResetMsg] = useState(null);

  useEffect(() => {
    if (mayBackUp && superAdmin) dispatch(fetchCompanies());
  }, [mayBackUp, superAdmin, dispatch]);

  // A new file, or a different company, invalidates whatever was previewed. Clearing
  // the file after a successful restore must not also clear the "restored" message,
  // so only a newly chosen file does that.
  useEffect(() => { setPreview(null); if (restoreFile) setRestoreMsg(null); }, [restoreFile]);
  useEffect(() => { setPreview(null); setRestoreMsg(null); }, [companyId]);

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
    setExcelBusy(true); setExcelMsg(null);
    try {
      const res = await fetch(SALES_ENDPOINTS.backupExcel(companyId), { headers: authHeaders() });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setExcelMsg(bad('Could not build the backup', d.detail || `The server returned ${res.status}.`));
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(company?.name || 'company').replace(/[^A-Za-z0-9]+/g, '-')}-backup.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        setExcelMsg(good('Backup downloaded',
          `The workbook for ${company?.name || 'this company'} is in your downloads.`));
        loadReset();
      }
    } catch (e) { setExcelMsg(bad('Could not build the backup', e.message)); }
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
    setSchedBusy('take'); setSchedMsg(null);
    try {
      const r = await fetch(SALES_ENDPOINTS.backupSchedule(companyId), {
        method: 'POST', headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setSched(d);
        const latest = (d.history || [])[0];
        setSchedMsg(good('Backup stored', latest
          ? `${latest.rows?.toLocaleString('en-IN')} records · ${fmtSize(latest.size)} · downloading, and kept in the list below.`
          : 'It is in the list below, ready to download or restore.'));
        loadReset();
        // Taking one by hand means you want it in hand too, so it downloads straight away.
        if (latest?.id) downloadStored(latest.id);
      } else setSchedMsg(bad('Could not store the backup', d.detail));
    } catch (e) { setSchedMsg(bad('Could not store the backup', e.message)); }
    setSchedBusy('');
  }

  // Starts the download without a new tab or a navigation (see downloadInBackground).
  async function downloadStored(id) {
    try {
      const r = await fetch(SALES_ENDPOINTS.backupStored(id, companyId), { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) { setSchedMsg(bad('Could not get a download link', d.detail)); return false; }
      downloadInBackground(d.url);
      return true;
    } catch (e) { setSchedMsg(bad('Could not get a download link', e.message)); return false; }
  }

  async function openStored(id) {
    try {
      const r = await fetch(SALES_ENDPOINTS.backupStored(id, companyId), { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
      else setSchedMsg(bad('Could not get a download link', d.detail));
    } catch (e) { setSchedMsg(bad('Could not get a download link', e.message)); }
  }

  async function sendRestore(commit) {
    setRestoreBusy(commit ? 'commit' : 'check'); setRestoreMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', restoreFile);
      if (companyId) fd.append('company_id', String(companyId));
      if (commit) fd.append('commit', '1');
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const before = resetInfo?.total ?? 0;
      // No Content-Type here on purpose — the browser sets the multipart boundary.
      let res = null, d = {};
      try {
        res = await fetch(SALES_ENDPOINTS.backupRestore, {
          method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } });
        d = await res.json().catch(() => ({}));
      } catch (e) { res = null; }
      // Restoring a big company can outlast the proxy's connection while the server
      // carries on and finishes — so a lost reply means "ask the server".
      if (commit && (!res || res.status === 502 || res.status === 504)) {
        const after = await waitForRestore(before);
        setPreview(null); setRestoreFile(null);
        if (fileRef.current) fileRef.current.value = '';
        setRestoreMsg(after > before
          ? good('Backup restored', `${(after - before).toLocaleString('en-IN')} records put back into `
              + `${company?.name || 'this company'}. It took longer than the connection stayed open, but the server finished it.`)
          : bad('Could not confirm the restore',
              'The server may still be working. Refresh this page in a minute to see the counts.'));
        loadReset(); loadSched();
      } else if (!res) {
        setRestoreMsg(bad('That file cannot be checked', 'The connection dropped. Try again.'));
      } else if (!res.ok) {
        setPreview(null);
        setRestoreMsg(bad(commit ? 'Restore failed' : 'That file cannot be restored',
                          d.detail || `The server returned ${res.status}.`));
      } else if (commit) {
        setPreview(null); setRestoreFile(null);
        if (fileRef.current) fileRef.current.value = '';
        const n = (d.total || 0).toLocaleString('en-IN');
        setRestoreMsg(good('Backup restored',
          `${n} record${d.total === 1 ? '' : 's'} put back into ${company?.name || 'this company'}` +
          (d.already_there ? `. ${d.already_there.toLocaleString('en-IN')} were already there and were left alone.` : '.')));
        loadReset(); loadSched();
      } else {
        setPreview(d); setRestoreMsg(null);
      }
    } catch (e) { setRestoreMsg(bad('Restore failed', e.message)); }
    setRestoreBusy('');
  }

  // A reset always starts from a fresh backup: store one, download it, and only then
  // empty the company. If either step fails the reset does not run.
  async function runReset() {
    setResetBusy(true); setResetMsg(null);
    try {
      // Refuse a wrong key or confirmation straight away, before minutes of backup.
      setResetStage('check');
      const chk = await fetch(SALES_ENDPOINTS.backupReset(companyId), {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ reset_key: resetKey, confirm: resetConfirm, check_only: true }) });
      if (!chk.ok) {
        const cd = await chk.json().catch(() => ({}));
        setResetMsg(bad('Reset refused', cd.detail || `The server returned ${chk.status}. Nothing was changed.`));
        setResetBusy(false); setResetStage(''); return;
      }
      setResetStage('backup');
      const b = await fetch(SALES_ENDPOINTS.backupSchedule(companyId), {
        method: 'POST', headers: authHeaders() });
      const bd = await b.json().catch(() => ({}));
      const latest = (bd.history || [])[0];
      if (!b.ok || !latest?.id) {
        setResetMsg(bad('Reset stopped — the backup failed', bd.detail || 'Nothing was deleted.'));
        setResetBusy(false); setResetStage(''); return;
      }
      setSched(bd);
      setResetStage('download');
      if (!(await downloadStored(latest.id))) {
        setResetMsg(bad('Reset stopped — the backup could not be downloaded',
          'The backup is stored in the list above. Nothing was deleted.'));
        setResetBusy(false); setResetStage(''); return;
      }
      setResetStage('reset');
      let res = null, d = {};
      try {
        res = await fetch(SALES_ENDPOINTS.backupReset(companyId), {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({ reset_key: resetKey, confirm: resetConfirm }) });
        d = await res.json().catch(() => ({}));
      } catch (e) { res = null; }
      // A big company takes longer to empty than the proxy keeps the connection open,
      // so the reply can be lost while the server carries on and finishes. Lost
      // connection or a gateway timeout means "ask the server", not "it failed".
      if (!res || res.status === 502 || res.status === 504) {
        setResetStage('confirm');
        const done = await waitForEmpty();
        if (done) {
          setResetMsg(good('Company emptied',
            'The reset took longer than the connection stayed open, but the server finished it.'));
          setResetKey(''); setResetConfirm(''); loadSched();
        } else {
          setResetMsg(bad('Could not confirm the reset',
            'The server may still be working. Refresh this page in a minute to see what is left.'));
        }
      } else if (!res.ok) setResetMsg(bad('Reset failed', d.detail || `The server returned ${res.status}.`));
      else {
        setResetMsg(good('Company emptied', d.detail));
        setResetKey(''); setResetConfirm(''); loadSched();
      }
      loadReset();
    } catch (e) { setResetMsg(bad('Reset failed', e.message)); }
    setResetBusy(false); setResetStage('');
  }

  // A restore is done once the company's record count has grown and then holds still.
  async function waitForRestore(before) {
    let last = before, still = 0;
    for (let i = 0; i < 120; i++) {              // up to 10 minutes
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const r = await fetch(SALES_ENDPOINTS.backupReset(companyId), { headers: authHeaders() });
        if (!r.ok) continue;
        const total = (await r.json()).total || 0;
        still = total === last ? still + 1 : 0;
        last = total;
        if (total > before && still >= 2) return total;
      } catch (e) { /* keep asking */ }
    }
    return last;
  }

  // Emptied means nothing is left but the account(s) the reset keeps.
  async function waitForEmpty() {
    for (let i = 0; i < 120; i++) {              // up to 10 minutes
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const r = await fetch(SALES_ENDPOINTS.backupReset(companyId), { headers: authHeaders() });
        if (!r.ok) continue;
        const info = await r.json();
        if (Object.keys(info.counts || {}).every((k) => k === 'Users')) return true;
      } catch (e) { /* keep asking */ }
    }
    return false;
  }

  if (!mayBackUp) return <div className="dbx-denied">Admin access only.</div>;

  // The reset takes its own backup first, so only the key is needed up front.
  const canReset = !!resetInfo?.key_configured;
  const STAGE = {
    check:    ['Checking the reset key…', 'Nothing is changed until the key and confirmation are accepted.'],
    backup:   ['Taking a backup…', 'Storing a full backup before anything is deleted.'],
    download: ['Downloading the backup…', 'The workbook is going to your downloads.'],
    reset:    ['Emptying the company…', 'Deleting every module in dependency order. Do not close this tab.'],
    confirm:  ['Still emptying the company…', 'A large company takes a few minutes. Checking with the server until it is done.'],
  };

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
            {excelBusy ? <><span className="dbx-spin" />Building…</> : 'Download Excel'}
          </button>
        </div>
        {excelBusy
          ? <Working label="Building the workbook…"
                     note="Every module for this company, in one file. A large company takes a minute or two — leave this tab open." />
          : <Result value={excelMsg} />}
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
            {schedBusy === 'take' ? <><span className="dbx-spin" />Taking…</> : 'Take one now'}
          </button>
        </div>

        {schedBusy === 'take'
          ? <Working label="Taking a backup…"
                     note="Reading every module and writing the workbook, then storing it. This takes a minute or two on a large company — leave this tab open." />
          : <Result value={schedMsg} />}

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
          overwrites what is live. Notifications are the one thing not carried: a reset clears
          the bell and it stays clear, rather than re-delivering alerts for things that already
          happened.
        </div>

        {/* .gz is accepted too: stored backups taken before the content-type fix
            were labelled gzip by the bucket and land on disk named ".gz". The
            bytes are the same workbook, so they restore as they are. */}
        <label className="dbx-file">
          <input type="file" accept=".xlsx,.gz" ref={fileRef}
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
            disabled={!ready || !restoreFile || !!restoreBusy}>
            {restoreBusy === 'check' ? <><span className="dbx-spin" />Checking…</> : 'Check file'}
          </button>
          <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => sendRestore(true)}
            disabled={!preview || !!restoreBusy}>
            {restoreBusy === 'commit' ? <><span className="dbx-spin" />Restoring…</> : 'Restore'}
          </button>
        </div>

        {restoreBusy
          ? <Working
              label={restoreBusy === 'commit' ? 'Restoring…' : 'Checking the file…'}
              note={restoreBusy === 'commit'
                ? 'Writing every module back in dependency order. Do not close this tab — a half-finished restore is rolled back, but you would have to start again.'
                : 'Reading the workbook and working out what is missing. Nothing is written yet.'} />
          : <Result value={restoreMsg} />}
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
              : 'No recent backup — one is taken and downloaded automatically when you reset'}</span>
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
          {resetBusy ? <><span className="dbx-spin" />{resetStage === 'check' ? 'Checking…' : resetStage === 'backup' || resetStage === 'download' ? 'Backing up…' : 'Deleting…'}</> : 'Back up & reset this company'}
        </button>

        {resetBusy
          ? <Working label={(STAGE[resetStage] || STAGE.reset)[0]}
                     note={(STAGE[resetStage] || STAGE.reset)[1]} />
          : <Result value={resetMsg} />}
      </section>
    </div>
  );
}
