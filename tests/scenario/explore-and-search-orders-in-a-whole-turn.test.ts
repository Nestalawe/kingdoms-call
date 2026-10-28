// The explore and search orders in a whole turn (plan P1-08j2, the second family of processOrder's orders taken out of
// it): Explore, Perform Rite, Hunting Rumours, Search Lair, Chart the Unknown and Discover Lost Ruin. Each case of
// lib/explore-and-search-order-cases.ts staged on the middle of a bot world and played through resolveTurn, every realm
// human-held, every other hero Resting. Level 2 (scenario): the order is read, checked (a mastery once a turn, a search
// written for another province) and carried out inside resolveTurn, so only a whole turn plays it as a realm gives it.
// unit/explore-and-search-orders-called-directly.test.ts calls each order's own function on the same cases, and on the
// ones the dice decide.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The explore and search orders (P1-08j2), played through a whole turn as the Move's are (`playTurn`): each case of
// `lib/explore-and-search-order-cases.ts`, in game terms. Explore maps a share set by the terrain and the Explorer
// skill, brings lairs to light in turn as the map fills, finds a lair and a ritual site together, and is clouded by a
// rival's veiled lair; Perform Rite is refused to a realm not of the old faith and at stones not yet found (unless in
// the realm's own province), makes the Blood Offering as named or by default (no higher than Elite; a bound beast can't
// be offered), answers once a province a turn, and binds the Wild Hunt (two Veteran beasts of the province's kind until
// the end of next turn) or finds nothing wild; Hunting Rumours has nothing to tell of an unknown lair, a ritual site or
// a cleared one, and on a known lair (or one mapped enough to see) learns the weakness, remembers the hoard and tells
// the odds; Search Lair finds nothing, or not the lair named, walks a ritual site, revisits a cleared lair, clears a
// lair (an overwhelming hero) or falls to its guardian, his magic left in its hoard, and is abandoned when written for
// another province; Chart the Unknown (Explorer 7) charts here or a neighbour and glimpses the ring round it, refuses
// ground out of reach, and is once a turn; Discover Lost Ruin (Explorer 9) lays bare every lair of the class named here
// and next door, the old stones for "Ritual", none behind a rival's glamour, and reads an unknown class as Weak. Each
// is certain (an overwhelming or hopeless fight; a grave left by the Blood Offering may rot at the turn's end, so only
// what is left is checked). Level 2: the order is read, checked (a mastery once a turn, a search written for another
// province) and carried out inside `resolveTurn`
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { EXPLORE_AND_SEARCH_ORDER_CASES } from '../lib/explore-and-search-order-cases.ts';
import { board, playTurn } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(EXPLORE_AND_SEARCH_ORDER_CASES)('the %s order, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = c.stage(b);
    const { after, lines } = playTurn(b, { [s.hero.id]: s.orders });
    const { got, want } = c.check(
      { world: after, lines: lines.filter((l) => l.charId === s.hero.id), turn: b.G.turn },
      s,
    );
    expect(got).toEqual(want);
  });
});
