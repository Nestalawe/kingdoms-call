// Same for ordinary names (P0-19): renders every screen of a page's tour (tests/lib/screens.js) with ordinary names
// (apostrophes, accents, hyphens) on two copies of the site, and says whether each screen's DOM is the same. A proof run
// by hand for a pull request that converts a page to kcHtml, with its output in the PR; not part of npm test (it compares
// against another copy of the site, which CI doesn't have).
//
//   git archive main site | tar -x -C /tmp/main      # main's site, as a folder
//   node tests/tools/same-dom.js /tmp/main/site                      # main against this branch, every tour
//   node tests/tools/same-dom.js /tmp/main/site site leaderboard     # one tour
//
// The DOM is compared as parsed, so text escaped differently but read the same (' or &#39;) counts as the same. Ignored:
// script and style contents, build stamps (v2026.10.16-1200, with or without the v), and how a string passed to a handler is
// quoted (kcArg writes "O'Rourke" where the old code wrote 'O\'Rourke': each string in a handler is compared by its value).
// Exits 1 if any screen differs.
const path=require('path');
const acorn=require('acorn');
const {TOURS,runJsdom}=require('../lib/screens');
const {names}=require('../lib/hostile');

const [before,after='site',...only]=process.argv.slice(2);
if(!before){ console.log('usage: node tests/tools/same-dom.js <before-site> [<after-site>] [tour…]'); process.exit(2); }
const STAMP=/v?\d{4}\.\d{2}\.\d{2}-\d{4}/g;

// A handler's code with every string written the same way (JSON), so only what it does is compared. Code that doesn't
// parse is left as it is.
function sameQuotes(code){
  try{
    let out=[];
    for(const t of acorn.tokenizer(code,{ecmaVersion:'latest',allowReturnOutsideFunction:true}))
      out.push(t.type.label==='string'?JSON.stringify(t.value):code.slice(t.start,t.end));
    return out.join(' ');
  }catch(e){ return code; }
}

// One line per element and text, in document order; attributes sorted.
function lines(node,depth=0,out=[]){
  const pad='  '.repeat(depth);
  for(const c of node.childNodes){
    if(c.nodeType===3){ if(c.data.trim()||c.data.includes(' ')) out.push(pad+JSON.stringify(c.data.replace(STAMP,'v<stamp>'))); continue; }
    if(c.nodeType!==1) continue;
    const tag=c.tagName.toLowerCase();
    const attrs=[...c.attributes].map(a=>{
      let v=a.value.replace(STAMP,'v<stamp>');
      if(/^on/i.test(a.name)) v=sameQuotes(v);
      return `${a.name}=${JSON.stringify(v)}`;
    }).sort();
    out.push(`${pad}<${tag}${attrs.length?' '+attrs.join(' '):''}>`);
    if(tag!=='script'&&tag!=='style') lines(c,depth+1,out);
  }
  return out;
}

(async()=>{
  let differ=0, screens=0;
  const tours=only.length?only:Object.keys(TOURS);
  for(const t of tours){
    const tour=TOURS[t];
    if(!tour){ console.log(`no tour "${t}"; there are: ${Object.keys(TOURS).join(', ')}`); process.exit(2); }
    const W=tour.world(names('ordinary'));
    for(const mode of Object.keys(tour.modes)){
      const shots={before:[],after:[]};
      for(const [side,site] of [['before',before],['after',after]]){
        const errs=await runJsdom(tour,mode,W,(label,doc)=>{ shots[side].push({label,lines:lines(doc.body)}); },{site:path.resolve(site)});
        if(errs.length) console.log(`  (${side}: ${errs.length} page error(s), e.g. ${errs[0].split('\n')[0]})`);
      }
      shots.before.forEach((b,i)=>{
        const a=shots.after[i]; screens++;
        const n=Math.max(b.lines.length,a.lines.length);
        let at=-1; for(let k=0;k<n;k++) if(b.lines[k]!==a.lines[k]){ at=k; break; }
        if(at<0){ console.log(`same       ${tour.page} (${mode}) ${b.label}: ${b.lines.length} nodes`); return; }
        differ++;
        console.log(`DIFFERENT  ${tour.page} (${mode}) ${b.label}, from node ${at+1}:`);
        console.log('   before: '+(b.lines[at]||'(nothing)').trim().slice(0,220));
        console.log('   after:  '+(a.lines[at]||'(nothing)').trim().slice(0,220));
      });
    }
  }
  console.log(differ?`\n${differ} of ${screens} screens differ`:`\nall ${screens} screens are the same`);
  process.exit(differ?1:0);
})();
