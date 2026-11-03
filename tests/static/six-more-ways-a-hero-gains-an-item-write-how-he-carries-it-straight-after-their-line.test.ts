// 2026-10-13 (item 10): every way a hero gains an item writes the note of how he carries it (settleTheItemsAHeroGained)
// straight after its own line. Six ways no case of the orders' reaches are read here in the code: the lair's hoard, a
// thief's take from a lair, the bones of the fallen, a dead hero's possessions, the price of mercy and a drop in the
// rout. Each line is a fact found by its kind's name, and the call must come within the given number of statements
// after it (innermost statements, in the order they start: tests/lib/source.ts). The other four are cases, which read
// the lines a turn writes: Send Item by hand and by courier (lib/item-and-army-order-cases.ts), Steal and the Grand
// Heist (lib/espionage-order-cases.ts); the note's words are
// unit/a-hero-who-gains-an-item-is-told-whether-he-wears-it-has-no-room-needs-no-slot-or-cannot-use-it.test.ts.
//
// Level 0 (static): the GM page's code, read by its syntax tree; nothing runs. Kept a read of the code (plan P1-14's
// Decision 3): no case stages these six.
//
// Until plan P1-14f this was part of tests/item-equip-note.test.js, which read the same ten paths the same way. These
// six checks are kept as they were.
import { expect, test } from 'vitest';
import { statementsFollowing } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const PATHS: [string, RegExp, number][] = [
  ['lair hoard', /a hero clears a lair and hauls out its magic/, 4],
  ['lair theft', /a thief slips a magic item from a lair.{1,2}s hoard/, 2],
  ['bones of the fallen', /among the bones a hero recovers what the fallen left/, 3],
  ["a dead hero's possessions", /a hero takes a fallen foe.{1,2}s possessions/, 2],
  ['the mercy price', /a fighter surrenders an item to the foe as the price of mercy/, 2],
  ['a drop in the rout', /in the rout the runner drops an item the one who stays claims/, 2],
];

test.each(PATHS)(
  '%s: the equip note follows its line',
  timeLimitForTheWork({ everyFileReads: 1 }),
  (what, re, within) => {
    const at = statementsFollowing('kingdoms-call-gm-portal.html', re, within);
    expect(at, `found the ${what} line`).not.toBeNull();
    expect(at?.text ?? '', `${what}: the equip note follows`).toMatch(/settleTheItemsAHeroGained\(/);
  },
);
