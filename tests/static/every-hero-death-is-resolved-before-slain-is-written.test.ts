// 2026-10-13 (item 19): every personal-combat death is resolved before its "slain" line is written, so Battlefield
// Surgery can turn it into "at death's door, but not slain". handleHeroDeath is called only by reportHeroFall (which
// resolves the death, then writes the line), by the pre-battle duel (which does the same in its battle's narrative:
// tests/scenario/battlefield-surgery-lines-sit-inside-the-battle.test.ts plays it), and by its own copy guard; every
// other personal-combat death goes through reportHeroFall; and no "slain" line is logged just before a call of
// handleHeroDeath.
//
// Level 0 (static): the GM portal's code, read by its syntax tree (tests/lib/source.ts), not run; the code anchors of the
// call sites are what is checked, which no turn shows. Until plan P1-14a these were the static checks at the end of
// tests/surgery-lines.test.js.
import { expect, test } from 'vitest';
import { callsTo, compactPage, pageScripts } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const GM = 'kingdoms-call-gm-portal.html';

test(
  'handleHeroDeath is called only by reportHeroFall, the pre-battle duel and its own copy guard',
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    const calls = pageScripts(GM)
      .flatMap((f) => callsTo(f, 'handleHeroDeath'))
      .map((c) => c.within)
      .sort();
    expect(calls.join()).toBe('handleHeroDeath,preBattleDuel,reportHeroFall');
  },
);

test(
  'every other personal-combat death (thief, Charm backlash, lair, assassination, duel, shot, ambush, chase) goes through reportHeroFall',
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    expect((compactPage(GM).match(/reportHeroFall\(/g) ?? []).length).toBeGreaterThanOrEqual(13);
  },
);

test('no "slain" line is written before the death is resolved', timeLimitForTheWork({ everyFileReads: 1 }), () => {
  expect(compactPage(GM)).not.toMatch(
    /log\('combat',`[^`]*(slain|cut down|felled|falls in the duel|struck down)[^`]*`[^;]*\);\s*handleHeroDeath\(/,
  );
});
