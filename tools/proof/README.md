# The proof tools

Ten tools that show what a change to the engine (or to a page's code or its database calls) does, and what the balance
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
| `npm run proof:plants -- <plants.json> [--jobs N]` | Which of a row's planted faults the tests that guard each line catch, several at a time | about 2 s a plant on one test file: 130 plants, four at a time, in about 65 s |
| `npm run proof:gm-logs -- --base <ref>` | Whether every game's GM log is byte-identical, base against branch | about 70 s |
| `npm run proof:two-engines -- --cases <module> --base <ref>` | Whether the base's engine and the branch's write the same lines on staged cases | a few seconds, plus the cases' own time |
| `KC_RECORD_DATABASE_CALLS=<folder> npx vitest run` | Every database call the tests send a page's client, to compare base with branch | the tests' own time |
| `npm run proof:tours -- --base <ref>` | Which lines of `src/` this branch changed that no screen tour reaches (nor, for the GM page, the matrix) | about 50 s; 2 minutes more with the matrix |
| `npm run proof:worlds -- --base <ref>` | Whether each seed makes the same world with the same dice, stage by stage, base against branch | about 8 minutes (2,560 cases; `--seeds 8`, 100 s) |
| `npm run proof:battles -- --base <ref>` | Whether each staged battle writes the same lines and the same to the turn's context, leaves the same world and draws the same dice, stage by stage, base against branch | about 2 minutes (672 cases, 8 dice streams each; `--cases 40`, 7 s) |

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

### Many plants, on their tests only

`npm run proof:plants -- <plants.json>` ([many-planted-faults-on-their-tests.ts](many-planted-faults-on-their-tests.ts))
is the tier-1 proof of a row (each changed line no game reaches, red on a fault planted in it): many plants, each run on
the tests that guard its line, with no build and no matrix. A plant is a text replaced in one file:

```json
{ "tests": ["tests/unit/the-gms-statistics-tab-….test.ts"],
  "plants": [{ "name": "215 who filter", "file": "src/ui/gm/stats-tab.ts",
               "old": "(who === 'bot') === !!r.is_bot", "new": "(who === 'bot') === !r.is_bot" }] }
```

`occurrence` (0, the first, unless given) picks which copy of the old text is replaced, and a plant's own `tests` wins
over the shared ones; a plain list of plants, each with its `tests`, works too. It makes `--jobs` copies of the working
tree (a quarter of the cores unless given), and each copy takes the next plant: the file planted, `vitest run <its
tests>`, the file put back. Each plant ends **red** (a test failed on it), **GREEN** (none did: the line needs a unit
case, or a reason by name), **missing** (the old text isn't there), **broken** (the file no longer compiles, or no test
ran) or **timed out** (only time limits failed, or it ran past `--limit`, 300 s by default). A plant that timed out isn't
caught: run it again with `--jobs 1`; the runner never runs a plant twice by itself. It prints a line a plant as each
ends, then the counts, and keeps `result.json` and each plant's log in the folder it names. The copies are removed
after (`--keep` keeps them). A test that reads the built site (`site/` isn't in a copy) or plays the matrix needs
`proof:plant`.

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
(`tests/lib/boot.ts` loads it only when `KC_RECORD_DATABASE_CALLS` names a folder). Each call goes as one line of JSON
into `<folder>/<process id>.jsonl`: a query once awaited, with every step and its arguments; any other call when made.
Times read as `<time>`. A page handed the fake (`tests/lib/fake-db.ts`: the page tests and the screen tours) sends
its calls to the fake, not to a client, so they aren't recorded. Record the base's site and the branch's, then compare
the lines, sorted:

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
2. runs every mode of the four screen tours (`tests/lib/screens.ts`, as `tests/tools/same-dom.ts` does) in jsdom on it, in a
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

| Planted fault | The screens (`same-dom.ts`) | The matrix (set A) | This list |
|---|---|---|---|
| A, `titles.ts`: a vacant title sorted as 0, not 1000 | 71 of 102 differ (the player's tour) | – | reached, counted |
| B, `hall-of-fame.ts`: a record's provinces + 1 | none differ (the GM's tour) | 56 of 60 games differ (`writes`, `results`) | reached, counted (the matrix played) |
| C, `titles.ts`: the standings' prize fallback `\|\| 0` made `\|\| 1` | none differ | – | partly reached, listed (its callback never runs) |
| D, `titles.ts`: "Your realm" `\|\|` made `??` | none differ | – | partly reached, listed |

**What it can't see.** A line whose code all ran reads reached whatever values it ran with: a `||` made `??` on such a
line, where no tour meets the falsy value, shows nowhere (plant D's line is listed because some of it never runs); the
forms that keep a value by construction carry such lines. The other browser specs and set B aren't run. The screens must be steady for the screens' check to mean anything: two runs of one
site show the same screens (the tours hold the page's short timers and the watcher's clock).

## 7. The world's making, world by world

The proof of B-06's world generation rows (B-06s to B-06ab): `npm run proof:worlds -- --base <ref>`
([the-worlds-making-compared.ts](the-worlds-making-compared.ts)). It makes each case's world twice, once from a copy of
the base (`git archive`, `node_modules` linked) and once from this working tree, each world in a fresh process of its own
([the-worlds-making-worker.ts](the-worlds-making-worker.ts)), so no world sees another's module state. The worker
imports the side's `src/` as it is (Node strips the types, so a frame's line is the source's), lends the dice a counting
stream from the case's seed (`kcRng.use`), draws up the bots' realms as the GM page's Turn 0 does (`generateBotSetups`),
and calls `generateNewGame`. For each case it compares the sha256 of the world's JSON, the dice drawn in all, the dice
drawn by stage, and what the making wrote on the console. It exits 1 when any case differs, and names each one with
what differs (`S13's dice (31 → 32)`). Options: `--seeds N` (40 unless given), `--jobs N`.

**The dice in all aren't a proof on their own:** a later loop that draws until a name is free can absorb an extra draw,
so a world can total the same dice and still differ. The hash and the stages' counts are the proof.

**The cases** (2,560): seeds 1 to 40, each on every map size the GM page offers (p2 to p10), at the sea shares 20, 35,
60, 65, 70, 75 and 80 (the home sea cap's cuts are at 60 and 70), and on an undersized map (five realms on the
three-realm map, which takes the 400 raw layouts' path and warns). Each seed has one of four mixes of players' realms,
the rest bots: every realm a bot; Divine with a naval king and Pagan; Undead and Druidic with a naval king; Good with a
naval king, Neutral and Evil. Together they hold every creed, Divine and Undead once a game.

**A draw's stage** is read from its call stack, with no mark in `src/`
([the-worlds-makings-stages.ts](the-worlds-makings-stages.ts)): the innermost frame that is a stage's own function, or
else `generateNewGame`'s frame, whose line falls between two stages' anchors (the line that opens each stage, found
once in `src/engine/world/generate.ts`). The bots' realms' draws count apart, as `bots`. **The stages and their functions are read from their list in `src/`**
(`src/engine/world/the-worlds-making/the-stages-in-the-order-they-run.ts`, by its syntax tree:
[the-worlds-makings-stages-read-from-their-list-in-src.ts](../the-worlds-makings-stages-read-from-their-list-in-src.ts)),
so a new stage needs no edit here; the anchors stay in the table for a base from before the split (B-06v to B-06aa). A
stage found on a side by neither stops the proof rather than count its dice as another's, and the unit test checks that
every stage is found in the tree as it is.

**Red on planted faults** (B-06s, each in a planted copy of the tree, the tool's `--base` against the copy unplanted):

| Planted fault | What the tool shows |
|---|---|
| One extra `kcRng()` at the end of the coastal shipyards (S13) | 512 of 512 cases red (8 seeds), S13's dice 0 → 1 in each; some, such as seed 1, p2, sea 35%, keep the same world and the same dice in all |
| A realm's starting gold 20 made 21, no draw | 512 of 512 cases red on the world's hash, the dice the same |
| The tax floor's 2 made 3; the starting HP 15 made 16 | the same worlds: no world keeps them (KD-454, KD-455) |

**What it can't see:** a value no world keeps (the two above); a path no seed reaches; state beyond one world, which a
fresh process hides by design. Those need unit cases.

## 8. The battles, battle by battle

The proof of B-06's battle rows (B-06ax on): `npm run proof:battles -- --base <ref>`
([the-battles-compared-each-staged-battle-its-lines-its-world-and-its-dice-by-stage.ts](the-battles-compared-each-staged-battle-its-lines-its-world-and-its-dice-by-stage.ts)).
Each case is staged and fought twice, once from a copy of the base (`git archive`, `node_modules` linked) and once from
this working tree, each in a fresh process of its own
([one-staged-battle-fought-on-a-side-in-a-fresh-process.ts](one-staged-battle-fought-on-a-side-in-a-fresh-process.ts)).
The worker imports the side's own `tests/lib/a-battle-called-directly.ts` on its own `src/` as they are, makes the world
from seed 1, stages the battle on it once, and fights it from that staging with each of 8 fixed dice streams (900 to
907), lending the dice a counting stream (`kcRng.use`). For each stream it compares the battle's lines in words, the
sha256 of the world after (with who won), what the battle wrote to the turn's context (the turn's log entry by entry;
every other field but the world and the distance cache by its hash: the statistics' facts, `battleCommanders`,
`_duelFoes`, `_deferredSkillLogs` and the rest), the dice drawn in all and the dice drawn by stage. It exits 1 when any
case differs, and names each with its stream and what differs (`stream 903: H6's dice (1 → 2)`, `the turn's context
(_tel)`). Options: `--cases N` (N cases spread over the grid, for a quick look), `--jobs N`.

**The grid** (672 cases): the ground (plain, forest, mountain, desert, sea) × the battle (against a province's
defenders, `combatVsNPC`; between heroes, `combatVsChar`, the two realms at war on a province of the defender's) × the
defender × where the attacker comes from × 13 sets of armies (foot, missiles, flyers, beasts under a Druid short,
skeletal companies, Monsters under Evil, Dwarven Guard, corsairs, whales, fleets, reavers, Tactical 6 and the War Drum,
an outmatched attacker). On a sea field only the sets whose two hosts each hold a ship or a sea beast (corsairs, whales,
fleets, reavers). Each commander has Tactical, Archery and Naval 2, Druid 2, Elemental 3 and Necromancy 2, as the set
changes them.
- **The defender**: led (a neutral guard, or the defending king, challenged to a duel); or leaderless, each battle's
  own sense of it: no guard against the defenders, and between heroes a host whose commander is already dead
  (`alive` false, as after a fall in an earlier phase: his skills gone, "…'s leaderless host").
- **Where the attacker comes from**: land; a landing, as the Move order makes one (`_attackedFrom` the sea beside the
  field, `_seaLandingAt` this turn, and Reaver Crews' `_amphibiousAssault` when Orcish Longships carry him); or a
  landing that raids the coast (Naval 9's `_raidCoastTurn` this turn). On a sea field, the sea beside it.

Not on the grid: a realm's garrison holding a province with no hero, the mastery orders' flags, Sanctuary, Consecrate,
Illusory Terrain, Terror, Phantasmal Armies, a carried-on battle, discoveries, a land host at sea, and a spell named in
a plan (the commanders cast only what they pick for themselves). A unit case stages those.

**A draw's stage** is read from its call stack, with no mark in `src/`
([the-stages-of-the-two-battles-and-the-lines-that-open-them.ts](the-stages-of-the-two-battles-and-the-lines-that-open-them.ts)).
Each stage (N0 to N13 against the defenders, H0 to H10 between heroes) has an anchor, the text of the line that opens
it, found once in whichever file of the side's own `src/engine/` holds it. A draw belongs to the stage whose anchor is
the last above the line of the innermost frame whose file holds one there. A frame with none above it (a helper such as
the duel, the fates, fortune or a rule's effect, or a function above its file's first anchor) passes the draw to its
caller. So **a split row needs no edit here**: a stage moved into another file keeps its name, and a cut function that
holds three stages' text counts their draws as three stages, as the base does. A draw counts under the stage whose text
holds the code that draws it (a helper nested in a stage is that stage's wherever it is called from). An anchor of two
lines is matched line by line, the indentation aside. A row that rewrites an anchor's own line adds the new text to the
stage's `anchors` (the base still holds the old). A stage a side holds nowhere, or in two places, stops the proof. The
list stays there until each battle's stage list is in `src/` (B-06bl). On B-06ax's base every stage but N2, N10, N11,
H5, H7 and H8 draws on the grid.

**Red on planted faults** (the unit test makes each in a copy of `src/`, finding its text in whichever file holds it,
and fights four cases from the tree and from the copy):

| Made in the copy | What the tool shows |
|---|---|
| Both battles' fortune stages moved, their text as it is, into one new file, each battle calling its own | every case the same (the new file holds N9 and H6) |
| One extra `kcRng()` at the end of the battle between heroes' fortune (H6) | `H6's dice (1 → 2)` in all 8 streams; the battles against the defenders the same |
| The battle between heroes' swing in its statistics record rounded to hundredths (no draw) | only `the turn's context (_tel)`: the lines, the world and the dice the same |
| The army spells and the archery of the battle between heroes swapped (H3, H4) | the lines differ; each draw still counts under its own stage's text |

A plant whose text a later row moves into another file is still found; one whose text a row rewrites stops the test,
naming the plant to update.

**The battle lines the matrix misses** (`npm run proof:coverage` on B-06aw's base): 426 of the 9,773 lines with code in
`src/engine/battle/`; the most in `hosts-gained-in-a-province.ts` (102), `battles-between-heroes.ts` (99),
`battles-against-province-defenders.ts` (83) and `stalled-battles-and-beaten-guards.ts` (70). The list, file by file:
its pull request (#780).

**What it can't see:** a stage no case reaches (above); a value no world keeps and no line says; state beyond one case,
which a fresh process hides by design. Those need unit cases.

## The tests

- `tests/unit/the-matrixs-coverage-lists-the-changed-lines-no-game-reaches.test.ts`
- `tests/unit/a-planted-fault-names-the-games-reports-and-tests-it-changes.test.ts`
- `tests/unit/many-planted-faults-run-several-at-a-time-each-on-its-tests.test.ts`
- `tests/unit/the-gm-logs-compared-names-each-game-whose-log-differs-and-where.test.ts`
- `tests/unit/the-two-engines-compared-runs-each-side-in-its-own-process.test.ts`
- `tests/unit/the-database-call-recorder-writes-each-call-a-page-sends-with-its-steps.test.ts`
- `tests/unit/the-worlds-making-compared-names-each-case-whose-world-or-dice-by-stage-differ.test.ts`
- `tests/unit/the-battles-compared-names-each-staged-battle-whose-lines-world-or-dice-by-stage-differ.test.ts`
