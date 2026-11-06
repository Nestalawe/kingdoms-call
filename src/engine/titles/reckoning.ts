import { TITLE_DEFS } from '../../content/kingdoms-call-data.ts';
import { theHighestLevelAHeroHasTrainedInAMagicSchool } from '../rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import {
  MINOR_CAV,
  MINOR_HEAVY,
} from '../rules-on-plain-values/the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts';
import { ITEMS_BY_TIER } from '../items/tiers-and-hoards.ts';
import { _skillItem, activeItems } from '../items/equipment.ts';
import { botConceded } from '../bots/intel.ts';
import { theLevelsARealmsDiscoveriesAddToAFightersSkills } from '../rules/the-registry-of-discovery-effects.ts';
import {
  RECKONING_CALLER_MIN_FRAC,
  RECKONING_MIN_TURN,
  RELIC_PRIZE_EACH,
  _MAGIC_SCHOOLS,
  reckoningAllyStepPct,
  reckoningDecayOf,
  reckoningThreshold,
  skillLevel,
} from './perks.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { ARealmAsTheDiscoveriesReadIt } from '../rules/the-registry-of-discovery-effects.ts';
import type { RealmIndex } from '../../schemas/ids-of-provinces-heroes-and-realms.ts';
import type {
  Army,
  Character,
  Item,
  MajorTitleHolder,
  MinorTitleHolder,
  Province,
  Realm,
} from '../../schemas/saved-game-state.ts';

// Its types (plan P1-10b35): each parameter typed from what its callers pass and as wide as the body's guards (plan
// P1-10's Decision 2), so each guard stays: the standings read a world whose lists, and a gap in them, may be missing.

/** A hero as the titles count him: the saved hero, his items (a gap among them too) and his companies a list a guard
 *  may find missing. */
type AHeroAsTheTitlesCountHim = Omit<Character, 'items' | 'armies'> & {
  readonly items?: (Item | null | undefined)[] | null | undefined;
  readonly armies?: readonly Army[] | null | undefined;
};
/** A living hero who serves a realm: the only heroes the titles count. */
type AHeroOfARealmAsTheTitlesCountHim = AHeroAsTheTitlesCountHim & { readonly player: RealmIndex };
/** Whether a hero counts towards the titles: there (not a gap), alive and serving a realm. */
function aLivingHeroTheTitlesCount(
  c: AHeroAsTheTitlesCountHim | null | undefined,
): c is AHeroOfARealmAsTheTitlesCountHim {
  return c?.player != null && c.alive;
}
/** A realm as the standings read it: its name, colour, creed and treasury. */
type ARealmAsTheStandingsReadIt = Pick<Realm, 'name' | 'color' | 'alignment' | 'gold'>;
/** The world as the standings read it: its realms, its heroes and its provinces (a list, or a gap in one, may be
 *  missing in a staged world), and the Reckoning's decay. */
interface TheWorldAsTheStandingsReadIt {
  readonly players?: readonly (ARealmAsTheStandingsReadIt | null | undefined)[] | null | undefined;
  readonly characters?: readonly (AHeroAsTheTitlesCountHim | null | undefined)[] | null | undefined;
  readonly world?:
    | { readonly provinces?: readonly (Pick<Province, 'owner' | 'tax'> | null | undefined)[] | null | undefined }
    | null
    | undefined;
  readonly reckoningDecaySteps?: number | undefined;
}
/** The world as the Reckoning reads it: the standings', the realms' relations, the turn and the game's end. */
interface TheWorldAsTheReckoningReadsIt extends TheWorldAsTheStandingsReadIt {
  readonly relations?: Readonly<Partial<Record<string, string>>> | null | undefined;
  readonly turn?: number | undefined;
  readonly gameOver?: object | null | undefined;
}
/** A hero's merit towards each Imperial Title a hero holds (not the Throne's or the Vaultkeeper's), by its key. */
type AHerosMeritTowardsEachTitle = Readonly<Partial<Record<string, number>>>;
/** A realm's figure on the board (its tax base, its treasury) at its index: each realm has one. */
function theRealmsFigureOnTheBoard(figures: readonly number[], index: number): number {
  const figure = figures[index];
  if (figure === undefined) throw new TypeError(`reckoningWinner: no figure for realm ${String(index)}`);
  return figure;
}
/** A realm's row on the standings at its index: each realm has one (a hero's realm with none throws, as before). */
function theRealmsRowOnTheStandings(standings: readonly ARealmsStanding[], index: number): ARealmsStanding {
  const row = standings[index];
  if (row === undefined) throw new TypeError(`computeStandings: no realm ${String(index)} on the standings`);
  return row;
}

