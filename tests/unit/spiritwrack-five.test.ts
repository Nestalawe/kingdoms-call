// 2026-10-15 (Toby, D5) — Spiritwrack counts White Magic only to level 5, like every other spell's effect:
// silenced for 1 round + 1 per two levels, so 3 rounds at most (White 4 and up), and one round longer against a
// guardian weak to White (4 at most). Before, it read the caster's full level, so White 6+ reached 4 (5 against a
// weak guardian). Supersedes R-053's "at most 4 (5)".
// Level 1 (unit): pcCastCombatSpell called directly in the bare vm (tests/lib/personal-combat.ts; plan P1-08e: it was a
// script that took it from the "  // 4. Run all 5 phases" hook after a turn on the GM portal); the cast is pinned to
// succeed. The rulebook, the player portal and the data file are read as built.
import { expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';
import { clone, personalCombatEngine, type Combatant } from '../lib/personal-combat.ts';
import { entriesOf, fileDeclaring, stringsOf } from '../lib/source.ts';

const { call, base, MON, pinned } = personalCombatEngine();
const st = () => ({ fledBy: null, parley: false, stoleBy: null, range: 'melee', mirror: null, feature: null });
const hero = (white: number) => {
  const h = call('pcCharCombatant', {
    ...clone(base),
    items: [],
    skills: { ...base.skills, white },
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
  g.weak = weak ? { kind: 'school', key: 'white' } : null;
  g.hp = g.maxHp = 500;
  return g;
};
const rounds = (white: number, weak: boolean) => {
  const h = hero(white);
  const g = guard(weak);
  pinned(0.01, () => call('pcCastCombatSpell', h, g, 'Spiritwrack', [], st()));
  return g.status.silenceRounds;
};

test.for([
  [1, 1],
  [3, 2],
  [5, 3],
  [9, 3],
])('White %i: silenced %i round(s)', ([w, want]) => {
  expect(rounds(w ?? 0, false)).toBe(want);
});

test('White 5 against a guardian weak to White: 4 rounds', () => {
  expect(rounds(5, true)).toBe(4);
});

test('White 9 against a weak guardian: still 4', () => {
  expect(rounds(9, true)).toBe(4);
});

const strip = (t: string) => {
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u;
    t = u;
  }
};

test("the rulebook's Spiritwrack row says at most 3, or 4 against a weak guardian", () => {
  const R = strip(readPage('kingdoms-call-rules.html')).replace(/\s+/g, ' ');
  expect(R).toMatch(/3 at 4–5; levels past 5 add nothing/);
  expect(R).toMatch(/lasts one round longer \(up to 4\)/);
});

test("the player portal's text says max 3 and max 4", () => {
  // its spell hint, read from src/ by its syntax tree (tests/lib/source.ts, plan P1-09a: until then matched in the built
  // page's text)
  const pp =
    entriesOf(fileDeclaring('kingdoms-call-player-portal.html', 'SPELL_HINTS'), 'SPELL_HINTS').find(
      (e) => e.key === 'Spiritwrack',
    )?.value ?? '';
  expect(pp).toMatch(/\(max 3\)/);
  expect(pp).toMatch(/\(max 4\)/);
});

test("the data file's description says at most 3", () => {
  // its words, read from src/ by their syntax tree (plan P1-09a: until then site/'s copy of the file)
  expect(stringsOf('content/kingdoms-call-data.js').join('\n')).toMatch(/plus 1 per two White levels \(at most 3\)/);
});
