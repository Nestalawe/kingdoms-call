# R-187: A line seen in a province or in a battle names its province

- **Decided:** 2026-11-21, a maintainer
- **Status:** Confirmed
- **Source:** Question 83 of the B-18 scoping (2026-11-21): a line seen in a province or in a battle but with no province, who reads it? Answer: as recommended, none is written: such a line names its province, and where the province may be missing, the line is seen by the world, as the reports read it.
- **Enforced by:** [`the-gate-gives-each-realm-the-lines-it-reads-and-how-each-reaches-it`](../../tests/unit/the-gate-gives-each-realm-the-lines-it-reads-and-how-each-reaches-it.test.ts)

A line seen in a province, or in a battle, always says which province. Code that may not know the province says so:
seen there when it has one, else seen by the world, which is how the reports always read such a line, so no report
changes. Example: a hero falls and his summoned units fade. If he fell in Wendmeadow, the line is seen in Wendmeadow,
by whoever has eyes there; if he fell nowhere on the map, it is told to the whole world.

**Note:** Built in B-18f: the engine's type for a line refuses one seen in a province or in a battle with no province,
and the callers whose province may be missing use `seenThereInItsProvinceElseByTheWorld`
(`src/engine/turn/events-and-their-audiences.ts`). No game wrote such a line before, so no report changed.

In the maintainer's words: "all as recommended"
