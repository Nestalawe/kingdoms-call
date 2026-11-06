// kc-safe.ts: the one way a page builds HTML from data (P0-19). Each page's entry imports it first, before its other
// files.
//
//   kcHtml`<td>${v}</td>`  HTML in which every value is shown as text (kcEsc), unless it is itself kcHtml or kcRaw. A list
//                          is its items, one after another. Returns a marked value: put it in innerHTML, or inside another
//                          kcHtml; never join it with + or .join(), which makes it a plain string that would be escaped again.
//   kcEsc(v)               v as text, safe in HTML text and in a quoted attribute; null and undefined are ''.
//   kcRaw(s)               markup passed through unchanged. Only for markup no player can have written: each use says why.
//   kcArg(v)               v as an argument inside an on…="…" handler: kcHtml`<button onclick="openGame(${kcArg(id)})">`.
//
// These four are the whole interface. Each page's bundle holds its own copy of this file (P1-09d) and is named by a hash
// of its content (P1-06b), so a page always runs the copy it was built with: a change reaches every page at the deploy
// that ships it, with no stamp on a <script src> tag (docs/traps.md, "HTML is built only through kcHtml").
export function kcEsc(v: unknown): string {
  const shown: unknown = typeof v === 'undefined' || v === null ? '' : v;
  return String(shown).replace(/[&<>"']/g, (c) =>
    String({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
export class KcSafeHtml {
  readonly s: string;
  constructor(s: string) {
    this.s = s;
  }
  toString(): string {
    return this.s;
  }
}
export function kcRaw(s: unknown): KcSafeHtml {
  const shown: unknown = typeof s === 'undefined' || s === null ? '' : s;
  return new KcSafeHtml(String(shown));
}
export function kcHtml(strings: TemplateStringsArray, ...values: unknown[]): KcSafeHtml {
  const show = (v: unknown): string =>
    v instanceof KcSafeHtml ? v.s : Array.isArray(v) ? v.map(show).join('') : kcEsc(v);
  let out = String(strings[0]);
  for (let i = 0; i < values.length; i++) out += show(values[i]) + String(strings[i + 1]);
  return new KcSafeHtml(out);
}
// JSON is a JavaScript value; escaping it lets it sit inside the attribute, which the browser unescapes before running it.
export function kcArg(v: unknown): KcSafeHtml {
  return new KcSafeHtml(kcEsc(JSON.stringify(v === undefined ? null : v)));
}
