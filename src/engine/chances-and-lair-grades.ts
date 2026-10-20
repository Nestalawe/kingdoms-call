// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_MAGIC_SCHOOLS, KC_UNIT_CLASS, MONSTERS_P } from '../content/kingdoms-call-data.ts';
import { kcRng } from './rng.ts';
import { shuffleP } from './battle/fortune.ts';
import { SEA_GUARDIAN_NAMES } from './names.ts';
import { activeItems } from './items/equipment.ts';
import { effSkillOf } from './heroes/skills-and-hp.ts';
import { hexDistP } from './world/map-helpers.ts';
import { skillLevel } from './titles/perks.ts';
import { discSumOf } from './discoveries.ts';

// MAGIC L8 PERK — "+10% to cast ANY spell" for each magic school mastered to level 8, stacking
// across
// schools (five schools → up to +50%). Applied at EVERY point a character rolls to cast a spell:
// phase-action casts, personal-combat spells, and pre-battle/battle magic. Each call site keeps its
// own hard 95% cap. Safe on any object (raw skills via skillLevel); returns 0 for
// monsters/undefined. A lair's difficulty, rolled before its guardian is chosen so the two always
// agree. Weighted toward the easier end: most country holds modest dangers, legendary ones are
// rare.
// ── PRE-BATTLE STRIKE CHANCE ────
// Primal (and special-unit) pre-battle strikes fire at 30% + 10% per Druid level of the commander,
// plus any `primalStrike` item bonus the commander carries, hard cap 90%. Read by the NPC-attacker,
// NPC-defender and PvP strike rolls so all three quote and roll the same odds.
export const MASS_HEALING_PCT = 0.5; // WHITE L6 Mass Healing heals this share of max HP per character
export function primalStrikeItemBonus(c) {
  if (!c || typeof activeItems !== 'function') return 0;
  return activeItems(c).reduce(
    (s, it) =>
      s +
      ((it && it.primalStrike) || 0) +
      (it && it.effect && it.effect.stat === 'primalStrike' ? it.effect.bonus || 0 : 0),
    0,
  );
}
// 2026-10-11 (Toby): the winged riders' own strikes (a Griffon's Screech Dive, a Wyvern's Acid Spit) are
// soldiers' work, not beast-craft: a flat chance in two, whatever the commander's Druid.
export const RIDER_STRIKE_PCT = 50;
export function primalStrikeChance(druidLvl, commander, unitType) {
  if (unitType && KC_UNIT_CLASS.flying.includes(unitType)) return RIDER_STRIKE_PCT;
  return Math.min(90, 30 + (druidLvl || 0) * 10 + primalStrikeItemBonus(commander));
}
// == LAIR GRADES: RELICS EVERYWHERE, DANGER FARTHEST FROM HOME ==== The grade of every lair is
// decided here, AFTER all land and sea features exist, rather than rolled one at a time as each
// lair is made. Three rules, in order:
//
// 1. There are ALWAYS exactly as many LEGENDARY lairs as there are legendary relics (22), whatever
// the size of the world - so every relic is kept by a guardian worthy of it, on a two-realm map
// as on a ten-realm one. (If a world somehow held fewer than 22 lairs, every lair is legendary.)
// 2. Those legendary lairs are spread as far apart as the map allows: the first is the lair
// farthest from any home, and each one after it is the lair whose nearest legendary neighbour is
// as distant as possible - a farthest-point walk, so relics are never clustered in one corner.
// 3. Everything else is graded by how far it lies from the nearest king's home. Home provinces and
// the ring adjacent to them run 60% Weak / 30% Moderate / 10% Powerful; the
// further out a lair lies the fewer Weak and the more Moderate and Powerful. The GLOBAL totals
// world is no more dangerous than before - only better arranged.
//
// The guardian is then re-drawn from the beasts of the lair's new standing, respecting land and sea
// pools, so a Legendary lair is kept by a legendary beast and a sea lair never gets a land one.
export function assignLairGrades(provinces, homeIds, cols, rows, relicCount) {
  const lairs = [];
  provinces.forEach((p) =>
    (p.features || []).forEach((f) => {
      if (f && !f.ritualSite) lairs.push({ f, p });
    }),
  );
  if (!lairs.length) return;
  const homes = (homeIds || []).map((id) => provinces[id]).filter(Boolean);
  const dist = (a, b) => hexDistP(a, b, cols);
  const homeDist = (p) => (homes.length ? Math.min(...homes.map((h) => dist(p, h))) : 0);
  lairs.forEach((L) => {
    L.dHome = homeDist(L.p);
  });

  // 1 + 2: the legendary lairs, spread by a farthest-point walk.
  const wantLeg = Math.min(lairs.length, relicCount);
  const legs = [];
  const pool = lairs.slice();
  // 2026-09-21: a king's OWN province never holds a Legendary lair. The farthest-point walk
  // starts far from home but, on a crowded map with 22 relics to place, it could still reach a
  // capital — an audit found an Archdemon sitting in a home province on turn one. Home lairs sit
  // out the walk (whenever the rest of the world has enough lairs to carry all 22 relics) and
  // rejoin the pool for the ordinary grading below.
  const _homeIdSet = new Set(homes.map((h) => h.id));
  const _homeHeld = [];
  if (pool.filter((L) => !_homeIdSet.has(L.p.id)).length >= wantLeg) {
    for (let i = pool.length - 1; i >= 0; i--) if (_homeIdSet.has(pool[i].p.id)) _homeHeld.push(pool.splice(i, 1)[0]);
  }
  if (wantLeg > 0) {
    let first = 0;
    for (let i = 1; i < pool.length; i++) if (pool[i].dHome > pool[first].dHome) first = i;
    legs.push(pool.splice(first, 1)[0]);
    while (legs.length < wantLeg && pool.length) {
      let best = 0,
        bestD = -1;
      for (let i = 0; i < pool.length; i++) {
        let near = Infinity;
        for (const L of legs) {
          const d = dist(pool[i].p, L.p);
          if (d < near) near = d;
        }
        // Ties broken outward: of two equally isolated lairs, take the one deeper from home.
        const score = near * 100 + pool[i].dHome;
        if (score > bestD) {
          bestD = score;
          best = i;
        }
      }
      legs.push(pool.splice(best, 1)[0]);
    }
  }
  legs.forEach((L) => {
    L.grade = 'Legendary';
  });
  _homeHeld.forEach((L) => pool.push(L)); // home lairs back in for ordinary grading

  // 3: the rest, graded by distance from home.
  // ── 2026-09-14: A MIX AT EVERY DISTANCE ────
  // So a king's home country held nothing but Weak lairs and the deep wilds nothing but Powerful
  // ones - no variety at any distance, and no chance of a nasty surprise on your own doorstep or an
  // easy win far from home.
  //
  // Now, two rules:
  // a) HOME BAND (a home province or any province adjacent to one): exactly 60% Weak, 30% Moderate,
  // 10% Powerful, assigned by lot within the band. This is Toby's rule and it holds on every map,
  // whatever shape the world turns out to be.
  // b) EVERYTHING FURTHER OUT: ranked by distance, but with a deliberate JITTER added to the rank
  // before the cut, so the grades SHADE into one another instead of falling in clean rings. Weak
  // thins out and Moderate then Powerful thicken the further from home you go, without any
  // distance being purely one grade.
  //
  // The GLOBAL totals stay at 50 / 38 / 12 of the non-legendary lairs - the world is no more
  // dangerous than before, only better arranged - because the far band is given exactly the counts
  // the home band did not use. Holding the Powerful share to 12% is what keeps the Powerful item
  // stock (10 of every kind, 90 items) covering every Powerful lair even on the largest map;
  // otherwise the tail of them would be handed an item of the wrong tier.
  const nW = Math.round(pool.length * 0.5),
    nM = Math.round(pool.length * 0.38);
  const NEAR_D = 1; // "in and adjacent to" a home province
  // The split is written so that ANY lair whose distance is not a clean number (a malformed
  // province with no col/row, say) falls into the far band rather than into neither — every lair
  // must end up graded, or it would keep whatever tier it was built with and its guardian would not
  // match.
  const near = shuffleP(pool.filter((L) => L.dHome <= NEAR_D));
  const far = pool.filter((L) => !(L.dHome <= NEAR_D));
  // (a) the home band, by lot, at 60 / 30 / 10 - but never claiming more of a grade than the world has.
  const kW = Math.min(nW, Math.round(near.length * 0.6));
  const kM = Math.min(nM, Math.round(near.length * 0.3));
  near.forEach((L, i) => {
    L.grade = i < kW ? 'Weak' : i < kW + kM ? 'Moderate' : 'Powerful';
  });
  // (b) the far country gets whatever the home band left, spread by jittered distance rank.
  const remW = Math.max(0, nW - kW),
    remM = Math.max(0, nM - kM);
  // Shuffle first, then sort by distance alone: the sort is stable, so lairs at the same distance keep
  // their shuffled order. (A random tie-break inside the comparator made the result, and the number of
  // random draws, depend on the browser's sort algorithm.)
  const farKey = (L) => (Number.isFinite(L.dHome) ? L.dHome : Infinity);
  far.splice(
    0,
    far.length,
    ...shuffleP(far).sort((a, b) => {
      const x = farKey(a),
        y = farKey(b);
      return x < y ? -1 : x > y ? 1 : 0;
    }),
  );
  // The jitter is what turns a hard cut into a gradient. At ~35% of the far pool, measured over 400
  // generated worlds (session_harness_0914e.js), the WEAK share falls 60% → 60% → 16% → 4% across
  // the home band, the near marches (d2-3), the far marches (d4-5) and the deep wilds (d6+), and
  // Moderate+Powerful climbs 40% → 40% → 84% → 96%. Less blur puts a cliff at d≈3.5; much more and
  // the gradient washes out into noise.
  //
  // Note one deliberate consequence of Toby's rule: because the home band is PINNED at 10% Powerful
  // while the global Powerful stock is only 12%, the near marches just beyond home end up with
  // FEWER Powerful lairs (~5%) than the home band itself. A king's own doorstep therefore hides the
  // occasional real monster while the settled country a province or two out is the tamest ground in
  // the world — which is the variety near home that the 60/30/10 rule was asking for.
  const jitter = Math.max(1, far.length * 0.35);
  far.forEach((L, i) => {
    L._rank = i + (kcRng() - 0.5) * 2 * jitter;
  });
  far.sort((a, b) => a._rank - b._rank);
  far.forEach((L, i) => {
    L.grade = i < remW ? 'Weak' : i < remW + remM ? 'Moderate' : 'Powerful';
    delete L._rank;
  });

  // ── HOME WEAK-LAIR GUARANTEE (2026-09-21) ── World gen promises every king at least one WEAK
  // lair in his own province, and seeds one there — but this function runs afterwards and re-grades
  // every lair in the world. The home band is 60/30/10 BY LOT across ALL home-band lairs pooled
  // together, so a particular capital could draw nothing but Moderate/Powerful (an audit measured
  // ~7-10% of homes). Fix by SWAPPING grades with a Weak lair elsewhere, so the 22-Legendary count
  // and the world's Weak/Moderate/Powerful totals are exactly what they were.
  homes.forEach((h) => {
    const mine = lairs.filter((L) => L.p === h);
    if (!mine.length || mine.some((L) => L.grade === 'Weak')) return;
    const target = mine.find((L) => L.grade !== 'Legendary') || mine[0];
    const donors = lairs.filter((L) => L.grade === 'Weak' && !_homeIdSet.has(L.p.id));
    // prefer a donor in the home band (keeps that band's mix intact), else the nearest one
    const donor = donors.filter((L) => L.dHome <= NEAR_D)[0] || donors.sort((a, b) => a.dHome - b.dHome)[0];
    if (donor) {
      const g = target.grade;
      target.grade = 'Weak';
      donor.grade = g;
    } else target.grade = 'Weak';
  });

  // Re-draw each guardian from the beasts of its lair's new standing.
  // 2026-10-13 (item 4, Toby): never two of the same guardian in one province. A beast already
  // keeping a lair in this province is left out of the draw; only if that would leave nothing at
  // all does the ladder below reach another standing for one.
  const seaMons = MONSTERS_P.filter((m) => SEA_GUARDIAN_NAMES.has(m.name));
  const landMons = MONSTERS_P.filter((m) => !SEA_GUARDIAN_NAMES.has(m.name));
  const _guardsHere = new Map(); // province id → guardian names already drawn there
  lairs.forEach((L) => {
    const isSea = L.p.terrain === 'sea';
    if (!_guardsHere.has(L.p.id)) _guardsHere.set(L.p.id, new Set());
    const here = _guardsHere.get(L.p.id);
    const src = (isSea ? seaMons : landMons).filter((m) => !here.has(m.name));
    let cand = src.filter((m) => m.power === L.grade);
    if (!cand.length) {
      // No beast of that standing in this element (the seas hold no legendary beast, for instance):
      // take the nearest standing the element does offer, but the LAIR keeps the grade it was
      // given, so the relic count never bends to the shape of the map.
      const ORDER = ['Legendary', 'Powerful', 'Moderate', 'Weak'];
      const from = ORDER.indexOf(L.grade);
      for (let i = from; i < ORDER.length && !cand.length; i++) cand = src.filter((m) => m.power === ORDER[i]);
      for (let i = from - 1; i >= 0 && !cand.length; i--) cand = src.filter((m) => m.power === ORDER[i]);
    }
    if (!cand.length) cand = src.length ? src : MONSTERS_P;
    L.f.monster = { ...cand[Math.floor(kcRng() * cand.length)] };
    here.add(L.f.monster.name);
    L.f.tier = L.grade; // the grade shown to players is the lair's own, not the beast's
    L.f.monster.power = L.grade; // and the guardian is treated as being of that standing
  });
}

