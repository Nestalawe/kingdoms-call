// Kingdoms Call — headless engine fuzz for the 2026-09-27 (v…-1753) changes.
// Boots the real GM portal under jsdom with a Supabase stub and runs whole turns of all-bot games,
// then hammers personal combat. Watches for: any throw out of runTurn, any uncaught window error,
// and NaN / undefined leaking into battle narrative. Also samples the Orcish war-spoils discount
// the wage pass actually charged (p._lastWages.orcSpoilsG) so items 8 & 9 are exercised live.
//
//   node tests/fuzz-wages-combat.test.js [gm-portal.html] [games] [turns] [bots] [fights]
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const GMF=process.argv[2]||'kingdoms-call-gm-portal.html'; const GAMES=+process.argv[3]||3, TURNS=+process.argv[4]||10, BOTS=+process.argv[5]||5, FIGHTS=+process.argv[6]||4000;
let html=readPage(GMF);
const inj=(a,b)=>{ if(html.split(a).length!==2) throw new Error('anchor not unique: '+a.slice(0,50)); html=html.replace(a,b); };
inj("  // 4. Run all 5 phases\n","  window.__PC={resolvePersonalCombat,pcCharCombatant,pcBuildGuardian,pcMeleeDamage,autoEncounterPlan,getG:()=>G};\n  // 4. Run all 5 phases\n");

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
  let turns=0,crashes=0;
  let orcTurns=0, orcSaved=0, orcRealms=0;
  for(let g=0;g<GAMES;g++){
    const setup=W.generateBotSetups([],BOTS,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
    // force at least one Orcish realm per game so the war-spoils path is actually taken
    setup[0].race='Orcish';
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
      (S2.players||[]).forEach(p=>{ const lw=p&&p._lastWages; if(!lw) return;
        if(p.race==='Orcish'){ orcRealms++; if(lw.orcSpoilsG>0){ orcTurns++; orcSaved+=lw.orcSpoilsG; } }
        if(!Number.isInteger(lw.armyWages)||lw.armyWages<0){ crashes++; console.log('BAD armyWages',p.name,lw.armyWages); }
        if(!Number.isInteger(lw.orcSpoilsG||0)||(lw.orcSpoilsG||0)<0){ crashes++; console.log('BAD orcSpoilsG',p.name,lw.orcSpoilsG); }
      });
      turns++; S=S2;
    }
  }
  console.log(`engine: turns=${turns} crashes=${crashes} uncaught errors=${errors.length}`);
  console.log(`orc war-spoils: ${orcRealms} Orcish realm-turns, ${orcTurns} of them earned the discount, ${orcSaved}g saved in total (all integers, all >=0)`);
  // ── personal combat ──
  const P=W.__PC; const MON=W.eval('MONSTERS_P'); let fc=0, fbad=0;
  for(let i=0;i<FIGHTS;i++){
    const m0=JSON.parse(JSON.stringify(MON[i%MON.length])); m0._hpFull=m0.hp;
    const lv=1+(i%9);
    const hc={id:'fz'+i,name:'Fz',player:null,alive:true,hp:20+lv*6,maxHp:20+lv*6,race:['Human','Elven','Dwarven','Orcish'][i%4],temper:['Berserk','Brave','Cautious','Cowardly'][i%4],skills:{white:Math.min(9,lv),melee:(i*7)%10,archery:(i*3)%10},items:[],armies:[]};
    hc.encounterPlan={tactics:['MA','AR','MA','MA','MA'],duelStance:'accept'};
    const feature={name:'Ruin',monster:m0,hoardItems:[]};
    try{
      const hero=P.pcCharCombatant(hc); hero.tactics=hc.encounterPlan.tactics.slice(); hero._vsGuardian=true;
      const mon=P.pcBuildGuardian(feature,JSON.parse(JSON.stringify(m0)),[]);
      const res=P.resolvePersonalCombat(hero,mon,{maxRounds:20,feature});
      const txt=(res&&res.narrative||[]).map(x=>typeof x==='string'?x:(x&&x.text)||'').join('\n');
      if(/NaN|undefined/.test(txt)){ fbad++; if(fbad<4) console.log('BAD TEXT', txt.split('\n').filter(l=>/NaN|undefined/.test(l)).slice(0,2)); }
      fc++;
    }catch(e){ fbad++; if(fbad<4) console.log('fight threw', e.stack.split('\n').slice(0,3).join(' | ')); }
  }
  console.log(`combat: fights=${fc} crashes/bad=${fbad}`);
  errors.slice(0,6).forEach(e=>console.log('  !',e.split('\n').slice(0,3).join(' | ')));
  process.exit(crashes||errors.length||fbad?1:0);
})();
