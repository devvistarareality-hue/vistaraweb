/**
 * Filter pickers offer only what the data actually holds: a project, person or
 * status that occurs in no row would just empty the list. Anything already picked
 * stays listed, so it can still be seen and cleared.
 *
 *   onlyPresent(projects.map(p => ({ value: String(p.id), label: p.name })),
 *               rows.map(r => r.project), picked)
 *
 * `options` are { value, label } objects or plain strings; `present` is every
 * value seen in the rows (repeats and blanks are fine). `present` still null
 * (not loaded yet) leaves the options as they are. Mirrored in the app at
 * Vistarafront/src/lib/presentOptions.js.
 */
export function onlyPresent(options, present, picked = []) {
  if (!present) return options;
  const keep = new Set([...present, ...[].concat(picked)]
    .filter((v) => v !== '' && v != null).map(String));
  return options.filter((o) => keep.has(String(o && typeof o === 'object' ? o.value : o)));
}
