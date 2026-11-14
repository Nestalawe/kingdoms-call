import { KC_CARRIER_BERTHS, PRIMAL_ARMY_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { THE_ALIGNMENT_ORDERS } from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { ARMY_SPEED_MASTER, SKILL_LABELS } from '../army-tables.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { heroHireWage } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { wildHuntPrice } from '../items/tiers-and-hoards.ts';
import { consecratedIds } from '../world/the-marks-on-a-province-consecrated-ground-terror-and-enslave.ts';
import { itemSlot, itemUsableBy } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { featDiscovered } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { ITEM_SLOT_CAP, activeItems, itemPowerScore } from '../items/equipment.ts';
import { thePowerAnItemWorksWhenUsed } from '../rules/the-registry-of-magic-item-effects.ts';
import { effSkillOf } from '../heroes/skills-and-hp.ts';
import { RUMOUR_COST_BY_POWER, isMithril } from '../personal-combat/helpers.ts';
import {
  BOT_AERIAL_TYPES,
  BOT_CARRIER_TYPES,
  BOT_DEF_BONUS,
  BOT_HEX_DIRS,
  BOT_SEA_ALL,
  botBattleForce,
  botBelief,
  botBelievedOwner,
  botKnows,
  botKnowsGraves,
  botMarginFor,
  botNeighbourProv,
  botRaceTerrainMult,
  botRelationRaw,
  botSees,
  botSeesChar,
  botTargetDefence,
  botTurnCache,
  botVisibleCharsIn,
} from './intel.ts';
import { botCanFly, botSeaCap } from './war.ts';
import {
  BOT_LAIR_GO_BAND_HI,
  BOT_LAIR_REASK_GAIN,
  BOT_SPECIALIST_ROLES,
  botAssumedChar,
  botAtWar,
  botDuelSkill,
  botEnemyChars,
  botEnemyIntel,
  botFleetOnly,
  botGarrisonTarget,
  botHasMetPlayers,
  botHeroCap,
  botHireBias,
  botHomeId,
  botIsEdge,
  botIsLeader,
  botIsTeach,
  botLairRating,
  botLiftable,
  botMoveOrder,
  botNearbyThreat,
  botPathDirs,
  botPathLen,
  botRumourFor,
  botSpend,
} from './strategy.ts';
import { BOT_SCHOOLS } from './schools.ts';
import { botDuelRating, botFillOrders, botPathAny, botPathLenAny, botSpyTarget } from './spellcraft.ts';
import { isCharmedNow } from '../heroes/charms-and-neutrals.ts';
import { DISC_BY_ID } from '../discoveries.ts';
import type { ADiscoverysRow } from '../../content/discovery-effects-their-kinds-numbers-and-words.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../turn/events-and-their-audiences.ts';
import { theNameOfTheSpell } from './the-name-of-a-spell-by-its-slug.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { TurnContext } from '../turn/context.ts';
import type { PhaseOrder } from '../../schemas/orders-a-realm-submits.ts';
import type { Army, Character, GameState, Item, Province, ProvinceFeature } from '../../schemas/saved-game-state.ts';
import type { ABotRealmsLedger, ABotRealmsRoles, ABotRealmsSpending } from './intel.ts';

// Its types (plan P1-10b45): each parameter typed as wide as the body's guards, so each guard stays.
/** A phase's order as the passes read a plan: an order, or a gap the plan holds. */
type AnOrderAsThePassesReadIt = PhaseOrder | null | undefined;
/** The turn's orders as the passes read and write them, by hero (G.turnOrders). */
type TheTurnsOrdersAsThePassesHoldThem = Partial<Record<string, AnOrderAsThePassesReadIt[]>>;
/** A unit with the turn's marks the schema lacks: a company that stays only this turn. */
type AUnitWithItsTurnsMarks = Army & { readonly _temporary?: boolean | undefined };
/** A lair a hero may hunt (botLairCandidates): its province, its place there, its grade and rumour's price, the hops
 *  to it, and the rumour he holds of it (none for a lair of no guardian, which is searched as if certain). */
interface ALairCandidate {
  readonly X: Province;
  readonly li: number;
  readonly f: ProvinceFeature;
  readonly grade: number;
  readonly price: number;
  readonly d: number;
  readonly rumour: { readonly band: number } | null;
}
/** A lair candidate with the hops to it found. */
interface ALairInReach {
  readonly x: ALairCandidate;
  readonly d: number;
}
/** An order of a hero's lair plan: a search may carry the health he must keep, and the rumour's band it waits on. */
type ALairOrder = PhaseOrder & {
  _botMinHp?: number;
  _botIfRumour?: number;
  _botIfRumourLow?: number;
  _botIfRumourLowHp?: number;
};
/** A lair's key among those a plan has used: its province and its place there. */
function theLairsKey(x: ALairCandidate): string {
  return `${String(x.X.id)}:${String(x.li)}`;
}
/** The ledger a rumour is paid from: a rumour is asked only where the plan holds one (askable), so for none the
 *  TypeError its read would throw. */
function theLedgerARumourIsPaidFrom(L: ABotRealmsLedger | null | undefined): ABotRealmsLedger {
  if (!L) throw new TypeError("Cannot read properties of null (reading 'rumourFund')");
  return L;
}
/** A move along a path botPathDirs found, whose steps may hold a gap: a gap reads no way, as `BOT_HEX_DIRS[undefined]`
 *  did (`-1` names none either). */
function aMoveOrderOnThePath(d: number | undefined, desc: string) {
  return botMoveOrder(d ?? -1, desc);
}
/** The best target a sea strike has found: its province, score and hops, a fight there, a rendezvous with a general. */
interface ASeaTarget {
  readonly N: Province;
  readonly sc: number;
  readonly d: number;
  readonly fight: boolean;
  readonly rv: boolean;
}
/** The best target an air strike has found: its province, score and hops, and a fight there. */
interface AnAirTarget {
  readonly N: Province;
  readonly sc: number;
  readonly d: number;
  readonly fight: boolean;
}
/** The ways from a strike's start to a province its search reached, walked back through each step's province before
 *  (`prev`, none at the start) and the way from it (`dirOf`, which a step may lack, read as a gap as before). */
function theWaysBackFrom(
  prev: Readonly<Partial<Record<number, number | null>>>,
  dirOf: Readonly<Partial<Record<number, number>>>,
  to: number,
): (number | undefined)[] {
  const dirs: (number | undefined)[] = [];
  let id = to;
  let back = prev[id];
  while (back !== null && back !== undefined) {
    dirs.unshift(dirOf[id]);
    id = back;
    back = prev[id];
  }
  return dirs;
}
/** A lesson a teacher can give a slayer this year: its phase, its skill, a helper who takes the king's recruit
 *  phase, and whether it opens the hunting gate (a Melee lesson below 3). */
interface ALesson {
  readonly q: number;
  readonly S: string;
  readonly helper: Character | null;
  readonly gate: boolean;
}
/** The slayer's best year at the school: his teacher, the province, the path there, the lessons and their score. */
interface ASlayersBestLesson {
  readonly m: Character;
  readonly X: number;
  readonly path: readonly (number | undefined)[];
  readonly plan: readonly ALesson[];
  readonly sc: number;
}
/** An order's target as words (`String`, as before: a plan another pass wrote may hold its target as a number). */
function theTargetAsWords(o: { readonly target: unknown }): string {
  return String(o.target);
}
/** A skill's label, else its key (`SKILL_LABELS[sk] || sk`, as before: a label of no words gives the key). */
function theLabelOf(sk: string): string {
  const labels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
  return (labels[sk] ?? '') || sk;
}
/** The king's recruit a helper raises in his place: the school hands one on only where the king's plan holds a
 *  recruit there, so for none the TypeError its read would throw. */
function theRecruitHandedOn(ro: AnOrderAsThePassesReadIt): PhaseOrder {
  if (ro == null) throw new TypeError(`Cannot read properties of ${String(ro)} (reading 'target')`);
  return ro;
}
/** A duel's forecast (the movement pass's `duelSim`): the odds of a kill and of being felled. */
interface ADuelsForecast {
  readonly win: number;
  readonly felled: number;
}
/** The movement pass's duel forecast: a fight on copies of both heroes, over a number of rounds. */
type ADuelForecaster = (hero: Character, foe: Character, rounds: number) => ADuelsForecast | null | undefined;
/** The bots' weights a sea or air strike reads (botTuning's, bots/intel.ts). */
interface TheWeightsAStrikeReads {
  readonly kingAttackMargin: number;
  readonly heroAttackMargin: number;
  readonly taxScoreWeight: number;
  readonly rivalBias: number;
}
/** What a mastery order weighs: a fight ahead, from the sea, a host holding with a threat near, a duel's forecast. */
interface TheMasterysChoices {
  readonly fightAhead?: unknown;
  readonly fromSea?: boolean | undefined;
  readonly holding?: boolean | undefined;
  readonly threat?: boolean | undefined;
  readonly duelSim?: ADuelForecaster | null | undefined;
}
/** The turn's orders, read where the code read `G.turnOrders` (the passes write them through this type). */
function theTurnsOrders(G: GameState): TheTurnsOrdersAsThePassesHoldThem {
  return G.turnOrders;
}
/** The world's characters, where the code tests the list for a gap. */
function theCharactersOf(G: GameState): readonly (Character | null | undefined)[] {
  return asItsGuardReadsIt(G.characters) ?? [];
}
/** The world's provinces, where the code tests the list for a gap. */
function theProvincesOf(G: GameState): readonly (Province | null | undefined)[] {
  return asItsGuardReadsIt(G.world.provinces) ?? [];
}
/** The realms, where the code tests the list for a gap. */
function theRealmsOf(G: GameState): readonly (GameState['players'][number] | null | undefined)[] {
  return asItsGuardReadsIt(G.players) ?? [];
}
/** A hero's units, where the code also tests the list for a gap. */
function theUnitsWithGapsOf(c: Character): readonly (Army | null | undefined)[] {
  return asItsGuardReadsIt(c.armies) ?? [];
}
/** A hero's items, where the code also tests the list for a gap. */
function theItemsWithGapsOf(c: Character): readonly (Item | null | undefined)[] {
  return asItsGuardReadsIt(c.items) ?? [];
}

// ══ INFILTRATOR — conjure a host behind the enemy line ════
// A caster with Necromancy or Elemental magic takes provinces by himself, with no army at all. He
// walks UNARMED into undefended enemy ground (no guard engages an unarmed character, so he can
// cross the front line freely), then spends his remaining phases casting:
// Necromancy → Skeletal Armies — raises 1–3 dead units per success (by Necromancy level) from the province's battleGraves
// Elemental → Elemental Summon — tears an elemental out of the air (no prerequisite; always available)
// Either way the caster GAINS a unit while standing on ground he does not own, and the engine's
// resolveUnitGainInProvince hands him the province that same phase when nothing is there to contest
// it.
//
// The two schools then diverge, and both are wanted:
// • An elemental DISSOLVES at turn's end — the land stays taken, the caster is unarmed again next turn
// and simply walks on to the next undefended province. A one-man province-taking machine.
// • Skeletons STAY (1g/turn upkeep). A necromancer therefore snowballs: once he holds 3+ units
// botRoles promotes him to a field LEADER and the ordinary expansion/recruit AI takes him over —
// which is Toby's "or start recruiting armies and capturing more provinces".
// Between those two states (1–2 skeletons) he keeps infiltrating, but only into ADJACENT undefended
// ground: an armed column that marches into a defended province fights, and this force must not.
//
// TARGETING — "undefended" means nothing present can contest the province: no foreign armed
// character, no garrison, no neutral defenders. Scoring prefers ground DEEP inside enemy land
// (counted as enemy-owned neighbours: that is the "behind the front line" test), rich ground, and —
// for a necromancer — graves, less 3 per hop of walking. Unowned undefended land is a legal
// secondary target and needs no war.
export const BOT_INFILTRATE_RANGE = 5; // an unarmed character's full walking reach
export function botInfiltrateSchool(c: Character) {
  const s: Character['skills'] = asItsGuardReadsIt(c.skills) ?? {};
  const nec = Number(s.necromancy) || 0,
    ele = Number(s.elemental) || 0;
  if (nec < 1 && ele < 1) return null;
  return nec >= ele ? 'necromancy' : 'elemental';
}
// All of this character's units are conjured skeletons (i.e. everything he has, he raised himself).
export function botOnlySkeletal(c: Character) {
  const a = theUnitsWithGapsOf(c);
  return a.length > 0 && a.every((x) => x?._isSkeletal);
}
// Nothing in this province can fight for it. 2026-09-17: "undefended" is now a BELIEF, not a fact.
// Where the realm has eyes it still reads the ground truthfully; where it does not, an
// empty-looking province is only believed empty if the realm has seen it before AND its wealth band
// suggests little there — and the caster can still walk into a garrison nobody told him about,
// exactly as a player's infiltrator can.
export function botProvUndefended(G: GameState, prov: Province | null | undefined, pi: number) {
  if (!prov || prov.terrain === 'sea') return false;
  if (!botKnows(G, pi, prov.id)) return false; // never seen — not a plan, a guess in the dark
  if (!botSees(G, pi, prov.id)) {
    const b = botBelief(G, pi, prov);
    return !!b && (b.tax || 0) < 3 && b.owner == null; // only poor, unowned ground is ASSUMED empty
  }
  if ((asItsGuardReadsIt(prov.garrisonArmies) ?? []).length > 0) return false;
  if ((asItsGuardReadsIt(prov.neutralDefenders) ?? []).length > 0 || (asItsGuardReadsIt(prov.npcArmies) ?? 0) > 0)
    return false;
  return !botVisibleCharsIn(G, pi, prov).some(
    (e) => e.player !== pi && theUnitsWithGapsOf(e).length > 0 && !e._justDefeated,
  );
}
// Best province to conjure a host in, within `range` hops. {P,d,sc} or null.
export function botInfiltrateTarget(G: GameState, pi: number, c: Character, school: string | null, range: number) {
  const from = G.world.provinces[c.location];
  if (!from) return null;
  // the scan is confined to ground this realm has SEEN, judged on what it believes rather than on
  // the live arrays. Graves are read from the realm's own Graveyard lore
  // (_graveIntel — filled only by a necromancer standing on the ground or a Control Undead scan), not
  // from prov.battleGraves, so a bot can no longer smell every corpse in the world.
  const gravesKnown = (X: Province) => botKnowsGraves(G, pi, X.id);
  const graveCount = (X: Province) =>
    botSees(G, pi, X.id) ? (asItsGuardReadsIt(X.battleGraves) ?? []).length : gravesKnown(X) ? 2 : 0;
  let best: { readonly P: Province; readonly d: number; readonly sc: number } | null = null;
  for (const X of theProvincesOf(G)) {
    if (!X || X.terrain === 'sea') continue;
    if (!botKnows(G, pi, X.id)) continue; // unmapped country — not a target
    const b = botBelief(G, pi, X);
    if (!b) continue;
    if (b.owner === pi) continue;
    const enemyLand = b.owner != null && botRelationRaw(G, pi, b.owner) === 'enemy';
    if (b.owner != null && !enemyLand) continue; // never an ally's or a at-peace crown's land
    if (school === 'necromancy' && !gravesKnown(X)) continue; // no dead here that this realm knows of
    if (!botProvUndefended(G, X, pi)) continue;
    const d = X.id === from.id ? 0 : botPathLenAny(G, from, X.id, range);
    if (d == null) continue;
    let depth = 0;
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, X, i);
      const no = botBelievedOwner(G, pi, N);
      if (N && no != null && no !== pi && botRelationRaw(G, pi, no) === 'enemy') depth++;
    }
    const sc = (b.tax || 0) * 2 + depth * 4 + (enemyLand ? 10 : 0) + Math.min(3, graveCount(X)) * 2 - d * 3;
    if (!best || sc > best.sc) best = { P: X, d, sc };
  }
  return best;
}
// Build the full 5-phase infiltration order list, or null if it will not fit. `pre` is consumed.
export function botInfiltrateOrders(
  G: GameState,
  pi: number,
  c: Character,
  pre: readonly AnOrderAsThePassesReadIt[],
  school: string | null,
  range: number,
) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  const tgt = botInfiltrateTarget(G, pi, c, school, range);
  if (!tgt) return null;
  const spell = school === 'necromancy' ? theNameOfTheSpell('skeletal-armies') : theNameOfTheSpell('elemental-summon');
  const path = tgt.d > 0 ? (botPathAny(G, P, tgt.P.id, range) ?? []) : [];
  if (tgt.d > 0 && path.length !== tgt.d) return null; // could not reconstruct the walk
  if (pre.length + path.length >= 5) return null; // no phase left to cast in
  const mv = path.map((d) => botMoveOrder(d, 'Infiltrate ' + tgt.P.name));
  const casts: PhaseOrder[] = [];
  while (pre.length + mv.length + casts.length < 5)
    casts.push({ action: 'cast_spell', target: spell, extra: '', desc: 'Cast ' + spell });
  if (!casts.length) return null;
  return botFillOrders(G, pi, c, [...pre, ...mv, ...casts], []);
}

