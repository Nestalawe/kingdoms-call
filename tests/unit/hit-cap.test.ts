// 2026-10-08 (item 4a) — no single hit in personal combat takes more than HALF the target's
// maximum HP: a guardian's blow on a hero, a hero's blow on a guardian, and a hero's blow on another
// hero in a duel. (Before: only a guardian's blow on a hero was capped, at a third.) A tighter cap a
// combatant already carries (a Legendary's 20% body cap, a cap ward) still wins.
// Level 1 (unit): pcTakeHit called directly on the engine's modules (tests/lib/personal-combat.ts; plan P1-08e: it was a
// scenario-level script that took it from the "  // 4. Run all 5 phases" hook after a turn on the GM portal).
import { expect, test } from 'vitest';
import { personalCombatEngine, type Character, type Combatant, type Guardian } from '../lib/personal-combat.ts';

const { call, MON, turnContext } = await personalCombatEngine({ realms: 3, opts: { seaPct: 30 } });
const ch = (turnContext.G['characters'] as Character[]).find((c) => c.alive);
if (!ch) throw new Error('the world has no living character');

// A bare hero: no armour, no temper, a known maximum.
const bareHero = (maxHp: number, vsGuardian: boolean) => {
  const h = call('pcCharCombatant', { ...ch, items: [], armies: [] }) as Combatant;
  h.arm = null;
  h['temper'] = 'None';
  h.hp = h.maxHp = maxHp;
  h['_vsGuardian'] = vsGuardian;
  return h;
};
const hit = (t: Combatant, dmg: number, src = 'Foe', kind = 'blow') => {
  const before = t.hp;
  call('pcTakeHit', t, dmg, [], src, kind);
  return before - t.hp;
};

test("a guardian's blow takes at most half a 30 HP hero's health (15)", () => {
  expect(hit(bareHero(30, true), 40, 'Cave Bear')).toBe(15);
});
test('…rounded down for an odd maximum (31 HP → 15)', () => {
  expect(hit(bareHero(31, true), 40, 'Cave Bear')).toBe(15);
});
test('a blow under the cap is untouched', () => {
  expect(hit(bareHero(30, true), 9, 'Cave Bear')).toBe(9);
});
test('in a duel between heroes a blow takes at most half (15 of 30)', () => {
  expect(hit(bareHero(30, false), 40, 'Rival Hero')).toBe(15);
});

// A guardian with no cap of its own, struck by a hero.
const perksOf = (m: Guardian) =>
  (Array.isArray(m.passives) ? m.passives : m['passive'] ? [m['passive']] : []) as {
    fx?: Record<string, unknown> & { ward?: string };
  }[]; // batch item 7: one perk per grade
test("a hero's blow takes at most half a guardian's health", () => {
  const plain = MON.find(
    (m) =>
      m.power === 'Moderate' &&
      !perksOf(m).some(
        (p) =>
          p.fx && (/cap|DR|spellPct|absorb|parry|dodge|lowHp/.exec(p.fx.ward ?? '') || p.fx['cap'] || p.fx['meleeDR']),
      ),
  );
  expect(plain, 'found a Moderate guardian with no ward of its own').toBeTruthy();
  if (!plain) return;
  const g = call('pcMonsterCombatant', { ...plain, _hpFull: plain.hp }) as Combatant;
  g.hp = g.maxHp = 24;
  expect(hit(g, 40, ch.name), `${plain.name}: 12 of 24`).toBe(12);
});

// A Legendary's 20% body cap is tighter and still wins.
test("a Legendary's own 20% cap still wins", () => {
  const leg = MON.find((m) => m.power === 'Legendary');
  if (!leg) throw new Error('no Legendary guardian');
  const L = call('pcMonsterCombatant', { ...leg, _hpFull: leg.hp }) as Combatant;
  L.hp = L.maxHp = 60;
  expect(hit(L, 40, ch.name), `${leg.name}: took of 60`).toBeLessThanOrEqual(12);
});
