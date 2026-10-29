// The hit and round lines no game of the balance matrix reaches keep their values (plan P1-10b12, P1-10's Choice 2 of
// 2026-10-29: the cases P1-19r extends). The lines P1-10b12 changed to free personal-combat/to-hit-wounds-stuns-and-
// courage.ts and melee-flight-and-archery.ts of the ts-nocheck line that no game reaches give the value each gave
// before (worked out by the rules as the files had them, with their ts-nocheck line):
// - a value the code guards, missing: no fighter, foe, target, status, narrative, wards, names, hero, grade, school,
//   raw level, round, lingering list, pending rise or its list, striker, realm or foe's kind; a gap in a list;
// - a number a `||` gave its fallback for, which `??` alone would keep: a 0 or a missing Mithril ward, open guard's
//   percentage, nature's factor, count of guards used, round, raw level; a grade or temper the tables lack;
// - the wards no game sees take effect (P1-19's count: a block, a first hit, a resist, a dodge, the Warbringer worn),
//   a hit's cap, the Mithril ward, and a fighter of no status, which throws where it threw;
// - and what each ward does that no game of the matrix sees (plan P1-19r, which moved them into the items' registry,
//   extends these: P1-19's count: a buckler, a cap, a low-HP cut, thorns, a second wind; and the arrow and spell
//   blocks, the flat and spell cuts, and a round's fresh ward, sloughing and regeneration), each from a ward table or
//   a merge as the fight builds it.
// Level 1 (unit): each is a plain function on a staged fighter, called on the engine's modules (tests/lib/
// personal-combat.ts, for the turn's context), the dice pinned with kcRng.use (pc.pinned); a static check can't run
// them, and no game reaches these lines.
import { describe, expect, test } from 'vitest';
import { clone, personalCombatEngine } from '../lib/personal-combat.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import type { AFighterInAPersonalCombat } from '../../src/engine/personal-combat/helpers.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';

const pc = await personalCombatEngine();
/** The turn's context the engine made for this world (the test library's type names only the fields it reads). */
const tc = pc.turnContext as unknown as TurnContext;
const {
  pcCourageChance,
  pcHitChance,
  pcHitSkill,
  pcLandStun,
  pcMeleeDamage,
  pcRoundStart,
  pcStunTurned,
  pcStunWard,
  pcSustainMult,
  pcTakeHit,
} = await import('../../src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts');
const { pcAdvanceOrStrike, pcArrowHitChance, pcCombatXP, pcFireShot, pcFreeStrike, pcMeleeStrike, pcTryCounter } =
  await import('../../src/engine/personal-combat/melee-flight-and-archery.ts');
const { pcMonsterCombatant, pcNewStatus } =
  await import('../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts');
const { pcArmourMerge, pcPenaltyFade } = await import('../../src/engine/personal-combat/helpers.ts');
const { ALL_MAGIC_ITEMS_P } = await import('../../src/content/kingdoms-call-data.ts');

type Staged = Record<string, unknown>;
/** A plain fighter (a guardian of no perks, 20 HP, Melee 2, no wards, of the temper "None": no bonus), with the
 *  fields given; a field given as undefined is taken out. */
function fighter(over: Staged = {}): AFighterInAPersonalCombat {
  const f: Staged = { ...pcMonsterCombatant({ name: 'Made-up Mole', hp: 20, melee: 2 }), ...over };
  for (const [k, v] of Object.entries(over)) if (v === undefined) Reflect.deleteProperty(f, k);
  return f as unknown as AFighterInAPersonalCombat;
}
/** A fighter's status as pcNewStatus makes it, with the fields given. */
const status = (over: Staged = {}) => ({ ...pcNewStatus(), ...over });
/** A fighter of no status. */
const noStatus = (over: Staged = {}) => fighter({ ...over, status: undefined });
/** Each line's kind. */
const kinds = (narrative: readonly NarrativeLine[]) => narrative.map((l) => (typeof l === 'string' ? l : l.kind));
/** A blow of `dmg` on `target`, the dice pinned at `r`: what it dealt. */
const hit = (target: AFighterInAPersonalCombat, dmg: number, kind = 'blow', r: number | number[] = 0) =>
  pc.pinned(r, () => pcTakeHit(tc, target, dmg, [], 'a foe', kind));
// The functions take a narrative, a foe or a fighter that no caller leaves out today; these cases pass none.
const none = null as unknown as NarrativeLine[];
const noFoe = null as unknown as AFighterInAPersonalCombat;

