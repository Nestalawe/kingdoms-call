// Personal combat's lair guardians, combat spells, a guardian's powers and the fight itself read their rows' figures
// where no game of the matrix reaches, or where one reaches them but no case would tell a figure changed by a little
// (B-06bp: the numbers of personal combat's lair guardians and the odds, its combat spells and guardian abilities, and
// resolve-personal-combat.ts moved to content's rows, src/content/kingdoms-call-data.ts, each named for its rule). Each
// case is worked out by hand from the rule, and the figures are written here as literals, so a row's figure changed
// fails a case:
// - an undead's spell ×1.5 and arrow ×0.7, a fiend's spell ×1.3, a flyer's arrow ×1.4, an armoured guardian's blade
//   ×0.8 and spell ×1.3, a beast's blade ×1.1, an armoured undead's spell at the most, 1.8; the rounds to reach melee
//   2, 3, 4 by pace, 3 at a pace the table holds not (KC_A_GUARDIANS_HIDDEN_TRAITS_IN_PERSONAL_COMBAT). The least, 0.4,
//   binds no guardian (the lowest any kind reaches is an undead's arrow, 0.7): no case;
// - a lair's fight runs 20 rounds, and so does each of the rumour's fights; the rumour stages 300; a lair of no
//   guardian is fought by a stand-in of 10 HP; a hero of no HP is read as entering with 10; the line names the first 6
//   actions of the guardian's plan; a guardian whose record holds no HP has 10 as the rumour stages him, as the line
//   tells his wounds and as he heals (KC_A_LAIR_GUARDIANS_FIGHT,
//   KC_A_FIGHTERS_HIT_POINTS_AS_HE_ENTERS_A_PERSONAL_COMBAT). The stand-in's hoard of at most 3 gold (maxG) is read by
//   no fight: no case;
// - a cast is 30%, 10% a level, at most 95%; 95% against a guardian weak to the school; a bolt's dice count the level
//   to 5 (KC_A_COMBAT_SPELL_CAST_IN_PERSONAL_COMBAT);
// - a guardian's heal of no figure mends 3 to 8; one that ignores all armour adds 3 to each blow; one that names a flee
//   chance takes 30 off (KC_A_GUARDIANS_POWER_IN_PERSONAL_COMBAT);
// - a fight of no rounds named runs 20; Druid 3 wards against a beast, Druid 2 not; the initiative weighs speed ×10;
//   a Brave's second wind waits below his flight's 25% more 5%; a foe of no alignment spares a plea at 50; a fighter
//   reborn rises with 40% of his most HP, at least 5, whether he falls to his foe's action or his own; a fighter whose
//   record holds no most HP is read at 20 as his second wind and his flight weigh his wounds
//   (KC_A_PERSONAL_COMBATS_ROUNDS_WARD_INITIATIVE_SECOND_WIND_AND_MERCY, KC_A_GUARDIANS_REBIRTH_IN_PERSONAL_COMBAT,
//   KC_THE_MOST_HP_OF_A_FIGHTER_WHOSE_RECORD_HOLDS_NONE). The ward's Druid counted to 5 is held by
//   tests/unit/the-combat-spell-lines-no-matrix-game-reaches-keep-their-values.test.ts. Two bind no fight, so no case:
//   the curse's halving (the ward counts Druid to 5, so a cursed Druid is at most 2, below the ward's 3 by any larger
//   divisor), and the second wind's 20 as it counts what he gets back and caps it (a Brave below 30% of 20 gets back 5
//   by 20 or 21, and 5 more never reaches 20).
//
// Level 1 (unit): the engine's functions called directly on staged fighters, a hero of the world and made-up lairs
// (tests/lib/personal-combat.ts), the dice pinned (pc.pinned); a lair's fight stood in (resolvePersonalCombat, by
// vi.spyOn on its module: the lair's functions call it from another file) and the stand-in's reach asserted; a round's
// start counted the same way. Not lower: each figure is read inside a computed value.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { clone, personalCombatEngine } from '../lib/personal-combat.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import type { AFighterInAPersonalCombat } from '../../src/engine/personal-combat/helpers.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { Character } from '../../src/schemas/saved-game-state.ts';

