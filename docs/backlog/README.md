# The backlog

Every open item, in one list: what it delivers, its impact, the outcome it serves, its size, who must look at it, and
where it is. What comes next is the top of the list ([the decision](../decisions/README.md#the-decisions-on-how-the-work-runs));
each outcome is in [the goal and the road](../the-goal-and-the-road.md). The list runs in four parts:
1. [**The top, in order**](#the-top-in-order): the next rows, in strict order, each with why it is there.
2. [**Next**](the-next-group-what-the-road-works-on-now-and-what-players-notice.md): rows to place in the top soon, with
   [the rulings to build](the-rulings-decided-not-built.md).
3. [**Later**](the-later-group-what-serves-a-later-outcome-or-waits.md): rows that serve a later outcome, or wait.
4. [**Not yet assessed**](#not-yet-assessed): rows whose impact no one has described yet.

Finished items are a record, in three files: [Phase 0, and P1-01 to P1-10](finished-steps-phase-0-and-p1-01-to-p1-10.md),
[P1-11 and P1-12](finished-steps-p1-11-and-p1-12.md) and [P1-13 to P1-25](finished-steps-p1-13-to-p1-25.md).

## How to read a row

- **Id:** a step of the old phases keeps its id, `P<phase>-<nn>` (for example `P1-16`), because code and pull requests
  cite it. A new item gets `B-NN`; a known defect `KD-NNN`. A step built in several pull requests gets lettered rows
  (`P1-16q`), and a row split in two gets a number (`P1-16o1`, `P1-16o2`). An id is never reused or renumbered: a
  dropped item keeps its id, and the finished list names it as dropped.
- **Rescoping:** when a row has delivered part of what it says, the id keeps what was delivered, and goes to the
  finished list; the rest is a new row, with a new id.
- **Impact:** one line: who notices, what changes in play or for the maintainers, and what it unblocks.
- **Outcome:** the outcome of [the road](../the-goal-and-the-road.md#the-outcomes) the row serves.
- **Size:** Small is one small pull request; Medium is one larger pull request, or two or three small ones; Large is
  a series, often in lettered rows. Sizes compare items; they are not times.
- **Maintainer ✓:** talk it through with a maintainer before it merges
  ([D-07](../decisions/README.md#the-sites-decisions-d-01-to-d-13)). It touches security, the database, CI and deploy, or
  the harness. **🔑** in the same column: part of it needs the owner's admin access (the repository's settings, a
  production approval, Supabase's live project, or the owner's claude.ai Project). Either maintainer can pick up any
  other item, or start an agent on it.
- **Who:** an agent does each item unless the row says otherwise.
- **Unit:** a set of steps that go together, in a fixed order (expand, wait, then contract), because doing only part of
  it would break the live site. Unit A, the cutover (P0-07 to P0-11), and Unit B (P0-20, then P0-21) are done. Unit C
  is P2-06, then a wait, then P2-07.
- **Status:** ⬜ not started · 🟦 in progress · 👀 in review · ⛔ blocked (the row says why) · ⏸ deferred. A row whose
  PR column lists a merged pull request is 🟦 at least; once every part is merged, it leaves for the finished list, as
  does a dropped row (✖).
- **PR:** the pull requests so far. A step with lettered rows lists its open rows after it; its finished rows are in
  the finished list.
- **After:** a row that must wait for another says so at the end of its "What".
- **Why here:** in the top only, one line of reasoning for the row's place.

## The top, in order

What comes next is the first row. Each row's place comes from its impact against the rows above and below it, and a
maintainer validates it ([ordering the backlog](../ways-of-working/ordering-the-backlog-by-impact.md)). The first
pass placed these rows on [the default order](../ways-of-working/ordering-the-backlog-by-impact.md#3-compare-it-with-its-neighbours),
taken as its assumptions: **harm in live play first, then what unblocks the most rows, then the maintainers' time,
then tidying.** Among rows of equal harm, the harm more games meet goes first, then the row that unblocks others,
then the smaller row. A known defect is placed only when it is plainly harm in live play: its row says players notice
it in running games, the turn's result is wrong (not only its words), and its fix needs no new ruling.

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| P1-23ap | [R-164](../rulings/R-164-a-garrison-with-no-hero-fights-with-its-realms-rules.md): a garrison with no hero fights with its realm's rules, as a hero's host would, the new alignment abilities included | Players: a lone garrison defends with its realm's creed and discoveries; unblocks the defence rows of the new abilities | Phase 1 | Large | ✓ | ⬜ | | Harm in live play wherever a garrison fights alone (today as against neutral guards); unblocks the new abilities' defence rows (B-05) |
| P1-23aq | [R-164](../rulings/R-164-a-garrison-with-no-hero-fights-with-its-realms-rules.md)'s zeal part: such a garrison rolls its creed's zeal, at double the chance on consecrated ground | Players: a lone garrison on consecrated ground rolls zeal, until the new abilities remove zeal | Phase 1 | Small | ✓ | ⬜ | | The same garrisons; Small: after P1-23ap, or in its pull request |
| P1-23m | [R-144](../rulings/R-144-only-the-human-garrison-holds-the-gate.md): only the Human Garrison holds the gate | Players: a siege goes as the unit's text says | Phase 1 | Small | ✓ | ⬜ | | Harm in every siege: today Hold the Gate spares every garrison, not only the Human Garrison; Small |
| P1-23al | [R-160](../rulings/R-160-steel-armour-and-military-discipline-read-alike-against-neutral-guards.md): Steel Armour and Military Discipline work against neutral guards as between heroes | Players: two discoveries do the same against guards as against heroes | Phase 1 | Small | ✓ | ⬜ | | Harm in battles against guards for each realm with Steel Armour or Military Discipline; Small |
| KD-049 | **Counter-spy discoveries never take anything off a Spy** (found 2026-10-19 in P1-08j6, Spy; live, players can notice it). Cipher Scripts, Watchmen and six creed discoveries (`effect.kind:'counterSpy'`) are worked out only from the province the order names (`targetProvForSpy`). But the order form and the bots send no province (`target:''`), so the reduction is always 0. Example: Realm B knows Cipher Scripts ("45% lower success"); Realm A's Spy 1 hero spies on B's province where he stands at 40%, not 0%. Fix: read the province he stands in when the order names none; a change in play, so its own PR with a balance report and playtester notes. A P1-08j6 case pins today's behaviour. | Players: counter-spy discoveries cut a Spy's chance, as their texts say | Phase 1 | Small | – | ⬜ | | Harm in each Spy order against a realm with a counter-spy discovery: eight discoveries take nothing off; Small |
| P1-23as | [R-166](../rulings/R-166-the-rout-rules-work-against-guards-as-between-heroes.md): four rout rules work against a province's guards as between heroes | Players: four unit abilities reach battles against guards | Phase 1 | Medium | ✓ | ⬜ | | Harm in battles against guards: four rout rules never reach them; Medium |
| P1-23k | [R-140](../rulings/R-140-messenger-birds-is-retired.md): Messenger Birds is retired | Players: a discovery that does nothing leaves the research list | Phase 1 | Medium | ✓ | ⬜ | | Harm for each realm that researches Messenger Birds: it does nothing; Medium |
| P1-23l | [R-145](../rulings/R-145-new-games-keep-the-guardian-tables-hp-and-running-games-keep-theirs.md): new games' guardians have the table's HP; running games keep theirs | Players of new games: guardians as tough as the table says | Phase 1 | Small | ✓ | ⬜ | | Harm in every new game: its guardians start below the table's HP; Small |
| P1-23j | [R-142](../rulings/R-142-a-declaration-of-war-meets-the-realm-that-declared-it.md): a declaration of war meets the realm that declared it | Players: a realm at war can write to its foe | Phase 1 | Small | ✓ | ⬜ | | Harm when a realm declares war on one that never met it: the realm declared on can't answer; Small |
| P1-23an | [R-162](../rulings/R-162-battle-magic-takes-effect-at-one-moment-in-both-battles.md): battle magic takes effect at one moment in both kinds of battle | Players: a battle spell does the same against guards as against heroes | Phase 1 | Medium | ✓ | ⬜ | | Harm in battles with battle magic: today it takes effect at different moments in the two kinds of battle; Medium |
| P1-23am | [R-161](../rulings/R-161-a-commander-slain-before-the-battle-takes-his-skills-out-of-it.md): a commander slain in the duel before a battle takes his skills out of it | Players: a fallen commander's Druid and Archery leave the battle | Phase 1 | Small | ✓ | ⬜ | | Harm after a duel before a battle: the fallen commander's skills still count; Small |
| P1-23n | [R-146](../rulings/R-146-flak-screen-engages-every-flyer.md): Flak Screen engages every flyer | Players: beasts that fly are shot at too | Phase 1 | Small | ✓ | ⬜ | | Harm wherever Flak Screen meets beasts that fly: it leaves them be; Small |
| P1-23v | [R-153](../rulings/R-153-two-second-wind-items-shrug-off-a-killing-blow-and-four-say-the-30-percent.md): the Ring and the Helm shrug off a killing blow; four texts state the 30% | Players: two items save a hero as their texts promise | Phase 1 | Large | ✓ | ⬜ | | Harm for a hero with the Ring or the Helm: today they act as the other second-wind items do; Large, so below the small rows |
| KD-047 | **A Philosopher's Stone can never be worked** (found 2026-10-19 in P1-08j5, Use Item; live, players can notice it): at load the engine keeps only the Legendary relic's entry (`LEGENDARY_ITEMS_P`, `effect:{stat:'promoteAll'}`), but Use Item, the order form (`ACTIVE_ITEM_STATS`) and the bots (`bots/missions.js`) look for `massPromote`; nothing reads `promoteAll`. E.g. a king who uses the Stone reads "a passive item … its power is always active", his Green companies stay Green and he keeps the Stone. Fix: one name for the power (the data's, or all three readers'), with a test of the Stone as a lair deals it; a change in play, so its own PR with a balance report and playtester notes. P1-08j5's tests pin today's behaviour. | Players: the Philosopher's Stone promotes its realm's companies, as its text says | Phase 1 | Small | – | ⬜ | | Harm for a realm that holds the Stone: using it does nothing; Small, one pull request with KD-048 |
| KD-048 | **Three more relics never work: the Crystal Orb, the Cloak of Many Faces and the Kraken Figurehead** (found 2026-10-19 in P1-08j6, Spy; live, players can notice them). The Philosopher's Stone's fault: at load `_retierAndBalanceItems` keeps the relics' `LEGENDARY_ITEMS_P` entries, whose powers (`spyAuto`, `untargetable`, `fleetQuality`) nothing reads; the readers look for the older names (`oracle`, `hidden`, `navalBonus`). E.g. a hero of no Spy with the Crystal Orb reads "20% [roll 64 ✗]", not an automatic success. Fix: with the Stone's, one PR (one name per power), with a balance report and playtester notes. P1-08j6's tests pin today's behaviour and test the older copies (`oldCrystalOrb`, `oldCloakOfManyFaces`). | Players: the Crystal Orb, the Cloak of Many Faces and the Kraken Figurehead work as their texts say | Phase 1 | Small | – | ⬜ | | Harm for the holders of three relics, whose powers nothing reads; with KD-047 |
| P1-23p | [R-148](../rulings/R-148-each-banner-gives-its-own-number.md): each banner gives its own number, the stronger of two | Players: a banner gives what its text says | Phase 1 | Small | ✓ | ⬜ | | Harm for the holders of the two relic standards: +2, not +4 and +6; Small |
| P1-23ai | [R-157](../rulings/R-157-a-lair-beast-talked-down-by-parley-counts-as-pacified.md): a lair beast talked down by parley counts as pacified, not slain | Players: a parley earns half the Monster-Bane merit and no hit points | Phase 1 | Small | ✓ | ⬜ | | Harm when a hero talks a lair beast down: it counts as slain; Small |
| P1-23aj | [R-158](../rulings/R-158-invisibility-waits-while-a-hero-leads-armies.md): Invisibility waits while a hero leads armies; the order form says so | Players: an invisible hero who leads armies is seen and fought | Phase 1 | Medium | ✓ | ⬜ | | Harm when an invisible hero leads armies: he stays unseen; Medium |
| P1-23ba | [R-174](../rulings/R-174-a-fleet-ordered-to-a-far-coast-lands-as-it-would-next-door.md): a fleet ordered to a far coast lands as it would next door; the form's forecast follows | Players at sea: a fleet sent to a far coast lands instead of staying put | Phase 1 | Medium | ✓ | ⬜ | | Harm at sea: a fleet ordered to a far coast stays put; Medium |
| P1-23h | [R-138](../rulings/R-138-an-onlooker-with-a-hero-there-reads-a-battles-one-line-summary.md): an onlooker with a hero there reads a battle's one-line summary | Players: a realm with a hero on the spot learns how a battle there ended | Phase 1 | Small | ✓ | ⬜ | | Harm in what a realm learns: an onlooker with a hero there isn't told how the battle ended; Small |

## Not yet assessed

Rows whose impact no one has described yet. The known defects start here, as `KD-` rows, in one file an area. Each
joins the top, Next or Later once its impact is assessed. A new defect gets a `KD-` row here, in its area's
file, with the next id not yet used; the pull request that fixes a defect deletes its row.

- [The battles](known-defects-the-battles.md)
- The turn's rules, the orders, the items and the save: [part 1](known-defects-the-rules-of-the-turn-the-orders-and-the-save-part-1.md), [part 2](known-defects-the-rules-of-the-turn-the-orders-and-the-save-part-2.md)
- The words players read: the books, the texts and the lines: [part 1](known-defects-the-words-players-read-part-1.md), [part 2](known-defects-the-words-players-read-part-2.md), [part 3](known-defects-the-words-players-read-part-3.md)
- [The player portal and the GM page](known-defects-the-player-portal-and-the-gm-page.md)
- [The bots](known-defects-the-bots.md)
- Dead code, and conditions that never change a value: [part 1](known-defects-dead-code-and-conditions-that-never-change-a-value-part-1.md), [part 2](known-defects-dead-code-and-conditions-that-never-change-a-value-part-2.md), [part 3](known-defects-dead-code-and-conditions-that-never-change-a-value-part-3.md)
- The tests, and checks that can't fail: [part 1](known-defects-the-tests-and-checks-that-cannot-fail-part-1.md), [part 2](known-defects-the-tests-and-checks-that-cannot-fail-part-2.md)
- The tools, CI and the harness: [part 1](known-defects-the-tools-ci-and-the-harness-part-1.md), [part 2](known-defects-the-tools-ci-and-the-harness-part-2.md), [part 3](known-defects-the-tools-ci-and-the-harness-part-3.md)
- [The docs and the comments in the code](known-defects-the-docs-and-the-comments.md)
