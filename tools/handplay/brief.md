# Kingdoms Call hand-play brief (round 23 rules)

## How a turn works
Each turn every hero gives 5 orders (phases 0-4). Orders are JSON: {"<heroId>": [5 orders], ..., "diplomacy": {"<realmIndex>": "enemy"|"treat"}} (diplomacy optional; 'treat' = offer peace/alliance, 'enemy' = declare war; allowed from turn 3). An order is {"action":..., "target":..., "extra":..., "desc":...}. A hero with no orders Rests all turn. A king gives orders like any hero plus the king-only ones.

## Actions and their targets
- move: target 'dir:NW'|'dir:NE'|'dir:W'|'dir:E'|'dir:SW'|'dir:SE' (one hex per phase; moving into an unclaimed province with defenders, or an enemy's, starts a battle with the armies you lead; a hero alone can enter unclaimed land but takes it only with an army). Sea needs ships.
- explore: '' (maps the province you stand in; finds lairs, ruins, holy sites, stones, barrows)
- search: target the feature's name or index from the report (fights a lair's guardian in personal combat; heroes with Melee/Archery 3+ do well against Weak lairs)
- recruit: target 'Type|qty,Type|qty' (in a province you own; see 'recruit here' prices; 'merc:<id>' hires a mercenary band standing there). Companies cost their price and a wage each turn.
- hire: target '<wandering hero id>' (standing in the same province)
- rest: '' (heal) · defend: '' (hold)
- practice: target a skill name (melee, archery, tactical, march, white, druid, necromancy, sage, spy, thief, explorer, naval, psychic, illusory, elemental)
- research: '' (Sage) · spy: target '<province id>' · steal: target '<char id>' · assassinate: target '<char id>' (needs Spy; war)
- encounter: target '<char id>' (chase an enemy hero and fight a duel or battle) 
- cast_spell: target spell name, extra target id where needed (e.g. 'Skeletal Armies', 'Bless Province' extra '<prov id>', 'Resurrect', 'Plague', 'Charm' extra '<char id>')
- leave_army: target 'all' or 'Type' (set down as garrison) · pickup_army: 'all' (take the garrison with you) · disband_army: 'Type'
- Kit orders: consecrate '' (Divine, White 2, 5g) · good_works '' (Good) · grow_wild '' (Druidic, Druid 3, 8g) · trade_pact 'prov:<id>' (Neutral) · despoil '' (Undead: Blight the Land, 3g) · harvest_field '' (Undead, 2g a grave) · rite 'awakening'|'wild hunt'|'blood offering' (extra 'S:i,j|E:a,b' army indices)|'ley:<prov id>' (Pagan, at stones) · spread_dread '' (Evil)
- King-only kit orders: proclaim_crusade 'realm:<i>' (Divine, 6g) · light_beacons '' (Good) · call_wild '' (Druidic) · embargo 'realm:<i>' (Neutral, 5g) · call_storm 'prov:<id>' (Pagan, 8g) · dark_pact 'type:<monster kind>' (Evil) · bind_bones '' (Undead, 2g a company) · call_to_arms '<prov id>' (Good's old free Green garrison) · broker '' (Neutral: hire a seen wanderer / buy a spy report)

## Playing well (as a thoughtful human would)
- Turn 1-3: explore the capital, recruit 2-3 companies a turn with the king and a hero, then take the nearest unclaimed provinces (3-4 companies beat 1-3 neutral defenders; forests favour elves, mountains dwarves). Keep 2-3g spare for wages.
- Use your kit's engine from turn 2-4: Divine consecrate outward; Good let the Villages pay; Druidic take creature provinces; Neutral buy cheap provinces by Trade Pact and hire bands; Pagan find and wake stones; Evil take a monster province and Spread Dread; Undead cast Skeletal Armies at the barrows and on battlefields (Harvest the Field is gone) and blight a poor province or two.
- Diplomacy from turn 3: declare war ('enemy') on the neighbour you intend to attack; a realm at peace cannot be attacked.
- Heroes without armies are useful: explore, search weak lairs for gold and items, practise, cast.
- Watch gold: companies cost wages every turn; if you cannot pay, companies disband.

## Divine kit

- **Consecrate** (Hero order, Province effect; 5g a province): A hero with White 2 or more (the signature +1 counts) spends one phase to consecrate the province he stands in. The province must belong to the realm and border hallowed ground (the capital counts as hallowed to begin with). No cap. A consecrated province that changes hands loses its consecration. 5g.
- **Tithes** (Money, Province effect; free): A consecrated province pays 50% more tax (rounded down) for as long as it stays consecrated.
- **Holy defence**: now part of Smite the Unholy (below).
- **The Last Rites** (Province effect, Anti-Undead; free): The Last Rites are said over every battle fought on consecrated ground: any army unit of any realm killed there leaves no grave, so nothing can be raised from that field by necromancy.
- **Blessed levies** (Recruitment; free): Humanoid companies recruited in a consecrated province muster as Veterans rather than Average.
- **Divine Grace** (Hero advantage; free): A slain Divine hero returns at the start of the next turn, at the consecrated province of the realm nearest to where he fell. Below Divine Power 2 the return spends that province's consecration (it must be consecrated again). Two things stop the Grace: a Divine hero slain on blighted land does not return (his body lies where he fell, and only the Resurrect spell can bring him back), and a Divine hero whose soul an Undead hero has taken does not return while the Undead king lives (see the Undead's The soul is taken).
- **Smite the Unholy** (Battle bonus; free; was called Crusade): Divine hosts fight at ×1.5 against Evil forces, when storming a wild province held by monsters, against any host with a creature or monster company in it, and when defending consecrated ground (Holy defence above). Against Undead forces the bonus is ×1.75. The bonuses do not stack: the best one that applies is used.
- **Proclaim Crusade** (King order; 6g, lasts 3 turns, then 3 turns before the next): The king names a realm the crown is at war with. For the next 3 turns: every Divine host fights that realm's forces at ×1.5 wherever they meet, every province taken from it is consecrated at once and free, the realm counts one point more of Divine Power, and the two Crusade benefits below apply. Can be proclaimed again 3 turns after the last ended. 6g.
- **Hounds of God (Crusade benefit)** (Hero advantage; free, while the Crusade lasts): While the Crusade lasts, a Divine hero who Encounters or pursues a hero of the named realm within his reach always catches him: the chase roll cannot fail, and the quarry cannot Vanish or slip away before the duel. The named realm's heroes cannot hide from the Church.
- **Holy wrath (Crusade benefit)** (Hero advantage; free, while the Crusade lasts): While the Crusade lasts, in personal combat against a hero of the named realm every Divine hero counts Melee two levels higher and his blows do 25% more harm.
- **Holy sites** (Coveted place; free): About one land province in five holds a holy site, found by exploring. Divine Power = the holy sites the realm holds, + 1 more for each of them that is also consecrated (a 'shining' site), + 1 while a Crusade lasts, + 1 for every two consecrated provinces (round 24). Each level of Divine Power brings a gift of the faith, listed in the six rows below; a gift is kept only while the realm's Power stays at or above its level.
- **Power 1: Sanctuary** (Hero advantage; free, at Divine Power 1): A Divine hero standing in a consecrated province cannot be assassinated, charmed or robbed, and all healing he receives there is doubled.
- **Power 2: Grace abounding** (Hero advantage; free, at Divine Power 2): A hero returning by Divine Grace no longer spends the consecration of the province he returns to.
- **Power 3: Revelation** (Sight; free, at Divine Power 3): The realm sees every holy site province on the map, as if a hero stood there.
- **Power 4: Pilgrim roads** (Movement; free, at Divine Power 4): A Divine hero leading armies who starts the turn in a consecrated province moves for the rest of that turn as if his March skill were 3 levels higher.
- **Power 5: Absolution** (Province effect, Hero advantage; free, at Divine Power 5): At the end of every turn, every curse, charm, plague and stack of Terror on the realm's provinces and heroes is lifted. The faith washes the realm clean each season.
- **Power 6: The Church Triumphant** (Province effect, Hero advantage; free, at Divine Power 6): Every province the realm holds counts as consecrated for Divine Grace, the Last Rites and Sanctuary (not for Tithes, Holy defence or Blessed levies), and the king cannot be charmed, cursed or assassinated anywhere.

