import { KC_A_HEROS_WAGE_IN_SERVICE, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { THE_NEUTRAL_HEROES_SKILLS_IN_THEIR_TIE_BREAK_ORDER } from '../../content/the-worlds-making-its-name-pools-sea-features-wild-beasts-fleets-skill-pools-and-the-bots-realms.ts';
import {
  THE_NEUTRAL_HEROES,
  THE_STRONGEST_NEUTRAL_MIX,
  THE_TAX_FLOOR,
  THE_WILD_COUNTRY_NEAR_THE_TWO_CROWNS,
} from '../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRng } from '../rng.ts';
import { UNIT_Q_MULT } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { HOME_FLEET_BY_RACE } from '../grand-design.ts';
import { THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES } from '../saves/the-saved-games-version-this-build-writes.ts';
import {
  COASTAL_NAVAL_CHANCE,
  RACES_P,
  SEA_TYPES_GEN,
  SIGNATURE_TERRAIN_P,
  TEMPERS_P,
  buildHumanoidPool,
  provincePoolSize,
} from './tables.ts';
import { theWageOfAHeroInService } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import {
  doesACapitalOfTheAlignmentOpenBesideCreatures,
  doesACapitalOfTheAlignmentOpenBesideMonsters,
  theSkillAWandererOfTheAlignmentIsSureOf,
  theWanderingHeroesDeckOfAlignments,
} from '../rules-on-plain-values/the-world-each-creed-is-made-in-its-wild-country-its-first-skills-and-one-realm-a-game.ts';
import { ABILITIES_P, shuffleP } from '../battle/fortune.ts';
import { nextHeroName, renameLairsThematicP } from '../names.ts';
import { ITEMS_BY_TIER } from '../items/tiers-and-hoards.ts';
import { ensureAllLairHoards } from '../items/lair-items.ts';
import { GUARDIAN_TABLE_VER, computeMaxHp, maxHpPlayers } from '../heroes/skills-and-hp.ts';
import { grantMithrilToDwarves } from '../personal-combat/helpers.ts';
import { bestNeutralMix, neutralDefCount, rP, resyncNeutralDefenders } from '../units/drill-and-spoils.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { getNeighborsP } from './map-helpers.ts';
import { assignLairGrades } from '../chances-and-lair-grades.ts';
import {
  type AHeroAsTheWorldMakesHim,
  type AProvinceAsTheWorldIsMadeIt,
  type ARealmAsTheSetUpHandsIt,
  theCardDealt,
  theOneMadeSure,
} from './the-worlds-making/what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';
import { theSetUpTheMapsGridAndTheProvincesNames } from './the-worlds-making/s00-the-set-up-the-maps-grid-and-the-provinces-names.ts';
import { theCapitalsPlacedAsFarApartAsTheMapAllows } from './the-worlds-making/s01-the-capitals-placed-as-far-apart-as-the-map-allows.ts';
import { eachHomesRingTailoredAndTheSeasFillRates } from './the-worlds-making/s02-each-homes-ring-tailored-and-the-seas-fill-rates.ts';
import { everyProvinceMadeItsTerrainTaxArmiesAndLairs } from './the-worlds-making/s03-every-province-made-its-terrain-tax-armies-and-lairs.ts';
import { theRacesDealtToTheirHeartlandsInEqualShares } from './the-worlds-making/s04-the-races-dealt-to-their-heartlands-in-equal-shares.ts';
import { theCoastalFleetsAHumanoidShoreOffers } from './the-worlds-making/s05-the-coastal-fleets-a-humanoid-shore-offers.ts';
import { theSeasByKindPrimalPoorWatersAndOpenWater } from './the-worlds-making/s06-the-seas-by-kind-primal-poor-waters-and-open-water.ts';
import { theSeaFeaturesAndTheirGuardiansInEverySea } from './the-worlds-making/s07-the-sea-features-and-their-guardians-in-every-sea.ts';
import { aCoastalHomeBordersAnOpenWaterSea } from './the-worlds-making/s08-a-coastal-home-borders-an-open-water-sea.ts';
import { eachHomeTailoredAndItsKingAndHeroesMade } from './the-worlds-making/s09-each-home-tailored-and-its-king-and-heroes-made.ts';

export {
  SEA_PCT_DEFAULT,
  SEA_PCT_MAX,
  SEA_PCT_MIN,
  normSeaPct,
} from './the-worlds-making/the-sea-share-the-gm-picks-from-the-least-to-the-most.ts';
export function generateNewGame(
  setupPlayers: readonly ARealmAsTheSetUpHandsIt[],
  sz: { readonly cols: number; readonly rows: number },
  maxTurns: number,
  genOpts: { readonly seaPct?: unknown } | null | undefined,
) {
  // S0 to S2 (B-06v), each in its own file (src/engine/world/the-worlds-making/): the set-up, the capitals, each home's ring
  const {
    cols,
    rows,
    provinces,
    seaPct,
    seaTarget,
    hasPaganPlayer,
    humanoidRaces,
    primalDefs,
    armiesByTerrainAndRace,
    featurePools,
    unitNamesByType,
    offEven,
    offOdd,
    cellIdRC,
    neighbourCells,
    cellDistRC,
    navalLevelOf,
    pickLand,
    nameAllProvinces,
  } = theSetUpTheMapsGridAndTheProvincesNames({ setupPlayers, sz, genOpts });
  const { homeCells, homeIdSet } = theCapitalsPlacedAsFarApartAsTheMapAllows({
    setupPlayers,
    cols,
    rows,
    cellIdRC,
    cellDistRC,
  });
  const { constraint, SEA_BASE_RATE, SEA_CLUSTER_RATE } = eachHomesRingTailoredAndTheSeasFillRates({
    setupPlayers,
    seaPct,
    seaTarget,
    homeCells,
    homeIdSet,
    neighbourCells,
    navalLevelOf,
    pickLand,
  });

  // S3 (B-06w), in its own file: every province made, its terrain, tax, armies and lairs
  everyProvinceMadeItsTerrainTaxArmiesAndLairs({
    cols,
    rows,
    provinces,
    seaPct,
    seaTarget,
    hasPaganPlayer,
    humanoidRaces,
    primalDefs,
    armiesByTerrainAndRace,
    featurePools,
    neighbourCells,
    pickLand,
    constraint,
    SEA_BASE_RATE,
    SEA_CLUSTER_RATE,
  });

  // S4 to S8 (B-06x), each in its own file: the races dealt to their heartlands, the coastal fleets, the seas by kind,
  // the sea features and their guardians, and the home's open-water sea
  theRacesDealtToTheirHeartlandsInEqualShares({ provinces, humanoidRaces });
  const { fleetsByRace, fleetTypes } = theCoastalFleetsAHumanoidShoreOffers({
    cols,
    rows,
    provinces,
    humanoidRaces,
    offEven,
    offOdd,
  });
  theSeasByKindPrimalPoorWatersAndOpenWater({ provinces, unitNamesByType });
  theSeaFeaturesAndTheirGuardiansInEverySea({ provinces });
  aCoastalHomeBordersAnOpenWaterSea({ homeCells, neighbourCells, provinces });

  // S9 (B-06y), in its own file: the colours dealt, then each home tailored and its king and two heroes made, one home
  // after the other
  const { playerStarts, allChars, creaturesByTerrain, monstersByTerrain, players } =
    eachHomeTailoredAndItsKingAndHeroesMade({
      setupPlayers,
      cols,
      rows,
      provinces,
      offEven,
      offOdd,
      primalDefs,
      armiesByTerrainAndRace,
      featurePools,
      homeCells,
    });

  // ── WILD COUNTRY NEAR THE TWO CROWNS (2026-10-13, Toby item 12) ── A Druidic king must have at
  // least one land CREATURE province within two provinces of home, and an Evil king a land MONSTER
  // province, so each crown can reach its speciality early. The alignment pass above only tries to
  // put one beside the home, and it can find no free neighbour; later homes' cap passes can also
  // re-race a primal province that sits two steps from an earlier home. This pass runs after every
  // home is tailored and is the authority. Where nothing within two steps qualifies it converts one
  // cell, choosing in order: a cell exactly two steps away that borders no home (so no ring breaks
  // its one-primal cap), then a free cell in this home's own ring if that ring holds no primal yet.
  // It never touches a home, any king's poor/prosperous pair, or a primal cell that is another
  // crown's only qualifying province. Wrong-family primal cells are preferred over humanoid ones (the
  // wild country only changes sides), then cells not of the king's own race.
  {
    const _nb = (p: AProvinceAsTheWorldIsMadeIt) => getNeighborsP(p, cols, rows, provinces).filter(Boolean);
    const _within2 = (h: AProvinceAsTheWorldIsMadeIt) => {
      const one = _nb(h),
        seen = new Map(one.map((n): [number, number] => [n.id, 1]));
      one.forEach((n) => {
        _nb(n).forEach((m) => {
          if (m.id !== h.id && !seen.has(m.id)) seen.set(m.id, 2);
        });
      });
      return seen;
    };
    // the units of each family, looked up by a type that may be missing
    const creatureUnits: readonly (string | undefined)[] = KC_UNIT_CLASS.creature;
    const monsterUnits: readonly (string | undefined)[] = KC_UNIT_CLASS.monster;
    const _famOf = (p: AProvinceAsTheWorldIsMadeIt) => {
      if (p.terrain === 'sea' || !(p.race ?? '').startsWith('Primal')) return null;
      const t = p.armyTypes[0];
      return creatureUnits.includes(t) ? 'creature' : monsterUnits.includes(t) ? 'monster' : null;
    };
    const _homeIds = new Set(players.map((pl) => pl.homeProvinceId));
    const _pairIds = new Set(playerStarts.flatMap((h) => h._homePairIds ?? []));
    const _ringIds = new Set<number>();
    playerStarts.forEach((h) => {
      _nb(h).forEach((n) => _ringIds.add(n.id));
    });
    /** A crown that wants wild country near home: its realm, the family it wants, its home. */
    interface ACrownWantingWildCountry {
      readonly pl: (typeof players)[number];
      readonly want: 'creature' | 'monster';
      readonly home: AProvinceAsTheWorldIsMadeIt;
    }
    const _crowns = players
      .map((pl) => ({
        pl,
        want: doesACapitalOfTheAlignmentOpenBesideCreatures(pl.alignment)
          ? 'creature'
          : doesACapitalOfTheAlignmentOpenBesideMonsters(pl.alignment)
            ? 'monster'
            : null,
        home: provinces[pl.homeProvinceId],
      }))
      .filter((x): x is ACrownWantingWildCountry => Boolean(x.want && x.home));
    const _matches = (cr: ACrownWantingWildCountry) =>
      [..._within2(cr.home).keys()].filter((id) => {
        const q = provinces[id];
        return q && q.owner == null && _famOf(q) === cr.want;
      });
    _crowns.forEach((cr) => {
      if (_matches(cr).length) return;
      const near = _within2(cr.home);
      const soleFor = (id: number) =>
        _crowns.some((o) => o !== cr && _matches(o).length === 1 && _matches(o)[0] === id);
      const ok = (q: AProvinceAsTheWorldIsMadeIt | undefined): q is AProvinceAsTheWorldIsMadeIt =>
        Boolean(
          q && q.terrain !== 'sea' && q.owner == null && !_homeIds.has(q.id) && !_pairIds.has(q.id) && !soleFor(q.id),
        );
      const ringHasPrimal = _nb(cr.home).some((n) => n.terrain !== 'sea' && (n.race ?? '').startsWith('Primal'));
      const rank = (list: AProvinceAsTheWorldIsMadeIt[]) =>
        list.sort(
          (x, y) =>
            (_famOf(y) ? 1 : 0) - (_famOf(x) ? 1 : 0) ||
            (x.race === cr.pl.race ? 1 : 0) - (y.race === cr.pl.race ? 1 : 0),
        );
      const far = rank(
        shuffleP(
          [...near.entries()]
            .filter(([, d]) => d === 2)
            .map(([id]) => provinces[id])
            .filter((q): q is AProvinceAsTheWorldIsMadeIt => ok(q) && !_ringIds.has(q.id)),
        ),
      );
      const ring = ringHasPrimal ? [] : rank(shuffleP(_nb(cr.home).filter(ok)));
      const cand = far[0] ?? ring[0] ?? null;
      if (!cand) return;
      const bank = (cr.want === 'creature' ? creaturesByTerrain : monstersByTerrain)[cand.terrain] ?? [
        cr.want === 'creature' ? 'Stone Giants' : 'Cave Trolls',
      ];
      const unit = theOneMadeSure(bank[Math.floor(kcRng() * bank.length)]);
      const candsRace = 'Primal:' + ((primalDefs[unit]?.race ?? '') || unit);
      cand.race = candsRace;
      cand.armyTypes = [unit];
      cand.neutralDefenders = Array.from({ length: neutralDefCount(cand.tax) }, () => ({
        type: unit,
        quality:
          kcRng() < THE_WILD_COUNTRY_NEAR_THE_TWO_CROWNS.theChanceItsDefendersAreVeterans ? 'Veteran' : 'Average',
        race: candsRace,
        unitName: theOneMadeSure(armyUnitName(unit)),
      }));
      cand.npcArmies = cand.neutralDefenders.length;
      cand.name = null; // renamed by the thematic naming pass below
    });
  }

  // ── NEUTRAL RACE REBALANCE (2026-09-21) ── The allocation pass above deals the four humanoid
  // races EXACTLY evenly (to within one province) — but the home-tailoring passes that follow then
  // re-race provinces one at a time (own-race neighbour, primal-cap re-race to a RANDOM race,
  // alignment primal conversion), and an audit measured the final spread drifting up to 8 provinces
  // apart on a 5-realm map. This pass restores the promise for the NEUTRAL world. Home provinces are
  // left out of the count (their race is the king's choice), and nothing inside ANY home ring is
  // touched, so every home-neighbourhood guarantee stands exactly as tailored. A province is moved
  // from the most- to the least-held race, preferring one on the receiving race's heartland terrain
  // so the heartland clustering survives.
  {
    const _homeRing = new Set<number>();
    playerStarts.forEach((h) => {
      _homeRing.add(h.id);
      getNeighborsP(h, cols, rows, provinces).forEach((n) => {
        _homeRing.add(n.id);
      });
    });
    const _neutralHum = () =>
      provinces.filter((p) => p.terrain !== 'sea' && p.owner === null && humanoidRaces.has(p.race));
    const _reRace = (conv: AProvinceAsTheWorldIsMadeIt, _race: string) => {
      conv.race = _race;
      const cHp = buildHumanoidPool(conv.terrain, _race, provincePoolSize(kcRng), kcRng);
      conv.armyTypes = [...cHp.types, ...cHp.garrison];
      const offs = conv.row % 2 === 0 ? offEven : offOdd;
      const coastal = offs.some(([dr, dc]) => {
        const nr = conv.row + dr;
        if (nr < 0 || nr >= rows) return false;
        const nb = provinces[nr * cols + ((((conv.col + dc) % cols) + cols) % cols)];
        return nb?.terrain === 'sea';
      });
      if (coastal && kcRng() < COASTAL_NAVAL_CHANCE) {
        const f = HOME_FLEET_BY_RACE[_race];
        if (f && !conv.armyTypes.includes(f)) conv.armyTypes.push(f);
      }
      const pool = conv.armyTypes.filter((t) => !t.toLowerCase().includes('garrison') && !SEA_TYPES_GEN.has(t));
      const draw = pool.length ? pool : conv.armyTypes;
      conv.neutralDefenders = Array.from({ length: neutralDefCount(conv.tax) }, () => {
        const dt = theOneMadeSure(draw[Math.floor(kcRng() * draw.length)]);
        return { type: dt, quality: 'Average', race: _race, unitName: theOneMadeSure(armyUnitName(dt)) };
      });
      conv.npcArmies = conv.neutralDefenders.length;
      conv.name = null; // renamed by the thematic naming pass below
    };
    for (let guard = 0; guard < 500; guard++) {
      const cnt: Partial<Record<string, number>> = {};
      RACES_P.forEach((r) => (cnt[r] = 0));
      _neutralHum().forEach((p) => {
        cnt[String(p.race)] = Number(cnt[String(p.race)]) + 1;
      });
      const order = shuffleP(RACES_P).sort((a, b) => Number(cnt[b]) - Number(cnt[a]));
      const hi = theOneMadeSure(order[0]),
        lo = theOneMadeSure(order[order.length - 1]);
      if (Number(cnt[hi]) - Number(cnt[lo]) <= 1) break;
      const movable = shuffleP(_neutralHum().filter((p) => p.race === hi && !_homeRing.has(p.id)));
      if (!movable.length) break;
      const pick = theOneMadeSure(
        movable.find((p) => SIGNATURE_TERRAIN_P[lo] === p.terrain) ??
          movable.find((p) => SIGNATURE_TERRAIN_P[hi] !== p.terrain) ??
          movable[0],
      );
      _reRace(pick, lo);
    }
  }

  // ── MINIMUM TAX FLOOR (2026-09-21) ── No LAND province may be worth 1 tax. The Poor band is
  // 2-3 everywhere it is rolled above, but terrain rolls, re-racing and future tailoring passes all
  // touch tax independently, so this single sweep is the authority: every land province is lifted to
  // at least 2 before garrisons are sized off its FINAL tax. Sea is deliberately exempt — open water
  // is pinned at tax 1 as the "worthless ocean" marker the home-coastal guarantee relies on.
  provinces.forEach((p) => {
    if (p.terrain !== 'sea' && (p.tax || 0) < THE_TAX_FLOOR.theLeastTaxOfALandProvince)
      p.tax = THE_TAX_FLOOR.theLeastTaxOfALandProvince;
  });

  // ── COASTAL SHIPYARDS (2026-09-21, Toby) ── EVERY humanoid land province that touches the sea offers
  // its race's fleet. The earlier passes gave one to COASTAL_NAVAL_CHANCE (80%) of coasts, and the
  // race-rebalance / re-race passes rebuild pools afterwards, so this final sweep is the authority.
  provinces.forEach((p) => {
    if (p.terrain === 'sea' || !humanoidRaces.has(p.race)) return;
    const coastal = neighbourCells(p.row, p.col).some((n) => {
      const q = provinces[n.id];
      return q?.terrain === 'sea';
    });
    if (!coastal) return;
    if (p.armyTypes.some((t) => fleetTypes.has(t))) return;
    const fleet = theOneMadeSure((fleetsByRace[String(p.race)] ?? ['Galleon Fleet'])[0]);
    p.armyTypes.push(fleet);
  });

  // ── NEUTRAL DEFENDER BAND AUDIT ────
  // Every defender pass rolls its count from the province's tax AT THE TIME, but three passes above
  // change a province's tax AFTERWARDS and do not rebuild the garrison:
  // • the home poor-neighbour force (`poorNbr.tax=rP(2,3)`) — a Rich/Prosperous province keeps
  // its 3-4 or 2-3 defenders while displaying as Poor;
  // • the home prosperous-neighbour force (`prospNbr.tax=rP(4,6)`) — a POOR province is promoted to
  // Prosperous and keeps its 1-2 defenders. This is the reported bug: a province the player is
  // shown as "Prosperous" defended by a single army.
  // • `_reRaceProvince` rebuilds correctly, but only fires when a pair member is non-humanoid or
  // has to be re-raced to the king's race, so it cannot be relied on to clean up after the above.
  // Rather than patch each mutation site (and have the next one reintroduce it), this single sweep
  // is the authority: after ALL world-gen tailoring and BEFORE the neutral-guard heroes take
  // command of these arrays, every neutral land province is brought inside the band its FINAL tax
  // demands. Rich (tax>=7) 3-4 · Prosperous (tax 4-6) 2-3 · Poor (tax 2-3) 1-2 — the same
  // thresholds as the player-facing wealth label. Provinces already in band are left exactly as
  // generated.
  provinces.forEach((p) => {
    if (p.owner === null && p.terrain !== 'sea') resyncNeutralDefenders(p);
  });

  // ── THE STRONGEST NEUTRAL MIX (2026-10-13, Toby item 13) ── With the count final, every neutral
  // land province fields the most effective mix of its own units (bestNeutralMix), the same number
  // of units, each slot keeping the quality it was dealt. A unit keeps its company name when its type
  // is unchanged. Primal provinces offer one beast and are left as they are.
  provinces.forEach((p) => {
    if (p.owner !== null || p.terrain === 'sea' || (p.race ?? '').startsWith('Primal')) return;
    const defs = p.neutralDefenders;
    if (!defs.length) return;
    const quals = defs
      .map((d) => d.quality || 'Average')
      .sort(
        (a, b) =>
          ((UNIT_Q_MULT[b] ?? 0) || THE_STRONGEST_NEUTRAL_MIX.theWeightOfAGradeTheTableGivesNone) -
          ((UNIT_Q_MULT[a] ?? 0) || THE_STRONGEST_NEUTRAL_MIX.theWeightOfAGradeTheTableGivesNone),
      );
    const mix = bestNeutralMix(p.armyTypes, quals, p.terrain, p.race);
    if (!mix) return;
    const left = defs.slice();
    p.neutralDefenders = mix.map((t, i) => {
      const k = left.findIndex((d) => d.type === t && (d.quality || 'Average') === quals[i]);
      if (k >= 0) return theOneMadeSure(left.splice(k, 1)[0]);
      return {
        type: t,
        quality: theOneMadeSure(quals[i]),
        race: theOneMadeSure(defs[0]).race || (p.race ?? '') || 'Human',
        unitName: theOneMadeSure(armyUnitName(t)),
      };
    });
    p.npcArmies = p.neutralDefenders.length;
  });

  // Neutral heroes — one per non-home land province, and per sea province that has defenders,
  // leading the province's neutral armies (so sea provinces actually fight when entered) neutral
  // heroes now start with a spread of skills (INCLUDING magic schools) so they are more useful —
  // one skill at level 2 and one at level 1, dealt round-robin from NEUTRAL_SKILL_POOL so the
  // skills are spread evenly across the whole neutral-hero population rather than clustered.
  // the order is the tie-break (content's row says why)
  const NEUTRAL_SKILL_POOL = THE_NEUTRAL_HEROES_SKILLS_IN_THEIR_TIE_BREAK_ORDER;
  // neutral-hero traits are DEALT FROM RESHUFFLED DECKS rather than rolled. The old round-robin
  // cursor spread skills evenly but in province-id order, so the same skill recurred in a fixed
  // stride down the map; alignment/race/temper were independent rolls, which on a normal map easily
  // produced runs of identical results. A deck guarantees the intended proportions over every pass
  // and a fresh random ORDER each pass.
  const _mkDeck = <Card>(cards: readonly Card[]) => {
    let d: Card[] = [];
    return () => {
      if (!d.length) d = shuffleP(cards);
      return theCardDealt(d.pop());
    };
  };
  const _dealPrimary = _mkDeck(NEUTRAL_SKILL_POOL);
  const _dealSecondary = _mkDeck(NEUTRAL_SKILL_POOL);
  // Alignment mix: Divine/Undead 5%, Good/Evil 10%, Druidic/Pagan 20%, Neutral 30% — encoded as a
  // 20-card deck (1/2/4/6/4/2/1) so every 20 neutral heroes hit the mix exactly (the ladder's column: P1-19ay1).
  const _dealAlign = _mkDeck(theWanderingHeroesDeckOfAlignments());
  const _dealRace = _mkDeck(RACES_P);
  const _dealTemper = _mkDeck(TEMPERS_P.slice(0, THE_NEUTRAL_HEROES.theTempersOneIsDealtFrom));
  // ── SECRET Easter egg: reserve Garreth the Independent and pick which neutral LAND province he
  // guards. Reserving his name parts BEFORE the loop keeps "Garreth"/"the Independent" out of every
  // other hero's draw (item: unique names). He is otherwise an ordinary neutral guard.
  const _garrethLandProvs = provinces.filter(
    (p) => p.owner === null && p.terrain !== 'sea' && p.neutralDefenders.length > 0,
  );
  const _garrethPool = _garrethLandProvs.length
    ? _garrethLandProvs
    : provinces.filter((p) => p.owner === null && p.neutralDefenders.length > 0);
  const _garrethProvId = _garrethPool.length
    ? theOneMadeSure(_garrethPool[Math.floor(kcRng() * _garrethPool.length)]).id
    : null; // name reserved at top of generateNewGame
  provinces
    .filter((p) => p.owner === null && (p.terrain !== 'sea' || p.neutralDefenders.length > 0))
    .forEach((lp) => {
      const hid = allChars.length;
      // a neutral hero is a PERSON — their race is always humanoid, even when they guard a sea or
      // primal (Creature/Monster) province. The monster class belongs to the ARMIES they lead, never
      // to the hero.
      const hrace = _dealRace();
      const hSkills: Partial<Record<string, number>> = {};
      // Item 7 / deal one level-2 skill and one level-1 skill from two independent reshuffled decks,
      // so across all neutral heroes every skill appears equally often as the L2 pick and as the L1
      // pick, with no positional pattern. Magic schools are in the pool, so some neutral heroes can
      // cast.
      const _primary = _dealPrimary();
      let _secondary = _dealSecondary();
      if (_secondary === _primary) {
        const _alt = _dealSecondary();
        if (_alt !== _primary) _secondary = _alt;
        else
          _secondary = theOneMadeSure(
            NEUTRAL_SKILL_POOL[(NEUTRAL_SKILL_POOL.indexOf(_primary) + 1) % NEUTRAL_SKILL_POOL.length],
          );
      }
      hSkills[_primary] = THE_NEUTRAL_HEROES.theLevelOfTheFirstSkill;
      hSkills[_secondary] = (hSkills[_secondary] ?? 0) + 1;
      // Druidic neutral heroes are guaranteed the Druid skill (needed to lead primal armies without
      // penalty); if the deal didn't already give it, fold it into the level-1 slot.
      let wAlign = _dealAlign();
      const _wanderersSkill = theSkillAWandererOfTheAlignmentIsSureOf(wAlign);
      if (_wanderersSkill !== undefined && !hSkills[_wanderersSkill]) hSkills[_wanderersSkill] = 1;
      const _isGarreth = lp.id === _garrethProvId;
      if (_isGarreth) wAlign = 'Neutral'; // Garreth/the Independent are Neutral-pool names — keep it consistent
      const baseName = _isGarreth ? 'Garreth the Independent' : nextHeroName(wAlign);
      const h: AHeroAsTheWorldMakesHim = {
        id: hid,
        name: baseName,
        isKing: false,
        player: null,
        _unkillable: _isGarreth, // SECRET: never dies (see _escapesTheEnd / handleHeroDeath)
        race: hrace,
        alignment: wAlign,
        temper: _dealTemper(),
        hp: THE_NEUTRAL_HEROES.theHpOneIsMadeWith,
        maxHp: 0,
        skills: hSkills,
        aptitude: {},
        // Neutral heroes carry the province's neutral armies
        armies: [...lp.neutralDefenders],
        items: [],
        location: lp.id,
        alive: true,
        merits: 0,
        taxBonus: 0,
        spellsUsedThisTurn: [],
        locationName: lp.name,
        _isNeutralGuard: true, // flag: currently defending their home province
        // NOTE: no encounterPlan here on purpose. autoEncounterPlan/ensureEncounterPlan live inside
        // runTurn's scope and are NOT reachable from generateNewGame — calling them here throws a
        // ReferenceError and world generation dies. NPC plans are built lazily at combat time.
      };
      h.maxHp = h.hp;
      ABILITIES_P.forEach((ab) => {
        h.aptitude[ab] = rP(THE_NEUTRAL_HEROES.eachAptitude.theLeast, THE_NEUTRAL_HEROES.eachAptitude.theMost);
      });
      h.pay = theWageOfAHeroInService(KC_A_HEROS_WAGE_IN_SERVICE.theAllegianceOfAHeroNeverHired, h); // wandering default; the hire desk quotes alignment + skill premium
      allChars.push(h);
      lp.characters.push(hid);
      // Province still keeps neutralDefenders for backward-compat intel display, but armies actually
      // live on the hero now
    });

  // ── THEMATIC NAMING PASS ── Every province now has its final terrain, race and army pool
  // (including king home provinces), so name them all thematically here, then point each
  // character's stored location name at the freshly-named province they occupy.
  nameAllProvinces();
  allChars.forEach((c) => {
    const pv = provinces[c.location];
    if (pv) c.locationName = pv.name;
  });

  // Build turnOrders
  const turnOrders: Partial<Record<number, null[]>> = {};
  allChars
    .filter((c) => c.player !== null && c.alive)
    .forEach((c) => {
      turnOrders[c.id] = [null, null, null, null, null];
    });

  const _newGameState = {
    world: { provinces, cols, rows, seaPct },
    players,
    characters: allChars,
    mercenaries: [],
    // ── Diplomacy (KC alliance system) ── relations between players, keyed "minIdx-maxIdx" →
    // 'enemy' | 'allied'. Any pair absent from the map is NEUTRAL (the default). All players begin
    // Neutral to one another; relations only change at end of turn via mutual Treat / a war
    // declaration.
    relations: {},
    heroGraveyard: [],
    turn: 1,
    phase: 0,
    maxTurns,
    log: [],
    turnOrders,
    nextItemId: 0,
    _awardedItems: [],
  };
  grantMithrilToDwarves(_newGameState); // dwarf characters of a dwarf realm start suited in mithril
  // re-grade every lair before the hoards are stocked - always 22 legendary lairs, spread across
  // the world, with the weak country gathered around the homes.
  assignLairGrades(
    provinces,
    players.map((pl) => pl.homeProvinceId),
    sz.cols,
    sz.rows,
    ITEMS_BY_TIER[4].length,
  );
  // name every lair AFTER its guardian is settled, from that guardian's own pools, and uniquely
  // across the world. Must run after assignLairGrades, which re-draws the guardians.
  renameLairsThematicP(_newGameState);
  ensureAllLairHoards(_newGameState); // every lair's gold and magic decided now
  // 2026-09-10 revert: earned HP — every starting character opens with an empty pool (15 HP; 18 for
  // an Orc of an Orcish realm), at full health.
  maxHpPlayers.players = players;
  allChars.forEach((c) => {
    c.hpEarned = 0;
    c.maxHp = computeMaxHp(c, players);
    c.hp = c.maxHp;
  });
  // the save's marks, then the save's shape as this build writes it (P1-15c), on the same object in the same order
  return Object.assign(_newGameState, {
    _maxHpV2: true,
    _maxHpV3: true,
    _guardiansV2: true,
    _guardiansVer: GUARDIAN_TABLE_VER,
    schemaVersion: THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES,
  });
}
