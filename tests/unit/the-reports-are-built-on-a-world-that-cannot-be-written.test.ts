// Views never write (plan P1-12b2, P1-12's Decision 9): building the reports reads the world and the GM's log, and
// writes to neither. The two writes the reports used to make, the Spy-stealth rolls and the Invisibility re-stamp, are
// an engine step of their own (spyStealthAndInvisibilityStampedForTheReports, src/engine/run-turn.ts) that the shell
// calls after the save, before the reports. The battle flags are no longer cleared after the reports (the next turn's
// start clears them), and a hero's items are read without a write (normaliseEquipment writes only a flag that changes,
// and at report time none does). Since P1-12b3 the reports are the views' (buildReports,
// src/views/every-realms-report-and-the-lines-each-realm-reads.ts), built from what the turn hands over for them
// (whatTheReportsRead), and are lent none of the turn's dice: they draw none.
// One turn, staged so it reaches every one of the six things the old writes were about, by construction: on
// a free land province X beside free land Y, a neutral guard holds X; realm 0's spy (Spy 6, a Master Spy: his order
// can't fail) spies X out in the first phase and wears an item; realm 0's mage (Psychic 3) casts Clairvoyance on realm
// 1's hero, with an Invisibility cast stamped on him this turn; realm 1's hero marches from Y into X in the third phase
// and fights the guard there. The dice are fixed, never luck: the turn plays on dice that show 0.01 (every cast and
// roll made), the Spy-stealth step on dice that show 0.99 (the spy, at Spy 5 for the stealth, is seen at 75 in 100:
// a roll of 100 slips by). The report of every realm is built on a world and a GM's log that refuse every write: a
// write (set, delete or define, on any object reached from them) is noted, then throws, so a write a `try` swallows is
// still seen; and on dice that count each draw. Then the same reports are built again, unguarded.
// - No write; and every report the same as the unguarded build, so the guard changed nothing the reports show.
// - No draw from the dice.
// - The turn reaches what the old writes were about, so the test can't pass by not getting there.
// - The reports can't be built before the Spy stealth is rolled.
// Red on the base of P1-12b2 (the reports rolled the stealth, cleared the battle flags and normalised the items), and on
// copies of src/ with each of the three writes put back (P1-12b2's PR shows them, on the matrix game the test played then); each reach check red with its line
// of the staging taken out (the PR that staged it shows them).
// Level 1 (unit): the engine alone, over a staged turn (tests/lib/a-staged-turn-on-the-engines-modules.ts's world, its
// rows written here, so the test lends the turn and the stealth their own dice); the writes are made deep inside the
// report's helpers, which only a turn reaches with the world they write to.
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { playHash, proseHash, withoutStamps } from '../../tools/balance/hash.ts';
import {
  aStagedTurnOnTheEnginesModules,
  order,
  plan,
  type Order,
} from '../lib/a-staged-turn-on-the-engines-modules.ts';
import type { buildReports } from '../../src/views/every-realms-report-and-the-lines-each-realm-reads.ts';
import type { TheGamesSlotRow } from '../../src/engine/turn/context.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
/** The die the turn plays on: below every chance a cast or a roll of the staging needs. */
const THE_TURNS_DIE = 0.01;
/** The die the Spy-stealth step plays on: a roll of 100, above the 75 in 100 a Spy 5 hero is seen at. */
const THE_STEALTHS_DIE = 0.99;

/** `o`, and every object read from it, refusing every write: each is handed to `note` (what, and where: indexes as
 *  #), then throws. One guard for each object, so the same object read twice is the same guard. */
