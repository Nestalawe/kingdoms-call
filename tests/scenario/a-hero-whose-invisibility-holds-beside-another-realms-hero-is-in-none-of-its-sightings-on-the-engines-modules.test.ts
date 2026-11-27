// A hero casts Invisibility in a province where another realm's hero stands, it holds, and he stays there for the rest
// of the turn: the other realm sees him in none of its sightings and reads of him in none of its lines, and every
// realm's report passes the leak check (tests/lib/report-leaks.ts), its "an unseen hero" condition among them, on the
// engine's modules. Without the spell, a hero beside one of yours at the end of the turn is always seen (R-110); with it,
// only Clairvoyance finds him (R-110, R-155), and he is revealed only to a realm he acts on (R-119, part 2). The whole-
// game leak check (simulation/every-realms-report-…) can't fail on this at a pull request's seed, where no Invisibility
// holds; this turn casts it on every world.
//
// Level 2 (scenario): the hero is hidden by the turn's stamp carried into the reports
// (spyStealthAndInvisibilityStampedForTheReports, src/engine/run-turn.ts, after the turn is saved), and the leak check
// reads the reports built after it with the turn's events; a unit case holds neither. The turn is certain on every
// world: the caster is realm 0's king in his home province, with Illusory 5 and no armies (R-158: Invisibility waits
// while a hero leads armies, so he leads none); realm 1's king stands there and rests,
// and casts no Clairvoyance. The two rolls of the cast are the chosen ones: a stand-in on resolveCastSpellOrder (called
// from the orders' dispatch) makes every percentile roll (d100, called from the cast's files) a 1 while the cast is
// resolved, so the cast lands and the spell holds (80% or less). Each stand-in is on the module that exports the
// function, and reaches calls from other files only (docs/traps.md): the test checks both were reached.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// A hero whose Invisibility holds beside another realm's hero is in none of its sightings, on the engine's modules
// (B-18e): in a real turn (`lib/a-staged-turn-on-the-engines-modules.ts`, from `KC_SEED`, a report for every
// realm, the turn's events recorded) realm 0's king casts Invisibility in his home province, the cast's rolls chosen,
// while realm 1's king stands there; the spell holds, realm 1's king still stands with him at the turn's end, and no
// realm's report breaks a leak check
import { expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { checkLeaks, describeBreaches, type SavedState } from '../lib/invariants.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Character {
  id: number;
  name: string;
  player: number | null;
  alive?: boolean;
  isKing?: boolean;
  location: number;
  armies?: unknown[];
  skills?: Record<string, number>;
  _invisTurn?: number;
}
interface Province {
  id: number;
  owner: number | null;
  characters: number[];
}
interface Staged {
  turn: number;
  characters: Character[];
  world: { provinces: Province[] };
}

test("a hero whose Invisibility holds beside another realm's hero is in none of its sightings, and every report passes the leak check", async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const dice = await import('../../src/engine/dice-and-army-names.ts');
  const cast =
    await import('../../src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts');
  // The cast's rolls: while the cast is resolved, every percentile roll is a 1 (the cast lands, and the spell holds).
  let casting = false;
  let castsResolved = 0;
  let rollsChosen = 0;
  const d100 = dice.d100;
  vi.spyOn(dice, 'd100').mockImplementation(() => {
    if (!casting) return d100();
    rollsChosen++;
    return 1;
  });
  const resolveCastSpellOrder = cast.resolveCastSpellOrder;
  vi.spyOn(cast, 'resolveCastSpellOrder').mockImplementation((...args: Parameters<typeof resolveCastSpellOrder>) => {
    casting = true;
    castsResolved++;
    try {
      resolveCastSpellOrder(...args);
    } finally {
      casting = false;
    }
  });
  sc.reportEveryRealm();
  sc.recordTheEvents();
  const r = sc.turn<Staged, { caster: Character; onlooker: Character }>({
    realms: 2,
    prepare(S) {
      const king = (realm: number) => S.characters.find((c) => c.alive && c.player === realm && c.isKing);
      const caster = king(0);
      const onlooker = king(1);
      const home = S.world.provinces.find((p) => p.id === caster?.location);
      if (!caster || !onlooker || home?.owner !== 0)
        throw new Error("could not stage: each realm's king, and realm 0's home");
      caster.skills = { ...caster.skills, illusory: 5 };
      caster.armies = [];
      const was = S.world.provinces.find((p) => p.id === onlooker.location);
      if (was) was.characters = was.characters.filter((id) => id !== onlooker.id);
      home.characters.push(onlooker.id);
      onlooker.location = home.id;
      return { caster, onlooker };
    },
    orders: (_S, { caster }) => ({ [caster.id]: plan(order('cast_spell', 'Invisibility')) }),
  });
  const { caster, onlooker } = r.extra;
  const after = (c: Character) => (r.S2 as unknown as Staged).characters.find((x) => x.id === c.id);
  const breaches = checkLeaks({
    before: r.S,
    after: r.S2 as unknown as SavedState,
    gmLog: r.log,
    telemetry: [],
    players: [],
    reports: Object.entries(r.reports).map(([realm, report]) => ({ realm: Number(realm), report })),
    ...(r.perception ? { perception: r.perception } : {}),
  });
  expect({
    // the turn got there: the cast went through the stand-ins (one cast, its two rolls at least: the cast's and the
    // spell's), the spell held (the turn it was cast is saved), the two kings still share the province at the turn's
    // end (so realm 1 would see him without it, R-110), and the turn's events were handed over
    castsResolved,
    theRollsWereChosen: rollsChosen >= 2,
    held: after(caster)?._invisTurn === r.S.turn,
    together: after(onlooker)?.location === after(caster)?.location,
    recorded: r.perception !== undefined,
  }).toEqual({ castsResolved: 1, theRollsWereChosen: true, held: true, together: true, recorded: true });
  // a breach is said in full (a long list in an object would be cut short)
  expect(describeBreaches('the turn', breaches)).toBe('');
});
