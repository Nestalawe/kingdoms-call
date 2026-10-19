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
  turnContext._botEncounteredAtStart=_botEncounteredAtStart;
  _botPlayerIdx.forEach(idx=>{ _botEncounteredAtStart[idx]=[...(((G.players||[])[idx]||{})._encountered||[])]; });

  turnStartRepairsAndAFreshSlateOfOrdersForEveryHero(turnContext);
  // Encounter plans persist across turns until the player changes them, so we do NOT wipe them here
  // — the new submissions below overwrite only the characters whose orders include a plan. Collect
  // warnings about rejected stale orders (logged once log() is ready)
  const staleOrderWarnings=[];
  turnContext.staleOrderWarnings=staleOrderWarnings;
  // Diplomacy declarations submitted this turn, keyed by player index → { targetPlayerIndex: 'treat'|'enemy' }.
  // Recorded here, applied at end of turn (relations change "at the start of the next turn").
  const diploDeclarations={};
  turnContext.diploDeclarations=diploDeclarations;
  const safeStartRefused=[]; // SAFE START: realms whose declarations were discarded this turn (told privately)
  turnContext.safeStartRefused=safeStartRefused;
  const discoveryChoicePicks={}; // research choice: player index → {pendingKey: keptDiscoveryId}
  turnContext.discoveryChoicePicks=discoveryChoicePicks;
  // Victory: players who Called the Reckoning this turn (king-only, one per realm).
  const reckoningCalls=new Set();
  turnContext.reckoningCalls=reckoningCalls;
  // player-to-player messages submitted with orders, keyed by sender index → [{to, text}].
  // `to` is an array of recipient player indices, or the string 'all'. Delivered into each
  // recipient's report below (this turn's report, which they read before ordering next turn).
  const playerMessages={};
  turnContext.playerMessages=playerMessages;
  mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans(turnContext);

  // (the orders were cleared in step 2a, before the save was upgraded)

  // NOTE (Sept 2026): the bot passes and the default-to-Defend pass run inside the resolution
  // try-block, so the bot hunters' duel forecast can call the engine's personal-combat resolver,
  // whose function declarations live in that block. A bot-pass failure therefore also restores the
  // players' orders.

  migrateItemTiers(G);    // re-stamp saved items with their tier under the four-tier scheme
  ensureAllLairHoards(G); // stocks any lair from a pre-hoard save (no-op afterwards)


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

  relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks(turnContext);
  botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim(turnContext);
  warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages(turnContext);

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

  movePoolsPerTurnTrackersEspionageResetsAndTheSaveSweepsBeforeTheBotsPlan(turnContext);
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

  missingOrdersDefaultToDefendTheOrdersRecordAndTheWarFrontsAtTheStart(turnContext);
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

  botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim(turnContext); // bots declare BEFORE the phases now (see the pre-phase pass); a no-op here for any late-identified rival

  diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings(turnContext);

  victoryTheReckoningEliminationConcessionAndTheAnnouncement(turnContext);

  newTurnCounterKingSuccessionSummonsAndSpellsEndAndTheGrandDesigns(turnContext);

  newTurnWarAcademyInformantsDivineResurrectionGravesMercenariesWanderersAndTheFinalReconcile(turnContext);
  imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy(turnContext);
  titleChangesTheTitlesEachRealmWonAndLostSinceLastTurn(turnContext);
  // ── THE REPORTS, BUILT AFTER THE SAVE (P1-18d, 2026-10-18) ────
  // The shell calls buildReports() only once the turn is saved (_turnCommitted), so a report that fails costs reports,
  // never the turn (docs/traps.md, "Post-commit work in runTurn"). The reports are built on the working copy, as they
  // always were: the Spy-stealth rolls in buildReports (engine/turn/realm-reports-and-spy-stealth.js) change it, and the
  // reports read it with the turn's log and helpers.
  const _reports={built:false};
  turnContext._reports=_reports;

  return {state:JSON.stringify(G), log:turnLog, buildReports:(...a)=>buildReports(turnContext,...a)};
}

