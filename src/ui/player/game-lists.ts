import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { gameMetaOf } from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { thePagesDb } from './startup.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import {
  isAList,
  theDateOf,
  theField,
  theListToSearch,
  thisOrElse,
} from '../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';
import { inWords } from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';
import { _msgArr, _msgNum, msgChannelKeyOf, _activeSectionId, fetchGameSlots } from './dispatches.ts';
import type {
  ADatabaseAnswer,
  AGame,
  AGameForItsCard,
  ARealm,
  ARealmsSlot,
} from '../../db/the-db-interface-and-its-areas.ts';

/** A game's state parsed from its JSON text: any value. */
export function theStateParsed(text: string): unknown {
  return JSON.parse(text);
}
/** The signed-in account's id, as `currentUser.id` read it: before sign-in, the TypeError that read threw. */
export function theSignedInAccountsId(): string {
  if (currentUser === null) throw new TypeError("Cannot read properties of null (reading 'id')");
  return currentUser.id;
}
/** An element the page looked up and writes into, as the write read it: none throws the TypeError writing it threw. */
function theElementFound(el: HTMLElement | null): HTMLElement {
  if (el === null) throw new TypeError('the page holds no element of the game lists');
  return el;
}

// ── LIVE UPDATE POLLING ────
// A light background poll keeps the portal current without the player having to reload the page. It
// is deliberately NON-DESTRUCTIVE:
// • On the My Games list it simply re-renders the cards (turn number + status pills) when anything
// changes — there are no orders on that screen, so nothing can be lost.
// • While a report/orders screen is open it NEVER re-renders or navigates on its own (that would
// blank out unsaved orders). It only reveals a "new turn resolved" banner offering a manual
// Refresh, so the player decides when to reload — protecting any orders they are mid-way through.
// A declared global (plan P1-09b): one binding the page's files and its tests share (ui/player/globals.ts says why).
globalThis._pollTimer = null;
export let _lastMyGamesSig: string | null = null;
export const POLL_MS = 20000;

export function startUpdatePolling() {
  if (_pollTimer) return; // never stack timers
  _pollTimer = setInterval(() => {
    void pollForUpdates();
  }, POLL_MS);
}

export async function pollForUpdates() {
  if (!currentUser) return;
  if (document.hidden) return; // don't poll a backgrounded tab
  try {
    // One light query: this player's slots (turn/status live on the game rows we fetch next).
    const { data: mySlots } = await thePagesDb.thePlayersRealms.thisAccountsRealmsAndTheirOrdersFlags(currentUser.id);
    if (!mySlots?.length) return;
    const gameIds = [...new Set(mySlots.map((s) => s.game_id))];
    const { data: games } = await thePagesDb.thePlayersGames.theTurnAndStateOfTheseGames(gameIds);
    const gById = Object.fromEntries((games ?? []).map((g) => [g.id, g]));
    // rivals' submission flags feed the "N of M realms have sent orders" line, so they must be part
    // of the change signature or the tally would sit stale until the turn resolved.
    // (Exempt realms are not filtered out here — this is change-detection only; loadMyGames does the
    // real, game_state-aware tally when it repaints.)
    const { data: pollSlots } = await fetchGameSlots(gameIds);
    const _tally: Partial<Record<string, [number, number]>> = {};
    pollSlots.forEach((r) => {
      if (r.is_bot) return;
      const t = (_tally[r.game_id] = _tally[r.game_id] ?? [0, 0]);
      t[1]++;
      if (r.orders_submitted) t[0]++;
    });

    // Signature of everything the My Games cards show — cheap change-detection.
    const active = _activeSectionId();
    // 2026-09-28 (Toby item 3): unread Dispatches are part of what the cards show, so they are part
    // of the change signature — but only counted while the list is on screen.
    const _unread: Partial<Record<string, number>> =
      active === 'sec-games' ? await fetchUnreadDispatchCounts(mySlots, pollSlots) : {};
    const sig = mySlots
      .map((s) => {
        const g: Partial<(typeof gById)[string]> = gById[s.game_id] ?? {};
        const t = _tally[s.game_id] ?? [0, 0];
        return `${s.id}:${String(Number(g.turn) || 0)}:${g.status ?? ''}:${String(s.orders_submitted ? 1 : 0)}:${String(t[0])}/${String(t[1])}:u${String(_unread[s.game_id] ?? 0)}`;
      })
      .sort()
      .join('|');

    if (active === 'sec-games') {
      // Safe to repaint the list — no order state lives here.
      if (sig !== _lastMyGamesSig) {
        _lastMyGamesSig = sig;
        void loadMyGames();
      }
    } else if (active === 'sec-report' && currentGamePlayer) {
      // A report/orders screen is open. Do NOT touch it — just surface a notice if THIS game
      // advanced.
      const g = gById[String(currentGamePlayer.game_id)];
      const openLiveTurn = Number(currentGamePlayer._liveTurn) || 0;
      if (g && (g.turn || 0) > openLiveTurn) {
        const b = document.getElementById('new-turn-banner');
        if (b) b.style.display = 'flex';
      }
    }
    _lastMyGamesSig = sig;
  } catch {
    /* transient network/RLS hiccup — try again next tick */
  }
}

