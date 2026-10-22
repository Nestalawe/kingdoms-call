// emit, the one door into the GM's log (src/engine/turn/events-and-their-audiences.ts; plan P1-12, Decisions 2 to 5),
// writes exactly the lines the code before it wrote, so nothing stored changes in P1-12a and P1-12b:
// - The oracle (properties, fast-check), against the copies in tests/lib/how-lines-were-written-before-emit.ts: for any
//   meta and any state of the turn's context (the hero and phase of the order resolving, the phase resolving, the
//   phases over or not), log() (now eventOfALogCall and emit) writes the line the old log() wrote, key for key and in
//   the same order; so do logSplit (its public twin in the bare form, with notFor), notifyProvinceOwner (the bare form,
//   no hero, no End of Turn's 99) and writeDeferredSkillLines (each held line placed after its battle); and (P1-12a3)
//   emitNarrLine, handed the fight's event where it was handed a log() meta, and emitBattle (each line of a battle
//   numbered, with its tier, the losses tally where the casualties begin, the summary last). Kept until P1-12a4
//   deletes log(), then its oracle half goes with the copies.
// - emit's own forms: a 'bare' line has no battle fields; `except` adds notFor last; hero 'none' and phase 'none' are a
//   real null where log()'s fallbacks would have filled one in; narrate and narrateTo add a line for everyone in the
//   fight, or one for one realm alone that emitNarrLine files to that realm under its hero.
// (The lines a capture writes, which went straight into turnLog before: tests/unit/a-capture-tells-the-realm-that-lost-
// it-with-no-hero-and-no-phase.test.ts.)
// Level 1 (unit): each function is called on a context made in the test; nothing else of the turn runs. The balance
// matrix and every realm's report reach only the inputs their games make; the oracle reaches any.
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { emitBattle } from '../../src/engine/battle/battle-report-lines-and-force-markers.ts';
import type { Province } from '../../src/schemas/saved-game-state.ts';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import {
  emit,
  emitNarrLine,
  eventOfALogCall,
  logSplit,
  narrate,
  narrateTo,
  notifyProvinceOwner,
  writeDeferredSkillLines,
  type EventButItsWords,
  type FightLine,
  type NarrativeLine,
} from '../../src/engine/turn/events-and-their-audiences.ts';
import {
  oldEmitBattle,
  oldEmitNarrLine,
  oldLog,
  oldLogSplit,
  oldNotifyProvinceOwner,
  oldWriteDeferredSkillLines,
  type OldBattle,
  type OldContext,
} from '../lib/how-lines-were-written-before-emit.ts';

// emit echoes each line on the console, as log() did: quiet while the tests write lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

/** The state of the turn's context a line's fallbacks read. */
interface ContextState {
  charId: number | null;
  phase: number | null;
  currentPhase: number | null;
  afterPhases: boolean;
}

/** A context made by the engine (createTurnContext), in the state given, with its log already holding `lines`. */
function newContext(state: ContextState, lines: Record<string, unknown>[] = []): TurnContext {
  const tc = createTurnContext({ turn: 3, players: [], world: { provinces: [] } }, [], 3) as unknown as TurnContext;
  tc._logCtx = { charId: state.charId, phase: state.phase };
  tc._currentPhase = state.currentPhase;
  tc._afterPhases = state.afterPhases;
  tc._battleSeq = 0;
  tc.turnLog.push(...(structuredClone(lines) as unknown as TurnContext['turnLog']));
  return tc;
}

/** The same, for the old code's copies. */
function oldContext(state: ContextState, lines: Record<string, unknown>[] = []): OldContext {
  return {
    turnLog: structuredClone(lines),
    _battleSeq: 0,
    _logCtx: { charId: state.charId, phase: state.phase },
    _currentPhase: state.currentPhase,
    _afterPhases: state.afterPhases,
  };
}

/** A log's lines, each with its keys in order: two logs are the same if these are strictly equal. */
const withKeys = (lines: readonly object[]) => lines.map((l) => [l, Object.keys(l)]);

/** The place of a line (the event but its type and text) a log() meta made: what P1-12a4's callers of logSplit and of
 *  the held-back skill rises now hand over, each key mapped as log() mapped it. */
function placeOf(type: string, m: Parameters<typeof eventOfALogCall>[2]): EventButItsWords {
  const { type: _type, text: _text, ...place } = eventOfALogCall(type, '', m);
  return place;
}

