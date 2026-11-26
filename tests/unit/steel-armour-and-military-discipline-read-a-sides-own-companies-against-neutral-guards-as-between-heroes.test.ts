// Steel Armour and Military Discipline read a side's own companies, against a province's neutral guards as between
// heroes (R-160). A realm's discoveries that cut a beaten company's chance of death (Steel Armour's kind, `deathRed`)
// and add to a company's chance of promotion (Military Discipline's kind, `promo`) speak of its own companies, in either
// battle: against the guards, the attacker's Steel Armour never spares the beaten guards (they die at the plain chance),
// and a beaten host keeps Military Discipline's better chance to be promoted, as a beaten side does between heroes.
//
// Level 1 (unit): combatVsNPC and combatVsChar called directly (tests/lib/a-battle-called-directly.ts) on a world the
// engine makes from KC_SEED; no turn is played. Not lower: each chance is made inside the battle's casualty stage from
// the result's margin band and the side's realm, and the guards' death roll is a die drawn there, in no function of its
// own. Not higher: a whole turn adds orders and dice before the battle, and no bot order stages these.
//
// Every input a seed could change is pinned: the dice are one number for the whole battle (withTheDice), so the world's
// seed reaches nothing the battle draws; the realms' race (Human) and alignment (Neutral), the hero's skills, items,
// titles and plan, the companies (type, quality and race given), the ground (a plain of no realm's), the season (the
// first phase) and the guard are the test's own. A hero's temper is a bot's choice of orders and never reaches a battle
// called directly. The figures (Steel Armour's 0.2, Military Discipline's 0.4) are the content rows', written here as
// literals, so a row's figure changed fails a case.
import '../lib/the-whole-engine.ts';
import { afterEach, expect, test, vi } from 'vitest';
import * as fates from '../../src/engine/battle/fates.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import {
  aBattleAgainstTheProvince,
  aBattleBetweenHeroes,
  aFieldAndTheGroundBesideIt,
  aGuardMadeByTheTest,
  attackFrom,
  aWorld,
  type Character,
  type Company,
  companies,
  MELEE_AND_NO_DUEL,
  own,
  place,
  theTurnsContext,
  type World,
} from '../lib/a-battle-called-directly.ts';
import { withTheDice } from '../lib/hand-made-battle-lines.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
/** The one number every die of the battle shows: above an annihilated side's death chance with Steel Armour's cut
 *  (0.6 × 0.8 = 0.48) and below it without (0.6), and above the trapped guards' chance to be cut down (0.15). */
const THE_DICE = 0.55;

/** The engine's own rollUnitFates, before any stand-in (each battle puts one on it). */
const theRealRollUnitFates = fates.rollUnitFates;

afterEach(() => {
  vi.restoreAllMocks();
});

type ARealm = World['players'][number] & { discoveries?: { id: string }[] };

/** Realm `pi`, Human and Neutral, holding the discoveries given and no other. */
function theRealm(G: World, pi: number, discoveries: readonly string[]): ARealm {
  const realm: ARealm | undefined = G.players[pi];
  if (!realm) throw new Error(`no realm ${String(pi)}`);
  Object.assign(realm, { race: 'Human', alignment: 'Neutral', discoveries: discoveries.map((id) => ({ id })) });
  return realm;
}

/** Realm `pi`'s first hero who isn't its king, with no skill, item or title, a plan that fights in melee and refuses
 *  every duel, leading the companies given. */
function aHeroOf(G: World, pi: number, armies: Company[]): Character {
  const hero = G.characters.find((c) => c.alive && c.player === pi && !c.isKing);
  if (!hero) throw new Error(`realm ${String(pi)} has no hero but its king`);
  Object.assign(hero, {
    race: 'Human',
    alignment: 'Neutral',
    skills: {},
    aptitude: {},
    items: [],
    minorTitles: [],
    hp: 40,
    maxHp: 40,
    encounterPlan: MELEE_AND_NO_DUEL(),
    armies,
  });
  return hero;
}

/** The fates' calls the battle makes, each with its options, as they are made. */
function theFatesRolled(): { owner: unknown; won: boolean; o: fates.UnitFateOptions; force: unknown[] }[] {
  const calls: { owner: unknown; won: boolean; o: fates.UnitFateOptions; force: unknown[] }[] = [];
  vi.spyOn(fates, 'rollUnitFates').mockImplementation((...args: Parameters<typeof theRealRollUnitFates>) => {
    const [force, o] = args;
    calls.push({ owner: o.owner, won: o.won, o, force: [...(force ?? [])] });
    return theRealRollUnitFates(...args);
  });
  return calls;
}

/** The beaten side's fates' call, its options with the demotion's chance. */
function theBeatenSidesFates(calls: ReturnType<typeof theFatesRolled>) {
  for (const { o, force } of calls) if (!o.won) return { o, force };
  return undefined;
}

/** The beaten guards' companies that die in the battle's death roll (not those cut down with no escape after it). */
const theGuardsDead = (narrative: readonly NarrativeLine[]): number =>
  narrative.filter((line) => {
    const fact = line as {
      kind?: string;
      itsSideWon?: boolean;
      fate?: string;
      theUnit?: { owner?: { kind?: string } | null };
    };
    return (
      fact.kind === "a unit's fate in the battle" &&
      fact.itsSideWon === false &&
      fact.fate === 'dies' &&
      fact.theUnit?.owner?.kind === 'the defenders led by their guard'
    );
  }).length;

