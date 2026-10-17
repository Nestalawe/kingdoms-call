// Runs once before any test, in both runners (vitest.config.mts and playwright.config.ts):
// - the run stops at once if Node isn't the version pinned in .nvmrc (results must not depend on the machine);
// - it builds site/ from src/ (npm run build, tools/build.ts, P1-05), so no test opens stale pages. With KC_SITE set,
//   the tests open that copy instead, and nothing is built.
// Whether Playwright's Chromium is installed is Playwright's to say, in the browser specs' run: no Vitest test drives a
// browser (P1-01c).
import { execFileSync } from 'node:child_process';
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
  // In its own process, as npm run build runs it: the build is plain Node, and this file may be CommonJS.
  if (!process.env['KC_SITE']) execFileSync('npm', ['run', '--silent', 'build'], { stdio: 'inherit' });
}