export function LAIR_TIER_ROLL() {
  const r = kcRng() * 100;
  // 2026-09-10 item 6: shifted toward the easy end (was 40/32/20/8) — more Weak and Moderate lairs.
  return r < 48 ? 'Weak' : r < 84 ? 'Moderate' : r < 96 ? 'Powerful' : 'Legendary';
}
export const MAGIC_L8_SCHOOLS = KC_MAGIC_SCHOOLS.slice();
// ── CAST CHANCE ────
// 20% + 10% per school level, + the Arcane Codex discovery, + 10% per school mastered to level 8, +
// any alignment/Sage cast discoveries; hard cap 95%. A spell worked from an ITEM is a flat 95%
// (the item carries the craft, and counts as at least level 3), and the Wailing Phylactery makes a
// realm's FIRST Necromancy spell each turn a certainty. The action-phase caster reads this, and so
// does the player's order form — so the odds a player is quoted are the odds that will be rolled.
// `chars` is the character list used to resolve the Crown of Command aura (see
// skillBonusBreakdown). 2026-09-11: EVERY spell roll — action phase, pre-battle magic (NPC and PvP)
// and personal combat — is now 30 + school level × 10 (+ discoveries / L8 mastery), capped 95. Was
// 20 outside personal combat.
export const SPELL_CAST_BASE = 30;
export function castChanceFor(c, school, player, opts) {
  opts = opts || {};
  const lvl = opts.itemCast ? Math.max(3, effSkillOf(c, school, opts.chars)) : effSkillOf(c, school, opts.chars);
  if (lvl <= 0 && !opts.itemCast) return { level: 0, chance: 0, reason: 'no skill' };
  if (opts.itemCast) return { level: lvl, chance: 95, reason: 'item' };
  if (opts.necroAuto) return { level: lvl, chance: 100, reason: 'necroAuto' };
  const arcane = 0; // sd27 Arcane Codex is now an ordinary `cast` effect (kept as a field for old callers)
  const l8 = typeof magicL8CastBonus === 'function' ? magicL8CastBonus(c) : 0;
  const disc = discSumOf(
    player,
    'cast',
    'pct',
    (e) => (!e.school || e.school === school) && (!e.ctx || e.ctx === 'action'),
  );
  return { level: lvl, chance: Math.min(95, SPELL_CAST_BASE + lvl * 10 + arcane + l8 + disc), arcane, l8, disc };
}
// 2026-10-15 (Toby, D7): a hero guarding a neutral province casts at the same odds as a player's hero —
// 30% + 10% a level (the school as effSkillOf counts it: training to 5, items on top), the mastery bonus,
// at most 95%. A guard holds no Sage discoveries. (Was 30% + 15% a level, at most 90%.)
export function guardCastChance(c, school, chars) {
  const lvl = effSkillOf(c, school, chars || []);
  if (lvl <= 0) return 0;
  return Math.min(95, SPELL_CAST_BASE + lvl * 10 + magicL8CastBonus(c));
}
export function magicL8CastBonus(c) {
  return 10 * MAGIC_L8_SCHOOLS.filter((sc) => skillLevel(c, sc) >= 8).length;
}

// ── LIFTED OUT OF resolveTurn (plan P1-08b) ── lair guardians heal between turns. It takes the turn's context first
// (src/engine/turn/context.ts).
// Feature guardians keep their wounds across phases within a turn (so a second searcher meets the
// creature the first one bloodied) but recover fully between turns — a whole year passes.
export function healFeatureMonsters(turnContext) {
  const { G } = turnContext;
  (G.world.provinces || []).forEach((prov) => {
    ((prov && prov.features) || []).forEach((f) => {
      const m = f && f.monster;
      if (!m || m._hpFull == null) return;
      m.hp = m._hpFull;
    });
  });
}
