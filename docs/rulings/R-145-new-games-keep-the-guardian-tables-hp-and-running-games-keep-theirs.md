# R-145: New games' guardians have the guardian table's HP; running games keep theirs

- **Decided:** 2026-10-31, a maintainer
- **Status:** Confirmed
- **Source:** Questions 17 (2026-10-31) and 31 (2026-11-02): do new games' guardians have the guardian table's HP, and what happens to the games started since 14 October? Answer: option 1 to both: new games keep the table's HP, and running games stay as they are. Question 161 (2026-11-27): does a game made before the fix keep the table's HP on its first turn? Answer: option 1, it is cut by 5 HP on its first turn, as built; a maintainer's answer, 27 November.
- **Enforced by:** [`new-games-guardians-have-the-guardian-tables-hp-and-running-games-keep-theirs`](../../tests/unit/new-games-guardians-have-the-guardian-tables-hp-and-running-games-keep-theirs.test.ts)

A new game's guardians have the hit points the guardian table gives them
([R-072](R-072-guardian-strength.md)). Games already running keep their guardians as they are until they end, even
where they stand 5 HP below the table. Example: in a game started on 20 October the Dracolich of Ashfall Barrow has
49 HP and keeps it; in a game started once the fix is live it has 54, as the table says. The 5 HP cut was meant
once, for the games running on 15 September.

A game made before the fix whose first turn runs after it is cut by 5 HP on that first turn, as before the fix.

The questions were: question 17, new games' guardians are 5 HP weaker than the table (option 1: "new games keep the
table's HP"); question 31 (2026-11-02), what happens to the games started since 14 October (option 1: "leave running
games as they are").

In the maintainer's words: "(1)"
