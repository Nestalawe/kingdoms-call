// ── GAME DETAIL ────
// ── LEGACY UNIT-TYPE MIGRATION ────
// Army type is stored as a raw string on every army object, inside the game_state JSON in Supabase.
// The five Human/Dwarven units below were renamed in v2026.09.06-1601. Any game saved before that
// still carries the old strings, and every lookup table (cost, speed, strength, terrain, druid
// level, missile/flying/sea sets, name pools) is keyed by the new ones — so an unmigrated save
// would silently fall back to default stats. This walks a loaded state and rewrites them. Safe to
// run repeatedly: unknown//already-migrated names pass through untouched.
const LEGACY_UNIT_RENAMES={
  'Infantry':'Shieldwall Levies',
  'Cavalry':'Free Lances',
  'Longbowmen':'Yeoman Longbows',
  'Knights':'Gilded Lances',
  'Crossbowmen':'Ironwood Crossbows',
  // 2026-10-13 (Toby, Creatures and Monsters II): Giant Eagles became Thunderbirds (the elves already ride
  // eagles) and Kraken Tentacles Eldritch Kraken; Leviathan Pods were replaced by the Dread Hydras, a LAND
  // Monster, so a running game's Leviathan companies become Eldritch Kraken (a land beast cannot swim) and
  // Leviathan waters Kraken waters (LEGACY_RACE_RENAMES below).
  'Giant Eagles':'Thunderbirds',
  'Kraken Tentacles':'Eldritch Kraken',
  'Leviathan Pods':'Eldritch Kraken',
};
// A province's (or a company's) primal race string, where the beast it names was renamed.
const LEGACY_RACE_RENAMES={'Primal:Giant Eagle':'Primal:Thunderbird','Primal:Leviathan':'Primal:Kraken'};
function migrateLegacyUnitNames(state){
  if(!state||typeof state!=='object') return state;
  let n=0;
  const fixArmyList=(list)=>{
    (list||[]).forEach(a=>{ if(a&&a.type&&LEGACY_UNIT_RENAMES[a.type]){ a.type=LEGACY_UNIT_RENAMES[a.type]; n++; }
      if(a&&a.race&&LEGACY_RACE_RENAMES[a.race]){ a.race=LEGACY_RACE_RENAMES[a.race]; n++; } });
  };
  (state.characters||[]).forEach(c=>fixArmyList(c.armies));
  (state.world&&state.world.provinces||[]).forEach(p=>{
    if(!p) return;
    if(p.race&&LEGACY_RACE_RENAMES[p.race]){ p.race=LEGACY_RACE_RENAMES[p.race]; n++; }
    fixArmyList(p.garrisonArmies);
    fixArmyList(p.neutralDefenders);
    if(Array.isArray(p.armyTypes)) p.armyTypes=p.armyTypes.map(t=>{
      if(LEGACY_UNIT_RENAMES[t]){ n++; return LEGACY_UNIT_RENAMES[t]; } return t;
    });
    (p.battleGraves||[]).forEach(g=>{ if(g&&g.type&&LEGACY_UNIT_RENAMES[g.type]){ g.type=LEGACY_UNIT_RENAMES[g.type]; n++; } });
  });
  (state.heroGraveyard||[]).forEach(g=>fixArmyList(g&&g.armies));
  if(n>0) console.log(`[migration] renamed ${n} legacy unit reference(s) to the current names.`);
  return state;
}

