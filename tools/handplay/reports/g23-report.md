# g23 report: ten realms, round-25 kits, seed 2323, 20 turns (all played, every realm ordering every turn)

Realms: R0 Evil (Orcish), R1 Good (Elven), R2 Divine (Human), R3 Undead (Orcish), R4 Neutral (Dwarven), R5 Druidic (Elven), R6 Pagan (Human), R7 Neutral (Human), R8 Evil (Dwarven), R9 Druidic (Elven). Board 16x11. Helpers in the scratchpad only (mk23.py, c23.py, o23.sh, stand23.py); nothing under the repository changed. My compact view showed neighbours' defender counts and the round-25 sight rule (hosts next to your land, as a size band).

## Result

| Realm | After turn 10: provinces / gold / share of tax | After turn 20: provinces / gold / share of tax |
|---|---|---|
| **R8 Evil (Dwarven)** | 17 / 203g / 13.7% | **34 / 1,263g / 25.3%** |
| R9 Druidic | 14 / 107g / 9.9% | 17 / 208g / 11.8% |
| R1 Good | 11 / 121g / 7.1% | 16 / 460g / 11.2% |
| R3 Undead | 14 / 235g / 10.9% | 11 / 586g / 9.4% |
| R0 Evil (Orcish) | 8 / 25g / 4.7% | 12 / 153g / 7.8% |
| R2 Divine | 8 / 92g / 5.6% | 12 / 212g / 7.4% |
| R5 Druidic | 13 / 104g / 7.9% | 10 / 166g / 6.8% |
| R6 Pagan | 4 / 31g / 2.4% | eliminated turn 14 |
| R7 Neutral | 5 / 23g / 4.0% | eliminated turn 14 |
| R4 Neutral | 0 (eliminated turn 10) | — |

**Winner: Evil R8**, by a distance: twice the tax of anyone else and 1,263g unspent. It never lost a battle under its king, took the Pagan realm in five turns (war at once on turn 9, capital on turn 10) and then took Good's eastern provinces and its capital (turns 15-19). Druidic R9 ate Neutral R4 (capital on turn 7, the realm by turn 10) and then the Undead's western edge. The Reckoning price fell to 35% on turn 16; nobody came near it.

## Each alignment, and how round 25 played

**Evil (R8 won; R0 middle).** The two Evil realms show the round-25 changes at both ends. R8 made the Dark Pact *from afar* on turn 4 (Cave Trolls, 12g, 10 HP), then held monster provinces from turn 7: its pact was at the normal price (Titan Warbeasts, 10.5g) every turn, and its bred kinds drew half wages. With Savage Fury and war without warning, a 6-8 company host of trolls and titans broke every king it met. R0 paid the doubled pact price (12g) almost every turn from turn 5 and had no monster province until turn 16: troll wages left it at 10g for three turns and its host was thrown back twice by the Neutral king. Once it chained a Manticore Pride (turn 16), its pact fell to 7.5g. The altar promotion never came up (no Evil host took consecrated land).

**Druidic (R9 second; R5 lost ground).** R9 rolled up Neutral R4 in four turns (forest capital, Forest Wardens silencing Dwarven crossbows), then joined the war on the Undead and took three provinces. Its king died chasing the landless Neutral king with Encounter (turn 11); the heir needed a kingSkills allocation. R5 took creature provinces with "the pack submits" companies, then declared on Divine, walked into two empty consecrated provinces, and lost them both to a Divine Crusade. Its king, alone, then killed the Divine king who chased him (turn 17).

**Good (third).** The Villages (+3 on tax 4 or less, +2 on tax 5) paid on nearly every province from turn 3; Good had 460g at the end. Knights errant stopped at Tactical 5: the king reached Tactical 5 by turn 6 and stayed there for 14 turns, which is what the cap is for. The Beacons were lit once (turn 16: five Veterans, 12g, wage-free, gone home on schedule). Good declared on the Undead when it was the leader and walked into three empty Undead provinces; meanwhile Evil R8 walked into four empty Good provinces in the east and stormed its capital. Good's single host could not be on both fronts.

