// The staging line (P0-33): on the staging site, every page's footer says which pull request and commit it is
// ("Staging · PR #21 · abcdef1", linking to the pull request); on the live site, nothing new shows. Each page of site/
// (or $KC_SITE) is booted in jsdom on a fake database (tests/lib/fake-db.ts):
//   - with site/kc-config.js as it is (the live one: no `deployed`): no staging line;
//   - with the kc-config.js the staging deploy writes (.github/scripts/staging.js): the line, in the page's <footer>
//     where it has one, else in a small fixed stamp, its letters as written; on a page that uses the database it also
//     names the database's version, once the version guard has read it (P0-34);
//   - (two pages) with a hand-made config whose `deployed` isn't a number and a commit: no line, no markup.
// Every boot runs once, in beforeAll, and keeps what the page showed; each page's check is a test of its own. Until
// plan P1-14z the script staging-footer. What the deploy writes into the config is its unit test
// (the-staging-deploy-writes-a-config-only-for-staging-signs-up-made-up-accounts-and-waits-for-ci.test.ts).
// Level 4 (page): the line is public/kc-staging-footer.js reading the config each page loads, placed in each page's own
// footer, after the page's version guard; no lower level loads a page's scripts together.
import fs from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import * as staging from '../../.github/scripts/staging.ts';
import { bootJsdom, DB_VERSION, readPage, SITE, sitePath, type PageWindow } from '../lib/boot.ts';
import { makeAFakeDb } from '../lib/fake-db.ts';
import { timeLimitGivenAsANumber } from '../lib/time-limits.ts';

const SHA = 'abcdef1234567890abcdef1234567890abcdef12';
const LIVE = fs.readFileSync(sitePath('kc-config.js'), 'utf8');
const STAGING = staging.configFile({
  url: 'https://yquaxxzdepqquitlgxkh.supabase.co',
  key: 'sb_publishable_example_key_1234567890',
  deployed: { pr: 21, sha: SHA },
});
const MALFORMED = `const KC_CONFIG=Object.freeze({env:'staging',supabaseUrl:'https://yquaxxzdepqquitlgxkh.supabase.co',
  supabaseKey:'k',deployed:{pr:'<img id="kc-injected" src="x">',sha:'<b>${SHA}</b>'}});`;
const PAGES = fs
  .readdirSync(SITE)
  .filter((f) => f.endsWith('.html'))
  .sort();
const THE_MALFORMED_CONFIGS_PAGES = ['index.html', 'kingdoms-call-player-portal.html'];
/** The allowance for one boot (the page's start and its 100 ms), about five times the longest one took alone. */
const EACH_BOOTS_MS = 1_000;

/** The page's text as shown: without its scripts' source (kc-staging-footer.js itself says "Staging · PR"). */
function shownText(doc: Document): string {
  // `as`: a copy of the body is an element of the same kind
  const body = doc.body.cloneNode(true) as HTMLElement;
  body.querySelectorAll('script').forEach((s) => {
    s.remove();
  });
  return body.textContent;
}

/** Boots `page` with `config` in place of the live kc-config.js, its console silenced. */
async function bootWithTheConfig(page: string, config: string): Promise<{ W: PageWindow; doc: Document }> {
  const html = readPage(page).split(LIVE).join(config);
  const { window: W } = bootJsdom(html, {
    supabase: { createClient: () => ({}) },
    db: makeAFakeDb([DB_VERSION]).db,
    url: 'https://example.org/' + page,
    setup(w) {
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
      w.console.error = () => undefined;
      w.onunhandledrejection = () => undefined;
    },
  });
  await new Promise((r) => setTimeout(r, 100));
  // `as`: the page's window has its document (PageWindow names only what most tests read)
  return { W, doc: W['document'] as Document };
}

/** What a page showed with the staging config: its line's text, link and place, and its letters' transform. */
interface TheStagingLine {
  text: string;
  href: string | null;
  inItsFooterOrAFixedStamp: boolean;
  textTransform: string;
}
const withTheLiveConfig = new Map<string, boolean>();
const withTheStagingConfig = new Map<string, TheStagingLine | null>();
const withAMalformedConfig = new Map<string, boolean>();

beforeAll(
  async () => {
    for (const page of PAGES) {
      {
        const { W, doc } = await bootWithTheConfig(page, LIVE);
        withTheLiveConfig.set(
          page,
          !!doc.getElementById('kc-staging-footer') || shownText(doc).includes('Staging · PR'),
        );
        W.close();
      }
      {
        const { W, doc } = await bootWithTheConfig(page, STAGING);
        const el = doc.getElementById('kc-staging-footer');
        withTheStagingConfig.set(
          page,
          el && {
            text: el.textContent,
            href: el.getAttribute('href'),
            inItsFooterOrAFixedStamp: doc.querySelector('footer')
              ? !!el.closest('footer')
              : el.style.position === 'fixed',
            // `as`: the page's own getComputedStyle
            textTransform: (W['getComputedStyle'] as typeof getComputedStyle)(el).textTransform,
          },
        );
        W.close();
      }
    }
    for (const page of THE_MALFORMED_CONFIGS_PAGES) {
      const { W, doc } = await bootWithTheConfig(page, MALFORMED);
      withAMalformedConfig.set(
        page,
        !!doc.getElementById('kc-staging-footer') ||
          !!doc.getElementById('kc-injected') ||
          shownText(doc).includes('Staging · PR'),
      );
      W.close();
    }
  },
  timeLimitGivenAsANumber((PAGES.length * 2 + THE_MALFORMED_CONFIGS_PAGES.length) * EACH_BOOTS_MS + 10_000).timeout,
);

test('the site has pages to boot', () => {
  expect(PAGES).toContain('index.html');
});

describe('with the live config', () => {
  test.for(PAGES)('%s: no staging line', (page) => {
    expect(withTheLiveConfig.get(page)).toBe(false);
  });
});

describe("with the staging deploy's config", () => {
  test.for(PAGES)('%s: "Staging · PR #21 · abcdef1", linking to the pull request, in its footer', (page) => {
    const line = withTheStagingConfig.get(page);
    expect(line, 'a staging line (does the page load kc-config.js and kc-staging-footer.js?)').toBeTruthy();
    // a page that uses the database: one whose code (its bundle: readPage inlines it) makes a client
    const usesTheDatabase = /\bcreateClient\s*\(/.test(readPage(page));
    expect(line?.text).toBe('Staging · PR #21 · abcdef1' + (usesTheDatabase ? ` · database ${DB_VERSION}` : ''));
    expect(line?.href).toBe('https://github.com/Nestalawe/kingdoms-call/pull/21');
    expect(line?.inItsFooterOrAFixedStamp, "in the page's footer (or, with none, a fixed stamp)").toBe(true);
    expect(line?.textTransform, "its letters as written (a transform changes the commit's)").toBe('none');
  });
});

describe('with a malformed `deployed`', () => {
  test.for(THE_MALFORMED_CONFIGS_PAGES)('%s: nothing shows', (page) => {
    expect(withAMalformedConfig.get(page)).toBe(false);
  });
});
