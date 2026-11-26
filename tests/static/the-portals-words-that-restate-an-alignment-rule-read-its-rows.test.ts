// The portal's words that restate an alignment rule read its rows (B-06bt, T7, the rules pulled out: Run 3e, the
// player portal's alignment rules). Each place where the player portal or the turn's lines write an alignment's rule
// in prose no longer holds the creed's name or the number as written text: it reads the alignment's row
// (src/content/alignment-abilities-their-keys-names-numbers-and-words.ts) or a phrase built from it. The places:
// Bless Province's hint, consecrated ground in the Consecrate order's hint, the map's tooltip and a consecration's
// line, the Diplomacy card's war without warning and broken alliance, the join form's kings' first skills and its one
// Divine and one Undead realm a game, the battle lines' Undead king and savage fury, and the realm works' Divine crowns
// and Undead corpse-carters. A number the words write as a word ("twice"), an article ("an Evil") and a skill's name
// ("White Magic") stay in the words: each is held here to its row, so a row changed alone turns this red. The player
// page's HTML (src/kingdoms-call-player-portal.html: the build copies its words as they are) is held to the rows here:
// its alignment options, and its note on the kings' first skills.
// Red on its row's base by design (each place held its words as text), as the family's other static tests were (Theo,
// 2026-10-25). The words themselves, word for word: tests/unit/the-portals-and-the-lines-words-that-restate-an-
// alignment-rule-on-its-rows.test.ts.
// Level 0 (static): the files' text and content's rows as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import { ALIGNMENT_ABILITIES } from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { KC_ALIGNMENTS } from '../../src/content/kingdoms-call-data.ts';

const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

const THE_PORTALS_WORDS =
  'src/ui/player/the-words-the-player-portal-writes-of-an-alignments-rule-read-from-its-rows.ts';
const THE_REALM_WORKS_WORDS = 'src/views/prose/the-words-of-the-realm-works-orders-lines.ts';

/** Each place, by its file: the words it wrote as text (none may be left), and what it reads instead (each must be
 *  there). */
const THE_PLACES: readonly (readonly [place: string, file: string, theTextGone: string[], whatItReads: string[]])[] = [
  [
    "Bless Province's hint",
    'src/ui/player/the-hints-the-order-form-shows-below-each-spell.ts',
    ['+80% for Divine realms', 'the Divine KING casts it'],
    ["ALIGNMENT_ABILITIES['the-divine-blessing']", 'byTheRealmsCasters', 'byTheKingInPerson'],
  ],
  [
    'the Consecrate hint',
    'src/ui/player/order-targets.ts',
    ['+50% tax, defenders twice as likely to fight fanatically, Undead/Evil invaders −15%'],
    ['${CONSECRATED_GROUND_IN_THE_CONSECRATE_HINT}'],
  ],
  [
    "the map's consecrated tooltip",
    'src/ui/player/map.ts',
    ['+50% tax, defenders twice as fanatical, Undead/Evil attackers \\u221215%'],
    ['${CONSECRATED_GROUND_IN_THE_MAPS_TOOLTIP}'],
  ],
  [
    'the Diplomacy card',
    'src/ui/player/map-symbols.ts',
    ["<strong>Evil</strong> or <strong>Undead</strong> realm's declaration", 'only an Evil or Undead crown'],
    ['${whenTheDiplomacyCardsChangesApply()}'],
  ],
  [
    'the join form',
    'src/ui/player/join-and-chronicle.ts',
    [
      '(Divine realms start with White 1)',
      '(Undead realms start with Necromancy 1)',
      'may be Divine or Undead',
      'may choose Divine or Undead',
    ],
    [
      '${THE_KINGS_FIRST_WHITE_MAGIC}',
      '${THE_KINGS_FIRST_NECROMANCY}',
      'may be ${THE_CREEDS_ONLY_ONE_REALM_A_GAME_MAY_HOLD_IN_WORDS}',
      'may choose ${THE_CREEDS_ONLY_ONE_REALM_A_GAME_MAY_HOLD_IN_WORDS}',
    ],
  ],
  [
    "the portal's phrases",
    THE_PORTALS_WORDS,
    ['Undead/Evil', 'Evil</strong>', 'Undead</strong>', 'an Evil or Undead', 'Divine realms', 'Undead realms'],
    [
      "ALIGNMENT_ABILITIES['consecrated-ground-tax'].theNumbers.theShareMoreTax.value",
      "ALIGNMENT_ABILITIES['consecrated-ground-weakens-an-unholy-attacker']",
      'theCreedsItActsAgainst',
      'theShareWeaker',
      "ALIGNMENT_ABILITIES['war-without-warning-of-an-evil-realm'].alignment",
      "ALIGNMENT_ABILITIES['war-without-warning-of-an-undead-realm'].alignment",
      "ALIGNMENT_ABILITIES['a-broken-alliance-means-war-for-an-evil-realm'].alignment",
      "ALIGNMENT_ABILITIES['a-broken-alliance-means-war-for-an-undead-realm'].alignment",
      "ALIGNMENT_ABILITIES['a-divine-king-starts-with-white-magic']",
      "ALIGNMENT_ABILITIES['an-undead-king-starts-with-necromancy']",
      'theAlignmentsOnlyOneRealmAGameMayHold()',
    ],
  ],
  [
    "the battle lines' words",
    'src/views/prose/the-words-of-a-battles-lines.ts',
    ['under their Undead king', 'savage fury! (+25% strength)', 'under their Evil overlord! (+25% strength)'],
    [
      "under their ${ALIGNMENT_ABILITIES['skeletal-fervour'].alignment} king!",
      "under their ${ALIGNMENT_ABILITIES['savage-fury'].alignment} overlord!",
      "ALIGNMENT_ABILITIES['savage-fury'].theNumbers.theStrengthOfTheHost.value",
    ],
  ],
  [
    "the realm works' words",
    THE_REALM_WORKS_WORDS,
    [
      'only Divine crowns',
      '+50% tax',
      'Undead and Evil invaders fight at −15%',
      'only Undead realms keep corpse-carters.`',
    ],
    [
      'only ${THE_ALIGNMENT_ORDERS.consecrate.alignment} crowns',
      "ALIGNMENT_ABILITIES['consecrated-ground-tax'].theNumbers.theShareMoreTax.value",
      "ALIGNMENT_ABILITIES['consecrated-ground-weakens-an-unholy-attacker']",
      "only ${THE_ALIGNMENT_ORDERS['harvest-the-field'].alignment} realms keep corpse-carters.`",
    ],
  ],
];

