# g8 report: Evil (Orcish) · Druidic (Elven) · Neutral (Human) · Pagan (Dwarven) — seed 808, 16 turns, round-23 kits

## Result
Neutral wins on tax base and gold by a wide margin (11 provinces, tax 106, 467g unspent). Druidic second on land (12 provinces, tax 70), Evil third (10 provinces, tax 52), Pagan last (5 provinces, tax 46) after losing three woken stones provinces to Trade Pact.

Turn-16 standings: Neutral tax 106 / 467g · Druidic tax 70 / 178g · Evil tax 52 / 152g · Pagan tax 46 / 140g.

## How each kit played

**Neutral (won).** The economy ran away: 143g by turn 9, 301g by turn 13, 467g at the end, with Markets, Market Towns, Spice Roads, Wool Trade, Trade Compacts and Taxation Records all stacking on a Sage who reached level 9 (Grand Library: a guaranteed discovery every turn). Trade Pact was the decisive ability: it bought Dunsverge and Dawnshaw from the wild, then Fairhollow (16g), Starleaf (24g) and Stonereach with its 2-company garrison (34g) from the Pagans *during the war*, with no battle. A hero "leading no units" captured three enemy provinces in two turns. Embargo (5g) cost the Pagans about 9g a turn for two turns. The old king died accepting a duel from an independent hero at Gashsands (turn 7); the heir needed a kingSkills allocation. Neutral's host was twice beaten by the Pagan kit: a storm destroyed 1 and demoted 4, then The Old Stones ×1.6 repelled 12 companies, then a second storm destroyed 6 of the 11 survivors. Neutral never used Condottieri (no mercenaries hired: the pact's defenders stayed as a garrison instead of becoming a band) or Ransom. Assassinate needs Spy 9.

**Druidic (second).** Home of the Wild made the king unbeatable in jungle and forest (285–338 strength with 6–7 companies) and he took nine wild provinces, all by duel-and-storm; two lost duels only for the independents. Grow the Wild turned Faewaste desert to jungle for 8g. Healers' fees paid 3–4g a turn throughout. The wild breeds gave a free Thunderbird at Eldercopse on turn 15. What went wrong: every province was left ungarrisoned, so when Evil declared war (effective at once) the Evil king walked through Haldleaf and broke the capital's 7 defenders; the Druidic king answered by walking into the Evil capital and four other empty provinces. The two kings swapped capitals and never met.

**Evil (third).** Terror did the early work: −30% on every neighbour from turn 3, so the king took five provinces by turn 6 without a loss. Dominion of the Pits + Savage Fury took Wilddown's 4 Veteran Manticores on the second try (13 companies, pyrrhic), after which the Dark Pact (7.5g, −6 HP) and Veteran Manticore recruits at the pits made every host ×1.5. Vex's Skeletal Armies (Necromancy 3–4) raised 10 free companies from two battlefields, including 3 Manticore Prides, but when he died in a duel his 8 skeletal companies crumbled at once. Tribute of Fear paid 1–2g. Evil's economy stalled at 50–60g tax against 50g wages. The war on Druidic worked (five provinces seized) but left the capital empty.

**Pagan (last).** Favour reached the ×1.5 cap by turn 9 (3 woken sites) and The Old Stones ×1.6 held Titanweald against 12 companies. Blood Harvest paid 2–4g and a promotion per fight; Rite of Awakening (+3 tax each) was the best gold spent. Call down the storm at 4g was the strongest single order in the game: 1 + 6 companies destroyed and 4 + 1 demoted in two castings on Beastridge, and it is castable every turn. The Rite of the Ley worked (Stonereach to Titanweald). Wild Hunt never worked: it wants an *unclaimed* creature/monster province next to the stones, and the realm's own Fangthicket does not count. Pagan's early game was the worst of the four: two repulses at mountain fronts of 2 (Fangthicket's trolls, Baldeep's guns) left it at 3g with wages above tax until turn 6, and Cave Trolls shown as Fangthicket's recruits cannot be raised. Then the Trade Pact took three of its five stones provinces for 74g.

## Balance observations
1. Trade Pact on enemy land in wartime is a hole: for 4g a tax point + 3g a company a hero with no army buys an enemy province, garrison included, with no battle. Neutral took three Pagan provinces (one with 2 defenders) in two turns for 74g. Suggest: no pact on a realm the League is at war with, or a price per defending company that tracks strength (not 3g), or the garrison refuses while an enemy hero is in reach.
2. Call down the storm at 4g, every turn, with 1-in-4 destruction, kills whole hosts: 7 of 11 companies over two turns. Suggest 8–10g, or once every 2 turns, or 1-in-6 destruction.
3. The Old Stones ×1.6 and the ×1.5 Favour cap arrive together by turn 9 if stones are common (this map had stones in about a third of provinces). Fine, but the Pagan then has no reason to attack: it won every defence and lost land only to gold.
4. Evil's Terror (−30% on every neighbour) plus Dominion plus Savage Fury make an Evil king near-unbeatable against wild provinces; its weakness is the economy and heroes dying in duels (Vex, Melee 0, accepted twice).
5. Druidic in forest/jungle is the strongest conqueror of wild land; its weakness is that nothing in the kit garrisons.
6. A necromancer's skeletal companies crumble at his death (today's rule): a 9-company host became 1 company. Worth a line in the player's report when it happens; nothing said so.

## Report and order problems seen
- Spy with a target province still reports the hero's own province ("spies on Dunsverge") three times a turn.
- The hire line prints twice (Cade the Drifting).
- Recruit "Type|qty" silently caps at the leader's lead limit and reports only what was raised; a failed type prints "2 (not raised here)" as if "2" were a unit type.
- "recruits: Cave Trolls" shown for a Pagan-held monster province the Pagan cannot recruit from.
- Trade Pact refused on a creature province with "needs an unclaimed humanoid province here or next door"; the kit text says humanoid, fine, but the view does not show which provinces are creature/monster until owned ("Primal:Unicorn").
- Refusing a duel costs morale ×0.8 ("will not answer the call") and an accept with Melee 0 kills the hero: the report never explains the stance trade-off.
- A new king needs name, temper and 4 skill points through kingSkills; the hand-play brief lacked the format (now known: {"kingSkills":{"<id>":{"name","temper","skills":{...}}}}).
- Leaderless garrison of a dead necromancer's skeletons vanishes without a report line.
- Research choices arrive two or three a turn at Sage 7+; the key format rcT_hero_phase is not shown in the report.
