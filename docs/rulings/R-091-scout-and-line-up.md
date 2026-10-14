# R-091: The scout's advantage and the line-up

- **Decided:** 2026-10-11, Toby
- **Status:** Confirmed
- **Source:** PR #42; PR #75 item 18 (2026-10-13)
- **Enforced by:** [`battle-scout`](../../tests/battle-scout.test.js), [`battle-fronts-meet`](../../tests/battle-fronts-meet.test.js), [`battle-lines-words`](../../tests/battle-lines-words.test.js)

The better-explored side scouts (ties go to the defender, even against the province's owner). It picks the front's width from the roll or one either side, and lines up second. Then the commanders take turns rearranging, one swap per Tactical level, the non-scout first. The two front lines always face each other: a swap is allowed only while the narrower front stands wholly opposite the wider one (no sliding a whole front sideways).
