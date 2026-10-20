import { discParam, hasDisc } from '../discoveries.js';
import { noteSilentHeroes } from './log-line-helpers.js';
import { defendSpentThisPhase } from './mercenary-ids-and-battle-records.js';
import { settleStrandedAtSea } from '../units/sea-lift-stranding-and-retreats.js';
import { generateIntrusionNotifications } from './intrusion-warnings.js';
import { spreadPlagues } from '../magic/plague-and-bless-ward.js';
import {
  resolveAllPendingSkillGains,
  writeDeferredSkillLines,
} from '../heroes/experience-skill-rises-and-earned-hp.js';
import { disperseDeadCharArmies } from '../heroes/hero-death-and-leaderless-hosts.js';
import { applyMoveInterlocks, normaliseAction, orderPhaseActors } from './phase-intents-and-dependency-ordering.js';
import {
  reconcileProvinceCharacters,
  settleRalliedGarrisons,
  updateProvinceMemory,
} from '../world/province-bookkeeping-and-rallied-garrisons.js';
import {
  reconcileDefendRideOuts,
  runDefendAmbush,
  runDefendMaterializedReactions,
  runDefendReactions,
  runReinforcementArrivals,
} from '../units/defend-ride-outs-ambushes-and-reinforcements.js';
import { resolveStalledBattles } from '../battle/stalled-battles-and-beaten-guards.js';
import { resolveUnitGainInProvince } from '../battle/hosts-gained-in-a-province.js';
import { advancePursuit } from '../heroes/pursuits-and-the-catch-roll.js';
import { flagEnemyStandoffs, resolveWarFronts } from '../battle/war-fronts-and-enemy-stand-offs.js';
import { processOrder } from '../orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.js';

// ── THE FOUR STAGES OF A PHASE (plan P1-08k1: the first stages taken out of resolveTurn's phase loop) ────────────
// resolveTurn plays the turn's five phases (seasons) in a loop. Each phase runs these four stages in order, with the
// phase's intents (buildPhaseIntents) declared between the first and the second:
//   1. the start of the phase: the season's line, Herbal Lore's dressing of last phase's wounds, who stands where and
//      every hero's skills as the phase begins, the per-phase marks cleared, the battles left unresolved fought again,
//      rallied garrisons and stranded columns settled, the Plague spread, and a hero hired this phase told he waits;
//   2. intents and reactions: a column still in a battle is locked in place, the movement interlocks pin generals
//      whose province is invaded, a Defend given this phase is on watch from its start, and ordered reinforcements
//      arrive; every order cancelled here becomes a Defend;
//   3. the orders, in two tiers: every order that doesn't move resolves first, in initiative order; then the Defend
//      step (generals ride out, raised hosts settle); then the Moves, Encounters and chases; then the war fronts (in
//      Spring), the watches answering a host raised in them, and the ambushes;
//   4. the end of the phase: skill rises told, a standing Defend cancelled by a later Move, intrusions told, the hosts
//      of fallen commanders dispersed, and the map and each realm's view of it brought up to date.
// Each takes the turn's context first (src/engine/turn/context.js), then the loop's values it reads: the phase, the
// intents, where every hero stood as the phase began. The bodies keep the loop's indent (plan P1-08's Decisions).

