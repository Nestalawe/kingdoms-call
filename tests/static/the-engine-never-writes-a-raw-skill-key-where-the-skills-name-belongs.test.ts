// 2026-10-13 (item 7): every skill a turn report names is written with a capital: "Skills: Melee 2", "(Necromancy 3)",
// "casts Charm (Psychic Magic)", "drills Naval theory", "no commanding Druid". This half reads the code: the GM portal's
// code never prints a raw skill key where a skill's name belongs (the patterns that did), and no item description in
// the data file names a school in lower case. It guards the lines a short game may never reach; the lines whole games
// write are simulation/no-line-of-whole-games-writes-a-skill-in-lower-case.test.ts.
//
// Level 0 (static): the GM portal's code and the data file, each in one canonical layout by its syntax tree
// (tests/lib/source.ts's compactPage and compactOf), read, not run: the patterns are the code's, and the lines they
// would write may come up in no game.
//
// Until plan P1-14i this was the static half of tests/skill-names-capitalised.test.js. Its five patterns are kept as they
// were. Since plan P1-12d the lines' words are the views' (src/views/prose/), written from the fact the engine records,
// so four of them match no code a raw key could come from any more: the school's name is the fact's `schoolLabel`, set
// by the engine, and a skill list's names are the views' (Parked "Eleven checks in the old battle, order and report
// scripts can't fail"). Two checks are added so the same faults fail (stricter: plan P1-14's Decision 2): every
// `schoolLabel` the engine records is the school's name, and no skill list prints its key. The item descriptions' check
// reads a description with an apostrophe in it to its end (the old one stopped at the apostrophe).
import { expect, test } from 'vitest';
import { compactOf, compactPage } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const GM = 'kingdoms-call-gm-portal.html';
const SCHOOLS = 'white|psychic|illusory|elemental|necromancy';

/** Where `re` first matches in `code`, with the code around it, or '' if it doesn't. */
const found = (code: string, re: RegExp) => {
  const m = re.exec(code);
  return m ? code.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\n/g, ' ') : '';
};

test(
  "the GM portal's code never prints a raw skill key where the skill's name belongs",
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    const gm = compactPage(GM);
    // the old script's five patterns, as they were: a school's key before its level, in "no … skill" and in "… spell
    // limit", a skill list joined from its keys, and the theory, drills and Druid lines written in lower case
    const RAW = [
      /\(\$\{school\} \$\{/,
      /no \$\{school\} skill/,
      /\$\{school\} spell limit/,
      /\(\[k,v\]\)=>k\+' '\+v/,
      /naval drills|naval theory|tactical theory|commanding druid'/,
    ];
    for (const re of RAW) expect(found(gm, re), `the code matches ${String(re)}`).toBe('');
    // stricter: the school's name in a battle's magic, "no … skill" and "… spell limit" is the fact's schoolLabel,
    // which must be the school's label, never its key
    const labels = [...gm.matchAll(/schoolLabel:([^,}]*)/g)].map((m) => m[1] ?? '');
    expect(labels.length, "the engine records a school's name as schoolLabel").toBeGreaterThan(0);
    expect(
      labels.filter((v) => !v.startsWith('SKILL_LABELS[')),
      'every schoolLabel is read from SKILL_LABELS',
    ).toEqual([]);
    // stricter: a skill list (the hire line, a spy's, a Charm's) prints each skill's name, never its key, before its
    // level
    expect(found(gm, /\(\[k,[a-z]+\]\)=>`\$\{k\} /), 'a skill list prints the key before its level').toBe('');
  },
);

test(
  'no item description in the data file names a school in lower case',
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    const data = compactOf('content/kingdoms-call-data.ts');
    // the old script's pattern, as it was, and (stricter) the same read past an apostrophe: a string in the canonical
    // layout is single-quoted, an apostrophe in it escaped (\'), where the old one stopped
    const low = [
      ...(data.match(/desc:'[^']*\((white|psychic|illusory|elemental|necromancy)\)/g) ?? []),
      ...(data.match(new RegExp(`desc:'(?:[^'\\\\]|\\\\.)*\\((${SCHOOLS})\\)`, 'g')) ?? []),
    ];
    expect(
      low.map((d) => d.slice(-80)),
      'no description writes "(psychic)", say, for "(Psychic Magic)"',
    ).toEqual([]);
  },
);
