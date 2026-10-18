// 2026-10-14 (batch item 1) — in a personal fight neither side loses its round to a power that fails.
// A guardian whose special slips away, or a hero whose spell fizzles (or who has already spent that
// spell, or reached the school's limit), makes an ordinary attack instead; so does anyone bound by
// Spiritwrack who reaches for a special, a spell or a bow (at half strength, as Spiritwrack says).
// Stuns still cost the round.
// Level 1 (unit): pcAct called directly in the bare vm (tests/lib/personal-combat.ts; plan P1-08e: it was a script that
// took it from the "  // 4. Run all 5 phases" hook after a turn on the GM portal), the dice pinned.
import { expect, test } from 'vitest';
import { clone, personalCombatEngine, type Combatant } from '../lib/personal-combat.ts';

const { call, base, MON, pinned } = personalCombatEngine();
const st = () => ({ fledBy: null, parley: false, stoleBy: null, range: 'melee', mirror: null, feature: null });
const hero = (tactics: string[], skills?: Record<string, number>) => {
  const h = call('pcCharCombatant', {
    ...clone(base),
    items: [],
    skills: { ...base.skills, melee: 3, archery: 3, psychic: 3, ...skills },
    encounterPlan: { tactics, duelStance: 'accept' },
  }) as Combatant;
  h.hp = h.maxHp = 40;
  return h;
};
const caster = MON.find((m) => (m.spells ?? []).length && m.power === 'Moderate');
if (!caster?.spells?.[0]) throw new Error('no Moderate guardian with a special');
const special = caster.spells[0].name;
const guardian = () => {
  const g = call('pcMonsterCombatant', { ...clone(caster), _hpFull: caster.hp }) as Combatant;
  g.tactics = ['MS:' + special];
  g.tacIdx = 0;
  return g;
};
const act = (a: Combatant, f: Combatant, r: number) => {
  const n: string[] = [];
  pinned(r, () => call('pcAct', a, f, n, st()));
  return n.join('\n');
};
const swung = (t: string, who: string) => new RegExp(`${who.replace(/[()]/g, '.')} attacks \\(`).test(t);

test("a guardian's special that fails its roll: it attacks instead of losing the round", () => {
  const g = guardian();
  const t = act(g, hero(['ME']), 0.99);
  expect(t, `${caster.name}'s special fails its roll (forced)`).toMatch(/slips away/);
  expect(swung(t, g.name), `…and ${caster.name} attacks instead of losing the round`).toBe(true);
  expect(t, '…the report no longer says the round is lost').not.toMatch(/round is lost/);
});

test('a guardian bound by Spiritwrack swings instead of standing idle', () => {
  const g = guardian();
  g.status.silenceRounds = 2;
  g.status.meleeHalvedRounds = 2;
  const t = act(g, hero(['ME']), 0.5);
  expect(swung(t, g.name), t.split('\n')[0]).toBe(true);
});

test("the hero's spell that fizzles: the hero attacks instead", () => {
  const h = hero(['CA:Psychic Blast']);
  const t = act(h, guardian(), 0.99);
  expect(t, "the hero's Psychic Blast fizzles (forced)").toMatch(/fizzles/);
  expect(swung(t, h.name), '…and the hero attacks instead').toBe(true);
});

test('a spell already cast this fight becomes an attack', () => {
  const h = hero(['CA:Psychic Blast', 'CA:Psychic Blast']);
  (h['castSpells'] as string[]).push('Psychic Blast');
  const t = act(h, guardian(), 0.5);
  expect(t).toMatch(/already cast/);
  expect(swung(t, h.name)).toBe(true);
});

test('a spell the hero cannot cast becomes an attack', () => {
  const h = hero(['CA:Fireball'], { elemental: 0 });
  expect(swung(act(h, guardian(), 0.5), h.name)).toBe(true);
});

test('a silenced hero who would cast attacks instead', () => {
  const h = hero(['CA:Psychic Blast']);
  h.status.silenceRounds = 2;
  const t = act(h, guardian(), 0.5);
  expect(t).toMatch(/silenced/);
  expect(swung(t, h.name)).toBe(true);
});

test('a silenced hero who would shoot attacks instead', () => {
  const h = hero(['FI']);
  h.status.silenceRounds = 2;
  expect(swung(act(h, guardian(), 0.5), h.name)).toBe(true);
});

test('a stunned guardian still loses its round', () => {
  const g = guardian();
  g.status.stun = 1;
  const t = act(g, hero(['ME']), 0.5);
  expect(t).toMatch(/stunned and cannot act/);
  expect(swung(t, g.name)).toBe(false);
});
