// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_MAGIC_SCHOOLS, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { SKILL_MAX } from '../army-tables.ts';

// ── BUILD PLAYER TURN REPORT ────
// ══ VICTORY & TITLES (KC Reckoning system) — see KC-design-victory-and-titles.md ════
// Per-character merit accumulators, ensured lazily so existing saves upgrade cleanly. 2026-09-17:
// four new accumulators. `TM` is ensured LAZILY, so a character created before
// this build has a `tm` object without the new keys \u2014 every read therefore uses `||0` rather than
// trusting the shape, and every write uses `=(x||0)+n`. Do not "tidy" those into bare `+=`.
export function TM(c) {
  if (!c.tm)
    c.tm = {
      marshal: 0,
      sea: 0,
      monster: 0,
      holyCasts: 0,
      darkCasts: 0,
      featuresFound: 0,
      discoveries: 0,
      spyActions: 0,
      explored: 0,
      monsterHost: 0,
      wildHost: 0,
    };
  return c.tm;
}

// ── BEAST CATEGORIES FOR THE TWO NEW TITLES ────
// The engine already carries these two rosters in three separate places (the movement helper's
// local CREATURE_ARMIES/MONSTER_ARMIES at the top of the script, the bot's BOT_ copies, and the
// report builder's MON_REP). Title scoring gets ONE module-level pair rather than a fourth private
// copy, and every one of the four lists holds exactly the same members \u2014 if a new beast unit
// is ever added it must be added to all of them.
// Creature = the free beasts a realm persuades to fight beside it.
// Monster = the horrors a realm breaks to its will.
export const TITLE_CREATURE_ARMIES = new Set(KC_UNIT_CLASS.creature);
export const TITLE_MONSTER_ARMIES = new Set(KC_UNIT_CLASS.monster);
// file one entry in the Spymaster's ledger. The AGENT is recorded by id and by the name they
// carried at the time, not just their realm: the Spymaster's whole business is knowing WHO is in
// your country, and a realm name tells you nothing you could act on. The name is snapshotted
// because the agent may be dead, charmed or renamed by the time the intel line is written at end of
// turn, and a ledger that resolved ids late would print "undefined" for exactly the most
// interesting entries. `byPi` is kept alongside so the line can still say which crown the agent
// serves.
export function noteEspionage(G, c, provId, kind) {
  if (!G || !c || provId == null) return;
  try {
    (G._espionageLedger = G._espionageLedger || []).push({
      byPi: c.player != null ? c.player : null,
      charId: c.id,
      charName: c.name,
      isKing: !!c.isKing,
      provId,
      kind,
    });
  } catch (_e) {}
}
// TITLE MERIT: Cartographer. Banks the percentage points of ground a character's own marching and
// exploring actually ADDED \u2014 the delta after the 100% clamp, never the raw roll, so grinding
// Explore on a fully-charted province earns nothing. Raw points are stored; _charTitleMerit divides
// by 10.
export function creditMapped(c, before, after) {
  const d = (after || 0) - (before || 0);
  if (d > 0) TM(c).explored = (TM(c).explored || 0) + d;
}
// Credit a muster or a victory to whichever beast title the unit belongs to. Safe on any object.
export function creditBeastUnit(tmRec, unit, n) {
  if (!tmRec || !unit) return;
  const t = unit.type;
  if (TITLE_MONSTER_ARMIES.has(t)) tmRec.monsterHost = (tmRec.monsterHost || 0) + (n || 1);
  else if (TITLE_CREATURE_ARMIES.has(t)) tmRec.wildHost = (tmRec.wildHost || 0) + (n || 1);
}
export const RELIC_PRIZE_EACH = 1; // 1 point per LEGENDARY relic held. 2026-09-11: the legendary
// tier is now two relics of each kind, so the relic pool
// is worth ~22 points against 100 points of Titles (was
// 10) - DEV_LOG 87.3.
export const TITLES_PUBLIC_FROM_TURN = 5; // standings hidden turns 1–4 (clarification #10)
export const TITLE_PERKS_ENABLED = true; // live perks while a Title is held (from turn 5)

