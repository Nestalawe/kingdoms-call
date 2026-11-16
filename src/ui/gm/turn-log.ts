import { kcHtml } from '../shared/kc-safe.ts';
import type { KcSafeHtml } from '../shared/kc-safe.ts';
import { KC_PHASE_COLORS, KC_PHASE_NAMES } from '../../content/kingdoms-call-data.ts';
import { thePagesDb } from './config.ts';
import { show } from './sign-in.ts';
import { loadGames } from './game-list.ts';
import { parseGameState } from './startup.ts';
import { THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE } from '../../views/the-kinds-of-line-the-spy-and-scrying-feeds-pass-over.ts';
import { aColourOfSixHexDigitsOrNone } from '../../engine/rules-on-plain-values/a-forces-row-on-a-page-its-kind-and-its-colour-of-six-hex-digits.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import {
  isAList,
  theField,
  theListToSearch,
  theSumAsJavaScriptMakesIt,
  thisOrElse,
} from '../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';

/** A line of the GM's log, as its chronicle reads it (a value parsed from JSON that is an object: its fields read as
 *  this type claims). */
interface ALineOfTheGmsLog {
  readonly text?: string | null | undefined;
  readonly type?: string | null | undefined;
  readonly phase?: number | null | undefined;
  readonly charId?: unknown;
  readonly charIds?: unknown;
  /** A force drawn up for battle's kind: the chronicle draws a force's rows by it. */
  readonly kind?: unknown;
}
/** Whether a line of the GM's log, as parsed from JSON, is an object, which the chronicle then reads as its line (the
 *  same check as the player page's chronicle). */
function isALineOfTheGmsLog(e: unknown): e is ALineOfTheGmsLog {
  return typeof e === 'object' && e !== null;
}
/** A hero's section of the GM's chronicle: the hero's fields as the game's state holds them, and his lines by phase
 *  ([5] = End of Turn). */
interface AHerosSectionOfTheGmsLog {
  readonly id: unknown;
  readonly name: unknown;
  readonly isKing: unknown;
  readonly player: unknown;
  readonly phases: ALineOfTheGmsLog[][];
}
/** A value of any kind in words, as `String` writes it: the key a table is read by (`table[value]` reads it so). */
function inWords(value: unknown): string {
  return String(value);
}
/** A hero's section, by a key the code has just found in the table: none throws the TypeError the read threw. */
function theHerosSection(
  table: Readonly<Record<string, AHerosSectionOfTheGmsLog>>,
  key: string,
): AHerosSectionOfTheGmsLog {
  const section = table[key];
  if (section === undefined) throw new TypeError("Cannot read properties of undefined (reading 'phases')");
  return section;
}
/** One of a section's lists, at a phase's place: none (a phase between the whole ones) throws the TypeError the push
 *  threw. */
function thePhasesLines(phases: readonly ALineOfTheGmsLog[][], i: number): ALineOfTheGmsLog[] {
  const lines = phases[i];
  if (lines === undefined) throw new TypeError("Cannot read properties of undefined (reading 'push')");
  return lines;
}
/** An element the page looked up and writes into, as the write read it: none throws the TypeError writing it threw. */
function theElementFound(el: HTMLElement | null): HTMLElement {
  if (el === null) throw new TypeError("Cannot set properties of null (setting 'innerHTML')");
  return el;
}