## Good kit

- **Shield of the Realm** (Battle bonus; free): A Good host defending a province the realm owns fights at ×1.5, and at ×1.75 when any company of any kind is garrisoned in that province. Does not stack with Reclaim.
- **Reclaim** (Battle bonus; free): A Good host attacking a province the realm lost within the last 5 turns fights at ×1.5. Does not stack with Shield of the Realm.
- **Light the Beacons** (King order, Recruitment; 2g a company, every 3 turns): The king calls the shires to arms: every humanoid province of the realm within 3 hexes of the king, nearest first, up to 6, raises a Veteran company of its own kind into its garrison at 2g a company. Round 24: the muster serves WITHOUT wages for 3 turns, then goes home (it is a muster, not a standing army). Can be used again 2 turns after the last.
- **Watch-fires** (Sight; free): The beacons are always manned. In every province the realm has seen before (not those still in the fog of war) within 2 hexes of its land, the realm sees every enemy hero leading armies exactly as a Good hero standing there would: the hero's name and realm, the skill he is most famous for, and the rough size of his force. Heroes travelling alone are not seen.
- **Good Works** (Hero order, Province effect; free): A hero in a province of the realm sits in judgement there for one phase. The province is cleared of every stack of Terror and every plague on it, no new Terror or plague can touch it for the rest of the turn, and for the rest of the turn enemy Spies and Thieves acting there have their chance of success halved. The hero's own province only; a province can receive Good Works once a turn.
- **The Villages** (Coveted place, Money; free): Every humanoid province of tax 5 or less pays 3 more tax while a Good realm holds it (round 24: 5; was 4).
- **Hearts of Oak** (Hero advantage; free): A Good hero struck down inside a province of the realm is carried from the field by the folk, half the time (a 50% chance): he lives at 1 HP, is carried to the closest province owned by the Good realm, and the rest of his orders for the turn are cancelled. The other half of the time he dies as any hero would.
- **Loyal hearts** (Hero advantage; free): Good heroes cannot be Charmed, and never desert for want of pay.
- **Knights errant** (Hero advantage; free): A Good hero who wins a battle or a duel outside the realm's own land gains twice the usual experience from it, and his Tactical and Melee skills rise twice as fast however they are earned. The young knights go out to find their renown.

