// 2026-10-11 (Toby, battle lines I to III; R-089, R-090): the report draws the lines. A realm battle (realm 0's king
// attacks realm 1's, the two at war, on a province of realm 1's) and a province battle (realm 0's first hero attacks a
// guard made by the test on a free province) must each name the front the ground allows (within the terrain's range),
// draw a 📊 grid line for each side, put the attacker's Longbows in the second line behind his Levies and his cavalry
// on the flank of open ground (in the line on rough ground), print a front line of exactly the front's cells, give
// the ladder its Battle-lines stage and (battle lines II) its Who-faces-whom stage, which ends on the strength the
// attacker's header names, and (battle lines III) say who scouted and that the front it chose is the one drawn; and
// write no undefined or NaN. Nothing here depends on who wins: the grid is drawn before the dice decide the battle.
// The hosts are the old script's: the king's six Levies, three Longbows and two Free Lances against three Dwarven
// Guard and two Ironwood Crossbows; the hero's four Levies, two Longbows and one Gilded Lances against two Goblin
// Hordes and one Orc Berserkers. Each commander fights in melee and refuses every duel, and carries no item.
// How the lines are built from the rows is tests/unit/the-battle-grid-places-each-unit-by-its-role-… and
// tests/unit/who-faces-whom-a-units-matchup-….
//
// Level 1 (unit): combatVsChar and combatVsNPC called directly (tests/lib/a-battle-called-directly.ts) on a world the
// engine makes from KC_SEED; no turn is played. Not lower: the two battles each build their own rows and print their
// own report, and this checks both.
//
// Until plan P1-14d this was tests/battle-lines-report.test.js, one turn on the GM page (lib/scenario.js) that searched
// the map for its two scenes and fought each on whatever ground the world gave it, so it checked one of the two flank
// rules a run. Its checks are kept as they were, and each battle is now fought on the two open grounds (a plain, a
// desert) and the two rough ones with the same front (a forest, a jungle), so both flank rules are checked every run
// (stricter). Not on a mountain: its front of 2 to 4 is narrower than the king's six Levies, so Levies stand in his
// second line too (the old script would have failed on a world that dealt it one). "No page errors" is "throws
// nothing" (an unexpected console.error fails the test: setup/each.ts).
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
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
  type WhatTheBattleWrote,
} from '../lib/a-battle-called-directly.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const RANGE: Record<string, [number, number]> = {
  plain: [6, 8],
  desert: [6, 8],
  sea: [8, 10],
  forest: [4, 6],
  jungle: [4, 6],
  mountain: [2, 4],
};

/** Realm 0's king attacks realm 1's on `terrain`, a province of realm 1's. */
function theRealmBattle(terrain: string): WhatTheBattleWrote {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  G.relations['0-1'] = 'enemy';
  const [A, B] = [0, 1].map((pi) => G.characters.find((c) => c.alive && c.isKing && c.player === pi));
  if (!A || !B) throw new Error('the world has no king in realm 0 or 1');
  const { field: X, from: Z } = aFieldAndTheGroundBesideIt(G, { terrain });
  own(G, X, 1);
  own(G, Z, 0);
  A.armies = companies('Shieldwall Levies', 6, 'Average').concat(
    companies('Yeoman Longbows', 3, 'Average'),
    companies('Free Lances', 2, 'Average'),
  );
  B.armies = companies('Dwarven Guard', 3, 'Average').concat(companies('Ironwood Crossbows', 2, 'Average'));
  for (const c of [A, B]) {
    c.items = [];
    c.encounterPlan = MELEE_AND_NO_DUEL();
  }
  place(G, B, X);
  attackFrom(G, A, Z, X);
  return aBattleBetweenHeroes(tc, A, B, X);
}

/** Realm 0's first hero (not its king) attacks a guard made by the test on `terrain`, a free province. */
function theProvinceBattle(terrain: string): WhatTheBattleWrote {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const H = G.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
  if (!H) throw new Error('realm 0 has no hero but its king');
  const { field: N, from: P } = aFieldAndTheGroundBesideIt(G, { terrain });
  own(G, P, 0);
  const guard = aGuardMadeByTheTest(
    G,
    N,
    companies('Goblin Horde', 2, 'Average').concat(companies('Orc Berserkers', 1, 'Average')),
  );
  H.armies = companies('Shieldwall Levies', 4, 'Average').concat(
    companies('Yeoman Longbows', 2, 'Average'),
    companies('Gilded Lances', 1, 'Average'),
  );
  H.items = [];
  H.encounterPlan = MELEE_AND_NO_DUEL();
  attackFrom(G, H, P, N);
  return aBattleAgainstTheProvince(tc, H, N, guard);
}

