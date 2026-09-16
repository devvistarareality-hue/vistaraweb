'use client';
// Premium notifications and dialogs without any React wiring, so they can be
// called from anywhere (event handlers, async helpers). Styles in globals.css.

const ICON = {
  success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
  error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  trash: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  question: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
};
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function guessType(msg) {
  const m = String(msg).toLowerCase();
  if (/(fail|error|could not|couldn't|cannot|can't|invalid|required|not allowed|denied|please|must|wrong|missing|unable)/.test(m)) return 'error';
  if (/(success|saved|created|updated|deleted|done|sent|approved|completed|copied|added|removed)/.test(m)) return 'success';
  return 'info';
}

export function notify(message, type, { duration = 3800 } = {}) {
  if (typeof document === 'undefined') return;
  type = type || guessType(message);
  let stack = document.querySelector('.nx-toasts');
  if (!stack) { stack = document.createElement('div'); stack.className = 'nx-toasts'; document.body.appendChild(stack); }
  const el = document.createElement('div');
  el.className = `nx-toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="nx-badge">${ICON[type] || ICON.info}</span><span class="nx-msg">${esc(message)}</span><span class="nx-bar" style="animation-duration:${duration}ms"></span>`;
  stack.appendChild(el);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  el.addEventListener('click', close);
  setTimeout(close, duration);
}

function dialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', tone = 'info', input = null }) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'nx-dialog-backdrop';
    const danger = tone === 'danger';
    back.innerHTML = `<div class="nx-dialog ${danger ? 'danger' : 'info'}" role="alertdialog" aria-modal="true">
      <div class="nx-dialog-icon">${danger ? ICON.trash : ICON.question}</div>
      <h3>${esc(title)}</h3><p>${esc(message)}</p>
      ${input !== null ? `<input value="${esc(input)}" />` : ''}
      <div class="nx-actions">${cancelText ? `<button class="nx-btn ghost" data-a="no">${esc(cancelText)}</button>` : ''}<button class="nx-btn ${danger ? 'danger' : 'primary'}" data-a="yes">${esc(confirmText)}</button></div>
    </div>`;
    const field = back.querySelector('input');
    const done = (v) => { document.removeEventListener('keydown', key); back.remove(); resolve(v); };
    const yes = () => done(input !== null ? field.value : true);
    const no = () => done(input !== null ? null : false);
    const key = (e) => { if (e.key === 'Escape') no(); if (e.key === 'Enter') yes(); };
    back.addEventListener('mousedown', (e) => { if (e.target === back) no(); });
    back.querySelector('[data-a="yes"]').addEventListener('click', yes);
    back.querySelector('[data-a="no"]')?.addEventListener('click', no);
    document.addEventListener('keydown', key);
    document.body.appendChild(back);
    (field || back.querySelector('[data-a="yes"]')).focus();
  });
}

// Drop-in async replacement for window.confirm
export function confirmDialog(message, opts = {}) {
  const danger = /delete|remove|discard|clear|cancel|disable|reset|permanent/i.test(message);
  return dialog({
    title: opts.title || (danger ? 'Are you sure?' : 'Please confirm'),
    message,
    confirmText: opts.confirmText || (danger ? (/delete/i.test(message) ? 'Delete' : /remove/i.test(message) ? 'Remove' : 'Yes, continue') : 'Confirm'),
    tone: opts.tone || (danger ? 'danger' : 'info'),
  });
}

// Drop-in async replacement for window.prompt
export function promptDialog(message, defaultValue = '', opts = {}) {
  return dialog({ title: opts.title || 'Enter a value', message, confirmText: 'OK', input: defaultValue ?? '' });
}
