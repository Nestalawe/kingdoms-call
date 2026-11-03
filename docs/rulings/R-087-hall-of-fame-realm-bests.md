# R-087: The Hall of Fame keeps every realm's best

- **Decided:** 2026-10-09, Toby
- **Status:** Confirmed
- **Source:** PR #20 (item 5)
- **Enforced by:** [`leaderboard-realm-bests`](../../tests/leaderboard-realm-bests.test.js), [`a-battle-spell-and-a-hero-fallen-this-turn-reach-the-turns-statistics`](../../tests/unit/a-battle-spell-and-a-hero-fallen-this-turn-reach-the-turns-statistics.test.ts), [`the-gm-page-writes-each-realms-statistics-with-its-battle-spells-and-titles`](../../tests/page/the-gm-page-writes-each-realms-statistics-with-its-battle-spells-and-titles.test.ts)

Each record keeps every realm's own best, not just the game's best. Spells cast in battles and duels count. Fallen heroes, titles held earlier in the game and the full list of finished games are all included.
