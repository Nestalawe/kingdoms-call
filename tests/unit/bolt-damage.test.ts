// 2026-10-14 (item 9) — Lightning Bolt does 1–3 damage per level of Elemental Magic in personal
// combat (was 2–4), counted to level 5: 1–3 at level 1 … 5–15 at level 5 and above. The dice are
// pinned (every roll its lowest, then every roll its highest; the cast roll always succeeds), so the
// test reads the exact range. The data file, the rulebook and the player portal's spell note say the same.
// Level 1 (unit): pcCastCombatSpell called directly in the bare vm (tests/lib/personal-combat.ts; plan P1-08e: it was a
// script that took it from the "  // 4. Run all 5 phases" hook after a turn on the GM portal). The pages are read as
// built.
import { expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';
import { clone, personalCombatEngine, type Combatant } from '../lib/personal-combat.ts';
import { entriesOf, fileDeclaring, pageText, stringsOf } from '../lib/source.ts';

const { engine, call, base, pinned } = personalCombatEngine();
let nextId = 0;
const mk = (skills: Record<string, number>) => {
  const c = call('pcCharCombatant', {
    ...clone(base),
    id: `t${String(nextId++)}`,
    player: null,
    items: [],
    skills: { ...skills },
    temper: 'Brave',
  }) as Combatant;
  c.hp = c.maxHp = 999;
  return c;
};
const realD100: unknown = engine['d100'];
const bolt = (lvl: number, r: number) => {
  engine['d100'] = () => 1;
  try {
    return pinned(r, () => {
      const caster = mk({ elemental: lvl });
      const target = mk({});
      const before = target.hp;
      call('pcCastCombatSpell', caster, target, 'Lightning Bolt', [], {});
      return before - target.hp;
    });
  } finally {
    engine['d100'] = realD100;
  }
};

test.for([1, 2, 3, 4, 5, 7])('Elemental %i: the bolt does 1–3 a level, counted to 5', (lvl) => {
  const n = Math.min(lvl, 5);
  expect([bolt(lvl, 0), bolt(lvl, 0.999999)]).toEqual([n, 3 * n]);
});

// The data file's and the player portal's words are read from src/ by their syntax tree (tests/lib/source.ts, plan
// P1-09a: until then the built files' text was matched).
const data = stringsOf('content/kingdoms-call-data.ts').join('\n');
const rules = readPage('kingdoms-call-rules.html');
const pp = pageText('kingdoms-call-player-portal.html');
const hint = (spell: string) =>
  entriesOf(fileDeclaring('kingdoms-call-player-portal.html', 'SPELL_HINTS'), 'SPELL_HINTS').find(
    (e) => e.key === spell,
  )?.value ?? '';

test("the spell's description says 1–3 per level", () => {
  expect(data).toMatch(/deals 1–3 damage per caster level/);
});
test('the rulebook says 1–3 per level', () => {
  expect(rules).toMatch(/Lightning Bolt<\/strong>[^\n]*Combat: <strong>1–3 damage per level<\/strong>/);
});
test("the player portal's spell note says 1–3 per level", () => {
  expect(hint('Lightning Bolt')).toMatch(/^Combat: 1–3 damage per caster level/);
});
test('no page still says 2–4', () => {
  expect(data + rules + pp).not.toMatch(/2–4 damage per (caster )?level|2\\u20134 damage per caster level/);
});
