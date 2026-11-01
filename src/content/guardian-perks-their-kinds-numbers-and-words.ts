// The guardian perks the rule registry holds (plan P1-19's guardian perks, Decision 2): one row per kind of perk,
// keyed by its slug, naming the kind as MONSTERS_P writes it (a perk's `fx`: its `ward`, or the one rider it carries),
// with its value at each grade (the decided table, 2026-10-14, batch item 7), the form of its words and its row in the
// rulebook's table "Guardian perks by grade". The guardian perks' registry (src/engine/rules/the-registry-of-guardian-
// perks.ts) has one entry for each row and no other: a row with no entry, or an entry with no row, fails to compile.
//
// Fourteen kinds are the items' too: a guardian's perk of the same ward or rider reaches the items' effect (one applier,
// pcApplyFx, and one effect), and its row names that effect (Choice 2). A held guardian carries its own copy of its
// perks (its `passives`), and the fight reads that copy's number, as a held item's: the values here are the table the
// words and the rulebook state, which tests/unit/guardian-perks.test.ts reads every guardian's perks against, and
// migrateLairGuardiansV2 re-reads a running game's guardians from MONSTERS_P when GUARDIAN_TABLE_VER rises. The words
// test (tests/static/each-guardian-perks-number-is-in-its-words-and-the-rulebooks-table.test.ts) reads each perk's
// `desc` and the rulebook's table against these rows. The player page doesn't import this file.
import type { ARiderAnItemCarries, MagicItemEffectSlug } from './magic-item-effects-their-names-numbers-and-words.ts';

/** How MONSTERS_P writes a kind of perk: a ward (its `fx.ward`, with its `pct` or `amt`, and a school's ward its
 *  `school`), or a rider (its `fx`'s one key, with its number). */
export type HowAGuardianCarriesAPerk = { readonly ward: string } | { readonly rider: ARiderAnItemCarries };

/** How a perk's words and the rulebook write its number: as it is (`20` as `20`), or a share as a percentage (0.15 as
 *  `15`). */
export type HowAPerksNumberIsWritten = 'as it is' | 'a share, as a percentage';

/** A kind's row in the rulebook's table "Guardian perks by grade": the text of its first cell, and how a cell writes
 *  the kind's value (`{N}` its number; where two kinds share a row, `part` is which side of the cells' ` / `). */
export interface APerksRowInTheRulebook {
  readonly row: string;
  readonly aCellWritesIt: string;
  readonly part?: 0 | 1;
}

/** A row: what the guardian perks' registry, the words test and the rulebook's table read of one kind of perk. */
export interface AKindOfGuardianPerk {
  /** The kind, as MONSTERS_P writes it. */
  readonly carriedAs: HowAGuardianCarriesAPerk;
  /** Its value at Weak, Moderate, Powerful and Legendary: the decided table (a perk of the kind at a grade carries
   *  this). A hit cap's lower ceiling is the stronger. */
  readonly theValueAtEachGrade: readonly [weak: number, moderate: number, powerful: number, legendary: number];
  /** How its words and the rulebook write its number. */
  readonly itsNumberIsWritten: HowAPerksNumberIsWritten;
  /** The words of a perk of the kind (its `desc`): `{N}` its number, `{School}` a school's ward's school (capitalised),
   *  `{theShareASecondWindWaitsFor}` the items' share of his health a second wind waits for (as a percentage). */
  readonly itsWords: string;
  /** The words of a perk of the kind at a full ward (100), where they are other words. */
  readonly itsWordsAtAFullWard?: string;
  /** Its row in the rulebook's table. */
  readonly inTheRulebook: APerksRowInTheRulebook;
  /** For a kind the items share: the items' effect a perk of the kind reaches. */
  readonly theItemsEffectItReaches?: MagicItemEffectSlug;
}

