// The page's element with an id, of the kind the code reads it as (plan P1-16, Open choice 2): a page's typed code
// looks an element up through this, not with `document.getElementById(id)` and a `!` or an `as` (lint refuses both in
// `src/`). An element the page always holds is read through it, so a missing one still stops the handler there, as a
// property read on the `null` that getElementById gave did, and the error names the id. An element the code checks
// for (`if (!el) return;`) is still looked up with getElementById: its absence is a case the code meets.
// The DOM forms: docs/architecture/the-forms-that-keep-a-value-the-pages-elements-and-events.md.

/** The kind of element asked for: `HTMLElement`, `HTMLInputElement`, `HTMLSelectElement`, … (the page's own class). */
export type AKindOfElement<T extends Element> = abstract new () => T;

/** The element of `page` with the id `id`, of the kind `kind`. Throws a TypeError naming the id when the page holds no
 *  element with it, or holds one of another kind. `page` is the page's own document unless a test hands another. */
export function theElementWithTheId<T extends Element>(
  id: string,
  kind: AKindOfElement<T>,
  page: Pick<Document, 'getElementById'> = document,
): T {
  const found = page.getElementById(id);
  if (found === null) throw new TypeError(`the page holds no element with the id "${id}"`);
  if (!(found instanceof kind))
    throw new TypeError(
      `the page's element with the id "${id}" is a <${found.tagName.toLowerCase()}>, not of the kind asked for`,
    );
  return found;
}
