// ── THE WORDS OF THE SEA LIFT'S LINES IN A BATTLE (plan P1-12d5: P1-12's Decisions of 2026-10-26, Decisions 2 and 6) ──
// The views write the words of each fact the sea lift's battle lines record (src/engine/units/the-facts-the-sea-lifts-
// battle-lines-record.ts), in the same words the engine wrote before (units/sea-lift-stranding-and-retreats.ts:
// seaTrapLine, navalHoldLine, navalSplitRetreat, _navalLeaveBehind). describeArmy and strandLabel, which the engine
// still calls for its other lines, are imported from it and called on the units the fact copied as the line was told.
// Since P1-12d32 the beaten side is a record, whose label the battle's prose writes (theLabelOfASide), and so is a
// claimant named by his side. A kind with no words here is a compile error (the `never` below).
import type {
  TheFactOfASeaLiftsBattleLine,
  WhyUnitsAreLeftBehind,
} from '../../engine/units/the-facts-the-sea-lifts-battle-lines-record.ts';
import { describeArmy } from '../../engine/dice-and-army-names.ts';
import { strandLabel } from '../../engine/units/sea-lift-stranding-and-retreats.ts';
import type { ASideOfABattle } from '../../engine/battle/the-facts-a-battles-lines-record.ts';
import { theLabelOfASide } from './the-words-of-a-battles-lines.ts';

/** Why units were left behind, as their line says it. */
function theWordsOfWhyUnitsAreLeftBehind(why: WhyUnitsAreLeftBehind): string {
  switch (why) {
    case 'there is no room aboard and no friendly ground to fall back to':
      return 'with no room aboard and no friendly ground to fall back to';
    case 'no friendly water lies alongside for the ships to sail to':
      return 'because no friendly water lies alongside for them to sail to';
  }
}

/** Whose the ground is not while the hulls lie there: a realm's name, a side's label, or "the hunter" (none named). */
function theClaimant(claimant: string | ASideOfABattle | null): string {
  const named = claimant ?? 'the hunter';
  return typeof named === 'object' ? theLabelOfASide(named) : named;
}

/** The units a line names, each as the sea lift names a stranded unit, joined. */
function theStrandedUnits(units: readonly Parameters<typeof strandLabel>[0][]): string {
  return units.map(strandLabel).join(', ');
}

/** The words of one fact of the sea lift's lines in a battle. */
export function theWordsOfASeaLiftsBattleLine(fact: TheFactOfASeaLiftsBattleLine): string {
  switch (fact.kind) {
    case 'a beaten force at sea has too few hulls left to fall back':
      return `⚓ ${theLabelOfASide(fact.sideName)} has too few hulls left afloat to sail the column off ${fact.provinceName}, and no friendly shore lies alongside to land on — there is no falling back.`;
    case 'hulls left ashore still hold a province against its claimant': {
      const { units } = fact;
      return `⚓ ${fact.holdersRealmName ?? 'the enemy'}'s ${describeArmy(units)} still ${units.length === 1 ? 'lies' : 'lie'} off ${fact.provinceName} — the ground is not ${theClaimant(fact.claimantName)}'s while ${units.length === 1 ? 'it is' : 'they are'} there, and the fight resumes next phase.`;
    }
    case 'a beaten fleet puts to sea with what its hulls can carry':
      return `⛵ ${theLabelOfASide(fact.sideName)} puts to sea — the fleet stands off ${fact.provinceName} and makes for ${fact.destinationName}${fact.units.length ? ` with ${describeArmy(fact.units)}` : ' with the hulls alone'}.`;
    case 'bound units the fleet cannot carry dissolve':
      return `— ✨ ${theLabelOfASide(fact.sideName)}'s ${theStrandedUnits(fact.units)} cannot be carried; the binding fails and ${fact.units.length === 1 ? 'it dissolves' : 'they dissolve'}.`;
    case 'units the fleet cannot carry fall back overland and join a garrison':
      return `— ⚓ ${theLabelOfASide(fact.sideName)}'s ${theStrandedUnits(fact.units)} cannot be carried and fall back overland to ${fact.shoreName}, joining its garrison.`;
    case 'a beaten force with ships retreats overland and leaves its ships behind':
      return `${theLabelOfASide(fact.sideName)} retreats overland to ${fact.destinationName} with ${describeArmy(fact.units)} — there is no friendly water to sail to, so the ships are left behind.`;
    case 'a beaten fleet with no friendly water holds the province':
      return `⚓ ${theLabelOfASide(fact.sideName)}'s ships have no friendly water to fall back to and cannot take to the road — they hold ${fact.provinceName} and will fight again.`;
    case 'bound units left behind on the shore dissolve': {
      const { units } = fact;
      return `— ✨ ${theLabelOfASide(fact.sideName)}'s ${theStrandedUnits(units)} ${units.length === 1 ? 'is' : 'are'} left behind ${theWordsOfWhyUnitsAreLeftBehind(fact.why)}; the binding fails and ${units.length === 1 ? 'it dissolves' : 'they dissolve'}.`;
    }
    case "units left behind on the realm's own ground hold it": {
      const { units } = fact;
      return `— ⚓ ${theLabelOfASide(fact.sideName)}'s ${theStrandedUnits(units)} ${units.length === 1 ? 'is' : 'are'} left in ${fact.provinceName} ${theWordsOfWhyUnitsAreLeftBehind(fact.why)} — ${units.length === 1 ? 'it holds' : 'they hold'} the ground and will fight again.`;
    }
    case 'units left behind on ground the realm does not hold scatter as mercenaries': {
      const { units } = fact;
      return `— ⚓ ${theLabelOfASide(fact.sideName)}'s ${theStrandedUnits(units)} ${units.length === 1 ? 'is' : 'are'} left behind ${theWordsOfWhyUnitsAreLeftBehind(fact.why)} on ground the realm does not hold — leaderless, ${units.length === 1 ? 'it scatters' : 'they scatter'} into the mercenary bands.`;
    }
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the sea lift's lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
