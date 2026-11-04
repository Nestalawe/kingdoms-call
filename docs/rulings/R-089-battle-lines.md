# R-089: Battle lines: the front, the flanks and the second line

- **Decided:** 2026-10-11, Toby
- **Status:** Confirmed
- **Source:** PR #39 (the army-balance session)
- **Enforced by:** [`the-battle-grid-places-each-unit-by-its-role-in-the-front-the-lines-behind-the-flanks-and-the-air`](../../tests/unit/the-battle-grid-places-each-unit-by-its-role-in-the-front-the-lines-behind-the-flanks-and-the-air.test.ts), [`both-battles-report-the-front-the-grid-the-ladder-and-the-scout`](../../tests/unit/both-battles-report-the-front-the-grid-the-ladder-and-the-scout.test.ts), [`the-books-give-the-battle-lines-the-engines-fronts-facings-and-line-up`](../../tests/static/the-books-give-the-battle-lines-the-engines-fronts-facings-and-line-up.test.ts)

The front's width is rolled per battle by terrain, the same for both sides: plains and desert 6–8, forest and jungle 4–6, mountain 2–4, sea 8–10. Flanks are Tactical+1 cavalry, on plains and desert only. A ranged unit behind a fighter shoots over it at full strength, and fills an empty front place at ×0.75. Winged riders are capped at the enemy's units in line and in the air (never below 2), ×0.5 beyond. At sea the hulls hold the front and there are no flanks.
