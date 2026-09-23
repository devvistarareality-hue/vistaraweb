#!/usr/bin/env node
/**
 * Catches an identifier that is used but never declared, imported or global —
 * the mistake that leaves a page working in the build and then throwing
 * "X is not defined" in the browser. Next's build does not look for it and the
 * project has no linter, so this stands in for one.
 *
 *   node scripts/check-undefined.js [file …]     (default: every file in src)
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.join(__dirname, '..', 'src');
const GLOBALS = new Set([
  'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage',
  'console', 'fetch', 'FormData', 'Blob', 'File', 'FileReader', 'URL', 'URLSearchParams',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'Math', 'JSON', 'Date', 'Number', 'String', 'Boolean', 'Object', 'Array', 'Promise',
  'Map', 'Set', 'WeakMap', 'Error', 'RegExp', 'Intl', 'AbortController', 'atob', 'btoa',
  'process', 'require', 'module', 'exports', '__dirname', 'structuredClone', 'alert',
  'confirm', 'prompt', 'Image', 'CustomEvent', 'Event', 'MutationObserver', 'IntersectionObserver',
  'isNaN', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent', 'Symbol',
  'BigInt', 'Infinity', 'NaN', 'undefined', 'globalThis', 'crypto', 'performance', 'ResizeObserver',
  // React Native
  'global', '__DEV__', 'ErrorUtils', 'HermesInternal', 'requestIdleCallback',
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js') || e.name.endsWith('.jsx')) out.push(p);
  }
  return out;
}

const files = process.argv.length > 2 ? process.argv.slice(2) : walk(ROOT);
const problems = [];
for (const file of files) {
  let ast;
  try {
    ast = parser.parse(fs.readFileSync(file, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
    });
  } catch (e) {
    problems.push(`${file}: could not parse — ${e.message}`);
    continue;
  }
  traverse(ast, {
    Program(p) {
      for (const [name, refs] of Object.entries(p.scope.globals ? {} : {})) void [name, refs];
    },
  });
  const { globals } = (function () {
    let g = {};
    traverse(ast, { Program(p) { g = p.scope.globals || {}; } });
    return { globals: g };
  })();
  for (const [name, node] of Object.entries(globals)) {
    if (GLOBALS.has(name)) continue;
    const line = node.loc ? node.loc.start.line : '?';
    problems.push(`${path.relative(process.cwd(), file)}:${line}  ${name} is not defined`);
  }
}

if (problems.length) {
  console.error('\n✖ Undefined identifiers:\n');
  for (const p of problems) console.error('  ' + p);
  console.error('\nEach one throws in the browser the moment that line runs.\n');
  process.exit(1);
}
console.log(`✓ no undefined identifiers (${files.length} files)`);
