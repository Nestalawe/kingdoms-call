// A page opened before a deploy still loads its files after it (plan P1-06b). GitHub Pages' cache can hand out a page
// for 10 minutes after a deploy, while the site behind it is already the new one; since P1-06b each bundle and
// stylesheet is named by its content, so the deploy keeps the files the old pages name
// (tools/deploy/keep-the-previous-deploys-files.ts). Two builds, as two deploys in a row: src/ as it is, then src/ with
// the GM page's code and the player portal's stylesheet changed. A server of this spec's own serves the second
// deploy, but answers each page with the first deploy's copy (a page cached before it), and every page is opened in
// Chromium, with no database to reach: every request it makes of the site is answered 200, and no page error. With the
// keep step left out (the second build alone), the three files the change renamed answer 404: the check can fail.
// Level 4 (browser): only a real browser fetches the files a page names; jsdom fetches none
// (tests/unit/a-deploy-keeps-the-files-a-cached-page-still-names.test.ts checks the same files byte for byte).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const ROOT = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-cached-page-'));
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

/** Runs a script of tools/ with Node, from `cwd`; throws with its output if it fails. */
function node(cwd: string, ...args: string[]): void {
  const run = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...args], {
    cwd,
    encoding: 'utf8',
  });
  if (run.status !== 0) throw new Error(`node ${args.join(' ')} failed:\n${run.stderr}`);
}

/** A build of a copy of src/ changed by `change`, as `npm run build` builds it: from the folder holding the copy (the
 *  bundles name their modules from there). */
function buildOf(name: string, change: (src: string) => void = () => undefined): string {
  const home = path.join(tmp, name);
  fs.cpSync(path.join(ROOT, 'src'), path.join(home, 'src'), { recursive: true });
  change(path.join(home, 'src'));
  const out = path.join(home, 'site');
  node(home, path.join(ROOT, 'tools', 'build.ts'), out, '--src', 'src', '--public', path.join(ROOT, 'public'));
  return out;
}

/** The deploy of `built` after `previous`, as the build job makes it: the build, then the keep step. */
function deployOf(built: string, previous: string, now: string): string {
  const out = `${built}-deployed`;
  fs.cpSync(built, out, { recursive: true });
  node(
    ROOT,
    path.join(ROOT, 'tools', 'deploy', 'keep-the-previous-deploys-files.ts'),
    out,
    '--previous',
    previous,
    '--now',
    now,
  );
  return out;
}

let first = '';
let second = '';
let secondWithoutTheKeep = '';
const pages: string[] = [];
// Each request this spec's server answered, "<status> <path>", for the page being opened.
let answered: string[] = [];
let server: http.Server | undefined;
let site = '';
let base = '';

test.describe.configure({ mode: 'default', timeout: 120_000 });

test.beforeAll(async () => {
  const b1 = buildOf('first');
  first = deployOf(b1, b1, '2026-10-21T00:00:00.000Z');
  secondWithoutTheKeep = buildOf('second', (src) => {
    fs.appendFileSync(path.join(src, 'ui', 'gm', 'start.ts'), '\n(globalThis as { aChange?: number }).aChange = 1;\n');
    fs.appendFileSync(path.join(src, 'ui', 'player', 'style.css'), '\n.a-planted-change { color: red; }\n');
  });
  second = deployOf(secondWithoutTheKeep, first, '2026-10-21T00:07:00.000Z');
  pages.push(
    ...fs
      .readdirSync(first)
      .filter((f) => f.endsWith('.html'))
      .sort(),
  );
  server = http.createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/').replace(/^\/+/, '');
    // A page from the first deploy (cached before the second); everything else from the site behind it.
    const file = path.join(name.endsWith('.html') ? first : site, name);
    const ok = !name.includes('..') && fs.existsSync(file) && fs.statSync(file).isFile();
    answered.push(`${ok ? '200' : '404'} ${name}`);
    res.writeHead(ok ? 200 : 404, { 'Content-Type': (ok ? MIME[path.extname(file)] : undefined) ?? 'text/plain' });
    res.end(ok ? fs.readFileSync(file) : 'no');
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (server)
      server.close(() => {
        resolve();
      });
    else resolve();
  });
  fs.rmSync(tmp, { recursive: true, force: true });
});

// No database: kc-config.js names an address that is never reached (every request off this server is refused), as
// tests/browser/third-party-requests.spec.ts does. The fonts are answered with nothing.
const NO_DATABASE = 'http://no-database.invalid';
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

/** Opens `name` (the first deploy's copy) against `behind`; gives each request this server answered, and each page
 *  error. */
async function open(page: Page, name: string, behind: string) {
  site = behind;
  answered = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url === base + 'kc-config.js') {
      // Asked of this server all the same, so a missing one counts.
      const real = await route.fetch();
      if (!real.ok()) return route.fulfill({ response: real });
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `const KC_CONFIG=Object.freeze({env:'test',supabaseUrl:${JSON.stringify(NO_DATABASE)},supabaseKey:'test-key'});`,
      });
    }
    if (url.startsWith(base)) return route.continue();
    if (FONTS.test(url)) return route.fulfill({ status: 200, body: '' });
    return route.abort();
  });
  await page.goto(base + name, { waitUntil: 'load' });
  return { answered: [...answered], errors };
}

test('every page of the older deploy, opened against the newer one, loads every file it names, with no error', async ({
  page,
}) => {
  const failed: string[] = [];
  let requests = 0;
  for (const name of pages) {
    const r = await open(page, name, second);
    requests += r.answered.length;
    failed.push(...r.answered.filter((a) => !a.startsWith('200 ')).map((a) => `${name}: ${a}`));
    expect.soft(r.errors, `${name}: page errors`).toEqual([]);
  }
  expect(failed).toEqual([]);
  expect(requests).toBeGreaterThanOrEqual(30);
});

test('with the keep step left out, the three files the change renamed answer 404', async ({ page }) => {
  const failed: string[] = [];
  for (const name of pages) {
    const r = await open(page, name, secondWithoutTheKeep);
    failed.push(...r.answered.filter((a) => !a.startsWith('200 ')));
  }
  expect(failed.map((a) => a.replace(/-[A-Za-z0-9_-]{8}\./, '-*.')).sort()).toEqual([
    '404 assets/kingdoms-call-gm-portal-*.js',
    '404 assets/kingdoms-call-player-portal-*.css',
    '404 assets/kingdoms-call-player-portal-*.js',
  ]);
});
