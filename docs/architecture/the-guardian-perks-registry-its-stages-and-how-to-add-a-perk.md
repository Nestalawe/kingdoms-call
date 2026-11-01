# The guardian perks' registry: its stages, and how to add a perk

The rule registry is described in [the rule registry and the one source for shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md).
This file is its part for the guardian perks (plan P1-19's guardian perks, from P1-19ai).

## What a guardian's perk is

A **guardian** is a row of `MONSTERS_P` (`src/content/kingdoms-call-data.ts`). He has one **perk** per grade (Weak 1,
Moderate 2, Powerful 3, Legendary 4) in `passives`, each `{ name, desc, fx }`. The `fx` is a **ward** (`{ ward:
'meleeDR', amt: 2 }`; a ward against one school also names its `school`) or a **rider** (`{ aura: 8 }`). There are 17
kinds: 12 wards and 5 riders.

A running game's guardian holds **his own copy** of his perks, and the fight reads that copy's numbers, as it reads a
held item's. `guardianPassives` finds them (an older save's single `passive` too). `migrateLairGuardiansV2` re-reads a
running game's guardians from `MONSTERS_P` when `GUARDIAN_TABLE_VER` rises.

A **kind of perk** is one row in `src/content/guardian-perks-their-kinds-numbers-and-words.ts` and one entry in
`src/engine/rules/the-registry-of-guardian-perks.ts`, keyed by the same slug (`'a-tough-hide'` for `meleeDR`). Its
effects are in `src/engine/rules/guardian-perks/`.

- **A row** names the kind as `MONSTERS_P` writes it (`carriedAs`: its ward or its rider). It holds its value at each
  grade (the decided table of 2026-10-14), the form of its words (`{N}` its number), and its row in the rulebook's
  table "Guardian perks by grade". A kind the items share names **the items' effect it reaches**.
- **Fourteen kinds are the items' too** (9 wards and the 5 riders). A guardian's perk of one of them is put on him by
  the same applier as a hero's item (`pcApplyFx`), and does in a fight what the item's effect does. So its effect lives
  once, in the items' registry, and its row names it there. Its entry here holds only a guardian's own stages.
- **Three kinds are a guardian's alone:** the stun ward, the lingering-harm ward and the ward against one school. Their
  effects are this registry's own (P1-19aj, below): what each sets in the wards he wears, and what each does in a fight.
- **The numbers the code writes**, beside each perk's own, are in `THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS`:
  the cap on a single hit each grade gives (Legendary 20%: `GUARDIAN_BODY_CAP_PCT` reads it), the sustain's fade (a
  guardian's regeneration and drain at full strength for 4 rounds, at half to the 8th, then spent:
  `PC_SUSTAIN_FULL_ROUNDS` and `PC_SUSTAIN_HALF_ROUNDS` read it), and a full ward (100, which the rulebook writes "all").
- **The registry** ends `satisfies Record<GuardianPerkSlug, GuardianPerkEntry>`, both ways, as the other registries do.
  Its stages are the hook points' own (`TheStagesOfEachHookPoint`); its orders are
  `THE_ORDER_OF_EACH_STAGE_OF_THE_GUARDIAN_PERKS`. A perk's stage is named "a guardian's perks: …".
- **No effect draws a die.** An effect returns its chance or its amount, and the resolver draws where it drew before.

## The stages written so far

**A guardian's nature and build** (P1-19ai, `guardian-perks/a-guardians-perks-on-his-card-and-in-his-build.ts`):

- `personalCombat`'s **a guardian's perks: what his card turns** (`monsterTraits`): handed one perk, it returns the
  approach the perk turns (blows, arrows or spells), or nothing. A tough hide turns blows, arrow-proof arrows, spell
  resistance spells. A perk counts by its `ward`, or by a field of the ward's own name (the older form the rule has
  always read). The runner gathers them over his perks, and `monsterTraits` keeps each hidden multiplier of his nature
  for an approach turned at 1 or below. So a guardian never resists and is weak to the same thing (Toby, 2026-10-08).
  The hidden multipliers themselves, and their clamps, stay in `monsterTraits`: no book states them.
- `personalCombat`'s **a guardian's perks: his grade's cap beside his own** (`pcMonsterCombatant`, once his perks are on
  him): handed his grade's cap (`GUARDIAN_BODY_CAP_PCT`; 0 for none) and the wards his perks gave him. It returns the
  cap ward to merge (the merge keeps the looser of two caps), and his own cap to set back where it is tighter (Elder
  Titan, Kraken: 15%), or nothing for a grade with no cap.

**A guardian's own wards** (P1-19aj, `guardian-perks/a-guardians-own-wards-what-he-wears-and-what-they-turn.ts`). Each
effect gives the ward its line names (`theWardTheLineNames`), as the items' wards do, so the lines' perk finders are
handed no kind of perk:

- `personalCombat`'s **a guardian's perks: what he wears: a ward of his own** (`pcArmourMerge`, asked once the items'
  registry finds no effect of the ward's kind): handed the ward and the wards so far, it returns what the ward sets.
  The stun and lingering-harm wards keep the best of his perks'; a ward against one school keeps the best for its
  school, and a ward that names no school sets nothing (its name is still worn). The runner asks the kind carried as
  that ward.
- **a guardian's perks: a stun takes hold** (`pcStunWard`, beside his items' refusal, and `pcStunTurned`'s line): his
  chance, 0 to a full ward's 100, to turn a stun as it lands.
- **a guardian's perks: a round starts** (`pcRoundStart`, when he wears wards): handed the chance his wards turn a stun
  (`pcStunWard`) and whether his items slough off every lingering harm. Wards that turn every stun clear a stun he is
  under; a whole lingering-harm ward, or his items, slough off every lingering harm.
- **a guardian's perks: a lingering harm bites** (`pcRoundStart`, each tick, any fighter): the share of each tick his
  ward turns, up to 100 (none worn: 0).
- **a guardian's perks: a combat spell's chance: a ward against its school** (`pcCastCombatSpell`, once the chance is
  capped): the points his ward against the spell's school takes off, never below 5, and none against the school he is
  weak to.

The stages with one effect (the stun, the tick, the cast) have runners that ask the first kind of the stage's order,
typed from the registry itself: an order naming a kind with no effect at the stage fails to compile.

## What a rider does in a fight

The five riders are the items' (P1-19ak, in the items' registry, on the rider rows of P1-19q, in
`src/engine/rules/magic-items/what-a-rider-does-in-a-personal-combat.ts`). A guardian's perk of a rider reaches the
same effect, as a hero's item does. Each stage holds one effect, and its runner asks it as the stages above do:

- **the fight opens: a fighter's aura hinders his foe** (`resolvePersonalCombat`): the aura's penalty his foe carries
  once his aura is added to any the foe already carries, or nothing (no aura worn).
- **a blow's or an arrow's chance to hit: the aura's penalty** and **…: his bonus** (`pcHitChance`,
  `pcArrowHitChance`): what the aura laid on the striker takes off his chance, and what his bonus to hit adds (his
  riders' and a combat item's).
- **a blow's damage: his bonus** (`pcMeleeDamage`, after his items'): a guardian's special multiplies the whole blow by
  its weight, this bonus with it (as the rulebook reads: Toby's question 34).
- **a melee round: his burn** (`resolvePersonalCombat`, at melee range only, both standing): the harm, and the rider
  the line names.
- **a blow lands: his drain** (`pcMeleeStrike`): his share of the wound he dealt, at the sustain's fade (asked only as
  he drinks), up to his maximum (20 for a fighter of none), and the rider the line names.
- **a combat item adds to his bonus to hit** (`pcUseCombatItem`'s focus: the Elixir of Focus and kin): his bonus so
  far, with the item's added.

## How it is checked

- `tests/unit/the-rule-registry-holds-each-effect-once-in-the-order-of-its-stage.test.ts`: each effect once in its
  stage's order; each row's kind a kind of `MONSTERS_P`'s perks, no two rows of one kind, and every kind with its row;
  a row names the items' effect of its own ward or rider exactly when an item carries it; and an entry with no stage
  names the items' effect (the list of kinds still read inline is empty since P1-19aj).
- `tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts`: a row with no
  entry, and an entry with no row, fail to compile.
- `tests/static/the-resolvers-the-guardian-registry-has-taken-name-no-perk.test.ts`, with the ratchet's
  `guardianPerkChecksInEngine` (42 before P1-19ai, 37 after it, 19 after P1-19aj, 0 after P1-19ak): the functions taken
  name no kind of perk, and no check of a perk is left in the engine outside the registries.
- `tests/static/each-guardian-perks-number-is-in-its-words-and-the-rulebooks-table.test.ts`: every perk's `desc` is its
  kind's form with its number, and each kind's value at each grade is in the rulebook's table; the grade's cap, the
  sustain's fade and a second wind's share are in the rulebook. Question 34's form (a damage perk on a special) is
  listed with it.
- `tests/unit/guardian-perks.test.ts`: every perk carries its grade's value from the rows' table.
- `tests/unit/the-guardian-perks-no-matrix-game-meets-keep-their-values.test.ts`: the lines no matrix game reaches, or
  reaches in part (the card's spell resistance, the older form, a missing perk; the grade's cap; a ward against one
  school's floor and its weakness rule), and what a rider does that no test saw before: the burn's range, the drain's
  fade, the damage bonus on a blow and a special, the aura and the bonus to hit on an arrow.

## How to add a perk

1. **Of a kind the registry holds:** write the perk in the guardian's `passives`, with its grade's value from the kind's
   row and its `desc` in the row's form (the words test reads it). Raise `GUARDIAN_TABLE_VER` so running games re-read
   their guardians. Nothing else changes.
2. **Of a new kind:** add its row (how `MONSTERS_P` writes it, its four values, its words, its row in the rulebook's
   table, and the items' effect it reaches if an item carries it too) and its entry. If its effect is a guardian's
   alone, write it in a stage's file under `src/engine/rules/guardian-perks/`, with its place in the stage's order; a
   new stage's signature goes into `TheStagesOfEachHookPoint`, with its runner in the perks' registry. Add its row to
   the rulebook's table.