test.each(THE_PLACES)('%s (%s) reads its rows, not the words as text', (_place, file, theTextGone, whatItReads) => {
  const theCode = read(file);
  for (const text of theTextGone) expect(theCode.includes(text), `${file} still writes "${text}"`).toBe(false);
  for (const read of whatItReads) expect(theCode.includes(read), `${file} doesn't read "${read}"`).toBe(true);
});

test('consecrated ground\'s defenders roll zeal at twice the chance: the three phrases write its row\'s 2 as "twice"', () => {
  expect(ALIGNMENT_ABILITIES['consecrated-ground-doubles-a-defenders-zeal'].theNumbers.theTimesTheChance.value).toBe(2);
  expect(read(THE_PORTALS_WORDS).split('defenders twice as').length - 1, "the portal's two phrases").toBe(2);
  expect(read(THE_REALM_WORKS_WORDS).split('defenders twice as').length - 1, "a consecration's line").toBe(1);
});

test('the words around the names the rows give: "an" before each creed that wars without warning or breaks an alliance into war, and the skills a king starts with', () => {
  for (const slug of [
    'war-without-warning-of-an-evil-realm',
    'war-without-warning-of-an-undead-realm',
    'a-broken-alliance-means-war-for-an-evil-realm',
    'a-broken-alliance-means-war-for-an-undead-realm',
  ] as const)
    expect(ALIGNMENT_ABILITIES[slug].alignment, `${slug}'s creed after "an"`).toMatch(/^[AEIOU]/);
  expect(ALIGNMENT_ABILITIES['a-divine-king-starts-with-white-magic'].theSkillItGives, 'written "White"').toBe('white');
  expect(ALIGNMENT_ABILITIES['an-undead-king-starts-with-necromancy'].theSkillItGives, 'written "Necromancy"').toBe(
    'necromancy',
  );
});

test("the player page's alignment options are the alignments, in order, and its note on the kings' first skills is the rows'", () => {
  const thePage = read('src/kingdoms-call-player-portal.html');
  const theSelect = /<select id="join-alignment"[^>]*>([\s\S]*?)<\/select>/.exec(thePage)?.[1] ?? '';
  const theOptions = [...theSelect.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)];
  expect(
    theOptions.map((o) => o[1]),
    'the options',
  ).toEqual([...KC_ALIGNMENTS]);
  for (const o of theOptions) expect(o[2], `the option ${String(o[1])}'s words`).toBe(o[1]);
  const white = ALIGNMENT_ABILITIES['a-divine-king-starts-with-white-magic'];
  const necromancy = ALIGNMENT_ABILITIES['an-undead-king-starts-with-necromancy'];
  expect(white.theSkillItGives).toBe('white');
  expect(necromancy.theSkillItGives).toBe('necromancy');
  expect(thePage, "the note on the kings' first skills").toContain(
    `${white.alignment} alignment adds White Magic ${String(white.theNumbers.theLevelsMore.value)}; ${necromancy.alignment} alignment adds Necromancy ${String(necromancy.theNumbers.theLevelsMore.value)}.`,
  );
});
