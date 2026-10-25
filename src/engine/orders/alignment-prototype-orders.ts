// ── THE PROTOTYPE KITS' ORDERS (alignment ideas round 1, 2026-10-25) ────
// Each order here belongs to one alignment's proposed kit (src/engine/alignment-prototypes.ts) and is refused unless
// that kit is switched on for the game and the hero's realm is of that alignment. Good Works (Good), Grow the Wild and
// Tend the Grove (Druidic), Trade Pact (Neutral), Lay Waste (Evil), Despoil and Bind the Bones (Undead). The Pagan
// kit's new rites live with Perform Rite (explore-and-search-orders…); the Divine kit reshapes Consecrate in place.
import { KC_QUALITY_UP } from '../../content/kingdoms-call-data.ts';
import type { Character, GameState, Province, Realm } from '../../schemas/saved-game-state.ts';
import { alignProto, isWild, neighboursOf } from '../alignment-prototypes.ts';
import { armyUnitNameOf } from '../dice-and-army-names.ts';
import { homeProvinceIdFor } from '../grand-design.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { demoteGuardToWanderer } from '../heroes/fame-and-consecration.ts';
import { setProvinceOwner } from '../realms/relations-and-captures.ts';
import type { TurnContext } from '../turn/context.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';

type Prov = Province | null | undefined;
const humanoidLand = (pv: Prov): pv is Province => pv != null && pv.terrain !== 'sea' && !isWild(pv);
/** The hero's own province, when it is `c`'s realm's and of the kind `test` passes. */
function ownedBy(pv: Prov, c: Character, test: (pv: Province) => boolean): pv is Province {
  if (!pv) return false;
  return pv.owner === c.player && test(pv);
}
const QUALITY_UP: Record<string, string> = KC_QUALITY_UP;

