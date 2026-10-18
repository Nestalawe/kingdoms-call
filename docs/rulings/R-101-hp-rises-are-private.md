# R-101: Only your own heroes' HP rises are shown

- **Decided:** 2026-10-12, Toby
- **Status:** Confirmed
- **Source:** PR #75 item 20
- **Enforced by:** [`hp-gain-private`](../../tests/unit/hp-gain-private.test.ts)

A maximum-HP rise in a shared fight report is a line only the hero's own realm reads. A neutral hero's rise is shown to nobody.
