// The database's address and public key live in one place, site/kc-config.js (P0-13), so a staging copy of the site
// can swap that one file. Moved from the old script tests/config.test.js (P1-14z), check for check.
// Level 0 (static): it reads the built site and the pages' sources in src/, and nothing of the game runs. The one
// piece of code run is kc-config.js itself, a plain-data file (one frozen object), evaluated in an empty vm context to
// read its value: reading its text alone would let through a file that throws when a page loads it.
// - kc-config.js (site/'s, or $KC_SITE's) defines KC_CONFIG, whose supabaseUrl is a Supabase project's address and
//   whose supabaseKey isn't empty.
// - No page's template or modules type in a Supabase project's address or key.
// - Every page whose modules create the database client loads kc-config.js by a classic <script src> in its template
//   (it runs before the page's module script, P1-09d, wherever the two tags are), and creates no client in an inline
//   script of its template.
// Each page's template and modules are named by tools/pages.ts.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, test } from 'vitest';
import { pageModules, pageNames, SRC } from '../../tools/pages.ts';
import { SITE } from '../lib/boot.ts';

const THE_CONFIG = path.join(SITE, 'kc-config.js');

/** What is wrong with KC_CONFIG as kc-config.js defines it: the file missing or throwing, its address or its key. */
function whatIsWrongWithTheConfig(): string[] {
  if (!fs.existsSync(THE_CONFIG)) return ['site/kc-config.js is missing'];
  const context: { theConfig?: { supabaseUrl?: unknown; supabaseKey?: unknown } } = {};
  vm.createContext(context);
  try {
    vm.runInContext(`${fs.readFileSync(THE_CONFIG, 'utf8')}\n;globalThis.theConfig=KC_CONFIG;`, context);
  } catch (e) {
    return [`kc-config.js: ${e instanceof Error ? e.message : String(e)}`];
  }
  const url = context.theConfig?.supabaseUrl;
  const key = context.theConfig?.supabaseKey;
  if (typeof url !== 'string' || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url))
    return [`kc-config.js: supabaseUrl isn't a Supabase project address (${String(url)})`];
  if (typeof key !== 'string' || key.length === 0) return ['kc-config.js: supabaseKey is empty'];
  return [];
}

const ADDRESS = /https:\/\/[a-z0-9]{20}\.supabase\.co/;
const KEY =
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|\bsb_(publishable|secret)_[A-Za-z0-9_-]{10,}/;
const CREATES_THE_CLIENT = /\bcreateClient\s*\(/;

/** What is wrong with one page: an address or a key typed in, or a client created before kc-config.js is loaded. */
function whatIsWrongWithAPage(name: string): string[] {
  const html = fs.readFileSync(path.join(SRC, name), 'utf8');
  const code = pageModules(name)
    .map((f) => fs.readFileSync(path.join(SRC, f), 'utf8'))
    .join('\n');
  const src = `${html}\n${code}`;
  const problems: string[] = [];
  if (ADDRESS.test(src))
    problems.push(`${name}: types in a Supabase project address; read KC_CONFIG.supabaseUrl instead`);
  if (KEY.test(src)) problems.push(`${name}: types in a Supabase key; read KC_CONFIG.supabaseKey instead`);
  if (!CREATES_THE_CLIENT.test(code)) return problems;
  if (!html.includes('<script src="kc-config.js"></script>'))
    problems.push(`${name}: creates the database client but never loads kc-config.js`);
  else if (CREATES_THE_CLIENT.test(html))
    problems.push(`${name}: creates the database client in an inline script, which may run before kc-config.js`);
  return problems;
}

describe("the database's address and key live only in kc-config.js, which every page on the database loads", () => {
  test("kc-config.js defines KC_CONFIG with a Supabase project's address and a key", () => {
    expect(whatIsWrongWithTheConfig()).toEqual([]);
  });

  test('no page types in an address or a key, and each page on the database loads kc-config.js first', () => {
    expect(pageNames().flatMap(whatIsWrongWithAPage)).toEqual([]);
    // The pages are read: today four create the database client.
    expect(
      pageNames().filter((name) =>
        CREATES_THE_CLIENT.test(
          pageModules(name)
            .map((f) => fs.readFileSync(path.join(SRC, f), 'utf8'))
            .join('\n'),
        ),
      ).length,
    ).toBeGreaterThan(0);
  });
});
