// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { kcDbGuard } from '../../db/kc-db-guard.ts';

// ══════════════════════════════════════════════════════════════════════════════════════════════
// KINGDOMS CALL — HALL OF FAME
// ══════════════════════════════════════════════════════════════════════════════════════════════
// Reads ONE table, public.game_records: one row per finished game, written by the GM portal when
// the game ends (or by its "Record missing games" button). Every figure on this page was computed
// there, where the engine's tables live; this page only filters, merges and ranks. That is
// deliberate — the alternative, reading turn_events here, is tens of megabytes per visit and would
// repeat the 2026-09-25 Disk-IO fault.
//
// GM MODE. Opened from the GM portal the link carries ?gm=1. Edit controls appear only for the signed-in
// account's own games' entries (it owns at least one row in `games`), or every entry for the Overlord, who
// alone renames players (P0-22, rulings D-09, D-11). The database enforces the same, so ?gm=1 by itself
// grants nothing.
if (typeof KC_CONFIG === 'undefined') throw new Error('kc-config.js did not load: reload the page.');
export const SUPABASE_URL = KC_CONFIG.supabaseUrl;
export const SUPABASE_ANON_KEY = KC_CONFIG.supabaseKey;
export const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// The oldest database this page works with (P0-34): a migration's version. kcDbGuard checks it before the
// first read. Raise it when this page needs a newer database change (docs/traps.md, "A site change that needs
// a database change").
export const KC_DB_MIN = '20261012064100';

// A declared global (plan P1-09b): one binding the page's files and its tests share (ui/leaderboard/globals.ts says why).
globalThis.GAMES = [];
export let TAB = 'champions',
  GM = false,
  OVERLORD = false,
  ME = null,
  PEOPLE = {};
// May the signed-in account edit this entry? Its GM, or the Overlord (the database's rule, P0-22).
export const canEdit = (g) => OVERLORD || !!(ME && g && g.gm_user_id === ME.id);
// ── REALM ≠ PLAYER ────────────────────────────────────────────────────────────────────────────
// A realm name is per game — the same person rules Aranthia one season and the Vale the next. The
// PERSON is their auth account, and their name lives in `profiles.name`. Every player statistic on
// this board is keyed on that id (`uid` in the standings) and printed with the name the profile
// carries RIGHT NOW, so renaming yourself renames your whole history instead of splitting it.
// `PEOPLE` is that lookup; if it cannot be read (signed out, or RLS), each standing's stored
// `player` — the name at the time the game ended — is used instead.
// The stored `player` is only a fallback for when profiles cannot be read. A row written by the
// FIRST build (lb1) put the KINGDOM name in that field, so a legacy row would otherwise print the
// realm twice. Any stored name equal to the realm is therefore refused outright — it is either
// that bug or a realm named after its ruler, and in both cases it tells the reader nothing.
export const personName = (st) => {
  if (!st) return null;
  if (st.uid && PEOPLE[st.uid]) return PEOPLE[st.uid];
  if (st.player && st.player !== st.realm) return st.player;
  return null;
};
export const isLegacyRow = (g) =>
  !(g && /lb[2-9]/.test(String(g.build || ''))) || !(g && (g.standings || []).some((st) => st && !st.bot && st.uid));
// A record points at a realm by index; who that was lives once, in its game's standings.
export function whoOf(e) {
  const st = ((e.g && e.g.standings) || []).find((x) => x && x.pi === e.pi);
  if (st)
    return { realm: st.realm, player: personName(st), race: st.race, al: st.al, bot: !!st.bot, uid: st.uid || null };
  // a row written by the first build (lb1) carried the identity on the record itself
  return {
    realm: e.realm || null,
    player: e.player || null,
    race: e.race || null,
    al: e.al || null,
    bot: !!e.bot,
    uid: null,
  };
}
export const $ = (id) => document.getElementById(id);
export const nf = (n) =>
  n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-NZ', { maximumFractionDigits: 2 });
