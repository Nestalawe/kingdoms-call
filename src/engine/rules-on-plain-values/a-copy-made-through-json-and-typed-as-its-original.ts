// ── A copy made through JSON, typed as its original (plan P1-10b41: moved from the lair guardians' file) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). The Hunting Rumours fight and the bots' duel forecast both copy a hero through JSON.

/** A copy of `value` made through JSON, as the Hunting Rumours fight on: the copy has the original's type once
 *  `itsJsonIsTheOriginals` has found its JSON the same as the original's (Theo's form, 2026-10-30, plan P1-10b14). */
export function aCopyMadeThroughJson<Value>(value: Value): Value {
  const copy: unknown = JSON.parse(JSON.stringify(value));
  if (!itsJsonIsTheOriginals(copy, value)) throw new Error('a copy made through JSON differs from its original');
  return copy;
}
/** Whether a copy's JSON is its original's: the check that types a copy made through JSON as its original. */
function itsJsonIsTheOriginals<Value>(copy: unknown, original: Value): copy is Value {
  return JSON.stringify(copy) === JSON.stringify(original);
}
