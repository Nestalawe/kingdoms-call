// Kingdoms Call — headless fuzz for v2026.09.27-2331: advance-and-strike combat, unmet-realm masking,
// archive meta round-trip. Boots the real GM portal under jsdom with a Supabase stub. Its advance-and-strike combat
// fuzz is tests/unit/fuzz-personal-combat.test.ts (plan P1-08f).
//   node tests/fuzz-advance-masking.test.js [gm-portal.html] [games] [turns] [bots]
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const GMF=process.argv[2]||'kingdoms-call-gm-portal.html'; const GAMES=+process.argv[3]||3, TURNS=+process.argv[4]||10, BOTS=+process.argv[5]||5;
const html=readPage(GMF);
let ROWS={}; const WRITES=[];
const sbStub=()=>cannedStub({rows:()=>ROWS,writes:WRITES});
const errors=[];
const dom=bootJsdom(html,{supabase:{createClient:()=>sbStub()},
  setup(w){
    w.addEventListener('error',e=>errors.push('GM: '+(e.error&&e.error.stack||e.message)));
    w.onunhandledrejection=e=>errors.push('GM rejection: '+(e.reason&&e.reason.stack||e.reason));
    w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errors.push('console.error: '+t); };
    w.console.warn=()=>{}; w.console.log=()=>{};}});
