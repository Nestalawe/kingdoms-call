# g20 report: ten realms, round-25 kits, seed 2020, hostile, 20 turns

Undead (Orcish), Evil (Dwarven), Pagan (Elven), Divine (Human), Good (Human), Neutral (Dwarven), Druidic (Elven), Pagan (Human), Druidic (Orcish), Evil (Elven). Every realm hand-played by me for all 20 turns (turns 19 and 20 short: the Undead and Good kings acted, everyone else held). Harness: additive scratch helpers only (`mk20.py`, `o20.sh`, `c20.py`, `s20.py`, `share20.py`); nothing under `src/` changed. One harness slip: my compact form split `Type|qty` into phases on turn 1, so turn-1 recruiting was one company per realm (fixed from turn 2 with `Type#qty`).

## Result

| Realm | End of turn 10: provinces / share of tax / gold | End of turn 20: provinces / share / gold / companies |
|---|---|---|
| Divine | 14 / 9% / 215g | **18 / 12% / 748g / 15** |
| Druidic (Orcish) | 15 / 10% / 54g | **19 / 12% / 0g / 28** |
| Pagan (Elven) | 8 / 8% / 137g | 11 / 11% / 153g / 20 |
| Undead | 9 / 7% / 177g | 14 / 10% / 580g / 26 |
| Druidic (Elven) | 12 / 9% / 146g | 12 / 9% / 123g / 21 |
| Good | 10 / 6% / 128g | 7 / 5% / 187g / 14 |
| Neutral | 7 / 4% / 101g | 8 / 5% / 120g / 16 |
| Pagan (Human) | 2 / 3% / 5g | 2 / 3% / 14g / 6 |
| Evil (Dwarven) | 6 / 3% / 13g | 2 / 1% / 11g / 0 |
| Evil (Elven) | 0 (wiped out turn 9) | 0 |

**Winner: Divine**, level with the Orcish Druids on tax share (12%) and far ahead on gold. The Undead had the strongest army and took four Good provinces in the last four turns, but broke three times on the Good capital. Both Evil realms were destroyed or reduced to two provinces. No realm was near the Reckoning at turn 20.

## Each alignment and its round-25 change

**Undead.** Necromancers cross-trained from turn 1 reached Necromancy 4 by turn 2 and 5 to 6 later; they raised three skeletons a cast at the capital barrow (two barrows held by turn 2). The king (Necromancy 1) fizzled most casts, as expected. *Skeletons at 1g for two* is a large change: the Undead paid 6 to 17g of wages for 15 to 26 companies and ended with 580g unspent. Bind to Crack held: by turn 13 the whole host was Crack and binding cost little. Blight paid grave goods. Defeats: Ashfell (a woken-stones capital) once, Fairhold twice, Redvale three times; wins: Dunsridge, Dunsfield, then Fairhold, Feralfen, Mordrift on turns 16 to 17. Mistakes as a player: skeletons left in a garrison crumble at turn's end (I lost seven that way); two friendly hosts must be merged by leave/pickup or they fight separately.

**Divine.** Consecrate, Tithes and a Proclaimed Crusade on Evil: the Evil capital fell on turn 6, consecrated at once, and Evil R9 was wiped out by turn 9. *Three consecrations a point:* Power 1 (a holy site) → 2 → 4 under the Crusade → 3 after it → 4 again with 11 consecrations. The new report line works ("Divine Power rises to 4 … gifts: Sanctuary, Grace abounding, Revelation, Pilgrim roads"). The Sanctuary heal never fired (no Divine hero ended a turn hurt on consecrated ground) and the other gifts did nothing visible. Divine never met a second enemy and ended with 748g it had no use for.

**Good.** The Villages (+3 on tax ≤4, +2 on tax 5) and the Beacons carried it. The Beacons were lit five times: twice in time to save something (Fairhold held against 23 Undead companies on turn 13; the capital held against the Undead on turns 17 and 19 together with four pressed levies, 52g). Each muster went home with a line. *Knights errant at Tactical 5:* the king reached Tactical 6 by turn 7 and stayed there; no longer a runaway. Good lost to Evil's Dark-Pact Hydras early (turn 8) and to the Undead late.