/** A realm's row on the standings board (computeStandings): its name and colour, its score, the titles it holds by key
 *  and its relics. */
export interface ARealmsStanding {
  index: number;
  name: string;
  color: string | null;
  alignment: string | null;
  score: number;
  titles: string[];
  relics: number;
}
/** A bonus a hero's skill gets at its point of use (extraSkillBonuses): a minor title's or a discovery's, with the
 *  kind that colours it, the scope that says when it applies, and the scope's words. */
export interface ASkillBonusAtItsPointOfUse {
  label: string;
  delta: number;
  kind: string;
  scope: string;
  note: string;
}

export function _legendaryNames() {
  return new Set((asItsGuardReadsIt(ITEMS_BY_TIER[4]) ?? []).map((it) => it.name));
}
// THE SEA LORD NO LONGER COUNTS THE WAVES. `SEA_LORD_PROVINCE_PTS` gave one merit point per sea
// province the character's REALM held, folded into every one of that realm's characters. It was the
// only territorial component in any character title, and it meant a realm that ruled the deep could
// hold the Sea Lord's baton on geography alone with a mediocre admiral. Withdrawn: the title is now
// the admiral's own Naval skill and the battles they have actually won at sea.
export function _charTitleMerit(c: AHeroAsTheTitlesCountHim) {
  const tm: Partial<NonNullable<Character['tm']>> = c.tm ?? {};
  const magic = _MAGIC_SCHOOLS.reduce((s, sc) => s + _skillItem(c, sc), 0);
  const schools: readonly (string | undefined)[] = _MAGIC_SCHOOLS;
  const spellItems = activeItems(c).filter((it) => schools.includes(asItsGuardReadsIt(it.effect)?.stat)).length;
  return {
    // 2026-09-16 \u2014 ROOT CAUSE of "The Grand Marshal shows as vacant even though it is
    // awarded". It was not a display fault: the title really WAS vacant. `marshal` was the only one
    // of the nine titles whose metric was PURE battle merit with no standing component, and
    // computeStandings requires merit > 0 to hand a title out. tm.marshal only ever moves in a
    // player-vs-player land battle (creditBattle), and it moves DOWN for the loser \u2014 so in any
    // game where the realms have not yet fought each other on land, or where the wins and losses
    // have cancelled, every character sat at 0 and the title fell vacant while all eight others
    // were held. The Sea Lord has always carried `_skillItem(c,'naval')` as its standing component
    // for exactly this reason; the Grand Marshal now carries Tactical the same way. A realm's best
    // general holds the marshal's baton from turn one, and battle merit decides it the moment
    // anyone fights.
    marshal: (Number(tm.marshal) || 0) + _skillItem(c, 'tactical'),
    sea: (Number(tm.sea) || 0) + _skillItem(c, 'naval'),
    monster: Number(tm.monster) || 0,
    // the Loremaster was a THREE-SKILL BUNDLE (Explorer + Spy + Sage) that also counted every map
    // feature stumbled across at double weight. It swallowed the whole espionage and exploration
    // space, so no Spy or Explorer character could ever be honoured for what they actually did.
    // Explorer now belongs to the Cartographer and Spy to the Spymaster; the Loremaster keeps the
    // scholar's own skill and the discoveries their research has produced, at one point apiece.
    lore: _skillItem(c, 'sage') + (Number(tm.discoveries) || 0),
    arch: magic + spellItems,
    // Druid withdrawn \u2014 the Hierophant is a title of the White faith, and folding in a second
    // skill let a druid with no holy casts at all out-score a working priest.
    hiero: _skillItem(c, 'white') + (Number(tm.holyCasts) || 0),
    necro: _skillItem(c, 'necromancy') + (Number(tm.darkCasts) || 0),
    // ── 2026-09-17: the four new titles ────
    // `tm.spyActions` counts SUCCESSES only (see the spy/sabotage/assassination sites); a failed
    // infiltration earns nothing. `tm.explored` banks raw percentage POINTS of ground mapped and is
    // divided down here, so the accumulator keeps its precision and only the score is coarse.
    spy: _skillItem(c, 'spy') + (Number(tm.spyActions) || 0),
    carto: _skillItem(c, 'explorer') + Math.floor((Number(tm.explored) || 0) / 10),
    // Pure deed titles, like the Monster-Bane: no standing skill floor, so they sit vacant until
    // somebody actually musters beasts. That is intended \u2014 there is no "beast skill" to stand
    // on.
    beast: Number(tm.monsterHost) || 0,
    wild: Number(tm.wildHost) || 0,
  };
}
// A realm's Reckoning bloc = THAT REALM AND ITS OWN DIRECT ALLIES. Nobody else.
//
// ROOT CAUSE of "the bloc maths makes no sense once players can ally freely". Toby's own example:
// in a 4-realm game A is allied with B and C, and B is separately allied with D. Those are two
// blocs (A+B+C, and B+D), but the
// closure walked A→B→D and returned all four realms as ONE bloc holding 100% of the world, so every
// one of them could Call the Reckoning on the strength of an alliance that half of them were not
// party to — including realms actively at war with each other. Measured over 30,000 random mature
// worlds the closure made a claim callable in 53% of them against 44.6% for direct allies, with an
// average "bloc" of 3.3 realms.
//
// A claim is now carried by the realms the claimant is ACTUALLY allied to. An ally's own alliances
// are that ally's business; they bring themselves to the claim, not their friends. Each of those
// allies also raises the bar (reckoningAllyStepPct), so a bloc is a real commitment rather than a
// free ride, and a bloc padded with tiny passengers is worse than no bloc at all.
export function alliedBloc(state: Pick<TheWorldAsTheReckoningReadsIt, 'relations' | 'players'>, pi: number): number[] {
  const rel = state.relations ?? {},
    np = (state.players ?? []).length;
  const key = (a: number, b: number) => (a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`);
  const out = [pi];
  for (let y = 0; y < np; y++) {
    if (y !== pi && rel[key(pi, y)] === 'allied') out.push(y);
  }
  return out;
}
// Main scoring — pure function over a game state. Returns titles, relics, per-realm standings, tax.
export function computeStandings(state: TheWorldAsTheStandingsReadIt): {
  titles: Partial<Record<string, MajorTitleHolder>>;
  relics: { item: string; charId: number; playerIndex: number }[];
  standings: ARealmsStanding[];
  taxByPlayer: number[];
  worldTax: number;
  goldByPlayer: number[];
  threshold: number;
  perChar: Partial<Record<string, AHerosMeritTowardsEachTitle>>;
} {
  const players = state.players ?? [];
  const chars = (state.characters ?? []).filter(aLivingHeroTheTitlesCount);
  // Reckoning tax base counts EVERY province — land AND sea (owned sea now carries features,
  // guardians and real tax, so a fleet realm's waters DO count toward the Reckoning). Both the
  // per-player share (numerator) and the world total (denominator) include sea.
  const taxByPlayer = players.map((p, pi) =>
    (state.world?.provinces ?? []).reduce((s, pv) => s + (pv?.owner === pi ? pv.tax || 0 : 0), 0),
  );
  // Denominator = every province in the world (owned or neutral-and-conquerable), sea included.
  const worldTax = (state.world?.provinces ?? []).reduce((s, pv) => {
    if (!pv) return s;
    return s + (pv.tax || 0);
  }, 0);
  const goldByPlayer = players.map((p) => (p?.gold ?? 0) || 0);
  const perChar: Partial<Record<string, AHerosMeritTowardsEachTitle>> = {};
  // the per-alignment \u00d71.25 lane boost is gone (see ALIGN_TITLE_BOOST's obituary above). A
  // character's merit is now exactly what their deeds, skills and holdings come to, whatever creed
  // their realm follows.
  chars.forEach((c) => {
    perChar[String(c.id)] = _charTitleMerit(c);
  });
  const titles: Partial<Record<string, MajorTitleHolder>> = {};
  TITLE_DEFS.forEach((t) => {
    if (t.key === 'throne' || t.key === 'vault') {
      const metric = t.key === 'throne' ? taxByPlayer : goldByPlayer;
      let best = -1,
        bi = -1;
      metric.forEach((v, pi) => {
        if (v > best) {
          best = v;
          bi = pi;
        }
      });
      const king = chars.find((c) => c.isKing && c.player === bi);
      titles[t.key] = {
        playerIndex: bi >= 0 && best > 0 ? bi : null,
        charId: bi >= 0 && best > 0 && king ? king.id : null,
        merit: best,
        prize: t.prize,
        name: t.name,
      };
    } else {
      let best = -Infinity,
        bc: AHeroOfARealmAsTheTitlesCountHim | null = null;
      for (const c of chars) {
        const merit = perChar[String(c.id)];
        if (merit === undefined) throw new TypeError(`computeStandings: no merit worked out for hero ${String(c.id)}`);
        const v = Number(merit[t.key]) || 0;
        if (v > best) {
          best = v;
          bc = c;
        }
      }
      titles[t.key] = {
        playerIndex: bc && best > 0 ? bc.player : null,
        charId: bc && best > 0 ? bc.id : null,
        merit: best > -Infinity ? best : 0,
        prize: t.prize,
        name: t.name,
      };
    }
  });
  const legNames = _legendaryNames(),
    relics: { item: string; charId: number; playerIndex: number }[] = [];
  chars.forEach((c) => {
    (c.items ?? []).forEach((it) => {
      if (it && legNames.has(it.name)) relics.push({ item: it.name, charId: c.id, playerIndex: c.player });
    });
  });
  const standings = players.map((p, pi): ARealmsStanding => ({
    index: pi,
    name: (p?.name ?? '') || `Realm ${String(pi + 1)}`,
    color: (p?.color ?? '') || null,
    alignment: (p?.alignment ?? '') || null,
    score: 0,
    titles: [],
    relics: 0,
  }));
  TITLE_DEFS.forEach((t) => {
    const h = titles[t.key];
    if (h?.playerIndex != null) {
      const row = theRealmsRowOnTheStandings(standings, h.playerIndex);
      row.score += t.prize;
      row.titles.push(t.key);
    }
  });
  relics.forEach((r) => {
    if (asItsGuardReadsIt(r.playerIndex) != null) {
      const row = theRealmsRowOnTheStandings(standings, r.playerIndex);
      row.score += RELIC_PRIZE_EACH;
      row.relics++;
    }
  });
  return {
    titles,
    relics,
    standings,
    taxByPlayer,
    worldTax,
    goldByPlayer,
    threshold: reckoningThreshold(players.length, reckoningDecayOf(state)),
    perChar,
  };
}
/** The standings as the title race reads them (computeStandings'; the player page's copy hands its own): who holds
 *  each title, each realm's tax base and treasury, and each hero's merit towards each title, each of them missing in
 *  a staged one. */
interface TheStandingsAsTheTitleRaceReadsThem {
  readonly titles?: Readonly<Partial<Record<string, MajorTitleHolder>>> | null | undefined;
  readonly taxByPlayer?: readonly number[] | null | undefined;
  readonly goldByPlayer?: readonly number[] | null | undefined;
  readonly perChar?: Readonly<Partial<Record<string, AHerosMeritTowardsEachTitle>>> | null | undefined;
}
/** Where a realm stands in a title's race (titleRaceFor): its best hero's name, whether the title is vacant or its
 *  own, its share of the holder's merit, or its lead over the closest rival and whether anyone challenges it. */
export interface ARealmsPlaceInATitlesRace {
  charName: string | null;
  vacant: boolean;
  mine: boolean;
  pct: number | null;
  leadPct: number | null;
  unchallenged: boolean;
}
// THE TITLE RACE, as one realm sees it. For every Imperial Title: which of this realm's living
// characters stands highest, and where that puts them —
//   • not the holder → `pct` = their merit as a whole percentage of the HOLDER's (floored, 0-100);
//   • the holder     → `leadPct` = 100 − (the closest RIVAL-realm character's merit as a percentage
//                       of the holder's), i.e. how many percentage points clear they are. A rival
//                       is a character of ANOTHER realm; the holder's own second-best is no rival.
// Realm titles (Throne, Vaultkeeper) use the realm metric and name the king. Only percentages are
// shipped — never a rival's name or raw merit — so this leaks nothing the standings board does not.
export function titleRaceFor(
  state: Pick<TheWorldAsTheStandingsReadIt, 'characters'>,
  st: TheStandingsAsTheTitleRaceReadsThem,
  pi: number,
): Partial<Record<string, ARealmsPlaceInATitlesRace>> {
  const chars = (state.characters ?? []).filter(aLivingHeroTheTitlesCount);
  const out: Partial<Record<string, ARealmsPlaceInATitlesRace>> = {};
  const pctOf = (v: number, top: number) =>
    top > 0 ? Math.max(0, Math.min(100, Math.floor((Math.max(0, v) / top) * 100 + 1e-9))) : 0;
  TITLE_DEFS.forEach((t) => {
    const h: Partial<MajorTitleHolder> = st.titles?.[t.key] ?? {};
    const held = h.playerIndex != null,
      top = held ? Number(h.merit) || 0 : 0,
      mine = held && h.playerIndex === pi;
    let myBest: number,
      myChar: AHeroOfARealmAsTheTitlesCountHim | null = null,
      rivalBest = 0;
    if (t.key === 'throne' || t.key === 'vault') {
      const metric = (t.key === 'throne' ? st.taxByPlayer : st.goldByPlayer) ?? [];
      myBest = (metric[pi] ?? 0) || 0;
      const k = chars.find((c) => c.isKing && c.player === pi);
      myChar = k ?? null;
      metric.forEach((v, i) => {
        if (i !== pi && (v || 0) > rivalBest) rivalBest = v || 0;
      });
    } else {
      let b = -Infinity;
      for (const c of chars) {
        const merits = st.perChar ?? {};
        const itsMerit = merits[String(c.id)] ?? {};
        const v = Number(itsMerit[t.key]) || 0;
        if (c.player === pi) {
          if (v > b) {
            b = v;
            myChar = c;
          }
        } else if (v > rivalBest) rivalBest = v;
      }
      myBest = b > -Infinity ? b : 0;
      if (mine && h.charId != null) {
        const hc = chars.find((c) => c.id === h.charId);
        if (hc) myChar = hc;
      }
    }
    out[t.key] = {
      charName: myChar && (myBest > 0 || mine) ? myChar.name : null,
      vacant: !held,
      mine,
      pct: !held || mine ? null : pctOf(myBest, top),
      leadPct: mine ? 100 - pctOf(rivalBest, top) : null,
      unchallenged: mine && !(rivalBest > 0),
    };
  });
  return out;
}
// Winner at a Reckoning: highest standing, ties broken by tax base then treasury.
export function reckoningWinner(state: TheWorldAsTheStandingsReadIt) {
  const s = computeStandings(state);
  let best: ARealmsStanding | null = null;
  for (const st of s.standings) {
    if (!best) {
      best = st;
      continue;
    }
    const a = [
      st.score,
      theRealmsFigureOnTheBoard(s.taxByPlayer, st.index),
      theRealmsFigureOnTheBoard(s.goldByPlayer, st.index),
    ] as const;
    const b = [
      best.score,
      theRealmsFigureOnTheBoard(s.taxByPlayer, best.index),
      theRealmsFigureOnTheBoard(s.goldByPlayer, best.index),
    ] as const;
    if (a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))) best = st;
  }
  return { winner: best, standings: s };
}
// Share of world tax base held by a player's allied bloc (bloc-aware Reckoning threshold).
export function reckoningBlocShare(state: TheWorldAsTheReckoningReadsIt, pi: number) {
  const s = computeStandings(state);
  const bloc = alliedBloc(state, pi);
  const blocTax = bloc.reduce((sum, b) => sum + ((s.taxByPlayer[b] ?? 0) || 0), 0);
  return s.worldTax > 0 ? blocTax / s.worldTax : 0;
}
// A realm's OWN share of the world tax base — allies excluded.
export function reckoningOwnShare(state: TheWorldAsTheStandingsReadIt, pi: number) {
  const s = computeStandings(state);
  return s.worldTax > 0 ? ((s.taxByPlayer[pi] ?? 0) || 0) / s.worldTax : 0;
}
// The bar THIS realm's claim must carry — its own bloc's size decides it.
export function reckoningThresholdFor(state: TheWorldAsTheReckoningReadsIt, pi: number) {
  return reckoningThreshold((state.players ?? []).length, reckoningDecayOf(state), alliedBloc(state, pi).length);
}
// May THIS realm lodge the claim? Bloc share carries the bar; the caller still has to be a
// contributor worth naming; and no claim at all stands before RECKONING_MIN_TURN. Returns {ok,
// blocShare, ownShare, threshold, callerMin, blocSize, soloThreshold, minTurn, reason}.
// `reason` is one of null | 'tooEarly' | 'blocShort' | 'callerShort'.
export function reckoningCallEligibility(state: TheWorldAsTheReckoningReadsIt, pi: number) {
  const nP = (state.players ?? []).length,
    dec = reckoningDecayOf(state);
  const bloc = alliedBloc(state, pi);
  const thr = reckoningThreshold(nP, dec, bloc.length);
  const callerMin = thr * RECKONING_CALLER_MIN_FRAC;
  const blocShare = reckoningBlocShare(state, pi);
  const ownShare = reckoningOwnShare(state, pi);
  const tooEarly = (Number(state.turn) || 1) < RECKONING_MIN_TURN && !state.gameOver;
  const reason = tooEarly ? 'tooEarly' : blocShare < thr ? 'blocShort' : ownShare < callerMin ? 'callerShort' : null;
  return {
    ok: !reason,
    blocShare,
    ownShare,
    threshold: thr,
    callerMin,
    reason,
    blocSize: bloc.length,
    allyStep: reckoningAllyStepPct(nP) / 100,
    soloThreshold: reckoningThreshold(nP, dec, 1),
    minTurn: RECKONING_MIN_TURN,
  };
}
// Phase 5 — a bot KING calls the Reckoning when it dominates the world, so bots actually END (and
// win) games instead of expanding forever. Bots never ally, so this is always a single-realm claim.
// The engine (12151) re-checks share ≥ threshold at resolution, so this only needs to add eligible
// bot kings to the reckoningCalls set built from human orders. During a rival's active Reckoning a
// trailing bot keeps warring/expanding as usual, which naturally pressures the claimant (focused
// anti-leader targeting is a later tuning pass).
export function runBotReckoning(
  G: TheWorldAsTheReckoningReadsIt & { readonly reckoning?: object | null | undefined },
  botIdxSet: ReadonlySet<number> | null | undefined,
  reckoningCalls: Set<number> | null | undefined,
) {
  if (!botIdxSet?.size || !reckoningCalls) return;
  if (G.reckoning || G.gameOver) return; // a claim is already live / game already decided
  if ((Number(G.turn) || 0) < RECKONING_MIN_TURN) return; // no claim before turn 10
  botIdxSet.forEach((pi) => {
    if (botConceded(G, pi)) return; // a conceded realm claims nothing
    const kingAlive = (G.characters ?? []).some((c) => c?.alive && c.isKing && c.player === pi);
    if (kingAlive && reckoningCallEligibility(G, pi).ok) reckoningCalls.add(pi); // bloc bar AND the caller's own floor
  });
}

// ── MINOR TITLES ── 20 honorary titles that do NOT count toward victory but each grant the holding
// character a small perk. Each is awarded every turn to the single best living character by its
// metric (ties → first found; a metric of 0 leaves the title vacant). See the design doc.
/** The world as the minor titles read it: its heroes (a list, or a gap in it, may be missing) and its provinces' owners
 *  (the Castellan's count, which reads each province as there). */
interface TheWorldAsTheMinorTitlesReadIt {
  readonly characters?: readonly (AHeroAsTheTitlesCountHim | null | undefined)[] | null | undefined;
  readonly world?: { readonly provinces?: readonly Pick<Province, 'owner'>[] | null | undefined } | null | undefined;
}
/** A minor title: its key, name, perk and requirement, and the measure its best hero is found by. */
interface AMinorTitle {
  readonly key: string;
  readonly name: string;
  readonly perk: string;
  readonly req: string;
  readonly metric: (c: AHeroOfARealmAsTheTitlesCountHim, st: TheWorldAsTheMinorTitlesReadIt) => number;
}
export const MINOR_TITLES = [
  {
    key: 'duelist',
    name: 'The Duelist',
    perk: '+1 melee in personal combat',
    req: 'Highest Melee skill of any living character.',
    metric: (c) => skillLevel(c, 'melee'),
  },
  {
    key: 'marksman',
    name: 'The Marksman',
    perk: '+1 archery in personal combat',
    req: 'Highest Archery skill.',
    metric: (c) => skillLevel(c, 'archery'),
  },
  {
    key: 'strategist',
    name: 'The Strategist',
    perk: '+1 Tactical command in battle',
    req: 'Highest Tactical skill.',
    metric: (c) => skillLevel(c, 'tactical'),
  },
  {
    key: 'swift',
    name: 'The Swift',
    perk: '+1 land movement point',
    req: 'Highest March skill.',
    metric: (c) => skillLevel(c, 'march'),
  },
  {
    key: 'seawolf',
    name: 'The Sea-Wolf',
    perk: '+1 sea movement point',
    req: 'Highest Naval skill.',
    metric: (c) => skillLevel(c, 'naval'),
  },
  {
    key: 'shadow',
    name: 'The Shadow',
    perk: 'your spies are never detected',
    req: 'Highest Spy skill.',
    metric: (c) => skillLevel(c, 'spy'),
  },
  {
    key: 'cutpurse',
    name: 'The Cutpurse',
    perk: '+2g personal stipend each turn',
    req: 'Highest Thief skill.',
    metric: (c) => skillLevel(c, 'thief'),
  },
  {
    key: 'naturalist',
    name: 'The Naturalist',
    perk: 'Creature & Monster armies you lead +5%',
    req: 'Highest Druid skill.',
    metric: (c) => skillLevel(c, 'druid'),
  },
  {
    key: 'loreseeker',
    name: 'The Loreseeker',
    perk: '+5% Sage discovery chance',
    req: 'Highest Sage skill.',
    metric: (c) => skillLevel(c, 'sage'),
  },
  {
    key: 'trailblazer',
    name: 'The Trailblazer',
    perk: '+5% exploration',
    req: 'Highest Explorer skill.',
    metric: (c) => skillLevel(c, 'explorer'),
  },
  {
    key: 'colossus',
    name: 'The Colossus',
    perk: '+2 HP recovered when resting',
    req: 'Highest maximum HP.',
    metric: (c) => c.maxHp || 20,
  },
  {
    key: 'widowmaker',
    name: 'The Widowmaker',
    perk: '+1 melee & +1 archery in combat',
    req: 'Most enemy characters slain in personal combat.',
    metric: (c) => Number(c.tm?.duelKills) || 0,
  },
  {
    key: 'champion',
    name: 'Champion of the People',
    perk: '+2g personal stipend each turn',
    req: 'Most merits earned in play.',
    metric: (c) => c.merits || 0,
  },
  {
    key: 'hostleader',
    name: 'The Host-Leader',
    perk: 'army wages −1 per unit (min 1)',
    req: 'Leads the largest number of army units.',
    metric: (c) => (c.armies ?? []).length,
  },
  {
    key: 'cavalier',
    name: 'The Cavalier',
    perk: 'cavalry you lead +5%',
    req: 'Leads the most cavalry units.',
    metric: (c) => (c.armies ?? []).filter((a) => MINOR_CAV.has(a.type)).length,
  },
  {
    key: 'beastmaster',
    name: 'The Beastmaster',
    perk: 'Creature & Monster armies you lead +5%',
    req: 'Leads the most Creature and Monster units.',
    metric: (c) => (c.armies ?? []).filter((a) => CREATURE_ARMIES.has(a.type) || MONSTER_ARMIES.has(a.type)).length,
  },
  {
    key: 'ironclad',
    name: 'The Ironclad',
    perk: 'heavy & fleet units you lead +5%',
    req: 'Leads the most heavy and fleet units.',
    metric: (c) => (c.armies ?? []).filter((a) => MINOR_HEAVY.has(a.type)).length,
  },
  {
    key: 'relichunter',
    name: 'The Relic-Hunter',
    perk: '+1 melee & +1 archery in combat',
    req: 'Carries the most magic items.',
    metric: (c) => (c.items ?? []).length,
  },
  {
    key: 'castellan',
    name: 'The Castellan',
    perk: '+1g per turn for every 5 provinces held',
    req: 'The king holding the most provinces.',
    metric: (c, st) => (c.isKing ? (st.world?.provinces ?? []).filter((pv) => pv.owner === c.player).length : 0),
  },
  {
    key: 'warlock',
    name: 'The Warlock',
    perk: '+1 spell of your best school/turn',
    req: 'Highest single magic-school level.',
    metric: (c) => theHighestLevelAHeroHasTrainedInAMagicSchool(c),
  },
] satisfies readonly AMinorTitle[];
export function computeMinorTitles(state: TheWorldAsTheMinorTitlesReadIt): Partial<Record<string, MinorTitleHolder>> {
  const chars = (state.characters ?? []).filter(aLivingHeroTheTitlesCount);
  const out: Partial<Record<string, MinorTitleHolder>> = {};
  MINOR_TITLES.forEach((t) => {
    let best = 0,
      bc: AHeroOfARealmAsTheTitlesCountHim | null = null;
    for (const c of chars) {
      const v = t.metric(c, state) || 0;
      if (v > best) {
        best = v;
        bc = c;
      }
    }
    if (bc) out[t.key] = { charId: bc.id, playerIndex: bc.player, name: t.name, perk: t.perk };
  });
  return out;
}

// ── EXTRA SKILL BONUSES ────
// skillBonusBreakdown covers everything that changes the skill ITSELF — equipped items, the Crown
// of Command aura and the Curse spell. It does NOT cover the bonuses the engine adds at the point
// of use: the minor titles and the Veteran Training discovery. Those were invisible on the
// character card (only the four personal-combat ones were shipped, and nothing said where they came
// from), so a player holding The Strategist saw no sign of the +1 Tactical every one of his battles
// is fought with. This is the single module-level place those are enumerated; both the report card
// and the orders column render from it, and every entry carries a `kind` (for colour) and a `scope`
// (for when it applies), so the display can never claim a personal-combat bonus applies to a
// battle.
//
// SCOPES: 'always' — folded into the skill itself (handled by skillBonusBreakdown)
// 'combat' — personal combat only (duels, encounters, lair fights) — pcCharCombatant
// 'battle' — army battles only — combatVsChar / combatVsNPC command bonus
// 'move' — movement points only — computeMovePoolMax
// 'order' — the order's own success roll only (e.g. Sage research)
// Every entry here must correspond to a REAL engine site; the harness asserts each one.
export const SKILL_EXTRA_MINORS: readonly (readonly [
  key: string,
  skills: readonly string[],
  delta: number,
  kind: string,
  scope: string,
])[] = [
  // key skills delta kind scope
  ['duelist', ['melee'], 1, 'title', 'combat'],
  ['marksman', ['archery'], 1, 'title', 'combat'],
  ['widowmaker', ['melee', 'archery'], 1, 'title', 'combat'],
  ['relichunter', ['melee', 'archery'], 1, 'title', 'combat'],
  ['strategist', ['tactical'], 1, 'title', 'battle'],
  ['swift', ['march'], 1, 'title', 'move'],
  ['seawolf', ['naval'], 1, 'title', 'move'],
  ['loreseeker', ['sage'], 1, 'title', 'order'],
];
export const SKILL_EXTRA_SCOPE_NOTE = {
  combat: 'personal combat only',
  battle: 'army battles only',
  move: 'movement points only',
  order: 'this skill’s own order roll only',
};
// `minorHolders` is the freshly-computed map where one is to hand; the last resolved turn's map is
// the fallback, so a character still sees their own perk before Titles go public.
// (A hero's id is only compared: a test's stand-in holds it as words. The holders' map is the turn's, or the view's.)
export function extraSkillBonuses(
  c: { readonly id: unknown; readonly player: number | null } | null | undefined,
  state:
    | {
        readonly _minorHolders?: Readonly<Partial<Record<string, unknown>>> | undefined;
        readonly players?: readonly (ARealmAsTheDiscoveriesReadIt | null | undefined)[] | null | undefined;
      }
    | null
    | undefined,
  minorHolders: Readonly<Partial<Record<string, unknown>>> | null | undefined,
): Partial<Record<string, ASkillBonusAtItsPointOfUse[]>> {
  const out: Partial<Record<string, ASkillBonusAtItsPointOfUse[]>> = {};
  if (!c) return out;
  const mh = minorHolders ?? state?._minorHolders ?? {};
  const nameOf = (k: string) => (MINOR_TITLES.find((t) => t.key === k)?.name ?? '') || k;
  const notes: Readonly<Partial<Record<string, string>>> = SKILL_EXTRA_SCOPE_NOTE;
  const add = (skill: string, label: string, delta: number, kind: string, scope: string) => {
    const here = out[skill] ?? [];
    out[skill] = here;
    here.push({ label, delta, kind, scope, note: notes[scope] ?? '' });
  };
  SKILL_EXTRA_MINORS.forEach(([key, skills, delta, kind, scope]) => {
    const h = mh[key];
    if (!h || Reflect.get(Object(h), 'charId') !== c.id) return;
    skills.forEach((sk) => {
      add(sk, nameOf(key), delta, kind, scope);
    });
  });
  // Veteran Training — a realm-wide Heroic discovery, +1 melee/archery in personal combat (the discoveries' registry's
  // since plan P1-19ac: "personalCombat: a realm's discoveries add to a fighter's skills", as pcCharCombatant asks it).
  const pl = state?.players && c.player != null ? state.players[c.player] : null;
  const _veteranLevels = theLevelsARealmsDiscoveriesAddToAFightersSkills(pl);
  if (_veteranLevels) {
    add('melee', 'Veteran Training', _veteranLevels, 'discovery', 'combat');
    add('archery', 'Veteran Training', _veteranLevels, 'discovery', 'combat');
  }
  return out;
}
