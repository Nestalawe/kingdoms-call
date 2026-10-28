// Properties of the duel before a battle (preBattleDuel, lifted out of resolveTurn in plan P1-08g), fast-check seeded
// from KC_SEED, over made-up commanders: their stances, tempers, Melee and hit points, a realm's hero or a local
// chieftain on the defending side, the real record or the battle's pooled copy of it:
//   • each host's morale is 1 or 0.8 (−20%), never both 0.8: only one commander can refuse, fall or run, and an
//     inconclusive duel shakes neither; each 0.8 is told once ("…'s force is demoralised"); at most one commander is
//     slain, his host is shaken, and his real record is dead;
//   • nobody rides out when neither commander challenges, or against a commander already dead: both hosts keep their
//     morale and the battle report gets no line;
//   • a bot realm's commander never fights a duel with a local chieftain (Toby, 2026-09-28): he refuses the
//     chieftain's challenge, and his host takes the usual −20% for it.
// Level 1 (unit): preBattleDuel called directly in the bare vm (tests/lib/engine.ts), on a fresh turn's context for
// each input (a duel can kill, and a death changes the world). The matrix runs it about 7,600 times a set; these say
// what holds for any input, not only the matrix's games.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Properties (fast-check, P1-08g) of the duel before a battle (`preBattleDuel`), over made-up commanders (stance,
// temper, Melee, hit points; a realm's hero or a local chieftain defending; the real record or the battle's pooled
// copy): each host's morale is 1 or 0.8 and never both 0.8, each shaken host is told once, at most one commander is
// slain and he is the one whose record died; nobody rides out when neither challenges or against a commander already
// dead (no line, the world unchanged); a bot realm's commander never duels a local chieftain, and his host is shaken
// when he refuses one (Toby, 2026-09-28). Called directly in the bare `vm` on a fresh context for each input; it reads
// the narrative's words (`theWordsOf` on a fact: the duel's lines record facts since P1-12c5)
import fc from 'fast-check';
import { expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext, type TurnContext } from '../lib/engine.ts';
import { timeLimitForPropertyRuns } from '../lib/time-limits.ts';

interface Character {
  id: number | string;
  name: string;
  player: number | null;
  alive: boolean;
  hp: number;
  maxHp: number;
  temper?: string;
  skills: Record<string, number>;
  encounterPlan?: Record<string, unknown>;
  [key: string]: unknown;
}
interface Duel {
  atkMorale: number;
  defMorale: number;
  atkSlain?: boolean;
  defSlain?: boolean;
}

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const WORLD = botWorld(engine, 2, { cols: 10, rows: 6 }, { seaPct: 20 });
const preBattleDuel = engineFn(engine, 'preBattleDuel') as (
  t: TurnContext,
  atk: Character,
  def: Character,
  narrative: unknown[],
) => Duel;

const STANCES = ['challenge', 'accept', 'refuse'] as const;
const TEMPERS = ['Berserk', 'Brave', 'Cautious', 'Cowardly'] as const;
const side = fc.record({
  stance: fc.constantFrom(...STANCES),
  temper: fc.constantFrom(...TEMPERS),
  melee: fc.nat(9),
  hpShare: fc.double({ min: 0.1, max: 1, noNaN: true }),
  pooledCopy: fc.boolean(),
});
type Side = typeof side extends fc.Arbitrary<infer T> ? T : never;

/** A fresh turn's context in the second phase, and the two commanders of realms 0 and 1 (the defender a local chieftain
 *  if `chieftain`), staged from `a` and `d`. A pooled copy is what a battle fights with: `{...record}`. */
