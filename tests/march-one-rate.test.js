// 2026-10-13 (item 14) — March and Naval have one rate of advance: the old "slow column" ladder
// (+0/+0/+1/+1/+2/+3 at levels 0–5) for every unit, whatever its base move. The "fast column"
// ladder (+0/+1/+1/+2/+2/+2) is gone. Flyers (every winged unit, the riders and the flying beasts)
// gain nothing from March.
// Checked in the four places the rate is worked out: the engine's move pools (computeMovePoolMax,
// nested inside runTurn, so a real turn is run first and the hook at "  // 4. Run all 5 phases"
// hands it back), the Naval helper (navalSpeedBonus), the turn report's per-unit move rates
// (buildTurnReport, which the orders form shows) and the bots' reach (botLandReach, botSeaReach).
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const quiet=(errs)=>(w)=>{
  w.addEventListener('error',e=>errs.push(String(e.error&&e.error.stack||e.message)));
  w.console.error=(...a)=>{ const t=a.map(String).join(' '); if(/Could not load|stub|fetch/i.test(t)) return; errs.push('console.error: '+t); };
  w.console.warn=()=>{}; w.console.log=()=>{}; };
const LADDER=[0,0,1,1,2,3];
(async()=>{
  const errs=[];
  let html=readPage('kingdoms-call-gm-portal.html');
  const a="  // 4. Run all 5 phases\n";
  if(html.split(a).length!==2){ console.log('anchor not unique or missing: '+a); process.exit(1); }
  html=html.replace(a,"  window.__MP={computeMovePoolMax};\n"+a);
  let ROWS={}; const WRITES=[];
  const d=bootJsdom(html,{supabase:{createClient:()=>cannedStub({rows:()=>ROWS,writes:WRITES})},setup:quiet(errs)});
  await new Promise(r=>setTimeout(r,500)); const W=d.window;
  if(typeof W.runTurn!=='function'){ console.log('GM portal did not boot'); errs.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  const setup=W.generateBotSetups([],2,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
  const S=await W.generateNewGame(setup,{cols:10,rows:6},{seaPct:20});
  const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:null,player_index:sp.id,display_name:sp.name,orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})}));
  ROWS={games_one:{id:'gd',name:'T',turn:1,status:'active',game_state:JSON.stringify(S),max_turns:999,game_players:players},game_players_list:players,turn_logs_list:[]};
  W.eval(`currentGame={id:'gd',turn:1,status:'active',name:'T'};`);
  await W.runTurn(); await new Promise(r=>setTimeout(r,10));
  const MP=W.__MP; if(!MP||typeof MP.computeMovePoolMax!=='function'){ console.log('hook missing: computeMovePoolMax not exposed'); process.exit(1); }

  const SPEED=W.eval('ARMY_SPEED_MASTER');
  ok(SPEED['Free Lances']===4&&SPEED['Shieldwall Levies']===2&&SPEED['Galleon Fleet']===3&&SPEED['Thunderbirds']===5,'the base moves this test relies on (Free Lances 4, Levies 2, Galleons 3, Thunderbirds 5)');
  // A hero with no items, titles or discoveries: his pools are his column's base move plus the ladder.
  const hero=(types,skills)=>({id:'tst',name:'Tester',player:null,alive:true,skills:{march:0,naval:0,...skills},items:[],
    armies:types.map(t=>({type:t,quality:'Average',unitName:'the '+t}))});
  for(let lv=0;lv<=5;lv++){
    const fl=MP.computeMovePoolMax(hero(['Free Lances'],{march:lv}));
    ok(fl.land===4+LADDER[lv],`March ${lv}: Free Lances (base 4) march at ${4+LADDER[lv]} (engine says ${fl.land})`);
    const lv2=MP.computeMovePoolMax(hero(['Shieldwall Levies'],{march:lv}));
    ok(lv2.land===2+LADDER[lv],`March ${lv}: Levies (base 2) march at ${2+LADDER[lv]} (engine says ${lv2.land})`);
    const gal=MP.computeMovePoolMax(hero(['Galleon Fleet'],{naval:lv}));
    ok(gal.sea===3+LADDER[lv],`Naval ${lv}: a Galleon Fleet (base 3) sails at ${3+LADDER[lv]} (engine says ${gal.sea})`);
    ok(W.navalSpeedBonus(4,lv)===LADDER[lv]&&W.navalSpeedBonus(2,lv)===LADDER[lv],`Naval ${lv}: navalSpeedBonus is +${LADDER[lv]} for fast and slow hulls alike`);
  }
  const tb=MP.computeMovePoolMax(hero(['Thunderbirds'],{march:5}));
  ok(tb.land===5,`March 5 does not speed Thunderbirds, a flying beast (engine says ${tb.land})`);
  const er=MP.computeMovePoolMax(hero(['Eagle Riders'],{march:5}));
  ok(er.land===5,`…nor Eagle Riders (engine says ${er.land})`);

  // The turn report (what the orders form shows): per-unit move rates and the column's pace.
  const king=S.characters.find(c=>c.alive&&c.player===0&&c.isKing);
  king.skills.march=5; king.items=[];
  king.armies=[{type:'Free Lances',quality:'Average',unitName:'the Test Lances'},{type:'Thunderbirds',quality:'Average',unitName:'the Test Wing'}];
  const rep=W.buildTurnReport(S,0); const kr=rep.characters.find(c=>c.id===king.id);
  const rate=t=>((kr&&kr.armies||[]).find(x=>x.type===t)||{}).moveRate;
  ok(rate('Free Lances')===4+LADDER[5],`the report's Free Lances move ${4+LADDER[5]} at March 5 (says ${rate('Free Lances')})`);
  ok(rate('Thunderbirds')===5,`the report's Thunderbirds move 5 at March 5 (says ${rate('Thunderbirds')})`);

  // The bots plan with the same ladder.
  ok(W.botLandReach({armies:[{type:'Free Lances'}],skills:{march:1}})===4,`a bot's Free Lances at March 1 reach 4 (says ${W.botLandReach({armies:[{type:'Free Lances'}],skills:{march:1}})})`);
  ok(W.botLandReach({armies:[{type:'Shieldwall Levies'}],skills:{march:5}})===5,'a bot\'s Levies at March 5 reach 5');
  ok(W.botSeaReach({armies:[{type:'Galleon Fleet'}],skills:{naval:1}})===3,`a bot's Galleons at Naval 1 reach 3 (says ${W.botSeaReach({armies:[{type:'Galleon Fleet'}],skills:{naval:1}})})`);

  // The words: no page still offers a fast-column ladder.
  const rules=readPage('kingdoms-call-rules.html'), pp=readPage('kingdoms-call-player-portal.html');
  ok(!/Fast column|Fast \(base move 3\+\)|\+1\/\+1\/\+2\/\+2\/\+2|\+0\/\+1\/\+1\/\+2\/\+2\/\+2/.test(rules+pp),'no page still quotes the fast-column ladder');
  const ex=/leading base-4 Free Lances, at <strong>(\d)<\/strong>/.exec(rules);
  ok(!!ex&&+ex[1]===4+LADDER[5],`the rulebook's March-5 Free Lances example says ${4+LADDER[5]} (says ${ex&&ex[1]})`);

  console.log(`\n${pass} pass, ${fail} fail · page errors ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log('  ! '+e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errs.length?1:0);
})();
