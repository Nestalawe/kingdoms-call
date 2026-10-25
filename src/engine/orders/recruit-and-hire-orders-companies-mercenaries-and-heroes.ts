// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { protoAlignOf, qualityUp, protoBeastRoomExtra } from '../alignment-prototypes.ts';
import { KC_HUMANOID_RACES } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { ARMY_COST_MASTER, SKILL_LABELS } from '../army-tables.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
  PRIMAL_SEA_TYPES,
} from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { beastCommandCount, beastCommandRoom, beastCommandWords } from '../world/tables.ts';
import {
  alignDistP,
  heroHireWage,
  heroSkillWage,
} from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { grantMithrilTo } from '../personal-combat/helpers.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { TM, creditBeastUnit, perkTier } from '../titles/perks.ts';
import { orderCharRef } from '../heroes/charms-and-neutrals.ts';
import {
  applyPendingSynthPlan,
  discRecruitQChance,
  discSum,
  discUnitIs,
  gdActive,
  hasDisc,
  isGarrisonUnitType,
  realmRecruitCost,
} from '../discoveries.ts';
import { emit, notifyTarget, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';
import { refreshMovePool, setMovePool } from '../units/movement-pools.ts';
import { canRecruit, getRecruitLimit, recordRecruit } from '../units/recruit-limits.ts';
import { SKILLGAIN_COMMON, SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { resolveUnitGainInProvince } from '../battle/hosts-gained-in-a-province.ts';

// ── THE RECRUIT AND HIRE ORDERS (plan P1-08j3: the third family taken out of processOrder in resolveTurn) ──
// Recruit Armies (companies raised in a province the realm holds, and mercenary bands hired where they roam) and Hire
// Hero (a wandering hero sworn where he stands), each once processOrder has read the order and checked he may act;
// and landHirePreOrders, which lands the hirer's pre-written orders for a hero once he is sworn (also the Broker's,
// in realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts). Each takes the turn's context first
// (src/engine/turn/context.ts), then the values processOrder worked out before it that it reads, in the order
// processOrder declares them. Each body keeps processOrder's indent (plan P1-08's Decisions); a case-level break
// became a return.
// The humanoid races, as a Set: a recruit of any other race may raise the Druid skill of the hero it joins.
export const HUMANOID_RACES_SG = new Set(KC_HUMANOID_RACES);
// ── HIRE PRE-ORDERS LAND (shared by Hire Hero and the Neutral BROKER hire) ────
// The hirer's pre-written orders are applied only once the hire has landed. Matched on hero + this
// realm (an exact match on the hiring character wins if two cards were somehow submitted), so a
// rival's pre-orders for the same hero are ignored. Phases are bounded by the ACTUAL hire phase,
// not the phase the player planned to hire in. 2026-09-23 (Toby item 4): the Broker hire never
// called this — since hire pre-orders became PENDING (09-21) a brokered hero's pre-written orders
// were silently dropped, his remaining phases were left empty, and his encounter plan was never
// set. Both paths now share this one function.
export function landHirePreOrders(turnContext, h, c, ph, player) {
  const { G } = turnContext;
  // Matched on hero + this realm (an exact match on the hiring character wins if two cards
  // were somehow submitted), so a rival's pre-orders for the same hero are ignored. Phases are
  // bounded by the ACTUAL hire phase, not the phase the player planned to hire in — if the
  // hire slipped a phase, the orders for the phases he was not yet sworn are dropped.
  {
    const _ph = G._pendingHireOrders || [];
    const _pend =
      _ph.find((x) => x.heroId === h.id && x.player === c.player && x.viaId === String(c.id)) ||
      _ph.find((x) => x.heroId === h.id && x.player === c.player);
    let _applied = 0;
    if (_pend && Array.isArray(_pend.orders)) {
      const slots = G.turnOrders[h.id] || [null, null, null, null, null];
      _pend.orders.forEach((o, pi2) => {
        if (pi2 > ph && o && o.action && o.action !== 'Defend' && o.action !== 'defend') {
          slots[pi2] = o;
          _applied++;
        }
      });
      G.turnOrders[h.id] = slots;
    }
    // Step 3 of order ingestion only defaults LIVING OWNED characters to Defend, and this
    // hero belonged to nobody when it ran, so his post-hire phases were left empty and he
    // simply did nothing (no watch) for the rest of the turn. Fill them in like everyone else
    // — the same closing step Resurrect and Charm already do.
    const fin = G.turnOrders[h.id] || [null, null, null, null, null];
    for (let pz = 0; pz < 5; pz++) {
      if (pz > ph && !fin[pz]) fin[pz] = { action: 'defend', target: '', extra: '', desc: 'Defend' };
    }
    G.turnOrders[h.id] = fin;
    applyPendingSynthPlan(G, h, c.player);
    if (_applied > 0)
      emit(turnContext, {
        type: 'system',
        text: `${h.name} takes up the orders ${player.name} laid down for them — ${_applied} phase${_applied !== 1 ? 's' : ''} of this turn remain to be acted on.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: h.id,
        phase: ph,
      });
  }
}
// Recruit Armies: mercenary bands hired where they roam, then companies raised in a province the realm holds, to the recruiter, a comrade or the garrison.
export function resolveRecruitArmiesOrder(turnContext, c, ph, target, extra, prov, player) {
  const { G, recruitedThisTurn } = turnContext;
  const ARMY_COST_P = ARMY_COST_MASTER; // alias → master table at top of script
  // ── First: mercenary bands roaming this province ── The order form now lists mercenaries
  // alongside native units, tagged 'merc:<id>'. A single Recruit Armies order may therefore
  // mix the two, so mercenary tokens are consumed here and stripped from the list before
  // native recruitment runs on the remainder. (The older bare id / type / unitName tokens are
  // still accepted so orders saved by an earlier build resolve.)
  const mercsHere = (G.mercenaries || []).filter((m) => m.location === c.location);
  let _rawSel = (target || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  // ── Recruit destination ── 'to:self' (default), 'to:garrison', or 'to:<charId>' (a
  // FRIENDLY character standing in this province this phase). The token may arrive in either
  // the target or the extra list; it is stripped before unit tokens are processed.
  let _destTok =
    _rawSel.find((t) => t.startsWith('to:')) ||
    (extra || '')
      .split(',')
      .map((t) => t.trim())
      .find((t) => t.startsWith('to:'));
  _rawSel = _rawSel.filter((t) => !t.startsWith('to:'));
  let _destChar = c,
    _destGarrison = false,
    _destNote = '';
  if (_destTok && _destTok !== 'to:self') {
    if (_destTok === 'to:garrison') {
      if (prov.owner === c.player) {
        _destGarrison = true;
        _destNote = ` (mustered directly into the garrison of ${prov.name})`;
      } else _destNote = ' (garrison unavailable — province not controlled; troops join the recruiter)';
    } else {
      const _r = orderCharRef(G, _destTok.slice(3)); // plain id or pre-order hero
      if (_r && _r.alive && _r.player === c.player && _r.location === c.location) {
        _destChar = _r;
        _destNote = ` (mustered under ${_r.name}'s banner)`;
      } else _destNote = ' (chosen recipient is not here — troops join the recruiter)';
    }
  }
  const _autoGarr = []; // garrison-type recruits diverted from a character's column
  const _pushRecruit = (unit) => {
    // GARRISON UNITS GO STRAIGHT TO THE GARRISON (2026-09-23c, Toby): a Human / Elven / Dwarf /
    // Orc Garrison unit never joins a column when recruited — it musters into the garrison of the
    // province it was raised in, whatever "Muster to" names (native recruiting already needs the
    // province to be ours). A character can still march it out with Pick Up Army.
    const _toGarr = _destGarrison || (isGarrisonUnitType(unit.type) && prov.owner === c.player);
    // Item 24 (2026-10-12): a beast recruited into a column already holding as many beasts as its leader's
    // Druid musters into the garrison instead (native beasts are raised only in a province the realm holds).
    const _overCmd =
      !_toGarr &&
      prov.owner === c.player &&
      beastCommandCount(unit) &&
      beastCommandRoom(_destChar, G.characters, protoBeastRoomExtra(G, _destChar)) <= 0;
    if (_toGarr) {
      prov.garrisonArmies = prov.garrisonArmies || [];
      prov.garrisonArmies.push(unit);
      if (!_destGarrison) _autoGarr.push(unit.type);
    } else if (_overCmd) {
      prov.garrisonArmies = prov.garrisonArmies || [];
      prov.garrisonArmies.push(unit);
      emit(turnContext, {
        type: 'hire',
        text: `🐾 ${beastCommandWords(_destChar, G.characters)}: ${unit.unitName || unit.type} (${unit.type}) musters into the garrison of ${prov.name} instead.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else {
      _destChar.armies = _destChar.armies || [];
      _destChar.armies.push(unit);
    }
    // TITLE MERIT: Beastlord / Wildwarden. Credited to the RECRUITER `c`, not the recipient:
    // the merit is for finding and mustering the beast, and a hero who musters a griffon wing
    // and hands it straight to a colleague has still done the mustering. Garrison musters
    // count.
    creditBeastUnit(TM(c), unit, 1);
  };
  const _mercTokens = new Set();
  let mHired = false;
  if (mercsHere.length > 0 && _rawSel.length > 0) {
    mercsHere.forEach((merc) => {
      const tok = _rawSel.find(
        (t) => t === `merc:${merc.id}` || t === String(merc.id) || t === merc.type || t === merc.unitName,
      );
      if (!tok) return;
      _mercTokens.add(tok);
      // Item 24: a mercenary beast is not hired into a full column where there is no garrison to take it.
      if (
        !_destGarrison &&
        prov.owner !== c.player &&
        beastCommandCount({ type: merc.type }) &&
        beastCommandRoom(_destChar, G.characters, protoBeastRoomExtra(G, _destChar)) <= 0
      ) {
        emit(turnContext, {
          type: 'hire',
          text: `🐾 ${beastCommandWords(_destChar, G.characters)} — the ${merc.unitName || merc.type} mercenaries are not hired.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
        return;
      }
      const baseMercCost = ARMY_COST_P[merc.type] || 2;
      // Neutral alignment: mercenaries cost 2g less (min 1g)
      const mCost = Math.max(
        1,
        baseMercCost -
          (G.players[c.player]?.alignment === 'Neutral' ? 2 : 0) +
          discSum(turnContext, c.player, 'merc', 'delta', (e) => !e.cls || discUnitIs(e.cls, merc.type, true)),
      ); // + merc discoveries
      if ((player.gold || 0) < mCost) {
        emit(turnContext, {
          type: 'hire',
          text: `${c.name}: cannot afford ${merc.unitName || merc.type} mercenaries (${mCost}g).`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
        return;
      }
      player.gold -= mCost;
      // PROTOTYPE Neutral: Mercenary Captains — a band hired by a Neutral realm musters one quality tier higher
      const _neutralKit = protoAlignOf(G, c.player) === 'Neutral';
      const _mq = _neutralKit ? qualityUp(merc.quality) : merc.quality;
      // PROTOTYPE Neutral (round 2): a hired band is a condottiere company, fighting ×1.5 (armStr)
      _pushRecruit({
        type: merc.type,
        quality: _mq,
        race: merc.race,
        unitName: merc.unitName,
        ...(_neutralKit ? { _merc: true } : {}),
      });
      G.mercenaries = G.mercenaries.filter((m) => m.id !== merc.id);
      mHired = true;
      emit(turnContext, {
        type: 'hire',
        text: `${c.name} hires mercenary band ${merc.unitName || merc.type} (${merc.quality}) for ${mCost}g${mCost < baseMercCost ? ' (Neutral discount)' : ''}.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: c.location,
      });
    });
    if (mHired) {
      resolveUnitGainInProvince(turnContext, _destGarrison ? c : _destChar, prov, ph);
      if (!_destGarrison && _destChar) refreshMovePool(turnContext, _destChar);
    } // mercenaries joined a column — recompute its pace
  }
  // Whatever is left of the order after the mercenary tokens are removed is native
  // recruitment. a 'to:' destination token that arrived in `extra` must never be parsed as a
  // unit type (it produced a spurious "to:garrison (not raised in …)" block note).
  const _extraClean = (extra || '')
    .split(',')
    .map((s) => s.trim())
    .filter((t) => t && !t.startsWith('to:'))
    .join(',');
  const _nativeSel = (
    _extraClean ||
    _rawSel.filter((t) => !_mercTokens.has(t) && !t.startsWith('merc:')).join(',') ||
    (mHired ? '' : 'Shieldwall Levies|1')
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (_nativeSel.length === 0) return; // mercenaries only — nothing further to raise
  // Native army recruitment requires CONTROL of the province — you cannot raise local troops
  // in land you merely scouted or passed through. (Mercenaries, handled above, can be hired
  // wherever they roam.) Conquering a province this turn sets prov.owner, so that counts.
  const isOwned = prov.owner === c.player;
  if (!isOwned) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name} cannot recruit in ${prov.name} — you must control the province to raise troops there.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const selections = _nativeSel;
  let totalCost = 0;
  let recruited = [];
  let blocked = [];

  for (const sel of selections) {
    const [armyType, qtyStr] = sel.split('|');
    // A mercenary token that reached this far is stale (the band was already hired or has
    // moved on) — it must never be treated as a native army type, or it spawns a phantom "the
    // Guard (merc:merc_…, Average)" unit.
    if (armyType.startsWith('merc:') || /^merc_/.test(armyType)) continue;
    const qty = parseInt(qtyStr) || 1;
    // Primal sea beasts are called out of deep water — they can only be raised in a sea
    // province, never on a coast. (Fleets remain recruitable wherever the province offers
    // them.)
    if (PRIMAL_SEA_TYPES.has(armyType) && prov.terrain !== 'sea') {
      blocked.push(`${armyType} (can only be summoned in a sea province)`);
      continue;
    }
    // the ordered type must actually be OFFERED by the province the character is standing in
    // AT RESOLUTION. Orders are set against a predicted location, but a battle can end the
    // phase somewhere else — without this guard a character shoved into a different province
    // would still raise units that province never offered. armyTypes is the province's own
    // recruitable list (racial field units + its garrison).
    if (!(prov.armyTypes || []).includes(armyType)) {
      blocked.push(`${armyType} (not raised in ${prov.name} — that unit isn't available here)`);
      continue;
    }
    // Check turn-wide recruit limit
    if (!canRecruit(turnContext, armyType, prov.id, prov, c.player)) {
      blocked.push(`${armyType} (already recruited this turn)`);
      continue;
    }
    const limit = getRecruitLimit(turnContext, armyType, prov, c.player);
    const alreadyDone = recruitedThisTurn[`${prov.id}:${armyType}`] || 0;
    const actualQty = Math.min(qty, limit - alreadyDone);
    let _unitCost = realmRecruitCost(G.players[c.player], armyType, ARMY_COST_P[armyType] || 2); // sd16 + recruitCost discoveries
    if (perkTier(c, 'druid') > 0 && (CREATURE_ARMIES.has(armyType) || MONSTER_ARMIES.has(armyType)))
      _unitCost = Math.floor(_unitCost * 0.5); // DRUID L6: creatures/monsters cost half (rounded down)
    const unitCost = _unitCost;
    const cost = actualQty * unitCost;
    if ((player.gold || 0) < totalCost + cost) {
      blocked.push(`${armyType} (insufficient gold: need ${cost}g more)`);
      continue;
    }
    totalCost += cost;
    for (let q = 0; q < actualQty; q++) {
      // sd01 Superior Forging: recruited armies start at Veteran
      // PROTOTYPE Druidic / Evil: a beast raised in a held wild province of the realm's own kind musters as a Veteran
      const _kitVet =
        String(prov.race || '').startsWith('Primal') &&
        ((protoAlignOf(G, c.player) === 'Druidic' && CREATURE_ARMIES.has(armyType)) ||
          (protoAlignOf(G, c.player) === 'Evil' && MONSTER_ARMIES.has(armyType)));
      const startQuality =
        _kitVet ||
        (gdActive(turnContext, c.player, 'Druidic') &&
          (CREATURE_ARMIES.has(armyType) || MONSTER_ARMIES.has(armyType))) ||
        kcRng() < discRecruitQChance(G.players[c.player], armyType)
          ? 'Veteran'
          : 'Average'; // GRAND DESIGN Druidic; recruitQ discoveries (sd01 Superior Forging …) roll per unit
      // Whale Cohorts and Shark Shoals are wild sea beasts — always the Primal race, whoever raises them.
      const recruitRace = armyType === 'Whale Cohort' || armyType === 'Shark Shoals' ? 'Primal' : prov.race || 'Human';
      _pushRecruit({ type: armyType, quality: startQuality, race: recruitRace, unitName: armyUnitName(armyType) });
      if (!HUMANOID_RACES_SG.has(recruitRace) && !_destGarrison)
        trySkillGain(turnContext, _destChar, 'druid', SKILLGAIN_STD); // Druid: led a non-humanoid recruit
      else if (CREATURE_ARMIES.has(armyType) || MONSTER_ARMIES.has(armyType))
        trySkillGain(turnContext, _destGarrison ? c : _destChar, 'druid', SKILLGAIN_COMMON); // 2026-09-21: any primal recruit (incl. into a garrison) — small chance for the recruiter
    }
    recordRecruit(turnContext, armyType, prov.id, actualQty);
    recruited.push(`${actualQty}× ${armyType}`);
  }
  if (recruited.length > 0) {
    player.gold -= totalCost;
    const _agN = _autoGarr.length,
      _autoGarrNote = _agN
        ? `; ${_agN} garrison unit${_agN !== 1 ? 's' : ''} muster${_agN === 1 ? 's' : ''} straight into the garrison of ${prov.name}`
        : '';
    emit(turnContext, {
      type: 'hire',
      text:
        `${c.name} recruits ${recruited.join(', ')} in ${prov.name}${_destNote}${_autoGarrNote}. Cost: ${totalCost}g. Treasury: ${player.gold}g remaining.` +
        (blocked.length > 0 ? ` (Blocked: ${blocked.join('; ')}.)` : ''),
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    // if the muster went to ANOTHER of the player's characters, notify them in their section.
    if (!_destGarrison && _destChar && _destChar.id !== c.id)
      notifyTarget(
        turnContext,
        _destChar,
        `⚔ ${recruited.join(', ')} muster to ${_destChar.name}'s banner in ${prov.name}, raised by ${c.name}.`,
        ph,
        'hire',
      );
    // Newly-mustered units join the destination character's column — recompute their pace (a
    // slow recruit can only reduce it), preserving points already spent. Garrison musters
    // don't march.
    if (!_destGarrison && _destChar) refreshMovePool(turnContext, _destChar);
  } else {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}'s recruitment in ${prov.name} was entirely blocked: ${blocked.join('; ')}.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
  }
  return;
}
// Hire Hero: a wandering hero where the hirer stands, for a wage set by the distance between their alignments.
export function resolveHireHeroOrder(turnContext, c, ph, target, prov, player) {
  const { G, SEASONS } = turnContext;
  // resolve the hero by id, not by array position (defensive — the id==index invariant holds
  // today, but a positional lookup would silently hire the WRONG hero if it ever broke).
  const heroId = parseInt(target);
  const h = Number.isInteger(heroId) ? (G.characters || []).find((x) => x && x.id === heroId) || null : null;
  if (!h || h.player !== null || h.location !== c.location) {
    emit(turnContext, {
      type: 'hire',
      text: `${c.name} tries to hire a hero but none matching that description are available in ${prov.name}.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (h._isNeutralGuard) {
    emit(turnContext, {
      type: 'hire',
      text: `${h.name} is sworn to defend ${prov.name} and will not abandon their post — the guardian of a neutral province cannot be hired away. You must defeat them in battle to take the province.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (h._justDefeated) {
    emit(turnContext, {
      type: 'hire',
      text: `${h.name} is furious at being driven from their home — they refuse to work with you this turn. Try again next turn.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (h._releasedTurn === G.turn) {
    emit(turnContext, {
      type: 'hire',
      text: `${h.name} was only just released from service and will hear no offers this turn. Try again next turn.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // ── Alignment-distance wages ── replaces the old race-based 2g/3g system. Wage = 2g + 1g
  // per 2 steps between the hero's alignment and the hiring KINGDOM's alignment on the
  // Divine…Undead spectrum. Divine realms cannot hire Undead heroes and vice versa (distance
  // 6) — unless sd31 Diplomatic Protocols waives the ban (at 5g).
  const kingdomAlign = G.players[c.player]?.alignment || 'Neutral';
  const _waiveBan = hasDisc(turnContext, c.player, 'sd31');
  const hireWage = h.player === null ? heroHireWage(kingdomAlign, h.alignment, _waiveBan, h) : h.pay || 1;
  if (hireWage == null) {
    emit(turnContext, {
      type: 'hire',
      text: `${h.name} (${h.alignment}) recoils from ${c.name}'s offer — ${kingdomAlign === 'Divine' ? 'no creature of the grave will serve a Divine crown' : 'the faithful will never serve an Undead throne'}. (Alignment gulf too wide: Divine and Undead cannot hire one another.)`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if ((player.gold || 0) < hireWage) {
    emit(turnContext, {
      type: 'hire',
      text: `${c.name} cannot afford to hire ${h.name} — needs ${hireWage}g/turn, treasury has only ${player.gold}g.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  h.pay = hireWage;
  // remember the ALIGNMENT part of the bargain (wage minus the skill premium). recalcHeroPay
  // rebuilds the wage from skills whenever the hero improves in service, and without this the
  // alignment premium a Divine crown paid for an Undead sword would vanish on their first
  // skill rise.
  h._hireAlignWage = Math.max(1, hireWage - heroSkillWage(h));
  player.gold -= hireWage;
  h.player = c.player;
  h.name = h.name.replace(' (wandering)', '');
  if (h.race === 'Dwarven' && G.players[c.player]?.race === 'Dwarven') grantMithrilTo(h, G); // mithril on hire into a dwarf realm
  player.heroes = player.heroes || [];
  player.heroes.push(h.id);
  // Hero can receive orders starting the phase AFTER they were hired (AK 3.5) We mark the
  // hire phase so the turn report knows which phases they can act in
  h.hiredInPhase = ph;
  if (!G.turnOrders[h.id]) G.turnOrders[h.id] = [null, null, null, null, null];
  // Default unfilled phases (before hire) to a "not yet hired" placeholder
  for (let p2 = 0; p2 <= ph; p2++)
    G.turnOrders[h.id][p2] = G.turnOrders[h.id][p2] || {
      action: 'defend',
      target: '',
      extra: '',
      desc: '(not yet hired)',
    };
  // ── 2026-09-21: the hirer's pre-written orders are applied HERE, now the hire has landed.
  // (2026-09-23: moved into landHirePreOrders so the Neutral BROKER hire applies them too.)
  landHirePreOrders(turnContext, h, c, ph, player);
  setMovePool(turnContext, h); // give the newly hired hero a movement pool for this turn (item: hired heroes had 0 MP)
  const _aDist = alignDistP(kingdomAlign, h.alignment);
  // Both hire paths now say which it is.
  const _hActs = `They may act from ${SEASONS[ph + 1] || 'next turn'} onwards.`;
  const _hireLine = `${h.name} (${h.race}, ${h.alignment}) agrees to serve ${player.name} for ${h.pay}g/turn (${_aDist === 0 ? 'kindred spirits — base rate' : _aDist <= 1 ? 'close in outlook — base rate' : `${_aDist} steps across the alignment spectrum`}). Skills: ${
    Object.entries(h.skills || {})
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${SKILL_LABELS[k] || k} ${v}`)
      .join(', ') || 'none yet'
  }. ${_hActs}`;
  emit(turnContext, {
    type: 'hire',
    text: _hireLine,
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  // also file the same line under the HIRED hero's own Chronicle section, at the hire phase,
  // so their section opens by explaining when and how they entered service.
  emit(turnContext, {
    type: 'hire',
    text: _hireLine,
    audience: { actor: c.player, realms: [c.player] },
    province: prov.id,
    hero: h.id,
    phase: ph,
  });
  return;
}
