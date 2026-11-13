// The Playwright way in (plan P1-17, Decision 8; built in P1-17l2): the fake database (tests/lib/fake-db.ts), bundled
// for Chromium, set on the page's window under the name src/db/the-pages-database-client.ts reads
// (THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER) by an init script, so before the page's scripts run: the page takes it
// as its own Db, as jsdom's opts.db does (tests/lib/boot.js). The page still makes its client from the `supabase`
// global, here one that makes an empty client (no call is on it: the player page makes every call on its Db).
// The world the fake holds stays on the page's window, under THE_NAME_A_SPEC_STAGES_THE_WORLD_UNDER, for a spec to
// stage and read back.
import path from 'node:path';
import type { Page } from '@playwright/test';
import { build, type Rolldown } from 'vite';
import { DB_VERSION, routeExternal } from '../lib/boot.js';
import type { ThePlayersWorld } from '../lib/fake-db.ts';
import { THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER } from '../../src/db/the-pages-database-client.ts';

/** The name, on the page's window, of the world the fake holds (a spec's hand on it). */
export const THE_NAME_A_SPEC_STAGES_THE_WORLD_UNDER = 'kcTheFakesWorld';
/** The name, on the page's window, of the bundled fake's exports. */
const THE_BUNDLES_NAME = 'kcTheFakeDb';

let bundled: Promise<string> | undefined;
/** tests/lib/fake-db.ts as one classic script setting THE_BUNDLES_NAME (once a worker). */
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
          entry: path.join(__dirname, '../lib/fake-db.ts'),
          formats: ['iife'],
          name: THE_BUNDLES_NAME,
          fileName: 'fake-db',
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
 *  fake before its scripts run: one holding the player's `world` (makeAFakeDbHoldingThePlayersWorld), else one holding
 *  no account (makeAFakeDb), each up to date (DB_VERSION). */
export async function handThePageTheFakeDb(page: Page, world?: ThePlayersWorld): Promise<void> {
  const fake = await theFakeBundled();
  const install = world
    ? `${THE_BUNDLES_NAME}.makeAFakeDbHoldingThePlayersWorld(${JSON.stringify(DB_VERSION)}, world)`
    : `${THE_BUNDLES_NAME}.makeAFakeDb([${JSON.stringify(DB_VERSION)}])`;
  // one template, so tests/static/page-globals.test.ts reads it (it reads no page name)
  await page.addInitScript(
    `${fake}\n;(function(){ var world=${JSON.stringify(world ?? null)}; window[${JSON.stringify(THE_NAME_A_SPEC_STAGES_THE_WORLD_UNDER)}]=world; window[${JSON.stringify(THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER)}]=${install}.db; window.supabase={createClient:function(){ return {}; }}; })();`,
  );
  await routeExternal(page, '');
}