// Dominance threshold (share of world tax base) to Call the Reckoning — scales with player count
// (#1). 2026-09-14 — THE WORLD TIRES OF WAR. If no Reckoning has been called by the END of turn 15,
// the bar drops 5 percentage points at the end of that turn and of every turn after, down to a
// floor of 25%. The decay is counted in STEPS held on the game state (`G.reckoningDecaySteps`), not
// derived from the turn number, because the clock FREEZES while a claim is live: a called Reckoning
// stops the erosion where it stands, and if the claim later collapses the erosion resumes from that
// same point rather than jumping to catch up with the turn. All of it in INTEGER percentage points
// — 0.40 - 0.05 in floats is 0.35000000000000003, and that class of drift has caused live bugs in
// this engine before.
export const RECKONING_BASE_PCT = { 2: 60, 3: 50, 4: 45, 5: 42 };
export const RECKONING_DEFAULT_PCT = 40; // 6 or more realms
export const RECKONING_DECAY_FROM_TURN = 15; // the first END-of-turn at which the bar may erode
export const RECKONING_DECAY_STEP_PCT = 5; // percentage points shed per eroding turn
export const RECKONING_FLOOR_PCT = 25; // and it never falls below this
// NO PASSENGERS AT THE THRONE. An allied bloc can still push a realm over the Reckoning bar, but
// the realm that LODGES the claim must be a real contributor to it: its OWN tax base must be at
// least this fraction of the threshold. Without this, every member of a bloc that cleared the bar
// could Call the Reckoning — including an ally holding 3% of the world, who would then be the named
// claimant. Solo claimants are unaffected (their own share IS the bloc share).
export const RECKONING_CALLER_MIN_FRAC = 0.5;
// AN ALLY RAISES THE BAR. A flat threshold made an alliance the cheapest route to the throne:
// measured over 30,000 random mature worlds, the realm that could call it on an alliance's strength
// held on average only 0.71–0.82 of the share a SOLO claimant would have needed, and the discount
// widened the more realms were on the table. Each ally in the claimant's bloc now adds
// RECKONING_ALLY_STEP_PCT points to the bar. The step is half of ONE realm's fair share of the
// world (50/n), which is what makes the rule scale: at that setting the ally-carried claimant holds
// 0.98–1.03 of the solo bar at every player count, so joining a bloc buys a route to the endgame
// but never a cheaper one. Ceiling at RECKONING_CAP_PCT so a large bloc is not locked out forever —
// and the war-weariness decay still erodes the base underneath it.
export const RECKONING_CAP_PCT = 80; // no bloc ever needs more than this
export function reckoningAllyStepPct(nPlayers) {
  return Math.round(50 / Math.max(2, nPlayers | 0));
}
// no claim before this turn, whatever anyone's share. Titles go public at turn 5; the throne cannot
// be claimed for another five turns after that, so an early runaway start cannot end the game
// before the other realms have had a chance to build.
export const RECKONING_MIN_TURN = 10;
export function reckoningBasePct(nPlayers) {
  return RECKONING_BASE_PCT[nPlayers] || RECKONING_DEFAULT_PCT;
}
// INTEGER percentage points throughout (see the note above RECKONING_BASE_PCT). `blocSize` is the
// number of realms in the claimant's bloc, 1 for a solo claim; it defaults to 1 so an older caller
// that has not been taught about blocs still gets the solo bar rather than NaN.
export function reckoningThresholdPct(nPlayers, decaySteps, blocSize) {
  const steps = Math.max(0, decaySteps | 0);
  const k = Math.max(1, blocSize | 0 || 1);
  const base = Math.max(RECKONING_FLOOR_PCT, reckoningBasePct(nPlayers) - RECKONING_DECAY_STEP_PCT * steps);
  return Math.min(RECKONING_CAP_PCT, base + reckoningAllyStepPct(nPlayers) * (k - 1));
}
// Fraction form, for the share comparisons. `decaySteps` defaults to 0, so any caller that has not
// been taught about the decay still gets the undecayed base rather than NaN.
export function reckoningThreshold(nPlayers, decaySteps, blocSize) {
  return reckoningThresholdPct(nPlayers, decaySteps, blocSize) / 100;
}
// Steps read off a game state, wherever the state is called `G` or `gameState` or `state`.
export function reckoningDecayOf(state) {
  return (state && state.reckoningDecaySteps) | 0;
}
// THE ALIGNMENT TITLE BOOST IS WITHDRAWN. Every alignment now competes for every Imperial Title on
// exactly the same terms. Toby's ruling: "all alignments should be the same." A quarter of a
// title's merit is a large thumb on the scale for something a player never chose for that reason,
// and it made two characters with identical deeds and skills score differently.
//
// One entry in that table had NEVER done anything, and it is worth recording rather than quietly
// dropping: `Neutral:{vault:1.25}`. The boost was applied only to the per-CHARACTER merit map, and
// the Vaultkeeper is a REALM title scored straight off the treasury — `vault` was never a key in
// `_charTitleMerit`'s return, so the multiplier had nothing to multiply. Four years of a table entry
// that read as a live rule and was not one.
//
// Alignments keep every one of their other distinctions (zeal, hiring costs, signature actions, the
// starting skill nudge); what they no longer get is a discount on the throne.
export const _MAGIC_SCHOOLS = KC_MAGIC_SCHOOLS.slice();
// Skill LEVEL (base proficiency, 0–9) for perk unlocks; perkTier = levels past 5 (0–4).
// ── WHAT WAS GAINED THIS TURN (2026-09-26, Toby item 3) ────
// A hero's item list says nothing about WHEN each piece was won, so a relic taken from a lair this
// turn read exactly like one carried for ten. Rather than stamp every one of the dozen sites that
// can hand a character an item (lair hoards, a killer's spoils, Send Item, a mercy price, a
// pre-order card, inheritance…), the whole pack is photographed once at the top of the turn; the
// report then marks anything in a pack at the END of the turn that was not in that photograph.
// Keyed by item id where there is one (ids are unique and never reused) and by name otherwise, so
// items in older saves without an id still resolve.
// A character created DURING the turn has no photograph; its items are treated as already held, so
// a newly hired hero's own kit is never mislabelled.
export function itemKeyOf(it) {
  return it && it.id != null ? '#' + it.id : '@' + ((it && it.name) || '');
}
export function snapshotHeldItems(gs) {
  ((gs && gs.characters) || []).forEach((c) => {
    if (c) c._itemsAtTurnStart = (c.items || []).filter(Boolean).map(itemKeyOf);
  });
}
// True when this character's photograph exists and does NOT contain the item.
export function itemAcquiredThisTurn(c, it) {
  if (!c || !it || !Array.isArray(c._itemsAtTurnStart)) return false;
  return !c._itemsAtTurnStart.includes(itemKeyOf(it));
}

