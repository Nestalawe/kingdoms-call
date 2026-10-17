// ── DATA FILE GUARD ── the content tables (items, monsters, names, spells, titles, discoveries)
// live in kingdoms-call-data.js, which MUST be served from the same folder and is loaded by the
// script tag just above this block. Without it every table below is undefined and the portal
// would hang on the loading spinner, so fail loudly instead.
// 2026-09-25: the guard checked two of the eighteen tables. A STALE data file (an older upload, or
// a cached copy) that lacked any other table passed the guard and then threw a bare ReferenceError
// somewhere in the 20,000 lines below — the spinner hung with no message. Every table is checked
// now, and the file's own stamp (KC_DATA_STAMP, added the same day) must be at least the one this
// build was cut against: older → the same loud failure, naming what is wrong.
const KC_DATA_MIN='2026.10.15-1202';
// The oldest database this page works with (P0-34): a migration's version. kcDbGuard checks it before the
// first read. Raise it when this page needs a newer database change (docs/traps.md, "A site change that needs
// a database change"). Now P0-25's: the game screen's switch saves games.block_eliminated_msgs. (Since P0-32e,
// Master GM mode (P0-32g) has needed the Overlord's rights on every game.)
const KC_DB_MIN='20261015062128';
// Every shared rule table this build reads from the data file (the player portal checks the same list).
const KC_SHARED_TABLE_NAMES=['KC_UNIT_CLASS','KC_UNIT_TYPE','KC_DRUID_LEVELS','KC_UNIT_BASE_STR','KC_UNIT_Q_MULT','KC_QUALITY_TIERS','KC_QUALITY_UP','KC_QUALITY_DOWN','KC_SKILLS','KC_MAGIC_SCHOOLS','KC_SKILL_LABELS','KC_ITEM_UNCAPPED_SKILLS','KC_ITEM_SLOT_CAP','KC_ITEM_RACE_ALIAS','KC_RUMOUR_COST_BY_POWER','KC_CARRIER_BERTHS','KC_BASIC_EXPLORE','KC_TERRAIN_COLORS','KC_PHASE_NAMES','KC_PHASE_COLORS','KC_SEASONS','KC_ALIGNMENTS','KC_TEMPERS','KC_HUMANOID_RACES','KC_RIVAL_RACE','KC_HEX_DIRS','KC_GRAND_DESIGNS'];
// SAFE START (2026-09-29): a setup option. While on, no realm may Treat or declare war until the
// orders for Turn SAFE_START_TURN — player declarations are discarded (with a private notice) and bots
// make none. `turn` is the turn being resolved (games.turn when its orders are run).
const SAFE_START_TURN=6;
function safeStartLocked(gs,turn){ return !!(gs&&gs.safeStart) && (Number(turn)||0)<SAFE_START_TURN; }
// BOTS' reading of Safe Start (2026-09-29): true while even NEXT turn is still locked, so no war can
// touch the realm before its next orders — the bot posts no defenders and leaves the capital
// ungarrisoned, putting every hero and levy into expansion. On the last locked turn (Turn
// SAFE_START_TURN−1) this turns false, so the defenders and the capital garrison are raised in time
// for the first turn on which war may be declared.
function botSafeWindow(G){ return safeStartLocked(G,((G&&G.turn)||0)+1); }
const KC_BUILD_STAMP='2026.10.17-1724'; // this build (the footer shows the same; telemetry rows carry it)
(function(){
  const need=['ALL_MAGIC_ITEMS_P','ARMY_UNIT_NAMES','HERO_EPITHET_OVERFLOW','HERO_NAME_PARTS','LAIR_POOLS_CAT_P','LAIR_POOLS_MONSTER_P','LEGENDARY_ITEMS_P','MASTERY_UNLOCKS','MONSTERS_P','PRIMAL_ARMY_DEFS_P','PRIMAL_UNIT_NAMES','PROVINCE_ARMIES_P','SAGE_DISCOVERIES_P','SPELL_DEFS_P','TEMPER_TRAITS','TITLE_DEFS','_ITEM_NAME_ALTS','_VARIANT_BANK',
    // 2026-09-27: the SHARED RULE TABLES both portals now read (one source — see the data file)
    ...KC_SHARED_TABLE_NAMES];
  const missing=need.filter(n=>{ try{ return typeof eval(n)==='undefined'; }catch(e){ return true; } });
  const stamp=(typeof KC_DATA_STAMP==='string')?KC_DATA_STAMP:null;
  const allMissing=missing.length===need.length;
  const stale=!allMissing&&(missing.length>0||!stamp||stamp<KC_DATA_MIN);
  if(allMissing||stale){
    const title=allMissing?'data file missing':'data file out of date';
    const body=allMissing
      ? kcHtml`<b>kingdoms-call-data.js</b> was not found next to this page. Upload it to the same folder as the GM portal and reload.`
      : kcHtml`The <b>kingdoms-call-data.js</b> beside this page is ${stamp?'v'+stamp:'an old build without a version stamp'}; this portal needs v${KC_DATA_MIN} or newer${missing.length?` (missing: ${missing.join(', ')})`:''}. Upload the current data file, then hard-reload (Ctrl/Cmd+Shift+R) so the browser does not keep the old copy.`;
    document.addEventListener('DOMContentLoaded',()=>{document.body.innerHTML=kcHtml`<div style="font-family:serif;padding:40px;max-width:600px;margin:auto"><h2>Kingdoms Call — ${title}</h2><p>${body}</p></div>`;});
    throw new Error(allMissing?'kingdoms-call-data.js not loaded':`kingdoms-call-data.js out of date (${stamp||'no stamp'} < ${KC_DATA_MIN})`);
  }
})();

