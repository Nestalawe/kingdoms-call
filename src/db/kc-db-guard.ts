// Kingdoms Call: the database version guard (P0-34). Every page that uses the database declares KC_DB_MIN,
// the oldest database version it works with (a migration's 14-digit version), and starts with
//   kcDbGuard(db, KC_DB_MIN).then(init)
// so nothing is read or written until the database has said, through kc_db_version() (its Db's first area:
// the-db-interface-and-its-areas.ts), that it's new enough.
// Below KC_DB_MIN, or with no kc_db_version() at all (a database from before P0-34), it stops: it raises "The
// game is being updated…" as an error event, which the page's boot-failure reporter shows with a Reload
// button, and returns a promise that never settles, so init() never runs. A network failure is tried once
// more, then stops the same way: a page never carries on unchecked.
// On success the version is kept in <html data-kc-db="…"> and announced as the "kc-db-version" event (the
// staging footer shows it). Loaded after kc-config.js. Its one global name is kcDbGuard.
import type { ADatabaseAnswer, Db } from './the-db-interface-and-its-areas.ts';

/** A thrown value as `(e && e.message) || e` reads it: its message when it is an object or a function with a truthy
 *  one, else the value itself. */
function itsMessageOrItself(e: unknown): unknown {
  const message: unknown =
    (typeof e === 'object' || typeof e === 'function') && e !== null && 'message' in e ? e.message : undefined;
  if (message) return message;
  return e;
}

export async function kcDbGuard(db: Db, min: string): Promise<string> {
  const ask = async (): Promise<ADatabaseAnswer<string>> => {
    try {
      return await db.theDatabasesVersion.askTheDatabaseItsVersion();
    } catch (e) {
      return { data: null, error: { message: String(itsMessageOrItself(e)) }, status: 0 };
    }
  };
  let r = await ask();
  if (r.error && !r.status) r = await ask(); // no answer at all (network): once more
  const v = !r.error && typeof r.data === 'string' && /^\d{14}$/.test(r.data) ? r.data : null;
  if (!v || v < min) {
    const why = r.error
      ? r.status
        ? 'no version check in the database'
        : "the database didn't answer"
      : `database ${v ?? 'unknown'}`;
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: `The game is being updated. Try again in a few minutes. (${why}; this page needs ${min})`,
      }),
    );
    return new Promise<never>(() => undefined); // never settles: init() never runs
  }
  document.documentElement.setAttribute('data-kc-db', v);
  document.dispatchEvent(new CustomEvent('kc-db-version', { detail: v }));
  return v;
}