export async function loadTurnLog(gameId: string, turn: number) {
  const { data } = await thePagesDb.theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn(gameId, turn);
  if (!data || data.length === 0) {
    theElementWithTheId('detail-log', HTMLElement).innerHTML =
      '<div style="color:#3a3224;font-size:.85rem;font-style:italic">No log entries yet.</div>';
    return;
  }

  const allEntries = data.flatMap((d): unknown => thisOrElse(d.entries, []));
  // 2026-09-25: game_state arrives from Supabase as a JSON STRING; reading .characters off it gave
  // an empty roster, so every character section was dropped and the GM's Last Turn Chronicle showed
  // only the Intelligence block ("No entries." when there was none). Parse it like everywhere else.
  const gameState = parseGameState(currentGame);
  const allChars = theListToSearch(thisOrElse(theField(gameState, 'characters'), []));
  const allPlayers = thisOrElse(theField(gameState, 'players'), []);

  // index 5 = End of Turn, matching the player portal.
  const PHASE_NAMES = KC_PHASE_NAMES.slice();
  const PHASE_COLORS = KC_PHASE_COLORS.slice();

  function renderEntry(e: ALineOfTheGmsLog) {
    const raw0 = e.text ?? '';
    // A force's rows, by the line's kind alone (stored since plan P1-12d39); a line of an older turn, stored with no
    // kind, is drawn as its words, whatever they open with. Its colour is six hex digits, or the default grey.
    if (e.kind === THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE) {
      try {
        const f: unknown = JSON.parse(raw0.slice(7));
        const col = theField(f, 'neutral') ? '#555' : (aColourOfSixHexDigitsOrNone(theField(f, 'color')) ?? '#555');
        const rows = theField(thisOrElse(theField(f, 'armies'), []), 'length')
          ? theListToSearch(theField(f, 'armies')).map((a) => {
              const unitName = theField(a, 'unitName');
              return kcHtml`<div style="padding-left:14px;font-size:.78rem">• ${unitName ? theSumAsJavaScriptMakesIt(unitName, ' — ') : ''}${theField(a, 'quality')} ${theField(a, 'type')}</div>`;
            })
          : kcHtml`<div style="padding-left:14px;font-size:.78rem;opacity:.7">— no armies —</div>`;
        return kcHtml`<div class="log-entry combat" style="border-left:4px solid var(--crimson);background:#fdf0f0;padding:4px 8px;margin-top:4px"><div style="font-weight:600">⚔ <span style="color:${col}">${theField(f, 'name')}</span> ${thisOrElse(theField(f, 'verb'), '')}:</div>${rows}</div>`;
      } catch {
        /* fall through */
      }
    }
    // Narrative is shown as text, then each **bold** run becomes <strong> (the engine writes no markup into it).
    const text = kcHtml`${raw0.split(/\*\*(.+?)\*\*/).map((s, i) => (i % 2 ? kcHtml`<strong>${s}</strong>` : s))}`;
    const isStat = raw0.startsWith('📊');
    const isBattle = raw0.startsWith('⚔') || raw0.startsWith('⚠');
    if (isStat)
      return kcHtml`<div class="log-entry stat" style="font-size:.78rem;color:#231e16;padding:2px 6px;background:#f5f0e8${raw0.includes('│') ? ';font-family:monospace;white-space:pre;overflow-x:auto' : ''}">${text}</div>`;
    if (isBattle)
      return kcHtml`<div class="log-entry combat" style="border-left:4px solid var(--crimson);background:#fdf0f0;padding:4px 8px;margin-top:4px;font-weight:600">${text}</div>`;
    return kcHtml`<div class="log-entry ${e.type ?? ''}" style="padding:2px 6px">${text}</div>`;
  }

  function phaseHeader(ph: number) {
    return kcHtml`<div style="font-family:'Cinzel',serif;font-size:.68rem;color:${PHASE_COLORS[ph]};
      text-transform:uppercase;letter-spacing:.1em;padding:3px 8px;
      border-bottom:1px dotted #ddd;margin:6px 0 3px;
      display:flex;align-items:center;gap:5px">
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${PHASE_COLORS[ph]}"></span>
      ${PHASE_NAMES[ph]}
    </div>`;
  }

  // Group entries: by character (charId) → phase; then system by phase; then intel by phase
  const charGroups: Record<string, AHerosSectionOfTheGmsLog> = {}; // charId → {name, player, isKing, phases:[[],...x6]} ([5] = End of Turn)
  const intelByPhase: Record<number, ALineOfTheGmsLog[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 99: [] };
  allChars.map((c) => theField(c, 'id')); // the set of ids made of this went unread: a gap among the heroes still throws here

  // Build char groups keyed by charId, king first
  [...allChars]
    .sort((a, b) => (theField(b, 'isKing') ? 1 : 0) - (theField(a, 'isKing') ? 1 : 0))
    .forEach((c) => {
      charGroups[inWords(theField(c, 'id'))] = {
        id: theField(c, 'id'),
        name: theField(c, 'name'),
        isKing: theField(c, 'isKing'),
        player: theField(c, 'player'),
        phases: [[], [], [], [], [], []],
      }; // [5] = End of Turn
    });

  allEntries.forEach((e) => {
    if (e === null || e === undefined) throw new TypeError(`Cannot read properties of ${String(e)} (reading 'phase')`);
    // A line that is no object names no phase, no words and no hero: it was filed nowhere, and still is.
    if (!isALineOfTheGmsLog(e)) return;
    const ph = e.phase != null && e.phase >= 0 && e.phase <= 4 ? e.phase : 99;
    const isIntel = (e.text ?? '').startsWith('[Intelligence]') || (e.text ?? '').startsWith('[Intel]');
    // Route to a character section by charId, or via charIds.
    const _secCharId =
      e.charId != null && charGroups[inWords(e.charId)]
        ? e.charId
        : isAList(e.charIds)
          ? e.charIds.find((id) => charGroups[inWords(id)])
          : undefined;
    if (isIntel) {
      const here = intelByPhase[ph] ?? [];
      intelByPhase[ph] = here;
      here.push(e);
    } else if (_secCharId != null) {
      thePhasesLines(theHerosSection(charGroups, inWords(_secCharId)).phases, ph >= 0 && ph <= 4 ? ph : 5).push(e);
    } // unphased → End of Turn, never Spring
    // else: realm-level (no-character) lines are not shown in the GM chronicle
  });

  const html: KcSafeHtml[] = [];

  // Group characters by player for GM view
  const playerGroups: Record<string, AHerosSectionOfTheGmsLog[]> = {};
  Object.values(charGroups).forEach((cg) => {
    const pi = cg.player ?? 'unowned';
    (playerGroups[inWords(pi)] ??= []).push(cg);
  });

  Object.entries(playerGroups).forEach(([pi, chars]) => {
    const player = thisOrElse(theField(allPlayers, pi), { name: `Player ${pi}` });
    const accentColor = pi === 'unowned' ? '#888' : 'var(--crimson)';
    html.push(kcHtml`<div style="margin-bottom:6px;font-family:Cinzel,serif;font-size:.78rem;color:#fff;
      padding:5px 10px;background:${accentColor};border-radius:2px 2px 0 0;letter-spacing:.04em">
      👑 ${thisOrElse(theField(player, 'name'), 'Unknown')}
    </div>`);

    chars.forEach((cg) => {
      const hasAny = cg.phases.some((ph) => ph.length > 0);
      if (!hasAny) return;
      html.push(kcHtml`<div style="margin-bottom:14px;border:1px solid ${cg.isKing ? 'var(--crimson)' : 'var(--stone)'};border-radius:0 0 3px 3px;overflow:hidden">
        <div style="font-family:'Cinzel',serif;font-size:.82rem;color:#fff;
          padding:5px 10px;background:${cg.isKing ? 'var(--crimson)' : 'var(--forest)'};
          display:flex;align-items:center;gap:6px">
          ${cg.isKing ? '👑' : '⚔'} ${cg.name}
        </div>
        <div style="padding:4px 6px">`);
      cg.phases.forEach((entries, ph) => {
        if (!entries.length) return;
        html.push(phaseHeader(ph));
        entries.forEach((e) => {
          html.push(renderEntry(e));
        });
      });
      html.push(kcHtml`</div></div>`);
    });
  });

  // Intel
  const hasIntel = Object.values(intelByPhase).some((a) => a.length > 0);
  if (hasIntel) {
    html.push(kcHtml`<div style="margin-bottom:14px;border:1px solid #c8922a;border-radius:3px;overflow:hidden">
      <div style="font-family:'Cinzel',serif;font-size:.82rem;color:#fff;padding:5px 10px;background:#c8922a;display:flex;align-items:center;gap:6px">👁 Intelligence</div>
      <div style="padding:4px 6px">`);
    [0, 1, 2, 3, 4, 99].forEach((ph) => {
      if (!(intelByPhase[ph] ?? []).length) return;
      if (ph < 5) html.push(phaseHeader(ph));
      (intelByPhase[ph] ?? []).forEach((e) => {
        html.push(renderEntry(e));
      });
    });
    html.push(kcHtml`</div></div>`);
  }

  const theChronicle = html.length
    ? String(kcHtml`${html}`)
    : '<div style="color:#3a3224;font-size:.85rem">No entries.</div>';
  theElementWithTheId('detail-log', HTMLElement).innerHTML = theChronicle;
}

