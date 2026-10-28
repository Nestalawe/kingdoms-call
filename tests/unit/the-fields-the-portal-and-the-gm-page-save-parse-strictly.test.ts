// What a live save holds that the matrix's games never write (plan P1-15b, Decision 5), parsed strictly against the
// saved state's schema (tests/lib/strict-schema.ts: a key the schema doesn't name fails too). The schema was written
// from the matrix's states (P1-10a1), so it didn't know these, and P1-15d's check at load would have named each one in
// every live game that holds it:
// - the hero order the player portal sends with every submission, as the merge stores it on the realm: one turn of the
//   matrix's game scripted-05 played by resolveTurn, its scripted realm's orders sent with a hero order (the scripted
//   realm never sends one, so the matrix never stores it);
// - the four fields the GM page writes into the save between turns, each staged on that turn's save as its writer
//   writes it: a removed realm's `_gmRemoved` and the save's `_gmRemovedRealms` (removePlayer, src/ui/gm/turn-mode.ts),
//   `archived` and `archivedAt` (setGameArchived, src/db/game-meta.ts);
// - each mark the code writes and keeps in the save (the scan of every name written by assignment, each writer read),
//   staged as its writer writes it.
// A mark a battle writes and wipes before the save stays out of the schema (P1-10b, Choice 2: ArmyInABattle and
// HeroInABattle), so a leaked one is still refused: the last cases plant one of each kind.
// Level 1 (unit): one turn by direct import and values parsed, about 1 s; a static test can't parse a save. Red on its
// base (P1-15a), where the schema names none of these.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// What a live save holds that the matrix's games never write, parsed strictly against the saved state's schema
// (`lib/strict-schema.ts`): the hero order the player portal sends with every submission, as the merge stores it on the
// realm (one turn of `scripted-05` played by `resolveTurn`, its scripted realm's orders sent with a hero order); the GM
// page's four fields, staged on that turn's save as `removePlayer` and `setGameArchived` write them (a realm's
// `_gmRemoved`, the save's `_gmRemovedRealms`, `archived`, `archivedAt`); and each mark the code keeps in the save,
// staged as its writer writes it (a Philosopher's Stone destroyed, hidden lairs, leaderless defenders, Mass Confusion,
// a mastery spell worked, a hero released, Sanctuary, Cataclysm's ruined tax, Veil). A mark a battle wipes before the
// save is still refused where it leaked (`_flakTargeted` on a company, `_tacticalMult` on a hero). Red on its base
// (P1-15a: 14 of 14, the schema named none of these). Level 1: one turn by direct import and values parsed, about 1 s;
// a static test can't parse a save. TypeScript, in `unit/`
import { describe, expect, test } from 'vitest';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { resolveTurn } from '../../src/engine/run-turn.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { GameStateSchema } from '../../src/schemas/saved-game-state.ts';
import { MAP_SIZES, SCRIPTED_REALM } from '../../tools/balance/matrix.ts';
import { GAME, SETUPS, slotRowsJson } from '../lib/matrix-game.ts';
import { strictIssues } from '../lib/strict-schema.ts';

type Obj = Record<string, unknown>;
const copyOf = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const objectsIn = (o: Obj, key: string): Obj[] => {
  const v = o[key];
  return Array.isArray(v) ? v.filter((x): x is Obj => typeof x === 'object' && x !== null) : [];
};

/** scripted-05's new world, as the matrix makes it. */
function newWorld(): Obj {
  kcRng.seed(GAME.seed);
  const g = generateNewGame(copyOf(SETUPS), copyOf(MAP_SIZES[GAME.realms]), 0, { seaPct: GAME.seaPct }) as Obj;
  g['turnMode'] = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
  g['botDifficulty'] = 'hard';
  g['botDiplomacy'] = GAME.diplomacy;
  return g;
}

