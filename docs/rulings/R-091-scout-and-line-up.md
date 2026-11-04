# R-091: The scout's advantage and the line-up

- **Decided:** 2026-10-11, Toby
- **Status:** Confirmed
- **Source:** PR #42; PR #75 item 18 (2026-10-13)
- **Enforced by:** [`the-better-explored-side-scouts-chooses-the-front-and-lines-up-second-then-each-side-shifts-by-tactical`](../../tests/unit/the-better-explored-side-scouts-chooses-the-front-and-lines-up-second-then-each-side-shifts-by-tactical.test.ts), [`the-two-front-lines-always-face-each-other-whatever-the-line-up`](../../tests/unit/the-two-front-lines-always-face-each-other-whatever-the-line-up.test.ts), [`the-books-give-the-battle-lines-the-engines-fronts-facings-and-line-up`](../../tests/static/the-books-give-the-battle-lines-the-engines-fronts-facings-and-line-up.test.ts)

The better-explored side scouts (ties go to the defender, even against the province's owner). It picks the front's width from the roll or one either side, and lines up second. Then the commanders take turns rearranging, one swap per Tactical level, the non-scout first. The two front lines always face each other: a swap is allowed only while the narrower front stands wholly opposite the wider one (no sliding a whole front sideways).
