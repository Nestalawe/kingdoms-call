// The script a browser spec's page runs before its own (plan P1-17, Decision 8; P1-17l2): bundled for Chromium by
// tests/browser/the-fake-db-handed-to-chromium.ts, it reads what the spec handed the page as data (the database's
// version and the player's world, or none), and sets the fake (./fake-db.ts) on the window under the name
// src/db/the-pages-database-client.ts reads, the world under THE_NAME_A_SPEC_STAGES_THE_WORLD_UNDER for the spec to
// stage, and a `supabase` global making an empty client, as the jsdom tests do (no call is on it). Nothing a spec hands
// in is run as code.
import { THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER } from '../../src/db/the-pages-database-client.ts';
import { makeAFakeDb, makeAFakeDbHoldingThePlayersWorld, type ThePlayersWorld } from './fake-db.ts';

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

const handed: unknown = Reflect.get(window, THE_NAME_A_SPEC_HANDS_THE_FAKE_ITS_DATA_UNDER);
const version: unknown = typeof handed === 'object' && handed !== null ? Reflect.get(handed, 'version') : undefined;
const world: unknown = typeof handed === 'object' && handed !== null ? Reflect.get(handed, 'world') : undefined;
if (typeof version === 'string') {
  const fake = isAPlayersWorld(world) ? makeAFakeDbHoldingThePlayersWorld(version, world) : makeAFakeDb([version]);
  Reflect.set(window, THE_NAME_A_SPEC_STAGES_THE_WORLD_UNDER, isAPlayersWorld(world) ? world : null);
  Reflect.set(window, THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER, fake.db);
  Reflect.set(window, 'supabase', { createClient: () => ({}) });
}