function refusingEveryWrite<T>(o: T, path: string, note: (write: string) => void): T {
  const guards = new WeakMap<object, unknown>();
  const where = (at: string, key: string | symbol) => `${at}.${/^\d+$/.test(String(key)) ? '#' : String(key)}`;
  const refuse = (write: string): never => {
    note(write);
    throw new TypeError(`the reports wrote to the world: ${write}`);
  };
  const guard = (value: unknown, at: string): unknown => {
    if (value === null || typeof value !== 'object') return value;
    const known = guards.get(value);
    if (known) return known;
    const guarded = new Proxy(value, {
      get: (t, k): unknown => (typeof k === 'string' ? guard(Reflect.get(t, k), where(at, k)) : Reflect.get(t, k)),
      set: (_t, k) => refuse(`set ${where(at, k)}`),
      deleteProperty: (_t, k) => refuse(`delete ${where(at, k)}`),
      defineProperty: (_t, k) => refuse(`define ${where(at, k)}`),
      setPrototypeOf: () => refuse(`the prototype of ${at}`),
      preventExtensions: () => refuse(`no more fields on ${at}`),
    });
    guards.set(value, guarded);
    return guarded;
  };
  return guard(o, path) as T;
}

interface Report {
  worldMeta?: { provinces?: ({ hadBattle?: boolean } | null)[] };
  characters?: { items?: ({ equipped?: boolean } | null)[] }[];
  lastTurnLog?: { text?: string }[];
  spyActivity?: unknown[];
}
type WhatTheReportsRead = Parameters<typeof buildReports>[0];
interface Resolved {
  state: string;
  spyStealthAndInvisibilityStampedForTheReports(): void;
  whatTheReportsRead(): WhatTheReportsRead;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  alive: boolean;
  isKing?: boolean;
  location: number;
  locationName?: string;
  armies?: unknown[];
  skills?: Record<string, number>;
  items?: unknown[];
  [key: string]: unknown;
}
interface Province {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters: number[];
  [key: string]: unknown;
}
interface World {
  turn: number;
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
  [key: string]: unknown;
}

