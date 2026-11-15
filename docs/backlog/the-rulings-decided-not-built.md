# The backlog: the rulings to build

Part of the [Next](README.md#next) group of [the backlog](README.md), in the same columns
([how to read a row](README.md#how-to-read-a-row)). Each ruling a maintainer decided and the game doesn't follow yet
(its status "Decided, not built") is a row of its own; the pull request that builds it sets the ruling to
**Confirmed** ([adding a ruling](../rulings/README.md#adding-a-ruling)). Placed in Next on one assumption: players
notice each of them in running games, and each is decided. A static test checks that each such ruling has its row
(`tests/static/the-backlogs-statuses-follow-their-pull-requests-and-each-ruling-to-build-has-a-row.test.ts`).

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR |
|---|---|---|---|---|---|---|---|
| P1-23 | Fix what the checks found, then what the maintainers have ruled. `KNOWN_BREACHES` is empty; the rulings tranche's rows follow; [the decisions in force](#p1-23-the-rulings-tranche) | Players: the game does what its rulings say | Phase 1 | Medium | ✓ | 🟦 | #205–#372, its rows |
| P1-23f | Orders saved for an earlier turn and sent late keep only their order of heroes: the turn refuses the rest of them, as it already refuses their research choices. Its pull request adds its ruling | Players: a draft from a past turn changes nothing in this one but its heroes' order | Phase 1 | Small | ✓ | ⬜ | |
| P1-23g | A hero's battlecry holds at most 200 letters: the turn cuts a longer one, and both order forms limit the field, as a new heir's name is limited to 40. Its pull request adds its ruling | Players: every battlecry in a battle report is short | Phase 1 | Small | ✓ | ⬜ | |
| P1-23h | [R-138](../rulings/R-138-an-onlooker-with-a-hero-there-reads-a-battles-one-line-summary.md): an onlooker with a hero there reads a battle's one-line summary | Players: a realm with a hero on the spot learns how a battle there ended | Phase 1 | Small | ✓ | ⬜ | |
| P1-23i | [R-141](../rulings/R-141-illusory-terrain-fools-the-intelligence-report-and-the-order-forms-too.md): Illusory Terrain fools the intelligence report and the order forms too | Players: the spell's false land shows everywhere the map shows it | Phase 1 | Small | ✓ | ⬜ | |
| P1-23j | [R-142](../rulings/R-142-a-declaration-of-war-meets-the-realm-that-declared-it.md): a declaration of war meets the realm that declared it | Players: a realm at war can write to its foe | Phase 1 | Small | ✓ | ⬜ | |
| P1-23k | [R-140](../rulings/R-140-messenger-birds-is-retired.md): Messenger Birds is retired | Players: a discovery that does nothing leaves the research list | Phase 1 | Medium | ✓ | ⬜ | |
| P1-23l | [R-145](../rulings/R-145-new-games-keep-the-guardian-tables-hp-and-running-games-keep-theirs.md): new games' guardians have the table's HP; running games keep theirs | Players of new games: guardians as tough as the table says | Phase 1 | Small | ✓ | ⬜ | |
| P1-23m | [R-144](../rulings/R-144-only-the-human-garrison-holds-the-gate.md): only the Human Garrison holds the gate | Players: a siege goes as the unit's text says | Phase 1 | Small | ✓ | ⬜ | |
| P1-23n | [R-146](../rulings/R-146-flak-screen-engages-every-flyer.md): Flak Screen engages every flyer | Players: beasts that fly are shot at too | Phase 1 | Small | ✓ | ⬜ | |
| P1-23o | [R-147](../rulings/R-147-old-corsair-companies-fight-as-plain-fleets.md): old Corsair companies fight as plain fleets | Players of running games: old Corsairs fight as their text says | Phase 1 | Medium | ✓ | ⬜ | |
| P1-23p | [R-148](../rulings/R-148-each-banner-gives-its-own-number.md): each banner gives its own number, the stronger of two | Players: a banner gives what its text says | Phase 1 | Small | ✓ | ⬜ | |
| P1-23u | [R-143](../rulings/R-143-the-crown-of-commands-text-says-it-helps-your-realms-characters.md): the Crown of Command's texts say your realm; running games' copies of them re-stamped | Players: the item's text says what it does; nothing changes in play | Phase 1 | Medium | ✓ | ⬜ | |
| P1-23v | [R-153](../rulings/R-153-two-second-wind-items-shrug-off-a-killing-blow-and-four-say-the-30-percent.md): the Ring and the Helm shrug off a killing blow; four texts state the 30% | Players: two items save a hero as their texts promise | Phase 1 | Large | ✓ | ⬜ | |
| P1-23w | [R-149](../rulings/R-149-the-lancers-the-legions-and-the-bowmans-items-name-the-units-the-battle-lifts.md): thirty item texts name the units the battle lifts | Players: the texts say which units an item lifts; nothing changes in play | Phase 1 | Medium | ✓ | ⬜ | |
| P1-23x | [R-150](../rulings/R-150-the-home-defence-items-say-what-the-battle-does.md): the home-defence items' texts | Players: the texts say what the battle does; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | |
| P1-23y | [R-151](../rulings/R-151-the-shield-wall-runes-text-says-what-the-battle-does.md): the Shield-Wall Rune's texts | Players: the texts say what the battle does; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | |
| P1-23z | [R-152](../rulings/R-152-the-plus-three-tax-items-say-three-gold-each-tax-season.md): the four tax items' texts | Players: the texts say +3 gold each tax season; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | |
| P1-23aa | [R-154](../rulings/R-154-the-terror-items-say-the-foe-flees-half-the-time.md): the terror items' texts | Players: the texts say the foe flees half the time; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | |
| P1-23ab | [R-139](../rulings/R-139-the-rulebooks-footers-say-when-their-rules-last-changed.md): each rulebook's footer says when its rules last changed, from the history; touches `.github/` and needs staging | Players: each rulebook says when its rules last changed | Phase 1 | Medium | ✓ | ⬜ | |
| P1-23ag | [R-155](../rulings/R-155-clairvoyance-finds-an-invisible-hero-and-a-spy-who-stays-loses-him.md): a spy who stays doesn't see what an invisible hero does once he has vanished (the spy's part; Clairvoyance already lands) | Players: Invisibility hides a hero from a spy who stays | Phase 1 | Small | ✓ | ⬜ | |
| P1-23ah | [R-156](../rulings/R-156-the-broker-reaches-what-the-realms-map-shows.md): the Broker hires a wanderer the realm can see now, and buys word from any province its map names; the bots too | Neutral players: the Broker reaches what the map shows | Phase 1 | Medium | ✓ | ⬜ | |
| P1-23ai | [R-157](../rulings/R-157-a-lair-beast-talked-down-by-parley-counts-as-pacified.md): a lair beast talked down by parley counts as pacified, not slain | Players: a parley earns half the Monster-Bane merit and no hit points | Phase 1 | Small | ✓ | ⬜ | |
| P1-23aj | [R-158](../rulings/R-158-invisibility-waits-while-a-hero-leads-armies.md): Invisibility waits while a hero leads armies; the order form says so | Players: an invisible hero who leads armies is seen and fought | Phase 1 | Medium | ✓ | ⬜ | |
| P1-23ak | [R-159](../rulings/R-159-a-curse-in-battle-halves-a-master-druids-whole-druid.md): a Curse in battle halves a master Druid's whole Druid | Players: a cursed master Druid's beasts fight harder than today | Phase 1 | Small | ✓ | ⬜ | |
| P1-23al | [R-160](../rulings/R-160-steel-armour-and-military-discipline-read-alike-against-neutral-guards.md): Steel Armour and Military Discipline work against neutral guards as between heroes | Players: two discoveries do the same against guards as against heroes | Phase 1 | Small | ✓ | ⬜ | |
| P1-23am | [R-161](../rulings/R-161-a-commander-slain-before-the-battle-takes-his-skills-out-of-it.md): a commander slain in the duel before a battle takes his skills out of it | Players: a fallen commander's Druid and Archery leave the battle | Phase 1 | Small | ✓ | ⬜ | |
| P1-23an | [R-162](../rulings/R-162-battle-magic-takes-effect-at-one-moment-in-both-battles.md): battle magic takes effect at one moment in both kinds of battle | Players: a battle spell does the same against guards as against heroes | Phase 1 | Medium | ✓ | ⬜ | |
| P1-23ao | [R-163](../rulings/R-163-whale-cohorts-may-sink-hulls-on-every-side.md): Whale Cohorts may sink hulls on every side | Players at sea: guards' whales sink hulls too | Phase 1 | Small | ✓ | ⬜ | |
| P1-23ap | [R-164](../rulings/R-164-a-garrison-with-no-hero-fights-with-its-realms-rules.md): a garrison with no hero fights with its realm's rules, as a hero's host would, the new alignment abilities included | Players: a lone garrison defends with its realm's creed and discoveries; unblocks the defence rows of the new abilities | Phase 1 | Large | ✓ | ⬜ | |
| P1-23aq | [R-164](../rulings/R-164-a-garrison-with-no-hero-fights-with-its-realms-rules.md)'s zeal part: such a garrison rolls its creed's zeal, at double the chance on consecrated ground | Players: a lone garrison on consecrated ground rolls zeal, until the new abilities remove zeal | Phase 1 | Small | ✓ | ⬜ | |
| P1-23ar | [R-165](../rulings/R-165-a-stalled-battle-on-a-third-realms-land-leaves-the-province-to-its-owner.md): a stalled battle on a third realm's land leaves the province to its owner | Players: an ally's province stays its own, whoever wins there | Phase 1 | Small | ✓ | ⬜ | |
| P1-23as | [R-166](../rulings/R-166-the-rout-rules-work-against-guards-as-between-heroes.md): four rout rules work against a province's guards as between heroes | Players: four unit abilities reach battles against guards | Phase 1 | Medium | ✓ | ⬜ | |
| P1-23at | [R-167](../rulings/R-167-the-spy-orders-odds-are-written-as-the-turn-gives-them.md): the Spy order's odds written as the turn gives them | Players: the form, the note and the books give one figure; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | |
| P1-23au | [R-168](../rulings/R-168-seven-more-texts-follow-the-game.md): seven more texts say what the turn does | Players: seven texts say what happens; nothing changes in play | Phase 1 | Medium | ✓ | ⬜ | |
| P1-23av | [R-169](../rulings/R-169-the-march-6-note-counts-the-companies-he-will-lead.md): the Explore note counts March 6's share on the companies he will lead | Players: the note's figure is the turn's | Phase 1 | Small | ✓ | ⬜ | |
| P1-23aw | [R-170](../rulings/R-170-the-order-form-hands-over-the-company-the-turn-does.md): a hand-over that names a kind of company moves the one the turn moves, on the order form too | Players: the form shows the company that goes | Phase 1 | Small | ✓ | ⬜ | |
| P1-23ax | [R-171](../rulings/R-171-the-order-form-shows-hand-overs-at-sea-as-the-turn-does.md): the order form shows hand-overs and Pick Ups at sea as the turn does them | Players at sea: the form shows only what the ships can carry | Phase 1 | Medium | ✓ | ⬜ | |
| P1-23ay | [R-172](../rulings/R-172-a-company-under-the-host-leader-still-pays-at-least-1-gold.md): a company the Host-Leader leads still pays at least 1 gold | Players: the Host-Leader's cheapest companies cost 1 gold, not 0 | Phase 1 | Small | ✓ | ⬜ | |
| P1-23az | [R-173](../rulings/R-173-the-call-to-arms-note-names-muster-rolls-chance.md): the Call to Arms note names Muster Rolls' chance of an Average company | Players: the note says what the turn does; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | |
| P1-23ba | [R-174](../rulings/R-174-a-fleet-ordered-to-a-far-coast-lands-as-it-would-next-door.md): a fleet ordered to a far coast lands as it would next door; the form's forecast follows | Players at sea: a fleet sent to a far coast lands instead of staying put | Phase 1 | Medium | ✓ | ⬜ | |
| P1-23bb | [R-175](../rulings/R-175-the-hire-list-says-a-heros-price-and-his-wage-under-granaries.md): under Granaries the hire list says a hero's price and his wage after it | Players: the list gives both figures; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | |
| P1-23bc | [R-176](../rulings/R-176-enslaves-tax-cut-says-this-turn-and-the-next-3.md): Enslave's tax cut written as "this turn and the next 3" | Players: every text gives the four tax days; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | |
| B-05 | [R-178](../rulings/R-178-the-new-alignment-abilities-are-built-as-the-test-games-played-them.md): the new alignment abilities, one batch an alignment, built as the test games played them; the design document brought up to match | Players: each alignment's new abilities reach every running game as its batch lands | The ground for the redesign | Large | – | ⬜ | |

## The decisions in force

### P1-23: the rulings tranche

Planned on 1 November, its rulings numbered on 15 November, for rows f to ab.
- **One row a ruling.** Each is test first and fails first, carries its balance report with "What changes in play"
  and a `## For playtesters` section, and is not `refactor-only`.
- **Each row's pull request updates its ruling:** the "not yet built" note goes, the source names the pull request,
  and "Enforced by" names its tests.
- **The text rows (u to aa) reach running games:** each re-stamps its own items' saved descriptions from the
  catalogue in the save's upgrade, where the saved item's effect is the catalogue's. Row u adds the helper. The
  save's shape doesn't change, so there is no version step.
- **P1-23ab:** the build writes each footer from the history. Deploy's and staging's build jobs fetch the whole
  history; CI's stay shallow. Without git, the footer reads "Rules last changed: unknown".