export async function loadMyGames() {
  const el = document.getElementById('my-games-list');
  // Step 1: get player's own slots
  const { data: mySlots, error } = await thePagesDb.thePlayersRealms.everyRealmOfThisAccount(theSignedInAccountsId());
  if (error) {
    theElementFound(el).innerHTML = String(kcHtml`<div class="msg-error">${error.message}</div>`);
    return;
  }
  if (!mySlots || mySlots.length === 0) {
    theElementFound(el).innerHTML =
      '<div style="color:#3a3224;font-size:.85rem;font-style:italic">You are not enrolled in any games yet. Join an open game below.</div>';
    return;
  }
  // Step 2: fetch each game separately (avoids RLS join issue). Disk-IO (2026-09-25): light columns
  // only — the cards need name / turn / status and the meta summary, never the world.
  const gameIds = mySlots.map((s) => s.game_id);
  const { data: games, error: gErr } = await fetchGamesLite(gameIds);
  if (gErr) {
    theElementFound(el).innerHTML = String(kcHtml`<div class="msg-error">${gErr.message}</div>`);
    return;
  }
  const gamesById = Object.fromEntries((games ?? []).map((g) => [g.id, g]));
  // every slot in those games, so each card can show HOW MANY realms have sent their orders. Counts
  // only — never which realms, and never what they ordered.
  const { data: allSlots } = await fetchGameSlots(gameIds);
  const slotsByGame: Partial<Record<string, ARealmsSlot[]>> = {};
  allSlots.forEach((s) => {
    (slotsByGame[s.game_id] = slotsByGame[s.game_id] ?? []).push(s);
  });
  // 2026-09-28 (Toby item 3): unread Dispatches per game, for the ✉ badge on each card.
  const unreadByGame = await fetchUnreadDispatchCounts(mySlots, allSlots);
  const cardOf = (slot: ARealm) => {
    const g = gamesById[slot.game_id];
    if (!g) return kcHtml`<div class="msg-info">Game data not available yet — the GM may still be setting up.</div>`;
    const statusLabel = slot.orders_submitted
      ? 'Orders submitted'
      : g.status === 'active'
        ? 'Orders needed'
        : g.status === 'setup'
          ? 'Waiting to start'
          : 'Complete';
    const pillClass = slot.orders_submitted
      ? 'pill-blue'
      : g.status === 'active'
        ? 'pill-amber'
        : g.status === 'setup'
          ? 'pill-green'
          : '';
    // 2026-09-27 (Toby item 1): the GM can ARCHIVE a game — it is put away, not deleted. The card
    // still opens and the whole Chronicle is still readable; the pill just says no turn is coming.
    const _arch = gameArchivedP(g)
      ? kcHtml` <span class="pill" style="background:#e4d4b0;color:#4a3105">🗄 Archived by the GM</span>`
      : '';
    const tally = ordersInTextP(g, slotsByGame[slot.game_id]),
      deadline = turnDeadlineText(g);
    return kcHtml`<div class="game-card clickable" onclick="openGameFresh(${kcArg(slot.id)})"${gameArchivedP(g) ? kcHtml` style="opacity:.85"` : ''}>
      <div class="gc-name">${g.name} <span class="pill ${pillClass}">${statusLabel}</span>${_arch}${unreadDispatchPillP(unreadByGame[slot.game_id])}</div>
      <div class="gc-meta">
        Your realm: <strong>${slot.display_name || '(joining…)'}</strong> ·
        Turn ${g.turn || 0}
      </div>
      ${tally ? kcHtml`<div class="gc-meta" style="margin-top:3px">${tally}</div>` : ''}
      ${deadline ? kcHtml`<div class="gc-meta" style="margin-top:3px">${deadline}</div>` : ''}
    </div>`;
  };
  // 2026-09-28 (Toby item 2): archived games move to their own card below Open Games.
  const _liveSlots = mySlots.filter((slot) => {
    const g = gamesById[slot.game_id];
    return !(g && gameArchivedP(g));
  });
  const _archSlots = mySlots.filter((slot) => {
    const g = gamesById[slot.game_id];
    return !!(g && gameArchivedP(g));
  });
  const theLiveCards = _liveSlots.length
    ? String(kcHtml`${_liveSlots.map(cardOf)}`)
    : '<div style="color:#3a3224;font-size:.85rem;font-style:italic">No active games — your archived games are listed further down.</div>';
  theElementFound(el).innerHTML = theLiveCards;
  renderArchivedGamesCard(_archSlots.map(cardOf));
}
// ── ARCHIVED GAMES CARD (2026-09-28, Toby item 2) ────
// Minimised state is remembered per browser: once the player folds the card it stays folded on
// every later visit until they open it again. localStorage can be unavailable (private windows,
// blocked site data) — every access is wrapped, and the card then simply starts open.
export const ARCH_CARD_KEY = 'kc_archived_games_min';
export function archivedCardMinimised() {
  try {
    return localStorage.getItem(ARCH_CARD_KEY) === '1';
  } catch {
    return false;
  }
}
export function renderArchivedGamesCard(cards: readonly unknown[]) {
  const card = document.getElementById('archived-games-card');
  if (!card) return;
  if (!cards.length) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  const cnt = document.getElementById('archived-games-count');
  if (cnt) cnt.textContent = `(${String(cards.length)})`;
  const list = document.getElementById('archived-games-list');
  if (list) list.innerHTML = String(kcHtml`${cards}`);
  applyArchivedCardState();
}
export function applyArchivedCardState() {
  const min = archivedCardMinimised();
  const list = document.getElementById('archived-games-list');
  if (list) list.style.display = min ? 'none' : '';
  const b = document.getElementById('archived-games-toggle');
  if (b) {
    b.innerHTML = min ? '&#9656; show' : '&#9662; minimise';
    b.setAttribute('aria-expanded', min ? 'false' : 'true');
  }
}
export function toggleArchivedGamesCard() {
  const min = !archivedCardMinimised();
  try {
    if (min) localStorage.setItem(ARCH_CARD_KEY, '1');
    else localStorage.removeItem(ARCH_CARD_KEY);
  } catch {
    // storage unavailable: the card just keeps its state for this visit
  }
  applyArchivedCardState();
}
// ── UNREAD DISPATCHES ON THE GAME CARDS (2026-09-28, Toby item 3) ────
// The same rule the Dispatches panel uses (msgUnreadIn): a dispatch is unread when its id is above
// the highest id this realm has marked seen in that dispatch's channel, and it was not sent by this
// realm. Row-Level Security already limits game_messages to what this player may read (their own,
// addressed to them, or public), so no filtering on addressee is needed here. Only games with two or
// more HUMAN realms have messaging at all. Light columns only — never the message bodies. If the
// tables do not exist yet (the GM has not run the SQL) the query errors and every count is simply 0.
export async function fetchUnreadDispatchCounts(
  mySlots: readonly Pick<ARealm, 'game_id' | 'player_index'>[] | null | undefined,
  allSlots: readonly (ARealmsSlot | null | undefined)[] | null | undefined,
) {
  const out: Partial<Record<string, number>> = {};
  try {
    const humans: Partial<Record<string, number>> = {};
    _msgArr(allSlots).forEach((s) => {
      if (s && !s.is_bot) {
        const k = s.game_id;
        humans[k] = (humans[k] ?? 0) + 1;
      }
    });
    const mine: Partial<Record<string, number | null>> = {};
    _msgArr(mySlots).forEach((s) => {
      const k = s.game_id;
      if ((humans[k] ?? 0) >= 2 && _msgNum(s.player_index) != null) mine[k] = _msgNum(s.player_index);
    });
    const ids = Object.keys(mine);
    if (!ids.length) return out;
    const { data: rows, error } = await thePagesDb.theDispatches.theNewestDispatchesOfTheseGamesGamesAndRealms(ids);
    if (error || !rows) return out;
    let reads: readonly { readonly game_id: string; readonly player_index: number; readonly reads: unknown }[] = [];
    try {
      const r = await thePagesDb.theDispatches.thisAccountsReadMarksInTheseGames(ids, theSignedInAccountsId());
      if (!r.error) reads = _msgArr(r.data);
    } catch {
      // no read marks: every dispatch counts as unread
    }
    const seenBy: Partial<Record<string, object>> = {};
    reads.forEach((r) => {
      const k = r.game_id;
      if (mine[k] !== _msgNum(r.player_index)) return;
      const m = r.reads;
      seenBy[k] = m && typeof m === 'object' && !Array.isArray(m) ? m : {};
    });
    rows.forEach((r) => {
      const k = r.game_id;
      if (!(k in mine)) return;
      if (_msgNum(r.from_index) === mine[k]) return;
      const ch = msgChannelKeyOf(r);
      const seen = _msgNum(Reflect.get(seenBy[k] ?? {}, ch)) ?? 0;
      if ((_msgNum(r.id) ?? 0) > seen) out[k] = (out[k] ?? 0) + 1;
    });
  } catch {
    /* a convenience only — no badge on any failure */
  }
  return out;
}
export function unreadDispatchPillP(n: number | undefined) {
  if (!n) return '';
  return kcHtml` <span class="pill" style="background:#a32020;color:#fff" title="${n} unread dispatch${n !== 1 ? 'es' : ''} — open the game and choose ✉ Dispatches">✉ ${n > 99 ? '99+' : n} new</span>`;
}

