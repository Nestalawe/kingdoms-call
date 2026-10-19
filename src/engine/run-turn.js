// ── THE TURN ITSELF (plan P1-18d, 2026-10-18) ────
// resolveTurn works out one turn: it brings the save up to date, merges the players' orders, has the bots plan,
// resolves the five phases and the end of the turn. It is synchronous and reads no database, no screen and no clock;
// the dice are the page's (kcRng, src/engine/rng.js). The shell around it is runTurn (src/ui/gm/turn-shell.js): it
// loads the game, clears the orders, calls this, saves, and only then has the reports built and writes them.
//   G                 the game's saved state as loaded (games.game_state, a JSON string): parsing it is the turn's copy
//   freshPlayers      the game's slot rows as loaded (game_players), each with the orders it sent
//   expectedTurnToRun the turn being run (the games row's turn, which the save checks)
// Returns {state, log, buildReports}:
//   state             the world after the turn, as JSON: what the shell saves (with its two turn-mode stamps added)
//   log               the GM's log of the turn (turnLog); buildReports adds the Spy-stealth lines to it
//   buildReports()    builds every realm's report on the working copy, once, after the save: {reports, tel}, where
//                     reports is [{gp, report}] (gp: the slot row it is for) and tel what telemetry reads
// The body keeps runTurn's two-space indent and names, so the code anchors in tests/README.md still match.
function resolveTurn(G, freshPlayers, expectedTurnToRun){
  try{
    G=typeof G==='string'?JSON.parse(G):G;
    seedUsedArmyNames(G); seedUsedHeroNames(G);
    migrateMaxHpV2(G); // Sept 2026 redesign: derived max HP (one-time recompute for older saves, silent resync otherwise)
    backfillHomeRosters(G); // home provinces recruit the king's full racial land roster
    retireCorsairPools(G); // 2026-10-15 (D3): no province offers the retired Corsair Fleet
    retireDiscoveries(G);   // strip retired Sage discovery ids (sd34) from live saves
    migrateLegacyUnitNames(G); // pre-2026.09.06 unit-type strings → current names (idempotent)
    snapshotHeldItems(G);      // remember every pack as it stands NOW, so the report can mark what was gained this turn
    // THE MAP'S "THIS TURN" SWORDS. _hadBattleThisTurn (red) and _combatPlayersThisTurn (purple
    // duel swords) are deleted at the very end of runTurn — but only AFTER game_state has been
    // saved, so the saved state still carried them and the next turn loaded last turn's fights,
    // reporting them a second time (the "duel icon that won't go away"). Clear them here, at the
    // top of the turn, whatever the save held.
    (G.world&&G.world.provinces||[]).forEach(p=>{ if(p){ delete p._hadBattleThisTurn; delete p._combatPlayersThisTurn; } });
  }catch(e){
    // the orders are already cleared: the catch at the end of runTurn puts them back
    throw new Error(`Could not read the saved game: ${e&&e.message||e}`);
  }
  // ── THE TURN'S CONTEXT (plan P1-08a) ── what the helpers lifted out of resolveTurn read: the state, the log
  // and its collectors, the phase being resolved. They take it first (src/engine/turn/context.js).
  const turnContext=createTurnContext(G, freshPlayers, expectedTurnToRun);
  // ── MERCENARY BAND IDS (P1-18b, 2026-10-18) ── a band made this turn is `merc_t<turn>_<n>`, counted
  // afresh each turn: no clock and no dice, so the turn's dice don't depend on how many bands it makes.
  // The `merc_` prefix is what the hire code tests for, and an older save's `merc_<ms>_<b36>` ids can't
  // meet these. The turn is the one being run (expectedTurnToRun), not G.turn, which advances mid-turn.
  const _mercIds={n:0};
  turnContext._mercIds=_mercIds;
  // ── TELEMETRY (2026-09-25) ── the situation of every realm BEFORE anything happens this turn, and
  // the collectors the hooks below fill (battles, lair fights, captures, deaths, spells). Written to
  // turn_events after the save, one row per realm — see writeTurnTelemetry at the end of runTurn.
  const _tel={pre:{}, orders:{}, battles:[], encounters:[], captures:[], deaths:[], spells:[], hires:[], recruits:[]};
  turnContext._tel=_tel;
  try{ (G.players||[]).forEach((pl,pi)=>{ if(pl) _tel.pre[pi]=telRealmSnapshot(G,pi); }); }catch(_te){ console.warn('telemetry pre-snapshot:',_te); }

  // ── BOT DIPLOMACY (Phase 2) — turn-start snapshot ── Snapshot each bot's identified-rivals set
  // (_encountered, driven by fog-of-war) as it stands at the START of the turn. A bot then declares
  // war (below, just before diplomacy resolution) on the same cadence a human would: it reacts to
  // what it knew going into the turn, the declaration is applied at end of turn, and war stands
  // next turn — reusing the existing human war tempo.
  const _botPlayerIdx=new Set((freshPlayers||[]).filter(isBotRow).map(p=>p.player_index));
  turnContext._botPlayerIdx=_botPlayerIdx;
  // Sept 2026 (bot strategy batch): stamp the bot flag onto the persisted player objects so the
  // module-level bot passes can tell bot realms from human ones (botIsBotPlayer) — bots never war
  // one another while a human king still reigns, and coordinate against the humans instead.
  (G.players||[]).forEach((p,i)=>{ if(p) p._isBot=_botPlayerIdx.has(i); });
  const _botEncounteredAtStart={};
  _botPlayerIdx.forEach(idx=>{ _botEncounteredAtStart[idx]=[...(((G.players||[])[idx]||{})._encountered||[])]; });

  // a defeated sea neutral-guard becomes a plain wandering hero (player===null, no longer
  // _isNeutralGuard) but keeps the 'Creature'/'Monster' pseudo-race it wore to label the beasts it
  // once commanded — which then reads absurdly in the Wandering Heroes list ("Mira the Nomad
  // (Monster, Neutral) — hire for …"). Heroes are people; the monster class belongs to the ARMIES.
  // Normalise any such lone wanderer to a stable humanoid race here (deterministic by id, so it
  // never flickers turn to turn). Active guards keep their beast label — they are excluded by the
  // _isNeutralGuard check — preserving the intended sea-guard flavour while they hold their waters.
  // Legacy-save safety net: world-gen now gives every neutral hero a humanoid race, but a save
  // created before that fix may still hold neutral heroes — active guards included — wearing a
  // 'Creature'/'Monster' pseudo-race. Normalise ALL of them to a stable humanoid race
  // (deterministic by id so it never flickers). The monster class stays on the ARMIES they lead.
  (G.characters||[]).forEach(c=>{
    if(c && c.player===null && (c.race==='Monster'||c.race==='Creature')){
      c.race=RACES_P[((c.id||0)%RACES_P.length+RACES_P.length)%RACES_P.length];
    }
  });
  // repair any guard stranded troopless or inside a player's province (see normaliseStrandedGuards)
  // so this turn's move-in / hire / sightings all treat him as the wanderer he really is. This also
  // heals saves carrying the pre-fix case.
  normaliseStrandedGuards(G);
  // 2026-09-27 (Toby): the stranded-hull marker is a WITHIN-PHASE flag (see navalHeldIn). Every
  // path that sets it clears it again, but a save written by an older build — or any future path
  // that forgets — must not carry it into a fresh turn, where it would quietly hold units out of
  // their own province's defence. One sweep, at the top of the turn.
  ((G.world&&G.world.provinces)||[]).forEach(p=>((p&&p.garrisonArmies)||[]).forEach(a=>{ if(a&&a._navalHold!=null) delete a._navalHold; }));
  // strip the ' (wandering)' tag from anyone who now serves a crown. Heals live games whose heroes
  // were charmed or resurrected into service before the paths below were fixed.
  // SCOPE TRAP: `log` is a const arrow declared far below inside runTurn, so it is in its temporal
  // dead zone here — the repair is stashed on G and reported by the turn-end integrity block
  // instead.
  G._nameRepairs=normaliseOwnedNames(G);

  // 2. Merge all player orders into G.turnOrders + apply encounter plans
  // CRITICAL: reset turnOrders completely first — stale orders from a previous turn
  // must NEVER carry over. Every character starts this turn with a clean slate (Defend).
  G.turnOrders={};
  // Per-turn scratch lists persisted inside game_state. These were never cleared, so a hero raised
  // in an earlier turn stayed in _resurrectedThisTurn for the rest of the game — and if they later
  // died again, every future Resurrect (even a successful roll) was refused with "has already been
  // raised this turn" while the body stayed in the graveyard (player report, Sept 2026). Stale
  // pending pre-orders for a resurrect/charm target could likewise be re-applied turns later.
  G._resurrectedThisTurn=[];
  G._pendingResurrectOrders=[];
  (G.characters||[]).forEach(ch=>{ if(ch&&ch.alive&&ch.player!=null) noteServedRealm(ch,ch.player); }); // service history (Resurrect)
  G._pendingCharmOrders=[];
  G._pendingHireOrders=[];   // 2026-09-21: hire pre-orders are held, not written straight to the real hero
  G._pendingSynthPlans=[];   // 2026-09-21: encounter plans from hire/resurrect/charm pre-order cards
  (G.characters||[]).filter(c=>c.player!==null&&c.alive).forEach(c=>{
    G.turnOrders[c.id]=[null,null,null,null,null];
  });
  // Encounter plans persist across turns until the player changes them, so we do NOT wipe them here
  // — the new submissions below overwrite only the characters whose orders include a plan. Collect
  // warnings about rejected stale orders (logged once log() is ready)
  const staleOrderWarnings=[];
  // Diplomacy declarations submitted this turn, keyed by player index → { targetPlayerIndex: 'treat'|'enemy' }.
  // Recorded here, applied at end of turn (relations change "at the start of the next turn").
  const diploDeclarations={};
  const safeStartRefused=[]; // SAFE START: realms whose declarations were discarded this turn (told privately)
  const discoveryChoicePicks={}; // research choice: player index → {pendingKey: keptDiscoveryId}
  // Victory: players who Called the Reckoning this turn (king-only, one per realm).
  const reckoningCalls=new Set();
  // player-to-player messages submitted with orders, keyed by sender index → [{to, text}].
  // `to` is an array of recipient player indices, or the string 'all'. Delivered into each
  // recipient's report below (this turn's report, which they read before ordering next turn).
  const playerMessages={};
  freshPlayers.filter(p=>p.user_id&&p.orders).forEach(gp=>{
    let raw=typeof gp.orders==='string'?JSON.parse(gp.orders):gp.orders||{};
    // Detect new format: {orders:{charId:[phases]}, encounterPlans:{}, forTurn:N} vs old format:
    // {charId:[phases]}
    let ordersObj=raw;
    let epObj={};
    let kingSkillsObj={};
    let forTurn=null;
    // the player's own arrangement of their heroes in the orders column, sent as an array of
    // character ids. Stored on the realm so it survives this turn's run and shapes every later
    // report (buildTurnReport sorts by it). Read BEFORE the format sniff below, because a bare
    // reorder on an otherwise untouched form is a payload with no meaningful orders in it.
    if(Array.isArray(raw.heroOrder)&&G.players[gp.player_index]){
      G.players[gp.player_index].heroOrder=raw.heroOrder.slice(0,200).map(String);
    }
    if(raw.orders!==undefined&&raw.encounterPlans!==undefined){
      ordersObj=raw.orders||{};
      epObj=raw.encounterPlans||{};
      kingSkillsObj=raw.kingSkills||{};
      forTurn=raw.forTurn??null;
      // Diplomacy declarations (king-only, one stance per target). Validated at resolution time
      // against the encountered set; stored raw here.
      if(raw.diplomacy && typeof raw.diplomacy==='object'){
        // SAFE START (2026-09-29): before the orders for Turn SAFE_START_TURN no Treat or war may be
        // declared — the declarations are discarded and the realm is told why.
        if(safeStartLocked(G,expectedTurnToRun)){
          if(Object.values(raw.diplomacy).some(v=>v==='treat'||v==='enemy')) safeStartRefused.push(gp.player_index);
        } else diploDeclarations[gp.player_index]=raw.diplomacy;
      }
      // RESEARCH CHOICE: which of each pending pair to keep ({key: discoveryId}); honoured only when
      // the payload is for this turn (a stale draft's picks are ignored like its orders).
      if(raw.discoveryChoices && typeof raw.discoveryChoices==='object' && (raw.forTurn==null||raw.forTurn===expectedTurnToRun)) discoveryChoicePicks[gp.player_index]=raw.discoveryChoices;
      if(raw.callReckoning===true&&!(G.players[gp.player_index]||{}).conceded) reckoningCalls.add(gp.player_index);
      if(Array.isArray(raw.messages)) playerMessages[gp.player_index]=raw.messages;
      // CONCEDE. A realm that concedes is out of the game for good — its characters do nothing but
      // Defend from now on (enforced below every turn, whatever is submitted).
      if(raw.concede===true && G.players[gp.player_index] && !G.players[gp.player_index].conceded){
        G.players[gp.player_index].conceded=true; G.players[gp.player_index].concededTurn=expectedTurnToRun;
        staleOrderWarnings.push(`\u{1F3F3} ${G.players[gp.player_index].name} has CONCEDED the game. Its heroes lay down their ambitions and will only defend what they hold from now on.`); // logged (public) once the log() helper exists
      }
    }
    // CRITICAL: reject orders that were stamped for a different turn (stale submissions)
    if(forTurn!==null&&forTurn!==expectedTurnToRun){
      staleOrderWarnings.push(`⚠ Ignoring stale orders from ${G.players[gp.player_index]?.name||'a player'} — submitted for Turn ${forTurn}, not Turn ${expectedTurnToRun}.`);
      return; // skip this player's stale orders entirely
    }    Object.entries(ordersObj).forEach(([charId,phaseOrders])=>{
      if(charId==='heroOrder') return; // an array, but not a character's phase orders
      if(!Array.isArray(phaseOrders)) return;
      // Handle synthetic RESURRECTION IDs: 'resurrect_HEROID_via_CASTERID_phPH' A player who orders
      // Resurrect in phase PH may pre-write orders for the hero they intend to raise, exactly as
      // they can for a hero they intend to hire. These are held as PENDING and are only written
      // into turnOrders inside the successful white_resurrect branch — never here. That matters: a
      // corpse can be targeted by more than one player in the same turn, and writing straight to
      // G.turnOrders[realHeroId] would let a player who LOST the race to raise a body still puppet
      // that hero for the rest of the turn. Orders are also scoped to phases AFTER the cast, since
      // the hero is still dead in every phase up to and including it.
      const resMatch=charId.match(/^resurrect_(\d+)_via_(\d+)_ph(\d+)$/);
      if(resMatch){
        if(!G._pendingResurrectOrders) G._pendingResurrectOrders=[];
        G._pendingResurrectOrders.push({
          heroId:parseInt(resMatch[1]),
          casterId:parseInt(resMatch[2]),
          castPhase:parseInt(resMatch[3]),
          player:gp.player_index,
          orders:phaseOrders,
        });
        return;
      }
      // Handle synthetic hired hero IDs: 'hired_HEROID_via_CHARID_phPH'.
      // 2026-09-21: these are now held as PENDING and written into turnOrders only inside the
      // successful `case 'hire'` branch — never here. Previously they were committed to the REAL
      // hero's turnOrders at ingestion, before any hire was attempted, so a player who LOST the
      // race (a rival hired the same wandering hero first, or the offer was refused / unaffordable)
      // still puppeted that hero for the rest of the turn, under the winner's banner. Resurrect and
      // Charm were given exactly this protection; hire had the identical exposure and none of it.
      const hiredMatch=charId.match(/^hired_(\d+)_via_(.+)_ph(\d+)$/); // the hirer may itself be a synthetic (nested-hire) id
      if(hiredMatch){
        if(!G._pendingHireOrders) G._pendingHireOrders=[];
        G._pendingHireOrders.push({
          heroId:parseInt(hiredMatch[1]),
          viaId:String(hiredMatch[2]),      // the hiring character's id (or a nested synthetic id)
          plannedPhase:parseInt(hiredMatch[3]),
          player:gp.player_index,
          orders:phaseOrders,
        });
        return;
      }
      // Handle synthetic CHARM IDs: 'charm_HEROID_via_CASTERID_phPH'. A player who orders Charm on
      // a wandering hero may pre-write orders for the hero they intend to sway, exactly as for a
      // hire or a resurrect. Held as PENDING and only written into turnOrders inside the successful
      // psychic_charm branch — never here — so a failed cast (or a rival charming the same hero
      // first) leaves no trace.
      const charmMatch=charId.match(/^charm_(\d+)_via_(\d+)_ph(\d+)$/);
      if(charmMatch){
        if(!G._pendingCharmOrders) G._pendingCharmOrders=[];
        G._pendingCharmOrders.push({
          heroId:parseInt(charmMatch[1]),
          casterId:parseInt(charmMatch[2]),
          castPhase:parseInt(charmMatch[3]),
          player:gp.player_index,
          orders:phaseOrders,
        });
        return;
      }
      G.turnOrders[charId]=phaseOrders;
    });
    // a conceded realm's characters ALWAYS hold — override whatever was submitted.
    (G.players||[]).forEach((p,pi)=>{ if(!p||!p.conceded) return;
      (G.characters||[]).filter(c=>c.alive&&c.player===pi).forEach(c=>{ G.turnOrders[c.id]=[0,1,2,3,4].map(()=>({action:'defend',target:'',extra:'',desc:'Hold (conceded)'})); });
    });
    // Apply encounter plans to characters.
    Object.entries(epObj).forEach(([charId,plan])=>{
      const syn=String(charId).match(/^(?:hired|resurrect|charm)_(\d+)_via_.+_ph\d+$/); // allow synthetic (nested) caster id
      if(syn){
        // 2026-09-21: a plan on a card for a hero not yet in this realm's service is held until the
        // hire/raise/charm actually lands (see applyPendingSynthPlan). An encounter plan persists
        // turn to turn, so writing it here let a rival set a hero's combat stance for good.
        if(!plan) return;
        if(!G._pendingSynthPlans) G._pendingSynthPlans=[];
        G._pendingSynthPlans.push({heroId:parseInt(syn[1]),player:gp.player_index,plan});
        return;
      }
      const ch=G.characters.find(c=>c.id===parseInt(charId));
      if(ch&&plan) ch.encounterPlan=plan;
    });
    // Apply royal-succession skill allocations to a newly-crowned heir, then retire the flags.
    Object.entries(kingSkillsObj).forEach(([charId,alloc])=>{
      const ch=G.characters.find(c=>c.id===parseInt(charId));
      if(ch&&ch._isHeir&&alloc){
        if(alloc.skills) ch.skills=alloc.skills;
        // The player may christen their heir and choose the Temper they were raised with.
        const nm=String(alloc.name||'').trim().slice(0,40);
        if(nm) ch.name=nm;
        if(alloc.temper&&TEMPERS_P.includes(alloc.temper)) ch.temper=alloc.temper;
        delete ch._isHeir; delete ch._pendingSkillAllocation;
      }
    });
  });

  // (the orders were cleared in step 2a, before the save was upgraded)

  // NOTE (Sept 2026): the bot passes and the default-to-Defend pass run inside the resolution
  // try-block, so the bot hunters' duel forecast can call the engine's personal-combat resolver,
  // whose function declarations live in that block. A bot-pass failure therefore also restores the
  // players' orders.

  migrateItemTiers(G);    // re-stamp saved items with their tier under the four-tier scheme
  ensureAllLairHoards(G); // stocks any lair from a pre-hoard save (no-op afterwards)

  function collectBotDiplomacy(){
  if(safeStartLocked(G,G.turn)) return; // SAFE START: bots make no Treat or declaration before Turn SAFE_START_TURN either
  // ── BOT DIPLOMACY — ALIGNMENT DECIDES ────
  //
  // ALIGNMENTS_P is the moral spectrum — Divine(0) Good(1) Druidic(2) Neutral(3) Pagan(4) Evil(5)
  // Undead(6) — and it is now the WHOLE of a bot's foreign policy, replacing the old war-on-contact
  // default and the "bots are one bloc while a human king lives" rule:
  //
  // alignDistP <= 1 (same alignment, or one step along the spectrum)
  // → TREAT, every turn, until the pact is sealed. The engine moves one step per turn and only
  // on a MUTUAL treat (Enemy→Neutral→Allied), so a bot simply keeps offering: two adjacent
  // bots ally by construction (both sides declare in this same pass), and a human ally-to-be
  // joins by treating back. Stops once allied — there is nothing further to offer.
  // alignDistP >= 2 → WAR, if not already at war. No exceptions: a Divine bot fights Pagan, Evil and
  // Undead crowns whoever they are, human or bot.
  //
  // Because a distant rival is never treated with, a bot can never BE allied to a realm 2+ steps
  // away, so the war declaration above can never break one of its own alliances.
  //
  // ── LATE-GAME ESCAPE HATCH ────
  // Alignment governs the whole game EXCEPT at the very end. Once a rival holds a LIVE RECKONING
  // CLAIM, the bots' own alliance with him is no longer worth more than the game: every bot not
  // making the claim declares war on the claimant, even an alignment-brother it has been allied
  // with for twenty turns, and treats every OTHER realm (including ones 2+ steps away) so the field
  // can unite to deny him. This is deliberately narrower than the old coalition: it needs an actual
  // claim on the board, not merely a front-runner near the threshold, so ordinary play stays purely
  // alignment-driven and legible from the alignment wheel alone.
  // ── THE GRUDGE ────
  // A HUMAN king who declares war on a bot has burned that bridge permanently. The bot remembers it
  // for the rest of the game and will never again offer that realm a Treat — not when their
  // alignments sit one step apart, not when the field is uniting to deny a Reckoning claim. Since a
  // pact can only be sealed by a MUTUAL treat, refusing to offer is enough to make an alliance (or
  // even a return to peace) impossible. Stored on the bot's own player record so it survives the
  // save, and recorded from the raw declarations before they are resolved, so the grudge is already
  // in force on the very turn war is declared.
    Object.keys(diploDeclarations).forEach(k=>{
      const from=Number(k);
      if(!Number.isInteger(from)||_botPlayerIdx.has(from)) return;      // human declarations only
      const decl=diploDeclarations[from]||{};
      Object.keys(decl).forEach(k2=>{
        const to=Number(k2);
        if(decl[k2]!=='enemy'||!_botPlayerIdx.has(to)) return;
        const bp=(G.players||[])[to]; if(!bp) return;
        if(!Array.isArray(bp.botGrudges)) bp.botGrudges=[];
        if(!bp.botGrudges.includes(from)) bp.botGrudges.push(from);
      });
    });
    const _grudgeAgainst=(botIdx,rival)=>(((G.players||[])[botIdx]||{}).botGrudges||[]).includes(rival);

    const _kingAliveIdx=new Set((G.characters||[]).filter(c=>c&&c.alive&&c.isKing&&c.player!=null).map(c=>c.player));
    const _hasLand=idx=>(((G.players||[])[idx]||{}).provinces||[]).length>0;
    const _conceded=idx=>!!(((G.players||[])[idx]||{}).conceded);
    // The claimant, if any — the only thing that can override alignment.
    const claimBy=(G.reckoning && G.reckoning.by!=null && _kingAliveIdx.has(G.reckoning.by))?G.reckoning.by:-1;
    _botPlayerIdx.forEach(idx=>{
      if(_conceded(idx)) return;                                 // a conceded realm makes no declarations
      if(!_kingAliveIdx.has(idx)&&!_hasLand(idx)) return;
      // 2026-09-21 (Toby): a bot ALLIED with the claimant AND of the same alignment keeps faith — it
      // neither breaks with him nor joins a coalition against him; it just plays its ordinary
      // alignment diplomacy (so it stays his ally).
      const _loyalToClaimant = claimBy>=0 && claimBy!==idx && areAllied(turnContext,idx,claimBy)
        && ((G.players||[])[idx]||{}).alignment!=null && ((G.players||[])[idx]||{}).alignment===((G.players||[])[claimBy]||{}).alignment;
      const denyingAClaim = claimBy>=0 && claimBy!==idx && !_loyalToClaimant;
      (_botEncounteredAtStart[idx]||[]).forEach(rival=>{
        if(rival==null||rival===idx) return;
        if(!(G.players||[])[rival]) return;
        if(_conceded(rival)) return;                             // a realm that has quit is not worth a declaration
        if(!_kingAliveIdx.has(rival)&&!_hasLand(rival)) return;   // skip already-defeated realms
        // 2026-09-26b (Toby item 10): AGGRESSIVE bot diplomacy (chosen at game creation) — every bot
        // is at war with every HUMAN realm it has met and never offers one a Treat, whatever the
        // alignment wheel or a Reckoning claim says. Bot-to-bot diplomacy is unchanged.
        if(G.botDiplomacy==='hostile' && !_botPlayerIdx.has(rival)){
          if(relationBetween(turnContext,idx,rival)!=='enemy') (diploDeclarations[idx]=diploDeclarations[idx]||{})[rival]='enemy';
          return;
        }
        if(denyingAClaim){
          if(rival===claimBy){
            // The crown is on the table: break with him, ally or not.
            if(relationBetween(turnContext,idx,rival)!=='enemy') (diploDeclarations[idx]=diploDeclarations[idx]||{})[rival]='enemy';
          } else if(!areAllied(turnContext,idx,rival) && !_grudgeAgainst(idx,rival)){
            // Everyone else is a potential partner in denying the claim, whatever their alignment —
            // except a human king who once declared war on us. That grudge outlasts the endgame.
            (diploDeclarations[idx]=diploDeclarations[idx]||{})[rival]='treat';
          }
          return;
        }
        // THE GRUDGE: they declared war on us once. No overture, ever again (no alliance, no peace
        // offer, no acceptance), whatever the alignment wheel or the war assessment says.
        const _grudge=_grudgeAgainst(idx,rival);
        // 2026-09-29b (Toby): THE GRUDGE BENDS ONLY TO SURVIVAL. If the human it holds a grudge against
        // is 5× the bot's strength (as the bot reckons it), the bot swallows its pride and treats —
        // for peace, then an alliance — to save itself. Once the human is no more than 2× its
        // strength again, it remembers the grudge and breaks the alliance. (The flag in between is
        // hysteresis, so it does not flip every turn.)
        if(_grudge){
          const _bp=(G.players||[])[idx]; _bp._botGrudgeTruce=_bp._botGrudgeTruce||{};
          const _r=botOwnPower(G,idx)/Math.max(1,botRivalPower(G,idx,rival));
          if(_r<=1/BOT_WAR.grudgeYield) _bp._botGrudgeTruce[rival]=G.turn||0;
          else if(_r>=1/BOT_WAR.grudgeRecall) delete _bp._botGrudgeTruce[rival];
          if(_bp._botGrudgeTruce[rival]!=null){
            if(!areAllied(turnContext,idx,rival)) (diploDeclarations[idx]=diploDeclarations[idx]||{})[rival]='treat';
            return;
          }
          if(areAllied(turnContext,idx,rival)){ (diploDeclarations[idx]=diploDeclarations[idx]||{})[rival]='enemy'; return; }   // the grudge remembered
        }
        // 2026-09-29b (Toby): a bot never ALLIES with a realm that is allied to any of its enemies
        // (alliances are known to all). Peace (Enemy→Neutral) is still possible.
        const _alliedToMyFoe=(G.players||[]).some((q,k)=>q&&k!==idx&&k!==rival&&relationBetween(turnContext,idx,k)==='enemy'&&relationBetween(turnContext,rival,k)==='allied');
        if(botAlignFriendly(G,idx,rival)){
          if(!_grudge&&!areAllied(turnContext,idx,rival)&&!(_alliedToMyFoe&&relationBetween(turnContext,idx,rival)==='neutral')) (diploDeclarations[idx]=diploDeclarations[idx]||{})[rival]='treat';
          return;
        }
        // 2026-09-29 (Toby): an ally of any alignment is kept faith with; otherwise war and peace are
        // a JUDGEMENT (botWarAssess) — strength, a prize on the border, opportunity, expansion first,
        // other wars, temper — not automatic on contact.
        if(areAllied(turnContext,idx,rival)) return;
        const _wa=botWarAssess(G,idx,rival,{offeredPeace:((diploDeclarations[rival]||{})[idx]==='treat')});
        if(_wa.decision==='war'&&relationBetween(turnContext,idx,rival)!=='enemy') (diploDeclarations[idx]=diploDeclarations[idx]||{})[rival]='enemy';
        else if(_wa.decision==='peace'&&!_grudge&&relationBetween(turnContext,idx,rival)==='enemy') (diploDeclarations[idx]=diploDeclarations[idx]||{})[rival]='treat';
      });
    });
  }


  // 4. Run all 5 phases
  // Structured log system Each entry carries metadata so we can build accurate per-player
  // chronicles:
  // actor — player index of the character taking the action (null = NPC/system)
  // targets — array of player indices who should ALWAYS see this entry
  // province — province id where the event occurred (used for territory visibility)
  // public — if true, all players who own or have characters in this province see it
  // redact — if true, enemy army strength is shown as a rough estimate only
  const {turnLog}=turnContext;
  // CLAIRVOYANCE watch snapshot. targetChar._clairvoyantBy is cleared at turn-end BEFORE the
  // per-player reports are built, so record each caster's active watch here (one per player — a new
  // casting replaces the old) to survive into report generation. { playerIndex: {charId, fromPhase}
  // }.
  const clairWatch={};
  turnContext.clairWatch=clairWatch;
  // Which commanders fought in each battle, keyed by provinceId@phase. Every battle line carries a
  // SINGLE charId — the attacker's (via _logCtx) for a fresh fight, or the ranking live force for a
  // resumed stalled battle. This map lets that report re-file the fight under THIS player's own
  // commander who fought there.
  const battleCommanders={};
  turnContext.battleCommanders=battleCommanders;
  // 2026-10-08 (Toby item 7): every character who stood in a field battle, by id → the phase it was
  // fought in. That is both leaders AND every armed character of either side standing on the ground,
  // so a general pooled in as a reinforcement counts too. ONE BATTLE PER PHASE reads it: a chase
  // already under way waits when its hunter has fought this phase — as the attacker OR the defender.
  const fieldBattlePhase={};
  turnContext.fieldBattlePhase=fieldBattlePhase;
  // Current character context — set by processOrder so all log calls get charId/phase automatically
  turnContext._logCtx={charId:null,phase:null};
  // the phase currently being resolved. _logCtx is cleared to null between characters and after
  // resolveStalledBattles, so a skill-rise earned in a phase-pipeline STAGE
  // (force-march reinforcement, defend-reaction, pursuit movement) — outside processOrder — would
  // otherwise be deferred with phase null and land under END OF TURN. This is the reliable
  // fallback.
  turnContext._currentPhase=null;
  // once the phase loop has finished, EVERY remaining line of the turn is an end-of-turn line (Mass
  // Healing, couriers, wages, de-consecration, max-HP sync …). _logCtx and _currentPhase are both
  // null by then, and a null phase was being filed under SPRING in the character sections of both
  // reports. This flag makes log() stamp phase 99 ("End of Turn") for anything emitted after the
  // pipeline, so no end-of-turn event can be reported a year early again.
  turnContext._afterPhases=false;
  // while a battle (or its carry-on series) is resolving, this holds the contested province's id so
  // trySkillGain can cap a combat skill to ONE gain per province-battle-series (carry-on battles
  // span phases, so a per-phase cap alone isn't enough). Cleared at every loop boundary between
  // fights.
  turnContext._combatSkillProv=null;
  // 2026-10-13 (item 6, Toby): while a pre-battle duel is fought, each duellist's id → the foe's name,
  // so a skill rise earned in it can say so (resolveDuel sets it; trySkillGain reads it).
  turnContext._duelFoes=null;
  turnContext._battleSeq=0; // 2026-09-23d: numbers each emitted battle so the player portal can fold it (emitBattle)
  // The Defend step (see flushDefendStep in the phase loop): true while the phase's non-moving orders
  // are still resolving; hosts raised meanwhile where a Defend general would answer wait in the queue.
  turnContext._tier0Open=false; turnContext._unitGainQueue=[];
  // while a duel against a LOCAL CHIEFTAIN (a neutral guard) is resolving, this holds
  // {used:false}. The FIRST skill advance of that duel closes it for every skill — melee, archery and
  // thief could each roll before, so one chieftain could train three skills at once. Unlike
  // _combatSkillProv (which is per-skill) this cap is TOTAL: one advance per duel, whatever the
  // skill.
  turnContext._chieftainDuelGain=null;
  const {log}=turnContext;

  // ── DIPLOMACY (KC alliance system) ────
  // Relations live in G.relations, keyed "minIdx-maxIdx" → 'enemy' | 'allied'. A pair with no
  // entry is NEUTRAL (the default). These helpers are the single source of truth consulted by the
  // movement border gate, every PvP battle site, and isHostileInvasion (pinning + Defend).
  if(!G.relations) G.relations={};

  // ── Item 3: WAR WITHOUT WARNING. Evil and Undead realms strike the turn they declare — their
  // declaration takes effect BEFORE phase 1, so their armies may cross the frontier this very turn.
  // Every other alignment's declaration still resolves at end of turn (step 6d), in force from next
  // turn. Bots declare here too (collectBotDiplomacy), so an Evil/Undead bot gets the same jump.
  // Sept 2026 (review R1): bots send a research pick instead of leaving the choice to chance.
  (G.players||[]).forEach((pl,pi)=>{ if(!_botPlayerIdx.has(pi)||!pl||!Array.isArray(pl.pendingDiscoveryChoices)) return;
    pl.pendingDiscoveryChoices.forEach(pc=>{ if(!pc||pc.turn>=G.turn||!Array.isArray(pc.options)) return; discoveryChoicePicks[pi]=discoveryChoicePicks[pi]||{};
      if(discoveryChoicePicks[pi][pc.key]==null) discoveryChoicePicks[pi][pc.key]=botResearchPick(G,pi,pc.options); }); });
  // ── RESEARCH CHOICE: settle last turn's pairs before anything else happens this turn ──
  (G.players||[]).forEach((pl,pi)=>{
    if(!pl||!Array.isArray(pl.pendingDiscoveryChoices)||!pl.pendingDiscoveryChoices.length) return;
    const picks=discoveryChoicePicks[pi]||{};
    const still=[];
    pl.pendingDiscoveryChoices.forEach(p=>{
      if(!p||!Array.isArray(p.options)||p.turn>=G.turn){ if(p) still.push(p); return; }
      pl.discoveries=pl.discoveries||[];
      const known=new Set(pl.discoveries.map(d=>d&&d.id));
      const opts=p.options.filter(id=>DISC_BY_ID[id]&&!known.has(id)&&!RETIRED_DISCOVERY_IDS.has(id));
      if(!opts.length) return;
      const want=picks[p.key];
      const chosen=opts.includes(want)?want:opts[Math.floor(kcRng()*opts.length)];
      const d=DISC_BY_ID[chosen];
      pl.discoveries.push({id:d.id,name:d.name,category:d.category,desc:d.desc,turnDiscovered:p.turn});
      pl.forgottenDiscoveries=pl.forgottenDiscoveries||[];
      const lost=p.options.filter(id=>id!==chosen);
      lost.forEach(id=>{ if(!pl.forgottenDiscoveries.includes(id)) pl.forgottenDiscoveries.push(id); });
      const lostNames=lost.map(id=>(DISC_BY_ID[id]&&DISC_BY_ID[id].name)||id).join(', ');
      log('explore',`💡 ${opts.includes(want)?`${pl.name} pursues`:`No choice was sent, so ${pl.name}'s scholars choose for themselves and pursue`} **${d.name}** (${d.category}), found by ${p.charName||'a scholar'} last turn. ${d.desc}${lostNames?` The other lead — ${lostNames} — is set aside and forgotten for good.`:''}`,{actor:pi,targets:[pi],charId:null,phase:0});
    });
    pl.pendingDiscoveryChoices=still;
  });
  collectBotDiplomacy();
  { const _npW=(G.players||[]).length;
    for(let a=0;a<_npW;a++){
      const pa=G.players[a]; if(!pa||!['Evil','Undead'].includes(pa.alignment)) continue;
      const decl=diploDeclarations[a]||{};
      for(let b=0;b<_npW;b++){
        if(b===a||decl[b]!=='enemy') continue;
        if(!((pa._encountered)||[]).includes(b)) continue;
        const key=relKeyOf(a,b);
        if((G.relations[key]||'neutral')==='enemy') continue;
        G.relations[key]='enemy';
        const na=pa.name||('Realm '+(a+1)), nb=G.players[b]?.name||('Realm '+(b+1));
        log('system',`⚔ ${na} declares war on ${nb} and marches without warning — ${pa.alignment==='Undead'?'the dead keep no truce':'the wicked keep no faith'}. War stands between the two realms from this very season.`,{actor:null,targets:[a,b],system:true});
      }
    }
  }

  // (Sept 2026: the Task-12 max-HP cap, raiseMaxHp and hpCapFor were removed — maximum HP is now a
  // derived stat; see computeMaxHp / syncMaxHp at module level.)

  // ── LIVE TITLE PERKS + MINOR TITLES ── Determine who holds each Title going into this turn
  // (once, so a perk applies all turn). Function declarations (hoisted) + an EARLY computation so
  // even the turn-start pursuit resolution reads valid holders without a temporal-dead-zone. Active
  // only from the turn Titles go public (#10); before that the maps are empty and every check
  // returns false.
  G._titleHolders={}; G._minorHolders={};
  if(TITLE_PERKS_ENABLED && (G.turn||1)>=TITLES_PUBLIC_FROM_TURN){
    try{ G._titleHolders=computeStandings(G).titles||{}; }catch(e){ G._titleHolders={}; }
    try{ G._minorHolders=computeMinorTitles(G); }catch(e){ G._minorHolders={}; }
  }

  // Flush any stale-order warnings collected during the merge phase
  safeStartRefused.forEach(pi=>log('system',`🕊 Safe Start: no Treat or declaration of war may be made before the orders for Turn ${SAFE_START_TURN}. Your diplomacy this turn was set aside — relations are unchanged.`,{actor:null,targets:[pi],system:true}));
  if(staleOrderWarnings.length>0){
    staleOrderWarnings.forEach(w=>log('system',w,{actor:-1,targets:[],system:true,public:w.startsWith('\u{1F3F3}')}));
  }

  // ── GM-REMOVED REALMS (2026-09-26, Toby item 4) ── The GM can take a player out of a game at any
  // stage; the realm concedes there and then (in game_state) and its seat at the table is deleted.
  // The world is told here, on the first turn resolved after the removal, in the same words a
  // voluntary concession uses — removeGmRemovalQueue holds the indices waiting to be announced.
  if(Array.isArray(G._gmRemovedRealms)&&G._gmRemovedRealms.length){
    G._gmRemovedRealms.forEach(idx=>{
      const _pl=(G.players||[])[idx]; if(!_pl) return;
      log('system',`\u{1F3F3} ${_pl.name} has withdrawn from the game and CONCEDES. Its heroes lay down their ambitions and will only defend what they hold from now on.`,{actor:-1,targets:[],system:true,public:true});
    });
    delete G._gmRemovedRealms;
  }

  // ── DELIVER PLAYER-TO-PLAYER MESSAGES ────
  // Each sender's dispatches are filed into every addressee's report as 'message' entries (targets
  // = the recipient, so only they see it). 'all' fans out to every other living human player. The
  // sender is named by realm; empty/oversized text is skipped. A copy is filed back to the SENDER
  // too (as a sent-confirmation) so they have a record of what they sent, in their own report.
  {
    const humanIdx=(G.players||[]).map((p,i)=>i).filter(i=>{ const gp=freshPlayers.find(x=>x.player_index===i); return gp && gp.user_id; });
    Object.keys(playerMessages).forEach(sk=>{
      const senderPi=parseInt(sk);
      const senderName=G.players[senderPi]?.name||('Player '+(senderPi+1));
      (playerMessages[senderPi]||[]).forEach(msg=>{
        if(!msg||typeof msg.text!=='string') return;
        const text=msg.text.trim().slice(0,1000);
        if(!text) return;
        let rcpts;
        if(msg.to==='all'||(Array.isArray(msg.to)&&msg.to.includes('all'))){
          rcpts=humanIdx.filter(i=>i!==senderPi);
        } else if(Array.isArray(msg.to)){
          rcpts=msg.to.map(x=>parseInt(x)).filter(i=>Number.isInteger(i)&&i!==senderPi&&i>=0&&i<(G.players||[]).length);
        } else { rcpts=[]; }
        rcpts=[...new Set(rcpts)];
        if(rcpts.length===0) return;
        const rcptNames=rcpts.map(i=>G.players[i]?.name||('Player '+(i+1)));
        // The addressee's copy must NOT name the sender as `actor`: the report filter shows a
        // player every entry where actor===them, so the sender was being handed the
        // incoming-dispatch line as well as their own sent-confirmation — reading their own words
        // as though addressed to them. charId is nulled for the same reason (log() falls back to
        // _logCtx.charId when it is null).
        const _savedDispatchChar=turnContext._logCtx.charId; turnContext._logCtx.charId=null;
        rcpts.forEach(rpi=>{
          log('message',`📨 Dispatch from ${senderName}: “${text}”`,{actor:null,targets:[rpi],phase:99,public:false});
        });
        turnContext._logCtx.charId=_savedDispatchChar;
        // Sender's own copy (confirmation of what they sent, and to whom).
        log('message',`📨 You sent to ${rcptNames.join(', ')}: “${text}”`,{actor:senderPi,targets:[senderPi],phase:99,public:false});
      });
    });
  }

  // incidental skill-rises (those NOT tied to a battle narrative) are buffered here and flushed at
  // the END of the phase, so a line like "…Explorer rises to level 1…" reads as the consequence it
  // is — reported after the move/action that earned it, not jumping ahead of it.
  turnContext._deferredSkillLogs=[];
  // set while the Hunting Rumours odds simulation runs fights in the background — no sandbox fight
  // may ever train a real skill (see simulateLairOdds).
  turnContext._pcSimulating=false;

  // Record killed armies into province grave pool for Skeletal Armies spell Elven army units of an
  // Elven KINGDOM that would fall in battle have a terrain-based chance to slip the field and make
  // for home instead of dying. The chance is decided here, at the moment of loss; the survivor is
  // DELIVERED at the end of the turn (see flushElvenEscapes), to the king's home province — or, if
  // that has been lost, the realm's wealthiest remaining province — so the destination reflects
  // final ownership. Desert/mountain 30%, plains 45%, forest/jungle 60%.
  const _elvenEscapeQueue=[];
  turnContext._elvenEscapeQueue=_elvenEscapeQueue;

  // Process one order

  // Test hook (headless harnesses only): expose the encounter resolvers nested in runTurn.
  try{ if(typeof window!=='undefined') window._kcTest={G,resolveEncounter:(...a)=>resolveEncounter(turnContext,...a),resolvePersonalCombat:(...a)=>resolvePersonalCombat(turnContext,...a),resolveCharVsChar:(...a)=>resolveCharVsChar(turnContext,...a),combatVsChar:(...a)=>combatVsChar(turnContext,...a),effStat:(...a)=>effStat(turnContext,...a),rng,pcCharCombatant:(...a)=>pcCharCombatant(turnContext,...a),pcMonsterCombatant,trySkillGain:(...a)=>trySkillGain(turnContext,...a),resolveDuel:(...a)=>resolveDuel(turnContext,...a),duelFleeItemDrop:(...a)=>duelFleeItemDrop(turnContext,...a),pcCastCombatSpell:(...a)=>pcCastCombatSpell(turnContext,...a),preBattleDuel:(...a)=>preBattleDuel(turnContext,...a),awardWinHp:(...a)=>awardWinHp(turnContext,...a),awardKillXP:(...a)=>awardKillXP(turnContext,...a)}; }catch(e){}

  function processOrder(c,o,ph){
    if(!c||!c.alive||!o) return;
    // If this hero was unified into another's battle this phase, their own order is superseded
    if(o._unifiedWith!=null){
      // filed under the hero himself (2026-10-09, Toby item 1): with no charId it fell into Realm Events
      log('move',`${c.name}'s order superseded — they unified with ${G.characters.find(x=>x.id===o._unifiedWith)?.name||'another hero'}'s forces this phase.`,{actor:c.player,targets:[c.player],charId:c.id,phase:ph});
      turnContext._logCtx={charId:null,phase:null};return;
    }
    turnContext._logCtx={charId:c.id,phase:ph}; // all log() calls inside here will inherit this
    const rawAction=(o.action||'defend').toLowerCase().trim();
    let action=PHASE_ACTION_MAP[rawAction]||'defend';
    let _fmSlip=false; // MARCH L7 Forced March: set below when a forced-march move should try to slip past battle
    // 2026-09-28: a BOT slayer's second / third lair of the year carries _botMinHp — if an earlier fight left him
    // below that share of his HP, he rests instead of walking into another guardian half-dead. (Never set on
    // a player's order.)
    // 2026-09-29 (Toby): a BOT's Practice on a skill that has reached 5 SINCE its orders were written (an earlier
    // phase's practice or experience in the field this turn) switches to its next skill below 5 — unless it is
    // teaching a comrade practising that skill beside it this phase, or drilling troops that can still improve.
    if(action==='practice'&&c.player!=null&&_botPlayerIdx&&_botPlayerIdx.has(c.player)&&o.target){
      const _S=String(o.target); const _sn=(G._phaseSkillSnapshot||{})[c.id]||c.skills||{}; const _myL=_sn[_S]||0;
      if(_myL>=5&&!((_S==='tactical'||_S==='naval')&&botDrillUseful(c,_S))){
        const _teaching=(G.characters||[]).some(t=>t&&t.alive&&t.id!==c.id&&t.player===c.player&&t.location===c.location&&(()=>{ const k=(G.turnOrders[t.id]||[])[ph]; return k&&normaliseAction(k)==='practice'&&String(k.target)===_S&&(((G._phaseSkillSnapshot||{})[t.id]||t.skills||{})[_S]||0)<_myL; })());
        if(!_teaching){ const _nx=botPracticeSkill(c); if(_nx){ o={...o,target:_nx,desc:'Practice '+(SKILL_LABELS[_nx]||_nx)}; } else { action='defend'; } }
      }
    }
    if(action==='search'&&o._botMinHp&&c.player!=null&&(c.hp!=null?c.hp:(c.maxHp||20))<(c.maxHp||20)*o._botMinHp){
      log('explore',`${c.name} is too badly hurt to face another guardian this season and rests instead.`,{actor:c.player,targets:[c.player],provinceId:c.location});
      action='rest'; }
    // 2026-09-28 (option 2): a bot's "search if the talk is good" — only on a rumour THIS hero heard THIS turn about
    // this lair, at the band the order names (or the lower band for a Weak lair when he is at full health).
    if(action==='search'&&o._botIfRumour&&c.player!=null){
      const _pv=G.world.provinces[c.location]; const _f=_pv&&(_pv.features||[])[parseInt(o.target)]; const _r=_f&&_f._rumourOdds&&_f._rumourOdds[c.player];
      const _hpR=(c.hp!=null?c.hp:(c.maxHp||20))/(c.maxHp||20);
      const _ok=!!(_r&&_r.charId===c.id&&_r.turn===G.turn&&(_r.band>=o._botIfRumour||(o._botIfRumourLow&&_r.band>=o._botIfRumourLow&&_hpR>=(o._botIfRumourLowHp||0.95))));
      if(!_ok){ log('explore',`${c.name} weighs what the taverns said of the ${_f?_f.name:'lair'} and leaves it for another day.`,{actor:c.player,targets:[c.player],provinceId:c.location}); action='rest'; } }
    // 2026-09-29 (Toby, lair study): a Search names its lair by INDEX within a province. When the move
    // meant to carry the searcher there fell short (pinned, blocked, pool spent), the old search ran
    // on whatever lair sat at that index where he actually stood, or on ANY uncleared lair there, so
    // untrained heroes died to Moderate guardians nobody chose (40 bot games: 12 such deaths). Every
    // bot search, and every player search from this build on, carries `prov`, the province it was
    // written for; standing anywhere else, the searcher does not go in.
    if(action==='search'&&o.prov!=null&&o.prov!==''&&String(o.prov)!==String(c.location)){
      const _pw=G.world.provinces[parseInt(o.prov)];
      log('explore',`${c.name} never reaches the lair they set out for${_pw?` in ${_pw.name}`:''}, and will not go blind into another — the search is abandoned and they rest instead.`,{actor:c.player,targets:[c.player],provinceId:c.location});
      action='rest'; }
    const target=o.target||'';
    const extra=o.extra||'';
    const prov=provOf(turnContext,c);
    const player=G.players[c.player];

    // ── BATTLE LOCK, RE-CHECKED AT THE MOMENT OF MARCHING ────
    // STAGE 1b already pins army-leaders standing in a contested province, but it is computed ONCE,
    // at the top of the phase, from the flags as they stood then. A battle joined DURING the phase
    // — an invader marching in and being thrown back, say — raises _battleUnresolved AFTER that
    // pass has run, so the other side's own Move order, processed later in the same phase, marched
    // straight out of a province it was still locked into.
    //
    // That is the Fairscree report: Ketil's assault was repelled but his host was still the
    // stronger, so he held the field "rather than retreat" and the province was flagged contested —
    // and Boden, who had just won that battle, then sailed away into the Storm Sea and on across
    // two more phases, with the fight behind him never resumed and the ground never decided.
    //
    // Re-checking here, at the instant the relocating order executes, closes that window: a live
    // contest pins BOTH sides until resolveStalledBattles settles it at the top of the next phase.
    // The pin only bites while an armed hostile force is actually standing here — a stale flag left
    // by an enemy who died or withdrew never traps anyone.
    if((action==='move'||action==='encounter'||action==='pursue') && prov && prov._battleUnresolved && (c.armies||[]).length>0){
      const _foeHere=(G.characters||[]).some(x=>x&&(x.alive||x._leaderlessHost)&&x.id!==c.id&&x.location===prov.id
                        &&(x.armies||[]).length>0&&(x.player==null||(x.player!==c.player&&areEnemies(turnContext,c.player,x.player))))
                     || (prov.owner!==c.player && ((prov.neutralDefenders||[]).length>0));
      if(_foeHere){
        log('combat',`${c.name} is still locked in the unresolved battle for ${prov.name} and cannot march away — the enemy is on the field and the fight must be seen through before the column can move on.`,
          {actor:c.player,targets:[c.player],provinceId:prov.id,charId:c.id,phase:ph,pinNotice:true});
        turnContext._logCtx={charId:null,phase:null};return;
      }
    }

    // ── CHARMED ENEMY HERO ── an enemy hero whose command has been seized for the turn will march
    // and fight under your banner, but an enchantment is not an oath: they will not break up their
    // own lord's companies, perform another realm's alignment rites, or spend their own hard-won
    // mastery for a stranger. A WANDERING hero Charmed into permanent service is not restricted —
    // they have genuinely joined the realm and act as any other hero of it. This sits ABOVE the
    // once-per-turn charge below so a refused mastery order is not also spent.
    if(c._charmTempControl){
      const _why=(action==='disband_army')?'break up companies that are not theirs to disband'
                :ALIGNMENT_ORDER_KEYS.has(action)?'perform the rites of a realm they do not serve'
                :MASTERY_ORDER_KEYS.has(action)?'spend their own mastery for a crown that merely holds their mind'
                :null;
      if(_why){
        log('system',`${c.name} is held by an enchantment, not an oath — they will not ${_why}. The order comes to nothing.`,{actor:c.player,targets:[c.player]});
        turnContext._logCtx={charId:null,phase:null};return;
      }
    }

    // ── ONCE PER TURN ── a mastery order may be attempted only once per turn per character.
    if(MASTERY_ORDER_KEYS.has(action)){
      c._masteryOrderUsed=c._masteryOrderUsed||{};
      if(c._masteryOrderUsed[action]===G.turn){
        log('system',`${c.name} has already used their ${MASTERY_ORDER_LABEL[action]||action} mastery this turn \u2014 it may be commanded but once per turn.`,{actor:c.player,targets:[c.player]});
        turnContext._logCtx={charId:null,phase:null};return;
      }
      c._masteryOrderUsed[action]=G.turn;
    }

    // ── MARCH L7 — Forced March ── is now a MOVE with a 50% chance to slip past a battle this
    // phase. Remap it to the move handler (keeping the once-per-turn charge above) and flag the
    // slip locally.
    if(action==='forced_march'){
      if(skillLevel(c,'march')<7){ log('system',`${c.name} lacks the March mastery (7) for a Forced March.`,{actor:c.player,targets:[c.player]}); turnContext._logCtx={charId:null,phase:null}; return; }
      _fmSlip=true; action='move';
    }

    // ── a SPELL ITEM used via Use Item becomes a cast of its spell at a flat 95%. ──
    let _itemCast=null;
    if(action==='use_item'){
      const _sit=(c.items||[]).find(x=>x&&(String(x.id)===String(target)||x.name===target));
      if(_sit&&_sit.effect&&_sit.effect.stat==='castSpell'&&SPELL_DEFS_P[_sit.effect.spell]){ _itemCast={item:_sit.name,spell:_sit.effect.spell}; action='cast_spell'; }
    }
    // ── CHARM BACKLASH ────
    // A Charm that FAILS to take hold (fizzle, resisted, or sliding off a mind swayed last season)
    // may bring the enchanter and their intended victim to blows: CHARM_BACKLASH_PCT chance of a
    // personal encounter on both encounter plans. If EITHER hero leads their plan with Flee there
    // is no encounter at all — one of them wants no part of it and the other cannot force it.
    const CHARM_BACKLASH_PCT=50;
    const charmBacklash=(caster, t, why)=>{
      if(!t||t.alive===false||t.location!==caster.location) return;
      const targetsPi=[caster.player,t.player].filter(x=>x!=null);
      const roll=d100();
      log('system',`📊 Charm backlash — ${t.name} may turn on ${caster.name} (${why}): ${fmtRoll(CHARM_BACKLASH_PCT,roll)}`,{actor:caster.player,targets:[caster.player],provinceId:prov.id});
      if(roll>CHARM_BACKLASH_PCT) return;
      ensureEncounterPlan(turnContext,caster); ensureEncounterPlan(turnContext,t);
      const leadsFlee=(ch)=>{ const first=String(((ch.encounterPlan&&ch.encounterPlan.tactics)||['ME'])[0]||'').split(':')[0].toUpperCase(); return first==='FL'||first==='FLEE'; };
      if(leadsFlee(caster)||leadsFlee(t)){
        const who=leadsFlee(caster)?caster:t;
        log('system',`${t.name} rounds on ${caster.name} as the enchantment fails — but ${who.name} is already slipping away, and there is no encounter.`,{actor:caster.player,targets:targetsPi,provinceId:prov.id,charIds:[caster.id,t.id]});
        return;
      }
      const COMBAT_ONLY=COMBAT_ONLY_TACTICS;
      const filterPlan=(plan)=>((plan&&plan.tactics)||['ME']).filter(x=>COMBAT_ONLY.has(String(x).split(':')[0].toUpperCase())||String(x).toUpperCase().startsWith('CA:'));
      const atkPlan=filterPlan(t.encounterPlan); if(!atkPlan.length) atkPlan.push('ME');
      const defPlan=filterPlan(caster.encounterPlan); if(!defPlan.length) defPlan.push('ME');
      const _duelChars=[t.id,caster.id];
      log('combat',`⚔ ${t.name} feels the enchantment clawing at their mind and rounds on ${caster.name} — blades are drawn!`,{actor:caster.player,targets:targetsPi,provinceId:prov.id,public:true,charIds:_duelChars});
      markProvinceCombat(prov,[caster.player,t.player]);
      const enc=resolveCharVsChar(turnContext,t,caster,atkPlan,defPlan,prov,(...a)=>effStat(turnContext,...a),rng,G);
      enc.narrative.forEach(line=>emitNarrLine(turnContext,'combat',line,{actor:caster.player,targets:targetsPi,provinceId:prov.id,charIds:_duelChars}));
      if(t.player!==null) t.hp=Math.max(1,enc.atkHp);
      caster.hp=Math.max(1,enc.defHp);
      if(enc.atkKilled||enc.atkHp<=0){ if(_escapesTheEnd(t)){ if(t.hp!=null&&t.hp<=0) t.hp=1; log('combat',_garrethEscapeLine(t),{actor:caster.player,targets:targetsPi,provinceId:prov.id,public:true,charIds:_duelChars}); } else { reportHeroFall(turnContext,t,caster,`${t.name} is cut down by the enchanter they turned on.`,{actor:caster.player,targets:targetsPi,provinceId:prov.id,public:true,charIds:_duelChars}); awardKillXP(turnContext,caster,t); } }
      if(enc.defKilled||enc.defHp<=0){ if(_escapesTheEnd(caster)){ if(caster.hp!=null&&caster.hp<=0) caster.hp=1; log('combat',_garrethEscapeLine(caster),{actor:caster.player,targets:targetsPi,provinceId:prov.id,public:true,charIds:_duelChars}); } else { reportHeroFall(turnContext,caster,t,`${caster.name} is slain — the failed Charm was their last spell.`,{actor:caster.player,targets:targetsPi,provinceId:prov.id,public:true,charIds:_duelChars}); awardKillXP(turnContext,t,caster); } }
    };

    switch(action){
      case 'move': resolveMoveOrder(turnContext, c, ph, _fmSlip, target, prov, player); break;
      case 'explore': resolveExploreOrder(turnContext, c, prov); break;
      case 'rite': resolvePerformRiteOrder(turnContext, c, ph, target, extra, prov, player); break;
      case 'hunt_rumours': resolveHuntingRumoursOrder(turnContext, c, target, prov, player); break;

      case 'search': resolveSearchLairOrder(turnContext, c, ph, target, prov, player); break;
      case 'recruit': resolveRecruitArmiesOrder(turnContext, c, ph, target, extra, prov, player); break;
      case 'hire': resolveHireHeroOrder(turnContext, c, ph, target, prov, player); break;
      case 'spy': resolveSpyOrder(turnContext, c, target, prov); break;
      case 'consecrate': resolveConsecrateOrder(turnContext, c, prov, player); break;
      case 'call_to_arms': resolveCallToArmsOrder(turnContext, c, target, player); break;
      case 'broker': resolveBrokerOrder(turnContext, c, ph, target, player); break;
      case 'awaken_wild':
      case 'call_pit': resolveRemovedAwakenTheWildAndCallFromThePitOrders(turnContext, c, action); break;
      case 'harvest_field': resolveHarvestTheFieldOrder(turnContext, c, ph, prov, player); break;
      case 'research': resolveResearchOrder(turnContext, c, ph, target, player); break;
      case 'practice': resolvePracticeSkillOrder(turnContext, c, ph, target); break;
      case 'equip_items': resolveEquipItemsOrder(turnContext, c, target); break;
      case 'use_item': resolveUseItemOrder(turnContext, c, target, prov); break;
      case 'rest': resolveRestOrder(turnContext, c, prov); break;
      case 'give_item': resolveSendItemOrder(turnContext, c, ph, target, extra); break;
      case 'leave_army': resolveLeaveOrTransferArmyOrder(turnContext, c, ph, target, extra, prov); break;
      case 'release': resolveReleaseHeroOrder(turnContext, c, ph, prov, player); break;
      case 'disband_army': resolveDisbandArmyOrder(turnContext, c, target, prov); break;

      case 'pickup_army': resolvePickUpArmyOrder(turnContext, c, target, prov); break;
      case 'encounter':{
        // Encounter Character no longer requires the quarry to be standing in the same province.
        // The hero sets out and CHASES the target wherever they go — one province per phase, a
        // movement point each — and forces the meeting once he catches them. Targeting/visibility
        // is enforced on the order form
        // (you may name any enemy you can see: in a province you own, one you have a character in, or
        // one you spied). The chase + catch + duel is resolved in advancePursuit below.
        const targetId=parseInt(target);
        const quarry=(G.characters||[]).find(x=>x.alive&&x.id===targetId);
        if(!quarry){
          log('system',`${c.name} casts about for a quarry to hunt down but finds no trail to follow.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;
        }
        if(quarry.id===c.id){
          log('system',`${c.name} cannot set out to encounter themself.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;
        }
        // a seized ENEMY hero will not raise a hand against their own lord's people — no Encounter
        // against a character of the original owner. Any other realm's heroes are fair game as
        // usual.
        if(c._charmTempControl&&c._charmOriginalPlayer!=null&&quarry.player===c._charmOriginalPlayer){
          log('system',`${c.name} will not hunt ${quarry.name} — the Charm bends their will, but not so far as to turn them on their own lord's people.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;
        }
        // only a king may run down an enemy king. A common hero can never force a meeting with a
        // rival monarch — a king answers only to another crown. (Once caught, a king is no harder
        // to run down than any hero: pursuitCatchChance treats them the same.)
        if(quarry.isKing && !c.isKing && quarry.player!==c.player){
          log('system',`${c.name} sets out after ${quarry.name}, but a rival king does not answer to a common hero — only a king may run down another king. The chase is abandoned.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;
        }
        if(quarry.player!==c.player&&isHiddenChar(turnContext,quarry)){
          log('system',`${c.name} sets out after ${quarry.name}, but they are cloaked and leave no trail to follow.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;
        }
        // A mutual pair of Encounter orders (each hunting the other) resolves as ONE meeting.
        if(c._encounteredThisPhase===quarry.id||quarry._encounteredThisPhase===c.id){ break; }
        // THIEF L9 Vanish: no Encounter can be forced on someone who has melted into the shadows.
        if(quarry._vanishTurn===G.turn&&quarry.player!==c.player){
          log('move',`${c.name} sets out after ${quarry.name}, but there is no trail to follow — the quarry has vanished into the shadows.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
        c._pursuit={targetId:quarry.id, active:true, setPhase:ph};
        delete c._defend; // a chase cancels a standing Defend (AK [3.15])
        log('move',`${c.name} sets out to run down ${quarry.name} and will not turn aside until the matter is settled.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        advancePursuit(turnContext,c,ph);
        break;
      }

      case 'steal': resolveStealOrder(turnContext, c, target, prov, player); break;

      case 'defend':{
        // A move that was cancelled by the invasion interlock is rewritten to a Defend order; the
        // interlock already logged a much better line, so don't tack a bland one on top of it.
        if(o._pinned) break;
        // item 15: this phase's Defend order has already been answered in battle (the watch was on
        // from the top of the phase) — it does not set the watch again.
        if(defendSpentThisPhase(turnContext,c,ph)){
          log('move',`🛡 ${c.name} has met this season's threat in battle — their Defend order is done, and they set no new watch until ordered to Defend in a later season.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          break;
        }
        // Defend needs no target — it always guards the province the character stands in. The watch
        // covers that province plus its immediate neighbours (see inDefendZone), and he rides out
        // to meet any incursion into an adjacent province. Any target still supplied by an older
        // saved order is ignored. Persists for the rest of the turn.
        const centreProv=prov;
        // if the watch was pre-activated at the top of this phase (and may already have ridden out
        // once), keep its one-reaction-per-phase marker.
        const _preSet=!!(c._defend&&c._defend.active&&c._defend.setPhase===ph&&c._defend.preActivated);
        // a watch carried over unbroken from an earlier phase is not announced again every phase
        const _carried=!!(c._defend&&c._defend.active&&(c._defend.carried||c._defend.setPhase<ph));
        c._defend={centre:centreProv.id,active:true,setPhase:ph,carried:_carried};
        if(!_preSet) delete c._defendReactedPhase;
        if(_preSet&&c._defendReactedPhase===ph){
          // the watch already acted this phase (rode out / held the gate) and said so; a "makes
          // camp" line after the ride-out would read backwards
        } else if(_carried){
          // still on watch. 2026-09-23 (Toby item 10): this used to print NOTHING, so a character
          // who set a watch in Early Summer and held it through Fall and Early Winter showed only
          // the phases before it — Sorrek the Kinless's Chronicle stopped at Late Summer. One short
          // line per phase keeps every season accounted for.
          log('move',(c.armies||[]).length===0
            ? `🛡 ${c.name} still lies in wait about ${prov.name}.`
            : `🛡 ${c.name} keeps the watch in ${prov.name}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        } else if((c.armies||[]).length===0){
          log('move',`${c.name} melts into the country around ${prov.name} and lies in wait — with no column at their back they cannot bar a road, but they will try to ambush any enemy who ventures into these lands (their Spy craft decides whether they can spring the trap).`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        } else if(centreProv.id===prov.id){
          log('move',`${c.name} makes camp in ${prov.name} and sets a watch — their column will answer any incursion into the lands about them for the rest of the year.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        } else {
          log('move',`${c.name} sets a watch from ${prov.name} over the country around ${centreProv.name} — their column will ride to meet any incursion there for the rest of the year.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        }
        break;
      }

      // the standalone 'pursue' case is removed — Pursue is folded into Encounter Character (see
      // the 'encounter' case above), and PHASE_ACTION_MAP aliases any saved 'pursue' order to
      // 'encounter' so in-flight games resolve cleanly.

      case 'cast_spell':{
        // target = spell name, extra = target province id or character id (if needed)
        const spellName=_itemCast?_itemCast.spell:target;
        const spellDef=SPELL_DEFS_P[spellName];
        if(!spellDef){log('system',`${c.name}: unknown spell "${spellName}".`,{actor:c.player,targets:[c.player]});break;}
        if(!spellDef.phase){log('system',`${c.name}: ${spellName} cannot be used as a phase order.`,{actor:c.player,targets:[c.player]});break;}
        // a seized ENEMY hero will not turn hostile magic on their own lord's characters (the same
        // rule as Encounter) — refused BEFORE the cast is even attempted, so it costs no casting
        // slot. Other realms' heroes: as normal.
        if(c._charmTempControl&&c._charmOriginalPlayer!=null&&CHARMED_NO_TURN_SPELLS.has(spellName)){
          const _lordChar=G.characters.find(ch=>ch.alive&&ch.id===(parseInt(extra)||-1));
          if(_lordChar&&_lordChar.player===c._charmOriginalPlayer){ log('system',`${c.name} lets the ${spellName} die on their lips — the Charm bends their will, but not so far as to turn them on their own lord's people.`,{actor:c.player,targets:[c.player],provinceId:prov.id});o._castNotWorked=true;break; }
        }

        // Enforce action spell limits (AK rules): level 1-2 → 1/turn, level 3 → 2/turn, level 4-5 → 3/turn
        if(!_itemCast){
          const _school=spellDef.school;
          const _lvl=effStat(turnContext,c,_school);
          const _limit=(_lvl>=4?3:_lvl>=3?2:1)+((charMinor(turnContext,c,'warlock')&&_BEST_SCHOOL(c)===skillLevel(c,_school))?1:0); // Warlock minor (Archmage +1-cast perk removed \u2014 now an intel line)
          const _divCath=gdActive(turnContext,c.player,'Divine'); // GRAND DESIGN — Divine (Grand Cathedral): Bless uses no casting slot
          // NORMALISE the saved action: the player portal writes "Cast Spell", the bots write
          // "cast_spell". Comparing the raw string counted only the bots' casts, so a human caster
          // had NO per-turn limit at all (a Psychic 1 hero could work five action spells a season).
          // The spell key is "Bless Province", never "Bless" — the old test never matched, so a
          // Grand Cathedral's free Bless was not free either. An order the engine REFUSED before it
          // was ever worked (_castNotWorked) costs no slot.
          const _castsSoFar=(G.turnOrders[c.id]||[]).slice(0,ph).filter(o=>{
            if(!o||normaliseAction(o)!=='cast_spell') return false;
            if(o._castNotWorked) return false;             // never left the caster's lips
            if(o.target==='Bless Province'&&_divCath) return false; // a Grand Cathedral's Bless never consumes a slot
            return SPELL_DEFS_P[o.target]?.school===_school;
          }).length;
          if(_castsSoFar>=_limit&&_lvl>0&&!(spellName==='Bless Province'&&_divCath)){
            o._castNotWorked=true; // 2026-10-13 (item 16): a blocked cast is never worked, so it spends no slot either
            log('system',`${c.name}: ${SKILL_LABELS[_school]||_school} level ${_lvl} casting limit (${_castsSoFar}/${_limit} per turn). ${spellName} blocked.`,{actor:c.player,targets:[c.player]});break;
          }
        }

        const school=spellDef.school;
        const spellLevel=_itemCast?Math.max(3,effStat(turnContext,c,school)):effStat(turnContext,c,school); // a spell item works as at least level 3
        const spellLevelEff=Math.min(spellLevel,5); // spell EFFECTS cap at caster level 5; cast chance keeps the full level
        if(spellLevel===0){
          // Check if they were trying to cast after a practice order this turn
          // (the practice didn't raise the skill, so the cast fails gracefully). 2026-10-13 (Toby,
          // item 16): the order form lets a hero queue casts on the assumption that every earlier
          // practice succeeds, so a cast refused here spends no casting slot — a later practice that
          // does succeed still opens the later casts the form promised.
          o._castNotWorked=true;
          log('system',`${c.name} attempts to cast ${spellName} but lacks the required ${SKILL_LABELS[school]||school} skill — the practice order earlier this turn did not result in a skill gain. The spell fails.`,{actor:c.player,targets:[c.player]});
          break;
        }
        // L7/L9 mastery spells require the RAW school level (past-5 comes from experience only).
        if(_itemCast && spellDef.reqLevel){ log('system',`${c.name}: the ${_itemCast.item} can no longer work ${spellName} — such mastery must be earned, not carried. The item lies inert.`,{actor:c.player,targets:[c.player]});break; } // Item 6
        if(!_itemCast && spellDef.reqLevel && skillLevel(c,school) < spellDef.reqLevel){
          o._castNotWorked=true; // never worked: no casting slot spent (item 16)
          log('system',`${c.name} cannot yet wield ${spellName} — it demands ${SKILL_LABELS[school]||school} level ${spellDef.reqLevel}, and they have reached only ${skillLevel(c,school)}.`,{actor:c.player,targets:[c.player]});
          break;
        }

        // ── ONCE PER TURN ── a mastery spell (L7/L9, has reqLevel) may be attempted only once per
        // turn per caster. Base spells keep the per-school casting limit above; this is the extra
        // cap.
        if(spellDef.reqLevel){
          c._masterySpellUsed=c._masterySpellUsed||{};
          if(c._masterySpellUsed[spellName]===G.turn){
            o._castNotWorked=true; // never worked: no casting slot spent (item 16)
            log('system',`${c.name} has already invoked ${spellName} this turn \u2014 such mastery may be worked but once per turn.`,{actor:c.player,targets:[c.player]});break;
          }
          c._masterySpellUsed[spellName]=G.turn;
        }

        // Cast chance — computed by the shared castChanceFor() so the player's order form can quote
        // exactly what will be rolled here (see the helper beside MAGIC_L8_SCHOOLS). Wailing
        // Phylactery: the first Necromancy spell each turn cannot fail.
        const necroAuto = school==='necromancy' && !c._necroAutoUsed && activeItems(c).some(it=>it.effect&&it.effect.stat==='necroAuto');
        const castChance=castChanceFor(c,school,G.players[c.player],{chars:G.characters||[],itemCast:!!_itemCast,necroAuto}).chance;
        if(necroAuto&&!_itemCast) c._necroAutoUsed=true;
        // ── TARGET STILL HERE? ── Refused BEFORE the roll, so a spell that was never worked costs
        // neither the cast nor the turn's casting slot. This is what a caster meets when the hero
        // they aimed at has left the province — most often a general on Defend who rode out to a
        // threatened neighbour at the top of the phase, before any order resolved.
        if(SPELL_FNS_NEED_COLOCATED_TARGET.has(spellDef.fn)){
          const _tid=parseInt(extra);
          const _t=Number.isInteger(_tid)?(G.characters||[]).find(ch=>ch&&ch.alive&&ch.id===_tid):null;
          if(_t&&_t.location!==c.location){
            const _tp=G.world.provinces[_t.location];
            const _own=(_t.player===c.player);
            o._castNotWorked=true; // costs no casting slot for the rest of the turn
            log('system',`${c.name} looks for ${_t.name} to work ${spellName} upon, and finds them gone — ${_own?'they had already marched':'they had already moved'} on to ${_tp?_tp.name:'another province'} before the spell could be shaped. It is never worked, and costs ${c.name} nothing.`,
              {actor:c.player,targets:[c.player],provinceId:prov.id,charId:c.id,phase:ph});
            break;
          }
        }
        const castRoll=d100();
        try{ _tel.spells.push({ph, pi:c.player, charId:c.id, spell:spellName, school, lvl:spellLevel, chance:castChance, ok:castRoll<=castChance, item:!!_itemCast}); }catch(_te){}
        if(_itemCast){ log('system',`🔮 ${c.name} invokes the ${_itemCast.item} to work ${spellName}.`,{actor:c.player,targets:[c.player],provinceId:prov.id}); trySkillGain(turnContext,c,'sage',SKILLGAIN_COMMON); } // 2026-09-21: using a magic item may teach Sage (small chance)
        log('system',`📊 ${c.name} casts ${spellName} (${SKILL_LABELS[school]||school} ${spellLevel}${(()=>{ const _tr=skillLevel(c,school); return (_tr<spellLevel)?` — ${_tr} trained, +${spellLevel-_tr} from ${_itemCast?'the item':'items'}`:''; })()}): ${castChance}% chance [roll ${castRoll}${castRoll<=castChance?' ✓':' ✗'}]`,{actor:c.player,targets:[c.player],provinceId:prov.id});

        if(castRoll>castChance){
          log('system',`${c.name}'s ${spellName} fizzles — the spell dissipates without effect.`,{actor:c.player,targets:[c.player]});
          if(!_itemCast) trySkillGain(turnContext,c,school,SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn (an item's cast teaches nothing when it fails)
          // a fizzled Charm may bring its intended victim down on the caster.
          if(spellDef.fn==='psychic_charm'){ const _ct=G.characters.find(ch=>ch.alive&&ch.id===(parseInt(extra)||-1)); if(_ct&&_ct.player!==c.player&&!_ct.isKing) charmBacklash(c,_ct,'the spell fizzled'); }
          break;
        }

        // Sept 2026: the old MAGIC BASE PERK (every successful cast raised current & max HP by 3-5)
        // is REMOVED. Casting no longer affects HP in any way — the max-HP ceiling grows only
        // through kills, lairs, Orc Vigour and skill training.
        if(school==='necromancy') TM(c).darkCasts=(TM(c).darkCasts||0)+1; // TITLE MERIT: Deathpriest
        // Resolve spell effect
        const fn=spellDef.fn;
        // a pre-order hero named as the target of a friendly spell resolves to their real id; a
        // synthetic id used to parse as NaN → 0 and aimed the spell at character 0 (2026-09-23).
        const extraId=isPreOrderRef(extra)?((orderCharRef(G,extra)||{id:-1}).id):(parseInt(extra)||0);
        const targetProv=extraId>=0&&G.world.provinces[extraId]?G.world.provinces[extraId]:prov;
        const targetChar=G.characters.find(ch=>ch.alive&&ch.id===extraId);
        // THIEF L9 Vanish: a vanished character cannot be reached by ANY hostile spell for the rest
        // of the turn.
        if(targetChar&&targetChar.player!==c.player&&isVanished(turnContext,targetChar)){
          log('system',`${c.name}'s ${spellName} gropes after ${targetChar.name} and finds only shadow — they have vanished, and nothing may touch them this season.`,{actor:c.player,targets:[c.player]});break;
        }
        // ILLUSORY L9 Veil: a veiled character (and the host they lead) cannot be reached by ANY
        // hostile spell while the veil holds.
        if(targetChar&&targetChar.player!==c.player&&isVeiled(turnContext,targetChar)){
          log('system',`${c.name}'s ${spellName} cannot reach ${targetChar.name} — they and their host are veiled from all hostile magic.`,{actor:c.player,targets:[c.player]});break;
        }
        // Cloak of Many Faces: shields the wearer from hostile Psychic Blast / Curse.
        if(targetChar&&targetChar.player!==c.player&&isHiddenChar(turnContext,targetChar)&&(spellName==='Psychic Blast'||spellName==='Curse')){
          log('system',`${c.name}'s ${spellName} cannot find ${targetChar.name} — they are cloaked from hostile magic.`,{actor:c.player,targets:[c.player]});break;
        }

        // ── WHITE ──
        if(fn==='white_resurrect'){
          // Bring a slain (non-king) hero back to life, WITHOUT their possessions. The body must
          // lie in the caster's province, the player must know of the death, and no-one may have
          // raised them earlier this turn. (We use the caster's current province as the resting
          // place.)
          if(!G.heroGraveyard) G.heroGraveyard=[];
          if(!G._resurrectedThisTurn) G._resurrectedThisTurn=[];
          // A fallen MONARCH's body was borne home when he died and stays there, even if that
          // province has since been captured (2026-10-08, Toby item 1) — never move it here.
          const knownIds=new Set(G.players[c.player]?.knownDeadHeroIds||[]);
          // the body must lie in the CASTER'S OWN province for any of this to resolve — and a
          // caster standing over a corpse can plainly see it. Requiring a remembered death as well
          // meant a visible body could never be raised. (Monarch graves keep their own separate
          // guards below: only the fallen king's own realm, only the most recent monarch.)
          const _graveKnown=(g)=>!!g&&(knownIds.has(g.id)||g.location===c.location);
          // Resolve which grave: honour the EXPLICITLY chosen body (needed so a player can name
          // their fallen king rather than whatever corpse is freshest), else the most recent known
          // body here.
          // (targetChar only matches LIVE characters, so a dead target never bound here before — the
          // selection silently fell through to "most recent". Match the graveyard by id directly.)
          const _explicitGraveId=(extra!=null&&String(extra).trim()!=='')?parseInt(extra):NaN;
          const grave=Number.isInteger(_explicitGraveId)
            ? G.heroGraveyard.find(g=>g.id===_explicitGraveId&&g.location===c.location&&_graveKnown(g))
            : G.heroGraveyard.filter(g=>g.location===c.location&&_graveKnown(g)).sort((a,b)=>b.killedOnTurn-a.killedOnTurn)[0];
          if(!grave){
            log('system',`${c.name} casts Resurrect, but no fallen hero you know of lies in ${prov.name} — perhaps another raised them first.`,{actor:c.player,targets:[c.player]});break;
          }
          // MONARCH grave: only the realm that the king ruled may recall him, and only the MOST
          // RECENTLY fallen monarch of that line — earlier kings have passed beyond recall.
          if(grave._monarch){
            if(grave.player!==c.player){ log('system',`${c.name}: the fallen crown of ${grave.name} answers only to its own realm — no rival's prayer will restore it.`,{actor:c.player,targets:[c.player]});break; }
            if(G.players[c.player]?._resurrectableMonarchId!==grave.id){ log('system',`${c.name}: the spirit of ${grave.name} has passed beyond recall — only your most recently fallen monarch may be restored.`,{actor:c.player,targets:[c.player]});break; }
          } else if(grave.isKing){
            log('system',`${c.name}: ${grave.name} was a king — kings cannot be resurrected.`,{actor:c.player,targets:[c.player]});break;
          } else if(graveServedOther(grave,c.player)){
            // 2026-09-23 (Toby): a hero who ever served ANOTHER realm cannot be raised into yours.
            log('system',`${c.name}: ${grave.name} once swore to another crown — that oath holds even in death, and the spirit will not answer.`,{actor:c.player,targets:[c.player]});break;
          }
          if(G._resurrectedThisTurn.includes(grave.id)){ log('system',`${c.name}: ${grave.name} has already been raised this turn.`,{actor:c.player,targets:[c.player]});break; }
          const deadHero=G.characters.find(ch=>ch.id===grave.id);
          if(!deadHero){log('system',`${c.name}: the spirit of ${grave.name} cannot be found.`,{actor:c.player,targets:[c.player]});break;}
          if(!grave._monarch && deadHero.isKing){ log('system',`${c.name}: kings cannot be resurrected.`,{actor:c.player,targets:[c.player]});break; }
          // Revive — at full health, WITHOUT any possessions carried in life.
          deadHero.alive=true;
          TM(c).holyCasts+=1; // TITLE MERIT: Hierophant
          deadHero.hp=deadHero.maxHp||20;
          deadHero.location=c.location;
          deadHero.killedThisTurn=false; deadHero._justDefeated=false;
          deadHero.items=[]; deadHero.armies=[]; // raised without possessions
          if(grave._monarch){
            // The rightful king returns to his own throne. The body was borne home, so he is raised
            // ONLY by his own realm (guarded above) and reclaims the crown. Any reigning king or
            // freshly-crowned heir steps down to serve as a normal hero of the realm.
            deadHero.player=grave.player;
            const curMonarch=G.characters.find(k=>k.isKing&&k.player===grave.player&&k.alive&&k.id!==deadHero.id);
            if(curMonarch){
              curMonarch.isKing=false; curMonarch._isHeir=false; curMonarch._pendingSkillAllocation=0;
              log('system',`👑 ${curMonarch.name} steps down from the throne as ${deadHero.name} is restored to life — the former regent now serves the realm as a hero.`,{actor:grave.player,targets:[grave.player],provinceId:prov.id}/* 2026-09-27 (Toby item 6): realm-private — never public */);
            }
            deadHero.isKing=true; deadHero._isHeir=false; deadHero._pendingSkillAllocation=0;
            if(G.players[grave.player]) G.players[grave.player]._resurrectableMonarchId=null; // slot spent — he lives again
          } else {
            deadHero.player=c.player; // an ordinary raised hero serves the caster's realm
            deadHero.isKing=false;
            claimWandererName(deadHero); // a raised wanderer now serves this crown
          }
          if(!prov.characters.includes(deadHero.id)) prov.characters.push(deadHero.id);
          G.heroGraveyard=(G.heroGraveyard||[]).filter(g=>g.id!==grave.id);
          G._resurrectedThisTurn.push(grave.id);
          const wasEnemy=(grave.player!=null&&grave.player!==c.player);
          if(grave._monarch){
            log('explore',`✨👑 ${c.name} calls upon divine power — ${deadHero.name} rises from death at full health and reclaims the throne of ${player.name}! The rightful king walks again, stripped of all possessions but restored in spirit and skill.`,{actor:c.player,targets:[c.player],provinceId:prov.id}/* 2026-09-27 (Toby item 6): realm-private — never public */);
          } else {
            log('explore',`✨ ${c.name} calls upon divine power — ${deadHero.name} rises from death at full health, stripped of all possessions, and now serves ${player.name}!${wasEnemy?' The fallen foe is bound to a new master.':''}`,{actor:c.player,targets:[c.player],provinceId:prov.id}/* 2026-09-27 (Toby item 6): realm-private — never public */);
          }
          // The raise succeeded — now, and only now, honour any orders this player pre-wrote for
          // this hero. Matched on caster AND hero so a rival's pre-orders for the same corpse are
          // ignored; applied only to phases after the cast, since actingThisPhase() will skip the
          // hero in every earlier phase anyway (they were dead).
          {
            // the player portal now shows ONE order card per fallen hero, whichever of the realm's
            // casters targets them — so the orders apply if ANY of this realm's casters raises the
            // hero
            // (an exact caster match still wins if two cards were somehow submitted). A rival's orders never apply.
            const _pendAll=(G._pendingResurrectOrders||[]);
            const pend=_pendAll.find(x=>x.heroId===deadHero.id && x.casterId===c.id && x.player===c.player)
              ||_pendAll.find(x=>x.heroId===deadHero.id && x.player===c.player);
            if(pend&&Array.isArray(pend.orders)){
              const slots=G.turnOrders[deadHero.id]||[null,null,null,null,null];
              let applied=0;
              pend.orders.forEach((o,pi2)=>{
                if(pi2>ph&&o&&o.action&&o.action!=='Defend'&&o.action!=='defend'){ slots[pi2]=o; applied++; }
              });
              G.turnOrders[deadHero.id]=slots;
              if(applied>0) log('system',`${deadHero.name} takes up the orders ${player.name} laid down for them — ${applied} phase${applied!==1?'s':''} of this turn remain to be acted on.`,{actor:c.player,targets:[c.player]});
            }
            // Step 3 of order ingestion only defaults LIVING characters to Defend, and this hero
            // was a corpse when it ran. Fill the rest of the turn in now so they behave like anyone
            // else.
            const fin=G.turnOrders[deadHero.id]||[null,null,null,null,null];
            for(let pz=0;pz<5;pz++){ if(pz>ph&&!fin[pz]) fin[pz]={action:'defend',target:'',extra:'',desc:'Defend'}; }
            G.turnOrders[deadHero.id]=fin;
            applyPendingSynthPlan(G,deadHero,c.player); // 2026-09-21: the card's encounter plan lands only now
          }
        }
        else if(fn==='white_part_sea'){
          // A sea province the caster is in or adjacent to becomes plains for the rest of the turn.
          // the target may be a sea OR a land province in reach — a land province that has been
          // FLOODED into sea earlier this turn reads as terrain 'sea' at resolution, so Part Sea
          // reverts it (the intended Flood counter); a still-dry land target simply finds no sea to
          // part.
          const casterProv=G.world.provinces[c.location];
          const adjIds=new Set(getNeighborsP(casterProv,G.world.cols,G.world.rows,G.world.provinces).map(p2=>p2&&p2.id).filter(x=>x!=null));
          if(targetProv.id!==c.location&&!adjIds.has(targetProv.id)){
            log('system',`${c.name}: Part Sea can only target a province you are in or next to.`,{actor:c.player,targets:[c.player]});break;
          }
          if(blessWardNegates(turnContext, targetProv, c, 'Part Sea')) break; // Q2: a warded province can turn aside an enemy Part Sea too
          if(targetProv.terrain==='sea'){
            // Part the waters: open sea OR a flooded land province becomes dry plains for the rest
            // of the turn.
            delete targetProv._flooded; // cancel any Flood on this province
            targetProv._partSea={orig:targetProv.terrain, turn:G.turn, blockFleetsFromPhase:ph+1};
            targetProv.terrain='plains';
            log('explore',`✨ ${c.name} raises their hands and the waters of ${targetProv.name} draw back — the seabed lies bare as dry plains for the rest of the turn. Land armies may cross freely, but no fleet can enter or leave from the next phase onward.`,{actor:c.player,targets:[c.player],provinceId:targetProv.id,public:true,env:true});
            notifyProvinceOwner(turnContext, targetProv, `🌊 ${c.name} (${G.players[c.player]?.name||'a foreign realm'}) has parted the sea at ${targetProv.name} — it lies as dry plains for the rest of the turn; land armies may cross it and no fleet may enter or leave from the next phase.`, c.player, ph); // the owner is told
          } else {
            // Cast on dry land — the anticipated Flood never came (or was already parted). There is
            // no sea to part; clear any lingering flood marker and note it. The cast is spent but
            // harmless.
            delete targetProv._flooded;
            log('explore',`✨ ${c.name} calls the waters back from ${targetProv.name}, but the ground already lies dry — the spell finds no sea to part.`,{actor:c.player,targets:[c.player],provinceId:targetProv.id,public:false,env:true});
          }
        }
        else if(fn==='white_holy_symbol'){
          // ACTION FORM (Toby 2026-09-19): the Holy Symbol raised over the caster's own province lays
          // its battlefield dead to rest — every grave there is cleansed, so no necromancer can raise
          // them (Skeletal Armies, Harvest the Field, Raise Wraiths, Death's Dominion, Bind Wraith all
          // draw on prov.battleGraves). Always the province the caster stands in; no target.
          // The combat and battle-magic forms are unchanged.
          const _hsProv=G.world.provinces[c.location]||prov;
          const _dead=(_hsProv.battleGraves||[]).length;
          TM(c).holyCasts+=1; // TITLE MERIT: Hierophant
          if(_dead===0){
            log('explore',`✝ ${c.name} raises the Holy Symbol over ${_hsProv.name}, but no battlefield dead lie unquiet here — there is nothing to cleanse.`,{actor:c.player,targets:[c.player],provinceId:_hsProv.id});
          } else {
            _hsProv.battleGraves=[];
            logSplit(turnContext, 'explore',
              `✝ ${c.name} raises the Holy Symbol over ${_hsProv.name} and the graves of its battlefield dead are cleansed — every fallen unit buried there is laid to rest, beyond the reach of any necromancer.`,
              `✝ ${c.name}${realmTag(turnContext,c.player)} raises a Holy Symbol over the battlefields of ${_hsProv.name}, and the dead buried there are laid to rest — the graves are cleansed and can no longer be raised.`,
              {actor:c.player,provinceId:_hsProv.id,charId:c.id,phase:ph});
          }
          noteGraveIntel(G.players[c.player], _hsProv.id, G.turn, []); // the caster's realm now knows the ground is clean
        }
        else if(fn==='white_bless_province'){
          const casterProv=G.world.provinces[c.location];
          const adjIds=new Set(getNeighborsP(casterProv,G.world.cols,G.world.rows,G.world.provinces).map(p2=>p2&&p2.id).filter(x=>x!=null));
          if(targetProv.id!==c.location&&!adjIds.has(targetProv.id)){
            log('system',`${c.name}: Bless Province can only target a province you are in or adjacent to.`,{actor:c.player,targets:[c.player]});break;
          }
          if(targetProv._blessedTurn===G.turn){
            log('system',`${c.name}: ${targetProv.name} is already blessed this turn — a second Bless has no further effect (they do not stack).`,{actor:c.player,targets:[c.player]});break;
          }
          targetProv._blessedTurn=G.turn;
          // Item: the blessing also WARDS the province — a chance to turn aside a later enemy Flood
          // / Earthquake / Plague / Part Sea. 2026-09-14: base 50% + 5% per point of the caster's
          // White skill, counted to level 5 — so 50% from an untrained blesser up to 75% from a
          // master. (Was 10% + 15%/level, i.e. 25% at White 1 rising to 85% at White 5: the ward is
          // now dependable at every level and much flatter across the ladder.)
          targetProv._blessWardTurn=G.turn; targetProv._blessWardBy=c.player;
          targetProv._blessWardPct=Math.min(100, 50+5*Math.min(5,effStat(turnContext,c,'white'))); // 50% + 5% per White skill level (cap level 5)
          TM(c).holyCasts+=1; // TITLE MERIT: Hierophant
          // DIVINE: a Divine realm's casters bless at +80% (the long-advertised alignment bonus,
          // previously described but never implemented — engine now honours it), and the Divine
          // KING himself blesses at +100% — the gods answer their anointed in full.
          const _divineKingdom=G.players[c.player]?.alignment==='Divine';
          const _divineKingBless=c.isKing&&_divineKingdom;
          targetProv._blessedMult=(_divineKingBless?2.0:(_divineKingdom?1.8:1.6))+discSum(turnContext,c.player,'bless','pct'); // ad09 Rites of Plenty (+0.2)
          const _blessPct=`+${dispFloor((targetProv._blessedMult-1)*100)}% tax`+(_divineKingBless?' (a Divine king\'s blessing — the gods answer their anointed in full)':(_divineKingdom?' (Divine blessing)':''));
          log('explore',`✨ ${c.name} blesses ${targetProv.name} — its lands flourish, yielding ${_blessPct} at collection this turn. The sacred ground is warded — a ${targetProv._blessWardPct}% chance to turn aside any enemy Flood, Earthquake, Plague or Part Sea cast here this turn.`,{actor:c.player,targets:[c.player],provinceId:targetProv.id,public:false,env:true});
        }

        // ── PSYCHIC ──
        else if(fn==='psychic_charm'){
          const t=targetChar;
          if(!t||t.location!==c.location){log('system',`Charm: no valid target hero stands in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
          if(t.player===c.player){log('system',`Charm cannot be used on your own heroes.`,{actor:c.player,targets:[c.player]});break;}
          if(t.isKing){log('system',`Charm cannot sway a king.`,{actor:c.player,targets:[c.player]});break;}
          // A mind that has been swayed shuts against the next enchanter: a hero charmed on one
          // turn is IMMUNE to Charm for the whole of the following turn. `_charmImmuneTurn` is the
          // turn on which the immunity holds; it deliberately survives the end-of-turn flag sweep,
          // and is cleared lazily once it has passed.
          if(t._charmImmuneTurn!=null&&t._charmImmuneTurn<G.turn) delete t._charmImmuneTurn;
          if(t._charmImmuneTurn===G.turn){log('system',`${c.name}'s Charm slides off ${t.name} — a mind so lately swayed is closed to enchantment for a season.`,{actor:c.player,targets:[c.player],provinceId:prov.id}); charmBacklash(c,t,'closed to enchantment this season'); break;}
          // every Charm that has ever taken hold leaves the mind 30% harder to sway —
          // `_charmResist` is cumulative and permanent (it survives the turn-end flag sweep like
          // _charmImmuneTurn does). Rolled here, after the cast itself has succeeded.
          if((t._charmResist||0)>0){
            const _rr=d100();
            log('system',`📊 ${t.name} resists the Charm (${t._charmResist}% — swayed ${Math.round(t._charmResist/30)} time${t._charmResist===30?'':'s'} before): ${fmtRoll(t._charmResist,_rr)}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            if(_rr<=t._charmResist){
              log('system',`${c.name}'s Charm breaks against ${t.name}'s will — a mind that has been swayed before knows the feel of it, and shuts.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
              if(t.player!=null) log('system',`${t.name} feels an enchantment reach for their mind — and throws it off.`,{actor:t.player,targets:[t.player],charId:t.id,provinceId:prov.id});
              charmBacklash(c,t,'the Charm was resisted');
              break;
            }
          }
          // the enchanter learns exactly what they have taken — the charmed hero's skills and every
          // magic item they carry, reported to the CASTER only.
          const _charmIntel=(hero)=>{
            const sk=ABILITIES_P.filter(k=>skillLevel(hero,k)>0).map(k=>`${SKILL_LABELS[k]||k} ${skillLevel(hero,k)}`);
            const its=(hero.items||[]).filter(Boolean);
            log('system',`🔍 ${c.name} reads ${hero.name}'s mind as the Charm takes hold — Skills: ${sk.length?sk.join(', '):'none'}. Magic items: ${its.length?itemNameList(its,true):'none'}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          };
          // Charm cannot reach the dead. (targetChar is already alive-filtered at resolution, so a
          // hero who fell earlier this turn never arrives here — this makes the rule explicit and
          // guards any future path that might resolve a target without the alive check.)
          if(t.alive===false){log('system',`${c.name}'s Charm reaches for ${t.name}, but there is no living mind left to sway.`,{actor:c.player,targets:[c.player]});break;}
          // Charm sways only a LONE hero — one leading no armies (wandering OR enemy alike). A hero
          // at the head of a column is beyond a single enchanter's reach.
          if((t.armies||[]).length>0){log('system',`${c.name}'s Charm cannot grip ${t.name} — a hero leading troops is beyond its reach.`,{actor:c.player,targets:[c.player]});break;}
          // Apply this player's pre-written orders for the swayed hero to phases AFTER the cast,
          // then default any remaining post-cast phase to Defend. Matched on caster+hero+player so
          // a rival's pre-orders for the same hero are ignored. Shared by both charm outcomes.
          const _applyCharmOrders=(hero)=>{
            const pend=(G._pendingCharmOrders||[]).find(x=>x.heroId===hero.id&&x.casterId===c.id&&x.player===c.player);
            const slots=G.turnOrders[hero.id]||[null,null,null,null,null];
            let applied=0;
            if(pend&&Array.isArray(pend.orders)){
              pend.orders.forEach((o,pi2)=>{ if(pi2>ph&&o&&o.action&&o.action!=='Defend'&&o.action!=='defend'){ slots[pi2]=o; applied++; } });
            }
            for(let pz=0;pz<5;pz++){ if(pz>ph&&!slots[pz]) slots[pz]={action:'defend',target:'',extra:'',desc:'Defend'}; }
            G.turnOrders[hero.id]=slots;
            applyPendingSynthPlan(G,hero,c.player); // 2026-09-21: the card's encounter plan lands only now
            return applied;
          };
          if(t.player===null){
            // Wandering hero — enters your service permanently for free (you still pay upkeep). A
            // hero released from service this turn cannot be charmed straight back by the same
            // realm.
            if(t._releasedTurn===G.turn&&t._releasedBy===c.player){ log('system',`${c.name}'s Charm finds ${t.name} unmoved — a hero only just dismissed will not be drawn back the same season.`,{actor:c.player,targets:[c.player]}); break; }
            // The Divine/Undead gulf binds even magic: no charm sways a soul across distance 6.
            const _chWage=heroHireWage(G.players[c.player]?.alignment||'Neutral',t.alignment,hasDisc(turnContext,c.player,'sd31'),t);
            if(_chWage==null){
              log('system',`${c.name}'s Charm washes over ${t.name} and finds nothing to grip — ${t.alignment} souls cannot be swayed to a ${G.players[c.player]?.alignment} crown.`,{actor:c.player,targets:[c.player]});
              break;
            }
            t.pay=_chWage;
            t.player=c.player; t.hiredInPhase=ph;    // hiredInPhase gates acting to ph+1 (permanent join)
            claimWandererName(t);                    // they serve a crown now — drop the ' (wandering)' tag
            t._charmedTurn=G.turn;                   // a charmed mind will not send its possessions away this turn
            delete t._defend; delete t._pursuit; delete t._defendReactedPhase;
            if(typeof setMovePool==='function') setMovePool(turnContext,t);
            t._charmImmuneTurn=G.turn+1;  // closed to any further Charm for the whole of next turn
            t._charmResist=Math.min(95,(t._charmResist||0)+30); // +30% resistance to every later Charm, cumulative (capped 95%)
            log('hire',`✨ ${c.name}'s Charm sways ${t.name} — the wandering hero joins ${player.name} at no cost (you must still pay their upkeep).`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            _charmIntel(t); // 2026-09-18
            const applied=_applyCharmOrders(t);
            if(applied>0) log('system',`${t.name} takes up the orders ${player.name} laid down for them — ${applied} phase${applied!==1?'s':''} of this turn remain to be acted on.`,{actor:c.player,targets:[c.player]});
          } else {
            // Enemy hero leading no armies — command seized for the REST OF THE TURN. Implemented
            // as a temporary player-swap: they act on YOUR orders and fight under your banner from
            // the next phase (actingThisPhase() gates them via _charmControlFrom). At Early
            // Winter's turn-end economy they revert to their own lord, who pays their wages — see
            // the charm-revert pass in the ph===4 block. A charmable enemy hero leads no armies
            // (checked above), so this never transfers a column or triggers an invasion by itself.
            const _origOwner=t.player;
            t._charmOriginalPlayer=_origOwner;
            t._charmedByPlayer=c.player;
            t._charmedForPhase=ph;
            t._charmTempControl=true;
            t._charmedTurn=G.turn;                   // 2026-09-12
            t._charmControlFrom=ph;
            t._charmImmuneTurn=G.turn+1;  // closed to any further Charm for the whole of next turn
            t._charmResist=Math.min(95,(t._charmResist||0)+30); // +30% resistance to every later Charm, cumulative (capped 95%)
            t.player=c.player;
            delete t._defend; delete t._pursuit; delete t._defendReactedPhase; // drop any watch/chase set under their old lord
            if(typeof setMovePool==='function') setMovePool(turnContext,t);
            const applied=_applyCharmOrders(t);
            log('hire',`✨ ${c.name}'s Charm grips ${t.name} — they fall under ${player.name}'s command until the season turns, when they return to their own lord (who still pays their wages).${applied>0?` ${applied} phase${applied!==1?'s':''} of orders await them.`:''}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            _charmIntel(t); // 2026-09-18
            // file this under the CHARMED HERO (charId) — without it the entry inherited the
            // caster's charId from _logCtx, and the report's own-character rule handed the victim's
            // warning to the caster. After the ph-4 revert the hero belongs to _origOwner again, so
            // it lands in THEIR section only.
            log('system',`⚠ ${t.name} is ensorcelled by an enemy Charm and slips your command until the season turns.`,{actor:_origOwner,targets:[_origOwner],charId:t.id,provinceId:prov.id});
          }
        }
        else if(fn==='psychic_oratory'){
          // Self or an allied character in the same province — their travelling armies gain +1
          // quality this turn.
          // A NAMED ally who is not here is caught above (free refusal). What is left is a named
          // ally of another realm, or no target at all — self. Never silently swap a named target.
          if(targetChar&&targetChar.player!==c.player){
            log('system',`${c.name}'s Oratory can only stir their own realm's troops — ${targetChar.name} serves another crown.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;
          }
          const oratoryTarget=(targetChar&&targetChar.player===c.player&&targetChar.location===c.location)?targetChar:c;
          const _oTiers=(perkTier(c,'psychic')>=1)?2:1; // PSYCHIC L6 (Words of Awe): +2 quality tiers instead of +1
          oratoryTarget._oratoryBoost=_oTiers; // read by armStr: +N effective quality tiers (not cumulative)
          log('explore',`✨ ${c.name}'s stirring Oratory lifts ${oratoryTarget===c?'their own':oratoryTarget.name+"'s"} troops — every army travelling with ${oratoryTarget===c?c.name:oratoryTarget.name} fights ${_oTiers>1?'two quality levels':'one quality level'} higher this turn.`,{actor:c.player,targets:[c.player],provinceId:c.location});
        }
        else if(fn==='psychic_clairvoyance'){
          if(!targetChar){
            // The intended target may have died (targetChar only resolves living characters). If
            // so, tell the caster their quarry is dead and where the body lies.
            const deadT=(G.characters||[]).find(ch=>ch.id===extraId);
            if(deadT&&!deadT.alive){
              const grave=(G.heroGraveyard||[]).find(g=>g.id===extraId);
              const bodyLoc=(grave&&grave.location!=null)?grave.location:deadT.location;
              const bp=(bodyLoc!=null)?G.world.provinces[bodyLoc]:null;
              log('explore',`✨ ${c.name} casts Clairvoyance upon ${deadT.name}, but reaches only silence — ${deadT.name} is dead. Their body lies in ${bp?bp.name:'parts unknown'}.`,{actor:c.player,targets:[c.player],spy:true,provinceId:bodyLoc});
              break;
            }
            log('system',`Clairvoyance: choose a character you have seen to watch.`,{actor:c.player,targets:[c.player]});break;
          }
          // Clairvoyance reaches a mind bound to a crown — it cannot be turned on a neutral or
          // wandering hero (a hero guarding a neutral province, or one roaming unaligned).
          if(targetChar.player==null){
            log('system',`${c.name}'s Clairvoyance finds no thread to follow — ${targetChar.name} serves no crown, and the spell cannot fix upon a wandering or neutral mind.`,{actor:c.player,targets:[c.player],provinceId:c.location});break;
          }
          // Only one Clairvoyance at a time — a new casting replaces the old.
          (G.characters||[]).forEach(ch=>{ if(Array.isArray(ch._clairvoyantBy)) ch._clairvoyantBy=ch._clairvoyantBy.filter(pl=>pl!==c.player); });
          targetChar._clairvoyantBy=targetChar._clairvoyantBy||[];
          if(!targetChar._clairvoyantBy.includes(c.player)) targetChar._clairvoyantBy.push(c.player);
          // remember this watch so the report can surface everything that befalls the target FROM
          // THIS PHASE ONWARD, filed into the caster's Realm Events. One watch per player.
          clairWatch[c.player]={charId:targetChar.id, fromPhase:ph};
          // the watched character is SEEN wherever they end the turn — on the map, in hero
          // sightings and the Encounter list — as if spied on, and the mind-link pierces
          // Invisibility.
          if(G.players[c.player]) G.players[c.player]._clairCharThisTurn=targetChar.id;
          const tp=G.world.provinces[targetChar.location];
          // watching a character with Clairvoyance also reveals their full skills.
          {
            const actingP=G.players[c.player];
            if(actingP){
              actingP._spiedHeroSkills=actingP._spiedHeroSkills||{};
              actingP._spiedHeroSkills[targetChar.id]={
                name:targetChar.name, isKing:!!targetChar.isKing, alignment:targetChar.alignment||null,
                race:targetChar.race||null,
                kingdom:(targetChar.player!=null)?(G.players[targetChar.player]?.name||null):null,
                skills:{...(targetChar.skills||{})}, turn:G.turn,
              };
            }
          }
          log('explore',`✨ ${c.name} opens their mind's eye upon ${targetChar.name} — all that befalls them is known to you for the rest of the turn. They are currently in ${tp?tp.name:'parts unknown'}.`,{actor:c.player,targets:[c.player],spy:true,provinceId:targetChar.location});
        }
        else if(fn==='psychic_blast'){
          if(!targetChar||targetChar.location!==c.location){log('system',`Psychic Blast: no valid target hero in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
          if(targetChar.player===c.player){log('system',`Psychic Blast cannot be turned on your own heroes.`,{actor:c.player,targets:[c.player]});break;}
          // The target loses 2 skill levels, each drawn from a random owned skill (the two picks
          // may land on the same skill, in which case it drops by 2).
          const _pbDrops=[];
          for(let _k=0;_k<2;_k++){
            const owned=Object.keys(targetChar.skills||{}).filter(s=>(targetChar.skills[s]||0)>0);
            if(owned.length===0)break;
            const sk=owned[Math.floor(kcRng()*owned.length)];
            targetChar.skills[sk]=Math.max(0,(targetChar.skills[sk]||0)-1);
            _pbDrops.push(SKILL_LABELS[sk]||sk);
          }
          if(_pbDrops.length===0){log('combat',`✨ ${c.name}'s Psychic Blast rakes ${targetChar.name}'s mind, but they have no trained skills left to lose.`,{actor:c.player,charIds:[c.id,targetChar.id].filter(v=>v!=null),targets:[c.player,targetChar.player].filter(x=>x!=null),provinceId:prov.id});break;}
          log('combat',`✨ ${c.name} unleashes Psychic Blast — ${targetChar.name}'s mind buckles, losing ${_pbDrops.join(' and ')}!`,{actor:c.player,targets:[c.player,targetChar.player].filter(x=>x!=null),provinceId:prov.id,public:true});
          notifyTarget(turnContext,targetChar,`🧠 ${targetChar.name} reels — ${c.name}'s Psychic Blast sears away ${_pbDrops.join(' and ')}.`,ph,'combat');
          // 2026-09-21 (Toby): a hero stripped of skill levels commands a lower wage — re-evaluate it,
          // exactly as a skill rise does, and tell the hero's own realm.
          { const _pbPay0=targetChar.pay||0; recalcHeroPay(targetChar); const _pbPay1=targetChar.pay||0;
            if(targetChar.player!=null&&_pbPay1!==_pbPay0) log('system',`💰 ${targetChar.name}'s lost skill lowers their wage to ${_pbPay1}g/turn (was ${_pbPay0}g/turn).`,{actor:targetChar.player,targets:[targetChar.player],charId:targetChar.id,phase:ph}); }
        }
        else if(fn==='psychic_storm'){
          if(!targetChar||targetChar.location!==c.location){log('system',`Telekinetic Storm: no valid target hero in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
          if(targetChar.player===c.player){log('system',`Telekinetic Storm cannot be turned on your own heroes.`,{actor:c.player,targets:[c.player]});break;}
          const armies=(targetChar.armies||[]);
          if(armies.length===0){log('combat',`✨ Telekinetic Storm buffets ${targetChar.name}, but they lead no armies to scatter.`,{actor:c.player,charIds:[c.id,targetChar.id].filter(v=>v!=null),targets:[c.player,targetChar.player].filter(x=>x!=null),provinceId:prov.id});break;}
          const n=Math.min(spellLevelEff, armies.length);
          const picks=shuffleP(armies).slice(0,n);
          let demoted=0, destroyed=0; const _lines=[];
          // the loss is PERMANENT — every struck unit drops one experience level for
          // good (Elite→Crack→Veteran→Average→Green), and a Green unit disbands outright, exactly as a battle
          // demotion does (demoteOrDisband). Skeletal units never change quality by any means, so
          // the storm rattles their bones and leaves them as they were. (Was: a strength penalty
          // for the rest of the turn.)
          picks.forEach(a=>{
            if(a._isSkeletal){ a._disbanded=true; destroyed++; _lines.push(`${a.unitName||a.type} shattered to dust — the storm scatters every bone`); return; } // skeletons shatter outright
            const _q0=a.quality;
            if(demoteOrDisband(a)){ destroyed++; _lines.push(`${a.unitName||a.type} (${_q0}) torn apart and scattered for good`); return; }
            demoted++; _lines.push(`${a.unitName||a.type} ${_q0}→${a.quality}`);
          });
          targetChar.armies=armies.filter(a=>!a._disbanded);
          log('combat',`✨ ${c.name}'s Telekinetic Storm hurls ${targetChar.name}'s troops about — ${n} unit${n!==1?'s':''} caught: ${destroyed} shattered outright, ${demoted} permanently reduced one experience level. (${_lines.join('; ')})`,{actor:c.player,targets:[c.player,targetChar.player].filter(x=>x!=null),provinceId:prov.id,public:true});
          notifyTarget(turnContext, targetChar,`🌀 ${c.name}'s Telekinetic Storm scatters ${targetChar.name}'s formations — ${destroyed} destroyed, ${demoted} permanently reduced one experience level. (${_lines.join('; ')})`,ph,'combat');
        }

        // ── ILLUSORY ──
        else if(fn==='illusory_terrain'){
          const casterProv=G.world.provinces[c.location];
          const adjIds=new Set(getNeighborsP(casterProv,G.world.cols,G.world.rows,G.world.provinces).map(p2=>p2&&p2.id).filter(x=>x!=null));
          if(targetProv.id!==c.location&&!adjIds.has(targetProv.id)){log('system',`${c.name}: Illusory Terrain must target a province you are in or adjacent to.`,{actor:c.player,targets:[c.player]});break;}
          // Sea → 50% looks like random land; land → 50% looks like sea (else a different random land).
          const LANDS=['plain','forest','mountain','desert'];
          let fake;
          if(targetProv.terrain==='sea'){ fake=kcRng()<0.5?LANDS[Math.floor(kcRng()*LANDS.length)]:'sea'; }
          else { fake=kcRng()<0.5?'sea':(LANDS.filter(t=>t!==targetProv.terrain)[Math.floor(kcRng()*3)]); }
          targetProv._illusoryTerrain={caster:c.player, fake, appliedTurn:G.turn};
          log('explore',`✨ ${c.name} cloaks ${targetProv.name} in shifting illusion — to enemy eyes the ground blurs and rearranges into ever-changing, confusing terrain. Any enemy who gives battle here is disoriented, each of their units fighting as though caught in the worst possible ground for its kind (at least −15% strength).`,{actor:c.player,targets:[c.player],provinceId:targetProv.id});
        }
        else if(fn==='illusory_phantasmal'){
          // Target: the caster themselves, or any friendly hero in the SAME province. No longer
          // requires the target to be leading armies at cast time — the buff sits on the character
          // and is spent by the next battle they fight, so it still pays off if they pick up or
          // recruit armies in a later phase this turn.
          const t=(targetChar&&targetChar.player===c.player)?targetChar:c;
          if(t.id!==c.id && t.location!==c.location){log('system',`${c.name}: Phantasmal Armies must target yourself or an allied hero in your province.`,{actor:c.player,targets:[c.player]});break;}
          const _realForce=(t.armies||[]).filter(a=>a&&!a._phantom);
          const _elig=_realForce.filter(a=>!CREATURE_ARMIES.has(a.type)&&!MONSTER_ARMIES.has(a.type));
          if(_elig.length===0){log('system',`${c.name}: ${t===c?'you have':t.name+' has'} no humanoid armies for Phantasmal Armies to duplicate.`,{actor:c.player,targets:[c.player]});break;}
          const _n=Math.min(_elig.length, Math.max(1, Math.floor(0.10*Math.min(spellLevel,5)*_realForce.length))); // 10% of the host per level, capped at level 5 (was 15%)
          t._phantoms=t._phantoms||[];
          shuffleP(_elig).slice(0,_n).forEach(orig=>{ if(!orig._phTag) orig._phTag='ph'+(G._phSeq=(G._phSeq||0)+1); t._phantoms.push({type:orig.type,quality:orig.quality,race:orig.race,unitName:orig.unitName,_phantomOf:orig._phTag}); }); // random selection
          log('explore',`✨ ${c.name} conjures phantasmal duplicates of ${_n} of ${t===c?'their':t.name+"'s"} humanoid ${_n===1?'army':'armies'} — spectral doubles that march and fight with the real host for the rest of the turn, melting away if their true selves fall or the force is beaten.`,{actor:c.player,targets:[c.player],provinceId:t.location}/* 2026-09-27 (Toby item 6): realm-private — never public */);
        }
        else if(fn==='illusory_hide_feature'){
          const casterProv=G.world.provinces[c.location];
          const adjIds=new Set(getNeighborsP(casterProv,G.world.cols,G.world.rows,G.world.provinces).map(p2=>p2&&p2.id).filter(x=>x!=null));
          if(targetProv.id!==c.location&&!adjIds.has(targetProv.id)){log('system',`${c.name}: Hide Lairs must target a province you are in or adjacent to.`,{actor:c.player,targets:[c.player]});break;}
          const toHide=(targetProv.features||[]).filter(f=>!f._hidden);
          if(toHide.length===0){log('system',`${c.name}: there are no lairs left to hide in ${targetProv.name}.`,{actor:c.player,targets:[c.player]});break;}
          toHide.forEach(f=>{f._hidden=true; f._hiddenBy=c.player;});
          log('explore',`✨ ${c.name} veils ${targetProv.name} in confounding illusion — every lair within (${toHide.length}) vanishes from all other explorers' sight, and none can be freshly discovered here until the glamour fades.`,{actor:c.player,targets:[c.player],provinceId:targetProv.id});
        }

        // ── ELEMENTAL ──
        // (Lightning Bolt & Fireball are combat/battle-magic spells only — no action-phase form.)
        else if(fn==='elemental_earthquake'){
          const casterProv=G.world.provinces[c.location];
          const adjIds=new Set(getNeighborsP(casterProv,G.world.cols,G.world.rows,G.world.provinces).map(p2=>p2&&p2.id).filter(x=>x!=null));
          if(targetProv.id!==c.location&&!adjIds.has(targetProv.id)){log('system',`${c.name}: Earthquake must target your province or one adjacent.`,{actor:c.player,targets:[c.player]});break;}
          if(blessWardNegates(turnContext, targetProv, c, 'Earthquake')) break;
          targetProv._earthquakeNoTax=G.turn;
          log('combat',`✨ ${c.name} rends the earth beneath ${targetProv.name} — its fields and roads are ruined, and it will yield no tax at the end of this turn.`,{actor:c.player,targets:(targetProv.owner!=null&&targetProv.owner!==c.player)?[targetProv.owner]:[],provinceId:targetProv.id,public:true,env:true});
          notifyProvinceOwner(turnContext, targetProv, `🜃 An enemy Earthquake has torn through ${targetProv.name} — it will yield no tax this turn.`, c.player, ph);
        }
        else if(fn==='elemental_flood'){
          const casterProv=G.world.provinces[c.location];
          const adjIds=new Set(getNeighborsP(casterProv,G.world.cols,G.world.rows,G.world.provinces).map(p2=>p2&&p2.id).filter(x=>x!=null));
          if(targetProv.id!==c.location&&!adjIds.has(targetProv.id)){log('system',`${c.name}: Flood must target a land province you are in or adjacent to.`,{actor:c.player,targets:[c.player]});break;}
          if(targetProv.terrain==='sea'){log('system',`${c.name}: Flood can only be cast on a land province.`,{actor:c.player,targets:[c.player]});break;}
          // Cancel Part Sea if present, then submerge the province for the rest of the turn.
          if(blessWardNegates(turnContext, targetProv, c, 'Flood')) break;
          if(targetProv._partSea){ delete targetProv._partSea; }
          targetProv._flood={orig:targetProv.terrain, turn:G.turn};
          targetProv.terrain='sea';
          log('combat',`✨ ${c.name} calls up the deluge — ${targetProv.name} vanishes beneath the waves and acts as a sea province for the rest of the turn. Land armies are stranded; only fleets and flyers may pass.`,{actor:c.player,targets:(targetProv.owner!=null&&targetProv.owner!==c.player)?[targetProv.owner]:[],provinceId:targetProv.id,public:true,env:true});
          notifyProvinceOwner(turnContext, targetProv, `🌊 An enemy Flood has swallowed ${targetProv.name} — it acts as sea for the rest of the turn, and any land army there is stranded.`, c.player, ph);
        }
        else if(fn==='elemental_summon'){
          if(c._elementalSummonedThisTurn){log('system',`${c.name} has already summoned an elemental this turn.`,{actor:c.player,targets:[c.player]});break;}
          const ELEMENTALS=[
            {type:'Air Elemental',unitName:'the Howling Gale'},
            {type:'Fire Elemental',unitName:'the Living Conflagration'},
            {type:'Earth Elemental',unitName:'the Walking Mountain'},
            {type:'Water Elemental',unitName:'the Surging Tide'},
            {type:'Darkness Elemental',unitName:'the Devouring Shade'}];
          const pick=ELEMENTALS[Math.floor(kcRng()*ELEMENTALS.length)];
          const elemental={type:pick.type,quality:'Veteran',race:'Elemental',unitName:pick.unitName,_temporary:true,_expiresAfterPhase:-1};
          c.armies=(c.armies||[]);c.armies.push(elemental);
          c._elementalSummonedThisTurn=true;
          logSplit(turnContext, 'explore',`✨ ${c.name} tears open a rift in ${prov.name} and ${pick.unitName} — a ${pick.type} — surges forth to fight under your command! It will dissolve at the end of the turn.`,
            `✨ ${c.name}${realmTag(turnContext,c.player)} tears open a rift in ${prov.name} — ${pick.unitName}, a ${pick.type}, surges forth to fight under their banner.`,{actor:c.player,provinceId:prov.id});
          resolveUnitGainInProvince(turnContext, c, prov, ph);
        }

        // ── NECROMANCY ──
        else if(fn==='necromancy_control'){
          // Province-scan mode: cast on the province the caster stands in to sense the battlefield
          // dead lying there (the units a Skeletal Armies cast could raise).
          //
          // AN UNTARGETED CONTROL UNDEAD IS A PROVINCE SCAN. The spell has two modes and the order
          // form offers both in one dropdown, whose default option is the empty "— Target character
          // —". A player who chose Control Undead and left that default sent `extra:''`, which fell
          // through to the seize-a-unit branch and was reported as "no valid target hero stands in
          // <province> this phase" — a failure, for a spell that had a perfectly good thing to do
          // where the caster was standing. An empty target is now read as the scan: there is always
          // a province underfoot, so the cast is never wasted.
          if(extra===''||extra==null||extra==='__scan__'){
            const graves=prov.battleGraves||[];
            if(graves.length===0){
              noteGraveIntel(G.players[c.player], prov.id, G.turn, []); // seen bare — forget any stale record
              log('explore',`✨ ${c.name}'s Control Undead searches ${prov.name} for the dead — but no fallen army units lie here to sense.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            } else {
              const counts={};
              graves.forEach(g=>{const k=`${g.quality||'Average'} ${g.type}`;counts[k]=(counts[k]||0)+1;});
              const list=Object.entries(counts).map(([k,nn])=>`${nn}× ${k}`).join(', ');
              noteGraveIntel(G.players[c.player], prov.id, G.turn, graves); // the fuller reading is kept in Graveyards known
              log('explore',`💀 ${c.name}'s Control Undead senses the dead of ${prov.name}: ${list}. (${graves.length} grave${graves.length!==1?'s':''} that could be raised as skeletal servants.)`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            }
            // THE SPELL REACHES PAST THE PROVINCE LINE. The caster also feels which of the
            // SURROUNDING provinces hold battlefield dead. That is all it gives: existence, never
            // the count and never what the graves hold — for that a caster must stand on the ground
            // and scan it. Each neighbour is written into the realm's graveyard lore with `null`
            // detail, which noteGraveIntel treats as a bare sensing (any richer reading already on
            // record keeps its own older turn stamp and is NOT downgraded); a neighbour sensed
            // EMPTY is written as `[]`, which clears any stale promise of graves there. Both feed
            // the report's Graveyards Known.
            {
              const _pl=G.players[c.player];
              const _nbrs=getNeighborsP(prov,G.world.cols,G.world.rows,G.world.provinces).filter(p2=>p2&&p2.id!=null);
              const _withDead=[];
              _nbrs.forEach(nb=>{
                if(((nb.battleGraves||[]).length)>0){ noteGraveIntel(_pl, nb.id, G.turn, null); _withDead.push(nb.name); }
                else noteGraveIntel(_pl, nb.id, G.turn, []);
              });
              if(_withDead.length>0)
                log('explore',`💀 ${c.name}'s sending spreads out from ${prov.name} and the dead answer from beyond its borders — battlefield graves lie in ${_withDead.sort().join(', ')}. How many, and what they hold, only a caster standing on that ground could say.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
              else if(_nbrs.length>0)
                log('explore',`✨ ${c.name}'s sending spreads out from ${prov.name}, but the lands around it are quiet — no battlefield dead lie in any neighbouring province.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            }
            trySkillGain(turnContext, c, school, SKILLGAIN_STD);
            break;
          }
          if(!targetChar||targetChar.location!==c.location){log('system',`Control Undead: no valid target hero stands in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
          if(targetChar.player===c.player){log('system',`Control Undead cannot be turned on your own heroes.`,{actor:c.player,targets:[c.player]});break;}
          const undeadIdxs=(targetChar.armies||[]).map((a,i)=>({a,i})).filter(x=>x.a._isSkeletal||x.a.race==='Undead'||/Skelet|Bone|Wraith|Zombie|Ghoul|Lich/i.test(x.a.type||''));
          if(undeadIdxs.length===0){log('system',`${c.name}'s Control Undead finds no undead among ${targetChar.name}'s forces.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
          const pick=undeadIdxs[Math.floor(kcRng()*undeadIdxs.length)];
          const seized=targetChar.armies.splice(pick.i,1)[0];
          c.armies=(c.armies||[]); c.armies.push(seized);
          logSplit(turnContext,'hire',`✨ ${c.name}'s Control Undead wrests the ${seized.unitName||seized.type} from ${targetChar.name} in ${prov.name} — it now marches under your banner!`,
            `✨ ${c.name}${realmTag(turnContext,c.player)}'s Control Undead wrests the ${seized.unitName||seized.type} from ${targetChar.name}${realmTag(turnContext,targetChar.player)} in ${prov.name} — it now marches under ${c.name}'s banner.`,{actor:c.player,provinceId:prov.id,alsoNotFor:[targetChar.player]});
          notifyTarget(turnContext,targetChar,`✨ ${c.name}${realmTag(turnContext,c.player)}'s Control Undead wrests the ${seized.unitName||seized.type} from ${targetChar.name} in ${prov.name} — it now marches under the enemy's banner.`,ph,'hire');
          resolveUnitGainInProvince(turnContext, c, prov, ph);
        }
        else if(fn==='necromancy_skeletal'){
          // Skeletal Armies: raise destroyed armies from this province's battlefield graves
          const graves=prov.battleGraves||[];
          if(graves.length===0){
            log('explore',`${c.name} calls out to the fallen in ${prov.name}, but there are no battlefield dead here to answer. Seek a province where armies have previously perished.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;
          }
          // Units raised per cast scale with the caster's Necromancy (benefit scale, items count):
          // 1 at level 1-2, 2 at level 3-4, 3 at level 5+ — never more than the graves hold. An
          // item-cast by a non-necromancer (Reaper's Bell, Ossuary Key) raises one.
          const _skN=skeletalRaiseCount(effStat(turnContext,c,'necromancy'));
          const _uTier=gdActive(turnContext,c.player,'Undead'); // GRAND DESIGN — Undead: +1 tier when raised
          for(let _sk=0;_sk<_skN&&(prov.battleGraves||[]).length>0;_sk++){
            const grave=takeBestGrave(prov); // the most experienced dead answer first
            if(!grave) break;
            const skel={ type:grave.type,quality:(_uTier?(KC_QUALITY_UP[grave.quality]||grave.quality):grave.quality),race:'Undead',_isSkeletal:true,
              unitName:`${grave.unitName||armyUnitName(grave.type)} (Skeletal)` };
            c.armies=(c.armies||[]);c.armies.push(skel);
            log('explore',`💀 ${c.name} calls forth ${skel.unitName} — a ${skel.quality} ${skel.type} rises from the graves of ${prov.name} to serve! (Upkeep 1g/turn.)`,{actor:c.player,targets:[c.player],provinceId:prov.id,public:true});
          }
          // the caster has just gained a unit here — if this is a neutral/enemy province, that
          // force must fight any defenders this phase, or take control if the land is undefended.
          resolveUnitGainInProvince(turnContext, c, prov, ph);
        }
        else if(fn==='necromancy_curse'){
          if(!targetChar||targetChar.location!==c.location){log('system',`Curse: no valid target hero in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
          if(targetChar.player===c.player){log('system',`Curse cannot be turned on your own heroes.`,{actor:c.player,targets:[c.player]});break;}
          // EVERY skill the target has is halved (rounded down) for the rest of the turn — was the
          // single highest skill. A second Curse the same turn halves what is left again.
          const _cursed=Object.entries(targetChar.skills||{}).filter(([,v])=>v>0);
          if(!_cursed.length){log('system',`${targetChar.name} has no skills to curse.`,{actor:c.player,targets:[c.player]});break;}
          targetChar._curses=targetChar._curses||{};
          const _parts=_cursed.map(([sk,val])=>{
            const cur=Math.max(0,val-(targetChar._curses[sk]||0));          // what the skill IS right now, after any earlier curse
            const reduce=cur-Math.floor(cur/2);
            targetChar._curses[sk]=(targetChar._curses[sk]||0)+reduce;
            return `${SKILL_LABELS[sk]||sk} ${cur}→${Math.floor(cur/2)}`;
          });
          log('combat',`✨ ${c.name}'s Curse settles over ${targetChar.name} — every skill is halved for the rest of the turn (${_parts.join(', ')})!`,{actor:c.player,targets:[c.player,targetChar.player].filter(x=>x!=null),provinceId:prov.id,public:true});
          notifyTarget(turnContext, targetChar,`☠ A Curse from ${c.name} settles over ${targetChar.name} — every skill is halved for the rest of the turn (${_parts.join(', ')}).`,ph,'combat');
        }
        // (Hand of Death is a combat-only spell — no action-phase form.)
        else if(fn==='necromancy_plague'){
          // Target the caster's province or an adjacent one.
          const casterProv=G.world.provinces[c.location];
          const adjIds=new Set(getNeighborsP(casterProv,G.world.cols,G.world.rows,G.world.provinces).map(p2=>p2&&p2.id).filter(x=>x!=null));
          if(targetProv.id!==c.location&&!adjIds.has(targetProv.id)){log('system',`${c.name}: Plague must target your province or one adjacent.`,{actor:c.player,targets:[c.player]});break;}
          if(targetProv._plaguedTurn===G.turn){log('system',`${targetProv.name} is already stricken with plague this turn — a second casting adds nothing (not cumulative).`,{actor:c.player,targets:[c.player]});break;}
          if(blessWardNegates(turnContext, targetProv, c, 'Plague')) break;
          targetProv._plaguedTurn=G.turn; targetProv._plagueLevel=spellLevelEff; targetProv._plagueCaster=c.player;
          const res=applyPlague(turnContext, targetProv, spellLevelEff, ph);
          log('combat',`☠ ${c.name} calls down a Plague upon ${targetProv.name} — of ${res.tested} humanoid unit${res.tested!==1?'s':''}, ${res.affected} sicken and lose an experience level. It may spread to neighbouring lands in the phases to come.`,{actor:c.player,targets:(targetProv.owner!=null&&targetProv.owner!==c.player)?[targetProv.owner]:[],provinceId:targetProv.id,public:true,env:true});
          notifyProvinceOwner(turnContext, targetProv, `☠ An enemy Plague has struck ${targetProv.name} — ${res.affected} of your unit${res.affected!==1?'s there sicken':' there sickens'} and may spread to neighbouring lands.`, c.player, ph);
        }

        // ══ LEVEL 7 & 9 MASTERY SPELLS ════
        // WHITE
        else if(fn==='white_sanctuary'){
          const casterProv=G.world.provinces[c.location];
          const adjIds=new Set(getNeighborsP(casterProv,G.world.cols,G.world.rows,G.world.provinces).map(p2=>p2&&p2.id).filter(x=>x!=null));
          if(targetProv.id!==c.location&&!adjIds.has(targetProv.id)){log('system',`${c.name}: Sanctuary must ward your province or one adjacent.`,{actor:c.player,targets:[c.player]});break;}
          targetProv._sanctuaryTurn=G.turn; targetProv._sanctuaryBy=c.player;
          log('explore',`✨ ${c.name} raises a Sanctuary over ${targetProv.name} — hostile armies that give battle here fight at −25% strength this turn.`,{actor:c.player,targets:[c.player],provinceId:targetProv.id,public:true});
          notifyProvinceOwner(turnContext, targetProv, `✨ ${c.name} (${G.players[c.player]?.name||'a foreign realm'}) has raised a Sanctuary over ${targetProv.name} — armies hostile to that realm that give battle there fight at −25% strength this turn.`, c.player, ph); // the owner is told
        }
        else if(fn==='white_judgment'){
          if(!targetChar||targetChar.location!==c.location){log('system',`Divine Judgment: no valid enemy hero in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
          if(targetChar.player===c.player){log('system',`Divine Judgment cannot be turned on your own heroes.`,{actor:c.player,targets:[c.player]});break;}
          const dmg=10+spellLevelEff*3;
          targetChar.hp=Math.max(1,(targetChar.hp||20)-dmg);
          const src=targetChar.armies||[]; const kills=Math.min(src.length,2+Math.floor(spellLevelEff/2));
          const idxs=shuffleP(src.map((_,i)=>i)).slice(0,kills).sort((a,b)=>b-a);
          idxs.forEach(i=>src.splice(i,1));
          log('combat',`⚡ ${c.name} calls down Divine Judgment on ${targetChar.name} — ${dmg} holy damage${kills>0?`, and ${kills} of their unit${kills!==1?'s':''} are smitten to ash`:''}!`,{actor:c.player,targets:[c.player,targetChar.player].filter(x=>x!=null),provinceId:prov.id,public:true});
          notifyTarget(turnContext, targetChar,`⚡ Divine Judgment falls on ${targetChar.name} from ${c.name} — ${dmg} holy damage${kills>0?`, ${kills} unit${kills!==1?'s':''} smitten`:''}.`,ph,'combat');
        }
        // PSYCHIC
        else if(fn==='psychic_massconfusion'){
          if(!targetChar||targetChar.location!==c.location){log('system',`Mass Confusion: no valid enemy hero in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
          if(targetChar.player===c.player){log('system',`Mass Confusion cannot be turned on your own heroes.`,{actor:c.player,targets:[c.player]});break;}
          targetChar._massConfusedTurn=G.turn;
          log('combat',`✨ ${c.name} sows Mass Confusion through ${targetChar.name}'s ranks — their commander's Tactical genius deserts them in their next battle this turn.`,{actor:c.player,targets:[c.player,targetChar.player].filter(x=>x!=null),provinceId:prov.id,public:true});
          notifyTarget(turnContext,targetChar,`✨ Mass Confusion from ${c.name} grips ${targetChar.name} — their Tactical command deserts them in their next battle.`,ph,'combat');
        }
        else if(fn==='psychic_dominate'){
          if(!targetChar||targetChar.location!==c.location){log('system',`Dominate: no valid enemy hero in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
          if(targetChar.player===c.player){log('system',`Dominate cannot be turned on your own heroes.`,{actor:c.player,targets:[c.player]});break;}
          const src=targetChar.armies||[];
          if(src.length===0){log('combat',`✨ ${c.name}'s Dominate grips ${targetChar.name}, but they lead no troops to turn.`,{actor:c.player,charIds:[c.id,targetChar.id].filter(v=>v!=null),targets:[c.player,targetChar.player].filter(x=>x!=null),provinceId:prov.id});break;}
          const take=Math.max(1,Math.floor(src.length*0.25));
          const idxs=shuffleP(src.map((_,i)=>i)).slice(0,take).sort((a,b)=>b-a);
          const seized=idxs.map(i=>src.splice(i,1)[0]);
          c.armies=(c.armies||[]).concat(seized);
          logSplit(turnContext,'hire',`✨ ${c.name} Dominates ${targetChar.name} in ${prov.name} — ${seized.length} of their unit${seized.length!==1?'s':''} turn coat and march under your banner!`,
            `✨ ${c.name}${realmTag(turnContext,c.player)} Dominates ${targetChar.name}${realmTag(turnContext,targetChar.player)} in ${prov.name} — ${seized.length} of their unit${seized.length!==1?'s':''} turn coat and march under ${c.name}'s banner.`,{actor:c.player,provinceId:prov.id,alsoNotFor:[targetChar.player]});
          notifyTarget(turnContext,targetChar,`✨ ${c.name}${realmTag(turnContext,c.player)} Dominates ${targetChar.name} in ${prov.name} — ${seized.length} of their unit${seized.length!==1?'s':''} turn coat and desert to the enemy.`,ph,'hire');
          resolveUnitGainInProvince(turnContext, c, prov, ph);
        }
        // ILLUSORY
        else if(fn==='illusory_phantomhost'){
          const _realForceH=(c.armies||[]).filter(a=>a&&!a._phantom);
          const _eligH=_realForceH.filter(a=>CREATURE_ARMIES.has(a.type)||MONSTER_ARMIES.has(a.type));
          if(_eligH.length===0){log('system',`${c.name}: you lead no monsters or creatures for Phantom Host to duplicate.`,{actor:c.player,targets:[c.player]});break;}
          const _nH=Math.min(_eligH.length, Math.max(1, Math.floor(0.10*Math.min(spellLevel,5)*_realForceH.length))); // 10% of the host per level, capped at level 5 (was 15%)
          c._phantoms=c._phantoms||[];
          shuffleP(_eligH).slice(0,_nH).forEach(orig=>{ if(!orig._phTag) orig._phTag='ph'+(G._phSeq=(G._phSeq||0)+1); c._phantoms.push({type:orig.type,quality:orig.quality,race:orig.race,unitName:orig.unitName,_phantomOf:orig._phTag}); }); // random selection
          log('explore',`✨ ${c.name} conjures a Phantom Host — spectral doubles of ${_nH} of their ${_nH===1?'beast':'beasts'} that fight with the real host for the rest of the turn, melting away if their true selves fall or the force is beaten.`,{actor:c.player,targets:[c.player],provinceId:prov.id}/* 2026-09-27 (Toby item 6): realm-private — never public */);
        }
        else if(fn==='illusory_invisibility'){
          // Invisibility as an ACTION spell — self only. 80% to slip from all enemy sight for the
          // rest of this turn (report sightings, spy reports, Encounter targeting and the map all
          // honour _invisTurn). Fails (20%): visible as normal.
          const _ivRoll=d100();
          if(_ivRoll<=80){ c._invisTurn=G.turn; c._unspottedTurn=G.turn; log('explore',`✨ ${c.name} weaves Invisibility about themself — no enemy eye will find them for the rest of this turn. ${fmtRoll(80,_ivRoll)}`,{actor:c.player,targets:[c.player],provinceId:prov.id}); }
          else log('explore',`✨ ${c.name}'s Invisibility shimmers and fails to hold — they remain in plain sight. ${fmtRoll(80,_ivRoll)}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        }
        else if(fn==='illusory_veil'){
          c._veilTurn=G.turn; c._veilCastPhase=ph; // ILLUSORY L9 Veil: active THIS phase and the next (two phases)
          log('explore',`✨ ${c.name} draws a Veil of illusion over their host — for this phase and the next, they and the armies they lead vanish from all enemy sight, cannot be touched by hostile magic, and cannot be brought to battle. The illusion parts as the phase after next begins.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        }
        // ELEMENTAL
        else if(fn==='elemental_chainlightning'){
          if(!targetChar||targetChar.location!==c.location){log('system',`Chain Lightning: no valid enemy hero in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
          if(targetChar.player===c.player){log('system',`Chain Lightning cannot be turned on your own heroes.`,{actor:c.player,targets:[c.player]});break;}
          const src=targetChar.armies||[];
          if(src.length===0){log('combat',`✨ Chain Lightning crackles around ${targetChar.name}, but they lead no troops to strike.`,{actor:c.player,charIds:[c.id,targetChar.id].filter(v=>v!=null),targets:[c.player,targetChar.player].filter(x=>x!=null),provinceId:prov.id});break;}
          const pool=Math.floor(src.length*0.30);
          if(pool<=0){log('combat',`⚡ ${c.name}'s Chain Lightning crackles around ${targetChar.name}'s handful of troops but earths out without a kill.`,{actor:c.player,charIds:[c.id,targetChar.id].filter(v=>v!=null),targets:[c.player,targetChar.player].filter(x=>x!=null),provinceId:prov.id});break;}
          const idxs=shuffleP(src.map((_,i)=>i)).slice(0,pool).sort((a,b)=>b-a);
          let killed=0;
          idxs.forEach(i=>{ if(kcRng()<0.5){ src.splice(i,1); killed++; } });
          log('combat',`⚡ ${c.name}'s Chain Lightning arcs through ${targetChar.name}'s ranks — of ${pool} unit${pool!==1?'s':''} caught in the arc, ${killed} ${killed===1?'is':'are'} blasted apart!`,{actor:c.player,targets:[c.player,targetChar.player].filter(x=>x!=null),provinceId:prov.id,public:true});
          notifyTarget(turnContext,targetChar,`⚡ ${c.name}'s Chain Lightning tears through ${targetChar.name}'s ranks — ${killed} unit${killed!==1?'s':''} blasted apart.`,ph,'combat');
        }
        else if(fn==='elemental_cataclysm'){
          const casterProv=G.world.provinces[c.location];
          const adjIds=new Set(getNeighborsP(casterProv,G.world.cols,G.world.rows,G.world.provinces).map(p2=>p2&&p2.id).filter(x=>x!=null));
          if(targetProv.id!==c.location&&!adjIds.has(targetProv.id)){log('system',`${c.name}: Cataclysm must target your province or one adjacent.`,{actor:c.player,targets:[c.player]});break;}
          targetProv._earthquakeNoTax=G.turn;
          targetProv.tax=0; targetProv._taxDestroyed=true; // Cataclysm now ruins the tax base PERMANENTLY
          let totalDestroyed=0;
          const _ccVictims=new Set();
          (G.characters||[]).filter(ch=>ch.alive&&ch.location===targetProv.id&&ch.player!==c.player&&(ch.armies||[]).length>0).forEach(ch=>{
            const n=Math.min(ch.armies.length,1+Math.floor(spellLevelEff/2));
            const idxs=shuffleP(ch.armies.map((_,i)=>i)).slice(0,n).sort((a,b)=>b-a);
            idxs.forEach(i=>ch.armies.splice(i,1)); totalDestroyed+=n;
            if(ch.player!=null) _ccVictims.add(ch.player);
          });
          if(targetProv.owner!=null&&targetProv.owner!==c.player) _ccVictims.add(targetProv.owner);
          log('combat',`☄ ${c.name} calls down a Cataclysm upon ${targetProv.name} — ${totalDestroyed} enemy unit${totalDestroyed!==1?'s':''} destroyed, and the land is left permanently barren (tax base reduced to 0 for good).`,{actor:c.player,targets:[..._ccVictims],provinceId:targetProv.id,public:true});
          notifyProvinceOwner(turnContext, targetProv, `☄ An enemy Cataclysm has devastated ${targetProv.name} — its tax base is permanently ruined${totalDestroyed>0?` and ${totalDestroyed} of your unit${totalDestroyed!==1?'s were':' was'} destroyed`:''}.`, c.player, ph);
        }
        // NECROMANCY
        else if(fn==='necromancy_wraiths'){
          const graves=prov.battleGraves||[];
          if(graves.length===0){log('explore',`${c.name}'s call for Wraiths finds no battlefield dead in ${prov.name} to answer.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
          let _wbi=0,_wbs=-1; prov.battleGraves.forEach((gr,i)=>{ const st=unitBaseStrength({type:gr.type,quality:gr.quality||'Average'}); if(st>_wbs){_wbs=st;_wbi=i;} }); // raise the STRONGEST fallen unit
          const g=prov.battleGraves.splice(_wbi,1)[0];
          const wraith={type:g.type,quality:'Elite',race:'Undead',_isSkeletal:true,_isWraith:true,unitName:`Wraiths (${armyUnitName(g.type)})`};
          c.armies=(c.armies||[]);c.armies.push(wraith);
          logSplit(turnContext,'explore',`💀 ${c.name} binds the dead of ${prov.name} into ${wraith.unitName} — Elite undead at your side! (Upkeep 1g/turn.)`,
            `💀 ${c.name}${realmTag(turnContext,c.player)} binds the dead of ${prov.name} into ${wraith.unitName} — Elite undead now march at their side.`,{actor:c.player,provinceId:prov.id});
          resolveUnitGainInProvince(turnContext, c, prov, ph);
        }
        else if(fn==='necromancy_dominion'){
          const graves=prov.battleGraves||[];
          if(graves.length===0){log('explore',`${c.name}'s Death's Dominion finds no fallen army in ${prov.name} to raise.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
          const QUALITY_UP={...KC_QUALITY_UP};
          // Death's Dominion already raises the dead one tier stronger than they fell. The
          // Deathless Legion adds ITS tier on top, so an Undead realm holding its Wonder pulls them
          // up TWO tiers — Average dead rise Crack. Elite is still the ceiling.
          const _ddUp=gdActive(turnContext,c.player,'Undead')?(q=>QUALITY_UP[QUALITY_UP[q]||q]||QUALITY_UP[q]||q):(q=>QUALITY_UP[q]||q);
          const n=Math.min(graves.length,spellLevelEff); let raised=0;
          for(let k=0;k<n;k++){ const g=takeBestGrave(prov); if(!g)break; /*best first, down the line */ c.armies=(c.armies||[]); c.armies.push({type:g.type,quality:_ddUp(g.quality),race:'Undead',_isSkeletal:true,unitName:`${g.unitName||armyUnitName(g.type)} (Skeletal)`}); raised++; }
          log('explore',`💀 ${c.name} unleashes Death's Dominion over ${prov.name} — ${raised} skeletal unit${raised!==1?'s':''} claw up from the graves to serve!`,{actor:c.player,targets:[c.player],provinceId:prov.id,public:true});
          resolveUnitGainInProvince(turnContext, c, prov, ph);
        }

        // Magic school skill gain on a successful action cast
        trySkillGain(turnContext, c, school, SKILLGAIN_STD);
        break;
      }


      // ══ L7/L9 MASTERY ORDERS (batch 2a) ════
      case 'sabotage': resolveSabotageOrder(turnContext, c, target); break;
      case 'grand_heist': resolveGrandHeistOrder(turnContext, c, ph, prov); break;
      case 'awaken_grove': resolveAwakenGroveOrder(turnContext, c, ph, prov); break;
      case 'chart_unknown': resolveChartTheUnknownOrder(turnContext, c, target, prov); break;
      case 'discover_ruin': resolveDiscoverLostRuinOrder(turnContext, c, target, prov); break;

      // ══ L7/L9 MASTERY ORDERS (batch 2b) ════
      case 'blockade':{
        if(skillLevel(c,'naval')<7){log('system',`${c.name} lacks the Naval mastery (7) to raise a Blockade.`,{actor:c.player,targets:[c.player]});break;}
        const sp=G.world.provinces[parseInt(target)];
        if(!sp||sp.terrain!=='sea'){log('system',`${c.name}: Blockade must target a sea province.`,{actor:c.player,targets:[c.player]});break;}
        const adj=new Set(getNeighborsP(G.world.provinces[c.location],G.world.cols,G.world.rows,G.world.provinces).map(p=>p&&p.id).filter(x=>x!=null));
        if(sp.id!==c.location&&!adj.has(sp.id)){log('system',`${c.name}: Blockade must seal a sea province you are in or adjacent to.`,{actor:c.player,targets:[c.player]});break;}
        if(!(c.armies||[]).some(a=>SEA_TYPES.has(a.type))){log('system',`${c.name}: a Blockade must be thrown by a fleet — you lead no naval units or sea creatures.`,{actor:c.player,targets:[c.player]});break;} // NAVAL L7: must lead a naval unit / sea creature
        if(kcRng()<0.5){ // NAVAL L7: the blockade forms only half the time
          sp._blockadeTurn=G.turn; sp._blockadeBy=c.player;
          log('move',`⚓ ${c.name} throws a Blockade across ${sp.name} — enemy fleets may not cross these waters this turn.`,{actor:c.player,targets:[c.player],provinceId:sp.id,public:true});
        } else {
          log('move',`⚓ ${c.name} tries to blockade ${sp.name}, but the fleet cannot close the waters in time — no blockade forms this turn.`,{actor:c.player,targets:[c.player],provinceId:sp.id});
        }
        trySkillGain(turnContext,c,'naval',SKILLGAIN_STD);
        break;
      }
      case 'research_breakthrough': resolveResearchBreakthroughOrder(turnContext, c); break;
      case 'assassinate': resolveAssassinateOrder(turnContext, c, target, prov); break;
      case 'vanish': resolveVanishOrder(turnContext, c, prov); break;

      // ══ L7/L9 MASTERY ORDERS (batch 2c-i — immediate strikes) ════
      case 'challenge':{
        if(skillLevel(c,'melee')<7){log('system',`${c.name} lacks the Melee mastery (7) to issue a Challenge.`,{actor:c.player,targets:[c.player]});break;}
        const foe=G.characters.find(ch=>ch.alive&&ch.id===parseInt(target)&&ch.location===c.location&&ch.player!==c.player);
        if(!foe){log('system',`${c.name} finds no enemy hero to challenge in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
        if(foe.player!=null&&!areEnemies(turnContext,c.player,foe.player)){log('system',`${c.name}: you are not at war with ${foe.name}'s crown — a Challenge would be an act of war. Declare war first.`,{actor:c.player,targets:[c.player]});break;}
        if((foe.armies||[]).length>0){log('combat',`${foe.name} is at the head of an army and will not break off to answer ${c.name}'s Challenge.`,{actor:c.player,charIds:[c.id,foe.id].filter(v=>v!=null),targets:[c.player,foe.player].filter(x=>x!=null),provinceId:prov.id});break;}
        markProvinceCombat(prov,[c.player,foe.player]); // purple swords: a personal duel, not a field battle
        const A=pcCharCombatant(turnContext,c), B=pcCharCombatant(turnContext,foe);
        const aScore=(A.melee+A.archery)*3 + (c.hp||20) + d100()/4;
        const bScore=(B.melee+B.archery)*3 + (foe.hp||20) + d100()/4;
        const win=aScore>=bScore; const winner=win?c:foe, loser=win?foe:c;
        const dmg=8+Math.floor(Math.abs(aScore-bScore)/6);
        loser.hp=Math.max(0,(loser.hp||20)-dmg);
        log('combat',`⚔ ${c.name} calls ${foe.name} to single combat! ${winner.name} has the better of it — ${loser.name} takes ${dmg} wounds.`,{actor:c.player,targets:[c.player,foe.player].filter(x=>x!=null),provinceId:prov.id,public:true});
        if(loser.hp<=0){ if(_escapesTheEnd(loser)){ if(loser.hp<=0) loser.hp=1; log('combat',_garrethEscapeLine(loser),{actor:c.player,targets:[c.player].filter(x=>x!=null),provinceId:prov.id,public:true}); } else { reportHeroFall(turnContext,loser,winner,`${loser.name} falls in the duel!`,{actor:c.player,targets:[c.player,foe.player].filter(x=>x!=null),provinceId:prov.id,public:true}); awardKillXP(turnContext, winner, loser); } }
        if(win) c.merits=(c.merits||0)+2;
        trySkillGain(turnContext,c,'melee',SKILLGAIN_STD);
        break;
      }
      case 'rampage':{
        if(skillLevel(c,'melee')<9){log('system',`${c.name} lacks the Melee mastery (9) to Rampage.`,{actor:c.player,targets:[c.player]});break;}
        const foe=G.characters.find(ch=>ch.alive&&ch.id===parseInt(target)&&ch.location===c.location&&ch.player!==c.player);
        if(!foe||(foe.armies||[]).length===0){log('combat',`${c.name} finds no enemy force to fall upon in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
        if(foe.player!=null&&!areEnemies(turnContext,c.player,foe.player)){log('system',`${c.name}: you are not at war with ${foe.name}'s crown — a Rampage would be an act of war. Declare war first.`,{actor:c.player,targets:[c.player]});break;}
        const src=foe.armies; const kills=Math.min(src.length,2+Math.floor(skillLevel(c,'melee')/2));
        const idxs=shuffleP(src.map((_,i)=>i)).slice(0,kills).sort((a,b)=>b-a);
        idxs.forEach(i=>src.splice(i,1));
        const hd=6+skillLevel(c,'melee'); foe.hp=Math.max(1,(foe.hp||20)-hd);
        log('combat',`🗡 ${c.name} goes on a Rampage through ${foe.name}'s ranks — ${kills} unit${kills!==1?'s':''} cut down and their commander bloodied!`,{actor:c.player,targets:[c.player,foe.player].filter(x=>x!=null),provinceId:prov.id,public:true});
        c.merits=(c.merits||0)+1;
        trySkillGain(turnContext,c,'melee',SKILLGAIN_STD);
        break;
      }
      case 'rain_of_arrows':{
        if(skillLevel(c,'archery')<7){log('system',`${c.name} lacks the Archery mastery (7) for a Rain of Arrows.`,{actor:c.player,targets:[c.player]});break;}
        const foe=G.characters.find(ch=>ch.alive&&ch.id===parseInt(target)&&ch.location===c.location&&ch.player!==c.player);
        if(!foe||(foe.armies||[]).length===0){log('combat',`${c.name} finds no enemy force to volley in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
        if(foe.player!=null&&!areEnemies(turnContext,c.player,foe.player)){log('system',`${c.name}: you are not at war with ${foe.name}'s crown — a Rain of Arrows would be an act of war. Declare war first.`,{actor:c.player,targets:[c.player]});break;}
        const src=foe.armies; const kills=Math.min(src.length,1+Math.floor(skillLevel(c,'archery')/2));
        const idxs=shuffleP(src.map((_,i)=>i)).slice(0,kills).sort((a,b)=>b-a);
        idxs.forEach(i=>src.splice(i,1));
        log('combat',`🏹 ${c.name} looses a Rain of Arrows on ${foe.name}'s host — ${kills} unit${kills!==1?'s':''} fall to the volley.`,{actor:c.player,targets:[c.player,foe.player].filter(x=>x!=null),provinceId:prov.id,public:true});
        trySkillGain(turnContext,c,'archery',SKILLGAIN_STD);
        break;
      }
      case 'snipers_mark':{
        if(skillLevel(c,'archery')<9){log('system',`${c.name} lacks the Archery mastery (9) for a Sniper's Mark.`,{actor:c.player,targets:[c.player]});break;}
        const foe=G.characters.find(ch=>ch.alive&&ch.id===parseInt(target)&&ch.location===c.location&&ch.player!==c.player);
        if(!foe){log('system',`${c.name} finds no enemy commander to mark in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
        if(foe.player!=null&&!areEnemies(turnContext,c.player,foe.player)){log('system',`${c.name}: you are not at war with ${foe.name}'s crown — a Sniper's Mark would be an act of war. Declare war first.`,{actor:c.player,targets:[c.player]});break;}
        const dmg=8+skillLevel(c,'archery'); foe.hp=Math.max(0,(foe.hp||20)-dmg);
        const killChance=Math.min(40,10+skillLevel(c,'archery')*3)-(foe.isKing?15:0);
        const roll=d100();
        log('combat',`🎯 ${c.name} takes a Sniper's Mark on ${foe.name} — ${dmg} wounds${foe.hp<=0?'':` (${killChance}% to slay, roll ${roll})`}.`,{actor:c.player,targets:[c.player,foe.player].filter(x=>x!=null),provinceId:prov.id,public:true});
        if(foe.hp<=0 || roll<=killChance){ if(_escapesTheEnd(foe)){ foe.hp=Math.max(1,foe.hp); log('combat',_garrethEscapeLine(foe),{actor:c.player,targets:[c.player].filter(x=>x!=null),provinceId:prov.id,public:true}); } else { foe.hp=0; reportHeroFall(turnContext,foe,c,`${foe.name} is felled by the shot!`,{actor:c.player,targets:[c.player,foe.player].filter(x=>x!=null),provinceId:prov.id,public:true}); awardKillXP(turnContext, c, foe); c.merits=(c.merits||0)+2; } }
        trySkillGain(turnContext,c,'archery',SKILLGAIN_STD);
        break;
      }

      // ══ L7/L9 MASTERY ORDERS (batch 2c-ii — battle-strength flags) ════
      case 'feigned_retreat':{
        if(skillLevel(c,'tactical')<7){log('system',`${c.name} lacks the Tactical mastery (7) for a Feigned Retreat.`,{actor:c.player,targets:[c.player]});break;}
        c._feignedRetreatTurn=G.turn;
        log('combat',`🏳 ${c.name} lays a Feigned Retreat — should the enemy take the bait and attack, the counter will strike at +25% strength this turn.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        trySkillGain(turnContext,c,'tactical',SKILLGAIN_STD);
        break;
      }
      case 'grand_stratagem':{
        if(skillLevel(c,'tactical')<9){log('system',`${c.name} lacks the Tactical mastery (9) for a Grand Stratagem.`,{actor:c.player,targets:[c.player]});break;}
        c._grandStratagemTurn=G.turn;
        log('combat',`📜 ${c.name} sets a Grand Stratagem in motion — their next battle this turn is fought at +20% strength.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        trySkillGain(turnContext,c,'tactical',SKILLGAIN_STD);
        break;
      }
      case 'lightning_advance':{
        if(skillLevel(c,'march')<9){log('system',`${c.name} lacks the March mastery (9) for a Lightning Advance.`,{actor:c.player,targets:[c.player]});break;}
        c._lightningAdvanceTurn=G.turn;
        log('move',`⚡ ${c.name} orders a Lightning Advance — any enemy they attack this turn is caught unready (−20% on the defence).`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        trySkillGain(turnContext,c,'march',SKILLGAIN_STD);
        break;
      }
      case 'raid_coast':{
        if(skillLevel(c,'naval')<9){log('system',`${c.name} lacks the Naval mastery (9) to Raid the Coast.`,{actor:c.player,targets:[c.player]});break;}
        if(!(c.armies||[]).some(a=>SEA_TYPES.has(a.type))){log('system',`${c.name}: a Raid the Coast must be led by a fleet — you lead no naval units or sea creatures.`,{actor:c.player,targets:[c.player]});break;} // NAVAL L9: must lead a naval unit / sea creature
        c._raidCoastTurn=G.turn;
        log('move',`⚓ ${c.name} readies a Raid the Coast — an amphibious assault launched from the sea against a coastal province this turn strikes at +25% strength, and plunders the province treasury if it falls.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        trySkillGain(turnContext,c,'naval',SKILLGAIN_STD);
        break;
      }
      // ══ L7/L9 MASTERY ORDERS (batch 2c-iii — specials) ════
      case 'wild_calling': resolveWildCallingOrder(turnContext, c, ph, prov); break;
      case 'grand_design': resolveGrandDesignOrder(turnContext, c, prov); break;

      default:
    }
  }

  // Army-type classification tables (PRIMAL_ARMY_DEFS_P, ARMY_SPEED_R, FLYING_TYPES, AERIAL_TYPES,
  // CREATURE_ARMIES, MONSTER_ARMIES, CARRIER_TYPES, PRIMAL_SEA_TYPES, SEA_TYPES) moved to module
  // top level — see the banner near MISSILE_ARMIES_MASTER.

  // Turn-wide move points:
  // - Land move points = slowest land army speed (or 5 if no armies), boosted by March
  // - Sea move points = separate pool used only when entering sea provinces
  // Leading NO armies: a flat 5. Naval skill is command of a fleet, not of a rowing boat —
  // a lone hero taking passage gains nothing from it.
  // Leading fleets/sea beasts: the SLOWEST sea unit's speed (the squadron sails at the pace of
  // its worst ship, exactly as a land column marches at the pace of its slowest army), each
  // unit first improved by the Naval bonus — the sea-going mirror of the March bonus.
  const movePoints={};       // land move point pool (REMAINING this turn)
  const seaMovePoints={};     // separate sea move point pool (REMAINING this turn)
  const seaMoveActive={};    // whether this character has sea move capability this turn
  const seaCap={};
  const moveMax={};          // land pool MAX for the turn — lets refreshMovePool preserve points already spent
  const seaMoveMax={};       // sea pool MAX for the turn
  turnContext.movePoints=movePoints;
  turnContext.seaMovePoints=seaMovePoints;
  turnContext.seaMoveActive=seaMoveActive;
  turnContext.seaCap=seaCap;
  turnContext.moveMax=moveMax;
  turnContext.seaMoveMax=seaMoveMax;
  // Light-travel moves made while the character led NO armies (its generous 5-pool "takes passage"
  // mode). Counted here so refreshMovePool can DISCOUNT them when the hero later picks up troops —
  // free-passage moves must not be charged against a real army's small marching allowance.
  const lightLandMoves={};   // land moves made while travelling light (no armies)
  const lightSeaMoves={};    // sea moves made while travelling light (no armies)
  turnContext.lightLandMoves=lightLandMoves;
  turnContext.lightSeaMoves=lightSeaMoves;
  (G.characters||[]).filter(c=>c.player!==null&&c.alive).forEach((...a)=>setMovePool(turnContext,...a));

  const SEASONS=KC_SEASONS.slice();
  turnContext.SEASONS=SEASONS;
  // Turn-wide recruit tracking: provId → armyType → count recruited this turn
  // Limits: garrisons, humanoid fleets and Goblin Hordes = 2 per turn (twoATurn, module level); the
  // founder's own home province = 2 of anything; elsewhere = 1 per type
  const recruitedThisTurn={};
  turnContext.recruitedThisTurn=recruitedThisTurn;

  // A fresh turn: clear last turn's death flags so 'killedThisTurn' marks only deaths this turn.
  G.characters.forEach(c=>{ delete c.killedThisTurn; });

  // record which players had a character present in each province at the START of each phase. Used
  // to decide who may see battle reports they didn't participate in (line-of-sight).
  const presenceByPhase=[];
  turnContext.presenceByPhase=presenceByPhase;

  // Provinces a player's characters ENTERED during the current phase, even if they did not stay. A
  // commander who marches in, fights, and is thrown back still saw the place; the map should
  // remember it. Reset at the top of every phase.
  turnContext.enteredThisPhase={};

  // Intel collapse: intrusion sightings accumulate here across all phases, then a single
  // consolidated "seen during <phases>" line per (target, hero, province) is emitted after the
  // loop.
  const _intrusionAcc=new Map();
  turnContext._intrusionAcc=_intrusionAcc;

  // Items 6 & 7 — per-turn spy tracking. Reset the "provinces spied THIS turn" set on every player
  // at the start of resolution (used to gate non-controlled army DETAIL to spied provinces only).
  // _spiedHeroSkills is NOT reset — it persists across turns and is refreshed on each new spy.
  // 2026-09-17: keep the OUTGOING set as _spiedProvincesLastTurn before clearing it. Bots plan
  // their orders later in this same runTurn, from the end-of-last-turn state — the same snapshot a
  // human's turn report was built from — so their intel layer needs last turn's spy results,
  // exactly as the report that reached the human did. 2026-09-17: THE SPYMASTER'S LEDGER. Every
  // successful act of espionage against a province is filed here as {byPi, provId, kind}, cleared
  // with the rest of the espionage scratch each turn. It is the RAW record \u2014 disguise and
  // counter-intelligence rolls do not touch it, because the Spymaster's whole perk is seeing what
  // the province watch missed. Never persisted to a report except through the title line, so it
  // cannot leak to a realm that does not hold the title.
  G._espionageLedger=[];
  (G.players||[]).forEach(p=>{ p._spiedProvincesLastTurn=(p._spiedProvincesThisTurn||[]).slice(); p._spiedProvincesThisTurn=[]; p._clairCharThisTurn=null; if(!p._spiedHeroSkills) p._spiedHeroSkills={}; }); // _clairCharThisTurn: 2026-09-12 Clairvoyance reveal (one per realm)

  // Defend watches and Pursuits last for the rest of the TURN only — never across turns.
  (G.characters||[]).forEach(c=>{ delete c._defend; delete c._pursuit; delete c._defendReactedPhase; });
  // "The province they attacked from" is a fact about THIS turn's marching. It was never cleared,
  // so a character who attacked out of some far-off province turns ago and later lost a battle
  // elsewhere "retreated" straight back to that stale, distant province (five hexes in one case).
  // Every retreat site now also refuses a non-adjacent _attackedFrom; this sweep stops the
  // stale value existing at all.
  (G.characters||[]).forEach(c=>{ delete c._attackedFrom; });

  const _distCache=new Map();
  turnContext._distCache=_distCache;

  // ── LIVE TITLE PERKS ── (holder computation + helpers moved earlier in runTurn to avoid a
  // temporal-dead-zone when the turn-start pursuit resolution reads them — see near the relation
  // helpers.)

  // ── MITHRIL SWEEP ── Before any battle this turn, ensure every Dwarven character serving a
  // Dwarven realm is suited in mithril — a self-healing catch-all covering heroes hired last turn,
  // resurrected dwarves, charm-reverts, and any path the inline grants miss.
  grantMithrilToDwarves(G);

  // LAIR NAMES v2 — older worlds were named at random from per-terrain pools, so a guardian and its
  // lair rarely matched and 68 of 81 names were reused at different difficulties (which is what
  // made lair and guardian show different colours in the Chronicle). Re-name every lair once, from
  // its own guardian's pools and uniquely. Idempotent: the flag stops it ever running twice.
  if(!G._lairNamesV3){ const _rn=renameLairsThematicP(G); if(_rn>0) log('system',`\u{1F5FA} The chronicles are corrected: ${_rn} lair${_rn!==1?'s are':' is'} now recorded under a name befitting what dwells there.`,{actor:null,targets:[]}); }
  // EVERY GUARDIAN IS 5 HP FRAILER. The table was re-statted, but a live world keeps its own copy
  // of each guardian on the feature (and `_hpFull`, the undamaged total a guardian is restored to
  // between fights), so the table change alone would never reach a game in progress. One flagged,
  // idempotent pass brings existing worlds into line. Floored at 5 so nothing is ever reduced to a
  // guardian that cannot fight.
  if(!G._guardianHpV2){
    let _gh=0;
    (G.world&&G.world.provinces||[]).forEach(p=>(p&&p.features||[]).forEach(f=>{
      if(!f||f.ritualSite||!f.monster) return;
      if(f.monster.hp!=null){ f.monster.hp=Math.max(5,f.monster.hp-5); _gh++; }
      if(f.monster._hpFull!=null) f.monster._hpFull=Math.max(5,f.monster._hpFull-5);
    }));
    G._guardianHpV2=true;
    if(_gh>0) log('system',`\u{1F489} The world's guardians are re-measured: ${_gh} lair-keeper${_gh!==1?'s'.concat(' are'):' is'} 5 hit points frailer than before.`,{actor:null,targets:[]});
  }

  // ── RETIRED DISCOVERIES ── the Library (sd30) was removed from the game on 2026-09-09. Strike it
  // from any realm that had already found it, so no live save keeps a dead entry on its sheet.
  (G.players||[]).forEach(pl=>{ if(pl&&Array.isArray(pl.discoveries)) pl.discoveries=pl.discoveries.filter(d=>d&&d.id!=='sd30'); });

  // GRAND DESIGN — Divine (Grand Cathedral): the capital is permanently warded
  // (Plague/Earthquake/Flood/Part Sea turned aside). 2026-09-14: the ward lies over the province
  // the CATHEDRAL STANDS IN, not over a capital id frozen at game start. gdActive already requires
  // the realm to still hold that ground, which also fixes the old bug where a Divine realm that
  // lost its capital kept warding it for its conqueror.
  (G.players||[]).forEach((pl,pi)=>{ if(gdActive(turnContext,pi,'Divine')){ const _cap=G.world.provinces[pl.gdProvinceId!=null?pl.gdProvinceId:homeProvinceIdFor(G,pi)]; if(_cap){ _cap._blessWardTurn=G.turn; _cap._blessWardBy=pi; _cap._blessWardPct=100; } } });
  // ── BOT DECISIONS + default-to-Defend ── run here, after every helper const in this block is initialised
  // (the hunters' duel forecast needs autoEncounterPlan / NPC_SPELL_BY_SCHOOL / resolvePersonalCombat).
  // 2c. BOT DECISIONS (Phase 3a) — bots write their own movement orders into G.turnOrders, using
  // the start-of-turn world state, before the default-to-Defend pass fills the rest. Bots submit no
  // orders through the portal, so this is where their turn is decided. Movement only for now
  // (expansion); economy/actions/spells and enemy-target/battle AI are staged (3b/3c/4). Sept 2026
  // (hunter tactics): a Monte-Carlo duel forecast for the bot hunters, built on the engine's own
  // personal-combat resolver. Both fighters are deep-cloned with off-roster ids (so skill gains, HP
  // loss, item transfers and mercy flags land on the clones, never the real records) and fight `n`
  // times.
  const _botDuelSim=(hunter,quarry,n)=>{
    // 2026-09-28: a forecast, not a fight — experience is muted exactly as in simulateLairOdds (the copies carry
    // ids −1/−2, so no real hero ever gained from it, but every simulated win still rolled a wasted check).
    const _prevSim=turnContext._pcSimulating; turnContext._pcSimulating=true;
    try{
      let win=0, felled=0; n=n||20;
      for(let i=0;i<n;i++){
        const a=JSON.parse(JSON.stringify(hunter)), b=JSON.parse(JSON.stringify(quarry));
        a.id=-1; b.id=-2; delete a._sgLog; delete b._sgLog;
        a.encounterPlan={tactics:autoEncounterPlan(turnContext,a),notes:'',_auto:true};
        if(!(b.encounterPlan&&Array.isArray(b.encounterPlan.tactics)&&b.encounterPlan.tactics.length)) b.encounterPlan={tactics:autoEncounterPlan(turnContext,b),notes:'',_auto:true};
        const COMBAT_ONLY=COMBAT_ONLY_TACTICS;
        const filt=pl=>(pl||['ME']).filter(t=>COMBAT_ONLY.has(String(t).split(':')[0].toUpperCase()));
        const A=pcCharCombatant(turnContext,a), B=pcCharCombatant(turnContext,b); A.tactics=filt(a.encounterPlan.tactics); B.tactics=filt(b.encounterPlan.tactics); if(!A.tactics.length)A.tactics=['ME']; if(!B.tactics.length)B.tactics=['ME'];
        const res=resolvePersonalCombat(turnContext,A,B,{maxRounds:20});
        if(res.winner===A) win++; if(res.aHp<=0 && res.winner!==A) felled++;
      }
      return {win:win/n, felled:felled/n};
    }catch(e){ return null; }
    finally{ turnContext._pcSimulating=_prevSim; }
  };
  // Phase 3 (pre) — item 2: any bot realm that has lost its last province concedes before it plans
  // a turn.
  runBotConcessions(G, _botPlayerIdx, log);
  runBotMovement(G, _botPlayerIdx, {duelSim:_botDuelSim, terrainMult:(t,tr)=>terrainMod(t,tr)*seaPenalty(t,tr)});
  // Phase 3b — economy: holders (characters not moving) in owned provinces spend the treasury on
  // sustainable reinforcements (and opportunistic hires). Must run AFTER movement so movers are
  // skipped.
  runBotPhaseOne(G, _botPlayerIdx, 'muster');   // 2026-09-29: hosts in contact claim the chest first (and outmatched war-front hosts withdraw)
  runBotEconomy(G, _botPlayerIdx);
  // Phase 3c — character actions: any bot character still idle (didn't move or recruit) trains,
  // heals, or explores instead of sitting on Defend. Must run AFTER movement + economy.
  runBotActions(G, _botPlayerIdx);
  // Phase 3d — PHASE-ONE PASS (2026-09-29): what must happen in Spring, before any enemy can move, goes first.
  runBotPhaseOne(G, _botPlayerIdx, 'order');
  // Phase 3e — ORDER HYGIENE (2026-09-29): drop bot orders that cannot work (capped practice, casts past the limit,
  // dead hires, skeletons handed to the living) and refill those phases, training together where possible.
  runBotOrderHygiene(G, _botPlayerIdx);

  // Phase 5 — a dominant bot king Calls the Reckoning (adds itself to the calls processed below).
  runBotReckoning(G, _botPlayerIdx, reckoningCalls);

  // 3. Default any missing orders to Defend
  (G.characters||[]).filter(c=>c.player!==null&&c.alive).forEach(c=>{
    if(!G.turnOrders[c.id]) G.turnOrders[c.id]=[null,null,null,null,null];
    G.turnOrders[c.id]=G.turnOrders[c.id].map(o=>o||{action:'defend',target:'',extra:'',desc:'Defend'});
  });
  // TELEMETRY: the orders as they stand now — every realm's, humans' as submitted and bots' as
  // planned — before a single one resolves (the resolution rewrites slots: pins, unifications).
  try{ (G.players||[]).forEach((pl,pi)=>{ if(!pl) return;
    _tel.orders[pi]=telOrdersFor(G,pi,{diplomacy:diploDeclarations[pi]||null, callReckoning:reckoningCalls.has(pi)||undefined,
      concede:(pl.conceded&&pl.concededTurn===expectedTurnToRun)||undefined, plans:Object.fromEntries((G.characters||[]).filter(c=>c&&c.alive&&c.player===pi&&c.encounterPlan&&Array.isArray(c.encounterPlan.tactics)).map(c=>[c.id,c.encounterPlan.tactics.slice(0,12)]))}); }); }catch(_te){ console.warn('telemetry orders:',_te); }

  const _warFrontAtStart=new Map(); // charId → the province his host stood in when the turn began
  turnContext._warFrontAtStart=_warFrontAtStart;
  warFrontThreats(turnContext).forEach(({c,prov})=>{ if(!prov._battleUnresolved) _warFrontAtStart.set(c.id,prov.id); });
  const _warFrontProvs=new Set(_warFrontAtStart.values());
  turnContext._warFrontProvs=_warFrontProvs;
  for(let ph=0;ph<5;ph++){
    turnContext._currentPhase=ph; // reliable phase for skill-rises earned outside processOrder
    const _phaseStartLoc={}; (G.characters||[]).forEach(c=>{ if(c&&c.alive) _phaseStartLoc[c.id]=c.location; }); // for noteSilentHeroes
    log('system',`— ${SEASONS[ph]} —`);
    // sd29 Herbal Lore: a character who took wounds in the PREVIOUS phase has them dressed at the
    // start of this one, recovering 40% of the damage that fight cost them
    // (rounded, never less than 1). `_hpAtPhaseStart` is the HP snapshot taken here each phase; it
    // persists in the saved state, so wounds taken in the final phase of a turn heal at the start
    // of the next. Only the wounds of that one fight are treated — it is not a standing
    // regeneration.
    (G.characters||[]).forEach(c=>{
      if(c.alive&&c.player!=null&&c.hp!=null&&c._hpAtPhaseStart!=null&&c.hp<c._hpAtPhaseStart&&c.hp<(c.maxHp||20)&&hasDisc(turnContext,c.player,'sd29')){
        const _dmg=c._hpAtPhaseStart-c.hp;
        const _heal=Math.min(Math.max(1,Math.round(_dmg*discParam('sd29','pct',0.40))),(c.maxHp||20)-c.hp);
        if(_heal>0){
          c.hp=c.hp+_heal;
          // filed under the CHARACTER for THIS phase. It is the first line of the phase, before any
          // order resolves.
          log('system',`🌿 Herbal Lore: ${c.name}'s wounds from the previous season are dressed with healing herbs — 40% of the ${_dmg} damage taken is mended. +${_heal} HP (${c.hp}/${c.maxHp||20}).`,{actor:c.player,targets:[c.player],charId:c.id,phase:ph,provinceId:(c.location!=null?c.location:undefined)});
        }
      }
      c._hpAtPhaseStart=(c.alive&&c.hp!=null)?c.hp:null;
    });
    // Snapshot presence at phase start (before this phase's moves/battles).
    presenceByPhase[ph]=new Map();
    (G.characters||[]).forEach(c=>{
      if(c.alive && c.location!=null && c.player!=null){
        let s=presenceByPhase[ph].get(c.location);
        if(!s){ s=new Set(); presenceByPhase[ph].set(c.location,s); }
        s.add(c.player);
      }
    });
    // Snapshot every character's skill levels at the START of this phase, before ANY of them train.
    // Group-training comparisons (mentor / peer) read these frozen levels, so a character who
    // trains up earlier this phase can't retroactively become a mentor to a co-trainer who is
    // processed later in the same phase.
    turnContext.enteredThisPhase={}; // provinces entered during THIS phase only
    G._phaseSkillSnapshot={};
    (G.characters||[]).forEach(ch=>{ if(ch&&Array.isArray(ch.armies)&&ch.armies.some(a=>a&&a._phantom)) ch.armies=ch.armies.filter(a=>!(a&&a._phantom)); }); // PHANTOM safety net: strip any stray fighting-copies
    (G.characters||[]).forEach(c=>{ G._phaseSkillSnapshot[c.id]={...(c.skills||{})}; delete c._encounteredThisPhase; delete c._amphibiousAssault; delete c._foughtStalledBattlePhase; delete c._enteredProvThisPhase; });
    // Re-fight any battles whose loser could not retreat last phase (they are still co-located).
    // ILLUSORY L9 VEIL — post-veil re-trigger: once a veil parts, a fight that was skipped while
    // the force was hidden must be joined. Flag any province where two enemy players' armed,
    // UNVEILED forces now stand together and it is not already contested; resolveStalledBattles
    // (next) resolves it.
    flagEnemyStandoffs(turnContext,ph===0?_warFrontProvs:null); // a fresh war front waits for the end of Spring
    resolveStalledBattles(turnContext,ph);
    settleRalliedGarrisons(turnContext); // return rallied garrisons to their province if the contest is won, else keep them with the hero
    settleStrandedAtSea(turnContext,ph); // 2026-09-23c: a column left unshipped by a resumed sea battle (or an old save) puts its excess ashore
    turnContext._logCtx={charId:null,phase:null}; // clear the battle-leader context set per province above
    turnContext._combatSkillProv=null; // stalled battles done — no series context until the next fight
    spreadPlagues(turnContext,ph);

    // Heroes hired this phase can't act yet, but should still be told so.
    (G.characters||[]).forEach(c=>{
      if(c.player!==null&&c.alive&&c.hiredInPhase===ph){
        log('hire',`${c.name} was hired this phase and will be ready to act from the next phase.`,{actor:c.player,targets:[c.player]});
      }
    });

    // ── STAGE 1: declare intent (read-only) ──
    const intents=buildPhaseIntents(turnContext,ph);

    // ── STAGE 1b: battle-lock pin (AK: you are stuck in a province until its battle is decided) ──
    // resolveStalledBattles(ph) has just re-fought every contested province. Any province that is
    // STILL flagged _battleUnresolved has an unresolved battle whose outcome pins the forces in it:
    // an army-leader standing there cannot march away this phase — they must see the fight through.
    // This is what stops a character who won a battle but whose foe rallied from slipping out to
    // start a fresh battle somewhere else. Only relocating orders (Move / Pursue) are cancelled;
    // other orders are left untouched.
    intents.forEach(it=>{
      if(it.cancelled) return;
      if(it.action!=='move'&&it.action!=='pursue'&&it.action!=='encounter') return; // an Encounter chase is a relocating order
      if(!it.leadsArmy) return;
      const here=G.world.provinces[it.fromId];
      // a character fought their one battle for the phase if EITHER their province is still
      // contested (unresolved) OR resolveStalledBattles just fought a follow-up battle for them
      // this phase (win or lose). Both must cancel a Move/Pursue so they can't march on and start a
      // SECOND battle in the same phase.
      const _stillContested=!!(here&&here._battleUnresolved);
      const _foughtFollowUp=(it.c._foughtStalledBattlePhase===ph);
      if(!_stillContested&&!_foughtFollowUp) return;
      it.cancelled=true; it.cancelReason='battleLocked';
      log('combat', _stillContested
        ?`${it.c.name} is still locked in the unresolved battle for ${here.name} and cannot march away — the fight must be seen through before they can move on.`
        :`${it.c.name} has already fought a battle this phase and cannot march on to start another — one battle per phase.`,
        {actor:it.player,targets:[it.player],provinceId:it.fromId,public:false,charId:it.id,phase:ph,pinNotice:true});
    });

    // ── STAGE 2a: movement interlocks — pin generals whose province is invaded before they leave
    // ──
    applyMoveInterlocks(turnContext,ph,intents);
    intents.forEach(it=>{
      if(!it.cancelled) return;
      if(!G.turnOrders[it.id]) G.turnOrders[it.id]=[null,null,null,null,null];
      const _pinDesc=it.cancelReason==='battleLocked'?'Locked in ongoing battle':'Defend (held in place)';
      G.turnOrders[it.id][ph]={action:'defend',target:'',extra:'',desc:_pinDesc,_pinned:true};
      it.action='defend'; it.toId=null; it.dest=null;
    });

    // ── STAGE 2b: Defending generals react, and ordered reinforcements arrive, before the
    // invasions that provoked them resolve ──
    // a Defend order given THIS phase is on watch from the start of the phase — the general answers
    // incursions in the same phase he is ordered to Defend, not only from the next. Pre-activate it
    // here (the 'defend' case later re-stamps the same watch; it keeps the one-reaction-per-phase
    // marker if this pre-activation already spent it). Pinned/rewritten orders, characters with no
    // order at all (which default to Defend only in name), and live pursuits are left alone.
    intents.forEach(it=>{
      if(it.cancelled||it.action!=='defend'||!it.order||it.order._pinned) return;
      const c=it.c; if(!c||!c.alive||c.player==null) return;
      if(c._pursuit&&c._pursuit.active) return;
      if(defendSpentThisPhase(turnContext,c,ph)) return; // item 15: already fought this phase (a resumed battle) — no new watch until a later Defend
      if(c._defend&&c._defend.active&&c._defend.setPhase===ph) return;
      const _carried=!!(c._defend&&c._defend.active); // a watch already kept from an earlier phase simply continues
      c._defend={centre:c.location,active:true,setPhase:ph,preActivated:true,carried:_carried};
      delete c._defendReactedPhase;
    });
    // (the Defend ride-out itself is NOT made here any more — see flushDefendStep below: it waits
    // until every non-moving order of the phase, including any aimed at the general, has resolved)
    runReinforcementArrivals(turnContext,ph,intents);
    intents.forEach(it=>{
      if(!it.cancelled||it.cancelReason!=='reinforced') return;
      if(!G.turnOrders[it.id]) G.turnOrders[it.id]=[null,null,null,null,null];
      G.turnOrders[it.id][ph]={action:'defend',target:'',extra:'',desc:'Defend (arrived early)',_pinned:true};
      it.action='defend'; it.toId=null; it.dest=null;
    });

    // ── STAGE 3: resolve orders, in initiative order adjusted for AK's [3.0] exceptions ──
    const sorted=orderPhaseActors(turnContext,ph,intents);
    // ── THE DEFEND STEP ── sits between the two order tiers. Every non-relocating order (casting,
    // transfers, items, recruiting…) resolves first, in initiative order, with everyone still
    // standing where the phase began — so an Oratory, a handed-over column or a hostile Curse aimed
    // at a general on Defend finds him at home. THEN generals on Defend ride out to the marching
    // threats announced at the top of the phase, THEN hosts raised/summoned during the order step
    // are settled (the watching general arriving first), and only then does any Move resolve — so
    // he is still in the line before the invader arrives and before a raised host can take ground.
    // Fires once: before the first relocating or Defend-tier actor, or after the loop if none.
    turnContext._tier0Open=true; turnContext._unitGainQueue=[];
    const flushDefendStep=()=>{
      if(!turnContext._tier0Open) return;
      turnContext._tier0Open=false; turnContext._combatSkillProv=null; turnContext._logCtx={charId:null,phase:null};
      runDefendReactions(turnContext,ph,intents);
      const q=turnContext._unitGainQueue; turnContext._unitGainQueue=[];
      q.forEach(({c:rc,prov:rp})=>{
        if(!rc||!rc.alive||rc.location!==rp.id||(rc.armies||[]).length===0) return; // the host is gone
        turnContext._combatSkillProv=null; turnContext._logCtx={charId:rc.id,phase:ph};
        resolveUnitGainInProvince(turnContext, rc, rp, ph);
        turnContext._logCtx={charId:null,phase:null};
      });
      turnContext._combatSkillProv=null;
    };
    sorted.forEach(c=>{
      if(turnContext._tier0Open){
        const _a=normaliseAction((G.turnOrders[c.id]||[])[ph]);
        if(_a==='move'||_a==='pursue'||_a==='encounter'||_a==='defend'||(c._pursuit&&c._pursuit.active)) flushDefendStep();
      }
      turnContext._combatSkillProv=null; // between independent actors, no battle-series context is active
      // A live pursuit suspends this character's other orders until the chase resolves.
      if(c.alive&&c._pursuit&&c._pursuit.active&&c._pursuit.setPhase!==ph){
        turnContext._logCtx={charId:c.id,phase:ph};
        advancePursuit(turnContext,c,ph);
        turnContext._logCtx={charId:null,phase:null};
        settleStrandedAtSea(turnContext,ph); // a chase that ended in a sea battle
        return;
      }
      // A coward who begged for mercy this turn is broken and out of action — skip all remaining
      // orders.
      if(c._mercyFledTurn===G.turn){ turnContext._logCtx={charId:null,phase:null}; return; }
      const o=(G.turnOrders[c.id]||[])[ph];
      // 2026-09-21: processOrder returns silently for a dead character, so a hero killed in an
      // earlier phase simply stopped mid-Chronicle with no explanation for the orders his player
      // had submitted. Say it plainly instead.
      if(o&&c.alive===false){
        if(c.killedThisTurn&&!c._fallenOrderNoted){
          c._fallenOrderNoted=true;
          log('system',`${c.name} has fallen — their remaining orders for this turn go unanswered.`,{actor:c.player,targets:[c.player],charId:c.id,phase:ph});
        }
        turnContext._logCtx={charId:null,phase:null};
        return;
      }
      if(o)processOrder(c,o,ph);
      turnContext._logCtx={charId:null,phase:null}; // reset after each character
      settleStrandedAtSea(turnContext,ph); // 2026-09-23c: hulls lost in this order's battle — put the uncarried ashore before anyone moves again
    });

    flushDefendStep(); // a phase with no relocating or Defend-tier actor still gets its Defend step
    if(ph===0) resolveWarFronts(turnContext,ph); // hosts caught on a war front turn on the province at the end of Spring
    // every order this phase has resolved, so any enemy force RAISED or SUMMONED into a defender's
    // watch zone now exists — let generals on Defend ride out and give it battle.
    turnContext._combatSkillProv=null;
    runDefendMaterializedReactions(turnContext,ph);
    turnContext._combatSkillProv=null;
    // lone characters on Defend now spring their Spy-gated ambushes on this phase's incursions.
    runDefendAmbush(turnContext,ph);
    turnContext._combatSkillProv=null;
    reconcileDefendRideOuts(turnContext,ph); // a ride-out that met no battle is explained

    // all this phase's actions have resolved — now report any incidental skill-rises they earned
    // (Explorer on a move, March on a march, etc.) as the last lines of the phase, so each reads as
    // a consequence of the action that caused it rather than interrupting it.
    resolveAllPendingSkillGains(turnContext); // 2026-09-26b: settle each character's one skill rise for the phase
    if(turnContext._deferredSkillLogs.length){ writeDeferredSkillLines(turnContext,turnContext._deferredSkillLogs); turnContext._deferredSkillLogs=[]; }

    // A Move order in a later phase cancels a standing Defend (AK [3.15]).
    (G.characters||[]).forEach(c=>{
      if(!c._defend||!c._defend.active) return;
      const nxt=(G.turnOrders[c.id]||[])[ph+1];
      if(!nxt) return;
      const a=normaliseAction(nxt);
      if(a==='move'||a==='pursue'||a==='encounter') c._defend.active=false; // a later Encounter cancels a standing Defend
    });

    // Generate intrusion notifications for this phase
    generateIntrusionNotifications(turnContext,ph);

    settleStrandedAtSea(turnContext,ph); // every battle, ride-out and ambush of the phase is over
    // ── Fallen-commander sweep ── A commander slain in a pre-battle duel keeps their army through
    // the battle (a junior officer leads); whatever survived is dispersed NOW that the fighting is
    // over — garrison in a friendly province, retreat to adjacent friendly land, or scatter as
    // mercenaries (always mercenaries for neutral characters). Without this sweep, armies would
    // stay attached to a corpse for the rest of the turn.
    (G.characters||[]).forEach(dc=>{
      if(dc.alive||(dc.armies||[]).length===0) return;
      // Still contested? The host stays where it is and fights again next phase.
      const _here=G.world.provinces[dc.location];
      if(_here&&_here._battleUnresolved){ dc._leaderlessHost=true; return; }
      delete dc._leaderlessHost;
      disperseDeadCharArmies(turnContext,dc);
    });

    // province.characters is derived from character.location — rebuild it before anything reads it,
    // so a battle that moved someone on a copy cannot leave the map out of step.
    reconcileProvinceCharacters(turnContext);
    noteSilentHeroes(turnContext,ph,_phaseStartLoc);
    // snapshot each player's observable view of the world at the end of this phase.
    updateProvinceMemory(turnContext,ph);
    turnContext.enteredThisPhase={}; // consumed by the snapshot above — start the next phase clean

    // Tax collection moved to Early Winter block below

    // Hero pay and army wages at Early Winter
    if(ph===4){
      // ── Charm revert ── A hero whose command was seized by an enemy Charm returns to their own
      // lord as the season turns. This happens BEFORE tax and wages so the original owner (not the
      // charmer) pays their upkeep, per the spell's terms. Order/battle control has already run for
      // the turn.
      (G.characters||[]).forEach(hc=>{
        if(hc&&hc._charmTempControl&&hc._charmOriginalPlayer!=null){
          const back=hc._charmOriginalPlayer;
          if(hc.player!==back){
            hc.player=back;
            if(typeof setMovePool==='function') setMovePool(turnContext,hc);
          }
          delete hc._charmTempControl; delete hc._charmControlFrom;
          delete hc._charmedByPlayer; delete hc._charmedForPhase; delete hc._charmOriginalPlayer;
          if(hc.alive) log('system',`As the season turns, the enchantment on ${hc.name} fades and they return to their own lord.`,{actor:back,targets:[back]});
        }
      });
const ARMY_COST=ARMY_COST_MASTER; // alias → master table at top of script
      // Army cost lookup (matches ARMY_TYPES cost values in game.js)
      
// ── SAGE DISCOVERIES ────
// 40 discoveries organised by category. effect: {type,...params} — applied at turn resolution time


            // Tax collection (before wages)
      log('system','═ Tax collection ═');
      G.players.forEach(p=>{
        const pi=p.id;
        // open the Realm Events economy block with the treasury balance the realm carries INTO tax
        // collection (p.gold before any income is added), so the player sees their starting gold
        // above the tax/wages lines that follow.
        if((p.provinces||[]).length>0||(G.characters||[]).some(c=>c.player===p.id&&c.alive)||(p.gold||0)>0){
          log('system',`${p.name} has ${p.gold||0}g in the treasury.`,{actor:p.id,targets:[p.id]});
        }
        const _taxAcc=new Map(); // capped `tax` discoveries: gold paid so far this collection
        const _baseTax=realmBaseTax(G,pi), _taxCap=taxBonusCap(_baseTax); // 5%-of-base ceiling (Toby 2026-09-24)
        let _consecBonus=0; // DIVINE — Consecrate: track the +50% holy-ground uplift so the player can SEE it itemised
        const income=(p.provinces||[]).reduce((s,id)=>{
          const pv=G.world.provinces[id];if(!pv) return s;
          let t=pv.tax||0;
          if(pv._earthquakeNoTax===G.turn) t=0; // Earthquake: no revenue this turn
          if(pv._sabotagedForTurn===G.turn) t=0; // SPY L7 Sabotage: wrecked province yields no tax this turn
          if(pv._blessedTurn===G.turn) t=Math.round(t*(pv._blessedMult||1.6)); // Bless Province: +60% (or +100% from a Divine king)
          if(isConsecrated(p,pv.id)){ const _cb=t; t=Math.round(t*1.5); _consecBonus+=(t-_cb); } // DIVINE — Consecrate: hallowed ground prospers (+50%)
          if(pv._enslavedUntil!=null&&pv._enslavedUntil>=G.turn) t=Math.max(0,t-1); // EVIL — Enslave: resentment (−1 tax while it lasts)
          if(pv._earthquakeTax) t=Math.max(0,t-(pv._earthquakeTax||0));
          // every province-tax discovery (sd11 / sd15 / sd18 and the heritage & creed ones), capped
          // per discovery — see discTaxAdd. Keep in step with buildTurnReport.
          t+=discTaxAdd(p,pv,G,pi,_taxAcc,_taxCap);
          // GRAND DESIGN — Good (Free City Charter): +2 tax on every province you hold with a
          // garrison.
          if(gdActive(turnContext,pi,'Good')&&(pv.garrisonArmies||[]).length>0) t+=2;
          return s+t;
        },0);
        const pChars=(G.characters||[]).filter(c=>c.player===p.id&&c.alive);
        const itemStat=(st)=>pChars.reduce((s,c)=>s+(activeItems(c).reduce((a,it)=>a+(it.effect&&it.effect.stat===st?it.effect.bonus:0),0)),0);
        // Ring of Wealth & co (flat) and Merchant's Ledger (+1g per province owned, if any hero
        // carries one) pay tax gold — together they are capped at 5% of the realm's base tax income.
        const _taxBonusRaw=pChars.reduce((s,c)=>s+(c.taxBonus||0),0)+itemStat('taxBonus');
        const ledgers=pChars.some(c=>activeItems(c).some(it=>it.effect&&it.effect.stat==='taxPerProv'));
        const _perProvRaw=ledgers?(G.world.provinces||[]).filter(pv=>pv.owner===p.id).length:0;
        const _itemTax=capItemTaxGold(_taxBonusRaw,_perProvRaw,_taxCap);
        const taxBonus=_itemTax.taxBonus, perProvBonus=_itemTax.perProvBonus;
        const interestBonus=discEff(turnContext,pi,'interest').reduce((s2,e)=>s2+Math.min(_taxCap,Math.floor((p.gold||0)*(e.pct||0))),0); // interest discoveries
        // Neutral trade: +20% of province income, rounded down.
        // (10 -> floor(1.9999...) = 1 instead of 2). Keep in step with neutralTradeGold / the report builder.
        // sd14 Taxation Records: +10% of province income, rounded down. Integer maths for the same
        // reason neutralTradeGold uses it — floor(income*0.10) drifts a gold on float-unfriendly
        // totals.
        const taxRecordsBonus=hasDisc(turnContext,pi,'sd14')?taxRecordsGold(income,_taxCap):0;
        const neutralTradeBonus=neutralTradeGold(p,income);
        // ── MINOR-TITLE PERKS (economy) ── Cutpurse / Champion of the People +2g, Castellan +1g
        // per 5 provinces.
        // (The nine Imperial Titles carry NO economic perk — their per-turn benefit is an intel line at end of turn.)
        let titlePerkGold=0, titlePerkNote='';
        pChars.forEach(pc=>{ if(charMinor(turnContext,pc,'cutpurse')){ titlePerkGold+=2; titlePerkNote+=` (+2g the Cutpurse)`; } if(charMinor(turnContext,pc,'champion')){ titlePerkGold+=2; titlePerkNote+=` (+2g Champion of the People)`; } if(charMinor(turnContext,pc,'castellan')){ const cg=Math.floor((G.world.provinces||[]).filter(pv=>pv.owner===pi).length/5); if(cg>0){ titlePerkGold+=cg; titlePerkNote+=` (+${cg}g the Castellan)`; } } });
        // THIEF L6: +5g income per Thief-6 character. Pay it here.
        const thiefStipend=pChars.reduce((sm,ch)=>sm+(perkTier(ch,'thief')>0?5:0),0);
        const thiefNote=thiefStipend>0?` (+${thiefStipend}g Thief network)`:'';
        p.gold=(p.gold||0)+income+taxBonus+perProvBonus+interestBonus+neutralTradeBonus+taxRecordsBonus+titlePerkGold+thiefStipend;
        if(income>0||perProvBonus>0||titlePerkGold>0||thiefStipend>0)log('system',`${p.name} collects ${income+taxBonus+perProvBonus+interestBonus+neutralTradeBonus+taxRecordsBonus+titlePerkGold+thiefStipend}g in taxes${taxRecordsBonus>0?` (+${taxRecordsBonus}g Taxation Records)`:''}${perProvBonus>0?` (+${perProvBonus}g Merchant's Ledger)`:''}${neutralTradeBonus>0?` (+${neutralTradeBonus}g Neutral trade bonus)`:''}${interestBonus>0?` (+${interestBonus}g Merchant Guilds interest)`:''}${_consecBonus>0?` (+${_consecBonus}g from consecrated ground)`:''}${titlePerkNote}${thiefNote}.`,{actor:p.id,targets:[p.id]});
      });
      log('system','═ Army wages & hero wages ═');
      G.players.forEach(p=>{
        const pi=p.id;
        // the same 5%-of-base-income ceiling the tax collection above uses: `upkeep`, `heroWage` and
        // `heroWageCap` discoveries are each capped at it per turn (2026-09-26, Toby). Recomputed
        // here because the collection loop is a separate pass with its own scope.
        const _taxCap=taxBonusCap(realmBaseTax(G,pi));
        const playerChars=(G.characters||[]).filter(c=>c.player===p.id&&c.alive);
        // Army wages — every carried army costs its recruitment cost per turn
        const allArmies=playerChars.flatMap(c=>c.armies||[]);
        // Also count garrison armies left in provinces
        const garrisonArmies=(G.world.provinces||[]).filter(pv=>pv.owner===p.id).flatMap(pv=>pv.garrisonArmies||[]);
        const allKingdomArmies=[...allArmies,...garrisonArmies];
        // temporary summons (elementals) are a spell effect that dissolves at turn end — they draw
        // no wage and are never disbanded for non-payment (see the disband loop below). ORC
        // WAR-SPOILS — an Orcish unit of an Orcish realm that won a battle as part of an attacking
        // force THIS turn pays only half upkeep for this turn (min 1g).
        const _orcKingdom=(p.race==='Orcish');
        // DRUID L6 — creatures/monsters led by a Druid-6 character pay half wages. Built as a Set
        // of the actual army objects (identity), since the wage sum flattens away the leader
        // association.
        const _druidHalfWage=new Set();
        playerChars.forEach(ch=>{ if(perkTier(ch,'druid')>0||gdActive(turnContext,p.id,'Druidic'))(ch.armies||[]).forEach(a=>{ if(CREATURE_ARMIES.has(a.type)||MONSTER_ARMIES.has(a.type)) _druidHalfWage.add(a); }); }); // + GRAND DESIGN Druidic
        const _upkAcc=new Map(); let _discUpkeepG=0;
        let _orcSpoilsG=0; // 2026-09-10 item 3: itemised so the report can explain the one-off discount
        // 2026-09-27 (Toby items 8 & 9): ORC WAR-SPOILS WAS NOT PAYING 50%.
        // The discount was `Math.max(1, Math.round(w*0.5))` PER UNIT, and every odd wage rounds the
        // wrong way: a 3g unit halved to 2g, not 1.5g. A host of four 3g units and one 4g unit —
        // 16g of wages — therefore saved 6g where the rule promises 8g, which is exactly the
        // shortfall reported. Rounding each unit DOWN instead would overshoot the other way (10g off
        // the same host). The halving now carries its remainder from unit to unit: each qualifying
        // unit pays floor(w/2), and the accumulated half-golds are paid by rounding the next unit up
        // as soon as a whole gold has built up. Across the qualifying units the total is exactly half
        // (or half rounded to the nearest gold), which is what "half upkeep" has always meant.
        // The 1g floor still applies per unit, so a 1g unit is never free.
        let _orcFrac=0;
        let armyWages=allKingdomArmies.reduce((s,a)=>{
          if(a._temporary) return s;
          // Wild Hunt: the bound beasts answer the old gods, not a paymaster. They draw NO wage for
          // the two turns they serve, and are never disbanded for non-payment (see the loop below).
          if(a._wildHuntUntilTurn!=null) return s;
          if(a._isSkeletal) return s+1;
          let w=ARMY_COST[a.type]||2;
          if(_orcKingdom && a.race==='Orcish' && a._orcAtkWinTurn===G.turn){
            const _w0=w, _half=_w0*0.5;
            let _wHalf=Math.floor(_half);
            if(_wHalf<1){
              // The 1g floor bites: this unit already pays MORE than half, so it neither banks a
              // remainder nor spends one. (Letting a 1g unit both claim the floor and consume the
              // carry undercharged the rest of the host by a gold every time.)
              _wHalf=1;
            } else {
              _orcFrac+=_half-_wHalf;
              if(_orcFrac>=1-1e-9){ _wHalf+=1; _orcFrac-=1; }
            }
            w=_wHalf; _orcSpoilsG+=_w0-w;
          }
          if(_druidHalfWage.has(a)) w=Math.max(1,Math.floor(w*0.5)); // DRUID L6
          { const _w0=w; w=discUpkeepWage(p,a,w,_upkAcc,_taxCap); _discUpkeepG+=_w0-w; } // `upkeep` discoveries
          return s+w;
        },0);
        // MINOR TITLE — The Host-Leader: this realm's greatest general pays 1g less per unit he
        // leads (min 1/unit).
        let _hostLeaderG=0;
        { const hl=playerChars.find(c=>charMinor(turnContext,c,'hostleader')); if(hl){ const led=(hl.armies||[]).filter(a=>!a._temporary&&a._wildHuntUntilTurn==null).length; _hostLeaderG=Math.min(armyWages,led); armyWages=Math.max(0,armyWages-led); } }

        // Hero wages
        const heroes=playerChars.filter(c=>!c.isKing);
        // heroWage / heroWageCap discoveries (sd17 Granaries, sd38 Inspiring Leadership, creeds) —
        // one shared helper, mirrored in buildTurnReport.
        const _hwAcc=new Map();
        let _heroWageDisc=0;
        const heroWages=heroes.reduce((s,h)=>{ const raw=(h.pay||0); const w=discHeroWage(p,h,raw,_hwAcc,_taxCap); _heroWageDisc+=Math.max(0,raw-w); return s+w; },0);

        const totalWages=armyWages+heroWages;
        // 2026-09-10 item 3: the figures ACTUALLY charged this turn are stamped on the player.
        // buildTurnReport reads them for the "Your Realm" box, so the two sections are one number
        // by construction; the forward forecast only appears as a "next turn" note when the
        // end-of-turn roster (disbands, escaped units returning, skeleton rises, heirs…) changes
        // it.
        p._lastWages={turn:G.turn,armyWages,heroWages,hostLeaderG:_hostLeaderG,heroWageDisc:_heroWageDisc,orcSpoilsG:_orcSpoilsG,discUpkeepG:_discUpkeepG};

        if(totalWages===0){log('system',`${p.name}: no wages to pay.`);return;}

        { const _notes=[_hostLeaderG>0?`−${_hostLeaderG}g the Host-Leader`:'',_orcSpoilsG>0?`−${_orcSpoilsG}g Orcish war-spoils`:'',_heroWageDisc>0?`−${_heroWageDisc}g hero wage discounts`:'',_discUpkeepG>0?`−${_discUpkeepG}g army upkeep discoveries`:''].filter(Boolean);
          log('system',`${p.name} owes ${totalWages}g wages (armies: ${armyWages}g, heroes: ${heroWages}g)${_notes.length?` — after ${_notes.join(', ')}`:''}.`,{actor:p.id,targets:[p.id]}); }

        if((p.gold||0)>=totalWages){
          p.gold-=totalWages;
          log('system',`${p.name} pays ${totalWages}g in wages. Treasury: ${p.gold}g remaining.`,{actor:p.id,targets:[p.id]});
        } else {
          // Can't pay in full — armies disband first (cheapest first), then heroes desert
          log('system',`⚠ ${p.name} cannot pay ${totalWages}g wages! Only ${p.gold||0}g available. The rawest troops melt away first — the greenest companies anywhere in the realm, garrison or field alike — then better men as the shortfall bites. The skeletal dead ask for nothing and are the last to go. Heroes may desert.`,{actor:p.id,targets:[p.id]});
          let deficit=totalWages-(p.gold||0);
          p.gold=0;

          // ── WHO GOES FIRST ────
          // Was: cheapest-first, which put SKELETONS (1g) at the head of the queue — the opposite
          // of what a realm of the dead should suffer, since skeletons neither eat nor desert. Now:
          // 1. Skeletal units are ALWAYS last. Nothing else disbands while a skeleton could.
          // 2. Within each of those two groups the raw levies go first — lowest experience tier
          // before higher, so a Green garrison melts away before a Crack company.
          // 3. Within one experience tier the choice is RANDOM ACROSS THE WHOLE EMPIRE — no more
          // "garrisons always, field armies never". A random key is decorated onto each unit up
          // front so the comparator stays a valid (consistent) ordering.
          const _qRank=a=>{ const i=QUALITY_TIERS.indexOf(a&&a.quality); return i<0?1:i; }; // unknown quality ≈ Average
          const sortedArmies=[...allKingdomArmies]
            .map(a=>({a, skel:a._isSkeletal?1:0, q:_qRank(a), r:kcRng()}))
            .sort((x,y)=>(x.skel-y.skel)||(x.q-y.q)||(x.r-y.r))
            .map(x=>x.a);
          const _sparedHulls=[]; // 2026-09-23c: ships carrying troops at sea are never disbanded from under them
          // A hull spared earlier in this pass is looked at again every time a unit disbands: once the
          // troops it carried are gone it is no longer needed and takes its place in the queue again
          // (Toby, 2026-09-23c) — it was reached before the unit that just went, so it goes next.
          const _revisitSpared=()=>{
            for(let _i=0;_i<_sparedHulls.length&&deficit>0;_i++){
              const _h=_sparedHulls[_i], _oc=playerChars.find(ch=>(ch.armies||[]).includes(_h));
              if(!_oc){ _sparedHulls.splice(_i--,1); continue; }
              if(isOpenSea(G.world.provinces[_oc.location])&&seaLiftShortfall((_oc.armies||[]).filter(a=>a!==_h),_oc)>0) continue; // still carrying
              _oc.armies.splice(_oc.armies.indexOf(_h),1); _sparedHulls.splice(_i--,1);
              deficit-=(_h._isSkeletal?1:(ARMY_COST[_h.type]||2));
              log('hire',`${_h.unitName?_h.unitName+' ('+_h.type+')':'A '+_h.quality+' '+_h.type} disbands — ${p.name} could not pay their wages, and with the troops aboard gone the ship is no longer needed to carry them.`,{actor:p.id,targets:[p.id]});
            }
          };
          sortedArmies.forEach(army=>{
            if(deficit<=0)return;
            // elementals and other temporary summons are never disbanded for non-payment — they
            // dissolve on their own at turn's end (and no longer draw a wage above).
            if(army._temporary)return;
            if(army._wildHuntUntilTurn!=null)return; // Wild Hunt beasts draw no wage, so they cannot be disbanded for one
            if(army._isSkeletal&&gdActive(turnContext,p.id,'Undead'))return; // GRAND DESIGN — Undead (Deathless Legion): skeletal units never disband for unpaid wages
            // _isSkeletal armies cost 1g upkeep (all types); base cost-0 armies (other summons)
            // still free
            const cost=army._isSkeletal?1:(ARMY_COST[army.type]||2);
            if(cost===0)return; // other free armies never disband for non-payment
            // 2026-09-23c (Toby): a hull that is carrying land troops at sea is protected — disbanding it
            // would strand the men aboard. Judged live, so a hull made spare by a unit already gone
            // this pass can still go.
            if(CARRIER_TYPES.has(army.type)){
              const _oc=playerChars.find(ch=>(ch.armies||[]).includes(army));
              if(_oc&&isOpenSea(G.world.provinces[_oc.location])&&seaLiftShortfall((_oc.armies||[]).filter(a=>a!==army),_oc)>0){ _sparedHulls.push(army); return; }
            }
            // Find and remove this army from its owner character or garrison match the EXACT army
            // object (identity), never a same-type stand-in — the old `a.type===army.type`
            // fallback, with characters searched first, could disband a hero's unit in place of the
            // garrison unit that was actually selected. The search order below (garrisons, then
            // characters) is now only a lookup path — the sort above already chose WHICH unit goes,
            // and identity matching means the lookup cannot pick a different one.
            let removed=false;
            (G.world.provinces||[]).filter(pv=>pv.owner===p.id).forEach(pv=>{
              if(removed)return;
              const idx=(pv.garrisonArmies||[]).findIndex(a=>a===army);
              if(idx>=0){pv.garrisonArmies.splice(idx,1);removed=true;}
            });
            if(!removed) playerChars.forEach(c=>{
              if(removed)return;
              const idx=(c.armies||[]).findIndex(a=>a===army);
              if(idx>=0){c.armies.splice(idx,1);removed=true;}
            });
            if(removed){
              deficit-=cost;
              log('hire',`${army.unitName?army.unitName+' ('+army.type+')':'A '+army.quality+' '+army.type} disbands — ${p.name} could not pay their wages.`,{actor:p.id,targets:[p.id]});
              if(_sparedHulls.length) _revisitSpared(); // a ship kept for these troops may now be free to go
            }
          });

          if(_sparedHulls.length) log('system',`⚓ ${_sparedHulls.length} ship${_sparedHulls.length!==1?'s':''} carrying troops at sea ${_sparedHulls.length!==1?'are':'is'} kept at the oars unpaid — disbanding ${_sparedHulls.length!==1?'them':'it'} would leave the men aboard stranded.`,{actor:p.id,targets:[p.id]});
          // If still in deficit, heroes desert
          if(deficit>0){
            heroes.sort((a,b)=>(b.pay||0)-(a.pay||0)).forEach(h=>{
              if(deficit<=0)return;
              if(kcRng()>0.4){
                noteServedRealm(h,h.player); h.player=null;h.name=h.name.replace(' (wandering)','')+' (wandering)';
                deficit-=(h.pay||0);
                p.heroes=(p.heroes||[]).filter(id=>id!==h.id);
                log('hire',`${h.name} abandons ${p.name}'s service, unpaid and disillusioned.`,{actor:p.id,targets:[p.id]});
              }
            });
          }
        }
      });
      // ── RAIDERS' MUSTER (2026-10-11, Toby, the unit abilities) ── An orcish province that saw an orc
      // victory this turn adds one Goblin Horde to its garrison for nothing: plunder feeds the horde. It
      // is owed wages from next turn like any garrison unit. The battle set the flag; the province must
      // still be an orc realm's at turn's end.
      (G.world.provinces||[]).forEach(pv=>{
        if(!pv||pv._raidersMuster!==G.turn){ if(pv&&pv._raidersMuster!=null&&pv._raidersMuster!==G.turn) delete pv._raidersMuster; return; }
        delete pv._raidersMuster;
        if(pv.race!=='Orcish'||pv.owner==null||!G.players[pv.owner]||G.players[pv.owner].race!=='Orcish') return;
        pv.garrisonArmies=pv.garrisonArmies||[];
        const _gob={type:'Goblin Horde',quality:'Average',race:'Orcish',unitName:armyUnitName('Goblin Horde')};
        pv.garrisonArmies.push(_gob);
        log('hire',`🥁 Raiders' Muster — word of the victory at ${pv.name} draws ${_gob.unitName} (Goblin Horde, Average) to its garrison for nothing.`,{actor:pv.owner,targets:[pv.owner],provinceId:pv.id});
      });
      // ── GARRISON DRILL (2026-09-23c, Toby) ── Every unled unit garrisoned in a province its realm
      // owns may rise one experience level at turn's end, at exactly the chance a commander gives by
      // practising: land and air units as if by Tactical 1, fleets and sea-beasts as if by Naval 1
      // (UNIT_DRILL_BASE × GARRISON_DRILL_LEVEL), doubled for Human drillmasters. After wages, so a
      // unit disbanded for want of pay never trains. Skeletal, summoned and Wild Hunt units never do.
      (G.world.provinces||[]).forEach(pv=>{
        if(!pv||pv.owner==null||!G.players[pv.owner]) return;
        const _up=[]; // one line per province, however many rise
        (pv.garrisonArmies||[]).forEach(a=>{
          if(!a||a._isSkeletal||a._temporary||a._phantom||a._wildHuntUntilTurn!=null) return;
          const _qi=QUALITY_TIERS.indexOf(a.quality); if(_qi<0||_qi>=QUALITY_TIERS.length-1) return;
          const _ch=(UNIT_DRILL_BASE[a.quality]||0)*GARRISON_DRILL_LEVEL*humanXPMult(a,pv.owner,G);
          if(kcRng()<_ch){
            const _q0=a.quality; a.quality=QUALITY_TIERS[_qi+1];
            _up.push(`${a.unitName?`${a.unitName} (${a.type})`:`a ${a.type}`} ${_q0} → **${a.quality}**`);
          }
        });
        if(_up.length) log('hire',`🎖 Garrison drills in ${pv.name}: ${_up.join('; ')}.`,{actor:pv.owner,targets:[pv.owner],provinceId:pv.id});
      });
      settleStrandedAtSea(turnContext, 4, 'too few hulls left to carry the whole column'); // safety net after wages
    }
    syncAllMaxHp(turnContext); // a max-HP rise earned this phase heals into its headroom now
  }

  turnContext._currentPhase=null; // the phase loop is over — any later gain belongs to END OF TURN
  turnContext._afterPhases=true;  // …and so does every later LOG LINE (see log() above)


  // A stand-off struck in the final phase is still a stand-off: flag it now so the state that is
  // SAVED (and every player's map) shows the province as contested, and the fight is joined at the
  // first sweep of next turn rather than being invisible for a whole season.
  flagEnemyStandoffs(turnContext);

  // ── THE DEAD NEED A MASTER ────
  // A skeletal unit is animate only while someone is animating it. It must be led by a CHARACTER
  // (hero or king) with at least Necromancy 1; left with anyone else, or set down as a province
  // garrison where nobody leads it at all, it falls apart. The owning realm is always told, by name
  // and place, so a host does not quietly shrink between turns.
  //
  // Read through `effStat`, so a character who holds the school only through an ITEM still keeps
  // the dead standing — the magic is what matters, not where it came from.
  //
  // TIMING, deliberately: this runs ONCE at END OF TURN rather than after every phase. The rule is
  // absolute (you cannot hold skeletons without a necromancer) but a realm is still free to move a
  // skeletal host between two necromancers within a turn — dropping it to a garrison in phase 2 and
  // picking it up in phase 3 is a legitimate manoeuvre, and an end-of-phase sweep would destroy the
  // host mid-handover.
  {
    const _crumbled={}; // playerIndex -> [ "N unit(s) under X in Y" ]
    const _note=(pi,txt)=>{ if(pi==null) return; (_crumbled[pi]=_crumbled[pi]||[]).push(txt); };
    // (a) led by a character with no Necromancy
    (G.characters||[]).forEach(c=>{
      if(!c||c.player==null||!Array.isArray(c.armies)||!c.armies.length) return;
      if(effStat(turnContext,c,'necromancy')>=1) return;
      const dead=c.armies.filter(a=>a&&a._isSkeletal);
      if(!dead.length) return;
      c.armies=c.armies.filter(a=>!(a&&a._isSkeletal));
      const pv=G.world.provinces[c.location];
      _note(c.player,`${dead.length} skeletal unit${dead.length!==1?'s':''} under ${c.name}${pv?` in ${pv.name}`:''} — ${c.name} has no Necromancy to hold them together`);
    });
    // (b) set down as a garrison, where no character leads them at all
    (G.world.provinces||[]).forEach(pv=>{
      if(!pv||!Array.isArray(pv.garrisonArmies)||!pv.garrisonArmies.length) return;
      const dead=pv.garrisonArmies.filter(a=>a&&a._isSkeletal);
      if(!dead.length) return;
      pv.garrisonArmies=pv.garrisonArmies.filter(a=>!(a&&a._isSkeletal));
      _note(pv.owner,`${dead.length} skeletal unit${dead.length!==1?'s':''} left to garrison ${pv.name} — no one was left to command them`);
    });
    Object.keys(_crumbled).forEach(k=>{
      const pi=+k, lines=_crumbled[k];
      const total=lines.length;
      log('hire',`\u{1F480} The dead will not stand alone. ${lines.join('; ')}. ${total===1?'It crumbles':'They crumble'} to dust — a skeletal host holds together only while a character of at least Necromancy 1 leads it.`,{actor:pi,targets:[pi],system:true});
    });
  }

  // ── GRAVES UNDERFOOT ────
  // Every character with at least one level of Necromancy senses the battlefield dead of the ground
  // they stand on. They learn only THAT graves are there, never what lies in them — Control
  // Undead's province scan is what buys the roll of the dead, and it records its own richer entry
  // when it is cast (see necromancy_control __scan__). Item 7: the reading now happens at EVERY
  // march-in during the phase loop as well
  // (see senseGravesUnderfoot at the move choke-point), so a necromancer marching three provinces
  // reads all three, not only the one they stop in. This end-of-turn sweep therefore only catches
  // whoever never moved — senseGravesUnderfoot's own per-turn guard skips anyone already read here.
  (G.characters||[]).forEach(c=>{
    if(!c||!c.alive||c.player==null) return;
    const pv=G.world.provinces[c.location]; if(!pv) return;
    senseGravesUnderfoot(G, c, pv, (p2)=>log('explore',`💀 ${c.name} feels the dead of ${p2.name} stirring underfoot — battlefield graves lie in this province, though nothing tells how many or what they hold.`,{actor:c.player,targets:[c.player],provinceId:p2.id}));
  });

  // ── NEUTRAL HERO PROGRESSION (2026-09-17 (late), Toby item 1) ────
  // Wandering heroes and local chieftains do not stand still while nobody commands them. From the
  // END of turn NEUTRAL_PROG_FROM_TURN onward, every living neutral hero (player===null — wanderers
  // and neutral-guard chieftains alike) rolls NEUTRAL_PROG_PCT once a turn. On a success, exactly
  // ONE skill point is gained:
  // • sharing a province with another neutral hero → they learn from them: the skill raised is the
  // OTHER hero's highest skill (a random one of them if several tie);
  // • alone → one of their own EXISTING skills (level ≥1), chosen at random.
  // Never more than one point per hero per turn, never past SKILL_MAX. A learner already at the cap
  // in the peer's best skill falls back to the alone rule rather than wasting the roll. Implemented
  // in progressNeutralHeroes (module scope) so the harness can drive it directly.
  // 2026-09-23 (Toby): 25% a turn (was 50%), and never past level 5 by this route (NEUTRAL_PROG_CAP).
  progressNeutralHeroes(G, (txt,pv)=>log('system',txt,{targets:[],provinceId:pv?pv.id:null,system:true}));

  // ── DE-CONSECRATION ── A consecrated province that has passed out of the Divine king's hands
  // this turn (captured by an enemy, or otherwise no longer owned) loses its blessing — which also
  // frees a slot so the king may hallow new ground next turn (up to his White skill level).
  (G.players||[]).forEach((pl,pi)=>{
    if(!pl) return;
    const list=consecratedIds(pl);
    if(!list.length) return;
    const kept=list.filter(pid=>{ const pv=G.world.provinces[pid]; return pv && pv.owner===pi; });
    if(kept.length!==list.length){
      list.filter(pid=>!kept.includes(pid)).forEach(pid=>{
        const pv=G.world.provinces[pid];
        if(pv) log('system',`✨ The consecration of ${pv.name} is broken — it has passed from ${pl.name}'s hands, and the hallowed light departs. The crown may sanctify new ground in its place.`,{actor:pi,targets:[pi],provinceId:pid,public:true,env:true});
      });
      pl.consecratedProvIds=kept;
    }
  });

  // ── COURIER DELIVERIES ── Cross-province Send Item arrivals reach their recipient now, as the
  // season closes, so the items are in hand from the START of next turn (not usable this turn). If
  // the recipient fell this turn the parcel routes to their king (if one lives), else it is lost.
  if(Array.isArray(G._itemDeliveries) && G._itemDeliveries.length){
    G._itemDeliveries.forEach(d=>{
      // A parcel whose contents were cut out by a Grand Heist is no parcel at all — skip it rather
      // than announce an empty courier arriving.
      if(!d||!Array.isArray(d.items)||d.items.length===0) return;
      let dest=(G.characters||[]).find(ch=>ch&&ch.id===d.toId&&ch.alive);
      if(!dest){
        const _orig=(G.characters||[]).find(ch=>ch&&ch.id===d.toId);
        const pi=_orig?_orig.player:null;
        dest=(pi!=null)?(G.characters||[]).find(ch=>ch&&ch.alive&&ch.player===pi&&ch.isKing):null;
      }
      const nm=(d.items||[]).map(it=>it.name).join(', ');
      if(!dest){
        if(nm) log('hire',`📦 A courier bearing ${nm}${d.fromName?` from ${d.fromName}`:''} finds no one left to receive it — the parcel is lost.`,{actor:null,targets:[],phase:99});
        return;
      }
      dest.items=dest.items||[];
      (d.items||[]).forEach(item=>{ dest.items.push(item); applyItemMaxHp(dest,item); /* item 6 */ });
      log('hire',`📦 A courier reaches ${dest.name} with ${nm}${d.fromName?` from ${d.fromName}`:''} — delivered as the season closes, ready to use next turn.`,{actor:dest.player,targets:[dest.player],charId:dest.id,phase:99});
      { const _gn=gainedItemNote(dest,d.items); if(_gn) log('hire',_gn,{actor:dest.player,targets:[dest.player],charId:dest.id,phase:99}); } // item 10
    });
    G._itemDeliveries=[];
  }

  // ── ELVEN ESCAPE delivery ── Units that slipped a lost battle make for home NOW, when the turn's
  // fighting is done and ownership is final. Each is placed in the king's home province (or the
  // realm's wealthiest remaining province if the home has fallen); a dynasty that holds no land at
  // all has nowhere to run to, and those survivors are lost. They arrive as garrison of the
  // province.
  if(Array.isArray(_elvenEscapeQueue) && _elvenEscapeQueue.length){
    const _byPlayer={};
    _elvenEscapeQueue.forEach(e=>{ (_byPlayer[e.player]=_byPlayer[e.player]||[]).push(e.unit); });
    Object.keys(_byPlayer).forEach(pk=>{
      const pi=+pk; const units=_byPlayer[pk];
      const destId=monarchRestProvId(G, pi);
      const dest=(destId!=null)?G.world.provinces[destId]:null;
      if(!dest){
        log('combat',`🍃 ${units.length} Elven unit${units.length!==1?'s':''} broke free of battle and made for home — but ${G.players[pi]?.name||'the realm'} holds no land left to return to, and they scatter into the wild, lost.`,{actor:null,targets:[pi],phase:99});
        return;
      }
      dest.garrisonArmies=dest.garrisonArmies||[];
      units.forEach(u=>dest.garrisonArmies.push(u));
      log('combat',`🍃 ${units.map(u=>u.unitName||u.type).join(', ')} (${units.length} unit${units.length!==1?'s':''}) slipped away from battle and have found their way home to ${dest.name}, rejoining the garrison there.`,{actor:pi,targets:[pi],provinceId:dest.id,phase:99,public:false});
    });
    _elvenEscapeQueue.length=0;
  }

  // Item 12 safety net: flush any incidental skill-rises that were earned after the last in-phase
  // flush (none expected today, but this guarantees no such line is ever silently dropped).
  resolveAllPendingSkillGains(turnContext);
  if(turnContext._deferredSkillLogs.length){ writeDeferredSkillLines(turnContext,turnContext._deferredSkillLogs); turnContext._deferredSkillLogs=[]; }

  // ── Fallen-commander backstop ── The per-phase sweep deliberately leaves a leaderless host in
  // place while its province is still contested. The turn is over now, so nothing is left to fight:
  // whatever survived garrisons, retreats or scatters. This also bounds the state — no army can
  // stay attached to a corpse across a turn boundary, whatever happened during the turn.
  (G.characters||[]).forEach(dc=>{
    if(dc.alive) { delete dc._leaderlessHost; return; }
    delete dc._leaderlessHost;
    if((dc.armies||[]).length>0) disperseDeadCharArmies(turnContext,dc);
    delete dc._slainBy; // a commander who fell with no host keeps no note of the killer in the saved state
  });

  // Intel collapse: emit one consolidated intrusion line per (target, hero, province) now that all
  // phases are resolved, instead of a separate line each phase.
  flushIntrusionNotifications(turnContext);

  // Wounded feature guardians recover over the year between turns.
  healFeatureMonsters(turnContext);

  // ── WHITE L6 (Mass Healing) ── A master of the White arts standing among friendly characters at
  // year's end mends their wounds: each own/allied living character sharing their province (the
  // healer included) heals HALF their max HP. Runs after all combat.
  {
    const _mhDone=new Set();
    (G.characters||[]).forEach(healer=>{
      if(!healer||!healer.alive||healer.player==null||healer.location==null) return;
      if(perkTier(healer,'white')<1) return; // WHITE L6+
      (G.characters||[]).forEach(t=>{
        if(!t||!t.alive||t.location!==healer.location||_mhDone.has(t.id)) return;
        const friendly=(t.player===healer.player)||(t.player!=null&&relOfReport(G,healer.player,t.player)==='allied');
        if(!friendly) return;
        const max=t.maxHp||20;
        if((t.hp==null?max:t.hp)<max){
          const _before=(t.hp==null?max:t.hp);
          t.hp=Math.min(max,_before+Math.max(1,Math.ceil(max*MASS_HEALING_PCT))); _mhDone.add(t.id);
          log('system',`✨ ${healer.name}'s Mass Healing washes over ${t.id===healer.id?'them':t.name} — ${t.id===healer.id?'their':t.name+"'s"} wounds close (+${t.hp-_before} HP → ${t.hp}/${max}${t.hp>=max?', fully restored':''}).`,{actor:t.player,targets:[t.player],charId:t.id,provinceId:t.location});
        } else { _mhDone.add(t.id); }
      });
    });
  }

  // ── MAX-HP SYNC ── every living character's maximum HP is resynced (earned pool + kit + realm
  // discoveries) at the close of the turn and any change is announced in their Chronicle. Combat
  // wins announce their own gain at the moment of victory (rollHpGain); this catches item/discovery
  // moves.
  _MAXHP_PLAYERS=G.players;
  (G._maxHpMigration||[]).forEach(r=>{ // one-time note for saves migrated to the earned-HP pool
    const ch=(G.characters||[]).find(c=>c&&c.id===r.charId); if(!ch) return;
    log('system',`📜 A new reckoning of vigour: ${ch.name}'s maximum HP is now earned in battle rather than set by skill — ${r.old} becomes ${r.nu}. Victories over lair guardians and enemy commanders will raise it from here.`,{actor:r.player,targets:[r.player],charId:ch.id,public:true});
  });
  delete G._maxHpMigration;
  syncAllMaxHp(turnContext); // end-of-turn pass (also run after every phase — see the phase loop)

  // ── Spared cowards slink home ── A Cowardly commander who begged for mercy this turn abandons
  // the field; by next turn they have made their way back to their king's seat (home province, or
  // the wealthiest province still held if home has fallen). Done after all phases so it reads the
  // final ownership map. Characters with no land left (dynasty landless) simply stay where they
  // fled.
  // 2026-09-26 (Toby item 7) — HE RUNS; THE HOST DOES NOT. A man who throws down his sword and begs
  // for his life does not then lead his army home in good order. Whatever he was leading STAYS on
  // the ground he fled from: it falls in behind another commander of his realm still standing
  // there, or takes its place in the province garrison if the realm holds the ground, or — on
  // foreign soil with nobody left to lead it — meets exactly the fate a fallen commander's
  // leaderless host meets (falls back to adjacent friendly land, else scatters as mercenaries).
  (G.characters||[]).forEach(c=>{
    if(c._mercyFledTurn!==G.turn || !c.alive) return;
    const dest=monarchRestProvId(G, c.player);
    if(dest!=null && dest!==c.location){
      abandonHostOnFlight(turnContext,c); // the host stays on the field he ran from — see the note above
      c.location=dest;
      log('system',`🏳 ${c.name}, spared on the field, makes their way back to ${G.world.provinces[dest]?.name||'safety'}.`,{actor:c.player,targets:[c.player],charId:c.id,provinceId:dest});
    }
  });
  reconcileProvinceCharacters(turnContext); // rebuild province.characters after any mercy relocations

  // 6. Update location names for all characters
  (G.characters||[]).forEach(c=>{
    const p=G.world.provinces[c.location];
    if(p)c.locationName=p.name;
  });

  collectBotDiplomacy(); // bots declare BEFORE the phases now (see the pre-phase pass); a no-op here for any late-identified rival

  // 6d. DIPLOMACY RESOLUTION (KC alliance system) — the declarations players submitted with THIS
  // turn's orders take effect now, so the new relations are already in force for next turn and the
  // change is announced in this turn's Chronicle ("at the start of the next turn" from the players'
  // point of view). Rules: mutual Treat improves one step (Enemy→Neutral→Allied); ANY war
  // declaration by either side makes both Enemies, overriding a Treat. A one-sided Treat does
  // nothing.
  {
    const np=(G.players||[]).length;
    // 2026-10-08 (Toby item 3c): the overtures each realm received THIS turn, for its Diplomacy card
    // (buildTurnReport → diplomacy.known[].offeredUs). Rebuilt every turn, so it is always last turn's.
    (G.players||[]).forEach(p=>{ if(p) p._overturesIn=[]; });
    const validDecl=(from,to)=>{
      const d=diploDeclarations[from]&&diploDeclarations[from][to];
      if(d!=='treat'&&d!=='enemy') return null;
      if(!((G.players[from]&&G.players[from]._encountered)||[]).includes(to)) return null; // must have met them
      // 2026-10-08 (Toby item 3b): in a game of three realms or fewer no alliance can be forged, so
      // a Treat between two NEUTRAL realms can achieve nothing. The portal never offers it; a bot's
      // is dropped here, so nobody is asked to answer an offer that cannot be accepted.
      if(d==='treat'&&np<=3&&(G.relations[relKeyOf(from,to)]||'neutral')==='neutral') return null;
      return d;
    };
    for(let a=0;a<np;a++){
      for(let b=a+1;b<np;b++){
        const da=validDecl(a,b), db=validDecl(b,a);
        if(!da&&!db) continue;
        const key=relKeyOf(a,b);
        const cur=G.relations[key]||'neutral';
        // No ALLIANCES in small games (≤3 players): players still start Neutral and may make peace,
        // but the Neutral→Allied step cannot be taken.
        const noAlliances=G.players.length<=3;
        let next=cur, blockedAlliance=false;
        // 2026-09-24 (Toby item 6): breaking an ALLIANCE drops the pair back to Neutral, not to
        // war — unless the crown that breaks it is Evil or Undead, who go straight to war.
        let _brokenPact=false;
        if(da==='enemy'||db==='enemy'){
          if(cur==='allied'){
            const _dark=pi=>['Evil','Undead'].includes(G.players[pi]?.alignment);
            next=((da==='enemy'&&_dark(a))||(db==='enemy'&&_dark(b)))?'enemy':'neutral';
            _brokenPact=(next==='neutral');
          } else next='enemy';
        }
        else if(da==='treat'&&db==='treat'){
          const wouldBe = cur==='enemy'?'neutral' : cur==='neutral'?'allied' : 'allied';
          if(wouldBe==='allied' && noAlliances){ blockedAlliance=true; next=cur; }
          else next=wouldBe;
        }
        const na=G.players[a]?.name||('Realm '+(a+1)), nb=G.players[b]?.name||('Realm '+(b+1));
        // ── OVERTURES RECEIVED ── A realm that is offered peace or an alliance is TOLD SO, whether
        // or not it answered in kind. The word used matches what the offer would actually achieve
        // from the current relation.
        const _offerWord=(cur==='enemy'?'peace':'an alliance');
        const _mutual=(da==='treat'&&db==='treat');
        const _tellOffered=(to,from,fromName)=>{
          // 2026-10-08 (Toby item 3a/3c): being courted counts as MEETING the realm that sent it, so
          // the courted realm can answer (only met realms are on the Diplomacy card, and only met
          // realms may be treated with). The offer is also kept for the Diplomacy card.
          const _tp=G.players[to];
          if(_tp){
            if(!Array.isArray(_tp._encountered)) _tp._encountered=[];
            if(!_tp._encountered.includes(from)) _tp._encountered.push(from);
          }
          // When both sides treated and the relation actually moved, the pact announcement below
          // says it all — no need to also report the overture that produced it.
          if(_mutual&&next!==cur) return;
          if(_tp&&!_mutual) (_tp._overturesIn=_tp._overturesIn||[]).push({from, kind:(cur==='enemy'?'peace':'alliance')}); // still awaiting an answer
          log('system',`🕊 ${fromName} has sent you an overture of ${_offerWord}.${_mutual?' You answered in kind.':` Declare a Treat toward ${fromName} with next turn's orders to answer it.`}`,{actor:null,targets:[to],system:true});
        };
        if(da==='treat') _tellOffered(b,a,na);
        if(db==='treat') _tellOffered(a,b,nb);
        if(blockedAlliance){
          log('system',`${na} and ${nb} both sought an alliance, but no alliances may be forged in a realm of so few kings — the pact cannot be sealed.`,{actor:null,targets:[a],system:true});
          log('system',`${nb} and ${na} both sought an alliance, but no alliances may be forged in a realm of so few kings — the pact cannot be sealed.`,{actor:null,targets:[b],system:true});
          continue;
        }
        if(next===cur){
          // Unreciprocated overture: let the offerer(s) know nothing changed. (The party who was
          // courted has already been told of the overture itself, just above.)
          if(da==='treat') log('system',`${na}'s overture of ${cur==='enemy'?'peace':'alliance'} to ${nb} went unanswered this year — relations are unchanged.`,{actor:null,targets:[a],system:true});
          if(db==='treat') log('system',`${nb}'s overture of ${cur==='enemy'?'peace':'alliance'} to ${na} went unanswered this year — relations are unchanged.`,{actor:null,targets:[b],system:true});
          continue;
        }
        if(next==='neutral') delete G.relations[key]; else G.relations[key]=next;
        let mA,mB;
        if(next==='enemy'){ mA=mB=`⚔ War now stands between ${na} and ${nb}. Their armies may cross the frontier and give battle.`; }
        else if(next==='allied'){ mA=`🤝 ${na} and ${nb} are now ALLIED — your armies may pass freely through one another's lands and will never come to blows.`; mB=`🤝 ${nb} and ${na} are now ALLIED — your armies may pass freely through one another's lands and will never come to blows.`; }
        else if(_brokenPact){ const _breaker=(da==='enemy'&&db==='enemy')?`${na} and ${nb}`:(da==='enemy'?na:nb); mA=mB=`💔 ${_breaker} ${(da==='enemy'&&db==='enemy')?'have':'has'} broken the alliance between ${na} and ${nb} — the two realms are NEUTRAL once more. Neither may march an army across the other's border; a further declaration of war would open hostilities.`; }
        else { mA=mB=`🕊 ${na} and ${nb} have made peace and are now NEUTRAL — neither may march an army across the other's border.`; }
        log('system',mA,{actor:null,targets:[a],system:true});
        log('system',mB,{actor:null,targets:[b],system:true});
        // WAR FRONTS: hosts already standing on the new enemy's ground (or beside his host) will turn
        // on that province at the END of next Spring unless they leave — both sides are told now,
        // while they can still write orders for it (see resolveWarFronts).
        if(next==='enemy'){
          warFrontThreats(turnContext).forEach(t=>{
            const c=t.c, pv=t.prov;
            if(c.player!==a&&c.player!==b) return;
            if(pv._battleUnresolved) return; // already a contest — it resumes at the top of Spring
            const foe=c.player===a?b:a;
            const onFoeLand=pv.owner===foe;
            const besideFoe=(G.characters||[]).some(o=>o&&o.alive&&o.location===pv.id&&o.player===foe&&(o.armies||[]).length>0);
            if(!onFoeLand&&!besideFoe) return;
            const n=(c.armies||[]).length, foeNm=G.players[foe]?.name||'the enemy', ownNm=G.players[c.player]?.name||'the enemy';
            log('system',`⚠ War front: ${c.name}'s host (${n} unit${n!==1?'s':''}) stands in ${pv.name}, ${onFoeLand?`land of ${foeNm}`:`face to face with a host of ${foeNm}`}. If it is still there at the end of next Spring it will give battle for the province — march it out in Spring to avoid the fight, or reinforce it.`,{actor:null,targets:[c.player],system:true,provinceId:pv.id});
            if(c._invisTurn!==G.turn) log('system',`⚠ War front: ${c.name} (${ownNm}) holds a host of ${n} unit${n!==1?'s':''} ${onFoeLand?`inside your province of ${pv.name}`:`beside your host in ${pv.name}`}. Unless it withdraws, it will attack at the end of next Spring — reinforce ${pv.name}, or keep a general on Defend next door to ride in.`,{actor:null,targets:[foe],system:true,provinceId:pv.id});
          });
        }
      }
    }
  }

  // 6e. VICTORY — THE RECKONING (KC end-game). Process new claims, grace-period lapse, resolution.
  {
    // the earliest turn a claim may be lodged is RECKONING_MIN_TURN, not the turn titles go public.
    // A realm that lodges one earlier is told when the throne opens.
    if(!G.reckoning && reckoningCalls.size>0 && G.turn<RECKONING_MIN_TURN){
      for(const pi of reckoningCalls){
        log('system',`${G.players[pi]?.name||'A king'} calls for the Reckoning, but the throne cannot be claimed before Turn ${RECKONING_MIN_TURN} — the realms are barely settled and the world will not yet be judged. The claim may be lodged again from that turn.`,{actor:null,targets:[pi],system:true});
      }
    }
    if(!G.reckoning && reckoningCalls.size>0 && G.turn>=RECKONING_MIN_TURN){
      for(const pi of reckoningCalls){
        const kingAlive=(G.characters||[]).some(c=>c.alive&&c.isKing&&c.player===pi);
        if(!kingAlive){ log('system',`Only a king may call the Reckoning.`,{actor:null,targets:[pi],system:true}); continue; }
        const _el=reckoningCallEligibility(G, pi); // bloc bar AND the caller's own floor; item 3: bloc-sized bar
        const thr=_el.threshold;                   // THIS claimant's bar — raised by every ally in their bloc
        const share=_el.blocShare;
        if(_el.ok){
          const bloc=alliedBloc(G, pi);
          // the bar is FIXED at the moment the claim is lodged (`thrPct`), while the share is
          // recomputed live. Without this a claimant could break off a small alliance mid-claim to
          // drop their own bar by reckoningAllyStepPct and save a failing claim. The price of the
          // throne is set when you reach for it; desert an ally now and you lose their tax base
          // without getting the bar back.
          G.reckoning={by:pi, bloc, calledTurn:G.turn, resolveAtTurn:G.turn+2, thrPct:reckoningThresholdPct(G.players.length, reckoningDecayOf(G), bloc.length)};
          const nm=G.players[pi]?.name||('Realm '+(pi+1));
          const allies=bloc.filter(b=>b!==pi).map(b=>G.players[b]?.name).filter(Boolean);
          const blocNm=allies.length?` and their allies (${allies.join(', ')})`:'';
          log('system',`👑 THE RECKONING IS CALLED. ${nm}${blocNm} lay claim to the vacant Imperial throne, commanding ${dispFloor(share*100)}% of the world${allies.length?` — a bar of ${dispFloor(thr*100)}%, raised by ${allies.length} all${allies.length===1?'y':'ies'} standing with the claim`:''}. The realms have TWO turns to contest it — drive ${nm}'s bloc below ${dispFloor(thr*100)}% and the claim collapses. Otherwise the world is judged at the end of Turn ${G.reckoning.resolveAtTurn}.`,{actor:null,targets:[],system:true,public:true});
          break;
        } else if(_el.reason==='callerShort'){
          // the BLOC clears the bar, but this realm is a passenger in it — an ally who holds a
          // sliver of the world cannot be the one to claim the throne on the bloc's strength.
          log('system',`${G.players[pi]?.name||'A king'} calls for the Reckoning on the strength of their alliance, but their OWN realm commands only ${dispFloor(_el.ownShare*100)}% of the world — a claimant must personally hold at least ${dispFloor(_el.callerMin*100)}% (half the ${dispFloor(thr*100)}% bar) to press the claim. The throne is not won by riding a stronger ally's coat-tails; let the bloc's greatest realm lodge it.`,{actor:null,targets:[pi],system:true});
        } else {
          log('system',`${G.players[pi]?.name||'A king'} calls for the Reckoning, but commands only ${dispFloor(share*100)}% of the world — short of the ${dispFloor(thr*100)}% needed to press the claim.`,{actor:null,targets:[pi],system:true});
        }
      }
    }
    if(G.reckoning){
      // the bar recorded when the claim was lodged. Older saves carrying a live claim with no
      // `thrPct` fall back to the claimant's bar as it stands now, so nothing breaks on load.
      const thr=(G.reckoning.thrPct!=null)
        ? G.reckoning.thrPct/100
        : reckoningThresholdFor(G, G.reckoning.by);
      const share=reckoningBlocShare(G, G.reckoning.by);
      const claimantAlive=((G.players[G.reckoning.by]?.provinces)||[]).length>0 || (G.characters||[]).some(c=>c.alive&&c.player===G.reckoning.by);
      // the claimant's PERSONAL floor is held for the life of the claim too, so rivals can break a
      // bloc's claim by striking the claimant himself, not only by shrinking the whole bloc.
      const _ownNow=reckoningOwnShare(G, G.reckoning.by), _minNow=thr*RECKONING_CALLER_MIN_FRAC;
      if(!claimantAlive || share<thr){
        log('system',`The claim to the throne collapses — ${G.players[G.reckoning.by]?.name||'the claimant'}'s bloc no longer commands the world (${dispFloor(share*100)}% < ${dispFloor(thr*100)}%). The Reckoning is called off; the war goes on.`,{actor:null,targets:[],system:true,public:true});
        delete G.reckoning;
      } else if(_ownNow<_minNow){
        log('system',`The claim to the throne collapses — ${G.players[G.reckoning.by]?.name||'the claimant'} has been cut down to ${dispFloor(_ownNow*100)}% of the world in their own right, beneath the ${dispFloor(_minNow*100)}% a claimant must personally hold. Their allies still stand, but the claim was theirs to carry and they can no longer carry it. The Reckoning is called off; the war goes on.`,{actor:null,targets:[],system:true,public:true});
        delete G.reckoning;
      } else if(G.turn>=G.reckoning.resolveAtTurn){
        const rw=reckoningWinner(G);
        G.gameOver={winner:rw.winner?rw.winner.index:null, byReckoning:true, turn:G.turn, standings:rw.standings.standings};
        delete G.reckoning;
      }
    }
    // THE BAR ERODES. Run LAST in this block, so a claim called this very turn is judged against
    // the threshold as it stood when the orders were written, and so a claim that resolved or
    // collapsed above has already cleared `G.reckoning`. While a claim stands the clock is frozen:
    // no step is taken, and the bar the contesting realms must drive the claimant below stays
    // exactly where it was when the throne was claimed.
    if(!G.gameOver && !G.reckoning && G.turn>=RECKONING_DECAY_FROM_TURN){
      const nP=(G.players||[]).length;
      const before=reckoningThresholdPct(nP, reckoningDecayOf(G));
      if(before>RECKONING_FLOOR_PCT){
        G.reckoningDecaySteps=reckoningDecayOf(G)+1;
        const after=reckoningThresholdPct(nP, reckoningDecayOf(G));
        log('system',`⏳ The world grows weary of the long war. No throne has been claimed, and the crown's price falls: a realm standing alone now needs only ${after}% of the world's tax base to Call the Reckoning — down from ${before}%. (A claim carried by allies still costs ${reckoningAllyStepPct(nP)} points more for every ally standing with it.)${after<=RECKONING_FLOOR_PCT?' It will fall no further.':` It will fall another ${RECKONING_DECAY_STEP_PCT}% at the end of next turn.`}`,{actor:null,targets:[],system:true,public:true});
      }
    }
  }

  // 6f. VICTORY — elimination. If only one realm still holds land or a living character, they win.
  if(!G.gameOver && G.players.length>1){
    const live=G.players.map((p,pi)=>({pi, alive:((p.provinces)||[]).length>0||(G.characters||[]).some(c=>c.alive&&c.player===pi)})).filter(x=>x.alive);
    if(live.length===1){
      const rw=reckoningWinner(G);
      G.gameOver={winner:live[0].pi, byElimination:true, turn:G.turn, standings:rw.standings.standings};
    }
  }

  // 6f-ii. VICTORY — concession. Realms that conceded no longer count. If only one un-conceded,
  // still-living realm remains — or every such realm is in ONE mutual alliance — the game ends at
  // once: the sole survivor wins, or, for an allied bloc, the bloc member with the highest Legacy
  // score takes the crown and the standings are shown.
  if(!G.gameOver && G.players.length>1 && (G.players||[]).some(p=>p&&p.conceded)){
    const live=G.players.map((p,pi)=>({pi, alive:!p.conceded&&(((p.provinces)||[]).length>0||(G.characters||[]).some(c=>c.alive&&c.player===pi))})).filter(x=>x.alive).map(x=>x.pi);
    // BUG (found 2026-09-27): this tested relationBetween(a,b)==='ally'. The engine's relation
    // value is 'allied' — areAllied is the one reader — so the allied-bloc ending could never fire.
    const allAllied=live.length>=2 && live.every(a=>live.every(b=>a===b||areAllied(turnContext,a,b)));
    if(live.length<=1 || allAllied){
      // 2026-09-27 (Toby item 8): when everyone but one realm has conceded, the RECKONING IS CALLED
      // AT ONCE — no grace period, no waiting for a claim. The survivor takes the crown, but the
      // Legacy standings (titles and relics included) are still counted up and published exactly as
      // they would be at a contested Reckoning, so the game ends with a proper final table.
      delete G.reckoning;                       // any claim in its grace period is overtaken by this
      const rw=reckoningWinner(G);
      const stand=(rw.standings&&rw.standings.standings)||[];
      let winner=live.length===1?live[0]:null;
      if(winner==null && live.length>1){ const best=stand.filter(s=>live.includes(s.index??s.pi??-1)).sort((a,b)=>b.score-a.score)[0]; winner=best?(best.index??best.pi):live[0]; }
      const _nOut=(G.players||[]).filter(p=>p&&p.conceded).length;
      log('system',`👑 THE RECKONING IS CALLED — ${_nOut} realm${_nOut!==1?'s have':' has'} conceded and ${live.length<=1?'only one crown still contests the world':'the last crowns standing are sworn to one another'}. The throne is settled here and now; the Legacy of every realm, titles and relics counted, is set down below.`,{actor:null,targets:[],system:true,public:true,gameEnd:true});
      G.gameOver={winner, byConcession:true, byReckoning:true, turn:G.turn, standings:stand};
    }
  }

  // 6g. VICTORY — announce the result once.
  if(G.gameOver && !G.gameOver._announced){
    G.gameOver._announced=true;
    const wi=G.gameOver.winner;
    const wn=wi!=null?(G.players[wi]?.name||('Realm '+(wi+1))):'No-one';
    const how=G.gameOver.byElimination?'the last realm standing in a world of ruins':G.gameOver.byConcession?'the last crown still contesting the world — every rival has conceded':'judged supreme at the Reckoning';
    log('system',`🏆 THE GAME IS DECIDED — ${wn} is ${how}!`,{actor:null,targets:[],system:true,public:true,gameEnd:true});
    (G.gameOver.standings||[]).slice().sort((a,b)=>b.score-a.score).forEach((st,i)=>{
      const tHeld=(st.titles||[]).map(k=>_TITLE_LABEL[k]||k).join(', ');
      const relicTxt=st.relics?`${st.titles&&st.titles.length?', ':''}${st.relics} relic${st.relics!==1?'s':''}`:'';
      log('system',`   ${i+1}. ${st.name} — ${st.score} Legacy${(tHeld||relicTxt)?` (${tHeld}${relicTxt})`:''}`,{actor:null,targets:[],system:true,public:true,gameEnd:true});
    });
  }

  // 7. Advance turn counter
  G.turn=(G.turn||1)+1;

  // 7a-bis. A Divine king awaiting return whose realm no longer holds ANY consecrated ground cannot
  // come back (only a king can consecrate, so none can be made while he lies dead): the grace is
  // lost now and 7b crowns an heir in this same pass.
  (G.players||[]).forEach((p,pi)=>{
    if(!p||p.alignment!=='Divine') return;
    G.characters.filter(c=>c.isKing&&c.player===pi&&!c.alive&&c._divineReturn).forEach(k=>{
      if(ownedConsecratedProvs(G,pi).length>0) return;
      delete k._divineReturn;
      log('system',`✨ The realm's last consecrated ground is gone, and with it the way back for ${k.name}: the divine cannot restore a monarch where no holy ground remains. An heir takes the crown.`,{actor:pi,targets:[pi]});
    });
  });

  // 7b. King succession — crown an heir for any player whose king has died.
  G.players.forEach((p,pi)=>{
    const aliveKing=G.characters.find(c=>c.isKing&&c.player===pi&&c.alive);
    if(aliveKing){ p.heirPending=false; return; } // reigning king is fine
    //a Divine king awaiting divine return is NOT replaced by an heir (while the realm holds land).
    if(p.alignment==='Divine'&&(p.provinces||[]).length>0&&G.characters.some(c=>c.isKing&&c.player===pi&&!c.alive&&c._divineReturn&&(G.heroGraveyard||[]).some(g=>g.id===c.id))){ p.heirPending=false; return; }
    // No living king. If we haven't already crowned an heir, do so now so the player has a new king
    // (with skills to allocate) ready for next turn's orders.
    const wealthiest=(p.provinces||[]).reduce((best,pid)=>{
      const pv=G.world.provinces[pid];
      return(!best||(pv&&pv.tax>best.tax))?{id:pid,tax:pv?.tax||0}:best;
    },null);
    const heirProv=wealthiest?G.world.provinces[wealthiest.id]:null;
    if(!heirProv){
      // No provinces left — the line has ended; the player is effectively eliminated.
      if(!p._eliminated){ p._eliminated=true; p._eliminatedTurn=G.turn; log('system',`⚠ ${p.name}'s king has fallen and no lands remain — their dynasty is extinguished.`,{actor:pi,targets:[pi]}); }
      return;
    }
    p.heirPending=false;
    const deadKing=G.characters.find(c=>c.isKing&&c.player===pi&&!c.alive);
    if(deadKing) deadKing.isKing=false; // demote the fallen king so the realm has exactly one monarch
    const heirSkills={melee:2,archery:1,sage:1};
    if(p.alignment==='Divine') heirSkills.white=(heirSkills.white||0)+1;
    if(p.alignment==='Druidic') heirSkills.druid=(heirSkills.druid||0)+1;
    if(p.alignment==='Evil') heirSkills.druid=(heirSkills.druid||0)+1;       // 2026-10-13: as the king
    if(p.alignment==='Pagan') heirSkills.explorer=(heirSkills.explorer||0)+1;
    if(p.alignment==='Undead') heirSkills.necromancy=(heirSkills.necromancy||0)+1;
    const heirName=(typeof nextHeroName==='function')?nextHeroName(p.alignment||'Neutral'):(deadKing?'Heir of '+deadKing.name:'The New Monarch');
    const heir={
      id:G.characters.length,name:heirName,isKing:true,player:pi,
      race:p.race||'Human',alignment:p.alignment||'Neutral',
      temper:TEMPERS_P[Math.floor(kcRng()*TEMPERS_P.length)], // provisional — the player may rename and re-temper their heir
      hp:15,maxHp:15,skills:heirSkills,aptitude:{}, // a new king rises at full royal vigour — 15 HP, same as a founding king
      armies:[],items:[],location:heirProv.id,alive:true,merits:0,taxBonus:0,
      pay:0,spellsUsedThisTurn:[],locationName:heirProv.name,
      _isHeir:true,_crownedTurn:G.turn||0,_pendingSkillAllocation:4, // player allocates 4 more skills, and may set name + temper, before ordering
    };
    const ABILITIES_P2=KC_SKILLS.slice();
    ABILITIES_P2.forEach(ab=>{heir.aptitude[ab]=Math.ceil(kcRng()*4);});
    G.characters.push(heir);
    heirProv.characters=(heirProv.characters||[]);
    if(!heirProv.characters.includes(heir.id)) heirProv.characters.push(heir.id);
    log('system',`👑 With the old king fallen, ${heir.name} is crowned in ${heirProv.name}. Name them, choose their Temper and allocate their 4 remaining skill points before submitting orders.`,{actor:pi,targets:[pi],provinceId:heirProv.id});
    // NOT public. This line is an instruction to one player — name your heir, set their temper,
    // spend their points — and it carried `public:true`, which for an entry with a provinceId means
    // "anyone who can see that province sees it". The coronation happens in the realm's wealthiest
    // province, which neighbours routinely see, so every realm was being told to go and name
    // somebody else's heir. Private to the bereaved realm; the world still learns the king fell
    // through the death announcement, which is a separate (and genuinely public) line.
  });

  // 7c. Expire temporary summons and reset hire phase flags first, a catch-all for any _temporary
  // summon that got ORPHANED off a character — e.g. a summoner who died mid-battle whose leaderless
  // host (elemental included) was later folded into a province garrison, or a temp unit that
  // somehow reached the mercenary pool. The per-character sweep below only sees living characters'
  // armies, so these would linger forever.
  (G.world.provinces||[]).forEach(p=>{
    if(p&&(p.garrisonArmies||[]).some(a=>a&&a._temporary)) p.garrisonArmies=p.garrisonArmies.filter(a=>!(a&&a._temporary));
  });
  if((G.mercenaries||[]).some(m=>m&&m._temporary)) G.mercenaries=G.mercenaries.filter(m=>!(m&&m._temporary));
  G.characters.forEach(c=>{
    // Reset hiredInPhase so they act from all phases next turn
    if(c.hiredInPhase!=null&&c.hiredInPhase>=0){
      c.hiredInPhase=-1; // -1 = hired before this turn, fully active
    }
    if((c.armies||[]).some(a=>a._temporary)){
      // Summoned elementals hold together only for the turn that called them. Previously they were
      // filtered out silently and the player simply found them missing next turn.
      const _gone=c.armies.filter(a=>a._temporary);
      c.armies=c.armies.filter(a=>!a._temporary);
      const _names=_gone.map(a=>`${a.unitName||a.type}${a.unitName?` (${a.type})`:''}`).join(', ');
      log('explore',`\u2728 As the season turns, ${_names} ${_gone.length===1?'is':'are'} released from ${_gone.length===1?'its':'their'} bonds and ${_gone.length===1?'returns':'return'} to the Elemental Realm, leaving ${c.name}'s host.`,{actor:c.player,targets:[c.player].filter(x=>x!==null),provinceId:c.location});
    }
    // PAGAN: Wild Hunt bindings outlast elementals by WILD_HUNT_TURNS full turns, then break.
    // G.turn has ALREADY been advanced (step 7 above) by the time this sweep runs, so the old `>=`
    // released the beasts at the end of the very turn they were bound. `>` = they serve through the
    // whole of turn _wildHuntUntilTurn and are released only when that turn ends.
    if((c.armies||[]).some(a=>a._wildHuntUntilTurn!=null&&G.turn>a._wildHuntUntilTurn)){
      const _wild=c.armies.filter(a=>a._wildHuntUntilTurn!=null&&G.turn>a._wildHuntUntilTurn);
      c.armies=c.armies.filter(a=>!(a._wildHuntUntilTurn!=null&&G.turn>a._wildHuntUntilTurn));
      const _wnames=_wild.map(a=>`${a.unitName||a.type} (${a.type})`).join(', ');
      log('explore',`\u{1F43E} The Wild Hunt is done — ${_wnames} slip the binding and melt back into the wilds, leaving ${c.name}'s host.`,{actor:c.player,targets:[c.player].filter(x=>x!==null),provinceId:c.location});
    }
    // Clear one-turn spell flags
    delete c._partSeaThisPhase;
    delete c._elementalSummonedThisTurn;
    delete c._curses;
    delete c._mirrorImages;
    delete c._invisible;
    // (_charmImmuneTurn is deliberately NOT cleared here — it names NEXT turn, and is dropped lazily
    // by the Charm cast itself once the season it guards has passed.)
    delete c._charmedByPlayer;
    delete c._charmedForPhase;
    delete c._charmOriginalPlayer;
    delete c._oratoryBoost;
    delete c._clairvoyantBy;
    delete c._druidNegated;
    delete c._tacticalNegated; delete c._tacticalHalved; delete c._tacticalMult;
    delete c._phantasmalBonus;
    if(c._phantoms&&c._phantoms.length) c._phantoms=[]; // phantasmal armies fade as the turn ends
    delete c._curseHalveStat;
    delete c._necroAutoUsed;
    // Units fully recover between turns — clear any lingering battle-scoped strength loss
    // (e.g. a Telekinetic Storm cast in an action phase that saw no ensuing battle).
    (c.armies||[]).forEach(a=>{ if(a._tempStrReduction) delete a._tempStrReduction; if(a._terrorMult!=null) delete a._terrorMult; if(a._turnStrReduction) delete a._turnStrReduction; if(a._archeryRed) delete a._archeryRed; if(a._tacUp) delete a._tacUp; if(a._drumUp) delete a._drumUp; if(a._laNoTerrain) delete a._laNoTerrain; if(a._flakTargeted) delete a._flakTargeted; });
  });
  G.world.provinces.forEach(p=>{
    if(p._blessBonus){delete p._blessBonus;}
    // Illusory Terrain: an enemy hero who entered this turn dispels it at TURN'S END (not the
    // instant they arrive); otherwise it persists until it fades naturally (20%/turn).
    if(p._illusoryTerrain){
      if(p._illusoryTerrain._enteredByEnemy || kcRng()<0.20){ delete p._illusoryTerrain; }
    }
    // Clear any battle-scoped strength reductions still sitting on this province's neutral
    // defenders
    // (e.g. a Telekinetic Storm cast with no ensuing battle) so units fully recover between turns.
    (p.neutralDefenders||[]).forEach(a=>{ if(a._tempStrReduction) delete a._tempStrReduction; if(a._terrorMult!=null) delete a._terrorMult; if(a._turnStrReduction) delete a._turnStrReduction; if(a._archeryRed) delete a._archeryRed; if(a._tacUp) delete a._tacUp; if(a._drumUp) delete a._drumUp; if(a._laNoTerrain) delete a._laNoTerrain; if(a._flakTargeted) delete a._flakTargeted; });
    // Hidden features persist until they fade (10%/turn).
    (p.features||[]).forEach(f=>{ if(f._hidden && kcRng()<0.20){ delete f._hidden; delete f._hiddenBy; } });
    if(p._phantomArmies) delete p._phantomArmies;
    if(p._featuresHidden) delete p._featuresHidden;
    if(p._earthquakeTax){delete p._earthquakeTax;}
    if(p._earthquakeSpeed) delete p._earthquakeSpeed;
    if(p._flooded) delete p._flooded;
    if(p._partSea){ p.terrain=p._partSea.orig; delete p._partSea; } // Part Sea: restore the sea
    if(p._flood){ p.terrain=p._flood.orig; delete p._flood; } // Flood: recedes at turn's end
    if(p._holyBonus) delete p._holyBonus;
    if(p._oratoryBonus) delete p._oratoryBonus;
    if(p._tempStrReduction) delete p._tempStrReduction;
    if(p._turnStrReduction) delete p._turnStrReduction;
    (p.garrisonArmies||[]).forEach(a=>{ if(a&&a._terrorMult!=null) delete a._terrorMult; }); // 2026-09-24: Terror is a battle-scoped modifier
  });

  // 7c2. sd35 Order of the Golden Shield: the king's earned-HP gain from a win is doubled, nothing
  // per-turn.

  // GRAND DESIGN — Evil (Iron Throne of Skulls): apply this turn's queued skeleton-rises to the
  // real winners.
  (G._pendingRises||[]).forEach(r=>{ const _ch=(G.characters||[]).find(c=>c&&c.id===r.charId); if(_ch&&_ch.alive){ _ch.armies=_ch.armies||[]; _ch.armies.push(r.unit); } });
  G._pendingRises=[];

  // GRAND DESIGN — Neutral (Grand Library): one guaranteed Sage discovery each turn, reported.
  (G.players||[]).forEach((pl,pi)=>{
    if(!gdActive(turnContext,pi,'Neutral')) return;
    pl.discoveries=pl.discoveries||[];
    const _known=new Set(pl.discoveries.map(d=>d.id));
    const _blkGL=discBlockedIds(pl);
    const _avail=SAGE_DISCOVERIES_P.filter(d=>!_known.has(d.id)&&!_blkGL.has(String(d.id))&&discEligible(d,pl)); // race/alignment eligibility; never a forgotten or awaiting-choice discovery
    if(_avail.length===0){ log('system',`\ud83d\udcda Grand Library: your scholars have already unlocked every known discovery.`,{actor:pi,targets:[pi]}); return; }
    const _d=_avail[Math.floor(kcRng()*_avail.length)];
    pl.discoveries.push({id:_d.id,name:_d.name,category:_d.category,desc:_d.desc,turnDiscovered:G.turn});
    log('explore',`\ud83d\udcda Grand Library: this turn your scholars uncover \u2014 **${_d.name}** (${_d.category}). ${_d.desc}`,{actor:pi,targets:[pi]});
  });

  // 7d. sd08 War Academy: promote one random army in each player's home province
  G.players.forEach((p,pi)=>{
    if(!hasDisc(turnContext,pi,'sd08')) return;
    const homeProv=G.world.provinces.find(pv=>pv.owner===pi&&pv.tax>=10);
    if(!homeProv) return;
    const charsAtHome=(G.characters||[]).filter(c=>c.alive&&c.player===pi&&c.location===homeProv.id);
    const allArmies=charsAtHome.flatMap(c=>c.armies||[]);
    if(allArmies.length===0) return;
    const tiers=QUALITY_TIERS.slice();
    // Skeletal armies never gain experience/quality tiers — the dead don't learn.
    const eligible=allArmies.filter(a=>!a._isSkeletal&&tiers.indexOf(a.quality)<4);
    if(eligible.length===0) return;
    // Each eligible army independently has a chance (sd08 row, pct) to train up one tier this turn.
    let _waPromoted=0; const _waPct=discParam('sd08','pct',0.5);
    eligible.forEach(army=>{ if(kcRng()<_waPct){ const idx=tiers.indexOf(army.quality); army.quality=tiers[idx+1]; _waPromoted++; log('system',`War Academy: ${army.unitName?army.unitName+' ('+army.type+')':'a '+army.type} in ${homeProv.name} trains to ${army.quality}!`,{actor:pi,targets:[pi]}); } });
    if(_waPromoted===0) log('system',`War Academy: the drills in ${homeProv.name} produced no promotions this turn.`,{actor:pi,targets:[pi]});
  });

  // 7d-bis. `regen` discoveries (sd65 Physick Gardens): every wounded living character of the realm
  // recovers a few HP at the end of the turn.
  G.players.forEach((p,pi)=>{
    if(!discEff(turnContext,pi,'regen').length) return;
    (G.characters||[]).forEach(c=>{ if(!c||!c.alive||c.player!==pi||c.hp==null) return; const mx=c.maxHp||20; if(c.hp>=mx) return;
      const _rg=discSum(turnContext,pi,'regen','hp',e=>!e.king||!!c.isKing); if(_rg<=0) return; const h=Math.min(_rg,mx-c.hp); c.hp+=h; log('system',`🌿 ${c.name}'s wounds knit in the physick gardens: +${h} HP (${c.hp}/${mx}).`,{actor:pi,targets:[pi],charId:c.id,phase:99}); });
  });

  // 7e. sd22 Informant Network: reveal one random enemy character location
  G.players.forEach((p,pi)=>{
    if(!hasDisc(turnContext,pi,'sd22')) return;
    // Provinces the player can already see this turn: those they own, or that hold one of their
    // characters.
    const _seen=new Set();
    (G.world.provinces||[]).forEach((pv,idx)=>{ if(pv.owner===pi) _seen.add(idx); });
    (G.characters||[]).forEach(c=>{ if(c.alive&&c.player===pi) _seen.add(c.location); });
    const enemyChars=(G.characters||[]).filter(c=>c.alive&&c.player!==null&&c.player!==pi&&!c.isKing&&!_seen.has(c.location));
    if(enemyChars.length===0){ log('system',`[Intelligence] Your informants surface nothing new — every enemy captain they could name is already within your sight.`,{actor:pi,targets:[pi]}); return; }
    const target=enemyChars[Math.floor(kcRng()*enemyChars.length)];
    const tProv=G.world.provinces[target.location];
    log('system',`[Intelligence] Informant Network reports: ${target.name} of ${G.players[target.player]?.name} \u2014 unseen by your own eyes \u2014 was last in ${tProv?.name||'unknown'}.`,{actor:pi,targets:[pi]});
  });
  // `return`s — so it only ever fired for a player who ALSO held sd22 and had an unseen enemy. It is
  // now its own pass. The line is filed (no charId) so it lands in the player's Realm Events.
  G.players.forEach((p,pi)=>{
    if(!hasDisc(turnContext,pi,'sd39')) return;
    const _unseen=(G.world.provinces||[]).filter(pv=>(((pv.exploredBy&&pv.exploredBy[pi])||0)<100));
    if(_unseen.length===0){ log('explore',`\ud83d\udd2d Arcane Observatory: your astronomers find no uncharted province left to study \u2014 the whole known world is already mapped in full.`,{actor:pi,targets:[pi],phase:99}); return; }
    const _pk=_unseen[Math.floor(kcRng()*_unseen.length)];
    if(!_pk.exploredBy)_pk.exploredBy={}; _pk.exploredBy[pi]=100; _pk.explored=100;
    if(!Array.isArray(_pk.visitedBy)) _pk.visitedBy=[];
    log('explore',`\ud83d\udd2d Arcane Observatory: your astronomers chart **${_pk.name}** (${_pk.terrain||'unknown terrain'}) in full from afar \u2014 the province is now 100% explored.`,{actor:pi,targets:[pi],provinceId:_pk.id,phase:99});
  });

  // 7d. Divine realm resurrection — a fallen hero spends one full turn in death, then returns. This
  // step runs AFTER the turn counter advanced (§7 above), so when a hero dies during turn N's
  // resolution their grave carries killedOnTurn=N and G.turn is now N+1. Requiring G.turn >=
  // killedOnTurn+2 means the hero is skipped on the N->N+1 pass (out of action for turn N+1) and
  // only rises on the N+1->N+2 pass — i.e. they return at the START of the second turn after death.
  if(!G.heroGraveyard) G.heroGraveyard=[];
  G.heroGraveyard.filter(g=>g.player!==null&&G.players[g.player]?.alignment==='Divine'&&(!g._monarch||G.characters.some(h=>h.id===g.id&&h._divineReturn))).forEach(grave=>{
    if(G.turn < ((grave.killedOnTurn||0)+2)) return; // still serving their turn in death
    const hero=G.characters.find(h=>h.id===grave.id);
    if(!hero) return;
    const _wasKing=!!grave._monarch; // Divine kings return the same way
    // The fallen return ONLY to consecrated ground — the nearest consecrated province the realm
    // still owns, measured from where the body lies — and the return SPENDS that consecration.
    // With no holy ground the grace is lost for good: the body stays an ordinary grave (the
    // Resurrect spell can still reach it) and is never tried again.
    const playerP=G.players[grave.player];
    if(grave._divineLost) return;
    const homeProv=nearestConsecratedProv(G, grave.player, grave.location!=null?grave.location:hero.location);
    if(!homeProv){
      grave._divineLost=true; if(_wasKing) delete hero._divineReturn;
      log('explore',`✨ ${hero.name} does not return. The divine restore the fallen only upon consecrated ground, and the realm holds none — the grace is lost. (The body remains where it lies; a Resurrect spell may yet reach it.)`,{actor:grave.player,targets:[grave.player]});
      return;
    }
    if(_wasKing){ hero.isKing=true; delete hero._divineReturn; if(playerP) delete playerP._resurrectableMonarchId; }
    { const _cl=consecratedIds(playerP); const _ci=_cl.indexOf(homeProv.id); if(_ci>=0) _cl.splice(_ci,1); }
    // Resurrect — strip armies and items (divine gift, not a free ride)
    hero.alive=true;hero.hp=Math.floor(hero.maxHp*0.5)||8;hero.killedThisTurn=false;
    hero.armies=[];hero.items=[];hero.location=homeProv.id;
    if(!homeProv.characters.includes(hero.id)) homeProv.characters.push(hero.id);
    G.heroGraveyard=G.heroGraveyard.filter(g=>g.id!==grave.id);
    // Log to turn report
    const turnLog=G.turnLog||[];
    log('explore',`✨ **Divine Resurrection**: ${hero.name}${_wasKing?', your monarch,':''} returns to life by the grace of the divine! They appear in ${homeProv.name}, the nearest consecrated ground, with ${hero.hp} HP — no armies or items, but their spirit and skills endure. The miracle spends the province's consecration: ${homeProv.name} is holy ground no longer, and the crown may sanctify new ground in its place.${_wasKing?' The crown is worn once more.':''}`,{actor:grave.player,targets:[grave.player],provinceId:homeProv.id}/* 2026-09-27 (Toby item 6): realm-private — never public */);
  });

  // 7e. Battlefield grave pool decay — ~10% of remaining graves rot each turn, halved to 5% in
  // provinces owned by an UNDEAD realm (necromantic preservation — the advertised perk, now real).
  G.world.provinces.forEach(p=>{
    if(!p.battleGraves||p.battleGraves.length===0) return;
    let decay=(p.owner!=null&&G.players[p.owner]?.alignment==='Undead')?0.05:0.10;
    if(p.owner!=null){ const _gd=discEff(turnContext,p.owner,'graveDecay'); if(_gd.length) decay=Math.min(decay,Math.min(..._gd.map(e=>e.rate!=null?e.rate:decay))); } // az08 Embalmers
    p.battleGraves=p.battleGraves.filter(()=>kcRng()>decay);
  });

  // 7f. Mercenary army movement and retirement
  if(G.mercenaries&&G.mercenaries.length>0){
    const{cols,rows,provinces}=G.world;
    const offEven=[[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];
    const offOdd= [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]];
    G.mercenaries=G.mercenaries.filter(merc=>{
      // 25% chance to retire (remove from game)
      if(kcRng()<0.25){
        log('system',`The mercenary band ${merc.unitName||merc.type} in ${G.world.provinces[merc.location]?.name||'unknown'} has retired and dispersed.`,{actor:null,targets:[]});
        return false; // remove
      }
      // 100% chance to move to a random valid neighbouring province
      const p=provinces[merc.location];
      if(!p) return true;
      const offs=p.row%2===0?offEven:offOdd;
      const neighbors=offs.map(([dr,dc])=>{
        const nr=p.row+dr;if(nr<0||nr>=rows) return null;
        const nc=((p.col+dc)%cols+cols)%cols;
        return provinces[nr*cols+nc];
      }).filter(n=>n&&(merc.isSea?n.terrain==='sea':n.terrain!=='sea'));
      if(!neighbors.length) return true; // stuck, don't move
      const dest=neighbors[Math.floor(kcRng()*neighbors.length)];
      merc.location=dest.id;
      return true; // keep
    });
  }

  // Clear _justDefeated flag now that the turn is over
  (G.characters||[]).filter(c=>c._justDefeated).forEach(c=>{delete c._justDefeated;});
  // a neutral hero who is now wandering (no longer a home-guarding _isNeutralGuard) recovers to
  // full HP. A guard driven from home limps away bloodied from the battle; by the time they take up
  // the wanderer's life again they are hale, and hire as a fresh, fully-healed commander.
  (G.characters||[]).filter(c=>c.player===null&&c.alive&&!c._isNeutralGuard).forEach(c=>{ c.hp=c.maxHp||c.hp; });
  // (Per-turn battle flags are cleared AFTER the report loop — see below — so buildTurnReport and the
  // hadBattle map-marker derivation can still read which provinces saw fighting this turn.)
  // 2026-09-12: report the turn-start ' (wandering)' name repair here, where `log` exists.
  if(G._nameRepairs>0){
    log('system',`[Integrity] ${G._nameRepairs} hero${G._nameRepairs!==1?'es':''} in a realm's service still bore the \u201c(wandering)\u201d tag \u2014 the name has been corrected.`,{actor:null,targets:[]});
  }
  G._nameRepairs=0;
  if(G._retiredDiscoveries>0){
    log('system',`[Integrity] ${G._retiredDiscoveries} retired Sage discover${G._retiredDiscoveries!==1?'ies were':'y was'} removed from realm records.`,{actor:null,targets:[]});
  }
  delete G._retiredDiscoveries;
  // graveyard sweep — a grave whose character record is ALIVE is a doppelganger (dead in the
  // graveyard, alive in the realm). Purge it and say so in the GM log.
  if(Array.isArray(G.heroGraveyard)&&G.heroGraveyard.length){
    const _ghosts=G.heroGraveyard.filter(g=>{ const ch=(G.characters||[]).find(x=>x&&x.id===g.id); return ch&&ch.alive===true; });
    if(_ghosts.length){
      G.heroGraveyard=G.heroGraveyard.filter(g=>!_ghosts.includes(g));
      _ghosts.forEach(g=>{ log('system',`[Integrity] ${g.name} was listed in the graveyard while alive — the stale grave has been removed.`,{actor:null,targets:[]}); (G.players||[]).forEach(p=>{ if(p&&p._resurrectableMonarchId===g.id) p._resurrectableMonarchId=null; }); });
    }
  }
  // eyes on the ground count as knowledge. Any grave lying in a province a realm OWNS, or holds a
  // living character in, is added to that realm's permanent knownDeadHeroIds — so a corpse you can
  // see on your map stays a legal Resurrect target after you march on. Monarch graves are excluded:
  // they are borne home and gated separately (_resurrectableMonarchId).
  (G.players||[]).forEach((p,pi)=>{
    if(!p) return;
    const seeProv=new Set(((G.world&&G.world.provinces)||[]).filter(pv=>pv&&pv.owner===pi).map(pv=>pv.id));
    (G.characters||[]).forEach(c=>{ if(c&&c.alive&&c.player===pi&&c.location!=null) seeProv.add(c.location); });
    if(!Array.isArray(p.knownDeadHeroIds)) p.knownDeadHeroIds=[];
    (G.heroGraveyard||[]).forEach(g=>{
      if(!g||g._monarch||g.location==null) return;
      if(seeProv.has(g.location)&&!p.knownDeadHeroIds.includes(g.id)) p.knownDeadHeroIds.push(g.id);
    });
  });
  // Clear per-turn seen-dead-heroes tracking (knownDeadHeroIds persists across turns)
  G.players.forEach(p=>{p.seenDeadHeroIds=[];});
  (G.characters||[]).filter(c=>c.player===null&&c.alive&&!c._isNeutralGuard).forEach(c=>{
    if(kcRng()>0.35)return;
    const p=G.world.provinces[c.location];
    if(!p)return;
    const{cols,rows,provinces}=G.world;
    const offsets=p.row%2===0?[[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]]:[[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]];
    const neighbors=offsets.map(([dr,dc])=>{
      const nr=p.row+dr;if(nr<0||nr>=rows)return null;
      const nc=((p.col+dc)%cols+cols)%cols;
      return provinces[nr*cols+nc];
    }).filter(n=>n&&n.terrain!=='sea');
    if(!neighbors.length)return;
    const dest=neighbors[Math.floor(kcRng()*neighbors.length)];
    p.characters=(p.characters||[]).filter(id=>id!==c.id);
    c.location=dest.id;c.locationName=dest.name;
    dest.characters=(dest.characters||[]);dest.characters.push(c.id);
  });

  // Clear resolved orders from the saved state so they can never be re-applied next turn. Next
  // turn's runTurn rebuilds turnOrders from fresh submissions. Per-character encounter plans are
  // intentionally KEPT so a player's chosen combat plan carries over turn to turn until they change
  // it.
  G.turnOrders={};
  delete G._resurrectedThisTurn; delete G._pendingResurrectOrders; delete G._pendingCharmOrders; delete G._pendingHireOrders; delete G._pendingSynthPlans; // per-turn scratch — never persist
  // Final reconcile before the state is persisted AND before reports are built. Steps 7-9 (Raise
  // Hero, Divine resurrection, wandering-hero drift) all relocate characters, and the turn report
  // reads province.characters for the map. Rebuilding here means what is saved, what is rendered
  // and where characters actually are can never disagree.
  reconcileProvinceCharacters(turnContext);
  normaliseStrandedGuards(G); // a guard whose last unit fell this turn, or whose land changed hands, reports as a wanderer
  // ── IMPERIAL TITLE INTEL (Items 1, 2, 4) ── Titles are AWARDED here, AFTER all turn resolution
  // (combat, conquest, tax, resurrection, wandering-drift) and the final reconcile — so this ONE
  // end-of-turn standings computation is what every title benefit reports from. The intel lines,
  // the holders board and each report's gains/losses therefore never disagree on who holds what.
  // Each rival / piece of intel is its OWN line, and any character named carries their province.
  // Gated: nothing emits before Titles go public (turn 5) or once the game is over.
  (function(){
    const _pub=((G.turn||1)>=TITLES_PUBLIC_FROM_TURN)||!!G.gameOver;
    if(!_pub) return;
    let STD; try{ STD=computeStandings(G); }catch(e){ return; }
    const TH=STD.titles||{}; const provs=G.world.provinces||[];
    const holder=key=>{ const h=TH[key]; return (h&&h.playerIndex!=null)?h.playerIndex:null; };
    const pnm=pi=>(pi==null?'no realm':(G.players[pi]?.name||('Player '+(pi+1))));
    const prn=id=>provs[id]?.name||'unknown';
    // name a character with their realm, or — for an unsworn hero — the province they guard. `lvl`
    // (optional) prints as "Level N", never the old "L2" shorthand.
    const who=(ch,lvl)=>{ const lv=(lvl!=null)?` (Level ${lvl})`:''; return ch.player!=null?`${ch.name}${lv} of ${pnm(ch.player)}`:`${ch.name}${lv}, an independent hero guarding ${prn(ch.location)}`; };
    // 2026-09-24 (Toby item 5): a title tells its holder nothing about a realm the crown has not
    // yet MET (player._encountered — the same list that gates Treat / Declare War). Unmet realms
    // are neither named nor measured; one closing line per title says how many stay in the dark.
    const met=(pi,i)=>i===pi||(((G.players[pi]||{})._encountered)||[]).includes(i);
    const unmetLine=(pi,label)=>{ const n=(G.players||[]).filter((pl,i)=>pl&&i!==pi&&!pl.conceded&&!pl.eliminated&&!met(pi,i)).length;
      if(n>0) log('system',`[${label}] ${n===1?'One realm':`${n} realms`} your crown has not yet met — nothing may be gleaned of ${n===1?'it':'them'} until you do.`,{actor:pi,targets:[pi]}); };
    const isNaval=t=>SEA_TYPES.has(t);
    const kindStr=(ch,naval)=>(ch.armies||[]).filter(a=>naval?isNaval(a.type):!isNaval(a.type)).reduce((s,a)=>s+unitBaseStrength(a),0);
    // Strongest land/sea force for a rival → the COMMANDING character, so we can name them AND give
    // their current province.
    const strongestChar=(pi,naval)=>{ let best=-1,bc=null; (G.characters||[]).filter(c=>c.alive&&c.player===pi).forEach(c=>{ const st=kindStr(c,naval); if(st>best){best=st;bc=c;} }); return best>0?bc:null; };
    // THE THRONE — each rival's share of the world tax base. Uses the SAME denominator as the
    // Reckoning (STD.worldTax = every province, land AND sea), so these %s correlate across
    // reports. 2026-09-09: every comparative title report now opens with the holder's OWN figure,
    // so the rivals' numbers can be read against something.
    { const pi=holder('throne'); if(pi!=null){ const world=STD.worldTax||1; const own=dispFloor(100*(STD.taxByPlayer[pi]||0)/world); log('system',`[The Throne] Your realm: ${own}% of the world tax base.`,{actor:pi,targets:[pi]}); G.players.forEach((pl,i)=>{ if(i===pi||!met(pi,i))return; const pct=Math.round(100*(STD.taxByPlayer[i]||0)/world); log('system',`[The Throne] ${pnm(i)}: ${pct}% of the world tax base.`,{actor:pi,targets:[pi]}); }); unmetLine(pi,'The Throne'); } }
    // THE VAULTKEEPER — each rival's treasury (own line).
    { const pi=holder('vault'); if(pi!=null){ log('system',`[The Vaultkeeper] Your realm: ${G.players[pi]?.gold||0}g in treasury.`,{actor:pi,targets:[pi]}); G.players.forEach((pl,i)=>{ if(i===pi||!met(pi,i))return; log('system',`[The Vaultkeeper] ${pnm(i)}: ${pl.gold||0}g in treasury.`,{actor:pi,targets:[pi]}); }); unmetLine(pi,'The Vaultkeeper'); } }
    // THE GRAND MARSHAL — each rival's strongest land army: commander + province (own line).
    { const pi=holder('marshal'); if(pi!=null){ let any=false; { const oc=strongestChar(pi,false); log('system',`[The Grand Marshal] Your realm: ${oc?`strongest land army led by ${oc.name} in ${prn(oc.location)} (strength ${kindStr(oc,false)})`:'no land army in the field'}.`,{actor:pi,targets:[pi]}); } G.players.forEach((pl,i)=>{ if(i===pi||!met(pi,i))return; const c=strongestChar(i,false); if(c){ any=true; log('system',`[The Grand Marshal] ${pnm(i)}: strongest land army led by ${c.name} in ${prn(c.location)} (strength ${kindStr(c,false)}).`,{actor:pi,targets:[pi]}); } }); if(!any) log('system',`[The Grand Marshal] No rival fields a land army this turn.`,{actor:pi,targets:[pi]}); unmetLine(pi,'The Grand Marshal'); } }
    // THE SEA LORD — each rival's strongest fleet: commander + province (own line).
    { const pi=holder('sea'); if(pi!=null){ let any=false; { const oc=strongestChar(pi,true); log('system',`[The Sea Lord] Your realm: ${oc?`strongest fleet led by ${oc.name} in ${prn(oc.location)} (strength ${kindStr(oc,true)})`:'no fleet at sea'}.`,{actor:pi,targets:[pi]}); } G.players.forEach((pl,i)=>{ if(i===pi||!met(pi,i))return; const c=strongestChar(i,true); if(c){ any=true; log('system',`[The Sea Lord] ${pnm(i)}: strongest fleet led by ${c.name} in ${prn(c.location)} (strength ${kindStr(c,true)}).`,{actor:pi,targets:[pi]}); } }); if(!any) log('system',`[The Sea Lord] No rival fields a fleet this turn.`,{actor:pi,targets:[pi]}); unmetLine(pi,'The Sea Lord'); } }
    // THE MONSTER-BANE — 2026-09-17: was the single runner-up for the title. Now the foremost
    // monster-slayer of EVERY rival realm, each on their own line with province and tally, so the
    // holder can see the whole field coming rather than only the nearest challenger. An unsworn
    // hero
    // (player==null) is nobody's champion and is left out.
    { const pi=holder('monster'); if(pi!=null){
        const bestOf=(i)=>{ let b=null,bm=0; (G.characters||[]).filter(c=>c.alive&&c.player===i).forEach(c=>{ const m=(c.tm&&c.tm.monster)||0; if(m>bm){bm=m;b=c;} }); return b?{c:b,m:bm}:null; };
        const own=bestOf(pi);
        log('system',`[The Monster-Bane] Your champion: ${own?`${own.c.name} in ${prn(own.c.location)} with ${own.m} monster-blood to their name`:'no hero of yours has drawn monster-blood'}.`,{actor:pi,targets:[pi]});
        let any=false;
        G.players.forEach((pl,i)=>{ if(i===pi||!met(pi,i))return; const r=bestOf(i); if(r){ any=true;
          log('system',`[The Monster-Bane] ${pnm(i)}: ${r.c.name} in ${prn(r.c.location)} — ${r.m} monster-blood.`,{actor:pi,targets:[pi]}); } });
        if(!any) log('system',`[The Monster-Bane] No rival realm has a hero who has drawn monster-blood worth noting.`,{actor:pi,targets:[pi]});
      unmetLine(pi,'The Monster-Bane'); } }
    // THE LOREMASTER — 2026-09-17: was this turn's discoveries only, which in most turns is nothing
    // at all. Now the FULL holding of every rival realm, so the holder can see the whole shape of
    // what others know. The free copy still comes from what was discovered THIS turn: the title
    // reads a rival's library, it does not empty it.
    { const pi=holder('lore'); if(pi!=null){ const tt=G.turn-1; const fresh=[]; let anyHeld=false;
        G.players.forEach((pl,i)=>{ if(i===pi||!met(pi,i))return; const ds=(pl&&pl.discoveries)||[];
          if(ds.length){ anyHeld=true;
            log('system',`[The Loremaster] ${pnm(i)} holds ${ds.length} discover${ds.length===1?'y':'ies'}: ${ds.map(d=>d.name).join(', ')}.`,{actor:pi,targets:[pi]}); }
          else log('system',`[The Loremaster] ${pnm(i)} holds no discoveries at all.`,{actor:pi,targets:[pi]});
          ds.forEach(d=>{ if(d.turnDiscovered===tt) fresh.push({d,i}); }); });
        if(!anyHeld) log('system',`[The Loremaster] No rival realm has yet learned anything worth copying.`,{actor:pi,targets:[pi]});
        const lp=G.players[pi];
        if(lp&&fresh.length){ const owned=new Set((lp.discoveries||[]).map(d=>d.id)); const learn=fresh.filter(f=>!owned.has(f.d.id));
          if(learn.length){ const pk=learn[Math.floor(kcRng()*learn.length)].d;
            (lp.discoveries=lp.discoveries||[]).push({id:pk.id,name:pk.name,category:pk.category,desc:pk.desc,turnDiscovered:G.turn});
            log('system',`[The Loremaster] Your scholars copy ${pk.name} from a rival's fresh notes — you now hold this discovery.`,{actor:pi,targets:[pi]}); } }
      unmetLine(pi,'The Loremaster'); } }
    // THE ARCHMAGE — 2026-09-17: the foremost mage of each school OUTSIDE the holder's own realm.
    // Naming the holder's own archmage back to them was the one line in the whole title system that
    // told a player something they already knew; this is a rivals' board.
    { const pi=holder('arch'); if(pi!=null){ const tot=c=>Object.values(c.skills||{}).reduce((s,v)=>s+(v||0),0);
        [['white','White'],['psychic','Psychic'],['illusory','Illusory'],['elemental','Elemental'],['necromancy','Necromancy']].forEach(([sk,lab])=>{
          let best=null,bl=-1,bt=-1;
          (G.characters||[]).filter(c=>c.alive&&c.player!==pi&&(c.player==null||met(pi,c.player))).forEach(c=>{ const l=(c.skills&&c.skills[sk])||0; if(l>bl||(l===bl&&tot(c)>bt)){ bl=l;bt=tot(c);best=c; } });
          if(best&&bl>0) log('system',`[The Archmage] ${lab}: ${who(best,bl)}${best.player!=null?` in ${prn(best.location)}`:''}.`,{actor:pi,targets:[pi]});
          else log('system',`[The Archmage] ${lab}: no mage of note outside your own realm.`,{actor:pi,targets:[pi]});
        }); unmetLine(pi,'The Archmage'); } }
    // THE HIEROPHANT — 2026-09-17: was the largest skeletal army, which is the Deathpriest's ground
    // and read as a necromancer's perk on a title of the White faith. Now the priest reads the
    // dead: every fallen hero this realm can SEE gives up the skills they carried in life.
    // Visibility mirrors buildTurnReport's `visibleDeadHeroes` — own dead, a fall witnessed this
    // turn, or a body lying in a province the realm holds or has a character standing in — so the
    // title never reveals a corpse the player could not already see on their map, only what that
    // corpse knew.
    { const pi=holder('hiero'); if(pi!=null){
        const seen=new Set((G.players[pi]&&G.players[pi].seenDeadHeroIds)||[]);
        const eyes=new Set(provs.filter(pv=>pv&&pv.owner===pi).map(pv=>pv.id));
        (G.characters||[]).filter(c=>c&&c.alive&&c.player===pi).forEach(c=>{ if(c.location!=null) eyes.add(c.location); });
        const vis=(G.heroGraveyard||[]).filter(g=>g&&(g.player===pi||seen.has(g.id)||(g.location!=null&&eyes.has(g.location))));
        if(vis.length){ vis.forEach(g=>{
            const sk=Object.entries(g.skills||{}).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${SKILL_LABELS[k]||k} ${v}`).join(', ')||'no skills the grave remembers';
            log('system',`[The Hierophant] The dead speak: ${g.name}${g.player!=null?` of ${pnm(g.player)}`:''}${g.isKing?', a king,':''} lying in ${prn(g.location)} — ${sk}.`,{actor:pi,targets:[pi]}); }); }
        else log('system',`[The Hierophant] No fallen hero lies where your priests can read them this turn.`,{actor:pi,targets:[pi]});
      } }
    // THE DEATHPRIEST — Grave-sight: each province with Crack/Elite dead (own line). Item 8: every
    // Grave-sight find is also written into the realm's graveyard lore, so the Deathpriest's
    // provinces appear in the report's Graveyards Known alongside what their own necromancers have
    // walked over. The reading is PARTIAL — the title picks out crack and elite dead only and is
    // blind to whatever lesser ranks lie beside them — so it is flagged as such and the report says
    // "at least". A province with no crack/elite dead is left alone, never marked bare: Grave-sight
    // seeing nothing worth naming there is not the same as seeing empty ground.
    { const pi=holder('necro'); if(pi!=null){ let any=false; const _dpl=G.players[pi]; (G.world.provinces||[]).forEach(pv=>{ if(!pv)return; const _fine=(pv.battleGraves||[]).filter(g=>g&&(g.quality==='Crack'||g.quality==='Elite')); const n=_fine.length; if(n>0){ any=true; if(_dpl) noteGraveIntel(_dpl, pv.id, G.turn, _fine, {partial:true}); log('system',`[The Deathpriest] Grave-sight: ${prn(pv.id)} holds ${n} crack/elite dead. (Filed under Graveyards Known.)`,{actor:pi,targets:[pi]}); } }); if(!any) log('system',`[The Deathpriest] Grave-sight finds no crack or elite dead lying unclaimed this turn.`,{actor:pi,targets:[pi]}); } }
    // ── THE FOUR NEW TITLES ────
    // THE SPYMASTER — the counter-intelligence ledger. Every successful act of espionage worked
    // against THIS realm's provinces this turn, named with the realm that worked it and where. This
    // is the RAW ledger: a disguised agent who beat the province watch is still listed here, which
    // is the whole point of the title. Only espionage against ground this realm actually owns is
    // reported.
    { const pi=holder('spy'); if(pi!=null){
        const led=(G._espionageLedger||[]).filter(e=>e&&provs[e.provId]&&provs[e.provId].owner===pi&&e.byPi!==pi);
        if(led.length){
          // NAME THE AGENT, not the crown. Knowing "Arden pried into your lands" is barely
          // actionable; knowing WHICH hero did it, and where they were standing when they did,
          // tells you who to hunt and where they are. The realm is still given, after the name.
          led.forEach(e=>{
            const agent=`${e.isKing?'\u265B ':''}${e.charName||'an unknown agent'}${e.byPi!=null?` of ${pnm(e.byPi)}`:', unsworn to any crown'}`;
            log('system',`[The Spymaster] ${agent} ${e.kind} in ${prn(e.provId)}.`,{actor:pi,targets:[pi]});
          });
          // A hero who worked twice in one turn is ONE name on the roll, with a count — the per-act
          // lines above already carry the detail, and the roll is meant to be read at a glance.
          const byChar=new Map();
          led.forEach(e=>{ const k=e.charId; const r=byChar.get(k)||{name:e.charName,pi:e.byPi,n:0}; r.n++; byChar.set(k,r); });
          const roll=[...byChar.values()].sort((a,b)=>b.n-a.n)
            .map(r=>`${r.name||'?'}${r.pi!=null?` (${pnm(r.pi)})`:''}${r.n>1?` \u00d7${r.n}`:''}`);
          log('system',`[The Spymaster] ${led.length} intrusion${led.length===1?'':'s'} into your lands this turn by ${byChar.size} hero${byChar.size===1?'':'es'}: ${roll.join(', ')}.`,{actor:pi,targets:[pi]}); }
        else log('system',`[The Spymaster] Your counter-intelligence reports a quiet turn — no hand was raised against your lands.`,{actor:pi,targets:[pi]});
      } }
    // ── 2026-09-17: ALL THREE ARE NOW RIVAL-BY-RIVAL BOARDS ────
    // These three shipped as WORLD-facing lines (the far horizon, the breeding grounds, battles on
    // wild ground). Toby's ruling: each should say something about every OTHER player, the shape
    // the Throne, Vaultkeeper, Grand Marshal and Sea Lord already use. One line per rival, opening
    // with the holder's own figure so the rivals' numbers can be read against something.
    //
    // THE CARTOGRAPHER — the rival atlas. For each realm: how many provinces they have charted to
    // 100%, and their mapped ground as a share of the whole world. `exploredBy` is already kept per
    // realm per province, so this is a straight read — nothing new is tracked for it.
    { const pi=holder('carto'); if(pi!=null){
        const land=provs.filter(pv=>pv);
        const world=land.length||1;
        const atlas=(i)=>{ let full=0, pts=0;
          land.forEach(pv=>{ const e=(pv.exploredBy&&pv.exploredBy[i])||0; pts+=e; if(e>=100) full++; });
          return {full, pct:Math.round(pts/world)};   // pts is a sum of 0-100 figures, so /world is the mean = the share
        };
        const own=atlas(pi);
        log('system',`[The Cartographer] Your atlas: ${own.full} province${own.full===1?'':'s'} fully charted, ${own.pct}% of the world mapped.`,{actor:pi,targets:[pi]});
        let any=false;
        G.players.forEach((pl,i)=>{ if(i===pi||!met(pi,i))return; any=true; const a=atlas(i);
          log('system',`[The Cartographer] ${pnm(i)}: ${a.full} province${a.full===1?'':'s'} fully charted, ${a.pct}% of the world mapped.`,{actor:pi,targets:[pi]}); });
        if(!any) log('system',`[The Cartographer] No rival realm remains to survey.`,{actor:pi,targets:[pi]});
      unmetLine(pi,'The Cartographer'); } }
    // THE BEASTLORD — the rival menagerie. For each realm: how many Monster-category units they
    // field, and the province holding their largest monster host. Garrisoned beasts are counted in
    // the TOTAL (a realm can muster straight into a garrison) but the named host is always a
    // commander's, because a garrison cannot march at you.
    { const pi=holder('beast'); if(pi!=null){
        const census=(i,set)=>{
          let total=0, best=null, bn=0;
          (G.characters||[]).filter(c=>c&&c.alive&&c.player===i).forEach(c=>{
            const n=(c.armies||[]).filter(a=>a&&set.has(a.type)).length;
            total+=n; if(n>bn){ bn=n; best=c; }
          });
          provs.forEach(pv=>{ if(pv&&pv.owner===i) total+=(pv.garrisonArmies||[]).filter(a=>a&&set.has(a.type)).length; });
          return {total, best, bn};
        };
        const line=(i,label)=>{ const r=census(i,TITLE_MONSTER_ARMIES);
          if(r.total===0){ log('system',`[The Beastlord] ${label}: no monsters under arms.`,{actor:pi,targets:[pi]}); return; }
          log('system',`[The Beastlord] ${label}: ${r.total} monster unit${r.total===1?'':'s'} under arms${r.best?`, the largest host — ${r.bn} — with ${r.best.name} in ${prn(r.best.location)}`:' (all of them garrisoned)'}.`,{actor:pi,targets:[pi]}); };
        line(pi,'Your realm');
        let any=false;
        G.players.forEach((pl,i)=>{ if(i===pi||!met(pi,i))return; any=true; line(i,pnm(i)); });
        if(!any) log('system',`[The Beastlord] No rival realm remains to reckon.`,{actor:pi,targets:[pi]});
      unmetLine(pi,'The Beastlord'); } }
    // THE WILDWARDEN — the rival wild host. The same census, for the free beasts: thunderbirds, ents,
    // bears, giants, unicorns, mammoths, rocs, whale cohorts and great turtles (KC_UNIT_CLASS.creature). Deliberately symmetrical with the Beastlord's board so
    // a player holding both reads one format twice rather than two.
    { const pi=holder('wild'); if(pi!=null){
        const census=(i,set)=>{
          let total=0, best=null, bn=0;
          (G.characters||[]).filter(c=>c&&c.alive&&c.player===i).forEach(c=>{
            const n=(c.armies||[]).filter(a=>a&&set.has(a.type)).length;
            total+=n; if(n>bn){ bn=n; best=c; }
          });
          provs.forEach(pv=>{ if(pv&&pv.owner===i) total+=(pv.garrisonArmies||[]).filter(a=>a&&set.has(a.type)).length; });
          return {total, best, bn};
        };
        const line=(i,label)=>{ const r=census(i,TITLE_CREATURE_ARMIES);
          if(r.total===0){ log('system',`[The Wildwarden] ${label}: the wild answers to no one here.`,{actor:pi,targets:[pi]}); return; }
          log('system',`[The Wildwarden] ${label}: ${r.total} creature unit${r.total===1?'':'s'} in the field${r.best?`, the greatest host — ${r.bn} — with ${r.best.name} in ${prn(r.best.location)}`:' (all of them garrisoned)'}.`,{actor:pi,targets:[pi]}); };
        line(pi,'Your realm');
        let any=false;
        G.players.forEach((pl,i)=>{ if(i===pi||!met(pi,i))return; any=true; line(i,pnm(i)); });
        if(!any) log('system',`[The Wildwarden] No rival realm remains to reckon.`,{actor:pi,targets:[pi]});
      unmetLine(pi,'The Wildwarden'); } }
  })();
  // ── TITLE CHANGES ── compare this turn's holders to last turn's snapshot so each player's report
  // can announce titles their characters/realm newly won this turn (with how + effect).
  (function(){
    let curMajor={}, curMinor={};
    try{
      const st=computeStandings(G);
      TITLE_DEFS.forEach(t=>{ const h=st.titles[t.key]||{}; curMajor[t.key]={charId:h.charId!=null?h.charId:null, playerIndex:h.playerIndex!=null?h.playerIndex:null, kingdomLevel:!!t.kingdomLevel}; });
      const mh=computeMinorTitles(G);
      MINOR_TITLES.forEach(t=>{ const h=mh[t.key]||{}; curMinor[t.key]={charId:h.charId!=null?h.charId:null, playerIndex:h.playerIndex!=null?h.playerIndex:null}; });
    }catch(e){ curMajor={}; curMinor={}; }
    const prev=G._titlesSnapshot||null;
    const nowPublic=((G.turn||1)>=TITLES_PUBLIC_FROM_TURN)||!!G.gameOver;
    // The FIRST turn titles go public, announce every title a player currently holds (their initial
    // standing). After that, announce only titles that change hands. `firstPublic` is true when we
    // are public now but the previous snapshot was taken while NOT public (or there is no prior
    // snapshot).
    const firstPublic = nowPublic && !(prev && prev.wasPublic);
    const gainsByPlayer={};
    const lossesByPlayer={};   // title CHANGES also notify the previous holder they lost it.
    if(nowPublic){
      const chName=id=>{ const c=(G.characters||[]).find(x=>x.id===id); return c?c.name:null; };
      const pName=pi=>{ const p=G.players[pi]; return p?p.name:null; };
      // A title changed hands away from `was` — record the loss for the OLD holder (a rival now
      // holds it, or it has fallen vacant). Never fired on the first public reveal (no prior public
      // holder), and never when the same realm keeps it via a different character.
      const recordLoss=(scope,t,cur,was)=>{
        if(firstPublic) return;
        const hadHolder = t.kingdomLevel ? (was.playerIndex!=null) : (was.charId!=null);
        const nowDifferent = t.kingdomLevel ? (cur.playerIndex!==was.playerIndex) : (cur.charId!==was.charId);
        if(!hadHolder || !nowDifferent) return;
        const loserPi=was.playerIndex;
        if(loserPi==null || loserPi===cur.playerIndex) return;   // same realm kept it → not a loss
        (lossesByPlayer[loserPi]=lossesByPlayer[loserPi]||[]).push({
          scope, key:t.key, name:t.name, kingdomLevel:!!t.kingdomLevel,
          vacant: (cur.playerIndex==null),
          newHolderIndex: (cur.playerIndex!=null?cur.playerIndex:null), // 2026-09-27 item 3: lets the report withhold the name of a realm this player has not met
          newHolderName: cur.playerIndex!=null?pName(cur.playerIndex):null,
          newCharName: (t.kingdomLevel||cur.charId==null)?null:chName(cur.charId),
        });
      };
      TITLE_DEFS.forEach(t=>{
        const cur=curMajor[t.key]||{}, was=(prev&&prev.major&&prev.major[t.key])||{};
        const changed = firstPublic
          ? (cur.playerIndex!=null)                                            // first reveal → any current holder
          : (t.kingdomLevel ? (cur.playerIndex!=null && cur.playerIndex!==was.playerIndex)
                            : (cur.charId!=null && cur.charId!==was.charId));
        if(changed){ const pi=cur.playerIndex; if(pi!=null)
          (gainsByPlayer[pi]=gainsByPlayer[pi]||[]).push({scope:'major',key:t.key,name:t.name,charName:t.kingdomLevel?null:chName(cur.charId),kingdomName:pName(pi),kingdomLevel:!!t.kingdomLevel,perk:t.perk,req:t.req,initial:firstPublic}); }
        recordLoss('major',t,cur,was);
      });
      MINOR_TITLES.forEach(t=>{
        const cur=curMinor[t.key]||{}, was=(prev&&prev.minor&&prev.minor[t.key])||{};
        const changed = firstPublic ? (cur.charId!=null) : (cur.charId!=null && cur.charId!==was.charId);
        if(changed){ const pi=cur.playerIndex; if(pi!=null)
          (gainsByPlayer[pi]=gainsByPlayer[pi]||[]).push({scope:'minor',key:t.key,name:t.name,charName:chName(cur.charId),kingdomName:pName(pi),perk:t.perk,req:t.req,initial:firstPublic}); }
        recordLoss('minor',t,cur,was);
      });
    }
    G._titleGainsByPlayer=gainsByPlayer;
    G._titleLossesByPlayer=lossesByPlayer;
    G._titlesSnapshot={major:curMajor,minor:curMinor,wasPublic:nowPublic};
  })();
  // ── THE REPORTS, BUILT AFTER THE SAVE (P1-18d, 2026-10-18) ────
  // The shell calls buildReports() only once the turn is saved (_turnCommitted), so a report that fails costs reports,
  // never the turn (docs/traps.md, "Post-commit work in runTurn"). The reports are built on the working copy, as they
  // always were: the Spy-stealth rolls in buildReports (engine/turn/realm-reports-and-spy-stealth.js) change it, and the
  // reports read it with the turn's log and helpers.
  const _reports={built:false};
  turnContext._reports=_reports;

  return {state:JSON.stringify(G), log:turnLog, buildReports:(...a)=>buildReports(turnContext,...a)};
}

