// A value of any kind (a game's state as parsed from JSON, a row's column the page holds as it came) read as JavaScript
// reads it: a field, `a || b`, whether it is a list, a list searched, a date made of it. The pages' typed code reads
// such values through these, not through a `!` or an `as` (lint refuses both in `src/`), so each read gives the value,
// or throws the error, the untyped read gave. The player page and the GM page both read them (plan P1-16p moved them
// here from `ui/player/game-lists.ts`). The forms:
// docs/architecture/the-forms-that-keep-a-value-guards-parameters-and-types.md.

/** `value[key]` as JavaScript reads it (a game's state as parsed from JSON): for none, the TypeError that read throws. */
export function theField(value: unknown, key: PropertyKey): unknown {
  if (value === null || value === undefined) {
    throw new TypeError(`Cannot read properties of ${String(value)} (reading '${String(key)}')`);
  }
  return Reflect.get(Object(value), key);
}
/** `a || b` on values of any kind (a game's state as parsed): `a` where it is truthy, else `b`. */
export function thisOrElse(a: unknown, b: unknown): unknown {
  if (a) return a;
  return b;
}
/** Whether a value is a list (of values of any kind). */
export function isAList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
/** A list a value of a game's state holds, as `.some` reads it: any other value throws the TypeError `.some` threw. */
export function theListToSearch(value: unknown): readonly unknown[] {
  if (isAList(value)) return value;
  throw new TypeError('the value searched is not a list');
}
/** `new Date(value)` on a value of any kind (a deadline as a game's state holds it), as the constructor reads it. */
export function theDateOf(value: unknown): Date {
  const made: unknown = Reflect.construct(Date, [value]);
  if (made instanceof Date) return made;
  throw new TypeError('the Date constructor made no date');
}