const pc = await personalCombatEngine();
/** The turn's context the engine made for this world (the test library's type names only the fields it reads). */
const tc = pc.turnContext as unknown as TurnContext;
const { monsterTraits, resolveEncounter, simulateLairOdds } =
  await import('../../src/engine/personal-combat/lair-guardians-and-the-odds.ts');
const { pcCharCombatant, pcMonsterCombatant } =
  await import('../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts');
const { pcCastCombatSpell, pcMonsterSpecial } =
  await import('../../src/engine/personal-combat/combat-spells-and-guardian-abilities.ts');
const thePersonalCombat = await import('../../src/engine/personal-combat/resolve-personal-combat.ts');
const theRounds = await import('../../src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts');
const { resolvePersonalCombat } = thePersonalCombat;

afterEach(() => {
  vi.restoreAllMocks();
});

type Staged = Record<string, unknown>;
/** A plain fighter (a guardian of no perks, 20 HP, Melee 2, no wards, of the temper "None": no bonus), with the
 *  fields given. */
function fighter(over: Staged = {}): AFighterInAPersonalCombat {
  const f: Staged = { ...pcMonsterCombatant({ name: 'Made-up Mole', hp: 20, melee: 2 }), ...over };
  return f as unknown as AFighterInAPersonalCombat;
}
/** A line of a narrative as the fact it is, read by its fields. */
type AFact = Readonly<Record<string, unknown>>;
const facts = (narrative: readonly NarrativeLine[]): AFact[] =>
  narrative.map((l): AFact => {
    if (typeof l === 'string') return { kind: l };
    const theFact: object = l;
    return Object.fromEntries(Object.entries(theFact));
  });
/** The lines of a kind. */
const ofKind = (narrative: readonly NarrativeLine[], kind: string) =>
  facts(narrative).filter((l) => l['kind'] === kind);
/** A hero of the world, copied, of no items, titles, magic or curses and of the temper "None", with the skills and
 *  fields given: every field these rules read pinned, so no case's outcome hangs on the world's hero. */
function aHero(skills: Record<string, number>, over: Staged = {}): Character {
  const theHero: Staged = {
    ...clone(pc.base),
    items: [],
    temper: 'None',
    _curses: [],
    _curseHalveStat: null,
    _druidNegated: false,
    skills: { ...Object.fromEntries(Object.keys(pc.base.skills).map((k) => [k, 0])), ...skills },
    ...over,
  };
  return theHero as unknown as Character;
}

describe("a guardian's hidden traits", () => {
  const mods = (over: Staged) => monsterTraits({ name: 'Made-up Thing', cat: 'humanoid', ...over }).mods;
  test('an undead ×1.5 to a spell and ×0.7 to an arrow; a fiend ×1.3 to a spell; a flyer ×1.4 to an arrow', () => {
    expect([mods({ cat: 'undead' }).spell, mods({ cat: 'undead' }).archery]).toEqual([1.5, 0.7]);
    expect(mods({ cat: 'fiend' }).spell).toBe(1.3);
    expect(mods({ name: 'Made-up Harpy' }).archery).toBe(1.4);
  });
  test('an armoured guardian ×0.8 to a blade and ×1.3 to a spell; a beast ×1.1 to a blade; at most 1.8', () => {
    expect([mods({ cat: 'giant' }).melee, mods({ cat: 'giant' }).spell]).toEqual([0.8, 1.3]);
    expect(mods({ cat: 'beast' }).melee).toBe(1.1);
    // an undead knight: 1 + 0.5 + 0.3, at the most
    expect(mods({ name: 'Made-up Knight', cat: 'undead' }).spell).toBe(1.8);
  });
  test('the rounds to reach melee are 2, 3 and 4 by pace, 3 at a pace the table holds not', () => {
    const rounds = (speed: string | undefined) => monsterTraits({ name: 'Made-up Thing', speed }).closeRounds;
    expect(['fast', 'medium', 'slow', 'a made-up pace', undefined].map(rounds)).toEqual([2, 3, 4, 3, 3]);
  });
});

