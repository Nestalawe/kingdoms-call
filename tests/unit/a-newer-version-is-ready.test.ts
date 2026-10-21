// A newer version of this page is ready (plan P1-06, Decisions 8 and 9): the decision behind the reload banner and the
// GM tab's reload, whatVersionJsonSaysOf (src/ui/shared/a-newer-version-of-this-page.ts), on plain values.
// - version.json naming this page's own fingerprint: no newer version, however long it has been;
// - another fingerprint: a newer version, which counts only 10 minutes after this page first saw it (GitHub's cache can
//   hand out the old page for 10 minutes after a deploy): not when never seen, not at 9 minutes 59 seconds, yes at 10;
// - a third fingerprint, deployed after the second was seen, waits its own 10 minutes;
// - a page without a fingerprint (the dev server), or one version.json doesn't name: no newer version.
// Level 1 (unit): a function of this page's fingerprint, version.json and the times; no page runs. The page tests
// (tests/page/the-reload-banner.test.ts, the-gm-tab-reloads-onto-a-newer-gm-page-before-a-due-turn.test.ts) check that
// the pages ask it, with the metas, the address, fetch and the clock as they are on a page.
import { expect, test } from 'vitest';
import {
  COUNTS_AFTER_MS,
  publishedVersionFrom,
  whatVersionJsonSaysOf,
  type PublishedVersion,
} from '../../src/ui/shared/a-newer-version-of-this-page.ts';

const MINUTE = 60_000;
const PLAYER = { name: 'kingdoms-call-player-portal.html', fingerprint: '1a2b3c4d5e6f' };

/** version.json as a deploy publishes it, giving the player portal `fingerprint`. */
const published = (fingerprint: string): PublishedVersion => ({
  commit: '3f2a9c1d0e4b5a6978877665544332211aabbccd',
  time: '2026-10-22T10:15:00+13:00',
  pages: { 'index.html': '0f0f0f0f0f0f', [PLAYER.name]: fingerprint },
});
const seen = (entries: [string, number][] = []): ReadonlyMap<string, number> => new Map(entries);

test('the wait is 10 minutes', () => {
  expect(COUNTS_AFTER_MS).toBe(10 * MINUTE);
});

test("version.json names this page's own fingerprint: no newer version, however long it has been", () => {
  for (const now of [0, 9 * MINUTE, 10 * MINUTE, 600 * MINUTE])
    expect(whatVersionJsonSaysOf(PLAYER, published(PLAYER.fingerprint), seen([[PLAYER.fingerprint, 0]]), now)).toEqual({
      newer: null,
      counts: false,
    });
});

test('another fingerprint: a newer version, which counts 10 minutes after this page first saw it', () => {
  const other = published('aaaaaaaaaaaa');
  expect(whatVersionJsonSaysOf(PLAYER, other, seen(), 60 * MINUTE), 'never seen').toEqual({
    newer: 'aaaaaaaaaaaa',
    counts: false,
  });
  const firstSeenAt = 5 * MINUTE;
  const at = (now: number) => whatVersionJsonSaysOf(PLAYER, other, seen([['aaaaaaaaaaaa', firstSeenAt]]), now);
  expect(at(firstSeenAt), 'first seen now').toEqual({ newer: 'aaaaaaaaaaaa', counts: false });
  expect(at(firstSeenAt + 9 * MINUTE), 'seen 9 minutes ago').toEqual({ newer: 'aaaaaaaaaaaa', counts: false });
  expect(at(firstSeenAt + 10 * MINUTE - 1000), 'seen 9 minutes 59 seconds ago').toEqual({
    newer: 'aaaaaaaaaaaa',
    counts: false,
  });
  expect(at(firstSeenAt + 10 * MINUTE), 'seen 10 minutes ago').toEqual({ newer: 'aaaaaaaaaaaa', counts: true });
  expect(at(firstSeenAt + 600 * MINUTE), 'seen 10 hours ago').toEqual({ newer: 'aaaaaaaaaaaa', counts: true });
});

test('a third fingerprint, deployed after the second was seen, waits its own 10 minutes', () => {
  const firstSeen = seen([
    ['aaaaaaaaaaaa', 0],
    ['bbbbbbbbbbbb', 8 * MINUTE],
  ]);
  const third = published('bbbbbbbbbbbb');
  expect(whatVersionJsonSaysOf(PLAYER, third, firstSeen, 12 * MINUTE)).toEqual({
    newer: 'bbbbbbbbbbbb',
    counts: false,
  });
  expect(whatVersionJsonSaysOf(PLAYER, third, firstSeen, 18 * MINUTE)).toEqual({ newer: 'bbbbbbbbbbbb', counts: true });
});

test('a page without a fingerprint, or one version.json does not name: no newer version', () => {
  const longAgo = seen([['aaaaaaaaaaaa', 0]]);
  expect(
    whatVersionJsonSaysOf({ name: PLAYER.name, fingerprint: null }, published('aaaaaaaaaaaa'), longAgo, 60 * MINUTE),
    'the dev server',
  ).toEqual({ newer: null, counts: false });
  expect(
    whatVersionJsonSaysOf(
      { name: 'leaderboard.html', fingerprint: PLAYER.fingerprint },
      published('aaaaaaaaaaaa'),
      longAgo,
      60 * MINUTE,
    ),
    'a page version.json does not name',
  ).toEqual({ newer: null, counts: false });
});

test('only a file shaped as version.json is read as one', () => {
  expect(publishedVersionFrom(published('aaaaaaaaaaaa'))).toEqual(published('aaaaaaaaaaaa'));
  expect(publishedVersionFrom({ commit: 'unknown', time: null, pages: {} })).toEqual({
    commit: 'unknown',
    time: null,
    pages: {},
  });
  for (const notIt of [
    null,
    [],
    'version',
    { pages: {} },
    { commit: 'x', pages: 'none' },
    { commit: 'x', time: 3, pages: {} },
  ])
    expect(publishedVersionFrom(notIt), JSON.stringify(notIt)).toBeNull();
  expect(publishedVersionFrom({ commit: 'x', time: null, pages: { 'index.html': 12 } })).toBeNull();
});
