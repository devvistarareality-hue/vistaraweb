# Nexora web — rules for everyone working in this repo

## Styling: no inline styles
- Never add `style={{ … }}` or `style={[ … ]}` to JSX. A pre-commit hook
  (`scripts/check-inline-styles.js`, enabled by `npm install`) rejects them.
- Styling lives in the shared files:
  - `src/app/globals.css` — design tokens (colours, surfaces, shadows) for the
    light and dark themes. Always use `var(--…)`; never hard-code a colour.
  - `src/app/ui.css` — component classes: `nx-page`, `nx-card`, `nx-section`,
    `nx-field`, `nx-input`, `nx-btn nx-btn-md nx-btn-primary|secondary|success|danger`,
    `nx-toggle is-on`, `nx-table`, `nx-badge`, `nx-modal`, `nx-note ok|bad|warn|info`, …
- Need something new? Add a class to `ui.css` (both themes via tokens) and use it.
- Existing inline styles are legacy: when you touch one of those lines, move it to a class.
- A genuinely dynamic value (a computed width %, a position from data) may stay
  inline if the line ends with `// inline-ok: <reason>`.

## Other conventions
- Logo: `components/NexoraLogo` (switches with the theme). Loader: `components/Loader`.
- Alerts/confirms: `lib/notify.js` (`notify`, `confirmDialog`), never `alert()`/`confirm()`.
- Every web change must also be made in the app (Vistarafront).
