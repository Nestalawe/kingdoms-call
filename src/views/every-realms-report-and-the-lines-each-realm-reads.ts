import { buildTurnReport } from './turn-report.ts';
import { playerView } from './what-each-realm-may-see-of-the-world.ts';
import { doARealmsDiscoveriesWidenTheWarningsItHears } from '../engine/rules/the-registry-of-discovery-effects.ts';
import { theTurnsLinesInWords } from './prose/the-words-of-each-line.ts';
import { theStatisticsOfTheTurn } from './the-statistics-of-the-turn.ts';
import {
  THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE,
  THE_KINDS_OF_A_ROLL_LINE,
} from './the-kinds-of-line-the-spy-and-scrying-feeds-pass-over.ts';
import { asItsGuardReadsIt } from '../engine/rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import {
  theLinesOfTheTurnTheRealmReads,
  type ALineAsTheGateReadsIt,
  type ALineTheRealmReads,
  type TheTurnsSight,
} from './the-gate-that-says-which-lines-of-the-turn-each-realm-reads-and-how-each-reaches-it.ts';
import type { Character, GameState, Realm } from '../schemas/saved-game-state.ts';
import type { TurnContext } from '../engine/turn/context.ts';
import type { LineAudience, LineFact, LogLine } from '../engine/turn/events-and-their-audiences.ts';

/** A line a spy's lingering sight shows its realm: its phase and its words. */
interface ALineTheSpySees {
  phase: number;
  text: string | null;
}

/** What resolveTurn hands over for the reports (whatTheReportsRead, src/engine/run-turn.ts). */
interface WhatTheReportsRead extends Pick<TurnContext, 'freshPlayers' | 'G' | 'turnLog' | '_tel'> {
  readonly sight: TheTurnsSight;
}

