# g7: Neutral (Dwarven) v Druidic (Elven) v Good (Human), hostile diplomacy, seed 707, 16 turns

Hand-played, every realm by me, with the round-23 kits. Diary: g7-diary.md.

## Result

| Realm | Provinces | Gold | Tax v wages (turn 16) | Field army |
|---|---|---|---|---|
| Good | 11 | 128g | 73 v 56 | 15 companies (king 7, Willowen 7), most Elite |
| Druidic | 9 | 120g | 67 v 57 | 12 (Bertram 5 with 2 Ents, capital 7) |
| Neutral | 6 | 80g | 44 v 17 | 1 company and a Green Ent in garrison |

Good and the Druids never met. The war was Neutral v Druidic on the middle rows. The Druid king died in a duel on turn 14; the Neutral king lost his host three times (turn 2 to manticores, turn 9 to the Defend trap, turn 15 storming the Druid capital at 86% against).

## What the kits did

**Neutral**
- *Trade Pact* is the strongest thing in the game and also broken in two ways. It bought Gnahold (tax 7) for 28g with the Druid king's 8-company host standing in it, and Elugrove for 20g with Vervain's 3 companies in it: "its 0 companies are turned loose". Only garrison companies count as "defending", never a led host. Then (turn 15) it bought Balpass from Feralfield: the order buys the province named in `prov:<id>` without checking the hero stands there. When the 4 leaderless companies at Balpass were a garrison, they were turned loose (32g) and scattered as three bands, one an Elite Ent, offered to the League at 1 to 2g. Suggested rules: the hero must stand in the province; every enemy company in the province counts, led or not; or a capital-style ban on provinces with an enemy hero present.
- *Trade Pact land cannot be held*: the pact leaves no garrison, and the enemy retakes it next turn by stepping out and in ("seizes the undefended province"). Three provinces changed hands five times this way.
- *Ransom cannot fire for a human player*: the plan filter (src/engine/turn/set-up-the-turns-start-repairs-and-the-merge-of-the-realms-orders.ts:130, `encounterPlanAsAPlanHasIt`) keeps only tactics, notes, duelStance and evilMode, so the `ransom` flag the rule reads (src/engine/heroes/pursuits-and-the-catch-roll.ts:37) never reaches the hero. Cerwyn won a personal encounter against Ryn with the flag set and "ran him down and slew him". Also, the Ransom rule lives in the pursuit path only (the Encounter order); a battle duel never captures.
- *Guilds*: a realm whose three heroes rolled no Spy gets nothing from it until someone practises from level 0 (five tries). Once Cerwyn had Spy 3 (counted 4), spying was 100%.
- *The League hires best* and *The bands come to the League*: every band fled toward Bromvale within a turn; a 3g band cost 1g and mustered Veteran. Hiring a band inside an enemy's empty province captured the province (turn 16, Feralfield). Hiring one inside an unclaimed defended province started a battle (Good's Sanctus, turn 8).
- *Embargo*: −20% of the Druids' tax for 2 turns for 5g; it bit (44 → 30 with a province lost the same turn).
- *Open ranks*: the king led Orc Berserkers and Black Arrows at ×1.25, but "Druid shortfall −20%" still applied to them (humanoid orcs under a dwarf): worth a look.
- *Markets*: the capital paid 15 not 10 from turn 1.

**Druidic**
- *Home of the Wild* ×1.5 with the elves' woodland ×1.5 and kinship ×1.44 made every forest or jungle fight a rout (277 v 12, 365 v 30, 722 v 345 at the Neutral capital). In the plain the same host was 145 and lost its king.
- *The beasts are yours* (shown as "Parley with the Wild ×1.5"): took two Ent provinces at 70-100% and a free Green Ent each time; *The wild breeds* put a second Ent into Elderdelve by turn 6 and a Veteran Ent recruit cost 4g at Scalegreen.
- *Call of the Wild* worked: both garrison Ents walked 3 hexes to the king for 2g each, the Elite Ent among them.
- *Grow the Wild* turned the desert capital into jungle for 8g on turn 6; on turn 15 that jungle and the ×1.5 home ground stopped the Neutral king cold.
- *Healers' fees* paid 3 to 6g a turn. Wages were the Druids' problem all game (break-even to −10g a turn until Feralfield's tax 8 and Bromvale's 10 came in).

**Good**
- Good took land steadily against neutral defenders: 11 provinces by turn 16, never meeting a beast army. *The Villages* carried the economy: at turn 6 three of its four provinces were tax ≤4 and paid +3 each; by turn 10 tax 47 v wages 36.
- *Light the Beacons* (turn 13, from a central province): 6 Veteran companies into 6 garrisons for 12g; wages went 45 → 56 against tax 61. It is a defensive buy that eats the Villages' surplus; without an enemy next door it was dead money.
- *Hearts of Oak* did not save Sanctus, killed by a Weak lair's Skeleton Sentinel inside Good's own Wendhold (turn 10): either the 50% failed or lair deaths are outside the rule. Worth checking.
- King2's Tactical rose 2 → 8 in ten turns from battles alone; three levies were Crack by turn 3 and Elite by turn 7. *Knights errant* (double Tactical/Melee gain outside the realm) is likely the engine of that, and it is strong.
- Good never found a use for Good Works (no Terror in a game without Evil) or Reclaim (it never lost a province).

## Reports and orders: what tripped me up
- Defend with an army rides out at any odds: King0 charged 98 into 412 because a bought province put the enemy "in Neutral land". A human reads Defend as hold.
- The recruit list does not mark ships (Dwarf Ironclads): a king who buys them cannot march.
- "Recruitment was entirely blocked: ." with an empty reason (turn 8); on turn 16 the same message named the reason.
- A Crack Yeoman Longbows company died in a 98% margin win (turn 6) and again in a 9% one (turn 16): archers are exposed somewhere.
- A dead hero's "Melee rises to level 1" (Ryn, turn 13).
- The hire line prints twice.
- "A lone hero in an enemy province" is never attacked and spies at will.
- Good's intel line "composition unknown — Spy this province to reveal" is useless to a realm with no Spy hero.

## Balance notes from this game
- Druidic beats Neutral in any forest or jungle by 3:1 or more; Neutral's only answers were the pact and the duel (the dwarf king's Melee 4 and two arrows killed a 26-HP Druid king).
- Neutral's kit is all gold and law, and the law is leaky: fix the three Trade Pact holes and the Ransom filter before the next matrix, or the bots' Neutral numbers mean little (bots never submit plans through the filter and may set the flag directly, so they could be ransoming where no human can).
- Good's bot record (15%) is not what a human gets: careful expansion, Villages and Tactical growth gave Good the largest realm here, with no enemy to test Shield of the Realm.
