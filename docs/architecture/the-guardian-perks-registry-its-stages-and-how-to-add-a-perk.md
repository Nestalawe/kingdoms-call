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
  effects are still read inline (`pcArmourMerge`, `pcStunWard`, `pcRoundStart`, `pcCastCombatSpell`); their entries
  hold no stage yet.
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

## How it is checked

- `tests/unit/the-rule-registry-holds-each-effect-once-in-the-order-of-its-stage.test.ts`: each effect once in its
  stage's order; each row's kind a kind of `MONSTERS_P`'s perks, no two rows of one kind, and every kind with its row;
  a row names the items' effect of its own ward or rider exactly when an item carries it; and an entry with no stage
  names the items' effect, or is listed as still read inline.
- `tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts`: a row with no
  entry, and an entry with no row, fail to compile.
- `tests/static/the-resolvers-the-guardian-registry-has-taken-name-no-perk.test.ts`, with the ratchet's
  `guardianPerkChecksInEngine` (42 before P1-19ai, 37 after it): the functions taken name no kind of perk, and the
  engine's checks of a perk outside the registry only fall.
- `tests/static/each-guardian-perks-number-is-in-its-words-and-the-rulebooks-table.test.ts`: every perk's `desc` is its
  kind's form with its number, and each kind's value at each grade is in the rulebook's table; the grade's cap, the
  sustain's fade and a second wind's share are in the rulebook. Question 34's form (a damage perk on a special) is
  listed with it.
- `tests/unit/guardian-perks.test.ts`: every perk carries its grade's value from the rows' table.
- `tests/unit/the-guardian-perks-no-matrix-game-meets-keep-their-values.test.ts`: the lines no matrix game reaches, or
  reaches in part (the card's spell resistance, the older form, a missing perk; the grade's cap). Each later row adds
  its own.

## How to add a perk

1. **Of a kind the registry holds:** write the perk in the guardian's `passives`, with its grade's value from the kind's
   row and its `desc` in the row's form (the words test reads it). Raise `GUARDIAN_TABLE_VER` so running games re-read
   their guardians. Nothing else changes.
2. **Of a new kind:** add its row (how `MONSTERS_P` writes it, its four values, its words, its row in the rulebook's
   table, and the items' effect it reaches if an item carries it too) and its entry. If its effect is a guardian's
   alone, write it in a stage's file under `src/engine/rules/guardian-perks/`, with its place in the stage's order; a
   new stage's signature goes into `TheStagesOfEachHookPoint`, with its runner in the perks' registry. Add its row to
   the rulebook's table.
