// ── The saved game state's schemas (plan P1-10a1) ────
// What a game's saved state (games.state, the JSON resolveTurn takes and gives back) holds, as Zod schemas: the types
// of the world come from them (z.infer), so one definition types the code, and later validates a save at load (P1-15)
// and a database row at the edge (P1-17). On today's shape (plan P1-10, Decision 4): written from every saved state of
// both balance matrix sets (120 games, 2,687 states, each folded into one tree), then tidied by hand: one schema for a
// shape met in several places (an army in a hero's column, a garrison, a lair's guard or a battle's graves; a hero's
// skill levels; an item held or in a hoard), a record for an object keyed by numbers or by a monster's name. A field
// is optional where some states lack it and nullable where one holds null.
//
// What the matrix never writes isn't here yet: a field only some code reads, or an array the matrix holds only empty
// (`z.unknown()` for its element). P1-10a3 and P1-10b add the fields each file they type reads.
//
// Objects are z.object, so a type has exactly the keys named and a misspelt field fails to compile. Parsing with them
// drops a key they don't name; the tests parse strictly (tests/lib/strict-schema.ts), so an unnamed key fails there.
// P1-15 chooses how a live save with an unknown key is met at load. Imported as types only (`import type`) until then:
// tests/static/pages-build.test.ts refuses a value import of src/schemas/ from src/.
import { z } from 'zod';
import { CharacterIdSchema, ProvinceIdSchema, RealmIndexSchema } from './ids-of-provinces-heroes-and-realms.ts';

export const SkillLevelsSchema = z.object({
  melee: z.number().optional(),
  archery: z.number().optional(),
  tactical: z.number().optional(),
  march: z.number().optional(),
  naval: z.number().optional(),
  sage: z.number().optional(),
  spy: z.number().optional(),
  thief: z.number().optional(),
  druid: z.number().optional(),
  explorer: z.number().optional(),
  white: z.number().optional(),
  psychic: z.number().optional(),
  illusory: z.number().optional(),
  elemental: z.number().optional(),
  necromancy: z.number().optional(),
});
export type SkillLevels = z.infer<typeof SkillLevelsSchema>;

export const SkillFlagsSchema = z.object({
  melee: z.boolean().optional(),
  archery: z.boolean().optional(),
  tactical: z.boolean().optional(),
  march: z.boolean().optional(),
  naval: z.boolean().optional(),
  sage: z.boolean().optional(),
  spy: z.boolean().optional(),
  thief: z.boolean().optional(),
  druid: z.boolean().optional(),
  explorer: z.boolean().optional(),
  white: z.boolean().optional(),
  psychic: z.boolean().optional(),
  illusory: z.boolean().optional(),
  elemental: z.boolean().optional(),
  necromancy: z.boolean().optional(),
});
export type SkillFlags = z.infer<typeof SkillFlagsSchema>;

export const ItemSchema = z.object({
  name: z.string(),
  slot: z.string().optional(),
  desc: z.string(),
  lore: z.string(),
  effect: z.object({
    stat: z.string(),
    bonus: z.number().optional(),
    spell: z.string().optional(),
    ward: z.string().optional(),
    pct: z.number().optional(),
    use: z.string().optional(),
    hitPen: z.number().optional(),
    dmg: z.array(z.number()).optional(),
    toHitReduce: z.number().optional(),
    below: z.number().optional(),
    pc: z
      .object({
        ward: z.string().optional(),
        amt: z.number().optional(),
        pct: z.number().optional(),
        dmgBonus: z.number().optional(),
        hitBonus: z.number().optional(),
        burn: z.number().optional(),
        drain: z.number().optional(),
        aura: z.number().optional(),
        hits: z.number().optional(),
      })
      .optional(),
    temper: z.string().optional(),
    doubleVs: z.array(z.string()).optional(),
    amt: z.number().optional(),
    absorb: z.number().optional(),
    hits: z.number().optional(),
    stun: z.number().optional(),
    fleeBonus: z.number().optional(),
    vs: z.array(z.string()).optional(),
    archery: z.number().optional(),
    rounds: z.number().optional(),
    melee: z.number().optional(),
    times: z.number().optional(),
    images: z.number().optional(),
    dot: z.array(z.number()).optional(),
    reflect: z.number().optional(),
    hitBonus: z.number().optional(),
  }),
  tier: z.number(),
  id: z.number(),
  equipped: z.boolean().optional(),
  _score: z.number().optional(),
  _variantOf: z.string().optional(),
  alignment: z.string().optional(),
  exploreMove: z.number().optional(),
  landFullAtSea: z.boolean().optional(),
  race: z.string().optional(),
  _stolenTurn: z.number().optional(),
  emberTwo: z.boolean().optional(),
  fleetStr: z.number().optional(),
  _unscorable: z.boolean().optional(),
  primalStrike: z.number().optional(),
});
export type Item = z.infer<typeof ItemSchema>;

