'use client';
import { useEffect, useState } from 'react';

// The Source filter on Leads, Site Visits, Follow-Ups, Closures, My Bookings and the
// dashboards — in the Sales module and the Channel Partner module alike.
//
//   Sales — leads that did not come through a channel partner
//   CP    — leads that did (a partner attached, or Source = "Channel Partner")
//   All   — both
//
// The server splits strictly by where the lead came from (sales/views.py
// requested_book), so Sales + CP always equals All for whoever is looking. Each
// module opens on its own book; the choice is remembered per module.
export const BOOK_OPTIONS = [['sales', 'Sales'], ['cp', 'CP'], ['all', 'All']];

export function useBook(cpOnly) {
  // The Channel Partner module is the partner book, full stop: no switch there, and
  // the server's own CP rules apply (see backend requested_book).
  const key = cpOnly ? 'nx_book_cp' : 'nx_book_sales';
  const fallback = cpOnly ? 'cp' : 'sales';
  const [book, setBookState] = useState(fallback);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (BOOK_OPTIONS.some(([k]) => k === saved)) setBookState(saved);
    } catch (_) {}
  }, [key]);
  const setBook = (b) => {
    setBookState(b);
    try { localStorage.setItem(key, b); } catch (_) {}
  };
  if (cpOnly) return ['cp', () => {}];
  return [book, setBook];
}

export default function BookFilter({ value, onChange, label = 'Source', hidden }) {
  if (hidden) return null;
  return (
    <div className="book-filter" role="radiogroup" aria-label={label}>
      <span className="book-filter-label">{label}</span>
      <div className="ard-view">
        {BOOK_OPTIONS.map(([k, text]) => (
          <button key={k} type="button" role="radio" aria-checked={value === k}
            className={`ard-view-btn${value === k ? ' is-on' : ''}`} onClick={() => onChange(k)}>{text}</button>
        ))}
      </div>
    </div>
  );
}
