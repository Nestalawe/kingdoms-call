import { KC_QUALITY_UP } from '../../content/kingdoms-call-data.ts';
import { ITEM_SLOT_CAP, normaliseEquipment, settleTheItemsAHeroGained } from '../items/equipment.ts';
import { thePowerAnItemWorksWhenUsed } from '../rules/the-registry-of-magic-item-effects.ts';
import { itemSlot } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { syncMaxHp } from '../heroes/skills-and-hp.ts';
import { applyItemMaxHp } from '../personal-combat/helpers.ts';
import { theItemsASendItemOrderHandsOver } from '../rules-on-plain-values/the-items-a-send-item-hands-over-and-the-companies-a-hand-over-or-a-pick-up-moves.ts';
import { isCharmedNow, isPreOrderRef, orderCharRef } from '../heroes/charms-and-neutrals.ts';
import {
  emit,
  notifyTarget,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../turn/events-and-their-audiences.ts';
import { SKILLGAIN_COMMON, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { theProvinceIsHanded } from './recruit-and-hire-orders-companies-mercenaries-and-heroes.ts';
import { servesARealm } from './spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { Army, Character, Item, Province, Realm } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';

// ── THE ITEM ORDERS (plan P1-08j5: the fifth family taken out of processOrder in resolveTurn) ──
// Equip Items (which of the items a hero carries he wears or wields, a slot's limit kept), Use Item (an active magic
// item invoked: the Philosopher's Stone; a passive one needs no using) and Send Item (items handed to one of the
// realm's own heroes, at once beside him or by courier by the turn's end), each once processOrder has read the order
// and checked he may act (a spell item's Use Item became a Cast Spell there first). Each takes the turn's context
// first (src/engine/turn/context.ts), then the values processOrder worked out before it that it reads, in the order
// processOrder declares them. Each body keeps processOrder's indent (plan P1-08's Decisions); a case-level break became
// a return.
/** An order's target as these bodies turn it into words (`String(t || '')`, `String(t)`): its schema's words, kept as
 *  wide as the conversions. */
type ATargetAsTheseTurnItIntoWords = string | number | null | undefined;
/** An item in a hero's pack as these orders test it: a gap among the items. */
type AnItemAsTheseTestIt = Item | null | undefined;
/** A company as the Stone counts and raises it: a gap among the companies, his grade, whether he is of the dead. */
type ACompanyAsTheStoneRaisesIt = Pick<Army, 'quality' | '_isSkeletal'> | null | undefined;
/** The slot an item is worn in, read where a filter has just found it has one (itemSlot reads the item alone); for
 *  none, a TypeError. */
function theSlotTheFilterFound(slot: string | null): string {
  if (slot === null) throw new TypeError('an item worn in no slot');
  return slot;
}
// Equip Items: the items named are worn or wielded, the rest taken off, a slot's limit kept (the first named wins); a slot left with room is filled again with the first item held.
export function resolveEquipItemsOrder(turnContext: TurnContext, c: Character, target: ATargetAsTheseTurnItIntoWords) {
  // choose which slot items are worn/wielded. target = comma-separated item names (or ids) to
  // equip. Every slot item NOT named is unequipped; slot caps are enforced (first named
  // wins), and normaliseEquipment then fills any slot left empty with the first item held.
  const want = String((target ?? '') || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const slotItems = (asItsGuardReadsIt(c.items) ?? []).filter((it: AnItemAsTheseTestIt) => it && itemSlot(it));
  if (slotItems.length === 0) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero carries nothing that can be worn or wielded', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  slotItems.forEach((it) => {
    it.equipped = false;
  });
  const cnt: Partial<Record<string, number>> = {};
  const caps: Readonly<Partial<Record<string, number>>> = ITEM_SLOT_CAP;
  const donned: string[] = [];
  const refused: string[] = [];
  want.forEach((w) => {
    const it = slotItems.find((x) => String(x.id) === w || x.name === w);
    if (!it) return;
    const sl = itemSlot(it);
    if ((cnt[String(sl)] ?? 0) >= Number(caps[String(sl)])) {
      refused.push(it.name);
      return;
    }
    it.equipped = true;
    cnt[String(sl)] = (cnt[String(sl)] ?? 0) + 1;
    donned.push(it.name);
  });
  normaliseEquipment(c);
  const worn = (asItsGuardReadsIt(c.items) ?? [])
    .filter((it: AnItemAsTheseTestIt) => it && itemSlot(it) && it.equipped)
    .map((it) => ({ name: it.name, slot: theSlotTheFilterFound(itemSlot(it)) }));
  emit(turnContext, {
    type: 'system',
    fact: { kind: 'a hero arms and dresses for the season', heroName: c.name, worn, refused: [...refused] },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
  });
  return;
}
// Use Item: an active magic item invoked (the Philosopher's Stone); a passive one needs no using.
export function resolveUseItemOrder(
  turnContext: TurnContext,
  c: Character,
  target: ATargetAsTheseTurnItIntoWords,
  prov: Province | undefined,
) {
  const { G } = turnContext;
  // Only a hero of a realm acts in a phase (actingThisPhase passes none without one, and Release Hero frees only the
  // hero who gives it, for the phases after), so he serves one; for none, a TypeError.
  if (!servesARealm(c)) throw new TypeError('a hero who serves no realm uses an item');
  // Trigger an ACTIVE magic item (one that must be invoked, not a passive bonus).
  // 2026-09-24 (Toby): not while charmed. An enchanted mind fights with what it carries — its
  // passive magic works as ever — but will not be made to spend a treasure on a stranger's
  // errand. Refused here as well as hidden on the form, since `target` is matched by NAME and a
  // crafted order would otherwise let a charmer probe the pack by reading the result.
  if (isCharmedNow(G, c)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a charmed hero will not spend what he carries', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: c.id,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const it: AnItemAsTheseTestIt = (asItsGuardReadsIt(c.items) ?? []).find(
    (x) => String(x.id) === String(target) || x.name === target,
  );
  if (!it) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero has no such item to use', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  // the power it works, by the items' registry (plan P1-19o)
  if (thePowerAnItemWorksWhenUsed(it) === 'every unit of the realm rises a quality tier') {
    // ── PHILOSOPHER'S STONE ────
    // Once per game: promote EVERY unit of the realm one quality tier — those marching under
    // your commanders AND those standing in your garrisons. Skeletal armies are excluded; the
    // dead do not advance in experience.
    // BUG FIXED: the garrison sweep read `pv.garrison`, a field that does not exist — the
    // engine's unled units live in `pv.garrisonArmies` everywhere else. Garrison troops were
    // therefore NEVER promoted, and a realm whose strength sat in its garrisons could invoke
    // the Stone and see almost nothing happen.
    const UP: Readonly<Partial<Record<string, string>>> = { ...KC_QUALITY_UP };
    const _promote = (arr: readonly ACompanyAsTheStoneRaisesIt[] | null | undefined) => {
      let k = 0;
      (arr ?? []).forEach((a) => {
        if (a && !a._isSkeletal) {
          const up = UP[a.quality];
          if (up && up !== a.quality) {
            a.quality = up;
            k++;
          }
        }
      });
      return k;
    };
    let led = 0,
      garr = 0;
    const _count = (arr: readonly ACompanyAsTheStoneRaisesIt[] | null | undefined) =>
      (arr ?? []).filter((a) => a && !a._isSkeletal).length;
    let total = 0;
    (asItsGuardReadsIt(G.characters) ?? [])
      .filter((ch) => ch.alive && ch.player === c.player)
      .forEach((ch) => {
        total += _count(ch.armies);
        led += _promote(ch.armies);
      });
    (asItsGuardReadsIt(G.world.provinces) ?? []).forEach((pv: Province | null | undefined) => {
      if (pv?.owner === c.player) {
        total += _count(pv.garrisonArmies);
        garr += _promote(pv.garrisonArmies);
      }
    });
    const n = led + garr;
    const already = total - n;
    // A once-per-game treasure is not spent on nothing: if there is not a single unit it
    // could raise, the Stone stays unused and the player is told why.
    if (n === 0) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "the Philosopher's Stone finds nothing to work on and is not spent",
          heroName: c.name,
          stoneName: it.name,
          theRealmHasNoUnits: total === 0,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      return;
    }
    // ── CONSUMED ── the Stone is not merely spent, it is GONE: the working destroys it.
    // Struck from the bearer's pack so it can never be used, sent, stolen, looted from a
    // corpse or equipped again, and its name stays on G._awardedItems (the permanent ledger
    // every item roll checks) so no lair can ever yield another.
    const _stoneName = it.name;
    c.items = (asItsGuardReadsIt(c.items) ?? []).filter((x) => x !== it && String(x.id) !== String(it.id));
    syncMaxHp(c, undefined); // an item leaving the pack can change derived stats; re-sync to be safe
    if (!Array.isArray(G._awardedItems)) G._awardedItems = [];
    if (!G._awardedItems.includes(_stoneName)) G._awardedItems.push(_stoneName);
    // Lair hoards are decided at world generation, so an unfound copy could still be lying in
    // the ground. The narrative below tells every realm the Stone is gone from the world for
    // good — so make that true: strike any undiscovered copy from every hoard as well. (A
    // copy already carried by a character is left alone; that one exists and was won.)
    let _purged = 0;
    (asItsGuardReadsIt(G.world.provinces) ?? []).forEach((pv: Province | null | undefined) => {
      if (!pv) return;
      (asItsGuardReadsIt(pv.features) ?? []).forEach((f: Province['features'][number] | null | undefined) => {
        if (!f || !Array.isArray(f.hoardItems)) return;
        const before = f.hoardItems.length;
        f.hoardItems = f.hoardItems.filter((x: Item | null | undefined) => !(x?.name === _stoneName));
        _purged += before - f.hoardItems.length;
      });
    });
    if (_purged > 0)
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "the GM's note of the undiscovered Stones struck from the lair hoards",
          struck: _purged,
          stoneName: _stoneName,
        },
        // the GM's alone: no realm is granted it, and it is about no hero (filed under the hero working the Stone, his
        // realm would read it)
        audience: { actor: null, realms: [] },
        hero: null,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
    G._destroyedItems = (G._destroyedItems ?? []).concat([
      { name: _stoneName, turn: G.turn, by: c.name, player: c.player },
    ]);
    // The owner's own account — what it did for them, and what it cost.
    theProvinceIsHanded(prov);
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: "the Philosopher's Stone raises the realm's units a tier and crumbles",
        heroName: c.name,
        stoneName: _stoneName,
        raised: n,
        led,
        garrisoned: garr,
        alreadyElite: already,
      },
      audience: { actor: c.player, realms: [c.player] },
      province: prov.id,
      hero: c.id,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    trySkillGain(turnContext, c, 'sage', SKILLGAIN_COMMON); // 2026-09-21: using a magic item may teach Sage
    // ...and the whole world sees the sky change. Every realm is told, by name — an artefact
    // of this order leaving the world is news, and its loss is a fact all players should
    // know.
    (asItsGuardReadsIt(G.players) ?? []).forEach((_pl: Realm | null | undefined, _pi) => {
      if (_pl == null) return;
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "the world sees the Philosopher's Stone burned out",
          provinceName: prov.name,
          isTheirOwnHero: _pi === c.player,
          heroName: c.name,
          realmName: (G.players[c.player]?.name ?? '') || null,
          stoneName: _stoneName,
        },
        audience: { actor: null, realms: [_pi], seen: 'world' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
    });
  } else {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a passive item needs no using', itemName: it.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
  }
  return;
}
// Send Item (once Give Item): items handed to one of the realm's own living heroes, at once in the same province or by courier by the turn's end.
export function resolveSendItemOrder(
  turnContext: TurnContext,
  c: Character,
  ph: number,
  target: ATargetAsTheseTurnItIntoWords,
  extra: string,
) {
  const { G } = turnContext;
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
    emit(turnContext, {
      type: 'item',
      fact: { kind: 'a charmed hero will part with nothing', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: c.id,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const recip = orderCharRef(G, extra); // a plain id, or a pre-order hero's synthetic id
  if (!recip) {
    emit(turnContext, {
      type: 'item',
      fact: { kind: 'a hero cannot send items: there is no such recipient', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (isCharmedNow(G, recip)) {
    emit(turnContext, {
      type: 'item',
      fact: {
        kind: 'a hero keeps the items: the recipient is held by a Charm',
        heroName: c.name,
        recipientName: recip.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: c.id,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (isPreOrderRef(extra) && (recip.player !== c.player || !recip.alive || recip._charmTempControl)) {
    emit(turnContext, {
      type: 'item',
      fact: {
        kind: "a hero keeps the items: the recipient is not in the realm's service",
        heroName: c.name,
        recipientName: recip.name,
        recipientIsAlive: recip.alive,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: c.id,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (recip.player !== c.player || !recip.alive) {
    emit(turnContext, {
      type: 'item',
      fact: { kind: "items can be sent only to the realm's own living heroes", heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (recip.id === c.id) {
    emit(turnContext, {
      type: 'item',
      fact: { kind: 'a hero cannot send items to himself', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const _held: readonly AnItemAsTheseTestIt[] = asItsGuardReadsIt(c.items) ?? [];
  const _send = theItemsASendItemOrderHandsOver(_held, target);
  const uniq = _send.places;
  // A granted Mithril suit is forged to its wearer and cannot be sent on.
  if (_send.theMithrilSuitStays) {
    emit(turnContext, {
      type: 'item',
      fact: { kind: 'Mithril Armour is forged to its wearer and cannot be sent', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
  }
  if (uniq.length === 0) {
    emit(turnContext, {
      type: 'item',
      fact: { kind: 'a hero cannot send the item', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const given: Item[] = [];
  uniq.forEach((i) => {
    given.push(...c.items.splice(i, 1));
  });
  applyItemMaxHp(c, null);
  const _sameProv = recip.location === c.location;
  if (_sameProv) {
    // Hand over now.
    recip.items = asItsGuardReadsIt(recip.items) ?? [];
    given.forEach((item) => {
      recip.items.push(item);
      applyItemMaxHp(recip, item); /* item 6 */
    });
    emit(turnContext, {
      type: 'hire',
      fact: {
        kind: 'a hero hands items to a comrade beside him',
        heroName: c.name,
        itemNames: given.map((it) => it.name),
        recipientName: recip.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: c.id,
      phase: ph,
    });
    // tell the recipient, in their own section.
    notifyTarget(
      turnContext,
      recip,
      {
        kind: 'a hero receives items from a comrade',
        recipientName: recip.name,
        itemNames: given.map((it) => it.name),
        heroName: c.name,
      },
      ph,
    );
    {
      const _gn = settleTheItemsAHeroGained(recip, given);
      if (_gn)
        notifyTarget(
          turnContext,
          recip,
          { kind: 'a hero handed items notes how he carries them', theItemsHeGained: _gn },
          ph,
        );
    } // item 10
  } else {
    // Dispatch by courier — arrives at end of turn (see the end-of-turn delivery flush).
    G._itemDeliveries ??= [];
    G._itemDeliveries.push({ toId: recip.id, items: given, fromName: c.name });
    const _rProv = G.world.provinces[recip.location];
    emit(turnContext, {
      type: 'hire',
      fact: {
        kind: 'a hero sends items by courier',
        heroName: c.name,
        itemNames: given.map((it) => it.name),
        recipientName: recip.name,
        provinceName: _rProv ? _rProv.name : null,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: c.id,
      phase: ph,
    });
    // the recipient's send-phase "a courier is on the way" notice was removed — it duplicated
    // the end-of-turn delivery line (see the COURIER DELIVERIES flush), which already tells
    // the recipient the parcel arrived and is ready to use next turn. The sender still gets
    // the dispatch line above.
  }
  return;
}
