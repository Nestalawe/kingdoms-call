// The hostile-name harness (P0-19): the strings a staged game gives every player-chosen field, and the checks every
// rendered screen must pass. Screen tours (which page, which world, which screens) are in lib/screens.js.
//
//   names('hostile')  (field, i) → the field's name and number, then every payload below, so one string tries them all
//                     and a leak says where it came from. Its .hostile is true: a tour then makes stored numbers hostile
//                     too;
//   names('ordinary') (field, i) → a plain name with apostrophes, accents or hyphens (no < or &, which now show as
//                     typed: the one change players can see). Used to show a converted page looks the same.
//   inspect(doc)      what a screen got wrong: a value that became an element (<img onerror>, <svg onload>, <b>, a
//                     <script>), a value that became code in a handler, or a handler that no longer parses.
// jsdom never loads images, so onerror never fires there; window.__kcPwned is only a real check in Chromium.
const acorn=require('acorn');

const PAYLOADS=[
  `"><img src=x onerror="window.__kcPwned=1">`,
  `'><img src=x onerror='window.__kcPwned=1'>`,
  `<b data-kc-bold>bold</b>`,
  `Tom &amp; Jerry & <`,
  '`${window.__kcPwned=1}`',
  `');window.__kcPwned=1;//`,
  `\\" onmouseover="window.__kcPwned=1`,
  `</td></tr></table><svg onload="window.__kcPwned=1">`,
  `<script>window.__kcPwned=1</script>`,
];
const ORDINARY=["Ser Brann's Keep",'Élodie of Vær','Mire-Hold',"The O'Rourke Marches",'Kaelith the Grey','Dún Aisling',
  'Thornmere',"Warden's Rest",'Ashen Reach','Lady Brígh of the Fens'];

function names(kind){
  if(kind==='hostile') return Object.assign((field,i=0)=>`${field}${i} `+PAYLOADS.join(' '),{hostile:true});
  let n=0; const given=new Map();
  // the same field and number always gets the same name, and different ones differ
  return (field,i=0)=>{ const k=field+'#'+i; if(!given.has(k)) given.set(k,`${ORDINARY[n%ORDINARY.length]} ${Math.floor(n++/ORDINARY.length)||''}`.trim()); return given.get(k); };
}

// True if the parsed handler reads or writes __kcPwned as code (a mention inside a string is fine: kcArg puts names there).
function usesPwned(node){
  if(!node||typeof node.type!=='string') return false;
  if(node.type==='Identifier'&&node.name==='__kcPwned') return true;
  for(const k of Object.keys(node)){
    if(k==='loc') continue;
    const v=node[k];
    if(Array.isArray(v)?v.some(usesPwned):(v&&typeof v.type==='string'&&usesPwned(v))) return true;
  }
  return false;
}

function inspect(doc){
  const out=[];
  doc.querySelectorAll('img[onerror],svg[onload],[data-kc-bold]').forEach(e=>
    out.push(`a value became an element: ${e.outerHTML.slice(0,90)}`));
  doc.querySelectorAll('script').forEach(e=>{ if(/__kcPwned/.test(e.textContent)) out.push(`a value became a <script>: ${e.outerHTML.slice(0,90)}`); });
  for(const e of doc.querySelectorAll('*')){
    for(const a of e.attributes){
      if(!/^on/i.test(a.name)) continue;
      let ast;
      try{ ast=acorn.parse(a.value,{ecmaVersion:'latest',sourceType:'script',allowReturnOutsideFunction:true}); }
      catch(err){ out.push(`a handler doesn't parse: <${e.tagName.toLowerCase()} ${a.name}="${a.value.slice(0,90)}">: ${err.message}`); continue; }
      if(usesPwned(ast)) out.push(`a value became code in a handler: <${e.tagName.toLowerCase()} ${a.name}="${a.value.slice(0,90)}">`);
    }
  }
  return out;
}

// One page's hostile-name test: every mode and screen of its tour (lib/screens.js) with hostile names, in jsdom (nothing
// becomes markup or code, no handler breaks, every staged name appears as text exactly as typed) and in Chromium
// (window.__kcPwned stays unset, with images really loading and failing). Exits the process with the result.
async function hostileTest(tourName){
  const {TOURS,runJsdom,runChromium}=require('./screens');
  const tour=TOURS[tourName], W=tour.world(names('hostile'));
  let fails=0;
  const check=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } else console.log('ok   '+m); };
  const seen=new Set(), want=tour.shown(W).filter(Boolean);
  // A page that can't start (a mode with bootError) must say so; every other mode runs with no page error at all.
  const checkErrors=(mode,errs,where)=>tour.modes[mode].bootError
    ?check(errs.length>0,`${where}${tour.page} (${mode}): the page fails to start, as staged`)
    :check(!errs.length,`${where}${tour.page} (${mode}): no page errors`+(errs.length?': '+errs[0].split('\n')[0]:''));
  for(const mode of Object.keys(tour.modes)){
    const errs=await runJsdom(tour,mode,W,(label,doc,w)=>{
      const problems=inspect(doc);
      const pwned=!!w.__kcPwned; w.__kcPwned=undefined;
      check(!problems.length&&!pwned,`${tour.page} (${mode}) ${label}: names show as text`+(problems.length?`: ${problems.length} problem(s), e.g. ${problems[0]}`:''));
      const text=doc.body.textContent;
      want.forEach(s=>{ if(text.includes(s)) seen.add(s); });
    });
    checkErrors(mode,errs,'');
  }
  const missing=want.filter(s=>!seen.has(s));
  check(!missing.length,`${tour.page}: each of the ${want.length} staged names appears somewhere, exactly as typed`+(missing.length?`; not found: ${missing.map(s=>s.split(' ')[0]).join(', ')}`:''));
  const {chromium}=require('playwright');
  const browser=await chromium.launch();
  for(const mode of Object.keys(tour.modes)){
    const errs=await runChromium(browser,tour,mode,W,async(label,p)=>{
      // cleared after each screen, so a failure names the screen that set it
      const r=await p.evaluate(()=>{ const pwned=!!window.__kcPwned; window.__kcPwned=undefined; return {pwned,made:document.querySelectorAll('img[onerror],svg[onload],[data-kc-bold]').length}; });
      check(!r.pwned&&!r.made,`Chromium: ${tour.page} (${mode}) ${label}: names show as text`+(r.pwned?' (window.__kcPwned was set)':'')+(r.made?` (${r.made} element(s) made from a name)`:''));
    });
    checkErrors(mode,errs,'Chromium: ');
  }
  await browser.close();
  console.log(fails?`\nFAILURES: ${fails}`:'\n0 failures');
  process.exit(fails?1:0);
}

module.exports={PAYLOADS,ORDINARY,names,inspect,hostileTest};