// The scripted realm's heroes, last first: the order a player sets by dragging the hero cards on the player portal,
// sent with the orders as `heroOrder` (src/ui/player/briefing-and-submit.ts, currentHeroOrderP()).
const world = newWorld();
const heroOrder = objectsIn(world, 'characters')
  .filter((c) => c['player'] === SCRIPTED_REALM && c['alive'] !== false)
  .map((c) => String(c['id']))
  .reverse();

/** Turn 1 of scripted-05, its scripted realm's orders sent with `heroOrder`; the save as resolveTurn gives it back. */
function turnOneWithAHeroOrder(): Obj {
  const state = JSON.stringify(world);
  const rows = JSON.parse(slotRowsJson(state, 1)) as { player_index: number; orders: string | null }[];
  const row = rows.find((r) => r.player_index === SCRIPTED_REALM);
  if (!row?.orders) throw new Error('the scripted realm sent no orders for turn 1');
  row.orders = JSON.stringify({ ...(JSON.parse(row.orders) as Obj), heroOrder });
  const result = resolveTurn(state, rows, 1, Math.floor(kcRng() * 2 ** 32) || 1) as { state: string };
  return JSON.parse(result.state) as Obj;
}

const saved = turnOneWithAHeroOrder();
/** A copy of the save, to stage on. */
const save = (): Obj => copyOf(saved);
/** The save's `key` list's first entry that `pick` takes, in a copy. */
function first(s: Obj, key: string, pick: (o: Obj) => boolean = () => true): Obj {
  const found = objectsIn(s, key).find(pick);
  if (!found) throw new Error(`the save has no ${key} to stage on`);
  return found;
}
const provinces = (s: Obj): Obj => (s['world'] ?? {}) as Obj;
const realmIndex = SCRIPTED_REALM;
const turn = (s: Obj): number => Number(s['turn']);

describe('the hero order the player portal sends, as the merge stores it', () => {
  test('the realm keeps it in the save, as text ids, and the save parses strictly', () => {
    expect(heroOrder.length).toBeGreaterThan(0);
    const realm = objectsIn(saved, 'players')[realmIndex] ?? {};
    expect(realm['heroOrder']).toEqual(heroOrder);
    expect(strictIssues(GameStateSchema, saved)).toEqual([]);
  });
});

describe('the fields the GM page writes into the save, as it writes them', () => {
  test('a realm removed from a game in play (removePlayer): it concedes, marked as removed by the GM', () => {
    const s = save();
    const realm = objectsIn(s, 'players')[realmIndex] ?? {};
    realm['conceded'] = true;
    realm['concededTurn'] = turn(s);
    realm['_gmRemoved'] = true;
    s['_gmRemovedRealms'] = Array.isArray(s['_gmRemovedRealms']) ? s['_gmRemovedRealms'] : [];
    (s['_gmRemovedRealms'] as number[]).push(realmIndex);
    expect(strictIssues(GameStateSchema, s)).toEqual([]);
  });

  test('a game archived (setGameArchived): the flag and the time, as an ISO string', () => {
    const s = save();
    s['archived'] = true;
    s['archivedAt'] = '2026-10-25T09:00:00.000Z';
    expect(strictIssues(GameStateSchema, s)).toEqual([]);
  });
});

