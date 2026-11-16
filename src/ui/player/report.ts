import { kcHtml, type KcSafeHtml } from '../shared/kc-safe.ts';
import { KC_SEASONS } from '../../content/kingdoms-call-data.ts';
import {
  asItsGuardReadsIt,
  countsAgainstBeastCommand,
  dispFloor,
  itemUsableBy,
  skillFameLabelM,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { kcJoinP } from './a-list-of-kchtml-pieces-joined-by-a-separator.ts';
import { thePagesDb } from './startup.ts';
import { GUARD_POWER_COLORS_P, itemBoundTag, itemsForDisplayP, itemSlotTag, itemTierTagP } from './items-and-heroes.ts';
import { refreshTurnNavHighlight, show, snapshotTurnLabel } from './init.ts';
import { ensureProvinceLinking } from './layout.ts';
import { turnDeadlineText } from './game-lists.ts';
import { buildChronicle } from './join-and-chronicle.ts';
import { renderMastery, renderTitles } from './titles.ts';
import { unitEmoji } from './order-chances.ts';
import { buildOrdersForm } from './orders-form.ts';
import { itemAcquiredTagP, itemLoreTip, unitAbilityTip, restoreSubmitWrap } from './briefing-and-submit.ts';
import {
  capitalise,
  formatRace,
  skillRowHTML,
  armyLabel,
  theArmyCardsAirAndSeaNotesOfAColumn,
  theArmyCardsFiguresOfAColumn,
} from './skills-and-projections.ts';
import {
  CHIEFTAIN_MARKER_COLOR,
  _lairName,
  bulletizeDesc,
  provLinkHtml,
  provinceGrandDesignHTML,
  reportColour,
  spiedExtraP,
  terrorNoteP,
  deadHeroRealmTagP,
  renderDiplomacy,
} from './map-symbols.ts';
import { renderPlayerMap } from './map.ts';
import { initMessaging, refreshOrdersVisibility } from './dispatches.ts';
import { SKILL_LABELS } from './the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import {
  isAList,
  theField,
  theListToSearch,
  thisOrElse,
} from '../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';
import { theStateParsed } from './game-lists.ts';
import { inWords } from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';
import type { AGameForItsReport, ARealmForItsReportScreen } from '../../db/the-db-interface-and-its-areas.ts';
import type { AHeroAsTheOrderFormBuildsHim, TheReportAsTheOrderFormHoldsIt } from './orders-form.ts';

/** The report as the order form holds it, the type the report screen's report builds on. */
type TheReportTheFormHolds = TheReportAsTheOrderFormHoldsIt;
/** A company as the army card and the province list read it (armyLabel's), with its pace. */
type ACompanyAsTheReportScreenReadsIt = Parameters<typeof armyLabel>[0] & { readonly speed?: number | undefined };
/** A title or a perk a hero holds, as his card names it. */
interface ATitleAHeroHolds {
  readonly name?: string | undefined;
  readonly perk?: string | undefined;
}
/** A hero of the realm as the report screen reads him: the order form's hero, the heir's crowned skills the screen writes,
 *  and what his card shows (his health, pace, temper, wage, titles and armies). */
interface AHeroAsTheReportScreenReadsHim extends AHeroAsTheOrderFormBuildsHim {
  /** The heir's skills as crowned, which the screen snapshots as the report opens. */
  _heirBase?: Partial<Record<string, number>> | null | undefined;
  readonly temperEff?: string | undefined;
  readonly effectiveAirSpeed?: number | null | undefined;
  readonly effectiveSeaSpeed?: number | null | undefined;
  readonly titlesHeld?: readonly (ATitleAHeroHolds | null | undefined)[] | null | undefined;
  readonly minorHeld?:
    readonly ((ATitleAHeroHolds & { readonly key?: unknown }) | null | undefined)[] | null | undefined;
  readonly armies?: readonly ACompanyAsTheReportScreenReadsIt[] | null | undefined;
}
/** A lair of a province the realm owns, as the province list reads it. */
type ALairAsTheProvinceListReadsIt = NonNullable<
  NonNullable<NonNullable<TheReportTheFormHolds['ownedProvinces']>[number]['features']>[number]
> & { readonly discovered?: unknown };
/** A province the realm owns, as the province list reads it. */
type AProvinceAsTheProvinceListReadsIt = Omit<
  NonNullable<TheReportTheFormHolds['ownedProvinces']>[number],
  'features' | 'garrisonArmies'
> & {
  readonly features?: readonly ALairAsTheProvinceListReadsIt[] | null | undefined;
  readonly garrisonArmies?: readonly ACompanyAsTheReportScreenReadsIt[] | null | undefined;
};
/** A fallen hero the realm can see, as the Fallen Heroes list reads him. */
type AFallenHeroAsTheListReadsHim = NonNullable<TheReportTheFormHolds['visibleDeadHeroes']>[number] & {
  readonly race?: string | undefined;
  readonly alignment?: string | undefined;
  readonly locationName?: string | undefined;
  readonly killedOnTurn?: number | undefined;
  readonly topSkill?: { readonly skill: string; readonly level: number } | null | undefined;
  readonly servedOther?: unknown;
  readonly isOwn?: unknown;
  readonly inVisibleProv?: unknown;
};
/** A reading of a province's graves, as the Graveyards Known list reads it. */
type AGraveReadingAsTheListReadsIt = NonNullable<NonNullable<TheReportTheFormHolds['graveIntel']>[number]> & {
  readonly name?: string | undefined;
  readonly detailTurn?: number | null | undefined;
};
/** A mercenary band the realm sees, as the Mercenary Bands list reads it. */
type AMercenaryBandAsTheListReadsIt = NonNullable<TheReportTheFormHolds['mercIntel']>[number] & {
  readonly location?: string | undefined;
};
/** A hero seen, as the Wandering Heroes, Local Chieftains and Enemy Heroes lists read him (and spiedExtraP). */
type AHeroSightedAsTheListsReadHim = NonNullable<Parameters<typeof spiedExtraP>[0]> & {
  readonly type?: string | undefined;
  readonly name?: string | undefined;
  readonly race?: string | undefined;
  readonly alignment?: string | undefined;
  readonly kingdom?: string | undefined;
  readonly locationName?: string | undefined;
  readonly topSkill?: { readonly skill: string; readonly level: number } | null | undefined;
  readonly spiedSkills?: Readonly<Partial<Record<string, number>>> | null | undefined;
  readonly spiedTurn?: number | undefined;
  readonly armyBand?: string | undefined;
  readonly pay?: number | null | undefined;
  readonly inOwnedProvince?: unknown;
};
/** An event that struck a province, as the Province Reports list reads it (and a spy's line, as his report reads it). */
interface AProvincesEventAsTheListReadsIt {
  readonly provName?: string | undefined;
  readonly phase?: number | null | undefined;
  readonly text?: string | undefined;
}
/** A hero standing in a province the realm spied, as the Spied Provinces list reads him. */
interface AHeroInASpiedProvince {
  readonly category?: string | undefined;
  readonly color?: string | undefined;
  readonly name?: string | undefined;
  readonly isKing?: unknown;
  readonly kingdom?: string | undefined;
  readonly isNeutralGuard?: unknown;
  readonly armies?: readonly ACompanyAsTheReportScreenReadsIt[] | null | undefined;
  readonly armyBand?: string | undefined;
  readonly armyCount?: number | undefined;
  readonly spiedSkills?: Readonly<Partial<Record<string, number>>> | null | undefined;
}
/** A province the realm spied, as the Spied Provinces list reads it. */
interface AProvinceSpied {
  readonly spied?: unknown;
  readonly provName?: string | undefined;
  readonly characters?: readonly AHeroInASpiedProvince[] | null | undefined;
}
/** A spy's watch of a province, as the Spy Activity Reports list reads it. */
interface ASpysWatch {
  readonly provName?: string | undefined;
  readonly sincePhase?: number | undefined;
  readonly lines?: readonly AProvincesEventAsTheListReadsIt[] | null | undefined;
}
/** What Hunting Rumours learned of a lair's hoard. */
interface AHoardRumoured {
  readonly turn?: number | undefined;
  readonly gold?: number | undefined;
  readonly items?: readonly string[] | null | undefined;
  readonly stolen?: readonly string[] | null | undefined;
  readonly wields?: readonly string[] | null | undefined;
}
/** A lair the realm knows, as the Known Lairs card reads it. */
type ALairKnownAsTheCardReadsIt = NonNullable<TheReportTheFormHolds['knownFeatures']>[number] & {
  readonly name?: string | undefined;
  readonly province?: string | undefined;
  readonly monster?: string | undefined;
  readonly monsterCat?: string | undefined;
  readonly monsterPower?: string | undefined;
  readonly ritualSite?: unknown;
  readonly isOwned?: unknown;
  readonly rumour?: AHoardRumoured | null | undefined;
};
/** A discovery the realm made, as the Sage Discoveries card reads it. */
type ADiscoveryAsTheCardReadsIt = NonNullable<NonNullable<TheReportTheFormHolds['discoveries']>[number]> & {
  readonly category?: string | undefined;
  readonly name?: string | undefined;
  readonly turnDiscovered?: number | undefined;
};
/** The realm's figures as the realm card reads them: the treasury, the wages, and the tax ledger's lines. */
type TheRealmAsTheRealmCardReadsIt = NonNullable<TheReportTheFormHolds['kingdom']> &
  Readonly<Partial<Record<ALineOfTheTaxLedger, number>>> & {
    readonly sageDiscG?: number | null | undefined;
    readonly rawTaxBase?: number | null | undefined;
    readonly hostLeaderG?: number | undefined;
    readonly orcSpoilsG?: number | undefined;
    readonly heroWageDisc?: number | undefined;
  };
/** The tax ledger's lines the realm card reads by name. */
type ALineOfTheTaxLedger =
  | 'consecG'
  | 'neutralTradeBonus'
  | 'sdRecords'
  | 'sdAgri'
  | 'sdMining'
  | 'sdAqueduct'
  | 'sdCreed'
  | 'interestBonus'
  | 'sdGrand'
  | 'taxBonus'
  | 'perProvBonus'
  | 'thiefStipend'
  | 'cutpurseG'
  | 'championG'
  | 'castellanG'
  | 'earthquakeReduction'
  | 'enslaveReduction'
  | 'taxBonusCutG'
  | 'taxBonusCapG';
/** The report as the report screen reads it (openReport, renderReportView), the page's report (currentReport): the order
 *  form's report, every part optional, with the parts only this screen reads. A report parsed from JSON is read as this
 *  type unchecked (isATurnReport). */
export interface TheReportAsTheReportScreenReadsIt extends TheReportTheFormHolds {
  _liveTurn?: number | null | undefined;
  readonly waitingForTurn0?: unknown;
  readonly lastTurnLog?: Parameters<typeof buildChronicle>[0];
  characters?: AHeroAsTheReportScreenReadsHim[] | null | undefined;
  readonly kingdom?: TheRealmAsTheRealmCardReadsIt | null | undefined;
  readonly ownedProvinces?: readonly AProvinceAsTheProvinceListReadsIt[] | null | undefined;
  readonly heroSightings?: readonly AHeroSightedAsTheListsReadHim[] | null | undefined;
  readonly knownFeatures?: readonly ALairKnownAsTheCardReadsIt[] | null | undefined;
  readonly mercIntel?: readonly AMercenaryBandAsTheListReadsIt[] | null | undefined;
  readonly visibleDeadHeroes?: readonly AFallenHeroAsTheListReadsHim[] | null | undefined;
  readonly graveIntel?: readonly (AGraveReadingAsTheListReadsIt | null | undefined)[] | null | undefined;
  readonly provinceEvents?: readonly AProvincesEventAsTheListReadsIt[] | null | undefined;
  readonly provinceCharIntel?: readonly AProvinceSpied[] | null | undefined;
  readonly spyActivity?: readonly ASpysWatch[] | null | undefined;
  readonly knownGuardianWeaknesses?:
    | Readonly<Partial<Record<string, { readonly name?: string | undefined; readonly desc?: string | undefined }>>>
    | null
    | undefined;
  readonly discoveries?: readonly (ADiscoveryAsTheCardReadsIt | null | undefined)[] | null | undefined;
}

