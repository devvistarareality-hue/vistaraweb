'use client';
import { useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { COMPANY_ENDPOINTS, SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import { fetchCompanies } from '../../../redux/actions/companiesActions';

// Bring a deleted company back from its backup workbook. A restore only goes into
// the company a file came from, matched by id, so once a company is deleted its
// backups have nowhere to go — this recreates it under its original id and details
// first, then restores into it. Platform admins only; the server checks that too.
export default function ReviveCompany() {
  const dispatch = useDispatch();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');     // '' | 'check' | 'commit' | 'confirm'
  const [msg, setMsg] = useState(null);     // { tone: 'ok' | 'bad', title, detail }

  function pick(f) { setFile(f); setPreview(null); setMsg(null); setCode(''); }

  async function send(commit) {
    setBusy(commit ? 'commit' : 'check'); setMsg(null);
    const fd = new FormData();
    fd.append('file', file);
    if (code.trim()) fd.append('code', code.trim());
    if (commit) fd.append('commit', '1');
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    let res = null, d = {};
    try {
      // No Content-Type on purpose — the browser sets the multipart boundary.
      res = await fetch(SALES_ENDPOINTS.backupRevive, {
        method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } });
      d = await res.json().catch(() => ({}));
    } catch (e) { res = null; }

    if (commit && (!res || res.status === 502 || res.status === 504)) {
      // A big company outlasts the proxy's connection; the server still finishes.
      setBusy('confirm');
      const done = await waitForCompany(preview?.company?.id);
      setMsg(done
        ? { tone: 'ok', title: 'Company brought back',
            detail: `${preview.company.name} is back. It took longer than the connection stayed open, but the server finished it.` }
        : { tone: 'bad', title: 'Could not confirm',
            detail: 'The server may still be working. Check Company Management in a minute.' });
      if (done) finish();
    } else if (!res) {
      setMsg({ tone: 'bad', title: 'Could not reach the server', detail: 'The connection dropped. Try again.' });
    } else if (!res.ok) {
      setPreview(null);
      setMsg({ tone: 'bad', title: commit ? 'Not brought back' : 'That file cannot be used', detail: d.detail || `The server returned ${res.status}.` });
    } else if (commit) {
      setMsg({ tone: 'ok', title: 'Company brought back',
        detail: `${d.company?.name || 'The company'} (${d.company?.code}) is back with `
          + `${(d.total || 0).toLocaleString('en-IN')} records, under its original id.` });
      finish();
    } else {
      setPreview(d);
      if (d.company?.code) setCode(d.company.code);
    }
    setBusy('');
  }

  function finish() {
    setPreview(null); setFile(null); setCode('');
    if (fileRef.current) fileRef.current.value = '';
    dispatch(fetchCompanies(true));
  }

  // Back when it is in the company list and its record count has stopped growing.
  async function waitForCompany(id) {
    let last = -1, still = 0;
    for (let i = 0; i < 120; i++) {              // up to 10 minutes
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const l = await fetch(COMPANY_ENDPOINTS.list, { headers: authHeaders() });
        if (!l.ok || !(await l.json()).some((c) => c.id === id)) continue;
        const r = await fetch(SALES_ENDPOINTS.backupReset(id), { headers: authHeaders() });
        if (!r.ok) continue;
        const total = (await r.json()).total || 0;
        still = total === last ? still + 1 : 0;
        last = total;
        if (total > 0 && still >= 2) return true;
      } catch (e) { /* keep asking */ }
    }
    return false;
  }

  const needsCode = !!preview?.needs_code;
  const canBringBack = !!preview && (!needsCode || code.trim().length > 0) && !busy;

  return (
    <section className="nx-card dbx-card">
      <div className="dbx-head">Deleted company</div>
      <div className="dbx-title">Bring back a deleted company</div>
      <div className="dbx-sub">
        A deleted company can’t be restored with “Put a backup back”, because there is no
        company left to put it into. Choose that company’s backup here: it is recreated under
        its original id and details, then everything in the workbook goes back into it —
        users with their passwords, leads, bookings, AR, Club 1000 and tasks.
      </div>

      <label className="dbx-file">
        <input type="file" accept=".xlsx,.gz" ref={fileRef}
          onChange={(e) => pick(e.target.files?.[0] || null)} />
        <span className="dbx-file-name">{file ? file.name : 'Choose the deleted company’s backup'}</span>
        <span className="dbx-file-btn">Browse</span>
      </label>

      {preview && (
        <div className="dbx-plan">
          <div className="dbx-plan-row"><span>Company</span><b>{preview.company?.name}</b></div>
          <div className="dbx-plan-row"><span>Original id</span><b>#{preview.company?.id}</b></div>
          {preview.plan.filter((p) => p.restore > 0).map((p) => (
            <div className="dbx-plan-row" key={p.table}>
              <span>{p.table}</span><b>{p.restore.toLocaleString('en-IN')}</b>
            </div>
          ))}
          <div className="dbx-plan-total">
            <span>Will be brought back</span><b>{preview.total.toLocaleString('en-IN')}</b>
          </div>
        </div>
      )}

      {needsCode && (
        <label className="nx-field stack">
          <span className="nx-field-label">
            Company code
            <span className="nx-hint">This backup is older and doesn’t record the code. Type the one it had.</span>
          </span>
          <input className="nx-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. MEGA" autoComplete="off" disabled={!!busy} />
        </label>
      )}

      <div className="dbx-actions">
        <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => send(false)}
          disabled={!file || !!busy}>
          {busy === 'check' ? <><span className="dbx-spin" />Checking…</> : 'Check file'}
        </button>
        <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => send(true)}
          disabled={!canBringBack}>
          {busy === 'commit' || busy === 'confirm' ? <><span className="dbx-spin" />Bringing back…</> : 'Bring it back'}
        </button>
      </div>

      {busy === 'commit' || busy === 'confirm'
        ? <div className="nx-note info"><span className="dbx-spin" />
            {busy === 'confirm'
              ? 'Still writing — a large company takes a few minutes. Checking with the server until it is done.'
              : 'Recreating the company and writing every module back. Do not close this tab.'}</div>
        : msg && <div className={`nx-note ${msg.tone}`}><span><b>{msg.title}</b> — {msg.detail}</span></div>}
    </section>
  );
}