/** The kinds of perk the guardian perks' registry holds, by slug, in the order of the rulebook's table. */
export const GUARDIAN_PERKS_THE_REGISTRY_HOLDS = {
  // −N off a cast of its school at it, none against the school it is weak to (a guardian's alone)
  'a-ward-against-one-school': {
    carriedAs: { ward: 'schoolWard' },
    theValueAtEachGrade: [20, 30, 40, 50],
    itsNumberIsWritten: 'as it is',
    itsWords: '{School} Magic cast at it is −{N}% to take hold',
    inTheRulebook: { row: 'Ward against one school of magic (off the cast chance)', aCellWritesIt: '−{N}%' },
  },
  'spell-resistance': {
    carriedAs: { ward: 'spellPct' },
    theValueAtEachGrade: [15, 25, 35, 45],
    itsNumberIsWritten: 'as it is',
    itsWords: 'spells deal {N}% less harm to it, their burns included',
    inTheRulebook: { row: 'Spell resistance (less harm from every spell, burns included)', aCellWritesIt: '{N}%' },
    theItemsEffectItReaches: 'spell-damage-cut',
  },
  // a stun, a daze or a hold shrugged off as it lands, on its chance (a guardian's alone)
  'a-stun-ward': {
    carriedAs: { ward: 'stunWard' },
    theValueAtEachGrade: [40, 60, 80, 100],
    itsNumberIsWritten: 'as it is',
    itsWords: 'shrugs off {N}% of stuns, dazes and holds the moment they land',
    itsWordsAtAFullWard: 'cannot be stunned, dazed or held',
    inTheRulebook: { row: 'Stun ward (stuns, dazes and holds shrugged off as they land)', aCellWritesIt: '{N}%' },
  },
  // its share off every tick of a lingering harm (a guardian's alone)
  'a-lingering-harm-ward': {
    carriedAs: { ward: 'dotWard' },
    theValueAtEachGrade: [40, 60, 80, 100],
    itsNumberIsWritten: 'as it is',
    itsWords: 'lingering harm (burns, poison, bleeding) bites it {N}% less',
    inTheRulebook: { row: 'Lingering-harm ward (less from burns, poison, bleeding)', aCellWritesIt: '{N}%' },
  },
  'a-tough-hide': {
    carriedAs: { ward: 'meleeDR' },
    theValueAtEachGrade: [1, 2, 3, 4],
    itsNumberIsWritten: 'as it is',
    itsWords: 'every blow against it deals {N} less',
    inTheRulebook: { row: 'Tough hide / arrow-proof (less from each blow / arrow)', aCellWritesIt: '{N}' },
    theItemsEffectItReaches: 'melee-damage-turned-aside',
  },
  'arrow-proof': {
    carriedAs: { ward: 'arrowDR' },
    theValueAtEachGrade: [1, 2, 3, 4],
    itsNumberIsWritten: 'as it is',
    itsWords: 'every arrow against it deals {N} less',
    inTheRulebook: { row: 'Tough hide / arrow-proof (less from each blow / arrow)', aCellWritesIt: '{N}' },
    theItemsEffectItReaches: 'arrow-damage-turned-aside',
  },
  'hard-to-hit': {
    carriedAs: { ward: 'dodge' },
    theValueAtEachGrade: [5, 10, 15, 20],
    itsNumberIsWritten: 'as it is',
    itsWords: 'hard to pin down — blows and arrows aimed at it are −{N}% to hit',
    inTheRulebook: { row: 'Hard to hit (your blows and arrows)', aCellWritesIt: '−{N}%' },
    theItemsEffectItReaches: 'dodge',
  },
  'a-dread-aura': {
    carriedAs: { rider: 'aura' },
    theValueAtEachGrade: [5, 8, 12, 15],
    itsNumberIsWritten: 'as it is',
    itsWords: 'a foe fighting it is −{N}% to hit with blows and arrows',
    inTheRulebook: { row: 'Dread aura (you, to hit it, all fight)', aCellWritesIt: '−{N}%' },
    theItemsEffectItReaches: 'aura-rider',
  },
  'a-keen-eye': {
    carriedAs: { rider: 'hitBonus' },
    theValueAtEachGrade: [5, 10, 15, 20],
    itsNumberIsWritten: 'as it is',
    itsWords: '+{N}% to hit',
    inTheRulebook: { row: 'Keen eye (its own to-hit) / brute strength (its damage)', aCellWritesIt: '+{N}%', part: 0 },
    theItemsEffectItReaches: 'hit-bonus-rider',
  },
  // its words say "every blow and special": a special's weight multiplies it (plan NEXT.md question 34)
  'brute-strength': {
    carriedAs: { rider: 'dmgBonus' },
    theValueAtEachGrade: [1, 2, 3, 4],
    itsNumberIsWritten: 'as it is',
    itsWords: '+{N} damage on every blow and special',
    inTheRulebook: { row: 'Keen eye (its own to-hit) / brute strength (its damage)', aCellWritesIt: '+{N}', part: 1 },
    theItemsEffectItReaches: 'damage-bonus-rider',
  },
  thorns: {
    carriedAs: { ward: 'thorns' },
    theValueAtEachGrade: [1, 2, 3, 4],
    itsNumberIsWritten: 'as it is',
    itsWords: 'whoever lands a blow on it takes {N}',
    inTheRulebook: {
      row: 'Thorns (you take, per blow you land) / fire or frost aura (you take each round in melee)',
      aCellWritesIt: '{N}',
    },
    theItemsEffectItReaches: 'thorns',
  },
  'a-fire-or-frost-aura': {
    carriedAs: { rider: 'burn' },
    theValueAtEachGrade: [1, 2, 3, 4],
    itsNumberIsWritten: 'as it is',
    itsWords: 'a foe in melee with it takes {N} a round',
    inTheRulebook: {
      row: 'Thorns (you take, per blow you land) / fire or frost aura (you take each round in melee)',
      aCellWritesIt: '{N}',
    },
    theItemsEffectItReaches: 'burn-rider',
  },
  // a guardian's fades as a fight runs long (THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS)
  regeneration: {
    carriedAs: { ward: 'regen' },
    theValueAtEachGrade: [1, 2, 3, 4],
    itsNumberIsWritten: 'as it is',
    itsWords: 'regenerates {N} HP a round (half as fast after the fourth round, spent after the eighth)',
    inTheRulebook: { row: 'Regeneration (HP a round; half after round 4, none after round 8)', aCellWritesIt: '{N}' },
    theItemsEffectItReaches: 'regeneration',
  },
  // a guardian's fades the same way
  'life-drain': {
    carriedAs: { rider: 'drain' },
    theValueAtEachGrade: [0.15, 0.25, 0.35, 0.5],
    itsNumberIsWritten: 'a share, as a percentage',
    itsWords: 'heals {N}% of the melee damage it deals (the thirst fades as a fight runs long)',
    inTheRulebook: { row: 'Life drain (of the melee damage it deals; fades the same way)', aCellWritesIt: '{N}%' },
    theItemsEffectItReaches: 'drain-rider',
  },
  'a-second-wind': {
    carriedAs: { ward: 'secondWind' },
    theValueAtEachGrade: [15, 20, 25, 30],
    itsNumberIsWritten: 'as it is',
    itsWords:
      'once, the first time it falls below {theShareASecondWindWaitsFor}% health, it recovers {N}% of its health',
    inTheRulebook: { row: 'Second wind (once, below 30% health: health recovered)', aCellWritesIt: '{N}%' },
    theItemsEffectItReaches: 'second-wind',
  },
  'desperate-defence': {
    carriedAs: { ward: 'lowHp' },
    theValueAtEachGrade: [15, 20, 25, 30],
    itsNumberIsWritten: 'as it is',
    itsWords: 'takes {N}% less from everything while below half health',
    inTheRulebook: { row: 'Desperate defence (less from everything below half health)', aCellWritesIt: '{N}%' },
    theItemsEffectItReaches: 'damage-cut-at-low-hp',
  },
  // the looser of a guardian's own cap and his grade's is merged, and a tighter own cap kept
  // (THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS)
  'a-hit-cap': {
    carriedAs: { ward: 'cap' },
    theValueAtEachGrade: [40, 35, 25, 15],
    itsNumberIsWritten: 'as it is',
    itsWords: 'no single hit takes more than {N}% of its health',
    inTheRulebook: { row: 'Hit cap (no single hit takes more than this of its health)', aCellWritesIt: '{N}%' },
    theItemsEffectItReaches: 'a-hits-damage-capped',
  },
} as const satisfies Readonly<Record<string, AKindOfGuardianPerk>>;

/** A kind of perk's slug. */
export type GuardianPerkSlug = keyof typeof GUARDIAN_PERKS_THE_REGISTRY_HOLDS;

/** The numbers the code writes for a guardian's perks, beside each perk's own (no perk carries them). */
export const THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS = {
  // every guardian of a grade named here carries a cap on a single hit beside his perks (GUARDIAN_BODY_CAP_PCT, which
  // pcMonsterCombatant merges after them): Legendary 20%. The rulebook: "every Legendary guardian also carries its
  // grade's own 20% hit cap".
  theCapOfEachGrade: { Legendary: 20 },
  // a guardian's regeneration and drain at full strength for the first 4 rounds, at half to the 8th, then spent
  // (pcSustainMult's PC_SUSTAIN_FULL_ROUNDS and PC_SUSTAIN_HALF_ROUNDS; a hero's are never spent)
  theSustainsFade: { theRoundsAtFullStrength: 4, theRoundsAtHalfStrength: 8 },
  // a ward of 100 turns every stun, or every tick of a lingering harm: the words write the stun ward's in words, and the
  // rulebook both as "all"
  aFullWard: { value: 100, theRulebookWritesIt: 'all' },
} as const;
