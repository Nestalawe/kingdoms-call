# g14 report: ten realms, round-24 kits, seed 1414

Good (Human), Undead (Orcish), Evil (Dwarven), Pagan (Elven), Druidic (Elven), Neutral (Human), Divine (Human), Druidic (Orcish), Good (Dwarven), Evil (Elven). Hand-played, all ten realms by me, 16 turns, all played. Harness: no change to `handplay.ts`; additive scratch helpers only (`mk14.py`, which splits orders on `;`, and `t14.sh`, `run14.sh`, `vb14.sh`, `vs14.sh`, `vh14.sh`, `stand14.py`). I also restored the shared `vb.sh`, `vs.sh` and `vh.sh` after truncating them by mistake. Nothing under `src/` was touched.

## Result

Share: of the whole map's land tax (16×11 board).

| Realm | Turn 8: provinces / gold / share | Turn 16: provinces / gold / share |
|---|---|---|
| Good (Realm0) | 8 / 90g / 7% | 11 / **586g** / 9% |
| Undead (Realm1) | 4 / 13g / 3% | 11 / 233g / 10% |
| Evil (Realm2) | 6 / 24g / 4% | 8 / 36g / 6% |
| Pagan (Realm3) | 3 / 24g / 3% | 7 / 68g / 6% |
| Druidic (Realm4) | 6 / 41g / 5% | 12 / 150g / 10% |
| Neutral (Realm5) | 5 / 52g / 4% | **2** / 68g / 1% |
| Divine (Realm6) | 3 / 47g / 3% | 4 / 23g / 3% |
| Druidic (Realm7) | 8 / 57g / 5% | 12 / 13g / 7% |
| Good (Realm8) | 5 / 44g / 4% | **17** / 446g / **13%** |
| Evil (Realm9) | 4 / 28g / 4% | 9 / 32g / 7% |

**Winner: Good (Realm8)**, on land and tax. The other Good realm was second on gold, and the Undead and the first Druidic realm shared second place on tax. The Neutral realm was all but eliminated by the Undead, and the Divine realm lost its whole field army to Evil on turn 9. Nobody came near the Reckoning.

## The alignments

**Good (two realms, first and third).** The Villages on tax ≤5 paid on most of what Good takes: 9 of Realm0's 11 and most of Realm8's provinces are humanoid land of tax 2–5. Both realms ran 40–80g a turn of surplus and ended with 586g and 446g they could not spend. The round-24 Beacons work exactly as designed: five musters were lit (12g each, six Veterans), each went home after three turns with a clear line, and none touched the wage bill. The Shield (×1.75) did not save Percival's 6 companies against Evil's 10 at Lornthicket. Realm0's king lost 6 of 10 holding the Evil capital he had just taken (×1.5 there).

**Undead (second on tax).** Without Harvest the Field, the realm lives on one trained necromancer. Nyssa practised Necromancy 0→4 by turn 4. At 60–70% she raised 1–3 companies a cast, about 17 in all: Dwarven Guard, Eagles, a Crack Forest Ents from the hired Ents that died defending the Neutral capital, and Berserkers. The king at "Necromancy 2–3 (1 trained)" cast at 40% and fizzled two of three, as g10 found. Bind the Bones stopping at Crack held: six binds for 2–16g each, and the bill falls as the host matures. Blight once (Silreach), plus the free garrison each turn. The skeletal host took the Neutral capital and four more provinces. But the Druids walked into the empty Undead capital on turn 12 and held it, and the king lost 3 of 4 trying to win back Ironspire. **Verdict: no longer runaway. Mid-to-top in a ten-realm game, which is about right.**

**Evil (two realms, fifth and seventh).** The round-24 altar promotion fired twice at Oldhold and lifted one company each time (to Veteran, then a Manticore to Elite). It is now a pleasant bonus, not an engine. A Dark Pact (7.5g, −8 HP) gave Realm2 a third Manticore. It took Oldhold, held Dunsgreen against the Divine Crusade (5 Divine Crack companies lost, none of its own), and made peace with Divine on turn 11. Realm9 chained a Dread Hydra pack and a Cave Troll pack at the pits (Dominion + Savage Fury ×1.5 together). With 10 companies its king retook its capital the turn Good took it, then took Lornthicket. Both realms stayed poor (30–40g) on monster wages.

**Pagan (sixth).** The king, Melee 3 on an "accept" stance, was **slain in a duel by a wandering guardian on turn 3**. The heir started with no army and no stones but his capital's. The storm at 8g still hit hard: Wistpeak, 3 companies destroyed and 2 demoted (the province fell next turn); Eldermire, 1 destroyed and 1 demoted. At 8g it was cast twice in 16 turns instead of every turn, which feels right. Favour reached ×1.4 with three woken sites. Pagan recovered to 7 provinces.

