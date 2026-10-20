import { KC_QUALITY_UP } from '../../content/kingdoms-call-data.ts';
import { ITEM_SLOT_CAP, gainedItemNote, itemSlot, normaliseEquipment } from '../items/equipment.ts';
import { syncMaxHp } from '../heroes/skills-and-hp.ts';
import { applyItemMaxHp, isMithril } from '../personal-combat/helpers.ts';
import { isCharmedNow, isPreOrderRef, orderCharRef } from '../heroes/charms-and-neutrals.ts';
import { notifyTarget } from '../turn/log-line-helpers.ts';
import { SKILLGAIN_COMMON, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';

// ── THE ITEM ORDERS (plan P1-08j5: the fifth family taken out of processOrder in resolveTurn) ──
// Equip Items (which of the items a hero carries he wears or wields, a slot's limit kept), Use Item (an active magic
// item invoked: the Philosopher's Stone; a passive one needs no using) and Send Item (items handed to one of the
// realm's own heroes, at once beside him or by courier by the turn's end), each once processOrder has read the order
// and checked he may act (a spell item's Use Item became a Cast Spell there first). Each takes the turn's context
// first (src/engine/turn/context.ts), then the values processOrder worked out before it that it reads, in the order
// processOrder declares them. Each body keeps processOrder's indent (plan P1-08's Decisions); a case-level break became
// a return.
// Equip Items: the items named are worn or wielded, the rest taken off, a slot's limit kept (the first named wins); a slot left with room is filled again with the first item held.
export function resolveEquipItemsOrder(turnContext, c, target) {
  const { log } = turnContext;
  // choose which slot items are worn/wielded. target = comma-separated item names (or ids) to
  // equip. Every slot item NOT named is unequipped; slot caps are enforced (first named
  // wins), and normaliseEquipment then fills any slot left empty with the first item held.
  const want = String(target || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const slotItems = (c.items || []).filter((it) => it && itemSlot(it));
  if (slotItems.length === 0) {
    log('system', `${c.name} carries nothing that can be worn or wielded.`, { actor: c.player, targets: [c.player] });
    return;
  }
  slotItems.forEach((it) => {
    it.equipped = false;
  });
  const cnt = {};
  const donned = [];
  const refused = [];
  want.forEach((w) => {
    const it = slotItems.find((x) => String(x.id) === w || x.name === w);
    if (!it) return;
    const sl = itemSlot(it);
    if ((cnt[sl] || 0) >= ITEM_SLOT_CAP[sl]) {
      refused.push(it.name);
      return;
    }
    it.equipped = true;
    cnt[sl] = (cnt[sl] || 0) + 1;
    donned.push(it.name);
  });
  normaliseEquipment(c);
  const worn = (c.items || [])
    .filter((it) => it && itemSlot(it) && it.equipped)
    .map((it) => `${it.name} [${itemSlot(it)}]`);
  log(
    'system',
    `\u{1F6E1} ${c.name} arms and dresses for the season — now wearing: ${worn.join(', ') || 'nothing'}.${refused.length ? ` Could not also wear ${refused.join(', ')} (slot already filled).` : ''}`,
    { actor: c.player, targets: [c.player] },
  );
  return;
}
// Use Item: an active magic item invoked (the Philosopher's Stone); a passive one needs no using.
export function resolveUseItemOrder(turnContext, c, target, prov) {
  const { G, log } = turnContext;
  // Trigger an ACTIVE magic item (one that must be invoked, not a passive bonus).
  // 2026-09-24 (Toby): not while charmed. An enchanted mind fights with what it carries — its
  // passive magic works as ever — but will not be made to spend a treasure on a stranger's
  // errand. Refused here as well as hidden on the form, since `target` is matched by NAME and a
  // crafted order would otherwise let a charmer probe the pack by reading the result.
  if (isCharmedNow(G, c)) {
    log(
      'system',
      `${c.name} will not spend what they carry at another's bidding — a mind held by enchantment keeps its treasures to itself.`,
      { actor: c.player, targets: [c.player], charId: c.id },
    );
    return;
  }
  const it = (c.items || []).find((x) => String(x.id) === String(target) || x.name === target);
  if (!it) {
    log('system', `${c.name}: no such item to use.`, { actor: c.player, targets: [c.player] });
    return;
  }
  if (it._spent) {
    log('system', `The ${it.name} has already been used.`, { actor: c.player, targets: [c.player] });
    return;
  }
  const st = it.effect?.stat;
  if (st === 'massPromote') {
    // ── PHILOSOPHER'S STONE ────
    // Once per game: promote EVERY unit of the realm one quality tier — those marching under
    // your commanders AND those standing in your garrisons. Skeletal armies are excluded; the
    // dead do not advance in experience.
    // BUG FIXED: the garrison sweep read `pv.garrison`, a field that does not exist — the
    // engine's unled units live in `pv.garrisonArmies` everywhere else. Garrison troops were
    // therefore NEVER promoted, and a realm whose strength sat in its garrisons could invoke
    // the Stone and see almost nothing happen.
    const UP = { ...KC_QUALITY_UP };
    const _promote = (arr) => {
      let k = 0;
      (arr || []).forEach((a) => {
        if (a && !a._isSkeletal && UP[a.quality] && UP[a.quality] !== a.quality) {
          a.quality = UP[a.quality];
          k++;
        }
      });
      return k;
    };
    let led = 0,
      garr = 0,
      already = 0;
    const _count = (arr) => (arr || []).filter((a) => a && !a._isSkeletal).length;
    let total = 0;
    (G.characters || [])
      .filter((ch) => ch.alive && ch.player === c.player)
      .forEach((ch) => {
        total += _count(ch.armies);
        led += _promote(ch.armies);
      });
    (G.world.provinces || []).forEach((pv) => {
      if (pv && pv.owner === c.player) {
        total += _count(pv.garrisonArmies);
        garr += _promote(pv.garrisonArmies);
      }
    });
    const n = led + garr;
    already = total - n;
    // A once-per-game treasure is not spent on nothing: if there is not a single unit it
    // could raise, the Stone stays unused and the player is told why.
    if (n === 0) {
      log(
        'system',
        `${c.name} raises the ${it.name}, but there is nothing for it to work on — ${total === 0 ? 'your realm has no armies in the field or in garrison' : 'every unit you command is already Elite'}. The Stone is NOT spent, and may be invoked another turn.`,
        { actor: c.player, targets: [c.player] },
      );
      return;
    }
    // ── CONSUMED ── the Stone is not merely spent, it is GONE: the working destroys it.
    // Struck from the bearer's pack so it can never be used, sent, stolen, looted from a
    // corpse or equipped again, and its name stays on G._awardedItems (the permanent ledger
    // every item roll checks) so no lair can ever yield another.
    const _stoneName = it.name;
    c.items = (c.items || []).filter((x) => x !== it && String(x.id) !== String(it.id));
    syncMaxHp(c); // an item leaving the pack can change derived stats; re-sync to be safe
    if (!Array.isArray(G._awardedItems)) G._awardedItems = [];
    if (!G._awardedItems.includes(_stoneName)) G._awardedItems.push(_stoneName);
    // Lair hoards are decided at world generation, so an unfound copy could still be lying in
    // the ground. The narrative below tells every realm the Stone is gone from the world for
    // good — so make that true: strike any undiscovered copy from every hoard as well. (A
    // copy already carried by a character is left alone; that one exists and was won.)
    let _purged = 0;
    (G.world.provinces || []).forEach((pv) => {
      if (!pv) return;
      (pv.features || []).forEach((f) => {
        if (!f || !Array.isArray(f.hoardItems)) return;
        const before = f.hoardItems.length;
        f.hoardItems = f.hoardItems.filter((x) => !(x && x.name === _stoneName));
        _purged += before - f.hoardItems.length;
      });
    });
    if (_purged > 0)
      log(
        'system',
        `(GM note: ${_purged} undiscovered ${_stoneName}${_purged !== 1 ? 's were' : ' was'} struck from the world's lair hoards — the artefact is destroyed.)`,
        { actor: null, targets: [], gmOnly: true },
      );
    G._destroyedItems = (G._destroyedItems || []).concat([
      { name: _stoneName, turn: G.turn, by: c.name, player: c.player },
    ]);
    const _parts = [`${led} marching under your commanders`, `${garr} in your garrisons`].filter(
      (_, i) => (i === 0 ? led : garr) > 0,
    );
    // The owner's own account — what it did for them, and what it cost.
    log(
      'explore',
      `✨ ${c.name} invokes the ${_stoneName} — a wave of power sweeps the realm and ${n} army unit${n !== 1 ? 's' : ''} advance one quality tier (${_parts.join(', ')}${already > 0 ? `; ${already} already Elite and unchanged` : ''}). The Stone crumbles to grey dust in ${c.name}'s hands: its work is done, and there is not another in the world.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id, charId: c.id },
    );
    trySkillGain(turnContext, c, 'sage', SKILLGAIN_COMMON); // 2026-09-21: using a magic item may teach Sage
    // ...and the whole world sees the sky change. Every realm is told, by name — an artefact
    // of this order leaving the world is news, and its loss is a fact all players should
    // know.
    (G.players || []).forEach((_pl, _pi) => {
      if (_pl == null) return;
      log(
        'system',
        `🌍 A light passes over the world: somewhere in ${prov.name}, ${_pi === c.player ? `your own ${c.name}` : `${G.players[c.player]?.name || 'a distant realm'}`} has worked the ${_stoneName} and burned it out. Every soldier of that realm stands a little taller tonight — and the Stone itself is gone from the world for good. No lair will yield another.`,
        { actor: null, targets: [_pi], public: true },
      );
    });
  } else {
    log('system', `The ${it.name} is a passive item and does not need to be used — its power is always active.`, {
      actor: c.player,
      targets: [c.player],
    });
  }
  return;
}
// Send Item (once Give Item): items handed to one of the realm's own living heroes, at once in the same province or by courier by the turn's end.
export function resolveSendItemOrder(turnContext, c, ph, target, extra) {
  const { G, log } = turnContext;
  // SEND ITEM (was Give Item). A character can hand over MORE THAN ONE
  // item at once (comma-separated indices, or "all"; splice high→low so indices stay aligned) to
  // ANY of the player's own living characters, wherever they stand:
  // • SAME province → delivered at once, usable later this turn (as before);
  // • DIFFERENT province → the items leave the sender NOW but travel by courier and ARRIVE with
  // the recipient at the END of the turn (queued on G._itemDeliveries), ready to use next turn.
  // the recipient is notified in THEIR own Chronicle section, this phase.
  // ── CHARMED HEROES SEND NOTHING, AND RECEIVE NOTHING ──────────────────────────────────────
  // 2026-09-12 refused Send Item outright for a charmed hero; 2026-09-18 relaxed it to ONE
  // engine-chosen item a turn; 2026-09-24 (Toby) settles it the other way for good, in both
  // directions. An enchanter borrows a mind for a season and gains no quartermaster: a charmed
  // hero will not hand their possessions to anyone, and will not be handed anything either. Both
  // checks live here rather than only on the order form, so a stale draft or a hand-crafted
  // submission cannot walk past them. The hero's own gear is untouched throughout.
  if (isCharmedNow(G, c)) {
    log(
      'item',
      `${c.name} will part with nothing — a mind held by enchantment guards its own possessions, whatever it is bidden.`,
      { actor: c.player, targets: [c.player], charId: c.id },
    );
    return;
  }
  const recip = orderCharRef(G, extra); // a plain id, or a pre-order hero's synthetic id
  if (!recip) {
    log('item', `${c.name}: cannot send item — no such recipient.`, { actor: c.player, targets: [c.player] });
    return;
  }
  if (isCharmedNow(G, recip)) {
    log(
      'item',
      `${c.name} keeps the items — ${recip.name} is held by a Charm, and an enchanted mind is trusted with nothing. Send them on once the hero serves you of their own will.`,
      { actor: c.player, targets: [c.player], charId: c.id },
    );
    return;
  }
  if (isPreOrderRef(extra) && (recip.player !== c.player || !recip.alive || recip._charmTempControl)) {
    log(
      'item',
      `${c.name} keeps the items — ${recip.name} is not in your service${recip.alive ? '' : ' (they have fallen)'}: the hire, raising or charm did not land (or has not happened yet), so nothing is sent.`,
      { actor: c.player, targets: [c.player], charId: c.id },
    );
    return;
  }
  if (recip.player !== c.player || !recip.alive) {
    log('item', `${c.name}: items can only be sent to one of your own living characters.`, {
      actor: c.player,
      targets: [c.player],
    });
    return;
  }
  if (recip.id === c.id) {
    log('item', `${c.name}: cannot send items to themselves.`, { actor: c.player, targets: [c.player] });
    return;
  }
  const _held = c.items || [];
  let idxs;
  if (
    String(target || '')
      .trim()
      .toLowerCase() === 'all'
  ) {
    idxs = _held.map((_, i) => i);
  } else {
    // ── 2026-09-24 (Toby): a token may be a positional INDEX (as always) or an item ID / NAME ──
    // Send Item was index-only, and an index is only meaningful when the order form's list and
    // the engine's `c.items` are the same list in the same order. They are NOT for a PRE-ORDER
    // card: a hero being HIRED has a real pack the player has never seen, so the form's index 0
    // (the sword you sent them an hour ago) is some other item entirely at resolution — you
    // would send the wrong thing, chosen by an accident of ordering. Equip Items and Use Item
    // already addressed items by id-or-name for exactly this reason; Send Item now does too, so
    // the player form can name what it means whenever position cannot be trusted.
    // Backward compatible: a token that is a plain integer in range is still positional, so
    // every existing (and in-flight) order behaves identically. `String(n)===t` is what keeps a
    // name that merely STARTS with digits ("3 Rings of Dawn") out of the positional branch.
    const _toks = String(target || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    idxs = _toks
      .map((t) => {
        const n = parseInt(t);
        if (Number.isInteger(n) && String(n) === t && n >= 0 && n < _held.length) return n;
        return _held.findIndex((it) => it && (String(it.id) === t || it.name === t));
      })
      .filter((n) => Number.isInteger(n) && n >= 0 && n < _held.length);
  }
  let uniq = [...new Set(idxs)].sort((a, b) => b - a);
  // A granted Mithril suit is forged to its wearer and cannot be sent on.
  if (uniq.some((i) => isMithril(_held[i]))) {
    uniq = uniq.filter((i) => !isMithril(_held[i]));
    log('item', `${c.name}: Mithril Armour is forged to its wearer and cannot be sent — it stays in their pack.`, {
      actor: c.player,
      targets: [c.player],
    });
  }
  if (uniq.length === 0) {
    log('item', `${c.name}: cannot send item.`, { actor: c.player, targets: [c.player] });
    return;
  }
  const given = [];
  uniq.forEach((i) => {
    given.push(...c.items.splice(i, 1));
  });
  applyItemMaxHp(c, null);
  const _names = given.map((it) => it.name).join(', ');
  const _sameProv = recip.location === c.location;
  if (_sameProv) {
    // Hand over now.
    recip.items = recip.items || [];
    given.forEach((item) => {
      recip.items.push(item);
      applyItemMaxHp(recip, item); /* item 6 */
    });
    log('hire', `${c.name} hands ${_names} to ${recip.name}.`, {
      actor: c.player,
      targets: [c.player],
      charId: c.id,
      phase: ph,
    });
    // tell the recipient, in their own section.
    notifyTarget(turnContext, recip, `📦 ${recip.name} receives ${_names} from ${c.name}.`, ph);
    {
      const _gn = gainedItemNote(recip, given);
      if (_gn) notifyTarget(turnContext, recip, _gn, ph);
    } // item 10
  } else {
    // Dispatch by courier — arrives at end of turn (see the end-of-turn delivery flush).
    G._itemDeliveries = G._itemDeliveries || [];
    G._itemDeliveries.push({ toId: recip.id, items: given, fromName: c.name });
    const _rProv = G.world.provinces[recip.location];
    log(
      'hire',
      `${c.name} dispatches ${_names} by courier to ${recip.name} in ${_rProv ? _rProv.name : 'a distant province'} — it will arrive by turn's end.`,
      { actor: c.player, targets: [c.player], charId: c.id, phase: ph },
    );
    // the recipient's send-phase "a courier is on the way" notice was removed — it duplicated
    // the end-of-turn delivery line (see the COURIER DELIVERIES flush), which already tells
    // the recipient the parcel arrived and is ready to use next turn. The sender still gets
    // the dispatch line above.
  }
  return;
}
