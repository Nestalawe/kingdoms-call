// The reload banner (plan P1-06, Decision 11): when the game has been updated while this page is open, a bar at the
// top says so, with a Reload button. It never reloads by itself: a player may be writing orders or a dispatch.
// Each of the four pages that read the database (the GM portal, the player portal, the Hall of Fame, the Overlord
// page) imports this file from its entry (page.ts), which starts the watch as the page loads. The rulebooks and the
// landing page have no data to go stale, so they don't.
// When the bar appears is a-newer-version-of-this-page.ts's decision: this page's fingerprint differs from the one
// version.json names for it, and has for 10 minutes (Decisions 8 and 9), so it appears 10 to 15 minutes after a deploy
// that changed this page, and never after one that didn't.
import { kcHtml } from './kc-safe.ts';
import { watchForANewerVersion } from './a-newer-version-of-this-page.ts';

/** The bar's id: there is never more than one. */
export const RELOAD_BANNER_ID = 'kc-reload-banner';

/** Shows the bar at the top of the page, once; a second call leaves the one there. */
export function showTheReloadBanner(): void {
  if (document.getElementById(RELOAD_BANNER_ID)) return;
  const bar = document.createElement('div');
  bar.id = RELOAD_BANNER_ID;
  bar.setAttribute('role', 'status');
  bar.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:2147483647;display:flex;flex-wrap:wrap;align-items:center;' +
    'justify-content:center;gap:12px;padding:10px 16px;background:#2b2118;color:#f5e6c8;border-bottom:2px solid #c9a227;' +
    'font:15px/1.4 Georgia,serif;box-shadow:0 2px 8px rgba(0,0,0,.4)';
  bar.innerHTML =
    String(kcHtml`<span>A new version of Kingdoms Call is ready. Save what you're doing, then reload.</span>
<button type="button" style="font:inherit;font-weight:bold;padding:4px 14px;cursor:pointer;background:#c9a227;color:#2b2118;border:1px solid #f5e6c8;border-radius:4px">Reload</button>`);
  bar.querySelector('button')?.addEventListener('click', () => {
    location.reload();
  });
  document.body.prepend(bar);
}

watchForANewerVersion(showTheReloadBanner);
