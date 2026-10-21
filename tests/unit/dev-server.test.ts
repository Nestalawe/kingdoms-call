// npm run dev's guard (tools/dev.ts, plan P1-09d, its Decision 10): the dev server serves kc-config.js from
// public/dev/kc-config.js, and only one that names this machine's Supabase, so it can never reach the live database.
// - With no such file, or one that names another database (the live site's own kc-config.js), it refuses to start,
//   with a one-line message that says what to do.
// - Writing the file refuses a database that isn't local.
// - Started, it answers /kc-config.js with the dev file, never public/kc-config.js; and if the file changes to one
//   that names another database while it runs, it answers with an error instead.
// - Its pages' footers say "build dev" (P1-06c), with a kc-build meta of "dev" and no fingerprint, so a page it serves
//   never finds a newer version of itself.
// - The build never publishes public/dev/ (tests/static/pages-build.test.ts builds the site with the file there).
// Level 1 (unit): the guard's functions, and the dev server started on this machine for a moment; no page runs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import { devConfigProblem, devConfigText, startDevServer } from '../../tools/dev.ts';

const LIVE = fs.readFileSync(path.join(ROOT, 'public', 'kc-config.js'), 'utf8');
const LOCAL = devConfigText('http://127.0.0.1:54321', 'sb_publishable_local_example');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-dev-'));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('the guard', () => {
  test('no dev config: it says how to make one', () => {
    expect(devConfigProblem(null)).toBe(
      'npm run dev: no public/dev/kc-config.js. Start the local Supabase (supabase/README.md), then run npm run dev -- config.',
    );
  });

  test("the live site's config: refused", () => {
    expect(devConfigProblem(LIVE)).toMatch(/names https:\/\/\S+\.supabase\.co, not this machine's Supabase/);
  });

  test('a config that declares no database: refused', () => {
    expect(devConfigProblem('const KC_CONFIG = {};')).toMatch(/doesn't declare KC_CONFIG with a supabaseUrl/);
  });

  test('a local config: served', () => {
    expect(devConfigProblem(LOCAL)).toBeNull();
    expect(devConfigProblem(devConfigText('http://localhost:54321', 'k'))).toBeNull();
  });

  test('writing a config for another database: refused', () => {
    expect(() => devConfigText('https://yymsnsrpggpgmzgcfrys.supabase.co', 'k')).toThrow(/isn't this machine's/);
  });
});

describe('the dev server', () => {
  test('without a dev config, it refuses to start', async () => {
    await expect(startDevServer(path.join(tmp, 'none.js'))).rejects.toThrow(/no .*none\.js/);
  });

  test('with the live config as its dev config, it refuses to start', async () => {
    const file = path.join(tmp, 'live.js');
    fs.writeFileSync(file, LIVE);
    await expect(startDevServer(file)).rejects.toThrow(/not this machine's Supabase/);
  });

  test('it answers /kc-config.js with the dev config, and with an error once that names another database', async () => {
    const file = path.join(tmp, 'kc-config.js');
    fs.writeFileSync(file, LOCAL);
    const server = await startDevServer(file);
    try {
      const url = server.resolvedUrls?.local[0];
      if (!url) throw new Error('the dev server has no address');
      const served = await fetch(new URL('kc-config.js', url));
      expect(served.status).toBe(200);
      expect(await served.text()).toBe(LOCAL);
      fs.writeFileSync(file, LIVE);
      const refused = await fetch(new URL('kc-config.js', url));
      expect(refused.status).toBe(500);
      const text = await refused.text();
      expect(text).toMatch(/^throw new Error\(".*not this machine's Supabase/);
      expect(text).not.toContain('supabaseKey');
    } finally {
      await server.close();
    }
  });

  test('its pages say "build dev", with no fingerprint', async () => {
    const file = path.join(tmp, 'kc-config-build-line.js');
    fs.writeFileSync(file, LOCAL);
    const server = await startDevServer(file);
    try {
      const url = server.resolvedUrls?.local[0];
      if (!url) throw new Error('the dev server has no address');
      const page = await (await fetch(new URL('kingdoms-call-gm-portal.html', url))).text();
      expect(page).toContain('Kingdoms Call — GM Portal · build dev</div>');
      expect(page).toContain('<meta name="kc-build" content="dev">');
      expect(page).not.toContain('kc-page-version');
      expect(page).not.toContain('<!--kc-build-->');
    } finally {
      await server.close();
    }
  });
});
