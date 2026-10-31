# The rule registry and the one source for shared rules

## The rule registry

A **content effect** (a unit ability; since P1-19m a magic item's effect, [below](#the-items-registry); then spells,
discoveries, guardian perks and alignment orders, P1-19) is written once: **one row in `src/content/`** (its unit, its name as the books write it, its numbers each with how the
books write them, and the units it counts or reaches when more than its own) and **one entry in the registry**
(`src/engine/rules/the-registry-of-content-effects.ts`), keyed by the same slug (`'sheer-numbers'`). The entry names the
ability's **effect** at each **stage** it acts in; the effects are in `src/engine/rules/<family>/`, a file per group of
stages. A resolver (`unitAbilityMult`, for one) keeps its name and signature, and asks the stage's **runner**.

- **Hook points** are the engine's real decisions, thirteen of them: `strength`, `volley`, `fate`, `movementCost`,
  `orderValidity`, `experience`, `visibility`, `turnStart`, `turnEnd`, `orderOutcome` (an order's outcome a hero's
  item changes: P1-19o, the first of the items family's four new ones), `aHerosStanding` (a hero's own figures his
  item changes: P1-19p), `personalCombat` (a fighter in a personal combat: P1-19q) and `treasury` (what an item is for and
  worth: P1-19t) (the union `HookPointName`). Each is a set of named
  stages, in the order the engine runs them (`TheStagesOfEachHookPoint`). A stage's effect type says exactly what the
  stage hands the effect, read-only, and what it returns; an effect changes nothing, at the turn's end too (it returns
  what the turn must do, and the turn does it: plan P1-19's second slice, Choice 3). A stage or a hook point typed `never` has no signature yet: its family's first row writes it, and an entry
  on it fails to compile meanwhile.
- **Within a stage, the effects run in the order its list gives** (`THE_ORDER_OF_EACH_STAGE`), not by a number: a product
  of decimals, and the ladder's words, depend on the order ([traps.md](../traps.md#order-is-data)). The runner finds a unit's
  effects by its type, from a `Map` built once from content as the file loads (an ability whose row says it reaches
  other units is found under each of them: Hold the Gate under every garrison, Sergeants under the Levies). Where an
  effect needs what only the resolver's grid can say, the runner takes it from the resolver, never the effect: whether
  the enemy's line holds a unit, and the worth of each shot, worked out only for a shooter that picks its target.
