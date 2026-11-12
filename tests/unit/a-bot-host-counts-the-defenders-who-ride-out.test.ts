// A general on Defend rides into a neighbouring province of his realm when it is attacked (a rule Toby is keeping).
// A bot weighing an attack on an enemy province (botScanTargets, src/engine/bots/specialists.ts) used to count only what
// stood in it, and an enemy host one province over only lowered the target's score: the hand-played games saw bots
// break on a province its owner's host rode into. Now every host of the owner's that the bot can see beside the target
// counts in its defence, as if it rides in (bot improvements, step 5).
// Level 1 (unit): botScanTargets called directly in the bare vm (tests/lib/engine.ts) on the middle of a bot world
// (tests/lib/middle-of-a-bot-world.ts). A lower level can't hold the hosts and the ground between them.
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { board, hero, type Character, type Province } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const scan = engineFn(engine, 'botScanTargets') as (
  G: unknown,
  pi: number,
  c: Character,
  P: Province,
  myStr: number,
  T: unknown,
  visited: Set<number>,
) => { best: { N: Province } | null };
const force = engineFn(engine, 'botBattleForce') as (G: unknown, c: Character, a: null, t: string) => number;
const tuning = engineFn(engine, 'botTuning') as (G: unknown, pi: number) => unknown;

/** Realm 0's host of six companies in the middle province (realm 0's), beside a rich province of realm 1's (at war)
 *  held by one garrison company; the rest of the ring is poor unowned land. With `riders`, a host of realm 1's
 *  stands in a province next to both (realm 0's, so in sight with no kit on). Returns the province the bot attacks. */
function stage(riders: number | null) {
  const b = board(engine, world, 0);
  const G = b.G as unknown as Record<string, unknown>;
  G['turn'] = 10;
  b.own(b.X, 0);
  b.ring1.forEach((p) => {
    p.tax = 1;
  });
  const target = b.ring1[0];
  if (!target) throw new Error('no neighbour');
  const beside = b.ring1.find((p) => p !== target && b.nbrs(target).includes(p));
  if (!beside) throw new Error('no province beside both');
  b.own(target, 1);
  target.tax = 9;
  target.garrisonArmies = [{ type: 'Men-at-Arms', quality: 'Regular', race: 'Human', unitName: 'Watch of the Gate' }];
  if (riders != null) {
    b.own(beside, 0);
    hero(b, { player: 1, at: beside, troops: riders });
  }
  const c = hero(b, { player: 0, at: b.X, troops: 6 });
  const r = scan(b.G, 0, c, b.X, force(b.G, c, null, 'plain'), tuning(b.G, 0), new Set([b.X.id]));
  return { attacks: r.best?.N.id ?? null, target: target.id };
}

describe('a bot host beside a rich enemy province held by one company', () => {
  test('attacks it when no host of its owner stands beside it', () => {
    const r = stage(null);
    expect(r.attacks).toBe(r.target);
  });
  test('does not attack it when a host of its owner stronger than the bot stands beside it, ready to ride in', () => {
    const r = stage(8);
    expect(r.attacks).not.toBe(r.target);
  });
  test('still attacks it when the host beside it is too small to turn the battle', () => {
    const r = stage(1);
    expect(r.attacks).toBe(r.target);
  });
});
