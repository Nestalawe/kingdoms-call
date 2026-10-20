import { KC_SEASONS } from '../../content/kingdoms-call-data.js';

// ── CONFIG ────
if (typeof KC_CONFIG === 'undefined') throw new Error('kc-config.js did not load: reload the page.');
export const SUPABASE_URL = KC_CONFIG.supabaseUrl;
export const SUPABASE_ANON_KEY = KC_CONFIG.supabaseKey;
export const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const SEASONS = KC_SEASONS.slice();

// Declared globals (plan P1-09b): one binding the page's files and its tests share (ui/gm/globals.js says why).
globalThis.currentUser = null;
globalThis.currentGame = null;
globalThis.currentGamePlayers = [];
