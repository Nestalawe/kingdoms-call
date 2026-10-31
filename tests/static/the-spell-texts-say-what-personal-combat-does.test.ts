// 2026-10-14 (batch item 13) — the spell texts say what the engine does. The player portal's spell list and the data
// file's spell descriptions had drifted from personal combat as it is: Hand of Death (40% of max HP on 10% a level, at
// most 60%), Telekinetic Storm (12% + 3% a level), Invisibility (−10% −4% a level), Psychic Blast (no free attacks; 1
// round + 1 per two levels), Spiritwrack (1 round + 1 per two levels, not three phases) and Control Undead (a round per
// level counted to 5). The rulebook said field experience stops at level 5; it carries a skill to 9. Since P1-23e
// (R-119), Invisibility's texts (the data file, the order form, the rulebook's two lines) say every enemy order and
// ambush aimed at its caster misses him.
//
// Level 0 (static): the words. The rulebook as built (site/); the player portal's spell hints from src/ by their syntax
// tree (tests/lib/source.ts); the data file's descriptions from its module, imported with the whole engine loaded
// (tests/lib/the-whole-engine.ts); nothing runs. Until plan P1-14b this was tests/spell-words.test.js, which read the
// descriptions in the engine's bare vm.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { SPELL_DEFS_P } from '../../src/content/kingdoms-call-data.ts';
import { readPage } from '../lib/boot.js';
import { entriesOf, fileDeclaring } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const stripTags = (s: string) => {
  let t = s;
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u;
    t = u;
  }
}; // until stable (as the other words tests do)
const R = stripTags(readPage('kingdoms-call-rules.html'));
const SPELLS = SPELL_DEFS_P as Record<string, { desc?: string } | undefined>;
const dd = (n: string) => SPELLS[n]?.desc ?? '';

test.for([
  ['Hand of Death', [/40%/, /60%/], [/50%/], 'a 40% bite, at most a 60% chance'],
  ['Telekinetic Storm', [/12%/, /3%/], [/quarter of the target/, /25% of/], '12% + 3% a level'],
  ['Invisibility', [/\\u221210%|−10%/, /4%/], [/25%/], '−10% and −4% a level'],
  [
    'Psychic Blast',
    [/two Psychic levels|every two levels/],
    [/free attack/],
    '1 round + 1 per two levels, and no free attacks',
  ],
  ['Spiritwrack', [/two White levels|every two levels/], [/three combat phases/], '1 round + 1 per two levels'],
  ['Control Undead', [/counted to 5/], [], 'a round per level counted to 5'],
] as const)(
  '%s: the player portal and the data file say so',
  timeLimitForTheWork({ everyFileReads: 1 }),
  ([n, good, bad, what]) => {
    const HINTS = entriesOf(fileDeclaring('kingdoms-call-player-portal.html', 'SPELL_HINTS'), 'SPELL_HINTS');
    const pp = HINTS.find((e) => e.key === n)?.value ?? '';
    for (const [w, t] of [
      ['player portal', pp],
      ['data file', dd(n)],
    ] as const) {
      expect(t.length > 20, `${w}: ${n}'s text was read`).toBe(true);
      for (const g of good) expect(g.test(t), `${w}: ${n} says ${what} (${String(g)})`).toBe(true);
      for (const b of bad) expect(!b.test(t), `${w}: ${n} no longer says ${String(b)}`).toBe(true);
    }
  },
);

// R-119 (Toby, 2026-10-31): once a hero's Invisibility holds, every enemy order and reaction aimed at him misses him.
test(
  'Invisibility: the data file, the order form and the rulebook’s two lines say an enemy order aimed at you misses you (R-119)',
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    const HINTS = entriesOf(fileDeclaring('kingdoms-call-player-portal.html', 'SPELL_HINTS'), 'SPELL_HINTS');
    const said = /every enemy order and ambush aimed at (?:you|him) misses (?:you|him)/;
    const rulebook = R.replace(/\s+/g, ' ');
    for (const [w, t] of [
      ['data file', dd('Invisibility')],
      ['order form', HINTS.find((e) => e.key === 'Invisibility')?.value ?? ''],
      ['rulebook, the spell', /80% chance that no enemy player sees you[^.]*\./.exec(rulebook)?.[0] ?? ''],
      ['rulebook, what a realm sees', /Invisibility is the one exception to both:[^.]*\./.exec(rulebook)?.[0] ?? ''],
    ] as const) {
      expect(t.length > 20, `${w}: Invisibility's text was read`).toBe(true);
      expect(said.test(t), `${w}: an enemy order and ambush aimed at him misses him`).toBe(true);
    }
  },
);

test('the rulebook: field experience carries a skill past 5; Control Undead counts levels to 5', () => {
  expect(
    !R.includes('field experience up to level 5'),
    'the rulebook no longer says field experience stops at level 5',
  ).toBe(true);
  expect(
    R.includes('an undead foe is stunned for one round per level (counted to 5)'),
    "the rulebook's Control Undead counts levels to 5",
  ).toBe(true);
});
