// 2026-10-14 (batch item 3) — "cannot be stunned" stops a stun the moment it lands, not at the start
// of the next round. Before, a Psychic Blast or a holding scroll from a fighter with the initiative
// still cost an "unstunnable" guardian (or a hero in a Helm of Iron Will) that round's action, and a
// stun riding on a blow (Thunder Stone, a dazing special) took hold after the round-start check and
// cost one more. Every stun source is checked: Psychic Blast, Control Undead, a stunning special,
// a stun item and a stun riding on an item's blow.
// Level 1 (unit): the functions called directly on the engine's modules (tests/lib/personal-combat.ts; plan P1-08e: it was a
// script that took them from the "  // 4. Run all 5 phases" hook after a turn on the GM portal), the dice pinned.
import { expect, test } from 'vitest';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { clone, personalCombatEngine, type Combatant } from '../lib/personal-combat.ts';

const { call, base, MON, pinned, wordsOf } = await personalCombatEngine();
const { ALL_MAGIC_ITEMS_P } = await import('../../src/content/kingdoms-call-data.ts');
const ITEMS = ALL_MAGIC_ITEMS_P as { name: string }[];
const item = (n: string) => ITEMS.find((i) => i.name === n);
const st = () => ({ fledBy: null, parley: false, stoleBy: null, range: 'melee', mirror: null, feature: null });
const hero = (sk?: Record<string, number>) => {
  const h = call('pcCharCombatant', {
    ...clone(base),
    items: [],
    skills: { ...base.skills, melee: 3, psychic: 5, necromancy: 5, ...sk },
    encounterPlan: { tactics: ['ME'], duelStance: 'accept' },
  }) as Combatant;
  h.hp = h.maxHp = 40;
  return h;
};
const ward = (c: Combatant) => {
  c.arm = call('pcArmourMerge', c.arm, { ward: 'stunImmune' }, 'Helm of Iron Will') as Combatant['arm'];
  return c;
};
const mk = (name: string) => {
  const m = MON.find((x) => x.name === name);
  if (!m) throw new Error(`no guardian named ${name}`);
  const g = call('pcMonsterCombatant', { ...clone(m), _hpFull: m.hp }) as Combatant;
  g.tactics = ['ME'];
  g.tacIdx = 0;
  return g;
};
const plain = () => {
  const g = mk('Owlbear');
  g.arm = null;
  return g;
};
const immune = () => ward(plain());
const round = (c: Combatant) => call('pcRoundStart', c, []);

test('the stun items were read', () => {
  expect(item('Scroll of Paralysis')).toBeTruthy();
  expect(item('Thunder Stone')).toBeTruthy();
});

test('Psychic Blast, cast with the initiative: the immune guardian still acts this round', () => {
  const h = hero();
  const g = immune();
  const n: NarrativeLine[] = [];
  pinned(0.01, () => call('pcCastCombatSpell', h, g, 'Psychic Blast', n, st()));
  expect(g.status.stun, 'Psychic Blast does not hold a stun-immune guardian').toBe(0);
  const n2: NarrativeLine[] = [];
  pinned(0.5, () => call('pcAct', g, h, n2, st()));
  expect(wordsOf(n2).join('\n'), '…which acts the same round').not.toMatch(/stunned and cannot act/);
  expect(wordsOf(n).join('\n'), '…and the report says the blast found no hold').toMatch(/cannot be held/);
});

test('Psychic Blast still holds a guardian without the ward', () => {
  const g = plain();
  pinned(0.01, () => call('pcCastCombatSpell', hero(), g, 'Psychic Blast', [], st()));
  expect(g.status.stun).toBeGreaterThan(0);
});

test('Control Undead does not hold a stun-immune undead', () => {
  const g = ward(mk('Zombie Shambler'));
  pinned(0.01, () => call('pcCastCombatSpell', hero(), g, 'Control Undead', [], st()));
  expect(g.status.stun).toBe(0);
});

test('a Scroll of Paralysis does not hold a stun-immune guardian', () => {
  const g = immune();
  call('pcUseCombatItem', hero(), g, item('Scroll of Paralysis'), [], st());
  expect(g.status.stun).toBe(0);
});

test("a Thunder Stone's daze does not take hold next round either", () => {
  const g = immune();
  pinned(0.5, () => call('pcUseCombatItem', hero(), g, item('Thunder Stone'), [], st()));
  round(g);
  expect(g.status.stun).toBe(0);
});

test('a Thunder Stone still dazes a guardian without the ward, from the next round', () => {
  const g = plain();
  pinned(0.5, () => call('pcUseCombatItem', hero(), g, item('Thunder Stone'), [], st()));
  round(g);
  expect(g.status.stun).toBe(1);
});

test('a dazing special does not hold a hero who cannot be stunned', () => {
  const h = ward(hero());
  const sp = { name: 'Test Slam', dmgW: 1, effect: 'hero loses next attack', castChance: 100 };
  pinned(0.5, () => call('pcMonsterSpecial', plain(), h, sp, [], st()));
  round(h);
  expect(h.status.stun).toBe(0);
});

test('a pure stun special does not hold a hero who cannot be stunned', () => {
  const h = ward(hero());
  const sp = { name: 'Test Stare', dmgW: 0, effect: 'hero loses 2 rounds', castChance: 100 };
  pinned(0.5, () => call('pcMonsterSpecial', plain(), h, sp, [], st()));
  expect(h.status.stun).toBe(0);
});