// ══ SIGNATURE ACTIONS (Sept 2026, bot strategy review R2) ════
// Until now no bot ever used its alignment's signature order. Each helper returns a pre-order (or null)
// for the character standing in `P`, spending through the turn ledger where gold is involved. One
// signature pre-order per character per turn; the engine's own once-per-turn rules still apply.
export function botConsecrateOK(G: GameState, pi: number, c: Character, X: Province | null | undefined) {
  const pl = theRealmsOf(G)[pi];
  if (pl?.alignment !== 'Divine' || !c.isKing || X?.owner !== pi || X.terrain === 'sea') return false;
  const home = botHomeId(G, pi);
  if (X.id === home) return false;
  const H = home != null ? G.world.provinces[home] : null;
  if (H) {
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, H, i);
      if (N?.id === X.id) return false;
    }
  }
  const list = consecratedIds(pl);
  if (list.includes(X.id)) return false;
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, X, i);
    if (N && list.includes(N.id)) return false;
  }
  return list.length < (Number(asItsGuardReadsIt(c.skills)?.white) || 0);
}
// The richest consecratable owned province within `maxD` hops of the king (through own land). {X,d} or null.
export function botConsecrateTarget(G: GameState, pi: number, c: Character, maxD: number) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  let best: { readonly X: Province; readonly d: number; readonly sc: number } | null = null;
  for (const X of theProvincesOf(G)) {
    if (!X || !botConsecrateOK(G, pi, c, X)) continue;
    const d = X.id === P.id ? 0 : botPathLen(G, pi, P, X.id, false);
    if (d == null || d > maxD) continue;
    const sc = (X.tax || 0) * 2 - d * 3;
    if (!best || sc > best.sc) best = { X, d, sc };
  }
  return best;
}
export function botSignaturePre(
  G: GameState,
  pi: number,
  c: Character,
  P: Province | null | undefined,
  L: ABotRealmsLedger,
) {
  const pl = theRealmsOf(G)[pi];
  if (!pl || !P) return null;
  const sk: Character['skills'] = asItsGuardReadsIt(c.skills) ?? {};
  const sig = L.sig ?? {}; // per-realm once-per-turn flags
  L.sig = sig;
  switch (pl.alignment) {
    case 'Divine': // CONSECRATE the ground the king stands on
      if (botConsecrateOK(G, pi, c, P))
        return { action: THE_ALIGNMENT_ORDERS.consecrate.key, target: '', extra: '', desc: 'Consecrate ' + P.name };
      return null;
    case 'Good': {
      // CALL TO ARMS: a free Green garrison, king only, once a turn
      if (!c.isKing || sig.cta) return null;
      let best: { readonly X: Province; readonly sc: number } | null = null;
      for (const X of theProvincesOf(G)) {
        if (X?.owner !== pi || X.terrain === 'sea') continue;
        if ((asItsGuardReadsIt(X.race) ?? '').startsWith('Primal')) continue; // the engine falls back to GARRISON_BY_RACE_CTA
        if ((X.tax || 0) < 4 && X.id !== botHomeId(G, pi)) continue; // Toby's garrison rule: Prosperous+ land (and the capital) only
        const g = (asItsGuardReadsIt(X.garrisonArmies) ?? []).length;
        if (g >= 2) continue;
        const sc = (X.tax || 0) + (botIsEdge(G, pi, X) ? 4 : 0) + (X.id === botHomeId(G, pi) ? 2 : 0) - g * 3;
        if (!best || sc > best.sc) best = { X, sc };
      }
      if (!best) return null;
      sig.cta = 1;
      return {
        action: THE_ALIGNMENT_ORDERS['call-to-arms'].key,
        target: String(best.X.id),
        extra: '',
        desc: 'Call to Arms in ' + best.X.name,
      };
    }
    // Druidic and Evil: no signature order since 2026-10-12 (Toby item 22: Awaken the Wild and Call from the Pit removed).
    case 'Undead': {
      // HARVEST THE FIELD: raise a grave for 2g (a necromancer keeps it)
      if (
        (Number(sk.necromancy) || 0) < 1 ||
        !botSees(G, pi, P.id) ||
        !(asItsGuardReadsIt(P.battleGraves) ?? []).length
      )
        return null;
      const thePrice = THE_ALIGNMENT_ORDERS['harvest-the-field'].theNumbers.thePrice.value;
      if (L.budget < thePrice) return null;
      L.budget -= thePrice;
      L.upkeep += 1;
      return {
        action: THE_ALIGNMENT_ORDERS['harvest-the-field'].key,
        target: '',
        extra: '',
        desc: 'Harvest the Field in ' + P.name,
      };
    }
    case 'Neutral': {
      // BROKER: hire a seen wanderer from afar, else buy a Spy report (2g)
      if (!c.isKing || sig.broker) return null;
      const hired = L.hired ?? new Set();
      L.hired = hired;
      const heroes = theCharactersOf(G).filter((x) => x?.alive && x.player === pi && !x.isKing && !x._isHeir).length;
      if (heroes < botHeroCap(G, pi)) {
        let best: { readonly h: Character; readonly w: number; readonly v: number } | null = null;
        for (const h of theCharactersOf(G)) {
          if (!(h?.alive && h.player === null && !h._isNeutralGuard && !h._justDefeated && !hired.has(h.id))) continue;
          if (h.location === c.location) continue; // a plain Hire does that
          const X = G.world.provinces[h.location];
          if (!X || !(X.owner === pi || (asItsGuardReadsIt(X.visitedBy) ?? []).includes(pi))) continue; // the engine's own Broker visibility
          const w = heroHireWage(pl.alignment, h.alignment, false, h);
          if (w == null || L.budget < w) continue;
          const itsSkills: Character['skills'] = asItsGuardReadsIt(h.skills) ?? {};
          const v =
            Object.values(itsSkills).reduce((a: number, b) => a + (Number(b) || 0), 0) - w + botHireBias(G, pi, h) * 3;
          if (!best || v > best.v) best = { h, w, v };
        }
        if (best) {
          botSpend(L, best.w);
          hired.add(best.h.id);
          sig.broker = 1;
          return {
            action: THE_ALIGNMENT_ORDERS.broker.key,
            target: `hire:${String(best.h.id)}`,
            extra: '',
            desc: 'Broker — hire ' + best.h.name,
          };
        }
      }
      const thePriceOfWord = THE_ALIGNMENT_ORDERS.broker.theNumbers.thePriceOfWordFromAProvince.value;
      if (L.budget >= thePriceOfWord) {
        const t = botSpyTarget(G, pi, c, 99);
        if (t && botKnows(G, pi, t.X.id)) {
          L.budget -= thePriceOfWord;
          sig.broker = 1;
          const memo = pl._botSpyMemo ?? {};
          pl._botSpyMemo = memo;
          memo[t.X.id] = G.turn;
          return {
            action: THE_ALIGNMENT_ORDERS.broker.key,
            target: `spy:${String(t.X.id)}`,
            extra: '',
            desc: 'Broker — buy word from ' + t.X.name,
          };
        }
      }
      return null;
    }
  }
  return null;
}
// PERFORM RITE (Pagan): only for an armed host standing at a ritual site with a fight ahead. The Wild
// Hunt binds two wage-free Veterans of the province's wild kind for the price of one; a host of 6+ that
// cannot hunt makes a Blood Offering — its two weakest for two tiers on its two strongest.
export function botRitePre(
  G: GameState,
  pi: number,
  c: Character,
  P: Province | null | undefined,
  L: ABotRealmsSpending,
  fightAhead: unknown,
) {
  const pl = theRealmsOf(G)[pi];
  if (pl?.alignment !== 'Pagan' || !P || !fightAhead) return null;
  if (P._riteTurn === G.turn) return null;
  const features: readonly (ProvinceFeature | null | undefined)[] = asItsGuardReadsIt(P.features) ?? [];
  const site = features.find((f) => f?.ritualSite && (featDiscovered(f, pi) || P.owner === pi));
  if (!site) return null;
  const units: readonly (AUnitWithItsTurnsMarks | null | undefined)[] = theUnitsWithGapsOf(c);
  const army = units.filter((a) => a && !a._temporary && a._wildHuntUntilTurn == null && !a._isSkeletal);
  const primal: Readonly<Partial<Record<string, unknown>>> = PRIMAL_ARMY_DEFS_P;
  const wild = (asItsGuardReadsIt(P.armyTypes) ?? []).find((t) => primal[t]);
  if (wild) {
    const cost = wildHuntPrice(wild);
    if (L.budget >= cost) {
      L.budget -= cost;
      return {
        action: THE_ALIGNMENT_ORDERS['perform-rite'].key,
        target: 'wild hunt',
        extra: '',
        desc: 'Perform Rite — the Wild Hunt',
      };
    }
  }
  if (army.length >= 6) {
    const idx = theUnitsWithGapsOf(c)
      .map((a, i) => ({ a, i }))
      .filter((x): x is { a: Army; i: number } => Boolean(x.a && army.includes(x.a)))
      .map((x) => ({ i: x.i, v: unitBaseStrength(x.a) }))
      .sort((x, y) => x.v - y.v);
    const S = idx.slice(0, 2).map((x) => x.i),
      E = idx.slice(-2).map((x) => x.i);
    if (S.some((i) => E.includes(i))) return null;
    return {
      action: THE_ALIGNMENT_ORDERS['perform-rite'].key,
      target: 'blood offering',
      extra: `S:${S.join(',')}|E:${E.join(',')}`,
      desc: 'Perform Rite — a Blood Offering',
    };
  }
  return null;
}
// RESEARCH CHOICE (R1): a bot keeps the discovery whose category / wording fits its situation — war-craft
// while at war, statecraft and wealth while expanding, espionage once other crowns are met. Public fields only.
export function botResearchPick(G: GameState, pi: number, options: Iterable<string>) {
  const war = botAtWar(G, pi),
    met = botHasMetPlayers(G, pi);
  const CAT: Readonly<Partial<Record<string, number>>> = {
    Military: war ? 4 : 2,
    Economy: war ? 2 : 4,
    Espionage: met ? 3 : 1,
    Scholarship: 2,
    Heroic: 3,
    Special: 3,
  }; // review II A9: the data file's six categories, explicitly
  const byId: Readonly<Partial<Record<string, ADiscoverysRow>>> = DISC_BY_ID;
  const score = (id: string) => {
    const d = byId[id];
    if (!d) return -99;
    const txt = ((d.category || '') + ' ' + (d.name || '') + ' ' + (d.desc || '')).toLowerCase();
    let v = (CAT[d.category] ?? 0) * 2;
    if (/war|battle|arm|siege|strength|fight|host|troop|unit|command/.test(txt)) v += war ? 4 : 2;
    if (/tax|gold|trade|wealth|state|treasur|income|harvest/.test(txt)) v += war ? 1 : 3;
    if (/spy|cipher|scout|explor|map|thief|steal/.test(txt)) v += met ? 2 : 0;
    if (/sage|research|lore|scholar/.test(txt)) v += 1;
    return v;
  };
  return [...options].sort((a, b) => score(b) - score(a))[0];
}
// ══ ITEMS (Sept 2026, review R3) ════
// Bots picked up hoards and never touched them. Three habits a human has: don the best kit (the engine's
// normaliseEquipment dons whatever came first), send combat kit from the court's scholars and scouts to
// the general who fights, and crack the Philosopher's Stone once the realm has an army worth promoting.
// One item pre-order per character per turn. Reads only the bot's own items.
export const BOT_FIGHT_STATS = new Set([
  'melee',
  'archery',
  'tactical',
  'armour',
  'mithrilArmour',
  'maxHp',
  'combatUse',
  'druid',
]);
export function botItemPre(G: GameState, pi: number, c: Character, roles: ABotRealmsRoles | null | undefined) {
  const carried: readonly (Item | null | undefined)[] = theItemsWithGapsOf(c);
  const items = carried.filter((it): it is Item => Boolean(it));
  if (!items.length) return null;
  // 1. Philosopher's Stone — every unit of the realm one tier up, once per game
  const stone = items.find((it) => thePowerAnItemWorksWhenUsed(it) === 'every unit of the realm rises a quality tier');
  if (stone) {
    let units = 0;
    theCharactersOf(G).forEach((x) => {
      if (x?.alive && x.player === pi) units += theUnitsWithGapsOf(x).length;
    });
    theProvincesOf(G).forEach((p) => {
      if (p?.owner === pi) units += (asItsGuardReadsIt(p.garrisonArmies) ?? []).length;
    });
    if (units >= 8)
      return {
        action: 'use_item',
        target: String(asItsGuardReadsIt(stone.id) ?? stone.name),
        extra: '',
        desc: 'Use ' + stone.name,
      };
  }
  // 2. Wear the best of what we carry, slot by slot
  const caps: Readonly<Partial<Record<string, number>>> = ITEM_SLOT_CAP;
  const slotted = items.filter((it) => itemSlot(it) && itemUsableBy(it, c));
  if (slotted.length) {
    const bySlot: Record<string, Item[]> = {};
    slotted.forEach((it) => {
      const k = String(itemSlot(it));
      const here = bySlot[k] ?? [];
      bySlot[k] = here;
      here.push(it);
    });
    const want: Item[] = [];
    Object.entries(bySlot).forEach(([sl, list]) => {
      list
        .sort((a, b) => itemPowerScore(b) - itemPowerScore(a))
        .slice(0, (caps[sl] ?? 0) || 1)
        .forEach((it) => want.push(it));
    });
    const wornNow = slotted.filter((it) => it.equipped === true);
    const differs = want.length !== wornNow.length || want.some((it) => !wornNow.includes(it));
    if (differs)
      return {
        action: 'equip_items',
        target: want.map((it) => String(asItsGuardReadsIt(it.id) ?? it.name)).join(','),
        extra: '',
        desc: 'Don the best kit',
      };
  }
  // 3. ITEMS GO TO THE ROLE THEY FIT (2026-09-26, Toby). Every character sends any item its own role does not
  // use to the realm character whose role does — duelling kit to the slayer, command kit to the general, a
  // Naval charm to the admiral, a Sage tome to the scholar, Spy / Thief / Explorer kit to those crafts — when
  // the recipient has slot room (or the item beats his worst in that slot). At most two a year, by courier.
  const myRole = botItemRoleOf(G, pi, c, roles);
  const statsOf: Readonly<Partial<Record<string, ReadonlySet<string>>>> = BOT_ROLE_ITEM_STATS;
  const primaryOf: Readonly<Partial<Record<string, ReadonlySet<string>>>> = BOT_ROLE_ITEM_PRIMARY;
  const myStats = statsOf[myRole] ?? BOT_ROLE_ITEM_STATS.none;
  const mates = theCharactersOf(G)
    .filter((x): x is Character =>
      Boolean(x?.alive && x.player === pi && x.id !== c.id && !x._isHeir && !isCharmedNow(G, x)),
    )
    .map((x) => ({ x, role: botItemRoleOf(G, pi, x, roles) }));
  const gives: Record<string, number[]> = {}; // recipient id → indices
  items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => itemPowerScore(b.it) - itemPowerScore(a.it))
    .forEach(({ it, i }) => {
      const e: Partial<Item['effect']> = asItsGuardReadsIt(it.effect) ?? {};
      const stat = e.stat;
      if (!stat || isMithril(it)) return;
      // 2026-09-28 (option 4): duelling kit (Melee, Archery, armour, HP, combat charms, spell schools) goes to a
      // SLAYER ahead of the general — the lair fights it wins are income; a general who holds it sends it on.
      const _toSlayer =
        myRole !== 'slayer' &&
        _BOT_DUEL_KIT.includes(stat) &&
        mates.some(({ x, role }) => role === 'slayer' && itemUsableBy(it, x));
      if (myStats.has(stat) && itemUsableBy(it, c) && !_toSlayer) return; // my own role uses it — keep it
      const sl = itemSlot(it);
      let best: { readonly x: Character; readonly sc: number } | null = null;
      for (const { x, role } of mates) {
        const st = statsOf[role] ?? BOT_ROLE_ITEM_STATS.none;
        if (!st.has(stat) || !itemUsableBy(it, x)) continue;
        let room = 1;
        if (sl) {
          const theirs = theItemsWithGapsOf(x)
            .filter((y): y is Item => Boolean(y && itemSlot(y) === sl && itemUsableBy(y, x)))
            .sort((p, q) => itemPowerScore(p) - itemPowerScore(q));
          const cap = (caps[sl] ?? 0) || 1;
          const worst = theirs[0];
          room = Math.max(0, cap - theirs.length) + (worst && itemPowerScore(worst) < itemPowerScore(it) ? 1 : 0);
        }
        if (room <= 0) continue;
        const sc =
          (primaryOf[role]?.has(stat) ? 10 : 0) + (role === 'slayer' && _BOT_DUEL_KIT.includes(stat) ? 5 : 0) + room;
        if (!best || sc > best.sc) best = { x, sc };
      }
      if (best) {
        const k = String(best.x.id);
        const here = gives[k] ?? [];
        gives[k] = here;
        here.push(i);
      }
    });
  const ranked = Object.entries(gives).sort(([, a], [, b]) => b.length - a.length)[0];
  if (!ranked) return null;
  const [rid, given] = ranked;
  const idx = given.sort((a, b) => a - b).slice(0, 2);
  const rc = theCharactersOf(G).find((x) => x?.id === +rid);
  return {
    action: 'give_item',
    target: idx.join(','),
    extra: rid,
    desc: 'Send kit to ' + (rc ? rc.name : 'a comrade'),
  };
}
// Which role a character's KIT should serve. Leaders are generals (the admiral and flying general keep their
// own names), armed kings and defenders fight, specialists are their craft.
export function botItemRoleOf(
  G: GameState,
  pi: number,
  c: Character,
  roles: ABotRealmsRoles | null | undefined,
): string {
  if (c._botRole === 'admiral' || c._botRole === 'skygeneral') return c._botRole;
  if (roles?.leaders.includes(c.id)) return 'general';
  if (c.isKing) return theUnitsWithGapsOf(c).length ? 'general' : 'slayer';
  if (c._botRole === 'defender') return 'defender';
  if (c._botRole !== undefined && BOT_SPECIALIST_ROLES.has(c._botRole)) return c._botRole;
  return theUnitsWithGapsOf(c).length ? 'general' : 'none';
}
export const _BOT_DUEL_KIT = [
  'melee',
  'archery',
  'maxHp',
  'armour',
  'mithrilArmour',
  'combatUse',
  'pc',
  'temper',
  'elemental',
  'white',
  'illusory',
  'necromancy',
  'psychic',
];
export const BOT_ROLE_ITEM_STATS = {
  general: new Set([
    ..._BOT_DUEL_KIT,
    'tactical',
    'march',
    'armyBonus',
    'aura',
    'undeadBonus',
    'siege',
    'homeDefence',
    'druid',
  ]),
  slayer: new Set(_BOT_DUEL_KIT),
  admiral: new Set([..._BOT_DUEL_KIT, 'naval', 'fleet', 'tactical']),
  skygeneral: new Set([..._BOT_DUEL_KIT, 'druid', 'tactical', 'march']),
  defender: new Set([..._BOT_DUEL_KIT, 'tactical', 'homeDefence', 'armyBonus']),
  mage: new Set([
    'white',
    'psychic',
    'illusory',
    'elemental',
    'necromancy',
    'castSpell',
    'maxHp',
    'armour',
    'combatUse',
  ]),
  scholar: new Set(['sage', 'castSpell', 'practice']),
  scout: new Set(['explorer', 'oracle']),
  spy: new Set(['spy', 'hidden', 'oracle']),
  thief: new Set(['thief', 'hidden']),
  none: new Set([]),
};
// the stats a role is the FIRST home for (breaks ties between several willing recipients)
export const BOT_ROLE_ITEM_PRIMARY = {
  general: new Set(['tactical', 'march', 'armyBonus', 'aura', 'undeadBonus', 'siege']),
  slayer: new Set(_BOT_DUEL_KIT),
  admiral: new Set(['naval', 'fleet']),
  skygeneral: new Set(['druid']),
  mage: new Set(['white', 'psychic', 'illusory', 'elemental', 'necromancy', 'castSpell']),
  scholar: new Set(['sage']),
  scout: new Set(['explorer']),
  spy: new Set(['spy', 'hidden']),
  thief: new Set(['thief']),
};
// ALLIED FRONT (review R7): a target within two hexes of an allied realm's field host is worth more — two
// crowns pressing one border beat two crowns pressing two. Only hosts the bot can see.
export function botAllyNear(G: GameState, pi: number, X: Province | null | undefined) {
  if (!X) return false;
  return theCharactersOf(G).some((e) => {
    if (!(
      e?.alive &&
      e.player != null &&
      e.player !== pi &&
      theUnitsWithGapsOf(e).length >= 3 &&
      botRelationRaw(G, pi, e.player) === 'allied' &&
      botSeesChar(G, pi, e)
    ))
      return false;
    if (e.location === X.id) return true;
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, X, i);
      if (N?.id === e.location) return true;
    }
    return false;
  });
}
// ══ ENEMY INTEL (Sept 2026, Toby: track enemy generals and heroes) ════
// What the realm SAW this turn of rival characters, remembered on the player record for six turns:
// p._botIntel.generals[charId] = {turn, provId, units, strength, name, player, isKing} for anyone leading
// troops, p._botIntel.heroes for the unarmed. Only characters botSeesChar can see are recorded, so the
// memory is exactly what a human's past reports hold. A remembered host that is no longer visible still
// counts against a target for three turns (it may still be there), and remembered heroes are hunted.
// botUpdateIntel, which records what the realm saw, and botEnemyIntel, which reads it back, are in bots/strategy.ts.
// Remembered at-war hosts last seen in province `provId` within three turns and not visible now: {units,strength};
// with `onlyOf`, only that realm's hosts.
export function botRememberedHostAt(G: GameState, pi: number, provId: number, onlyOf?: number | null) {
  const I = botEnemyIntel(G, pi);
  let units = 0,
    strength = 0;
  const turn = G.turn || 0;
  Object.entries(I.generals).forEach(([k, r]) => {
    if (r.provId !== provId || turn - r.turn > 3 || botRelationRaw(G, pi, r.player) !== 'enemy') return;
    if (onlyOf != null && r.player !== onlyOf) return;
    const e = theCharactersOf(G).find((x) => x?.id === +k);
    if (!e?.alive) return;
    if (botSeesChar(G, pi, e)) return; // visible hosts are counted by the scorer itself
    units += r.units;
    strength += r.strength;
  });
  return { units, strength };
}
// The margin demanded against an enemy HOST (Toby): 1.5× a five-unit column, rising 0.05 per unit to 2×.
export function botHostMargin(base: number, hostUnits: number) {
  if (!(hostUnits > 0)) return base;
  return Math.max(base, Math.min(2.0, 1.5 + 0.05 * Math.max(0, hostUnits - 5)));
}
// ══ LAIRS BY RUMOUR (Sept 2026, Toby: Hunting Rumours first, clear at 80%+, weakest first) ════
// A rumour is bought (1–4g by grade) by the hero who would fight, and the engine records the odds band it
// told him (f._rumourOdds[pi] — the same five bands the player reads). Only a band of "almost certain"
// (80%+) sends him in. A rumour by another hero, or older than three turns, or bought before the hero
// gained a level, is stale. Lairs are taken weakest grade first.
export const BOT_LAIR_GRADE = { '': 0, Weak: 0, Moderate: 1, Powerful: 2, Legendary: 3 };
// botRumourFor (a hero's rumour of a lair, while it holds) and botLairRating are in bots/strategy.ts.
// Candidate lairs for this hero: {X,li,f,grade,d,rumour}. `maxD` hops through own/allied/unowned ground.
export function botLairCandidates(G: GameState, pi: number, c: Character, maxD: number) {
  const from = G.world.provinces[c.location];
  if (!from) return [];
  const grades: Readonly<Partial<Record<string, number>>> = BOT_LAIR_GRADE;
  const costs: Readonly<Partial<Record<string, number>>> = RUMOUR_COST_BY_POWER;
  const out: ALairCandidate[] = [];
  theProvincesOf(G).forEach((X) => {
    if (!X || X.terrain === 'sea' || !botKnows(G, pi, X.id)) return;
    const bo = botBelievedOwner(G, pi, X);
    if (bo != null && bo !== pi && botRelationRaw(G, pi, bo) !== 'allied') return;
    const features: readonly (ProvinceFeature | null | undefined)[] = asItsGuardReadsIt(X.features) ?? [];
    features.forEach((f, li) => {
      if (!f || f.cleared || f.ritualSite || !featDiscovered(f, pi)) return;
      const d = X.id === from.id ? 0 : botPathLen(G, pi, from, X.id, true);
      if (d == null || d > maxD) return;
      const grade = (f.monster?.power ?? '') || (f.tier ?? '');
      out.push({
        X,
        li,
        f,
        grade: grades[grade] ?? 0,
        price: (costs[grade] ?? 0) || 1,
        d,
        rumour: f.monster ? botRumourFor(G, pi, c, f) : { band: 101 },
      });
    });
  });
  return out.sort((a, b) => a.grade - b.grade || a.d - b.d);
}
// The slayer's (or any fighter's) year: search a lair his rumour rates 80%+; else buy the rumour on the
// weakest lair he has not assessed; else null (train). Fighters only: Melee or Archery 3+.
// Sept 2026 (Toby): the guardian-killer's LADDER. The guardian ladder is tuned to a benchmark hero per grade
// (Weak: 15 HP, Melee 3 / Archery 2 or Melee 4 / Archery 1 + a school at 1; Moderate: 30 HP, 5 tier-1 items,
// Melee 6 + a school at 3 …), so the slayer trains toward Melee 3 / Archery 2 first, then Melee 4+, a battle
// school, and on. He clears a lair only on his own fresh top-band rumour (80%+), takes the lowest grade on the
// map first, and does not buy a rumour on a grade above one his current rating has already been told is too
// hard — he trains until the rating changes (a level, an item) and asks again.
// 2026-09-26 (Toby): the slayer's ladder now carries a BATTLE SCHOOL from the start — Melee 3, Archery 2, a
// school at 1, Melee 4, school 2, Melee 5, school 3, Melee 6, then Archery. The school is Elemental unless
// another duelling school (Necromancy, Psychic, White) is already the hero's strongest: the auto encounter
// plan casts that school's spell in every lair fight (autoEncounterPlan → CA:), so every level is used.
export function botSlayerSchool(c: { readonly skills?: Character['skills'] | null | undefined } | null | undefined) {
  const s: Readonly<Partial<Record<string, number>>> = { ...c?.skills };
  const schools: [string, ...string[]] = ['elemental', 'necromancy', 'psychic', 'white'];
  return schools.sort(
    (a, b) => (Number(s[b]) || 0) - (Number(s[a]) || 0) || (a === 'elemental' ? -1 : b === 'elemental' ? 1 : 0),
  )[0];
}
export function botSlayerTrainSkill(c: Character) {
  const s: Readonly<Partial<Record<string, number>>> = { ...asItsGuardReadsIt(c.skills) };
  const sch = botSlayerSchool(c);
  // 2026-09-28 (Toby): never a skill already at 5 — Practice cannot take it further (levels 6–9 come only from
  // experience). The ladder: Melee 3, Archery 2, school 1, Melee 4, school 2, Melee 5, school 3→5, Archery 5,
  // then his other combat schools; null when all are at 5.
  const L: readonly (readonly [skill: string, to: number])[] = [
    ['melee', 3],
    ['archery', 2],
    [sch, 1],
    ['melee', 4],
    [sch, 2],
    ['melee', 5],
    [sch, 3],
    [sch, 5],
    ['archery', 5],
    ['elemental', 5],
    ['necromancy', 5],
    ['psychic', 5],
    ['white', 5],
  ];
  for (const [k, to] of L) {
    if ((Number(s[k]) || 0) < Math.min(5, to)) return k;
  }
  return null;
}
// 2026-09-28 (Toby: slayers clear too few lairs): a rumour costs 1–4g and is paid from the TREASURY when the
// Hunt Rumours phase resolves. The planner used to demand it from the muster budget, which the leaders (who plan
// first) had usually spent to nothing — a slayer with lairs in reach then trained instead of asking, one slayer
// year in five. Now the rumour goes ahead whenever the treasury itself can pay it with a little to spare.
// BOT_RUMOUR_FUND_PER_SLAYER (each slayer's share of the rumour fund) is in bots/strategy.ts.
export function botRumourAffordable(G: GameState, pi: number, L: ABotRealmsLedger, price: number) {
  return (
    (Number(L.rumourFund) || 0) >= price ||
    L.budget >= price + 1 ||
    (Number(theRealmsOf(G)[pi]?.gold) || 0) >= price + 3
  );
}
export function botSpendRumour(L: ABotRealmsLedger, price: number) {
  const f = Math.min(Number(L.rumourFund) || 0, price);
  L.rumourFund = (Number(L.rumourFund) || 0) - f;
  L.budget -= price - f;
}
// ══ THE SLAYER'S LADDER (2026-09-28, Toby) ════
// • He searches a lair on a rumour of 80%+ (bands "the odds favour you… confident / certain": band.max ≥ 90).
// • Two lairs cleared of a grade and that grade is his: he searches its lairs with no rumour at all (and any
//   grade below), until six are cleared.
// • At six he hunts a rumour of the grade above. 80%+ → he goes; below → he clears two more of his own grade
//   before asking again (c._botLadder.retryAt). One clear of the grade above keeps him asking about it until
//   the second makes it his.
// • He rests before a hunt when hurt (to 75% of max HP — Rest heals 30% a phase), and searches every lair he
//   can reach in the year, up to three; every search after the first carries `_botMinHp` (0.6): the engine
//   turns it into a Rest if the earlier fight left him under 60%.
export const BOT_LAIR_WEAK_BAND = 80,
  BOT_LAIR_WEAK_HP = 0.95,
  BOT_LAIR_REACH = 6,
  BOT_LAIR_MAX_RUMOURS = 3; // 2026-09-28 (options 3, 5)
