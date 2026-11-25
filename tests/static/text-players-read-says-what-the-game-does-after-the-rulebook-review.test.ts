// 2026-10-15 (a player's review of the rulebook) — text players read said what the game doesn't do, and now says what
// it does.
//
// In the game: a Flood let "only fleets" pass (flyers cross too), a broken watch held "no further ground this year" (a
// turn is a season), the Wildwarden counted griffons and eagles (soldiers since R-093), Dragon Taming named the winged
// riders (it covers the four flying beasts only) and the Explorer 8 perk promised a rise on every Explore (a province
// gains it once). (The messages are literals; the effects are tested by the scenarios that already cover them.)
//
// In the rulebooks: every sentence the review found that the game contradicts: the cast chance at 7, the once-a-turn
// skill rise, slipping through a camp, the carry-on casualties, the standings' five turns, no 3-realm ally step, the
// Defend step, Hunting Rumours' lack of a roll, the lair counts, which items fight, the three-round limit, Druid items
// to 9, ferrying, the beaten skeletons' step, Mithril, the Druid table, the four attack rules, the battle's own
// heading, Rest, the home lair, grave decay, the Druid ward, Hand of Death's cap, the volley, turn 2's recruiting and
// two links. Where a sentence gives a number, the engine's constant is read too, so the words and the game agree.
//
// Level 0 (static): the rulebooks as built (site/), the GM portal's strings, code and constants from src/ by their
// syntax tree (tests/lib/source.ts: a constant is the value it is declared with, at top level or inside a function),
// and the data file's tables from their module, imported with the whole engine loaded (tests/lib/the-whole-engine.ts);
// nothing runs. The claims are words, so no lower level holds them. Until plan P1-14b the game's half was
// tests/game-text-review-words.test.js, which read the tables in the engine's bare vm; until P1-14z the rulebooks' half
// was tests/rulebook-review-words.test.js, each check kept (but one, which the cast-chance test named below holds).
import '../lib/the-whole-engine.ts';
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  KC_UNIT_CLASS,
  MASTERY_UNLOCKS,
  SAGE_DISCOVERIES_P,
  TITLE_DEFS,
} from '../../src/content/kingdoms-call-data.ts';
import { CARRYON_DEATH_STEP } from '../../src/engine/battle/battles-against-province-defenders.ts';
import { RECKONING_MIN_TURN, TITLES_PUBLIC_FROM_TURN } from '../../src/engine/titles/perks.ts';
import { readPage, sitePath } from '../lib/boot.ts';
import { compactOf, compactPage, initializersOf, pageScripts, pageStrings, pageText } from '../lib/source.ts';
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

// ── The rulebooks' sentences the review found the game contradicting (moved from tests/rulebook-review-words.test.js)
// Both books as built, without the scripts readPage puts in (the old script's read): their HTML, and their words with
// the tags stripped and the white space made single.
const RH = fs.readFileSync(sitePath('kingdoms-call-rules.html'), 'utf8');
const IH = fs.readFileSync(sitePath('kingdoms-call-rules-intro.html'), 'utf8');
const RW = stripTags(RH).replace(/\s+/g, ' ');
const IW = stripTags(IH).replace(/\s+/g, ' ');
/** The number the GM portal's code declares `name` with (declared once, a plain number), else NaN. */
const num = (name: string) => {
  const vs = pageScripts(GM).flatMap((f) => initializersOf(f, name));
  const v = vs[0] ?? '';
  return vs.length === 1 && /^\(?[\d.]+\)?$/.test(v) ? Number(v.replace(/[()]/g, '')) : NaN;
};