async function openGame(gameId){
  show('sec-game-detail');
  document.getElementById('detail-game-name').textContent='Loading…';
  document.getElementById('detail-msg').innerHTML='';
  document.getElementById('detail-players-list').innerHTML='';
  document.getElementById('detail-orders-card').style.display='none';
  document.getElementById('detail-log-card').style.display='none';
  document.getElementById('detail-run-turn0-wrap').style.display='none';

  const {data:game,error}=await sb.from('games').select('*, game_players(*)').eq('id',gameId).single();
  if(error){document.getElementById('detail-msg').innerHTML=kcHtml`<div class="msg-error">${error.message}</div>`;return;}
  currentGame=game;
  // 2026-09-25: the legacy unit-name rewrite used to be called here on the raw game_state, which is
  // a JSON string — a silent no-op. It now runs inside runTurn on the parsed state (where the
  // rewritten names are actually used and saved).
  currentGamePlayers=game.game_players||[];
  loadReportedDispatches(game);   // P0-24; fills its own card when it answers

  document.getElementById('detail-game-name').textContent=game.name;
  const maxP=game.max_players||4;
  // ── Bot-aware counts (Phase 1) ──
  const {botCount, allBot}=botConfigFor(game);
  const plannedBots=allBot?maxP:botCount;                 // intended bot count
  const joined=currentGamePlayers.filter(p=>p.user_id).length;
  const existingBots=currentGamePlayers.filter(isBotRow).length; // 0 in setup, filled after Turn 0
  const reservedBots=game.status==='setup'?Math.max(0,plannedBots-existingBots):0;
  const humanCap=allBot?0:(maxP-plannedBots);
  const statusLabel=game.status==='setup'?'Setup':game.status==='active'?`Turn ${game.turn}`:'Complete';
  // ARCHIVE (2026-09-27 item 1) — the header says so, and the button becomes Restore.
  const _isArch=gameArchived(game);
  document.getElementById('detail-status-pill').innerHTML=kcHtml`<span class="pill ${game.status==='active'?'pill-blue':'pill-amber'}">${statusLabel}</span>${_isArch?kcHtml` <span class="pill pill-amber" title="Archived — every scrap of this game is kept">🗄 Archived${(()=>{const a=gameArchivedAt(game);return a?` ${fmtLastRun(a)}`:'';})()}</span>`:''}`;
  { const _ab=document.getElementById('detail-archive-btn');
    if(_ab){ _ab.textContent=_isArch?'♻ Restore Game':'🗄 Archive Game';
             _ab.title=_isArch
               ? 'Bring this game back into the main list. Nothing was lost while it was archived.'
               : 'Put this game away. Everything is kept — the world, the players, every report, the statistics and the Hall-of-Fame record — it simply leaves the main list and the auto-turn watcher stops watching it.'; } }
  document.getElementById('detail-player-count').textContent=game.status==='setup'
    ? `${joined}/${humanCap} human${humanCap!==1?'s':''}${plannedBots?` · ${plannedBots} bot${plannedBots!==1?'s':''}`:''} · sea ${seaPctOf(game)}%`
    : `${joined} human${joined!==1?'s':''}${existingBots?` · ${existingBots} bot${existingBots!==1?'s':''}`:''} / ${maxP}`;

  // Player slots (bots labelled for the GM; they stay hidden from players elsewhere)
  const slotsHtml=currentGamePlayers.map(p=>{
    const bot=isBotRow(p);
    const statusPill=bot?kcHtml`<span class="pill pill-green">🤖 Bot</span>`
      :(p.user_id?kcHtml`<span class="pill pill-green">Joined</span>`:kcHtml`<span class="pill pill-amber">Waiting</span>`);
    // Remove-player control (2026-09-26, Toby item 4). Available at EVERY stage: in setup the slot
    // simply reopens; in a live game the realm concedes and plays no further part.
    const _con=(game.status!=='setup')&&realmConcededIn(game,p.player_index);
    const _rmLabel=(game.status==='setup')?'Remove player':'Remove player (realm concedes)';
    return kcHtml`
    <div class="player-slot">
      <div class="slot-name">${bot?'🤖 ':''}${p.display_name||'(slot open)'}</div>
      <div class="slot-status">${statusPill}</div>
      ${_con?kcHtml`<span class="pill pill-red">🏳 Conceded</span>`:''}
      ${(p.orders_submitted&&!bot)?kcHtml`<span class="pill pill-blue">Orders in</span>`:''}
      ${!p.user_id&&!bot&&p.invite_code?kcHtml`<div class="slot-code">Invite: ${p.invite_code}</div>`:''}
      <button class="btn btn-ghost" style="color:#8a1010;border-color:#8a1010;font-size:.62rem;padding:4px 9px" title="${_rmLabel}" onclick="removePlayer(${kcArg(String(p.id))})">✖ Remove</button>
    </div>`;});

  // Reserved bot slots (setup only — the actual bot rows are created when Turn 0 runs)
  const reservedBotHtml=Array(reservedBots).fill(0).map(()=>kcHtml`
    <div class="player-slot" style="opacity:.7">
      <div class="slot-name">🤖 Bot realm</div>
      <div class="slot-status"><span class="pill pill-amber">Generated at Turn 0</span></div>
    </div>`);

  // Open human slots (setup only)
  const openHuman=game.status==='setup'?Math.max(0,humanCap-joined):0;
  const emptySlotsHtml=Array(openHuman).fill(0).map(()=>kcHtml`
    <div class="player-slot" style="opacity:.5">
      <div class="slot-name">(open slot)</div>
      <div class="slot-status">Waiting for player</div>
    </div>`);

  document.getElementById('detail-players-list').innerHTML=kcHtml`${slotsHtml}${reservedBotHtml}${emptySlotsHtml}`;

  // Visibility / invites panel (setup phase only — visibility is dropped once a game goes active).
  const _visWrap=document.getElementById('detail-visibility-wrap');
  if(_visWrap){
    if(game.status!=='setup'){ _visWrap.innerHTML=''; }
    else{
      const vis=gameVisibility(game);
      if(!vis.private){
        _visWrap.innerHTML=`<div class="msg-info" style="margin:0">🌍 <strong>Public game</strong> — any registered player can see and join it.</div>`;
      }else{
        // Names need the profile cache; load it (best-effort) so we can show who's invited.
        let namesHtml=kcHtml`<span style="color:var(--stone)">${vis.invited.length} invited</span>`;
        try{
          await loadInvitablePlayers();
          const names=invitedNames(vis.invited);
          namesHtml = names.length
            ? names.map(n=>kcHtml`<span class="pill pill-blue" style="margin:2px 4px 2px 0">${n||''}</span>`)
            : kcHtml`<span style="color:#c88">nobody invited yet — no one can join</span>`;
        }catch(e){ namesHtml=kcHtml`<span style="color:#c88">${vis.invited.length} invited (couldn't load names: ${e.message})</span>`; }
        _visWrap.innerHTML=kcHtml`<div style="border:1px solid var(--gold);border-radius:4px;padding:10px;background:#20160c">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
            <span style="color:var(--parchment);font-weight:600">🔒 Private game</span>
            <span style="color:var(--stone);font-size:.8rem">— only the players below can see and join it.</span>
            <button class="btn btn-gold" style="margin-left:auto;font-size:.72rem;padding:4px 10px" onclick="openEditInvites()">✎ Edit invited players</button>
          </div>
          <div>${namesHtml}</div>
        </div>`;
      }
    }
  }

  renderTurnModePanel(game); // manual / auto / deadline switcher (setup and active)

  // Turn 0: show run button when enough realms (humans + planned bots) exist
  if(game.status==='setup' && (joined + plannedBots) >= 2){
    document.getElementById('detail-run-turn0-wrap').style.display='block';
  }

  // Active game: show orders + GM order entry
  if(game.status==='active'){
    document.getElementById('detail-orders-card').style.display='block';
    renderOrdersStatus(game);
  }

  // Log
  if(game.turn>0){
    document.getElementById('detail-log-card').style.display='block';
    loadTurnLog(game.id, game.turn-1);
  }
}

