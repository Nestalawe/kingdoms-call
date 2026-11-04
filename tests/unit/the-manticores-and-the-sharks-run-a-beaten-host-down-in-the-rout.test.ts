// 2026-10-13 (Toby, Creatures and Monsters V; R-106): the two beast abilities whose hooks sit in a battle's rout:
//   Manticore Pride's pursuit    when at least half the winning force are Manticores, every beaten company's chance of
//                                destruction in the rout rises by 15% (as the Wargs' Run Them Down), on any ground;
//   Shark Shoals' Feeding Frenzy the same at sea when at least half the winning force are Shark Shoals.
// Each fight is realm 0's king (an Evil realm's, Druid 5, no Tactical or Naval) attacking realm 1's king, the two
// realms at war, on a province of realm 1's: on a plain, three Elite Manticores (or one among two Cave Trolls) against
// one Green company of Levies; at sea, six Elite Shark Shoals against one Green Galleon Fleet. The odds are
// overwhelming (four times the strength and more: the fortune curve gives the stronger side the win), so the lines are
// the rule's, not the dice's. Both kings fight in melee and refuse every duel, and carry no item.
// The beasts' battle-line abilities are
// tests/unit/the-beasts-battle-line-abilities-from-the-air-on-the-grid-in-the-volley-and-at-their-fate.test.ts.
//
// Level 1 (unit): combatVsChar called directly (tests/lib/a-battle-called-directly.ts) on a world the engine makes from
// KC_SEED; no turn is played. Not lower: the rout is fought inside the battle, from its outcome.
//
// Until plan P1-14d this was tests/abilities-beasts-turn.test.js, turns on the GM page (lib/scenario.js) whose
// staging read the map (realm 0's home and a neighbour of it, or an owned coast and the sea beside it); its six checks
// are kept as they were, and one is stricter: the one-Manticore case now asks for the win first (the old one passed
// on a battle lost, where no side of the attacker's hunts anyone). "No page errors" is "throws nothing" (an unexpected
// console.error fails the test: setup/each.ts).
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import {
  aBattleBetweenHeroes,
  aFieldAndTheGroundBesideIt,
  attackFrom,
  aWorld,
  type Company,
  companies,
  MELEE_AND_NO_DUEL,
  own,
  place,
  theTurnsContext,
} from '../lib/a-battle-called-directly.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** Realm 0's king, his host `atk`, attacks realm 1's king and his host `def` on a province of realm 1's: a plain, or a
 *  sea beside land. Returns the battle's words, one line after another. */
function aBattle(atk: Company[], def: Company[], atSea: boolean): string {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  G.relations['0-1'] = 'enemy';
  const realm0 = G.players[0];
  if (realm0) realm0.alignment = 'Evil';
  const [A, D] = [0, 1].map((pi) => G.characters.find((c) => c.alive && c.isKing && c.player === pi));
  if (!A || !D) throw new Error('the world has no king in realm 0 or 1');
  const { field, from } = aFieldAndTheGroundBesideIt(G, atSea ? { atSea } : { terrain: 'plain' });
  own(G, from, 0);
  own(G, field, 1);
  for (const [c, host] of [
    [D, def],
    [A, atk],
  ] as const) {
    c.armies = host;
    c.skills = { ...c.skills, tactical: 0, druid: 5, naval: 0 };
    c.items = [];
    c.encounterPlan = MELEE_AND_NO_DUEL();
  }
  place(G, D, field);
  attackFrom(G, A, from, field);
  return aBattleBetweenHeroes(tc, A, D, field).text;
}

const beasts = (type: string, n: number) => companies(type, n, 'Elite', 'Primal');
const aGreen = (type: string) => companies(type, 1, 'Green', 'Human');

test('the Manticores hunt the broken companies down (+15% losses) when they are half the winning force', () => {
  const t = aBattle(beasts('Manticore Pride', 3), aGreen('Shieldwall Levies'), false);
  expect(t, 'the Manticores fight the Levies').toMatch(/Battle for|battle is initiated/);
  expect(
    /forces defeat|wins\*\*|\*\*wins/.test(t) && !t.includes('repelled'),
    '…and win (three Elite Manticores against one Green Levy company)',
  ).toBe(true);
  const line = t.split('\n').find((l) => l.includes('+15% losses')) ?? 'no such line';
  expect(
    /Manticore Pride .*(run|hunt|pursue).*broken|pursue the broken companies|Manticores .*broken companies/.test(t) &&
      t.includes('+15% losses'),
    `the pursuit line: the Manticores hunt the broken companies down (+15% losses): ${line.slice(0, 160)}`,
  ).toBe(true);
});

test('one Manticore among two Trolls hunts nobody down', () => {
  const t = aBattle(beasts('Manticore Pride', 1).concat(beasts('Cave Trolls', 2)), aGreen('Shieldwall Levies'), false);
  expect(
    /forces defeat|wins\*\*|\*\*wins/.test(t) && !t.includes('repelled'),
    'the Manticore and the Trolls win (so the beaten are theirs to hunt)',
  ).toBe(true);
  expect(
    /Battle for|battle is initiated/.test(t) && !t.includes('+15% losses'),
    'one Manticore among two Trolls hunts nobody down',
  ).toBe(true);
});

test('Feeding Frenzy: at sea the sharks tear into the beaten crews (+15% losses)', () => {
  const t = aBattle(beasts('Shark Shoals', 6), aGreen('Galleon Fleet'), true);
  expect(t, 'the shoals fight the galleon at sea').toMatch(/Battle for|battle is initiated/);
  const line = t.split('\n').find((l) => l.includes('Feeding Frenzy')) ?? 'no such line';
  expect(
    t.includes('Feeding Frenzy') && t.includes('+15% losses'),
    `Feeding Frenzy: the sharks tear into the beaten crews (+15% losses): ${line.slice(0, 160)}`,
  ).toBe(true);
});
