// ── THE PROTOTYPE KITS' TURN STEPS (alignment ideas rounds 1 and 2, 2026-10-25) ────
// What a kit does between the phases, once a turn, after the turn counter has advanced (the new-turn step calls it
// before the graves decay): beasts bred in a held wild province (Druidic, Evil), the dead rising in an Undead realm's
// graveyards and despoiled lands, Terror fading (Evil), the green healing a Druidic realm's heroes, mercenary bands drawn
// to a Neutral realm's markets. Nothing here is a decided rule (src/engine/alignment-prototypes.ts).
import { KC_QUALITY_TIERS, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import type { Army, Province } from '../../schemas/saved-game-state.ts';
import {
  alignProto,
  BARROW_RISE_PER_TURN,
  isBarrow,
  isWild,
  protoAlignOf,
  UNDEAD_GARRISON_CAP,
} from '../alignment-prototypes.ts';
import { armyUnitNameOf } from '../dice-and-army-names.ts';
import { kcRng } from '../rng.ts';
import type { TurnContext } from './context.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from './events-and-their-audiences.ts';
import { newMercId } from './mercenary-ids-and-battle-records.ts';

const CREATURES = new Set<string>(KC_UNIT_CLASS.creature);
const MONSTERS = new Set<string>(KC_UNIT_CLASS.monster);
/** A held wild province breeds a beast into its garrison every this many turns (round 2: Druidic every 4th, Evil every 3rd). */
export const WILD_BREED_EVERY = 5; // round 8 (rounds 1-7: 3)
export const WILD_BREED_EVERY_DRUIDIC = 6; // round 8 (rounds 2-7: 4)
/** The most companies a kit will raise into one garrison on its own. */
export const KIT_GARRISON_CAP = 3;
export const FOREST_HEAL_SHARE = 0.25;
export const NEUTRAL_MERC_CHANCE = 0.5; // round 9: every other turn again (round 8's every turn overshot)
const TIERS: readonly string[] = KC_QUALITY_TIERS;
/** The most experienced of a province's battlefield dead, taken from its graves (as the dead are raised everywhere). */
function takeTheBestGrave(pv: Province): Army | null {
  const graves = pv.battleGraves ?? [];
  let best = -1;
  graves.forEach((g, i) => {
    if (best < 0 || TIERS.indexOf(g.quality) > TIERS.indexOf(graves[best]?.quality ?? '')) best = i;
  });
  if (best < 0) return null;
  const [g] = graves.splice(best, 1);
  return g ?? null;
}
const fieldUnit = (t: string): boolean => !/garrison|fleet|galley|ironclad|longship/i.test(t);

export function alignmentPrototypeNewTurnSteps(turnContext: TurnContext): void {
  const { G } = turnContext;
  if (!Array.isArray(G.alignmentPrototypes) || !G.alignmentPrototypes.length) return;
  const provinces = G.world.provinces;
  const line = (pi: number, text: string, pv: Province | null): void => {
    emit(turnContext, {
      type: 'hire',
      text,
      audience: { actor: pi, realms: [pi] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: pv ? pv.id : undefined,
    });
  };

  for (const pv of provinces) {
    if (pv.terrain === 'sea') continue;
    const pi = pv.owner;

    // ── EVIL: Terror fades ── a stack set before the turn just played fades by one each turn it is not renewed.
    if (pv._terrorStacks && pv._terrorisedBy != null && alignProto(G, 'Evil') && pv._terrorTurn !== G.turn - 1) {
      pv._terrorStacks -= 1;
      if (pv._terrorStacks <= 0) {
        delete pv._terrorStacks;
        delete pv._terrorTurn;
        delete pv._terrorisedBy;
        delete pv._terrorPct;
      }
    }
    const align = pi == null ? null : protoAlignOf(G, pi);
    if (pi == null || align == null) continue;

    // ── DRUIDIC / EVIL: a held wild province breeds ── every third turn a beast of its kind joins the garrison.
    const breedEvery = align === 'Druidic' ? WILD_BREED_EVERY_DRUIDIC : WILD_BREED_EVERY;
    if ((align === 'Druidic' || align === 'Evil') && isWild(pv) && G.turn % breedEvery === 0) {
      const kind = pv.armyTypes.find((t) => (align === 'Druidic' ? CREATURES.has(t) : MONSTERS.has(t)));
      if (kind && pv.garrisonArmies.length < KIT_GARRISON_CAP) {
        const u: Army = { type: kind, quality: 'Average', race: pv.race ?? 'Primal', unitName: armyUnitNameOf(kind) };
        pv.garrisonArmies.push(u);
        line(
          pi,
          align === 'Druidic'
            ? `🐾 The wild answers the druids: ${u.unitName} (${kind}) comes down to guard ${pv.name}.`
            : `🩸 The beast-pits of ${pv.name} yield ${u.unitName} (${kind}) to the garrison.`,
          pv,
        );
      }
    }

    // ── UNDEAD: the dead rise unbidden ── (round 2: only in dead land) a grave in a held despoiled province or at a held
    // barrow rises as a skeletal garrison company; a despoiled province raises one from its own blackened soil whether
    // graves lie there or not.
    const barrow = pv.features.some(isBarrow);
    const deadLand = pv._despoiled != null || barrow;
    const rises = barrow ? BARROW_RISE_PER_TURN : 1; // round 3: a barrow raises two a turn
    for (let k = 0; k < rises; k++) {
      if (
        align !== 'Undead' ||
        !deadLand ||
        pv.garrisonArmies.filter((a) => a._isSkeletal).length >= UNDEAD_GARRISON_CAP
      )
        break;
      let u: Army | null = null;
      if ((pv.battleGraves ?? []).length) {
        const g = takeTheBestGrave(pv);
        if (g)
          u = {
            type: g.type,
            quality: g.quality,
            race: 'Undead',
            _isSkeletal: true,
            unitName: `${g.unitName || armyUnitNameOf(g.type)} (Skeletal)`,
          };
      } else if (pv._despoiled != null) {
        u = {
          type: 'Shieldwall Levies',
          quality: 'Average',
          race: 'Undead',
          _isSkeletal: true,
          unitName: `${armyUnitNameOf('Shieldwall Levies')} (Skeletal)`,
        };
      }
      if (!u) break;
      u._kitGarrison = true; // the dead land holds them: no master needed while they garrison an Undead province
      pv.garrisonArmies.push(u);
      line(pi, `💀 The dead rise in ${pv.name}: ${u.unitName} (${u.quality}) joins the garrison unbidden.`, pv);
    }
  }

  // ── UNDEAD (round 2): the Plague runs its course ── each turn a company in the plagued province dies and lies in the
  // grave (a garrison company first, else a neutral defender), and its tax falls by one, to 1 at least.
  for (const pv of provinces) {
    const pk = pv._kitPlague;
    if (!pk) continue;
    if (pk.until < G.turn || !alignProto(G, 'Undead')) {
      delete pv._kitPlague;
      continue;
    }
    let dead: Army | null = null;
    const gi = pv.garrisonArmies.findIndex((a) => !a._isSkeletal);
    if (gi >= 0) dead = pv.garrisonArmies.splice(gi, 1)[0] ?? null;
    else if (pv.neutralDefenders.length) {
      const d = pv.neutralDefenders.shift();
      if (d) {
        dead = { type: d.type, quality: d.quality, race: d.race, unitName: d.unitName || armyUnitNameOf(d.type) };
        pv.npcArmies = Math.max(0, pv.npcArmies - 1);
      }
    }
    if (dead) {
      pv.battleGraves = pv.battleGraves ?? [];
      pv.battleGraves.push({ type: dead.type, quality: dead.quality, race: dead.race, unitName: dead.unitName });
    }
    const tax0 = pv.tax;
    pv.tax = Math.max(1, pv.tax - 1);
    const words = `${dead ? `${dead.unitName || dead.type} (${dead.quality}) dies and is laid in the grave` : 'no soldier is left to die'}; tax ${String(tax0)} → ${String(pv.tax)}.`;
    line(pk.by, `☠ The Plague in ${pv.name}: ${words}`, pv);
    if (pv.owner != null && pv.owner !== pk.by) line(pv.owner, `☠ The Plague in ${pv.name}: ${words}`, pv);
  }

  // ── DRUIDIC: the green heals ── a hero of the realm who ends the turn in forest or jungle recovers a quarter of their
  // hit points.
  for (const c of G.characters) {
    if (!c.alive || c.player == null || protoAlignOf(G, c.player) !== 'Druidic') continue;
    const pv = provinces[c.location];
    if (!pv || !(pv.terrain === 'forest' || pv.terrain === 'jungle')) continue;
    const max = c.maxHp || 20;
    if (c.hp >= max) continue;
    const heal = Math.max(1, Math.ceil(max * FOREST_HEAL_SHARE));
    c.hp = Math.min(max, c.hp + heal);
    line(
      c.player,
      `🌿 The green mends ${c.name} in the woods of ${pv.name}: +${String(heal)} HP (${String(c.hp)}/${String(max)}).`,
      pv,
    );
  }

  // ── NEUTRAL: the markets draw sell-swords ── each turn a Neutral realm has an even chance that a mercenary band of a
  // held humanoid province's own kind appears there, for hire at the realm's discount.
  G.players.forEach((p, pi) => {
    if (protoAlignOf(G, pi) !== 'Neutral' || kcRng() >= NEUTRAL_MERC_CHANCE) return;
    const towns = p.provinces
      .map((id) => provinces[id])
      .filter((pv): pv is Province => !!pv && pv.owner === pi && pv.terrain !== 'sea' && !isWild(pv))
      .filter((pv) => pv.armyTypes.some(fieldUnit));
    const pv = towns[Math.floor(kcRng() * towns.length)];
    if (!pv) return;
    const types = pv.armyTypes.filter(fieldUnit);
    const type = types[Math.floor(kcRng() * types.length)];
    if (!type) return;
    G.mercenaries.push({
      type,
      quality: 'Average',
      race: pv.race ?? 'Human',
      unitName: armyUnitNameOf(type),
      location: pv.id,
      isSea: false,
      id: newMercId(turnContext),
    });
    line(pi, `💰 Sell-swords come to market: a band of ${type} (Average) offers its services in ${pv.name}.`, pv);
  });
}