export const dstr = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── THE ACHIEVEMENT CATALOGUE ─────────────────────────────────────────────────────────────────
// key → {c category, l label, n note, f format, d direction}. The GM portal's buildGameRecords()
// emits the keys; a key missing from here still appears, under "Other records", with its key
// prettified — so the two can never fall out of step in a way that loses a record.
// f: int · pct · x (a multiplier) · power (guardian band) · hp · turn
export const KC_CAT = [
  ['realm', '👑 Realm & dominion'],
  ['conquest', '⚔ Conquest'],
  ['armies', '🛡 Hosts & armies'],
  ['battles', '💥 Battles'],
  ['lairs', '🐉 Lairs & guardians'],
  ['heroes', '🎖 Champions'],
  ['skills', '📖 Skills at their height'],
  ['titles', '🏅 Imperial Titles'],
  ['magic', '✨ Magic'],
  ['finish', '🏁 At the final Reckoning'],
  ['dubious', '💀 Dubious honours'],
  ['games', '🌍 The games themselves'],
  ['other', '❓ Other records'],
];
export const KC_ACH = {
  most_provinces: { c: 'realm', l: 'Widest realm', n: 'Most provinces held at one moment', f: 'int' },
  most_land: { c: 'realm', l: 'Greatest landholder', n: 'Most land provinces held at once', f: 'int' },
  most_sea: { c: 'realm', l: 'Master of the waves', n: 'Most sea provinces held at once', f: 'int' },
  top_tax_share: { c: 'realm', l: 'Shadow over the world', n: 'Greatest share of the world’s tax base', f: 'pct' },
  richest: { c: 'realm', l: 'Fullest treasury', n: 'Most gold held at one moment', f: 'int' },
  gold_gain_turn: { c: 'realm', l: 'Greatest windfall', n: 'Most gold gained in a single turn', f: 'int' },
  str_gain_turn: { c: 'realm', l: 'Fastest muster', n: 'Most army strength raised in one turn', f: 'int' },
  most_explored: { c: 'realm', l: 'Great explorer', n: 'Most provinces ever seen by a realm', f: 'int' },
  most_discoveries: { c: 'realm', l: 'Most learned realm', n: 'Most discoveries held at once', f: 'int' },
  most_consecrated: { c: 'realm', l: 'Most holy ground', n: 'Most consecrated provinces held', f: 'int' },
  most_relics: { c: 'realm', l: 'Greatest relic hoard', n: 'Most legendary relics held by one realm', f: 'int' },
  most_heroes: { c: 'realm', l: 'Largest court', n: 'Most living heroes serving at once', f: 'int' },
  most_units_realm: { c: 'realm', l: 'Most under arms', n: 'Most units in a realm at one time', f: 'int' },
  largest_garrison: { c: 'realm', l: 'Strongest garrisons', n: 'Greatest garrison strength held', f: 'int' },

  captures_turn: { c: 'conquest', l: 'Blitzkrieg', n: 'Most provinces taken in a single turn', f: 'int' },
  captures_game: { c: 'conquest', l: 'Great conqueror', n: 'Most provinces taken across a game', f: 'int' },
  richest_capture: { c: 'conquest', l: 'Richest prize', n: 'Highest tax value of a province taken', f: 'int' },
  fastest_ten: {
    c: 'conquest',
    l: 'Fastest to ten provinces',
    n: 'Earliest turn a realm reached ten',
    f: 'turn',
    d: 'min',
  },

  mightiest_host: {
    c: 'armies',
    l: 'Mightiest realm',
    n: 'Greatest total army strength, led and garrisoned',
    f: 'int',
  },
  biggest_field_army: {
    c: 'armies',
    l: 'Greatest army in the field',
    n: 'Strongest host under a single commander',
    f: 'int',
  },
  most_units_one_char: {
    c: 'armies',
    l: 'Most units under one banner',
    n: 'Most units led by one character',
    f: 'int',
  },
  grand_armada: {
    c: 'armies',
    l: 'Grand armada',
    n: 'Strongest fleet and sea-beast host led by one commander',
    f: 'int',
  },
  sky_host: { c: 'armies', l: 'Host of the air', n: 'Strongest airborne host led by one commander', f: 'int' },
  beast_host: {
    c: 'armies',
    l: 'Host of beasts',
    n: 'Strongest creature and monster host led by one commander',
    f: 'int',
  },
  horse_host: { c: 'armies', l: 'Host of horse', n: 'Strongest cavalry host led by one commander', f: 'int' },
  arrow_storm: { c: 'armies', l: 'Storm of arrows', n: 'Strongest ranged host led by one commander', f: 'int' },
  undead_legion: { c: 'armies', l: 'Undead legion', n: 'Most skeletal units led by one commander', f: 'int' },

  biggest_battle: { c: 'battles', l: 'Biggest battle', n: 'Greatest combined strength on a field', f: 'int' },
  biggest_pvp: { c: 'battles', l: 'Greatest clash of realms', n: 'Biggest battle between two players', f: 'int' },
  bloodiest_battle: { c: 'battles', l: 'Bloodiest battle', n: 'Most units destroyed in one battle', f: 'int' },
  greatest_upset: {
    c: 'battles',
    l: 'Greatest upset',
    n: 'Won a battle at the longest odds of strength',
    f: 'x',
    d: 'min',
  },
  stubbornest_defence: {
    c: 'battles',
    l: 'Most stubborn defence',
    n: 'Held the field against the heaviest odds',
    f: 'x',
    d: 'min',
  },
  flawless_victory: {
    c: 'battles',
    l: 'Flawless victory',
    n: 'Most enemy strength broken without losing a unit',
    f: 'int',
  },
  longest_siege: { c: 'battles', l: 'Longest battle', n: 'Most carried-over rounds of fighting', f: 'int' },
  battles_turn: { c: 'battles', l: 'Busiest turn of war', n: 'Most battles fought by a realm in one turn', f: 'int' },
  battles_game: { c: 'battles', l: 'Most battles in a game', n: 'By one realm across the whole game', f: 'int' },
  battles_won_game: { c: 'battles', l: 'Most victories in a game', n: 'Battles won by one realm', f: 'int' },
  kills_turn: { c: 'battles', l: 'Deadliest turn', n: 'Most enemy units destroyed in one turn', f: 'int' },
  kills_game: { c: 'battles', l: 'Most enemy units destroyed', n: 'By one realm across a game', f: 'int' },
  best_win_rate: {
    c: 'battles',
    l: 'Finest record of arms',
    n: 'Best battle win rate (four battles or more)',
    f: 'pct',
  },

  guardian_slain: {
    c: 'lairs',
    l: 'Greatest guardian slain',
    n: 'Strongest band of guardian beaten in a lair',
    f: 'power',
  },
  luckiest_kill: {
    c: 'lairs',
    l: 'Luckiest guardian kill',
    n: 'Beat a Powerful or Legendary guardian with the fewest hit points left',
    f: 'hp',
    d: 'min',
  },
  narrowest_escape: {
    c: 'lairs',
    l: 'Narrowest escape',
    n: 'Won a lair fight on the fewest hit points',
    f: 'hp',
    d: 'min',
  },
  hardest_fight: { c: 'lairs', l: 'Hardest-won lair', n: 'Most damage taken and still victorious', f: 'int' },
  lairs_turn: { c: 'lairs', l: 'Most lairs cleared in a turn', n: 'By one realm', f: 'int' },
  lairs_game: { c: 'lairs', l: 'Great lair-breaker', n: 'Most lairs cleared across a game', f: 'int' },
  deadliest_guardian: {
    c: 'lairs',
    l: 'Deadliest guardian',
    n: 'The strongest guardian to slay a champion',
    f: 'power',
  },

  greatest_hero: {
    c: 'heroes',
    l: 'Greatest champion',
    n: 'Highest total of all skill levels on one character',
    f: 'int',
  },
  most_items_one_char: { c: 'heroes', l: 'Best-equipped champion', n: 'Most magic items carried at once', f: 'int' },
  hardiest: { c: 'heroes', l: 'Hardiest champion', n: 'Highest maximum hit points reached', f: 'int' },
  deadliest_champion: {
    c: 'heroes',
    l: 'Deadliest champion',
    n: 'Most enemy characters slain by one character',
    f: 'int',
  },
  champions_slain: { c: 'heroes', l: 'Slayer of champions', n: 'Most enemy characters slain by a realm', f: 'int' },
  kingslayer: { c: 'heroes', l: 'Kingslayer', n: 'Most enemy kings slain by a realm', f: 'int' },

  spells_turn: { c: 'magic', l: 'Storm of sorcery', n: 'Most spells cast by a realm in one turn', f: 'int' },
  spells_game: { c: 'magic', l: 'Greatest sorcery', n: 'Most spells cast across a game', f: 'int' },
  longest_shot: { c: 'magic', l: 'Longest shot', n: 'The least likely casting that still took', f: 'pct', d: 'min' },
  grandest_casting: { c: 'magic', l: 'Grandest casting', n: 'Highest spell level successfully cast', f: 'int' },
  favourite_spell: { c: 'magic', l: 'Signature spell', n: 'The spell one realm leaned on hardest in a game', f: 'int' },

  final_score: { c: 'finish', l: 'Highest final score', n: 'At the Reckoning', f: 'int' },
  final_provinces: { c: 'finish', l: 'Largest realm at the end', f: 'int' },
  final_gold: { c: 'finish', l: 'Richest at the end', f: 'int' },
  final_strength: { c: 'finish', l: 'Strongest at the end', f: 'int' },
  final_tax_share: { c: 'finish', l: 'Greatest share at the end', f: 'pct' },

  losses_turn: { c: 'dubious', l: 'Heaviest day', n: 'Most of a realm’s own units destroyed in one turn', f: 'int' },
  losses_game: {
    c: 'dubious',
    l: 'Heaviest losses',
    n: 'Most of a realm’s own units destroyed across a game',
    f: 'int',
  },
  lost_turn: { c: 'dubious', l: 'Worst turn', n: 'Most provinces lost in a single turn', f: 'int' },
  lost_game: { c: 'dubious', l: 'Greatest collapse', n: 'Most provinces lost across a game', f: 'int' },
  worst_rout: { c: 'dubious', l: 'Worst rout', n: 'Most units lost in a single battle', f: 'int' },
  champions_lost: {
    c: 'dubious',
    l: 'Heaviest toll',
    n: 'Most of a realm’s own characters killed in a game',
    f: 'int',
  },
  deaths_turn: { c: 'dubious', l: 'Blackest day', n: 'Most of a realm’s characters killed in one turn', f: 'int' },
  flights_game: { c: 'dubious', l: 'Better part of valour', n: 'Most flights from lair fights in a game', f: 'int' },
  failed_spells_game: { c: 'dubious', l: 'Fizzled', n: 'Most failed castings in a game', f: 'int' },
  earliest_out: {
    c: 'dubious',
    l: 'Shortest reign',
    n: 'Earliest turn a realm was eliminated or conceded',
    f: 'turn',
    d: 'min',
  },

  longest_game: { c: 'games', l: 'Longest game', f: 'int' },
  shortest_game: { c: 'games', l: 'Shortest game', f: 'int', d: 'min' },
  most_realms: { c: 'games', l: 'Most realms in a game', f: 'int' },
  most_humans: { c: 'games', l: 'Most human players', f: 'int' },
  biggest_world: { c: 'games', l: 'Biggest world', n: 'Provinces on the map', f: 'int' },
  most_battles_game: { c: 'games', l: 'Most battles in one game', f: 'int' },
  bloodiest_game: { c: 'games', l: 'Bloodiest game', n: 'Units destroyed in total', f: 'int' },
  most_captures_game: { c: 'games', l: 'Most provinces changing hands', f: 'int' },
  most_deaths_game: { c: 'games', l: 'Most characters killed', f: 'int' },
  most_lairs_game: { c: 'games', l: 'Most lairs fought', f: 'int' },
  most_spells_game: { c: 'games', l: 'Most spells cast', f: 'int' },
};
export const POWER_WORD = ['—', 'Weak', 'Moderate', 'Powerful', 'Legendary'];
export function achDef(key) {
  if (KC_ACH[key]) return KC_ACH[key];
  if (key.indexOf('sk_') === 0) return { c: 'skills', l: null, f: 'int' };
  if (key.indexOf('title_') === 0) return { c: 'titles', l: null, f: 'int' };
  return { c: 'other', l: null, f: 'int' };
}
export function achLabel(key, rec) {
  if (rec && rec.lbl) return rec.lbl;
  const d = KC_ACH[key];
  if (d && d.l) return d.l;
  return key
    .replace(/^sk_/, 'Highest ')
    .replace(/^title_/, 'Title: ')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}