describe('the rulebooks after the review: each sentence says what the game does', () => {
  test('both rulebooks were read', () => {
    expect(RW.length).toBeGreaterThan(100_000);
    expect(IW.length).toBeGreaterThan(20_000);
  });

  // 30% + 10% a level, at most 95%; training counts to 5 (80%), and only an item's levels carry it on. The rulebook's
  // "80% at 5. Trained levels past 5 do not raise it" is
  // tests/static/the-rulebook-says-training-stops-cast-chance-at-80-and-items-carry-it-to-95.test.ts.
  test(
    'cast chance: the base is 30%, and training stops at 80% at level 5',
    timeLimitForTheWork({ everyFileReads: 1 }),
    () => {
      expect(num('SPELL_CAST_BASE'), "the engine's cast base is 30%").toBe(30);
      expect(RW, 'not 90% at 7').not.toContain('80% at 5, 90% at 7');
      expect(RW, 'not 95% from 7').not.toContain('95% from 7');
    },
  );

  test('a skill rises from experience once a turn (R-056); the ×0.8 follows Practice rises only', () => {
    expect(RW).not.toContain('each time a skill has already risen in a turn');
    expect(RW).toContain(
      'each Practice rise of a skill earlier in the turn makes its next chance from experience ×0.8',
    );
  });

  test(
    'slipping through a camp: 60% − 8% a unit, one time in five behind five',
    timeLimitForTheWork({ everyFileReads: 2 }),
    () => {
      expect(
        num('ENC_BREAK_RANKS_BASE') - 5 * num('ENC_BREAK_RANKS_PER_UNIT'),
        'behind five units the engine gives 20%',
      ).toBe(20);
      expect(RW).toContain('behind five, one time in five');
      expect(RW).not.toContain('behind five, one time in four');
    },
  );

  test('carry-on casualties add 35% a round', timeLimitForTheWork({ everyFileReads: 1 }), () => {
    // the engine's step, as it reads it from the carry-on's content row (B-06ay1)
    expect(CARRYON_DEATH_STEP, "the engine's carry-on step").toBe(0.35);
    expect(RW, 'the losing side’s step no longer says ×1.35 a round').not.toContain('×1.35 for every carry-on round');
    expect(RW, 'the losing side’s step says +35% a round').toContain('+35% for every carry-on round');
  });

  test(
    'standings from turn 5, claims from turn 10: five full turns between',
    timeLimitForTheWork({ everyFileReads: 2 }),
    () => {
      // the engine's two turns, as it reads them from the Reckoning's content row (B-06q)
      expect(RECKONING_MIN_TURN - TITLES_PUBLIC_FROM_TURN, 'turns between public standings and a claim').toBe(5);
      expect(RW).toContain('five full turns before the throne itself can be claimed');
      expect(RW).not.toContain('four full turns before');
    },
  );

  test('no alliance in a game of three realms or fewer, so no 3-realm ally step', () => {
    expect(RW).not.toContain('+17 points each in a 3-realm game');
    expect(RH, 'the bar-at-a-glance row for 3 realms has no ally columns').toMatch(
      /<tr><td class="num">3<\/td><td class="num">50%<\/td><td class="num">—<\/td><td class="num">—<\/td>/,
    );
  });

  test('the Defend step is not counted last (R-007); Hunting Rumours has no roll (R-035)', () => {
    expect(RW).not.toContain('Characters on Defend are counted last');
    expect(RW).not.toContain('A failed roll is simply a fact not learned');
  });

  test('lair counts follow the readiness table', () => {
    expect(RW).not.toContain('a dozen Moderate lairs');
    expect(RW).toContain('six to eight Moderate lairs to be ready for Powerful');
  });

  test('only equipped and slotless items go into a fight; stuns follow their spell', () => {
    expect(RW).not.toContain('all of their magic items into the fight');
    expect(RW).toContain('every magic item they have equipped, and every item that needs no slot');
    expect(RW).toContain('A stun or a silence is not a lingering wound');
  });

  test('items carry Druid to 9 (R-036)', () => {
    expect(RW).not.toMatch(/same holds for Naval, Druid, Sage/);
    expect(RW).toContain('and Druid, which counts every level to 9');
  });

  test('ferrying: no "siege", and the Great Turtles among the carriers', () => {
    expect(RW, 'the wrong griffon example is gone').not.toContain('though the ship alone could not');
    expect(RW).not.toMatch(/cavalry, siege, walking creatures/);
    expect(RW).not.toMatch(/cavalry, siege, ships and beasts/);
    expect(RW).toMatch(/the Great Turtles, whose Island Back carries two units a hull/);
  });

  test("the beaten skeletons pass step 2 only; the retired Eagle Riders' flight is gone (R-095)", () => {
    expect(RW).not.toContain('steps 2 and 3 above pass them by');
    expect(RW).not.toContain('Eagle Riders always fly clear');
  });

  test('Mithril is a gift to the dwarves of a dwarven realm, not a relic', () => {
    expect(RW).not.toContain('A few relics are never found in lairs');
    expect(RW).toContain('every dwarven character of a dwarven realm bears a suit of mithril');
    expect(IW, "the intro's Dwarven row").toContain('every character of a dwarven realm wears mithril');
  });

  test('Druid for fleets: not every fleet needs it', () => {
    expect(RW).not.toContain('Creatures, Monsters and fleets');
  });

  test('four rules apply to every attack, and the battle list has its own heading', () => {
    expect(RW).toContain('Four rules that apply to every attack');
    expect(RW).not.toContain('Three rules that apply to every attack');
    expect(RH).toMatch(/<h3[^>]*>The battle, step by step<\/h3>/);
  });

  test("Rest heals the engine's share of maximum hit points", timeLimitForTheWork({ everyFileReads: 1 }), () => {
    const rest = num('REST_HEAL_PCT');
    expect(RW).toContain(`Rest — recover ${String(Math.round(rest * 100))}% of maximum hit points`);
  });

  test('every home holds a Weak lair (R-018)', () => {
    expect(RW).toContain('Every home province holds a Weak lair');
  });

  // The turn's own rate, and 5% under an Undead realm: its row's 5 / 100 (since P1-19ax2 the Undead rate is a row of
  // the alignment abilities' family, read through the registry's runner).
  test(
    'graves crumble 10% a turn (5% under an Undead realm), as the rulebook says',
    timeLimitForTheWork({ everyFileReads: 1 }),
    () => {
      expect(compactPage(GM), "the turn's own rate").toMatch(
        /LetsTheGravesOnItsLandRotAt\(G\.players\[p\.owner\]\?\.alignment\)\?\?0\.1:0\.1;/,
      );
      expect(
        compactOf('content/alignment-abilities-their-keys-names-numbers-and-words.ts'),
        "the Undead row's 5",
      ).toMatch(
        /'graves-keep-on-undead-land':\{howItIsUsed:'always on',alignment:'Undead',theNumbers:\{theShareOfTheGravesThatRotEachTurn:\{value:5,/,
      );
      expect(
        compactOf('engine/rules/alignment-abilities/the-graves-and-the-undead-of-a-realms-alignment.ts'),
        'the row read as a share',
      ).toMatch(/\['graves-keep-on-undead-land'\]\.theNumbers\.theShareOfTheGravesThatRotEachTurn\.value\/100\}/);
      expect(RW).toContain('grave has a 10% chance a turn to crumble');
    },
  );

  test("the Druid ward, Hand of Death's cap, the volley's Archery bonus and turn 2's recruiting", () => {
    expect((RW.match(/fey, elementals and aberrations/g) ?? []).length, 'both Druid-ward lists').toBeGreaterThanOrEqual(
      2,
    );
    expect(RW).toContain('reached only against a guardian weak to Necromancy');
    expect(RW).toContain('then 10% more for every level of your Archery');
    expect(RW).not.toContain('your recruiting capacity has doubled');
  });

  test("the intro's Druid row says 3–5", () => {
    expect(IW).toContain('wild creatures and monsters (Druid 3–5)');
  });

  test('two links: Research to the Sage discoveries, Recruit Armies to how many you may raise', () => {
    expect(RH).toMatch(/see <a href="#items">Sage discoveries<\/a>/);
    expect(RH).not.toMatch(/<a href="#armies">the wage rule<\/a>/);
    expect(RH).toMatch(/<a href="#recruit-limits">how many you may raise<\/a>/);
    expect(RH, 'the recruit-limit heading carries its anchor').toMatch(
      /<h3 id="recruit-limits">How many you may raise in a turn<\/h3>/,
    );
  });
});
