// 2026-10-15 (a player's review of the rulebook) — text players read in the game said what the game doesn't do: a
// Flood let "only fleets" pass (flyers cross too), a broken watch held "no further ground this year" (a turn is a
// season), the Wildwarden counted griffons and eagles (soldiers since R-093), Dragon Taming named the winged riders (it
// covers the four flying beasts only) and the Explorer 8 perk promised a rise on every Explore (a province gains it
// once). (The messages are literals; the effects are tested by the scenarios that already cover them.)
//
// Level 0 (static): the rulebook as built (site/), the GM portal's strings and code from src/ by their syntax tree
// (tests/lib/source.ts), and the data file's tables from their module, imported with the whole engine loaded
// (tests/lib/the-whole-engine.ts); nothing runs. Until plan P1-14b this was tests/game-text-review-words.test.js, which
// read the tables in the engine's bare vm.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import {
  KC_UNIT_CLASS,
  MASTERY_UNLOCKS,
  SAGE_DISCOVERIES_P,
  TITLE_DEFS,
} from '../../src/content/kingdoms-call-data.ts';
import { readPage } from '../lib/boot.js';
import { compactPage, pageStrings, pageText } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const GM = 'kingdoms-call-gm-portal.html';
const stripTags = (s: string) => {
  let t = s;
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u;
    t = u;
  }
};
const R = stripTags(readPage('kingdoms-call-rules.html')).replace(/\s+/g, ' ');
const C = KC_UNIT_CLASS as { tamedFlyer?: string[]; creature: string[]; flying: string[] };
const S = SAGE_DISCOVERIES_P as { id: string; desc: string }[];
const M = MASTERY_UNLOCKS as Record<string, Record<number, string | undefined> | undefined>;

test("the data file's class lists were read", () => {
  expect((C.tamedFlyer?.length ?? 0) > 0 && C.creature.length > 0).toBe(true);
});

test('Flood: fleets and flyers may pass', timeLimitForTheWork({ everyFileReads: 1 }), () => {
  const flood = pageStrings(GM).find((t) => t.includes('calls up the deluge')) ?? '';
  expect(flood.length > 0, 'the Flood cast message was found').toBe(true);
  expect(
    !flood.includes('only fleets may pass') && flood.includes('only fleets and flyers may pass'),
    'the Flood cast message lets flyers pass',
  ).toBe(true);
  expect(
    R.includes(
      'Turn a land province to sea for the turn — land armies there are stranded; only fleets and flyers pass.',
    ),
    "the spellbook's Flood row lets flyers pass",
  ).toBe(true);
});

test('a broken watch: this turn, not this year', timeLimitForTheWork({ everyFileReads: 1 }), () => {
  const G = pageText(GM);
  expect(
    !G.includes('no further ground this year') && G.includes('no further ground this turn'),
    'the broken-watch message says "this turn"',
  ).toBe(true);
  expect(
    !R.includes('rides out to nothing more this year') && R.includes('rides out to nothing more this turn'),
    'the Defend example says "this turn"',
  ).toBe(true);
});

test('the Wildwarden counts Creatures only; the riders are soldiers', () => {
  const wild = JSON.stringify((TITLE_DEFS as { key: string }[]).find((t) => t.key === 'wild') ?? '');
  expect(wild.length > 0, 'the Wildwarden title was found').toBe(true);
  expect(!/griffons|eagles/i.test(wild), 'the Wildwarden no longer names griffons or eagles').toBe(true);
});

test('Dragon Taming names the flying beasts it covers, and no rider', () => {
  const sd40 = S.find((d) => d.id === 'sd40');
  expect(!!sd40, 'Dragon Taming was read').toBe(true);
  const desc = sd40?.desc ?? '';
  for (const t of C.tamedFlyer ?? []) expect(desc.includes(t), `Dragon Taming names ${t}`).toBe(true);
  for (const t of C.flying) expect(!desc.includes(t), `Dragon Taming no longer names ${t}`).toBe(true);
});

test('Explorer 8: once per province', timeLimitForTheWork({ everyFileReads: 1 }), () => {
  const ex8 = M['explorer']?.[8] ?? '';
  expect(ex8.length > 0, 'the Explorer 8 perk was read').toBe(true);
  expect(ex8.includes('once per province'), 'the Explorer 8 perk says a province gains it once').toBe(true);
  expect(
    compactPage(GM).includes('!prov._richSurveyed'),
    'the engine still grants the Explorer 8 rise once per province',
  ).toBe(true);
});
