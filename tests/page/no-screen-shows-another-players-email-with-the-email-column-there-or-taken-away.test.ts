// No screen shows another player's email (P0-31, ruling R-098), on the fake database (tests/lib/fake-db.ts): the GM
// portal on the GM's world, the player portal on the player's. Every account has an email in its profile. Twice: as
// today, and with the email column taken away (P0-31's database step: the GM's world refuses a query naming it, as it
// does a column the database lacks; the access layer's test proves the column's privilege itself against the local
// database, for each role).
//   - the GM portal's invite picker lists other players by name (with the month they joined, to tell two players of
//     one name apart), never by email, and searches by name;
//   - the player portal still shows your own name.
// Each case boots its page once, in beforeAll, and keeps what it showed; each check is a test of its own. Until plan
// P1-14z the script profiles-no-email.
// Level 4 (page): the picker is the GM portal's own reading of the profiles and its rendering, after its sign-in; the
// lint rule that names the columns a read takes (eslint-rule-big-tables-and-profiles-are-read-by-named-columns) is the
// static half.
import { beforeAll, describe, expect, test } from 'vitest';
import { DB_VERSION } from '../lib/boot.ts';
import {
  aGameMastersWorld,
  makeAFakeDbHoldingTheGameMastersWorld,
  makeAFakeDbHoldingThePlayersWorld,
} from '../lib/fake-db.ts';
import {
  bootThePageOnAFakeDatabaseKeepingItsErrors,
  type APageBootedWithItsErrorsKept,
} from '../lib/a-page-booted-in-jsdom-on-a-fake-database-with-its-errors-kept.ts';

const GM = 'kingdoms-call-gm-portal.html';
const PP = 'kingdoms-call-player-portal.html';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Every account's profile, each with an email: the GM, two players named Ada Thorn (joined a month apart) and one
 *  named Bram Vey. */
const PROFILES = [
  { id: 'gm1', name: 'Test GM', email: 'gm1@example.test', created_at: '2026-09-01T10:00:00Z' },
  { id: 'p1', name: 'Ada Thorn', email: 'ada@example.test', created_at: '2026-09-14T10:00:00Z' },
  { id: 'p2', name: 'Ada Thorn', email: 'ada2@example.test', created_at: '2026-10-03T10:00:00Z' },
  { id: 'p3', name: 'Bram Vey', email: 'bram@example.test', created_at: '2026-10-05T10:00:00Z' },
];

/** The page booted on its own world (the player portal the player's, the GM portal the GM's), signed in as `me`, the
 *  email column there or taken away. */
async function bootThePage(page: string, me: string, emailTakenAway: boolean): Promise<APageBootedWithItsErrorsKept> {
  const gm = aGameMastersWorld();
  gm.tables.profiles.length = 0;
  gm.tables.profiles.push(...PROFILES.map((p) => ({ ...p })));
  if (emailTakenAway) gm.missingColumns.add('profiles.email');
  gm.me = me;
  const fake =
    page === PP
      ? makeAFakeDbHoldingThePlayersWorld(DB_VERSION, {
          me,
          names: PROFILES.map((p) => ({ ...p })),
          games: [],
          realms: [],
          dispatchRefused: null,
          readsOfAnotherAccountsRealms: [],
        })
      : makeAFakeDbHoldingTheGameMastersWorld(DB_VERSION, gm);
  return bootThePageOnAFakeDatabaseKeepingItsErrors(page, fake.db, { waitMs: 900 });
}

describe.for([
  ['as today', false],
  ['the email column taken away', true],
] as const)('%s', ([, emailTakenAway]) => {
  const seen: Record<string, string> = {};
  const errs: Record<string, string[]> = {};

  beforeAll(async () => {
    {
      const { W, doc, errs: gmErrs } = await bootThePage(GM, 'gm1', emailTakenAway);
      errs['gm'] = gmErrs;
      const priv = doc.querySelector<HTMLInputElement>('input[name="new-game-visibility"][value="private"]');
      if (priv) priv.checked = true;
      await W.eval('updateGameVisibility()');
      await wait(50);
      const list = doc.getElementById('new-game-invite-list');
      seen['list'] = list?.textContent ?? '';
      seen['count'] = doc.getElementById('new-game-invite-count')?.textContent ?? '';
      const search = doc.querySelector<HTMLInputElement>('#new-game-invite-search');
      if (search) {
        search.value = 'ada@';
        W.eval(
          "renderInviteCheckboxes('new-game-invite-list','new-game-invite-search',_inviteSelected,'new-game-invite-count')",
        );
      }
      seen['searched'] = list?.textContent ?? '';
      W.close();
    }
    {
      const { W, doc, errs: playerErrs } = await bootThePage(PP, 'p3', emailTakenAway);
      errs['player'] = playerErrs;
      seen['me'] = doc.getElementById('player-name-display')?.textContent ?? '';
      W.close();
    }
  });

  test('the invite picker lists the players by name', () => {
    expect(seen['list']).toMatch(/Ada Thorn/);
    expect(seen['list']).toMatch(/Bram Vey/);
  });
  test('and shows no email', () => {
    expect(seen['list']).not.toMatch(/@/);
    expect(seen['count']).not.toMatch(/@/);
  });
  test('it shows the month each joined (two Ada Thorns)', () => {
    expect(seen['list']).toMatch(/Sep 2026/);
    expect(seen['list']).toMatch(/Oct 2026/);
  });
  test('searching by an email finds nobody', () => {
    expect(seen['searched']).not.toMatch(/Ada Thorn/);
  });
  test('GM portal: no page errors', () => {
    expect(errs['gm']).toEqual([]);
  });
  test('the player portal shows your own name', () => {
    expect(seen['me']).toBe('Bram Vey');
  });
  test('player portal: no page errors', () => {
    expect(errs['player']).toEqual([]);
  });
});
