# R-087: The Hall of Fame keeps every realm's best

- **Decided:** 2026-10-09, a maintainer
- **Status:** Confirmed
- **Source:** PR #20 (item 5)
- **Enforced by:** [`the-hall-of-fame-builds-and-writes-each-record-on-the-values-handed-it`](../../tests/unit/the-hall-of-fame-builds-and-writes-each-record-on-the-values-handed-it.test.ts), [`the-hall-of-fames-page-renders-every-tab-from-records-the-builder-made`](../../tests/page/the-hall-of-fames-page-renders-every-tab-from-records-the-builder-made.test.ts), [`a-battle-spell-and-a-hero-fallen-this-turn-reach-the-turns-statistics`](../../tests/unit/a-battle-spell-and-a-hero-fallen-this-turn-reach-the-turns-statistics.test.ts), [`the-gm-page-writes-each-realms-statistics-with-its-battle-spells-and-titles`](../../tests/page/the-gm-page-writes-each-realms-statistics-with-its-battle-spells-and-titles.test.ts)

Each record keeps every realm's own best, not just the game's best. Spells cast in battles and duels count. Fallen heroes, titles held earlier in the game and the full list of finished games are all included.