describe('the to-hit and the blow', () => {
  test('a fighter of no status has no chill taken off his skill', () => {
    expect(pcHitSkill(noStatus({ meleeRaw: 4 }), 'melee')).toBe(4);
  });
  // a plain fighter swinging at another: 30 + 10 × Melee 2 = 50 (no temper's bonus or guard)
  test('the unseen, a worn dodge and a status dodge (of 0: none) come off the to-hit as before', () => {
    const chance = (defender: AFighterInAPersonalCombat) => pcHitChance(tc, fighter(), defender);
    expect(chance(fighter())).toBe(50);
    expect(chance(fighter({ status: status({ toHitReduce: 25 }) }))).toBe(25);
    expect(chance(fighter({ arm: { names: ['Quicksilver Mail'], dodge: 10 } }))).toBe(40);
    expect(chance(fighter({ status: status({ dodge: 0 }) }))).toBe(50);
    expect(chance(fighter({ status: status({ dodge: 0.5 }) }))).toBe(25);
  });
  test('an arrow: the unseen and a worn dodge come off as before', () => {
    const chance = (foe: AFighterInAPersonalCombat) => pcArrowHitChance(tc, fighter({ archery: 2 }), foe);
    // 30 + 10 × Archery 2
    expect(chance(fighter())).toBe(50);
    expect(chance(fighter({ status: status({ toHitReduce: 25 }) }))).toBe(25);
    expect(chance(fighter({ arm: { names: ['Quicksilver Mail'], dodge: 10 } }))).toBe(40);
  });
  test('a blow: no status, a grade the table lacks, halved, no hero or guardian (the dice at their lowest)', () => {
    const blow = (attacker: AFighterInAPersonalCombat) => pc.pinned(0, () => pcMeleeDamage(attacker, fighter()));
    // a hero: 1 + ⌈raw Melee 4 ÷ 2⌉ + Brave's 1
    expect(blow(noStatus({ kind: 'character', meleeRaw: 4, temper: 'Brave' }))).toBe(4);
    // a guardian: 1 + Melee 2 on a grade the table lacks (1–3); 4 + 2 for a Legendary one (4–9)
    expect(blow(fighter({ power: 'Mythic' }))).toBe(3);
    expect(blow(fighter({ power: 'Legendary' }))).toBe(6);
    expect(blow(fighter({ status: status({ meleeHalvedRounds: 1 }) }))).toBe(1);
    expect(blow(fighter({ ref: undefined }))).toBe(3);
  });
  test('the Warbringer Gauntlets worn add 2 to a hero’s blow', () => {
    const hero = tc.G.characters.find((c) => c.alive && c.player != null);
    if (!hero) throw new Error('the world has no living hero of a realm');
    const gauntlets = ALL_MAGIC_ITEMS_P.find((it) => it.name === 'Warbringer Gauntlets');
    if (!gauntlets) throw new Error('no Warbringer Gauntlets in the content');
    const blow = (items: unknown[]) =>
      pc.pinned(0, () =>
        pcMeleeDamage(
          fighter({ kind: 'character', meleeRaw: 2, temper: 'Brave', ref: { ...clone(hero), items } }),
          fighter(),
        ),
      );
    expect(blow([])).toBe(3);
    expect(blow([{ ...clone(gauntlets), equipped: true }])).toBe(5);
  });
});

