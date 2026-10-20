'use client';
// Every signed LOI of one investment, newest first — the original, each revision,
// renewal and redemption — opened from the investor card's LOIs button.
import { useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import { notify } from '../../lib/notify';
import { errText } from '../../lib/apiError';
import { openPendingUrl } from '../../lib/openSignedUrl';
import Loader from '../../components/Loader';
import { C1Modal, C1Error } from './_Form';
import Icon from '../../components/Icon';

// Icon and kind wording per LOI.
const KIND = {
  new: ['file', 'Original'], revision: ['pencil', 'Revision'], renewal: ['refresh', 'Renewal'],
  redemption: ['exit', 'Redemption'], current: ['file', 'LOI'],
};

export default function LoisModal({ investor, onClose }) {
  const [lois, setLois] = useState(null);
  const [err, setErr] = useState('');

  const [busy, setBusy] = useState(null);     // the LOI whose copy is uploading
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    apiFetch(CLUB1000_ENDPOINTS.investorLois(investor.id))
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) setLois(d.lois || []); else setErr(errText(d, 'Could not load the LOIs.'));
      })
      .catch(() => alive && setErr('Could not reach the server.'));
    return () => { alive = false; };
  }, [investor.id, reload]);

  // Put back a copy of an LOI whose file was deleted (before LOIs were kept).
  function upload(l, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(l.i);
      const r = await apiFetch(CLUB1000_ENDPOINTS.investorLois(investor.id), {
        method: 'POST', body: JSON.stringify({ i: l.i, file: { name: file.name, type: file.type, data: String(reader.result).split(',')[1] } }),
      }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      setBusy(null);
      if (r?.ok) { notify(`${l.label} uploaded`, 'success'); setReload((n) => n + 1); }
      else notify(errText(d, 'Could not upload the LOI.'), 'error');
    };
    reader.readAsDataURL(file);
  }

  async function open(l) {
    // Opened before the fetch: a pop-up created after an await is blocked.
    const tab = openPendingUrl();
    const r = await apiFetch(`${CLUB1000_ENDPOINTS.investorLoiUrl(investor.id)}?loi=${l.i}`).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok && d.url) tab.show(d.url);
    else { tab.cancel(); notify(errText(d, 'Could not open the LOI.'), 'error'); }
  }

  return (
    <C1Modal title="LOIs" sub={`${investor.name}${investor.loi_no ? ` · ${investor.loi_no}` : ''} · newest first`} onClose={onClose}
      footer={<button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Close</button>}>
      <C1Error>{err}</C1Error>
      {!lois && !err ? <Loader label="Loading…" /> : lois && lois.length === 0 ? (
        <div className="c1-help">No signed LOI is on record for this investment.</div>
      ) : lois && (
        <>
        {lois.some((l) => l.missing) && (
          <div className="nx-note warn c1x-loi-note">An LOI marked <b>File missing</b> was deleted by an approval made before Nexora kept every LOI. If you have the signed copy, upload it to put it back.</div>
        )}
        <div className="c1x-lois">
          {lois.map((l) => (
            <div key={l.i} className={`c1x-loi k-${KIND[l.kind] ? l.kind : 'current'}${l.current ? ' is-cur' : ''}`}>
              <span className="c1x-loi-ico"><Icon name={(KIND[l.kind] || KIND.current)[0]} /></span>
              <div className="c1x-loi-main">
                <div className="c1x-loi-top">
                  <b>{l.label}</b>
                  {l.current && <em>Current</em>}
                  {l.missing && <em className="miss">File missing</em>}
                </div>
                <small>
                  {(KIND[l.kind] || KIND.current)[1]} · {l.at ? formatDMY(String(l.at).slice(0, 10)) : '—'}
                  {l.by ? ` · approved by ${l.by}` : ''}
                </small>
              </div>
              {l.missing ? (
                <label className={`nx-btn nx-btn-sm nx-btn-secondary c1x-loi-up${busy === l.i ? ' is-busy' : ''}`}>
                  {busy === l.i ? <><span className="nx-spin" aria-hidden="true" /> Uploading…</> : <><Icon name="upload" /> Upload copy</>}
                  <input type="file" accept="image/*,.pdf" hidden disabled={busy !== null} onChange={(e) => upload(l, e.target.files?.[0])} />
                </label>
              ) : (
                <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => open(l)}><Icon name="file" /> Open</button>
              )}
            </div>
          ))}
        </div>
        </>
      )}
    </C1Modal>
  );
}
