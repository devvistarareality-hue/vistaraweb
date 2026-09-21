'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2, Download, ClipboardPaste, Plus, Search, X, Upload, Table2 } from 'lucide-react';
import { AR_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import { confirmDialog, notify } from '../../../../lib/notify';
import { formatDMY } from '../../../../lib/dateFormat';
import Loader from '../../../../components/Loader';
import Dropdown from '../../../../components/Dropdown';
import { rupee, inrShort, MODES, today } from '../_ar';

const MODE_LABEL = Object.fromEntries(MODES.map((m) => [m.value, m.label]));
const MODE_ALIAS = { bank: 'bank', nbfc: 'nbfc', cash: 'cash', cheque: 'cheque', chq: 'cheque', check: 'cheque' };
let seq = 0;
const blank = () => ({ key: `l${++seq}`, paid_on: '', amount: '', mode: 'bank', remarks: '' });
const normPlot = (v) => String(v ?? '').trim().toUpperCase().replace(/\.0$/, '');
const plotKeys = (plots) => String(plots || '').split(',').map(normPlot).filter(Boolean).flatMap((p) => [p, p.split('-').pop()]);
const plotSort = (a, b) => {
  const m = (s) => { const x = String(s).match(/^([A-Za-z-]*)(\d+)/); return x ? [x[1].toUpperCase(), Number(x[2])] : [String(s), 0]; };
  const [pa, na] = m(a.plots); const [pb, nb] = m(b.plots);
  return pa.localeCompare(pb) || na - nb;
};
function parseDate(v) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

// Receipts for many plots at once. Pick a project and every approved plot gets a
// row to type payments into (or paste them from Excel); nothing is saved until a
// server-side preview passes. The old workbook upload lives on the second tab.
export default function ARImportPage({ params, searchParams }) {
  if (params.module !== 'ar') notFound();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [accounts, setAccounts] = useState(null);
  const [project, setProject] = useState(searchParams?.project || '');
  const [tab, setTab] = useState('grid');
  const [err, setErr] = useState('');

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

  async function downloadTemplate() {
    try {
      const r = await apiFetch(`${AR_ENDPOINTS.importTemplate}?project_id=${project}${companyId ? `&company_id=${companyId}` : ''}`);
      if (!r.ok) { notify('Could not prepare the template', 'error'); return; }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `AR receipts - ${projects.find(([id]) => id === project)?.[1].name || 'project'}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch { notify('Could not prepare the template', 'error'); }
  }

  return (
    <div className="nx-page">
      <div className="ar-head">
        <div>
          <h1 className="nx-page-title">Enter receipts</h1>
          <p className="nx-page-sub">Record payments plot-wise for a whole project — typed in, pasted from Excel, or uploaded.</p>
        </div>
      </div>

      {accounts === null ? <Loader label="Loading projects…" /> : (
        <>
          <div className="imp-bar">
            <Dropdown value={project} onChange={setProject} searchable placeholder="Choose project" ariaLabel="Project" icon={<Building2 size={15} />}
              options={projects.map(([id, p]) => ({ value: id, label: p.name, hint: `${p.n} plots` }))} />
            <div className="imp-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'grid'} className={tab === 'grid' ? 'is-on' : ''} onClick={() => setTab('grid')}><Table2 size={15} /> Enter plot-wise</button>
              <button role="tab" aria-selected={tab === 'file'} className={tab === 'file' ? 'is-on' : ''} onClick={() => setTab('file')}><Upload size={15} /> Upload Excel</button>
            </div>
            {project && <button className="nx-btn nx-btn-md nx-btn-secondary imp-tpl" onClick={downloadTemplate}><Download size={15} /> Excel template</button>}
          </div>
          {err && <div className="nx-note bad">{err}</div>}
          {projects.length === 0 && <div className="nx-note warn">No project has an approved booking yet, so there is nothing to enter receipts for.</div>}
          {!project ? (
            projects.length > 0 && <div className="nx-card ar-card"><div className="ar-empty">Choose a project to see its plots.</div></div>
          ) : tab === 'grid' ? (
            <Grid key={project} project={project} companyId={companyId}
              accounts={(accounts || []).filter((a) => String(a.project_id) === project && a.status !== 'frozen').sort(plotSort)} />
          ) : (
            <FileImport key={project} project={project} companyId={companyId} />
          )}
        </>
      )}
    </div>
  );
}

function Grid({ project, companyId, accounts }) {
  const [lines, setLines] = useState(() => Object.fromEntries(accounts.map((a) => [a.id, [blank()]])));
  const [q, setQ] = useState('');
  const [errors, setErrors] = useState({});        // line key → reason
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState(null);        // null | text
  const [pasteNote, setPasteNote] = useState('');
  const [done, setDone] = useState(null);          // { count, total }

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? accounts.filter((a) => String(a.plots).toLowerCase().includes(n) || a.client_name.toLowerCase().includes(n)) : accounts;
  }, [accounts, q]);

  const filled = useMemo(() => accounts.flatMap((a) => (lines[a.id] || [])
    .filter((l) => l.amount !== '' || l.paid_on !== '')
    .map((l) => ({ ...l, account: a }))), [accounts, lines]);
  const total = filled.reduce((t, l) => t + (Number(l.amount) || 0), 0);

  const setLine = (aid, key, k, v) => {
    setLines((m) => ({ ...m, [aid]: m[aid].map((l) => (l.key === key ? { ...l, [k]: v } : l)) }));
    setErrors((e) => { if (!e[key]) return e; const n = { ...e }; delete n[key]; return n; });
  };
  const addLine = (aid) => setLines((m) => ({ ...m, [aid]: [...m[aid], blank()] }));
  const removeLine = (aid, key) => setLines((m) => ({ ...m, [aid]: m[aid].length > 1 ? m[aid].filter((l) => l.key !== key) : [blank()] }));

  function applyPaste() {
    const byPlot = new Map();
    accounts.forEach((a) => plotKeys(a.plots).forEach((k) => { if (!byPlot.has(k)) byPlot.set(k, a); }));
    const next = { ...lines };
    let added = 0; const missed = [];
    String(paste || '').split(/\r?\n/).forEach((row) => {
      const c = row.split('\t');
      if (c.length < 3 || !c[0].trim()) return;
      const a = byPlot.get(normPlot(c[0]));
      const amount = String(c[2] || '').replace(/[₹,\s]/g, '');
      if (!a) { if (Number(amount) > 0) missed.push(c[0].trim()); return; }
      if (!(Number(amount) > 0)) return;
      const line = { ...blank(), paid_on: parseDate(c[1]), amount, mode: MODE_ALIAS[String(c[3] || '').trim().toLowerCase()] || 'bank', remarks: String(c[4] || '').trim() };
      const cur = next[a.id].filter((l) => l.amount !== '' || l.paid_on !== '');
      next[a.id] = [...cur, line];
      added += 1;
    });
    setLines(next); setPaste(null);
    setPasteNote(`${added} payment${added === 1 ? '' : 's'} added from the paste.${missed.length ? ` No approved plot in this project for: ${[...new Set(missed)].join(', ')}.` : ''}`);
  }

  async function send(commit) {
    const rows = filled.map((l) => ({ line: l.key, account_id: l.account.id, plot: l.account.plots, paid_on: l.paid_on, amount: l.amount, mode: l.mode, remarks: l.remarks }));
    const r = await apiFetch(AR_ENDPOINTS.importEntries + (companyId ? `?company_id=${companyId}` : ''), {
      method: 'POST', body: JSON.stringify({ project_id: project, rows, commit }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || 'Could not check the payments.');
    return d;
  }

  async function review() {
    setBusy(true); setErrors({}); setPasteNote('');
    try {
      const d = await send(false);
      if (d.skipped) {
        setErrors(Object.fromEntries(d.skipped_rows.map((x) => [x.line, x.reason])));
        notify(`${d.skipped} payment${d.skipped === 1 ? ' needs' : 's need'} fixing — see the rows in red`, 'error');
      } else {
        const ok = await confirmDialog(`Save ${d.ready} payment${d.ready === 1 ? '' : 's'} totalling ${rupee(d.total_amount)} across ${new Set(d.rows.map((x) => x.account_id)).size} plots?`,
          { title: 'Save receipts?', confirmText: 'Save' });
        if (ok) {
          const c = await send(true);
          if (c.committed) {
            setDone({ count: c.ready, total: c.total_amount });
            setLines(Object.fromEntries(accounts.map((a) => [a.id, [blank()]])));
            notify(`${c.ready} receipts saved`, 'success');
          } else if (c.skipped) {
            setErrors(Object.fromEntries(c.skipped_rows.map((x) => [x.line, x.reason])));
          }
        }
      }
    } catch (e) { notify(e.message || 'Could not save. Check your connection.', 'error'); }
    setBusy(false);
  }

  return (
    <>
      {done && (
        <div className="nx-note ok imp-note">
          Saved {done.count} receipt{done.count === 1 ? '' : 's'} totalling {rupee(done.total)}.
          <Link href="/m/ar/register" className="nx-btn nx-btn-sm nx-btn-soft">Open register</Link>
        </div>
      )}
      {pasteNote && <div className="nx-note info imp-note">{pasteNote}</div>}

      <div className="nx-card ar-card">
        <div className="imp-tools">
          <label className="imp-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find plot or client" /></label>
          <button className="nx-btn nx-btn-md nx-btn-soft" onClick={() => setPaste('')}><ClipboardPaste size={15} /> Paste from Excel</button>
        </div>
        <div className="ar-scroll imp-scroll">
          <table className="ar-table imp-table">
            <thead>
              <tr><th>Plot</th><th>Client</th><th className="num">Received so far</th><th>Paid on</th><th className="num">Amount (₹)</th><th>Mode</th><th>Remarks</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((a) => (lines[a.id] || []).map((l, i) => (
                <tr key={l.key} className={`${i === 0 ? 'imp-first' : 'imp-more'}${errors[l.key] ? ' imp-err' : ''}`}>
                  {i === 0 ? (
                    <>
                      <td className="imp-plot">{a.plots}</td>
                      <td className="imp-client"><div className="ar-client">{a.client_name || '—'}</div></td>
                      <td className="num muted" title={rupee(a.received)}>{a.received ? inrShort(a.received) : '—'}</td>
                    </>
                  ) : <td colSpan={3} className="imp-cont">↳ another payment</td>}
                  <td>
                    <input type="date" aria-label={`Paid on, plot ${a.plots}`} className="nx-input imp-in" max={today()} value={l.paid_on} onChange={(e) => setLine(a.id, l.key, 'paid_on', e.target.value)} />
                    {errors[l.key] && <div className="imp-reason">{errors[l.key]}</div>}
                  </td>
                  <td><input type="text" inputMode="decimal" aria-label={`Amount, plot ${a.plots}`} className="nx-input imp-in imp-amt" placeholder="0" value={l.amount}
                    onChange={(e) => setLine(a.id, l.key, 'amount', e.target.value.replace(/[^0-9.]/g, ''))} /></td>
                  <td>
                    <select aria-label={`Mode, plot ${a.plots}`} className="nx-input imp-in imp-mode" value={l.mode} onChange={(e) => setLine(a.id, l.key, 'mode', e.target.value)}>
                      {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </td>
                  <td><input aria-label={`Remarks, plot ${a.plots}`} className="nx-input imp-in imp-rem" placeholder="Optional" value={l.remarks} onChange={(e) => setLine(a.id, l.key, 'remarks', e.target.value)} /></td>
                  <td className="imp-act">
                    {i === (lines[a.id].length - 1) && <button className="nx-btn nx-btn-sm nx-btn-ghost" title="Add another payment for this plot" aria-label="Add another payment" onClick={() => addLine(a.id)}><Plus size={15} /></button>}
                    {(lines[a.id].length > 1 || l.amount || l.paid_on) && <button className="nx-btn nx-btn-sm nx-btn-ghost" title="Clear" aria-label="Remove payment" onClick={() => removeLine(a.id, l.key)}><X size={15} /></button>}
                  </td>
                </tr>
              )))}
              {shown.length === 0 && <tr><td colSpan={8} className="ar-empty">No plot or client matches “{q}”.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="imp-foot">
        <div className="imp-foot-sum">
          <b>{filled.length}</b> payment{filled.length === 1 ? '' : 's'} entered · <b title={rupee(total)}>{inrShort(total)}</b>
          {Object.keys(errors).length > 0 && <span className="imp-foot-err"> · {Object.keys(errors).length} to fix</span>}
        </div>
        <button className="nx-btn nx-btn-md nx-btn-primary" disabled={busy || filled.length === 0} onClick={review}>{busy ? 'Checking…' : 'Review & save'}</button>
      </div>

      {paste !== null && (
        <div className="ar-backdrop" onClick={() => setPaste(null)}>
          <div className="nx-card nx-modal ar-modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="ar-modal-title">Paste from Excel</div>
            <div className="ar-modal-sub">Copy the columns <b>Plot No · Paid Date · Amount · Mode · Remarks</b> (in that order) and paste them below. Dates as DD/MM/YYYY.</div>
            <textarea className="nx-input imp-paste" autoFocus value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'10\t25/11/2025\t2000000\tNBFC\tDS collected'} />
            <div className="ar-modal-foot">
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setPaste(null)}>Cancel</button>
              <button className="nx-btn nx-btn-md nx-btn-primary" disabled={!paste.trim()} onClick={applyPaste}>Add to grid</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FileImport({ project, companyId }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

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
    const ok = await confirmDialog(`Import ${result.ready} receipts totalling ${rupee(result.total_amount)}? Skipped rows are not imported.`,
      { title: 'Import receipts?', confirmText: 'Import' });
    if (ok) send(true);
  }

  return (
    <>
      <div className="nx-card ar-card">
        <div className="ar-card-body">
          <div className="nx-note info">
            Use the <b>&nbsp;Excel template&nbsp;</b> button above (one row per plot, ready to fill in), or an old AR workbook — its
            Payment Tracker sheet is read. Only rows with an amount are payments. Mode must be Bank, NBFC, Cash or Cheque.
          </div>
          <div className="ar-filters">
            <label className="imp-file">
              <Upload size={16} />
              <span>{file ? file.name : 'Choose .xlsx file'}</span>
              <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }} disabled={busy} />
            </label>
            <button className="nx-btn nx-btn-md nx-btn-primary" disabled={!file || busy} onClick={() => send(false)}>{busy && !result ? 'Reading…' : 'Preview'}</button>
          </div>
          {err && <div className="nx-note bad">{err}</div>}
        </div>
      </div>

      {result && (
        <>
          <div className="ar-stats">
            <div className="nx-card ar-stat good"><div className="ar-stat-label">{result.committed ? 'Imported' : 'Ready to import'}</div><div className="ar-stat-value">{result.ready}</div></div>
            <div className="nx-card ar-stat"><div className="ar-stat-label">Amount</div><div className="ar-stat-value" title={rupee(result.total_amount)}>{inrShort(result.total_amount)}</div></div>
            <div className="nx-card ar-stat warn"><div className="ar-stat-label">Skipped</div><div className="ar-stat-value">{result.skipped}</div></div>
          </div>
          {result.committed ? (
            <div className="nx-note ok">Done — {result.ready} receipts are now on their accounts. <Link href="/m/ar/register" className="nx-btn nx-btn-sm nx-btn-soft">Open register</Link></div>
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
        </>
      )}
    </>
  );
}
