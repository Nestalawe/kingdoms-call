# The spells' registry: its stages, and how to add a spell's effect

The rule registry is described in [the rule registry and the one source for shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md).
This file is its part for the spells (plan P1-19's spells family, from P1-19u).

## What a spell's effect is

A **spell's effect** is one row in `src/content/spell-effects-their-names-numbers-and-words.ts` and one entry in
`src/engine/rules/the-registry-of-spell-effects.ts`, keyed by the same slug (`'fireball'`). Its effects are in
`src/engine/rules/spells/`, a file per group of stages.

- **A row** names the spell as `SPELL_DEFS_P` keys it (`'Fireball'`) and its `fn` (`'elemental_fireball'`), and holds
  the numbers the code writes for it, by use (`battleMagic`, `combat`), each with how the spell's texts write it (0.5
  as "half"; 0.2 as `20%`; a quarter lost as `75%` kept; 3 rounds as "three rounds"; a range as `1–3`). `SPELL_DEFS_P` stays as it is: the player portal reads it, and the
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
- **The combat spells that harm** (P1-19w, `spells/a-combat-spell-that-harms-in-a-personal-combat.ts`).
  `personalCombat`'s **a combat spell takes hold**, asked by `pcCastCombatSpell` once a fighter's cast roll holds and
  the weakness's lines are written: Lightning Bolt, Fireball, Holy Symbol, Spiritwrack, Psychic Blast, Telekinetic
  Storm and Hand of Death. It is handed the caster's level counted to 5, the weakness factor (×2 against a guardian
  weak to the school, which doubles what doesn't harm), whether the target is weak to the school, the caster's maximum
  HP as Holy Symbol reads it, the target's figures (his maximum HP, whether he is undead or a fiend, his grade if he is
  a guardian, the share his wards cut a burn by), and what the caster's items change, asked only by the spell that
  reads it, when it reads it. It returns the spell's steps, in order: a hit (a number, or dice of 1–3 a level), with
  the HP the caster takes back as it lands and its line; a burn; a stun; a silence; a cut to the target's aim; the
  caster's heal; or a chance, whose steps are worked out once it holds. `applyTheStepsOfACombatSpell` applies each with
  the function the spell's case called (`pcTakeHit`, `pcPushDot`, `pcLandStun`), rolls a chance as the case rolled it
  (`kcRng() * 100` under it), and writes each line with its fields in the order the case wrote them.
- **The other combat spells** (P1-19x, `spells/a-combat-spell-that-hinders-deceives-or-sways-in-a-personal-combat.ts`),
  at the same stage: Mirror Image, Invisibility, Curse, Control Undead and Charm. Since P1-19x every combat spell is an
  effect there, and `pcCastCombatSpell` names no spell. The stage also hands the target's HP now, whether he is undead,
  his Melee, Archery and schools, his plan, what a Charm reads of him (a crowned hero, swayed this turn, his will), and
  the fight's Mirror Image (no fight, one fighting, or none). The steps it adds: a cut to the foes' aim at the caster; a
  flight bonus; the caster's flight doubled; a skill halved; an image conjured (the resolver builds the phantom from
  the HP, plan and rounds given); the images vanish; a will that may throw the spell off (the resolver rolls `d100()`
  against it, as the Charm's case did); and a line alone. A stun now names what stuns, the blast or the caster's grip.
- **A fighter's spell adds to his steal** (`personalCombat`, P1-19x): Invisibility's 15% to a thief's steal in the
  fight he cast it in. Its runner, `theChanceAThiefsSpellsAddToHisSteal`, is asked by `pcAct`'s theft with the spells
  he has cast.
- **A mirror image is disbelieved** (`personalCombat`, P1-19x): the chance a Mirror Image's victim sees through it,
  each round it fights. It is handed the victim's skill levels if he is a hero, his Melee, and what the caster's items
  change. Its runner, `theChanceAMirrorImageIsSeenThrough`, is asked by `resolvePersonalCombat`, which rolls it as
  before.
- **The Dreamstone and the Death's Finger Ring** are the items' registry's: `personalCombat`'s **a hero's items change
  his combat spell** (`magic-items/a-heros-items-and-his-combat-spells.ts`, keyed by the item's base name: his Psychic
  Blast stuns a round longer, after any doubling; his Hand of Death bites ×1.1). Its runner,
  `whatAHerosItemsChangeInHisCombatSpells`, is handed the caster's active items. Since P1-19x the **Mirror Shard** is
  there too: the chance his Mirror Image is seen through is halved.
- **The Cast Spell order's checks** (P1-19y, `spells/the-checks-the-cast-spell-order-makes-of-a-spell.ts`), the five
  stages of `orderValidity`, each true where the spell's row sets its flag (`asAnOrder`), in the order
  `resolveCastSpellOrder` asks them:
  - **a charmed hero will not turn it on his lord** (before the casting limit, unrolled, no slot spent);
  - **a spell that costs no casting slot** (handed whether the caster's realm has a Grand Cathedral: Bless Province);
  - **a spell's mark must stand in the province** (before the cast roll: a mark gone is refused, no slot spent);
  - **a cloaked mark is shielded from it** (once the cast lands: Psychic Blast and Curse; the Cloak's own check,
    `isHiddenChar`, waits for P1-23);
  - **a Bless ward may turn it aside** (asked by `blessWardNegates`, before the ward's roll: Part Sea, Earthquake, Flood
    and Plague, whose code still calls it where it did).

  Each runner takes the spell's name, as the order holds it. A row may hold `asAnOrder` alone (Bless Province, Part
  Sea, …): what an action spell does stays in the order's code until the family's second slice.
- **The spell charm and the Wailing Phylactery** are the items' registry's (P1-19y): `orderOutcome`'s **an item's power
  used** gains a spell charm's (`'it casts the spell it holds'`, by `{ stat: 'castSpell' }`), which `processOrder` asks
  to make its Use Item a cast; and **a spell's cast cannot fail** (`{ stat: 'necroAuto' }`: the first Necromancy spell
  its bearer casts each turn), handed the spell's school and whether his sure cast is spent. Its runner,
  `theCastersItemsMakeHisCastSure`, reads his items only once an effect would make the cast sure.

