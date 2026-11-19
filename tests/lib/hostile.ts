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
// Plain Node runs this file as it is (its types are stripped), so the old JavaScript scripts in tests/*.test.js can
// require it: it uses only TypeScript that can be erased.
import * as acorn from 'acorn';
import { TOURS, runJsdom, type TourName } from './screens.ts';

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

// One page's hostile-name test: every mode and screen of its tour (lib/screens.ts) with hostile names, in jsdom: nothing
// becomes markup or code, no handler breaks, every staged name appears as text exactly as typed. Exits the process
// with the result. Its Chromium half (window.__kcPwned stays unset, with images really loading and failing) is
// tests/browser/hostile-names.spec.ts (P1-01c).
export async function hostileTest(tourName: TourName): Promise<void> {
  const tour = TOURS[tourName],
    W = tour.world(names('hostile'));
  let fails = 0;
  const check = (c: boolean, m: string) => {
    if (!c) {
      fails++;
      console.log('FAIL ' + m);
    } else console.log('ok   ' + m);
  };
  const seen = new Set<string>(),
    want = tour.shown(W).filter(Boolean) as string[]; // `as`: what's left once the empty ones are gone
  // A page that can't start (a mode with bootError) must say so; every other mode runs with no page error at all.
  const checkErrors = (mode: string, errs: string[]) => {
    if (tour.modes[mode]?.bootError)
      check(errs.length > 0, `${tour.page} (${mode}): the page fails to start, as staged`);
    else
      check(
        !errs.length,
        `${tour.page} (${mode}): no page errors` +
          (errs.length ? ': ' + ((errs[0] as string).split('\n')[0] as string) : ''),
      );
  };
  for (const mode of Object.keys(tour.modes)) {
    const errs = await runJsdom(tour, mode, W, (label, doc, w) => {
      const problems = inspect(doc);
      const pwned = !!w['__kcPwned'];
      w['__kcPwned'] = undefined;
      check(
        !problems.length && !pwned,
        `${tour.page} (${mode}) ${label}: names show as text` +
          (problems.length ? `: ${String(problems.length)} problem(s), e.g. ${String(problems[0])}` : ''),
      );
      const text = doc.body.textContent;
      want.forEach((s) => {
        if (text.includes(s)) seen.add(s);
      });
    });
    checkErrors(mode, errs);
  }
  const missing = want.filter((s) => !seen.has(s));
  check(
    !missing.length,
    `${tour.page}: each of the ${String(want.length)} staged names appears somewhere, exactly as typed` +
      (missing.length ? `; not found: ${missing.map((s) => s.split(' ')[0]).join(', ')}` : ''),
  );
  console.log(fails ? `\nFAILURES: ${String(fails)}` : '\n0 failures');
  process.exit(fails ? 1 : 0);
}
