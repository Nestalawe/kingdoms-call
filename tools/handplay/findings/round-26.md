## The short version

- **Six ten-realm games, 20 turns each, all played to the end.** Evil and Neutral won two each, Druidic and Pagan one each. Good, Divine and the Undead won none, though Good was second or third in five games.
- **The Undead's skeleton garrisons work.** Barrows and blighted land held their skeletons without a necromancer in every game. They became a reserve the king could pick up, and the land behind the host stopped falling. They were attacked only once, when a 10-company Evil host took a 3-company blighted garrison. The Undead still never won, and without a barrow near its capital (g29, and twice in earlier rounds) the realm never got going.
- **The Trade Pact notice cannot be answered.** In four games the owner was warned, sent a hero to stand in the province, and the League sealed the pact in the first phase of the next turn, before the hero arrived. It needs a later earliest phase.
- **Ransom never fired.** Targets refused the duel, kings cannot be ransomed (two League heroes died challenging a king), or the League king took command of the host instead of the ransom hero.
- **The storm cap and the Dark Pact cooldown both did their job.** The storm now softens a defender but does not win a province alone. Evil still won twice, but no longer ran away.
- **The bare-capital warning fired correctly** in three games, and one realm garrisoned its capital because of it.

## What this is

Round 26 took the suggestions from the round-25 games. As you asked, it left out the gold sink and kept Evil's and the Undead's surprise wars as they are. Six ten-realm games were then played for 20 turns: all seven alignments plus three more (never a second Divine or Undead), every realm hand-played. One game (g30) used a helper script to propose routine moves from turn 16, and two others played their last two turns quickly; the findings below lean on the turns played in full. The bot matrix (240 games) was played once more as a second reading.

## What changed for round 26

| Who | Change |
|---|---|
| Undead | Skeletons hold a barrow or a blighted province of the realm as a garrison without a necromancer. Skeletons cost 1g each again. |
| Evil | A Dark Pact once every two turns. Half wages only for bred monsters in the garrison of the province that bred them. |
| Divine | Divine Power stops at 6. Each held holy site counts once; only the first consecrated one counts again. |
| Pagan | A storm destroys at most two companies a cast. |
| Neutral | A pact on another realm's province needs a turn's notice to its owner and costs twice as much. A League hero with the ransom plan who wins the duel before a battle takes the loser alive. A captive cannot be hunted. |
| Every realm | A realm whose capital is empty, with another realm's host next door, is warned in its report. |

## Results

| Game | Winner at turn 20 | Next | Wiped out or left with two provinces or fewer |
|---|---|---|---|
| g27 (seed 2727) | Druidic, by a distance (28 provinces, 21% of the tax) | Good, Undead | Neutral (wiped out) |
| g28 (seed 2828, hostile) | Neutral (19 provinces, 16%, 1,224g) | Pagan, Good | Divine and Druidic (no land left) |
| g29 (seed 2929, 30% sea) | Evil (21 provinces, 17%) | Druidic, two Good realms (the biggest hoards) | Neutral and the second Evil realm (wiped out) |
| g30 (seed 3030) | Pagan (12%) | a second Pagan realm, Druidic | Neutral (two provinces) |
| g31 (seed 3131) | Evil (20 provinces, 15%) | Druidic, Good | Divine and the second Evil realm (no land left), Neutral (two provinces) |
| g32 (seed 3232, hostile, 30% sea) | Neutral (23 provinces, 17%, nine pacts) | Evil, Good | none |

| Alignment | Realms played | Won | Wiped out or left with two provinces or fewer |
|---|---|---|---|
| Evil | 9 | 2 | 2 |
| Neutral | 10 | 2 | 4 |
| Druidic | 9 | 1 | 1 |
| Pagan | 10 | 1 | 0 |
| Good | 10 | 0 (second or third in five games) | 0 |
| Divine | 6 | 0 | 2 |
| Undead | 6 | 0 | 0 |

Neutral is still all or nothing: two wins by buying land, and four realms destroyed. Good is never destroyed and never quite wins. Over three rounds of ten-realm games (23 games), every alignment but the Undead has won at least once.

**The bot matrix with round 26** (240 games, share of wins; round 25 in brackets): Druidic 35% (34), Neutral 26% (21), Pagan 26% (28), Good 23% (20), Evil 23% (30), Divine 22% (21), Undead 2% (4). The Dark Pact cooldown brought Evil back to the field. Druidic leads the bots by a distance and won the one hand-played game where it was left alone (g27). The bots still cannot play the Undead.

## What the games showed, change by change

**Undead garrisons on barrows and blighted land.** They held in every game: 16 skeletons at a barrow in g27, 28 at a barrow for seven turns in g31, 25 in g32, and a blighted province with four skeletons from turn 8 to the end in g30. In g28 they became the realm's reserve: a hero marched a 16-company garrison to the front, and the king, back from Lichdom with nothing, picked up an 11-company garrison. Only one was attacked (g31: three skeletons on blighted land lost to a 10-company Evil host). At 1g a skeleton the realm was comfortable or hoarding (250 to 260g in two games). On an island map with little tax (g32) the garrison skeletons cost more than the realm earned, and unpaid wages disbanded its ships. The Undead's problem now is the map. With a barrow near the capital the realm builds a big host; without one (g29) it raised ten skeletons in 20 turns and finished eighth. Bind the Bones had nothing left to do by turn 9 to 16 in every game.

