# g27 report: ten realms, round-26 kits, seed 2727, 20 turns

R0 Divine (Human), R1 Evil (Orcish), R2 Undead (Orcish), R3 Good (Elven), R4 Neutral (Dwarven), R5 Pagan (Human), R6 Druidic (Elven), R7 Good (Dwarven), R8 Evil (Human), R9 Neutral (Elven). Board 16×11. Every realm hand-played for turns 1 to 18. Turns 19 and 20 used one plain rule for every realm, applied by a helper script (`auto27.py`): a host of 3+ companies attacks the weakest adjacent target it can beat, otherwise everyone holds. Nothing under the repository was changed. The helpers are scratch files (`mk27.py`, `t27.sh`, `run27.sh`, `s27.py`, `p27.py`, `k27.py`, `m27.sh`, `v27.sh`, `auto27.py`, `stand27.py`), and the harness itself was not edited.

## Result

| Realm | After turn 10: provinces / gold / tax share | After turn 20: provinces / gold / tax share |
|---|---|---|
| **R6 Druidic** | 11 / 61g / 7.2% | **28 / 594g / 20.5%** |
| R7 Good (Dwarven) | 11 / 182g / 7.8% | 17 / 723g / 11.6% |
| R2 Undead | 6 / 73g / 3.0% | 14 / 166g / 9.8% |
| R1 Evil (Orcish) | 9 / 101g / 7.0% | 10 / 196g / 7.7% (capital lost on turn 18) |
| R0 Divine | 7 / 182g / 5.9% | 8 / 532g / 6.7% |
| R8 Evil (Human) | 7 / 60g / 5.0% | 6 / 27g / 5.5% (holds the Dwarf capital) |
| R4 Neutral (Dwarven) | 6 / 18g / 4.5% | 8 / 133g / 4.7% (capital lost on turn 14) |
| R5 Pagan | 8 / 116g / 5.6% | 5 / 291g / 3.0% (capital lost on turn 17) |
| R3 Good (Elven) | 4 / 12g / 2.9% | 4 / 18g / 2.7% |
| R9 Neutral (Elven) | 2 / 4g / 1.7% | wiped out on turn 13 |

**The Druids won by a distance.** They took creature provinces with free packs, ate the Elven League from turn 8, and then walked into four empty Pagan provinces, the capital among them, after declaring war on turn 16. Nobody reached the Reckoning (30% by turn 16).

## Each alignment, and how round 26 played

**Undead (third).** Two heroes cross-trained Necromancy, reaching 3 and then 5, but most casts still fizzled. Morwenna at Necromancy 5 raised two or three skeletons a cast at the Thurspire barrow. **Garrisons on barrows and blighted land worked as intended.** At the end, 16 skeletal companies held the Thurspire barrow and 4 to 5 held each of three blighted provinces. None crumbled, and the land behind the host stayed Undead all game. That is the change working. **1g a skeleton** kept the realm at 53 to 104g, comfortable but not rich. **Bind to Crack** bound everything by turn 16 and was then refused: "no skeletal company here can be bound any tighter (the bones bind to Crack at most; Elite is earned in battle)". The first war, on the Dwarves (turn 6), failed at Anvilpass because the Dwarves had seen the host and stood ready. Peace came on turn 11. A surprise war on Evil (Orc) on turn 18 took the Evil capital the same turn.

**Evil (Orcish R1, fourth; Human R8, sixth).** **The Dark Pact every other turn** gave each Evil king a monster on turns 3/5/8/10/12/14 (R1, Cave Trolls) and 8/10/12/15 (R8, Titans). R1's first pact was from afar at double price (12g); after it took the troll pits at Beaststone, pacts cost 6g. That pace is still fast enough to build an army of four or five trolls by turn 10, but no longer a runaway. **Half wages only at home:** R8 parked its bred Titans in the Talonmoor garrison, which is the intended play. R8 took the Dwarf capital on turn 14 with three pacted Titans, then made peace holding it. R1 lost its capital on turn 18 to the Undead's surprise war while its king was conquering six provinces away. Evil's altar promotion never came up, since no Evil host reached consecrated land.

**Divine (fifth).** **Power capped at 6, holy sites counted once:** Divine held no holy site, and seven consecrations plus a Crusade gave Power 1, 3, 2 and finally 4. The report line appeared on every change ("Divine Power rises to 3 ... The faith's gifts: Sanctuary, Grace abounding, Revelation"). The cap was never close. Three Crusades on Good won Bloodmeadow, Ruinreach and Feralcanopy, each consecrated as it fell. But the attack on the Good capital lost 7 of 8 companies to the Shield on home ground, and later assaults lost again. Divine ended with 532g it could not turn into anything that beat Good's Shield.

