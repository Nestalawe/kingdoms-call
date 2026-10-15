# Rulings

Toby's decisions about how the game works, one file each. **Read the ruling before changing a rule it covers**,
and don't "fix" something a ruling says is deliberate without a fresh ruling.

A ruling is a decision about the game players experience: combat, magic, movement, the economy, what a report
shows, who can read what. Not here: how we work (`CLAUDE.md`), the numbers bots are tuned with (code comments
beside the bot code), and the plan's own decisions.

## Status

- **Confirmed:** Toby decided it; the source says where.
- **To confirm:** it's how the game works today, but the call was an agent's judgement, or the record doesn't say
  Toby made it.
- **Superseded:** a later ruling replaced it (the file names which). Kept as the record.
- **(open question)** in the index: the ruling stands, with one point Toby hasn't settled, written under **Open:**
  in the file.

Where a rule is still decided but not yet built, the file says so in a **Note:**.

## Toby: confirming the list (once)

Read the index below. For each ruling, either it stands (say nothing), or tell us what's wrong. The **To confirm**
rows and the **open questions** come first. Your answers go into the files, in one pull request.

## Adding a ruling

When Toby rules on a design fork, the pull request that builds it adds the ruling:

1. A new file `R-NNN-short-name.md`, the next number, in this shape:

   ```
   # R-NNN: <the rule, as a title>

   - **Decided:** <date>, Toby
   - **Status:** Confirmed
   - **Source:** PR #<number> (the question and his answer)
   - **Enforced by:** <each test that holds it, linked>, or no test yet

   <the rule, in plain words, for a future agent>

   In Toby's words: "<his answer, if he wrote one>"
   ```

2. A row in the index below.
3. If it changes an earlier ruling, mark that one **Superseded** and name the new one in it.

`npm test`'s `rulings` check keeps the files and the index in step, and checks that every test named under
**Enforced by** exists and runs in `npm test`.

## Sources

- **DEV_LOG §N (build v…)**: the engineering log of the claude.ai Project, 13–30 September 2026, before the game
  moved to this repo. It isn't in the repo; Toby and Theo hold it privately. Section numbers and build stamps are
  given so either can find the passage.
- **PR #N**: this repo's pull requests, from the cutover on 8 October 2026.
- **Plan decision D-NN**: Toby's answers to the questions in the private plan; each file says what he decided.

## Index