- **The stages written so far:** `strength: the whole force`, the unit's factor from its force (in `armStr`,
  through `unitAbilityMult`): Sheer Numbers, Reaver Crews, Shoal Swarm, Relentless Hunt, Stone Deterrent, Tidal Might,
  Deepwater Grasp, Wyrmscale and Air Superiority, in that order. Facing, four stages that take the multiplier
  so far and return a new one and the ability that set it, or nothing (`src/engine/rules/unit-abilities/a-unit-meeting-another-or-shooting-over-the-line.ts`):
  in `abilityFront`, from the role matchup, **what a unit does to the unit it meets** (Halberds, Lance Charge, Frenzy,
  Wolves Panic Horses, Stoop on the Horses, Harriers, Woodland Skirmish, Bloodthirsty, Maul, Trample, Many Heads,
  Purity), then **what the unit it meets does to it** (Spear Hedge, Boulder Wall, Unbreakable, Stone Halls, Thorn
  Hedge); in `abilityBack`, from the role's multiplier, **what a shooter does to its target** (Bodkin Points, Volley at
  the Charge, Marksmen, Armour-Piercing, Bombard), then **what the target does to the shooter** (Arrow Fodder). The
  whole line, six stages in `battleFaceSide`
  (`src/engine/rules/unit-abilities/a-unit-beside-behind-and-under-the-enemys-line.ts`): **turns an anchored line**
  (Battering Horns: its words, or nothing) and **marked by the enemy line** (Terror From Above, Dive on the Bowmen, Storm
  Wings: the units of my line each marks, the factor and the words, applied last where each marked unit fights), both
  read before the lines are faced; then, for a front-line unit at a wrapped end, **held when hit from the side**
  (Unbreakable, Rooted, Hold the Gate: the first one's words, or the side hit), then **beside and behind it in the front
  line** (Shieldwall, Town Watch, Sergeants, Driven Before Them, on the multiplier so far); for a shooter, **a shooter
  picks its target** (Marksmen: its place in the enemy front's list, or nothing); for a unit in the air, **what a flyer
  does** (Flak Gunners, from ×1). The fates, two stages in `rollUnitFates`
  (`src/engine/rules/unit-abilities/a-units-fate-after-a-battle.ts`), each returning the fate (a slug) by which a unit is
  spared, or nothing: **a beaten unit fails its death roll** (Regenerating Hide: the stage hands the dice, and the effect draws
  its die only after a lost battle, where the code drew it before), then, for a beaten unit that fails its demotion roll
  with no Shield Fort holding it, **a beaten unit fails its demotion roll** (Knightly Example, which reaches the Levies
  and the Men-at-Arms). The volley, the nine stages of `volley`, in the volley's helpers of
  `battle/strength.ts` and in `applyMissileHit` (`src/engine/rules/unit-abilities/the-volley-before-the-battle.ts`):
  **who shoots**, though it is no ranged unit (Broadside at sea, Tree Watch in the woods: those of each ability, in the
  stage's order, after the ranged units), **who shoots first** (Bombardment, the sort kept stable), **the shooters see
  what hides** (Eyes of the Forest), **stops the volley** (Ambush, unless the shooters see what hides), **may be shot
  at** (Loosed From Cover hides from shooters who don't see what hides; Armoured Hulls and Shell Wall are immune, with
  the words of the line by which a shot glances off: `missileTargetPool` asks it, and `missileCapReached` and
  `applyMissileHit` ask it for the immunity alone, through `whyEveryShotGlancesOff`), **how many volleys** (Prepared
  Ground, else one), **a shot's damage** (Woodland Volley, Bombardment, Raiders' Volley: the product, from ×1), **what
  the target does to a shot** (Thick Hide, after a flyer's double), and **the softening limit** (Punch Through, else
  the usual 40% and 80%); and `strength`'s **a land unit at sea** (Sea Archers, in `armStr` before the unit's factors
  from its force: whether the sea's penalty is waived; its effect is in the whole force's file). The grid,
  three stages of `strength` that place a unit (`src/engine/rules/unit-abilities/a-units-place-in-the-battle-grid.ts`),
  each handed the unit and the ground: in `battleGrid`, **a rider takes the flank on rough ground** (Through the Trees
  and Through the Glades in the woods, Crag Charge in the mountains: `abilityFlanksRough` asks it), then, on open ground,
  **a flyer takes an open flank no rider fills** (Stoop on the Horses, a second stage in its entry); in `battleRegrid`,
  **its place in the line**, handed the line too (Brawling Archers in the front, Colossal Bulk in the second line where
  it doesn't shoot over a fighter: the multiplier and its words, else the line's own). Before the battle (P1-19i,
  `src/engine/rules/unit-abilities/a-flyer-harried-and-a-hull-sunk-before-the-battle.ts`), two stages that pick a
  unit of the enemy's, each handed the dice and drawing them where the battle code drew them (none when nothing is
  left to pick): `strength`'s **a flyer is harried before the battle** (Flak Screen, in `applyFlakScreen`, first of
  `strength`: handed the unit, the enemy's flyers not yet harried and the rule of a unit's base strength; the flyer's
  place and the strength it loses), and `fate`'s **a hull is sunk before the battle** (Breach and Swamp, first of
  `fate`, which both battles ask: handed the unit and the enemy's hulls afloat; the hull's place). The battle code
  marks the unit and writes the line. The rout (P1-19j, `src/engine/rules/unit-abilities/the-rout-after-a-battle.ts`),
  three stages of `fate`, each handed the battle it follows (between heroes, a hero against neutral guards, or the
  guards against a hero) where it matters, and each effect looking for its unit in the force: **the beaten force
  holds** (Shield Fort, and Deep Halls counting a Dwarf Garrison as Guard in a front line placed: `shieldFortHolds`
  asks it, handed the force and its front line's unit types, or none for an estimate); **the winner runs the beaten
  down** (Ride Them Down, Run Them Down, Relentless Hunt's pursuit, a second stage in its entry, and Feeding Frenzy, in
  the battle code's order: each a pursuit, the fraction it adds to each beaten unit's death roll, the factor on the
  winner's own (Run Them Down's half against neutral guards), how the ground lets it run, and which line the battle
  writes for it; handed the winning force, the ground and whether its commander carries the War-Horn of the Plains, asked
  only by an effect that needs it; `pursuitsOfTheBeaten`, `src/engine/units/movement.ts`, asks it for both battles,
  which add the fractions in order unless a Shield Fort holds, and `rideThemDownBonus` keeps Ride Them Down's share
  alone); and **a force holds the sea lanes** (the Corsair Fleet's Cut the Line between heroes, and Keep the Sea Lanes
  against neutral guards: both battles' retreat asks it; a retired unit's, in no book, so their two rows are in a file
  of their own, `src/content/the-abilities-of-a-unit-no-longer-raised.ts`, read into the rows: the player page's own
  files name no retired unit). The turn's end (P1-19k,
  `src/engine/rules/unit-abilities/a-province-raises-a-unit-at-the-turns-end.ts`), `turnEnd`'s first stage, **a
  province raises a unit** (Raiders' Muster): Early Winter asks it for each province a realm holds, after the wages,
  handed the province's race, the race of the realm that holds it and whether an orc realm won a battle there this turn
  (the mark both battles leave, which Early Winter reads and wipes); the effect returns the unit raised (its type,
  quality and race) or nothing, and Early Winter names it (a die, as before), adds it to the garrison and writes the
  line. Reaver Crews' landing mark, which the move order sets for a column its longships put ashore, asks the content
  row's unit (`reaver-crews`), with no stage of its own. Every stage of `strength`, `volley` and `fate`, and `turnEnd`'s
  one, has its signature (and the other families', below); `movementCost` and `turnStart` are `never`
  until their family's first row.
- **What checks it:** the compiler, both ways (the registry ends `satisfies Record<UnitAbilitySlug, UnitAbilityEntry>`: a
  content row with no entry fails, TS1360, an entry with no row too, TS2353:
  `tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts`); each effect in its
  stage's order once (`tests/unit/the-rule-registry-holds-each-effect-once-in-the-order-of-its-stage.test.ts`); each row's,
  and each ability a table holds, name and numbers in both books (`tests/static/each-unit-abilitys-name-and-numbers-are-in-both-books.test.ts`); no unit
  type named in a function the registry has taken (`tests/static/the-resolvers-the-registry-has-taken-name-no-unit-type.test.ts`),
  and, outside the registry, the ratchet's `unitNameChecksInEngine`, which only falls; the layer rule ([ARCHITECTURE.md](../ARCHITECTURE.md#the-layers-and-the-module-map)).
- **How to add an ability** of a stage already written: its row in
  `src/content/unit-abilities-their-names-numbers-and-words.ts`; its effect in the stage's file under
  `src/engine/rules/unit-abilities/`, reading its numbers from its row (another ability is asked by its slug, never by a
  unit's name); its entry in the registry and its place in the stage's order; its name and numbers in the unit's blurb
  (`UNIT_ABILITIES`, in the same content file since P1-19e: the player portal imports it, and the player page's entry
  lists the file so that the words tests read it as the page's) and its roster row (the words test reads them). The hook points' types live in the registry's file, which holds code:
  a file only `import type` reaches is in no bundle ([traps.md](../traps.md#an-effect-reads-only-what-its-hook-hands-it)).
- **The abilities a table holds** (P1-19's second slice, Choice 2): 17 abilities stay in the tables the battle code
  reads by the unit's type, and no resolver names them: the 15 pre-battle strikes (each beast's `spells` in
  `PRIMAL_ARMY_DEFS_P`, and the winged riders' Screech Dive and Acid Spit in `BATTLE_ARMY_SPELLS`, beside it in
  `src/content/kingdoms-call-data.ts` since P1-19l), Island Back (the Great Turtles' two berths, `KC_CARRIER_BERTHS`) and
  Forest Runners (the Stag Riders' forest and jungle cells of `TERRAIN_MODS`, in `battle/terrain-and-unit-strength.ts`).
  Their casting is the spells' registry's (P1-19v). The words test reads each table: a strike's name and damage range (`2–4`, with
  the books' en dash), Island Back's count with what it counts ("two land units"), Forest Runners' factors with their
  ground ("×1.1 in forest", "no penalty in jungle"; `TERRAIN_MODS` by its syntax tree). A bare "one" or "×1" would be
  in the books' words already ("where a fleet carries one", "×1.1"), so a table's number is matched with its words.
- **Where the books write an ability** (a trap until P1-19l): every unit ability is also in its unit's blurb
  (`UNIT_ABILITIES`, in the content file beside the rows), in the rulebook's roster row and in the battle report's lines;
  change a number in its row or its table and in both books. A unit appears in `UNIT_ABILITIES` once: an object literal
  keeps the last key, so a second entry fails `npm run typecheck` (TS1117), and the words tests check it too. The words
  tests find the blurbs as the player page's because its entry (`src/ui/player/page.ts`) lists the content file: keep
  that import, or `fileDeclaring(PLAYER, 'UNIT_ABILITIES')` finds no file. `tests/abilities-words.test.js` and
  `tests/primal-abilities-words.test.js` name no ability since P1-19l: they check each unit's blurb and roster row, and
  a few of the books' sentences. The race and beast tests (`tests/abilities-human.test.js` and its elven, dwarven,
  orcish and beasts siblings, `tests/abilities-beasts-turn.test.js`, `tests/abilities-turn.test.js`) check the numbers in
  play. The grid's flyer set is `KC_UNIT_CLASS.aerial` (the riders and the flying beasts); the archers' first-target set
  is `KC_UNIT_CLASS.flying` (the riders only).

### The items' registry

A **magic item's effect** (P1-19's items family, from P1-19m) is one row in
`src/content/magic-item-effects-their-names-numbers-and-words.ts` and one entry in
`src/engine/rules/the-registry-of-magic-item-effects.ts`, keyed by the same slug (`'cavalry-bonus'`); its effects are in
`src/engine/rules/magic-items/`, a file per group of stages. Its stages are the hook points' own (one union,
`TheStagesOfEachHookPoint`); its orders are its own list, `THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS`, and the registry ends
`satisfies Record<MagicItemEffectSlug, MagicItemEffectEntry>`, both ways, as the unit abilities' does.

- **A held item is a copy** ([traps.md](../traps.md#live-saves-keep-copies)): a row names the key a copy carries the
  effect by (its `effect.stat`, a field of the item's own such as `fleetStr`, or its base name, a second name counting as
  its base's, as `hasItemBase` reads it), and holds only the numbers the code wrote inline before (×1.25, +2) and the
  units the effect reaches. The registry reads each copy's own key, never content's copy of the item, so an old save's
  copy works as it did, and no row changes the save's shape. P1-20's item ids name a copy, not an effect: the registry
  never reads them.
- **A runner finds the effects a hero's items carry once a call** (`theEffectsAnItemCarries`, from maps built as the file
  loads), from the items the resolver hands it: his active items (`activeItems`, in `src/engine/items/`, stays the one
  gate). An effect reads only its stage's facts and its row; which items carry it, the runner reads.
- **The stages written so far** (P1-19m, `src/engine/rules/magic-items/the-commanders-items-in-a-battle.ts`):
  `strength`'s **the commander's items**, in `armStr` after the unit's own modifiers and before its factors from its
  force: handed the unit's type, its quality, whether it is skeletal and the realm's alignment, each effect returns a
  step (strength added, or a multiplier, and for the Kraken Figurehead's step up a tier the tier's multiplier it is
  divided by), and the runner applies them in the stage's order, each rounded as it goes (the ladder records their sum,
  one line): ten items, from the Battle Standard's +2 to the Black Sceptre, in the stage's order. And `strength`'s **a land unit at sea, led** (the Tide-Caller's Horn: whether the sea's penalty to a land
  unit the bearer leads is waived; `armStr` asks it beside Naval's eighth level).
- **The battles' stages** (P1-19n, `magic-items/the-commanders-items-at-the-walls-the-volley-and-the-rout.ts`):
  `strength`'s **the defenders' fortifications** (both battles, after the province's and the realm's own bonuses):
  handed the side whose commander carries the item and whether the defenders fight at their home, and the bonus so far,
  each effect returns the new bonus and its line, in the stage's order: the Banner of the Realm's ×1.25 for the defender
  at his home, then the Siege Master's Ring halving what is left above ×1 for the attacker (so the order is the result's).
  The runner asks each side's items only when an effect would act for that side (reading a commander's items tidies
  them, as `activeItems` does), and against neutral guards it is handed no defender's items. `volley`'s **the commander
  adds volleys** (the Quiver of the Hawk's second volley, then the Quiver of Many Arrows' extra shot, each with the line
  the volley's opening records); `fate`'s **the commander's riders run the beaten down on any ground** (the War-Horn of
  the Plains: the answer Ride Them Down is handed, asked only as before) and **the beaten force may retreat** (the
  Shield-Wall Rune refuses it, in the battle against neutral guards' retreat).
- **The turn's and the orders' stages** (P1-19o, `magic-items/a-heros-items-in-the-realms-tax-and-in-his-orders.ts`):
  `turnEnd`'s **a hero's items add to the realm's tax** (Early Winter, after the provinces' own tax): handed each held
  copy, an effect returns gold (the Ring of Wealth and its kin: the copy's own `effect.bonus`) or gold for each province
  the realm holds (the Merchant's Ledger: 1); the runner sums the gold hero by hero, item by item, and counts the most
  any one item gives for each province once, and `capItemTaxGold` caps the two as before. `orderOutcome`'s five, one per
  order: **a spy's sure success** (an older save's Crystal Orb, `oracle`), **a lair revealed when exploring** (the
  Philosopher's Lens: the order still draws which lair), **a rest's heal** (the Iron Heart Talisman: a tenth of his
  maximum, rounded, once however many he carries), **a move's exploration** (the Traveller's Cloak: the copy's own
  `exploreMove`, every item's added) and **an item's power used** (an older save's Philosopher's Stone, `massPromote`:
  the Use Item order and the bots' plan both ask it, and the order does the promoting).
- **A hero's standing's stages** (P1-19p, `magic-items/a-heros-items-in-his-standing.ts`): `aHerosStanding`'s **maximum
  HP** (`itemMaxHpBonus`: handed each held copy, the Amulet of Fortitude and its kin give the copy's own `effect.bonus`;
  the runner counts two copies of one name once; `applyItemMaxHp` asks whether an item granted or lost carries an effect
  at this stage), **the temper he fights with** (`effTemper`: the copy's own `effect.temper`, from the first of his
  items that gives one, over his own) and **a skill's aura in the province** (`skillBonusBreakdown`: the Crown of
  Command's +1 to every skill, and the name his sources of a skill show it by, both the row's; the first hero of his
  realm in his province whose items spread one). The player portal's copy of the breakdown reads the report's.
- **What a fighter wears** (P1-19q, `magic-items/what-a-fighter-wears-in-a-personal-combat.ts`): `personalCombat`'s
  **what a fighter wears: a ward** (`pcArmourMerge`: handed the ward, his armour's or a rider's, and the wards he wears
  so far; returns the fields it sets: the 21 ward kinds an item carries, each its own row keyed `{ ward }`, an amount
  added, a percentage the best, a flag set; the buckler's 1 and 5, and the open guard's 2 hits and 50% for a copy that
  carries none, are the rows'), **a rider** (`pcApplyFx`: the aura and drain the best, the burn, hit bonus and damage
  bonus added, each carried above 0, keyed `{ rider }`) and **Mithril** (`pcCharCombatant`'s flag). `pcArmourOf` asks
  whether an item is worn as armour. A guardian's perk of the same ward or rider reaches the same effect (`pcApplyFx` is
  the one applier); a guardian's perks' own three wards (`stunWard`, `dotWard`, `schoolWard`) stay in `pcArmourMerge`
  for the guardian family. The fighter's ward table, a ward and the riders (`TheWardsAFighterWears`,
  `AWardAsTheMergeReadsIt`, `TheRidersOfAnItemOrAPerk`) are this stage's types, in the registry's file, and
  `personal-combat/helpers.ts` exports them by the same names.
- **What a ward does** (P1-19r, `magic-items/what-a-ward-does-in-a-personal-combat.ts`): `personalCombat`'s **a blow's
  chance to hit** (dodge); **a hit lands on a fighter** in `pcTakeHit`'s order: **before all else** (first hit, blocks,
  round ward, Mithril), **his wards cut it** (flat and spell cuts, low HP, open guard), **his wards cap it**, **after
  it** (second wind); **a blow lands** (thorns); **a round starts**; **a stun or a terror takes hold**; **a spell's burn
  takes hold**. Each is handed his wards and its moment and returns what it does; the fight applies it, rolls where it
  rolled and tells the line. Low HP's half, the second wind's 30%, resist's half and Mithril's 2 are the rows'. The
  guardian's own wards are still read in the fight, listed.
- **The combat items, a steal and a blow** (P1-19s, `magic-items/the-combat-items-a-steal-and-a-blow-in-a-personal-combat.ts`):
  `personalCombat`'s **a fighter reaches for a combat item** (`pcCombatItemWanted`; its order is
  `pcTryCombatItem`'s), **a combat item is used** (`pcUseCombatItem`: 19 uses keyed `{ use }`, each
  returning what it does; the fight draws and applies it), **a combat item's blow lands** (bane's double, keyed
  `{ effectField: 'doubleVs' }`), **a guardian wields its hoard** (`pcBuildGuardian`: maximum HP, the gauntlets' flag),
  **a steal's chance** (the Lock-Pick's +20) and **a blow's damage** (the Warbringer Gauntlets' +2). A copy's own
  numbers act; the row's where it carries none.
- **The treasury** (P1-19t, `magic-items/an-items-role-and-worth-in-the-treasury.ts`), read at load (each item's tier)
  and by a bot choosing what to carry: `treasury`'s **an item's role** (`itemRole`; the skills' and riders' stay its)
  and **an item's worth** by kind (`itemPowerScore`; four kind rows keyed by a stat: armour, a combat item, riders
  alone, a spell charm), then **: a combat use**, **: a ward**, **: a rider**. The weights are each row's
  `theWorthOfItInTheTreasury`; a key no row holds stays `equipment.ts`'s. `itemSlot` reads content's keys.
- **What checks it:** the two registry tests above, each extended to the items' registry; each row's numbers in the
  desc and lore of every item in play that carries it (`tests/unit/each-magic-item-states-the-numbers-its-effect-has.test.ts`:
  unit, since the items in play exist only after the engine's load-time pass; the known gaps listed with their Parked
  entries); no item effect key or item named, no item field of its own and no ward's field read, in a function the
  registry has taken (`tests/static/the-resolvers-the-item-registry-has-taken-name-no-item-effect.test.ts`), and,
  outside the registry, the ratchet's `itemEffectChecksInEngine`, which only falls; the effects no matrix game meets, by
  a case each: the commander's items, the battles' (a whole turn each, in `tests/scenario/`), the orders' (their orders'
  cases), a hero's standing (the hit points' and skills' cases, and the portal's parity test on the Crown; the temper
  items by the matrix alone), what a fighter wears, what a ward does, and the combat items, a steal, a blow and a
  guardian's hoard (`tests/unit/the-combat-item-and-guardian-lines-no-matrix-game-reaches-keep-their-values.test.ts`);
  the treasury by its properties (`tests/unit/an-items-role-and-worth-follow-its-effect.test.ts`) and the matrix.
