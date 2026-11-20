// Both rulebooks follow the chapter order the maintainer chose (2026-10-15): the World and the Economy come straight
// after How a Turn Works, the realm's races and alignments come before its people, Movement and Magic come before
// War, and Lairs, Sight, Mastery and Items come after it. Each book's contents list matches its chapters, its "Part"
// labels count up from One, and a link that says "above" or "below" points to a chapter on that side. The Kings &
// Heroes chapter points up to Divine, and the Mastery chapter links back to The Fifteen Skills.
//
// Level 0 (static): both rulebooks as built (site/, or $KC_SITE's) read as HTML; nothing runs. The order of a book's
// chapters needs no lower level.
//
// Moved from the old script tests/rulebook-order.test.js (P1-14z): each check kept, one test a book, with a guard that
// each book has chapters and links that say "above" or "below".
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { sitePath } from '../lib/boot.ts';

const read = (page: string) => fs.readFileSync(sitePath(page), 'utf8');

const BOOKS: readonly (readonly [string, string, readonly string[]])[] = [
  [
    'kingdoms-call-rules.html',
    'the rulebook',
    [
      'overview',
      'turn',
      'world',
      'economy',
      'founding',
      'races',
      'alignments',
      'characters',
      'skills',
      'orders',
      'movement',
      'magic',
      'spells',
      'armies',
      'battle',
      'personal',
      'lairs',
      'sight',
      'mastery',
      'items',
      'diplomacy',
      'victory',
      'firstturns',
    ],
  ],
  [
    'kingdoms-call-rules-intro.html',
    'the intro',
    [
      'overview',
      'turn',
      'world',
      'founding',
      'alignments',
      'characters',
      'skills',
      'orders',
      'magic',
      'armies',
      'battle',
      'lairs',
      'victory',
      'firstturns',
    ],
  ],
];
const NUM = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

describe.each(BOOKS)('%s (%s)', (page, label, want) => {
  const src = read(page);
  const main = /<main>([\s\S]*?)<\/main>/.exec(src)?.[1] ?? '';
  const sections = [...main.matchAll(/<section id="([\w-]+)">/g)];
  const chapters = sections.map((m) => m[1] ?? '');

  test(`${label}'s chapters are in the maintainer's order`, () => {
    expect(chapters).toEqual(want);
  });

  test(`${label}'s contents list matches its chapters`, () => {
    const toc = /<nav class="toc"[\s\S]*?<\/nav>/.exec(src)?.[0] ?? '';
    const listed = [...toc.matchAll(/href="#([\w-]+)"/g)].map((m) => m[1] ?? '');
    expect(listed).toEqual(chapters);
  });

  test(`${label}'s Part labels count up from One, and it opens with Part One`, () => {
    const parts = [...main.matchAll(/class="eyebrow">Part (\w+) ·/g)].map((m) => m[1] ?? '');
    expect(parts.length, 'the Part labels were read').toBeGreaterThan(0);
    expect(parts).toEqual(NUM.slice(0, parts.length));
    expect(main).toMatch(/<section id="overview">\s*<div class="eyebrow">Part One /);
  });

  test(`${label}: a link that says "above" or "below" points to a chapter on that side`, () => {
    /** The chapter a place in the book is in: the index of the last chapter that starts at or before it, or -1. */
    const chapterAt = (at: number) => {
      let c = -1;
      for (const m of sections) if (m.index <= at) c = chapters.indexOf(m[1] ?? '');
      return c;
    };
    const links = [...main.matchAll(/<a href="#([\w-]+)">([^<]*)<\/a>(,? (?:above|below)\b)?/g)].flatMap((m) => {
      const word = /\b(above|below)\b/.exec((m[2] ?? '') + (m[3] ?? ''))?.[1];
      const to = chapters.indexOf(m[1] ?? '');
      // a link that says neither, or that goes to a heading inside a chapter rather than to a chapter, isn't checked
      return word === undefined || to < 0 ? [] : [{ id: m[1] ?? '', word, to, from: chapterAt(m.index) }];
    });
    expect(chapters.length, "the book's chapters were read").toBeGreaterThan(0);
    expect(links.length, 'links to a chapter that say "above" or "below" were read').toBeGreaterThan(0);
    for (const { id, word, to, from } of links)
      expect(
        word === 'below' ? to > from : to < from,
        `${label}: the link to #${id} from #${chapters[from] ?? '?'} says "${word}"`,
      ).toBe(true);
  });
});

describe('the rulebook', () => {
  const R = read('kingdoms-call-rules.html');

  test('the Kings & Heroes chapter points up to Divine in The Seven Alignments, not down', () => {
    expect(R).not.toMatch(/see Divine, below/);
    expect(R).toMatch(/see <a href="#alignments">Divine<\/a>, above/);
  });

  test('the Mastery chapter, now well after The Fifteen Skills, links back to it', () => {
    const mastery = /<section id="mastery">([\s\S]*?)<\/section>/.exec(R)?.[1] ?? '';
    expect(mastery).toMatch(/href="#skills"/);
  });
});
