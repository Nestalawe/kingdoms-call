# R-102: Terror stacks three times, and Evil realms see it

- **Decided:** 2026-10-12, Toby
- **Status:** Confirmed
- **Source:** PR #75 items 21 and 23
- **Enforced by:** [`terror-visible`](../../tests/terror-visible.test.js), [`terror-three-stacks`](../../tests/terror-three-stacks.test.js)

Terror stacks at most three times on a province (a province holding more in a running game is read as three). Evil realms see each province's Terror: in the map popup, under each of their own provinces, and as a line for a visited province they don't hold. No other crown is told.

**Open:** With the Reign of Terror discovery a stack is −25%, so three stacks are −75%. Did Toby mean the total capped at 30% instead?
