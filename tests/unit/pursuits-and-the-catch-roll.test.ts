// A chase (lifted out of resolveTurn in plan P1-08i3: src/engine/heroes/pursuits-and-the-catch-roll.ts), called directly
// in the bare vm (tests/lib/engine.ts) on the middle of a bot world cleared for each case (tests/lib/middle-of-a-bot-world.ts):
// realms 0 and 1 at war, 0 and 2 allied, 1 and 2 at peace.
// - pursuitCatchChance (a property): 70% + 5% a level of the hunter's Spy − 5% a level of the quarry's, 5–100%, and a
//   quarry of the hunter's own realm is always met.
// - advancePursuit, staged: a chase called off (the quarry dead, hidden or vanished); held over while an armed hunter
//   has a battle on his hands this phase (a property over the three ways he can have one); closing one province a
//   phase along a road, with a point of movement, or stalling with none; at the catch, a mutual pair met once, a
//   missed roll, a rendezvous with a friend, a quarry whose realm is not at war, a battle held over where the quarry
//   has fought or the ground is contested, the chase battle that takes the province (R-083) or leaves it contested,
//   and an unarmed hunter turned away by an armed quarry's sentries, slipping through them, or refused by a king.
// Level 1 (unit): each function is called on a context made in the test; nothing else of the turn runs. The balance
// matrix runs every one of them, but never a rendezvous, a quarry not at war, the chase battle, a closing step with no
// road or no points, or the sentries (V8 block coverage, P1-08i3). Whole turns: scenario/pursuit-one-battle.test.ts.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// A chase (P1-08i3), called directly in the bare `vm` on the middle of a bot world cleared for each case
// (`lib/middle-of-a-bot-world.ts`). The catch roll (`pursuitCatchChance`, a property): 70% + 5% a level of the hunter's
// Spy − 5% a level of the quarry's (each counted to 5), 5–100%, his own realm's quarry always met. `advancePursuit`,
// staged: a chase called off (the quarry dead, gone, veiled or Vanished; a veiled friend is still followed); held over
// while an armed hunter has a battle on his hands this phase (a property over a stalled battle, a field battle and
// contested ground; an unarmed hunter rides on; an earlier phase's battle doesn't hold him); closing one province a
// phase for one point of movement, stalling with none, or with no road; at the catch, a mutual pair met once, a missed
// roll, a friend joined, a realm not at war passed, no battle on a quarry who fought a stalled battle or on contested
// ground, the chase battle that takes the province (R-083) or leaves it contested with its garrison, the quarry's
// companions pinned with him; an unarmed hunter turned away by the sentries, slipping through them, or refused by a
// king. The balance matrix never runs a rendezvous, a quarry not at war, the chase battle, a closing step with no road
// or no points, or the sentries. Of 56 faults planted in the lifted files, 55 turn this file, the next or
// `encounter-seventy` red; the 56th, dropping the catch roll's 5% floor, can't be seen: a Spy counts to 5, so the
// chance never falls below 45%
// Since P1-23e (R-119): a quarry of another realm whose Invisibility holds is beyond catching (a line naming no one);
// a realm that watches him by Clairvoyance, or his own, still follows.
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import {
  allText,
  board,
  hero,
  must,
  points,
  withDice,
  type Board,
  type Character,
  type TurnContext,
  firstDie,
} from '../lib/middle-of-a-bot-world.ts';
import { timeLimitForPropertyRuns } from '../lib/time-limits.ts';

// fast-check's run count (tests/setup/fast-check.ts): 100, or 1,000 under KC_FULL. Each property's time limit is 50
// ms an input, so npm test's 100 keep Vitest's 5 s and KC_FULL's 1,000 get 50 s (tests/lib/time-limits.ts).
const RUNS = fc.readConfigureGlobal().numRuns ?? 100;

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const WORLD = botWorld(engine, 3, { cols: 12, rows: 8 }, { seaPct: 20 });
const PH = 2;
const pursuitCatchChance = engineFn(engine, 'pursuitCatchChance') as (
  tc: TurnContext,
  c: Character,
  quarry: Character,
) => number;
const endPursuit = engineFn(engine, 'endPursuit') as (c: Character) => void;
const advancePursuit = engineFn(engine, 'advancePursuit') as (tc: TurnContext, c: Character, ph: number) => void;

