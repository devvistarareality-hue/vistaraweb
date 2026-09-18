// Nexora "Spark" mark — blue on the light theme, white + ember on the dark theme.
// Both images are in the page; CSS shows the one matching <html data-theme>.
export default function NexoraLogo({ style, alt = 'Nexora' }) {
  const s = { width: '100%', height: '100%', objectFit: 'contain', ...style };
  return (
    <>
      <img className="nx-logo-light" src="/nexora-mark-light.svg" alt={alt} style={s} />
      <img className="nx-logo-dark" src="/nexora-mark-dark.svg" alt="" aria-hidden="true" style={s} />
    </>
  );
}
