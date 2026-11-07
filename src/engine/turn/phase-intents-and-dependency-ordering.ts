import { getNeighborsP, neighborInDir } from '../world/map-helpers.ts';
import { whatAMarchsOrderNames } from '../rules-on-plain-values/what-a-marchs-order-names.ts';
import { orderCharRef } from '../heroes/charms-and-neutrals.ts';
import { areEnemies } from '../realms/relations-and-captures.ts';
import { totalInit } from '../heroes/effective-skills-and-hidden-heroes.ts';
import {
  theHeroesWhoMustActFirstInAPhase,
  theOrderTheHeroesActInAPhase,
  whichOfTwoHeroesActsFirstInAPhase,
} from '../rules-on-plain-values/the-order-the-heroes-act-in-a-phase-and-who-must-act-first.ts';
import { stepTowardPreferSafe } from '../world/routes-and-distances.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from './events-and-their-audiences.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { normaliseAction } from '../rules-on-plain-values/the-kind-of-order-each-name-of-an-order-reads-as.ts';
import type { HeroInABattle } from '../army-tables.ts';
import type { Character, Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext, TurnOrder } from './context.ts';

/** What a hero acting this phase intends (buildPhaseIntents): his order and its kind, whether he leads a column, his
 *  initiative, where he stands and where a march takes him; the interlocks and the reinforcements cancel it, saying
 *  why, and the phase's second stage then writes a Defend in its place (its kind, no march, no destination). */
export interface APhaseIntent {
  readonly c: Character;
  readonly id: Character['id'];
  readonly player: Character['player'];
  readonly order: TurnOrder | null;
  action: string;
  readonly leadsArmy: boolean;
  readonly init: number;
  readonly fromId: Character['location'];
  toId: Province['id'] | null;
  dest: Province | null | undefined;
  cancelled: boolean;
  cancelReason: string | null;
}
/** The phase's intents, by hero. */
export type ThePhasesIntents = ReadonlyMap<number, APhaseIntent>;
/** The heroes' orders for the turn as the pipeline reads them while the turn runs (the saved state holds them
 *  cleared, as nulls): by hero (or none), then by phase (or none). */
type TheTurnsOrdersAsThePipelineReadsThem = Readonly<
  Partial<Record<string, readonly (TurnOrder | null | undefined)[]>>
>;

// ── THE PHASE PIPELINE: INTENTS, DEPENDENCY ORDERING, MOVEMENT INTERLOCKS (plan P1-08i1: lifted out of resolveTurn) ────
// Before anyone acts in a phase: what every acting character intends to do (buildPhaseIntents), the order they act in
// (orderPhaseActors: initiative in tiers, the AK [3.0] dependencies first, its rules on plain values since P1-11e16:
// rules-on-plain-values/the-order-the-heroes-act-in-a-phase-…), and the defenders an enemy column pins by arriving
// before they can march out (applyMoveInterlocks). PHASE_ACTION_MAP turns an order's name into the action key
// processOrder and the pipeline share (on plain values since P1-11e20, with normaliseAction: rules-on-plain-values/
// the-kind-of-order-each-name-of-an-order-reads-as.ts). They take the turn's context first (src/engine/turn/context.ts). A pinned column's line is a fact (since P1-12d15: the-facts-a-phases-lines-record.ts), its
// words written in the views.
// ════
// PHASE PIPELINE — intent table, dependency ordering, movement interlocks
// ════
// AK [3.0] resolves a phase as more than a flat initiative queue: characters helping an ally wait
// for that ally, a general ordered to move away from an invaded province stays to fight instead,
// and a pursuer acts immediately after his quarry. All of those need to know what EVERY character
// intends to do this phase BEFORE anyone acts. buildPhaseIntents() produces that read-only table;
// nothing in it mutates game state.

// Resolve a move order's destination WITHOUT moving anybody.
export function intendedDestination(
  turnContext: TurnContext,
  c: Character,
  order: Pick<TurnOrder, 'target'> | null | undefined,
): Province | null | undefined {
  const { G } = turnContext;
  if (!order) return null;
  const t = order.target || '';
  const from = G.world.provinces[c.location];
  if (!from) return null;
  const named = whatAMarchsOrderNames(t);
  if (named.by === 'compass') return neighborInDir(turnContext, from, named.direction);
  // A province, by `prov:<id>` or the bare number alike: the province itself if adjacent, else the first step toward
  // it (mirrors the move case so phase intents / interceptions see where the column will actually go).
  const want = G.world.provinces[named.provinceId];
  if (!want || want.id === from.id) return null;
  if (getNeighborsP(from, G.world.cols, G.world.rows, G.world.provinces).some((n) => n.id === want.id)) return want;
  return stepTowardPreferSafe(turnContext, c, want.id);
}

