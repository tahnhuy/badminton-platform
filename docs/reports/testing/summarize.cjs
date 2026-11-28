const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'artifacts');
const output={generatedAt:new Date().toISOString(),suites:{}};
for(const file of ['unit.json','backend.json','ui.json','system.json','remaining.json','tournament.json','verification.json']) {
 const p=path.join(root,file);if(!fs.existsSync(p)){output.suites[file]={state:'NOT_AVAILABLE'};continue;}
 try {
  const raw=fs.readFileSync(p,'utf8');const d=JSON.parse(raw.slice(raw.indexOf('{')));
  if('numTotalTests' in d) output.suites[file]={total:d.numTotalTests,passed:d.numPassedTests,failed:d.numFailedTests,pending:d.numPendingTests,success:d.success,failures:(d.testResults||[]).flatMap(s=>(s.assertionResults||[]).filter(t=>t.status==='failed').map(t=>({file:s.name,title:t.fullName,message:t.failureMessages}))) };
  else output.suites[file]={stats:d.stats,errors:d.errors,failures:failures(d.suites||[])};
 }catch(e){output.suites[file]={state:'INVALID_OR_INCOMPLETE',error:e.message};}
}
function failures(suites){return suites.flatMap(s=>[...(s.specs||[]).flatMap(t=>(t.tests||[]).filter(x=>x.status==='unexpected').map(x=>({file:t.file,line:t.line,title:t.title,errors:(x.results||[]).flatMap(r=>r.errors||[])}))),...failures(s.suites||[])]);}
const cov=path.join(root,'coverage/coverage-summary.json');if(fs.existsSync(cov))output.coverage=JSON.parse(fs.readFileSync(cov)).total;
const supplemental=path.join(root,'coverage-validation/coverage-summary.json');
if(fs.existsSync(cov) && fs.existsSync(supplemental)) {
 const base=JSON.parse(fs.readFileSync(cov)), extra=JSON.parse(fs.readFileSync(supplemental));
 const overlap=Object.keys(extra).filter(k=>k!=='total' && k in base);
 if(overlap.length) output.aggregateCoverage={state:'REQUIRES_LINE_LEVEL_MERGE',overlap};
 else {
  const total=base.total.lines.total+extra.total.lines.total;
  const covered=base.total.lines.covered+extra.total.lines.covered;
  output.aggregateCoverage={scope:'baseline core layers + six flat validation files',totalLines:total,coveredLines:covered,pct:100*covered/total,
   note:'Disjoint file sets; local runs against unchanged production source, not proof of latest CI. Baseline config was extended with flat validation glob during execution; supplementary unit run measures those files.'};
 }
}
const chat=path.join(root,'messaging-latency.json');if(fs.existsSync(chat)) output.messagingLatency=JSON.parse(fs.readFileSync(chat));
const perf=path.join(root,'performance.json');if(fs.existsSync(perf))output.performance=JSON.parse(fs.readFileSync(perf));
fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