const realm = fc.oneof(fc.integer({ min: -1, max: 5 }), fc.constant(null));
const orNothing = <T>(a: fc.Arbitrary<T>) => fc.oneof(a, fc.constant(undefined), fc.constant(null));
const flag = orNothing(fc.boolean());
const phase = fc.oneof(fc.constantFrom(0, 1, 2, 3, 4, 99), fc.constant(null));
const contextState = fc.record({
  charId: fc.oneof(fc.integer({ min: 0, max: 30 }), fc.constant(null)),
  phase,
  currentPhase: fc.oneof(fc.integer({ min: 0, max: 4 }), fc.constant(null)),
  afterPhases: fc.boolean(),
});
const lineType = fc.constantFrom('system', 'combat', 'move', 'hire', 'explore', 'message');
/** Any meta a caller of log() could pass: every key left out, null, or a value of its kind; and the three log()
 *  dropped. */
const meta = fc.record(
  {
    actor: orNothing(realm),
    targets: orNothing(fc.array(realm, { maxLength: 3 })),
    provinceId: orNothing(fc.integer({ min: 0, max: 40 })),
    public: flag,
    spy: flag,
    system: flag,
    armyEstimate: orNothing(fc.oneof(fc.string(), fc.integer())),
    charId: orNothing(fc.integer({ min: 0, max: 30 })),
    charIds: orNothing(fc.array(fc.integer({ min: 0, max: 30 }), { maxLength: 3 })),
    phase: orNothing(phase),
    pinNotice: flag,
    env: flag,
    battleId: orNothing(fc.integer({ min: 0, max: 9 })),
    bTier: orNothing(fc.constantFrom('k', 'd', 't', 's')),
    gameEnd: flag,
    summary: flag,
    battleDetail: flag,
    gmOnly: flag,
  },
  { requiredKeys: [] },
);

describe('the oracle: emit writes the lines the old code wrote, for any input', () => {
  test('log(type, text, meta)', () => {
    fc.assert(
      fc.property(contextState, lineType, fc.string(), fc.option(meta, { nil: undefined }), (state, type, text, m) => {
        const now = newContext(state);
        const before = oldContext(state);
        now.log(type, text, m as TurnContext['log'] extends (a: string, b: string, c?: infer M) => void ? M : never);
        oldLog(before, type, text, m);
        expect(withKeys(now.turnLog)).toStrictEqual(withKeys(before.turnLog));
      }),
      { numRuns: 2000 },
    );
  });

  test('logSplit: the private line, then its public twin (bare, no hero, notFor last)', () => {
    const alsoNotFor = orNothing(fc.array(realm, { maxLength: 2 }));
    fc.assert(
      fc.property(contextState, lineType, meta, alsoNotFor, (state, type, m, also) => {
        const withAlso = also === undefined ? m : { ...m, alsoNotFor: also };
        const place = placeOf(type, m as Parameters<typeof eventOfALogCall>[2]);
        const now = newContext(state);
        const before = oldContext(state);
        logSplit(
          now,
          type,
          'yours',
          'theirs',
          (also === undefined ? place : { ...place, alsoNotFor: also }) as Parameters<typeof logSplit>[4],
        );
        oldLogSplit(before, type, 'yours', 'theirs', withAlso);
        expect(withKeys(now.turnLog)).toStrictEqual(withKeys(before.turnLog));
      }),
      { numRuns: 1000 },
    );
  });

  test("notifyProvinceOwner: the owner's line (bare, no hero, no End of Turn's 99)", () => {
    const prov = orNothing(fc.record({ id: fc.integer({ min: 0, max: 40 }), owner: realm }));
    fc.assert(
      fc.property(contextState, prov, realm, orNothing(phase), (state, p, caster, ph) => {
        const now = newContext(state);
        const before = oldContext(state);
        notifyProvinceOwner(now, p, 'your land', caster, ph);
        oldNotifyProvinceOwner(before, p, 'your land', caster, ph);
        expect(withKeys(now.turnLog)).toStrictEqual(withKeys(before.turnLog));
      }),
      { numRuns: 1000 },
    );
  });

  test('writeDeferredSkillLines: each held line written, and placed after the last line of its battle', () => {
    // A log of a few lines, some of a battle (in a province, at a phase), and a list of held-back skill rises, some
    // earned in a battle (afterBattleIn).
    const province = fc.integer({ min: 0, max: 2 });
    const smallPhase = fc.oneof(fc.integer({ min: 0, max: 2 }), fc.constant(null));
    const logged = fc.array(
      fc.record({
        type: lineType,
        text: fc.string({ maxLength: 4 }),
        battleId: fc.oneof(fc.integer({ min: 0, max: 3 }), fc.constant(null)),
        provinceId: fc.oneof(province, fc.constant(null)),
        phase: smallPhase,
      }),
      { maxLength: 6 },
    );
    const held = fc.array(
      fc.tuple(
        fc.string({ maxLength: 4 }),
        fc.record(
          {
            actor: realm,
            targets: fc.array(realm, { maxLength: 2 }),
            charId: fc.integer({ min: 0, max: 30 }),
            phase: smallPhase,
            afterBattleIn: fc.option(province, { nil: undefined }),
          },
          { requiredKeys: ['charId'] },
        ),
      ),
      { maxLength: 5 },
    );
    fc.assert(
      fc.property(contextState, logged, held, fc.boolean(), (state, lines, list, inPlace) => {
        const now = newContext(state, lines);
        const before = oldContext(state, lines);
        const places = structuredClone(list).map(
          ([text, m]): [string, EventButItsWords & { afterBattleIn?: number }] => {
            const { afterBattleIn, ...rest } = m;
            return [
              text,
              afterBattleIn === undefined ? placeOf('system', rest) : { ...placeOf('system', rest), afterBattleIn },
            ];
          },
        );
        writeDeferredSkillLines(now, places, inPlace);
        oldWriteDeferredSkillLines(before, structuredClone(list), inPlace);
        expect(withKeys(now.turnLog)).toStrictEqual(withKeys(before.turnLog));
      }),
      { numRuns: 1000 },
    );
  });
});

