// The share of a province an Explore order maps (plan P1-11d14: src/engine/rules-on-plain-values/the-share-of-a-
// province-an-explore-order-maps.ts, theShareOfAProvinceAnExploreOrderMaps), called directly: the ground's share ×
// (Explorer + 1), Explorer counted to 5, ×1.05 for the Trailblazer, × the realm's discoveries' factor, rounded down and
// capped at 100. The turn's resolveExploreOrder and the order form's exploreGainFor both ask it; the parity test (the-
// player-portals-copies-agree-with-the-engine, "the Explore order's forecast is what the order maps …") shows the two
// feed it the same. The file imports only the content and its folder, so the test imports it as it is, with no engine
// loaded.
// Level 1 (unit): a function of a ground, a level, a title and a factor.
import { expect, test } from 'vitest';
import { theShareOfAProvinceAnExploreOrderMaps as share } from '../../src/engine/rules-on-plain-values/the-share-of-a-province-an-explore-order-maps.ts';

test("each ground's share at Explorer 0, and 15 for a ground the table doesn't name or none", () => {
  const atExplorer0 = (ground: string | null | undefined) => share(ground, 0, false, 1);
  expect(atExplorer0('plain')).toBe(35);
  expect(atExplorer0('desert')).toBe(25);
  expect(atExplorer0('forest')).toBe(20);
  expect(atExplorer0('mountain')).toBe(20);
  expect(atExplorer0('jungle')).toBe(15);
  expect(atExplorer0('sea')).toBe(25);
  expect(atExplorer0('swamp')).toBe(15);
  expect(atExplorer0(null)).toBe(15);
  expect(atExplorer0(undefined)).toBe(15);
});

test('× (Explorer + 1), Explorer counted to 5, capped at 100', () => {
  expect([0, 1, 2, 3, 4, 5].map((level) => share('jungle', level, false, 1))).toEqual([15, 30, 45, 60, 75, 90]);
  expect(share('jungle', 9, false, 1)).toBe(90);
  expect(share('plain', 2, false, 1)).toBe(100);
});

test('×1.05 for the Trailblazer, rounded down', () => {
  expect(share('desert', 2, true, 1)).toBe(78);
  expect(share('forest', 3, true, 1)).toBe(84);
  expect(share('sea', 0, true, 1)).toBe(26);
});

test("× the realm's discoveries' factor on the ground, after the Trailblazer, rounded down and capped at 100", () => {
  expect(share('jungle', 0, false, 2.4)).toBe(36);
  expect(share('forest', 0, false, 2.65)).toBe(53);
  expect(share('mountain', 0, true, 3)).toBe(63);
  expect(share('desert', 1, false, 3)).toBe(100);
});
