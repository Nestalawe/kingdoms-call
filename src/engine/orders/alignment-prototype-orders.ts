// ── THE PROTOTYPE KITS' ORDERS (alignment ideas rounds 1 and 2, 2026-10-25) ────
// Each order here belongs to one alignment's proposed kit (src/engine/alignment-prototypes.ts) and is refused unless
// that kit is switched on for the game and the hero's realm is of that alignment. Round 1: Good Works (Good), Grow the
// Wild and Tend the Grove (Druidic), Trade Pact (Neutral), Lay Waste (Evil), Despoil and Bind the Bones (Undead). Round 2,
// the kings' own orders: Proclaim Crusade (Divine), Light the Beacons (Good), Call of the Wild (Druidic), Embargo
// (Neutral), Great Sacrifice (Pagan), Dark Pact (Evil), Plague (Undead). The Pagan kit's new rites live with Perform Rite
// (explore-and-search-orders…); the Divine kit reshapes Consecrate in place.
import { KC_QUALITY_TIERS, KC_QUALITY_UP, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import type { Army, Character, GameState, Province, Realm } from '../../schemas/saved-game-state.ts';
import {
  alignProto,
  BEACONS_CAP,
  CALL_OF_THE_WILD_RANGE,
  CALL_WILD_COST,
  CRUSADE_TURNS,
  DARK_PACT_COST_MULT,
  DARK_PACT_HP,
  DARK_PACT_QUALITY,
  DESPOIL_COST,
  EMBARGO_COST,
  EMBARGO_TAX_MULT,
  EMBARGO_TURNS,
  GOOD_WORKS_COST,
  GROW_WILD_COST,
  isMonsterProvince,
  isPaganStones,
  isWild,
  KING_ORDER_EVERY,
  kingOrderReady,
  LIGHT_BEACONS_COST_PER_COMPANY,
  neighboursOf,
  noteKingOrder,
  PLAGUE_COST,
  PLAGUE_TURNS,
  PROCLAIM_CRUSADE_COST,
  protoBeastRoomExtra,
  SACRIFICE_TURNS,
  TEND_GROVE_COST,
} from '../alignment-prototypes.ts';
import { ARMY_COST_MASTER } from '../army-tables.ts';
import { armyUnitNameOf } from '../dice-and-army-names.ts';
import { homeProvinceIdFor } from '../grand-design.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { demoteGuardToWanderer } from '../heroes/fame-and-consecration.ts';
import { areEnemies, realmHasMet, setProvinceOwner } from '../realms/relations-and-captures.ts';
import type { TurnContext } from '../turn/context.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';
import { hexDistP } from '../world/map-helpers.ts';
import { beastCommandRoom } from '../world/tables.ts';

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
/** Round 5: the order's price. Refuses (and says so) when the treasury cannot pay; else takes the gold. */
function pay(turnContext: TurnContext, c: Character, player: Realm, cost: number, what: string): boolean {
  if (cost <= 0) return true;
  if (player.gold < cost) {
    refuse(turnContext, c, `${c.name}: ${what} costs ${String(cost)}g — the treasury cannot pay.`);
    return false;
  }
  player.gold -= cost;
  return true;
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
export function resolveGoodWorksOrder(turnContext: TurnContext, c: Character, prov: Prov, player: Realm): void {
  if (kitOff(turnContext, c, 'Good', 'do Good Works')) return;
  if (!ownedBy(prov, c, humanoidLand)) {
    refuse(turnContext, c, `${c.name}: Good Works need a humanoid province of your own realm to work in.`);
    return;
  }
  if ((prov._goodWorks ?? 0) >= GOOD_WORKS_CAP) {
    refuse(turnContext, c, `${c.name}: ${prov.name} already prospers as much as good works can make it.`);
    return;
  }
  if (!pay(turnContext, c, player, GOOD_WORKS_COST, 'Good Works (seed, timber and wages)')) return; // round 5
  prov._goodWorks = (prov._goodWorks ?? 0) + 1;
  prov.tax += 1;
  told(
    turnContext,
    c,
    'explore',
    `🌾 Good Works: ${c.name} spends the season among the folk of ${prov.name} — roads mended, granaries filled, disputes settled (${String(GOOD_WORKS_COST)}g). The province pays ${String(prov.tax)} tax from now on (+1, ${String(prov._goodWorks)}/${String(GOOD_WORKS_CAP)}).`,
    prov,
  );
}

// ── DRUIDIC: Grow the Wild ── a Druid (1+) in an owned plains or desert province turns it to forest or jungle for good.
const openCountry = (pv: Province): boolean => pv.terrain === 'plain' || pv.terrain === 'desert';
const woods = (pv: Province): boolean => pv.terrain === 'forest' || pv.terrain === 'jungle';
export function resolveGrowTheWildOrder(turnContext: TurnContext, c: Character, prov: Prov, player: Realm): void {
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
  if (!pay(turnContext, c, player, GROW_WILD_COST, 'Grow the Wild (seed-stock and a season of hands)')) return; // round 5
  const from = prov.terrain;
  prov.terrain = from === 'desert' ? 'jungle' : 'forest';
  prov._grownWild = G.turn;
  told(
    turnContext,
    c,
    'explore',
    `🌳 Grow the Wild: ${c.name} walks ${prov.name} singing the old green songs (${String(GROW_WILD_COST)}g). By season's end the ${from} is ${prov.terrain}: the Druidic realm fights there at ×1.5, and its trees are the realm's now and for ever.`,
    prov,
  );
}
// ── DRUIDIC: Tend the Grove ── a Druid (1+) in an owned forest or jungle province: tax +1 for good, up to +2.
export const TEND_GROVE_CAP = 2;
export function resolveTendTheGroveOrder(turnContext: TurnContext, c: Character, prov: Prov, player: Realm): void {
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
  if (!pay(turnContext, c, player, TEND_GROVE_COST, 'Tend the Grove')) return; // round 5
  prov._tendedGrove = (prov._tendedGrove ?? 0) + 1;
  prov.tax += 1;
  told(
    turnContext,
    c,
    'explore',
    `🍃 Tend the Grove: ${c.name} tends the woods of ${prov.name} (${String(TEND_GROVE_COST)}g) — game, honey and timber for the realm. The province pays ${String(prov.tax)} tax from now on (+1, ${String(prov._tendedGrove)}/${String(TEND_GROVE_CAP)}).`,
    prov,
  );
}

// ── NEUTRAL: Trade Pact ── buy an unowned humanoid land province (this one, or a neighbour): 3g per tax and 2g per
// defending unit; the defenders take the realm's coin and stand as its garrison. No battle, no merit.
export const TRADE_PACT_PER_TAX = 4; // round 6 (round 5: 5; round 4: 4; rounds 1-3: 3)
export const TRADE_PACT_PER_DEFENDER = 3; // round 4 (rounds 1-3: 2)
export function tradePactPrice(pv: Province): number {
  return TRADE_PACT_PER_TAX * pv.tax + TRADE_PACT_PER_DEFENDER * (pv.neutralDefenders.length || pv.npcArmies);
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
export function resolveDespoilOrder(turnContext: TurnContext, c: Character, prov: Prov, player: Realm): void {
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
  if (!pay(turnContext, c, player, DESPOIL_COST, 'Despoil (grave-dust and plague-bearers)')) return; // round 5
  prov._despoiled = G.turn;
  prov.tax = 1;
  prov.armyTypes = [];
  told(
    turnContext,
    c,
    'explore',
    `☠ Despoil: ${c.name} lets the plague loose in ${prov.name} (${String(DESPOIL_COST)}g). The fields blacken and the living flee or fall: the province pays 1 tax for ever, raises no living companies, and the dead of its soil rise to garrison it, one company a turn.`,
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

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ROUND 2: THE KINGS' ORDERS. Each is the king's alone, and each comes round again only after KING_ORDER_EVERY turns.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const MONSTERS = new Set<string>(KC_UNIT_CLASS.monster);
const CREATURES = new Set<string>(KC_UNIT_CLASS.creature);
const TIERS: readonly string[] = KC_QUALITY_TIERS;
const fieldUnit = (t: string): boolean => !/garrison|fleet|galley|ironclad|longship/i.test(t);
/** The king's check: the kit on, the crown's head, and the order off its cooldown. */
function kingMay(turnContext: TurnContext, c: Character, align: string, key: string, orderName: string): Realm | null {
  const { G } = turnContext;
  if (kitOff(turnContext, c, align, orderName)) return null;
  const pl = c.player == null ? null : G.players[c.player];
  if (!pl) return null;
  if (!c.isKing) {
    refuse(turnContext, c, `${c.name}: only the KING may ${orderName}.`);
    return null;
  }
  if (!kingOrderReady(G, pl, key)) {
    const last = pl._kingOrderLast?.[key] ?? G.turn;
    const again = last + (KING_ORDER_EVERY[key] ?? 0);
    refuse(turnContext, c, `${c.name}: the realm cannot ${orderName} again until turn ${String(again)}.`);
    return null;
  }
  return pl;
}
const realmTarget = (target: string): number | null => {
  const m = /^realm:(\d+)$/.exec(target.trim());
  return m ? parseInt(m[1] ?? '', 10) : null;
};
function realmLine(turnContext: TurnContext, pi: number, type: string, text: string, pv?: Province): void {
  emit(turnContext, {
    type,
    text,
    audience: { actor: pi, realms: [pi] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: pv ? pv.id : undefined,
  });
}

// ── DIVINE: Proclaim Crusade ── 5g; a realm at war with the crown is named; for three turns every Divine host fights it
// at ×1.5 wherever they meet.
export function resolveProclaimCrusadeOrder(
  turnContext: TurnContext,
  c: Character,
  target: string,
  player: Realm,
): void {
  const { G } = turnContext;
  const pl = kingMay(turnContext, c, 'Divine', 'proclaim_crusade', 'Proclaim a Crusade');
  if (!pl || c.player == null) return;
  const vs = realmTarget(target);
  const foe = vs == null ? null : G.players[vs];
  if (vs == null || !foe || vs === c.player || !areEnemies(turnContext, c.player, vs)) {
    refuse(
      turnContext,
      c,
      `${c.name}: a Crusade is proclaimed against a realm the crown is at war with — none answers.`,
    );
    return;
  }
  if (!pay(turnContext, c, player, PROCLAIM_CRUSADE_COST, "the proclamation's alms")) return;
  pl._crusadeVs = vs;
  pl._crusadeUntil = G.turn + CRUSADE_TURNS - 1;
  noteKingOrder(G, pl, 'proclaim_crusade');
  realmLine(
    turnContext,
    c.player,
    'explore',
    `✝ ${c.name} proclaims a Crusade against ${foe.name}! Until the end of turn ${String(pl._crusadeUntil)} every host of the realm fights ${foe.name}'s forces at ×1.5.`,
  );
  realmLine(
    turnContext,
    vs,
    'system',
    `✝ ${pl.name} has proclaimed a Crusade against you — its hosts come with a fervour that lasts three turns.`,
  );
}

// ── GOOD: Light the Beacons ── the shires muster: every humanoid province of the realm (the nearest to the king first,
// to six) raises an Average company of its own first field kind into its garrison, for nothing.
export function resolveLightTheBeaconsOrder(turnContext: TurnContext, c: Character, prov: Prov, player: Realm): void {
  const { G } = turnContext;
  const pl = kingMay(turnContext, c, 'Good', 'light_beacons', 'Light the Beacons');
  if (!pl || c.player == null || !prov) return;
  const pi = c.player;
  // round 5: 2g a company, as many shires as the treasury can pay for (to the cap)
  const affordable = Math.floor(player.gold / LIGHT_BEACONS_COST_PER_COMPANY);
  const shires = pl.provinces
    .map((id) => G.world.provinces[id])
    .filter((pv): pv is Province => humanoidLand(pv) && pv.owner === pi && pv.armyTypes.some(fieldUnit))
    .sort((a, b) => hexDistP(a, prov, G.world.cols) - hexDistP(b, prov, G.world.cols))
    .slice(0, Math.min(BEACONS_CAP, affordable));
  if (!shires.length) {
    refuse(
      turnContext,
      c,
      affordable < 1
        ? `${c.name}: the muster costs ${String(LIGHT_BEACONS_COST_PER_COMPANY)}g a company — the treasury cannot pay.`
        : `${c.name}: the beacons burn, but no shire of the realm can send men.`,
    );
    return;
  }
  player.gold -= shires.length * LIGHT_BEACONS_COST_PER_COMPANY;
  noteKingOrder(G, pl, 'light_beacons');
  const raised: string[] = [];
  for (const pv of shires) {
    const kind = pv.armyTypes.find(fieldUnit);
    if (!kind) continue;
    const u: Army = { type: kind, quality: 'Average', race: pv.race ?? pl.race, unitName: armyUnitNameOf(kind) };
    pv.garrisonArmies.push(u);
    raised.push(`${pv.name} (${kind})`);
  }
  realmLine(
    turnContext,
    pi,
    'hire',
    `🔥 ${c.name} lights the beacons from ${prov.name}, and the shires answer the muster (${String(shires.length * LIGHT_BEACONS_COST_PER_COMPANY)}g): ${raised.join(', ')} each raise an Average company into the garrison. They draw wages from next turn like any other.`,
    prov,
  );
}

// ── DRUIDIC: Call of the Wild ── a Druid king calls every creature company garrisoned in a realm province within three
// hexes to his side, as many as he has room to lead.
export function resolveCallOfTheWildOrder(turnContext: TurnContext, c: Character, prov: Prov, player: Realm): void {
  const { G } = turnContext;
  const pl = kingMay(turnContext, c, 'Druidic', 'call_wild', 'sound the Call of the Wild');
  if (!pl || c.player == null || !prov) return; // round 6: any Druidic king may sound it (round 2-5: Druid 1+)
  const pi = c.player;
  let room = beastCommandRoom(c, G.characters, protoBeastRoomExtra(G, c));
  if (room <= 0) {
    refuse(turnContext, c, `${c.name} can lead no more beasts than march with him already.`);
    return;
  }
  const came: string[] = [];
  for (const id of pl.provinces) {
    const pv = G.world.provinces[id];
    if (pv?.owner !== pi || hexDistP(pv, prov, G.world.cols) > CALL_OF_THE_WILD_RANGE) continue;
    for (let i = pv.garrisonArmies.length - 1; i >= 0 && room > 0; i--) {
      const a = pv.garrisonArmies[i];
      if (!a || !CREATURES.has(a.type)) continue;
      pv.garrisonArmies.splice(i, 1);
      delete a._kitGarrison;
      c.armies.push(a);
      room -= 1;
      came.push(`${a.unitName || a.type} (${a.quality}) from ${pv.name}`);
    }
    if (room <= 0) break;
  }
  if (!came.length) {
    refuse(
      turnContext,
      c,
      `${c.name} sounds the horn, but no beast of the realm is garrisoned within ${String(CALL_OF_THE_WILD_RANGE)} hexes.`,
    );
    return;
  }
  player.gold = Math.max(0, player.gold - CALL_WILD_COST); // round 5: the horn-call's offering (the beasts came already)
  noteKingOrder(G, pl, 'call_wild');
  realmLine(
    turnContext,
    pi,
    'hire',
    `🐾 ${c.name} sounds the Call of the Wild in ${prov.name}, and the beasts come down from the realm's garrisons: ${came.join('; ')} join the king's host.`,
    prov,
  );
}

// ── NEUTRAL: Embargo ── the League closes its markets to a realm it has met: for three turns that realm's provinces
// pay less tax (20% since round 3).
export function resolveEmbargoOrder(turnContext: TurnContext, c: Character, target: string, player: Realm): void {
  const { G } = turnContext;
  const pl = kingMay(turnContext, c, 'Neutral', 'embargo', 'declare an Embargo');
  if (!pl || c.player == null) return;
  const vs = realmTarget(target);
  const foe = vs == null ? null : G.players[vs];
  if (vs == null || !foe || vs === c.player || !realmHasMet(turnContext, c.player, vs)) {
    refuse(turnContext, c, `${c.name}: an Embargo is declared against a realm the League has met — none answers.`);
    return;
  }
  if (!pay(turnContext, c, player, EMBARGO_COST, "the Embargo (the factors' lost trade)")) return; // round 5
  foe._embargoUntil = G.turn + EMBARGO_TURNS - 1;
  foe._embargoBy = c.player;
  noteKingOrder(G, pl, 'embargo');
  realmLine(
    turnContext,
    c.player,
    'explore',
    `⚖ ${c.name} declares an Embargo on ${foe.name}: the League's factors close their counting-houses to it. Until the end of turn ${String(foe._embargoUntil)} its provinces pay ${String(Math.round((1 - EMBARGO_TAX_MULT) * 100))}% less tax.`,
  );
  realmLine(
    turnContext,
    vs,
    'system',
    `⚖ ${pl.name} has declared an Embargo against you — your markets starve for ${String(EMBARGO_TURNS)} turns (−${String(Math.round((1 - EMBARGO_TAX_MULT) * 100))}% tax).`,
  );
}

// ── PAGAN: Great Sacrifice ── the king at stones in a province of the realm gives his weakest company to the old gods;
// for three turns every host of the realm fights at ×1.5.
export function resolveGreatSacrificeOrder(turnContext: TurnContext, c: Character, prov: Prov): void {
  const { G } = turnContext;
  const pl = kingMay(turnContext, c, 'Pagan', 'great_sacrifice', 'make the Great Sacrifice');
  if (!pl || c.player == null) return;
  if (!ownedBy(prov, c, (pv) => pv.features.some(isPaganStones))) {
    refuse(turnContext, c, `${c.name}: the Great Sacrifice is made at the old stones, on the realm's own ground.`);
    return;
  }
  const real = c.armies.filter((a) => !a._phantom);
  if (real.length < 2) {
    refuse(turnContext, c, `${c.name} needs two companies at least — one to give, and one to march on with.`);
    return;
  }
  const victim = [...real].sort((a, b) => TIERS.indexOf(a.quality) - TIERS.indexOf(b.quality))[0];
  if (!victim) return;
  c.armies.splice(c.armies.indexOf(victim), 1);
  pl._sacrificeUntil = G.turn + SACRIFICE_TURNS - 1;
  noteKingOrder(G, pl, 'great_sacrifice');
  realmLine(
    turnContext,
    c.player,
    'explore',
    `🩸 Great Sacrifice: at the ${prov.features.find(isPaganStones)?.name ?? 'stones'} of ${prov.name}, ${c.name} gives ${victim.unitName || victim.type} (${victim.quality}) to the old gods. Until the end of turn ${String(pl._sacrificeUntil)} every host of the realm fights at ×1.5.`,
    prov,
  );
}

// ── EVIL: Dark Pact ── (round 5) the king names a monster of a kind his monster provinces breed and pays twice its
// recruit cost in gold and five of his own hit points; a Veteran company of it joins his host. No waiting between pacts.
export function darkPactKinds(G: GameState, pi: number): string[] {
  const pl = G.players[pi];
  if (!pl) return [];
  const kinds = new Set<string>();
  for (const id of pl.provinces) {
    const pv = G.world.provinces[id];
    if (pv?.owner === pi && isMonsterProvince(pv))
      pv.armyTypes.filter((t) => MONSTERS.has(t)).forEach((t) => kinds.add(t));
  }
  return [...kinds];
}
const ARMY_COST: Record<string, number> = ARMY_COST_MASTER;
export const darkPactCost = (kind: string): number => DARK_PACT_COST_MULT * (ARMY_COST[kind] ?? 5);
export function resolveDarkPactOrder(
  turnContext: TurnContext,
  c: Character,
  target: string,
  prov: Prov,
  player: Realm,
): void {
  const { G } = turnContext;
  const pl = kingMay(turnContext, c, 'Evil', 'dark_pact', 'make a Dark Pact');
  if (!pl || c.player == null || !prov) return;
  const kinds = darkPactKinds(G, c.player);
  if (!kinds.length) {
    refuse(turnContext, c, `${c.name}: the pact needs a monster province of the realm's own — the pits are empty.`);
    return;
  }
  const m = /^type:(.+)$/.exec(target.trim());
  const wanted = m ? m[1]?.trim() : null;
  const kind = wanted ? kinds.find((k) => k.toLowerCase() === wanted.toLowerCase()) : kinds[0];
  if (!kind) {
    refuse(
      turnContext,
      c,
      `${c.name}: no monster province of the realm breeds ${wanted ?? 'that'} — the pact names ${kinds.join(', ')}.`,
    );
    return;
  }
  const cost = darkPactCost(kind);
  if (c.hp <= DARK_PACT_HP) {
    refuse(
      turnContext,
      c,
      `${c.name}: the pact asks ${String(DARK_PACT_HP)} of the king's own blood — he has none to spare.`,
    );
    return;
  }
  if (beastCommandRoom(c, G.characters, protoBeastRoomExtra(G, c)) <= 0) {
    refuse(turnContext, c, `${c.name} can lead no more beasts — the summoned thing would turn on him.`);
    return;
  }
  if (!pay(turnContext, c, player, cost, `the pact for ${kind}`)) return;
  c.hp -= DARK_PACT_HP;
  const u: Army = { type: kind, quality: DARK_PACT_QUALITY, race: 'Primal', unitName: armyUnitNameOf(kind) };
  c.armies.push(u);
  noteKingOrder(G, pl, 'dark_pact');
  realmLine(
    turnContext,
    c.player,
    'hire',
    `😈 Dark Pact: ${c.name} cuts the bargain in his own blood (${String(cost)}g, −${String(DARK_PACT_HP)} HP → ${String(c.hp)}). Something answers: ${u.unitName} (${kind}, ${DARK_PACT_QUALITY}) joins the king's host.`,
    prov,
  );
}

// ── UNDEAD: Plague ── the king lets the plague loose on a humanoid province next door that another realm holds (or none):
// for three turns a company there dies each turn and lies in the grave, and its tax falls by one (to 1 at least).
export function resolveSpreadPlagueOrder(
  turnContext: TurnContext,
  c: Character,
  target: string,
  prov: Prov,
  player: Realm,
): void {
  const { G } = turnContext;
  const pl = kingMay(turnContext, c, 'Undead', 'spread_plague', 'spread the Plague');
  if (!pl || c.player == null || !prov) return;
  const m = /^prov:(\d+)$/.exec(target.trim());
  const wanted = m ? parseInt(m[1] ?? '', 10) : null;
  const pv = neighboursOf(G, prov).find((x) => x.id === wanted && humanoidLand(x) && x.owner !== c.player);
  if (!pv) {
    refuse(
      turnContext,
      c,
      `${c.name}: the Plague is loosed on a living humanoid province next door that is not the realm's own — none answers.`,
    );
    return;
  }
  if (pv._kitPlague && pv._kitPlague.until >= G.turn) {
    refuse(turnContext, c, `${c.name}: ${pv.name} sickens already.`);
    return;
  }
  if (!pay(turnContext, c, player, PLAGUE_COST, 'the Plague (its bearers and their rags)')) return; // round 5
  pv._kitPlague = { by: c.player, until: G.turn + PLAGUE_TURNS };
  noteKingOrder(G, pl, 'spread_plague');
  realmLine(
    turnContext,
    c.player,
    'explore',
    `☠ ${c.name} sends the Plague into ${pv.name}: for ${String(PLAGUE_TURNS)} turns a company there dies each turn and is laid in the grave, and the province's tax falls by one a turn.`,
    pv,
  );
  if (pv.owner != null)
    realmLine(
      turnContext,
      pv.owner,
      'system',
      `☠ A plague breaks out in ${pv.name} — your soldiers there sicken and die, a company a turn, and the fields go untended.`,
      pv,
    );
}
