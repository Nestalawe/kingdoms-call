import { GUARDIAN_POWER_RANK, SKILL_LABELS, STEAL_TIER_PEN } from '../army-tables.ts';
import { GRAND_HEIST_RICH_TAX } from '../items/tiers-and-hoards.ts';
import { featDiscovered } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import {
  BOT_DEF_BONUS,
  BOT_SEA_ALL,
  botAlignFriendly,
  botBattleForce,
  botBelief,
  botBelievedOwner,
  botEffForce,
  botForceStrength,
  botKnows,
  botKnowsGraves,
  botMarginFor,
  botMutualFoe,
  botNeighbourProv,
  botRelationRaw,
  botSees,
  botSeesChar,
  botTargetDefence,
  botTurnCache,
  botVisibleCharsIn,
} from './intel.ts';
import { botIsLoadedFleet, botSeaCap } from './war.ts';
import { BOT_SPECIALIST_SKILLS } from './specialist-skills.ts';
import {
  BOT_NAVAL_TYPES,
  BOT_SLAYER_FIGHTERS_ONLY,
  BOT_SPECIALIST_ROLES,
  botAtWar,
  botDefenceNeed,
  botEnemyChars,
  botEnemyIntel,
  botFieldRecruitTokens,
  botFleetOnly,
  botFrontierTarget,
  botHasMetPlayers,
  botHeroCap,
  botHexDist,
  botHomeId,
  botIsEdge,
  botIsFighter,
  botIsValuable,
  botLandCount,
  botLandReach,
  botMagicScore,
  botMoveOrder,
  botNearbyThreat,
  botPassable,
  botPathDirs,
  botPathLen,
  botPracticeSkill,
  botRecruitOrder,
  botRoles,
  botSchoolLimit,
  botSkillsUnknown,
} from './strategy.ts';
import { BOT_SCHOOLS } from './schools.ts';
import {
  botAllyNear,
  botHostMargin,
  botLairCandidates,
  botLairPlan,
  botMasteryPre,
  botPickupOrder,
  botRememberedHostAt,
  botSlayerHasLairsToGrowInto,
  botSlayerTrainSkill,
} from './missions.ts';
import {
  botBeatableLairIn,
  botCastPlan,
  botCrossTrainSkill,
  botFillOrders,
  botPathAny,
  botPathLenAny,
  botPlannedAttackTarget,
  botSpyTarget,
  botTargetTitles,
} from './spellcraft.ts';
import { botPins } from './phase-one.ts';
import { theNameOfTheSpell } from './the-name-of-a-spell-by-its-slug.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { PhaseOrder } from '../../schemas/orders-a-realm-submits.ts';
import type { Army, Character, GameState, Item, Province, ProvinceFeature } from '../../schemas/saved-game-state.ts';
import type { ABotRealmsLedger, TheBotsSpecialistRoles } from './intel.ts';

// Its types (plan P1-10b46): each parameter typed as wide as the body's guards, so each guard stays.
/** A phase's order as the passes read a plan: an order, or a gap the plan holds. */
type AnOrderAsThePassesReadIt = PhaseOrder | null | undefined;
/** The turn's orders as the passes read them, by hero (G.turnOrders). */
type TheTurnsOrdersAsThePassesHoldThem = Partial<Record<string, AnOrderAsThePassesReadIt[]>>;
/** The weights a march reads (the bot's temper): its margins, and what a province's tax and a rival are worth. */
type TheWeightsAMarchReads = Parameters<typeof botMarginFor>[3] & {
  readonly taxScoreWeight: number;
  readonly rivalBias: number;
};
/** A hero's skills, read by any skill's name. */
type TheSkillsByName = Character['skills'] & Readonly<Partial<Record<string, number>>>;
/** A hero whose skills the code reads as if they may be missing. */
type AHeroOfSkills = { readonly skills?: Character['skills'] | null | undefined } | null | undefined;
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
/** A hero's items, where the code tests the list for a gap. */
function theItemsWithGapsOf(c: Character): readonly (Item | null | undefined)[] {
  return asItsGuardReadsIt(c.items) ?? [];
}
/** A hero's skills by name, where the code reads them as if they may be missing. */
function theSkillsOf(c: AHeroOfSkills): TheSkillsByName {
  return { ...c?.skills };
}
/** A province by its index in the world's list, as JavaScript reads `list[k]` (none for an index off the list). */
function theProvinceAt(G: GameState, k: number | null | undefined): Province | undefined {
  return G.world.provinces[k ?? -1];
}
/** A move along a path botPathDirs found, whose steps may hold a gap: a gap reads no way, as `BOT_HEX_DIRS[undefined]`
 *  did (`-1` names none either). */
function aMoveOrderOnThePath(d: number | undefined, desc: string) {
  return botMoveOrder(d ?? -1, desc);
}
/** A skill's label, else its name. */
function theLabelOf(sk: string): string {
  const labels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
  return (labels[sk] ?? '') || sk;
}