// Each mark the code saves: what it is, the file that writes it, and the write, staged on a copy of the save.
const marksTheCodeSaves: [string, string, (s: Obj) => void][] = [
  [
    "_destroyedItems: the Philosopher's Stone, struck from the world once worked",
    'src/engine/orders/item-orders-equip-use-and-send-magic-items.ts',
    (s) => {
      const hero = first(s, 'characters', (c) => c['player'] === realmIndex);
      s['_destroyedItems'] = [{ name: "Philosopher's Stone", turn: turn(s), by: hero['name'], player: hero['player'] }];
    },
  ],
  [
    "_hidden, _hiddenBy: a province's lairs hidden by Hide Lairs, until they fade",
    'src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts',
    (s) => {
      const lair = objectsIn(provinces(s), 'provinces')
        .flatMap((p) => objectsIn(p, 'features'))
        .find((f) => f['monster']);
      if (!lair) throw new Error('the save has no lair');
      lair['_hidden'] = true;
      lair['_hiddenBy'] = realmIndex;
    },
  ],
  [
    "_leaderlessDefenders: a province's neutral defenders whose guard fell, fighting on unled",
    'src/engine/battle/hosts-gained-in-a-province.ts, src/engine/battle/stalled-battles-and-beaten-guards.ts, src/engine/orders/move-order-marches-voyages-and-battles-on-arrival.ts',
    (s) => {
      first(provinces(s), 'provinces', (p) => p['owner'] === null)['_leaderlessDefenders'] = true;
    },
  ],
  [
    "_massConfusedTurn: the turn Mass Confusion took a commander's Tactical",
    'src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts',
    (s) => {
      first(s, 'characters')['_massConfusedTurn'] = turn(s);
    },
  ],
  [
    '_masterySpellUsed: each mastery spell a hero worked, and the turn',
    'src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts',
    (s) => {
      const hero = first(s, 'characters', (c) => c['player'] === realmIndex);
      hero['_masterySpellUsed'] = hero['_masterySpellUsed'] ?? {};
      (hero['_masterySpellUsed'] as Record<string, number>)['Sanctuary'] = turn(s);
    },
  ],
  [
    '_releasedTurn: the turn a realm released a hero into the wilds',
    'src/engine/orders/army-orders-hand-over-garrison-disband-and-pick-up-companies-and-release-a-hero.ts',
    (s) => {
      first(s, 'characters', (c) => c['player'] === realmIndex && c['isKing'] !== true)['_releasedTurn'] = turn(s);
    },
  ],
  [
    '_sanctuaryTurn, _sanctuaryBy: a province warded by Sanctuary, and the realm that warded it',
    'src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts',
    (s) => {
      const p = first(provinces(s), 'provinces', (q) => q['owner'] === realmIndex);
      p['_sanctuaryTurn'] = turn(s);
      p['_sanctuaryBy'] = realmIndex;
    },
  ],
  [
    "_taxDestroyed: a province's tax ruined for good by Cataclysm",
    'src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts',
    (s) => {
      const p = first(provinces(s), 'provinces', (q) => q['owner'] !== null && q['owner'] !== realmIndex);
      p['_earthquakeNoTax'] = turn(s);
      p['tax'] = 0;
      p['_taxDestroyed'] = true;
    },
  ],
  [
    "_veilTurn, _veilCastPhase: the turn and the phase a hero drew Illusory's Veil",
    'src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts',
    (s) => {
      const hero = first(s, 'characters', (c) => c['player'] === realmIndex);
      hero['_veilTurn'] = turn(s);
      hero['_veilCastPhase'] = 2;
    },
  ],
];

describe('the marks the code keeps in the save, as their writers write them', () => {
  test.for(marksTheCodeSaves)('%s', ([, , stage]) => {
    const s = save();
    stage(s);
    expect(strictIssues(GameStateSchema, s)).toEqual([]);
  });
});

describe('a mark a battle wipes before the save is still refused, where it leaked', () => {
  test("a flyer's Flak Screen mark on a company of a hero's column (the 27 September leak)", () => {
    const s = save();
    const hero = first(s, 'characters', (c) => objectsIn(c, 'armies').length > 0);
    const at = objectsIn(s, 'characters').indexOf(hero);
    const company = objectsIn(hero, 'armies')[0];
    if (!company) throw new Error('the hero leads no company');
    company['_flakTargeted'] = true;
    expect(strictIssues(GameStateSchema, s)).toEqual([
      expect.stringMatching(new RegExp(`^characters\\.${String(at)}\\.armies\\.0: unrecognized_keys .*_flakTargeted`)),
    ]);
  });

  test("a commander's Tactical halved by Telekinetic Storm, on the hero", () => {
    const s = save();
    first(s, 'characters')['_tacticalMult'] = 0.5;
    expect(strictIssues(GameStateSchema, s)).toEqual([expect.stringMatching(/^characters\.0: unrecognized_keys /)]);
  });
});
