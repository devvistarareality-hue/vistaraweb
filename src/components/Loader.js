'use client';

// Premium bouncing-ball loader (Uiverse, alexruix), always centred.
// variant: 'inline' (just the animation), 'section' (fills a panel), 'page' (60vh), 'screen' (100vh).
export default function Loader({ label, size, fullScreen = false, variant, style }) {
  const v = fullScreen ? 'screen' : (variant || 'section');
  return (
    <div className={`nx-loader-wrap${v === 'inline' ? '' : ' ' + v}`} style={style} role="status" aria-live="polite">
      <div className={`nx-loader${size === 'sm' ? ' sm' : ''}`} />
      {label && <div className="nx-loader-label">{label}</div>}
    </div>
  );
}