export const ArmySchema = z.object({
  type: z.string(),
  quality: z.string(),
  race: z.string(),
  unitName: z.string(),
  _notable: z.boolean().optional(),
  _isSkeletal: z.boolean().optional(),
  _phTag: z.string().optional(),
  _orcAtkWinTurn: z.number().optional(),
  _wildHuntUntilTurn: z.number().optional(),
  _plagueImmune: z.boolean().optional(),
  _tacUp: z.boolean().optional(),
  _drumUp: z.boolean().optional(),
  _died: z.boolean().optional(),
  _meritTallied: z.boolean().optional(),
  _garrisonOf: z.number().optional(),
  // Fields the matrix's states don't hold, written by the code (P1-10a3: each read by a file freed of ts-nocheck)
  // Evil terror: the strength a defending unit keeps while terror grips it, set as a battle starts
  _terrorMult: z.number().optional(),
  // an illusory unit (Illusory magic's phantom troops)
  _phantom: z.boolean().optional(),
  // PROTOTYPE (alignment ideas round 1, src/engine/alignment-prototypes.ts): a company of slaves (Evil's Enslave) draws
  // no wage; a skeletal company the land itself raised (Undead) needs no master while it garrisons an Undead province
  _slave: z.boolean().optional(),
  _kitGarrison: z.boolean().optional(),
  _merc: z.boolean().optional(), // Neutral (round 2): a mercenary company hired under the kit, a condottiere
});
export type Army = z.infer<typeof ArmySchema>;

export const FailStreakSchema = z.object({ turn: z.number(), n: z.number() });
export type FailStreak = z.infer<typeof FailStreakSchema>;

export const BotIntelHeroSchema = z.object({
  turn: z.number(),
  provId: z.number(),
  units: z.number(),
  name: z.string(),
  player: z.number(),
  isKing: z.boolean(),
  strength: z.number(),
  skillsKnown: z.boolean(),
});
export type BotIntelHero = z.infer<typeof BotIntelHeroSchema>;

