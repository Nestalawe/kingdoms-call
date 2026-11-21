// ── THE GATE: WHICH LINES OF THE TURN EACH REALM READS, AND HOW EACH REACHES IT (B-18a) ────
// The one place in the views that reads the turn's lines for a realm (beside the words pass, which writes them:
// src/views/prose/the-words-of-each-line.ts). playerEvents (every-realms-report-and-the-lines-each-realm-reads.ts) takes
// every line of a realm's chronicle, its province events, its spy feed and its Clairvoyance feed from here, and passes
// over some of them there (a force drawn up for battle, the roll lines, a line it already reads). A line the gate lets
// through is of a type only the gate makes (ALineTheRealmReads), and the lint rule
// kc/the-views-read-the-turns-log-only-in-the-gate-and-the-words-pass refuses a read of the turn's log anywhere else in
// src/views/.
//
// For one realm, from the turn's lines in words (the GM's log as it is stored), each line's whole audience beside them
// (theTurnsLinesInWords hands it), the world after the turn and the turn's sight, it gives each line the realm reads, in
// the log's order, with how it reaches it:
//   told          the line is told to the realm (its audience's realms)
//   its deed      the realm is its actor
//   its hero      it is about a hero the realm owns (charId, or one of charIds)
//   the world     seen by the world, with no province: the whole world is told
//   eyes there    seen there, whatever its type, in a province where the realm has eyes at its phase: its own ground, a
//                 hero of its own standing there that phase, or a spy on it that phase or earlier (R-186)
//   the battle    an onlooker's one-line summary of a battle (a line seen in the battle marked summary, which no line is
//                 today: R-138), read with a hero of its own standing there at its phase (eyes there, with no phase)
// and a line its audience excepts some realms from never reaches them. A line seen in a battle, whatever its type,
// reaches only those who fought in it (told, its deed, its hero): seeing it there grants no one else (R-185). A sight
// there or in a battle names its province (R-187: the event's type refuses one with none); handed one anyway, no realm
// reads it by its sight. A line seen by the world in a province, which no game writes and no answer covers, reads as the
// reports always read it: whoever has eyes there, but a combat line only those who fought. Through perception:
//   a spy's lingering sight  in a province it spied, from the next phase on: what another realm's heroes do there (a
//                            line with a deed) or anyone there could see (a line seen by the world, there or in the
//                            battle), but not a line that excepts it (R-118)
//   Clairvoyance             every line about the hero it watches (his, or among its heroes), from the phase the watch
//                            began
// A line reaches a realm by the first of these that holds. It reads each line's audience, never the stored keys emit
// derives from it (public, targets, actor, notFor); of the stored line it reads its province, phase, heroes, spy and
// summary flags, and its type only for a sight of the world in a province.
import { asItsGuardReadsIt } from '../engine/rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { theWayALineReachesARealmWhereverItStands } from '../engine/rules-on-plain-values/a-line-told-to-a-realm-or-of-its-own-deed-reaches-it-wherever-it-stands.ts';
import type { GameState } from '../schemas/saved-game-state.ts';
import type { TurnContext } from '../engine/turn/context.ts';
import type { LineAudience, LogLine } from '../engine/turn/events-and-their-audiences.ts';

/** The turn's sight, as resolveTurn recorded it (whatTheReportsRead, src/engine/run-turn.ts). */
export type TheTurnsSight = Pick<TurnContext, 'presenceByPhase' | 'battleCommanders' | 'clairWatch'>;

/** A line of the turn as the gate reads it: an onlooker's summary flag too, which no line carries today (the
 *  onlookers' question, plan P1-12's Decision 3: battle-report-lines-and-force-markers.ts). */
export type ALineAsTheGateReadsIt = LogLine & { readonly summary?: unknown };

/** How a line reaches the realm that reads it (above). */
type TheWayALineReachesTheRealm =
  | 'told'
  | 'its deed'
  | 'its hero'
  | 'the world'
  | 'eyes there'
  | 'the battle'
  | "a spy's lingering sight"
  | 'Clairvoyance';