describe('the stuns and the courage test', () => {
  test('the stun’s ward of no fighter is 0', () => {
    expect(pcStunWard(null)).toBe(0);
    expect(pcStunWard(undefined)).toBe(0);
  });
  test('a stun turned with no narrative, on no wards, and by wards of no names', () => {
    expect(pcStunTurned(fighter({ arm: { names: ['Signet'], stunImmune: true } }), null, 'a daze')).toBe(true);
    expect(pcStunTurned(fighter(), [], 'a daze')).toBe(false);
    const narrative: NarrativeLine[] = [];
    expect(pcStunTurned(fighter({ arm: { stunImmune: true } }), narrative, 'a daze')).toBe(true);
    expect(narrative).toMatchObject([{ kind: 'the target cannot be held', targetArmourNames: null, w: 100 }]);
  });
  test('a stun lands on no fighter, on no status, and of none or NaN rounds: none', () => {
    expect(pcLandStun(null, 1, [], 'a daze')).toBe(false);
    expect(pcLandStun(noStatus(), 1, [], 'a daze')).toBe(false);
    const f = fighter();
    expect([pcLandStun(f, 0, [], 'a daze'), pcLandStun(f, NaN, [], 'a daze'), f.status.stun]).toEqual([
      false,
      false,
      0,
    ]);
    expect([pcLandStun(f, 2, [], 'a daze'), f.status.stun]).toEqual([true, 2]);
  });
  // 55 + stature − 5 × nerve − faith + temper's terror, within 10–70
  test('the courage test: no raw level, schools, white, foe, guardian, grade; a grade or temper the tables lack', () => {
    const brave = { melee: 3, archery: 1, temper: 'Brave' };
    expect(pcCourageChance(brave, null)).toBe(30);
    expect(pcCourageChance({ ...brave, meleeRaw: 6 }, null)).toBe(15);
    expect(pcCourageChance({ ...brave, melee: 1, archery: 4 }, null)).toBe(25);
    expect(pcCourageChance({ ...brave, school: {} }, null)).toBe(30);
    expect(pcCourageChance({ ...brave, school: { white: 2 } }, null)).toBe(20);
    expect(pcCourageChance(brave, {})).toBe(30);
    expect(pcCourageChance(brave, { ref: null })).toBe(30);
    expect(pcCourageChance(brave, { ref: {} })).toBe(30);
    expect(pcCourageChance(brave, { ref: { power: 'Mythic' } })).toBe(30);
    expect(pcCourageChance(brave, { ref: { power: 'Legendary' } })).toBe(45);
    expect(pcCourageChance({ ...brave, temper: 'Fey' }, null)).toBe(40);
  });
  test('the sustain of no fighter, and of a guardian of no round yet, is whole', () => {
    expect(pcSustainMult(null)).toBe(1);
    expect(pcSustainMult(fighter())).toBe(1);
    expect(pcSustainMult(fighter({ _roundNo: 5 }))).toBe(0.5);
    expect(pcSustainMult(fighter({ _roundNo: 9 }))).toBe(0);
    expect(pcSustainMult(fighter({ kind: 'character', _roundNo: 9 }))).toBe(1);
  });
});