// ── Orders-in tally ────
// Players asked to see how many rivals the turn is still waiting on. Deliberately a COUNT ONLY —
// never which realms have sent orders, and never a hint of what was ordered. Mirrors the GM
// portal's own tally (loadGames / ordersWaitingOn): bot slots (no user_id) and conceded or
// extinguished realms are exempt and appear on neither side of the fraction, so the number matches
// the GM's readiness pill.
export function parseGameStateP(g: { readonly game_state?: unknown }): unknown {
  try {
    return typeof g.game_state === 'string' ? theStateParsed(g.game_state) : thisOrElse(g.game_state, {});
  } catch {
    return {};
  }
}
// ── games.meta (Disk-IO fix, 2026-09-25) ────
// The GM portal writes a ~1 KB summary of each game beside its game_state: {v, turnMode,
// exempt:[player indices], …}. My Games used to pull every game's full world (hundreds of KB per
// game, on every page load) just to read the turn mode and which realms are exempt from orders;
// it now reads the summary and only falls back to the world for a row that has none.
// ARCHIVED (2026-09-27, Toby item 1). The GM portal writes `archived` onto game_state and mirrors it
// into meta; nothing is deleted, so an archived game still opens and still shows every past turn.
export function gameArchivedP(g: { readonly meta?: unknown; readonly game_state?: unknown }) {
  const m = gameMetaOf(g);
  if (m?.['archived'] !== undefined) return !!m['archived'];
  return !!theField(parseGameStateP(g), 'archived');
}
// Light read of games by id; if the meta column does not exist yet (the GM has not run the
// one-line migration) the query errors on the unknown column and we fall back to the full rows.
export async function fetchGamesLite(ids: readonly string[]) {
  let r: ADatabaseAnswer<AGameForItsCard[]> | ADatabaseAnswer<AGame[]> =
    await thePagesDb.thePlayersGames.theseGamesForTheirCards(ids);
  if (r.error && /meta/i.test(r.error.message || '')) r = await thePagesDb.thePlayersGames.theseGamesEveryColumn(ids);
  return r;
}
export function realmExemptFromOrdersP(G: unknown, idx: number) {
  const pl = theField(thisOrElse(G ? theField(G, 'players') : G, []), idx);
  if (!pl) return false;
  if (theField(pl, 'conceded') || theField(pl, '_eliminated')) return true;
  const hasProv = Number(theField(thisOrElse(theField(pl, 'provinces'), []), 'length')) > 0;
  const hasChar = theListToSearch(thisOrElse(G ? theField(G, 'characters') : G, [])).some(
    (c) => Boolean(c) && Boolean(theField(c, 'alive')) && theField(c, 'player') === idx,
  );
  return !hasProv && !hasChar;
}
export function realmExemptInP(g: { readonly meta?: unknown; readonly game_state?: unknown }, idx: number) {
  const m = gameMetaOf(g);
  const exempt = m ? m['exempt'] : undefined;
  if (isAList(exempt)) return exempt.includes(idx);
  return realmExemptFromOrdersP(parseGameStateP(g), idx);
}
export function ordersInTextP(
  g: { readonly status?: string | null; readonly meta?: unknown; readonly game_state?: unknown } | null | undefined,
  slots: readonly (ARealmsSlot | null | undefined)[] | null | undefined,
) {
  if (g?.status !== 'active') return '';
  const need = (slots ?? []).filter((p): p is ARealmsSlot =>
    Boolean(p && !p.is_bot && !realmExemptInP(g, p.player_index)),
  );
  if (need.length === 0) return '';
  const inN = need.filter((p) => p.orders_submitted).length;
  const waiting = need.length - inN;
  const head = kcHtml`📜 <strong>${inN} of ${need.length}</strong> realm${need.length !== 1 ? 's' : ''} have sent orders`;
  return waiting === 0
    ? kcHtml`${head} — every realm is in, so the turn can be run.`
    : kcHtml`${head} — still waiting on ${waiting} more.`;
}

