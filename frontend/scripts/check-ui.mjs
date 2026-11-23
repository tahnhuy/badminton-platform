#!/usr/bin/env node
// DS01 design-system guard (2026-11-18). Checks the files listed in ui-check.config.json and
// refuses new stylesheets. Run with `npm run check:ui` (also part of `npm run lint`).
import { globSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'ui-check.config.json'), 'utf8'));

const LEGACY_VARS = /var\(--(bg-(app|card|subtle|table-header|tag-[a-z]+)|text-(primary|secondary|muted|subtle|tag-uid)|border-(subtle|medium|card)|shadow-(sm|md|lg|modal)|radius-(sm|md|lg|full))\)/;
const RULES = [
  { id: 'hex-color', test: /#[0-9a-fA-F]{3,8}\b/, message: 'Hex color; use a token class (bg-primary, text-muted-foreground, …).' },
  { id: 'inline-style', test: /style=\{\{/, message: 'Static inline style; use Tailwind classes (dynamic values go through a variable or Motion).' },
  { id: 'legacy-var', test: LEGACY_VARS, message: 'Legacy CSS variable; use the semantic token classes.' },
  { id: 'css-import', test: /import\s+['"][^'"]+\.css['"]/, message: 'Stylesheet import; rebuilt UI uses Tailwind only.' },
  { id: 'arbitrary-text-size', test: /\btext-\[\d/, message: 'Arbitrary font size; use text-2xs/xs/sm/base/lg/2xl/3xl.' },
  { id: 'off-scale-radius', test: /(?<![\w-])rounded(-[tblrse]{1,2})?-(sm|xl|3xl|brand|\[[^\]]+\])(?![\w-])/, message: 'Radius off the scale; use rounded-md/lg/2xl/panel/full.' },
  { id: 'legacy-component', test: /from\s+['"][^'"]*components\/common\/(Dialog|DataTable|FilterToolbar)['"]/, message: 'Legacy shared component; use the components/ui primitives.' },
];

const files = [...new Set(config.migrated.flatMap(pattern => globSync(pattern, { cwd: root })))].sort();
const isExcepted = (file, rule) => config.exceptions.some(e => e.file === file && e.rule === rule);
const problems = [];

for (const file of files) {
  readFileSync(join(root, file), 'utf8').split('\n').forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.test.test(line) && !isExcepted(file, rule.id)) problems.push(`${file}:${index + 1}  [${rule.id}] ${rule.message}`);
    }
  });
}

const stylesheets = globSync('src/**/*.css', { cwd: root }).map(file => relative('.', file));
for (const sheet of stylesheets) {
  if (!config.legacyStylesheets.includes(sheet)) problems.push(`${sheet}  [new-stylesheet] New CSS file; rebuilt UI uses Tailwind and tokens.`);
}

if (problems.length > 0) {
  console.error(`check:ui found ${problems.length} problem(s) in ${files.length} rebuilt files:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`check:ui passed: ${files.length} rebuilt files, ${stylesheets.length} legacy stylesheets.`);