const fresh = () => board(engine, WORLD, PH);
/** Sets `c` on the trail of `quarry`, as an Encounter order given in an earlier phase does. */
const chase = (c: Character, quarry: Character) => {
  c._pursuit = { active: true, targetId: quarry.id, setPhase: PH - 1 };
};
/** Every die the engine draws while `body` runs is `die`: 0.999 makes every roll fail (a d100 of 100), 0 succeed. */
const dice = <T>(die: number, body: () => T) => withDice(engine, [die], body);
const BATTLE = /^⚔ \*\*Battle for /m;
/** Runs `body` with the catch roll (the first die) a certain catch, the rest of the dice as they come. */
const caught = <T>(body: () => T) => firstDie(engine, 0, body);

describe('the catch roll (pursuitCatchChance)', () => {
  test(
    '70% + 5% a level of the hunter’s Spy − 5% a level of the quarry’s (each counted to 5), 5–100%; his own realm’s quarry always met',
    timeLimitForPropertyRuns(RUNS, 50),
    () => {
      fc.assert(
        fc.property(
          fc.nat(9),
          fc.nat(9),
          fc.constantFrom<number | null>(0, 1, 1, 2, null),
          (spy, theirSpy, theirRealm) => {
            const b = fresh();
            const c = hero(b, { player: 0, at: b.X, skills: { spy } });
            const q = hero(b, { player: theirRealm, at: b.X, skills: { spy: theirSpy } });
            // a skill counts to 5 (effStat)
            const want =
              theirRealm === 0
                ? 100
                : Math.max(5, Math.min(100, 70 + 5 * Math.min(5, spy) - 5 * Math.min(5, theirSpy)));
            expect(pursuitCatchChance(b.tc, c, q)).toBe(want);
          },
        ),
      );
    },
  );
});

describe('a chase called off', () => {
  test('no chase, or one already over: nothing happens', () => {
    const b = fresh();
    const c = hero(b, { player: 0, at: b.X, troops: 1 });
    const q = hero(b, { player: 1, at: must(b.ring1[0], 'a neighbour') });
    advancePursuit(b.tc, c, PH);
    chase(c, q);
    endPursuit(c);
    advancePursuit(b.tc, c, PH);
    expect([c.location, b.lines()]).toEqual([b.X.id, []]);
  });

  const ends = (stage: (b: Board, q: Character) => void, said: RegExp, realm = 1) => {
    const b = fresh();
    const c = hero(b, { player: 0, at: b.X, troops: 1 });
    const q = hero(b, { player: realm, at: must(b.ring1[0], 'a neighbour'), troops: 1 });
    chase(c, q);
    stage(b, q);
    advancePursuit(b.tc, c, PH);
    return { b, c, q, said: said.test(allText(b)) };
  };
  test('the quarry is dead, or gone from the world: the chase is called off', () => {
    for (const stage of [
      (_b: Board, q: Character) => {
        q.alive = false;
      },
      (b: Board, q: Character) => {
        b.G.characters = b.G.characters.filter((x) => x !== q);
      },
    ]) {
      const r = ends(stage, /quarry is beyond catching now — the chase is called off/);
      expect([r.said, r.c._pursuit?.active, r.c.location]).toEqual([true, false, r.b.X.id]);
    }
  });
  test('a veiled quarry of another realm leaves no trail; one of his own realm is still followed', () => {
    const veil = (b: Board, q: Character) => Object.assign(q, { _veilTurn: b.G.turn, _veilCastPhase: PH });
    const lost = ends(veil, /loses it utterly/);
    expect([lost.said, lost.c._pursuit?.active, lost.c.location]).toEqual([true, false, lost.b.X.id]);
    const friend = ends(veil, /loses it utterly/, 0);
    expect([friend.said, friend.c.location]).toEqual([false, friend.q.location]);
  });
  test('a quarry of another realm whose Invisibility holds is beyond catching, a line that names no one (R-119); a realm that watches him by Clairvoyance, or his own, still follows', () => {
    const invisible = (b: Board, q: Character) => Object.assign(q, { _invisTurn: b.G.turn });
    const beyond = /quarry is beyond catching now — the chase is called off/;
    const lost = ends(invisible, beyond);
    expect([lost.said, lost.c._pursuit?.active, lost.c.location, allText(lost.b).includes(lost.q.name)]).toEqual([
      true,
      false,
      lost.b.X.id,
      false,
    ]);
    const watched = (b: Board, q: Character) => {
      invisible(b, q);
      must(b.G.players[0], 'realm 0')['_clairCharThisTurn'] = q.id;
    };
    for (const [stage, realm] of [
      [watched, 1],
      [invisible, 0],
    ] as const) {
      const r = dice(0.999, () => ends(stage, beyond, realm));
      expect([r.said, r.c._pursuit?.active, r.c.location]).toEqual([false, realm === 1, r.q.location]);
    }
  });
  test('a quarry who has Vanished this turn melts into the shadows', () => {
    const r = ends((b, q) => Object.assign(q, { _vanishTurn: b.G.turn }), /melts into the shadows and is gone/);
    expect([r.said, r.c._pursuit?.active, r.c.location]).toEqual([true, false, r.b.X.id]);
  });
});