export const CharacterSchema = z.object({
  id: CharacterIdSchema,
  name: z.string(),
  isKing: z.boolean(),
  player: RealmIndexSchema.nullable(),
  race: z.string(),
  alignment: z.string(),
  temper: z.string(),
  hp: z.number(),
  maxHp: z.number(),
  skills: SkillLevelsSchema,
  // every skill, each hero rolls them all at birth
  aptitude: SkillLevelsSchema.required(),
  armies: z.array(ArmySchema),
  items: z.array(ItemSchema),
  location: ProvinceIdSchema,
  alive: z.boolean(),
  merits: z.number(),
  taxBonus: z.number(),
  pay: z.number(),
  spellsUsedThisTurn: z.array(z.unknown()),
  locationName: z.string(),
  hpEarned: z.number().optional(),
  startingHero: z.boolean().optional(),
  _unkillable: z.boolean().optional(),
  _isNeutralGuard: z.boolean().optional(),
  _itemsAtTurnStart: z.array(z.string()).optional(),
  _servedRealms: z.array(z.number()).optional(),
  encounterPlan: z
    .object({
      tactics: z.array(z.string()).optional(),
      notes: z.string().optional(),
      _auto: z.boolean().optional(),
      duelStance: z.string(),
      _botStance: z.boolean(),
      _botTactics: z.boolean().optional(),
    })
    .optional(),
  _hpAtPhaseStart: z.number().nullable().optional(),
  tm: z
    .object({
      marshal: z.number(),
      sea: z.number(),
      monster: z.number(),
      holyCasts: z.number(),
      darkCasts: z.number(),
      featuresFound: z.number(),
      discoveries: z.number(),
      spyActions: z.number(),
      explored: z.number(),
      monsterHost: z.number(),
      wildHost: z.number(),
      duelKills: z.number().optional(),
    })
    .optional(),
  _attackedFrom: z.number().optional(),
  _sgLog: z
    .object({
      turn: z.number(),
      phaseNo: z.number().nullable(),
      phaseSkills: SkillFlagsSchema,
      provSkills: z.record(z.string(), SkillFlagsSchema),
      turnGains: SkillLevelsSchema,
      turnSkills: SkillFlagsSchema,
      gainedPhases: z.record(z.string(), z.boolean()).optional(),
    })
    .optional(),
  _sgPending: z.null().optional(),
  _xpFirstEntry: z.array(z.number()).optional(),
  _phantoms: z.array(z.unknown()).optional(),
  _practiceFailStreak: FailStreakSchema.optional(),
  _botRole2: z.string().optional(),
  _botRole: z.string().optional(),
  _defend: z
    .object({
      centre: z.number(),
      active: z.boolean(),
      setPhase: z.number(),
      carried: z.boolean(),
      preActivated: z.boolean().optional(),
    })
    .optional(),
  _neutralXpTurn: z.number().optional(),
  _enteredProvThisPhase: z.number().optional(),
  _amphibiousAssault: z.boolean().optional(),
  _hireAlignWage: z.number().optional(),
  hiredInPhase: z.number().optional(),
  _seaLandingAt: z.object({ turn: z.number(), prov: z.number() }).optional(),
  _foughtStalledBattlePhase: z.number().optional(),
  _researchFailStreak: FailStreakSchema.optional(),
  _botLadder: z.object({ retryAt: z.number().optional() }).optional(),
  _botLairKills: z
    .object({ Weak: z.number(), Moderate: z.number().optional(), Powerful: z.number().optional() })
    .optional(),
  _gravesSensedTurn: z.number().optional(),
  _gravesSensedIds: z.array(z.number()).optional(),
  _botPost: z.number().optional(),
  _defendReactedPhase: z.number().optional(),
  _charmedTurn: z.number().optional(),
  // PROTOTYPE (master list, round 19, src/engine/alignment-prototypes.ts): what the kits leave on a hero
  _turnStartLoc: z.number().optional(), // where the hero stood as the turn began (Divine: Pilgrim roads)
  _soulBoundBy: z.number().optional(), // Divine hero slain by an Undead kit hero: the realm whose reliquary holds his soul
  _captiveOf: z.number().optional(), // Neutral (Ransom): the id of the hero who holds this one to ransom
  _ransom: z.number().optional(), // Neutral (Ransom): the gold that frees him
  _charmImmuneTurn: z.number().optional(),
  _charmResist: z.number().optional(),
  _invisTurn: z.number().optional(),
  _unspottedTurn: z.number().optional(),
  _spySpotted: z.object({ turn: z.number(), ids: z.array(z.number()) }).optional(),
  // the phase is the turn's _currentPhase, null outside the phases (the matrix's states hold a number)
  _defendSpent: z.object({ turn: z.number(), ph: z.number().nullable() }).optional(),
  killedThisTurn: z.boolean().optional(),
  _mercyFledTurn: z.number().optional(),
  _justDefeated: z.boolean().optional(),
  _spyDisguised: z.boolean().optional(),
  _isHeir: z.boolean().optional(),
  _crownedTurn: z.number().optional(),
  _pendingSkillAllocation: z.number().optional(),
  _fallenOrderNoted: z.boolean().optional(),
  _encounteredThisPhase: z.number().optional(),
  _pursuit: z.object({ targetId: z.number(), active: z.boolean(), setPhase: z.number() }).optional(),
  _masteryOrderUsed: z
    .object({
      sabotage: z.number().optional(),
      forced_march: z.number().optional(),
      lightning_advance: z.number().optional(),
      chart_unknown: z.number().optional(),
      grand_stratagem: z.number().optional(),
      grand_heist: z.number().optional(),
      blockade: z.number().optional(),
    })
    .optional(),
  _lightningAdvanceTurn: z.number().optional(),
  _divineReturn: z.boolean().optional(),
  _grandStratagemTurn: z.number().optional(),
  _grandHeistTurn: z.number().optional(),
  // Fields the matrix's states don't hold, written by the code (P1-10a3: each read by a file freed of ts-nocheck)
  // Raid the Coast: the turn a hero gave the order, and the landing a pooled host carries it for
  _raidCoastTurn: z.number().optional(),
  _raidCarriedAt: z.object({ turn: z.number(), prov: z.number() }).optional(),
  // a hero a Charm seized for the rest of the turn, and the realm he serves again at its end
  _charmTempControl: z.boolean().optional(),
  _charmOriginalPlayer: RealmIndexSchema.nullable().optional(),
  // a fallen commander whose host fights on under a captain
  _leaderlessHost: z.boolean().optional(),
  // the turn the hero worked Vanish (Thief 9)
  _vanishTurn: z.number().optional(),
  // the turn the hero ordered a Feigned Retreat (Tactical 7)
  _feignedRetreatTurn: z.number().optional(),
});
export type Character = z.infer<typeof CharacterSchema>;

