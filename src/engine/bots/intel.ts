// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_HEX_DIRS, KC_RIVAL_RACE, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { battleFrontWidth, battleLineTotal } from '../battle/lines.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { druIdPenaltyMult } from '../world/tables.ts';
import { TAMED_FLYER_TYPES_D } from '../titles/perks.ts';
import { alignDistP } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { consecratedIds } from '../heroes/fame-and-consecration.ts';
import {
  enemyCharVisibleTo,
  featDiscovered,
  nearSpiedProvIds,
} from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';

// ══ BOT PLAYERS — Phase 3a: core movement AI (expansion) ════
// Self-contained, module-top-level so it can run at order-merge time in runTurn with no dependency
// on runTurn-local consts (avoids the HEX_DIRS/neighborInDir TDZ trap). Bots do not act beyond
// movement yet: economy, character actions, spells (3b/3c) and enemy-target selection / battle AI
// (Phase 4) are staged. This slice makes bots EXPAND — each armed bot character claims the best
// winnable unowned land province on its own border, growing the bot's tax base turn by turn.
//
// INFO BOUNDARY (no cheating): a bot only ever considers provinces ADJACENT to a province one of
// its own characters occupies — i.e. its immediate frontier, which a human likewise sees in their
// turn report (buildTurnReport surfaces neutralDefenders intel for observed provinces). So reading
// an adjacent guard's strength is intel parity, not omniscience. Beyond-border planning (via
// _provMemory) arrives with Phase 4.
// ══ BOT TUNING ════
// The utility weights that govern bot competence, centralised in one place so a single edit
// re-tunes behaviour and — later — a scalar difficulty knob can multiply them without touching any
// decision code
// (BOT_PLAYERS_DESIGN §2 #7 / §8.2). v1 keeps a single fixed strength; these are those fixed values.
// ══ REALM COLOURS — COLOUR-BLIND SAFE ════
// The ten realm colours, and the one fallback for an eleventh seat. Chosen by search rather than by
// eye: every pair was measured with CIEDE2000 under normal vision AND under simulated protanopia,
// deuteranopia and tritanopia (Machado 2009, severity 1.0), and the set maximises the SMALLEST of
// those distances.
//
// worst-case min pairwise ΔE2000 old palette 0.5 → this palette 11.9
// normal 16.0 · protanopia 12.3 · deuteranopia 11.9 · tritanopia 12.5
//
// Three further constraints shape the set, and they are why it runs bright rather than sombre:
// 1. Every colour stands ≥ ΔE 9 clear of all six terrain fills (TERRAIN_COLORS_P) in every vision
// model. This is what rules out the heraldic dark reds, greens and golds a medieval map wants:
// under red-green colour blindness a crimson banner collapses onto the desert and mountain
// hexes, and a green one onto forest and jungle.
// 2. Every colour has perceived luma ≥ 114, so the player portal's dark-tooltip lift
// (_tintForDarkTooltip, threshold 110) never re-tints a realm colour — map, report and tooltip
// always show a realm in exactly the same colour.
// 3. No two realms sit within 3 luma of one another: lightness is the one channel every kind of
// colour blindness keeps intact, so it is the fallback cue when hue fails.
// Names are for the design notes only; nothing in the code reads them.
// Rose · Straw · Chartreuse · Emerald · Aqua · Slate · Cornflower · Amethyst · Mauve · Fuchsia
export const REALM_COLOURS = [
  '#fcb4c0',
  '#d8d890',
  '#b4f000',
  '#0cb478',
  '#48fcfc',
  '#789090',
  '#90c0fc',
  '#9c78fc',
  '#906090',
  '#fc78c0',
];
export const REALM_COLOUR_FALLBACK = '#c8b48c'; // an 11th seat should never happen; parchment-tan if it does

