// Same for ordinary names (P0-19): renders every screen of a page's tour (tests/lib/screens.ts) with ordinary names
// (apostrophes, accents, hyphens) on two copies of the site, and says whether each screen's DOM is the same. A proof run
// by hand for a pull request that converts a page to kcHtml, with its output in the PR; not part of npm test (it compares
// against another copy of the site, which CI doesn't have). Plain Node runs it as it is (its types are stripped).
//
//   git archive main site | tar -x -C /tmp/main      # main's site, as a folder
//   node tests/tools/same-dom.ts /tmp/main/site                      # main against this branch, every tour
//   node tests/tools/same-dom.ts /tmp/main/site site leaderboard     # one tour
//
// The DOM is compared as parsed, so text escaped differently but read the same (' or &#39;) counts as the same. Ignored:
// script and style contents, build stamps (v2026.10.16-1200, with or without the v) and the footers' build lines that replaced
// them (P1-06c: "· build 3f2a9c1 · 22 Oct 2026, 10:15", "· build unknown"), and how a string passed to a handler is
// quoted (kcArg writes "O'Rourke" where the old code wrote 'O\'Rourke': each string in a handler is compared by its value).
// Exits 1 if any screen differs.
import path from 'node:path';
import * as acorn from 'acorn';
import { TOURS, runJsdom, type TourName } from '../lib/screens.ts';
import { names } from '../lib/hostile.ts';

const [before, after = 'site', ...only] = process.argv.slice(2);
const STAMP = /v?\d{4}\.\d{2}\.\d{2}-\d{4}/g;
// A footer's build line (tools/build.ts) reads as the stamp it replaced: "GM Portal · build 3f2a9c1 · …" as "GM Portal v<stamp>".
const BUILD_LINE = / · build (?:[0-9a-f]{7}(?: · \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2})?|unknown|dev)/g;
const unstamped = (text: string): string => text.replace(BUILD_LINE, ' v<stamp>').replace(STAMP, 'v<stamp>');

// A handler's code with every string written the same way (JSON), so only what it does is compared. Code that doesn't
// parse is left as it is.
function sameQuotes(code: string): string {
  try {
    const out: string[] = [];
    // acorn's Token type leaves out the value every token holds (a string token's is its string)
    for (const t of acorn.tokenizer(code, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }))
      out.push(t.type.label === 'string' && 'value' in t ? JSON.stringify(t.value) : code.slice(t.start, t.end));
    return out.join(' ');
  } catch {
    return code;
  }
}

const isText = (n: Node): n is Text => n.nodeType === 3;
const isElement = (n: Node): n is Element => n.nodeType === 1;

// One line per element and text, in document order; attributes sorted.
function lines(node: Node, depth = 0, out: string[] = []): string[] {
  const pad = '  '.repeat(depth);
  for (const c of node.childNodes) {
    if (isText(c)) {
      // a text of only spaces and line breaks is left out, but not one holding a no-break space (&nbsp;), which trim() drops
      if (c.data.trim() || c.data.includes('\u00a0')) out.push(pad + JSON.stringify(unstamped(c.data)));
      continue;
    }
    if (!isElement(c)) continue;
    const tag = c.tagName.toLowerCase();
    const attrs = [...c.attributes]
      .map((a) => {
        let v = unstamped(a.value);
        if (/^on/i.test(a.name)) v = sameQuotes(v);
        return `${a.name}=${JSON.stringify(v)}`;
      })
      .sort();
    out.push(`${pad}<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`);
    if (tag !== 'script' && tag !== 'style') lines(c, depth + 1, out);
  }
  return out;
}

const isATourName = (t: string): t is TourName => Object.hasOwn(TOURS, t);

interface Shot {
  label: string;
  lines: string[];
}

async function compareEveryScreen(beforeSite: string): Promise<number> {
  let differ = 0,
    screens = 0;
  const tours = only.length ? only : Object.keys(TOURS);
  for (const t of tours) {
    if (!isATourName(t)) {
      console.log(`no tour "${t}"; there are: ${Object.keys(TOURS).join(', ')}`);
      return 2;
    }
    const tour = TOURS[t];
    const W = tour.world(names('ordinary'));
    for (const mode of Object.keys(tour.modes)) {
      const shots: Record<'before' | 'after', Shot[]> = { before: [], after: [] };
      const sides: ['before' | 'after', string][] = [
        ['before', beforeSite],
        ['after', after],
      ];
      for (const [side, site] of sides) {
        const errs = await runJsdom(
          tour,
          mode,
          W,
          (label, doc) => {
            shots[side].push({ label, lines: lines(doc.body) });
          },
          { site: path.resolve(site) },
        );
        if (errs.length)
          console.log(`  (${side}: ${String(errs.length)} page error(s), e.g. ${errs[0]?.split('\n')[0] ?? ''})`);
      }
      shots.before.forEach((b, i) => {
        const a = shots.after[i];
        if (!a) throw new Error(`${tour.page} (${mode}): the after site showed fewer screens than ${String(i + 1)}`);
        screens++;
        const n = Math.max(b.lines.length, a.lines.length);
        let at = -1;
        for (let k = 0; k < n; k++)
          if (b.lines[k] !== a.lines[k]) {
            at = k;
            break;
          }
        if (at < 0) {
          console.log(`same       ${tour.page} (${mode}) ${b.label}: ${String(b.lines.length)} nodes`);
          return;
        }
        differ++;
        console.log(`DIFFERENT  ${tour.page} (${mode}) ${b.label}, from node ${String(at + 1)}:`);
        console.log('   before: ' + (b.lines[at] ?? '(nothing)').trim().slice(0, 220));
        console.log('   after:  ' + (a.lines[at] ?? '(nothing)').trim().slice(0, 220));
      });
    }
  }
  console.log(
    differ
      ? `\n${String(differ)} of ${String(screens)} screens differ`
      : `\nall ${String(screens)} screens are the same`,
  );
  return differ ? 1 : 0;
}

if (!before) {
  console.log('usage: node tests/tools/same-dom.ts <before-site> [<after-site>] [tour…]');
  process.exit(2);
}
process.exit(await compareEveryScreen(before));