// ── MAGE (2026-09-26, Toby): a specialist who focuses on TWO schools of magic — his strongest, and the next
// strongest (a complementary pick when he holds only one: Elemental with White, otherwise White with Elemental).
// He casts wherever a cast is worth making (botCastPlan already ranks every school's spells by the situation),
// stands with the general when nothing is, and trains the weaker of his two schools between times.
export function botMageSchools(c: AHeroOfSkills): [string, string] {
  const s = theSkillsOf(c);
  const ranked: [string, ...string[]] = [...BOT_SCHOOLS];
  ranked.sort((a, b) => (Number(s[b]) || 0) - (Number(s[a]) || 0) || BOT_SCHOOLS.indexOf(a) - BOT_SCHOOLS.indexOf(b));
  const s1 = ranked[0];
  let s2 = (ranked.find((x) => x !== s1 && (Number(s[x]) || 0) > 0) ?? '') || null;
  s2 ??= s1 === 'elemental' ? 'white' : 'elemental';
  return [s1, s2];
}
export function botMageAptitude(c: AHeroOfSkills) {
  const s = theSkillsOf(c);
  const [a, b] = botMageSchools(c);
  return (Number(s[a]) || 0) * 4 + (Number(s[b]) || 0) * 3;
}
// BOT_SPECIALIST_ROLES, botMagicScore and botLandCount are in bots/strategy.ts.
export const BOT_DEFEND_ORDER = { action: 'defend', target: '', extra: '', desc: 'Hold the post' };
// The six-hex Defend zone about a province (the engine's inDefendZone, in engine/units/defend-ride-outs-ambushes-and-reinforcements.ts, takes the turn's context).
export function botZoneOf(G: GameState, X: Province) {
  const z = [X];
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, X, i);
    if (N) z.push(N);
  }
  return z;
}
/** A province's features, where the code tests the list for a gap. */
function theFeaturesWithGapsOf(X: Province): readonly (ProvinceFeature | null | undefined)[] {
  return asItsGuardReadsIt(X.features) ?? [];
}
/** Whether only a fighter may be a slayer (BOT_SLAYER_FIGHTERS_ONLY, off), read as a flag. */
function theSlayersMustFight(): boolean {
  return BOT_SLAYER_FIGHTERS_ONLY;
}
/** The skill a specialist's role trains (BOT_SPECIALIST_SKILLS), read by any role's name. */
function theSkillOfTheRole(role: string): string | undefined {
  const skills: Readonly<Partial<Record<string, string>>> = BOT_SPECIALIST_SKILLS;
  return skills[role];
}
/** The roles a hero may hold, in the order the court is filled. */
type ASpecialistsRole = 'slayer' | 'scout' | 'scholar' | 'spy' | 'thief' | 'mage';
// SPECIALIST ASSIGNMENT — cached per turn. `excluded` = ids already claimed (companions).
export function botSpecialistRoles(
  G: GameState,
  pi: number,
  excluded?: ReadonlySet<number> | null,
): TheBotsSpecialistRoles {
  const cache = botTurnCache(G);
  const spec = cache.spec ?? {};
  cache.spec = spec;
  const held = spec[pi];
  if (held) return held;
  const roles = botRoles(G, pi);
  const p = theRealmsOf(G)[pi];
  // Sept 2026 (Toby): the court's core is a general, a slayer and a scholar — and the KING may be any of the three.
  // He is a leader whenever his generalship ranks him one (botRoles); otherwise he takes slayer or scholar here.
  const heroes = theCharactersOf(G).filter(
    (c): c is Character =>
      !!c &&
      c.alive &&
      c.player === pi &&
      !c._isHeir &&
      !roles.leaders.includes(c.id) &&
      !roles.defenders.includes(c.id) &&
      !theUnitsWithGapsOf(c).length &&
      !excluded?.has(c.id),
  );
  const land = botLandCount(G, pi),
    met = botHasMetPlayers(G, pi),
    war = botAtWar(G, pi),
    turn = G.turn || 0;
  const unmapped = theProvincesOf(G).filter(
    (x) => x?.owner === pi && x.terrain !== 'sea' && (Number(x.exploredBy?.[pi]) || 0) < 100,
  ).length;
  const lairs = theProvincesOf(G).reduce(
    (n, x) =>
      n +
      (x && x.terrain !== 'sea' && botKnows(G, pi, x.id)
        ? theFeaturesWithGapsOf(x).filter((f) => f && !f.cleared && !f.ritualSite && f.monster && featDiscovered(f, pi))
            .length
        : 0),
    0,
  );
  const titles = botTargetTitles(G, pi); // review II A6: a chased title buys a second specialist
  const want = {
    slayer: 1 + (lairs >= 6 ? 1 : 0) + (titles.includes('monster') ? 1 : 0), // Sept 2026 (Toby): EVERY realm trains a guardian-killer from turn 1; a second once six lairs are known   // Sept 2026 (Toby): guardian-killers, trained for the lairs on the map
    scout: unmapped > 0 ? Math.min(3, 1 + Math.floor(unmapped / 6)) : 0,
    scholar: (land >= 10 ? 2 : 1) + (p?.alignment === 'Neutral' ? 1 : 0) + (titles.includes('lore') ? 1 : 0), // Neutral scholars find twice as much   // 2026-09-26 (Toby item 4): a second scholar only at 10+ land — gold and armies come first (12 in the first cut cost a third of the discoveries)
    spy: (met || turn >= 3 ? (war ? 2 : 1) : 0) + (titles.includes('spy') ? 1 : 0),
    thief: met || turn >= 4 ? 1 : 0,
    mage:
      heroes.some((c) => BOT_SCHOOLS.some((k) => (Number(theSkillsOf(c)[k]) || 0) >= 1)) || turn >= 3
        ? 1 + (land >= 10 ? 1 : 0)
        : 0, // 2026-09-26 (Toby): a mage from the first hero who knows a school
  };
  if (titles.includes('carto')) want.scout += 1;
  // keep one hero free to muster / carry troops once there is a realm to feed
  const slots = Math.max(Math.min(2, heroes.length), heroes.length - (land >= 3 ? 1 : 0)); // the slayer and the scholar are never squeezed out by the feeder reserve
  const order: readonly ASpecialistsRole[] = [
    'slayer',
    'scholar',
    'scout',
    'mage',
    'spy',
    'thief',
    'scholar',
    'mage',
    'spy',
    'slayer',
    'scout',
    'scholar',
    'scout',
  ]; // 2026-09-26: the mage after the scout   // slayer first (Toby), the scholar straight after (discoveries halved when he came third)
  const apt = (c: Character, role: string) => {
    const s = theSkillsOf(c);
    const k = theSkillOfTheRole(role);
    if (c.isKing && role !== 'slayer') return -1e9; // Sept 2026 (Toby): a king is the general or the slayer — never scholar, scout, spy or thief
    if (role === 'mage')
      return (
        botMageAptitude(c) +
        (c._botRole === role ? 3 : 0) -
        ((Number(s.melee) || 0) + (Number(s.archery) || 0) + (Number(s.tactical) || 0)) * 0.5
      );
    if (theSlayersMustFight() && role === 'slayer' && !botIsFighter(c)) return -1e9; // 2026-09-28 (option 1, strict — off by default)
    if (role === 'slayer')
      return (
        (Number(s.melee) || 0) * 4 +
        (Number(s.archery) || 0) * 3 +
        (c.maxHp || 20) * 0.3 +
        (c._botRole === role ? 3 : 0) +
        ((Number(s.elemental) || 0) + (Number(s.necromancy) || 0) + (Number(s.psychic) || 0) + (Number(s.white) || 0)) *
          0.5
      ); // 2026-09-26: a duelling school counts a little FOR a slayer (×1.5 handed the role to mages: Melee 1.9 at game end)
    return (
      (Number(s[String(k)]) || 0) * 4 +
      (c._botRole === role ? 3 : 0) -
      ((Number(s.melee) || 0) + (Number(s.archery) || 0) + (Number(s.tactical) || 0)) * 0.5 -
      botMagicScore(c) * 0.5
    );
  };
  const byId: Partial<Record<number, string>> = {},
    filled: Partial<Record<string, number>> = {};
  const taken = new Set<number>();
  let n = 0;
  for (const role of order) {
    if (n >= slots) break;
    if ((filled[role] ?? 0) >= (want[role] || 0)) continue;
    let best: { readonly c: Character; readonly a: number } | null = null;
    for (const c of heroes) {
      if (taken.has(c.id)) continue;
      const a = apt(c, role);
      if (a <= -1e8) continue;
      if (!best || a > best.a) best = { c, a };
    } // a barred candidate is never picked (the 1231 build could make a lone king a scout)
    if (!best) break;
    taken.add(best.c.id);
    byId[best.c.id] = role;
    filled[role] = (filled[role] ?? 0) + 1;
    n++;
  }
  // 2026-09-26 (Toby item 1/3): nobody sits idle. Every free hero the wanted counts did not claim (the one
  // muster reserve excepted) becomes a further scout while ground is unmapped, else a further slayer —
  // both explore and hunt lairs rather than drilling at the capital.
  for (const c of heroes) {
    if (n >= slots) break;
    if (taken.has(c.id) || c.isKing) continue;
    let role = unmapped > 0 ? 'scout' : 'slayer';
    if (theSlayersMustFight() && role === 'slayer' && !botIsFighter(c)) {
      let b: { readonly r: string; readonly a: number } | null = null;
      for (const r of ['mage', 'scholar', 'scout', 'spy', 'thief']) {
        const a = apt(c, r);
        if (a > -1e8 && (!b || a > b.a)) b = { r, a };
      }
      if (!b) continue;
      role = b.r;
    } // a non-fighter takes his best other craft
    taken.add(c.id);
    byId[c.id] = role;
    filled[role] = (filled[role] ?? 0) + 1;
    n++;
  }
  // 2026-09-26 (Toby): every hero also carries a SECONDARY specialist role (c._botRole2) — his next-best aptitude
  // — used whenever his primary role has no good action this year (botSpecialistOrders / the unarmed leader).
  const allMine = theCharactersOf(G).filter(
    (c): c is Character => !!c && c.alive && c.player === pi && !c._isHeir && !c.isKing,
  );
  for (const c of allMine) {
    const prim = (byId[c.id] ?? '') || (c._botRole ?? '') || null;
    let best: { readonly role: string; readonly a: number } | null = null;
    for (const role of ['slayer', 'scholar', 'scout', 'mage', 'spy', 'thief']) {
      if (role === prim) continue;
      const a = apt(c, role);
      if (a <= -1e8) continue;
      if (!best || a > best.a) best = { role, a };
    }
    theSecondRoleWritten(c, best ? best.role : null);
  }
  for (const c of heroes) {
    const mine = byId[c.id];
    if (mine) c._botRole = mine;
    else if (c._botRole !== undefined && BOT_SPECIALIST_ROLES.has(c._botRole)) delete c._botRole;
    // review II A11: a working thief fights by stealing and fleeing; anyone else keeps the engine's auto plan
    const ep: NonNullable<Character['encounterPlan']> = c.encounterPlan ?? {};
    if (c._botRole === 'thief' && (Number(theSkillsOf(c).thief) || 0) >= 3) {
      c.encounterPlan = { ...ep, tactics: ['ST', 'FL', 'FL', 'FL', 'FL', 'FL'], _botTactics: true };
    } else if (ep._botTactics) {
      c.encounterPlan = { ...ep, tactics: [], _botTactics: false };
    }
  }
  const r = { byId, want, filled };
  spec[pi] = r;
  return r;
}
/** A hero's secondary role written, or none (`null`, which the saved schema's `_botRole2` doesn't name: written
 *  through a wider view of the hero, the schema untouched). */
