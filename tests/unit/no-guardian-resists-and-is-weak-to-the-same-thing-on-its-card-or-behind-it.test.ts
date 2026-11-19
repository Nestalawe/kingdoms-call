// 2026-10-08 (the maintainer, item 4; the ruling R-079): no guardian may resist and be weak to the same kind of attack.
// - On its card: a perk that turns blows (meleeDR), arrows (arrowDR), spells (spellPct), one school (schoolWard) or
//   lingering harm (dotImmune / dotWard) must not sit beside a weakness to that same thing (arrows; a school of magic;
//   Elemental magic, whose fire lingers, for lingering harm).
// - Behind the card: the hidden category multipliers (monsterTraits: undead, fiend, flyer, armoured, beast) never push
//   the other way from a trait on the card: the card wins. Where nothing on the card speaks, the hidden layer still
//   works (the Elder Dragon, a flyer with no arrow trait, is easier to shoot down).
// - GUARDIAN_TABLE_VER is 18 or more, so running games re-read the guardians.
//
// Level 1 (unit): the guardian table (MONSTERS_P) imported from the content, and monsterTraits called on each of its
// rows on the engine's modules (tests/lib/the-whole-engine.ts first). Not lower: the hidden multipliers are computed,
// and whether they push against the card is a property of the function and the table together. monsterTraits reads no
// dice, so the outcome is the same on every seed.
//
// Until plan P1-14z this was tests/guardian-traits.test.js, which called monsterTraits in the engine's bundle run in a
// vm (tests/lib/engine.ts, pinned to seed 1). Its checks are here, one for one.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { MONSTERS_P } from '../../src/content/kingdoms-call-data.ts';
import { GUARDIAN_TABLE_VER } from '../../src/engine/heroes/skills-and-hp.ts';
import { monsterTraits } from '../../src/engine/personal-combat/lair-guardians-and-the-odds.ts';

/** A perk's rider, as the card's resistances are read from it. */
type ThePerksRider = Readonly<Record<string, unknown>>;
/** A guardian of the table, as this test reads its card. */
interface AGuardiansCard {
  readonly name: string;
  readonly passives?: readonly { readonly fx?: ThePerksRider }[];
  readonly passive?: { readonly fx?: ThePerksRider };
  readonly weak?: { readonly kind: string; readonly key?: string; readonly name: string };
}

const THE_GUARDIANS: readonly AGuardiansCard[] = MONSTERS_P;

/** Every perk on the card (2026-10-14, batch item 7: `passives`, one per grade; an older table had one `passive`). */
const perksOf = (m: AGuardiansCard): readonly { readonly fx?: ThePerksRider }[] =>
  m.passives ?? (m.passive ? [m.passive] : []);

/** What the card says the guardian resists: melee, archery, spell, dot, or school:<key>. */
function resistsOnTheCard(m: AGuardiansCard): Set<string> {
  const r = new Set<string>();
  for (const p of perksOf(m)) {
    const fx = p.fx ?? {};
    if (fx['ward'] === 'meleeDR' || fx['meleeDR']) r.add('melee');
    if (fx['ward'] === 'arrowDR' || fx['arrowDR']) r.add('archery');
    if (fx['ward'] === 'spellPct' || fx['spellPct']) r.add('spell');
    if (fx['ward'] === 'dotImmune' || fx['dotImmune'] || fx['ward'] === 'dotWard') r.add('dot');
    if (fx['ward'] === 'schoolWard') r.add('school:' + String(fx['school']));
  }
  return r;
}

/** What the card says the guardian is weak to: archery, or a school (a spell, and Elemental's lingering fire). */
function weakToOnTheCard(m: AGuardiansCard): Set<string> {
  const r = new Set<string>();
  if (m.weak?.kind === 'archery') r.add('archery');
  if (m.weak?.kind === 'school') {
    r.add('spell');
    r.add('school:' + String(m.weak.key));
    if (m.weak.key === 'elemental') r.add('dot');
  }
  return r;
}

test('the guardian table was read (more than 50 guardians)', () => {
  expect(THE_GUARDIANS.length).toBeGreaterThan(50);
});

test("no guardian's card resists and is weak to the same thing", () => {
  const clashes = THE_GUARDIANS.filter((m) => [...resistsOnTheCard(m)].some((k) => weakToOnTheCard(m).has(k))).map(
    (m) => `${m.name} (${[...resistsOnTheCard(m)].join('/')} vs ${String(m.weak?.name)})`,
  );
  expect(clashes).toEqual([]);
});

test('no hidden multiplier pushes against a trait on the card', () => {
  const pushesAgainst: string[] = [];
  for (const m of MONSTERS_P) {
    const mods = monsterTraits(m).mods;
    const resists = resistsOnTheCard(m);
    const weakTo = weakToOnTheCard(m);
    for (const c of ['melee', 'archery', 'spell'] as const) {
      if (resists.has(c) && mods[c] > 1)
        pushesAgainst.push(`${m.name}: resists ${c} on its card but hidden ×${mods[c].toFixed(2)}`);
      if (weakTo.has(c) && mods[c] < 1)
        pushesAgainst.push(`${m.name}: weak to ${c} on its card but hidden ×${mods[c].toFixed(2)}`);
    }
  }
  expect(pushesAgainst).toEqual([]);
});

test('a flyer with no arrow trait on its card (the Elder Dragon) is still easier to shoot down', () => {
  const dragon = MONSTERS_P.find((m) => m.name === 'Elder Dragon');
  expect(dragon).toBeDefined();
  expect(dragon && monsterTraits(dragon).mods.archery).toBeGreaterThan(1);
});

test('GUARDIAN_TABLE_VER is 18 or more, so running games re-read the guardians', () => {
  expect(GUARDIAN_TABLE_VER).toBeGreaterThanOrEqual(18);
});
