import { makeThePagesDatabase } from '../../db/the-pages-database-client.ts';

// The oldest database this page works with (P0-34): a migration's version. kcDbGuard checks it before the
// first read. Raise it when this page needs a newer database change (docs/traps.md, "A site change that needs
// a database change").
export const KC_DB_MIN = '20261015062128';
// ── CONFIG ────
if (typeof KC_CONFIG === 'undefined') throw new Error('kc-config.js did not load: reload the page.');
export const SUPABASE_URL = KC_CONFIG.supabaseUrl;
export const SUPABASE_ANON_KEY = KC_CONFIG.supabaseKey;
const thePagesDatabase = makeThePagesDatabase(SUPABASE_URL, SUPABASE_ANON_KEY);
export const sb = thePagesDatabase.client;
export const thePagesDb = thePagesDatabase.db;
