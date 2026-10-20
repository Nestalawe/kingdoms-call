// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
// Kingdoms Call: the database version guard (P0-34). Every page that uses the database declares KC_DB_MIN,
// the oldest database version it works with (a migration's 14-digit version), and starts with
//   kcDbGuard(sb, KC_DB_MIN).then(init)
// so nothing is read or written until the database has said, through kc_db_version(), that it's new enough.
// Below KC_DB_MIN, or with no kc_db_version() at all (a database from before P0-34), it stops: it raises "The
// game is being updated…" as an error event, which the page's boot-failure reporter shows with a Reload
// button, and returns a promise that never settles, so init() never runs. A network failure is tried once
// more, then stops the same way: a page never carries on unchecked.
// On success the version is kept in <html data-kc-db="…"> and announced as the "kc-db-version" event (the
// staging footer shows it). Loaded after kc-config.js. Its one global name is kcDbGuard.
export async function kcDbGuard(sb, min) {
  const ask = async () => {
    try {
      return await sb.rpc('kc_db_version');
    } catch (e) {
      return { data: null, error: { message: String((e && e.message) || e) }, status: 0 };
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
      : `database ${v || 'unknown'}`;
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: `The game is being updated. Try again in a few minutes. (${why}; this page needs ${min})`,
      }),
    );
    return new Promise(() => {});
  }
  document.documentElement.setAttribute('data-kc-db', v);
  document.dispatchEvent(new CustomEvent('kc-db-version', { detail: v }));
  return v;
}
