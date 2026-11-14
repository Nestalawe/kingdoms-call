import { KC_HEX_DIRS, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import {
  aColumnIsTurnedBackAtANeutralRealmsBorder,
  aColumnLeadingShipsMayNotStepFromLandToLand,
  aMercenaryBandIsNotHiredIntoAFullColumn,
  aProvinceIsSafePassageForARealmsColumn,
  canEnterTerrain,
  normaliseAction,
  seaLiftOfAColumn,
  takesHalfAHullAboard,
  theAlignmentOrdersByTheNameTheFormWrites,
  theCompaniesALeaderTakesUpToHisBeastCommandsRoom,
  theFirstStepOfAShortestRouteAColumnMayTake,
  theGarrisonPlacesAPickUpTakes,
  theHeroesWhoMustActFirstInAPhase,
  theHexNextToAProvinceInADirection,
  theItemsASendItemOrderHandsOver,
  theMovePoolAStepSpends,
  theOrderTheHeroesActInAPhase,
  theRisenDeadFollowAHandOverTo,
  theRoomALeadersBeastCommandLeaves,
  theStepAColumnTakesTowardAFarProvince,
  whatAMarchsOrderNames,
  whereAHandOversRisenDeadGo,
  whereARecruitedCompanyMusters,
  doesAnAlignmentDeclareWarWithoutWarning,
  theCompaniesABloodOfferingGivesAndRaises,
  itemSlot,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';

// The order form's forecasts (plan P1-11e3): where a hero will stand, what he will carry and what he will lead, and what a
// province's garrison will hold, after the orders the form holds for the phases before. Since P1-11e41 they read only
// what they are handed: the report, and the orders the form holds (`orders`, the page's snapshot of its fields as a
// forecast is asked: the-orders-the-form-holds-handed-to-its-forecasts.ts). They read no field of the page.

/** A company as the report shows it and the forecasts carry it: its type, quality, name and race, the marks the turn's
 *  rules read, and the forecasts' own marks (a band hired, a company an earlier order makes). */
export interface ACompanyAsTheFormCarriesIt {
  readonly type: string;
  readonly quality?: string | undefined;
  readonly unitName?: string | undefined;
  readonly race?: string | null | undefined;
  readonly skeletal?: boolean | undefined;
  readonly temporary?: boolean | undefined;
  readonly wildHunt?: boolean | undefined;
  readonly wildHuntUntil?: unknown;
  readonly _merc?: boolean | undefined;
  readonly _projected?: boolean | undefined;
}
/** A hero's levels by skill as the report gives them. */
export type TheLevelsBySkill = Readonly<Partial<Record<string, number>>>;
/** A hero's effective levels by skill as the report gives them (skillEff): the total, and the items' bonus and the
 *  aura it counts. */
export type TheEffectiveLevelsBySkill = Readonly<
  Partial<
    Record<
      string,
      { readonly total?: unknown; readonly items?: number | undefined; readonly aura?: number | undefined }
    >
  >
>;
/** A hero as the skill readers read him: his levels and his effective levels. */
export interface AHerosSkillsAsTheFormReadsThem {
  readonly skills?: TheLevelsBySkill | null | undefined;
  readonly skillEff?: TheEffectiveLevelsBySkill | null | undefined;
}
/** An item a hero carries, as the Send Item order names it and the order form's item fields read it (the rules' item: a
 *  report's item always has its name), or none. */
export type AnItemAHeroCarries =
  | (NonNullable<Parameters<typeof theItemsASendItemOrderHandsOver>[0][number]> &
      NonNullable<Parameters<typeof itemSlot>[0]> & {
        readonly equipped?: boolean | undefined;
        readonly desc?: string | undefined;
        readonly _spent?: unknown;
        readonly effect?:
          { readonly stat?: string | undefined; readonly spell?: string | undefined } | null | undefined;
      })
  | null
  | undefined;
/** A hero as the forecasts read him from the report (a pre-order card's id is words: 'hired_77_via_1_ph0'). */
export interface AHeroAsTheFormsForecastsReadHim extends AHerosSkillsAsTheFormReadsThem {
  readonly id: number | string;
  readonly name?: string | undefined;
  readonly alive?: boolean | undefined;
  readonly alignment?: string | null | undefined;
  readonly hiredInPhase?: number | null | undefined;
  readonly effectiveSpeed?: unknown;
  readonly effectiveSeaSpeed?: unknown;
  readonly locationId?: number | null | undefined;
  readonly locationName?: string | undefined;
  readonly armies?: readonly ACompanyAsTheFormCarriesIt[] | null | undefined;
  readonly items?: readonly AnItemAHeroCarries[] | null | undefined;
}
/** A province of the report's map as the march forecast reads it: its place, ground and owner, and the heroes seen
 *  there. */
interface AProvinceOfTheReportsMap {
  readonly id: number;
  readonly row: number;
  readonly col: number;
  readonly terrain: string;
  readonly name?: string | undefined;
  readonly owner?: number | null | undefined;
  readonly characters?:
    | readonly ({
        readonly isWanderer?: unknown;
        readonly isNeutralGuard?: unknown;
        readonly armyBand?: unknown;
      } | null)[]
    | null
    | undefined;
}
/** A realm the report knows, and its relation with the reader's. */
interface ARealmTheReportKnows {
  readonly index?: unknown;
  readonly relation?: string | null | undefined;
}
/** A province's part of the report's order data, as the forecasts read it. */
export interface AProvincesOrderData {
  readonly wildHuntType?: string | null | undefined;
  readonly garrisonArmies?: readonly ACompanyAsTheFormCarriesIt[] | null | undefined;
}
/** A mercenary band the report shows roaming a province (mercIntel). */
export interface AMercenaryBandTheReportShows {
  readonly id: number | string;
  readonly type: string;
  readonly quality?: string | undefined;
  readonly unitName?: string | undefined;
  readonly race?: string | null | undefined;
}
/** The report as the forecasts read it: every part optional, as an older report (or none, read as `{}`) may lack it. */
export interface TheReportAsTheFormsForecastsReadIt {
  readonly playerIndex?: number | null | undefined;
  readonly characters?: readonly AHeroAsTheFormsForecastsReadHim[] | null | undefined;
  readonly mercIntel?: readonly AMercenaryBandTheReportShows[] | null | undefined;
  readonly ownedProvinces?: readonly { readonly id: unknown }[] | null | undefined;
  readonly kingdom?: { readonly alignment?: string | null | undefined } | null | undefined;
  readonly diplomacy?:
    { readonly known?: readonly (ARealmTheReportKnows | null)[] | null | undefined } | null | undefined;
  readonly worldMeta?:
    | { readonly provinces: readonly AProvinceOfTheReportsMap[]; readonly cols: number; readonly rows: number }
    | null
    | undefined;
  readonly provinceOrderData?: Readonly<Partial<Record<string, AProvincesOrderData>>> | null | undefined;
}
/** One phase's order of a hero as the page's snapshot holds it (the-orders-the-form-holds-handed-to-its-forecasts.ts):
 *  each part the form shows a field for, the field's value, and a Recruit's boxes. */
interface AnOrderAsTheFormsForecastsReadIt {
  readonly action?: unknown;
  readonly target?: unknown;
  readonly extra?: unknown;
  readonly recruit?: { readonly musterTo: unknown; readonly ticked: readonly unknown[] } | undefined;
}
/** The orders the form holds, as the forecasts read them (theOrderField, theRecruitBoxesOf). */
export interface TheOrdersAsTheFormsForecastsReadThem {
  readonly byHero?:
    | Readonly<Partial<Record<string, readonly (AnOrderAsTheFormsForecastsReadIt | null | undefined)[]>>>
    | null
    | undefined;
  readonly declarations?: unknown;
}
/** Where a hero will stand: the province's id (the report's, so none where it gives none) and its name. */
export interface WhereAHeroStands {
  readonly id: number | null | undefined;
  readonly name: string | undefined;
}
/** A company the phase's orders add to a garrison, with the hero who adds it. */
interface WhatAHeroAddsToAGarrison {
  readonly hero: AHeroAsTheFormsForecastsReadHim;
  readonly units: readonly ACompanyAsTheFormCarriesIt[];
}

/** A field's value as the page holds it, read for its words where the code splits or trims it, or hands it to a rule
 *  that does: words (an input's or a select's value is), handed back as they are; any other value throws the TypeError
 *  the old `.split`, `.trim` or `.startsWith` on it threw. */
export function theWordsAFieldHolds(value: unknown): string {
  if (typeof value === 'string') return value;
  throw new TypeError(`an order's field holds ${typeof value}, not words`);
}
/** A field's value as `|| ''` read it: the value, or no words where it is falsy (typed as any value, as the field's is). */
export function theFieldOrNoWords(value: unknown): unknown {
  if (value) return value;
  return '';
}
/** Any value in words, as String writes it (a field's value, a hero's id as the form holds it). */
export function inWords(value: unknown): string {
  return String(value);
}
/** The element of `list` at `i`, a place the code has just made sure of; none throws the TypeError reading a field of
 *  it threw. */
function theOneAt<T>(list: readonly T[], i: number): T {
  const one = list[i];
  if (one === undefined) throw new TypeError(`no element at ${String(i)} of a list of ${String(list.length)}`);
  return one;
}
/** The companies the replay gives `char` (it gives every hero of the report a column); none throws the TypeError
 *  reading the list threw. */
function theColumnTheReplayGivesHim(
  armies: ReadonlyMap<AHeroAsTheFormsForecastsReadHim, ACompanyAsTheFormCarriesIt[]>,
  char: AHeroAsTheFormsForecastsReadHim,
): ACompanyAsTheFormCarriesIt[] {
  const column = armies.get(char);
  if (column === undefined) throw new TypeError(`the replay gives the hero ${String(char.id)} no column`);
  return column;
}
/** The numbers the form reads of an alignment order's row (`order`, ALIGN_ACTIONS' or theAlignmentOrdersByTheNameTheFormWrites'
 *  by its name), each read as it is asked: no row throws the TypeError reading its numbers threw, and a number the row
 *  doesn't state, or states as words, throws a TypeError (every row the form reads states it as a number). */
export function theNumbersOfTheRow(
  order: ReturnType<typeof theAlignmentOrdersByTheNameTheFormWrites>[string] | undefined,
): {
  readonly theWildHuntsBeasts: { readonly value: number };
  readonly thePriceOfWordFromAProvince: { readonly value: number };
  readonly thePrice: { readonly value: number };
} {
  if (order === undefined) throw new TypeError('the form reads the numbers of an alignment order it has no row of');
  const theNumber = (what: string): { readonly value: number } => {
    const stated = order.theNumbers[what]?.value;
    if (typeof stated !== 'number') throw new TypeError(`the row of ${order.name} states no number ${what}`);
    return { value: stated };
  };
  return {
    get theWildHuntsBeasts() {
      return theNumber('theWildHuntsBeasts');
    },
    get thePriceOfWordFromAProvince() {
      return theNumber('thePriceOfWordFromAProvince');
    },
    get thePrice() {
      return theNumber('thePrice');
    },
  };
}

// The orders the form holds, as the page hands them: `byHero`, by the hero's id (as a string), his order of each phase,
// with the part of each field the form shows (`action`, `target`, `extra`: the field's value as the page holds it; a part
// the form shows no field for is absent) and, for a Recruit's boxes, `recruit` ({ musterTo: its "Muster to" or null,
// ticked: each ticked box's value }); `declarations`, the declarations of war and treaties the form holds, by realm, or
// null. The field `part` of the hero `heroId`'s order of the phase `ph`, as the statements below read a field ({ value }),
// or null where the form shows none.
export function theOrderField(
  orders: TheOrdersAsTheFormsForecastsReadThem,
  part: 'action' | 'target' | 'extra',
  heroId: unknown,
  ph: number,
): { value: unknown } | null {
  const order = orders.byHero?.[String(heroId)]?.[ph];
  return order && part in order ? { value: order[part] } : null;
}
// The Recruit's boxes of the hero `heroId`'s order of the phase `ph` ({ dest: its "Muster to" as { value } or null,
// ticked: each ticked box as { value } }), or null where the form shows none.
function theRecruitBoxesOf(
  orders: TheOrdersAsTheFormsForecastsReadThem,
  heroId: unknown,
  ph: number,
): { dest: { value: unknown } | null; ticked: { value: unknown }[] } | null {
  const order = orders.byHero?.[String(heroId)]?.[ph];
  const boxes = order?.recruit;
  if (!boxes) return null;
  return {
    dest: boxes.musterTo === null ? null : { value: boxes.musterTo },
    ticked: boxes.ticked.map((value) => ({ value })),
  };
}

// the army list a character is LEADING at the start of a given phase, projected from the report by
// replaying every earlier-phase order that adds or removes armies — Recruit and Pick Up
// (add), Leave/Transfer and Disband (remove). This is what the Leave/Transfer and Disband forms show,
// so an army handed off or disbanded in an earlier phase no longer appears, and one recruited or
// picked up earlier does. (predictedLocation already accounts for earlier moves / conquests, so the
// recipient and garrison-eligibility lists reflect where the character will actually be.) Armies
// TRANSFERRED to this character by ANOTHER of yours earlier this turn — a Leave/Transfer handed over, or
// a Recruit mustered "to:<this id>" — ARE projected in, through chains of any length (2026-09-24; the
// comment that used to stand here still called that a known limitation long after it was implemented,
// and a _depth<2 cap meant it was true again past two hops. Both fixed — see projectedLedArmies).
// The units a Recruit order actually produces, in the ORDER the engine creates them: mercenary
// bands first (hired from the province's roaming bands, keeping their own name and quality), then
// native recruits at Average. Blood Offering, Leave/Transfer and Disband all address units by INDEX
// into the character's army list, so a projection that skipped mercenaries — as this one did until
// 2026-09-09 — both hid a band hired earlier in the turn and shifted every index after it.
export const GARRISON_UNIT_TYPES_P = new Set(KC_UNIT_CLASS.garrison);
export function _projRecruitUnits(
  report: TheReportAsTheFormsForecastsReadIt | null | undefined,
  tokens: readonly unknown[] | null | undefined,
): ACompanyAsTheFormCarriesIt[] {
  const out: ACompanyAsTheFormCarriesIt[] = [];
  const mercs = report?.mercIntel ?? [];
  const toks = (tokens ?? []).map((t) => inWords(theFieldOrNoWords(t)).trim()).filter(Boolean);
  // The engine walks the PROVINCE'S band list and hires whichever are ticked, so bands join in that
  // list's order — not the order the boxes happen to be ticked in. Mirror that exactly.
  const _picked = new Set(toks.filter((t) => t.startsWith('merc:')));
  mercs.forEach((m) => {
    if (_picked.has(`merc:${String(m.id)}`))
      out.push({
        type: m.type,
        quality: (m.quality ?? '') || 'Average',
        unitName: m.unitName,
        race: (m.race ?? '') || null,
        _merc: true,
      });
  });
  const _known = new Set(mercs.map((m) => `merc:${String(m.id)}`));
  _picked.forEach((t) => {
    if (!_known.has(t)) out.push({ type: 'Mercenary band', quality: 'Average', unitName: 'a hired band', _merc: true });
  }); // band no longer in view — still occupies its slot
  toks.forEach((v) => {
    if (!v || v === 'all' || v.startsWith('to:') || v.startsWith('merc:')) return;
    // one recruit token = ONE unit (the `|n` suffix is not a quantity here).
    const bar = v.indexOf('|');
    const type = bar >= 0 ? v.slice(0, bar) : v;
    out.push({ type, quality: 'Average' });
  });
  return out;
}

// ── THE COMPANIES A RECRUIT, A HAND-OVER AND A PICK UP MOVE (R-129, plan P1-11e19) ────
// Where each goes is the turn's own rule (src/shared/), asked on the companies as the report shows them: their marks
// (skeletal, temporary, wildHunt: the names the rules read) carried with them through the replay.
const asTheReportShowsIt = (a: ACompanyAsTheFormCarriesIt) => a;
// A company as the forecasts carry it: its type, quality, name and race, and the marks the turn's rules read.
function theCompanyAsTheFormCarriesIt(a: ACompanyAsTheFormCarriesIt, withRace = true): ACompanyAsTheFormCarriesIt {
  const company: {
    type: string;
    quality: string | undefined;
    unitName: string | undefined;
    race?: string | null | undefined;
  } = { type: a.type, quality: a.quality, unitName: a.unitName };
  if (withRace) company.race = a.race;
  return {
    ...company,
    skeletal: a.skeletal,
    temporary: a.temporary,
    wildHunt: a.wildHunt,
    wildHuntUntil: a.wildHuntUntil,
  };
}
// The room the beast command of the hero `card` leaves, leading `column`: his Druid as the report counts it (a hero
// hired, charmed or raised this turn shows none: a forecast limit).
function theRoomHisBeastCommandLeaves(
  card: AHeroAsTheFormsForecastsReadHim,
  column: readonly ACompanyAsTheFormCarriesIt[] | null | undefined,
): number {
  return theRoomALeadersBeastCommandLeaves(effSkillP(card, 'druid') | 0, column ?? [], asTheReportShowsIt);
}
// Where the companies the Recruit Armies order of the hero `o` in the phase `ph` raises muster, as the turn musters them
// (whereARecruitedCompanyMusters, aMercenaryBandIsNotHiredIntoAFullColumn): the bands first, then the province's, each
// into the column it joins (his, or the comrade's "Muster to" names: `dest`), or into the garrison (a garrison company,
// the garrison named, or a beast past the column's beast command, in a province of his realm); a band of beasts for a
// full column with no garrison to take it is not hired. `ticks` are the order's boxes, `destTok` its "Muster to";
// `columnOf(card)` the companies a hero leads as the phase begins. The province is his realm's by the report (one
// taken this turn: a forecast limit).
function whereTheCompaniesARecruitRaisesMuster(
  report: TheReportAsTheFormsForecastsReadIt,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  o: AHeroAsTheFormsForecastsReadHim,
  ph: number,
  ticks: readonly unknown[],
  destTok: unknown,
  columnOf: (card: AHeroAsTheFormsForecastsReadHim) => readonly ACompanyAsTheFormCarriesIt[] | null | undefined,
): {
  dest: AHeroAsTheFormsForecastsReadHim;
  toTheColumn: ACompanyAsTheFormCarriesIt[];
  toTheGarrison: ACompanyAsTheFormCarriesIt[];
} {
  const loc = whereAHeroStandsAfterTheOrdersBefore(report, orders, o.id, ph);
  const inAProvinceOfHisRealm = !!loc && (report.ownedProvinces ?? []).some((p) => p.id === loc.id);
  const theOrderNamesTheGarrison = destTok === 'to:garrison' && inAProvinceOfHisRealm;
  const named =
    destTok && destTok !== 'to:self' && destTok !== 'to:garrison'
      ? (report.characters ?? []).find((x) => `to:${String(x.id)}` === destTok)
      : null;
  const dest = named ?? o;
  const column = (columnOf(dest) ?? []).slice();
  const out: {
    dest: AHeroAsTheFormsForecastsReadHim;
    toTheColumn: ACompanyAsTheFormCarriesIt[];
    toTheGarrison: ACompanyAsTheFormCarriesIt[];
  } = { dest, toTheColumn: [], toTheGarrison: [] };
  _projRecruitUnits(report, ticks).forEach((u) => {
    const facts = {
      theOrderNamesTheGarrison,
      inAProvinceOfHisRealm,
      theCompany: u,
      theRoomTheColumnsBeastCommandLeaves: theRoomHisBeastCommandLeaves(dest, column),
    };
    if (u._merc && aMercenaryBandIsNotHiredIntoAFullColumn(facts)) return;
    if (
      whereARecruitedCompanyMusters({ ...facts, itIsAGarrisonCompany: GARRISON_UNIT_TYPES_P.has(u.type) }) ===
      'the column'
    ) {
      column.push(u);
      out.toTheColumn.push(u);
    } else out.toTheGarrison.push(u);
  });
  return out;
}
// Where the companies the Recruit Armies order `ticks` of the hero `o` in the phase `ph` raises muster, as the turn
// musters them, each column as the replay gives it: the treasury ledger counts a company's wage by the column it joins
// (R-134, P1-11e29).
export function whereTheCompaniesAHerosRecruitRaisesMusterOnTheseOrders(
  report: TheReportAsTheFormsForecastsReadIt | null | undefined,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  o: AHeroAsTheFormsForecastsReadHim,
  ph: number,
  ticks: readonly string[],
): ReturnType<typeof whereTheCompaniesARecruitRaisesMuster> {
  return whereTheCompaniesARecruitRaisesMuster(
    report ?? {},
    orders,
    o,
    ph,
    ticks,
    ticks.find((t) => t.startsWith('to:')) ?? 'to:self',
    (x) => whatAHeroLeadsAsAPhaseBegins(report, orders, x.id, ph),
  );
}
// What the hero `recipient`, leading `column` as the phase begins, takes of the companies `handed` him, as the turn
// hands them over: risen dead go to their graves unless he or his realm is Undead (theRisenDeadFollowAHandOverTo,
// whereAHandOversRisenDeadGo); the beasts past his beast command's room stay with the giver (`left`), the rest he takes
// (`taken`: theCompaniesALeaderTakesUpToHisBeastCommandsRoom).
function whatAComradeTakesOfAHandOver(
  report: TheReportAsTheFormsForecastsReadIt,
  recipient: AHeroAsTheFormsForecastsReadHim,
  column: readonly ACompanyAsTheFormCarriesIt[] | null | undefined,
  handed: readonly ACompanyAsTheFormCarriesIt[],
): { readonly taken: ACompanyAsTheFormCarriesIt[]; readonly left: ACompanyAsTheFormCarriesIt[] } {
  const theyFollow = theRisenDeadFollowAHandOverTo({
    alignment: recipient.alignment,
    hisRealmsAlignment: report.kingdom?.alignment,
  });
  const following = whereAHandOversRisenDeadGo(handed, theyFollow, asTheReportShowsIt).handed;
  return theCompaniesALeaderTakesUpToHisBeastCommandsRoom(
    following,
    theRoomHisBeastCommandLeaves(recipient, column),
    asTheReportShowsIt,
  );
}

// ── A MARCH THE TURN REFUSES (R-128, plan P1-11e10) ────
// The turn turns a march back before it takes a step, and the hero stays where he is for his later orders (and his
// Search Lair names the lair where he stands: doSubmitOrders sends predictedLocation's province). Asked here in the
// turn's order, by the engine's own rules (src/shared/), on the column the Move note counts (projectedMoveHost: the
// companies he will lead as the march sets out, this phase's hand-overs among them):
//   0. his pace (P1-11e11): the turn checks his move pools first. They are the paces the report gives (his land and sea
//      pace: the turn's pools as the turn begins), and each step spends one point of the pool the turn's rule names
//      (theMovePoolAStepSpends: the sea pool to put to sea or land from it, the land pool from land to land); a step
//      whose pool is spent is refused;
//   1. a neutral realm's border: a province of a realm his own is neither allied with nor at war with, and he leads
//      companies (a lone hero passes). The relation is the report's; a war his realm declares on the form this turn
//      stands from the first phase only for an Evil or Undead realm (war without warning: the turn's step before the
//      first phase), every other declaration from next turn;
//   2. the sea, with too little lift to put to sea (hulls and flyers: the note's sea lift);
//   3. ships over land: a column leading any fleet or sea-beast steps from land only to the sea.
// Forecast limits (plan P1-11's Decision 3), left to the turn: an owner the report can't show (a province he hasn't
// seen: no border is forecast), a terrain an Illusory Terrain hides, a war a rival declares, a blockade, a flood, and
// his pools as the turn changes them: companies he takes up, hands over or loses, a skill he
// rises in, a lone leg not charged to companies he takes up after it, a battle's win point; a hero who joins this
// turn (hired, charmed or raised: the report shows no pace of his) marches at no pace.
function hisMovePoolsAsTheReportGivesThem(char: AHeroAsTheFormsForecastsReadHim): { land: number; sea: number } | null {
  if (Number(char.hiredInPhase) >= 0) return null;
  const pace = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : Infinity);
  return { land: pace(char.effectiveSpeed), sea: pace(char.effectiveSeaSpeed) };
}
function theRelationAMarchMeetsAtTheBorderOf(
  report: TheReportAsTheFormsForecastsReadIt,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  owner: number,
): string {
  if (owner === report.playerIndex) return 'self';
  const known = (report.diplomacy?.known ?? []).find((k) => k?.index === owner);
  const now = (known?.relation ?? '') || 'neutral';
  const declared: unknown = known && orders.declarations ? Reflect.get(Object(orders.declarations), owner) : null;
  const withoutWarning = doesAnAlignmentDeclareWarWithoutWarning(report.kingdom?.alignment); // their rows (P1-19ax2)
  return declared === 'enemy' && withoutWarning ? 'enemy' : now;
}
function aMarchTheTurnRefuses(
  report: TheReportAsTheFormsForecastsReadIt,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  char: AHeroAsTheFormsForecastsReadHim,
  ph: number,
  from: AProvinceOfTheReportsMap,
  to: AProvinceOfTheReportsMap,
): boolean {
  const column = theColumnAHeroMarchesWithInAPhase(report, orders, char.id, ph).armies;
  const turnedBack = aColumnIsTurnedBackAtANeutralRealmsBorder(
    report.playerIndex,
    to.owner,
    column.length,
    to.owner == null ? 'neutral' : theRelationAMarchMeetsAtTheBorderOf(report, orders, to.owner),
  );
  if (turnedBack) return true;
  const lift = poSeaAnalysis(column, Number(char.skills?.['naval']) || 0).cap;
  if (to.terrain === 'sea') return !canEnterTerrain({ armies: column }, 'sea', lift);
  if (from.terrain === 'sea') return false; // a landing: the turn asks only his sea points
  // (the turn's own check of the ground after it, that a column of ships alone may not stand on land, can't refuse a
  // march this one lets through: such a column leads ships)
  const theColumnAsItsGuardReadsIt: readonly (ACompanyAsTheFormCarriesIt | null | undefined)[] = column;
  const leadsShips = theColumnAsItsGuardReadsIt.some((a) => a && PO_SEA_TYPES.has(a.type));
  return aColumnLeadingShipsMayNotStepFromLandToLand(leadsShips, from.terrain, to.terrain);
}
// ── ONE STEP TOWARD A FAR PROVINCE (R-128, plan P1-11e12) ────
// The turn marches a column ordered to a province not next door one step toward it, and the step is then a march like
// any other (his pace, a border, the sea, ships over land: aMarchTheTurnRefuses). The step is the turn's own (src/shared/):
// the first step of a shortest route the column may take (the ground its lift lets it enter; ships never from land to
// land), but of a route as short over safe passage (his realm's own ground, an ally's, or ground no realm holds where
// no armed neutral guard stands), that one's; where no route reaches it, he stays. Asked on the report's map, with the
// column the Move note counts and the relation the report gives. Forecast limits, left to the turn: ground the report
// shows as unknown (read as land no realm holds), a guard out of sight, an owner or ground as last seen, an alliance or
// war changed this turn.
function theStepTowardAFarProvinceTheTurnTakes(
  report: TheReportAsTheFormsForecastsReadIt,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  char: AHeroAsTheFormsForecastsReadHim,
  ph: number,
  from: AProvinceOfTheReportsMap,
  toId: number,
): AProvinceOfTheReportsMap | null {
  const worldMeta = report.worldMeta;
  // (its one caller asks it only on a report that gives the map: none throws the TypeError the route's read threw)
  if (!worldMeta) throw new TypeError('the march forecast steps over a map the report gives none of');
  const column = theColumnAHeroMarchesWithInAPhase(report, orders, char.id, ph).armies;
  const seaCap = poSeaAnalysis(column, Number(char.skills?.['naval']) || 0).cap;
  const theColumnAsItsGuardReadsIt: readonly (ACompanyAsTheFormCarriesIt | null | undefined)[] = column;
  const leadsShips = theColumnAsItsGuardReadsIt.some((a) => a && PO_SEA_TYPES.has(a.type));
  const route = (extraFilter?: (p: AProvinceOfTheReportsMap) => boolean) =>
    theFirstStepOfAShortestRouteAColumnMayTake(
      { armies: column },
      seaCap,
      leadsShips,
      worldMeta,
      from,
      toId,
      extraFilter,
    );
  const known = (owner: number | null | undefined) => (report.diplomacy?.known ?? []).find((k) => k?.index === owner);
  // (a guard the report shows: a hero of no realm sworn to the province, leading any company)
  const anArmedGuardIsSeen = (p: AProvinceOfTheReportsMap) =>
    (p.characters ?? []).some((x) => x?.isWanderer && x.isNeutralGuard && x.armyBand && x.armyBand !== 'no armies');
  const isSafePassage = (p: AProvinceOfTheReportsMap) =>
    aProvinceIsSafePassageForARealmsColumn(
      report.playerIndex,
      p.owner,
      () => (known(p.owner)?.relation ?? '') || 'neutral',
      () => anArmedGuardIsSeen(p),
    );
  return theStepAColumnTakesTowardAFarProvince(route, toId, true, isSafePassage);
}
// ── ONE ANSWER A REFRESH (plan P1-11e10) ────
// A march's refusal reads the column he will lead, and that column reads where he and his comrades stand in the
// phases before (projectedMoveHost, projectedLedArmies), so every phase's answer would be worked out again for each
// later one. Each answer is kept while what it was worked out from stands: the report and every order field the
// forecasts read (each hero's action, target and extra, a Recruit's boxes and muster) of the phases before it, and the
// war the form declares. A field changed is a new key, so no answer outlives the orders it was worked out from.
let theForecastsReport: unknown = null;
const theForecastsAnswers = new Map<string, WhereAHeroStands | null>();
function whatTheForecastOfThePhasesBeforeReads(
  report: TheReportAsTheFormsForecastsReadIt,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  upToPhaseExclusive: number,
): string {
  const parts: string[] = [orders.declarations ? JSON.stringify(orders.declarations) : ''];
  const value = (part: 'action' | 'target' | 'extra', heroId: unknown, ph: number) => {
    const el = theOrderField(orders, part, heroId, ph);
    return el ? inWords(el.value ?? '') : '';
  };
  (report.characters ?? []).forEach((o) => {
    for (let ph = 0; ph < upToPhaseExclusive; ph++) {
      parts.push(value('action', o.id, ph), value('target', o.id, ph), value('extra', o.id, ph));
      const wrap = theRecruitBoxesOf(orders, o.id, ph);
      if (!wrap) continue;
      const dest = wrap.dest;
      const ticked = wrap.ticked.map((x) => x.value);
      parts.push(dest ? String(dest.value) : '', ticked.join(','));
    }
  });
  return JSON.stringify(parts);
}
export function whereAHeroStandsAfterTheOrdersBefore(
  report: TheReportAsTheFormsForecastsReadIt | null | undefined,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  charId: unknown,
  upToPhaseExclusive: number,
): WhereAHeroStands | null {
  if (!report) return null;
  if (theForecastsReport !== report || theForecastsAnswers.size > 5000) {
    theForecastsReport = report;
    theForecastsAnswers.clear();
  }
  const key = `${String(charId)}|${String(upToPhaseExclusive)}|${whatTheForecastOfThePhasesBeforeReads(report, orders, upToPhaseExclusive)}`;
  // (an answer kept is a place or null, never undefined: none kept is a miss, as `has` read it)
  const kept = theForecastsAnswers.get(key);
  if (kept !== undefined) {
    return kept ? { ...kept } : kept;
  }
  const answer = ((): WhereAHeroStands | null => {
    const char = (report.characters ?? []).find((c) => c.id === charId);
    if (!char) return null;
    let locId = char.locationId;
    const worldMeta = report.worldMeta;
    if (!worldMeta) return { id: locId, name: char.locationName };
    const pools = hisMovePoolsAsTheReportGivesThem(char);
    for (let ph = 0; ph < upToPhaseExclusive; ph++) {
      const action = theOrderField(orders, 'action', charId, ph)?.value;
      // A FORCED MARCH is a Move in the turn (one that may slip past a battle), so later phases' forms follow it as they
      // follow a Move. Both read their target as the turn does (R-128: the engine's whatAMarchsOrderNames, through
      // src/shared/): `dir:<compass>` a step that way, `prov:<id>` or the province's bare number (as the Forced March's
      // field writes it) a province.
      if (action !== 'Move' && action !== 'Forced March') continue;
      const named = whatAMarchsOrderNames(
        theWordsAFieldHolds(theFieldOrNoWords(theOrderField(orders, 'target', charId, ph)?.value)),
      );
      const curProv = worldMeta.provinces.find((p) => p.id === locId);
      let toId: number | null = null;
      if (named.by === 'province') {
        if (worldMeta.provinces.some((p) => p.id === named.provinceId)) toId = named.provinceId;
      } else if (curProv) {
        const nid = theHexNextToAProvinceInADirection(curProv, named.direction, worldMeta.cols, worldMeta.rows);
        if (nid !== null && worldMeta.provinces.some((p) => p.id === nid)) toId = nid;
      }
      if (toId === null || toId === locId) continue;
      if (!curProv) {
        locId = toId;
        continue;
      }
      // a province next door, or one step toward a far one (P1-11e12): the step the turn may refuse
      const nextDoor = KC_HEX_DIRS.some(
        (d) => theHexNextToAProvinceInADirection(curProv, d, worldMeta.cols, worldMeta.rows) === toId,
      );
      const toProv = nextDoor
        ? worldMeta.provinces.find((p) => p.id === toId)
        : theStepTowardAFarProvinceTheTurnTakes(report, orders, char, ph, curProv, toId);
      if (!toProv) continue; // no route reaches it
      const spends = pools ? theMovePoolAStepSpends(curProv.terrain, toProv.terrain) : null;
      // (`spends` is set only where he has pools)
      if (spends && pools && pools[spends] <= 0) continue; // past his pace
      if (aMarchTheTurnRefuses(report, orders, char, ph, curProv, toProv)) continue;
      if (spends && pools) pools[spends] -= 1;
      locId = toProv.id;
    }
    const prov = worldMeta.provinces.find((p) => p.id === locId);
    return prov ? { id: locId, name: (prov.name ?? '') || 'Unknown' } : { id: locId, name: 'Unknown' };
  })();
  theForecastsAnswers.set(key, answer ? { ...answer } : answer);
  return answer;
}

// ══ MOVE ANALYSIS (2026-09-26, Toby item 1) ═══════════════════════════════════════════════════
// Before a Move order is submitted, tell the player what KIND of move it is — a land march, a
// voyage, or a flight — and warn them when they are ordering a column into the sea that their
// hulls and flyers cannot carry. Whether the hulls and flyers can carry the column, and the figures the note explains
// itself by (its berths, its land units, the units left ashore), are the engine's own seaLiftOfAColumn (src/shared/;
// plan P1-11b4: the engine's getSeaCapability asks it too). The sets below only sort the column for the note's words.
export const PO_SEA_TYPES = new Set(KC_UNIT_CLASS.sea);
export const PO_CARRIER_TYPES = new Set(KC_UNIT_CLASS.carrier);
export const PO_AERIAL_TYPES = new Set(KC_UNIT_CLASS.aerial);
// The stand-in type for a unit an earlier order will produce whose TYPE cannot be known in advance
// (a grave raised by Skeletal Armies or Harvest the Field). It belongs to no aerial, sea, creature
// or monster set, so isAirCarriable treats it as humanoid foot, and poSeaAnalysis has it take half
// a hull, as light foot do — the commonest case by far for a raised or harvested unit.
export const PO_PROJECTED_FOOT = '__projected foot__';
const takesHalfAHullAboardOrIsYetToBeRaised = (a: ACompanyAsTheFormCarriesIt) =>
  a.type === PO_PROJECTED_FOOT || takesHalfAHullAboard(a); // a unit the player has ordered raised or summoned earlier this turn — counted as light foot
// The engine's sea lift, with the figures the note needs to explain itself.
// cap: 'all' (nothing to carry), 'sea' (hulls and flyers lift the lot), 'land' (cannot put to sea).
export function poSeaAnalysis(
  armies: readonly (ACompanyAsTheFormCarriesIt | null | undefined)[] | null | undefined,
  navalRaw: number | null | undefined,
) {
  const A = (armies ?? []).filter((a): a is ACompanyAsTheFormCarriesIt => Boolean(a));
  const navalL8 = (navalRaw ?? 0) >= 8; // NAVAL L8: one hull carries what once needed two
  const lift = seaLiftOfAColumn(A, navalL8, takesHalfAHullAboardOrIsYetToBeRaised);
  return {
    cap: lift.answer,
    hulls: lift.berths, // berths, as the engine counts them: a turtle's Island Back offers two
    seaBeasts: A.filter((a) => PO_SEA_TYPES.has(a.type) && !PO_CARRIER_TYPES.has(a.type)).length,
    flyers: lift.humanoidFlyers,
    aerial: A.filter((a) => PO_AERIAL_TYPES.has(a.type)).length,
    landCount: lift.landUnits,
    hullCap: lift.berthsUnderItsLeader,
    navalL8,
    lifted: lift.flyersLiftTheWholeColumn,
    allAerial: A.length > 0 && A.every((a) => PO_AERIAL_TYPES.has(a.type)),
    allSea: A.length > 0 && A.every((a) => PO_SEA_TYPES.has(a.type)),
    total: A.length,
    mustSail: lift.unitsThatMustSail,
    short: lift.unitsLeftAshore.length, // the units left ashore: the ship-only ones without a berth, the heaviest first, or those no flyer is left to lift
    shortNames: lift.unitsLeftAshore.map((a) => (a.unitName ?? '') || a.type),
  };
}
// ── THE HOST AS IT WILL STAND AT THIS PHASE (2026-09-26) ────
// The notice below used to read the units the hero leads RIGHT NOW, so a column that recruits three
// hulls in Spring and sails in Early Summer was told it had no lift. It now reads the host the hero
// will actually be leading when the move resolves.
// projectedLedArmies already folds in every order that hands units about — this hero's own Recruit,
// Pick Up, Leave/Transfer and Disband, AND other characters' Recruit "mustered to" this hero and
// Leave/Transfer handed to this hero, each resolved at the phase it fires. On top of that, the
// orders below CREATE units, and are added here:
//   · Perform Rite/Wild Hunt — two Veteran beasts of the province's own wild type
//   · Elemental Summon       — one elemental (it walks; the engine does not count it as winged)
//   · Skeletal Armies        — one to three raised graves (by the caster's Necromancy)
//   · Harvest the Field      — one raised grave
// A raised grave's TYPE cannot be known in advance, so it is counted as humanoid foot
// (PO_PROJECTED_FOOT) — the commonest case, and the one the lift maths cares about.
// A Blood Offering's sacrifices are taken back OUT of the host.
// Orders whose units can be neither typed nor counted in advance (Awaken Grove, Wild Calling,
// Control Undead, Raise Wraiths, Death's Dominion) are listed in `uncounted` and named in the note
// rather than guessed at.
export const PO_UNCOUNTABLE_ACTIONS = new Set(['Awaken Grove', 'Wild Calling']);
export const PO_UNCOUNTABLE_SPELLS = new Set(['Control Undead', 'Raise Wraiths', "Death's Dominion", 'Phantom Host']);
export function theColumnAHeroMarchesWithInAPhase(
  theReport: TheReportAsTheFormsForecastsReadIt | null | undefined,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  charId: unknown,
  ph: number,
): {
  armies: ACompanyAsTheFormCarriesIt[];
  uncounted: string[];
  gained: number;
  base: number;
  sameFrom?: string[];
} {
  const report = theReport ?? {};
  const ch = (report.characters ?? []).find((x) => String(x.id) === String(charId));
  const out: {
    armies: ACompanyAsTheFormCarriesIt[];
    uncounted: string[];
    gained: number;
    base: number;
    sameFrom?: string[];
  } = { armies: [], uncounted: [], gained: 0, base: 0 };
  if (!ch) return out;
  // (whatAHeroLeadsAsAPhaseBegins and the forecasts below are this file's own functions: a test of their type, from when
  // the page's files were scripts, always held)
  out.armies = whatAHeroLeadsAsAPhaseBegins(report, orders, ch.id, ph);
  out.base = (ch.armies ?? []).length;
  const sameFrom: string[] = [];
  out.sameFrom = sameFrom;
  const pod = report.provinceOrderData ?? {};
  const theUncountableActions: ReadonlySet<unknown> = PO_UNCOUNTABLE_ACTIONS;
  const anUncountableAction = (act: unknown): act is string => theUncountableActions.has(act);
  const add = (a: ACompanyAsTheFormCarriesIt) => {
    out.armies.push(a);
    out.gained++;
  };
  // ── SAME-PHASE HAND-OVERS (2026-09-28, Toby item 5) ────
  // The engine resolves every non-moving order of a phase (Leave/Transfer, Recruit, casting …) BEFORE
  // any Move in that phase, and a transfer to a hero who is about to march is ordered ahead of his
  // move. So troops another of your characters hands to this hero — or recruits straight into his
  // column — in the SAME phase as the move really do march with him. projectedLedArmies only counts
  // other characters' orders from strictly earlier phases, so those are added here. Both sides must
  // be standing in the same province at the start of the phase (the engine refuses the hand-over
  // otherwise).
  {
    const myLoc = whereAHeroStandsAfterTheOrdersBefore(report, orders, ch.id, ph);
    const theHeroesAsTheirGuardReadsThem: readonly (AHeroAsTheFormsForecastsReadHim | null | undefined)[] =
      report.characters ?? [];
    theHeroesAsTheirGuardReadsThem.forEach((o) => {
      if (!o || o.alive === false || String(o.id) === String(ch.id)) return;
      const oAct = theFieldOrNoWords(theOrderField(orders, 'action', o.id, ph)?.value);
      if (oAct !== 'Recruit Armies' && oAct !== 'Leave/Transfer Army') return;
      const oLoc = whereAHeroStandsAfterTheOrdersBefore(report, orders, o.id, ph);
      if (!myLoc || !oLoc || oLoc.id !== myLoc.id) return;
      const oTgt = String(theFieldOrNoWords(theOrderField(orders, 'target', o.id, ph)?.value));
      const toks = oTgt
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      let got: ACompanyAsTheFormCarriesIt[] = [];
      if (oAct === 'Recruit Armies') {
        if (!toks.includes(`to:${String(ch.id)}`)) return;
        // where the turn musters them (R-129, P1-11e19): garrison companies and beasts past his command not in his column
        const musters = whereTheCompaniesARecruitRaisesMuster(
          report,
          orders,
          o,
          ph,
          toks,
          `to:${String(ch.id)}`,
          (x) => (x === ch ? out.armies : whatAHeroLeadsAsAPhaseBegins(report, orders, x.id, ph)),
        );
        got = musters.dest === ch ? musters.toTheColumn : [];
      } else {
        const oExtra = theFieldOrNoWords(theOrderField(orders, 'extra', o.id, ph)?.value);
        if (String(oExtra) !== String(ch.id)) return;
        const oArm = whatAHeroLeadsAsAPhaseBegins(report, orders, o.id, ph);
        if (toks.includes('all')) got = oArm.slice();
        else {
          const pool = oArm.slice();
          toks.forEach((val) => {
            const i = pool.findIndex((x) => ((x.unitName ?? '') || x.type) === val || x.type === val);
            if (i >= 0) got.push(...pool.splice(i, 1));
          });
        }
        // what he takes of them as the turn hands them over (R-129, P1-11e19): risen dead, his beast command
        got = whatAComradeTakesOfAHandOver(report, ch, out.armies, got).taken;
      }
      if (!got.length) return;
      got.forEach((u) => {
        add({ ...u, _projected: true });
      });
      sameFrom.push(
        `${String(got.length)} unit${got.length !== 1 ? 's' : ''} ${oAct === 'Recruit Armies' ? 'recruited for him' : 'handed over'} by ${String(o.name)}`,
      );
    });
  }
  for (let p = 0; p < ph; p++) {
    const act = theFieldOrNoWords(theOrderField(orders, 'action', charId, p)?.value);
    if (!act) continue;
    const tgt = String(theFieldOrNoWords(theOrderField(orders, 'target', charId, p)?.value)).trim();
    if (act === 'Perform Rite') {
      if (tgt === 'Wild Hunt') {
        const loc = whereAHeroStandsAfterTheOrdersBefore(report, orders, charId, p);
        const wt = loc ? pod[String(loc.id)]?.wildHuntType : null;
        if (wt) {
          const theBeasts = theNumbersOfTheRow(theAlignmentOrdersByTheNameTheFormWrites()['Perform Rite'])
            .theWildHuntsBeasts.value; // its row's
          for (let bound = 0; bound < theBeasts; bound++)
            add({ type: wt, quality: 'Veteran', unitName: `${wt} (bound by the Wild Hunt)`, _projected: true });
        } else out.uncounted.push('the Wild Hunt');
      } else {
        // Blood Offering — the sacrificed units are gone by the time the column marches: those the turn gives (its own
        // rule: with a side left empty, the first company it may take; R-133, plan P1-11e27).
        const ex = String(theFieldOrNoWords(theOrderField(orders, 'extra', charId, p)?.value));
        const atThen = whatAHeroLeadsAsAPhaseBegins(report, orders, charId, p);
        const offered = theCompaniesABloodOfferingGivesAndRaises(atThen, ex, asTheReportShowsIt);
        (offered ? offered.given : []).forEach((i) => {
          const a = atThen[i];
          if (!a) return;
          const j = out.armies.findIndex((x) => ((x.unitName ?? '') || x.type) === ((a.unitName ?? '') || a.type));
          if (j >= 0) {
            out.armies.splice(j, 1);
          }
        });
      }
      continue;
    }
    if (act === 'Harvest the Field') {
      add({
        type: PO_PROJECTED_FOOT,
        quality: 'Average',
        unitName: 'a grave you expect to raise this turn',
        _projected: true,
      });
      continue;
    }
    if (act === 'Cast Spell') {
      if (tgt === 'Elemental Summon') {
        add({
          type: 'Air Elemental',
          quality: 'Veteran',
          unitName: 'the elemental you expect to summon',
          _projected: true,
        });
        continue;
      }
      if (tgt === 'Skeletal Armies') {
        const lv = Math.max(0, Math.min(5, Math.round(effSkillP(ch, 'necromancy') || 0)));
        const n = lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
        for (let k = 0; k < n; k++)
          add({
            type: PO_PROJECTED_FOOT,
            quality: 'Average',
            unitName: 'a grave you expect to raise this turn',
            _projected: true,
          });
        continue;
      }
      if (PO_UNCOUNTABLE_SPELLS.has(tgt)) out.uncounted.push(tgt);
      continue;
    }
    if (anUncountableAction(act)) out.uncounted.push(act);
  }
  out.uncounted = [...new Set(out.uncounted)];
  return out;
}
// The EFFECTIVE level of a skill as the engine will use it — base plus items, aura and any Curse,
// straight from the breakdown the GM shipped. Every success-chance preview in the order forms reads
// this, so a "+2 Thief" blade shows in the odds the player is quoted. Falls back to the raw level
// for an older report.
export function effSkillP(c: AHerosSkillsAsTheFormReadsThem | null | undefined, k: string): number {
  const e = c?.skillEff?.[k];
  if (typeof e?.total === 'number') return e.total;
  const levels = c?.skills ?? {};
  return (levels[k] ?? 0) || 0;
}

// ── The forecasts' replay (plan P1-11e17) ────────────────────────────────────────────────────────────────────────────
// What each hero will carry and lead, and what each province's garrison will hold unled, as a phase begins: ONE forward
// replay of the realm's orders, a phase at a time from the report (each phase: the items handed over, hero by hero in
// the turn's order of the phase's heroes since P1-11e20; then what the phase's orders add to each garrison, from what each
// hero leads as the phase begins; then what each hero will lead, from what he and his comrades led as it began; then
// what the phase's Pick Ups take from each garrison). predictedItems, projectedLedArmies and projectedGarrison each
// read it; they used to replay the phases each on its own (the last two calling each other through a shared cache).
// The replay is worked out afresh for each call, from the fields as they stand, so it never serves an answer the
// player has since changed.
function theFormsReplayOfThePhasesBefore(
  report: TheReportAsTheFormsForecastsReadIt,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  upToPhaseExclusive: number,
): {
  items: Map<string, AnItemAHeroCarries[]>;
  armies: Map<AHeroAsTheFormsForecastsReadHim, ACompanyAsTheFormCarriesIt[]>;
  garrisons: Map<unknown, ACompanyAsTheFormCarriesIt[]>;
} {
  const characters = report.characters ?? [];
  // ── 2026-09-24 (Toby): keyed by String(id) throughout ──────────────────────────────────────────
  // predictedItems used to open with
  //     const cid=typeof charId==='string'?parseInt(charId):charId;
  // and read the recipient with `parseInt(...)` as well. Both are NaN for a PRE-ORDER card's
  // synthetic id ('hired_77_via_1_ph0', 'charm_88_via_1_ph0', 'resurrect_…'), so an item SENT to a
  // hero being hired, raised or charmed this turn never entered their predicted pack, and the
  // lookup for the card itself never found their own row either.
  // The GM resolves the send correctly — `orderCharRef` maps the synthetic id to the real hero and
  // same-province delivery is immediate — so the item genuinely WAS in that hero's hands from the
  // phase after the hand-over. Only the order form could not see it, which left the player unable
  // to order the hero to equip or use the very thing they had just been handed, and made the
  // "what they carry is not yours to see" notice (§150) permanent even for gear the player had
  // supplied themselves.
  // The Map is local to the replay, so re-keying it is contained; `predictedLocation` still needs
  // the character's REAL id (it compares with ===), hence the byKey lookup rather than passing the
  // select's string value straight through — that was how the old code got away with parseInt for
  // ordinary numeric recipients.
  const items = new Map<string, AnItemAHeroCarries[]>();
  const byKey = new Map<string, AHeroAsTheFormsForecastsReadHim>();
  characters.forEach((x) => {
    items.set(String(x.id), [...(x.items ?? [])]);
    byKey.set(String(x.id), x);
  });
  // the companies each hero leads, by his card (with the marks the report gives them: R-129, P1-11e19)
  let armies = new Map<AHeroAsTheFormsForecastsReadHim, ACompanyAsTheFormCarriesIt[]>();
  characters.forEach((x) => {
    armies.set(
      x,
      (x.armies ?? []).map((a) => theCompanyAsTheFormCarriesIt(a)),
    );
  });
  // the garrison of each province an order has touched, by the province's id as predictedLocation gives it
  const garrisons = new Map<unknown, ACompanyAsTheFormCarriesIt[]>();
  for (let p = 0; p < upToPhaseExclusive; p++) {
    theItemsAPhasesOrdersHandOver(report, orders, characters, items, byKey, p);
    const added = theCompaniesAPhasesOrdersAddToEachGarrison(report, orders, armies, p);
    const next = new Map<AHeroAsTheFormsForecastsReadHim, ACompanyAsTheFormCarriesIt[]>();
    // the beasts the phase's Pick Ups take past a leader's beast command, which go back to the garrison
    const goBack = new Map<unknown, ACompanyAsTheFormCarriesIt[]>();
    characters.forEach((x) => {
      next.set(x, theCompaniesAHeroLeadsAfterAPhase(report, orders, armies, garrisons, added, x, p, goBack));
    });
    theGarrisonsAfterAPhase(report, orders, garrisons, added, p, goBack);
    armies = next;
  }
  return { items, armies, garrisons };
}

// The realm's heroes who act in the phase `p`, in the order the turn has them act (R-129, plan P1-11e20): the turn's
// own rules (src/shared/), on each hero's order of the phase as the form holds it (its kind as the turn reads its name),
// his skills as the report gives them, where he stands as the phase begins and where his march takes him. Initiative in
// tiers (an order that stays put, then a march, then a Defend), and who must act first: a hero handing an item or
// companies to a comrade beside him before that comrade, a comrade marching in to take them before the giver, a Pick Up
// after the leaves of its province. A hero who joins this turn acts from the phase after (his levels hidden, so his
// initiative a forecast limit, as is a hero of the realm the report gives no id: he acts after the rest on a tie).
// Forecast limits, left to the turn: a pursuit under way, a march the interlocks cancel, a rival's hero.
function theHeroesInTheOrderTheTurnHasThemActInAPhase(
  report: TheReportAsTheFormsForecastsReadIt,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  characters: readonly AHeroAsTheFormsForecastsReadHim[],
  p: number,
): AHeroAsTheFormsForecastsReadHim[] {
  const field = (part: 'action' | 'target' | 'extra', x: AHeroAsTheFormsForecastsReadHim) =>
    String(theFieldOrNoWords(theOrderField(orders, part, x.id, p)?.value));
  const theHeroesAsTheirGuardReadsThem: readonly (AHeroAsTheFormsForecastsReadHim | null | undefined)[] = characters;
  const acting = theHeroesAsTheirGuardReadsThem.filter((x): x is AHeroAsTheFormsForecastsReadHim =>
    Boolean(x && x.alive !== false && !(Number(x.hiredInPhase) >= 0 && p <= Number(x.hiredInPhase))),
  );
  const plainIds = new Map<AHeroAsTheFormsForecastsReadHim, number>(
    acting.map((x, i) => [x, typeof x.id === 'number' ? x.id : 1_000_000 + i]),
  );
  // (every acting hero has one)
  const thePlainIdOf = (x: AHeroAsTheFormsForecastsReadHim): number => {
    const id = plainIds.get(x);
    if (id === undefined) throw new TypeError(`no plain id for the hero ${String(x.id)}`);
    return id;
  };
  const heroes = acting.map((x) => ({
    id: thePlainIdOf(x),
    action: normaliseAction({ action: field('action', x) }),
    skills: x.skills,
    hero: x,
  }));
  const intents = new Map(
    heroes.map(
      (
        h,
      ): [
        number,
        Parameters<typeof theHeroesWhoMustActFirstInAPhase>[0] extends ReadonlyMap<number, infer I> ? I : never,
      ] => {
        const from = whereAHeroStandsAfterTheOrdersBefore(report, orders, h.hero.id, p);
        const to = h.action === 'move' ? whereAHeroStandsAfterTheOrdersBefore(report, orders, h.hero.id, p + 1) : null;
        const handsTo =
          h.action === 'give_item' || h.action === 'leave_army'
            ? acting.find((x) => String(x.id) === field('extra', h.hero))
            : null;
        return [
          h.id,
          {
            id: h.id,
            player: report.playerIndex ?? null,
            action: h.action,
            fromId: from ? from.id : null,
            toId: to && from && to.id !== from.id ? to.id : null,
            order: { target: field('target', h.hero), extra: field('extra', h.hero) },
            theHeroHisOrderHandsTo: handsTo ? thePlainIdOf(handsTo) : null,
            theHeroHePursues: null,
          },
        ];
      },
    ),
  );
  return theOrderTheHeroesActInAPhase(heroes, theHeroesWhoMustActFirstInAPhase(intents)).map((h) => h.hero);
}

// Each character's item list through the phase `p`, by replaying its Give Item orders exactly as the GM engine resolves
// them (splice from giver, push to recipient — so item INDICES stay aligned with what the engine will see at resolution
// time). This lets a character who RECEIVES an item in an earlier phase pass it on in a later one. The heroes hand over
// in the turn's order (P1-11e20), so a comrade who acts before the giver stands where the phase leaves him: a comrade
// marching in to take it has arrived, and is handed it at once.
function theItemsAPhasesOrdersHandOver(
  report: TheReportAsTheFormsForecastsReadIt,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  characters: readonly AHeroAsTheFormsForecastsReadHim[],
  items: Map<string, AnItemAHeroCarries[]>,
  byKey: ReadonlyMap<string, AHeroAsTheFormsForecastsReadHim>,
  p: number,
): void {
  const theSendOrders: readonly unknown[] = ['Send Item', 'Give Item'];
  const sends = (x: AHeroAsTheFormsForecastsReadHim) =>
    theSendOrders.includes(theOrderField(orders, 'action', x.id, p)?.value);
  if (!characters.some(sends)) return;
  const actedBefore = new Set<AHeroAsTheFormsForecastsReadHim>();
  const whereHeStandsAsTheGiverActs = (x: AHeroAsTheFormsForecastsReadHim) =>
    whereAHeroStandsAfterTheOrdersBefore(report, orders, x.id, actedBefore.has(x) ? p + 1 : p);
  theHeroesInTheOrderTheTurnHasThemActInAPhase(report, orders, characters, p).forEach((x) => {
    if (sends(x)) theItemsAHeroHandsOver(report, orders, x, items, byKey, p, whereHeStandsAsTheGiverActs);
    actedBefore.add(x);
  });
}
// The items the hero `x` hands over in the phase `p` (his Send Item), as he acts; `whereHeStandsAsTheGiverActs` is where
// his comrade stands then.
function theItemsAHeroHandsOver(
  report: TheReportAsTheFormsForecastsReadIt,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  x: AHeroAsTheFormsForecastsReadHim,
  items: Map<string, AnItemAHeroCarries[]>,
  byKey: ReadonlyMap<string, AHeroAsTheFormsForecastsReadHim>,
  p: number,
  whereHeStandsAsTheGiverActs: (x: AHeroAsTheFormsForecastsReadHim) => WhereAHeroStands | null,
): void {
  // a Give Item order can now hand over MULTIPLE items (comma-separated indices, or
  // "all"). Splice high→low so earlier removals don't shift the indices still to be moved.
  const recipKey = String(theFieldOrNoWords(theOrderField(orders, 'extra', x.id, p)?.value)).trim();
  const arr = items.get(String(x.id)) ?? [];
  if (!recipKey || !items.has(recipKey)) return;
  const recipCh = byKey.get(recipKey);
  if (!recipCh) return;
  // The items the turn hands over, by its own rule (src/shared/): "all", or each token a place (a plain whole number
  // in the pack's range) or an item's id or name, highest first; a granted Mithril suit stays on its wearer (R-129).
  // A CHARMED sender writes target='auto' — the engine picks the item and the player never sees which, so nothing can
  // be projected into the recipient's pack: 'auto' names no item, which is the right outcome; noted so it is not
  // later "fixed".
  const rawT = theWordsAFieldHolds(theFieldOrNoWords(theOrderField(orders, 'target', x.id, p)?.value)).trim();
  const uniq = theItemsASendItemOrderHandsOver(arr, rawT).places;
  // only DELIVER into the recipient's list this turn if they are co-located as he acts; a
  // cross-province send leaves the giver now but arrives with the recipient only at turn's end.
  const _same =
    whereAHeroStandsAfterTheOrdersBefore(report, orders, x.id, p)?.id === whereHeStandsAsTheGiverActs(recipCh)?.id;
  uniq.forEach((i) => {
    const [it] = arr.splice(i, 1);
    if (_same) (items.get(recipKey) ?? []).push(it);
  });
}

// The unled GARRISON of a province, replayed from this player's orders in the SAME order the GM engine resolves them —
// Leave/Transfer-to-garrison and Recruit "to:garrison" APPEND (in army/checkbox order), Pick Up REMOVES (by index,
// highest first). The engine makes a Pick Up wait for any Leave in the same province in the same phase, so a Pick Up
// sees the leaves of its own phase by OTHER characters (projectedGarrison's includeSamePhase, the Pick Up form);
// pick-ups are only replayed for strictly earlier phases. This keeps the `g:i` indices the form emits aligned with the
// engine's live garrison. Rival/neutral changes to the garrison can't be foreseen.
// The garrison a province holds as the replay begins, from the report.
function theGarrisonTheReportShows(
  report: TheReportAsTheFormsForecastsReadIt,
  provId: unknown,
): ACompanyAsTheFormCarriesIt[] {
  const theOrderData = report.provinceOrderData ?? {};
  const pd = theOrderData[String(provId)];
  return (pd?.garrisonArmies ?? []).map((a) => theCompanyAsTheFormCarriesIt(a));
}
// What the orders of the phase `ph` add to each garrison, by the province's id: for each living hero who adds any, in
// the report's order, the hero and the companies he adds (those he leads as the phase begins, from `armies`).
function theCompaniesAPhasesOrdersAddToEachGarrison(
  report: TheReportAsTheFormsForecastsReadIt,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  armies: ReadonlyMap<AHeroAsTheFormsForecastsReadHim, ACompanyAsTheFormCarriesIt[]>,
  ph: number,
): Map<unknown, WhatAHeroAddsToAGarrison[]> {
  const added = new Map<unknown, WhatAHeroAddsToAGarrison[]>();
  const theHeroesAsTheirGuardReadsThem: readonly (AHeroAsTheFormsForecastsReadHim | null | undefined)[] =
    report.characters ?? [];
  theHeroesAsTheirGuardReadsThem
    .filter((x): x is AHeroAsTheFormsForecastsReadHim => Boolean(x && x.alive !== false))
    .forEach((o) => {
      const act = theFieldOrNoWords(theOrderField(orders, 'action', o.id, ph)?.value);
      if (act !== 'Leave/Transfer Army' && act !== 'Recruit Armies') return;
      const tgt = theFieldOrNoWords(theOrderField(orders, 'target', o.id, ph)?.value);
      const loc = whereAHeroStandsAfterTheOrdersBefore(report, orders, o.id, ph);
      if (!loc) return;
      const units: ACompanyAsTheFormCarriesIt[] = [];
      if (act === 'Leave/Transfer Army') {
        const extra = theOrderField(orders, 'extra', o.id, ph)?.value;
        if (extra !== '' && extra != null && inWords(extra) !== '-1') return; // handed to a character, not the garrison
        const led = theCompaniesTheReplayGivesTheHeroOfId(report, armies, o.id);
        if (
          theWordsAFieldHolds(tgt)
            .split(',')
            .map((t) => t.trim())
            .includes('all')
        )
          led.forEach((a) => units.push(a));
        else {
          const pool = led.slice();
          theWordsAFieldHolds(tgt)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .forEach((val) => {
              const i = pool.findIndex((a) => a.type === val || a.unitName === val);
              if (i >= 0) units.push(...pool.splice(i, 1));
            });
        }
      } else {
        const wrap = theRecruitBoxesOf(orders, o.id, ph);
        if (!wrap) return;
        const destSel = wrap.dest;
        // where the turn musters them (R-129, P1-11e19)
        whereTheCompaniesARecruitRaisesMuster(
          report,
          orders,
          o,
          ph,
          wrap.ticked.map((cb) => theFieldOrNoWords(cb.value)),
          destSel ? destSel.value : 'to:self',
          (x) => armies.get(x),
        ).toTheGarrison.forEach((u) => units.push(u));
      }
      const here = added.get(loc.id) ?? [];
      added.set(loc.id, here);
      here.push({ hero: o, units });
    });
  return added;
}
// The garrison of the province `provId` as the phase begins (from `garrisons`, the replay's, or the report), with what
// the phase's orders add to it (`added`) but those of the hero `excludeCharId`.
function theGarrisonAPickUpOfThePhaseSees(
  report: TheReportAsTheFormsForecastsReadIt,
  garrisons: ReadonlyMap<unknown, readonly ACompanyAsTheFormCarriesIt[]>,
  added: ReadonlyMap<unknown, readonly WhatAHeroAddsToAGarrison[]>,
  provId: unknown,
  excludeCharId: unknown,
): ACompanyAsTheFormCarriesIt[] {
  // (a garrison the replay holds is a list, never undefined: none held is a miss, as `has` read it)
  const garr = (garrisons.get(provId) ?? theGarrisonTheReportShows(report, provId)).slice();
  (added.get(provId) ?? []).forEach((by) => {
    if (String(by.hero.id) === String(excludeCharId)) return;
    by.units.forEach((a) => garr.push(a));
  });
  return garr;
}
// Each garrison once the phase `ph` is over: what its orders add (`added`), then what its Pick Ups take — only strictly
// earlier phases' pick-ups are replayed into a later phase (same-phase pick-ups race on initiative).
// The beasts a Pick Up takes past the leader's beast command go back to the end of the garrison (`goBack`, by province).
function theGarrisonsAfterAPhase(
  report: TheReportAsTheFormsForecastsReadIt,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  garrisons: Map<unknown, ACompanyAsTheFormCarriesIt[]>,
  added: ReadonlyMap<unknown, readonly WhatAHeroAddsToAGarrison[]>,
  ph: number,
  goBack: ReadonlyMap<unknown, readonly ACompanyAsTheFormCarriesIt[]>,
): void {
  // (a garrison held keeps its place in the map: set again, the same list)
  const garrisonOf = (provId: unknown) => {
    const held = garrisons.get(provId) ?? theGarrisonTheReportShows(report, provId);
    garrisons.set(provId, held);
    return held;
  };
  added.forEach((bys, provId) => {
    const garr = garrisonOf(provId);
    bys.forEach((by) => {
      by.units.forEach((a) => garr.push(a));
    });
  });
  const theHeroesAsTheirGuardReadsThem: readonly (AHeroAsTheFormsForecastsReadHim | null | undefined)[] =
    report.characters ?? [];
  theHeroesAsTheirGuardReadsThem
    .filter((x): x is AHeroAsTheFormsForecastsReadHim => Boolean(x && x.alive !== false))
    .forEach((o) => {
      const act = theFieldOrNoWords(theOrderField(orders, 'action', o.id, ph)?.value);
      if (act !== 'Pick Up Army') return;
      const loc = whereAHeroStandsAfterTheOrdersBefore(report, orders, o.id, ph);
      if (!loc) return;
      const tgt = theFieldOrNoWords(theOrderField(orders, 'target', o.id, ph)?.value);
      // the places the turn takes ("all", or each `g:N`), the last first (R-129, P1-11e19)
      const garr = garrisonOf(loc.id);
      // (its target, `|| ''`: words, or a value String reads as the rule's toString does)
      theGarrisonPlacesAPickUpTakes(String(tgt), garr.length).forEach((i) => garr.splice(i, 1));
    });
  goBack.forEach((beasts, provId) => {
    const garr = garrisonOf(provId);
    beasts.forEach((a) => garr.push(a));
  });
}

// ── 2026-09-24 (Toby): TRANSFER CHAINS ──────────────────────────────────────────────────────────
// projectedLedArmies used to take a `_depth` counter and refuse to recurse past `_depth<2`, added to stop "mutual
// transfers recursing forever". That worry was unfounded: a transfer always read the giver's companies with a STRICTLY
// SMALLER phase bound, so no cycle was possible. What the guard actually did was silently truncate legitimate chains —
// hand a company king → Bryn in Spring and Bryn → Cara in Early Summer and it projected; add Cara → Dain in Late Summer
// and the company VANISHED from every later form, so Dain could not be ordered to do anything with troops he would
// really be leading. The replay reads the giver's companies as the phase begins, so a chain of any length projects.
// The army list the character `char` is LEADING once the phase `prevPh` is over, from what each hero led as it began
// (`armies`): every order that adds or removes armies — Recruit and Pick Up (add), Leave/Transfer and Disband (remove).
// This is what the Leave/Transfer and Disband forms show, so an army handed off or disbanded in an earlier phase no
// longer appears, and one recruited or picked up earlier does. (predictedLocation already accounts for earlier moves /
// conquests, so the recipient and garrison-eligibility lists reflect where the character will actually be.) Armies
// TRANSFERRED to this character by ANOTHER of yours earlier this turn — a Leave/Transfer handed over, or a Recruit
// mustered "to:<this id>" — ARE projected in, through chains of any length (2026-09-24).
// Each company moves where the turn's rules send it (R-129, P1-11e19): a recruit, a hand-over and a Pick Up's beasts
// past a beast command, a garrison company or band, risen dead; the beasts his Pick Up can't take go into `goBack`.
function theCompaniesAHeroLeadsAfterAPhase(
  report: TheReportAsTheFormsForecastsReadIt,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  armies: ReadonlyMap<AHeroAsTheFormsForecastsReadHim, ACompanyAsTheFormCarriesIt[]>,
  garrisons: ReadonlyMap<unknown, readonly ACompanyAsTheFormCarriesIt[]>,
  added: ReadonlyMap<unknown, readonly WhatAHeroAddsToAGarrison[]>,
  char: AHeroAsTheFormsForecastsReadHim,
  prevPh: number,
  goBack: Map<unknown, ACompanyAsTheFormCarriesIt[]>,
): ACompanyAsTheFormCarriesIt[] {
  const charId = char.id;
  let led = (armies.get(char) ?? []).slice();
  const prevAction = theFieldOrNoWords(theOrderField(orders, 'action', charId, prevPh)?.value);
  const prevTarget = theFieldOrNoWords(theOrderField(orders, 'target', charId, prevPh)?.value);
  // armies gained FROM OTHER characters of yours earlier this turn — a Recruit mustered "to:<this
  // id>" or a Leave/Transfer handed to this character — project in too.
  (report.characters ?? []).forEach((o) => {
    if (o.id === charId) return;
    const oAct = theFieldOrNoWords(theOrderField(orders, 'action', o.id, prevPh)?.value);
    const oTgt = theFieldOrNoWords(theOrderField(orders, 'target', o.id, prevPh)?.value);
    if (oAct === 'Recruit Armies') {
      // The engine hires MERCENARIES first and appends native recruits after, so the projection
      // must use the same order or the Blood Offering S:/E: indices would point at the wrong
      // units.
      const toks = theWordsAFieldHolds(oTgt)
        .split(',')
        .map((t) => t.trim());
      const musters = whereTheCompaniesARecruitRaisesMuster(
        report,
        orders,
        o,
        prevPh,
        toks,
        toks.find((t) => t.startsWith('to:')) ?? 'to:self',
        (x) => armies.get(x),
      );
      if (musters.dest === char) musters.toTheColumn.forEach((u) => led.push(u));
    } else if (oAct === 'Leave/Transfer Army') {
      const oExtra = theFieldOrNoWords(theOrderField(orders, 'extra', o.id, prevPh)?.value);
      if (String(oExtra) !== String(charId)) return;
      const oArm = theCompaniesTheReplayGivesTheHeroOfId(report, armies, o.id);
      const handed: ACompanyAsTheFormCarriesIt[] = [];
      if (theWordsAFieldHolds(oTgt).split(',').includes('all')) oArm.forEach((a) => handed.push(a));
      else
        theWordsAFieldHolds(oTgt)
          .split(',')
          .filter(Boolean)
          .forEach((val) => {
            val = val.trim();
            const a = oArm.find((x) => ((x.unitName ?? '') || x.type) === val);
            if (a) handed.push(a);
          });
      whatAComradeTakesOfAHandOver(report, char, armies.get(char), handed).taken.forEach((a) => led.push(a));
    }
  });
  if (prevAction === 'Recruit Armies') {
    const wrap = theRecruitBoxesOf(orders, charId, prevPh);
    if (wrap) {
      // the default muster destination is still THIS character, but recruits sent to the province
      // garrison ("to:garrison") or handed to a friendly hero ("to:<id>") do NOT join this
      // character — so they must not show in this hero's projected led-army preview (that stale
      // display was what made garrison-bound units look as though they marched off with the
      // hero).
      const destSel = wrap.dest;
      const musters = whereTheCompaniesARecruitRaisesMuster(
        report,
        orders,
        char,
        prevPh,
        wrap.ticked.map((cb) => theFieldOrNoWords(cb.value)),
        destSel ? destSel.value : 'to:self',
        (x) => armies.get(x),
      );
      if (musters.dest === char) musters.toTheColumn.forEach((u) => led.push(u));
    }
  } else if (prevAction === 'Pick Up Army') {
    const ploc = whereAHeroStandsAfterTheOrdersBefore(report, orders, charId, prevPh);
    const pgarr = ploc ? theGarrisonAPickUpOfThePhaseSees(report, garrisons, added, ploc.id, charId) : []; // garrison as it stands at THAT phase
    // the places the turn takes, the last first, and the beasts past his beast command back to the garrison
    // (its target, `|| ''`: words, or a value String reads as the rule's toString does; each place one of the garrison's)
    const takenUp = theGarrisonPlacesAPickUpTakes(String(prevTarget), pgarr.length).map((i) =>
      theCompanyAsTheFormCarriesIt(theOneAt(pgarr, i), false),
    );
    const { taken, left } = theCompaniesALeaderTakesUpToHisBeastCommandsRoom(
      takenUp,
      theRoomHisBeastCommandLeaves(char, led),
      asTheReportShowsIt,
    );
    taken.forEach((a) => led.push(a));
    // (a company is taken up only where he stands: `left` holds none where `ploc` is none)
    if (left.length && ploc) goBack.set(ploc.id, [...(goBack.get(ploc.id) ?? []), ...left]);
  } else if (prevAction === 'Leave/Transfer Army' || prevAction === 'Disband Army') {
    let removed: ACompanyAsTheFormCarriesIt[] = [];
    if (prevTarget === 'all') {
      removed = led;
      led = [];
    } else
      theWordsAFieldHolds(prevTarget)
        .split(',')
        .filter(Boolean)
        .forEach((val) => {
          val = val.trim();
          const idx = led.findIndex((a) => ((a.unitName ?? '') || a.type) === val);
          if (idx >= 0) removed.push(...led.splice(idx, 1));
        });
    // handed to a comrade: the beasts past his beast command stay with the giver, at the end of his column
    const extra = prevAction === 'Leave/Transfer Army' ? theOrderField(orders, 'extra', charId, prevPh)?.value : '';
    const recipient =
      extra !== '' && extra != null && inWords(extra) !== '-1'
        ? (report.characters ?? []).find((x) => String(x.id) === inWords(extra))
        : null;
    if (recipient)
      whatAComradeTakesOfAHandOver(report, recipient, armies.get(recipient), removed).left.forEach((a) => led.push(a));
  }
  return led;
}
// The companies the replay gives the first hero of the report with the id `charId` (none if no hero has it).
function theCompaniesTheReplayGivesTheHeroOfId(
  report: TheReportAsTheFormsForecastsReadIt,
  armies: ReadonlyMap<AHeroAsTheFormsForecastsReadHim, ACompanyAsTheFormCarriesIt[]>,
  charId: unknown,
): ACompanyAsTheFormCarriesIt[] {
  const char = (report.characters ?? []).find((x) => x.id === charId);
  return char ? theColumnTheReplayGivesHim(armies, char) : [];
}

// Predict each character's item list at the given phase: the replay's (theItemsAPhasesOrdersHandOver).
export function whatAHeroCarriesAsAPhaseBegins(
  report: TheReportAsTheFormsForecastsReadIt | null | undefined,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  charId: unknown,
  upToPhaseExclusive: number,
): AnItemAHeroCarries[] {
  if (!report) return [];
  return theFormsReplayOfThePhasesBefore(report, orders, upToPhaseExclusive).items.get(String(charId)) ?? [];
}

// the unled GARRISON of a province at a given phase: the replay's as the phase begins (theGarrisonsAfterAPhase), with,
// when includeSamePhase is set (the Pick Up form), the leaves at `phase` itself by OTHER characters than excludeCharId.
export function whatAGarrisonHoldsAsAPhaseBegins(
  theReport: TheReportAsTheFormsForecastsReadIt | null | undefined,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  provId: unknown,
  phase: number,
  includeSamePhase: boolean | undefined,
  excludeCharId: unknown,
): ACompanyAsTheFormCarriesIt[] {
  const report = theReport ?? {};
  const replay = theFormsReplayOfThePhasesBefore(report, orders, phase);
  if (!includeSamePhase) {
    // (a garrison the replay holds is a list, never undefined: none held is a miss, as `has` read it)
    return (replay.garrisons.get(provId) ?? theGarrisonTheReportShows(report, provId)).slice();
  }
  const added = theCompaniesAPhasesOrdersAddToEachGarrison(report, orders, replay.armies, phase);
  return theGarrisonAPickUpOfThePhaseSees(report, replay.garrisons, added, provId, excludeCharId);
}

// the army list a character is LEADING at the start of a given phase: the replay's (theCompaniesAHeroLeadsAfterAPhase).
export function whatAHeroLeadsAsAPhaseBegins(
  theReport: TheReportAsTheFormsForecastsReadIt | null | undefined,
  orders: TheOrdersAsTheFormsForecastsReadThem,
  charId: unknown,
  upToPhaseExclusive: number,
): ACompanyAsTheFormCarriesIt[] {
  const report = theReport ?? {};
  const char = (report.characters ?? []).find((x) => x.id === charId);
  if (!char) return [];
  return theColumnTheReplayGivesHim(
    theFormsReplayOfThePhasesBefore(report, orders, upToPhaseExclusive).armies,
    char,
  ).slice();
}
