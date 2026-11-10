// The access layer's role helper (tests/lib/made-up-accounts-in-each-role-on-the-local-supabase.ts; plan P1-17,
// Decision 6), checked against the database's own role checks, so every access test that signs in as a role is that
// role: is_site_admin() (the Overlord alone), is_game_master() (the two GMs), is_game_gm(the game) (its GM alone),
// is_game_member(the game) (the player and the rival: its GM holds no realm), is_game_gm(the other game) (another GM
// alone); signed out, none can be asked (no grant). And the world leaves nothing behind once removed: no account,
// game or Overlord row of its own.
// Level db (the access layer, against the local Supabase): the roles are rows and sessions of the real database, which
// no lower level holds; pgTAP checks the role checks themselves in SQL.
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest';
import {
  makeAMadeUpWorld,
  THE_ROLES,
  type AMadeUpWorld,
  type ARole,
} from '../lib/made-up-accounts-in-each-role-on-the-local-supabase.ts';

const local = inject('theLocalSupabase');
let world: AMadeUpWorld;

/** Each role check, as the database answers it for each role (signed out: refused). */
const EXPECTED: Record<ARole, readonly [boolean, boolean, boolean, boolean, boolean] | 'refused'> = {
  //               site admin, game master, the game's GM, a member of the game, the other game's GM
  'signed out': 'refused',
  'a player': [false, false, false, true, false],
  'a rival': [false, false, false, true, false],
  "the game's GM": [false, true, true, false, false],
  'another GM': [false, true, false, false, true],
  'the Overlord': [true, false, false, false, false],
};

/** The made-up accounts whose address carries `label`. */
async function theAccountsLabelled(label: string): Promise<string[]> {
  const { data, error } = await world.theServiceRole.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.flatMap((u) => (u.email?.startsWith(`kc-access-${label}-`) ? [u.id] : []));
}

describe('each made-up account is in the role it is made for', () => {
  beforeAll(async () => {
    world = await makeAMadeUpWorld(local, 'roles');
  });
  afterAll(async () => {
    await world.removeIt();
  });

  test.for(THE_ROLES)('%s', async (role) => {
    const client = await world.signedInAs(role);
    const answers = [
      await client.rpc('is_site_admin'),
      await client.rpc('is_game_master'),
      await client.rpc('is_game_gm', { p_game: world.theGame }),
      await client.rpc('is_game_member', { p_game: world.theGame }),
      await client.rpc('is_game_gm', { p_game: world.theOtherGMsGame }),
    ];
    const refused = answers.every((a) => a.error !== null);
    expect(refused ? 'refused' : answers.map((a) => a.error?.message ?? a.data)).toEqual(EXPECTED[role]);
  });

  test('a second world is refused while this one holds the Overlord, and what it made so far is removed', async () => {
    await expect(makeAMadeUpWorld(local, 'second')).rejects.toThrow(/already has an Overlord/);
    expect(await theAccountsLabelled('second')).toEqual([]);
  });
});

test('a removed world leaves none of its accounts, games or Overlord behind', async () => {
  const admin = world.theServiceRole;
  const games = await admin.from('games').select('id').in('id', [world.theGame, world.theOtherGMsGame]);
  const realms = await admin.from('game_players').select('id').in('game_id', [world.theGame, world.theOtherGMsGame]);
  const overlord = await admin.from('site_admins').select('user_id');
  const gms = await admin.from('game_masters').select('user_id').in('user_id', Object.values(world.accounts));
  expect([games.data, realms.data, overlord.data, gms.data, await theAccountsLabelled('roles')]).toEqual([
    [],
    [],
    [],
    [],
    [],
  ]);
});
