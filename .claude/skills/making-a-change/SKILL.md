---
name: making-a-change
description: Use at the start of any work, before any code: a refactor, a fix, an update, an audit, a change to the game (a batch's items), an exploration, building a ruling, or "what's next?". Works out the kind and the size, writes the plan in one format, stops for a go, then builds, proves, reviews and opens the PRs.
---

# Making a change

This skill gives the order; every rule is in the doc it links:
[making a change](../../../docs/architecture/making-a-change-the-six-kinds-and-the-plans-format.md) (the doc).

1. **Start clean.** Pull `main`; read [CLAUDE.md](../../../CLAUDE.md)'s reading order; list the open PRs (one lane).
2. **Name the kind** ([telling them apart](../../../docs/architecture/making-a-change-the-six-kinds-and-the-plans-format.md#telling-the-kinds-apart))
   **and the size:** one PR, or a tranche (a stack of PRs, a row each). Asked "what next?": the top of
   [the backlog](../../../docs/backlog/README.md#the-top-in-order)
   ([finding it](../../../docs/architecture/making-a-change-the-six-kinds-and-the-plans-format.md#finding-the-next-tranche)).
   A new item goes through `ordering-the-backlog` first. Ask only what the request doesn't say; split two kinds.
3. **Keep private things out**: reports, live names, security ([CLAUDE.md](../../../CLAUDE.md#rules), "Never" 4, 5).
4. **Gather** by the kind's section: every place first
   ([the search](../../../docs/architecture/where-a-change-goes-from-an-item-in-game-terms-to-the-files.md#find-every-place-first-the-search)),
   `changing-a-rule-everywhere-it-is-written` for a rule, the rulings, the traps,
   [the questions](../../../docs/questions-for-the-maintainers.md) and [the backlog](../../../docs/backlog/README.md)
   with its `KD-` rows.
5. **Write the plan** in [its seven parts](../../../docs/architecture/making-a-change-the-six-kinds-and-the-plans-format.md#the-plans-format);
   a tranche's adds a line a row ([scoping](../../../docs/architecture/making-a-change-the-six-kinds-and-the-plans-format.md#scoping-a-tranche)).
6. ⏸ **Stop.** The plan and the questions, numbered (options, impact, assessment). Nothing is built before "go".
7. **Build.** One PR: a draft PR early, each test first and failing first. A tranche:
   [as a stack](../../../docs/architecture/making-a-change-the-six-kinds-and-the-plans-format.md#building-a-tranche-as-a-stack),
   each row's agent doing steps 3 to 10 on its brief, from the row before.
8. **Prove it** by the kind's proof ([fail first](../../../tests/README.md#proving-it-fails-first)).
9. **Review** with `the-review-before-a-batchs-pull-request`, whatever the kind; fix what it finds.
10. ⏸ **Open, then stop** before ready: the template, playtester notes, the Staging line (a stack: one list, on its top).
11. **After the merge** (a stack merges as one group): the `deploy` job, the live `version.json`, playtester notes
    to the maintainers; its row leaves the backlog; then step 2 for what is next.
