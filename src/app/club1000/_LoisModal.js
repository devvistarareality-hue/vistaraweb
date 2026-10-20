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

export default function LoisModal({ investor, onClose }) {
  const [lois, setLois] = useState(null);
  const [err, setErr] = useState('');

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
  }, [investor.id]);

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
        <div className="nx-card c1l-lois">
          {lois.map((l) => (
            <div key={l.i} className="c1l-loi">
              <div>
                <b>{l.label}</b>{l.current && <em className="c1l-loi-cur">current</em>}
                <small>{l.at ? formatDMY(String(l.at).slice(0, 10)) : '—'}{l.by ? ` · approved by ${l.by}` : ''}</small>
              </div>
              <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => open(l)}>Open</button>
            </div>
          ))}
        </div>
      )}
    </C1Modal>
  );
}