describe("the oracle: a fight's narrative is written out as before, for any input", () => {
  /** A line of a fight's narrative: for everyone, or (an object) for one realm alone, under its hero or not. */
  const narrativeLine = (text: fc.Arbitrary<string>): fc.Arbitrary<NarrativeLine> =>
    fc.oneof(
      text,
      fc.record({ text }),
      fc.record(
        {
          text,
          onlyPlayer: fc.oneof(fc.integer({ min: 0, max: 5 }), fc.constant(null)),
          charId: orNothing(fc.integer({ min: 0, max: 30 })),
        },
        { requiredKeys: ['text', 'onlyPlayer'] },
      ),
    );

  test("emitNarrLine(line, fight): handed the fight's event where it was handed a log() meta", () => {
    fc.assert(
      fc.property(
        contextState,
        lineType,
        narrativeLine(fc.string()),
        fc.option(meta, { nil: undefined }),
        (state, type, line, m) => {
          const now = newContext(state);
          const before = oldContext(state);
          const fight: FightLine = eventOfALogCall(type, '', (m ?? {}) as Parameters<typeof eventOfALogCall>[2]);
          emitNarrLine(now, line, fight);
          oldEmitNarrLine(before, type, line, m);
          expect(withKeys(now.turnLog)).toStrictEqual(withKeys(before.turnLog));
        },
      ),
      { numRuns: 2000 },
    );
  });

  test('emitBattle: every line numbered, with its tier and its audience; the losses tally; the summary', () => {
    // Lines from a battle's own vocabulary, so the tiers, the casualty sections and the tally all turn up.
    const battleText = fc.constantFrom(
      '⚔ — Battle for Wendmeadow —',
      '⚑FORCE⚑{"role":"attacker","armies":[{"type":"Swordsmen","unitName":"the Red Hand"}]}',
      '⚑FORCE⚑{"role":"defender","armies":[{"type":"Archers"}]}',
      "⚔ **Aldric's forces** (attacker):",
      "🛡 **Mora's forces** (defender):",
      "— Aldric's the Red Hand (Swordsmen) are cut down.",
      "— Mora's Archers lost heart in defeat, reduced to Green.",
      '— None left to fight: every defending unit was lost before the lines closed.',
      '  Fortune of battle favours the bold.',
      '  a volley falls short',
      '📊 **Battle stats:**',
      "📊 Mora's forces are completely destroyed — they retreat alone.",
      '🏹 Archers loose first.',
      'The hosts close.',
      '',
    );
    const realmOrNothing = fc.oneof(fc.integer({ min: 0, max: 5 }), fc.constant(null), fc.constant(undefined));
    const battle: fc.Arbitrary<OldBattle> = fc.record({
      battle: fc.oneof(
        fc.record(
          {
            narrative: fc.array(narrativeLine(battleText), { maxLength: 12 }),
            summaryText: fc.option(battleText, { nil: undefined }),
          },
          { requiredKeys: [] },
        ),
        fc.constant(null),
        fc.constant(undefined),
      ),
      prov: fc.oneof(fc.record({ id: fc.integer({ min: 0, max: 40 }) }), fc.constant(null), fc.constant(undefined)),
      ph: fc.oneof(fc.integer({ min: 0, max: 4 }), fc.constant(null), fc.constant(undefined)),
      participants: fc.oneof(fc.array(realmOrNothing, { maxLength: 3 }), fc.constant(null), fc.constant(undefined)),
      opts: fc.oneof(
        fc.record(
          {
            actor: realmOrNothing,
            charId: orNothing(fc.integer({ min: 0, max: 30 })),
            charIds: orNothing(fc.array(fc.integer({ min: 0, max: 30 }), { maxLength: 3 })),
            summaryText: fc.option(battleText, { nil: undefined }),
          },
          { requiredKeys: [] },
        ),
        fc.constant(null),
        fc.constant(undefined),
      ),
    });
    fc.assert(
      fc.property(contextState, fc.array(battle, { minLength: 1, maxLength: 2 }), (state, battles) => {
        const now = newContext(state);
        const before = oldContext(state);
        for (const b of structuredClone(battles))
          emitBattle(
            now,
            b.battle as Parameters<typeof emitBattle>[1],
            b.prov as Province | null | undefined,
            b.ph,
            b.participants,
            b.opts,
          );
        for (const b of structuredClone(battles)) oldEmitBattle(before, b);
        expect(withKeys(now.turnLog)).toStrictEqual(withKeys(before.turnLog));
        expect(now._battleSeq).toBe(before._battleSeq);
      }),
      { numRuns: 1000 },
    );
  });
});

