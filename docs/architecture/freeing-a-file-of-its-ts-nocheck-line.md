# Freeing a file of its ts-nocheck line

What a file that keeps its ts-nocheck line checks (nothing), and how a file is freed so that every value stays the same. The trap in brief: [traps.md](../traps.md#ts-nocheck-checks-nothing-in-the-file).

## `@ts-nocheck` checks nothing in the file

37 files of `src/` still start with a `// @ts-nocheck` line, counted by the ratchet in two: `tsNocheckEngineSide`
(1: `src/engine/`, `src/views/` and `src/db/`, the one `src/db/kc-db-guard.ts`, which P1-17 frees; and `src/ui/shared/`,
`src/content/`, `src/schemas/` and `src/shared/`, which have none), which P1-10b frees, and `tsNocheckUi` (36: the UI's pages in `src/ui/`, `src/rulebook/`, and any
other file, `tests/` and `tools/` too), which P1-16 frees. Each only falls, so freeing a file on one side can't make
room for a new line on the other. TypeScript reports no error anywhere in such a file. A type,
an annotation or a `satisfies` written there is a claim nobody checks: a wrong parameter type compiles, and so does a
table with a key left out.

- **A type is checked where a file without the line reads it.** A type written in a file that keeps the line is a
  claim until a freed file reads it; each freed file that reads it checks it. If a freed file's code disagrees with one,
  correct the type, not the code (P1-10a3 did so for a log line's `targets`).
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

Each form in the two files below keeps every value the old statement gave, for every value its type allows; a few
keep it for every value at all. P1-10b2 to P1-10b38 found them (each row's figures are in its PR). A form a row needs
that isn't there is added under its kind.

- **[Numbers, words and lists](the-forms-that-keep-a-value-numbers-words-and-lists.md):** [`||` and `??`](the-forms-that-keep-a-value-numbers-words-and-lists.md#-and-),
  [numbers, words and conversions](the-forms-that-keep-a-value-numbers-words-and-lists.md#numbers-words-and-conversions),
  [lists, tables, sets and maps](the-forms-that-keep-a-value-numbers-words-and-lists.md#lists-tables-sets-and-maps).
- **[Guards, parameters and types](the-forms-that-keep-a-value-guards-parameters-and-types.md):**
  [guards and the compiler's narrowing](the-forms-that-keep-a-value-guards-parameters-and-types.md#guards-and-the-compilers-narrowing),
  [parameters, shapes and claims](the-forms-that-keep-a-value-guards-parameters-and-types.md#parameters-shapes-and-claims),
  [the types the code corrects](the-forms-that-keep-a-value-guards-parameters-and-types.md#the-types-the-code-corrects).
