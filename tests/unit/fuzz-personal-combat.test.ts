// The personal-combat fuzz of the 2026-09-27 changes (advance-and-strike combat): thousands of fights, heroes of every
// race, temper and level against every guardian of the table (each built as a lair fight builds it, pcBuildGuardian)
// and against each other, with every kind of Encounter Plan. No fight may throw, and no line of a fight's narrative may
// show NaN or undefined. The dice are the engine's, seeded from KC_SEED.
// Level 1 (unit): pcCharCombatant, pcBuildGuardian and resolvePersonalCombat called directly in the bare vm
// (tests/lib/personal-combat.ts). Plan P1-08f: these were the personal-combat halves of fuzz-wages-combat and
// fuzz-advance-masking, which took the functions from the "  // 4. Run all 5 phases" hook after whole turns on the GM
// portal (pcBuildGuardian was nested inside resolveTurn); their whole-turn halves stay in those scripts.
import { expect, test } from 'vitest';
import {
  clone,
  personalCombatEngine,
  type Character,
  type Combatant,
  type FightResult,
} from '../lib/personal-combat.ts';

/** Fights in each test (the scripts' own sizes: 4,000, and 20,000 in npm run test:full). */
const FIGHTS = process.env['KC_FULL'] === '1' ? 20_000 : 4_000;
const { call, MON } = personalCombatEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });

const RACES = ['Human', 'Elven', 'Dwarven', 'Orcish'];
const TEMPERS = ['Berserk', 'Brave', 'Cautious', 'Cowardly'];

/** What went wrong in a fight: the lines with NaN or undefined, or what it threw. */
function faults(fight: () => FightResult): string[] {
  try {
    const res = fight();
    const text = res.narrative.map((x) => (typeof x === 'string' ? x : x.text || '')).join('\n');
    return text.split('\n').filter((l) => /NaN|undefined/.test(l));
  } catch (e) {
    return [`threw: ${e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 3).join(' | ') : String(e)}`];
  }
}

/** A fight with the i-th guardian of the table (in turn), as a lair fight is fought. */
function guardianFight(i: number, hc: Character & { encounterPlan: { tactics: string[] } }): FightResult {
  const g = MON[i % MON.length];
  if (!g) throw new Error('the guardian table is empty');
  const m0 = clone(g);
  m0['_hpFull'] = m0.hp;
  const feature = { name: 'Ruin', monster: m0, hoardItems: [] };
  const hero = call('pcCharCombatant', hc) as Combatant;
  hero.tactics = hc.encounterPlan.tactics.slice();
  hero['_vsGuardian'] = true;
  const mon = call('pcBuildGuardian', feature, clone(m0), []) as Combatant;
  return call('resolvePersonalCombat', hero, mon, { maxRounds: 20, feature }) as FightResult;
}

test('a hero of any race, temper and level fights every guardian without a fault (fuzz-wages-combat)', () => {
  const bad: string[] = [];
  for (let i = 0; i < FIGHTS; i++) {
    const lv = 1 + (i % 9);
    const hc = {
      id: `fz${String(i)}`,
      name: 'Fz',
      player: null,
      alive: true,
      hp: 20 + lv * 6,
      maxHp: 20 + lv * 6,
      race: RACES[i % 4],
      temper: TEMPERS[i % 4],
      skills: { white: Math.min(9, lv), melee: (i * 7) % 10, archery: (i * 3) % 10 },
      items: [],
      armies: [],
      encounterPlan: { tactics: ['MA', 'AR', 'MA', 'MA', 'MA'], duelStance: 'accept' },
    };
    bad.push(...faults(() => guardianFight(i, hc)).map((l) => `fight ${String(i)}: ${l}`));
  }
  expect(bad.slice(0, 5)).toEqual([]);
}, 120_000);

test('heroes fight guardians and each other, with every kind of plan, without a fault (fuzz-advance-masking)', () => {
  const TACTIC_SETS = [
    ['ME'],
    ['FI', 'ME'],
    ['CA', 'ME'],
    ['ME', 'FI'],
    ['FI'],
    ['MA', 'AR', 'MA'],
    ['ST', 'ME'],
    ['FL', 'ME'],
  ];
  const mkHero = (i: number, lv: number, id: string) => ({
    id,
    name: `H${id}`,
    player: null,
    alive: true,
    hp: 20 + lv * 6,
    maxHp: 20 + lv * 6,
    race: RACES[i % 4],
    temper: TEMPERS[i % 4],
    skills: {
      white: i % 3 === 0 ? Math.min(9, lv) : 0,
      elemental: i % 5 === 0 ? Math.min(9, lv) : 0,
      melee: (i * 7) % 10,
      archery: (i * 3) % 10,
      thief: i % 6 === 0 ? 3 : 0,
    },
    items: [],
    armies: [],
    encounterPlan: { tactics: (TACTIC_SETS[i % TACTIC_SETS.length] ?? []).slice(), duelStance: 'accept' },
  });
  const bad: string[] = [];
  let pvp = 0;
  for (let i = 0; i < FIGHTS; i++) {
    const lv = 1 + (i % 9);
    const fight =
      i % 3 === 2
        ? () => {
            // character against character
            const a = mkHero(i, lv, `a${String(i)}`);
            const b = mkHero(i + 3, 1 + ((i + 4) % 9), `b${String(i)}`);
            const A = call('pcCharCombatant', a) as Combatant;
            const B = call('pcCharCombatant', b) as Combatant;
            A.tactics = a.encounterPlan.tactics.slice();
            B.tactics = b.encounterPlan.tactics.slice();
            pvp++;
            return call('resolvePersonalCombat', A, B, { maxRounds: 20 }) as FightResult;
          }
        : () => guardianFight(i, mkHero(i, lv, `fz${String(i)}`));
    bad.push(...faults(fight).map((l) => `fight ${String(i)}: ${l}`));
  }
  expect(pvp).toBe(Math.floor(FIGHTS / 3));
  expect(bad.slice(0, 5)).toEqual([]);
}, 120_000);
