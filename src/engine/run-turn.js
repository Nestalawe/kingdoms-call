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
  turnContext.diploDeclarations=diploDeclarations;
  const safeStartRefused=[]; // SAFE START: realms whose declarations were discarded this turn (told privately)
  const discoveryChoicePicks={}; // research choice: player index → {pendingKey: keptDiscoveryId}
  // Victory: players who Called the Reckoning this turn (king-only, one per realm).
  const reckoningCalls=new Set();
  turnContext.reckoningCalls=reckoningCalls;
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

  // Test hook (headless harnesses only): expose the encounter resolvers nested in runTurn.
  try{ if(typeof window!=='undefined') window._kcTest={G,resolveEncounter:(...a)=>resolveEncounter(turnContext,...a),resolvePersonalCombat:(...a)=>resolvePersonalCombat(turnContext,...a),resolveCharVsChar:(...a)=>resolveCharVsChar(turnContext,...a),combatVsChar:(...a)=>combatVsChar(turnContext,...a),effStat:(...a)=>effStat(turnContext,...a),rng,pcCharCombatant:(...a)=>pcCharCombatant(turnContext,...a),pcMonsterCombatant,trySkillGain:(...a)=>trySkillGain(turnContext,...a),resolveDuel:(...a)=>resolveDuel(turnContext,...a),duelFleeItemDrop:(...a)=>duelFleeItemDrop(turnContext,...a),pcCastCombatSpell:(...a)=>pcCastCombatSpell(turnContext,...a),preBattleDuel:(...a)=>preBattleDuel(turnContext,...a),awardWinHp:(...a)=>awardWinHp(turnContext,...a),awardKillXP:(...a)=>awardKillXP(turnContext,...a)}; }catch(e){}

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
    startPhaseHealingSnapshotsAndStalledBattles(turnContext, ph);

    // ── STAGE 1: declare intent (read-only) ──
    const intents=buildPhaseIntents(turnContext,ph);

    pinAndReactToPhaseIntents(turnContext, ph, intents);

    resolvePhaseOrdersInTwoTiersAroundTheDefendStep(turnContext, ph, intents);

    endPhaseSkillRisesFallenCommandersAndProvinceMemory(turnContext, ph, _phaseStartLoc);

    // Tax collection moved to Early Winter block below

    // Hero pay and army wages at Early Winter
    if(ph===4){
      earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill(turnContext);
    }
    syncAllMaxHp(turnContext); // a max-HP rise earned this phase heals into its headroom now
  }

  turnContext._currentPhase=null; // the phase loop is over — any later gain belongs to END OF TURN
  turnContext._afterPhases=true;  // …and so does every later LOG LINE (see log() above)


  afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames(turnContext);

  collectBotDiplomacy(); // bots declare BEFORE the phases now (see the pre-phase pass); a no-op here for any late-identified rival

  diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings(turnContext);

  victoryTheReckoningEliminationConcessionAndTheAnnouncement(turnContext);

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