describe("a lair guardian's fight", () => {
  type TheFightsEnd = ReturnType<typeof resolvePersonalCombat>;
  /** Runs `body` with the fight stood in, ending as `end` gives it; each fight's rounds and the guardian's HP. */
  function withTheFightStoodIn<T>(body: () => T, end: Partial<TheFightsEnd> = {}) {
    const fights: { rounds: unknown; theGuardiansHp: number }[] = [];
    vi.spyOn(thePersonalCombat, 'resolvePersonalCombat').mockImplementation((_tc, _A, B, opts) => {
      fights.push({ rounds: opts?.maxRounds, theGuardiansHp: B.hp });
      return {
        winner: null,
        loser: null,
        fledBy: null,
        parley: false,
        stoleBy: null,
        aHp: 4,
        bHp: B.hp,
        narrative: [],
        ...end,
      };
    });
    return { result: body(), fights };
  }
  const aLair = (monster: Staged | null) => ({ name: 'Made-up Ruin', monster, hoardItems: [], _hoardV2: true });
  const aGuardian = (over: Staged = {}): Staged & { hp?: unknown; _hpFull?: unknown } => ({
    name: 'Made-up Ogre',
    cat: 'humanoid',
    power: 'Weak',
    hp: 20,
    ...over,
  });
  const encounter = (c: Character, feature: ReturnType<typeof aLair>) =>
    pc.pinned(0, () =>
      resolveEncounter(tc, c, feature as never, { name: 'Made-up Vale' }, ['ME'], null, () => 0, null),
    );
  test("a lair's fight runs 20 rounds, and so does each of the rumour's; the rumour stages 300", () => {
    const lair = aLair(aGuardian());
    expect(withTheFightStoodIn(() => encounter(aHero({ melee: 3 }), lair)).fights.map((f) => f.rounds)).toEqual([20]);
    const theRumour = withTheFightStoodIn(() => simulateLairOdds(tc, aHero({ melee: 3 }), lair as never));
    expect(theRumour.fights.length).toBe(300);
    expect(new Set(theRumour.fights.map((f) => f.rounds))).toEqual(new Set([20]));
  });
  test('a lair of no guardian is fought by a stand-in of 10 HP; a hero of no HP is read as entering with 10', () => {
    const { result, fights } = withTheFightStoodIn(() => encounter(aHero({ melee: 3 }, { hp: 0 }), aLair(null)));
    expect(fights.map((f) => f.theGuardiansHp)).toEqual([10]);
    // the fight leaves him at 4: 10 less 4
    expect(result.damageToHero).toBe(6);
  });
  test('a guardian whose record holds no HP has 10: as the rumour stages him, as his wounds are told, as he heals', () => {
    const theRumour = withTheFightStoodIn(() =>
      simulateLairOdds(tc, aHero({ melee: 3 }), aLair(aGuardian({ hp: 0 })) as never, 1),
    );
    expect(theRumour.fights.map((f) => f.theGuardiansHp)).toEqual([10]);
    const guardian = aGuardian({ hp: 0 });
    const { result } = withTheFightStoodIn(() => encounter(aHero({ melee: 3 }), aLair(guardian)));
    expect(
      ofKind(result.narrative, 'the guardian is already wounded by someone before').map((l) => l['monFullHp']),
    ).toEqual([10]);
    expect([guardian._hpFull, guardian.hp]).toEqual([10, 10]);
  });
  test("the line names the first 6 actions of the guardian's plan (of 12)", () => {
    const { result } = withTheFightStoodIn(() => encounter(aHero({ melee: 3 }), aLair(aGuardian())));
    const [theLine] = ofKind(result.narrative, "the guardian's speed and plan");
    expect(String(theLine?.['guardianTactics']).split(',').length).toBe(6);
  });
});