export function skillLevel(c, stat) {
  return Math.max(0, Math.min(9, ((c && c.skills) || {})[stat] || 0));
}
export function perkTier(c, stat) {
  return Math.max(0, skillLevel(c, stat) - 5);
}
// 2026-09-26 (Toby item 3): the personal-combat ceiling. SKILL_MAX is the highest any skill can
// reach, however it is reached — training, items, the Crown aura, minor titles, discoveries. Every
// figure that feeds a duel's hit chance or damage roll passes through here, so no stack of bonuses
// can print (or fight at) "Melee 11".
export function pcSkillCap(v) {
  return Math.max(0, Math.min(SKILL_MAX, Math.round(v || 0)));
}

// sd40 Dragon Taming: the winged beasts a realm with the discovery leads without any Druid penalty
// (Gnomish Gyrocopters are machines, not beasts, and are deliberately NOT tamed).
export const TAMED_FLYER_TYPES_D = new Set(KC_UNIT_CLASS.tamedFlyer);
// ── LIFTED OUT OF resolveTurn (plan P1-08a) ── the kind of foe a personal fight is against. It reads no turn state.
export function pcFoeCat(foe) {
  return foe.cat || (foe.kind === 'character' ? (foe.isUndead ? 'undead' : 'humanoid') : 'beast');
}
