// The sight rules (src/engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts, plan P1-12b1), called
// directly on a small world made here, one case for each rule a whole game seldom or never meets (plan P1-21b: the
// first mutation session's survivors, 2026-10-24):
// - enemyCharVisibleTo: a hero this realm watches by Clairvoyance is seen under Invisibility, wherever he stands, and
//   beside a hero of its own (R-110: only Clairvoyance sees through Invisibility); one it doesn't watch is not;
// - enemyCharVisibleTo: an enemy hero leading a column (one unit is enough) in this realm's own land is always seen,
//   with none of its heroes there; a lone one is found only by the spotting roll (R-020: a column is always seen);
// - discoverFeat: a feature an older save had marked discovered for everyone (before discovery was kept realm by
//   realm) stays known to every realm when one realm discovers it again; a feature of a newer game is known only to
//   the realms that discovered it.
// Level 1 (unit): each function is called on plain values made in the test; no turn runs. A lower level can't run it.
// refactor-only: each case passes on the base and is red on the fault it was written for (npm run mutants --only).
import { describe, expect, test } from 'vitest';
import type { GameState, ProvinceFeature } from '../../src/schemas/saved-game-state.ts';
import {
  discoverFeat,
  enemyCharVisibleTo,
  featDiscovered,
  type SightContext,
} from '../../src/engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';

const TURN = 6;
const COLS = 4;
const ROWS = 3;
/** Realm 0 holds 1, where none of its heroes stands; its king stands in 10. Realm 1 is its enemy. */
const OWN_LAND = 1;
const KINGS_PROVINCE = 10;
/** A province neither realm holds, where realm 0 has no hero and no spy. */
const FAR_AWAY = 6;
const unit = () => ({ type: 'Shieldwall Levies', quality: 'Average', race: 'Human', unitName: 'Old Guard' });
const hero = (id: number, player: number | null, location: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Hero ${String(id)}`,
  isKing: false,
  player,
  race: 'Human',
  alignment: 'Neutral',
  skills: { melee: 3, spy: 0 },
  armies: [] as unknown[],
  items: [],
  location,
  alive: true,
  ...extra,
});

/** The world, with `stranger` (realm 1's hero, id 1) standing where the case puts him; realm 0 watches `watched` by
 *  Clairvoyance (none if null). Made by hand with the fields the rules read, not a whole saved state. */
function world(stranger: ReturnType<typeof hero>, { turn = TURN, watched = null as number | null } = {}) {
  const provinces = Array.from({ length: COLS * ROWS }, (_, id) => ({
    id,
    row: Math.floor(id / COLS),
    col: id % COLS,
    name: `Province ${String(id)}`,
    terrain: 'plain',
    owner: null as number | null,
    characters: [] as number[],
    features: [] as unknown[],
  }));
  const characters = [hero(0, 0, KINGS_PROVINCE, { isKing: true }), stranger];
  for (const c of characters) provinces[c.location]?.characters.push(c.id);
  const own = provinces[OWN_LAND];
  if (own) own.owner = 0;
  const state = {
    turn,
    world: { cols: COLS, rows: ROWS, provinces },
    players: [
      { id: 0, name: 'Esterhold', provinces: [OWN_LAND, KINGS_PROVINCE], discoveries: [], _clairCharThisTurn: watched },
      { id: 1, name: 'Varn', provinces: [], discoveries: [] },
    ],
    characters,
    relations: { '0-1': 'enemy' },
  };
  return state as unknown as GameState;
}
/** What realm 0 sees from, as the report builds it: its land, where its heroes stand, nothing spied. */
const realmZeroSees = (): SightContext => ({
  ownedProvIds: new Set([OWN_LAND, KINGS_PROVINCE]),
  ownCharLocs: new Set([KINGS_PROVINCE]),
  spiedThisTurn: new Set(),
  nearSpied: new Set(),
});
const sees = (gs: GameState, id: number) => enemyCharVisibleTo(gs, 0, gs.characters[id], realmZeroSees());

describe('a hero watched by Clairvoyance is seen through Invisibility (R-110)', () => {
  const invisible = (location: number) => hero(1, 1, location, { _invisTurn: TURN });

  test('far from any of the realm’s heroes, where it has no line of sight', () => {
    expect(sees(world(invisible(FAR_AWAY), { watched: 1 }), 1)).toBe(true);
  });
  test('beside one of the realm’s heroes', () => {
    expect(sees(world(invisible(KINGS_PROVINCE), { watched: 1 }), 1)).toBe(true);
  });
  test('and a hero under Invisibility it doesn’t watch is not seen, even beside one of its heroes', () => {
    expect(sees(world(invisible(KINGS_PROVINCE)), 1)).toBe(false);
  });
});

describe('an enemy column in the realm’s own land is always seen (R-020)', () => {
  // The spotting roll is the same for the same turn, realm, hero and province (detRoll): at the lurker's Spy 5 it
  // finds him on about a quarter of turns. Over 40 turns a column read as a lone lurker would go unseen on most of
  // them; a column must be seen on every one. No luck decides it: each turn's roll is fixed, and the rule says "always".
  const TURNS = Array.from({ length: 40 }, (_, i) => i + 1);
  const lurker = (armies: unknown[]) => hero(1, 1, OWN_LAND, { skills: { melee: 3, spy: 5 }, armies });

  test('a hero leading one unit, with none of the realm’s heroes there, is seen every turn', () => {
    const unseen = TURNS.filter((turn) => !sees(world(lurker([unit()]), { turn }), 1));
    expect(unseen).toEqual([]);
  });
  test('a hero leading three units is seen every turn', () => {
    const unseen = TURNS.filter((turn) => !sees(world(lurker([unit(), unit(), unit()]), { turn }), 1));
    expect(unseen).toEqual([]);
  });
  test('while a lone hero with no column is found only by the roll: unseen on some of those turns, seen on others', () => {
    const seen = TURNS.filter((turn) => sees(world(lurker([]), { turn }), 1));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.length).toBeLessThan(TURNS.length);
  });
});

describe('a feature an older save marked discovered stays known to every realm', () => {
  const feature = (extra: Record<string, unknown>) =>
    ({ name: 'Troll Den', cleared: false, treasure: 50, ...extra }) as unknown as ProvinceFeature;

  test('an older save’s discovered feature, discovered again by one realm, is still known to the others', () => {
    // before discovery was kept realm by realm, a feature had `discovered` and no `discoveredBy`
    const f = feature({ discovered: true });
    expect([featDiscovered(f, 0), featDiscovered(f, 1)]).toEqual([true, true]);
    discoverFeat(f, 1);
    expect([featDiscovered(f, 0), featDiscovered(f, 1), featDiscovered(f, 2)]).toEqual([true, true, true]);
  });
  test('a newer game’s feature, discovered by one realm, is known to that realm alone', () => {
    const f = feature({ discovered: false, discoveredBy: [] });
    expect(discoverFeat(f, 1)).toBe(true);
    expect([featDiscovered(f, 0), featDiscovered(f, 1), featDiscovered(f, 2)]).toEqual([false, true, false]);
  });
  test('a feature never discovered in an older save, discovered by one realm, is known to that realm alone', () => {
    const f = feature({ discovered: false });
    discoverFeat(f, 1);
    expect([featDiscovered(f, 0), featDiscovered(f, 1)]).toEqual([false, true]);
  });
});