/** A realm's seat as the report screen holds it: its row, the game it hangs on it, and the game's live turn. */
type TheSeatAsTheReportScreenHoldsIt = ARealmForItsReportScreen & {
  games?: AGameForItsReport | null;
  _liveTurn?: number;
};

/** A row an answer gave, which the code reads unchecked: for none, the TypeError the read threw. */
function theRowAnswered<T>(row: T | null, field: string): T {
  if (row === null) throw new TypeError(`Cannot read properties of null (reading '${field}')`);
  return row;
}

/** Whether a turn report, parsed from its JSON or as the database holds it, is an object, which the page then reads as
 *  the report (a list passes too, as it did). On the maintainer's answer of 14 November this is all it checks: the
 *  report's parts are read as the report's types claim, unchecked, as before. */
/** `{ ...levels }` on a value of any kind, as a draft parsed from JSON holds an heir's levels: its own fields copied (a
 *  JSON value has no other kind of field), none for none. */
function theLevelsCopied(levels: unknown): Partial<Record<string, number>> {
  if (levels === null || levels === undefined) return {};
  return Object.fromEntries(Object.entries(levels));
}

/** An item a hero's card shows: the pack's item, with the words that describe it. */
interface AnItemTheCardShows extends NonNullable<ReturnType<typeof itemsForDisplayP>[number]> {
  readonly desc?: unknown;
}
/** An item of the pack the card shows, which it reads the name of: for none, the TypeError that read threw. */
function theItemShown(it: ReturnType<typeof itemsForDisplayP>[number]): NonNullable<typeof it> {
  if (it === null || it === undefined) throw new TypeError(`Cannot read properties of ${String(it)} (reading 'name')`);
  return it;
}
/** A title or a perk a hero's card names: for none, the TypeError the read of its name threw. */
function theTitleShown<T extends ATitleAHeroHolds>(tt: T | null | undefined): T {
  if (tt === null || tt === undefined) throw new TypeError(`Cannot read properties of ${String(tt)} (reading 'name')`);
  return tt;
}
/** A hero's name the army card splits for his first name: for none, the TypeError the split threw. */
function theNameToSplit(name: string | undefined): string {
  if (name === undefined) throw new TypeError("Cannot read properties of undefined (reading 'split')");
  return name;
}
/** The army card's figures for the company at `i` of the column they were worked out for (one a company): for none, the
 *  TypeError the destructuring threw. */
function theFiguresOfTheCompanyAt<T>(units: readonly T[], i: number): T {
  const figures = units[i];
  if (figures === undefined) throw new TypeError(`Cannot destructure the figures of the company ${String(i)}`);
  return figures;
}
/** A part of a card the report screen builds: a piece of HTML, or a list of them. */
type APartOfACard = KcSafeHtml | readonly KcSafeHtml[];

/** The skills' names by any key. */
const theSkillsNames: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
/** A spied skill's level above nothing (`v > 0`, as a number). */
function aSpiedLevelAboveNothing(skill: [string, number | undefined]): skill is [string, number] {
  return Number(skill[1]) > 0;
}
/** A season by a phase that may be missing (`SEASONS[phase]`): none for none. */
function theSeasonOf(seasons: readonly string[], phase: number | undefined): string | undefined {
  return phase === undefined ? undefined : seasons[phase];
}
/** A group the code has just filed under a key it now lists (a Map's keys, Object.keys or entries): for none, the
 *  TypeError the read of it threw. */
function theGroupFiled<T>(group: T | undefined, what: string): T {
  if (group === undefined) throw new TypeError(`Cannot read properties of undefined (reading '${what}')`);
  return group;
}
/** A discovery the card files by its kind: for none, the TypeError the read of its kind threw. */
function theDiscoveryFiled(d: ADiscoveryAsTheCardReadsIt | null | undefined): ADiscoveryAsTheCardReadsIt {
  if (d === null || d === undefined) throw new TypeError(`Cannot read properties of ${String(d)} (reading 'category')`);
  return d;
}

/** The page's diplomatic choices this turn, which the code writes into: for none, the TypeError that write threw. */
function theDiplomaticChoicesHeld(): Partial<Record<string, unknown>> {
  if (diploChoices === null) throw new TypeError("Cannot read properties of null (setting the realm's declaration)");
  return diploChoices;
}
/** A hero of the game's saved state, as the past turn's chronicle names him. */
type AHeroOfTheSavedGame = Parameters<typeof buildChronicle>[1][number] & { readonly player?: unknown };
/** Whether a hero of the game's saved state, as parsed from JSON, is an object, which the chronicle then reads as its hero
 *  (the same check as the report's, isATurnReport). */
function isAHeroOfTheSavedGame(c: unknown): c is AHeroOfTheSavedGame {
  return typeof c === 'object' && c !== null;
}
/** The realm `pi`'s heroes among the game's saved heroes (`c.player === pi`): a gap throws the TypeError that read threw;
 *  any other value that is no object has no realm. */
function theRealmsHeroesIn(allChars: readonly unknown[], pi: number): AHeroOfTheSavedGame[] {
  return allChars.filter((c): c is AHeroOfTheSavedGame => {
    if (c === null || c === undefined) throw new TypeError(`Cannot read properties of ${String(c)} (reading 'player')`);
    return isAHeroOfTheSavedGame(c) && c.player === pi;
  });
}
/** A line of the GM's log, as the past turn's chronicle reads it: the chronicle's line, and whom it names. */
type ALineOfTheGmsLog = NonNullable<NonNullable<Parameters<typeof buildChronicle>[0]>[number]> & {
  readonly targets?: unknown;
  readonly actor?: unknown;
};
/** Whether a line of the GM's log, as parsed from JSON, is an object, which the chronicle then reads as its line (the same
 *  check as the report's, isATurnReport). */
function isALineOfTheGmsLog(e: unknown): e is ALineOfTheGmsLog {
  return typeof e === 'object' && e !== null;
}
/** `targets.includes(realm)` on a line's targets of any kind, as JavaScript calls it: a list's, or words' (which read the
 *  realm as words); any other value has no `includes`, the TypeError the call threw. */
function theTargetsHold(targets: unknown, realm: number): boolean {
  if (isAList(targets)) return targets.includes(realm);
  if (typeof targets === 'string') return targets.includes(String(realm));
  throw new TypeError('(e.targets || []).includes is not a function');
}

/** An element's inline style, as `el.style` reads it (an HTML, SVG or MathML element's): one with none gives the TypeError
 *  the read of its `display` threw. */
function theInlineStyleOf(el: Element): CSSStyleDeclaration {
  const style: unknown = Reflect.get(el, 'style');
  if (style instanceof CSSStyleDeclaration) return style;
  throw new TypeError("Cannot read properties of undefined (reading 'display')");
}

function isATurnReport(held: unknown): held is TheReportAsTheReportScreenReadsIt {
  return typeof held === 'object' && held !== null;
}

/** The turn report the seat holds, as the page reads it: its JSON parsed, or the value itself, `{}` for none. Anything
 *  but an object throws the TypeError the page's first write on it (`_liveTurn`) threw. */
function theTurnReportOf(seat: Pick<ARealmForItsReportScreen, 'turn_report'>): TheReportAsTheReportScreenReadsIt {
  const held =
    typeof seat.turn_report === 'string' ? theStateParsed(seat.turn_report) : thisOrElse(seat.turn_report, {});
  if (isATurnReport(held)) return held;
  if (held === null) throw new TypeError("Cannot set properties of null (setting '_liveTurn')");
  throw new TypeError(`Cannot create property '_liveTurn' on ${typeof held} '${inWords(held)}'`);
}

