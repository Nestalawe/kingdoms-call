// S9 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the homes. The realms' colours
// dealt, then for each home in turn its tailoring (its roster and fleet, the Poor and Prosperous pair, the creed's
// neighbour, the one-primal cap, the weak lair), its king and his two heroes, before the next home starts: a later
// home reads the earlier ones' pairs and rings. The homes, the heroes and the realms are handed on.
import {
  KC_A_HEROS_WAGE_IN_SERVICE,
  KC_HUMANOID_RACES,
  KC_RIVAL_RACE,
  MONSTERS_P,
} from '../../../content/kingdoms-call-data.ts';
import {
  THE_FLEETS_A_HUMANOID_RACE_BUILDS_ON_A_COAST,
  THE_SEA_BEASTS_A_HOMES_WEAK_LAIR_LEAVES_OUT,
  THE_WILD_CREATURES_BY_TERRAIN,
  THE_WILD_MONSTERS_BY_TERRAIN,
} from '../../../content/the-worlds-making-its-name-pools-sea-features-wild-beasts-fleets-skill-pools-and-the-bots-realms.ts';
import {
  A_KING_AND_HIS_HEROES,
  THE_HOMES,
  THE_TAX_BANDS,
} from '../../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import {
  THE_LADDER_OF_THE_ALIGNMENTS,
  THE_RACE_THE_RISEN_DEAD_ARE_MADE_AS,
} from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { kcRng } from '../../rng.ts';
import { HOME_FLEET_BY_RACE } from '../../grand-design.ts';
import {
  COASTAL_NAVAL_CHANCE,
  RACES_P,
  SEA_TYPES_GEN,
  TEMPERS_P,
  buildHumanoidPool,
  fullRaceLandRoster,
  provincePoolSize,
} from '../tables.ts';
import { getDruidLevel } from '../../rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import {
  ALIGNMENTS_P,
  theWageOfAHeroInService,
} from '../../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import {
  doesACapitalOfTheAlignmentOpenBesideCreatures,
  doesACapitalOfTheAlignmentOpenBesideMonsters,
  doesACapitalOfTheAlignmentOpenBesideTheRitualStones,
  doesAKingOfTheAlignmentStartWithASkeletalCompany,
  theSkillAKingOfTheAlignmentStartsWith,
} from '../../rules-on-plain-values/the-world-each-creed-is-made-in-its-wild-country-its-first-skills-and-one-realm-a-game.ts';
import { ABILITIES_P, shuffleP } from '../../battle/fortune.ts';
import { nextHeroName } from '../../names.ts';
import { FEATURE_POOLS_P, RITUAL_SITE_NAMES } from '../../items/tiers-and-hoards.ts';
import { discoverFeat } from '../../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { neutralDefCount, rP } from '../../units/drill-and-spoils.ts';
import { armyUnitName } from '../../dice-and-army-names.ts';
import { REALM_COLOURS, REALM_COLOUR_FALLBACK } from '../../bots/intel.ts';
import { getNeighborsP } from '../map-helpers.ts';
import type { Army } from '../../../schemas/saved-game-state.ts';
import {
  type ACellOfTheGrid,
  type AHeroAsTheWorldMakesHim,
  type AProvinceAsTheWorldIsMadeIt,
  type ARealmAsTheSetUpHandsIt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the homes read: the realms as the setup hands them, the set-up's (S0's) map size, provinces' list, hex grid's
 *  neighbour offsets for even and odd rows and content tables, and the capitals (S1). */
export interface WhatTheHomesRead {
  readonly setupPlayers: readonly ARealmAsTheSetUpHandsIt[];
  readonly cols: number;
  readonly rows: number;
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
  readonly offEven: readonly (readonly [number, number])[];
  readonly offOdd: readonly (readonly [number, number])[];
  readonly primalDefs: Readonly<Partial<Record<string, { readonly race?: string | undefined }>>>;
  readonly armiesByTerrainAndRace: Readonly<
    Partial<Record<string, Readonly<Partial<Record<string, readonly string[]>>>>>
  >;
  readonly featurePools: Readonly<Partial<Record<string, readonly string[]>>>;
  readonly homeCells: readonly ACellOfTheGrid[];
}

