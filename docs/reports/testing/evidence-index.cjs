// Shared helper: index runtime results found in artifacts/*.json by (test file, test title).
// Used by lookup-test.cjs and test-case-tools.cjs. Does not run tests and never infers a result from source.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const artifactsDir = path.join(__dirname, 'artifacts');

// Report name -> kind. Order is the preferred evidence order.
const REPORTS = [
  { name: 'backend.json', kind: 'vitest' },
  { name: 'unit.json', kind: 'vitest' },
  { name: 'verification.json', kind: 'vitest' },
  { name: 'ui.json', kind: 'playwright' },
  { name: 'system.json', kind: 'playwright' },
  { name: 'remaining.json', kind: 'playwright' },
  { name: 'tournament.json', kind: 'playwright' },
];

function loadJson(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw.slice(raw.indexOf('{')));
}

function playwrightSpecs(suites, out = []) {
  for (const s of suites || []) {
    for (const spec of s.specs || []) out.push(spec);
    playwrightSpecs(s.suites, out);
  }
  return out;
}

function normalizeStatus(status) {
  if (status === 'passed' || status === 'expected') return 'PASSED';
  if (status === 'failed' || status === 'unexpected') return 'FAILED';
  if (status === 'skipped' || status === 'pending' || status === 'todo') return 'SKIPPED';
  if (status === 'flaky') return 'FAILED';
  return 'UNKNOWN';
}

/** Returns Map key "file\u0000title" -> [{report, status, fullName}] */
function buildIndex() {
  const index = new Map();
  const reports = [];
  const add = (file, title, report, status, fullName) => {
    const key = `${file}\u0000${title}`;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({ report, status, fullName });
  };
  for (const r of REPORTS) {
    const p = path.join(artifactsDir, r.name);
    if (!fs.existsSync(p)) continue;
    const d = loadJson(p);
    reports.push(r.name);
    if (r.kind === 'vitest') {
      for (const t of d.testResults || []) {
        const file = path.relative(root, t.name);
        for (const a of t.assertionResults || []) add(file, a.title, r.name, normalizeStatus(a.status), a.fullName);
      }
    } else {
      for (const spec of playwrightSpecs(d.suites)) {
        const file = path.join('frontend/e2e', spec.file);
        const status = (spec.tests || []).every((t) => t.status === 'expected') ? 'PASSED'
          : (spec.tests || []).some((t) => t.status === 'unexpected' || t.status === 'flaky') ? 'FAILED' : 'SKIPPED';
        add(file, spec.title, r.name, status, spec.title);
      }
    }
  }
  return { index, reports };
}

/** Resolve a (file, title) pair: exact match first, then parameterized-title match (%s, %d, $name placeholders). */
function resolve(indexObj, file, title) {
  const exact = indexObj.index.get(`${file}\u0000${title}`);
  if (exact) return { matches: exact, mode: 'exact' };
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%[sdifjoO]|\\\$\\\{[^}]*\\\}|\\\$[A-Za-z_]+/g, '.+');
  if (escaped !== title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) {
    const re = new RegExp(`^${escaped}$`);
    const matches = [];
    for (const [key, v] of indexObj.index) {
      const [f, t] = key.split('\u0000');
      if (f === file && re.test(t)) matches.push(...v);
    }
    if (matches.length) return { matches, mode: 'parameterized' };
  }
  return { matches: [], mode: 'none' };
}

module.exports = { root, artifactsDir, REPORTS, buildIndex, resolve, loadJson };