function renderOrdersStatus(game){
  const players=currentGamePlayers.filter(p=>p.user_id);
  const bots=currentGamePlayers.filter(isBotRow);
  // Bots are auto-satisfied (Phase 1: they submit no orders and default to Defend). The run button
  // shows once every non-exempt HUMAN has submitted — conceded / extinguished realms are never
  // waited on — and in an all-bot game (0 humans) it shows immediately.
  const humansAllIn=ordersWaitingOn(players,game).length===0;
  const allIn=humansAllIn&&(players.length+bots.length)>0;
  const _tm=turnModeOf(game);
  const _tmLine=_tm.mode==='manual'?'':kcHtml`<div class="msg-info" style="margin-bottom:8px">${turnModeSummary(_tm)} — ${_tm.mode==='auto'?'the watcher runs the turn as soon as every realm\'s orders are in.':'the watcher runs the turn when every realm\'s orders are in, or at the deadline.'}</div>`;

  document.getElementById('detail-orders-status').innerHTML=kcHtml`${_tmLine}
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      ${players.map(p=>{ const ex=realmExemptIn(game,p.player_index); return kcHtml`<div style="padding:5px 12px;border-radius:2px;font-size:.8rem;
        background:${p.orders_submitted?'#d4edda':ex?'#eae3d2':'#fff3cd'};
        border:1px solid ${p.orders_submitted?'#28a745':ex?'#c9bd9e':'#ffc107'}">
        ${p.display_name}: ${p.orders_submitted?'✓ Orders submitted':ex?'— exempt (conceded / no realm)':'⏳ Awaiting orders'}
      </div>`;})}
      ${bots.map(b=>kcHtml`<div style="padding:5px 12px;border-radius:2px;font-size:.8rem;
        background:#eae3d2;border:1px solid #c9bd9e">
        🤖 ${b.display_name}: auto
      </div>`)}
    </div>`;

  // Master GM mode (P0-32g): the Overlord may run any game's turn now, in any turn mode, orders in or not (to rescue
  // a game whose GM is away). If the game's own GM tab resolves the same turn, the conditional save lets only one win.
  document.getElementById('detail-run-turn-btn').innerHTML=_kcOverlord?'⚡ Run turn now':'⚡ Resolve Turn &amp; Generate New Reports';
  document.getElementById('detail-run-now-note').style.display=_kcOverlord?'block':'none';
  if(allIn||_kcOverlord){
    document.getElementById('detail-run-turn-wrap').style.display='block';
  }
}


