// ── CONFIG ────
if(typeof KC_CONFIG==='undefined') throw new Error('kc-config.js did not load: reload the page.');
const SUPABASE_URL = KC_CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = KC_CONFIG.supabaseKey;
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SEASONS = KC_SEASONS.slice();

// Declared globals (plan P1-09b): one binding the page's files and its tests share (ui/gm/globals.js says why).
globalThis.currentUser = null;
globalThis.currentGame = null;
globalThis.currentGamePlayers = [];

