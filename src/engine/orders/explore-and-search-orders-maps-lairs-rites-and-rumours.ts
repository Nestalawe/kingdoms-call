// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
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
import { WILD_HUNT_TURNS, WILD_HUNT_UNITS, guardianCanUseItem, wildHuntPrice } from '../items/tiers-and-hoards.ts';
import { isLegendaryItem } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { recordBattleGraves, recordDeadHeroSighting } from '../graves.ts';
import { noteItemFound, rollMagicItemFor } from '../items/lair-items.ts';
import { discoverFeat, featDiscovered } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { activeItems, settleTheItemsAHeroGained } from '../items/equipment.ts';
import { theExplorersItemsRevealALair } from '../rules/the-registry-of-magic-item-effects.ts';
import { RUMOUR_COST_BY_POWER, applyItemMaxHp, noteLairRumour, pcLearnWeakness } from '../personal-combat/helpers.ts';
import { armyUnitName, d100, rng } from '../dice-and-army-names.ts';
import { markProvinceCombat } from '../bots/intel.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { TM, creditMapped, perkTier, skillLevel } from '../titles/perks.ts';
import {
  theFactorARealmsDiscoveriesMultiplyExploringBy,
  theShareARealmsDiscoveriesMapAroundAnExplorer,
  theTurnsARealmsDiscoveriesLengthenTheWildHuntBy,
  whatARealmsDiscoveriesAddToALairsGold,
  whatARealmsDiscoveriesAddToALairsItemChance,
} from '../rules/the-registry-of-discovery-effects.ts';
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
import {
  aGuardianAsItsKindIsRead,
  theItemsAsTheLineNamesThem,
} from '../personal-combat/the-facts-a-personal-combats-lines-record.ts';
import {
  theItemsAsTheirLoreIsTold,
  theSitesFoundAsTheLineNamesThem,
} from './the-facts-the-explore-and-search-orders-lines-record.ts';
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
  // explore discoveries (the discoveries' registry's since plan P1-19ad: "orderOutcome: a realm's discoveries add to
  // exploring", the rule discExploreMult ships to the report)
  const _discExpl = theFactorARealmsDiscoveriesMultiplyExploringBy(G.players[c.player], { theGround: prov.terrain });
  const gain = Math.min(100, Math.floor(basicRate * (explorerSkill + 1) * scoutBonus * loreMult * _discExpl));
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
        fact: {
          kind: "an Explorer's survey reveals richer land",
          heroName: c.name,
          provinceName: prov.name,
          tax: prov.tax,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
  }
  // ANCIENT LORE — the same Explore action also maps 10% of each adjacent province. (The discoveries' registry's since
  // plan P1-19ad: "visibility: a realm's discoveries map the provinces around an explorer", its row's share.)
  const _alPct = theShareARealmsDiscoveriesMapAroundAnExplorer(G.players[c.player]);
  if (_alPct !== null) {
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
  // Philosopher's Lens: reveals one random still-undiscovered lair here (the items' registry, plan P1-19o).
  if (theExplorersItemsRevealALair(activeItems(c))) {
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
        fact: { kind: "the Philosopher's Lens shows a hero a hidden site", heroName: c.name, siteName: _lf.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
  }
  if ((prov.features || []).some((f) => f._hidden && f._hiddenBy !== c.player && !featDiscovered(f, c.player))) {
    emit(turnContext, {
      type: 'explore',
      fact: { kind: "a veiling illusion clouds a hero's exploring", heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  }
  if (newlyDiscovered.length > 0) {
    // a ritual site has no guardian: the line reports it as a ritual site (the prose's words).
    if (newlyDiscovered.length === 1) {
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'a hero explores a province and discovers a site',
          heroName: c.name,
          provinceName: prov.name,
          gain,
          explored: prov.explored,
          site: theSitesFoundAsTheLineNamesThem(newlyDiscovered)[0],
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else {
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'a hero explores a province and uncovers several sites',
          heroName: c.name,
          provinceName: prov.name,
          gain,
          explored: prov.explored,
          sites: theSitesFoundAsTheLineNamesThem(newlyDiscovered),
        },
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
      fact: {
        kind: 'a hero explores a province and finds no new site',
        heroName: c.name,
        provinceName: prov.name,
        gain: gain,
        explored: prov.explored,
      },
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
      fact: { kind: 'a hero who does not keep the old faith cannot perform rites', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // a ritual site in your OWN province is always known to you (it shows on your map), so the
  // rite may be performed there without first Exploring. Elsewhere, the site must be
  // discovered.
  const _riteSite = (prov.features || []).find(
    (f) => f.ritualSite && (featDiscovered(f, c.player) || prov.owner === c.player),
  );
  if (!_riteSite) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero finds no ritual site for a rite', heroName: c.name, provinceName: prov.name },
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
      fact: {
        kind: 'the stones have already answered a rite this turn',
        heroName: c.name,
        siteName: _riteSite.name,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  const _rite = (target || '').toLowerCase();
  if (_rite.startsWith('wild')) {
    // ── Rite of the Wild Hunt ── Bind the province's native primal creatures for this turn
    // and WILD_HUNT_TURNS more. The ONLY way to field Creatures/Monsters without Druid magic.
    const _wildType = (prov.armyTypes || []).find((t) => PRIMAL_ARMY_DEFS_P[t]);
    if (!_wildType) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'nothing wild answers the Wild Hunt',
          heroName: c.name,
          siteName: _riteSite.name,
          provinceName: prov.name,
        },
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
        fact: { kind: 'a hero cannot afford the Wild Hunt offerings', heroName: c.name, price: _huntCost },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    player.gold -= _huntCost;
    prov._riteTurn = G.turn; // the province's one rite this turn is spent
    c.armies = c.armies || [];
    const _bound = [];
    for (let wi = 0; wi < WILD_HUNT_UNITS; wi++) {
      // the bound beasts are VETERAN. _wildHuntUntilTurn is the LAST turn they serve
      // (released by the end-of-turn sweep once G.turn has advanced PAST it).
      const _u = {
        type: _wildType,
        quality: 'Veteran',
        race: prov.race || 'Primal',
        unitName: armyUnitName(_wildType),
        _wildHuntUntilTurn:
          G.turn + WILD_HUNT_TURNS + theTurnsARealmsDiscoveriesLengthenTheWildHuntBy(G.players[c.player]),
      }; // + ap08 The Long Hunt (the discoveries' registry's since plan P1-19ad: "orderOutcome: a realm's discoveries
      // lengthen the wild hunt")
      c.armies.push(_u);
      _bound.push({ unitName: _u.unitName, type: _wildType });
    }
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: 'a hero performs the Rite of the Wild Hunt',
        heroName: c.name,
        siteName: _riteSite.name,
        price: _huntCost,
        beasts: _bound,
      },
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
        fact: { kind: 'a hero makes no Blood Offering', heroName: c.name },
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
  c.armies = _army.filter((a) => !_sac.includes(a));
  recordBattleGraves(turnContext, prov, _sac);
  _ben.forEach((b) => {
    const cur = _tiers.indexOf(b.quality);
    if (cur > -1) b.quality = _tiers[Math.min(4, cur + 2)];
  });
  if (typeof refreshMovePool === 'function') refreshMovePool(turnContext, c); // the host is smaller now — pace may change
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: 'a hero makes a Blood Offering',
      heroName: c.name,
      siteName: _riteSite.name,
      offered: _sac.map((a) => a.unitName || a.type),
      count: _bn,
      empowered: _ben.map((a) => ({ name: a.unitName || a.type, quality: a.quality })),
    },
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
      fact: {
        kind: 'a hero asks after the lairs of a province but none is known',
        heroName: c.name,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: 'a hero spends the season hunting rumours of lairs',
      heroName: c.name,
      provinceName: prov.name,
      lairs: _feats.length,
    },
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
        fact: {
          kind: "a hero cannot afford a lair's rumours",
          heroName: c.name,
          price: price,
          siteName: f.name,
          treasury: player.gold || 0,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      break;
    }
    player.gold -= price;
    // the guardian's kind keeps its capital (the prose's words): "(elemental)" read as a magic school written in lower case
    const lines = [
      {
        kind: "a lair's rumours are bought",
        price,
        siteName: f.name,
        guardianName: m.name,
        guardianKind: aGuardianAsItsKindIsRead(m),
        grade: (m && m.power) || f.tier || null,
      },
    ];
    // 1) the weakness
    {
      if (m.weak) {
        const fresh = pcLearnWeakness(G, c.player, m.name);
        lines.push({
          kind: "the rumours tell a guardian's weakness",
          weaknessName: m.weak.name,
          weaknessDesc: m.weak.desc,
          theRealmMarksItNow: fresh,
          guardianName: m.name,
        });
      } else lines.push({ kind: 'the rumours tell a guardian has no weakness', guardianName: m.name });
    }
    // 2) the hoard
    {
      ensureLairHoard(f, G);
      const gold = encounterClearGold(f);
      const _hi = f.hoardItems || [],
        _st = f._stolenItems || [];
      const _wield = _hi.filter((it) => guardianCanUseItem(m, it));
      lines.push({
        kind: "the rumours tell a lair's hoard",
        guardianName: m.name,
        gold,
        hoardItems: theItemsAsTheLineNamesThem(_hi),
        stolenItemNames: _st.slice(),
        wieldedItemNames: _wield.map((x) => x.name),
      });
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
        lines.push({
          kind: "the rumours tell a hero's chances against a guardian",
          winPercent: odds.pct,
          guardianName: m.name,
        });
      } else lines.push({ kind: 'nobody could say how a hero would fare against a guardian', heroName: c.name });
    }
    lines.forEach((t) =>
      emit(turnContext, {
        type: 'explore',
        fact: t,
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
      fact: { kind: 'a hero searches a province with no sites', heroName: c.name, provinceName: prov.name },
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
      fact: { kind: 'the lair a hero meant to search is not here', heroName: c.name, provinceName: prov.name },
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
      fact: {
        kind: 'a hero walks a ritual site',
        heroName: c.name,
        siteName: f.name,
        provinceName: prov.name,
        isPagan: isPagan,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  if (f.cleared) {
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'a hero revisits a cleared lair', heroName: c.name, siteName: f.name, provinceName: prov.name },
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
      {
        kind: 'a hero is slain outside a battle',
        heroName: c.name,
        how: "by a lair's guardian",
        killerName: f.monster?.name || null,
      },
      {
        audience: { actor: c.player, realms: [c.player], seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      },
      { slainBy: { guardianName: f.monster?.name || null, provinceName: prov.name } },
    ); // the host is told what slew its commander (2026-10-12)
    if (_lairDied === false) {
      c.items = _lairHeld;
      return;
    } // saved, or escaped: nothing is left among the bones
    if (_lairLeft.length > 0) {
      f.hoardItems = (f.hoardItems || []).concat(_lairLeft); // joins the lair's hoard
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: "a guardian drags a fallen hero's possessions into its hoard",
          guardianName: f.monster?.name || null,
          heroName: c.name,
          itemNames: _lairLeft.map((it) => it.name),
        },
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
        fact: {
          kind: 'a thief finds a hoard already picked clean',
          heroName: c.name,
          guardianName: f.monster?.name || null,
          siteName: f.name,
        },
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
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: "a thief escapes with gold from a lair's hoard",
          heroName: c.name,
          gold,
          siteName: f.name,
          thiefLevel: _thLvl,
          guardianName: f.monster?.name || null,
          left,
        },
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
          fact: {
            kind: 'a Legendary relic cannot be lifted from a lair',
            heroName: c.name,
            guardianName: f.monster?.name || null,
          },
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
            fact: {
              kind: "a thief slips a magic item from a lair's hoard",
              heroName: c.name,
              isLegendary: isLegendaryItem(_it),
              itemName: _it.name,
              itemDesc: _it.desc,
              chance: _ch,
              roll: _r,
            },
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          });
          emit(turnContext, {
            type: 'explore',
            fact: {
              kind: 'a hero notes how he carries what a lair gave up',
              theItemsHeGained: settleTheItemsAHeroGained(c, [_it]),
            },
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          }); // item 10
        } else
          emit(turnContext, {
            type: 'explore',
            fact: { kind: "a thief cannot get near a hoard's magic", heroName: c.name, chance: _ch, roll: _r },
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
          whatARealmsDiscoveriesAddToALairsGold(G.players[c.player], {
            theGround: prov.terrain,
            theHerosRace: c.race,
          })),
    ); // lairGold discoveries (the discoveries' registry's since plan P1-19ad: "orderOutcome: a realm's discoveries add
    // to a lair's gold"). Monster-Bane +50% hoard removed \u2014 the title is now an intel line
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
      // (the discoveries' registry's since plan P1-19ad: "orderOutcome: a realm's discoveries add to a lair's item")
      const _dIC = whatARealmsDiscoveriesAddToALairsItemChance(G.players[c.player], { theGround: prov.terrain });
      if (_dIC > 0 && kcRng() < _dIC) {
        const bonus = rollItem();
        if (bonus) {
          drops.push(bonus);
          emit(turnContext, {
            type: 'explore',
            fact: { kind: "the realm's lore yields an extra find", itemName: bonus.name },
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          });
          emit(turnContext, {
            type: 'explore',
            fact: { kind: 'the lore of the items a lair gave up', items: theItemsAsTheirLoreIsTold([bonus]) },
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
        fact: {
          kind: 'a hero clears a lair and hauls out its magic',
          heroName: c.name,
          gold: gold,
          siteName: f.name,
          items: theItemsAsTheLineNamesThem(baseDrops),
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      baseDrops.forEach((it) =>
        emit(turnContext, {
          type: 'explore',
          fact: { kind: 'the lore of the items a lair gave up', items: theItemsAsTheirLoreIsTold([it]) },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        }),
      ); // one lore line per relic won
    }
    if (drops.length > 0)
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'a hero notes how he carries what a lair gave up',
          theItemsHeGained: settleTheItemsAHeroGained(c, drops),
        },
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
        fact: {
          kind: 'among the bones a hero recovers what the fallen left',
          heroName: c.name,
          items: theItemsAsTheLineNamesThem(_recovered),
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      _recovered.forEach((it) =>
        emit(turnContext, {
          type: 'explore',
          fact: { kind: 'the lore of the items a lair gave up', items: theItemsAsTheirLoreIsTold([it]) },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        }),
      ); // lore line per recovered relic
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'a hero notes how he carries what a lair gave up',
          theItemsHeGained: settleTheItemsAHeroGained(c, _recovered),
        },
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
        fact: {
          kind: 'a hero clears a lair that holds no magic',
          heroName: c.name,
          gold: gold,
          siteName: f.name,
          stolenItemNames: (f._stolenItems || []).slice(),
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
  } else if (!encounter.fled) {
    const dmg = encounter.damageToHero || rng(2, 7);
    c.hp = Math.max(1, c.hp - dmg);
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: 'a hero is forced to retreat from a lair',
        heroName: c.name,
        siteName: f.name,
        hp: c.hp,
        maxHp: c.maxHp,
      },
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
      fact: { kind: 'a hero lacks the Explorer mastery to Chart the Unknown', heroName: c.name },
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
        fact: {
          kind: 'Chart the Unknown reaches no further than a bordering province',
          heroName: c.name,
          provinceName: prov.name,
        },
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
    fact: {
      kind: 'a hero charts a province in full',
      heroName: c.name,
      provinceName: _cuProv.name,
      fromProvinceName: _cuProv !== prov ? prov.name : null,
      neighbours: nbrs.length,
      newlyGlimpsed: revealed,
    },
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
      fact: { kind: 'a hero lacks the Explorer mastery to Discover a Lost Ruin', heroName: c.name },
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
      _drFound.push({ name: f.name || null, prov: pv }); // a site with no name: the prose says "a hidden lair"
    });
  });
  if (_drFound.length === 0) {
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: 'a hero finds no site of a class left to lay bare',
        heroName: c.name,
        provinceName: prov.name,
        lairClass: _drWant,
      },
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
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: 'a hero lays bare the sites of a class',
      heroName: c.name,
      lairClass: _drWant,
      sites: _drFound.length,
      byProvince: Object.values(_drByProv).map((g) => ({ provinceName: g.name, siteNames: g.list.slice() })),
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  trySkillGain(turnContext, c, 'explorer', SKILLGAIN_STD);
  return;
}