// ── Turn running mode (mirror of the GM portal's turnMode; read-only here) ────
// The GM chooses manual / automatic / automatic-with-deadline. Players are shown the deadline (in
// their own local time), and the COUNT of realms whose orders are in — never which ones.
export function turnModeOfGame(g: { readonly meta?: unknown; readonly game_state?: unknown }) {
  let gs: unknown = gameMetaOf(g);
  if (!gs) {
    try {
      gs = typeof g.game_state === 'string' ? theStateParsed(g.game_state) : thisOrElse(g.game_state, {});
    } catch {
      gs = {};
    }
  }
  const held = gs ? theField(gs, 'turnMode') : gs;
  const tm = held && typeof held === 'object' ? held : {};
  const mode: unknown = Reflect.get(tm, 'mode');
  const MODES: readonly unknown[] = ['manual', 'auto', 'deadline'];
  return {
    mode: MODES.includes(mode) ? mode : 'manual',
    nextDeadlineAt: thisOrElse(Reflect.get(tm, 'nextDeadlineAt'), null),
  };
}
export function fmtDeadlineP(iso: unknown) {
  if (!iso) return '';
  try {
    return theDateOf(iso).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return inWords(iso);
  }
}
export function turnDeadlineText(
  g:
    | {
        readonly status?: string | null;
        readonly turn?: number | null;
        readonly meta?: unknown;
        readonly game_state?: unknown;
      }
    | null
    | undefined,
) {
  if (g?.status !== 'active') return '';
  const tm = turnModeOfGame(g);
  if (tm.mode === 'auto')
    return kcHtml`⚙️ Turn ${g.turn} resolves automatically as soon as every realm has sent its orders.`;
  if (tm.mode === 'deadline' && tm.nextDeadlineAt) {
    const late = Date.now() >= theDateOf(tm.nextDeadlineAt).getTime();
    return kcHtml`⏱ Turn ${g.turn} deadline: <strong>${fmtDeadlineP(tm.nextDeadlineAt)}</strong> (your local time)${late ? ' — passed; the turn is being resolved' : ''}. It resolves at that time, or sooner if every realm has sent its orders. Orders not in by then hold (Defend).`;
  }
  return '';
}

