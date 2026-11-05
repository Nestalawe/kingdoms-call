---
name: taking-in-a-batch-of-tobys-items
description: Use when Toby sends a batch of numbered items in game terms (a rule, a number, a fix, sometimes a pasted battle report), before any code. Turns the batch into a plan with a row per item and the questions for Toby, then the branch, a commit an item and the pull request.
---

# Taking in a batch of Toby's items

This skill gives the order of the work; every rule is in the doc it links. Read [CLAUDE.md](../../../CLAUDE.md) first.

## 1. Keep his words in the session

His pasted reports, dispatches and live names never reach a commit, a test or the PR
([CLAUDE.md](../../../CLAUDE.md#rules), "Never" 4). Re-tell each item with made-up names.

## 2. A plan, a row per item, before any code

For each item, first find every place it lives
([the search](../../../docs/architecture/where-a-change-goes-from-an-item-in-game-terms-to-the-files.md#find-every-place-first-the-search)),
then fill its row:

| The row says | Where to find it |
|---|---|
| Its kind, area, folders and files | [By kind of change](../../../docs/architecture/where-a-change-goes-from-an-item-in-game-terms-to-the-files.md#by-kind-of-change) |
| The rulings it meets | the index, `docs/rulings/README.md`, searched; each ruling's own file read |
| The traps, by title | [docs/traps.md](../../../docs/traps.md) |
| Every place the rule is written, both rulebooks too | the skill `changing-a-rule-everywhere-it-is-written` |
| Its test: level, why not lower, how it fails first | [tests/README.md](../../../tests/README.md#the-levels) |
| Staging: needed or not, and why | [docs/staging.md](../../../docs/staging.md#when-a-change-needs-staging) |
| What changes in play, predicted now | [the template](../../../.github/pull_request_template.md) |
| The save's shape, if it changes | [CLAUDE.md](../../../CLAUDE.md#rules) |

## 3. Questions, never guesses

An item that reads two ways, goes against a ruling, or meets two copies of a rule that disagree is a question for
Toby ([CLAUDE.md](../../../CLAUDE.md#rules), "Design forks go to Toby"). Split that item out and build the rest
([How work arrives](../../../CLAUDE.md#how-work-arrives)).

## 4. Then build

- The branch, a commit an item, the PR's title: [How work arrives](../../../CLAUDE.md#how-work-arrives).
- Each item: its test first and failing, then every place in its row.
- A ruling Toby gives: its file and index row ([Adding a ruling](../../../docs/rulings/README.md#adding-a-ruling)).
- Before the PR: the skill `the-review-before-a-batchs-pull-request`.

## What you give Toby first

The plan's rows in game terms, and the questions, numbered, each with its options, a recommendation and a short
example from the game.