## What checks it

- The two registry tests, each extended to the spells' registry (each row's name a spell, its `fn` that spell's, and
  each of the order's checks holding exactly the spells whose row sets its flag).
- Each row's numbers in the "Battle magic:" part of its blurb and the "Battle:" part of its rulebook row, and its
  combat's in the "Combat:" parts, the known gaps listed with where and why
  (`tests/static/each-spells-numbers-are-in-its-blurb-and-the-rulebooks-table.test.ts`); the two items' numbers in their
  texts (`tests/unit/each-magic-item-states-the-numbers-its-effect-has.test.ts`).
- No spell's name or `fn` in a function the registry has taken
  (`tests/static/the-resolvers-the-spell-registry-has-taken-name-no-spell.test.ts`), and, outside the registry, the
  ratchet's `spellChecksInEngine`, which only falls.
- Each spell's values in each copy, and the battles' lines no matrix game reaches (a hero's Control Undead and Holy
  Symbol against undead guards, a Fireball with an Ember Rune in both battles)
  (`tests/unit/the-battle-spells-each-copy-casts-keep-their-values.test.ts`).
- Each unit's strike in each copy, and the totems on `primalStrikeChance`
  (`tests/unit/the-strikes-each-copy-makes-before-the-battle-keep-their-values.test.ts`); a slain hero's totem against
  guards, which no game reaches (`tests/unit/the-battle-magic-lines-no-matrix-game-reaches-keep-their-values.test.ts`).
- Each combat spell that harms, called directly with the dice pinned: `bolt-damage`, `fireball-burn`,
  `holy-symbol-unclean`, `spiritwrack-five` and `blast-dreamstone`; Telekinetic Storm's recoil and the Death's Finger
  Ring, which no game meets but in a forecast; the other combat spells' lines no game reaches (Control Undead,
  Invisibility and its steal, Curse, Charm, Mirror Image with no fight or cast again, the phantom, a hero's and a
  guardian's chance to see through it)
  (`tests/unit/the-combat-spell-lines-no-matrix-game-reaches-keep-their-values.test.ts`).
- The order's checks and the two items, by the Cast Spell order's cases (`tests/lib/cast-spell-order-cases.ts`, played
  whole-turn and called directly): the charmed hero, the mark gone, the cloaked mark, the Grand Cathedral's Bless, each
  spell a Bless ward turns, the Phylactery and a spell charm's cast.

## How to add a spell's effect

For a stage already written:

1. Add or extend the spell's row: its name, its `fn` and its numbers, each with how its texts write it.
2. Write its effect in the stage's file under `src/engine/rules/spells/`, reading its numbers from its row.
3. Add its entry, and its place in the stage's order.
4. State its numbers in its blurb and its rulebook row (the words test reads them).

A new stage's signature goes into `TheStagesOfEachHookPoint`, with its runner in the spells' registry.
