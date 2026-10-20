// Sort-comparator check: no `.sort(...)` in the site may use a comparator that is random or takes no
// arguments, e.g. `.sort(()=>Math.random()-0.5)` or a tie-break `||(Math.random()-0.5)`.
// Such a comparator gives inconsistent answers, so the order it produces, and how many random numbers
// it uses, depend on the JavaScript engine's sort algorithm. A newer engine (a newer Node or Chrome)
// then generates a different world from the same seed. To shuffle, use shuffleP(arr, rnd).
// Nothing is run. Reads every page's template (src/*.html: its inline scripts), every module under src/ (.ts since
// P1-09e) and every .js file under public/ but supabase-js (since P1-09d; until then the built site, whose pages held
// their scripts inline). It fails if a module of a page isn't read, so a rename can't leave the code out unnoticed.
const fs=require('fs'), path=require('path');
const {filesUnder,ROOT}=require('../tools/build.ts');
const {pageModules,pageNames}=require('../tools/pages.ts');
const FILES=[
  ...filesUnder(path.join(ROOT,'src')).filter(f=>(/\.ts$/.test(f)&&!/\.d\.ts$/.test(f))||/^[^/]+\.html$/.test(f)).map(f=>'src/'+f),
  ...filesUnder(path.join(ROOT,'public')).filter(f=>/\.js$/.test(f)&&!f.startsWith('vendor/')).map(f=>'public/'+f),
];
const unread=pageNames().flatMap(p=>pageModules(p)).filter(m=>!FILES.includes('src/'+m));

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
for(const name of FILES){
  const src=fs.readFileSync(path.join(ROOT,name),'utf8');
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
for(const m of new Set(unread)) bad.push(`src/${m}  a module of a page that this check doesn't read`);
bad.forEach(b=>console.log('FAIL '+b+'\n     a random or argument-less comparator is engine-dependent; shuffle with shuffleP(arr, rnd), then sort by a real key'));
console.log(`${checked} sort comparators checked · ${bad.length} random or argument-less`);
process.exit(bad.length?1:0);
