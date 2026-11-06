import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { alignDistP } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import {
  BOT_AERIAL_TYPES,
  BOT_CARRIER_TYPES,
  BOT_MONSTER_ARMIES,
  BOT_SEA_ALL,
  botAlignOf,
  botBattleForce,
  botBelief,
  botBelievedOwner,
  botForceStrength,
  botKnownFeatures,
  botKnows,
  botMarginFor,
  botNeighbourProv,
  botRelationRaw,
  botSees,
  botSeesChar,
  botStallTurns,
  botTargetDefence,
  botTuning,
  botVisibleCharsIn,
} from './intel.ts';
import { botCanBeatGuardian, botFillOrders, botPathLenAny } from './spellcraft.ts';
import {
  BOT_CAVALRY_TYPES,
  BOT_CREATURE_ARMIES,
  BOT_FLYING_TYPES,
  botDefenceNeed,
  botEnemyIntel,
  botIsValuable,
} from './strategy.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { PhaseOrder } from '../../schemas/orders-a-realm-submits.ts';
import type { Army, BotIntelHero, Character, GameState, Province } from '../../schemas/saved-game-state.ts';

// Its types (plan P1-10b44): each parameter typed as wide as the body's guards, so each guard stays.
/** A battle between two realms as the war's news holds it: its province is none where the battle's merit is counted
 *  with no province. */
