# g19 report: ten realms, round-25 kits, seed 1919, 20 turns

Divine (Human), Undead (Orcish), Good (Elven), Druidic (Elven), Neutral (Dwarven), Pagan (Human), Evil (Orcish), Evil (Dwarven), Neutral (Human), Good (Dwarven). Every realm hand-played by me for all 20 turns (turns 19 and 20 with orders for the realms at war only; the rest held). Harness: no change to handplay.ts; helpers `mk19.py`, `s19.py`, `p19.py`, `o19.sh`, `v19.sh`, `stand19.py` in the scratchpad only. Nothing under `src/` was touched.

## Result

| Realm | Turn 10: provinces / gold / tax share | Turn 20: provinces / gold / tax share |
|---|---|---|
| **Evil (Orcish)** | 15 / 216g / 13.0% | **19 / 557g / 15.1%** |
| Druidic | 13 / 58g / 9.6% | 19 / 222g / 13.3% |
| Undead | 8 / 92g / 6.5% | 11 / 339g / 9.1% |
| Good (Elven) | 9 / 69g / 5.8% | 12 / 284g / 8.2% |
| Good (Dwarven) | 10 / 100g / 7.2% | 10 / 122g / 7.4% |
| Divine | 6 / 63g / 4.4% | 10 / 205g / 6.9% |
| Evil (Dwarven) | 12 / 64g / 7.2% | 10 / 0g / 5.8% |
| Neutral (Dwarven) | 9 / 65g / 5.5% | 9 / 84g / 5.5% |
| Pagan | 5 / 34g / 5.0% | 4 / 120g / 3.3% |
| Neutral (Human) | 3 / 1g / 1.6% | eliminated on turn 11 |

**Winner: Evil (Orcish)**, on land, tax share and gold. It took a Manticore province on turn 3, made a Dark Pact almost every turn, took the Human League's capital on turn 8 and most of its land, and was only stopped on turn 15 by the Good (Elven) king's Shield at his capital. Nobody came near the Reckoning. Wars: Pagan v Undead (turns 6-15, then peace), Undead v Dwarven League (turns 9-13, then peace, after the League bought an Undead province), Evil (Dwarven) v Divine (turns 8-20), Orcish Evil v the Human League (turns 8-11, League eliminated), v Good (Dwarven) (turn 9 on), v Good (Elven) (turn 13 on), Good (Elven) v the Human League (turns 7-11).

## Each alignment and its round-25 change

**Evil (Orcish, won; Dwarven, sixth).** Both Evil realms found a monster province early (Manticores, Basilisks), so the Dark Pact without one was never needed. The Orcish king pacted ten times at 7.5g and 8-14 HP, and with bred Manticores at half wages the realm could not spend its income: 216g at turn 10, 557g at turn 20. The Dwarven Evil king held Magwells five times against the Divine Crusade with two or three Basilisk broods (Petrifying Gaze each battle), but its realm ran to 0g by turn 19 on Dwarven wages. The one-company altar promotion fired once (Magwells, turn 8: one company to Elite). Instant war declarations took the League's capital and Divine's consecrated Magwells the same turn they were declared.

**Druidic (second).** Steady expansion to 19 provinces with no war at all. Its king accepted a wandering hero's duel on turn 2 and died; the heir was crowned with the `kingSkills` allocation. Casian's beast host was turned back from Brokenridge five times by one guarding hero (the refused duel costs −20% every time). Grow the Wild, healers' fees and the free beasts worked; nothing in round 25 touched the kit.

**Undead (third).** The three heroes cross-trained Necromancy to 3 on turn 1 and 4-5 by turn 5, so the capital barrow gave about three skeletons a turn; the 1g-for-two skeleton wage left the realm with 339g at the end and nothing to buy. The host was big (16 at Urmoor, turn 9) but the Pagan storm ate it: five storms destroyed about 18 companies and demoted 10. The king's own casts (trained 3, 60%) fizzled about seven times in ten. Bind the Bones to Crack bit once (11 companies at 22g on turn 16). Lichdom, Desecrate and the soul-taking never came up.

