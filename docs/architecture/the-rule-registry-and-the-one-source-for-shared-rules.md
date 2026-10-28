# The rule registry and the one source for shared rules

## The rule registry

A **content effect** (today, a unit ability; then items, discoveries, spells, guardian perks and alignment orders, P1-19)
is written once: **one row in `src/content/`** (its unit, its name as the books write it, its numbers each with how the
books write them, and the units it counts or reaches when more than its own) and **one entry in the registry**
(`src/engine/rules/the-registry-of-content-effects.ts`), keyed by the same slug (`'sheer-numbers'`). The entry names the
ability's **effect** at each **stage** it acts in; the effects are in `src/engine/rules/<family>/`, a file per group of
stages. A resolver (`unitAbilityMult`, for one) keeps its name and signature, and asks the stage's **runner**.

- **Hook points** are the engine's real decisions, nine of them: `strength`, `volley`, `fate`, `movementCost`,
  `orderValidity`, `experience`, `visibility`, `turnStart`, `turnEnd` (the union `HookPointName`). Each is a set of named
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
- **The stages written so far:** `strength: the whole force` (P1-19a), the unit's factor from its force (in `armStr`,
  through `unitAbilityMult`): Sheer Numbers, Reaver Crews, Shoal Swarm, Relentless Hunt, Stone Deterrent, Tidal Might,
  Deepwater Grasp, Wyrmscale and Air Superiority, in that order. Facing (P1-19b), four stages that take the multiplier
  so far and return a new one and the ability that set it, or nothing (`src/engine/rules/unit-abilities/a-unit-meeting-another-or-shooting-over-the-line.ts`):
  in `abilityFront`, from the role matchup, **what a unit does to the unit it meets** (Halberds, Lance Charge, Frenzy,
  Wolves Panic Horses, Stoop on the Horses, Harriers, Woodland Skirmish, Bloodthirsty, Maul, Trample, Many Heads,
  Purity), then **what the unit it meets does to it** (Spear Hedge, Boulder Wall, Unbreakable, Stone Halls, Thorn
  Hedge); in `abilityBack`, from the role's multiplier, **what a shooter does to its target** (Bodkin Points, Volley at
  the Charge, Marksmen, Armour-Piercing, Bombard), then **what the target does to the shooter** (Arrow Fodder). The
  whole line (P1-19c), six stages in `battleFaceSide`
  (`src/engine/rules/unit-abilities/a-unit-beside-behind-and-under-the-enemys-line.ts`): **turns an anchored line**
  (Battering Horns: its words, or nothing) and **marked by the enemy line** (Terror From Above, Dive on the Bowmen, Storm
  Wings: the units of my line each marks, the factor and the words, applied last where each marked unit fights), both
  read before the lines are faced; then, for a front-line unit at a wrapped end, **held when hit from the side**
  (Unbreakable, Rooted, Hold the Gate: the first one's words, or the side hit), then **beside and behind it in the front
  line** (Shieldwall, Town Watch, Sergeants, Driven Before Them, on the multiplier so far); for a shooter, **a shooter
  picks its target** (Marksmen: its place in the enemy front's list, or nothing); for a unit in the air, **what a flyer
  does** (Flak Gunners, from ×1). The fates (P1-19d), two stages in `rollUnitFates`
  (`src/engine/rules/unit-abilities/a-units-fate-after-a-battle.ts`), each returning the line by which a unit is spared,
  or nothing: **a beaten unit fails its death roll** (Regenerating Hide: the stage hands the dice, and the effect draws
  its die only after a lost battle, where the code drew it before), then, for a beaten unit that fails its demotion roll
  with no Shield Fort holding it, **a beaten unit fails its demotion roll** (Knightly Example, which reaches the Levies
  and the Men-at-Arms). The volley (P1-19g), the nine stages of `volley`, in the volley's helpers of
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
  from its force: whether the sea's penalty is waived; its effect is in the whole force's file). The grid (P1-19h),
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
  one, now has its signature; the other five hook points are `never` until their family's first row.
- **What checks it:** the compiler, both ways (the registry ends `satisfies Record<UnitAbilitySlug, UnitAbilityEntry>`: a
  content row with no entry fails, TS1360, an entry with no row too, TS2353:
  `tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts`); each effect in its
  stage's order once (`tests/unit/the-rule-registry-holds-each-effect-once-in-the-order-of-its-stage.test.ts`); each row's,
  and each ability a table holds, name and numbers in both books (`tests/static/each-unit-abilitys-name-and-numbers-are-in-both-books.test.ts`); no unit
  type named in a function the registry has taken (`tests/static/the-resolvers-the-registry-has-taken-name-no-unit-type.test.ts`),
  and, outside the registry, the ratchet's `unitNameChecksInEngine`, which only falls; the layer rule above.
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
  A strike's casting is battle magic's code (in `combatVsChar`, and twice in `combatVsNPC`), which the spells family
  takes with the heroes' battle spells. The words test reads each table: a strike's name and damage range (`2–4`, with
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

## `kingdoms-call-data.ts`: the one source for shared rules

`src/content/kingdoms-call-data.ts`, a module every table of which is exported and imported by name where it is read
(P1-09's Decision 4). Since P1-09d it is bundled into each portal's script, not published as a file of its own.

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
- **Shared rule functions** (P1-11a): a rule of a hero, an army, an item, a level or a number that both portals need
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
