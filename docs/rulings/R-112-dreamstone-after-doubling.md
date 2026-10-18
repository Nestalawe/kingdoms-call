# R-112: The Dreamstone's round comes after Psychic Blast's doubling

- **Decided:** 2026-10-15, Toby
- **Status:** Confirmed
- **Source:** PR #89 item 6 (decision D4 on a player's rulebook review)
- **Enforced by:** [`blast-dreamstone`](../../tests/unit/blast-dreamstone.test.ts)

In personal combat Psychic Blast holds its target helpless for 1 round plus 1 for every two Psychic levels,
doubled against a guardian weak to Psychic magic. The Dreamstone then adds one round; that round is not
doubled. At Psychic 5 with the Dreamstone, a weak guardian is held 7 rounds (3 doubled, plus 1), not 8.