export const ProvinceSchema = z.object({
  id: ProvinceIdSchema,
  row: z.number(),
  col: z.number(),
  name: z.string(),
  terrain: z.string(),
  tax: z.number(),
  race: z.string().nullable(),
  population: z.number(),
  owner: RealmIndexSchema.nullable(),
  features: z.array(
    z.object({
      name: z.string(),
      tier: z.string().optional(),
      monster: z
        .object({
          name: z.string(),
          cat: z.string(),
          desc: z.string(),
          hp: z.number(),
          power: z.string(),
          melee: z.number(),
          archery: z.number(),
          speed: z.string(),
          minG: z.number(),
          maxG: z.number(),
          spells: z.array(
            z.object({
              name: z.string(),
              school: z.string(),
              dmgW: z.number(),
              effect: z.string(),
              castChance: z.number(),
              flavour: z.string(),
            }),
          ),
          passives: z.array(
            z.object({
              name: z.string(),
              fx: z.object({
                ward: z.string().optional(),
                pct: z.number().optional(),
                aura: z.number().optional(),
                amt: z.number().optional(),
                school: z.string().optional(),
                drain: z.number().optional(),
                burn: z.number().optional(),
                dmgBonus: z.number().optional(),
                hitBonus: z.number().optional(),
              }),
              desc: z.string(),
            }),
          ),
          weak: z.object({ kind: z.string(), key: z.string(), name: z.string(), desc: z.string() }),
          _hpFull: z.number().optional(),
        })
        .nullable(),
      discovered: z.boolean(),
      cleared: z.boolean(),
      treasure: z.number(),
      hoardItems: z.array(ItemSchema).optional(),
      _hoardV2: z.boolean().optional(),
      _hoardGoldOrig: z.number().optional(),
      discoveredBy: z.array(z.number()).optional(),
      _rumourOdds: z
        .record(z.string(), z.object({ turn: z.number(), charId: z.number(), band: z.number(), rating: z.number() }))
        .optional(),
      ritualSite: z.boolean().optional(),
      // PROTOTYPE (alignment ideas round 1): a holy site (Divine) or a barrow (Undead), a site like the stones for finding
      // and showing, which answers no Pagan rite
      siteKind: z.string().optional(), // 'holy' | 'barrow'
      _stolenItems: z.array(z.string()).optional(),
      _pickedCleanBy: z.array(z.number()).optional(),
      // Fields the matrix's states don't hold, written by the code (P1-10a3: each read by a file freed of ts-nocheck)
      // a feature found before discoveries were kept by realm (an old save): every realm keeps it
      _legacyAll: z.boolean().optional(),
    }),
  ),
  npcArmies: z.number(),
  neutralDefenders: z.array(ArmySchema),
  explored: z.number(),
  characters: z.array(z.number()),
  armyTypes: z.array(z.string()),
  garrisonArmies: z.array(ArmySchema),
  visitedBy: z.array(z.number()),
  exploredBy: z.record(z.string(), z.number()).optional(),
  _homePairIds: z.array(z.number()).optional(),
  _carryOnRounds: z.number().optional(),
  _hadBattleThisTurn: z.boolean().optional(),
  // a neutral province whose guard fell but whose companies held it (the move order sets it; the Trade Pact clears it)
  _leaderlessDefenders: z.boolean().optional(),
  battleGraves: z.array(ArmySchema).optional(),
  _battleUnresolved: z.boolean().optional(),
  _blessedTurn: z.number().optional(),
  _blessWardTurn: z.number().optional(),
  _blessWardBy: z.number().optional(),
  _blessWardPct: z.number().optional(),
  _blessedMult: z.number().optional(),
  _combatPlayersThisTurn: z.array(z.number()).optional(),
  _takenByUnitGain: z.object({ turn: z.number(), ph: z.number(), from: z.number() }).optional(),
  _plaguedTurn: z.number().optional(),
  _plagueLevel: z.number().optional(),
  _plagueCaster: z.number().optional(),
  _illusoryTerrain: z.object({ caster: z.number(), fake: z.string(), appliedTurn: z.number() }).optional(),
  _riteTurn: z.number().optional(),
  // PROTOTYPE (alignment ideas round 1, src/engine/alignment-prototypes.ts): what the kits' orders leave on a province
  _riteActivatedBy: z.number().optional(), // Pagan: the realm whose rite woke the stones here
  _awakened: z.number().optional(), // Pagan: the turn of the Rite of Awakening (its +1 tax paid once)
  _goodWorks: z.number().optional(), // Good: times Good Works raised the tax here (to 2)
  _grownWild: z.number().optional(), // Druidic: the turn Grow the Wild made this forest or jungle
  _tradePactTurn: z.number().optional(), // Neutral: the turn a Trade Pact bought the province
  _despoiled: z.number().optional(), // Undead: the turn Despoil killed the land
  // round 2
  _lostFrom: z.number().optional(), // Good: the realm this province was last taken from (Reclaim)
  _lostTurn: z.number().optional(), // Good: the turn it was taken
  _kitPlague: z.object({ by: z.number(), until: z.number() }).optional(), // Undead: the king's Plague on this province
  _goodWorksTurn: z.number().optional(), // Good (master list): the turn Good Works cleared this province (no Terror or plague for the rest of it)
  _stormTurn: z.number().optional(), // Pagan (master list): the turn Call down the storm struck here
  _earthquakeNoTax: z.number().optional(),
  _terrorStacks: z.number().optional(),
  _terrorTurn: z.number().optional(),
  _terrorisedBy: z.number().optional(),
  _terrorPct: z.number().optional(),
  _evilConqTurn: z.number().optional(),
  _sabotagedForTurn: z.number().optional(),
  _blockadeTurn: z.number().optional(),
  // the realm of the hero who threw the Blockade (null for a hero who serves none; the matrix's states hold a number)
  _blockadeBy: z.number().nullable().optional(),
  _richSurveyed: z.boolean().optional(),
  // Fields the matrix's states don't hold, written by the code (P1-12b4: read by the realm's view)
  // the Wonder of the age raised here (the Grand Design order): its realm, its name, its alignment, the turn it rose
  grandDesign: z
    .object({ owner: RealmIndexSchema, name: z.string(), alignment: z.string(), builtTurn: z.number() })
    .optional(),
  // (P1-12b5: read by the realm's view, for its tax forecast) the last turn of an Enslave's resentment (−1 tax)
  _enslavedUntil: z.number().optional(),
  // (P1-12b5) the tax an earthquake still takes from the province
  _earthquakeTax: z.number().optional(),
});
export type Province = z.infer<typeof ProvinceSchema>;
/** A province's feature: a lair, a ruin, a ritual site. */
export type ProvinceFeature = Province['features'][number];

