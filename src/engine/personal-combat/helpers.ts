// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_RUMOUR_COST_BY_POWER } from '../../content/kingdoms-call-data.ts';
import { MITHRIL_ARMOUR } from '../heroes/fame-and-consecration.ts';
import { _ITEM_ALT_BASE } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { syncMaxHp } from '../heroes/skills-and-hp.ts';

// ── GUARDIAN WEAKNESSES ────
// Every lair guardian in MONSTERS_P carries a `weak` — one exploitable flaw a player can learn and
// then build a hero around. Deliberately NOT melee: blades are what everyone swings anyway.
// kind 'school' — spells of that school ALWAYS take hold (cast chance 95) and their damage and
// their non-damaging effects (to-hit penalties, stun/silence rounds, burn) double.
// kind 'archery' — arrows strike for double damage.
// kind 'race' — a character of that race deals double damage with anything.
// kind 'align' — a character of a realm of that alignment deals double damage with anything.
// Thematic by category: every undead guardian is weak to White Magic, fiends likewise or to the
// Divine/Good; constructs shatter under Elemental force; fey wither under Necromancy or cold
// dwarven iron; giants are easily deceived; dragons' vast prideful minds open to Psychic magic.
export const PC_WEAK_MULT = 2;
// the Talk/Parley encounter tactic is withdrawn. Set true to bring it back — see the 'TA' case in
// pcRunTactic for the full checklist of what else to restore alongside it.
export const PARLEY_ENABLED = false;
// the Scout encounter tactic is withdrawn too. Same pattern — the mechanic below is intact; see the
// 'SC' case in pcRunTactic for what else to restore alongside it.
export const SCOUT_ENABLED = false;
// ── HUNTING RUMOURS (2026-09-17 (late), Toby item 3) ── the order that replaces most of what Scout
// did, bought in the taverns rather than read off the beast. Cost per lair by grade. 2026-09-23d
// (Toby): every fact paid for is LEARNED — the old 50% + 10%/Spy roll per fact is retired.
export const RUMOUR_COST_BY_POWER = { ...KC_RUMOUR_COST_BY_POWER };
// ── DAMAGE FLOOR ────
// No stack of REDUCTIONS may now take a landed attack below HALF of what it would have dealt.
// Outright PREVENTION is untouched: a mirror image, a first-hit cuirass or a
// shield block still stops a blow completely — they return before the floor is ever considered.
export const PC_DMG_FLOOR_FRACTION = 0.5;
// ── LINGERING EFFECTS ────
// Nothing that ticks or clings lasts a whole fight any more. Every damage-over-time is clamped to
// three rounds at the point it is applied (guardian specials, spells, items and Impalement all run
// through pcPushDot), and a to-hit penalty always burns off inside three rounds however deep it is.
export const PC_MAX_LINGER_ROUNDS = 3;
export function pcLingerRounds(n) {
  n = parseInt(n);
  if (!Number.isFinite(n) || n < 1) n = 1;
  return Math.min(PC_MAX_LINGER_ROUNDS, n);
}
// The ONE place a damage-over-time is added, so the three-round cap cannot be bypassed by a new
// effect that forgets it. Merges nothing — several bleeds may run at once, each on its own clock.
export function pcPushDot(cbt, dmg, rounds, label) {
  if (!cbt || !cbt.status) return null;
  cbt.status.dot = cbt.status.dot || [];
  const lbl = label || 'Lingering harm';
  const e = { dmg: Math.max(1, Math.round(dmg || 1)), rounds: pcLingerRounds(rounds), label: lbl };
  // The SAME affliction REFRESHES rather than stacking. Without this an archer with Impalement
  // stacks a fresh three-round bleed on every hit and the target bleeds for the whole fight after
  // all — the exact thing the three-round cap exists to stop. Different afflictions still run side
  // by side.
  const prev = cbt.status.dot.find((d) => d && d.label === lbl);
  if (prev) {
    prev.dmg = Math.max(prev.dmg, e.dmg);
    prev.rounds = Math.max(prev.rounds, e.rounds);
    return prev;
  }
  cbt.status.dot.push(e);
  return e;
}
// ── RIDERS BEGIN THE ROUND AFTER ────
// An ability that lands an IMMEDIATE effect and ALSO hangs something lingering on its target — a
// blow that dazes, an arrow that blinds — must not do both in the same round. The initial effect
// lands now; the rider takes hold at the top of the NEXT round, promoted by pcRoundStart.
//
// Deliberately NOT deferred:
// · Effects that are ONLY a duration (Spiritwrack, Psychic Blast, Holy Symbol, Control Undead, a stun
// scroll, Flash Powder). There is no "initial effect" for the rider to follow, so they bite at once.
// · Damage-over-time. It already ticks in pcRoundStart, so a bleed applied mid-round first bites at
// the start of the next round — it is the round after by construction, and deferring it again would
// cost it a round.
export function pcDeferEffect(cbt, fn) {
  if (!cbt || !cbt.status || typeof fn !== 'function') return false;
  (cbt.status._pending = cbt.status._pending || []).push(fn);
  return true;
}
// Run every rider hung on this combatant last round. Called at the END of pcRoundStart, AFTER that
// round's fades and decrements, so a freshly-promoted penalty does not lose a tick of its life on
// arrival (a −20% aim penalty promoted here fades for the first time at the start of the round
// after).
export function pcPromotePending(cbt) {
  if (!cbt || !cbt.status) return;
  const q = cbt.status._pending;
  if (!q || !q.length) return;
  cbt.status._pending = [];
  q.forEach((fn) => {
    try {
      fn();
    } catch (_e) {}
  });
}
// A to-hit penalty sheds at least a third of itself each round (minimum 5), so even a Legendary
// dragon's −30% is gone by the third round rather than fading 5% a round for six.
export const PC_PEN_FADE_MIN = 5;
export function pcPenaltyFade(pen) {
  return Math.max(PC_PEN_FADE_MIN, Math.ceil(pen / PC_MAX_LINGER_ROUNDS));
}
// Which school a personal-combat spell belongs to. Module scope so pcTakeHit can name the school of
// the blow that landed; pcCastCombatSpell reads the same table (one source of truth).
export const PC_SPELL_SCHOOL_MAP = {
  'Holy Symbol': 'white',
  Spiritwrack: 'white',
  'Psychic Blast': 'psychic',
  'Telekinetic Storm': 'psychic',
  Invisibility: 'illusory',
  'Mirror Image': 'illusory',
  'Lightning Bolt': 'elemental',
  Fireball: 'elemental',
  Curse: 'necromancy',
  'Hand of Death': 'necromancy',
  'Control Undead': 'necromancy',
  Charm: 'psychic',
};
// Percentage-of-max-HP spells are exempt from the DAMAGE doubling — Hand of Death already takes
// half a guardian's total, and doubling that is an instant kill on anything. A Necromancy-weak
// guardian gets the take-hold chance doubled instead (see pcCastCombatSpell).
export const PC_WEAK_NO_DMG_DOUBLE = new Set(['Hand of Death']);
export function pcWeaknessApplies(w, o) {
  if (!w || !o) return false;
  switch (w.kind) {
    case 'archery':
      return o.chan === 'archery';
    case 'school':
      return o.chan === 'spell' && !!o.school && o.school === w.key;
    case 'race':
      return !!o.race && o.race === w.key;
    case 'align':
      return !!o.align && o.align === w.key;
  }
  return false;
}
// Once a realm has SEEN a weakness bite (or scouted it), it knows that creature's flaw for good —
// keyed by guardian NAME, so the lesson carries to every lair holding the same kind of beast.
export function pcLearnWeakness(gs, playerIndex, monsterName) {
  if (!gs || playerIndex == null || !monsterName) return false;
  const pl = (gs.players || [])[playerIndex];
  if (!pl) return false;
  if (!pl._knownWeak || typeof pl._knownWeak !== 'object') pl._knownWeak = {};
  if (pl._knownWeak[monsterName]) return false;
  pl._knownWeak[monsterName] = true;
  return true;
}
// ── LAIR RUMOURS REMEMBERED ── what Hunting Rumours learned about a lair's HOARD, keyed
// `<provinceId>:<featureIndex>` (the same idx the order forms and the search handler use), so the
// Known Lairs card can show it every turn after. Only the hoard is kept; a weakness goes to
// _knownWeak and the odds are never stored.
export function lairRumourKey(provId, idx) {
  return String(provId) + ':' + String(idx);
}
export function noteLairRumour(pl, provId, idx, rec) {
  if (!pl) return;
  if (!pl._lairRumours || typeof pl._lairRumours !== 'object') pl._lairRumours = {};
  pl._lairRumours[lairRumourKey(provId, idx)] = rec;
}
// ── ARMOUR ── fold every worn `stat:'armour'` item into one ward table for personal combat. Flat
// reductions add, percentages take the best, flags OR. Used by pcCharCombatant and by a guardian
// wielding a hoard's armour (resolveEncounter).
export function pcArmourMerge(a, e, name) {
  a = a || { names: [] };
  e = e || {};
  switch (e.ward) {
    case 'meleeDR':
      a.meleeDR = (a.meleeDR || 0) + (e.amt || 0);
      break;
    case 'arrowDR':
      a.arrowDR = (a.arrowDR || 0) + (e.amt || 0);
      break;
    case 'natureDR':
      a.natureDR = (a.natureDR || 0) + (e.amt || 0);
      break;
    case 'darkDR':
      a.darkDR = (a.darkDR || 0) + (e.amt || 0);
      break;
    case 'thorns':
      a.thorns = (a.thorns || 0) + (e.amt || 0);
      break;
    case 'regen':
      a.regen = (a.regen || 0) + (e.amt || 0);
      break;
    case 'spellPct':
      a.spellPct = Math.max(a.spellPct || 0, e.pct || 0);
      break;
    case 'dodge':
      a.dodge = Math.max(a.dodge || 0, e.pct || 0);
      break;
    case 'block':
      a.block = Math.max(a.block || 0, e.pct || 0);
      break;
    case 'cap':
      a.cap = Math.max(a.cap || 0, e.pct || 0);
      break;
    case 'secondWind':
      a.secondWind = Math.max(a.secondWind || 0, e.pct || 0);
      break;
    case 'lowHp':
      a.lowHp = Math.max(a.lowHp || 0, e.pct || 0);
      break;
    case 'firstHit':
      a.firstHit = true;
      break;
    case 'dotImmune':
      a.dotImmune = true;
      break;
    case 'resist':
      a.resist = true;
      break;
    // shields, second batch
    case 'arrowBlock':
      a.arrowBlock = Math.max(a.arrowBlock || 0, e.pct || 0);
      break;
    case 'buckler':
      a.meleeDR = (a.meleeDR || 0) + 1;
      a.dodge = Math.max(a.dodge || 0, 5);
      break;
    case 'openGuard':
      a.openGuardHits = Math.max(a.openGuardHits || 0, e.hits || 2);
      a.openGuardPct = Math.max(a.openGuardPct || 0, e.pct || 50);
      break;
    case 'spellBlock':
      a.spellBlock = Math.max(a.spellBlock || 0, e.pct || 0);
      break;
    case 'roundWard':
      a.roundWard = (a.roundWard || 0) + (e.amt || 0);
      break;
    case 'stunImmune':
      a.stunImmune = true;
      break;
    // guardian perks (2026-10-14, batch item 7): graded wards
    case 'stunWard':
      a.stunWard = Math.max(a.stunWard || 0, e.pct || 0);
      break; // % of stuns turned as they land (100: never stunned)
    case 'dotWard':
      a.dotWard = Math.max(a.dotWard || 0, e.pct || 0);
      break; // % off every tick of lingering harm (100: immune)
    case 'schoolWard':
      if (e.school) {
        a.schoolWard = { ...(a.schoolWard || {}) };
        a.schoolWard[e.school] = Math.max(a.schoolWard[e.school] || 0, e.pct || 0);
      }
      break; // −N to that school's cast chance
    default:
      return a;
  }
  if (name && !a.names.includes(name)) a.names.push(name);
  return a;
}
export function pcArmourOf(items) {
  let a = null;
  const seen = new Set();
  (items || []).forEach((it) => {
    if (!it || !it.effect || it.effect.stat !== 'armour') return;
    const base = _ITEM_ALT_BASE[it.name] || it.name;
    if (seen.has(base)) return;
    seen.add(base); // a clone of the same piece counts once
    a = pcArmourMerge(a, it.effect, it.name);
  });
  return a;
}
// Legacy name kept for the item-grant call sites: granting (or losing) a max-HP item just resyncs.
export function applyItemMaxHp(ch, item) {
  if (!ch) return;
  if (item && item.effect && item.effect.stat !== 'maxHp') return;
  syncMaxHp(ch);
}
export function grantMithrilTo(ch, gs) {
  if (!ch || ch.alive === false) return;
  ch.items = ch.items || [];
  if (ch.items.some((it) => it.effect && it.effect.stat === 'mithrilArmour')) return; // already suited
  const id = gs.nextItemId || 0;
  gs.nextItemId = (gs.nextItemId || 0) + 1;
  ch.items.push({ ...MITHRIL_ARMOUR, effect: { ...MITHRIL_ARMOUR.effect }, id });
}
// ── MITHRIL IS NOT LOOT ────
// A suit is a PERSONAL granted relic: every qualifying dwarf is re-issued one at the start of each
// turn. So if a suit ever CHANGES HANDS the original wearer simply receives a fresh one next turn
// and the copies multiply — that is how a dwarven king came to be wearing two. The suit is now
// untransferable on every path (inheritance, a killer's spoils, mercy-price, theft, Send Item), and
// the sweep below is the self-healing net for saves made before that was true: at most ONE suit per
// character, and none at all in hands that do not qualify.
export function isMithril(it) {
  return !!(it && it.effect && it.effect.stat === 'mithrilArmour');
}
// The part of a pack that is free to change hands — everything except the granted relics.
export function transferableItems(items) {
  return (items || []).filter((it) => !isMithril(it));
}
// Items handed to a killer by handleHeroDeath this session (2026-09-23c). Battles are fought on
// shallow COPIES, and syncLeaderCopy writes the copy's fields back onto the real commander after
// the fight — `items` included. Loot landed on the real record mid-battle is therefore re-added by
// syncLeaderCopy if the copy's item list does not carry it. Item objects are fresh per turn (the
// state is parsed from JSON), so a module-level WeakSet never leaks between turns.
export const _KC_LOOT_GAINED = new WeakSet();
export function mithrilQualifies(ch, gs) {
  return !!(
    ch &&
    ch.alive !== false &&
    ch.race === 'Dwarven' &&
    ch.player != null &&
    gs &&
    gs.players &&
    gs.players[ch.player] &&
    gs.players[ch.player].race === 'Dwarven'
  );
}
export function grantMithrilToDwarves(gs) {
  if (!gs || !gs.characters || !gs.players) return;
  gs.characters.forEach((ch) => {
    if (!ch) return;
    const ok = mithrilQualifies(ch, gs);
    if (Array.isArray(ch.items)) {
      let kept = false;
      const before = ch.items.length;
      ch.items = ch.items.filter((it) => {
        if (!isMithril(it)) return true;
        if (ok && !kept) {
          kept = true;
          return true;
        }
        return false;
      });
      if (ch.items.length !== before) applyItemMaxHp(ch, null);
    }
    if (ok) grantMithrilTo(ch, gs);
  });
}