**Good (Elven R3 ninth; Dwarven R7 second).** The Elven Good realm survived three Divine Crusades and an Evil war on four provinces. The Shield ×1.75 held the capital (turn 8: Divine lost 7 of 8) and Westhollow twice. The Beacons were lit three times (2 to 4 Veterans each, wage-free, home after three turns), but the musters never fought. The Good king reached Tactical 9, gaining 4 to 5 levels after the cap at 5 from plain battle experience. The Dwarven Good realm was never attacked and grew to 723g; the Villages paid as designed.

**Pagan (eighth).** No stones in its start area. Pagan woke its first site on turn 11, after taking Beaststone from Evil. **The storm at 8g, capped at two destroyed,** was cast once (Skullmesa: 1 destroyed, 1 demoted) and took the province. The two assaults on the Evil capital failed (Malicia had recruited seven companies, two of them pressed levies). Pagan was then eaten from behind by the Druids.

**Neutral (Dwarven R4, seventh; Elven R9, wiped out).** **The pact's turn of notice worked as written.** On turn 12 the envoys opened talks on Undead Krulreach. The Undead got the line "The League's envoys are in Krulreach ... From next turn they may buy it from under you (for 32g at today's garrison) unless a hero of yours stands there", and sent a hero to stand there. On turn 13 the pact failed anyway, for want of 32g. **Ransom:** a Dwarf hero with {"duelStance":"challenge","ransom":true} on Defend challenged an Undead hero at Yllbriar (turn 10). She refused the duel, so there was no capture. Ransom never fired. The Dwarves saw both enemy hosts every turn, which won three defences (Anvilpass, Kronexpanse, Faebarrens), but lost the capital to the third Titan.

**Druidic (won).** "The pack submits" and the free beast garrisons, Call of the Wild (2 Ents for 4g), Grow the Wild on the desert capital, and forest fights at ×1.5 all came into play. The Druids also had the cleanest map: a weak Neutral neighbour, then a Pagan realm with its army far away.

## Report and order problems (new)

1. **A refused duel stops Ransom completely.** A League hero's challenge with the ransom plan is turned down by any target on 'refuse' (the default), so the capture path never opens.
2. **A Trade Pact refusal for want of gold comes before the "hero stands there" rule.** The Undead hero who answered the notice was never tested, because the pact failed on price first.
3. **The bare-capital warning fired, but it is only a sentence.** "Your capital Fairfield stands empty ... Corin of Realm6 leads a host next door" came the turn before the Druids walked in. The Pagan hero sent home went a wrong way: a hero two hexes away has no route hint.
4. **"no skeletal company here can be bound any tighter"** is clear. But the order form does not say the cap is Crack, so a player only learns it from the refusal.
5. **Evil's war takes effect at once, and a surprise war took two capitals** in this game (the Dwarf capital on turn 14 after a war declared on turn 6; the Evil capital on turn 18 from a war declared that same turn). Kept as Toby ruled; noted for the playtesters.
6. **"Druid shortfall −20%"** is still printed for the command limit on humanoid levies (Divine's Orc levies, Good's, the Dwarves').
7. **A Divine hero recruiting in a consecrated province of another race** gets Blessed Veterans of that race (Orc Berserkers and Warg Riders at Bloodmeadow), with "Druid shortfall" penalties under a Human hero. Odd, though it worked.

## Three balance observations

1. **The Druids snowball on empty provinces.** Free packs, free garrisons and walk-ins took them from 11 to 28 provinces in ten turns, with no battle larger than a neutral garrison. Suggestion: the wild sends a free garrison only to provinces with no garrison of the realm's own levies, and "the pack submits" only when the king leads the attack.
2. **Ransom needs a capture that does not depend on the loser accepting a duel.** Suggestion: when a League host with a ransom-plan hero wins a battle in which the enemy hero's host is destroyed, that hero is taken (if not a king), whatever his duel stance.
3. **Divine still cannot turn its gold into a winning army against the Shield.** It ended with 532g, and every Crusade assault on Good's own ground lost (Crusade ×1.5 against Shield ×1.75 plus a capital). Suggestion: a Proclaimed Crusade cancels the Shield of the Realm (the Good realm's defence falls to holy ground ×1.5 against it), or Crusade conquests heal the attacking host by a quarter.
