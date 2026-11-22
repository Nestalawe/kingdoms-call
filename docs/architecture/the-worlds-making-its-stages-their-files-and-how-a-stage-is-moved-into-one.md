# The world's making: its stages, their files, and how a stage is moved into one

`generateNewGame` (`src/engine/world/generate.ts`) makes a new world at Turn 0 in eighteen stages, S0 to S17: the
set-up, the capitals, each home's ring, the provinces, and so on to the naming pass. The stages, in order, with what
each makes, are the world proof's stage table
([tools/proof/the-worlds-makings-stages.ts](../../tools/proof/the-worlds-makings-stages.ts)). The split rows of B-06
(B-06v to B-06aa) move the stages out of `generateNewGame`, a few a row, into files of their own in
`src/engine/world/the-worlds-making/`. A stage with `fn` in the stage table has moved; the rest are still in
`generateNewGame`. This file is the shape every moved stage takes, so the later rows follow the first.

## Where a stage lives

- **One file a stage**, or one file for a few short stages, named `sNN-<what it makes, in game terms>.ts`, two
  digits: `s01-the-capitals-placed-as-far-apart-as-the-map-allows.ts`. Its function has the same words in camel case
  (`theCapitalsPlacedAsFarApartAsTheMapAllows`). The name must be unique in `src/`: the world proof finds a die's stage
  by the name of the function that drew it.
- **What two or more stages read** is in
  `what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts`: the shapes the stages hand on (a realm as
  the setup hands it, a cell of the grid, a terrain, a ring cell's tailoring, a province as the world makes it) and
  the two checks `theCardDealt` and `theOneMadeSure`. A type only one stage reads stays in that stage's file
  (`ALayoutsScore`, in S1's).
- **A stage's file never imports `generate.ts`**: that would be an import cycle, which `npm run lint:arch` refuses. So
  a helper of `generate.ts`'s top level that a stage calls moves to a file of its own beside the stages, and
  `generate.ts` re-exports it for its other callers (the sea share the GM picks, `normSeaPct`, which S0 reads).
- **Module state stays where it is** (`_usedHeroNames` and the other name pools in `src/engine/names.ts`,
  `maxHpPlayers`).

## A stage's shape

- **It takes one typed object** of what it reads from the setup and the earlier stages, an interface beside it named
  `What<the stage>Reads` (`WhatTheCapitalsPlacementReads`). The object is unpacked in the function's parameter, so the
  body keeps every name it had in `generateNewGame`.
- **It returns an object of what the later stages read**, its type inferred, and `generateNewGame` unpacks it under the
  same names. A value the stage uses only itself (S1's `homeMin`) stays inside.
- **The body is cut and pasted**: the same statements in the same order, the same dice, the same writes. No statement
  is improved, no condition simplified and no loop restructured.
- **What the stages share is passed, never copied.** An array or object that later stages change (`provinces`, S2's
  ring tailoring `constraint`, the heroes) is handed on and changed in place, as it was: a copy would change what a
  later stage sees.
- **A function a later stage calls** (`pickLand`, `neighbourCells`, the naming functions S17 runs) is made where it was
  made, in its stage, and returned. A stage that calls it gets it in its input. A function that reads `cols` or `rows`
  is made after them, with the same values.
- **A value a later stage fills** stays a `let` in `generateNewGame` and is handed in, or is returned by the stage that
  fills it. Never `as` or `!`.
- **`generateNewGame` calls the stages in order** and threads their results from one to the next.

## What a row updates when it moves a stage

1. **The world proof's stage table**: the moved stage gets `fn: '<its function's name>'`. Its anchor stays while the
   row's base still holds the anchor in `generate.ts`; the anchor's comment moves with the stage's code. The proof,
   `npm run proof:worlds -- --base <base branch>`, must show every case identical, stage by stage
   ([tools/proof/README.md](../../tools/proof/README.md#7-the-worlds-making-world-by-world)).
2. **The world-making counts' list** (`THE_WORLDS_MAKINGS_FUNCTIONS_AND_TABLES` in `tools/ratchet.ts`): each new stage
   function is added, and a listed function or table that moves keeps its entry at its new file, so no count falls by
   the move. The static test
   (`tests/static/the-code-the-worlds-making-rows-have-taken-holds-no-number-nor-list-and-every-listed-function-is-there.test.ts`)
   names the new file wherever its lists name the old one.
3. **A test that cuts or reads `generateNewGame`'s statements by name** reads them in the stage's function instead
   (`statementsBetween(<the stage's file>, <its function>, …)`), with every assertion and its seed kept. Cut code that
   used a function from a file's top level gets it handed in (`sourceOf(<the file>, ['theOneMadeSure'])`), as it gets
   the content rows it reads. A test that reads the moved code in the GM page's code (`compactPage`) reads the
   stage's file instead (`compactOf`): the page's entry doesn't name the stages' files (KD-457). Its line in [the list of tests](../../tests/every-test-its-level-and-what-it-checks.md)
   follows.
