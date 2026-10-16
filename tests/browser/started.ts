// When a page has finished starting, so a spec stages its screens only then. The scripts the specs replaced waited a
// fixed time instead (P1-01c). Each condition is the last thing the page's own start-up does.
import type { Page } from '@playwright/test';

/** The Hall of Fame: its spinner has gone (its start-up ends there, once the records are read). */
export async function spinnerGone(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getElementById('spinner')?.style.display === 'none');
}

/** Either portal, signed out: the sign-in screen is up. (Both hide their spinner before they ask for the session.) */
export async function signedOut(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getElementById('sec-auth')?.classList.contains('section-active'));
}

/** The player portal, signed in: My Games has loaded and its poll has started (onSignedIn's last step). */
export async function playerPortalSignedIn(page: Page): Promise<void> {
  await page.waitForFunction('typeof _pollTimer !== "undefined" && _pollTimer !== null');
}

/** The GM portal, signed in as a Game Master: the games have loaded and the auto-turn watcher has started. */
export async function gmPortalSignedIn(page: Page): Promise<void> {
  await page.waitForFunction('typeof _autoWatcherTimer !== "undefined" && _autoWatcherTimer !== null');
}

// Planted for the fail-first proof (P1-01c): a lint error, reverted in the next commit.
let planted = 1;
export { planted };
