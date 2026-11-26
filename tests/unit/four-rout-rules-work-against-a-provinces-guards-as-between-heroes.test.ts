// Four rules of the rout work in a battle against a province's guards as in one between heroes (R-166): the winner's
// Relentless Hunt (Manticores) and Feeding Frenzy (Shark Shoals) add +15% to the beaten side's death rolls; a guard's
// own Warg Riders run a beaten hero down (+15%); the guards' beaten Cave Trolls roll Regenerating Hide's 30%; and the
// guards' beaten Shield Fort, and a Knightly Example, stop a survivor dropping a tier.
//
// Level 1 (unit): combatVsNPC called directly (tests/lib/a-battle-called-directly.ts) on a world the engine makes from
// KC_SEED, and the beaten guards' survivors' fates (erodeGuardSurvivors) and the rout's pursuits (pursuitsOfTheBeaten)
// called directly; no turn is played. Not lower: the beaten guards' death roll and its lines are made inside the
// battle's casualty stage, in no function of their own. Not higher: a whole turn adds orders and dice before the
// battle, and no bot order stages these.
//
// Every input a seed could change is pinned: the dice are one number for the whole battle (withTheDice), so the world's
// seed reaches nothing the battle draws; the realm's race (Human) and alignment (Neutral), the hero's skills, items,
// titles and plan, the companies (type, quality and race given), the ground (a plain of no realm's), the season (the
// first phase) and the guard are the test's own. A hero's temper is a bot's choice of orders and never reaches a battle
// called directly. The figures (the pursuits' 15%, the hide's 30%, the survivors' 35% to flee and 50% to lose a tier)
// are the content rows', written here as literals, so a row's figure changed fails a case.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { pursuitsOfTheBeaten } from '../../src/engine/units/movement.ts';
import { erodeGuardSurvivors } from '../../src/engine/battle/hosts-gained-in-a-province.ts';
import {
  aBattleAgainstTheProvince,
  aFieldAndTheGroundBesideIt,
  aGuardMadeByTheTest,
  attackFrom,
  aWorld,
  type Character,
  type Company,
  companies,
  MELEE_AND_NO_DUEL,
  own,
  theTurnsContext,
  type World,
} from '../lib/a-battle-called-directly.ts';
import { withTheDice } from '../lib/hand-made-battle-lines.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** Realm 0's first hero who isn't its king, Human and Neutral like his realm, with no skill, item or title, a plan that
 *  fights in melee and refuses every duel, leading the companies given. */
function aHeroOfRealm0(G: World, armies: Company[]): Character {
  const realm = G.players[0];
  if (!realm) throw new Error('no realm 0');
  Object.assign(realm, { race: 'Human', alignment: 'Neutral', discoveries: [] });
  const hero = G.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
  if (!hero) throw new Error('realm 0 has no hero but its king');
  Object.assign(hero, {
    race: 'Human',
    alignment: 'Neutral',
    skills: {},
    aptitude: {},
    items: [],
    minorTitles: [],
    hp: 40,
    maxHp: 40,
    encounterPlan: MELEE_AND_NO_DUEL(),
    armies,
  });
  return hero;
}

/** Realm 0's hero, with his companies, attacks a province's guard holding a plain with his; every die shows `dice`. */
function aBattleAgainstAGuard(dice: number, his: Company[], theGuards: Company[]) {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  own(G, from, 0);
  const guard = aGuardMadeByTheTest(G, field, theGuards, { encounterPlan: MELEE_AND_NO_DUEL() });
  const hero = aHeroOfRealm0(G, his);
  attackFrom(G, hero, from, field);
  const battle = withTheDice(
    () => dice,
    () => aBattleAgainstTheProvince(tc, hero, field, guard),
  );
  return { battle, hero };
}

interface AFate {
  kind?: string;
  itsSideWon?: boolean;
  fate?: string;
  theUnit?: { owner?: { kind?: string; heroName?: string } | null };
}

/** The beaten side's companies whose lines tell the fate given, the guards' (their owner the guard) or the hero's. */
const theBeaten = (narrative: readonly NarrativeLine[], fate: string, whose: 'the guards' | 'the hero'): number =>
  narrative.filter((line) => {
    const fact = line as AFate;
    const theGuards = fact.theUnit?.owner?.kind === 'the defenders led by their guard';
    return (
      fact.kind === "a unit's fate in the battle" &&
      fact.itsSideWon === false &&
      fact.fate === fate &&
      (whose === 'the guards' ? theGuards : !theGuards)
    );
  }).length;

const kinds = (narrative: readonly NarrativeLine[]): string[] => narrative.map((l) => (l as { kind: string }).kind);

// An annihilating win: the beaten side's death chance is 0.6. Every die shows 0.7: above it, and below it with the
// pursuit's +0.15 (0.75); above the trapped guards' 0.15 to be cut down with no escape.
const ABOVE_THE_PLAIN_DEATH_CHANCE_AND_BELOW_IT_WITH_A_PURSUIT = 0.7;

