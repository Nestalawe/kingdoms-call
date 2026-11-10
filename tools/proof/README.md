# The proof tools

Seven tools that show what a change to the engine (or to a page's code or its database calls) does, and what the balance
matrix can't show. The matrix (`npm run balance`) compares its 120 games with their baselines. It is strong on the code those games reach, and
blind to the rest. These tools tell which lines the games reach, plant a fault and show what catches it, and compare
the base's words with the branch's where the games don't go.

Use them on a branch whose matrix is identical to its baseline (a refactor). All are local tools: none runs in CI or
in `npm test`. Each but the tours' has a unit test on a small made-up input (`tests/unit/`, below); the tours' was proved by its
trial on four planted faults (plan P1-16a).

| Command | What it answers | Time (14 cores) |
|---|---|---|
| `npm run proof:coverage` | Which lines of `src/engine/` and `src/views/` the matrix's games reach | about 60 s |
| `npm run proof:unreached -- --base <ref>` | Which lines this branch changed that no game reaches | a few seconds, or 60 s more if the coverage is out of date |
| `npm run proof:plant -- <patch>… [--tests <file>,…]` | What a planted fault changes: games, reports and tests | about 2 min a patch, plus the tests' own time |
| `npm run proof:gm-logs -- --base <ref>` | Whether every game's GM log is byte-identical, base against branch | about 70 s |
| `npm run proof:two-engines -- --cases <module> --base <ref>` | Whether the base's engine and the branch's write the same lines on staged cases | a few seconds, plus the cases' own time |
| `KC_RECORD_DATABASE_CALLS=<folder> npx vitest run` | Every database call the page tests and tours send, to compare base with branch | the tests' own time |
| `npm run proof:tours -- --base <ref>` | Which lines of `src/` this branch changed that no screen tour reaches (nor, for the GM page, the matrix) | about 50 s; 2 minutes more with the matrix |

`--base <ref>` means "where this branch left `<ref>`" (`git merge-base <ref> HEAD`), so a stacked branch names the
branch it is stacked on. The branch is always the working tree as it is now, uncommitted changes and new files too.

## 1. Which lines the games reach

`npm run proof:coverage` ([the-matrixs-coverage.ts](the-matrixs-coverage.ts)) plays the matrix's 60 games of each set
(both sets: 120 games). It plays them as the balance runner's second half does (every realm's report, in the engine's
vm), in worker processes that Node's own V8 coverage watches (`NODE_V8_COVERAGE`). Their engine is the usual bundle
(`tests/lib/engine.ts`), built here with its source map. [c8](https://github.com/bcoe/c8) turns the bundle's counts
into counts on each source file's lines. It writes, in `coverage/matrix/` (git ignores `coverage/`; `--out DIR` for
another folder):

- `lines.json`: each file's lines with code, how often the games ran each, the lines that are only partly reached,
  and a hash of what `src/` held;
- `report/index.html`: c8's report, file by file and line by line.

It prints, for each folder, how many lines with code it has and how many the games reach. Options: `--set A` or
`--set B` (one set only), `--jobs N`, `--out DIR`.

A line is **partly reached** when the games ran it, but a block on it never ran: the right-hand side of a `??` or
`||`, one branch of `? :`, an `else`, or a `case`. Blank lines and comment lines are left out.

`npm run proof:unreached -- --base main` ([the-changed-lines-no-game-reaches.ts](the-changed-lines-no-game-reaches.ts))
lists the lines this branch changed in `src/engine/` and `src/views/`, sorted three ways:

- **not reached**: no game ran the line;
- **partly reached**: as above, with the block no game ran;
- **reached**: counted only.

It also lists the places where the branch only took lines out, for a reader to judge from the base's code. It reuses
`coverage/matrix/lines.json` when that was measured on what `src/` holds now, and measures again otherwise. Each line
it lists needs a unit case that fails on a fault planted in that line. It is a list, not a gate: it always exits 0.
Options: `--coverage DIR`, `--jobs N`, `--json`.

**What it can't see.** The matrix's first half plays the same games on the GM portal, in jsdom. That half also runs
the portal's shell, but its engine lines are the vm's: `npm run balance` checks every turn's saved state is the same in
both. So a line only the page reaches reads "not reached" here. The list errs towards asking for a unit case.

