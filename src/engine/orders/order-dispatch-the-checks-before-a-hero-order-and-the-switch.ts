// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { SPELL_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { ALIGNMENT_ORDER_KEYS, MASTERY_ORDER_KEYS, MASTERY_ORDER_LABEL, SKILL_LABELS } from '../army-tables.ts';
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
export function processOrder(turnContext, c, o, ph) {
  const { G, _botPlayerIdx } = turnContext;
  if (!c || !c.alive || !o) return;
  // If this hero was unified into another's battle this phase, their own order is superseded
  if (o._unifiedWith != null) {
    // filed under the hero himself (2026-10-09, Toby item 1): with no charId it fell into Realm Events
    emit(turnContext, {
      type: 'move',
      text: `${c.name}'s order superseded — they unified with ${G.characters.find((x) => x.id === o._unifiedWith)?.name || 'another hero'}'s forces this phase.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: c.id,
      phase: ph,
    });
    turnContext._logCtx = { charId: null, phase: null };
    return;
  }
  turnContext._logCtx = { charId: c.id, phase: ph }; // every line emitted inside here inherits this
  const rawAction = (o.action || 'defend').toLowerCase().trim();
  let action = PHASE_ACTION_MAP[rawAction] || 'defend';
  let _fmSlip = false; // MARCH L7 Forced March: set below when a forced-march move should try to slip past battle
  // 2026-09-28: a BOT slayer's second / third lair of the year carries _botMinHp — if an earlier fight left him
  // below that share of his HP, he rests instead of walking into another guardian half-dead. (Never set on
  // a player's order.)
  // 2026-09-29 (Toby): a BOT's Practice on a skill that has reached 5 SINCE its orders were written (an earlier
  // phase's practice or experience in the field this turn) switches to its next skill below 5 — unless it is
  // teaching a comrade practising that skill beside it this phase, or drilling troops that can still improve.
  if (action === 'practice' && c.player != null && _botPlayerIdx && _botPlayerIdx.has(c.player) && o.target) {
    const _S = String(o.target);
    const _sn = (G._phaseSkillSnapshot || {})[c.id] || c.skills || {};
    const _myL = _sn[_S] || 0;
    if (_myL >= 5 && !((_S === 'tactical' || _S === 'naval') && botDrillUseful(c, _S))) {
      const _teaching = (G.characters || []).some(
        (t) =>
          t &&
          t.alive &&
          t.id !== c.id &&
          t.player === c.player &&
          t.location === c.location &&
          (() => {
            const k = (G.turnOrders[t.id] || [])[ph];
            return (
              k &&
              normaliseAction(k) === 'practice' &&
              String(k.target) === _S &&
              (((G._phaseSkillSnapshot || {})[t.id] || t.skills || {})[_S] || 0) < _myL
            );
          })(),
      );
      if (!_teaching) {
        const _nx = botPracticeSkill(c);
        if (_nx) {
          o = { ...o, target: _nx, desc: 'Practice ' + (SKILL_LABELS[_nx] || _nx) };
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
    (c.hp != null ? c.hp : c.maxHp || 20) < (c.maxHp || 20) * o._botMinHp
  ) {
    emit(turnContext, {
      type: 'explore',
      text: `${c.name} is too badly hurt to face another guardian this season and rests instead.`,
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
    const _f = _pv && (_pv.features || [])[parseInt(o.target)];
    const _r = _f && _f._rumourOdds && _f._rumourOdds[c.player];
    const _hpR = (c.hp != null ? c.hp : c.maxHp || 20) / (c.maxHp || 20);
    const _ok = !!(
      _r &&
      _r.charId === c.id &&
      _r.turn === G.turn &&
      (_r.band >= o._botIfRumour ||
        (o._botIfRumourLow && _r.band >= o._botIfRumourLow && _hpR >= (o._botIfRumourLowHp || 0.95)))
    );
    if (!_ok) {
      emit(turnContext, {
        type: 'explore',
        text: `${c.name} weighs what the taverns said of the ${_f ? _f.name : 'lair'} and leaves it for another day.`,
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
  if (action === 'search' && o.prov != null && o.prov !== '' && String(o.prov) !== String(c.location)) {
    const _pw = G.world.provinces[parseInt(o.prov)];
    emit(turnContext, {
      type: 'explore',
      text: `${c.name} never reaches the lair they set out for${_pw ? ` in ${_pw.name}` : ''}, and will not go blind into another — the search is abandoned and they rest instead.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: c.location,
    });
    action = 'rest';
  }
  const target = o.target || '';
  const extra = o.extra || '';
  const prov = provOf(turnContext, c);
  const player = G.players[c.player];

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
    (c.armies || []).length > 0
  ) {
    const _foeHere =
      (G.characters || []).some(
        (x) =>
          x &&
          (x.alive || x._leaderlessHost) &&
          x.id !== c.id &&
          x.location === prov.id &&
          (x.armies || []).length > 0 &&
          (x.player == null || (x.player !== c.player && areEnemies(turnContext, c.player, x.player))),
      ) ||
      (prov.owner !== c.player && (prov.neutralDefenders || []).length > 0);
    if (_foeHere) {
      emit(turnContext, {
        type: 'combat',
        text: `${c.name} is still locked in the unresolved battle for ${prov.name} and cannot march away — the enemy is on the field and the fight must be seen through before the column can move on.`,
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
    const _why =
      action === 'disband_army'
        ? 'break up companies that are not theirs to disband'
        : ALIGNMENT_ORDER_KEYS.has(action)
          ? 'perform the rites of a realm they do not serve'
          : MASTERY_ORDER_KEYS.has(action)
            ? 'spend their own mastery for a crown that merely holds their mind'
            : null;
    if (_why) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} is held by an enchantment, not an oath — they will not ${_why}. The order comes to nothing.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      turnContext._logCtx = { charId: null, phase: null };
      return;
    }
  }

  // ── ONCE PER TURN ── a mastery order may be attempted only once per turn per character.
  if (MASTERY_ORDER_KEYS.has(action)) {
    c._masteryOrderUsed = c._masteryOrderUsed || {};
    if (c._masteryOrderUsed[action] === G.turn) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} has already used their ${MASTERY_ORDER_LABEL[action] || action} mastery this turn \u2014 it may be commanded but once per turn.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      turnContext._logCtx = { charId: null, phase: null };
      return;
    }
    c._masteryOrderUsed[action] = G.turn;
  }

  // ── MARCH L7 — Forced March ── is now a MOVE with a 50% chance to slip past a battle this
  // phase. Remap it to the move handler (keeping the once-per-turn charge above) and flag the
  // slip locally.
  if (action === 'forced_march') {
    if (skillLevel(c, 'march') < 7) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} lacks the March mastery (7) for a Forced March.`,
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
  let _itemCast = null;
  if (action === 'use_item') {
    const _sit = (c.items || []).find((x) => x && (String(x.id) === String(target) || x.name === target));
    if (_sit && _sit.effect && _sit.effect.stat === 'castSpell' && SPELL_DEFS_P[_sit.effect.spell]) {
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
      resolveEncounterCharacterOrder(turnContext, c, ph, target, prov);
      break;

    case 'steal':
      resolveStealOrder(turnContext, c, target, prov, player);
      break;

    case 'defend':
      resolveDefendOrder(turnContext, c, o, ph, prov);
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
      resolveChallengeOrder(turnContext, c, target, prov);
      break;
    case 'rampage':
      resolveRampageOrder(turnContext, c, target, prov);
      break;
    case 'rain_of_arrows':
      resolveRainOfArrowsOrder(turnContext, c, target, prov);
      break;
    case 'snipers_mark':
      resolveSnipersMarkOrder(turnContext, c, target, prov);
      break;

    // ══ L7/L9 MASTERY ORDERS (batch 2c-ii — battle-strength flags) ════
    case 'feigned_retreat':
      resolveFeignedRetreatOrder(turnContext, c, prov);
      break;
    case 'grand_stratagem':
      resolveGrandStratagemOrder(turnContext, c, prov);
      break;
    case 'lightning_advance':
      resolveLightningAdvanceOrder(turnContext, c, prov);
      break;
    case 'raid_coast':
      resolveRaidTheCoastOrder(turnContext, c, prov);
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