**Evil: the Dark Pact every other turn.** The cooldown held exactly, and pact armies of four or five monsters by turn 10 are strong but not a runaway. The pact from afar (12g) worked in four games. Evil won g29 and g31 on monster provinces, surprise wars and the one-company altar promotion (four times in g31). Two Evil realms still collapsed on wages (g28 at 0 to 3g from turn 7, g30 broke from turn 6), and one used the pact from afar four times and was wiped out anyway. The Dark Pact's blood cost has no floor: one Evil king fell to 7 of 27 HP from pacts alone.

**Divine: Power capped at 6, holy sites counted once.** Power stayed between 1 and 5 in five games and reached the cap only in g32 (turn 14). The report line came at every change, Sanctuary healed in two games, and the other gifts still did nothing a player could see. Divine was the realm that suffered most from surprise wars: it lost all its land twice (g28, g31). Its Crusades won land but broke on Good's Shield at a capital (g27: seven of eight lost).

**Pagan: the storm capped at two destroyed.** The cap bound often (three or four times in a game where the storm was cast), and the storm now softens a target for the host behind it rather than winning a province alone. Its demotions are still uncapped: one cast in g29 dropped ten Good companies a tier. Pagan won one game and was never destroyed. Rite of Awakening is the economy; one game suggests capping its tax bonus at three sites.

**Neutral: the pact notice and double price.** The notice reaches the owner with the price and how to block it, and the League paid double (24 to 40g). But the owner could not answer it in four games: the hero sent to stand in the province arrives in the first phase of the next turn, and the pact is sealed in that same first phase, before him. Where the owner's hero was already standing there, the pact was refused, correctly (g27, g29). Double price is nothing to a League with 700g or more; it bought nine provinces in g32 and won.

**Ransom in the duel before a battle.** It never fired. The target refused the duel (g27, g28), which costs it only a morale penalty. Two League heroes with the ransom plan challenged a king, who cannot be ransomed, and died (g31). The League king took command of a combined host over the ransom hero (g29). In g30 the target fled the duel. Six games in a row with players trying for it is good evidence that Ransom needs a different path.

**The bare-capital warning.** It fired six times in g29, twice in g31 and once in g27, every time accurately, and never falsely. In g31 a realm garrisoned its capital because of it. In g27 the hero sent home went the wrong way and the capital fell anyway.

**Beacons and Knights errant.** Unchanged and right. A muster in a king's host went home on schedule in g32, which confirms the round-25 fix. Musters decided defences in three games.

## Problems a player would hit (new in round 26)

1. **The pact notice cannot be answered**: the pact is sealed in the first phase of the next turn, before the owner's hero arrives. The notice also lapses without a reminder.
2. **Ransom has no path that works in play**: a refused duel ends it, a king cannot be ransomed and nothing says so, and a king in the same host takes command over the ransom hero.
3. **The Dark Pact's blood cost has no floor**, so a king can pact himself down to a few HP.
4. **The storm's demotions are uncapped**, its line never names the companies hit, and a storm on an empty province costs 8g for nothing.
5. **A leaderless Undead host is told it fights "under their Undead king".**
6. **The order form does not say Bind the Bones stops at Crack** (the refusal does).
7. **A king leading ships cannot march overland until every ship has been left behind, one order each.**
8. **Pressed levies of beasts bring a −20% command shortfall** with no warning when they are bought.
9. **A hero at peace can stand inside another realm's capital for ten turns** with no line about it.
10. **The pact's refusal checks run in a fixed order**, so a gold shortfall is reported before "another realm's hero stands there", and that before "at war".
11. **The Undead's altar promotion still lifts every company** of the column, while Evil's lifts one.
12. **Kings on 'accept' still die in duels**: three kings in g28 alone.

## What I would change next (round 27)

1. **Let the owner answer a pact notice**: the pact can be sealed no earlier than phase 2 of the turn after notice, so the owner's hero moving in during phase 1 arrives first. Remind the League when its notice is about to lapse.
2. **Give Ransom a path that happens**: a hero (not a king) whose host is destroyed or routed in a battle the League wins is taken for ransom when the League's leading hero carries the ransom plan, whatever his duel stance. Say plainly that kings cannot be ransomed.
3. **Place a barrow within two hexes of every Undead capital.** With one, the Undead are a mid-table realm; without one, they are last.
4. **Cap the storm's demotions at four a cast**, and name the companies hit.
5. **No Dark Pact while the king is below half his HP.**
6. **The Undead's altar promotion lifts one company**, as Evil's does.
7. **Watch Druidic**: it leads the bot matrix at 35% and won its one uncontested game by a distance on free beast garrisons and "the pack submits". One option is that "the pack submits" needs a hero of Druid 2 or more in the attacking host. I would wait for another round before changing it.
8. **Kings default to refusing duels**, or the order form warns that a king on 'accept' can die to any wandering hero.
9. **The Divine gifts still need effects a player sees**, and Divine suffers most from the surprise wars you are taking to the playtesters.
