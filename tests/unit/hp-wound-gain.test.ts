// 2026-10-08 (item 16) — maximum-HP rolls after a personal fight.
//   • Every hero who takes at least 1 HP of damage in a fight and lives rolls for a gain at its end,
//     not only the winner.
//   • The winner still rolls once (the win award) and gains the roll +1.
//   • Every roll gains (Toby, 2026-10-09): the roll only sets the amount — even a battle-hardened
//     hero past 50 maximum HP gains 1 (2 for a win).
//   • Nobody rolls twice for one fight, and forecasts (simulated fights) never roll.
// Level 1 (unit): resolvePersonalCombat, pcCharCombatant and awardWinHp called directly on the engine's modules
// (tests/lib/personal-combat.ts), the fights staged on the turn's world (plan P1-08e: this was a script that took them
// from the "  // 4. Run all 5 phases" hook after a turn on the GM portal).
import { expect, test } from 'vitest';
import { personalCombatEngine, type Character, type Combatant, type FightResult } from '../lib/personal-combat.ts';

const { call, turnContext } = await personalCombatEngine();
const G = turnContext.G as { characters: Character[] };
let nextId = 9300;
type Hero = Character & { hp: number; maxHp: number; hpEarned: number };
// A made-up hero with an earned pool of 0 (15 max HP): every roll in this band succeeds (100%).
const hero = (name: string, melee: number, hp?: number): Hero => {
  const c: Hero = {
    id: nextId++,
    name,
    player: 0,
    alive: true,
    race: 'Human',
    alignment: 'Good',
    temper: 'Brave',
    skills: { melee },
    items: [],
    armies: [],
    hpEarned: 0,
    maxHp: 15,
    hp: hp ?? 15,
    location: 0,
  };
  G.characters.push(c);
  return c;
};
// `toTheDeath`: neither fighter breaks off (the engine's own flag, as for a lair's guardians), so a
// fight staged to end in a kill ends in a kill and not, some seeds, in a Brave fighter's flight.
const fight = (a: Hero, b: Hero, rounds: number, toTheDeath = false) => {
  const A = call('pcCharCombatant', a) as Combatant;
  const B = call('pcCharCombatant', b) as Combatant;
  A.tactics = ['ME'];
  B.tactics = ['ME'];
  if (toTheDeath) {
    A['neverFlees'] = true;
    B['neverFlees'] = true;
  }
  const res = call('resolvePersonalCombat', A, B, { maxRounds: rounds }) as FightResult;
  a.hp = Math.max(0, res.aHp);
  b.hp = Math.max(0, res.bHp);
  return res;
};
type Award = { gain: number; winBonus: number } | null;

// Each fight is staged so its shape is overwhelming, not lucky: two master swordsmen (Melee 9) with
// far more HP than a few rounds can take, so both land blows and neither falls.
test('a short, even fight that nobody wins: both are wounded, both roll, both harden', () => {
  const a = hero('Aldric', 9, 200);
  const b = hero('Brannoc', 9, 200);
  a.maxHp = b.maxHp = 200;
  const res = fight(a, b, 6);
  expect(
    !res.winner && !res.fledBy && a.hp < 200 && b.hp < 200,
    `staged: six rounds, no winner, both wounded (Aldric ${String(a.hp)}, Brannoc ${String(b.hp)})`,
  ).toBe(true);
  expect(a.hpEarned, 'a wounded hero who did not win hardens (Aldric)').toBeGreaterThan(0);
  expect(b.hpEarned, '…and so does the other (Brannoc)').toBeGreaterThan(0);
  expect(
    res.narrative.some((l) => /hardened by the wounds of the fight/.test(typeof l === 'string' ? l : l.text)),
    "the fight report says so (to the hero's own realm: a private line since 2026-10-12, unit/hp-gain-private)",
  ).toBe(true);
});

// A fight to the finish between two master swordsmen, one with ten times the other's HP: the
// winner is wounded on the way, but is NOT rolled for inside the fight (the win award does that,
// once). Fought to the death: a Brave fighter at a quarter of his HP would otherwise try to break
// off (30% a round), and a flight leaves no winner.
test('the winner gets no wound roll inside the fight; the win award is his one roll', () => {
  const a = hero('Corvin', 9, 300);
  const b = hero('Dunmore', 9, 30);
  a.maxHp = 300;
  b.maxHp = 30;
  const res = fight(a, b, 40, true);
  expect(res.winner?.ref === a && a.hp < 300, `staged: Corvin wins, wounded (HP ${String(a.hp)})`).toBe(true);
  expect(a.hpEarned).toBe(0);
});

// The win award: +1 on a successful roll (1–3 in this band, so 2–4 with the win).
test("a winner's successful roll gains 1–3 +1 for the win", () => {
  const seen = new Set<number | undefined>();
  let bad = 0;
  for (let i = 0; i < 60; i++) {
    const w = hero('Elspeth', 3);
    const r = call('awardWinHp', w, [], 'kill') as Award;
    if (!(r && r.gain >= 2 && r.gain <= 4 && r.winBonus === 1 && w.hpEarned === r.gain)) bad++;
    seen.add(r?.gain);
  }
  expect(bad, `gains seen: ${[...seen].sort().join(', ')}`).toBe(0);
});

// No chance of nothing: a hero already at 65 earned base still gains 1 per roll, 2 for a win.
test('a winner at 65 maximum HP gains exactly 1 +1 every time', () => {
  let bad = 0;
  for (let i = 0; i < 40; i++) {
    const w = hero('Fenwick', 3);
    w.hpEarned = 50;
    w.maxHp = 65;
    const r = call('awardWinHp', w, [], 'kill') as Award;
    if (!(r?.gain === 2 && w.hpEarned === 52)) bad++;
  }
  expect(bad).toBe(0);
});
