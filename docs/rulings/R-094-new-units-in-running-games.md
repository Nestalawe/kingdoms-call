# R-094: New units reach running games through capitals only

- **Decided:** 2026-10-11, Toby
- **Status:** Confirmed
- **Source:** PR #46
- **Enforced by:** [`roster`](../../tests/roster.test.js)

When new units are added, a running game's capitals gain them at the next turn; other provinces keep the recruit pools they were generated with. Only worlds generated afterwards offer them elsewhere.

In Toby's words: “Option 1 is fine, leave it capitals only.”