describe('a combat spell cast', () => {
  /** A caster of Elemental at the level given, no realm's; the cast's chance and the bolt's damage to a guardian. */
  const bolt = (level: number, target: Staged = {}) => {
    const caster = fighter({
      kind: 'character',
      school: { elemental: level },
      castSpells: [],
      castSchool: {},
      player: null,
    });
    const foe = fighter({ hp: 200, maxHp: 200, ...target });
    const narrative: NarrativeLine[] = [];
    pc.pinned(0, () => pcCastCombatSpell(tc, caster, foe, 'Lightning Bolt', narrative, { range: 'spell' } as never));
    const [theCast] = ofKind(narrative, "the caster calls on a school's arts, weaving a spell");
    return { chance: theCast?.['castChance'], damage: 200 - foe.hp };
  };
  test('a cast is 30% and 10% a level, at most 95%; 95% against a guardian weak to the school', () => {
    expect([3, 6, 7].map((l) => bolt(l).chance)).toEqual([60, 90, 95]);
    expect(bolt(1, { weak: { kind: 'school', key: 'elemental', name: 'Made-up Flaw' } }).chance).toBe(95);
  });
  test("a bolt's dice count the caster's level to 5: Elemental 6 strikes as Elemental 5", () => {
    expect([bolt(5).damage, bolt(6).damage]).toEqual([5, 5]);
  });
});

describe("a guardian's power", () => {
  const usePower = (die: number, effect: string) => {
    const guardian = fighter({ hp: 5, maxHp: 100 });
    const foe = fighter();
    pc.pinned(die, () => {
      pcMonsterSpecial(tc, guardian, foe, { name: 'Made-up Grip', effect, dmgW: 0 }, [], { range: 'melee' } as never);
    });
    return { guardian, foe };
  };
  test('a heal of no figure mends 3 to 8', () => {
    expect([usePower(0, 'regenerates').guardian.hp, usePower(0.99, 'regenerates').guardian.hp]).toEqual([8, 13]);
  });
  test('one that ignores all armour adds 3 to each blow; one that names a flee chance takes 30 off', () => {
    const { foe } = usePower(0, 'ignores all armour; lowers flee chance');
    expect([foe.status.incomingDmgBonus, foe.status.fleePenalty]).toEqual([3, 30]);
  });
});

