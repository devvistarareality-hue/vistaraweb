#!/usr/bin/env node
/**
 * Blocks NEW inline styles from being committed.
 *
 * Rule: styling lives in shared files, never in an object literal passed to `style`.
 *   Web  → src/app/globals.css (tokens) + src/app/ui.css (component classes).
 *   Use className="nx-card", "nx-btn nx-btn-md nx-btn-primary", "nx-input", etc.
 *
 * Existing inline styles are grandfathered, but any line you add or change must
 * not introduce one. Truly dynamic values (a computed width %, a position from
 * data) may stay inline if the line ends with a `// inline-ok: <reason>` comment.
 *
 * Runs from .githooks/pre-commit. Manual run: `npm run check:styles`.
 */
const { execSync } = require('child_process');

const diff = execSync('git diff --cached -U0 --diff-filter=AM -- "*.js" "*.jsx" "*.tsx"', { encoding: 'utf8' });
const bad = [];
let file = null;
let line = 0;
for (const l of diff.split('\n')) {
  if (l.startsWith('+++ ')) { file = l.replace(/^\+\+\+ b\//, ''); continue; }
  const hunk = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
  if (hunk) { line = Number(hunk[1]); continue; }
  if (!l.startsWith('+') || l.startsWith('+++')) continue;
  const code = l.slice(1);
  const trimmed = code.trim();
  const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('{/*');
  // style={{ ... }} is always inline; style={[a, b]} is fine unless the array holds an object literal.
  const inlineObject = /style=\{\s*\{/.test(code) || /style=\{\s*\[[^\]]*\{/.test(code);
  if (!isComment && inlineObject && !/inline-ok/.test(code)) bad.push(`  ${file}:${line}  ${trimmed.slice(0, 110)}`);
  line += 1;
}

if (bad.length) {
  console.error('\n✖ Inline styles are not allowed. Move these into the shared style files:\n');
  console.error(bad.join('\n'));
  console.error(`
  Web: add/use a class in src/app/ui.css (colours as var(--…) tokens from globals.css).
  App: use src/styles/common.js or a StyleSheet.create() in the screen, with COLORS tokens.
  Genuinely dynamic value? end the line with  // inline-ok: <reason>
`);
  process.exit(1);
}
