// A chase held by an unresolved battle (plan P1-15e2b): the case the matrix's scripted games met only by luck, staged
// so it can't miss, and required by every `npm run balance` (run.ts): the held chase in Early Summer in every run, and
// the catch held on a battlefield in Spring in some run.
//
// The scene: three Human realms, realms 0 and 1 at war, 1 and 2 at war, 0 and 2 not. Realm 1's king, the quarry, with
// 12 Elite Heavy Infantry, besieges a province of realm 2's, held by realm 2's king and a hero with one Green Light
// Infantry each; the province is flagged as an unresolved battle, as a siege left from last turn. Every land province
// beside it is realm 0's, so neither side has a road out. Realm 0's king, the hunter, with 4 Veteran Heavy Infantry,
// stands in one of them and sets out after the quarry (Encounter Character) in Spring. No items; Melee 1, Tactical 1,
// Spy 0 for all four; every duel stance "refuse"; every other hero of the three realms unarmed.
//
// Why it can't miss (src/engine/heroes/pursuits-and-the-catch-roll.ts, src/engine/battle/): a stalled battle is fought
// again at the start of each season, by the leaders only, the attacker against the owner's strongest host; the fortune
// of battle moves the edge by at most four times, so a besieger more than four times the stronger wins every round;
// with no duel (every stance "refuse") no commander dies; and while two realms' armed hosts stand there, the province
// stays a battlefield. So in Spring the quarry beats one holder and the other stands: the hunter rides in on a
// battlefield, and if his catch roll succeeds (70%) "the reckoning must wait". Caught or not, his chase stays live, and
// in Early Summer he stands there armed, on ground still fought over: "the chase after … must wait". The catch roll is
// the only die that matters, and it only decides whether Spring's line comes too. A rule change under this (the
// fortune's bound, one leader a side, the flag, no death outside a duel) shows as "could not stage" or as a run that
// misses, never as luck.
import { order, plan, type Turn } from '../../lib/scenario.js';
import {
  atWar,
  companies,
  heroOf,
  measure,
  own,
  place,
  type Hero,
  type Province,
  type Scenario,
  type World,
} from '../../../tools/balance/scenario.ts';
import type { Stats } from '../../../tools/balance/stats.ts';

/** The two holds' lines (advancePursuit), and the seasons they're looked for in: Spring and Early Summer. */
const HELD_ON_THE_CATCH = / the reckoning must wait\./;
const HELD_IN_THE_NEXT_SEASON = / the chase after .* must wait\./;
const SPRING = 0;
const EARLY_SUMMER = 1;
const ON_THE_CATCH = 'chases: waited for a battle | when: on the catch in Spring';
const IN_EARLY_SUMMER = 'chases: waited for a battle | when: in Early Summer';
/** A battle's strength line in the GM log: "  Attacker (…): 12 units — strength **…**". */
const STRENGTH = /^ {2}(Attacker|Defender) \(.*\): \d+ units? — strength \*\*(\d+)\*\*/;

interface Staged {
  hunter: Hero;
  quarry: Hero;
  field: Province;
}
const phaseOf = (e: Turn['log'][number]) => (typeof e.phase === 'number' ? e.phase : null);

/** The staging's own check: Spring's first battle is the siege's round, and the besieger is more than four times the
 *  stronger (the fortune of battle's bound), so he can't lose it. */
function checkTheSiegeIsMoreThanFourToOne(turn: Turn<World, Staged>): void {
  const firstOfEach = new Map<string, number>();
  for (const e of turn.log) {
    if (phaseOf(e) !== SPRING || typeof e.text !== 'string') continue;
    const m = STRENGTH.exec(e.text);
    if (m?.[1] && !firstOfEach.has(m[1])) firstOfEach.set(m[1], Number(m[2]));
  }
  const attacker = firstOfEach.get('Attacker') ?? 0;
  const defender = firstOfEach.get('Defender') ?? 0;
  if (!(defender > 0 && attacker > 4 * defender))
    throw new Error(
      `could not stage: the siege is not more than four to one in Spring (attacker ${String(attacker)}, defender ${String(defender)})`,
    );
}

const scenario: Scenario = {
  title: 'A hero rides after an enemy king locked in a siege that cannot end in Spring (Encounter Character)',
  runs: 20,
  figures: ['chases: waited for a battle', ON_THE_CATCH, IN_EARLY_SUMMER, 'chases: caught'],
  requires: [
    { figure: IN_EARLY_SUMMER, in: 'every run', what: 'the chase held by the battle in Early Summer' },
    { figure: ON_THE_CATCH, in: 'some run', what: 'the catch held on a battlefield in Spring' },
  ],
  async play(sc) {
    const turn = await sc.turn<World, Staged>({
      realms: 3,
      seaPct: 10,
      races: ['Human', 'Human', 'Human'],
      alignments: ['Neutral', 'Neutral', 'Neutral'],
      prepare(S, W) {
        atWar(S, 0, 1);
        atWar(S, 1, 2);
        const land = (p: Province) =>
          (W.getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).filter(
            (q): q is Province => q != null && q.terrain !== 'sea',
          );
        const field = S.world.provinces.find((p) => p.terrain !== 'sea' && land(p).length >= 2);
        const ring = field ? land(field) : [];
        const start = ring[0];
        if (!field || !start) throw new Error('could not stage: no land province with land beside it');
        own(S, field, 2);
        for (const q of ring) own(S, q, 0);
        // Everyone else unarmed: no other host can join a fight or start one.
        for (const c of S.characters) if (c.player != null) c.armies = [];
        const ready = (h: Hero) => {
          h.items = [];
          h.skills = { melee: 1, tactical: 1, spy: 0 };
          h.encounterPlan = { tactics: [], duelStance: 'refuse' };
          const spy = W.effSkillOf(h, 'spy', S.characters);
          if (spy !== 0) throw new Error(`could not stage: Spy 0 counts as ${String(spy)}`);
          return h;
        };
        const king = (pi: number) => {
          const k = S.characters.find((c) => c.alive && c.player === pi && c.isKing);
          if (!k) throw new Error(`could not stage: realm ${String(pi)} has no king`);
          return k;
        };
        const hunter = ready(king(0));
        const quarry = ready(king(1));
        const holders = [ready(king(2)), ready(heroOf(S, 2))];
        place(S, hunter, start);
        place(S, quarry, field);
        for (const h of holders) place(S, h, field);
        hunter.armies = companies('Heavy Infantry', 'Veteran', 4);
        quarry.armies = companies('Heavy Infantry', 'Elite', 12);
        for (const h of holders) h.armies = companies('Light Infantry', 'Green', 1);
        field._battleUnresolved = true;
        return { hunter, quarry, field };
      },
      orders: (_S, x) => ({ [x.hunter.id]: plan(order('encounter', x.quarry.id)) }),
    });
    checkTheSiegeIsMoreThanFourToOne(turn);
    const hunterHeld = (re: RegExp, phase: number) =>
      turn.log.filter(
        (e) =>
          e.charId === turn.extra.hunter.id && phaseOf(e) === phase && typeof e.text === 'string' && re.test(e.text),
      ).length;
    const stats: Stats = measure(turn);
    stats[ON_THE_CATCH] = [hunterHeld(HELD_ON_THE_CATCH, SPRING), 1];
    stats[IN_EARLY_SUMMER] = [hunterHeld(HELD_IN_THE_NEXT_SEASON, EARLY_SUMMER), 1];
    return stats;
  },
};
export default scenario;
