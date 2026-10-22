// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_SEASONS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { SAFE_START_TURN } from '../army-tables.ts';
import { homeProvinceIdFor } from '../grand-design.ts';
import { renameLairsThematicP } from '../names.ts';
import { RETIRED_DISCOVERY_IDS } from '../heroes/skills-and-hp.ts';
import { grantMithrilToDwarves } from '../personal-combat/helpers.ts';
import { botResearchPick } from '../bots/missions.ts';
import { TITLES_PUBLIC_FROM_TURN, TITLE_PERKS_ENABLED } from '../titles/perks.ts';
import { computeMinorTitles, computeStandings } from '../titles/reckoning.ts';
import { telOrdersFor } from '../../views/turn-report.ts';
import { DISC_BY_ID, gdActive } from '../discoveries.ts';
import { relKeyOf } from '../realms/relations-and-captures.ts';
import { setMovePool } from '../units/movement-pools.ts';
import { warFrontThreats } from '../battle/war-fronts-and-enemy-stand-offs.ts';
import { emit } from './events-and-their-audiences.ts';

// ── BEFORE THE FIRST PHASE: WAR WITHOUT WARNING, RESEARCH CHOICES, MESSAGES, MOVE POOLS AND DEFAULT DEFEND (plan
// P1-08k8: four stages taken out of resolveTurn's own body, before the phase loop) ──────────────────────────────────
// Once the realms' orders are merged and log() is ready, four stages, in this order, each once a turn, with the bots'
// code (plan P1-08l) and the turn's start values between them in resolveTurn:
//   1. the relations made ready, then last turn's research choices settled: each bot realm picks for itself, and each
//      realm pursues the lead it picked (or one its scholars choose by the die) and forgets the other for good;
//   2. war without warning (an Evil or Undead realm's declaration of war on a realm it has met stands from this very
//      season), the titles held going into the turn (from the turn titles go public), the Safe Start's and the stale
//      orders' lines, the realms the GM removed told as conceding, and the realms' messages delivered;
//   3. every living realm hero's move pools, the seasons, the turn's trackers (recruits, presence, provinces entered,
//      sightings, distances), last turn's deaths, espionage, watches, chases and attack routes cleared, then the
//      save's sweeps: the Dwarves' mithril, the lairs' names and the guardians' HP (once each), the retired Library,
//      and the Grand Cathedral's ward;
//   4. once the bots have planned, every living realm hero's empty phase set to Defend, the orders recorded for the
//      turn's statistics, and the hosts standing on a war front as the turn begins.
// Each takes the turn's context (src/engine/turn/context.ts) and nothing else: they read the merge's collectors from it
// (plan P1-08k7), and the third and fourth make the values the phases read and join them to it (the move pools,
// SEASONS, the trackers, the war fronts). The bodies keep resolveTurn's indent (plan P1-08's Decisions). The comment
// above the bots' research picks describes the war without warning (the second stage) and the bots' declarations,
// which resolveTurn makes between the first two; the notes on the army tables and the title perks are older: both
// moved as they were.

