---
name: changing-a-rule-everywhere-it-is-written
description: Use when an item changes a rule of the game, a number or the words players read about it (a spell, unit, item, perk, order, battle, title, report line). Finds every place the rule is written (engine, player portal, content rows, both rulebooks, hints, report words, tests, rulings) before the first edit, and changes them together.
---

# Changing a rule everywhere it is written

A rule is often written in more than one place
([A rule written twice must change twice](../../../docs/traps.md#a-rule-written-twice-must-change-twice)). Find them
all before you change one.

## 1. Find every copy, and list them

1. [The search](../../../docs/architecture/where-a-change-goes-from-an-item-in-game-terms-to-the-files.md#find-every-place-first-the-search):
   the rulings, the list of tests, the content's key, its nouns, its numbers (old and new), the function and its
   callers.
2. The player portal's copies still left: `tests/lib/player-portal-copies.ts`.
3. Write the list down, a line a place, before the first edit.

## 2. Change each in its own way

- **A content effect:** its row in `src/content/` and its registry's entry, never a check of its name in a resolver
  ([the guardrails](../../../docs/ARCHITECTURE.md#the-codes-guardrails);
  [the rule registry](../../../docs/architecture/the-rule-registry-and-the-one-source-for-shared-rules.md#the-rule-registry)).
- **A rule the player portal shares:**
  [the one source](../../../docs/architecture/the-rule-registry-and-the-one-source-for-shared-rules.md#kingdoms-call-datats-the-one-source-for-shared-rules).
- **The words players read:**
  [the rulebooks' words](../../../docs/architecture/where-a-change-goes-from-an-item-in-game-terms-to-the-files.md#the-rulebooks-words),
  and the report's ([a line of the turn](../../../docs/architecture/a-line-of-the-turn-emit-its-facts-and-the-reports.md)).
  Search `tests/` for the old words: a test may pin them.
- **A game already running:** [Live saves keep copies](../../../docs/traps.md#live-saves-keep-copies).
- **The ruling:** read it before you change its rule; a new one gets its file and index row
  ([Adding a ruling](../../../docs/rulings/README.md#adding-a-ruling)).

## 3. Two copies that disagree

If two copies say different things and no ruling settles it, stop and ask Toby
([CLAUDE.md](../../../CLAUDE.md#rules), "Design forks go to Toby"): both readings as options, a recommendation, an
example. Leave both copies as they are; never a switch or a parameter that keeps both.

## 4. Before you commit

Search the old numbers and words again: nothing left but what the list meant to keep. An engine change carries its
balance report ([CLAUDE.md](../../../CLAUDE.md#rules)).