// ── TURN REPORT ────
export async function openReport(gamePlayerId: string) {
  currentGamePlayerId = gamePlayerId;
  try {
    history.replaceState(null, '', location.pathname + location.search + '#game=' + encodeURIComponent(gamePlayerId));
  } catch {
    // a refresh returns here
  }
  show('sec-report');
  {
    const _ntb = document.getElementById('new-turn-banner');
    if (_ntb) _ntb.style.display = 'none';
  } // clear any stale new-turn notice
  theElementWithTheId('report-title', HTMLElement).textContent = 'Loading…';

  // Fetch game_player row first
  const { data: gpAnswered, error } = await thePagesDb.thePlayersRealms.thisRealm(gamePlayerId);
  if (error) {
    theElementWithTheId('report-title', HTMLElement).textContent = 'Error: ' + error.message;
    return;
  }
  const gp: TheSeatAsTheReportScreenHoldsIt = theRowAnswered(gpAnswered, 'game_id');
  // Fetch game separately to avoid RLS join issue. Disk-IO (2026-09-25): the report screen reads
  // only name / turn / status off the game row — never its world. block_eliminated_msgs is the GM's Dispatches
  // switch (P0-25, R-075).
  const { data: gAnswered, error: gErr } = await thePagesDb.thePlayersGames.thisGameForItsReport(gp.game_id);
  if (gErr) {
    theElementWithTheId('report-title', HTMLElement).textContent = 'Error loading game: ' + gErr.message;
    return;
  }
  gp.games = gAnswered; // attach for compatibility
  currentGamePlayer = gp;
  const g = theRowAnswered(gAnswered, 'turn');
  gp._liveTurn = g.turn || 1; // actual current turn for orders
  const report = theTurnReportOf(gp);
  currentReport = report;
  report._liveTurn = g.turn || 1; // ensure submit uses live turn not report turn
  // Royal succession: re-apply any saved heir skill allocation from this turn's DRAFT onto the heir
  // characters BEFORE the realm + orders sections render. This makes the allocation (a) survive a
  // re-render (openReport re-fetches the pristine turn_report, which would otherwise wipe it) and
  // (b) take effect immediately this turn — the order forms read c.skills, so newly-bought magic
  // surfaces its spells straight away. Also snapshot each heir's crowned skills as _heirBase so the
  // ± allocator knows the floor it may not reduce below.
  try {
    const _draft = typeof gp.orders === 'string' ? theStateParsed(gp.orders || '{}') : thisOrElse(gp.orders, {});
    const _ks = _draft && theField(_draft, 'kingSkills');
    (report.characters ?? []).forEach((c) => {
      if (!c._isHeir) return;
      const a = _ks && theField(_ks, c.id);
      if (a) {
        const base = theField(a, 'base');
        if (base) c._heirBase = theLevelsCopied(base);
        const skills = theField(a, 'skills');
        if (skills) c.skills = theLevelsCopied(skills);
        const pending = theField(a, 'pending');
        if (typeof pending === 'number') c._pendingSkillAllocation = pending;
        // the draft's name and temper, as it holds them (words, as the heir's fields save them)
        const name = theField(a, 'name');
        if (name) Reflect.set(c, 'name', name);
        const temper = theField(a, 'temper');
        if (temper) Reflect.set(c, 'temper', temper);
      }
      // First sighting (or a draft with no base recorded yet): the current skills ARE the base.
      c._heirBase ??= { ...(c.skills ?? {}) };
    });
  } catch {
    /* no draft yet — heir shows freshly-crowned base skills */
  }
  diploChoices = {}; // fresh pending diplomacy each time a report opens (restored from any saved draft below)
  discoveryChoices = {};
  reckoningCall = false;
  concedeGame = false;
  viewingReport = report; // map/history starts on the current report

  // DISPATCHES (2026-09-27). Started here, BEFORE the waiting-for-Turn-0 return below, because
  // messages are not part of the turn cycle: realms can write to each other from the moment the game
  // has two human players. It is awaited nowhere — a slow roster query must not hold up the report.
  initMessaging(gp.game_id, gp.player_index, report, g).catch((e: unknown) => {
    console.warn('Dispatches:', e);
  });

  // Turn numbering, player-facing:
  // liveTurn = the turn the realm is living through — the one being planned now, and the number
  //   the GM portal, the game list and the Orders card all show. The report header shows it too
  //   (2026-09-27): a realm on Turn 13 is reading its Turn 13 report.
  // resolvedTurn = the most recent RESOLVED turn. It is NOT a label any more — it is only the
  //   turn_logs key of the newest snapshot (see snapshotTurnLabel).
  const liveTurn = asItsGuardReadsIt(g.turn) ?? 1; // 0 during setup, and the header should say so
  const resolvedTurn = Math.max(0, (g.turn || 1) - 1);
  theElementWithTheId('report-title', HTMLElement).textContent = `${g.name} — Turn ${String(liveTurn)}`;
  theElementWithTheId('orders-turn-num', HTMLElement).textContent = String(Math.max(1, liveTurn));

  // Build turn navigation buttons: one per snapshot, labelled by the turn the player knew it as
  // (founding = Turn 1) up to the live turn.
  const navEl = document.getElementById('turn-nav-btns');
  if (navEl) {
    navEl.innerHTML = '';
    if ((g.turn || 0) >= 1) {
      for (let d = 0; d <= resolvedTurn; d++) {
        const btn = document.createElement('button');
        const lbl = snapshotTurnLabel(d);
        btn.textContent = `T${String(lbl)}`;
        btn.dataset['turn'] = String(d);
        btn.title =
          d === 0
            ? `Turn ${String(lbl)} — the founding report, your starting position`
            : `Turn ${String(lbl)} — the report you received then`;
        btn.onclick = (() => {
          const turn = d;
          const pi = gp.player_index;
          const cur = resolvedTurn;
          return () => {
            if (turn === cur) returnToCurrentReport();
            else void loadPastReport(gp.game_id, pi, turn);
          };
        })();
        navEl.appendChild(btn);
      }
      navEl.dataset['resolved'] = String(resolvedTurn);
      viewedTurn = null; // the main render always shows the current turn
      refreshTurnNavHighlight();
    }
  }
  theElementWithTheId('prev-report-banner', HTMLElement).style.display = 'none';

  // Status pill
  const submitted = gp.orders_submitted;
  theElementWithTheId('report-status-pill', HTMLElement).innerHTML = submitted
    ? '<span class="pill pill-blue">✓ Orders submitted</span>'
    : g.status === 'active'
      ? '<span class="pill pill-amber">⏳ Orders needed</span>'
      : '<span class="pill pill-green">Waiting to start</span>';
  {
    const _dl = document.getElementById('turn-deadline-line');
    if (_dl) {
      const t = turnDeadlineText(g);
      _dl.style.display = t ? 'block' : 'none';
      _dl.innerHTML = String(t);
    }
  }

  // Waiting for Turn 0
  if (report.waitingForTurn0 || g.turn === 0) {
    theElementWithTheId('report-kingdom', HTMLElement).innerHTML =
      '<div class="msg-info">The GM is setting up the game world. Check back soon — your turn report will appear here once Turn 0 has been run.</div>';
    theElementWithTheId('report-provinces', HTMLElement).innerHTML = '';
    {
      const _ri = document.getElementById('report-intel');
      if (_ri) _ri.innerHTML = '';
    }
    {
      const _of = document.getElementById('report-other-forces');
      if (_of) _of.innerHTML = '';
      const _lr = document.getElementById('report-lairs');
      if (_lr) _lr.innerHTML = '';
    }
    theElementWithTheId('orders-card', HTMLElement).style.display = 'none';
    refreshOrdersVisibility(false); // Turn 0 setup — no orders yet (desk-safe)
    return;
  }

  theElementWithTheId('orders-card', HTMLElement).style.display = 'block';
  refreshOrdersVisibility(true); // live turn — orders available; on desktop the desk tab decides display
  // (so Orders no longer overrides applyDeskViews and stacks over Report)

  // Orders form (current turn only). Built here, before the shared read-only view renders; it lives
  // in its own container (orders-column), so building it first is harmless. Past-turn views hide
  // that container and never reach this line.
  currentGamePlayer = gp;
  buildOrdersForm(report.characters ?? [], gp.orders_submitted, gp.orders, g.turn);

  // Render the whole read-only report body from THIS report object. Shared with past-turn viewing
  // so that opening an old turn reverts every section (not just the map + chronicle) to that turn.
  renderReportView(report);
}

