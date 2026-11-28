// Validate the single reviewed business-case catalogue and reproduce the automation rate.
// Reads: test-cases.csv, acceptance-register.csv, test sources, artifacts/*.json.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const dir = __dirname;

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const norm = (s) => String(s || '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();

function csvObjects(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const head = rows.shift();
  return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const cases = csvObjects(path.join(dir, 'test-cases.csv'));
const acs = csvObjects(path.join(dir, 'acceptance-register.csv'));
const acById = new Map(acs.map(a => [a.id, a]));
const errors = [], warnings = [];
const required = ['case_id','domain','requirement_ref','ac_ref','title','test_level','test_type','case_type','priority','preconditions','test_data','input_or_steps','expected_result','scope_status','automation_status','execution_status','owner'];
const enums = {
  test_level: ['Unit','Integration','System','Acceptance'],
  case_type: ['positive','negative','boundary'],
  priority: ['P0','P1','P2'],
  scope_status: ['IN_SCOPE','CONFLICT','OUT_OF_SCOPE'],
  automation_status: ['AUTOMATED','MANUAL','PLANNED','PARTIAL'],
  execution_status: ['PASSED','FAILED','NOT_RUN','BLOCKED','SKIPPED'],
};
const ids = new Set();
for (const c of cases) {
  if (!c.case_id) errors.push('empty case_id');
  if (ids.has(c.case_id)) errors.push(`duplicate case_id ${c.case_id}`);
  ids.add(c.case_id);
  for (const f of required) if (String(c[f]).trim() === '') errors.push(`${c.case_id}: missing ${f}`);
  for (const [f, values] of Object.entries(enums)) if (!values.includes(c[f])) errors.push(`${c.case_id}: invalid ${f}=${c[f]}`);
  for (const id of c.ac_ref.split(';').map(s => s.trim()).filter(Boolean)) {
    const ac = acById.get(id);
    if (!ac) errors.push(`${c.case_id}: unknown ac_ref ${id}`);
    else if (!['CURRENT', 'UNRESOLVED', 'SUPERSEDED'].includes(ac.review_status)) errors.push(`${c.case_id}: ac ${id} review_status ${ac.review_status}`);
  }
  if (c.scope_status === 'IN_SCOPE' && /^AC-SRC-0(6[4-9]|7[0-9])/.test(c.ac_ref)) errors.push(`${c.case_id}: conflict rating AC in an IN_SCOPE case`);
  if (c.scope_status === 'CONFLICT' && !String(c.notes).trim()) warnings.push(`${c.case_id}: conflict case has no note`);
  if (c.automation_status === 'AUTOMATED') {
    if (c.execution_status !== 'PASSED') errors.push(`${c.case_id}: AUTOMATED must be PASSED`);
    if (!c.test_file || !c.test_title) errors.push(`${c.case_id}: AUTOMATED missing test reference`);
  } else if (c.execution_status === 'PASSED') errors.push(`${c.case_id}: ${c.automation_status} cannot be PASSED`);
  if (c.test_file) {
    for (const f of c.test_file.split('|').map(s => s.trim()).filter(Boolean)) {
      if (!fs.existsSync(path.join(root, f))) errors.push(`${c.case_id}: missing referenced file ${f}`);
    }
  }
  if (c.evidence) {
    const m = c.evidence.match(/artifacts\/[A-Za-z0-9._/-]+\.json/);
    if (m && !fs.existsSync(path.join(dir, m[0]))) errors.push(`${c.case_id}: missing evidence ${m[0]}`);
    if (c.execution_status === 'PASSED' && !/not ci/i.test(c.evidence)) warnings.push(`${c.case_id}: PASSED evidence does not state it is not CI`);
  }
  if (c.automation_status === 'AUTOMATED') {
    const files = c.test_file.split('|').map(s => s.trim()).filter(Boolean);
    const titles = c.test_title.split('|').map(s => s.trim()).filter(Boolean);
    if (files.length !== titles.length) errors.push(`${c.case_id}: test_file/test_title count mismatch`);
    for (let i = 0; i < files.length; i++) {
      const p = path.join(root, files[i]);
      if (!fs.existsSync(p)) { errors.push(`${c.case_id}: missing test file ${files[i]}`); continue; }
      const src = norm(fs.readFileSync(p, 'utf8'));
      if (!src.includes(norm(titles[i]))) errors.push(`${c.case_id}: title not found in ${files[i]}: ${titles[i]}`);
    }
  }
}

// Evidence verification against the 2026-11-28 local reports.
const artifacts = new Map();
for (const name of ['backend.json','unit.json','system.json','remaining.json','tournament.json','ui.json']) {
  const p = path.join(dir, 'artifacts', name); if (!fs.existsSync(p)) continue;
  const raw = fs.readFileSync(p, 'utf8'); const d = JSON.parse(raw.slice(raw.indexOf('{')));
  artifacts.set(name, d);
}
function backendHas(title) {
  for (const name of ['backend.json','unit.json']) {
    const d = artifacts.get(name); if (!d) continue;
    for (const t of d.testResults || []) for (const a of t.assertionResults || []) {
      const hay = norm([...(a.ancestorTitles || []), a.title].join(' '));
      if (hay.includes(norm(title)) && a.status === 'passed') return name;
    }
  }
  return null;
}
function playwrightHas(file, title) {
  for (const [name, d] of artifacts) {
    if (!name.endsWith('.json') || name.startsWith('backend') || name.startsWith('unit')) continue;
    const specs = []; (function w(s) { for (const x of s || []) { if (x.specs) specs.push(...x.specs); if (x.suites) w(x.suites); } })(d.suites);
    for (const s of specs) if (norm(s.file).includes(norm(path.basename(file))) && norm(s.title).includes(norm(title)) && s.ok === true) return name;
  }
  return null;
}
let evidenceChecked = 0;
for (const c of cases) {
  if (c.execution_status !== 'PASSED') continue;
  const files = c.test_file.split('|').map(s => s.trim()).filter(Boolean);
  const titles = c.test_title.split('|').map(s => s.trim()).filter(Boolean);
  for (let i = 0; i < files.length; i++) {
    const hit = files[i].startsWith('backend/') ? backendHas(titles[i]) : playwrightHas(files[i], titles[i]);
    if (!hit) errors.push(`${c.case_id}: no passing artifact entry for ${files[i]} :: ${titles[i]}`);
    else evidenceChecked++;
  }
}

// Rates and coverage.
const byDomain = {};
for (const c of cases) {
  const d = byDomain[c.domain] || (byDomain[c.domain] = { total: 0, automated: 0, partial: 0, planned: 0, manual: 0, passed: 0, inScope: 0, inScopeAutomated: 0, conflict: 0 });
  d.total++; d[c.automation_status.toLowerCase()]++;
  if (c.execution_status === 'PASSED') d.passed++;
  if (c.scope_status === 'IN_SCOPE') { d.inScope++; if (c.automation_status === 'AUTOMATED') d.inScopeAutomated++; }
  if (c.scope_status === 'CONFLICT') d.conflict++;
}
const base = cases.filter(c => c.scope_status === 'IN_SCOPE');
const automated = base.filter(c => c.automation_status === 'AUTOMATED');
const referenced = new Set();
for (const c of cases) for (const id of c.ac_ref.split(';').map(s => s.trim()).filter(Boolean)) referenced.add(id);
const currentAcs = acs.filter(a => a.review_status === 'CURRENT' && a.scope_status === 'IN_SCOPE');
const coveredAcs = currentAcs.filter(a => referenced.has(a.id));
const gaps = currentAcs.filter(a => !referenced.has(a.id)).map(a => a.id);
const result = {
  generatedAt: new Date().toISOString(),
  cases: cases.length,
  byDomain,
  base: { total: base.length, automated: automated.length, ratePct: +(100 * automated.length / base.length).toFixed(2) },
  sensitivityAllScopes: { total: cases.length, automated: cases.filter(c => c.automation_status === 'AUTOMATED').length, ratePct: +(100 * cases.filter(c => c.automation_status === 'AUTOMATED').length / cases.length).toFixed(2) },
  acceptanceCriteria: { currentInScope: currentAcs.length, withCase: coveredAcs.length, coveragePct: +(100 * coveredAcs.length / currentAcs.length).toFixed(2), uncovered: gaps },
  evidenceChecked,
  errors, warnings,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
