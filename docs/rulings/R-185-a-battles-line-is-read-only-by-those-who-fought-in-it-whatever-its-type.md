# R-185: A battle's line is read only by those who fought in it, whatever kind of line it is

- **Decided:** 2026-11-21, a maintainer
- **Status:** Confirmed
- **Source:** Question 81 of the B-18 scoping (2026-11-21): a line seen in a battle that isn't a combat line, who reads it? Answer: as recommended, only those who fought in the battle, whatever its type.
- **Enforced by:** [`the-gate-gives-each-realm-the-lines-it-reads-and-how-each-reaches-it`](../../tests/unit/the-gate-gives-each-realm-the-lines-it-reads-and-how-each-reaches-it.test.ts)

A line the engine files as seen in a battle is read by the realms that fought in it (they are told), and by no one
else, whatever kind of line it is: a combat line, a system line or any other. Being in the province doesn't let a
realm read it: not its own ground, not a hero of its own standing there, not a spy. Example: Brenvale's host fights
Corrith's in the Ashen Fells, and a line of that battle is filed as a system line. Aldmoor's hero Sir Odran camps in
the Ashen Fells that phase: Aldmoor reads nothing of the line; Brenvale and Corrith both read it. An onlooker's one-line
summary of the battle ([R-138](R-138-an-onlooker-with-a-hero-there-reads-a-battles-one-line-summary.md)) is decided
but not built; this ruling doesn't build it.

**Note:** Built in B-18f: the gate that says which lines each realm reads
(`src/views/the-gate-that-says-which-lines-of-the-turn-each-realm-reads-and-how-each-reaches-it.ts`) reads each line's
audience, not its type. No game wrote such a line before, so no report changed.

In the maintainer's words: "all as recommended"