describe('a hit taken', () => {
  test('no target throws, as it did; no narrative takes a plain hit', () => {
    expect(() => pcTakeHit(tc, noFoe, 4, [], 'a foe', 'blow')).toThrow(TypeError);
    const f = fighter();
    expect([pc.pinned(0, () => pcTakeHit(tc, f, 4, none, 'a foe', 'blow')), f.hp]).toEqual([4, 16]);
  });
  test('a hit’s cap is half the maximum, rounded down', () => {
    expect(hit(fighter({ hp: 15, maxHp: 15 }), 12, 'Fireball')).toBe(7);
  });
  test('the first hit is drunk by a first-hit ward, once', () => {
    const f = fighter({ arm: { names: ['Blood-Bound Cuirass'], firstHit: true } });
    expect([hit(f, 4), f._armFirstHitUsed, hit(f, 4)]).toEqual([0, true, 4]);
  });
  test('a block of 100 takes every blow and arrow, not a spell', () => {
    const f = fighter({ arm: { names: ['Tower Shield'], block: 100 } });
    expect([hit(f, 4), hit(f, 4, 'arrow'), hit(f, 4, 'Fireball')]).toEqual([0, 0, 4]);
  });
  test('a round ward with none left set this round soaks nothing', () => {
    expect(hit(fighter({ arm: { names: ['Ward-Saints'], roundWard: 3 } }), 4)).toBe(4);
    expect(hit(fighter({ arm: { names: ['Ward-Saints'], roundWard: 3 }, _roundWardLeft: 2 }), 4)).toBe(2);
  });
  test('Mithril turns aside 2 when its ward is missing or 0, and its own when set', () => {
    const mithril = (mithrilDR: unknown) => hit(fighter({ mithril: true, mithrilDR }), 6);
    expect([mithril(undefined), mithril(0), mithril(3), mithril(1)]).toEqual([4, 4, 3, 5]);
  });
  test('a nature of no factor, or of 0, for the channel leaves the damage whole', () => {
    expect(hit(fighter({ vuln: { melee: 0, archery: 1, spell: 1 } }), 4)).toBe(4);
    expect(hit(fighter({ vuln: {} }), 4)).toBe(4);
    expect(hit(fighter({ vuln: { melee: 1, archery: 1, spell: 2 } }), 4, 'Savage Bite')).toBe(8);
  });
  test('a weakness of race: no striker, a striker of no hero or no race; an Elf doubles it', () => {
    const weak = { kind: 'race', key: 'Elven', name: 'Old Enemy: Elven', desc: 'Elves deal it double' };
    const target = (striker: unknown) => fighter({ weak, _foe: striker });
    expect(hit(target(undefined), 4)).toBe(4);
    expect(hit(target(fighter({ ref: undefined })), 4)).toBe(4);
    expect(hit(target(fighter({ ref: {} })), 4)).toBe(4);
    expect(hit(target(fighter({ ref: { race: 'Elven' } })), 4)).toBe(8);
  });
  test('a weakness of alignment: a striker of no realm, or of a realm not in the game, is not the first realm', () => {
    const key = tc.G.players[0]?.alignment ?? '';
    const weak = { kind: 'align', key, name: 'Bane of an alignment', desc: 'its realms deal it double' };
    expect(hit(fighter({ weak, _foe: fighter({ player: null }) }), 4)).toBe(4);
    expect(hit(fighter({ weak, _foe: fighter({ player: 99 }) }), 4)).toBe(4);
  });
  test('a parry by a hero of no raw Melee cuts 1', () => {
    expect(hit(fighter({ perkParry: true }), 6, 'blow', [0, 0.99])).toBe(5);
  });
  test('a ward against beasts, against a foe of no kind or of an empty one: none', () => {
    const wards = { names: ['Barkskin'], natureDR: 2 };
    expect(hit(fighter({ arm: wards }), 4)).toBe(4);
    expect(hit(fighter({ arm: wards, _foeCat: '' }), 4)).toBe(4);
    expect(hit(fighter({ arm: wards, _foeCat: 'beast' }), 4)).toBe(2);
  });
  test('the open guard: none used yet, its percentage missing or 0 (50%) or its own', () => {
    const guard = (openGuardPct: unknown) =>
      fighter({ arm: { names: ['Open Guard'], openGuardHits: 1, openGuardPct } });
    const f = guard(undefined);
    expect([hit(f, 8), f._openGuardUsed, hit(f, 8)]).toEqual([4, 1, 8]);
    expect([hit(guard(0), 8), hit(guard(25), 8)]).toEqual([4, 6]);
  });
  // (plan P1-19r) a plain fighter of 20 HP; a spell ('Fireball') meets no temper, nature or perk of his
  test('a buckler worn: a melee blow deals 1 less, not an arrow; a blow and an arrow have 5% less chance to hit', () => {
    const arm = pcArmourMerge(null, { ward: 'buckler' }, 'Bronze Buckler');
    expect([hit(fighter({ arm }), 4), hit(fighter({ arm }), 4, 'arrow')]).toEqual([3, 4]);
    expect(pcHitChance(tc, fighter(), fighter({ arm }))).toBe(45);
    expect(pcArrowHitChance(tc, fighter({ archery: 2 }), fighter({ arm }))).toBe(45);
  });
  test('an arrow block of 100 takes every arrow, not a blow; a spell block every spell, not a blow', () => {
    const arrows = fighter({ arm: { names: ['Kite Shield of the Marches'], arrowBlock: 100 } });
    expect([hit(arrows, 4, 'arrow'), hit(arrows, 4)]).toEqual([0, 4]);
    const spells = fighter({ arm: { names: ['Mirror-Bright Shield'], spellBlock: 100 } });
    expect([hit(spells, 4, 'Fireball'), hit(spells, 4)]).toEqual([0, 4]);
  });
  test('the cuts: melee off a blow, arrow off an arrow, dark against the undead, a spell ward off a spell', () => {
    const arm = { names: ['Grave-Iron Plate'], meleeDR: 2, arrowDR: 1, spellPct: 50 };
    expect([hit(fighter({ arm }), 6), hit(fighter({ arm }), 6, 'arrow'), hit(fighter({ arm }), 8, 'Fireball')]).toEqual(
      [4, 5, 4],
    );
    const dark = { names: ['Grave-Iron Plate'], darkDR: 1 };
    expect([
      hit(fighter({ arm: dark, _foeCat: 'undead' }), 6, 'Fireball'),
      hit(fighter({ arm: dark }), 6, 'Fireball'),
    ]).toEqual([5, 6]);
  });
  test('a low-HP ward: below half his maximum HP, a hit deals its share less; at half, none', () => {
    const arm = { names: ["Warden's Scale"], lowHp: 25 };
    expect([hit(fighter({ hp: 9, arm }), 8, 'Fireball'), hit(fighter({ hp: 10, arm }), 8, 'Fireball')]).toEqual([6, 8]);
  });
  test('a cap ward: no hit deals more than its share of his maximum HP; a hit under it is whole', () => {
    const arm = { names: ['Bulwark Breastplate'], cap: 25 };
    expect([hit(fighter({ arm }), 8, 'Fireball'), hit(fighter({ arm }), 4, 'Fireball')]).toEqual([5, 4]);
  });
  test('a second wind: the first hit to leave him below 30% of his maximum gives back its share, once a fight', () => {
    const arm = { names: ['Last-Stand Plate'], secondWind: 25 };
    const f = fighter({ hp: 8, arm });
    expect([hit(f, 3, 'Fireball'), f.hp, f._armSecondWindUsed]).toEqual([3, 10, true]);
    hit(f, 5, 'Fireball');
    expect(f.hp).toBe(5);
    // left at 30% exactly: not below it
    const g = fighter({ hp: 9, arm });
    hit(g, 3, 'Fireball');
    expect([g.hp, g._armSecondWindUsed]).toEqual([6, undefined]);
  });
  test('thorns: whoever lands a melee blow on the wearer takes them back', () => {
    const strike = (foe: AFighterInAPersonalCombat) => {
      const actor = fighter();
      const narrative: NarrativeLine[] = [];
      pc.pinned(0, () => {
        pcMeleeStrike(tc, actor, foe, narrative);
      });
      return [actor.hp, kinds(narrative).at(-1)];
    };
    expect(strike(fighter({ arm: { names: ['Thornwood Cuirass'], thorns: 2 } }))).toEqual([
      18,
      "the foe's thorns bite a fighter",
    ]);
    expect(strike(fighter())).toEqual([20, 'a fighter strikes the foe']);
  });
  test('a hero’s fatal blow with no narrative leaves no mark; with one, the mark', () => {
    const f = fighter({ kind: 'character', hp: 3 });
    pc.pinned(0, () => pcTakeHit(tc, f, 5, none, 'a foe', 'blow'));
    expect([f.hp, f._fatalMark]).toEqual([-2, undefined]);
    const g = fighter({ kind: 'character', hp: 3 });
    const narrative: NarrativeLine[] = [];
    pc.pinned(0, () => pcTakeHit(tc, g, 5, narrative, 'a foe', 'blow'));
    expect(g._fatalMark).toEqual({ arr: narrative, idx: 0, blow: 'a foe', kind: 'blow' });
  });
});

