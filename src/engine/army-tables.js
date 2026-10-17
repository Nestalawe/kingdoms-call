// ════
// MASTER UNIT TABLES — single source of truth
// ════
// They were identical by luck, not by construction: editing recruitment price without editing the
// wage table would silently make a unit cost one amount to raise and another to keep. Every one of
// those names is now an alias of the master below. DO NOT re-inline a local copy — add entries here
// instead.
//
// Cost is BOTH the recruitment price and the per-turn wage: a unit costs its price again every turn
// it exists. 2026-10-11 (Toby, the army roster): Forest Wardens 3→2, Shadow Archers 3→4, Ironwood
// Crossbows 3→2; their base strengths moved with them (KC_UNIT_BASE_STR). tests/roster holds both.
const ARMY_COST_MASTER={
  // ── Human ──
  'Shieldwall Levies':2,'Free Lances':3,'Yeoman Longbows':2,'Gilded Lances':4,'Human Garrison':1,
  'Noble Griffons':4,'Galleon Fleet':3,'Corsair Fleet':3,'Men-at-Arms':3,
  // ── Elven ──
  'Elven Bowmen':3,'Forest Wardens':2,'Shadow Archers':4,'Elven Garrison':1,
  'Eagle Riders':4,'Elven Galleys':3,'Whale Cohort':3,'Stag Riders':3,
  // ── Dwarven ──
  'Dwarven Guard':3,'Ironwood Crossbows':2,'Mountain Guns':4,'Dwarf Garrison':1,
  'Gnomish Gyrocopters':3,'Dwarf Ironclads':4,'Ironhoof Rams':3,
  // ── Orcish ──
  'Warg Riders':3,'Orc Berserkers':3,'Goblin Horde':2,'Orc Garrison':1,
  'Wyvern Riders':4,'Orcish Longships':3,'Black Arrows':2,
  // Primal units: their cost is written ONCE, in PRIMAL_ARMY_DEFS_P (kingdoms-call-data.js), and
  // added below — 2026-09-27, it used to be re-typed here and kept "in step" by hand.
};
Object.entries(PRIMAL_ARMY_DEFS_P).forEach(([t,d])=>{ ARMY_COST_MASTER[t]=d.cost; });
// 2026-10-11 (Toby, the army roster): land move rates by kind — garrisons 1; line foot, archers and
// guns 2; heavy horse and the special foot (Wardens, Berserkers, Shadow Archers) 3; light horse 4;
// the winged riders 5 (Gyrocopters 4). tests/roster holds this table to the decided roster.
const ARMY_SPEED_MASTER={
  // ── Human ──
  'Shieldwall Levies':2,'Free Lances':4,'Yeoman Longbows':2,'Gilded Lances':3,'Human Garrison':1,
  'Noble Griffons':5,'Galleon Fleet':3,'Corsair Fleet':4,'Men-at-Arms':2,
  // ── Elven ──
  'Elven Bowmen':2,'Forest Wardens':3,'Shadow Archers':3,'Elven Garrison':1,
  'Eagle Riders':5,'Elven Galleys':4,'Whale Cohort':5,'Stag Riders':4,
  // ── Dwarven ──
  'Dwarven Guard':2,'Ironwood Crossbows':2,'Mountain Guns':2,'Dwarf Garrison':1,
  'Gnomish Gyrocopters':4,'Dwarf Ironclads':2,'Ironhoof Rams':3,
  // ── Orcish ──
  'Warg Riders':4,'Orc Berserkers':3,'Goblin Horde':2,'Orc Garrison':1,
  'Wyvern Riders':5,'Orcish Longships':3,'Black Arrows':2,
  // Primal units: speed written ONCE, in PRIMAL_ARMY_DEFS_P (kingdoms-call-data.js), added below.
};
Object.entries(PRIMAL_ARMY_DEFS_P).forEach(([t,d])=>{ ARMY_SPEED_MASTER[t]=d.speed; });
// Top-level copy of the primal sea beasts for report/order-data builders that run outside the
// resolution scope. Built from KC_UNIT_CLASS (kingdoms-call-data.js), like PRIMAL_SEA_TYPES.
const PRIMAL_SEA_NAMES=new Set(KC_UNIT_CLASS.primalSea);
// ── DISPLAY ROUNDING ────
// Battle maths is done in floats (flank ×0.5, tactical ×1.2, dice = Math.random()*range), but a
// player report should never show a decimal — "roll 7.2384719283" is noise, not information. n0()
// is a DISPLAY-ONLY rounder: use it on every number interpolated into narrative/log text. It must
// NEVER be used on a value that feeds back into the maths, and it is deliberately NOT applied to
// multipliers — "× tactical ×1.2" rounded to "×1" would be meaningless.
function n0(x){ const v=Number(x); return Number.isFinite(v)?String(Math.round(v)):String(x); }
// ════
// UNIT ABILITIES — single source of truth
// ════
// Every humanoid unit has one always-on ability. They hook into four places: armStr (force
// composition), the pre-battle archery phase, the Flak Screen phase, and the casualty/retreat
// block. Keep the sets below in sync with UNIT_BASE_STR — there is no separate ability table. ──
// UNIT QUALITY ── Green is the LOWEST tier; there is no rank below it. A unit forced to drop below
// Green does not die and does not become mercenaries — it DISBANDS: the men melt back into the
// population and the unit ceases to exist. Disbanded units are never recorded in battle graves
// (nobody was killed) and can never be raised as skeletons.
const QUALITY_TIERS=KC_QUALITY_TIERS.slice();
// Returns true if the unit disbanded. Callers MUST drop units flagged _disbanded from their force
// and must NOT pass them to recordBattleGraves.
function demoteOrDisband(a){
  if(!a) return false;
  const qi=QUALITY_TIERS.indexOf(a.quality);
  if(qi>0){ a.quality=QUALITY_TIERS[qi-1]; return false; }
  a._disbanded=true;
  return true;
}
function disbandLine(owner,a,clause){
  // 2026-09-23d: a unit NAMED "the …" reads "the Pale Shades (Vervain's Shadow Archers)", never
  // "Vervain's the Pale Shades" (same rule as unitRef). `clause` (2026-10-12): whom they fought, after the name.
  const _core=(a.unitName&&/^the\s/i.test(a.unitName))?`${a.unitName} (${owner?owner+"'s ":''}${a.type})`
    :`${owner?owner+"'s ":''}${a.unitName?a.unitName+' ('+a.type+')':a.type}`;
  return `— ${_core}${clause?`, ${clause},`:''} have had enough — the survivors slip away to their villages and the unit disbands for good.`;
}
// "Atk's Warg Riders" / "the Red Hand (Atk's Eagle Riders)" — an owner plus a unit's name or type,
// never "Atk's the Red Hand" (2026-09-23d). Module level since 2026-10-11 (they were inside runTurn).
function ownedUnitName(ownerName, a){
  if(a&&a.unitName&&/^the\s/i.test(a.unitName)) return `${a.unitName} (${ownerName?ownerName+"'s ":''}${a.type})`;
  return `${ownerName?ownerName+"'s ":''}${(a&&(a.unitName||a.type))||'unit'}`;
}
function unitRef(ownerName, a){
  // 2026-09-23d: "the Pale Shades (Vervain's Shadow Archers, Average)" — never "Vervain's the Pale Shades".
  if(a.unitName&&/^the\s/i.test(a.unitName)) return `${a.unitName} (${ownerName?ownerName+"'s ":''}${a.type}, ${a.quality})`;
  const core=a.unitName?`${a.unitName} (${a.type}, ${a.quality})`:`${a.quality} ${a.type}`;
  return ownerName?`${ownerName}'s ${core}`:core;
}
