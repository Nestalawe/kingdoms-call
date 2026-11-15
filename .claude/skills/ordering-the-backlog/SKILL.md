---
name: ordering-the-backlog
description: Use when a new item joins the backlog (a batch's item, a known defect, a ruling to build, a step), when a row's place is in doubt, or when asked to reorder it. Describes the item's impact, compares it with the rows around where it would go, proposes a position with one line of reasoning, stops for a maintainer, and records the position in the PR.
---

# Ordering the backlog

What comes next is the top of [the backlog](../../../docs/backlog/README.md). A row's place comes from its impact, and
a maintainer validates it. The how, with an example:
[ordering the backlog by impact](../../../docs/ways-of-working/ordering-the-backlog-by-impact.md).

1. **Describe the impact** in one line
   ([its parts](../../../docs/ways-of-working/ordering-the-backlog-by-impact.md#1-describe-the-items-impact)): who
   notices, what changes in play or for the maintainers, what it unblocks, the risk of waiting. Game logic in plain
   words; never how a gap could be used ([CLAUDE.md](../../../CLAUDE.md#rules), "Never" 5).
2. **Find where it would go:** the top, Next, Later, or Not yet assessed
   ([how to read a row](../../../docs/backlog/README.md#how-to-read-a-row)). Read its rulings, its open questions
   and any `KD-` row that is the same defect.
3. **Compare it with its neighbours,** the rows just above and below. When nothing else decides: harm in live play
   first, then what unblocks the most rows, then the maintainers' time, then tidying.
4. **Propose a position** with one line of reasoning (the "Why here" of the top).
5. ⏸ **Stop for a maintainer.** Work on the item starts only once its place is validated.
6. **Record the position** in the PR that adds or moves the row: the row, its place and its reasoning line.

One lane stays: one piece of work open against `main` at a time. There are no other order rules.
