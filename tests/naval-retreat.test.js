// 2026-09-27 (item 3) — the naval retreat split, staged and fuzzed on the REAL engine.
const {readPage,bootJsdom}=require('./lib/boot'); const {cannedStub}=require('./lib/stub-db');
const GMF=process.argv[2]||'kingdoms-call-gm-portal.html';
let html=readPage(GMF);
const anchor="  // 4. Run all 5 phases\n";
if(html.split(anchor).length!==2) throw new Error('anchor');
html=html.replace(anchor,"  window.__NR={G,navalSplitRetreat,retreatOptions,getSeaCapability,seaLiftShortfall,pickStrandedUnits,getNeighborsP,setG:(s)=>{G=s;},setPhase:(p)=>{_currentPhase=p;_logCtx.phase=p;}};\n"+anchor);
let ROWS={}; const WRITES=[];
const sbStub=()=>cannedStub({rows:()=>ROWS,writes:WRITES});
const errors=[];
const dom=bootJsdom(html,{supabase:{createClient:()=>sbStub()},
  setup(w){
    w.addEventListener('error',e=>errors.push(String(e.error&&e.error.stack||e.message)));
    w.console.error=(...a)=>errors.push('console.error: '+a.map(String).join(' '));
    w.console.warn=()=>{}; w.console.log=()=>{};}});