**Evil (both).** *Dark Pact without a monster province* works: King1 pacted Cave Trolls (12g, double price) on turn 2 and Elven Evil the same on turn 3; once King1 held Savagewood the Hydras cost the normal 12g and drew half wages. King1 then won three battles in a row against Good with three Hydras. It did not save Evil: Evil R9's capital fell to a Divine Crusade on turn 6 (wages had already disbanded its trolls), and Druid R8 took Evil R1's capital on turn 9 while its king was away. Spread Dread laid 3 stacks of Terror on turn 1 (the brief says it never raises a province above 1). Evil's altar promotion never fired (Evil never took consecrated land).

**Pagan (both).** R2 woke five stones (Favour ×1.5), stormed the Druid king's host (8g, 1 destroyed and 4 demoted) and broke it, then lost its king to a king-on-king chase I ordered. R7 lost its king to a duel on turn 3, then *defended* well: its storm destroyed 4 of the Undead companies massing next door (seen thanks to the new sight rule), and its woken-stones capital broke a 15-company Undead assault. At 8g the storm was cast four times in 20 turns, each time decisively.

**Druidic (both).** The Orcish Druids took creature provinces fast (Stone Giants, Thunderbirds, Great Bears submitting), ran wages above income from turn 5 and stayed at 0 to 60g, yet ended joint first by taking the Evil capital and three Evil provinces. The Elven Druids grew Horndune into jungle (8g), held Hightangle, killed the Pagan king in a chase, and made peace.

**Neutral.** Trade Pacts: Kazhold (14g), Bloodrot bought from the Druids at peace (11g), Woldexpanse (22g). *The new refusal reasons work*: "Grimglade is a creature or monster province: beasts take no coin." Guild Halls (Dwarven units 3g cheaper) made pressed levies cost 1 to 2g. Research with a Sage 9 was the realm's real engine. Hemmed in by sea, it declared on the Druids and lost twice at Grimglade (forest ×1.5). **Ransom was set but never fired**: an Encounter on a hero leading a host became an ordinary battle.

## The new sight rule
It mattered. The Evil R9 king saw the Divine host beside his capital and went home (too late; his garrison was 2 levies). Pagan R7 saw the Undead hosts at Brokenwells and stormed them the turn before they attacked. Good saw the Evil band at Elderdelve and lit the Beacons. Walk-ins still happened where a capital had no garrison and the king was away (Evil R1's capital to the Druids), but every one of them was now a choice the defender could see coming.

## Report and order problems (new)
1. Skeletons left in a garrison crumble at turn's end with no warning on the leave_army order (seven lost).
2. Two friendly hosts entering one province in one phase still fight separately; merging needs leave_army then pickup_army across phases.
3. A king-on-king Encounter killed the attacker (Melee 3 v Melee 3); nothing warns that a chase ends in a duel to the death.
4. Spread Dread laid 3 stacks on turn 1 (Redwood, Dunsmeadow "Terror 30%"), contrary to the one-stack rule.
5. A recruit order's pressed levy is reported well ("3× … 1 a pressed levy, at twice the price"), but the order form does not say the third company exists.
6. An Encounter by a Neutral hero with the Ransom plan on a hero leading armies became a host battle with no line about Ransom.
7. A peace overture is reported "unanswered this year" in the same turn it is sent.
8. A hero-led move into an unseen sea hex ("cannot put to sea") cost the Divine and Neutral kings a phase each.

## Three balance observations
1. **The Undead are too rich now.** Skeletons at 1g for two plus Grave Goods left 580g unspent with 26 companies. Keep 1g a skeleton but let the Host-Leader discount stop counting skeletons, or skeletons at 1g for two only while the realm holds fewer than 15 of them.
2. **Treasuries still pile up.** Divine 748g, Undead 580g. The pressed levy was used by every rich realm (about 200g in all) and saved the Good capital, but one extra company a kind a province a turn is too small a sink for a 20-turn game. Suggest two pressed companies at double and triple price, or let gold buy a company's tier (2g a tier, garrisoned only).
3. **Divine Power is now reachable and the gifts still do nothing.** Power 4 with 11 consecrations; no gift acted in 20 turns. Make Grace abounding heal returning heroes to full, Revelation reveal enemy hosts on consecrated ground, and give Pilgrim roads to any Divine host on consecrated land. The count (three a point) is right.
