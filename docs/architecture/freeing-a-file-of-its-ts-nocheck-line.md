# Freeing a file of its ts-nocheck line

What a file with the ts-nocheck line checks (nothing), so lint refuses the line, and how code the compiler refuses is
typed so that every value stays the same. The trap in brief: [traps.md](../traps.md#ts-nocheck-checks-nothing-in-the-file).

## `@ts-nocheck` checks nothing in the file

TypeScript reports no error anywhere in a file that starts with a `// @ts-nocheck` line: a type, an annotation or a
`satisfies` written there is a claim nobody checks, so a wrong parameter type compiles, and so does a table with a key
left out. So lint refuses the line in every TypeScript file, with a reason or without (`ban-ts-comment`, as
typescript-eslint's strict sets set it, in `src/`, `tests/` and `tools/` alike), and no file has it: P1-10b and
P1-17c freed the engine's side, and P1-16 the pages. `tests/static/harness.test.ts` plants the line in a file of
each and shows lint refuses it.

- **Type code from what its callers pass**, and as wide as the body's own guards (a body that writes
  `(force || []).filter((a) => a && …)` takes `readonly (Army | null | undefined)[] | null | undefined`), so each
  guard stays needed, and run `npm run typecheck`. An error that only a changed statement clears is cleared by one
  that **keeps every value** (P1-10b's Decision 2), never by a `!` or an `as` (lint refuses both in `src/`): a list's
  or a table's element read into a `const` before its check (`G.players[c.player].name` after a check doesn't narrow:
  only a plain variable as the key does); a guard (`if (!x) return;`) where the code has just made `x` sure;
  `?? <the value it had>` where the left side can't be `undefined`; a type predicate for `.filter(Boolean)`;
  `catch (e)` read through `e instanceof Error ? e.message : String(e)`; a typed `const` for a literal table read by
  any string (P1-10b1 did the last three kinds for the assertions `src/engine/rules-on-plain-values/` held). A change
  that could change a value the game can meet isn't a type fix: it is its own PR. The proof is both balance sets and
  every realm's report identical **and** `npm test` green, since the matrix doesn't reach every line (no matrix game
  holds a unit's legacy name, for one): a changed statement the matrix doesn't reach gets a unit case, red on a
  planted fault.
- **Typed code meets the type-aware lint rules** in the same PR ([traps.md](../traps.md#a-fixed-lint-finding-must-leave-the-suppressions)):
  fix every finding there, and suppress none (as P1-10b chose), so `eslintSuppressions` doesn't rise. Each fix keeps
  every value too: a `||` that a `0`, `''` or `false` reaches becomes an explicit check, not `??`; a guard that a
  caller may need stays, its parameter typed optional; a `no-unsafe-*` finding from an untyped value is met by typing
  the value where the file takes it.

## The forms that keep a value, by kind

Each form in the three files below keeps every value the old statement gave, for every value its type allows; a few
keep it for every value at all. P1-10b2 to P1-10b38 and P1-16 found them (each row's figures are in its PR). A form a
row needs that isn't there is added under its kind.

- **[Numbers, words and lists](the-forms-that-keep-a-value-numbers-words-and-lists.md):** [`||` and `??`](the-forms-that-keep-a-value-numbers-words-and-lists.md#-and-),
  [numbers, words and conversions](the-forms-that-keep-a-value-numbers-words-and-lists.md#numbers-words-and-conversions),
  [lists, tables, sets and maps](the-forms-that-keep-a-value-numbers-words-and-lists.md#lists-tables-sets-and-maps).
- **[Guards, parameters and types](the-forms-that-keep-a-value-guards-parameters-and-types.md):**
  [guards and the compiler's narrowing](the-forms-that-keep-a-value-guards-parameters-and-types.md#guards-and-the-compilers-narrowing),
  [parameters, shapes and claims](the-forms-that-keep-a-value-guards-parameters-and-types.md#parameters-shapes-and-claims),
  [the types the code corrects](the-forms-that-keep-a-value-guards-parameters-and-types.md#the-types-the-code-corrects).
- **[The page's elements and events](the-forms-that-keep-a-value-the-pages-elements-and-events.md)** (P1-16c):
  [elements looked up](the-forms-that-keep-a-value-the-pages-elements-and-events.md#elements-looked-up),
  [writing into the page](the-forms-that-keep-a-value-the-pages-elements-and-events.md#writing-into-the-page),
  [events and promises](the-forms-that-keep-a-value-the-pages-elements-and-events.md#events-and-promises),
  [the page's globals](the-forms-that-keep-a-value-the-pages-elements-and-events.md#the-pages-globals).
