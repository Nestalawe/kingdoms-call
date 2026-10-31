# R-117: Only your own realm reads your hero's maximum-HP rise outside a fight

- **Decided:** 2026-10-31, Toby
- **Status:** Confirmed
- **Source:** Plan question 9, built in PR #316
- **Enforced by:** [`hp-gain-private`](../../tests/unit/hp-gain-private.test.ts), [`stalled-battles-unit-gain-and-war-fronts`](../../tests/unit/stalled-battles-unit-gain-and-war-fronts.test.ts), [`report-leaks`](../../tests/unit/report-leaks.test.ts)

When a hero's maximum HP rises outside a fight (an item picked up, bought or given, a title, a discovery), the line
"<hero>'s maximum HP rises by N to M (current HP H)" is told to his own realm alone, wherever he stands, or if he
stands nowhere. No other realm reads it, even one with a hero in the same province or owning it. This extends R-101
(a rise in a fight) to every rise, wherever it comes from. A watcher with Clairvoyance still reads it, as it reads
everything that happens to the hero it watches.

The question was: Sir Aldric picks up a Girdle of Giants in Wendmeadow and his maximum HP rises from 18 to 22. Does
every realm with eyes in Wendmeadow read it, or only his own? Option 1, "His own realm alone reads it, wherever it
comes from", matching R-101's "only your own heroes' HP rises are shown".

In Toby's words: "(1)"