describe('the start of a round', () => {
  const round = (f: AFighterInAPersonalCombat, r: number | number[] = 0) => {
    const narrative: NarrativeLine[] = [];
    pc.pinned(r, () => {
      pcRoundStart(f, narrative);
    });
    return narrative;
  };
  test('the first round: no round yet counts 1', () => {
    const f = fighter();
    round(f);
    expect(f._roundNo).toBe(1);
  });
  test('no list of lingering harms: none, and an empty list after; immune, nothing to slough', () => {
    const f = fighter({ status: status({ dot: undefined }) });
    expect([round(f), f.status.dot]).toEqual([[], []]);
    const g = fighter({ arm: { names: ['Ashen Plate'], dotImmune: true }, status: status({ dot: undefined }) });
    expect([round(g), g.status.dot]).toEqual([[], []]);
  });
  test('a Spiritwrack shrugged off at 50%: thrown off on a roll of 11; let go when no longer bound', () => {
    const f = fighter({ status: status({ _swShrugPct: 50, silenceRounds: 2, meleeHalvedRounds: 2 }) });
    expect(kinds(round(f, 0.1))).toEqual(['a fighter tears free of the spiritwrack']);
    expect([f.status.silenceRounds, f.status.meleeHalvedRounds, f.status._swShrugPct]).toEqual([0, 0, 0]);
    const g = fighter({ status: status({ _swShrugPct: 50, silenceRounds: 1 }) });
    expect([kinds(round(g, 0.1)), g.status._swShrugPct]).toEqual([[], 0]);
  });
  test('a resist: a to-hit penalty fades twice, and a daze is shrugged off on a roll under half', () => {
    const f = fighter({
      arm: { names: ['Steadfast Harness'], resist: true },
      status: status({ hitPenalty: 30, stun: 1 }),
    });
    const once = 30 - pcPenaltyFade(30);
    expect(kinds(round(f, 0))).toEqual(['a fighter shrugs off the daze, held steady by their armour']);
    expect([f.status.hitPenalty, f.status.stun]).toEqual([once - pcPenaltyFade(once), 0]);
    // a draw of half is not under half: the daze holds (plan P1-19r)
    const g = fighter({ arm: { names: ['Steadfast Harness'], resist: true }, status: status({ stun: 1 }) });
    expect([kinds(round(g, 0.5)), g.status.stun]).toEqual([[], 1]);
  });
  // (plan P1-19r) a hero: his regeneration doesn't fade with the fight
  test('as a round starts: a fresh round ward, every lingering harm sloughed off, and a hero regenerates', () => {
    const f = fighter({
      kind: 'character',
      hp: 10,
      arm: { names: ['Ashen Plate'], regen: 2, roundWard: 3, dotImmune: true },
      status: status({ dot: [{ dmg: 2, rounds: 2, label: 'a burn' }] }),
    });
    expect(kinds(round(f))).toEqual([
      "a fighter's armour sloughs off every burn poison and bleeding",
      "a guardian's regeneration knits its flesh",
    ]);
    expect([f.hp, f._roundWardLeft, f.status.dot]).toEqual([12, 3, []]);
  });
});

