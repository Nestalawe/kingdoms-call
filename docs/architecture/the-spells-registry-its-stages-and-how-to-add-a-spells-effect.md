# The spells' registry: its stages, and how to add a spell's effect

The rule registry is described in [the rule registry and the one source for shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md).
This file is its part for the spells (plan P1-19's spells family, from P1-19u).

## What a spell's effect is

A **spell's effect** is one row in `src/content/spell-effects-their-names-numbers-and-words.ts` and one entry in
`src/engine/rules/the-registry-of-spell-effects.ts`, keyed by the same slug (`'fireball'`). Its effects are in
`src/engine/rules/spells/`, a file per group of stages.

- **A row** names the spell as `SPELL_DEFS_P` keys it (`'Fireball'`) and its `fn` (`'elemental_fireball'`), and holds
  the numbers the code writes for it, by use (`battleMagic`), each with how the spell's texts write it (0.5 as "half";
  0.2 as `20%`; a quarter lost as `75%` kept). `SPELL_DEFS_P` stays as it is: the player portal reads it, and the
  player page doesn't import the rows.
- **The registry** ends `satisfies Record<SpellSlug, SpellEffectEntry>`, both ways, as the unit abilities' and the
  items' do: a row with no entry, or an entry with no row, fails to compile. Its stages are the hook points' own (one
  union, `TheStagesOfEachHookPoint`, in `the-registry-of-content-effects.ts`); its orders are its own list,
  `THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS`. One spell is cast at a time, so a stage's order is which spells it holds.
- **A runner finds a spell's entry by its name** (a `Map` from the rows, built as the file loads, of the entries in the
  stage's order). A save names a spell by its name (an order's `target`, a spell charm's `effect.spell`), never by its
  slug, so an old save works as it did, and no row changes the save's shape.

## The stages written so far

- **Battle magic** (P1-19u, `spells/battle-magic-cast-before-an-army-battle.ts`). `strength`'s **a battle spell is
  cast before the battle**, asked once the spell's roll is made by each of the battle code's three copies: a hero's
  between two heroes' hosts (`applyPreBattleMagic`), a hero's against a province's neutral guards, and the guards'
  commander's against him (both in `combatVsNPC`). It is handed:
  - the copy that casts it;
  - the caster's level;
  - the enemy's units, each with its type, race, whether it is risen dead, its base strength and whether it is a
    missile unit (by the copy's set);
  - the enemy commander's Tactical and the skill a Curse withers, or none;
  - whether at sea;
  - how many of the strongest units the caster's items let his Fireball strike.

  The effect returns what the spell does and the line its copy writes. The copy draws where it drew before (Lightning
  Bolt's units, Control Undead's unit), applies the rest and writes the line with the facts its kind records.
- **A battle spell has something to strike** (`battleSpellUseful`, which the choice of a battle spell asks): handed the
  enemy commander's figures and the enemy's units. A spell with no effect at this stage strikes any enemy unit.
- **The copies keep their own rules** (Parked "Battle magic's three copies disagree on two rules", plan `NEXT.md`
  question 27): a guards' commander's Lightning Bolt counts his level past 5, and Telekinetic Storm between heroes
  halves only a Tactical the enemy commander has, and not at sea. Each copy also writes its own lines.
- **The Ember Rune** is the items' registry's: `strength`'s **a hero's items change his battle spell**
  (`magic-items/a-heros-items-and-his-battle-spell.ts`, keyed `{ field: 'emberTwo' }`: his Fireball strikes the two
  strongest units). Its runner, `theStrongestUnitsAHerosItemsLetHisFireballStrike`, is asked by the two copies a hero
  casts.

## What checks it

- The two registry tests, each extended to the spells' registry (each row's name a spell, its `fn` that spell's).
- Each row's numbers in the "Battle magic:" part of its blurb and the "Battle:" part of its rulebook row, the known gaps
  listed with their Parked entries (`tests/static/each-spells-numbers-are-in-its-blurb-and-the-rulebooks-table.test.ts`).
- No spell's name or `fn` in a function the registry has taken
  (`tests/static/the-resolvers-the-spell-registry-has-taken-name-no-spell.test.ts`), and, outside the registry, the
  ratchet's `spellChecksInEngine`, which only falls.
- Each spell's values in each copy, and the battles' lines no matrix game reaches (a hero's Control Undead and Holy
  Symbol against undead guards, a Fireball with an Ember Rune in both battles)
  (`tests/unit/the-battle-spells-each-copy-casts-keep-their-values.test.ts`).

## How to add a spell's effect

For a stage already written:

1. Add or extend the spell's row: its name, its `fn` and its numbers, each with how its texts write it.
2. Write its effect in the stage's file under `src/engine/rules/spells/`, reading its numbers from its row.
3. Add its entry, and its place in the stage's order.
4. State its numbers in its blurb and its rulebook row (the words test reads them).

A new stage's signature goes into `TheStagesOfEachHookPoint`, with its runner in the spells' registry.
