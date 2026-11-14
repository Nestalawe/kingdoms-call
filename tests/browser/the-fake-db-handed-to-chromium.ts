// The Playwright way in (plan P1-17, Decision 8; built in P1-17l2): the fake database (tests/lib/fake-db.ts), bundled
// for Chromium with its install script (tests/lib/the-fake-db-a-page-takes-in-chromium.ts), run by init scripts before
// the page's scripts: the page takes the fake as its own Db, as jsdom's opts.db does (tests/lib/boot.js). The spec hands
// the page its data (the database's version and the player's world) as an init script's argument, never as code text;
// the world stays on the page's window as `window.kcTheFakesWorld`, for a spec to stage and read back.
import path from 'node:path';
import type { Page } from '@playwright/test';
import { build, type Rolldown } from 'vite';
import { DB_VERSION, routeExternal } from '../lib/boot.js';
import type { TheGameMastersWorldAsData, ThePlayersWorld } from '../lib/fake-db.ts';

let bundled: Promise<string> | undefined;
/** The install script and the fake as one classic script (once a worker). */
function theFakeBundled(): Promise<string> {
  bundled ??= (async () => {
    const out = await build({
      configFile: false,
      logLevel: 'silent',
      publicDir: false,
      build: {
        write: false,
        minify: false,
        lib: {
          // Playwright loads the specs as CommonJS, so the file's folder is __dirname
          entry: path.join(__dirname, '../lib/the-fake-db-a-page-takes-in-chromium.ts'),
          formats: ['iife'],
          name: 'kcTheFakeDb',
          fileName: 'the-fake-db',
        },
      },
    });
    const outputs: Rolldown.RolldownOutput[] = Array.isArray(out) ? out : [out as Rolldown.RolldownOutput];
    const chunk = outputs.flatMap((o) => o.output).find((o) => o.type === 'chunk');
    if (chunk?.type !== 'chunk') throw new Error('the fake database bundled to no script');
    return chunk.code;
  })();
  return bundled;
}

/** Routes the page's other sites as routeExternal does (kc-config.js's dead address, no fonts), and hands the page the
 *  fake before its scripts run: one holding the player's `world` (makeAFakeDbHoldingThePlayersWorld) or the GM's
 *  (makeAFakeDbHoldingTheGameMastersWorld), else one holding no account (makeAFakeDb), each up to date (DB_VERSION). */
export async function handThePageTheFakeDb(
  page: Page,
  world?: ThePlayersWorld | TheGameMastersWorldAsData,
): Promise<void> {
  const fake = await theFakeBundled();
  // the data first, as the argument (Playwright hands it over as JSON); the install script reads it
  await page.addInitScript<unknown>(
    (data) => {
      Reflect.set(window, 'kcTheFakesData', data);
    },
    { version: DB_VERSION, world: world ?? null },
  );
  // the bundle, built from the files above (no value of the spec's in it), named for the browser's tools and traces
  await page.addInitScript(`${fake}\n//# sourceURL=the-fake-db.js\n`);
  await routeExternal(page, '');
}
