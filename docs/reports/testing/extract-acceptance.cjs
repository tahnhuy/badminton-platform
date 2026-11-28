// Extract explicit acceptance sections for human review, preserving source lines.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
const rows=[];
for(const file of walk(path.join(root,'docs/features')).filter(f=>/(prd|tech-design)\.md$/.test(f))){
 const lines=fs.readFileSync(file,'utf8').split('\n');let active=false,depth=0,current=null;
 const flush=()=>{if(current){rows.push(current);current=null;}};
 lines.forEach((line,i)=>{
  const h=line.match(/^(#{1,6})\s+(.*)/);
  if(h){if(active&&h[1].length<=depth){flush();active=false;}if(/Acceptance Criteria|Acceptance \/ Verification Considerations/i.test(h[2])){flush();active=true;depth=h[1].length;}}
  if(!active)return;
  if(/^[-*] /.test(line)||/^\d+\. /.test(line)){flush();current={id:`AC-SRC-${String(rows.length+1).padStart(3,'0')}`,source:path.relative(root,file),line:i+1,text:line.replace(/^([-*]|\d+\.) /,''),status:'REVIEW_CURRENT_SPEC',test:'UNMAPPED'};}
  else if(current&&line.trim()&&!h)current.text+=' '+line.trim();
 });flush();
}
const cols=['id','source','line','text','status','test'];const esc=x=>'"'+String(x).replaceAll('"','""')+'"';
// The reviewed acceptance-register.csv is a maintained document. Raw extraction must not
// overwrite its review_status/scope_status columns; write to a scratch path for manual merge.
const out=process.env.AC_RAW_OUT || '/tmp/acceptance-register.raw.csv';
fs.writeFileSync(out,[cols.join(','),...rows.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n')+'\n');
console.log(`Explicit source bullets: ${rows.length}; raw file: ${out}; reviewed register not overwritten.`);
