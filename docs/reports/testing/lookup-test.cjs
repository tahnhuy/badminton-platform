// Usage: node docs/reports/testing/lookup-test.cjs <test_file> <test_title>
// Reports (a) whether the title is a statically declared test in test-inventory.csv and
// (b) the runtime status recorded in artifacts/*.json. Source-only inference is never used.
const fs = require('node:fs');
const path = require('node:path');
const { buildIndex, resolve } = require('./evidence-index.cjs');

const [file, title] = process.argv.slice(2);
if (!file || !title) { console.error('usage: lookup-test.cjs <test_file> <test_title>'); process.exit(2); }

const inv = fs.readFileSync(path.join(__dirname, 'test-inventory.csv'), 'utf8').split('\n').slice(1);
const declared = inv.filter((l) => l.includes(`"${file}"`) && l.includes(JSON.stringify(title).slice(1, -1).replaceAll('"', '""'))).length > 0;
const res = resolve(buildIndex(), file, title);
console.log(JSON.stringify({ file, title, declaredInInventory: declared, runtime: res }, null, 1));
