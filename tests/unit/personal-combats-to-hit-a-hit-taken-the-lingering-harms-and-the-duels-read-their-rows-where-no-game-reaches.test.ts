// Personal combat's to-hit, a blow, a hit taken, the lingering harms and the duels read their rows' figures where no
// game of the matrix reaches, or where one reaches them but no case would tell a figure changed by a little (B-06bn:
// the numbers of personal combat's to-hit, wounds, stuns and courage, its helpers and its duels moved to content's rows,
// src/content/kingdoms-call-data.ts, each named for its rule). Each case is worked out by hand from the rule, and the
// figures are written here as literals, so a row's figure changed fails a case:
// - a blow's chance to hit is 30% and 10% a level of the striker's Melee to level 5, then 5% a level: 85% at Melee 6,
//   held to at least 5% (KC_A_BLOWS_CHANCE_TO_HIT_IN_PERSONAL_COMBAT);
// - a halved blow is the blow divided by 2, rounded down (KC_A_BLOWS_DAMAGE_IN_PERSONAL_COMBAT);
// - a Druid's beast ward divides a blow by 2, rounded; a Parry turns a melee blow at a die below 0.5 by 1 to half the
//   parrier's Melee; Elemental Armour takes off 1 to 3 (KC_A_HIT_TAKEN_IN_PERSONAL_COMBAT);
// - a fighter whose record holds no most HP heals to 20 (KC_THE_MOST_HP_OF_A_FIGHTER_WHOSE_RECORD_HOLDS_NONE);
// - a lingering harm lasts at most 3 rounds, and a to-hit penalty fades by at least 5 a round
//   (KC_A_WEAKNESS_THE_DAMAGE_FLOOR_AND_THE_LINGERING_HARMS_IN_PERSONAL_COMBAT);
// - a hero who flees a duel drops an item at 50%; a duel and an encounter run at most 20 rounds; a hero of Thief 8 (the
//   third tier) keeps his purse, one of Thief 7 doesn't; a felled hero is slain at a die below 0.3, not at 0.3
//   (KC_A_DUELS_AND_A_HEROS_ENCOUNTERS_FIGURES).
//
// Level 1 (unit): the engine's functions called directly on staged fighters and the world's heroes (tests/lib/
// personal-combat.ts), the dice pinned (pc.pinned); the fight of a duel and an encounter stood in (resolvePersonalCombat,
// by vi.spyOn on its module for the call's length: the duels call it from another file), and the stand-in's reach
// asserted. Not lower: each figure is read inside a computed value.
import { describe, expect, test, vi } from 'vitest';
import { clone, personalCombatEngine } from '../lib/personal-combat.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import type { AFighterInAPersonalCombat } from '../../src/engine/personal-combat/helpers.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { Character, Item } from '../../src/schemas/saved-game-state.ts';

const pc = await personalCombatEngine();
/** The turn's context the engine made for this world (the test library's type names only the fields it reads). */
const tc = pc.turnContext as unknown as TurnContext;
const { pcHitChance, pcMeleeDamage, pcRoundStart, pcSkillHitPct, pcTakeHit } =
  await import('../../src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts');
const { pcMonsterCombatant, pcNewStatus } =
  await import('../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts');
const { pcLingerRounds, pcPenaltyFade } = await import('../../src/engine/personal-combat/helpers.ts');
const { duelFleeItemDrop, resolveCharVsChar, resolveDuel } =
  await import('../../src/engine/personal-combat/duels-and-character-encounters.ts');
const thePersonalCombat = await import('../../src/engine/personal-combat/resolve-personal-combat.ts');
const { ALL_MAGIC_ITEMS_P } = await import('../../src/content/kingdoms-call-data.ts');

type Staged = Record<string, unknown>;
/** A plain fighter (a guardian of no perks, 20 HP, Melee 2, no wards, of the temper "None": no bonus), with the
 *  fields given. */
function fighter(over: Staged = {}): AFighterInAPersonalCombat {
  const f: Staged = { ...pcMonsterCombatant({ name: 'Made-up Mole', hp: 20, melee: 2 }), ...over };
  return f as unknown as AFighterInAPersonalCombat;
}
/** A fighter's status as pcNewStatus makes it, with the fields given. */
const status = (over: Staged = {}) => ({ ...pcNewStatus(), ...over });
/** A line of a narrative as the fact it is, read by its fields. */
type AFact = Readonly<Record<string, unknown>>;
const facts = (narrative: readonly NarrativeLine[]): AFact[] =>
  narrative.map((l): AFact => {
    if (typeof l === 'string') return { kind: l };
    const theFact: object = l;
    return Object.fromEntries(Object.entries(theFact));
  });
