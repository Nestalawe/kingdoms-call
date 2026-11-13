# Requirements: the new alignment abilities in the live game

For a fresh Claude Code session that will build the alignment abilities into the live game. It says what to build, the
decisions Toby must make first, what the test games taught us, and how the work must be done on `main`. Written on 13
November 2026, at the end of the test rounds (round 28).

## 1. Start here

1. Read `CLAUDE.md` **on `main`**, then the documents it lists. They are the rules for this work, and they have changed
   a great deal since the test branch was cut (see section 2).
2. Read this document to the end.
3. Get from Toby the playtesters' Google Sheet **as he has updated it** after the playtesters' talks. **The sheet is the
   specification.** Section 5 below is the sheet as it stood before those talks. Where they differ, the sheet wins; where
   the sheet is unclear, ask Toby.
4. Put the decisions in section 4 to Toby before you write code. Do not invent rules (`CLAUDE.md`, "Design forks go to
   Toby").
5. Use the prototype on the test branch only as a reference (section 8). Do not merge it, rebase it or copy it whole.

## 2. Where things stand

- The abilities were built as a **prototype** on the branch `claude/determined-archimedes-ppq0qn`. That branch is for
  testing only: it has no pull request and is never merged.
- Every ability is switched on per game by a list of alignment names, `G.alignmentPrototypes`, set from the
  environment variable `KC_ALIGN_PROTO` by the balance runner. With the list empty the game is today's game. Players
  have never seen any of it.
- It was tested over 28 rounds: a bot matrix of 240 games a round, and from round 24, 32 hand-played ten-realm games of
  16 to 20 turns. How: [METHOD.md](METHOD.md). Each round's findings: [findings/](findings/). Each game: [reports/](reports/).
- Toby shared the playtesters' sheet with the playtesters. They will talk it through face to face, Toby will make some
  changes, and then the abilities go into the live game and are tested with human players.
- **`main` has moved on by about 1,090 commits since the branch was cut (25 October 2026).** The files the prototype
  changed still exist on `main`, but much around them has changed. In particular, on `main`:
  - the engine emits **events, never words**: `emit` throws on text, and lint refuses it. The words of each line are
    written in `src/views/prose/` after perception (P1-12). The prototype emits finished sentences, so every line must be
    rewritten as an event plus its prose.
  - an alignment order is **one row** of `src/content/alignment-orders-their-keys-names-creeds-numbers-and-words.ts`,
    and its resolver is its rule (P1-19ap). A words test checks each row against the rulebook, the intro's table, the
    report's summary and the join form. A content effect lives in the rule registry (`src/engine/rules/`), not in an `if`
    on its name (P1-19).
  - saved games carry a version and are upgraded step by step before each turn (`src/engine/saves/`).
  - Toby's batches start with the skill `taking-in-a-batch-of-tobys-items`, and a rule that is written in several places
    changes with the skill `changing-a-rule-everywhere-it-is-written`.

## 3. What the work must deliver

1. Every ability in the updated sheet working in the live game, for human players and for the bots.
2. Every new order on the **player page**: the order form, its targets, and the encounter plan's new choice (fight to
   capture, for Ransom). Today the player page has none of the new orders.
3. Every new or changed rule written everywhere a rule is written: the engine, the player page's own copies (see
   `tests/lib/player-portal-copies.ts`), the rulebook, the intro's table, the report's alignment summaries, the join
   form's descriptions, and the turn report's lines.
