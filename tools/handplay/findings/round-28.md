## The short version

- **Four ten-realm games, 20 turns each, all played to the end.** Druidic won two, the Undead one and Pagan one. Three of the four were close: the winner held 13 to 17% of the world's tax.
- **The Villages trim worked.** Good was the richest realm in only one game of four, and still finished second in three.
- **The storm rule and the pact notice both work and feel fair.** A second storm on the same province was refused with a clear line, and the victims' lines name their companies. The notice cost 3g, "one embassy at a time" showed, and owners blocked seals by marching a hero in.
- **Ransom is still too rare.** It fired once in four games. League heroes won five other battles against enemy heroes, but the loser kept more than half his companies each time and walked away.
- **The Dark Pact's wage-free turns help but do not make Evil solvent.** Two Evil realms stayed afloat; four ran out of gold, most of them once the free turns ended.
- **One bug found and fixed:** a captive's surviving companies could fall back into the very province being captured.
- **Outside the kits, Defend and mountains still decide the big battles** (ten Pagan companies beat 46 Undead in a mountain). That is one of the two decisions you are keeping.

## What this is

Round 28 took the five suggestions from the round-27 games and left the two decisions you are holding (Defend riding out, and empty provinces) exactly as they were. Four ten-realm games were played for 20 turns: all seven alignments plus three more, every realm hand-played, every surviving realm giving orders every turn. The bot matrix (240 games) was played once more as a second reading.

## What changed for round 28

