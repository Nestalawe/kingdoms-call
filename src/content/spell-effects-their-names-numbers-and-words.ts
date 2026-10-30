// The spells' effects the rule registry holds (plan P1-19's spells family, Decision 2): one row per spell, keyed by its
// slug, naming the spell as SPELL_DEFS_P keys it and its `fn`, with the numbers the code writes for it, each with how
// the spell's texts write it, by use (`battleMagic` from row P1-19u). The spells' registry (src/engine/rules/the-
// registry-of-spell-effects.ts) has one entry for each row and no other: a row with no entry, or an entry with no row,
// fails to compile. A row exists only for a spell whose effect the registry holds, so no row waits for its code.
// `combat` holds the numbers of the spell's effect in a personal combat (from row P1-19w), read by its stages "a combat
// spell takes hold", "a fighter's spell adds to his steal" and "a mirror image is disbelieved" (from row P1-19x); a rule the spell shares with every other (its effect's level counted to 5, a guardian weak to its
// school doubling what doesn't harm, at least 1 of any harm or rounds) stays in the resolver, pcCastCombatSpell.
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
 *  the caster's to (5 as "counted to 5" or "counted to level 5"); and, in a personal combat: a percentage (10 as
 *  `10%`); rounds (3 as "3 rounds" or "three rounds", 1 as "1 round" or "one round"); rounds longer (1 as "one round
 *  longer"); the most rounds (3 as "at most 3" or "up to 3"); the levels for each round more, in words (2 as "per two"
 *  or "every two"); a share in words (0.25 as "a quarter"); a multiplier as a figure (1.5 as `×1.5` or "half as much
 *  again"); the least and the most of a range of damage (1 and 3 as `1–3`); a divisor in words (2 as "halve", "halved"
 *  or "halves"). */
export type HowASpellsTextsWriteANumber =
  | 'a share lost, in words'
  | 'a share lost, as a percentage'
  | 'a share lost, as the share kept'
  | 'a multiplier, in words'
  | 'the strongest units, in words'
  | 'the level it counts to'
  | 'a percentage'
  | 'rounds'
  | 'rounds longer'
  | 'the most rounds'
  | 'the levels for each round more, in words'
  | 'a share, in words'
  | 'a multiplier, as a figure'
  | 'the least of a range'
  | 'the most of a range'
  | 'a divisor, in words';

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
  /** Its numbers in a personal combat, once it takes hold (from row P1-19w). */
  readonly combat?: Readonly<Record<string, ANumberOfASpellsEffect>>;
}

