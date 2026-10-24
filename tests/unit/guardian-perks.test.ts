// 2026-10-14 (batch item 7) — every guardian has one perk per grade (Weak 1, Moderate 2, Powerful 3,
// Legendary 4), each perk stronger the higher the grade (the decided table below), and a good share of
// them are wards against magic: a ward against one school makes that school's spells less likely to
// take hold. Checked on the table (MONSTERS_P and the migration are module level) and in the engine
// (pcMonsterCombatant, pcCastCombatSpell, pcRoundStart and resolvePersonalCombat).
// Level 1 (unit): every function called directly on the engine's modules (tests/lib/personal-combat.ts; plan P1-08e: it was a
// script that took them from the "  // 4. Run all 5 phases" hook after a turn on the GM portal), the dice pinned.
import { expect, test } from 'vitest';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import {
  clone,
  personalCombatEngine,
  type Combatant,
  type FightResult,
  type Guardian,
} from '../lib/personal-combat.ts';

const { call, base, MON, pinned, wordsOf, wordsForEveryoneInTheFight } = await personalCombatEngine();
type Fx = Record<string, unknown> & { ward?: string; pct?: number; amt?: number; school?: string };
// The decided table: a perk's value at Weak / Moderate / Powerful / Legendary (cap: a lower ceiling is stronger).
const DECIDED: Record<string, number[]> = {
  dodge: [5, 10, 15, 20],
  meleeDR: [1, 2, 3, 4],
  arrowDR: [1, 2, 3, 4],
  spellPct: [15, 25, 35, 45],
  schoolWard: [20, 30, 40, 50],
  stunWard: [40, 60, 80, 100],
  dotWard: [40, 60, 80, 100],
  thorns: [1, 2, 3, 4],
  regen: [1, 2, 3, 4],
  secondWind: [15, 20, 25, 30],
  lowHp: [15, 20, 25, 30],
  cap: [40, 35, 25, 15],
  aura: [5, 8, 12, 15],
  burn: [1, 2, 3, 4],
  drain: [0.15, 0.25, 0.35, 0.5],
  hitBonus: [5, 10, 15, 20],
  dmgBonus: [1, 2, 3, 4],
};
const TIERS = ['Weak', 'Moderate', 'Powerful', 'Legendary'];
const kindOf = (fx: Fx) => fx.ward ?? Object.keys(fx)[0] ?? '';
const valOf = (fx: Fx) => (fx.ward ? (fx.pct ?? fx.amt) : fx[Object.keys(fx)[0] ?? '']);
const perks = (m: Guardian) => (m.passives ?? []) as { name: string; desc: string; fx: Fx }[];

// ── the table ──
test('the guardian table was read', () => {
  expect(MON.length).toBeGreaterThan(100);
});

test('one perk per grade: Weak 1, Moderate 2, Powerful 3, Legendary 4', () => {
  const wrongCount = MON.filter(
    (m) => !Array.isArray(m.passives) || m.passives.length !== TIERS.indexOf(m.power) + 1,
  ).map((m) => `${m.name} (${m.power}, ${String(perks(m).length)})`);
  expect(wrongCount).toEqual([]);
});

test('no guardian keeps the old single `passive`', () => {
  expect(MON.filter((m) => m['passive']).map((m) => m.name)).toEqual([]);
});

test("every perk carries its grade's value from the decided table", () => {
  const offTable: string[] = [];
  MON.forEach((m) => {
    perks(m).forEach((p) => {
      const k = kindOf(p.fx);
      const t = DECIDED[k];
      if (!t) offTable.push(`${m.name}: ${p.name} (${k}?)`);
      else if (valOf(p.fx) !== t[TIERS.indexOf(m.power)])
        offTable.push(`${m.name}: ${p.name} ${k} ${String(valOf(p.fx))}`);
    });
  });
  expect(offTable).toEqual([]);
});

test('the decided table never weakens a perk at a higher grade', () => {
  const rising = Object.entries(DECIDED).every(([k, t]) =>
    t.every((v, i) => i === 0 || (k === 'cap' ? v < (t[i - 1] ?? 0) : v >= (t[i - 1] ?? 0))),
  );
  expect(rising).toBe(true);
});

test('every perk is named (no two alike on one guardian) and described', () => {
  expect(
    MON.every(
      (m) => new Set(perks(m).map((p) => p.name)).size === perks(m).length && perks(m).every((p) => p.name && p.desc),
    ),
  ).toBe(true);
});

test('no perk reads "+0 damage", undefined or NaN', () => {
  expect(MON.some((m) => perks(m).some((p) => /\+0 damage|undefined|NaN/.test(p.desc)))).toBe(false);
});

test('a good share of perks are wards against magic', () => {
  const all = MON.flatMap(perks);
  const magic = all.filter((p) => ['schoolWard', 'spellPct'].includes(kindOf(p.fx)));
  expect(magic.length / all.length, `${String(magic.length)} of ${String(all.length)}`).toBeGreaterThanOrEqual(0.25);
});

