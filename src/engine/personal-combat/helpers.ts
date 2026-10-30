import { KC_RUMOUR_COST_BY_POWER } from '../../content/kingdoms-call-data.ts';
import { MITHRIL_ARMOUR } from '../heroes/fame-and-consecration.ts';
import { _ITEM_ALT_BASE } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { syncMaxHp } from '../heroes/skills-and-hp.ts';
import {
  anItemChangesAHerosMaximumHp,
  anItemIsWornAsArmour,
  whatAWardSetsInTheWardsAFighterWears,
} from '../rules/the-registry-of-magic-item-effects.ts';
import type { Character, GameState, Item, Realm } from '../../schemas/saved-game-state.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type {
  AWardAsTheMergeReadsIt,
  TheRidersOfAnItemOrAPerk,
  TheWardsAFighterWears,
} from '../rules/the-registry-of-content-effects.ts';

// ── A FIGHTER IN A PERSONAL COMBAT, HIS STATUS AND HIS RIDERS (plan P1-10b11, P1-10's Choice 1 of 2026-10-29) ── types
// only. A fighter is made fresh for each fight (pcCharCombatant for a hero, pcMonsterCombatant for a guardian, in
// speed-encounter-plans-and-combatants.ts) and never saved, so these are plain interfaces, not schemas. One shape every
// function of the fight reads: the fields both builders set are required; a field only one kind of fighter has, or one
// the fight writes later, is optional, so a read of it that the code guards stays guarded. They are declared here, in
// the file of the wards' merge, not in a file of their own: a file under src/ that no page bundles fails the harness
// (tests/static/pages-build.test.ts, "every file under src/ is in a page"). The wards he wears, a ward and the riders as
// the merge reads them are the items' registry's stage types since plan P1-19q (src/engine/rules/ imports nothing from
// here: npm run lint:arch), and are exported from here too, by the same names.
export type {
  AWardAsTheMergeReadsIt,
  TheRidersOfAnItemOrAPerk,
  TheWardsAFighterWears,
} from '../rules/the-registry-of-content-effects.ts';
/** A lingering harm on a fighter (a damage-over-time: a bleed, a burn), added by pcPushDot. */
export interface ALingeringHarm {
  dmg: number;
  rounds: number;
  label: string;
}

/** A healing over time on a fighter (a combat item's), as the fight writes it. */
export interface AHealingOverTime {
  amt: number;
  rounds: number;
  label: string;
}

/** A fighter's status in a fight (pcNewStatus, then what the fight writes later). */
export interface AFightersStatus {
  stun: number;
  hitPenalty: number;
  dodge: number;
  meleeHalvedRounds: number;
  silenceRounds: number;
  dot: ALingeringHarm[];
  mirrorImages: number;
  freeAttacksForFoe: number;
  fleeBonus: number;
  fleePenalty: number;
  reflect: number;
  absorb: number;
  incomingDmgBonus: number;
  bestAbilityHalved: boolean;
  nextAttackFails: number;
  /** A to-hit penalty that lasts the whole fight (it doesn't fade 5% a round). */
  hitPenaltyFixed: number;
  /** The riders waiting to take hold at the start of the next round (pcDeferEffect). */
  _pending: (() => void)[];
  // What the fight writes later:
  hitBonus?: number | undefined;
  auraPenalty?: number | undefined;
  toHitReduce?: number | undefined;
  meleeDown?: number | undefined;
  meleeDownRounds?: number | undefined;
  fleeDoubled?: boolean | undefined;
  _swShrugPct?: number | undefined;
  hot?: AHealingOverTime | undefined;
}

/** A fighter's level in each school of magic. */
export interface AFightersSchools {
  white: number;
  psychic: number;
  illusory: number;
  elemental: number;
  necromancy: number;
}

/** One of a guardian's special abilities (its `spells`), as the fight reads it. */
export interface AGuardiansSpecial {
  readonly name: string;
  readonly school?: string | undefined;
  readonly dmgW?: number | undefined;
  readonly effect?: string | null | undefined;
  readonly castChance?: number | undefined;
  readonly flavour?: string | undefined;
}

/** A guardian's weakness: the one flaw a player can learn and build a hero around (pcWeaknessApplies). */
export interface AGuardiansWeakness {
  readonly kind: string;
  readonly key: string;
  readonly name: string;
  readonly desc: string;
}

/** One of a guardian's perks (its `passives`, or an older save's one `passive`): its name, its words and its riders. */
export interface AGuardiansPerk {
  readonly name: string;
  readonly desc?: string | undefined;
  readonly fx?: TheRidersOfAnItemOrAPerk | null | undefined;
}