/** S9, the homes: the colours dealt, then each home tailored and its king and two heroes made, one home after the
 *  other, in place on the provinces' list. It returns the homes in the realms' order (the wild country, S10, and the
 *  neutral races, S11, read them), the kings and heroes (the later stages add the neutral heroes and the naming pass
 *  reads them), the wild pools the wild country deals from, and the realms (S10 and the state, S17). */
export function eachHomeTailoredAndItsKingAndHeroesMade({
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
}: WhatTheHomesRead) {
  // Player starts were already chosen up front (Phase 1) and their neighbourhoods tailored
  // (Phase 2). Here we simply take each king's pre-selected home province in order.
  const playerStarts: AProvinceAsTheWorldIsMadeIt[] = [];
  const allChars: AHeroAsTheWorldMakesHim[] = [];

  // 2026-09-28 (Toby item 1): realm colours are dealt from a SHUFFLED palette. They used to be
  // REALM_COLOURS[player index], and humans always take the lowest indices (bots are appended after
  // them), so a player alone against bots was Rose (pink) in every game. shuffleP is the unbiased
  // Fisher-Yates at module top level; the palette's rules (terrain clearance, luma spacing) are
  // properties of the set, not of the seat, so any order keeps them.
  const _realmColourDeal = shuffleP(REALM_COLOURS);
  // The wild pools the home passes deal from: the alignment neighbour pass below and the
  // wild-country pass after the homes (item 12), the same banks as the province pass's.
  // the two banks by any terrain's name
  const creaturesByTerrain: Readonly<Partial<Record<string, readonly string[]>>> = THE_WILD_CREATURES_BY_TERRAIN;
  const monstersByTerrain: Readonly<Partial<Record<string, readonly string[]>>> = THE_WILD_MONSTERS_BY_TERRAIN;
  const players = setupPlayers.map((sp, pi) => {
    const best = theOneMadeSure(provinces[theOneMadeSure(homeCells[pi]).id]);
    // Home province race always matches the king's race, and army pool updates accordingly
    best.owner = pi;
    best.npcArmies = 0;
    best.neutralDefenders = [];
    best.exploredBy = { [pi]: THE_HOMES.howWellARealmKnowsItsHome };
    best.explored = THE_HOMES.howWellARealmKnowsItsHome;
    best.visitedBy = [pi];
    best.tax = THE_HOMES.theTaxOfAHome;
    best.race = sp.race;
    // The home province is the ONE humanoid province exempt from the 2-3-types cap: a king opens
    // with his race's complete land roster. Restoring it here overwrites anything the coastal pass
    // added, so a coastal capital is re-offered its racial fleet on the same terms as any other
    // coastal humanoid province.
    best.armyTypes = fullRaceLandRoster(sp.race);
    if (!best.armyTypes.length) best.armyTypes = ['Shieldwall Levies'];
    {
      const hOffs = best.row % 2 === 0 ? offEven : offOdd;
      const homeCoastal = hOffs.some(([dr, dc]) => {
        const nr = best.row + dr;
        if (nr < 0 || nr >= rows) return false;
        const nc = (((best.col + dc) % cols) + cols) % cols;
        const nb = provinces[nr * cols + nc];
        return nb?.terrain === 'sea';
      });
      // 2026-09-25 (Toby): a coastal capital ALWAYS offers its race's fleet, at every sea share (was an
      // 80% roll). backfillHomeRosters applies the same rule to games already running.
      if (homeCoastal) {
        const homeFleets: Readonly<Partial<Record<string, readonly string[]>>> =
          THE_FLEETS_A_HUMANOID_RACE_BUILDS_ON_A_COAST; // by any race's name
        const hf = homeFleets[sp.race] ?? []; // Corsair Fleet retired
        const pickH = hf[Math.floor(kcRng() * hf.length)];
        if (pickH && !best.armyTypes.includes(pickH)) best.armyTypes.push(pickH);
      }
    }
    // 100% explored = all features discovered at start (by the home's OWNER only)
    best.features.forEach((f) => {
      discoverFeat(f, pi);
    });

    // ── Guarantee: the home is adjacent to one POOR (tax 2-3) and one PROSPEROUS (tax 4-6) land
    // province, BOTH of them HUMANOID, and at least one of the two of the king's OWN race. The
    // Phase-2 ring constraints usually place the tax bands; here we fix any shortfall (edge of map
    // / clustered starts) and enforce the race rules by re-racing the chosen neighbours in place
    // (terrain, tax and features kept; recruit pool and neutral garrison rebuilt).
    const _reRaceProvince = (conv: AProvinceAsTheWorldIsMadeIt, _race: string) => {
      conv.race = _race;
      const cHp = buildHumanoidPool(conv.terrain, _race, provincePoolSize(kcRng), kcRng);
      conv.armyTypes = [...cHp.types, ...cHp.garrison];
      // Coastal humanoid provinces keep their chance of a racial fleet, same rule as world gen.
      {
        const offs = conv.row % 2 === 0 ? offEven : offOdd;
        const convCoastal = offs.some(([dr, dc]) => {
          const nr = conv.row + dr;
          if (nr < 0 || nr >= rows) return false;
          const nc = (((conv.col + dc) % cols) + cols) % cols;
          const nb = provinces[nr * cols + nc];
          return nb?.terrain === 'sea';
        });
        if (convCoastal && kcRng() < COASTAL_NAVAL_CHANCE) {
          const convFleets: Readonly<Partial<Record<string, readonly string[]>>> =
            THE_FLEETS_A_HUMANOID_RACE_BUILDS_ON_A_COAST; // by any race's name
          const cf = convFleets[_race] ?? []; // Corsair Fleet retired
          const pickF = cf[Math.floor(kcRng() * cf.length)];
          if (pickF && !conv.armyTypes.includes(pickF)) conv.armyTypes.push(pickF);
        }
      }
      // Rebuild the neutral garrison from the new pool. This runs BEFORE the neutral-guard hero
      // pass, so the hero picks up the corrected armies; province wealth still sets the count.
      const cDrawPool = conv.armyTypes.filter((t) => !t.toLowerCase().includes('garrison') && !SEA_TYPES_GEN.has(t));
      const cPool = cDrawPool.length > 0 ? cDrawPool : conv.armyTypes;
      const cCount = neutralDefCount(conv.tax);
      conv.neutralDefenders = Array.from({ length: cCount }, () => {
        const dt = theOneMadeSure(cPool[Math.floor(kcRng() * cPool.length)]);
        return { type: dt, quality: 'Average', race: _race, unitName: theOneMadeSure(armyUnitName(dt)) };
      });
      conv.npcArmies = conv.neutralDefenders.length;
      conv.name = null; // re-named thematically by the naming pass below
    };
    const _rawLandNbrs = getNeighborsP(best, cols, rows, provinces).filter(
      (n) => n.terrain !== 'sea' && n.owner == null,
    );
    const _isHumanoid = (n: AProvinceAsTheWorldIsMadeIt | null) => !!n && !(n.race ?? '').startsWith('Primal');
    // when a tax band has to be FORCED, prefer a cell that is not an earlier king's guaranteed pair
    // member, so fixing this home can't silently break a neighbouring home's.
    const _earlierPair = new Set(playerStarts.flatMap((h) => h._homePairIds ?? []));
    const homeLandNbrs = [
      ..._rawLandNbrs.filter((n) => !_earlierPair.has(n.id)),
      ..._rawLandNbrs.filter((n) => _earlierPair.has(n.id)),
    ];
    // Pick the poor neighbour: an existing poor humanoid, else an existing poor primal, else force
    // one.
    const { thePoor: _thePoor, theProsperous: _theProsperous } = THE_TAX_BANDS;
    let poorNbr =
      homeLandNbrs.find((n) => n.tax >= _thePoor.theLeast && n.tax <= _thePoor.theMost && _isHumanoid(n)) ??
      homeLandNbrs.find((n) => n.tax >= _thePoor.theLeast && n.tax <= _thePoor.theMost) ??
      null;
    if (!poorNbr && homeLandNbrs.length >= 1) {
      poorNbr = theOneMadeSure(homeLandNbrs[0]);
      poorNbr.tax = rP(_thePoor.theLeast, _thePoor.theMost);
    }
    let prospNbr =
      homeLandNbrs.find(
        (n) => n !== poorNbr && n.tax >= _theProsperous.theLeast && n.tax <= _theProsperous.theMost && _isHumanoid(n),
      ) ??
      homeLandNbrs.find((n) => n !== poorNbr && n.tax >= _theProsperous.theLeast && n.tax <= _theProsperous.theMost) ??
      null;
    if (!prospNbr) {
      const cands = homeLandNbrs.filter((n) => n !== poorNbr);
      if (cands.length) {
        prospNbr = theOneMadeSure(cands[0]);
        prospNbr.tax = rP(_theProsperous.theLeast, _theProsperous.theMost);
      }
    }
    // Both must be humanoid; at least one must be the king's race.
    const _pair = [poorNbr, prospNbr].filter((n): n is AProvinceAsTheWorldIsMadeIt => Boolean(n));
    _pair.forEach((n) => {
      if (!_isHumanoid(n)) _reRaceProvince(n, sp.race);
    });
    if (_pair.length && !_pair.some((n) => n.race === sp.race))
      _reRaceProvince(theOneMadeSure(_pair[Math.floor(kcRng() * _pair.length)]), sp.race);
    // Remember them so the alignment primal-neighbour pass below leaves them alone where it can.
    best._homePairIds = _pair.map((n) => n.id);
    // Belt-and-braces: some own-race land neighbour must exist (covers a home with no free ring
    // cells).
    if (homeLandNbrs.length && !homeLandNbrs.some((n) => n.race === sp.race))
      _reRaceProvince(theOneMadeSure(homeLandNbrs[0]), sp.race);

    // ── Tasks 6 & 7: alignment starting primal neighbour ── Pagan kings open beside a PRIMAL
    // FOREST or JUNGLE province that holds a RITUAL SITE (somewhere to Perform Rites from turn
    // one). Druidic kings open beside a PRIMAL CREATURE province (Eagles, Ents, Giants, Rocs — a wild
    // host they can lead with no Druid requirement), and since 2026-10-13 (Toby, Creatures and
    // Monsters I) Evil kings beside a PRIMAL MONSTER province (Trolls, Basilisks, Manticores… — the
    // mirror). We convert a free neighbour, preferring one that is NOT the king's own-race homeland
    // guaranteed above.
    {
      // the wild country a capital of the realm's alignment opens beside, from its rows (P1-19ay1)
      const _align = sp.alignment;
      const _besideTheStones = doesACapitalOfTheAlignmentOpenBesideTheRitualStones(_align),
        _besideCreatures = doesACapitalOfTheAlignmentOpenBesideCreatures(_align),
        _besideMonsters = doesACapitalOfTheAlignmentOpenBesideMonsters(_align);
      if (_besideTheStones || _besideCreatures || _besideMonsters) {
        const _allFreeNbrs = getNeighborsP(best, cols, rows, provinces).filter(
          (n) => n.terrain !== 'sea' && n.owner == null,
        );
        // the poor/prosperous pair must be HUMANOID for EVERY home, so this pass may never convert
        // (a) this home's own pair, (b) an earlier king's pair, or (c) any cell in an earlier
        // king's ring (that would push their ring over the one-primal cap after their cap pass has
        // already run).
        const _protectedIds = new Set(best._homePairIds ?? []);
        playerStarts.forEach((h) => {
          (h._homePairIds ?? []).forEach((id) => _protectedIds.add(id));
          getNeighborsP(h, cols, rows, provinces).forEach((n) => {
            _protectedIds.add(n.id);
          });
        });
        const _freeNbrs = _allFreeNbrs.filter((n) => !_protectedIds.has(n.id)); // may be empty -> no alignment neighbour; the pair wins
        // don't clobber the just-guaranteed own-race neighbour if we can help it
        const _pick = (list: AProvinceAsTheWorldIsMadeIt[]) => {
          const notOwn = list.filter((n) => n.race !== sp.race);
          return notOwn.length ? notOwn : list;
        };
        let cand: AProvinceAsTheWorldIsMadeIt | undefined;
        if (_besideTheStones) {
          const pool = _pick(_freeNbrs);
          // prefer an existing forest/jungle neighbour; else re-terrain one to forest/jungle
          cand = pool.find((n) => n.terrain === 'forest' || n.terrain === 'jungle') ?? pool[0];
          if (cand) {
            if (cand.terrain !== 'forest' && cand.terrain !== 'jungle')
              cand.terrain = kcRng() < THE_HOMES.theChanceTheStonesNeighbourIsForest ? 'forest' : 'jungle';
          }
        } else {
          // Druidic or Evil
          cand = _pick(_freeNbrs)[0];
        }
        if (cand) {
          const creatureOnly = _besideCreatures,
            monsterOnly = _besideMonsters;
          const bank = creatureOnly
            ? (creaturesByTerrain[cand.terrain] ?? ['Stone Giants'])
            : monsterOnly
              ? (monstersByTerrain[cand.terrain] ?? ['Cave Trolls'])
              : ((kcRng() < THE_HOMES.theChanceTheCreedsNeighbourHoldsCreatures
                  ? creaturesByTerrain
                  : monstersByTerrain)[cand.terrain] ?? ['Stone Giants']);
          const primalUnit = theOneMadeSure(bank[Math.floor(kcRng() * bank.length)]);
          const candsRace = 'Primal:' + ((primalDefs[primalUnit]?.race ?? '') || primalUnit);
          cand.race = candsRace;
          cand.armyTypes = [primalUnit];
          const dc = neutralDefCount(cand.tax);
          cand.neutralDefenders = Array.from({ length: dc }, () => ({
            type: primalUnit,
            quality: kcRng() < THE_HOMES.theChanceTheCreedsNeighboursDefendersAreVeterans ? 'Veteran' : 'Average',
            race: candsRace,
            unitName: theOneMadeSure(armyUnitName(primalUnit)),
          }));
          cand.npcArmies = cand.neutralDefenders.length;
          if (_besideTheStones && !cand.features.some((f) => f.ritualSite)) {
            cand.features.push({
              name: theOneMadeSure(RITUAL_SITE_NAMES[Math.floor(kcRng() * RITUAL_SITE_NAMES.length)]),
              ritualSite: true,
              monster: null,
              discovered: false,
              cleared: false,
              treasure: 0,
            });
          }
          cand.name = null; // re-named thematically by the naming pass
          best._alignPrimalId = cand.id;
        }
      }
    }

    // ── 2026-09-09: at most ONE primal province may border a home province ── World gen scatters
    // primal (creature/monster) provinces freely, so a home could open ringed by two or three of
    // them — unconquerable ground for a new realm. Keep one (the alignment-placed one if there is
    // one, else the first found) and re-race every other primal land neighbour as a humanoid
    // province of a random race (own-race guarantee above is untouched — it never picks a primal).
    {
      const _ringPrimal = getNeighborsP(best, cols, rows, provinces).filter(
        (n) => n.terrain !== 'sea' && n.owner == null && (n.race ?? '').startsWith('Primal'),
      );
      if (_ringPrimal.length > 1) {
        const keepId =
          best._alignPrimalId != null && _ringPrimal.some((n) => n.id === best._alignPrimalId)
            ? best._alignPrimalId
            : theOneMadeSure(_ringPrimal[0]).id;
        const HUM = KC_HUMANOID_RACES.slice();
        _ringPrimal
          .filter((n) => n.id !== keepId)
          .forEach((n) => {
            _reRaceProvince(n, theOneMadeSure(HUM[Math.floor(kcRng() * HUM.length)]));
          });
      }
      delete best._alignPrimalId;
    }

    // ── Guarantee: at least one WEAK feature in every player's home province ──
    {
      const SEA_MONS = new Set(THE_SEA_BEASTS_A_HOMES_WEAK_LAIR_LEAVES_OUT);
      const weakMons = MONSTERS_P.filter((mm) => mm.power === 'Weak' && !SEA_MONS.has(mm.name));
      if (weakMons.length > 0) {
        if (best.features.length === 0) {
          const wpool = featurePools[best.terrain] ?? FEATURE_POOLS_P.plain;
          best.features.push({
            name: theOneMadeSure(wpool[Math.floor(kcRng() * wpool.length)]),
            tier: 'Weak',
            monster: { ...theOneMadeSure(weakMons[Math.floor(kcRng() * weakMons.length)]) },
            discovered: true,
            discoveredBy: [pi],
            cleared: false,
            treasure: Math.max(1, rP(1, THE_HOMES.theMostTreasureOfAHomesWeakLair)),
          });
        } else if (!best.features.some((f) => f.monster?.power === 'Weak')) {
          // 2026-09-09g: softening a starting lair swaps its guardian, so its own difficulty must
          // follow — otherwise this one lair in the world reads Powerful while a Weak beast sits in
          // it.
          const firstFeature = theOneMadeSure(best.features[0]);
          firstFeature.monster = { ...theOneMadeSure(weakMons[Math.floor(kcRng() * weakMons.length)]) };
          firstFeature.tier = 'Weak';
        }
      }
    }
    playerStarts.push(best);

    // Build king skills
    const kingSkills: Partial<Record<string, number>> = { ...A_KING_AND_HIS_HEROES.theKingsSkills };
    // his alignment's skill a level more, from its row (P1-19ay1): Divine White, Druidic Druid, Evil Druid (2026-10-13,
    // Toby: the mirror — an Evil king drives his Monsters from turn one), Pagan Explorer (the old faith walks the wild
    // places), Undead Necromancy
    const _kingsSkill = theSkillAKingOfTheAlignmentStartsWith(sp.alignment);
    if (_kingsSkill)
      kingSkills[_kingsSkill.theSkill] = (kingSkills[_kingsSkill.theSkill] ?? 0) + _kingsSkill.theLevelsMore;
    // Normalise any mixed-case skill keys from the join form to engine keys
    const SKILL_NORM: Readonly<Partial<Record<string, string>>> = {
      Melee: 'melee',
      Archery: 'archery',
      Tactical: 'tactical',
      March: 'march',
      Naval: 'naval',
      Sage: 'sage',
      Spy: 'spy',
      Thief: 'thief',
      Druid: 'druid',
      Explorer: 'explorer',
      'White Magic': 'white',
      'Psychic Magic': 'psychic',
      'Illusory Magic': 'illusory',
      'Elemental Magic': 'elemental',
      Necromancy: 'necromancy',
      White: 'white',
      Psychic: 'psychic',
      Illusory: 'illusory',
      Elemental: 'elemental',
    };
    if (sp.skills)
      Object.entries(sp.skills).forEach(([k, v]) => {
        const normKey = SKILL_NORM[k] ?? k.toLowerCase();
        kingSkills[normKey] = (Number(kingSkills[normKey]) || 0) + Number(v);
      });

    // A king who begins with any Naval skill must be able to put that skill to use: guarantee at
    // least one of their race's naval units is recruitable in their home province. The king still
    // starts with land armies only — this just adds the option to build a fleet from turn one.
    if ((kingSkills['naval'] ?? 0) >= 1) {
      const NAVAL_BY_RACE = { ...HOME_FLEET_BY_RACE };
      const navalUnit = (NAVAL_BY_RACE[sp.race] ?? '') || 'Galleon Fleet';
      if (!best.armyTypes.includes(navalUnit)) best.armyTypes.push(navalUnit);
    }

    const kingId = allChars.length;
    // King's starting armies are drawn from the province's LAND army pool only (no fleets), so a
    // Naval-skilled king still opens with land units and must recruit ships themselves.
    const homesArmies = armiesByTerrainAndRace[best.terrain] ?? {};
    const startArmyPool = (homesArmies[sp.race] ?? ['Shieldwall Levies']).filter((t) => !SEA_TYPES_GEN.has(t));
    const king: AHeroAsTheWorldMakesHim = {
      id: kingId,
      name: (sp.kingName ?? '') || sp.name,
      isKing: true,
      player: pi,
      race: sp.race,
      alignment: sp.alignment,
      temper: sp.temper,
      hp: A_KING_AND_HIS_HEROES.theHpTheyAreMadeWith,
      maxHp: A_KING_AND_HIS_HEROES.theHpTheyAreMadeWith,
      skills: kingSkills,
      aptitude: {},
      armies: (() => {
        const nonGarrison = startArmyPool.filter((t) => !t.toLowerCase().includes('garrison'));
        let pool = nonGarrison.length > 0 ? nonGarrison : startArmyPool;
        // Never hand a king a starting unit his own Druid skill can't lead cleanly. Own-race troops
        // are commanded as if Druid 1 (the same-race rule), so keep only types whose required Druid
        // level is within reach — this filters out exotic own-race beasts (Eagle Riders, Noble
        // Griffons, Wyvern Riders, etc.) that would otherwise saddle a low-Druid king with a
        // strength penalty from turn one. Fall back to the full pool only if nothing qualifies.
        const kingDruidReach = Math.max(1, Number(kingSkills['druid']) || 0);
        const safe = pool.filter((t) => getDruidLevel(t) <= kingDruidReach);
        if (safe.length > 0) pool = safe;
        const t1 = (pool[0] ?? '') || 'Shieldwall Levies',
          t2 = (pool[Math.min(1, pool.length - 1)] ?? '') || (pool[0] ?? '') || 'Shieldwall Levies';
        const a1: Army = { type: t1, quality: 'Average', race: sp.race, unitName: theOneMadeSure(armyUnitName(t1)) };
        const a2: Army = { type: t2, quality: 'Average', race: sp.race, unitName: theOneMadeSure(armyUnitName(t2)) };
        return [a1, a2];
      })(),
      items: [],
      location: best.id,
      alive: true,
      merits: 0,
      taxBonus: 0,
      pay: 0,
      spellsUsedThisTurn: [],
      locationName: best.name,
    };
    ABILITIES_P.forEach((ab) => {
      king.aptitude[ab] = rP(A_KING_AND_HIS_HEROES.eachAptitude.theLeast, A_KING_AND_HIS_HEROES.eachAptitude.theMost);
    });
    // Undead kings get one skeletal starter army in addition to normal starting armies (its row: P1-19ay1)
    if (doesAKingOfTheAlignmentStartWithASkeletalCompany(sp.alignment)) {
      king.armies.push({
        type: 'Shieldwall Levies',
        quality: 'Average',
        race: THE_RACE_THE_RISEN_DEAD_ARE_MADE_AS,
        _isSkeletal: true,
        unitName: theOneMadeSure(armyUnitName('Shieldwall Levies')) + ' (Skeletal)',
      });
    }
    allChars.push(king);
    best.characters.push(kingId);

    // Starting heroes — pay = 1 (loyal to their liege). the FIRST hero shares the king's race; the
    // SECOND is a random race that bears no animosity toward the king's race
    // (Orcs↔Humans and Elves↔Dwarves are the feuding pairs), so a king never opens with a rival-kin
    // hero at his side (who would lead his native troops at −20%).
    const _RACE_RIVAL: Readonly<Partial<Record<string, string>>> = { ...KC_RIVAL_RACE };
    const heroIds: number[] = [];
    // each is dealt an alignment within the ladder's steps of the king's (P1-19av2: one), by the rungs' order
    const _within = THE_LADDER_OF_THE_ALIGNMENTS.theNumbers.theStepsAKingsHeroesAreDealtWithin.value;
    for (let h = 0; h < A_KING_AND_HIS_HEROES.theHeroesARealmStartsWith; h++) {
      const hid = allChars.length;
      const hSkills: Partial<Record<string, number>> = {};
      for (let s = 0; s < A_KING_AND_HIS_HEROES.theSkillPointsOfAStartingHero; s++) {
        const sk = theOneMadeSure(ABILITIES_P[Math.floor(kcRng() * ABILITIES_P.length)]);
        hSkills[sk] = (hSkills[sk] ?? 0) + 1;
      }
      const heroAlign = theOneMadeSure(
        ALIGNMENTS_P[Math.max(0, Math.min(6, ALIGNMENTS_P.indexOf(sp.alignment) + rP(-_within, _within)))],
      );
      const _hRace =
        h === 0
          ? sp.race
          : (() => {
              const opts = RACES_P.filter((r) => r !== _RACE_RIVAL[sp.race]);
              return theOneMadeSure(opts[Math.floor(kcRng() * opts.length)]);
            })();
      const hero: AHeroAsTheWorldMakesHim = {
        id: hid,
        name: nextHeroName(heroAlign),
        isKing: false,
        player: pi,
        race: _hRace, // hero 0 = king's race; hero 1 = random non-feuding race
        alignment: heroAlign,
        temper: TEMPERS_P[Math.floor(kcRng() * A_KING_AND_HIS_HEROES.theTempersAHeroIsDealtFrom)],
        hp: A_KING_AND_HIS_HEROES.theHpTheyAreMadeWith,
        maxHp: 0,
        skills: hSkills,
        aptitude: {},
        armies: [],
        items: [],
        location: best.id,
        alive: true,
        merits: 0,
        taxBonus: 0,
        spellsUsedThisTurn: [],
        locationName: best.name,
        startingHero: true, // informational only — wage follows the standard skill formula
      };
      hero.maxHp = hero.hp;
      ABILITIES_P.forEach((ab) => {
        hero.aptitude[ab] = rP(A_KING_AND_HIS_HEROES.eachAptitude.theLeast, A_KING_AND_HIS_HEROES.eachAptitude.theMost);
      });
      // Same wage formula as every other hero (theWageOfAHeroInService, B-06d): 3 starting skill points → 1g.
      hero.pay = theWageOfAHeroInService(KC_A_HEROS_WAGE_IN_SERVICE.theAllegianceOfAHeroNeverHired, hero);
      allChars.push(hero);
      best.characters.push(hid);
      heroIds.push(hid);
    }

    // homeProvinceId is the founding capital and is written ONCE, here. It is deliberately separate
    // from provinces[0], which shifts as land is won and lost — the player map is centred on this
    // province for the whole game, so it must never move under them mid-campaign.
    return {
      id: pi,
      name: (sp.kingdomName ?? '') || sp.name,
      kingName: (sp.kingName ?? '') || sp.name,
      _isBot: !!sp.isBot,
      color: (_realmColourDeal[pi] ?? '') || REALM_COLOUR_FALLBACK,
      race: sp.race,
      alignment: sp.alignment,
      temper: sp.temper,
      gold: A_KING_AND_HIS_HEROES.theGoldARealmStartsWith,
      king: kingId,
      heroes: [...heroIds],
      provinces: [best.id],
      homeProvinceId: best.id,
      merits: 0,
      // ── Diplomacy (KC alliance system) ── players this king has ENCOUNTERED (seen a character or
      // province of). Only encountered players may be treated with. Accumulated in
      // updateProvinceMemory.
      _encountered: [],
    };
  });
  return { playerStarts, allChars, creaturesByTerrain, monstersByTerrain, players };
}
