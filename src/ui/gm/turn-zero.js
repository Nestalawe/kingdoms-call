// ── TURN 0 — FULL INLINE MAP GENERATION ────
// Embeds the core map/character generation from kingdoms-call-gm.html so the GM portal is fully
// self-contained. Holds the prepared Turn-0 plan (human + bot setups) between the roster preview
// and confirmation.
let _pendingTurn0=null;

async function runTurn0(){
  const msg=document.getElementById('detail-msg');
  msg.innerHTML='<div class="msg-info">⏳ Preparing world setup…</div>';

  // Reload player list fresh
  const {data:players,error:pErr}=await sb.from('game_players').select('*').eq('game_id',currentGame.id);
  if(pErr){
    msg.innerHTML=kcHtml`<div class="msg-error">Could not load players: ${pErr.message}</div>`;return;
  }

  // Read game config from game_state
  let cfg={};
  try{ cfg=typeof currentGame.game_state==='string'?JSON.parse(currentGame.game_state):currentGame.game_state||{}; }catch(e){}
  const mapSize=cfg.mapSize||'p5';
  const maxTurns=cfg.maxTurns||12;
  // ── MAP LADDER ────
  // Every rung is the SMALLEST grid on which generateNewGame's own Phase-1 placement reliably meets
  // its KING_MIN_SPACING=4 floor (>=3 neutral hexes between every pair of capitals) — measured, not
  // guessed: 800 placement runs per grid, every rung at 100%, and 25 full live generations per rung
  // with every world-gen invariant re-checked (22 legendary lairs, <=2 sea and <=1 primal on a home
  // ring, poor + prosperous + own-race neighbours, naval king's sea). Grids one step smaller were
  // rejected for measured spacing failures, e.g. 8p 16x9 (0.4% of worlds) and 6p 13x8 (0.25%). 9
  // and 10 realms share 16x11 because the floor needs 9 eligible rows (rows-2), so rows<11 cannot
  // seat nine capitals at any width. Land per realm now runs 10.5-13.5 (was 14.3-16.0).
  // 2 8x5=40 (was 8x6=48) 3 8x7=56 (was 10x7=70) 4 9x7=63 (was 12x8=96)
  // 5 12x7=84 (was 13x9=117) 6 15x7=105 (was 15x9=135) 7 16x7=112 (was 16x10=160)
  // 8 17x8=136 (was 17x11=187) 9 16x11=176 (was 18x11=198) 10 16x11=176 (was 19x12=228)
  const sizemap={p2:{cols:8,rows:5},p3:{cols:8,rows:7},p4:{cols:9,rows:7},p5:{cols:12,rows:7},p6:{cols:15,rows:7},p7:{cols:16,rows:7},p8:{cols:17,rows:8},p9:{cols:16,rows:11},p10:{cols:16,rows:11}};
  const sz=sizemap[mapSize]||sizemap.p5;
  const {botCount, allBot}=botConfigFor(currentGame);

  // Human setups from joined rows (exclude any leftover bot rows from a prior aborted Turn 0).
  const humanRows=(players||[]).filter(p=>!isBotRow(p));
  const humanSetups=humanRows.map(p=>{
    let setup={};
    try{const r=typeof p.turn_report==='string'?JSON.parse(p.turn_report):p.turn_report||{};setup=r.playerSetup||{};}catch(e){}
    return{
      id:p.player_index,
      gamePlayerId:p.id,
      isBot:false,
      name:p.display_name||`Player ${p.player_index+1}`,
      kingName:setup.kingName||p.display_name||`King ${p.player_index+1}`,
      kingdomName:setup.kingdomName||p.display_name||`Realm ${p.player_index+1}`,
      race:setup.race||'Human',
      alignment:setup.alignment||'Neutral',
      temper:setup.temper||'Brave',
      skills:setup.skills||{},
    };
  }).sort((a,b)=>a.id-b.id);

  // How many bots to generate. All-bot fills every slot; otherwise the configured count.
  const plannedBots=allBot?(currentGame.max_players||0):botCount;
  const totalKingdoms=humanSetups.length+plannedBots;
  if(totalKingdoms<2){
    msg.innerHTML=kcHtml`<div class="msg-error">Need at least 2 realms to start (currently ${humanSetups.length} human${humanSetups.length!==1?'s':''} + ${plannedBots} bot${plannedBots!==1?'s':''}). ${allBot?'Raise Maximum Players.':'Wait for another player to join, or add bots at game creation.'}</div>`;
    return;
  }

  // Bots take the indices immediately AFTER the humans, kept contiguous so generateNewGame's
  // array-position player id == game_players.player_index (reports route by index).
  const startIndex=humanSetups.length;
  const botSetups=plannedBots>0?generateBotSetups(humanSetups, plannedBots, startIndex):[];

  // 2026-09-21: the map rung is chosen for the realm count at game creation, but humans + bots can
  // exceed it (extra joins, bots added). Each rung is the smallest grid that reliably keeps >=3
  // provinces between every pair of capitals, so size the map for the realms actually starting.
  let _szUse=sz, _mapUse=mapSize;
  if(totalKingdoms>(MAP_MAX_PLAYERS[mapSize]||10)){
    _mapUse='p'+Math.min(10,totalKingdoms); _szUse=sizemap[_mapUse]||sz;
    console.warn(`Turn 0: ${totalKingdoms} realms on a ${mapSize} map — using the ${_mapUse} map (${_szUse.cols}x${_szUse.rows}) so capitals stay 3+ provinces apart.`);
  }
  _pendingTurn0={humanSetups, botSetups, sz:_szUse, maxTurns, mapSize:_mapUse, seaPct:normSeaPct(cfg.seaPct), botDifficulty:cfg.botDifficulty||null, botDiplomacy:(cfg.botDiplomacy==='hostile'?'hostile':'normal'), safeStart:!!cfg.safeStart};

  if(botSetups.length>0){
    renderTurn0Preview();      // GM confirms the generated roster before we commit anything
  }else{
    commitTurn0();             // no bots → straight to generation (unchanged behaviour)
  }
}

