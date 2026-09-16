'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function getTheme() {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('nx-theme', t); } catch {}
  window.dispatchEvent(new CustomEvent('nx-theme', { detail: t }));
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
      <button type="button" role="radio" aria-checked={theme === 'light'} className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>
        <Sun size={14} strokeWidth={2.2} />{!compact && 'Light'}
      </button>
      <button type="button" role="radio" aria-checked={theme === 'dark'} className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>
        <Moon size={14} strokeWidth={2.2} />{!compact && 'Dark'}
      </button>
    </div>
  );
}