/** A guardian as his fighter is built from him (pcMonsterCombatant): a lair's guardian, or a guardian table's row.
 *  Every field optional, as the builder's guards read them. */
export interface AGuardianAsHisFighterIsBuilt {
  readonly name?: string | undefined;
  readonly cat?: string | null | undefined;
  readonly hp?: number | undefined;
  readonly _hpFull?: number | null | undefined;
  readonly melee?: number | undefined;
  readonly archery?: number | undefined;
  readonly ranged?: boolean | undefined;
  readonly speed?: string | undefined;
  readonly power?: string | undefined;
  readonly spells?: AGuardiansSpecial[] | null | undefined;
  readonly weak?: AGuardiansWeakness | null | undefined;
  readonly passives?: (AGuardiansPerk | null | undefined)[] | null | undefined;
  readonly passive?: AGuardiansPerk | null | undefined;
}

/** The mark a hero's fatal blow leaves (where in the fight's lines it fell, and who struck it). */
export interface AFatalMark {
  arr: NarrativeLine[];
  idx: number;
  blow: string | null;
  kind?: string | undefined;
}

/** A hero as a personal combat takes him: a hero of the world, or a copy of one the Hunting Rumours fight on
 *  (simulateLairOdds), whose id is a string no hero of the world carries. */
export type AHeroAsAFightTakesHim = Omit<Character, 'id'> & { id: Character['id'] | string };

/** A fighter in a personal combat: a hero (`kind` 'character', his `ref` the hero) or a guardian ('monster', his `ref`
 *  the guardian). */
export interface AFighterInAPersonalCombat {
  // Both builders set these:
  /** A hero, a guardian, or a Mirror Image's phantom of either (pcCastCombatSpell: a copy of its victim). */
  kind: 'character' | 'monster' | 'phantasm';
  ref: AHeroAsAFightTakesHim | AGuardianAsHisFighterIsBuilt;
  name: string;
  player: Character['player'];
  hp: number;
  maxHp: number;
  melee: number;
  archery: number;
  temper: string;
  neverFlees: boolean;
  school: AFightersSchools;
  specials: AGuardiansSpecial[];
  tactics: string[];
  tacIdx: number;
  planExhausted: boolean;
  status: AFightersStatus;
  castSpells: string[];
  castSchool: Partial<Record<string, number>>;
  isUndead: boolean;
  /** The wards he wears: a hero's from his armour (null if none), a guardian's from his perks and grade (none if
   *  neither gives one). */
  arm?: TheWardsAFighterWears | null | undefined;
  // A hero's alone:
  meleeRaw?: number | undefined;
  archeryRaw?: number | undefined;
  meleeBase?: number | undefined;
  archeryBase?: number | undefined;
  alignment?: string | undefined;
  speedBonus?: number | undefined;
  mithril?: boolean | undefined;
  mithrilDR?: number | undefined;
  perkParry?: boolean | undefined;
  perkCounter?: boolean | undefined;
  perkImpale?: boolean | undefined;
  perkTrueshot?: boolean | undefined;
  perkElemArmour?: boolean | undefined;
  /** His once-a-fight potions and scrolls (a guardian's too, from a hoard he wields). */
  combatItems?: Item[] | undefined;
  // A guardian's alone:
  ranged?: boolean | undefined;
  speedName?: string | undefined;
  pacifiable?: boolean | undefined;
  vuln?: { melee: number; archery: number; spell: number } | undefined;
  cat?: string | undefined;
  weak?: AGuardiansWeakness | null | undefined;
  power?: string | undefined;
  perks?: { name: string; desc: string }[] | undefined;
  _perkName?: Partial<Record<string, string>> | undefined;
  passiveName?: string | undefined;
  passiveDesc?: string | undefined;
  wielded?: Item[] | undefined;
  _hpItemBonus?: number | undefined;
  gauntlets?: boolean | undefined;
  // The riders (pcApplyFx):
  aura?: number | undefined;
  burn?: number | undefined;
  drain?: number | undefined;
  dmgBonus?: number | undefined;
  // What the fight writes on him, its marks:
  druidBeastWard?: number | undefined;
  _foe?: AFighterInAPersonalCombat | undefined;
  _foeCat?: string | undefined;
  _armFirstHitUsed?: boolean | undefined;
  _armSecondWindUsed?: boolean | undefined;
  _secondWindUsed?: boolean | undefined;
  _roundNo?: number | undefined;
  _roundWardLeft?: number | undefined;
  _openGuardUsed?: number | undefined;
  _openingShotUsed?: boolean | undefined;
  _sustainSpent?: boolean | undefined;
  _selfHealUsed?: boolean | undefined;
  _itemsUsed?: Set<string> | undefined;
  _fatalMark?: AFatalMark | null | undefined;
  _fleeAttempted?: boolean | undefined;
  _freeAttacks?: number | undefined;
  _begged?: boolean | undefined;
  _rebirth?: boolean | undefined;
  _didMelee?: boolean | undefined;
  _didArchery?: boolean | undefined;
  _xpGained?: boolean | undefined;
  _vsGuardian?: boolean | undefined;
  _hpStart?: number | undefined;
  _hpLow?: number | undefined;
}

