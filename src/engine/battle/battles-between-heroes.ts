import type { TurnContext } from '../turn/context.ts';
import type { HeroInABattle, ProvinceInABattle } from '../army-tables.ts';
import { THE_BATTLE_BETWEEN_HEROES_STAGES_IN_THE_ORDER_THEY_RUN } from './the-stages-of-both-battles-in-the-order-they-run.ts';

// ── BATTLES BETWEEN TWO HEROES' HOSTS (plan P1-08h: lifted out of resolveTurn) ────
// The army battle between two commanders' hosts in one province (combatVsChar): the duel before it
// (battle/pre-battle-duels.ts), the battle spells, the lines and volleys, the units' fates, the retreats and the
// battle's report lines. It takes the turn's context first (src/engine/turn/context.ts). The battle against a
// province's own defenders is combatVsNPC (battle/battles-against-province-defenders.ts), with the constants both read.
// It is its five stages, each a file of the-battle-between-heroes/ (B-06bf to B-06bj), called in order; the first
// file's head holds the battle's state, every let, the stage file that writes it and those that read it.
// Returns {won, narrative:[strings]}
export function combatVsChar(
  turnContext: TurnContext,
  atk: HeroInABattle,
  def: HeroInABattle,
  prov: ProvinceInABattle,
) {
  // The stage functions, from their list (the one home of the stages' order, H0 to H10), read as the battle starts,
  // not as the module loads (the list's file imports every stage's): one name a function, each its own name, in the
  // list's order, each called once in that order
  // (tests/unit/each-battle-is-fought-by-the-stages-its-list-holds-in-the-lists-order.test.ts).
  const [
    { run: theSetUpTheDuelAndTheSidesOfTheBattleBetweenHeroes },
    { run: bothSidesPreBattleMagicAndArmySpellsInTheBattleBetweenHeroes },
    { run: bothSidesArcheryFlakAndBreachInTheBattleBetweenHeroes },
    { run: sanctuaryTheMasteryOrdersTheLinesTheFortuneAndTheResultOfTheBattleBetweenHeroes },
    { run: theCasualtiesTheRoutAndTheEndOfTheBattleBetweenHeroes },
  ] = THE_BATTLE_BETWEEN_HEROES_STAGES_IN_THE_ORDER_THEY_RUN;
  // The stages, called in order (B-06bf to B-06bj: the-battle-between-heroes/, a file each), each handed the objects
  // the stages before it returned, as they are. The set-up, the duel and the sides, to the front's width and each
  // commander's Archery and Naval: what the later stages read, each final there but the front's width (the scout's
  // deploy changes it in the fourth stage) and the battle's state (the titles' merit tally, which _tallyLost writes).
  const theSetUp = theSetUpTheDuelAndTheSidesOfTheBattleBetweenHeroes(turnContext, atk, def, prov);
  // Both sides' pre-battle magic and army spells: they change the hosts, the commanders and the narrative they are
  // handed, and hand on no value.
  bothSidesPreBattleMagicAndArmySpellsInTheBattleBetweenHeroes(turnContext, atk, def, theSetUp);
  // Both sides' archery, Flak and Breach, with the front's width the set-up rolled (nothing changes it before the
  // fourth stage's deploy): what the later stages read, each final there, the command stage's builders' row among it
  // (made there once Illusory Terrain's flags are set; the last stage's stay-or-retreat check reads it).
  const theArcheryFlakAndBreach = bothSidesArcheryFlakAndBreachInTheBattleBetweenHeroes(
    turnContext,
    atk,
    def,
    prov,
    theSetUp,
    theSetUp.pvpFront,
  );
  // Sanctuary, the mastery orders, the lines, fortune and the result: the whole-force multipliers and the scout's
  // deploy, the fortune of battle, the stat block and who won, to the margin: what the last stage reads, each final
  // there, the front's width after the deploy among it.
  const theLinesTheFortuneAndTheResult =
    sanctuaryTheMasteryOrdersTheLinesTheFortuneAndTheResultOfTheBattleBetweenHeroes(
      turnContext,
      atk,
      def,
      prov,
      theSetUp,
      theArcheryFlakAndBreach,
    );
  // The casualties, the rout and the end: the casualty bands and the carry-on, the fates, the rout and the aftermath,
  // the spells lifted, the skills learned and the statistics' record. It returns what the battle returns.
  return theCasualtiesTheRoutAndTheEndOfTheBattleBetweenHeroes(
    turnContext,
    atk,
    def,
    prov,
    theSetUp,
    theArcheryFlakAndBreach,
    theLinesTheFortuneAndTheResult,
  );
}