describe("emit's forms", () => {
  const state: ContextState = { charId: 7, phase: 2, currentPhase: 2, afterPhases: false };
  const FULL = [
    'type',
    'text',
    'actor',
    'targets',
    'provinceId',
    'public',
    'spy',
    'system',
    'armyEstimate',
    'charId',
    'charIds',
    'phase',
    'pinNotice',
    'env',
    'battleId',
    'bTier',
    'gameEnd',
  ];

  test("a line has log()'s 17 keys; a 'bare' one the first 14; `except` adds notFor last", () => {
    const tc = newContext(state);
    emit(tc, { type: 'system', text: 'a', audience: {} });
    emit(tc, { type: 'system', text: 'b', audience: {}, form: 'bare' });
    emit(tc, { type: 'system', text: 'c', audience: { seen: 'there', except: [1] }, province: 4, form: 'bare' });
    expect(tc.turnLog.map((l) => Object.keys(l))).toEqual([FULL, FULL.slice(0, 14), [...FULL.slice(0, 14), 'notFor']]);
    expect(tc.turnLog[2]).toMatchObject({ public: true, provinceId: 4, notFor: [1], targets: [], actor: null });
  });

  test("an audience grants what the line's fields say: realms told, the actor, seen by any", () => {
    const tc = newContext(state);
    emit(tc, { type: 'move', text: 'a', audience: { realms: [1, 2], actor: 1 } });
    emit(tc, { type: 'move', text: 'b', audience: { seen: 'world' } });
    emit(tc, { type: 'combat', text: 'c', audience: { seen: 'battle' }, province: 3, battle: { id: 2, tier: 'd' } });
    expect(tc.turnLog[0]).toMatchObject({ targets: [1, 2], actor: 1, public: false });
    expect(tc.turnLog[1]).toMatchObject({ targets: [], actor: null, public: true, provinceId: null });
    expect(tc.turnLog[2]).toMatchObject({ public: true, provinceId: 3, battleId: 2, bTier: 'd' });
  });

  test("hero and phase: left out or null, log()'s fallbacks; 'none', a real null", () => {
    const after: ContextState = { charId: 7, phase: null, currentPhase: null, afterPhases: true };
    const tc = newContext(after);
    emit(tc, { type: 'system', text: 'a', audience: {} });
    emit(tc, { type: 'system', text: 'b', audience: {}, hero: null, phase: null });
    emit(tc, { type: 'system', text: 'c', audience: {}, hero: 'none', phase: 'none' });
    emit(tc, { type: 'system', text: 'd', audience: {}, hero: 3, phase: 1 });
    expect(tc.turnLog.map((l) => [l.charId, l.phase])).toEqual([
      [7, 99],
      [7, 99],
      [null, null],
      [3, 1],
    ]);
  });

  test('narrate and narrateTo: a line for everyone in the fight, and one that emitNarrLine files to one realm alone', () => {
    const narrative: NarrativeLine[] = [];
    narrate(narrative, 'The hosts close.');
    narrateTo(narrative, 1, 12, "Aldric's Swordplay rises to 4.");
    expect(narrative).toEqual([
      'The hosts close.',
      { text: "Aldric's Swordplay rises to 4.", onlyPlayer: 1, charId: 12 },
    ]);
    const tc = newContext(state);
    const fight = {
      type: 'combat',
      audience: { actor: 0, realms: [0, 1], seen: 'battle' as const },
      province: 5,
      heroes: [11, 12],
      battle: { id: 1, tier: 'd' },
    };
    narrative.forEach((line) => {
      emitNarrLine(tc, line, fight);
    });
    expect(tc.turnLog[0]).toMatchObject({ targets: [0, 1], actor: 0, public: true, charIds: [11, 12] });
    expect(tc.turnLog[1]).toMatchObject({ targets: [1], actor: null, public: false, charIds: null, charId: 12 });
  });
});
