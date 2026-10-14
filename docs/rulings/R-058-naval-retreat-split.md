# R-058: A beaten army with ships splits its retreat

- **Decided:** 2026-09-27, Toby
- **Status:** Confirmed
- **Source:** DEV_LOG v2026.09.27-1719 §248, §263
- **Enforced by:** [`naval-retreat`](../../tests/naval-retreat.test.js)

A beaten army with ships on a coastal province makes for friendly water with as many land and flying units as the ships can carry, and the hero goes with it. Leftovers fall back to the realm's own adjacent land if there is any, else stay and fight. Ships with no water to reach stay and fight. With no friendly water but friendly land, the hero and land units march while the ships stay. Leaderless units left on ground the realm does not hold scatter as mercenaries (ruled correct, 2026-09-27).

In Toby's words: “a beaten army with ships on a coastal shore makes for friendly water with as many land (and flying) units as it can carry and the hero goes with it; the leftovers fall back to friendly land if there is any, else stay and fight; ships with no water to reach stay and fight; and with no friendly water but friendly land, the hero and the land units march while the ships stay.”
