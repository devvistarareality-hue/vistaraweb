'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2, Download, Upload, FileSpreadsheet, X } from 'lucide-react';
import { AR_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import { confirmDialog, notify } from '../../../../lib/notify';
import { formatDMY } from '../../../../lib/dateFormat';
import Loader from '../../../../components/Loader';
import Dropdown from '../../../../components/Dropdown';
import { rupee, inrShort, MODES } from '../_ar';

const MODE_LABEL = Object.fromEntries(MODES.map((m) => [m.value, m.label]));

// Import receipts in bulk: download the project's template (one row per approved
// plot), fill it in, upload it. A preview always comes first, and importing the
// same file twice adds nothing. Single payments are recorded from the ledger.
export default function ARImportPage({ params, searchParams }) {
  if (params.module !== 'ar') notFound();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [accounts, setAccounts] = useState(null);
  const [project, setProject] = useState(searchParams?.project || '');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    apiFetch(AR_ENDPOINTS.accounts + (companyId ? `?company_id=${companyId}` : ''))
      .then(async (r) => { const d = await r.json().catch(() => ({})); setAccounts(r.ok ? d.results || [] : []); if (!r.ok) setErr(d.detail || ''); })
      .catch(() => { setAccounts([]); setErr('Could not load projects. Check your connection.'); });
  }, [companyId]);

  const projects = useMemo(() => {
    const m = new Map();
    (accounts || []).forEach((a) => { if (a.project_id) m.set(String(a.project_id), { name: a.project, n: (m.get(String(a.project_id))?.n || 0) + 1 }); });
    return [...m.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [accounts]);
  const projectName = projects.find(([id]) => id === project)?.[1].name || '';

  const reset = () => { setResult(null); setFile(null); setErr(''); if (fileRef.current) fileRef.current.value = ''; };
  const chooseProject = (v) => { setProject(v); reset(); };

  async function downloadTemplate() {
    try {
      const r = await apiFetch(`${AR_ENDPOINTS.importTemplate}?project_id=${project}${companyId ? `&company_id=${companyId}` : ''}`);
      if (!r.ok) { notify('Could not prepare the template', 'error'); return; }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `AR receipts - ${projectName || 'project'}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch { notify('Could not prepare the template', 'error'); }
  }

  async function send(commit) {
    setBusy(true); setErr('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('project_id', project);
    if (commit) fd.append('commit', '1');
    try {
      // multipart: let the browser set the boundary, so no JSON content-type here
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
      const r = await fetch(AR_ENDPOINTS.import + (companyId ? `?company_id=${companyId}` : ''), {
        method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.detail || 'The import failed.'); setBusy(false); return; }
      setResult(d);
      if (d.committed) notify(`${d.ready} receipts imported`, 'success');
    } catch { setErr('The import failed. Check your connection.'); }
    setBusy(false);
  }

  async function commit() {
    const ok = await confirmDialog(`Import ${result.ready} receipts totalling ${rupee(result.total_amount)} into ${projectName}? Skipped rows are not imported.`,
      { title: 'Import receipts?', confirmText: 'Import' });
    if (ok) send(true);
  }

  return (
    <div className="nx-page">
      <div className="ar-head">
        <div>
          <h1 className="nx-page-title">Import receipts</h1>
          <p className="nx-page-sub">Bring in many payments at once from the Excel template. To record a single payment, open the account in the Register and use Record payment.</p>
        </div>
      </div>

      {accounts === null ? <Loader label="Loading projects…" /> : (
        <>
          {err && <div className="nx-note bad">{err}</div>}
          {projects.length === 0 ? (
            <div className="nx-note warn">No project has an approved booking yet, so there is nothing to import into.</div>
          ) : (
            <div className="imp-steps">
              <div className="nx-card imp-step">
                <div className="imp-step-n">1</div>
                <div className="imp-step-body">
                  <div className="imp-step-title">Choose the project</div>
                  <div className="imp-step-sub">One project per file.</div>
                  <Dropdown value={project} onChange={chooseProject} searchable placeholder="Choose project" ariaLabel="Project" icon={<Building2 size={15} />}
                    options={projects.map(([id, p]) => ({ value: id, label: p.name, hint: `${p.n} plots` }))} />
                </div>
              </div>

              <div className={`nx-card imp-step${project ? '' : ' is-off'}`}>
                <div className="imp-step-n">2</div>
                <div className="imp-step-body">
                  <div className="imp-step-title">Download the template</div>
                  <div className="imp-step-sub">One row per approved plot. Fill in Paid Date, Paid and Mode; add a row with the same plot for a second payment.</div>
                  <button className="nx-btn nx-btn-md nx-btn-secondary imp-btn" disabled={!project} onClick={downloadTemplate}><Download size={15} /> Download template</button>
                </div>
              </div>

              <div className={`nx-card imp-step${project ? '' : ' is-off'}`}>
                <div className="imp-step-n">3</div>
                <div className="imp-step-body">
                  <div className="imp-step-title">Upload the filled template</div>
                  <div className="imp-step-sub">You’ll see a preview first — nothing is saved until you confirm.</div>
                  <div className="imp-upload">
                    <label className={`imp-file${file ? ' has-file' : ''}${project ? '' : ' is-off'}`}>
                      {file ? <FileSpreadsheet size={16} /> : <Upload size={16} />}
                      <span>{file ? file.name : 'Choose .xlsx file'}</span>
                      <input ref={fileRef} type="file" accept=".xlsx" disabled={!project || busy} onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }} />
                    </label>
                    {file && <button className="nx-btn nx-btn-sm nx-btn-ghost" aria-label="Remove file" onClick={reset} disabled={busy}><X size={15} /></button>}
                    <button className="nx-btn nx-btn-md nx-btn-primary" disabled={!project || !file || busy} onClick={() => send(false)}>{busy && !result ? 'Reading…' : 'Preview'}</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {result && (
            <>
              <div className="ar-stats">
                <div className="nx-card ar-stat good"><div className="ar-stat-label">{result.committed ? 'Imported' : 'Ready to import'}</div><div className="ar-stat-value">{result.ready}</div></div>
                <div className="nx-card ar-stat"><div className="ar-stat-label">Amount</div><div className="ar-stat-value" title={rupee(result.total_amount)}>{inrShort(result.total_amount)}</div></div>
                <div className="nx-card ar-stat warn"><div className="ar-stat-label">Skipped</div><div className="ar-stat-value">{result.skipped}</div></div>
              </div>
              {result.committed ? (
                <div className="nx-note ok imp-note">Done — {result.ready} receipts are now on their accounts. <Link href={`/m/ar/register?project=${project}`} className="nx-btn nx-btn-sm nx-btn-soft">Open register</Link></div>
              ) : result.ready > 0 ? (
                <div className="nx-note info imp-note">
                  Nothing has been saved yet. Check the rows below, then import.
                  <button className="nx-btn nx-btn-sm nx-btn-primary" onClick={commit} disabled={busy}>{busy ? 'Importing…' : `Import ${result.ready} receipts`}</button>
                </div>
              ) : <div className="nx-note warn">No payment in this file can be imported — see the reasons below.</div>}
              {result.rows.length > 0 && (
                <div className="nx-card ar-card">
                  <div className="ar-card-head"><div className="ar-card-title">{result.committed ? 'Imported' : 'Will be imported'}</div></div>
                  <div className="ar-scroll">
                    <table className="ar-table">
                      <thead><tr><th>Row</th><th>Plot</th><th>Client</th><th>Paid on</th><th className="num">Amount</th><th>Mode</th><th>Remarks</th></tr></thead>
                      <tbody>
                        {result.rows.map((r) => (
                          <tr key={r.line}><td className="muted">{r.line}</td><td>{r.plot}</td><td>{r.client_name}</td><td>{formatDMY(r.paid_on)}</td>
                            <td className="num">{rupee(r.amount)}</td><td>{MODE_LABEL[r.mode]}</td><td className="wrap">{r.remarks || '—'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {result.skipped_rows.length > 0 && (
                <div className="nx-card ar-card">
                  <div className="ar-card-head"><div><div className="ar-card-title">Skipped</div><div className="ar-card-sub">Fix these rows in the file and upload it again — rows already imported are not added twice</div></div></div>
                  <div className="ar-scroll">
                    <table className="ar-table">
                      <thead><tr><th>Row</th><th>Plot</th><th>Paid on</th><th className="num">Amount</th><th>Reason</th></tr></thead>
                      <tbody>
                        {result.skipped_rows.map((r) => (
                          <tr key={r.line}><td className="muted">{r.line}</td><td>{r.plot}</td><td>{r.paid_on ? formatDMY(r.paid_on) : '—'}</td>
                            <td className="num">{rupee(r.amount)}</td><td className="wrap ar-pos-bad">{r.reason}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