let pass=0, fail=0;
const ok=(cond,msg)=>{ if(cond) pass++; else { fail++; console.log('  ✗ '+msg); } };
(async()=>{
  await new Promise(r=>setTimeout(r,500)); const W=dom.window;
  if(typeof W.runTurn!=='function'){ console.log('engine did not boot'); errors.slice(0,3).forEach(e=>console.log(e)); process.exit(1); }
  // Build a real world, then drive ONE turn far enough to expose the runTurn-scope helpers.
  const setup=W.generateBotSetups([],3,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
  const S=await W.generateNewGame(setup,{cols:12,rows:7},999,{seaPct:45});
  // reach the helpers: runTurn exports them on window when it reaches phase resolution, but we can
  // avoid a full turn by evaluating the hook directly — the portal parks __NR the moment runTurn
  // gets to the phase loop, so run one turn against the stub and keep the handles.
  W.eval(`currentGame={id:'g',turn:1,status:'active',name:'T'};`);
  ROWS={games_one:{id:'g',name:'T',turn:1,status:'active',game_state:JSON.stringify(S),max_turns:999},
        game_players_list:setup.map(sp=>({id:sp.gamePlayerId,user_id:null,player_index:sp.id,display_name:sp.name,orders:null,orders_submitted:false,turn_report:JSON.stringify({isBot:true})})),
        turn_logs_list:[]};
  await W.runTurn(); await new Promise(r=>setTimeout(r,20));
  const NR=W.__NR; if(!NR){ console.log('helpers not exported'); process.exit(1); }
  const G=NR.G;
  const neigh=(p)=>NR.getNeighborsP(p,G.world.cols,G.world.rows,G.world.provinces);
  const unit=(type,q)=>({type,quality:q||'Average',race:'Human',unitName:null});
  // Find a coastal LAND province with at least one sea neighbour and one other land neighbour.
  const site=G.world.provinces.find(p=>p&&p.terrain!=='sea'&&neigh(p).some(n=>n.terrain==='sea')&&neigh(p).some(n=>n.terrain!=='sea'));
  if(!site){ console.log('no coastal test site on this map'); process.exit(1); }
  const seaN=neigh(site).find(n=>n.terrain==='sea');
  const landN=neigh(site).find(n=>n.terrain!=='sea');
  const PI=0;
  const reset=(opts)=>{
    // clean slate: nobody owns anything near the site except as the scenario says
    neigh(site).concat([site]).forEach(p=>{ p.owner=null; p.garrisonArmies=[]; p.characters=[]; p.neutralDefenders=[]; delete p._battleUnresolved; delete p._flood; });
    site.owner=opts.siteOwned?PI:null;
    if(opts.friendlySea) seaN.owner=PI;
    if(opts.friendlyLand) landN.owner=PI;
    G.mercenaries=[];
    const ch={id:9001,name:'Admiral Test',player:PI,alive:true,hp:20,maxHp:20,race:'Human',temper:'Brave',skills:{},items:[],armies:opts.armies.slice(),location:site.id,_attackedFrom:null};
    G.characters=(G.characters||[]).filter(c=>c.id!==9001); G.characters.push(ch);
    site.characters=[ch.id];
    return ch;
  };
  const liveUnits=(ch)=>({inArmy:ch.armies.length,
    siteGar:(site.garrisonArmies||[]).length, landGar:(landN.garrisonArmies||[]).length,
    seaGar:(seaN.garrisonArmies||[]).length, mercs:(G.mercenaries||[]).length});

  console.log('— staged cases —');
  // A: hulls carry everything, friendly sea alongside
  { const ch=reset({siteOwned:true,friendlySea:true,friendlyLand:true,armies:[unit('Galleon Fleet'),unit('Galleon Fleet'),unit('Shieldwall Levies')]});
    const narr=[]; const r=NR.navalSplitRetreat(ch,site,ch.armies,narr,'Admiral Test');
    ok(r==='left',`A: whole force sails (got '${r}')`);
    ok(ch.location===seaN.id,'A: hero is at sea');
    ok(ch.armies.length===3,`A: nothing left behind (${ch.armies.length}/3 aboard)`);
    ok(!site._battleUnresolved,'A: province is not left contested'); }
  // B: too much foot for the hulls, friendly sea AND own land alongside
  { const ch=reset({siteOwned:true,friendlySea:true,friendlyLand:true,armies:[unit('Galleon Fleet'),unit('Gilded Lances'),unit('Gilded Lances'),unit('Gilded Lances'),unit('Gilded Lances')]});
    const narr=[]; const r=NR.navalSplitRetreat(ch,site,ch.armies,narr,'Admiral Test');
    const st=liveUnits(ch);
    ok(r==='left',`B: fleet sails and the rest falls back overland (got '${r}')`);
    ok(ch.location===seaN.id,'B: hero sails with the fleet');
    ok(st.landGar>0,`B: the units that would not fit joined ${landN.name}'s garrison (${st.landGar})`);
    ok(st.inArmy+st.landGar===5,`B: no unit lost (${st.inArmy}+${st.landGar} of 5)`);
    ok(NR.seaLiftShortfall(ch.armies,ch)===0,'B: what sailed can actually be carried'); }
  // C: too much foot, friendly sea, NO friendly land — the rest holds the ground
  { const ch=reset({siteOwned:true,friendlySea:true,friendlyLand:false,armies:[unit('Galleon Fleet'),unit('Gilded Lances'),unit('Gilded Lances'),unit('Gilded Lances'),unit('Gilded Lances')]});
    const narr=[]; const r=NR.navalSplitRetreat(ch,site,ch.armies,narr,'Admiral Test');
    const st=liveUnits(ch);
    ok(r==='stay',`C: some stay and fight again (got '${r}')`);
    ok(ch.location===seaN.id,'C: hero still sails');
    ok(st.siteGar>0,`C: the leftovers hold ${site.name} (${st.siteGar})`);
    ok(!!site._battleUnresolved,'C: the province is still contested');
    ok(st.inArmy+st.siteGar===5,'C: no unit lost'); }
  // D: no friendly water, friendly land — hero and foot march, ships stay
  { const ch=reset({siteOwned:true,friendlySea:false,friendlyLand:true,armies:[unit('Galleon Fleet'),unit('Shieldwall Levies'),unit('Yeoman Longbows')]});
    const narr=[]; const r=NR.navalSplitRetreat(ch,site,ch.armies,narr,'Admiral Test');
    const st=liveUnits(ch);
    ok(r==='stay',`D: the ships stay to keep fighting (got '${r}')`);
    ok(ch.location===landN.id,'D: hero and land units retreat overland');
    ok(ch.armies.length===2&&!ch.armies.some(a=>a.type==='Galleon Fleet'),'D: the hulls did not march inland');
    ok(st.siteGar===1,'D: the hulls hold the coast');
    ok(!!site._battleUnresolved,'D: the province is still contested'); }
  // E: a fleet alone with nowhere to sail
  { const ch=reset({siteOwned:true,friendlySea:false,friendlyLand:true,armies:[unit('Galleon Fleet'),unit('Galleon Fleet')]});
    const narr=[]; const r=NR.navalSplitRetreat(ch,site,ch.armies,narr,'Admiral Test');
    ok(r==='stay',`E: ships with no water to reach stay and fight (got '${r}')`);
    ok(ch.location===site.id,'E: the hero stays with his fleet');
    ok(ch.armies.length===2,'E: the fleet is intact');
    ok(!!site._battleUnresolved,'E: the province is still contested'); }
  // F: no ships at all — the ordinary retreat must handle it
  { const ch=reset({siteOwned:true,friendlySea:true,friendlyLand:true,armies:[unit('Shieldwall Levies'),unit('Gilded Lances')]});
    const before=JSON.stringify({loc:ch.location,n:ch.armies.length});
    const narr=[]; const r=NR.navalSplitRetreat(ch,site,ch.armies,narr,'Admiral Test');
    ok(r==='','F: a force with no ships is left to the ordinary retreat');
    ok(JSON.stringify({loc:ch.location,n:ch.armies.length})===before,'F: nothing was moved');
    ok(narr.length===0,'F: nothing was reported'); }
  // G: ships + foot, nowhere friendly at all
  { const ch=reset({siteOwned:true,friendlySea:false,friendlyLand:false,armies:[unit('Galleon Fleet'),unit('Shieldwall Levies')]});
    const before=JSON.stringify({loc:ch.location,n:ch.armies.length});
    const narr=[]; const r=NR.navalSplitRetreat(ch,site,ch.armies,narr,'Admiral Test');
    ok(r==='','G: no friendly ground of any kind — the ordinary rules decide');
    ok(JSON.stringify({loc:ch.location,n:ch.armies.length})===before,'G: nothing was moved'); }
  // H: thrown back off an ENEMY coast — the hero sails, the leaderless rest cannot join an enemy garrison
  { const ch=reset({siteOwned:false,friendlySea:true,friendlyLand:false,armies:[unit('Orcish Longships'),unit('Gilded Lances'),unit('Gilded Lances'),unit('Gilded Lances')]});
    site.owner=1;
    const narr=[]; const r=NR.navalSplitRetreat(ch,site,ch.armies,narr,'Admiral Test');
    const st=liveUnits(ch);
    ok(ch.location===seaN.id,'H: the hero gets away to sea');
    ok(st.siteGar===0,'H: nothing was handed to the enemy garrison');
    ok(st.mercs>0,'H: the men left on a hostile shore scatter as mercenaries');
    ok(st.inArmy+st.mercs===4,'H: no unit vanished'); }
  // noSea (Cut the Line) closes the water
  { const ch=reset({siteOwned:true,friendlySea:true,friendlyLand:true,armies:[unit('Galleon Fleet'),unit('Shieldwall Levies')]});
    const narr=[]; const r=NR.navalSplitRetreat(ch,site,ch.armies,narr,'Admiral Test',true);
    ok(ch.location===landN.id,'Cut the Line: with the sea lanes closed the column goes overland');
    ok(r==='stay','Cut the Line: the ships are left behind'); }

  // ── fuzz: random coastal forces, no crashes and no units conjured or lost ──
  const TYPES=['Galleon Fleet','Corsair Fleet','Elven Galleys','Dwarf Ironclads','Orcish Longships','Whale Cohort','Kraken Tentacles',
    'Shieldwall Levies','Yeoman Longbows','Gilded Lances','Free Lances','Dwarven Guard','Mountain Guns','Eagle Riders','Wyvern Riders','Forest Ents','Stone Giants'];
  const Q=['Green','Average','Veteran','Crack','Elite'];
  let fz=0, crash=0, lost=0;
  const sites=G.world.provinces.filter(p=>p&&p.terrain!=='sea'&&neigh(p).some(n=>n.terrain==='sea'));
  for(let i=0;i<4000;i++){
    const sp=sites[i%sites.length]; const nb=neigh(sp);
    const sN=nb.filter(n=>n.terrain==='sea'), lN=nb.filter(n=>n.terrain!=='sea');
    nb.concat([sp]).forEach(p=>{ p.owner=null; p.garrisonArmies=[]; p.characters=[]; p.neutralDefenders=[]; delete p._battleUnresolved; delete p._flood; });
    if(i%3===0) sp.owner=PI; else if(i%3===1) sp.owner=1;
    if(i%2===0&&sN.length) sN[i%sN.length].owner=PI;
    if(i%5<2&&lN.length) lN[i%lN.length].owner=PI;
    G.mercenaries=[];
    const n=1+(i%6); const armies=[]; for(let k=0;k<n;k++) armies.push({type:TYPES[(i*7+k*3)%TYPES.length],quality:Q[(i+k)%5],race:'Human'});
    const ch={id:9002,name:'Fz',player:PI,alive:true,hp:20,maxHp:20,race:'Human',temper:'Brave',skills:{},items:[],armies:armies.slice(),location:sp.id,_attackedFrom:(i%4===0&&sN.length)?sN[0].id:null};
    G.characters=(G.characters||[]).filter(c=>c.id!==9002); G.characters.push(ch);
    sp.characters=[ch.id];
    try{
      const narr=[]; NR.navalSplitRetreat(ch,sp,ch.armies,narr,'Fz',i%7===0);
      const after=ch.armies.length+nb.reduce((s,p)=>s+(p.garrisonArmies||[]).length,0)+(sp.garrisonArmies||[]).length+(G.mercenaries||[]).length;
      if(after!==n) { lost++; if(lost<4) console.log(`  ✗ fuzz conservation: started ${n}, ended ${after}`); }
      if(narr.some(l=>/undefined|NaN/.test(String(l)))) { crash++; if(crash<4) console.log('  ✗ bad line', narr.find(l=>/undefined|NaN/.test(String(l)))); }
      fz++;
    }catch(e){ crash++; if(crash<4) console.log('  ✗ threw', e.stack.split('\n').slice(0,3).join(' | ')); }
  }
  console.log(`fuzz: ${fz} staged coastal retreats — throws/bad lines ${crash}, unit-conservation failures ${lost}`);
  ok(crash===0,'fuzz: no crashes and no malformed lines');
  ok(lost===0,'fuzz: every unit ends up somewhere');
  console.log(`\n${pass} pass, ${fail} fail, ${errors.length} page error(s)`);
  errors.slice(0,3).forEach(e=>console.log('  !',e.split('\n').slice(0,2).join(' | ')));
  process.exit(fail||errors.length?1:0);
})();
