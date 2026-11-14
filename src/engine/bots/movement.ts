import { THE_ALIGNMENT_ORDERS } from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { heroHireWage } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import {
  BOT_AERIAL_TYPES,
  BOT_CARRIER_TYPES,
  BOT_HEX_DIRS,
  BOT_SEA_ALL,
  botBattleForce,
  botConceded,
  botForceStrength,
  botNeighbourProv,
  botNoteLand,
  botRelationRaw,
  botSeesChar,
  botTargetDefence,
  botTuning,
  botTurnCache,
  botVisibleCharsIn,
} from './intel.ts';
import { botCanFly, botLairDir, botPlanAssaults, botSeaCap } from './war.ts';
import {
  BOT_FLYING_TYPES,
  BOT_NAVAL_TYPES,
  botAssumedChar,
  botAtWar,
  botCoastalFleetType,
  botCoastalPorts,
  botEnemyDefence,
  botFieldRecruitTokens,
  botFlyerPorts,
  botFrontierTarget,
  botGarrisonOrder,
  botHeroCap,
  botHireBias,
  botHireOrder,
  botHomeId,
  botIsValuable,
  botLandReach,
  botLedger,
  botLiftable,
  botMoveOrder,
  botNearbyThreat,
  botPassable,
  botPathDirs,
  botPathLen,
  botRaiseTargets,
  botRecruitOrder,
  botRoles,
  botSchoolLimit,
  botSeaReach,
  botSpend,
  botUnderAttack,
} from './strategy.ts';
import {
  botChainHops,
  botDefenderOrders,
  botDefenderPost,
  botDistantStrike,
  botHomeThreat,
  botRoamOrders,
  botRoleWork,
  botScanTargets,
  botSpecialistOrders,
  botSpecialistRoles,
  botZoneOf,
} from './specialists.ts';
import {
  BOT_INFILTRATE_RANGE,
  botAirReach,
  botAirStrike,
  botConsecrateTarget,
  botInfiltrateOrders,
  botInfiltrateSchool,
  botItemPre,
  botLairPlan,
  botMasteryPre,
  botNearestOf,
  botOnlySkeletal,
  botOrphanHostOrders,
  botRitePre,
  botRunSlayerSchool,
  botSeaStrike,
  botSetDuelStances,
  botSignaturePre,
  botSpareBerths,
} from './missions.ts';
import {
  botBeatableLairIn,
  botCastPlan,
  botFillOrders,
  botHuntTarget,
  botOffensiveMagic,
  botPathAny,
  botPathLenAny,
  botPlannedAttackTarget,
  botPracticeFallback,
  botRaidTarget,
} from './spellcraft.ts';
import { theNameOfTheSpell } from './the-name-of-a-spell-by-its-slug.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { PhaseOrder } from '../../schemas/orders-a-realm-submits.ts';
import type { Army, Character, GameState, Province } from '../../schemas/saved-game-state.ts';
import type { ABotRealmsRoles } from './intel.ts';

// Its types (plan P1-10b47): each parameter typed as wide as the body's guards, so each guard stays.
/** A phase's order as the passes read a plan: an order, or a gap the plan holds. */
type AnOrderAsThePassesReadIt = PhaseOrder | null | undefined;
/** The turn's orders as the passes read them, by hero (G.turnOrders). */
type TheTurnsOrdersAsThePassesHoldThem = Partial<Record<string, AnOrderAsThePassesReadIt[]>>;
/** A duel's forecast (`duelSim`): the odds of a kill and of being felled. */
interface ADuelsForecast {
  readonly win: number;
  readonly felled: number;
}
/** What the turn hands the bots' march: the engine's duel forecast on copies of both heroes, and its unit×terrain
 *  figure. */
interface TheMarchsHooks {
  readonly duelSim?:
    ((hero: Character, foe: Character, rounds: number) => ADuelsForecast | null | undefined) | undefined;
  readonly terrainMult?: ((armyType: string, terrain: string) => unknown) | undefined;
}
/** A hero's skills by name, where the code reads them as if they may be missing. */
type TheSkillsByName = Character['skills'] & Readonly<Partial<Record<string, number>>>;
/** The turn's orders, where the code tests a hero's plan for a gap. */
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
/** A hero's units, where the code tests the list for a gap. */
function theUnitsWithGapsOf(c: Character): readonly (Army | null | undefined)[] {
  return asItsGuardReadsIt(c.armies) ?? [];
}
/** A province's units it recruits, where the code reads them as if they may be missing. */
function theArmyTypesOf(X: Province): readonly (string | null | undefined)[] {
  return asItsGuardReadsIt(X.armyTypes) ?? [];
}
/** The heroes standing in a province, by id, where the code reads the list as if it may be missing. */
function theHeroesStandingIn(X: Province): readonly number[] {
  return asItsGuardReadsIt(X.characters) ?? [];
}
/** A province's garrison, where the code reads it as if it may be missing. */
function theGarrisonOf(X: Province): readonly Army[] {
  return asItsGuardReadsIt(X.garrisonArmies) ?? [];
}
/** A hero's skills by name, where the code reads them as if they may be missing. */
function theSkillsOf(c: Character): TheSkillsByName {
  return { ...asItsGuardReadsIt(c.skills) };
}
/** A hero's hit points, where the code reads them as if they may be missing (his most, else 20). */
function theHitPointsOf(c: Character): number {
  return asItsGuardReadsIt(c.hp) ?? (c.maxHp || 20);
}
/** A move along a path botPathDirs found, whose steps may hold a gap: a gap reads no way, as `BOT_HEX_DIRS[undefined]`
 *  did (`-1` names none either). */
function aMoveOrderOnThePath(d: number | undefined, desc: string) {
  return botMoveOrder(d ?? -1, desc);
}
/** The province a threat to the capital stands in (botHomeThreat found it there): one off the map throws the
 *  `TypeError` the read of its neighbours threw. */
function theProvinceOfTheThreat(G: GameState, provId: number): Province {
  const TP = G.world.provinces[provId];
  if (!TP) throw new TypeError('no province ' + String(provId) + ' for the threat to the capital');
  return TP;
}
/** A realm's alignment, else Neutral (a realm off the list reads as one of none). */
function theAlignmentOf(G: GameState, pi: number): string {
  return (G.players[pi]?.alignment ?? '') || 'Neutral';
}