- **How to add an item effect** of a stage already written: its row (the key a copy carries it by, its numbers, the
  units it reaches); its effect in the stage's file under `src/engine/rules/magic-items/`, reading its numbers from its
  row; its entry and its place in the stage's order; and the numbers in the desc and lore of every item that carries it
  (the words test reads them). A new stage's signature goes into `TheStagesOfEachHookPoint`, with its runner in the
  items' registry.

**The spells' registry** (P1-19u): [its file](the-spells-registry-its-stages-and-how-to-add-a-spells-effect.md). **The
discoveries'** (P1-19aa): [its file](the-discoveries-registry-its-stages-and-how-to-add-a-discoverys-effect.md).

## `kingdoms-call-data.ts`: the one source for shared rules

`src/content/kingdoms-call-data.ts`, a module every table of which is exported and imported by name where it is read
(P1-09's Decision 4). It is bundled into each portal's script, not published as a file of its own.

- **Content tables** (`ALL_MAGIC_ITEMS_P`, `MONSTERS_P`, `PRIMAL_ARMY_DEFS_P`, `MASTERY_UNLOCKS`, …):
  plain literals. Nothing in the file may reference portal code. `PRIMAL_ARMY_DEFS_P` is the one place a
  Creature's or Monster's cost, strength, move, sub-race and pre-battle strike are written; the GM master
  tables and the player portal's speeds are built from it, and `tests/lib/primal-decided.js` (the wild roster
  Toby decided on 2026-10-13) holds it, the class lists, the Druid ladder and the books to the decided figures.
