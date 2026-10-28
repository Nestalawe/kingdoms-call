# Freeing a file of its ts-nocheck line

What a file that keeps its ts-nocheck line checks (nothing), and how a file is freed so that every value stays the same. The trap in brief: [traps.md](../traps.md#ts-nocheck-checks-nothing-in-the-file).

109 files of `src/` still start with a `// @ts-nocheck` line, counted by the ratchet in two: `tsNocheckEngineSide`
(75: `src/engine/`, `src/views/`, `src/db/`, `src/ui/shared/`, and `src/content/`, `src/schemas/` and `src/shared/`,
which have none), which P1-10b frees, and `tsNocheckUi` (34: the UI's pages in `src/ui/`, `src/rulebook/`, and any
other file, `tests/` and `tools/` too), which P1-16 frees. Each only falls, so freeing a file on one side can't make
room for a new line on the other. TypeScript reports no error anywhere in such a file. A type,
an annotation or a `satisfies` written there is a claim nobody checks: a wrong parameter type compiles, and so does a
table with a key left out.

- **A type is checked where a file without the line reads it.** `TurnContext` and `NarrativeLine`
  (`engine/turn/context.ts`) live in a file that keeps the line; each freed file that reads them checks them. If a
  freed file's code disagrees with one, correct the type, not the code (P1-10a3 did so for a log line's `targets`).
- **A file with the line still gives its callers types.** Its parameters are `any`, but a value it builds keeps the
  type TypeScript works out: `[]` is `never[]`, and `PC_RANGES[i]` is `string | undefined`. A freed caller meets them.
  Only a `?` on a parameter its callers leave out, or a return type written from what the function does
  (`activeItems(c): Item[]`, `effStat(…): number`), is added to such a file for a freed caller, and nothing else
  there changes. A return type there is a claim too, checked once that file is freed: write in a comment beside it
  where it doesn't hold (`effStat` gives `undefined` for a missing hero, which no typed caller passes).
- **To free a file:** delete the line, type its parameters and its empty arrays and maps, and run
  `npm run typecheck`. Type a parameter from what its callers pass and as wide as the body's own guards (a body that
  writes `(force || []).filter((a) => a && …)` takes `readonly (Army | null | undefined)[] | null | undefined`), so
  each guard stays needed. An error that only a changed statement clears is cleared by one that **keeps every
  value** (P1-10b's Decision 2), never by a `!` or an `as` (lint refuses both in `src/`): a list's or a table's
  element read into a `const` before its check (`G.players[c.player].name` after a check doesn't narrow: only a plain
  variable as the key does); a guard (`if (!x) return;`) where the code has just made `x` sure; `?? <the value it
  had>` where the left side can't be `undefined`; a type predicate for `.filter(Boolean)`; `catch (e)` read through
  `e instanceof Error ? e.message : String(e)`; a typed `const` for a literal table read by any string (P1-10b1 did
  the last three kinds for the assertions `src/engine/rules-on-plain-values/` held). A change that could change a
  value the game can meet isn't a type fix: it is its own PR. The proof is both balance sets and every realm's report
  identical **and** `npm test` green, since the matrix doesn't reach every line (no matrix game holds a unit's legacy
  name, for one): a changed statement the matrix doesn't reach gets a unit case, red on a planted fault.
- **Don't write the line's text in a comment:** the ratchet and `tests/static/harness.test.ts` count it anywhere in
  a file of `src/`. Say "its ts-nocheck line" instead.
