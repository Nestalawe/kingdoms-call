// ── THE PROTOTYPE KITS' ORDERS (alignment ideas rounds 1 and 2, 2026-10-25) ────
// Each order here belongs to one alignment's proposed kit (src/engine/alignment-prototypes.ts) and is refused unless
// that kit is switched on for the game and the hero's realm is of that alignment. Round 1: Good Works (Good), Grow the
// Wild and Tend the Grove (Druidic), Trade Pact (Neutral), Lay Waste (Evil), Despoil and Bind the Bones (Undead). Round 2,
// the kings' own orders: Proclaim Crusade (Divine), Light the Beacons (Good), Call of the Wild (Druidic), Embargo
// (Neutral), Dark Pact (Evil). The master list (round 19): Call down the storm (Pagan) and Bind the Bones (Undead) for
// the kings, Spread Dread (Evil) for any hero; Despoil is Blight the Land; Great Sacrifice and Plague are gone. The Pagan
// kit's rites live with Perform Rite (explore-and-search-orders…); the Divine kit reshapes Consecrate in place.
import { KC_QUALITY_TIERS, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import type { Army, Character, GameState, Province, Realm } from '../../schemas/saved-game-state.ts';
import {
  alignProto,
  BEACONS_CAP,
  BIND_BONES_COST,
  CALL_OF_THE_WILD_RANGE,
  CALL_STORM_COST,
  CALL_WILD_COST,
  CRUSADE_TURNS,
  DARK_PACT_COST_MULT,
  DARK_PACT_HP_SHARE,
  DARK_PACT_QUALITY,
  DESPOIL_COST,
  EMBARGO_BEAST_COST_MULT,
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
  PROCLAIM_CRUSADE_COST,
  protoBeastRoomExtra,
} from '../alignment-prototypes.ts';
import { TERROR_PCT_PER_STACK } from '../battle/evil-terror.ts';
import { kcRng } from '../rng.ts';
import { ARMY_COST_MASTER } from '../army-tables.ts';
import { armyUnitNameOf } from '../dice-and-army-names.ts';
import { homeProvinceIdFor } from '../grand-design.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { demoteGuardToWanderer } from '../heroes/fame-and-consecration.ts';
import { areEnemies, realmHasMet, setProvinceOwner } from '../realms/relations-and-captures.ts';
import type { TurnContext } from '../turn/context.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';
import { hexDistP } from '../world/map-helpers.ts';
import { newMercId } from '../turn/mercenary-ids-and-battle-records.ts';
import { beastCommandRoom } from '../world/tables.ts';

type Prov = Province | null | undefined;
const humanoidLand = (pv: Prov): pv is Province => pv != null && pv.terrain !== 'sea' && !isWild(pv);
/** The hero's own province, when it is `c`'s realm's and of the kind `test` passes. */
function ownedBy(pv: Prov, c: Character, test: (pv: Province) => boolean): pv is Province {
  if (!pv) return false;
  return pv.owner === c.player && test(pv);
}

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

// ── GOOD: Good Works ── (master list) a hero sits in judgement in a province of the realm: every stack of Terror and
// every plague on it is lifted, and no new Terror or plague can touch it for the rest of the turn (spreadTerror and the
// plague spell read _goodWorksTurn). Once a province a turn.
/** The plague and Terror fields Good Works clears; Absolution (Divine Power 5) clears the same. */
export function clearTerrorAndPlague(pv: Province): { terror: number; plague: boolean } {
  const terror = pv._terrorStacks ?? 0;
  const plague = pv._plaguedTurn != null || pv._kitPlague != null;
  delete pv._terrorStacks;
  delete pv._terrorTurn;
  delete pv._terrorisedBy;
  delete pv._terrorPct;
  delete pv._plaguedTurn;
  delete pv._plagueLevel;
  delete pv._plagueCaster;
  delete pv._kitPlague;
  return { terror, plague };
}
export function resolveGoodWorksOrder(turnContext: TurnContext, c: Character, prov: Prov, player: Realm): void {
  const { G } = turnContext;
  if (kitOff(turnContext, c, 'Good', 'do Good Works')) return;
  if (!ownedBy(prov, c, humanoidLand)) {
    refuse(turnContext, c, `${c.name}: Good Works need a humanoid province of your own realm to work in.`);
    return;
  }
  if (prov._goodWorksTurn === G.turn) {
    refuse(turnContext, c, `${c.name}: judgement has been given in ${prov.name} once already this turn.`);
    return;
  }
  if (!pay(turnContext, c, player, GOOD_WORKS_COST, 'Good Works')) return;
  const cleared = clearTerrorAndPlague(prov);
  prov._goodWorksTurn = G.turn;
  const what = [
    cleared.terror ? `${String(cleared.terror)} stack${cleared.terror !== 1 ? 's' : ''} of Terror lifted` : '',
    cleared.plague ? 'the plague lifted' : '',
  ]
    .filter(Boolean)
    .join(', ');
  told(
    turnContext,
    c,
    'explore',
    `🌾 Good Works: ${c.name} sits in judgement among the folk of ${prov.name}${what ? ` — ${what}` : ''}. No Terror or plague can touch the province for the rest of the turn.`,
    prov,
  );
}

// ── DRUIDIC: Grow the Wild ── a Druid (1+) in an owned plains or desert province turns it to forest or jungle for good.
const openCountry = (pv: Province): boolean => pv.terrain === 'plain' || pv.terrain === 'desert';
export function resolveGrowTheWildOrder(turnContext: TurnContext, c: Character, prov: Prov, player: Realm): void {
  const { G } = turnContext;
  if (kitOff(turnContext, c, 'Druidic', 'Grow the Wild')) return;
  if (effStat(turnContext, c, 'druid') < 3) {
    refuse(turnContext, c, `${c.name}: the green answers only a Druid of the third circle or higher (Druid 3).`); // master list
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
// ── NEUTRAL: Trade Pact ── buy an unowned humanoid land province (this one, or a neighbour): 3g per tax and 2g per
// defending unit; the defenders take the realm's coin and stand as its garrison. No battle, no merit.
export const TRADE_PACT_PER_TAX = 4; // round 6 (round 5: 5; round 4: 4; rounds 1-3: 3)
export const TRADE_PACT_PER_DEFENDER = 3; // round 4 (rounds 1-3: 2)
export function tradePactPrice(pv: Province): number {
  return TRADE_PACT_PER_TAX * pv.tax + TRADE_PACT_PER_DEFENDER * (pv.neutralDefenders.length || pv.npcArmies);
}
export function tradePactPriceOwned(pv: Province): number {
  return TRADE_PACT_PER_TAX * pv.tax + TRADE_PACT_PER_DEFENDER * pv.garrisonArmies.length;
}
/** The provinces a Trade Pact may buy from where the hero stands: unclaimed humanoid land here or next door, and
 *  (master list) another realm's humanoid province, never a capital. */
export function tradePactTargets(G: GameState, c: Character, prov: Prov): Province[] {
  if (!prov) return [];
  return [prov, ...neighboursOf(G, prov)].filter(
    (pv) =>
      humanoidLand(pv) &&
      (pv.owner == null ||
        (pv.owner !== c.player && G.players[pv.owner] != null && homeProvinceIdFor(G, pv.owner) !== pv.id)),
  );
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
  const prevOwner = pv.owner;
  const price = prevOwner == null ? tradePactPrice(pv) : tradePactPriceOwned(pv);
  if (player.gold < price) {
    refuse(
      turnContext,
      c,
      `${c.name}: the elders of ${pv.name} want ${String(price)}g for their allegiance — the treasury cannot pay.`,
    );
    return;
  }
  player.gold -= price;
  // master list: the defenders are turned loose as a mercenary band standing in the province
  const loose: Army[] = prevOwner == null ? [] : pv.garrisonArmies.splice(0, pv.garrisonArmies.length);
  for (const a of loose) {
    if (a._isSkeletal || a._phantom) continue;
    G.mercenaries.push({
      type: a.type,
      quality: a.quality,
      race: a.race,
      unitName: a.unitName || armyUnitNameOf(a.type),
      location: pv.id,
      isSea: false,
      id: newMercId(turnContext),
    });
  }
  if (prevOwner != null) {
    const prevPl = G.players[prevOwner];
    if (prevPl) {
      const at = prevPl.provinces.indexOf(pv.id);
      if (at >= 0) prevPl.provinces.splice(at, 1);
      realmLine(
        turnContext,
        prevOwner,
        'system',
        `🤝 The League has bought ${pv.name} from under you: its elders took ${player.name}'s coin, and its garrison is turned loose as sell-swords.`,
        pv,
      );
    }
  }
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
  const n = prevOwner == null ? pv.neutralDefenders.length : loose.length;
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
    prevOwner == null
      ? `🤝 Trade Pact: ${c.name}'s envoys buy the allegiance of ${pv.name} for ${String(price)}g — its ${String(n)} compan${n !== 1 ? 'ies' : 'y'} take the realm's coin and stand as its garrison. The province is ${player.name}'s without a blow struck.`
      : `🤝 Trade Pact: ${c.name}'s envoys buy ${pv.name} from ${G.players[prevOwner]?.name ?? 'its lord'} for ${String(price)}g — its ${String(n)} compan${n !== 1 ? 'ies' : 'y'} are turned loose as a mercenary band standing in the province. The province is ${player.name}'s without a blow struck.`,
    pv,
  );
}

// ── UNDEAD: Blight the Land (the master list's name for Despoil) ── a hero in an owned humanoid province (not the
// capital): the land dies. Tax 1 for good, whoever holds it; nothing left to recruit; while an Undead realm holds it, a
// skeletal company rises into its garrison every turn (to three) and it pays Grave Goods; every blighted province held
// adds 0.05 to the skeletal hosts' multiplier.
export function resolveDespoilOrder(turnContext: TurnContext, c: Character, prov: Prov, player: Realm): void {
  const { G } = turnContext;
  if (kitOff(turnContext, c, 'Undead', 'Blight the Land')) return;
  if (!ownedBy(prov, c, humanoidLand)) {
    refuse(turnContext, c, `${c.name}: Blight the Land needs a living humanoid province of your own to kill.`);
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
  if (!pay(turnContext, c, player, DESPOIL_COST, 'Blight the Land (grave-dust and plague-bearers)')) return; // round 5
  prov._despoiled = G.turn;
  prov.tax = 1;
  prov.armyTypes = [];
  told(
    turnContext,
    c,
    'explore',
    `☠ Blight the Land: ${c.name} lets the plague loose in ${prov.name} (${String(DESPOIL_COST)}g). The fields blacken and the living flee or fall: the province pays 1 tax for ever, raises no living companies, and the dead of its soil rise to garrison it, one company a turn.`,
    prov,
  );
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

// ── DIVINE: Proclaim Crusade ── 6g; a realm at war with the crown is named; for three turns every province taken from
// it is consecrated at once (the sword consecrates: setProvinceOwner), the realm counts +1 Divine Power, and its heroes
// are the Hounds of God and carry Holy wrath against the named realm's heroes (master list).
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
    `✝ ${c.name} proclaims a Crusade against ${foe.name}! Until the end of turn ${String(pl._crusadeUntil)} every province taken from ${foe.name} is consecrated the moment it falls, the realm counts one more point of Divine Power, and its heroes run ${foe.name}'s heroes down without fail and strike them in duels with holy wrath.`,
  );
  realmLine(
    turnContext,
    vs,
    'system',
    `✝ ${pl.name} has proclaimed a Crusade against you — for three turns every province it takes from you is consecrated at once, and its heroes hunt yours.`,
  );
}

// ── GOOD: Light the Beacons ── the shires muster: every humanoid province of the realm within 3 hexes of the king (the
// nearest first, to six) raises a Veteran company of its own first field kind into its garrison, 2g a company.
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
    .filter((pv) => hexDistP(pv, prov, G.world.cols) <= 3) // master list: within 3 hexes of the king
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
    const u: Army = { type: kind, quality: 'Veteran', race: pv.race ?? pl.race, unitName: armyUnitNameOf(kind) }; // master list: Veterans
    pv.garrisonArmies.push(u);
    raised.push(`${pv.name} (${kind})`);
  }
  realmLine(
    turnContext,
    pi,
    'hire',
    `🔥 ${c.name} lights the beacons from ${prov.name}, and the shires answer the muster (${String(shires.length * LIGHT_BEACONS_COST_PER_COMPANY)}g): ${raised.join(', ')} each raise a Veteran company into the garrison. They draw wages from next turn like any other.`,
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
  let room = Math.min(
    beastCommandRoom(c, G.characters, protoBeastRoomExtra(G, c)),
    Math.floor(player.gold / CALL_WILD_COST), // master list: 2g a company that comes
  );
  if (room <= 0) {
    refuse(turnContext, c, `${c.name} can lead no more beasts than march with him already, or cannot pay the horn's price.`);
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
  player.gold = Math.max(0, player.gold - CALL_WILD_COST * came.length); // master list: 2g a company that comes
  noteKingOrder(G, pl, 'call_wild');
  realmLine(
    turnContext,
    pi,
    'hire',
    `🐾 ${c.name} sounds the Call of the Wild in ${prov.name}, and the beasts come down from the realm's garrisons (${String(CALL_WILD_COST * came.length)}g): ${came.join('; ')} join the king's host.`,
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
    `⚖ ${c.name} declares an Embargo on ${foe.name}: the League's factors close their counting-houses to it. Until the end of turn ${String(foe._embargoUntil)} its provinces pay ${String(Math.round((1 - EMBARGO_TAX_MULT) * 100))}% less tax and its beasts cost ×${String(EMBARGO_BEAST_COST_MULT)} to recruit.`,
  );
  realmLine(
    turnContext,
    vs,
    'system',
    `⚖ ${pl.name} has declared an Embargo against you — your markets starve for ${String(EMBARGO_TURNS)} turns (−${String(Math.round((1 - EMBARGO_TAX_MULT) * 100))}% tax).`,
  );
}

// ── PAGAN: Call down the storm ── (master list) the king calls the sky down on a province that holds stones the realm
// has woken, or one next to such a province, whoever holds it now. Every company standing there, the realm's own
// included, has a 1 in 4 chance of being destroyed, and every company not destroyed a 1 in 2 chance of falling one
// quality tier (a Green company cannot fall). 4g, once a turn. (The halved movement and scattered fleets of the design
// are not modelled yet.)
export const STORM_DESTROY_CHANCE = 0.25;
export const STORM_DEMOTE_CHANCE = 0.5;
const wokenStones = (G: GameState, pi: number, pv: Province): boolean =>
  pv.features.some(isPaganStones) && pv._riteActivatedBy === pi;
/** The provinces realm `pi`'s king may call the storm down on. */
export function stormTargets(G: GameState, pi: number): Province[] {
  const out = new Set<Province>();
  for (const pv of G.world.provinces) {
    if (pv.terrain === 'sea' || !wokenStones(G, pi, pv)) continue;
    out.add(pv);
    for (const n of neighboursOf(G, pv)) if (n.terrain !== 'sea') out.add(n);
  }
  return [...out];
}
export function resolveCallDownTheStormOrder(
  turnContext: TurnContext,
  c: Character,
  target: string,
  prov: Prov,
  player: Realm,
): void {
  const { G } = turnContext;
  const pl = kingMay(turnContext, c, 'Pagan', 'call_storm', 'call down the storm');
  if (!pl || c.player == null) return;
  const pi = c.player;
  const m = /^prov:(\d+)$/.exec(target.trim());
  const wanted = m ? parseInt(m[1] ?? '', 10) : prov ? prov.id : null;
  const pv = stormTargets(G, pi).find((x) => x.id === wanted);
  if (!pv) {
    refuse(
      turnContext,
      c,
      `${c.name}: the storm falls only on a province holding stones the realm has woken, or one beside such a province — none answers.`,
    );
    return;
  }
  if (!pay(turnContext, c, player, CALL_STORM_COST, 'the storm (the offering burned on the stones)')) return;
  noteKingOrder(G, pl, 'call_storm');
  pv._stormTurn = G.turn;
  let destroyed = 0;
  let fell = 0;
  const struck = new Set<number>();
  const strike = (list: Army[], owner: number | null): Army[] => {
    const kept: Army[] = [];
    for (const a of list) {
      if (a._phantom) {
        kept.push(a);
        continue;
      }
      if (owner != null) struck.add(owner);
      if (kcRng() < STORM_DESTROY_CHANCE) {
        destroyed += 1;
        continue;
      }
      const qi = TIERS.indexOf(a.quality);
      if (qi > 0 && !a._isSkeletal && kcRng() < STORM_DEMOTE_CHANCE) {
        a.quality = TIERS[qi - 1] ?? a.quality;
        fell += 1;
      }
      kept.push(a);
    }
    return kept;
  };
  pv.garrisonArmies = strike(pv.garrisonArmies, pv.owner);
  pv.neutralDefenders = strike(pv.neutralDefenders, null);
  pv.npcArmies = pv.neutralDefenders.length;
  for (const h of G.characters) if (h.alive && h.location === pv.id) h.armies = strike(h.armies, h.player);
  realmLine(
    turnContext,
    pi,
    'combat',
    `⛈ ${c.name} calls the sky down on ${pv.name} (${String(CALL_STORM_COST)}g): ${String(destroyed)} compan${destroyed !== 1 ? 'ies are' : 'y is'} destroyed and ${String(fell)} fall${fell !== 1 ? '' : 's'} a quality tier.`,
    pv,
  );
  for (const o of struck)
    if (o !== pi)
      realmLine(
        turnContext,
        o,
        'combat',
        `⛈ A storm called by ${pl.name} breaks over ${pv.name}: your companies there are scattered and battered (${String(destroyed)} destroyed in all, ${String(fell)} fallen a tier).`,
        pv,
      );
}

// ── EVIL: Dark Pact ── the king names a monster of a kind his monster provinces breed and pays one and a half times its
// recruit cost in gold and 40% of his current HP (master list; rounds 2-18: 5 HP); an Average company of it joins his
// host. No waiting between pacts.
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
/** The blood the pact asks: 40% of the king's current HP, rounded down, at least 1. */
export const darkPactBlood = (c: Character): number => Math.max(1, Math.floor(c.hp * DARK_PACT_HP_SHARE));
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
  const blood = darkPactBlood(c);
  if (c.hp <= blood || c.hp <= 1) {
    refuse(turnContext, c, `${c.name}: the pact asks ${String(blood)} of the king's own blood — he has none to spare.`);
    return;
  }
  if (beastCommandRoom(c, G.characters, protoBeastRoomExtra(G, c)) <= 0) {
    refuse(turnContext, c, `${c.name} can lead no more beasts — the summoned thing would turn on him.`);
    return;
  }
  if (!pay(turnContext, c, player, cost, `the pact for ${kind}`)) return;
  c.hp -= blood;
  const u: Army = { type: kind, quality: DARK_PACT_QUALITY, race: 'Primal', unitName: armyUnitNameOf(kind) };
  c.armies.push(u);
  noteKingOrder(G, pl, 'dark_pact');
  realmLine(
    turnContext,
    c.player,
    'hire',
    `😈 Dark Pact: ${c.name} cuts the bargain in his own blood (${String(cost)}g, −${String(blood)} HP → ${String(c.hp)}). Something answers: ${u.unitName} (${kind}, ${DARK_PACT_QUALITY}) joins the king's host.`,
    prov,
  );
}

// ── UNDEAD: Bind the Bones ── (master list) the king raises every skeletal company in the province he stands in (his
// own host, the garrison, and other heroes' hosts of the realm) one quality tier, to Elite, at 2g a company, as many as
// the treasury pays, the best first. Once a turn.
export function resolveBindTheBonesOrder(turnContext: TurnContext, c: Character, prov: Prov, player: Realm): void {
  const { G } = turnContext;
  const pl = kingMay(turnContext, c, 'Undead', 'bind_bones', 'Bind the Bones');
  if (!pl || c.player == null || !prov) return;
  const pi = c.player;
  const here: Army[] = [...c.armies];
  if (prov.owner === pi) here.push(...prov.garrisonArmies);
  for (const h of G.characters) if (h.alive && h.id !== c.id && h.player === pi && h.location === prov.id) here.push(...h.armies);
  const bones = here
    .filter((a) => a._isSkeletal && !a._phantom && TIERS.indexOf(a.quality) < TIERS.length - 1)
    .sort((a, b) => TIERS.indexOf(b.quality) - TIERS.indexOf(a.quality));
  if (!bones.length) {
    refuse(turnContext, c, `${c.name}: no skeletal company here can be bound any tighter.`);
    return;
  }
  const n = Math.min(bones.length, Math.floor(player.gold / BIND_BONES_COST));
  if (n < 1) {
    refuse(turnContext, c, `${c.name}: Bind the Bones costs ${String(BIND_BONES_COST)}g a company — the treasury cannot pay.`);
    return;
  }
  player.gold -= n * BIND_BONES_COST;
  noteKingOrder(G, pl, 'bind_bones');
  const rose: string[] = [];
  for (const a of bones.slice(0, n)) {
    const q0 = a.quality;
    a.quality = TIERS[TIERS.indexOf(a.quality) + 1] ?? a.quality;
    rose.push(`${a.unitName || a.type} ${q0} → ${a.quality}`);
  }
  realmLine(
    turnContext,
    pi,
    'hire',
    `💀 Bind the Bones: ${c.name} binds the dead of ${prov.name} tighter (${String(n * BIND_BONES_COST)}g): ${rose.join('; ')}.`,
    prov,
  );
}

// ── EVIL: Spread Dread ── (master list) a hero in a province of the realm sends out his fearmongers: the province and
// every province next to it takes one stack of Terror, unless it already carries Terror. Free, once a turn per hero (a
// second use lays nothing new, so it needs no stamp).
export function resolveSpreadDreadOrder(turnContext: TurnContext, c: Character, prov: Prov): void {
  const { G } = turnContext;
  if (kitOff(turnContext, c, 'Evil', 'Spread Dread')) return;
  if (c.player == null || prov?.owner !== c.player || prov.terrain === 'sea') {
    refuse(turnContext, c, `${c.name}: Spread Dread needs a province of your own realm to send the fearmongers out from.`);
    return;
  }
  const pi = c.player;
  const touched: string[] = [];
  for (const pv of [prov, ...neighboursOf(G, prov)]) {
    if (pv.terrain === 'sea' || pv._terrorStacks || pv._goodWorksTurn === G.turn) continue;
    pv._terrorStacks = 1;
    pv._terrorTurn = G.turn;
    pv._terrorisedBy = pi;
    pv._terrorPct = TERROR_PCT_PER_STACK;
    touched.push(pv.name);
  }
  if (!touched.length) {
    refuse(turnContext, c, `${c.name}: dread already grips ${prov.name} and every province around it.`);
    return;
  }
  told(
    turnContext,
    c,
    'explore',
    `😱 Spread Dread: ${c.name}'s fearmongers go out from ${prov.name} — Terror takes hold in ${touched.join(', ')}.`,
    prov,
  );
}
