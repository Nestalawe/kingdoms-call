# The forms that keep a value: numbers, words and lists

How a file is freed, and what its ts-nocheck line checks: [freeing a file](freeing-a-file-of-its-ts-nocheck-line.md).
Each form below keeps every value the old statement gave; a form a row needs that isn't here is added under its kind.

## `||` and `??`

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
- **`(x != null && list.find(…)) || y`**, the found element else a fallback, is `(x != null ? list.find(…) : undefined)
  ?? y`: `??` on the `false` the left can give would keep it.

## Numbers, words and conversions

- **A number in a line's words or a key** is `${String(x)}` (the same text); `a + '-' + b` on numbers is
  `` `${String(a)}-${String(b)}` ``.
- **`parseInt(x)`** on a number or a regular expression's group is `parseInt(String(x))`: `parseInt` reads its argument
  as words. `s.match(re)` with no `g` flag is `re.exec(s)`, the same result.
- **Flags subtracted in a sort** (`y.fly - x.fly`, flying first) are `Number(y.fly) - Number(x.fly)`: the same order.
- **A pair read element by element** (`a[0] + a[1]`, a damage range the dice read) is `Number(a[0]) + Number(a[1])`, or
  a small reader that hands back `[Number(a[0]), Number(a[1])]` and, for no pair, throws the `TypeError` the old read
  threw. `x > 0` already reads `x` as a number, so `Number(x) > 0` is the same.
- **`x > 0` on an optional number read again after the test** is `x !== undefined && x > 0`, which narrows `x`; read
  once, `const { aura = 0 } = fx` and `aura > 0`. `Math.min(x, y)` and `x <= y - 1` read a missing `x` as `NaN`:
  `Math.min(Number(x), y)`, `Number(x) <= Number(y) - 1`.
- **A `String()` a test shows is needed** (an order's target, an item's id held as a number) stays, through a reader
  typed as wide (`aTargetInWords`), though the type says words. One the saved schema makes needless (a guardian's
  power's words) goes. `!!x` on a flag is `x` (`Boolean(asItsGuardReadsIt(x))` if it may be missing).
- **`/^merc_/.test(s)` on words** is `s.startsWith('merc_')`. A company's name `armyUnitName` draws is read through
  `theNameDrawn`, which throws for none (its type allows none; it always draws or composes one).
- **A number a typed callee may give as `undefined`** (`effSkillOf` for no hero) is read `Number(x)` where it is counted
  or compared, and kept as it is where it is handed back.

## Lists, tables, sets and maps

- **A list's or a table's element read where the code has just made it sure** (`cav[i]` after `i >= 0`, one of three
  candidates sorted) is read into a `const` and checked; where the old code would have thrown there, the check throws
  the same kind of error. A die's pick from a list just found not empty goes through a reader that throws for none
  (`theOneThePickFell`), and `list.splice(i, 1)[0]` at an index just drawn through one that takes it out
  (`theOneTakenOut`); a value a filter has just kept and its map works out again (an item's slot), through one that throws
  for none (`theSlotTheFilterFound`). `G.players[c.player].name` after a check doesn't narrow: only a plain variable as
  the key does.
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
  filter that returns on a miss; a swap that may meet `undefined` checks `k in list`. A field only an older save holds (an
  item's `_spent`) is read through a local type that adds it as `unknown`.
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
- **`x.pop()` in a loop `while (x.length > 0)`** is `...x.splice(-1, 1)` pushed (a gap stays a gap); `src.armies.pop()` on a
  list just found not empty is `theOneTakenOut(list, list.length - 1)`. A number a callee has just set in a pool for
  a hero (`refreshMovePool`'s points) is read through a check that throws for none (`thePointsTheRefreshLeft`).
- **Levels by skill read and raised by any skill's name** (a hero's skills, a snapshot, his rises this turn) go
  through a reader that hands back the same object typed `Partial<Record<string, number>>` (`theLevelsByAnyName`):
  a schema's object type, unlike an interface, takes a record, so the writes reach it.
- **`[a[0]]` and `[a[1]]` from a list just found to hold two** are `a.slice(0, 1)` and `a.slice(1, 2)`, the same lists. A
  regular expression's group that always takes part in a match is read `String(m[1])`, the same words.
- **A die's pick from a list that may hold a gap** (a hero's pack, read as a battle's copy holds it) is checked just
  after the pick, throwing for a gap, so the reads after it narrow; `!(x && x.a === it.a)` is then `!(x?.a ===
  it.a)`, `it.a` never missing.
- **A filter whose kept elements a later read needs narrower** (a lair with a guardian, read unguarded after) takes a
  type predicate on what it keeps: `.filter((x): x is { f: ALairWithAGuardian; i: number } => …)`. A filter's callback
  typed wider than the list's element (`(it: AnItemItsEffectGuarded) => …`) keeps a guard on a field the schema
  requires and still returns the list's own kind; two such checks stay two (the ratchet counts each).
- **An object grouped by a number** (`(o[k] = o[k] || v).list.push(x)`) is read, then written back:
  `const here = o[k] ?? v;`, `o[k] = here;`, `here.list.push(x)` (lint reads `o[k] ??= v` as never missing).
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
- **The turn's records by a hero's id read by a hero whose id may be words** (a fight's copy's move pools) go through a
  local view of the same objects typed `Partial<Record<string, number>>`; a `Map` by a number looked up so, through a
  local `ReadonlyMap<unknown, string>`. A key of `Object.keys` the code wrote from a province's id indexes the provinces
  as `list[Number(k)]`, the same element.
- **A `Set` or an empty list iterated** (`(s[pi] || []).forEach(…)`) is read into a local typed `ReadonlySet<number> |
  readonly number[]`, then `forEach`: the same calls.
- **`for (k in obj)` over a literal's keys** is a `for … of` over a typed list of them, in the same order. A `Map` a
  caller makes is typed by the methods the function calls.