// ── THE LINES EACH REALM READS (plan P1-12b3: P1-12's Decision 10, out of buildReports) ────
// playerEvents works out, from the turn's events (the GM's log, as emit stores them), which of them one realm reads,
// in their order, each taken from the gate (theLinesOfTheTurnTheRealmReads, the-gate-that-says-which-lines-of-the-turn-
// each-realm-reads-and-how-each-reaches-it.ts, B-18a): its own deeds, the lines sent to it or about its heroes, the
// world's announcements and what happened where it had eyes at the time (its own ground, a hero of its own standing
// there that phase, a spy on it that phase or earlier); unmet realms left nameless in them; its spies' lingering sight
// (R-118: a rival's deeds and what anyone there could see, never his realm's news); and its Clairvoyance feed. The
// feeds pass over some of the gate's lines (a force drawn up for battle, the roll lines, a line already read). It also gives
// the provinces it spied (and the first phase of each) and the two sets the map's battle markers read; the province
// events come unnamed (provinceEventsItReads: the realm's view names their provinces, buildReports). It reads the
// world (G: the realm's provinces, heroes, discoveries and meetings, the watched hero's place) and the turn's sight
// (presenceByPhase, battleCommanders, clairWatch, which resolveTurn recorded), and writes nothing.
//   turnLog  the turn's lines, as the GM's log stores them: each with its words (theTurnsLinesInWords, P1-12c3)
//   G        the world after the turn, with the Spy stealth's stamps
//   pi       the realm reading
//   sight    { presenceByPhase, battleCommanders, clairWatch }: the turn's sight facts (whatTheReportsRead)
//   theKindOfEachLine  each line's kind, in turnLog's order (null: no fact), as the words pass hands it beside the log
//                      (theTurnsLinesInWords' theKindOfEachStoredLine; P1-12d36): the spy and
//                      Clairvoyance feeds pass over a line by its kind (the-kinds-of-line-the-spy-and-scrying-feeds-
//                      pass-over.ts)
//   theAudienceOfEachLine  each line's whole audience, in turnLog's order, as the words pass hands it beside the log
//                          (theAudienceOfEachStoredLine): the gate reads who may read each line from it (B-18f)
// Returns { lastTurnLog, provinceEvents, spyActivity, spiedProvincesAndTheirFirstPhase,
//           provincesWithABattleLineItRead, provincesItStoodOnAtSomePhase }; provinceEvents: { text, phase, provinceId }.
export function playerEvents(
  turnLog: readonly ALineAsTheGateReadsIt[],
  G: GameState,
  pi: number,
  sight: TheTurnsSight,
  theKindOfEachLine: readonly (LineFact['kind'] | null)[],
  theAudienceOfEachLine: readonly (LineAudience | null)[],
) {
  const { presenceByPhase, battleCommanders, clairWatch } = sight;
  // The lines of the turn the realm reads, each with how it reaches it: the gate's.
  const theLinesItReads = theLinesOfTheTurnTheRealmReads(turnLog, G, pi, sight, theAudienceOfEachLine);
  const playerOwnedProvs = new Set(G.players[pi]?.provinces ?? []);
  const playerCharProvs = new Set(
    (asItsGuardReadsIt(G.characters) ?? []).filter((c) => c.player === pi && c.alive).map((c) => c.location),
  );
  // Build the full set of province IDs this player can see
  const playerVisitedProvs = new Set([...playerOwnedProvs]);
  G.world.provinces.forEach((p) => {
    if ((asItsGuardReadsIt(p.visitedBy) ?? []).includes(pi)) playerVisitedProvs.add(p.id);
  });
  (asItsGuardReadsIt(G.characters) ?? [])
    .filter((c) => c.player === pi && c.alive)
    .forEach((c) => playerVisitedProvs.add(c.location));
  // Messenger Birds: receive intel from provinces 2 steps from owned provinces (the discoveries' registry's since plan
  // P1-19ah: "visibility: a realm's discoveries widen the warnings it hears"). Nothing below reads the set it widens, so
  // it does nothing: it is retired (R-140), offered to no realm, and a realm that holds it keeps it
  if (doARealmsDiscoveriesWidenTheWarningsItHears(G.players[pi])) {
    const offEven: readonly (readonly [number, number])[] = [
      [-1, -1],
      [-1, 0],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
    ];
    const offOdd: readonly (readonly [number, number])[] = [
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, 0],
      [1, 1],
    ];
    const extendReach = (id: number) => {
      const pv = G.world.provinces[id];
      if (!pv) return;
      const offs = pv.row % 2 === 0 ? offEven : offOdd;
      offs.forEach(([dr, dc]) => {
        const nr = pv.row + dr;
        if (nr < 0 || nr >= G.world.rows) return;
        const nc = (((pv.col + dc) % G.world.cols) + G.world.cols) % G.world.cols;
        const nb = G.world.provinces[nr * G.world.cols + nc];
        if (nb) playerVisitedProvs.add(nb.id);
      });
    };
    [...playerOwnedProvs].forEach(extendReach);
    [...playerVisitedProvs].forEach(extendReach); // second ring = 2 steps
  }

  // Build set of this player's own character IDs
  const ownCharIds = new Set<number>(
    (asItsGuardReadsIt(G.characters) ?? []).filter((c) => c.player === pi).map((c) => c.id),
  );

  const _filteredLog = theLinesItReads.chronicle;

  // the map's crossed-swords icon marks provinces where this player WITNESSED a real battle this
  // turn — an actual battle occurred (_hadBattleThisTurn) AND the player has a visible line OF
  // THAT BATTLE (participated, or saw it from a character standing in the province).
  //
  // 2026-09-26 (Toby item 5) — ROOT CAUSE of "I can see a battle icon in a province I have never
  // set foot in". This counted EVERY entry of type 'combat' that reached the player's filtered
  // log, and 'combat' is the engine's catch-all type for far more than battle narrative: a
  // defender falling back carries the id of the province he RETREATED INTO (and is written to the
  // attacker as well), Plague / Earthquake / Flood / warded-spell lines are logged as 'combat'
  // with `env:true` on a province the caster merely reached, a hero's death notice carries
  // wherever the body lies, and so on. Any one of those on a province that separately saw an army
  // battle lit the crossed swords for a player who never witnessed the fighting — most visibly
  // one province away from their own hero.
  //
  // Only emitBattle writes actual battle narrative, and it stamps every one of its lines
  // (including the onlookers' one-line summary) with a `battleId`. That stamp is now the test, so
  // the marker can only follow a battle report the player genuinely received, and the environment
  // lines are excluded outright.
  const _visibleBattleProvs = new Set(
    _filteredLog
      .filter(
        ({ line: e }) =>
          e.type === 'combat' &&
          e.battleId != null &&
          e.provinceId != null &&
          !e.env &&
          !/^\[Intel/i.test(e.text ?? ''),
      )
      .map(({ line: e }) => e.provinceId),
  );
  // …and ground this player's own characters actually STOOD ON at some phase this turn is
  // witnessed by definition, whatever the log looks like — so a battle site can never lose its
  // marker because a path set _hadBattleThisTurn without writing a battle report.
  const _presentProvsAnyPhase = new Set<number>();
  presenceByPhase.forEach((m: Map<number, Set<number>> | null | undefined) => {
    if (m)
      m.forEach((who: Set<number> | null | undefined, provId) => {
        if (who?.has(pi)) _presentProvsAnyPhase.add(provId);
      });
  });

  // ── Spy Activity — for each province this player SPIED, what OTHER realms' characters did
  // there in the phases AFTER the spy arrived (the agent's lingering line of sight): the gate's (R-118). A force drawn up
  // for battle is passed over, by its kind (P1-12d36), and a line read twice in a phase once.
  const spyActivity: { provId: number; provName: string; sincePhase: number; lines: ALineTheSpySees[] }[] = [];
  theLinesItReads.spysLingeringSight.forEach(({ province: pid, afterPhase: afterPh, lines: theLinesItSees }) => {
    const seen = new Set<string>();
    const lines: ALineTheSpySees[] = [];
    theLinesItSees.forEach(({ line: e, at, phase }) => {
      if (theKindOfEachLine[at] === THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE) return;
      const key = `${String(phase)}|${String(e.text)}`;
      if (seen.has(key)) return;
      seen.add(key);
      lines.push({ phase, text: e.text });
    });
    if (lines.length) {
      lines.sort((a, b) => a.phase - b.phase);
      spyActivity.push({
        provId: pid,
        provName: (G.world.provinces[pid]?.name ?? '') || 'a distant province',
        sincePhase: afterPh + 1,
        lines,
      });
    }
  });

  // A battle line carries the attacker's (or ranking force's) charId. If that is not one of this
  // player's own characters but they DID field a commander in that battle, re-file the line under
  // their own hero so a defended/resumed battle lands in that hero's Chronicle section rather
  // than
  // in Realm Events. Non-participants (line-of-sight viewers) still get null → Realm Events.
  const _reattributeCharId = (e: LogLine) => {
    if (e.charId != null && ownCharIds.has(e.charId)) return e.charId;
    // an entry naming several characters (a duel/battle names both combatants) is filed under
    // whichever one belongs to THIS viewer.
    if (Array.isArray(e.charIds)) {
      const own = e.charIds.find((id) => ownCharIds.has(id));
      if (own != null) return own;
    }
    if (e.type === 'combat' && e.provinceId != null && e.phase != null && e.phase >= 0 && e.phase <= 4) {
      const cmds = battleCommanders[`${String(e.provinceId)}@${String(e.phase)}`];
      if (cmds) {
        const own = cmds.find((id) => ownCharIds.has(id));
        if (own != null) return own;
      }
    }
    return null;
  };
  // ── UNMET REALMS STAY NAMELESS in broadcast lines (2026-09-27, Toby item 3) ──────────────────
  // A handful of announcements go to EVERY realm — a concession, the Reckoning called or broken,
  // a province claimed "for <realm>" — and they printed the realm's name to readers whose scouts
  // had never found it. For a line this realm is NOT a party to (not its actor, not addressed to
  // it), every realm it has not met is rewritten as "an unknown realm". Lines it is a party to are
  // left alone (a battle you fought names your foe — you have met them by fighting). Longest names
  // first, so "The Outriders II" is not half-replaced by "The Outriders". Once the game is over the
  // whole field is revealed, as on the Titles card. The ✉ Dispatches tab is unaffected.
  const _metHere = new Set([pi, ...(G.players[pi]?._encountered ?? [])]);
  const _unmetNames = G.gameOver
    ? []
    : (asItsGuardReadsIt(G.players) ?? [])
        .map((pl: Realm | null | undefined, i) => (pl?.name && !_metHere.has(i) ? pl.name : null))
        .filter((nm): nm is string => Boolean(nm))
        .filter(
          (nm) =>
            !(asItsGuardReadsIt(G.players) ?? []).some(
              (pl: Realm | null | undefined, i) => pl?.name === nm && _metHere.has(i),
            ),
        ) // a name shared with a met realm is not a secret
        .sort((a, b) => b.length - a.length);
  const _reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const _unmetRe = _unmetNames.length
    ? new RegExp('(^|[^A-Za-z0-9])(' + _unmetNames.map(_reEsc).join('|') + ')(?![A-Za-z0-9])', 'g')
    : null;
  const _maskText = (e: LogLine) => {
    if (!_unmetRe || typeof e.text !== 'string') return e.text;
    if (e.actor === pi || (asItsGuardReadsIt(e.targets) ?? []).includes(pi)) return e.text;
    return e.text.replace(_unmetRe, (m: string, pre: string, nm: string, off: number, whole: string) => {
      const before = whole.slice(0, off + pre.length);
      const cap = !/[A-Za-z0-9]/.test(before) || /[.!?:—]\s*$/.test(before);
      return pre + (cap ? 'An unknown realm' : 'an unknown realm');
    });
  };
  // A force drawn up for battle carries its kind into the realm's chronicle (the pages draw its rows by it alone); no
  // other line carries one.
  const isAForcesRow = ({ at }: ALineTheRealmReads) =>
    theKindOfEachLine[at] === THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE;
  const lastTurnLog = _filteredLog.map((read) => {
    const e = read.line;
    return {
      // Preserve charId and phase so the player portal can group entries correctly
      type: e.type,
      text: _maskText(e),
      charId: _reattributeCharId(e),
      phase: e.phase ?? null,
      pinNotice: Boolean(asItsGuardReadsIt(e.pinNotice)), // battle-lock notice — the player portal hoists this to the top of its phase
      env: Boolean(asItsGuardReadsIt(e.env)), // routed to Province Reports, kept OUT of Chronicle / Realm Events
      ...(e.gameEnd ? { gameEnd: true } : {}), // 2026-09-28: shown at the TOP of the player report, under the Game-is-Decided banner
      ...(e.battleId != null ? { battleId: e.battleId, bTier: e.bTier } : {}), // 2026-09-23d: battle folding (player portal)
      ...(isAForcesRow(read) ? { kind: THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE } : {}),
    };
  });
  // ── Task 7(a): CLAIRVOYANCE FEED ────
  // If this player watched an enemy character via Clairvoyance, surface everything that character
  // did (or that befell them) from the cast phase onward (the gate's) — filed into KINGDOM EVENTS (charId
  // null, not env), prefixed so it reads as scried intelligence. Deduped against what the player
  // already sees. A force drawn up for battle and the roll lines (too noisy for a scry feed) are passed over, by their
  // kind (P1-12d36).
  {
    const _watch: { readonly charId: number | null | undefined; readonly fromPhase: number } | undefined =
      clairWatch[pi];
    if (_watch?.charId != null) {
      const W = _watch.charId;
      const _seenKeys = new Set(lastTurnLog.map((e) => `${String(e.phase ?? 'x')}|${e.text ?? ''}`));
      theLinesItReads.clairvoyance.forEach(({ line: e, at, phase }) => {
        const kind = theKindOfEachLine[at];
        const theRollLines: ReadonlySet<LineFact['kind'] | null | undefined> = THE_KINDS_OF_A_ROLL_LINE;
        if (kind === THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE || theRollLines.has(kind)) return;
        const t = e.text ?? '';
        const key = `${String(phase)}|${t}`;
        if (_seenKeys.has(key)) return; // already visible to this player
        _seenKeys.add(key);
        lastTurnLog.push({
          type: 'system',
          text: '\u{1F52E} Clairvoyance \u2014 ' + t,
          charId: null,
          phase,
          pinNotice: false,
          env: false,
        });
      });
      // and where the watched character stands as the turn ends.
      {
        const _wc = (asItsGuardReadsIt(G.characters) ?? []).find((x: Character | null | undefined) => x?.id === W);
        if (_wc?.alive && asItsGuardReadsIt(_wc.location) != null) {
          const _wp = G.world.provinces[_wc.location];
          lastTurnLog.push({
            type: 'system',
            text: `\u{1F52E} Clairvoyance \u2014 as the turn ends, ${_wc.name} stands in ${_wp ? _wp.name : 'parts unknown'}. They are marked on your map.`,
            charId: null,
            phase: null,
            pinNotice: false,
            env: false,
          });
        }
      }
    }
  }
  const provinceEvents = _filteredLog
    .filter(({ line: e }) => e.env)
    .map(({ line: e }) => ({
      text: e.text,
      phase: e.phase ?? null,
      provinceId: e.provinceId ?? null,
    }));
  return {
    lastTurnLog,
    provinceEvents,
    spyActivity,
    spiedProvincesAndTheirFirstPhase: theLinesItReads.spiedProvincesAndTheirFirstPhase,
    provincesWithABattleLineItRead: _visibleBattleProvs,
    provincesItStoodOnAtSomePhase: _presentProvsAnyPhase,
  };
}

