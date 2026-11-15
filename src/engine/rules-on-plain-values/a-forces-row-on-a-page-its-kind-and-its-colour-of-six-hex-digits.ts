// ── A force's row on a page: its kind, and its colour of six hex digits (the player portal's Chronicle and the GM page's
// log) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a).
// A battle's force drawn up is a line whose words are the record the pages draw as the force's rows. A realm's report
// carries its kind on that line alone, and the GM's log on every line; a page draws a force's rows by that kind alone,
// and a line without it as its words, whatever they open with. The force's colour is a realm's colour as the game deals
// it (REALM_COLOURS), six hex digits after `#`; a page reads it through aColourOfSixHexDigitsOrNone, and a value of any
// other form is none: the page draws the force in its default grey.

/** The kind of a force drawn up for battle, as a realm's report and the GM's log store it beside the line (the views
 *  name it THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE, checked against the line facts' kinds). */
export const THE_KIND_A_FORCES_ROW_CARRIES = 'a force drawn up for battle';

/** `value` when it is a colour of six hex digits (`#rrggbb`, small or capital letters), else none. */
export function aColourOfSixHexDigitsOrNone(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}