describe.each([
  ['realm battle', theRealmBattle, 'FreeL'],
  ['province battle', theProvinceBattle, 'Gild'],
] as const)('the %s', (label, battle, open) => {
  test.each(['plain', 'desert', 'forest', 'jungle'])(
    `on a %s: the front, the grid, the ladder and the scout`,
    (terr) => {
      const { words: lines, text: txt } = battle(terr);
      const m = /📊 Battle lines — the (.+?) allows? a front of (\d+)\./.exec(txt);
      expect(m, `${label}: the report names the front the ground allows`).not.toBeNull();
      const [lo, hi] = RANGE[terr] ?? [6, 8];
      const Wd = Number(m?.[2]);
      expect(
        Wd >= lo && Wd <= hi,
        `${label} (${terr}): a front of ${String(Wd)} is within ${String(lo)}–${String(hi)}`,
      ).toBe(true);
      const grid = lines.filter((l) => l.startsWith('📊') && l.includes('│'));
      expect(grid.length, `${label}: at least one grid line per side`).toBeGreaterThanOrEqual(2);
      const atkFirst = grid.find((l) => l.includes(' 1st │') && l.includes('Levy')),
        atkSecond = grid.find((l) => l.includes(' 2nd │') && l.includes('Bow'));
      expect(atkFirst, `${label}: the attacker's Levies hold the front`).toBeDefined();
      expect(
        !!atkSecond && !(atkFirst ?? '').includes('Bow'),
        `${label}: the attacker's Longbows stand in the second line, behind the front`,
      ).toBe(true);
      const openGround = ['plain', 'desert'].includes(terr);
      expect(
        openGround
          ? new RegExp('flanks: .*' + open).test(atkFirst ?? '')
          : !(atkFirst ?? '').includes('flanks:') && txt.includes(open),
        openGround
          ? `${label} (${terr}): the attacker's cavalry ride the flank`
          : `${label} (${terr}): no flank on rough ground; the cavalry stand in the line`,
      ).toBe(true);
      const widthCells = (atkFirst ?? '').split('│')[1] ?? '';
      expect(widthCells.trim().split(/\s+/).length, `${label}: the front line prints exactly ${String(Wd)} cells`).toBe(
        Wd,
      );
      expect(txt, `${label}: the ladder has its Battle-lines stage for a front of ${String(Wd)}`).toMatch(
        new RegExp('Battle lines \\(front of ' + String(Wd) + '\\): \\d+ → (\\*\\*)?\\d+(\\*\\*)? \\('),
      );
      // Battle lines II: the facing stage follows, and the attacker's strength is the figure it ends on.
      const face = /Who faces whom: \d+ → \*\*(\d+)\*\* \(/.exec(txt),
        head = /Attacker \([^)]*\): \d+ units? — strength \*\*(\d+)\*\*/.exec(txt);
      expect(face, `${label}: the ladder has its Who-faces-whom stage`).not.toBeNull();
      expect(
        !!face && !!head && face[1] === head[1],
        `${label}: the attacker's strength is the figure the facing stage ends on (${String(head?.[1])} / ${String(face?.[1])})`,
      ).toBe(true);
      // Battle lines III: the report says who scouted and that the front it chose is the one drawn.
      const sc =
        /📊 Scouting — (.+?) knows the ground .*?: .*? (takes the front of (\d+) the dice allow|(?:widens|narrows) the front from \d+ to (\d+)) and lines up second/.exec(
          txt,
        );
      expect(sc, `${label}: the report says who scouted and lines up second`).not.toBeNull();
      expect(Number(sc?.[3] ?? sc?.[4]), `${label}: the front the scout chose is the front drawn`).toBe(Wd);
      expect(txt, `${label}: no undefined / NaN in the report`).not.toMatch(/undefined|NaN|\[object Object\]/);
    },
  );
});