**Undead (fourth, richest after Evil).** Without Harvest the Field the king's own casts at Necromancy 1 failed most of the time, as expected; two heroes cross-trained Necromancy to 3-5 by turns 4-9 and raised two or three companies a cast at the Kronstone barrow (about 25 skeletal companies by turn 10). Skeletons at 1g for two made the Undead rich: 586g at the end with nothing to buy. Bind the Bones hit its Crack cap by turn 13, and the refusal now says why ("the bones bind to Crack at most; Elite is earned in battle"). The realm peaked at 18 provinces on turn 13, then lost the west to Good and the Druids while its host was finishing Neutral R7 six hexes east.

**Divine (middle).** Divine Power rose 1 → 3 → 9 → 13 → 14. At three consecrations a point the consecrations hardly mattered: three or four held holy sites, counted twice once consecrated, carried it past the top gift by turn 10. The new report line works ("Divine Power rises to 3 ... The faith's gifts: ..."). Sanctuary's heal fired once (+6 HP to the king on consecrated ground after Divine Resurrection brought him back). The other gifts did nothing visible. Proclaim Crusade and "the sword consecrates" took Kazstone. The pressed levy filled the capital with 11 companies in one turn when the Druids came (178g).

**Neutral (both eliminated).** R4's first Trade Pact was refused with the new reason ("a creature or monster province: beasts take no coin"), then it bought Starrot for 18g; it lost its capital to one Druidic battle (its two hosts fought apart) and was gone by turn 10. R7 bought three provinces (14-25g) and embargoed Evil and the Undead, then lost everything to two realms at war with it at once. **Ransom fired** (turn 10: "spares Necra the Cold and holds them to ransom — 4g"), but my second Encounter order the same turn ran the captive down and killed her. Two other wins over lone heroes ended with the loser fleeing (a 40% roll at 1 HP; a Berserk's 10% "loses the stomach").

**Pagan (eliminated).** The king accepted a guardian's duel on turn 1 and died. Only the capital's stones were ever woken, so Favour stayed low. The storm at 8g was cast twice (1 destroyed and 3 demoted; then 1 and 1) but could not stop Evil R8's monster host.

## The sight rule (new)

It mattered once in a way players will feel: on turn 6 Good declared war meaning to walk into the Pagan capital next turn, the Pagan saw Good's host beside its land and brought its king home, and Good made peace instead. Every other walk-in still happened: the Undead's west (turn 15), Good's east (turns 15-17), Divine's Scaledrift and Westvines (turns 12 and 14). Each time the defender saw the host coming and had no second host to send. Neutral R7 watched "a large host" of Undead beside its land for two turns and could do nothing.

## Report and order problems (new)

1. A captor's further Encounter orders on the same turn run down and kill his own captive (turn 10, Ransom). The captive should be out of reach, or the order should refuse.
2. Ransom loses to the flee rules: a beaten lone hero flees at 1 HP (40%) or "loses the stomach" (10%) before he can be captured. Capture should be decided before the flee roll when the winner set out to capture.
3. Two reigning kings (Druidic, then Divine) died chasing a landless enemy king with Encounter. Nothing warns a king that his quarry is the better duellist.
4. Recruiting at consecrated Khazheath failed: "Shieldwall Levies (not raised in Khazheath)". The province's recruit list is not shown before the order, and Blessed levies need a province that raises them.
5. The orders accept an unknown action ("practise") and the hero rests without a word (harness, but the portal should refuse unknown actions loudly).
6. Divine Power reports values far past the last gift (14 with six gifts); the line could say "all six gifts" instead of the number.
7. Two hosts of one realm attacking or defending the same province fight apart (Neutral R4's capital fell this way on turn 7).

## Three balance observations

1. **Evil with a monster province snowballs.** Normal-price pacts every turn plus half-wage bred monsters gave R8 a troll-and-titan host it never lost with, and 1,263g it never needed. Suggest: the Dark Pact once every two turns, and the half wage only for monsters in the garrison of the province that bred them (not in a king's host).
2. **Divine Power is driven by holy sites, not consecrations.** Three consecrations a point barely moved it; held holy sites counted twice carried it to 9-14. Suggest: a holy site counts 1, and 1 more only for the first shining site, so consecration is the path to the top gifts. Give Sanctuary's heal a report line each time (it is good).
3. **Treasuries still pile up.** Evil R8 1,263g, Undead 586g, Good 460g. The pressed levy was used by every rich realm and did not dent it. Suggest a second pressed company at triple price, or a "raise the garrison" order that buys a free watch company for any province the realm holds (which would also answer the walk-ins the sight rule only reveals).