export const RealmSchema = z.object({
  id: RealmIndexSchema,
  name: z.string(),
  kingName: z.string(),
  _isBot: z.boolean(),
  color: z.string(),
  race: z.string(),
  alignment: z.string(),
  temper: z.string(),
  gold: z.number(),
  king: z.number(),
  heroes: z.array(z.number()),
  provinces: z.array(z.number()),
  homeProvinceId: z.number(),
  merits: z.number(),
  _encountered: z.array(z.number()),
  consecratedProvIds: z.array(z.number()).optional(),
  // PROTOTYPE (alignment ideas round 2, src/engine/alignment-prototypes.ts): what the kings' orders leave on a realm
  _kingOrderLast: z.record(z.string(), z.number()).optional(), // the turn each king-only kit order was last given
  _crusadeVs: z.number().optional(), // Divine: the realm the Crusade is proclaimed against
  _crusadeUntil: z.number().optional(), // Divine: the last turn it holds
  _embargoUntil: z.number().optional(), // Neutral: the last turn this realm's tax is under Embargo
  _embargoBy: z.number().optional(), // Neutral: the realm whose Embargo it is
  _sacrificeUntil: z.number().optional(), // Pagan: the last turn the Great Sacrifice's favour holds
  _offerings: z.number().optional(), // Pagan (round 9): Blood Harvest gold not yet turned into warriors
  _spiedProvincesLastTurn: z.array(z.number()).optional(),
  _spiedProvincesThisTurn: z.array(z.number()).optional(),
  // the hero the realm watches with Clairvoyance this turn (the matrix's states hold only null)
  _clairCharThisTurn: z.number().nullable().optional(),
  _spiedHeroSkills: z
    .record(
      z.string(),
      z.object({
        name: z.string(),
        isKing: z.boolean(),
        alignment: z.string(),
        race: z.string(),
        kingdom: z.string(),
        skills: SkillLevelsSchema,
        items: z.array(z.string()),
        armies: z.array(z.object({ type: z.string(), quality: z.string(), unitName: z.string() })),
        turn: z.number(),
      }),
    )
    .optional(),
  _botLandPrev: z.number().optional(),
  _botLandSeenTurn: z.number().optional(),
  _botIntel: z
    .object({ generals: z.record(z.string(), BotIntelHeroSchema), heroes: z.record(z.string(), BotIntelHeroSchema) })
    .optional(),
  _botTitles: z.array(z.string()).optional(),
  _provMemory: z
    .record(
      z.string(),
      z.object({
        turn: z.number(),
        phase: z.number(),
        name: z.string(),
        terrain: z.string(),
        race: z.string().nullable(),
        tax: z.number(),
        armyTypes: z.array(z.string()),
        features: z.array(
          z.object({ name: z.string(), cleared: z.boolean(), ritualSite: z.boolean(), power: z.string() }),
        ),
        owner: z.number().nullable(),
        ownerName: z.string().nullable(),
        ownerColor: z.string().nullable(),
        isHomeCapitalOfOwner: z.boolean(),
      }),
    )
    .optional(),
  seenCharIntel: z
    .record(
      z.string(),
      z.object({
        id: z.number(),
        name: z.string(),
        isKing: z.boolean(),
        race: z.string(),
        alignment: z.string(),
        player: z.number().nullable(),
        isWandering: z.boolean(),
        lastSeenTurn: z.number(),
        lastLocId: z.number(),
        lastLocName: z.string(),
      }),
    )
    .optional(),
  _lastWages: z
    .object({
      turn: z.number(),
      armyWages: z.number(),
      heroWages: z.number(),
      hostLeaderG: z.number(),
      heroWageDisc: z.number(),
      orcSpoilsG: z.number(),
      discUpkeepG: z.number(),
    })
    .optional(),
  _overturesIn: z.array(z.object({ from: z.number(), kind: z.string() })).optional(),
  heirPending: z.boolean().optional(),
  knownDeadHeroIds: z.array(z.number()).optional(),
  seenDeadHeroIds: z.array(z.unknown()).optional(),
  _calledToArmsTurn: z.number().optional(),
  _botStall: z.number().optional(),
  _botWar: z.record(z.string(), z.object({ since: z.number().optional(), peaceAt: z.number().optional() })).optional(),
  discoveries: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        desc: z.string(),
        turnDiscovered: z.number(),
      }),
    )
    .optional(),
  pendingDiscoveryChoices: z
    .array(
      z.object({
        key: z.string(),
        turn: z.number(),
        charId: z.number(),
        charName: z.string(),
        category: z.string(),
        options: z.array(z.string()),
      }),
    )
    .optional(),
  forgottenDiscoveries: z.array(z.string()).optional(),
  _knownWeak: z.record(z.string(), z.boolean()).optional(),
  _lairRumours: z
    .record(
      z.string(),
      z.object({
        turn: z.number(),
        gold: z.number(),
        items: z.array(z.string()),
        stolen: z.array(z.string()),
        wields: z.array(z.string()),
      }),
    )
    .optional(),
  _itemsFoundByCat: z
    .object({
      trinket: z.number().optional(),
      helm: z.number().optional(),
      ring: z.number().optional(),
      amulet: z.number().optional(),
      cloak: z.number().optional(),
      weapon: z.number().optional(),
      shield: z.number().optional(),
      armour: z.number().optional(),
      combat: z.number().optional(),
    })
    .optional(),
  _graveIntel: z
    .record(
      z.string(),
      z.object({
        turn: z.number(),
        detail: z.array(z.object({ k: z.string(), n: z.number() })).nullable(),
        detailTurn: z.number().nullable(),
        detailPartial: z.boolean(),
      }),
    )
    .optional(),
  _resurrectableMonarchId: z.number().nullable().optional(),
  conceded: z.boolean().optional(),
  concededTurn: z.number().optional(),
  _spiedOnThisTurn: z
    .array(
      z.object({
        provId: z.number(),
        provName: z.string(),
        byPlayer: z.number(),
        byName: z.string(),
        turn: z.number(),
      }),
    )
    .optional(),
  _botSpyMemo: z.record(z.string(), z.number()).optional(),
  _eliminated: z.boolean().optional(),
  _eliminatedTurn: z.number().optional(),
  botGrudges: z.array(z.number()).optional(),
  // a rival realm → the turn the bot let its grudge rest (the matrix holds it only empty)
  _botGrudgeTruce: z.record(z.string(), z.number()).optional(),
});
export type Realm = z.infer<typeof RealmSchema>;