- **A freed file meets the type-aware lint rules** in the same PR ([below](../traps.md#a-fixed-lint-finding-must-leave-the-suppressions)):
  fix every finding there, and suppress none (P1-10b's Choice 1), so `eslintSuppressions` doesn't rise. Each fix keeps
  every value too: a `||` that a `0`, `''` or `false` reaches becomes an explicit check, not `??`; a guard that a
  caller still keeping its line may need stays, its parameter typed optional; a `no-unsafe-*` finding from a callee
  that keeps its line is met by typing the value where the freed file takes it. A finding that can't be fixed without
  freeing another file waits for that file.
- **What it took, file by file** (P1-10b2: `army-tables.ts`, `units/movement.ts`, `battle/strength.ts`, 34,104
  bytes): the line off, strict TypeScript reported 103 errors; about 40 annotations and 9 statements cleared them, then
  the type-aware lint found 55 findings there, all fixed (mostly `?? []` for `|| []` on a list, and `a?.type === x`
  for `a && a.type === x`). Three forms keep a value where `??` wouldn't:
  - **`x || 0` on a number that is worked out** (a skill level, a strength taken off) becomes `Number(x) || 0`, not
    `x ?? 0`: the two differ when `x` is `NaN`, which `|| 0` turns into 0. `?? 0` is right where `x` can't be `NaN`
    (a number from the data file, a field compared at once in a way `NaN` and 0 both fail).
  - **`(a && (a.unitName || a.type)) || 'unit'`**, where `''` may reach, is read into a `const` first:
    `const nameOrType = a ? a.unitName || a.type : '';`, then `nameOrType || 'unit'`.
  - **A function that reads an old save** (`migrateLegacyUnitNames`) takes the old save's shape, declared beside it
    with every field it reads optional, so each of its guards stays needed; today's `GameState` passes.
  A guard lint calls needless is dropped only where the code would already have thrown without it (in
  `abilityMissileUnits`, `a && a.type` after a filter that reads `a.type` of every unit).
- (P1-10b3: `battle/fates.ts`, 14,606 bytes): 56 errors, 30 of them a parameter with no type; then 13 typed lint
  findings, all fixed. Three more forms:
  - **A value parsed from JSON** (`battleTallyLine` reads each force's row back from its line's words) is typed
    `unknown`, and each field is read through `fieldAsJavaScriptReadsIt(value, key)`, which does what `value[key]` does
    (undefined where there is none, a `TypeError` for `null`), so a row the engine never writes still gives the tally it
    gave. Checking each field's type instead would be shorter, but it changes what such a row gives.
    `tests/unit/the-battle-fate-and-tally-lines-no-matrix-game-reaches-keep-their-values.test.ts` holds those rows.
  - **A `let` set inside a `forEach` callback and read after it** (`let best = null`) is still `null` to the compiler,
    so a property read after it fails (TS2339 on `never`). A `for … of` loop over the same list, with `continue` for the
    callback's `return`, keeps the order and lets the compiler see the assignment.
  - **A callback option a winner never calls** (`demoteAt`) is required only where it is called: `rollUnitFates`'
    options are a union on `won`, `{ won: true }` or `{ won: false; demoteAt }`, so no caller passes a dummy and no
    `?.` hides a missing one.
- (P1-10b4: `battle/lines.ts`, 42,398 bytes): 195 errors, 162 of them a parameter with no type; then 4 typed lint
  findings, all fixed. Freeing it also cleared the 5 findings `battle/ladder.ts` held for its calls into it (a value
  from a file that keeps the line is `any`), so `eslintSuppressions` fell. Four more forms:
  - **A function that adds fields to the object it is handed** (`battleRegrid` adds `units` and `total` to a grid)
    returns `Object.assign(g, { units, total })`: the same object, the same fields in the same order, and its type is
    the grid with them (`BattleGrid`), so no reader needs a check for them.
  - **A list's element read where the code has just made it sure** (`cav[i]` after `i >= 0`, `them.flanks[i]` with
    `i` below both sides' count) is read into a `const` and checked; where the function must return a value and the
    old code would have thrown there (`gA.face.total` right after `battleFacing`), the check throws.
  - **`Array.isArray` on a `readonly` list type** narrows it to `any[]`, which the typed lint refuses: a parameter the
    body tests with `Array.isArray` takes a list that isn't `readonly` (`shieldFortHolds`' `grid.front`).
  - **A list a filter keeps the right kind of** (`filter(isALine)` on a list whose members the compiler has narrowed)
    needs a generic predicate, `<L>(l: L | null): l is L => Boolean(l)`, not one written for the wider type.
- (P1-10b5: six files, 56,447 bytes: `battle/fortune.ts`, `grand-design.ts`, `names.ts`, `titles/perks.ts`,
  `world/map-helpers.ts`, `heroes/charms-and-neutrals.ts`): 172 errors, 141 of them a parameter with no type; then the
  typed lint's findings, all fixed. Freeing them cleared 54 findings their typed readers held on values from their calls
  into the untyped files, and the readers met 7 new ones, each a guard on a neighbour `getNeighborsP` returns (it keeps
  only provinces), dropped with 2 suppressed findings on the same guards: `eslintSuppressions` fell, 790 to 734. Four more forms:
  - **A parameter is typed by what the function reads, not by the schema's whole type:** an interface beside it, "the
    state as these read it", with each field a guard tests optional and a plain `number` where the schema has a brand
    (`id`, `location`), so a `GameState` passes and so does a test's plain object, with no cast in either.
  - **A table read by any string is typed inside the function that reads it**, not by a second module-level `const`:
    `tests/unit/engine-purity.test.ts` watches the engine's module-level names, and an alias of `SKILL_LABELS` there
    reads as a second table the turn wrote.
  - **A `||` on a name that a player may choose** (a hero's, a realm's) keeps its `''` case: `const name = ch?.name ??
    '';` then `name || 'The wanderer'`. A key that may be `undefined` is read as JavaScript reads it,
    `table[String(key)]` (the key `"undefined"`), not guarded away.
  - **An element read where the list may hold `undefined`** (`shuffleP`'s swap) is checked by its place (`k in list`),
    not by `!== undefined`, so a list holding `undefined` shuffles exactly as before.
- (P1-10b6: `battle/terrain-and-unit-strength.ts`, 38,872 bytes): 73 errors, 60 of them a parameter with no type;
  then 55 typed lint findings, all fixed. `effStat`'s return type, written in its file (which keeps the line), cleared
  the one finding `battle/battle-report-lines-and-force-markers.ts` held on its result: `eslintSuppressions` fell, 734
  to 733. Three more forms:
  - **A guard on a field the schema requires stays where an untyped caller may still leave it out**, by reading the
    value into a `const` typed as wide as the guard (`const heroItems: readonly unknown[] | null | undefined =
    heroChar?.items`), or by typing a callback's parameter that way (an item's `effect`), so the parameter keeps the
    schema's type and its other callers needn't change.
  - **`x != null ? x : y`** becomes `x ?? y`, the same value; `(h && h.race) || null`, where `''` may reach, becomes
    `(h?.race ?? '') || null`.
  - **A literal table keyed by unit type** gains `satisfies Record<string, Partial<Record<UnitType, number>>>`
    (`TERRAIN_MODS`), so a misspelt or retired unit's name fails `tsc` (TS2353). A test that reads such a table by its
    syntax tree (`entriesOf`, `tests/lib/source.ts`) must look through the `satisfies`.
- (P1-10b7: Early Winter's stage, `turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts`,
  28,831 bytes): 55 errors, 47 of them a parameter with no type; typing the context as `TurnContext` and the turn's
  marks it reads left 14; then 87 typed lint findings, 70 once the return types of the three `discoveries.ts`
  functions it calls were written there (`realmBaseTax` and `discUpkeepWage`: `number`; `discEff`: the content's
  discovery effects), all fixed. Its guards test lists the schema requires (`G.characters || []`, a hero's `armies`, a
  garrison) and some of them it also reads unguarded. Four more forms:
  - **A `const` typed as a wide list is narrowed by its value:** `const list: readonly Army[] | null | undefined =
    hero.armies` is `Army[]` to the compiler, so lint still calls `list ?? []` needless (P1-10b6's `heroItems` worked
    because its value came through `?.`). Type the object instead, `const theHeroAsGuarded:
    AHeroAsEarlyWinterReadsHisArmies = hero` (his `armies` optional), or a callback's parameter: an object's optional
    field isn't narrowed away.
  - **The state as one function reads it, through the context:** `const { G }: { readonly G:
    TheStateAsEarlyWinterReadsIt } = turnContext`, so `G`'s guarded lists are typed as wide as the guards and the
    context keeps `TurnContext` for the typed functions it is handed to.
  - **A list the body reads both guarded and unguarded** (the world's provinces: `|| []` in six places, by a
    province's id in three) keeps the schema's type for the unguarded reads, and the guarded ones read it through a
    small reader typed as wide as the guard (`provincesOrNone`), at the same moment.
  - **A number in a line's words** is written `${String(x)}` (the same text), and `x || 1.6` on a number that may be
    missing is `Number(x) || 1.6`.
- (P1-10b8: `discoveries.ts`, 22,225 bytes): 123 errors, 113 of them a parameter with no type (one more than the
  scoping's 122: the return type P1-10b7 wrote on `discEff` reads `e.led`, which the content's own effect type only has
  on some rows). The first pass wrote the forms lint asks for as it went (`a?.b` for `a && a.b`, `??` for `||` where
  no `0`, `''` or `NaN` reaches, `Number(x) || 0` where one may); the typed lint then found 3 more, all fixed. The three return types P1-10b7 wrote there are now checked, and
  `discEff`'s is the file's one effect type, `TheEffectOfADiscovery` (every field a row's `effect` or `effect2` may
  set, each optional; the compiler checks every row against it where `DISC_BY_ID` is filled), which every hook hands
  its readers. No typed reader held a suppression on its results, so `eslintSuppressions` stays 733. Five more forms:
  - **A parameter whose kind a flag says** (`discUnitIs(cls, army, typeOnly)`: a type's name with `typeOnly` true,
    else a unit) is a rest tuple, `...[army, typeOnly]: [army: string, typeOnly: true] | [army: AUnit | null |
    undefined, typeOnly?: false]`: the body's `typeOnly ? army : army?.type` then narrows, the arguments are the same
    values, and a caller that passes them on spreads the tuple (`discUnitIs(e.cls, ...unitOrItsTypesName)`).
  - **A function that reads only the state** takes `Pick<TurnContext, 'G'>`, not the whole context, so a typed test's
    staged `{ G }` needs no more than the state's type.
  - **A Map a caller makes and the function reads and writes** is typed by the two methods it calls (`get` and
    `set`), so a caller's `Map<unknown, number>` passes; a `Map<unknown, unknown>` doesn't, and its caller types the
    values it holds.
  - **A typed callee's parameter type that its file doesn't export** is taken as `Parameters<typeof callee>[0]`
    (`homeFounderOf`'s state, `pcFoeCat`'s foe), so no typed file changes to export it.
  - **`list.includes(x)` where `x` may be missing** (a ground the battle may not give) is `x == null ||
    !list.includes(x)` in a filter that returns on a miss: `includes` of `undefined` is false, as before. A `?? 1` for
    `|| 1` on a content number was checked against the content: no row sets it to 0.
- (P1-10b9: five leaves, 40,621 bytes: `heroes/fame-and-consecration.ts`, `items/tiers-and-hoards.ts`,
  `turn/intrusion-warnings.ts`, `realms/relations-and-captures.ts`, `battle/blood-harvest-and-iron-throne.ts`): 123
  errors, 109 of them a parameter with no type; then 109 typed lint findings (41, 20, 8, 27 and 13, in that order),
  all fixed. No typed reader held a suppression on their results, and none met a new finding, so
  `eslintSuppressions` stays 733. Six more forms:
  - **`a || 'fallback'` on a string a table or a player may leave empty** (a relation, a doctrine, a race, an army
    type, an item's lore) is `(a ?? '') || 'fallback'`, or a `const` read with `?? ''` and then `|| 'fallback'`, so
    `''` still gives the fallback; `?? 'fallback'` alone is written only where the table has no `''` (a monster's
    label, a lair's tier: said in a comment).
  - **`String(x || '')` on a name typed `string | null | undefined`** is `(x ?? '')`: the same string, and lint calls
    `String` of a string needless. A number in a key or a line's words is `${String(x)}`, and
    `a + '-' + b` on two numbers is `` `${String(a)}-${String(b)}` ``.
  - **A spread of an element of a big content table** (`{ ...it, effect: { ...it.effect }, name }` over
    `ALL_MAGIC_ITEMS_P`) pairs each item with any item's effect in the compiler's eyes: the copy goes through a small
    generic function typed as the item it copies (`underAnotherName`), the same spread inside it.
  - **A guard on a value the line before has just made sure** (`if (!_pl) return;` after the realm's alignment was
    read through `?.`) is added where the compiler can't see it, as P1-10b2's; it changes no value.
  - **`armyUnitName` takes a `UnitType`**, so a function that names a unit from its `type` types that field `UnitType`
    in its own shape (a column's units, the fallen, a province's army types), though the schema's is any string. A
    freed caller that hands it an `Army` meets the difference (P1-10b9's "for the next row").
  - **A phase's name or a force read by an index that may be missing** (`SEASONS[s[0]]` when the list may be empty) is
    read through a small reader, `(p) => (p === undefined ? undefined : SEASONS[p])`, as JavaScript reads it, and the
    words take `${String(…)}`: `undefined` still reads `undefined`.