// Render the Turn-0 roster (humans + generated bots) for GM sanity-check before committing.
function renderTurn0Preview(){
  const msg=document.getElementById('detail-msg');
  if(!_pendingTurn0){ msg.innerHTML=''; return; }
  const {humanSetups, botSetups}=_pendingTurn0;
  const skillStr=s=>Object.entries(s||{}).filter(([,v])=>v>0).map(([k,v])=>`${SKILL_LABELS[k]||k} ${v}`).join(', ')||'—';
  const row=(sp)=>kcHtml`
    <div style="display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;padding:7px 10px;border:1px solid #d8cbb0;border-radius:3px;margin-bottom:6px;background:${sp.isBot?'#f4efe4':'#fff'}">
      <strong style="min-width:150px">${sp.isBot?'🤖 ':''}${sp.kingdomName}</strong>
      <span style="color:var(--stone);font-size:.82rem">${sp.kingName} · ${sp.alignment} · ${sp.race} · ${sp.temper}</span>
      <span style="font-size:.78rem;opacity:.85;margin-left:auto">Skills: ${skillStr(sp.skills)}</span>
    </div>`;
  const humansHtml=humanSetups.length?kcHtml`<div style="font-size:.8rem;color:var(--stone);margin:2px 0 4px">Human players (${humanSetups.length})</div>${humanSetups.map(sp=>row(sp))}`:'';
  const botsHtml=kcHtml`<div style="font-size:.8rem;color:var(--stone);margin:8px 0 4px">🤖 Bot realms (${botSetups.length})</div>${botSetups.map(sp=>row(sp))}`;
  msg.innerHTML=kcHtml`
    <div class="card" style="border-color:var(--crimson)">
      <h3 style="margin-top:0">Confirm the starting roster</h3>
      <div class="msg-info" style="margin-bottom:8px">Review the generated bot realms below. Generate the world to lock them in, or re-roll the bots.</div>
      ${humansHtml}
      ${botsHtml}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-crimson" onclick="commitTurn0()">⚡ Generate World &amp; Start</button>
        <button class="btn btn-gold" onclick="runTurn0()">🎲 Re-roll Bots</button>
        <button class="btn btn-ghost" onclick="_pendingTurn0=null;document.getElementById('detail-msg').innerHTML=''">Cancel</button>
      </div>
    </div>`;
}

