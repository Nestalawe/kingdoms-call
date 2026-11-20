// The GM portal makes no accounts (P0-32c): Game Masters are chosen by the Overlord from accounts that already exist,
// so the GM portal has no sign-up form, tab or call; its sign-in sends newcomers to the player portal instead. Moved
// from the old script tests/gm-portal-no-signup.test.js (P1-14z), check for check.
// Level 0 (static): it reads the page's template and its modules in src/ (tools/pages.ts); nothing runs.
// - Its own modules (not src/db/, which holds every page's database code, the player page's sign-up among it) call no
//   auth.signUp( and no Db sign-up (signUpWithEmailPasswordAndName).
// - Its template and modules hold no doSignUp, no sign-up tab or form fields, and no "Create GM Account".
// - Its sign-in section is there and says "New here? Register on the player portal", linking to the player portal.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { GM_PAGE, pageFiles, SRC } from '../../tools/pages.ts';

const read = (files: string[]): string => files.map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
const THE_FILES = pageFiles(GM_PAGE);
const ALL = read(THE_FILES);
const ITS_OWN = read(THE_FILES.filter((f) => !f.startsWith('db/')));
const THE_SIGN_IN = /<section id="sec-auth">([\s\S]*?)<\/section>/.exec(ALL)?.[1] ?? '';

describe('the GM portal makes no accounts and sends newcomers to the player portal', () => {
  test("no auth.signUp( call in its own modules (src/db/ holds every page's sign-in)", () => {
    expect(ITS_OWN).not.toMatch(/\bauth\.signUp\s*\(/);
  });

  test("no call of its Db's sign-up", () => {
    expect(ITS_OWN).not.toMatch(/\bsignUpWithEmailPasswordAndName\b/);
  });

  test('no doSignUp, no sign-up tab or form fields, no "Create GM Account"', () => {
    expect(ALL).not.toMatch(/\bdoSignUp\b/);
    expect(ALL).not.toMatch(/id="(tab-signup|auth-signup|su-email|su-password2?)"/);
    expect(ALL).not.toMatch(/Create GM Account/i);
  });

  test('the sign-in section is there and says "New here? Register on the player portal", linking to it', () => {
    expect(THE_SIGN_IN, 'the sign-in section').not.toBe('');
    expect(THE_SIGN_IN).toMatch(
      /New here\?[\s\S]{0,200}<a href="kingdoms-call-player-portal\.html"[^>]*>Register on the player portal<\/a>/,
    );
  });
});