export function fmtVal(v, f) {
  if (v == null) return '—';
  switch (f) {
    case 'pct':
      return nf(v) + '%';
    case 'x':
      return nf(v) + '×';
    case 'power':
      return POWER_WORD[Math.max(0, Math.min(4, Math.round(v)))] || nf(v);
    case 'hp':
      return nf(v) + ' hp';
    case 'turn':
      return 'turn ' + nf(v);
    default:
      return nf(v);
  }
}

// ── LOADING ───────────────────────────────────────────────────────────────────────────────────
export async function loadAll(force) {
  const msg = $('msg');
  try {
    const {
      data: { session },
    } = await sb.auth.getSession();
    ME = session ? session.user : null;
  } catch (e) {
    ME = null;
  }
  GM = false;
  OVERLORD = false;
  if (ME && new URLSearchParams(location.search).get('gm') === '1') {
    try {
      const [{ data }, ov] = await Promise.all([
        sb.from('games').select('id').eq('gm_user_id', ME.id).limit(1),
        sb.rpc('is_site_admin'),
      ]);
      OVERLORD = !!(ov && !ov.error && ov.data === true);
      GM = OVERLORD || !!(data && data.length);
    } catch (e) {
      GM = false;
      OVERLORD = false;
    }
  }
  $('gm-pill').innerHTML = GM ? '<span class="btn btn-gold" style="cursor:default">✏ GM editing on</span>' : '';
  $('show-hidden-wrap').style.display = GM ? 'inline-flex' : 'none';

  const rows = [];
  try {
    for (let from = 0; ; from += 200) {
      const { data, error } = await sb
        .from('game_records')
        .select('*')
        .order('finished_at', { ascending: false })
        .range(from, from + 199);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 200) break;
    }
  } catch (e) {
    $('spinner').style.display = 'none';
    $('main').style.display = 'block';
    msg.innerHTML = kcHtml`<div class="msg-error"><strong>The Hall of Fame could not be read.</strong> ${e.message || e}<br>If you are the Game Master, open the GM portal — the game list shows the one statement to run in Supabase that creates the <code>game_records</code> table.</div>`;
    $('body').innerHTML = '';
    return;
  }
  GAMES = rows.map((r) => ({
    ...r,
    setup: jp(r.setup) || {},
    standings: jp(r.standings) || [],
    records: jp(r.records) || {},
    totals: jp(r.totals) || {},
  }));
  // the people behind the realms, by their current name
  PEOPLE = {};
  try {
    const { data: profs } = await sb.from('profiles').select('id,name');
    (profs || []).forEach((r) => {
      if (r && r.id && r.name) PEOPLE[r.id] = r.name;
    });
  } catch (e) {
    /* signed out, or the profiles policy does not cover this reader — snapshot names are used */
  }
  msg.innerHTML = GAMES.length
    ? ''
    : '<div class="msg-info">No finished games have been recorded yet. A game joins the Hall of Fame the moment it ends; the GM can also add older games from the GM portal’s Stats tab.</div>';
  buildFilterOptions();
  $('spinner').style.display = 'none';
  $('main').style.display = 'block';
  render();
}
export function jp(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch (e) {
      return null;
    }
  }
  return v;
}

