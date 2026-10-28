// 2026-10-12 (Toby, the battle reports: who beat whom) — a fallen commander's host is told who slew them:
// handleHeroDeath stamps the killer, and disperseDeadCharArmies says it when the host garrisons or scatters, then
// clears it; with no killer known the old wording stands.
// Level 1 (unit): disperseDeadCharArmies and handleHeroDeath called directly in the bare vm, on a world the engine
// makes there, with the provinces staged. Plan P1-08f: this was the last part of tests/battle-faced-turn.test.js,
// which took both from the "  // 4. Run all 5 phases" hook after a turn on the GM portal; the rest of that test (the
// battle's lines, and erodeGuardSurvivors, still nested in resolveTurn) stays there.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// A fallen commander's host is told who slew them: `disperseDeadCharArmies` says so when the host scatters or garrisons
// and then clears the note, keeps the old wording with no killer known, and `handleHeroDeath` stamps the killer for it
// (the lines are facts since P1-12d5: it reads their words through the engine's `theWordsOf`). Called directly in the
// bare `vm` on a staged world (P1-08f: it was `battle-faced-turn`'s last part, through the code-anchor hook after a
// turn)
import { expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext } from '../lib/engine.ts';

interface Province {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters?: unknown[];
  garrisonArmies?: unknown[];
  _battleUnresolved?: unknown;
  [key: string]: unknown;
}
interface World {
  world: { cols: number; rows: number; provinces: Province[] };
  characters: Record<string, unknown>[];
  mercenaries: unknown[];
}

const engine = loadEngine({ seed: 1 });
quietEngineLog(engine);
const tc = turnContext(engine, botWorld(engine, 2, { cols: 10, rows: 6 }, { seaPct: 10 }));
const G = tc.G as unknown as World;
const disperseDeadCharArmies = engineFn(engine, 'disperseDeadCharArmies') as (t: unknown, dead: unknown) => unknown;
const handleHeroDeath = engineFn(engine, 'handleHeroDeath') as (
  t: unknown,
  d: unknown,
  k: unknown,
  o: unknown,
) => unknown;
const getNeighborsP = engineFn(engine, 'getNeighborsP') as (
  p: Province,
  c: number,
  r: number,
  all: Province[],
) => Province[];
const neighbours = (p: Province) =>
  getNeighborsP(p, G.world.cols, G.world.rows, G.world.provinces).filter((q): q is Province => Boolean(q));

// Staged: an enemy province whose land neighbours realm 0 doesn't hold, and a home province of realm 0 away from it.
const land = G.world.provinces.filter((p) => p.terrain !== 'sea');
const enemyProv = land.find((p) => neighbours(p).filter((q) => q.terrain !== 'sea').length >= 2);
if (!enemyProv) throw new Error('the world has no land province with land beside it');
enemyProv.owner = 1;
for (const q of neighbours(enemyProv)) if (q.owner === 0) q.owner = 1;
const near = new Set([enemyProv.id, ...neighbours(enemyProv).map((q) => q.id)]);
const homeProv = land.find((p) => !near.has(p.id));
if (!homeProv) throw new Error('the world has no land province away from the enemy one');
homeProv.owner = 0;

const named = (type: string, q: string, names: string[]) => names.map((unitName) => ({ type, quality: q, unitName }));
const dead = (loc: Province, extra: Record<string, unknown> = {}) => ({
  id: 9101,
  name: 'Tamsin',
  player: 0,
  alive: false,
  location: loc.id,
  armies: named('Shieldwall Levies', 'Average', ['Levy T1']),
  items: [],
  skills: {},
  ...extra,
});
/** The words the prose writes of a line's fact (plan P1-12d5: a hero's death's lines are facts). */
const theWordsOf = engineFn(engine, 'theWordsOf') as (fact: unknown) => string;
/** The GM's log lines written while fn runs, in words. */
const linesOf = (fn: () => unknown): string[] => {
  const n0 = tc.turnLog.length;
  fn();
  return tc.turnLog.slice(n0).map((e) => (e['fact'] === undefined ? String(e['text']) : theWordsOf(e['fact'])));
};

test('a scattered host says who slew its commander, and so does one that garrisons; the note is then cleared', () => {
  G.mercenaries = [];
  expect(linesOf(() => disperseDeadCharArmies(tc, dead(enemyProv, { _slainBy: 'Gorbash' })))).toContain(
    `Tamsin's armies, their commander slain by Gorbash, scatter — they wander as mercenaries near ${enemyProv.name}.`,
  );
  expect(G.mercenaries).toHaveLength(1);
  const d2 = dead(homeProv, { _slainBy: 'Gorbash' });
  expect(linesOf(() => disperseDeadCharArmies(tc, d2))).toContain(
    `Tamsin's armies garrison in ${homeProv.name} after their commander fell to Gorbash.`,
  );
  expect(d2).not.toHaveProperty('_slainBy');
});

test('with no killer known the old wording stands', () => {
  expect(linesOf(() => disperseDeadCharArmies(tc, dead(homeProv)))).toContain(
    `Tamsin's armies garrison in ${homeProv.name} after their fall.`,
  );
});

test("handleHeroDeath stamps the killer, and the slain commander's host names them", () => {
  const ch = {
    id: 9102,
    name: 'Rowan',
    player: 0,
    alive: true,
    hp: 0,
    maxHp: 15,
    race: 'Human',
    temper: 'Brave',
    skills: {},
    items: [],
    armies: named('Yeoman Longbows', 'Average', ['Bow R1']),
    location: homeProv.id,
    tm: {},
  };
  const killer = {
    id: 9103,
    name: 'Gorbash',
    player: 1,
    alive: true,
    hp: 10,
    maxHp: 15,
    race: 'Orcish',
    skills: {},
    items: [],
    armies: [],
    location: homeProv.id,
  };
  G.characters = G.characters.filter((c) => c['id'] !== 9102 && c['id'] !== 9103).concat([ch, killer]);
  homeProv.characters = [...(homeProv.characters ?? []), ch.id, killer.id];
  delete homeProv._battleUnresolved;
  const lines = linesOf(() => handleHeroDeath(tc, ch, killer, {}));
  expect(ch.alive).toBe(false);
  expect(lines).toContain(`Rowan's armies garrison in ${homeProv.name} after their commander fell to Gorbash.`);
});