function refuse(turnContext: TurnContext, c: Character, text: string): void {
  emit(turnContext, {
    type: 'system',
    text,
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  });
}
function kitOff(turnContext: TurnContext, c: Character, align: string, orderName: string): boolean {
  const { G } = turnContext;
  const pl = c.player == null ? null : G.players[c.player];
  if (pl?.alignment !== align || !alignProto(G, align)) {
    refuse(turnContext, c, `${c.name} cannot ${orderName} — that is the way of ${align} realms alone.`);
    return true;
  }
  return false;
}
function told(turnContext: TurnContext, c: Character, type: string, text: string, pv: Province): void {
  emit(turnContext, {
    type,
    text,
    audience: { actor: c.player, realms: [c.player], seen: 'there' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: pv.id,
  });
}

// ── GOOD: Good Works ── a hero in an owned humanoid province: its tax rises by 1 for good, up to 2 above where it began.
export const GOOD_WORKS_CAP = 2;
export function resolveGoodWorksOrder(turnContext: TurnContext, c: Character, prov: Prov): void {
  if (kitOff(turnContext, c, 'Good', 'do Good Works')) return;
  if (!ownedBy(prov, c, humanoidLand)) {
    refuse(turnContext, c, `${c.name}: Good Works need a humanoid province of your own realm to work in.`);
    return;
  }
  if ((prov._goodWorks ?? 0) >= GOOD_WORKS_CAP) {
    refuse(turnContext, c, `${c.name}: ${prov.name} already prospers as much as good works can make it.`);
    return;
  }
  prov._goodWorks = (prov._goodWorks ?? 0) + 1;
  prov.tax += 1;
  told(
    turnContext,
    c,
    'explore',
    `🌾 Good Works: ${c.name} spends the season among the folk of ${prov.name} — roads mended, granaries filled, disputes settled. The province pays ${String(prov.tax)} tax from now on (+1, ${String(prov._goodWorks)}/${String(GOOD_WORKS_CAP)}).`,
    prov,
  );
}

// ── DRUIDIC: Grow the Wild ── a Druid (1+) in an owned plains or desert province turns it to forest or jungle for good.
const openCountry = (pv: Province): boolean => pv.terrain === 'plain' || pv.terrain === 'desert';
const woods = (pv: Province): boolean => pv.terrain === 'forest' || pv.terrain === 'jungle';
export function resolveGrowTheWildOrder(turnContext: TurnContext, c: Character, prov: Prov): void {
  const { G } = turnContext;
  if (kitOff(turnContext, c, 'Druidic', 'Grow the Wild')) return;
  if (effStat(turnContext, c, 'druid') < 1) {
    refuse(turnContext, c, `${c.name} has no Druid craft — the green will not answer.`);
    return;
  }
  if (!ownedBy(prov, c, openCountry)) {
    refuse(turnContext, c, `${c.name}: only a plains or desert province of your own realm can be grown into the wild.`);
    return;
  }
  const from = prov.terrain;
  prov.terrain = from === 'desert' ? 'jungle' : 'forest';
  prov._grownWild = G.turn;
  told(
    turnContext,
    c,
    'explore',
    `🌳 Grow the Wild: ${c.name} walks ${prov.name} singing the old green songs. By season's end the ${from} is ${prov.terrain}: the Druidic realm fights there at ×1.5, and its trees are the realm's now and for ever.`,
    prov,
  );
}
// ── DRUIDIC: Tend the Grove ── a Druid (1+) in an owned forest or jungle province: tax +1 for good, up to +2.
export const TEND_GROVE_CAP = 2;
export function resolveTendTheGroveOrder(turnContext: TurnContext, c: Character, prov: Prov): void {
  if (kitOff(turnContext, c, 'Druidic', 'Tend the Grove')) return;
  if (effStat(turnContext, c, 'druid') < 1) {
    refuse(turnContext, c, `${c.name} has no Druid craft — the grove will not answer.`);
    return;
  }
  if (!ownedBy(prov, c, woods)) {
    refuse(turnContext, c, `${c.name}: only a forest or jungle province of your own realm can be tended.`);
    return;
  }
  if ((prov._tendedGrove ?? 0) >= TEND_GROVE_CAP) {
    refuse(turnContext, c, `${c.name}: the groves of ${prov.name} give all they can.`);
    return;
  }
  prov._tendedGrove = (prov._tendedGrove ?? 0) + 1;
  prov.tax += 1;
  told(
    turnContext,
    c,
    'explore',
    `🍃 Tend the Grove: ${c.name} tends the woods of ${prov.name} — game, honey and timber for the realm. The province pays ${String(prov.tax)} tax from now on (+1, ${String(prov._tendedGrove)}/${String(TEND_GROVE_CAP)}).`,
    prov,
  );
}

// ── NEUTRAL: Trade Pact ── buy an unowned humanoid land province (this one, or a neighbour): 3g per tax and 2g per
// defending unit; the defenders take the realm's coin and stand as its garrison. No battle, no merit.
export function tradePactPrice(pv: Province): number {
  return 3 * pv.tax + 2 * (pv.neutralDefenders.length || pv.npcArmies);
}
export function tradePactTargets(G: GameState, _c: Character, prov: Prov): Province[] {
  if (!prov) return [];
  return [prov, ...neighboursOf(G, prov)].filter((pv) => humanoidLand(pv) && pv.owner == null);
}
export function resolveTradePactOrder(
  turnContext: TurnContext,
  c: Character,
  ph: number,
  target: string,
  prov: Prov,
  player: Realm,
): void {
  const { G } = turnContext;
  if (kitOff(turnContext, c, 'Neutral', 'make a Trade Pact')) return;
  const wanted = target.startsWith('prov:') ? parseInt(target.slice(5)) : prov ? prov.id : null;
  const pv = tradePactTargets(G, c, prov).find((x) => x.id === wanted);
  if (!pv) {
    refuse(
      turnContext,
      c,
      `${c.name}: a Trade Pact needs an unclaimed humanoid province here or next door — none answers that name.`,
    );
    return;
  }
  const price = tradePactPrice(pv);
  if (player.gold < price) {
    refuse(
      turnContext,
      c,
      `${c.name}: the elders of ${pv.name} want ${String(price)}g for their allegiance — the treasury cannot pay.`,
    );
    return;
  }
  player.gold -= price;
  // the chieftain, if one holds the province, takes his purse and wanders off
  for (const h of G.characters) {
    if (h.alive && h.player === null && h._isNeutralGuard && h.location === pv.id) {
      h.armies = [];
      demoteGuardToWanderer(h);
    }
  }
  for (const d of pv.neutralDefenders)
    pv.garrisonArmies.push({
      type: d.type,
      quality: d.quality,
      race: d.race,
      unitName: d.unitName || armyUnitNameOf(d.type),
    });
  const n = pv.neutralDefenders.length;
  pv.neutralDefenders = [];
  pv.npcArmies = 0;
  delete pv._leaderlessDefenders;
  setProvinceOwner(turnContext, pv, c.player, c, ph);
  if (!player.provinces.includes(pv.id)) player.provinces.push(pv.id);
  pv._tradePactTurn = G.turn;
  told(
    turnContext,
    c,
    'explore',
    `🤝 Trade Pact: ${c.name}'s envoys buy the allegiance of ${pv.name} for ${String(price)}g — its ${String(n)} compan${n !== 1 ? 'ies' : 'y'} take the realm's coin and stand as its garrison. The province is ${player.name}'s without a blow struck.`,
    pv,
  );
}

// ── EVIL: Lay Waste ── a hero in an owned humanoid province (not the capital): 3 × its tax in gold now; its tax falls by
// 2 for good (never below 1). Once per province.
export function resolveLayWasteOrder(turnContext: TurnContext, c: Character, prov: Prov, player: Realm): void {
  const { G } = turnContext;
  if (kitOff(turnContext, c, 'Evil', 'Lay Waste')) return;
  if (!ownedBy(prov, c, humanoidLand)) {
    refuse(
      turnContext,
      c,
      `${c.name}: there is no one here to squeeze — Lay Waste needs a humanoid province of your own.`,
    );
    return;
  }
  if (prov.id === homeProvinceIdFor(G, c.player)) {
    refuse(turnContext, c, `${c.name}: even the wicked do not burn their own hall.`);
    return;
  }
  if (prov._laidWaste != null) {
    refuse(turnContext, c, `${c.name}: ${prov.name} has nothing left to take.`);
    return;
  }
  const loot = 3 * prov.tax;
  prov._laidWaste = G.turn;
  prov.tax = Math.max(1, prov.tax - 2);
  player.gold += loot;
  told(
    turnContext,
    c,
    'explore',
    `🔥 Lay Waste: ${c.name}'s soldiers strip ${prov.name} bare — ${String(loot)}g seized at once. The province pays only ${String(prov.tax)} tax from now on.`,
    prov,
  );
}

// ── UNDEAD: Despoil ── a hero in an owned humanoid province (not the capital): the land dies. Tax 1 for good, whoever
// holds it; nothing left to recruit; while an Undead realm holds it, a skeletal company rises into its garrison every
// turn (to three). Three despoiled provinces held lift every Undead commander's skeletal host to ×1.5.
export function resolveDespoilOrder(turnContext: TurnContext, c: Character, prov: Prov): void {
  const { G } = turnContext;
  if (kitOff(turnContext, c, 'Undead', 'Despoil')) return;
  if (!ownedBy(prov, c, humanoidLand)) {
    refuse(turnContext, c, `${c.name}: Despoil needs a living humanoid province of your own to kill.`);
    return;
  }
  if (prov.id === homeProvinceIdFor(G, c.player)) {
    refuse(turnContext, c, `${c.name}: the tomb-hall itself is left standing.`);
    return;
  }
  if (prov._despoiled != null) {
    refuse(turnContext, c, `${c.name}: ${prov.name} is dead land already.`);
    return;
  }
  prov._despoiled = G.turn;
  prov.tax = 1;
  prov.armyTypes = [];
  told(
    turnContext,
    c,
    'explore',
    `☠ Despoil: ${c.name} lets the plague loose in ${prov.name}. The fields blacken and the living flee or fall: the province pays 1 tax for ever, raises no living companies, and the dead of its soil rise to garrison it, one company a turn.`,
    prov,
  );
}
// ── UNDEAD: Bind the Bones ── a necromancer (Necromancy 1+) spends 3g a company to raise every skeletal unit in his host
// one quality tier (never past Elite). The one way the dead gain experience.
export const BIND_BONES_COST = 3;
export function resolveBindTheBonesOrder(turnContext: TurnContext, c: Character, player: Realm): void {
  if (kitOff(turnContext, c, 'Undead', 'Bind the Bones')) return;
  if (effStat(turnContext, c, 'necromancy') < 1) {
    refuse(turnContext, c, `${c.name} has no Necromancy — the bones stay as they are.`);
    return;
  }
  const dead = c.armies.filter((a) => a._isSkeletal && (QUALITY_UP[a.quality] ?? a.quality) !== a.quality);
  if (!dead.length) {
    refuse(turnContext, c, `${c.name} leads no skeletal company that can be bound tighter.`);
    return;
  }
  const n = Math.min(dead.length, Math.floor(player.gold / BIND_BONES_COST));
  if (n <= 0) {
    refuse(
      turnContext,
      c,
      `${c.name}: binding the bones costs ${String(BIND_BONES_COST)}g a company — the treasury cannot pay.`,
    );
    return;
  }
  const bound = dead.slice(0, n);
  player.gold -= n * BIND_BONES_COST;
  const words = bound.map((a) => {
    const q0 = a.quality;
    a.quality = QUALITY_UP[a.quality] ?? a.quality;
    return `${a.unitName || a.type} ${q0} → ${a.quality}`;
  });
  emit(turnContext, {
    type: 'hire',
    text: `🦴 Bind the Bones: ${c.name} works grave-wax and iron wire into the dead (${String(n * BIND_BONES_COST)}g): ${words.join('; ')}.`,
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  });
}