- **Shared rule tables** (the block headed `SHARED RULE TABLES`): every `KC_*` table, e.g.
  `KC_UNIT_CLASS` (unit classes as ordered lists), `KC_UNIT_TYPE` (each unit's one type word: infantry,
  ranged, cavalry, flyer or naval), `KC_DRUID_LEVELS`, `KC_UNIT_BASE_STR`, `KC_SKILLS`,
  `KC_SEASONS`, `KC_GRAND_DESIGNS`. Until 27 Sept each lived in two to eleven hand-typed copies,
  several of which had drifted. Now each portal builds its own local copy **from** these
  (`new Set(KC_UNIT_CLASS.creature)`, `KC_SEASONS.slice()`, `{...KC_SKILL_LABELS}`), so no consumer can
  mutate another's. The editing rules are at the top of that block: change a rule there; append, never
  re-sort; plain data only; `KC_` names only.
- **Shared rule functions**: a rule of a hero, an army, an item, a level or a number that both portals need
  is written once, in `src/engine/rules-on-plain-values/` (its files import only the data file and each other), and the
  player portal imports it by the engine's name through `src/shared/the-engines-rules-the-player-portal-shares.ts`,
  which re-exports only from that folder: e.g. `dispFloor`, `unitBaseStrength`, `itemSlot`, `heroHireWage`,
  the two casting limits, the beast command, the Druid rule and a column's sea lift. So the player page loads no other engine file and runs none of the
  engine's set-up as it loads. `tests/static/the-player-portal-reaches-the-engine-only-through-src-shared.test.ts`
  refuses a portal file that imports an engine or a views file, or declares one of the retired copies (`floorNumP`, …)
  or a name `src/shared/` hands it. The portal's copies still left (they read the report's shape: P1-11b) are the
  ones `tests/lib/player-portal-copies.ts` checks.
