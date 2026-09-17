'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function getTheme() {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function apply(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('nx-theme', t); } catch {}
  window.dispatchEvent(new CustomEvent('nx-theme', { detail: t }));
}

// Switch theme with a circular reveal from the click point where supported.
export function setTheme(t, event) {
  if (t === getTheme()) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) { apply(t); return; }
  const x = event?.clientX ?? window.innerWidth / 2;
  const y = event?.clientY ?? window.innerHeight / 2;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const vt = document.startViewTransition(() => apply(t));
  vt.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
}

// Light / Dark pill with a sliding knob.
export default function ThemeToggle({ compact = false, style }) {
  const [theme, set] = useState('light');
  useEffect(() => {
    set(getTheme());
    const on = (e) => set(e.detail);
    window.addEventListener('nx-theme', on);
    return () => window.removeEventListener('nx-theme', on);
  }, []);
  return (
    <div className={`nx-theme${compact ? ' compact' : ''}`} style={style} role="radiogroup" aria-label="Theme">
      <span className="nx-knob" />
      <button type="button" role="radio" aria-checked={theme === 'light'} className={theme === 'light' ? 'on' : ''} onClick={(e) => setTheme('light', e)}>
        <Sun size={14} strokeWidth={2.2} />{!compact && 'Light'}
      </button>
      <button type="button" role="radio" aria-checked={theme === 'dark'} className={theme === 'dark' ? 'on' : ''} onClick={(e) => setTheme('dark', e)}>
        <Moon size={14} strokeWidth={2.2} />{!compact && 'Dark'}
      </button>
    </div>
  );
}