// Characters who may act this phase (hired heroes only become active the phase AFTER hiring).
export function actingThisPhase(turnContext: Pick<TurnContext, 'G'>, ph: number): Character[] {
  const { G } = turnContext;
  return (asItsGuardReadsIt(G.characters) ?? []).filter((c: HeroInABattle) => {
    if (c.player === null || !c.alive) return false;
    if (c.hiredInPhase != null && c.hiredInPhase >= 0 && ph <= c.hiredInPhase) return false;
    // A charmed ENEMY hero is under your banner (c.player already swapped) but must not act on
    // your orders until the phase AFTER the cast — mirrors the hiredInPhase gate for a sworn
    // wanderer.
    if (c._charmTempControl && c._charmControlFrom != null && ph <= c._charmControlFrom) return false;
    return true;
  });
}

export function buildPhaseIntents(turnContext: TurnContext, ph: number): Map<number, APhaseIntent> {
  const { G } = turnContext;
  const intents = new Map<number, APhaseIntent>();
  const turnOrders: TheTurnsOrdersAsThePipelineReadsThem = G.turnOrders;
  actingThisPhase(turnContext, ph).forEach((c) => {
    const order = (turnOrders[c.id] ?? [])[ph] ?? null;
    const action = normaliseAction(order);
    const leadsArmy = (asItsGuardReadsIt(c.armies) ?? []).length > 0;
    const dest = action === 'move' ? intendedDestination(turnContext, c, order) : null;
    intents.set(c.id, {
      c,
      id: c.id,
      player: c.player,
      order,
      action,
      leadsArmy,
      init: totalInit(c),
      fromId: c.location,
      toId: dest ? dest.id : null,
      dest,
      cancelled: false,
      cancelReason: null,
    });
  });
  return intents;
}

// Does this intent amount to an armed attack on a province held by another player?
export function isHostileInvasion(
  turnContext: Pick<TurnContext, 'G' | 'seaMovePoints' | 'movePoints'>,
  it: APhaseIntent | null | undefined,
): boolean {
  const { G, seaMovePoints, movePoints } = turnContext;
  if (!it || it.cancelled || it.action !== 'move' || !it.leadsArmy || !it.dest) return false;
  const d = it.dest;
  // a column with NO movement left in the pool this march would draw on is not an invasion — the
  // move case will refuse it ("no movement points remaining"). Counting it sent a general on
  // Defend riding out to meet an enemy who never arrived: the player read "march to meet the
  // threat" and then no battle. Pools are per-turn and set at turn start; an undefined pool
  // (never computed) is left to the move case to settle, so it still counts here.
  {
    const from = G.world.provinces[it.fromId];
    const bySea = d.terrain === 'sea' || (!!from && from.terrain === 'sea');
    const pool = asItsGuardReadsIt(bySea ? seaMovePoints[it.id] : movePoints[it.id]);
    if (pool !== undefined && pool !== null && pool <= 0) return false;
  }
  // DIPLOMACY: an invasion is hostile only if the mover is at WAR with the province's owner.
  // Marching into an ally's land (free passage) or a neutral's (turned back at the border) is not
  // an invasion — it must not pin defenders or trigger Defend reactions.
  if (d.owner != null && d.owner !== it.player && areEnemies(turnContext, it.player, d.owner)) return true;
  // An armed ENEMY force standing in the province is an invasion even if the land is unowned.
  return (asItsGuardReadsIt(G.characters) ?? []).some(
    (o) =>
      o.alive &&
      o.location === d.id &&
      (asItsGuardReadsIt(o.armies) ?? []).length > 0 &&
      o.player != null &&
      o.player !== it.player &&
      areEnemies(turnContext, it.player, o.player),
  );
}

// ── Dependency ordering (AK [3.0] exceptions) ────
// Returns [charId_before, charId_after] pairs meaning "before" must be processed first: the rules on plain values
// (theHeroesWhoMustActFirstInAPhase), asked with each intent's recipient and quarry worked out from the world.
export function phaseDependencies(
  turnContext: Pick<TurnContext, 'G'>,
  ph: number,
  intents: ThePhasesIntents,
): [before: number, after: number][] {
  const { G } = turnContext;
  return theHeroesWhoMustActFirstInAPhase(
    new Map(
      [...intents].map(([id, it]) => [
        id,
        {
          id: it.id,
          player: it.player,
          action: it.action,
          fromId: it.fromId,
          toId: it.toId,
          order: it.order,
          theHeroHisOrderHandsTo:
            it.action === 'give_item' || it.action === 'leave_army'
              ? (orderCharRef(G, it.order?.extra)?.id ?? null)
              : null,
          theHeroHePursues: it.c._pursuit?.active ? it.c._pursuit.targetId : null,
        },
      ]),
    ),
  );
}

