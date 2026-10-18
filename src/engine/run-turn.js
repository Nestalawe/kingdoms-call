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
  const HUMANOID_RACES_SG=new Set(KC_HUMANOID_RACES);

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

  // ── HIRE PRE-ORDERS LAND (shared by Hire Hero and the Neutral BROKER hire) ────
  // The hirer's pre-written orders are applied only once the hire has landed. Matched on hero + this
  // realm (an exact match on the hiring character wins if two cards were somehow submitted), so a
  // rival's pre-orders for the same hero are ignored. Phases are bounded by the ACTUAL hire phase,
  // not the phase the player planned to hire in. 2026-09-23 (Toby item 4): the Broker hire never
  // called this — since hire pre-orders became PENDING (09-21) a brokered hero's pre-written orders
  // were silently dropped, his remaining phases were left empty, and his encounter plan was never
  // set. Both paths now share this one function.
  function landHirePreOrders(h, c, ph, player){
        // Matched on hero + this realm (an exact match on the hiring character wins if two cards
        // were somehow submitted), so a rival's pre-orders for the same hero are ignored. Phases are
        // bounded by the ACTUAL hire phase, not the phase the player planned to hire in — if the
        // hire slipped a phase, the orders for the phases he was not yet sworn are dropped.
        {
          const _ph=(G._pendingHireOrders||[]);
          const _pend=_ph.find(x=>x.heroId===h.id&&x.player===c.player&&x.viaId===String(c.id))
                    ||_ph.find(x=>x.heroId===h.id&&x.player===c.player);
          let _applied=0;
          if(_pend&&Array.isArray(_pend.orders)){
            const slots=G.turnOrders[h.id]||[null,null,null,null,null];
            _pend.orders.forEach((o,pi2)=>{
              if(pi2>ph&&o&&o.action&&o.action!=='Defend'&&o.action!=='defend'){ slots[pi2]=o; _applied++; }
            });
            G.turnOrders[h.id]=slots;
          }
          // Step 3 of order ingestion only defaults LIVING OWNED characters to Defend, and this
          // hero belonged to nobody when it ran, so his post-hire phases were left empty and he
          // simply did nothing (no watch) for the rest of the turn. Fill them in like everyone else
          // — the same closing step Resurrect and Charm already do.
          const fin=G.turnOrders[h.id]||[null,null,null,null,null];
          for(let pz=0;pz<5;pz++){ if(pz>ph&&!fin[pz]) fin[pz]={action:'defend',target:'',extra:'',desc:'Defend'}; }
          G.turnOrders[h.id]=fin;
          applyPendingSynthPlan(G,h,c.player);
          if(_applied>0) log('system',`${h.name} takes up the orders ${player.name} laid down for them — ${_applied} phase${_applied!==1?'s':''} of this turn remain to be acted on.`,{actor:c.player,targets:[c.player],charId:h.id,phase:ph});
        }
  }
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
    // ── THIEF: caught in the act ────
    // A thief detected mid-theft is set upon by the victim: a PERSONAL duel on both encounter plans
    // (the thief is well advised to lead with FLEE), unless the victim's duel stance is REFUSE — then
    // the victim lets the thief go and merely raises the alarm. A Vanished thief (Thief 9) is never
    // brought to bay at all.
    const thiefCaughtScuffle=(thief, victim, what)=>{
      const targetsPi=[thief.player,victim.player].filter(x=>x!=null);
      if(thief._vanishTurn===G.turn){
        log('system',`${victim.name} raises the alarm, but ${thief.name} has already melted into the shadows. (Vanish)`,{actor:thief.player,targets:targetsPi,provinceId:prov.id,charIds:[thief.id,victim.id]});
        return;
      }
      ensureEncounterPlan(turnContext,victim);
      if(duelStanceOf(victim)==='refuse'){
        log('system',`${victim.name} catches ${thief.name} ${what}, but wants no part in a brawl — the thief is driven off empty-handed.`,{actor:thief.player,targets:targetsPi,provinceId:prov.id,public:false,charIds:[thief.id,victim.id]});
        return;
      }
      const COMBAT_ONLY=COMBAT_ONLY_TACTICS;
      const filterPlan=(plan)=>((plan&&plan.tactics)||['ME']).filter(t=>COMBAT_ONLY.has(String(t).split(':')[0].toUpperCase())||String(t).toUpperCase().startsWith('CA:'));
      ensureEncounterPlan(turnContext,thief);
      const atkPlan=filterPlan(thief.encounterPlan); if(!atkPlan.length) atkPlan.push('ME');
      const defPlan=filterPlan(victim.encounterPlan); if(!defPlan.length) defPlan.push('ME');
      const _duelChars=[thief.id,victim.id];
      log('combat',`⚔ ${victim.name} catches ${thief.name} ${what} — blades are drawn!`,{actor:thief.player,targets:targetsPi,provinceId:prov.id,public:true,charIds:_duelChars});
      markProvinceCombat(prov,[thief.player,victim.player]); // purple swords: a personal combat, not a field battle
      const enc=resolveCharVsChar(turnContext,thief,victim,atkPlan,defPlan,prov,(...a)=>effStat(turnContext,...a),rng,G);
      enc.narrative.forEach(line=>emitNarrLine(turnContext,'combat',line,{actor:thief.player,targets:targetsPi,provinceId:prov.id,charIds:_duelChars}));
      thief.hp=Math.max(1,enc.atkHp);
      if(victim.player!==null) victim.hp=Math.max(1,enc.defHp);
      if(enc.atkKilled||enc.atkHp<=0){ if(_escapesTheEnd(thief)){ if(thief.hp!=null&&thief.hp<=0) thief.hp=1; log('combat',_garrethEscapeLine(thief),{actor:thief.player,targets:targetsPi,provinceId:prov.id,public:true,charIds:_duelChars}); } else { reportHeroFall(turnContext,thief,victim,`${thief.name} is cut down — a thief's end.`,{actor:thief.player,targets:targetsPi,provinceId:prov.id,public:true,charIds:_duelChars}); awardKillXP(turnContext,victim,thief); } }
      if(enc.defKilled||enc.defHp<=0){ if(_escapesTheEnd(victim)){ if(victim.hp!=null&&victim.hp<=0) victim.hp=1; log('combat',_garrethEscapeLine(victim),{actor:thief.player,targets:targetsPi,provinceId:prov.id,public:true,charIds:_duelChars}); } else { reportHeroFall(turnContext,victim,thief,`${victim.name} is slain by the cornered thief!`,{actor:thief.player,targets:targetsPi,provinceId:prov.id,public:true,charIds:_duelChars}); awardKillXP(turnContext,thief,victim); } }
    };
    // Shared: lift a random magic item from a victim (null if none, or if the victim is a master
    // thief).
    const liftRandomItem=(thief, victim)=>{
      const items=victim.items||[];
      const pool=transferableItems(items); // a granted Mithril suit cannot be lifted off its wearer
      if(!pool.length) return null;
      if(perkTier(victim,'thief')>=3) return {guarded:true}; // THIEF L8: a master thief's own pockets cannot be picked
      // the thief grabs what comes to hand — the pick is weighted TOWARD the lesser trinkets. Weak
      // 8: Moderate 4: Powerful 2: Legendary 1, so a hero carrying one item of each tier loses the
      // Weak one 53% of the time and the Legendary one under 7%.
      const STEAL_TIER_W={1:8,2:4,3:2,4:1};
      const wsum=pool.reduce((t,x)=>t+(STEAL_TIER_W[x.tier||1]||8),0);
      let r=kcRng()*wsum, it=pool[pool.length-1];
      for(const x of pool){ r-=(STEAL_TIER_W[x.tier||1]||8); if(r<0){ it=x; break; } }
      items.splice(items.indexOf(it),1); applyItemMaxHp(victim,it);
      thief.items=(thief.items||[]); thief.items.push(it); applyItemMaxHp(thief,it);
      it._stolenTurn=G.turn; // a charmed hero's automatic Send Item hands over this turn's loot first
      return it;
    };
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
      case 'explore':{
        trySkillGain(turnContext,c,'explorer',SKILLGAIN_COMMON); // Explorer: performing an Explore order
        // AK 3.2: Basic Exploration Number × (Explorer skill + 1)% Terrain table: Plain 50%, Desert
        // 25%, Forest 15%, Mountain 15%, Jungle 10%, Sea 25% Base explore rate per terrain, cut 15
        // percentage points from the original
        // {plain:50,desert:40,forest:35,mountain:35,jungle:30,sea:40} to slow the early land-grab.
  const BASIC_EXPLORE={...KC_BASIC_EXPLORE};
        const basicRate=BASIC_EXPLORE[prov.terrain]||15;
        // sd24 The Compass: Explorer treated as 1 level higher
        const explorerSkill=Math.min(5,effStat(turnContext,c,'explorer'));
        // sd10 Scouts & Rangers: +20% explore bonus
        const scoutBonus=1; // sd10 Scouts & Rangers / sd24 The Compass are now `explore` effects
        const loreMult=(charMinor(turnContext,c,'trailblazer')?1.05:1); // Trailblazer minor: +5% (Loremaster explore bonus removed \u2014 now an intel line)
        // (The old Elven "Pathfinder" double forest/jungle exploration has been REPLACED this session by
        // the Elven escape ability — see recordBattleGraves / flushElvenEscapes. No exploration
        // bonus now.)
        let _discExpl=1; discEff(turnContext,c.player,'explore').forEach(e=>{ if(!e.terrains||e.terrains.includes(prov.terrain)) _discExpl*=(e.mult||1); }); // explore discoveries
        const gain=Math.min(100,Math.floor(basicRate*(explorerSkill+1)*scoutBonus*loreMult*_discExpl));
        if(!prov.exploredBy) prov.exploredBy={};
        const before=prov.exploredBy[c.player]||0;
        prov.exploredBy[c.player]=Math.min(100,before+gain);
        prov.explored=prov.exploredBy[c.player]; // keep legacy field for compatibility
        creditMapped(c, before, prov.exploredBy[c.player]); // TITLE MERIT: Cartographer
        // EXPLORER L8 — surveying the ground sometimes reveals richer land: 50% chance to +2 tax
        // base (max 10), permanent. EXPLORER L8: the rich-land survey can only pay off ONCE per
        // province — repeated Explore orders on the same ground no longer keep rolling the tax base
        // upward.
        if(perkTier(c,'explorer')>=3 && !prov._richSurveyed && kcRng()<0.5){ prov._richSurveyed=true; const _b8=prov.tax||0; prov.tax=Math.min(10,_b8+2); if(prov.tax>_b8) log('explore',`\u26f0 ${c.name}'s keen survey of ${prov.name} reveals richer land \u2014 its tax base rises to ${prov.tax}.`,{actor:c.player,targets:[c.player],provinceId:prov.id}); }
        // ANCIENT LORE (sd32) — the same Explore action also maps 10% of each adjacent province.
        if(hasDisc(turnContext,c.player,'sd32')){ const _alPct=discParam('sd32','pct',10);
          getNeighborsP(prov,G.world.cols,G.world.rows,G.world.provinces).forEach(nb=>{ if(!nb)return; if(!nb.exploredBy)nb.exploredBy={}; const _ab=nb.exploredBy[c.player]||0; nb.exploredBy[c.player]=Math.min(100,_ab+_alPct); nb.explored=nb.exploredBy[c.player]; creditMapped(c, _ab, nb.exploredBy[c.player]); });
        }
        // Feature discovery: proportional thresholds based on how many features exist At 100%
        // explored, all features visible. 1 feature=100%, 2=50%/100%, 4=25%/50%/75%/100% etc.
        const totalFeatures=(prov.features||[]).length;
        const newlyDiscovered=[];
        if(totalFeatures>0){
          const threshold=100/totalFeatures; // % per feature
          prov.features.forEach((f,idx)=>{
            if(!featDiscovered(f,c.player)&&!(f._hidden&&f._hiddenBy!==c.player)&&prov.explored>=(threshold*(idx+1))){
              discoverFeat(f,c.player);c.merits=(c.merits||0)+1; TM(c).featuresFound+=1; // TITLE MERIT: Loremaster
              newlyDiscovered.push(f);
            }
          });
        }
        // Philosopher's Lens: reveals one random still-undiscovered lair here.
        if(hasItemBase(c,"Philosopher's Lens")){
          const _lensPool=(prov.features||[]).filter(f=>f&&!featDiscovered(f,c.player)&&!(f._hidden&&f._hiddenBy!==c.player));
          if(_lensPool.length){ const _lf=_lensPool[Math.floor(kcRng()*_lensPool.length)]; discoverFeat(_lf,c.player); c.merits=(c.merits||0)+1; TM(c).featuresFound+=1; newlyDiscovered.push(_lf);
            log('explore',`🔍 The Philosopher's Lens shows ${c.name} what the ground itself hides — the ${_lf.name}.`,{actor:c.player,targets:[c.player],provinceId:prov.id}); }
        }
        if((prov.features||[]).some(f=>f._hidden&&f._hiddenBy!==c.player&&!featDiscovered(f,c.player))){
          log('explore',`🌫 Something clouds ${c.name}'s exploration of ${prov.name} — a veiling illusion conceals lairs hidden here, and none can be discovered while it holds.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        }
        if(newlyDiscovered.length>0){
          const _art=(n)=>{ if(!n) return 'a creature'; if(/s$/.test(n)) return n; return (/^[aeiou]/i.test(n)?'an ':'a ')+n; };
          // a ritual site has no guardian — report it as a ritual site.
          const _rtTail=(f)=> f.ritualSite ? `It is an ancient ritual site of the old gods — no guardian lairs here.` : `Legend says it is guarded by ${_art(f.monster?.name)}.`;
          if(newlyDiscovered.length===1){
            const f=newlyDiscovered[0];
            log('explore',`${c.name} explores ${prov.name} (+${gain}%, now ${prov.explored}% mapped) and discovers the ${f.name}! ${_rtTail(f)}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          } else {
            const frags=newlyDiscovered.map(f=>f.ritualSite?`the ${f.name} (a ritual site)`:`the ${f.name} (guarded by ${_art(f.monster?.name)})`);
            const list=frags.slice(0,-1).join(', ')+' and '+frags[frags.length-1];
            log('explore',`${c.name} explores ${prov.name} (+${gain}%, now ${prov.explored}% mapped) and uncovers ${newlyDiscovered.length} sites: ${list}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          }
        } else {
          // explorer training is handled once, at the top of this case, by trySkillGain — the old
          // extra 8%-capped-at-5 roll here bypassed the experience system and double-trained, so it
          // has been removed for consistency.
          log('explore',`${c.name} explores ${prov.name} (+${gain}%, now ${prov.explored}% mapped). ${prov.explored<30?'Much of the province remains uncharted.':prov.explored<70?'The province is becoming well-known.':'The province is thoroughly explored.'}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        }
        recordDeadHeroSighting(turnContext,c.player,prov.id);
        break;
      }
      case 'rite':{
        // ── PAGAN: Perform Rite ── Only Pagan realms; only at a DISCOVERED ritual site.
        if(G.players[c.player]?.alignment!=='Pagan'){
          log('system',`${c.name} does not keep the old faith — only Pagan realms may perform rites.`,{actor:c.player,targets:[c.player]});break;}
        // a ritual site in your OWN province is always known to you (it shows on your map), so the
        // rite may be performed there without first Exploring. Elsewhere, the site must be
        // discovered.
        const _riteSite=(prov.features||[]).find(f=>f.ritualSite&&(featDiscovered(f,c.player)||prov.owner===c.player));
        if(!_riteSite){
          log('system',`${c.name} finds no ritual site in ${prov.name} — rites need standing stones, and stones must first be found.`,{actor:c.player,targets:[c.player]});break;}
        // ONE RITE PER PROVINCE PER TURN (2026-09-19, Toby): once any realm's rite has been
        // performed here this turn, every later attempt in the province fails, whoever makes it.
        // Stamped with the turn number (prov._riteTurn) rather than a per-turn scratch flag, so there
        // is nothing to clear. Only a rite that actually HAPPENS stamps it — one that fails for want
        // of gold, creatures or units leaves the stones free for someone else.
        if(prov._riteTurn===G.turn){
          log('system',`${c.name} comes to the ${_riteSite.name} in ${prov.name}, but the stones have already answered once this turn — the old gods will hear no second rite here until the turn has passed.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
        const _rite=(target||'').toLowerCase();
        if(_rite.startsWith('wild')){
          // ── Rite of the Wild Hunt ── Bind the province's native primal creatures for this turn
          // and WILD_HUNT_TURNS more. The ONLY way to field Creatures/Monsters without Druid magic.
          const _wildType=(prov.armyTypes||[]).find(t=>PRIMAL_ARMY_DEFS_P[t]);
          if(!_wildType){
            log('system',`${c.name} calls the Wild Hunt at the ${_riteSite.name}, but nothing wild answers in ${prov.name} — the rite needs a province where Creatures or Monsters still roam.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
          const _huntCost=wildHuntPrice(_wildType);
          if((player.gold||0)<_huntCost){
            log('system',`${c.name} cannot afford the Wild Hunt offerings (${_huntCost}g).`,{actor:c.player,targets:[c.player]});break;}
          player.gold-=_huntCost;
          prov._riteTurn=G.turn;   // the province's one rite this turn is spent
          c.armies=c.armies||[];
          const _boundNames=[];
          for(let wi=0;wi<WILD_HUNT_UNITS;wi++){
            // the bound beasts are VETERAN. _wildHuntUntilTurn is the LAST turn they serve
            // (released by the end-of-turn sweep once G.turn has advanced PAST it).
            const _u={type:_wildType,quality:'Veteran',race:prov.race||'Primal',
              unitName:armyUnitName(_wildType),_wildHuntUntilTurn:G.turn+WILD_HUNT_TURNS+discSum(turnContext,c.player,'wildHunt','turns')}; // + ap08 The Long Hunt
            c.armies.push(_u);_boundNames.push(`${_u.unitName} (${_wildType})`);
          }
          log('combat',`\u{1F525} ${c.name} performs the Rite of the Wild Hunt at the ${_riteSite.name} (${_huntCost}g — the price of a single beast, whatever number answer). The old gods answer: ${_boundNames.join(' and ')} come down from the wilds to serve as veterans — they draw no wages, and hold until the end of next turn, when the binding fails.`,{actor:c.player,targets:[c.player],provinceId:prov.id,public:true});
          // Gaining a force in a province you don't own is resolved like any other unit gain:
          // defenders present means a battle, none means the character takes control.
          resolveUnitGainInProvince(turnContext, c, prov, ph);
          break;
        }
        // ── Blood Offering (default) ── The player names units to SACRIFICE and an EQUAL number of
        // units to EMPOWER; each empowered unit gains TWO experience tiers (capped at Elite). Some
        // units are given up to make others stronger. Encoded in the order's `extra` as
        // "S:i,j|E:a,b" — indices into the character's army. Borrowed/temporary/skeletal units can
        // be neither offered nor raised.
        const _tiers=QUALITY_TIERS.slice();
        const _army=c.armies||[];
        const _bOffElig=i=>{ const a=_army[i]; return !!a && !a._temporary && a._wildHuntUntilTurn==null && !a._isSkeletal; };
        let _sacI=[], _benI=[];
        const _bm=/S:([0-9,]*)\|E:([0-9,]*)/.exec((extra||'').trim());
        if(_bm){
          _sacI=[...new Set(_bm[1].split(',').filter(x=>x!=='').map(Number))].filter(i=>Number.isInteger(i)&&_bOffElig(i));
          _benI=[...new Set(_bm[2].split(',').filter(x=>x!=='').map(Number))].filter(i=>Number.isInteger(i)&&_bOffElig(i)&&!_sacI.includes(i));
        }
        // Legacy/no-selection fallback: sacrifice one own unit to raise one other by two tiers.
        if(_sacI.length===0||_benI.length===0){
          const _own=_army.map((a,i)=>i).filter(_bOffElig);
          if(_own.length>=2){ _sacI=[_own[0]]; _benI=[_own[1]]; }
          else { log('system',`${c.name} makes no Blood Offering — name units to sacrifice and an equal number to empower (needs at least two of its own units).`,{actor:c.player,targets:[c.player]}); break; }
        }
        const _bn=Math.min(_sacI.length,_benI.length);   // each sacrifice funds exactly one empowerment
        const _sac=_sacI.slice(0,_bn).map(i=>_army[i]);
        const _ben=_benI.slice(0,_bn).map(i=>_army[i]);
        prov._riteTurn=G.turn;   // the province's one rite this turn is spent
        c.armies=_army.filter(a=>!_sac.includes(a));
        recordBattleGraves(turnContext,prov,_sac);
        _ben.forEach(b=>{ const cur=_tiers.indexOf(b.quality); if(cur>-1) b.quality=_tiers[Math.min(4,cur+2)]; });
        if(typeof refreshMovePool==='function') refreshMovePool(turnContext,c); // the host is smaller now — pace may change
        log('combat',`\u{1FA78} ${c.name} makes a Blood Offering at the ${_riteSite.name} — ${_sac.map(a=>a.unitName||a.type).join(', ')} (${_bn} unit${_bn!==1?'s':''}) are given to the old gods, and their strength passes to ${_ben.map(a=>`${a.unitName||a.type} (rise to ${a.quality})`).join(', ')}.`,{actor:c.player,targets:[c.player],provinceId:prov.id,public:true});
        break;
      }
      // ── HUNTING RUMOURS (2026-09-17 (late), Toby item 3) ────
      // The character spends the phase in the taverns and byways of the province asking after the
      // lairs they know of there. Target: comma-separated indexes into prov.features (the same idx
      // the Search Lair form uses). Each lair costs gold by grade (RUMOUR_COST_BY_POWER), paid up
      // front and in the order chosen; when the purse runs dry the rest are skipped. For each lair
      // paid for, all THREE facts are learned (2026-09-23d, Toby — no roll): the guardian's weakness
      // (learned for good, exactly as a Scout would learn it), the hoard behind it (exact gold and
      // the magic that lies there), and the hero's own odds — measured by simulateLairOdds and read
      // back as one of five narrative bands.
      case 'hunt_rumours':{
        const _cost=RUMOUR_COST_BY_POWER;
        const _idxs=[...new Set(String(target||'').split(',').map(s=>parseInt(String(s).trim())).filter(n=>!isNaN(n)&&n>=0))];
        const _total=(prov.features||[]).length, _explHere=(prov.exploredBy&&prov.exploredBy[c.player])||0;
        const _feats=_idxs.map(i=>({f:(prov.features||[])[i],i})).filter(({f,i})=>{
          if(!f||f.cleared||f.ritualSite||!f.monster) return false;
          const thr=_total>0?Math.ceil(100/_total)*(i+1):100;          // the order form's own visibility rule
          return featDiscovered(f,c.player)||(_explHere>=thr);
        });
        if(!_feats.length){ log('explore',`${c.name} asks after the lairs of ${prov.name}, but no one has anything to tell — there is no known lair here to ask about.`,{actor:c.player,targets:[c.player],provinceId:prov.id}); break; }
        log('explore',`🍺 ${c.name} spends the season in the taverns and on the roads of ${prov.name}, hunting rumours of ${_feats.length} lair${_feats.length!==1?'s':''}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        for(const {f,i:_fi} of _feats){
          const m=f.monster; const grade=(m&&m.power)||f.tier||'Weak'; const price=_cost[grade]||1;
          if((player.gold||0)<price){ log('explore',`  ${c.name} cannot afford the ${price}g the ${f.name}'s rumours would cost (${player.gold||0}g in the treasury) — the rest of the hunt is abandoned.`,{actor:c.player,targets:[c.player],provinceId:prov.id}); break; }
          player.gold-=price;
          const gname=`${m.name}${monsterCatLabel(m)?` (${monsterCatLabel(m)})`:''}`; // the kind keeps its capital: "(elemental)" read as a magic school written in lower case
          const lines=[`  💰 ${price}g buys the talk of the ${f.name} — ${gname}, a ${String(grade).toLowerCase()} guardian.`];
          // 1) the weakness
          { if(m.weak){ const fresh=pcLearnWeakness(G,c.player,m.name); lines.push(`  ✓ Its weakness: ${m.weak.name} — ${m.weak.desc}.${fresh?' Your realm marks every '+m.name+' with it from now on.':''}`); }
            else lines.push(`  ✓ Its weakness: none that anyone knows of — the ${m.name} has no exploitable flaw.`); }
          // 2) the hoard
          {   ensureLairHoard(f,G);
              const gold=encounterClearGold(f);
              const _hi=(f.hoardItems||[]), _st=(f._stolenItems||[]);
              let itemOut=_hi.length?`, and ${itemNameList(_hi)}`:'';
              if(!_hi.length) itemOut=_st.length?` — its magic (${_st.join(', ')}) has already been lifted by a thief`:' — no magic lies there';
              else if(_st.length) itemOut+=` (a thief has already made off with ${_st.join(', ')})`;
              const _wield=_hi.filter(it=>guardianCanUseItem(m,it));
              if(_wield.length) itemOut+=`. Beware: it wields ${_wield.map(x=>x.name).join(', ')} against all comers`;
              lines.push(`  ✓ Its hoard: the ${m.name} sits on exactly ${gold}g${itemOut}.`);
              // Remembered on the realm so the Known Lairs card shows it next turn and after (the
              // odds are deliberately NOT stored — they belong to one hero on one day, and that
              // hero will change).
              noteLairRumour(player, prov.id, _fi, {turn:G.turn, gold, items:_hi.map(x=>x.name), stolen:_st.slice(), wields:_wield.map(x=>x.name)});
          }
          // 3) the odds
          { const odds=simulateLairOdds(turnContext,c,f);
            // Sept 2026: the band the hero was told is kept on the feature (per realm, per hero, with the hero's
            // fighting rating at the time) so a bot can act on exactly what a player reads — nothing more.
            if(odds){ f._rumourOdds=f._rumourOdds||{}; f._rumourOdds[c.player]={turn:G.turn,charId:c.id,band:rumourOddsBand(odds.pct).max,rating:botLairRating(c)}; }
            if(odds){ const band=rumourOddsBand(odds.pct); lines.push(`  ✓ Your chances: as you stand today, ${band.text(m.name)}.`); }
            else lines.push(`  ✓ Your chances: nobody could say how ${c.name} would fare.`); }
          lines.forEach(t=>log('explore',t,{actor:c.player,targets:[c.player],provinceId:prov.id}));
        }
        trySkillGain(turnContext,c,'spy',SKILLGAIN_COMMON); // a season of asking questions is Spy fieldwork, at the common (move/explore) rate
        break;
      }

      case 'search':{
        // Find the feature
        let fi=0;
        if(target&&!isNaN(parseInt(target))) fi=parseInt(target);
        if(!prov.features||prov.features.length===0){log('explore',`${c.name} searches ${prov.name} but finds nothing of note.`,{actor:c.player,targets:[c.player]});break;}
        // 2026-09-29: a search that NAMES a lair searches that lair or none — no falling back on some
        // other uncleared lair here (that fallback sent heroes into guardians they had never assessed).
        const _named=(target!==''&&!isNaN(parseInt(target)));
        if(_named&&!prov.features[fi]){log('explore',`${c.name} looks for the lair they meant to search in ${prov.name}, but it is not here.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
        let f=prov.features[fi]||prov.features.find(fe=>fe&&!fe.cleared&&!fe.ritualSite)||prov.features.find(fe=>fe&&!fe.ritualSite)||prov.features[0];
        if(!f){break;}
        // A RITUAL SITE CANNOT BE SEARCHED (Toby 2026-09-20): it holds no guardian and no hoard, and
        // the order form no longer offers one. An old saved order that names one is refused here.
        if(f.ritualSite){
          // Nothing lairs at a ritual site — there is no guardian to fight and no treasure to lift.
          const isPagan=G.players[c.player]?.alignment==='Pagan';
          log('explore',`${c.name} walks the ${f.name} of ${prov.name}. The old stones hum with something older than realms${isPagan?' — a Pagan may Perform Rites here':', but they do not answer'}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
        if(f.cleared){log('explore',`${c.name} revisits the cleared ${f.name} in ${prov.name}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
        if(!featDiscovered(f,c.player)){discoverFeat(f,c.player); TM(c).featuresFound+=1;} // TITLE MERIT: Loremaster
        const plan=c.encounterPlan||{tactics:['ME']};
        markProvinceCombat(prov,[c.player]); // purple swords: a personal combat, not a field battle
        const encounter=resolveEncounter(turnContext,c,f,prov,plan.tactics||['ME'],(...a)=>effStat(turnContext,...a),rng,player);
        try{ _tel.encounters.push({ph, pi:c.player, charId:c.id, prov:prov.id, feature:f.name||null, guardian:(f.monster&&f.monster.name)||null, power:(f.monster&&f.monster.power)||null,
          won:!!encounter.won, fled:!!encounter.fled, dmg:encounter.damageToHero||0, hpAfter:encounter.heroHpAfter, killed:!!encounter.heroKilled, tactics:(plan.tactics||['ME']).slice(0,12)}); }catch(_te){}
        encounter.narrative.forEach(line=>{emitNarrLine(turnContext,'explore',line,{actor:c.player,targets:[c.player],provinceId:prov.id});});

        // Hero killed by monster?
        if(encounter.heroKilled){
          // 2026-10-13 (item 19): the death is resolved first (reportHeroFall), so a hero Battlefield
          // Surgery saves reads "at death's door, but not slain" and keeps every item; only a hero who
          // really dies leaves his possessions in the hoard.
          // a character who falls to a lair guardian leaves ALL their magic items among the bones —
          // they become extra treasure for whoever finally slays the guardian. (Mithril Armour is a
          // personal granted relic that re-issues each turn, so it is not left behind.) Clearing
          // c.items before handleHeroDeath stops the possessions passing to the king/heir instead.
          const _lairLeft=(c.items||[]).filter(it=>!(it.effect&&it.effect.stat==='mithrilArmour'));
          const _lairHeld=(c.items||[]).slice();
          if(_lairLeft.length>0) c.items=(c.items||[]).filter(it=>it.effect&&it.effect.stat==='mithrilArmour');
          const _lairDied=reportHeroFall(turnContext,c,null,`💀 ${c.name} has been slain by the ${f.monster?.name||'creature'}!`,{actor:c.player,targets:[c.player],provinceId:prov.id,public:true},{slainBy:`the ${f.monster?.name||'guardian'} of ${prov.name}`}); // the host is told what slew its commander (2026-10-12)
          if(_lairDied===false){ c.items=_lairHeld; break; } // saved, or escaped: nothing is left among the bones
          if(_lairLeft.length>0){
            f.hoardItems=(f.hoardItems||[]).concat(_lairLeft); // joins the lair's hoard
            log('explore',`The ${f.monster?.name||'guardian'} drags ${c.name}'s possessions into its hoard — ${_lairLeft.map(it=>it.name).join(', ')} now lie among the bones, waiting for a stronger hand.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          }
          break; // no further order processing for this hero
        }
        const stolenByThief=encounter.fled&&f.monster?._treasureStolen;
        if(stolenByThief){
          // Steal tactic: the hero escapes with a cut of the feature's hoard; the guardian stays.
          // The take is 10-25% of the feature's OWN `treasure`, and that treasure is permanently
          // reduced — so repeated stealing genuinely drains the hoard, and once it is empty there
          // is nothing left to lift. (Winning the fight still pays the full tiered reward below;
          // that is separate, and the treasure the guardian sat on is spoils of victory.)
          if(f.monster) delete f.monster._treasureStolen;
          ensureLairHoard(f,G);
          const hoard=featureTreasure(f);
          if(f._hoardGoldOrig==null) f._hoardGoldOrig=hoard; // back-compat for pre-revision saves
          if(hoard<=0){
            if(c.player!=null){ f._pickedCleanBy=f._pickedCleanBy||[]; if(!f._pickedCleanBy.includes(c.player)) f._pickedCleanBy.push(c.player); } // 2026-09-29: this realm now KNOWS the hoard is empty (bots stop robbing it)
            log('explore',`${c.name} slips past the ${f.monster?.name||'guardian'} of the ${f.name}, but the hoard is already picked clean — nothing left to steal.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          } else {
            // Thief revision: the cut is 10% PER THIEF LEVEL (capped at 5 → 50%) of the
            // hoard's ORIGINAL size, so skill decides the haul and a full-strength thief empties a
            // lair in two visits. Never more than what is actually left.
            const _thLvl=Math.min(5,effStat(turnContext,c,'thief'));
            const gold=Math.max(1, Math.min(hoard, Math.round((f._hoardGoldOrig||hoard)*0.10*_thLvl)));
            setFeatureTreasure(f, hoard-gold);
            player.gold=(player.gold||0)+gold;c.merits=(c.merits||0)+gold;
            const left=featureTreasure(f);
            if(left<=0&&c.player!=null){ f._pickedCleanBy=f._pickedCleanBy||[]; if(!f._pickedCleanBy.includes(c.player)) f._pickedCleanBy.push(c.player); } // 2026-09-29: emptied it — known to this realm
            const _dregs=left<=0?` They have cleaned out the last of it — the hoard is empty.`:` (~${left}g still hidden here.)`;
            log('explore',`${c.name} escapes with ${gold}g lifted from the ${f.name}'s hoard (Thief ${_thLvl}: ${_thLvl*10}% of the original hoard)! The ${f.monster?.name||'guardian'} still guards the site.${_dregs}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          }
          // a thief may also lift ONE of the hoard's magic items — 30% + 10% per Thief level (max
          // 80%).
          // LEGENDARY relics can never be lifted from a lair (Toby 2026-09-20) — only won by
          // beating the guardian. (They can still be stolen from another character.)
          { ensureLairHoard(f,G); const _hiAll=(f.hoardItems||[]); const _hi=_hiAll.filter(it=>!isLegendaryItem(it));
            if(!_hi.length&&_hiAll.length) log('explore',`${c.name} eyes the ${f.monster?.name||'guardian'}'s relic, but a Legendary treasure is not something that can be spirited away — it must be won by defeating its keeper.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            if(_hi.length){ const _th=effStat(turnContext,c,'thief'); const _ch=Math.min(80,30+10*_th); const _r=d100();
              if(_r<=_ch){ const _it=_hi[Math.floor(kcRng()*_hi.length)]; _hiAll.splice(_hiAll.indexOf(_it),1); c.items=(c.items||[]); c.items.push(_it); applyItemMaxHp(c,_it);
                f._stolenItems=(f._stolenItems||[]).concat(_it.name);
                log('explore',`🗝 ${c.name} also slips ${(isLegendaryItem(_it)?'the LEGENDARY ':'the ')}${_it.name} (${_it.desc}) out from under the guardian's nose! ${fmtRoll(_ch,_r)}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
                log('explore',gainedItemNote(c,[_it]),{actor:c.player,targets:[c.player],provinceId:prov.id}); // item 10
              } else log('explore',`${c.name} eyes the hoard's magic but cannot get near it. ${fmtRoll(_ch,_r)}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            } }
        } else if(encounter.won){
          f.cleared=true;
          if(c.player!=null){ const _g=(f.monster&&f.monster.power)||f.tier||'Weak'; c._botLairKills=c._botLairKills||{}; c._botLairKills[_g]=(c._botLairKills[_g]||0)+1; }   // 2026-09-26: the slayer's grade ladder reads this (botLairPlan)
          // TITLE MERIT: Monster-Bane — HP of the beast overcome (half credit if
          // pacified/parleyed).
          if(f.monster) TM(c).monster += Math.round((f.monster.hp||0)*(encounter.pacified?0.5:1));
          const tier=f.monster?.power||'Weak';
          // Reward ladder — tougher monsters are meaningfully more worthwhile (gold + item odds +
          // HP).
          const T={gold:ENCOUNTER_CLEAR_GOLD_BANDS[tier]||[1,5]}; // Sept 2026 redesign: one gold table; no HP reward
          // pay out the cached clear-gold roll so a scouted figure is exactly honoured; if the site
          // was never scouted, encounterClearGold rolls it now from the same tier band (T.gold).
          const gold=encounterClearGold(f);
          const goldFinal=Math.round(gold*(1+discSum(turnContext,c.player,'lairGold','pct',e=>(!e.terrains||e.terrains.includes(prov.terrain))&&(!e.charRace||c.race===e.charRace)))); // lairGold discoveries. Monster-Bane +50% hoard removed \u2014 the title is now an intel line
          player.gold=(player.gold||0)+goldFinal;c.merits=(c.merits||0)+goldFinal;
          setFeatureTreasure(f,0); // the hoard is lifted
          // 2026-10-14 (batch item 8, Toby): carrying off a cleared lair's hoard no longer trains Thief
          // (it did from 2026-09-21). Stealing from a guardian mid-fight still does.
          // the tier-weighted fighting-skill experience roll for a lair clear is DROPPED; the only
          // permanent reward is the earned-HP gain. A pacified beast earns nothing.
          if(!encounter.pacified) awardWinHp(turnContext, c, null, 'lair'); // clearing a lair by force hardens the hero (earned HP)
          // the automatic "catches their breath" heal (half of the HP lost) after a lair win is
          // REMOVED. The hero leaves the fight at the HP the encounter left them on; recovery now
          // comes only from Rest, Herbal Lore (sd29), Mass Healing (White L6+) and in-fight
          // items/spells.
          // (c.hp already holds the post-fight value — resolveEncounter writes it back; nothing to add here.)
          // Item drops — chance/quantity scale with tier, and item QUALITY scales with tier too.
          // uniqueness. `_taken` seeds from the game-wide roll of items already found
          // (G._awardedItems) and grows as each drop is chosen, so no lair — this one or any other
          // — can ever hand out a duplicate. A null means the treasury is exhausted (gold only).
          // Item 4: the lair's items were fixed at world gen (hoardItems) — the clearer takes them
          // ALL (any kit left by slain challengers is already merged in). Discovery bonus finds
          // still roll fresh.
          ensureLairHoard(f,G);
          const drops=[];
          if(!Array.isArray(G._awardedItems)) G._awardedItems=[];
          const _taken=new Set(G._awardedItems);
          // bonus finds are drawn from the category this realm has found LEAST of.
          const rollItem=()=>{const base=rollMagicItemFor(G,c.player,tier,_taken);if(!base) return null;_taken.add(base.name);G._awardedItems.push(base.name);const itemId=(G.nextItemId||0);G.nextItemId=(G.nextItemId||0)+1;return {...base,id:itemId};};
          (f.hoardItems||[]).forEach(it=>drops.push(it)); f.hoardItems=[];
          const baseDrops=drops.slice(); // the hoard's own magic, narrated below; bonus finds announce themselves.
          // sd25 Alchemical Theory: 10% chance of an extra find.
          { const _dIC=discSum(turnContext,c.player,'itemChance','pct',e=>!e.terrains||e.terrains.includes(prov.terrain)); if(_dIC>0&&kcRng()<_dIC){ const bonus=rollItem(); if(bonus){ drops.push(bonus); log('explore',`Your realm's lore yields an extra find: the ${bonus.name}!`,{actor:c.player,targets:[c.player],provinceId:prov.id}); log('explore',itemLoreLines([bonus]),{actor:c.player,targets:[c.player],provinceId:prov.id}); } } } // itemChance discoveries
          c.items=(c.items||[]);
          drops.forEach(it=>{ c.items.push(it); applyItemMaxHp(c,it); /* item 6 */ noteItemFound(G,c.player,it); }); // tally what this realm has found, by category
          // Narrate the magic actually won here.
          // SILENTLY: the report then fell through to the "no magic this time" line even though the hero
          // walked away with an item — the bug Toby saw (gold reported, no item reported, item in
          // pack).
          if(baseDrops.length>0){
            log('explore',`Victory! ${c.name} claims ${gold}g from the ${f.name} and hauls out ${itemNameList(baseDrops,false)}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            baseDrops.forEach(it=>log('explore',itemLoreLines([it]),{actor:c.player,targets:[c.player],provinceId:prov.id})); // one lore line per relic won
          }
          if(drops.length>0) log('explore',gainedItemNote(c,drops),{actor:c.player,targets:[c.player],provinceId:prov.id}); // item 10: worn at once, or no room
          // recover any items earlier challengers left behind when the guardian slew them.
          if((f.lairItems||[]).length>0){
            const _recovered=f.lairItems.slice();
            _recovered.forEach(it=>{ c.items.push(it); applyItemMaxHp(c,it); /* item 6 */ });
            f.lairItems=[];
            log('explore',`Among the bones of the fallen, ${c.name} recovers ${itemNameList(_recovered,false)}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            _recovered.forEach(it=>log('explore',itemLoreLines([it]),{actor:c.player,targets:[c.player],provinceId:prov.id})); // lore line per recovered relic
            log('explore',gainedItemNote(c,_recovered),{actor:c.player,targets:[c.player],provinceId:prov.id}); // item 10
          }
          // Only claim "no magic" when the fight truly yielded no items — no tier drops AND no
          // Alchemical bonus AND no recovered lair items.
          else if(drops.length===0) log('explore',`Victory! ${c.name} claims ${gold}g from the ${f.name}, though the lair holds no magic${(f._stolenItems||[]).length?` — a thief got here first and lifted ${f._stolenItems.join(', ')}`:''}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        } else if(!encounter.fled){
          const dmg=encounter.damageToHero||rng(2,7);
          c.hp=Math.max(1,c.hp-dmg);
          log('combat',`${c.name} is forced to retreat from the ${f.name}, wounded. HP: ${c.hp}/${c.maxHp}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        }
        break;
      }
      case 'recruit':{
        const ARMY_COST_P=ARMY_COST_MASTER; // alias → master table at top of script
        // ── First: mercenary bands roaming this province ── The order form now lists mercenaries
        // alongside native units, tagged 'merc:<id>'. A single Recruit Armies order may therefore
        // mix the two, so mercenary tokens are consumed here and stripped from the list before
        // native recruitment runs on the remainder. (The older bare id / type / unitName tokens are
        // still accepted so orders saved by an earlier build resolve.)
        const mercsHere=(G.mercenaries||[]).filter(m=>m.location===c.location);
        let _rawSel=(target||'').split(',').map(t=>t.trim()).filter(Boolean);
        // ── Recruit destination ── 'to:self' (default), 'to:garrison', or 'to:<charId>' (a
        // FRIENDLY character standing in this province this phase). The token may arrive in either
        // the target or the extra list; it is stripped before unit tokens are processed.
        let _destTok=_rawSel.find(t=>t.startsWith('to:'))||((extra||'').split(',').map(t=>t.trim()).find(t=>t.startsWith('to:')));
        _rawSel=_rawSel.filter(t=>!t.startsWith('to:'));
        let _destChar=c, _destGarrison=false, _destNote='';
        if(_destTok&&_destTok!=='to:self'){
          if(_destTok==='to:garrison'){
            if(prov.owner===c.player){ _destGarrison=true; _destNote=` (mustered directly into the garrison of ${prov.name})`; }
            else _destNote=' (garrison unavailable — province not controlled; troops join the recruiter)';
          } else {
            const _r=orderCharRef(G,_destTok.slice(3)); // plain id or pre-order hero
            if(_r&&_r.alive&&_r.player===c.player&&_r.location===c.location){ _destChar=_r; _destNote=` (mustered under ${_r.name}'s banner)`; }
            else _destNote=' (chosen recipient is not here — troops join the recruiter)';
          }
        }
        const _autoGarr=[]; // garrison-type recruits diverted from a character's column
        const _pushRecruit=(unit)=>{
          // GARRISON UNITS GO STRAIGHT TO THE GARRISON (2026-09-23c, Toby): a Human / Elven / Dwarf /
          // Orc Garrison unit never joins a column when recruited — it musters into the garrison of the
          // province it was raised in, whatever "Muster to" names (native recruiting already needs the
          // province to be ours). A character can still march it out with Pick Up Army.
          const _toGarr=_destGarrison||(isGarrisonUnitType(unit.type)&&prov.owner===c.player);
          // Item 24 (2026-10-12): a beast recruited into a column already holding as many beasts as its leader's
          // Druid musters into the garrison instead (native beasts are raised only in a province the realm holds).
          const _overCmd=!_toGarr&&prov.owner===c.player&&beastCommandCount(unit)&&beastCommandRoom(_destChar,G.characters)<=0;
          if(_toGarr){ prov.garrisonArmies=prov.garrisonArmies||[]; prov.garrisonArmies.push(unit); if(!_destGarrison) _autoGarr.push(unit.type); }
          else if(_overCmd){ prov.garrisonArmies=prov.garrisonArmies||[]; prov.garrisonArmies.push(unit);
            log('hire',`🐾 ${beastCommandWords(_destChar,G.characters)}: ${unit.unitName||unit.type} (${unit.type}) musters into the garrison of ${prov.name} instead.`,{actor:c.player,targets:[c.player],provinceId:prov.id}); }
          else { _destChar.armies=_destChar.armies||[]; _destChar.armies.push(unit); }
          // TITLE MERIT: Beastlord / Wildwarden. Credited to the RECRUITER `c`, not the recipient:
          // the merit is for finding and mustering the beast, and a hero who musters a griffon wing
          // and hands it straight to a colleague has still done the mustering. Garrison musters
          // count.
          creditBeastUnit(TM(c), unit, 1);
        };
        const _mercTokens=new Set();
        let mHired=false;
        if(mercsHere.length>0&&_rawSel.length>0){
          mercsHere.forEach(merc=>{
            const tok=_rawSel.find(t=>t===`merc:${merc.id}`||t===String(merc.id)||t===merc.type||t===merc.unitName);
            if(!tok) return;
            _mercTokens.add(tok);
            // Item 24: a mercenary beast is not hired into a full column where there is no garrison to take it.
            if(!_destGarrison&&prov.owner!==c.player&&beastCommandCount({type:merc.type})&&beastCommandRoom(_destChar,G.characters)<=0){
              log('hire',`🐾 ${beastCommandWords(_destChar,G.characters)} — the ${merc.unitName||merc.type} mercenaries are not hired.`,{actor:c.player,targets:[c.player],provinceId:prov.id}); return; }
            const baseMercCost=ARMY_COST_P[merc.type]||2;
            // Neutral alignment: mercenaries cost 2g less (min 1g)
            const mCost=Math.max(1,baseMercCost-(G.players[c.player]?.alignment==='Neutral'?2:0)+discSum(turnContext,c.player,'merc','delta',e=>!e.cls||discUnitIs(e.cls,merc.type,true))); // + merc discoveries
            if((player.gold||0)<mCost){log('hire',`${c.name}: cannot afford ${merc.unitName||merc.type} mercenaries (${mCost}g).`,{actor:c.player,targets:[c.player]});return;}
            player.gold-=mCost;
            _pushRecruit({type:merc.type,quality:merc.quality,race:merc.race,unitName:merc.unitName});
            G.mercenaries=G.mercenaries.filter(m=>m.id!==merc.id);mHired=true;
            log('hire',`${c.name} hires mercenary band ${merc.unitName||merc.type} (${merc.quality}) for ${mCost}g${mCost<baseMercCost?' (Neutral discount)':''}.`,{actor:c.player,targets:[c.player],provinceId:c.location});
          });
          if(mHired){ resolveUnitGainInProvince(turnContext, _destGarrison?c:_destChar, prov, ph);
            if(!_destGarrison && _destChar) refreshMovePool(turnContext,_destChar); } // mercenaries joined a column — recompute its pace
        }
        // Whatever is left of the order after the mercenary tokens are removed is native
        // recruitment. a 'to:' destination token that arrived in `extra` must never be parsed as a
        // unit type (it produced a spurious "to:garrison (not raised in …)" block note).
        const _extraClean=(extra||'').split(',').map(s=>s.trim()).filter(t=>t&&!t.startsWith('to:')).join(',');
        const _nativeSel=(_extraClean||_rawSel.filter(t=>!_mercTokens.has(t)&&!t.startsWith('merc:')).join(',')||(mHired?'':'Shieldwall Levies|1'))
          .split(',').map(s=>s.trim()).filter(Boolean);
        if(_nativeSel.length===0) break; // mercenaries only — nothing further to raise
        // Native army recruitment requires CONTROL of the province — you cannot raise local troops
        // in land you merely scouted or passed through. (Mercenaries, handled above, can be hired
        // wherever they roam.) Conquering a province this turn sets prov.owner, so that counts.
        const isOwned=prov.owner===c.player;
        if(!isOwned){
          log('system',`${c.name} cannot recruit in ${prov.name} — you must control the province to raise troops there.`,{actor:c.player,targets:[c.player]});break;
        }
        const selections=_nativeSel;
        let totalCost=0;let recruited=[];let blocked=[];

        for(const sel of selections){
          const[armyType,qtyStr]=sel.split('|');
          // A mercenary token that reached this far is stale (the band was already hired or has
          // moved on) — it must never be treated as a native army type, or it spawns a phantom "the
          // Guard (merc:merc_…, Average)" unit.
          if(armyType.startsWith('merc:')||/^merc_/.test(armyType)) continue;
          const qty=parseInt(qtyStr)||1;
          // Primal sea beasts are called out of deep water — they can only be raised in a sea
          // province, never on a coast. (Fleets remain recruitable wherever the province offers
          // them.)
          if(PRIMAL_SEA_TYPES.has(armyType)&&prov.terrain!=='sea'){
            blocked.push(`${armyType} (can only be summoned in a sea province)`);continue;
          }
          // the ordered type must actually be OFFERED by the province the character is standing in
          // AT RESOLUTION. Orders are set against a predicted location, but a battle can end the
          // phase somewhere else — without this guard a character shoved into a different province
          // would still raise units that province never offered. armyTypes is the province's own
          // recruitable list (racial field units + its garrison).
          if(!(prov.armyTypes||[]).includes(armyType)){
            blocked.push(`${armyType} (not raised in ${prov.name} — that unit isn't available here)`);continue;
          }
          // Check turn-wide recruit limit
          if(!canRecruit(turnContext,armyType,prov.id,prov,c.player)){
            blocked.push(`${armyType} (already recruited this turn)`);continue;
          }
          const limit=getRecruitLimit(turnContext,armyType,prov,c.player);
          const alreadyDone=recruitedThisTurn[`${prov.id}:${armyType}`]||0;
          const actualQty=Math.min(qty, limit-alreadyDone);
          let _unitCost=realmRecruitCost(G.players[c.player], armyType, ARMY_COST_P[armyType]||2); // sd16 + recruitCost discoveries
          if(perkTier(c,'druid')>0&&(CREATURE_ARMIES.has(armyType)||MONSTER_ARMIES.has(armyType))) _unitCost=Math.floor(_unitCost*0.5); // DRUID L6: creatures/monsters cost half (rounded down)
          const unitCost=_unitCost;
          const cost=actualQty*unitCost;
          if((player.gold||0)<totalCost+cost){
            blocked.push(`${armyType} (insufficient gold: need ${cost}g more)`);continue;
          }
          totalCost+=cost;
          for(let q=0;q<actualQty;q++){
            // sd01 Superior Forging: recruited armies start at Veteran
          const startQuality=((gdActive(turnContext,c.player,'Druidic')&&(CREATURE_ARMIES.has(armyType)||MONSTER_ARMIES.has(armyType)))||kcRng()<discRecruitQChance(G.players[c.player],armyType))?'Veteran':'Average'; // GRAND DESIGN Druidic; recruitQ discoveries (sd01 Superior Forging …) roll per unit
          // Whale Cohorts and Shark Shoals are wild sea beasts — always the Primal race, whoever raises them.
          const recruitRace=(armyType==='Whale Cohort'||armyType==='Shark Shoals')?'Primal':(prov.race||'Human');
          _pushRecruit({type:armyType,quality:startQuality,race:recruitRace,unitName:armyUnitName(armyType)});
          if(!HUMANOID_RACES_SG.has(recruitRace)&&!_destGarrison) trySkillGain(turnContext,_destChar,'druid',SKILLGAIN_STD); // Druid: led a non-humanoid recruit
          else if(CREATURE_ARMIES.has(armyType)||MONSTER_ARMIES.has(armyType)) trySkillGain(turnContext,_destGarrison?c:_destChar,'druid',SKILLGAIN_COMMON); // 2026-09-21: any primal recruit (incl. into a garrison) — small chance for the recruiter
          }
          recordRecruit(turnContext,armyType,prov.id,actualQty);
          recruited.push(`${actualQty}× ${armyType}`);
        }
        if(recruited.length>0){
          player.gold-=totalCost;
          const _agN=_autoGarr.length, _autoGarrNote=_agN?`; ${_agN} garrison unit${_agN!==1?'s':''} muster${_agN===1?'s':''} straight into the garrison of ${prov.name}`:'';
          log('hire',`${c.name} recruits ${recruited.join(', ')} in ${prov.name}${_destNote}${_autoGarrNote}. Cost: ${totalCost}g. Treasury: ${player.gold}g remaining.`+
            (blocked.length>0?` (Blocked: ${blocked.join('; ')}.)`:''),
            {actor:c.player,targets:[c.player],provinceId:prov.id});
          // if the muster went to ANOTHER of the player's characters, notify them in their section.
          if(!_destGarrison && _destChar && _destChar.id!==c.id) notifyTarget(turnContext, _destChar,`⚔ ${recruited.join(', ')} muster to ${_destChar.name}'s banner in ${prov.name}, raised by ${c.name}.`,ph,'hire');
          // Newly-mustered units join the destination character's column — recompute their pace (a
          // slow recruit can only reduce it), preserving points already spent. Garrison musters
          // don't march.
          if(!_destGarrison && _destChar) refreshMovePool(turnContext,_destChar);
        } else {
          log('system',`${c.name}'s recruitment in ${prov.name} was entirely blocked: ${blocked.join('; ')}.`,{actor:c.player,targets:[c.player]});
        }
        break;
      }
      case 'hire':{
        // resolve the hero by id, not by array position (defensive — the id==index invariant holds
        // today, but a positional lookup would silently hire the WRONG hero if it ever broke).
        const heroId=parseInt(target);const h=Number.isInteger(heroId)?((G.characters||[]).find(x=>x&&x.id===heroId)||null):null;
        if(!h||h.player!==null||h.location!==c.location){log('hire',`${c.name} tries to hire a hero but none matching that description are available in ${prov.name}.`,{actor:c.player,targets:[c.player]});break;}
        if(h._isNeutralGuard){log('hire',`${h.name} is sworn to defend ${prov.name} and will not abandon their post — the guardian of a neutral province cannot be hired away. You must defeat them in battle to take the province.`,{actor:c.player,targets:[c.player]});break;}
        if(h._justDefeated){log('hire',`${h.name} is furious at being driven from their home — they refuse to work with you this turn. Try again next turn.`,{actor:c.player,targets:[c.player]});break;}
        if(h._releasedTurn===G.turn){log('hire',`${h.name} was only just released from service and will hear no offers this turn. Try again next turn.`,{actor:c.player,targets:[c.player]});break;}
        // ── Alignment-distance wages ── replaces the old race-based 2g/3g system. Wage = 2g + 1g
        // per 2 steps between the hero's alignment and the hiring KINGDOM's alignment on the
        // Divine…Undead spectrum. Divine realms cannot hire Undead heroes and vice versa (distance
        // 6) — unless sd31 Diplomatic Protocols waives the ban (at 5g).
        const kingdomAlign=G.players[c.player]?.alignment||'Neutral';
        const _waiveBan=hasDisc(turnContext,c.player,'sd31');
        const hireWage=h.player===null?heroHireWage(kingdomAlign,h.alignment,_waiveBan,h):(h.pay||1);
        if(hireWage==null){
          log('hire',`${h.name} (${h.alignment}) recoils from ${c.name}'s offer — ${kingdomAlign==='Divine'?'no creature of the grave will serve a Divine crown':'the faithful will never serve an Undead throne'}. (Alignment gulf too wide: Divine and Undead cannot hire one another.)`,{actor:c.player,targets:[c.player]});
          break;
        }
        if((player.gold||0)<hireWage){log('hire',`${c.name} cannot afford to hire ${h.name} — needs ${hireWage}g/turn, treasury has only ${player.gold}g.`,{actor:c.player,targets:[c.player]});break;}
        h.pay=hireWage;
        // remember the ALIGNMENT part of the bargain (wage minus the skill premium). recalcHeroPay
        // rebuilds the wage from skills whenever the hero improves in service, and without this the
        // alignment premium a Divine crown paid for an Undead sword would vanish on their first
        // skill rise.
        h._hireAlignWage=Math.max(1, hireWage-heroSkillWage(h));
        player.gold-=hireWage;h.player=c.player;h.name=h.name.replace(' (wandering)','');
        if(h.race==='Dwarven'&&G.players[c.player]?.race==='Dwarven') grantMithrilTo(h, G); // mithril on hire into a dwarf realm
        player.heroes=(player.heroes||[]);player.heroes.push(h.id);
        // Hero can receive orders starting the phase AFTER they were hired (AK 3.5) We mark the
        // hire phase so the turn report knows which phases they can act in
        h.hiredInPhase=ph;
        if(!G.turnOrders[h.id])G.turnOrders[h.id]=[null,null,null,null,null];
        // Default unfilled phases (before hire) to a "not yet hired" placeholder
        for(let p2=0;p2<=ph;p2++) G.turnOrders[h.id][p2]=G.turnOrders[h.id][p2]||{action:'defend',target:'',extra:'',desc:'(not yet hired)'};
        // ── 2026-09-21: the hirer's pre-written orders are applied HERE, now the hire has landed.
        // (2026-09-23: moved into landHirePreOrders so the Neutral BROKER hire applies them too.)
        landHirePreOrders(h, c, ph, player);
        setMovePool(turnContext,h); // give the newly hired hero a movement pool for this turn (item: hired heroes had 0 MP)
        const _aDist=alignDistP(kingdomAlign,h.alignment);
        // Both hire paths now say which it is.
        const _hActs=`They may act from ${SEASONS[ph+1]||'next turn'} onwards.`;
        const _hireLine=`${h.name} (${h.race}, ${h.alignment}) agrees to serve ${player.name} for ${h.pay}g/turn (${_aDist===0?'kindred spirits — base rate':_aDist<=1?'close in outlook — base rate':`${_aDist} steps across the alignment spectrum`}). Skills: ${Object.entries(h.skills||{}).filter(([,v])=>v>0).map(([k,v])=>`${SKILL_LABELS[k]||k} ${v}`).join(', ')||'none yet'}. ${_hActs}`;
        log('hire',_hireLine,{actor:c.player,targets:[c.player],provinceId:prov.id});
        // also file the same line under the HIRED hero's own Chronicle section, at the hire phase,
        // so their section opens by explaining when and how they entered service.
        log('hire',_hireLine,{actor:c.player,targets:[c.player],provinceId:prov.id,charId:h.id,phase:ph});
        break;
      }
      case 'spy':{
        const hasCrystalOrb=activeItems(c).some(it=>it.effect?.stat==='oracle');
        // sd21 Forgery Arts: +15% spy success chance
        const targetProvForSpy=G.world.provinces[parseInt(target)];
        // spy / counterSpy discoveries — optionally scoped to the TARGET province's terrain, to coastal
        // ground or (counterSpy) to the defender's capital. sd21 / sd19 are now ordinary effects.
        const _spyProv=String(target||'').startsWith('char:')?prov:(targetProvForSpy||prov);
        const _spyScope=(e,ownerPi)=>(!e.terrains||(_spyProv&&e.terrains.includes(_spyProv.terrain)))&&(!e.coastal||(_spyProv&&provIsCoastal(G,_spyProv)))&&(!e.home||(_spyProv&&ownerPi!=null&&homeFounderOf(G,_spyProv.id)===ownerPi));
        const spyBonus=discSum(turnContext,c.player,'spy','pct',e=>_spyScope(e,null)); // spy discoveries
        const cipherPenalty=((targetProvForSpy&&targetProvForSpy.owner!==null&&targetProvForSpy.owner!==c.player)?discSum(turnContext,targetProvForSpy.owner,'counterSpy','pct',e=>_spyScope(e,targetProvForSpy.owner)):0); // counterSpy discoveries
        // ── Item 10: SPY ON A CHARACTER ── target 'char:<id>' names a non-own character standing
        // in the same province. Success 25% +10%/Spy level (Master Spy / Crystal Orb: automatic)
        // reveals every skill level, every magic item and every army unit they lead. Success or
        // not, the spy may be CAUGHT: 20% +10%/target Spy −10%/own Spy, +15% in the target realm's
        // own land,
        // −15% in this realm's own land (clamped 5–95; The Shadow is never caught). Caught → a personal
        // combat, unless the target's Encounter Plan stance is Refuse (same scuffle as a caught
        // thief).
        if(String(target||'').startsWith('char:')){
          const _tid=String(target).slice(5);
          const _tgt=(G.characters||[]).find(x=>x&&String(x.id)===_tid&&x.alive);
          if(!_tgt||_tgt.location!==c.location||_tgt.player===c.player){
            log('system',`${c.name} looks for ${_tgt?_tgt.name:'their quarry'} in ${prov.name}, but they are not to be found here — the spying comes to nothing.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
          if(activeItems(_tgt).some(it=>it&&it.effect&&it.effect.stat==='hidden')){
            log('system',`${c.name} shadows ${_tgt.name} through ${prov.name}, but can never quite fix on a face — nothing is learned. (Cloak of Many Faces)`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
          const _mySpy=effStat(turnContext,c,'spy'), _tgSpy=effStat(turnContext,_tgt,'spy');
          const _masterSpy=perkTier(c,'spy')>0;
          const _auto=hasCrystalOrb||_masterSpy;
          const _chance=Math.max(5,Math.min(95,dispFloor((0.25+0.10*_mySpy+spyBonus+discSum(turnContext,c.player,'spyChar','pct',e=>_spyScope(e,null)))*100))); // + spyChar discoveries (optionally scoped to where it happens)
          const _roll=d100();
          const _ok=_auto||_roll<=_chance;
          log('system',`📊 Spy on ${_tgt.name} — ${c.name} (Spy ${_mySpy}) in ${prov.name}: ${_auto?`automatic success (${hasCrystalOrb?'Crystal Orb':'Master Spy'})`:fmtRoll(_chance,_roll)}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          if(_ok){
            TM(c).spyActions=(TM(c).spyActions||0)+1; // TITLE MERIT: Spymaster
            noteEspionage(G, c, prov.id, 'read one of your heroes');
            trySkillGain(turnContext,c,'spy',SKILLGAIN_STD);
            const _ap=G.players[c.player];
            // 2026-10-15 (Toby, D2/D9): every skill, the magic items carried and the army units led, kept for
            // the report's hero sightings — for a wandering hero or a local chieftain as for a rival's hero.
            if(_ap){ _ap._spiedHeroSkills=_ap._spiedHeroSkills||{}; _ap._spiedHeroSkills[_tgt.id]={name:_tgt.name,isKing:!!_tgt.isKing,alignment:_tgt.alignment||null,race:_tgt.race||null,kingdom:(_tgt.player!=null)?(G.players[_tgt.player]?.name||null):null,skills:{...(_tgt.skills||{})},
              items:(_tgt.items||[]).map(it=>it&&it.name).filter(Boolean), armies:(_tgt.armies||[]).map(a=>({type:a.type,quality:a.quality,unitName:a.unitName||''})), turn:G.turn}; }
            const _sk=Object.entries(_tgt.skills||{}).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${SKILL_LABELS[k]||k} ${v}`).join(', ')||'no skills to speak of';
            const _it=(_tgt.items||[]).map(it=>it.name).join(', ')||'no magic items';
            const _ar=(_tgt.armies||[]).length?describeArmy(_tgt.armies):'no armies';
            log('spy',`[Intelligence] 🔍 ${c.name}'s report on ${_tgt.name}${_tgt.player!=null?` of ${G.players[_tgt.player]?.name}`:''} (${_tgt.race||'?'}, ${_tgt.alignment||'?'}${_tgt.isKing?', king':''}): skills — ${_sk}. Items — ${_it}. Leads — ${_ar}.`,{actor:c.player,targets:[c.player],provinceId:prov.id,spy:true});
          } else {
            log('system',`${c.name} watches ${_tgt.name} closely in ${prov.name}, but learns nothing of use.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            trySkillGain(turnContext,c,'spy',SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn
          }
          // Caught?
          if(!charMinor(turnContext,c,'shadow')){
            let _catch=20+10*_tgSpy-10*_mySpy;
            const _tgRealmLand=(_tgt.player!=null&&prov.owner===_tgt.player), _myLand=(prov.owner===c.player);
            if(_tgRealmLand) _catch+=15; if(_myLand) _catch-=15;
            if(_tgt.player!=null) _catch+=discSum(turnContext,_tgt.player,'catchSpy','pct',e=>_spyScope(e,_tgt.player)); // catchSpy discoveries (sd63 Informer Rewards)
            _catch=Math.max(5,Math.min(95,_catch));
            const _cr=d100();
            log('system',`📊 Detection — ${_tgt.name}${statNote(turnContext,c.player,_tgt,'spy')} noticing ${c.name}${_tgRealmLand?' in their own land':_myLand?' in your land':''}: ${oddsNote(turnContext,c.player,_tgt,_catch,_cr)}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            if(_cr<=_catch){
              if(_tgt.player!=null) log('system',`[Intelligence] ${c.name}${c.player!=null?` (${G.players[c.player]?.name})`:''} was caught spying on ${_tgt.name} in ${prov.name}.`,{actor:c.player,targets:[_tgt.player],provinceId:prov.id,charId:_tgt.id});
              thiefCaughtScuffle(c,_tgt,'spying on them');
            }
          } else log('system',`${c.name} slips away unseen. (The Shadow)`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          break;
        }
        // LEVEL 6+ SKILL PERK — Master Spy: at Spy 6+, espionage never fails (as the Crystal Orb).
        const masterSpy=perkTier(c,'spy')>0;
        // Disguise is decided fresh for EVERY spy order — the flag lives on the character record
        // and persists in the save, so leaving it set once made a spy invisible for the rest of the
        // game.
        c._spyDisguised=false;
        if(charMinor(turnContext,c,'shadow')) c._spyDisguised=true; // MINOR TITLE — The Shadow: spies never detected
        // show the spy's success chance and the actual roll (previously neither was reported).
        const _spyChance=dispFloor((0.2+effStat(turnContext,c,'spy')*0.2+spyBonus-cipherPenalty)*100);
        const _autoSpy=hasCrystalOrb||masterSpy;
        const _spyRoll=d100();
        const success=_autoSpy||(_spyRoll<=_spyChance);
        log('system',`📊 Spy — ${c.name} (Spy ${effStat(turnContext,c,'spy')}) in ${prov.name}: ${_autoSpy?`automatic success (${hasCrystalOrb?'Crystal Orb':'Master Spy'})`:fmtRoll(_spyChance,_spyRoll)}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        // sd23 Disguise Techniques: 50% HARDER to be discovered — the counter-intelligence alert
        // that would otherwise always fire is turned aside half the time.
        if(success&&!c._spyDisguised&&hasDisc(turnContext,c.player,'sd23')){
          const _dgRoll=d100();
          const _dgPct=Math.round(discParam('sd23','pct',0.5)*100);
          if(_dgRoll<=_dgPct) c._spyDisguised=true;
          log('system',`📊 Disguise Techniques — ${c.name} works under a false face in ${prov.name}: ${fmtRoll(_dgPct,_dgRoll)} — ${c._spyDisguised?'the disguise holds; no alarm is raised.':'the disguise slips; the province\u2019s watch will report the intrusion.'}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        }
        if(success){
          TM(c).spyActions=(TM(c).spyActions||0)+1; // TITLE MERIT: Spymaster
          noteEspionage(G, c, prov.id, 'spied out the province');
          applySpySuccess(turnContext, c, prov);
        } else { log('system',`${c.name}'s espionage in ${prov.name} yields little — the attempt went undetected but nothing useful was learned.`,{actor:c.player,targets:[c.player]}); trySkillGain(turnContext,c,'spy',SKILLGAIN_COMMON); } // batch item 11: a failed attempt is a small chance to learn
        break;
      }
      // DIVINE — Consecrate: sanctify ONE owned province as the realm's holy heart.
      case 'consecrate':{
        if(!c.isKing){
          log('system',`${c.name} may pray, but only the anointed King can consecrate ground — the rite belongs to the crown alone.`,{actor:c.player,targets:[c.player]});break;}
        if(G.players[c.player]?.alignment!=='Divine'){
          log('system',`${c.name} kneels and prays, but the gods answer only Divine crowns — Consecration is not for this realm.`,{actor:c.player,targets:[c.player]});break;}
        if(prov.owner!==c.player){
          log('system',`${c.name}: only a province of your own realm can be consecrated — take and hold this land first.`,{actor:c.player,targets:[c.player]});break;}
        const _homeId=homeProvinceIdFor(G, c.player);
        const _homeAdj=new Set(_homeId!=null?getNeighborsP(G.world.provinces[_homeId],G.world.cols,G.world.rows,G.world.provinces).map(x=>x&&x.id).filter(x=>x!=null):[]);
        if(prov.id===_homeId||_homeAdj.has(prov.id)){
          log('system',`${c.name}: the crown's own hearth was anointed at the coronation — its grace already shelters the throne and the lands in its shadow. The gods charge their servants to carry the light OUTWARD: consecrate a province beyond the home marches.`,{actor:c.player,targets:[c.player]});break;}
        const _cList=consecratedIds(player);
        if(_cList.includes(prov.id)){
          log('system',`${prov.name} is already consecrated — the ground is holy and needs no second blessing.`,{actor:c.player,targets:[c.player]});break;}
        // holy ground must be spread across the realm — two consecrated provinces may not lie side
        // by side. Reject if any neighbour of this province is already consecrated.
        const _provAdjC=new Set(getNeighborsP(prov,G.world.cols,G.world.rows,G.world.provinces).map(x=>x&&x.id).filter(x=>x!=null));
        const _adjConsecId=_cList.find(id=>_provAdjC.has(id));
        if(_adjConsecId!=null){
          log('system',`${c.name}: ${prov.name} borders ${G.world.provinces[_adjConsecId]?.name||'already-hallowed ground'} — two consecrated provinces may not lie side by side. Carry the light to ground set apart from your other holy lands.`,{actor:c.player,targets:[c.player]});break;}
        // the crown may hold up to its WHITE skill level in consecrated provinces at once.
        const _cLimit=skillLevel(c,'white')+discSum(turnContext,c.player,'consecrate','cap',e=>skillLevel(c,'white')>=(e.minWhite||1)); // ad03 Holy Sites (+1; still needs White 1+)
        if(_cLimit<=0){
          log('system',`${c.name}: consecration flows from the White arts — learn White magic before you can sanctify ground.`,{actor:c.player,targets:[c.player]});break;}
        if(_cList.length>=_cLimit){
          log('system',`${c.name}: your White faith can sustain only ${_cLimit} consecrated province${_cLimit!==1?'s':''} at once (${_cList.map(id=>G.world.provinces[id]?.name).filter(Boolean).join(', ')||'—'}). One must be lost or captured before you can hallow ${prov.name}. (Raise your White skill to consecrate more.)`,{actor:c.player,targets:[c.player]});break;}
        _cList.push(prov.id);
        // 2026-10-15 (Toby, D8): no Hierophant merit — only a Divine king can consecrate, so it was a
        // creed-only route to a title. Bless Province, Holy Symbol and Resurrect still count.
        log('explore',`✨ ${c.name} consecrates ${prov.name}! Holy ground: +50% tax, defenders twice as likely to fight with fanatical zeal, Undead and Evil invaders fight at −15%, and your fallen can be restored only here — they rise in the nearest consecrated province, which then gives up its consecration. If it is captured the consecration breaks at once and the conquerors are emboldened. (${_cList.length}/${_cLimit} consecrated — set by your White skill; a consecrated province that is captured frees a slot.)`,{actor:c.player,targets:[c.player],provinceId:prov.id,public:true,env:true});
        break;
      }
      // GOOD — Call to Arms: the folk answer the king; a free Green garrison unit musters.
      case 'call_to_arms':{
        if(G.players[c.player]?.alignment!=='Good'){
          log('system',`${c.name}'s call goes unanswered — only the folk of a Good realm rise for their king unpaid.`,{actor:c.player,targets:[c.player]});break;}
        if(!c.isKing){
          log('system',`${c.name}: only the KING's voice carries the Call to Arms.`,{actor:c.player,targets:[c.player]});break;}
        if(player._calledToArmsTurn===G.turn){
          log('system',`${c.name}: the realm has already answered one Call to Arms this turn — the folk cannot muster twice in a season.`,{actor:c.player,targets:[c.player]});break;}
        const ctaProv=G.world.provinces[parseInt(target)];
        if(!ctaProv||ctaProv.owner!==c.player){
          log('system',`${c.name}: Call to Arms must name a province you control this phase.`,{actor:c.player,targets:[c.player]});break;}
        if(ctaProv.terrain==='sea'||(ctaProv.race||'').startsWith('Primal')){
          log('system',`${c.name}: only the humanoid folk of settled land answer a Call to Arms — ${ctaProv.name} has no villages to raise.`,{actor:c.player,targets:[c.player]});break;}
        // Elven Bowmen). Take the province's garrison type from its own pool; fall back to the
        // racial garrison, then a plain levy.
        const GARRISON_BY_RACE_CTA={Human:'Human Garrison',Elven:'Elven Garrison',Dwarven:'Dwarf Garrison',Orcish:'Orc Garrison'};
        const ctaType=(ctaProv.armyTypes||[]).find(t=>String(t).toLowerCase().includes('garrison'))
          || GARRISON_BY_RACE_CTA[ctaProv.race]
          || 'Human Garrison';
        ctaProv.garrisonArmies=ctaProv.garrisonArmies||[];
        const _ctaQ=(discEff(turnContext,c.player,'ctaQuality').filter(e=>e.pct==null||kcRng()<e.pct).map(e=>e.quality).find(q=>q&&QUALITY_TIERS.includes(q)))||'Green'; // ag05 Muster Rolls (a chance per muster)
        ctaProv.garrisonArmies.push({type:ctaType,quality:_ctaQ,race:ctaProv.race||'Human',unitName:armyUnitName(ctaType)});
        player._calledToArmsTurn=G.turn;
        log('hire',`📯 Call to Arms! The folk of ${ctaProv.name} answer their king — ${_ctaQ==='Green'?'a Green':'an '+_ctaQ} ${ctaType} joins the province garrison, free of wages this muster. (Once per turn.)`,{actor:c.player,targets:[c.player],provinceId:ctaProv.id}/* 2026-09-27 (Toby item 6): realm-private — never public */);
        break;
      }
      // NEUTRAL — Broker: money moves what armies cannot. Remote hire, or a paid remote spy.
      case 'broker':{
        if(G.players[c.player]?.alignment!=='Neutral'){
          log('system',`${c.name}: only a Neutral crown keeps the web of factors and go-betweens that Brokering requires.`,{actor:c.player,targets:[c.player]});break;}
        if(!c.isKing){
          log('system',`${c.name}: only the KING commands the realm's brokers.`,{actor:c.player,targets:[c.player]});break;}
        const _bk=(target||'').split(':');
        if(_bk[0]==='hire'){
          const bh=G.characters[parseInt(_bk[1])];
          const bhProv=bh?G.world.provinces[bh.location]:null;
          const _visible=bhProv&&(bhProv.owner===c.player||(bhProv.visitedBy||[]).includes(c.player));
          if(!bh||bh.player!==null||!bh.alive||bh._isNeutralGuard||bh._justDefeated||!_visible){
            log('hire',`${c.name}'s brokers find no such hero within reach of the realm's agents.`,{actor:c.player,targets:[c.player]});break;}
          if(bh._releasedTurn===G.turn){log('hire',`${bh.name} was only just released from service and will hear no offers this turn. Try again next turn.`,{actor:c.player,targets:[c.player]});break;} // same rule as Hire Hero
          const bWage=heroHireWage(G.players[c.player]?.alignment||'Neutral',bh.alignment,hasDisc(turnContext,c.player,'sd31'),bh);
          if(bWage==null){log('hire',`${bh.name} will not treat with your brokers — the alignment gulf is too wide.`,{actor:c.player,targets:[c.player]});break;}
          if((player.gold||0)<bWage){log('hire',`${c.name} cannot afford ${bh.name} — needs ${bWage}g/turn.`,{actor:c.player,targets:[c.player]});break;}
          bh.pay=bWage; player.gold-=bWage;
          bh.player=c.player; bh.name=bh.name.replace(' (wandering)','');
          // a brokered hire is a HIRE.
          if(bh.race==='Dwarven'&&G.players[c.player]?.race==='Dwarven') grantMithrilTo(bh, G); // mithril on hire into a dwarf realm
          player.heroes=(player.heroes||[]); player.heroes.push(bh.id);
          bh.hiredInPhase=ph;
          if(!G.turnOrders[bh.id])G.turnOrders[bh.id]=[null,null,null,null,null];
          for(let p2=0;p2<=ph;p2++) G.turnOrders[bh.id][p2]=G.turnOrders[bh.id][p2]||{action:'defend',target:'',extra:'',desc:'(not yet hired)'};
          landHirePreOrders(bh, c, ph, player); // 2026-09-23: the brokered hero's pre-written orders + plan
          setMovePool(turnContext,bh);
          const _bActs=`They may act from ${SEASONS[ph+1]||'next turn'} onwards, from where they stand.`;
          const _brokerLine=`🤝 Brokered: ${bh.name} (${bh.race}, ${bh.alignment}) in ${bhProv.name} accepts ${player.name}'s terms by courier — ${bWage}g/turn. ${_bActs}`;
          log('hire',_brokerLine,{actor:c.player,targets:[c.player],provinceId:bhProv.id});
          // mirror into the brokered hero's own Chronicle section at the hire phase.
          log('hire',_brokerLine,{actor:c.player,targets:[c.player],provinceId:bhProv.id,charId:bh.id,phase:ph});
        } else if(_bk[0]==='spy'){
          const sp2=G.world.provinces[parseInt(_bk[1])];
          const _seen=sp2&&(sp2.owner===c.player||(sp2.visitedBy||[]).includes(c.player)||(((sp2.exploredBy||{})[c.player])||0)>0);
          if(!sp2||!_seen){log('system',`${c.name}: your brokers can only reach provinces the realm has seen.`,{actor:c.player,targets:[c.player]});break;}
          if((player.gold||0)<2){log('system',`${c.name}: brokered intelligence costs 2g — the treasury cannot cover it.`,{actor:c.player,targets:[c.player]});break;}
          player.gold-=2;
          log('system',`🤝 ${c.name}'s brokers buy word from ${sp2.name} (2g).`,{actor:c.player,targets:[c.player]});
          applySpySuccess(turnContext, c, sp2);
        } else {
          log('system',`${c.name}: Broker requires a target — a hero to hire or a province to buy word from.`,{actor:c.player,targets:[c.player]});
        }
        break;
      }
      // DRUIDIC Awaken the Wild and EVIL Call from the Pit: REMOVED 2026-10-12 (Toby item 22 — they made Creatures
      // and Monsters too easy to come by). An order a save still holds from before is refused in plain words.
      case 'awaken_wild':
      case 'call_pit':{
        const _gone=action==='call_pit'?'Call from the Pit':'Awaken the Wild';
        log('system',`${c.name}: ${_gone} is no more — Creatures and Monsters now come only by recruiting them where they live.`,{actor:c.player,targets:[c.player]});
        break;
      }
      // UNDEAD — Harvest the Field: no spell, just the grim trade. One grave becomes one soldier.
      case 'harvest_field':{
        if(G.players[c.player]?.alignment!=='Undead'){
          log('system',`${c.name} has neither the craft nor the stomach for grave-harvesting — only Undead realms keep corpse-carters.`,{actor:c.player,targets:[c.player]});break;}
        const hGraves=prov.battleGraves||[];
        if(hGraves.length===0){
          log('system',`${c.name} walks the field of ${prov.name}, but there are no battlefield dead here to raise.`,{actor:c.player,targets:[c.player]});break;}
        const _hCost=Math.max(0,2+discSum(turnContext,c.player,'harvestCost','delta')); // az06 Corpse-Carters
        if((player.gold||0)<_hCost){
          log('system',`${c.name}: the corpse-carters and grave-wights want their ${_hCost}g — the treasury cannot pay.`,{actor:c.player,targets:[c.player]});break;}
        player.gold-=_hCost;
        const hGrave=takeBestGrave(prov); // the most experienced dead are worked first
        const _uTierH=gdActive(turnContext,c.player,'Undead'); // GRAND DESIGN — Undead
        const hSkel={type:hGrave.type,quality:(_uTierH?(KC_QUALITY_UP[hGrave.quality]||hGrave.quality):hGrave.quality),race:'Undead',_isSkeletal:true,
          unitName:`${hGrave.unitName||armyUnitName(hGrave.type)} (Skeletal)`};
        c.armies=(c.armies||[]); c.armies.push(hSkel);
        log('hire',`💀 Harvest the Field — ${c.name}'s carters work the graves of ${prov.name}: ${hSkel.unitName} (${hSkel.quality}) rises to serve, no magic required. (${_hCost}g; upkeep 1g/turn.)`,{actor:c.player,targets:[c.player],provinceId:prov.id,public:true});
        // Harvest the Field is the ONE way to raise the dead without any Necromancy — an Undead
        // realm's carters do it by hand. But a skeletal unit still needs a necromancer to hold it
        // together, so a raiser with no Necromancy is warned at once, while there is still time in
        // the turn to hand the unit to one. Without this the player would simply find it gone at
        // end of turn, having paid for it.
        if(effStat(turnContext,c,'necromancy')<1)
          log('hire',`⚠ ${c.name} has no Necromancy of their own — ${hSkel.unitName} will crumble to dust at the end of this turn unless it is handed to a character with at least Necromancy 1. The dead do not stand without a master, and a garrison is no master at all.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        resolveUnitGainInProvince(turnContext, c, prov, ph);
        break;
      }
      // ── RESEARCH ── the scholar's own order: a roll for a Sage discovery. Available to any
      // character with Sage 1+ (the player portal hides it below that; the engine re-checks). Does
      // NOT train the Sage skill unless a discovery is actually made.
      case 'research':{
        const sageRaw=skillLevel(c,'sage');
        if(sageRaw<1){log('system',`${c.name} pores over the archives, but without any Sage learning (Sage 1+) the pages mean nothing to them.`,{actor:c.player,targets:[c.player]});break;}
        const sageLevel=effStat(turnContext,c,'sage');
        // the order names a CATEGORY (target); blank/'any' = the whole eligible table. Item 11: the
        // Heroic and Special fields can no longer be named or seen — they are found only as an
        // unlooked-for side result of researching any other field (roll below).
        const _rcatRaw=(target||'').trim();
        let _rcat=RESEARCH_HIDDEN_CATS.has(_rcatRaw)?'':_rcatRaw;
        // 2026-09-23d (Toby): a field with nothing left to find — typically because another Sage of
        // this realm took its last discovery EARLIER THIS TURN — no longer wastes the order. The
        // study shifts to a random other field that still holds something for the realm; only when
        // every field is spent is the order refused. Decided BEFORE the chance is worked out, so a
        // field-scoped research bonus (az10's own-creed field) follows the field actually studied.
        { const _knownPre=new Set((player.discoveries||[]).map(d=>d.id));
          const _avPre=discAvailableFor(turnContext,c.player,_knownPre).filter(d=>!RESEARCH_HIDDEN_CATS.has(d.category));
          if(_rcat&&_rcat.toLowerCase()!=='any'&&!_avPre.some(d=>(d.category||'').toLowerCase()===_rcat.toLowerCase())){
            const _fields=[...new Set(_avPre.map(d=>d.category).filter(Boolean))];
            if(!_fields.length){ log('system',`${c.name}: every ${_rcat} discovery has already been made, set aside, or is awaiting your choice — and so has every other field your realm can study. There is nothing left to research.`,{actor:c.player,targets:[c.player]}); break; }
            const _to=_fields[Math.floor(kcRng()*_fields.length)];
            log('system',`📚 ${c.name} finds the ${_rcat} archives already spent — every ${_rcat} discovery has been made, set aside, or is awaiting your choice — and turns instead to ${_to}.`,{actor:c.player,targets:[c.player]});
            _rcat=_to;
          } }
        // Neutral alignment: double sage discovery chance (pragmatic scholars)
        const neutralSageBonus=G.players[c.player]?.alignment==='Neutral'?sageLevel*5:0;
        const perLevel=5;
        // The discovery-chance benefit CAPS at level 5 (via effStat); levels 6+ grant the Sage's
        // distinct mastery orders instead of a further per-level climb.
        const _discBase=sageLevel*perLevel+neutralSageBonus+(charMinor(turnContext,c,'loreseeker')?perLevel:0)+discSum(turnContext,c.player,'research','pct',e=>!e.field||(e.field==='own'&&String(_rcat||'').trim().toLowerCase()===String((player.alignment||'')+' Creed').toLowerCase())); // + Loreseeker; research discoveries (az10: own creed field only — the field actually studied)
        // 2026-10-13 (Toby, item 18): PERSEVERANCE, as Practice has it — every Research order of this
        // hero that has failed earlier this turn makes this one ×1.2 likelier, cumulatively. A
        // discovery (the hidden-field find included) resets it; each turn starts afresh.
        const _rStreak=(c._researchFailStreak&&c._researchFailStreak.turn===G.turn)?c._researchFailStreak.n:0;
        const _rPersevere=Math.pow(1.2,_rStreak);
        const discoveryChance=Math.min(100,dispFloor(_discBase*_rPersevere));
        const _catFilter=(d)=>!RESEARCH_HIDDEN_CATS.has(d.category)&&(!_rcat||_rcat.toLowerCase()==='any'||(d.category||'').toLowerCase()===_rcat.toLowerCase());
        // the HIDDEN-FIELD roll is made FIRST and, when it lands, it is the discovery this research
        // yields — an unlooked-for find INSTEAD of the ordinary one, never as well as it. Half the
        // discovery chance, as before.
        let _sideFound=false;
        // THE HIDDEN FIELDS GROW RARER. Was half the ordinary discovery chance, which put a Neutral
        // Sage 5 holding the Loreseeker at 27% a turn for a Heroic or Special find — eight of them,
        // so a scholar-realm swept the hidden table in a dozen turns. Now a FIFTH of the ordinary
        // chance, hard-capped at 10%: an ordinary Sage 5 rolls 5%, and no stack of Neutral doubling
        // and title bonuses can push it past one in ten.
        { const _sRoll=d100(); const _sChance=Math.max(1,Math.min(HIDDEN_DISCOVERY_CAP_PCT,Math.floor(discoveryChance/HIDDEN_DISCOVERY_DIVISOR)));
          if(_sRoll<=_sChance){
            if(!player.discoveries) player.discoveries=[];
            const _known2=new Set(player.discoveries.map(d=>d.id));
            const _side=discAvailableFor(turnContext,c.player,_known2).filter(d=>RESEARCH_HIDDEN_CATS.has(d.category));
            if(_side.length>0){
              const disc=_side[Math.floor(kcRng()*_side.length)];
              player.discoveries.push({id:disc.id,name:disc.name,category:disc.category,desc:disc.desc,turnDiscovered:G.turn}); TM(c).discoveries+=1;
              if(perkTier(c,'sage')>0){ player.gold=(player.gold||0)+5; }
              if(perkTier(c,'sage')>=3){ const _sp=provOf(turnContext,c); if(_sp&&_sp.owner===c.player){ const _sb=_sp.tax||0; _sp.tax=Math.min(10,_sb+1); } }
              log('explore',`💡 An unlooked-for find! Among the pages ${c.name} was not even studying, **${disc.name}** (${disc.category}) comes to light — and the ordinary course of study is set aside for it. ${disc.desc}`,{actor:c.player,targets:[c.player]});
              trySkillGain(turnContext,c,'sage',SKILLGAIN_STD);
              _sideFound=true; c._researchFailStreak={turn:G.turn,n:0}; // a find resets Perseverance (item 18)
            }
          } }
        if(_sideFound) break; // one discovery per Research order
        const dRoll=d100();
        log('system',`📊 Research${_rcat&&_rcat.toLowerCase()!=='any'?` (${_rcat})`:''} — Sage discovery roll: ${discoveryChance}% chance (Sage level ${sageLevel}${neutralSageBonus>0?', Neutral ×2':''}${_rStreak>0?` ×${_rPersevere.toFixed(2)} for ${_rStreak} earlier failed Research${_rStreak!==1?' orders':''} this turn`:''}) — roll ${dRoll} — ${dRoll<=discoveryChance?'✓ Success!':'✗ No discovery this turn.'}`,{actor:c.player,targets:[c.player]});
        c._researchFailStreak={turn:G.turn,n:dRoll<=discoveryChance?0:_rStreak+1}; // item 18: the next Research this turn is ×1.2 likelier after a failure
        if(dRoll<=discoveryChance){
          if(!player.discoveries) player.discoveries=[];
          const known=new Set(player.discoveries.map(d=>d.id));
          const available=discAvailableFor(turnContext, c.player, known).filter(_catFilter); // race/alignment eligibility; category
          if(available.length>=2){
            // RESEARCH CHOICE: two finds, one to keep next turn (see discBlockedIds)
            const _i1=Math.floor(kcRng()*available.length);
            let _i2=Math.floor(kcRng()*(available.length-1)); if(_i2>=_i1) _i2++;
            const d1=available[_i1], d2=available[_i2];
            player.pendingDiscoveryChoices=player.pendingDiscoveryChoices||[];
            player.pendingDiscoveryChoices.push({key:`rc${G.turn}_${c.id}_${ph}`,turn:G.turn,charId:c.id,charName:c.name,category:(_rcat&&_rcat.toLowerCase()!=='any')?_rcat:'',options:[d1.id,d2.id]});
            TM(c).discoveries+=1; // TITLE MERIT: Loremaster — the deed is the research, whichever is kept
            if(perkTier(c,'sage')>0){ player.gold=(player.gold||0)+5; } // SAGE L6: +5g per new discovery
            if(perkTier(c,'sage')>=3){ const _sp=provOf(turnContext,c); if(_sp&&_sp.owner===c.player){ const _sb=_sp.tax||0; _sp.tax=Math.min(10,_sb+1); } } // SAGE L8
            log('explore',`💡 ${c.name}'s research bears fruit — two discoveries come to light: **${d1.name}** (${d1.category}) and **${d2.name}** (${d2.category}). Only one can be pursued: choose which to keep in next turn's orders (the 💡 Research box just under the Realm section). The other will be lost for good.`,{actor:c.player,targets:[c.player]});
            trySkillGain(turnContext,c,'sage',SKILLGAIN_STD); // Sage: made a discovery
          } else if(available.length>0){
            const disc=available[Math.floor(kcRng()*available.length)];
            player.discoveries.push({id:disc.id,name:disc.name,category:disc.category,desc:disc.desc,turnDiscovered:G.turn}); TM(c).discoveries+=1; // TITLE MERIT: Loremaster
            if(perkTier(c,'sage')>0){ player.gold=(player.gold||0)+5; } // SAGE L6: +5g per new discovery
            if(perkTier(c,'sage')>=3){ const _sp=provOf(turnContext,c); if(_sp&&_sp.owner===c.player){ const _sb=_sp.tax||0; _sp.tax=Math.min(10,_sb+1); } } // SAGE L8 (2026-09-27, Toby item 4): +1 tax (max 10) to the province you are in — was +2
            log('explore',`💡 ${c.name}'s research bears fruit! **${disc.name}** (${disc.category}) discovered — the last discovery this field still holds for your realm, so there is nothing to choose between. ${disc.desc}`,{actor:c.player,targets:[c.player]});
            trySkillGain(turnContext,c,'sage',SKILLGAIN_STD); // Sage: made a discovery
          } else {
            log('system',`${c.name} researches diligently — the roll succeeded but all known discoveries have already been made by your realm.`,{actor:c.player,targets:[c.player]});
          }
        } else {
          log('system',`${c.name} researches hard but makes no new discovery this turn.`,{actor:c.player,targets:[c.player]});
          trySkillGain(turnContext,c,'sage',SKILLGAIN_COMMON); // 2026-09-21 (Toby): even a fruitless season in the archives teaches a little
        }
        break;
      }
      case 'practice':{
        const skill=target;if(!skill)break;
        // Read skill levels frozen at the START of this phase (see G._phaseSkillSnapshot) so that
        // group-training comparisons are all made before anyone has trained up this phase.
        const _snap=(G._phaseSkillSnapshot||{});
        // The snapshot is a copy of each character's skills object at phase start. A skill the
        // character had at level 0 is usually ABSENT from that object — it must still read as 0,
        // never fall through to the LIVE value. (The old fallback meant two level-0 characters
        // co-training the same new skill cascaded: the first to succeed instantly became a "more
        // skilled mentor" for the second, guaranteeing a second success in the same phase.)
        const snapLvl=(ch)=>{ const snap=_snap[ch.id]; if(snap) return snap[skill]||0; return (ch.skills||{})[skill]||0; };
        const current=snapLvl(c);
        // Sept 2026: the Sage discovery roll no longer rides on Practice — it is its own order,
        // RESEARCH (case 'research' below), open to any character with Sage 1+. Practising Sage is
        // now an ordinary practice: a chance to level the skill, nothing more. Mastery: no further
        // levels to gain, but the discovery roll above has already happened. Sept 2026 (bot
        // strategy batch): a maxed (5) skill no longer BREAKS out of the case — it skips the level
        // roll but still falls through to the unit-drilling block below, so a Tactical-5 / Naval-5
        // general practising their command skill drills their troops.
        const _practiceMaxed=current>=5;
        if(_practiceMaxed){log('system',`${c.name} has trained ${SKILL_LABELS[skill]||skill} as far as drilling can take them (level 5). Higher mastery (levels 6–9) is won only through experience in the field, never the practice ground.`,{actor:c.player,targets:[c.player]});}
        if(!_practiceMaxed){

        // Group training bonus: find all other characters in the same province who are also
        // practising the same skill in this same phase Find co-trainers: same province, same phase,
        // same skill Orders may be stored as 'practice', 'Practice Skill', etc — normalise
        const coTrainers=(G.characters||[]).filter(other=>{
          if(!other.alive||other.id===c.id||other.location!==c.location) return false;
          // Only FRIENDLY characters train together: an enemy (or neutral wanderer) drilling in the
          // same province is no mentor and no training partner — soldiers do not share their drills
          // with the other side's officers.
          if(other.player!==c.player) return false;
          const otherOrder=(G.turnOrders[other.id]||[])[ph];
          if(!otherOrder) return false;
          const otherAction=(otherOrder.action||'').toLowerCase().replace(/[^a-z]/g,'');
          const isPractice=otherAction==='practice'||otherAction==='practiceskill'||otherAction==='practiceability';
          if(!isPractice) return false;
          const otherSkill=(otherOrder.target||'').toLowerCase().trim();
          return otherSkill===skill.toLowerCase();
        });

        // Base practice chance now DECREASES as the character's current level rises — mastery is
        // progressively harder to attain. These are the solo base rates; the peer group bonus
        // (half the solo chance) and the guaranteed-success mentor rule below apply on top.
        const PRACTICE_BASE_BY_LEVEL=[0.25,0.20,0.15,0.10,0.05]; // level 0→25% … level 4→5%
        const baseByLevel=PRACTICE_BASE_BY_LEVEL[Math.min(current,4)];
        const astroBonus=discSum(turnContext,c.player,'practice','pct',e=>!e.skills||e.skills.includes(skill)); // practice discoveries (sd26 Astronomical Tables is one)
        // perseverance. Each FAILED practice this turn multiplies the character's next practice
        // chance by 1.2 (cumulative); a success resets it. The streak is per character, any skill,
        // and starts fresh each turn.
        const _streak=(c._practiceFailStreak&&c._practiceFailStreak.turn===G.turn)?c._practiceFailStreak.n:0;
        const _persevere=Math.pow(1.2,_streak);
        // 2026-10-14 (batch item 10, Toby): QUICK LEARNERS on the Practice ground too — a Human of a
        // Human realm practises at ×1.5, as they learn in the field (trySkillGain).
        const _prHuman=(c.race==='Human'&&G.players[c.player]&&G.players[c.player].race==='Human')?1.5:1;
        const soloChance=(baseByLevel+astroBonus)*_persevere*_prHuman; // this character's normal (solo) chance to improve
        // Mentor rule: if any co-trainer had a HIGHER level in this skill AT PHASE START, they
        // teach the character — the improvement is automatic (guaranteed). Levels are read from the
        // start-of-phase snapshot, so a peer who trained up earlier this phase is NOT a mentor.
        const mentors=coTrainers.filter(t=>snapLvl(t) > current);
        // Peers: co-trainers at the SAME start-of-phase level (they justify the group bonus).
        const peers=coTrainers.filter(t=>snapLvl(t) === current);
        // the characters THIS one mentors (lower start-of-phase level) are named in this
        // character's own line, mirroring the trainee's 'trained by' note.
        const pupils=coTrainers.filter(t=>snapLvl(t) < current);
        const pupilNote=pupils.length?` — trains ${pupils.map(t=>`${t.name} (${SKILL_LABELS[skill]||skill} ${snapLvl(t)})`).join(' & ')} in ${SKILL_LABELS[skill]||skill}`:'';
        let successChance, bonusReason;
        if(mentors.length>0){
          successChance=1.0; // guaranteed — learning from a more skilled mentor
          const bestMentor=mentors.reduce((a,b)=>snapLvl(b)>snapLvl(a)?b:a);
          bonusReason=` — trained by ${bestMentor.name} (${SKILL_LABELS[skill]||skill} ${snapLvl(bestMentor)}), a more skilled mentor`;
        } else if(peers.length>0){
          // Group practice among equals — the shared drilling adds a bonus equal to HALF each
          // character's normal chance of improving (i.e. total = 1.5× the solo chance).
          successChance=soloChance*1.5;
          bonusReason=` — practising alongside ${peers.map(t=>t.name).join(' & ')} (base ${dispFloor(baseByLevel*100)}% at level ${current}, +50% group bonus)`;
          if(astroBonus>0) bonusReason+=' incl. Astronomical Tables';
        } else {
          successChance=soloChance; // solo practice (or only lower-skilled trainees present)
          bonusReason=` (base ${dispFloor(baseByLevel*100)}% at level ${current})`+(astroBonus>0?' +5% (Astronomical Tables)':'');
        }
        if(_streak>0&&successChance<1) bonusReason+=` ×${_persevere.toFixed(2)} for ${_streak} earlier failed practice${_streak!==1?'s':''} this turn`;
        if(_prHuman>1&&successChance<1) bonusReason+=' ×1.5 (Human: Quick Learners)';
            // roll a d100 and show the success chance and the roll, like every other action.
            const _prPct=dispFloor(successChance*100);
            const _prRoll=d100();
            if(_prRoll<=_prPct){
          c._practiceFailStreak={turn:G.turn,n:0}; // success resets the streak
          c.skills[skill]=(c.skills[skill]||0)+1;
          // a practice rise counts toward the same per-turn tally that dampens EXPERIENCE gains
          // (×0.8 per earlier rise of this skill this turn, see trySkillGain), so a skill drilled
          // up in phase 1 is proportionally harder to raise again in the field later on.
          if(!c._sgLog || c._sgLog.turn!==G.turn) c._sgLog={turn:G.turn, phaseNo:null, phaseSkills:{}, provSkills:{}, turnGains:{}, turnSkills:{}};
          c._sgLog.turnGains=c._sgLog.turnGains||{}; c._sgLog.turnGains[skill]=(c._sgLog.turnGains[skill]||0)+1;
          // 2026-09-26b (Toby item 7): a Practice rise IS this phase's one skill rise — it closes the phase
          // to experience gains and voids any field candidates already drawn up this phase.
          { const _gp=(turnContext._logCtx.phase!=null?turnContext._logCtx.phase:turnContext._currentPhase); (c._sgLog.gainedPhases||(c._sgLog.gainedPhases={}))[_gp]=true; if(c._sgPending&&c._sgPending.phase===_gp) c._sgPending=null; }
          const _prPayBefore=c.pay||0;
          recalcHeroPay(c);
          const _prPayAfter=c.pay||0;
          const _prHp=syncMaxHp(c,G.players);
          // a mentored improvement is guaranteed — no roll to show.
          log('hire',`${c.name} practises ${SKILL_LABELS[skill]||skill} and improves to level ${c.skills[skill]}${skillInPlayNote(turnContext,c,skill)}!${mentors.length>0?'':' '+fmtRoll(_prPct,_prRoll)}${bonusReason}${pupilNote}${_prHp>0?` (Max HP +${_prHp} → ${c.maxHp}.)`:''}`,{actor:c.player,targets:[c.player]});
          if(_prPayAfter>_prPayBefore) log('hire',`💰 ${c.name}'s growing renown raises their wage to ${_prPayAfter}g/turn (was ${_prPayBefore}g/turn).`,{actor:c.player,targets:[c.player]}); // 2026-09-21: practice raised the wage silently
        } else {
          c._practiceFailStreak={turn:G.turn,n:_streak+1}; // the next practice this turn is ×1.2 likelier
          log('system',`${c.name} practises ${SKILL_LABELS[skill]||skill} but makes no measurable progress this season. ${fmtRoll(_prPct,_prRoll)}${bonusReason?` ${bonusReason}.`:''}${pupilNote?` ${pupilNote.slice(3)}.`:''}`,{actor:c.player,targets:[c.player]});
        }

        } // end !_practiceMaxed
        // ── Unit drilling: Tactical trains LAND/AIR units, Naval trains SEA units ── Clean
        // complements: a mixed land+fleet stack now advances its foot & flyers by practising
        // Tactical and its ships & sea-beasts by practising Naval. (Previously Tactical trained
        // every unit including fleets, and Naval trained nothing — this splits the two by domain so
        // each skill improves the troops it actually commands in battle.) Local set (self-contained
        // to avoid any resolveTurn-scope hazard) — the naval units that benefit from the Naval
        // skill in a sea battle are exactly the ones Naval practice drills.
        const NAVAL_DRILL_TYPES=new Set(KC_UNIT_CLASS.sea);
        if(skill==='tactical'||skill==='naval'){
          const isNaval=skill==='naval';
          const drillLvl=c.skills[skill]||0;
          const tiers=QUALITY_TIERS.slice();
          const DRILL_BASE=UNIT_DRILL_BASE; // module level — the end-of-turn garrison drill reads the same table
          // Tactical drills land & air units; Naval drills sea units.
          const trainable=(c.armies||[]).filter(a=>!a._isSkeletal&&(isNaval?NAVAL_DRILL_TYPES.has(a.type):!NAVAL_DRILL_TYPES.has(a.type)));
          let trainedAny=false;
          trainable.forEach(army=>{
            if(army.quality==='Elite') return;
            const baseChance=(DRILL_BASE[army.quality]||0.03)*drillLvl*humanXPMult(army,c.player,G);
            if(kcRng()<baseChance){
              const idx=tiers.indexOf(army.quality);
              if(idx>=0&&idx<4){
                army.quality=tiers[idx+1];
                log('hire',`${c.name}'s ${isNaval?'Naval drills':'training drills'}: ${(army.unitName||army.type)} (${army.type}) advances to **${army.quality}**!`,{actor:c.player,targets:[c.player]});
                trainedAny=true;
              }
            }
          });
          if(trainedAny){
            // at least one promotion already logged above
          } else if(trainable.length>0){
            log('system',`${c.name}'s ${isNaval?'Naval drills were thorough but no crews':'training drills were thorough but no units'} achieved a breakthrough this season.`,{actor:c.player,targets:[c.player]});
          } else {
            log('system',isNaval
              ?`${c.name} drills Naval theory alone — commanding fleets or sea-beasts would yield greater benefit.`
              :`${c.name} practises Tactical theory alone — leading land armies would yield greater benefit.`,{actor:c.player,targets:[c.player]});
          }
        }
        break;
      }
      case 'equip_items':{
        // choose which slot items are worn/wielded. target = comma-separated item names (or ids) to
        // equip. Every slot item NOT named is unequipped; slot caps are enforced (first named
        // wins), and normaliseEquipment then fills any slot left empty with the first item held.
        const want=String(target||'').split(',').map(t=>t.trim()).filter(Boolean);
        const slotItems=(c.items||[]).filter(it=>it&&itemSlot(it));
        if(slotItems.length===0){log('system',`${c.name} carries nothing that can be worn or wielded.`,{actor:c.player,targets:[c.player]});break;}
        slotItems.forEach(it=>{it.equipped=false;});
        const cnt={}; const donned=[]; const refused=[];
        want.forEach(w=>{ const it=slotItems.find(x=>String(x.id)===w||x.name===w); if(!it) return; const sl=itemSlot(it);
          if((cnt[sl]||0)>=ITEM_SLOT_CAP[sl]){ refused.push(it.name); return; } it.equipped=true; cnt[sl]=(cnt[sl]||0)+1; donned.push(it.name); });
        normaliseEquipment(c);
        const worn=(c.items||[]).filter(it=>it&&itemSlot(it)&&it.equipped).map(it=>`${it.name} [${itemSlot(it)}]`);
        log('system',`\u{1F6E1} ${c.name} arms and dresses for the season — now wearing: ${worn.join(', ')||'nothing'}.${refused.length?` Could not also wear ${refused.join(', ')} (slot already filled).`:''}`,{actor:c.player,targets:[c.player]});
        break;
      }
      case 'use_item':{
        // Trigger an ACTIVE magic item (one that must be invoked, not a passive bonus).
        // 2026-09-24 (Toby): not while charmed. An enchanted mind fights with what it carries — its
        // passive magic works as ever — but will not be made to spend a treasure on a stranger's
        // errand. Refused here as well as hidden on the form, since `target` is matched by NAME and a
        // crafted order would otherwise let a charmer probe the pack by reading the result.
        if(isCharmedNow(G,c)){ log('system',`${c.name} will not spend what they carry at another's bidding — a mind held by enchantment keeps its treasures to itself.`,{actor:c.player,targets:[c.player],charId:c.id}); break; }
        const it=(c.items||[]).find(x=>String(x.id)===String(target)||x.name===target);
        if(!it){log('system',`${c.name}: no such item to use.`,{actor:c.player,targets:[c.player]});break;}
        if(it._spent){log('system',`The ${it.name} has already been used.`,{actor:c.player,targets:[c.player]});break;}
        const st=it.effect?.stat;
        if(st==='massPromote'){
          // ── PHILOSOPHER'S STONE ────
          // Once per game: promote EVERY unit of the realm one quality tier — those marching under
          // your commanders AND those standing in your garrisons. Skeletal armies are excluded; the
          // dead do not advance in experience.
          // BUG FIXED: the garrison sweep read `pv.garrison`, a field that does not exist — the
          // engine's unled units live in `pv.garrisonArmies` everywhere else. Garrison troops were
          // therefore NEVER promoted, and a realm whose strength sat in its garrisons could invoke
          // the Stone and see almost nothing happen.
          const UP={...KC_QUALITY_UP};
          const _promote=(arr)=>{ let k=0; (arr||[]).forEach(a=>{ if(a&&!a._isSkeletal&&UP[a.quality]&&UP[a.quality]!==a.quality){ a.quality=UP[a.quality]; k++; } }); return k; };
          let led=0, garr=0, already=0;
          const _count=(arr)=>(arr||[]).filter(a=>a&&!a._isSkeletal).length;
          let total=0;
          (G.characters||[]).filter(ch=>ch.alive&&ch.player===c.player).forEach(ch=>{ total+=_count(ch.armies); led+=_promote(ch.armies); });
          (G.world.provinces||[]).forEach(pv=>{ if(pv&&pv.owner===c.player){ total+=_count(pv.garrisonArmies); garr+=_promote(pv.garrisonArmies); } });
          const n=led+garr;
          already=total-n;
          // A once-per-game treasure is not spent on nothing: if there is not a single unit it
          // could raise, the Stone stays unused and the player is told why.
          if(n===0){
            log('system',`${c.name} raises the ${it.name}, but there is nothing for it to work on — ${total===0?'your realm has no armies in the field or in garrison':'every unit you command is already Elite'}. The Stone is NOT spent, and may be invoked another turn.`,{actor:c.player,targets:[c.player]});
            break;
          }
          // ── CONSUMED ── the Stone is not merely spent, it is GONE: the working destroys it.
          // Struck from the bearer's pack so it can never be used, sent, stolen, looted from a
          // corpse or equipped again, and its name stays on G._awardedItems (the permanent ledger
          // every item roll checks) so no lair can ever yield another.
          const _stoneName=it.name;
          c.items=(c.items||[]).filter(x=>x!==it&&String(x.id)!==String(it.id));
          syncMaxHp(c);   // an item leaving the pack can change derived stats; re-sync to be safe
          if(!Array.isArray(G._awardedItems)) G._awardedItems=[];
          if(!G._awardedItems.includes(_stoneName)) G._awardedItems.push(_stoneName);
          // Lair hoards are decided at world generation, so an unfound copy could still be lying in
          // the ground. The narrative below tells every realm the Stone is gone from the world for
          // good — so make that true: strike any undiscovered copy from every hoard as well. (A
          // copy already carried by a character is left alone; that one exists and was won.)
          let _purged=0;
          (G.world.provinces||[]).forEach(pv=>{ if(!pv) return;
            (pv.features||[]).forEach(f=>{ if(!f||!Array.isArray(f.hoardItems)) return;
              const before=f.hoardItems.length;
              f.hoardItems=f.hoardItems.filter(x=>!(x&&x.name===_stoneName));
              _purged+=before-f.hoardItems.length; }); });
          if(_purged>0) log('system',`(GM note: ${_purged} undiscovered ${_stoneName}${_purged!==1?'s were':' was'} struck from the world's lair hoards — the artefact is destroyed.)`,{actor:null,targets:[],gmOnly:true});
          G._destroyedItems=(G._destroyedItems||[]).concat([{name:_stoneName,turn:G.turn,by:c.name,player:c.player}]);
          const _parts=[`${led} marching under your commanders`,`${garr} in your garrisons`].filter((_,i)=>(i===0?led:garr)>0);
          // The owner's own account — what it did for them, and what it cost.
          log('explore',`✨ ${c.name} invokes the ${_stoneName} — a wave of power sweeps the realm and ${n} army unit${n!==1?'s':''} advance one quality tier (${_parts.join(', ')}${already>0?`; ${already} already Elite and unchanged`:''}). The Stone crumbles to grey dust in ${c.name}'s hands: its work is done, and there is not another in the world.`,{actor:c.player,targets:[c.player],provinceId:prov.id,charId:c.id});
          trySkillGain(turnContext,c,'sage',SKILLGAIN_COMMON); // 2026-09-21: using a magic item may teach Sage
          // ...and the whole world sees the sky change. Every realm is told, by name — an artefact
          // of this order leaving the world is news, and its loss is a fact all players should
          // know.
          (G.players||[]).forEach((_pl,_pi)=>{
            if(_pl==null) return;
            log('system',`🌍 A light passes over the world: somewhere in ${prov.name}, ${_pi===c.player?`your own ${c.name}`:`${G.players[c.player]?.name||'a distant realm'}`} has worked the ${_stoneName} and burned it out. Every soldier of that realm stands a little taller tonight — and the Stone itself is gone from the world for good. No lair will yield another.`,{actor:null,targets:[_pi],public:true});
          });
        } else {
          log('system',`The ${it.name} is a passive item and does not need to be used — its power is always active.`,{actor:c.player,targets:[c.player]});
        }
        break;
      }
      case 'rest':{
        const REST_HEAL_PCT=0.30;
        // sd28 Medical Arts: better healing on rest
        // Divine alignment: heroes heal MORE on a Rest (divine blessing). History: ×3 → ×2 (2026-09-11,
        // once the base became 30% of maximum HP and ×3 was near a full restore) → ×1.5 (2026-09-13,
        // "make it a multiplier, but only half of what it was" — the BONUS is halved, from +100% to
        // +50%, so the blessing stays a multiplier rather than becoming a flat addition). Rounded
        // UP, so the blessing is never worth nothing on a small pool.
        const isDivineKingdom=G.players[c.player]?.alignment==='Divine';
        const _medArts=hasDisc(turnContext,c.player,'sd28'); // Medical Arts: a single Rest fully restores HP
        const baseHeal=Math.max(1,Math.ceil((c.maxHp||20)*REST_HEAL_PCT)); // 30% of maximum HP (was 2–5)
        let heal=_medArts?Math.max(0,(c.maxHp||20)-c.hp):(isDivineKingdom?Math.ceil(baseHeal*1.5):baseHeal);
        if(charMinor(turnContext,c,'colossus')) heal+=2; // MINOR TITLE — The Colossus
        heal+=discSum(turnContext,c.player,'rest','hp',e=>(!e.owned||prov.owner===c.player)&&(!e.home||(prov.owner===c.player&&homeFounderOf(G,prov.id)===c.player))&&(!e.terrains||e.terrains.includes(prov.terrain))); // rest discoveries
        if(hasItemBase(c,'Iron Heart Talisman')) heal+=Math.round((c.maxHp||20)*0.10); // Iron Heart Talisman: +10% of max HP recovered
        c.hp=Math.min(c.maxHp||20,c.hp+heal);
        log('system',`${c.name} rests and recovers. +${heal} HP (${c.hp}/${c.maxHp}${isDivineKingdom?' — Divine blessing lifts healing by half':''}).`,{actor:c.player,targets:[c.player]});
        break;
      }
      case 'give_item':{
        // SEND ITEM (was Give Item). A character can hand over MORE THAN ONE
        // item at once (comma-separated indices, or "all"; splice high→low so indices stay aligned) to
        // ANY of the player's own living characters, wherever they stand:
        // • SAME province → delivered at once, usable later this turn (as before);
        // • DIFFERENT province → the items leave the sender NOW but travel by courier and ARRIVE with
        // the recipient at the END of the turn (queued on G._itemDeliveries), ready to use next turn.
        // the recipient is notified in THEIR own Chronicle section, this phase.
        // ── CHARMED HEROES SEND NOTHING, AND RECEIVE NOTHING ──────────────────────────────────────
        // 2026-09-12 refused Send Item outright for a charmed hero; 2026-09-18 relaxed it to ONE
        // engine-chosen item a turn; 2026-09-24 (Toby) settles it the other way for good, in both
        // directions. An enchanter borrows a mind for a season and gains no quartermaster: a charmed
        // hero will not hand their possessions to anyone, and will not be handed anything either. Both
        // checks live here rather than only on the order form, so a stale draft or a hand-crafted
        // submission cannot walk past them. The hero's own gear is untouched throughout.
        if(isCharmedNow(G,c)){ log('item',`${c.name} will part with nothing — a mind held by enchantment guards its own possessions, whatever it is bidden.`,{actor:c.player,targets:[c.player],charId:c.id}); break; }
        const recip=orderCharRef(G,extra); // a plain id, or a pre-order hero's synthetic id
        if(!recip){log('item',`${c.name}: cannot send item — no such recipient.`,{actor:c.player,targets:[c.player]});break;}
        if(isCharmedNow(G,recip)){log('item',`${c.name} keeps the items — ${recip.name} is held by a Charm, and an enchanted mind is trusted with nothing. Send them on once the hero serves you of their own will.`,{actor:c.player,targets:[c.player],charId:c.id});break;}
        if(isPreOrderRef(extra)&&(recip.player!==c.player||!recip.alive||recip._charmTempControl)){log('item',`${c.name} keeps the items — ${recip.name} is not in your service${recip.alive?'':' (they have fallen)'}: the hire, raising or charm did not land (or has not happened yet), so nothing is sent.`,{actor:c.player,targets:[c.player],charId:c.id});break;}
        if(recip.player!==c.player||!recip.alive){log('item',`${c.name}: items can only be sent to one of your own living characters.`,{actor:c.player,targets:[c.player]});break;}
        if(recip.id===c.id){log('item',`${c.name}: cannot send items to themselves.`,{actor:c.player,targets:[c.player]});break;}
        const _held=(c.items||[]);
        let idxs;
        if(String(target||'').trim().toLowerCase()==='all'){ idxs=_held.map((_,i)=>i); }
        else{
          // ── 2026-09-24 (Toby): a token may be a positional INDEX (as always) or an item ID / NAME ──
          // Send Item was index-only, and an index is only meaningful when the order form's list and
          // the engine's `c.items` are the same list in the same order. They are NOT for a PRE-ORDER
          // card: a hero being HIRED has a real pack the player has never seen, so the form's index 0
          // (the sword you sent them an hour ago) is some other item entirely at resolution — you
          // would send the wrong thing, chosen by an accident of ordering. Equip Items and Use Item
          // already addressed items by id-or-name for exactly this reason; Send Item now does too, so
          // the player form can name what it means whenever position cannot be trusted.
          // Backward compatible: a token that is a plain integer in range is still positional, so
          // every existing (and in-flight) order behaves identically. `String(n)===t` is what keeps a
          // name that merely STARTS with digits ("3 Rings of Dawn") out of the positional branch.
          const _toks=String(target||'').split(',').map(s=>s.trim()).filter(Boolean);
          idxs=_toks.map(t=>{
            const n=parseInt(t);
            if(Number.isInteger(n)&&String(n)===t&&n>=0&&n<_held.length) return n;
            return _held.findIndex(it=>it&&(String(it.id)===t||it.name===t));
          }).filter(n=>Number.isInteger(n)&&n>=0&&n<_held.length);
        }
        let uniq=[...new Set(idxs)].sort((a,b)=>b-a);
        // A granted Mithril suit is forged to its wearer and cannot be sent on.
        if(uniq.some(i=>isMithril(_held[i]))){
          uniq=uniq.filter(i=>!isMithril(_held[i]));
          log('item',`${c.name}: Mithril Armour is forged to its wearer and cannot be sent — it stays in their pack.`,{actor:c.player,targets:[c.player]});
        }
        if(uniq.length===0){log('item',`${c.name}: cannot send item.`,{actor:c.player,targets:[c.player]});break;}
        const given=[];
        uniq.forEach(i=>{ given.push(...c.items.splice(i,1)); }); applyItemMaxHp(c,null);
        const _names=given.map(it=>it.name).join(', ');
        const _sameProv=(recip.location===c.location);
        if(_sameProv){
          // Hand over now.
          recip.items=(recip.items||[]);
          given.forEach(item=>{ recip.items.push(item); applyItemMaxHp(recip,item); /* item 6 */ });
          log('hire',`${c.name} hands ${_names} to ${recip.name}.`,{actor:c.player,targets:[c.player],charId:c.id,phase:ph});
          // tell the recipient, in their own section.
          notifyTarget(turnContext,recip,`📦 ${recip.name} receives ${_names} from ${c.name}.`,ph);
          { const _gn=gainedItemNote(recip,given); if(_gn) notifyTarget(turnContext,recip,_gn,ph); } // item 10
        } else {
          // Dispatch by courier — arrives at end of turn (see the end-of-turn delivery flush).
          G._itemDeliveries=G._itemDeliveries||[];
          G._itemDeliveries.push({toId:recip.id, items:given, fromName:c.name});
          const _rProv=G.world.provinces[recip.location];
          log('hire',`${c.name} dispatches ${_names} by courier to ${recip.name} in ${_rProv?_rProv.name:'a distant province'} — it will arrive by turn's end.`,{actor:c.player,targets:[c.player],charId:c.id,phase:ph});
          // the recipient's send-phase "a courier is on the way" notice was removed — it duplicated
          // the end-of-turn delivery line (see the COURIER DELIVERIES flush), which already tells
          // the recipient the parcel arrived and is ready to use next turn. The sender still gets
          // the dispatch line above.
        }
        break;
      }
      case 'leave_army':{
        // a pre-order hero's synthetic id is a CHARACTER recipient — parseInt gave NaN, which fell
        // through to the garrison branch and quietly garrisoned the troops (2026-09-23).
        const _synRecip=isPreOrderRef(extra);
        const recipId=_synRecip?(((orderCharRef(G,extra)||{}).id)??-99):parseInt(extra);
        if((c.armies||[]).length===0){log('system',`${c.name}: no armies to transfer.`,{actor:c.player,targets:[c.player]});break;}
        // ── Validate the recipient BEFORE moving any troops ──
        const recip2=_synRecip?orderCharRef(G,extra):(recipId>=0?G.characters[recipId]:null);
        if(recipId>=0||_synRecip){
          // Transfer to another character: must be one of THIS player's own living characters,
          // standing in the same province. Never a neutral hero or another player's character.
          if(!recip2||!recip2.alive||recip2.player!==c.player||recip2.location!==c.location){
            // Name where they went: the commonest cause is a general on Defend who rode out to a
            // threatened neighbour at the top of the phase, before this transfer resolved.
            const _rp=(recip2&&recip2.alive&&recip2.player===c.player&&recip2.location!=null)?G.world.provinces[recip2.location]:null;
            log('system', _rp
              ? `${c.name} cannot hand the troops to ${recip2.name} — they had already marched on to ${_rp.name} before the column could be handed over. The troops stay under ${c.name}'s command.`
              : `${c.name} cannot transfer armies — the recipient must be one of your own characters standing in ${prov.name}.`,
              {actor:c.player,targets:[c.player],provinceId:prov.id});break;
          }
        } else {
          // Garrison: only allowed in a province the player actually controls.
          if(prov.owner!==c.player){
            log('system',`${c.name} cannot garrison armies in ${prov.name} — you do not control this province, so there is no garrison to leave them in. The troops stay under their command.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;
          }
        }
        const _leaveOrig=(c.armies||[]).slice(); // restored if the transfer would leave anyone unshipped at sea
        let removed=[];
        if(target==='all'){removed=[...c.armies];c.armies=[];}
        else{
          // Comma-separated list of army types to leave
          const targets=target.split(',').map(t=>t.trim()).filter(Boolean);
          targets.forEach(t=>{
            if(t==='all'){removed.push(...c.armies);c.armies=[];}
            else{const idx=c.armies.findIndex(a=>a.type===t||a.unitName===t);if(idx>=0)removed.push(...c.armies.splice(idx,1));}
          });
        }
        if(removed.length===0){log('system',`${c.name}: could not find specified armies to transfer.`,{actor:c.player,targets:[c.player]});break;}
        // 2026-09-23c (Toby): on open water nobody may be left unshipped — refuse a transfer that
        // leaves the giver's remaining column, or the recipient's, with too few hulls to carry it.
        if(isOpenSea(prov)){
          const _gShort=seaLiftShortfall(c.armies||[],c)>0;
          const _rShort=recip2?seaLiftShortfall((recip2.armies||[]).concat(removed),recip2)>0:false;
          if(_gShort||_rShort){
            c.armies=_leaveOrig;
            const _lbl=removed.map(a=>a.unitName||a.type).join(', ');
            log('system',`⚓ ${c.name} cannot ${recip2?`hand ${_lbl} to ${recip2.name}`:`leave ${_lbl} in ${prov.name}`} out on open water — ${_gShort?`the ships that stay would be too few to carry the rest of ${c.name}'s column`:`${recip2.name}'s ships could not carry them`}. The order is refused and the troops stay where they are.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            break;
          }
        }

        // (Move-pool recomputation after the transfer is handled by refreshMovePool below, which fully
        // recomputes land + sea pools and sea capability from the remaining force — superseding the
        // old partial sea-only un-stick. In particular a MIXED force that becomes all-flying after
        // a land army is peeled off regains its sea reach, and a force that sheds a slow unit
        // regains pace.)

        // Skeletal armies refuse to follow non-Undead commanders
        const recipIsUndead2=!recip2||(recip2.alignment==='Undead')||(recip2.player!==null&&G.players[recip2.player]?.alignment==='Undead');
        const skelTransfer=removed.filter(a=>a._isSkeletal);
        if(skelTransfer.length>0&&!recipIsUndead2){
          log('system',`💀 ${skelTransfer.map(a=>a.unitName||a.type).join(', ')} refuse to follow a non-Undead commander — they dig their own graves and go to sleep.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          removed=removed.filter(a=>!a._isSkeletal); // remove skeletal from transfer
          if(removed.length===0) break; // nothing left to transfer
        }

        // Item 24 (2026-10-12): beasts beyond the recipient's Druid stay with the giver.
        if(recip2){ let _room=beastCommandRoom(recip2,G.characters); const _stay=[];
          removed=removed.filter(a=>{ if(!beastCommandCount(a)) return true; if(_room>0){ _room--; return true; } _stay.push(a); return false; });
          if(_stay.length){ c.armies=(c.armies||[]).concat(_stay);
            log('hire',`🐾 ${beastCommandWords(recip2,G.characters)}: ${_stay.map(a=>a.unitName||a.type).join(', ')} ${_stay.length===1?'stays':'stay'} with ${c.name}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            if(!removed.length){ refreshMovePool(turnContext,c); break; } } }
        if(recip2){
          recip2.armies=(recip2.armies||[]).concat(removed);
          log('hire',`${c.name} transfers ${removed.map(a=>a.unitName||a.type).join(', ')} to ${recip2.name}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          // notify the receiving commander in their own section.
          notifyTarget(turnContext, recip2,`⚔ ${recip2.name} takes command of ${removed.map(a=>a.unitName||a.type).join(', ')}, handed over by ${c.name} in ${prov.name}.`,ph,'hire');
          // Recompute BOTH move pools for giver and recipient: the giver may now be faster (a slow
          // unit left) and the recipient may now be slower (a slow unit joined). refreshMovePool
          // preserves points already spent this turn, so neither refunds nor double-charges moves.
          refreshMovePool(turnContext,c); refreshMovePool(turnContext,recip2);
          break;
        }
        prov.garrisonArmies=(prov.garrisonArmies||[]).concat(removed);
        log('hire',`${c.name} garrisons ${removed.map(a=>a.type).join(', ')} in ${prov.name}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        // Recompute the move pool from the REMAINING force. Dropping a slow unit correctly frees up
        // the faster pace for the rest of the turn; dropping ALL armies gives foot-passage (land 5
        // / sea 5), which is why a hero who hands off his whole army can still march — including
        // onto the sea. Points already spent this turn are preserved.
        refreshMovePool(turnContext,c);
        if((c.armies||[]).length===0){
          log('move',`${c.name} left all armies behind in ${prov.name} — now travelling light (land ${movePoints[c.id]}, sea ${seaMovePoints[c.id]} move points).`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        }
        break;
      }
      case 'release':{
        // ── RELEASE HERO ── dismiss a hero from the realm's service. They become an ordinary
        // wandering hero (player===null, not a guard), keep every magic item they carry, keep their
        // skills/HP, and can be hired by anyone from NEXT turn (never re-hired the same turn they
        // were let go). Refused for kings and for a hero still leading any army — the troops must
        // be transferred, garrisoned or disbanded first. The hero's remaining orders this turn are
        // dropped.
        if(c.isKing){log('system',`${c.name} wears the crown — a king cannot release himself from his own service.`,{actor:c.player,targets:[c.player]});break;}
        if(c.player==null){break;}
        if((c.armies||[]).length>0){
          log('system',`${c.name} cannot be released while leading ${c.armies.length} unit${c.armies.length!==1?'s':''} — transfer, garrison or disband the troops first.`,{actor:c.player,targets:[c.player]});break;}
        const _relPi=c.player, _relPl=player;
        const _itemNote=(c.items||[]).length?` They take ${(c.items||[]).map(it=>it&&it.name).filter(Boolean).join(', ')} with them.`:'';
        if(_relPl){ _relPl.heroes=(_relPl.heroes||[]).filter(id=>id!==c.id); }
        noteServedRealm(c,c.player); // the releasing realm stays in their service history
        c.player=null; c._isNeutralGuard=false; delete c._isHeir; delete c.hiredInPhase; delete c._pursuit;
        c._releasedTurn=G.turn; c._releasedBy=_relPi;
        delete c._hireAlignWage; c.pay=Math.max(1,1+heroSkillWage(c)); // wandering default; the real asking price is rebuilt at the hire desk (alignment + skill premium)
        if(G.turnOrders[c.id]) for(let p2=ph+1;p2<5;p2++) G.turnOrders[c.id][p2]=null;
        log('hire',`🕊 ${c.name} is released from ${_relPl?_relPl.name:'the realm'}'s service in ${prov.name} and takes up the wanderer's life.${_itemNote} They may be hired again from next turn.`,{actor:_relPi,targets:[_relPi],provinceId:prov.id,charId:c.id,phase:ph});
        break;
      }
      case 'disband_army':{
        // Disband armies — they become wandering mercenaries (skeletal armies just die)
        if((c.armies||[]).length===0){log('system',`${c.name}: no armies to disband.`,{actor:c.player,targets:[c.player]});break;}
        let disbanding=[];
        if(target==='all'){disbanding=[...c.armies];c.armies=[];}
        else{
          const targets=target.split(',').map(t=>t.trim()).filter(Boolean);
          targets.forEach(t=>{
            const idx=c.armies.findIndex(a=>a.type===t||a.unitName===t);
            if(idx>=0) disbanding.push(...c.armies.splice(idx,1));
          });
        }
        if(disbanding.length===0){log('system',`${c.name}: could not find specified armies to disband.`,{actor:c.player,targets:[c.player]});break;}

        // Skeletal armies cannot become mercenaries — they return to death
        const skelDisbanded=disbanding.filter(a=>a._isSkeletal);
        if(skelDisbanded.length>0){
          log('system',`💀 ${skelDisbanded.map(a=>a.unitName||a.type).join(', ')} cannot be disbanded as mercenaries — skeletal armies return to their graves and crumble to dust.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          disbanding=disbanding.filter(a=>!a._isSkeletal);
          if(disbanding.length===0) break;
        }

        // Create mercenary army objects in the province
        if(!G.mercenaries) G.mercenaries=[];
        const SEA_TYPES_D=new Set(KC_UNIT_CLASS.sea);
        disbanding.forEach(army=>{
          const merc={
            id:newMercId(turnContext),
            type:army.type,quality:army.quality,race:army.race||'Human',
            unitName:army.unitName||army.type,
            location:prov.id,isSea:SEA_TYPES_D.has(army.type),
          };
          G.mercenaries.push(merc);
          log('hire',`${c.name} disbands ${army.unitName||army.type} (${army.quality}) — they become a mercenary band in ${prov.name}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        });

        // Recompute the move pool from the remaining force — disbanding a slow unit frees up pace
        // for the rest of the turn, and disbanding everything restores foot-passage (land 5 / sea
        // 5). Points already spent this turn are preserved.
        refreshMovePool(turnContext,c);
        if((c.armies||[]).length===0){
          log('move',`${c.name} has disbanded all armies — now travelling light (land ${movePoints[c.id]}, sea ${seaMovePoints[c.id]} move points).`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        }
        break;
      }

      case 'pickup_army':{
        const _pickBefore=(c.armies||[]).slice(); let _pickSrc=null; // for the at-sea capacity check below
        if((target||'').toString().trim().toLowerCase()==='all'){
          // Pick up ALL unled (garrison) armies in the province.
          const garr=prov.garrisonArmies||[];
          if(garr.length===0){log('system',`${c.name} finds no garrison armies in ${prov.name} to pick up.`,{actor:c.player,targets:[c.player]});break;}
          const n=garr.length;
          c.armies=(c.armies||[]);
          while(garr.length>0){ c.armies.push(garr.pop()); }
          prov.garrisonArmies=[];
          log('hire',`${c.name} takes command of all ${n} garrisoned unit${n!==1?'s':''} in ${prov.name}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        } else if(String(target||'').trim().toLowerCase().startsWith('merc:')){
          // mercenaries are NO LONGER pickable via Pick Up Army — they answer to gold, not to the
          // ground, and are taken into service through Recruit Armies. The order form no longer
          // offers them; this branch only catches a stale saved order and declines it rather than
          // silently spending the treasury on a band the player can no longer see.
          log('system',`${c.name} cannot simply take up a mercenary band with a Pick Up order — mercenaries are hired through Recruit Armies. (Pick Up Army takes only unled garrison units.)`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          break;
        } else if(/(^|,)\s*g:\d+/i.test(String(target||''))){
          // pick up a SELECTION of unled garrison units by index. The player form now offers
          // checkboxes and emits a comma-separated list like "g:0,g:2". Splice from the highest
          // index down so earlier removals don't shift the indices still to be taken.
          const garr=prov.garrisonArmies||[];
          const idxs=String(target).split(',').map(s=>s.trim()).filter(s=>/^g:\d+$/i.test(s)).map(s=>parseInt(s.slice(2)));
          const uniq=[...new Set(idxs)].filter(i=>Number.isInteger(i)&&i>=0&&i<garr.length).sort((a,b)=>b-a);
          if(uniq.length===0){log('system',`${c.name} finds no matching garrison armies in ${prov.name} to pick up.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
          const picked=[];
          uniq.forEach(i=>{ picked.push(...garr.splice(i,1)); });
          c.armies=(c.armies||[]);
          picked.forEach(a=>c.armies.push(a));
          const _lbl=picked.map(a=>a.unitName?a.unitName+' ('+a.quality+' '+a.type+')':a.quality+' '+a.type).join(', ');
          log('hire',`${c.name} takes command of ${_lbl} from the garrison in ${prov.name}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        } else {
        // Legacy paths: a numeric character id (take an army from another of your characters), or
        // the old "-1[:i]" form (take one garrison unit). Kept for backward-compat with stale saved
        // orders.
        const srcId=parseInt(target);
        if(srcId>=0){
          const src=G.characters[srcId];
          // `!src.alive` added. Without it a stale saved order could strip the armies off a comrade
          // who fell EARLIER THIS TURN — the one order besides Resurrect that could still reach a
          // dead character. A fallen commander's troops are handled by the death routine (they
          // scatter or pass to the king); they are not there to be picked up.
          if(!src||!src.alive||src.location!==c.location||src.player!==c.player||(src.armies||[]).length===0){log('system',`${c.name}: cannot pick up army.`);break;}
          const army=src.armies.pop();c.armies=(c.armies||[]);c.armies.push(army); _pickSrc=src;
          log('hire',`${c.name} takes command of ${army.unitName?army.unitName+' ('+army.quality+' '+army.type+')':army.quality+' '+army.type} from ${src.name}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        } else {
          const army=(prov.garrisonArmies||[]).pop();
          if(!army){log('system',`${c.name} finds no garrison armies in ${prov.name} to pick up.`,{actor:c.player,targets:[c.player]});break;}
          c.armies=(c.armies||[]);c.armies.push(army);
          log('hire',`${c.name} picks up ${army.unitName?army.unitName+' ('+army.quality+' '+army.type+')':army.quality+' '+army.type} from the garrison in ${prov.name}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        }
        }
        // Item 24 (2026-10-12): beasts taken up beyond the leader's Druid go back where they came from.
        { const _new=(c.armies||[]).filter(a=>!_pickBefore.includes(a));
          let _room=beastCommandRoom({...c,armies:_pickBefore},G.characters); const _keepN=[], _backB=[];
          _new.forEach(a=>{ if(beastCommandCount(a)){ if(_room>0){ _room--; _keepN.push(a); } else _backB.push(a); } else _keepN.push(a); });
          if(_backB.length){ c.armies=_pickBefore.concat(_keepN);
            if(_pickSrc) _pickSrc.armies=(_pickSrc.armies||[]).concat(_backB); else prov.garrisonArmies=(prov.garrisonArmies||[]).concat(_backB);
            log('hire',`🐾 ${beastCommandWords(c,G.characters)}: ${_backB.map(a=>a.unitName||a.type).join(', ')} ${_backB.length===1?'stays':'stay'} ${_pickSrc?`with ${_pickSrc.name}`:`in the garrison of ${prov.name}`}.`,{actor:c.player,targets:[c.player],provinceId:prov.id}); } }
        // 2026-09-23c (Toby): at sea a character takes aboard only what his ships (and flyers) can
        // carry — units taken in order while they fit; the rest go back where they came from.
        if(isOpenSea(prov)&&seaLiftShortfall(c.armies||[],c)>0){
          const _new=(c.armies||[]).filter(a=>!_pickBefore.includes(a)), _keep=_pickBefore.slice(), _back=[];
          _new.forEach(a=>{ if(seaLiftShortfall(_keep.concat([a]),c)===0) _keep.push(a); else _back.push(a); });
          c.armies=_keep;
          if(_back.length){
            if(_pickSrc) _pickSrc.armies=(_pickSrc.armies||[]).concat(_back); else prov.garrisonArmies=(prov.garrisonArmies||[]).concat(_back);
            log('hire',`⚓ ${_back.map(strandLabel).join(', ')} cannot be taken aboard — ${c.name}'s ships have no room for them on open water, so ${_back.length===1?'it stays':'they stay'} ${_pickSrc?`with ${_pickSrc.name}`:`in the garrison of ${prov.name}`}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          }
        }
        // Recompute the move pool from the new force — picking up a slow army reduces pace. Uses
        // the shared computation (so March/Naval/Swift bonuses apply consistently) and preserves
        // points already spent this turn.
        refreshMovePool(turnContext,c);
        log('move',`${c.name} now leads ${(c.armies||[]).length} arm${(c.armies||[]).length!==1?'ies':'y'}. Land MPs: ${movePoints[c.id]}, Sea MPs: ${seaMovePoints[c.id]}.`,{actor:c.player,targets:[c.player]});
        break;
      }
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

      case 'steal':{
        // ── STEAL ── Needs Thief 1+. Targets: a character in the province (magic item, or 5% of
        // their realm's treasury — the player chooses via `extra`, defaulting to an item when one
        // is carried), or the province GARRISON paymaster (target 'garrison': 1g per garrison unit
        // from the owning realm). Success: 50% + 10%/Thief
        // (cap L5), halved against a commander leading troops (or the guarded paymaster). A failed attempt is
        // noticed unless the thief slips away (Thief × 20%, cap 95%); a noticed thief is brought to
        // a duel unless the victim's duel stance is REFUSE (thiefCaughtScuffle above).
        const thiefLevel=effStat(turnContext,c,'thief');
        if(thiefLevel<1){log('system',`${c.name} has no Thief skill — light fingers take training.`,{actor:c.player,targets:[c.player]});break;}
        const _tgtRaw=String(target||'').trim().toLowerCase();
        // cap at 95%. 50 + 10×5 reached a flat 100 at Thief 5, and nothing in this engine is ever
        // certain — every other roll is clamped short of it. The halved variants (a target leading
        // troops, a guarded paymaster) floor out of this figure, so they cap at 47%.
        const stealBase=Math.min(95,50+10*Math.min(thiefLevel,5));
        const escapeChance=Math.min(95,thiefLevel*20); // chance to slip away unnoticed on a failure
        if(_tgtRaw==='garrison'){
          // (e) The garrison paymaster: 1g per unit standing garrison here, from the province's owner.
          const _gN=(prov.garrisonArmies||[]).length;
          if(prov.owner==null||prov.owner===c.player||_gN===0){log('system',`${c.name} finds no enemy paymaster to rob in ${prov.name} — it needs a rival's garrison standing here.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
          const ownerP=G.players[prov.owner]; const chance=Math.floor(stealBase/2); const roll=d100();
          log('system',`📊 Steal — ${c.name} (Thief ${thiefLevel}) goes for the garrison paymaster of ${prov.name} (${_gN} unit${_gN!==1?'s':''}, guarded — halved): ${fmtRoll(chance,roll)}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          if(roll<=chance){
            noteEspionage(G, c, prov.id, 'robbed the garrison paymaster');
            const take=Math.min(ownerP.gold||0,_gN);
            if(take>0){ ownerP.gold-=take; player.gold=(player.gold||0)+take; c.merits=(c.merits||0)+1; }
            log('hire',`💰 ${c.name} lifts ${take}g from the garrison paymaster's strongbox in ${prov.name}.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            if(take>0) log('system',`[Intelligence] The garrison paymaster of ${prov.name} was robbed of ${take}g — ${c.name} (${G.players[c.player]?.name}) is suspected.`,{actor:c.player,targets:[prov.owner],provinceId:prov.id});
            trySkillGain(turnContext,c,'thief',SKILLGAIN_STD);
          } else if(kcRng()*100>=escapeChance){
            const dmg=rng(1,4); c.hp=Math.max(1,c.hp-dmg);
            log('combat',`${c.name} is caught by the garrison guards of ${prov.name} and beaten back — ${dmg} damage taken.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            log('system',`[Intelligence] ${c.name} (${G.players[c.player]?.name}) was caught trying to rob the garrison paymaster of ${prov.name}.`,{actor:c.player,targets:[prov.owner],provinceId:prov.id});
          } else log('system',`${c.name}'s attempt on the paymaster of ${prov.name} fails, but the thief slips away unnoticed.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          if(roll>chance) trySkillGain(turnContext,c,'thief',SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn
          break;
        }
        const targetId=parseInt(target);
        const victim=G.characters.find(ch=>ch.alive&&ch.id===targetId&&ch.location===c.location);
        if(!victim){log('system',`${c.name} finds no suitable target to steal from in ${prov.name}.`,{actor:c.player,targets:[c.player]});break;}
        if(victim.player===c.player){log('system',`${c.name} will not rob a comrade.`,{actor:c.player,targets:[c.player]});break;}
        if(isVanished(turnContext,victim)){log('system',`${c.name} reaches for ${victim.name}'s purse and closes on nothing — the man has vanished.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
        // the player never chooses the prize and is never told whether the target carries anything.
        // A magic item is lifted if one can be (random, weighted toward the weaker tiers — see
        // liftRandomItem); a target with nothing liftable is robbed of gold instead. The saved
        // `extra` ('item'/'gold') from older order forms is ignored.
        const hasItems=transferableItems(victim.items||[]).length>0;
        const wantGold=!hasItems;
        if(wantGold&&victim.player==null){log('system',`${c.name} finds ${victim.name} carries no purse worth the risk and no magic to lift.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
        const leadsArmies=(victim.armies||[]).length>0;
        let stealChance=stealBase; if(leadsArmies) stealChance=Math.floor(stealChance/2);
        const stealRoll=d100();
        log('system',`📊 Steal — ${c.name} (Thief ${thiefLevel}) targets ${victim.name} (${wantGold?'gold':'a magic item'}): ${fmtRoll(stealChance, stealRoll)}${leadsArmies?' (halved — target leads armies)':''}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        if(stealRoll<=stealChance){
          noteEspionage(G, c, prov.id, wantGold?'picked a hero\u2019s purse':'lifted a magic item from a hero');
          if(wantGold){
            const purse=G.players[victim.player]?.gold||0; const take=Math.min(purse,Math.max(1,Math.floor(purse*0.05)));
            if(purse<=0){ log('system',`${c.name} picks ${victim.name}'s purse — and finds it empty.`,{actor:c.player,targets:[c.player],provinceId:prov.id}); }
            else { G.players[victim.player].gold-=take; player.gold=(player.gold||0)+take; c.merits=(c.merits||0)+1;
              log('hire',`💰 ${c.name} deftly lifts ${take}g from ${victim.name}'s strongbox (5% of the realm's treasury).`,{actor:c.player,targets:[c.player],provinceId:prov.id});
              log('system',`[Intelligence] ${c.name} (${G.players[c.player]?.name}) has stolen ${take}g from ${victim.name}!`,{actor:c.player,targets:[victim.player],provinceId:prov.id,charId:victim.id}); }
          } else {
            const stolen=liftRandomItem(c,victim);
            if(stolen&&stolen.guarded){ log('system',`${c.name}'s fingers find nothing — ${victim.name} keeps every trinket sewn tight; a master thief cannot be robbed of their own.`,{actor:c.player,targets:[c.player],provinceId:prov.id}); }
            else { c.merits=(c.merits||0)+2;
              log('hire',`${c.name} deftly lifts the ${stolen.name} from ${victim.name}!`,{actor:c.player,targets:[c.player],provinceId:prov.id,public:false});
              log('hire',gainedItemNote(c,[stolen]),{actor:c.player,targets:[c.player],provinceId:prov.id,public:false}); // item 10
              if(victim.player!==null) log('system',`[Intelligence] ${c.name} (${G.players[c.player]?.name}) has stolen the ${stolen.name} from ${victim.name}!`,{actor:c.player,targets:[victim.player],provinceId:prov.id,charId:victim.id}); }
          }
          trySkillGain(turnContext,c,'thief',SKILLGAIN_STD);
        } else {
          const caught=kcRng()*100>=escapeChance;
          if(caught) thiefCaughtScuffle(c,victim,`with a hand in their ${wantGold?'strongbox':'pack'}`);
          else log('system',`${c.name}'s theft attempt on ${victim.name} fails but the thief slips away undetected.`,{actor:c.player,targets:[c.player]});
          trySkillGain(turnContext,c,'thief',SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn
        }
        break;
      }

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
      case 'sabotage':{
        if(skillLevel(c,'spy')<7){log('system',`${c.name} lacks the Spy mastery (7) to attempt Sabotage.`,{actor:c.player,targets:[c.player]});break;}
        const tp=G.world.provinces[parseInt(target)];
        if(!tp||tp.owner==null||tp.owner===c.player){log('system',`${c.name}: Sabotage needs a valid enemy province you have seen.`,{actor:c.player,targets:[c.player]});break;}
        if(!areEnemies(turnContext,c.player,tp.owner)){log('system',`${c.name}: you are not at war with the owner of ${tp.name} — Sabotage would be an act of war. Declare war first.`,{actor:c.player,targets:[c.player]});break;}
        tp._sabotagedForTurn=G.turn;
        let disbanded='';
        if((tp.garrisonArmies||[]).length>0){ const u=tp.garrisonArmies.splice(Math.floor(kcRng()*tp.garrisonArmies.length),1)[0]; disbanded=u?` A ${u.quality||''} ${u.type} of its garrison is put to the torch.`:''; }
        log('spy',`🕵 ${c.name}'s agents sabotage ${tp.name} — its coffers yield nothing this turn.${disbanded}`,{actor:c.player,targets:[c.player,tp.owner].filter(x=>x!=null),provinceId:tp.id});
        TM(c).spyActions=(TM(c).spyActions||0)+1; // TITLE MERIT: Spymaster
        noteEspionage(G, c, tp.id, 'worked sabotage');
        trySkillGain(turnContext,c,'spy',SKILLGAIN_STD);
        break;
      }
      case 'grand_heist':{
        // ── GRAND HEIST ────
        // The TARGET is the PROVINCE the thief is standing in, not any one hero — the job is
        // breaking into a realm's vaults, and the realm robbed is whoever holds the ground.
        // • PLACE — the province must be held by a realm you are at WAR with, and be either their
        // HOME CAPITAL or RICH country (tax base ≥ GRAND_HEIST_RICH_TAX).
        // • ONCE per turn per thief — the attempt is spent whether it succeeds or fails.
        // • ODDS — 60% + 5% per Thief level past 5, HALVED if the vaults are guarded: a garrison
        // stands here, or an enemy commander of that realm is here at the head of troops.
        // • TAKE — 25% of the realm's treasury (THIEF L8 doubles it; the realm is floored at 0), plus
        // ONE magic item taken from that realm's COURIER TRAFFIC — a parcel sent by a Send Item
        // order earlier this turn and still on the road. What a hero carries in their own pack is
        // never touched by a heist; that is the Steal order's business.
        // • CAUGHT — a failed heist is noticed unless the thief slips away (Thief × 20%, cap 95%).
        // If a hero of the robbed realm is standing here they run the thief down (a duel, unless
        // their stance is Refuse); otherwise the garrison guards beat him off.
        if(skillLevel(c,'thief')<7){log('system',`${c.name} lacks the Thief mastery (7) for a Grand Heist.`,{actor:c.player,targets:[c.player]});break;}
        if(c._grandHeistTurn===G.turn){log('system',`${c.name} has already attempted a Grand Heist this turn — one great job a season is all the nerves will bear.`,{actor:c.player,targets:[c.player]});break;}
        const vp=prov.owner;
        if(vp==null||vp===c.player){log('system',`${c.name} looks for vaults to crack in ${prov.name}, but no rival crown holds this ground — a Grand Heist is staged in an enemy's own country.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
        if(!areEnemies(turnContext,c.player,vp)){log('system',`${c.name}: you are not at war with ${G.players[vp]?.name||'this realm'} — a Grand Heist would be an act of war. Declare war first.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
        const _ghHome=(homeProvinceIdFor(G,vp)===prov.id);
        const _ghRich=(prov.tax||0)>=GRAND_HEIST_RICH_TAX;
        if(!_ghHome&&!_ghRich){log('system',`${c.name} casts an eye over ${prov.name} and finds nothing worth the risk — a Grand Heist is staged in an enemy's home capital or in rich country (tax ${GRAND_HEIST_RICH_TAX}+; this province: ${prov.tax||0}).`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
        c._grandHeistTurn=G.turn;   // the attempt is spent, win or lose
        // Who could catch him, and how well watched are the vaults?
        const _ghWardens=(G.characters||[]).filter(x=>x&&x.alive&&x.player===vp&&x.location===prov.id);
        const _ghGuarded=((prov.garrisonArmies||[]).length>0)||_ghWardens.some(x=>(x.armies||[]).length>0);
        const _hLvl=skillLevel(c,'thief');
        let _hChance=Math.min(95,60+5*(_hLvl-5)); if(_ghGuarded) _hChance=Math.floor(_hChance/2);
        const _hRoll=d100();
        log('system',`📊 Grand Heist — ${c.name} (Thief ${_hLvl}) cracks the vaults of ${_ghHome?'the enemy capital of ':'the rich province of '}${prov.name} (${G.players[vp]?.name||'an enemy realm'}): ${fmtRoll(_hChance,_hRoll)}${_ghGuarded?' (halved — the vaults are guarded)':''}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        if(_hRoll<=_hChance){
          noteEspionage(G, c, prov.id, 'cracked the vaults');
          const purse=G.players[vp]?.gold||0;
          let take=Math.floor(purse*0.25);
          if(perkTier(c,'thief')>=3) take*=2; // THIEF L8: gold stolen doubled — the thief takes the full amount even if the realm cannot cover it (floored at 0 below)
          const parts=[]; let _heistItem=null;
          if(take>0){ G.players[vp].gold=Math.max(0,purse-take); G.players[c.player].gold=(G.players[c.player].gold||0)+take; parts.push(`${take}g lifted from the vaults`); }
          // ── COURIER INTERCEPT ── one item from a parcel still on the road inside the robbed
          // realm.
          const _ghParcels=(G._itemDeliveries||[]).filter(d=>{
            if(!d||!Array.isArray(d.items)||!d.items.length) return false;
            const dest=(G.characters||[]).find(ch=>ch&&ch.id===d.toId);
            return !!dest&&dest.player===vp;
          });
          if(_ghParcels.length){
            const _p=_ghParcels[Math.floor(kcRng()*_ghParcels.length)];
            const _it=_p.items.splice(Math.floor(kcRng()*_p.items.length),1)[0];
            c.items=(c.items||[]); c.items.push(_it); applyItemMaxHp(c,_it); _heistItem=_it;
            parts.push(`the ${_it.name} cut from a courier's satchel on the road`);
            const _dest=(G.characters||[]).find(ch=>ch&&ch.id===_p.toId);   // the parcel's intended recipient
            log('system',`📦 A courier of ${G.players[vp]?.name} is waylaid on the road — ${_it.name}${_p.fromName?`, sent by ${_p.fromName}`:''}${_dest?` and bound for ${_dest.name}`:''}, never arrives.`,{actor:null,targets:[vp],provinceId:prov.id,charId:_dest?_dest.id:null,phase:ph});
          } else parts.push(`though no courier of theirs was on the road to waylay`);
          c.merits=(c.merits||0)+2;
          const msg=parts.join(' — and ');
          log('hire',`💰 ${c.name} pulls off a Grand Heist in ${prov.name}${msg?` — ${msg}!`:', but finds little worth taking.'}`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          if(_heistItem){ const _gn=gainedItemNote(c,[_heistItem]); if(_gn) log('hire',_gn,{actor:c.player,targets:[c.player],provinceId:prov.id}); } // item 10
          log('system',`[Intelligence] ${c.name} (${G.players[c.player]?.name}) staged a Grand Heist in ${prov.name}${msg?`: ${msg}`:''}.`,{actor:c.player,targets:[vp],provinceId:prov.id});
          trySkillGain(turnContext,c,'thief',SKILLGAIN_STD);
        } else {
          trySkillGain(turnContext,c,'thief',SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn
          const caught=kcRng()*100>=Math.min(95,_hLvl*20);
          if(!caught){ log('system',`${c.name}'s Grand Heist in ${prov.name} comes to nothing, but the thief slips away undetected.`,{actor:c.player,targets:[c.player],provinceId:prov.id}); break; }
          // A hero of the robbed realm gives chase; failing that, the guards do.
          const _ghCatcher=_ghWardens.find(x=>!x.isKing)||_ghWardens[0]||null;
          if(_ghCatcher) thiefCaughtScuffle(c,_ghCatcher,`breaking into the vaults of ${prov.name}`);
          else {
            const dmg=rng(1,4); c.hp=Math.max(1,c.hp-dmg);
            log('combat',`${c.name} is caught at the vaults of ${prov.name} and beaten back by the guards — ${dmg} damage taken.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
            log('system',`[Intelligence] A thief — ${c.name} (${G.players[c.player]?.name}) — was driven off the vaults of ${prov.name}.`,{actor:c.player,targets:[vp],provinceId:prov.id});
          }
        }
        break;
      }
      case 'awaken_grove':{
        if(skillLevel(c,'druid')<7){log('system',`${c.name} lacks the Druid mastery (7) to Awaken a Grove.`,{actor:c.player,targets:[c.player]});break;}
        const okTerrain=(prov.terrain==='forest'||prov.terrain==='jungle')||String(prov.race||'').startsWith('Primal');
        if(prov.owner!==c.player||!okTerrain){log('system',`${c.name}: Awaken Grove works only while standing in an OWNED forest, jungle or wild (Creature or Monster) province.`,{actor:c.player,targets:[c.player]});break;}
        const grove={type:'Forest Ents',quality:'Veteran',race:'Forest Ent',unitName:'an awakened Grove',_temporary:true,_expiresAfterPhase:-1};
        c.armies=(c.armies||[]);c.armies.push(grove);
        logSplit(turnContext,'explore',`🌳 ${c.name} awakens the grove of ${prov.name} — Forest Ents tear their roots from the earth to march under your banner until the turn's end.`,
          `🌳 ${c.name}${realmTag(turnContext,c.player)} awakens the grove of ${prov.name} — Forest Ents tear their roots from the earth to march under their banner until the turn's end.`,{actor:c.player,provinceId:prov.id});
        resolveUnitGainInProvince(turnContext, c, prov, ph);
        trySkillGain(turnContext,c,'druid',SKILLGAIN_STD);
        break;
      }
      case 'chart_unknown':{
        // Explorer L7: the survey may be run on the province the character stands in OR any
        // province adjacent to it — a cartographer works a horizon, not just the ground under their
        // boots. An empty or unrecognised target still means "here".
        if(skillLevel(c,'explorer')<7){log('system',`${c.name} lacks the Explorer mastery (7) to Chart the Unknown.`,{actor:c.player,targets:[c.player]});break;}
        const _cuHereNbrs=getNeighborsP(prov,G.world.cols,G.world.rows,G.world.provinces).filter(Boolean);
        const _cuId=parseInt(target);
        let _cuProv=prov;
        if(Number.isInteger(_cuId)&&_cuId!==prov.id){
          const _cand=G.world.provinces[_cuId];
          if(!_cand||!_cuHereNbrs.some(nb=>nb.id===_cuId)){
            log('system',`${c.name} cannot chart that ground from ${prov.name} — Chart the Unknown reaches this province or one bordering it.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
          _cuProv=_cand;
        }
        if(!_cuProv.exploredBy) _cuProv.exploredBy={};
        _cuProv.exploredBy[c.player]=100; _cuProv.explored=100;
        (_cuProv.features||[]).forEach(f=>{ if(!featDiscovered(f,c.player)){ discoverFeat(f,c.player); c.merits=(c.merits||0)+1; TM(c).featuresFound+=1; } });
        // Reveal the CHARTED province's neighbours at a glance (partial sighting).
        const nbrs=getNeighborsP(_cuProv,G.world.cols,G.world.rows,G.world.provinces).filter(Boolean);
        let revealed=0;
        nbrs.forEach(nb=>{ if(!nb.exploredBy) nb.exploredBy={}; if((nb.exploredBy[c.player]||0)<25){ nb.exploredBy[c.player]=25; nb.explored=Math.max(nb.explored||0,nb.exploredBy[c.player]); revealed++; } });
        log('explore',`🧭 ${c.name} charts ${_cuProv.name}${_cuProv!==prov?` from across the border in ${prov.name}`:''} in full and scouts its ${nbrs.length} neighbour${nbrs.length!==1?'s':''}${revealed?` (${revealed} newly glimpsed)`:''}.`,{actor:c.player,targets:[c.player],provinceId:_cuProv.id});
        trySkillGain(turnContext,c,'explorer',SKILLGAIN_STD);
        break;
      }
      case 'discover_ruin':{
        // Explorer L9: the order now names a CLASS of lair — Weak, Moderate, Powerful or Legendary
        // — and lays bare EVERY lair of that class in this province and in each province bordering
        // it. A ritual site counts as its own class ('Ritual'). A rival's Hide Lairs glamour still
        // holds against it; those lairs stay concealed.
        if(skillLevel(c,'explorer')<9){log('system',`${c.name} lacks the Explorer mastery (9) to Discover a Lost Ruin.`,{actor:c.player,targets:[c.player]});break;}
        const _drTiers=['Weak','Moderate','Powerful','Legendary','Ritual'];
        const _drWant=_drTiers.find(t=>t.toLowerCase()===String(target||'').trim().toLowerCase())||'Weak';
        const _drClassOf=(f)=>f&&f.ritualSite?'Ritual':((f&&f.monster&&f.monster.power)||'Weak');
        const _drScope=[prov,...getNeighborsP(prov,G.world.cols,G.world.rows,G.world.provinces).filter(Boolean)];
        const _drFound=[];
        _drScope.forEach(pv=>{
          (pv.features||[]).forEach(f=>{
            if(!f||featDiscovered(f,c.player)) return;
            if(f._hidden&&f._hiddenBy!==c.player) return;      // a rival's Hide Lairs glamour still holds
            if(_drClassOf(f)!==_drWant) return;
            discoverFeat(f,c.player); c.merits=(c.merits||0)+1; TM(c).featuresFound+=1;
            _drFound.push({name:f.name||'a hidden lair',prov:pv});
          });
        });
        if(_drFound.length===0){
          log('explore',`${c.name} combs ${prov.name} and the country about it for ${_drWant==='Ritual'?'ritual sites':`${_drWant.toLowerCase()} lairs`}, but every such secret hereabouts is already laid bare.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
          trySkillGain(turnContext,c,'explorer',SKILLGAIN_STD);break;}
        const _drByProv={};
        _drFound.forEach(x=>{ (_drByProv[x.prov.id]=_drByProv[x.prov.id]||{name:x.prov.name,list:[]}).list.push(x.name); });
        const _drTxt=Object.values(_drByProv).map(g=>`${g.list.join(', ')} in ${g.name}`).join('; ');
        log('explore',`🏛 ${c.name} reads the land for ${_drWant==='Ritual'?'the old stones':`${_drWant.toLowerCase()} lairs`} and lays bare ${_drFound.length} site${_drFound.length!==1?'s':''} across ${Object.keys(_drByProv).length} province${Object.keys(_drByProv).length!==1?'s':''} — ${_drTxt}.`,{actor:c.player,targets:[c.player],provinceId:prov.id,public:false});
        trySkillGain(turnContext,c,'explorer',SKILLGAIN_STD);
        break;
      }

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
      case 'research_breakthrough':{
        if(skillLevel(c,'sage')<7){log('system',`${c.name} lacks the Sage mastery (7) for a Research Breakthrough.`,{actor:c.player,targets:[c.player]});break;}
        const player=G.players[c.player];
        if(!player.discoveries) player.discoveries=[];
        const known=new Set(player.discoveries.map(d=>d.id));
        const available=discAvailableFor(turnContext, c.player, known); // race/alignment eligibility
        if(available.length===0){log('explore',`${c.name}'s Research Breakthrough succeeds, but your scholars have already unlocked every known discovery.`,{actor:c.player,targets:[c.player]});trySkillGain(turnContext,c,'sage',SKILLGAIN_STD);break;}
        const disc=available[Math.floor(kcRng()*available.length)];
        player.discoveries.push({id:disc.id,name:disc.name,category:disc.category,desc:disc.desc,turnDiscovered:G.turn}); TM(c).discoveries+=1;
        log('explore',`💡 ${c.name} drives a Research Breakthrough — **${disc.name}** (${disc.category}) discovered! ${disc.desc}`,{actor:c.player,targets:[c.player]});
        trySkillGain(turnContext,c,'sage',SKILLGAIN_STD);
        break;
      }
      case 'assassinate':{
        if(skillLevel(c,'spy')<9){log('system',`${c.name} lacks the Spy mastery (9) to Assassinate.`,{actor:c.player,targets:[c.player]});break;}
        const victim=G.characters.find(ch=>ch.alive&&ch.id===parseInt(target)&&ch.location===c.location&&ch.player!==c.player);
        if(!victim){log('system',`${c.name} finds no enemy hero to assassinate in ${prov.name} this phase.`,{actor:c.player,targets:[c.player]});break;}
        if(isVanished(turnContext,victim)){log('spy',`${c.name} stalks ${victim.name} through ${prov.name} and never once catches sight of them — the mark has vanished.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
        if(victim.player!=null&&!areEnemies(turnContext,c.player,victim.player)){log('system',`${c.name}: you are not at war with ${victim.name}'s crown — an assassination would be an act of war. Declare war first.`,{actor:c.player,targets:[c.player]});break;}
        const chance=Math.min(80, 25+skillLevel(c,'spy')*6)-(victim.isKing?25:0);
        const roll=d100();
        markProvinceCombat(prov,[c.player,victim.player]); // purple swords: knife-work counts as a personal combat
        // The roll line is the ASSASSIN'S working: it names their own Spy level and the odds, so it
        // goes to their realm alone. The victim's realm is told an attempt was made on their hero —
        // they would certainly notice a knife in the dark — but never the assassin's skill or the
        // numbers behind it. (Before 2026-09-26 both realms got the full line, handing the victim
        // the attacker's Spy level for free.)
        log('spy',`📊 Assassination — ${c.name} (Spy ${skillLevel(c,'spy')}) stalks ${victim.name}: ${chance}% (roll ${roll}${roll<=chance?' ✓':' ✗'})${victim.isKing?' (king — heavily guarded)':''}`,{actor:c.player,charIds:[c.id,victim.id].filter(v=>v!=null),targets:[c.player],provinceId:prov.id});
        if(victim.player!=null&&victim.player!==c.player) log('spy',`🗡 An attempt is made on ${victim.name}'s life${victim.isKing?' — the royal guard close ranks':''}.`,{actor:victim.player,charIds:[victim.id].filter(v=>v!=null),targets:[victim.player],provinceId:prov.id});
        if(roll<=chance){
          if(_escapesTheEnd(victim)){ log('combat',_garrethEscapeLine(victim),{actor:c.player,targets:[c.player].filter(x=>x!=null),provinceId:prov.id,public:true}); }
          else { reportHeroFall(turnContext, victim, c, `🗡 ${c.name}'s blade finds ${victim.name} in the dark — the hero is slain!`,{actor:c.player,targets:[c.player,victim.player].filter(x=>x!=null),provinceId:prov.id,public:true}); awardKillXP(turnContext, c, victim); c.merits=(c.merits||0)+2;
          TM(c).spyActions=(TM(c).spyActions||0)+1; // TITLE MERIT: Spymaster — only a blade that lands
          noteEspionage(G, c, prov.id, 'put a blade in one of your heroes'); }
        } else {
          log('spy',`${c.name}'s attempt on ${victim.name} fails — the mark slips the knife.`,{actor:c.player,charIds:[c.id,victim.id].filter(v=>v!=null),targets:[c.player,victim.player].filter(x=>x!=null),provinceId:prov.id});
        }
        trySkillGain(turnContext,c,'spy',SKILLGAIN_STD);
        break;
      }
      case 'vanish':{
        if(skillLevel(c,'thief')<9){log('system',`${c.name} lacks the Thief mastery (9) to Vanish.`,{actor:c.player,targets:[c.player]});break;}
        c._vanishTurn=G.turn;
        log('move',`🌫 ${c.name} melts into the shadows — for the rest of the turn nothing can bring them to bay and nothing can harm them: no pursuit, Encounter or ambush, no hostile spell, no blade, no assassin's knife.`,{actor:c.player,targets:[c.player],provinceId:prov.id});
        trySkillGain(turnContext,c,'thief',SKILLGAIN_STD);
        break;
      }

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
      case 'wild_calling':{
        // ── WILD CALLING ── every primal creature or monster in this province that does not
        // already serve you — a neutral primal host, an enemy commander's beasts, or unled garrison
        // beasts — has a 50% chance to defect and fall in behind the caller. Humanoid troops,
        // fleets, machines and the walking dead are deaf to it.
        if(skillLevel(c,'druid')<9){log('system',`${c.name} lacks the Druid mastery (9) to sound a Wild Calling.`,{actor:c.player,targets:[c.player]});break;}
        const _wcIsBeast=(u)=>!!u&&!u._isSkeletal&&(CREATURE_ARMIES.has(u.type)||MONSTER_ARMIES.has(u.type)||!!PRIMAL_ARMY_DEFS_P[u.type]);
        const _wcWon=[]; const _wcHeard=[]; let _wcCalled=0;
        const _wcRoom=beastCommandRoom(c,G.characters);   // item 24: no more answer than the caller's Druid has room for
        const _wcSift=(arr,label)=>{
          if(!Array.isArray(arr)) return;
          for(let i=arr.length-1;i>=0;i--){
            const u=arr[i]; if(!_wcIsBeast(u)) continue;
            _wcCalled++;
            if(_wcWon.filter(beastCommandCount).length>=_wcRoom) continue;
            if(d100()<=50){ _wcWon.push(Object.assign({},arr.splice(i,1)[0],{_pacified:true})); if(label&&!_wcHeard.includes(label)) _wcHeard.push(label); }
          }
        };
        _wcSift(prov.neutralDefenders,null);                            // the wild host of a primal province
        if(prov.owner!=null&&prov.owner!==c.player) _wcSift(prov.garrisonArmies,`the garrison of ${prov.name}`);
        else if(prov.owner==null) _wcSift(prov.garrisonArmies,null);
        (G.characters||[]).forEach(o=>{
          if(!o||!o.alive||o.id===c.id||o.location!==c.location) return;
          if(o.player===c.player) return;                               // never poached from your own commanders
          if(o.player!=null&&!areEnemies(turnContext,c.player,o.player)) return;     // and never from a realm you are not at war with
          const before=_wcWon.length; _wcSift(o.armies,o.name);
          if(_wcWon.length>before&&o.player!=null){
            log('system',`🐾 The beasts of ${o.name}'s host break their bonds and answer a Wild Calling in ${prov.name} — ${_wcWon.length-before} unit${_wcWon.length-before!==1?'s':''} lost.`,{actor:o.player,targets:[o.player],provinceId:prov.id,charId:o.id});
            if(typeof refreshMovePool==='function') refreshMovePool(turnContext,o);
          }
        });
        if(_wcCalled===0){log('explore',`${c.name} sounds a Wild Calling, but nothing wild stands in ${prov.name} to answer it.`,{actor:c.player,targets:[c.player],provinceId:prov.id});break;}
        if(_wcWon.length===0){log('explore',`🐾 ${c.name} sounds a Wild Calling over ${_wcCalled} wild creature${_wcCalled!==1?'s':''} in ${prov.name} — not one of them breaks for the call.`,{actor:c.player,targets:[c.player],provinceId:prov.id,public:true});trySkillGain(turnContext,c,'druid',SKILLGAIN_STD);break;}
        c.armies=(c.armies||[]).concat(_wcWon);
        const _wcFrom=_wcHeard.length?` (torn from ${_wcHeard.join(' and ')})`:'';
        logSplit(turnContext,'explore',`🐾 ${c.name} sounds a Wild Calling in ${prov.name} — ${_wcWon.length} of ${_wcCalled} wild creature${_wcCalled!==1?'s':''} answer and fall in behind your banner${_wcFrom}!`,
          `🐾 ${c.name}${realmTag(turnContext,c.player)} sounds a Wild Calling in ${prov.name} — ${_wcWon.length} wild creature${_wcWon.length!==1?'s':''} answer and fall in behind their banner.`,{actor:c.player,provinceId:prov.id});
        if(typeof refreshMovePool==='function') refreshMovePool(turnContext,c);
        resolveUnitGainInProvince(turnContext, c, prov, ph);
        trySkillGain(turnContext,c,'druid',SKILLGAIN_STD);
        break;
      }
      case 'grand_design':{
        if(skillLevel(c,'sage')<9){log('system',`${c.name} lacks the Sage mastery (9) to realise a Grand Design.`,{actor:c.player,targets:[c.player]});break;}
        const player=G.players[c.player]; if(!player.discoveries) player.discoveries=[];
        if(player.discoveries.some(d=>d.id==='gd')){log('system',`${G.players[c.player]?.name} has already completed its Grand Design — there can be only one.`,{actor:c.player,targets:[c.player]});break;}
        const _GD_DEFS={...KC_GRAND_DESIGNS};
        const _gdA=(G.players[c.player]&&G.players[c.player].alignment)||'Neutral';
        const _gdD=_GD_DEFS[_gdA]||{name:'The Great Work',desc:'A unique realm-wide Wonder.'};
        // the Wonder now STANDS SOMEWHERE. Its province is recorded on the realm and on the
        // province itself; every benefit is gated on the builder still holding that ground
        // (gdActive), and is regained in full the moment the province is retaken. The Wonder itself is
        // never destroyed and never changes hands — a conqueror gains nothing but the view.
        player.gdProvinceId=prov.id; player.gdName=_gdD.name;
        prov.grandDesign={owner:c.player, name:_gdD.name, alignment:_gdA, builtTurn:G.turn};
        player.discoveries.push({id:'gd',name:'Grand Design \u2014 '+_gdD.name,category:'Wonder',desc:_gdD.desc,turnDiscovered:G.turn,provinceId:prov.id,provinceName:prov.name});
        TM(c).discoveries+=1;
        log('explore',`🏗 ${c.name} completes ${G.players[c.player]?.name}'s Grand Design \u2014 the ${_gdD.name}, a Wonder of the age, raised in ${prov.name}! ${_gdD.desc} Its blessings last only while ${G.players[c.player]?.name} holds ${prov.name} — lose the province and they lapse; retake it and they return.`,{actor:c.player,targets:[c.player],provinceId:prov.id,public:true});
        trySkillGain(turnContext,c,'sage',SKILLGAIN_STD);
        break;
      }

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