**Good (Elven fourth, Dwarven fifth).** The Villages (+3 on tax 4 or less, +2 on tax 5) and four wage-free Beacons musters each made both Good realms rich. Knights errant now stops: both Good kings reached Tactical 5 and Celestine 6 (round 24: 9). Reclaim ×1.5 decided three battles (Deepgreen, Elenweald, Redpass), and the Shield held the Elven capital against the Orcish Evil king's 12. The Dwarven Good king lost his capital to Sithra and retook it with Reclaim; his best hero, Elspeth, died chasing a lone Evil hero into an unclaimed province.

**Divine (sixth).** Divine Power on three consecrations a point climbed 1, 2, 3, then 4 with the Crusade, then 7 and 8 when "the sword consecrates" turned two captured holy sites into shining ones (turns 15-16). The new report line announced every rise and fall. None of the gifts was seen to act; Sanctuary's healing never had a wounded hero to heal. Blessed levies (Veterans) let Divine rebuild twice after losing its host to the Basilisks.

**Neutral (Dwarven seventh; Human eliminated).** The Human League bought two Good provinces at peace (Elenweald 12g, Deepgreen 24g); Good declared war, retook both and took the rest of the League in four turns, with Orcish Evil taking its capital. The Dwarven League bought the Undead's Grashmesa at peace for 19g, which started a war, then made peace. No pact was refused: the new "taken this turn or last" rule and the refusal reasons never came up. Embargo three times, four mercenary bands for 5g. Ransom was not tried (no Neutral hero sought a duel).

**Pagan (eighth).** Three woken stones, Favour ×1.48 and a king of four Elite companies who held Durridge four times, plus the storm at 8g, which was the best order in the game: it destroyed or broke every Undead host that came near. But Pagan lost its capital-side land to the Undead (Gorrot, Ashdelve) and ended on four provinces.

## Report and order problems (new)

1. **The Divine Power line fires on turn 1 as "falls to 0"** for a realm that never had Power.
2. **Earlier games' "recruit gives one company per order" was a harness bug**, not the engine's: the helper scripts split orders on "|", which the recruit target also uses. With ";" as the separator, `Type|3` recruits three (the third as a pressed levy).
3. **The pressed levy works and is shown** ("3× Forest Wardens (1 a pressed levy, at twice the price)").
4. **"Elspeth the True has been slain at the end of the chase!"** gives no cause: she chased a lone hero into an unclaimed province with defenders and died there.
5. **A lone hero "melts into the country and lies in wait" every turn**, one line per hero per turn, in every realm (Tristan, Nerezza, Belisha, Ozrik, Cadwal, Ossric): noise in the report.
6. **"Druid shortfall −20%"** is printed for Nerezza's human levies under the command limit (known label problem; seen on four realms).
7. **Mutual Treat now produces a clear peace line** for both realms; an unanswered overture still reads "went unanswered this year" the turn it is sent.

## The new sight rule

It worked as intended and changed play twice. The Undead saw the Pagan king's host next to its capital the turn before the storm and attack, brought Morloch's and Mortis's skeletons home on Defend, and held (253 v 248). The Good (Elven) king saw the Human League king next door and lit the Beacons. It did not save the Human League's capital: the League saw the Orcish Evil host beside it and mustered six fresh companies, and lost them all, because the Evil war was declared and fought in one turn. Walk-ins still decided much of the game, eleven of them, but every one was into a province with no host next to it to see.

## Three balance observations

1. **Evil with a monster province is a runaway treasury.** Half wages for bred monsters plus a 7.5g Dark Pact a turn left Orcish Evil with 557g and the best army. Suggest the half wage only for monsters in the breeding province's own garrison, and the Dark Pact once every two turns.
2. **The storm at 8g is still the strongest order against a big host.** Five casts (40g) destroyed about 18 Undead companies and demoted 10, and the Pagan never lost a defence. Suggest the storm destroys at most two companies a cast, or a province can be stormed only once every two turns.
3. **Gold piles up and Divine Power overshoots.** Five realms ended with 200g or more; the pressed levy did not spend it. And two Crusade captures of holy sites took Divine Power to 8, past the six gifts. Suggest a real gold sink (a kit order with a bigger tier at a higher price), and capping Divine Power at 6 with consecrations counting at most +2.