// Renders the full read-only report body (chronicle, realm, provinces, intel, discoveries,
// diplomacy, titles, mastery, and the map) from whatever report object it is handed — the live
// turn_report for the current turn, or a per-turn snapshot when viewing history.
export function renderReportView(report: TheReportAsTheReportScreenReadsIt) {
  // Render chronicle
  buildChronicle(report.lastTurnLog ?? [], report.characters ?? []);

  // Realm summary
  const kingdom: TheRealmAsTheRealmCardReadsIt = report.kingdom ?? {};
  const chars = report.characters ?? [];
  const taxIncome = (kingdom.taxIncome ?? 0) || 0;
  const armyWages = (kingdom.armyWages ?? 0) || 0;
  const heroWages = (kingdom.heroWages ?? 0) || 0;
  const netIncome = taxIncome - armyWages - heroWages;
  const playerAlignment = (kingdom.alignment ?? '') || 'Neutral';

  const ALIGNMENT_SUMMARIES: Readonly<Partial<Record<string, string>>> = {
    Divine: `Your realm walks in the light of the divine. All heroes recover twice as much HP when they Rest (60% of maximum HP rather than the usual 30%). Your White Magic spells draw on deeper power — Bless Province adds 80% of a province's tax value rather than 60%, and when the KING works the blessing in person, the province yields a full 100% more. Should any of your characters — king or hero — fall, divine grace will return them to life after one full turn in death, restored to half health but stripped of armies and items — but ONLY upon consecrated ground: they rise in the nearest consecrated province you still hold, and the miracle spends that province's consecration. If the realm holds no consecrated province when the time comes, the grace is lost (a fallen king is then succeeded by an heir). Consecrate: your king may sanctify owned provinces, up to his White skill level at once (not the home province or its neighbours, and never two side by side — the crown's hearth was already anointed at the coronation, and the gods bid you carry the light outward). Consecrated ground yields +50% tax, its defenders are twice as likely to fight with fanatical zeal, Undead and Evil hosts attacking it fight at −15%, and it is where your fallen are restored. Guard it: a consecrated province that is captured loses its consecration at once, and each unit of the army that takes it has a 50% chance to gain an experience level. Your armies fight with a 50% chance of fanatical zeal — the highest of any alignment. But beware: your court is priced at the far end of the alignment spectrum — dark-hearted heroes cost dearly, and Undead heroes will never serve you at all.`,
    Good: `Your realm is known for honour and fellowship. Your armies fight with a solid 40% chance of fanaticism — second only to the Divine. Banner of Fellowship: allied contingents converging on the same battle unify 15% more readily under your honourable cause. Righteous Defence: any army defending a province you own fights at +10% — your soldiers know the ground they hold is held justly. Call to Arms: once per turn your king may summon the folk of any owned humanoid province — wherever they happen to be — and a free Green garrison unit of that province's native type musters to defend it. Sitting close to the centre of the alignment spectrum, most wandering heroes serve you cheaply.`,
    Druidic: `Your realm is bound to the living world. Your king commands Druid 1 from the outset, and all Creature armies — Thunderbirds, Forest Ents, Great Bears, Stone Giants, Unicorn Herd, Mammoth Host, Crimson Rocs, Whale Cohort and Great Turtles — follow your heroes without any Druid skill requirement, though a hero leads at most as many Creature and Monster units as his Druid level. There is always at least one Creature province within two provinces of your home. Home of the Wild: in forest and jungle, your Creature armies fight at ×1.5 strength. Your armies fight with a 20% chance of fanaticism, and your central place on the spectrum keeps most heroes affordable.`,
    Neutral: `Your realm prizes pragmatism above all. Province tax income flows 20% richer than other realms — traders and merchants gravitate toward your neutral courts. Standing at the exact centre of the alignment spectrum, EVERY wandering hero costs you at most 3g/turn — and most cost the base 2g — the cheapest court in the world. Mercenary bands cost 2g less to hire than the going rate. Broker: your king trades in influence rather than marches — they may hire any wandering hero the realm can see without leaving their hall (they serve from wherever they stand), or buy a guaranteed full Spy report on any province the realm has ever seen for 2g. Your scholars are twice as effective — each level of Sage skill doubles your chance of making a discovery. Your armies fight with a 10% chance of fanaticism.`,
    Pagan: `Your realm draws on ancient and forgotten powers. Your king walks the wild places from birth — Explorer 1 from the outset. Perform Rite at discovered ritual sites (now found across much of the world, commonest in wild Creature and Monster country): the Wild Hunt binds two of the province's creatures to your host as Veterans until the end of the following turn, and a Blood Offering sacrifices units to empower an equal number of others (+2 quality tiers each, to Elite). Blood Harvest: +1g per enemy unit your characters destroy in victory. Your armies fight with a 15% chance of fanaticism.`,
    Evil: `Your realm rules through fear and domination. Your king commands Druid 1 from the outset, and all Monster armies follow your heroes without any Druid skill requirement (every level of Druid a commander does hold adds +20% to them), though a hero leads at most as many Creature and Monster units as his Druid level. You begin beside a Monster province you can lead from turn one, and there is always at least one within two provinces of your home. When your forces win decisively, a Terror effect lingers — any army defending that province in the next battle fights at −10% strength, broken by what they witnessed — and by Reign of Fear your Monsters fight at ×1.5 when they attack a province your own Terror still grips. Monster armies — Cave Trolls, Manticore Pride, Basilisk Brood, Sea Giants, Eldritch Kraken, Elder Dragons, Titan Warbeasts, Dread Hydras and Shark Shoals — fight with savage fury under your command — a host with any of them in it fights at ×1.25 in every battle (no roll; it does not stack with zeal, the stronger counts). When one of your heroes conquers a province, he treats it by the conquest doctrine set on his orders: Terror plunders 50% of the province's tax value in gold at once; Enslave takes no gold but presses the beaten folk into a free Green garrison unit, and the province pays 1g less tax for 3 turns (only where the folk are humanoid: anywhere else, he plunders). Your armies fight with a 25% base chance of fanaticism.`,
    Undead: `Your realm defies death itself. Your king commands Necromancy 1 from the outset and begins with a unit of Skeletal Shieldwall Levies at their side. All skeletal armies under your banner are exempt from the Druid penalty, cost only 1g upkeep each, and fight with undying fanaticism in EVERY battle — ×1.5 (+50%) when the king leads them in person, ×1.3 (+30%) under any other commander — the whole host is lifted. Harvest the Field: any of your characters standing where armies have fallen may raise one grave as a Skeletal unit for 2g — no magic, no Necromancy skill, just corpse-carters and cold work. Deathless March: a force of skeletons alone can never be cut down in flight — with no line of retreat they simply stand and hold the ground, because the dead do not panic. Battlefield graves in your provinces decay at half the normal rate, preserving more fallen armies for the Skeletal Armies spell. But beware: your court is priced at the far end of the alignment spectrum — righteous heroes cost dearly, and Divine heroes will never serve you at all.`,
  };

  const alignSummary = ALIGNMENT_SUMMARIES[playerAlignment] ?? '';
  const alignColours: Readonly<Partial<Record<string, string>>> = {
    Divine: '#c8922a',
    Good: '#2d6a2d',
    Druidic: '#1a5e1a',
    Neutral: '#555',
    Pagan: '#7a4a00',
    Evil: '#8a1c1c',
    Undead: '#3a1a6a',
  };
  const alignIcons: Readonly<Partial<Record<string, string>>> = {
    Divine: '✨',
    Good: '⚔',
    Druidic: '🌿',
    Neutral: '⚖',
    Pagan: '🔥',
    Evil: '💀',
    Undead: '💀',
  };
  const alignBanner = alignSummary
    ? kcHtml`
    <div style="background:#fdf8ee;border-left:4px solid ${(alignColours[playerAlignment] ?? '') || '#888'};padding:8px 12px;margin-bottom:10px;border-radius:0 3px 3px 0">
      <div style="font-family:'Cinzel',serif;font-size:.72rem;color:${(alignColours[playerAlignment] ?? '') || '#888'};text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;font-weight:700">${alignIcons[playerAlignment] ?? ''} ${playerAlignment} Realm</div>
      <div style="font-size:.78rem;color:#444;line-height:1.5">${bulletizeDesc(alignSummary)}</div>
    </div>`
    : '';

  const cmGuide =
    playerAlignment === 'Druidic' || playerAlignment === 'Evil'
      ? kcHtml`
    <div style="font-size:.72rem;color:var(--stone);background:#f5f0e8;border:1px solid var(--stone);border-radius:2px;padding:5px 8px;margin-bottom:8px">
      ${playerAlignment === 'Druidic' ? kcHtml`🌿 <strong>Druidic bonuses</strong> — <span style="color:#1d5a1d"><strong>[C] Creature</strong></span> armies get no Druid penalty and fight at ×1.5 in forest/jungle; every level of Druid your commander holds adds +20% to them. Your king starts with Druid +1.` : ''}
      ${playerAlignment === 'Evil' ? kcHtml`💀 <strong>Evil bonuses</strong> — <span style="color:#701010"><strong>[M] Monster</strong></span> armies get no Druid penalty and lift the whole host to ×1.25 in every battle (not stacking with zeal); every level of Druid your commander holds adds +20% to them. Your king starts with Druid +1. On decisive wins: Terror effect, and Reign of Fear — your Monsters fight ×1.5 attacking ground your Terror grips. On province conquest, by each hero's doctrine: Terror plunders 50% of its tax; Enslave presses a free Green garrison unit, and the province pays 1g less tax for 3 turns.` : ''}
      <br><span style="color:#1d5a1d;font-weight:600">[C] Creatures:</span> Thunderbirds, Forest Ents, Great Bears, Stone Giants, Unicorn Herd, Mammoth Host, Crimson Rocs, Whale Cohort, Great Turtles
      ${playerAlignment === 'Evil' ? kcHtml`<br><span style="color:#701010;font-weight:600">[M] Monsters:</span> Cave Trolls, Manticore Pride, Basilisk Brood, Sea Giants, Eldritch Kraken, Elder Dragons, Titan Warbeasts, Dread Hydras, Shark Shoals` : ''}
    </div>`
      : '';
  // Royal-succession skill allocation is rendered at the TOP of the orders column now
  // (see heirSelectorHTML in buildOrdersForm), not here in the realm section.
  const realmCard = kcHtml`${alignBanner}${cmGuide}
    <div class="report-grid">
      <div class="stat-box"><div class="stat-label">Treasury</div><div class="stat-value">${(kingdom.gold ?? 0) || 0}g</div></div>
      <div class="stat-box"><div class="stat-label">Tax Income</div><div class="stat-value">${taxIncome}g/turn</div>${(() => {
        // A ledger: the bare province tax first, then one line per SOURCE of bonus, then penalties —
        // the lines always sum to the total above. Every gold-paying Sage discovery is ONE line.
        const K = (k: ALineOfTheTaxLedger) => (kingdom[k] ?? 0) || 0;
        const sage =
          kingdom.sageDiscG ??
          K('sdRecords') + K('sdAgri') + K('sdMining') + K('sdAqueduct') + K('sdCreed') + K('interestBonus');
        const bonuses = (
          [
            [K('consecG'), 'consecrated ground'],
            [K('neutralTradeBonus'), 'Neutral trade'],
            [sage, 'Sage Discoveries'],
            [K('sdGrand'), 'Grand Design'],
            [K('taxBonus'), 'magic items (tax bonus)'],
            [K('perProvBonus'), "Merchant's Ledger"],
            [K('thiefStipend'), 'master Thief stipend'],
            [K('cutpurseG'), 'the Cutpurse'],
            [K('championG'), 'Champion of the People'],
            [K('castellanG'), 'the Castellan'],
          ] satisfies [amount: number, source: string][]
        ).filter((b) => b[0] > 0);
        const eq = K('earthquakeReduction'),
          ens = K('enslaveReduction');
        const bonusSum = bonuses.reduce((a, b) => a + b[0], 0);
        // older saved reports carry no rawTaxBase — derive it so the ledger still sums
        const rawBase = kingdom.rawTaxBase ?? Math.max(0, taxIncome - bonusSum + eq + ens);
        const row = (txt: string, col: string) =>
          kcHtml`<div style="font-size:.62rem;color:${col};margin-top:1px;line-height:1.3">${txt}</div>`;
        const incl = [
          row(`Base province tax: ${String(rawBase)}g`, 'var(--stone)'),
          bonuses.map((b) => row(`+${String(b[0])}g ${b[1]}`, '#2d7a2d')),
          bonuses.length ? '' : row('no bonuses', 'var(--stone)'),
          // 2026-09-24: every tax-gold source is capped at 5% of the base province tax; say so when
          // the cap actually bit on the item gold (the discovery lines are capped one by one).
          K('taxBonusCutG') > 0
            ? row(
                `−${String(K('taxBonusCutG'))}g of item tax gold above the ${String(K('taxBonusCapG'))}g cap (5% of base tax)`,
                '#8a6d1f',
              )
            : '',
        ];
        const eqLine = eq > 0 ? row(`−${String(eq)}g lost to earthquake damage`, '#c00') : '';
        const ensLine = ens > 0 ? row(`−${String(ens)}g enslaved provinces seethe`, '#c00') : '';
        // The box projects NEXT turn's collection from the realm as it stands now; what was
        // actually banked this turn (with any one-turn Bless / Earthquake / Sabotage effects) is
        // the "collects...g in taxes" line under Kingdom Events.
        const noteLine = kcHtml`<div style="font-size:.6rem;color:var(--stone);margin-top:2px;line-height:1.3">projected for next turn — this turn's actual take is under Kingdom Events</div>`;
        return kcHtml`${incl}${eqLine}${ensLine}${noteLine}`;
      })()}</div>
      <div class="stat-box"><div class="stat-label">Army Wages</div><div class="stat-value" style="color:${armyWages > 0 ? '#c00' : 'inherit'}">${armyWages}g/turn</div>${(kingdom.hostLeaderG ?? 0) > 0 ? kcHtml`<div style="font-size:.62rem;color:#1d5a1d;margin-top:2px;line-height:1.3">after −${kingdom.hostLeaderG}g the Host-Leader</div>` : ''}${(kingdom.orcSpoilsG ?? 0) > 0 ? kcHtml`<div style="font-size:.62rem;color:#1d5a1d;margin-top:2px;line-height:1.3">after −${kingdom.orcSpoilsG}g Orcish war-spoils</div>` : ''}${kingdom.nextArmyWages != null && kingdom.nextArmyWages !== kingdom.armyWages ? kcHtml`<div style="font-size:.62rem;color:#2a2419;margin-top:2px;line-height:1.3">next turn: ${kingdom.nextArmyWages}g</div>` : ''}</div>
      <div class="stat-box"><div class="stat-label">Hero Wages</div><div class="stat-value" style="color:${heroWages > 0 ? '#c00' : 'inherit'}">${heroWages}g/turn</div>${(kingdom.heroWageDisc ?? 0) > 0 ? kcHtml`<div style="font-size:.62rem;color:#1d5a1d;margin-top:2px;line-height:1.3">after −${kingdom.heroWageDisc}g wage discounts</div>` : ''}${kingdom.nextHeroWages != null && kingdom.nextHeroWages !== kingdom.heroWages ? kcHtml`<div style="font-size:.62rem;color:#2a2419;margin-top:2px;line-height:1.3">next turn: ${kingdom.nextHeroWages}g</div>` : ''}</div>
      <div class="stat-box"><div class="stat-label">Net Income</div><div class="stat-value" style="color:${netIncome >= 0 ? '#2d7a2d' : '#c00'}">${netIncome >= 0 ? '+' : ''}${netIncome}g/turn</div></div>
      <div class="stat-box"><div class="stat-label">Provinces</div><div class="stat-value">${(report.ownedProvinces ?? []).length}</div></div>
    </div>
    ${chars
      .filter((c) => c.alive !== false)
      .map((c) => {
        const hpPct = dispFloor((Number(c.hp) / Number(c.maxHp)) * 100) || 0;
        // 2026-09-09e: was the raw trained level only — item, aura and Curse changes never showed, so
        // this card disagreed with both the orders column and the engine. Now the shared renderer.
        const skillRow = skillRowHTML(c, 'inline'); // match the orders column's inline style
        const effSpd =
          (c.armies ?? []).length === 0
            ? 5
            : (c.effectiveSpeed ?? Math.min(...(c.armies ?? []).map((a) => (a.speed ?? 0) || 3)));
        return kcHtml`<div class="char-card">
        <div class="char-card-head">
          <span style="font-size:.9rem">${c.isKing ? '👑' : '⚔'}</span>
          <span class="cname">${c.name} ${c.isKing ? '(Your King)' : '(Hero)'}</span>
          <div class="char-hp-wrap"><div class="char-hp-bar" style="width:${hpPct}%"></div></div>
          <span style="font-size:.7rem;color:var(--stone)">HP ${c.hp}/${c.maxHp}</span>
        </div>
        <div class="char-detail" style="background:#fdf5e0;border:1px solid var(--parchment-dark);border-radius:2px;padding:5px 10px 6px;font-size:.76rem;line-height:1.6;display:flex;flex-wrap:wrap;gap:8px">
          <span style="flex-basis:100%;width:100%;color:var(--stone)">${formatRace(c.race)} · ${(c.alignment ?? '') || '—'} · ${(c.temper ?? '') || '—'}${c.temperEff && c.temperEff !== c.temper ? kcHtml` <span style="color:#6a4a9a">(fights as ${c.temperEff} — equipped item)</span>` : ''}</span>
          <span><strong>HP:</strong> ${c.hp}/${c.maxHp}</span>
          <span>📍 In ${provLinkHtml(c.locationId, (c.locationName ?? '') || 'Unknown')}</span>
          <span style="color:var(--forest)" title="1 province per phase used to move, +1 per province conquered"><strong>Move:</strong> ${effSpd} province${effSpd !== 1 ? 's' : ''}/turn</span>
          ${!c.isKing ? kcHtml`<span><strong>Pay:</strong> ${thisOrElse(c.pay, 1)}g/turn</span>` : ''}
          ${skillRow}
          ${itemsForDisplayP(c).map((iHeld) => {
            const i: AnItemTheCardShows = theItemShown(iHeld);
            return kcHtml`<div style="flex-basis:100%;width:100%;color:var(--item-ink);font-weight:600">${itemAcquiredTagP(i)}🔮 ${itemLoreTip(i, i.name)}${itemTierTagP(i)}${itemBoundTag(i, c)}${itemUsableBy(i, c) ? itemSlotTag(i, c) : ''}${i.desc ? kcHtml` <span style="color:var(--item-desc);font-weight:400">(${i.desc})</span>` : ''}</div>`;
          })}
          ${(() => {
            const maj = c.titlesHeld ?? [],
              min = c.minorHeld ?? [];
            if (!maj.length && !min.length) return '';
            const majH = maj.map((ttHeld) => {
              const tt = theTitleShown(ttHeld);
              return kcHtml`<div style="font-size:.72rem;margin-top:3px"><span style="background:#fdf3d8;border:1px solid var(--gold);border-radius:2px;padding:0 4px;font-family:'Cinzel',serif;color:#5a3f08">🏆 ${tt.name}</span> <span style="color:#231e16">${tt.perk ?? ''}</span></div>`;
            });
            const minH = min.map((ttHeld) => {
              const tt = theTitleShown(ttHeld);
              return kcHtml`<div style="font-size:.72rem;margin-top:2px"><span style="background:#eef3e6;border:1px solid #b8c9a8;border-radius:2px;padding:0 4px;color:#3a5a2a">🎖 ${tt.name}</span> <span style="color:#231e16">${tt.perk ?? ''}</span></div>`;
            });
            return kcHtml`<div style="flex-basis:100%;width:100%;margin-top:5px;border-top:1px dashed var(--parchment-dark);padding-top:4px"><div style="font-size:.64rem;color:var(--stone);text-transform:uppercase;letter-spacing:.05em">Titles &amp; perks</div>${majH}${minH}</div>`;
          })()}
          ${(() => {
            // Item: Armies Leading — the force under this character, with a summary of total
            // strength, move rate, upkeep, and which units need Druid skill to command.
            const arr = c.armies ?? [];
            const head = kcHtml`<div style="flex-basis:100%;width:100%;margin-top:5px;border-top:1px dashed var(--parchment-dark);padding-top:4px"><div style="font-size:.64rem;color:var(--stone);text-transform:uppercase;letter-spacing:.05em">Armies leading</div>`;
            if (arr.length === 0)
              return kcHtml`${head}<div style="font-size:.75rem;color:#3a3224">No armies led — moves 5 provinces/turn on its own.</div></div>`;
            const { druLevel, units, totalStr, totalCost, druidUnits, druidShort } = theArmyCardsFiguresOfAColumn(
              arr,
              c,
              report,
            );
            const lines = arr.map((a, i) => {
              const { creature, monster, req, effDru, shortfall, mastery, kingRaceMatch, leadRaceMatch, feudLed, bs } =
                theFiguresOfTheCompanyAt(units, i);
              const mast =
                mastery > 0
                  ? kcHtml` <span style="color:#1d5a1d;font-size:.66rem">+${mastery}% Druid mastery</span>`
                  : '';
              const pen =
                shortfall > 0
                  ? kcHtml` <span style="color:var(--crimson);font-size:.68rem">−${shortfall * 20}% str (Druid ${effDru}/${req})</span>`
                  : '';
              const raceBoost =
                kingRaceMatch || leadRaceMatch
                  ? kcHtml` <span style="color:#1d5a1d;font-size:.66rem">+${kingRaceMatch && leadRaceMatch ? 44 : 20}% kin</span>`
                  : '';
              const feudTag = feudLed
                ? kcHtml` <span style="color:var(--crimson);font-size:.66rem">−20% feud</span>`
                : '';
              const tag =
                creature || monster
                  ? kcHtml` <span style="color:#1d5a1d;font-size:.62rem">[${creature ? 'Creature' : 'Monster'}]</span>`
                  : '';
              return kcHtml`<div style="font-size:.75rem">${unitAbilityTip(a.type, kcHtml`${unitEmoji(a.type)} <span style="color:${(reportColour(kingdom.color) ?? '') || 'var(--ink)'}">${armyLabel(a, { noMove: true })}</span>`)} <span style="color:var(--stone);font-size:.66rem">str ${bs}${a.moveRate != null ? ` · move ${String(a.moveRate)}${a.moveKind === 'sea' ? ' (sea)' : a.moveKind === 'air' ? ' (air)' : ''}` : ''}</span>${tag}${raceBoost}${feudTag}${mast}${pen}</div>`;
            });
            const effSpd2 = c.effectiveSpeed ?? Math.min(...arr.map((a) => (a.speed ?? 0) || 3));
            const { _airNote, _seaNote } = theArmyCardsAirAndSeaNotesOfAColumn(arr, c);
            const druNote =
              druidUnits > 0
                ? kcHtml` · 🌿 ${druidUnits} unit${druidUnits !== 1 ? 's' : ''} need Druid ${druidShort > 0 ? kcHtml`<span style="color:var(--crimson)">(${druidShort} under-led — losing strength)</span>` : kcHtml`<span style="color:#1d5a1d">(${theNameToSplit(c.name).split(' ')[0]} qualifies)</span>`}`
                : '';
            const summary = kcHtml`<div style="margin-top:3px;font-size:.7rem;color:var(--stone);border-top:1px dotted var(--parchment-dark);padding-top:2px">⚔ Total strength <strong>${totalStr}</strong> <span style="font-size:.64rem">(before your discoveries, the ground, the foe and the battle's tactics)</span> · 🏃 Move <strong>${effSpd2}</strong> province${effSpd2 !== 1 ? 's' : ''}/turn · 💰 Upkeep <strong>${totalCost}g/turn</strong>${druNote}${_airNote}${_seaNote}</div>`;
            // ONE line stands for the whole army — strength, a count of each unit type, and the
            // land / flying / sea pace — with a button that unfolds the full unit list (and the
            // upkeep/druid/sea-transport notes) beneath it. The list starts folded.
            const _typeCounts: Partial<Record<string, number>> = {};
            arr.forEach((a) => {
              const k = a.type || 'unit';
              _typeCounts[k] = (_typeCounts[k] ?? 0) + 1;
            });
            const _typeLine = Object.entries(_typeCounts)
              .map(([k, n]) => `${unitEmoji(k)} ${Number(n) > 1 ? String(n) + '× ' : ''}${k}`)
              .join(', ');
            const _airSpd = c.effectiveAirSpeed ?? 0;
            const _seaSpd = c.effectiveSeaSpeed ?? 0;
            const _paceBits = [kcHtml`🏃 Land <strong>${effSpd2}</strong>`];
            if (_airSpd > 0) _paceBits.push(kcHtml`🦅 Flying <strong>${_airSpd}</strong>`);
            if (_seaSpd > 0) _paceBits.push(kcHtml`⚓ Sea <strong>${_seaSpd}</strong>`);
            // Item 24 (2026-10-12): a hero leads at most as many Creature and Monster units as his Druid level.
            const _bLed = arr.filter(countsAgainstBeastCommand).length;
            const _bNote =
              _bLed > 0
                ? kcHtml` · <span style="color:${_bLed > druLevel ? 'var(--crimson)' : '#1d5a1d'}" title="A hero may lead only as many Creature and Monster units as his Druid level">🐾 beasts ${_bLed}/${druLevel}${_bLed > druLevel ? ' — over his Druid, he takes on no more' : ''}</span>`
                : '';
            const _oneLine = kcHtml`<div style="font-size:.74rem;line-height:1.5;display:flex;align-items:flex-start;gap:6px;flex-wrap:wrap">
              <span style="flex:1;min-width:0">⚔ <strong>${arr.length}</strong> unit${arr.length !== 1 ? 's' : ''} · strength <strong>${totalStr}</strong>${druidShort > 0 ? kcHtml` <span style="color:var(--crimson);font-size:.66rem">(${druidShort} under-led)</span>` : ''}${_bNote} · ${_typeLine} · ${kcJoinP(_paceBits, ' · ')}</span>
              <button type="button" class="secall-btn" style="flex-shrink:0" aria-expanded="false" onclick="var d=this.parentNode.nextElementSibling;var open=d.style.display==='none';d.style.display=open?'block':'none';this.setAttribute('aria-expanded',open?'true':'false');this.textContent=open?'▾ hide units':'▸ show units'">&#9656; show units</button>
            </div>`;
            return kcHtml`${head}${_oneLine}<div style="display:none">${lines}${summary}</div></div>`;
          })()}
        </div>
      </div>`;
      })}`;
  theElementWithTheId('report-kingdom', HTMLElement).innerHTML = String(realmCard);

  // Provinces list your provinces alphabetically by name (a copy — never sort the report array in
  // place).
  const provs = [...(report.ownedProvinces ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const provincesCard = provs.length
    ? provs.map(
        (p) => kcHtml`<div class="prov-entry">
        <div class="prov-name">${p.name} <span style="font-size:.7rem;color:var(--stone);font-family:serif">${capitalise(p.terrain)}</span></div>
        <div class="prov-detail">
          Tax: ${p.tax}g/turn · ${formatRace(p.race)} · Explored: ${(p.explored ?? 0) || 0}%<br>
          ${
            (p.features ?? []).filter((f) => f.discovered && !f.cleared).length > 0
              ? kcHtml`Known lairs: ${kcJoinP(
                  (p.features ?? []).filter((f) => f.discovered && !f.cleared).map((f) => _lairName(f)),
                  ', ',
                )}`
              : 'No lairs discovered yet'
          }
          ${
            (p.features ?? []).filter((f) => f.cleared).length > 0
              ? kcHtml`<br>Cleared: ${kcJoinP(
                  (p.features ?? []).filter((f) => f.cleared).map((f) => _lairName(f)),
                  ', ',
                )}`
              : ''
          }
          <br>Recruitable: ${
            (p.armyTypes ?? []).length
              ? kcJoinP(
                  (p.armyTypes ?? []).map((t) => unitAbilityTip(t, `${unitEmoji(t)} ${t}`)),
                  ' · ',
                )
              : 'none'
          }
          ${(p.garrisonArmies ?? []).length ? kcHtml`<br><strong>Garrisoned (unled):</strong>${(p.garrisonArmies ?? []).map((a) => kcHtml`<br>${unitAbilityTip(a.type, kcHtml`${unitEmoji(a.type)} <span style="color:${(reportColour(kingdom.color) ?? '') || 'var(--ink)'}">${armyLabel(a)}</span>`)}`)}` : ''}
          ${(p.neutralDefenders ?? []).length ? kcHtml`<br><strong>Defenders:</strong>${(p.neutralDefenders ?? []).map((d) => kcHtml`<br>${unitAbilityTip(d.type, kcHtml`${unitEmoji(d.type)} <span style="color:#231e16">${armyLabel(d)}</span>`)}`)}` : ''}
          ${provinceGrandDesignHTML(p)}
          ${terrorNoteP(p, true)}
        </div>
      </div>`,
      )
    : kcHtml`<div style="color:#3a3224;font-size:.85rem">No provinces owned yet.</div>`;
  theElementWithTheId('report-provinces', HTMLElement).innerHTML = String(provincesCard);

  // Intel — province info + hero sightings
  const sightings = report.heroSightings ?? [];
  const knownFeatures = report.knownFeatures ?? [];
  const mercs = report.mercIntel ?? [];
  const intelHtml: APartOfACard[] = [];
  const otherForcesHtml: APartOfACard[] = []; // item: mercenary bands + wandering heroes + enemy heroes sighted → own card
  const lairsHtml: APartOfACard[] = []; // item: known lairs → own card

  // Dead heroes visible to this player — listed here in the Other Armies & Heroes card (a dead
  // character whose body-province you can see, plus any you witnessed fall this turn). They also
  // get a "(dead)" marker on the map (see renderPlayerMap).
  const visDeadHeroes = report.visibleDeadHeroes ?? [];
  if (visDeadHeroes.length > 0) {
    otherForcesHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#46275f;margin:0 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">💀 Fallen Heroes</div>`,
    );
    otherForcesHtml.push(
      visDeadHeroes.map(
        (h) => kcHtml`<div class="intel-entry" style="border-left-color:#5a3a7a;background:#f8f0ff">
      <strong>${h.name}</strong> <span style="color:#701010">(dead)</span>${h.race || h.alignment ? ` (${[h.race, h.alignment].filter(Boolean).join(', ')})` : ''} ${deadHeroRealmTagP(h, report)} when they fell — body lies in ${h.locationName} (fell turn ${h.killedOnTurn})<br>
      <span style="font-size:.78rem">${h.topSkill ? kcHtml`${skillFameLabelM(h.topSkill.level)} <span style="color:var(--gold)">${(theSkillsNames[h.topSkill.skill] ?? '') || h.topSkill.skill}</span>` : 'No notable skills'}</span><br>
      ${
        (h.servedOther !== undefined ? h.servedOther : h.player != null && !h.isOwn)
          ? kcHtml`<span style="font-size:.72rem;color:#701010">⛔ Sworn to another crown in life — Resurrect will not raise them for you. Only your own fallen and heroes who never served a rival can be brought back.</span>`
          : h.inVisibleProv
            ? kcHtml`<span style="font-size:.72rem;color:#46275f">💀 A hero with the Resurrect spell can raise them from this province.</span>`
            : kcHtml`<span style="font-size:.72rem;color:#332c20">Last known location — send a caster with the Resurrect spell to their province to raise them.</span>`
      }
    </div>`,
      ),
    );
  }

  // ── GRAVEYARDS KNOWN ────
  // Every province this realm has learned holds battlefield graves. A necromancer standing on the
  // ground senses only THAT they are there; Control Undead's province scan buys the roll of the
  // dead, and that fuller reading is shown here too. Both are stamped with the turn they were
  // learned, because neither is refreshed from a distance — the graves may since have been raised
  // or rotted away.
  // 2026-09-21: ONLY graveyards this realm knows something SPECIFIC about are listed here. A bare
  // "graves lie here, contents unknown" reading is already on the map as the ✝ marker, so printing
  // a paragraph per province for it buried the two or three readings that actually name the dead.
  // The bare sensings are untouched in `report.graveIntel` (and so on the map) — they are simply
  // not repeated in this section.
  const graveIntel = (report.graveIntel ?? []).filter((g): g is AGraveReadingAsTheListReadsIt =>
    Boolean(g?.detail && g.detail.length > 0),
  );
  if (graveIntel.length > 0) {
    otherForcesHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#2e2e2e;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">💀 Graveyards Known</div>`,
    );
    otherForcesHtml.push(
      graveIntel.map((g) => {
        // a PARTIAL reading (the Deathpriest's Grave-sight) names only the crack and elite dead — say
        // "at least", because lesser ranks may lie beside them unseen.
        const det = g.detail?.length
          ? kcHtml`<span style="color:#46275f">The dead:</span> ${g.detailPartial ? 'at least ' : ''}${g.detail.map((d) => `${String(d.n)}× ${d.k}`).join(', ')}${g.detailPartial ? kcHtml` <span style="color:#332c20">— Grave-sight names only the crack and elite; lesser dead may lie here unseen.</span>` : ''}${g.detailTurn && g.detailTurn !== g.turn ? kcHtml` <span style="color:#3a3224">(read turn ${g.detailTurn})</span>` : ''}`
          : kcHtml`<span style="color:#2f281c">Graves lie here — how many, and what they hold, is unknown.</span>`;
        return kcHtml`<div class="intel-entry" style="border-left-color:#4a4a4a;background:#f6f6f4">
        <strong>${g.name}</strong> <span style="color:#332c20;font-size:.78rem">(seen on turn ${g.turn ?? '?'})</span><br>
        <span style="font-size:.78rem">${det}</span><br>
        <span style="font-size:.72rem;color:#332c20">Older knowledge — these graves may since have been raised or rotted away.</span>
      </div>`;
      }),
    );
  }

  // Mercenary bands visible in accessible provinces → Other Armies & Heroes card
  if (mercs.length > 0) {
    otherForcesHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#701010;margin:0 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Mercenary Bands</div>`,
    );
    otherForcesHtml.push(
      mercs.map(
        (m) => kcHtml`<div class="intel-entry" style="border-left-color:#8a1c1c;background:#fff8f8">
      <strong>${(m.unitName ?? '') || m.type}</strong> (${m.quality} ${m.type}) — ${m.location}<br>
      <span style="font-size:.72rem;color:#6a3030">Available for hire — use Recruit Armies in ${m.location}.</span>
    </div>`,
      ),
    );
  }
  if (sightings.length > 0) {
    const wanderers = sightings.filter((s) => s.type === 'wandering');
    const chieftains = sightings.filter((s) => s.type === 'neutral_guard'); // neutral province defenders
    const enemies = sightings.filter((s) => s.type === 'enemy');
    if (wanderers.length > 0) {
      otherForcesHtml.push(
        kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:var(--gold);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Wandering Heroes</div>`,
      );
      otherForcesHtml.push(
        wanderers.map((s) => {
          const topStr = s.topSkill
            ? kcHtml`<span style="color:var(--gold)">${(theSkillsNames[s.topSkill.skill] ?? '') || s.topSkill.skill}</span>`
            : 'no known skills';
          const spied = s.spiedSkills;
          const skillLine =
            spied && Object.keys(spied).some((k) => Number(spied[k]) > 0)
              ? kcHtml`<span style="color:#1d5a1d">🔍 Skills (spied turn ${s.spiedTurn}):</span> ${Object.entries(spied)
                  .filter(aSpiedLevelAboveNothing)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => `${(theSkillsNames[k] ?? '') || k} ${String(v)}`)
                  .join(', ')}`
              : s.topSkill
                ? kcHtml`${skillFameLabelM(s.topSkill.level)} ${topStr}`
                : 'No known skills';
          return kcHtml`<div class="intel-entry" style="border-left-color:#c8922a">
          ⚔ <strong>${s.name}</strong> (${s.race}, ${s.alignment}) — ${s.locationName}<br>
          <span style="font-size:.78rem">${skillLine}${spiedExtraP(s)}${s.armyBand ? kcHtml` · <span style="color:#2f281c">${s.armyBand}</span>` : ''} · ${s.pay != null ? kcHtml`Hire for <strong>${s.pay}g/turn</strong>` : kcHtml`<span style="color:#a33">Will not serve your crown (alignment gulf)</span>`}${s.inOwnedProvince ? kcHtml` · <span style="color:#8fbc5a">In your province</span>` : ''}</span>
        </div>`;
        }),
      );
    }
    if (chieftains.length > 0) {
      otherForcesHtml.push(
        kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#8a6a2a;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Local Chieftains</div>`,
      );
      otherForcesHtml.push(
        chieftains.map((s) => {
          const topStr = s.topSkill
            ? kcHtml`<span style="color:var(--gold)">${(theSkillsNames[s.topSkill.skill] ?? '') || s.topSkill.skill}</span>`
            : 'no known skills';
          const spied = s.spiedSkills;
          const skillLine =
            spied && Object.keys(spied).some((k) => Number(spied[k]) > 0)
              ? kcHtml`<span style="color:#1d5a1d">🔍 Skills (spied turn ${s.spiedTurn}):</span> ${Object.entries(spied)
                  .filter(aSpiedLevelAboveNothing)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => `${(theSkillsNames[k] ?? '') || k} ${String(v)}`)
                  .join(', ')}`
              : s.topSkill
                ? kcHtml`${skillFameLabelM(s.topSkill.level)} ${topStr}`
                : 'No known skills';
          return kcHtml`<div class="intel-entry" style="border-left-color:#8a6a2a">
          🛡 <strong style="color:${CHIEFTAIN_MARKER_COLOR}">${s.name}</strong> (local chieftain — ${s.race}, ${s.alignment}) — ${s.locationName}<br>
          <span style="font-size:.78rem">${skillLine}${spiedExtraP(s)}${s.armyBand ? kcHtml` · <span style="color:#2f281c">${s.armyBand}</span>` : ''}${s.inOwnedProvince ? kcHtml` · <span style="color:#8fbc5a">In your province</span>` : ''}</span>
        </div>`;
        }),
      );
    }
    if (enemies.length > 0) {
      otherForcesHtml.push(
        kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#7a1c1c;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Enemy Heroes</div>`,
      );
      otherForcesHtml.push(
        enemies.map((s) => {
          const topStr = s.topSkill
            ? kcHtml`<span style="color:var(--gold)">${(theSkillsNames[s.topSkill.skill] ?? '') || s.topSkill.skill}</span>`
            : 'no known skills';
          const spied = s.spiedSkills;
          const skillLine =
            spied && Object.keys(spied).some((k) => Number(spied[k]) > 0)
              ? kcHtml`<span style="color:#1d5a1d">🔍 Skills (spied turn ${s.spiedTurn}):</span> ${Object.entries(spied)
                  .filter(aSpiedLevelAboveNothing)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => `${(theSkillsNames[k] ?? '') || k} ${String(v)}`)
                  .join(', ')}`
              : s.topSkill
                ? kcHtml`${skillFameLabelM(s.topSkill.level)} ${topStr}`
                : 'No known skills';
          return kcHtml`<div class="intel-entry" style="border-left-color:#7a1c1c">
          👁 <strong>${s.name}</strong> of ${s.kingdom}${s.race || s.alignment ? ` (${[s.race, s.alignment].filter(Boolean).join(', ')})` : ''} — ${s.locationName}<br>
          <span style="font-size:.78rem">${skillLine}${spiedExtraP(s)}${s.armyBand ? kcHtml` · <span style="color:#2f281c">${s.armyBand}</span>` : ''}${s.inOwnedProvince ? kcHtml` · <span style="color:#e05050">In your territory</span>` : ''}</span>
        </div>`;
        }),
      );
    }
  }

  // Province reports: ONLY unusual or uncommon events that struck provinces you control or could
  // see this turn — earthquakes, blessings, plagues, part-seas, floods, consecrations and the like.
  // Events are grouped by province and ordered by the phase they happened in.
  const provinceEvents = report.provinceEvents ?? [];
  if (provinceEvents.length > 0) {
    intelHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:var(--stone);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Province Reports</div>`,
    );
    const SEASONS_E = KC_SEASONS.slice();
    const _evByProv = new Map<string, AProvincesEventAsTheListReadsIt[]>();
    provinceEvents.forEach((ev) => {
      const key = (ev.provName ?? '') || 'Unknown province';
      const here = _evByProv.get(key) ?? [];
      _evByProv.set(key, here);
      here.push(ev);
    });
    [..._evByProv.keys()]
      .sort((a, b) => a.localeCompare(b))
      .forEach((prov) => {
        const evs = theGroupFiled(_evByProv.get(prov), 'slice')
          .slice()
          .sort((a, b) => (a.phase ?? 99) - (b.phase ?? 99));
        const rows = evs.map((ev) => {
          const phLbl = ev.phase != null && ev.phase >= 0 && ev.phase <= 4 ? SEASONS_E[ev.phase] : null;
          return kcHtml`<div style="padding:1px 0;font-size:.76rem">${phLbl ? kcHtml`<span style="color:var(--stone);font-size:.66rem">${phLbl}: </span>` : ''}${ev.text}</div>`;
        });
        intelHtml.push(kcHtml`<div class="intel-entry" style="border-left-color:#7a4fa0">
        <strong style="font-family:'Cinzel',serif;font-size:.76rem">${prov}</strong>
        ${rows}
      </div>`);
      });
  }

  // ── Spied Provinces — every province you SPIED this turn, and the characters standing there at
  // END of turn (even if your agent has since moved on). Only non-your characters shown.
  const spiedProvIntel = (report.provinceCharIntel ?? []).filter((p) => p.spied);
  if (spiedProvIntel.length > 0) {
    intelHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#1d5a1d;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">🔍 Spied Provinces</div>`,
    );
    spiedProvIntel.forEach((pc) => {
      const others = (pc.characters ?? []).filter((ch) => ch.category !== 'own');
      const roster =
        others.length > 0
          ? others.map((ch) => {
              const who =
                ch.category === 'enemy'
                  ? kcHtml`<strong${ch.color ? kcHtml` style="color:${reportColour(ch.color)}"` : ''}>${ch.name}</strong>${ch.isKing ? ' 👑' : ''} of ${(ch.kingdom ?? '') || 'an enemy realm'}`
                  : kcHtml`<strong${ch.isNeutralGuard ? kcHtml` style="color:${CHIEFTAIN_MARKER_COLOR}"` : ''}>${ch.name}</strong>${ch.isNeutralGuard ? ' (local chieftain)' : ' (wandering)'}`;
              const force =
                ch.armies && ch.armies.length > 0
                  ? ` — ${ch.armies.map((a) => armyLabel(a, { short: true })).join(', ')}`
                  : ch.armyBand
                    ? ch.armyBand === 'no armies'
                      ? ''
                      : ` — leads ${ch.armyBand}`
                    : ch.armyCount !== undefined && ch.armyCount > 0
                      ? ` — leads ${String(ch.armyCount)} unit${ch.armyCount !== 1 ? 's' : ''}`
                      : '';
              const spied = ch.spiedSkills;
              const sk =
                spied && Object.keys(spied).some((k) => Number(spied[k]) > 0)
                  ? kcHtml`<br><span style="font-size:.72rem;color:#1d5a1d">🔍 Skills:</span> ${Object.entries(spied)
                      .filter(aSpiedLevelAboveNothing)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => `${(theSkillsNames[k] ?? '') || k} ${String(v)}`)
                      .join(', ')}`
                  : '';
              return kcHtml`<div style="padding:1px 0;font-size:.78rem">${who}${force}${sk}</div>`;
            })
          : kcHtml`<div style="padding:1px 0;font-size:.76rem;color:#2f281c">No other characters present at turn's end.</div>`;
      intelHtml.push(kcHtml`<div class="intel-entry" style="border-left-color:#2d7a2d;background:#f2faf2">
        <strong style="font-family:'Cinzel',serif;font-size:.76rem">${pc.provName}</strong>
        ${roster}
      </div>`);
    });
  }

  // ── Spy Activity Reports — what other realms' characters DID in a province you spied, in the
  // phases after your agent arrived (the spy's lingering line of sight).
  const spyActivity = report.spyActivity ?? [];
  if (spyActivity.length > 0) {
    const SEASONS_SA = KC_SEASONS.slice();
    intelHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:#2d6a7a;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">🔍 Spy Activity Reports</div>`,
    );
    spyActivity.forEach((sa) => {
      const rows = (sa.lines ?? []).map((l) => {
        const phLbl = l.phase != null && l.phase >= 0 && l.phase <= 4 ? SEASONS_SA[l.phase] : null;
        return kcHtml`<div style="padding:1px 0;font-size:.76rem">${phLbl ? kcHtml`<span style="color:var(--stone);font-size:.66rem">${phLbl}: </span>` : ''}${l.text}</div>`;
      });
      intelHtml.push(kcHtml`<div class="intel-entry" style="border-left-color:#2d6a7a;background:#f2f8fa">
        <strong style="font-family:'Cinzel',serif;font-size:.76rem">${sa.provName}</strong>
        <div style="font-size:.68rem;color:#2f281c;margin-bottom:2px">Watched by your agent from ${(theSeasonOf(SEASONS_SA, sa.sincePhase) ?? '') || 'later that turn'} onward:</div>
        ${rows}
      </div>`);
    });
  }

  // (Removed) The "Turn Intelligence — by Phase" block duplicated the earlier Intelligence Reports
  // section, so it no longer renders here.

  // Known features
  if (knownFeatures.length > 0) {
    lairsHtml.push(
      kcHtml`<div style="font-family:'Cinzel',serif;font-size:.72rem;color:var(--forest);margin:10px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Known Lairs</div>`,
    );
    lairsHtml.push(kcHtml`<div style="font-size:.73rem;color:var(--stone);margin-bottom:6px;line-height:1.8">
      Guardian difficulty: 
      <span style="background:#4a8a4a;color:#fff;padding:1px 5px;border-radius:2px;font-size:.65rem">🐾 Weak</span> can be handled by a lone hero ·
      <span style="background:#c8922a;color:#fff;padding:1px 5px;border-radius:2px;font-size:.65rem">⚔ Moderate</span> needs skill or good tactics ·
      <span style="background:#8a1c1c;color:#fff;padding:1px 5px;border-radius:2px;font-size:.65rem">💀 Powerful</span> very dangerous, prepare carefully ·
      <span style="background:#5a0a9a;color:#fff;padding:1px 5px;border-radius:2px;font-size:.65rem">🔥 Legendary</span> near-impossible alone
    </div>`);
    const POWER_COLORS: Readonly<Partial<Record<string, string>>> = { ...GUARD_POWER_COLORS_P };
    const POWER_ICONS: Readonly<Partial<Record<string, string>>> = {
      Weak: '🐾',
      Moderate: '⚔',
      Powerful: '💀',
      Legendary: '🔥',
    };
    // Group features by the province they sit in, so a player can see at a glance which province
    // holds which feature. Provinces are listed alphabetically; each feature drops the redundant
    // inline province name now that it lives under a province heading. 2026-09-12: once your realm
    // has learned a guardian's weakness — by scouting it in an encounter, or by watching it bite —
    // it is yours for the rest of the game, and shows against every lair holding that kind of
    // creature. Keyed by guardian name, exactly as the engine records it.
    const _knownWeak = report.knownGuardianWeaknesses ?? {};
    const featureCard = (f: ALairKnownAsTheCardReadsIt) => {
      const pColor = (POWER_COLORS[String(f.monsterPower)] ?? '') || '#7a5510';
      const pIcon = (POWER_ICONS[String(f.monsterPower)] ?? '') || '?';
      const weakness = _knownWeak[String(f.monster)];
      const powerBadge =
        f.monsterPower && !f.cleared
          ? kcHtml`<span style="background:${pColor};color:#fff;font-size:.65rem;padding:1px 5px;border-radius:2px;margin-left:4px">${pIcon} ${f.monsterPower}</span>`
          : '';
      // Ritual sites have no guardian — they are sacred ground usable only by a Pagan realm's
      // Perform Rite. Show that instead of an empty "Guardian:" line.
      if (f.ritualSite) {
        return kcHtml`<div class="intel-entry" style="border-left-color:#5a0a9a">
          🌙 <strong>${f.name}</strong>
          <br><span style="font-size:.78rem;color:#5a0a9a">A sacred site of the old faith — only a Pagan realm may Perform Rites here.</span>
        </div>`;
      }
      return kcHtml`<div class="intel-entry" style="border-left-color:${f.cleared ? '#888' : f.isOwned ? '#2d7a2d' : '#c8922a'}">
        ${f.cleared ? '✓' : '⭐'} <strong${f.cleared ? '' : kcHtml` style="color:${pColor}"`}>${f.name}</strong>${powerBadge}
        ${f.cleared ? kcHtml`<span style="color:#332c20">(cleared — no guardian)</span>` : kcHtml`<br><span style="font-size:.78rem;color:${pColor}">Guardian: ${f.monster}${f.monsterCat ? kcHtml` <span style="opacity:.8">(${f.monsterCat.toLowerCase()})</span>` : ''}</span>${!f.cleared && weakness ? kcHtml`<br><span style="font-size:.76rem;color:#7a1c7a">\u{1F4A5} Weakness known \u2014 <strong>${weakness.name}</strong>: ${weakness.desc}.</span>` : ''}${_rumourLine(f)}`}
      </div>`;
    };
    // what Hunting Rumours learned of the hoard, remembered on the realm and shipped as `f.rumour`
    // ({turn, gold, items, stolen, wields}). The ODDS are never shown here \u2014 they belonged to
    // one hero on one day. Stamped with the turn, because a thief may have been through since.
    const _rumourLine = (f: ALairKnownAsTheCardReadsIt) => {
      const r = f.rumour;
      if (!r || f.cleared) return '';
      const items = (r.items ?? []).length
        ? `, and ${(r.items ?? []).join(', ')}`
        : (r.stolen ?? []).length
          ? ` \u2014 its magic (${(r.stolen ?? []).join(', ')}) was already lifted by a thief`
          : ' \u2014 no magic lies there';
      const wield = (r.wields ?? []).length
        ? kcHtml` <span style="color:#701010">It wields ${(r.wields ?? []).join(', ')} against all comers.</span>`
        : '';
      return kcHtml`<br><span style="font-size:.76rem;color:#6b5a2a">\u{1F4B0} Hoard known (turn ${r.turn}) \u2014 exactly <strong>${r.gold}g</strong>${items}.${wield}</span>`;
    };
    const featuresByProvince: Partial<Record<string, ALairKnownAsTheCardReadsIt[]>> = {};
    knownFeatures.forEach((f) => {
      const key = (f.province ?? '') || 'Unknown province';
      const here = featuresByProvince[key] ?? [];
      featuresByProvince[key] = here;
      here.push(f);
    });
    lairsHtml.push(
      Object.keys(featuresByProvince)
        .sort((a, b) => a.localeCompare(b))
        .map((prov) => {
          const feats = theGroupFiled(featuresByProvince[prov], 'map');
          const cards = feats.map(featureCard);
          // 2026-09-24 (Toby item 4): province headings bold and in a darker ink than the gold they wore.
          return kcHtml`<div style="font-family:'Cinzel',serif;font-size:.76rem;color:#3a2a10;font-weight:700;margin:8px 0 2px;letter-spacing:.03em">📍 ${prov} <span style="color:var(--stone);font-weight:normal;font-size:.68rem">(${feats.length} lair${feats.length !== 1 ? 's' : ''})</span></div>${cards}`;
        }),
    );
  }

  {
    const _ri = document.getElementById('report-intel');
    if (_ri) {
      const _sec = document.getElementById('intel-reports-section');
      const _other = _sec ? _sec.querySelectorAll('.log-entry').length : 0;
      _ri.innerHTML = String(
        intelHtml.length
          ? kcHtml`${intelHtml}`
          : _other
            ? ''
            : kcHtml`<em style="color:#3a3224;font-size:.85rem">No intelligence gathered yet. Visit or spy provinces to learn more.</em>`,
      );
    }
  }
  const _ofEl = document.getElementById('report-other-forces');
  if (_ofEl)
    _ofEl.innerHTML = String(
      otherForcesHtml.length
        ? kcHtml`${otherForcesHtml}`
        : kcHtml`<em style="color:#3a3224;font-size:.85rem">No mercenary bands or loose heroes sighted yet.</em>`,
    );
  const _lrEl = document.getElementById('report-lairs');
  if (_lrEl)
    _lrEl.innerHTML = String(
      lairsHtml.length
        ? kcHtml`${lairsHtml}`
        : kcHtml`<em style="color:#3a3224;font-size:.85rem">No lairs discovered yet. Explore or scout provinces to find them.</em>`,
    );

  // ── Sage Discoveries ──
  const discoveries = report.discoveries ?? [];
  const discEl = document.getElementById('report-discoveries');
  if (discEl) {
    if (discoveries.length === 0) {
      discEl.innerHTML = String(
        kcHtml`<em style="color:#3a3224;font-size:.85rem">No discoveries yet. Give Research orders to your scholars (Sage 1+).</em>`,
      );
    } else {
      // Group by category
      const catMap: Partial<Record<string, ADiscoveryAsTheCardReadsIt[]>> = {};
      discoveries.forEach((dHeld) => {
        const d = theDiscoveryFiled(dHeld);
        const here = catMap[String(d.category)] ?? [];
        catMap[String(d.category)] = here;
        here.push(d);
      });
      const catColors: Readonly<Partial<Record<string, string>>> = {
        Military: '#7a1c1c',
        Economy: '#2d7a2d',
        Espionage: '#1a4a6e',
        Scholarship: '#6a3a9a',
        Heroic: '#8a6a1a',
        Special: '#3a7a6a',
      };
      discEl.innerHTML = String(
        Object.entries(catMap).map(
          ([cat, discs]) => kcHtml`
        <div style="margin-bottom:12px">
          <div style="font-family:Cinzel,serif;font-size:.72rem;color:${(catColors[cat] ?? '') || '#555'};text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">
            ${cat}
          </div>
          ${theGroupFiled(discs, 'map').map(
            (d) => kcHtml`<div class="intel-entry" style="border-left-color:${(catColors[cat] ?? '') || '#555'}">
            <strong>${d.name}</strong> <span style="color:#3a3224;font-size:.72rem">(Turn ${d.turnDiscovered})</span><br>
            <span style="font-size:.8rem">${d.desc}</span>
          </div>`,
          )}
        </div>`,
        ),
      );
    }
  }

  renderDiplomacy(report);
  renderTitles(report);
  renderMastery(report);
  initReportCollapsers();
  renderPlayerMap(report);
  // guarantee the map paints fresh whenever a player opens their game to view the current turn.
  // openReport already fetches the latest turn_report from Supabase and renders once above, but
  // that first render can run before the just-shown report section has finished its layout, leaving
  // a blank/mis-sized map until the player interacts. Re-render after layout settles (double rAF)
  // so the current-turn map always appears immediately on click. Falls back to a timeout if rAF is
  // absent.
  const _repaintMap = () => {
    try {
      renderPlayerMap(report);
    } catch {
      // a repaint that fails leaves the map as it was drawn
    }
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(_repaintMap));
  } else {
    setTimeout(_repaintMap, 0);
  }
  try {
    ensureProvinceLinking();
  } catch {
    // every province name in the report becomes a map link
  }
}
export function setDiploChoice(idx: number | string, val: unknown) {
  if (val == null || val === 'null') Reflect.deleteProperty(theDiplomaticChoicesHeld(), idx);
  else theDiplomaticChoicesHeld()[idx] = val;
  if (currentReport) renderDiplomacy(currentReport);
}

