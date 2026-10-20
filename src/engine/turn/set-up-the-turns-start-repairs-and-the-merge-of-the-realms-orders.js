import { safeStartLocked } from '../army-tables.js';
import { RACES_P, TEMPERS_P } from '../world/tables.js';
import { normaliseOwnedNames, normaliseStrandedGuards } from '../heroes/fame-and-consecration.js';
import { noteServedRealm } from '../heroes/charms-and-neutrals.js';

// ── THE SET-UP: THE TURN'S START REPAIRS AND THE MERGE OF THE REALMS' ORDERS (plan P1-08k7: two stages taken out of
// the start of resolveTurn's own body; P1-08n: two lines of it before them) ──────────────────────────────────────────
// Each once a turn and before any line is logged (log() isn't ready yet: what they have to tell is kept for later), in
// this order:
//   1. as the save is read, before the turn's context is made: last turn's crossed swords cleared from the map (plan
//      P1-08n). It takes the save (G), as the save's upgrades beside its call do, and a failure in it is a save that
//      can't be read;
//   2. once the context is made: every realm stamped a bot's or a human's from the slot rows (plan P1-08n);
//   3. the turn's start repairs: a neutral hero wearing a beast's race is given a people's race; a guard stranded
//      without companies, or inside a realm's land, becomes a wanderer; no company carries a stranded hull's marker
//      into the turn; a hero in a realm's service loses his " (wandering)" tag (stashed on the save, told at the
//      turn's end); then the turn's orders and its scratch lists start empty, every living hero noting the realm he
//      serves, and every living realm's hero starts with five empty phases (Defend, later);
//   4. the merge of the realms' orders: each realm that sent orders has its hero order kept, its declarations (or the
//      Safe Start's refusal), research choices, Reckoning call, messages and concession collected for later stages,
//      orders stamped for another turn refused, the orders of heroes it means to hire, raise or charm held until the
//      order lands, every other hero's phases written, a conceded realm's heroes made to hold, its encounter plans
//      set (or held, for a hero not yet its own), and a new heir's skills, name and temper applied.
// But for the first, each takes the turn's context (src/engine/turn/context.js) and nothing else: the merge makes the
// collectors afresh each turn, joins them to the context and fills them (staleOrderWarnings, diploDeclarations,
// safeStartRefused, discoveryChoicePicks, reckoningCalls, playerMessages), which later stages and the bots read there
// (they were declared in resolveTurn until plan P1-08l2). The bodies keep resolveTurn's indent (plan P1-08's Decisions).

export function lastTurnsBattleAndDuelSwordsClearedFromTheMap(G) {
  // THE MAP'S "THIS TURN" SWORDS. _hadBattleThisTurn (red) and _combatPlayersThisTurn (purple
  // duel swords) are deleted at the very end of runTurn — but only AFTER game_state has been
  // saved, so the saved state still carried them and the next turn loaded last turn's fights,
  // reporting them a second time (the "duel icon that won't go away"). Clear them here, at the
  // top of the turn, whatever the save held.
  ((G.world && G.world.provinces) || []).forEach((p) => {
    if (p) {
      delete p._hadBattleThisTurn;
      delete p._combatPlayersThisTurn;
    }
  });
}

export function everyRealmStampedBotOrHumanFromTheBotSlotRows(turnContext) {
  const { G, _botPlayerIdx } = turnContext;
  // Sept 2026 (bot strategy batch): stamp the bot flag onto the persisted player objects so the
  // module-level bot passes can tell bot realms from human ones (botIsBotPlayer) — bots never war
  // one another while a human king still reigns, and coordinate against the humans instead.
  (G.players || []).forEach((p, i) => {
    if (p) p._isBot = _botPlayerIdx.has(i);
  });
}