export const GraveSchema = z.object({
  id: CharacterIdSchema,
  name: z.string(),
  player: RealmIndexSchema.nullable(),
  race: z.string(),
  alignment: z.string(),
  temper: z.string(),
  skills: SkillLevelsSchema,
  maxHp: z.number(),
  isKing: z.boolean(),
  killedOnTurn: z.number(),
  location: ProvinceIdSchema,
  served: z.array(z.number()),
  _releasedBy: z.null(),
  _monarch: z.boolean().optional(),
  _divineLost: z.boolean().optional(),
});
export type Grave = z.infer<typeof GraveSchema>;

export const MajorTitleHolderSchema = z.object({
  playerIndex: z.number().nullable(),
  charId: z.number().nullable(),
  merit: z.number(),
  prize: z.number(),
  name: z.string(),
});
export type MajorTitleHolder = z.infer<typeof MajorTitleHolderSchema>;

export const MinorTitleHolderSchema = z.object({
  charId: z.number(),
  playerIndex: z.number(),
  name: z.string(),
  perk: z.string(),
});
export type MinorTitleHolder = z.infer<typeof MinorTitleHolderSchema>;

export const MajorTitleSnapshotSchema = z.object({
  charId: z.number().nullable(),
  playerIndex: z.number().nullable(),
  kingdomLevel: z.boolean(),
});
export type MajorTitleSnapshot = z.infer<typeof MajorTitleSnapshotSchema>;