// ══ RAISE THE FALLEN (2026-09-28, Toby: bots with white mages resurrect their heroes) ════
// Before any other plan, each body the realm may raise — one of ITS OWN fallen heroes whose death it knows of (never
// one who served another realm; the engine refuses those too), or its most recently fallen MONARCH (the engine lets
// only his own realm recall him; the regent steps down) — gets the nearest white mage (White 1+, not a general with
// a host, not badly hurt). He walks there through our own / unowned land (a monarch's body lies at the home or the
// richest held province) and casts Resurrect on that body as often as his White allows in the phases left — a
// second cast only matters if the first fizzles (the engine allows one raise per body per turn). A body more than
// four hops away is walked toward over several years (up to eight hops). Richest bodies first: the king, then by skill.
// botRaiseTargets (the bodies this realm may raise) is in bots/strategy.ts; botResurrectErrands, below, sends the mages.
export function botResurrectErrands(
  G: GameState,
  pi: number,
  all: readonly Character[],
  roles: ABotRealmsRoles,
  assigned: Set<number>,
) {
  const targets = botRaiseTargets(G, pi);
  if (!targets.length) return;
  const cache = botTurnCache(G);
  const D = (cache.raiseDiag = cache.raiseDiag ?? []);
  targets.forEach(({ g, loc }) => {
    const X = G.world.provinces[loc];
    if (!X || X.terrain === 'sea') return;
    let best: { c: Character; path: (number | undefined)[] } | null = null;
    for (const c of all) {
      if (assigned.has(c.id) || c._isHeir || (Number(theSkillsOf(c).white) || 0) < 1) continue;
      if (roles.leaders.includes(c.id) && theUnitsWithGapsOf(c).length) continue; // a general with a host keeps to the war
      const hp = theHitPointsOf(c);
      if (hp < (c.maxHp || 20) * 0.5) continue;
      const P = G.world.provinces[c.location];
      if (!P) continue;
      const path = P.id === X.id ? [] : botPathDirs(G, pi, P, X.id, 8, true);
      if (!path || path.length > 8) continue;
      if (!best || path.length < best.path.length) best = { c, path };
    }
    if (!best) {
      D.push({ pi, grave: g.id, monarch: !!g._monarch, mage: null });
      return;
    }
    const c = best.c;
    const mv: AnOrderAsThePassesReadIt[] = [];
    best.path.slice(0, 5).forEach((d) => mv.push(aMoveOrderOnThePath(d, 'To raise ' + g.name)));
    if (best.path.length <= 4) {
      const casts = Math.min(botSchoolLimit(Number(theSkillsOf(c).white) || 0), 5 - mv.length);
      for (let i = 0; i < casts; i++)
        mv.push({
          action: 'cast_spell',
          target: theNameOfTheSpell('resurrect'),
          extra: String(g.id),
          desc: 'Resurrect ' + g.name,
        });
    }
    theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, [], mv);
    assigned.add(c.id);
    D.push({ pi, grave: g.id, monarch: !!g._monarch, mage: c.id, hops: best.path.length });
  });
}
export function runBotMovement(
  G: GameState,
  botIdxSet: ReadonlySet<number> | null | undefined,
  hooksHanded: TheMarchsHooks | null | undefined,
) {
  const hooks = hooksHanded ?? {};
  if (!botIdxSet?.size || !asItsGuardReadsIt(G.world)) return;
  G.turnOrders = asItsGuardReadsIt(G.turnOrders) ?? {};
  if (typeof hooks.terrainMult === 'function') botTurnCache(G).terrainMult = hooks.terrainMult; // the engine's unit×terrain figure, for botBattleForce
  botIdxSet.forEach((pi) => {
    if (botConceded(G, pi)) return; // a conceded realm only ever Defends
    const T = botTuning(G, pi); // per-realm overlays (alignment / race)
    botSetDuelStances(G, pi, hooks.duelSim); // Sept 2026 (Toby): duel by judgement, not temper
    botNoteLand(G, pi); // expansion-pressure bookkeeping (once per turn)
    const L = botLedger(G, pi),
      roles = botRoles(G, pi);
    const all = theCharactersOf(G).filter((c): c is Character => c != null && c.alive && c.player === pi && !c._isHeir);
    const chars = all.filter((c) => theUnitsWithGapsOf(c).length > 0);
    const assigned = new Set<number>();
    botPlanAssaults(G, pi, chars, assigned); // concentrated assaults (gang up on strong provinces)
    // 2026-09-28: the ADMIRAL and the FLYING GENERAL plan first, so their hulls / flyers are bought before the
    // land general's muster spends the year's gold (the study found them at port with no money 2 years in 3).
    const _rolePri = (c: Character) => (c._botRole === 'admiral' || c._botRole === 'skygeneral' ? 0 : 1);
    const leaders = all.filter((c) => roles.leaders.includes(c.id)).sort((a, b) => _rolePri(a) - _rolePri(b));
    const leaderAt = (provId: number) => leaders.find((l) => l.location === provId) ?? null;
    const homeId = botHomeId(G, pi);
    const homeThreat = botHomeThreat(G, pi);
    const heroClaimed = new Set<number>(); // one seeker per wandering hero
    // ── COMPANIONS: every general leading a host gets an unarmed hero at his side —
    // ideally a mage, who casts offensive / supporting / defensive spells for him in the early phases
    // and then follows a phase behind. A co-located companion is also the natural recipient when a
    // grown host splits. One companion per general, the biggest host choosing first; scored on magic
    // (×3) minus distance, within 6 hops through any land. ──
    const magicScore = (x: Character) => {
      const s = theSkillsOf(x);
      return (
        (Number(s.elemental) || 0) +
        (Number(s.necromancy) || 0) +
        (Number(s.psychic) || 0) +
        (Number(s.illusory) || 0) +
        (Number(s.white) || 0)
      );
    };
    const escortOf: Partial<Record<number, Character>> = {}; // companion id → the general it escorts
    const defCovered = new Set<number>(); // provinces a field host or a posted defender already guards
    leaders.forEach((l) => {
      if (theUnitsWithGapsOf(l).length >= 3) defCovered.add(l.location);
    });
    {
      const spare = all.filter(
        (x) =>
          !roles.leaders.includes(x.id) &&
          !theUnitsWithGapsOf(x).length &&
          !x.isKing &&
          !roles.defenders.includes(x.id),
      );
      leaders
        .filter((l) => theUnitsWithGapsOf(l).length > 0)
        .sort((a, b) => theUnitsWithGapsOf(b).length - theUnitsWithGapsOf(a).length)
        .forEach((l) => {
          let best: { h: Character; sc: number } | null = null;
          for (const h of spare) {
            if (escortOf[h.id] != null) continue;
            const d = h.location === l.location ? 0 : botPathLenAny(G, G.world.provinces[h.location], l.location, 6);
            if (d == null) continue;
            const sc = magicScore(h) * 3 - d;
            if (!best || sc > best.sc) best = { h, sc };
          }
          if (best) escortOf[best.h.id] = l;
        });
    }
    const spec = botSpecialistRoles(G, pi, new Set(Object.keys(escortOf).map(Number))); // scholar / scout / spy / thief
    // Feeders and unarmed characters are planned after the leaders so a leader's muster claims the
    // province's recruit slots first.
    botResurrectErrands(G, pi, all, roles, assigned); // 2026-09-28 (Toby): white mages raise the realm's fallen first
    const ordered = [...leaders, ...all.filter((c) => !roles.leaders.includes(c.id))];
    ordered.forEach((c) => {
      if (assigned.has(c.id)) return;
      const P = G.world.provinces[c.location];
      if (!P) return;
      const isLeader = roles.leaders.includes(c.id);
      const armed = theUnitsWithGapsOf(c).length > 0;
      const pre = [];
      const hire = botHireOrder(G, pi, c, L);
      if (hire) pre.push(hire);
      // Sept 2026 (review R10): a king under 75% health with no host on the doorstep rests the year out.
      if (c.isKing && !homeThreat && !botUnderAttack(G, pi)) {
        const _khp = theHitPointsOf(c),
          _kmhp = c.maxHp || 20;
        if (_khp < _kmhp * 0.75) {
          const o = [...pre];
          while (o.length < 5) o.push({ action: 'rest', target: '', extra: '', desc: 'Rest & heal (the crown)' });
          theTurnsOrders(G)[c.id] = o;
          assigned.add(c.id);
          return;
        }
      }
      // Sept 2026 (review R2): the alignment's signature order, where it applies here and now.
      {
        const sig = botSignaturePre(G, pi, c, P, L);
        if (sig) pre.push(sig);
      }
      {
        const ip = botItemPre(G, pi, c, roles);
        if (ip && pre.length < 2) pre.push(ip);
      } // Sept 2026 (review R3): kit
      // ── INFILTRATOR: a Necromancy / Elemental caster who is not running a
      // field army goes behind the enemy line and conjures a host in undefended ground, taking the
      // province outright. Unarmed he ranges the full 5 hops; carrying skeletons he raised himself he
      // only steps to an ADJACENT undefended province (an armed column marching into defended ground
      // would have to fight, and this force cannot). Ranked ahead of companion/feeder duty because
      // taking provinces is the bot's whole purpose. ──
      if (!isLeader && !c.isKing && !c._isHeir) {
        const _infSchool = !armed || botOnlySkeletal(c) ? botInfiltrateSchool(c) : null;
        if (_infSchool) {
          const _inf = botInfiltrateOrders(G, pi, c, pre, _infSchool, armed ? 1 : BOT_INFILTRATE_RANGE);
          if (_inf) {
            theTurnsOrders(G)[c.id] = _inf;
            assigned.add(c.id);
            return;
          }
        }
      }
      // ── DEFENDER: hold a post whose watch covers the most unguarded owned land (Sept 2026, Toby). ──
      if (!isLeader && !c.isKing && roles.defenders.includes(c.id)) {
        const post = botDefenderPost(G, pi, c, defCovered);
        if (post) c._botPost = post.X.id;
        const dO = botDefenderOrders(G, pi, c, pre, post, L);
        if (dO) {
          const at = post?.d === 0 ? post.X : P;
          botZoneOf(G, at).forEach((q) => defCovered.add(q.id));
          theTurnsOrders(G)[c.id] = dO;
          assigned.add(c.id);
          return;
        }
      }
      // ── FEEDER standing with a leader: hand the whole column over, then drill/hold. ──
      if (!isLeader && armed) {
        const ld = leaderAt(c.location);
        if (ld) {
          theTurnsOrders(G)[c.id] = botFillOrders(
            G,
            pi,
            c,
            [...pre, { action: 'leave_army', target: 'all', extra: String(ld.id), desc: 'Hand column to ' + ld.name }],
            [],
          );
          assigned.add(c.id);
          return;
        }
      }
      // ── SPLIT: a leader whose column has grown well past the
      // front line (terrain width ≤6, the rest fight at ×0.5) hands the weaker half to an unarmed
      // character standing here, who holds and drills it this year and marches it as a second host
      // next year (botRoles makes any holder of ≥3 units a leader). Two fronts, one battle per phase
      // each — the single mega-stack was conquering one province a turn with 16 units in reserve. ──
      if (isLeader && armed && theUnitsWithGapsOf(c).length >= (roles.defenders.length ? 8 : 10)) {
        // Sept 2026: an unarmed DEFENDER standing here takes the column first (it is his post's
        // garrison); otherwise a mage stays the general's companion and a fighter takes it.
        const rcpt = all
          .filter(
            (o) =>
              o.id !== c.id &&
              o.location === c.location &&
              !theUnitsWithGapsOf(o).length &&
              !assigned.has(o.id) &&
              !heroClaimed.has(o.id) &&
              (theTurnsOrders(G)[o.id] ?? []).every((x) => x == null),
          )
          .sort(
            (a, b) =>
              (roles.defenders.includes(a.id) ? -100 : 0) +
              magicScore(a) -
              ((roles.defenders.includes(b.id) ? -100 : 0) + magicScore(b)),
          )[0];
        if (rcpt) {
          const ranked = theUnitsWithGapsOf(c)
            .filter((a): a is Army => a != null && !a._isSkeletal && !BOT_SEA_ALL.has(a.type))
            .map((a) => ({ a, v: unitBaseStrength(a) }))
            .sort((x, y) => x.v - y.v);
          const give = ranked.slice(0, Math.floor(theUnitsWithGapsOf(c).length / 2)).map((x) => x.a);
          if (give.length >= 3) {
            pre.push({
              action: 'leave_army',
              target: give.map((a) => a.unitName || a.type).join(','),
              extra: String(rcpt.id),
              desc: 'Split the host — ' + String(give.length) + ' units to ' + rcpt.name,
            });
            const proxy = { ...rcpt, armies: give };
            theTurnsOrders(G)[rcpt.id] = botFillOrders(
              G,
              pi,
              proxy,
              [{ action: 'defend', target: '', extra: '', desc: 'Hold' }],
              [],
            );
            assigned.add(rcpt.id);
          }
        }
      }
      // ── MUSTER before marching: a leader raises field troops where it stands; anyone leaves a
      // single-unit garrison behind (only when the march still keeps at least 2 hops). ──
      let recruitTypes: string[] = [];
      if (P.owner === pi) {
        if (isLeader) {
          const toks = botFieldRecruitTokens(G, pi, c, P, L);
          const ro = botRecruitOrder(toks, null);
          if (ro) {
            pre.push(ro);
            recruitTypes = toks.map((t) => t.split('|')[0] ?? '');
          }
        }
      }
      const reach = Math.min(3, armed ? botLandReach(c, recruitTypes) : 5);
      if (P.owner === pi && 5 - pre.length - 1 >= 2 && reach >= 2) {
        const go = botGarrisonOrder(G, pi, P, L);
        if (go) pre.push(go);
      }
      const maxHops = Math.max(0, Math.min(reach, 5 - pre.length));
      // 2026-09-28: the hops a SEA-GOING column may sail — its ships set the pace, not the foot they carry.
      const seaHops =
        armed && botSeaCap(c.armies) !== 'land' ? Math.max(0, Math.min(3, botSeaReach(c) || reach, 5 - pre.length)) : 0;
      const myStr = botBattleForce(G, c, null, 'plain', undefined); // battle-model strength on open ground (Druid, front line, Tactical)
      // ── UNARMED: chase a wandering hero within 3 hops (hire on arrival); an unarmed LEADER goes
      // home to
      // raise a host; a feeder with nothing to do here walks to a free muster province. ──
      if (!armed) {
        const hp = theHitPointsOf(c),
          mhp = c.maxHp || 20;
        // ── SEEK A WANDERER first — a new hero outranks a
        // turn of escort duty; the recruit becomes the next companion. ──
        let bestH: { h: Character; d: number; de: number } | null = null;
        const _heroesNow = theCharactersOf(G).filter(
          (x) => x?.alive && x.player === pi && !x.isKing && !x._isHeir,
        ).length;
        // ── 2026-09-17: THE WANDERER MUST BE ONE THE REALM CAN SEE. ────
        // (owned ground, a character of ours standing there, or a Spy this turn; never a hero who
        // moved in unspotted or is cloaked), so a bot now only chases wanderers it has actually
        // seen.
        if (_heroesNow < botHeroCap(G, pi))
          for (const h of theCharactersOf(G)) {
            if (!(h?.alive && h.player === null && !h._isNeutralGuard && !h._justDefeated)) continue;
            if (!botSeesChar(G, pi, h)) continue;
            if (heroHireWage(theAlignmentOf(G, pi), h.alignment, false, h) == null) continue;
            if (h.location === c.location || heroClaimed.has(h.id)) continue;
            // seekers walk through neutral country too (an unarmed character is never engaged by a
            // guard), up to 5 hops — the whole of an unarmed character's reach.
            const d = botPathLenAny(G, P, h.location, 5);
            if (d == null) continue;
            const de = d - botHireBias(G, pi, h);
            if (!bestH || de < bestH.de) bestH = { h, d, de };
          }
        if (bestH && maxHops > 0) {
          const wanderer = bestH.h;
          const path = botPathAny(G, P, wanderer.location, 5);
          if (path?.length === bestH.d) {
            heroClaimed.add(wanderer.id);
            const mv = path.map((d) => aMoveOrderOnThePath(d, 'Seek ' + wanderer.name));
            if (pre.length + mv.length < 5)
              mv.push({ action: 'hire', target: String(wanderer.id), extra: '', desc: 'Hire ' + wanderer.name });
            theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, mv);
            return;
          }
        }
        // ── ROAM FOR WANDERERS (2026-09-26, Toby item 5): a court under three heroes sends every hero who is
        // not the general out to find them — no wanderer is in sight, so he walks to the nearest land the
        // realm has never set foot in (wanderers are seen only from where our characters stand) and
        // explores it on arrival. Kings never roam. ──
        if (!c.isKing && !isLeader && _heroesNow < 3 && maxHops > 0) {
          const rm = botRoamOrders(G, pi, c, pre);
          if (rm) {
            theTurnsOrders(G)[c.id] = rm;
            assigned.add(c.id);
            return;
          }
        }
        // ── A LEADERLESS HOST (2026-09-26, Toby): a fallen commander's army garrisoned nearby is taken up by the
        // nearest free hero before anything else he might do this year. ──
        if (!c.isKing && !isLeader && !roles.defenders.includes(c.id)) {
          const oh = botOrphanHostOrders(G, pi, c, pre);
          if (oh) {
            theTurnsOrders(G)[c.id] = oh;
            assigned.add(c.id);
            return;
          }
        }
        // ── An unarmed ADMIRAL walks to the nearest port, an unarmed FLYING GENERAL to the nearest eyrie —
        // that is where each raises his column (2026-09-26, Toby items 6 / 8). ──
        if (c._botRole === 'admiral' || c._botRole === 'skygeneral') {
          const grounds = c._botRole === 'admiral' ? botCoastalPorts(G, pi) : botFlyerPorts(G, pi);
          const g = botNearestOf(G, pi, c, grounds, true);
          if (g && g.d > 0) {
            const path = botPathDirs(G, pi, P, g.X.id, maxHops, true);
            if (path?.length) {
              theTurnsOrders(G)[c.id] = botFillOrders(
                G,
                pi,
                c,
                pre,
                path.map((d) =>
                  aMoveOrderOnThePath(
                    d,
                    (c._botRole === 'admiral' ? 'To the port of ' : 'To the eyrie at ') + g.X.name,
                  ),
                ),
              );
              assigned.add(c.id);
              return;
            }
          }
          if (g?.d === 0) {
            theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, []);
            assigned.add(c.id);
            return;
          } // at his muster ground: recruit (pre) and hold
        }
        // ── COMPANION: stand with the general, cast for him, follow a phase behind. ──
        const gen = escortOf[c.id];
        if (gen && !isLeader) {
          const lo = theTurnsOrders(G)[gen.id] ?? [];
          if (c.location === gen.location) {
            const firstMovePh = (() => {
              const i = lo.findIndex((o) => o?.action === 'move');
              return i < 0 ? 5 : i;
            })();
            const genAttacks = lo.some((o) => o?.action === 'move' && /^(Attack|Assault)/.test(o.desc || ''));
            // Casts: offence on enemies standing here, buffs for the general (only while he is
            // still here — the engine resolves a friendly cast before its co-located target's own
            // move), defence, economy.
            const casts = botCastPlan(G, pi, c, P, {
              max: 3,
              fighting: genAttacks ? gen : null,
              siege: genAttacks ? botPlannedAttackTarget(G, gen) : null,
              threat: botNearbyThreat(G, pi, c),
            })
              .filter((o) => !(genAttacks && o.target === theNameOfTheSpell('flood')))
              .filter((o, i) => o.extra !== String(gen.id) || pre.length + i < firstMovePh); // Sept 2026: a Flood would strand OUR assault too
            // Follow the general's path one phase behind, only into ground that is ours / allied,
            // land he simply walks into, or his first assault when the battle model gives him a 2×
            // edge.
            const follow: PhaseOrder[] = [];
            let cur = P;
            for (const o of lo) {
              if (o?.action !== 'move') continue;
              let N: Province | null | undefined;
              if (o.target.startsWith('dir:')) {
                const d = BOT_HEX_DIRS.indexOf(o.target.slice(4));
                N = botNeighbourProv(G, cur, d);
              } else N = G.world.provinces[+o.target];
              if (!N || N.terrain === 'sea') break;
              const safe =
                N.owner === pi ||
                (N.owner != null && botRelationRaw(G, pi, N.owner) === 'allied') ||
                (follow.length === 0 && (asItsGuardReadsIt(o.desc) ?? '').startsWith('Advance')) ||
                (follow.length === 0 &&
                  /^(Attack|Assault)/.test(o.desc || '') &&
                  botBattleForce(G, gen, null, N.terrain, undefined) >= 2 * botTargetDefence(G, pi, N));
              if (!safe) break;
              follow.push({ ...o, desc: 'Follow ' + gen.name });
              cur = N;
            }
            const lead = [...pre, ...casts];
            const lag = botPracticeFallback(G, pi, c, { moving: follow.length > 0 }) ?? {
              action: 'defend',
              target: '',
              extra: '',
              desc: 'Hold',
            };
            while (follow.length && lead.length < firstMovePh + 1 && lead.length < 5) lead.push({ ...lag });
            theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, lead, follow);
            assigned.add(c.id);
            return;
          } else {
            const path = (botPathAny(G, P, gen.location, 6) ?? [])
              .slice(0, Math.max(0, 5 - pre.length))
              .map((d) => aMoveOrderOnThePath(d, 'Join ' + gen.name));
            if (path.length) {
              theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, path);
              assigned.add(c.id);
              return;
            }
          }
        }
        // ── WAR ROLES for unarmed characters (self-play batch): RAIDER (offensive magic into enemy
        // land),
        // HUNTER (run down a beatable enemy hero), SPY (rifle an enemy capital's archives). Only when at
        // war, only for non-leaders, and only when the target is within reach.
        if (!isLeader && botAtWar(G, pi)) {
          if (hp >= mhp * 0.7) {
            // HUNTER: a beatable enemy hero within 4 hops — Encounter runs the chase over the phases.
            // Hunter tactics (Sept 2026): the quarry must be beatable on the ENGINE's own duel
            // model — runTurn hands in a Monte-Carlo forecast (`hooks.duelSim`) that fights cloned
            // copies with both sides' real plans, items and tempers; the hunt goes ahead only at
            // >=65% wins and <=20% risk of being felled. The rating pre-filter keeps the sim cheap.
            // Hunters also set out only at >=85% health.
            const hunt = hp >= mhp * 0.85 ? botHuntTarget(G, pi, c, 4, hooks.duelSim) : null;
            if (hunt?.mem) {
              const path = (botPathAny(G, P, hunt.loc, 4) ?? []).slice(0, Math.max(0, 4 - pre.length));
              if (path.length) {
                const o = [...pre, ...path.map((d) => aMoveOrderOnThePath(d, 'Stalk ' + hunt.e.name))];
                while (o.length < 5)
                  o.push({ action: 'defend', target: '', extra: '', desc: 'Lie in wait for ' + hunt.e.name });
                theTurnsOrders(G)[c.id] = o;
                assigned.add(c.id);
                return;
              }
            } else if (hunt) {
              theTurnsOrders(G)[c.id] = botFillOrders(
                G,
                pi,
                c,
                [...pre, { action: 'encounter', target: String(hunt.e.id), extra: '', desc: 'Hunt ' + hunt.e.name }],
                [],
              );
              assigned.add(c.id);
              return;
            }
            // RAIDER: walk into enemy land and cast; Invisibility first if the school allows.
            if (botOffensiveMagic(c) >= 1) {
              const raid = botRaidTarget(G, pi, P, 5);
              if (raid) {
                const path = botPathAny(G, P, raid.P.id, 5) ?? [];
                const mv = path
                  .slice(0, Math.max(0, 4 - pre.length))
                  .map((d) => aMoveOrderOnThePath(d, 'Raid ' + raid.P.name));
                let dest = P;
                for (const m of mv) {
                  const d = BOT_HEX_DIRS.indexOf(m.target.slice(4));
                  const N = botNeighbourProv(G, dest, d);
                  if (!N) break;
                  dest = N;
                }
                const inEnemy =
                  dest.owner != null && dest.owner !== pi && botRelationRaw(G, pi, dest.owner) === 'enemy';
                const cloak =
                  inEnemy && (Number(theSkillsOf(c).illusory) || 0) >= 1 && pre.length + mv.length < 5
                    ? [
                        {
                          action: 'cast_spell',
                          target: theNameOfTheSpell('invisibility'),
                          extra: '',
                          desc: 'Cast Invisibility',
                        },
                      ]
                    : [];
                const casts = botCastPlan(G, pi, c, dest, { max: 5 - pre.length - mv.length - cloak.length });
                if (casts.length || mv.length) {
                  theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, [...pre, ...cloak, ...mv, ...casts], []);
                  assigned.add(c.id);
                  return;
                }
              }
            }
            // SPY: an at-war enemy capital holding discoveries we lack, within 5 hops — go and rifle its archives.
            if ((Number(theSkillsOf(c).spy) || 0) >= 2) {
              const mine = new Set((G.players[pi]?.discoveries ?? []).map((d) => d.id));
              let bestK: { hid: number; d: number; name: string } | null = null;
              for (const [j, pl] of theRealmsOf(G).entries()) {
                if (!pl || j === pi || botRelationRaw(G, pi, j) !== 'enemy') continue;
                if (!(pl.discoveries ?? []).some((d) => !mine.has(d.id))) continue;
                const hid = pl.homeProvinceId;
                const H = G.world.provinces[hid];
                if (H?.owner !== j) continue;
                const d = botPathLenAny(G, P, hid, 5);
                if (d == null) continue;
                if (!bestK || d < bestK.d) bestK = { hid, d, name: pl.name };
              }
              if (bestK) {
                const capitalsRealm = bestK.name;
                const path = (botPathAny(G, P, bestK.hid, 5) ?? [])
                  .slice(0, Math.max(0, 4 - pre.length))
                  .map((d) => aMoveOrderOnThePath(d, 'Infiltrate ' + capitalsRealm));
                const spy = { action: 'spy', target: '', extra: '', desc: 'Spy on ' + bestK.name };
                const rest: PhaseOrder[] = [];
                while (pre.length + path.length + rest.length < 5 && rest.length < 2) rest.push({ ...spy });
                theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, [...pre, ...path, ...rest], []);
                assigned.add(c.id);
                return;
              }
            }
          }
        }
        // ── review II A7: a Melee-7 hero Challenges a rival here when the forecast (on known skills) says 70%+. ──
        if (!isLeader && hp >= mhp * 0.85) {
          const mo = botMasteryPre(G, pi, c, P, { duelSim: hooks.duelSim });
          if (mo?.action === 'challenge') {
            theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, [...pre, mo], []);
            assigned.add(c.id);
            return;
          }
        }
        // ── review II A4: a fighter standing where an at-war unarmed rival stands runs him down first (duel sim ≥ 50%, felled ≤ 10%). ──
        if (
          !isLeader &&
          !c.isKing &&
          P.owner === pi &&
          botAtWar(G, pi) &&
          hp >= mhp * 0.85 &&
          (Number(theSkillsOf(c).melee) >= 3 || Number(theSkillsOf(c).archery) >= 3) &&
          typeof hooks.duelSim === 'function'
        ) {
          const sneak = botVisibleCharsIn(G, pi, P).find(
            (e) =>
              e.alive &&
              e.player != null &&
              e.player !== pi &&
              !e.isKing &&
              !theUnitsWithGapsOf(e).length &&
              botRelationRaw(G, pi, e.player) === 'enemy' &&
              e._invisTurn !== G.turn,
          );
          if (sneak) {
            const f = hooks.duelSim(c, botAssumedChar(G, pi, sneak), 24);
            if (f && f.win >= 0.5 && f.felled <= 0.1) {
              theTurnsOrders(G)[c.id] = botFillOrders(
                G,
                pi,
                c,
                [...pre, { action: 'encounter', target: String(sneak.id), extra: '', desc: 'Run down ' + sneak.name }],
                [],
              );
              assigned.add(c.id);
              return;
            }
          }
        }
        // ── LAIR RAIDER: a fighter walks to a beatable discovered lair within 4 hops (hoard + Monster-Bane merit). ──
        if (!isLeader && !c.isKing && hp >= mhp * 0.7) {
          const lo = botLairPlan(G, pi, c, pre, L);
          if (lo) {
            theTurnsOrders(G)[c.id] = lo;
            assigned.add(c.id);
            return;
          }
        }
        // ── SPECIALISTS: scholar / scout / spy / thief (Sept 2026, Toby). Wounded heroes fall through to Rest. ──
        if (!isLeader && hp >= mhp * 0.6) {
          const role = spec.byId[c.id]; // Sept 2026: a non-leading king may be the slayer or the scholar
          if (role) {
            const so = botSpecialistOrders(G, pi, c, pre, role, L);
            if (so) {
              theTurnsOrders(G)[c.id] = so;
              assigned.add(c.id);
              return;
            }
          }
        }
        if (isLeader && homeId != null && c.location !== homeId) {
          const path = botPathDirs(G, pi, P, homeId, maxHops, true);
          if (path?.length) {
            theTurnsOrders(G)[c.id] = botFillOrders(
              G,
              pi,
              c,
              pre,
              path.map((d) => aMoveOrderOnThePath(d, 'Return to raise a host')),
            );
            return;
          }
        }
        if (!isLeader && P.owner === pi && (leaderAt(c.location) || !theArmyTypesOf(P).length)) {
          // Find the nearest owned land province with recruitable units and no other friendly
          // character.
          let bestM: { x: Province; sc: number; d: number } | null = null;
          for (const x of theProvincesOf(G)) {
            if (x?.owner !== pi || x.terrain === 'sea' || x.id === P.id || !theArmyTypesOf(x).length) continue;
            if (all.some((o) => o.id !== c.id && o.location === x.id)) continue;
            const d = botPathLen(G, pi, P, x.id, true);
            if (d == null || d > 4) continue;
            const sc = (x.tax || 0) - d * 2;
            if (!bestM || sc > bestM.sc) bestM = { x, sc, d };
          }
          if (bestM) {
            const muster = bestM.x;
            const path = botPathDirs(G, pi, P, muster.id, maxHops, true);
            if (path?.length) {
              theTurnsOrders(G)[c.id] = botFillOrders(
                G,
                pi,
                c,
                pre,
                path.map((d) => aMoveOrderOnThePath(d, 'March to muster at ' + muster.name)),
              );
              return;
            }
          }
        }
        // 2026-09-26 (Toby): an unarmed LEADER (or feeder) with no muster to make works his SECONDARY role this year.
        if (!c.isKing && c._botRole2 && c._botRole !== 'admiral' && c._botRole !== 'skygeneral') {
          const w2 = botRoleWork(G, pi, c, pre, c._botRole2, L);
          if (w2) {
            theTurnsOrders(G)[c.id] = w2;
            assigned.add(c.id);
            return;
          }
        }
        if (pre.length) {
          theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, []);
        }
        return; // else: idle — economy / actions passes give it work
      }
      // ── FEEDER with a column: march it to the nearest field army (defenders were handled above). ──
      if (!isLeader && !roles.defenders.includes(c.id)) {
        let bestL: { l: Character; d: number } | null = null;
        for (const l of leaders) {
          const d = botPathLen(G, pi, P, l.location, false);
          if (d != null && (!bestL || d < bestL.d)) bestL = { l, d };
        }
        if (bestL && maxHops > 0) {
          const general = bestL.l;
          const path = botPathDirs(G, pi, P, general.location, maxHops, false);
          if (path?.length) {
            theTurnsOrders(G)[c.id] = botFillOrders(
              G,
              pi,
              c,
              pre,
              path.map((d) => aMoveOrderOnThePath(d, 'Bring troops to ' + general.name)),
            );
            return;
          }
        }
        // no leader reachable — behave as a small host of its own (falls through)
      }
      // ── LEADER (or stranded feeder): threat / hold / reinforce / attack / expand. ──
      const visited = new Set([P.id]);
      const scan = botScanTargets(G, pi, c, P, myStr, T, visited);
      const { best, reinforce, maxThreat, threatDir } = scan;
      // DEFENCE: don't abandon a threatened capital or Rich province if it would fall the moment we leave
      // and our move isn't the counter-attack that destroys that very force.
      if (P.owner === pi && botIsValuable(G, P, pi) && maxThreat > 0) {
        let remaining = 0;
        theHeroesStandingIn(P).forEach((id) => {
          if (id === c.id) return;
          const f = theCharactersOf(G).find((x) => x?.id === id);
          if (f && f.alive && f.player === pi) remaining += botForceStrength(f.armies);
        });
        theGarrisonOf(P).forEach((a) => {
          remaining += unitBaseStrength(a);
        });
        const provinceWouldFall = maxThreat >= remaining;
        const bestAttacksTheThreat = best?.dirIdx === threatDir;
        if (provinceWouldFall && !bestAttacksTheThreat) {
          theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, []);
          return;
        } // hold, drill, watch
      }
      // HOME THREAT: the PRIMARY host answers a human host massing within 2 hops of the capital —
      // marches on it if it can win, otherwise falls back to stand on the capital. Only when the
      // capital would actually fall as it stands.
      if (c.id === roles.primaryId && homeThreat && homeId != null && !(best?.dirIdx === threatDir && maxThreat > 0)) {
        const H = G.world.provinces[homeId];
        if (homeThreat.force > botEnemyDefence(G, H, pi, pi) - (c.location === homeId ? myStr : 0)) {
          const margin = c.isKing ? T.kingAttackMargin : T.heroAttackMargin;
          if (myStr >= homeThreat.force * margin) {
            // Path to a province adjacent to the threat, then strike.
            const TP = theProvinceOfTheThreat(G, homeThreat.provId);
            let bestAdj = null;
            for (let i = 0; i < 6; i++) {
              const N = botNeighbourProv(G, TP, i);
              if (!N || !botPassable(G, pi, N)) continue;
              const d = botPathLen(G, pi, P, N.id, false);
              if (d != null && (!bestAdj || d < bestAdj.d)) bestAdj = { N, d };
            }
            if (bestAdj && bestAdj.d < maxHops) {
              const path = botPathDirs(G, pi, P, bestAdj.N.id, maxHops, false) ?? [];
              const mv = path.map((d) => aMoveOrderOnThePath(d, 'March on the invader'));
              for (let i = 0; i < 6; i++) {
                const K = botNeighbourProv(G, bestAdj.N, i);
                if (K?.id === TP.id) {
                  mv.push(botMoveOrder(i, 'Attack the invader'));
                  break;
                }
              }
              theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, mv);
              return;
            }
          }
          if (c.location !== homeId) {
            const path = botPathDirs(G, pi, P, homeId, maxHops, false);
            if (path?.length) {
              theTurnsOrders(G)[c.id] = botFillOrders(
                G,
                pi,
                c,
                pre,
                path.map((d) => aMoveOrderOnThePath(d, 'Fall back to the capital')),
              );
              return;
            }
          } else {
            theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, []);
            return;
          } // stand on the capital
        }
      }
      // REINFORCE a neighbouring valuable province about to fall (unless the counter-attack is
      // available).
      if (reinforce && !(best?.dirIdx === threatDir && maxThreat > 0)) {
        theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, [botMoveOrder(reinforce.dirIdx, 'Reinforce')]);
        return;
      }
      if (maxHops <= 0 && seaHops <= 0) {
        theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, []);
        return;
      }
      // ── ADMIRAL without hulls (2026-09-26, Toby item 6): a fleet is raised at a port, so an admiral leading a
      // land column elsewhere marches to the nearest port first (his muster order there buys the hulls). ──
      if (c._botRole === 'admiral' && !theUnitsWithGapsOf(c).some((a) => a != null && BOT_CARRIER_TYPES.has(a.type))) {
        const g = botNearestOf(G, pi, c, botCoastalPorts(G, pi), false);
        if (g && g.d > 0) {
          const path = botPathDirs(G, pi, P, g.X.id, maxHops, false);
          if (path?.length) {
            theTurnsOrders(G)[c.id] = botFillOrders(
              G,
              pi,
              c,
              pre,
              path.map((d) => aMoveOrderOnThePath(d, 'To the port of ' + g.X.name)),
            );
            return;
          }
        }
      }
      // ── ADMIRAL waits for the general (item 7): with berths to spare and a general standing here with
      // foot soldiers to embark, the fleet stays in harbour this year (the general hands them over below —
      // leaders plan in order, the admiral first) and sails loaded next year. ──
      if (
        c._botRole === 'admiral' &&
        botSpareBerths(c) > 0 &&
        all.some(
          (o) =>
            o.id !== c.id &&
            o.location === c.location &&
            roles.leaders.includes(o.id) &&
            o._botRole !== 'admiral' &&
            o._botRole !== 'skygeneral' &&
            theUnitsWithGapsOf(o).some((a) => a != null && botLiftable(a.type) && !BOT_SEA_ALL.has(a.type)) &&
            !botScanTargets(G, pi, o, P, botBattleForce(G, o, null, 'plain', undefined), T, new Set([P.id])).best,
        )
      ) {
        theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, []);
        return;
      }
      // ── FLYING GENERAL (2026-09-26, Toby item 8): airborne, he strikes over sea and behind the front; grounded
      // (too few flyers for the foot he leads), he goes to the nearest eyrie and musters flyers there. ──
      if (c._botRole === 'skygeneral') {
        if (botCanFly(c.armies)) {
          const as = botAirStrike(G, pi, c, P, myStr, T, Math.max(1, Math.min(5, botAirReach(c), 5 - pre.length)));
          if (as?.moves.length) {
            const buff =
              theUnitsWithGapsOf(c).length >= 3 && pre.length <= 2
                ? botCastPlan(G, pi, c, P, { max: 1, fighting: c }).find((o) =>
                    [theNameOfTheSpell('oratory'), theNameOfTheSpell('phantasmal-armies')].includes(o.target),
                  )
                : null;
            const pre2 = buff ? [...pre, buff] : pre;
            theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre2, as.moves);
            return;
          }
        } else {
          const g = botNearestOf(G, pi, c, botFlyerPorts(G, pi), false);
          if (g && g.d > 0) {
            const path = botPathDirs(G, pi, P, g.X.id, maxHops, false);
            if (path?.length) {
              theTurnsOrders(G)[c.id] = botFillOrders(
                G,
                pi,
                c,
                pre,
                path.map((d) => aMoveOrderOnThePath(d, 'To the eyrie at ' + g.X.name)),
              );
              return;
            }
          }
          if (g?.d === 0) {
            // 2026-09-28 (Toby: bots never take the sea by air): he usually arrives leading a whole land column
            // and waited years for a flyer per foot soldier. Now the foot his flyers (held + raised this year)
            // cannot carry, and anything that can never fly, is left in the eyrie's garrison — next year the
            // column is airborne.
            const _fly =
              theUnitsWithGapsOf(c).filter((a) => a != null && BOT_FLYING_TYPES.has(a.type)).length +
              (recruitTypes.some((t) => BOT_FLYING_TYPES.has(t)) ? 1 : 0);
            if (_fly > 0 && pre.length < 5) {
              const ground = theUnitsWithGapsOf(c).filter((a): a is Army => a != null && !BOT_AERIAL_TYPES.has(a.type));
              const lift = ground
                .filter((a) => botLiftable(a.type))
                .sort((x, y) => unitBaseStrength(y) - unitBaseStrength(x));
              const drop = [...ground.filter((a) => !botLiftable(a.type)), ...lift.slice(_fly)];
              if (drop.length)
                pre.push({
                  action: 'leave_army',
                  target: drop.map((a) => a.unitName || a.type).join(','),
                  extra: '-1',
                  desc: 'Leave the foot at the eyrie',
                });
            }
            theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, []);
            return;
          }
        } // at the eyrie: muster flyers (pre) and hold
      }
      // ── ADMIRAL WITH A FLEET (2026-09-28, Toby: bots never take the sea): the water is his front. He sails
      // for the best winnable sea / landing FIRST; with nothing to sail for he keeps the fleet in harbour.
      // Before this he fell through to the land general's target, left his hulls in the garrison to march
      // (shedFleet), then walked back to a port to buy new ones — a loop in which the fleet never sailed. ──
      if (c._botRole === 'admiral' && theUnitsWithGapsOf(c).some((a) => a != null && BOT_CARRIER_TYPES.has(a.type))) {
        const ss = seaHops > 0 ? botSeaStrike(G, pi, c, P, myStr, T, seaHops) : null;
        if (ss?.moves.length) {
          const mo = botMasteryPre(G, pi, c, P, { fightAhead: ss.N.terrain !== 'sea', fromSea: true });
          const pre2 = mo && pre.length <= 2 ? [...pre, mo] : pre;
          theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre2, ss.moves);
          return;
        }
        if (!(best?.N.terrain === 'sea')) {
          theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, []);
          return;
        }
      }
      // A host carrying ships cannot march overland: leave the hulls in this province's garrison
      // first
      // (one phase) when the chosen move is land→land. They are picked up again if a naval move is chosen later.
      const shedFleet = () => {
        if (P.terrain === 'sea' || P.owner !== pi) return false;
        const hulls = theUnitsWithGapsOf(c).filter((a): a is Army => a != null && BOT_SEA_ALL.has(a.type));
        if (!hulls.length || hulls.length === theUnitsWithGapsOf(c).length) return false;
        pre.push({
          action: 'leave_army',
          target: hulls.map((a) => a.type).join(','),
          extra: '-1',
          desc: 'Leave the fleet in harbour',
        });
        return true;
      };
      if (best && best.N.terrain !== 'sea' && P.terrain !== 'sea' && shedFleet() && pre.length >= 5) {
        theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, []);
        return;
      }
      if (best) {
        // A real fight ahead: one buff cast first (Oratory > Elemental Summon > Phantasmal Armies)
        // when the host has 3+ units and a phase to spare — a Veteran elemental or +1 quality tier
        // decides battles.
        if (best.targetStr > 0 && theUnitsWithGapsOf(c).length >= 2 && pre.length <= 3) {
          // 2026-09-26 (idea 1): every planned fight, from two units
          const rite = botRitePre(G, pi, c, P, L, true);
          if (rite) pre.push(rite); // Pagan: the Wild Hunt / a Blood Offering before the clash
          {
            const mo = botMasteryPre(G, pi, c, P, { fightAhead: true });
            if (mo && pre.length <= 2) pre.push(mo);
          } // review II A7
          const buff = botCastPlan(G, pi, c, P, { max: 1, fighting: c }).find((o) =>
            [
              theNameOfTheSpell('oratory'),
              theNameOfTheSpell('elemental-summon'),
              theNameOfTheSpell('phantasmal-armies'),
            ].includes(o.target),
          );
          if (buff && pre.length <= 3) pre.push(buff);
        }
        const moves = [botMoveOrder(best.dirIdx, best.targetStr > 0 ? 'Attack' : 'Advance')];
        visited.add(best.N.id);
        let str = myStr,
          fights = 0;
        if (best.targetStr > 0) {
          str *= 0.85;
          fights = 1;
        }
        moves.push(...botChainHops(G, pi, c, best.N, str, T, maxHops - 1, visited, fights));
        theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, moves);
        return;
      }
      // ── JOIN FORCES (2026-09-26, Toby item 7): a general with nothing to attack, standing with the ADMIRAL,
      // puts his foot soldiers aboard — every liftable unit the hulls have room for — so the fleet carries
      // them over the water. He keeps whatever cannot sail and raises a fresh column. ──
      if (isLeader && c._botRole !== 'admiral' && c._botRole !== 'skygeneral') {
        const adm = all.find(
          (o) =>
            o.id !== c.id &&
            o.location === c.location &&
            o._botRole === 'admiral' &&
            theUnitsWithGapsOf(o).some((a) => a != null && BOT_CARRIER_TYPES.has(a.type)),
        );
        const spare = adm ? botSpareBerths(adm) : 0;
        if (adm && spare > 0) {
          const give = theUnitsWithGapsOf(c)
            .filter((a): a is Army => a != null && botLiftable(a.type) && !BOT_SEA_ALL.has(a.type) && !a._isSkeletal)
            .sort((x, y) => unitBaseStrength(y) - unitBaseStrength(x))
            .slice(0, spare);
          if (give.length) {
            theTurnsOrders(G)[c.id] = botFillOrders(
              G,
              pi,
              c,
              [
                ...pre,
                {
                  action: 'leave_army',
                  target: give.map((a) => a.unitName || a.type).join(','),
                  extra: String(adm.id),
                  desc: 'Embark ' + String(give.length) + ' unit' + (give.length > 1 ? 's' : '') + ' with ' + adm.name,
                },
              ],
              [],
            );
            return;
          }
        }
      }
      // Nothing winnable HERE (a field host expands before it raids lairs — lairs are for the
      // unarmed): look across the whole realm for a winnable province and march on it. Before this
      // a host parked on an edge beside one over-strong guard held for the rest of the game while
      // easier land sat three hops away behind its own borders.
      const ds = botDistantStrike(G, pi, c, P, myStr, T, maxHops);
      if (ds) {
        if (
          ds.moves.some((m) => {
            const d = BOT_HEX_DIRS.indexOf(m.target.slice(4));
            const N = botNeighbourProv(G, P, d);
            return N && N.terrain !== 'sea';
          }) &&
          P.terrain !== 'sea' &&
          shedFleet() &&
          pre.length >= 5
        ) {
          theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, []);
          return;
        }
        theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, ds.moves);
        return;
      }
      // Sept 2026 (Toby: hire as much as possible): a host with nothing to attack walks to a seen wanderer and hires him.
      {
        const heroesNow = theCharactersOf(G).filter(
          (x) => x?.alive && x.player === pi && !x.isKing && !x._isHeir,
        ).length;
        let bestH: { h: Character; d: number; de: number } | null = null;
        if (heroesNow < botHeroCap(G, pi))
          for (const h of theCharactersOf(G)) {
            if (!(
              h?.alive &&
              h.player === null &&
              !h._isNeutralGuard &&
              !h._justDefeated &&
              botSeesChar(G, pi, h) &&
              !heroClaimed.has(h.id) &&
              h.location !== c.location
            ))
              continue;
            if (heroHireWage(theAlignmentOf(G, pi), h.alignment, false, h) == null) continue;
            const d = botPathLen(G, pi, P, h.location, false);
            if (d == null || d > maxHops - 1) continue;
            const de = d - botHireBias(G, pi, h);
            if (!bestH || de < bestH.de) bestH = { h, d, de };
          }
        if (bestH) {
          const wanderer = bestH.h;
          const wage = heroHireWage(theAlignmentOf(G, pi), wanderer.alignment, false, wanderer);
          const path = botPathDirs(G, pi, P, wanderer.location, maxHops - 1, false) ?? [];
          if (path.length === bestH.d && wage != null && L.budget >= wage) {
            heroClaimed.add(wanderer.id);
            botSpend(L, wage);
            L.hired ??= new Set();
            L.hired.add(wanderer.id);
            theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, [
              ...path.map((d) => aMoveOrderOnThePath(d, 'Ride to ' + wanderer.name)),
              { action: 'hire', target: String(wanderer.id), extra: '', desc: 'Hire ' + wanderer.name },
            ]);
            return;
          }
        }
      }
      // Sept 2026 (Toby: naval): a sea-capable host with no land target sails — claim the sea, land on an enemy coast.
      {
        const ss =
          c._botRole === 'admiral' || botSeaCap(c.armies) !== 'land'
            ? botSeaStrike(G, pi, c, P, myStr, T, Math.max(maxHops, seaHops))
            : null;
        if (ss?.moves.length) {
          const mo = botMasteryPre(G, pi, c, P, { fightAhead: ss.N.terrain !== 'sea', fromSea: true });
          const pre2 = mo && pre.length <= 2 ? [...pre, mo] : pre;
          theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre2, ss.moves);
          return;
        }
      }
      // A Divine king with holy ground still to claim walks to the richest consecratable province (review §2).
      if (c.isKing && maxHops >= 1) {
        const ct = botConsecrateTarget(G, pi, c, maxHops - 1);
        if (ct && ct.d > 0) {
          const path = botPathDirs(G, pi, P, ct.X.id, maxHops - 1, false) ?? [];
          if (path.length === ct.d) {
            theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, [
              ...path.map((d) => aMoveOrderOnThePath(d, 'Carry the light to ' + ct.X.name)),
              { action: THE_ALIGNMENT_ORDERS.consecrate.key, target: '', extra: '', desc: 'Consecrate ' + ct.X.name },
            ]);
            return;
          }
        }
      }
      // A beatable lair in our own adjacent land — go clear it (hoard + strength).
      const ld = botLairDir(G, P, c, pi);
      if (ld >= 0) {
        const LP = botNeighbourProv(G, P, ld);
        const li = botBeatableLairIn(G, c, LP);
        const mv: PhaseOrder[] = [botMoveOrder(ld, 'Raid lair')];
        if (li >= 0 && LP)
          mv.push({ action: 'search', target: String(li), extra: '', desc: 'Search Lair', prov: LP.id });
        theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, mv);
        return;
      }
      // Nothing winnable anywhere in reach: march for the frontier (multi-hop) and strike from
      // there if hops remain.
      const ft = botFrontierTarget(G, pi, P);
      if (ft != null) {
        if (P.terrain !== 'sea' && shedFleet() && pre.length >= 5) {
          theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, []);
          return;
        }
        const path = botPathDirs(G, pi, P, ft, maxHops, false);
        if (path?.length) {
          const moves: PhaseOrder[] = [];
          let cur = P;
          for (const d of path) {
            const N = botNeighbourProv(G, cur, d ?? -1);
            if (!N) break;
            moves.push(aMoveOrderOnThePath(d, 'Advance to frontier'));
            visited.add(N.id);
            cur = N;
          }
          moves.push(...botChainHops(G, pi, c, cur, myStr, T, maxHops - moves.length, visited, 0));
          theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, moves);
          return;
        }
      }
      // ── RAISE ARMIES WHERE THEY CAN BE RAISED (2026-09-26, Toby items 1/7): a leader with nothing to attack and
      // no frontier does not stand and drill — he marches to the best owned province that recruits field
      // troops (a coastal port first when the realm has an admiral to carry him) and musters there. ──
      if (
        isLeader &&
        !(P.owner === pi && theArmyTypesOf(P).some((t) => t && !/garrison/i.test(t) && !BOT_NAVAL_TYPES.has(t)))
      ) {
        const hasAdm = all.some((o) => o._botRole === 'admiral');
        let bestM: { x: Province; sc: number; d: number } | null = null;
        for (const x of theProvincesOf(G)) {
          if (
            x?.owner !== pi ||
            x.terrain === 'sea' ||
            x.id === P.id ||
            !theArmyTypesOf(x).some((t) => t && !/garrison/i.test(t) && !BOT_NAVAL_TYPES.has(t))
          )
            continue;
          const d = botPathLen(G, pi, P, x.id, false);
          if (d == null || d > 6) continue;
          const sc = (x.tax || 0) - d * 2 + (hasAdm && botCoastalFleetType(x) ? 6 : 0);
          if (!bestM || sc > bestM.sc) bestM = { x, sc, d };
        }
        if (bestM) {
          const muster = bestM.x;
          const path = botPathDirs(G, pi, P, muster.id, maxHops, false);
          if (path?.length) {
            theTurnsOrders(G)[c.id] = botFillOrders(
              G,
              pi,
              c,
              pre,
              path.map((d) => aMoveOrderOnThePath(d, 'March to muster at ' + muster.name)),
            );
            return;
          }
        }
      }
      // At the edge with nothing winnable: hold, watch and drill (muster orders still apply).
      theTurnsOrders(G)[c.id] = botFillOrders(G, pi, c, pre, []);
    });
    botRunSlayerSchool(G, pi, roles); // 2026-09-28 (Toby): mentors for the slayer, in their spare phases
  });
}