/** A blow of `dmg` on `target`, the dice pinned at `r` (a list used in turn): what it dealt, and the lines. */
function hit(target: AFighterInAPersonalCombat, dmg: number, r: number | number[] = 0) {
  const narrative: NarrativeLine[] = [];
  const dealt = pc.pinned(r, () => pcTakeHit(tc, target, dmg, narrative, 'a foe', 'blow'));
  return { dealt, lines: facts(narrative) };
}
/** The lines of a kind. */
const ofKind = (lines: readonly AFact[], kind: string) => lines.filter((l) => l['kind'] === kind);

describe('a blow and its chance to hit', () => {
  test('30% and 10% a level to Melee 5, then 5% a level above it', () => {
    expect([0, 1, 5, 6, 7].map((lvl) => pcSkillHitPct(lvl))).toEqual([30, 40, 80, 85, 90]);
  });
  test('the chance after every modifier is at least 5%', () => {
    expect(pcHitChance(tc, fighter({ status: status({ hitPenalty: 200 }) }), fighter())).toBe(5);
  });
  test('a halved blow is divided by 2, rounded down: a Legendary guardian of Melee 2 deals 4 + 2 = 6, halved 3', () => {
    const blow = (s: Staged) =>
      pc.pinned(0, () => pcMeleeDamage(fighter({ power: 'Legendary', status: status(s) }), fighter()));
    expect(blow({})).toBe(6);
    expect(blow({ meleeHalvedRounds: 1 })).toBe(3);
  });
});

describe('a hit taken', () => {
  test("a Druid's beast ward halves a blow of 9 to 5 (rounded), within the floor of half", () => {
    const { dealt, lines } = hit(fighter({ druidBeastWard: 3 }), 9);
    expect(dealt).toBe(5);
    expect(ofKind(lines, "the target reads the beast's every move").map((l) => l['damageTurnedAside'])).toEqual([4]);
    expect(ofKind(lines, 'the target turns aside all they can but the harm still lands')).toEqual([]);
  });
  test('a Parry turns a blow at a die below 0.5, not at 0.55, by 1 to half his Melee (Melee 6: 3)', () => {
    const parrier = () => fighter({ perkParry: true, meleeRaw: 6 });
    expect(hit(parrier(), 8, [0.55, 0.99]).dealt).toBe(8);
    expect(hit(parrier(), 8, [0.49, 0.99]).dealt).toBe(5);
    expect(hit(parrier(), 8, [0.49, 0]).dealt).toBe(7);
  });
  test('Elemental Armour takes off 1 to 3', () => {
    expect(hit(fighter({ perkElemArmour: true }), 8, 0).dealt).toBe(7);
    expect(hit(fighter({ perkElemArmour: true }), 8, 0.99).dealt).toBe(5);
  });
  test('a fighter whose record holds no most HP heals to 20', () => {
    const f = fighter({ hp: 5, maxHp: 0, status: status({ hot: { amt: 30, rounds: 1, label: 'a made-up draught' } }) });
    pc.pinned(0.99, () => {
      pcRoundStart(f, []);
    });
    expect(f.hp).toBe(20);
  });
});

describe('the lingering harms', () => {
  test('a lingering harm lasts at most 3 rounds', () => {
    expect([1, 2, 3, 4, 9].map((n) => pcLingerRounds(n))).toEqual([1, 2, 3, 3, 3]);
  });
  test('a to-hit penalty fades by at least 5 a round, or a third of it, rounded up', () => {
    expect([1, 6, 15, 16, 30].map((p) => pcPenaltyFade(p))).toEqual([5, 5, 5, 6, 10]);
  });
});