- **A few deliberate near-copies stay in the GM portal**, because the *order* is a tie-break priority
  (each is commented `NOT a copy`). Don't collapse them.

**No stamp, no guard** (since P1-06c). The data file is bundled into each page that uses it, so it can't be missing
or older than the page, and a table a page imports that the data file lacks stops the build. Its stamps and the two
portals' start-up guards are gone.

## An effect reads only what its hook hands it

An effect of the rule registry (`src/engine/rules/`, [above](#the-rule-registry)) reads its
stage's facts and its content row, and returns a value: a factor, a multiplier and its words, a line or nothing. It
imports nothing but `src/engine/rules/`, `src/engine/rules-on-plain-values/` and `src/content/` (`npm run lint:arch`
refuses the rest), so it can't draw a die (`kcRng`), read the turn's state or write a line: what it needs, its stage hands
it. A set it needs is built from content (`KC_UNIT_CLASS`, a row's `counts`) or handed by the stage (whether the enemy
fields ranged units, from the ladder's missile set), never imported from `battle/`. Another ability is asked about by
its slug, never by a unit's name. A magic item's effect is found by the key its row gives, from the items the resolver
hands the items' runner (`activeItems`, in `src/engine/items/`, stays the engine's one gate, P1-19m); the items'
stages are listed [above](#the-items-registry). An effect that reads a copy's own number is
handed the copy (its `effect.bonus` or `effect.temper`, its `exploreMove`), never the hero.

The stage types live in the registry's own file, which holds code. **A file that only `import type` reaches is in no
bundle**: the build's checks (`tests/static/pages-build.test.ts`, "none is left out", and the engine paths in
`tests/static/harness.test.ts`) refuse it. Only `src/globals.d.ts` and `src/schemas/` may hold types alone.