describe('one battle per phase binds a chase under way', () => {
  test(
    'an armed hunter with a battle on his hands this phase holds the chase over; an unarmed one rides on',
    timeLimitForPropertyRuns(RUNS, 50),
    () => {
      const seen = { held: 0, rode: 0 };
      fc.assert(
        fc.property(fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean(), (armed, stalled, field, contested) => {
          const b = fresh();
          const c = hero(b, { player: 0, at: b.X, troops: armed ? 2 : 0 });
          const q = hero(b, { player: 1, at: must(b.ring2[0], 'two provinces away') });
          chase(c, q);
          if (stalled) c._foughtStalledBattlePhase = PH;
          if (field) (b.tc['fieldBattlePhase'] as Record<number, number>)[c.id] = PH;
          if (contested) b.X._battleUnresolved = true;
          dice(0.999, () => {
            advancePursuit(b.tc, c, PH);
          });
          const held = armed && (stalled || field || contested);
          const waited = /has a battle on their hands in .* this season — the chase after .* must wait/.test(
            allText(b),
          );
          expect([waited, c.location === b.X.id, c._pursuit?.active, points(b, c).land]).toEqual(
            held ? [true, true, true, 1] : [false, false, true, 0],
          );
          seen[held ? 'held' : 'rode']++;
        }),
      );
      expect(seen.held).toBeGreaterThan(0);
      expect(seen.rode).toBeGreaterThan(0);
    },
  );
  test('an earlier phase’s battle does not hold him', () => {
    const b = fresh();
    const c = hero(b, { player: 0, at: b.X, troops: 2 });
    const q = hero(b, { player: 1, at: must(b.ring2[0], 'two provinces away') });
    chase(c, q);
    c._foughtStalledBattlePhase = PH - 1;
    (b.tc['fieldBattlePhase'] as Record<number, number>)[c.id] = PH - 1;
    dice(0.999, () => {
      advancePursuit(b.tc, c, PH);
    });
    expect(c.location).not.toBe(b.X.id);
  });
});

describe('closing on the quarry', () => {
  test(
    'one province a phase along the road, for one point of movement; with none left the chase stalls',
    timeLimitForPropertyRuns(RUNS, 50),
    () => {
      fc.assert(
        fc.property(fc.nat(2), fc.nat(17), fc.boolean(), (land, slot, armed) => {
          const b = fresh();
          const c = hero(b, { player: 0, at: b.X, troops: armed ? 1 : 0, land });
          const far = must(b.ring2[slot % b.ring2.length], 'two provinces away');
          const q = hero(b, { player: 1, at: far });
          chase(c, q);
          dice(0.999, () => {
            advancePursuit(b.tc, c, PH);
          });
          const text = allText(b);
          const step = must(b.G.world.provinces[c.location], 'where he is');
          const got = {
            at:
              c.location === b.X.id
                ? 'stayed'
                : b.ring1.includes(step) && b.nbrs(step).includes(far)
                  ? 'closer'
                  : 'astray',
            land: points(b, c).land,
            active: c._pursuit?.active,
            listed: [step.characters.includes(c.id), c.location === b.X.id || !b.X.characters.includes(c.id)],
            seen: step.visitedBy?.includes(0) ?? false,
            said: land
              ? text.includes(`${c.name} presses on into ${step.name}, hard on the trail of ${q.name}.`)
              : /can drive their horses no further this year — the chase after .* stalls/.test(text),
          };
          expect(got).toEqual(
            land
              ? { at: 'closer', land: land - 1, active: true, listed: [true, true], seen: true, said: true }
              : { at: 'stayed', land: 0, active: false, listed: [true, true], seen: false, said: true },
          );
        }),
      );
    },
  );
  test('no road brings him closer: the trail goes cold', () => {
    const b = fresh();
    const c = hero(b, { player: 0, at: b.X, troops: 1 });
    const q = hero(b, { player: 1, at: must(b.ring2[0], 'two provinces away') });
    b.ring1.forEach((p) => {
      p.terrain = 'sea';
    });
    chase(c, q);
    dice(0.999, () => {
      advancePursuit(b.tc, c, PH);
    });
    expect([c.location, c._pursuit?.active]).toEqual([b.X.id, false]);
    expect(allText(b)).toMatch(/can find no road that brings them closer to .* — the trail goes cold/);
  });
  test('reaching the quarry’s province, he finds him there and rolls to run him down', () => {
    const b = fresh();
    const c = hero(b, { player: 0, at: b.X, troops: 1 });
    const A = must(b.ring1[0], 'a neighbour');
    const q = hero(b, { player: 1, at: A });
    chase(c, q);
    dice(0.999, () => {
      advancePursuit(b.tc, c, PH);
    });
    expect(c.location).toBe(A.id);
    expect(allText(b)).toContain(`${c.name} rides into ${A.name} and finds ${q.name} there.`);
    expect(allText(b)).toMatch(/📊 Pursuit — /);
  });
});

