# R-186: A line seen in a province is read by whoever has eyes there, whatever kind of line it is

- **Decided:** 2026-11-21, a maintainer
- **Status:** Confirmed
- **Source:** Question 82 of the B-18 scoping (2026-11-21): a line seen in a province that is a combat line, who reads it? Answer: as recommended, whoever has eyes there, whatever its type.
- **Enforced by:** [`the-gate-gives-each-realm-the-lines-it-reads-and-how-each-reaches-it`](../../tests/unit/the-gate-gives-each-realm-the-lines-it-reads-and-how-each-reaches-it.test.ts)

A line the engine files as seen in a province is read by every realm with eyes there at its phase: the province is its
own, a hero of its own stands there that phase, or it spied the province that phase or earlier. The kind of line
(combat or any other) only says where the report shows it, never who reads it. Example: a line filed as a combat line
is seen in Wendmeadow in Summer. Aldmoor holds Wendmeadow, and Corrith's hero Lord Taveth stands there in Summer: both
realms read it. Brenvale, with no eyes there, reads nothing of it.

**Note:** Built in B-18f: the gate that says which lines each realm reads
(`src/views/the-gate-that-says-which-lines-of-the-turn-each-realm-reads-and-how-each-reaches-it.ts`) reads each line's
audience, not its type. No game wrote such a line before, so no report changed.

In the maintainer's words: "all as recommended"
