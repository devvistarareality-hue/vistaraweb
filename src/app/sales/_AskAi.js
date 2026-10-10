'use client';
/**
 * Ask the dashboard a question in plain language.
 *
 * "How many site visits last month?" goes to /api/ai/ask/, which lets Claude
 * choose which figures to fetch and then writes the answer. The model never
 * touches the database: the backend runs the query, scoped to whoever is asking,
 * and hands back counts (see backend/ai/tools.py). So the numbers here are the
 * same numbers the screens show, and this user's own — a rep sees their figures,
 * not the company's.
 *
 * Hidden entirely when the server has no API key, rather than offering a box
 * that can only ever fail.
 */
import { useEffect, useRef, useState } from 'react';

import { AI_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import Icon from '../../components/Icon';

// Shown until the user types. Picked to teach the shape of what it can answer:
// a period, a metric, optionally a project.
const EXAMPLES = [
  'How many site visits last month?',
  'Bookings this month by project',
  'Leads from Pratishtha last week',
];

export default function AskAi() {
  const [enabled, setEnabled] = useState(null);   // null = still asking
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    let dead = false;
    apiFetch(AI_ENDPOINTS.status)
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => { if (!dead) setEnabled(!!d.enabled); })
      .catch(() => { if (!dead) setEnabled(false); });
    return () => { dead = true; };
  }, []);

  async function ask(text) {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    setBusy(true); setErr(''); setAnswer('');
    try {
      const res = await apiFetch(AI_ENDPOINTS.ask, {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.detail || 'Could not answer that.'); return; }
      setAnswer(d.answer || '');
    } catch {
      setErr('Could not reach the assistant.');
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  return (
    <div className="nx-card ask-card">
      <div className="ask-row">
        <span className="ask-icon"><Icon name="search" /></span>
        <input
          ref={boxRef}
          className="nx-input ask-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ask(); }}
          placeholder="Ask about your data — site visits, bookings, leads…"
          disabled={busy}
        />
        <button className="nx-btn nx-btn-md nx-btn-primary ask-go"
          onClick={() => ask()} disabled={busy || !q.trim()}>
          {busy ? 'Asking…' : 'Ask'}
        </button>
      </div>

      {!answer && !err && !busy && (
        <div className="ask-examples">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" className="ask-chip"
              onClick={() => { setQ(e); ask(e); }}>{e}</button>
          ))}
        </div>
      )}

      {busy && <p className="ask-wait">Looking it up…</p>}
      {err && <p className="ask-err">{err}</p>}
      {answer && (
        <div className="ask-answer">
          <p className="ask-answer-text">{answer}</p>
          <p className="ask-note">
            Figures come from your own data, scoped the same way the screens are.
          </p>
        </div>
      )}
    </div>
  );
}
