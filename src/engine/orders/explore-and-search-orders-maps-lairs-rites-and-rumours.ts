// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import {
  RITE_OF_AWAKENING_COST,
  RITE_OF_AWAKENING_TAX,
  activatedSites,
  alignProto,
  protoAlignOf,
} from '../alignment-prototypes.ts';
import { KC_BASIC_EXPLORE, PRIMAL_ARMY_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { QUALITY_TIERS } from '../army-tables.ts';
import {
  ENCOUNTER_CLEAR_GOLD_BANDS,
  encounterClearGold,
  ensureLairHoard,
  featureTreasure,
  setFeatureTreasure,
} from '../world/tables.ts';
import {
  WILD_HUNT_TURNS,
  WILD_HUNT_UNITS,
  guardianCanUseItem,
  itemLoreLines,
  monsterCatLabel,
  wildHuntPrice,
} from '../items/tiers-and-hoards.ts';
import { isLegendaryItem } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { recordBattleGraves, recordDeadHeroSighting } from '../graves.ts';
import { noteItemFound, rollMagicItemFor } from '../items/lair-items.ts';
import { itemNameList } from '../heroes/fame-and-consecration.ts';
import { discoverFeat, featDiscovered } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { gainedItemNote, hasItemBase } from '../items/equipment.ts';
import { RUMOUR_COST_BY_POWER, applyItemMaxHp, noteLairRumour, pcLearnWeakness } from '../personal-combat/helpers.ts';
import { armyUnitName, d100, fmtRoll, rng } from '../dice-and-army-names.ts';
import { markProvinceCombat } from '../bots/intel.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { TM, creditMapped, perkTier, skillLevel } from '../titles/perks.ts';
import { discEff, discParam, discSum, hasDisc } from '../discoveries.ts';
import { emit, emitNarrLine, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';
import { charMinor } from '../titles/title-holders-and-battle-merit.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { refreshMovePool } from '../units/movement-pools.ts';
import {
  SKILLGAIN_COMMON,
  SKILLGAIN_STD,
  awardWinHp,
  trySkillGain,
} from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { resolveEncounter, rumourOddsBand, simulateLairOdds } from '../personal-combat/lair-guardians-and-the-odds.ts';
import { reportHeroFall } from '../heroes/hero-death-and-leaderless-hosts.ts';
import { resolveUnitGainInProvince } from '../battle/hosts-gained-in-a-province.ts';
import { botLairRating } from '../bots/strategy.ts';

// ── THE EXPLORE AND SEARCH ORDERS (plan P1-08j2: the second family taken out of processOrder in resolveTurn) ──
// Six orders a hero spends a phase on where he stands: Explore, Perform Rite, Hunting Rumours, Search Lair, Chart the
// Unknown (Explorer 7) and Discover Lost Ruin (Explorer 9), each once processOrder has read the order and checked he
// may act (a mastery once a turn, a search written for another province). Each takes the turn's context first
// (src/engine/turn/context.ts), then the values processOrder worked out before it that it reads, in the order
// processOrder declares them. Each body keeps processOrder's indent (plan P1-08's Decisions); a case-level break
// became a return.
// Explore: the province he stands in mapped further, and the lairs and ritual sites that come to light as it fills.
export function resolveExploreOrder(turnContext, c, prov) {
  const { G } = turnContext;
  trySkillGain(turnContext, c, 'explorer', SKILLGAIN_COMMON); // Explorer: performing an Explore order
  // AK 3.2: Basic Exploration Number × (Explorer skill + 1)% Terrain table: Plain 50%, Desert
  // 25%, Forest 15%, Mountain 15%, Jungle 10%, Sea 25% Base explore rate per terrain, cut 15
  // percentage points from the original
  // {plain:50,desert:40,forest:35,mountain:35,jungle:30,sea:40} to slow the early land-grab.
  const BASIC_EXPLORE = { ...KC_BASIC_EXPLORE };
  const basicRate = BASIC_EXPLORE[prov.terrain] || 15;
  // sd24 The Compass: Explorer treated as 1 level higher
  const explorerSkill = Math.min(5, effStat(turnContext, c, 'explorer'));
  // sd10 Scouts & Rangers: +20% explore bonus
  const scoutBonus = 1; // sd10 Scouts & Rangers / sd24 The Compass are now `explore` effects
  const loreMult = charMinor(turnContext, c, 'trailblazer') ? 1.05 : 1; // Trailblazer minor: +5% (Loremaster explore bonus removed \u2014 now an intel line)
  // (The old Elven "Pathfinder" double forest/jungle exploration has been REPLACED this session by
  // the Elven escape ability — see recordBattleGraves / flushElvenEscapes. No exploration
  // bonus now.)
  let _discExpl = 1;
  discEff(turnContext, c.player, 'explore').forEach((e) => {
    if (!e.terrains || e.terrains.includes(prov.terrain)) _discExpl *= e.mult || 1;
  }); // explore discoveries
  const _omens = protoAlignOf(G, c.player) === 'Pagan' ? 2 : 1; // PROTOTYPE Pagan (round 2): Omens — twice the ground
  const gain = Math.min(100, Math.floor(basicRate * (explorerSkill + 1) * scoutBonus * loreMult * _discExpl * _omens));
  if (!prov.exploredBy) prov.exploredBy = {};
  const before = prov.exploredBy[c.player] || 0;
  prov.exploredBy[c.player] = Math.min(100, before + gain);
  prov.explored = prov.exploredBy[c.player]; // keep legacy field for compatibility
  creditMapped(c, before, prov.exploredBy[c.player]); // TITLE MERIT: Cartographer
  // EXPLORER L8 — surveying the ground sometimes reveals richer land: 50% chance to +2 tax
  // base (max 10), permanent. EXPLORER L8: the rich-land survey can only pay off ONCE per
  // province — repeated Explore orders on the same ground no longer keep rolling the tax base
  // upward.
  if (perkTier(c, 'explorer') >= 3 && !prov._richSurveyed && kcRng() < 0.5) {
    prov._richSurveyed = true;
    const _b8 = prov.tax || 0;
    prov.tax = Math.min(10, _b8 + 2);
    if (prov.tax > _b8)
      emit(turnContext, {
        type: 'explore',
        text: `\u26f0 ${c.name}'s keen survey of ${prov.name} reveals richer land \u2014 its tax base rises to ${prov.tax}.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
  }
  // ANCIENT LORE (sd32) — the same Explore action also maps 10% of each adjacent province.
  if (hasDisc(turnContext, c.player, 'sd32')) {
    const _alPct = discParam('sd32', 'pct', 10);
    getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces).forEach((nb) => {
      if (!nb) return;
      if (!nb.exploredBy) nb.exploredBy = {};
      const _ab = nb.exploredBy[c.player] || 0;
      nb.exploredBy[c.player] = Math.min(100, _ab + _alPct);
      nb.explored = nb.exploredBy[c.player];
      creditMapped(c, _ab, nb.exploredBy[c.player]);
    });
  }
  // Feature discovery: proportional thresholds based on how many features exist At 100%
  // explored, all features visible. 1 feature=100%, 2=50%/100%, 4=25%/50%/75%/100% etc.
  const totalFeatures = (prov.features || []).length;
  const newlyDiscovered = [];
  if (totalFeatures > 0) {
    const threshold = 100 / totalFeatures; // % per feature
    prov.features.forEach((f, idx) => {
      if (
        !featDiscovered(f, c.player) &&
        !(f._hidden && f._hiddenBy !== c.player) &&
        prov.explored >= threshold * (idx + 1)
      ) {
        discoverFeat(f, c.player);
        c.merits = (c.merits || 0) + 1;
        TM(c).featuresFound += 1; // TITLE MERIT: Loremaster
        newlyDiscovered.push(f);
      }
    });
  }
  // Philosopher's Lens: reveals one random still-undiscovered lair here.
  if (hasItemBase(c, "Philosopher's Lens")) {
    const _lensPool = (prov.features || []).filter(
      (f) => f && !featDiscovered(f, c.player) && !(f._hidden && f._hiddenBy !== c.player),
    );
    if (_lensPool.length) {
      const _lf = _lensPool[Math.floor(kcRng() * _lensPool.length)];
      discoverFeat(_lf, c.player);
      c.merits = (c.merits || 0) + 1;
      TM(c).featuresFound += 1;
      newlyDiscovered.push(_lf);
      emit(turnContext, {
        type: 'explore',
        text: `🔍 The Philosopher's Lens shows ${c.name} what the ground itself hides — the ${_lf.name}.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
  }
  if ((prov.features || []).some((f) => f._hidden && f._hiddenBy !== c.player && !featDiscovered(f, c.player))) {
    emit(turnContext, {
      type: 'explore',
      text: `🌫 Something clouds ${c.name}'s exploration of ${prov.name} — a veiling illusion conceals lairs hidden here, and none can be discovered while it holds.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  }
  if (newlyDiscovered.length > 0) {
    const _art = (n) => {
      if (!n) return 'a creature';
      if (/s$/.test(n)) return n;
      return (/^[aeiou]/i.test(n) ? 'an ' : 'a ') + n;
    };
    // a ritual site has no guardian — report it as a ritual site.
    const _rtTail = (f) =>
      f.ritualSite
        ? `It is an ancient ritual site of the old gods — no guardian lairs here.`
        : `Legend says it is guarded by ${_art(f.monster?.name)}.`;
    if (newlyDiscovered.length === 1) {
      const f = newlyDiscovered[0];
      emit(turnContext, {
        type: 'explore',
        text: `${c.name} explores ${prov.name} (+${gain}%, now ${prov.explored}% mapped) and discovers the ${f.name}! ${_rtTail(f)}`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else {
      const frags = newlyDiscovered.map((f) =>
        f.ritualSite ? `the ${f.name} (a ritual site)` : `the ${f.name} (guarded by ${_art(f.monster?.name)})`,
      );
      const list = frags.slice(0, -1).join(', ') + ' and ' + frags[frags.length - 1];
      emit(turnContext, {
        type: 'explore',
        text: `${c.name} explores ${prov.name} (+${gain}%, now ${prov.explored}% mapped) and uncovers ${newlyDiscovered.length} sites: ${list}.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
  } else {
    // explorer training is handled once, at the top of this case, by trySkillGain — the old
    // extra 8%-capped-at-5 roll here bypassed the experience system and double-trained, so it
    // has been removed for consistency.
    emit(turnContext, {
      type: 'explore',
      text: `${c.name} explores ${prov.name} (+${gain}%, now ${prov.explored}% mapped). ${prov.explored < 30 ? 'Much of the province remains uncharted.' : prov.explored < 70 ? 'The province is becoming well-known.' : 'The province is thoroughly explored.'}`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  }
  recordDeadHeroSighting(turnContext, c.player, prov.id);
  return;
}
// Perform Rite (Pagan realms, at a ritual site): the Rite of the Wild Hunt, or the Blood Offering.
export function resolvePerformRiteOrder(turnContext, c, ph, target, extra, prov, player) {
  const { G } = turnContext;
  // ── PAGAN: Perform Rite ── Only Pagan realms; only at a DISCOVERED ritual site.
  if (G.players[c.player]?.alignment !== 'Pagan') {
    emit(turnContext, {
      type: 'system',
      text: `${c.name} does not keep the old faith — only Pagan realms may perform rites.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // a ritual site in your OWN province is always known to you (it shows on your map), so the
  // rite may be performed there without first Exploring. Elsewhere, the site must be
  // discovered.
  const _riteSite = (prov.features || []).find(
    (f) => f.ritualSite && !f.siteKind && (featDiscovered(f, c.player) || prov.owner === c.player), // a holy site or a barrow is no stones of the old gods
  );
  if (!_riteSite) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name} finds no ritual site in ${prov.name} — rites need standing stones, and stones must first be found.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // ONE RITE PER PROVINCE PER TURN (2026-09-19, Toby): once any realm's rite has been
  // performed here this turn, every later attempt in the province fails, whoever makes it.
  // Stamped with the turn number (prov._riteTurn) rather than a per-turn scratch flag, so there
  // is nothing to clear. Only a rite that actually HAPPENS stamps it — one that fails for want
  // of gold, creatures or units leaves the stones free for someone else.
  if (prov._riteTurn === G.turn) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name} comes to the ${_riteSite.name} in ${prov.name}, but the stones have already answered once this turn — the old gods will hear no second rite here until the turn has passed.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  const _rite = (target || '').toLowerCase();
  // PROTOTYPE Pagan: a rite performed at stones the realm holds activates them (the Favour of the Old Gods counts them).
  const _activate = () => {
    if (alignProto(G, 'Pagan') && prov.owner === c.player && prov._riteActivatedBy !== c.player) {
      prov._riteActivatedBy = c.player;
      emit(turnContext, {
        type: 'explore',
        text: `🔥 The stones of ${prov.name} (the ${_riteSite.name}) wake to ${player.name}: the realm's Favour of the Old Gods now counts ${activatedSites(G, c.player)} site${activatedSites(G, c.player) !== 1 ? 's' : ''}.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
  };
  if (_rite.startsWith('awaken')) {
    // ── PROTOTYPE Pagan: Rite of Awakening ── 10g at stones in a province the realm holds: the stones are activated for
    // good, and the province's tax rises by one (once).
    if (!alignProto(G, 'Pagan')) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} knows no Rite of Awakening.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (prov.owner !== c.player) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: only stones on the realm's own ground can be awakened — take ${prov.name} first.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (prov._riteActivatedBy === c.player && prov._awakened) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: the ${_riteSite.name} of ${prov.name} are awake already.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if ((player.gold || 0) < RITE_OF_AWAKENING_COST) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} cannot afford the Rite of Awakening's offering (${RITE_OF_AWAKENING_COST}g).`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    player.gold -= RITE_OF_AWAKENING_COST;
    prov._riteTurn = G.turn;
    if (!prov._awakened) {
      prov._awakened = G.turn;
      prov.tax = (prov.tax || 0) + RITE_OF_AWAKENING_TAX; // round 2 (Votive Hoards): +3
    }
    emit(turnContext, {
      type: 'combat',
      text: `\u{1F525} ${c.name} performs the Rite of Awakening at the ${_riteSite.name} (${RITE_OF_AWAKENING_COST}g of gold and grain burned on the stones). The old gods wake in ${prov.name}: the land gives +${RITE_OF_AWAKENING_TAX} tax from now on.`,
      audience: { actor: c.player, realms: [c.player], seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    _activate();
    return;
  }
  if (_rite.startsWith('ley')) {
    // ── PROTOTYPE Pagan: Rite of the Ley ── from stones the realm has found, the hero steps along the ley lines to any
    // other stones the realm has found (target 'ley:<province id>'). The host comes too; arriving in ground the realm
    // does not hold is settled as any host appearing there.
    if (!alignProto(G, 'Pagan')) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} knows no Rite of the Ley.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const _to = G.world.provinces[parseInt(_rite.split(':')[1])];
    const _toStones =
      _to && _to.id !== prov.id
        ? (_to.features || []).find(
            (f) => f && f.ritualSite && !f.siteKind && (featDiscovered(f, c.player) || _to.owner === c.player),
          )
        : null;
    if (!_toStones) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: the ley lines run only between stones the realm has found — name another ritual site.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    prov._riteTurn = G.turn;
    prov.characters = (prov.characters || []).filter((id) => id !== c.id);
    c.location = _to.id;
    _to.characters = _to.characters || [];
    if (!_to.characters.includes(c.id)) _to.characters.push(c.id);
    emit(turnContext, {
      type: 'move',
      text: `\u{1F525} ${c.name} walks the ley from the ${_riteSite.name} of ${prov.name} and steps out at the ${_toStones.name} of ${_to.name}.`,
      audience: { actor: c.player, realms: [c.player], seen: 'there' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: _to.id,
    });
    resolveUnitGainInProvince(turnContext, c, _to, ph);
    return;
  }
  if (_rite.startsWith('wild')) {
    // ── Rite of the Wild Hunt ── Bind the province's native primal creatures for this turn
    // and WILD_HUNT_TURNS more. The ONLY way to field Creatures/Monsters without Druid magic.
    const _wildType = (prov.armyTypes || []).find((t) => PRIMAL_ARMY_DEFS_P[t]);
    if (!_wildType) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} calls the Wild Hunt at the ${_riteSite.name}, but nothing wild answers in ${prov.name} — the rite needs a province where Creatures or Monsters still roam.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    const _huntCost = wildHuntPrice(_wildType);
    if ((player.gold || 0) < _huntCost) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} cannot afford the Wild Hunt offerings (${_huntCost}g).`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    player.gold -= _huntCost;
    prov._riteTurn = G.turn; // the province's one rite this turn is spent
    _activate();
    c.armies = c.armies || [];
    const _boundNames = [];
    for (let wi = 0; wi < WILD_HUNT_UNITS; wi++) {
      // the bound beasts are VETERAN. _wildHuntUntilTurn is the LAST turn they serve
      // (released by the end-of-turn sweep once G.turn has advanced PAST it).
      const _u = {
        type: _wildType,
        quality: 'Veteran',
        race: prov.race || 'Primal',
        unitName: armyUnitName(_wildType),
        _wildHuntUntilTurn: G.turn + WILD_HUNT_TURNS + discSum(turnContext, c.player, 'wildHunt', 'turns'),
      }; // + ap08 The Long Hunt
      c.armies.push(_u);
      _boundNames.push(`${_u.unitName} (${_wildType})`);
    }
    emit(turnContext, {
      type: 'combat',
      text: `\u{1F525} ${c.name} performs the Rite of the Wild Hunt at the ${_riteSite.name} (${_huntCost}g — the price of a single beast, whatever number answer). The old gods answer: ${_boundNames.join(' and ')} come down from the wilds to serve as veterans — they draw no wages, and hold until the end of next turn, when the binding fails.`,
      audience: { actor: c.player, realms: [c.player], seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    // Gaining a force in a province you don't own is resolved like any other unit gain:
    // defenders present means a battle, none means the character takes control.
    resolveUnitGainInProvince(turnContext, c, prov, ph);
    return;
  }
  // ── Blood Offering (default) ── The player names units to SACRIFICE and an EQUAL number of
  // units to EMPOWER; each empowered unit gains TWO experience tiers (capped at Elite). Some
  // units are given up to make others stronger. Encoded in the order's `extra` as
  // "S:i,j|E:a,b" — indices into the character's army. Borrowed/temporary/skeletal units can
  // be neither offered nor raised.
  const _tiers = QUALITY_TIERS.slice();
  const _army = c.armies || [];
  const _bOffElig = (i) => {
    const a = _army[i];
    return !!a && !a._temporary && a._wildHuntUntilTurn == null && !a._isSkeletal;
  };
  let _sacI = [],
    _benI = [];
  const _bm = /S:([0-9,]*)\|E:([0-9,]*)/.exec((extra || '').trim());
  if (_bm) {
    _sacI = [
      ...new Set(
        _bm[1]
          .split(',')
          .filter((x) => x !== '')
          .map(Number),
      ),
    ].filter((i) => Number.isInteger(i) && _bOffElig(i));
    _benI = [
      ...new Set(
        _bm[2]
          .split(',')
          .filter((x) => x !== '')
          .map(Number),
      ),
    ].filter((i) => Number.isInteger(i) && _bOffElig(i) && !_sacI.includes(i));
  }
  // Legacy/no-selection fallback: sacrifice one own unit to raise one other by two tiers.
  if (_sacI.length === 0 || _benI.length === 0) {
    const _own = _army.map((a, i) => i).filter(_bOffElig);
    if (_own.length >= 2) {
      _sacI = [_own[0]];
      _benI = [_own[1]];
    } else {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} makes no Blood Offering — name units to sacrifice and an equal number to empower (needs at least two of its own units).`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
  }
  const _bn = Math.min(_sacI.length, _benI.length); // each sacrifice funds exactly one empowerment
  const _sac = _sacI.slice(0, _bn).map((i) => _army[i]);
  const _ben = _benI.slice(0, _bn).map((i) => _army[i]);
  prov._riteTurn = G.turn; // the province's one rite this turn is spent
  _activate();
  c.armies = _army.filter((a) => !_sac.includes(a));
  recordBattleGraves(turnContext, prov, _sac);
  _ben.forEach((b) => {
    const cur = _tiers.indexOf(b.quality);
    if (cur > -1) b.quality = _tiers[Math.min(4, cur + 2)];
  });
  if (typeof refreshMovePool === 'function') refreshMovePool(turnContext, c); // the host is smaller now — pace may change
  emit(turnContext, {
    type: 'combat',
    text: `\u{1FA78} ${c.name} makes a Blood Offering at the ${_riteSite.name} — ${_sac.map((a) => a.unitName || a.type).join(', ')} (${_bn} unit${_bn !== 1 ? 's' : ''}) are given to the old gods, and their strength passes to ${_ben.map((a) => `${a.unitName || a.type} (rise to ${a.quality})`).join(', ')}.`,
    audience: { actor: c.player, realms: [c.player], seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  return;
}
// ── HUNTING RUMOURS (2026-09-17 (late), Toby item 3) ────
// The character spends the phase in the taverns and byways of the province asking after the
// lairs they know of there. Target: comma-separated indexes into prov.features (the same idx
// the Search Lair form uses). Each lair costs gold by grade (RUMOUR_COST_BY_POWER), paid up
// front and in the order chosen; when the purse runs dry the rest are skipped. For each lair
// paid for, all THREE facts are learned (2026-09-23d, Toby — no roll): the guardian's weakness
// (learned for good, exactly as a Scout would learn it), the hoard behind it (exact gold and
// the magic that lies there), and the hero's own odds — measured by simulateLairOdds and read
// back as one of five narrative bands.
export function resolveHuntingRumoursOrder(turnContext, c, target, prov, player) {
  const { G } = turnContext;
  const _cost = RUMOUR_COST_BY_POWER;
  const _idxs = [
    ...new Set(
      String(target || '')
        .split(',')
        .map((s) => parseInt(String(s).trim()))
        .filter((n) => !isNaN(n) && n >= 0),
    ),
  ];
  const _total = (prov.features || []).length,
    _explHere = (prov.exploredBy && prov.exploredBy[c.player]) || 0;
  const _feats = _idxs
    .map((i) => ({ f: (prov.features || [])[i], i }))
    .filter(({ f, i }) => {
      if (!f || f.cleared || f.ritualSite || !f.monster) return false;
      const thr = _total > 0 ? Math.ceil(100 / _total) * (i + 1) : 100; // the order form's own visibility rule
      return featDiscovered(f, c.player) || _explHere >= thr;
    });
  if (!_feats.length) {
    emit(turnContext, {
      type: 'explore',
      text: `${c.name} asks after the lairs of ${prov.name}, but no one has anything to tell — there is no known lair here to ask about.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  emit(turnContext, {
    type: 'explore',
    text: `🍺 ${c.name} spends the season in the taverns and on the roads of ${prov.name}, hunting rumours of ${_feats.length} lair${_feats.length !== 1 ? 's' : ''}.`,
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  for (const { f, i: _fi } of _feats) {
    const m = f.monster;
    const grade = (m && m.power) || f.tier || 'Weak';
    const price = _cost[grade] || 1;
    if ((player.gold || 0) < price) {
      emit(turnContext, {
        type: 'explore',
        text: `  ${c.name} cannot afford the ${price}g the ${f.name}'s rumours would cost (${player.gold || 0}g in the treasury) — the rest of the hunt is abandoned.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      break;
    }
    player.gold -= price;
    const gname = `${m.name}${monsterCatLabel(m) ? ` (${monsterCatLabel(m)})` : ''}`; // the kind keeps its capital: "(elemental)" read as a magic school written in lower case
    const lines = [
      `  💰 ${price}g buys the talk of the ${f.name} — ${gname}, a ${String(grade).toLowerCase()} guardian.`,
    ];
    // 1) the weakness
    {
      if (m.weak) {
        const fresh = pcLearnWeakness(G, c.player, m.name);
        lines.push(
          `  ✓ Its weakness: ${m.weak.name} — ${m.weak.desc}.${fresh ? ' Your realm marks every ' + m.name + ' with it from now on.' : ''}`,
        );
      } else lines.push(`  ✓ Its weakness: none that anyone knows of — the ${m.name} has no exploitable flaw.`);
    }
    // 2) the hoard
    {
      ensureLairHoard(f, G);
      const gold = encounterClearGold(f);
      const _hi = f.hoardItems || [],
        _st = f._stolenItems || [];
      let itemOut = _hi.length ? `, and ${itemNameList(_hi)}` : '';
      if (!_hi.length)
        itemOut = _st.length
          ? ` — its magic (${_st.join(', ')}) has already been lifted by a thief`
          : ' — no magic lies there';
      else if (_st.length) itemOut += ` (a thief has already made off with ${_st.join(', ')})`;
      const _wield = _hi.filter((it) => guardianCanUseItem(m, it));
      if (_wield.length) itemOut += `. Beware: it wields ${_wield.map((x) => x.name).join(', ')} against all comers`;
      lines.push(`  ✓ Its hoard: the ${m.name} sits on exactly ${gold}g${itemOut}.`);
      // Remembered on the realm so the Known Lairs card shows it next turn and after (the
      // odds are deliberately NOT stored — they belong to one hero on one day, and that
      // hero will change).
      noteLairRumour(player, prov.id, _fi, {
        turn: G.turn,
        gold,
        items: _hi.map((x) => x.name),
        stolen: _st.slice(),
        wields: _wield.map((x) => x.name),
      });
    }
    // 3) the odds
    {
      const odds = simulateLairOdds(turnContext, c, f);
      // Sept 2026: the band the hero was told is kept on the feature (per realm, per hero, with the hero's
      // fighting rating at the time) so a bot can act on exactly what a player reads — nothing more.
      if (odds) {
        f._rumourOdds = f._rumourOdds || {};
        f._rumourOdds[c.player] = {
          turn: G.turn,
          charId: c.id,
          band: rumourOddsBand(odds.pct).max,
          rating: botLairRating(c),
        };
      }
      if (odds) {
        const band = rumourOddsBand(odds.pct);
        lines.push(`  ✓ Your chances: as you stand today, ${band.text(m.name)}.`);
      } else lines.push(`  ✓ Your chances: nobody could say how ${c.name} would fare.`);
    }
    lines.forEach((t) =>
      emit(turnContext, {
        type: 'explore',
        text: t,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      }),
    );
  }
  trySkillGain(turnContext, c, 'spy', SKILLGAIN_COMMON); // a season of asking questions is Spy fieldwork, at the common (move/explore) rate
  return;
}
// Search Lair: the fight with a lair's guardian, and what the hero carries off, or leaves behind.
export function resolveSearchLairOrder(turnContext, c, ph, target, prov, player) {
  const { G, _tel } = turnContext;
  // Find the feature
  let fi = 0;
  if (target && !isNaN(parseInt(target))) fi = parseInt(target);
  if (!prov.features || prov.features.length === 0) {
    emit(turnContext, {
      type: 'explore',
      text: `${c.name} searches ${prov.name} but finds nothing of note.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // 2026-09-29: a search that NAMES a lair searches that lair or none — no falling back on some
  // other uncleared lair here (that fallback sent heroes into guardians they had never assessed).
  const _named = target !== '' && !isNaN(parseInt(target));
  if (_named && !prov.features[fi]) {
    emit(turnContext, {
      type: 'explore',
      text: `${c.name} looks for the lair they meant to search in ${prov.name}, but it is not here.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  let f =
    prov.features[fi] ||
    prov.features.find((fe) => fe && !fe.cleared && !fe.ritualSite) ||
    prov.features.find((fe) => fe && !fe.ritualSite) ||
    prov.features[0];
  if (!f) {
    return;
  }
  // A RITUAL SITE CANNOT BE SEARCHED (Toby 2026-09-20): it holds no guardian and no hoard, and
  // the order form no longer offers one. An old saved order that names one is refused here.
  if (f.ritualSite) {
    // Nothing lairs at a ritual site — there is no guardian to fight and no treasure to lift.
    const isPagan = G.players[c.player]?.alignment === 'Pagan';
    emit(turnContext, {
      type: 'explore',
      text: `${c.name} walks the ${f.name} of ${prov.name}. The old stones hum with something older than realms${isPagan ? ' — a Pagan may Perform Rites here' : ', but they do not answer'}.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  if (f.cleared) {
    emit(turnContext, {
      type: 'explore',
      text: `${c.name} revisits the cleared ${f.name} in ${prov.name}.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  if (!featDiscovered(f, c.player)) {
    discoverFeat(f, c.player);
    TM(c).featuresFound += 1;
  } // TITLE MERIT: Loremaster
  const plan = c.encounterPlan || { tactics: ['ME'] };
  markProvinceCombat(prov, [c.player]); // purple swords: a personal combat, not a field battle
  const encounter = resolveEncounter(
    turnContext,
    c,
    f,
    prov,
    plan.tactics || ['ME'],
    (...a) => effStat(turnContext, ...a),
    rng,
    player,
  );
  try {
    _tel.encounters.push({
      ph,
      pi: c.player,
      charId: c.id,
      prov: prov.id,
      feature: f.name || null,
      guardian: (f.monster && f.monster.name) || null,
      power: (f.monster && f.monster.power) || null,
      won: !!encounter.won,
      fled: !!encounter.fled,
      dmg: encounter.damageToHero || 0,
      hpAfter: encounter.heroHpAfter,
      killed: !!encounter.heroKilled,
      tactics: (plan.tactics || ['ME']).slice(0, 12),
    });
  } catch (_te) {}
  encounter.narrative.forEach((line) => {
    emitNarrLine(turnContext, line, {
      type: 'explore',
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  });

  // Hero killed by monster?
  if (encounter.heroKilled) {
    // 2026-10-13 (item 19): the death is resolved first (reportHeroFall), so a hero Battlefield
    // Surgery saves reads "at death's door, but not slain" and keeps every item; only a hero who
    // really dies leaves his possessions in the hoard.
    // a character who falls to a lair guardian leaves ALL their magic items among the bones —
    // they become extra treasure for whoever finally slays the guardian. (Mithril Armour is a
    // personal granted relic that re-issues each turn, so it is not left behind.) Clearing
    // c.items before handleHeroDeath stops the possessions passing to the king/heir instead.
    const _lairLeft = (c.items || []).filter((it) => !(it.effect && it.effect.stat === 'mithrilArmour'));
    const _lairHeld = (c.items || []).slice();
    if (_lairLeft.length > 0) c.items = (c.items || []).filter((it) => it.effect && it.effect.stat === 'mithrilArmour');
    const _lairDied = reportHeroFall(
      turnContext,
      c,
      null,
      `💀 ${c.name} has been slain by the ${f.monster?.name || 'creature'}!`,
      {
        audience: { actor: c.player, realms: [c.player], seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      },
      { slainBy: `the ${f.monster?.name || 'guardian'} of ${prov.name}` },
    ); // the host is told what slew its commander (2026-10-12)
    if (_lairDied === false) {
      c.items = _lairHeld;
      return;
    } // saved, or escaped: nothing is left among the bones
    if (_lairLeft.length > 0) {
      f.hoardItems = (f.hoardItems || []).concat(_lairLeft); // joins the lair's hoard
      emit(turnContext, {
        type: 'explore',
        text: `The ${f.monster?.name || 'guardian'} drags ${c.name}'s possessions into its hoard — ${_lairLeft.map((it) => it.name).join(', ')} now lie among the bones, waiting for a stronger hand.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
    return; // no further order processing for this hero
  }
  const stolenByThief = encounter.fled && f.monster?._treasureStolen;
  if (stolenByThief) {
    // Steal tactic: the hero escapes with a cut of the feature's hoard; the guardian stays.
    // The take is 10-25% of the feature's OWN `treasure`, and that treasure is permanently
    // reduced — so repeated stealing genuinely drains the hoard, and once it is empty there
    // is nothing left to lift. (Winning the fight still pays the full tiered reward below;
    // that is separate, and the treasure the guardian sat on is spoils of victory.)
    if (f.monster) delete f.monster._treasureStolen;
    ensureLairHoard(f, G);
    const hoard = featureTreasure(f);
    if (f._hoardGoldOrig == null) f._hoardGoldOrig = hoard; // back-compat for pre-revision saves
    if (hoard <= 0) {
      if (c.player != null) {
        f._pickedCleanBy = f._pickedCleanBy || [];
        if (!f._pickedCleanBy.includes(c.player)) f._pickedCleanBy.push(c.player);
      } // 2026-09-29: this realm now KNOWS the hoard is empty (bots stop robbing it)
      emit(turnContext, {
        type: 'explore',
        text: `${c.name} slips past the ${f.monster?.name || 'guardian'} of the ${f.name}, but the hoard is already picked clean — nothing left to steal.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else {
      // Thief revision: the cut is 10% PER THIEF LEVEL (capped at 5 → 50%) of the
      // hoard's ORIGINAL size, so skill decides the haul and a full-strength thief empties a
      // lair in two visits. Never more than what is actually left.
      const _thLvl = Math.min(5, effStat(turnContext, c, 'thief'));
      const gold = Math.max(1, Math.min(hoard, Math.round((f._hoardGoldOrig || hoard) * 0.1 * _thLvl)));
      setFeatureTreasure(f, hoard - gold);
      player.gold = (player.gold || 0) + gold;
      c.merits = (c.merits || 0) + gold;
      const left = featureTreasure(f);
      if (left <= 0 && c.player != null) {
        f._pickedCleanBy = f._pickedCleanBy || [];
        if (!f._pickedCleanBy.includes(c.player)) f._pickedCleanBy.push(c.player);
      } // 2026-09-29: emptied it — known to this realm
      const _dregs =
        left <= 0 ? ` They have cleaned out the last of it — the hoard is empty.` : ` (~${left}g still hidden here.)`;
      emit(turnContext, {
        type: 'explore',
        text: `${c.name} escapes with ${gold}g lifted from the ${f.name}'s hoard (Thief ${_thLvl}: ${_thLvl * 10}% of the original hoard)! The ${f.monster?.name || 'guardian'} still guards the site.${_dregs}`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
    // a thief may also lift ONE of the hoard's magic items — 30% + 10% per Thief level (max
    // 80%).
    // LEGENDARY relics can never be lifted from a lair (Toby 2026-09-20) — only won by
    // beating the guardian. (They can still be stolen from another character.)
    {
      ensureLairHoard(f, G);
      const _hiAll = f.hoardItems || [];
      const _hi = _hiAll.filter((it) => !isLegendaryItem(it));
      if (!_hi.length && _hiAll.length)
        emit(turnContext, {
          type: 'explore',
          text: `${c.name} eyes the ${f.monster?.name || 'guardian'}'s relic, but a Legendary treasure is not something that can be spirited away — it must be won by defeating its keeper.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
      if (_hi.length) {
        const _th = effStat(turnContext, c, 'thief');
        const _ch = Math.min(80, 30 + 10 * _th);
        const _r = d100();
        if (_r <= _ch) {
          const _it = _hi[Math.floor(kcRng() * _hi.length)];
          _hiAll.splice(_hiAll.indexOf(_it), 1);
          c.items = c.items || [];
          c.items.push(_it);
          applyItemMaxHp(c, _it);
          f._stolenItems = (f._stolenItems || []).concat(_it.name);
          emit(turnContext, {
            type: 'explore',
            text: `🗝 ${c.name} also slips ${isLegendaryItem(_it) ? 'the LEGENDARY ' : 'the '}${_it.name} (${_it.desc}) out from under the guardian's nose! ${fmtRoll(_ch, _r)}`,
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          });
          emit(turnContext, {
            type: 'explore',
            text: gainedItemNote(c, [_it]),
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          }); // item 10
        } else
          emit(turnContext, {
            type: 'explore',
            text: `${c.name} eyes the hoard's magic but cannot get near it. ${fmtRoll(_ch, _r)}`,
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          });
      }
    }
  } else if (encounter.won) {
    f.cleared = true;
    if (c.player != null) {
      const _g = (f.monster && f.monster.power) || f.tier || 'Weak';
      c._botLairKills = c._botLairKills || {};
      c._botLairKills[_g] = (c._botLairKills[_g] || 0) + 1;
    } // 2026-09-26: the slayer's grade ladder reads this (botLairPlan)
    // TITLE MERIT: Monster-Bane — HP of the beast overcome (half credit if
    // pacified/parleyed).
    if (f.monster) TM(c).monster += Math.round((f.monster.hp || 0) * (encounter.pacified ? 0.5 : 1));
    const tier = f.monster?.power || 'Weak';
    // Reward ladder — tougher monsters are meaningfully more worthwhile (gold + item odds +
    // HP).
    const T = { gold: ENCOUNTER_CLEAR_GOLD_BANDS[tier] || [1, 5] }; // Sept 2026 redesign: one gold table; no HP reward
    // pay out the cached clear-gold roll so a scouted figure is exactly honoured; if the site
    // was never scouted, encounterClearGold rolls it now from the same tier band (T.gold).
    const gold = encounterClearGold(f);
    const goldFinal = Math.round(
      gold *
        (1 +
          discSum(
            turnContext,
            c.player,
            'lairGold',
            'pct',
            (e) => (!e.terrains || e.terrains.includes(prov.terrain)) && (!e.charRace || c.race === e.charRace),
          )),
    ); // lairGold discoveries. Monster-Bane +50% hoard removed \u2014 the title is now an intel line
    player.gold = (player.gold || 0) + goldFinal;
    c.merits = (c.merits || 0) + goldFinal;
    setFeatureTreasure(f, 0); // the hoard is lifted
    // 2026-10-14 (batch item 8, Toby): carrying off a cleared lair's hoard no longer trains Thief
    // (it did from 2026-09-21). Stealing from a guardian mid-fight still does.
    // the tier-weighted fighting-skill experience roll for a lair clear is DROPPED; the only
    // permanent reward is the earned-HP gain. A pacified beast earns nothing.
    if (!encounter.pacified) awardWinHp(turnContext, c, null, 'lair'); // clearing a lair by force hardens the hero (earned HP)
    // the automatic "catches their breath" heal (half of the HP lost) after a lair win is
    // REMOVED. The hero leaves the fight at the HP the encounter left them on; recovery now
    // comes only from Rest, Herbal Lore (sd29), Mass Healing (White L6+) and in-fight
    // items/spells.
    // (c.hp already holds the post-fight value — resolveEncounter writes it back; nothing to add here.)
    // Item drops — chance/quantity scale with tier, and item QUALITY scales with tier too.
    // uniqueness. `_taken` seeds from the game-wide roll of items already found
    // (G._awardedItems) and grows as each drop is chosen, so no lair — this one or any other
    // — can ever hand out a duplicate. A null means the treasury is exhausted (gold only).
    // Item 4: the lair's items were fixed at world gen (hoardItems) — the clearer takes them
    // ALL (any kit left by slain challengers is already merged in). Discovery bonus finds
    // still roll fresh.
    ensureLairHoard(f, G);
    const drops = [];
    if (!Array.isArray(G._awardedItems)) G._awardedItems = [];
    const _taken = new Set(G._awardedItems);
    // bonus finds are drawn from the category this realm has found LEAST of.
    const rollItem = () => {
      const base = rollMagicItemFor(G, c.player, tier, _taken);
      if (!base) return null;
      _taken.add(base.name);
      G._awardedItems.push(base.name);
      const itemId = G.nextItemId || 0;
      G.nextItemId = (G.nextItemId || 0) + 1;
      return { ...base, id: itemId };
    };
    (f.hoardItems || []).forEach((it) => drops.push(it));
    f.hoardItems = [];
    const baseDrops = drops.slice(); // the hoard's own magic, narrated below; bonus finds announce themselves.
    // sd25 Alchemical Theory: 10% chance of an extra find.
    {
      const _dIC = discSum(
        turnContext,
        c.player,
        'itemChance',
        'pct',
        (e) => !e.terrains || e.terrains.includes(prov.terrain),
      );
      if (_dIC > 0 && kcRng() < _dIC) {
        const bonus = rollItem();
        if (bonus) {
          drops.push(bonus);
          emit(turnContext, {
            type: 'explore',
            text: `Your realm's lore yields an extra find: the ${bonus.name}!`,
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          });
          emit(turnContext, {
            type: 'explore',
            text: itemLoreLines([bonus]),
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          });
        }
      }
    } // itemChance discoveries
    c.items = c.items || [];
    drops.forEach((it) => {
      c.items.push(it);
      applyItemMaxHp(c, it);
      /* item 6 */ noteItemFound(G, c.player, it);
    }); // tally what this realm has found, by category
    // Narrate the magic actually won here.
    // SILENTLY: the report then fell through to the "no magic this time" line even though the hero
    // walked away with an item — the bug Toby saw (gold reported, no item reported, item in
    // pack).
    if (baseDrops.length > 0) {
      emit(turnContext, {
        type: 'explore',
        text: `Victory! ${c.name} claims ${gold}g from the ${f.name} and hauls out ${itemNameList(baseDrops, false)}.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      baseDrops.forEach((it) =>
        emit(turnContext, {
          type: 'explore',
          text: itemLoreLines([it]),
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        }),
      ); // one lore line per relic won
    }
    if (drops.length > 0)
      emit(turnContext, {
        type: 'explore',
        text: gainedItemNote(c, drops),
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      }); // item 10: worn at once, or no room
    // recover any items earlier challengers left behind when the guardian slew them.
    if ((f.lairItems || []).length > 0) {
      const _recovered = f.lairItems.slice();
      _recovered.forEach((it) => {
        c.items.push(it);
        applyItemMaxHp(c, it); /* item 6 */
      });
      f.lairItems = [];
      emit(turnContext, {
        type: 'explore',
        text: `Among the bones of the fallen, ${c.name} recovers ${itemNameList(_recovered, false)}.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      _recovered.forEach((it) =>
        emit(turnContext, {
          type: 'explore',
          text: itemLoreLines([it]),
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        }),
      ); // lore line per recovered relic
      emit(turnContext, {
        type: 'explore',
        text: gainedItemNote(c, _recovered),
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      }); // item 10
    }
    // Only claim "no magic" when the fight truly yielded no items — no tier drops AND no
    // Alchemical bonus AND no recovered lair items.
    else if (drops.length === 0)
      emit(turnContext, {
        type: 'explore',
        text: `Victory! ${c.name} claims ${gold}g from the ${f.name}, though the lair holds no magic${(f._stolenItems || []).length ? ` — a thief got here first and lifted ${f._stolenItems.join(', ')}` : ''}.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
  } else if (!encounter.fled) {
    const dmg = encounter.damageToHero || rng(2, 7);
    c.hp = Math.max(1, c.hp - dmg);
    emit(turnContext, {
      type: 'combat',
      text: `${c.name} is forced to retreat from the ${f.name}, wounded. HP: ${c.hp}/${c.maxHp}`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  }
  return;
}
// Chart the Unknown (Explorer 7, once a turn): one province mapped in full, and a glimpse of the ring round it.
export function resolveChartTheUnknownOrder(turnContext, c, target, prov) {
  const { G } = turnContext;
  // Explorer L7: the survey may be run on the province the character stands in OR any
  // province adjacent to it — a cartographer works a horizon, not just the ground under their
  // boots. An empty or unrecognised target still means "here".
  if (skillLevel(c, 'explorer') < 7) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name} lacks the Explorer mastery (7) to Chart the Unknown.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const _cuHereNbrs = getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces).filter(Boolean);
  const _cuId = parseInt(target);
  let _cuProv = prov;
  if (Number.isInteger(_cuId) && _cuId !== prov.id) {
    const _cand = G.world.provinces[_cuId];
    if (!_cand || !_cuHereNbrs.some((nb) => nb.id === _cuId)) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} cannot chart that ground from ${prov.name} — Chart the Unknown reaches this province or one bordering it.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    _cuProv = _cand;
  }
  if (!_cuProv.exploredBy) _cuProv.exploredBy = {};
  _cuProv.exploredBy[c.player] = 100;
  _cuProv.explored = 100;
  (_cuProv.features || []).forEach((f) => {
    if (!featDiscovered(f, c.player)) {
      discoverFeat(f, c.player);
      c.merits = (c.merits || 0) + 1;
      TM(c).featuresFound += 1;
    }
  });
  // Reveal the CHARTED province's neighbours at a glance (partial sighting).
  const nbrs = getNeighborsP(_cuProv, G.world.cols, G.world.rows, G.world.provinces).filter(Boolean);
  let revealed = 0;
  nbrs.forEach((nb) => {
    if (!nb.exploredBy) nb.exploredBy = {};
    if ((nb.exploredBy[c.player] || 0) < 25) {
      nb.exploredBy[c.player] = 25;
      nb.explored = Math.max(nb.explored || 0, nb.exploredBy[c.player]);
      revealed++;
    }
  });
  emit(turnContext, {
    type: 'explore',
    text: `🧭 ${c.name} charts ${_cuProv.name}${_cuProv !== prov ? ` from across the border in ${prov.name}` : ''} in full and scouts its ${nbrs.length} neighbour${nbrs.length !== 1 ? 's' : ''}${revealed ? ` (${revealed} newly glimpsed)` : ''}.`,
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: _cuProv.id,
  });
  trySkillGain(turnContext, c, 'explorer', SKILLGAIN_STD);
  return;
}
// Discover Lost Ruin (Explorer 9, once a turn): every lair of one class here and next door laid bare.
export function resolveDiscoverLostRuinOrder(turnContext, c, target, prov) {
  const { G } = turnContext;
  // Explorer L9: the order now names a CLASS of lair — Weak, Moderate, Powerful or Legendary
  // — and lays bare EVERY lair of that class in this province and in each province bordering
  // it. A ritual site counts as its own class ('Ritual'). A rival's Hide Lairs glamour still
  // holds against it; those lairs stay concealed.
  if (skillLevel(c, 'explorer') < 9) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name} lacks the Explorer mastery (9) to Discover a Lost Ruin.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const _drTiers = ['Weak', 'Moderate', 'Powerful', 'Legendary', 'Ritual'];
  const _drWant =
    _drTiers.find(
      (t) =>
        t.toLowerCase() ===
        String(target || '')
          .trim()
          .toLowerCase(),
    ) || 'Weak';
  const _drClassOf = (f) => (f && f.ritualSite ? 'Ritual' : (f && f.monster && f.monster.power) || 'Weak');
  const _drScope = [prov, ...getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces).filter(Boolean)];
  const _drFound = [];
  _drScope.forEach((pv) => {
    (pv.features || []).forEach((f) => {
      if (!f || featDiscovered(f, c.player)) return;
      if (f._hidden && f._hiddenBy !== c.player) return; // a rival's Hide Lairs glamour still holds
      if (_drClassOf(f) !== _drWant) return;
      discoverFeat(f, c.player);
      c.merits = (c.merits || 0) + 1;
      TM(c).featuresFound += 1;
      _drFound.push({ name: f.name || 'a hidden lair', prov: pv });
    });
  });
  if (_drFound.length === 0) {
    emit(turnContext, {
      type: 'explore',
      text: `${c.name} combs ${prov.name} and the country about it for ${_drWant === 'Ritual' ? 'ritual sites' : `${_drWant.toLowerCase()} lairs`}, but every such secret hereabouts is already laid bare.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    trySkillGain(turnContext, c, 'explorer', SKILLGAIN_STD);
    return;
  }
  const _drByProv = {};
  _drFound.forEach((x) => {
    (_drByProv[x.prov.id] = _drByProv[x.prov.id] || { name: x.prov.name, list: [] }).list.push(x.name);
  });
  const _drTxt = Object.values(_drByProv)
    .map((g) => `${g.list.join(', ')} in ${g.name}`)
    .join('; ');
  emit(turnContext, {
    type: 'explore',
    text: `🏛 ${c.name} reads the land for ${_drWant === 'Ritual' ? 'the old stones' : `${_drWant.toLowerCase()} lairs`} and lays bare ${_drFound.length} site${_drFound.length !== 1 ? 's' : ''} across ${Object.keys(_drByProv).length} province${Object.keys(_drByProv).length !== 1 ? 's' : ''} — ${_drTxt}.`,
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  trySkillGain(turnContext, c, 'explorer', SKILLGAIN_STD);
  return;
}
