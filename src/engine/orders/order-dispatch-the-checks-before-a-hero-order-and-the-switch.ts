import { SPELL_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { THE_MASTERY_ORDERS } from '../../content/mastery-orders-their-keys-names-skills-and-levels.ts';
import {
  THE_HERO_ORDERS,
  THE_KIND_A_BLANK_OR_UNKNOWN_ORDER_READS_AS,
} from '../../content/the-hero-orders-their-keys-the-names-the-turn-reads-them-by-and-their-tiers.ts';
import { SKILL_LABELS } from '../army-tables.ts';
import { botDrillUseful } from '../bots/economy.ts';
import { provOf } from '../world/map-helpers.ts';
import { skillLevel } from '../titles/perks.ts';
import { areEnemies } from '../realms/relations-and-captures.ts';
import { isCharmedNow } from '../heroes/charms-and-neutrals.ts';
import { theLevelEachMasterySpellNeeds } from '../rules-on-plain-values/spells-the-order-form-offers-each-school-aim-and-mastery-level.ts';
import {
  PHASE_ACTION_MAP,
  normaliseAction,
  theHeroOrdersRowOfAKind,
  type OrderKind,
} from '../rules-on-plain-values/the-kind-of-order-each-name-of-an-order-reads-as.ts';
import {
  THE_REGISTRY_OF_THE_HERO_ORDERS_RESOLVERS,
  type AnOrderAsTheDispatchReadsIt,
  type AnOrdersResolver,
} from './the-registry-of-the-hero-orders-each-kinds-resolver-keyed-by-its-row.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../turn/events-and-their-audiences.ts';
import { botPracticeSkill } from '../bots/strategy.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { thePowerAnItemWorksWhenUsed } from '../rules/the-registry-of-magic-item-effects.ts';
import type { Character, Item } from '../../schemas/saved-game-state.ts';
import type { TurnContext, TurnOrder } from '../turn/context.ts';

/** An order's province as the dispatch guards it (an older order may hold it as words, or as none). */
interface AnOrdersProvinceAsTheDispatchGuardsIt {
  readonly prov?: number | string | null | undefined;
}
/** An item as a spell item's Use Item reads it: its id and name, and its effect (or none: a gap among the items, or an
 *  item with no effect, in an older save). */
interface AnItemAsTheSpellItemReadsIt {
  readonly id: Item['id'];
  readonly name: string;
  readonly effect?: Pick<Item['effect'], 'stat' | 'spell'> | null | undefined;
}
/** The heroes' orders for the turn as the dispatch reads them while the turn runs (the saved state holds them
 *  cleared, as nulls): by hero (or none), then by phase (or none). */
type TheTurnsOrdersAsTheDispatchReadsThem = Readonly<
  Partial<Record<string, readonly (TurnOrder | null | undefined)[]>>
>;
/** A hero's skills as the dispatch reads them by any skill's name (a season's snapshot, or his own). */
type SkillsByAnyName = Readonly<Partial<Record<string, number>>>;
/** A level in a skill named by any name, from a hero's skills: `|| 0`, as before (a missing one, or NaN, is 0). */
const aLevelByAnyName = (skills: SkillsByAnyName, name: string) => Number(skills[name]) || 0;
/** An order's target in words, as `String()` makes them: the turn's order holds words, but a save may hold an item's id
 *  as a number (tests/unit/order-dispatch-called-directly.test.ts stages one), so the words are made as before. */
const aTargetInWords = (target: string | number) => String(target);
// ── ONE HERO'S ORDER, CHECKED AND HANDED TO ITS ORDER'S FUNCTION (plan P1-08j9: lifted out of resolveTurn) ────
// processOrder carries out one hero's order for one phase: resolveTurn's phase loop calls it for each hero in turn.
// First the checks that come before any order: a hero unified into another's battle this phase is superseded; a
// bot's Practice on a skill already at 5 switches skill, and a bot's Search too hurt, on a rumour not heard, or out of
// the province it was written for becomes a Rest; a Move or an Encounter out of an unresolved battle is refused;
// a charmed enemy hero won't disband, perform the rites or spend a mastery; a mastery is charged once a turn; a Forced
// March becomes a Move that may slip past a battle; a spell item's Use Item becomes a cast. Then the hero orders' registry
// (the-registry-of-the-hero-orders-each-kinds-resolver-keyed-by-its-row.ts, B-06ao) hands the order to its kind's own
// function (src/engine/orders/, rows j1 to j8). It takes the turn's context first
// (src/engine/turn/context.ts).
// Process one order
export function processOrder(
  turnContext: TurnContext,
  c: Character | null | undefined,
  o: AnOrderAsTheDispatchReadsIt | null | undefined,
  ph: number,
) {
  const { G, _botPlayerIdx } = turnContext;
  if (!c || !c.alive || !o) return;
  // If this hero was unified into another's battle this phase, their own order is superseded
  if (o._unifiedWith != null) {
    const theLeadersId = o._unifiedWith;
    // filed under the hero himself (2026-10-09, Toby item 1): with no charId it fell into Realm Events
    emit(turnContext, {
      type: 'move',
      fact: {
        kind: "a hero's order is superseded: he joined another hero's battle",
        heroName: c.name,
        joinedHeroName: (G.characters.find((x) => x.id === theLeadersId)?.name ?? '') || null,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: c.id,
      phase: ph,
    });
    turnContext._logCtx = { charId: null, phase: null };
    return;
  }
  turnContext._logCtx = { charId: c.id, phase: ph }; // every line emitted inside here inherits this
  const rawAction = (o.action || THE_KIND_A_BLANK_OR_UNKNOWN_ORDER_READS_AS).toLowerCase().trim();
  // the kind of order each name gives (a name it doesn't hold gives none, read as a Defend; P1-10z: a kind of
  // order, so a kind the registry below has no resolver for fails to compile)
  const actionsByName: Readonly<Partial<Record<string, OrderKind>>> = PHASE_ACTION_MAP;
  let action: OrderKind = (actionsByName[rawAction] ?? '') || THE_KIND_A_BLANK_OR_UNKNOWN_ORDER_READS_AS;
  let _fmSlip = false; // MARCH L7 Forced March: set below when a forced-march move should try to slip past battle
  // 2026-09-28: a BOT slayer's second / third lair of the year carries _botMinHp — if an earlier fight left him
  // below that share of his HP, he rests instead of walking into another guardian half-dead. (Never set on
  // a player's order.)
  // 2026-09-29 (Toby): a BOT's Practice on a skill that has reached 5 SINCE its orders were written (an earlier
  // phase's practice or experience in the field this turn) switches to its next skill below 5 — unless it is
  // teaching a comrade practising that skill beside it this phase, or drilling troops that can still improve.
  if (
    action === THE_HERO_ORDERS.practice.key &&
    c.player != null &&
    asItsGuardReadsIt(_botPlayerIdx)?.has(c.player) &&
    o.target
  ) {
    const _S = aTargetInWords(o.target);
    const _sn = G._phaseSkillSnapshot?.[c.id] ?? asItsGuardReadsIt(c.skills) ?? {};
    const _myL = aLevelByAnyName(_sn, _S);
    if (_myL >= 5 && !((_S === 'tactical' || _S === 'naval') && botDrillUseful(c, _S))) {
      const _teaching = (asItsGuardReadsIt(G.characters) ?? []).some(
        (t: Character | null | undefined) =>
          t?.alive &&
          t.id !== c.id &&
          t.player === c.player &&
          t.location === c.location &&
          (() => {
            const turnOrders: TheTurnsOrdersAsTheDispatchReadsThem = G.turnOrders;
            const k = (turnOrders[t.id] ?? [])[ph];
            return (
              k &&
              normaliseAction(k) === THE_HERO_ORDERS.practice.key &&
              aTargetInWords(k.target) === _S &&
              aLevelByAnyName(G._phaseSkillSnapshot?.[t.id] ?? asItsGuardReadsIt(t.skills) ?? {}, _S) < _myL
            );
          })(),
      );
      if (!_teaching) {
        const _nx = botPracticeSkill(c);
        if (_nx) {
          // the skills' labels by any name
          const skillLabels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
          o = { ...o, target: _nx, desc: 'Practice ' + ((skillLabels[_nx] ?? '') || _nx) };
        } else {
          action = THE_HERO_ORDERS.defend.key;
        }
      }
    }
  }
  if (
    action === THE_HERO_ORDERS.search.key &&
    o._botMinHp &&
    c.player != null &&
    (asItsGuardReadsIt(c.hp) ?? (c.maxHp || 20)) < (c.maxHp || 20) * o._botMinHp
  ) {
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'a hero too badly hurt to face another guardian rests instead', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: c.location,
    });
    action = THE_HERO_ORDERS.rest.key;
  }
  // 2026-09-28 (option 2): a bot's "search if the talk is good" — only on a rumour THIS hero heard THIS turn about
  // this lair, at the band the order names (or the lower band for a Weak lair when he is at full health).
  if (action === THE_HERO_ORDERS.search.key && o._botIfRumour && c.player != null) {
    const _pv = G.world.provinces[c.location];
    const _f = _pv && (asItsGuardReadsIt(_pv.features) ?? [])[parseInt(o.target)];
    const _r = _f?._rumourOdds?.[c.player];
    const _hpR = (asItsGuardReadsIt(c.hp) ?? (c.maxHp || 20)) / (c.maxHp || 20);
    const _ok = !!(
      _r?.charId === c.id &&
      _r.turn === G.turn &&
      (_r.band >= o._botIfRumour ||
        (o._botIfRumourLow && _r.band >= o._botIfRumourLow && _hpR >= ((o._botIfRumourLowHp ?? 0) || 0.95)))
    );
    if (!_ok) {
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'a hero weighs the rumour of a lair and leaves it for another day',
          heroName: c.name,
          lairName: _f ? _f.name : null,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: c.location,
      });
      action = THE_HERO_ORDERS.rest.key;
    }
  }
  // 2026-09-29 (Toby, lair study): a Search names its lair by INDEX within a province. When the move
  // meant to carry the searcher there fell short (pinned, blocked, pool spent), the old search ran
  // on whatever lair sat at that index where he actually stood, or on ANY uncleared lair there, so
  // untrained heroes died to Moderate guardians nobody chose (40 bot games: 12 such deaths). Every
  // bot search, and every player search from this build on, carries `prov`, the province it was
  // written for; standing anywhere else, the searcher does not go in.
  const theOrderAsItsProvinceIsGuarded: AnOrdersProvinceAsTheDispatchGuardsIt = o;
  if (
    action === THE_HERO_ORDERS.search.key &&
    theOrderAsItsProvinceIsGuarded.prov != null &&
    theOrderAsItsProvinceIsGuarded.prov !== '' &&
    String(theOrderAsItsProvinceIsGuarded.prov) !== String(c.location)
  ) {
    const _pw = G.world.provinces[parseInt(String(theOrderAsItsProvinceIsGuarded.prov))];
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: 'a hero never reaches the lair he set out for and rests instead',
        heroName: c.name,
        provinceName: _pw ? _pw.name : null,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: c.location,
    });
    action = THE_HERO_ORDERS.rest.key;
  }
  const target = o.target || '';
  const extra = o.extra || '';
  const prov = provOf(turnContext, c);
  const player = c.player === null ? undefined : G.players[c.player]; // a wanderer's: none
  // the order's row: the checks below read its fields (its kind stays as it is until the Forced March below)
  const theOrdersRow = theHeroOrdersRowOfAKind(action);

  // ── BATTLE LOCK, RE-CHECKED AT THE MOMENT OF MARCHING ────
  // STAGE 1b already pins army-leaders standing in a contested province, but it is computed ONCE,
  // at the top of the phase, from the flags as they stood then. A battle joined DURING the phase
  // — an invader marching in and being thrown back, say — raises _battleUnresolved AFTER that
  // pass has run, so the other side's own Move order, processed later in the same phase, marched
  // straight out of a province it was still locked into.
  //
  // That is the Fairscree report: Ketil's assault was repelled but his host was still the
  // stronger, so he held the field "rather than retreat" and the province was flagged contested —
  // and Boden, who had just won that battle, then sailed away into the Storm Sea and on across
  // two more phases, with the fight behind him never resumed and the ground never decided.
  //
  // Re-checking here, at the instant the relocating order executes, closes that window: a live
  // contest pins BOTH sides until resolveStalledBattles settles it at the top of the next phase.
  // The pin only bites while an armed hostile force is actually standing here — a stale flag left
  // by an enemy who died or withdrew never traps anyone. (A Pursue is an Encounter by its kind: no kind is Pursue's.)
  // The orders it pins are their rows' (pinnedByTheBattleLock): a Move and an Encounter.
  if (
    theOrdersRow.pinnedByTheBattleLock === true &&
    prov &&
    prov._battleUnresolved &&
    (asItsGuardReadsIt(c.armies) ?? []).length > 0
  ) {
    const _foeHere =
      (asItsGuardReadsIt(G.characters) ?? []).some(
        (x: Character | null | undefined) =>
          x &&
          (x.alive || x._leaderlessHost) &&
          x.id !== c.id &&
          x.location === prov.id &&
          (asItsGuardReadsIt(x.armies) ?? []).length > 0 &&
          (x.player == null || (x.player !== c.player && areEnemies(turnContext, c.player, x.player))),
      ) ||
      (prov.owner !== c.player && (asItsGuardReadsIt(prov.neutralDefenders) ?? []).length > 0);
    if (_foeHere) {
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: 'a hero locked in an unresolved battle cannot march away',
          heroName: c.name,
          provinceName: prov.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        province: prov.id,
        hero: c.id,
        phase: ph,
        pinNotice: true,
      });
      turnContext._logCtx = { charId: null, phase: null };
      return;
    }
  }

  // ── CHARMED ENEMY HERO ── an enemy hero whose command has been seized for the turn will march
  // and fight under your banner, but an enchantment is not an oath: they will not break up their
  // own lord's companies, perform another realm's alignment rites, or spend their own hard-won
  // mastery for a stranger. A WANDERING hero Charmed into permanent service is not restricted —
  // they have genuinely joined the realm and act as any other hero of it. This sits ABOVE the
  // once-per-turn charge below so a refused mastery order is not also spent.
  // a mastery order, or a Cast Spell of a mastery spell (the list the order form leaves off a hero whose levels his realm
  // can't see: rules-on-plain-values/spells-the-order-form-offers-each-school-aim-and-mastery-level.ts), by its row
  const aMastery =
    theOrdersRow.aMasteryOrder === true ||
    (theOrdersRow.aCastOfAMasterySpellIsAMastery === true &&
      Object.hasOwn(theLevelEachMasterySpellNeeds(), aTargetInWords(target)));
  if (c._charmTempControl) {
    // disbanding companies, an alignment's rite, or a mastery: what he will not do (the prose says it, by the action);
    // the rows' aSeizedHeroRefusesIt
    const _refused = theOrdersRow.aSeizedHeroRefusesIt === true || aMastery;
    if (_refused) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a charmed hero will not carry out an order of his captor', heroName: c.name, action },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      turnContext._logCtx = { charId: null, phase: null };
      return;
    }
  }

  // ── A HERO WHO JOINED THE REALM THIS TURN ── (R-048) his levels are not his realm's to see until he has joined, and
  // the order form offers him no mastery order and no mastery spell; from the next turn he is an ordinary hero. Above
  // the once-per-turn charge, so a refused mastery is not also spent. A wanderer swayed by a charm this turn is not this
  // rule's (the rulebook: he "keeps every order"); one seized from an enemy is refused above.
  if (c.hiredInPhase != null && c.hiredInPhase >= 0 && !isCharmedNow(G, c) && aMastery) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero who joined the realm this turn has no mastery to give yet', heroName: c.name, action },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    turnContext._logCtx = { charId: null, phase: null };
    return;
  }

  // ── ONCE PER TURN ── a mastery order (its row's aMasteryOrder) may be attempted only once per turn per character.
  if (theOrdersRow.aMasteryOrder === true) {
    c._masteryOrderUsed = c._masteryOrderUsed ?? {};
    // the turn each mastery was last used, by any order's name
    const theMasteriesUsed: Partial<Record<string, number>> = c._masteryOrderUsed;
    if (theMasteriesUsed[action] === G.turn) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a hero has already used a mastery this turn', heroName: c.name, action },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      turnContext._logCtx = { charId: null, phase: null };
      return;
    }
    theMasteriesUsed[action] = G.turn;
  }

  // ── MARCH L7 — Forced March ── is now a MOVE with a 50% chance to slip past a battle this
  // phase. Remap it to the move handler (keeping the once-per-turn charge above) and flag the
  // slip locally.
  if (action === THE_HERO_ORDERS.forced_march.key) {
    if (skillLevel(c, 'march') < THE_MASTERY_ORDERS.forced_march.level) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a hero lacks the March mastery for a Forced March', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      turnContext._logCtx = { charId: null, phase: null };
      return;
    }
    _fmSlip = true;
    action = THE_HERO_ORDERS.move.key;
  }

  // ── a SPELL ITEM used via Use Item becomes a cast of its spell at a flat 95%. ──
  let _itemCast: { item: string; spell: string | undefined } | null = null;
  // a hero under a charm uses no item (R-049): his Use Item stays the item order's, which refuses it
  if (action === THE_HERO_ORDERS.use_item.key && !isCharmedNow(G, c)) {
    const theItems: readonly (AnItemAsTheSpellItemReadsIt | null | undefined)[] = asItsGuardReadsIt(c.items) ?? [];
    const _sit = theItems.find((x) => x && (String(x.id) === aTargetInWords(target) || x.name === target));
    // the spells' rows by any name an item gives (the key "undefined" for none, as JavaScript reads it)
    const spellDefs: Readonly<Partial<Record<string, object>>> = SPELL_DEFS_P;
    // a spell charm's power (the items' registry, plan P1-19y)
    if (
      _sit &&
      thePowerAnItemWorksWhenUsed(_sit) === 'it casts the spell it holds' &&
      spellDefs[String(_sit.effect?.spell)]
    ) {
      _itemCast = { item: _sit.name, spell: _sit.effect?.spell };
      action = THE_HERO_ORDERS.cast_spell.key;
    }
  }

  // the registry hands the order to its kind's resolver (B-06ao), with what each reads. A name every object holds as a
  // key (such as `constructor`) gives no kind the registry holds: no resolver runs. A Forced March is a Move by here:
  // handed on as itself, it fails to compile (the registry holds no Forced March).
  const theResolver: AnOrdersResolver | undefined = Object.hasOwn(THE_REGISTRY_OF_THE_HERO_ORDERS_RESOLVERS, action)
    ? THE_REGISTRY_OF_THE_HERO_ORDERS_RESOLVERS[action]
    : undefined;
  theResolver?.({ turnContext, c, o, ph, _fmSlip, target, extra, prov, player, _itemCast, action });
}