describe('a staged turn, every report built on a world that refuses every write', () => {
  const played = {
    guarded: [] as string[],
    unguarded: [] as string[],
    writes: [] as string[],
    /** Numbers drawn from the dice while the reports were built. */
    draws: 0,
    error: '',
    /** What the turn reaches, over every realm's report. */
    reached: {
      battlesMarked: 0,
      heroesWearingItems: 0,
      movedUnseen: 0,
      invisibleThisTurn: 0,
      clairvoyance: 0,
      spied: 0,
    },
    /** What the turn said when the reports were asked for before the Spy stealth, and after it. */
    beforeTheStealth: '',
    afterTheStealth: '',
  };

  beforeAll(async () => {
    const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
    const { kcRng } = await import('../../src/engine/rng.ts');
    const { resolveTurn } = await import('../../src/engine/run-turn.ts');
    const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
    const { buildReports: build } =
      await import('../../src/views/every-realms-report-and-the-lines-each-realm-reads.ts');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    // ── The staging ──
    const S = sc.world({ realms: 2, alignments: ['Neutral', 'Neutral'], races: ['Human', 'Human'] })
      .S as unknown as World;
    const P = S.world.provinces;
    const moveTo = (c: Character, p: Province) => {
      const old = P[c.location];
      if (old) old.characters = old.characters.filter((id) => id !== c.id);
      if (!p.characters.includes(c.id)) p.characters.push(c.id);
      c.location = p.id;
      c.locationName = p.name;
    };
    const aRealmsHeroIn = (p: Province) => S.characters.some((c) => c.alive && c.player != null && c.location === p.id);
    const free = (p: Province | undefined): p is Province =>
      !!p && p.terrain !== 'sea' && p.owner == null && !aRealmsHeroIn(p);
    const freeNeighbour = (p: Province) =>
      getNeighborsP<Province>(p as never, S.world.cols, S.world.rows, P).find((n) => n.id !== p.id && free(n));
    const X = P.find((p) => free(p) && freeNeighbour(p));
    const Y = X && freeNeighbour(X);
    const [spy, mage] = S.characters.filter((c) => c.alive && c.player === 0 && !c.isKing);
    const [rival] = S.characters.filter((c) => c.alive && c.player === 1 && !c.isKing);
    if (!X || !Y || !spy || !mage || !rival)
      throw new Error(
        'could not stage: a free land province beside free land, two heroes of realm 0 and one of realm 1',
      );
    // X and Y as the test stages them: plain ground, and no one there the world dealt (a wandering guard is laid to rest)
    for (const p of [X, Y]) {
      for (const c of S.characters) if (c.player == null && c.location === p.id) c.alive = false;
      p.characters = p.characters.filter((id) => S.characters.some((c) => c.id === id && c.alive));
      Object.assign(p, { terrain: 'plain', neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [] });
    }
    const refuse = () => ({ tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], notes: '', duelStance: 'refuse' });
    const guardArmies = [{ type: 'Militia', quality: 'Green', race: 'Human', unitName: 'Militia of the Ford' }];
    // the guard: a copy of a hero the world dealt (so the save holds every field a character has), made a neutral chief
    const guard: Character = {
      ...(JSON.parse(JSON.stringify(rival)) as Character),
      id: S.characters.length, // the next id: the engine finds a character by its place in the list
      name: 'Warden Testcairn',
      isKing: false,
      player: null,
      skills: {},
      items: [],
      location: X.id,
      locationName: X.name,
      _isNeutralGuard: true,
      armies: guardArmies,
      encounterPlan: refuse(),
    };
    S.characters.push(guard);
    X.characters.push(guard.id);
    Object.assign(X, { neutralDefenders: [...guardArmies], npcArmies: guardArmies.length });
    for (const c of S.characters) c.items = []; // no item the world dealt: the one worn is the staging's
    moveTo(spy, X);
    spy.skills = { ...spy.skills, spy: 6 }; // a battle flag, the spy's sight, the Spy stealth
    spy.items = [
      {
        id: 9001,
        name: 'Ring of the Explorer',
        desc: 'Explorer +2',
        lore: 'A ring worn for the test.',
        effect: { stat: 'explorer', bonus: 2 },
        tier: 2,
        equipped: true,
      },
    ]; // an item worn
    moveTo(mage, X);
    mage.skills = { ...mage.skills, psychic: 3, spy: 0 }; // a Clairvoyance cast
    moveTo(rival, Y);
    rival.armies = ['Shieldwall Levies', 'Men-at-Arms', 'Free Lances', 'Yeoman Longbows'].map((type) => ({
      type,
      quality: 'Veteran',
      race: 'Human',
      unitName: `${type} of Realm 1`,
    })); // a host to fight the guard with
    rival['_invisTurn'] = S.turn; // an Invisibility cast this turn, re-stamped for the reports
    rival['encounterPlan'] = refuse();
    const orders: Record<number, Order[]> = {
      [spy.id]: plan(order('spy', '')),
      [mage.id]: plan(order('cast_spell', 'Clairvoyance', rival.id)),
      [rival.id]: plan(order('rest'), order('rest'), order('move', X.id)),
    };

    // ── The slot rows, as the harness's turn writes them: every realm human-held, every other hero resting ──
    const payload = (pi: number) =>
      JSON.stringify({
        orders: Object.fromEntries(
          S.characters.filter((c) => c.alive && c.player === pi).map((c) => [c.id, orders[c.id] ?? plan()]),
        ),
        encounterPlans: {},
        kingSkills: {},
        diplomacy: {},
        discoveryChoices: {},
        callReckoning: false,
        concede: false,
        messages: [],
        heroOrder: [],
        forTurn: S.turn,
      });
    const rows = [0, 1].map((pi) => ({
      id: 'gp' + String(pi),
      user_id: 'u' + String(pi),
      player_index: pi,
      display_name: 'Realm ' + String(pi),
      orders: payload(pi),
      orders_submitted: true,
      turn_report: JSON.stringify({}),
    })) as unknown as TheGamesSlotRow[];
    const first = JSON.stringify(S);

    // ── The turn, on its die; the stealth, on its own ──
    let theDie = THE_TURNS_DIE;
    const was = kcRng.use(() => theDie);
    const theTurnUpToTheStealth = (): Resolved => {
      theDie = THE_TURNS_DIE;
      const resolved = resolveTurn(first, rows, S.turn, null) as unknown as Resolved;
      return resolved;
    };
    const theStealth = (resolved: Resolved) => {
      theDie = THE_STEALTHS_DIE;
      resolved.spyStealthAndInvisibilityStampedForTheReports();
    };
    try {
      const resolved = theTurnUpToTheStealth();
      const after = JSON.parse(resolved.state) as { turn: number; characters?: ({ _invisTurn?: number } | null)[] };
      played.reached.invisibleThisTurn = (after.characters ?? []).filter(
        (c) => c?._invisTurn === after.turn - 1,
      ).length;
      theStealth(resolved);
      const handedOver = resolved.whatTheReportsRead();
      const everyRealm = {
        ...handedOver,
        freshPlayers: handedOver.freshPlayers.map((p) => ({ ...p, user_id: p.user_id ?? 'every-realm' })),
      };
      const hashes = (built: ReturnType<typeof build>) =>
        built.reports.map(({ gp, report }) => {
          const r = withoutStamps(report);
          return `${String(gp.player_index)}:${playHash(r)}/${proseHash(r)}`;
        });
      // the guarded build, on dice that count each draw
      kcRng.use(() => {
        played.draws += 1;
        return theDie;
      });
      try {
        const guarded = build({
          ...everyRealm,
          G: refusingEveryWrite(everyRealm.G, 'G', (w) => played.writes.push(w)),
          turnLog: refusingEveryWrite(everyRealm.turnLog, 'log', (w) => played.writes.push(w)),
        });
        played.guarded = hashes(guarded);
        const r = played.reached;
        for (const { report } of guarded.reports) {
          const rep = report as Report;
          r.battlesMarked += (rep.worldMeta?.provinces ?? []).filter((p) => p?.hadBattle).length;
          r.heroesWearingItems += (rep.characters ?? []).filter((c) =>
            (c.items ?? []).some((it) => it?.equipped === true),
          ).length;
          r.clairvoyance += (rep.lastTurnLog ?? []).filter((e) => (e.text ?? '').includes('Clairvoyance')).length;
          r.spied += (rep.spyActivity ?? []).length;
        }
        r.movedUnseen += guarded.gmLog.filter((e) => (e.text ?? '').includes('moved unseen this turn')).length;
      } finally {
        kcRng.use(() => theDie);
      }
      played.unguarded = hashes(build(everyRealm));
    } catch (err) {
      played.error = String((err as { message?: unknown }).message ?? err);
    }
    // The order: the turn again, its reports asked for before the stealth, then after it.
    try {
      const resolved = theTurnUpToTheStealth();
      try {
        build(resolved.whatTheReportsRead());
      } catch (err) {
        played.beforeTheStealth = String((err as { message?: unknown }).message);
      }
      try {
        theStealth(resolved);
        played.afterTheStealth = typeof build(resolved.whatTheReportsRead());
      } catch (err) {
        played.afterTheStealth = String((err as { message?: unknown }).message);
      }
    } finally {
      kcRng.use(was);
    }
  });
  afterAll(() => {
    vi.restoreAllMocks();
  });

  test('the reports write nothing to the world or the GM’s log', () => {
    expect([...new Set(played.writes)]).toEqual([]);
    expect(played.error).toBe('');
  });

  test('the reports draw no dice', () => {
    expect(played.draws).toBe(0);
  });

  test('every report built on the guarded world is the one built on the world itself: the guard changed nothing', () => {
    expect(played.guarded.length, 'a report for each realm').toBe(2);
    expect(played.guarded).toEqual(played.unguarded);
  });

  test('the turn reaches what the old writes were about', () => {
    const r = played.reached;
    expect(r.battlesMarked, 'a battle marked on a map (the battle flags)').toBeGreaterThan(0);
    expect(r.heroesWearingItems, 'a hero wearing an item (his items read)').toBeGreaterThan(0);
    expect(r.movedUnseen, 'a hero who moved unseen (the Spy stealth)').toBeGreaterThan(0);
    expect(r.invisibleThisTurn, 'a hero made invisible this turn (the re-stamp)').toBeGreaterThan(0);
    expect(r.clairvoyance, 'a Clairvoyance watch').toBeGreaterThan(0);
    expect(r.spied, "a spy's lingering sight").toBeGreaterThan(0);
  });

  test('the reports cannot be built before the Spy stealth is rolled', () => {
    expect(played.beforeTheStealth).toBe('the Spy stealth is rolled before buildReports()');
    expect(played.afterTheStealth).toBe('object');
  });
});
