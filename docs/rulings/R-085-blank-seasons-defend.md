# R-085: Blank seasons count as Defend

- **Decided:** 2026-10-09, Toby
- **Status:** Confirmed
- **Source:** PR #11
- **Enforced by:** [`before-the-first-phase-in-a-whole-turn`](../../tests/scenario/before-the-first-phase-in-a-whole-turn.test.ts) (a blank season is Defend), [`defend-watches`](../../tests/unit/defend-watches.test.ts) (a sprung ambush ends the watch)

A season with no order counts as Defend. A sprung ambush ends a lone hero's watch.
