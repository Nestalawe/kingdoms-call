import type { TurnContext } from '../turn/context.ts';
import type { HeroInABattle, ProvinceInABattle } from '../army-tables.ts';
import { THE_BATTLE_AGAINST_THE_DEFENDERS_STAGES_IN_THE_ORDER_THEY_RUN } from './the-stages-of-both-battles-in-the-order-they-run.ts';

// ── BATTLES AGAINST A PROVINCE'S DEFENDERS (plan P1-08g: lifted out of resolveTurn) ────
// A host's battle against the defenders of a province that no hero of a realm holds: its neutral defenders, a local
// chieftain or wandering guard leading them, or a realm's unled garrison (combatVsNPC). It takes the turn's context
// first (src/engine/turn/context.ts), and calls its five stages in order, each from
// the-battle-against-the-defenders/ (B-06az to B-06bd), handing each what the stages before it returned. The constants
// both battle paths read have files of their own beside it: the carry-on death scaling
// (the-death-chances-a-battle-carried-on-round-after-round-scales-by.ts) and the airborne-at-sea penalties
// (the-strength-a-host-carried-over-the-sea-by-flyers-keeps.ts).

// Simple combat resolve
// ── ARMY BATTLE NARRATIVE ENGINE ────
// Narrative vocabulary helpers (P1-12d20: the verbs of an attack and of a defence are the prose's,
// src/views/prose/the-words-of-a-battles-lines.ts; the engine draws an attack's by its index)
export const LOSE_VERBS = ['is repulsed by', 'retreats before', 'cannot break', 'is driven back by'];

export function combatVsNPC(
  turnContext: TurnContext,
  c: HeroInABattle,
  prov: ProvinceInABattle,
  neutralGuardHero: HeroInABattle | null | undefined,
) {
  // The stage functions, from their list (the one home of the stages' order, N0 to N13), read as the battle starts,
  // not as the module loads (the list's file imports every stage's): one name a function, each its own name, in the
  // list's order, each called once in that order
  // (tests/unit/each-battle-is-fought-by-the-stages-its-list-holds-in-the-lists-order.test.ts).
  const [
    { run: theSetUpTheDuelAndTheSidesOfTheBattleAgainstTheDefenders },
    { run: theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders },
    { run: theDefendersPreBattlePhasesInTheBattleAgainstTheDefenders },
    { run: theGroundsNotesTheLinesTheFortuneAndTheResultOfTheBattleAgainstTheDefenders },
    { run: theCasualtiesTheRoutAndTheEndOfTheBattleAgainstTheDefenders },
  ] = THE_BATTLE_AGAINST_THE_DEFENDERS_STAGES_IN_THE_ORDER_THEY_RUN;
  // The set-up, the duel and the sides (B-06az: the-battle-against-the-defenders/, its first stage), to the home ground
  // and the commander's Archery and Naval: what the later stages read, each final there.
  const theSetUp = theSetUpTheDuelAndTheSidesOfTheBattleAgainstTheDefenders(turnContext, c, prov, neutralGuardHero);
  // The attacker's pre-battle phases (B-06ba: the-battle-against-the-defenders/, its second stage), his magic, then his
  // archery, Flak and Breach: what the later stages read, and the battle's state, made there. (His units' army spells
  // strike in the third stage, after both sides' spells and so after his archery: R-162, question 164.)
  const theAttackersPhases = theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders(turnContext, c, prov, theSetUp);
  // The defenders' pre-battle phases (B-06bb: the-battle-against-the-defenders/, its third stage), their commander's
  // magic, their archery and Flak, their units' army spells: each strikes the attacker's host, and hands nothing on.
  theDefendersPreBattlePhasesInTheBattleAgainstTheDefenders(turnContext, c, prov, theSetUp, theAttackersPhases);
  // The ground's notes, the lines, fortune and the result (B-06bc: the-battle-against-the-defenders/, its fourth stage):
  // the terrain's notes and the battle lines with every multiplier, the fortune of battle, the stat block and the
  // result: what the last stage reads, each final there.
  const theLinesAndTheResult = theGroundsNotesTheLinesTheFortuneAndTheResultOfTheBattleAgainstTheDefenders(
    turnContext,
    c,
    prov,
    neutralGuardHero,
    theSetUp,
    theAttackersPhases,
  );
  // The casualties, the rout and the end (B-06bd: the-battle-against-the-defenders/, its fifth and last stage): the
  // casualty bands and the carry-on, the fates and the rout's three stages, the spells lifted, the skills learned and
  // the statistics' record: what the battle returns.
  return theCasualtiesTheRoutAndTheEndOfTheBattleAgainstTheDefenders(
    turnContext,
    c,
    prov,
    neutralGuardHero,
    theSetUp,
    theAttackersPhases,
    theLinesAndTheResult,
  );
}
