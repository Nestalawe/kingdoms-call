# g13 report: ten realms, round-24 kits, seed 1313, 16 turns, every realm hand-played

Realms: R0 Evil (Orcish), R1 Neutral (Dwarven), R2 Divine (Human), R3 Pagan (Elven), R4 Good (Human), R5 Undead (Orcish), R6 Druidic (Elven), R7 Evil (Dwarven), R8 Neutral (Elven), R9 Pagan (Human). Board 16×11, sea 35%. One admission: my compact view showed the number (not the kind) of neutral defenders in a neighbouring province, which a portal player sees only as "composition unknown"; every realm had the same advantage. Harness additions are listed at the end; nothing under `src/` was touched.

## Result

| Realm | Start of turn 8: provinces / tax share / gold / companies | End of turn 16: provinces / tax share / gold / companies |
|---|---|---|
| R0 Evil | 8 / 8% / 81g / 16 | **17 / 16% / 310g / 25** |
| R5 Undead | 7 / 5% / 53g / 22 | **15 / 14% / 390g / 35** |
| R1 Neutral | 7 / 6% / 57g / 9 | 11 / 9% / 395g / 17 |
| R2 Divine | 6 / 8% / 93g / 9 | 8 / 10% / 79g / 19 |
| R3 Pagan | 7 / 7% / 86g / 6 | 8 / 9% / 135g / 10 |
| R8 Neutral | 7 / 7% / 45g / 13 | 5 / 4% / 194g / 10 |
| R7 Evil | 5 / 5% / 47g / 6 | 4 / 4% / 89g / 9 |
| R6 Druidic | 6 / 6% / 20g / 11 | eliminated turn 15 |
| R4 Good | 4 / 4% / 32g / 7 | eliminated turn 12 |
| R9 Pagan | 3 / 4% / 41g / 6 | eliminated turn 10 |

**Winner: Evil R0** on land and tax share, with the Undead R5 a close second and the richest. Nobody came near the Reckoning in 16 turns. Three realms were wiped out, each by the first neighbour that declared on it: Pagan R9 by the Undead (turns 7–10), Good R4 by Evil R0 (turns 9–12), Druidic R6 by Neutral R1 and the Undead together (turns 11–15).

## Each alignment, and how its round-24 change played