export function turnStartRepairsAndAFreshSlateOfOrdersForEveryHero(turnContext) {
  const { G } = turnContext;
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
  (G.characters || []).forEach((c) => {
    if (c && c.player === null && (c.race === 'Monster' || c.race === 'Creature')) {
      c.race = RACES_P[(((c.id || 0) % RACES_P.length) + RACES_P.length) % RACES_P.length];
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
  ((G.world && G.world.provinces) || []).forEach((p) =>
    ((p && p.garrisonArmies) || []).forEach((a) => {
      if (a && a._navalHold != null) delete a._navalHold;
    }),
  );
  // strip the ' (wandering)' tag from anyone who now serves a crown. Heals live games whose heroes
  // were charmed or resurrected into service before the paths below were fixed.
  // SCOPE TRAP: `log` is a const arrow declared far below inside runTurn, so it is in its temporal
  // dead zone here — the repair is stashed on G and reported by the turn-end integrity block
  // instead.
  G._nameRepairs = normaliseOwnedNames(G);

  // 2. Merge all player orders into G.turnOrders + apply encounter plans
  // CRITICAL: reset turnOrders completely first — stale orders from a previous turn
  // must NEVER carry over. Every character starts this turn with a clean slate (Defend).
  G.turnOrders = {};
  // Per-turn scratch lists persisted inside game_state. These were never cleared, so a hero raised
  // in an earlier turn stayed in _resurrectedThisTurn for the rest of the game — and if they later
  // died again, every future Resurrect (even a successful roll) was refused with "has already been
  // raised this turn" while the body stayed in the graveyard (player report, Sept 2026). Stale
  // pending pre-orders for a resurrect/charm target could likewise be re-applied turns later.
  G._resurrectedThisTurn = [];
  G._pendingResurrectOrders = [];
  (G.characters || []).forEach((ch) => {
    if (ch && ch.alive && ch.player != null) noteServedRealm(ch, ch.player);
  }); // service history (Resurrect)
  G._pendingCharmOrders = [];
  G._pendingHireOrders = []; // 2026-09-21: hire pre-orders are held, not written straight to the real hero
  G._pendingSynthPlans = []; // 2026-09-21: encounter plans from hire/resurrect/charm pre-order cards
  (G.characters || [])
    .filter((c) => c.player !== null && c.alive)
    .forEach((c) => {
      G.turnOrders[c.id] = [null, null, null, null, null];
    });
}

export function mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans(turnContext) {
  const { freshPlayers, G, expectedTurnToRun } = turnContext;
  // Encounter plans persist across turns until the player changes them, so we do NOT wipe them here
  // — the new submissions below overwrite only the characters whose orders include a plan. Collect
  // warnings about rejected stale orders (logged once log() is ready)
  const staleOrderWarnings = [];
  turnContext.staleOrderWarnings = staleOrderWarnings;
  // Diplomacy declarations submitted this turn, keyed by player index → { targetPlayerIndex: 'treat'|'enemy' }.
  // Recorded here, applied at end of turn (relations change "at the start of the next turn").
  const diploDeclarations = {};
  turnContext.diploDeclarations = diploDeclarations;
  const safeStartRefused = []; // SAFE START: realms whose declarations were discarded this turn (told privately)
  turnContext.safeStartRefused = safeStartRefused;
  const discoveryChoicePicks = {}; // research choice: player index → {pendingKey: keptDiscoveryId}
  turnContext.discoveryChoicePicks = discoveryChoicePicks;
  // Victory: players who Called the Reckoning this turn (king-only, one per realm).
  const reckoningCalls = new Set();
  turnContext.reckoningCalls = reckoningCalls;
  // player-to-player messages submitted with orders, keyed by sender index → [{to, text}].
  // `to` is an array of recipient player indices, or the string 'all'. Delivered into each
  // recipient's report below (this turn's report, which they read before ordering next turn).
  const playerMessages = {};
  turnContext.playerMessages = playerMessages;
  freshPlayers
    .filter((p) => p.user_id && p.orders)
    .forEach((gp) => {
      let raw = typeof gp.orders === 'string' ? JSON.parse(gp.orders) : gp.orders || {};
      // Detect new format: {orders:{charId:[phases]}, encounterPlans:{}, forTurn:N} vs old format:
      // {charId:[phases]}
      let ordersObj = raw;
      let epObj = {};
      let kingSkillsObj = {};
      let forTurn = null;
      // the player's own arrangement of their heroes in the orders column, sent as an array of
      // character ids. Stored on the realm so it survives this turn's run and shapes every later
      // report (buildTurnReport sorts by it). Read BEFORE the format sniff below, because a bare
      // reorder on an otherwise untouched form is a payload with no meaningful orders in it.
      if (Array.isArray(raw.heroOrder) && G.players[gp.player_index]) {
        G.players[gp.player_index].heroOrder = raw.heroOrder.slice(0, 200).map(String);
      }
      if (raw.orders !== undefined && raw.encounterPlans !== undefined) {
        ordersObj = raw.orders || {};
        epObj = raw.encounterPlans || {};
        kingSkillsObj = raw.kingSkills || {};
        forTurn = raw.forTurn ?? null;
        // Diplomacy declarations (king-only, one stance per target). Validated at resolution time
        // against the encountered set; stored raw here.
        if (raw.diplomacy && typeof raw.diplomacy === 'object') {
          // SAFE START (2026-09-29): before the orders for Turn SAFE_START_TURN no Treat or war may be
          // declared — the declarations are discarded and the realm is told why.
          if (safeStartLocked(G, expectedTurnToRun)) {
            if (Object.values(raw.diplomacy).some((v) => v === 'treat' || v === 'enemy'))
              safeStartRefused.push(gp.player_index);
          } else diploDeclarations[gp.player_index] = raw.diplomacy;
        }
        // RESEARCH CHOICE: which of each pending pair to keep ({key: discoveryId}); honoured only when
        // the payload is for this turn (a stale draft's picks are ignored like its orders).
        if (
          raw.discoveryChoices &&
          typeof raw.discoveryChoices === 'object' &&
          (raw.forTurn == null || raw.forTurn === expectedTurnToRun)
        )
          discoveryChoicePicks[gp.player_index] = raw.discoveryChoices;
        if (raw.callReckoning === true && !(G.players[gp.player_index] || {}).conceded)
          reckoningCalls.add(gp.player_index);
        if (Array.isArray(raw.messages)) playerMessages[gp.player_index] = raw.messages;
        // CONCEDE. A realm that concedes is out of the game for good — its characters do nothing but
        // Defend from now on (enforced below every turn, whatever is submitted).
        if (raw.concede === true && G.players[gp.player_index] && !G.players[gp.player_index].conceded) {
          G.players[gp.player_index].conceded = true;
          G.players[gp.player_index].concededTurn = expectedTurnToRun;
          staleOrderWarnings.push(
            `\u{1F3F3} ${G.players[gp.player_index].name} has CONCEDED the game. Its heroes lay down their ambitions and will only defend what they hold from now on.`,
          ); // logged (public) once the log() helper exists
        }
      }
      // CRITICAL: reject orders that were stamped for a different turn (stale submissions)
      if (forTurn !== null && forTurn !== expectedTurnToRun) {
        staleOrderWarnings.push(
          `⚠ Ignoring stale orders from ${G.players[gp.player_index]?.name || 'a player'} — submitted for Turn ${forTurn}, not Turn ${expectedTurnToRun}.`,
        );
        return; // skip this player's stale orders entirely
      }
      Object.entries(ordersObj).forEach(([charId, phaseOrders]) => {
        if (charId === 'heroOrder') return; // an array, but not a character's phase orders
        if (!Array.isArray(phaseOrders)) return;
        // Handle synthetic RESURRECTION IDs: 'resurrect_HEROID_via_CASTERID_phPH' A player who orders
        // Resurrect in phase PH may pre-write orders for the hero they intend to raise, exactly as
        // they can for a hero they intend to hire. These are held as PENDING and are only written
        // into turnOrders inside the successful white_resurrect branch — never here. That matters: a
        // corpse can be targeted by more than one player in the same turn, and writing straight to
        // G.turnOrders[realHeroId] would let a player who LOST the race to raise a body still puppet
        // that hero for the rest of the turn. Orders are also scoped to phases AFTER the cast, since
        // the hero is still dead in every phase up to and including it.
        const resMatch = charId.match(/^resurrect_(\d+)_via_(\d+)_ph(\d+)$/);
        if (resMatch) {
          if (!G._pendingResurrectOrders) G._pendingResurrectOrders = [];
          G._pendingResurrectOrders.push({
            heroId: parseInt(resMatch[1]),
            casterId: parseInt(resMatch[2]),
            castPhase: parseInt(resMatch[3]),
            player: gp.player_index,
            orders: phaseOrders,
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
        const hiredMatch = charId.match(/^hired_(\d+)_via_(.+)_ph(\d+)$/); // the hirer may itself be a synthetic (nested-hire) id
        if (hiredMatch) {
          if (!G._pendingHireOrders) G._pendingHireOrders = [];
          G._pendingHireOrders.push({
            heroId: parseInt(hiredMatch[1]),
            viaId: String(hiredMatch[2]), // the hiring character's id (or a nested synthetic id)
            plannedPhase: parseInt(hiredMatch[3]),
            player: gp.player_index,
            orders: phaseOrders,
          });
          return;
        }
        // Handle synthetic CHARM IDs: 'charm_HEROID_via_CASTERID_phPH'. A player who orders Charm on
        // a wandering hero may pre-write orders for the hero they intend to sway, exactly as for a
        // hire or a resurrect. Held as PENDING and only written into turnOrders inside the successful
        // psychic_charm branch — never here — so a failed cast (or a rival charming the same hero
        // first) leaves no trace.
        const charmMatch = charId.match(/^charm_(\d+)_via_(\d+)_ph(\d+)$/);
        if (charmMatch) {
          if (!G._pendingCharmOrders) G._pendingCharmOrders = [];
          G._pendingCharmOrders.push({
            heroId: parseInt(charmMatch[1]),
            casterId: parseInt(charmMatch[2]),
            castPhase: parseInt(charmMatch[3]),
            player: gp.player_index,
            orders: phaseOrders,
          });
          return;
        }
        G.turnOrders[charId] = phaseOrders;
      });
      // a conceded realm's characters ALWAYS hold — override whatever was submitted.
      (G.players || []).forEach((p, pi) => {
        if (!p || !p.conceded) return;
        (G.characters || [])
          .filter((c) => c.alive && c.player === pi)
          .forEach((c) => {
            G.turnOrders[c.id] = [0, 1, 2, 3, 4].map(() => ({
              action: 'defend',
              target: '',
              extra: '',
              desc: 'Hold (conceded)',
            }));
          });
      });
      // Apply encounter plans to characters.
      Object.entries(epObj).forEach(([charId, plan]) => {
        const syn = String(charId).match(/^(?:hired|resurrect|charm)_(\d+)_via_.+_ph\d+$/); // allow synthetic (nested) caster id
        if (syn) {
          // 2026-09-21: a plan on a card for a hero not yet in this realm's service is held until the
          // hire/raise/charm actually lands (see applyPendingSynthPlan). An encounter plan persists
          // turn to turn, so writing it here let a rival set a hero's combat stance for good.
          if (!plan) return;
          if (!G._pendingSynthPlans) G._pendingSynthPlans = [];
          G._pendingSynthPlans.push({ heroId: parseInt(syn[1]), player: gp.player_index, plan });
          return;
        }
        const ch = G.characters.find((c) => c.id === parseInt(charId));
        if (ch && plan) ch.encounterPlan = plan;
      });
      // Apply royal-succession skill allocations to a newly-crowned heir, then retire the flags.
      Object.entries(kingSkillsObj).forEach(([charId, alloc]) => {
        const ch = G.characters.find((c) => c.id === parseInt(charId));
        if (ch && ch._isHeir && alloc) {
          if (alloc.skills) ch.skills = alloc.skills;
          // The player may christen their heir and choose the Temper they were raised with.
          const nm = String(alloc.name || '')
            .trim()
            .slice(0, 40);
          if (nm) ch.name = nm;
          if (alloc.temper && TEMPERS_P.includes(alloc.temper)) ch.temper = alloc.temper;
          delete ch._isHeir;
          delete ch._pendingSkillAllocation;
        }
      });
    });
}
