// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { beastCommandCount, beastCommandRoom, beastCommandWords } from '../world/tables.ts';
import { heroSkillWage } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { isPreOrderRef, noteServedRealm, orderCharRef } from '../heroes/charms-and-neutrals.ts';
import { notifyTarget } from '../turn/events-and-their-audiences.ts';
import { newMercId } from '../turn/mercenary-ids-and-battle-records.ts';
import { isOpenSea, seaLiftShortfall, strandLabel } from '../units/sea-lift-stranding-and-retreats.ts';
import { refreshMovePool } from '../units/movement-pools.ts';

// ── THE ARMY ORDERS (plan P1-08j5: the fifth family taken out of processOrder in resolveTurn) ──
// Leave/Transfer Army (companies handed to a comrade beside him, or left in the garrison of a province the realm
// holds), Release Hero (a hero leaves the realm's service a wanderer), Disband Army (companies become bands of
// mercenaries) and Pick Up Army (companies taken from the garrison, or by an old order from a comrade), each once
// processOrder has read the order and checked he may act (a hero held by an enchantment won't disband). Each takes the
// turn's context first (src/engine/turn/context.ts), then the values processOrder worked out before it that it reads,
// in the order processOrder declares them. Each body keeps processOrder's indent (plan P1-08's Decisions); a
// case-level break became a return.
// Leave/Transfer Army: companies handed to a comrade beside him, or left in the garrison of a province the realm holds.
export function resolveLeaveOrTransferArmyOrder(turnContext, c, ph, target, extra, prov) {
  const { G, log, movePoints, seaMovePoints } = turnContext;
  // a pre-order hero's synthetic id is a CHARACTER recipient — parseInt gave NaN, which fell
  // through to the garrison branch and quietly garrisoned the troops (2026-09-23).
  const _synRecip = isPreOrderRef(extra);
  const recipId = _synRecip ? ((orderCharRef(G, extra) || {}).id ?? -99) : parseInt(extra);
  if ((c.armies || []).length === 0) {
    log('system', `${c.name}: no armies to transfer.`, { actor: c.player, targets: [c.player] });
    return;
  }
  // ── Validate the recipient BEFORE moving any troops ──
  const recip2 = _synRecip ? orderCharRef(G, extra) : recipId >= 0 ? G.characters[recipId] : null;
  if (recipId >= 0 || _synRecip) {
    // Transfer to another character: must be one of THIS player's own living characters,
    // standing in the same province. Never a neutral hero or another player's character.
    if (!recip2 || !recip2.alive || recip2.player !== c.player || recip2.location !== c.location) {
      // Name where they went: the commonest cause is a general on Defend who rode out to a
      // threatened neighbour at the top of the phase, before this transfer resolved.
      const _rp =
        recip2 && recip2.alive && recip2.player === c.player && recip2.location != null
          ? G.world.provinces[recip2.location]
          : null;
      log(
        'system',
        _rp
          ? `${c.name} cannot hand the troops to ${recip2.name} — they had already marched on to ${_rp.name} before the column could be handed over. The troops stay under ${c.name}'s command.`
          : `${c.name} cannot transfer armies — the recipient must be one of your own characters standing in ${prov.name}.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
      return;
    }
  } else {
    // Garrison: only allowed in a province the player actually controls.
    if (prov.owner !== c.player) {
      log(
        'system',
        `${c.name} cannot garrison armies in ${prov.name} — you do not control this province, so there is no garrison to leave them in. The troops stay under their command.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
      return;
    }
  }
  const _leaveOrig = (c.armies || []).slice(); // restored if the transfer would leave anyone unshipped at sea
  let removed = [];
  if (target === 'all') {
    removed = [...c.armies];
    c.armies = [];
  } else {
    // Comma-separated list of army types to leave
    const targets = target
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    targets.forEach((t) => {
      if (t === 'all') {
        removed.push(...c.armies);
        c.armies = [];
      } else {
        const idx = c.armies.findIndex((a) => a.type === t || a.unitName === t);
        if (idx >= 0) removed.push(...c.armies.splice(idx, 1));
      }
    });
  }
  if (removed.length === 0) {
    log('system', `${c.name}: could not find specified armies to transfer.`, { actor: c.player, targets: [c.player] });
    return;
  }
  // 2026-09-23c (Toby): on open water nobody may be left unshipped — refuse a transfer that
  // leaves the giver's remaining column, or the recipient's, with too few hulls to carry it.
  if (isOpenSea(prov)) {
    const _gShort = seaLiftShortfall(c.armies || [], c) > 0;
    const _rShort = recip2 ? seaLiftShortfall((recip2.armies || []).concat(removed), recip2) > 0 : false;
    if (_gShort || _rShort) {
      c.armies = _leaveOrig;
      const _lbl = removed.map((a) => a.unitName || a.type).join(', ');
      log(
        'system',
        `⚓ ${c.name} cannot ${recip2 ? `hand ${_lbl} to ${recip2.name}` : `leave ${_lbl} in ${prov.name}`} out on open water — ${_gShort ? `the ships that stay would be too few to carry the rest of ${c.name}'s column` : `${recip2.name}'s ships could not carry them`}. The order is refused and the troops stay where they are.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
      return;
    }
  }

  // (Move-pool recomputation after the transfer is handled by refreshMovePool below, which fully
  // recomputes land + sea pools and sea capability from the remaining force — superseding the
  // old partial sea-only un-stick. In particular a MIXED force that becomes all-flying after
  // a land army is peeled off regains its sea reach, and a force that sheds a slow unit
  // regains pace.)

  // Skeletal armies refuse to follow non-Undead commanders
  const recipIsUndead2 =
    !recip2 ||
    recip2.alignment === 'Undead' ||
    (recip2.player !== null && G.players[recip2.player]?.alignment === 'Undead');
  const skelTransfer = removed.filter((a) => a._isSkeletal);
  if (skelTransfer.length > 0 && !recipIsUndead2) {
    log(
      'system',
      `💀 ${skelTransfer.map((a) => a.unitName || a.type).join(', ')} refuse to follow a non-Undead commander — they dig their own graves and go to sleep.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    removed = removed.filter((a) => !a._isSkeletal); // remove skeletal from transfer
    if (removed.length === 0) return; // nothing left to transfer
  }

  // Item 24 (2026-10-12): beasts beyond the recipient's Druid stay with the giver.
  if (recip2) {
    let _room = beastCommandRoom(recip2, G.characters);
    const _stay = [];
    removed = removed.filter((a) => {
      if (!beastCommandCount(a)) return true;
      if (_room > 0) {
        _room--;
        return true;
      }
      _stay.push(a);
      return false;
    });
    if (_stay.length) {
      c.armies = (c.armies || []).concat(_stay);
      log(
        'hire',
        `🐾 ${beastCommandWords(recip2, G.characters)}: ${_stay.map((a) => a.unitName || a.type).join(', ')} ${_stay.length === 1 ? 'stays' : 'stay'} with ${c.name}.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
      if (!removed.length) {
        refreshMovePool(turnContext, c);
        return;
      }
    }
  }
  if (recip2) {
    recip2.armies = (recip2.armies || []).concat(removed);
    log('hire', `${c.name} transfers ${removed.map((a) => a.unitName || a.type).join(', ')} to ${recip2.name}.`, {
      actor: c.player,
      targets: [c.player],
      provinceId: prov.id,
    });
    // notify the receiving commander in their own section.
    notifyTarget(
      turnContext,
      recip2,
      `⚔ ${recip2.name} takes command of ${removed.map((a) => a.unitName || a.type).join(', ')}, handed over by ${c.name} in ${prov.name}.`,
      ph,
      'hire',
    );
    // Recompute BOTH move pools for giver and recipient: the giver may now be faster (a slow
    // unit left) and the recipient may now be slower (a slow unit joined). refreshMovePool
    // preserves points already spent this turn, so neither refunds nor double-charges moves.
    refreshMovePool(turnContext, c);
    refreshMovePool(turnContext, recip2);
    return;
  }
  prov.garrisonArmies = (prov.garrisonArmies || []).concat(removed);
  log('hire', `${c.name} garrisons ${removed.map((a) => a.type).join(', ')} in ${prov.name}.`, {
    actor: c.player,
    targets: [c.player],
    provinceId: prov.id,
  });
  // Recompute the move pool from the REMAINING force. Dropping a slow unit correctly frees up
  // the faster pace for the rest of the turn; dropping ALL armies gives foot-passage (land 5
  // / sea 5), which is why a hero who hands off his whole army can still march — including
  // onto the sea. Points already spent this turn are preserved.
  refreshMovePool(turnContext, c);
  if ((c.armies || []).length === 0) {
    log(
      'move',
      `${c.name} left all armies behind in ${prov.name} — now travelling light (land ${movePoints[c.id]}, sea ${seaMovePoints[c.id]} move points).`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
  }
  return;
}
// Release Hero: a hero leaves the realm's service a wanderer, with what he carries.
export function resolveReleaseHeroOrder(turnContext, c, ph, prov, player) {
  const { log, G } = turnContext;
  // ── RELEASE HERO ── dismiss a hero from the realm's service. They become an ordinary
  // wandering hero (player===null, not a guard), keep every magic item they carry, keep their
  // skills/HP, and can be hired by anyone from NEXT turn (never re-hired the same turn they
  // were let go). Refused for kings and for a hero still leading any army — the troops must
  // be transferred, garrisoned or disbanded first. The hero's remaining orders this turn are
  // dropped.
  if (c.isKing) {
    log('system', `${c.name} wears the crown — a king cannot release himself from his own service.`, {
      actor: c.player,
      targets: [c.player],
    });
    return;
  }
  if (c.player == null) {
    return;
  }
  if ((c.armies || []).length > 0) {
    log(
      'system',
      `${c.name} cannot be released while leading ${c.armies.length} unit${c.armies.length !== 1 ? 's' : ''} — transfer, garrison or disband the troops first.`,
      { actor: c.player, targets: [c.player] },
    );
    return;
  }
  const _relPi = c.player,
    _relPl = player;
  const _itemNote = (c.items || []).length
    ? ` They take ${(c.items || [])
        .map((it) => it && it.name)
        .filter(Boolean)
        .join(', ')} with them.`
    : '';
  if (_relPl) {
    _relPl.heroes = (_relPl.heroes || []).filter((id) => id !== c.id);
  }
  noteServedRealm(c, c.player); // the releasing realm stays in their service history
  c.player = null;
  c._isNeutralGuard = false;
  delete c._isHeir;
  delete c.hiredInPhase;
  delete c._pursuit;
  c._releasedTurn = G.turn;
  c._releasedBy = _relPi;
  delete c._hireAlignWage;
  c.pay = Math.max(1, 1 + heroSkillWage(c)); // wandering default; the real asking price is rebuilt at the hire desk (alignment + skill premium)
  if (G.turnOrders[c.id]) for (let p2 = ph + 1; p2 < 5; p2++) G.turnOrders[c.id][p2] = null;
  log(
    'hire',
    `🕊 ${c.name} is released from ${_relPl ? _relPl.name : 'the realm'}'s service in ${prov.name} and takes up the wanderer's life.${_itemNote} They may be hired again from next turn.`,
    { actor: _relPi, targets: [_relPi], provinceId: prov.id, charId: c.id, phase: ph },
  );
  return;
}
// Disband Army: companies become bands of mercenaries where he stands (the risen dead crumble).
export function resolveDisbandArmyOrder(turnContext, c, target, prov) {
  const { log, G, movePoints, seaMovePoints } = turnContext;
  // Disband armies — they become wandering mercenaries (skeletal armies just die)
  if ((c.armies || []).length === 0) {
    log('system', `${c.name}: no armies to disband.`, { actor: c.player, targets: [c.player] });
    return;
  }
  let disbanding = [];
  if (target === 'all') {
    disbanding = [...c.armies];
    c.armies = [];
  } else {
    const targets = target
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    targets.forEach((t) => {
      const idx = c.armies.findIndex((a) => a.type === t || a.unitName === t);
      if (idx >= 0) disbanding.push(...c.armies.splice(idx, 1));
    });
  }
  if (disbanding.length === 0) {
    log('system', `${c.name}: could not find specified armies to disband.`, { actor: c.player, targets: [c.player] });
    return;
  }

  // Skeletal armies cannot become mercenaries — they return to death
  const skelDisbanded = disbanding.filter((a) => a._isSkeletal);
  if (skelDisbanded.length > 0) {
    log(
      'system',
      `💀 ${skelDisbanded.map((a) => a.unitName || a.type).join(', ')} cannot be disbanded as mercenaries — skeletal armies return to their graves and crumble to dust.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    disbanding = disbanding.filter((a) => !a._isSkeletal);
    if (disbanding.length === 0) return;
  }

  // Create mercenary army objects in the province
  if (!G.mercenaries) G.mercenaries = [];
  const SEA_TYPES_D = new Set(KC_UNIT_CLASS.sea);
  disbanding.forEach((army) => {
    const merc = {
      id: newMercId(turnContext),
      type: army.type,
      quality: army.quality,
      race: army.race || 'Human',
      unitName: army.unitName || army.type,
      location: prov.id,
      isSea: SEA_TYPES_D.has(army.type),
    };
    G.mercenaries.push(merc);
    log(
      'hire',
      `${c.name} disbands ${army.unitName || army.type} (${army.quality}) — they become a mercenary band in ${prov.name}.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
  });

  // Recompute the move pool from the remaining force — disbanding a slow unit frees up pace
  // for the rest of the turn, and disbanding everything restores foot-passage (land 5 / sea
  // 5). Points already spent this turn are preserved.
  refreshMovePool(turnContext, c);
  if ((c.armies || []).length === 0) {
    log(
      'move',
      `${c.name} has disbanded all armies — now travelling light (land ${movePoints[c.id]}, sea ${seaMovePoints[c.id]} move points).`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
  }
  return;
}
// Pick Up Army: companies taken from the garrison where he stands (or, by an old order, from a comrade), as many as his Druid and his ships allow.
export function resolvePickUpArmyOrder(turnContext, c, target, prov) {
  const { log, G, movePoints, seaMovePoints } = turnContext;
  const _pickBefore = (c.armies || []).slice();
  let _pickSrc = null; // for the at-sea capacity check below
  if ((target || '').toString().trim().toLowerCase() === 'all') {
    // Pick up ALL unled (garrison) armies in the province.
    const garr = prov.garrisonArmies || [];
    if (garr.length === 0) {
      log('system', `${c.name} finds no garrison armies in ${prov.name} to pick up.`, {
        actor: c.player,
        targets: [c.player],
      });
      return;
    }
    const n = garr.length;
    c.armies = c.armies || [];
    while (garr.length > 0) {
      c.armies.push(garr.pop());
    }
    prov.garrisonArmies = [];
    log('hire', `${c.name} takes command of all ${n} garrisoned unit${n !== 1 ? 's' : ''} in ${prov.name}.`, {
      actor: c.player,
      targets: [c.player],
      provinceId: prov.id,
    });
  } else if (
    String(target || '')
      .trim()
      .toLowerCase()
      .startsWith('merc:')
  ) {
    // mercenaries are NO LONGER pickable via Pick Up Army — they answer to gold, not to the
    // ground, and are taken into service through Recruit Armies. The order form no longer
    // offers them; this branch only catches a stale saved order and declines it rather than
    // silently spending the treasury on a band the player can no longer see.
    log(
      'system',
      `${c.name} cannot simply take up a mercenary band with a Pick Up order — mercenaries are hired through Recruit Armies. (Pick Up Army takes only unled garrison units.)`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    return;
  } else if (/(^|,)\s*g:\d+/i.test(String(target || ''))) {
    // pick up a SELECTION of unled garrison units by index. The player form now offers
    // checkboxes and emits a comma-separated list like "g:0,g:2". Splice from the highest
    // index down so earlier removals don't shift the indices still to be taken.
    const garr = prov.garrisonArmies || [];
    const idxs = String(target)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^g:\d+$/i.test(s))
      .map((s) => parseInt(s.slice(2)));
    const uniq = [...new Set(idxs)]
      .filter((i) => Number.isInteger(i) && i >= 0 && i < garr.length)
      .sort((a, b) => b - a);
    if (uniq.length === 0) {
      log('system', `${c.name} finds no matching garrison armies in ${prov.name} to pick up.`, {
        actor: c.player,
        targets: [c.player],
        provinceId: prov.id,
      });
      return;
    }
    const picked = [];
    uniq.forEach((i) => {
      picked.push(...garr.splice(i, 1));
    });
    c.armies = c.armies || [];
    picked.forEach((a) => c.armies.push(a));
    const _lbl = picked
      .map((a) => (a.unitName ? a.unitName + ' (' + a.quality + ' ' + a.type + ')' : a.quality + ' ' + a.type))
      .join(', ');
    log('hire', `${c.name} takes command of ${_lbl} from the garrison in ${prov.name}.`, {
      actor: c.player,
      targets: [c.player],
      provinceId: prov.id,
    });
  } else {
    // Legacy paths: a numeric character id (take an army from another of your characters), or
    // the old "-1[:i]" form (take one garrison unit). Kept for backward-compat with stale saved
    // orders.
    const srcId = parseInt(target);
    if (srcId >= 0) {
      const src = G.characters[srcId];
      // `!src.alive` added. Without it a stale saved order could strip the armies off a comrade
      // who fell EARLIER THIS TURN — the one order besides Resurrect that could still reach a
      // dead character. A fallen commander's troops are handled by the death routine (they
      // scatter or pass to the king); they are not there to be picked up.
      if (
        !src ||
        !src.alive ||
        src.location !== c.location ||
        src.player !== c.player ||
        (src.armies || []).length === 0
      ) {
        log('system', `${c.name}: cannot pick up army.`);
        return;
      }
      const army = src.armies.pop();
      c.armies = c.armies || [];
      c.armies.push(army);
      _pickSrc = src;
      log(
        'hire',
        `${c.name} takes command of ${army.unitName ? army.unitName + ' (' + army.quality + ' ' + army.type + ')' : army.quality + ' ' + army.type} from ${src.name}.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
    } else {
      const army = (prov.garrisonArmies || []).pop();
      if (!army) {
        log('system', `${c.name} finds no garrison armies in ${prov.name} to pick up.`, {
          actor: c.player,
          targets: [c.player],
        });
        return;
      }
      c.armies = c.armies || [];
      c.armies.push(army);
      log(
        'hire',
        `${c.name} picks up ${army.unitName ? army.unitName + ' (' + army.quality + ' ' + army.type + ')' : army.quality + ' ' + army.type} from the garrison in ${prov.name}.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
    }
  }
  // Item 24 (2026-10-12): beasts taken up beyond the leader's Druid go back where they came from.
  {
    const _new = (c.armies || []).filter((a) => !_pickBefore.includes(a));
    let _room = beastCommandRoom({ ...c, armies: _pickBefore }, G.characters);
    const _keepN = [],
      _backB = [];
    _new.forEach((a) => {
      if (beastCommandCount(a)) {
        if (_room > 0) {
          _room--;
          _keepN.push(a);
        } else _backB.push(a);
      } else _keepN.push(a);
    });
    if (_backB.length) {
      c.armies = _pickBefore.concat(_keepN);
      if (_pickSrc) _pickSrc.armies = (_pickSrc.armies || []).concat(_backB);
      else prov.garrisonArmies = (prov.garrisonArmies || []).concat(_backB);
      log(
        'hire',
        `🐾 ${beastCommandWords(c, G.characters)}: ${_backB.map((a) => a.unitName || a.type).join(', ')} ${_backB.length === 1 ? 'stays' : 'stay'} ${_pickSrc ? `with ${_pickSrc.name}` : `in the garrison of ${prov.name}`}.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
    }
  }
  // 2026-09-23c (Toby): at sea a character takes aboard only what his ships (and flyers) can
  // carry — units taken in order while they fit; the rest go back where they came from.
  if (isOpenSea(prov) && seaLiftShortfall(c.armies || [], c) > 0) {
    const _new = (c.armies || []).filter((a) => !_pickBefore.includes(a)),
      _keep = _pickBefore.slice(),
      _back = [];
    _new.forEach((a) => {
      if (seaLiftShortfall(_keep.concat([a]), c) === 0) _keep.push(a);
      else _back.push(a);
    });
    c.armies = _keep;
    if (_back.length) {
      if (_pickSrc) _pickSrc.armies = (_pickSrc.armies || []).concat(_back);
      else prov.garrisonArmies = (prov.garrisonArmies || []).concat(_back);
      log(
        'hire',
        `⚓ ${_back.map(strandLabel).join(', ')} cannot be taken aboard — ${c.name}'s ships have no room for them on open water, so ${_back.length === 1 ? 'it stays' : 'they stay'} ${_pickSrc ? `with ${_pickSrc.name}` : `in the garrison of ${prov.name}`}.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id },
      );
    }
  }
  // Recompute the move pool from the new force — picking up a slow army reduces pace. Uses
  // the shared computation (so March/Naval/Swift bonuses apply consistently) and preserves
  // points already spent this turn.
  refreshMovePool(turnContext, c);
  log(
    'move',
    `${c.name} now leads ${(c.armies || []).length} arm${(c.armies || []).length !== 1 ? 'ies' : 'y'}. Land MPs: ${movePoints[c.id]}, Sea MPs: ${seaMovePoints[c.id]}.`,
    { actor: c.player, targets: [c.player] },
  );
  return;
}