export const SPELL_EFFECTS_THE_REGISTRY_HOLDS = {
  // Battle magic (strength, before an army battle, in each of the battle code's three copies: plan P1-19u), and a combat
  // spell in a personal combat (personalCombat, once its cast takes hold: plan P1-19w), each described above its row.
  //
  // Battle magic: the strongest enemy unit (or the two strongest, with an Ember Rune: the items' registry) loses half
  // its base strength (rounded, at least 1). Combat: the target burns for 10% of its maximum HP a round and 2% a level,
  // for three rounds (a guardian weak to Elemental twice that; a spell ward cuts it by its share).
  fireball: {
    name: 'Fireball',
    fn: 'elemental_fireball',
    battleMagic: {
      theShareOfBaseStrengthLost: { value: 0.5, theTextsWriteIt: 'a share lost, in words' },
      theStrongestUnitsStruck: { value: 1, theTextsWriteIt: 'the strongest units, in words' },
    },
    combat: {
      theShareOfMaximumHpItBurnsARound: { value: 10, theTextsWriteIt: 'a percentage' },
      theShareMoreALevel: { value: 2, theTextsWriteIt: 'a percentage' },
      theRoundsItBurns: { value: 3, theTextsWriteIt: 'rounds' },
    },
  },
  // Battle magic: as many enemy units as the caster's level, drawn at random (at least one; the level counted to 5
  // between heroes and against guards, not by a guards' commander: Parked), each lose 20% of its base strength (rounded,
  // at least 1). Combat: 1 to 3 damage a level, each level's drawn.
  'lightning-bolt': {
    name: 'Lightning Bolt',
    fn: 'elemental_lightning',
    battleMagic: {
      theShareOfBaseStrengthLost: { value: 0.2, theTextsWriteIt: 'a share lost, as a percentage' },
      theLevelItCountsTo: { value: 5, theTextsWriteIt: 'the level it counts to' },
    },
    combat: {
      theLeastDamageALevel: { value: 1, theTextsWriteIt: 'the least of a range' },
      theMostDamageALevel: { value: 3, theTextsWriteIt: 'the most of a range' },
    },
  },
  // Battle magic: the enemy commander's Tactical bonus is halved for the battle (between heroes, only if he has Tactical
  // and not at sea: Parked). Combat: 12% of the target's maximum HP and 3% a level, and the caster takes a quarter of
  // it back.
  'telekinetic-storm': {
    name: 'Telekinetic Storm',
    fn: 'psychic_storm',
    battleMagic: { theTacticalMultiplier: { value: 0.5, theTextsWriteIt: 'a multiplier, in words' } },
    combat: {
      theShareOfMaximumHpItDeals: { value: 12, theTextsWriteIt: 'a percentage' },
      theShareMoreALevel: { value: 3, theTextsWriteIt: 'a percentage' },
      theShareTheCasterTakesBack: { value: 0.25, theTextsWriteIt: 'a share, in words' },
    },
  },
  // Battle magic: the enemy commander's Druid is negated for the battle (a mark the battle reads). Combat: the target is
  // stunned for 1 round and 1 more for every two levels (doubled against a guardian weak to Psychic; the Dreamstone's
  // round after the doubling: the items' registry).
  'psychic-blast': {
    name: 'Psychic Blast',
    fn: 'psychic_blast',
    battleMagic: {},
    combat: {
      theRoundsItStuns: { value: 1, theTextsWriteIt: 'rounds' },
      theLevelsForEachRoundMore: { value: 2, theTextsWriteIt: 'the levels for each round more, in words' },
    },
  },
  // Battle magic: the enemy commander's best combat-affecting skill is marked to be halved for the battle (the halving is
  // the mark's readers'). Combat: the best of the target's Melee, Archery and best school is halved (rounded down) for
  // the fight, Melee first on a tie, then Archery.
  curse: {
    name: 'Curse',
    fn: 'necromancy_curse',
    battleMagic: {},
    combat: { theDivisorOfHisBestSkill: { value: 2, theTextsWriteIt: 'a divisor, in words' } },
  },
  // Battle magic: one enemy undead unit, drawn at random, defects to the caster's side. Combat: an undead foe is stunned
  // for a round a level, the level counted to 5 (the rule every spell shares), unless a stun ward turns it; the living
  // are beyond its hold.
  'control-undead': { name: 'Control Undead', fn: 'necromancy_control', battleMagic: {}, combat: {} },
  // Battle magic: every enemy undead unit loses a quarter of its base strength (rounded up). Combat: the target's aim is
  // cut by 8 a level, and it is seared for 6% of its maximum HP (both ×1.5 against the undead and fiends, and the cut
  // doubled against a guardian weak to White); the caster recovers 10% of his own (of 20 when he has none).
  'holy-symbol': {
    name: 'Holy Symbol',
    fn: 'white_holy_symbol',
    battleMagic: { theShareOfBaseStrengthLost: { value: 0.25, theTextsWriteIt: 'a share lost, as the share kept' } },
    combat: {
      theCutToTheTargetsAimALevel: { value: 8, theTextsWriteIt: 'a percentage' },
      theShareOfMaximumHpItSears: { value: 6, theTextsWriteIt: 'a percentage' },
      theShareOfHisOwnMaximumHpTheCasterRecovers: { value: 10, theTextsWriteIt: 'a percentage' },
      theMultiplierAgainstTheUndeadAndFiends: { value: 1.5, theTextsWriteIt: 'a multiplier, as a figure' },
    },
  },
  // Battle magic: every enemy missile unit loses half its base strength (rounded up). Combat: the target is silenced,
  // and its melee halved, for 1 round and 1 more for every two levels, at most 3 (one round longer against a guardian
  // weak to White); a Powerful guardian may shrug it off 25 in 100 a round after the first, a Legendary one 40.
  spiritwrack: {
    name: 'Spiritwrack',
    fn: 'white_spiritwrack',
    battleMagic: { theShareOfBaseStrengthLost: { value: 0.5, theTextsWriteIt: 'a share lost, in words' } },
    combat: {
      theRoundsItSilences: { value: 1, theTextsWriteIt: 'rounds' },
      theLevelsForEachRoundMore: { value: 2, theTextsWriteIt: 'the levels for each round more, in words' },
      theMostRounds: { value: 3, theTextsWriteIt: 'the most rounds' },
      theRoundsLongerAgainstAGuardianWeakToWhite: { value: 1, theTextsWriteIt: 'rounds longer' },
      theChanceAPowerfulGuardianShrugsItOff: { value: 25, theTextsWriteIt: 'a percentage' },
      theChanceALegendaryGuardianShrugsItOff: { value: 40, theTextsWriteIt: 'a percentage' },
    },
  },
  // Combat: a chance of 10 in 100 a level (doubled against a guardian weak to Necromancy), at most 60, to strike for 40%
  // of the target's maximum HP (×1.1 with a Death's Finger Ring: the items' registry).
  'hand-of-death': {
    name: 'Hand of Death',
    fn: 'necromancy_hand',
    combat: {
      theChanceALevel: { value: 10, theTextsWriteIt: 'a percentage' },
      theMostChance: { value: 60, theTextsWriteIt: 'a percentage' },
      theShareOfMaximumHpItStrikesFor: { value: 40, theTextsWriteIt: 'a percentage' },
    },
  },
  // ── The other combat spells (plan P1-19x), each in a personal combat alone. ──
  //
  // Combat: a phantom of the target, of 40% of his health now (at least 1) and fighting by his own plan (its Mirror
  // Image casts stripped), fights him for 3 rounds; cast again while one fights, both images vanish. Each round he may
  // see through it: a hero at 4% for each of his skill levels together, a guardian at 5% and 3% for each level of his
  // Melee (half that against a caster with a Mirror Shard: the items' registry), between 2% and 90%.
  'mirror-image': {
    name: 'Mirror Image',
    fn: 'illusory_mirror_image',
    combat: {
      theShareOfHisHealthTheImageCarries: { value: 40, theTextsWriteIt: 'a percentage' },
      theRoundsItLasts: { value: 3, theTextsWriteIt: 'rounds' },
      theChanceAHeroSeesThroughItForEachSkillLevel: { value: 4, theTextsWriteIt: 'a percentage' },
      theChanceAGuardianSeesThroughIt: { value: 5, theTextsWriteIt: 'a percentage' },
      theChanceMoreForEachLevelOfAGuardiansMelee: { value: 3, theTextsWriteIt: 'a percentage' },
      theLeastChanceItIsSeenThrough: { value: 2, theTextsWriteIt: 'a percentage' },
      theMostChanceItIsSeenThrough: { value: 90, theTextsWriteIt: 'a percentage' },
    },
  },
  // Combat: the foes' aim at the caster is cut by 10% and 4% a level (or by more, if it already was), and he gains 30%
  // to flee and, if he steals in the fight, 15% to his steal.
  invisibility: {
    name: 'Invisibility',
    fn: 'illusory_invisibility',
    combat: {
      theCutToHisFoesAim: { value: 10, theTextsWriteIt: 'a percentage' },
      theCutMoreALevel: { value: 4, theTextsWriteIt: 'a percentage' },
      theFlightAdded: { value: 30, theTextsWriteIt: 'a percentage' },
      theStealAdded: { value: 15, theTextsWriteIt: 'a percentage' },
    },
  },
  // Combat: the caster's next flight is at double the chance, but against a crowned hero, a hero charmed this turn
  // already, or a hero whose will (each past charm's) throws it off.
  charm: { name: 'Charm', fn: 'psychic_charm', combat: {} },
} as const satisfies Record<string, ASpellAsItsTextsWriteIt>;

/** A spell the registry holds, by its slug. */
export type SpellSlug = keyof typeof SPELL_EFFECTS_THE_REGISTRY_HOLDS;

/** The chance a unit's strike before an army battle lands (plan P1-19's spells family, row P1-19v; until then written in
 *  primalStrikeChance, src/engine/chances-and-lair-grades.ts): a beast's (any unit's that doesn't fly), 30% and 10% for
 *  each level of its commander's Druid, with what his items add, to 90% at most; a flying unit's (the winged riders',
 *  ruling R-093), one in two whatever his Druid. The strikes themselves are each unit's, in the content's tables
 *  (PRIMAL_ARMY_DEFS_P's `spells`, BATTLE_ARMY_SPELLS), each with its name and damage, which the units' words test
 *  reads; each beast's blurb states these numbers. */
export const THE_CHANCE_OF_A_STRIKE_BEFORE_THE_BATTLE = {
  aBeastsStrike: { thePercentage: 30, perDruidLevel: 10, atMost: 90 },
  aFlyingUnitsStrike: { thePercentage: 50 },
} as const;
