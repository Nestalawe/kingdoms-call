import { KC_DATA_STAMP } from '../../content/kingdoms-call-data.ts';
import * as KC_DATA_NS from '../../content/kingdoms-call-data.ts';

// ── DATA FILE GUARD (2026-09-27, Toby: collapse to one source) ────
// The player portal now reads the game's SHARED RULE TABLES (unit classes, the Druid ladder, unit
// strengths, skills, seasons, the Wonders, the mastery text…) from kingdoms-call-data.ts — the same
// file the GM portal loads, served from the same folder — instead of keeping its own copies, several
// of which had drifted from the engine. Missing, or older than this build expects → a full-page
// message instead of a blank page. Keep KC_DATA_MIN_P in step with the GM portal's KC_DATA_MIN.
export const KC_DATA_MIN_P = '2026.10.15-1202';
// The oldest database this page works with (P0-34): a migration's version. kcDbGuard checks it before the
// first read. Raise it when this page needs a newer database change (docs/traps.md, "A site change that needs
// a database change").
export const KC_DB_MIN = '20261015062128';
(function () {
  const need = [
    'KC_UNIT_CLASS',
    'KC_UNIT_TYPE',
    'KC_DRUID_LEVELS',
    'KC_UNIT_BASE_STR',
    'KC_UNIT_Q_MULT',
    'KC_QUALITY_TIERS',
    'KC_QUALITY_UP',
    'KC_QUALITY_DOWN',
    'KC_SKILLS',
    'KC_MAGIC_SCHOOLS',
    'KC_SKILL_LABELS',
    'KC_ITEM_UNCAPPED_SKILLS',
    'KC_ITEM_SLOT_CAP',
    'KC_ITEM_RACE_ALIAS',
    'KC_RUMOUR_COST_BY_POWER',
    'KC_CARRIER_BERTHS',
    'KC_BASIC_EXPLORE',
    'KC_TERRAIN_COLORS',
    'KC_PHASE_NAMES',
    'KC_PHASE_COLORS',
    'KC_SEASONS',
    'KC_ALIGNMENTS',
    'KC_TEMPERS',
    'KC_HUMANOID_RACES',
    'KC_RIVAL_RACE',
    'KC_HEX_DIRS',
    'KC_GRAND_DESIGNS',
    'MASTERY_UNLOCKS',
  ];
  const missing = need.filter((n) => {
    try {
      return typeof KC_DATA_NS[n] === 'undefined';
    } catch (e) {
      return true;
    }
  });
  const stamp = typeof KC_DATA_STAMP === 'string' ? KC_DATA_STAMP : null;
  const allMissing = missing.length === need.length;
  if (allMissing || missing.length || !stamp || stamp < KC_DATA_MIN_P) {
    const why = allMissing
      ? 'kingdoms-call-data.js not loaded'
      : `kingdoms-call-data.js out of date (${stamp || 'no stamp'} < ${KC_DATA_MIN_P}${missing.length ? '; missing ' + missing.join(', ') : ''})`;
    throw new Error(why); // the boot-failure reporter above turns this into a readable message
  }
})();
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