export function startPhaseHealingSnapshotsAndStalledBattles(turnContext, ph) {
  const { log, SEASONS, G, presenceByPhase, _warFrontProvs } = turnContext;
  log('system', `— ${SEASONS[ph]} —`);
  // sd29 Herbal Lore: a character who took wounds in the PREVIOUS phase has them dressed at the
  // start of this one, recovering 40% of the damage that fight cost them
  // (rounded, never less than 1). `_hpAtPhaseStart` is the HP snapshot taken here each phase; it
  // persists in the saved state, so wounds taken in the final phase of a turn heal at the start
  // of the next. Only the wounds of that one fight are treated — it is not a standing
  // regeneration.
  (G.characters || []).forEach((c) => {
    if (
      c.alive &&
      c.player != null &&
      c.hp != null &&
      c._hpAtPhaseStart != null &&
      c.hp < c._hpAtPhaseStart &&
      c.hp < (c.maxHp || 20) &&
      hasDisc(turnContext, c.player, 'sd29')
    ) {
      const _dmg = c._hpAtPhaseStart - c.hp;
      const _heal = Math.min(Math.max(1, Math.round(_dmg * discParam('sd29', 'pct', 0.4))), (c.maxHp || 20) - c.hp);
      if (_heal > 0) {
        c.hp = c.hp + _heal;
        // filed under the CHARACTER for THIS phase. It is the first line of the phase, before any
        // order resolves.
        log(
          'system',
          `🌿 Herbal Lore: ${c.name}'s wounds from the previous season are dressed with healing herbs — 40% of the ${_dmg} damage taken is mended. +${_heal} HP (${c.hp}/${c.maxHp || 20}).`,
          {
            actor: c.player,
            targets: [c.player],
            charId: c.id,
            phase: ph,
            provinceId: c.location != null ? c.location : undefined,
          },
        );
      }
    }
    c._hpAtPhaseStart = c.alive && c.hp != null ? c.hp : null;
  });
  // Snapshot presence at phase start (before this phase's moves/battles).
  presenceByPhase[ph] = new Map();
  (G.characters || []).forEach((c) => {
    if (c.alive && c.location != null && c.player != null) {
      let s = presenceByPhase[ph].get(c.location);
      if (!s) {
        s = new Set();
        presenceByPhase[ph].set(c.location, s);
      }
      s.add(c.player);
    }
  });
  // Snapshot every character's skill levels at the START of this phase, before ANY of them train.
  // Group-training comparisons (mentor / peer) read these frozen levels, so a character who
  // trains up earlier this phase can't retroactively become a mentor to a co-trainer who is
  // processed later in the same phase.
  turnContext.enteredThisPhase = {}; // provinces entered during THIS phase only
  G._phaseSkillSnapshot = {};
  (G.characters || []).forEach((ch) => {
    if (ch && Array.isArray(ch.armies) && ch.armies.some((a) => a && a._phantom))
      ch.armies = ch.armies.filter((a) => !(a && a._phantom));
  }); // PHANTOM safety net: strip any stray fighting-copies
  (G.characters || []).forEach((c) => {
    G._phaseSkillSnapshot[c.id] = { ...(c.skills || {}) };
    delete c._encounteredThisPhase;
    delete c._amphibiousAssault;
    delete c._foughtStalledBattlePhase;
    delete c._enteredProvThisPhase;
  });
  // Re-fight any battles whose loser could not retreat last phase (they are still co-located).
  // ILLUSORY L9 VEIL — post-veil re-trigger: once a veil parts, a fight that was skipped while
  // the force was hidden must be joined. Flag any province where two enemy players' armed,
  // UNVEILED forces now stand together and it is not already contested; resolveStalledBattles
  // (next) resolves it.
  flagEnemyStandoffs(turnContext, ph === 0 ? _warFrontProvs : null); // a fresh war front waits for the end of Spring
  resolveStalledBattles(turnContext, ph);
  settleRalliedGarrisons(turnContext); // return rallied garrisons to their province if the contest is won, else keep them with the hero
  settleStrandedAtSea(turnContext, ph); // 2026-09-23c: a column left unshipped by a resumed sea battle (or an old save) puts its excess ashore
  turnContext._logCtx = { charId: null, phase: null }; // clear the battle-leader context set per province above
  turnContext._combatSkillProv = null; // stalled battles done — no series context until the next fight
  spreadPlagues(turnContext, ph);

  // Heroes hired this phase can't act yet, but should still be told so.
  (G.characters || []).forEach((c) => {
    if (c.player !== null && c.alive && c.hiredInPhase === ph) {
      log('hire', `${c.name} was hired this phase and will be ready to act from the next phase.`, {
        actor: c.player,
        targets: [c.player],
      });
    }
  });
}