export const BOT_TUNING = {
  kingAttackMargin: 1.35, // battle-model force ratio a bot KING needs before attacking (≈63% on the fortune curve; kings play safer — a king's death is costly)
  heroAttackMargin: 1.2, // battle-model force ratio a bot HERO needs before attacking (≈58%)
  assaultMargin: 1.4, // combined force ratio needed to launch a concentrated assault (buffers the contingent-unify roll)
  valuableTax: 7, // tax at/above which a province is "valuable" to hold/reinforce (home capital always is)
  rivalBias: 8, // target-score bonus for pressing an at-war rival's province over neutral expansion
  taxScoreWeight: 10, // how strongly a target province's tax pulls target selection
  upkeepCapFrac: 0.9, // recruitment never lets total upkeep exceed this fraction of tax income (solvency guard)
  goldReserve: 3, // gold kept in hand before any recruiting
  chestShare: 0.35, // share of the free treasury the upkeep cap may lean on (a chest carries a wage deficit until conquests pay it back)
  coalitionTriggerFrac: 0.8, // a front-runner at ≥ this fraction of the Reckoning threshold triggers an anti-leader coalition
};
// ── BOT STRENGTH ── 2026-09-26 (Toby item 9): the Easy / Normal / Hard tiers are retired. Every bot realm
// plays at what was the Hard setting — bolder attack margins, the strongest rival bias, and 97% of income
// on wages. The table keeps one row so botTuning reads the same shape; a game saved with 'easy' or
// 'normal' (G.botDifficulty) resolves to it too, and telemetry keeps recording the word it finds.
export const BOT_DIFFICULTY = {
  hard: { attackMarginMult: 0.92, assaultMarginMult: 0.9, rivalBias: 12, upkeepCapFrac: 0.97 },
};
BOT_DIFFICULTY.easy = BOT_DIFFICULTY.normal = BOT_DIFFICULTY.hard;
export const BOT_DIFFICULTY_DEFAULT = 'hard';
// Effective weights for this game. Bot decision functions read these instead of BOT_TUNING directly.
// Difficulty-neutral weights pass straight through.
export function botTuning(G, pi) {
  const d = BOT_DIFFICULTY[(G && G.botDifficulty) || BOT_DIFFICULTY_DEFAULT] || BOT_DIFFICULTY.hard;
  const T = {
    kingAttackMargin: BOT_TUNING.kingAttackMargin * d.attackMarginMult,
    heroAttackMargin: BOT_TUNING.heroAttackMargin * d.attackMarginMult,
    assaultMargin: BOT_TUNING.assaultMargin * d.assaultMarginMult,
    valuableTax: BOT_TUNING.valuableTax,
    rivalBias: d.rivalBias,
    taxScoreWeight: BOT_TUNING.taxScoreWeight,
    upkeepCapFrac: d.upkeepCapFrac,
    goldReserve: BOT_TUNING.goldReserve,
    chestShare: BOT_TUNING.chestShare,
    coalitionTriggerFrac: BOT_TUNING.coalitionTriggerFrac,
  };
  // Sept 2026 (bot strategy review §2–3): per-realm overlays from the alignment and race the realm was
  // dealt. Each reads a rulebook number, nothing hidden.
  const pl = pi != null && G && G.players ? G.players[pi] : null;
  if (!pl) return T;
  switch (pl.alignment) {
    case 'Divine':
      if ((consecratedIds(pl) || []).length) T.kingAttackMargin *= 0.9;
      break; // the grace returns a fallen king
    case 'Good':
      T.assaultMargin *= 0.9;
      break; // Banner of Fellowship +15% unify
    case 'Evil':
      T.taxScoreWeight *= 1.5;
      T.rivalBias += 3;
      break; // Plunder: half the tax on capture; Terror chains
    case 'Pagan':
      T.rivalBias += 3;
      break; // Blood Harvest: gold per unit slain
  }
  switch (pl.race) {
    case 'Dwarven':
      T.kingAttackMargin += 0.1;
      T.heroAttackMargin += 0.1;
      break; // Bulwark: dwarves win by being attacked
    case 'Orcish':
      T.kingAttackMargin -= 0.05;
      T.heroAttackMargin -= 0.05;
      T.upkeepCapFrac = Math.min(1, T.upkeepCapFrac + 0.05);
      break; // War-spoils halve wages on a won attack
  }
  return T;
}
export const BOT_HEX_DIRS = KC_HEX_DIRS.slice(); // MUST match the engine's HEX_DIRS order
export const BOT_OFF_EVEN = [
  [-1, -1],
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
]; // and its even/odd hex offsets
export const BOT_OFF_ODD = [
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, 0],
  [1, 1],
];
export function botNeighbourProv(G, prov, i) {
  const cols = G.world.cols,
    rows = G.world.rows;
  const off = (prov.row % 2 === 0 ? BOT_OFF_EVEN : BOT_OFF_ODD)[i];
  const nr = prov.row + off[0];
  if (nr < 0 || nr >= rows) return null;
  const nc = (((prov.col + off[1]) % cols) + cols) % cols;
  return G.world.provinces[nr * cols + nc];
}
export function botForceStrength(armies) {
  return (armies || []).reduce((s, a) => s + unitBaseStrength(a), 0);
}

