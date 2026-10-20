// ── EFFECTIVE SKILL ────
// Every bonus that changes what a character's skill IS: equipped items, the Crown of Command aura
// (+1 to all skills while the bearer — or a co-located ally of the same realm — carries it), and the
// Curse spell's temporary reduction. Capped 0..5, as skills always are for effect purposes.
// runTurn's effStat() delegates here, and the player report renders from the SAME function, so what a
// player is shown can never drift from what the engine actually uses. `chars` is the character list
// to search for an aura bearer (runTurn passes G.characters, the report passes
// gameState.characters).
// Skills whose TRAINED levels 6-9 also count for effect (not just items past 5). 2026-09-24: Druid.
const FULL_RANGE_SKILLS = new Set(['druid']);
function skillBonusBreakdown(c, stat, chars) {
  const out = { base: ((c && c.skills) || {})[stat] || 0, items: 0, aura: 0, curse: 0, sources: [] };
  if (!c) return out;
  // every source carries a `kind` so the portals can colour-code where a bonus comes from (item /
  // aura / title / perk / discovery / curse) instead of running them all together into one
  // anonymous "+3".
  dedupeItemsByName(activeItems(c)).forEach((it) => {
    if (it.effect && it.effect.stat === stat && it.effect.bonus) {
      out.items += it.effect.bonus;
      out.sources.push({ label: it.name || 'an item', delta: it.effect.bonus, kind: 'item' });
    }
  });
  const _cur = (c._curses || {})[stat] || 0;
  if (_cur) {
    out.curse = -_cur;
    out.sources.push({ label: 'Curse', delta: -_cur, kind: 'curse' });
  }
  if (c.location != null && Array.isArray(chars)) {
    const bearer = chars.find(
      (o) =>
        o &&
        o.alive &&
        o.player === c.player &&
        o.location === c.location &&
        activeItems(o).some((it) => it.effect && it.effect.stat === 'aura'),
    );
    if (bearer) {
      out.aura = 1;
      out.sources.push({
        label: bearer.id === c.id ? 'Crown of Command' : `Crown of Command (${bearer.name})`,
        delta: 1,
        kind: 'aura',
      });
    }
  }
  // TRAINING tops out at 5 for benefit purposes — levels 6-9 buy mastery perks and mastery ORDERS
  // instead of further scaling, which is the documented rule the engine is tuned around (see the
  // Sage discovery chance, the Druid army bonus, the Thief hoard cut).
  // MELEE and ARCHERY only: item and aura bonuses stack ON TOP of that capped base, to the ceiling of 9.
  // Levels past 5 already mean something for those two (damage, +5%/level to-hit, perkTier), so a
  // Legendary +4 blade is felt in full instead of being worth one level to a Melee 4 hero and nothing
  // at all to a Melee 5 one.
  // EVERY OTHER SKILL: the total still stops at 5, so a +2 Tome cannot make a Tactical 5 hero
  // out-general a trained Tactical 9 in the battle maths.
  // DRUID (2026-09-24, Toby): the whole skill counts — trained levels 6-9 add, and items/aura stack on
  // top, to the ceiling of 9. (Druid mastery, primal strikes, the parley roll and the Curse's choice of
  // skill all read this figure.)
  const _trained = Math.max(0, Math.min(FULL_RANGE_SKILLS.has(stat) ? SKILL_MAX : SKILL_BENEFIT_CAP, out.base));
  const _ceiling = ITEM_UNCAPPED_SKILLS.has(stat) || FULL_RANGE_SKILLS.has(stat) ? SKILL_MAX : SKILL_BENEFIT_CAP;
  out.total = Math.max(0, Math.min(_ceiling, _trained + out.items + out.aura + out.curse));
  out.bonus = out.total - _trained; // what the extras are actually WORTH
  return out;
}
function effSkillOf(c, stat, chars) {
  return skillBonusBreakdown(c, stat, chars).total;
}

