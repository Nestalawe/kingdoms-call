// 2026-10-15 (Toby, D4) — Psychic Blast's stun in personal combat is 1 round + 1 per two Psychic levels, doubled
// against a guardian weak to Psychic magic, and the Dreamstone's extra round is added AFTER the doubling (before,
// it was doubled too: 8 rounds at Psychic 5 against a weak guardian, where the books implied 7).
// Level 1 (unit): pcCastCombatSpell called directly in the bare vm (tests/lib/personal-combat.ts; plan P1-08e: it was a
// script that took it from the "  // 4. Run all 5 phases" hook after a turn on the GM portal); the cast is pinned to
// succeed. The rulebook and the player portal are read as built.
import { expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';
import { clone, personalCombatEngine, type Combatant } from '../lib/personal-combat.ts';
import { pageText } from '../lib/source.ts';

const { call, value, base, MON, pinned } = personalCombatEngine();
const ITEMS = value('ALL_MAGIC_ITEMS_P') as { name: string }[];
const stone = ITEMS.find((i) => i.name === 'Dreamstone');
const st = () => ({ fledBy: null, parley: false, stoleBy: null, range: 'melee', mirror: null, feature: null });
const hero = (withStone: boolean) => {
  const h = call('pcCharCombatant', {
    ...clone(base),
    items: withStone ? [{ ...stone, equipped: true }] : [],
    skills: { ...base.skills, psychic: withStone ? 4 : 5 },
    encounterPlan: { tactics: ['ME'], duelStance: 'accept' },
  }) as Combatant;
  h.hp = h.maxHp = 40;
  return h;
};
const guard = (weak: boolean) => {
  const m = MON.find((x) => x.name === 'Owlbear');
  if (!m) throw new Error('no Owlbear in the guardian table');
  const g = call('pcMonsterCombatant', { ...clone(m), _hpFull: m.hp }) as Combatant;
  g.arm = null;
  g.weak = weak ? { kind: 'school', key: 'psychic' } : null;
  g.hp = g.maxHp = 500;
  return g;
};
const stun = (withStone: boolean, weak: boolean) => {
  const h = hero(withStone);
  const g = guard(weak);
  pinned(0.01, () => call('pcCastCombatSpell', h, g, 'Psychic Blast', [], st()));
  return g.status.stun;
};

test('the Dreamstone was read', () => {
  expect(stone).toBeTruthy();
});

// Psychic 5 (or 4 + the Dreamstone's +1 = 5): 1 + floor(5/2) = 3 rounds
test('Psychic 5, no stone: 3 rounds', () => {
  expect(stun(false, false)).toBe(3);
});
test('Psychic 5 against a weak guardian: doubled to 6', () => {
  expect(stun(false, true)).toBe(6);
});
test('Psychic 5 with the Dreamstone: 3 + 1 = 4', () => {
  expect(stun(true, false)).toBe(4);
});
test('with the Dreamstone against a weak guardian: 3 doubled, then + 1 = 7', () => {
  expect(stun(true, true)).toBe(7);
});

const strip = (t: string) => {
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u;
    t = u;
  }
};

test("the rulebook says the Dreamstone's round comes after the doubling", () => {
  expect(strip(readPage('kingdoms-call-rules.html')).replace(/\s+/g, ' ')).toMatch(
    /The Dreamstone adds one further round, after any doubling/,
  );
});

test("the player portal's Psychic Blast text says so", () => {
  // its words, from src/ (tests/lib/source.ts, plan P1-09a: until then the built page's text)
  expect(pageText('kingdoms-call-player-portal.html')).toMatch(/Dreamstone \+1, after any doubling/);
});