export function pinAndReactToPhaseIntents(turnContext, ph, intents) {
  const { G, log } = turnContext;
  // ── STAGE 1b: battle-lock pin (AK: you are stuck in a province until its battle is decided) ──
  // resolveStalledBattles(ph) has just re-fought every contested province. Any province that is
  // STILL flagged _battleUnresolved has an unresolved battle whose outcome pins the forces in it:
  // an army-leader standing there cannot march away this phase — they must see the fight through.
  // This is what stops a character who won a battle but whose foe rallied from slipping out to
  // start a fresh battle somewhere else. Only relocating orders (Move / Pursue) are cancelled;
  // other orders are left untouched.
  intents.forEach((it) => {
    if (it.cancelled) return;
    if (it.action !== 'move' && it.action !== 'pursue' && it.action !== 'encounter') return; // an Encounter chase is a relocating order
    if (!it.leadsArmy) return;
    const here = G.world.provinces[it.fromId];
    // a character fought their one battle for the phase if EITHER their province is still
    // contested (unresolved) OR resolveStalledBattles just fought a follow-up battle for them
    // this phase (win or lose). Both must cancel a Move/Pursue so they can't march on and start a
    // SECOND battle in the same phase.
    const _stillContested = !!(here && here._battleUnresolved);
    const _foughtFollowUp = it.c._foughtStalledBattlePhase === ph;
    if (!_stillContested && !_foughtFollowUp) return;
    it.cancelled = true;
    it.cancelReason = 'battleLocked';
    log(
      'combat',
      _stillContested
        ? `${it.c.name} is still locked in the unresolved battle for ${here.name} and cannot march away — the fight must be seen through before they can move on.`
        : `${it.c.name} has already fought a battle this phase and cannot march on to start another — one battle per phase.`,
      {
        actor: it.player,
        targets: [it.player],
        provinceId: it.fromId,
        public: false,
        charId: it.id,
        phase: ph,
        pinNotice: true,
      },
    );
  });

  // ── STAGE 2a: movement interlocks — pin generals whose province is invaded before they leave
  // ──
  applyMoveInterlocks(turnContext, ph, intents);
  intents.forEach((it) => {
    if (!it.cancelled) return;
    if (!G.turnOrders[it.id]) G.turnOrders[it.id] = [null, null, null, null, null];
    const _pinDesc = it.cancelReason === 'battleLocked' ? 'Locked in ongoing battle' : 'Defend (held in place)';
    G.turnOrders[it.id][ph] = { action: 'defend', target: '', extra: '', desc: _pinDesc, _pinned: true };
    it.action = 'defend';
    it.toId = null;
    it.dest = null;
  });

  // ── STAGE 2b: Defending generals react, and ordered reinforcements arrive, before the
  // invasions that provoked them resolve ──
  // a Defend order given THIS phase is on watch from the start of the phase — the general answers
  // incursions in the same phase he is ordered to Defend, not only from the next. Pre-activate it
  // here (the 'defend' case later re-stamps the same watch; it keeps the one-reaction-per-phase
  // marker if this pre-activation already spent it). Pinned/rewritten orders, characters with no
  // order at all (which default to Defend only in name), and live pursuits are left alone.
  intents.forEach((it) => {
    if (it.cancelled || it.action !== 'defend' || !it.order || it.order._pinned) return;
    const c = it.c;
    if (!c || !c.alive || c.player == null) return;
    if (c._pursuit && c._pursuit.active) return;
    if (defendSpentThisPhase(turnContext, c, ph)) return; // item 15: already fought this phase (a resumed battle) — no new watch until a later Defend
    if (c._defend && c._defend.active && c._defend.setPhase === ph) return;
    const _carried = !!(c._defend && c._defend.active); // a watch already kept from an earlier phase simply continues
    c._defend = { centre: c.location, active: true, setPhase: ph, preActivated: true, carried: _carried };
    delete c._defendReactedPhase;
  });
  // (the Defend ride-out itself is NOT made here any more — see flushDefendStep below: it waits
  // until every non-moving order of the phase, including any aimed at the general, has resolved)
  runReinforcementArrivals(turnContext, ph, intents);
  intents.forEach((it) => {
    if (!it.cancelled || it.cancelReason !== 'reinforced') return;
    if (!G.turnOrders[it.id]) G.turnOrders[it.id] = [null, null, null, null, null];
    G.turnOrders[it.id][ph] = {
      action: 'defend',
      target: '',
      extra: '',
      desc: 'Defend (arrived early)',
      _pinned: true,
    };
    it.action = 'defend';
    it.toId = null;
    it.dest = null;
  });
}