4. The rules for every realm (section 5.1) and the changes and removals (section 5.3).
5. The bots giving every new order, at least as well as the prototype's bots do (`KC_ALIGN_TACTICS` on the branch).
   Making the bots better is separate work (Toby's bot handoff document).
6. Tests for every ability, written first (section 7).
7. A ruling for each decision Toby makes, in `docs/rulings/`, in the PR that carries it.
8. Playtester notes in every PR, and the same notes for Toby once it is live.

## 4. Decisions Toby must make first

Put each to Toby as numbered options with a recommendation and a short example from inside the game.

1. **Running games, or new games only?** Holy sites and barrows are placed when the world is made, and a running game
   has none. Changing a player's rules in the middle of a game would also surprise him.
   *Recommendation:* the new rules apply to games created after they go live. Each game records which rules it was
   created with, and running games keep today's rules to the end. Example: "The Iron March, now at turn 14, plays on as
   it is; the next game Toby creates has the new kits."
   This needs a per-game record of the rules (in the saved state, set at creation, like `alignmentPrototypes` on the
   test branch). Today's rules can be removed once no running game uses them (expand, then contract).
2. **The parts not built yet.** For each, Toby says build, drop or leave for later:
   - Sanctuary: a hero in a consecrated province cannot be robbed.
   - Absolution: also lifts curses and charms from the realm's heroes.
   - The Church Triumphant: the king is immune to charms, curses and assassins everywhere.
   - Good Works: halves enemy Spies' and Thieves' chances in that province for the turn.
   - Call down the storm: halves movement there next turn and scatters fleets next to it.
   - Watch-fires (Good). Its job is mostly done by the new rule for every realm, which shows armies one hex away.
   - The ancestors watch (Pagan).
   - Deserters turn mercenary (Neutral).
   None of these was used by the bots or by the hand players, so the test games say nothing about their balance.
3. **Call to Arms (Good).** The test games kept today's Call to Arms next to the new Light the Beacons. The sheet lists
   only the Beacons. Keep both, or replace Call to Arms with the Beacons?
4. **Names Toby has already chosen** that the sheet may not show yet: the always-on Divine battle bonus is called
   **Smite the Unholy**, not Crusade, and Holy defence is folded into it (the prototype's labels already read "Smite the
   Unholy ×1.5 (holy ground)" and so on). **Proclaim Crusade** keeps its name.
5. **Already decided: do not change these** unless Toby rules again: surprise wars by Evil and the Undead, Defend riding
   out, empty provinces falling to any army, and uses for gold. Human players will train Necromancy early, so no change
   for Undead casting either.

## 5. What to build

### 5.1 Rules for every realm, and changes to today's rules

The four rules left as they are, for discussion, are in decision 5 and are not repeated here.

| Kind | Change | What it does | Why | State in the test games |
|---|---|---|---|---|
| New rules for every realm | **Seeing enemy armies next to your land** | Every realm sees another realm's hero who is leading armies in a province next to one it owns, with the rough size of his army: a small escort (1 or 2 companies), a modest band (3 to 5), a sizeable host (6 to 9), a large host (10 to 15) or a vast host (16 or more). A hero travelling alone is not seen this way. Invisibility still hides a hero. | So a player can answer an army he can plainly see coming. In the test games it saved capitals and provinces in most games. | Built and tested. Switched on together with the new abilities. Not in the live game yet. |
| New rules for every realm | **Warning of an empty capital** | At the start of a turn, a realm whose capital has no garrison and none of its own heroes in it, while another realm's army stands in a province next door, gets a warning line in its report naming that army. | Several capitals fell to an army that simply walked in while the king was away. | Built and tested |
| New rules for every realm | **The pressed levy** | Each turn a province can raise one company of a kind beyond its normal limit, at twice the price. | A first, small way to turn spare gold into soldiers. Toby is planning other uses for gold. | Built and tested |
| New rules for every realm | **Alignment skill** | Every hero counts one level higher in his alignment's own skill, if he has at least one level of it: White Magic (Divine), Tactical (Good), Druid (Druidic), Sage (Neutral), Explorer (Pagan), Spy (Evil), Necromancy (Undead). | One simple rule in place of seven separate ones. | Built and tested |
| New places on the map | **Holy sites** | About one land province in five holds a holy site, when a Divine realm is in the game. Found by exploring. They give the Divine realm Divine Power. | Places for the Church to seek and others to deny. | Built and tested |
| New places on the map | **Barrows** | About one land province in five holds a barrow, when an Undead realm is in the game, and one always stands within two hexes of the Undead capital. Found by exploring. | The Undead's recruiting grounds. Without one near the capital the realm could not get started. | Built and tested |
| Changed or removed from the live game | **Harvest the Field removed** | The Undead order Harvest the Field is gone. The dead are raised only by the Skeletal Armies spell. | With Harvest, an Undead player could raise and improve an army faster than anyone could answer. | Built and tested |
| Changed or removed from the live game | **Neutral trade income** | The live game's flat +20% trade income for Neutral realms is replaced by Markets (half again as much tax from provinces of tax 4 or more). | Ties the League's wealth to rich land it has to hold. | Built and tested |
| Changed or removed from the live game | **Casting down the altars** | When an Evil or Undead army captures a consecrated province, one company of it rises a quality tier. In the live game every Undead company rises, and every Evil company has an even chance. | A whole Evil army became Elite for free by walking through empty consecrated land. | Built and tested |
| Clearer reports | **New report lines** | The report now says: when a Divine realm's Power changes and which gifts it holds; when a Beacons muster goes home; when the League's envoys arrive in a province, with the price; why a Trade Pact was refused; who was taken for ransom and when the ransom is paid; and which companies a storm struck. | Each of these cost players a turn or a treasury before the line existed. | Built and tested |

### 5.2 Each alignment

The tables below are the playtesters' sheet as it stood before the talks. "How used": always on, a hero's order, or the
king's order. "State in the test games": built and tested, partly built (the missing part is named), or not built.

#### Divine

*The Church. It makes land holy, grows rich on it, and crusades against the dark.*

**Why these abilities.** The Divine realm is built around consecrated ground. Its abilities were chosen so that the Church spreads the way a faith does: one province at a time, outward from the capital, each one made holy by a hero. Holy ground then pays for the realm (Tithes), defends it (Holy defence), trains its soldiers (Blessed levies) and brings its fallen heroes home (Divine Grace).

**How it plays.** Divine has the best early economy of any alignment and the most reliable heroes, but an ordinary army. It is strong on its own holy ground and against the dark, and plain everywhere else. It plays as a builder that turns into a crusader once it has an enemy to name. **Its weak points:** It has to garrison what it consecrates, or others walk in. Its bonuses do little against Good, Neutral, Pagan or another faith's ordinary troops. A surprise war from Evil or the Undead hurts it most.

| Kind | Ability | How used | Cost and limits | What it does | State in the test games |
|---|---|---|---|---|---|
| Provinces and places | **Consecrate** | Hero order | 5g. The hero needs White Magic 2 or more (the alignment bonus counts). | A hero spends one order to consecrate the province he stands in. The province must belong to the realm and border the capital or another consecrated province. There is no limit on how many provinces can be consecrated. A consecrated province that changes hands loses its consecration. | Built and tested |
| Provinces and places | **Holy sites and Divine Power** | Always on | Free. Divine Power stops at 6. | About one land province in five holds a holy site, found by exploring. Divine Power is: 1 for each holy site the realm holds, 1 more if at least one of them is consecrated, 1 while a Crusade lasts, and 1 for every three consecrated provinces. Each point of Power brings one gift of the faith (the six rows below), kept only while Power stays at that level. The realm's report says when its Power changes and which gifts it holds. | Built and tested |
| Money | **Tithes** | Always on | Free. | A consecrated province pays 50% more tax for as long as it stays consecrated. | Built and tested |
| Battle | **Smite the Unholy** | Always on | Free. | Divine hosts fight at ×1.5 against Evil forces, when attacking an unclaimed monster province, and against any host that has a creature or monster company in it. Against Undead forces the bonus is ×1.75. The bonuses do not stack: the best one that applies is used. A Divine host defending a consecrated province of the realm fights at ×1.5 (this was Holy defence). | Built and tested |
| Battle | **Proclaim Crusade** | King's order | 6g. Lasts 3 turns, and can be proclaimed again when it ends. The realm must be at war with the realm it names. | The king names an enemy realm. For 3 turns every Divine host fights that realm's forces at ×1.5 wherever they meet, every province taken from it is consecrated at once and for free, the realm counts 1 more Divine Power, and the two hero benefits below apply. | Built and tested |
| Heroes | **Hounds of God (Crusade benefit)** | Always on | Free, while a Crusade lasts. | A Divine hero who pursues or Encounters a hero of the named realm always catches him: the chase cannot fail and the quarry cannot Vanish first. | Built and tested |
| Heroes | **Holy wrath (Crusade benefit)** | Always on | Free, while a Crusade lasts. | In personal combat against a hero of the named realm, every Divine hero counts his Melee two levels higher and his blows do 25% more harm. | Built and tested |
| Heroes | **Divine Grace** | Always on | Free. | A slain Divine hero returns at the start of the next turn, at the realm's consecrated province nearest to where he fell. Below Divine Power 2 the return uses up that province's consecration. Two things stop the Grace: a hero slain on blighted land does not return, and a hero whose soul an Undead hero has taken does not return while the Undead king lives. | Built and tested |
| Armies and recruitment | **Blessed levies** | Always on | Free. | Humanoid companies recruited in a consecrated province muster as Veterans, not Average. | Built and tested |
| Against other alignments | **The Last Rites** | Always on | Free. | Any company killed in a battle on consecrated ground leaves no grave, so nothing can be raised from that field by necromancy. | Built and tested |
| Gifts of Divine Power | **Power 1: Sanctuary** | Always on | Needs Divine Power 1. | A Divine hero standing in a consecrated province cannot be assassinated or charmed, and heals a quarter of his HP if he ends the turn there. | Partly built. The design also says he cannot be robbed there: that part is not built. |
| Gifts of Divine Power | **Power 2: Grace abounding** | Always on | Needs Divine Power 2. | A hero returning by Divine Grace no longer uses up the consecration of the province he returns to. | Built and tested |
| Gifts of Divine Power | **Power 3: Revelation** | Always on | Needs Divine Power 3. | The realm is shown every holy site province on the map. | Built and tested |
| Gifts of Divine Power | **Power 4: Pilgrim roads** | Always on | Needs Divine Power 4. | A Divine hero leading armies who starts the turn in a consecrated province, or stands in one, moves as if his March skill were 3 levels higher. | Built and tested |
| Gifts of Divine Power | **Power 5: Absolution** | Always on | Needs Divine Power 5. | At the end of every turn, every plague and every stack of Terror on the realm's provinces is lifted. | Partly built. The design also lifts curses and charms from the realm's heroes: that part is not built. |
| Gifts of Divine Power | **Power 6: The Church Triumphant** | Always on | Needs Divine Power 6. | Every province the realm holds counts as consecrated for Divine Grace, the Last Rites and Sanctuary (but not for Tithes, Holy defence or Blessed levies). | Partly built. The design also makes the king immune to charms, curses and assassins everywhere: that part is not built. |
| Heroes | **Alignment skill** | Always on | Free. | Every Divine hero who has at least one level of White Magic counts one level higher in it. | Built and tested |

#### Good

*The realm that holds. It defends its own land better than anyone and raises its people when danger comes.*

**Why these abilities.** Good is the defender. Its abilities were chosen to make a Good realm hard to break and slow to anger: a bonus for fighting on its own land, a muster that answers an invasion, a bonus for taking back what was stolen, and heroes whom the people protect.

**How it plays.** Good has no trick for attacking. It wins by losing less: steady income from its villages, a king who grows into a fine general, and land that comes back when it is taken. In the test games it was rarely destroyed and usually finished near the top. **Its weak points:** Nothing in the kit helps an attack on a strong realm. Its income is steady, not large. A single very large army (an Evil host with monsters) can still break the Shield.

| Kind | Ability | How used | Cost and limits | What it does | State in the test games |
|---|---|---|---|---|---|
| Battle | **Shield of the Realm** | Always on | Free. | A Good host defending a province the realm owns fights at ×1.5, and at ×1.75 when any company is garrisoned in that province. Does not stack with Reclaim. | Built and tested |
| Battle | **Reclaim** | Always on | Free. | A Good host attacking a province the realm lost within the last 5 turns fights at ×1.5. | Built and tested |
| Armies and recruitment | **Light the Beacons** | King's order | 2g a company. Can be lit again 2 turns after the last time. | The king calls the shires to arms. Every humanoid province of the realm within 3 hexes of the king, nearest first, up to 6 provinces, raises a Veteran company of its own kind into its garrison. The muster serves without wages for 3 turns and then goes home. It is a muster for a fight, not a standing army. | Built and tested |
| Provinces and places | **Good Works** | Hero order | Free. A province can receive it once a turn. | A hero sits in judgement in the province he stands in, which must belong to the realm. Every stack of Terror and every plague on it is lifted, and no new Terror or plague can touch it for the rest of the turn. | Partly built. The design also halves enemy Spies' and Thieves' chances there for the turn: that part is not built. |
| Money | **The Villages** | Always on | Free. | A humanoid province of tax 4 or less pays 2 more tax while a Good realm holds it. A province of tax 5 pays 1 more. | Built and tested |
| Heroes | **Hearts of Oak** | Always on | Free. | A Good hero struck down inside a province of the realm has an even chance of being carried from the field by the people: he lives at 1 HP, is carried to the realm's nearest other province, and loses the rest of his orders for the turn. | Built and tested |
| Heroes | **Loyal hearts** | Always on | Free. | Good heroes cannot be Charmed and never desert for want of pay. | Built and tested |
| Heroes | **Knights errant** | Always on | Free. | A Good hero's Melee skill rises twice as fast, and so does his Tactical skill until it reaches level 5. A win in a battle or duel outside the realm's own land teaches twice as much. | Built and tested |
| Sight | **Watch-fires** | Always on | Free. | The design: within 2 hexes of its land, in provinces it has seen before, the realm sees every enemy hero who leads armies, with his best-known skill and the rough size of his force. | Not built |
| Heroes | **Alignment skill** | Always on | Free. | Every Good hero who has at least one level of Tactical counts one level higher in it. | Built and tested |

#### Druidic

*The realm of the wild. It fights best in forest and jungle and leads beasts no one else can.*

**Why these abilities.** The Druids are tied to the wild places. Their abilities were chosen so that forests, jungles and creature provinces matter to them in a way they matter to nobody else: they fight harder there, they win beasts over where others must slaughter them, and they can turn open country into forest.

**How it plays.** No other alignment gets free armies from the land itself: beasts join when a creature province falls and more gather in its garrison over time. A Druid hero leads more beasts, and leads them better, than anyone. In return the Druids have almost no money of their own. **Its weak points:** Wages. Beasts are expensive, and a Druid realm that grows its host faster than its income runs out of gold. On plains and in desert it is an ordinary army. Nothing in the kit garrisons its provinces.

| Kind | Ability | How used | Cost and limits | What it does | State in the test games |
|---|---|---|---|---|---|
| Battle | **Home of the Wild** | Always on | Free. | Every company of a Druidic realm fights at ×1.5 in forest and jungle provinces, attacking or defending. | Built and tested |
| Battle | **The beasts are yours** | Always on | Free. | Attacking an unclaimed creature province, a Druidic host fights at ×1.5. This stacks with Home of the Wild (×2.25 in a forest or jungle creature province). When the province falls, a Green company of its beasts joins the captor if he has room to lead it. | Built and tested |
| Armies and recruitment | **The wild breeds** | Always on | Free. | While the realm holds a creature province, every 4th turn a free Average beast company of that province's kind joins its garrison (up to 3 companies there). Beasts recruited in a creature province of the realm muster as Veterans. | Built and tested |
| Armies and recruitment | **Call of the Wild** | King's order | 2g for each company that comes. Can be used every turn. | The king sounds the horn. Every creature company garrisoned in a province of the realm within 3 hexes comes to his side, as many as he has room to lead. | Built and tested |
| Provinces and places | **Grow the Wild** | Hero order | 8g. The hero needs Druid 3 or more (the alignment bonus counts). | A hero spends one order to turn the plains or desert province he stands in, which the realm must own, into forest or jungle for good. | Built and tested |
| Money | **The Wood Provides** | Always on | Free. | Creature companies in a host standing in forest or jungle draw half wages that turn. | Built and tested |
| Money | **Healers' fees** | Always on | Free. One fee per hero per turn. | A Druidic hero who ends the turn in a humanoid province, whoever holds it, earns his realm gold equal to half his Druid skill, rounded up (1g at Druid 1 or 2, 2g at 3 or 4, 3g at 5 or 6). No fee is earned in a consecrated province, a province under Terror or a blighted province. | Built and tested |
| Heroes | **Beast-friend** | Always on | Free. | Every Druidic hero can lead 2 more beast companies than his Druid level allows. | Built and tested |
| Heroes | **Beast mastery** | Always on | Free. | Beasts fight 40% harder for every Druid level their leader has above the level that beast needs, up to +100%. For every other alignment the gain is 20% a level. | Built and tested |
| Heroes | **Green healing** | Always on | Free. | A Druidic hero who ends the turn in a forest or jungle province heals a quarter of his HP. | Built and tested |
| Sight | **Earth-speech** | Always on | Free. | The realm is told of every province within 2 hexes of its land that holds ritual stones, a holy site or a barrow, whether or not anyone has explored it. It learns that something old lies there, not which of the three. | Built and tested |
| Heroes | **Alignment skill** | Always on | Free. | Every Druidic hero who has at least one level of Druid counts one level higher in it. | Built and tested |

#### Neutral

*The League. It buys what others fight for: land, soldiers and prisoners.*

**Why these abilities.** Neutral is the merchant power. Its abilities were chosen so that gold does for the League what faith, fear or the wild does for others: it buys provinces without a battle, hires the best mercenaries at the lowest price, starves a rival by Embargo, and sells captured heroes back.

**How it plays.** The League is the only alignment that grows fastest while at peace. Its soldiers are hired, not raised, and they fight well for it (Condottieri). Its heroes can lead any race without penalty. It is the one alignment whose army bonuses belong to mercenaries. **Its weak points:** It has no bonus for an ordinary battle. When a strong realm attacks it in earnest, gold cannot buy an answer quickly enough. In the test games it was destroyed more often than any other alignment, and it also won several games by purchase.

| Kind | Ability | How used | Cost and limits | What it does | State in the test games |
|---|---|---|---|---|---|
| Provinces and places | **Trade Pact: unclaimed land** | Hero order | 4g for each point of tax, plus 3g for each defending company. | A hero buys an unclaimed humanoid province, the one he stands in or one next to it. No battle is fought. The province joins the League and its defenders become its garrison. | Built and tested |
| Provinces and places | **Trade Pact: another realm's land** | Hero order | Envoys: 3g. Then twice the unclaimed price: 8g for each point of tax, plus 6g for each Average garrison company (2g more or less for each quality tier, and double again for beasts). | Buying another realm's humanoid province takes two steps. First the hero sends envoys (one order, 3g): the owner is told at once, with the price. The League may keep only one such embassy at a time. From the next turn, and for two turns, the pact can be sealed, and only as the third, fourth or fifth order of the turn. The garrison is turned loose as a mercenary band. It is refused if the province is a capital, if any hero of another realm stands in it, if the League is at war with its owner, or if it changed hands this turn or last. So an owner who marches a hero in with his first or second order blocks the sale. | Built and tested |
| Armies and recruitment | **The League hires best** | Always on | Free. | Mercenary bands cost a Neutral realm 2g less to hire (never less than 1g) and muster one quality tier higher than they would for anyone else. | Built and tested |
| Armies and recruitment | **The bands come to the League** | Always on | Free. | Every mercenary band in the world moves one step a turn toward the nearest Neutral realm's capital and waits there to be hired, by anyone. | Built and tested |
| Armies and recruitment | **Deserters turn mercenary** | Always on | Free. | The design: when a Neutral host wins a battle, the enemy companies that would desert become a mercenary band standing where they fled, ready to be hired. | Not built |
| Battle | **Condottieri** | Always on | Free. | A band hired by a Neutral realm fights at ×1.5 for the rest of the game, and at ×1.75 against a host with a creature or monster company in it. | Built and tested |
| Battle | **Open ranks** | Always on | Free. | Neutral kings and heroes lead humanoid companies of any race at ×1.25, and never suffer the −20% of the old grudges between races. | Built and tested |
| Against other alignments | **Embargo** | King's order | 5g. Can be used every turn, on any realm the crown has met. | For 2 turns the named realm pays 20% less tax, and its creatures and monsters cost double to recruit. | Built and tested |
| Money | **Markets** | Always on | Free. | Provinces of tax 4 or more pay half again as much tax under a Neutral realm. This replaces the live game's flat +20% trade income. | Built and tested |
| Heroes | **Guilds** | Always on | Free. | Spy and Thief count one level higher on every Neutral hero who has them, and rise twice as fast. | Built and tested |
| Heroes | **Ransom** | Always on | The captive is held one full turn. His realm then pays 3g for each skill level he has. | A League hero sets in his plans that he fights to capture. An enemy hero (never a king) is then taken alive, not killed, in three cases: when the League hero beats him in a personal Encounter; when he beats him in the duel before a battle; and when the League wins a battle in which the beaten hero lost half or more of his companies, or had no road out, and a League hero with that plan stands there. The captive gives no orders, travels with his captor and cannot be hunted down. What is left of his army falls back without a leader to his realm's nearest province. After one full turn his realm pays the ransom automatically, as soon as it can, and he is freed at his own capital. If the captor is slain, the captive goes free. | Built and tested |
| Heroes | **Broker** | King's order | As in the live game. | The live game's order stays: the king hires a wandering hero he has seen from afar, or buys a spy report. | Live today, unchanged |
| Heroes | **Alignment skill** | Always on | Free. | Every Neutral hero who has at least one level of Sage counts one level higher in it. | Built and tested |

#### Pagan

*The old faith. Its power sleeps in the standing stones, and wakes when its heroes perform the rites.*

**Why these abilities.** The Pagans draw strength from ritual stones scattered over the map. Their abilities were chosen so that finding, holding and waking the stones is the heart of their game: each site woken makes every Pagan host stronger, pays more tax and unlocks the rites.

**How it plays.** Pagan power is tied to places on the map more than any other alignment's. On a map rich in stones it becomes the strongest realm without fighting a player; on a poor one it is ordinary. It is the only alignment that can damage an enemy army without meeting it (the storm) and the only one that can move an army across the map in one step (the Ley). **Its weak points:** Away from its stones its army is only as good as its Favour. It starts slowly, with the costs of waking sites coming before the rewards. An enemy who takes its stones takes its strength.

| Kind | Ability | How used | Cost and limits | What it does | State in the test games |
|---|---|---|---|---|---|
| Provinces and places | **Ritual stones** | Always on | Free. | Ritual stones stand in some provinces and are found by exploring. Each Pagan realm begins beside one. A stones province the realm holds can be woken by the Rite of Awakening. | Built and tested |
| Provinces and places | **Rite of Awakening** | Hero order | 5g. One rite per province per turn. | A hero at ritual stones in a province the realm owns spends one order to wake them for the rest of the game. The province pays 3 more tax for good, the realm gains a point of Favour, and the other three rites are unlocked once the realm has woken its first site. | Built and tested |
| Battle | **Favour of the Old Gods** | Always on | Free. | The realm has 1 point of Favour for each stones province it holds and 1 more for each it has woken. Every Pagan host fights at ×(1 + 0.08 for each point), up to ×1.5 at 6 or more points. | Built and tested |
| Battle | **The Old Stones** | Always on | Free. | A Pagan host defending a stones province of the realm fights at ×1.6, whatever its Favour. | Built and tested |
| Battle | **Call down the storm** | King's order | 8g. Once a turn. Not on a province that was stormed last turn. | The king calls the sky down on a province that holds stones the realm has woken, or on any province next to one, whoever holds it. Each company standing there, the Pagan realm's own included, has a 1 in 4 chance of being destroyed (2 companies at most), and each survivor a 1 in 2 chance of dropping one quality tier (4 companies at most). Both the caster's and the victims' reports name the companies struck. | Partly built. The design also halves the movement of armies there next turn and scatters fleets beside the province: those parts are not built. |
| Battle | **Blood Harvest** | Always on | Free. | Every enemy company destroyed in a battle a Pagan host wins pays the realm 2g, and for each there is an even chance that one company on the winning side rises one quality tier. | Built and tested |
| Armies and recruitment | **Rite of the Wild Hunt** | Hero order | The price of one beast company. Needs a woken site. One rite per province per turn. | At ritual stones, a hero binds two beasts of a nearby wild province for the price of one. They join him as Veterans, draw no wages, and go back to the wild at the end of the following turn. | Built and tested |
| Armies and recruitment | **Blood Offering** | Hero order | The companies sacrificed. Needs a woken site. One rite per province per turn. | At woken stones, a hero sacrifices companies of his army. An equal number of his other companies rise two quality tiers. | Built and tested |
| Movement | **Rite of the Ley** | Hero order | Free. One rite per province per turn. | A hero and his army standing at woken stones of the realm step along the ley to any other woken stones of the realm, arriving at once. | Built and tested |
| Sight | **The ancestors watch** | Always on | Free. | The design: a slain Pagan hero's spirit stays in the province where he fell, and the realm sees that province and its neighbours as if he still stood there. | Not built |
| Heroes | **Alignment skill** | Always on | Free. | Every Pagan hero who has at least one level of Explorer counts one level higher in it. | Built and tested |

#### Evil

*The realm of fear. It breaks its enemies before the battle and drives monsters into the fight.*

**Why these abilities.** Evil rules through terror and through monsters. Its abilities were chosen so that every victory makes the next one easier (Terror weakens the defenders nearby) and so that monster provinces are to Evil what creature provinces are to the Druids: a prize that feeds its army.

**How it plays.** Evil is the most aggressive alignment and the most fragile. With a monster province it fields the strongest single army in the game. It is the only alignment whose king pays for soldiers with his own blood (the Dark Pact), and the only one that taxes its enemies (Tribute of Fear). **Its weak points:** Money. Monsters are the most expensive companies in the game, and an Evil realm that cannot pay them loses them. It has one strong army and little behind it, so a lost battle or an empty capital can undo it. Divine hosts fight it at ×1.5.

| Kind | Ability | How used | Cost and limits | What it does | State in the test games |
|---|---|---|---|---|---|
| Battle | **Terror** | Always on | Free. | Every battle an Evil host wins lays Terror on that province and its neighbours, and so does slaying an enemy hero in personal combat. Each stack of Terror weakens the defenders there by 10% (up to 3 stacks, −30%) against this Evil realm and its allies only. One stack fades every 3 turns unless renewed. Terror is wiped when the province changes hands. | Built and tested |
| Battle | **Spread Dread** | Hero order | Free. Once a turn per hero. | A hero in a province of the realm sends out his fearmongers. That province and every province next to it takes one stack of Terror, unless it already carries Terror. | Built and tested |
| Battle | **Savage Fury** | Always on | Free. | An Evil host with any monster company in it fights at ×1.5 attacking and ×1.25 defending. | Built and tested |
| Battle | **Dominion of the Pits** | Always on | Free. | Attacking an unclaimed monster province, or defending one the realm owns, an Evil host fights at ×1.5. This stacks with Savage Fury. When an unclaimed monster province falls, a Green company of its monsters joins the captor if he has room to lead it. | Built and tested |
| Armies and recruitment | **The pits breed** | Always on | Free. | While the realm holds a monster province, every 4th turn a free Average monster company of that province's kind joins its garrison (up to 3 companies there). Monsters recruited there muster as Veterans. A monster standing in the garrison of the province that breeds its kind draws half wages. | Built and tested |
| Armies and recruitment | **Dark Pact** | King's order | One and a half times the monster's recruit cost, plus 40% of the king's current HP. Every other turn. Refused if the king is below a third of his HP. | The king bargains for a monster in his own blood. An Average company of the monster he names joins his army, if he has room to lead it, and draws no wages for its first 3 turns. He may name any kind his own monster provinces breed. A realm with no monster province may name any monster at all, at twice the gold. | Built and tested |
| Money | **Tribute of Fear** | Always on | Free. | Every enemy-held province under this realm's Terror pays it 1g a turn. | Built and tested |
| Heroes | **Beast-masters** | Always on | Free. | Evil heroes can lead 2 more beast companies than their Druid level allows. | Built and tested |
| Against other alignments | **Casting down the altars** | Always on | Free. | When an Evil army captures a consecrated province, one company of that army, chosen by lot, rises one quality tier. (In the live game every company has an even chance.) | Built and tested |
| Against other alignments | **War without warning** | Always on | As in the live game. | An Evil realm's declaration of war takes effect the turn it is made, so it can attack at once. Every other realm's declaration takes effect at the end of the turn. Unchanged, and to be discussed with playtesters. | Live today, unchanged |
| Heroes | **Alignment skill** | Always on | Free. | Every Evil hero who has at least one level of Spy counts one level higher in it. | Built and tested |

#### Undead

*The realm of the dead. Its armies are raised from graves, feel no fear and cost almost nothing.*

**Why these abilities.** The Undead realm is an army of the dead led by necromancers. Its abilities were chosen so that graves are its recruiting ground and barrows its strongholds: its heroes raise skeletons with the Skeletal Armies spell, its king binds them into better troops, and land it blights keeps raising its own guards.

**How it plays.** Its soldiers cost 1g a turn each, far less than any living company, and fight at ×1.5 or better under a leader. But they do not come from a recruit order: every one is raised by a necromancer's spell that can fail. The Undead player's first job is to train Necromancy on his heroes and take the barrow near his capital. **Its weak points:** Everything depends on its necromancers. Skeletons without one crumble, except in a barrow or on blighted land. If the king falls, his army goes with him. Without graves to raise from, it cannot rebuild after a defeat. Divine hosts fight it at ×1.75.

| Kind | Ability | How used | Cost and limits | What it does | State in the test games |
|---|---|---|---|---|---|
| Armies and recruitment | **Raising the dead** | Hero order | The Skeletal Armies spell. The chance to cast is 30% plus 10% for each trained level of Necromancy. | Skeletal Armies is the only way to raise the dead: Harvest the Field has been removed. A necromancer raises companies from the graves in the province he stands in: 1 company at Necromancy 1 or 2, 2 at 3 or 4, 3 at 5 or more. A skeletal company keeps the kind and quality of the company it was, costs 1g a turn, and must be led by a hero with Necromancy or it crumbles at the end of the turn (see Standing dead for the exception). The realm begins with 2 skeletal companies. | Built and tested |
| Armies and recruitment | **Bind the Bones** | King's order | 2g a company. Once a turn. | The king raises skeletal companies in the province he stands in (his own army, the garrison and other heroes' armies there) one quality tier each, up to Crack. Elite has to be earned in battle. | Built and tested |
| Armies and recruitment | **The dead of this soil** | Always on | 1g a turn for each company. | Each turn, in every blighted province the realm holds, an Average skeletal company rises into the garrison (up to 4 there). These companies need no necromancer. They hold the province and cannot be led away. | Built and tested |
| Armies and recruitment | **Standing dead** | Always on | Free. | Skeletal companies can stand as a garrison without a necromancer in a barrow province or a blighted province the realm holds. Anywhere else, skeletons left without a necromancer crumble at the end of the turn. | Built and tested |
| Battle | **The dead fear nothing** | Always on | Free. | Skeletal armies led by the king or a hero fight at ×1.5, plus 0.05 for every blighted province the realm holds, up to ×2.0. A garrison with no leader fights at plain strength. | Built and tested |
| Provinces and places | **Barrows** | Always on | Free. | About one land province in five holds a barrow, found by exploring, and one always stands within two hexes of the Undead capital. Each barrow the realm holds adds 1 to every Undead hero's Necromancy. The added levels raise how many companies a cast brings, but not the chance of casting. | Built and tested |
| Provinces and places | **The barrow dead** | Always on | Free. | Graves never decay in a barrow province. At the end of every turn each barrow the realm holds fills its graves again: a humanoid barrow to 3 graves (Average companies of kinds the province can recruit), a creature or monster barrow to 1. | Built and tested |
| Provinces and places | **Blight the Land** | Hero order | 3g. | A hero in a humanoid province the realm owns (never a capital) spends one order to blight it for good, whoever holds it afterwards. A blighted province pays 1 tax and raises no living companies. | Built and tested |
| Money | **Grave Goods** | Always on | Free. | Every blighted province the realm holds pays it 4g a turn. | Built and tested |
| Heroes | **Lichdom** | Always on | Free. | An Undead king slain while the realm holds a barrow rises again at that barrow at the start of the next turn, with no army. | Built and tested |
| Against other alignments | **The soul is taken** | Always on | Free. | A Divine hero slain by an Undead hero has his soul bound: he does not return by Divine Grace and cannot be resurrected for as long as the Undead king lives. When the Undead king is slain, every bound soul is freed. | Built and tested |
| Against other alignments | **Desecrate** | Always on | Free. | A consecrated province the Undead realm captures is blighted at once and loses its consecration. One living company of the capturing army, chosen by lot, rises one quality tier. | Built and tested |
| Against other alignments | **War without warning** | Always on | As in the live game. | An Undead realm's declaration of war takes effect the turn it is made, so it can attack at once. Unchanged, and to be discussed with playtesters. | Live today, unchanged |
| Heroes | **Alignment skill** | Always on | Free. | Every Undead hero who has at least one level of Necromancy counts one level higher in it. | Built and tested |

### 5.3 Today's alignment orders and what becomes of them

| Today's order (on `main`) | Who gives it today | In the new kits |
|---|---|---|
| Consecrate (Divine) | The king only | Any hero with White Magic 2 or more, 5g, in a province of the realm that borders the capital or another consecrated province; no limit on how many. |
| Call to Arms (Good) | The king | Kept next to Light the Beacons in the test games: decision 3. |
| Broker (Neutral) | The king | Unchanged. |
| Harvest the Field (Undead) | Any hero | Removed. The dead are raised only by the Skeletal Armies spell. |
| Perform Rite (Pagan) | Any hero | Stays the order. The kit changes what the rites need and give: Awakening first, then the other three rites (5.2, Pagan). |

## 6. What the test games taught us: cases that must hold

Each of these was found by a game, fixed in the prototype, and needs a test in the live build.

- A Beacons muster goes home after its 3 turns **wherever it is**: in a garrison or in a hero's host.
- Beacons musters, and a Dark Pact company in its free turns, are left out of the report's wage forecast.
- The Divine Power line appears when Power changes. It does not report Power "falling" to 0 on the first turn.
- The report never says a hero "is in undefined": a hero seen in a province the realm has not scouted is described
  without the province's name.
- Ransom: a king is never captured. The captive gives no orders, travels with his captor, and cannot be pursued. What is
  left of his army falls back without a leader to his realm's nearest province on land, **never the battlefield it was
  taken on**. He is held one full turn, then his realm pays as soon as it can, and he is freed at his own capital. If his
  captor is slain, he goes free.
- Trade Pact on another realm's land: the refusal names its reason. Refused if the province is a capital, if any hero of
  another realm stands in it, if the League is at war with its owner, or if it changed hands this turn or last. One
  embassy at a time; the notice stands 2 turns; sealing only as the 3rd, 4th or 5th order of a turn.
- Call down the storm: never on a province stormed the turn before; at most 2 companies destroyed and 4 dropped a tier;
  the Pagan realm's own companies there are struck too; both sides' reports name the companies struck.
- Dark Pact: refused when the king is below a third of his HP; every other turn; double gold with no monster province.
- A barrow always stands within two neighbour steps of the Undead capital, and it is placed **without a dice draw**, so
  adding it does not shift every later draw of world creation.
- Holy sites appear only when a Divine realm is in the game, barrows only when an Undead realm is.
- Casting down the altars: **one** company of the capturing army, chosen by lot, rises a tier.
- Knights errant doubles Tactical only until level 5; Bind the Bones stops at Crack.
- Wages: each skeletal company 1g; a bred monster in its home province's garrison half; creatures in a host in forest or
  jungle half.
- Seeing enemy armies next to your land: only a hero **leading armies**, in a province one hex from one you own; a hero
  alone is not seen; Invisibility still hides him.
- The empty-capital warning: only when the capital has no garrison and none of the realm's heroes, and another realm's
  army stands next door; it names that army.

## 7. How to build it

**The rules of `main`'s `CLAUDE.md` apply in full.** The points that matter most here:

- **One concern per PR.** A suggested order, each PR its own concern (split further if one grows large):
  1. The per-game rules record, if Toby chooses "new games only" (decision 1).
  2. The rules for every realm (5.1), one PR each or as one batch.
  3. Holy sites and barrows in world creation.
  4. One alignment at a time, in the order Toby prefers: its abilities, its orders on the player page, its report
     lines, its rulebook and summary texts, its bots, its tests and its ruling. Removals and changes of today's rules
     (5.3) go with their alignment.
- **Test first, at the lowest level that can express it, and show each test failing before the change.** Most
  abilities can be tested on plain values or in a scenario (a staged world, one turn). An order on the player page
  needs a page or browser test as well. The edge cases in section 6 are each a test.
- **No luck in a test.** Stage the state directly, or make the odds overwhelming. Never a seed that happens to pass.
- **Dice from `kcRng()`**, time from `kcClock()`. An iteration order that can change a draw is explicit.
- **Every report line is an event**, with its audience, and its words are written in `src/views/prose/`.
- **The saved state and the submitted orders are parsed by their Zod schemas** (`src/schemas/`). New fields go into them.
  New fields on a running game's save need an upgrade step (`src/engine/saves/`).
- **The database.** The game state is saved by the site, so the abilities should need no database change. Check whether
  any order check is enforced inside the database (`supabase/schemas/`); if a change is needed there, it goes in its own
  PR first, with Theo.
- **Every engine PR carries its balance report**, with "What changes in play" predicted first.
- **Staging is needed** for the alignment PRs: they add orders to the player page and change how turns play. Give Toby a
  numbered checklist to try each one there.
- **Playtester notes** open every PR.
- **Plain language** in everything people read.

## 8. The prototype: a reference, not code to merge

Read a prototype file with `git fetch origin claude/determined-archimedes-ppq0qn` and then
`git show origin/claude/determined-archimedes-ppq0qn:<path>`. Use it for the numbers, the order of steps and the edge
cases. Do not copy it whole: it predates `main`'s events, rule registry, save upgrades and typing, writes its report lines
as finished text, and edits some files that still carry `// @ts-nocheck`.

| File on the test branch | What it holds |
|---|---|
| `src/engine/alignment-prototypes.ts` | The switch (`alignProto`), each kit's numbers, Divine Power and its gifts, Favour, the battle multipliers (`protoFervour`), the tax a kit adds (`protoProvinceTaxAdd`), wages, Ransom's helpers. |
| `src/engine/orders/alignment-prototype-orders.ts` | The new orders' resolvers: Good Works, Grow the Wild, Trade Pact, Blight the Land (`despoil`), Proclaim Crusade, Light the Beacons, Call of the Wild, Embargo, Call down the storm, Dark Pact, Bind the Bones, Spread Dread. |
| `src/engine/turn/alignment-prototype-turn-steps.ts` | The steps each turn: musters going home, the wild breeds and the pits breed, the barrow dead, the dead of this soil, Sanctuary's healing, Revelation, Earth-speech, the Divine Power line, the empty-capital warning, Ransom's payment. |
| `src/engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts` | Where the new orders are dispatched. |
| `src/engine/orders/realm-works-orders-…`, `explore-and-search-orders-…`, `cast-spell-order-…`, `recruit-and-hire-orders-…`, `research-and-practice-orders-…` | Consecrate's new rule, the rites, Skeletal Armies and souls, the pressed levy, the Divine Rest bonus cut. |
| `src/engine/battle/…`, `src/engine/personal-combat/…`, `src/engine/heroes/…` | The battle bonuses, Blood Harvest, Ransom in battles, duels and Encounters, Hearts of Oak, Knights errant. |
| `src/engine/realms/relations-and-captures.ts` | Captures: Desecrate, casting down the altars, the "changed hands" mark Trade Pacts read. |
| `src/engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts` | Seeing enemy armies next to your land. |
| `src/engine/turn/new-turn-…` (two files) | Divine Grace's return; Lichdom. |
| `src/engine/world/generate.ts` | Holy sites, barrows, the barrow near the Undead capital. |
| `src/engine/turn/early-winter-charms-…` | The tax and wage step: Embargo, musters and pacts without wages, skeleton and monster wages. |
| `src/views/turn-report.ts` | The wage forecast and the sighting text. |
| `src/schemas/saved-game-state.ts` | The new fields of the saved state. |
| `src/engine/bots/missions.ts`, `movement.ts`, `spellcraft.ts` | How the bots give the new orders. |
| `tools/handplay/brief.md` | The rules as the hand players read them, with every later change. |

## 9. How to know it is done

1. Every row of the updated sheet is built, or Toby has ruled it out, and each has a test that failed first.
2. `npm run check`, `npm test` and `npx playwright test` are green; CI is green on every PR.
3. **The balance matrix agrees with the test rounds.** With every kit on, each alignment's share of wins over the bot
   matrix should fall near round 28's (below), within its range, or the difference is explained. The scripts to measure
   it on five seed sets are in [matrix/](matrix/README.md). A big change means a rule was built differently from the
   prototype, or `main` has changed the game around it: find out which.
4. Toby has tried each alignment on staging with the checklist.
5. Optionally, play one ten-realm game with the hand-play harness ([README.md](README.md)) on the new build, to read the
   reports as a player would.

Round 28's bot matrix, all seven kits on, 240 games (the fair share is about 22%):

| Alignment | Won the game | 95% range |
|---|---|---|
| Druidic | 32% | 24% to 40% |
| Neutral | 31% | 23% to 38% |
| Good | 26% | 19% to 34% |
| Pagan | 25% | 18% to 32% |
| Evil | 22% | 15% to 29% |
| Divine | 20% | 13% to 26% |
| Undead | 2% | 0% to 4% |

The Undead figure is low because the bots raise the dead poorly; the Undead won 2 of the 32 hand-played games. Improving
that is the bot work.

## 10. The opening message for the new session

Toby can paste this into a new chat:

> Read `tools/handplay/IMPLEMENTATION.md` on the branch `claude/determined-archimedes-ppq0qn` (run
> `git fetch origin claude/determined-archimedes-ppq0qn`, then `git show origin/claude/determined-archimedes-ppq0qn:tools/handplay/IMPLEMENTATION.md`).
> It is the requirements for building the new alignment abilities into the live game. Work from `main`, not that
> branch. Here is the playtesters' sheet as I have updated it: [link]. Start by putting the decisions in its section 4
> to me.
