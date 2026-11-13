// A general on Defend rides into a neighbouring province of his realm when it is attacked. A bot weighing an attack on
// an enemy province (botScanTargets, src/engine/bots/specialists.ts) counted only what stood in it, and an enemy host
// one province over only lowered the target's score, so it broke on provinces their owners' hosts rode into. Now every
// host of the owner's that the bot can see (or saw lately) beside the target counts in its defence, as if it rides in,
// and raises the margin the bot demands as any defending host does (bot improvements, 2026-11). A host the bot only
// remembers counts the same way, and only if it is the owner's: a third realm's host beside the target does not ride to
// its defence (Theo's review).
// Level 1 (unit): botScanTargets called directly on the engine's modules, on the middle of a bot world
// (tests/lib/the-middle-of-a-bot-world-on-the-engines-modules.ts). A lower level can't hold the hosts and the ground
// between them.
import { describe, expect, test } from 'vitest';
import { aBotBoard } from '../lib/the-middle-of-a-bot-world-on-the-engines-modules.ts';
import { botScanTargets } from '../../src/engine/bots/specialists.ts';
import { botBattleForce, botTuning } from '../../src/engine/bots/intel.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** Realm 0's host of six companies in the middle province (realm 0's), beside a rich province of realm 1's (at war)
 *  held by one garrison company; the rest of the ring is poor unowned land. With `besideIt`, a host of realm 1's
 *  stands in a province next to both (realm 0's, so in sight). With `remembered`, a host of eight companies of that
 *  realm (1, the owner, or 2, also at war with realm 0) stands there out of sight, seen there this turn and remembered.
 *  Returns the province the bot attacks. */
function stage(besideIt: number | null, remembered?: 1 | 2) {
  const b = aBotBoard(SEED);
  b.G.turn = 10;
  b.own(b.X, 0);
  b.ring1.forEach((p) => {
    p.tax = 1;
  });
  const target = b.must(b.ring1[0], 'neighbour');
  const beside = b.must(
    b.ring1.find((p) => p !== target && b.nbrs(target).includes(p)),
    'province beside both',
  );
  b.own(target, 1);
  target.tax = 9;
  target.garrisonArmies = [{ type: 'Men-at-Arms', quality: 'Regular', race: 'Human', unitName: 'Watch of the Gate' }];
  if (besideIt != null) {
    b.own(beside, 0);
    b.hero({ player: 1, at: beside, troops: besideIt });
  }
  if (remembered != null) {
    b.G.relations['0-2'] = 'enemy';
    const host = b.hero({ player: remembered, at: beside, troops: 8 });
    const me = b.must(b.G.players[0], 'realm 0');
    me['_botIntel'] = {
      generals: {
        [String(host.id)]: {
          turn: 10,
          provId: beside.id,
          units: 8,
          name: host.name,
          player: remembered,
          isKing: false,
          strength: 200,
          skillsKnown: false,
        },
      },
      heroes: {},
    };
  }
  const staged = b.hero({ player: 0, at: b.X, troops: 6 });
  const G = b.state();
  const c = b.must(
    G.characters.find((x) => x.id === staged.id),
    'host',
  );
  const P = b.must(G.world.provinces[b.X.id], 'middle province');
  const r = botScanTargets(
    G,
    0,
    c,
    P,
    botBattleForce(G, c, null, 'plain', undefined),
    botTuning(G, 0),
    new Set([P.id]),
  );
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
  test('does not attack it when a host of its owner it remembers stands beside it', () => {
    const r = stage(null, 1);
    expect(r.attacks).not.toBe(r.target);
  });
  test('attacks it when the host it remembers beside it is a third realm’s, which does not ride to its defence', () => {
    const r = stage(null, 2);
    expect(r.attacks).toBe(r.target);
  });
  test('still attacks it when the host beside it is too small to turn the battle', () => {
    const r = stage(1);
    expect(r.attacks).toBe(r.target);
  });
});
