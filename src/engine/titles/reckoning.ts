import { THE_STATES_TWO_REALMS_STAND_IN } from '../../content/the-relations-between-two-realms-the-three-states-a-pair-stands-in-and-the-treat-declaration.ts';
import { theStateThePairsEntryHolds } from '../rules-on-plain-values/how-two-realms-stand-the-key-of-the-pair-and-the-state-its-entry-holds.ts';
import { TITLE_DEFS } from '../../content/kingdoms-call-data.ts';
import {
  MINOR_TITLES,
  SKILL_EXTRA_MINORS,
} from '../../content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import { theMeasureAHeroIsHeldToForAMinorTitle } from '../rules/the-registry-of-the-minor-titles-perks.ts';
import { ITEMS_BY_TIER } from '../items/tiers-and-hoards.ts';
import {
  theFiguresAnImperialTitleOfTheRealmIsHeldBy,
  theMeritAHeroHasTowardsAnImperialTitle,
  type AHeroAsTheImperialTitlesMeasureHim,
} from '../rules-on-plain-values/the-merit-a-hero-or-the-figure-a-realm-holds-an-imperial-title-by-as-its-row-measures-it.ts';
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
/** A hero's merit towards each Imperial Title a hero holds, by its key, in the rows' order: each as its row measures it
 *  (TITLE_DEFS' `howTheHolderIsFound`, B-06n), his skills raised by the items he uses and his deeds a count of his
 *  `tm` (none if not yet written). */
export function _charTitleMerit(c: AHeroAsTheTitlesCountHim): AHerosMeritTowardsEachTitle {
  const schools: readonly (string | undefined)[] = _MAGIC_SCHOOLS;
  const him: AHeroAsTheImperialTitlesMeasureHim = {
    hisLevelOf: (theSkill) => _skillItem(c, theSkill),
    hisDeeds: c.tm ?? {},
    theItemsHeUsesThatRaiseAMagicSchool: () =>
      activeItems(c).filter((it) => schools.includes(asItsGuardReadsIt(it.effect)?.stat)).length,
  };
  const merit: Partial<Record<string, number>> = {};
  TITLE_DEFS.forEach((t) => {
    const how = t.howTheHolderIsFound;
    if (how.theHolder === 'a hero') merit[t.key] = theMeritAHeroHasTowardsAnImperialTitle(how, him);
  });
  return merit;
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
  const np = (state.players ?? []).length;
  const out = [pi];
  for (let y = 0; y < np; y++) {
    if (y !== pi && theStateThePairsEntryHolds(state.relations, pi, y) === THE_STATES_TWO_REALMS_STAND_IN.allied)
      out.push(y);
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
    const how = t.howTheHolderIsFound;
    if (how.theHolder === 'a realm') {
      const metric = theFiguresAnImperialTitleOfTheRealmIsHeldBy(how.theFigure, {
        theTaxBases: taxByPlayer,
        theTreasuries: goldByPlayer,
      });
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
    const how = t.howTheHolderIsFound;
    if (how.theHolder === 'a realm') {
      const metric =
        theFiguresAnImperialTitleOfTheRealmIsHeldBy(how.theFigure, {
          theTaxBases: st.taxByPlayer,
          theTreasuries: st.goldByPlayer,
        }) ?? [];
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
// measure (ties → first found; a measure of 0 leaves the title vacant). Their rows, in their order, and how each
// holder is found, are content's (MINOR_TITLES); the measure is the minor titles' registry's.
/** The world as the minor titles read it: its heroes (a list, or a gap in it, may be missing) and its provinces' owners
 *  (the Castellan's count, which reads each province as there). */
interface TheWorldAsTheMinorTitlesReadIt {
  readonly characters?: readonly (AHeroAsTheTitlesCountHim | null | undefined)[] | null | undefined;
  readonly world?: { readonly provinces?: readonly Pick<Province, 'owner'>[] | null | undefined } | null | undefined;
}
export function computeMinorTitles(state: TheWorldAsTheMinorTitlesReadIt): Partial<Record<string, MinorTitleHolder>> {
  const chars = (state.characters ?? []).filter(aLivingHeroTheTitlesCount);
  const out: Partial<Record<string, MinorTitleHolder>> = {};
  MINOR_TITLES.forEach((t) => {
    let best = 0,
      bc: AHeroOfARealmAsTheTitlesCountHim | null = null;
    for (const c of chars) {
      const v = theMeasureAHeroIsHeldToForAMinorTitle(t.howTheHolderIsFound, c, state) || 0;
      if (v > best) {
        best = v;
        bc = c;
      }
    }
    if (bc) out[t.key] = { charId: bc.id, playerIndex: bc.player, name: t.name, perk: t.perk };
  });
  return out;
}

// ── EXTRA SKILL BONUSES ──── the skills a minor title adds to at their point of use, in the character card's order:
// SKILL_EXTRA_MINORS, in content beside the minor titles' rows (src/content/the-minor-titles-their-keys-names-perks-
// requirements-and-how-each-holder-is-found.ts), which says what it covers and when each applies.
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
