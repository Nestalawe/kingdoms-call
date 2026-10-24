// 2026-09-27 (item 6) — does another realm's private business turn up in your report?
// Runs real all-bot games, captures EVERY per-realm turn_report the engine writes, and runs the
// report-leak check (lib/report-leaks.ts, P1-04c) on each turn: no realm reads
// another realm's private line, names a realm it hasn't met, or sees a hero under Invisibility, and every line a realm
// reads comes from an event of the turn whose audience admits it (the audience check: the turn's events are recorded
// as they are emitted, scenarioInTheVm's recordTheEvents, and handed to the check as `perception`).
// It also counts how many DIFFERENT realms were shown the same line.
// The games are played in the engine's bare vm, as the shell plays them (tests/lib/scenario-in-the-vm.ts). Until plan
// P1-09a they were played on the booted GM portal, its buildReports wrapped from outside.
const {scenarioInTheVm}=require('./lib/scenario-in-the-vm.ts');
const {checkLeaks,describeBreaches}=require('./lib/invariants.ts');
const GAMES=+process.argv[2]||3, TURNS=+process.argv[3]||10, BOTS=+process.argv[4]||5;
const errors=[];
// Lines that are ONE realm's own business are the leak check's PRIVATE_LINES (lib/report-leaks.ts).
// Lines an onlooker standing in the province may legitimately see — counted, not failed.
const WATCHED=[
  ['Harvest the Field',       /💀 Harvest the Field/],
  ['Consecrate',              /consecrates /],
  ['Skeletal Armies',         /calls forth .* rises from the graves/],
];
(async()=>{
  const sc=scenarioInTheVm({seed:1}), W=sc.W;
  // Reports are only built for HUMAN slots; an all-bot game therefore writes none. Build one for
  // EVERY realm so the visibility filter can be measured on real bot activity.
  sc.reportEveryRealm();
  // record each turn's events with their audiences, so the leak check's audience check runs (r.perception)
  sc.recordTheEvents();
  const seenBy={};   // line text -> Set of player indices shown it
  let turns=0, reportsSeen=0, linesSeen=0, unrecorded=0; const leaks=[];
  for(let g=0;g<GAMES;g++){
    const setup=W.generateBotSetups([],BOTS,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
    let S=await W.generateNewGame(setup,{cols:12,rows:7},999,{seaPct:35+5*g}); S.botDifficulty='hard'; S.botDiplomacy='normal';
    const players=setup.map(sp=>({id:sp.gamePlayerId,user_id:null,player_index:sp.id,display_name:sp.name,orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})}));
    const byGp={}; players.forEach(p=>byGp[p.id]=p.player_index);
    for(let t=1;t<=TURNS;t++){
      let r; try{ r=sc.play(S,players); }catch(e){ console.log('the turn threw',e.message); errors.push(String(e.stack||e)); break; }
      // each realm's report, as the shell writes it to turn_logs with the realm's player_index
      Object.entries(r.reports).forEach(([pi,rep])=>{
        reportsSeen++; (rep.lastTurnLog||[]).forEach(e=>{ linesSeen++; const k=`g${g}t${t}|${e.text}`; (seenBy[k]=seenBy[k]||new Set()).add(+pi); });
      });
      const before=S; S=JSON.parse(JSON.stringify(r.S2)); turns++;
      const broke=checkLeaks({before,after:S,gmLog:r.log,
        telemetry:[],players:[],reports:Object.entries(r.reports).map(([realm,report])=>({realm:+realm,report})),perception:r.perception});
      if(!r.perception) unrecorded++;
      if(broke.length) leaks.push(describeBreaches(`game ${g} turn ${t}`,broke));
    }
  }
  let fail=0;
  console.log(`realm reports scanned: ${reportsSeen} reports, ${linesSeen} chronicle lines, over ${turns} resolved turns`);
  { const multi=Object.values(seenBy).filter(x=>x.size>1).length; console.log(`distinct lines: ${Object.keys(seenBy).length}; lines shown to MORE THAN ONE realm: ${multi}\n`); }
  WATCHED.forEach(([label,re])=>{
    const hits=Object.entries(seenBy).filter(([k])=>re.test(k));
    console.log(`[watched] ${label.padEnd(20)} events=${String(hits.length).padStart(4)}  shown to more than one realm=${hits.filter(([,s])=>s.size>1).length}`);
  });
  fail=leaks.length; leaks.slice(0,5).forEach(l=>console.log('  ✗ '+l.split('\n').join('\n    ')));
  // the audience check runs only on a turn whose events were recorded
  if(unrecorded){ fail++; console.log(`  ✗ ${unrecorded} turn(s) handed over no recorded events: the audience check did not run on them`); }
  // every realm, bots' too, gets a report each resolved turn (reportEveryRealm), or there is nothing to check
  if(reportsSeen!==turns*BOTS){ fail++; console.log(`  ✗ ${reportsSeen} realm reports written over ${turns} turns; expected one a realm a turn (${turns*BOTS})`); }
  console.log(fail===0?'\nOK — no report leaked':`\nFAIL — ${leaks.length} turn(s) leaked`);
  errors.slice(0,3).forEach(e=>console.log('  !',e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errors.length?1:0);
})();