**Druidic (two realms, joint second and fourth).** Parley with the Wild ×1.5 and "the pack submits" took every creature province on the first try. The wild sent a free beast to each held creature province most turns (to three a garrison). Realm4's king walked into the empty Undead capital and then held Ironspire against the Undead king. Realm7 grew to 12 provinces with 11 led companies, but ended at 13g: the beasts' wages ate its tax.

**Neutral (ninth, two provinces).** Trade Pacts bought Reddeep (14g), Fairmire (29g, 3 defenders) and Bloodvines (22g). The bands came cheap (1–2g). Embargo twice on the Undead (−20% for two turns each). Wages broke the realm on turn 4: two companies disbanded on 12g of tax. Then the Undead declared war (at once) and took Fairmire, the capital, Ashwood, Aervale and Coalvale. The new Trade Pact refusals never fired: no enemy hero ever stood in a province I wanted, and I never tried a pact against the Undead while at war. **Ransom still did not happen.** The king's `encounter` on Nyssa, with `challenge` and `ransom: true`, became "rides out and challenges ... to single combat". Nyssa (default stance) refused, so her force fought at −20%, but there was no duel and so no capture.

**Divine (eighth).** Divine Power from consecrations works. One shining holy site plus two consecrations gave Power 3 on turn 4 (Sanctuary, Grace abounding, Revelation), and the Crusade made it 4 (Pilgrim roads). But no gift produced a visible effect or a line in 16 turns: no hero died near consecrated ground, no Pilgrim march came up, and Revelation showed nothing I noticed. Tithes paid 5–7g a turn. The army failed: Crusade ×1.5 held Oldhold once and retook it once, then **5 Crack companies at ×1.5 lost all five to 4 Evil companies and a Manticore in jungle, killing none**. Evil walked back into empty Oldhold, and Divine ended with 4 provinces and 23g.

## Report and order problems (new ones)

1. **Ransom needs the target to accept a duel.** A Neutral `encounter` with `ransom: true` against a hero leading a host becomes a pre-battle challenge; the target's default stance refuses it, so the capture path is never reached. Either let a won pursuit (the encounter itself) capture, or say in the order that the target must accept.
2. **The storm's line says what it destroyed only as a count** ("3 companies are destroyed and 2 fall a quality tier"). The target's owner sees no names, and the GM log has no per-company line.
3. **Divine Power's gifts have no line of their own.** Power 3–4 held for 12 turns and the realm's report never said "Sanctuary" or "Revelation". A player cannot tell that consecrating raised the Power.
4. **A king on "accept" dies to a wandering guardian's challenge on turn 3** with no warning of the guardian's Melee. The intel line gives only "leads: 2 neutral defenders". The heir starts with nothing.
5. **Shield of the Realm (×1.5) applied in a province captured that same turn** (Elensands). The text says "its own ground"; worth checking that a fresh conquest should count.
6. **A Neutral hero with Druid 0 hiring an Ents band** sees it muster into the garrison; the hire costs a phase and the beast cannot march. The order should refuse it, or say so before it costs the gold.

## Three balance observations

1. **Good is now the richest kit by far.** The Villages on tax ≤5 plus wage-free Beacons gave two Good realms 446g and 586g unspent, while Good8 won on land. Before round 24 Good was the poorest. *Suggestion:* keep the Beacons muster as it is (it plays well) and take the Villages back to tax ≤4, or pay +2 instead of +3 on tax 5.
2. **The Undead without Harvest the Field is balanced, but swingy on one hero.** Everything rode on Nyssa's trained Necromancy. The king's casts (40%, one a turn) were near-useless, and the realm would have stalled had she died. *Suggestion:* let barrows and items count half towards the cast chance (not only towards companies raised), or start an Undead kit king at trained Necromancy 2. Leave Bind at Crack and leave Harvest out.
3. **Divine has gifts on paper and no army in play.** Power now arrives (3–4 by turns 4–7) but nothing it unlocks shows up in a turn, and the Crusade host lost 5 Crack companies to 5 Evil ones without a kill. *Suggestion:* make Sanctuary visible and useful in the field ("a Divine host in a consecrated province fights at +20% and heals 2 HP a turn"), and log each gift when it is reached or lost. The defender's swing is also too large (g6's note again): consider capping a lone defender's terrain-plus-kit multiplier at ×2.