// ── Per-player feature discovery ────
// f.discovered remains the engine-internal "discovered by ANYONE" flag; player-facing views must
// instead ask featDiscovered(f, playerIndex). Legacy saves (features with discovered:true but no
// discoveredBy array) are grandfathered as visible to everyone who could already see them
// (_legacyAll), so upgrading mid-game never takes knowledge away from a player.
function featDiscovered(f, pi){
  if(!f) return false;
  if(pi==null) return !!f.discovered;              // engine-internal: anyone
  if(f._legacyAll) return true;                     // pre-upgrade discovery: everyone keeps it
  if(Array.isArray(f.discoveredBy)) return f.discoveredBy.includes(pi);
  return !!f.discovered;                            // legacy save, array never created yet
}
function discoverFeat(f, pi){
  if(!f) return false;
  const wasKnown=featDiscovered(f, pi);
  if(pi!=null){
    if(!Array.isArray(f.discoveredBy)){
      if(f.discovered) f._legacyAll=true;           // grandfather old-save global discovery
      f.discoveredBy=[];
    }
    if(!f.discoveredBy.includes(pi)) f.discoveredBy.push(pi);
  }
  f.discovered=true;
  return !wasKnown;
}


// ── PLAYER MAP CENTRING ────
// Each player's map is therefore rolled horizontally so their founding capital sits in the middle
// column; the wrap seam then falls behind them instead of through their territory. Same world,
// different starting column per player. North-south is untouched — the grid does not wrap that way.
//
// Games saved before this existed have no homeProvinceId, so it is backfilled once, here, and then
// frozen: provinces[0] was seeded with the capital at world gen, and the king's location is the
// last resort. Backfilling from the CURRENT province list would let the centre drift as land
// changes hands, which is exactly what this is meant to prevent. Item 4: who FOUNDED this province
// as their capital (null if nobody). Home-ground bonuses belong only to that player — defending it,
// or attacking to win it back.
function homeFounderOf(gs, provId){
  const pls=(gs&&gs.players)||[];
  for(let i=0;i<pls.length;i++){ if(pls[i]&&homeProvinceIdFor(gs,i)===provId) return i; }
  return null;
}
