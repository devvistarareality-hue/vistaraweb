'use client';
// One investment's life from the start, newest first: added, approved, revisions and
// renewals, payouts paid and undone, referral rewards, redemption and closing.
import { useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import { rupee } from '../../lib/inr';
import { errText } from '../../lib/apiError';
import Icon from '../../components/Icon';
import Loader from '../../components/Loader';
import { C1Modal, C1Section, C1Error } from './_Form';

// Each kind of event: its icon and the tone of its dot.
const KIND = {
  added: ['user', 'accent'], approve: ['check', 'good'], reject: ['x', 'bad'],
  revise: ['pencil', 'accent'], 'revise-approve': ['check', 'good'], 'revise-reject': ['x', 'bad'],
  renew: ['refresh', 'warn'], 'renew-approve': ['refresh', 'good'], 'renew-reject': ['x', 'bad'],
  paid: ['check-circle', 'good'], undo: ['ban', 'bad'], reward: ['trophy', 'accent'], 'reward-paid': ['trophy', 'good'],
  redeem: ['download', 'warn'], closed: ['party', 'deep'],
};

const FILTERS = [['all', 'Everything'], ['terms', 'Terms'], ['money', 'Payments'], ['rewards', 'Rewards']];
const IN_FILTER = {
  terms: (k) => /^(added|approve|reject|revise|renew|redeem|closed)/.test(k),
  money: (k) => k === 'paid' || k === 'undo',
  rewards: (k) => k.startsWith('reward'),
};

export default function HistoryModal({ investor, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    apiFetch(CLUB1000_ENDPOINTS.investorHistory(investor.id))
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) setData(d); else setErr(errText(d, 'Could not load the history.'));
      })
      .catch(() => alive && setErr('Could not reach the server.'));
    return () => { alive = false; };
  }, [investor.id]);

  const events = (data?.events || []).filter((e) => filter === 'all' || IN_FILTER[filter](e.kind));
  return (
    <C1Modal wide title="History" badge={data?.renewal_count ? `Renewed ${data.renewal_count}×` : null}
      sub={`${investor.name} · ${investor.scheme_name || ''}${investor.loi_no ? ` · ${investor.loi_no}` : ''}`} onClose={onClose}
      footer={<button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Close</button>}>
      {!data && !err && <Loader size="sm" />}
      <C1Error>{err}</C1Error>
      {data && <>
        <div className="c1hx-stats">
          <div><span>Current term</span><b>{formatDMY(data.term.from)} → {formatDMY(data.term.to)}</b></div>
          <div><span>Renewals</span><b>{data.renewal_count}</b></div>
          <div><span>Revisions</span><b>{data.revision_count}</b></div>
          <div><span>Paid out so far</span><b>{rupee(data.paid_total)}</b></div>
        </div>
        <div className="nx-seg c1hx-filter">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" className={`nx-btn nx-btn-sm ${filter === k ? 'nx-btn-primary' : 'nx-btn-secondary'}`} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
        <C1Section title={`${events.length} event${events.length === 1 ? '' : 's'}`}>
          {events.length === 0 ? <div className="c1-help">Nothing here yet.</div> : (
            <div className="c1h-list">
              {events.map((e, i) => {
                const [icon, tone] = KIND[e.kind] || ['dot', 'muted'];
                return (
                  <div key={i} className="c1h-item">
                    <div className={`c1h-dot c1hx-${tone}`}><Icon name={icon} /></div>
                    <div className="c1h-body">
                      <b>{e.title}{e.amount != null ? <span className="c1hx-amt"> · {rupee(e.amount)}</span> : null}</b>
                      {e.detail ? <p>{e.detail}</p> : null}
                      <small>{formatDMY(String(e.at).slice(0, 10))}{e.by ? ` · ${e.by}` : ''}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </C1Section>
      </>}
    </C1Modal>
  );
}
