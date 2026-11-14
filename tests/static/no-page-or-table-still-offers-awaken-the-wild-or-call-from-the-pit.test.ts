// 2026-10-12 (Toby's batch, item 22): Evil's Call from the Pit and the Druids' Awaken the Wild are removed: they made
// Creatures and Monsters too easy to come by. The player portal offers neither order (its order list, its alignment
// orders, its display order and its target pickers), and no page or table still describes them: the rulebook, the
// intro, the player portal's files and the data file (its two tier tables gone, and Deep Roots' cheaper awakening with
// them). A turn in which both are given is
// scenario/call-from-the-pit-and-awaken-the-wild-given-in-a-turn-raise-nothing-and-are-refused-in-plain-words.test.ts.
//
// Level 0 (static): the rulebooks as built (site/); the player portal's code in one layout and its files as written,
// and the data file as written and in one layout, from src/ (tests/lib/source.ts); the alignment orders' rows
// imported. Nothing runs. Kept a read of the code (plan P1-14's Decision 3): the portal's lists are declared inside its
// modules, which call supabase.createClient as they load.
//
// Until plan P1-14f this was part of tests/beast-calls-gone.test.js. Its nine checks of the words are kept as they
// were.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { THE_ALIGNMENT_ORDERS } from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { readPage } from '../lib/boot.js';
import { compactOf, compactPage, pageSource, SRC } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const PP = 'kingdoms-call-player-portal.html';
const GONE = /Awaken the Wild|Call from the Pit/;
const listOf = (src: string, re: RegExp) => re.exec(src)?.[1] ?? '';
const data = fs.readFileSync(path.join(SRC, 'content', 'kingdoms-call-data.ts'), 'utf8');

test(
  "the player portal's order list, alignment orders, display order and target pickers name neither",
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    const ppCode = compactPage(PP);
    expect(
      listOf(ppCode, /const ACTIONS *= *\[([\s\S]*?)\];/),
      "the player portal's order list offers neither order",
    ).not.toMatch(GONE);
    // (since P1-11d7 the portal's table of them is the rows', by name, from the engine's folder: so the rows' names)
    expect(ppCode, "the player portal's alignment orders are the rows'").toMatch(
      /const ALIGN_ACTIONS=theAlignmentOrdersByTheNameTheFormWrites\(\);/,
    );
    expect(
      Object.values(THE_ALIGNMENT_ORDERS)
        .map((o) => o.name)
        .join(','),
      '…and the rows no longer name them',
    ).not.toMatch(GONE);
    expect(listOf(ppCode, /const ACTION_DISPLAY_ORDER=\[([\s\S]*?)\];/), '…nor its display order').not.toMatch(GONE);
    expect(ppCode, 'the player portal has no target picker for them').not.toMatch(
      /case 'Awaken the Wild'|case 'Call from the Pit'/,
    );
  },
);

test.each([
  ['rulebook', () => readPage('kingdoms-call-rules.html')],
  ['intro', () => readPage('kingdoms-call-rules-intro.html')],
  ['player portal', () => pageSource(PP)],
  ['data file', () => data],
] as const)(
  '%s: no text still offers Awaken the Wild or Call from the Pit',
  timeLimitForTheWork({ everyFileReads: 1 }),
  (_page, read) => {
    const hits = read().match(/[^.<>]{0,60}(Awaken the Wild|Call from the Pit)[^.<>]{0,40}/g) ?? [];
    expect(hits).toEqual([]);
  },
);

test('the data file no longer holds the two tier tables', () => {
  expect(data).not.toMatch(/KC_AWAKEN_TIERS|KC_PIT_TIERS/);
});

test('Deep Roots stays, without the cheaper awakening', timeLimitForTheWork({ everyFileReads: 1 }), () => {
  const dataCode = compactOf('content/kingdoms-call-data.ts');
  expect(dataCode).toMatch(/\{id:'au05'/);
  expect(dataCode).not.toMatch(/awakenCost/);
});
