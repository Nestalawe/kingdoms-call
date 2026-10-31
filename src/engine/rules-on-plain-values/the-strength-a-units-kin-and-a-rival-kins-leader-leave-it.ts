// ── The strength a unit's kin and a rival kin's leader leave it (plan P1-11c5) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). The battle's armStr (src/engine/battle/terrain-and-unit-strength.ts) asks it after a Druid
// shortfall is taken off; the army card on the player's report (renderReportView, src/ui/player/report.ts) asks it
// through src/shared/, before the card takes a shortfall off (plan P1-11c, question 28 (b) for Toby: the two orders
// round differently, and each stays where it was).
import { KC_RIVAL_RACE } from '../../content/kingdoms-call-data.ts';

/** A unit's figure once its kin and a rival kin's leader have counted, and which of them did. */
export interface TheStrengthAUnitsKinAndARivalKinsLeaderLeaveIt {
  /** The figure handed in, ×1.2 if its king is of its kin, ×1.2 if its leader is, then ×0.8 if a leader of its rival
   *  kin leads it, each rounded to the nearest. */
  readonly strength: number;
  /** The unit's race is its realm's king's. */
  readonly itsKingIsOfItsKin: boolean;
  /** The unit's race is its leader's. */
  readonly itsLeaderIsOfItsKin: boolean;
  /** Its leader is of its race's rival kin (Elves and Dwarves, Humans and Orcs: KC_RIVAL_RACE). */
  readonly aLeaderOfItsRivalKinLeadsIt: boolean;
}

/** HUMANOID RACE AFFINITY and RACIAL ANIMOSITY. Two independent, stacking ×1.2 boosts: a unit of its realm's king's
 *  race, and a unit led by a character (king or hero) of its race (a king leading his own race's troops: ×1.44). Then
 *  ×0.8 for a unit led by a commander of its rival kin. Each is rounded as it is taken. A unit, king or leader with no
 *  race is no one's kin: Creatures, Monsters and skeletons never match, since a character's race is always humanoid. */
export function theStrengthAUnitsKinAndARivalKinsLeaderLeaveIt(
  strength: number,
  theUnitsRace: string | null | undefined,
  theKingsRace: string | null | undefined,
  theLeadersRace: string | null | undefined,
): TheStrengthAUnitsKinAndARivalKinsLeaderLeaveIt {
  const rivalKin: Record<string, string | undefined> = { ...KC_RIVAL_RACE };
  const itsKingIsOfItsKin = !!theUnitsRace && !!theKingsRace && theUnitsRace === theKingsRace;
  const itsLeaderIsOfItsKin = !!theUnitsRace && !!theLeadersRace && theUnitsRace === theLeadersRace;
  const aLeaderOfItsRivalKinLeadsIt = !!theUnitsRace && !!theLeadersRace && rivalKin[theUnitsRace] === theLeadersRace;
  let str = strength;
  if (itsKingIsOfItsKin) str = Math.round(str * 1.2);
  if (itsLeaderIsOfItsKin) str = Math.round(str * 1.2);
  if (aLeaderOfItsRivalKinLeadsIt) str = Math.round(str * 0.8);
  return { strength: str, itsKingIsOfItsKin, itsLeaderIsOfItsKin, aLeaderOfItsRivalKinLeadsIt };
}
