// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import {
  alignProto,
  CONSECRATE_COST,
  divinePower,
  protoAlignOf,
  protoBeastRoomExtra,
} from '../alignment-prototypes.ts';
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
import { discEff, discSum, gdActive, hasDisc } from '../discoveries.ts';
import { realmTag } from '../turn/log-line-helpers.ts';
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
  // PROTOTYPE Divine (alignment ideas round 1): the crusade spreads from the hearth — any hero with White 1+ consecrates
  // a province of the realm's that borders hallowed ground (the home counts as hallowed); no cap, no two-apart rule.
  if (alignProto(G, 'Divine') && G.players[c.player]?.alignment === 'Divine') {
    if (prov.owner !== c.player) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: only a province of your own realm can be consecrated — take and hold this land first.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (effStat(turnContext, c, 'white') < 3) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: consecration flows from the White arts — White 3 is needed to sanctify ground (master list).`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const _home = homeProvinceIdFor(G, c.player);
    const _list = consecratedIds(player);
    if (prov.id === _home || _list.includes(prov.id)) {
      emit(turnContext, {
        type: 'system',
        text: `${prov.name} is hallowed ground already.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const _adj = getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces)
      .map((x) => x && x.id)
      .filter((x) => x != null);
    if (!_adj.some((id) => id === _home || _list.includes(id))) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: the light is carried outward from hallowed ground — ${prov.name} borders none of yours. Consecrate a province beside your hearth or your other holy ground.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // round 5 (Toby): the rite costs gold
    if ((player.gold || 0) < CONSECRATE_COST) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: the consecration's oils, candles and alms cost ${CONSECRATE_COST}g — the treasury cannot pay.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    player.gold -= CONSECRATE_COST;
    _list.push(prov.id);
    const _shine = (prov.features || []).some((f) => f && f.ritualSite && f.siteKind === 'holy');
    emit(turnContext, {
      type: 'explore',
      text: `✨ ${c.name} consecrates ${prov.name} (${CONSECRATE_COST}g)! Holy ground: +50% tax, its defenders fight at ×1.5, its levies muster as Veterans, the fallen leave no graves, and your fallen heroes can return here.${_shine ? ` The holy site here shines: the realm's Divine Power is ${divinePower(G, c.player)}.` : ''} (${_list.length} consecrated.)`,
      audience: { actor: c.player, realms: [c.player], seen: 'there' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      env: true,
    });
    return;
  }
  if (!c.isKing) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name} may pray, but only the anointed King can consecrate ground — the rite belongs to the crown alone.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (G.players[c.player]?.alignment !== 'Divine') {
    emit(turnContext, {
      type: 'system',
      text: `${c.name} kneels and prays, but the gods answer only Divine crowns — Consecration is not for this realm.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (prov.owner !== c.player) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: only a province of your own realm can be consecrated — take and hold this land first.`,
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
      text: `${c.name}: the crown's own hearth was anointed at the coronation — its grace already shelters the throne and the lands in its shadow. The gods charge their servants to carry the light OUTWARD: consecrate a province beyond the home marches.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const _cList = consecratedIds(player);
  if (_cList.includes(prov.id)) {
    emit(turnContext, {
      type: 'system',
      text: `${prov.name} is already consecrated — the ground is holy and needs no second blessing.`,
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
      text: `${c.name}: ${prov.name} borders ${G.world.provinces[_adjConsecId]?.name || 'already-hallowed ground'} — two consecrated provinces may not lie side by side. Carry the light to ground set apart from your other holy lands.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // the crown may hold up to its WHITE skill level in consecrated provinces at once.
  const _cLimit =
    skillLevel(c, 'white') +
    discSum(turnContext, c.player, 'consecrate', 'cap', (e) => skillLevel(c, 'white') >= (e.minWhite || 1)); // ad03 Holy Sites (+1; still needs White 1+)
  if (_cLimit <= 0) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: consecration flows from the White arts — learn White magic before you can sanctify ground.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (_cList.length >= _cLimit) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: your White faith can sustain only ${_cLimit} consecrated province${_cLimit !== 1 ? 's' : ''} at once (${
        _cList
          .map((id) => G.world.provinces[id]?.name)
          .filter(Boolean)
          .join(', ') || '—'
      }). One must be lost or captured before you can hallow ${prov.name}. (Raise your White skill to consecrate more.)`,
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
    text: `✨ ${c.name} consecrates ${prov.name}! Holy ground: +50% tax, defenders twice as likely to fight with fanatical zeal, Undead and Evil invaders fight at −15%, and your fallen can be restored only here — they rise in the nearest consecrated province, which then gives up its consecration. If it is captured the consecration breaks at once and the conquerors are emboldened. (${_cList.length}/${_cLimit} consecrated — set by your White skill; a consecrated province that is captured frees a slot.)`,
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
      text: `${c.name}'s call goes unanswered — only the folk of a Good realm rise for their king unpaid.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (!c.isKing) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: only the KING's voice carries the Call to Arms.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (player._calledToArmsTurn === G.turn) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: the realm has already answered one Call to Arms this turn — the folk cannot muster twice in a season.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const ctaProv = G.world.provinces[parseInt(target)];
  if (!ctaProv || ctaProv.owner !== c.player) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: Call to Arms must name a province you control this phase.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (ctaProv.terrain === 'sea' || (ctaProv.race || '').startsWith('Primal')) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: only the humanoid folk of settled land answer a Call to Arms — ${ctaProv.name} has no villages to raise.`,
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
    discEff(turnContext, c.player, 'ctaQuality')
      .filter((e) => e.pct == null || kcRng() < e.pct)
      .map((e) => e.quality)
      .find((q) => q && QUALITY_TIERS.includes(q)) || 'Green'; // ag05 Muster Rolls (a chance per muster)
  ctaProv.garrisonArmies.push({
    type: ctaType,
    quality: _ctaQ,
    race: ctaProv.race || 'Human',
    unitName: armyUnitName(ctaType),
  });
  player._calledToArmsTurn = G.turn;
  emit(turnContext, {
    type: 'hire',
    text: `📯 Call to Arms! The folk of ${ctaProv.name} answer their king — ${_ctaQ === 'Green' ? 'a Green' : 'an ' + _ctaQ} ${ctaType} joins the province garrison, free of wages this muster. (Once per turn.)`,
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
      text: `${c.name}: only a Neutral crown keeps the web of factors and go-betweens that Brokering requires.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (!c.isKing) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: only the KING commands the realm's brokers.`,
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
        text: `${c.name}'s brokers find no such hero within reach of the realm's agents.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (bh._releasedTurn === G.turn) {
      emit(turnContext, {
        type: 'hire',
        text: `${bh.name} was only just released from service and will hear no offers this turn. Try again next turn.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    } // same rule as Hire Hero
    const bWage = heroHireWage(
      G.players[c.player]?.alignment || 'Neutral',
      bh.alignment,
      hasDisc(turnContext, c.player, 'sd31'),
      bh,
    );
    if (bWage == null) {
      emit(turnContext, {
        type: 'hire',
        text: `${bh.name} will not treat with your brokers — the alignment gulf is too wide.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if ((player.gold || 0) < bWage) {
      emit(turnContext, {
        type: 'hire',
        text: `${c.name} cannot afford ${bh.name} — needs ${bWage}g/turn.`,
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
    const _bActs = `They may act from ${SEASONS[ph + 1] || 'next turn'} onwards, from where they stand.`;
    const _brokerLine = `🤝 Brokered: ${bh.name} (${bh.race}, ${bh.alignment}) in ${bhProv.name} accepts ${player.name}'s terms by courier — ${bWage}g/turn. ${_bActs}`;
    emit(turnContext, {
      type: 'hire',
      text: _brokerLine,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: bhProv.id,
    });
    // mirror into the brokered hero's own Chronicle section at the hire phase.
    emit(turnContext, {
      type: 'hire',
      text: _brokerLine,
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
        text: `${c.name}: your brokers can only reach provinces the realm has seen.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if ((player.gold || 0) < 2) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: brokered intelligence costs 2g — the treasury cannot cover it.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    player.gold -= 2;
    emit(turnContext, {
      type: 'system',
      text: `🤝 ${c.name}'s brokers buy word from ${sp2.name} (2g).`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    applySpySuccess(turnContext, c, sp2);
  } else {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: Broker requires a target — a hero to hire or a province to buy word from.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
  }
  return;
}
// DRUIDIC Awaken the Wild and EVIL Call from the Pit: REMOVED 2026-10-12 (Toby item 22 — they made Creatures
// and Monsters too easy to come by). An order a save still holds from before is refused in plain words.
export function resolveRemovedAwakenTheWildAndCallFromThePitOrders(turnContext, c, action) {
  const _gone = action === 'call_pit' ? 'Call from the Pit' : 'Awaken the Wild';
  emit(turnContext, {
    type: 'system',
    text: `${c.name}: ${_gone} is no more — Creatures and Monsters now come only by recruiting them where they live.`,
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
      text: `${c.name} has neither the craft nor the stomach for grave-harvesting — only Undead realms keep corpse-carters.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const hGraves = prov.battleGraves || [];
  if (hGraves.length === 0) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name} walks the field of ${prov.name}, but there are no battlefield dead here to raise.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const _hCost = Math.max(0, 2 + discSum(turnContext, c.player, 'harvestCost', 'delta')); // az06 Corpse-Carters
  if ((player.gold || 0) < _hCost) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: the corpse-carters and grave-wights want their ${_hCost}g — the treasury cannot pay.`,
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
  // PROTOTYPE Undead (round 8): the kit's carters raise a second company from the same field when one lies there
  let _second = '';
  if (protoAlignOf(G, c.player) === 'Undead' && (prov.battleGraves || []).length) {
    const g2 = takeBestGrave(prov);
    const s2 = {
      type: g2.type,
      quality: _uTierH ? KC_QUALITY_UP[g2.quality] || g2.quality : g2.quality,
      race: 'Undead',
      _isSkeletal: true,
      unitName: `${g2.unitName || armyUnitName(g2.type)} (Skeletal)`,
    };
    c.armies.push(s2);
    _second = ` The kit's carters raise a second: ${s2.unitName} (${s2.quality}).`;
  }
  emit(turnContext, {
    type: 'hire',
    text: `💀 Harvest the Field — ${c.name}'s carters work the graves of ${prov.name}: ${hSkel.unitName} (${hSkel.quality}) rises to serve, no magic required. (${_hCost}g; upkeep 1g/turn.)${_second}`,
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
      text: `⚠ ${c.name} has no Necromancy of their own — ${hSkel.unitName} will crumble to dust at the end of this turn unless it is handed to a character with at least Necromancy 1. The dead do not stand without a master, and a garrison is no master at all.`,
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
      text: `${c.name} lacks the Druid mastery (7) to Awaken a Grove.`,
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
      text: `${c.name}: Awaken Grove works only while standing in an OWNED forest, jungle or wild (Creature or Monster) province.`,
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
    `🌳 ${c.name} awakens the grove of ${prov.name} — Forest Ents tear their roots from the earth to march under your banner until the turn's end.`,
    `🌳 ${c.name}${realmTag(turnContext, c.player)} awakens the grove of ${prov.name} — Forest Ents tear their roots from the earth to march under their banner until the turn's end.`,
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
      text: `${c.name} lacks the Druid mastery (9) to sound a Wild Calling.`,
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
  const _wcRoom = beastCommandRoom(c, G.characters, protoBeastRoomExtra(G, c)); // item 24: no more answer than the caller's Druid has room for
  const _wcSift = (arr, label) => {
    if (!Array.isArray(arr)) return;
    for (let i = arr.length - 1; i >= 0; i--) {
      const u = arr[i];
      if (!_wcIsBeast(u)) continue;
      _wcCalled++;
      if (_wcWon.filter(beastCommandCount).length >= _wcRoom) continue;
      if (d100() <= 50) {
        _wcWon.push(Object.assign({}, arr.splice(i, 1)[0], { _pacified: true }));
        if (label && !_wcHeard.includes(label)) _wcHeard.push(label);
      }
    }
  };
  _wcSift(prov.neutralDefenders, null); // the wild host of a primal province
  if (prov.owner != null && prov.owner !== c.player) _wcSift(prov.garrisonArmies, `the garrison of ${prov.name}`);
  else if (prov.owner == null) _wcSift(prov.garrisonArmies, null);
  (G.characters || []).forEach((o) => {
    if (!o || !o.alive || o.id === c.id || o.location !== c.location) return;
    if (o.player === c.player) return; // never poached from your own commanders
    if (o.player != null && !areEnemies(turnContext, c.player, o.player)) return; // and never from a realm you are not at war with
    const before = _wcWon.length;
    _wcSift(o.armies, o.name);
    if (_wcWon.length > before && o.player != null) {
      emit(turnContext, {
        type: 'system',
        text: `🐾 The beasts of ${o.name}'s host break their bonds and answer a Wild Calling in ${prov.name} — ${_wcWon.length - before} unit${_wcWon.length - before !== 1 ? 's' : ''} lost.`,
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
      text: `${c.name} sounds a Wild Calling, but nothing wild stands in ${prov.name} to answer it.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  if (_wcWon.length === 0) {
    emit(turnContext, {
      type: 'explore',
      text: `🐾 ${c.name} sounds a Wild Calling over ${_wcCalled} wild creature${_wcCalled !== 1 ? 's' : ''} in ${prov.name} — not one of them breaks for the call.`,
      audience: { actor: c.player, realms: [c.player], seen: 'there' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    trySkillGain(turnContext, c, 'druid', SKILLGAIN_STD);
    return;
  }
  c.armies = (c.armies || []).concat(_wcWon);
  const _wcFrom = _wcHeard.length ? ` (torn from ${_wcHeard.join(' and ')})` : '';
  logSplit(
    turnContext,
    'explore',
    `🐾 ${c.name} sounds a Wild Calling in ${prov.name} — ${_wcWon.length} of ${_wcCalled} wild creature${_wcCalled !== 1 ? 's' : ''} answer and fall in behind your banner${_wcFrom}!`,
    `🐾 ${c.name}${realmTag(turnContext, c.player)} sounds a Wild Calling in ${prov.name} — ${_wcWon.length} wild creature${_wcWon.length !== 1 ? 's' : ''} answer and fall in behind their banner.`,
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
      text: `${c.name} lacks the Sage mastery (9) to realise a Grand Design.`,
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
      text: `${G.players[c.player]?.name} has already completed its Grand Design — there can be only one.`,
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
    text: `🏗 ${c.name} completes ${G.players[c.player]?.name}'s Grand Design \u2014 the ${_gdD.name}, a Wonder of the age, raised in ${prov.name}! ${_gdD.desc} Its blessings last only while ${G.players[c.player]?.name} holds ${prov.name} — lose the province and they lapse; retake it and they return.`,
    audience: { actor: c.player, realms: [c.player], seen: 'there' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  trySkillGain(turnContext, c, 'sage', SKILLGAIN_STD);
  return;
}
