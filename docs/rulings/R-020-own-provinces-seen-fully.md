# R-020: A realm sees its own provinces fully

- **Decided:** 2026-09-21, Toby
- **Status:** Confirmed
- **Source:** DEV_LOG v2026.09.21-1033 §5 (item 5)
- **Enforced by:** [`heroes-in-sight-and-features-discovered-called-directly`](../../tests/unit/heroes-in-sight-and-features-discovered-called-directly.test.ts)

A lone enemy hero (no column) in a province you own is found at 95 / 80 / 60 / 40 / 25 / 25% against his Spy 0–5, plus 10% per level of your best Spy standing there, and never below 25%: nobody hides in another realm's land for ever. A column is always seen. Shimmer still halves the chance.

**Open:** The 25% floor was a first cut. If master spies feel too easy to corner, lower it.