// 2026-09-29 (Toby): PROMOTE_AT 6 → 4 → 2 (study C4; RETRY_EXTRA 2 → 0: no hold after a poor reading) — the rumour (80%+) still decides whether he goes in, so asking sooner
// costs a few gold, not a life.
// The tuning knobs BOT_LAIR_GO_BAND_HI and BOT_LAIR_REASK_GAIN are in bots/strategy.ts.
export function botGoBand(g: number) {
  return g > 0 ? BOT_LAIR_GO_BAND_HI : BOT_LAIR_GO_BAND;
}
export const BOT_LAIR_GO_BAND = 90,
  BOT_LAIR_OWN_AFTER = 2,
  BOT_LAIR_PROMOTE_AT = 2,
  BOT_LAIR_RETRY_EXTRA = 0,
  BOT_LAIR_MIN_HP = 0.75,
  BOT_LAIR_NEXT_HP = 0.6,
  BOT_LAIR_MAX_SEARCHES = 3;
export const BOT_LAIR_GN = ['Weak', 'Moderate', 'Powerful', 'Legendary'];
// 2026-09-29 (Toby): PROMOTION ON STRENGTH as well as kills. A hero who owns his grade and is already
// kitted or trained for the grade above asks about it without waiting for the kill count: equipped items
// at least BOT_LAIR_STRONG_ITEMS[g], OR his best fighting skill (Melee, Archery or a duelling school,
// items included) at least BOT_LAIR_STRONG_SKILL[g]. Indexed by the grade he would move UP to. Moderate
// 4 items / skill 5, Powerful 6 / 7, Legendary 8 / 9 — the guardian-ladder benchmark heroes carry 5
// tier-1 items for Moderate.
export const BOT_LAIR_STRONG_ITEMS = [0, 3, 5, 7],
  BOT_LAIR_STRONG_SKILL = [0, 4, 6, 8]; // 2026-09-29 (Toby, study C4): was [0,4,6,8] / [0,5,7,9]
