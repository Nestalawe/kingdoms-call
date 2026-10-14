# R-111: What spying shows

- **Decided:** 2026-10-15, Toby
- **Status:** Confirmed
- **Source:** PR #89 item 5 (decisions D2 and D9 on a player's rulebook review)
- **Enforced by:** [`spy-reveals`](../../tests/spy-reveals.test.js)

**Spying a province** shows every character there and the army units each leads (type and quality), but no
hero's skills. It also shows the characters in every neighbouring province, as a hero of the spying realm
standing there would see them (R-110: name, realm and the rough size of their army; Invisibility still hides,
and wanderers keep their chance to slip by). They appear on the map and in the turn report.

**Spying a hero** standing in the same province shows all their skill levels, the magic items they carry and
the army units they lead, in the turn report. It works the same on a wandering hero or a local chieftain as on
another realm's hero.

In Toby's words: "Spying on a province should also show what army units enemy heroes are leading, but not any
heroes skills. Spying on a hero should show all their skills and magic items they are carrying, as well as what
armies they are leading. This information should be shown in the player report. Spying on a province should also
show all characters in adjacent provinces (as if the player had a hero there)." And: "Yes a player should be able
to Spy on a wandering or neutral hero to see their skills, magic items and armies they are leading as per normal
Spy orders."
