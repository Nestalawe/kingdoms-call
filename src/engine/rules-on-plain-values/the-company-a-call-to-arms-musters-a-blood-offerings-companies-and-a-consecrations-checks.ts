// ── The company a Call to Arms musters, a Blood Offering's companies and a Consecration's checks (plan P1-11e22) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). Three creed orders' rules, moved as they were from their resolvers (Call to Arms and Consecrate
// in src/engine/orders/realm-works-orders-…ts, the Blood Offering in src/engine/orders/explore-and-search-orders-…ts),
// so the order form's notes can later ask the turn's own: the company a Call to Arms musters in a province; the
// companies a Blood Offering may take, and the ones it gives and raises; and why a king may not consecrate a province.
// The consecrations a king may hold read the discoveries' registry, so they stay engine side
// (theConsecrationsAKingMayHold, in heroes/fame-and-consecration.ts), as the Wild Hunt's term does
// (theTurnsAWildHuntServesBeyondThisOne, in items/tiers-and-hoards.ts): the report names both (plan P1-11e24).
import type { AUnitAsItsRealmSeesIt } from './beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';

/** A province as a Call to Arms reads it: the companies its folk raise (its pool of types) and its folk's race. */
export interface AProvinceAsACallToArmsReadsIt {
  readonly armyTypes?: readonly string[] | null | undefined;
  readonly race?: string | null | undefined;
}
/** The company a Call to Arms musters: its type and its race (its grade is the order's, a discovery's chance rolled). */
export interface TheCompanyACallToArmsMusters {
  readonly type: string;
  readonly race: string;
}
/** The company a Call to Arms musters in a province of the realm: the first garrison type of the province's own pool
 *  (Elven Bowmen), else its race's garrison, else a plain levy (Human Garrison); its race the province's, else Human. */
export function theCompanyACallToArmsMusters(ctaProv: AProvinceAsACallToArmsReadsIt): TheCompanyACallToArmsMusters {
  const GARRISON_BY_RACE_CTA: Readonly<Partial<Record<string, string>>> = {
    Human: 'Human Garrison',
    Elven: 'Elven Garrison',
    Dwarven: 'Dwarf Garrison',
    Orcish: 'Orc Garrison',
  };
  const ctaType =
    ((ctaProv.armyTypes ?? []).find((t) => t.toLowerCase().includes('garrison')) ?? '') ||
    (GARRISON_BY_RACE_CTA[String(ctaProv.race)] ?? '') ||
    'Human Garrison';
  return { type: ctaType, race: (ctaProv.race ?? '') || 'Human' };
}

/** Whether a Blood Offering may take a company, to give or to raise: one borrowed for a while (summoned, charmed), a
 *  Wild Hunt beast or a skeleton can be neither offered nor raised. */
export function aBloodOfferingMayTakeTheCompany(a: AUnitAsItsRealmSeesIt): boolean {
  return !a.temporary && !a.wildHunt && !a.skeletal;
}
/** The companies a Blood Offering gives and raises, each by its place in the column, one raised for each given. */
export interface TheCompaniesABloodOfferingGivesAndRaises {
  readonly given: readonly number[];
  readonly raised: readonly number[];
}
/** The companies a Blood Offering gives and raises (each raised two tiers, capped at Elite). The player names them in
 *  the order's marks, "S:i,j|E:a,b": places in the column, the ones it may take, each once, none both. With a side
 *  named empty (or no marks, an older form's), the first company it may take is given and the second raised; with
 *  fewer than two, no offering (null). Each given raises one: the longer side is cut to the shorter. A company is read
 *  as its realm sees it (`seenAs`: the engine hands unitAsItsRealmSeesIt); a gap in the column is never taken. */