interface ABattlesNews {
  readonly t: number;
  readonly p: number | null;
  readonly a: number;
  readonly d: number;
  readonly w: number;
  readonly al: number;
  readonly dl: number;
}
/** The world, where the war's news is read and written (a battle's province may be none). */
function theNewsHolder(G: GameState): { _battleNews?: (ABattlesNews | null | undefined)[] | undefined } {
  return G;
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
/** A hero a realm's intel has sighted, where the code tests his place for none. */
type ASighting = Omit<BotIntelHero, 'provId'> & { readonly provId?: number | null | undefined };
/** The heroes a realm's intel has sighted, by id, where the code tests the record for none and each for a gap. */
function theSightingsIn(
  record: Readonly<Record<string, ASighting | null | undefined>> | null | undefined,
): Readonly<Record<string, ASighting | null | undefined>> {
  return record ?? {};
}
/** A host's units, where the code tests the list for a gap or none. */
type TheUnitsAsTheNavalChecksReadThem = readonly (Army | null | undefined)[] | null | undefined;
/** The turn's orders, read where the code read `G.turnOrders` (the assaults write them through this type). */
function theTurnsOrders(G: GameState): Partial<Record<string, readonly (PhaseOrder | null | undefined)[]>> {
  return G.turnOrders;
}
/** The province an assault's target names, which the code has just found next to a hero: for none, the TypeError its
 *  read would throw. */
function theTargetedProvince(G: GameState, id: number): Province {
  const X = G.world.provinces[id];
  if (X === undefined) throw new TypeError("Cannot read properties of undefined (reading 'tax')");
  return X;
}

// ══ WAR ASSESSMENT (2026-09-29, Toby) ══════════════════════════════════════════════════════════════
// A bot no longer declares war the moment it meets a crown two or more steps away on the alignment
// wheel. It declares only when it judges the war winnable, from what it KNOWS (hosts seen in the last
// few turns, the land and wealth it has seen the rival hold, the heroes it has met) — never the true
// state of an unseen realm:
//   1 STRENGTH — our side (plus allies, minus half of any other war we are fighting) against theirs
//     (plus their allies), needing a margin (BOT_WAR.base) that alignment, temper and opportunity
//     move. Numbers: see BOT_WAR below.
//   2 A PRIZE — one of their land provinces on (or one beyond) our border that one of our hosts can
//     take; without one, war only on a markedly bigger margin.
//   3 OPPORTUNITY — each lowers the bar (capped): they lost a battle we know of lately, their crown
//     passed to an heir lately, an ally of ours is already at war with them, their field host was
//     seen far from home, their capital stands empty in our sight.
//   5 EXPAND FIRST — while free neutral land still borders ours (and we are not stalled on it), the
//     bar rises: conquest of a rival waits until the easy land is gone.
//   6 NO DOGPILE — no new war while an existing one is going badly (we are weaker than that foe).
//   7 SUE FOR PEACE — at war for minWarTurns+ and badly outmatched, or losing the battles against
//     them, the bot offers peace; it accepts a peace the rival offers this turn only when it is
//     not winning.
//   8 PERSONALITY — the king's Temper moves the bar (Berserk −0.25 … Cowardly +0.3), with a small
//     fixed per-realm lean; a new war is kept minWarTurns before peace is weighed, and a new peace
//     peaceCooldown turns before war is weighed again.
// The Aggressive bot-diplomacy setting, a Reckoning claim, the grudge (with its survival exception)
// and alignment alliances (one step or less; never with a realm allied to one of our enemies) are
// decided before this is consulted (botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim).
// Tuning 2026-09-29b (Toby: "I still want bloody games") — chosen over 32 fuzz games of 6 bots × 20 turns
// against the old war-on-contact rule: realm battles ≈ the same (38 vs 38 a game), realms eliminated
// 17 vs 12, ~7 standing wars a game at mid-game.
export const BOT_WAR = {
  base: 0.8,
  floor: 0.75,
  farStep: 0.1,
  dark: 0.15,
  expand: 0.1,
  stallFree: 3,
  oppStep: 0.2,
  oppCap: 0.5,
  peaceRatio: 0.35,
  peaceLosses: 3,
  minWarTurns: 5,
  peaceCooldown: 6,
  allyWeight: 0.6,
  burden: 0.25,
  knowTurns: 4,
  newsTurns: 4,
  landUnit: 5,
  farFromHome: 3,
  temper: { Berserk: -0.25, Brave: -0.1, Cautious: 0.15, Cowardly: 0.3 },
  grudgeYield: 5,
  grudgeRecall: 2, // a grudge yields when the human is 5× our strength, returns at 2×
  prizeHops: 2, // a prize may lie on our border or one province beyond it
  losingRatio: 0.6, // no new war while any foe is > 1/0.6 ≈ 1.7× our own strength
  noPrizeMult: 1.3, // with no prize in reach, war still if the ratio clears 1.3× the bar
  acceptRatio: 0.9,
  acceptNoPrize: 0.7,
}; // accept a rival's peace below these ratios (and below the bar)
// Battles between two realms, kept a few turns so bots can read recent fortunes (GM creditBattle).
export function noteRealmBattle(
  G: GameState,
  provId: number | null,
  atk: number,
  def: number,
  won: boolean,
  atkLost: number | undefined,
  defLost: number | undefined,
) {
  const t = G.turn || 0;
  const H = theNewsHolder(G);
  const kept = (H._battleNews ?? []).filter((x) => x && t - x.t <= BOT_WAR.newsTurns);
  H._battleNews = kept;
  kept.push({ t, p: provId, a: atk, d: def, w: won ? 1 : 0, al: Number(atkLost) || 0, dl: Number(defLost) || 0 });
}
// News of a battle reaches realm pi if it or an ally fought in it, or it can see the field.
export function botHeardBattle(G: GameState, pi: number, x: ABattlesNews) {
  if (x.a === pi || x.d === pi) return true;
  if (botRelationRaw(G, pi, x.a) === 'allied' || botRelationRaw(G, pi, x.d) === 'allied') return true;
  return x.p != null && botSees(G, pi, x.p);
}
export function botOwnPower(G: GameState, pi: number) {
  let field = 0,
    gar = 0,
    heroes = 0,
    inc = 0;
  theCharactersOf(G).forEach((c) => {
    if (!(c?.alive && c.player === pi)) return;
    heroes++;
    if ((asItsGuardReadsIt(c.armies) ?? []).length) field += botBattleForce(G, c, null, 'plain', { viewerPi: pi });
  });
  theProvincesOf(G).forEach((p) => {
    if (p?.owner !== pi) return;
    inc += p.tax || 0;
    gar += botForceStrength(p.garrisonArmies);
  });
  return field + 0.5 * gar + 2 * inc + 3 * heroes;
}
// What realm pi BELIEVES realm j can put in the field. Hosts seen lately (their plain-ground
// strength), or — where the realm has seen little — about one unit for each province it has seen
// them hold; their wealth from the land it has seen; the characters it has met.
export function botRivalPower(G: GameState, pi: number, j: number) {
  const I = botEnemyIntel(G, pi),
    turn = G.turn || 0,
    seen = new Set<string>();
  let field = 0;
  Object.entries(theSightingsIn(I.generals)).forEach(([k, r]) => {
    if (r?.player === j && turn - r.turn <= BOT_WAR.knowTurns) {
      field += r.strength || 0;
      seen.add(k);
    }
  });
  Object.entries(theSightingsIn(I.heroes)).forEach(([k, r]) => {
    if (r?.player === j && turn - r.turn <= 6) seen.add(k);
  });
  theCharactersOf(G).forEach((e) => {
    if (!(e?.alive && e.player === j) || seen.has(String(e.id)) || !botSeesChar(G, pi, e)) return;
    seen.add(String(e.id));
    if ((asItsGuardReadsIt(e.armies) ?? []).length) field += botBattleForce(G, e, null, 'plain', { viewerPi: pi });
  });
  let inc = 0,
    land = 0;
  theProvincesOf(G).forEach((p) => {
    if (!p || !botKnows(G, pi, p.id)) return;
    const b = botBelief(G, pi, p);
    if (b?.owner !== j) return;
    inc += b.tax || 0;
    if (b.terrain !== 'sea') land++;
  });
  field = Math.max(field, land * BOT_WAR.landUnit);
  return field + 3 + 2 * inc + 3 * Math.max(1, seen.size); // +3: the capital's garrison, assumed
}
// The realm's standing with j: {since, peaceAt} kept on the player record.
export function botWarBook(
  G: GameState,
  pi: number,
  j: number,
): { since?: number | undefined; peaceAt?: number | undefined } {
  const p = theRealmsOf(G)[pi];
  if (!p) return {};
  const books = p._botWar ?? {};
  p._botWar = books;
  const b = books[j] ?? {};
  books[j] = b;
  if (botRelationRaw(G, pi, j) === 'enemy') {
    b.since ??= G.turn || 0;
  } else if (b.since != null) {
    b.peaceAt = G.turn || 0;
    delete b.since;
  }
  return b;
}
// Is there a province of j's on our border that one of our hosts could take?
export function botWarPrize(G: GameState, pi: number, j: number) {
  const hosts = theCharactersOf(G).filter(
    (c) => c?.alive && c.player === pi && (asItsGuardReadsIt(c.armies) ?? []).length,
  );
  if (!hosts.length) return false;
  const T = botTuning(G, pi);
  const margin = Math.min(T.kingAttackMargin || 1.2, T.heroAttackMargin || 1.2);
  return theProvincesOf(G).some((X) => {
    if (!X || X.terrain === 'sea' || !botKnows(G, pi, X.id) || botBelievedOwner(G, pi, X) !== j) return false;
    // on our border — or, with prizeHops 2, one province beyond it
    let border = false;
    for (let i = 0; i < 6 && !border; i++) {
      const N = botNeighbourProv(G, X, i);
      if (!N || N.terrain === 'sea') continue;
      if (N.owner === pi) {
        border = true;
        break;
      }
      if (BOT_WAR.prizeHops >= 2)
        for (let k = 0; k < 6; k++) {
          const M = botNeighbourProv(G, N, k);
          if (M?.owner === pi && M.terrain !== 'sea') {
            border = true;
            break;
          }
        }
    }
    if (!border) return false;
    const def = botTargetDefence(G, pi, X);
    return hosts.some((c) => botBattleForce(G, c, null, X.terrain, { viewerPi: pi }) >= def * margin);
  });
}
// Free neutral land still on our border (and we are not stalled against it)?
export function botStillExpanding(G: GameState, pi: number) {
  if (botStallTurns(G, pi) >= BOT_WAR.stallFree) return false;
  return theProvincesOf(G).some((P) => {
    if (P?.owner !== pi || P.terrain === 'sea') return false;
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, P, i);
      if (!N || N.terrain === 'sea' || !botKnows(G, pi, N.id)) continue;
      if (botBelievedOwner(G, pi, N) === null) return true;
    }
    return false;
  });
}
export function botWarAssess(
  G: GameState,
  pi: number,
  j: number,
  opts: { readonly offeredPeace?: boolean | undefined } | null | undefined,
) {
  opts = opts ?? {};
  const turn = G.turn || 0,
    pls = theRealmsOf(G);
  const book = botWarBook(G, pi, j),
    rel = botRelationRaw(G, pi, j);
  // 1 + 6: the two sides
  let mine = botOwnPower(G, pi),
    theirs = botRivalPower(G, pi, j),
    losingElsewhere = false;
  for (const [k, q] of pls.entries()) {
    if (!q || k === pi || k === j || q.conceded || q._eliminated) continue;
    const rpk = botRelationRaw(G, pi, k),
      rjk = botRelationRaw(G, j, k);
    if (rpk === 'allied') mine += BOT_WAR.allyWeight * botRivalPower(G, pi, k);
    else if (rjk === 'allied') theirs += BOT_WAR.allyWeight * botRivalPower(G, pi, k); // alliances are known to all
    if (rpk === 'enemy') {
      const pk = botRivalPower(G, pi, k);
      mine -= BOT_WAR.burden * pk;
      if (botOwnPower(G, pi) < pk * BOT_WAR.losingRatio) losingElsewhere = true;
    }
  }
  const ratio = Math.max(0, mine) / Math.max(1, theirs);
  // 3: opportunities
  const opp: string[] = [];
  const news = (theNewsHolder(G)._battleNews ?? []).filter(
    (x): x is ABattlesNews => !!x && turn - x.t <= 3 && botHeardBattle(G, pi, x),
  );
  if (news.some((x) => (x.a === j && !x.w) || (x.d === j && x.w))) opp.push('lost a battle');
  if (
    theCharactersOf(G).some(
      (c) => c?.alive && c.isKing && c.player === j && c._crownedTurn != null && turn - c._crownedTurn <= 4,
    )
  )
    opp.push('new heir');
  if (
    pls.some(
      (q, k) =>
        q && k !== pi && k !== j && botRelationRaw(G, pi, k) === 'allied' && botRelationRaw(G, k, j) === 'enemy',
    )
  )
    opp.push('ally at war with them');
  const home = pls[j]?.homeProvinceId,
    H = home != null ? G.world.provinces[home] : null;
  if (H && botKnows(G, pi, H.id)) {
    const I = botEnemyIntel(G, pi);
    if (
      Object.entries(theSightingsIn(I.generals)).some(([, r]) => {
        if (!(r?.player === j && turn - r.turn <= 2 && r.provId != null && r.provId !== H.id)) return false;
        const P = G.world.provinces[r.provId];
        if (!P) return false;
        const d = botPathLenAny(G, P, H.id, BOT_WAR.farFromHome);
        return d == null || d >= BOT_WAR.farFromHome;
      })
    )
      opp.push('host far from home');
    if (
      botSees(G, pi, H.id) &&
      H.owner === j &&
      !(asItsGuardReadsIt(H.garrisonArmies) ?? []).length &&
      !botVisibleCharsIn(G, pi, H).some((e) => e.player === j && (asItsGuardReadsIt(e.armies) ?? []).length)
    )
      opp.push('capital unguarded');
  }
  // 5 + 8 + alignment: the bar
  const king = theCharactersOf(G).find((c) => c?.alive && c.isKing && c.player === pi);
  const lean = (((pi * 37 + (pls[pi]?.name ?? '').length * 11) % 21) - 10) / 100; // fixed per realm, −0.10…+0.10
  // the tempers' table read by any temper's name, as JavaScript read it (a king of none: the key 'undefined')
  const tempers: Readonly<Partial<Record<string, number>>> = BOT_WAR.temper;
  const dist = alignDistP(botAlignOf(G, pi), botAlignOf(G, j));
  const expanding = botStillExpanding(G, pi);
  let thr =
    BOT_WAR.base +
    (tempers[String(king?.temper)] ?? 0) +
    lean -
    (['Evil', 'Undead'].includes(botAlignOf(G, pi)) ? BOT_WAR.dark : 0) -
    Math.max(0, dist - 2) * BOT_WAR.farStep +
    (expanding ? BOT_WAR.expand : 0) -
    Math.min(BOT_WAR.oppCap, opp.length * BOT_WAR.oppStep);
  thr = Math.max(BOT_WAR.floor, thr);
  const prize = botWarPrize(G, pi, j);
  // 7: our record against them lately
  let wins = 0,
    losses = 0;
  (theNewsHolder(G)._battleNews ?? []).forEach((x) => {
    if (!x || turn - x.t > BOT_WAR.newsTurns) return;
    if (x.a === pi && x.d === j) {
      if (x.w) wins++;
      else losses++;
    } else if (x.a === j && x.d === pi) {
      if (x.w) losses++;
      else wins++;
    }
  });
  let decision: 'peace' | 'war' | null = null,
    why = '';
  if (rel === 'enemy') {
    const age = book.since != null ? turn - book.since : 99;
    if (age >= BOT_WAR.minWarTurns) {
      if (ratio < BOT_WAR.peaceRatio) {
        decision = 'peace';
        why = 'outmatched';
      } else if (losses >= BOT_WAR.peaceLosses && losses > wins) {
        decision = 'peace';
        why = 'losing the battles';
      } else if (
        opts.offeredPeace &&
        (ratio < Math.min(thr, BOT_WAR.acceptRatio) || (!prize && ratio < BOT_WAR.acceptNoPrize))
      ) {
        decision = 'peace';
        why = 'accepts their offer';
      }
    }
  } else if (rel === 'neutral') {
    const cooling = book.peaceAt != null && turn - book.peaceAt < BOT_WAR.peaceCooldown;
    if (!cooling && !losingElsewhere && (prize || ratio >= thr * BOT_WAR.noPrizeMult) && ratio >= thr) {
      decision = 'war';
      why = opp.length ? opp.join(', ') : 'stronger';
    }
  }
  return { decision, why, ratio, thr, prize, expanding, opp, losingElsewhere, wins, losses };
}
// Phase 4b — CONCENTRATED ASSAULT planning. A strong enemy province no single character can crack
// is left alone by the solo attack logic. Here we gang up: if ≥2 of a bot's FREE characters are
// each adjacent to the same at-war enemy province, none can win alone, but their COMBINED force
// clears it with a comfortable margin, we order them all to march on it THIS phase. Orders use the
// numeric province id (not a dir: string) because the engine only unifies co-attackers whose move
// target equals the province id (contingent-unify roll, driven by the lead's March skill). "Free"
// excludes characters pinned to hold their own threatened capital or needed to reinforce a
// threatened valuable neighbour — defence outranks a gang-up. Assigned character ids are added to
// `assigned` so the per-character pass skips them.
export function botPlanAssaults(G: GameState, pi: number, chars: readonly Character[], assigned: Set<number>) {
  const T = botTuning(G, pi);
  const ASSAULT_MARGIN = T.assaultMargin; // combined edge needed (buffers the unify roll)
  const isPinnedOrNeeded = (c: Character, P: Province) => {
    if (!(P.owner === pi && botIsValuable(G, P, pi))) {
      /* not on valuable ground */
    } else {
      // would P fall if c left?
      let remaining = 0;
      (asItsGuardReadsIt(P.characters) ?? []).forEach((id) => {
        if (id === c.id) return;
        const f = theCharactersOf(G).find((x) => x?.id === id);
        if (f?.alive && f.player === pi) remaining += botForceStrength(f.armies);
      });
      (asItsGuardReadsIt(P.garrisonArmies) ?? []).forEach((a) => {
        remaining += unitBaseStrength(a);
      });
      let maxAdj = 0;
      // the host next door counts only if the realm can see it standing there.
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, P, i);
        if (!N) continue;
        let s = 0;
        botVisibleCharsIn(G, pi, N).forEach((e) => {
          if (e.player != null && e.player !== pi && botRelationRaw(G, pi, e.player) === 'enemy')
            s += botForceStrength(e.armies);
        });
        if (s > maxAdj) maxAdj = s;
      }
      if (maxAdj >= remaining) return true; // pinned to hold this province
    }
    // needed to reinforce a threatened valuable neighbour?
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, P, i);
      if (N?.owner === pi && botIsValuable(G, N, pi) && botDefenceNeed(G, N, pi) > 0) return true;
    }
    return false;
  };
  // enemy province id → [{c, dirIdx}] of our FREE characters adjacent to it
  const byTarget: Record<number, { c: Character; dirIdx: number }[]> = {};
  chars.forEach((c) => {
    if (assigned.has(c.id)) return;
    const P = G.world.provinces[c.location];
    if (!P) return;
    if (isPinnedOrNeeded(c, P)) return; // defence first
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, P, i);
      if (!N || N.terrain === 'sea') continue;
      if (N.owner == null || N.owner === pi) continue;
      if (botRelationRaw(G, pi, N.owner) !== 'enemy') continue;
      const here = byTarget[N.id] ?? [];
      byTarget[N.id] = here;
      here.push({ c, dirIdx: i });
    }
  });
  // Rank candidate targets (richest / weakest first) and commit greedily.
  const cands = Object.entries(byTarget)
    .map(([tid, list]) => {
      const X = theTargetedProvince(G, +tid),
        def = botTargetDefence(G, pi, X);
      return { X, list, def, score: (X.tax || 0) * 10 - def };
    })
    .filter((o) => o.list.length >= 2)
    .sort((a, b) => b.score - a.score);
  cands.forEach(({ X, list, def }) => {
    const free = list.filter(({ c }) => !assigned.has(c.id));
    if (free.length < 2) return;
    const soloWinner = free.some(
      ({ c }) => botBattleForce(G, c, null, X.terrain, undefined) >= def * botMarginFor(G, pi, c, T),
    );
    if (soloWinner) return; // a single character can take it — let the solo pass do it
    const combined = free.reduce((s, { c }) => s + botBattleForce(G, c, null, X.terrain, undefined), 0);
    if (combined < def * ASSAULT_MARGIN) return; // not worth throwing armies at
    free.forEach(({ c }) => {
      theTurnsOrders(G)[c.id] = botFillOrders(
        G,
        pi,
        c,
        [],
        [{ action: 'move', target: String(X.id), extra: '', desc: 'Assault' }],
      ); // numeric id → engine can unify
      assigned.add(c.id);
    });
  });
}
// HUNT ENEMY LEADERS. At-war enemy player-characters standing in a province: their pooled force
// (folded into winnability) and a hunt-score bonus so bots chase down heroes and especially KINGS
// (a king's death triggers succession and can swing the game). hasKing also earns a slimmer attack
// margin — bots take a little more risk to land an assassination.
// ── NAVAL ────
// Module-level mirrors of the engine's sea taxonomy + getSeaCapability, so the bot movement/economy
// passes (which live at module scope, above runTurn) can reason about fleets. Kept in sync with the
// in-engine sets around the FLYING_TYPES/CARRIER_TYPES block.
// The carrier, primal-sea, aerial and all-sea sets, and BOT_MONSTER_ARMIES, are in bots/intel.ts.
// BOT_FLYING_TYPES, BOT_CREATURE_ARMIES and BOT_CAVALRY_TYPES are in bots/strategy.ts.
export const BOT_LIGHT_ARMIES = new Set(KC_UNIT_CLASS.lightFoot); // mirrors LIGHT_ARMIES in getSeaCapability
// 'all' (empty / only flyers-or-sea), 'sea' (fleets carry every land unit aboard), or 'land' (not
// enough hulls to put to sea). Mirrors getSeaCapability exactly.
// bot mirror of getFlyCapability — can the humanoid flyers lift every foot soldier so the whole
// column flies (and crosses sea without a fleet)?
export function botCanFly(armies: TheUnitsAsTheNavalChecksReadThem) {
  armies = armies ?? [];
  if (!armies.length) return false;
  let carriers = 0,
    carried = 0,
    selfFly = false;
  for (const a of armies) {
    if (!a) continue;
    if (BOT_FLYING_TYPES.has(a.type)) {
      carriers++;
      selfFly = true;
      continue;
    }
    if (BOT_AERIAL_TYPES.has(a.type)) {
      selfFly = true;
      continue;
    }
    if (
      BOT_SEA_ALL.has(a.type) ||
      BOT_CREATURE_ARMIES.has(a.type) ||
      BOT_MONSTER_ARMIES.has(a.type) ||
      BOT_CAVALRY_TYPES.has(a.type)
    )
      return false;
    carried++;
  }
  return selfFly && carriers >= carried;
}
export function botSeaCap(armies: TheUnitsAsTheNavalChecksReadThem) {
  armies = armies ?? [];
  if (armies.length === 0) return 'all';
  const landArmies = armies.filter((a): a is Army => !!a && !BOT_AERIAL_TYPES.has(a.type) && !BOT_SEA_ALL.has(a.type));
  const hulls = armies.filter((a) => a && BOT_CARRIER_TYPES.has(a.type)).length;
  if (landArmies.length === 0) return 'all';
  if (botCanFly(armies)) return 'sea'; // airborne column crosses sea
  // mirrors getSeaCapability's pooled hull+flyer lift exactly.
  const capOf = (a: Army) => (BOT_LIGHT_ARMIES.has(a.type) ? 0.5 : 1);
  const liftableB = (a: Army) =>
    !(
      BOT_SEA_ALL.has(a.type) ||
      BOT_AERIAL_TYPES.has(a.type) ||
      BOT_CREATURE_ARMIES.has(a.type) ||
      BOT_MONSTER_ARMIES.has(a.type) ||
      BOT_CAVALRY_TYPES.has(a.type)
    );
  let room = hulls - landArmies.filter((a) => !liftableB(a)).reduce((s, a) => s + capOf(a), 0);
  if (room < 0) return 'land';
  let byAir = 0;
  landArmies
    .filter(liftableB)
    .sort((a, b) => capOf(a) - capOf(b))
    .forEach((a) => {
      const c = capOf(a);
      if (room >= c) room -= c;
      else byAir++;
    });
  return byAir <= armies.filter((a) => a && BOT_FLYING_TYPES.has(a.type)).length ? 'sea' : 'land';
}
// A force carrying land troops it can ferry (has fleets AND land armies) — the invasion package.
export function botIsLoadedFleet(armies: TheUnitsAsTheNavalChecksReadThem) {
  armies = armies ?? [];
  return (
    armies.some((a) => a && BOT_CARRIER_TYPES.has(a.type)) &&
    armies.some((a) => a && !BOT_AERIAL_TYPES.has(a.type) && !BOT_SEA_ALL.has(a.type))
  );
}
// seek out a beatable, uncleared lair in our OWN adjacent land (safe to enter) so heroes actively
// go clear hoards rather than only searching lairs they happen to stand on.
export function botLairDir(G: GameState, P: Province, c: Character, pi: number) {
  // botKnownFeatures — an UNDISCOVERED lair is not on this realm's map. A player must Explore or
  // Search to find one; bots were reading every hoard in their territory the moment the world was
  // generated.
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, P, i);
    if (!N || N.terrain === 'sea' || N.owner !== pi) continue;
    if (
      botKnownFeatures(G, pi, N).some((f) => !f.cleared && !f.ritualSite && botCanBeatGuardian(c, f.monster, G, pi, f))
    )
      return i;
  }
  return -1;
}
