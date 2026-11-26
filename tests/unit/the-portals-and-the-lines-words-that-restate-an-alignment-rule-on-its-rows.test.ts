// The player portal's and the lines' words that restate an alignment rule, on its rows (B-06bt): each phrase, read
// from the alignments' rows (src/content/alignment-abilities-their-keys-names-numbers-and-words.ts), is word for word
// what the page and the turn's lines wrote before they read them. Bless Province's hint (SPELL_HINTS); the phrases the
// player portal writes from the rows (src/ui/player/the-words-the-player-portal-writes-of-an-alignments-rule-read-
// from-its-rows.ts): consecrated ground in the Consecrate order's hint and in the map's tooltip, the Diplomacy card's
// words on when its changes apply, the join form's notes on a king's first White Magic and Necromancy, and the creeds
// only one realm a game may hold; a realm works line's words (a consecration, a Consecrate refused to a crown of
// another creed, a Harvest the Field refused); a battle's lines (the Undead king's skeletal legions, savage fury, the
// attacker's savage fury under his Evil overlord). No matrix game reaches the portal's words, and the battles' and
// consecrations' lines only some games (the GM logs hold those that are reached).
// Each case hands the words function a made-up fact: no world, no dice and no seeded input reach the words, so each
// passes under any seed (run under KC_SEED=1 and KC_SEED=3).
// Level 1 (unit): calls the words functions and reads the constants on plain values; a static read of the source can't
// say what the words come to once each row's value is put in.
import { expect, test } from 'vitest';
import { SPELL_HINTS } from '../../src/ui/player/the-hints-the-order-form-shows-below-each-spell.ts';
import {
  CONSECRATED_GROUND_IN_THE_CONSECRATE_HINT,
  CONSECRATED_GROUND_IN_THE_MAPS_TOOLTIP,
  THE_CREEDS_ONLY_ONE_REALM_A_GAME_MAY_HOLD_IN_WORDS,
  THE_KINGS_FIRST_NECROMANCY,
  THE_KINGS_FIRST_WHITE_MAGIC,
  whenTheDiplomacyCardsChangesApply,
} from '../../src/ui/player/the-words-the-player-portal-writes-of-an-alignments-rule-read-from-its-rows.ts';
import { theWordsOfTheRealmWorksOrdersLine } from '../../src/views/prose/the-words-of-the-realm-works-orders-lines.ts';
import { theWordsOfABattlesLine } from '../../src/views/prose/the-words-of-a-battles-lines.ts';

const ALDRIC = { heroName: 'Aldric', leaderless: false };

test("Bless Province's hint: the Divine blessing's creed and its yields, by the realm's casters and the king", () => {
  expect(SPELL_HINTS['Bless Province']).toBe(
    'Target: a province you’re in or adjacent to. +60% tax base at collection this turn (+80% for Divine realms; +100% when the Divine KING casts it). The ground is also warded — 50% + 5% per White level (counted to 5, so 50–75%) to turn aside each enemy Flood, Earthquake, Plague or Part Sea cast here this turn. One Bless per province — does not stack.',
  );
});

test("consecrated ground's tax, the attackers' creeds and their cut: in the Consecrate hint, the map's tooltip and a consecration's line", () => {
  expect(CONSECRATED_GROUND_IN_THE_CONSECRATE_HINT, 'the Consecrate hint').toBe(
    '+50% tax, defenders twice as likely to fight fanatically, Undead/Evil invaders −15%',
  );
  expect(CONSECRATED_GROUND_IN_THE_MAPS_TOOLTIP, "the map's tooltip").toBe(
    '+50% tax, defenders twice as fanatical, Undead/Evil attackers −15%',
  );
  expect(
    theWordsOfTheRealmWorksOrdersLine({
      kind: 'a king consecrates a province',
      heroName: 'Aldric',
      provinceName: 'Highmoor',
      consecrated: 1,
      limit: 2,
    }),
    "a consecration's line",
  ).toBe(
    '✨ Aldric consecrates Highmoor! Holy ground: +50% tax, defenders twice as likely to fight with fanatical zeal, Undead and Evil invaders fight at −15%, and your fallen can be restored only here — they rise in the nearest consecrated province, which then gives up its consecration. If it is captured the consecration breaks at once and the conquerors are emboldened. (1/2 consecrated — set by your White skill; a consecrated province that is captured frees a slot.)',
  );
});

test("the Diplomacy card: an Evil or an Undead realm's war without warning, and their broken alliance's war", () => {
  expect(String(whenTheDiplomacyCardsChangesApply())).toBe(
    "Changes apply at the start of next turn — except that an <strong>Evil</strong> or <strong>Undead</strong> realm's declaration of war takes effect at the <strong>start of this very turn</strong>: its armies may attack the moment the orders run. <strong>Breaking an alliance</strong> returns the two realms to <strong>Neutral</strong> — only an Evil or Undead crown goes straight from alliance to war.",
  );
});

test("the join form: a Divine king's first White Magic, an Undead king's first Necromancy, and one Divine and one Undead realm a game", () => {
  expect(THE_KINGS_FIRST_WHITE_MAGIC, 'White Magic').toBe('(Divine realms start with White 1)');
  expect(THE_KINGS_FIRST_NECROMANCY, 'Necromancy').toBe('(Undead realms start with Necromancy 1)');
  expect(THE_CREEDS_ONLY_ONE_REALM_A_GAME_MAY_HOLD_IN_WORDS, 'one realm a game').toBe('Divine or Undead');
});

test("a realm works line: Consecrate refused to a crown of another creed, Harvest the Field refused to a realm that isn't Undead", () => {
  expect(
    theWordsOfTheRealmWorksOrdersLine({
      kind: 'the gods answer a consecration only from a Divine crown',
      heroName: 'Aldric',
    }),
    'Consecrate refused',
  ).toBe('Aldric kneels and prays, but the gods answer only Divine crowns — Consecration is not for this realm.');
  expect(
    theWordsOfTheRealmWorksOrdersLine({ kind: 'only Undead realms keep corpse-carters', heroName: 'Aldric' }),
    'Harvest the Field refused',
  ).toBe('Aldric has neither the craft nor the stomach for grave-harvesting — only Undead realms keep corpse-carters.');
});

test("a battle's lines: the Undead king's skeletal legions, savage fury, and savage fury under the Evil overlord", () => {
  expect(
    theWordsOfABattlesLine({
      kind: "a side's skeletal legions fight with fanaticism under their undead king",
      sideName: ALDRIC,
      undeadKingFanaticismPct: 50,
    }),
    'the Undead king',
  ).toBe("Aldric's skeletal legions fight with undying fanaticism under their Undead king! (+50% strength)");
  expect(
    theWordsOfABattlesLine({ kind: "a side's monsters are driven to savage fury", sideName: ALDRIC }),
    'savage fury',
  ).toBe("Aldric's monsters are driven to savage fury! (+25% strength)");
  expect(
    theWordsOfABattlesLine({ kind: "the attacker's monsters are driven to savage fury", cName: ALDRIC }),
    'savage fury under the Evil overlord',
  ).toBe("Aldric's monsters are driven to savage fury under their Evil overlord! (+25% strength)");
});