**Undead (R5, second).** Harvest the Field gone made no difference to the outcome. The king's host was skeletal from turn 3 (two starting companies, one raised a turn by the king's Necromancy 2 from his own battlefields), and two heroes practised Necromancy to 4 by turn 4, so Skeletal Armies raised two companies a cast. The barrow at Bramreach (taken from the Pagan on turn 8) refilled three graves a turn and Charnel and Grave raised 15 companies from it in five turns. Bind the Bones capped at Crack bit at once (the king's three starting skeletons were Crack by turn 6 and could not go further), and it did not matter: a Crack skeletal host under the king at ×1.5 fear plus four blights (×1.7) with The Marshal's Treatise beat everything it met except King1's entrenched dwarves (one draw, then a win). Four blights paid 20g a turn in grave goods and raised 16 free garrison companies; the realm ended with 390g and nothing to spend it on. Lichdom, Desecrate and The soul is taken never came up (no Divine neighbour).

**Evil (R0, won; R7, nearly dead).** The two Evil realms show what the kit needs: a monster province. R0 chained Cave Trolls at Fangweald on turn 4 and then made a Dark Pact every turn from turn 7 (6g and 10–12 HP each, healed by the next turn): six Cave Trolls by turn 12, Savage Fury and Reign of Fear ×1.5 on every battle, Terror −30% on every neighbour from Spread Dread. It took the Good realm's six provinces in four turns without losing a company. The altar promotion never fired (no consecrated land in reach), so the round-24 change is untested. R7 found no monster province, so Dark Pact and Savage Fury never existed for it; it lost four battles to the Pagan king and ended with four provinces. Terror and looting alone are not a kit.

**Divine (R2).** Consecrate and Tithes again gave the best early economy (+24g a turn from seven consecrated provinces by turn 12) and the Crusade ×1.5 won every battle against the League. The round-24 Divine Power from consecrations should have given Power 3–4 (seven consecrated plus a Crusade); nothing in any report said so, and no gift was visible, so I cannot say it worked: the player has no way to see their Divine Power. The weakness is the same as before: every consecrated province the host left was empty, and the League walked into Gorbarrens, Stormgrove, Kazheight, Gilfen and Faeverge one after another while the Crusade took them back. Blessed levies (Veterans at 2–4g) made an eight-company garrison at Dawnthicket that nobody attacked.

**Neutral (R1, third; R8, fifth).** R1 is the quiet success of the game: four Trade Pacts (18g, 18g, 14g and a 44g buy of a tax-8 province with four defenders), a Sage 9 scholar who found twenty discoveries (Entrenchment and Hold-Fast made its seven Veterans hold a plain against the Undead host), and 395g at the end. The round-24 pact refusals fired twice (a creature province, then a province of the realm it was at war with) and were right. R8 lost its king to a wanderer's duel on turn 3, then spent the game trading empty provinces with the Divine Crusade and running an Embargo every turn (−20% of Divine tax for nine turns, 45g in all: good value). Ransom with the `ransom` flag was set on Doran every turn but no personal encounter ever happened. The League's capital fell on the last turn.

**Pagan (R3, fourth; R9, eliminated).** R3 woke two stones by turn 5, Favour ×1.16, and beat King7 five times running on Blood Harvest money, but never attacked a capital; the storm at 8g was never worth casting at the fronts it fought on (no woken stones near them), so the price change was not tested by R3. R9 used the storm twice at 8g on Forgepass (16g: 1 company destroyed, 3 demoted of 5) and took the province; then the Undead walked into its empty capital. The Wild Hunt worked three times (two Veteran Ents for 4g, bound to a hero with no Druid: −80%, useless) and expired before any fight. Pagan has no answer to a skeletal host at its door on turn 7.

**Good (R4, eliminated).** The round-24 Beacons did what they should: four Veterans for 8g, wage-free, and they held Lithcopse's garrison together for one battle. The Villages at tax ≤5 paid +3 on three provinces from turn 5. Good Works lifted two stacks of Terror before the Lithcopse battle. None of it mattered against thirteen companies with six trolls at ×1.5: Shield ×1.75 lost 2 of 9, then the capital fell in three phases. Good's kit is defensive and Evil's doom-stack is the one thing it cannot hold against.

**Druidic (R6, eliminated).** Wages killed it before the wars did: 46g a turn against 44g on turn 10 with 11 companies, so the king attacked with Green beasts and lost 3 of 8 to the dwarves. Grow the Wild (8g) and Call of the Wild (2g) worked; The beasts are yours gave a Unicorn and an Ent; Elderleaf at Druid 7 with one Veteran unicorn in forest destroyed five of six hero-led skeletal companies, which is the one bright spot. Two neighbours declared on it in the same turn and it had 5g.

## Report and order problems (new ones only)
1. **Divine Power is invisible.** No line ever states the realm's Power or that a gift (Sanctuary, Revelation, Pilgrim roads) is in force; the round-24 change cannot be checked from a report.
2. **Hero-led skeletons show "+30% (know no fear)", the king's "+50%"**; the kit text says ×1.5 under the king or a hero. Charnel's six lost to one unicorn.
3. **"Druid shortfall −20%"** is printed for humanoid companies of another race (the kinship grudge), on every realm, every battle.
4. **A king on `accept` dies to wandering guards**: King8 (Melee 3) to a Druid 2 wanderer on turn 3. The heir needs the `kingSkills` payload or keeps the crowned skills and four unspent points.
5. **The storm's line reached the realm's report, but the view of a province does not show its current defenders after a storm**, so the player cannot tell what the 8g bought.
6. **Research choices arrive two to four a turn at Sage 7+** (R1 had 18 pairs in the game): each needs an answer or is lost.
7. **A hero at sea**: Nira and Tombwyn "made a coastal landing" after a move order into a sea hex; the order should be refused.
8. **"cannot put to sea"** for a move in the wrong direction costs the phase with no hint of the right one.
9. **Trade Pact's refusal text is right but gives no reason** (creature province, enemy hero, war): three different refusals read the same.
10. **Declaring war on a realm not yet met** is impossible, but nothing says who counts as met until the first contact line.

## Three balance observations
1. **A monster province decides the Evil realm's game.** R0 with trolls and a Dark Pact a turn took nine provinces and killed a king without losing a company; R7 without one lost five battles. Suggest: Dark Pact may name any monster kind (at double the price) when the realm holds no monster province, or every Evil capital starts beside a monster lair.
2. **The Undead still snowball without Harvest the Field.** Two Necromancy-4 heroes at a barrow raise six companies a turn for nothing but the spell; Bind to Crack cost the host nothing it needed; blights paid 20g a turn. Suggest: Skeletal Armies raises one company a cast at a barrow (two from a battlefield), and the barrow refills one grave a turn (three only at the capital barrow).
3. **The first war is the whole game for the small kits.** Pagan, Good and Druidic were each eliminated by the first neighbour that declared, within four turns, because a realm of 4–6 provinces has one host and no second line. Suggest: a declared war takes effect one full turn later for everyone (the Undead's and Evil's immediate wars gave them an empty capital each), and a capital with the king absent keeps a free one-company watch.

Harness: `s13.py` (compact situation from the game file), `share13.py` (tax shares), `mk13.py` (orders with `P <id>=<stance>[,ransom]`), `t13.sh`, `v13.sh`, `run13.sh`; all in the scratchpad, additive, nothing under `src/`.
