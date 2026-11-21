# R-188: A line told to the whole world names no province

- **Decided:** 2026-11-22, a maintainer
- **Status:** Confirmed
- **Source:** Question 85 (2026-11-21): a line told to the whole world that also names a province, who reads it? Answer (2026-11-22): option 3, as recommended: none is written; a line told to the world names no province, and the engine refuses one that does.
- **Enforced by:** [`the-gate-gives-each-realm-the-lines-it-reads-and-how-each-reaches-it`](../../tests/unit/the-gate-gives-each-realm-the-lines-it-reads-and-how-each-reaches-it.test.ts)

A line told to the whole world (a realm concedes, the Reckoning is called, the game is decided) is something every
realm is told, not something that happened in one place, so it names no province. The engine refuses a line told to
the world that names one, as it refuses a line seen in a province that names none
([R-187](R-187-a-line-seen-in-a-province-or-in-a-battle-names-its-province.md)). So a line has one reading: every realm
reads a line told to the world. Example: the crown's price falls, and every realm reads it, Aldmoor, Brenvale and
Corrith alike; the line doesn't say where. News of one province, such as Wendmeadow's harvest failing, is seen there
instead, by whoever has eyes in Wendmeadow.

**Note:** Built in B-18f: the engine's type for a line refuses one told to the world that names a province
(`src/engine/turn/events-and-their-audiences.ts`), and the gate that says which lines each realm reads gives a line told
to the world to every realm. No game wrote such a line before, so no report changed.

In the maintainer's words: "option 3, as recommended"
