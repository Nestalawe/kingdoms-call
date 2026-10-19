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