function dedupeItemsByName(items) {
  const seen = new Set();
  const out = [];
  (items || []).forEach((it) => {
    if (!it) return;
    const k = it.name || 'fx:' + JSON.stringify(it.effect || {});
    if (seen.has(k)) return;
    seen.add(k);
    out.push(it);
  });
  return out;
}
// ── MAXIMUM HP ── a character's maximum HP is an earned pool again.
// max HP = start (15; 18 for an Orcish character of an Orcish realm) + hpEarned + item bonuses + ro08.
// hpEarned grows ONLY through personal combat — see rollHpGain. 2026-10-09 (Toby item 16): every roll
// GAINS; the roll only sets how much: 1–3 while the earned base is under 40, 1–2 from 40, 1 from 50
// (+5 on each shoulder for the Orcish edge). The old shrinking chance of any gain at all is gone.
// A winner adds +1 (awardHpRoll). Skills no longer drive HP.
const HPGAIN_START = 15,
  HPGAIN_START_ORC = 18,
  HPGAIN_ORC_SHIFT = 5,
  HPGAIN_MIGRATE_CLAMP = 60;
const HPGAIN_S1 = 40,
  HPGAIN_S2 = 50;
// The realms the max-HP helpers fall back on when they are given none: a field of one state object, not a top-level
// `let` (plan P1-09b), so that once the engine is modules (P1-09d) the files that set it change a field, never another
// file's binding. P1-10 passes the realms in and removes it.
const maxHpPlayers = { players: null }; // set by runTurn / generateNewGame so module-level callers can see the realm races
function maxHpIsOrc(ch, players) {
  const pl = players || maxHpPlayers.players || [];
  return !!(ch && ch.race === 'Orcish' && ch.player != null && pl[ch.player] && pl[ch.player].race === 'Orcish');
}
function hpStartOf(ch, players) {
  return maxHpIsOrc(ch, players) ? HPGAIN_START_ORC : HPGAIN_START;
}
// The earned base: start + pool, before any item/discovery bonus. This is what the gain curve
// reads.
function hpEarnedBase(ch, players) {
  return hpStartOf(ch, players) + Math.max(0, Math.round((ch && ch.hpEarned) || 0));
}
function itemMaxHpBonus(ch) {
  const seen = new Set();
  let b = 0;
  activeItems(ch).forEach((it) => {
    if (it && it.effect && it.effect.stat === 'maxHp' && !seen.has(it.name)) {
      seen.add(it.name);
      b += it.effect.bonus || 0;
    }
  });
  return b;
}
function computeMaxHp(ch, players) {
  if (!ch) return HPGAIN_START;
  // realm-wide `maxHp` discoveries (ro08 Thick Hides) add a flat amount on top.
  const _plHp = ch.player != null ? (players || maxHpPlayers.players || [])[ch.player] : null;
  const _discHp = _plHp ? discMaxHpFor(_plHp, ch) : 0;
  return hpEarnedBase(ch, players) + itemMaxHpBonus(ch) + _discHp;
}
// The gain curve. Returns {lo, hi}: how much the NEXT roll gains, given the current earned base.
function hpGainBand(ch, players) {
  const base = hpEarnedBase(ch, players),
    sh = maxHpIsOrc(ch, players) ? HPGAIN_ORC_SHIFT : 0;
  if (base < HPGAIN_S1 + sh) return { lo: 1, hi: 3 };
  if (base < HPGAIN_S2 + sh) return { lo: 1, hi: 2 };
  return { lo: 1, hi: 1 };
}
// Roll a maximum-HP gain for a REAL character and apply it (the rise heals into the new headroom).
// Every roll gains (item 16); the roll is only the amount. Returns {gain, maxHp}. `why` is only used
// for the note.
function rollHpGain(ch, players, why) {
  if (!ch || ch.alive === false) return { gain: 0, maxHp: ch ? ch.maxHp : 0 };
  const band = hpGainBand(ch, players);
  const gain = Math.floor(kcRng() * (band.hi - band.lo + 1)) + band.lo;
  ch.hpEarned = Math.max(0, Math.round(ch.hpEarned || 0)) + gain;
  syncMaxHp(ch, players);
  return { gain, maxHp: ch.maxHp, why: why || '' };
}
function hpGainLine(ch, r) {
  if (!r) return '';
  // 2026-10-08/09 (Toby item 16): a wounded hero rolls too (r.wound); a winner gets +1 on the roll
  // (r.winBonus). Every roll gains — there is no longer a chance of nothing.
  if (!(r.gain > 0)) return '';
  if (r.wound) return `💪 ${ch.name} is hardened by the wounds of the fight — maximum HP +${r.gain} → ${r.maxHp}.`;
  return `💪 ${ch.name} is hardened by the victory — maximum HP +${r.gain} → ${r.maxHp}${r.winBonus ? ' (including +1 for the win)' : ''}.${r.sd35 ? ' (Order of the Golden Shield: doubled.)' : ''}`;
}
// Bring ch.maxHp in line with the formula. A rise heals current HP by the rise (new headroom is
// filled); a fall clamps current HP to the new maximum (never below 1 for a living character).
// Returns the change (0 when nothing moved).
function syncMaxHp(ch, players) {
  if (!ch) return 0;
  const nu = computeMaxHp(ch, players),
    old = ch.maxHp != null ? ch.maxHp : nu;
  if (nu === old) {
    if (ch.maxHp == null) ch.maxHp = nu;
    return 0;
  }
  ch.maxHp = nu;
  if (ch.hp != null) {
    if (nu > old) ch.hp = Math.min(nu, ch.hp + (nu - old));
    else ch.hp = Math.max(ch.alive === false ? 0 : Math.min(1, ch.hp), Math.min(ch.hp, nu));
  }
  return nu - old;
}
// Retired Sage discoveries (never recycle an id — add to this set, never remove from it).
// sd34 'Mounted Couriers' retired 2026-09-21: it never fired (no pre-order reaches the hire phase's own slot).
const RETIRED_DISCOVERY_IDS = new Set(['sd34']);
function retireDiscoveries(gs) {
  let n = 0;
  ((gs && gs.players) || []).forEach((pl) => {
    if (!pl || !Array.isArray(pl.discoveries)) return;
    const before = pl.discoveries.length;
    pl.discoveries = pl.discoveries.filter((d) => !RETIRED_DISCOVERY_IDS.has(typeof d === 'string' ? d : d && d.id));
    n += before - pl.discoveries.length;
    // 2026-09-21 rebalance: the stored name / field / text of a held discovery is refreshed from the
    // master table, so a realm that found it under the old numbers reads what it does NOW.
    pl.discoveries.forEach((d) => {
      const m = d && typeof d === 'object' && DISC_BY_ID[d.id];
      if (m) {
        d.name = m.name;
        d.category = m.category;
        d.desc = m.desc;
      }
    });
  });
  if (gs) gs._retiredDiscoveries = (gs._retiredDiscoveries || 0) + n;
  return n;
}
// Migration: any living character without an earned pool gets one from their current maximum —
// earned base = maxHp minus item/discovery bonuses, clamped to HPGAIN_MIGRATE_CLAMP
// (60), pool = base − start. Saves made under the derived-HP formula keep their figures (never reset);
// characters created since (hp 15) simply get pool 0. Runs every turn (cheap) so a hero spawned or
// hired mid-turn is always initialised; the one-time chronicle note fires only on the first pass.
function migrateMaxHpV2(gs) {
  if (!gs) return;
  maxHpPlayers.players = gs.players || [];
  const first = !gs._maxHpV3;
  (gs.characters || []).forEach((ch) => {
    if (!ch || !ch.alive) return;
    if (ch.hpEarned == null) {
      const old = ch.maxHp || HPGAIN_START;
      const _pl = ch.player != null ? maxHpPlayers.players[ch.player] : null;
      const bonuses = itemMaxHpBonus(ch) + (_pl ? discMaxHpFor(_pl, ch) : 0);
      const base = Math.min(HPGAIN_MIGRATE_CLAMP, old - bonuses);
      ch.hpEarned = Math.max(0, Math.round(base - hpStartOf(ch, gs.players)));
      const d = syncMaxHp(ch, gs.players);
      if (first && d !== 0 && ch.player != null) {
        gs._maxHpMigration = gs._maxHpMigration || [];
        gs._maxHpMigration.push({ charId: ch.id, player: ch.player, old, nu: ch.maxHp });
      }
    } else syncMaxHp(ch, gs.players);
  });
  gs._maxHpV2 = true;
  gs._maxHpV3 = true;
  migrateLairGuardiansV2(gs);
}
// guardian HP rescaled. Uncleared lairs in older saves adopt the current table stats for their
// creature (matched by name) — once only.
// A guardian's perks: `passives` (2026-10-14, batch item 7: one per grade, Weak 1 … Legendary 4) — or
// the single `passive` an older save may still hold until migrateLairGuardiansV2 re-reads it.
function guardianPassives(m) {
  if (!m) return [];
  if (Array.isArray(m.passives)) return m.passives.filter((p) => p && p.fx);
  return m.passive && m.passive.fx ? [m.passive] : [];
}
const GUARDIAN_TABLE_VER = 20; // 20 (2026-10-14, batch item 7): every guardian has one perk per grade (`passives`: Weak 1, Moderate 2, Powerful 3, Legendary 4), each scaled to its grade, many of them wards against a school of magic. · 19 (2026-10-14, batch item 4): every guardian special's castChance ×1.5, rounded, capped at 95 (was 35–70%, now 53–95%). · 18 (2026-10-08, Toby item 4): no guardian resists and is weak to the same thing — Rust-Mite Swarm now Elementally Frail, Sphinx Open to Arrows, Lich Acolyte keeps Hallowed Bane (every undead is open to White) and trades its spell ward for Hollow Bones (arrows deal 3 less), Dire Rat Old Enemy: Dwarven. · 17 (2026-09-29, Toby): HP BANDS NARROWED and the top three cut to ~75% — Weak 11–17, Moderate 19–25, Powerful 32–42, Legendary 53–65 (each guardian keeps its rank within its tier). 16: 16: HP BANDS WIDENED — Weak 10–18, Moderate 22–38, Powerful 41–59, Legendary 65–95. Same band midpoints as 15 but a wider internal spread (so HP still separates guardians inside a band) and smaller gaps between bands (4 / 3 / 6). Remapped from the v13 spread, not from 15, so no resolution was lost to the intermediate rounding. Supersedes 15 and 14. · 14: EVERY GUARDIAN'S HP +50% (all 110, rounded half up; nothing else touched — melee, archery, specials, passives, weaknesses and gold all unchanged). Percentage caps (GUARDIAN_HIT_CAP_FRAC, GUARDIAN_BODY_CAP_PCT) scale with it automatically. · 13: THE LADDER RE-TUNE — every band re-cut to a fixed benchmark hero at a 95% kill rate (Weak: 15 HP, no items, Melee 3/Archery 2 or Melee 4/Archery 1 + a school at 1 · Moderate: 30 HP, 5 tier-1 items, Melee 6 + school 3 · Powerful: 45 HP, tier-2 kit, Melee 7 + school 5 · Legendary: 60 HP, tier-3 kit, Melee 9 + school 7), each band keeping its internal order, hardest ~95% and softest ~99%; hp / melee / castChance / dmgBonus moved, nothing else (see claude/KC-guardian-ladder.md) · 12: no guardian routs a hero any more — Banshee, Elder Dragon and Archdemon trade their courage tests for a stagger, a pinning gaze and a sin-weighing that halves current HP · 11: band re-balance — the six hardest Powerful guardians drop meleeDR 3→2, the six softest rise to melee 6, flat melee damage reduction now ladders 1 / 2 / 2 / 4 by band (no Moderate keeps a 3), and every Legendary gains body, +5 damage a blow (Kraken +7) and castChance +10 · 10: every guardian gained a `weak` (exploitable weakness) · 9: every special castChance +20 (50–75%) · 8: Weak HP 15–20, five Weak passives stripped · 7: Weak-tier meleeDR passives capped at 1 · 6: skills on the 1–9 ladder, every guardian has an active + a passive · 5: dmgW weights // bump whenever MONSTERS_P stats change so live worlds adopt the new figures
function migrateLairGuardiansV2(gs) {
  if (!gs || !gs.world) return;
  if ((gs._guardiansVer || 0) >= GUARDIAN_TABLE_VER) return;
  const byName = {};
  MONSTERS_P.forEach((m) => {
    byName[m.name] = m;
  });
  (gs.world.provinces || []).forEach((p) =>
    (p.features || []).forEach((f) => {
      if (!f || f.cleared || !f.monster) return;
      const t = byName[f.monster.name];
      if (!t) return;
      f.monster.hp = t.hp;
      f.monster.melee = t.melee;
      f.monster.archery = t.archery;
      delete f.monster._hpFull;
      if (t.spells) f.monster.spells = JSON.parse(JSON.stringify(t.spells));
      else delete f.monster.spells; // v5: specials carry dmgW weights now
      delete f.monster.passive; // v20 (batch item 7): one perk per grade, in `passives`
      if (t.passives) f.monster.passives = JSON.parse(JSON.stringify(t.passives));
      else delete f.monster.passives;
      if (t.weak) f.monster.weak = JSON.parse(JSON.stringify(t.weak));
      else delete f.monster.weak; // v10: exploitable weaknesses
    }),
  );
  gs._guardiansV2 = true;
  gs._guardiansVer = GUARDIAN_TABLE_VER;
}
