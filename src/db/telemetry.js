// ── SNAPSHOT of one realm's situation, from a parsed game state. Module level: uses only module-level
// helpers (unitBaseStrength, relOfReport, consecratedIds), so buildGameResultRows can call it on any
// loaded state, not just inside runTurn.
function telRealmSnapshot(gs, pi){
  const pl=(gs&&gs.players||[])[pi]; if(!pl) return null;
  const provs=(gs.world&&gs.world.provinces)||[];
  const owned=provs.filter(p=>p&&p.owner===pi);
  const chars=(gs.characters||[]).filter(c=>c&&c.player===pi&&c.alive);
  const king=chars.find(c=>c.isKing)||null;
  const unitRec=a=>({t:a.type,q:a.quality||'Average',...(a._isSkeletal?{sk:1}:{})});
  let ledUnits=0, ledStr=0, garUnits=0, garStr=0;
  const characters=chars.map(c=>{
    const units=(c.armies||[]).filter(a=>a&&!a._phantom);
    units.forEach(a=>{ ledUnits++; ledStr+=unitBaseStrength(a); });
    const pv=(c.location!=null)?provs[c.location]:null;
    const skills={}; Object.entries(c.skills||{}).forEach(([k,v])=>{ if(v>0) skills[k]=v; });
    return {id:c.id, name:c.name, king:!!c.isKing, loc:c.location, terrain:pv?pv.terrain:null, home:!!(pv&&pv.owner===pi),
      hp:c.hp, maxHp:c.maxHp, skills, units:units.map(unitRec), items:(c.items||[]).map(it=>it&&it.name).filter(Boolean)};
  });
  owned.forEach(p=>(p.garrisonArmies||[]).forEach(a=>{ if(a){ garUnits++; garStr+=unitBaseStrength(a); } }));
  // heroes who fell THIS turn, as they were at death (the Hall of Fame counts their peaks; no totals
  // above include them). Units and items are what death left on them, usually nothing.
  const fallen=(gs.characters||[]).filter(c=>c&&c.player===pi&&!c.alive&&c.killedThisTurn).map(c=>{
    const skills={}; Object.entries(c.skills||{}).forEach(([k,v])=>{ if(v>0) skills[k]=v; });
    return {id:c.id, name:c.name, king:!!c.isKing, fell:1, hp:0, maxHp:c.maxHp, skills,
      units:(c.armies||[]).filter(a=>a&&!a._phantom).map(unitRec), items:(c.items||[]).map(it=>it&&it.name).filter(Boolean)};
  });
  const tax=owned.reduce((s,p)=>s+(p.tax||0),0);
  const worldTax=provs.reduce((s,p)=>s+((p&&p.tax)||0),0);
  const rel={enemies:[],allies:[]};
  (gs.players||[]).forEach((o,oi)=>{ if(oi===pi||!o) return; const r=relOfReport(gs,pi,oi); if(r==='enemy') rel.enemies.push(oi); else if(r==='allied') rel.allies.push(oi); });
  const explored=provs.filter(p=>p&&Array.isArray(p.visitedBy)&&p.visitedBy.includes(pi)).length;
  const legNames=(typeof LEGENDARY_NAMES_P!=='undefined')?LEGENDARY_NAMES_P:new Set();
  let items=0, relics=0; chars.forEach(c=>(c.items||[]).forEach(it=>{ if(!it) return; items++; if(legNames.has(it.name)) relics++; }));
  return {
    gold:Math.round(pl.gold||0), provinces:owned.length, land:owned.filter(p=>p.terrain!=='sea').length, sea:owned.filter(p=>p.terrain==='sea').length,
    tax, taxShare:worldTax>0?Math.round(1000*tax/worldTax)/10:0,
    chars:chars.length, heroes:chars.length-(king?1:0), kingAlive:!!king, kingHp:king?king.hp:null,
    ledUnits, ledStr:Math.round(ledStr), garUnits, garStr:Math.round(garStr), units:ledUnits+garUnits, str:Math.round(ledStr+garStr),
    items, relics, discoveries:(pl.discoveries||[]).length, consecrated:consecratedIds(pl).length,
    explored, conceded:!!pl.conceded, eliminated:!!pl._eliminated, rel, characters,
    ...(fallen.length?{fallen}:{}),
  };
}
// The orders a realm gave this turn, as resolved by runTurn's ingestion (humans' submitted orders,
// bots' planned ones, Defend for anything missing). One entry per living character, five phases each.
function telOrdersFor(gs, pi, extras){
  const chars=(gs.characters||[]).filter(c=>c&&c.player===pi&&c.alive);
  const byChar={};
  chars.forEach(c=>{
    const slots=(gs.turnOrders||{})[c.id]||[];
    byChar[c.id]={name:c.name, king:!!c.isKing, ph:[0,1,2,3,4].map(i=>{
      const o=slots[i]; if(!o) return {a:'defend'};
      const r={a:String(o.action||'defend').toLowerCase()};
      if(o.target!=null&&o.target!=='') r.t=String(o.target).slice(0,80);
      if(o.extra!=null&&o.extra!=='') r.x=String(o.extra).slice(0,80);
      if(o.desc) r.d=String(o.desc).slice(0,140);
      if(o._pinned) r.pinned=1;
      if(o._unifiedWith!=null) r.unified=o._unifiedWith;
      return r;
    })};
  });
  const out={chars:byChar};
  if(extras){ Object.entries(extras).forEach(([k,v])=>{ if(v!==undefined&&v!==null&&!(Array.isArray(v)&&!v.length)&&!(typeof v==='object'&&!Array.isArray(v)&&!Object.keys(v).length)) out[k]=v; }); }
  return out;
}
// Final standings order: score, then tax base, then treasury (the Reckoning tie-break).
function telRankOrder(gs){
  const s=computeStandings(gs);
  const idx=s.standings.map(st=>st.index);
  idx.sort((a,b)=>(s.standings[b].score-s.standings[a].score)||((s.taxByPlayer[b]||0)-(s.taxByPlayer[a]||0))||((s.goldByPlayer[b]||0)-(s.goldByPlayer[a]||0)));
  const rank={}; idx.forEach((pi,i)=>{ rank[pi]=i+1; });
  return {rank, standings:s};
}
function telBotDifficultyOf(gs){ return (gs&&gs.botDifficulty)||'hard'; } // 2026-09-26: 'hard' is the only strength now; older saves keep whatever word they carry
// One game_results row per realm, from a FINISHED state (gs.gameOver set). `players` = game_players rows.
function buildGameResultRows(gs, gameRow, players){
  if(!gs||!gs.players) return [];
  const bots=new Set((players||[]).filter(isBotRow).map(p=>p.player_index));
  const {rank}=telRankOrder(gs);
  const go=gs.gameOver||{};
  const victory=go.byReckoning?'reckoning':go.byElimination?'elimination':go.byConcession?'concession':(gs.gameOver?'other':'unfinished');
  const setup={mapSize:gs.mapSize||((gameMetaOf(gameRow)||{}).mapSize)||null, cols:gs.world&&gs.world.cols, rows:gs.world&&gs.world.rows, seaPct:gs.seaPct!=null?gs.seaPct:(gs.world&&gs.world.seaPct), realms:gs.players.length, bots:bots.size, humans:gs.players.length-bots.size, difficulty:telBotDifficultyOf(gs), diplomacy:(gs.botDiplomacy==='hostile'?'hostile':'normal')};
  return gs.players.map((pl,pi)=>{
    if(!pl) return null;
    const snap=telRealmSnapshot(gs,pi);
    let outTurn=null, outHow=null;
    if(pl.conceded){ outTurn=pl.concededTurn||null; outHow='conceded'; }
    else if(pl._eliminated){ outTurn=pl._eliminatedTurn||null; outHow='eliminated'; }
    return {
      game_id:String(gameRow.id), game_name:gameRow.name||null, player_index:pi,
      is_bot:bots.has(pi), bot_difficulty:bots.has(pi)?telBotDifficultyOf(gs):null,
      realm:pl.name||null, race:pl.race||null, alignment:pl.alignment||null,
      rank:rank[pi]||null, score:Math.round(((gs.gameOver&&gs.gameOver.standings)||[]).find(s=>s&&s.index===pi)?.score??0),
      winner:(go.winner===pi), victory, turns:(go.turn||gs.turn||0), out_turn:outTurn, out_how:outHow,
      setup, final:snap, build:`GM ${KC_BUILD_STAMP} tel${KC_TEL_V}`,
    };
  }).filter(Boolean);
}
// Record the results of a finished game (idempotent — upsert on game_id + player_index).
async function writeGameResults(gs, gameRow, players){
  if(!_kcHasTel) return false;
  const rows=buildGameResultRows(gs, gameRow, players);
  if(!rows.length) return false;
  const {error}=await sb.from('game_results').upsert(rows,{onConflict:'game_id,player_index'});
  if(error){ _kcTelLastErr=error.message; renderTelemetryBanner(); return false; }
  return true;
}
// One-off / repair: any of this GM's COMPLETE games with no game_results rows gets them now.
async function backfillGameResults(){
  if(!_kcHasTel||!currentUser) return 0;
  try{
    const {data:games,error}=await sb.from('games').select('id,name,status').eq('gm_user_id',currentUser.id).eq('status','complete');
    if(error||!games||!games.length) return 0;
    const {data:have}=await sb.from('game_results').select('game_id').in('game_id',games.map(g=>String(g.id)));
    const done=new Set((have||[]).map(r=>r.game_id));
    let n=0;
    for(const g of games){
      if(done.has(String(g.id))) continue;
      const {data:full}=await sb.from('games').select('id,name,game_state,game_players(*)').eq('id',g.id).single();
      if(!full) continue;
      const gs=parseGameState(full); if(!gs||!gs.players) continue;
      if(await writeGameResults(gs, full, full.game_players||[])) n++;
    }
    if(n) console.log(`[telemetry] recorded results for ${n} finished game(s)`);
    return n;
  }catch(e){ return 0; }
}
// The per-realm view of what the collectors caught this turn, plus the before/after deltas.
function telOutcomesFor(gs, pi, tel, pre, post, rank){
  const B=(tel.battles||[]).filter(b=>b.atkPi===pi||b.defPi===pi);
  const mine=b=>b.atkPi===pi;
  const battles={fought:B.length, asAttacker:B.filter(mine).length, won:B.filter(b=>mine(b)?b.won:!b.won).length,
    unitsLost:B.reduce((s,b)=>s+(mine(b)?b.atkLost:b.defLost),0), unitsKilled:B.reduce((s,b)=>s+(mine(b)?b.defLost:b.atkLost),0),
    list:B.map(b=>({...b, side:mine(b)?'atk':'def', win:mine(b)?b.won:!b.won}))};
  const E=(tel.encounters||[]).filter(e=>e.pi===pi);
  const encounters={fought:E.length, won:E.filter(e=>e.won).length, fled:E.filter(e=>e.fled).length, heroKilled:E.filter(e=>e.killed).length, list:E};
  const C=(tel.captures||[]).filter(c=>c.from===pi||c.to===pi);
  const captures={gained:C.filter(c=>c.to===pi).length, lost:C.filter(c=>c.from===pi).length, list:C};
  const D=(tel.deaths||[]).filter(d=>d.pi===pi||d.killerPi===pi);
  const deaths={own:D.filter(d=>d.pi===pi).length, king:D.some(d=>d.pi===pi&&d.king), killed:D.filter(d=>d.killerPi===pi&&d.pi!==pi).length, list:D};
  const S=(tel.spells||[]).filter(x=>x.pi===pi);
  const spells={cast:S.length, ok:S.filter(x=>x.ok).length, list:S};
  const d=(k)=>(post&&pre&&post[k]!=null&&pre[k]!=null)?(post[k]-pre[k]):null;
  return {battles, encounters, captures, deaths, spells,
    delta:{gold:d('gold'), provinces:d('provinces'), tax:d('tax'), units:d('units'), str:d('str'), heroes:d('heroes'), items:d('items'), discoveries:d('discoveries'), explored:d('explored')},
    rank:rank||null, score:post&&post._score!=null?post._score:null};
}
async function writeTurnTelemetry(gs, gameRow, players, tel, turn){
  if(!_kcHasTel||!gs||!gs.players) return false;
  const bots=new Set((players||[]).filter(isBotRow).map(p=>p.player_index));
  const {rank, standings}=telRankOrder(gs);
  const rows=[];
  gs.players.forEach((pl,pi)=>{
    if(!pl) return;
    const post=telRealmSnapshot(gs,pi); if(post) post._score=(standings.standings[pi]||{}).score||0;
    // the Imperial Titles this realm holds now (2026-10-09, Toby item 5) — the Hall of Fame keeps the
    // highest rating each holder reached, not only the holders at the end of the game
    if(post){ const held=[]; (TITLE_DEFS||[]).forEach(t=>{ const h=(standings.titles||{})[t.key];
      if(!h||h.playerIndex!==pi||!(h.merit>0)) return;
      const ch=h.charId!=null?(gs.characters||[]).find(c=>c&&c.id===h.charId):null;
      held.push({key:t.key, merit:Math.round(h.merit*100)/100, who:ch?ch.name:null}); });
      if(held.length) post.titles=held; }
    const pre=(tel.pre||{})[pi]||null;
    rows.push({ game_id:String(gameRow.id), turn, player_index:pi,
      is_bot:bots.has(pi), bot_difficulty:bots.has(pi)?telBotDifficultyOf(gs):null,
      realm:pl.name||null, race:pl.race||null, alignment:pl.alignment||null,
      orders:(tel.orders||{})[pi]||null, pre, post,
      outcomes:telOutcomesFor(gs,pi,tel,pre,post,rank[pi]),
      build:`GM ${KC_BUILD_STAMP} tel${KC_TEL_V}` });
  });
  const {error}=await sb.from('turn_events').upsert(rows,{onConflict:'game_id,turn,player_index'});
  if(error){ _kcTelLastErr=error.message; renderTelemetryBanner(); return false; }
  _kcTelLastErr=null;
  if(gs.gameOver){
    await writeGameResults(gs, gameRow, players);
    try{ await writeGameRecord(gameRow.id,{gameRow, players, gs}); }catch(_le){}   // Hall of Fame (2026-09-27)
  }
  return true;
}
