import { TERROR_MAX_STACKS } from '../rules-on-plain-values/the-terror-an-evil-victory-leaves-its-share-a-stack-and-its-most-stacks.ts';
import type { Province } from '../../schemas/saved-game-state.ts';

// ── THE MARKS ON A PROVINCE (plan P1-19ay2) ────
// The three marks a realm's alignment leaves on a province, each read, laid, lifted and faded here, and each with its own
// wipe: consecrated ground (a Divine king's, kept on his realm: player.consecratedProvIds), wiped when its province
// changes hands or passes from the realm, and spent by a Divine return; Terror (an Evil victory's, on the province:
// _terrorStacks, _terrorTurn, _terrorisedBy, _terrorPct), spent at the next battle fought there (the trap "Terror is
// spent at battle start"); and Enslave (an Evil conquest's, on the province: _enslavedUntil), which fades with the turns.
// The fields stay where the save keeps them. This module writes state, so it is not in src/engine/rules/; the rows that
// say how much each mark gives are the alignment abilities' (src/content/alignment-abilities-…).

// ── CONSECRATED GROUND ──
/** A realm as consecration reads it: its alignment, and its consecrated provinces (an older save's single one the
 *  save's upgrade folds into the list first: plan P1-15f3). */
export interface ARealmAsConsecrationReadsIt {
  readonly alignment?: string | undefined;
  consecratedProvIds?: number[] | undefined;
}
// a Divine realm may hold MULTIPLE consecrated provinces — up to the king's White skill level, that many at any one
// time. Consecration is stored as a LIST (player.consecratedProvIds); this helper returns it (the save's upgrade folds a
// legacy single `consecratedProvId` into the list).
export function consecratedIds(pl: ARealmAsConsecrationReadsIt | null | undefined) {
  if (!pl) return [];
  // a new game's realm holds no list until its first read (an older save's single field: the upgrade folds it)
  if (!Array.isArray(pl.consecratedProvIds)) pl.consecratedProvIds = [];
  return pl.consecratedProvIds;
}
export function isConsecrated(pl: ARealmAsConsecrationReadsIt | null | undefined, provId: number) {
  return consecratedIds(pl).includes(provId);
}
// consecration is holy ground anyone can SEE (altars, standing stones), not a private fact of the
// owner. This tells us whether a province is consecrated by its CURRENT owner, so the map can mark
// it for every player who can see the province — not only the Divine king who blessed it.
export function provinceConsecrated(
  gs: { readonly players?: readonly ARealmAsConsecrationReadsIt[] | null | undefined } | null | undefined,
  prov: { readonly id: number; readonly owner?: number | null | undefined } | null | undefined,
) {
  if (prov?.owner == null) return false;
  const owner = gs?.players?.[prov.owner];
  return !!owner && isConsecrated(owner, prov.id);
}
/** Lays consecrated ground: the province joins the list its realm holds (Consecrate's outcome, its checks passed). */
export function layConsecratedGround(theList: number[], provId: number) {
  theList.push(provId);
}
/** Lifts one consecrated province from a realm's list (its capture, or a Divine return spending it). Whether it was
 *  there. */
export function liftConsecratedGround(pl: ARealmAsConsecrationReadsIt | null | undefined, provId: number) {
  const list = consecratedIds(pl);
  const at = list.indexOf(provId);
  if (at < 0) return false;
  list.splice(at, 1);
  return true;
}
/** Fades the consecrated ground a realm no longer holds: its list becomes the provinces it keeps (as the season
 *  closes). */
export function keepOnlyTheConsecratedGroundARealmHolds(pl: ARealmAsConsecrationReadsIt, kept: number[]) {
  pl.consecratedProvIds = kept;
}

// ── TERROR ──
/** A province as Terror reads and writes it. */
type AProvinceAsTerrorMarksIt = Pick<Province, '_terrorStacks' | '_terrorTurn' | '_terrorisedBy' | '_terrorPct'>;
/** Whether Terror grips a province for a realm: its stacks are there, laid by that realm. */
export function reignOfFearHere(prov: Province | null | undefined, playerIdx: number | null | undefined) {
  return !!(prov && playerIdx != null && (prov._terrorStacks || 0) > 0 && prov._terrorisedBy === playerIdx);
}
/** Whether Terror lingers on a province, waiting for the next battle fought there. */
export function terrorLingersOnAProvince<TheProvince extends AProvinceAsTerrorMarksIt>(
  prov: TheProvince,
): prov is TheProvince & { _terrorStacks: number; _terrorTurn: number } {
  return !(!prov._terrorStacks || prov._terrorTurn === undefined);
}
/** Lays a stack of Terror on a province (at most TERROR_MAX_STACKS), by a realm, this turn, at its share a stack. */
export function layATerrorStackOnAProvince(
  tp: AProvinceAsTerrorMarksIt,
  turn: number,
  byPlayer: number,
  theShareAStack: number,
) {
  tp._terrorStacks = Math.min(TERROR_MAX_STACKS, (tp._terrorStacks || 0) + 1);
  tp._terrorTurn = turn;
  tp._terrorisedBy = byPlayer;
  tp._terrorPct = theShareAStack;
}
/** Lifts the Terror from a province its own realm now holds, unspent (its share a stack is left as it is). */
export function liftTheTerrorFromAProvinceItsRealmHolds(prov: AProvinceAsTerrorMarksIt) {
  delete prov._terrorStacks;
  delete prov._terrorTurn;
  delete prov._terrorisedBy;
}
/** Spends the Terror on a province: the battle fought there has felt it. */
export function spendTheTerrorOnAProvince(prov: AProvinceAsTerrorMarksIt) {
  delete prov._terrorStacks;
  delete prov._terrorTurn;
  delete prov._terrorisedBy;
  delete prov._terrorPct;
}

// ── ENSLAVE ──
/** Lays Enslave on a province: it pays less until the turn given. */
export function enslaveAProvinceUntil(prov: Pick<Province, '_enslavedUntil'>, theLastTurn: number) {
  prov._enslavedUntil = theLastTurn;
}
/** Whether Enslave still holds a province on a turn (it fades once that turn is past its last). */
export function theEnslavedProvinceStillPaysLess(
  pv: { readonly _enslavedUntil?: number | null | undefined },
  turn: number,
) {
  return pv._enslavedUntil != null && pv._enslavedUntil >= turn;
}
