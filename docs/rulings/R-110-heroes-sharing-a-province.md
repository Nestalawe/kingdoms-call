# R-110: Another realm's hero beside yours is always seen, and only roughly

- **Decided:** 2026-10-15, Toby
- **Status:** Confirmed
- **Source:** PR #89 item 4 (decision D1 on a player's rulebook review, with two follow-up answers)
- **Enforced by:** [`sight-shared-province`](../../tests/sight-shared-province.test.js), [`intrusion-invisible`](../../tests/intrusion-invisible.test.js), [`intrusion-lurker`](../../tests/intrusion-lurker.test.js), [`heroes-in-sight-and-features-discovered-called-directly`](../../tests/unit/heroes-in-sight-and-features-discovered-called-directly.test.ts)

A player always sees another realm's heroes who share a province with one of their own characters at the
end of the turn. Their Spy skill cannot hide them there. Invisibility still can (only Clairvoyance sees
through it). Wandering heroes and local chieftains keep their chance to slip by unseen: 5% per Spy level,
at most 25%.

Without a Spy, all a player learns of another realm's hero is their name, the realm they serve and the
rough size of the army they lead (a small escort, a modest band, a sizeable host, …), never the exact
count. That holds everywhere, a player's own land included: no race, alignment or skill renown. It is shown
on the map and in the turn report, and the alerts about heroes in a player's land give the same rough size and never report a hero under
Invisibility, nor a lone enemy lurker in a player's land whom the spotting roll missed. The list of heroes
an order can target (Spy, Charm, Encounter, spells) follows the same rule and carries no more than this.

In Toby's words: "A player should always see other players heroes that are sharing the same province as
their own heroes at the end of the turn. They do not see any information about the hero, other than who
controls the hero and how many armies they are leading (not exact numbers, just the rough size). This
information should be shown on the map."