// Commit the prepared Turn-0 plan: persist bot rows, generate the world, push reports.
async function commitTurn0(){
  const msg=document.getElementById('detail-msg');
  if(!_pendingTurn0){ msg.innerHTML='<div class="msg-error">No pending setup — press Run Turn 0 again.</div>'; return; }
  const {humanSetups, botSetups, sz, maxTurns, seaPct, botDifficulty, botDiplomacy, safeStart}=_pendingTurn0;
  msg.innerHTML='<div class="msg-info">⏳ Generating world map and starting positions…</div>';

  try{
    // 1. Persist bot rows first (clean slate: remove any leftover bot rows from an aborted run).
    // Bots are the only rows with a null user_id, so this only ever deletes bots.
    if(botSetups.length>0){
      await sb.from('game_players').delete().eq('game_id',currentGame.id).is('user_id',null);
      for(const b of botSetups){
        const {data:brow,error:bErr}=await sb.from('game_players').insert({
          game_id:currentGame.id,
          user_id:null,
          player_index:b.id,
          display_name:b.kingdomName,
          orders_submitted:false,
          // isBot marker lives in the JSON (no DB column needed); playerSetup mirrors a human join.
          turn_report:JSON.stringify({isBot:true, playerSetup:{
            kingName:b.kingName, kingdomName:b.kingdomName, race:b.race,
            alignment:b.alignment, temper:b.temper, skills:b.skills
          }, status:'bot', waitingForTurn0:true})
        }).select().single();
        if(bErr){ msg.innerHTML=kcHtml`<div class="msg-error">Could not create bot realm: ${bErr.message}</div>`; return; }
        b.gamePlayerId=brow.id;
      }
    }

    // 2. Combined, index-sorted setup list — humans then bots, contiguous indices.
    const setupPlayers=[...humanSetups, ...botSetups].map(sp=>({
      id:sp.id, gamePlayerId:sp.gamePlayerId, isBot:!!sp.isBot,
      name:sp.kingdomName, kingName:sp.kingName, kingdomName:sp.kingdomName,
      race:sp.race, alignment:sp.alignment, temper:sp.temper, skills:sp.skills,
    })).sort((a,b)=>a.id-b.id);

    // 3. Generate the world.
    const gameState=await generateNewGame(setupPlayers,sz,maxTurns,{seaPct});
    if(safeStart) gameState.safeStart=true; // 2026-09-29 (Toby): Safe Start — no diplomacy before Turn SAFE_START_TURN
    gameState.botDiplomacy=(botDiplomacy==='hostile')?'hostile':'normal'; // 2026-09-26b (Toby item 10): 'hostile' = bots always at war with humans, never allied
    gameState.botDifficulty='hard'; // 2026-09-26 (Toby item 9): every bot game plays at the one strength (Easy / Normal retired); the saved cfg value is ignored
    // Turn-running mode carries over from the setup config; a deadline clock starts now (Turn 0 =
    // the first "run").
    { const _tm=normalizeTurnMode(parseGameState(currentGame).turnMode); _tm.turnRanAt=new Date().toISOString(); _tm.nextDeadlineAt=_tm.mode==='deadline'?computeNextDeadline(_tm,new Date()):null; gameState.turnMode=_tm; }
    seedUsedArmyNames(gameState); seedUsedHeroNames(gameState);
    const {error:saveErr}=await sb.from('games').update({
      status:'active',turn:1,
      game_state:JSON.stringify(gameState),
      ...metaPatch(gameState)
    }).eq('id',currentGame.id);
    if(saveErr){msg.innerHTML=kcHtml`<div class="msg-error">Error saving game: ${saveErr.message}</div>`;return;}

    // 4. Push turn reports to every realm (humans and bots alike — a bot report is harmless and
    // lets the GM inspect a bot's starting position).
    let reportErrors=[];
    for(const sp of setupPlayers){
      const report=buildTurnReport(gameState,sp.id);
      const {error:rErr}=await sb.from('game_players').update({
        turn_report:sp.isBot
          ? JSON.stringify({isBot:true, report, playerSetup:{kingName:sp.kingName,kingdomName:sp.kingdomName,race:sp.race,alignment:sp.alignment,temper:sp.temper,skills:sp.skills}})
          : JSON.stringify(report),
        orders:null,
        orders_submitted:false
      }).eq('id',sp.gamePlayerId);
      if(rErr) reportErrors.push(rErr.message);
      try{
        await sb.from('turn_logs').insert({ game_id:currentGame.id, player_index:sp.id, turn:0, entries:report });
      }catch(snapErr){ /* best-effort */ }
    }

    const botN=setupPlayers.filter(s=>s.isBot).length, humN=setupPlayers.length-botN;
    if(reportErrors.length>0){
      msg.innerHTML=kcHtml`<div class="msg-error">Game created but some reports failed: ${reportErrors.join(', ')}</div>`;
    } else {
      msg.innerHTML=kcHtml`<div class="msg-success">✅ Turn 0 complete! Map generated for ${humN} human${humN!==1?'s':''}${botN?` + ${botN} bot${botN!==1?'s':''}`:''}. Players can now log in and see their realms.</div>`;
    }
    _pendingTurn0=null;
    currentGame.status='active';currentGame.turn=1;
    document.getElementById('detail-run-turn0-wrap').style.display='none';
    document.getElementById('detail-orders-card').style.display='block';
    document.getElementById('detail-log-card').style.display='none';
    const {data:refreshed}=await sb.from('games').select('*, game_players(*)').eq('id',currentGame.id).single();
    if(refreshed){currentGame=refreshed;currentGamePlayers=refreshed.game_players||[];}
    renderOrdersStatus(currentGame);
  }catch(e){
    msg.innerHTML=kcHtml`<div class="msg-error">Generation error: ${e.message}</div>`;
    console.error(e);
  }
}