export function botLairStrongFor(c: Character | null | undefined, g: number) {
  if (!c || g < 1 || g > 3) return false;
  const n = activeItems(c).length;
  const best = Math.max(
    ...['melee', 'archery', 'elemental', 'necromancy', 'psychic', 'white'].map(
      (k) => Number(effSkillOf(c, k, [])) || 0,
    ),
  );
  return n >= Number(BOT_LAIR_STRONG_ITEMS[g]) || best >= Number(BOT_LAIR_STRONG_SKILL[g]);
}
export function botLairTiers(c: Character) {
  const K: Readonly<Partial<Record<string, number>>> = asItsGuardReadsIt(c._botLairKills) ?? {};
  const k = (g: number) => Number(K[String(BOT_LAIR_GN[g])]) || 0;
  const lad: NonNullable<Character['_botLadder']> = asItsGuardReadsIt(c._botLadder) ?? {};
  let cur = -1;
  for (let g = 0; g < 4; g++) if (k(g) >= BOT_LAIR_OWN_AFTER) cur = g;
  let up: number | null = null;
  if (cur < 0) up = 0;
  else if (
    cur < 3 &&
    (k(cur) >= BOT_LAIR_PROMOTE_AT || k(cur + 1) >= 1 || botLairStrongFor(c, cur + 1)) &&
    k(cur) >= (Number(lad.retryAt) || 0)
  )
    up = cur + 1;
  return { cur, up, k };
}
export function botLairPlan(
  G: GameState,
  pi: number,
  c: Character,
  pre: readonly AnOrderAsThePassesReadIt[],
  L: ABotRealmsLedger | null | undefined,
) {
  const sk: Character['skills'] = asItsGuardReadsIt(c.skills) ?? {};
  const melee = Number(sk.melee) || 0,
    archery = Number(sk.archery) || 0;
  const _cs = Math.max(Number(sk.elemental) || 0, Number(sk.necromancy) || 0, Number(sk.psychic) || 0);
  if (melee < 3 && archery < 3 && melee + archery < 5 && !(melee >= 2 && melee + archery + _cs >= 6)) return null; // a combat school counts toward the gate (the rumour still decides)
  const P = G.world.provinces[c.location];
  if (!P) return null;
  const cands = botLairCandidates(G, pi, c, BOT_LAIR_REACH).filter((x) => x.f.monster);
  if (!cands.length) return null; // option 5: six hops
  const rating = botLairRating(c);
  const lad = c._botLadder ?? {};
  c._botLadder = lad;
  const told = (f: ProvinceFeature) => {
    const r = f._rumourOdds?.[pi];
    return r?.charId === c.id &&
      (G.turn || 0) - r.turn <= 6 &&
      !(asItsGuardReadsIt(r.rating) != null && rating < r.rating) &&
      !(BOT_LAIR_REASK_GAIN > 0 && asItsGuardReadsIt(r.rating) != null && rating >= r.rating + BOT_LAIR_REASK_GAIN)
      ? r
      : null;
  }; // an assessment still good for him
  let T = botLairTiers(c);
  // a fresh "below 80%" on the grade above: clear two more of his own grade before he asks again
  if (
    T.up != null &&
    T.cur >= 0 &&
    T.up > T.cur &&
    cands.some(
      (x) =>
        x.grade === T.up &&
        (() => {
          const r = told(x.f);
          return r && r.band < botGoBand(x.grade) && (G.turn || 0) - r.turn <= 1;
        })(),
    ) &&
    !((Number(lad.retryAt) || 0) > T.k(T.cur))
  ) {
    lad.retryAt = T.k(T.cur) + BOT_LAIR_RETRY_EXTRA;
    T = botLairTiers(c);
  }
  const mhp0 = c.maxHp || 20,
    hp0 = asItsGuardReadsIt(c.hp) ?? mhp0;
  // option 3: a WEAK lair on a 60–80% rumour ("the odds favour you") when he stands at full health (95%+)
  const weakRisk = (x: ALairCandidate) =>
    x.grade === 0 && x.rumour !== null && x.rumour.band >= BOT_LAIR_WEAK_BAND && x.rumour.band < BOT_LAIR_GO_BAND;
  const searchable = (x: ALairCandidate) =>
    (T.cur >= 0 && x.grade <= T.cur) ||
    (x.rumour !== null && x.rumour.band >= botGoBand(x.grade)) ||
    (weakRisk(x) && hp0 >= mhp0 * BOT_LAIR_WEAK_HP);
  const askable = (x: ALairCandidate) =>
    T.up != null && x.grade === T.up && !x.rumour && !told(x.f) && L && botRumourAffordable(G, pi, L, x.price);
  if (!cands.some(searchable) && !cands.some(askable)) return null;
  // rest first when hurt: to 75% of max HP, 30% a phase
  const mhp = c.maxHp || 20,
    hp = asItsGuardReadsIt(c.hp) ?? mhp;
  const per = Math.max(1, Math.ceil(mhp * 0.3));
  const restN = hp < mhp * BOT_LAIR_MIN_HP ? Math.ceil((mhp * BOT_LAIR_MIN_HP - hp) / per) : 0;
  const mv: ALairOrder[] = [];
  for (let i = 0; i < restN && pre.length + mv.length < 5; i++)
    mv.push({ action: 'rest', target: '', extra: '', desc: 'Rest before the hunt' });
  const left = () => 5 - pre.length - mv.length;
  let pos = P,
    searches = 0,
    asked = 0;
  const used = new Set<string>(),
    askedProv = new Set<number>();
  // 2026-09-29 (Toby: bots never climb past Weak lairs): once his ladder says the grade above is due
  // (T.up > T.cur), the year's FIRST move is to hear the talk of that grade, before farming his own. The loop
  // below only reached the rumour branch when no searchable own-grade lair was left in reach, so a slayer with
  // Weak lairs about him cleared Weak lairs forever and never asked about a Moderate one (40 bot games, 30
  // turns: 50 heroes past six Weak kills, 17 Moderate rumours heard in all).
  const preferAsk = T.cur >= 0 && T.up != null && T.up > T.cur;
  while (left() > 0) {
    const aopts =
      asked < BOT_LAIR_MAX_RUMOURS
        ? cands
            .filter((x) => !askedProv.has(x.X.id) && askable(x))
            .map((x) => ({ x, d: x.X.id === pos.id ? 0 : botPathLen(G, pi, pos, x.X.id, true) }))
            .filter((o): o is ALairInReach => o.d != null && o.d + 1 <= left())
            .sort((a, b) => a.d - b.d)
        : [];
    const opts =
      preferAsk && asked === 0 && aopts.length
        ? []
        : searches < BOT_LAIR_MAX_SEARCHES
          ? cands
              .filter((x) => !used.has(theLairsKey(x)) && searchable(x))
              .map((x) => ({ x, d: x.X.id === pos.id ? 0 : botPathLen(G, pi, pos, x.X.id, true) }))
              .filter((o): o is ALairInReach => o.d != null && o.d + 1 <= left())
              .sort((a, b) => a.d - b.d || b.x.grade - a.x.grade)
          : [];
    const o = opts[0];
    if (o !== undefined) {
      const path = o.d > 0 ? (botPathDirs(G, pi, pos, o.x.X.id, left() - 1, true) ?? []) : [];
      if (o.d > 0 && path.length !== o.d) {
        used.add(theLairsKey(o.x));
        continue;
      }
      path.forEach((d) => mv.push(aMoveOrderOnThePath(d, 'Seek the lair in ' + o.x.X.name)));
      if (searches === 0 && (Number(sk.illusory) || 0) >= 1 && left() >= 2)
        mv.push({
          action: 'cast_spell',
          target: theNameOfTheSpell('invisibility'),
          extra: '',
          desc: 'Cast Invisibility (before the lair)',
        });
      const own = T.cur >= 0 && o.x.grade <= T.cur;
      const so: ALairOrder = {
        action: 'search',
        target: String(o.x.li),
        extra: '',
        desc: 'Search Lair' + (own ? ' (his own grade)' : ''),
        prov: o.x.X.id,
      };
      if (searches > 0) so._botMinHp = BOT_LAIR_NEXT_HP;
      if (!own && weakRisk(o.x)) so._botMinHp = BOT_LAIR_WEAK_HP; // a 60–80% Weak lair only at full health
      mv.push(so);
      used.add(theLairsKey(o.x));
      pos = o.x.X;
      searches++;
      continue;
    }
    const a = aopts[0];
    if (a !== undefined) {
      const path = a.d > 0 ? (botPathDirs(G, pi, pos, a.x.X.id, left() - 1, true) ?? []) : [];
      if (a.d > 0 && path.length !== a.d) {
        askedProv.add(a.x.X.id);
        continue;
      }
      botSpendRumour(theLedgerARumourIsPaidFrom(L), a.x.price);
      path.forEach((d) => mv.push(aMoveOrderOnThePath(d, 'Hear the talk of ' + a.x.X.name)));
      mv.push({ action: 'hunt_rumours', target: String(a.x.li), extra: '', desc: 'Hunt Rumours — ' + a.x.f.name });
      askedProv.add(a.x.X.id);
      pos = a.x.X;
      asked++;
      // option 2: SEARCH IN THE SAME YEAR if the talk is good — a conditional order the engine checks against the
      // rumour this hero heard this turn (80%+, or 60%+ on a Weak lair at full health); otherwise he rests.
      if (left() > 0 && searches < BOT_LAIR_MAX_SEARCHES) {
        const so: ALairOrder = {
          action: 'search',
          target: String(a.x.li),
          extra: '',
          desc: 'Search Lair (if the talk is good)',
          prov: a.x.X.id,
          _botIfRumour: botGoBand(a.x.grade),
          _botMinHp: searches > 0 ? BOT_LAIR_NEXT_HP : 0.5,
        };
        if (a.x.grade === 0) {
          so._botIfRumourLow = BOT_LAIR_WEAK_BAND;
          so._botIfRumourLowHp = BOT_LAIR_WEAK_HP;
        }
        mv.push(so);
        used.add(theLairsKey(a.x));
        searches++;
      }
      continue;
    }
    break;
  }
  if (!searches && !asked) return null;
  return botFillOrders(G, pi, c, pre, mv);
}
// Are there known, uncleared lairs within a slayer's reach that he cannot yet clear? Then training is what
// makes them clearable — he trains; with NO lair known in reach he explores to find one (2026-09-26, Toby).
export function botSlayerHasLairsToGrowInto(G: GameState, pi: number, c: Character) {
  return botLairCandidates(G, pi, c, 4).some((k) => k.f.monster);
}
// ══ NAVAL DOCTRINE (Sept 2026, Toby) ════
// An ADMIRAL is a leader whose job is the sea: he raises carrier fleets at a coastal port, fills the hulls
// with the most effective liftable land units the port can raise, claims unowned sea provinces, and lands on
// enemy coasts — the scorer's −40 on sea targets does not apply to him. A realm wants one admiral once it
// holds two coastal provinces that can build ships and there is sea worth taking (unowned sea in reach, or
// an at-war coast across the water). Fleets are still bought for ordinary hosts only for the old reasons.
// botCoastalPorts and botSeaWorthTaking (does the realm want an admiral?) are in bots/strategy.ts.
// ── FLYING GENERAL (2026-09-26, Toby item 8) ── the owned provinces that raise a humanoid flyer (the
// only units that both fly AND carry a foot soldier), and the reach of an airborne column: the slowest
// self-flying unit sets the pace, March never speeds flight (mirrors computeMovePoolMax's FLYING CARRY).
// botFlyerType and botFlyerPorts are in bots/strategy.ts; botAirReach, the column's reach, is below.
export function botAirReach(c: Character) {
  const speeds: Readonly<Partial<Record<string, number>>> = ARMY_SPEED_MASTER;
  const sp = theUnitsWithGapsOf(c)
    .filter((a): a is Army => Boolean(a && BOT_AERIAL_TYPES.has(a.type)))
    .map((a) => (speeds[a.type] ?? 0) || 3);
  return sp.length ? Math.max(0, Math.min(5, Math.min(...sp))) : 0;
}
// Nearest of `list` (owned land provinces) by path length; {X,d} or null. Unarmed walks through any land.
export function botNearestOf(
  G: GameState,
  pi: number,
  c: Character,
  list: readonly Province[] | null | undefined,
  unarmed: unknown,
) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  let best: { readonly X: Province; readonly d: number } | null = null;
  for (const X of list ?? []) {
    const d = X.id === P.id ? 0 : botPathLen(G, pi, P, X.id, !!unarmed);
    if (d == null) continue;
    if (!best || d < best.d || (d === best.d && (X.tax || 0) > (best.X.tax || 0))) best = { X, d };
  }
  return best;
}
// The berths an admiral still has free: hulls minus the liftable land units he already carries.
export function botSpareBerths(c: Character | null | undefined) {
  const a: readonly (Army | null | undefined)[] = asItsGuardReadsIt(c?.armies) ?? [];
  const berths: Readonly<Partial<Record<string, number>>> = KC_CARRIER_BERTHS;
  return (
    a.reduce((s, x) => s + (x && BOT_CARRIER_TYPES.has(x.type) ? (berths[x.type] ?? 0) || 1 : 0), 0) -
    a.filter((x) => x && botLiftable(x.type) && !BOT_SEA_ALL.has(x.type)).length
  );
} // berths: a turtle's Island Back offers two
// botLiftable (a land unit a fleet can carry) is in bots/strategy.ts.
// BFS over sea hexes from `P` (a coast or a sea hex): the best landing — an enemy or unowned land province
// beside the water that this column can beat — or an unowned sea hex to claim. Returns {moves,N} or null.
// 2026-09-26 (Toby item 6): SEA TARGETS ARE NOW STRENGTH-GATED — before this an admiral would sail into a
// Kraken sea on its tax alone. Order of preference among winnable seas: OPEN water first (no defenders,
// +40), the poor WHALE and SHARK waters next (+15), then the prosperous primal seas. Coastal land: poor before rich
// falls out of the same gate — a weak fleet can only take a poorly-held coast, a strong one prefers the
// wealth. Item 7: an admiral with spare berths also sails to an owned coast where a GENERAL stands with
// liftable troops (a rendezvous: the general hands his foot soldiers over next turn).
export function botSeaStrike(
  G: GameState,
  pi: number,
  c: Character,
  P: Province,
  myStr: number,
  T: TheWeightsAStrikeReads,
  maxHops: number,
) {
  if (maxHops <= 0 || botSeaCap(c.armies) === 'land') return null;
  const margin = botMarginFor(G, pi, c, T);
  const plainStr = botBattleForce(G, c, null, 'plain', undefined);
  const k = plainStr > 0 ? myStr / plainStr : 1;
  const strIn = (t: string) => botBattleForce(G, c, null, t, undefined) * k;
  const adm = c._botRole === 'admiral';
  const spare = adm ? botSpareBerths(c) : 0;
  const prev: Partial<Record<number, number | null>> = {};
  prev[P.id] = null;
  const dirOf: Partial<Record<number, number>> = {};
  let q = [P],
    depth = 0;
  const top: { best: ASeaTarget | null } = { best: null };
  const consider = (N: Province | null | undefined, d: number) => {
    if (!N || N.id === P.id) return;
    let sc: number | null = null,
      fight = false,
      rv = false;
    if (N.terrain === 'sea') {
      if (N.owner == null && botKnows(G, pi, N.id)) {
        const tStr = botTargetDefence(G, pi, N);
        if (tStr > 0 && strIn('sea') < tStr * margin) return;
        const kind =
          N.race === 'Primal:Whale' || N.race === 'Primal:Shark'
            ? 'whale'
            : N.race?.startsWith('Primal:')
              ? 'primal'
              : 'open'; // poor waters (whale or shark) score alike
        sc = (N.tax || 1) * T.taxScoreWeight - tStr - d * 2 + (kind === 'open' ? 40 : kind === 'whale' ? 15 : 0);
        fight = tStr > 0;
      }
    } else {
      const bo = N.owner;
      // rendezvous: an owned coast where a general with liftable foot soldiers stands, when the hulls have room
      if (bo === pi) {
        if (spare >= 1) {
          const gen = theCharactersOf(G).find(
            (l) =>
              l?.alive &&
              l.player === pi &&
              l.id !== c.id &&
              l.location === N.id &&
              l._botRole !== 'admiral' &&
              botIsLeader(G, pi, l.id) &&
              theUnitsWithGapsOf(l).some((a) => a && botLiftable(a.type) && !BOT_SEA_ALL.has(a.type)),
          );
          if (gen) {
            const lift = theUnitsWithGapsOf(gen).filter(
              (a) => a && botLiftable(a.type) && !BOT_SEA_ALL.has(a.type),
            ).length;
            sc = 20 + Math.min(spare, lift) * 4 - d * 3;
            rv = true;
          }
        }
        if (sc == null) return;
      } else {
        if (botFleetOnly(c.armies)) return; // 2026-09-28: bare hulls cannot land — they claim and clear water
        if (bo != null && botRelationRaw(G, pi, bo) !== 'enemy') return;
        if (!botKnows(G, pi, N.id)) return;
        const ec = botEnemyChars(G, N, pi);
        let tStr = botTargetDefence(G, pi, N) + (bo == null ? ec.force * BOT_DEF_BONUS : 0);
        const rem = bo != null ? botRememberedHostAt(G, pi, N.id) : { units: 0, strength: 0 };
        tStr += rem.strength * BOT_DEF_BONUS;
        const eff = botHostMargin(ec.hasKing ? margin * 0.9 : margin, ec.units + rem.units);
        if (tStr > 0 && strIn(N.terrain) < tStr * eff * 1.1) return; // an amphibious assault asks a little more
        fight = tStr > 0;
        sc =
          (N.tax || 0) * T.taxScoreWeight * 1.5 -
          tStr +
          (bo != null ? T.rivalBias * 2 : 0) +
          ec.value +
          ec.units * 3 -
          d * 3;
      }
    }
    if (sc != null && (!top.best || sc > top.best.sc)) top.best = { N, sc, d, fight, rv };
  };
  while (q.length && depth < maxHops) {
    const next: Province[] = [];
    depth++;
    q.forEach((cur) => {
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, cur, i);
        if (!N || prev[N.id] !== undefined) continue;
        if (N.terrain === 'sea') {
          prev[N.id] = cur.id;
          dirOf[N.id] = i;
          consider(N, depth);
          // sail ON through waters that will not stop the fleet: ours, an ally's, or unowned and undefended (a guarded sea may be the target, never the road)
          if (
            N.owner === pi ||
            (N.owner != null && botRelationRaw(G, pi, N.owner) === 'allied') ||
            (N.owner == null && !(asItsGuardReadsIt(N.neutralDefenders) ?? []).length)
          )
            next.push(N);
        } else {
          prev[N.id] = cur.id;
          dirOf[N.id] = i;
          consider(N, depth);
        }
      }
    });
    q = next;
  }
  const best = top.best;
  if (!best) return null;
  const dirs = theWaysBackFrom(prev, dirOf, best.N.id);
  const moves = dirs.map((d, i) =>
    aMoveOrderOnThePath(
      d,
      i === dirs.length - 1
        ? best.rv
          ? 'Rendezvous with the general'
          : best.fight
            ? best.N.terrain === 'sea'
              ? 'Clear the waters'
              : 'Assault from the sea'
            : best.N.terrain === 'sea'
              ? 'Claim the sea'
              : 'Land'
        : 'Sail',
    ),
  );
  return { moves, N: best.N };
}
// ── AIR STRIKE (2026-09-26, Toby item 8) ── the FLYING GENERAL's planner. An airborne column (humanoid
// flyers carrying every foot soldier) crosses sea and land alike, so the BFS passes over open sea, its
// own and allied land and unowned land it could simply take, and looks for the best winnable target within
// its reach: an enemy province BEHIND THE FRONT (one that touches none of our land, +25 — a lightning
// strike on the rear), any other enemy province, or unowned land / sea to claim. Returns {moves,N} or null.
export function botAirStrike(
  G: GameState,
  pi: number,
  c: Character,
  P: Province,
  myStr: number,
  T: TheWeightsAStrikeReads,
  maxHops: number,
) {
  if (maxHops <= 0 || !botCanFly(c.armies)) return null;
  const margin = botMarginFor(G, pi, c, T);
  const plainStr = botBattleForce(G, c, null, 'plain', undefined);
  const k = plainStr > 0 ? myStr / plainStr : 1;
  const strIn = (t: string) => botBattleForce(G, c, null, t, undefined) * k;
  const touchesOurs = (N: Province) => {
    for (let j = 0; j < 6; j++) {
      const K = botNeighbourProv(G, N, j);
      if (K?.owner === pi) return true;
    }
    return false;
  };
  const prev: Partial<Record<number, number | null>> = {};
  prev[P.id] = null;
  const dirOf: Partial<Record<number, number>> = {};
  let q = [P],
    depth = 0;
  const top: { best: AnAirTarget | null } = { best: null };
  const winnable = (N: Province) => {
    const bo = N.owner;
    if (bo === pi || (bo != null && botRelationRaw(G, pi, bo) !== 'enemy')) return null;
    if (!botKnows(G, pi, N.id)) return null;
    const ec = botEnemyChars(G, N, pi);
    let tStr = botTargetDefence(G, pi, N) + (bo == null ? ec.force * BOT_DEF_BONUS : 0);
    const rem = bo != null ? botRememberedHostAt(G, pi, N.id) : { units: 0, strength: 0 };
    tStr += rem.strength * BOT_DEF_BONUS;
    const eff = botHostMargin(ec.hasKing ? margin * 0.9 : margin, ec.units + rem.units);
    if (tStr > 0 && strIn(N.terrain) < tStr * eff) return null;
    return { tStr, ec, bo };
  };
  const consider = (N: Province | null | undefined, d: number) => {
    if (!N || N.id === P.id) return;
    const w = winnable(N);
    if (!w) return;
    const enemy = w.bo != null;
    const rear = enemy && !touchesOurs(N);
    const sc =
      (N.tax || 0) * T.taxScoreWeight * (N.terrain === 'sea' ? 0.5 : 1.2) -
      w.tStr +
      (enemy ? T.rivalBias * 2 : 0) +
      (rear ? 25 : 0) +
      w.ec.value +
      w.ec.units * 3 -
      d * 2;
    if (!top.best || sc > top.best.sc) top.best = { N, sc, d, fight: w.tStr > 0 };
  };
  const passable = (N: Province) =>
    N.terrain === 'sea'
      ? N.owner == null
        ? !(asItsGuardReadsIt(N.neutralDefenders) ?? []).length
        : N.owner === pi || botRelationRaw(G, pi, N.owner) === 'allied'
      : N.owner === pi || (N.owner != null && botRelationRaw(G, pi, N.owner) === 'allied');
  while (q.length && depth < maxHops) {
    const next: Province[] = [];
    depth++;
    q.forEach((cur) => {
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, cur, i);
        if (!N || prev[N.id] !== undefined) continue;
        prev[N.id] = cur.id;
        dirOf[N.id] = i;
        consider(N, depth);
        if (passable(N)) next.push(N);
      }
    });
    q = next;
  }
  const best = top.best;
  if (!best) return null;
  const dirs = theWaysBackFrom(prev, dirOf, best.N.id);
  const moves = dirs.map((d, i) =>
    aMoveOrderOnThePath(
      d,
      i === dirs.length - 1
        ? best.fight
          ? 'Lightning strike'
          : best.N.terrain === 'sea'
            ? 'Claim the sea'
            : 'Seize'
        : 'Fly',
    ),
  );
  return { moves, N: best.N };
}
// HONEST KNOWLEDGE OF RIVAL CHARACTERS: the rule, BOT_ASSUMED_SKILLS, botKnownSkills and botSkillsFor are in bots/intel.ts;
// botAssumedChar and botSkillsUnknown, which read them, in bots/strategy.ts.
// ══ MASTERY ORDERS (review II A7) ════
export function botMasteryPre(
  G: GameState,
  pi: number,
  c: Character,
  P: Province,
  ctx: TheMasterysChoices | null | undefined,
) {
  const sk: Character['skills'] = asItsGuardReadsIt(c.skills) ?? {};
  const choices: TheMasterysChoices = ctx ?? {};
  if (choices.fightAhead) {
    if ((Number(sk.tactical) || 0) >= 9)
      return { action: 'grand_stratagem', target: '', extra: '', desc: 'Grand Stratagem' };
    if ((Number(sk.march) || 0) >= 9)
      return { action: 'lightning_advance', target: '', extra: '', desc: 'Lightning Advance' };
    if (
      choices.fromSea &&
      (Number(sk.naval) || 0) >= 9 &&
      theUnitsWithGapsOf(c).some((a) => a && BOT_SEA_ALL.has(a.type))
    )
      return { action: 'raid_coast', target: '', extra: '', desc: 'Raid the Coast' };
  }
  if (choices.holding && (Number(sk.tactical) || 0) >= 7 && choices.threat)
    return { action: 'feigned_retreat', target: '', extra: '', desc: 'Feigned Retreat' };
  if (
    c._botRole === 'admiral' &&
    (Number(sk.naval) || 0) >= 7 &&
    botAtWar(G, pi) &&
    theUnitsWithGapsOf(c).some((a) => a && BOT_SEA_ALL.has(a.type))
  ) {
    // review II A8: seal a rival's waters
    const cand = [P];
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, P, i);
      if (N) cand.push(N);
    }
    const sea = cand
      .filter(
        (N) =>
          N.terrain === 'sea' &&
          N.owner != null &&
          N.owner !== pi &&
          botRelationRaw(G, pi, N.owner) === 'enemy' &&
          N._blockadeTurn !== G.turn,
      )
      .sort((a, b) => (b.tax || 0) - (a.tax || 0))[0];
    if (sea) return { action: 'blockade', target: String(sea.id), extra: '', desc: 'Blockade ' + sea.name };
  }
  if (choices.duelSim && (Number(sk.melee) || 0) >= 7 && botAtWar(G, pi)) {
    const foe = botVisibleCharsIn(G, pi, P)
      .filter(
        (e) =>
          e.alive &&
          e.player != null &&
          e.player !== pi &&
          !theUnitsWithGapsOf(e).length &&
          botRelationRaw(G, pi, e.player) === 'enemy' &&
          e._invisTurn !== G.turn &&
          (!e.isKing || c.isKing),
      )
      .sort((a, b) => (b.isKing ? 1 : 0) - (a.isKing ? 1 : 0))[0];
    if (foe) {
      const f = choices.duelSim(c, botAssumedChar(G, pi, foe), 24);
      if (f && f.win >= 0.7 && f.felled <= 0.1)
        return { action: 'challenge', target: String(foe.id), extra: '', desc: 'Challenge ' + foe.name };
    }
  }
  return null;
}
// ══ DUELS (Sept 2026, Toby): a general's duel stance is a judgement, not a temper ════
// The engine let a bot commander's Temper pick the stance — a Brave lord with Melee 0 rode out to die.
// Now every bot character carries a stance set here each turn, from the duel forecast (the engine's own personal
// combat on copies) against every enemy general seen within two hexes, on the skills our spies know. A challenger rides
// out only when he expects to win, so a challenge answered unforecast is a gamble (bot improvements, 2026-11):
//   REFUSE — no duelling skill at 2+, or under 60% health, or a forecast that falls short of the terms below (the 20%
//     morale cost is cheaper than a dead general).
//   ACCEPT — a hero at 50%+ to win against each general seen; a king at 60%+ and 10% or less to fall (a fallen king
//     costs the crown). Seeing no general: a hero accepts from a duelling skill of 2, a king only from 4.
//   CHALLENGE — a real duellist (a duelling skill at 4+, 80%+ health) forecast at 65%+ against each general seen; a
//     king also risks 10% or less of falling. Seeing no general, a hero challenges as before; a king only accepts.
// botDuelSkill (a character's best duelling skill) is in bots/strategy.ts.
export const BOT_DUEL = { heroAccept: 0.5, kingAccept: 0.6, kingFelled: 0.1, challenge: 0.65 };
// With no forecaster handed in (the plan always hands one in; a direct call may not), the duelling ratings stand in, as
// before: a commander rated 1.3× his foe or more counts as winning 70% of the time, any other 40%. His odds of falling
// are set either side of the king's limit (BOT_DUEL.kingFelled): only the one rated clearly stronger counts as safe
// enough for a king to answer.
export const BOT_DUEL_WITHOUT_A_FORECAST = { felledWhenStronger: 0.05, felledOtherwise: 0.3 };
export function botDuelStance(G: GameState, pi: number, c: Character, duelSim: ADuelForecaster | null | undefined) {
  const hp = asItsGuardReadsIt(c.hp) ?? (c.maxHp || 20),
    mhp = c.maxHp || 20;
  const d = botDuelSkill(c);
  if (d < 2 || hp < mhp * 0.6) return 'refuse';
  const fit = d >= 4 && hp >= mhp * 0.8; // a real duellist, fit to ride out
  const P = G.world.provinces[c.location];
  const near = P ? [P] : [];
  if (P)
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, P, i);
      if (N) near.push(N);
    }
  const I = botEnemyIntel(G, pi);
  let win: number | null = null,
    felled = 0;
  for (const e of theCharactersOf(G)) {
    if (!(
      e?.alive &&
      e.player != null &&
      e.player !== pi &&
      theUnitsWithGapsOf(e).length &&
      botRelationRaw(G, pi, e.player) === 'enemy'
    ))
      continue;
    const r = I.generals[e.id];
    const loc = botSeesChar(G, pi, e) ? e.location : r && (G.turn || 0) - r.turn <= 2 ? r.provId : null;
    if (loc == null || !near.some((x) => x.id === loc)) continue;
    const f = typeof duelSim === 'function' ? duelSim(c, botAssumedChar(G, pi, e), 16) : null;
    const w = f ? f.win : botDuelRating(c) >= botDuelRating(botAssumedChar(G, pi, e)) * 1.3 ? 0.7 : 0.4;
    const fl = f
      ? f.felled
      : w >= 0.7
        ? BOT_DUEL_WITHOUT_A_FORECAST.felledWhenStronger
        : BOT_DUEL_WITHOUT_A_FORECAST.felledOtherwise;
    if (win == null || w < win) win = w;
    if (fl > felled) felled = fl;
  }
  if (win == null) {
    if (c.isKing) return d >= 4 ? 'accept' : 'refuse';
    return fit ? 'challenge' : 'accept';
  }
  const safe = !c.isKing || felled <= BOT_DUEL.kingFelled;
  if (fit && safe && win >= BOT_DUEL.challenge) return 'challenge';
  if (safe && win >= (c.isKing ? BOT_DUEL.kingAccept : BOT_DUEL.heroAccept)) return 'accept';
  return 'refuse';
}
export function botSetDuelStances(G: GameState, pi: number, duelSim: ADuelForecaster | null | undefined) {
  theCharactersOf(G).forEach((c) => {
    if (!(c?.alive && c.player === pi)) return;
    c.encounterPlan = asItsGuardReadsIt(c.encounterPlan) ?? {};
    c.encounterPlan.duelStance = botDuelStance(G, pi, c, duelSim);
    c.encounterPlan._botStance = true;
  });
}
// ══ GARRISON SWEEP (Sept 2026, review II A2 — corrected: the engine's Pick Up Army order does it) ════
// Garrisons fill past the two-per-province rule from engine deliveries the recruit cap never sees (Call to
// Arms, Elven Homeward Flight, a dispersed column). A character standing in such a province takes the
// surplus into his column with `pickup_army` target "g:<i>,g:<j>" — the best units for HIM (strength ×
// kinship/grudge), leaving the two weakest behind as the tripwire. One sweep per province per turn.
export function botPickupOrder(G: GameState, pi: number, c: Character, prov: Province | null | undefined) {
  if (prov?.owner !== pi || prov.terrain === 'sea') return null;
  const garr: readonly (Army | null | undefined)[] = asItsGuardReadsIt(prov.garrisonArmies) ?? [];
  const keep = Math.min(2, botGarrisonTarget(G, prov, pi));
  if (garr.length <= keep) return null; // 2026-09-26 (Toby): only the garrison the province is meant to hold stays behind (was always 2) — a fallen commander's host garrisoned here is taken up whole
  const cache = botTurnCache(G);
  const swept = cache.swept ?? new Set();
  cache.swept = swept;
  if (swept.has(prov.id)) return null;
  const val = (a: Army) => unitBaseStrength(a) * botRaceTerrainMult(G, c, a, null, false, pi);
  const ranked = garr.map((a, i) => ({ i, v: a ? val(a) : -1 })).sort((x, y) => y.v - x.v);
  const take = ranked
    .slice(0, garr.length - keep)
    .map((x) => x.i)
    .sort((a, b) => a - b);
  if (!take.length) return null;
  swept.add(prov.id);
  return {
    action: 'pickup_army',
    target: take.map((i) => `g:${String(i)}`).join(','),
    extra: '',
    desc:
      'Take up ' + String(take.length) + ' surplus garrison unit' + (take.length !== 1 ? 's' : '') + ' in ' + prov.name,
  };
}
// ORPHANED HOST (2026-09-26, Toby): when a commander falls his host garrisons the nearest friendly province
// (disperseDeadCharArmies). Any owned land province holding three or more garrison units beyond its target is
// such a host; the nearest free hero walks there and takes it up. One claimant per province per turn.
export function botOrphanHostOrders(G: GameState, pi: number, c: Character, pre: readonly AnOrderAsThePassesReadIt[]) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  const cache = botTurnCache(G);
  const orphan = cache.orphan ?? new Set();
  cache.orphan = orphan;
  let best: { readonly X: Province; readonly d: number; readonly sc: number; readonly n: number } | null = null;
  for (const X of theProvincesOf(G)) {
    if (X?.owner !== pi || X.terrain === 'sea' || orphan.has(X.id)) continue;
    const n = (asItsGuardReadsIt(X.garrisonArmies) ?? []).length - Math.min(2, botGarrisonTarget(G, X, pi));
    if (n < 3) continue;
    const d = X.id === P.id ? 0 : botPathLen(G, pi, P, X.id, true);
    if (d == null || d > 5) continue;
    const sc = n * 3 - d * 2;
    if (!best || sc > best.sc) best = { X, d, sc, n };
  }
  if (!best) return null;
  const host = best.X;
  const path = best.d > 0 ? (botPathDirs(G, pi, P, host.id, 5, true) ?? []) : [];
  if (best.d > 0 && path.length !== best.d) return null;
  if (pre.length + path.length >= 5) return null;
  orphan.add(host.id);
  const out: AnOrderAsThePassesReadIt[] = [
    ...pre,
    ...path.map((d) => aMoveOrderOnThePath(d, 'Take up the leaderless host at ' + host.name)),
  ];
  const po = botPickupOrder(G, pi, { ...c, location: host.id }, host);
  if (!po) return null;
  out.push(po);
  while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Hold with the host' });
  return out;
}
// ══ BOT CONCESSION ════
// A bot realm with no province anywhere in the world has nothing to rule, nothing to tax and
// nothing to rebuild from: it concedes. The engine's existing concession machinery then does
// everything else — the realm's characters only ever Defend (enforced in the order-merge pass), it
// stops being waited on
// (realmExemptFromOrders) and it no longer counts toward the last-realm-standing victory test.
// MUST run before the bot movement/economy/action passes so a conceding realm never writes orders.
export function runBotConcessions(
  G: GameState | null | undefined,
  botIdxSet: ReadonlySet<number> | null | undefined,
  turnContext: TurnContext | null | undefined,
) {
  if (!botIdxSet?.size || !G || !asItsGuardReadsIt(G.world)) return;
  if (!(asItsGuardReadsIt(G.world.provinces) ?? []).length) return; // world not built — never concede on a blank state
  if ((G.turn || 0) < 1) return;
  botIdxSet.forEach((pi) => {
    const p = theRealmsOf(G)[pi];
    if (!p || p.conceded) return;
    if ((asItsGuardReadsIt(p.provinces) ?? []).length > 0) return;
    // Belt and braces: the realm's own province list is the engine's record, but cross-check the
    // map so a stale/desynced list can never concede a bot that still holds ground.
    if (theProvincesOf(G).some((pv) => pv?.owner === pi)) return;
    p.conceded = true;
    p.concededTurn = G.turn;
    if (turnContext)
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a bot realm with no province concedes the game', realmName: p.name },
        audience: { actor: null, realms: [], seen: 'world' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        system: true,
      });
  });
}

