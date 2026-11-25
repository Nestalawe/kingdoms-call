// The battle between heroes reads its rows' figures where no staged battle reaches (B-06bk: its numbers moved to
// content's rows, src/content/kingdoms-call-data.ts, each named for its rule). The battle proof's grid (npm run
// proof:battles) never fights under Sanctuary or a Feigned Retreat, and its defending hero always has a realm, so a
// row's figure changed there leaves every staged battle the same, and no game of the matrix reaches them either
// (npm run proof:unreached). Here, on a free plain, two realms at war: the attacker fights at ×0.75 in a province the
// defender's realm warded with Sanctuary this turn
// (KC_THE_STRENGTH_A_SANCTUARYS_WARDS_LEAVE_THE_CASTERS_ENEMIES_IN_A_BATTLE), the defender at ×1 there; a defender whose
// Feigned Retreat springs this turn fights at ×1.25 (KC_THE_MASTERY_ORDERS_FACTORS_IN_A_BATTLE's aFeignedRetreat); each
// read from the battle's strength ladder, the force-wide modifiers it tells. And a defending hero of no realm knows his
// ground fully (KC_THE_DEFENDERS_EDGE_AND_A_REALMS_HOME_GROUND_IN_A_BATTLE's
// theShareOfTheirGroundAProvincesOwnDefendersHaveExplored, 100): against an attacker who has explored 99% of it, the
// defender is the side that scouts and picks the front. The figures are written here as literals, so a row's figure
// changed fails a case.
//
// Level 1 (unit): combatVsChar called directly (tests/lib/a-battle-called-directly.ts) on a world the engine makes from
// KC_SEED; no turn is played. Not lower: each figure is read inside the battle, from the province and the commanders'
// marks, and told in its lines. Not higher: a whole turn adds dice and orders before the battle, and no bot order
// stages these.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import {
  aBattleBetweenHeroes,
  aFieldAndTheGroundBesideIt,
  aGuardMadeByTheTest,
  attackFrom,
  aWorld,
  type Character,
  companies,
  MELEE_AND_NO_DUEL,
  own,
  place,
  type Province,
  theTurnsContext,
  type World,
} from '../lib/a-battle-called-directly.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** The force-wide modifiers each of the battle's strength ladders tells (a side's, a factor of 1 left out), by its
 *  reason: its factor. The defender's ladder is the one with the defenders' edge ('defenders-position'). */
function theForceWideModifiersOfEachLadder(narrative: readonly NarrativeLine[]): Record<string, number>[] {
  const ladders: Record<string, number>[] = [];
  for (const line of narrative) {
    const fact = line as { kind?: string; theForceWideModifiers?: readonly { reason: string; m: number }[] };
    if (fact.kind !== "the strength ladder's force-wide modifiers") continue;
    ladders.push(Object.fromEntries((fact.theForceWideModifiers ?? []).map(({ reason, m }) => [reason, m])));
  }
  return ladders;
}

/** Realm `pi`'s king, with no item, four Veteran Men-at-Arms and a plan that fights in melee and refuses every duel. */
function theKingOf(G: World, pi: number): Character {
  const king = G.characters.find((c) => c.alive && c.isKing && c.player === pi);
  if (!king) throw new Error(`realm ${String(pi)} has no king`);
  Object.assign(king, {
    items: [],
    armies: companies('Men-at-Arms', 4, 'Veteran'),
    encounterPlan: MELEE_AND_NO_DUEL(),
  });
  return king;
}

/** Realm 0's king attacking realm 1's, on a plain realm 1 holds, the two realms at war. */
function aBattleOfTwoKingsOnAPlain(G: World): { attacker: Character; defender: Character; field: Province } {
  G.relations['0-1'] = 'enemy';
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  own(G, field, 1);
  own(G, from, 0);
  const attacker = theKingOf(G, 0);
  const defender = theKingOf(G, 1);
  place(G, defender, field);
  attackFrom(G, attacker, from, field);
  return { attacker, defender, field };
}

test("the attacker fights at ×0.75 in a province the defender's realm warded with Sanctuary this turn", () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const { attacker, defender, field } = aBattleOfTwoKingsOnAPlain(G);
  Object.assign(field, { _sanctuaryTurn: G.turn, _sanctuaryBy: 1 });

  const { narrative } = aBattleBetweenHeroes(tc, attacker, defender, field);
  const ladders = theForceWideModifiersOfEachLadder(narrative);
  const warded = ladders.filter((l) => 'sanctuary-wards' in l);
  expect(warded, `one side fights under the wards (the ladders: ${JSON.stringify(ladders)})`).toHaveLength(1);
  expect(warded[0], "…the attacker's, at ×0.75 (the defender's ladder has the defenders' edge)").toMatchObject({
    'sanctuary-wards': 0.75,
  });
  expect(warded[0], "…not the caster's own side").not.toHaveProperty('defenders-position');
});

test('a defender whose Feigned Retreat springs this turn fights at ×1.25', () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const { attacker, defender, field } = aBattleOfTwoKingsOnAPlain(G);
  defender['_feignedRetreatTurn'] = G.turn;

  const { narrative } = aBattleBetweenHeroes(tc, attacker, defender, field);
  const ladders = theForceWideModifiersOfEachLadder(narrative);
  const ordered = ladders.filter((l) => 'orders' in l);
  expect(ordered, `one side's orders lift it (the ladders: ${JSON.stringify(ladders)})`).toHaveLength(1);
  expect(ordered[0], "…the defender's (its ladder has the defenders' edge), at ×1.25").toMatchObject({
    orders: 1.25,
    'defenders-position': 1.25,
  });
});

test('a defending hero of no realm knows his ground fully: against an attacker who has explored 99%, he scouts', () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  own(G, from, 0);
  const wanderer = aGuardMadeByTheTest(G, field, companies('Men-at-Arms', 4, 'Veteran'), {
    encounterPlan: MELEE_AND_NO_DUEL(),
  });
  const attacker = theKingOf(G, 0);
  field['exploredBy'] = { '0': 99 };
  attackFrom(G, attacker, from, field);

  const { narrative } = aBattleBetweenHeroes(tc, attacker, wanderer, field);
  const scouting = narrative.filter((l) => l.kind === 'the scouting side chooses the front');
  expect(scouting.length, 'the battle tells which side scouts (staging check)').toBe(1);
  expect(
    scouting[0],
    `the defender of no realm scouts, his ground explored more (${JSON.stringify(scouting)})`,
  ).toMatchObject({ itsSideHasExploredMore: true, scoutName: { heroName: wanderer.name } });
});