/** The mark only the gate puts on a line it lets through: not exported, so no other module makes one. */
const LET_THROUGH_BY_THE_GATE: unique symbol = Symbol('a line the gate lets through');

/** A line the realm reads: the line, its place in the turn's log (to read what is handed beside it, as its kind), and
 *  how it reaches the realm. Only the gate makes one. */
export interface ALineTheRealmReads {
  readonly line: ALineAsTheGateReadsIt;
  readonly at: number;
  readonly reachesItBy: TheWayALineReachesTheRealm;
  readonly [LET_THROUGH_BY_THE_GATE]: true;
}

/** A line of a feed (a spy's lingering sight, Clairvoyance): one with a phase, which the feeds read. */
export interface ALineOfAFeedTheRealmReads extends ALineTheRealmReads {
  readonly phase: number;
}

/** What the realm reads of the turn's lines: its chronicle (the lines it reads, the province events among them), the
 *  provinces it spied (each with the first phase it did), its spy's lingering sight in each (in that record's order),
 *  and its Clairvoyance feed (empty when it watches no hero). */
export interface TheLinesOfTheTurnTheRealmReads {
  chronicle: ALineTheRealmReads[];
  spiedProvincesAndTheirFirstPhase: Record<string, number>;
  spysLingeringSight: { province: number; afterPhase: number; lines: ALineOfAFeedTheRealmReads[] }[];
  clairvoyance: ALineOfAFeedTheRealmReads[];
}

/** The first phase the realm spied a province, read by a key of the record that holds it: always there (the keys are
 *  the record's own), so a check that throws for none. */
function theFirstPhaseItSpiedThere(phase: number | undefined): number {
  if (phase === undefined) throw new TypeError('no first phase is recorded for a province the realm spied');
  return phase;
}

/** A line's whole audience, as the words pass hands it beside the line: always there for a line emit filed, which every
 *  line of the turn is (the lint rule kc/narrative-lines-go-through-emit), so a check that throws for none. */
function theAudienceOfTheLine(audience: LineAudience | null | undefined, at: number): LineAudience {
  if (audience == null)
    throw new TypeError(`line ${String(at)} of the turn's log has no audience: emit didn't file it`);
  return audience;
}

/** A line let through the gate. */
function letThrough(
  line: ALineAsTheGateReadsIt,
  at: number,
  reachesItBy: TheWayALineReachesTheRealm,
): ALineTheRealmReads {
  return { line, at, reachesItBy, [LET_THROUGH_BY_THE_GATE]: true };
}

/** Each line of the turn the realm `pi` reads, and how it reaches it (above).
 *    turnLog  the turn's lines, as the GM's log stores them: each with its words (theTurnsLinesInWords)
 *    G        the world after the turn (the realm's provinces and heroes)
 *    sight    { presenceByPhase, battleCommanders, clairWatch }: the turn's sight facts (whatTheReportsRead)
 *    theAudienceOfEachLine  each line's whole audience, in turnLog's order (theTurnsLinesInWords'
 *                           theAudienceOfEachStoredLine) */
