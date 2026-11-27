// Invisibility waits while a hero leads armies (R-158): three heroes of one realm cast it in Spring and it holds for
// each, beside another realm's king. The first leads his companies all turn: he is seen at the turn's end, and an
// order of the other realm aimed at him finds him. The second leads companies when he casts it and leaves them as the
// garrison in Summer: from then the spell hides him, so he is seen by no one at the turn's end. The third leads none
// when he casts it, and takes up that garrison in Autumn: he is seen from then.
//
// Level 2 (scenario): whether he leads armies changes in the turn's phases (a hand-over, a pick-up), and the sight the
// reports read is the turn's stamp carried into them after the turn is saved (spyStealthAndInvisibilityStampedForTheReports,
// src/engine/run-turn.ts); a unit case on the rule (src/engine/rules-on-plain-values/whether-a-heros-invisibility-
// hides-him-now.ts) holds neither the phases nor the reports. The turn is certain on every world: the casters are realm
// 0's three heroes in its home province, with Illusory 5; realm 1's king stands there, leads nothing and rests. The
// cast's rolls are the chosen ones: a stand-in on resolveCastSpellOrder (called from the orders' dispatch) makes every
// percentile roll (d100, called from the cast's files) a 1 while a cast is resolved, so each cast lands and its spell
// holds (80% or less). Each stand-in is on the module that exports the function, and reaches calls from other files
// only (docs/traps.md): the test checks both were reached.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Invisibility waits while a hero leads armies, and hides him once he leads none (R-158): in a real turn (`lib/a-staged-
// turn-on-the-engines-modules.ts`, from `KC_SEED`) realm 0's three heroes cast it in Spring, the rolls chosen, beside
// realm 1's king; the one who leads his companies all turn and the one who takes up a garrison in Autumn are in realm
// 1's sightings at the turn's end and found by its orders; the one who leaves his companies in Summer is in neither
import { expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Unit {
  type: string;
  quality: string;
  unitName: string;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  alive?: boolean;
  isKing?: boolean;
  location: number;
  armies?: Unit[];
  skills?: Record<string, number>;
  _invisTurn?: number;
}
interface Province {
  id: number;
  owner: number | null;
  characters: number[];
  garrisonArmies?: Unit[];
}
interface Staged {
  turn: number;
  characters: Character[];
  world: { provinces: Province[] };
}
interface TheReportAsThisReadsIt {
  visibleChars?: { id: number }[];
}

const company = (name: string): Unit => ({ type: 'Heavy Infantry', quality: 'Regular', unitName: name });

test('Invisibility waits while a hero leads armies, hides him once he leads none, and a hidden hero who takes up an army is seen', async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const dice = await import('../../src/engine/dice-and-army-names.ts');
  const cast =
    await import('../../src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts');
  const { isHiddenByInvisibilityFrom } = await import('../../src/engine/heroes/effective-skills-and-hidden-heroes.ts');
  // The casts' rolls: while a cast is resolved, every percentile roll is a 1 (the cast lands, and the spell holds).
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
  const r = sc.turn<Staged, { leads: Character; leaves: Character; takesUp: Character; onlooker: Character }>({
    realms: 2,
    prepare(S) {
      const realm0 = S.characters.filter((c) => c.alive && c.player === 0);
      const leads = realm0.find((c) => c.isKing);
      const [leaves, takesUp] = realm0.filter((c) => !c.isKing);
      const onlooker = S.characters.find((c) => c.alive && c.player === 1 && c.isKing);
      const home = S.world.provinces.find((p) => p.id === leads?.location);
      if (!leads || !leaves || !takesUp || !onlooker || home?.owner !== 0)
        throw new Error("could not stage: realm 0's king and two heroes, realm 1's king, and realm 0's home");
      home.garrisonArmies = [];
      for (const c of [leads, leaves, takesUp, onlooker]) {
        c.skills = { ...c.skills, illusory: 5 };
        c.armies = [];
        const was = S.world.provinces.find((p) => p.id === c.location);
        if (was) was.characters = was.characters.filter((id) => id !== c.id);
        home.characters.push(c.id);
        c.location = home.id;
      }
      leads.armies = [company('the Grey Shields')];
      leaves.armies = [company('the Ash Spears')];
      return { leads, leaves, takesUp, onlooker };
    },
    orders: (_S, { leads, leaves, takesUp }) => ({
      [leads.id]: plan(order('cast_spell', 'Invisibility')),
      [leaves.id]: plan(order('cast_spell', 'Invisibility'), order('leave_army', 'all')),
      [takesUp.id]: plan(order('cast_spell', 'Invisibility'), order('rest'), order('pickup_army', 'all')),
    }),
  });
  const { leads, leaves, takesUp, onlooker } = r.extra;
  const S2 = r.S2 as unknown as Staged;
  const after = (c: Character) => S2.characters.find((x) => x.id === c.id);
  const report: TheReportAsThisReadsIt = r.reports[1] ?? {};
  const seen = new Set((report.visibleChars ?? []).map((v) => v.id));
  const whatRealm1Has = (c: Character) => {
    const a = after(c);
    return {
      leadsArmies: (a?.armies ?? []).length > 0,
      held: a?._invisTurn === r.S.turn,
      inItsSightings: seen.has(c.id),
      foundByItsOrders: !isHiddenByInvisibilityFrom({ G: S2 }, a, 1, r.S.turn),
    };
  };
  expect({
    // the turn got there: three casts through the stand-ins (two rolls each at least: the cast's and the spell's),
    // realm 1's king still beside them at the turn's end, and his realm's report written
    castsResolved,
    theRollsWereChosen: rollsChosen >= 6,
    together: [leads, leaves, takesUp].every((c) => after(c)?.location === after(onlooker)?.location),
    reported: r.reports[1] !== undefined,
    leads: whatRealm1Has(leads),
    leaves: whatRealm1Has(leaves),
    takesUp: whatRealm1Has(takesUp),
  }).toEqual({
    castsResolved: 3,
    theRollsWereChosen: true,
    together: true,
    reported: true,
    leads: { leadsArmies: true, held: true, inItsSightings: true, foundByItsOrders: true },
    leaves: { leadsArmies: false, held: true, inItsSightings: false, foundByItsOrders: false },
    takesUp: { leadsArmies: true, held: true, inItsSightings: true, foundByItsOrders: true },
  });
});
