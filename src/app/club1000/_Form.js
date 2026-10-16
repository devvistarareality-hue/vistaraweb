'use client';
// Club 1000's dialogs and forms, laid out like Sales' booking form: a header, then
// sections (nx-section) of label-on-the-left fields (nx-field). Every Club 1000
// form uses these, so they read alike and carry no inline styles.
import Icon from '../../components/Icon';

// The dialog frame: header (title, optional badge and sub-line, close), a scrolling
// body, and a footer of buttons. Renders a <form> when onSubmit is given.
export function C1Modal({ title, badge, sub, onClose, onSubmit, footer, wide = false, children }) {
  const Box = onSubmit ? 'form' : 'div';
  return (
    <div className="nx-modal-backdrop" onClick={onClose}>
      <Box className={`nx-modal c1m${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()}
        {...(onSubmit ? { onSubmit } : {})}>
        <div className="c1m-head">
          <div className="c1m-titles">
            <div className="c1m-title">{title}{badge ? <span className="c1m-badge">{badge}</span> : null}</div>
            {sub ? <div className="c1m-sub">{sub}</div> : null}
          </div>
          <button type="button" className="nx-btn nx-btn-md nx-icon-btn nx-btn-ghost c1m-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="c1m-body">{children}</div>
        {footer ? <div className="c1m-foot">{footer}</div> : null}
      </Box>
    </div>
  );
}

// A titled group of fields — the cards Sales' booking form is made of.
export function C1Section({ title, children }) {
  return (
    <div className="nx-card nx-section c1-section">
      {title ? <div className="nx-section-title">{title}</div> : null}
      {children}
    </div>
  );
}

// One field: label (and optional hint) on the left, the control on the right.
export function C1Field({ label, hint, required = false, children }) {
  return (
    <div className="nx-field">
      <label className="nx-field-label">{label}{required ? ' *' : ''}{hint ? <span className="nx-hint">{hint}</span> : null}</label>
      <div className="c1-field-ctl">{children}</div>
    </div>
  );
}

// A read-only figure shown in a field's place (maturity date, a total).
export function C1Value({ children, tone = '' }) {
  return <div className={`c1-value${tone ? ` ${tone}` : ''}`}>{children}</div>;
}

// The inline error / note line at the bottom of a form.
export function C1Error({ children }) {
  return children ? <div className="nx-note bad c1-error">{children}</div> : null;
}