/** The battle against a province's guard: realm 0's hero, holding the discoveries given, attacks it from the ground
 *  beside, with his companies against the guard's. */
function aBattleAgainstAGuard(discoveries: readonly string[], his: Company[], theGuards: Company[]) {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  own(G, from, 0);
  const realm = theRealm(G, 0, discoveries);
  const guard = aGuardMadeByTheTest(G, field, theGuards, { encounterPlan: MELEE_AND_NO_DUEL() });
  const hero = aHeroOf(G, 0, his);
  attackFrom(G, hero, from, field);
  const calls = theFatesRolled();
  const battle = withTheDice(
    () => THE_DICE,
    () => aBattleAgainstTheProvince(tc, hero, field, guard),
  );
  return { battle, calls, realm, hero };
}

test("against a province's guards, the attacker's Steel Armour spares his own companies only: the beaten guards die at the plain chance (R-160)", () => {
  const knights = () => companies('Knights', 12, 'Elite', 'Human');
  const levies = () => companies('Shieldwall Levies', 3, 'Green', 'Human');
  const plain = aBattleAgainstAGuard([], knights(), levies());
  vi.restoreAllMocks();
  const steel = aBattleAgainstAGuard(['sd05'], knights(), levies());

  expect(plain.battle.won, 'the hero beats the guard').toBe(true);
  expect(steel.battle.won, '…with Steel Armour too').toBe(true);
  expect(theGuardsDead(plain.battle.narrative), 'without Steel Armour, every beaten guard company dies').toBe(3);
  expect(
    theGuardsDead(steel.battle.narrative),
    "with the attacker's Steel Armour, the beaten guards die as without it (it isn't theirs)",
  ).toBe(3);
  // …and his own companies keep it: the winner's death roll is cut by a fifth.
  const his = steel.calls.find((c) => c.won);
  const unit = his?.force[0] as ArmyInABattle | undefined;
  expect(his && unit, "the winner's fates are rolled").toBeTruthy();
  if (!his || !unit) return;
  const withIt = his.o.dieAt(unit);
  steel.realm.discoveries = [];
  expect(withIt / his.o.dieAt(unit), "the attacker's own companies die at four fifths of the chance").toBeCloseTo(
    0.8,
    12,
  );
});

test("a host beaten by a province's guards keeps Military Discipline's better chance to be promoted (R-160)", () => {
  const { battle, calls, realm } = aBattleAgainstAGuard(
    ['sd06'],
    companies('Shieldwall Levies', 2, 'Average', 'Human'),
    companies('Knights', 12, 'Elite', 'Human'),
  );
  expect(battle.won, 'the guard beats the hero').toBe(false);
  const beaten = theBeatenSidesFates(calls);
  const unit = beaten?.force[0] as ArmyInABattle | undefined;
  expect(beaten && unit, "the beaten host's fates are rolled").toBeTruthy();
  if (!beaten || !unit) return;
  // promoteTo is the demotion window and the promotion's chance after it: the promotion's own share is the difference
  const theShareWith = beaten.o.promoteTo(unit) - beaten.o.demoteAt(unit);
  realm.discoveries = [];
  const theShareWithout = beaten.o.promoteTo(unit) - beaten.o.demoteAt(unit);
  expect(theShareWithout, 'a beaten company has a chance to be promoted').toBeGreaterThan(0);
  expect(theShareWith / theShareWithout, 'Military Discipline makes it 40% likelier').toBeCloseTo(1.4, 12);
});

test("between heroes, the same: a beaten side keeps Military Discipline, and the winner's Steel Armour never spares it", () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  own(G, from, 0);
  const attackersRealm = theRealm(G, 0, ['sd06']);
  const defendersRealm = theRealm(G, 1, ['sd05']);
  const atk = aHeroOf(G, 0, companies('Shieldwall Levies', 2, 'Average', 'Human'));
  const def = aHeroOf(G, 1, companies('Knights', 12, 'Elite', 'Human'));
  place(G, def, field);
  attackFrom(G, atk, from, field);
  const calls = theFatesRolled();
  const battle = withTheDice(
    () => THE_DICE,
    () => aBattleBetweenHeroes(tc, atk, def, field),
  );
  expect(battle.won, "realm 1's hero beats realm 0's").toBe(false);
  const beaten = theBeatenSidesFates(calls);
  const unit = beaten?.force[0] as ArmyInABattle | undefined;
  expect(beaten && unit, "the beaten host's fates are rolled").toBeTruthy();
  if (!beaten || !unit) return;
  const theShareWith = beaten.o.promoteTo(unit) - beaten.o.demoteAt(unit);
  const itsDeathWith = beaten.o.dieAt(unit);
  attackersRealm.discoveries = [];
  defendersRealm.discoveries = [];
  const theShareWithout = beaten.o.promoteTo(unit) - beaten.o.demoteAt(unit);
  expect(theShareWithout, 'a beaten company has a chance to be promoted').toBeGreaterThan(0);
  expect(theShareWith / theShareWithout, 'Military Discipline makes it 40% likelier').toBeCloseTo(1.4, 12);
  expect(itsDeathWith, "the winner's Steel Armour leaves the beaten side's death roll as it is").toBe(
    beaten.o.dieAt(unit),
  );
});
