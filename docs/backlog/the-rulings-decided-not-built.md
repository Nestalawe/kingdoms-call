# The backlog: the rulings to build

Part of the [Later](the-later-group-what-serves-a-later-outcome-or-waits.md) group of
[the backlog](README.md), in the same columns ([how to read a row](README.md#how-to-read-a-row)). Each ruling a maintainer decided and the game doesn't follow yet
(its status "Decided, not built") is a row of its own; the pull request that builds it sets the ruling to
**Confirmed** ([adding a ruling](../rulings/README.md#adding-a-ruling)). Placed in Later on one assumption: each is
decided, and the rulings come after the rebuild
([the default order](../ways-of-working/ordering-the-backlog-by-impact.md#3-compare-it-with-its-neighbours) a row is placed by). A static
test checks that each such ruling has its row
(`tests/static/the-backlogs-statuses-follow-their-pull-requests-and-each-ruling-to-build-has-a-row.test.ts`).

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| P1-23f | Orders saved for an earlier turn and sent late keep only their order of heroes: the turn refuses the rest of them (today it takes their declarations, Reckoning call, messages and concession), as it already refuses their research choices. Its pull request adds its ruling. Folds in KD-385. | Players: a draft from a past turn changes nothing in this one but its heroes' order | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23g | A hero's battlecry holds at most 200 letters: the turn cuts a longer one, and both order forms limit the field, as a new heir's name is limited to 40. Its pull request adds its ruling | Players: every battlecry in a battle report is short | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23i | [R-141](../rulings/R-141-illusory-terrain-fools-the-intelligence-report-and-the-order-forms-too.md): Illusory Terrain fools the intelligence report and the order forms too. Folds in KD-145. | Players: the spell's false land shows everywhere the map shows it | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23o | [R-147](../rulings/R-147-old-corsair-companies-fight-as-plain-fleets.md): old Corsair companies fight as plain fleets. Folds in KD-108. | Players of running games: old Corsairs fight as their text says | Phase 1 | Medium | ✓ | ⬜ | | |
| P1-23u | [R-143](../rulings/R-143-the-crown-of-commands-text-says-it-helps-your-realms-characters.md): the Crown of Command's texts say your realm; running games' copies of them re-stamped. Folds in KD-109. | Players: the item's text says what it does; nothing changes in play | Phase 1 | Medium | ✓ | ⬜ | | |
| P1-23w | [R-149](../rulings/R-149-the-lancers-the-legions-and-the-bowmans-items-name-the-units-the-battle-lifts.md): thirty item texts name the units the battle lifts. Folds in KD-092. | Players: the texts say which units an item lifts; nothing changes in play | Phase 1 | Medium | ✓ | ⬜ | | |
| P1-23x | [R-150](../rulings/R-150-the-home-defence-items-say-what-the-battle-does.md): the home-defence items' texts. Folds in KD-260. | Players: the texts say what the battle does; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23y | [R-151](../rulings/R-151-the-shield-wall-runes-text-says-what-the-battle-does.md): the Shield-Wall Rune's texts. Folds in KD-012. | Players: the texts say what the battle does; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23z | [R-152](../rulings/R-152-the-plus-three-tax-items-say-three-gold-each-tax-season.md): the four tax items' texts. Folds in KD-093. | Players: the texts say +3 gold each tax season; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23aa | [R-154](../rulings/R-154-the-terror-items-say-the-foe-flees-half-the-time.md): the terror items' texts. Folds in KD-090. | Players: the texts say the foe flees half the time; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23ab | [R-139](../rulings/R-139-the-rulebooks-footers-say-when-their-rules-last-changed.md): each rulebook's footer says when its rules last changed, from the history; touches `.github/` and needs staging. Folds in KD-123. | Players: each rulebook says when its rules last changed | Phase 1 | Medium | ✓ | ⬜ | | |
| P1-23ag | [R-155](../rulings/R-155-clairvoyance-finds-an-invisible-hero-and-a-spy-who-stays-loses-him.md): a spy who stays doesn't see what an invisible hero does once he has vanished (the spy's part; Clairvoyance already lands) | Players: Invisibility hides a hero from a spy who stays | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23ah | [R-156](../rulings/R-156-the-broker-reaches-what-the-realms-map-shows.md): the Broker hires a wanderer the realm can see now, and buys word from any province its map names; the bots too. Folds in KD-172. | Neutral players: the Broker reaches what the map shows | Phase 1 | Medium | ✓ | ⬜ | | |
| P1-23ak | [R-159](../rulings/R-159-a-curse-in-battle-halves-a-master-druids-whole-druid.md): a Curse in battle halves a master Druid's whole Druid. Folds in KD-008. | Players: a cursed master Druid's beasts fight harder than today | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23ao | [R-163](../rulings/R-163-whale-cohorts-may-sink-hulls-on-every-side.md): Whale Cohorts may sink hulls on every side. Folds in KD-006. | Players at sea: guards' whales sink hulls too | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23ar | [R-165](../rulings/R-165-a-stalled-battle-on-a-third-realms-land-leaves-the-province-to-its-owner.md): a stalled battle on a third realm's land leaves the province to its owner. Folds in KD-017. | Players: an ally's province stays its own, whoever wins there | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23at | [R-167](../rulings/R-167-the-spy-orders-odds-are-written-as-the-turn-gives-them.md): the Spy order's odds written as the turn gives them. Folds in KD-027. | Players: the form, the note and the books give one figure; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23au | [R-168](../rulings/R-168-seven-more-texts-follow-the-game.md): seven more texts say what the turn does. Folds in KD-078. | Players: seven texts say what happens; nothing changes in play | Phase 1 | Medium | ✓ | ⬜ | | |
| P1-23av | [R-169](../rulings/R-169-the-march-6-note-counts-the-companies-he-will-lead.md): the Explore note counts March 6's share on the companies he will lead. Folds in KD-155. | Players: the note's figure is the turn's | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23aw | [R-170](../rulings/R-170-the-order-form-hands-over-the-company-the-turn-does.md): a hand-over that names a kind of company moves the one the turn moves, on the order form too. Folds in KD-155. | Players: the form shows the company that goes | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23ax | [R-171](../rulings/R-171-the-order-form-shows-hand-overs-at-sea-as-the-turn-does.md): the order form shows hand-overs and Pick Ups at sea as the turn does them. Folds in KD-155. | Players at sea: the form shows only what the ships can carry | Phase 1 | Medium | ✓ | ⬜ | | |
| P1-23ay | [R-172](../rulings/R-172-a-company-under-the-host-leader-still-pays-at-least-1-gold.md): a company the Host-Leader leads still pays at least 1 gold. Folds in KD-155. | Players: the Host-Leader's cheapest companies cost 1 gold, not 0 | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23az | [R-173](../rulings/R-173-the-call-to-arms-note-names-muster-rolls-chance.md): the Call to Arms note names Muster Rolls' chance of an Average company. Folds in KD-155. | Players: the note says what the turn does; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23bb | [R-175](../rulings/R-175-the-hire-list-says-a-heros-price-and-his-wage-under-granaries.md): under Granaries the hire list says a hero's price and his wage after it | Players: the list gives both figures; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23bc | [R-176](../rulings/R-176-enslaves-tax-cut-says-this-turn-and-the-next-3.md): Enslave's tax cut written as "this turn and the next 3". Folds in KD-128. | Players: every text gives the four tax days; nothing changes in play | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23bd | [R-179](../rulings/R-179-only-your-own-realm-reads-your-heros-maximum-hp-falling-or-its-new-reckoning.md): only the hero's own realm reads his maximum HP falling outside a fight, or an old save's one-time new reckoning. Folds in KD-386 and KD-387. | Players: rivals no longer read another realm's hero's maximum HP | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23be | [R-180](../rulings/R-180-pick-up-army-takes-only-a-garrison-of-a-province-your-realm-holds.md): Pick Up Army takes only a garrison of a province the hero's realm holds; the form and the rulebook follow. Folds in KD-388. | Players: a hero picks up only his own realm's garrisons | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23bf | [R-181](../rulings/R-181-a-wandering-hero-charmed-into-service-gives-no-mastery-orders-in-the-turn-of-the-charm.md): a wandering hero charmed into service gives no mastery orders in the turn of the charm; the rulebook says "from the next turn". Folds in KD-389. | Players: the turn refuses what the form already hides | Phase 1 | Small | ✓ | ⬜ | | |
| P1-23bg | [R-182](../rulings/R-182-what-a-realm-learns-of-another-realms-heroes-follows-the-maps-sight-rule.md): the Clairvoyance list, the realms met and the warnings follow the map's sight rule. Folds in KD-390. | Players: a realm learns nothing of a hero its map never showed | Phase 1 | Medium | ✓ | ⬜ | | |

## The groups

### P1-23: the rulings tranche

A group, not a row ([how to read a row](README.md#how-to-read-a-row)): fix what the checks found, then what the
maintainers have ruled. Impact: the game does what its rulings say. Maintainer ✓. `KNOWN_BREACHES` is empty. Its rows
are in the table above and in [Later's first group](the-later-group-what-serves-a-later-outcome-or-waits.md#the-rulings-and-the-known-defects-after-the-rebuild);
its finished rows in [the finished list](finished-steps-p1-13-to-p1-25.md#p1-23). Planned on 1 November, its rulings
numbered on 15 November, for rows f to ab; its decisions in force:
- **One row a ruling.** Each is test first and fails first, carries its balance report with "What changes in play"
  and a `## For playtesters` section, and is not `refactor-only`.
- **Each row's pull request updates its ruling:** the "not yet built" note goes, the source names the pull request,
  and "Enforced by" names its tests.
- **The text rows (u to aa) reach running games:** each re-stamps its own items' saved descriptions from the
  catalogue in the save's upgrade, where the saved item's effect is the catalogue's. Row u adds the helper. The
  save's shape doesn't change, so there is no version step.
- **P1-23ab:** the build writes each footer from the history. Deploy's and staging's build jobs fetch the whole
  history; CI's stay shallow. Without git, the footer reads "Rules last changed: unknown".