export function theLinesOfTheTurnTheRealmReads(
  turnLog: readonly ALineAsTheGateReadsIt[],
  G: GameState,
  pi: number,
  sight: TheTurnsSight,
  theAudienceOfEachLine: readonly (LineAudience | null)[],
): TheLinesOfTheTurnTheRealmReads {
  const { presenceByPhase, clairWatch } = sight;
  const audienceOf = (at: number) => theAudienceOfTheLine(theAudienceOfEachLine[at], at);
  const excepts = (a: LineAudience) => Array.isArray(a.except) && a.except.includes(pi);
  const playerOwnedProvs = new Set(G.players[pi]?.provinces ?? []);
  // Build set of this player's own character IDs
  const ownCharIds = new Set<number>(
    (asItsGuardReadsIt(G.characters) ?? []).filter((c) => c.player === pi).map((c) => c.id),
  );

  // earliest phase this player spied each province this turn (spy sees battles at that phase or
  // later in the same province).
  const spyPhaseByProv: Record<string, number> = {};
  turnLog.forEach((e, at) => {
    if (audienceOf(at).actor === pi && e.spy && e.provinceId != null) {
      const ph = e.phase ?? 0;
      const spiedAt = spyPhaseByProv[e.provinceId];
      if (spiedAt === undefined || ph < spiedAt) spyPhaseByProv[e.provinceId] = ph;
    }
  });
  // True if this player could witness a battle in prov at phase ph: a character present there at
  // that phase, or a spy on that province in the same phase or earlier.
  const canSeeBattle = (prov: number | null, ph: number | null) => {
    if (prov == null) return false;
    if (ph != null && presenceByPhase[ph]?.get(prov)?.has(pi)) return true;
    const sp = spyPhaseByProv[prov];
    if (sp !== undefined && (ph == null || sp <= ph)) return true;
    return false;
  };

  // a non-participant may witness a battle only if a character of theirs was PRESENT in the
  // province at that phase — spies/scouts no longer see battles they weren't near.
  const charPresentAt = (prov: number | null, ph: number | null) => {
    if (prov == null) return false;
    if (ph != null && presenceByPhase[ph]?.get(prov)?.has(pi)) return true;
    return false;
  };
  // 2026-09-27 (Toby item 6): can this realm SEE what happens in a province right now? Its own
  // ground, a character of its own standing there at that phase, or a spy on it that phase or
  // earlier. Having once walked through the province is explicitly NOT enough.
  const canSeeProvinceNow = (prov: number | null, ph: number | null) => {
    if (prov == null) return false;
    if (playerOwnedProvs.has(prov)) return true;
    return canSeeBattle(prov, ph);
  };

  /** A line seen in a province, read by whoever has eyes there at its phase. */
  const eyesThere = (e: ALineAsTheGateReadsIt): TheWayALineReachesTheRealm | null =>
    canSeeProvinceNow(e.provinceId, e.phase) ? 'eyes there' : null;
  /** A battle's line, read by an onlooker only as its one-line summary (a line marked summary, which no line is today:
   *  R-138): with a hero of its own standing there at its phase, or with eyes there for a line with no phase. */
  const theBattlesSummaryOrNothing = (e: ALineAsTheGateReadsIt): TheWayALineReachesTheRealm | null => {
    if (!e.summary) return null;
    if (e.phase != null) return charPresentAt(e.provinceId, e.phase) ? 'the battle' : null;
    return canSeeProvinceNow(e.provinceId, e.phase) ? 'the battle' : null;
  };
  /** How a line reaches the realm's chronicle, or null: it doesn't. */
  const theWayItReachesTheChronicle = (
    e: ALineAsTheGateReadsIt,
    a: LineAudience,
  ): TheWayALineReachesTheRealm | null => {
    // 0. Written for everyone EXCEPT these realms (the private half of a logSplit pair covers them)
    if (excepts(a)) return null;
    // 1. Directly targeted at this player (wages, intel notifications, spell hits etc.)
    // 2. This player's own character performed the action
    const toldOrItsDeed = theWayALineReachesARealmWhereverItStands(a.realms ?? [], a.actor, pi);
    if (toldOrItsDeed !== null) return toldOrItsDeed;
    // 4. Entry attributed to one of this player's own characters (charId or charIds match)
    if (e.charId != null && ownCharIds.has(e.charId)) return 'its hero';
    if (Array.isArray(e.charIds) && e.charIds.some((id) => ownCharIds.has(id))) return 'its hero';
    // 3. What it is seen by: its audience's sight, whatever its type (R-185, R-186).
    switch (a.seen) {
      case undefined:
        // Everything else: hidden
        return null;
      case 'world':
        // 3a. WORLD ANNOUNCEMENTS. A line seen by the world with NO province is not something that happened
        // *somewhere*: it is something the whole world is told: a realm conceding, the Reckoning being called, a claim
        // collapsing, the crown's price falling, the game being decided and its final standings.
        if (e.provinceId == null) return 'the world';
        // Seen by the world in a province: no game writes one and no answer covers it, so it reads as the reports
        // always read it, by its type: a combat line as a battle's, any other as a line seen there.
        return e.type === 'combat' ? theBattlesSummaryOrNothing(e) : eyesThere(e);
      case 'there':
        // 2026-09-27 (Toby item 6): a line seen in a province needs EYES THERE at the time: the province is the
        // viewer's own, or one of their characters stood in it that phase, or they spied it that phase or earlier.
        // Having once walked through the province is not enough (memory of the MAP is built separately, from
        // visitedBy). Whatever its type (R-186): the type only says where the page shows it.
        return eyesThere(e);
      case 'battle':
        // A battle the realm did NOT fight in: its blow-by-blow is for those who fought alone (told, its deed, its hero,
        // above), whatever its type (R-185); an onlooker would read only its one-line summary (R-138, not built).
        return theBattlesSummaryOrNothing(e);
    }
  };
  const chronicle: ALineTheRealmReads[] = [];
  turnLog.forEach((e, at) => {
    const reachesItBy = theWayItReachesTheChronicle(e, audienceOf(at));
    if (reachesItBy !== null) chronicle.push(letThrough(e, at, reachesItBy));
  });

  // ── Spy Activity — for each province this player SPIED, what OTHER realms' characters did
  // there in the phases AFTER the spy arrived (the agent's lingering line of sight): entries in the spied province, at
  // a LATER phase, attributed to a character this player does not own.
  // R-118 (Toby, 2026-10-31, question 8): the spy sees what rival heroes do there (a line with a deed, its actor) and
  // what anyone there could see (a line seen by the world, there or in a battle), never their realm's own news
  // (a line told to a realm with no deed: a hit-point rise, a curse felt, the plague's toll), nor a line that excepts
  // this realm (its audience's except).
  const aSpyThereSees = (a: LineAudience) => (a.actor != null || a.seen !== undefined) && !excepts(a);
  const spysLingeringSight: TheLinesOfTheTurnTheRealmReads['spysLingeringSight'] = [];
  Object.keys(spyPhaseByProv).forEach((pidStr) => {
    const pid = parseInt(pidStr);
    const afterPh = theFirstPhaseItSpiedThere(spyPhaseByProv[pid]);
    const lines: ALineOfAFeedTheRealmReads[] = [];
    turnLog.forEach((e, at) => {
      if (e.provinceId !== pid) return;
      if (e.phase == null || e.phase <= afterPh) return;
      if (e.charId == null || ownCharIds.has(e.charId)) return;
      if (!aSpyThereSees(audienceOf(at))) return;
      lines.push({ ...letThrough(e, at, "a spy's lingering sight"), phase: e.phase });
    });
    spysLingeringSight.push({ province: pid, afterPhase: afterPh, lines });
  });

  // ── Task 7(a): CLAIRVOYANCE FEED ────
  // If this player watched an enemy character via Clairvoyance, everything that character did (or that befell them)
  // from the cast phase onward.
  const clairvoyance: ALineOfAFeedTheRealmReads[] = [];
  const _watch: { readonly charId: number | null | undefined; readonly fromPhase: number } | undefined = clairWatch[pi];
  if (_watch?.charId != null) {
    const W = _watch.charId,
      F = _watch.fromPhase || 0;
    turnLog.forEach((e, at) => {
      if (e.phase == null || e.phase < F) return;
      const aboutW = e.charId === W || (Array.isArray(e.charIds) && e.charIds.includes(W));
      if (!aboutW) return;
      clairvoyance.push({ ...letThrough(e, at, 'Clairvoyance'), phase: e.phase });
    });
  }
  return { chronicle, spiedProvincesAndTheirFirstPhase: spyPhaseByProv, spysLingeringSight, clairvoyance };
}
