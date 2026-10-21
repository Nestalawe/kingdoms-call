// A newer version of this page (plan P1-06, Decisions 7 to 10): has a deploy since this page loaded changed it?
// Each page carries its own version in its HTML, written by the build (tools/build.ts): <meta name="kc-build"> (the
// commit it was built from) and <meta name="kc-page-version"> (its fingerprint: a hash of the page and the files it
// names). Each deploy publishes version.json beside the pages: { commit, time, pages: { "<page>.html": fingerprint } }.
// - A newer version is this page's fingerprint in version.json, when it differs from the page's own. A deploy that
//   leaves this page as it was (a docs-only merge) is no news here.
// - It counts only 10 minutes after this page first sees it (COUNTS_AFTER_MS): GitHub's cache can hand out the old
//   page for up to 10 minutes after a deploy, so a reload sooner can bring the old page back.
// - A failed or missing version.json (the dev server, file://, jsdom, a network error) is no news, silently.
// - watchForANewerVersion() checks every 5 minutes, and when the tab is shown again (at most once a minute).
// The GM tab's reload before a due turn asks here (ui/gm/auto-turn.ts, refreshIfNewerBuild); P1-06d's banner will too.

/** The file each deploy publishes beside the pages. */
export const VERSION_FILE = 'version.json';
/** How often an open page checks it. */
export const CHECK_EVERY_MS = 5 * 60_000;
/** A tab shown again checks it, but not more often than this. */
export const CHECK_WHEN_SHOWN_AT_MOST_EVERY_MS = 60_000;
/** A newer version counts this long after this page first sees it. */
export const COUNTS_AFTER_MS = 10 * 60_000;

/** version.json, as the build writes it. */
export interface PublishedVersion {
  /** The commit the deploy was built from ("unknown" when the build had no git). */
  readonly commit: string;
  /** The commit's time (ISO), or null. */
  readonly time: string | null;
  /** Each page's fingerprint, by its file name. */
  readonly pages: Readonly<Record<string, string>>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `value` as version.json, or null if it isn't one. Read by hand: Zod isn't in the pages' bundles yet (P1-15). */
export function publishedVersionFrom(value: unknown): PublishedVersion | null {
  if (!isRecord(value) || typeof value['commit'] !== 'string' || !isRecord(value['pages'])) return null;
  const time = value['time'];
  if (time !== null && typeof time !== 'string') return null;
  const pages: Record<string, string> = {};
  for (const [page, fingerprint] of Object.entries(value['pages'])) {
    if (typeof fingerprint !== 'string') return null;
    pages[page] = fingerprint;
  }
  return { commit: value['commit'], time, pages };
}

const metaOf = (name: string): string | null =>
  typeof document === 'undefined'
    ? null
    : (document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null);

/** The commit this page was built from, as its footer shows it: 7 characters ("unknown" or "dev" when the build
 *  didn't know it); null when the page has no kc-build meta. */
export function thisPagesBuild(): string | null {
  const commit = metaOf('kc-build');
  if (commit === null) return null;
  return /^[0-9a-f]{7,40}$/.test(commit) ? commit.slice(0, 7) : commit;
}

/** This page's fingerprint, from its kc-page-version meta (null on the dev server, or a page without it). */
export const thisPagesFingerprint = (): string | null => metaOf('kc-page-version');

/** This page's file name in version.json: the last part of its address ("index.html" for the folder itself). */
export function thisPagesName(): string {
  const last = location.pathname.split('/').pop() ?? '';
  return last === '' ? 'index.html' : decodeURIComponent(last);
}

// When this page first saw each fingerprint version.json gave it.
const firstSeen = new Map<string, number>();
let lastCheckedAt = -Infinity;

/** The newer version of this page that `published` names, if it has counted for 10 minutes by `now`: the deploy's
 *  version.json, else null. Records when this page first saw it. */
function newerVersionIn(published: PublishedVersion, now: number): PublishedVersion | null {
  const mine = thisPagesFingerprint();
  const theirs = published.pages[thisPagesName()];
  if (mine === null || theirs === undefined || theirs === mine) return null;
  const seen = firstSeen.get(theirs);
  if (seen === undefined) {
    firstSeen.set(theirs, now);
    return null;
  }
  return now - seen >= COUNTS_AFTER_MS ? published : null;
}

/** Reads version.json now (never from the browser's cache): the deploy's version.json when it names a newer version
 *  of this page that has counted for 10 minutes, else null (also when version.json can't be read). */
export async function checkForANewerVersion(): Promise<PublishedVersion | null> {
  lastCheckedAt = Date.now();
  if (!/^https?:$/.test(location.protocol) || typeof fetch !== 'function') return null;
  let published: PublishedVersion | null;
  try {
    const answer = await fetch(VERSION_FILE, { cache: 'no-store' });
    published = answer.ok ? publishedVersionFrom(await answer.json()) : null;
  } catch {
    return null;
  }
  return published === null ? null : newerVersionIn(published, Date.now());
}

let watching = false;
/** Checks version.json now, then every 5 minutes, and when the tab is shown again (at most once a minute). Once per
 *  page: a second call does nothing. */
export function watchForANewerVersion(): void {
  if (watching) return;
  watching = true;
  void checkForANewerVersion();
  setInterval(() => void checkForANewerVersion(), CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheckedAt >= CHECK_WHEN_SHOWN_AT_MOST_EVERY_MS)
      void checkForANewerVersion();
  });
}
