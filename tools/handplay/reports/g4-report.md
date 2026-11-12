# g4 report: Pagan (Orcish) v Neutral (Human) v Evil (Dwarven), seed 404, sea 50%

Hand-played, all three realms by me, round 23 kits, 16 turns.

## Result

| | Turn 8 | Turn 16 |
|---|---|---|
| Pagan | 6 provinces, 34g, income 45g | 12 provinces, 214g, 41% of the world's tax base |
| Neutral | 4 provinces, 12g, income 25g | 1 province, 43g, 1% |
| Evil | 5 provinces, 0.5g, income 25g | 6 land + 3 sea hexes, 24g, 17% |

Pagan won outright. By turn 8 it had woken five ritual sites and its Favour multiplier (×1.4, later the ×1.5 cap) sat on every battle line. From turn 11 it ate Neutral whole: Hartheight by storm, then the capital, Greywells and Gromvines. Evil ran out of land by turn 9 (sea on every side), lost both heroes to Medium lairs on turn 11 and spent the rest of the game rebuilding under a new king, though it did land on Pagan's undefended Moonroot by longship on turn 15. Neutral never had the gold to do more than two Trade Pacts, met nobody until turn 10, and had no army answer to a Favour-boosted Pagan host.

## Pagan

**Used:** Rite of Awakening (six times), Favour of the Old Gods, Blood Harvest, Rite of the Wild Hunt, Blood Offering, Rite of the Ley, Call Storm (three times), Raiders' Muster (the free garrison after a win).
**Mattered most:** Awakening and Favour. This seed put ritual stones in six of the eight provinces Pagan took, so every conquest was +3 tax and another Favour point; by turn 9 the multiplier was capped at ×1.5 and never left the battle lines. Call Storm destroyed all three companies at Hartheight for 4g and let a hero seize the province "undefended": the strongest single order I used all night. The Wild Hunt (two Veteran Dread Hydras for 8g) won Moonroot; the Ley let two hosts converge on Dunsheath in one turn.
**Never found a use for:** nothing. Every Pagan order got used and worked.
**Strong:** Favour at cap on a stones-rich seed; Call Storm's wipe; the Ley for repositioning.
**Weak:** early wages. Orcish companies cost their recruit price every turn, so turns 4–6 ran a deficit until land came in; one misread direction (turn 6) nearly broke the bank.
**Fun:** very. Each province asked a question (wake it, hunt from it, offer at it, step along the ley) and the duel stance choice made the king's fights tense.

## Neutral

**Used:** Trade Pact (bought Gromvines 11g, Balhollow 11g, Greywells 18g, Hartheight 26g; refused Dreadsands, Bloodreach — "not humanoid"; Stormreach priced at 37g), Embargo (twice, −20% on Pagan's tax for two turns each), Broker ('hire:<id>' hired a wanderer by courier), Markets' extra tax, the ambush ("lies in wait") of a hired spy-hero.
**Mattered:** Trade Pacts were the whole early game, but each bought province came with a garrison the realm then paid wages for, so the pacts raised wages as fast as tax. Embargo was the one thing that hurt Pagan (−12g a turn) and cost only 5g.
**Never found a use for:** Ransom. The capture choice lives in `encounterPlan.ransom`, which only the bots set; the orders merge keeps just tactics, notes, duelStance and evilMode, so a human Neutral player cannot ask to capture. Ulf won a duel against Grendol on turn 15 and could only kill him.
**Strong:** Quick Learners (Ulf: Melee 0 → 3 and White 1 → 4 each in one turn); Embargo.
**Weak:** no way to see a neutral garrison before attacking (the turn-3 attack on Stormreach met three Free Lances blind); pacts refused on most neighbours; no battle answer to a Favour host. Neutral spent turns 6–9 unable to act: wages equalled income and no neighbour accepted a pact.
**Fun:** the buying was fun for three turns, then it was waiting.

## Evil

**Used:** Spread Dread (four times), Terror (to ×3 on every neighbour), Dominion of the Pits (×1.5 at Wyrmfield), the chained beast company after storming a monster province, Savage Fury (×1.5 at Titanscree), Dark Pact (10.5g and 4 HP for an Average Titan Warbeasts company), Tribute of Fear (1g a turn once Pagan's Urukwells was under Terror), War Without Warning (the turn-14 declaration was instant).
**Mattered:** Spread Dread + Terror made every early conquest cheap (Deepshaw's defenders fought at ×0.7). Dominion + the chained Titans won Wyrmfield against a host that had beaten the king on turn 2.
**Never found a use for:** nothing in the kit went unused, but Tribute of Fear paid 1g in two turns and Dark Pact's company cost 7g a turn to keep.
**Strong:** the opening four turns: three provinces by turn 4 under Terror.
**Weak:** upkeep. Monster companies cost 7g a turn each; after Dark Pact the realm owed 43g on 25g income and had to disband (disbanded companies become hireable mercenary bands). Then the map ran out: every neighbour was sea by turn 9. The two hero deaths were my own gamble on Medium lairs, but the view gives no lair tier, so a player cannot tell Weak from Medium before searching.
**Fun:** the first half; the second half was bookkeeping.

## Report and order problems

1. **Ransom is unreachable** for a human player (above). Needs a field in the encounter plan the merge keeps, e.g. `ransom: true`.
2. **The brief's `spy` target is wrong:** the spy reports the province the hero stands in; the target id only scopes discoveries.
3. **The view hides a lair's tier**, and cleared sites keep their index in the feature list while the view drops them, so `search 0` revisited a cleared pit while the Cave Bat was index 1.
4. **A research choice needs `discoveryChoices` in the payload** (added to the harness); the view only says "choose in the 💡 Research box".
5. **An heir's name and points go through `kingSkills`** (added to the harness). Without it the heir keeps his crowned skills and 4 unspent points.
6. **Hartheight's stones reported "awake already"** when Vespera tried the rite on turn 15, though no Pagan hero had woken them (Call Storm had struck the province twice). Either the storm woke them or the message is wrong.
7. **Sea hexes count as provinces** once a ship passes ("Draven claims Foam Channel"): Evil's standings line said 9 provinces for 6 land.
8. **The turn-2 report named Urukwells' defenders "Mira the Grounded's forces"** though Mira was a wanderer for hire two provinces away.
9. The king's default duel refusal (no plan) costs −20%; with a plan it is a real choice. Worth saying in the portal.

## Three balance observations

1. **Favour of the Old Gods scales with the map, not with play.** Six stones in eight provinces capped it by turn 9 at no cost beyond 5g a site. On a stones-rich seed Pagan's multiplier is the game; on a stones-poor one it is nothing. A cap tied to provinces held, or sites capped at three, would even the seeds out.
2. **Call Storm needs a cost that scales with what it kills.** 4g destroyed three companies worth 9g of recruits and 9g a turn of wages, and handed over a province without a battle. Suggest: it drops a tier or kills a company, never both, and never a whole garrison; or 8g.
3. **Monster upkeep sinks Evil.** Three Titan companies at 7g each were 60% of the realm's income; Dark Pact added one more at 10.5g plus HP. Either monster companies should cost half upkeep for the Evil kit, or Dark Pact's company should be wage-free for three turns like the Wild Hunt's beasts. And Neutral's bought garrisons should cost half wages, or the pact price should be spread over turns, so a Trade Pact does not raise wages as fast as it raises tax.