describe('the fight itself', () => {
  test('a fight of no rounds named runs 20', () => {
    const aRound = vi.spyOn(theRounds, 'pcRoundStart');
    pc.pinned(0.99, () =>
      resolvePersonalCombat(tc, fighter({ hp: 500, maxHp: 500 }), fighter({ hp: 500, maxHp: 500 })),
    );
    // each round starts both fighters'
    expect(aRound.mock.calls.length).toBe(40);
  });
  test('Druid 3 wards a hero against a beast, Druid 2 not', () => {
    const ward = (druid: number) => {
      const hero = pcCharCombatant(tc, aHero({ druid }));
      pc.pinned(0.99, () => resolvePersonalCombat(tc, hero, fighter({ cat: 'beast' }), { maxRounds: 1 }));
      return hero.druidBeastWard;
    };
    expect([ward(2), ward(3)]).toEqual([0, 3]);
  });
  test('the initiative weighs speed ×10: a slow guardian of Melee 10 goes first against a medium one of 0, of 9 not', () => {
    const first = (melee: number) => {
      const res = pc.pinned(0.5, () =>
        resolvePersonalCombat(
          tc,
          fighter({ name: 'Made-up Ann', speedName: 'slow', melee, archery: 0 }),
          fighter({ name: 'Made-up Bob', speedName: 'medium', melee: 0, archery: 0 }),
          { maxRounds: 1 },
        ),
      );
      return ofKind(res.narrative, 'one fighter has the initiative')[0]?.['firstName'];
    };
    expect([first(10), first(9)]).toEqual(['Made-up Ann', 'Made-up Bob']);
  });
  /** A Brave fighter of the HP given, after one round against a foe who can't hurt him; his second wind's lines. */
  const secondWind = (hp: number, maxHp: number) => {
    const brave = fighter({ name: 'Made-up Ann', temper: 'Brave', neverFlees: true, hp, maxHp, melee: 0 });
    brave.status.absorb = 100;
    const res = pc.pinned(0.99, () =>
      resolvePersonalCombat(tc, brave, fighter({ hp: 500, maxHp: 500 }), { maxRounds: 1 }),
    );
    return ofKind(res.narrative, 'a fighter finds their second wind and fights on').length;
  };
  test("a Brave's second wind waits below 30% (his flight's 25% and 5%): at 29 of 100, not at 30", () => {
    expect([secondWind(29, 100), secondWind(30, 100)]).toEqual([1, 0]);
  });
  test('a fighter whose record holds no most HP is read at 20 as his second wind and his flight weigh his wounds', () => {
    expect([secondWind(5, 0), secondWind(6, 0)]).toEqual([1, 0]);
    const flees = (hp: number) => {
      const cautious = fighter({
        name: 'Made-up Ann',
        kind: 'character',
        temper: 'Cautious',
        neverFlees: false,
        hp,
        maxHp: 0,
        melee: 0,
      });
      cautious.status.absorb = 100;
      const res = pc.pinned(0, () =>
        resolvePersonalCombat(tc, cautious, fighter({ hp: 500, maxHp: 500, melee: 0 }), { maxRounds: 1 }),
      );
      return ofKind(res.narrative, 'a fighter tries to flee').length;
    };
    // 7 of 20 is below a Cautious fighter's 40%; 8 is not
    expect([flees(7), flees(8)]).toEqual([1, 0]);
  });
  test('a foe of no alignment spares a plea at 50', () => {
    const coward = fighter({
      name: 'Made-up Ann',
      kind: 'character',
      temper: 'Cowardly',
      neverFlees: true,
      hp: 1,
      maxHp: 20,
      melee: 0,
    });
    const res = pc.pinned(0, () =>
      resolvePersonalCombat(tc, coward, fighter({ melee: 5, alignment: '' }), { maxRounds: 3 }),
    );
    const pleas = facts(res.narrative).filter((l) => l['odds'] != null);
    expect(pleas.map((l) => (l['odds'] as { mercy: number }).mercy)).toEqual([50]);
  });
  test('a fighter reborn rises with 40% of his most HP, at least 5: felled by his foe, or by his own blow', () => {
    /** A fighter of 1 HP who will rise again, felled by his foe's blow (the foe first) or his own (a reflecting foe). */
    const risesWith = (maxHp: number, byHisOwnBlow: boolean) => {
      const reborn = fighter({
        name: 'Made-up Ann',
        hp: 1,
        maxHp,
        melee: 5,
        _rebirth: true,
        speedName: byHisOwnBlow ? 'fast' : 'medium',
      });
      const foe = fighter({
        name: 'Made-up Bob',
        hp: 500,
        maxHp: 500,
        melee: byHisOwnBlow ? 0 : 5,
        speedName: byHisOwnBlow ? 'slow' : 'fast',
      });
      if (byHisOwnBlow) foe.status.reflect = 50;
      const res = pc.pinned(0, () => resolvePersonalCombat(tc, reborn, foe, { maxRounds: 1 }));
      return ofKind(res.narrative, 'the foe bursts into ash then blazes back to life').map((l) => l['foeHp']);
    };
    expect([risesWith(20, false), risesWith(10, false)]).toEqual([[8], [5]]);
    expect([risesWith(20, true), risesWith(10, true)]).toEqual([[8], [5]]);
  });
});