export function relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks(turnContext) {
  const { G, _botPlayerIdx, discoveryChoicePicks } = turnContext;
  // ── DIPLOMACY (KC alliance system) ────
  // Relations live in G.relations, keyed "minIdx-maxIdx" → 'enemy' | 'allied'. A pair with no
  // entry is NEUTRAL (the default). These helpers are the single source of truth consulted by the
  // movement border gate, every PvP battle site, and isHostileInvasion (pinning + Defend).
  if (!G.relations) G.relations = {};

  // ── Item 3: WAR WITHOUT WARNING. Evil and Undead realms strike the turn they declare — their
  // declaration takes effect BEFORE phase 1, so their armies may cross the frontier this very turn.
  // Every other alignment's declaration still resolves at end of turn (step 6d), in force from next
  // turn. Bots declare here too (botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim), so an Evil/Undead bot gets the same jump.
  // Sept 2026 (review R1): bots send a research pick instead of leaving the choice to chance.
  (G.players || []).forEach((pl, pi) => {
    if (!_botPlayerIdx.has(pi) || !pl || !Array.isArray(pl.pendingDiscoveryChoices)) return;
    pl.pendingDiscoveryChoices.forEach((pc) => {
      if (!pc || pc.turn >= G.turn || !Array.isArray(pc.options)) return;
      discoveryChoicePicks[pi] = discoveryChoicePicks[pi] || {};
      if (discoveryChoicePicks[pi][pc.key] == null)
        discoveryChoicePicks[pi][pc.key] = botResearchPick(G, pi, pc.options);
    });
  });
  // ── RESEARCH CHOICE: settle last turn's pairs before anything else happens this turn ──
  (G.players || []).forEach((pl, pi) => {
    if (!pl || !Array.isArray(pl.pendingDiscoveryChoices) || !pl.pendingDiscoveryChoices.length) return;
    const picks = discoveryChoicePicks[pi] || {};
    const still = [];
    pl.pendingDiscoveryChoices.forEach((p) => {
      if (!p || !Array.isArray(p.options) || p.turn >= G.turn) {
        if (p) still.push(p);
        return;
      }
      pl.discoveries = pl.discoveries || [];
      const known = new Set(pl.discoveries.map((d) => d && d.id));
      const opts = p.options.filter((id) => DISC_BY_ID[id] && !known.has(id) && !RETIRED_DISCOVERY_IDS.has(id));
      if (!opts.length) return;
      const want = picks[p.key];
      const chosen = opts.includes(want) ? want : opts[Math.floor(kcRng() * opts.length)];
      const d = DISC_BY_ID[chosen];
      pl.discoveries.push({ id: d.id, name: d.name, category: d.category, desc: d.desc, turnDiscovered: p.turn });
      pl.forgottenDiscoveries = pl.forgottenDiscoveries || [];
      const lost = p.options.filter((id) => id !== chosen);
      lost.forEach((id) => {
        if (!pl.forgottenDiscoveries.includes(id)) pl.forgottenDiscoveries.push(id);
      });
      const lostNames = lost.map((id) => (DISC_BY_ID[id] && DISC_BY_ID[id].name) || id).join(', ');
      emit(turnContext, {
        type: 'explore',
        text: `💡 ${opts.includes(want) ? `${pl.name} pursues` : `No choice was sent, so ${pl.name}'s scholars choose for themselves and pursue`} **${d.name}** (${d.category}), found by ${p.charName || 'a scholar'} last turn. ${d.desc}${lostNames ? ` The other lead — ${lostNames} — is set aside and forgotten for good.` : ''}`,
        audience: { actor: pi, realms: [pi] },
        hero: null,
        phase: 0,
      });
    });
    pl.pendingDiscoveryChoices = still;
  });
}

