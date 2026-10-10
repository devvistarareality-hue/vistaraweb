'use client';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Sparkles, X, Send } from 'lucide-react';
import { SALES_ENDPOINTS, authHeaders } from '../constants/api';
import { explainApiError, explainNetworkError } from '../lib/apiError';

// Ask Nexora — the AI assistant (backend sales/assistant.py). A floating button on
// the Sales and Channel Partner screens opens a chat: type a question, the server
// answers from what this person can see. Shown only to people ticked in User
// Management (Ask Nexora (AI)) and to admins.
export const canUseAI = (user) => !!(user && (user.can_use_ai || user.role === 'Admin' || user.is_staff));

const EXAMPLES = [
  "Show today's site visits",
  'How many Meta leads came this week, project-wise?',
  'Which STM has the most pending follow-ups?',
  'Why are closures low this month?',
  'What should my team focus on this week?',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The answer comes as simple Markdown — paragraphs, bullets, **bold** and tables.
// Rendered as React elements (never raw HTML), so nothing in an answer can run.
function inline(text, key) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**')
    ? <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong> : <span key={`${key}-${i}`}>{p}</span>));
}

function Markdown({ text }) {
  const lines = String(text || '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i += 1; }
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r));
      const [head, ...rest] = body;
      out.push(
        <div key={`t${i}`} className="ask-table-wrap">
          <table className="ask-table">
            <thead><tr>{cells(head).map((c, j) => <th key={j}>{inline(c, `h${j}`)}</th>)}</tr></thead>
            <tbody>{rest.map((r, k) => <tr key={k}>{cells(r).map((c, j) => <td key={j}>{inline(c, `c${k}${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*•]\s+/, '')); i += 1; }
      out.push(<ul key={`u${i}`} className="ask-list">{items.map((it, k) => <li key={k}>{inline(it, `l${k}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i += 1; }
      out.push(<ol key={`o${i}`} className="ask-list">{items.map((it, k) => <li key={k}>{inline(it, `n${k}`)}</li>)}</ol>);
      continue;
    }
    const h = line.match(/^\s*#{1,4}\s+(.*)$/);
    if (h) { out.push(<div key={`h${i}`} className="ask-h">{inline(h[1], `hh${i}`)}</div>); i += 1; continue; }
    if (line.trim()) out.push(<p key={`p${i}`} className="ask-p">{inline(line, `p${i}`)}</p>);
    i += 1;
  }
  return <>{out}</>;
}

export default function AskNexora({ cp = false }) {
  const user = useSelector((s) => s.auth?.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState([]);       // [{ q, a?, err?, busy? }]
  const [text, setText] = useState('');
  const busy = turns.some((t) => t.busy);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, open]);

  if (!canUseAI(user)) return null;

  async function ask(question) {
    const q = question.trim();
    if (!q || busy) return;
    setText('');
    const history = turns.filter((t) => t.a).map((t) => ({ q: t.q, a: t.a }));
    setTurns((ts) => [...ts, { q, busy: true }]);
    const finish = (patch) => setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? { ...t, busy: false, ...patch } : t)));
    try {
      const res = await fetch(SALES_ENDPOINTS.aiAsk, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ question: q, history, company_id: companyId || null, module: cp ? 'cp' : 'sales' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { finish({ err: explainApiError(res, d, 'Ask Nexora could not take that question.') }); return; }
      for (let n = 0; n < 120; n += 1) {           // up to ~4 minutes
        await sleep(n < 5 ? 1200 : 2000);
        const s = await fetch(SALES_ENDPOINTS.aiAskJob(d.job), { headers: authHeaders() });
        const st = await s.json().catch(() => ({}));
        if (!s.ok) { finish({ err: explainApiError(s, st, 'Ask Nexora could not answer.') }); return; }
        if (st.status === 'done') { finish({ a: st.answer }); return; }
        if (st.status === 'error') { finish({ err: st.detail || 'Ask Nexora could not answer.' }); return; }
      }
      finish({ err: 'That is taking too long — try a narrower question.' });
    } catch (e) { finish({ err: explainNetworkError(e) }); }
  }

  return (
    <>
      {!open && (
        <button type="button" className="ask-fab" onClick={() => setOpen(true)} aria-label="Ask Nexora">
          <Sparkles size={18} /> <span>Ask Nexora</span>
        </button>
      )}
      {open && (
        <section className="ask-panel" role="dialog" aria-label="Ask Nexora">
          <header className="ask-head">
            <div className="ask-title"><Sparkles size={16} /> Ask Nexora</div>
            <div className="ask-head-actions">
              {turns.length > 0 && !busy && (
                <button type="button" className="ask-clear" onClick={() => setTurns([])}>New chat</button>
              )}
              <button type="button" className="ask-close" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
          </header>
          <div className="ask-body">
            {turns.length === 0 && (
              <div className="ask-intro">
                <p>Ask about your leads, site visits, follow-ups, closures and bookings — in plain words. Answers use only what you can see.</p>
                <div className="ask-examples">
                  {EXAMPLES.map((ex) => <button key={ex} type="button" className="ask-example" onClick={() => ask(ex)}>{ex}</button>)}
                </div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className="ask-turn">
                <div className="ask-q">{t.q}</div>
                {t.busy && <div className="ask-a ask-thinking"><span className="ask-dot" /><span className="ask-dot" /><span className="ask-dot" /> Looking at your data…</div>}
                {t.a && <div className="ask-a"><Markdown text={t.a} /></div>}
                {t.err && <div className="ask-a ask-err">{t.err}</div>}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form className="ask-input" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
            <textarea className="nx-input ask-textarea" rows={1} value={text} disabled={busy}
              placeholder="Ask a question… e.g. today's site visits"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text); } }} />
            <button type="submit" className="nx-btn nx-btn-md nx-btn-primary ask-send" disabled={busy || !text.trim()} aria-label="Ask">
              <Send size={16} />
            </button>
          </form>
          <p className="ask-foot">AI can make mistakes — check important numbers on the screens.</p>
        </section>
      )}
    </>
  );
}
