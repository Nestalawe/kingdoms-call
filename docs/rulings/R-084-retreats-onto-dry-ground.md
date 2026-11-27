# R-084: Retreats never into a flood

- **Decided:** 2026-10-09, a maintainer
- **Status:** Confirmed
- **Source:** PRs #11 and #19
- **Enforced by:** [`retreat-dry-ground`](../../tests/unit/retreat-dry-ground.test.ts)

A retreating army never falls back into a flooded province, and onto parted sea only as a last resort.

**Open:** while a flooded province lies parted, the Flood's mark stays until the turn's end, as built, so no
beaten army retreats there (question 171).
