// The player portal's sign-in on the values handed it (plan P1-16o): the lines P1-16o changed in sign-in.ts that the
// screen tours don't reach, or reach only in part (npm run proof:tours), each run here on the value that reaches it, so a
// fault planted in one is red: the sign-in and sign-up tabs, the name a player is shown by, the display-name and
// password boxes, a game opened fresh, the Game Master offer, and the start-up's connection error.
// Level 4 (page): the file loads the page's start-up (its database client), so no lower level reaches it; the portal is
// booted in jsdom (tests/lib/boot.js) on a fake Db, at an older database for the forms (it stops at its notice with
// every module loaded) and at a current one for the start-up's own error.
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';
import type { Db } from '../../src/db/the-db-interface-and-its-areas.ts';

const errs: string[] = [];
let P: PageWindow;
let doc: Document;
const call = (name: string, ...args: unknown[]): unknown => {
  const f: unknown = P[name];
  if (typeof f !== 'function') throw new Error(`the page has no function ${name}`);
  return Reflect.apply(f, undefined, args);
};
const stage = (code: string): unknown => P.eval(code);
const theElement = (id: string): HTMLElement => {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`no element ${id}`);
  return el;
};
const theField = (id: string): HTMLInputElement => {
  const el = theElement(id);
  if (!(el instanceof (P['HTMLInputElement'] as typeof HTMLInputElement))) throw new Error(`${id} is not a box`);
  return el;
};
const textOf = (id: string): string => theElement(id).textContent.replace(/\s+/g, ' ').trim();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** What a call that rejects threw, in words; 'resolved' when it didn't. */
const whatItThrew = async (p: unknown): Promise<string> => {
  try {
    await p;
    return 'resolved';
  } catch (e) {
    return String(e);
  }
};

/** What the fake answers this case: each a function the case may replace. */
const answers: Record<string, (...args: unknown[]) => unknown> = {};
const fresh: Record<string, (...args: unknown[]) => unknown> = {
  signIn: () => ({ data: { user: null, session: null }, error: null }),
  signUp: () => ({ data: { user: null, session: null }, error: null }),
  theName: () => ({ data: { id: 'U1', name: 'Warden Pell' }, error: null, status: 200 }),
  giveName: () => ({ data: null, error: null, status: 201 }),
  keepName: () => ({ data: { user: null }, error: null }),
  offer: () => ({ data: null, error: null, status: 200 }),
};
const asked: { readonly what: string; readonly args: unknown[] }[] = [];
const answering =
  (what: string) =>
  (...args: unknown[]): Promise<never> => {
    asked.push({ what, args });
    const answer = answers[what];
    if (!answer) throw new Error(`no answer for ${what}`);
    return Promise.resolve(answer(...args) as never);
  };

function theFakeDb(): Db {
  const bare = makeAFakeDb(['20261010000000']).db;
  return {
    ...bare,
    signingIn: {
      ...bare.signingIn,
      signInWithEmailAndPassword: answering('signIn'),
      signUpWithEmailPasswordAndName: answering('signUp'),
      changeTheNameKeptWithTheSignIn: answering('keepName'),
    },
    theAccountsNames: {
      ...bare.theAccountsNames,
      theNameOfThisAccount: answering('theName'),
      giveThisAccountItsName: answering('giveName'),
    },
    theRoles: { ...bare.theRoles, answerTheGameMasterOffer: answering('offer') },
    thePlayersRealms: {
      ...bare.thePlayersRealms,
      thisRealm: () => Promise.resolve({ data: null, error: { message: 'no such realm' }, status: 406 }),
    },
  };
}

beforeAll(async () => {
  P = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: theFakeDb(),
    url: 'https://example.org/p',
    setup(w) {
      w.addEventListener('error', (e) => errs.push(e.error?.stack ?? e.message));
      w.console.error = () => undefined;
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
      w['scrollTo'] = () => undefined;
      w['ResizeObserver'] = class {
        observe() {
          return undefined;
        }
      };
    },
  }).window;
  doc = P['document'] as Document;
  await new Promise((resolve) => setTimeout(resolve, 600));
  const bootErrors = errs.map((e) => e.split(' (database')[0]).join('; ');
  if (bootErrors !== 'The game is being updated. Try again in a few minutes.')
    throw new Error(`the page booted with other errors: ${bootErrors}`);
  errs.length = 0;
});
beforeEach(() => {
  Object.assign(answers, fresh);
  asked.length = 0;
  stage('currentUser = { id: "U1" }; currentProfile = null; currentGamePlayer = null; currentReport = null;');
  stage('history.replaceState(null, "", location.pathname);');
});
afterAll(() => {
  P.close();
});