// Its types (plan P1-10b11): each parameter typed as wide as the body's guards (plan P1-10's Decision 2), so each guard
// stays.
/** A fighter as his status is read where the code guards it (a fighter with no status, or no list there). */
interface AFighterAsHisStatusIsGuarded {
  readonly status?:
    | {
        dot?: (ALingeringHarm | null | undefined)[] | null | undefined;
        _pending?: (() => void)[] | null | undefined;
      }
    | null
    | undefined;
}
/** A rule's switch (PARLEY_ENABLED, SCOUT_ENABLED): on or off, not the one value it holds today, so a test of it still
 *  reads it when it is turned on (as ARCHERY_PARTING_SHOT's, melee-flight-and-archery.ts). */
type ASwitchTurnedOnOrOff = boolean;
/** A guardian's weakness as pcWeaknessApplies reads it. */
interface AWeaknessAsItIsTested {
  readonly kind?: string | undefined;
  readonly key?: string | undefined;
}
/** A blow as pcWeaknessApplies tests it against a weakness: its channel, its school, its striker's race and realm's
 *  alignment. */
interface ABlowAsAWeaknessTestsIt {
  readonly chan?: string | undefined;
  readonly school?: string | null | undefined;
  readonly race?: string | null | undefined;
  readonly align?: string | null | undefined;
}
/** A realm as these read and write what it has learnt: the weaknesses it knows and the lairs' hoards it heard of. An
 *  older save may hold something other than a table there (the code replaces it). */
