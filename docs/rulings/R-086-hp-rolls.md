# R-086: Hit-point rolls after a fight

- **Decided:** 2026-10-09, Toby
- **Status:** Confirmed
- **Source:** PRs #11 and #19
- **Enforced by:** [`hp-wound-gain`](../../tests/unit/hp-wound-gain.test.ts)

A hit-point roll after a fight never comes up empty, and the winner gets the roll +1.
