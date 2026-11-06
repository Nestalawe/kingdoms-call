import { COMBAT_ONLY_TACTICS } from '../army-tables.ts';
import { runBotConcessions } from './missions.ts';
import { runBotMovement } from './movement.ts';
import { runBotEconomy, runBotOrderHygiene } from './economy.ts';
import { runBotActions } from './spellcraft.ts';
import { runBotPhaseOne } from './phase-one.ts';
import { runBotReckoning } from '../titles/reckoning.ts';
import { seaPenalty, terrainMod } from '../battle/terrain-and-unit-strength.ts';
import { autoEncounterPlan, pcCharCombatant } from '../personal-combat/speed-encounter-plans-and-combatants.ts';
import { resolvePersonalCombat } from '../personal-combat/resolve-personal-combat.ts';
import { aCopyMadeThroughJson } from '../rules-on-plain-values/a-copy-made-through-json-and-typed-as-its-original.ts';
import type { CharacterId } from '../../schemas/ids-of-provinces-heroes-and-realms.ts';
import type { Character } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';

// ── THE BOTS' PLAN: CONCESSIONS, MOVEMENT, MUSTER, ECONOMY, ACTIONS, SPRING ORDERS, HYGIENE, THE RECKONING, AND THE
// DUEL FORECAST (plan P1-08l2: lifted out of resolveTurn) ─────────────────────────────────────────────────────────────
// Bot realms send no orders, so this is where their turn is decided. resolveTurn calls the plan once a turn, before
// the first phase: after the move pools, the turn's trackers and the save's sweeps, and before every hero still
// without orders is set to Defend. The passes, in this order (each a top-level function in src/engine/bots/): a bot
// with no province left concedes; movement (with the duel forecast for its hunters, and each company's strength on
// each terrain); the muster (hosts in contact take the war chest first, outmatched ones withdraw); the economy; the
// idle heroes' actions; the Spring orders; the order hygiene; and a dominant bot king's call of the Reckoning, added
// to the realms' calls (turnContext.reckoningCalls) that victory reads after the phases.
// The duel forecast fights copies of the hunter and his quarry (ids -1 and -2) `n` times (20 by default) with the
// engine's own personal combat and gives the share won and the share in which the hunter fell; while it runs no skill
// can rise (turnContext._pcSimulating). The plan hands it to the movement pass with the turn's context.
// Each takes the turn's context (src/engine/turn/context.ts) first; their lines keep resolveTurn's indent (plan
// P1-08's Decisions).
// Its types (plan P1-10b48): the forecast takes the turn's context and two heroes of the world; its copies' ids are
// numbers no hero of the world carries.
/** Whether a number is a hero's id as the saved state's schema checks one (`CharacterIdSchema`: a finite number; the
 *  brand is a type only). */
function isAHerosIdAsTheSaveChecksIt(id: number): id is CharacterId {
  return Number.isFinite(id);
}
/** A copy's id in the forecast (−1 the hunter's, −2 his quarry's), typed as a hero's id: it throws for none. */
function aCopysId(id: number): CharacterId {
  if (!isAHerosIdAsTheSaveChecksIt(id)) throw new TypeError(`a copy's id ${String(id)} is no hero's id`);
  return id;
}
export function botHuntersDuelForecastFoughtOnCopiesOfBothHeroes(
  turnContext: TurnContext,
  hunter: Character,
  quarry: Character,
  n?: number,
) {
  // 2026-09-28: a forecast, not a fight — experience is muted exactly as in simulateLairOdds (the copies carry
  // ids −1/−2, so no real hero ever gained from it, but every simulated win still rolled a wasted check).
  const _prevSim = turnContext._pcSimulating;
  turnContext._pcSimulating = true;
  try {
    let win = 0,
      felled = 0;
    const rounds = (n ?? 0) || 20;
    for (let i = 0; i < rounds; i++) {
      const a = aCopyMadeThroughJson(hunter),
        b = aCopyMadeThroughJson(quarry);
      a.id = aCopysId(-1);
      b.id = aCopysId(-2);
      delete a._sgLog;
      delete b._sgLog;
      a.encounterPlan = { tactics: autoEncounterPlan(turnContext, a), notes: '', _auto: true };
      if (!(b.encounterPlan && Array.isArray(b.encounterPlan.tactics) && b.encounterPlan.tactics.length > 0))
        b.encounterPlan = { tactics: autoEncounterPlan(turnContext, b), notes: '', _auto: true };
      const COMBAT_ONLY = COMBAT_ONLY_TACTICS;
      const filt = (pl: readonly string[] | undefined) =>
        (pl ?? ['ME']).filter((t) => COMBAT_ONLY.has((t.split(':')[0] ?? '').toUpperCase()));
      const A = pcCharCombatant(turnContext, a),
        B = pcCharCombatant(turnContext, b);
      A.tactics = filt(a.encounterPlan.tactics);
      B.tactics = filt(b.encounterPlan.tactics);
      if (!A.tactics.length) A.tactics = ['ME'];
      if (!B.tactics.length) B.tactics = ['ME'];
      const res = resolvePersonalCombat(turnContext, A, B, { maxRounds: 20 });
      if (res.winner === A) win++;
      if (res.aHp <= 0 && res.winner !== A) felled++;
    }
    return { win: win / rounds, felled: felled / rounds };
  } catch {
    return null;
  } finally {
    turnContext._pcSimulating = _prevSim;
  }
}

export function botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning(
  turnContext: TurnContext,
) {
  const { G, _botPlayerIdx, reckoningCalls } = turnContext;
  // Phase 3 (pre) — item 2: any bot realm that has lost its last province concedes before it plans
  // a turn.
  runBotConcessions(G, _botPlayerIdx, turnContext);
  runBotMovement(G, _botPlayerIdx, {
    duelSim: (...a) => botHuntersDuelForecastFoughtOnCopiesOfBothHeroes(turnContext, ...a),
    terrainMult: (t, tr) => terrainMod(t, tr) * seaPenalty(t, tr),
  });
  // Phase 3b — economy: holders (characters not moving) in owned provinces spend the treasury on
  // sustainable reinforcements (and opportunistic hires). Must run AFTER movement so movers are
  // skipped.
  runBotPhaseOne(G, _botPlayerIdx, 'muster'); // 2026-09-29: hosts in contact claim the chest first (and outmatched war-front hosts withdraw)
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
}
