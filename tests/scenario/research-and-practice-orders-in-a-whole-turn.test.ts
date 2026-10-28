// The research and practice orders in a whole turn (plan P1-08j4, the fourth family of processOrder's orders taken
// out of it): Research, Practice Skill, Rest and Research Breakthrough. Each case of
// lib/research-and-practice-order-cases.ts staged on the middle of a bot world, from plain realms (`stageCase`), and
// played through resolveTurn, every realm human-held, every other hero Resting. Level 2 (scenario): the order is read,
// checked (a mastery once a turn) and carried out inside resolveTurn, Practice compares each hero with the skills
// every comrade had at the start of the phase, and the turn's end tells a hero who did nothing where he stands, so
// only a whole turn plays it as a realm gives it.
// unit/research-and-practice-orders-called-directly.test.ts calls each order's own function on the same cases, and
// on the ones the dice decide. Below the cases, a whole turn moved down from cast-practice-assumed.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Research, Practice Skill, Rest and Research Breakthrough (P1-08j4), played through a whole turn as the Move's are
// (`playTurn`, from plain realms: `stageCase`): each case of `lib/research-and-practice-order-cases.ts`, in game terms,
// never what the dice gave (a case reads the chance a roll was made at, or checks that what the roll decided holds
// together with the line that tells it; a realm that knows every Heroic and Special discovery makes no unlooked-for
// find). Research: refused without Sage; five in a hundred a level, no more past Sage 5; doubled for a Neutral realm;
// Open Archives and Lich Lore (own creed's field only); a hidden field can't be named; a spent field turns to another
// before the roll, and with every field spent (the hidden ones are no field to turn to) there is nothing to research;
// two discoveries to choose between, keyed by the phase, or the last one outright; Perseverance, ×1.2 a failure, reset
// by a find. Practice Skill: naming no skill does nothing; 25 in a hundred alone at level 0, five less a level; Quick
// Learners (a Human of a Human realm: `practice-human`'s checks, moved down); a better comrade at the same drill makes
// the rise certain and names his pupil (a master at 5 too), but not an ally's hero, one elsewhere or at another skill;
// comrades of the same level, half as likely again; 5 is the top; practice discoveries; a wage rise told; Tactical and
// Naval drills and theory alone. Rest: three tenths of his maximum, rounded up, half as much again for a Divine realm,
// never past the maximum; Medical Arts, Healing Hands, the Healers' Guild, Herbcraft, Longhouse Feasts, each only where
// it applies. Research Breakthrough: Sage 7, one discovery outright (the hidden fields too), told when none is left,
// once a turn. Below the cases, `cast-practice-assumed`'s engine part, moved down: a cast refused because the practice
// before it failed spends no slot (the two practice rolls fixed by a wrapper around the top-level
// `resolvePracticeSkillOrder`)
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { board, firstDie, hero, must, order, plan, playTurn, type Line } from '../lib/middle-of-a-bot-world.ts';
import { plainRealms } from '../lib/recruit-hire-and-realm-works-order-cases.ts';
import { RESEARCH_AND_PRACTICE_ORDER_CASES, stageCase } from '../lib/research-and-practice-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(RESEARCH_AND_PRACTICE_ORDER_CASES)('the %s order, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { after, lines } = playTurn(b, Object.fromEntries(s.orders.map(([h, os]) => [h.id, os])));
    const { got, want } = c.check(
      { world: after, lines: lines.filter((l) => l.charId === s.hero.id), all: lines, turn: b.G.turn },
      s,
    );
    expect(got).toEqual(want);
  });
});

// Moved down from cast-practice-assumed (plan P1-14; its hook on the practice roll's line went): a cast assumes every
// Practice order earlier in the turn succeeds, so a cast refused because the practice before it failed is never
// worked and spends no casting slot, and a later practice that succeeds opens the last cast. A White 0 king
// practises (fails), casts (refused), practises (rises to White 1) and casts again, which is worked. The two practice
// rolls are fixed by a wrapper around the top-level resolvePracticeSkillOrder that pins the first die of each call
// (its d100), so this one runs only on the extract's code.
test('a cast refused because a practice failed spends no slot, and a later practice opens it (moved down)', () => {
  const b = board(engine, world, 0);
  plainRealms(b);
  const h = hero(b, { player: 0, at: b.X, king: true, skills: { melee: 2, tactical: 2, march: 1, spy: 0, white: 0 } });
  h['hpEarned'] = Math.max(0, h.maxHp - 15);
  const practiceDice = [0.999, 0];
  const g = engine as unknown as Record<string, unknown>;
  const practise = g['resolvePracticeSkillOrder'] as (...a: unknown[]) => unknown;
  g['resolvePracticeSkillOrder'] = (...a: unknown[]) =>
    firstDie(engine, must(practiceDice.shift(), 'a practice roll'), () => practise(...a));
  let lines: Line[];
  try {
    ({ lines } = playTurn(b, {
      [h.id]: plan(
        order('practice', 'white'),
        order('cast_spell', 'Bless Province', b.X.id),
        order('practice', 'white'),
        order('cast_spell', 'Bless Province', b.X.id),
      ),
    }));
  } finally {
    g['resolvePracticeSkillOrder'] = practise;
  }
  const t = lines
    .filter((l) => l.charId === h.id)
    .map((l) => l.text)
    .join('\n');
  expect({
    refused: /lacks the required White Magic skill/.test(t),
    rose: /practises White Magic and improves to level 1!/.test(t),
    limit: /casting limit/.test(t),
    worked: /casts Bless Province \(White Magic 1\)/.test(t),
    rollsLeft: practiceDice.length,
  }).toEqual({ refused: true, rose: true, limit: false, worked: true, rollsLeft: 0 });
});