export async function loadOpenGames() {
  const el = document.getElementById('open-games-list');
  // Get my game IDs to exclude them
  const { data: mySlots } = await thePagesDb.thePlayersRealms.theGamesOfThisAccountsRealms(theSignedInAccountsId());
  const myGameIds = new Set((mySlots ?? []).map((s) => s.game_id));

  // Fetch setup-status games separately (no join — avoids RLS blocking)
  const { data: games, error } = await thePagesDb.thePlayersGames.theGamesInSetup();
  if (error) {
    theElementFound(el).innerHTML = String(kcHtml`<div class="msg-error">${error.message}</div>`);
    return;
  }
  if (!games || games.length === 0) {
    theElementFound(el).innerHTML =
      '<div style="color:#3a3224;font-size:.85rem;font-style:italic">No open games at the moment. Ask your GM to create one.</div>';
    return;
  }
  // Fetch player counts for these games
  const gameIds = games.map((g) => g.id);
  const { data: allSlots } = await fetchGameSlots(gameIds);
  const slotsByGame: Partial<Record<string, ARealmsSlot[]>> = {};
  allSlots.forEach((s) => {
    const list = slotsByGame[s.game_id] ?? [];
    slotsByGame[s.game_id] = list;
    list.push(s);
  });
  // fetch GM display names + parse world size for each game.
  const gmIds = [...new Set(games.map((g) => g.gm_user_id).filter((id): id is string => Boolean(id)))];
  const gmNameById: Partial<Record<string, string | null>> = {};
  if (gmIds.length) {
    const { data: gmProfiles } = await thePagesDb.theAccountsNames.theNamesOfTheseAccounts(gmIds);
    (gmProfiles ?? []).forEach((pr) => {
      gmNameById[pr.id] = pr.name;
    });
  }
  // these keys were 'small'/'medium'/'large'/'huge' — a naming from before the map ladder became
  // p2..p10, so SIZE_LABEL[cfg.mapSize] NEVER matched and every joinable game was advertised as
  // "Medium (12×8)" whatever its real size. Keyed to the real mapSize values now, and the
  // dimensions match the GM portal's sizemap (both must change together).
  // Each label is words, none empty: `?? '—'` gives what `|| '—'` gave.
  const SIZE_LABEL: Readonly<Partial<Record<string, string>>> = {
    p2: '2 realms (8×5)',
    p3: '3 realms (8×7)',
    p4: '4 realms (9×7)',
    p5: '5 realms (12×7)',
    p6: '6 realms (15×7)',
    p7: '7 realms (16×7)',
    p8: '8 realms (17×8)',
    p9: '9 realms (16×11)',
    p10: '10 realms (16×11)',
  };
  const gameInfo = (g: AGame) => {
    let cfg: unknown = {};
    try {
      cfg = typeof g.game_state === 'string' ? theStateParsed(g.game_state) : thisOrElse(g.game_state, {});
    } catch {
      // a state that isn't JSON reads as no settings
    }
    // 2026-09-25: the GM's sea share (20–80%); games made before the setting read as the 35% default.
    const _sp = parseInt(String(theField(cfg, 'seaPct')));
    const seaPct = Number.isFinite(_sp) ? Math.max(20, Math.min(80, _sp)) : 35;
    return {
      gm: (gmNameById[String(g.gm_user_id)] ?? '') || 'the Game Master',
      size: (SIZE_LABEL[String(theField(cfg, 'mapSize'))] ?? '—') + ', ' + String(seaPct) + '% sea',
    };
  };
  // Human-joinable capacity = max players minus GM bot realms (bots stay hidden from players). An
  // all-bot game has capacity 0 and never appears as joinable.
  const humanCapOf = (g: AGame) => {
    let cfg: unknown = {};
    try {
      cfg = typeof g.game_state === 'string' ? theStateParsed(g.game_state) : thisOrElse(g.game_state, {});
    } catch {
      // a state that isn't JSON reads as no settings
    }
    const maxP = g.max_players || 4;
    if (theField(cfg, 'allBot') === true) return 0;
    const bots = Math.max(0, Math.min(parseInt(String(theField(cfg, 'botCount'))) || 0, maxP));
    return Math.max(0, maxP - bots);
  };

  // Visibility gate: a Private game (game_state.visibility==='private') is only visible to the
  // players in its `invited` list. Games with no `visibility` key (all pre-existing games, and
  // every game once it goes active) read as Public, so running games are unaffected. This is a
  // UI-level gate matching the existing client-side capacity filter — see note in DEV_LOG about
  // tightening with RLS later.
  const visOf = (g: AGame) => {
    let cfg: unknown = {};
    try {
      cfg = typeof g.game_state === 'string' ? theStateParsed(g.game_state) : thisOrElse(g.game_state, {});
    } catch {
      // a state that isn't JSON reads as no settings
    }
    const isPrivate = theField(cfg, 'visibility') === 'private';
    const invited = isPrivate ? theField(cfg, 'invited') : undefined;
    return { private: isPrivate, invited: isPrivate && isAList(invited) ? invited : [] };
  };
  const canSee = (g: AGame) => {
    const v = visOf(g);
    return !v.private || v.invited.includes(theSignedInAccountsId());
  };

  const openGames = games.filter((g) => {
    if (myGameIds.has(g.id)) return false;
    if (!canSee(g)) return false; // private game this player wasn't invited to
    const joined = (slotsByGame[g.id] ?? []).filter((p) => !p.is_bot).length;
    return joined < humanCapOf(g);
  });

  if (openGames.length === 0) {
    theElementFound(el).innerHTML =
      '<div style="color:#3a3224;font-size:.85rem;font-style:italic">No open games at the moment. Ask your GM to create one.</div>';
    return;
  }
  const theOpenCards = String(
    kcHtml`${openGames.map((g) => {
      const joined = (slotsByGame[g.id] ?? []).filter((p) => !p.is_bot).length;
      const maxP = humanCapOf(g); // human-facing capacity; reserved bot slots stay hidden
      const info = gameInfo(g);
      const privBadge = visOf(g).private ? kcHtml` <span class="pill pill-blue">🔒 Invited</span>` : '';
      return kcHtml`<div class="game-card clickable" onclick="showJoinGame(${kcArg(g.id)},${kcArg(g.name)},${kcArg(maxP)},${kcArg(joined)},${kcArg(info.gm)},${kcArg(info.size)})">
      <div class="gc-name">${g.name} <span class="pill pill-green">Open</span>${privBadge}</div>
      <div class="gc-meta">GM: <strong>${info.gm}</strong> · World: ${info.size} · ${joined}/${maxP} players joined</div>
      <div class="gc-meta" style="opacity:.7">Click to join this game</div>
    </div>`;
    })}`,
  );
  theElementFound(el).innerHTML = theOpenCards;
}

// ── GAME LISTS ────
export async function loadAllGames() {
  await Promise.all([loadMyGames(), loadOpenGames(), loadGmOffer()]);
}

// ── GAME MASTER OFFER (P0-32c) ────
// The Overlord offers an account Game Master (P0-32b): its own game_masters row, open while accepted_at is
// null. Accept and No thanks are database functions acting on the signed-in account's own offer. The banner
// is an extra: if the read fails, it just stays hidden.
export async function loadGmOffer() {
  const el = document.getElementById('gm-offer-banner');
  const { data, error } = await thePagesDb.theRoles.theGameMasterOfferMadeToThisAccount(theSignedInAccountsId());
  const open = !error && data && !data.accepted_at;
  if (open) {
    theElementWithTheId('gm-offer-ask', HTMLElement).style.display = 'block';
    theElementWithTheId('gm-offer-done', HTMLElement).style.display = 'none';
  }
  theElementFound(el).style.display = open ? 'block' : 'none';
}