test("the winner's Relentless Hunt and Feeding Frenzy add +15% to the beaten guards' death rolls (R-166)", () => {
  const { battle } = aBattleAgainstAGuard(
    ABOVE_THE_PLAIN_DEATH_CHANCE_AND_BELOW_IT_WITH_A_PURSUIT,
    companies('Manticore Pride', 12, 'Elite'),
    companies('Shieldwall Levies', 3, 'Green', 'Human'),
  );
  expect(battle.won, 'the hero beats the guard').toBe(true);
  expect(kinds(battle.narrative), 'the line of the Manticores hunting the broken guards').toContain(
    "the winner's manticore pride hunt the broken companies",
  );
  expect(theBeaten(battle.narrative, 'dies', 'the guards'), 'every beaten guard company dies under the hunt').toBe(3);
  // Feeding Frenzy, at sea, the same pursuit against the guards (and a guard's own shoals against a beaten hero).
  for (const battleOf of ['a hero against neutral guards', 'neutral guards against a hero'] as const) {
    const pursuits = pursuitsOfTheBeaten(companies('Shark Shoals', 2, 'Average'), 'sea', null, battleOf);
    expect(
      pursuits.map((p) => [p.line, p.theFractionAddedToEachBeatenUnitsDeathRoll]),
      `Feeding Frenzy, ${battleOf}`,
    ).toEqual([['the shark shoals tear into the beaten crews', 0.15]]);
  }
});

test("a guard's own Warg Riders run a beaten hero down: +15% to his companies' death rolls (R-166)", () => {
  const { battle } = aBattleAgainstAGuard(
    ABOVE_THE_PLAIN_DEATH_CHANCE_AND_BELOW_IT_WITH_A_PURSUIT,
    companies('Shieldwall Levies', 2, 'Green', 'Human'),
    companies('Warg Riders', 6, 'Elite', 'Orcish'),
  );
  expect(battle.won, 'the guard beats the hero').toBe(false);
  expect(kinds(battle.narrative), "the line of the guards' wargs running the beaten down").toContain(
    "the winner's warg riders run down the broken companies",
  );
  expect(
    theBeaten(battle.narrative, 'dies', 'the hero'),
    "each of the hero's beaten companies dies under the wargs",
  ).toBe(2);
});

test("the guards' beaten Cave Trolls roll Regenerating Hide's 30% when they fail their death roll (R-166)", () => {
  // Every die shows 0.2: below the beaten guards' 0.6 to die, below the hide's 0.3, and above the trapped guards' 0.15.
  const { battle } = aBattleAgainstAGuard(
    0.2,
    companies('Knights', 12, 'Elite', 'Human'),
    companies('Cave Trolls', 1, 'Green'),
  );
  expect(battle.won, 'the hero beats the guard').toBe(true);
  expect(theBeaten(battle.narrative, 'dies', 'the guards'), 'the trolls do not die').toBe(0);
  expect(
    theBeaten(battle.narrative, 'is cut down and rises again by its regenerating hide', 'the guards'),
    'they rise again by their hide',
  ).toBe(1);
});

test("the guards' beaten Shield Fort, and a Knightly Example, stop a survivor dropping a tier (R-166)", () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const { field } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  const guard = { name: 'Warden Testcairn' };
  // Every die shows 0.4: above the 0.35 to flee as mercenaries, below the 0.5 to lose a tier.
  const theFates = (survivors: Company[], theyHeldAShieldFort: boolean) => {
    const told: { fate: string; type: string }[] = [];
    const kept = withTheDice(
      () => 0.4,
      () =>
        erodeGuardSurvivors(
          tc as unknown as Parameters<typeof erodeGuardSurvivors>[0],
          guard,
          field as unknown as Parameters<typeof erodeGuardSurvivors>[2],
          survivors as unknown as Parameters<typeof erodeGuardSurvivors>[3],
          (line) => {
            const l = line as { fate: string; theUnit?: { type: string }; unitType?: string };
            told.push({ fate: l.fate, type: l.theUnit?.type ?? l.unitType ?? '' });
          },
          'Sir Testric',
          theyHeldAShieldFort,
        ),
    );
    return { told, qualities: kept.map((a) => [a.type, a.quality]) };
  };

  const plain = theFates(companies('Dwarven Guard', 2, 'Average', 'Dwarven'), false);
  expect(plain.qualities, 'without a Shield Fort, each loses a tier').toEqual([
    ['Dwarven Guard', 'Green'],
    ['Dwarven Guard', 'Green'],
  ]);
  const fort = theFates(companies('Dwarven Guard', 2, 'Average', 'Dwarven'), true);
  expect(fort.qualities, 'behind a Shield Fort, none does').toEqual([
    ['Dwarven Guard', 'Average'],
    ['Dwarven Guard', 'Average'],
  ]);
  expect(fort.told.map((t) => t.fate)).toEqual([
    'holds its tier behind the shield fort',
    'holds its tier behind the shield fort',
  ]);

  const knightly = theFates(
    [...companies('Gilded Lances', 1, 'Average', 'Human'), ...companies('Shieldwall Levies', 1, 'Average', 'Human')],
    false,
  );
  expect(knightly.qualities, 'the Levies keep their tier under the Knightly Example; the Lances do not').toEqual([
    ['Gilded Lances', 'Green'],
    ['Shieldwall Levies', 'Average'],
  ]);
  expect(knightly.told.map((t) => t.fate)).toEqual([
    'loses heart and falls a tier',
    'keeps its nerve under the knightly example',
  ]);
});
