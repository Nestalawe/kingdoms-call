// The version guard's question (src/db/kc-db-guard.ts, P0-34), asked through the page's Db
// (makeTheDbFromItsClient, src/db/the-db-interface-and-its-areas.ts) on a supabase-js client of the local Supabase, as
// each role (signed out, a player, a rival, the game's GM, another GM, the Overlord): every one is answered with the
// newest migration's 14-digit version (supabase/migrations/), no error, status 200. Every page asks it before its first
// read, the Hall of Fame signed out.
// Level db (the access layer, against the local Supabase): the query and the function's grants together, which no
// lower level holds (the unit test of the guard asks the fake, tests/unit/the-version-guard-asks-the-db-…); pgTAP
// checks the grants in SQL.
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, expect, inject, test } from 'vitest';
import { makeTheDbFromItsClient } from '../../src/db/the-db-interface-and-its-areas.ts';
import {
  makeAMadeUpWorld,
  THE_ROLES,
  type AMadeUpWorld,
} from '../lib/made-up-accounts-in-each-role-on-the-local-supabase.ts';

/** The newest migration's version: the local Supabase is built from supabase/migrations/. */
const THE_NEWEST_MIGRATION = fs
  .readdirSync(path.resolve('supabase', 'migrations'))
  .filter((f) => /^\d{14}_.*\.sql$/.test(f))
  .sort()
  .at(-1)
  ?.slice(0, 14);

const local = inject('theLocalSupabase');
let world: AMadeUpWorld;
beforeAll(async () => {
  world = await makeAMadeUpWorld(local, 'version');
});
afterAll(async () => {
  await world.removeIt();
});

test('the newest migration is found', () => {
  expect(THE_NEWEST_MIGRATION).toMatch(/^\d{14}$/);
});

test.for(THE_ROLES)('%s is answered with the newest migration', async (role) => {
  const db = makeTheDbFromItsClient(await world.signedInAs(role));
  const { data, error, status } = await db.theDatabasesVersion.askTheDatabaseItsVersion();
  expect({ data, error, status }).toEqual({ data: THE_NEWEST_MIGRATION, error: null, status: 200 });
});
