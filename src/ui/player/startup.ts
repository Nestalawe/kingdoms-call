// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.

// The oldest database this page works with (P0-34): a migration's version. kcDbGuard checks it before the
// first read. Raise it when this page needs a newer database change (docs/traps.md, "A site change that needs
// a database change").
export const KC_DB_MIN = '20261015062128';
// ── CONFIG ────
if (typeof KC_CONFIG === 'undefined') throw new Error('kc-config.js did not load: reload the page.');
export const SUPABASE_URL = KC_CONFIG.supabaseUrl;
export const SUPABASE_ANON_KEY = KC_CONFIG.supabaseKey;
export const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// A list of kcHtml pieces with `sep` between them, to put into kcHtml (P0-19): .join(sep) would make them a plain
// string, which kcHtml shows as text. `sep` is text, or kcHtml for markup (kcHtml`<br>`).
export function kcJoinP(list, sep) {
  return list.flatMap((x, i) => (i ? [sep, x] : [x]));
}