/** Signs in as the account handed, the database's profile row answering `name`. */
async function signedInAs(user: unknown, name: unknown) {
  answers['signIn'] = () => ({ data: { user, session: {} }, error: null });
  answers['theName'] = () => ({ data: { id: 'U1', name }, error: null, status: 200 });
  theField('si-email').value = 'pell@example.org';
  theField('si-password').value = 'a-password';
  return whatItThrew(call('doSignIn'));
}

describe('the sign-in and sign-up tabs', () => {
  test('the sign-up tab shows its form and hides the sign-in one', () => {
    call('setAuthTab', 'signup');
    expect(theElement('auth-signin').style.display).toBe('none');
    expect(theElement('auth-signup').style.display).toBe('block');
    call('setAuthTab', 'signin');
    expect(theElement('auth-signin').style.display).toBe('block');
    expect(theElement('auth-signup').style.display).toBe('none');
    call('setAuthTab', 'neither');
    expect(theElement('auth-signin').style.display).toBe('none');
    expect(theElement('auth-signup').style.display).toBe('none');
    call('setAuthTab', 'signin');
  });
  test('an account still to be confirmed is told so, and the sign-in tab comes back after 3 seconds', async () => {
    call('setAuthTab', 'signup');
    answers['signUp'] = () => ({ data: { user: { id: 'U2', user_metadata: {} }, session: null }, error: null });
    theField('su-name').value = 'Warden Pell';
    theField('su-email').value = 'pell@example.org';
    theField('su-password').value = 'longpassword';
    theField('su-password2').value = 'longpassword';
    // the page's 3-second wait, held to 30 ms here so the case runs quickly
    stage('globalThis.__kcWait = setTimeout; setTimeout = (f, ms) => __kcWait(f, ms === 3000 ? 30 : ms);');
    expect(await whatItThrew(call('doSignUp'))).toBe('resolved');
    stage('setTimeout = __kcWait;');
    expect(textOf('auth-msg')).toContain('Account created!');
    expect(theElement('auth-signup').style.display).toBe('block');
    await wait(100);
    expect(theElement('auth-signin').style.display).toBe('block');
    expect(theElement('auth-signup').style.display).toBe('none');
  });
});

describe('the name a player is shown by, once signed in', () => {
  test("the profile's name first", async () => {
    expect(
      await signedInAs({ id: 'U1', email: 'pell@example.org', user_metadata: { display_name: 'Pell' } }, 'Warden'),
    ).toBe('resolved');
    expect(textOf('player-name-display')).toBe('Warden');
  });
  test('with no name in the profile, the name given at sign-up', async () => {
    expect(
      await signedInAs({ id: 'U1', email: 'pell@example.org', user_metadata: { display_name: 'Pell' } }, null),
    ).toBe('resolved');
    expect(textOf('player-name-display')).toBe('Pell');
  });
  test('with neither, the first part of the address', async () => {
    expect(await signedInAs({ id: 'U1', email: 'osric.vane@example.org', user_metadata: {} }, '')).toBe('resolved');
    expect(textOf('player-name-display')).toBe('osric.vane');
  });
  test('with an empty name given at sign-up, the first part of the address', async () => {
    expect(
      await signedInAs({ id: 'U1', email: 'osric.vane@example.org', user_metadata: { display_name: '' } }, null),
    ).toBe('resolved');
    expect(textOf('player-name-display')).toBe('osric.vane');
  });
  test('with neither and no address, the sign-in stops on the address it reads', async () => {
    expect(await signedInAs({ id: 'U1', user_metadata: {} }, null)).toContain("reading 'split'");
  });
  test('signed out while the profile is read, the sign-in stops on the account it reads', async () => {
    answers['signIn'] = () => ({ data: { user: { id: 'U1', user_metadata: {} }, session: {} }, error: null });
    answers['theName'] = () => {
      stage('currentUser = null;');
      return { data: { id: 'U1', name: null }, error: null, status: 200 };
    };
    theField('si-email').value = 'pell@example.org';
    theField('si-password').value = 'a-password';
    expect(await whatItThrew(call('doSignIn'))).toContain("reading 'user_metadata'");
  });
  test('a game in the address opens its report, and the games list keeps polling', async () => {
    stage('clearInterval(_pollTimer); _pollTimer = null;');
    stage('history.replaceState(null, "", location.pathname + "#game=R7");');
    expect(await signedInAs({ id: 'U1', email: 'pell@example.org', user_metadata: {} }, 'Warden')).toBe('resolved');
    expect(textOf('report-title')).toBe('Error: no such realm');
    await wait(50);
    expect(stage('_pollTimer')).not.toBeNull();
    stage('clearInterval(_pollTimer); _pollTimer = null;');
  });
});

