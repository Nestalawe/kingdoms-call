// 2026-10-15 (the maintainer, D3; the ruling R-109: the Corsair fleet is gone): in a game already running, a province
// whose pool still offers the Corsair Fleet offers the Galleon Fleet in its place (or simply loses the Corsairs, if the
// Galleon is already there); a Corsair company already raised is kept. retireCorsairPools does it, in the save's upgrade
// at the top of every turn, so a second run changes nothing; it passes over a hole in the list of provinces and a
// province with no pool (P1-15f4). The books' words, and the calls that run it in the turn, are
// tests/static/no-book-or-player-portal-text-names-the-corsairs-and-letters-of-marque-lifts-the-galleons.test.ts.
//
// Level 1 (unit): retireCorsairPools called on a hand-made world, on the engine's modules (tests/lib/the-whole-engine.ts
// first). Not lower: what the pass does to a pool is computed. It reads no dice, so the outcome is the same on every
// seed.
//
// Until plan P1-14z this was the migration part of tests/corsairs-retired.test.js, which called retireCorsairPools in
// the engine's bundle run in a vm (tests/lib/engine.ts, pinned to seed 1). Its checks are here, one for one ("the GM
// portal declares retireCorsairPools" is the import).
import '../lib/the-whole-engine.ts';
import { beforeAll, expect, test } from 'vitest';
import { retireCorsairPools } from '../../src/engine/saves/retire-the-corsair-pools.ts';

interface AProvinceOfTheHandMadeWorld {
  id: number;
  terrain: string;
  race?: string;
  armyTypes?: string[];
}
/** A running game's save, as small as the pass reads it, with a hero's raised company beside. */
interface TheHandMadeSave {
  world: { provinces: (AProvinceOfTheHandMadeWorld | null)[] };
  characters: { id: string; armies: { type: string; quality: string }[] }[];
}

const aRunningGame = (): TheHandMadeSave => ({
  world: {
    provinces: [
      { id: 0, terrain: 'plain', race: 'Human', armyTypes: ['Shieldwall Levies', 'Corsair Fleet', 'Human Garrison'] },
      { id: 1, terrain: 'plain', race: 'Human', armyTypes: ['Galleon Fleet', 'Corsair Fleet'] },
      { id: 2, terrain: 'forest', race: 'Elven', armyTypes: ['Elven Bowmen', 'Elven Galleys'] },
      { id: 3, terrain: 'sea', armyTypes: [] },
      null,
      { id: 5, terrain: 'plain', race: 'Human' },
    ],
  },
  characters: [{ id: 'h1', armies: [{ type: 'Corsair Fleet', quality: 'Veteran' }] }],
});

let save: TheHandMadeSave;
let provinces: (AProvinceOfTheHandMadeWorld | null)[];
beforeAll(() => {
  save = aRunningGame();
  retireCorsairPools(save);
  provinces = save.world.provinces;
});

test('a pool offering Corsairs offers the Galleon in its place', () => {
  expect(provinces[0]?.armyTypes).toEqual(['Shieldwall Levies', 'Galleon Fleet', 'Human Garrison']);
});

test('a pool that already offers the Galleon simply loses the Corsairs', () => {
  expect(provinces[1]?.armyTypes).toEqual(['Galleon Fleet']);
});

test('a pool without Corsairs is untouched', () => {
  expect(provinces[2]?.armyTypes).toEqual(['Elven Bowmen', 'Elven Galleys']);
});

test('a hole in the list of provinces, and a province with no pool, are passed over', () => {
  expect(provinces[4]).toBeNull();
  expect(provinces[5]).toEqual({ id: 5, terrain: 'plain', race: 'Human' });
  expect(provinces[5]?.armyTypes).toBeUndefined();
});

test('a Corsair company already raised is kept', () => {
  expect(save.characters[0]?.armies[0]?.type).toBe('Corsair Fleet');
});

test('a second run changes nothing (it runs every turn)', () => {
  const before = JSON.stringify(save);
  retireCorsairPools(save);
  expect(JSON.stringify(save)).toBe(before);
});
