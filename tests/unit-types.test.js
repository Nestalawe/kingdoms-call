// 2026-10-11 (Toby, the army roster work) — Unit types. Every army unit has ONE of five types —
// infantry, ranged, cavalry, flyer, naval — in the shared table KC_UNIT_TYPE (kingdoms-call-data.ts).
// The engine's rules still run on the KC_UNIT_CLASS lists (their order is data); this table is the
// vocabulary the portals, rulebooks and reports use, and the battle-line work builds on it.
// Level 1 (unit). A lower level can't do it: the agreement between the type table and the class lists
// is a property of the data, not of any one line of text.
//   1. KC_UNIT_TYPE exists, is non-empty, and every value is one of the five types.
//   2. Every unit with a base strength (KC_UNIT_BASE_STR: humanoid, fleet, primal, elemental) has a type.
//   3. The table agrees with the class lists: cavalry ↔ 'cavalry', sea ↔ 'naval', aerial ↔ 'flyer',
//      missile ↔ 'ranged', garrison → 'infantry'. (Until the army roster of 2026-10-11 the Goblin Horde
//      was the one exception: infantry that loosed spears in the archery step. The spears are retired.)
//   4. Both portals demand KC_UNIT_TYPE from the data file (the stamp guard), and each has a helper that
//      answers 'infantry' for a type it has never heard of (old saves and test fixtures name such types).
const fs=require('fs'), vm=require('vm');
const {sitePath,readPage,bootJsdom}=require('./lib/boot'); const {nullStub}=require('./lib/stub-db');
const {compactPage,scriptOf}=require('./lib/source.ts');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const TYPES=['infantry','ranged','cavalry','flyer','naval'];

(async()=>{
  // 1–3: the data file on its own.
  // the data file from src/, run as a script (tests/lib/source.ts; until plan P1-09a it was read from site/)
  const src=scriptOf('content/kingdoms-call-data.ts');
  const D=vm.runInNewContext(src+'\n;({T:(typeof KC_UNIT_TYPE==="undefined")?undefined:KC_UNIT_TYPE, S:KC_UNIT_BASE_STR, C:KC_UNIT_CLASS})',{});
  const T=D.T||{}, S=D.S||{}, C=D.C||{};
  ok(D.T&&typeof D.T==='object'&&Object.keys(T).length>0,'KC_UNIT_TYPE is declared in kingdoms-call-data.ts and is not empty');
  ok(Object.keys(S).length>20&&Array.isArray(C.cavalry)&&C.cavalry.length>0,'KC_UNIT_BASE_STR and KC_UNIT_CLASS were read (non-empty)');
  const bad=Object.entries(T).filter(([,v])=>!TYPES.includes(v)).map(([k,v])=>`${k}: ${v}`);
  ok(bad.length===0,'every type is one of '+TYPES.join(', ')+(bad.length?' — not: '+bad.join('; '):''));
  const untyped=Object.keys(S).filter(u=>!T[u]);
  ok(untyped.length===0,'every unit in KC_UNIT_BASE_STR has a type'+(untyped.length?' — missing: '+untyped.join(', '):''));
  const typed=t=>Object.keys(T).filter(u=>T[u]===t);
  const all=(list,t,label)=>{ const wrong=(list||[]).filter(u=>T[u]!==t); ok(wrong.length===0,`${label} are all '${t}'`+(wrong.length?' — not: '+wrong.join(', '):'')); };
  const within=(t,list,label)=>{ const set=new Set(list||[]); const wrong=typed(t).filter(u=>!set.has(u)); ok(wrong.length===0,`every '${t}' unit is in KC_UNIT_CLASS.${label}`+(wrong.length?' — not: '+wrong.join(', '):'')); };
  all(C.cavalry,'cavalry','KC_UNIT_CLASS.cavalry'); within('cavalry',C.cavalry,'cavalry');
  all(C.sea,'naval','KC_UNIT_CLASS.sea');          within('naval',C.sea,'sea');
  all(C.aerial,'flyer','KC_UNIT_CLASS.aerial');    within('flyer',C.aerial,'aerial');
  all(C.missile,'ranged','KC_UNIT_CLASS.missile'); within('ranged',C.missile,'missile');
  all(C.garrison,'infantry','KC_UNIT_CLASS.garrison');
  ok(T['Goblin Horde']==='infantry'&&!(C.missile||[]).includes('Goblin Horde'),'Goblin Horde is plain infantry (its thrown spears were retired with the army roster, 2026-10-11)');

  // 4: the portals.
  // the portals' code in one layout, by its syntax tree (until plan P1-09a, the built pages' text)
  const gm=compactPage('kingdoms-call-gm-portal.html'), pp=compactPage('kingdoms-call-player-portal.html');
  const gmList=(/KC_SHARED_TABLE_NAMES=\[([^\]]*)\]/.exec(gm)||[])[1]||'', ppList=(/const need=\[([^\]]*)\]/.exec(pp)||[])[1]||'';
  ok(/'KC_UNIT_TYPE'/.test(gmList),"the GM portal's KC_SHARED_TABLE_NAMES includes 'KC_UNIT_TYPE' (the data-file guard)");
  ok(/'KC_UNIT_TYPE'/.test(ppList),"the player portal's required-table list includes 'KC_UNIT_TYPE' (the data-file guard)");
  for(const [page,helper] of [['kingdoms-call-gm-portal.html','unitTypeOf'],['kingdoms-call-player-portal.html','unitTypeOfP']]){
    const errors=[];
    const dom=bootJsdom(readPage(page),{supabase:{createClient:()=>nullStub()},url:'https://example.org/'+page,
      setup(w){ w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message))); w.console.error=()=>{}; w.console.warn=()=>{}; w.console.log=()=>{}; }});
    await new Promise(r=>setTimeout(r,1200));
    const w=dom.window; const ev=expr=>{ try{ return w.eval(expr); }catch(e){ return 'THREW: '+e.message; } };
    ok(errors.length===0,`${page} boots without an error`+(errors.length?' — '+errors[0].split('\n')[0]:''));
    ok(ev(`typeof ${helper}`)==='function',`${page} declares ${helper}()`);
    ok(ev(`${helper}('Yeoman Longbows')`)==='ranged',`${helper}('Yeoman Longbows') is 'ranged'`);
    ok(ev(`${helper}('Elven Galleys')`)==='naval',`${helper}('Elven Galleys') is 'naval'`);
    ok(ev(`${helper}('Light Infantry')`)==='infantry',`${helper}('Light Infantry') (an unknown type) is 'infantry'`);
    ok(ev(`${helper}(undefined)`)==='infantry',`${helper}(undefined) is 'infantry'`);
    dom.window.close();
  }
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
