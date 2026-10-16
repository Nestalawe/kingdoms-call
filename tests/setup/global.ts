// Runs once before any test, in both runners (vitest.config.mts and playwright.config.ts): the run stops at once if
// Node isn't the version pinned in .nvmrc (results must not depend on the machine). Whether Playwright's Chromium is
// installed is Playwright's to say, in the browser specs' run: no Vitest test drives a browser (P1-01c).
import fs from 'node:fs';
import path from 'node:path';

export default function setup(): void {
  // Both runners start in the repository's root folder. Playwright loads this file as CommonJS, so no import.meta.
  const pinned = 'v' + fs.readFileSync(path.resolve('.nvmrc'), 'utf8').trim();
  if (process.version !== pinned) {
    throw new Error(
      `The tests need Node ${pinned} (.nvmrc); this is Node ${process.version}. Switch first, e.g. "nvm use" or "fnm use".`,
    );
  }
}