export function resolvePhaseOrdersInTwoTiersAroundTheDefendStep(turnContext, ph, intents) {
  const { G, log } = turnContext;
  // ── STAGE 3: resolve orders, in initiative order adjusted for AK's [3.0] exceptions ──
  const sorted = orderPhaseActors(turnContext, ph, intents);
  // ── THE DEFEND STEP ── sits between the two order tiers. Every non-relocating order (casting,
  // transfers, items, recruiting…) resolves first, in initiative order, with everyone still
  // standing where the phase began — so an Oratory, a handed-over column or a hostile Curse aimed
  // at a general on Defend finds him at home. THEN generals on Defend ride out to the marching
  // threats announced at the top of the phase, THEN hosts raised/summoned during the order step
  // are settled (the watching general arriving first), and only then does any Move resolve — so
  // he is still in the line before the invader arrives and before a raised host can take ground.
  // Fires once: before the first relocating or Defend-tier actor, or after the loop if none.
  turnContext._tier0Open = true;
  turnContext._unitGainQueue = [];
  const flushDefendStep = () => {
    if (!turnContext._tier0Open) return;
    turnContext._tier0Open = false;
    turnContext._combatSkillProv = null;
    turnContext._logCtx = { charId: null, phase: null };
    runDefendReactions(turnContext, ph, intents);
    const q = turnContext._unitGainQueue;
    turnContext._unitGainQueue = [];
    q.forEach(({ c: rc, prov: rp }) => {
      if (!rc || !rc.alive || rc.location !== rp.id || (rc.armies || []).length === 0) return; // the host is gone
      turnContext._combatSkillProv = null;
      turnContext._logCtx = { charId: rc.id, phase: ph };
      resolveUnitGainInProvince(turnContext, rc, rp, ph);
      turnContext._logCtx = { charId: null, phase: null };
    });
    turnContext._combatSkillProv = null;
  };
  sorted.forEach((c) => {
    if (turnContext._tier0Open) {
      const _a = normaliseAction((G.turnOrders[c.id] || [])[ph]);
      if (
        _a === 'move' ||
        _a === 'pursue' ||
        _a === 'encounter' ||
        _a === 'defend' ||
        (c._pursuit && c._pursuit.active)
      )
        flushDefendStep();
    }
    turnContext._combatSkillProv = null; // between independent actors, no battle-series context is active
    // A live pursuit suspends this character's other orders until the chase resolves.
    if (c.alive && c._pursuit && c._pursuit.active && c._pursuit.setPhase !== ph) {
      turnContext._logCtx = { charId: c.id, phase: ph };
      advancePursuit(turnContext, c, ph);
      turnContext._logCtx = { charId: null, phase: null };
      settleStrandedAtSea(turnContext, ph); // a chase that ended in a sea battle
      return;
    }
    // A coward who begged for mercy this turn is broken and out of action — skip all remaining
    // orders.
    if (c._mercyFledTurn === G.turn) {
      turnContext._logCtx = { charId: null, phase: null };
      return;
    }
    const o = (G.turnOrders[c.id] || [])[ph];
    // 2026-09-21: processOrder returns silently for a dead character, so a hero killed in an
    // earlier phase simply stopped mid-Chronicle with no explanation for the orders his player
    // had submitted. Say it plainly instead.
    if (o && c.alive === false) {
      if (c.killedThisTurn && !c._fallenOrderNoted) {
        c._fallenOrderNoted = true;
        log('system', `${c.name} has fallen — their remaining orders for this turn go unanswered.`, {
          actor: c.player,
          targets: [c.player],
          charId: c.id,
          phase: ph,
        });
      }
      turnContext._logCtx = { charId: null, phase: null };
      return;
    }
    if (o) processOrder(turnContext, c, o, ph);
    turnContext._logCtx = { charId: null, phase: null }; // reset after each character
    settleStrandedAtSea(turnContext, ph); // 2026-09-23c: hulls lost in this order's battle — put the uncarried ashore before anyone moves again
  });

  flushDefendStep(); // a phase with no relocating or Defend-tier actor still gets its Defend step
  if (ph === 0) resolveWarFronts(turnContext, ph); // hosts caught on a war front turn on the province at the end of Spring
  // every order this phase has resolved, so any enemy force RAISED or SUMMONED into a defender's
  // watch zone now exists — let generals on Defend ride out and give it battle.
  turnContext._combatSkillProv = null;
  runDefendMaterializedReactions(turnContext, ph);
  turnContext._combatSkillProv = null;
  // lone characters on Defend now spring their Spy-gated ambushes on this phase's incursions.
  runDefendAmbush(turnContext, ph);
  turnContext._combatSkillProv = null;
  reconcileDefendRideOuts(turnContext, ph); // a ride-out that met no battle is explained
}

