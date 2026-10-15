// Runs once before any test: the run stops at once if Node isn't the version pinned in .nvmrc (results must not
// depend on the machine), or if Playwright's Chromium isn't installed (some test scripts drive it).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

export default function setup(): void {
  const root = path.resolve(import.meta.dirname, '..', '..');
  const pinned = 'v' + fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
  if (process.version !== pinned) {
    throw new Error(
      `The tests need Node ${pinned} (.nvmrc); this is Node ${process.version}. Switch first, e.g. "nvm use" or "fnm use".`,
    );
  }
  if (!fs.existsSync(chromium.executablePath())) {
    throw new Error('Chromium for Playwright is not installed. Run:  npx playwright install chromium');
  }
}
