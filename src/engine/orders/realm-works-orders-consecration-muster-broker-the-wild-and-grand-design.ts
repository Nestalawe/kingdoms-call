// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_GRAND_DESIGNS, KC_QUALITY_UP, PRIMAL_ARMY_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { QUALITY_TIERS } from '../army-tables.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { homeProvinceIdFor } from '../grand-design.ts';
import { beastCommandCount, beastCommandRoom } from '../world/tables.ts';
import { heroHireWage } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { takeBestGrave } from '../graves.ts';
import { consecratedIds } from '../heroes/fame-and-consecration.ts';
import { grantMithrilTo } from '../personal-combat/helpers.ts';
import { armyUnitName, d100 } from '../dice-and-army-names.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { TM, skillLevel } from '../titles/perks.ts';
import { gdActive } from '../discoveries.ts';
import {
  doARealmsDiscoveriesWaiveTheHiringBan,
  theQualitiesARealmsDiscoveriesMayRaiseACallToArmsAt,
  whatARealmsDiscoveriesAddToTheConsecrationsACrownMayHold,
  whatARealmsDiscoveriesAddToTheCorpseCartersCost,
} from '../rules/the-registry-of-discovery-effects.ts';
import { emit, logSplit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';
import { areEnemies } from '../realms/relations-and-captures.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { refreshMovePool, setMovePool } from '../units/movement-pools.ts';
import { SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { applySpySuccess } from '../espionage/what-a-spy-learns.ts';
import { resolveUnitGainInProvince } from '../battle/hosts-gained-in-a-province.ts';
import { landHirePreOrders } from './recruit-and-hire-orders-companies-mercenaries-and-heroes.ts';

// ── THE REALM'S WORKS (plan P1-08j3: the third family taken out of processOrder in resolveTurn) ──
// The orders of a realm's creed (Consecrate, Call to Arms, Broker, Harvest the Field, and the refusal of the removed
// Awaken the Wild and Call from the Pit) and three masteries (Awaken Grove, Wild Calling, Grand Design), each once
// processOrder has read the order and checked he may act (a mastery once a turn; a charmed hero refuses a creed's rite
// or a mastery). Each takes the turn's context first (src/engine/turn/context.ts), then the values processOrder worked
// out before it that it reads, in the order processOrder declares them. Each body keeps processOrder's indent (plan
// P1-08's Decisions); a case-level break became a return.
// DIVINE — Consecrate: sanctify ONE owned province as the realm's holy heart.
export function resolveConsecrateOrder(turnContext, c, prov, player) {
  const { G } = turnContext;
  if (!c.isKing) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'only the king can consecrate ground', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (G.players[c.player]?.alignment !== 'Divine') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the gods answer a consecration only from a Divine crown', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (prov.owner !== c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'only a province of the realm can be consecrated', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const _homeId = homeProvinceIdFor(G, c.player);
  const _homeAdj = new Set(
    _homeId != null
      ? getNeighborsP(G.world.provinces[_homeId], G.world.cols, G.world.rows, G.world.provinces)
          .map((x) => x && x.id)
          .filter((x) => x != null)
      : [],
  );
  if (prov.id === _homeId || _homeAdj.has(prov.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the home marches were anointed at the coronation', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const _cList = consecratedIds(player);
  if (_cList.includes(prov.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the province is already consecrated', provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // holy ground must be spread across the realm — two consecrated provinces may not lie side
  // by side. Reject if any neighbour of this province is already consecrated.
  const _provAdjC = new Set(
    getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces)
      .map((x) => x && x.id)
      .filter((x) => x != null),
  );
  const _adjConsecId = _cList.find((id) => _provAdjC.has(id));
  if (_adjConsecId != null) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'two consecrated provinces may not lie side by side',
        heroName: c.name,
        provinceName: prov.name,
        neighbourName: G.world.provinces[_adjConsecId]?.name || null,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // the crown may hold up to its WHITE skill level in consecrated provinces at once.
  const _cLimit =
    skillLevel(c, 'white') +
    whatARealmsDiscoveriesAddToTheConsecrationsACrownMayHold(G.players[c.player], {
      theConsecratorsWhiteSkill: skillLevel(c, 'white'),
    }); // ad03 Holy Sites (+1; still needs White 1+; the discoveries' registry's since plan P1-19ae: "orderOutcome: a
  // realm's discoveries add to the consecrations a crown may hold")
  if (_cLimit <= 0) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'consecration flows from the White arts', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (_cList.length >= _cLimit) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'the White faith can sustain no more consecrated provinces',
        heroName: c.name,
        limit: _cLimit,
        consecratedNames: _cList.map((id) => G.world.provinces[id]?.name).filter(Boolean),
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  _cList.push(prov.id);
  // 2026-10-15 (Toby, D8): no Hierophant merit — only a Divine king can consecrate, so it was a
  // creed-only route to a title. Bless Province, Holy Symbol and Resurrect still count.
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: 'a king consecrates a province',
      heroName: c.name,
      provinceName: prov.name,
      consecrated: _cList.length,
      limit: _cLimit,
    },
    audience: { actor: c.player, realms: [c.player], seen: 'there' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
    env: true,
  });
  return;
}
// GOOD — Call to Arms: the folk answer the king; a free Green garrison unit musters.
export function resolveCallToArmsOrder(turnContext, c, target, player) {
  const { G } = turnContext;
  if (G.players[c.player]?.alignment !== 'Good') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "only a Good realm's folk answer a Call to Arms", heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (!c.isKing) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "only the king's voice carries the Call to Arms", heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (player._calledToArmsTurn === G.turn) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the realm has already answered a Call to Arms this turn', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const ctaProv = G.world.provinces[parseInt(target)];
  if (!ctaProv || ctaProv.owner !== c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Call to Arms must name a province of the realm', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (ctaProv.terrain === 'sea' || (ctaProv.race || '').startsWith('Primal')) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'only the folk of settled land answer a Call to Arms',
        heroName: c.name,
        provinceName: ctaProv.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // Elven Bowmen). Take the province's garrison type from its own pool; fall back to the
  // racial garrison, then a plain levy.
  const GARRISON_BY_RACE_CTA = {
    Human: 'Human Garrison',
    Elven: 'Elven Garrison',
    Dwarven: 'Dwarf Garrison',
    Orcish: 'Orc Garrison',
  };
  const ctaType =
    (ctaProv.armyTypes || []).find((t) => String(t).toLowerCase().includes('garrison')) ||
    GARRISON_BY_RACE_CTA[ctaProv.race] ||
    'Human Garrison';
  ctaProv.garrisonArmies = ctaProv.garrisonArmies || [];
  const _ctaQ =
    theQualitiesARealmsDiscoveriesMayRaiseACallToArmsAt(G.players[c.player])
      .filter((e) => e.theChance == null || kcRng() < e.theChance)
      .map((e) => e.theQuality)
      .find((q) => q && QUALITY_TIERS.includes(q)) || 'Green'; // ag05 Muster Rolls (a chance per muster; the discoveries'
  // registry's since plan P1-19ae: "orderOutcome: a realm's discoveries raise a call to arms' quality", each chance
  // rolled here, in turn, as before)
  ctaProv.garrisonArmies.push({
    type: ctaType,
    quality: _ctaQ,
    race: ctaProv.race || 'Human',
    unitName: armyUnitName(ctaType),
  });
  player._calledToArmsTurn = G.turn;
  emit(turnContext, {
    type: 'hire',
    fact: { kind: 'the folk answer a Call to Arms', provinceName: ctaProv.name, quality: _ctaQ, unitType: ctaType },
    audience: { actor: c.player, realms: [c.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: ctaProv.id,
  });
  return;
}
// NEUTRAL — Broker: money moves what armies cannot. Remote hire, or a paid remote spy.
export function resolveBrokerOrder(turnContext, c, ph, target, player) {
  const { G, SEASONS } = turnContext;
  if (G.players[c.player]?.alignment !== 'Neutral') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'only a Neutral crown keeps brokers', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (!c.isKing) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "only the king commands the realm's brokers", heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const _bk = (target || '').split(':');
  if (_bk[0] === 'hire') {
    const bh = G.characters[parseInt(_bk[1])];
    const bhProv = bh ? G.world.provinces[bh.location] : null;
    const _visible = bhProv && (bhProv.owner === c.player || (bhProv.visitedBy || []).includes(c.player));
    if (!bh || bh.player !== null || !bh.alive || bh._isNeutralGuard || bh._justDefeated || !_visible) {
      emit(turnContext, {
        type: 'hire',
        fact: { kind: 'the brokers find no such hero within reach', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (bh._releasedTurn === G.turn) {
      emit(turnContext, {
        type: 'hire',
        fact: { kind: 'a hero just released from service hears no offers this turn', heroName: bh.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    } // same rule as Hire Hero
    // sd31 Diplomatic Protocols (the discoveries' registry's since plan P1-19ae: "orderValidity: a realm's discoveries
    // waive the hiring ban")
    const bWage = heroHireWage(
      G.players[c.player]?.alignment || 'Neutral',
      bh.alignment,
      doARealmsDiscoveriesWaiveTheHiringBan(G.players[c.player]),
      bh,
    );
    if (bWage == null) {
      emit(turnContext, {
        type: 'hire',
        fact: { kind: 'a hero will not treat with the brokers across the alignment gulf', heroName: bh.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if ((player.gold || 0) < bWage) {
      emit(turnContext, {
        type: 'hire',
        fact: { kind: 'a king cannot afford a brokered hero', heroName: c.name, wantedName: bh.name, wage: bWage },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    bh.pay = bWage;
    player.gold -= bWage;
    bh.player = c.player;
    bh.name = bh.name.replace(' (wandering)', '');
    // a brokered hire is a HIRE.
    if (bh.race === 'Dwarven' && G.players[c.player]?.race === 'Dwarven') grantMithrilTo(bh, G); // mithril on hire into a dwarf realm
    player.heroes = player.heroes || [];
    player.heroes.push(bh.id);
    bh.hiredInPhase = ph;
    if (!G.turnOrders[bh.id]) G.turnOrders[bh.id] = [null, null, null, null, null];
    for (let p2 = 0; p2 <= ph; p2++)
      G.turnOrders[bh.id][p2] = G.turnOrders[bh.id][p2] || {
        action: 'defend',
        target: '',
        extra: '',
        desc: '(not yet hired)',
      };
    landHirePreOrders(turnContext, bh, c, ph, player); // 2026-09-23: the brokered hero's pre-written orders + plan
    setMovePool(turnContext, bh);
    const _brokerFact = {
      kind: "a wandering hero accepts the realm's terms by courier",
      heroName: bh.name,
      race: bh.race,
      alignment: bh.alignment,
      provinceName: bhProv.name,
      realmName: player.name,
      wage: bWage,
      seasonName: SEASONS[ph + 1] || null,
    };
    emit(turnContext, {
      type: 'hire',
      fact: _brokerFact,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: bhProv.id,
    });
    // mirror into the brokered hero's own Chronicle section at the hire phase.
    emit(turnContext, {
      type: 'hire',
      fact: _brokerFact,
      audience: { actor: c.player, realms: [c.player] },
      province: bhProv.id,
      hero: bh.id,
      phase: ph,
    });
  } else if (_bk[0] === 'spy') {
    const sp2 = G.world.provinces[parseInt(_bk[1])];
    const _seen =
      sp2 &&
      (sp2.owner === c.player ||
        (sp2.visitedBy || []).includes(c.player) ||
        ((sp2.exploredBy || {})[c.player] || 0) > 0);
    if (!sp2 || !_seen) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'the brokers reach only provinces the realm has seen', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if ((player.gold || 0) < 2) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'the treasury cannot pay for brokered word', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    player.gold -= 2;
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the brokers buy word from a province', heroName: c.name, provinceName: sp2.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    applySpySuccess(turnContext, c, sp2);
  } else {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Broker order names no target', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
  }
  return;
}
// DRUIDIC Awaken the Wild and EVIL Call from the Pit: REMOVED 2026-10-12 (Toby item 22 — they made Creatures
// and Monsters too easy to come by). An order a save still holds from before is refused in plain words.
export function resolveRemovedAwakenTheWildAndCallFromThePitOrders(turnContext, c, action) {
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: 'the orders that called beasts are no more',
      heroName: c.name,
      itWasCallFromThePit: action === 'call_pit',
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  });
  return;
}
// UNDEAD — Harvest the Field: no spell, just the grim trade. One grave becomes one soldier.
export function resolveHarvestTheFieldOrder(turnContext, c, ph, prov, player) {
  const { G } = turnContext;
  if (G.players[c.player]?.alignment !== 'Undead') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'only Undead realms keep corpse-carters', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const hGraves = prov.battleGraves || [];
  if (hGraves.length === 0) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'no battlefield dead lie here to raise', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // az06 Corpse-Carters (the discoveries' registry's since plan P1-19ae: "orderOutcome: a realm's discoveries cut the
  // corpse-carters' cost", which the report's price asks too)
  const _hCost = Math.max(0, 2 + whatARealmsDiscoveriesAddToTheCorpseCartersCost(G.players[c.player]));
  if ((player.gold || 0) < _hCost) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the treasury cannot pay the corpse-carters', heroName: c.name, cost: _hCost },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  player.gold -= _hCost;
  const hGrave = takeBestGrave(prov); // the most experienced dead are worked first
  const _uTierH = gdActive(turnContext, c.player, 'Undead'); // GRAND DESIGN — Undead
  const hSkel = {
    type: hGrave.type,
    quality: _uTierH ? KC_QUALITY_UP[hGrave.quality] || hGrave.quality : hGrave.quality,
    race: 'Undead',
    _isSkeletal: true,
    unitName: `${hGrave.unitName || armyUnitName(hGrave.type)} (Skeletal)`,
  };
  c.armies = c.armies || [];
  c.armies.push(hSkel);
  emit(turnContext, {
    type: 'hire',
    fact: {
      kind: 'the corpse-carters raise a skeletal company',
      heroName: c.name,
      provinceName: prov.name,
      unitName: hSkel.unitName,
      quality: hSkel.quality,
      cost: _hCost,
    },
    audience: { actor: c.player, realms: [c.player], seen: 'there' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  // Harvest the Field is the ONE way to raise the dead without any Necromancy — an Undead
  // realm's carters do it by hand. But a skeletal unit still needs a necromancer to hold it
  // together, so a raiser with no Necromancy is warned at once, while there is still time in
  // the turn to hand the unit to one. Without this the player would simply find it gone at
  // end of turn, having paid for it.
  if (effStat(turnContext, c, 'necromancy') < 1)
    emit(turnContext, {
      type: 'hire',
      fact: {
        kind: 'a raiser with no Necromancy is warned his dead will crumble',
        heroName: c.name,
        unitName: hSkel.unitName,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  resolveUnitGainInProvince(turnContext, c, prov, ph);
  return;
}
// Awaken Grove (Druid 7, once a turn): Forest Ents march with the druid until the turn's end.
export function resolveAwakenGroveOrder(turnContext, c, ph, prov) {
  if (skillLevel(c, 'druid') < 7) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Druid mastery to Awaken a Grove', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const okTerrain =
    prov.terrain === 'forest' || prov.terrain === 'jungle' || String(prov.race || '').startsWith('Primal');
  if (prov.owner !== c.player || !okTerrain) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Awaken Grove works only in an owned forest, jungle or wild province', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const grove = {
    type: 'Forest Ents',
    quality: 'Veteran',
    race: 'Forest Ent',
    unitName: 'an awakened Grove',
    _temporary: true,
    _expiresAfterPhase: -1,
  };
  c.armies = c.armies || [];
  c.armies.push(grove);
  logSplit(
    turnContext,
    'explore',
    { kind: 'a druid awakens the grove', heroName: c.name, provinceName: prov.name },
    {
      kind: 'onlookers see a druid awaken the grove',
      heroName: c.name,
      realmName: c.player != null && turnContext.G.players[c.player] ? turnContext.G.players[c.player].name : null,
      provinceName: prov.name,
    },
    { audience: { actor: c.player }, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING, province: prov.id },
  );
  resolveUnitGainInProvince(turnContext, c, prov, ph);
  trySkillGain(turnContext, c, 'druid', SKILLGAIN_STD);
  return;
}
// Wild Calling (Druid 9, once a turn): wild beasts in the province that serve another may break and follow the caller.
export function resolveWildCallingOrder(turnContext, c, ph, prov) {
  const { G } = turnContext;
  // ── WILD CALLING ── every primal creature or monster in this province that does not
  // already serve you — a neutral primal host, an enemy commander's beasts, or unled garrison
  // beasts — has a 50% chance to defect and fall in behind the caller. Humanoid troops,
  // fleets, machines and the walking dead are deaf to it.
  if (skillLevel(c, 'druid') < 9) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Druid mastery to sound a Wild Calling', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const _wcIsBeast = (u) =>
    !!u &&
    !u._isSkeletal &&
    (CREATURE_ARMIES.has(u.type) || MONSTER_ARMIES.has(u.type) || !!PRIMAL_ARMY_DEFS_P[u.type]);
  const _wcWon = [];
  const _wcHeard = [];
  let _wcCalled = 0;
  const _wcRoom = beastCommandRoom(c, G.characters); // item 24: no more answer than the caller's Druid has room for
  const _wcSift = (arr, from) => {
    if (!Array.isArray(arr)) return;
    for (let i = arr.length - 1; i >= 0; i--) {
      const u = arr[i];
      if (!_wcIsBeast(u)) continue;
      _wcCalled++;
      if (_wcWon.filter(beastCommandCount).length >= _wcRoom) continue;
      if (d100() <= 50) {
        _wcWon.push(Object.assign({}, arr.splice(i, 1)[0], { _pacified: true }));
        // named once however many of its beasts answer (the same garrison, or a hero of the same name)
        if (
          from &&
          !_wcHeard.some(
            (h) => h.kind === from.kind && h.provinceName === from.provinceName && h.heroName === from.heroName,
          )
        )
          _wcHeard.push(from);
      }
    }
  };
  _wcSift(prov.neutralDefenders, null); // the wild host of a primal province
  if (prov.owner != null && prov.owner !== c.player)
    _wcSift(prov.garrisonArmies, { kind: 'the garrison of a province', provinceName: prov.name });
  else if (prov.owner == null) _wcSift(prov.garrisonArmies, null);
  (G.characters || []).forEach((o) => {
    if (!o || !o.alive || o.id === c.id || o.location !== c.location) return;
    if (o.player === c.player) return; // never poached from your own commanders
    if (o.player != null && !areEnemies(turnContext, c.player, o.player)) return; // and never from a realm you are not at war with
    const before = _wcWon.length;
    _wcSift(o.armies, { kind: "a hero's host", heroName: o.name });
    if (_wcWon.length > before && o.player != null) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "the beasts of a hero's host answer a Wild Calling",
          heroName: o.name,
          provinceName: prov.name,
          lost: _wcWon.length - before,
        },
        audience: { actor: o.player, realms: [o.player] },
        province: prov.id,
        hero: o.id,
      });
      if (typeof refreshMovePool === 'function') refreshMovePool(turnContext, o);
    }
  });
  if (_wcCalled === 0) {
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'nothing wild stands here to answer a Wild Calling', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  if (_wcWon.length === 0) {
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: 'not one wild creature breaks for a Wild Calling',
        heroName: c.name,
        called: _wcCalled,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player], seen: 'there' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    trySkillGain(turnContext, c, 'druid', SKILLGAIN_STD);
    return;
  }
  c.armies = (c.armies || []).concat(_wcWon);
  logSplit(
    turnContext,
    'explore',
    {
      kind: 'wild creatures answer a Wild Calling',
      heroName: c.name,
      provinceName: prov.name,
      won: _wcWon.length,
      called: _wcCalled,
      tornFrom: _wcHeard.slice(),
    },
    {
      kind: 'onlookers see wild creatures answer a Wild Calling',
      heroName: c.name,
      realmName: c.player != null && G.players[c.player] ? G.players[c.player].name : null,
      provinceName: prov.name,
      won: _wcWon.length,
    },
    { audience: { actor: c.player }, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING, province: prov.id },
  );
  if (typeof refreshMovePool === 'function') refreshMovePool(turnContext, c);
  resolveUnitGainInProvince(turnContext, c, prov, ph);
  trySkillGain(turnContext, c, 'druid', SKILLGAIN_STD);
  return;
}
// Grand Design (Sage 9, once a realm): the Wonder of the realm's alignment, raised in the province he stands in.
export function resolveGrandDesignOrder(turnContext, c, prov) {
  const { G } = turnContext;
  if (skillLevel(c, 'sage') < 9) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Sage mastery to realise a Grand Design', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const player = G.players[c.player];
  if (!player.discoveries) player.discoveries = [];
  if (player.discoveries.some((d) => d.id === 'gd')) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the realm has already completed its Grand Design', realmName: G.players[c.player]?.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const _GD_DEFS = { ...KC_GRAND_DESIGNS };
  const _gdA = (G.players[c.player] && G.players[c.player].alignment) || 'Neutral';
  const _gdD = _GD_DEFS[_gdA] || { name: 'The Great Work', desc: 'A unique realm-wide Wonder.' };
  // the Wonder now STANDS SOMEWHERE. Its province is recorded on the realm and on the
  // province itself; every benefit is gated on the builder still holding that ground
  // (gdActive), and is regained in full the moment the province is retaken. The Wonder itself is
  // never destroyed and never changes hands — a conqueror gains nothing but the view.
  player.gdProvinceId = prov.id;
  player.gdName = _gdD.name;
  prov.grandDesign = { owner: c.player, name: _gdD.name, alignment: _gdA, builtTurn: G.turn };
  player.discoveries.push({
    id: 'gd',
    name: 'Grand Design \u2014 ' + _gdD.name,
    category: 'Wonder',
    desc: _gdD.desc,
    turnDiscovered: G.turn,
    provinceId: prov.id,
    provinceName: prov.name,
  });
  TM(c).discoveries += 1;
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: "a hero completes the realm's Grand Design",
      heroName: c.name,
      realmName: G.players[c.player]?.name,
      wonderName: _gdD.name,
      wonderDescription: _gdD.desc,
      provinceName: prov.name,
    },
    audience: { actor: c.player, realms: [c.player], seen: 'there' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  trySkillGain(turnContext, c, 'sage', SKILLGAIN_STD);
  return;
}
