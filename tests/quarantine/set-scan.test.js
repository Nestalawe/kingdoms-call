// QUARANTINED 2026-10-01: report-only (always exits 0); lists 40 suspect sites on v2026.09.30-0038, mostly names reused in other scopes, so it can't gate until triaged.
// Static scan: consts declared as `new Set(...)` that are later called with .includes(),
// and consts declared as array literals / .filter() / .map() later called with .has().
// Catches the "collapse to one source" refactor's Set/Array mix-ups in both portals.
const fs=require('fs'); const {sitePath}=require('../lib/boot');
const FILES=['kingdoms-call-gm-portal.html','kingdoms-call-player-portal.html','kingdoms-call-data.js'];
let bad=0;
for(const f of FILES){
  const src=fs.readFileSync(sitePath(f),'utf8'); const lines=src.split('\n');
  const sets=new Map(), arrs=new Map();
  lines.forEach((ln,i)=>{
    let m;
    const declRe=/(?:^|[;{\s])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)$/;
    m=declRe.exec(ln); if(!m) return;
    const name=m[1], rhs=m[2].trim();
    if(/^new\s+Set\s*\(/.test(rhs)) sets.set(name,i+1);
    else if(/^\[/.test(rhs)||/^Object\.(keys|values)\s*\(/.test(rhs)||/\.(filter|map|concat|slice|split)\s*\(/.test(rhs.split('//')[0]||'')) {
      if(!/new\s+Set/.test(rhs)) arrs.set(name,i+1);
    }
  });
  const report=[];
  lines.forEach((ln,i)=>{
    for(const [n,d] of sets){ const re=new RegExp('\\b'+n.replace(/\$/g,'\\$')+'\\s*\\.includes\\s*\\(');
      if(re.test(ln)) report.push(`${f}:${i+1}  ${n} is a Set (declared line ${d}) but .includes() is called on it`); }
    for(const [n,d] of arrs){ const re=new RegExp('\\b'+n.replace(/\$/g,'\\$')+'\\s*\\.has\\s*\\(');
      if(re.test(ln)) report.push(`${f}:${i+1}  ${n} looks like an Array (declared line ${d}) but .has() is called on it`); }
  });
  [...new Set(report)].forEach(r=>{ console.log('  '+r); bad++; });
}
console.log(bad?`\n${bad} suspect site(s)`:'\nno Set/Array mix-ups found');
