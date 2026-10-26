// ── Where a saved game differs from this build's schema (plan P1-15d, Decision 4) ────
// The check of a saved game at load: the save, once upgraded (src/engine/saves/upgrade-a-saved-game-and-check-it.ts),
// parsed against the saved state's schema made strict (the-strict-version-of-a-schema.ts), so a key the schema doesn't
// know is found, not dropped. Each place it differs is named by its path and its kind, one line each:
//   characters.17.armies.2: a field this build doesn't know, _flakTargeted
//   players.0.heroOrder: not the kind of value this build expects (array)
// and never by a value, so no name or text from a game leaves the save; a path's step or a key that isn't a number or
// a name as code writes one (it could be a game's own text, a name a player chose) is shown as "(a key)".
// **The check is not the save** (docs/traps.md): the parse's output, a copy without the keys the schema doesn't name, is
// never used; the turn plays the save it upgraded, every key kept. How a difference is met is Theo's Choice 1 (tell
// now, stop later): the turn runs, and the GM's log and the turn's message name each place.
// This is the one file of src/schemas/ that src/ imports for its code (the save's upgrade imports it): the GM page's
// bundle holds the schemas and Zod; every other import of src/schemas/ is a type's (.dependency-cruiser.mts,
// tests/static/pages-build.test.ts).
import { z } from 'zod';
import { GameStateSchema } from './saved-game-state.ts';
import { strictVersionOf } from './the-strict-version-of-a-schema.ts';

/** A name as code writes one (a field's name, a mark's): a letter, `_` or `$` first, then letters, digits, `_` or `$`. */
const A_NAME_AS_CODE_WRITES_ONE = /^[A-Za-z_$][\w$]{0,63}$/;

/** A path's step or a key, as the GM may read it: a number, a name as code writes one, else "(a key)". */
const asTheGmMayReadIt = (step: PropertyKey): string =>
  typeof step === 'number'
    ? String(step)
    : typeof step === 'string' && A_NAME_AS_CODE_WRITES_ONE.test(step)
      ? step
      : '(a key)';

/** Whether the save holds something at `path` (to tell a missing field from one of another kind; its value is not read
 *  beyond that). */
function holdsSomethingAt(save: unknown, path: readonly PropertyKey[]): boolean {
  let here: unknown = save;
  for (const step of path) {
    if (typeof here !== 'object' || here === null || !(step in here)) return false;
    const next: unknown = Reflect.get(here, step);
    here = next;
  }
  return here !== undefined;
}

/** One place the save differs from the schema, as lines: the path, then the kind (one line per key this build doesn't
 *  know). */
function linesOf(issue: z.core.$ZodIssue, save: unknown): string[] {
  const path = issue.path.length ? issue.path.map(asTheGmMayReadIt).join('.') : '(the save itself)';
  switch (issue.code) {
    case 'unrecognized_keys':
      return issue.keys.map((key) => `${path}: a field this build doesn't know, ${asTheGmMayReadIt(key)}`);
    case 'invalid_type':
      return [
        holdsSomethingAt(save, issue.path)
          ? `${path}: not the kind of value this build expects (${issue.expected})`
          : `${path}: missing, and this build needs it`,
      ];
    case 'invalid_union':
      return [`${path}: none of the shapes this build knows`];
    case 'invalid_value':
      return [`${path}: a value this build doesn't know`];
    case 'too_big':
    case 'too_small':
      return [`${path}: out of the range this build expects`];
    case 'invalid_format':
    case 'not_multiple_of':
    case 'invalid_key':
    case 'invalid_element':
    case 'custom':
      return [`${path}: not what this build expects (${issue.code})`];
  }
}

/** Where `save` differs from the saved state's schema made strict: one line each, the path and the kind, never a value
 *  (none if it matches). It doesn't change the save, and its parse's output is never used. */
export function whereASavedGameDiffersFromThisBuildsSchema(save: unknown): string[] {
  const result = z.safeParse(strictVersionOf(GameStateSchema), save);
  return result.success ? [] : result.error.issues.flatMap((issue) => linesOf(issue, save));
}