// ── DELETE GAME ────
// 2026-09-27 (Toby item 1): a delete now really is a delete. The telemetry tables and the
// Hall-of-Fame row key off `game_id` as plain text with no foreign key, so before this they
// SURVIVED the games row — a deleted game went on being counted in the Stats tab and went on
// showing on the leaderboard for ever, with no way to reach it. All four are purged here. If you
// want the game kept but out of the way, use Archive instead.
export async function deleteGame(gameId: string) {
  if (
    !confirm(
      'Delete this game permanently?\n\nThe world, the players, every turn report and dispatch, all recorded statistics AND its Hall-of-Fame leaderboard entry are destroyed. This cannot be undone.\n\nTo keep the game but take it out of your list, cancel and use Archive instead.',
    )
  )
    return;
  const msg = document.getElementById('detail-msg');
  theElementFound(msg).innerHTML = '<div class="msg-info">Deleting…</div>';
  // Delete players first (cascade should handle it, but be explicit)
  await thePagesDb.theDeletionOfAGame.removeThisGamesTurnLogs(gameId);
  // Dispatches BEFORE the games row: the delete policy on game_messages checks that the caller is the
  // GM of a game with this id, so once the games row is gone nobody can remove them any more.
  if (_kcHasMsg) {
    try {
      await thePagesDb.theDeletionOfAGame.removeThisGamesDispatches(gameId);
      await thePagesDb.theDeletionOfAGame.removeThisGamesReadMarks(gameId);
    } catch (e) {
      console.warn('dispatch cleanup:', e);
    }
  }
  // Telemetry + Hall of Fame — same reason, and the game_records write policy checks the games row
  // exists, so this must happen while it still does.
  if (_kcHasTel) {
    try {
      await thePagesDb.theDeletionOfAGame.removeThisGamesTurnEvents(gameId);
      await thePagesDb.theDeletionOfAGame.removeThisGamesResults(gameId);
    } catch (e) {
      console.warn('telemetry cleanup:', e);
    }
  }
  if (_kcHasLb) {
    try {
      await thePagesDb.theDeletionOfAGame.removeThisGamesHallOfFameEntry(gameId);
    } catch (e) {
      console.warn('leaderboard cleanup:', e);
    }
  }
  await thePagesDb.theDeletionOfAGame.removeThisGamesRealms(gameId);
  const { error } = await thePagesDb.theDeletionOfAGame.removeThisGame(gameId);
  if (error) {
    theElementFound(msg).innerHTML = String(kcHtml`<div class="msg-error">${error.message}</div>`);
    return;
  }
  show('sec-games');
  void loadGames();
}
