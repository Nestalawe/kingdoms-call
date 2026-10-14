# R-057: Capitals as far apart as the map allows

- **Decided:** 2026-09-27, Toby
- **Status:** Confirmed
- **Source:** DEV_LOG v2026.09.21-1611 §6 (item 6), v2026.09.27-1719 §246 (item 1)
- **Enforced by:** [`home-placement`](../../tests/home-placement.test.js)

There are always at least three provinces between capitals (4 hexes). Beyond that, capitals are placed as far apart and as evenly as the map allows. On the standard map sizes 4 hexes is the most possible; only a small game on a big map spreads further.