## Druidic kit

- **Home of the Wild** (Battle bonus; free): Every Druidic host fights at ×1.5 in forest and jungle provinces, attacking or defending.
- **The beasts are yours** (Coveted place, Battle bonus; free): Creature provinces are the Druids' prize. Storming an unclaimed creature province, a Druidic host fights at ×1.5, stacking with Home of the Wild (×2.25 in a forest or jungle creature province). When it falls, a Green company of its beasts joins the captor if he has room to lead it.
- **The wild breeds** (Recruitment; free): While the realm holds a creature province, every 4th turn a free Average beast company of that province's kind joins its garrison (up to 3 there). Beasts recruited in a creature province of the realm muster as Veterans.
- **Grow the Wild** (Hero order, Province effect; 8g): A hero with Druid 3 or more spends one phase to turn the plains or desert province he stands in, which the realm must own, into forest or jungle, for good.
- **Call of the Wild** (King order; 2g a creature that comes, every turn): The king sounds the horn: every creature company garrisoned in a province of the realm within 3 hexes comes to his side, as many as he has room to lead, for 2g a company that comes. Can be used every turn.
- **The Wood Provides** (Money; free): Creature companies in a host standing in forest or jungle pay half their wage that turn.
- **Beast-friend** (Hero advantage; free): Every Druidic hero can lead 2 more beast companies than his Druid level allows.
- **Beast mastery** (Hero advantage, Battle bonus; free): Beast mastery grows twice as fast for Druidic heroes: a beast fights 40% harder for every Druid level its leader has above the level that beast needs (today's rule for everyone else is 20%), capped at +100%.
- **Green healing** (Hero advantage; free): A Druidic hero who ends the turn in a forest or jungle province heals a quarter of his maximum HP.
- **Healers' fees** (Money, Hero advantage; free): The folk bring their sick and their cattle to the druid and pay in kind. A Druidic hero who ends the turn in a humanoid province, whoever holds it (the realm's own, another realm's or unclaimed), earns his realm gold equal to half his Druid skill, rounded up: Druid 1 or 2 earns 1g, Druid 3 or 4 earns 2g, Druid 5 or 6 earns 3g. No fee is earned in a consecrated province (the Church does not trust the druids' healing), in a province under Terror (the folk are too scared to venture out), or in a despoiled province (what folk are left have worse things to worry about). One fee per hero per turn.
- **Earth-speech** (Sight; free): The land speaks to the druids. The realm is told of every province within 2 hexes of its land that holds a ritual site, a holy site or a barrow, whether or not anyone has explored it: it knows something old sleeps there, but not which of the three. Lairs are not felt.

