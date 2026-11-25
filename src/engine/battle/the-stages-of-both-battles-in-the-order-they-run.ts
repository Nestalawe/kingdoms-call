// The stages of the two battles, each battle's in the order it fights them: the battle against a province's defenders
// (combatVsNPC, battles-against-province-defenders.ts: N0 to N13) and the battle between heroes (combatVsChar,
// battles-between-heroes.ts: H0 to H10). The one home of their order, their ids, their names in game terms and their
// anchors: the text of the line that opens each stage. Each battle's list is its stage functions in the order the
// battle calls them (a function of the-battle-against-the-defenders/ or the-battle-between-heroes/), each with the
// stages its code holds. The battle takes its stage functions from its list as it starts, not as its module loads (this
// file imports every stage's), one name a function, and calls each once in the list's order. Every anchor is in its
// function's file, once, each below the one before it, but the first stage's: the battle's own function's head, in the
// battle's own file (the set-up's code above the duel's anchor is N0's or H0's through the battle's call). Each anchor
// is found once in src/engine/, this file aside.
// tests/unit/each-battle-is-fought-by-the-stages-its-list-holds-in-the-lists-order.test.ts fails when the list and the
// code part (an anchor changed or moved, two stages swapped, a stage dropped, a call or a binding moved). The battle
// proof (tools/proof/the-stages-of-the-two-battles-and-the-lines-that-open-them.ts) reads this list's text, each side
// its own tree's, to count each battle's dice by stage.
import { theSetUpTheDuelAndTheSidesOfTheBattleAgainstTheDefenders } from './the-battle-against-the-defenders/n0-to-n2-the-set-up-the-duel-and-the-sides-to-the-home-ground.ts';
import { theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders } from './the-battle-against-the-defenders/n3-to-n4-the-attackers-pre-battle-magic-army-spells-archery-flak-and-breach.ts';
import { theDefendersPreBattlePhasesInTheBattleAgainstTheDefenders } from './the-battle-against-the-defenders/n5-to-n7-the-defenders-pre-battle-magic-archery-and-army-spells.ts';
import { theGroundsNotesTheLinesTheFortuneAndTheResultOfTheBattleAgainstTheDefenders } from './the-battle-against-the-defenders/n8-to-n10-the-grounds-notes-the-lines-fortune-and-the-result.ts';
import { theCasualtiesTheRoutAndTheEndOfTheBattleAgainstTheDefenders } from './the-battle-against-the-defenders/n11-to-n13-the-casualties-the-rout-and-the-end.ts';
import { theSetUpTheDuelAndTheSidesOfTheBattleBetweenHeroes } from './the-battle-between-heroes/h0-to-h2-the-set-up-the-duel-and-the-sides-to-the-front.ts';
import { bothSidesPreBattleMagicAndArmySpellsInTheBattleBetweenHeroes } from './the-battle-between-heroes/h3-both-sides-pre-battle-magic-and-army-spells.ts';
import { bothSidesArcheryFlakAndBreachInTheBattleBetweenHeroes } from './the-battle-between-heroes/h4-both-sides-archery-flak-and-breach.ts';
import { sanctuaryTheMasteryOrdersTheLinesTheFortuneAndTheResultOfTheBattleBetweenHeroes } from './the-battle-between-heroes/h5-to-h7-sanctuary-the-mastery-orders-the-lines-fortune-and-the-result.ts';
import { theCasualtiesTheRoutAndTheEndOfTheBattleBetweenHeroes } from './the-battle-between-heroes/h8-to-h10-the-casualties-the-rout-and-the-end.ts';

/** A stage of a battle as its list holds it: its id, what it fights in game terms, and its anchor (the text of the line
 *  that opens it; the lines of an anchor of more than one apart by "\n", each matched whatever its indentation). */
export interface AStageOfABattleInItsList<Id extends string> {
  readonly stage: Id;
  readonly inGameTerms: string;
  readonly anchor: string;
}
/** A stage function of a battle as its list holds it: the function, which takes what the stages before it returned,
 *  and the stages its code holds, in their order. */
export interface AStageFunctionOfABattleInItsList<Id extends string> {
  readonly run: (...whatTheStageReads: never[]) => unknown;
  readonly stages: readonly AStageOfABattleInItsList<Id>[];
}

/** The battle against a province's defenders' stage functions and their stages, N0 to N13, in the order combatVsNPC
 *  calls them. */