describe('the display name box', () => {
  test('it starts on the name given at sign-up where the profile holds none, else on nothing', () => {
    stage('currentUser = { id: "U1", user_metadata: { display_name: "Pell" } };');
    call('changeDisplayName');
    expect(theField('dn-name').value).toBe('Pell');
    call('closeDisplayName');
    stage('currentUser = { id: "U1", user_metadata: {} };');
    call('changeDisplayName');
    expect(theField('dn-name').value).toBe('');
    call('closeDisplayName');
  });
  test('an empty name is refused', async () => {
    call('changeDisplayName');
    theField('dn-name').value = '';
    expect(await whatItThrew(call('submitDisplayName'))).toBe('resolved');
    expect(textOf('dn-msg')).toBe('Please give a name of at least two characters.');
    call('closeDisplayName');
  });
  test('saved with no profile held, and the copy kept with the sign-in failing, the name is still saved', async () => {
    answers['keepName'] = () => {
      throw new Error('the sign-in is away');
    };
    call('changeDisplayName');
    theField('dn-name').value = 'Osric';
    expect(await whatItThrew(call('submitDisplayName'))).toBe('resolved');
    expect(textOf('dn-msg')).toContain('✓ Saved');
    expect(stage('JSON.stringify(currentProfile)')).toBe('{"id":"U1","name":"Osric"}');
    expect(textOf('player-name-display')).toBe('Osric');
    call('closeDisplayName');
  });
  test('a failure with no words says it could not save; one with words says them', async () => {
    answers['giveName'] = () => {
      throw new Error('');
    };
    call('changeDisplayName');
    theField('dn-name').value = 'Osric';
    await whatItThrew(call('submitDisplayName'));
    expect(textOf('dn-msg')).toBe('Could not save the name.');
    answers['giveName'] = () => {
      throw new Error('the realm is closed');
    };
    await whatItThrew(call('submitDisplayName'));
    expect(textOf('dn-msg')).toBe('the realm is closed');
    call('closeDisplayName');
  });
});

describe('a game opened fresh, and the Game Master offer', () => {
  test("a game opened fresh writes its realm's id into the address", () => {
    const said = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    call('openGameFresh', 'R 7/8&9');
    expect(String(said.mock.calls[0]?.[0])).toContain('navigation'); // jsdom's reload: not implemented
    said.mockRestore();
    expect(stage('location.hash')).toBe('#game=R%207%2F8%269');
  });
  test('the offer turned down hides its banner; one the player keeps leaves it', async () => {
    theElement('gm-offer-banner').style.display = 'block';
    stage('confirm = () => false;');
    await whatItThrew(call('declineGmOffer'));
    expect(theElement('gm-offer-banner').style.display).toBe('block');
    stage('confirm = () => true;');
    await whatItThrew(call('declineGmOffer'));
    expect(theElement('gm-offer-banner').style.display).toBe('none');
    expect(asked.filter((a) => a.what === 'offer').map((a) => a.args)).toEqual([['gm_decline_offer']]);
  });
});

describe("the start-up's connection error", () => {
  /** The portal booted at a current database, its kept session answering `session`. */
  async function bootedWith(session: () => unknown): Promise<string> {
    const bare = makeAFakeDb(['20261015062128']).db;
    const W = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
      supabase: { createClient: () => ({}) },
      db: { ...bare, signingIn: { ...bare.signingIn, theSessionKeptInThisBrowser: () => session() as never } },
      url: 'https://example.org/p',
      setup(w) {
        w.console.error = () => undefined;
        w.console.warn = () => undefined;
      },
    }).window;
    await new Promise((resolve) => setTimeout(resolve, 600));
    const d = W['document'] as Document;
    const spinner = d.getElementById('spinner');
    const shown = `${spinner?.style.display ?? '(none)'}: ${(spinner?.textContent ?? '').trim()}`;
    W.close();
    return shown;
  }
  test('a refusal of the kept session shows its words', async () => {
    expect(
      await bootedWith(() => Promise.resolve({ data: { session: null }, error: { message: 'Failed to fetch' } })),
    ).toBe('block: Connection error: Failed to fetch. Check your internet connection and refresh.');
  });
  test('nothing thrown at all shows the error reading its words threw', async () => {
    expect(
      await bootedWith(() => ({
        then(_kept: unknown, refuse: (e: unknown) => void) {
          refuse(undefined);
        },
      })),
    ).toBe("block: Error loading — please refresh. (Cannot read properties of undefined (reading 'message'))");
  });
});