// ── UNIT-TYPE SETS ── the bots' copies of the content's unit classes, read by every bot file (bots/war.ts's
// naval section says what they mirror).
export const BOT_CARRIER_TYPES = new Set(KC_UNIT_CLASS.carrier);
export const BOT_PRIMAL_SEA_TYPES = new Set(KC_UNIT_CLASS.primalSea);
export const BOT_AERIAL_TYPES = new Set(KC_UNIT_CLASS.aerial);
export const BOT_SEA_ALL = new Set([...BOT_CARRIER_TYPES, ...BOT_PRIMAL_SEA_TYPES]);
export const BOT_MONSTER_ARMIES = new Set(KC_UNIT_CLASS.monster);
// Per-turn scratch state (roles + treasury ledger), keyed by the live game-state object so it never
// leaks into the persisted game_state and never survives into the next turn.
export const _botTurnCache = new WeakMap();
export function botTurnCache(G) {
  let o = _botTurnCache.get(G);
  if (!o || o.turn !== G.turn) {
    o = { turn: G.turn, roles: {}, ledger: {} };
    _botTurnCache.set(G, o);
  }
  return o;
}

// ══ BOT INTEL — WHAT A BOT REALM IS ALLOWED TO KNOW ════
// Bots plan straight off the live game state, which made them omniscient: a bot would march five
// hops across unmapped country to hire a wandering hero standing in a HUMAN'S province no bot had
// ever laid eyes on, weigh a garrison it had never scouted, and pick out battlefield graves no
// necromancer of its had ever felt underfoot. None of that is reachable by a human, who plans from
// a turn report.
//
// This layer gives a bot the SAME four tiers buildTurnReport draws for a human, computed from the
// very same records the report reads (province ownership, character locations, player._provMemory,
// player._spiedProvincesLastTurn, visitedBy, _graveIntel, featDiscovered):
//
// SIGHT owned · occupied by one of its characters · spied last turn
// → live truth: enemy characters (through enemyCharVisibleTo, so Invisibility, cloaks
// and the Spy contest all still apply), garrisons, neutral defenders, graves.
// BORDER adjacent to a SIGHT province
// → terrain, owner, tax band, recruitable army types. NO characters, NO force counts —
// exactly what the report's 'border' tier sends. A defender count here is a GUESS.
// REMEMBERED in _provMemory, or ever visited
// → the frozen snapshot: name, terrain, tax, owner AS LAST SEEN. No live forces.
// UNKNOWN never seen → may not be reasoned about at all. Not a target, not a destination.
//
// Where a bot cannot see a province's defenders it now ESTIMATES them from the wealth band, which
// is the same public rule a human reads off the map (Rich 3–4 / Prosperous 2–3 / Poor 1–2 neutral
// units), rather than reading the true array. So bots still expand and still fight — they simply
// plan on belief, and are wrong exactly where a human would be wrong.
//
// NOTE ON TIMING: bots plan at order-merge time, so the state they read is the end of LAST turn —
// the same snapshot the human's turn report was built from. Parity is therefore exact, not
// approximate. _spiedProvincesThisTurn is cleared earlier in runTurn, so the previous turn's spy
// set is preserved as _spiedProvincesLastTurn at that reset for this layer to read.
export const _botIntelCache = new WeakMap();
export function botIntel(G, pi) {
  let per = _botIntelCache.get(G);
  if (!per || per.turn !== G.turn) {
    per = { turn: G.turn, by: {} };
    _botIntelCache.set(G, per);
  }
  if (per.by[pi]) return per.by[pi];
  const pl = (G.players || [])[pi] || {};
  const owned = new Set(),
    occupied = new Set();
  (G.world.provinces || []).forEach((p) => {
    if (p && p.owner === pi) owned.add(p.id);
  });
  (G.characters || []).forEach((c) => {
    if (c && c.alive && c.player === pi && c.location != null) occupied.add(c.location);
  });
  const spied = new Set(pl._spiedProvincesLastTurn || pl._spiedProvincesThisTurn || []);
  const sight = new Set([...owned, ...occupied, ...spied]);
  const border = new Set();
  sight.forEach((id) => {
    const p = G.world.provinces[id];
    if (!p) return;
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, p, i);
      if (N && !sight.has(N.id)) border.add(N.id);
    }
  });
  const remembered = new Set(),
    visited = new Set();
  Object.keys(pl._provMemory || {}).forEach((k) => {
    const n = +k;
    if (!isNaN(n)) remembered.add(n);
  });
  (G.world.provinces || []).forEach((p) => {
    if (p && (p.visitedBy || []).includes(pi)) {
      remembered.add(p.id);
      visited.add(p.id);
    }
  });
  const known = new Set([...sight, ...border, ...remembered]);
  const o = {
    owned,
    occupied,
    spied,
    sight,
    border,
    remembered,
    visited,
    known,
    ctx: { ownedProvIds: owned, ownCharLocs: occupied, spiedThisTurn: spied, nearSpied: nearSpiedProvIds(G, spied) },
    mem: pl._provMemory || {},
    graves: pl._graveIntel || {},
  };
  per.by[pi] = o;
  return o;
}
// Live forces in this province are visible to the realm.
export function botSees(G, pi, provId) {
  return provId != null && botIntel(G, pi).sight.has(provId);
}
// Current terrain / owner / tax are visible (sight or border) — but NOT the forces standing there.
export function botScouted(G, pi, provId) {
  const I = botIntel(G, pi);
  return provId != null && (I.sight.has(provId) || I.border.has(provId));
}
// The realm has seen this ground at some point and may reason about it at all.
export function botKnows(G, pi, provId) {
  return provId != null && botIntel(G, pi).known.has(provId);
}
// One rule for "can this realm see that character", shared with the human report.
export function botSeesChar(G, pi, c) {
  if (!c || !c.alive) return false;
  if (c.player === pi) return true;
  try {
    return enemyCharVisibleTo(G, pi, c, botIntel(G, pi).ctx);
  } catch (e) {
    return botSees(G, pi, c.location);
  }
}
// Every character standing in `prov` that this realm may account for (its own always; others only
// where it has line of sight and they are not hidden).
export function botVisibleCharsIn(G, pi, prov) {
  if (!prov) return [];
  return (G.characters || []).filter((c) => c && c.alive && c.location === prov.id && botSeesChar(G, pi, c));
}
// The province as this realm believes it to be: live when scouted, else the remembered snapshot,
// else null (never seen — must not be reasoned about).
export function botBelief(G, pi, prov) {
  if (!prov) return null;
  if (botScouted(G, pi, prov.id))
    return {
      id: prov.id,
      row: prov.row,
      col: prov.col,
      terrain: prov.terrain,
      owner: prov.owner,
      tax: prov.tax,
      armyTypes: prov.armyTypes || [],
      live: true,
    };
  const m = botIntel(G, pi).mem[prov.id];
  if (m)
    return {
      id: prov.id,
      row: prov.row,
      col: prov.col,
      terrain: m.terrain,
      owner: m.owner,
      tax: m.tax,
      armyTypes: m.armyTypes || [],
      live: false,
    };
  return null;
}
// Owner as believed (live if scouted, else last seen). `undefined` = never seen this ground.
export function botBelievedOwner(G, pi, prov) {
  const b = botBelief(G, pi, prov);
  return b ? b.owner : undefined;
}
// A GUESS at a province's defending strength when the realm cannot see into it. Neutral land is
// read off the wealth band the map shows everyone (the same Rich 3-4 / Prosperous 2-3 / Poor 1-2
// spread the world generator uses); a rival's province is guessed from its tax, because a wealthy
// realm garrisons what it values. Deliberately a rough number: a bot marching on unscouted ground
// should be able to be unpleasantly surprised, exactly as a human is.
export function botGuessDefence(G, pi, prov, terrain) {
  const b = botBelief(G, pi, prov);
  if (!b) return 0;
  const AVG_UNIT = 6; // ≈ an average line unit's base strength
  const I = botIntel(G, pi);
  // GROUND THIS REALM HAS WALKED ON. The human report prints an intelligence line for every VISITED
  // province — "N neutral defenders (composition unknown — Spy this province to reveal)" — and that
  // count is read live every turn. So a bot that has been here knows HOW MANY hold it, never what
  // they are, and prices them at an average unit.
  if (prov && I.visited.has(prov.id) && (prov.owner == null || prov.owner === b.owner)) {
    if (b.owner == null) {
      const guard = (prov.characters || [])
        .map((id) => (G.characters || []).find((x) => x && x.id === id))
        .find((x) => x && x.alive && x.player === null && (x.armies || []).length);
      const n = guard ? (guard.armies || []).length : (prov.neutralDefenders || []).length;
      return n * AVG_UNIT * BOT_DEF_BONUS;
    }
  }
  // Otherwise: the wealth band, which is public on the map to anyone who can see the hex at all
  // (Rich 3-4 / Prosperous 2-3 / Poor 1-2 defenders is how the world was stocked). A rival's own
  // province is assumed a shade more heavily held than neutral ground of the same wealth.
  const tax = b.tax || 0;
  const units = tax >= 7 ? 3.5 : tax >= 4 ? 2.5 : 1.5; // 2026-09-21: tracks neutralDefBand's Poor/Prosperous cut (now tax 4)
  const owned = b.owner != null && b.owner !== pi;
  return units * AVG_UNIT * (owned ? 1.25 : 1) * BOT_DEF_BONUS;
}
// Discovered features only — an undiscovered lair is not on this realm's map at all.
export function botKnownFeatures(G, pi, prov) {
  return ((prov && prov.features) || []).filter((f) => f && featDiscovered(f, pi));
}
// Does this realm know battlefield graves lie here? Reads the very record the report's "Graveyards
// Known" section is built from, so a bot needs a necromancer on the ground exactly as a player
// does.
export function botKnowsGraves(G, pi, provId) {
  const g = botIntel(G, pi).graves;
  return !!(g && provId != null && g[provId]);
}
// ══ HONEST KNOWLEDGE OF RIVAL CHARACTERS (Sept 2026, Toby / review II A5) ════
// The engine keeps what a realm's spies learned about a character in p._spiedHeroSkills[id] (skills + turn).
// A bot reads a rival's skills only from there (eight turns' currency); otherwise it plans against an
// ASSUMED profile — a Tactical-2 general, a Melee-3/Archery-2 duellist with a school at 2 — as a human
// would guess from the report's silence. Spies therefore spy on generals and hunters' marks first.
export const BOT_ASSUMED_SKILLS = { melee: 3, archery: 2, tactical: 2, elemental: 2 };
export function botKnownSkills(G, pi, e) {
  if (!e) return null;
  if (e.player === pi || e.player == null) return e.skills || {}; // our own; wanderers are hired on sight of their skills
  const p = (G.players || [])[pi];
  const r = p && p._spiedHeroSkills && p._spiedHeroSkills[e.id];
  if (r && (G.turn || 0) - (r.turn || 0) <= 8) return r.skills || {};
  return null;
}
export function botSkillsFor(G, pi, e) {
  return botKnownSkills(G, pi, e) || BOT_ASSUMED_SKILLS;
}
// Sept 2026 (bot upgrade): the strength a commander REALLY brings — every unit discounted by the
// Druid shortfall penalty the engine will apply (same-race rule, Druidic realm, sd40 Dragon Taming
// all honoured via druIdPenaltyMult).
export function botHasDisc(G, pi, id) {
  return (((G.players || [])[pi] || {}).discoveries || []).some((d) => d && d.id === id);
}
export function botEffForce(G, c, armies) {
  if (!c) return botForceStrength(armies);
  const align = (c.player != null ? ((G.players || [])[c.player] || {}).alignment : null) || 'Neutral';
  const tamed = c.player != null && botHasDisc(G, c.player, 'sd40');
  return (armies || c.armies || []).reduce((s, a) => {
    if (!a) return s;
    let m = 1;
    try {
      m = druIdPenaltyMult(c, a, align, tamed && TAMED_FLYER_TYPES_D.has(a.type));
    } catch (e) {
      m = 1;
    }
    return s + unitBaseStrength(a) * m;
  }, 0);
}
// BATTLE MODEL: mirror of the engine's land-battle arithmetic so a bot's estimate is honest:
// per-unit Druid penalty, the terrain battle lines (shared BATTLE_FRONT_RANGE / battleGrid at the middle
// width — front, second line and reserve at ×1/×0.5/×0.25/×0.125, ranged shooting over a fighter at ×1,
// sd09 lifting each rear step, the winged riders in the air),
// and the commander's Tactical multiplier (×1+0.2/level, capped ×2.0) on land units. Before this
// bots summed raw base strength and so under-read a drilled host by 40–100% — they won 96% of the
// battles they dared and declined the rest. Fortune (log-ratio CDF) and fanaticism stay random and
// are left out.
// Sept 2026 (bot strategy review §3): the per-unit race/terrain arithmetic the engine applies in armStr,
// mirrored for the estimate — kinship (+20% king's race, +20% leader's race), the old grudges (−20%),
// unit terrain modifiers and the sea penalty, Elven Woodland Mastery (×1.5 in forest/jungle) and Dwarven
// Bulwark (×1.5 defending). All public: races, terrain and the rulebook's numbers.
export function botRaceTerrainMult(G, c, a, terrain, defending, ownerPi) {
  let m = 1;
  const uRace = a.race || null;
  const oPi = ownerPi != null ? ownerPi : c && c.player != null ? c.player : null;
  const oRace = oPi != null ? ((G.players || [])[oPi] || {}).race || null : null;
  const lRace = (c && c.race) || null;
  if (uRace) {
    if (oRace && uRace === oRace) m *= 1.2;
    if (lRace && uRace === lRace) m *= 1.2;
    const RIV = { ...KC_RIVAL_RACE };
    if (lRace && RIV[uRace] === lRace) m *= 0.8;
  }
  // terrainMod / seaPenalty are runTurn-LOCAL (the scope trap): runTurn hands them in through hooks.terrainMult
  if (terrain) {
    const tf = botTurnCache(G).terrainMult;
    if (typeof tf === 'function') {
      try {
        m *= tf(a.type, terrain);
      } catch (e) {}
    }
  }
  if (uRace === 'Elven' && oRace === 'Elven' && (terrain === 'forest' || terrain === 'jungle')) m *= 1.5;
  if (uRace === 'Dwarven' && oRace === 'Dwarven' && defending) m *= 1.5;
  return m;
}
// Whole-force multipliers the rulebook promises without a roll: Evil ×1.25 with any Monster (the Druidic
// mirror, Wild Ferocity, was retired 2026-10-13), Undead skeletal fanaticism ×1.5 under the king / ×1.3 under
// a hero, Good +10% defending its own land. Zeal itself is a roll and is left out, as before.
export function botFervourMult(G, c, armies, defending) {
  if (!c || c.player == null) return 1;
  const align = ((G.players || [])[c.player] || {}).alignment || 'Neutral';
  let m = 1;
  if (align === 'Evil' && armies.some((a) => a && BOT_MONSTER_ARMIES.has(a.type))) m = Math.max(m, 1.25);
  if (align === 'Undead' && armies.some((a) => a && a._isSkeletal)) m = Math.max(m, c.isKing ? 1.5 : 1.3);
  if (align === 'Good' && defending) m *= 1.1;
  return m;
}
export function botBattleForce(G, c, armies, terrain, opts) {
  opts = opts || {};
  const defending = !!opts.defending;
  armies = armies || (c ? c.armies : null) || [];
  if (!armies.length) return 0;
  const align = (c && c.player != null ? ((G.players || [])[c.player] || {}).alignment : null) || 'Neutral';
  const tamed = !!(c && c.player != null && botHasDisc(G, c.player, 'sd40'));
  const flank = !!(c && c.player != null && botHasDisc(G, c.player, 'sd09'));
  const width = battleFrontWidth(terrain);
  const csk =
    c && opts.viewerPi != null && c.player != null && c.player !== opts.viewerPi
      ? botSkillsFor(G, opts.viewerPi, c)
      : (c && c.skills) || {}; // Sept 2026 (A5): a rival's skills only as our spies reported them
  const tac = terrain === 'sea' ? 1 : Math.min(2.0, 1 + 0.2 * Math.min(5, csk.tactical || 0));
  const nav = 1 + 0.2 * Math.min(5, csk.naval || 0); // Naval lifts fleets on land and sea
  const rows = armies
    .filter((a) => a)
    .map((a) => {
      let m = 1;
      if (c) {
        try {
          m = druIdPenaltyMult(c, a, align, tamed && TAMED_FLYER_TYPES_D.has(a.type));
        } catch (e) {
          m = 1;
        }
      }
      const fly = BOT_AERIAL_TYPES.has(a.type),
        sea = BOT_SEA_ALL.has(a.type);
      // Tactical / Naval folded in before battleLineTotal sorts — same reason as the NPC defender.
      m *= botRaceTerrainMult(G, c, a, terrain, defending, opts.ownerPi);
      return { a, base: unitBaseStrength(a) * m * (sea ? nav : tac), fly, sea };
    }); // flyers take Tactical (2026-09-23c); `a` so the grid can place by type
  return (
    battleLineTotal(rows, width, flank, { terrain, tac: csk.tactical || 0 }) * botFervourMult(G, c, armies, defending)
  );
}
// What an assault on province N is really up against: the standing defenders on N's own terrain
// (guard hero's Tactical included), times the engine's ×1.25 fortification bonus.
export const BOT_DEF_BONUS = 1.25;
// only counted from GROUND THE REALM CAN SEE INTO. On a province it has merely scouted from across
// the border — or only remembers — it gets botGuessDefence's wealth-band estimate instead of the
// true order of battle, which is all a human has to go on there.
export function botTargetDefence(G, pi, N) {
  if (!N) return 0;
  if (!botSees(G, pi, N.id)) return botGuessDefence(G, pi, N, N.terrain);
  const seen = botVisibleCharsIn(G, pi, N);
  const guard = seen.find((x) => x.player === null && (x.armies || []).length);
  let s = 0;
  if (N.owner == null) {
    s = guard
      ? botBattleForce(G, guard, guard.armies, N.terrain, { defending: true, viewerPi: pi })
      : botBattleForce(G, null, N.neutralDefenders || [], N.terrain, { defending: true });
  } else {
    seen.forEach((x) => {
      if (x.player === N.owner) s += botBattleForce(G, x, x.armies, N.terrain, { defending: true, viewerPi: pi });
    });
    s += botBattleForce(G, null, N.garrisonArmies || [], N.terrain, { defending: true, ownerPi: N.owner });
  }
  return s * BOT_DEF_BONUS;
}
// Does this commander lead any unit at a Druid shortfall? Returns the worst shortfall (0 = none).
export function botDruidShortfall(G, c, armies) {
  if (!c) return 0;
  const align = (c.player != null ? ((G.players || [])[c.player] || {}).alignment : null) || 'Neutral';
  const tamed = c.player != null && botHasDisc(G, c.player, 'sd40');
  let worst = 0;
  (armies || c.armies || []).forEach((a) => {
    if (!a) return;
    let m = 1;
    try {
      m = druIdPenaltyMult(c, a, align, tamed && TAMED_FLYER_TYPES_D.has(a.type));
    } catch (e) {
      m = 1;
    }
    if (m < 1) {
      const sf = Math.round((1 - m) / 0.2);
      if (sf > worst) worst = sf;
    }
  });
  return worst;
}
// EXPANSION PRESSURE: each turn a bot gains no land its stall counter climbs and its attack margin
// eases (−8%/turn) toward a floor — a king never below 1.15×, a hero never below 1.0×. Neutral
// guards take casualties even when they win, so a near-even assault still wears the garrison down
// for the next attempt. Reset the moment land grows.
export function botStallTurns(G, pi) {
  return ((G.players || [])[pi] || {})._botStall || 0;
}
export function botMarginFor(G, pi, c, T) {
  const base = c && c.isKing ? T.kingAttackMargin : T.heroAttackMargin;
  const floor = c && c.isKing ? 1.15 : 1.0;
  const mult = Math.max(0.6, 1 - 0.08 * botStallTurns(G, pi));
  const stake = Math.min(0.1, 0.02 * Math.max(0, ((c && c.armies) || []).length - 5)); // Sept 2026 (R5): the bigger the host, the more a loss costs
  return Math.max(Math.min(base, floor), base * mult) + stake;
}
export function botNoteLand(G, pi) {
  const p = (G.players || [])[pi];
  if (!p) return;
  const land = (G.world.provinces || []).filter((x) => x && x.owner === pi && x.terrain !== 'sea').length;
  if (p._botLandSeenTurn === G.turn) return; // once per turn
  if (p._botLandPrev != null) {
    p._botStall = land > p._botLandPrev ? 0 : (p._botStall || 0) + 1;
  }
  p._botLandPrev = land;
  p._botLandSeenTurn = G.turn;
}
export function botRelationRaw(G, a, b) {
  if (a == null || b == null || a === b) return 'neutral';
  const k = a < b ? a + '-' + b : b + '-' + a;
  return (G.relations || {})[k] || 'neutral';
}
// ── PERSONAL-COMBAT PROVINCE MARKER ────
// _hadBattleThisTurn drives the map's RED crossed swords and is for ARMY battles only. A personal
// combat — a duel (ambush, pursuit, thief caught in the act, a Challenge), a lair/monster
// encounter, or an assassination attempt — now paints a PURPLE pair of swords instead. Unlike a
// field battle, which the whole neighbourhood sees, a duel is a private affair: we record WHICH
// PLAYERS were in it and the per-player report only sets hadCombat for those realms, so a covert
// ambush never advertises itself to a bystander who happens to have the province explored. Cleared
// with the battle flags at the end of the turn.
export function markProvinceCombat(prov, players) {
  if (!prov) return;
  const arr = prov._combatPlayersThisTurn || (prov._combatPlayersThisTurn = []);
  (players || []).forEach((pi) => {
    if (pi != null && !arr.includes(pi)) arr.push(pi);
  });
}

