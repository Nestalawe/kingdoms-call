// A druid awakens the grove of his realm's own forest while another realm's hero stands there: the onlooker reads the
// public half of the line, and every realm's report passes the leak check (tests/lib/report-leaks.ts), the audience
// check among them, on the engine's modules. The public half of a line with two audiences (logSplit,
// src/engine/turn/events-and-their-audiences.ts) is seen there: whoever has eyes in the province reads it, the druid's
// own realm excepted (it reads its own private half). The leak check's audience check reads each line's whole audience
// as emit kept it in memory (`r.perception`, B-18b), so a fault in that audience (the public half seen only in a
// battle, say) shows here, where no matrix game need cast it.
//
// Level 2 (scenario): the audience check reads a whole turn's reports against the audiences of its lines; only a turn
// played with its reports joins the two. The turn is certain on every world: the druid is realm 0's king in his home
// province, made a forest, with the Druid mastery; realm 1's king stands there and rests. Awaken Grove rolls no die but
// a Druid lesson, which the test doesn't read.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// A grove awakened before another realm's hero passes the leak check on the engine's modules (B-18b): in a real turn
// (`lib/a-staged-turn-on-the-engines-modules.ts`, from `KC_SEED`, a report for every realm, the turn's events recorded)
// realm 0's king awakens the grove of his home province while realm 1's king stands there; realm 1 reads the
// onlookers' line, and no realm's report breaks a leak check
import { expect, test } from 'vitest';
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
  skills?: Record<string, number>;
}
interface Province {
  id: number;
  terrain: string;
  owner: number | null;
  characters: number[];
}
interface Staged {
  characters: Character[];
  world: { provinces: Province[] };
}

test("a grove awakened before another realm's hero is read by that realm, and every report passes the leak check", async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  sc.reportEveryRealm();
  sc.recordTheEvents();
  const r = sc.turn<Staged, { druid: Character }>({
    realms: 2,
    prepare(S) {
      const king = (realm: number) => S.characters.find((c) => c.alive && c.player === realm && c.isKing);
      const druid = king(0);
      const onlooker = king(1);
      const home = S.world.provinces.find((p) => p.id === druid?.location);
      if (!druid || !onlooker || home?.owner !== 0)
        throw new Error("could not stage: each realm's king, and realm 0's home");
      home.terrain = 'forest';
      druid.skills = { ...druid.skills, druid: 7 };
      const was = S.world.provinces.find((p) => p.id === onlooker.location);
      if (was) was.characters = was.characters.filter((id) => id !== onlooker.id);
      home.characters.push(onlooker.id);
      onlooker.location = home.id;
      return { druid };
    },
    orders: (_S, { druid }) => ({ [druid.id]: plan(order('awaken_grove')) }),
  });
  const reportOf = (realm: number) => JSON.stringify(r.reports[realm] ?? null);
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
    // the turn got there: realm 1 read the onlookers' line (the druid's realm reads "under your banner"), and the
    // turn's events were handed over
    realm1ReadTheOnlookersLine: reportOf(1).includes('march under their banner until the turn'),
    recorded: r.perception !== undefined,
    breaches: describeBreaches('the turn', breaches),
  }).toEqual({ realm1ReadTheOnlookersLine: true, recorded: true, breaches: '' });
});