export const THE_BATTLE_AGAINST_THE_DEFENDERS_STAGES_IN_THE_ORDER_THEY_RUN = [
  {
    run: theSetUpTheDuelAndTheSidesOfTheBattleAgainstTheDefenders,
    stages: [
      {
        stage: 'N0',
        inGameTerms: 'the set-up: the negations, the tiers that fight, the deploy line, Terror',
        anchor: 'export function combatVsNPC(',
      },
      {
        stage: 'N1',
        inGameTerms: 'the duel before the battle',
        anchor: '// ── Duel before battle ──',
      },
      {
        stage: 'N2',
        inGameTerms:
          "the sides: a slain commander, Tactical, the defender's edge and Siege, Righteous Defence, the items at the walls, home",
        anchor: "// The attacker's side as the facts hold it (plan P1-12d23)",
      },
    ],
  },
  {
    run: theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders,
    stages: [
      {
        stage: 'N3',
        inGameTerms: "the attacker's pre-battle magic and army spells",
        anchor: '// PRE-BATTLE PHASE 1: MAGIC Hero casts first',
      },
      {
        stage: 'N4',
        inGameTerms: "the attacker's archery, Flak and Breach",
        anchor: '// PRE-BATTLE PHASE 2: ARCHERY Each attacker',
      },
    ],
  },
  {
    run: theDefendersPreBattlePhasesInTheBattleAgainstTheDefenders,
    stages: [
      {
        stage: 'N5',
        inGameTerms: "the defenders' commander's pre-battle magic",
        anchor: '// DEFENDER PRE-BATTLE PHASES',
      },
      {
        stage: 'N6',
        inGameTerms: "the defenders' archery",
        anchor: '// DEFENDER ARCHERY — 2026-09-24',
      },
      {
        stage: 'N7',
        inGameTerms: "the defenders' army spells",
        anchor: '// DEFENDER ARMY SPELLS:',
      },
    ],
  },
  {
    run: theGroundsNotesTheLinesTheFortuneAndTheResultOfTheBattleAgainstTheDefenders,
    stages: [
      {
        stage: 'N8',
        inGameTerms: "the terrain's notes and the battle lines, every multiplier",
        anchor: '// ── TERRAIN MODIFIER NOTES ──',
      },
      {
        stage: 'N9',
        inGameTerms: 'the fortune of battle',
        anchor: '// Roll with variance — each side rolls',
      },
      {
        stage: 'N10',
        inGameTerms: 'the stat block and the result',
        anchor: '// ── STAT BLOCK (visible to GM',
      },
    ],
  },
  {
    run: theCasualtiesTheRoutAndTheEndOfTheBattleAgainstTheDefenders,
    stages: [
      {
        stage: 'N11',
        inGameTerms: 'the casualty bands and the carry-on',
        anchor: '// ── MARGIN-BASED CASUALTY SYSTEM ──',
      },
      {
        stage: 'N12',
        inGameTerms: "the fates and the rout's three stages",
        anchor: '// UNIT ABILITIES vs NEUTRAL GUARDS',
      },
      {
        stage: 'N13',
        inGameTerms: 'the end: the spells lifted, the skills learned',
        anchor:
          '// Battle-magic strength reductions last only for this battle\n[\n...(asItsGuardReadsIt(c.armies) ?? []),',
      },
    ],
  },
] as const satisfies readonly AStageFunctionOfABattleInItsList<`N${number}`>[];

/** The battle between heroes' stage functions and their stages, H0 to H10, in the order combatVsChar calls them. */
export const THE_BATTLE_BETWEEN_HEROES_STAGES_IN_THE_ORDER_THEY_RUN = [
  {
    run: theSetUpTheDuelAndTheSidesOfTheBattleBetweenHeroes,
    stages: [
      {
        stage: 'H0',
        inGameTerms: "the set-up and the titles' merit tally",
        anchor: 'export function combatVsChar(',
      },
      {
        stage: 'H1',
        inGameTerms: 'the duel before the battle',
        anchor: '// ── DUEL BEFORE BATTLE (Adventurer Kings rules) ──',
      },
      {
        stage: 'H2',
        inGameTerms: "Righteous Defence, the zeal, Consecrate's seizure, home and the front",
        anchor: '// GOOD — Righteous Defence: +10% when a Good player',
      },
    ],
  },
  {
    run: bothSidesPreBattleMagicAndArmySpellsInTheBattleBetweenHeroes,
    stages: [
      {
        stage: 'H3',
        inGameTerms: "both sides' pre-battle magic and army spells",
        anchor: '// PRE-BATTLE PHASE 1: MAGIC (both sides)',
      },
    ],
  },
  {
    run: bothSidesArcheryFlakAndBreachInTheBattleBetweenHeroes,
    stages: [
      {
        stage: 'H4',
        inGameTerms: "both sides' archery, Flak and Breach",
        anchor: '// PRE-BATTLE PHASE 2: ARCHERY (both sides)',
      },
    ],
  },
  {
    run: sanctuaryTheMasteryOrdersTheLinesTheFortuneAndTheResultOfTheBattleBetweenHeroes,
    stages: [
      {
        stage: 'H5',
        inGameTerms: "Sanctuary, the mastery orders, Consecrate's sickness, Tactical and the lines",
        anchor: '// WHITE L7 — Sanctuary: enemies of the warding caster',
      },
      {
        stage: 'H6',
        inGameTerms: 'the fortune of battle',
        anchor: '// Dice basis unified with the NPC path',
      },
      {
        stage: 'H7',
        inGameTerms: 'the stat block and the result',
        anchor: '// ── STAT BLOCK ── 2026-09-23b',
      },
    ],
  },
  {
    run: theCasualtiesTheRoutAndTheEndOfTheBattleBetweenHeroes,
    stages: [
      {
        stage: 'H8',
        inGameTerms: 'the casualty bands and the carry-on',
        anchor: 'const margRatioPvP = margin / totalStrPvP;',
      },
      {
        stage: 'H9',
        inGameTerms: 'the fates, the rout and the aftermath',
        anchor: '// ── UNIT ABILITIES: casualty & retreat ──',
      },
      {
        stage: 'H10',
        inGameTerms: 'the end: the spells lifted, the skills learned',
        anchor:
          '// Battle-magic strength reductions last only for this battle\n[...(asItsGuardReadsIt(atk.armies) ?? []), ...(asItsGuardReadsIt(def.armies) ?? [])]',
      },
    ],
  },
] as const satisfies readonly AStageFunctionOfABattleInItsList<`H${number}`>[];
