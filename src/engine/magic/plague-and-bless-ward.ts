// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_QUALITY_DOWN } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { _isHumanoidRace } from '../discoveries.ts';
import { aBlessWardMayTurnThisSpellAside } from '../rules/the-registry-of-spell-effects.ts';
import { isVeiled } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';

// ── PLAGUE AND THE BLESS WARD (plan P1-08b: lifted out of resolveTurn) ────
// The Plague's toll on a province's humanoid troops and its spread to the neighbours, and the Bless ward that may turn
// an enemy spell aside. Each takes the turn's context first (src/engine/turn/context.ts).
// ── PLAGUE (Necromancy) ────
// Each humanoid army unit in the province has a (10% + 5%/level) chance to lose an experience
// level. Survivors are immunised (half chance thereafter). Only the four humanoid races suffer.
export const _PLAGUE_QDOWN = { ...KC_QUALITY_DOWN };
// ── Bless ward (item) ── A province blessed this turn can shrug off a later ENEMY negative spell
// (Flood / Earthquake / Plague / Part Sea). Chance = 50% + 5% × the blesser's White skill, counted to
// level 5. Returns true (and logs) when the ward turns the spell aside, so the caller skips the
// effect. Rolls per incoming spell.
export function blessWardNegates(turnContext, prov, caster, spellName) {
  const { G } = turnContext;
  if (!aBlessWardMayTurnThisSpellAside(spellName)) return false; // which spells a ward may turn: the spells' registry (plan P1-19y)
  if (!prov || prov._blessWardTurn !== G.turn) return false;
  if (prov._blessWardBy == null || (caster && prov._blessWardBy === caster.player)) return false; // your own ward never blocks your own spell
  if (kcRng() * 100 >= (prov._blessWardPct || 0)) return false;
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: "a Bless ward turns an enemy's spell aside",
      provinceName: prov.name,
      casterName: caster ? caster.name : null,
      spellName,
    },
    audience: {
      actor: caster ? caster.player : null,
      realms: prov._blessWardBy != null ? [prov._blessWardBy] : [],
      seen: 'battle',
    },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
    env: true,
  });
  return true;
}
export function applyPlague(turnContext, prov, level, ph) {
  const { G } = turnContext;
  const chance = 0.1 + 0.05 * (level || 0);
  // Build the pool WITH provenance so affected units can be reported to the right player: units
  // LED by a present character (→ that character's Chronicle), the owner's unled GARRISON
  // (→ Realm Events), and neutral/leaderless defenders (no player to notify).
  const entries = [];
  (G.characters || [])
    .filter((ch) => ch.alive && ch.location === prov.id && !isVeiled(turnContext, ch))
    .forEach((ch) => {
      // ILLUSORY L9 Veil: a veiled commander's host is spared the plague
      (ch.armies || []).forEach((a) =>
        entries.push({ a, owner: ch.player, charId: ch.player != null ? ch.id : null, garrison: false }),
      );
    });
  (prov.garrisonArmies || []).forEach((a) => entries.push({ a, owner: prov.owner, charId: null, garrison: true }));
  (prov.neutralDefenders || []).forEach((a) => entries.push({ a, owner: null, charId: null, garrison: false }));
  let tested = 0,
    affected = 0;
  const hitByCtx = new Map(); // key → {owner, charId, garrison, units:[]}
  entries.forEach(({ a, owner, charId, garrison }) => {
    if (a._isSkeletal) return; // the walking dead feel no plague
    if (!_isHumanoidRace(a.race)) return;
    tested++;
    const eff = a._plagueImmune ? chance * 0.5 : chance;
    if (kcRng() < eff && _PLAGUE_QDOWN[a.quality]) {
      a.quality = _PLAGUE_QDOWN[a.quality];
      affected++;
      if (owner != null) {
        const key = charId != null ? 'c' + charId : 'g' + owner;
        let rec = hitByCtx.get(key);
        if (!rec) {
          rec = { owner, charId, garrison, units: [] };
          hitByCtx.set(key, rec);
        }
        rec.units.push(a);
      }
    }
    a._plagueImmune = true; // survived a plague → immunised for the future
  });
  // notify each affected player. Led units land in the leading character's Chronicle
  // (charId set); garrisoned units land in Realm Events (no charId, targeted at the owner).
  // These per-unit notices are NOT env-tagged — they belong to the affected player's own report,
  // not the shared Province Reports environmental log.
  hitByCtx.forEach((rec) => {
    const place = {
      audience: { actor: null, realms: [rec.owner] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    };
    if (rec.charId != null) place.hero = rec.charId;
    if (ph != null) place.phase = ph;
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: "the Plague sickens a realm's troops in a province",
        theGarrison: rec.garrison,
        provinceName: prov.name,
        // the units sickened, each its name (else its type) and its new quality, copied as the line is told
        units: rec.units.map((u) => ({ unitName: u.unitName || u.type, quality: u.quality })),
      },
      ...place,
    });
  });
  return { tested, affected };
}
// Each phase, an active plague spreads to adjacent provinces (15% each) and can spread further.
export function spreadPlagues(turnContext, ph) {
  const { G } = turnContext;
  const sources = (G.world.provinces || []).filter((p) => p && p._plaguedTurn === G.turn);
  sources.forEach((p) => {
    getNeighborsP(p, G.world.cols, G.world.rows, G.world.provinces).forEach((nb) => {
      if (!nb || nb._plaguedTurn === G.turn) return;
      if (
        nb._blessWardTurn === G.turn &&
        nb._blessWardBy != null &&
        nb._blessWardBy !== p._plagueCaster &&
        kcRng() * 100 < (nb._blessWardPct || 0)
      )
        return; // blessed ground resists the spreading plague
      if (kcRng() < 0.15) {
        nb._plaguedTurn = G.turn;
        nb._plagueLevel = p._plagueLevel || 0;
        nb._plagueCaster = p._plagueCaster;
        const res = applyPlague(turnContext, nb, nb._plagueLevel, ph);
        emit(turnContext, {
          type: 'combat',
          fact: {
            kind: 'the Plague spreads into a province',
            provinceName: nb.name,
            affected: res.affected,
            tested: res.tested,
          },
          audience: {
            actor: null,
            realms: (nb.owner != null ? [nb.owner] : []).concat(p._plagueCaster != null ? [p._plagueCaster] : []),
            seen: 'battle',
          },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: nb.id,
          env: true,
        });
      }
    });
  });
}
