# Freeing a file of its ts-nocheck line

What a file that keeps its ts-nocheck line checks (nothing), and how a file is freed so that every value stays the same. The trap in brief: [traps.md](../traps.md#ts-nocheck-checks-nothing-in-the-file).

## `@ts-nocheck` checks nothing in the file

89 files of `src/` still start with a `// @ts-nocheck` line, counted by the ratchet in two: `tsNocheckEngineSide`
(55: `src/engine/`, `src/views/`, `src/db/`, `src/ui/shared/`, and `src/content/`, `src/schemas/` and `src/shared/`,
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
- **A freed file meets the type-aware lint rules** in the same PR ([traps.md](../traps.md#a-fixed-lint-finding-must-leave-the-suppressions)):
  fix every finding there, and suppress none (P1-10b's Choice 1), so `eslintSuppressions` doesn't rise. Each fix keeps
  every value too: a `||` that a `0`, `''` or `false` reaches becomes an explicit check, not `??`; a guard that a
  caller still keeping its line may need stays, its parameter typed optional; a `no-unsafe-*` finding from a callee
  that keeps its line is met by typing the value where the freed file takes it. A finding that can't be fixed without
  freeing another file waits for that file.

## The forms that keep a value, by kind

Each form below keeps every value the old statement gave, for every value its type allows; a few keep it for every
value at all. P1-10b2 to P1-10b20 found them (each row's figures are in its PR). A form a row needs that isn't here is
added under its kind.

### `||` and `??`

- **`a || b` where `a` can't be falsy but missing** (a list, an object, a function) is `a ?? b`. Where it can be (a
  number, words, a flag), **`(a ?? F) || b`**, `F` its type's falsy value (`0`, `''`, `false`), gives the same value
  for every value: `a || ''` is `a ?? ''`, but `a || 0` is not `a ?? 0`, which keeps a `NaN` that `|| 0` turned into 0.
- **`x || 0` on a number that is worked out** (a skill level, a strength taken off) is `Number(x) || 0`; `x ?? 0` only
  where `x` can't be `NaN` (a number from the data file, a count only `+ 1` writes). `x || 5` on a number a held copy
  may hold as 0 (a combat item's amount) is `(x ?? 0) || 5`, never `x ?? 5`.
- **Words a table or a player may leave empty** (a relation, a race, a hero's name, a lore) keep their `''` case:
  `(a ?? '') || 'fallback'`, or a `const` read with `?? ''` and then `|| 'fallback'`. `?? 'fallback'` alone only where
  the table holds no `''` (say so in a comment). `String(x || '')` on words typed `string | null | undefined` is
  `x ?? ''`.
- **`(a && (a.b || a.c)) || 'x'`**, where `''` may reach, is read into a `const` first: `const bc = a ? a.b || a.c : '';`,
  then `bc || 'x'`. `x != null ? x : y` is `x ?? y`; `(h && h.race) || null` is `(h?.race ?? '') || null`.
- **`a && a.b`** is `a?.b`, and `!(fm && fm.arr === n)` is `!(fm?.arr === n)` when `n` is never `undefined`;
  `!t || t.location !== n` is `t?.location !== n`, which narrows `t` after it.
- **`a.find(…) || b` on words** is `(a.find(…) ?? '') || b`; **`(table || {})[n]` keyed by a number** (a realm's index)
  is `table?.[n]`: no field of an empty object has a number's name.
- **`if (!x) x = v` on words** (a unit's phantom tag) is `if (x === undefined || x === '') x = v`: lint's `x ??= v`
  would keep a `''`.

### Numbers, words and conversions

- **A number in a line's words or a key** is `${String(x)}` (the same text); `a + '-' + b` on numbers is
  `` `${String(a)}-${String(b)}` ``.
- **`parseInt(x)`** on a number or a regular expression's group is `parseInt(String(x))`: `parseInt` reads its argument
  as words. `s.match(re)` with no `g` flag is `re.exec(s)`, the same result.
- **A pair read element by element** (`a[0] + a[1]`, a damage range the dice read) is `Number(a[0]) + Number(a[1])`, or
  a small reader that hands back `[Number(a[0]), Number(a[1])]` and, for no pair, throws the `TypeError` the old read
  threw. `x > 0` already reads `x` as a number, so `Number(x) > 0` is the same.
- **`x > 0` on an optional number read again after the test** is `x !== undefined && x > 0`, which narrows `x`; read
  once, `const { aura = 0 } = fx` and `aura > 0`. `Math.min(x, y)` and `x <= y - 1` read a missing `x` as `NaN`:
  `Math.min(Number(x), y)`, `Number(x) <= Number(y) - 1`.
- **A `String()` a test shows is needed** (an order's target, an item's id held as a number) stays, through a reader
  typed as wide (`aTargetInWords`), though the type says words. One the saved schema makes needless (a guardian's
  power's words) goes. `!!x` on a flag is `x`.
- **`/^merc_/.test(s)` on words** is `s.startsWith('merc_')`. A company's name `armyUnitName` draws is read through
  `theNameDrawn`, which throws for none (its type allows none; it always draws or composes one).
- **A number a typed callee may give as `undefined`** (`effSkillOf` for no hero) is read `Number(x)` where it is counted
  or compared, and kept as it is where it is handed back.

### Lists, tables, sets and maps

- **A list's or a table's element read where the code has just made it sure** (`cav[i]` after `i >= 0`, one of three
  candidates sorted) is read into a `const` and checked; where the old code would have thrown there, the check throws
  the same kind of error. A die's pick from a list just found not empty goes through a reader that throws for none
  (`theOneThePickFell`), and `list.splice(i, 1)[0]` at an index just drawn through one that takes it out
  (`theOneTakenOut`). `G.players[c.player].name` after a check doesn't narrow: only a plain variable as the key does.
- **A table read by any string** is typed inside the function that reads it, `Readonly<Partial<Record<string, T>>>`,
  not by a second module-level `const` (`tests/unit/engine-purity.test.ts` watches the engine's module-level names). A
  key that may be `undefined` is read as JavaScript reads it, `table[String(key)]`; an element by an index that may be
  missing (`SEASONS[s[0]]`), through `(p) => (p === undefined ? undefined : SEASONS[p])`.
- **A literal table keyed by a closed set** gains `satisfies Record<…>` (`TERRAIN_MODS` by unit type: a misspelt unit
  fails `tsc`; `PC_SPELL_SCHOOL_MAP` by school, so its values keep their literal types and index a fighter's schools).
  A table of pairs takes a tuple (`readonly [utility: number, combat: number]`). A test that reads such a table by its
  syntax tree (`entriesOf`, `tests/lib/source.ts`) must look through the `satisfies`.
- **An interface read by any name** (a fighter's schools) is copied into a local `Readonly<Partial<Record<string,
  number>>>` by a spread: an interface has no index signature, a spread's object type has one.
- **A list the code tests for a gap or a missing field** is read through a local typed with its element as wide as the
  test (`it?.effect?.use === use`); a list looked up with a value that may be missing (`includes`, `has`) through a
  local `readonly (string | undefined)[]` or `ReadonlySet<string | undefined>`. `x == null || !list.includes(x)` in a
  filter that returns on a miss; a swap that may meet `undefined` checks `k in list`.
- **`(table[a] || {})[b]`** is read in two steps, `const cell = table[a] ?? {};` then `cell[b] ?? …`: lint's
  `table[a]?.[b]` reads `undefined` where the old read a field of the empty object (a `b` such as `constructor`).
- **A list read by a key in words** (a province by a key of a realm's grave lore) is read as JavaScript reads `list[k]`
  for any key, `Reflect.get(list, k)` into an `unknown`, and its field so too, `Reflect.get(Object(v), 'name')`
  (`theProvinceALoreKeyNames`).
- **`list.find((q) => q && TIERS.includes(q))` over values of mixed forms** (a quality, or a list of them) reads the
  tiers through a local `readonly unknown[]` and keeps a kind: `(q): q is string => Boolean(q && tiers.includes(q))`.
  `Object.entries(skills).filter(([, v]) => v > 0)` takes a typed predicate, `Number(v) > 0` (`aLevelAboveNothing`).
- **Records of a union compared field by field** (where a Wild Calling tore beasts from: a garrison's province, a
  hero's name) are compared through a shape with every field optional (`theSamePlaceAsNamed`).
- **A filter that keeps a kind** needs a generic predicate, `<L>(l: L | null): l is L => Boolean(l)`;
  `filter(Boolean)` a type predicate. A callback whose result is read only as true or false is typed `: boolean`, so
  the compiler doesn't infer a predicate over a large union.
- **`Array.isArray` on a `readonly` list type** narrows it to `any[]`: a parameter tested so takes a list that isn't
  `readonly`.
- **A list the saved state holds empty but a turn fills** (`G.turnOrders`) is read through a local typed as the turn
  holds it; a list read both guarded and unguarded keeps the schema's type, and the guarded reads go through a reader
  typed as wide as the guard (`provincesOrNone`).
- **A load-time pass that marks a content table** reads it through one wide shape, the same array; a derived table is
  filled through a local typed the same way. A spread of an element of a big content table goes through a small
  generic function typed as the item it copies (`underAnotherName`).
- **`for (k in obj)` over a literal's keys** is a `for … of` over a typed list of them, in the same order. A `Map` a
  caller makes is typed by the methods the function calls.

### Guards and the compiler's narrowing

- **A guard on a value the code has made sure** (`if (!x) return;` after a read through `?.`) is added where the
  compiler can't see it; it changes no value. A guard lint calls needless is dropped only where the code would already
  have thrown without it.
- **A value guarded in one place and read unguarded in another** (a fight's narrative, a foe, a fighter's hero) keeps
  its type, and the guarded reads go through `asItsGuardReadsIt(value)` (`to-hit-wounds-stuns-and-courage.ts`). A guard
  on a field the schema requires stays where an untyped caller may still leave it out.
- **A `const` typed as a wide list is narrowed by its value** (`const l: readonly Army[] | null | undefined =
  hero.armies` is `Army[]`): type the object instead (`const h: AHeroAsEarlyWinterReadsHisArmies = hero`, his `armies`
  optional), or a callback's parameter; an object's optional field isn't narrowed away.
- **A state the code tests, then hands to a call that changes it** (a fight's state: an action sets who fled, a spell
  conjures a Mirror Image) is read again through a reader typed as the state is kept (`theFightAsItIsNow`), so a test
  after the call isn't read as always false.
- **A `let` set inside a `forEach` callback** is still its first value to the compiler: a `for … of` over the same list,
  `continue` for the callback's `return`; or, where it is handed back, the function's return type written.
- **A table's element made sure by a key that is a field** (`if (!G.turnOrders[h.id]) …; G.turnOrders[h.id][p]`)
  is read by a plain `const` key (`const hiredsId = h.id`), and `if (!x) x = []` on it is `x ??= []`, which narrows.
- **A branch the check above makes dead** (`h.player === null ? wage : h.pay || 1` after a check that every hired
  hero is a wanderer) is dropped: lint refuses the always-true test, and the value is the same.
- **A value a closure reads later** (`pcDeferEffect`'s rider) is read into a `const` before it, so the test before it
  narrows it inside too. A table read by the same key several times is read once into a `const`.
- **A `try` whose `catch` gave a value where a missing element threw** checks for none first inside the `try`, with
  the same value (`if (!g) return 0;`, `takeBestGrave`).
- **A rule's switch that holds one value today** (`ARCHERY_PARTING_SHOT = true`) is typed by an alias of `boolean`, so
  its test still reads it.

### Parameters, shapes and claims

- **A parameter is typed from what its callers pass and as wide as the body's guards**, by what the function reads,
  not the schema's whole type: an interface beside it ("the state as these read it"), each field a guard tests
  optional, a plain `number` where the schema has a brand. A function that reads only the state takes
  `Pick<TurnContext, 'G'>`; one that reads part of the state through the context, `const { G }: { readonly G:
  TheStateAsEarlyWinterReadsIt } = turnContext`. A typed callee's parameter type its file doesn't export is
  `Parameters<typeof callee>[0]`.
- **The turn's marks an order writes that the schema lacks** (a Curse's levels taken, a Clairvoyance's watchers, Part
  Sea's waters) are typed on a local shape beside it, built on the battle's (`AHeroAsTheCastMarksHim` from
  `HeroInABattle`), and the state is read through `Omit<GameState, …> & { … }` with its heroes and provinces so marked,
  a guarded list optional and the turn's lists added (`TheStateAsTheCastReadsIt`).
- **A shape whose fields are all optional** is refused for a value that has none of them (TypeScript's weak-type
  check): type it `object & { … }`. A fighter's `ref` is a hero or a guardian: a hero's fields are read through a
  reader typed `object & { … }` with only the fields read, so the guardian passes.
- **A field the code tests with `typeof x !== 'object'` and `Array.isArray` before writing it whole** (a realm's
  grave lore) is typed as wide as those tests: its record, a list (not `readonly`), words, a number, a flag or none
  (`TheGraveLoreAsItsGuardsReadIt`), so each test narrows it to the record.
- **A hero, his realm and his province as processOrder hands them** (`Character`, `Realm | undefined`, `Province |
  undefined`): where the order indexes by his realm, it starts with `servesARealm`'s check, as the Cast Spell order does;
  his realm and his province are made sure by `theRealmIsHanded` and `theProvinceIsHanded` (assertion functions, which
  throw for none), before their first read. Not through a check in the dispatch's call when a test pins the call's
  form (`[^)]*` in the order family's own tests).
- **A parameter whose kind a flag says** is a rest tuple (`...[army, typeOnly]: [string, true] | [AUnit, false?]`); a
  callback option only one case calls is required only there (`{ won: true } | { won: false; demoteAt }`).
- **A function that reads an old save** takes the old save's shape, every field it reads optional. A function that
  hands back what it was given (`activeItems`) is generic in its type; one that adds fields to its argument returns
  `Object.assign(g, { units, total })`, the same object.
- **A type goes in the file whose code it types most** (a file of types alone is in no page's bundle, which
  `tests/static/pages-build.test.ts` refuses): the fighter, `AFighterInAPersonalCombat`, is in `helpers.ts`; the Mirror
  Image, in the combat spells' file. A copy whose id is a string (a Hunting Rumours hero) is `AHeroAsAFightTakesHim`.
- **A claim the compiler can't check is made only through a check that holds it**: a copy made through JSON parses into
  `unknown` and a type predicate holds when `JSON.stringify(copy) === JSON.stringify(original)` (Theo, 2026-10-30); a
  hero handed to a callee that needs his name as words passes a predicate `typeof hero.name === 'string'`; a caster
  passes `servesARealm` (only a hero of a realm acts in a phase), so each `c.player` after it is a realm's index. Each check
  never fails on a sound save, and throws if it does. A typed callee that takes a value its caller may lack (a hero's
  province) gets it through a check that throws for none, named for the invariant that makes it sure.
- **A return type written on a callee that keeps its line** is a claim, checked once that file is freed; write in a
  comment where it doesn't hold. It changes what its other untyped callers give: type their result too, fix the typed
  readers' new findings and prune their cleared suppressions. Freed, a claim that holds only for some values takes
  only those, and reads the value through a check that holds it: `effStat` takes a hero, never none, and reads his
  total through `aHerosSkillAsItIsCounted`, which throws only where `skillBonusBreakdown` counts none (no hero).

### The types the code corrects

- **A type that disagrees with the code is corrected, not the code**: a fact's field the engine may leave `undefined`
  (the druid's line's channel, a guardian's perk's words) is `string | undefined` in the facts file, and its words read
  it `${String(x)}`; a shared type its readers show too narrow is widened (a fighter's kind may be a Mirror Image's
  phantom), and one they show too wide is narrowed (a guardian's weakness has its name and words). `armyUnitName`
  takes any unit's type, as a save holds it (a type with no pool of names draws the Guard's). A hero's id that a
  function only compares is typed as every caller holds it (`effSkillOf`'s: a fight's copy of a Hunting Rumours hero
  holds it as words). A saved field the code writes `|| null` to is nullable in the schema (a spied hero's alignment
  and race).
- **A value parsed from JSON** is typed `unknown`, each field read through `fieldAsJavaScriptReadsIt(value, key)`, which
  does what `value[key]` does.
- **A ternary or a list of many kinds of line** can be "too complex to represent" (TS2590) as `NarrativeLine`: type it
  by the kinds it holds, `Extract<TheFactOfAPersonalCombatsLine, { kind: … }>`, and build a list of them with other
  lines in two steps (a literal of them, then `push`).
- **`{ ...(x || {}) }`** is `{ ...x }`: a spread of a missing or falsy value adds nothing.
