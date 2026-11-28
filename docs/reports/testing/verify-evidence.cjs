// Verify source-file execution coverage, not AC coverage or automation rate.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),artifacts=path.join(__dirname,'artifacts');
function files(dir,suffix){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name),suffix):e.name.endsWith(suffix)?[path.relative(root,path.join(dir,e.name))]:[]);}
function report(name){const raw=fs.readFileSync(path.join(artifacts,name),'utf8');return JSON.parse(raw.slice(raw.indexOf('{')));}
function specs(suites){return suites.flatMap(s=>[...(s.specs||[]).map(t=>t.file),...specs(s.suites||[])]);}
const backend=new Set(),frontend=new Map(),checks=[];
for(const name of ['backend.json','verification.json','unit.json']){
 const d=report(name);checks.push({report:name,pass:d.success===true && d.numFailedTests===0 && d.numPendingTests===0});
 for(const t of d.testResults)backend.add(path.relative(root,t.name));
}
for(const name of ['ui.json','system.json','remaining.json','tournament.json']){
 const d=report(name);checks.push({report:name,pass:d.stats.unexpected===0 && d.stats.skipped===0 && d.stats.flaky===0 && (d.errors||[]).length===0});
 for(const p of new Set(specs(d.suites))){const file=path.join('frontend/e2e',p);frontend.set(file,[...(frontend.get(file)||[]),name]);}
}
const backendSource=files(path.join(root,'backend/src'),'.test.ts'),frontendSource=files(path.join(root,'frontend/e2e'),'.spec.ts');
const missingBackend=backendSource.filter(p=>!backend.has(p)),missingFrontend=frontendSource.filter(p=>!frontend.has(p));
const overlaps=[...frontend].filter(([,reports])=>reports.length>1);
const result={generatedAt:new Date().toISOString(),scope:'Checked-in test/spec files; not a denominator for business cases or AC coverage',checks,
 backend:{sourceFiles:backendSource.length,executedFiles:backend.size,missing:missingBackend},
 frontend:{sourceFiles:frontendSource.length,executedFiles:frontend.size,missing:missingFrontend,overlaps},
 complete:checks.every(c=>c.pass)&&!missingBackend.length&&!missingFrontend.length&&!overlaps.length};
fs.writeFileSync(path.join(artifacts,'execution-manifest.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.complete)process.exitCode=1;
