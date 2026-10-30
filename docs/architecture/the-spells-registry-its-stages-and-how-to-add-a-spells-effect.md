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
- **The pre-battle strikes** (P1-19v, `spells/a-units-strike-before-an-army-battle.ts`). `strength`'s **a unit strikes
  before the battle**, asked after battle magic by the battle code's three copies: a hero's units' between two heroes'
  hosts (`combatVsChar`'s `applyArmyBattleSpells`), a hero's units' against a province's neutral guards, and the
  guards' own units' against him (both in `combatVsNPC`). The strikes are each unit's, in the content's tables (a
  winged rider's in `BATTLE_ARMY_SPELLS`, else a beast's `spells` that deal damage, in `PRIMAL_ARMY_DEFS_P`), not a
  spell's, so no entry holds them: one effect casts them all, and its runner, `whatAUnitsStrikeMayDoBeforeTheBattle`,
  is the registry's. It is handed the copy, the unit's type, whether the other side has a unit, the commander's Druid
  as the copy counts it, and what his items add to the chance (asked only when the chance counts them). It returns
  the strikes to draw from (each with whom it strikes, its damage range and its line), the chance, and the lines its
  copy writes when it strikes and when it misses (a winged rider misses quietly). The copy draws the strike, rolls its
  chance as it rolled it (`d100()` against the guards, `kcRng() * 100` in the other two), draws the unit struck and the
  damage, and writes its lines. The chance's numbers are the content's (`THE_CHANCE_OF_A_STRIKE_BEFORE_THE_BATTLE`: a
  beast's 30% and 10% a Druid level, to 90%; a flying unit's one in two, ruling R-093); `primalStrikeChance` asks the
  same rule (`theChanceOfAUnitsStrikeBeforeTheBattle`).
- **The totems** are the items' registry's: `strength`'s **a commander's items add to a strike's chance**
  (`magic-items/a-commanders-items-and-his-units-strikes.ts`: the Totem of the Thunderhead's `{ stat: 'primalStrike' }`
  and the Beastcaller's Warhorn's `{ field: 'primalStrike' }`, each the copy's own number). Its runner,
  `whatTheCommandersItemsAddToAStrikesChance`, is asked through `primalStrikeItemBonus`.

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
- Each unit's strike in each copy, and the totems on `primalStrikeChance`
  (`tests/unit/the-strikes-each-copy-makes-before-the-battle-keep-their-values.test.ts`); a slain hero's totem against
  guards, which no game reaches (`tests/unit/the-battle-magic-lines-no-matrix-game-reaches-keep-their-values.test.ts`).

## How to add a spell's effect

For a stage already written:

1. Add or extend the spell's row: its name, its `fn` and its numbers, each with how its texts write it.
2. Write its effect in the stage's file under `src/engine/rules/spells/`, reading its numbers from its row.
3. Add its entry, and its place in the stage's order.
4. State its numbers in its blurb and its rulebook row (the words test reads them).

A new stage's signature goes into `TheStagesOfEachHookPoint`, with its runner in the spells' registry.