describe('the duels and a hero’s encounters', () => {
  /** Two living heroes of two realms of the world, copied, of no Thief and no items, the second of no king. */
  function twoHeroes(): [Character, Character] {
    const heroes = tc.G.characters.filter((c) => c.alive && c.player != null && !c.isKing);
    const a = heroes[0];
    const b = heroes.find((c) => c.player !== a?.player);
    if (!a || !b) throw new Error('the world has no two living heroes of two realms');
    return [
      { ...clone(a), items: [], skills: { ...a.skills, thief: 0 } },
      { ...clone(b), items: [], skills: { ...b.skills, thief: 0 } },
    ];
  }
  type TheFightsEnd = ReturnType<typeof thePersonalCombat.resolvePersonalCombat>;
  /** Runs `body` with the fight stood in by one that ends as `end` gives it; the rounds each fight was given. */
  function withTheFightStoodIn<T>(
    end: (A: AFighterInAPersonalCombat, B: AFighterInAPersonalCombat) => Partial<TheFightsEnd>,
    body: () => T,
  ) {
    const rounds: unknown[] = [];
    const theFight = vi.spyOn(thePersonalCombat, 'resolvePersonalCombat').mockImplementation((_tc, A, B, opts) => {
      rounds.push(opts?.maxRounds);
      return {
        winner: null,
        loser: null,
        fledBy: null,
        parley: false,
        stoleBy: null,
        aHp: 10,
        bHp: 10,
        narrative: [],
        ...end(A, B),
      };
    });
    try {
      return { result: body(), rounds };
    } finally {
      theFight.mockRestore();
    }
  }
  const encounter = (atk: Character, def: Character, die = 3) =>
    resolveCharVsChar(tc, atk, def, null, null, null, null, () => die, tc.G);

  test('a duel and an encounter run at most 20 rounds', () => {
    const [a, b] = twoHeroes();
    expect(
      withTheFightStoodIn(
        () => ({}),
        () => resolveDuel(tc, a, b, []),
      ).rounds,
    ).toEqual([20]);
    expect(
      withTheFightStoodIn(
        () => ({}),
        () => encounter(a, b),
      ).rounds,
    ).toEqual([20]);
  });
  test('a felled hero who is no king is slain at a die below 0.3, not at 0.3', () => {
    const [a, b] = twoHeroes();
    const felled = (die: number) =>
      pc.pinned(
        die,
        () =>
          withTheFightStoodIn(
            () => ({ aHp: 0, bHp: 0 }),
            () => encounter(a, b),
          ).result,
      );
    expect([felled(0.2999).atkKilled, felled(0.2999).defKilled]).toEqual([true, true]);
    expect([felled(0.3).atkKilled, felled(0.3).defKilled]).toEqual([false, false]);
  });
  test('a hero of Thief 8 keeps his purse; one of Thief 7 has it picked', () => {
    const [a, b] = twoHeroes();
    const picked = (thiefOfTheVictim: number) => {
      const victim = { ...b, skills: { ...b.skills, thief: thiefOfTheVictim } };
      const { result } = withTheFightStoodIn(
        (A) => ({ stoleBy: A }),
        () => encounter(a, victim),
      );
      return facts(result.narrative).map((l) => l['kind']);
    };
    const realmOf = (c: Character) => tc.G.players[c.player ?? -1];
    const theVictimsRealm = realmOf(b);
    if (!theVictimsRealm || !realmOf(a)) throw new Error('a hero of no realm');
    theVictimsRealm.gold = 10;
    expect(picked(8)).toContain("the attacker goes for the defender's purse and comes away with nothing");
    expect(picked(7)).toContain("the attacker lifts gold from the defender's purse");
  });
  test('a hero who flees a duel drops an item at a chance of 50%', () => {
    const anItem = ALL_MAGIC_ITEMS_P.find((it) => it.name !== 'Mithril Armour');
    if (!anItem) throw new Error('no magic item in the content');
    // two heroes the world doesn't hold (duelFleeItemDrop reads the world's record of each by its id, else the one
    // handed), the runner with one magic item; the die at its highest, so nothing drops
    const theItem = { ...clone(anItem), id: 'a-made-up-item', equipped: true } as unknown as Item;
    const runner = { id: 'a-made-up-runner', name: 'Made-up Runner', items: [theItem] };
    const stayer = { id: 'a-made-up-stayer', name: 'Made-up Stayer', items: [] };
    const narrative: NarrativeLine[] = [];
    pc.pinned(0.99, () =>
      duelFleeItemDrop(tc, { kind: 'character', ref: runner }, { kind: 'character', ref: stayer }, narrative),
    );
    expect(
      ofKind(facts(narrative), 'the runner scrambles clear with a chance of dropping something').map(
        (l) => l['chance'],
      ),
    ).toEqual([50]);
    expect(runner.items).toEqual([theItem]);
  });
});
