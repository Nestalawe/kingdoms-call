// The hostile-name harness (P0-19): the strings a staged game gives every player-chosen field, and the checks every
// rendered screen must pass. Screen tours (which page, which world, which screens) are in lib/screens.ts.
//
//   names('hostile')  (field, i) → the field's name and number, then every payload below, so one string tries them all
//                     and a leak says where it came from. Its .hostile is true: a tour then makes stored numbers hostile
//                     too;
//   names('ordinary') (field, i) → a plain name with apostrophes, accents or hyphens (no < or &, which now show as
//                     typed: the one change players can see). Used to show a converted page looks the same.
//   inspect(doc)      what a screen got wrong: a value that became an element (<img onerror>, <svg onload>, <b>, a
//                     <script>), a value that became code in a handler, or a handler that no longer parses.
// jsdom never loads images, so onerror never fires there; window.__kcPwned is only a real check in Chromium: the same
// tours with hostile names in Chromium are tests/browser/hostile-names.spec.ts.
//
// Each page's hostile-name tests in jsdom are lib/each-screen-of-a-pages-tour-shows-hostile-names-as-text-in-jsdom.ts's.
//
// Plain Node runs this file as it is (its types are stripped), so tests/tools/same-dom.js, run by hand, can require it:
// it uses only TypeScript that can be erased.
import * as acorn from 'acorn';

/** A name for each player-chosen field: names('hostile') gives every payload, names('ordinary') a plain name. */
export type Names = ((field: string, i?: number | string) => string) & { hostile?: boolean };

export const PAYLOADS = [
  `"><img src=x onerror="window.__kcPwned=1">`,
  `'><img src=x onerror='window.__kcPwned=1'>`,
  `<b data-kc-bold>bold</b>`,
  `Tom &amp; Jerry & <`,
  '`${window.__kcPwned=1}`',
  `');window.__kcPwned=1;//`,
  `\\" onmouseover="window.__kcPwned=1`,
  `</td></tr></table><svg onload="window.__kcPwned=1">`,
  `<script>window.__kcPwned=1</script>`,
];
export const ORDINARY = [
  "Ser Brann's Keep",
  'Élodie of Vær',
  'Mire-Hold',
  "The O'Rourke Marches",
  'Kaelith the Grey',
  'Dún Aisling',
  'Thornmere',
  "Warden's Rest",
  'Ashen Reach',
  'Lady Brígh of the Fens',
];

export function names(kind: 'hostile' | 'ordinary'): Names {
  if (kind === 'hostile')
    return Object.assign((field: string, i: number | string = 0) => `${field}${String(i)} ` + PAYLOADS.join(' '), {
      hostile: true,
    });
  let n = 0;
  const given = new Map<string, string>();
  // the same field and number always gets the same name, and different ones differ
  return (field: string, i: number | string = 0) => {
    const k = field + '#' + String(i);
    if (!given.has(k))
      given.set(k, `${ORDINARY[n % ORDINARY.length] ?? ''} ${String(Math.floor(n++ / ORDINARY.length) || '')}`.trim());
    return given.get(k) as string; // `as`: set just above when it wasn't there
  };
}

// True if the parsed handler reads or writes __kcPwned as code (a mention inside a string is fine: kcArg puts names there).
/** A node of acorn's syntax tree, as this walk reads it: its type, and every other field. */
type ATreeNode = Record<string, unknown> & { type?: unknown; name?: unknown };
const isATreeNode = (v: unknown): v is ATreeNode => typeof v === 'object' && v !== null;
function usesPwned(node: unknown): boolean {
  if (!isATreeNode(node) || typeof node.type !== 'string') return false;
  if (node.type === 'Identifier' && node.name === '__kcPwned') return true;
  for (const k of Object.keys(node)) {
    if (k === 'loc') continue;
    const v = node[k];
    if (Array.isArray(v) ? v.some(usesPwned) : isATreeNode(v) && typeof v.type === 'string' && usesPwned(v))
      return true;
  }
  return false;
}

export function inspect(doc: Document): string[] {
  const out: string[] = [];
  doc
    .querySelectorAll('img[onerror],svg[onload],[data-kc-bold]')
    .forEach((e) => out.push(`a value became an element: ${e.outerHTML.slice(0, 90)}`));
  doc.querySelectorAll('script').forEach((e) => {
    if (e.textContent.includes('__kcPwned')) out.push(`a value became a <script>: ${e.outerHTML.slice(0, 90)}`);
  });
  for (const e of doc.querySelectorAll('*')) {
    for (const a of e.attributes) {
      if (!/^on/i.test(a.name)) continue;
      let ast;
      try {
        ast = acorn.parse(a.value, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true });
      } catch (err) {
        out.push(
          `a handler doesn't parse: <${e.tagName.toLowerCase()} ${a.name}="${a.value.slice(0, 90)}">: ${(err as Error).message}`,
        );
        continue;
      }
      if (usesPwned(ast))
        out.push(`a value became code in a handler: <${e.tagName.toLowerCase()} ${a.name}="${a.value.slice(0, 90)}">`);
    }
  }
  return out;
}