export function theCompaniesABloodOfferingGivesAndRaises<TheCompany>(
  _army: readonly TheCompany[],
  extra: string,
  seenAs: (company: TheCompany) => AUnitAsItsRealmSeesIt,
): TheCompaniesABloodOfferingGivesAndRaises | null {
  const _bOffElig = (i: number) => {
    const a = _army[i];
    return !!a && aBloodOfferingMayTakeTheCompany(seenAs(a));
  };
  let _sacI: number[] = [],
    _benI: number[] = [];
  const _bm = /S:([0-9,]*)\|E:([0-9,]*)/.exec((extra || '').trim());
  if (_bm) {
    _sacI = [
      ...new Set(
        String(_bm[1]) // the group always takes part in a match (its words, '' for none)
          .split(',')
          .filter((x) => x !== '')
          .map(Number),
      ),
    ].filter((i) => Number.isInteger(i) && _bOffElig(i));
    _benI = [
      ...new Set(
        String(_bm[2])
          .split(',')
          .filter((x) => x !== '')
          .map(Number),
      ),
    ].filter((i) => Number.isInteger(i) && _bOffElig(i) && !_sacI.includes(i));
  }
  // Legacy/no-selection fallback: sacrifice one own unit to raise one other by two tiers.
  if (_sacI.length === 0 || _benI.length === 0) {
    const _own = _army.map((a, i) => i).filter(_bOffElig);
    if (_own.length >= 2) {
      _sacI = _own.slice(0, 1); // the first, as [_own[0]]
      _benI = _own.slice(1, 2); // the second, as [_own[1]]
    } else return null;
  }
  const _bn = Math.min(_sacI.length, _benI.length); // each sacrifice funds exactly one empowerment
  return { given: _sacI.slice(0, _bn), raised: _benI.slice(0, _bn) };
}

/** Why a king may not consecrate the province he stands in, each check in the turn's order. */
export type WhyAKingMayNotConsecrateAProvince<TheList extends readonly number[]> =
  | { readonly refused: 'it is not a province of his realm' }
  | { readonly refused: 'it lies in the home marches' }
  | { readonly refused: 'it is consecrated already' }
  | { readonly refused: 'a consecrated province lies beside it'; readonly theNeighbourId: number }
  | { readonly refused: 'he knows no White' }
  | { readonly refused: 'he holds as many as he may'; readonly theConsecrated: TheList; readonly theLimit: number }
  | { readonly refused: null; readonly theConsecrated: TheList; readonly theLimit: number };
/** The facts a Consecration's checks read, each asked only once the checks before it have passed (as the turn asks
 *  them: the realm's home may be fixed by asking, and an older save's single consecration folded into its list). */
export interface TheFactsAConsecrationsChecksRead<TheList extends readonly number[]> {
  /** The province he stands in: its id, and whether it is his realm's. */
  readonly theProvinceId: number;
  readonly itIsHisRealms: boolean;
  /** The realm's home province (none for a realm without one) and the provinces beside it. */
  readonly theHomeMarches: () => {
    readonly theHomeId: number | null;
    readonly theProvincesBesideIt: readonly number[];
  };
  /** The provinces the realm holds consecrated (the list the turn adds to). */
  readonly theConsecrated: () => TheList;
  /** The provinces beside the one he stands in. */
  readonly theProvincesBesideIt: () => readonly number[];
  /** The consecrations he may hold at once (theConsecrationsAKingMayHold). */
  readonly theConsecrationsHeMayHold: () => number;
}
/** Why a king may not consecrate the province he stands in, or (refused: null) that he may: it must be his realm's;
 *  not his home or beside it (the home marches were anointed at the coronation); not consecrated already; beside no
 *  consecrated province (holy ground is spread across the realm); and he must know White, and hold fewer than he may.
 *  The answer carries what the turn's lines name: the consecrated neighbour, the list and the limit. */
export function whyAKingMayNotConsecrateAProvince<TheList extends readonly number[]>(
  facts: TheFactsAConsecrationsChecksRead<TheList>,
): WhyAKingMayNotConsecrateAProvince<TheList> {
  if (!facts.itIsHisRealms) return { refused: 'it is not a province of his realm' };
  const { theHomeId: _homeId, theProvincesBesideIt } = facts.theHomeMarches();
  const _homeAdj = new Set(theProvincesBesideIt);
  if (facts.theProvinceId === _homeId || _homeAdj.has(facts.theProvinceId))
    return { refused: 'it lies in the home marches' };
  const _cList = facts.theConsecrated();
  if (_cList.includes(facts.theProvinceId)) return { refused: 'it is consecrated already' };
  // holy ground must be spread across the realm — two consecrated provinces may not lie side
  // by side. Reject if any neighbour of this province is already consecrated.
  const _provAdjC = new Set<number>(facts.theProvincesBesideIt());
  const _adjConsecId = _cList.find((id) => _provAdjC.has(id));
  if (_adjConsecId != null) return { refused: 'a consecrated province lies beside it', theNeighbourId: _adjConsecId };
  // the crown may hold up to its WHITE skill level in consecrated provinces at once.
  const _cLimit = facts.theConsecrationsHeMayHold();
  if (_cLimit <= 0) return { refused: 'he knows no White' };
  if (_cList.length >= _cLimit)
    return { refused: 'he holds as many as he may', theConsecrated: _cList, theLimit: _cLimit };
  return { refused: null, theConsecrated: _cList, theLimit: _cLimit };
}
