// The spells' effects the rule registry holds (plan P1-19's spells family, Decision 2): one row per spell, keyed by its
// slug, naming the spell as SPELL_DEFS_P keys it and its `fn`, with the numbers the code writes for it, each with how
// the spell's texts write it, by use (`battleMagic` from row P1-19u). The spells' registry (src/engine/rules/the-
// registry-of-spell-effects.ts) has one entry for each row and no other: a row with no entry, or an entry with no row,
// fails to compile. A row exists only for a spell whose effect the registry holds, so no row waits for its code.
//
// A save names a spell by its name (an order's `target`, a spell charm's `effect.spell`), never by its slug (Decision
// 8): the registry finds a spell's row by the name it is handed. SPELL_DEFS_P stays as it is (the player portal reads
// it). Change a number here, and the texts with it: tests/static/each-spells-numbers-are-in-its-blurb-and-the-rulebooks-
// table.test.ts reads every row against its spell's blurb (SPELL_DEFS_P's `desc`) and its row of the rulebook's spell
// table. The player page doesn't import this file.

/** How a spell's texts write a number: a share of a unit's base strength lost in words (0.5 as "half", "halved" or
 *  "halves"); a share lost as a percentage (0.2 as `20%`); a share lost written as the share kept, as a percentage (0.25
 *  as `75%`); a multiplier in words (0.5 as "half", "halved" or "halves"); how many of the strongest units it strikes,
 *  in words (1 as "strongest unit" or "strongest enemy army unit", 2 as "two strongest"); the level its effect counts
 *  the caster's to (5 as "counted to 5" or "counted to level 5"). */
export type HowASpellsTextsWriteANumber =
  | 'a share lost, in words'
  | 'a share lost, as a percentage'
  | 'a share lost, as the share kept'
  | 'a multiplier, in words'
  | 'the strongest units, in words'
  | 'the level it counts to';

/** One number of a spell's effect, and how its texts write it. */
export interface ANumberOfASpellsEffect {
  readonly value: number;
  readonly theTextsWriteIt: HowASpellsTextsWriteANumber;
}

/** A row: what the spells' registry and the spell's texts read of one spell. */
export interface ASpellAsItsTextsWriteIt {
  /** The spell's name, as SPELL_DEFS_P keys it (and an order or a save names it). */
  readonly name: string;
  /** Its `fn` in SPELL_DEFS_P (the key the Cast Spell order's code names it by). */
  readonly fn: string;
  /** Its battle magic's numbers, cast before an army battle (none where the effect is a mark on the enemy commander or
   *  a unit turned). */
  readonly battleMagic?: Readonly<Record<string, ANumberOfASpellsEffect>>;
}

export const SPELL_EFFECTS_THE_REGISTRY_HOLDS = {
  // ── Battle magic (strength, before an army battle, in each of the battle code's three copies: plan P1-19u) ──
  // The strongest enemy unit (or the two strongest, with an Ember Rune: the items' registry) loses half its base
  // strength (rounded, at least 1).
  fireball: {
    name: 'Fireball',
    fn: 'elemental_fireball',
    battleMagic: {
      theShareOfBaseStrengthLost: { value: 0.5, theTextsWriteIt: 'a share lost, in words' },
      theStrongestUnitsStruck: { value: 1, theTextsWriteIt: 'the strongest units, in words' },
    },
  },
  // As many enemy units as the caster's level, drawn at random (at least one; the level counted to 5 between heroes and
  // against guards, not by a guards' commander: Parked), each lose 20% of its base strength (rounded, at least 1).
  'lightning-bolt': {
    name: 'Lightning Bolt',
    fn: 'elemental_lightning',
    battleMagic: {
      theShareOfBaseStrengthLost: { value: 0.2, theTextsWriteIt: 'a share lost, as a percentage' },
      theLevelItCountsTo: { value: 5, theTextsWriteIt: 'the level it counts to' },
    },
  },
  // The enemy commander's Tactical bonus is halved for the battle (between heroes, only if he has Tactical and not at
  // sea: Parked).
  'telekinetic-storm': {
    name: 'Telekinetic Storm',
    fn: 'psychic_storm',
    battleMagic: { theTacticalMultiplier: { value: 0.5, theTextsWriteIt: 'a multiplier, in words' } },
  },
  // The enemy commander's Druid is negated for the battle (a mark the battle reads).
  'psychic-blast': { name: 'Psychic Blast', fn: 'psychic_blast', battleMagic: {} },
  // The enemy commander's best combat-affecting skill is marked to be halved for the battle (the halving is the
  // mark's readers').
  curse: { name: 'Curse', fn: 'necromancy_curse', battleMagic: {} },
  // One enemy undead unit, drawn at random, defects to the caster's side.
  'control-undead': { name: 'Control Undead', fn: 'necromancy_control', battleMagic: {} },
  // Every enemy undead unit loses a quarter of its base strength (rounded up).
  'holy-symbol': {
    name: 'Holy Symbol',
    fn: 'white_holy_symbol',
    battleMagic: { theShareOfBaseStrengthLost: { value: 0.25, theTextsWriteIt: 'a share lost, as the share kept' } },
  },
  // Every enemy missile unit loses half its base strength (rounded up).
  spiritwrack: {
    name: 'Spiritwrack',
    fn: 'white_spiritwrack',
    battleMagic: { theShareOfBaseStrengthLost: { value: 0.5, theTextsWriteIt: 'a share lost, in words' } },
  },
} as const satisfies Record<string, ASpellAsItsTextsWriteIt>;

/** A spell the registry holds, by its slug. */
export type SpellSlug = keyof typeof SPELL_EFFECTS_THE_REGISTRY_HOLDS;