interface ARealmAsItsLessonsAreRead {
  _knownWeak?: Partial<Record<string, boolean>> | string | number | boolean | null | undefined;
  _lairRumours?: Partial<Record<string, ALairsRumour>> | string | number | boolean | null | undefined;
}
/** A lair's hoard as Hunting Rumours learnt it. */
type ALairsRumour = NonNullable<Realm['_lairRumours']>[string];
/** An item as these read it: its name and its effect's kind. */
interface AnItemAsTheseReadIt {
  readonly name?: string | undefined;
  readonly effect?: { readonly stat?: string | undefined } | null | undefined;
}
/** An item as the armour's merge reads it: its name and its effect, a ward. */
interface AnItemAsItsArmourIsRead {
  readonly name: string;
  readonly effect?: (AWardAsTheMergeReadsIt & { readonly stat?: string | undefined }) | null | undefined;
}
/** A hero as the Mithril suit is granted him: alive or not, and his items. */
interface AHeroAsMithrilIsGrantedHim {
  readonly alive?: boolean | undefined;
  items?: Item[] | null | undefined;
}
/** A hero as mithrilQualifies reads him. */
interface AHeroAsMithrilQualifiesHim {
  readonly alive?: boolean | undefined;
  readonly race?: string | undefined;
  readonly player?: number | null | undefined;
}
/** The state as the Mithril passes read it: its heroes and realms (either may be missing), and the next item's id. */
interface TheStateAsTheMithrilPassesReadIt {
  readonly characters?: readonly (Character | null | undefined)[] | null | undefined;
  readonly players?: readonly ({ readonly race?: string | undefined } | null | undefined)[] | null | undefined;
  nextItemId?: GameState['nextItemId'] | null | undefined;
}

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
export const PARLEY_ENABLED: ASwitchTurnedOnOrOff = false;
// the Scout encounter tactic is withdrawn too. Same pattern — the mechanic below is intact; see the
// 'SC' case in pcRunTactic for what else to restore alongside it.
export const SCOUT_ENABLED: ASwitchTurnedOnOrOff = false;
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
export function pcLingerRounds(n: number | string | null | undefined) {
  n = parseInt(String(n)); // parseInt reads its argument as a string
  if (!Number.isFinite(n) || n < 1) n = 1;
  return Math.min(PC_MAX_LINGER_ROUNDS, n);
}
// The ONE place a damage-over-time is added, so the three-round cap cannot be bypassed by a new
// effect that forgets it. Merges nothing — several bleeds may run at once, each on its own clock.
export function pcPushDot(
  cbt: AFighterAsHisStatusIsGuarded | null | undefined,
  dmg: number | null | undefined,
  rounds: number | string | null | undefined,
  label: string | null | undefined,
): ALingeringHarm | null {
  if (!cbt?.status) return null;
  cbt.status.dot ??= [];
  const lbl = (label ?? '') || 'Lingering harm';
  const e = { dmg: Math.max(1, Math.round((dmg ?? 0) || 1)), rounds: pcLingerRounds(rounds), label: lbl };
  // The SAME affliction REFRESHES rather than stacking. Without this an archer with Impalement
  // stacks a fresh three-round bleed on every hit and the target bleeds for the whole fight after
  // all — the exact thing the three-round cap exists to stop. Different afflictions still run side
  // by side.
  const prev = cbt.status.dot.find((d) => d?.label === lbl);
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
export function pcDeferEffect(
  cbt: AFighterAsHisStatusIsGuarded | null | undefined,
  fn: (() => void) | null | undefined,
) {
  if (!cbt?.status || typeof fn !== 'function') return false;
  (cbt.status._pending ??= []).push(fn);
  return true;
}
// Run every rider hung on this combatant last round. Called at the END of pcRoundStart, AFTER that
// round's fades and decrements, so a freshly-promoted penalty does not lose a tick of its life on
// arrival (a −20% aim penalty promoted here fades for the first time at the start of the round
// after).
export function pcPromotePending(cbt: AFighterAsHisStatusIsGuarded | null | undefined) {
  if (!cbt?.status) return;
  const q = cbt.status._pending;
  if (!q?.length) return;
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
export function pcPenaltyFade(pen: number) {
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
} satisfies Record<string, keyof AFightersSchools>;
// Percentage-of-max-HP spells are exempt from the DAMAGE doubling — Hand of Death already takes
// half a guardian's total, and doubling that is an instant kill on anything. A Necromancy-weak
// guardian gets the take-hold chance doubled instead (see pcCastCombatSpell).
export const PC_WEAK_NO_DMG_DOUBLE = new Set(['Hand of Death']);
export function pcWeaknessApplies(
  w: AWeaknessAsItIsTested | null | undefined,
  o: ABlowAsAWeaknessTestsIt | null | undefined,
) {
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
export function pcLearnWeakness(
  gs:
    | { readonly players?: readonly (ARealmAsItsLessonsAreRead | null | undefined)[] | null | undefined }
    | null
    | undefined,
  playerIndex: number | null | undefined,
  monsterName: string | null | undefined,
) {
  if (!gs || playerIndex == null || !monsterName) return false;
  const pl = (gs.players ?? [])[playerIndex];
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
export function lairRumourKey(provId: number, idx: number) {
  return String(provId) + ':' + String(idx);
}
export function noteLairRumour(
  pl: ARealmAsItsLessonsAreRead | null | undefined,
  provId: number,
  idx: number,
  rec: ALairsRumour,
) {
  if (!pl) return;
  if (!pl._lairRumours || typeof pl._lairRumours !== 'object') pl._lairRumours = {};
  pl._lairRumours[lairRumourKey(provId, idx)] = rec;
}
// ── ARMOUR ── fold every worn armour item into one ward table for personal combat. Flat reductions add, percentages
// take the best, flags OR: each ward's own effect in the items' registry (plan P1-19q), which a guardian's perk of the
// same ward reaches too; a guardian's perks' own three wards are merged here (the guardian family's, later). Used by
// pcCharCombatant, by pcApplyFx (an item's rider, a guardian's perk) and by a guardian wielding a hoard's armour
// (resolveEncounter).
export function pcArmourMerge(
  a: TheWardsAFighterWears | null | undefined,
  e: AWardAsTheMergeReadsIt | null | undefined,
  name: string | null | undefined,
): TheWardsAFighterWears {
  a ??= { names: [] };
  e ??= {};
  const set = whatAWardSetsInTheWardsAFighterWears(e, a);
  if (set) Object.assign(a, set);
  else
    switch (e.ward) {
      // guardian perks (2026-10-14, batch item 7): graded wards
      case 'stunWard':
        a.stunWard = Math.max(Number(a.stunWard) || 0, e.pct ?? 0);
        break; // % of stuns turned as they land (100: never stunned)
      case 'dotWard':
        a.dotWard = Math.max(Number(a.dotWard) || 0, e.pct ?? 0);
        break; // % off every tick of lingering harm (100: immune)
      case 'schoolWard':
        if (e.school) {
          const schoolWard: Partial<Record<string, number>> = { ...(a.schoolWard ?? {}) };
          a.schoolWard = schoolWard;
          schoolWard[e.school] = Math.max(Number(schoolWard[e.school]) || 0, e.pct ?? 0);
        }
        break; // −N to that school's cast chance
      default:
        return a;
    }
  if (name && !a.names.includes(name)) a.names.push(name);
  return a;
}
// Its return type is written: `a` is set inside the callback, which the compiler doesn't follow.
export function pcArmourOf(
  items: readonly (AnItemAsItsArmourIsRead | null | undefined)[] | null | undefined,
): TheWardsAFighterWears | null {
  let a: TheWardsAFighterWears | null = null;
  const seen = new Set<string>();
  (items ?? []).forEach((it) => {
    if (!it || !anItemIsWornAsArmour(it)) return; // the items' registry (plan P1-19q)
    const base = (_ITEM_ALT_BASE[it.name] ?? '') || it.name;
    if (seen.has(base)) return;
    seen.add(base); // a clone of the same piece counts once
    a = pcArmourMerge(a, it.effect, it.name);
  });
  return a;
}
// Legacy name kept for the item-grant call sites: granting (or losing) a max-HP item just resyncs.
export function applyItemMaxHp(
  ch: Parameters<typeof syncMaxHp>[0],
  item: { readonly effect?: { readonly stat?: string | undefined } | null | undefined } | null | undefined,
) {
  if (!ch) return;
  if (item?.effect && !anItemChangesAHerosMaximumHp(item)) return; // the items' registry (plan P1-19p)
  syncMaxHp(ch, undefined); // no realms: syncMaxHp reads maxHpPlayers' (its second argument was left out)
}
export function grantMithrilTo(
  ch: AHeroAsMithrilIsGrantedHim | null | undefined,
  gs: { nextItemId?: GameState['nextItemId'] | null | undefined },
) {
  if (!ch || ch.alive === false) return;
  ch.items ??= [];
  if (ch.items.some((it: AnItemAsTheseReadIt) => it.effect?.stat === 'mithrilArmour')) return; // already suited
  const id = Number(gs.nextItemId) || 0;
  gs.nextItemId = (Number(gs.nextItemId) || 0) + 1;
  ch.items.push({ ...MITHRIL_ARMOUR, effect: { ...MITHRIL_ARMOUR.effect }, id });
}
// ── MITHRIL IS NOT LOOT ────
// A suit is a PERSONAL granted relic: every qualifying dwarf is re-issued one at the start of each
// turn. So if a suit ever CHANGES HANDS the original wearer simply receives a fresh one next turn
// and the copies multiply — that is how a dwarven king came to be wearing two. The suit is now
// untransferable on every path (inheritance, a killer's spoils, mercy-price, theft, Send Item), and
// the sweep below is the self-healing net for saves made before that was true: at most ONE suit per
// character, and none at all in hands that do not qualify.
export function isMithril(it: AnItemAsTheseReadIt | null | undefined) {
  return it?.effect?.stat === 'mithrilArmour';
}
// The part of a pack that is free to change hands — everything except the granted relics.
export function transferableItems<AnItem extends AnItemAsTheseReadIt | null | undefined>(
  items: readonly AnItem[] | null | undefined,
): AnItem[] {
  return (items ?? []).filter((it) => !isMithril(it));
}
// Items handed to a killer by handleHeroDeath this session (2026-09-23c). Battles are fought on
// shallow COPIES, and syncLeaderCopy writes the copy's fields back onto the real commander after
// the fight — `items` included. Loot landed on the real record mid-battle is therefore re-added by
// syncLeaderCopy if the copy's item list does not carry it. Item objects are fresh per turn (the
// state is parsed from JSON), so a module-level WeakSet never leaks between turns.
export const _KC_LOOT_GAINED = new WeakSet();
export function mithrilQualifies(
  ch: AHeroAsMithrilQualifiesHim | null | undefined,
  gs: Pick<TheStateAsTheMithrilPassesReadIt, 'players'> | null | undefined,
) {
  if (!ch || ch.alive === false || ch.race !== 'Dwarven' || ch.player == null) return false;
  const pl = gs?.players?.[ch.player]; // his realm, read once
  return pl?.race === 'Dwarven';
}
export function grantMithrilToDwarves(gs: TheStateAsTheMithrilPassesReadIt | null | undefined) {
  if (!gs?.characters || !gs.players) return;
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