test('no guardian wards the school it is weak to', () => {
  const clash = MON.filter((m) =>
    perks(m).some(
      (p) => p.fx.ward === 'schoolWard' && m.weak && m.weak.kind === 'school' && m.weak.key === p.fx.school,
    ),
  ).map((m) => m.name);
  expect(clash).toEqual([]);
});

// ── the engine ──
const g = (name: string) => {
  const m = MON.find((x) => x.name === name);
  if (!m) throw new Error(`no guardian named ${name}`);
  return call('pcMonsterCombatant', { ...clone(m), _hpFull: m.hp }) as Combatant;
};
const st = () => ({ fledBy: null, parley: false, stoleBy: null, range: 'melee', mirror: null, feature: null });
const mage = (sk: Record<string, number>) => {
  const h = call('pcCharCombatant', {
    ...clone(base),
    items: [],
    skills: { ...base.skills, ...sk },
    encounterPlan: { tactics: ['ME'], duelStance: 'accept' },
  }) as Combatant;
  h.hp = h.maxHp = 40;
  return h;
};

test('every perk of every guardian is felt in a fight', () => {
  const missing: string[] = [];
  MON.forEach((m) => {
    const c = call('pcMonsterCombatant', { ...clone(m), _hpFull: m.hp }) as Combatant;
    const arm = c.arm;
    perks(m).forEach((p) => {
      const k = kindOf(p.fx);
      const has = p.fx.ward
        ? k === 'schoolWard'
          ? Number((arm?.['schoolWard'] as Record<string, number> | undefined)?.[p.fx.school ?? '']) >= (p.fx.pct ?? 0)
          : arm?.[k] != null
        : k === 'hitBonus'
          ? (c.status.hitBonus ?? 0) > 0
          : Number(c[k]) > 0;
      if (!has) missing.push(`${m.name}: ${p.name}`);
    });
  });
  expect(missing).toEqual([]);
});

test("a Psychic 5 hero's blast at the Reef Siren (Siren's Mind, a 30 ward) is cast at 80 − 30 = 50%", () => {
  const t = g('Reef Siren');
  const n: NarrativeLine[] = [];
  pinned(0.99, () => call('pcCastCombatSpell', mage({ psychic: 5 }), t, 'Psychic Blast', n, st()));
  expect(wordsOf(n).join('\n')).toMatch(/\(50% to cast/);
});

test("a Legendary guardian's stun ward (100) turns a Psychic Blast as it lands", () => {
  const t = g('Elder Dragon');
  pinned(0.01, () => call('pcCastCombatSpell', mage({ psychic: 5 }), t, 'Psychic Blast', [], st()));
  expect(t.status.stun).toBe(0);
});

test("a Weak guardian's stun ward (40) fails when its roll does (51 > 40)", () => {
  const t = g('Zombie Shambler');
  pinned([0.01, 0.5], () => call('pcCastCombatSpell', mage({ white: 5, psychic: 5 }), t, 'Psychic Blast', [], st()));
  expect(t.status.stun).toBeGreaterThan(0);
});

test("a Moderate guardian's lingering-harm ward (60) cuts a 10 burn to 4", () => {
  const t = g('Mummified Champion');
  t.status.dot = [{ dmg: 10, rounds: 3, label: 'Fireball burns' }];
  const hp = t.hp;
  call('pcRoundStart', t, []);
  expect(hp - t.hp).toBe(4);
});

test("the Elder Titan keeps its own 15% cap, not loosened to the grade's 20%", () => {
  expect(g('Elder Titan').arm?.cap).toBe(15);
});

test('the fight opens by naming every perk of the guardian', () => {
  const m = MON.find((x) => x.name === 'Sphinx');
  if (!m) throw new Error('no Sphinx in the guardian table');
  const t = g('Sphinx');
  t.hp = 0;
  const res = call('resolvePersonalCombat', mage({ melee: 3 }), t, { maxRounds: 1 }) as FightResult;
  // the lines for everyone in the fight (not a private line, for one realm alone), in words
  const txt = wordsForEveryoneInTheFight(res.narrative).join('\n');
  expect(perks(m).every((p) => txt.includes(p.name))).toBe(true);
});

// ── running games ──
test("a running game's guardian takes its new perks at its next turn (GUARDIAN_TABLE_VER)", () => {
  const gs = {
    _guardiansVer: 19,
    world: {
      provinces: [
        {
          features: [
            {
              monster: {
                name: 'Dire Rat',
                hp: 13,
                passive: { name: 'Filth-Hardened', fx: { ward: 'dotImmune' }, desc: 'x' },
              } as Record<string, unknown>,
            },
          ],
        },
      ],
    },
  };
  call('migrateLairGuardiansV2', gs);
  const mm = gs.world.provinces[0]?.features[0]?.monster;
  expect(Array.isArray(mm?.['passives']) && (mm['passives'] as unknown[]).length === 1 && !mm['passive']).toBe(true);
});
