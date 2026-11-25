// A host its flyers carry over open water is told the penalties its land units and its flyers fight at (B-06ay2, which
// moved the two figures, SEA_AIRBORNE_LAND_PENALTY and SEA_AIRBORNE_FLYER_PENALTY, to content's row). A host at sea with
// no hull or sea-beast among it is there only because its flyers carried its foot: its land units fight at ×0.25 and
// the humanoid flyers carrying them at ×0.5 (armStr applies them), and both battles tell it before the fighting: the
// battle against a province's defenders ("Airborne over open water: …") and the battle between two heroes ("<side>'s
// host is airborne over open water: …"). No game of the balance matrix stages such a host; the battle proof's grid
// fights one (flyers carrying foot at sea, B-06az) against the base, and these hold the lines' figures to the row:
// each red on a figure of the row changed.
//
// Level 1 (unit): combatVsNPC and combatVsChar called directly (tests/lib/a-battle-called-directly.ts) on a world the
// engine makes from KC_SEED; no turn is played. Not lower: the line is written inside each battle, from the host it
// fights with. Nothing here depends on the dice: the line is told before the battle's dice decide anything.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import {
  aBattleAgainstTheProvince,
  aBattleBetweenHeroes,
  aFieldAndTheGroundBesideIt,
  aGuardMadeByTheTest,
  attackFrom,
  aWorld,
  companies,
  MELEE_AND_NO_DUEL,
  own,
  place,
  theTurnsContext,
} from '../lib/a-battle-called-directly.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
/** Two companies of Eagle Riders carrying two of Shieldwall Levies: no hull among them. */
const aHostItsFlyersCarry = () =>
  companies('Eagle Riders', 2, 'Average').concat(companies('Shieldwall Levies', 2, 'Average'));
/** The line's words after "airborne over open water: ", in both battles. */
const THE_PENALTIES = 'land units carried by flyers fight at ×0.25, and the flyers carrying them at ×0.5.';

test("against a province's defenders at sea: the host its flyers carry is told its land units' ×0.25 and its flyers' ×0.5", () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const H = G.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
  if (!H) throw new Error('realm 0 has no hero but its king');
  const { field: N, from: P } = aFieldAndTheGroundBesideIt(G, { atSea: true });
  own(G, P, 0);
  const guard = aGuardMadeByTheTest(G, N, companies('Galleon Fleet', 1, 'Average'));
  H.armies = aHostItsFlyersCarry();
  H.items = [];
  H.encounterPlan = MELEE_AND_NO_DUEL();
  attackFrom(G, H, P, N);
  const { words } = aBattleAgainstTheProvince(tc, H, N, guard);
  expect(words, 'the line of a host airborne over open water').toContain(
    `⚠ Airborne over open water: ${THE_PENALTIES}`,
  );
});

test("between two heroes at sea: the attacker's host its flyers carry is told its land units' ×0.25 and its flyers' ×0.5", () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  G.relations['0-1'] = 'enemy';
  const [A, B] = [0, 1].map((pi) => G.characters.find((c) => c.alive && c.isKing && c.player === pi));
  if (!A || !B) throw new Error('the world has no king in realm 0 or 1');
  const { field: X, from: Z } = aFieldAndTheGroundBesideIt(G, { atSea: true });
  own(G, Z, 0);
  A.armies = aHostItsFlyersCarry();
  B.armies = companies('Galleon Fleet', 1, 'Average');
  for (const c of [A, B]) {
    c.items = [];
    c.encounterPlan = MELEE_AND_NO_DUEL();
  }
  place(G, B, X);
  attackFrom(G, A, Z, X);
  const { words } = aBattleBetweenHeroes(tc, A, B, X);
  const theLine = words.find((w) => w.includes('airborne over open water'));
  expect(theLine, 'the line of a host airborne over open water').toBeDefined();
  expect(theLine).toMatch(/^⚠ .+'s host is airborne over open water: /);
  expect(theLine).toContain(`airborne over open water: ${THE_PENALTIES}`);
});
