// 2026-10-12 (Toby's batch, item 23; R-102): the player portal writes an Evil realm's Terror note (terrorNoteP) in all
// three branches of its map popup (a province of its own, one it sees, one far off) and in each entry of its Your
// Provinces list. The note's words are page/the-player-portals-terror-note-reads-the-terror-and-its-stacks.test.ts.
//
// Level 0 (static): the player portal's code in one layout, from src/ (tests/lib/source.ts). Nothing runs. Kept a read
// of the code (plan P1-14's Decision 3): the popup is built inside renderPlayerMap's hover handler and the list inside
// the report's renderer, so driving them would take the map's mouse events and a whole report.
//
// Until plan P1-14g these were the last two checks of tests/terror-visible.test.js, kept as they were.
import { expect, test } from 'vitest';
import { compactPage } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

test(
  'the map popup writes the note in all three of its branches, and the Your Provinces entry writes it too',
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    const pp = compactPage('kingdoms-call-player-portal.html');
    const tip = /const showTip=ev=>\{[\s\S]*?g\.addEventListener\('mousemove',showTip\)/.exec(pp)?.[0] ?? '';
    expect(tip, "the map popup's hover handler is found").not.toBe('');
    expect(tip.match(/terrorNoteP\(pd\)/g)?.length, 'the map popup writes the note in all three of its branches').toBe(
      3,
    );
    const list =
      /document\.getElementById\('report-provinces'\)\.innerHTML=[\s\S]*?No provinces owned yet/.exec(pp)?.[0] ?? '';
    expect(list, 'the Your Provinces entry writes it too').toMatch(/terrorNoteP\(p[,)]/);
  },
);