| Ruling | Title | Decided | Status | Enforced by |
|---|---|---|---|---|
| [R-001](R-001-lairs-near-home.md) | Lairs near home: 60% Weak, 30% Moderate, 10% Powerful | 2026-09-14 | Confirmed | no test yet |
| [R-002](R-002-titles-same-for-every-alignment.md) | Every alignment competes for every Imperial Title on the same terms | 2026-09-16 | Confirmed | no test yet |
| [R-003](R-003-title-intel-names-every-rival.md) | Title intelligence reports on every rival realm | 2026-09-17 | Confirmed | no test yet |
| [R-004](R-004-one-map-on-every-screen.md) | Desktop and phone show one map | 2026-09-18 | To confirm | no test yet |
| [R-005](R-005-rulebook-secrecy.md) | What the rulebook never names | 2026-09-18 | To confirm | no test yet |
| [R-006](R-006-war-fronts.md) | War fronts: hosts already face to face fight at the end of Spring | 2026-09-19 | Confirmed | no test yet |
| [R-007](R-007-defend-step.md) | When a Defending general rides out | 2026-09-19 | Confirmed | no test yet |
| [R-008](R-008-one-rite-per-province.md) | One rite per ritual site per turn | 2026-09-19 | Confirmed | no test yet |
| [R-009](R-009-divine-return-needs-holy-ground.md) | A fallen Divine character returns only on holy ground | 2026-09-20 | Confirmed | no test yet |
| [R-010](R-010-skeletal-armies-raise-count.md) | Skeletal Armies raises more with skill | 2026-09-20 | Confirmed | no test yet |
| [R-011](R-011-guardians-use-items-by-type.md) | Guardians use hoard items by their kind only | 2026-09-21 | Confirmed | no test yet |
| [R-012](R-012-research-choice-of-two.md) | Research offers a choice of two discoveries | 2026-09-21 | Confirmed | no test yet |
| [R-013](R-013-mounted-couriers-removed.md) | Mounted Couriers removed | 2026-09-21 | Confirmed | no test yet |
| [R-014](R-014-orders-for-a-hero-not-yet-yours.md) | Orders for a hero you mean to hire, raise or charm | 2026-09-21 | Confirmed | no test yet |
| [R-015](R-015-wealth-bands.md) | Wealth bands, and no land province below tax 2 | 2026-09-21 | Confirmed (open question) | no test yet |
| [R-016](R-016-starting-treasury.md) | Every realm starts with 20 gold | 2026-09-21 | Confirmed | no test yet |
| [R-017](R-017-charm-resistance.md) | Charm resistance grows 30% per Charm | 2026-09-21 | Confirmed (open question) | no test yet |
| [R-018](R-018-world-generation-guarantees.md) | What every new world guarantees | 2026-09-21 | Confirmed | [`home-placement`](../../tests/home-placement.test.js) |
| [R-019](R-019-dead-commander-earns-nothing.md) | A commander slain in his own battle earns nothing from it | 2026-09-21 | To confirm | no test yet |
| [R-020](R-020-own-provinces-seen-fully.md) | A realm sees its own provinces fully | 2026-09-21 | Confirmed (open question) | no test yet |
| [R-021](R-021-king-may-run-down-king.md) | Only a king may run down another king | 2026-09-21 | Confirmed | no test yet |
| [R-022](R-022-titles-card-order.md) | The Titles card lists your titles first | 2026-09-21 | Confirmed | no test yet |
| [R-023](R-023-experience-routes.md) | How the slow skills are learned in the field | 2026-09-21 | Confirmed (open question) | no test yet |
| [R-024](R-024-psychic-blast-lowers-wage.md) | Psychic Blast lowers the victim's wage | 2026-09-21 | Confirmed | no test yet |
| [R-025](R-025-every-coast-builds-a-fleet.md) | Every humanoid coastal province can build its race's fleet | 2026-09-21 | Confirmed | no test yet |
| [R-026](R-026-sage-discoveries-balance.md) | Sage discoveries: each one unique, none weak or strong | 2026-09-22 | Confirmed (open question) | no test yet |
| [R-027](R-027-neutral-hero-growth.md) | Neutral heroes grow slowly and never past 5 | 2026-09-23 | Confirmed | no test yet |
| [R-028](R-028-resurrect-own-and-unsworn.md) | Resurrect raises only your own fallen and heroes never sworn to another crown | 2026-09-23 | Confirmed | no test yet |
| [R-029](R-029-archery-lifts-missile-units.md) | Archery adds 5% a level to the archers you lead | 2026-09-23 | Confirmed | no test yet |
| [R-030](R-030-fervour.md) | Fervour: what each crown gets, and nothing stacks | 2026-09-23 | Confirmed | no test yet |
| [R-031](R-031-telekinetic-storm-halves-tactical.md) | Telekinetic Storm halves the Tactical bonus | 2026-09-23 | Confirmed | no test yet |
| [R-032](R-032-stranded-at-sea.md) | Stranded at sea | 2026-09-23 | Confirmed | no test yet |
| [R-033](R-033-garrisons-recruit-and-drill.md) | Garrison troops muster into the garrison and drill themselves | 2026-09-23 | Confirmed | no test yet |
| [R-034](R-034-tactical-lifts-flyers.md) | Tactical lifts flyers as it lifts land units | 2026-09-23 | Confirmed | no test yet |
| [R-035](R-035-hunting-rumours-always-learn.md) | Hunting Rumours always learns everything paid for | 2026-09-23 | Confirmed | no test yet |
| [R-036](R-036-druid-mastery.md) | Druid mastery: skill beyond the minimum strengthens beasts | 2026-09-23 | Confirmed | no test yet |
| [R-037](R-037-research-into-a-spent-field.md) | Research into a spent field turns to another | 2026-09-23 | Confirmed | no test yet |
| [R-038](R-038-no-primal-in-player-text.md) | "Primal" is not a word players read | 2026-09-23 | Confirmed | no test yet |
| [R-039](R-039-flying-beasts-at-sea.md) | Flying beasts fight at full strength over the sea | 2026-09-23 | Confirmed | no test yet |
| [R-040](R-040-raid-the-coast.md) | Raid the Coast and Reaver Crews in a landing | 2026-09-23 | Confirmed | no test yet |
| [R-041](R-041-battle-timing.md) | Every modifier first, pre-battle damage last | 2026-09-24 | Confirmed | no test yet |
| [R-042](R-042-encounter-catch-chance.md) | Catching a quarry with Encounter Character | 2026-09-24 | Confirmed | no test yet |
| [R-043](R-043-bots-know-what-a-player-knows.md) | Bots know only what a player in their seat could know | 2026-09-24 | Confirmed | no test yet |
| [R-044](R-044-breaking-an-alliance.md) | Breaking an alliance makes realms neutral | 2026-09-24 | Confirmed | no test yet |
| [R-045](R-045-consecration-capture-experience.md) | Taking holy ground: experience by the conqueror's crown | 2026-09-24 | Confirmed | no test yet |
| [R-046](R-046-unmet-realms-are-nameless.md) | Realms you have not met are nameless | 2026-09-24 | Confirmed | [`fuzz-advance-masking`](../../tests/fuzz-advance-masking.test.js) |
| [R-047](R-047-two-recruits-at-home.md) | Two recruits a season only in your founding capital | 2026-09-24 | Confirmed (open question) | no test yet |
| [R-048](R-048-heroes-not-yet-joined.md) | A hero being hired is unknown until he joins | 2026-09-24 | Confirmed (open question) | no test yet |
| [R-049](R-049-charmed-heroes-and-items.md) | A charmed hero handles no items | 2026-09-24 | Confirmed | no test yet |
| [R-050](R-050-bonus-tax-gold-cap.md) | Bonus tax gold is capped at 5% of base tax | 2026-09-24 | Confirmed (open question) | no test yet |
| [R-051](R-051-item-tiers-by-role.md) | What each lair grade holds | 2026-09-24 | Confirmed | no test yet |
| [R-052](R-052-item-effects-spread.md) | Nearby lairs do not repeat an item's effect | 2026-09-26 | Confirmed | [`lair-effects-spread`](../../tests/lair-effects-spread.test.js) |
| [R-053](R-053-spiritwrack.md) | Spiritwrack silences | 2026-09-26 | Superseded | no test yet |
| [R-054](R-054-melee-damage.md) | A melee blow's damage | 2026-09-26 | Confirmed | no test yet |
| [R-055](R-055-bot-opponents.md) | Bot opponents: one strength, Normal or Aggressive | 2026-09-26 | Confirmed | no test yet |
| [R-056](R-056-skills-rise-from-experience.md) | How skills rise from experience | 2026-09-27 | Confirmed | no test yet |
| [R-057](R-057-capitals-far-apart.md) | Capitals as far apart as the map allows | 2026-09-27 | Confirmed | [`home-placement`](../../tests/home-placement.test.js) |
| [R-058](R-058-naval-retreat-split.md) | A beaten army with ships splits its retreat | 2026-09-27 | Confirmed | [`naval-retreat`](../../tests/naval-retreat.test.js) |
| [R-059](R-059-sage-level-8.md) | Sage level 8 adds 1 tax a discovery | 2026-09-27 | Confirmed | no test yet |
| [R-060](R-060-event-lines-need-sight.md) | Province events are seen only by those who can see the province | 2026-09-27 | Confirmed | [`report-privacy`](../../tests/report-privacy.test.js) |
| [R-061](R-061-conceded-realms.md) | A realm that has conceded | 2026-09-27 | Confirmed | [`concede`](../../tests/concede.test.js) |
| [R-062](R-062-join-screen-briefing.md) | The join-screen briefings stay short and current | 2026-09-27 | Confirmed | no test yet |
| [R-063](R-063-ambush-and-shield-fort-against-neutrals.md) | Ambush and Shield Fort work against neutral defenders | 2026-09-27 | Confirmed | [`npc-parity`](../../tests/npc-parity.test.js) |
| [R-064](R-064-odds-against-unknown-rivals.md) | Odds against an unknown rival show only the outcome | 2026-09-27 | Confirmed | no test yet |
| [R-065](R-065-orcish-war-spoils.md) | Orcish war-spoils: a true half, on every attacking win | 2026-09-27 | Confirmed | [`druid-and-war-spoils`](../../tests/druid-and-war-spoils.test.js), [`fuzz-wages-combat`](../../tests/fuzz-wages-combat.test.js) |
| [R-066](R-066-dispatches.md) | Dispatches between players | 2026-09-27 | Confirmed | no test yet |
| [R-067](R-067-ships-ashore-hold-the-ground.md) | Ships left ashore contest the province | 2026-09-27 | Confirmed | no test yet |
| [R-068](R-068-archive-a-game.md) | Archive a game instead of deleting it | 2026-09-27 | To confirm (open question) | [`fuzz-advance-masking`](../../tests/fuzz-advance-masking.test.js), [`stats-forget-deleted`](../../tests/stats-forget-deleted.test.js) |
| [R-069](R-069-advance-and-strike.md) | A fighter who steps into range strikes in the same action | 2026-09-27 | Confirmed | [`fuzz-advance-masking`](../../tests/fuzz-advance-masking.test.js) |
| [R-070](R-070-hall-of-fame-is-public.md) | The Hall of Fame is public | 2026-09-27 | To confirm | no test yet |
| [R-071](R-071-safe-start.md) | Safe Start games | 2026-09-29 | To confirm | no test yet |
| [R-072](R-072-guardian-strength.md) | Guardian hit points by grade | 2026-09-29 | Confirmed | no test yet |
| [R-073](R-073-private-dispatches.md) | Private dispatches are private; players report | 2026-09-29 | Confirmed | [`report-dispatch`](../../tests/report-dispatch.test.js), [`17_message_reports.test.sql`](../../supabase/tests/database/17_message_reports.test.sql), [`18_private_dispatches.test.sql`](../../supabase/tests/database/18_private_dispatches.test.sql) |
| [R-074](R-074-dispatch-limits.md) | Dispatch limits | 2026-09-29 | Confirmed | [`dispatch-limits`](../../tests/dispatch-limits.test.js), [`16_dispatch_limits.test.sql`](../../supabase/tests/database/16_dispatch_limits.test.sql) |
| [R-075](R-075-eliminated-realms-dispatches.md) | Eliminated realms and dispatches | 2026-09-29 | Confirmed (open question) | no test yet |
| [R-076](R-076-monarch-grave.md) | A fallen king's body stays where it was laid | 2026-10-08 | Confirmed | [`monarch-grave`](../../tests/monarch-grave.test.js) |
| [R-077](R-077-guardian-melee.md) | Guardian melee grows by grade | 2026-10-08 | Confirmed | [`guardian-melee`](../../tests/guardian-melee.test.js) |
| [R-078](R-078-overtures-count-as-meeting.md) | An overture introduces the sender | 2026-10-08 | Confirmed | [`overtures`](../../tests/overtures.test.js) |
| [R-079](R-079-guardian-traits.md) | A guardian never resists and is weak to the same thing | 2026-10-08 | Confirmed | [`guardian-traits`](../../tests/guardian-traits.test.js) |
| [R-080](R-080-one-blow-cap.md) | No single blow takes more than half a fighter's HP | 2026-10-08 | Confirmed | [`hit-cap`](../../tests/hit-cap.test.js) |
| [R-081](R-081-movement-costs.md) | Movement costs of conquest | 2026-10-08 | Confirmed | [`move-points`](../../tests/move-points.test.js) |
| [R-082](R-082-run-them-down.md) | Run Them Down: no chase, the beaten army is cut down on the field | 2026-10-09 | Confirmed (open question) | [`warg-run-down`](../../tests/warg-run-down.test.js) |
| [R-083](R-083-chase-battle-conquers.md) | A chase battle won conquers the province | 2026-10-09 | Confirmed | [`pursuit-one-battle`](../../tests/pursuit-one-battle.test.js) |
| [R-084](R-084-retreats-onto-dry-ground.md) | Retreats never into a flood | 2026-10-09 | Confirmed | [`retreat-dry-ground`](../../tests/retreat-dry-ground.test.js) |
| [R-085](R-085-blank-seasons-defend.md) | Blank seasons count as Defend | 2026-10-09 | Confirmed | [`defend-once`](../../tests/defend-once.test.js) |
| [R-086](R-086-hp-rolls.md) | Hit-point rolls after a fight | 2026-10-09 | Confirmed | [`hp-wound-gain`](../../tests/hp-wound-gain.test.js) |
| [R-087](R-087-hall-of-fame-realm-bests.md) | The Hall of Fame keeps every realm's best | 2026-10-09 | Confirmed | [`leaderboard-realm-bests`](../../tests/leaderboard-realm-bests.test.js), [`battle-spells-recorded`](../../tests/battle-spells-recorded.test.js) |
| [R-088](R-088-five-unit-types.md) | Five unit types | 2026-10-11 | Confirmed | [`unit-types`](../../tests/unit-types.test.js), [`unit-type-words`](../../tests/unit-type-words.test.js) |
| [R-089](R-089-battle-lines.md) | Battle lines: the front, the flanks and the second line | 2026-10-11 | Confirmed | [`battle-grid`](../../tests/battle-grid.test.js), [`battle-lines-report`](../../tests/battle-lines-report.test.js), [`battle-lines-words`](../../tests/battle-lines-words.test.js) |
| [R-090](R-090-who-faces-whom.md) | Who faces whom | 2026-10-11 | Confirmed | [`battle-facing`](../../tests/battle-facing.test.js), [`battle-lines-report`](../../tests/battle-lines-report.test.js), [`battle-lines-words`](../../tests/battle-lines-words.test.js) |
| [R-091](R-091-scout-and-line-up.md) | The scout's advantage and the line-up | 2026-10-11 | Confirmed | [`battle-scout`](../../tests/battle-scout.test.js), [`battle-fronts-meet`](../../tests/battle-fronts-meet.test.js), [`battle-lines-words`](../../tests/battle-lines-words.test.js) |
| [R-092](R-092-volleys-thirty-percent.md) | A volley is 30% of the shooting unit | 2026-10-11 | Confirmed | [`volley-thirty`](../../tests/volley-thirty.test.js), [`volley-thirty-words`](../../tests/volley-thirty-words.test.js) |
| [R-093](R-093-winged-riders-are-soldiers.md) | The winged riders are soldiers of their race | 2026-10-11 | Confirmed | [`flyers-soldiers`](../../tests/flyers-soldiers.test.js), [`flyers-soldiers-words`](../../tests/flyers-soldiers-words.test.js) |
| [R-094](R-094-new-units-in-running-games.md) | New units reach running games through capitals only | 2026-10-11 | Confirmed | [`roster`](../../tests/roster.test.js) |
| [R-095](R-095-unit-abilities.md) | Every humanoid unit has a matchup and one more ability | 2026-10-11 | Confirmed (open question) | [`abilities-human`](../../tests/abilities-human.test.js), [`abilities-elven`](../../tests/abilities-elven.test.js), [`abilities-dwarven`](../../tests/abilities-dwarven.test.js), [`abilities-orcish`](../../tests/abilities-orcish.test.js), [`abilities-turn`](../../tests/abilities-turn.test.js), [`abilities-words`](../../tests/abilities-words.test.js) |
| [R-096](R-096-goblins-two-a-turn.md) | Goblin Hordes muster two a turn | 2026-10-11 | Confirmed | [`goblins-two-a-turn`](../../tests/goblins-two-a-turn.test.js) |
| [R-097](R-097-game-masters-and-the-overlord.md) | Game Masters and the Overlord | 2026-10-11 | Confirmed | [`gm-offer-and-gate`](../../tests/gm-offer-and-gate.test.js), [`gm-portal-no-signup`](../../tests/gm-portal-no-signup.test.js), [`12_site_admins.test.sql`](../../supabase/tests/database/12_site_admins.test.sql), [`13_game_masters.test.sql`](../../supabase/tests/database/13_game_masters.test.sql), [`14_only_game_masters.test.sql`](../../supabase/tests/database/14_only_game_masters.test.sql), [`19_overlord_master_gm.test.sql`](../../supabase/tests/database/19_overlord_master_gm.test.sql), [`20_accounts.test.sql`](../../supabase/tests/database/20_accounts.test.sql), [`overlord-page`](../../tests/overlord-page.test.js), [`master-gm-mode`](../../tests/master-gm-mode.test.js) |
| [R-098](R-098-players-found-by-name.md) | GMs find players by name, never by email | 2026-10-11 | Confirmed | [`profiles-no-email`](../../tests/profiles-no-email.test.js), [`profiles-columns`](../../tests/profiles-columns.test.js), [`06_profiles.test.sql`](../../supabase/tests/database/06_profiles.test.sql) |
| [R-099](R-099-statistics-and-hall-of-fame-editing.md) | Who sees statistics and edits the Hall of Fame | 2026-10-11 | Confirmed | [`hall-of-fame-controls`](../../tests/hall-of-fame-controls.test.js), [`stats-forget-deleted`](../../tests/stats-forget-deleted.test.js), [`04_telemetry.test.sql`](../../supabase/tests/database/04_telemetry.test.sql), [`05_game_records.test.sql`](../../supabase/tests/database/05_game_records.test.sql) |
| [R-100](R-100-flyers-in-the-woods.md) | Flyers fight at ×0.75 in forest and jungle | 2026-10-12 | Confirmed | [`battle-tweaks`](../../tests/battle-tweaks.test.js) |
| [R-101](R-101-hp-rises-are-private.md) | Only your own heroes' HP rises are shown | 2026-10-12 | Confirmed | [`hp-gain-private`](../../tests/hp-gain-private.test.js) |
| [R-102](R-102-terror.md) | Terror stacks three times, and Evil realms see it | 2026-10-12 | Confirmed (open question) | [`terror-visible`](../../tests/terror-visible.test.js), [`battle-tweaks`](../../tests/battle-tweaks.test.js) |
| [R-103](R-103-beast-command.md) | A hero leads at most as many beasts as his Druid level | 2026-10-12 | Confirmed (open question) | [`beast-command`](../../tests/beast-command.test.js) |
| [R-104](R-104-evil-and-druidic-crowns.md) | The Evil and Druidic crowns | 2026-10-13 | Confirmed (open question) | [`two-crowns`](../../tests/two-crowns.test.js), [`primal-roster`](../../tests/primal-roster.test.js), [`primal-words`](../../tests/primal-words.test.js), [`beast-calls-gone`](../../tests/beast-calls-gone.test.js) |
| [R-105](R-105-creature-and-monster-roster.md) | The Creature and Monster roster | 2026-10-13 | Confirmed (open question) | [`primal-roster`](../../tests/primal-roster.test.js), [`primal-renames`](../../tests/primal-renames.test.js), [`shark-waters`](../../tests/shark-waters.test.js), [`new-creatures`](../../tests/new-creatures.test.js), [`primal-words`](../../tests/primal-words.test.js) |
| [R-106](R-106-beast-abilities.md) | The beasts' battle-line abilities | 2026-10-13 | Confirmed | [`abilities-beasts`](../../tests/abilities-beasts.test.js), [`abilities-beasts-turn`](../../tests/abilities-beasts-turn.test.js), [`island-back`](../../tests/island-back.test.js), [`battle-tweaks`](../../tests/battle-tweaks.test.js), [`primal-abilities-words`](../../tests/primal-abilities-words.test.js) |
| [R-107](R-107-duel-stance-refuse.md) | A player's hero refuses duels unless told otherwise | 2026-10-13 | Confirmed (open question) | [`duel-refuse-default`](../../tests/duel-refuse-default.test.js) |
| [R-108](R-108-lairs-unique-per-province.md) | One lair per name and one of each guardian per province | 2026-10-13 | Confirmed | [`lair-province-unique`](../../tests/lair-province-unique.test.js) |
| [R-109](R-109-corsairs-retired.md) | The Corsair fleet is gone | 2026-10-15 | Confirmed | [`corsairs-retired`](../../tests/corsairs-retired.test.js), [`roster-words`](../../tests/roster-words.test.js) |
| [R-110](R-110-heroes-sharing-a-province.md) | Another realm's hero beside yours is always seen, and only roughly | 2026-10-15 | Confirmed | [`sight-shared-province`](../../tests/sight-shared-province.test.js), [`intrusion-invisible`](../../tests/intrusion-invisible.test.js), [`intrusion-lurker`](../../tests/intrusion-lurker.test.js) |
| [R-111](R-111-what-spying-shows.md) | What spying shows | 2026-10-15 | Confirmed | [`spy-reveals`](../../tests/spy-reveals.test.js) |
| [R-112](R-112-dreamstone-after-doubling.md) | The Dreamstone's round comes after Psychic Blast's doubling | 2026-10-15 | Confirmed | [`blast-dreamstone`](../../tests/blast-dreamstone.test.js) |
| [R-113](R-113-spiritwrack-counted-to-five.md) | Spiritwrack counts White to 5 | 2026-10-15 | Confirmed | [`spiritwrack-five`](../../tests/spiritwrack-five.test.js) |
| [R-114](R-114-hints-not-names.md) | The rulebooks may hint at mastery, never name it | 2026-10-15 | Confirmed | [`mastery-hints-words`](../../tests/mastery-hints-words.test.js) |
| [R-115](R-115-one-cast-chance.md) | One cast chance for everyone, and what raises it | 2026-10-15 | Confirmed | [`guard-cast-chance`](../../tests/guard-cast-chance.test.js), [`rulebook-review-words`](../../tests/rulebook-review-words.test.js) |
| [R-116](R-116-hierophant-without-consecrate.md) | Consecrate does not count toward the Hierophant | 2026-10-15 | Confirmed | [`hierophant-no-consecrate`](../../tests/hierophant-no-consecrate.test.js) |
