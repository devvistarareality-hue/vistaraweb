#!/usr/bin/env node
/**
 * Every `import { x } from './y'` must name something './y' actually exports.
 *
 * Neither the build nor check-undefined.js catches this. A named import that
 * does not exist is not a build error — webpack warns and carries on, and the
 * identifier is simply `undefined` at runtime. check-undefined.js sees the name
 * in an import list and considers it declared. So the first sign of trouble is
 * a user clicking the button and getting "Cannot read properties of undefined".
 *
 * Both of this project's own instances of that shipped on the same day:
 *   - `import { API } from '../constants/api'` — the file exports
 *     AUTH_ENDPOINTS, SALES_ENDPOINTS, … and no `API` at all. "View as" threw
 *     on every click.
 *   - a module overwritten rather than added to, silently removing ten exports
 *     that fourteen screens imported.
 *
 * Relative imports only: node_modules resolution is a different problem and npm
 * already fails loudly on a missing package.
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'src';
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.next/.test(p)) walk(p); }
    else if (/\.jsx?$/.test(p)) files.push(p);
  }
})(ROOT);

// Strip comments and strings so an `import {…}` inside either is not read as code.
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, '``');
}

const exportCache = new Map();
function exportsOf(file) {
  if (exportCache.has(file)) return exportCache.get(file);
  const src = code(fs.readFileSync(file, 'utf8'));
  const out = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z0-9_$]+)/g))
    out.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g))
    m[1].split(',').forEach((x) => { const n = x.split(/\s+as\s+/).pop().trim(); if (n) out.add(n); });
  if (/export\s+default/.test(src)) out.add('default');
  if (/export\s*\*/.test(src)) out.add('*');        // re-export: can't tell, don't guess
  exportCache.set(file, out);
  return out;
}

function resolve(fromFile, spec) {
  const t = path.resolve(path.dirname(fromFile), spec);
  return [t + '.js', t + '.jsx', path.join(t, 'index.js'), path.join(t, 'index.jsx'), t]
    .find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}

const problems = [];
for (const file of files) {
  const src = code(fs.readFileSync(file, 'utf8'));
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
    const names = m[1].split(',').map((x) => x.split(/\s+as\s+/)[0].trim()).filter(Boolean);
    const target = resolve(file, m[2]);
    if (!target) { problems.push(`${file}\n    imports from '${m[2]}' — no such file`); continue; }
    const ex = exportsOf(target);
    if (ex.has('*')) continue;
    for (const n of names) {
      if (!ex.has(n)) {
        problems.push(`${file}\n    imports { ${n} } from '${m[2]}' — ${path.relative('.', target)} does not export it`);
      }
    }
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} import(s) name something that is not exported:\n`);
  problems.forEach((p) => console.error('  ' + p + '\n'));
  console.error('These build fine and then throw "Cannot read properties of undefined" in the browser.\n');
  process.exit(1);
}
console.log(`✓ all named imports resolve (${files.length} files)`);
