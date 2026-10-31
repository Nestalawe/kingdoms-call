// ── THE PROTOTYPE KITS' TURN STEPS (alignment ideas rounds 1 and 2, 2026-10-25; the master list, round 19) ────
// What a kit does between the phases, once a turn, after the turn counter has advanced (the new-turn step calls it
// before the graves decay): beasts bred in a held wild province (Druidic, Evil), the dead rising in an Undead realm's
// blighted land and the barrows' graves refilled, the green healing a Druidic realm's heroes, the faith's Absolution
// (Divine), bound souls freed and captives ransomed. Terror no longer fades (master list). Nothing here is a decided
// rule (src/engine/alignment-prototypes.ts).
import { KC_QUALITY_TIERS, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import type { Army, Character, Province } from '../../schemas/saved-game-state.ts';
import {
  alignProto,
  BARROW_GRAVES_HUMANOID,
  BARROW_GRAVES_WILD,
  DIVINE_POWER_ABSOLUTION,
  DIVINE_POWER_REVELATION,
  divinePower,
  isBarrow,
  isHolySite,
  isWild,
  protoAlignOf,
  UNDEAD_GARRISON_CAP,
} from '../alignment-prototypes.ts';
import { armyUnitNameOf } from '../dice-and-army-names.ts';
import { clearTerrorAndPlague } from '../orders/alignment-prototype-orders.ts';
import { kcRng } from '../rng.ts';
import { discoverFeat } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { hexDistP } from '../world/map-helpers.ts';
import type { TurnContext } from './context.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from './events-and-their-audiences.ts';

const CREATURES = new Set<string>(KC_UNIT_CLASS.creature);
const MONSTERS = new Set<string>(KC_UNIT_CLASS.monster);
/** A held wild province breeds a beast into its garrison every this many turns (master list: Druidic every 3rd, Evil
 *  every 4th; rounds 8-18 Evil 5 then 7, Druidic 4 then 6). */
export const WILD_BREED_EVERY = 4;
export const WILD_BREED_EVERY_DRUIDIC = 3;
/** The most companies a kit will raise into one garrison on its own (the Druids' beasts have no cap: master list). */
export const KIT_GARRISON_CAP = 3;
export const FOREST_HEAL_SHARE = 0.25;
export const TERROR_FADE_EVERY = 3;
const TIERS: readonly string[] = KC_QUALITY_TIERS;
const fieldUnit = (t: string): boolean => !/garrison|fleet|galley|ironclad|longship/i.test(t);
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

export function alignmentPrototypeNewTurnSteps(turnContext: TurnContext): void {
  const { G } = turnContext;
  if (!Array.isArray(G.alignmentPrototypes) || !G.alignmentPrototypes.length) return;
  const provinces = G.world.provinces;
  const line = (pi: number, text: string, pv: Province | null, type = 'hire'): void => {
    emit(turnContext, {
      type,
      text,
      audience: { actor: pi, realms: [pi] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: pv ? pv.id : undefined,
    });
  };
  // master list (Pilgrim roads): remember where every hero stands as the turn begins
  for (const c of G.characters) if (c.alive) c._turnStartLoc = c.location;

  // ── EVIL: Terror fades ── (round 20) a stack fades every TERROR_FADE_EVERY turns unless renewed (the master list's
  // Terror never faded; the fade is the round 20 brake)
  if (alignProto(G, 'Evil'))
    for (const pv of provinces) {
      if (!pv._terrorStacks || pv._terrorisedBy == null || protoAlignOf(G, pv._terrorisedBy) !== 'Evil') continue;
      if (G.turn - (pv._terrorTurn ?? G.turn) < TERROR_FADE_EVERY) continue;
      pv._terrorStacks -= 1;
      pv._terrorTurn = G.turn;
      if (pv._terrorStacks <= 0) {
        delete pv._terrorStacks;
        delete pv._terrorTurn;
        delete pv._terrorisedBy;
        delete pv._terrorPct;
      }
    }

  for (const pv of provinces) {
    if (pv.terrain === 'sea') continue;
    const pi = pv.owner;
    const align = pi == null ? null : protoAlignOf(G, pi);
    if (pi == null || align == null) continue;

    // ── DRUIDIC / EVIL: a held wild province breeds ── every 3rd (Druidic) or 4th (Evil) turn a beast of its kind joins
    // the garrison; the Druids' beasts gather without cap, the Evil pits to three.
    const breedEvery = align === 'Druidic' ? WILD_BREED_EVERY_DRUIDIC : WILD_BREED_EVERY;
    if ((align === 'Druidic' || align === 'Evil') && isWild(pv) && G.turn % breedEvery === 0) {
      const kind = pv.armyTypes.find((t) => (align === 'Druidic' ? CREATURES.has(t) : MONSTERS.has(t)));
      if (kind && (align === 'Druidic' || pv.garrisonArmies.length < KIT_GARRISON_CAP)) {
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

    if (align !== 'Undead') continue;
    // ── UNDEAD: the dead of this soil ── a blighted province raises an Average skeletal company into its garrison each
    // turn (to three), from its graves first, else from its own blackened soil; they hold the province and cannot be led
    // away (_kitGarrison).
    if (pv._despoiled != null && pv.garrisonArmies.filter((a) => a._isSkeletal).length < UNDEAD_GARRISON_CAP) {
      let u: Army;
      const g = (pv.battleGraves ?? []).length ? takeTheBestGrave(pv) : null;
      if (g)
        u = {
          type: g.type,
          quality: g.quality,
          race: 'Undead',
          _isSkeletal: true,
          unitName: `${g.unitName || armyUnitNameOf(g.type)} (Skeletal)`,
        };
      else
        u = {
          type: 'Shieldwall Levies',
          quality: 'Average',
          race: 'Undead',
          _isSkeletal: true,
          unitName: `${armyUnitNameOf('Shieldwall Levies')} (Skeletal)`,
        };
      u._kitGarrison = true;
      pv.garrisonArmies.push(u);
      line(pi, `💀 The dead of this soil rise in ${pv.name}: ${u.unitName} (${u.quality}) joins the garrison unbidden.`, pv);
    }
    // ── UNDEAD: the barrow dead ── (master list) a held barrow keeps its graves filled: a humanoid barrow three graves,
    // each an Average unit of a kind the province can recruit; a creature or monster barrow one grave of its kind. The
    // necromancers raise them with the Necromancy spells (no company rises on its own any more).
    if (pv.features.some(isBarrow)) {
      const wild = isWild(pv);
      const kinds = wild ? pv.armyTypes.filter((t) => CREATURES.has(t) || MONSTERS.has(t)) : pv.armyTypes.filter(fieldUnit);
      const want = wild ? BARROW_GRAVES_WILD : BARROW_GRAVES_HUMANOID;
      pv.battleGraves = pv.battleGraves ?? [];
      let added = 0;
      while (pv.battleGraves.length < want && kinds.length) {
        const kind = kinds[Math.floor(kcRng() * kinds.length)] ?? kinds[0] ?? 'Shieldwall Levies';
        pv.battleGraves.push({ type: kind, quality: 'Average', race: pv.race ?? 'Human', unitName: armyUnitNameOf(kind) });
        added += 1;
      }
      if (added)
        line(
          pi,
          `⚰ The barrow of ${pv.name} fills again: ${String(added)} grave${added !== 1 ? 's' : ''} lie ready for the necromancers (${String(pv.battleGraves.length)} in all).`,
          pv,
        );
    }
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

  // ── DIVINE: Absolution (Divine Power 5) ── every plague and stack of Terror on the realm's provinces is lifted. (The
  // design lifts curses and charms from its heroes too; the heroes' part is not modelled yet.)
  G.players.forEach((p, pi) => {
    if (protoAlignOf(G, pi) !== 'Divine' || divinePower(G, pi) < DIVINE_POWER_ABSOLUTION) return;
    let terror = 0;
    let plagues = 0;
    for (const id of p.provinces) {
      const pv = provinces[id];
      if (pv?.owner !== pi) continue;
      const r = clearTerrorAndPlague(pv);
      terror += r.terror;
      plagues += r.plague ? 1 : 0;
    }
    if (terror || plagues)
      line(
        pi,
        `✨ Absolution: the faith washes the realm clean — ${String(terror)} stack${terror !== 1 ? 's' : ''} of Terror and ${String(plagues)} plague${plagues !== 1 ? 's' : ''} lifted.`,
        null,
        'explore',
      );
  });

  // ── DIVINE: Revelation (Power 3) / DRUIDIC: Earth-speech ── the realm knows the old sites: every holy site on the map
  // (Divine), or every ritual site, holy site and barrow within 2 hexes of its land (Druidic; the design tells the realm
  // only that something sleeps there, which the bots cannot use, so here they learn the site itself)
  G.players.forEach((p, pi) => {
    const kit = protoAlignOf(G, pi);
    if (kit === 'Divine' && divinePower(G, pi) >= DIVINE_POWER_REVELATION)
      for (const pv of provinces) for (const f of pv.features) if (isHolySite(f)) discoverFeat(f, pi);
    if (kit === 'Druidic' && p.provinces.length) {
      const land = p.provinces.map((id) => provinces[id]).filter((x): x is Province => !!x && x.owner === pi);
      for (const pv of provinces) {
        if (pv.terrain === 'sea' || !pv.features.some((f) => f.ritualSite)) continue;
        if (!land.some((l) => hexDistP(l, pv, G.world.cols) <= 2)) continue;
        for (const f of pv.features) if (f.ritualSite) discoverFeat(f, pi);
      }
    }
  });

  // ── UNDEAD: the soul is taken ── a bound soul is freed when the Undead king who held it is slain (no living king).
  for (const c of G.characters) {
    if (c._soulBoundBy == null) continue;
    const kingLives = G.characters.some((k) => k.alive && k.isKing && k.player === c._soulBoundBy);
    if (kingLives && alignProto(G, 'Undead')) continue;
    delete c._soulBoundBy;
    if (c.player != null) line(c.player, `✨ The reliquary is broken: ${c.name}'s soul is free, and the Grace may reach them again.`, null, 'explore');
  }

  // ── NEUTRAL: Ransom ── a captive travels with his captor; at the start of each turn his realm may buy him back (a bot
  // pays when it can), and a captor slain sets him free where he fell.
  for (const c of G.characters) {
    if (c._captiveOf == null) continue;
    const captor = G.characters.find((h) => h.id === c._captiveOf);
    const owner = c.player == null ? null : G.players[c.player];
    const league = captor?.player == null ? null : G.players[captor.player];
    const free = (where: Character['location'], why: string): void => {
      delete c._captiveOf;
      delete c._ransom;
      c.location = where;
      const pv = provinces[where];
      if (pv && !pv.characters.includes(c.id)) pv.characters.push(c.id);
      if (c.player != null) line(c.player, `${why} ${c.name} stands in ${pv?.name ?? 'the field'} again.`, pv ?? null, 'explore');
    };
    if (!captor || !captor.alive || !league || !alignProto(G, 'Neutral')) {
      free(captor?.location ?? c.location, `🔓 ${c.name}'s captor is gone:`);
      continue;
    }
    const ransom = c._ransom ?? 0;
    if (owner && owner.gold >= ransom && (!owner._isBot || owner.gold >= ransom + 5)) {
      owner.gold -= ransom;
      league.gold += ransom;
      line(captor.player ?? 0, `💰 ${owner.name} pays ${String(ransom)}g to the League for ${c.name}'s freedom.`, null);
      free(captor.location, `💰 The ransom of ${String(ransom)}g is paid:`);
      continue;
    }
    // still held: the captive travels with his captor
    const from = provinces[c.location];
    if (from) from.characters = from.characters.filter((id) => id !== c.id);
    c.location = captor.location;
    const to = provinces[captor.location];
    if (to && !to.characters.includes(c.id)) to.characters.push(c.id);
  }
}

/** Master list (Condottieri): every mercenary band moves toward the nearest Neutral kit realm's home province, one step
 *  a turn, and waits there until hired. Returns false when no Neutral kit realm stands, so the old wandering applies. */
export function kitMercenaryDrift(turnContext: TurnContext): boolean {
  const { G } = turnContext;
  const homes: Province[] = [];
  G.players.forEach((p, pi) => {
    if (protoAlignOf(G, pi) !== 'Neutral' || !p.provinces.length) return;
    const home = G.world.provinces[p.homeProvinceId];
    if (home?.owner === pi) homes.push(home);
  });
  if (!homes.length) return false;
  const { cols } = G.world;
  const nearestHome = (pv: Province): Province =>
    homes.reduce((best, h) => (hexDistP(h, pv, cols) < hexDistP(best, pv, cols) ? h : best), homes[0] ?? pv);
  for (const merc of G.mercenaries) {
    const here = G.world.provinces[merc.location];
    if (!here || merc.isSea) continue;
    const goal = nearestHome(here);
    if (goal.id === here.id) continue;
    const d0 = hexDistP(here, goal, cols);
    const step = neighboursOfP(G, here)
      .filter((n) => n.terrain !== 'sea')
      .sort((a, b) => hexDistP(a, goal, cols) - hexDistP(b, goal, cols))[0];
    if (step && hexDistP(step, goal, cols) < d0) merc.location = step.id;
  }
  return true;
}
function neighboursOfP(G: TurnContext['G'], pv: Province): Province[] {
  const { cols, rows, provinces } = G.world;
  const offs: [number, number][] =
    pv.row % 2 === 0
      ? [
          [-1, -1],
          [-1, 0],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
        ]
      : [
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, 0],
          [1, 1],
        ];
  const out: Province[] = [];
  for (const [dr, dc] of offs) {
    const r = pv.row + dr;
    if (r < 0 || r >= rows) continue;
    const c = (((pv.col + dc) % cols) + cols) % cols;
    const n = provinces[r * cols + c];
    if (n) out.push(n);
  }
  return out;
}
/** Master list (Last Rites, Divine Grace): is `c` a hero whose return the design refuses — his soul taken, or his body
 *  on blighted land? */
export function graceRefused(G: TurnContext['G'], c: Character, bodyAt: number | null | undefined): string | null {
  if (!alignProto(G, 'Divine')) return null;
  if (c._soulBoundBy != null) return 'soul';
  const pv = bodyAt == null ? null : G.world.provinces[bodyAt];
  return pv?._despoiled != null ? 'blight' : null;
}
