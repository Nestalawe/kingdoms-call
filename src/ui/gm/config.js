// ── CONFIG ────
if(typeof KC_CONFIG==='undefined') throw new Error('kc-config.js did not load: reload the page.');
const SUPABASE_URL = KC_CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = KC_CONFIG.supabaseKey;
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SEASONS = KC_SEASONS.slice();

let currentUser = null;
let currentGame = null;
let currentGamePlayers = [];

