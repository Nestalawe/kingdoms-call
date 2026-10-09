// Sort-comparator check: no `.sort(...)` in the site may use a comparator that is random or takes no
// arguments, e.g. `.sort(()=>Math.random()-0.5)` or a tie-break `||(Math.random()-0.5)`.
// Such a comparator gives inconsistent answers, so the order it produces, and how many random numbers
// it uses, depend on the JavaScript engine's sort algorithm. A newer engine (a newer Node or Chrome)
// then generates a different world from the same seed. To shuffle, use shuffleP(arr, rnd).
// Nothing is run. Reads every inline script in site/*.html and every site/*.js (or $KC_SITE).
const fs=require('fs'), path=require('path');
const {SITE}=require('./lib/boot');

const RANDOM_CALL=/\b(Math\.random|rnd|rng|random)\s*\(/;   // a random draw inside the comparator
const NO_ARGS=/^\s*(\(\s*\)\s*=>|function\s*\(\s*\))/;       // a comparator that ignores what it compares

// The text of the call's argument list starting at s[i]==='(' up to its matching ')'.
function argsAt(s,i){
  let depth=0, q=null;
  for(let k=i;k<s.length;k++){
    const c=s[k];
    if(q){ if(c==='\\'){ k++; continue; } if(c===q) q=null; continue; }
    if(c==='"'||c==="'"||c==='`'){ q=c; continue; }
    if(c==='(') depth++;
    else if(c===')'){ depth--; if(depth===0) return s.slice(i+1,k); }
  }
  return null;
}

let checked=0; const bad=[];
for(const name of fs.readdirSync(SITE).sort()){
  if(!/\.(html|js)$/.test(name)) continue;
  const src=fs.readFileSync(path.join(SITE,name),'utf8');
  const lines=src.split('\n');
  const re=/\.sort\s*\(/g; let m;
  while((m=re.exec(src))){
    const at=m.index, line=src.slice(0,at).split('\n').length, text=lines[line-1];
    const col=at-src.lastIndexOf('\n',at-1)-1;
    const before=text.slice(0,col);
    if(/^\s*(\/\/|\*)/.test(before)||/(^|[\s;{}])\/\/.*$/.test(before)) continue;   // inside a comment
    const args=argsAt(src,at+m[0].length-1);
    if(args==null||!args.trim()) continue;                                         // .sort() with no comparator is fine
    checked++;
    if(NO_ARGS.test(args)||RANDOM_CALL.test(args))
      bad.push(`${name}:${line}  .sort(${args.replace(/\s+/g,' ').slice(0,80)})`);
  }
}
bad.forEach(b=>console.log('FAIL '+b+'\n     a random or argument-less comparator is engine-dependent; shuffle with shuffleP(arr, rnd), then sort by a real key'));
console.log(`${checked} sort comparators checked · ${bad.length} random or argument-less`);
process.exit(bad.length?1:0);