describe('the catch', () => {
  /** Hunter and quarry in X; the quarry of `realm`, each leading `troops` companies (the hunter's Elite). */
  const together = (realm: number | null, mine: number, theirs: number) => {
    const b = fresh();
    b.own(b.X, realm === 0 ? 0 : 1);
    const c = hero(b, {
      player: 0,
      at: b.X,
      troops: mine,
      quality: 'Elite',
      skills: { spy: 9, melee: 2, tactical: 2 },
    });
    const q = hero(b, { player: realm, at: b.X, troops: theirs, quality: 'Green', skills: { spy: 0, melee: 1 } });
    chase(c, q);
    return { b, c, q };
  };
  test('a mutual pair, each after the other, meets once: the second chase ends with no roll', () => {
    const { b, c, q } = together(1, 1, 1);
    q._encounteredThisPhase = c.id;
    advancePursuit(b.tc, c, PH);
    expect([c._pursuit?.active, b.lines()]).toEqual([false, []]);
  });
  test('a missed roll: the quarry slips away and the chase stays live', () => {
    const { b, c } = together(1, 1, 1);
    c.skills['spy'] = 0;
    dice(0.999, () => {
      advancePursuit(b.tc, c, PH);
    });
    expect(allText(b)).toMatch(/slips away through the country around .* keeps the trail but cannot close/);
    expect([c._pursuit?.active, allText(b).includes('Battle for')]).toEqual([true, false]);
  });
  test('a quarry of his own realm: the two columns join company', () => {
    const { b, c, q } = together(0, 1, 1);
    advancePursuit(b.tc, c, PH);
    expect(allText(b)).toContain(
      `${c.name} catches up with ${q.name} in ${b.X.name} and the two columns join company.`,
    );
    expect([c._pursuit?.active, BATTLE.test(allText(b))]).toEqual([false, false]);
  });
  test('a quarry whose realm is not at war with his: they pass without bloodshed', () => {
    for (const [mine, theirs] of [
      [0, 2],
      [1, 2],
    ] as const) {
      const b = fresh();
      const c = hero(b, { player: mine, at: b.X, troops: 1, skills: { spy: 9 } });
      const q = hero(b, { player: theirs, at: b.X, troops: 1 });
      chase(c, q);
      dice(0.5, () => {
        advancePursuit(b.tc, c, PH);
      });
      expect(allText(b)).toMatch(/is not at war with .* — the two columns pass without bloodshed/);
      expect([c._pursuit?.active, BATTLE.test(allText(b))]).toEqual([false, false]);
    }
  });
  test('two columns: no battle on a quarry who has fought a stalled or chase battle this phase', () => {
    const { b, c, q } = together(1, 3, 1);
    q._foughtStalledBattlePhase = PH;
    dice(0.5, () => {
      advancePursuit(b.tc, c, PH);
    });
    expect(allText(b)).toMatch(/but the ground is already a battlefield this season — the reckoning must wait/);
    expect([c._pursuit?.active, BATTLE.test(allText(b))]).toEqual([true, false]);
  });
  test('two columns: riding into a province whose battle is still being fought, he waits there', () => {
    const b = fresh();
    b.own(b.X, 1);
    const A = must(b.ring1[0], 'a neighbour');
    const c = hero(b, { player: 0, at: A, troops: 3, skills: { spy: 9 } });
    const q = hero(b, { player: 1, at: b.X, troops: 1 });
    chase(c, q);
    b.X._battleUnresolved = true;
    dice(0.5, () => {
      advancePursuit(b.tc, c, PH);
    });
    expect(c.location).toBe(b.X.id);
    expect(allText(b)).toMatch(/but the ground is already a battlefield this season — the reckoning must wait/);
    expect([c._pursuit?.active, BATTLE.test(allText(b))]).toEqual([true, false]);
  });
  test('the chase battle: the hunter runs the quarry to ground; won, with nothing hostile left, it takes the province (R-083)', () => {
    const { b, c, q } = together(1, 12, 1);
    b.own(must(b.ring1[0], 'a neighbour'), 1); // the beaten quarry falls back there and leaves the ground
    caught(() => {
      advancePursuit(b.tc, c, PH);
    });
    const text = allText(b);
    expect(text).toContain(`⚔ ${c.name} runs ${q.name} to ground in ${b.X.name} and forces battle!`);
    expect(BATTLE.test(text)).toBe(true);
    expect([c._foughtStalledBattlePhase, q._foughtStalledBattlePhase, b.X._hadBattleThisTurn]).toEqual([PH, PH, true]);
    expect([c._pursuit?.active, c._encounteredThisPhase, q._encounteredThisPhase]).toEqual([false, q.id, c.id]);
    expect(text).toContain(`${c.name}'s forces defeat`);
    expect([b.X.owner, b.G.players[0]?.provinces.includes(b.X.id), b.G.players[1]?.provinces.includes(b.X.id)]).toEqual(
      [0, true, false],
    );
    expect(text).toMatch(new RegExp(`${c.name} claims ${b.X.name} for `));
    expect(c.armies.length).toBeGreaterThan(0);
  });
  test('the chase battle won, but the province’s own garrison still holds it: it stays contested', () => {
    const { b, c } = together(1, 12, 1);
    b.own(must(b.ring1[0], 'a neighbour'), 1); // somewhere for the beaten quarry to fall back to
    b.X.garrisonArmies = [{ type: 'Shieldwall Levies', quality: 'Green', race: 'Human', unitName: 'the Gate Watch' }];
    caught(() => {
      advancePursuit(b.tc, c, PH);
    });
    expect(allText(b)).toContain(`${c.name}'s forces defeat`);
    expect(allText(b)).toMatch(/but its garrison still holds the province — the fight for it resumes next season/);
    expect([b.X.owner, b.X._battleUnresolved]).toEqual([1, true]);
  });
  test('the quarry’s companions in the province stand with him, and their battle for the phase is spent too', () => {
    const { b, c, q } = together(1, 12, 1);
    const friend = hero(b, { player: 1, at: b.X, troops: 1, quality: 'Green' });
    caught(() => {
      advancePursuit(b.tc, c, PH);
    });
    expect(friend._foughtStalledBattlePhase).toBe(PH);
    expect(q._foughtStalledBattlePhase).toBe(PH);
  });
});