function theSecondRoleWritten(c: { _botRole2?: string | null | undefined }, role: string | null): void {
  c._botRole2 = role;
}
export function botSpecialistOf(G: GameState, pi: number, c: Character) {
  const s = botSpecialistRoles(G, pi);
  return s.byId[c.id] ?? null;
}
// TRAINING RENDEZVOUS — walk to the capital (through any land; unarmed) and practise `skill`.
export function botTrainOrders(
  G: GameState,
  pi: number,
  c: Character,
  pre: readonly AnOrderAsThePassesReadIt[],
  skill: string,
  why: string,
) {
  const P = G.world.provinces[c.location];
  const home = botHomeId(G, pi);
  const H = home != null ? G.world.provinces[home] : null;
  const mv: PhaseOrder[] = [];
  // 2026-09-26 (Toby): train WITH A MENTOR. The best realm character above the trainee's level in this skill who is
  // not marching this year and stands within three hops (own / allied / unowned land) is the rendezvous; the
  // mentor pass in runBotEconomy then makes his filler phases Practice the same skill, and the engine's mentor
  // rule makes every such phase an automatic level. Else the capital, as before.
  let dest: number | null = null,
    why2 = '';
  if (P) {
    const lvl = Number(theSkillsOf(c)[skill]) || 0;
    let best: { readonly m: Character; readonly d: number; readonly sc: number } | null = null;
    for (const m of theCharactersOf(G)) {
      if (!(m && m.alive && m.player === pi && m.id !== c.id && !m._isHeir)) continue;
      const ml = Number(theSkillsOf(m)[skill]) || 0;
      if (ml <= lvl) continue;
      const mo = theTurnsOrders(G)[m.id];
      if (Array.isArray(mo) && mo.some((x) => x && (x.action === 'move' || x.action === 'encounter'))) continue;
      const d = m.location === c.location ? 0 : botPathLen(G, pi, P, m.location, true);
      if (d == null || d > 3) continue;
      const sc = ml * 4 - d;
      if (!best || sc > best.sc) best = { m, d, sc };
    }
    if (best) {
      dest = best.m.location;
      why2 = ' with ' + best.m.name;
    }
  }
  if (dest == null && H?.owner === pi) dest = home;
  if (dest != null && P && c.location !== dest) {
    const D = G.world.provinces[dest];
    const path = botPathDirs(G, pi, P, dest, Math.max(0, 4 - pre.length), true) ?? [];
    path.forEach((d) => mv.push(aMoveOrderOnThePath(d, 'Rendezvous at ' + (D ? D.name : '') + why2)));
  }
  const pr = {
    action: 'practice',
    target: skill,
    extra: '',
    desc: 'Practice ' + theLabelOf(skill) + (why ? ' (' + why + ')' : ''),
  };
  const out = [...pre, ...mv];
  while (out.length < 5) out.push({ ...pr });
  return out.slice(0, 5);
}
// SCHOLAR — Research at Sage 2+ (Neutral: 1+; every Sage level is 5%, 10% for Neutral), else train Sage.
export function botScholarOrders(G: GameState, pi: number, c: Character, pre: readonly AnOrderAsThePassesReadIt[]) {
  const sg = Number(theSkillsOf(c).sage) || 0;
  const neutral = theRealmsOf(G)[pi]?.alignment === 'Neutral';
  const working = neutral ? sg >= 1 : sg >= 2;
  if (!working) {
    // Sept 2026 (Toby): the scholar studies WITH THE KING (every king starts at Sage 1) — if the king's plan this
    // year keeps him in one province within three hops, the scholar goes there; otherwise the capital.
    const king = theCharactersOf(G).find((k) => k && k.alive && k.isKing && k.player === pi);
    const ko = king && theTurnsOrders(G)[king.id];
    if (king && king.location !== c.location && Array.isArray(ko) && !ko.some((x) => x?.action === 'move')) {
      const P = G.world.provinces[c.location];
      const path = P ? (botPathDirs(G, pi, P, king.location, Math.min(3, 4 - pre.length), true) ?? []) : [];
      const d = P ? botPathLen(G, pi, P, king.location, true) : null;
      if (d != null && path.length === d && d <= 3) {
        const out = [...pre, ...path.map((x) => aMoveOrderOnThePath(x, 'Study with the king'))];
        while (out.length < 5)
          out.push({ action: 'practice', target: 'sage', extra: '', desc: 'Practice Sage (scholar)' });
        return out.slice(0, 5);
      }
    }
    return botTrainOrders(G, pi, c, pre, 'sage', 'scholar');
  }
  const research = { action: 'research', target: '', extra: '', desc: 'Research' };
  const pr = { action: 'practice', target: 'sage', extra: '', desc: 'Practice Sage (scholar)' };
  // a scholar still short of Sage 5 splits the year: three Research, two practices
  const out = [...pre];
  let k = 0;
  while (out.length < 5) {
    out.push(sg >= 5 || k < 3 ? { ...research } : { ...pr });
    k++;
  }
  return out;
}
// SCOUT — the nearest known land province (ours, or unowned) still short of fully mapped; walk there
// and Explore for the rest of the year. Wild (Creature/Monster) ground is where lairs lie: +bonus.
export function botScoutTarget(G: GameState, pi: number, c: Character, maxD: number) {
  const from = G.world.provinces[c.location];
  if (!from) return null;
  let best: { readonly X: Province; readonly d: number; readonly sc: number } | null = null;
  for (const X of theProvincesOf(G)) {
    if (!X || X.terrain === 'sea') continue;
    if (X.owner !== pi) {
      if (!botKnows(G, pi, X.id)) continue;
      const bo = botBelievedOwner(G, pi, X);
      if (bo != null) continue;
    }
    const mapped = Number(X.exploredBy?.[pi]) || 0;
    if (mapped >= 100) continue;
    const d = X.id === from.id ? 0 : botPathLen(G, pi, from, X.id, true);
    if (d == null || d > maxD) continue;
    const wild = (asItsGuardReadsIt(X.race) ?? '').startsWith('Primal:') ? 15 : 0;
    const sc = (100 - mapped) / 4 + wild + (X.owner === pi ? 6 : 0) - d * 8;
    if (!best || sc > best.sc) best = { X, d, sc };
  }
  return best;
}
export function botScoutOrders(G: GameState, pi: number, c: Character, pre: readonly AnOrderAsThePassesReadIt[]) {
  const P = G.world.provinces[c.location];
  const t = botScoutTarget(G, pi, c, 4);
  if (!t) return null;
  const path = t.d > 0 ? (botPathDirs(G, pi, P, t.X.id, 4, true) ?? []) : [];
  if (t.d > 0 && path.length !== t.d) return null;
  if (pre.length + path.length >= 5) return null;
  const out = [...pre, ...path.map((d) => aMoveOrderOnThePath(d, 'Scout ' + t.X.name))];
  while (out.length < 5) out.push({ action: 'explore', target: '', extra: '', desc: 'Explore ' + t.X.name });
  return out;
}
// ROAM (2026-09-26, Toby item 5) — a hero sent out to FIND wandering heroes: the nearest known land
// province (not an enemy's) that none of the realm's characters has ever stood in, up to five hops
// through any land; explore on arrival so the walk maps ground too. Falls back to the scout target.
export function botRoamOrders(G: GameState, pi: number, c: Character, pre: readonly AnOrderAsThePassesReadIt[]) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  let best: { readonly X: Province; readonly d: number; readonly sc: number } | null = null;
  for (const X of theProvincesOf(G)) {
    if (!X || X.terrain === 'sea' || X.id === P.id || !botKnows(G, pi, X.id)) continue;
    const bo = botBelievedOwner(G, pi, X);
    if (bo != null && bo !== pi && botRelationRaw(G, pi, bo) !== 'allied') continue;
    if ((asItsGuardReadsIt(X.visitedBy) ?? []).includes(pi)) continue;
    const d = botPathLenAny(G, P, X.id, 5);
    if (d == null) continue;
    const sc = (X.tax || 0) - d * 3 + (theFeaturesWithGapsOf(X).length ? 1 : 0);
    if (!best || sc > best.sc) best = { X, d, sc };
  }
  if (!best) return botScoutOrders(G, pi, c, pre);
  const path = botPathAny(G, P, best.X.id, 5) ?? [];
  if (path.length !== best.d || pre.length + path.length >= 5) return botScoutOrders(G, pi, c, pre);
  const to = best.X;
  const out = [...pre, ...path.map((d) => botMoveOrder(d, 'Roam to ' + to.name + ' (seek heroes)'))];
  while (out.length < 5) out.push({ action: 'explore', target: '', extra: '', desc: 'Explore ' + to.name });
  return out;
}
// botSpyTarget (the rival province a spy goes to) is in bots/spellcraft.ts.
// INVISIBILITY FIRST (2026-09-26, idea 3): an Illusory 1+ character who will end a walk on ground that is not
// ours casts Invisibility before setting out — twice as hard to hit, +30% to flee, +15% to steal.
export function botCloakPre(
  G: GameState,
  pi: number,
  c: Character,
  pre: readonly AnOrderAsThePassesReadIt[],
  destProv: Province | null | undefined,
) {
  if ((Number(theSkillsOf(c).illusory) || 0) < 1 || pre.length >= 4) return pre;
  if (pre.some((o) => o?.action === 'cast_spell' && o.target === theNameOfTheSpell('invisibility'))) return pre;
  if (destProv?.owner === pi) return pre;
  return [
    ...pre,
    { action: 'cast_spell', target: theNameOfTheSpell('invisibility'), extra: '', desc: 'Cast Invisibility' },
  ];
}
export function botSpyOrders(G: GameState, pi: number, c: Character, pre: readonly AnOrderAsThePassesReadIt[]) {
  const P = G.world.provinces[c.location];
  // Sept 2026 (Toby): learn a rival's skills before anyone decides to fight him — a character standing here whose
  // skills our spies have not reported (generals and kings first) is spied on this phase.
  {
    const mark = botVisibleCharsIn(G, pi, P)
      .filter(
        (e) =>
          e.alive &&
          e.player != null &&
          e.player !== pi &&
          botRelationRaw(G, pi, e.player) !== 'allied' &&
          botSkillsUnknown(G, pi, e) &&
          e._invisTurn !== G.turn,
      )
      .sort(
        (a, b) =>
          theUnitsWithGapsOf(b).length * 2 +
          (b.isKing ? 5 : 0) -
          (theUnitsWithGapsOf(a).length * 2 + (a.isKing ? 5 : 0)),
      )[0];
    if (mark && pre.length < 4) {
      const out = [
        ...pre,
        { action: 'spy', target: 'char:' + String(mark.id), extra: '', desc: 'Spy on ' + mark.name },
        { action: 'spy', target: '', extra: '', desc: 'Spy on ' + (P ? P.name : '') },
      ];
      while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
      return out;
    }
  }
  // Sept 2026: SHADOW A GENERAL — an at-war (or future-foe) general seen within two turns whose skills are
  // unreported: walk to where he was last seen and spy on him there (he may have moved; the order then fails
  // harmlessly and the spy reports the province instead).
  {
    const I = botEnemyIntel(G, pi);
    let best: { readonly e: Character; readonly X: Province; readonly d: number; readonly sc: number } | null = null;
    for (const [k, r] of Object.entries(I.generals)) {
      if ((G.turn || 0) - r.turn > 2) continue;
      const e = theCharactersOf(G).find((x) => x?.id === +k);
      if (!e || !e.alive || !botSkillsUnknown(G, pi, e)) continue;
      if (botRelationRaw(G, pi, r.player) === 'allied') continue;
      if (r.provId === c.location) continue;
      const X = theProvinceAt(G, r.provId);
      if (!X) continue;
      const d = botPathLenAny(G, P, X.id, 3);
      if (d == null || d + pre.length > 3) continue;
      const sc = r.units * 2 + (r.isKing ? 6 : 0) + (botRelationRaw(G, pi, r.player) === 'enemy' ? 5 : 0) - d * 2;
      if (!best || sc > best.sc) best = { e, X, d, sc };
    }
    if (best) {
      const path = botPathAny(G, P, best.X.id, 3) ?? [];
      if (path.length === best.d) {
        const shadowed = best.e;
        const out = [
          ...pre,
          ...path.map((d) => botMoveOrder(d, 'Shadow ' + shadowed.name)),
          { action: 'spy', target: 'char:' + String(best.e.id), extra: '', desc: 'Spy on ' + best.e.name },
        ];
        if (out.length < 5) out.push({ action: 'spy', target: '', extra: '', desc: 'Spy on ' + best.X.name });
        while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
        return out;
      }
    }
  }
  const t = botSpyTarget(G, pi, c, 4);
  if (!t) return null;
  const path = t.d > 0 ? (botPathAny(G, P, t.X.id, 4) ?? []) : [];
  if (t.d > 0 && path.length !== t.d) return null;
  if (pre.length + path.length >= 5) return null;
  const p = theRealmsOf(G)[pi];
  if (p) {
    const memo = p._botSpyMemo ?? {};
    p._botSpyMemo = memo;
    memo[t.X.id] = G.turn;
  }
  pre = botCloakPre(G, pi, c, pre, t.X);
  if (pre.length + path.length >= 5) pre = pre.filter((o) => !(o?.target === theNameOfTheSpell('invisibility')));
  const out = [...pre, ...path.map((d) => botMoveOrder(d, 'Slip into ' + t.X.name))];
  const spy = { action: 'spy', target: '', extra: '', desc: 'Spy on ' + t.X.name };
  // two attempts, then lie in wait (a Defend with no column is an ambush watch)
  let k = 0;
  while (out.length < 5) {
    out.push(k < 2 ? { ...spy } : { action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
    k++;
  }
  return out;
}
// THIEF — a visible rival hero (at-war, or a crown the spectrum makes a future foe) or a rival garrison
// paymaster, within reach. Heroes leading troops halve the chance, so they score lower.
/** A thief's target: a rival hero where he stands, or a rival garrison's paymaster in its province. */
type AThiefsTarget =
  | {
      readonly kind: 'char';
      readonly e: Character;
      readonly provId: number;
      readonly d: number;
      readonly sc: number;
    }
  | {
      readonly kind: 'garrison';
      readonly provId: number;
      readonly d: number;
      readonly sc: number;
      readonly X: Province;
    };
export function botStealTarget(G: GameState, pi: number, c: Character, maxD: number) {
  const from = G.world.provinces[c.location];
  if (!from) return null;
  let best: AThiefsTarget | null = null;
  const hostile = (j: number | null | undefined) =>
    j != null &&
    j !== pi &&
    botRelationRaw(G, pi, j) !== 'allied' &&
    (botRelationRaw(G, pi, j) === 'enemy' || !botAlignFriendly(G, pi, j));
  for (const e of theCharactersOf(G)) {
    if (!(e && e.alive && e.player != null && hostile(e.player) && botSeesChar(G, pi, e))) continue;
    if (e._invisTurn === G.turn) continue;
    const d = e.location === from.id ? 0 : botPathLenAny(G, from, e.location, maxD);
    if (d == null) continue;
    const sc =
      (e.isKing ? 6 : 3) +
      theItemsWithGapsOf(e).length * 2 -
      (theUnitsWithGapsOf(e).length ? 5 : 0) -
      d * 2 +
      (theRealmsOf(G)[e.player]?.homeProvinceId === e.location ? 3 : 0); // idea 7: a rival crown's capital is where the purses are
    if (!best || sc > best.sc) best = { kind: 'char', e, provId: e.location, d, sc };
  }
  for (const X of theProvincesOf(G)) {
    if (!X || X.terrain === 'sea' || !botSees(G, pi, X.id)) continue;
    if (!hostile(X.owner) || !(asItsGuardReadsIt(X.garrisonArmies) ?? []).length) continue;
    const d = X.id === from.id ? 0 : botPathLenAny(G, from, X.id, maxD);
    if (d == null) continue;
    const sc = Math.min(4, (asItsGuardReadsIt(X.garrisonArmies) ?? []).length) - d * 2;
    if (!best || sc > best.sc) best = { kind: 'garrison', provId: X.id, d, sc, X };
  }
  return best;
}
export function botThiefOrders(G: GameState, pi: number, c: Character, pre: readonly AnOrderAsThePassesReadIt[]) {
  const P = G.world.provinces[c.location];
  // 2026-09-26 (idea 7): GRAND HEIST — a Thief 7+ at war walks (cloaked) into the richest seen enemy capital or
  // Rich province within four hops and breaks into its vaults; the attempt is once a turn.
  if ((Number(theSkillsOf(c).thief) || 0) >= 7 && botAtWar(G, pi) && P) {
    let best: { readonly X: Province; readonly d: number; readonly sc: number } | null = null;
    for (const X of theProvincesOf(G)) {
      if (!X || X.terrain === 'sea' || !botKnows(G, pi, X.id)) continue;
      const bo = botBelievedOwner(G, pi, X);
      if (bo == null || bo === pi || botRelationRaw(G, pi, bo) !== 'enemy') continue;
      const home = theRealmsOf(G)[bo]?.homeProvinceId === X.id;
      const b = botBelief(G, pi, X);
      if (!home && (Number(b?.tax) || 0) < GRAND_HEIST_RICH_TAX) continue;
      const d = X.id === P.id ? 0 : botPathLenAny(G, P, X.id, 4);
      if (d == null) continue;
      const guarded = (asItsGuardReadsIt(X.garrisonArmies) ?? []).length > 0 && botSees(G, pi, X.id) ? 6 : 0;
      const sc = (Number(theRealmsOf(G)[bo]?.gold) || 0) / 4 + (home ? 4 : 0) - guarded - d * 2;
      if (!best || sc > best.sc) best = { X, d, sc };
    }
    if (best) {
      const vaults = best.X;
      const path = best.d > 0 ? (botPathAny(G, P, best.X.id, 4) ?? []) : [];
      let pre2 = botCloakPre(G, pi, c, pre, best.X);
      if (pre2.length + path.length >= 5) pre2 = pre;
      if (path.length === best.d && pre2.length + path.length < 5) {
        const out = [
          ...pre2,
          ...path.map((d) => botMoveOrder(d, 'Creep toward the vaults of ' + vaults.name)),
          { action: 'grand_heist', target: '', extra: '', desc: 'Grand Heist — ' + best.X.name },
        ];
        while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Lie low' });
        return out;
      }
    }
  }
  // review II A11: a Thief 3+ robs a guardian's hoard by the STEAL tactic (50 + 10×Thief − tier penalty, Weak 0 /
  // Moderate 15 / Powerful 30 / Legendary 45) when that reads 75%+ — his encounter plan is Steal-then-flee
  // (set in botSpecialistRoles), so a failed steal ends in flight rather than a fight.
  {
    const th = Math.min(5, Number(theSkillsOf(c).thief) || 0);
    if (th >= 3) {
      const PEN: Readonly<Partial<Record<string, number>>> = { ...STEAL_TIER_PEN };
      const lair = botLairCandidates(G, pi, c, 4)
        .filter(
          (k) =>
            k.f.monster &&
            50 + 10 * th - (PEN[k.f.monster.power || 'Weak'] ?? 0) >= 75 &&
            !(k.rumour && k.rumour.band >= 101) &&
            !(asItsGuardReadsIt(k.f._pickedCleanBy) ?? []).includes(pi),
        )
        .sort((a, b) => b.grade - a.grade || a.d - b.d)[0]; // 2026-09-29: never a hoard this realm has already emptied
      if (lair) {
        const path = lair.d > 0 ? (botPathDirs(G, pi, P, lair.X.id, 4, true) ?? []) : [];
        if ((lair.d === 0 || path.length === lair.d) && pre.length + path.length < 5) {
          // 2026-09-29 (Toby, lair study): the robber goes in to STEAL AND RUN. The steal-then-flee plan was set
          // only for a hero whose PRIMARY role is thief (botSpecialistRoles), but this order also reaches a hero
          // with Thief 3+ working his secondary role — who then walked into a Moderate guardian with an ordinary
          // melee plan and fought it (40 bot games: every "untrained" Moderate death was one of these). The plan
          // now travels with the order; the role pass resets `_botTactics` plans next turn as before.
          c.encounterPlan = {
            ...c.encounterPlan,
            tactics: ['ST', 'FL', 'FL', 'FL', 'FL', 'FL'],
            _botTactics: true,
          };
          const out = [
            ...pre,
            ...path.map((d) => aMoveOrderOnThePath(d, 'Creep toward the lair in ' + lair.X.name)),
            { action: 'search', target: String(lair.li), extra: '', desc: 'Rob the hoard', prov: lair.X.id },
          ];
          while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
          return out;
        }
      }
    }
  }
  const t = botStealTarget(G, pi, c, 4);
  if (!t) return null;
  const path = t.d > 0 ? (botPathAny(G, P, t.provId, 4) ?? []) : [];
  if (t.d > 0 && path.length !== t.d) return null;
  if (pre.length + path.length >= 5) return null;
  const X = G.world.provinces[t.provId];
  pre = botCloakPre(G, pi, c, pre, X);
  if (pre.length + path.length >= 5) pre = pre.filter((o) => !(o?.target === theNameOfTheSpell('invisibility')));
  const steal =
    t.kind === 'char'
      ? { action: 'steal', target: String(t.e.id), extra: '', desc: 'Rob ' + t.e.name }
      : { action: 'steal', target: 'garrison', extra: '', desc: 'Rob the paymaster of ' + (X ? X.name : '') };
  const out = [...pre, ...path.map((d) => botMoveOrder(d, 'Creep toward ' + (X ? X.name : '')))];
  let k = 0;
  while (out.length < 5) {
    out.push(k < 1 ? { ...steal } : { action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
    k++;
  }
  return out;
}
// LAIR TRAVEL — a beatable, discovered, uncleared lair in ground that is ours, unowned or an ally's,
// within reach of an unarmed fighter (Melee/Archery 3+ — botCanBeatGuardian's own floor).
export function botLairTarget(G: GameState, pi: number, c: Character, maxD: number) {
  const from = G.world.provinces[c.location];
  if (!from) return null;
  let best: { readonly X: Province; readonly li: number; readonly d: number; readonly sc: number } | null = null;
  const POWER_RANK: Readonly<Partial<Record<string, number>>> = { ...GUARDIAN_POWER_RANK };
  for (const X of theProvincesOf(G)) {
    if (!X || X.terrain === 'sea' || !botKnows(G, pi, X.id)) continue;
    const bo = botBelievedOwner(G, pi, X);
    if (bo != null && bo !== pi && botRelationRaw(G, pi, bo) !== 'allied') continue;
    const li = botBeatableLairIn(G, c, X);
    if (li < 0) continue;
    const d = X.id === from.id ? 0 : botPathLen(G, pi, from, X.id, true);
    if (d == null || d > maxD) continue;
    const f = theLairAt(X, li);
    const sc = (POWER_RANK[f.monster?.power ?? ''] ?? 0) * 2 - d * 2;
    if (!best || sc > best.sc) best = { X, li, d, sc };
  }
  return best;
}
/** The lair botBeatableLairIn found in a province, by its place there: for none, the TypeError its read threw. */
function theLairAt(X: Province, li: number): ProvinceFeature {
  const f = X.features[li];
  if (f === undefined) throw new TypeError("Cannot read properties of undefined (reading 'monster')");
  return f;
}
export function botLairOrders(G: GameState, pi: number, c: Character, pre: readonly AnOrderAsThePassesReadIt[]) {
  const P = G.world.provinces[c.location];
  const t = botLairTarget(G, pi, c, 4);
  if (!t) return null;
  const path = t.d > 0 ? (botPathDirs(G, pi, P, t.X.id, 4, true) ?? []) : [];
  if (t.d > 0 && path.length !== t.d) return null;
  if (pre.length + path.length >= 5) return null;
  const mv = [
    ...path.map((d) => aMoveOrderOnThePath(d, 'Seek the lair in ' + t.X.name)),
    { action: 'search', target: String(t.li), extra: '', desc: 'Search Lair', prov: t.X.id },
  ];
  return botFillOrders(G, pi, c, pre, mv);
}
// ROLE WORK — the orders a role does when it has real work this year, or null (2026-09-26, Toby: primary role,
// then the SECONDARY role, then the primary's training — nobody trains while another craft has work to do).
export function botRoleWork(
  G: GameState,
  pi: number,
  c: Character,
  pre: readonly AnOrderAsThePassesReadIt[],
  role: string | null | undefined,
  L: ABotRealmsLedger | null | undefined,
) {
  switch (role) {
    case 'slayer': {
      const lp = botLairPlan(G, pi, c, pre, L);
      if (lp) return lp;
      if ((Number(theSkillsOf(c).melee) || 0) >= 3 && !botSlayerHasLairsToGrowInto(G, pi, c)) {
        const so = botScoutOrders(G, pi, c, pre);
        if (so) return so;
      }
      return null;
    }
    case 'scholar': {
      const sg = Number(theSkillsOf(c).sage) || 0;
      const neutral = theRealmsOf(G)[pi]?.alignment === 'Neutral';
      if (!(neutral ? sg >= 1 : sg >= 2)) return null;
      return botScholarOrders(G, pi, c, pre);
    }
    case 'scout': {
      if ((Number(theSkillsOf(c).explorer) || 0) >= 7 && pre.length < 4) {
        const P = G.world.provinces[c.location];
        const cand = [P];
        for (let i = 0; i < 6; i++) {
          const N = theNeighbourOfAPlaceHeMayNotStand(G, P, i);
          if (N) cand.push(N);
        }
        const X = cand
          .filter(
            (N) =>
              N &&
              N.terrain !== 'sea' &&
              (Number(N.exploredBy?.[pi]) || 0) < 100 &&
              (N.owner === pi || N.owner == null),
          )
          .sort((a, b) => (Number(a?.exploredBy?.[pi]) || 0) - (Number(b?.exploredBy?.[pi]) || 0))[0];
        if (X) {
          const so = botScoutOrders(G, pi, c, [
            ...pre,
            { action: 'chart_unknown', target: String(X.id), extra: '', desc: 'Chart the Unknown — ' + X.name },
          ]);
          if (so) return so;
        }
      } // review II A8
      return botScoutOrders(G, pi, c, pre);
    }
    case 'spy': {
      const lvl = Number(theSkillsOf(c).spy) || 0;
      if (lvl < 2) return null;
      if (lvl >= 9) {
        const P = G.world.provinces[c.location];
        const mark = botVisibleCharsIn(G, pi, P)
          .filter((e) => e.alive && e.player != null && e.player !== pi && botRelationRaw(G, pi, e.player) === 'enemy')
          .sort((a, b) => (b.isKing ? 1 : 0) - (a.isKing ? 1 : 0))[0];
        if (mark) {
          const out = [
            ...pre,
            { action: 'assassinate', target: String(mark.id), extra: '', desc: 'Assassinate ' + mark.name },
          ];
          while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
          return out;
        }
      }
      if (lvl >= 7 && botAtWar(G, pi)) {
        let best: { readonly X: Province; readonly v: number } | null = null;
        for (const X of theProvincesOf(G)) {
          if (!X || X.terrain === 'sea' || !botKnows(G, pi, X.id)) continue;
          const bo = botBelievedOwner(G, pi, X);
          if (bo == null || bo === pi || botRelationRaw(G, pi, bo) !== 'enemy') continue;
          const b = botBelief(G, pi, X);
          const v = (Number(b?.tax) || 0) + (theRealmsOf(G)[bo]?.homeProvinceId === X.id ? 3 : 0);
          if (!best || v > best.v) best = { X, v };
        }
        if (best) {
          const out = [
            ...pre,
            { action: 'sabotage', target: String(best.X.id), extra: '', desc: 'Sabotage ' + best.X.name },
          ];
          while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
          return out;
        }
      }
      return botSpyOrders(G, pi, c, pre);
    }
    case 'thief': {
      const lvl = Number(theSkillsOf(c).thief) || 0;
      if (lvl < 2) return null;
      return botThiefOrders(G, pi, c, pre);
    }
    case 'mage':
      return botMageOrders(G, pi, c, pre);
  }
  return null;
}
/** The neighbour in a direction of a province a hero may not stand in (a hero off the map): for none, the
 *  TypeError botNeighbourProv's read of its row threw. */
function theNeighbourOfAPlaceHeMayNotStand(G: GameState, P: Province | undefined, i: number) {
  if (P === undefined) throw new TypeError("Cannot read properties of undefined (reading 'row')");
  return botNeighbourProv(G, P, i);
}
// MAGE WORK: every cast worth making from where he stands (up to three, both schools, offence first — the plan
// already refuses spells the situation cannot use), then practice the weaker school; with nothing to cast, walk
// to the nearest general leading a host (≤4 hops through any land) to be his caster next year; else null (train).
export function botMageOrders(G: GameState, pi: number, c: Character, pre: readonly AnOrderAsThePassesReadIt[]) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  const [s1, s2] = botMageSchools(c);
  const sk = theSkillsOf(c);
  const weakSch = (Number(sk[s1]) || 0) <= (Number(sk[s2]) || 0) ? s1 : s2;
  const prac = {
    action: 'practice',
    target: weakSch,
    extra: '',
    desc: 'Practice ' + theLabelOf(weakSch) + ' (mage)',
  };
  // idea 6: CHARM a seen wanderer within three hops instead of paying his wage (court under the cap)
  if ((Number(sk.psychic) || 0) >= 1) {
    const heroesNow = theCharactersOf(G).filter(
      (x) => x && x.alive && x.player === pi && !x.isKing && !x._isHeir,
    ).length;
    let bestW: { readonly h: Character; readonly d: number } | null = null;
    if (heroesNow < botHeroCap(G, pi))
      for (const h of theCharactersOf(G)) {
        if (!(
          h &&
          h.alive &&
          h.player === null &&
          !h._isNeutralGuard &&
          !h._justDefeated &&
          !h.isKing &&
          !theUnitsWithGapsOf(h).length &&
          botSeesChar(G, pi, h)
        ))
          continue;
        const d = h.location === c.location ? 0 : botPathLenAny(G, P, h.location, 3);
        if (d == null) continue;
        if (!bestW || d < bestW.d) bestW = { h, d };
      }
    if (bestW && pre.length + bestW.d < 5) {
      const path = bestW.d > 0 ? (botPathAny(G, P, bestW.h.location, 3) ?? []) : [];
      if (path.length === bestW.d) {
        const wanderer = bestW.h;
        const out = [
          ...pre,
          ...path.map((d) => botMoveOrder(d, 'Seek ' + wanderer.name + ' to charm')),
          {
            action: 'cast_spell',
            target: theNameOfTheSpell('charm'),
            extra: String(bestW.h.id),
            desc: 'Charm ' + bestW.h.name,
          },
        ];
        while (out.length < 5) out.push({ ...prac });
        return out.slice(0, 5);
      }
    }
  }
  // idea 5: HEX THE ENEMY GENERAL — a rival host seen within two turns, within three hops, and a school to hurt him
  if ((Number(sk.psychic) || 0) >= 1 || (Number(sk.necromancy) || 0) >= 1) {
    const I = botEnemyIntel(G, pi);
    let bestG: { readonly X: Province; readonly d: number; readonly sc: number; readonly e: Character } | null = null;
    for (const [k, r] of Object.entries(I.generals)) {
      if ((G.turn || 0) - r.turn > 2 || botRelationRaw(G, pi, r.player) !== 'enemy') continue;
      const e = theCharactersOf(G).find((x) => x?.id === +k && x.alive);
      if (e?.location !== r.provId) continue;
      const X = theProvinceAt(G, r.provId);
      if (!X) continue;
      const d = X.id === P.id ? 0 : botPathLenAny(G, P, X.id, 3);
      if (d == null || pre.length + d >= 4) continue;
      const sc = r.units * 2 + (r.isKing ? 5 : 0) - d * 2;
      if (!bestG || sc > bestG.sc) bestG = { X, d, sc, e };
    }
    if (bestG) {
      const path = bestG.d > 0 ? (botPathAny(G, P, bestG.X.id, 3) ?? []) : [];
      if (path.length === bestG.d) {
        const hexes = botCastPlan(G, pi, c, bestG.X, { max: 3 }).filter((o) =>
          [
            theNameOfTheSpell('curse'),
            theNameOfTheSpell('psychic-blast'),
            theNameOfTheSpell('telekinetic-storm'),
          ].includes(o.target),
        );
        if (hexes.length) {
          let pre2 = pre;
          if (bestG.X.owner !== pi) pre2 = botCloakPre(G, pi, c, pre, bestG.X);
          const general = bestG.e;
          const out = [...pre2, ...path.map((d) => botMoveOrder(d, 'Close on ' + general.name)), ...hexes];
          while (out.length < 5) out.push({ ...prac });
          return out.slice(0, 5);
        }
      }
    }
  }
  // siege beside a general who attacks this year (idea 4): his target is in my reach from here
  const _roles = botRoles(G, pi);
  const genHere = theCharactersOf(G).find(
    (l) =>
      l && l.alive && l.player === pi && l.id !== c.id && l.location === c.location && _roles.leaders.includes(l.id),
  );
  const siege = genHere ? botPlannedAttackTarget(G, genHere) : null;
  const casts = botCastPlan(G, pi, c, P, {
    max: 3,
    siege,
    fighting: genHere && siege != null ? genHere : null,
    threat: botNearbyThreat(G, pi, c),
  });
  if (casts.length) {
    const out = [...pre, ...casts];
    while (out.length < 5) out.push({ ...prac });
    return out.slice(0, 5);
  }
  // idea 9: a NECROMANCER walks to the nearest known battlefield graves in our own or unowned ground (three hops)
  // and raises them — Skeletal Armies needs him standing on the dead.
  if ((Number(sk.necromancy) || 0) >= 1) {
    let bestX: { readonly X: Province; readonly d: number } | null = null;
    for (const X of theProvincesOf(G)) {
      if (!X || X.id === P.id || X.terrain === 'sea' || !botKnowsGraves(G, pi, X.id)) continue;
      if (X.owner != null && X.owner !== pi) continue;
      const d = botPathLenAny(G, P, X.id, 3);
      if (d == null || pre.length + d >= 5) continue;
      if (!bestX || d < bestX.d) bestX = { X, d };
    }
    if (bestX) {
      const path = botPathAny(G, P, bestX.X.id, 3) ?? [];
      if (path.length === bestX.d) {
        const graves = bestX.X;
        const out = [...pre, ...path.map((d) => botMoveOrder(d, 'To the battlefield dead of ' + graves.name))];
        const lim = botSchoolLimit(Number(sk.necromancy) || 0);
        for (let i = 0; i < lim && out.length < 5; i++)
          out.push({
            action: 'cast_spell',
            target: theNameOfTheSpell('skeletal-armies'),
            extra: '',
            desc: 'Cast Skeletal Armies',
          });
        while (out.length < 5) out.push({ ...prac });
        return out;
      }
    }
  }
  // idea 10: a WHITE mage with nothing better to do keeps the realm's richest province blessed — he walks there
  // (three hops) and Blesses it and its richest neighbour every year (Bless reaches the adjacent province too).
  if ((Number(sk.white) || 0) >= 1) {
    let bestR: { readonly X: Province; readonly d: number; readonly sc: number } | null = null;
    for (const X of theProvincesOf(G)) {
      if (X?.owner !== pi || X.terrain === 'sea') continue;
      const d = X.id === P.id ? 0 : botPathLen(G, pi, P, X.id, true);
      if (d == null || d > 3 || pre.length + d >= 5) continue;
      let v = X.tax || 0;
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, X, i);
        if (N?.owner === pi && N.terrain !== 'sea') v = Math.max(v, (X.tax || 0) + (N.tax || 0) * 0.8);
      }
      const sc = v - d;
      if (!bestR || sc > bestR.sc) bestR = { X, d, sc };
    }
    if (bestR && bestR.d > 0) {
      const path = botPathDirs(G, pi, P, bestR.X.id, 3, true) ?? [];
      if (path.length === bestR.d) {
        const bl = botCastPlan(G, pi, c, bestR.X, { max: 2 }).filter(
          (o) => o.target === theNameOfTheSpell('bless-province'),
        );
        const blessed = bestR.X;
        const out = [...pre, ...path.map((d) => aMoveOrderOnThePath(d, 'To bless ' + blessed.name)), ...bl];
        while (out.length < 5) out.push({ ...prac });
        return out.slice(0, 5);
      }
    }
  }
  const roles = _roles;
  let best: { readonly l: Character; readonly d: number } | null = null;
  for (const l of theCharactersOf(G)) {
    if (!(
      l &&
      l.alive &&
      l.player === pi &&
      roles.leaders.includes(l.id) &&
      theUnitsWithGapsOf(l).length >= 3 &&
      l.location !== c.location
    ))
      continue;
    const d = botPathLenAny(G, P, l.location, 4);
    if (d == null) continue;
    if (!best || d < best.d) best = { l, d };
  }
  if (best && pre.length + best.d < 5) {
    const path = botPathAny(G, P, best.l.location, 4) ?? [];
    if (path.length === best.d) {
      const general = best.l;
      const out = [...pre, ...path.map((d) => botMoveOrder(d, 'Join ' + general.name + ' as his caster'))];
      const weak = (Number(sk[s1]) || 0) <= (Number(sk[s2]) || 0) ? s1 : s2;
      while (out.length < 5)
        out.push({
          action: 'practice',
          target: weak,
          extra: '',
          desc: 'Practice ' + theLabelOf(weak) + ' (mage)',
        });
      return out;
    }
  }
  return null;
}
export function botRoleTrain(
  G: GameState,
  pi: number,
  c: Character,
  pre: readonly AnOrderAsThePassesReadIt[],
  role: string | null | undefined,
) {
  switch (role) {
    case 'slayer': {
      const k = botSlayerTrainSkill(c);
      return k ? botTrainOrders(G, pi, c, pre, k, 'slayer') : null;
    }
    case 'scholar':
      return botScholarOrders(G, pi, c, pre); // below the working level this studies with the king / at the capital
    case 'scout':
      return botTrainOrders(G, pi, c, pre, 'explorer', 'scout');
    case 'spy':
      return botTrainOrders(G, pi, c, pre, 'spy', 'spy');
    case 'thief':
      return botTrainOrders(G, pi, c, pre, 'thief', 'thief');
    case 'mage': {
      const [s1, s2] = botMageSchools(c);
      const sk = theSkillsOf(c);
      const pick = (Number(sk[s1]) || 0) < 2 ? s1 : (Number(sk[s2]) || 0) < (Number(sk[s1]) || 0) ? s2 : s1;
      return botTrainOrders(G, pi, c, pre, pick, 'mage');
    } // the first school to 2, then the two rise together
  }
  return null;
}
// Is a hero AT his primary role's working level? Below it, training the primary is the immediate good action and
// the secondary role waits (the first cut let secondaries starve slayers of Melee: 1.8 average at game end).
export function botRoleReady(G: GameState, pi: number, c: AHeroOfSkills, role: string | null | undefined) {
  const s = theSkillsOf(c);
  const neutral = theRealmsOf(G)[pi]?.alignment === 'Neutral';
  switch (role) {
    case 'slayer':
      return (Number(s.melee) || 0) >= 3 || (Number(s.archery) || 0) >= 3;
    case 'scholar':
      return neutral ? (Number(s.sage) || 0) >= 1 : (Number(s.sage) || 0) >= 2;
    case 'spy':
      return (Number(s.spy) || 0) >= 2;
    case 'thief':
      return (Number(s.thief) || 0) >= 2;
    case 'scout':
      return true;
    case 'mage': {
      const [s1] = botMageSchools(c);
      return (Number(s[s1]) || 0) >= 2;
    }
  }
  return true;
}
/** An order a hero's secondary role gave, marked so (`_role2`, which the order's schema doesn't name). */
function theSecondRoleMarked(o: { readonly action: string; _role2?: string }, r2: string): void {
  o._role2 = r2;
}
export function botSpecialistOrders(
  G: GameState,
  pi: number,
  c: Character,
  pre: readonly AnOrderAsThePassesReadIt[],
  role: string | null | undefined,
  L: ABotRealmsLedger | null | undefined,
) {
  const w = botRoleWork(G, pi, c, pre, role, L);
  if (w) return w;
  const r2 = c._botRole2;
  if (r2 && r2 !== role && botRoleReady(G, pi, c, role)) {
    const w2 = botRoleWork(G, pi, c, pre, r2, L);
    if (w2) {
      w2.forEach((o) => {
        if (o && !pre.includes(o)) theSecondRoleMarked(o, r2);
      });
      return w2;
    }
  }
  return botRoleTrain(G, pi, c, pre, role);
}
// DEFENDER POST — the owned land province whose Defend zone covers the most owned tax not already
// covered (`covered`: provinces a field host stands on plus earlier defenders' zones). Sticky: the
// current post is kept while it scores at least 80% of the best. Returns {X,d,sc} or null.
export function botDefenderPost(G: GameState, pi: number, c: Character, covered: ReadonlySet<number>) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  const home = botHomeId(G, pi);
  const armed = theUnitsWithGapsOf(c).length > 0;
  const owned = theProvincesOf(G).filter((p): p is Province => !!p && p.owner === pi && p.terrain !== 'sea');
  const val = (q: Province) => (q.tax || 0) + (q.id === home ? 6 : 0) + (botIsEdge(G, pi, q) ? 2 : 0);
  const cover = (X: Province) => {
    let sc = 0;
    botZoneOf(G, X).forEach((q) => {
      if (q.owner === pi && q.terrain !== 'sea' && !covered.has(q.id)) sc += val(q);
    });
    return sc;
  };
  const raise = (X: Province) =>
    theArmyTypesOf(X).some((t) => !/garrison/i.test(t) && !BOT_NAVAL_TYPES.has(t)) ? (armed ? 1 : 4) : 0; // an unarmed defender needs somewhere to raise a column
  const plainDef = armed ? botBattleForce(G, c, null, 'plain', { defending: true }) : 0;
  const ground = (X: Province) =>
    armed && plainDef > 0 ? (botBattleForce(G, c, null, X.terrain, { defending: true }) / plainDef - 1) * 8 : 0; // Sept 2026: hold ground where our troops fight best
  let best: { readonly X: Province; readonly d: number; readonly sc: number } | null = null;
  for (const X of owned) {
    const d = X.id === P.id ? 0 : botPathLen(G, pi, P, X.id, !armed);
    if (d == null) continue;
    const sc = cover(X) + raise(X) + ground(X) - d * 1.5;
    if (!best || sc > best.sc) best = { X, d, sc };
  }
  if (best && c._botPost != null && c._botPost !== best.X.id) {
    const cur = owned.find((x) => x.id === c._botPost);
    if (cur) {
      const d = cur.id === P.id ? 0 : botPathLen(G, pi, P, cur.id, !armed);
      const sc = cover(cur) + raise(cur) + ground(cur) - (d == null ? 99 : d * 1.5);
      if (d != null && sc >= best.sc * 0.8) best = { X: cur, d, sc };
    }
  }
  return best;
}
/** The unit types a province raises, where the code reads them as if they may be missing. */
function theArmyTypesOf(X: Province): readonly string[] {
  return asItsGuardReadsIt(X.armyTypes) ?? [];
}
// DEFENDER ORDERS — hire, walk to the post (if not there), ONE Defend, recruit to self at an owned post,
// then the useful tail: Bless / Illusory Terrain / Resurrect (and Oratory while a hostile host is within
// two hexes), cross-training with anyone standing here, else Tactical drill / the best skill to raise.
export function botDefenderOrders(
  G: GameState,
  pi: number,
  c: Character,
  pre: readonly AnOrderAsThePassesReadIt[],
  post: { readonly X: Province; readonly d: number } | null | undefined,
  L: ABotRealmsLedger | null | undefined,
) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  const armed = theUnitsWithGapsOf(c).length > 0;
  const out = [...pre];
  let here = P;
  if (post && post.d > 0) {
    const reach = Math.min(3, armed ? botLandReach(c) || 1 : 5);
    const path = botPathDirs(G, pi, P, post.X.id, Math.min(reach, Math.max(0, 4 - out.length)), !armed) ?? [];
    for (const d of path) {
      const N = botNeighbourProv(G, here, theWayOnThePath(d));
      if (!N) break;
      out.push(aMoveOrderOnThePath(d, 'Take post at ' + post.X.name));
      here = N;
    }
  }
  // Sept 2026: at his post with no hostile host within two hexes, a defender first rides one hex to an owned
  // province holding 3+ garrison units, takes the surplus up and returns — the Defend then comes later than the
  // usual first/second phase (judgement call: only when nothing threatens).
  if (post?.d === 0 && here.id === P.id && out.length <= 1 && !botNearbyThreat(G, pi, c)) {
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, P, i);
      if (N?.owner !== pi || N.terrain === 'sea' || (asItsGuardReadsIt(N.garrisonArmies) ?? []).length <= 2) continue;
      const po = botPickupOrder(G, pi, c, N);
      if (po) {
        out.push(botMoveOrder(i, 'Gather the garrison of ' + N.name));
        out.push(po);
        out.push(botMoveOrder(5 - i, 'Return to the post'));
        break;
      }
    }
  }
  if (out.length < 5) out.push({ ...BOT_DEFEND_ORDER });
  if (out.length < 5 && here.id === P.id) {
    const po = botPickupOrder(G, pi, c, P);
    if (po) out.push(po);
  } // review II A2: the post's surplus garrison joins the defender
  if (out.length < 5 && here.id === P.id && armed) {
    const mo = botMasteryPre(G, pi, c, P, { holding: true, threat: botNearbyThreat(G, pi, c) });
    if (mo) out.push(mo);
  } // review II A7: a Tactical-7 defender lays a Feigned Retreat
  if (here.id === P.id && P.owner === pi && L && out.length < 5) {
    const toks = botFieldRecruitTokens(G, pi, c, P, L).filter((t) => !BOT_SEA_ALL.has(t.split('|')[0] ?? ''));
    const ro = botRecruitOrder(toks, null);
    if (ro) out.push(ro);
  }
  if (out.length < 5 && here.id === P.id) {
    const threat = botNearbyThreat(G, pi, c);
    const casts = botCastPlan(G, pi, c, P, { max: 2, fighting: threat && armed ? c : null, threat }).filter((o) =>
      [
        theNameOfTheSpell('bless-province'),
        theNameOfTheSpell('illusory-terrain'),
        theNameOfTheSpell('resurrect'),
        theNameOfTheSpell('oratory'),
        theNameOfTheSpell('curse'),
        theNameOfTheSpell('psychic-blast'),
        theNameOfTheSpell('telekinetic-storm'),
      ].includes(o.target),
    );
    casts.forEach((o) => {
      if (out.length < 5) out.push(o);
    });
  }
  const land = theUnitsWithGapsOf(c).filter((a) => a && !BOT_SEA_ALL.has(a.type) && !a._isSkeletal).length;
  const sk =
    (botCrossTrainSkill(G, c, pi) ?? '') || (land >= 3 ? 'tactical' : '') || (botPracticeSkill(c) ?? '') || 'tactical';
  const pr =
    sk === 'sage' && (Number(theSkillsOf(c).sage) || 0) >= 2
      ? { action: 'research', target: '', extra: '', desc: 'Research' }
      : { action: 'practice', target: sk, extra: '', desc: 'Practice ' + theLabelOf(sk) };
  while (out.length < 5) out.push({ ...pr });
  return out.slice(0, 5);
}
/** A step of a path botPathDirs found, whose steps may hold a gap, as the neighbour's read takes it: a gap reads no
 *  way (`BOT_OFF_EVEN[undefined]`, as `-1` does), which botNeighbourProv's read of it throws for. */
