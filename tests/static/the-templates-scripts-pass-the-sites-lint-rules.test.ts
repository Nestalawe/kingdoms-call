// The templates' own code passes the site's lint rules (plan P1-13, Decision 8). A page's template (src/*.html) holds
// classic code ESLint's command line doesn't read: its inline <script> (the boot-failure reporter) and its on…="…"
// handler attributes. This test hands each piece to ESLint's API as src/<template>/script-<n>.js or handler-<n>.js,
// which eslint.config.js gives the block public/'s classic scripts get: ESLint's recommended rules, no Math.random
// (the dice come from kcRng()), and the project's own rules (tools/eslint-rules/: no random or argument-less sort
// comparator; the big tables and profiles read by named columns; HTML built only through kcHtml). A handler may call the names its page puts on
// window for its handlers, and its declared globals (src/ui/<page>/globals.ts; tests/static/page-globals.test.ts keeps
// those exact), and `event`. ESLint's API doesn't read eslint-suppressions.json, so every piece must be clean: none
// is suppressed. It took over the templates from tests/sort-comparators.test.js, tests/static/dice-and-clock.test.ts and
// tests/html-lint.test.js.
// Level 0 (static): it reads the templates and lints their text; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { ESLint, type Linter } from 'eslint';
import { describe, expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import { declaredGlobals, globalsLists, SCRIPT_PAGE_NAMES } from '../lib/page-globals.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const SRC = path.join(ROOT, 'src');
const TEMPLATES = fs
  .readdirSync(SRC)
  .filter((f) => f.endsWith('.html'))
  .sort();

interface Piece {
  /** src/<template>/script-<n>.js or handler-<n>.js: the name ESLint lints it under. */
  file: string;
  /** The template's line it starts on. */
  line: number;
  code: string;
}

// The entities an attribute may hold; any other fails, so a new one is decoded here rather than read wrongly.
const ENTITIES: Record<string, string> = { '&quot;': '"', '&#39;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>' };
const decoded = (value: string, where: string): string =>
  value.replace(/&[#\w]+;/g, (e) => {
    const c = ENTITIES[e];
    if (c === undefined) throw new Error(`${where}: an entity this test doesn't decode: ${e}`);
    return c;
  });

/** A template's classic code: each inline <script> (one with no src and no type), then each on…="…" attribute outside
 *  the styles and comments, in order: in the markup, and in the HTML an inline script writes (its strings). */
function piecesOf(template: string, html: string): Piece[] {
  const lineAt = (i: number) => html.slice(0, i).split('\n').length;
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  const scripts: Piece[] = [];
  const markup = html.replace(/<!--[\s\S]*?-->/g, blank).replace(/<style\b[\s\S]*?<\/style>/gi, blank);
  for (const m of markup.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (/\b(src|type)\s*=/i.test(m[1] ?? '')) continue;
    scripts.push({
      file: `src/${template}/script-${String(scripts.length + 1)}.js`,
      line: lineAt(m.index + m[0].indexOf('>') + 1),
      code: m[2] ?? '',
    });
  }
  const handlers: Piece[] = [];
  for (const m of markup.matchAll(/\son[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const where = `src/${template}:${String(lineAt(m.index))}`;
    handlers.push({
      file: `src/${template}/handler-${String(handlers.length + 1)}.js`,
      line: lineAt(m.index),
      code: decoded(m[1] ?? m[2] ?? '', where),
    });
  }
  return [...scripts, ...handlers];
}

/** What a handler may call on its page: the names its globals.ts puts on window for handlers, its declared globals,
 *  and the event. */
function handlerGlobals(template: string): Linter.Globals {
  const globals: Linter.Globals = { event: 'readonly' };
  const page = SCRIPT_PAGE_NAMES.find((p) => p === template);
  if (page === undefined) return globals;
  for (const { name } of globalsLists(page).handlers) globals[name] = 'readonly';
  for (const name of declaredGlobals(page).keys()) globals[name] = 'writable';
  return globals;
}

/** Each finding of ESLint in the template's pieces, as "<template>:<line> <piece> <rule>". */
async function findingsIn(template: string, html: string): Promise<string[]> {
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfig: { files: ['src/*.html/handler-*.js'], languageOptions: { globals: handlerGlobals(template) } },
  });
  const found: string[] = [];
  for (const piece of piecesOf(template, html)) {
    const [result] = await eslint.lintText(piece.code, { filePath: path.join(ROOT, piece.file) });
    for (const m of result?.messages ?? [])
      found.push(
        `src/${template}:${String(piece.line + m.line - 1)} ${path.basename(piece.file)} ${m.ruleId ?? m.message}`,
      );
  }
  return found;
}

const read = (template: string) => fs.readFileSync(path.join(SRC, template), 'utf8');

describe("the templates' scripts and handlers pass the site's lint rules", () => {
  test("each script page's template has its inline script and its handlers; the others have none", () => {
    const counts = Object.fromEntries(
      TEMPLATES.map((t) => {
        const pieces = piecesOf(t, read(t));
        const scripts = pieces.filter((p) => p.file.includes('/script-')).length;
        return [t, { scripts, handlers: pieces.length - scripts }];
      }),
    );
    for (const t of TEMPLATES) {
      const page = (SCRIPT_PAGE_NAMES as readonly string[]).includes(t);
      expect(counts[t]?.scripts, t).toBe(page ? 1 : 0);
      expect((counts[t]?.handlers ?? 0) > 0, t).toBe(page);
    }
  });

  test("a piece gets the block public/'s classic scripts get", async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const configOf = async (file: string) =>
      (await eslint.calculateConfigForFile(path.join(ROOT, file))) as Linter.Config;
    const classic = await configOf('public/kc-staging-footer.js');
    const options = classic.languageOptions as { sourceType?: string };
    expect(options.sourceType).toBe('script');
    for (const rule of [
      'kc/no-random-or-argument-less-sort-comparator',
      'kc/big-tables-and-profiles-are-read-by-named-columns',
      'kc/html-is-built-only-through-kc-html',
      'no-restricted-properties',
      'no-restricted-syntax',
      'no-undef',
    ])
      expect(classic.rules?.[rule], rule).toEqual(expect.arrayContaining([2]));
    for (const file of [
      'src/kingdoms-call-gm-portal.html/script-1.js',
      'src/kingdoms-call-gm-portal.html/handler-1.js',
    ]) {
      expect(await eslint.isPathIgnored(path.join(ROOT, file)), file).toBe(false);
      expect((await configOf(file)).rules, file).toEqual(classic.rules);
    }
  });

  test.for(TEMPLATES)(
    '%s: every inline script and handler passes',
    timeLimitForTheWork({ toolRuns: 1 }),
    async (template) => {
      expect(await findingsIn(template, read(template))).toEqual([]);
    },
  );

  // The faults the retired tests found in a template (a random sort, a Math.random() in a handler, also in the HTML an
  // inline script writes, HTML built from a value not escaped), and the rules' others, planted in a copy of the GM
  // page's template: each is found, at its line.
  test('a fault planted in a template is found', timeLimitForTheWork({ toolRuns: 1 }), async () => {
    const template = 'kingdoms-call-gm-portal.html';
    const html = read(template);
    const end = html.lastIndexOf('</body>');
    const planted = [
      '<script>[3, 1, 2].sort(() => Math.random() - 0.5);</script>',
      "<script>[3, 1, 2].sort((a, b) => a - b || Math.random() - 0.5); supabase.createClient(KC_CONFIG.supabaseUrl, KC_CONFIG.supabaseKey).from('games').select('*');</script>",
      '<button onclick="Math.random()"></button>',
      '<button onclick="window.Math[\'random\']()"></button>',
      '<button onclick="notOnThePage()"></button>',
      '<button onclick="doSignIn()"></button>',
      `<script>document.body.insertAdjacentHTML('beforeend', '<b onclick="Math.random()"></b>');</script>`,
      "<script>document.body.innerHTML = '<p>' + location.hash + '</p>'; document.title = `<b>${document.title}</b>`;</script>",
    ];
    const at = html.slice(0, end).split('\n').length;
    const copy = html.slice(0, end) + planted.join('\n') + '\n' + html.slice(end);
    const found = (await findingsIn(template, copy)).filter((f) => {
      const line = Number(/:(\d+) /.exec(f)?.[1]);
      return line >= at;
    });
    const rule = (f: string) => f.replace(/^\S+ \S+ /, '');
    expect(found.map((f) => `${String(Number(/:(\d+) /.exec(f)?.[1]) - at)} ${rule(f)}`)).toEqual([
      '0 kc/no-random-or-argument-less-sort-comparator',
      '0 no-restricted-properties',
      '1 kc/no-random-or-argument-less-sort-comparator',
      '1 no-restricted-properties',
      '1 kc/big-tables-and-profiles-are-read-by-named-columns',
      // the sink given markup joined to a value, the join, and the untagged template
      '7 kc/html-is-built-only-through-kc-html',
      '7 kc/html-is-built-only-through-kc-html',
      '7 kc/html-is-built-only-through-kc-html',
      '2 no-restricted-properties',
      '3 no-restricted-syntax',
      '4 no-undef',
      '6 no-restricted-properties',
    ]);
  });
});