describe('an unarmed hunter and an armed quarry', () => {
  const stage = (king = false, mutual = false) => {
    const b = fresh();
    const c = hero(b, { player: 0, at: b.X, troops: 0, skills: { spy: 9, melee: 3 } });
    const q = hero(b, { player: 1, at: b.X, troops: king ? 0 : 3, king, skills: { spy: 0, melee: 1, tactical: 0 } });
    chase(c, q);
    if (mutual) b.G.turnOrders[q.id] = [null, null, { action: 'encounter', target: String(c.id) }, null, null];
    return { b, c, q };
  };
  test('the sentries turn him away: the chase ends and the quarry’s realm is told who came', () => {
    const { b, c, q } = stage();
    withDice(engine, [0, 0.999], () => {
      advancePursuit(b.tc, c, PH);
    });
    const text = allText(b);
    expect(text).toMatch(/📊 Breaking ranks — /);
    expect(text).toMatch(/the challenger is turned away from the lines before reaching the commander/);
    expect(c._pursuit?.active).toBe(false);
    expect(b.lines().some((l) => (l.targets ?? []).includes(1) && l.text.includes(`came for ${q.name}`))).toBe(true);
    expect(text).not.toMatch(/finally corners/);
  });
  test('he slips through the picket lines and the two meet in a duel', () => {
    const { b, c } = stage();
    dice(0, () => {
      advancePursuit(b.tc, c, PH);
    });
    expect(allText(b)).toMatch(/slips through the picket lines of .* column/);
    expect(allText(b)).toMatch(/finally corners/);
    expect(c._pursuit?.active).toBe(false);
  });
  test('a king does not answer a commoner’s challenge, unless he set out after the same man himself', () => {
    const refused = stage(true);
    dice(0, () => {
      advancePursuit(refused.b.tc, refused.c, PH);
    });
    expect(allText(refused.b)).toMatch(/a crowned head does not stoop to answer every challenge — the King rides on/);
    expect(allText(refused.b)).not.toMatch(/finally corners/);
    const met = stage(true, true);
    dice(0, () => {
      advancePursuit(met.b.tc, met.c, PH);
    });
    expect(allText(met.b)).toMatch(/finally corners/);
    expect([refused.c._pursuit?.active, met.c._pursuit?.active]).toEqual([false, false]);
  });
});