function stage(a: Side, d: Side, { chieftain = false, botRealm }: { chieftain?: boolean; botRealm?: number } = {}) {
  const tc = turnContext(engine, WORLD);
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  if (botRealm != null) tc['_botPlayerIdx'] = new Set([botRealm]);
  const characters = tc.G['characters'] as Character[];
  const records = [0, 1].map((p) => characters.find((c) => c.alive && c.player === p));
  const [atkRecord, defRecord] = records;
  if (!atkRecord || !defRecord) throw new Error('the world has no living hero in realm 0 or 1');
  const shape = (c: Character, s: Side) => {
    c.temper = s.temper;
    c.skills = { ...c.skills, melee: s.melee };
    c.hp = Math.max(1, Math.round(c.maxHp * s.hpShare));
    c.encounterPlan = { duelStance: s.stance };
  };
  shape(atkRecord, a);
  shape(defRecord, d);
  if (chieftain) {
    defRecord.player = null;
    defRecord['_isNeutralGuard'] = true;
    delete defRecord.encounterPlan; // a chieftain has no orders: his Temper decides
  }
  const atk = a.pooledCopy ? { ...atkRecord } : atkRecord;
  const def = d.pooledCopy ? { ...defRecord } : defRecord;
  return { tc, atk, def, atkRecord, defRecord };
}
/** A narrative's words: a line is its words, or a fact whose words the views write (theWordsOf, src/views/prose/). */
const theWordsOf = engineFn(engine, 'theWordsOf') as (fact: unknown) => string;
const wordsOf = (narrative: unknown[]) => narrative.map((l) => (typeof l === 'string' ? l : theWordsOf(l)));
const shaken = (narrative: unknown[]) => wordsOf(narrative).filter((l) => /'s force is demoralised — /.test(l)).length;
const duelFought = (narrative: unknown[]) => wordsOf(narrative).some((l) => l.startsWith('⚔ — Personal duel: '));

test('one host at most loses heart, each shaken host is told once, and a slain commander is dead', () => {
  const seen = { duels: 0, slain: 0, shaken: 0 };
  fc.assert(
    fc.property(side, side, fc.boolean(), (a, d, chieftain) => {
      const { tc, atk, def, atkRecord, defRecord } = stage(a, d, { chieftain });
      const narrative: unknown[] = [];
      const r = preBattleDuel(tc, atk, def, narrative);
      expect([1, 0.8]).toContain(r.atkMorale);
      expect([1, 0.8]).toContain(r.defMorale);
      expect(r.atkMorale === 0.8 && r.defMorale === 0.8).toBe(false);
      expect(shaken(narrative)).toBe((r.atkMorale === 0.8 ? 1 : 0) + (r.defMorale === 0.8 ? 1 : 0));
      expect(Boolean(r.atkSlain) && Boolean(r.defSlain)).toBe(false);
      const slain = [
        ...(r.atkSlain ? [[r.atkMorale, atkRecord.alive, atk.alive]] : []),
        ...(r.defSlain ? [[r.defMorale, defRecord.alive, def.alive]] : []),
      ];
      expect(slain).toEqual(slain.map(() => [0.8, false, false]));
      // and a commander whose record died in the duel is the one reported slain (both rode in alive)
      expect([!atkRecord.alive, !defRecord.alive]).toEqual([Boolean(r.atkSlain), Boolean(r.defSlain)]);
      seen.duels += duelFought(narrative) ? 1 : 0;
      seen.slain += slain.length;
      seen.shaken += shaken(narrative);
    }),
  );
  // the inputs reached the duel itself, not only the early returns (about two in five fight one, and most duels kill)
  expect(seen.duels).toBeGreaterThan(0);
  expect(seen.shaken).toBeGreaterThan(0);
  expect(seen.slain).toBeGreaterThan(0);
});

// fast-check's run count (tests/setup/fast-check.ts): 100, or 1,000 under KC_FULL. This property's time limit is 50 ms
// an input, so npm test's 100 keep Vitest's 5 s and KC_FULL's 1,000 get 50 s. An input stages a fresh turn and writes the
// world out twice: 1.6 ms on a laptop, 5.4 ms in CI's unit job, and over 5.1 ms on the nightly run (1,000 timed out at
// 5 s, run 40176607802: tests/lib/time-limits.ts).
const RUNS = fc.readConfigureGlobal().numRuns ?? 100;

test(
  'nobody rides out when neither commander challenges, or against a commander already dead',
  timeLimitForPropertyRuns(RUNS, 50),
  () => {
    const notChallenging = side.filter((s) => s.stance !== 'challenge');
    fc.assert(
      fc.property(
        fc.oneof(
          fc.tuple(notChallenging, notChallenging, fc.constant('none')),
          fc.tuple(side, side, fc.constantFrom('attacker', 'defender')),
        ),
        ([a, d, dead]) => {
          const { tc, atk, def, atkRecord, defRecord } = stage(a, d);
          if (dead === 'attacker') atkRecord.alive = atk.alive = false;
          if (dead === 'defender') defRecord.alive = def.alive = false;
          const world = JSON.stringify(tc.G);
          const narrative: unknown[] = [];
          const r = preBattleDuel(tc, atk, def, narrative);
          expect([r.atkMorale, r.defMorale, narrative.length]).toEqual([1, 1, 0]);
          expect(JSON.stringify(tc.G)).toBe(world);
        },
      ),
    );
  },
);

test("a bot realm's commander never duels a local chieftain, and his host is shaken when he refuses one", () => {
  fc.assert(
    fc.property(side, side, fc.boolean(), (a, d, botAttacks) => {
      // the bot's commander attacks the chieftain's province, or (the sides swapped) the chieftain attacks him
      const { tc, atk, def } = stage(a, d, { chieftain: true, botRealm: 0 });
      const [bot, chief] = [atk, def];
      const narrative: unknown[] = [];
      const r = botAttacks ? preBattleDuel(tc, bot, chief, narrative) : preBattleDuel(tc, chief, bot, narrative);
      const botMorale = botAttacks ? r.atkMorale : r.defMorale;
      const chiefMorale = botAttacks ? r.defMorale : r.atkMorale;
      expect(duelFought(narrative)).toBe(false);
      const chiefChallenges = d.temper === 'Berserk' || d.temper === 'Brave';
      expect([botMorale, chiefMorale]).toEqual([chiefChallenges ? 0.8 : 1, 1]);
    }),
  );
});
