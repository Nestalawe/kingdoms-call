# The browser specs: what only Chromium shows, and how a spec waits

How to run them is in [tests/README.md](../../tests/README.md#browser-specs). Paths without a folder in front
(`browser/`, `lib/`, `setup/`) are under `tests/`.

`npx playwright test` is [Playwright Test](https://playwright.dev) (`playwright.config.ts`). It runs the specs in
`tests/browser/*.spec.ts` in Chromium: what only a real browser shows (layout, the requests a page makes, a broken
image's `onerror` really firing). They are not part of `npm test`.

- **The site is served from one folder, as deployed**, by `browser/server.ts` (`lib/boot.ts`'s `serve`), which
  Playwright starts on port 4173: `site/`, or the copy in `KC_SITE` (`KC_SITE=/tmp/broken-site npx playwright test`).
  A server already on the port is never reused. Specs open pages by path (`page.goto('/kingdoms-call-gm-portal.html')`)
  and hand the page the fake (`browser/the-fake-db-handed-to-chromium.ts`), the screen tours (`lib/screens.ts`)
  among them.
- **The same answer every time**, as in Vitest: the Node check (`setup/global.ts`), the time zone and locale
  (`setup/fixed.mts`, in Node and in the browser), `KC_SEED` with the same default. No retries, and a `.only` fails
  the run. A failing spec keeps its trace in `test-results/` (in CI, the run's `playwright-traces` download).
- **Wait for what happens, never a fixed time.** ESLint makes `waitForTimeout` an error in the specs, as well as a
  focused or skipped spec (`eslint-plugin-playwright`). A spec waits for the page to finish starting
  (`browser/started.ts`: the last thing each page's own start-up does), and checks with `expect.poll` or web-first
  assertions, which retry until they pass or time out. Where a check is "it happens promptly", the poll's timeout is
  that time (`dispatches-badge`). Code a spec runs inside the page is passed as text when it uses the page's own
  globals.
- **The hostile-name tests are in two halves:** the jsdom half is one page test for each page
  (`page/the-*-hostile-names-show-as-text-…`), the Chromium half is `hostile-names.spec.ts`, one test per page and mode.