describe('experience, the riposte, the strikes and the advance', () => {
  test('experience: no fighter, a hero of none, a pending rise of no list or with a gap: no gain', () => {
    const xp = (cbt: unknown) => {
      pcCombatXP(tc, cbt as Parameters<typeof pcCombatXP>[1], 'melee', []);
      return cbt;
    };
    expect(xp(null)).toBe(null);
    expect(xp({ kind: 'character' })).toEqual({ kind: 'character' });
    // a hero who isn't in the world, and not alive: trySkillGain rolls nothing for him
    for (const pending of [{}, { list: [null] }, { list: [null, { skill: 'melee' }] }])
      expect(xp({ kind: 'character', ref: { _sgPending: pending } })).toEqual({
        kind: 'character',
        ref: { _sgPending: pending },
      });
  });
  test('a riposte by a fighter of no status: the chance missed, nothing told', () => {
    const narrative: NarrativeLine[] = [];
    pc.pinned(0.9, () => {
      pcTryCounter(tc, noStatus({ kind: 'character', perkCounter: true }), fighter(), narrative, 'melee');
    });
    expect(narrative).toEqual([]);
  });
  test('a strike, a free strike and a volley by a fighter of no status throw on his to-hit, as they did', () => {
    expect(() => {
      pc.pinned(0, () => {
        pcMeleeStrike(tc, noStatus(), fighter(), []);
      });
    }).toThrow(/hitPenalty/);
    expect(() => {
      pc.pinned(0, () => {
        pcFreeStrike(tc, noStatus(), fighter(), []);
      });
    }).toThrow(/hitPenalty/);
    expect(() => {
      pc.pinned(0, () => {
        pcFireShot(tc, noStatus({ archery: 1 }), fighter(), []);
      });
    }).toThrow(/hitPenalty/);
  });
  const advance = (actor: AFighterInAPersonalCombat, foe: AFighterInAPersonalCombat, range: string, r = 0.99) => {
    const narrative: NarrativeLine[] = [];
    const state = { range };
    pc.pinned(r, () => {
      pcAdvanceOrStrike(tc, actor, foe, narrative, state);
    });
    return [state.range, kinds(narrative)];
  };
  const hero = (over: Staged = {}) => fighter({ kind: 'character', ...over });
  const closes = 'a fighter advances and the combatants close';
  test('an advance with no foe: into melee or to the bow, it stops there', () => {
    expect(advance(hero(), noFoe, 'bow')).toEqual(['melee', [closes]]);
    expect(advance(hero(), noFoe, 'spell')).toEqual(['bow', [closes]]);
  });
  test('the parting shot of a foe of no status throws on his to-hit; a bound foe looses none', () => {
    expect(() => advance(hero(), hero({ archery: 2, status: undefined }), 'bow')).toThrow(/hitPenalty/);
    expect(advance(hero(), hero({ archery: 2, status: status({ silenceRounds: 1 }) }), 'bow')).toEqual([
      'melee',
      [closes, 'a fighter attacks with a roll to hit', "a fighter's blow is turned aside"],
    ]);
  });
  test('after the step: a fighter of no status, a stunned one and a bound archer strike nothing', () => {
    expect(advance(hero({ status: undefined }), fighter(), 'spell')).toEqual(['bow', [closes]]);
    expect(advance(hero({ status: status({ stun: 1 }) }), fighter(), 'bow')).toEqual(['melee', [closes]]);
    expect(advance(hero({ archery: 2, status: status({ silenceRounds: 1 }) }), fighter(), 'spell')).toEqual([
      'bow',
      [closes],
    ]);
  });
});