| Who | Change |
|---|---|
| Neutral, Ransom | A captive is held one full turn before his realm may pay. The price is 3g a skill level. He is freed at his own capital. His surviving companies fall back leaderless to his realm's nearest province. A beaten hero with nowhere to retreat is taken too. |
| Neutral, Trade Pact | Sending envoys (the notice on another realm's province) costs 3g, and only one notice may stand at a time. |
| Pagan | No storm on a province that was stormed last turn. The victims' line names their companies. |
| Evil | A Dark Pact company draws no wages for its first three turns. The pact is refused below a third of the king's HP (was half). |
| Good | The Villages pay +2 on tax 4 or less and +1 on tax 5 (was +3 and +2). |

## Results

| Game | Winner at turn 20 | Next | Landless or wiped out |
|---|---|---|---|
| g38 (seed 3838) | Druidic (24 provinces, 17.5% of the tax) | Good (16.8%, the most gold), Undead and Pagan (10.9% each) | Neutral (one realm, from turn 7) |
| g39 (seed 3939, hostile) | Druidic (18 provinces, 14.3%) | Pagan (13.0%), Neutral (12.7%, the biggest army) | Divine |
| g40 (seed 4040, 30% sea) | Undead (18 provinces, 13.2%, 216g) | Good (13.4% of the tax, less land and gold), Divine, Pagan | Evil (one realm) |
| g41 (seed 4141) | Pagan (27 provinces, 20.8%, 396g) | Good (11.5%), Druidic | Evil (one realm, by turn 11), Undead (by turn 17) |

| Alignment | Realms played | Won | Second |
|---|---|---|---|
| Druidic | 6 | 2 | 0 |
| Undead | 4 | 1 | 0 |
| Pagan | 6 | 1 | 1 |
| Good | 6 | 0 | 3 |
| Neutral | 7 | 0 | 0 |
| Evil | 7 | 0 | 0 |
| Divine | 4 | 0 | 0 |

Over the five rounds of ten-realm games (32 games) the wins are now: Pagan 8, Evil 6, Neutral 6, Good 6, Druidic 3, Divine 2, Undead 2, with one game shared.

**The bot matrix with round 28** (240 games, share of wins; round 27 in brackets): Druidic 32% (37), Neutral 31% (28), Good 26% (25), Pagan 25% (27), Evil 22% (21), Divine 20% (18), Undead 2% (1). All within the usual noise except Druidic, which came down a little. The bots still cannot play the Undead.

## What the games showed, change by change

**Ransom: the new terms are right, the trigger is too tight.** It fired once in four games (g41: 27g for a hero of nine skill levels). League heroes carrying the ransom plan won five other battles against enemy heroes, and each time the loser had kept more than half his companies, so he retreated as usual. Nothing in the report says why no capture happened. In the one capture, the captive's realm had no gold, so he sat held for five turns and then deserted unpaid, and the League earned nothing. That capture also showed the bug: his surviving companies "fell back" into the province being captured. That is fixed.

**The pact notice at 3g, one at a time.** It worked in all four games. The owner was told the price and how to block; marching a hero in blocked the seal every time it was tried; "one embassy at a time" showed when a second notice was attempted; one pact was sealed as the third order for 40g. Its main use is now to pin an owner's hero for two turns for 3g, which seems a fair trade. The League's own notice line does not show the 3g cost.

**No storm on the same province two turns running.** Refused with a clear line twice and allowed again the turn after. The caps bound on almost every cast, and every victim's report named its own companies. The gap does not weaken the storm much: the caster storms on one turn and attacks on the next. In two games the Pagan realm never cast it at all, for want of 8g or a war.

**The Dark Pact's three wage-free turns, and the floor at a third.** The "asks no wages for 3 turns" line showed on every pact, and the floor never shut a king out. Evil used the pact freely (five to eight pacts a game). Two Evil realms stayed solvent. Four did not: in most cases, once the free turns ended, the wage bill arrived all at once (71g of wages on 65g of income in g41) and companies were disbanded turn after turn. Evil won no game for the second round running, and lost two realms.

**The Villages at +2 and +1.** Good was the richest realm in one game of four (g38) and second to fourth in gold in the others. It still finished second in three games and was never wiped out. In one game a Good realm could not pay wages on two late turns. This looks right.

**Druidic won two games.** Both were close (14.3% and 17.5% of the tax). It leads the bot matrix again. Nothing in round 28 touched it.

**The Undead won again (g40) and collapsed again (g41).** With a barrow near the capital the realm is competitive. In g41 it held 13 provinces and 43 companies at turn 10 and nothing by turn 17: two storms and a Pagan host on Defend destroyed the king's army, the ransom removed its best necromancer, and unpaid wages did the rest.

## Problems a player would hit (new in round 28)

1. **A captive's companies fell back into the province being captured.** Fixed.
2. **Nothing says why a ransom did not happen**, and a captive whose realm cannot pay stays held with no ending. His "held to ransom" line printed five times in one turn.
3. **The League's notice line does not show the 3g cost**, and a bought province is also reported to its old owner as "captured, leading 9 units".
4. **A Dark Pact company's wages arrive without warning** when its free turns end. The pact line could say what the company will cost.
5. **A declaration of war was dropped with no message** for three turns running (g41), and a 20-company host's second move was dropped with no line (g38).
6. **The same battle line printed two or three times** in one report (g38).
7. **The loser of a battle sees the winner's Blood Harvest income.**
8. **No bare-capital warning fired for an empty Undead capital** with an enemy host next door (g40). I have not yet found why.
9. **A landless realm still collected 15g** with no source named (g39).

## What I would change next (round 29)

1. **Loosen Ransom's trigger and give it an ending.** The beaten hero is taken when he loses a third of his companies, not half. If his realm cannot pay after three turns held, he is freed for whatever it has. The report says in one line why a beaten hero was or was not taken.
2. **Dark Pact companies draw half wages after their free turns**, and the pact line states the wage to come. Evil has won nothing in two rounds, and the wage cliff is the cause in most of its collapses.
3. **Leave alone:** the Villages at +2 and +1, the storm, the pact notice, the barrow guarantee, the Beacons.
4. **Druidic: your call.** It won two of four games and leads the bots, but both wins were narrow. Options: (a) leave it and ask the playtesters; (b) "the pack submits" (the free beast company on capturing a creature province) needs a hero of Druid 2 or more in the host; (c) the free beast garrisons stop at two a province, not three. I lean to (a): the kit has a real weakness in wages and in open ground, and playtesters can judge better than my solo games whether a Druid realm is left alone too often.
5. **The two decisions you are holding** showed again in every game: an army on Defend, or in a mountain, wins against several times its number, and empty provinces fall to anyone who walks in.
