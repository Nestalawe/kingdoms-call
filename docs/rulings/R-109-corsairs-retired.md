# R-109: The Corsair fleet is gone

- **Decided:** 2026-10-15, a maintainer
- **Status:** Confirmed
- **Source:** PR #89 item 3 (decision D3 on a player's rulebook review)
- **Enforced by:** [`corsairs-retired`](../../tests/corsairs-retired.test.js), [`the-rulebooks-and-the-player-portal-give-each-army-unit-as-the-roster-table-decides`](../../tests/static/the-rulebooks-and-the-player-portal-give-each-army-unit-as-the-roster-table-decides.test.ts)

The Human Corsair Fleet can no longer be raised. New worlds stopped offering it on 2026-10-11. In a game
already running, a province that still offered it offers the Galleon Fleet instead. A Corsair company
already raised is kept and fights as before. No rulebook or page a player reads names the Corsairs any more.

Letters of Marque, the Human discovery that only strengthened Corsairs, now strengthens the Galleon Fleet the
same way: +30% when attacking. A maintainer (2026-10-15): "for now make it affect Galleons instead of Corsairs. We will be
doing a full discoveries review later."

**Note:** A Corsair company already raised loses its two old abilities once [R-147](R-147-old-corsair-companies-fight-as-plain-fleets.md) is built.
