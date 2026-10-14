# R-103: A hero leads at most as many beasts as his Druid level

- **Decided:** 2026-10-12, Toby
- **Status:** Confirmed
- **Source:** PR #75 item 24
- **Enforced by:** [`beast-command`](../../tests/beast-command.test.js)

A hero leads at most as many beasts as his Druid level, checked wherever a beast joins a column (Recruit Armies, Pick Up Army, Leave/Transfer, Wild Calling).

**Open:** The agent's calls, for Toby to confirm: (1) the cap applies in every realm, so a Druid 0 hero of a Druidic or Evil realm leads no beasts (the waiver still spares the strength penalty); (2) heroes already over the cap in running games keep their beasts but take on no more; (3) skeletons, the temporary Awakened Grove, Wild Hunt beasts and phantoms do not count.
