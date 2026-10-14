# R-089: Battle lines: the front, the flanks and the second line

- **Decided:** 2026-10-11, Toby
- **Status:** Confirmed
- **Source:** PR #39 (the army-balance session)
- **Enforced by:** [`battle-grid`](../../tests/battle-grid.test.js), [`battle-lines-report`](../../tests/battle-lines-report.test.js), [`battle-lines-words`](../../tests/battle-lines-words.test.js)

The front's width is rolled per battle by terrain, the same for both sides: plains and desert 6–8, forest and jungle 4–6, mountain 2–4, sea 8–10. Flanks are Tactical+1 cavalry, on plains and desert only. A ranged unit behind a fighter shoots over it at full strength, and fills an empty front place at ×0.75. Winged riders are capped at the enemy's units in line and in the air (never below 2), ×0.5 beyond. At sea the hulls hold the front and there are no flanks.