export const MinorTitleSnapshotSchema = z.object({ charId: z.number().nullable(), playerIndex: z.number().nullable() });
export type MinorTitleSnapshot = z.infer<typeof MinorTitleSnapshotSchema>;

export const MercenarySchema = ArmySchema.extend({ location: ProvinceIdSchema, isSea: z.boolean(), id: z.string() });
export type Mercenary = z.infer<typeof MercenarySchema>;

export const GameStateSchema = z.object({
  world: z.object({ provinces: z.array(ProvinceSchema), cols: z.number(), rows: z.number(), seaPct: z.number() }),
  players: z.array(RealmSchema),
  characters: z.array(CharacterSchema),
  mercenaries: z.array(MercenarySchema),
  relations: z.record(z.string(), z.string()),
  heroGraveyard: z.array(GraveSchema),
  turn: z.number(),
  phase: z.number(),
  maxTurns: z.number(),
  log: z.array(z.unknown()),
  // each hero's orders for the turn's five phases, cleared once the turn runs: a new game holds five nulls a hero
  turnOrders: z.record(z.string(), z.array(z.null())),
  nextItemId: z.number(),
  _awardedItems: z.array(z.string()),
  _lairNamesV3: z.boolean(),
  _lairNamesV2: z.boolean(),
  _maxHpV2: z.boolean(),
  _maxHpV3: z.boolean(),
  _guardiansV2: z.boolean(),
  _guardiansVer: z.number(),
  turnMode: z.object({
    mode: z.string(),
    time: z.string(),
    everyDays: z.number(),
    // the matrix plays every game by hand (mode 'manual'); a game on a deadline holds the next one's time
    nextDeadlineAt: z.string().nullable(),
    turnRanAt: z.string().nullable(),
  }),
  botDifficulty: z.string(),
  botDiplomacy: z.string(),
  // PROTOTYPE (alignment ideas round 1): the alignments whose proposed kit is switched on in this game; absent when none
  alignmentPrototypes: z.array(z.string()).optional(),
  // PROTOTYPE (ideas round 1b): the bots play to their kits (src/engine/alignment-prototypes.ts, kitTactics)
  alignmentPrototypeTactics: z.boolean().optional(),
  // PROTOTYPE (ideas round 4): the bots hunt lairs at a human player's pace (src/engine/bots/missions.ts, botLairTiers)
  botLairHunting: z.boolean().optional(),
  // (P1-12b5: read by the realm's view, for its diplomacy) Safe Start: no diplomacy before turn SAFE_START_TURN; the
  // matrix's games don't set it
  safeStart: z.boolean().optional(),
  _nameRepairs: z.number().optional(),
  _titleHolders: z
    .object({
      throne: MajorTitleHolderSchema.optional(),
      vault: MajorTitleHolderSchema.optional(),
      marshal: MajorTitleHolderSchema.optional(),
      sea: MajorTitleHolderSchema.optional(),
      monster: MajorTitleHolderSchema.optional(),
      lore: MajorTitleHolderSchema.optional(),
      arch: MajorTitleHolderSchema.optional(),
      hiero: MajorTitleHolderSchema.optional(),
      necro: MajorTitleHolderSchema.optional(),
      spy: MajorTitleHolderSchema.optional(),
      carto: MajorTitleHolderSchema.optional(),
      beast: MajorTitleHolderSchema.optional(),
      wild: MajorTitleHolderSchema.optional(),
    })
    .optional(),
  _minorHolders: z
    .object({
      duelist: MinorTitleHolderSchema.optional(),
      marksman: MinorTitleHolderSchema.optional(),
      strategist: MinorTitleHolderSchema.optional(),
      swift: MinorTitleHolderSchema.optional(),
      seawolf: MinorTitleHolderSchema.optional(),
      shadow: MinorTitleHolderSchema.optional(),
      cutpurse: MinorTitleHolderSchema.optional(),
      naturalist: MinorTitleHolderSchema.optional(),
      loreseeker: MinorTitleHolderSchema.optional(),
      trailblazer: MinorTitleHolderSchema.optional(),
      colossus: MinorTitleHolderSchema.optional(),
      champion: MinorTitleHolderSchema.optional(),
      hostleader: MinorTitleHolderSchema.optional(),
      cavalier: MinorTitleHolderSchema.optional(),
      relichunter: MinorTitleHolderSchema.optional(),
      castellan: MinorTitleHolderSchema.optional(),
      warlock: MinorTitleHolderSchema.optional(),
      beastmaster: MinorTitleHolderSchema.optional(),
      ironclad: MinorTitleHolderSchema.optional(),
      widowmaker: MinorTitleHolderSchema.optional(),
    })
    .optional(),
  _espionageLedger: z
    .array(
      z.object({
        byPi: z.number(),
        charId: z.number(),
        charName: z.string(),
        isKing: z.boolean(),
        provId: z.number(),
        kind: z.string(),
      }),
    )
    .optional(),
  _guardianHpV2: z.boolean().optional(),
  _phaseSkillSnapshot: z.record(z.string(), SkillLevelsSchema).optional(),
  _pendingRises: z.array(z.unknown()).optional(),
  _titleGainsByPlayer: z
    .record(
      z.string(),
      z.array(
        z.object({
          scope: z.string(),
          key: z.string(),
          name: z.string(),
          charName: z.string().nullable(),
          kingdomName: z.string(),
          kingdomLevel: z.boolean().optional(),
          perk: z.string(),
          req: z.string(),
          initial: z.boolean(),
        }),
      ),
    )
    .optional(),
  _titleLossesByPlayer: z
    .record(
      z.string(),
      z.array(
        z.object({
          scope: z.string(),
          key: z.string(),
          name: z.string(),
          kingdomLevel: z.boolean(),
          vacant: z.boolean(),
          newHolderIndex: z.number().nullable(),
          newHolderName: z.string().nullable(),
          newCharName: z.string().nullable(),
        }),
      ),
    )
    .optional(),
  _titlesSnapshot: z
    .object({
      major: z.object({
        throne: MajorTitleSnapshotSchema,
        vault: MajorTitleSnapshotSchema,
        marshal: MajorTitleSnapshotSchema,
        sea: MajorTitleSnapshotSchema,
        monster: MajorTitleSnapshotSchema,
        lore: MajorTitleSnapshotSchema,
        arch: MajorTitleSnapshotSchema,
        hiero: MajorTitleSnapshotSchema,
        necro: MajorTitleSnapshotSchema,
        spy: MajorTitleSnapshotSchema,
        carto: MajorTitleSnapshotSchema,
        beast: MajorTitleSnapshotSchema,
        wild: MajorTitleSnapshotSchema,
      }),
      minor: z.object({
        duelist: MinorTitleSnapshotSchema,
        marksman: MinorTitleSnapshotSchema,
        strategist: MinorTitleSnapshotSchema,
        swift: MinorTitleSnapshotSchema,
        seawolf: MinorTitleSnapshotSchema,
        shadow: MinorTitleSnapshotSchema,
        cutpurse: MinorTitleSnapshotSchema,
        naturalist: MinorTitleSnapshotSchema,
        loreseeker: MinorTitleSnapshotSchema,
        trailblazer: MinorTitleSnapshotSchema,
        colossus: MinorTitleSnapshotSchema,
        widowmaker: MinorTitleSnapshotSchema,
        champion: MinorTitleSnapshotSchema,
        hostleader: MinorTitleSnapshotSchema,
        cavalier: MinorTitleSnapshotSchema,
        beastmaster: MinorTitleSnapshotSchema,
        ironclad: MinorTitleSnapshotSchema,
        relichunter: MinorTitleSnapshotSchema,
        castellan: MinorTitleSnapshotSchema,
        warlock: MinorTitleSnapshotSchema,
      }),
      wasPublic: z.boolean(),
    })
    .optional(),
  _phSeq: z.number().optional(),
  _itemDeliveries: z.array(z.unknown()).optional(),
  reckoningDecaySteps: z.number().optional(),
  reckoning: z
    .object({
      by: z.number(),
      bloc: z.array(z.number()),
      calledTurn: z.number(),
      resolveAtTurn: z.number(),
      thrPct: z.number(),
    })
    .optional(),
  gameOver: z
    .object({
      winner: z.number(),
      byReckoning: z.boolean(),
      turn: z.number(),
      standings: z.array(
        z.object({
          index: z.number(),
          name: z.string(),
          color: z.string(),
          alignment: z.string(),
          score: z.number(),
          titles: z.array(z.string()),
          relics: z.number(),
        }),
      ),
      _announced: z.boolean(),
      byConcession: z.boolean().optional(),
    })
    .optional(),
  _battleNews: z
    .array(
      z.object({
        t: z.number(),
        p: z.number(),
        a: z.number(),
        d: z.number(),
        w: z.number(),
        al: z.number(),
        dl: z.number(),
      }),
    )
    .optional(),
});
export type GameState = z.infer<typeof GameStateSchema>;
/** A Title's key (`throne`, `vault`, …) and a minor title's (`duelist`, …), as the turn keeps their holders. */
export type MajorTitleKey = keyof NonNullable<GameState['_titleHolders']>;
export type MinorTitleKey = keyof NonNullable<GameState['_minorHolders']>;