export function warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages(turnContext) {
  const { G, diploDeclarations, safeStartRefused, staleOrderWarnings, freshPlayers, playerMessages } = turnContext;
  {
    const _npW = (G.players || []).length;
    for (let a = 0; a < _npW; a++) {
      const pa = G.players[a];
      if (!pa || !['Evil', 'Undead'].includes(pa.alignment)) continue;
      const decl = diploDeclarations[a] || {};
      for (let b = 0; b < _npW; b++) {
        if (b === a || decl[b] !== 'enemy') continue;
        if (!(pa._encountered || []).includes(b)) continue;
        const key = relKeyOf(a, b);
        if ((G.relations[key] || 'neutral') === 'enemy') continue;
        G.relations[key] = 'enemy';
        const na = pa.name || 'Realm ' + (a + 1),
          nb = G.players[b]?.name || 'Realm ' + (b + 1);
        emit(turnContext, {
          type: 'system',
          text: `⚔ ${na} declares war on ${nb} and marches without warning — ${pa.alignment === 'Undead' ? 'the dead keep no truce' : 'the wicked keep no faith'}. War stands between the two realms from this very season.`,
          audience: { actor: null, realms: [a, b] },
          system: true,
        });
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
  G._titleHolders = {};
  G._minorHolders = {};
  if (TITLE_PERKS_ENABLED && (G.turn || 1) >= TITLES_PUBLIC_FROM_TURN) {
    try {
      G._titleHolders = computeStandings(G).titles || {};
    } catch (e) {
      G._titleHolders = {};
    }
    try {
      G._minorHolders = computeMinorTitles(G);
    } catch (e) {
      G._minorHolders = {};
    }
  }

  // Flush any stale-order warnings collected during the merge phase
  safeStartRefused.forEach((pi) =>
    emit(turnContext, {
      type: 'system',
      text: `🕊 Safe Start: no Treat or declaration of war may be made before the orders for Turn ${SAFE_START_TURN}. Your diplomacy this turn was set aside — relations are unchanged.`,
      audience: { actor: null, realms: [pi] },
      system: true,
    }),
  );
  if (staleOrderWarnings.length > 0) {
    staleOrderWarnings.forEach((w) =>
      emit(turnContext, {
        type: 'system',
        text: w,
        audience: { actor: -1, realms: [], seen: w.startsWith('\u{1F3F3}') ? 'world' : undefined },
        system: true,
      }),
    );
  }

  // ── GM-REMOVED REALMS (2026-09-26, Toby item 4) ── The GM can take a player out of a game at any
  // stage; the realm concedes there and then (in game_state) and its seat at the table is deleted.
  // The world is told here, on the first turn resolved after the removal, in the same words a
  // voluntary concession uses — removeGmRemovalQueue holds the indices waiting to be announced.
  if (Array.isArray(G._gmRemovedRealms) && G._gmRemovedRealms.length) {
    G._gmRemovedRealms.forEach((idx) => {
      const _pl = (G.players || [])[idx];
      if (!_pl) return;
      emit(turnContext, {
        type: 'system',
        text: `\u{1F3F3} ${_pl.name} has withdrawn from the game and CONCEDES. Its heroes lay down their ambitions and will only defend what they hold from now on.`,
        audience: { actor: -1, realms: [], seen: 'world' },
        system: true,
      });
    });
    delete G._gmRemovedRealms;
  }

  // ── DELIVER PLAYER-TO-PLAYER MESSAGES ────
  // Each sender's dispatches are filed into every addressee's report as 'message' entries (targets
  // = the recipient, so only they see it). 'all' fans out to every other living human player. The
  // sender is named by realm; empty/oversized text is skipped. A copy is filed back to the SENDER
  // too (as a sent-confirmation) so they have a record of what they sent, in their own report.
  {
    const humanIdx = (G.players || [])
      .map((p, i) => i)
      .filter((i) => {
        const gp = freshPlayers.find((x) => x.player_index === i);
        return gp && gp.user_id;
      });
    Object.keys(playerMessages).forEach((sk) => {
      const senderPi = parseInt(sk);
      const senderName = G.players[senderPi]?.name || 'Player ' + (senderPi + 1);
      (playerMessages[senderPi] || []).forEach((msg) => {
        if (!msg || typeof msg.text !== 'string') return;
        const text = msg.text.trim().slice(0, 1000);
        if (!text) return;
        let rcpts;
        if (msg.to === 'all' || (Array.isArray(msg.to) && msg.to.includes('all'))) {
          rcpts = humanIdx.filter((i) => i !== senderPi);
        } else if (Array.isArray(msg.to)) {
          rcpts = msg.to
            .map((x) => parseInt(x))
            .filter((i) => Number.isInteger(i) && i !== senderPi && i >= 0 && i < (G.players || []).length);
        } else {
          rcpts = [];
        }
        rcpts = [...new Set(rcpts)];
        if (rcpts.length === 0) return;
        const rcptNames = rcpts.map((i) => G.players[i]?.name || 'Player ' + (i + 1));
        // The addressee's copy must NOT name the sender as `actor`: the report filter shows a
        // player every entry where actor===them, so the sender was being handed the
        // incoming-dispatch line as well as their own sent-confirmation — reading their own words
        // as though addressed to them. charId is nulled for the same reason (log() falls back to
        // _logCtx.charId when it is null).
        const _savedDispatchChar = turnContext._logCtx.charId;
        turnContext._logCtx.charId = null;
        rcpts.forEach((rpi) => {
          emit(turnContext, {
            type: 'message',
            text: `📨 Dispatch from ${senderName}: “${text}”`,
            audience: { actor: null, realms: [rpi] },
            phase: 99,
          });
        });
        turnContext._logCtx.charId = _savedDispatchChar;
        // Sender's own copy (confirmation of what they sent, and to whom).
        emit(turnContext, {
          type: 'message',
          text: `📨 You sent to ${rcptNames.join(', ')}: “${text}”`,
          audience: { actor: senderPi, realms: [senderPi] },
          phase: 99,
        });
      });
    });
  }
}

export function movePoolsPerTurnTrackersEspionageResetsAndTheSaveSweepsBeforeTheBotsPlan(turnContext) {
  const { G } = turnContext;
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
  const movePoints = {}; // land move point pool (REMAINING this turn)
  const seaMovePoints = {}; // separate sea move point pool (REMAINING this turn)
  const seaMoveActive = {}; // whether this character has sea move capability this turn
  const seaCap = {};
  const moveMax = {}; // land pool MAX for the turn — lets refreshMovePool preserve points already spent
  const seaMoveMax = {}; // sea pool MAX for the turn
  turnContext.movePoints = movePoints;
  turnContext.seaMovePoints = seaMovePoints;
  turnContext.seaMoveActive = seaMoveActive;
  turnContext.seaCap = seaCap;
  turnContext.moveMax = moveMax;
  turnContext.seaMoveMax = seaMoveMax;
  // Light-travel moves made while the character led NO armies (its generous 5-pool "takes passage"
  // mode). Counted here so refreshMovePool can DISCOUNT them when the hero later picks up troops —
  // free-passage moves must not be charged against a real army's small marching allowance.
  const lightLandMoves = {}; // land moves made while travelling light (no armies)
  const lightSeaMoves = {}; // sea moves made while travelling light (no armies)
  turnContext.lightLandMoves = lightLandMoves;
  turnContext.lightSeaMoves = lightSeaMoves;
  (G.characters || []).filter((c) => c.player !== null && c.alive).forEach((...a) => setMovePool(turnContext, ...a));

  const SEASONS = KC_SEASONS.slice();
  turnContext.SEASONS = SEASONS;
  // Turn-wide recruit tracking: provId → armyType → count recruited this turn
  // Limits: garrisons, humanoid fleets and Goblin Hordes = 2 per turn (twoATurn, module level); the
  // founder's own home province = 2 of anything; elsewhere = 1 per type
  const recruitedThisTurn = {};
  turnContext.recruitedThisTurn = recruitedThisTurn;

  // A fresh turn: clear last turn's death flags so 'killedThisTurn' marks only deaths this turn.
  G.characters.forEach((c) => {
    delete c.killedThisTurn;
  });

  // record which players had a character present in each province at the START of each phase. Used
  // to decide who may see battle reports they didn't participate in (line-of-sight).
  const presenceByPhase = [];
  turnContext.presenceByPhase = presenceByPhase;

  // Provinces a player's characters ENTERED during the current phase, even if they did not stay. A
  // commander who marches in, fights, and is thrown back still saw the place; the map should
  // remember it. Reset at the top of every phase.
  turnContext.enteredThisPhase = {};

  // Intel collapse: intrusion sightings accumulate here across all phases, then a single
  // consolidated "seen during <phases>" line per (target, hero, province) is emitted after the
  // loop.
  const _intrusionAcc = new Map();
  turnContext._intrusionAcc = _intrusionAcc;

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
  G._espionageLedger = [];
  (G.players || []).forEach((p) => {
    p._spiedProvincesLastTurn = (p._spiedProvincesThisTurn || []).slice();
    p._spiedProvincesThisTurn = [];
    p._clairCharThisTurn = null;
    if (!p._spiedHeroSkills) p._spiedHeroSkills = {};
  }); // _clairCharThisTurn: 2026-09-12 Clairvoyance reveal (one per realm)

  // Defend watches and Pursuits last for the rest of the TURN only — never across turns.
  (G.characters || []).forEach((c) => {
    delete c._defend;
    delete c._pursuit;
    delete c._defendReactedPhase;
  });
  // "The province they attacked from" is a fact about THIS turn's marching. It was never cleared,
  // so a character who attacked out of some far-off province turns ago and later lost a battle
  // elsewhere "retreated" straight back to that stale, distant province (five hexes in one case).
  // Every retreat site now also refuses a non-adjacent _attackedFrom; this sweep stops the
  // stale value existing at all.
  (G.characters || []).forEach((c) => {
    delete c._attackedFrom;
  });

  const _distCache = new Map();
  turnContext._distCache = _distCache;

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
  if (!G._lairNamesV3) {
    const _rn = renameLairsThematicP(G);
    if (_rn > 0)
      emit(turnContext, {
        type: 'system',
        text: `\u{1F5FA} The chronicles are corrected: ${_rn} lair${_rn !== 1 ? 's are' : ' is'} now recorded under a name befitting what dwells there.`,
        audience: { actor: null, realms: [] },
      });
  }
  // EVERY GUARDIAN IS 5 HP FRAILER. The table was re-statted, but a live world keeps its own copy
  // of each guardian on the feature (and `_hpFull`, the undamaged total a guardian is restored to
  // between fights), so the table change alone would never reach a game in progress. One flagged,
  // idempotent pass brings existing worlds into line. Floored at 5 so nothing is ever reduced to a
  // guardian that cannot fight.
  if (!G._guardianHpV2) {
    let _gh = 0;
    ((G.world && G.world.provinces) || []).forEach((p) =>
      ((p && p.features) || []).forEach((f) => {
        if (!f || f.ritualSite || !f.monster) return;
        if (f.monster.hp != null) {
          f.monster.hp = Math.max(5, f.monster.hp - 5);
          _gh++;
        }
        if (f.monster._hpFull != null) f.monster._hpFull = Math.max(5, f.monster._hpFull - 5);
      }),
    );
    G._guardianHpV2 = true;
    if (_gh > 0)
      emit(turnContext, {
        type: 'system',
        text: `\u{1F489} The world's guardians are re-measured: ${_gh} lair-keeper${_gh !== 1 ? 's'.concat(' are') : ' is'} 5 hit points frailer than before.`,
        audience: { actor: null, realms: [] },
      });
  }

  // ── RETIRED DISCOVERIES ── the Library (sd30) was removed from the game on 2026-09-09. Strike it
  // from any realm that had already found it, so no live save keeps a dead entry on its sheet.
  (G.players || []).forEach((pl) => {
    if (pl && Array.isArray(pl.discoveries)) pl.discoveries = pl.discoveries.filter((d) => d && d.id !== 'sd30');
  });

  // GRAND DESIGN — Divine (Grand Cathedral): the capital is permanently warded
  // (Plague/Earthquake/Flood/Part Sea turned aside). 2026-09-14: the ward lies over the province
  // the CATHEDRAL STANDS IN, not over a capital id frozen at game start. gdActive already requires
  // the realm to still hold that ground, which also fixes the old bug where a Divine realm that
  // lost its capital kept warding it for its conqueror.
  (G.players || []).forEach((pl, pi) => {
    if (gdActive(turnContext, pi, 'Divine')) {
      const _cap = G.world.provinces[pl.gdProvinceId != null ? pl.gdProvinceId : homeProvinceIdFor(G, pi)];
      if (_cap) {
        _cap._blessWardTurn = G.turn;
        _cap._blessWardBy = pi;
        _cap._blessWardPct = 100;
      }
    }
  });
}

export function missingOrdersDefaultToDefendTheOrdersRecordAndTheWarFrontsAtTheStart(turnContext) {
  const { G, _tel, diploDeclarations, reckoningCalls, expectedTurnToRun } = turnContext;
  // 3. Default any missing orders to Defend
  (G.characters || [])
    .filter((c) => c.player !== null && c.alive)
    .forEach((c) => {
      if (!G.turnOrders[c.id]) G.turnOrders[c.id] = [null, null, null, null, null];
      G.turnOrders[c.id] = G.turnOrders[c.id].map(
        (o) => o || { action: 'defend', target: '', extra: '', desc: 'Defend' },
      );
    });
  // TELEMETRY: the orders as they stand now — every realm's, humans' as submitted and bots' as
  // planned — before a single one resolves (the resolution rewrites slots: pins, unifications).
  try {
    (G.players || []).forEach((pl, pi) => {
      if (!pl) return;
      _tel.orders[pi] = telOrdersFor(G, pi, {
        diplomacy: diploDeclarations[pi] || null,
        callReckoning: reckoningCalls.has(pi) || undefined,
        concede: (pl.conceded && pl.concededTurn === expectedTurnToRun) || undefined,
        plans: Object.fromEntries(
          (G.characters || [])
            .filter((c) => c && c.alive && c.player === pi && c.encounterPlan && Array.isArray(c.encounterPlan.tactics))
            .map((c) => [c.id, c.encounterPlan.tactics.slice(0, 12)]),
        ),
      });
    });
  } catch (_te) {
    console.warn('telemetry orders:', _te);
  }

  const _warFrontAtStart = new Map(); // charId → the province his host stood in when the turn began
  turnContext._warFrontAtStart = _warFrontAtStart;
  warFrontThreats(turnContext).forEach(({ c, prov }) => {
    if (!prov._battleUnresolved) _warFrontAtStart.set(c.id, prov.id);
  });
  const _warFrontProvs = new Set(_warFrontAtStart.values());
  turnContext._warFrontProvs = _warFrontProvs;
}
