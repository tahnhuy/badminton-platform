// Run: node docs/reports/testing/inventory.cjs
// Static inventory is a review aid, not proof of execution or AC completeness.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../../frontend/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../../..');
function walk(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
const files = [...walk(path.join(root,'backend/src')), ...walk(path.join(root,'frontend/e2e'))].filter(p => /\.(test|spec)\.ts$/.test(p)).sort();
const rows = [];
for (const file of files) {
 const source = fs.readFileSync(file,'utf8');
 const ast = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
 function visit(n) {
  if(ts.isCallExpression(n) && n.arguments.length && ts.isStringLiteralLike(n.arguments[0])) {
   const expr=n.expression.getText(ast);
   if (/^(it|test)(\.(skip|only|todo|fixme))?$/.test(expr)) {
    const loc=ast.getLineAndCharacterOfPosition(n.getStart(ast));
    const backend=file.includes('/backend/');
    rows.push({id:`AUTO-${String(rows.length+1).padStart(4,'0')}`,file:path.relative(root,file),line:loc.line+1,title:n.arguments[0].text,kind:expr,classification:backend?'UNIT_OR_INTEGRATION_API_REVIEW':source.includes('page.route(')||source.includes('context.route(')?'UI_MOCK_REVIEW':'SYSTEM_OR_UI_REVIEW',ac:'UNMAPPED',execution:'NOT_INFERRED_FROM_SOURCE'});
   }
  }
  ts.forEachChild(n,visit);
 }
 visit(ast);
}
const cols=['id','file','line','title','kind','classification','ac','execution'];
const esc=x=>'"'+String(x).replaceAll('"','""')+'"';
fs.writeFileSync(path.join(__dirname,'test-inventory.csv'),[cols.join(','),...rows.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n')+'\n');
console.log(JSON.stringify({files:files.length,staticDeclarations:rows.length,backend:rows.filter(r=>r.file.startsWith('backend/')).length,frontend:rows.filter(r=>r.file.startsWith('frontend/')).length,skipOrTodo:rows.filter(r=>/skip|todo|fixme/.test(r.kind)).length}));