// ── COLLAPSIBLE SECTIONS ────
// Minimise/maximise the report-column cards and the per-hero order blocks so a player can navigate
// without scrolling. Purely presentational — no engine/data effect.
export function _setSecCollapsed(sec: Element, collapse: boolean) {
  sec.classList.toggle('sec-collapsed', collapse);
  const b = sec.querySelector('.sec-toggle, .cc-toggle');
  if (b) {
    b.innerHTML = collapse ? '&#9656;' : '&#9662;';
    b.setAttribute('aria-expanded', collapse ? 'false' : 'true');
  }
}
// 2026-09-23d (Toby item 1): a battle in the Chronicle shows its SHORT account by default; the side
// button swaps it for the full report (and back). The two views sit side by side in one .battle-fold.
export function toggleBattleFold(btn: Element | null | undefined) {
  const box = btn?.closest('.battle-fold');
  if (!box) return;
  const full = box.querySelector('.bf-full'),
    short = box.querySelector('.bf-short');
  if (!full || !short) return;
  const open = theInlineStyleOf(full).display === 'none';
  theInlineStyleOf(full).display = open ? 'block' : 'none';
  theInlineStyleOf(short).display = open ? 'none' : 'block';
  box.querySelectorAll('.bf-toggle').forEach((b) => {
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}
export function toggleSection(btn: Element) {
  const sec = btn.closest('.card, .orders-char-block, .char-chronicle');
  if (!sec) return;
  _setSecCollapsed(sec, !sec.classList.contains('sec-collapsed'));
}
export function collapseAllSections(scopeSel: string, collapse: boolean) {
  const scope = document.querySelector(scopeSel);
  if (!scope) return;
  scope.querySelectorAll('.card, .orders-char-block, .char-chronicle').forEach((sec) => {
    if (sec.id === 'orders-card') return; // the orders card wraps the per-hero blocks — collapse those, not it
    _setSecCollapsed(sec, collapse);
  });
}
// fold/unfold every Chronicle character & event block (scoped to the Chronicle log).
export function collapseAllChronicle(collapse: boolean) {
  document.querySelectorAll('#report-log .char-chronicle').forEach((sec) => {
    _setSecCollapsed(sec, collapse);
  });
}
// The report-column cards are static markup, so inject a toggle into each card's <h2> once.
export function initReportCollapsers() {
  const col = document.getElementById('rp-report-col');
  if (!col) return;
  col.querySelectorAll('.card').forEach((card) => {
    const h = card.querySelector('h2');
    if (!h || h.querySelector('.sec-toggle')) return;
    const b = document.createElement('button');
    b.className = 'sec-toggle';
    b.type = 'button';
    b.innerHTML = '&#9662;';
    b.setAttribute('aria-expanded', 'true');
    b.title = 'Minimise / maximise this section';
    b.addEventListener('click', () => {
      toggleSection(b);
    });
    h.appendChild(b);
  });
}

// Manual refresh from the new-turn banner. Re-opens the current report (fetches the fresh
// turn_report); the player triggered it, so replacing the current view is expected. Any draft they
// had already saved is reloaded from the server by openReport; a draft only typed but not saved is
// theirs to re-enter.
export function refreshOpenReport() {
  const b = document.getElementById('new-turn-banner');
  if (b) b.style.display = 'none';
  if (currentGamePlayerId) void openReport(currentGamePlayerId);
} // end buildChronicle

export async function loadPastReport(gameId: string, playerIndex: number, turn: number) {
  viewedTurn = turn;
  refreshTurnNavHighlight();
  const banner = theElementWithTheId('prev-report-banner', HTMLElement);
  banner.style.display = 'block';
  const pi = playerIndex;

  // Strictly hide orders and submit sections — past-turn views must never affect orders.
  theElementWithTheId('orders-card', HTMLElement).style.display = 'none';
  refreshOrdersVisibility(false); // past turn — orders unavailable (desk-safe)
  const sw = document.getElementById('orders-submit-wrap');
  if (sw) sw.style.display = 'none';
  theElementWithTheId('orders-msg', HTMLElement).innerHTML = '';
  theElementWithTheId('save-msg', HTMLElement).style.display = 'none';

  // 1. Try to load this player's full snapshot for the turn (gives the correct historical MAP).
  let snapshot: unknown = null;
  try {
    const { data: snapRows } = await thePagesDb.theChroniclesLogs.theLogOfThisRealmInThisTurn(gameId, turn, pi);
    const e = snapRows?.[0]?.entries;
    if (e) {
      snapshot = typeof e === 'string' ? theStateParsed(e) : e;
    }
  } catch {
    snapshot = null;
  }

  banner.innerHTML = String(
    kcHtml`Viewing Turn ${snapshotTurnLabel(turn)}${turn === 0 ? ' (founding)' : ''} — read only. <button onclick="returnToCurrentReport()" style="margin-left:8px;font-size:.72rem;padding:2px 7px;border:1px solid #c8922a;background:transparent;color:#5a3f08;cursor:pointer;border-radius:2px">← Current Turn</button>`,
  );

  if (snapshot) {
    // Whole report body straight from the snapshot — map, chronicle, AND every other section revert
    // to this turn. (Order forms stay hidden; renderReportView only paints the read-only view.) A snapshot that is no
    // object (no turn writes one) is shown as an empty one: each of its parts was missing as it is.
    const shown = isATurnReport(snapshot) ? snapshot : {};
    viewingReport = shown;
    renderReportView(shown);
    return;
  }

  // 2. Fallback for games/turns saved before per-turn snapshots existed:
  // rebuild the chronicle from the GM full log and keep the current map (noted in the banner).
  const { data: logs } = await thePagesDb.theChroniclesLogs.theLogOfThisRealmInThisTurn(gameId, turn, -1);
  const { data: g } = await thePagesDb.thePlayersGames.thisGameEveryColumn(gameId);
  const gameState = thisOrElse(g?.game_state, {});
  const allChars = theListToSearch(thisOrElse(theField(gameState, 'characters'), []));
  const ownCharIds: ReadonlySet<unknown> = new Set(theRealmsHeroesIn(allChars, pi).map((c) => c.id));

  const entries = theListToSearch(thisOrElse(logs?.[0]?.entries, []))
    .filter((e): e is ALineOfTheGmsLog => {
      if (e === null || e === undefined)
        throw new TypeError(`Cannot read properties of ${String(e)} (reading 'targets')`);
      if (!isALineOfTheGmsLog(e)) return false; // a line that is no object names no realm and no hero
      if (theTargetsHold(thisOrElse(e.targets, []), pi)) return true;
      if (e.actor === pi) return true;
      if (e.charId != null && ownCharIds.has(e.charId)) return true;
      const charIds = e.charIds;
      if (isAList(charIds) && charIds.some((id) => ownCharIds.has(id))) return true;
      return false;
    })
    .map((e) => {
      // Route to one of THIS player's characters via charId, or via charIds (a duel/battle names
      // both).
      const charIds = e.charIds;
      const cid =
        e.charId != null && ownCharIds.has(e.charId)
          ? e.charId
          : isAList(charIds)
            ? (charIds.find((id) => ownCharIds.has(id)) ?? null)
            : null;
      return { type: e.type, text: e.text, charId: cid, phase: e.phase ?? null };
    });

  if (entries.length > 0) {
    buildChronicle(entries, theRealmsHeroesIn(allChars, pi));
  } else if (turn === 0) {
    theElementWithTheId('report-log', HTMLElement).innerHTML = String(
      kcHtml`<div class="log-entry system">Your realm is founded. The realm awaits your first commands.</div>`,
    );
  }
  banner.innerHTML = String(
    kcHtml`Viewing Turn ${snapshotTurnLabel(turn)} — read only. <span style="opacity:.8">(map history isn't available for this turn — showing the current map)</span> <button onclick="returnToCurrentReport()" style="margin-left:8px;font-size:.72rem;padding:2px 7px;border:1px solid #c8922a;background:transparent;color:#5a3f08;cursor:pointer;border-radius:2px">← Current Turn</button>`,
  );
}

export function returnToCurrentReport() {
  viewedTurn = null;
  refreshTurnNavHighlight();
  theElementWithTheId('prev-report-banner', HTMLElement).style.display = 'none';
  theElementWithTheId('orders-card', HTMLElement).style.display = 'block';
  refreshOrdersVisibility(true); // back on the live turn — orders available (desk tab governs display)
  // Restore the correct submit wrap based on the TRUE submitted state (not on whatever DOM happens
  // to be there). If the live turn is not submitted, ensure a live Submit button — this clears any
  // stale "success / ↺ Resubmit" block from an earlier submission. If it IS submitted, leave the
  // existing submitted/resubmit control in place.
  const submitWrap = document.getElementById('orders-submit-wrap');
  const _submitted = !!currentGamePlayer?.orders_submitted;
  if (submitWrap && !_submitted && !submitWrap.querySelector('#submit-btn')) {
    restoreSubmitWrap('Submit');
  }
  if (submitWrap) submitWrap.style.display = 'flex';
  // Restore the WHOLE current-turn body. loadPastReport paints every read-only section (realm,
  // provinces, intel, discoveries, diplomacy, titles, mastery, map AND chronicle) from the
  // past-turn snapshot, so returning must repaint every one of them from the current report — not
  // just the map and chronicle. Repainting only those two left the other sections frozen on the
  // turn just viewed, which read as a report "muddled" with a previous one until the browser was
  // reloaded.
  viewingReport = currentReport;
  if (currentReport) {
    renderReportView(currentReport);
  }
}
