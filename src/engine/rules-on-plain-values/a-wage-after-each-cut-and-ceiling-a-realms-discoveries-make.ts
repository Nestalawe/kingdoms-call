// ── A wage after each cut and each ceiling a realm's discoveries make, under what each may save (plan P1-11e30) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). The discoveries' registry asks these with its effects (Early Winter's wages and the report's
// forecast); the treasury ledger asks them with the cuts, the ceilings and the room the report gives (R-134).

/** What one cut takes off a wage, and its own ceiling on what it saves (the caller's ceiling, given one, first). */
export interface ACutOfAWageAndItsOwnCeiling {
  readonly theGold: number;
  readonly itsOwnCeiling: number | undefined;
}

/** The wage a ceiling lets no hero be paid above, and its own ceiling on what it saves. */
export interface ACeilingOnAWageAndItsOwnCeiling {
  readonly theWagesCeiling: number;
  readonly itsOwnCeiling: number | undefined;
}

/** What each capped cut or ceiling has saved so far this collection, by its key: a Map, kept by the caller. */
export interface WhatEachCappedCutHasSaved<K> {
  get(theKey: K): number | undefined;
  set(theKey: K, saved: number): unknown;
}

/** A wage after each cut in turn: a cut never takes the wage below 1g, and is capped at `theCeiling` (or, given none,
 *  its own ceiling), what each has saved so far kept in `theAccount`. A cut of null reaches nothing. */
export function aWageAfterEachCut<K>(
  theCuts: readonly (readonly [theKey: K, theCut: ACutOfAWageAndItsOwnCeiling | null])[],
  theWage: number,
  theAccount: WhatEachCappedCutHasSaved<K>,
  theCeiling: number | null | undefined,
): number {
  let out = theWage;
  for (const [e, theCut] of theCuts) {
    if (theCut === null) continue;
    let cut = Math.min(theCut.theGold, out - 1);
    if (cut <= 0) continue;
    const lim = theCeiling ?? theCut.itsOwnCeiling;
    if (lim != null) {
      const u = Number(theAccount.get(e)) || 0;
      cut = Math.min(cut, lim - u);
      if (cut <= 0) continue;
      theAccount.set(e, u + cut);
    }
    out -= cut;
  }
  return out;
}

/** A hero's wage under each ceiling in turn, after the cuts: each cuts a wage above it down to it (never below 1g), the
 *  cut capped at `theCeiling` (or, given none, its own ceiling), what each has saved so far kept in `theAccount`. */
export function aWageUnderEachCeiling<K>(
  theCeilings: readonly (readonly [theKey: K, theCap: ACeilingOnAWageAndItsOwnCeiling | null])[],
  theWage: number,
  theAccount: WhatEachCappedCutHasSaved<K>,
  theCeiling: number | null | undefined,
): number {
  let w = theWage;
  for (const [e, theCap] of theCeilings) {
    if (theCap === null || w <= theCap.theWagesCeiling) continue;
    let cut = w - Math.max(1, theCap.theWagesCeiling);
    const lim = theCeiling ?? theCap.itsOwnCeiling;
    if (lim != null) {
      const u = Number(theAccount.get(e)) || 0;
      cut = Math.min(cut, lim - u);
      if (cut <= 0) continue;
      theAccount.set(e, u + cut);
    }
    w -= cut;
  }
  return w;
}

/** A hero's wage after his realm's discoveries: the cuts, then the ceilings, and never below 1g (discHeroWage). */
export function aHerosWageAfterTheCutsAndTheCeilings(
  theCutsLeave: (theWage: number) => number,
  theCeilingsLeave: (theWage: number) => number,
  theWage: number,
): number {
  return Math.max(1, theCeilingsLeave(theCutsLeave(theWage)));
}