// Write movement (and phase-0 muster) orders for every bot character. Called from runTurn after
// human orders are merged into G.turnOrders and before the default-to-Defend pass.
// ══ SLAYER SCHOOL (2026-09-28, Toby) ════
// The engine's mentor rule makes a Practice phase a GUARANTEED level when a friendly character in the same
// province practises the same skill in the same phase at a higher level. The study found only 7% of slayer
// training years had a mentor — the king, the usual teacher, is the general and was marching or mustering.
// Once every other plan is made, each training slayer is sent to the realm character who can teach him the
// most levels this year, in the phases that character has spare:
//   • the KING teaches Melee, Archery and every magic school he knows better;
//   • any other HERO teaches the magic schools he knows better.
// It never touches a general's march: only phases that are already filler (a Hold, a plain Practice, nothing)
// are used, and only in a province the realm owns at the start of the year. A phase the KING meant to spend
// recruiting is handed to another hero standing with him — he raises the same troops for the king's host — so
// the king is free to teach ("heroes other than the king recruit to the general").
export const BOT_TEACH_KING = ['melee', 'archery', ...BOT_SCHOOLS];
// botIsTeach (is this order a lesson?) is in bots/strategy.ts.
export function botSlayerSkillPri(S: string, sk: Character['skills']) {
  if (S === 'melee') return 0;
  if (S === botSlayerSchool({ skills: sk })) return 1;
  if (S === 'archery') return 2;
  if (S === 'elemental' || S === 'necromancy' || S === 'psychic') return 3;
  return 4;
}
export function botOrderLocs(G: GameState, c: Character) {
  const o = theTurnsOrders(G)[c.id] ?? [];
  const out: (number | null)[] = [];
  let cur: Province | null | undefined = G.world.provinces[c.location];
  for (let p = 0; p < 5; p++) {
    out.push(cur ? cur.id : null);
    const x = o[p];
    if (x?.action === 'move' && cur) {
      const N: Province | null | undefined = theTargetAsWords(x).startsWith('dir:')
        ? botNeighbourProv(G, cur, BOT_HEX_DIRS.indexOf(theTargetAsWords(x).slice(4)))
        : G.world.provinces[+x.target];
      cur = N ?? cur;
    }
  }
  return out;
}
export function botTeachFree(G: GameState, pi: number, m: Character, p: number) {
  const k = (theTurnsOrders(G)[m.id] ?? [])[p];
  if (!k) return true;
  if (k.action === 'practice')
    return !/drill the host|drill the fleet|lead the host cleanly/.test(k.desc || '') && !botIsTeach(k);
  return k.action === 'defend' && p > 0 && !botNearbyThreat(G, pi, m);
}
export function botRunSlayerSchool(G: GameState, pi: number, roles: ABotRealmsRoles) {
  const res = botTurnCache(G).teach ?? {}; // mentorId → {phase: skill}
  botTurnCache(G).teach = res;
  const orders = theTurnsOrders(G);
  const mine = theCharactersOf(G).filter((x): x is Character => Boolean(x?.alive && x.player === pi && !x._isHeir));
  const king = mine.find((x) => x.isKing) ?? null;
  const BUSY = new Set<string>([
    'search',
    'hunt_rumours',
    'hire',
    'encounter',
    'cast_spell',
    'rest',
    'assassinate',
    'sabotage',
    'steal',
    'spy',
    'research',
    THE_ALIGNMENT_ORDERS.consecrate.key,
    'chart_unknown',
    'leave_army',
    'recruit',
    'pickup_army',
  ]);
  const slayers = mine.filter(
    (c) =>
      c._botRole === 'slayer' &&
      !c.isKing &&
      !roles.leaders.includes(c.id) &&
      !theUnitsWithGapsOf(c).length &&
      (asItsGuardReadsIt(c.hp) ?? (c.maxHp || 20)) >= (c.maxHp || 20) * 0.6,
  );
  slayers.forEach((sl) => {
    const so = orders[sl.id] ?? [];
    if (so.some((x) => x && BUSY.has(x.action))) return; // lair work, a hire or a spell comes first
    const Ps = G.world.provinces[sl.location];
    if (!Ps) return;
    let best: ASlayersBestLesson | null = null;
    // Below the hunting gate (botLairPlan) the lessons that open it come first: Melee / Archery from the king.
    // Magic lessons (anyone) once he hunts — a magic level in place of his Melee practice had kept slayers
    // below the gate longer (study 2026-09-28).
    const _ss: Character['skills'] = asItsGuardReadsIt(sl.skills) ?? {};
    const slMelee = Number(_ss.melee) || 0,
      slArchery = Number(_ss.archery) || 0;
    const belowGate = slMelee < 3 && slArchery < 3 && slMelee + slArchery < 5;
    const sls: Readonly<Partial<Record<string, number>>> = asItsGuardReadsIt(sl.skills) ?? {};
    for (const m of mine) {
      if (m.id === sl.id) continue;
      const teach: readonly string[] = belowGate
        ? m.isKing
          ? ['melee', 'archery']
          : []
        : m.isKing
          ? BOT_TEACH_KING
          : BOT_SCHOOLS;
      const ms: Readonly<Partial<Record<string, number>>> = asItsGuardReadsIt(m.skills) ?? {};
      if (!teach.length) continue;
      if (!teach.some((S) => (Number(ms[S]) || 0) > (Number(sls[S]) || 0) && (Number(sls[S]) || 0) < 5)) continue;
      const locs = botOrderLocs(G, m);
      const mo = orders[m.id] ?? [];
      const r = res[m.id] ?? {};
      // the king teaches in his drill phases too (a drill is not a march — Toby: teaching must not slow the conquest)
      const free = [0, 1, 2, 3, 4].map(
        (p) =>
          botTeachFree(G, pi, m, p) ||
          (m.isKing && mo[p]?.action === 'practice' && /drill the host|lead the host cleanly/.test(mo[p].desc || '')),
      );
      // the KING's recruit phase can be handed to a hero standing with him who has that phase spare
      const helper = [0, 1, 2, 3, 4].map((p) => {
        if (!m.isKing || mo[p]?.action !== 'recruit') return null;
        return (
          mine.find(
            (h) =>
              h.id !== m.id &&
              h.id !== sl.id &&
              !h.isKing &&
              h._botRole !== 'slayer' &&
              botOrderLocs(G, h)[p] === locs[p] &&
              botTeachFree(G, pi, h, p),
          ) ?? null
        );
      });
      for (let p0 = 0; p0 < 5; p0++) {
        const X = locs[p0];
        if (X == null) continue;
        if (!(free[p0] || helper[p0])) continue;
        const PX = G.world.provinces[X];
        if (!PX || PX.terrain === 'sea') continue;
        // our own ground; or ground the KING's march takes this year — the slayer follows him there and arrives
        // a phase after the king, never into the fight (an enemy province is never on an unarmed path anyway)
        const arrive = locs.indexOf(X);
        if (PX.owner !== pi && !(m.isKing && (PX.owner == null || PX.owner === pi))) continue;
        const path = X === Ps.id ? [] : botPathDirs(G, pi, Ps, X, Math.min(p0, 3), true);
        if (!path || path.length > p0 || path.length > 3) continue; // lessons within three hops — a slayer is not drawn off to the front
        if (PX.owner !== pi && X !== Ps.id && path.length < arrive + 1) continue;
        const lv: Partial<Record<string, number>> = { ...asItsGuardReadsIt(sl.skills) };
        const plan: ALesson[] = [];
        for (let q = path.length; q < 5; q++) {
          if (locs[q] !== X || !(free[q] || helper[q])) continue;
          const ok = (S: string) => (Number(ms[S]) || 0) > (Number(lv[S]) || 0) && (Number(lv[S]) || 0) < 5;
          let S: string | null = null;
          const taught = r[q];
          if (taught) {
            if (ok(taught)) S = taught;
          } else
            S =
              (teach
                .filter(ok)
                .sort(
                  (a, b) =>
                    botSlayerSkillPri(a, asItsGuardReadsIt(sl.skills) ?? {}) -
                    botSlayerSkillPri(b, asItsGuardReadsIt(sl.skills) ?? {}),
                )[0] ??
                '') ||
              null;
          if (!S) continue;
          plan.push({
            q,
            S,
            helper: free[q] ? null : (helper[q] ?? null),
            gate: S === 'melee' && (Number(lv['melee']) || 0) < 3,
          });
          lv[S] = (Number(lv[S]) || 0) + 1;
        }
        if (!plan.length) continue;
        const sc = plan.length * 10 + plan.filter((x) => x.gate).length * 6 - path.length + (m.isKing ? 1 : 0); // a Melee lesson below the hunting gate is worth most
        if (!best || sc > best.sc) best = { m, X, path, plan, sc };
      }
    }
    if (!best) {
      // NO LESSON THIS YEAR: when the king can teach him Melee, Archery or a combat school, the slayer walks to
      // where the king will stand at the end of the year (our ground, or ground the king takes — arriving after him),
      // so next year they start together and the king's spare phases become lessons.
      if (!king || king.id === sl.id) return;
      const ks: Readonly<Partial<Record<string, number>>> = asItsGuardReadsIt(king.skills) ?? {},
        ss: Readonly<Partial<Record<string, number>>> = asItsGuardReadsIt(sl.skills) ?? {};
      if (!belowGate || !['melee', 'archery'].some((S) => (Number(ks[S]) || 0) > (Number(ss[S]) || 0))) return; // only to open the hunting gate
      const kl = botOrderLocs(G, king);
      const ko = orders[king.id] ?? [];
      let kEnd: Province | null | undefined = G.world.provinces[kl[4] ?? -1];
      {
        const x = ko[4];
        if (x?.action === 'move' && kEnd) {
          const N: Province | null | undefined = theTargetAsWords(x).startsWith('dir:')
            ? botNeighbourProv(G, kEnd, BOT_HEX_DIRS.indexOf(theTargetAsWords(x).slice(4)))
            : G.world.provinces[+x.target];
          if (N) kEnd = N;
        }
      }
      if (!kEnd || kEnd.terrain === 'sea' || kEnd.id === sl.location) return;
      if (!(kEnd.owner === pi || kEnd.owner == null)) return;
      const path = botPathDirs(G, pi, Ps, kEnd.id, 5, true);
      if (!path?.length || path.length > 5) return;
      const kArr = !kl.includes(kEnd.id) ? 5 : kl.indexOf(kEnd.id);
      if (kEnd.owner !== pi && path.length < Math.min(5, kArr + 1)) return;
      const solo = botSlayerTrainSkill(sl);
      const out: PhaseOrder[] = path.map((d) => aMoveOrderOnThePath(d, 'Join ' + king.name + ' for training'));
      while (out.length < 5)
        out.push(
          solo
            ? {
                action: 'practice',
                target: solo,
                extra: '',
                desc: 'Practice ' + theLabelOf(solo) + ' (slayer)',
              }
            : { action: 'defend', target: '', extra: '', desc: 'Hold' },
        );
      orders[sl.id] = out;
      const D = botTurnCache(G).teachDiag ?? [];
      botTurnCache(G).teachDiag = D;
      D.push({ pi, slayer: sl.id, mentor: king.id, king: true, phases: 0, handed: 0, follow: true });
      return;
    }
    // the slayer's year: walk to the teacher, practise the taught skill in each taught phase, the ladder skill between
    const solo = botSlayerTrainSkill(sl);
    const out: PhaseOrder[] = [];
    const byQ: Partial<Record<number, ALesson>> = {};
    best.plan.forEach((x) => {
      byQ[x.q] = x;
    });
    best.path.forEach((d) => out.push(aMoveOrderOnThePath(d, 'To ' + best.m.name + ' for training')));
    for (let q = out.length; q < 5; q++) {
      const x = byQ[q];
      out.push(
        x
          ? {
              action: 'practice',
              target: x.S,
              extra: '',
              desc: 'Practice ' + theLabelOf(x.S) + ' (taught by ' + best.m.name + ')',
            }
          : solo
            ? {
                action: 'practice',
                target: solo,
                extra: '',
                desc: 'Practice ' + theLabelOf(solo) + ' (slayer)',
              }
            : { action: 'defend', target: '', extra: '', desc: 'Hold' },
      );
    }
    orders[sl.id] = out;
    // the teacher's phases (and any recruit handed to a helper, raised into the king's host)
    const mentor = best.m;
    const held = orders[mentor.id];
    const mo = Array.isArray(held) ? held : [null, null, null, null, null];
    orders[mentor.id] = mo;
    const r = res[mentor.id] ?? {};
    res[mentor.id] = r;
    best.plan.forEach((x) => {
      if (x.helper) {
        const handed = mo[x.q];
        const helpers = orders[x.helper.id];
        const ho = Array.isArray(helpers) ? helpers : [null, null, null, null, null];
        orders[x.helper.id] = ho;
        const ro = theRecruitHandedOn(handed);
        ho[x.q] = {
          ...ro,
          target: theTargetAsWords(ro).replace(/,to:\d+$/, '') + `,to:${String(mentor.id)}`,
          desc: ro.desc + ' (for ' + mentor.name + "'s host)",
        };
      }
      mo[x.q] = {
        action: 'practice',
        target: x.S,
        extra: '',
        desc: 'Practice ' + theLabelOf(x.S) + ' (teach ' + sl.name + ')',
      };
      r[x.q] = x.S;
    });
    const D = botTurnCache(G).teachDiag ?? [];
    botTurnCache(G).teachDiag = D;
    D.push({
      pi,
      slayer: sl.id,
      mentor: best.m.id,
      king: best.m.isKing,
      phases: best.plan.length,
      handed: best.plan.filter((x) => x.helper).length,
    });
  });
}
