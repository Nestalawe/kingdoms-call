// 2026-10-12 (Toby's batch, item 20) — in a fight report, a realm sees its own heroes' maximum-HP rises, never an
// enemy hero's.
//   • Two heroes of different realms fight and both are wounded: each "hardened by the wounds" line reaches its
//     own realm only (a private entry), never the other realm, though the rest of the fight is shared.
//   • A winner's "hardened by the victory" line, pushed into a shared battle narrative, is private to the winner's
//     realm.
//   • A neutral hero's rise is shown to no realm.
//   • With no narrative (a lair cleared alone) the line is still the hero's own realm's news.
// Level 1 (unit): the fight engine, the HP award and the narrative emitters called directly on the engine's modules
// (tests/lib/personal-combat.ts), with the turn's own log, which is what each realm's report is cut from (an entry's
// targets and its public flag). Plan P1-08e: this was a script that took them from the "  // 4. Run all 5 phases" hook
// after a turn on the GM portal.
import { expect, test } from 'vitest';
import { personalCombatEngine, type Character, type Combatant, type FightResult } from '../lib/personal-combat.ts';

const { call, turnContext } = await personalCombatEngine();
const G = turnContext.G as { characters: Character[]; world: { provinces: unknown[] } };
const L = turnContext.turnLog as { text: unknown; public?: boolean; actor?: unknown; targets?: unknown[] }[];
let nextId = 9400;
type Hero = Character & { hp: number; maxHp: number; hpEarned: number };
const hero = (name: string, player: number | null, melee: number, hp: number): Hero => {
  const c: Hero = {
    id: nextId++,
    name,
    player,
    alive: true,
    race: 'Human',
    alignment: 'Good',
    temper: 'Brave',
    skills: { melee },
    items: [],
    armies: [],
    hpEarned: 0,
    maxHp: hp,
    hp,
    location: 0,
  };
  G.characters.push(c);
  return c;
};
type Entry = (typeof L)[number];
// Who may read a log entry: the report shows a realm an entry that is public, or names it as actor or target.
const sees = (e: Entry | undefined, pi: number) =>
  !!e && (!!e.public || e.actor === pi || (e.targets ?? []).includes(pi));
const hardLines = (from: number) => L.slice(from).filter((e) => /hardened by/.test(String(e.text)));
const who = (e: Entry | undefined) => JSON.stringify(e && { p: e.public, a: e.actor, t: e.targets });

test("two rivals both harden; each realm reads only its own hero's rise, and the rest of the fight is shared", () => {
  const a = hero('Aldmar the Grey', 0, 9, 200);
  const b = hero('Bresk Ironhand', 1, 9, 200);
  const A = call('pcCharCombatant', a) as Combatant;
  const B = call('pcCharCombatant', b) as Combatant;
  A.tactics = ['ME'];
  B.tactics = ['ME'];
  const res = call('resolvePersonalCombat', A, B, { maxRounds: 6 }) as FightResult;
  expect(
    a.hpEarned > 0 && b.hpEarned > 0,
    `staged: both are wounded and both harden (earned ${String(a.hpEarned)} / ${String(b.hpEarned)})`,
  ).toBe(true);
  const from = L.length;
  res.narrative.forEach((line) =>
    call('emitNarrLine', line, {
      type: 'combat',
      audience: { actor: 0, realms: [0, 1] },
      province: 0,
      heroes: [a.id, b.id],
    }),
  );
  const lines = hardLines(from);
  const la = lines.find((e) => String(e.text).includes('Aldmar'));
  const lb = lines.find((e) => String(e.text).includes('Bresk'));
  expect(la && lb, `both hardening lines are in the log (${String(lines.length)})`).toBeTruthy();
  expect(sees(la, 0) && !sees(la, 1), `Aldmar's realm reads his rise; Bresk's realm does not (${who(la)})`).toBe(true);
  expect(sees(lb, 1) && !sees(lb, 0), `Bresk's realm reads his rise; Aldmar's realm does not (${who(lb)})`).toBe(true);
  expect(
    L.slice(from).some((e) => !/hardened by/.test(String(e.text)) && sees(e, 0) && sees(e, 1)),
    'the rest of the fight is still shared by both realms',
  ).toBe(true);
  expect(
    L.slice(from).some((e) => /\[object Object\]/.test(String(e.text))),
    'no line reads [object Object]',
  ).toBe(false);
});

test("a battle's winner: the victory line is private to the winner's realm; the battle is shown to both", () => {
  const w = hero('Corlis Vane', 0, 3, 20);
  const narr: unknown[] = ['⚔ **Battle for Testmoor**'];
  const r = call('awardWinHp', w, narr, 'duel') as { gain: number } | null;
  expect(r?.gain, 'staged: the winner hardens').toBeGreaterThanOrEqual(2);
  const from = L.length;
  call('emitBattle', { narrative: narr }, G.world.provinces[0], 1, [0, 1]);
  const line = hardLines(from)[0];
  expect(
    sees(line, 0) && !sees(line, 1),
    `the winner's realm reads "hardened by the victory"; the beaten realm does not (${who(line)})`,
  ).toBe(true);
  expect(
    L.slice(from).some((e) => /Battle for Testmoor/.test(String(e.text)) && sees(e, 1)),
    'the battle itself is still shown to both realms',
  ).toBe(true);
});

test("a neutral hero's rise is shown to no realm", () => {
  const n = hero('Old Hask', null, 3, 20);
  const narr: unknown[] = [];
  call('awardWinHp', n, narr, 'kill');
  const from = L.length;
  call('emitBattle', { narrative: narr }, G.world.provinces[0], 1, [0, 1]);
  const line = hardLines(from)[0];
  expect(!line || (!sees(line, 0) && !sees(line, 1)), line ? who(line) : 'not logged').toBe(true);
});

test("a lair cleared alone: the hero's own realm reads the rise, nobody else", () => {
  const s = hero('Dun the Lone', 1, 3, 20);
  const from = L.length;
  call('awardWinHp', s, null, 'lair');
  const line = hardLines(from)[0];
  expect(sees(line, 1) && !sees(line, 0)).toBe(true);
});
