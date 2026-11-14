// The script a browser spec's page runs before its own (plan P1-17, Decision 8; P1-17l2): bundled for Chromium by
// tests/browser/the-fake-db-handed-to-chromium.ts, it reads what the spec handed the page as data (the database's
// version and the player's world, the GM's world (P1-17q2) or none), and sets the fake (./fake-db.ts) on the window under the name
// src/db/the-pages-database-client.ts reads, the world under THE_NAME_A_SPEC_STAGES_THE_WORLD_UNDER for the spec to
// stage, and a `supabase` global making an empty client, as the jsdom tests do (no call is on it). Nothing a spec hands
// in is run as code.
import { THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER } from '../../src/db/the-pages-database-client.ts';
import {
  makeAFakeDb,
  makeAFakeDbHoldingTheGameMastersWorld,
  makeAFakeDbHoldingThePlayersWorld,
  type TheGameMastersWorld,
  type ThePlayersWorld,
} from './fake-db.ts';

/** The name, on the page's window, of what the spec hands in: `{ version, world }`. */
const THE_NAME_A_SPEC_HANDS_THE_FAKE_ITS_DATA_UNDER = 'kcTheFakesData';
/** The name, on the page's window, of the world the fake holds (a spec's hand on it). */
const THE_NAME_A_SPEC_STAGES_THE_WORLD_UNDER = 'kcTheFakesWorld';

/** A player's world, as JSON brought it: an object with the arrays the fake reads. */
function isAPlayersWorld(world: unknown): world is ThePlayersWorld {
  if (typeof world !== 'object' || world === null) return false;
  return ['names', 'games', 'realms', 'readsOfAnotherAccountsRealms'].every((k) =>
    Array.isArray(Reflect.get(world, k)),
  );
}

/** The GM's world, as JSON brought it (its tables, and its sets as lists), made whole: its sets as sets. */
function aGameMastersWorldFrom(world: unknown): TheGameMastersWorld | null {
  if (typeof world !== 'object' || world === null) return null;
  const tables: unknown = Reflect.get(world, 'tables');
  const columns: unknown = Reflect.get(world, 'missingColumns');
  const missingTables: unknown = Reflect.get(world, 'missingTables');
  if (typeof tables !== 'object' || tables === null || !Array.isArray(columns) || !Array.isArray(missingTables))
    return null;
  const sets = { missingColumns: new Set(columns.map(String)), missingTables: new Set(missingTables.map(String)) };
  // the rest of the world as handed (its tables, `me`, `failing`, `calls`), its two lists made sets
  return Object.assign(world, sets) as TheGameMastersWorld;
}

const handed: unknown = Reflect.get(window, THE_NAME_A_SPEC_HANDS_THE_FAKE_ITS_DATA_UNDER);
const version: unknown = typeof handed === 'object' && handed !== null ? Reflect.get(handed, 'version') : undefined;
const world: unknown = typeof handed === 'object' && handed !== null ? Reflect.get(handed, 'world') : undefined;
const theGameMasters = aGameMastersWorldFrom(world);
if (typeof version === 'string') {
  const fake = theGameMasters
    ? makeAFakeDbHoldingTheGameMastersWorld(version, theGameMasters)
    : isAPlayersWorld(world)
      ? makeAFakeDbHoldingThePlayersWorld(version, world)
      : makeAFakeDb([version]);
  Reflect.set(
    window,
    THE_NAME_A_SPEC_STAGES_THE_WORLD_UNDER,
    theGameMasters ?? (isAPlayersWorld(world) ? world : null),
  );
  Reflect.set(window, THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER, fake.db);
  Reflect.set(window, 'supabase', { createClient: () => ({}) });
}
