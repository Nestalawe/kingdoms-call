# R-191: The Philosopher's Stone's text says the skeletal companies are left out

- **Decided:** 2026-11-27, a maintainer
- **Status:** Confirmed
- **Source:** A maintainer's answer to #847's review, 27 November: the Stone's text says the undead (skeletal
  companies) are not promoted, as the game does.
- **Enforced by:** [`the-philosophers-stones-text-says-the-skeletal-companies-are-left-out`](../../tests/unit/the-philosophers-stones-text-says-the-skeletal-companies-are-left-out.test.ts)

Worked with a Use Item order, the Philosopher's Stone raises every company of its realm one quality tier, led or in a
garrison, but a skeletal company, which stays as it is. The Stone's description and its lore say so, and so does the
line a realm reads when the Stone finds nothing to raise. Example: King Aldric leads two Green Men-at-Arms and a Green
company of risen dead. He works the Stone: the Men-at-Arms rise to Average, and the skeletal company stays Green. A
realm whose only companies are skeletal reads that it has no living armies, and keeps the Stone.

**Open:** a Stone already in a running game keeps the words it was found with (question 167).