## 2. A planted fault

`npm run proof:plant -- <patch>…` ([a-planted-fault.ts](a-planted-fault.ts)) takes one or more patches (each a
`git diff`). For each one, it:

1. copies this working tree to a temporary folder ([copies-of-the-tree.ts](copies-of-the-tree.ts)): tracked files and
   new ones git doesn't ignore, without `plan/`, with this checkout's `node_modules` linked, committed in a git
   repository of its own;
2. applies the patch and commits it (it stops if git refuses the patch, or if the patch changes nothing);
3. plays the matrix's set A and set B there (`npm run balance -- --set S --out …`, every realm's report included) and
   compares each with the copy's committed baselines, game by game;
4. runs the tests named, if any: `--tests <file>,…` (Vitest's file filters), `--name <regex>` (`-t`), or
   `--all-tests` (`npm test`);
5. prints the games that differ, the games with a report that differs, what else went wrong (a game that failed, a
   leak check broken), and the tests that are red. All of it also goes into `result.json`, in the folder it names.

The copy is removed afterwards; `--keep` keeps it. `--set A` or `--set B` plays one set only. A fault in reached code
shows as games or reports that differ. A fault in a line no game reaches shows only as a red test, which is that
line's unit case.

## 3. The GM logs, byte for byte

`npm run proof:gm-logs -- --base main` ([the-gm-logs-compared.ts](the-gm-logs-compared.ts)) plays every matrix game
twice in the engine's vm ([the-gm-logs-worker.ts](the-gm-logs-worker.ts)). The first time is from a copy of the base
(`git archive`, `node_modules` linked), with the base's own harness. The second is from this working tree. Each game's
GM log, as the shell saves it (every field of every line, the words among them), is compared whole. For a game that
differs, it shows the first line that does, cut to where the two part. It exits 1 when any game differs or fails.
Options: `--set A|B`, `--jobs N`, `--out DIR` (keeps every log, one file a game).

## 4. Two engines on staged cases

`npm run proof:two-engines -- --cases <module> --base main` ([the-two-engines-compared.ts](the-two-engines-compared.ts))
is a frame: the row brings the cases. Two engines run in processes of their own
([the-two-engines-side.ts](the-two-engines-side.ts)): the base's, from a copy of the base, and this working tree's.
Both run the same cases module, each with its own `src/`. Every case runs with its own dice, then with each of N
seeded dice streams (`--streams N`, default 5). Each run's lines (one by one, as JSON), its world afterwards (as a hash)
and what it threw are compared. Runs that threw the same way on both sides are counted, not reported. It exits 1 when
any run differs.

A cases module is a `.mts` file, so it loads as an ES module wherever it is. Its default export makes the cases for
one side's `src/` ([the-two-engines-cases.ts](the-two-engines-cases.ts) has the types and the dice helper):

```ts
import { loadEngine } from '<repository>/tests/lib/engine.ts';
import { withADiceStream, type TwoEngineCases } from '<repository>/tools/proof/the-two-engines-cases.ts';

const cases: TwoEngineCases = ({ src }) => {
  const engine = loadEngine({ seed: 1, src });
  return [
    {
      name: 'a claimant cut below his own floor',
      run: (dice) =>
        withADiceStream(engine, dice, () => {
          // stage the world, call the stage
          return { lines: theLinesInWords, world: theWorldAfter };
        }),
    },
  ];
};
export default cases;
```

Stage what the games don't reach: a case library's cases (`tests/lib/*-cases.ts`), or a stage called on a world staged
directly. Return the lines in words, so that a line moving from words to facts compares by what it says.

## 5. Every database call a page makes

The proof of P1-17's area rows, which move a page's database calls onto `Db` (plan P1-17, Decision 12).
[every-database-call-a-page-makes.ts](every-database-call-a-page-makes.ts) wraps each client a page makes in jsdom
(`tests/lib/boot.js` loads it only when `KC_RECORD_DATABASE_CALLS` names a folder). Each call goes as one line of JSON
into `<folder>/<process id>.jsonl`: a query once awaited, with every step and its arguments; any other call when made.
Times read as `<time>`. Record the base's site and the branch's, then compare the lines, sorted:

```sh
KC_SITE=<base's site> KC_RECORD_DATABASE_CALLS=/tmp/rec-base npx vitest run
KC_SITE=<branch's site> KC_RECORD_DATABASE_CALLS=/tmp/rec-row npx vitest run
diff <(cat /tmp/rec-base/*.jsonl | sort) <(cat /tmp/rec-row/*.jsonl | sort)
```

A test that reads the branch's own new code (a new way in) is left out of both (`--exclude`). The two fuzz scripts'
GM-log reads differ between any two runs (their turn numbers hang on a short wait), so set them aside. The browser
specs aren't recorded.

## 6. The lines a page's code changed that no tour reaches

A page row's list (plan P1-16, Decision 6): its tier 1, with the screen tours where the matrix stands for the engine.
Run it on the row's branch, naming the branch the row is stacked on:

```sh
npm run proof:tours -- --base p1-16b-the-two-forecast-files   # the row's base branch, or main
```

[the-changed-lines-no-tour-reaches.ts](the-changed-lines-no-tour-reaches.ts):

1. builds this working tree's site with each bundle's source map (`buildSite`'s `sourceMaps`) into `coverage/tours/site/`;
2. runs every mode of the four screen tours (`tests/lib/screens.js`, as `tests/tools/same-dom.js` does) in jsdom on it, in a
   process Node's V8 coverage watches;
3. when the branch changed a file of the GM page's bundle, plays the matrix's set A on that site's GM page
   (`KC_SITE`) under the coverage too (`--matrix always` or `never` to say otherwise);
4. maps what ran, character by character, through each bundle's source map to the lines of `src/`, and sorts the lines
   the branch changed since `--base` (as `proof:unreached` does): **not reached**, **partly reached** (some of the line
   never ran: the right of a `||`, a branch of `? :`, a callback never called) and **reached**, counted only. It also
   lists the files no page's bundle holds code of, and where lines were only taken out.

Each line listed needs a case that fails on a fault planted in it (a unit test where the file imports in Node, else a page
test), or a reason by name why the code makes it so. It writes `coverage/tours/lines.json` (every line's reach) and two logs
(`tours.log`, the pages' own errors; `matrix.log`, with the matrix's verdict). It is a list, not a gate: it exits 0. Options: `--out DIR`, `--json`.

Its trial (P1-16a; the fault planted, then this tool, the screens against the base's site and the matrix):

| Planted fault | The screens (`same-dom.js`) | The matrix (set A) | This list |
|---|---|---|---|
| A, `titles.ts`: a vacant title sorted as 0, not 1000 | 71 of 102 differ (the player's tour) | – | reached, counted |
| B, `hall-of-fame.ts`: a record's provinces + 1 | none differ (the GM's tour) | 56 of 60 games differ (`writes`, `results`) | reached, counted (the matrix played) |
| C, `titles.ts`: the standings' prize fallback `\|\| 0` made `\|\| 1` | none differ | – | partly reached, listed (its callback never runs) |
| D, `titles.ts`: "Your realm" `\|\|` made `??` | none differ | – | partly reached, listed |

**What it can't see.** A line whose code all ran reads reached whatever values it ran with: a `||` made `??` on such a
line, where no tour meets the falsy value, shows nowhere (plant D's line is listed because some of it never runs); the
forms that keep a value by construction carry such lines. The other browser specs and set B aren't run. The screens must be steady for the screens' check to mean anything: two runs of one
site show the same screens (the tours hold the page's short timers and the watcher's clock).

## The tests

- `tests/unit/the-matrixs-coverage-lists-the-changed-lines-no-game-reaches.test.ts`
- `tests/unit/a-planted-fault-names-the-games-reports-and-tests-it-changes.test.ts`
- `tests/unit/the-gm-logs-compared-names-each-game-whose-log-differs-and-where.test.ts`
- `tests/unit/the-two-engines-compared-runs-each-side-in-its-own-process.test.ts`
- `tests/unit/the-database-call-recorder-writes-each-call-a-page-sends-with-its-steps.test.ts`