// ── ALIGNMENT DIPLOMACY ────
// ALIGNMENTS_P is the moral spectrum (Divine 0 … Neutral 3 … Undead 6) and it now decides, on its
// own,
// who a bot courts and who it fights. Same alignment or ONE step away (alignDistP <= 1) => offer a Treat
// every turn until the pact is sealed. TWO steps or more => war. That is the whole rule: the old
// war-on-contact default and the anti-runaway coalition no longer override it (see
// botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim, src/engine/bots/bot-diplomacy-treats-and-wars-by-alignment-the-grudge-and-a-reckoning-claim.ts).
export const BOT_ALLY_ALIGN_DIST = 1;
export function botAlignOf(G, pi) {
  return ((G.players || [])[pi] || {}).alignment || 'Neutral';
}
export function botAlignFriendly(G, a, b) {
  return alignDistP(botAlignOf(G, a), botAlignOf(G, b)) <= BOT_ALLY_ALIGN_DIST;
}
// A rival one of OUR allies is also at war with. Concentrating on the common foe is what an
// alliance is for — it biases target selection, it does not change who we are at war with.
export function botMutualFoe(G, pi, j) {
  if (j == null || j === pi) return false;
  const pls = G.players || [];
  for (let a = 0; a < pls.length; a++) {
    if (a === pi || a === j || !pls[a]) continue;
    if (botRelationRaw(G, pi, a) === 'allied' && botRelationRaw(G, a, j) === 'enemy') return true;
  }
  return false;
}
export function botConceded(G, pi) {
  return !!((G.players || [])[pi] || {}).conceded;
}