export function endPhaseSkillRisesFallenCommandersAndProvinceMemory(turnContext, ph, _phaseStartLoc) {
  const { G } = turnContext;
  // all this phase's actions have resolved — now report any incidental skill-rises they earned
  // (Explorer on a move, March on a march, etc.) as the last lines of the phase, so each reads as
  // a consequence of the action that caused it rather than interrupting it.
  resolveAllPendingSkillGains(turnContext); // 2026-09-26b: settle each character's one skill rise for the phase
  if (turnContext._deferredSkillLogs.length) {
    writeDeferredSkillLines(turnContext, turnContext._deferredSkillLogs);
    turnContext._deferredSkillLogs = [];
  }

  // A Move order in a later phase cancels a standing Defend (AK [3.15]).
  (G.characters || []).forEach((c) => {
    if (!c._defend || !c._defend.active) return;
    const nxt = (G.turnOrders[c.id] || [])[ph + 1];
    if (!nxt) return;
    const a = normaliseAction(nxt);
    if (a === 'move' || a === 'pursue' || a === 'encounter') c._defend.active = false; // a later Encounter cancels a standing Defend
  });

  // Generate intrusion notifications for this phase
  generateIntrusionNotifications(turnContext, ph);

  settleStrandedAtSea(turnContext, ph); // every battle, ride-out and ambush of the phase is over
  // ── Fallen-commander sweep ── A commander slain in a pre-battle duel keeps their army through
  // the battle (a junior officer leads); whatever survived is dispersed NOW that the fighting is
  // over — garrison in a friendly province, retreat to adjacent friendly land, or scatter as
  // mercenaries (always mercenaries for neutral characters). Without this sweep, armies would
  // stay attached to a corpse for the rest of the turn.
  (G.characters || []).forEach((dc) => {
    if (dc.alive || (dc.armies || []).length === 0) return;
    // Still contested? The host stays where it is and fights again next phase.
    const _here = G.world.provinces[dc.location];
    if (_here && _here._battleUnresolved) {
      dc._leaderlessHost = true;
      return;
    }
    delete dc._leaderlessHost;
    disperseDeadCharArmies(turnContext, dc);
  });

  // province.characters is derived from character.location — rebuild it before anything reads it,
  // so a battle that moved someone on a copy cannot leave the map out of step.
  reconcileProvinceCharacters(turnContext);
  noteSilentHeroes(turnContext, ph, _phaseStartLoc);
  // snapshot each player's observable view of the world at the end of this phase.
  updateProvinceMemory(turnContext, ph);
  turnContext.enteredThisPhase = {}; // consumed by the snapshot above — start the next phase clean
}