(async()=>{
  await new Promise(r=>setTimeout(r,600)); const W=dom.window;
  if(typeof W.runTurn!=='function'){ console.log('ENGINE DID NOT BOOT'); errors.slice(0,5).forEach(e=>console.log(e)); process.exit(1); }
  let turns=0,crashes=0,leakChecks=0,leaks=0,unmetSeen=0,masked=0,badLine=0;
  for(let g=0;g<GAMES;g++){
    const setup=W.generateBotSetups([],BOTS,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
    let S=await W.generateNewGame(setup,{cols:12,rows:7},999,{seaPct:35+10*g}); S.botDifficulty='hard'; S.botDiplomacy=(g%2?'hostile':'normal');
    const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:null,player_index:sp.id,display_name:sp.name,orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})}));
    for(let t=1;t<=TURNS;t++){
      ROWS={games_one:{id:'g'+g,name:'T',turn:t,status:'active',game_state:JSON.stringify(S),max_turns:999},game_players_list:players,turn_logs_list:[]};
      W.eval(`currentGame={id:'g${g}',turn:${t},status:'active',name:'T'};`); WRITES.length=0;
      try{ await W.runTurn(); }catch(e){ crashes++; console.log(`runTurn threw g${g} t${t}: ${e.stack}`); break; }
      await new Promise(r=>setTimeout(r,10));
      const gsW=[...WRITES].reverse().find(w=>w.table==='games'&&w.val&&w.val.game_state);
      const S2=gsW?JSON.parse(gsW.val.game_state):null;
      if(!S2){ crashes++; console.log(`no state written g${g} t${t}`); errors.slice(-3).forEach(e=>console.log('  !',e.split('\n').slice(0,4).join(' | '))); break; }
      // ── broadcast-line masking in the WRITTEN reports ──
      WRITES.filter(w=>w.table==='game_players'&&w.val&&w.val.turn_report).forEach(w=>{ let r; try{ r=JSON.parse(w.val.turn_report); }catch(e){ return; }
        (r.lastTurnLog||[]).forEach(l=>{ if(typeof l.text!=='string'){ return; } if(/unknown realm/.test(l.text)) masked++; if(/NaN|undefined/.test(l.text)) { badLine++; if(badLine<3) console.log('BAD LOG LINE',l.text.slice(0,200)); } }); });
      // ── unmet-realm leak check on every realm's titles payload ──
      for(let pi=0;pi<(S2.players||[]).length;pi++){
        let rep; try{ rep=W.buildTurnReport(W.playerView(S2,pi)); }catch(e){ crashes++; console.log('buildTurnReport threw',e.stack.split('\n').slice(0,3).join(' | ')); continue; }
        const T=rep&&rep.titles; if(!T||!T.public||T.gameOver) continue;
        const met=new Set([pi,...((S2.players[pi]._encountered)||[])]);
        const unmetNames=(S2.players||[]).map((p,i)=>met.has(i)?null:p.name).filter(Boolean);
        // EXACT field values only — bot names can be "X" and "X II", so substring matching gives false hits.
        const unmetSet=new Set(unmetNames); const vals=[];
        (T.standings||[]).forEach(s=>vals.push(['standings',s.name]));
        Object.values(T.holders||{}).forEach(h=>{ vals.push(['holder',h.holderName]); });
        ((T.minor&&T.minor.all)||[]).forEach(x=>vals.push(['minor',x.kingdomName]));
        (T.losses||[]).forEach(l=>vals.push(['loss',l.newHolderName]));
        if(T.reckoning) vals.push(['reckoning',T.reckoning.byName]);
        // a name that ALSO belongs to a met realm is ambiguous, not a leak
        const metNames=new Set((S2.players||[]).map((p,i)=>met.has(i)?p.name:null).filter(Boolean));
        leakChecks++;
        vals.forEach(([k,v])=>{ if(v&&unmetSet.has(v)&&!metNames.has(v)){ leaks++; if(leaks<4) console.log(`LEAK ${k}: realm ${pi} sees unmet "${v}" (turn ${t})`); } });
        // character names of unmet realms' heroes must not be named as title holders either
        const unmetCharNames=new Set((S2.characters||[]).filter(c=>c&&c.player!=null&&!met.has(c.player)).map(c=>c.name));
        const metCharNames=new Set((S2.characters||[]).filter(c=>c&&(c.player==null||met.has(c.player))).map(c=>c.name));
        Object.values(T.holders||{}).forEach(h=>{ if(h.charName&&unmetCharNames.has(h.charName)&&!metCharNames.has(h.charName)){ leaks++; if(leaks<4) console.log(`LEAK charName: realm ${pi} sees unmet hero "${h.charName}"`); } });
        ((T.minor&&T.minor.all)||[]).forEach(x=>{ if(x.holderName&&unmetCharNames.has(x.holderName)&&!metCharNames.has(x.holderName)){ leaks++; if(leaks<4) console.log(`LEAK minor holder: "${x.holderName}"`); } });
        (T.standings||[]).forEach(s=>{ if(s.unmet) unmetSeen++; });
      }
      turns++; S=S2;
    }
  }
  console.log(`engine: turns=${turns} crashes=${crashes} uncaught errors=${errors.length}`);
  console.log(`broadcast lines masked in written reports=${masked}, NaN/undefined log lines=${badLine}`);
  console.log(`titles masking: ${leakChecks} realm-reports checked, ${unmetSeen} unmet standings rows masked, leaks=${leaks}`);
  // ── archive meta round-trip ──
  let archBad=0;
  try{
    const m1=W.buildGameMeta({archived:true,archivedAt:'2026-09-27T10:00:00Z',turnMode:{mode:'manual'}});
    if(!m1.archived||m1.archivedAt!=='2026-09-27T10:00:00Z') archBad++;
    if(!W.gameArchived({meta:m1})) archBad++;
    if(W.gameArchived({meta:W.buildGameMeta({})})) archBad++;
    if(!W.gameArchived({game_state:JSON.stringify({archived:true})})) archBad++;   // no-meta fallback
    if(W.gameArchived({game_state:'{}'})) archBad++;
  }catch(e){ archBad++; console.log('archive threw',e.stack); }
  console.log(`archive meta round-trip: bad=${archBad}`);
  errors.slice(0,6).forEach(e=>console.log('  !',e.split('\n').slice(0,3).join(' | ')));
  process.exit(crashes||errors.length||leaks||archBad?1:0);
})();