export function buildFilterOptions() {
  const opt = (sel, vals, fmt) => {
    const el = $(sel),
      cur = el.value;
    el.replaceChildren(el.options[0], ...vals.map((v) => new Option(String(fmt ? fmt(v) : v), String(v))));
    el.value = cur;
  };
  const uniqNum = (k) => [...new Set(GAMES.map((g) => g.setup[k]).filter((v) => v != null))].sort((a, b) => a - b);
  opt('f-bots', uniqNum('bots'));
  opt('f-realms', uniqNum('realms'));
  opt('f-humans', uniqNum('humans'));
  const maps = [...new Set(GAMES.map(mapKey).filter(Boolean))].sort();
  opt('f-map', maps);
}
export function mapKey(g) {
  const s = g.setup || {};
  return s.cols && s.rows ? s.cols + '×' + s.rows : s.mapSize || null;
}

// ── FILTERING ─────────────────────────────────────────────────────────────────────────────────
export function filtered() {
  const v = (id) => $(id).value,
    q = (v('f-q') || '').trim().toLowerCase();
  const from = v('f-from') ? new Date(v('f-from') + 'T00:00:00') : null;
  const to = v('f-to') ? new Date(v('f-to') + 'T23:59:59') : null;
  const showHidden = GM && $('f-hidden').checked;
  return GAMES.filter((g) => {
    const s = g.setup || {},
      bots = s.bots || 0,
      humans = s.humans != null ? s.humans : (s.realms || 0) - bots;
    if (g.hidden && !showHidden) return false;
    const kind = v('f-kind');
    if (kind === 'human' && bots > 0) return false;
    if (kind === 'withbots' && bots < 1) return false;
    if (kind === 'allbot' && humans > 0) return false;
    if (kind === 'mixed' && !(bots > 0 && humans > 0)) return false;
    if (v('f-bots') !== '' && String(bots) !== v('f-bots')) return false;
    if (v('f-diplo') !== '' && (s.diplomacy || 'normal') !== v('f-diplo')) return false;
    if (v('f-realms') !== '' && String(s.realms || '') !== v('f-realms')) return false;
    if (v('f-humans') !== '' && String(humans) !== v('f-humans')) return false;
    if (v('f-map') !== '' && mapKey(g) !== v('f-map')) return false;
    const sp = s.seaPct;
    if (v('f-sea') === 'lo' && !(sp != null && sp < 30)) return false;
    if (v('f-sea') === 'mid' && !(sp != null && sp >= 30 && sp <= 45)) return false;
    if (v('f-sea') === 'hi' && !(sp != null && sp > 45)) return false;
    if (v('f-vic') !== '' && (g.victory || '') !== v('f-vic')) return false;
    const t = g.turns || 0;
    if (v('f-len') === 's' && !(t <= 10)) return false;
    if (v('f-len') === 'm' && !(t > 10 && t <= 20)) return false;
    if (v('f-len') === 'l' && !(t > 20)) return false;
    if (from && new Date(g.finished_at || 0) < from) return false;
    if (to && new Date(g.finished_at || 0) > to) return false;
    if (q) {
      const hay = [g.game_name, g.winner_realm, g.note]
        .concat((g.standings || []).map((x) => [x.realm, x.player, personName(x)].filter(Boolean).join(' ')))
        .join(' ')
        .toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
}
export function resetFilters() {
  ['f-kind', 'f-bots', 'f-diplo', 'f-realms', 'f-humans', 'f-map', 'f-sea', 'f-vic', 'f-len'].forEach(
    (i) => ($(i).value = ''),
  );
  $('f-from').value = '';
  $('f-to').value = '';
  $('f-q').value = '';
  if ($('f-hidden')) $('f-hidden').checked = false;
  render();
}
export function setTab(t) {
  TAB = t;
  ['champions', 'achievements', 'peoples', 'games'].forEach((x) => $('tb-' + x).classList.toggle('active', x === t));
  render();
}

// ── RENDER ────────────────────────────────────────────────────────────────────────────────────
export function render() {
  const G = filtered();
  $('filter-count').textContent = `${G.length} of ${GAMES.length} recorded game${GAMES.length === 1 ? '' : 's'}`;
  const el = $('body');
  if (!GAMES.length) {
    el.innerHTML = '';
    $('foot').textContent = '';
    return;
  }
  if (!G.length) {
    el.innerHTML = '<div class="card"><div class="msg-warning">No recorded game matches these filters.</div></div>';
    return;
  }
  if (TAB === 'champions') el.innerHTML = renderChampions(G);
  else if (TAB === 'achievements') el.innerHTML = renderAchievements(G);
  else if (TAB === 'peoples') el.innerHTML = renderPeoples(G);
  else el.innerHTML = renderGames(G);
  const last = G.map((g) => g.finished_at)
    .filter(Boolean)
    .sort()
    .slice(-1)[0];
  $('foot').textContent = 'Kingdoms Call — Hall of Fame v2026.10.16-0735 · most recent game recorded ' + dstr(last);
}

// GM-only. Answers, on the page, the question "why are the names wrong?" — which of the three
// possible causes is in play: rows written by the old builder, no player account on the slots, or
// `profiles` unreadable.
export function lbDiagnostics(G) {
  const legacy = G.filter(isLegacyRow);
  let humanSlots = 0,
    withUid = 0,
    named = 0;
  G.forEach((g) =>
    (g.standings || []).forEach((st) => {
      if (!st || st.bot) return;
      humanSlots++;
      if (st.uid) withUid++;
      if (personName(st)) named++;
    }),
  );
  const builds = [...new Set(G.map((g) => String(g.build || 'unknown')))];
  const newest =
    (G.slice().sort((a, b) => String(b.finished_at || '').localeCompare(String(a.finished_at || '')))[0] || {}).build ||
    '—';
  const peopleN = Object.keys(PEOPLE).length;
  const warn = [];
  if (legacy.length)
    warn.push(kcHtml`<div class="msg-warning" style="margin:8px 0 0"><strong>${legacy.length} of ${G.length} games were recorded by an older build of the GM portal</strong>, which stored the realm name where the player's name belongs. Those games show no player until they are rebuilt.<br>
    In the GM portal: check the footer reads <strong>v2026.09.27-1958 or later</strong> first — if it does not, hard-reload it (Ctrl/Cmd+Shift+R), because a cached copy will rebuild with the same fault. Then 📈 Stats → <strong>↻ Rebuild all</strong>.</div>`);
  if (!peopleN)
    warn.push(
      kcHtml`<div class="msg-warning" style="margin:8px 0 0"><strong>No player names could be read from the <code>profiles</code> table on this page</strong> — names stored with each game are being used instead. If you are signed out, sign in to the player or GM portal in this browser first. If you are signed in, the <code>profiles</code> table needs a SELECT policy covering this account.</div>`,
    );
  if (peopleN && withUid && !named)
    warn.push(
      kcHtml`<div class="msg-warning" style="margin:8px 0 0"><strong>${withUid} player slots carry an account, but none of them matches a row in <code>profiles</code>.</strong> Those accounts have no profile row, or no name in it. Each player can set one with <strong>✏ Change Display Name</strong> in the player portal; you can set it here with the ✏ beside their line once they appear.</div>`,
    );
  return kcHtml`<div class="card"><h2>🔧 Diagnostics <span class="muted" style="font-weight:400">— only you see this</span></h2>
    <table class="kc">
      <tr><th>Games on the board</th><td class="num">${G.length}</td><td class="muted">${legacy.length} recorded by an older build</td></tr>
      <tr><th>Newest row built by</th><td colspan="2"><code>${newest}</code></td></tr>
      <tr><th>Builds present</th><td colspan="2" class="muted">${builds.join(' · ')}</td></tr>
      <tr><th>Human realms</th><td class="num">${humanSlots}</td><td class="muted">${withUid} carry a player account · ${named} resolve to a name</td></tr>
      <tr><th>Names read from profiles</th><td class="num">${peopleN}</td><td class="muted">${peopleN ? 'read live, so a rename shows everywhere at once' : 'falling back to the name stored with each game'}</td></tr>
    </table>${warn}</div>`;
}
export function winnerName(g) {
  const st = (g.standings || []).find((x) => x && x.winner);
  return (st && personName(st)) || g.winner_player || null;
}
export function pctBar(n, d) {
  const p = d ? Math.round((100 * n) / d) : 0;
  return kcHtml`<div class="bar" title="${p}%"><i style="width:${p}%"></i></div>`;
}

// —— CHAMPIONS ————————————————————————————————————————————————————————————————————————————————
export function renderChampions(G) {
  // One line per PERSON, keyed on their account id — not on a realm name and not on the name they
  // happened to be using at the time. A player who ruled Aranthia, then the Vale, then Karn is one
  // champion with three realms listed, and renaming themselves moves the whole line.
  const byPlayer = {};
  G.forEach((g) =>
    (g.standings || []).forEach((st) => {
      if (!st || st.bot) return;
      const nm = personName(st);
      const key = st.uid || (nm ? 'name:' + nm : null);
      if (!key) return;
      const a = (byPlayer[key] = byPlayer[key] || {
        key,
        uid: st.uid || null,
        name: nm || '(name not recorded)',
        games: 0,
        wins: 0,
        podium: 0,
        rankSum: 0,
        ranked: 0,
        score: 0,
        best: 0,
        titles: 0,
        realms: new Set(),
      });
      a.games++;
      if (st.winner) a.wins++;
      if (st.rank) {
        a.ranked++;
        a.rankSum += st.rank;
        if (st.rank <= 3) a.podium++;
      }
      a.score += st.score || 0;
      a.best = Math.max(a.best, st.score || 0);
      a.titles += (st.titles || []).length;
      if (st.realm) a.realms.add(st.realm);
    }),
  );
  const rows = Object.values(byPlayer).sort(
    (a, b) => b.wins - a.wins || b.wins / b.games - a.wins / a.games || b.score - a.score,
  );
  const out = [];
  if (GM) out.push(lbDiagnostics(G));
  out.push(kcHtml`<div class="card"><h2>🏆 Champions — the players</h2>`);
  out.push(
    kcHtml`<div class="muted" style="margin-bottom:9px">One line per person, however many realms they have ruled. Realm names change from game to game; the player does not.${OVERLORD ? ' As the Overlord you can correct a player’s name here — it changes their name everywhere on the board, past games included.' : ''}</div>`,
  );
  if (!rows.length)
    out.push(kcHtml`<div class="msg-info">No human players in the games that match these filters.</div>`);
  else {
    out.push(
      kcHtml`<table class="kc" id="champ-table"><tr><th>#</th><th>Player</th><th class="num">Games</th><th class="num">Wins</th><th>Win rate</th><th class="num">Top 3</th><th class="num">Avg rank</th><th class="num">Best score</th><th class="num">Titles</th><th>Realms ruled</th>${OVERLORD ? kcHtml`<th></th>` : ''}</tr>`,
    );
    rows.forEach((r, i) => {
      const rl = [...r.realms];
      out.push(
        kcHtml`<tr><td>${i + 1}</td><td><strong>${r.name}</strong></td><td class="num">${r.games}</td><td class="num">${r.wins}</td>`,
        kcHtml`<td style="min-width:90px">${pctBar(r.wins, r.games)}<span class="muted">${Math.round((100 * r.wins) / r.games)}%</span></td>`,
        kcHtml`<td class="num">${r.podium}</td><td class="num">${r.ranked ? (r.rankSum / r.ranked).toFixed(1) : '—'}</td>`,
        kcHtml`<td class="num">${nf(r.best)}</td><td class="num">${r.titles}</td>`,
        kcHtml`<td class="muted">${rl.slice(0, 4).join(', ')}${rl.length > 4 ? ' +' + (rl.length - 4) : ''}</td>`,
        OVERLORD
          ? kcHtml`<td>${r.uid ? kcHtml`<button class="btn btn-ghost" style="font-size:.6rem;padding:3px 8px" onclick="renamePlayer(${kcArg(r.uid)})">✏</button>` : kcHtml`<span class="muted" title="This player has no account on record — nothing to rename">—</span>`}</td>`
          : '',
        kcHtml`</tr>`,
      );
    });
    out.push(kcHtml`</table><div id="rename-msg"></div>`);
  }
  out.push(kcHtml`</div>`);

  // humans vs bots
  let hG = 0,
    hW = 0,
    bG = 0,
    bW = 0;
  G.forEach((g) =>
    (g.standings || []).forEach((st) => {
      if (st.bot) {
        bG++;
        if (st.winner) bW++;
      } else {
        hG++;
        if (st.winner) hW++;
      }
    }),
  );
  out.push(
    kcHtml`<div class="card"><h2>⚖ Humans against the bots</h2><table class="kc">`,
    kcHtml`<tr><th>Side</th><th class="num">Realms played</th><th class="num">Wins</th><th>Win rate</th></tr>`,
    kcHtml`<tr><td>Human realms</td><td class="num">${hG}</td><td class="num">${hW}</td><td style="min-width:110px">${pctBar(hW, hG)}<span class="muted">${hG ? Math.round((100 * hW) / hG) : 0}%</span></td></tr>`,
    kcHtml`<tr><td>Bot realms</td><td class="num">${bG}</td><td class="num">${bW}</td><td>${pctBar(bW, bG)}<span class="muted">${bG ? Math.round((100 * bW) / bG) : 0}%</span></td></tr>`,
    kcHtml`</table><div class="muted" style="margin-top:7px">A win rate is per realm, so in a fair four-realm race every realm sits at 25%.</div></div>`,
  );

  // best single performances
  const perf = [];
  G.forEach((g) => (g.standings || []).forEach((st) => perf.push({ g, st })));
  perf.sort((a, b) => (b.st.score || 0) - (a.st.score || 0));
  out.push(
    kcHtml`<div class="card"><h2>⭐ Finest single campaigns</h2><table class="kc">`,
    kcHtml`<tr><th>#</th><th>Realm</th><th>Player</th><th class="num">Score</th><th class="num">Provinces</th><th class="num">Strength</th><th class="num">Titles</th><th>Game</th><th>Date</th></tr>`,
  );
  perf.slice(0, 20).forEach((p, i) => {
    out.push(
      kcHtml`<tr><td>${i + 1}</td><td><strong>${p.st.realm}</strong>${p.st.winner ? kcHtml`<span class="pill pill-green">won</span>` : ''}</td>`,
      kcHtml`<td>${p.st.bot ? kcHtml`<span class="pill pill-grey">bot</span>` : personName(p.st) || '—'}</td>`,
      kcHtml`<td class="num">${nf(p.st.score)}</td><td class="num">${nf(p.st.prov)}</td><td class="num">${nf(p.st.str)}</td><td class="num">${(p.st.titles || []).length}</td>`,
      kcHtml`<td class="muted">${p.g.game_name}</td><td class="muted">${dstr(p.g.finished_at)}</td></tr>`,
    );
  });
  out.push(kcHtml`</table></div>`);
  return kcHtml`${out}`;
}

// —— ACHIEVEMENTS ——————————————————————————————————————————————————————————————————————————————
// 2026-10-09 (Toby item 5): a game row holds every realm's best for each record ({key: [entries]};
// rows built before lb3 hold one {entry}: the game's best — both are read). When the search box names
// a realm or a player, each game that has them contributes only THEIR entries, so a player can find
// every feat of theirs, not only the ones that make the top eight.
export function renderAchievements(G) {
  const q = (($('f-q') && $('f-q').value) || '').trim().toLowerCase();
  const whoMatch = (st) =>
    !!q && [st.realm, st.player, personName(st)].filter(Boolean).join(' ').toLowerCase().indexOf(q) >= 0;
  const byKey = {};
  let narrowed = false;
  G.forEach((g) => {
    const mine = new Set((g.standings || []).filter((st) => st && whoMatch(st)).map((st) => st.pi));
    if (mine.size) narrowed = true;
    Object.entries(g.records || {}).forEach(([k, r]) => {
      (Array.isArray(r) ? r : [r]).forEach((e) => {
        if (!e || e.v == null) return;
        if (mine.size && !mine.has(e.pi)) return;
        (byKey[k] = byKey[k] || []).push({ ...e, g });
      });
    });
  });
  const cats = {};
  Object.keys(byKey).forEach((k) => {
    const d = achDef(k);
    (cats[d.c] = cats[d.c] || []).push(k);
  });
  const out = [];
  out.push(
    kcHtml`<div class="card"><h2>🎖 Achievements</h2><div class="muted">${
      narrowed
        ? 'Showing only the realms and players matching your search — every one of their bests, in every game that matches your filters.'
        : "Every record below is among the best ever recorded in a game matching your filters. Each realm's best in each game counts. Type a realm or player into Search to see all of their own records."
    }</div></div>`,
  );
  KC_CAT.forEach(([cat, title]) => {
    const keys = (cats[cat] || []).sort((a, b) => achLabel(a, byKey[a][0]).localeCompare(achLabel(b, byKey[b][0])));
    if (!keys.length) return;
    out.push(kcHtml`<div class="card"><h2>${title}</h2><div class="ach-grid">`);
    keys.forEach((k) => {
      const def = achDef(k),
        dir = byKey[k][0].d === 'min' || def.d === 'min' ? 'min' : 'max';
      const list = byKey[k]
        .slice()
        .sort((a, b) => (dir === 'min' ? a.v - b.v : b.v - a.v))
        .slice(0, 8);
      out.push(kcHtml`<div class="ach"><div class="t">${achLabel(k, list[0])}</div>`);
      if (def.n) out.push(kcHtml`<div class="n">${def.n}</div>`);
      out.push(kcHtml`<ol>`);
      list.forEach((e, i) => {
        const id = whoOf(e);
        const who = e.who ? kcHtml`${e.who} · ` : '';
        const realm = id.realm ? id.realm : e.pi == null ? kcHtml`<span class="muted">the game itself</span>` : '—';
        const owner = id.player
          ? kcHtml` <span class="muted">(${id.player})</span>`
          : id.bot
            ? kcHtml` <span class="pill pill-grey">bot</span>`
            : '';
        const bits = [];
        if (id.race) bits.push(id.race);
        if (id.al) bits.push(id.al);
        if (e.t != null) bits.push('turn ' + e.t);
        if (e.det) bits.push(e.det);
        bits.push((e.g.game_name == null ? '' : e.g.game_name) + ' · ' + dstr(e.g.finished_at));
        out.push(
          kcHtml`<li class="${i === 0 ? 'top1' : ''}"><span class="v">${fmtVal(e.v, def.f)}</span><span class="w">${who}${realm}${owner}<span class="sm">${bits.join(' · ')}</span></span></li>`,
        );
      });
      out.push(kcHtml`</ol></div>`);
    });
    out.push(kcHtml`</div></div>`);
  });
  return kcHtml`${out}`;
}

// —— RACES & CREEDS ————————————————————————————————————————————————————————————————————————————
export function renderPeoples(G) {
  const tally = (pick) => {
    const m = {};
    G.forEach((g) =>
      (g.standings || []).forEach((st) => {
        const k = pick(st);
        if (!k) return;
        const a = (m[k] = m[k] || { k, n: 0, w: 0, score: 0, prov: 0 });
        a.n++;
        if (st.winner) a.w++;
        a.score += st.score || 0;
        a.prov += st.prov || 0;
      }),
    );
    return Object.values(m).sort((a, b) => b.w / b.n - a.w / a.n || b.n - a.n);
  };
  const tbl = (title, rows, head) => {
    if (!rows.length) return '';
    const out = [
      kcHtml`<div class="card"><h2>${title}</h2><table class="kc"><tr><th>${head}</th><th class="num">Realms</th><th class="num">Wins</th><th>Win rate</th><th class="num">Avg score</th><th class="num">Avg provinces</th></tr>`,
    ];
    rows.forEach((r) => {
      out.push(
        kcHtml`<tr><td><strong>${r.k}</strong></td><td class="num">${r.n}</td><td class="num">${r.w}</td>`,
        kcHtml`<td style="min-width:100px">${pctBar(r.w, r.n)}<span class="muted">${Math.round((100 * r.w) / r.n)}%</span></td>`,
        kcHtml`<td class="num">${nf(Math.round(r.score / r.n))}</td><td class="num">${nf(Math.round((10 * r.prov) / r.n) / 10)}</td></tr>`,
      );
    });
    out.push(kcHtml`</table></div>`);
    return kcHtml`${out}`;
  };
  return kcHtml`${[
    tbl(
      '🧭 By race',
      tally((s) => s.race),
      'Race',
    ),
    tbl(
      '☯ By creed',
      tally((s) => s.al),
      'Alignment',
    ),
    tbl(
      '🔀 By race and creed',
      tally((s) => (s.race && s.al ? s.race + ' · ' + s.al : null)),
      'Race · Alignment',
    ),
    tbl(
      '🎲 By how the game ended',
      (() => {
        const m = {};
        G.forEach((g) => {
          const k = g.victory || 'unfinished';
          const a = (m[k] = m[k] || { k, n: 0, w: 0, score: 0, prov: 0 });
          a.n++;
          a.w += 0;
          a.score += g.turns || 0;
          a.prov += g.setup.realms || 0;
        });
        return Object.values(m)
          .map((a) => ({ k: a.k, n: a.n, w: 0, score: a.score, prov: a.prov }))
          .sort((a, b) => b.n - a.n);
      })(),
      'Victory',
    ),
  ]}`;
}

// —— GAMES ————————————————————————————————————————————————————————————————————————————————————
export function renderGames(G) {
  const out = [kcHtml`<div class="card"><h2>📜 Every recorded game</h2>`];
  out.push(
    kcHtml`<div class="muted" style="margin-bottom:9px">Newest first. Click a game to see its final standings.${GM ? (OVERLORD ? ' As the Overlord you can rename any game, change its date, add a note, hide it from the board, or delete it.' : ' As a Game Master you can rename your own games, change their date, add a note, hide them from the board, or delete them.') : ''}</div>`,
  );
  out.push(
    kcHtml`<table class="kc"><tr><th>Date</th><th>Game</th><th class="num">Turns</th><th>Realms</th><th>Bots</th><th>Map</th><th>Won by</th><th>How</th>${GM ? kcHtml`<th></th>` : ''}</tr>`,
  );
  G.forEach((g) => {
    const s = g.setup || {},
      bots = s.bots || 0,
      humans = s.humans != null ? s.humans : (s.realms || 0) - bots;
    const dip =
      s.diplomacy === 'hostile'
        ? kcHtml`<span class="pill pill-red">aggressive</span>`
        : bots
          ? kcHtml`<span class="pill pill-grey">normal</span>`
          : '';
    out.push(
      kcHtml`<tr class="gamerow${g.hidden ? ' hidden-row' : ''}" onclick="toggleGame(${kcArg(g.game_id)})">`,
      kcHtml`<td class="muted">${dstr(g.finished_at)}</td>`,
      kcHtml`<td><strong>${g.game_name}</strong>${g.hidden ? kcHtml`<span class="pill pill-amber">hidden</span>` : ''}${g.note ? kcHtml`<span class="sm muted"> · ${g.note}</span>` : ''}</td>`,
      kcHtml`<td class="num">${g.turns || '—'}</td>`,
      kcHtml`<td>${s.realms || '—'} <span class="muted">(${humans}👤 ${bots}🤖)</span></td>`,
      kcHtml`<td>${bots ? kcHtml`${bots}${dip}` : kcHtml`<span class="pill pill-green">all human</span>`}</td>`,
      kcHtml`<td class="muted">${mapKey(g) || '—'}${s.seaPct != null ? ' · ' + s.seaPct + '% sea' : ''}</td>`,
      kcHtml`<td>${g.winner_realm || '—'}${winnerName(g) ? kcHtml` <span class="muted">(${winnerName(g)})</span>` : g.winner_is_bot ? kcHtml` <span class="pill pill-grey">bot</span>` : ''}</td>`,
      kcHtml`<td class="muted">${g.victory || '—'}</td>`,
      GM
        ? kcHtml`<td>${canEdit(g) ? kcHtml`<button class="btn btn-ghost" style="font-size:.6rem;padding:3px 8px" onclick="event.stopPropagation();toggleEdit(${kcArg(g.game_id)})">✏</button>` : ''}</td>`
        : '',
      kcHtml`</tr>`,
    );
    out.push(
      kcHtml`<tr id="det-${g.game_id}" style="display:none"><td colspan="${GM ? 9 : 8}">${gameDetail(g)}</td></tr>`,
    );
  });
  out.push(kcHtml`</table></div>`);
  return kcHtml`${out}`;
}
export function gameDetail(g) {
  const out = [kcHtml`<div style="padding:4px 0 8px">`];
  out.push(
    kcHtml`<table class="kc"><tr><th class="num">Rank</th><th>Realm</th><th>Player</th><th>Race</th><th>Creed</th><th class="num">Score</th><th class="num">Provinces</th><th class="num">Gold</th><th class="num">Strength</th><th class="num">Titles</th><th>Fate</th></tr>`,
  );
  (g.standings || []).forEach((st) => {
    out.push(
      kcHtml`<tr><td class="num">${st.rank || '—'}</td><td><strong>${st.realm}</strong>${st.winner ? kcHtml`<span class="pill pill-green">victor</span>` : ''}</td>`,
      kcHtml`<td>${st.bot ? kcHtml`<span class="pill pill-grey">bot</span>` : personName(st) || '—'}</td><td>${st.race || '—'}</td><td>${st.al || '—'}</td>`,
      kcHtml`<td class="num">${nf(st.score)}</td><td class="num">${nf(st.prov)}</td><td class="num">${nf(st.gold)}</td><td class="num">${nf(st.str)}</td><td class="num">${(st.titles || []).length}</td>`,
      kcHtml`<td class="muted">${st.outHow ? st.outHow + (st.outTurn ? ' turn ' + st.outTurn : '') : 'survived'}</td></tr>`,
    );
  });
  out.push(kcHtml`</table>`);
  const t = g.totals || {};
  out.push(
    kcHtml`<div class="muted" style="margin-top:7px">${nf(t.battles || 0)} battles · ${nf(t.casualties || 0)} units destroyed · ${nf(t.captures || 0)} provinces changed hands · ${nf(t.lairs || 0)} lair fights · ${nf(t.spells || 0)} spells cast · ${nf(t.deaths || 0)} characters killed · started ${dstr(g.started_at)}${GM ? kcHtml` · recorded by <code>${g.build || 'unknown'}</code>` : ''}</div>`,
  );
  if (GM && canEdit(g)) {
    const d = (g.finished_at || '').slice(0, 10);
    out.push(kcHtml`<div class="gmbox" id="edit-${g.game_id}" style="display:none">
      <h4>Game Master — edit this record</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px">
        <div><label>Name on the board</label><input type="text" id="e-name-${g.game_id}" value="${g.game_name}"></div>
        <div><label>Date played</label><input type="date" id="e-date-${g.game_id}" value="${d}"></div>
        <div style="grid-column:1/-1"><label>Note</label><input type="text" id="e-note-${g.game_id}" value="${g.note || ''}" placeholder="e.g. the first Reckoning played to the wire"></div>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:9px">
        <button class="btn btn-gold" style="font-size:.66rem" onclick="saveGame(${kcArg(g.game_id)})">Save</button>
        <button class="btn btn-ghost" style="font-size:.66rem" onclick="setHidden(${kcArg(g.game_id)},${g.hidden ? 'false' : 'true'})">${g.hidden ? '👁 Show on the board' : '🚫 Hide from the board'}</button>
        <button class="btn btn-crimson" style="font-size:.66rem;margin-left:auto" onclick="deleteRecord(${kcArg(g.game_id)},false)">🗑 Remove from the board</button>
        <button class="btn btn-crimson" style="font-size:.66rem" onclick="deleteRecord(${kcArg(g.game_id)},true)">☠ Delete all of its data</button>
      </div>
      <div class="muted" style="margin-top:6px"><strong>Remove from the board</strong> deletes this Hall-of-Fame entry only; the game’s recorded turns stay, so the GM portal can rebuild it. <strong>Delete all of its data</strong> also deletes its recorded turns and results — that cannot be undone and the entry can never come back.</div>
      <div id="e-msg-${g.game_id}"></div>
    </div>`);
  }
  out.push(kcHtml`</div>`);
  return kcHtml`${out}`;
}
export function toggleGame(id) {
  const r = $('det-' + id);
  if (r) r.style.display = r.style.display === 'none' ? 'table-row' : 'none';
}
export function toggleEdit(id) {
  const r = $('det-' + id);
  if (r && r.style.display === 'none') r.style.display = 'table-row';
  const b = $('edit-' + id);
  if (b) b.style.display = b.style.display === 'none' ? 'block' : 'none';
}
export async function saveGame(id) {
  const msg = $('e-msg-' + id);
  const name = $('e-name-' + id).value.trim(),
    note = $('e-note-' + id).value.trim(),
    date = $('e-date-' + id).value;
  const patch = { game_name: name || null, note: note || null };
  if (date) patch.finished_at = new Date(date + 'T12:00:00').toISOString();
  const { error } = await sb.from('game_records').update(patch).eq('game_id', id);
  if (error) {
    msg.innerHTML = kcHtml`<div class="msg-error">${error.message}</div>`;
    return;
  }
  msg.innerHTML = '<div class="msg-success">Saved.</div>';
  const g = GAMES.find((x) => x.game_id === id);
  if (g) Object.assign(g, patch);
  setTimeout(() => render(), 500);
}
export async function setHidden(id, hide) {
  const { error } = await sb.from('game_records').update({ hidden: hide }).eq('game_id', id);
  if (error) {
    alert(error.message);
    return;
  }
  const g = GAMES.find((x) => x.game_id === id);
  if (g) g.hidden = hide;
  render();
}
// ── The Overlord: correct a player's name ─────────────────────────────────────────────────────
// rename_player (P0-22, ruling D-11) writes `profiles.name`, the one place a person's name lives, and nothing
// else; the Overlord only. Nothing in game_records is rewritten: the board reads names live, so the change shows
// on every past game at once.
export async function renamePlayer(uid) {
  const cur = PEOPLE[uid] || '';
  const name = prompt(
    'Player name on the leaderboard.\n\nThis is the person, not their realm — it changes on every game they have played.',
    cur,
  );
  if (name == null) return;
  const t = name.trim();
  const msg = $('rename-msg');
  if (!t) {
    if (msg) msg.innerHTML = '<div class="msg-warning">A player needs a name — nothing changed.</div>';
    return;
  }
  const { error } = await sb.rpc('rename_player', { p_user: uid, p_name: t });
  if (error) {
    if (msg)
      msg.innerHTML = kcHtml`<div class="msg-error"><strong>Could not rename that player.</strong> ${error.message}</div>`;
    return;
  }
  PEOPLE[uid] = t;
  render();
  const m2 = $('rename-msg');
  if (m2) m2.innerHTML = kcHtml`<div class="msg-success">Renamed to ${t} — on every game they have played.</div>`;
}
export async function deleteRecord(id, purge) {
  const g = GAMES.find((x) => x.game_id === id);
  const nm = g ? g.game_name : id;
  const q = purge
    ? `Delete EVERYTHING recorded about “${nm}” — its Hall-of-Fame entry, its result rows and every recorded turn? This cannot be undone.`
    : `Remove “${nm}” from the Hall of Fame? Its recorded turns are kept, so the GM portal can rebuild the entry later.`;
  if (!confirm(q)) return;
  let err = null;
  const r1 = await sb.from('game_records').delete().eq('game_id', id);
  err = err || r1.error;
  if (purge) {
    const r2 = await sb.from('game_results').delete().eq('game_id', id);
    err = err || r2.error;
    const r3 = await sb.from('turn_events').delete().eq('game_id', id);
    err = err || r3.error;
  }
  if (err) {
    alert(err.message);
    return;
  }
  GAMES = GAMES.filter((x) => x.game_id !== id);
  buildFilterOptions();
  render();
}

kcDbGuard(sb, KC_DB_MIN).then(() => loadAll());