function theWayOnThePath(d: number | undefined): number {
  return d ?? -1;
}
// Filling a character's five phases: botFillOrders and its practice fallback are in bots/spellcraft.ts; the drill, the
// role skill, the contact tests, botMoveOrder, the pathing (botPathDirs, botPathLen) and the frontier (botIsEdge,
// botFrontierTarget) in bots/strategy.ts.
// HOME THREAT — the strongest at-war enemy host standing within 2 hops of the capital (a human
// massing on the border). {force, provId} or null.
export function botHomeThreat(G: GameState, pi: number) {
  const hid = botHomeId(G, pi);
  const H = hid != null ? G.world.provinces[hid] : null;
  if (!H) return null;
  let best: { readonly force: number; readonly provId: number } | null = null;
  for (const e of theCharactersOf(G)) {
    if (!(
      e &&
      e.alive &&
      e.player != null &&
      e.player !== pi &&
      theUnitsWithGapsOf(e).length &&
      botRelationRaw(G, pi, e.player) === 'enemy'
    ))
      continue;
    if (!botSeesChar(G, pi, e)) continue; // only a host we can see
    const P = G.world.provinces[e.location];
    if (!P || botHexDist(G, P, H) > 2) continue;
    const f = botForceStrength(e.armies);
    if (!best || f > best.force) best = { force: f, provId: P.id };
  }
  return best;
}
// THE HOSTS BESIDE A TARGET THAT RIDE TO ITS DEFENCE (bot improvements, 2026-11): a general on Defend rides into a neighbouring province of his realm when it is
// attacked, so the hosts of N's owner the realm can see (or saw lately) beside N count in N's defence, as players count
// them. A host pinned by our flood cannot ride; one standing in `fromId` (where we attack from) is fought there.
export function botHostsBesideATargetThatRideToItsDefence(
  G: GameState,
  pi: number,
  N: Province,
  fromId: number,
  pins: ReadonlyMap<number, number>,
): { force: number; units: number } {
  let force = 0,
    units = 0;
  if (N.owner == null || N.owner === pi) return { force, units };
  for (let j = 0; j < 6; j++) {
    const K = botNeighbourProv(G, N, j);
    if (!K || K.id === fromId || pins.has(K.id)) continue;
    for (const e of botVisibleCharsIn(G, pi, K)) {
      if (e.player !== N.owner || !theUnitsWithGapsOf(e).length) continue;
      force += botEffForce(G, e, undefined);
      units += theUnitsWithGapsOf(e).length;
    }
    const r = botRememberedHostAt(G, pi, K.id, N.owner); // the owner's alone: another realm's host does not ride in
    force += r.strength;
    units += r.units;
  }
  return { force, units };
}
/** The best target of a scan: its way, its score, the province, and the strength defending it. */
interface AScansBest {
  readonly dirIdx: number;
  readonly score: number;
  readonly N: Province;
  readonly targetStr: number;
}
// TARGET SCAN — from province P with a column of strength myStr: the best winnable adjacent target
// (attack an at-war enemy province, take unowned land, hunt enemy leaders, put to sea), the strongest
// at-war enemy host on the doorstep, and the neighbouring valuable province most in need of help.
export function botScanTargets(
  G: GameState,
  pi: number,
  c: Character,
  P: Province,
  myStr: number,
  T: TheWeightsAMarchReads,
  visited: ReadonlySet<number> | null | undefined,
) {
  const margin = botMarginFor(G, pi, c, T);
  // `myStr` is the column's plain-ground battle force (possibly discounted for fights already
  // chained this turn); re-project it onto each target's terrain so a mountain front line is read
  // honestly.
  const plainStr = botBattleForce(G, c, null, 'plain', undefined);
  const k = plainStr > 0 ? myStr / plainStr : 1;
  const strIn = (t: string) => botBattleForce(G, c, null, t, undefined) * k;
  let best: AScansBest | null = null,
    reinforce: { readonly dirIdx: number; readonly need: number } | null = null,
    maxThreat = 0,
    threatDir = -1;
  const _pins = botPins(G, pi);
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, P, i);
    if (!N) continue;
    // the doorstep threat is what the realm can SEE next door — a hex bordering our land shows
    // terrain and ownership, never the column standing on it.
    let enemyForceInN = 0;
    for (const e of botVisibleCharsIn(G, pi, N)) {
      if (e.player != null && e.player !== pi && botRelationRaw(G, pi, e.player) === 'enemy')
        enemyForceInN += botEffForce(G, e, undefined);
    }
    if (enemyForceInN > maxThreat) {
      maxThreat = enemyForceInN;
      threatDir = i;
    }
    if (visited?.has(N.id)) continue;
    if (_pins.has(N.id)) continue; // 2026-09-29: flooded this Spring by our own mage — sea all year
    if (N.terrain === 'sea' && botSeaCap(c.armies) === 'land') continue; // no shipping — can't put to sea
    if (N.terrain !== 'sea' && botFleetOnly(c.armies)) continue; // 2026-09-28: bare hulls cannot step ashore
    if (N.owner === pi) {
      if (botIsValuable(G, N, pi)) {
        const need = botDefenceNeed(G, N, pi);
        if (need > 0 && (!reinforce || need > reinforce.need)) reinforce = { dirIdx: i, need };
      }
      continue;
    }
    if (N.owner != null && botRelationRaw(G, pi, N.owner) === 'allied') continue; // an ally's land is not a target
    let targetStr: number,
      enemyTarget = false;
    const ec = botEnemyChars(G, N, pi);
    if (N.owner == null) {
      targetStr = botTargetDefence(G, pi, N) + ec.force * BOT_DEF_BONUS;
    } else {
      if (botRelationRaw(G, pi, N.owner) !== 'enemy') continue;
      targetStr = botTargetDefence(G, pi, N);
      enemyTarget = true;
    }
    const rem = enemyTarget ? botRememberedHostAt(G, pi, N.id) : { units: 0, strength: 0 };
    targetStr += rem.strength * BOT_DEF_BONUS; // Sept 2026: a host seen here lately may still be here
    const ride = enemyTarget
      ? botHostsBesideATargetThatRideToItsDefence(G, pi, N, P.id, _pins)
      : { force: 0, units: 0 };
    targetStr += ride.force * BOT_DEF_BONUS; // 2026-11: the owner's hosts beside it ride in
    let effMargin = ec.hasKing ? margin * 0.9 : margin;
    effMargin = botHostMargin(effMargin, ec.units + rem.units + ride.units); // 1.5–2× against a general
    if (targetStr > 0 && strIn(N.terrain) < targetStr * effMargin) continue;
    const terrainEdge = plainStr > 0 ? (strIn(N.terrain) / (plainStr * k) - 1) * 15 : 0; // fight where OUR troops stand tallest
    // a winnable enemy HOST is the prize — the bigger the stack we can smash, the better.
    // 2026-09-12: an ally's enemy is the enemy to press — a shared front ends the war sooner.
    // Sept 2026 (Toby: avoid stronger armies): a province standing beside an enemy host we could not beat is a trap
    let trap = 0;
    if (enemyTarget) {
      for (let j = 0; j < 6; j++) {
        const K = botNeighbourProv(G, N, j);
        if (!K || K.terrain === 'sea' || K.id === P.id || _pins.has(K.id)) continue;
        const kc = botEnemyChars(G, K, pi);
        /* a pinned host cannot come to its neighbour's aid */ const kr = botRememberedHostAt(G, pi, K.id);
        const f = kc.force + kr.strength;
        if (f > 0 && strIn(N.terrain) < f * 1.2) {
          trap = -25;
          break;
        }
      }
    }
    let score =
      (N.tax || 0) * T.taxScoreWeight -
      targetStr +
      (enemyTarget ? T.rivalBias : 0) +
      ec.value +
      ec.units * 3 +
      terrainEdge +
      (ec.units > 0 ? T.rivalBias : 0) +
      trap +
      (enemyTarget && botMutualFoe(G, pi, N.owner) ? T.rivalBias : 0) +
      (enemyTarget && botAllyNear(G, pi, N) ? T.rivalBias / 2 : 0); // Sept 2026 (R7): press the front an ally is already on
    if (N.terrain === 'sea') {
      score -= c._botRole === 'admiral' ? 0 : 40; // sea is the ADMIRAL's front; others claim it only when land is exhausted
      if (botIsLoadedFleet(c.armies))
        for (let j = 0; j < 6; j++) {
          const K = botNeighbourProv(G, N, j);
          if (
            K &&
            K.terrain !== 'sea' &&
            K.owner != null &&
            K.owner !== pi &&
            botRelationRaw(G, pi, K.owner) === 'enemy'
          ) {
            score += 40 + T.rivalBias * 2;
            break;
          }
        }
    }
    if (!best || score > best.score) best = { dirIdx: i, score, N, targetStr };
  }
  return { best, reinforce, maxThreat, threatDir };
}
// CHAINED HOPS — continue a march from a predicted position: attack the next winnable neighbour,
// else walk toward the frontier. Strength is discounted 15% per fight fought (losses) and each
// extra hop that fights demands a stiffer margin; at most two fights per turn are chained.
export const BOT_MAX_FIGHTS = 3;
export function botChainHops(
  G: GameState,
  pi: number,
  c: Character,
  startProv: Province | null | undefined,
  myStr: number,
  T: TheWeightsAMarchReads,
  hopsLeft: number,
  visited: Set<number>,
  fights: number | null | undefined,
) {
  const moves: PhaseOrder[] = [];
  let cur = startProv,
    str = myStr,
    fought = Number(fights) || 0;
  while (hopsLeft > 0 && cur) {
    const scan = botScanTargets(G, pi, c, cur, str / (fought ? 1.2 : 1), T, visited);
    if (scan.best && str === 0 && scan.best.targetStr > 0) scan.best = null; // exhausted host: no third fight
    if (scan.best) {
      moves.push(botMoveOrder(scan.best.dirIdx, scan.best.targetStr > 0 ? 'Attack' : 'Advance'));
      visited.add(scan.best.N.id);
      cur = scan.best.N;
      hopsLeft--;
      if (scan.best.targetStr > 0) {
        str *= 0.85;
        fought++;
        if (fought >= BOT_MAX_FIGHTS) str = 0;
      } // 2026-09-29 (Toby: attack more than one enemy province a year): three fights a year (was two), then only unguarded ground — every hop is used
      continue;
    }
    const ft = botFrontierTarget(G, pi, cur);
    if (ft == null) break;
    const path = botPathDirs(G, pi, cur, ft, hopsLeft);
    if (!path?.length) break;
    for (const d of path) {
      const N: Province | null | undefined = botNeighbourProv(G, cur, theWayOnThePath(d));
      if (!N) break;
      moves.push(aMoveOrderOnThePath(d, 'Advance to frontier'));
      visited.add(N.id);
      cur = N;
      hopsLeft--;
    }
  }
  return moves;
}
// DISTANT STRIKE: BFS through the bot's own (and allied) land up to 8 hops from P for the staging
// province whose winnable neighbour scores best (tax, weakness, rival bias, minus 4/hop of
// marching). Returns the move list: the path as far as this turn's hops allow, then — if a hop
// remains on arrival — the attack itself and any chained follow-ups. null when nothing winnable
// exists in reach.
export function botDistantStrike(
  G: GameState,
  pi: number,
  c: Character,
  P: Province,
  myStr: number,
  T: TheWeightsAMarchReads,
  maxHops: number,
) {
  if (maxHops <= 0) return null;
  const _pins = botPins(G, pi);
  const margin = botMarginFor(G, pi, c, T);
  const plainStr = botBattleForce(G, c, null, 'plain', undefined);
  const k = plainStr > 0 ? myStr / plainStr : 1;
  const strIn = (t: string) => botBattleForce(G, c, null, t, undefined) * k;
  const seen = new Set([P.id]);
  let q = [P],
    depth = 0,
    best: { readonly id: number; readonly sc: number } | null = null;
  while (q.length && depth < 8) {
    const next: Province[] = [];
    depth++;
    for (const cur of q) {
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, cur, i);
        if (!N || seen.has(N.id) || !botPassable(G, pi, N)) continue;
        seen.add(N.id);
        next.push(N);
        // does N border something we can take?
        let sc: number | null = null;
        for (let j = 0; j < 6; j++) {
          const X = botNeighbourProv(G, N, j);
          if (!X || X.terrain === 'sea' || X.owner === pi) continue;
          // a staging province may be an ALLY's, whose far side is two hops past our own border and
          // may never have been seen. Unmapped ground is not a target.
          if (!botKnows(G, pi, X.id)) continue;
          if (X.owner != null && botRelationRaw(G, pi, X.owner) !== 'enemy') continue;
          const ec = botEnemyChars(G, X, pi);
          let tStr: number,
            enemyTarget = false;
          if (X.owner == null) tStr = botTargetDefence(G, pi, X) + ec.force * BOT_DEF_BONUS;
          else {
            tStr = botTargetDefence(G, pi, X);
            enemyTarget = true;
          }
          const rem = enemyTarget ? botRememberedHostAt(G, pi, X.id) : { units: 0, strength: 0 };
          tStr += rem.strength * BOT_DEF_BONUS;
          const ride = enemyTarget
            ? botHostsBesideATargetThatRideToItsDefence(G, pi, X, N.id, _pins)
            : { force: 0, units: 0 };
          tStr += ride.force * BOT_DEF_BONUS; // 2026-11: the owner's hosts beside it ride in
          let effMargin = ec.hasKing ? margin * 0.9 : margin;
          effMargin = botHostMargin(effMargin, ec.units + rem.units + ride.units);
          if (tStr > 0 && strIn(X.terrain) < tStr * effMargin) continue;
          const terrainEdge = plainStr > 0 ? (strIn(X.terrain) / (plainStr * k) - 1) * 15 : 0;
          const v =
            (X.tax || 0) * T.taxScoreWeight -
            tStr +
            (enemyTarget ? T.rivalBias : 0) +
            ec.value +
            ec.units * 3 -
            depth * 4 +
            terrainEdge +
            (ec.units > 0 ? T.rivalBias : 0) +
            (enemyTarget && botMutualFoe(G, pi, X.owner) ? T.rivalBias : 0) +
            (enemyTarget && botAllyNear(G, pi, X) ? T.rivalBias / 2 : 0);
          if (sc == null || v > sc) sc = v;
        }
        if (sc != null && (!best || sc > best.sc)) best = { id: N.id, sc };
      }
    }
    q = next;
  }
  if (!best) return null;
  const path = botPathDirs(G, pi, P, best.id, 99, false);
  if (!path?.length) return null;
  const moves: PhaseOrder[] = [];
  let cur = P;
  const visited = new Set([P.id]);
  for (const d of path) {
    if (moves.length >= maxHops) break;
    const N = botNeighbourProv(G, cur, theWayOnThePath(d));
    if (!N) break;
    moves.push(aMoveOrderOnThePath(d, 'March on ' + String(G.world.provinces[best.id]?.name)));
    visited.add(N.id);
    cur = N;
  }
  if (cur.id === best.id && moves.length < maxHops)
    moves.push(...botChainHops(G, pi, c, cur, myStr, T, maxHops - moves.length, visited, 0));
  return moves.length ? { moves, stageId: best.id } : null;
}
