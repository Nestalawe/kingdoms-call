// The pages load supabase-js from the site itself (P0-18; from npm since P1-17b), never from another site, so no
// outside party can change the code that holds players' logins. Moved from the old script
// tests/vendor-supabase.test.js (P1-14z), check for check.
// Level 0 (static): it reads files (package.json, the lock, the installed package, the built site and the pages'
// sources); nothing runs.
// - No page loads a script from another site (its template or its built page), writes one in with document.write, or
//   names a CDN (jsdelivr, unpkg).
// - The version is pinned: package.json names @supabase/supabase-js at one exact version, and the lock and the
//   installed package are that version.
// - site/assets/ (or $KC_SITE's) holds exactly one supabase-js-<hash>.js, byte for byte the package's browser build
//   (dist/umd/supabase.js), and one licence beside it, byte for byte the package's, so an edited or swapped copy is
//   caught (npm checks the package itself against the lock's integrity hash when it installs it).
// - Every page that creates the database client loads that file by a classic <script src> before its module script
//   (tools/build.ts writes the tag where the template has <!--kc-supabase-js-->).
// The real-browser side (which requests a page makes) is tests/browser/third-party-requests.spec.ts.
// static/pages-build.test.ts checks that a fresh build makes one of each file; this test checks the site the other
// tests open, and the files' bytes.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Supabase-js is served with the site: pinned exactly in package.json, the lock and node_modules; `site/assets/` holds
// one `supabase-js-<hash>.js`, the package's browser build byte for byte, and its licence; no page loads a script from
// another site, uses document.write or names a CDN; each page on the database loads the file before its module script
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { pageModules, pageNames, ROOT, SRC } from '../../tools/pages.ts';
import { SITE } from '../lib/boot.ts';

const require = createRequire(import.meta.url);
const PACKAGE = '@supabase/supabase-js';

const pin: unknown = (
  JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { dependencies?: Record<string, unknown> }
).dependencies?.[PACKAGE];
const locked: unknown = (
  JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')) as {
    packages?: Record<string, { version?: unknown } | undefined>;
  }
).packages?.[`node_modules/${PACKAGE}`]?.version;
const BROWSER_BUILD = require.resolve(`${PACKAGE}/dist/umd/supabase.js`);
const PACKAGE_DIR = path.dirname(require.resolve(`${PACKAGE}/package.json`));
const installed: unknown = (
  JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'package.json'), 'utf8')) as { version?: unknown }
).version;

const ASSETS = path.join(SITE, 'assets');
const inAssets = (re: RegExp): string[] =>
  fs.existsSync(ASSETS) ? fs.readdirSync(ASSETS).filter((f) => re.test(f)) : [];
const THE_LIBRARIES = inAssets(/^supabase-js-(?!LICENSE-).*\.js$/);
const THE_LICENCES = inAssets(/^supabase-js-LICENSE-.*\.txt$/);
const THE_LIBRARY = THE_LIBRARIES.length === 1 ? THE_LIBRARIES[0] : undefined;

/** What is wrong with one page: a script from another site, document.write, a CDN named, or the library loaded late. */
function whatIsWrongWithAPage(name: string): string[] {
  const html = fs.readFileSync(path.join(SRC, name), 'utf8');
  const code = pageModules(name)
    .map((f) => fs.readFileSync(path.join(SRC, f), 'utf8'))
    .join('\n');
  const built = fs.readFileSync(path.join(SITE, name), 'utf8');
  const problems: string[] = [];
  const outside = [...(html + built).matchAll(/<script[^>]*\bsrc="((?:https?:)?\/\/[^"]*)"/g)].map((m) => m[1]);
  if (outside.length) problems.push(`${name}: loads a script from another site: ${outside.join(', ')}`);
  if (/document\.write\s*\(/.test(html + code)) problems.push(`${name}: uses document.write`);
  if (/jsdelivr|unpkg/i.test(html + code)) problems.push(`${name}: still names a CDN (jsdelivr or unpkg)`);
  if (!/\bcreateClient\s*\(/.test(code) || THE_LIBRARY === undefined) return problems;
  const tag = built.indexOf(`<script src="./assets/${THE_LIBRARY}"></script>`);
  const module = built.search(/<script type="module"[^>]*\bsrc=/);
  if (tag < 0) problems.push(`${name}: creates the database client but doesn't load assets/${THE_LIBRARY}`);
  else if (module >= 0 && module < tag) problems.push(`${name}: loads assets/${THE_LIBRARY} after its module script`);
  return problems;
}

describe('the pages load supabase-js from the site itself, pinned, and byte for byte the package', () => {
  test('package.json pins it to one exact version, and the lock and node_modules have that version', () => {
    expect(
      typeof pin === 'string' && /^\d+\.\d+\.\d+$/.test(pin),
      `package.json should pin ${PACKAGE} to one exact version in dependencies; it says ${JSON.stringify(pin)}`,
    ).toBe(true);
    expect(locked, `package-lock.json's ${PACKAGE}`).toBe(pin);
    expect(installed, `node_modules has another ${PACKAGE} than the pinned one: run npm ci`).toBe(pin);
  });

  test("site/assets/ holds one copy of the package's browser build and one of its licence, byte for byte", () => {
    expect(THE_LIBRARIES, 'site/assets/ should hold exactly one supabase-js-<hash>.js').toHaveLength(1);
    expect(
      fs.readFileSync(path.join(ASSETS, THE_LIBRARIES[0] ?? '')).equals(fs.readFileSync(BROWSER_BUILD)),
      `site/assets/${String(THE_LIBRARY)} isn't byte for byte ${PACKAGE}'s dist/umd/supabase.js`,
    ).toBe(true);
    expect(THE_LICENCES, 'site/assets/ should hold exactly one supabase-js-LICENSE-<hash>.txt').toHaveLength(1);
    expect(
      fs
        .readFileSync(path.join(ASSETS, THE_LICENCES[0] ?? ''))
        .equals(fs.readFileSync(path.join(PACKAGE_DIR, 'LICENSE'))),
      `site/assets/${String(THE_LICENCES[0])} isn't byte for byte ${PACKAGE}'s LICENSE`,
    ).toBe(true);
  });

  test('no page loads a script from another site, and each page on the database loads the library before its module script', () => {
    expect(pageNames().flatMap(whatIsWrongWithAPage)).toEqual([]);
  });
});
