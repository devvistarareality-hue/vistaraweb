'use client';
// Import investors from Excel, in three steps: download the template, upload the
// filled file to have every row checked (errors by Excel row number), then import
// the rows that passed. Each becomes a pending investor in Approvals — exactly as
// if it had been added by hand.
import { useState } from 'react';
import { Download, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import { rupee, inrShort } from '../../lib/inr';
import { notify } from '../../lib/notify';
import { errText } from '../../lib/apiError';
import { C1Modal, C1Section, C1Error } from './_Form';

const SPIN = <span className="nx-spin" aria-hidden="true" />;

export default function ImportInvestorsModal({ onClose, onDone }) {
  const [file, setFile] = useState(null);       // { name, data(base64) }
  const [check, setCheck] = useState(null);     // the server's row-by-row report
  const [busy, setBusy] = useState('');         // 'template' | 'check' | 'import'
  const [err, setErr] = useState('');
  const [onlyBad, setOnlyBad] = useState(false);

  async function template() {
    setBusy('template'); setErr('');
    try {
      const r = await apiFetch(CLUB1000_ENDPOINTS.investorImportTemplate);
      if (!r.ok) { setErr(errText(await r.json().catch(() => ({})), 'Could not download the template.')); return; }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url; a.download = 'club1000-investor-import-template.xlsx'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally { setBusy(''); }
  }

  function pick(e) {
    const f = e.target.files?.[0];
    setCheck(null); setErr('');
    if (!f) { setFile(null); return; }
    const reader = new FileReader();
    reader.onload = () => setFile({ name: f.name, data: String(reader.result).split(',')[1] });
    reader.readAsDataURL(f);
  }

  async function send(commit) {
    setBusy(commit ? 'import' : 'check'); setErr('');
    const r = await apiFetch(CLUB1000_ENDPOINTS.investorImport, { method: 'POST', body: JSON.stringify({ file, commit }) }).catch(() => null);
    setBusy('');
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setErr(errText(d, 'Could not read the file.')); return; }
    if (commit) {
      notify(`${d.created} investor${d.created === 1 ? '' : 's'} imported — waiting in Approvals`, 'success');
      onDone();
      return;
    }
    setCheck(d);
  }

  const rows = check ? check.rows.filter((r) => !onlyBad || !r.ok) : [];
  return (
    <C1Modal wide title="Import investors from Excel" sub="Each imported investor waits in Approvals, like one added by hand"
      onClose={onClose}
      footer={<>
        <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Cancel</button>
        {check && check.ok > 0 ? (
          <button type="button" className="nx-btn nx-btn-md nx-btn-success" disabled={!!busy} onClick={() => send(true)}>
            {busy === 'import' ? <>{SPIN} Importing…</> : `Import ${check.ok} investor${check.ok === 1 ? '' : 's'} · ${inrShort(check.amount)}`}
          </button>
        ) : (
          <button type="button" className="nx-btn nx-btn-md nx-btn-primary" disabled={!file || !!busy} onClick={() => send(false)}>
            {busy === 'check' ? <>{SPIN} Checking…</> : 'Check file'}
          </button>
        )}
      </>}>
      <C1Section title="1 · Get the template">
        <div className="c1im-step">
          <p>One row per investment. Scheme, interest payout and source are dropdowns; the Help sheet explains every column. Rows 2–3 are examples — replace them.</p>
          <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" disabled={busy === 'template'} onClick={template}>
            {busy === 'template' ? <>{SPIN} Preparing…</> : <><Download size={15} /> Download template</>}
          </button>
        </div>
      </C1Section>

      <C1Section title="2 · Upload the filled file">
        <div className="c1im-step">
          <input type="file" className="c1-file" accept=".xlsx,.xls,.csv" onChange={pick} />
          {file && !check && <p className="c1-help">Selected: {file.name} — press <b>Check file</b>. Nothing is saved yet.</p>}
          {check && (
            <button type="button" className="nx-btn nx-btn-sm nx-btn-ghost" disabled={!!busy} onClick={() => send(false)}>
              {busy === 'check' ? <>{SPIN} Checking…</> : 'Check again'}
            </button>
          )}
        </div>
      </C1Section>

      {check && (
        <C1Section title="3 · Review">
          <div className="c1im-sum">
            <span className="ok"><CheckCircle2 size={16} /> <b>{check.ok}</b> ready · {rupee(check.amount)}</span>
            {check.failed > 0 && <span className="bad"><AlertTriangle size={16} /> <b>{check.failed}</b> with problems — left out</span>}
            {check.failed > 0 && (
              <label className="c1s-opt"><input type="checkbox" checked={onlyBad} onChange={(e) => setOnlyBad(e.target.checked)} /> Show only problems</label>
            )}
          </div>
          <div className="c1im-table">
            <div className="c1im-head"><span>Row</span><span>Investor</span><span>Scheme · payout</span><span className="num">Amount</span><span>Invested → matures</span><span>Check</span></div>
            {rows.map((r) => (
              <div key={r.row} className={`c1im-row${r.ok ? '' : ' bad'}`}>
                <span className="c1im-no">{r.row}</span>
                <span><b>{r.preview.name || '—'}</b><small>{r.preview.phone}</small></span>
                <span>{r.preview.scheme || '—'}<small>{r.preview.interest_payout}{r.preview.return_pct ? ` · ${Number(r.preview.return_pct)}%` : ''}</small></span>
                <span className="num">{r.preview.amount ? rupee(r.preview.amount) : '—'}</span>
                <span>{r.preview.investment_date ? formatDMY(r.preview.investment_date) : '—'}<small>{r.preview.maturity_date ? `→ ${formatDMY(r.preview.maturity_date)}` : ''}</small></span>
                <span className="c1im-check">
                  {r.ok ? <em className="ok">Ready</em> : r.errors.map((e) => <em key={e} className="bad">{e}</em>)}
                  {r.warnings.map((w) => <em key={w} className="warn">{w}</em>)}
                </span>
              </div>
            ))}
          </div>
          {check.failed > 0 && <p className="c1-help">Fix the rows with problems in Excel and upload again, or import the ready ones now and add the rest later.</p>}
        </C1Section>
      )}
      <C1Error>{err}</C1Error>
    </C1Modal>
  );
}
