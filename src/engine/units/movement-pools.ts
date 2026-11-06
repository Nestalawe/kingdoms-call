import { ARMY_SPEED_R } from '../battle/ladder.ts';
import { marchSpeedBonus, navalSpeedBonus } from './movement.ts';
import { SEA_TYPES } from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { seaLiftOfAColumn } from '../rules-on-plain-values/ships-and-flyers-that-carry-a-column-across-the-sea.ts';
import {
  aColumnLeadingShipsMayNotStepFromLandToLand,
  canEnterTerrain,
} from '../rules-on-plain-values/where-a-column-may-step-the-ground-a-neutral-realms-border-and-ships-over-land.ts';
import type { AColumnAsTheTerrainTestsReadIt } from '../rules-on-plain-values/where-a-column-may-step-the-ground-a-neutral-realms-border-and-ships-over-land.ts';
import {
  theMovePointsAPoolHasLeftOnceItsMaximumChanges,
  theMovePoolsOfAColumn,
} from '../rules-on-plain-values/the-move-pools-a-column-marches-and-sails-by-and-the-pool-a-step-spends.ts';
import { whatARealmsDiscoveriesAddToAMarch } from '../rules/the-registry-of-discovery-effects.ts';
import { charMinor } from '../titles/title-holders-and-battle-merit.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { perkTier } from '../titles/perks.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { UnitOfAType } from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import type { PuttingToSea } from '../rules-on-plain-values/ships-and-flyers-that-carry-a-column-across-the-sea.ts';
import type { Character } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';

/** A hero as his move pools are worked out: as his skills and his minor titles are read, whose he is, and his column;
 *  a hero of the world, or one a skill rise is drawn for (a fight's copy's id is words). */
type AHeroAsHisPoolsAreWorkedOut = NonNullable<Parameters<typeof effStat>[1]> &
  NonNullable<Parameters<typeof charMinor>[1]> & {
    readonly player?: Character['player'];
    readonly armies?: Character['armies'];
  };
/** A hero as his move pools are refreshed: as they are worked out, his id perhaps missing (the refresh's guard). */
type AHeroAsHisPoolsAreRefreshed = Omit<AHeroAsHisPoolsAreWorkedOut, 'id'> & {
  readonly id?: AHeroAsHisPoolsAreWorkedOut['id'] | null | undefined;
};
/** The turn's move pools by a hero's id, read by any hero's id (a fight's copy's is words). */
interface TheMovePoolsByAnyHerosId {
  readonly movePoints: Partial<Record<string, number>>;
  readonly seaMovePoints: Partial<Record<string, number>>;
  readonly seaMoveActive: Partial<Record<string, boolean>>;
  readonly seaCap: Partial<Record<string, string>>;
  readonly moveMax: Partial<Record<string, number>>;
  readonly seaMoveMax: Partial<Record<string, number>>;
}
/** Whether the hero whose pools are refreshed holds an id, as every hero of the world does. */
function hisIdIsHeld(c: AHeroAsHisPoolsAreRefreshed): c is AHeroAsHisPoolsAreRefreshed & AHeroAsHisPoolsAreWorkedOut {
  return c.id != null;
}

// ── MOVEMENT POOLS (plan P1-08b: lifted out of resolveTurn) ────
// Where a column may step, and each hero's move points for the turn: the land and sea pools (resolveTurn's movePoints,
// seaMovePoints, seaMoveActive, seaCap, moveMax and seaMoveMax, which join the turn's context by reference), set at
// the start of the turn and refreshed when a column changes; and the chance that two contingents unify.
// computeMovePoolMax, setMovePool and refreshMovePool take the turn's context first (src/engine/turn/context.ts); the
// rest read no turn state. Whether a column can put to sea (getSeaCapability; plan P1-13e1 moved it here from
// sea-lift-stranding-and-retreats.ts) comes first: canEnterTerrain (in rules-on-plain-values/, P1-11e4) and the sea
// pool read its answer.
// Get movement allowance for a character AT THE START OF THE TURN (before any armies picked up)
// stored per character for the whole turn
export function getSeaCapability(
  armies: readonly (UnitOfAType | null | undefined)[] | null | undefined,
  leadChar: Parameters<typeof perkTier>[0],
): PuttingToSea {
  // The rule is seaLiftOfAColumn's (plan P1-11b4 moved the body there, so the player portal's Move notice asks it
  // too); the leader's naval mastery is worked out here. NAVAL L8: one naval hull carries what once needed two.
  return seaLiftOfAColumn(armies, !!leadChar && perkTier(leadChar, 'naval') >= 3).answer;
}

// 2026-10-08 (Toby item 14): can this column step from `from` into `to`? canEnterTerrain judges only the
// ground it would stand on; the Move order also forbids a column leading ANY naval unit (fleet or
// sea-beast) to step from one land province to another — ships cannot cross land (see the move
// case: "cannot march overland while leading naval units"). The Defend ride-outs and the force-march
// reinforcement checked terrain alone, so a general with ships and troops in a coastal province rode
// out overland to a neighbour on Defend. Every path that marches a column without a Move order now
// asks this instead.
export function canStepBetween(
  c: AColumnAsTheTerrainTestsReadIt,
  from: { readonly terrain: string } | null | undefined,
  to: { readonly terrain: string } | null | undefined,
  cap: string,
): boolean {
  if (!to || !canEnterTerrain(c, to.terrain, cap)) return false;
  const naval = (c.armies ?? []).some((a: UnitOfAType | null | undefined) => a && SEA_TYPES.has(a.type));
  if (from && aColumnLeadingShipsMayNotStepFromLandToLand(naval, from.terrain, to.terrain)) return false;
  return true;
}