## Neutral kit

- **The League hires best** (Recruitment; free): Mercenary bands cost a Neutral realm 2g less to hire and muster one quality tier higher than they would for anyone else.
- **The bands come to the League** (Movement; free): Every mercenary band anywhere in the world, whenever it moves, moves toward the nearest Neutral realm's home province, one step a turn, and waits there until hired (by anyone). If that home province changes hands, the bands turn toward the new one.
- **Deserters turn mercenary** (Battle effect; free): When a Neutral host defeats an enemy in battle, the enemy companies that would normally desert become a mercenary band instead, standing where they fled, ready to be hired.
- **Condottieri in battle** (Battle bonus; free): A band hired by a Neutral realm keeps its band name and is marked '(condottieri)' for the rest of the game. Such a company fights at ×1.5, and at ×1.75 against a host with a creature or monster company in it. The bonuses do not stack.
- **Open ranks** (Hero advantage; free): Neutral kings and heroes lead humanoid companies of any race at ×1.25 (one kinship bonus for everyone), and never suffer the −20% of the old grudges between races.
- **Trade Pact** (Hero order; 4g a point of tax + 3g a defending company): A hero buys the humanoid province he stands in, for 4g per point of tax and 3g per defending company, whether it is unclaimed or another realm's; a capital cannot be bought. Round 24: no pact on a province where another realm's hero stands, and none with a realm the League is at war with. No battle is fought: the province joins the League, and its defenders are turned loose as a mercenary band standing in the province.
- **Embargo** (King order; 5g, any turn): The king closes the League's markets to a realm the crown has met: for 2 turns that realm pays 20% less tax, and its creatures and monsters cost double to recruit. No waiting between uses and no limit on how often the same realm is the target. Broker (today's Neutral king order) stays beside it.
- **Markets** (Coveted place, Money; free): Prosperous and Rich provinces (tax 4 or more) pay half again as much tax under a Neutral realm, in place of today's flat +20%.
- **Guilds** (Hero advantage; free): Spy and Thief count one level higher on every Neutral hero who has them, and rise twice as fast however they are earned. (Sage +1 comes from the general rule; today's Scholars rule, +5% discovery chance per Sage level, stays.)
- **Ransom** (Hero advantage, Money; free): Venice did not kill what it could sell back. A Neutral hero sets in his encounter plan whether he fights enemy heroes to kill or to capture. When he wins a duel he set out to win by capture, the loser is spared and held to ransom instead of killed: he travels with his captor, gives no orders and fights no duels. The ransom is 1g for every skill level the captive has, all his skills added together. At the start of each turn the captive's realm may pay the ransom to the League and have him back at once, standing where his captor stands; if it does not pay, he stays held, with no limit on how long. If the captor is slain, the captive goes free where the captor fell.

## Pagan kit

- **Ritual sites** (Coveted place; free): Ritual stones stand in some provinces, found by exploring; each Pagan realm begins beside one. A stones province the realm holds is 'found'; one it has performed the Rite of Awakening on is 'woken'. Holding and waking the stones is what the next six rows are about.
- **Favour of the Old Gods** (Battle bonus; free): Favour points: 1 for each ritual-stones province the realm holds, 1 more for each it has woken. Every Pagan host fights at ×(1 + 0.08 × points), capped at ×1.5 (6 or more points). A host defending a stones province of the realm fights at ×1.6 whatever the Favour.
- **Rite of Awakening** (Hero order, Money; 5g): A hero at ritual stones in a province the realm owns spends one phase to wake them, for the rest of the game: the province pays 3 more tax for good, the realm gains a Favour point, and the other three rites are unlocked once the realm has woken its first site. One rite per province per turn.
- **Rite of the Wild Hunt** (Hero order, Recruitment; the price of one beast company): At woken stones the realm has found, a hero binds two of a nearby wild province's beasts for the price of one: they join him as wage-free Veterans until the end of the following turn, then go back to the wild. Needs a woken site anywhere in the realm. One rite per province per turn.
- **Blood Offering** (Hero order; the companies sacrificed): At woken stones, a hero sacrifices companies of his host; an equal number of his other companies rise two quality tiers (to Elite at most). Needs a woken site anywhere in the realm. One rite per province per turn.
- **Rite of the Ley** (Hero order, Movement; free): A hero and his host standing at woken stones of the realm step along the ley to any other woken stones of the realm, arriving at once. One rite per province per turn.
- **Call down the storm** (King order; 8g in round 24, once a turn): The king calls the sky down on a province: any province that holds stones the realm has woken, or any province next to one, whoever holds it now. Every company standing there, whoever owns it (the Pagan realm's own included), has a 1 in 4 chance of being destroyed, and every company not destroyed has a 1 in 2 chance of falling one quality tier. Hosts there may move next turn, but every company's base movement is halved. Fleets in the seas beside the province are scattered one hex. Once a turn.
- **Blood Harvest** (Battle effect, Money; free): Every enemy unit destroyed in a battle a Pagan host wins pays the realm 2g, and for each there is a 50% chance that one random company on the winning side rises one quality tier (to Elite at most).
- **The ancestors watch** (Sight, Hero advantage; free): A slain Pagan hero does not leave the world: his spirit lingers in the province where he fell for the rest of the game, and the realm sees that province and every province next to it as if he still stood there. If the hero is resurrected the watch ends, and begins again where he next falls.

## Evil kit

- **Terror** (Battle effect, Province effect; free): Every victory an Evil host wins lays 2 stacks of Terror on the province and its neighbours, and slaying an enemy hero in personal combat lays Terror the same way. Each stack weakens the defenders there by 10% (to 3 stacks, −30%) against the hosts of this Evil realm and of its allies, never against anyone else. A stack fades every 3 turns unless a new victory or Spread Dread renews it; Terror is wiped the moment the province changes hands.
- **Spread Dread** (Hero order; free, once a turn per hero): A hero in a province of the realm sends out his fearmongers: the province he stands in and every province next to it takes one stack of Terror (10%), unless it already carries Terror; the order never raises a province above one stack. Once a turn per hero, every turn.
- **Tribute of Fear** (Money; free): Every enemy-held province under this realm's Terror pays it 1g a turn (whatever the stacks), with no upper limit.
- **Savage Fury** (Battle bonus; free): An Evil host with any monster company in it fights at ×1.5 attacking and ×1.25 defending.
- **Dominion of the Pits** (Coveted place, Battle bonus; free): Monster provinces are the Evil realm's prize. Storming an unclaimed monster province, or defending one the realm owns, an Evil host fights at ×1.5, and this stacks with Savage Fury and the realm's other bonuses (×2.25 attacking an unclaimed monster province with a monster in the host). When an unclaimed one falls, a Green company of its monsters is chained to the captor if he has room to lead it.
- **The pits breed** (Recruitment; free): While the realm holds a monster province, every 4th turn a free Average monster company of that province's kind joins its garrison (up to 3 there). Monsters recruited in a monster province of the realm muster as Veterans.
- **Dark Pact** (King order; 1.5 × recruit cost + 40% of the king’s current HP, every turn): The king names a monster of a kind the realm's monster provinces breed, pays one and a half times its recruit cost, and gives 40% of his current HP (rounded down, at least 1): an Average company of it joins him. Can be used every turn.
- **Beast-masters** (Hero advantage; free): Evil heroes can lead 2 more beast companies than their Druid level allows.

## Undead kit

- **The dead fear nothing** (Battle bonus; free): Skeletal hosts fight at ×1.5 under the king or a hero, + 0.05 for every blighted province the realm holds, to ×2.0. (Garrisons without a leader fight at plain strength.)
- **Bind the Bones** (King order; 2g a company, once a turn): The king chooses, from every skeletal company in the province he stands in (his own host, the garrison, and other heroes' hosts there), the ones to raise one quality tier (round 24: to CRACK at most; Elite is earned in battle), at 2g a company. Once a turn.
- **Barrows** (Coveted place, Hero advantage; free): About one land province in five holds a barrow, found by exploring. Each barrow the realm holds adds 1 to every Undead hero's Necromancy, with no cap.
- **The barrow dead** (Recruitment; free): Graves never decay in a barrow province. At the end of every turn each barrow province the realm holds refreshes its graves: a humanoid barrow to three graves (Average units of kinds the province can recruit); a creature or monster barrow to one. The dead in them are raised with the Necromancy spell Skeletal Armies only (round 24: Harvest the Field is gone; the spell raises 1 company at Necromancy 1-2, 2 at 3-4, 3 at 5+, and can fizzle; cast_spell target 'Skeletal Armies').
- **Lichdom** (Hero advantage; free): An Undead king slain while the realm holds a barrow rises again at that barrow at the start of the next turn.
- **Blight the Land** (Hero order, Province effect; 5g): A hero in a humanoid province the realm owns (never a capital) spends one phase to blight it for good, whoever holds it afterwards: the province pays 1 tax and raises no living companies. 3g. The next two rows say what blighted land gives the Undead realm.
- **Grave Goods** (Money; free): Every blighted province the realm holds pays it 4g a turn.
- **The dead of this soil** (Recruitment; 1g a turn per company): Each turn, in every blighted province the realm holds, an Average skeletal company of a kind the province could recruit before the blight rises into its garrison (up to 4 there), needing no necromancer. 1g a turn each upkeep; they hold the province and cannot be led away.
- **The soul is taken** (Anti-Divine, Hero advantage; free): A Divine hero slain by an Undead hero (in battle or in a duel) has his soul bound in the necromancer's reliquary: he does not return by Divine Grace and cannot be brought back by the Resurrect spell for as long as the Undead king lives. When the Undead king is slain, every bound soul is freed and the heroes may be resurrected or return by Grace as usual.
- **Desecrate** (Anti-Divine, Province effect; free): A consecrated province the Undead realm captures is blighted at once (with everything Blight the Land does), and its consecration is gone.

- **Signature skill +1** (all): heroes count one level higher in their alignment's own skill (Divine White, Good Tactical, Druidic Druid, Neutral Sage, Pagan Explorer, Evil Spy, Undead Necromancy).

## Lessons from the first games (read these too)
- search: the target is the feature's INDEX in the province's feature list (0, 1, 2…) as the view lists them for that province, not its name.
- Hiring a mercenary band: target the band's id exactly as the view prints it (e.g. 'merc_3'), inside a recruit order, alone or with 'Type|qty' tokens separated by commas.
- Duel stance: add "encounterPlans": {"<heroId>": {"duelStance": "challenge"}} to the orders JSON: 'challenge' seeks a duel before a battle, 'accept' takes one offered, 'refuse' avoids it (without a plan a hero fights at a disadvantage). A Neutral hero who wants to capture for Ransom needs an Encounter order and a stance that accepts.
- Assassinate needs a high Spy skill; don't bother below Spy 5.
- A war declared this turn takes effect next turn for most alignments (the Undead's at once), so Proclaim Crusade the turn after you declare.
- Defend with a lone hero can ride out to a neighbour's defence; use rest or explore when you mean to stay put.
- Light the Beacons' Veterans (round 24) are wage-free for 3 turns and then leave: light them when a fight is coming, not before.
- Round 24: Harvest the Field is gone. The Undead raise the dead with Skeletal Armies (a necromancer's spell, per phase, from the graves where he stands: barrows refill, battlefields keep their dead a few turns). Bind the Bones binds to Crack at most.
- Round 24: Evil's 'casts down the altars' promotes ONE company of the column, not all. Ransom: a Neutral hero may set {"encounterPlans":{"<id>":{"duelStance":"challenge","ransom":true}}} to capture a hero he beats in a personal encounter (1g a skill level, paid by the loser's realm).
- Ten-realm games: new with --alignments of 10 and --races of 10 (the board is 16x11). The view of a realm is long: read your own provinces and heroes first, then only the neighbours that matter.


## Round 25 changes (these replace anything above that disagrees)
- **Sight (new, all realms):** another realm's hero LEADING ARMIES in a province next to one you own is seen, with the size of his host at a glance (a small escort, a modest band, a sizeable host...). A lone hero there is not seen. The view lists what you see.
- **Undead:** skeletal companies cost 1g for every two (rounded up). Harvest the Field is still gone; Bind the Bones still stops at Crack.
- **Evil:** with no monster province of its own, the Dark Pact may name any monster ('type:<kind>') at twice the price. Monster companies of a kind the realm's own monster provinces breed draw half wages.
- **Neutral:** no Trade Pact on another realm's province that changed hands this turn or last. Another realm's defenders cost by strength: 3g at Average, 1g a tier more or less, twice that for a creature or monster company. A refused pact now says which rule refused it.
- **Good:** the Villages pay +3 on tax 4 or less and +2 on tax 5. Knights errant no longer doubles Tactical gains from level 5. The Beacons are unchanged (wage-free muster, home after 3 turns).
- **Divine:** a point of Divine Power for every THREE consecrated provinces (was two). The realm's report now says when its Power changes and which gifts it gives. Sanctuary also heals a Divine hero ending the turn on consecrated ground a quarter of his HP. Pilgrim roads apply from any consecrated province the host stands in.
- **Pagan:** unchanged (storm 8g).
- **All realms, a gold sink:** a province musters ONE company of a kind beyond its limit each turn at twice the price (a 'pressed levy'): recruit qty 2 where the limit is 1.
- **Games run to 20 turns.**


## Round 26 changes (these replace anything above that disagrees)
- **Undead:** skeletons cost 1g each again. Skeletons may now stand as a garrison WITHOUT a necromancer in a barrow or a blighted province the realm holds (the dead of that soil); anywhere else they still crumble at the end of the turn.
- **Evil:** a Dark Pact once every two turns. Only monsters standing in the garrison of the monster province that breeds their kind draw half wages (a monster in a host pays full wages). The pact from afar is unchanged (double price).
- **Divine:** Divine Power stops at 6. Each held holy site counts once; only the FIRST consecrated (shining) holy site counts a second point. A Crusade still adds 1 and every three consecrated provinces add 1.
- **Pagan:** the storm destroys at most two companies a cast (demotions unchanged; 8g).
- **Neutral:** a pact on ANOTHER realm's province needs notice: the first pact order only sends the envoys (free) and tells the owner; the pact can be sealed from the next turn (within two turns), at TWICE the price. A hero of the owner standing there still blocks it. Unclaimed land is unchanged.
- **Neutral, Ransom:** a League hero with {"ransom":true} in his encounter plan who wins the duel before a battle (the duel stances: he should 'challenge') takes the beaten hero alive for ransom; that hero's host fights on leaderless. A captive cannot be chased or killed by anyone.
- **Every realm:** a realm whose capital has no garrison and no hero of its own in it, with another realm's host next door, is warned in its report.
- **Unchanged:** Evil and Undead wars still start the turn they are declared (Toby will ask playtesters). No new gold sink (Toby will handle it).
- **Games run to 20 turns, every realm giving orders every turn.**


## Round 27 changes (these replace anything above that disagrees)
- **Neutral, Trade Pact:** a pact on ANOTHER realm's province is still two steps (notice this turn, seal from next turn at twice the price), and the seal must now be the THIRD, fourth or fifth order of the turn: the elders refuse it earlier. So the owner's hero who marches in with his first or second order arrives first and blocks it.
- **Neutral, Ransom:** a new path. When the League WINS a battle and the beaten commander is a hero (not a king) whose host lost half or more of its companies in that battle, he is taken for ransom if any League hero standing in that province has {"ransom":true} in his encounter plan (duel stance does not matter). What is left of the captive's column scatters. His realm pays 1g a skill level at the start of a turn and he is freed where the captor stands. Kings cannot be ransomed. The duel paths still exist.
- **Undead:** a barrow now always stands within two hexes of the Undead capital. Casting down a consecrated altar promotes ONE living company of the column (as Evil's does), not all.
- **Pagan:** the storm drops at most four companies a quality tier a cast (and still destroys at most two); its line names the companies hit.
- **Evil:** no Dark Pact while the king is below half his HP.
- **Unchanged:** surprise wars for Evil and the Undead, no new gold sink, Druidic as it was.


## Round 28 changes (these replace anything above that disagrees)
- **Neutral, Ransom:** a captive is HELD for one full turn before his realm may pay. The price is 3g for every skill level he has. Once paid (automatically, at the start of a turn, if the treasury can) he is freed at his own capital. His surviving companies no longer vanish: they fall back leaderless into the garrison of his realm's nearest province. A beaten hero with nowhere to retreat is also taken (when a League hero there carries the ransom plan).
- **Neutral, Trade Pact:** sending envoys (the notice on another realm's province) costs 3g, and the League may have only one notice standing at a time. Sealing is still the third order or later of a following turn, at twice the price.
- **Pagan:** no storm on a province that was stormed last turn (by anyone). The storm's line to its victims now names their companies.
- **Evil:** a Dark Pact company draws no wages for its first three turns. The pact is refused below a THIRD of the king's HP (was half).
- **Good:** the Villages pay +2 on tax 4 or less and +1 on tax 5 (was +3 and +2).
- **Unchanged:** Defend riding out, empty provinces, surprise wars, gold sinks, Druidic.
