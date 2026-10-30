import { SPELL_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { ALIGNMENT_ORDER_KEYS, MASTERY_ORDER_KEYS, SKILL_LABELS } from '../army-tables.ts';
import { botDrillUseful } from '../bots/economy.ts';
import { provOf } from '../world/map-helpers.ts';
import { skillLevel } from '../titles/perks.ts';
import { areEnemies } from '../realms/relations-and-captures.ts';
import { PHASE_ACTION_MAP, normaliseAction } from '../turn/phase-intents-and-dependency-ordering.ts';
import { resolveMoveOrder } from './move-order-marches-voyages-and-battles-on-arrival.ts';
import {
  resolveChartTheUnknownOrder,
  resolveDiscoverLostRuinOrder,
  resolveExploreOrder,
  resolveHuntingRumoursOrder,
  resolvePerformRiteOrder,
  resolveSearchLairOrder,
} from './explore-and-search-orders-maps-lairs-rites-and-rumours.ts';
import {
  resolveHireHeroOrder,
  resolveRecruitArmiesOrder,
} from './recruit-and-hire-orders-companies-mercenaries-and-heroes.ts';
import {
  resolveAwakenGroveOrder,
  resolveBrokerOrder,
  resolveCallToArmsOrder,
  resolveConsecrateOrder,
  resolveGrandDesignOrder,
  resolveHarvestTheFieldOrder,
  resolveRemovedAwakenTheWildAndCallFromThePitOrders,
  resolveWildCallingOrder,
} from './realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts';
import {
  resolvePracticeSkillOrder,
  resolveResearchBreakthroughOrder,
  resolveResearchOrder,
  resolveRestOrder,
} from './research-and-practice-orders-discoveries-skill-drills-and-rest.ts';
import {
  resolveEquipItemsOrder,
  resolveSendItemOrder,
  resolveUseItemOrder,
} from './item-orders-equip-use-and-send-magic-items.ts';
import {
  resolveDisbandArmyOrder,
  resolveLeaveOrTransferArmyOrder,
  resolvePickUpArmyOrder,
  resolveReleaseHeroOrder,
} from './army-orders-hand-over-garrison-disband-and-pick-up-companies-and-release-a-hero.ts';
import {
  resolveAssassinateOrder,
  resolveGrandHeistOrder,
  resolveSabotageOrder,
  resolveSpyOrder,
  resolveStealOrder,
  resolveVanishOrder,
} from './espionage-orders-spy-steal-sabotage-grand-heist-assassinate-and-vanish.ts';
import { resolveCastSpellOrder } from './cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts';
import {
  resolveDefendOrder,
  resolveEncounterCharacterOrder,
} from './encounter-and-defend-orders-chasing-a-hero-down-and-keeping-watch.ts';
import {
  resolveBlockadeOrder,
  resolveChallengeOrder,
  resolveFeignedRetreatOrder,
  resolveGrandStratagemOrder,
  resolveLightningAdvanceOrder,
  resolveRaidTheCoastOrder,
  resolveRainOfArrowsOrder,
  resolveRampageOrder,
  resolveSnipersMarkOrder,
} from './war-mastery-orders-challenge-rampage-volleys-tactics-blockade-and-coast-raids.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';
import { botPracticeSkill } from '../bots/strategy.ts';
import { asItsGuardReadsIt } from '../personal-combat/to-hit-wounds-stuns-and-courage.ts';
import type { Character, Item, Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext, TurnOrder } from '../turn/context.ts';

/** A hero's order as the dispatch reads it: the turn's order, with the marks the engine and a bot's plan write on it
 *  (the hero whose battle he joined, a bot's least share of his hit points for a Search, the rumour's band a bot's
 *  Search waits for, and the lower band he takes at full health). */
type AnOrderAsTheDispatchReadsIt = TurnOrder & {
  readonly _unifiedWith?: number | null | undefined;
  readonly _botMinHp?: number | undefined;
  readonly _botIfRumour?: number | undefined;
  readonly _botIfRumourLow?: number | undefined;
  readonly _botIfRumourLowHp?: number | undefined;
};
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
/** The province a hero stands in, as the orders' typed functions take it: every living hero stands in a province of
 *  the map (the matrix's invariant "armies in real provinces"), so there is always one; for none, a TypeError, as the
 *  first read of it there would throw. */
function theProvinceAnOrderTakes(prov: Province | undefined): Province {
  if (!prov) throw new TypeError("Cannot read properties of undefined (reading 'id')");
  return prov;
}

// ── ONE HERO'S ORDER, CHECKED AND HANDED TO ITS ORDER'S FUNCTION (plan P1-08j9: lifted out of resolveTurn) ────
// processOrder carries out one hero's order for one phase: resolveTurn's phase loop calls it for each hero in turn.
// First the checks that come before any order: a hero unified into another's battle this phase is superseded; a
// bot's Practice on a skill already at 5 switches skill, and a bot's Search too hurt, on a rumour not heard, or out of
// the province it was written for becomes a Rest; a Move or an Encounter out of an unresolved battle is refused;
// a charmed enemy hero won't disband, perform the rites or spend a mastery; a mastery is charged once a turn; a Forced
// March becomes a Move that may slip past a battle; a spell item's Use Item becomes a cast. Then the switch hands the
// order to its own function (src/engine/orders/, rows j1 to j8). It takes the turn's context first
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
  const rawAction = (o.action || 'defend').toLowerCase().trim();
  // the actions by any name an order gives
  const actionsByName: Readonly<Partial<Record<string, string>>> = PHASE_ACTION_MAP;
  let action = (actionsByName[rawAction] ?? '') || 'defend';
  let _fmSlip = false; // MARCH L7 Forced March: set below when a forced-march move should try to slip past battle
  // 2026-09-28: a BOT slayer's second / third lair of the year carries _botMinHp — if an earlier fight left him
  // below that share of his HP, he rests instead of walking into another guardian half-dead. (Never set on
  // a player's order.)
  // 2026-09-29 (Toby): a BOT's Practice on a skill that has reached 5 SINCE its orders were written (an earlier
  // phase's practice or experience in the field this turn) switches to its next skill below 5 — unless it is
  // teaching a comrade practising that skill beside it this phase, or drilling troops that can still improve.
  if (action === 'practice' && c.player != null && asItsGuardReadsIt(_botPlayerIdx)?.has(c.player) && o.target) {
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
              normaliseAction(k) === 'practice' &&
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
          action = 'defend';
        }
      }
    }
  }
  if (
    action === 'search' &&
    o._botMinHp &&
    c.player != null &&
    (asItsGuardReadsIt(c.hp) ?? (c.maxHp || 20)) < (c.maxHp || 20) * o._botMinHp
  ) {
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'a hero too badly hurt to face another guardian rests instead', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: c.location,
    });
    action = 'rest';
  }
  // 2026-09-28 (option 2): a bot's "search if the talk is good" — only on a rumour THIS hero heard THIS turn about
  // this lair, at the band the order names (or the lower band for a Weak lair when he is at full health).
  if (action === 'search' && o._botIfRumour && c.player != null) {
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
        province: c.location,
      });
      action = 'rest';
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
    action === 'search' &&
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
      province: c.location,
    });
    action = 'rest';
  }
  const target = o.target || '';
  const extra = o.extra || '';
  const prov = provOf(turnContext, c);
  const player = c.player === null ? undefined : G.players[c.player]; // a wanderer's: none

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
  // by an enemy who died or withdrew never traps anyone.
  if (
    (action === 'move' || action === 'encounter' || action === 'pursue') &&
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
  if (c._charmTempControl) {
    // disbanding companies, an alignment's rite, or a mastery: what he will not do (the prose says it, by the action)
    const _refused = action === 'disband_army' || ALIGNMENT_ORDER_KEYS.has(action) || MASTERY_ORDER_KEYS.has(action);
    if (_refused) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a charmed hero will not carry out an order of his captor', heroName: c.name, action },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      turnContext._logCtx = { charId: null, phase: null };
      return;
    }
  }

  // ── ONCE PER TURN ── a mastery order may be attempted only once per turn per character.
  if (MASTERY_ORDER_KEYS.has(action)) {
    c._masteryOrderUsed = c._masteryOrderUsed ?? {};
    // the turn each mastery was last used, by any order's name
    const theMasteriesUsed: Partial<Record<string, number>> = c._masteryOrderUsed;
    if (theMasteriesUsed[action] === G.turn) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a hero has already used a mastery this turn', heroName: c.name, action },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      turnContext._logCtx = { charId: null, phase: null };
      return;
    }
    theMasteriesUsed[action] = G.turn;
  }

  // ── MARCH L7 — Forced March ── is now a MOVE with a 50% chance to slip past a battle this
  // phase. Remap it to the move handler (keeping the once-per-turn charge above) and flag the
  // slip locally.
  if (action === 'forced_march') {
    if (skillLevel(c, 'march') < 7) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a hero lacks the March mastery for a Forced March', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      turnContext._logCtx = { charId: null, phase: null };
      return;
    }
    _fmSlip = true;
    action = 'move';
  }

  // ── a SPELL ITEM used via Use Item becomes a cast of its spell at a flat 95%. ──
  let _itemCast: { item: string; spell: string | undefined } | null = null;
  if (action === 'use_item') {
    const theItems: readonly (AnItemAsTheSpellItemReadsIt | null | undefined)[] = asItsGuardReadsIt(c.items) ?? [];
    const _sit = theItems.find((x) => x && (String(x.id) === aTargetInWords(target) || x.name === target));
    // the spells' rows by any name an item gives (the key "undefined" for none, as JavaScript reads it)
    const spellDefs: Readonly<Partial<Record<string, object>>> = SPELL_DEFS_P;
    if (_sit?.effect?.stat === 'castSpell' && spellDefs[String(_sit.effect.spell)]) {
      _itemCast = { item: _sit.name, spell: _sit.effect.spell };
      action = 'cast_spell';
    }
  }

  switch (action) {
    case 'move':
      resolveMoveOrder(turnContext, c, ph, _fmSlip, target, prov, player);
      break;
    case 'explore':
      resolveExploreOrder(turnContext, c, prov);
      break;
    case 'rite':
      resolvePerformRiteOrder(turnContext, c, ph, target, extra, prov, player);
      break;
    case 'hunt_rumours':
      resolveHuntingRumoursOrder(turnContext, c, target, prov, player);
      break;

    case 'search':
      resolveSearchLairOrder(turnContext, c, ph, target, prov, player);
      break;
    case 'recruit':
      resolveRecruitArmiesOrder(turnContext, c, ph, target, extra, prov, player);
      break;
    case 'hire':
      resolveHireHeroOrder(turnContext, c, ph, target, prov, player);
      break;
    case 'spy':
      resolveSpyOrder(turnContext, c, target, prov);
      break;
    case 'consecrate':
      resolveConsecrateOrder(turnContext, c, prov, player);
      break;
    case 'call_to_arms':
      resolveCallToArmsOrder(turnContext, c, target, player);
      break;
    case 'broker':
      resolveBrokerOrder(turnContext, c, ph, target, player);
      break;
    case 'awaken_wild':
    case 'call_pit':
      resolveRemovedAwakenTheWildAndCallFromThePitOrders(turnContext, c, action);
      break;
    case 'harvest_field':
      resolveHarvestTheFieldOrder(turnContext, c, ph, prov, player);
      break;
    case 'research':
      resolveResearchOrder(turnContext, c, ph, target, player);
      break;
    case 'practice':
      resolvePracticeSkillOrder(turnContext, c, ph, target);
      break;
    case 'equip_items':
      resolveEquipItemsOrder(turnContext, c, target);
      break;
    case 'use_item':
      resolveUseItemOrder(turnContext, c, target, prov);
      break;
    case 'rest':
      resolveRestOrder(turnContext, c, prov);
      break;
    case 'give_item':
      resolveSendItemOrder(turnContext, c, ph, target, extra);
      break;
    case 'leave_army':
      resolveLeaveOrTransferArmyOrder(turnContext, c, ph, target, extra, prov);
      break;
    case 'release':
      resolveReleaseHeroOrder(turnContext, c, ph, prov, player);
      break;
    case 'disband_army':
      resolveDisbandArmyOrder(turnContext, c, target, prov);
      break;

    case 'pickup_army':
      resolvePickUpArmyOrder(turnContext, c, target, prov);
      break;
    case 'encounter':
      resolveEncounterCharacterOrder(turnContext, c, ph, target, theProvinceAnOrderTakes(prov));
      break;

    case 'steal':
      resolveStealOrder(turnContext, c, target, prov, player);
      break;

    case 'defend':
      resolveDefendOrder(turnContext, c, o, ph, theProvinceAnOrderTakes(prov));
      break;

    // the standalone 'pursue' case is removed — Pursue is folded into Encounter Character (see
    // the 'encounter' case above), and PHASE_ACTION_MAP aliases any saved 'pursue' order to
    // 'encounter' so in-flight games resolve cleanly.

    case 'cast_spell':
      resolveCastSpellOrder(turnContext, c, o, ph, target, extra, prov, player, _itemCast);
      break;

    // ══ L7/L9 MASTERY ORDERS (batch 2a) ════
    case 'sabotage':
      resolveSabotageOrder(turnContext, c, target);
      break;
    case 'grand_heist':
      resolveGrandHeistOrder(turnContext, c, ph, prov);
      break;
    case 'awaken_grove':
      resolveAwakenGroveOrder(turnContext, c, ph, prov);
      break;
    case 'chart_unknown':
      resolveChartTheUnknownOrder(turnContext, c, target, prov);
      break;
    case 'discover_ruin':
      resolveDiscoverLostRuinOrder(turnContext, c, target, prov);
      break;

    // ══ L7/L9 MASTERY ORDERS (batch 2b) ════
    case 'blockade':
      resolveBlockadeOrder(turnContext, c, target);
      break;
    case 'research_breakthrough':
      resolveResearchBreakthroughOrder(turnContext, c);
      break;
    case 'assassinate':
      resolveAssassinateOrder(turnContext, c, target, prov);
      break;
    case 'vanish':
      resolveVanishOrder(turnContext, c, prov);
      break;

    // ══ L7/L9 MASTERY ORDERS (batch 2c-i — immediate strikes) ════
    case 'challenge':
      resolveChallengeOrder(turnContext, c, target, theProvinceAnOrderTakes(prov));
      break;
    case 'rampage':
      resolveRampageOrder(turnContext, c, target, theProvinceAnOrderTakes(prov));
      break;
    case 'rain_of_arrows':
      resolveRainOfArrowsOrder(turnContext, c, target, theProvinceAnOrderTakes(prov));
      break;
    case 'snipers_mark':
      resolveSnipersMarkOrder(turnContext, c, target, theProvinceAnOrderTakes(prov));
      break;

    // ══ L7/L9 MASTERY ORDERS (batch 2c-ii — battle-strength flags) ════
    case 'feigned_retreat':
      resolveFeignedRetreatOrder(turnContext, c, theProvinceAnOrderTakes(prov));
      break;
    case 'grand_stratagem':
      resolveGrandStratagemOrder(turnContext, c, theProvinceAnOrderTakes(prov));
      break;
    case 'lightning_advance':
      resolveLightningAdvanceOrder(turnContext, c, theProvinceAnOrderTakes(prov));
      break;
    case 'raid_coast':
      resolveRaidTheCoastOrder(turnContext, c, theProvinceAnOrderTakes(prov));
      break;
    // ══ L7/L9 MASTERY ORDERS (batch 2c-iii — specials) ════
    case 'wild_calling':
      resolveWildCallingOrder(turnContext, c, ph, prov);
      break;
    case 'grand_design':
      resolveGrandDesignOrder(turnContext, c, prov);
      break;

    default:
  }
}
