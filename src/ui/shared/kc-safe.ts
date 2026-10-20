// kc-safe.ts: the one way a page builds HTML from data (P0-19). Each page that builds HTML loads it straight after its
// boot-failure reporter, before anything else.
//
//   kcHtml`<td>${v}</td>`  HTML in which every value is shown as text (kcEsc), unless it is itself kcHtml or kcRaw. A list
//                          is its items, one after another. Returns a marked value: put it in innerHTML, or inside another
//                          kcHtml; never join it with + or .join(), which makes it a plain string that would be escaped again.
//   kcEsc(v)               v as text, safe in HTML text and in a quoted attribute; null and undefined are ''.
//   kcRaw(s)               markup passed through unchanged. Only for markup no player can have written: each use says why.
//   kcArg(v)               v as an argument inside an on…="…" handler: kcHtml`<button onclick="openGame(${kcArg(id)})">`.
//
// These four are the whole interface, and they don't change: a page cached for a few minutes after a deploy may meet an
// older copy of this file. A change that must happen gets a ?v= stamp on every page's <script src> tag
// (docs/traps.md, "HTML is built only through kcHtml").
export function kcEsc(v) {
  return String(v == null ? '' : v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
export class KcSafeHtml {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
export function kcRaw(s) {
  return new KcSafeHtml(String(s == null ? '' : s));
}
export function kcHtml(strings, ...values) {
  const show = (v) => (v instanceof KcSafeHtml ? v.s : Array.isArray(v) ? v.map(show).join('') : kcEsc(v));
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += show(values[i]) + strings[i + 1];
  return new KcSafeHtml(out);
}
// JSON is a JavaScript value; escaping it lets it sit inside the attribute, which the browser unescapes before running it.
export function kcArg(v) {
  return new KcSafeHtml(kcEsc(JSON.stringify(v === undefined ? null : v)));
}
