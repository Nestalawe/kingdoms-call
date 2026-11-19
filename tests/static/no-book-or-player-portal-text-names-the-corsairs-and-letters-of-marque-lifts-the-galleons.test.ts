// 2026-10-15 (the maintainer, D3; the ruling R-109: the Corsair fleet is gone): no new world offers the Corsair Fleet,
// and no book or page a player reads names it: the rulebooks' roster, move-rate table, ferry list and retreat rule, the
// player portal's unit blurb and Human description, and Admiralty's text. Letters of Marque, the Human discovery that
// only lifted Corsairs, lifts the Galleon Fleet the same way (+30% when attacking; item 12). In a running game the
// save's upgrade turns a Corsair offer into the Galleon: the turn passes the loaded world through the upgrade, and the
// upgrade calls retireCorsairPools on it (both read by their syntax tree). The pass itself, on a hand-made world, is
// tests/unit/a-running-games-corsair-offer-becomes-the-galleon-and-a-raised-corsair-company-stays.test.ts.
//
// Level 0 (static): the two rulebooks as built (site/, or $KC_SITE's) read as text, the player portal as its files
// under src/ (tests/lib/source.ts), the discoveries from the content's table, and the two calls by their syntax tree;
// nothing runs.
//
// Until plan P1-14z these were the words and the calls of tests/corsairs-retired.test.js, which read the discoveries
// in the engine's bundle run in a vm (tests/lib/engine.ts). Its checks are here, one for one.
import fs from 'node:fs';
import { expect, test } from 'vitest';
import { SAGE_DISCOVERIES_P } from '../../src/content/kingdoms-call-data.ts';
import { sitePath } from '../lib/boot.ts';
import { callsTo, pageScripts, pageSource } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const PLAYER_PORTAL = 'kingdoms-call-player-portal.html';
const read = (page: string) => (page === PLAYER_PORTAL ? pageSource(page) : fs.readFileSync(sitePath(page), 'utf8'));

/** The discovery as the data file declares it (its JSON keeps the keys' order), or "null". */
const theDiscovery = (id: string) => JSON.stringify(SAGE_DISCOVERIES_P.find((d) => d.id === id) ?? null);
const theTextOf = (id: string) => /"desc":"([^"]*)"/.exec(theDiscovery(id))?.[1] ?? '';

test.each(['kingdoms-call-rules.html', 'kingdoms-call-rules-intro.html', PLAYER_PORTAL])(
  '%s no longer names the Corsairs',
  (page) => {
    const text = read(page);
    expect(text.length).toBeGreaterThan(1000);
    expect(text.match(/Corsair/g) ?? []).toEqual([]);
  },
);

test("Admiralty's text names the Galleons only", () => {
  expect(theTextOf('rh12').length).toBeGreaterThan(0);
  expect(theTextOf('rh12')).not.toMatch(/Corsair/);
});

test("Letters of Marque's text names the Galleons", () => {
  expect(theDiscovery('rh18')).toMatch(
    /"desc":"Galleon Fleets of your realm fight at \+30% strength when attacking\."/,
  );
});

test('…and its effect lifts the Galleon Fleet, +30% when attacking', () => {
  expect(theDiscovery('rh18')).toMatch(
    /"effect":\{"kind":"unitStr","pct":0\.3,"types":\["Galleon Fleet"\],"side":"atk"\}/,
  );
});

// Every script of the GM page read by its syntax tree.
test(
  "the turn passes the loaded world through the save's upgrade",
  () => {
    const calls = pageScripts('kingdoms-call-gm-portal.html').flatMap((f) => callsTo(f, 'upgradeGameState'));
    expect(calls.some((c) => c.within === 'resolveTurn' && c.args.join() === 'G')).toBe(true);
  },
  timeLimitForTheWork({ everyFileReads: 1 }).timeout,
);

test("the save's upgrade calls retireCorsairPools on it", () => {
  const calls = callsTo('engine/saves/upgrade-a-saved-game-and-check-it.ts', 'retireCorsairPools');
  expect(calls.some((c) => c.within === 'upgradeGameState' && c.args.join() === 'save')).toBe(true);
});