// Initiative comparator — AK [3.0], on plain values (whichOfTwoHeroesActsFirstInAPhase): each hero's order this
// phase as the turn's orders hold it, read through normaliseAction, and his skills.
export function phaseInitCompare(
  turnContext: Pick<TurnContext, 'G'>,
  ph: number,
): (a: Pick<Character, 'id' | 'skills'>, b: Pick<Character, 'id' | 'skills'>) => number {
  const { G } = turnContext;
  const turnOrders: TheTurnsOrdersAsThePipelineReadsThem = G.turnOrders;
  return (a, b) =>
    whichOfTwoHeroesActsFirstInAPhase(
      { id: a.id, action: normaliseAction((turnOrders[a.id] ?? [])[ph]), skills: a.skills },
      { id: b.id, action: normaliseAction((turnOrders[b.id] ?? [])[ph]), skills: b.skills },
    );
}

// The order the phase's actors act in (theOrderTheHeroesActInAPhase, on plain values): initiative in tiers, with the
// dependencies first; a hero in a cycle of them is appended in initiative order.
export function orderPhaseActors(
  turnContext: Pick<TurnContext, 'G'>,
  ph: number,
  intents: ThePhasesIntents,
): Character[] {
  const { G } = turnContext;
  const turnOrders: TheTurnsOrdersAsThePipelineReadsThem = G.turnOrders;
  const heroes = [...intents.values()].map(({ c }) => ({
    id: c.id,
    action: normaliseAction((turnOrders[c.id] ?? [])[ph]),
    skills: c.skills,
    c,
  }));
  return theOrderTheHeroesActInAPhase(heroes, phaseDependencies(turnContext, ph, intents)).map(({ c }) => c);
}

// ── MOVEMENT INTERLOCKS (AK [3.1]) ────
// "When an army leader Moves into an enemy province, any enemy armies in that province who had
// been ordered to move away and haven't yet moved out of the province, stay for the battle
// instead, unless they are sent to an adjacent province by a general who has Defend orders."
//
// Because every order used to resolve in isolation, two armies ordered into each other's
// provinces simply swapped places — marching straight through one another with no battle. The
// head-on swap is just the most visible case of the general rule, so both are handled here: a
// defender is pinned whenever an armed enemy is due to arrive in his province BEFORE he leaves.
// "Before he leaves" is decided by initiative, so a fast general still gets clear in time.
export function applyMoveInterlocks(turnContext: TurnContext, ph: number, intents: ThePhasesIntents): void {
  const { G } = turnContext;
  const list = [...intents.values()];
  const invasions = list.filter((it) => isHostileInvasion(turnContext, it));
  if (!invasions.length) return;
  const cmp = phaseInitCompare(turnContext, ph);

  list.forEach((def) => {
    if (def.cancelled || def.action !== 'move' || !def.leadsArmy || !def.dest) return;
    // Which hostile forces are arriving in the province this general is standing in?
    const incoming = invasions.filter(
      (inv) => inv.id !== def.id && inv.player !== def.player && inv.toId === def.fromId && !inv.cancelled,
    );
    if (!incoming.length) return;
    // Does at least one of them get there before this general marches out?
    const beatsHim = incoming.some((inv) => cmp(inv.c, def.c) < 0);
    if (!beatsHim) return;
    // Exception: a general under Defend orders may still be redirected to an adjacent province.
    if (def.c._defend?.active) return;

    def.cancelled = true;
    def.cancelReason = 'pinned';
    const home = G.world.provinces[def.fromId];
    const dest = def.dest;
    const swapPartner = incoming.find((inv) => inv.fromId === def.toId);
    if (swapPartner) {
      // Head-on: both were marching into each other's territory. The slower column is caught
      // still forming up and has to turn and fight on its own ground.
      emit(turnContext, {
        type: 'move',
        fact: {
          kind: "a march is pinned head-on by an enemy column marching into the hero's province",
          heroName: def.c.name,
          destinationName: dest.name,
          foeName: swapPartner.c.name,
          provinceName: home ? home.name : null,
        },
        audience: { actor: def.player, realms: [def.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: def.fromId,
      });
    } else {
      emit(turnContext, {
        type: 'move',
        fact: {
          kind: "a march is pinned by an enemy force entering the hero's province first",
          heroName: def.c.name,
          destinationName: dest.name,
          provinceName: home ? home.name : null,
        },
        audience: { actor: def.player, realms: [def.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: def.fromId,
      });
    }
  });
}
