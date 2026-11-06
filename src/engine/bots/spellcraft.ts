import { TITLE_DEFS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { GUARDIAN_POWER_RANK, SKILL_LABELS } from '../army-tables.ts';
import { featDiscovered } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import {
  BOT_HEX_DIRS,
  BOT_SEA_ALL,
  botBelief,
  botConceded,
  botKnows,
  botKnowsGraves,
  botNeighbourProv,
  botRelationRaw,
  botScouted,
  botSees,
  botSeesChar,
  botTurnCache,
  botVisibleCharsIn,
  botBelievedOwner,
} from './intel.ts';
import { BOT_SCHOOLS } from './schools.ts';
import { botPins } from './phase-one.ts';
import { _charTitleMerit, computeStandings } from '../titles/reckoning.ts';
import {
  botAssumedChar,
  botDefenceNeed,
  botDrillOrder,
  botEnemyDefence,
  botEnemyIntel,
  botHasMetPlayers,
  botIsTeach,
  botNearbyThreat,
  botPracticeSkill,
  botRaiseTargets,
  botRoleTrainSkill,
  botRumourFor,
  botSchoolLimit,
  botSkillsUnknown,
} from './strategy.ts';
import { theNameOfTheSpell } from './the-name-of-a-spell-by-its-slug.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { PhaseOrder } from '../../schemas/orders-a-realm-submits.ts';
import type { Army, Character, GameState, Province, ProvinceFeature } from '../../schemas/saved-game-state.ts';

// Its types (plan P1-10b43): each parameter typed as wide as the body's guards, so each guard stays.
/** A phase's order as the passes read a plan: an order, or a gap the plan holds. */
type AnOrderAsThePassesReadIt = PhaseOrder | null | undefined;
/** The turn's orders as the passes read and write them, by hero (G.turnOrders). */
type TheTurnsOrdersAsThePassesHoldThem = Partial<Record<string, AnOrderAsThePassesReadIt[]>>;
/** The choices a cast plan takes: how many casts, a host about to fight, a siege's province, a host drawing near. */
interface TheCastPlansChoices {
  readonly max?: number | undefined;
  readonly fighting?: Character | null | undefined;
  readonly siege?: number | null | undefined;
  readonly threat?: boolean | undefined;
}
/** A duel's forecast (the movement pass's `duelSim`): the odds of a kill and of being felled. */
interface ADuelsForecast {
  readonly win: number;
  readonly felled: number;
}
/** A quarry a hunter may stalk, with its score and, once weighed, its forecast and its bet. */
interface AQuarry {
  readonly e: Character;
  readonly d: number;
  readonly loc: number;
  readonly mem: boolean;
  readonly sc: number;
  forecast?: ADuelsForecast;
  bet?: number;
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
/** A hero's units, where the code guards them as if they may be missing. */
function theUnitsOf(c: Character): readonly Army[] {
  return asItsGuardReadsIt(c.armies) ?? [];
}
/** A hero's units, where the code also tests the list for a gap. */
function theUnitsWithGapsOf(c: Character): readonly (Army | null | undefined)[] {
  return asItsGuardReadsIt(c.armies) ?? [];
}
/** A hero's skills read by any name (a copy by a spread, as `c.skills || {}` read them: none for none). */
function theSkillsByName(c: Character): Readonly<Partial<Record<string, number | undefined>>> {
  const skills: Readonly<Partial<Record<string, number | undefined>>> = { ...asItsGuardReadsIt(c.skills) };
  return skills;
}
/** A province's marks the schema lacks: a Flood (sea for the rest of the year) and the turn of its false terrain. */
function theMarksOn(P: Province): {
  readonly terrain: string;
  readonly _flood?: unknown;
  readonly _illusoryTurn?: unknown;
} {
  return P;
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
/** One step back along a path just found, or none at its start (`prev` null): every other province reached holds the
 *  one before it and the way from it, so a missing step (where the old walk never ended) throws. */
function theStepBack(
  prev: Readonly<Partial<Record<number, number | null>>>,
  dirOf: Readonly<Partial<Record<number, number>>>,
  id: number,
): readonly [dir: number, back: number] | null {
  const back = prev[id];
  if (back === null) return null;
  const dir = dirOf[id];
  if (back === undefined || dir === undefined) throw new TypeError('A path found holds every step back to its start');
  return [dir, back];
}
/** The realm's known dead, as the cast plan once read them for a Resurrect (its errand pass's bodies are raised now). */
function theKnownDeadOf(G: GameState, pi: number): Set<number> {
  return new Set(G.players[pi]?.knownDeadHeroIds ?? []);
}
/** The order of a plan at a place the loop's count makes sure of: for none, the TypeError its read would throw. */
function theOrderOfThePlan(plan: readonly PhaseOrder[], k: number): PhaseOrder {
  const o = plan[k];
  if (o === undefined) throw new TypeError("Cannot read properties of undefined (reading 'action')");
  return o;
}

// ══ BOT SPELLCRAFT (Sept 2026 self-play batch) ════
// Replaces the single-cast botActionCast. botCastPlan builds an ORDERED list of action-phase casts
// (up to `max`) from a given standing province, honouring the engine's per-school per-turn cap (1
// at L1-2, 2 at L3, 3 at L4+) and each spell's real range: character spells (Curse, Psychic Blast,
// Telekinetic Storm, Charm, Oratory, Phantasmal Armies, Resurrect) need the target IN the caster's
// province; province spells
// (Plague, Flood, Earthquake, Bless, Illusory Terrain) reach the province or a neighbour. (The old planner
// aimed Curse / Psychic Blast at ADJACENT enemies, which the engine rejects — a wasted phase every
// time.) Offence first when an enemy is in reach, then buffs for a host about to fight, then
// economy.
// botSchoolLimit (the per-school cap on casts each turn) is in bots/strategy.ts.
export function botCastPlan(
  G: GameState,
  pi: number,
  c: Character,
  prov: Province | null | undefined,
  opts: TheCastPlansChoices | null | undefined,
) {
  const choices = opts ?? {};
  const max = (choices.max ?? 0) || 5;
  const sk = theSkillsByName(c);
  const out: PhaseOrder[] = [];
  const used: Partial<Record<string, number>> = {};
  if (!prov) return out;
  const lvl = (s: string) => Number(sk[s]) || 0;
  const can = (s: string) => lvl(s) >= 1 && (used[s] ?? 0) < botSchoolLimit(lvl(s));
  const push = (school: string, spell: string, extra: string | number | null | undefined, desc: string) => {
    if (out.length >= max || !can(school)) return false;
    used[school] = (used[school] ?? 0) + 1;
    out.push({ action: 'cast_spell', target: spell, extra: extra == null ? '' : String(extra), desc });
    return true;
  };
  const enemyRel = (j: number | null | undefined) => j != null && j !== pi && botRelationRaw(G, pi, j) === 'enemy';
  // targets are drawn from what this realm can see. charsIn goes through botVisibleCharsIn (so a
  // cloaked or unspotted hero is not picked as a target at all, rather than being targeted and
  // fizzling), and a neighbouring province is only a spell target if the realm has at least scouted
  // it — ownership on the border tier is public, the host standing there is not.
  const charsIn = (P: Province) => botVisibleCharsIn(G, pi, P);
  const hereEnemies = charsIn(prov).filter((e) => e.player != null && enemyRel(e.player));
  const near: Province[] = [prov];
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, prov, i);
    if (N && botScouted(G, pi, N.id)) near.push(N);
  }
  const enemyProvs = near.filter((N) => N.owner != null && enemyRel(N.owner) && N.terrain !== 'sea');
  const armiesIn = (N: Province) => botEnemyDefence(G, N, N.owner, pi); // judged on what this realm can see
  const skillTotal = (e: Character) =>
    Object.values(asItsGuardReadsIt(e.skills) ?? {}).reduce((a: number, b) => a + (Number(b) || 0), 0);
  // ── OFFENCE: enemies standing WITH the caster ──
  const armyLeader = [...hereEnemies]
    .filter((e) => theUnitsOf(e).length >= 2)
    .sort((a, b) => theUnitsOf(b).length - theUnitsOf(a).length)[0];
  if (armyLeader)
    push(
      'psychic',
      theNameOfTheSpell('telekinetic-storm'),
      armyLeader.id,
      'Cast Telekinetic Storm on ' + armyLeader.name,
    );
  const juiciest = [...hereEnemies].sort(
    (a, b) => (b.isKing ? 100 : 0) + skillTotal(b) - ((a.isKing ? 100 : 0) + skillTotal(a)),
  )[0];
  // 2026-09-29 (Toby): CURSE THE GENERAL — every skill halved for the rest of the turn, Tactical included, so a
  // host whose commander is cursed in Spring fights the rest of the year at a fraction of its battle multiplier.
  // An enemy KING here takes it first (a cursed king is a king who can fall); else the enemy leading the
  // biggest host here; else the most valuable hero.
  if (juiciest) {
    push('psychic', theNameOfTheSpell('psychic-blast'), juiciest.id, 'Cast Psychic Blast on ' + juiciest.name);
    const _cz = juiciest.isKing ? juiciest : (armyLeader ?? juiciest);
    push(
      'necromancy',
      theNameOfTheSpell('curse'),
      _cz.id,
      'Cast Curse on ' + _cz.name + (_cz === armyLeader ? ' (break the general before the battle)' : ''),
    );
  }
  // ── OFFENCE: enemy provinces in reach ──
  const withArmies = enemyProvs.filter((N) => armiesIn(N) > 0).sort((a, b) => armiesIn(b) - armiesIn(a));
  // FLOOD (2026-09-29): pins — Floods that strand an enemy host we cannot meet — are chosen centrally
  // (botPins) and written into the caster's Spring by the phase-one pass. What remains here is the old
  // harassing Flood on an enemy province holding forces: never where a host of ours stands, never on a
  // pinned province (its caster is already on it), never the siege target.
  {
    const oursThere = (N: Province) =>
      theCharactersOf(G).some((x) => x?.alive && x.player === pi && x.location === N.id && theUnitsOf(x).length > 0);
    const _pins = botPins(G, pi);
    const fl = withArmies.find(
      (N) => !theMarksOn(N)._flood && N.id !== choices.siege && !oursThere(N) && !_pins.has(N.id),
    );
    if (fl) push('elemental', theNameOfTheSpell('flood'), fl.id, 'Cast Flood on ' + fl.name);
  }
  const plagueT = withArmies.find((N) => theMarksOn(N)._flood) ?? withArmies[0];
  if (plagueT) push('necromancy', theNameOfTheSpell('plague'), plagueT.id, 'Cast Plague on ' + plagueT.name);
  const rich = [...enemyProvs].sort((a, b) => (b.tax || 0) - (a.tax || 0))[0];
  if (rich && (rich.tax || 0) >= 4)
    push('elemental', theNameOfTheSpell('earthquake'), rich.id, 'Cast Earthquake on ' + rich.name);
  // ── CHARM: a wandering hero here is a free hire; a lone enemy hero can be turned for the turn ──
  const wanderer = charsIn(prov).find(
    (h) => h.player === null && !h._isNeutralGuard && !h._justDefeated && !h.isKing && !theUnitsOf(h).length,
  );
  if (wanderer) push('psychic', theNameOfTheSpell('charm'), wanderer.id, 'Charm ' + wanderer.name);
  else {
    const lone = hereEnemies.find((e) => !e.isKing && !theUnitsOf(e).length);
    if (lone) push('psychic', theNameOfTheSpell('charm'), lone.id, 'Charm ' + lone.name);
  }
  // ── BUFFS for a host about to fight (opts.fighting: the caster or a co-located friendly leader
  // attacks this turn) ──
  if (choices.fighting) {
    const host = choices.fighting;
    push('psychic', theNameOfTheSpell('oratory'), host.id === c.id ? '' : host.id, 'Oratory for ' + host.name);
    if (host.id === c.id) push('elemental', theNameOfTheSpell('elemental-summon'), '', 'Summon an elemental');
    push(
      'illusory',
      theNameOfTheSpell('phantasmal-armies'),
      host.id === c.id ? '' : host.id,
      'Phantasmal Armies for ' + host.name,
    );
  }
  // ── SIEGE MAGIC (2026-09-26, Toby ideas 2 / 4): opts.siege is the enemy province a friendly host attacks this
  // turn, when it lies in this caster's reach. Illusory Terrain there makes the defenders fight at 80%; Plague
  // thins their units before the host arrives. (No Earthquake — that would only cost us the tax of a province
  // we are about to take; no Flood — it would strand our own assault.)
  if (choices.siege != null) {
    const S = G.world.provinces[choices.siege];
    if (S && near.some((N) => N.id === S.id)) {
      if (theMarksOn(S)._illusoryTurn !== G.turn)
        push('illusory', theNameOfTheSpell('illusory-terrain'), S.id, 'Illusory Terrain over ' + S.name + ' (siege)');
      push('necromancy', theNameOfTheSpell('plague'), S.id, 'Plague on ' + S.name + ' (siege)');
    }
  }
  // ── DEFENCE: false terrain over an owned province an enemy host stands beside — and (idea 2) over the
  // caster's own ground the moment a hostile host is seen within two hexes (opts.threat) ──
  if (lvl('illusory') >= 1) {
    const threatened = near
      .filter(
        (N) =>
          N.owner === pi &&
          N.terrain !== 'sea' &&
          theMarksOn(N)._illusoryTurn !== G.turn &&
          botDefenceNeed(G, N, pi) > 0,
      )
      .sort((a, b) => (b.tax || 0) - (a.tax || 0))[0];
    if (threatened)
      push(
        'illusory',
        theNameOfTheSpell('illusory-terrain'),
        threatened.id,
        'Cast Illusory Terrain on ' + threatened.name,
      );
    else if (choices.threat && prov.owner === pi && prov.terrain !== 'sea' && theMarksOn(prov)._illusoryTurn !== G.turn)
      push(
        'illusory',
        theNameOfTheSpell('illusory-terrain'),
        prov.id,
        'Cast Illusory Terrain on ' + prov.name + ' (a host draws near)',
      );
  }
  // ── RESURRECT a known fallen hero lying here (never one who served another realm — a raised hero serves the raiser) ──
  if (lvl('white') >= 1) {
    theKnownDeadOf(G, pi); // read by nothing, but read as before (a world of no players' list throws here)
    // 2026-09-28: the same bodies the errand pass raises (own heroes, own recallable monarch)
    const grave = botRaiseTargets(G, pi).find((x) => x.loc === prov.id);
    if (grave) push('white', theNameOfTheSpell('resurrect'), grave.g.id, 'Resurrect ' + grave.g.name);
  }
  // ── ECONOMY ──
  if (lvl('white') >= 1) {
    const own = near
      .filter((N) => N.owner === pi && N._blessedTurn !== G.turn && N.terrain !== 'sea')
      .sort((a, b) => (b.tax || 0) - (a.tax || 0))[0];
    // Sept 2026: a Divine KING's Bless is +100% (a hero's +80%) — a hero standing with his Divine king leaves it to him
    const kingHere =
      !c.isKing &&
      (asItsGuardReadsIt(G.players) ?? [])[pi]?.alignment === 'Divine' &&
      theCharactersOf(G).some(
        (k) =>
          k?.alive &&
          k.isKing &&
          k.player === pi &&
          k.location === c.location &&
          (Number(asItsGuardReadsIt(k.skills)?.white) || 0) >= 1,
      );
    if (own && !kingHere)
      push('white', theNameOfTheSpell('bless-province'), own.id, 'Cast Bless Province on ' + own.name);
  }
  // Skeletal Armies: the caster is STANDING here, so he feels the dead underfoot if he has the
  // Necromancy to feel them — but the realm's own grave lore is the record, not prov.battleGraves.
  if (
    lvl('necromancy') >= 1 &&
    (botKnowsGraves(G, pi, prov.id) || (botSees(G, pi, prov.id) && (prov.battleGraves ?? []).length > 0))
  )
    push('necromancy', theNameOfTheSpell('skeletal-armies'), '', 'Cast Skeletal Armies');
  return out;
}
// The enemy province a character's written plan attacks this turn (first Move tagged Attack / Assault /
// Lightning strike), or null. Used to aim siege magic (idea 4).
export function botPlannedAttackTarget(G: GameState, l: Character) {
  const lo = theTurnsOrders(G)[l.id] ?? [];
  let cur = G.world.provinces[l.location];
  if (!cur) return null;
  for (const o of lo) {
    if (o?.action !== 'move') continue;
    let N: Province | null | undefined;
    if (theTargetAsWords(o).startsWith('dir:')) {
      const d = BOT_HEX_DIRS.indexOf(theTargetAsWords(o).slice(4));
      N = botNeighbourProv(G, cur, d);
    } else N = G.world.provinces[+o.target];
    if (!N) return null;
    if (/^(Attack|Assault|Lightning strike)/.test(o.desc || '')) return N.id;
    cur = N;
  }
  return null;
}
// Legacy entry point kept for callers that want a single best cast.
export function botActionCast(G: GameState, c: Character & { readonly player: number }) {
  const plan = botCastPlan(G, c.player, c, G.world.provinces[c.location], { max: 1 });
  return plan[0] ?? null;
}
// Which schools make a character a RAIDER (offensive action magic worth carrying into enemy land).
export function botOffensiveMagic(c: Character) {
  const s = asItsGuardReadsIt(c.skills) ?? {};
  return (Number(s.elemental) || 0) + (Number(s.necromancy) || 0) + (Number(s.psychic) || 0);
}
// Personal-combat rating for hunter/quarry comparisons (mirror of botCanBeatGuardian's character
// side).
export function botDuelRating(c: Character) {
  const s = asItsGuardReadsIt(c.skills) ?? {};
  const bm = (Number(s.elemental) || 0) + (Number(s.necromancy) || 0) + (Number(s.psychic) || 0);
  const t = asItsGuardReadsIt(c.temper) ?? '';
  const tb = t === 'Berserk' ? 6 : t === 'Brave' ? 4 : t === 'Cautious' ? 5 : 0;
  const hp = asItsGuardReadsIt(c.hp) ?? (c.maxHp || 20);
  return (
    hp +
    (Number(s.melee) || 0) * 6 +
    (Number(s.archery) || 0) * 4 +
    bm * 4 +
    tb +
    (asItsGuardReadsIt(c.items) ?? []).length * 3
  );
}
// Nearest at-war enemy province worth raiding (rich, or holding enemy characters/armies) within
// `maxD` hops for an UNARMED character (who may cross anyone's land). Returns {P, d} or null.
export function botRaidTarget(
  G: GameState,
  pi: number,
  from: Province | null | undefined,
  maxD: number,
): { P: Province; d: number; sc: number } | null {
  // only ground this realm has seen, valued on the owner and wealth it BELIEVES are there plus
  // whatever characters it can actually see standing in it.
  let best: { P: Province; d: number; sc: number } | null = null;
  theProvincesOf(G).forEach((P) => {
    if (!P || P.terrain === 'sea') return;
    if (!botKnows(G, pi, P.id)) return;
    const b = botBelief(G, pi, P);
    if (b?.owner == null || b.owner === pi || botRelationRaw(G, pi, b.owner) !== 'enemy') return;
    const chars = botVisibleCharsIn(G, pi, P).filter((x) => x.player === b.owner);
    const value = (b.tax || 0) + chars.reduce((s, e) => s + (e.isKing ? 12 : 6) + theUnitsOf(e).length * 2, 0);
    if (value < 4) return;
    const d = botPathLenAny(G, from, P.id, maxD);
    if (d == null) return;
    const sc = value - d * 2;
    if (!best || sc > best.sc) best = { P, d, sc };
  });
  return best;
}
// BFS over ALL land provinces (an unarmed character's world), capped at maxD.
export function botPathAny(
  G: GameState,
  from: Province | null | undefined,
  toId: number | null | undefined,
  maxD: number,
): number[] | null {
  if (!from || toId == null) return null;
  if (from.id === toId) return [];
  const prev: Partial<Record<number, number | null>> = {};
  prev[from.id] = null;
  const dirOf: Partial<Record<number, number>> = {};
  let q: Province[] = [from],
    depth = 0;
  while (q.length && depth < maxD) {
    const next: Province[] = [];
    depth++;
    let found = false;
    for (const cur of q) {
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, cur, i);
        if (!N || prev[N.id] !== undefined || N.terrain === 'sea') continue;
        prev[N.id] = cur.id;
        dirOf[N.id] = i;
        if (N.id === toId) {
          found = true;
          break;
        }
        next.push(N);
      }
      if (found) break;
    }
    if (found) break;
    q = next;
  }
  if (prev[toId] === undefined) return null;
  const dirs: number[] = [];
  let id = toId;
  for (let step = theStepBack(prev, dirOf, id); step !== null; step = theStepBack(prev, dirOf, id)) {
    dirs.unshift(step[0]);
    id = step[1];
  }
  return dirs;
}
export function botPathLenAny(
  G: GameState,
  from: Province | null | undefined,
  toId: number | null | undefined,
  maxD: number,
) {
  const p = botPathAny(G, from, toId, maxD);
  return p ? p.length : null;
}
// A beatable enemy hero (not a king unless the hunter is one) within `maxD` hops, or null.
export function botHuntTarget(
  G: GameState,
  pi: number,
  c: Character,
  maxD: number,
  duelSim:
    ((hunter: Character, quarry: Character, rounds: number) => ADuelsForecast | null | undefined) | null | undefined,
) {
  if (!(Number(asItsGuardReadsIt(c.skills)?.melee) >= 3 || Number(asItsGuardReadsIt(c.skills)?.archery) >= 3))
    return null;
  const mine = botDuelRating(c);
  const from = G.world.provinces[c.location];
  if (!from) return null;
  const cands: AQuarry[] = [];
  const I = botEnemyIntel(G, pi);
  theCharactersOf(G).forEach((e) => {
    if (!(e?.alive && e.player != null && e.player !== pi && botRelationRaw(G, pi, e.player) === 'enemy')) return;
    // a quarry must be one this realm can SEE right now — the same rule that builds a human's
    // Encounter Character dropdown (enemyCharVisibleTo). Bots were hunting heroes across the map by
    // reading their true position out of the game state.
    // Sept 2026 (Toby: track down enemy heroes): a hero seen unarmed within the last two turns is stalked to the
    // province he was last seen in even when out of sight now — the hunter walks there and lies in wait.
    const seen = botSeesChar(G, pi, e);
    const sighting = I.heroes[e.id];
    const mem = !seen && sighting && (G.turn || 0) - sighting.turn <= 2 ? sighting : null;
    if (!seen && !mem) return;
    if (mem && (theUnitsOf(e).length > 0 || mem.provId === from.id)) return;
    if (e.isKing && !c.isKing) return;
    if (e._invisTurn === G.turn) return;
    if (mine < botDuelRating(botAssumedChar(G, pi, e)) * 1.2) return; // cheap pre-filter, on known skills only
    const loc = mem ? mem.provId : e.location; // mem is null for a quarry in sight, and there for one out of it
    const d = botPathLenAny(G, from, loc, maxD);
    if (d == null) return;
    cands.push({
      e,
      d,
      loc,
      mem: !!mem,
      sc:
        (e.isKing ? 40 : 10) +
        Object.values(asItsGuardReadsIt(e.skills) ?? {}).reduce((a: number, b) => a + (Number(b) || 0), 0) -
        d * 2 -
        (mem ? 4 : 0),
    });
  });
  cands.sort((a, b) => b.sc - a.sc);
  // Forecast the top few on the engine's duel model and take the best bet: a kill is the prize, a
  // quarry that flees costs nothing, being felled is what we refuse (<=20%). Without a forecaster
  // (module-level callers) fall back to a stiff rating margin.
  let best: AQuarry | null = null;
  for (const cand of cands.slice(0, 5)) {
    if (typeof duelSim === 'function') {
      const f = duelSim(c, botAssumedChar(G, pi, cand.e), 24);
      if (!f || f.felled > 0.1 || f.win < 0.4) continue;
      cand.forecast = f; // Sept 2026 (review II A3): a tenth, not a fifth
      cand.bet = f.win * 10 - f.felled * 20 + (cand.e.isKing ? 4 : 0) - cand.d;
    } else {
      if (mine < botDuelRating(botAssumedChar(G, pi, cand.e)) * 1.5) continue;
      cand.bet = cand.sc;
    }
    if (!best || cand.bet > Number(best.bet)) best = cand; // a quarry kept holds its bet
  }
  return best;
}
// CROSS-TRAINING. Co-located allies drill faster together: the engine gives a character a
// GUARANTEED skill gain when a higher-level co-trainer practises the same skill (mentor rule), and
// a group bonus among equals. So instead of each bot character grinding its own skill alone, a
// cluster converges on one "mentor skill" — the strongest teachable skill present — and the
// laggards (including freshly-hired heroes standing with the king) level up quickly. Deterministic
// from skills, so every member of the cluster independently picks the same focus and they all
// co-train.
export function botCrossTrainSkill(G: GameState, c: Character, pi: number) {
  const partners = theCharactersOf(G).filter(
    (x): x is Character =>
      x != null &&
      x.alive &&
      x.player === pi &&
      x.location === c.location &&
      x.id !== c.id &&
      (() => {
        const o = theTurnsOrders(G)[x.id];
        return (
          !o ||
          o.every(
            (y) => y == null || ['defend', 'practice', 'research', 'hire', 'recruit', 'leave_army'].includes(y.action),
          )
        );
      })(),
  );
  if (partners.length === 0) return null; // need a training partner
  const group = [c, ...partners];
  // NOT a copy of KC_MAGIC_SCHOOLS/KC_SKILLS: this ORDER is the tie-break priority. Leave it hand-kept (2026-09-27).
  const SKILLS = [
    'melee',
    'tactical',
    'march',
    'archery',
    'naval',
    'white',
    'psychic',
    'illusory',
    'elemental',
    'necromancy',
    'spy',
    'thief',
    'sage',
    'druid',
    'explorer',
  ];
  let bestSkill: string | null = null,
    bestLvl = 0;
  // Sept 2026 (Toby): the realm's thin craft skills (Sage first, then Spy / Thief / Explorer) outrank a
  // strong fighting mentor while fewer than two characters hold them at 2+, so a court cross-trains
  // Sage rather than converging on Melee every year. Deterministic from realm state, so every member
  // of the cluster still picks the same focus.
  const NEED_SKILLS: Readonly<Record<string, number>> = { sage: 3, spy: 2, thief: 2, explorer: 2 };
  const need: Partial<Record<string, number | undefined>> = {};
  Object.keys(NEED_SKILLS).forEach((k) => {
    const n = theCharactersOf(G).filter(
      (x) => x?.alive && x.player === pi && (Number(theSkillsByName(x)[k]) || 0) >= 2,
    ).length;
    need[k] = n < 2 ? NEED_SKILLS[k] : 0;
  });
  for (const sk of SKILLS) {
    let mx = 0,
      mn = 99;
    group.forEach((x) => {
      const l = Number(theSkillsByName(x)[sk]) || 0;
      if (l > mx) mx = l;
      if (l < mn) mn = l;
    });
    // A worthwhile focus: someone can teach it (mx≥1) and someone below can still learn (mn<mx,
    // mn<5).
    const score = mx + (need[sk] ?? 0) + (BOT_SCHOOLS.includes(sk) ? 1 : 0); // 2026-09-28 (Toby: especially magic) — a school outranks a craft or weapon of the same level
    if (mx >= 1 && mn < mx && mn < 5 && score > bestLvl) {
      bestLvl = score;
      bestSkill = sk;
    }
  }
  return bestSkill;
}
// TITLE STRATEGY. The throne (winning) is pursued by runBotReckoning; on top of that each bot picks
// 2-3 MAIN titles to chase, drawn from its roster's aptitudes, and biases which skills it drills
// toward them. Most of the merit already flows from the aggressive play elsewhere (fighting → Grand
// Marshal, lair-raiding → Monster-Bane, exploring → Loremaster, casting → Archmage); this just points a
// bot's *training* at its chosen prizes so it leans into them. Decided once and cached for
// stability.
export function botTargetTitles(G: GameState, pi: number): string[] {
  const p = G.players[pi];
  if (!p) return [];
  // Sept 2026 (review II A6): recomputed every turn from the standings the reports publish — a title we hold is
  // defended, a title whose holder's merit our best character already reaches 60% of is chased; only the
  // skill-based fallback below remains for a realm with no standings yet. Roles read the picks (botSpecialistRoles).
  const cache = botTurnCache(G);
  cache.titles ??= {};
  const held = cache.titles[pi];
  if (held) return held;
  try {
    const st = asItsGuardReadsIt(computeStandings(G).titles) ?? {};
    const mine = theCharactersOf(G).filter((c): c is Character => c != null && c.alive && c.player === pi);
    const picks: [string, number][] = [];
    TITLE_DEFS.forEach((t) => {
      if (t.kingdomLevel) return;
      const h = st[t.key];
      if (!h) return;
      if (h.playerIndex === pi) {
        picks.push([t.key, 3]);
        return;
      }
      let best = 0;
      mine.forEach((c) => {
        try {
          const merits: Readonly<Partial<Record<string, number>>> = _charTitleMerit(c);
          const m = Number(merits[t.key]) || 0;
          if (m > best) best = m;
        } catch {
          // a hero whose merit can't be counted counts for none
        }
      });
      const ratio = h.merit > 0 ? best / h.merit : best > 0 ? 1 : 0;
      if (ratio >= 0.6) picks.push([t.key, ratio]);
    });
    if (picks.length) {
      const out = picks
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((x) => x[0]);
      cache.titles[pi] = out;
      p._botTitles = out;
      return out;
    }
  } catch {
    // standings that can't be counted leave the skill-based choice below
  }
  if (p._botTitles) {
    cache.titles[pi] = p._botTitles;
    return p._botTitles;
  }
  let magic = 0,
    combat = 0,
    naval = 0,
    sage = 0,
    spy = 0,
    expl = 0;
  theCharactersOf(G)
    .filter((c): c is Character => c?.player === pi)
    .forEach((c) => {
      const s = asItsGuardReadsIt(c.skills) ?? {};
      magic +=
        (Number(s.white) || 0) +
        (Number(s.psychic) || 0) +
        (Number(s.illusory) || 0) +
        (Number(s.elemental) || 0) +
        (Number(s.necromancy) || 0);
      combat += (Number(s.melee) || 0) + (Number(s.tactical) || 0) + (Number(s.march) || 0) + (Number(s.archery) || 0);
      naval += Number(s.naval) || 0;
      sage += Number(s.sage) || 0;
      spy += Number(s.spy) || 0;
      expl += Number(s.explorer) || 0;
    });
  // the four new titles join the bot's candidate list. `explore` no longer stands for the
  // Loremaster alone \u2014 Sage and Explorer are now separate prizes \u2014 so each is weighed on
  // its own skill. The beast titles are deed-only and are not chased by training, so they are
  // absent here.
  const cand: [string, number][] = [
    ['marshal', combat + 5],
    ['monster', combat + 2],
    ['arch', magic * 2],
    ['lore', sage * 2],
    ['sea', naval * 2],
    ['spy', spy * 2],
    ['carto', expl * 2],
  ];
  cand.sort((a, b) => b[1] - a[1]);
  const picks = cand
    .filter((x) => x[1] > 0)
    .slice(0, 3)
    .map((x) => x[0]);
  p._botTitles = picks.length ? picks : ['marshal', 'monster'];
  return p._botTitles;
}
export function botTitleFocusSkill(c: Character, titles: readonly string[] | null | undefined) {
  const sk = theSkillsByName(c);
  // Re-bias among skills the character ALREADY has (≥1, still trainable) toward a target title —
  // never starts a new skill from scratch (that stays with botPracticeSkill's own fallback), so a
  // maxed or non-matching character simply returns null and the normal practice/explore order is
  // preserved.
  const pickHighest = (list: readonly string[]) => {
    let best: string | null = null,
      bl = 0;
    for (const k of list) {
      const v = Number(sk[k]) || 0;
      if (v >= 1 && v < 5 && v > bl) {
        bl = v;
        best = k;
      }
    }
    return best;
  };
  for (const t of titles ?? []) {
    if (t === 'arch') {
      const m = pickHighest(['elemental', 'necromancy', 'psychic', 'white', 'illusory']);
      if (m) return m;
    } // tie-break ORDER — deliberately not KC_MAGIC_SCHOOLS
    if (t === 'marshal' || t === 'monster') {
      const m = pickHighest(['melee', 'tactical', 'march', 'archery']);
      if (m) return m;
    }
    if (t === 'lore') {
      const m = pickHighest(['sage']);
      if (m) return m;
    }
    if (t === 'sea') {
      const m = pickHighest(['naval']);
      if (m) return m;
    }
    if (t === 'spy') {
      const m = pickHighest(['spy']);
      if (m) return m;
    }
    if (t === 'carto') {
      const m = pickHighest(['explorer']);
      if (m) return m;
    }
  }
  return null;
}
// LAIR RAIDING. A lair's guardian is a personal-combat monster ({hp, power}); clearing it yields
// its gold hoard and Monster-Bane merit and toughens the hero — but a hero can DIE, so bots need a
// real winnability gate (prior sessions staged Search for exactly this reason). botCanBeatGuardian
// rates the hero (max HP + combat skills) against the guardian (HP + a power-tier surcharge) and
// demands a clear 1.5× edge. This encodes "know the difficulty of lairs" and ties to item 1: as a
// hero cross- trains up, ever-tougher guardians come within reach. botBeatableLair returns the
// richest beatable, uncleared, non-ritual lair standing in the hero's own province.
export function botCanBeatGuardian(
  c: Character,
  m: ProvinceFeature['monster'] | undefined,
  G?: GameState | null,
  pi?: number | null,
  f?: ProvinceFeature | null,
) {
  if (!m) return true;
  // Sept 2026 (Toby): a lair is entered on a bought rumour rating the hero "almost certain" (80%+), never on
  // the old skill heuristic alone. Callers passing the feature get the rumour test; the heuristic below stays
  // only as the pre-filter for whom to send to buy a rumour.
  if (G && f) {
    const r = botRumourFor(G, pi, c, f);
    return Number(r?.band) >= 101;
  } // no guardian → trivially clearable
  const sk = asItsGuardReadsIt(c.skills) ?? {};
  // don't send heroes into lairs until they're real fighters: require melee 3 OR archery 3 before
  // attempting ANY guardian. (Softer combat-skill≥1 was letting fresh heroes die.)
  if ((Number(sk.melee) || 0) < 3 && (Number(sk.archery) || 0) < 3) return false;
  const battleMagic = (Number(sk.elemental) || 0) + (Number(sk.necromancy) || 0) + (Number(sk.psychic) || 0); // can also blast the monster in the encounter
  const POWER: Readonly<Partial<Record<string, number>>> = {
    '': 0,
    Weak: 0,
    Moderate: 12,
    Powerful: 28,
    Legendary: 44,
  }; // skills on the 1–9 ladder + passives — demand more of a bot hero
  const monRating = (m.hp || 10) + (POWER[m.power] ?? 0);
  const charRating =
    (c.maxHp || 20) +
    (Number(sk.melee) || 0) * 6 +
    (Number(sk.tactical) || 0) * 3 +
    (Number(sk.archery) || 0) * 2 +
    battleMagic * 4;
  return charRating >= monRating * 1.5; // conservative — demand a clear edge (deaths are permanent)
}
export function botBeatableLair(G: GameState, c: Character) {
  return botBeatableLairIn(G, c, G.world.provinces[c.location]);
}
// only lairs this realm has DISCOVERED are candidates, and they are ranked by the guardian's danger
// rather than by the hoard inside — the size of a hoard is not something a player knows before
// opening the chest, and bots were sorting the world's treasure by value. The index returned is
// still the index into prov.features, which is what the Search order expects.
export function botBeatableLairIn(G: GameState, c: Character, prov: Province | null | undefined) {
  const features: readonly (ProvinceFeature | null | undefined)[] | null | undefined = asItsGuardReadsIt(
    prov?.features,
  );
  if (!prov || !features) return -1;
  const pi = asItsGuardReadsIt(c)?.player ?? null;
  let bestIdx = -1,
    bestRating = -1;
  features.forEach((f, idx) => {
    if (!f || f.cleared || f.ritualSite) return;
    if (pi != null && !featDiscovered(f, pi)) return; // not on this realm's map
    if (!botCanBeatGuardian(c, f.monster, G, pi, f)) return; // no rumour rating this hero 80%+ yet
    const POWER_RANK: Readonly<Partial<Record<string, number>>> = { ...GUARDIAN_POWER_RANK };
    const rating = POWER_RANK[f.monster?.power ?? ''] ?? 0; // the guardian's power band IS public once discovered
    if (rating > bestRating) {
      bestRating = rating;
      bestIdx = idx;
    }
  });
  return bestIdx;
}
export function runBotActions(G: GameState, botIdxSet: ReadonlySet<number> | null | undefined) {
  if (!botIdxSet?.size || !asItsGuardReadsIt(G.world)) return;
  G.turnOrders = asItsGuardReadsIt(G.turnOrders) ?? {};
  // Sept 2026 (bot strategy): a character is "fillable" if it is not marching this turn — its
  // remaining Hold phases (after any phase-0 hire / recruit / garrison / hand-over muster orders)
  // get real work.
  const MUSTER = new Set(['hire', 'recruit', 'leave_army']);
  const isFillable = (c: Character) => {
    const o = theTurnsOrders(G)[c.id];
    return !o || o.every((x) => x == null || x.action === 'defend' || MUSTER.has(x.action) || botIsTeach(x));
  }; // teaching phases kept (overlay only fills null / Hold)
  // Overlay a 5-phase plan onto the free (null / Hold) phases, in order, keeping muster orders in
  // place.
  const overlay = (cid: number, plan: readonly PhaseOrder[]) => {
    const o = theTurnsOrders(G)[cid] ?? [null, null, null, null, null];
    let k = 0;
    for (let p = 0; p < 5 && k < plan.length; p++) {
      const held = o[p];
      if (held == null || held.action === 'defend') {
        o[p] = { ...theOrderOfThePlan(plan, k++) };
      }
    }
    theTurnsOrders(G)[cid] = o;
  };
  const fill = (cid: number, order: PhaseOrder) => {
    overlay(
      cid,
      [0, 1, 2, 3, 4].map(() => ({ ...order })),
    );
  };
  botIdxSet.forEach((pi) => {
    if (botConceded(G, pi)) return; // a conceded realm only ever Defends
    theCharactersOf(G)
      .filter((c): c is Character => c != null && c.alive && c.player === pi && !c._isHeir && isFillable(c))
      .forEach((c) => {
        const maxHp = c.maxHp || 20,
          hp = asItsGuardReadsIt(c.hp) ?? maxHp;
        if (hp < maxHp * 0.6) {
          fill(c.id, { action: 'rest', target: '', extra: '', desc: 'Rest & heal' });
          return;
        }
        // a commander of a host (5+ land/air units) always drills it: Practice Tactical raises the
        // skill AND promotes unit quality (and at Tactical 5 still drills). 3-4 units: drill too
        // unless the co-located cross-training group is converging on a different skill (mentor gains
        // are guaranteed).
        const _landUnits = theUnitsWithGapsOf(c).filter(
          (a) => a != null && !BOT_SEA_ALL.has(a.type) && !a._isSkeletal,
        ).length;
        const _drillPick =
          _landUnits >= 5
            ? 'tactical'
            : _landUnits >= 3 && (Number(asItsGuardReadsIt(c.skills)?.tactical) || 0) < 5
              ? 'tactical'
              : null;
        // Action-phase spells: the full ordered cast plan (offence, buffs, defence, resurrection,
        // economy) fills the free phases; whatever remains is practice / research / exploration.
        const _castPlan = botCastPlan(G, pi, c, G.world.provinces[c.location], { max: 4 });
        const castOrder = _castPlan[0] ?? null;
        const OFFENSIVE_CAST = new Set([
          theNameOfTheSpell('curse'),
          theNameOfTheSpell('psychic-blast'),
          theNameOfTheSpell('earthquake'),
          theNameOfTheSpell('plague'),
          theNameOfTheSpell('flood'),
          theNameOfTheSpell('telekinetic-storm'),
          theNameOfTheSpell('charm'),
        ]);
        // Sept 2026: discoveries now come from the Research order, not Practice Sage. A bot scholar
        // (Sage 1+) whose pick is Sage researches instead — always once Sage is maxed at 5, otherwise
        // half the time, so the skill still grows.
        const botSageOrResearch = (sk: string | null | undefined): PhaseOrder => {
          const sg = Number(asItsGuardReadsIt(c.skills)?.sage) || 0;
          if (sk === 'sage' && sg >= 1 && (sg >= 5 || kcRng() < 0.5))
            return { action: 'research', target: '', extra: '', desc: 'Research' };
          return sk
            ? { action: 'practice', target: sk, extra: '', desc: 'Practice ' + theLabelOf(sk) }
            : { action: 'defend', target: '', extra: '', desc: 'Hold' };
        };
        // 2026-09-26 (Toby item 1): unmapped ground under a character who is standing still is explored before any
        // practice — Practice is the last resort, not the default (a host's commander still drills it).
        const _here = G.world.provinces[c.location];
        const _exploreHere =
          _landUnits < 3 &&
          !botRoleTrainSkill(c) &&
          _here &&
          _here.terrain !== 'sea' &&
          (_here.owner === pi || _here.owner == null) &&
          (Number(_here.exploredBy?.[pi]) || 0) < 100
            ? { action: 'explore', target: '', extra: '', desc: 'Explore ' + _here.name }
            : null;
        const practiceTail = () => {
          if (_exploreHere) return { ..._exploreHere };
          const sk =
            ((_landUnits >= 5 ? 'tactical' : null) ?? '') ||
            (botRoleTrainSkill(c) ?? '') ||
            (botCrossTrainSkill(G, c, pi) ?? '') ||
            (_drillPick ?? '') ||
            (botTitleFocusSkill(c, botTargetTitles(G, pi)) ?? '') ||
            botPracticeSkill(c);
          return botSageOrResearch(sk);
        };
        // Offensive casts fire first — hexing a nearby enemy beats anything peaceful.
        if (castOrder && OFFENSIVE_CAST.has(castOrder.target)) {
          const tail = practiceTail();
          overlay(c.id, [..._castPlan, { ...tail }, { ...tail }, { ...tail }, { ...tail }].slice(0, 5));
          return;
        }
        // the commander of a HOST (5+ land/air units) drills it every spare phase.
        if (_landUnits >= 5) {
          fill(c.id, { action: 'practice', target: 'tactical', extra: '', desc: 'Practice Tactical (drill the host)' });
          return;
        }
        // raid a beatable lair standing here (hoard + permanent strength) before low-value
        // self-buffs.
        const li = botBeatableLair(G, c);
        if (li >= 0) {
          const tail = practiceTail();
          overlay(c.id, [
            { action: 'search', target: String(li), extra: '', desc: 'Search Lair', prov: c.location },
            { ...tail },
            { ...tail },
            { ...tail },
            { ...tail },
          ]);
          return;
        }
        if (castOrder) {
          const tail = practiceTail();
          overlay(c.id, [..._castPlan, { ...tail }, { ...tail }, { ...tail }, { ...tail }].slice(0, 5));
          return;
        }
        if (_exploreHere) {
          fill(c.id, _exploreHere);
          return;
        }
        const skill =
          (botRoleTrainSkill(c) ?? '') ||
          (botCrossTrainSkill(G, c, pi) ?? '') ||
          (_drillPick ?? '') ||
          (botTitleFocusSkill(c, botTargetTitles(G, pi)) ?? '') ||
          botPracticeSkill(c);
        if (skill) {
          fill(c.id, botSageOrResearch(skill));
          return;
        }
        const prov = G.world.provinces[c.location];
        const mapped = prov?.exploredBy ? Number(prov.exploredBy[pi]) || 0 : 0;
        if (prov && mapped < 100) {
          fill(c.id, { action: 'explore', target: '', extra: '', desc: 'Explore' });
          return;
        }
        // else: nothing worthwhile — leave the character to the default-to-Defend pass.
      });
  });
}
// ══ SHARED BY THE BOTS' PASSES: a spy's target and a character's five phases ════
// Kept here, below every pass that calls them: war, missions, economy, specialists and movement.
// SPY — a rival's province the realm has seen, within reach; prefer capitals, wealth, war enemies and
// ground not spied lately. Memo of spied provinces lives on the player record (p._botSpyMemo).
export function botSpyTarget(
  G: GameState,
  pi: number,
  c: Character,
  maxD: number,
): { X: Province; d: number; sc: number } | null {
  const from = G.world.provinces[c.location];
  if (!from) return null;
  const memo = (asItsGuardReadsIt(G.players) ?? [])[pi]?._botSpyMemo ?? {};
  let best: { X: Province; d: number; sc: number } | null = null;
  theProvincesOf(G).forEach((X) => {
    if (!X || X.terrain === 'sea' || !botKnows(G, pi, X.id)) return;
    const bo = botBelievedOwner(G, pi, X);
    if (bo == null || bo === pi || botRelationRaw(G, pi, bo) === 'allied') return;
    const d = X.id === from.id ? 0 : botPathLenAny(G, from, X.id, maxD);
    if (d == null) return;
    const b = botBelief(G, pi, X);
    const home = (asItsGuardReadsIt(G.players) ?? [])[bo]?.homeProvinceId === X.id;
    const staleness = Math.min(4, (G.turn || 0) - (Number(memo[X.id]) || -99));
    let gen = 0;
    {
      const I = botEnemyIntel(G, pi);
      Object.values(I.generals).forEach((r) => {
        if (botRelationRaw(G, pi, r.player) !== 'enemy' || (G.turn || 0) - r.turn > 3) return;
        if (r.provId === X.id) gen += 5;
        else
          for (let i = 0; i < 6; i++) {
            const N = botNeighbourProv(G, X, i);
            if (N?.id === r.provId) {
              gen += 2;
              break;
            }
          }
      });
    }
    let unknown = 0;
    const inSight: readonly (Character | null | undefined)[] = botVisibleCharsIn(G, pi, X);
    inSight.forEach((e) => {
      if (e?.player != null && e.player !== pi && botSkillsUnknown(G, pi, e)) unknown += theUnitsOf(e).length ? 4 : 2;
    });
    const sc =
      (Number(b?.tax) || 0) +
      (home ? 4 : 0) +
      (botRelationRaw(G, pi, bo) === 'enemy' ? 6 : 0) +
      staleness * 2 -
      d * 2 +
      gen +
      unknown; // Sept 2026: scout where the enemy's hosts were last seen; learn the skills of whoever stands there
    if (!best || sc > best.sc) best = { X, d, sc };
  });
  return best;
}
// Fill a 5-phase order list: pre-orders, then moves, then a Defend watch if a phase is spare, then
// the character's practice fallback — drilling a host, else the skill most worth training (with
// co-located partners when possible, toward the drill cap of 5). Practice is always secondary: it
// only ever fills phases nothing else claimed.
export function botPracticeFallback(
  G: GameState,
  pi: number,
  c: Character,
  opts?: { readonly moving?: boolean } | null,
) {
  const drill = botDrillOrder(G, pi, c);
  if (drill) return drill;
  {
    const rs = botRoleTrainSkill(c);
    if (rs)
      return {
        action: 'practice',
        target: rs,
        extra: '',
        desc: 'Practice ' + theLabelOf(rs) + ' (' + (c._botRole === 'admiral' ? 'admiral' : 'flying general') + ')',
      };
  }
  // 2026-09-26 (Toby item 1): Practice is the LAST resort, not the default. Ground under the character's
  // feet that the realm has not fully mapped is explored first (lairs, features and wanderers come of it).
  // Only for a character standing still this turn — an Explore after a march would land on other ground.
  const P = G.world.provinces[c.location];
  if (
    !opts?.moving &&
    P &&
    P.terrain !== 'sea' &&
    (P.owner === pi || P.owner == null) &&
    (Number(P.exploredBy?.[pi]) || 0) < 100
  )
    return { action: 'explore', target: '', extra: '', desc: 'Explore ' + P.name };
  const sk =
    (botCrossTrainSkill(G, c, pi) ?? '') ||
    (botTitleFocusSkill(c, botTargetTitles(G, pi)) ?? '') ||
    botPracticeSkill(c);
  if (!sk) return null;
  const sg = Number(asItsGuardReadsIt(c.skills)?.sage) || 0;
  if (sk === 'sage' && sg >= 1 && (sg >= 5 || kcRng() < 0.5))
    return { action: 'research', target: '', extra: '', desc: 'Research' };
  return { action: 'practice', target: sk, extra: '', desc: 'Practice ' + theLabelOf(sk) };
}
// Fill a 5-phase order list. Toby 2026-09-10: a Defend watch is set EARLY (phase 0) and only when
// it is needed — other crowns met and a hostile host within 2 hexes — so the general answers an
// incursion at the top of the year and still marches to his attacks afterwards (the engine drops a
// watch the moment a later phase holds a Move). A general with no moves keeps the watch all turn.
// Before this a Defend was tacked on AFTER the moves, and reacting to a neighbour's skirmish
// routinely dragged the main host off its advance.
export function botFillOrders(
  G: GameState,
  pi: number,
  c: Character,
  pre: readonly AnOrderAsThePassesReadIt[],
  moves: readonly AnOrderAsThePassesReadIt[],
) {
  const armed = theUnitsOf(c).length > 0,
    met = botHasMetPlayers(G, pi);
  const watch =
    armed && met && botNearbyThreat(G, pi, c) ? [{ action: 'defend', target: '', extra: '', desc: 'Watch' }] : [];
  const out: AnOrderAsThePassesReadIt[] = (
    moves.length
      ? [...watch, ...pre, ...moves]
      : [...pre, ...(met ? [{ action: 'defend', target: '', extra: '', desc: 'Hold' }] : [])]
  ).slice(0, 5);
  const tail = botPracticeFallback(G, pi, c, {
    moving: out.some((o) => o && (o.action === 'move' || o.action === 'encounter')),
  });
  while (out.length < 5) out.push(tail ? { ...tail } : { action: 'defend', target: '', extra: '', desc: 'Hold' });
  return out;
}
