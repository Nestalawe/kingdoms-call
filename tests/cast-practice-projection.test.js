// 2026-10-13 (item 2) — the Cast Spell dropdown counts every Practice Skill order on a school in an
// earlier phase as a success: the level it quotes, and the number of spells it lets the hero cast
// from that school, are the ones the hero may have reached by that phase. Changing an earlier
// Practice or Cast order rebuilds the later Cast Spell dropdowns. Made-up hero; no database.
// The dropdown is built from the live orders form, so this boots the player portal (level 4).
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
(async()=>{
  const errs=[];
  const d=bootJsdom(readPage('kingdoms-call-player-portal.html'),{supabase:{createClient:()=>cannedStub({rows:()=>({}),writes:[]})},
    setup(w){
      w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
      w.console.error=(...a)=>errs.push('console.error: '+a.map(String).join(' '));
      w.console.warn=()=>{};w.console.log=()=>{};}});
  await new Promise(r=>setTimeout(r,400)); const P=d.window, doc=P.document;
  if(typeof P.buildOrdersForm!=='function'){ console.log('player portal: buildOrdersForm not found'); errs.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  // Psychic 2 casts one spell a turn; Psychic 3 casts two. Elemental 5 is as far as practice goes.
  const hero={id:'h1',name:'Maelis',player:0,locationId:11,locationName:'Ashford',hp:20,maxHp:20,armies:[],items:[],
    skills:{psychic:2,elemental:5},effectiveSpeed:3,effectiveSeaSpeed:3,isKing:true};
  P.eval(`currentGamePlayer={id:'gpx',orders:null};`);
  P.eval(`currentReport=${JSON.stringify({turn:3,_liveTurn:3,characters:[hero],kingdom:{gold:100,alignment:'Good'},worldMeta:{provinces:[{id:11,name:'Ashford'}]}})};`);
  P.buildOrdersForm(P.eval('currentReport.characters'),false,null,3);
  await new Promise(r=>setTimeout(r,50));
  const act=(ph,a)=>{ const s=doc.getElementById(`po-action-h1-${ph}`); if(![...s.options].some(o=>o.value===a)) throw new Error(`phase ${ph} offers no ${a}`); s.value=a; P.onActionChange('h1',ph,0); };
  const target=(ph,v,how)=>{ const s=doc.getElementById(`po-target-h1-${ph}`); s.value=v; if(how==='spell') P.onSpellChange('h1',ph,v); else P.rebuildTargetWrap('h1',ph); };
  const opt=(ph,spell)=>{ const s=doc.getElementById(`po-target-h1-${ph}`); return s&&s.options?[...s.options].find(o=>o.value===spell):null; };
  const psy='Charm', ele='Earthquake';

  // Phase 1 Cast, no practice before it: Psychic 2, one spell.
  act(1,'Cast Spell');
  ok(/Lv2 — 0\/1 used/.test((opt(1,psy)||{}).textContent||''),`no practice: Psychic shows Lv2, 0/1 (${(opt(1,psy)||{}).textContent})`);

  // Spring practises Psychic; Summer's dropdown now counts on Psychic 3 (two spells).
  act(0,'Practice Skill'); target(0,'psychic');
  ok(/Lv2→3 if practice succeeds — 0\/2 used/.test((opt(1,psy)||{}).textContent||''),`after a Psychic practice in Spring, Summer's dropdown refreshes to Lv2→3, 0/2 (${(opt(1,psy)||{}).textContent})`);

  // Summer casts Charm; Autumn may still cast a second Psychic spell.
  target(1,psy,'spell');
  act(2,'Cast Spell');
  const o2=opt(2,psy);
  ok(o2&&!o2.disabled&&/1\/2 used/.test(o2.textContent),`with the practice, a second Psychic spell is open in Autumn (${o2&&o2.textContent})`);

  // Elemental 5 can't be practised higher: its limit stays 3 and the label names no rise.
  ok(/Elemental Magic Lv5 — 0\/3 used/.test((opt(2,ele)||{}).textContent||''),`a school at 5 projects no rise (${(opt(2,ele)||{}).textContent})`);

  // Two practices: Psychic 4, three spells.
  act(3,'Practice Skill'); target(3,'psychic'); act(4,'Cast Spell');
  ok(/Lv2→4 if practice succeeds — 2\/3 used/.test((opt(4,psy)||{}).textContent||''),`two practices project Lv4 and three spells (${(opt(4,psy)||{}).textContent})`);

  // Winter's spell and the province it is aimed at survive a rebuild caused by an earlier order.
  target(4,ele,'spell');
  const ex4=()=>doc.getElementById('po-extra-h1-4');
  const hasAsh=!!(ex4()&&ex4().options&&[...ex4().options].some(o=>o.value==='11'));
  ok(hasAsh,'Earthquake in Winter offers Ashford as its target');
  if(hasAsh) ex4().value='11';
  act(3,'Rest'); act(3,'Practice Skill'); target(3,'psychic');
  ok(doc.getElementById('po-target-h1-4').value===ele&&ex4()&&ex4().value==='11',`after an earlier order changes, Winter still casts Earthquake at Ashford (${doc.getElementById('po-target-h1-4').value} → ${ex4()&&ex4().value})`);

  // Spring's practice turned to Rest: Autumn's second Psychic spell closes again at once.
  act(0,'Rest');
  const o2b=opt(2,psy);
  ok(o2b&&o2b.disabled&&/limit reached: 1\/1/.test(o2b.textContent),`without the practice Autumn's Psychic spell is closed again (${o2b&&o2b.textContent})`);
  // …and re-aiming that practice at another school does the same.
  act(0,'Practice Skill'); target(0,'psychic');
  ok(!opt(2,psy).disabled,'Spring back to a Psychic practice reopens it');
  target(0,'elemental');
  ok(opt(2,psy).disabled,'re-aiming Spring\'s practice at Elemental closes it again');

  const html=doc.getElementById('orders-form')?doc.getElementById('orders-form').innerHTML:'';
  ok(!/undefined|NaN|\[object Object\]/.test(html),'no undefined / NaN in the orders form');
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