// ── EVERY REALM'S REPORT, BUILT AFTER THE SAVE (plan P1-08d: lifted out of resolveTurn; P1-12b3: into the views) ────
// buildReports builds each realm's report: buildTurnReport's (src/views/turn-report.ts), on what the realm may see of
// the world (its view: playerView, src/views/what-each-realm-may-see-of-the-world.ts, plan P1-12b4), with the lines it
// reads (playerEvents, above), its battle markers, its province intelligence (provinceCharIntelOf, below) and its
// province events named, each read from the view. It writes nothing to the world or the log
// (P1-12b2; tests/unit/the-reports-are-built-on-a-world-that-cannot-be-written.test.ts), and draws no dice. The shell
// (src/ui/gm/turn-shell.ts) calls it once the turn is saved and the Spy stealth rolled, with what resolveTurn hands
// over for it (whatTheReportsRead, src/engine/run-turn.ts): the slot rows, the world after the turn (the working
// copy), the turn's log, the turn's sight and the telemetry (_tel: the realms' snapshots and the facts for the
// statistics). It writes every line's words first (theTurnsLinesInWords, src/views/prose/: P1-12c3), and every realm's
// lines are picked from the lines in words, each line's kind (P1-12d36) and its whole audience (B-18f) beside them. Returns {reports, tel, gmLog}, where reports is [{gp, report}] (gp: the
// slot row it is for), tel what telemetry reads (its lists built from the facts: theStatisticsOfTheTurn, P1-12d33)
// and gmLog the GM's log of the turn in words, in its stored form, which the shell saves.
export function buildReports(whatTheReportsRead: WhatTheReportsRead) {
  const { freshPlayers, G, sight, _tel } = whatTheReportsRead;
  const {
    gmLog: turnLog,
    theKindOfEachStoredLine,
    theAudienceOfEachStoredLine,
  } = theTurnsLinesInWords(whatTheReportsRead.turnLog);
  const activePlayers = freshPlayers.filter((p) => p.user_id);
  const reports = [];
  for (const gp of activePlayers) {
    // Build a per-player chronicle using the structured log metadata
    const pi = gp.player_index;
    const itsLines = playerEvents(turnLog, G, pi, sight, theKindOfEachStoredLine, theAudienceOfEachStoredLine);
    // What the realm may see of the world (playerView), its lines of the turn (itsLines) beside it: the report reads
    // only these two.
    const view = playerView(G, pi, itsLines);
    const report = buildTurnReport(view, itsLines);
    reports.push({ gp, report });
  }
  // The battle flags (_hadBattleThisTurn, _combatPlayersThisTurn) stay on the working copy: the world was saved before
  // the reports, and the next turn's start clears them (lastTurnsBattleAndDuelSwordsClearedFromTheMap).
  return { reports, tel: { gs: G, collected: theStatisticsOfTheTurn(_tel) }, gmLog: turnLog };
}
