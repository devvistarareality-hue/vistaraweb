'use client';

// Premium bouncing-ball loader (Uiverse, alexruix) — styles in globals.css.
export default function Loader({ label, size, fullScreen = false, style }) {
  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, ...style }} role="status" aria-live="polite">
      <div className={`nx-loader${size === 'sm' ? ' sm' : ''}`} />
      {label && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{label}</div>}
    </div>
  );
  if (!fullScreen) return body;
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'transparent' }}>{body}</div>;
}
