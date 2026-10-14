// 2026-10-13 (item 16) — cast orders assume that every Practice order earlier in the turn succeeds,
// in how many spells the hero may cast. The order form's Cast Spell list already does (item 2,
// tests/cast-practice-projection); this test covers the rest:
//   Scenario (level 2): the engine. A cast refused because a practice had not yet raised the school
//     (or by the casting limit) is never worked, so it spends no casting slot: a White 0 hero who
//     practises (fails), casts (refused), practises (succeeds) and casts again works that last
//     spell. The practice rolls are fixed through a hook on the practice roll.
//   Unit (level 1): the bots' order check (runBotOrderHygiene, botCastLimit) counts a bot's earlier
//     practice orders the same way, so it no longer strikes out a cast that relies on one.
//   Page (level 4): the encounter plan's combat-spell picker. A Psychic 1 hero practising Psychic is
//     offered two combat spells of the school (Psychic 2's allowance), and adding the second is
//     accepted rather than refused at the current level's one.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db'); const {bootScenario,order,plan}=require('./lib/scenario');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const ROLL="            const _prRoll=d100();\n";
(async()=>{
  // ── The engine ──
  const sc=await bootScenario({inject:[[ROLL,"            const _prRoll=(window.__PR&&window.__PR.length)?window.__PR.shift():d100();\n"]]});
  const W=sc.W;
  let hero;
  W.__PR=[100,1];   // first practice fails, second succeeds
  const r=await sc.turn({realms:2,
    prepare(S){ hero=S.characters.find(c=>c.alive&&c.player===0&&c.isKing); hero.skills.white=0; hero.items=[]; return hero; },
    orders:(S,h)=>({[h.id]:plan(order('practice','white'),order('cast_spell','Bless Province',h.location),order('practice','white'),order('cast_spell','Bless Province',h.location),order('rest'))})});
  const t=r.text(hero.id);
  ok(/lacks the required White Magic skill/.test(t),'the Summer cast is refused: the Spring practice failed');
  // Read from the practice line itself: since 2026-10-14 (batch item 11) the Winter cast, if it fizzles,
  // is a small chance at White too, so the level at the end of the turn depends on that roll.
  ok(/practises White Magic and improves to level 1!/.test(t),'the Autumn practice raises White to 1');
  ok(!/casting limit/.test(t),`the Winter cast is not blocked by a casting limit (${(t.match(/[^\n]*casting limit[^\n]*/)||[''])[0]})`);
  ok(/casts Bless Province \(White Magic 1\)/.test(t),'the Winter cast is worked (it is rolled at White Magic 1)');
  if(process.env.KC_DEBUG) console.log(t);
  if(W.__PR.length) ok(false,`both practice rolls were used (${W.__PR.length} left)`);

  // ── The bots' order check ──
  const S=r.S2; const bot=S.characters.find(c=>c.alive&&c.player===1&&c.isKing);
  bot.skills.psychic=2; bot.items=[];
  ok(W.botCastLimit(S,bot,'psychic')===1&&W.botCastLimit(S,bot,'psychic',1)===2&&W.botCastLimit(S,bot,'psychic',2)===3,'botCastLimit counts each earlier practice as a level (Psychic 2: one spell, two after a practice, three after two)');
  S.turnOrders=S.turnOrders||{};
  S.turnOrders[bot.id]=[{action:'practice',target:'psychic',extra:'',desc:''},{action:'cast_spell',target:'Clairvoyance',extra:String(bot.location),desc:''},{action:'cast_spell',target:'Oratory',extra:String(bot.id),desc:''},{action:'rest',target:'',extra:'',desc:''},{action:'rest',target:'',extra:'',desc:''}];
  W.__botHyg={};
  try{ W.runBotOrderHygiene(S,new Set([1])); }catch(e){ ok(false,'runBotOrderHygiene runs: '+e.message); }
  const o=S.turnOrders[bot.id];
  ok(o[1].action==='cast_spell'&&o[2].action==='cast_spell'&&!(W.__botHyg.overLimit>0),`a bot that practises Psychic keeps both later Psychic casts (${o.map(x=>x.action).join(', ')})`);

  // ── The encounter plan's combat spells ──
  const errs=[]; let alerts=[];
  const d=bootJsdom(readPage('kingdoms-call-player-portal.html'),{supabase:{createClient:()=>cannedStub({rows:()=>({}),writes:[]})},
    setup(w){ w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message))); w.console.warn=()=>{}; w.console.log=()=>{}; }});
  await new Promise(res=>setTimeout(res,400)); const P=d.window, doc=P.document; P.alert=m=>alerts.push(String(m));
  const ph={id:'h1',name:'Maelis',player:0,locationId:11,locationName:'Ashford',hp:20,maxHp:20,armies:[],items:[],skills:{psychic:1},effectiveSpeed:3,effectiveSeaSpeed:3,isKing:true};
  P.eval(`currentGamePlayer={id:'gpx',orders:null};`);
  P.eval(`currentReport=${JSON.stringify({turn:3,_liveTurn:3,characters:[ph],kingdom:{gold:100,alignment:'Good'},worldMeta:{provinces:[{id:11,name:'Ashford'}]}})};`);
  P.buildOrdersForm(P.eval('currentReport.characters'),false,{h1:[{action:'Practice Skill',target:'psychic',extra:''},{action:'Rest'},{action:'Rest'},{action:'Rest'},{action:'Rest'}]},3);
  await new Promise(res=>setTimeout(res,80));
  const add=(spell)=>{ P.addEncounterTactic('h1','CA'); const pk=doc.getElementById('ep-spell-picker-h1');
    const b=pk&&[...pk.querySelectorAll('button')].find(x=>x.textContent.trim().startsWith(spell)&&!x.disabled);
    if(!b){ if(pk) pk.remove(); return false; } b.click(); return true; };
  ok(add('Psychic Blast'),'the picker offers Psychic Blast');
  ok(add('Charm'),'with Psychic practised this turn, a second Psychic combat spell is still offered');
  const plan2=(doc.getElementById('ep-tactics-h1')||{}).value||'';
  ok(/CA:Psychic Blast/.test(plan2)&&/CA:Charm/.test(plan2),`…and adding it is accepted (plan: ${plan2})`);
  ok(!alerts.length,`no refusal pops up (${alerts.join(' | ').slice(0,160)})`);
  ok(!add('Telekinetic Storm'),'a third Psychic combat spell is not offered (Psychic 2 allows two)');

  ok(/a <em>Practice Skill<\/em> on the school earlier in the turn that succeeds opens the extra spells/.test(readPage('kingdoms-call-rules.html'))&&/is never worked and spends none of your casts/.test(readPage('kingdoms-call-rules.html')),'the rulebook says practice opens the extra casts and a refused cast spends none');
  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length+sc.errs.length}`);
  errs.concat(sc.errs).slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length||sc.errs.length?1:0);
})().catch(e=>{ console.log(e.stack); process.exit(1); });