// The March speed table is MARCH_NAVAL_BONUS at module level (item 14: one rate for every unit).
// Unify chance table [0 distance, 1 distance, 2 distance] by March level
export const MARCH_UNIFY = [
  [80, 50, 20],
  [90, 60, 30],
  [100, 70, 40],
  [100, 80, 50],
  [100, 90, 60],
  [100, 100, 70],
];

// Naval table: similar to March but for sea movement, +20% fleet str per level
export const NAVAL_UNIFY = [
  [80, 50, 20],
  [90, 60, 30],
  [100, 70, 40],
  [100, 80, 50],
  [100, 90, 60],
  [100, 100, 70],
];

// A character's move-pool MAXIMUMS from CURRENT army composition + skills: theMovePoolsOfAColumn's (rules-on-plain-
// values/, plan P1-11e5), handed what this reads of the world. Returns {land, sea, seaActive, cap}. Shared by
// setMovePool (turn start) and refreshMovePool (mid-turn, after composition or March/Naval changes), so both stay
// perfectly in step.
export function computeMovePoolMax(turnContext: TurnContext, c: AHeroAsHisPoolsAreWorkedOut) {
  const armies = (asItsGuardReadsIt(c.armies) ?? []).filter(
    (a: Character['armies'][number] | null | undefined) => a && !a._phantom,
  ); // illusions set no pace and take no berth
  const marchLevel = effStat(turnContext, c, 'march');
  const navalLevel = effStat(turnContext, c, 'naval');
  const hisRealm = c.player;
  const { land, sea, seaActive } = theMovePoolsOfAColumn({
    companies: armies,
    theSpeedOfEachType: ARMY_SPEED_R,
    whatHisMarchAddsOnLand: Number(marchSpeedBonus(marchLevel)),
    whatHisNavalAddsToAShipOfTheSpeed: (base) => Number(navalSpeedBonus(base, navalLevel)),
    whatHisRealmsDiscoveriesAddTo:
      hisRealm != null
        ? (a) => whatARealmsDiscoveriesAddToAMarch(turnContext.G.players[hisRealm], { theUnit: a })
        : null,
    heHoldsSwift: charMinor(turnContext, c, 'swift'),
    heHoldsSeawolf: charMinor(turnContext, c, 'seawolf'),
  });
  return { land, sea, seaActive, cap: getSeaCapability(armies, c) };
}
export function setMovePool(turnContext: TurnContext, c: Character): void {
  const { movePoints, seaMovePoints, seaMoveActive, seaCap, moveMax, seaMoveMax } = turnContext;
  const m = computeMovePoolMax(turnContext, c);
  movePoints[c.id] = m.land;
  seaMovePoints[c.id] = m.sea;
  seaMoveActive[c.id] = m.seaActive;
  seaCap[c.id] = m.cap;
  moveMax[c.id] = m.land;
  seaMoveMax[c.id] = m.sea;
}
// Recompute the pool mid-turn after a composition change (transfer/give/garrison/disband) or a
// March/Naval skill gain, WITHOUT refunding or double-spending: points already spent this turn
// are preserved, so dropping a slow unit correctly frees up the extra reach for the rest of the
// turn, and picking up a slow unit correctly reduces it. (Fixes: army stuck at an old slow speed
// after a slow unit was transferred out; move rate not rising when March increased mid-turn.)
export function refreshMovePool(turnContext: TurnContext, c: AHeroAsHisPoolsAreRefreshed | null | undefined): void {
  const { moveMax, movePoints, seaMoveMax, seaMovePoints, seaMoveActive, seaCap }: TheMovePoolsByAnyHerosId =
    turnContext;
  if (!c || !hisIdIsHeld(c)) return;
  const oldLandMax = moveMax[c.id] ?? movePoints[c.id] ?? 0;
  const oldSeaMax = seaMoveMax[c.id] ?? seaMovePoints[c.id] ?? 0;
  const oldLandRem = movePoints[c.id] ?? oldLandMax;
  const oldSeaRem = seaMovePoints[c.id] ?? oldSeaMax;
  const m = computeMovePoolMax(turnContext, c);
  // Composition-change accounting WITHOUT retroactive penalties: theMovePointsAPoolHasLeftOnceItsMaximumChanges's
  // (rules-on-plain-values/, plan P1-11e5), which says how.
  movePoints[c.id] = theMovePointsAPoolHasLeftOnceItsMaximumChanges(oldLandMax, oldLandRem, m.land);
  seaMovePoints[c.id] = theMovePointsAPoolHasLeftOnceItsMaximumChanges(oldSeaMax, oldSeaRem, m.sea);
  seaMoveActive[c.id] = m.seaActive;
  seaCap[c.id] = m.cap;
  moveMax[c.id] = m.land;
  seaMoveMax[c.id] = m.sea;
}

// Contingent unify helper — used when two friendly forces attack same province same phase
export function contingentUnifyChance(marchOrNaval: number, distanceProvinces: number, isNaval: boolean): number {
  const table = isNaval ? NAVAL_UNIFY : MARCH_UNIFY;
  const row = table[Math.min(marchOrNaval, 5)] ?? table[0];
  // (each table holds six rows of three chances, so a row and its last chance are always there)
  if (!row) throw new TypeError('the unify table holds no row');
  const chance = (row[Math.min(distanceProvinces, 2)] ?? 0) || row[row.length - 1];
  if (chance === undefined) throw new TypeError('the unify table holds a row of no chance');
  return chance;
}
