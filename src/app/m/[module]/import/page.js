'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AR_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import { confirmDialog, notify } from '../../../../lib/notify';
import { formatDMY } from '../../../../lib/dateFormat';
import Loader from '../../../../components/Loader';
import { rupee, MODES } from '../_ar';

const MODE_LABEL = Object.fromEntries(MODES.map((m) => [m.value, m.label]));

// One-off import of past receipts from the old AR workbooks. Only the actual
// payments are read (the plan comes from the LOI); a preview always comes first,
// and importing the same file twice adds nothing.
export default function ARImportPage({ params }) {
  if (params.module !== 'ar') notFound();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [accounts, setAccounts] = useState(null);
  const [project, setProject] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiFetch(AR_ENDPOINTS.accounts + (companyId ? `?company_id=${companyId}` : ''))
      .then(async (r) => { const d = await r.json().catch(() => ({})); setAccounts(r.ok ? d.results || [] : []); if (!r.ok) setErr(d.detail || ''); })
      .catch(() => setAccounts([]));
  }, [companyId]);

  // Only projects with approved bookings can receive receipts.
  const projects = useMemo(() => {
    const m = new Map();
    (accounts || []).forEach((a) => { if (a.project_id) m.set(a.project_id, a.project); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [accounts]);

  async function send(commit) {
    setBusy(true); setErr('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('project_id', project);
    if (commit) fd.append('commit', '1');
    if (companyId) fd.append('company_id', companyId);
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
    const ok = await confirmDialog(
      `Import ${result.ready} receipts totalling ${rupee(result.total_amount)}? Skipped rows are not imported.`,
      { title: 'Import receipts?', confirmText: 'Import' },
    );
    if (ok) send(true);
  }

  const reset = () => { setResult(null); setFile(null); setErr(''); };

  return (
    <div className="nx-page nx-page-center nx-w-lg">
      <div className="ar-head">
        <div>
          <h1 className="nx-page-title">Import receipts</h1>
          <p className="nx-page-sub">Bring past payments in from an old AR workbook — one project per file.</p>
        </div>
      </div>

      {accounts === null ? <Loader label="Loading projects…" /> : (
        <>
          <div className="nx-card ar-card">
            <div className="ar-card-body">
              <div className="nx-note info">
                Reads the <b>&nbsp;Payment Tracker&nbsp;</b> sheet (or a sheet with Plot No, Paid Date and Paid/Amount columns).
                Only rows with a Paid amount are payments — carry-in rows are ignored. Mode must be Bank, NBFC, Cash or Cheque.
              </div>
              <div className="ar-filters">
                <select className="nx-input nx-input-sm nx-filter-sel" value={project} onChange={(e) => { setProject(e.target.value); setResult(null); }} disabled={busy}>
                  <option value="">Choose project…</option>
                  {projects.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
                </select>
                <div className="ar-file">
                  <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }} disabled={busy} />
                </div>
                <button className="nx-btn nx-btn-md nx-btn-primary" disabled={!project || !file || busy} onClick={() => send(false)}>
                  {busy && !result ? 'Reading…' : 'Preview'}
                </button>
              </div>
              {projects.length === 0 && <div className="nx-note warn">No project has an approved booking yet, so there is nothing to import into.</div>}
              {err && <div className="nx-note bad">{err}</div>}
            </div>
          </div>

          {result && (
            <>
              <div className="ar-stats">
                <div className="nx-card ar-stat good"><div className="ar-stat-label">{result.committed ? 'Imported' : 'Ready to import'}</div><div className="ar-stat-value">{result.ready}</div></div>
                <div className="nx-card ar-stat"><div className="ar-stat-label">Amount</div><div className="ar-stat-value">{rupee(result.total_amount)}</div></div>
                <div className="nx-card ar-stat warn"><div className="ar-stat-label">Skipped</div><div className="ar-stat-value">{result.skipped}</div></div>
              </div>

              {result.committed ? (
                <div className="nx-note ok">
                  Done — {result.ready} receipts are now on their accounts.
                  <Link href="/m/ar/register" className="nx-btn nx-btn-sm nx-btn-soft">Open register</Link>
                </div>
              ) : result.ready > 0 && (
                <div className="nx-note info">
                  Nothing has been saved yet. Check the rows below, then import.
                  <button className="nx-btn nx-btn-sm nx-btn-primary" onClick={commit} disabled={busy}>{busy ? 'Importing…' : `Import ${result.ready} receipts`}</button>
                </div>
              )}

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
                  <div className="ar-card-head"><div><div className="ar-card-title">Skipped</div><div className="ar-card-sub">These rows were not imported</div></div></div>
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

              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={reset}>Import another file</button>
            </>
          )}
        </>
      )}
    </div>
  );
}
