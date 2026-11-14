---
name: making-a-change
description: Use at the start of any work on the repository, before any code: a refactor, a fix, an update of dependencies, an audit, a change to the game (Toby's items, big or small) or an exploration of a proposed change. Works out the kind, writes the plan in one format, stops for a go, then builds, proves, reviews and opens the pull requests.
---

# Making a change

This skill gives the order of the work; every rule is in the doc it links. The kinds and the plan's format:
[making a change](../../../docs/architecture/making-a-change-the-six-kinds-and-the-plans-format.md).

1. **Start clean.** Pull `main` and branch from it. Read [CLAUDE.md](../../../CLAUDE.md)'s reading order. List the
   open PRs: one lane at a time.
2. **Name the kind**: refactor, fix, update, audit, change or exploration
   ([telling them apart](../../../docs/architecture/making-a-change-the-six-kinds-and-the-plans-format.md#telling-the-kinds-apart)).
   Ask only if the request doesn't say. Split a request of two kinds.
3. **Keep private things out.** Pasted reports and live names stay in the session; re-tell them with made-up names
   ([CLAUDE.md](../../../CLAUDE.md#rules), "Never" 4).
4. **Gather**, as the kind's section says: every place first
   ([the search](../../../docs/architecture/where-a-change-goes-from-an-item-in-game-terms-to-the-files.md#find-every-place-first-the-search));
   for a rule, the skill `changing-a-rule-everywhere-it-is-written`; the rulings; the traps by title. If `plan/` is
   there: its Parked list and the questions stored for Toby.
5. **Write the plan** in
   [its seven parts](../../../docs/architecture/making-a-change-the-six-kinds-and-the-plans-format.md#the-plans-format).
6. ⏸ **Stop.** Give the plan and the questions. Build nothing before "go"; in a run, the approved scoping is the go.
7. **Do it** by the kind's rules: a draft PR early; each test first, failing first; a ruling for each of Toby's
   answers.
8. **Prove it** by the kind's proof ([fail first](../../../tests/README.md#proving-it-fails-first)).
9. **Review** with the skill `the-review-before-a-batchs-pull-request`, whatever the kind; fix what it finds.
10. ⏸ **Open the PR, then stop** before marking it ready: the template, playtester notes, the Staging line, and a
    numbered staging list if needed.
11. **After Toby merges:** the `deploy` job succeeded, the live `version.json` names the commit, the playtester notes
    go to Toby; STATUS if `plan/` is there.

## What you give first

The kind, the plan's first two parts and its rows in game terms, and the questions, numbered.
