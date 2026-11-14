# Making a change: the six kinds and the plan's format

Every piece of work starts with the skill `making-a-change` (type `/making-a-change`). It leads the work through the
same steps whatever its kind. This file says what each kind is, what differs between them, and the one format every
plan takes. The rules themselves are in [CLAUDE.md](../../CLAUDE.md#rules) and the docs it links; this file points to
them and doesn't restate them.

## The six kinds

| Kind | What it is | Example | Branch and PR title |
|---|---|---|---|
| **Refactor** | The game stays the same; the code changes for a purpose | Today's alignment rules moved into one registry family | A plan step's (`p1-25e-…`, `[P1-25e] …`) or `refactor/<what>`; label `refactor-only` |
| **Fix** | A defect mended: the game doesn't do what its rules and rulings say | A beaten fleet's companies are in two places at once | `fix/<what>`; a batch item if it came in a batch |
| **Update** | Dependencies across the stack brought up to date | Vite, Playwright, the Node pin, the Supabase CLI, a GitHub action | `update/<what>` |
| **Audit** | The docs, rules and tests worked through, so that every claim is consistent and tested | Both rulebooks' numbers checked against the content rows | `audit/<what>` (only if the audit itself writes a file) |
| **Change** | An update to the game, big or small | Toby's batch: a number, a new order, a reworded report line | `batch/YYYY-MM-DD`, `Batch YYYY-MM-DD: <a few items>` |
| **Exploration** | A proposed change worked through: its impact and its options | Toby's new alignment abilities, before any is built | `explore/<what>`, never merged; its write-up in `docs/explorations/` |

### Telling the kinds apart

1. **Will a player notice anything?** No: a refactor, an update or an audit. Yes: a fix or a change.
2. **A fix or a change?** A fix makes the game do what a rule or ruling already says. A change alters the rule. If the
   rule is unclear, or two copies of it disagree, it is a question for Toby first
   ([CLAUDE.md](../../CLAUDE.md#rules), "Design forks go to Toby"); his answer makes it a fix or a change.
3. **Is the outcome a decision rather than code on `main`?** Then it is an exploration. Its chosen option becomes a
   change.
4. **A request of two kinds is split** ([CLAUDE.md](../../CLAUDE.md#rules), "One concern per PR"). A bug found during a
   refactor becomes its own fix. A refactor that an exploration needs first becomes its own refactor.

## The plan's format

Every plan, of every kind, has these seven parts in this order. Write the first two and the questions in game terms
for Toby; the rest can be technical.

```text
1. Kind and purpose      One line each: which kind, and what it is for.
2. What stays the same   What must not change (below, by kind).
3. The rows              One row per item (below).
4. Questions             Numbered; each with options, a recommendation and a short example from the game.
5. Proof                 How we will know it is done: the checks and what each must show.
6. The pull requests     How it splits; each PR's branch, title, labels, and who must look (Theo, dangerous paths).
7. After                 What happens once each PR is merged.
```

**A row** says:
- what the item is, in game terms;
- every place it lives: files, both rulebooks, report words, hints, content rows
  ([the search](where-a-change-goes-from-an-item-in-game-terms-to-the-files.md#find-every-place-first-the-search));
- the rulings it meets, and the traps of its areas, by title ([docs/traps.md](../traps.md));
- its test: the level, why a lower level won't do, and how it fails first
  ([tests/README.md](../../tests/README.md#the-levels));
- whether the save's shape changes ([the save](a-saved-game-its-version-its-upgrade-its-check.md));
- whether the database changes (if so, its own PR first, with Theo:
  [supabase/README.md](../../supabase/README.md#the-rules-every-database-change-follows));
- staging: needed or not, and why ([docs/staging.md](../staging.md#when-a-change-needs-staging));
- for a fix or a change, what changes in play, predicted now.

## By kind

### Refactor

- **Stays the same:** everything a player sees, and every seeded game: the balance baseline doesn't move.
- **Gather:** the purpose (what the move makes possible), the code and tests it moves, the ratchet's counts it lowers.
- **Do:** label `refactor-only`; no behaviour change, however small. A defect found on the way is parked and becomes
  a fix.
- **Prove:** new tests pass both before and after; CI's balance check agrees "no change".

### Fix

- **Stays the same:** everything but the defect.
- **Gather:** the defect, retold with made-up names; the rulings (is it really a defect, or deliberate?); every copy
  of the rule ([A rule written twice must change twice](../traps.md#a-rule-written-twice-must-change-twice)).
- **Do:** first a test at the lowest level that would have caught it, failing on `main`; then the fix.
- **Prove:** that test fails before and passes after; the balance report if the engine changes. A security fix gets a
  neutral title and description ([CLAUDE.md](../../CLAUDE.md#rules), "Never" 5).

### Update

- **Stays the same:** what the game does and how it looks; the balance baseline.
- **Gather:** what moves, from which version to which; the changelogs' breaking changes; what in the repo uses it.
- **Do:** one tool, or one group of tools that move together, a PR. `package.json`, the lockfile, `.nvmrc` and
  `.github/` are dangerous paths: Theo looks.
- **Prove:** `npm test`, `npx playwright test` and the access-rule tests, all green; the balance baseline doesn't move.

### Audit

- **Stays the same:** everything. The audit writes findings, not code.
- **Gather:** the scope (which docs, rules or area) and what each claim in it is checked against: the code, a content
  row, a test.
- **Do:** check every claim. Each finding names its doc and line, the code or row it disagrees with, and how it was
  checked.
- **Prove:** the list is complete for its scope: every claim checked, or named as not checked.
- **Output:** the findings, each becoming a fix, a refactor, or a question for Toby. A claim no test checks becomes a
  test (a fix, if the test fails).

### Change

- **Stays the same:** everything the items don't name.
- **Gather:** the items in game terms; every place each rule is written (the skill
  `changing-a-rule-everywhere-it-is-written`); the rulings each meets.
- **Do:** one PR a batch, one commit an item ([CLAUDE.md](../../CLAUDE.md#how-work-arrives)); each item's test first,
  failing; a ruling for each of Toby's answers ([adding a ruling](../rulings/README.md#adding-a-ruling)). An item
  that isn't ready is split out.
- **Prove:** each test fails first; "What changes in play" predicted, then written from the balance report; staging
  when needed.

### Exploration

- **Stays the same:** `main`. An exploration's branch is never merged.
- **Gather:** the proposal as Toby wrote it; the rules it touches today; how each option will be measured (the bot
  matrix, hand-played games) and against what targets.
- **Do:** branch from current `main`, and start again from `main` rather than let the branch fall far behind. Keep a
  list of **every rule the branch changes**, including any the proposal doesn't mention, as each change is made: the
  measurements hold only for the rules as built.
- **Prove:** the measurements, each with the rules it was measured with.
- **Output:** a write-up in `docs/explorations/<name>.md`, in a docs-only PR, so that the change starts from `main`
  ([what it holds](../explorations/README.md)). The chosen option is then built as a change.

## The two stops

The skill stops twice for a person:
1. **After the plan.** Nothing is built before "go". In a run, the scoping Theo approved is that go; a new question
   found during the run is stored for Toby, not decided.
2. **Before a PR is marked ready.** Staging, if needed, comes with a numbered list Toby can follow.

Nobody but Toby merges ([CLAUDE.md](../../CLAUDE.md#rules), "Never" 1).
