// Stalled battles, a host gained in a province, war fronts, enemy stand-offs and the max-HP resync (lifted out of
// resolveTurn in plan P1-08i3: src/engine/battle/stalled-battles-and-beaten-guards.ts, hosts-gained-in-a-province.ts,
// war-fronts-and-enemy-stand-offs.ts and syncAllMaxHp in heroes/experience-skill-rises-and-earned-hp.ts), called
// directly in the bare vm (tests/lib/engine.ts) on the middle of a bot world cleared for each case
// (tests/lib/middle-of-a-bot-world.ts): realms 0 and 1 at war, 0 and 2 allied, 1 and 2 at peace.
// - erodeGuardSurvivors: each survivor of a beaten guard flees as mercenaries, loses heart and drops a grade (a Green
//   one disbands), or holds, on the dice; each is told once, naming the host that beat them (the checks that were
//   battle-faced-turn's hook part, with fixed dice), and a property: every survivor has exactly one fate.
// - resolveStalledBattles, staged: nothing to resume; a contest between realms now at peace lapses; a veiled host
//   suspends it; a lone host secures unowned or enemy ground but never an ally's; an enemy garrison still to be beaten;
//   two warring hosts fight once each, the invader spending a point; a neutral guard pressed again, and an attacker
//   repelled by it who retreats or is pinned.
// - resolveUnitGainInProvince, staged: nothing to settle; an ally's or a neutral realm's province is not taken; empty
//   ground is taken at once (and remembered when it was a realm's); a host a Defend general would answer waits for
//   the Defend step, once; an enemy garrison is stormed; a leaderless neutral garrison fights on.
// - warFrontThreats and flagEnemyStandoffs (properties): exactly the hosts that stand on enemy ground or beside an enemy
//   host, and exactly the provinces where two warring realms' armed, unveiled forces stand.
// - resolveWarFronts, staged: a host on undefended enemy ground since the turn began takes it at the end of Spring;
//   not where the province was fought over already, or once he has gone; two hosts on ground nobody owns, the stronger
//   attacks; on a third realm's land they fight each other and the owner keeps it.
// - syncAllMaxHp (a property): every living hero's maximum HP is brought in line, each change told once; a second pass
//   finds nothing.
// Level 1 (unit): each function is called on a context made in the test; nothing else of the turn runs. The balance
// matrix runs all of them, but never the war front's battle, a leaderless neutral garrison fighting on, a repelled
// attacker's retreat, a contest between realms at peace, or a lone host on an ally's ground (V8 block coverage,
// P1-08i3).
import vm from 'node:vm';
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
  type Province,
  type TurnContext,
  type Unit,
} from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const WORLD = botWorld(engine, 3, { cols: 12, rows: 8 }, { seaPct: 20 });
const PH = 2;
const erodeGuardSurvivors = engineFn(engine, 'erodeGuardSurvivors') as (
  tc: TurnContext,
  guard: { name: string } | null,
  prov: Province,
  survivors: Unit[],
  emit: (l: string) => void,
  victor?: string,
) => Unit[];
const resolveStalledBattles = engineFn(engine, 'resolveStalledBattles') as (
  tc: TurnContext,
  ph: number,
  onlyProvId?: number,
  freshWar?: boolean,
) => void;
const resolveUnitGainInProvince = engineFn(engine, 'resolveUnitGainInProvince') as (
  tc: TurnContext,
  c: Character,
  prov: Province,
  ph: number,
) => boolean;
const warFrontThreats = engineFn(engine, 'warFrontThreats') as (
  tc: TurnContext,
) => { c: Character; prov: Province; onEnemyLand: boolean; facesEnemyHost: boolean }[];
const flagEnemyStandoffs = engineFn(engine, 'flagEnemyStandoffs') as (
  tc: TurnContext,
  except?: Set<number> | null,
) => void;
const resolveWarFronts = engineFn(engine, 'resolveWarFronts') as (tc: TurnContext, ph: number) => void;
const syncAllMaxHp = engineFn(engine, 'syncAllMaxHp') as (tc: TurnContext) => void;
const computeMaxHp = engineFn(engine, 'computeMaxHp') as (c: Character, players: unknown[]) => number;
const QUALITY_TIERS = vm.runInContext('QUALITY_TIERS', engine) as string[];

const fresh = () => board(engine, WORLD, PH);
/** A die, near the survivors' two chances (35% to flee, 50% to lose heart) as often as anywhere else. */
const DIE = fc.constantFrom(0, 0.2, 0.34, 0.35, 0.4, 0.49, 0.5, 0.7, 0.999);
/** Whether a province's battle is unresolved (read through a call, so a check after a staged flag isn't narrowed). */
const flagged = (p: Province) => p['_battleUnresolved'] === true;
const leaderless = (p: Province) => p['_leaderlessDefenders'] === true;
const units = (type: string, quality: string, names: string[]): Unit[] =>
  names.map((unitName) => ({ type, quality, race: 'Human', unitName }));
const ENEMIES = (a: number | null, b: number | null) =>
  a != null && b != null && a !== b && ((a === 0 && b === 1) || (a === 1 && b === 0));

// ── A beaten guard's survivors ────
describe('a beaten guard’s survivors (erodeGuardSurvivors)', () => {
  const erode = (dice: number[], victor?: string) => {
    const b = fresh();
    const lines: string[] = [];
    const surv = units('Shieldwall Levies', 'Average', ['Levy S1', 'Levy S2']).concat(
      units('Goblin Horde', 'Green', ['Gob S1']),
    );
    const kept = withDice(engine, dice, () =>
      erodeGuardSurvivors(b.tc, { name: 'Ulric (wandering)' }, b.X, surv, (l) => lines.push(l), victor),
    );
    return { b, lines, kept };
  };
  test('fleeing survivors name the victor, and roam as mercenaries', () => {
    const e = erode([0], 'Aldric');
    expect(e.lines).toHaveLength(3);
    for (const l of e.lines)
      expect(l).toMatch(/^— Ulric's .+ break ranks and flee before Aldric's host — they now roam as mercenaries near /);
    expect([e.kept.length, e.b.G.mercenaries?.length]).toEqual([0, 3]);
    expect(e.b.G.mercenaries?.every((m) => m.location === e.b.X.id && m.id.startsWith('merc_'))).toBe(true);
  });
  test('survivors who hold name the victor', () => {
    const e = erode([0.999], 'Aldric');
    expect(e.lines).toHaveLength(3);
    for (const l of e.lines)
      expect(l).toMatch(/^— Ulric's .+ hold their ground unbroken against Aldric's host and rally around Ulric\.$/);
    expect(e.kept).toHaveLength(3);
  });
  test('a demoted survivor names the victor; a Green one that would fall further disbands as before', () => {
    const e = erode([0.999, 0, 0.999, 0, 0.999, 0], 'Aldric');
    expect(e.lines[0]).toMatch(
      /^— Ulric's Levy S1 \(Shieldwall Levies, Average\) lost heart in defeat, reduced to Green — beaten by Aldric's host, they rally around Ulric\.$/,
    );
    expect(e.lines[2]).toMatch(/^— Ulric's Gob S1 \(Goblin Horde\) have had enough — the survivors slip away/);
    expect(e.kept.map((a) => a.unitName)).toEqual(['Levy S1', 'Levy S2']);
  });
  test('with no victor named the old wording stands', () => {
    const e = erode([0]);
    for (const l of e.lines) expect(l).toMatch(/break ranks and flee — they now roam as mercenaries near /);
  });
  test('every survivor has exactly one fate, as the dice say, and is told once', () => {
    const survivor = fc.record({
      quality: fc.constantFrom(...QUALITY_TIERS),
      flee: DIE,
    });
    fc.assert(
      fc.property(fc.array(survivor, { maxLength: 6 }), fc.array(DIE, { minLength: 6, maxLength: 6 }), (ss, demote) => {
        const b = fresh();
        const surv = ss.map((s, i): Unit => ({
          type: 'Men-at-Arms',
          quality: s.quality,
          race: 'Human',
          unitName: `the Band ${String(i)}`,
        }));
        // each survivor draws its flight die, then (if it stays) its heart die
        const dice: number[] = [];
        ss.forEach((s, i) => {
          dice.push(s.flee);
          if (s.flee >= 0.35) dice.push(must(demote[i], 'a die'));
        });
        const lines: string[] = [];
        const kept = withDice(engine, dice.length ? dice : [0.5], () =>
          erodeGuardSurvivors(b.tc, { name: 'Ulric' }, b.X, surv, (l) => lines.push(l), 'Aldric'),
        );
        const fate = ss.map((s, i) =>
          s.flee < 0.35
            ? 'fled'
            : must(demote[i], 'a die') < 0.5
              ? s.quality === QUALITY_TIERS[0]
                ? 'disbanded'
                : 'demoted'
              : 'held',
        );
        expect(lines).toHaveLength(ss.length);
        // a disbanded company's line doesn't name the victor (disbandLine)
        expect(lines.filter((_, i) => fate[i] !== 'disbanded').every((l) => l.includes("Aldric's host"))).toBe(true);
        expect(kept).toEqual(surv.filter((_, i) => fate[i] === 'demoted' || fate[i] === 'held'));
        expect(b.G.mercenaries?.length).toBe(fate.filter((f) => f === 'fled').length);
        expect(surv.map((a) => !!a._disbanded)).toEqual(fate.map((f) => f === 'disbanded'));
        expect(
          surv.map((a, i) => QUALITY_TIERS.indexOf(a.quality) - QUALITY_TIERS.indexOf(must(ss[i], 's').quality)),
        ).toEqual(fate.map((f) => (f === 'demoted' ? -1 : 0)));
      }),
    );
  });
});

// ── Stalled battles ────
describe('a battle left unresolved is fought again (resolveStalledBattles)', () => {
  test('with no province left unresolved nothing happens', () => {
    const b = fresh();
    hero(b, { player: 0, at: b.X, troops: 2 });
    hero(b, { player: 1, at: b.X, troops: 2 });
    const before = JSON.stringify(b.G);
    resolveStalledBattles(b.tc, PH);
    expect([JSON.stringify(b.G), b.lines()]).toEqual([before, []]);
  });
  test('a contest between realms no longer at war lapses, and the two hosts stand down', () => {
    const b = fresh();
    const c = hero(b, { player: 1, at: b.X, troops: 2 });
    const d = hero(b, { player: 2, at: b.X, troops: 2 });
    b.X._battleUnresolved = true;
    resolveStalledBattles(b.tc, PH);
    expect(b.X._battleUnresolved).toBeUndefined();
    expect(allText(b)).toMatch(/The contest for .* lapses — .* are no longer at war, and the two hosts stand down\./);
    expect([c.armies.length, d.armies.length, c._foughtStalledBattlePhase, d._foughtStalledBattlePhase]).toEqual([
      2,
      2,
      undefined,
      undefined,
    ]);
  });
  test('while an armed host there is veiled, the contest is suspended', () => {
    const b = fresh();
    const c = hero(b, { player: 0, at: b.X, troops: 2 });
    hero(b, { player: 1, at: b.X, troops: 2 });
    Object.assign(c, { _veilTurn: b.G.turn, _veilCastPhase: PH });
    b.X._battleUnresolved = true;
    resolveStalledBattles(b.tc, PH);
    expect([b.X._battleUnresolved, b.lines()]).toEqual([true, []]);
  });
  test('a lone host secures ground nobody owns, or his enemy’s, but never an ally’s or a neutral realm’s', () => {
    for (const [owner, takes] of [
      [null, true],
      [1, true],
      [2, false],
    ] as const) {
      const b = fresh();
      b.own(b.X, owner);
      const c = hero(b, { player: 0, at: b.X, troops: 2 });
      b.X._battleUnresolved = true;
      resolveStalledBattles(b.tc, PH);
      expect([b.X.owner, b.G.players[0]?.provinces.includes(b.X.id), b.X._battleUnresolved]).toEqual([
        takes ? 0 : owner,
        takes,
        false,
      ]);
      expect(allText(b).includes(`${c.name} holds ${b.X.name} unopposed and secures it.`)).toBe(takes);
    }
  });
  test('a lone host on enemy ground with its garrison still standing must beat the garrison first', () => {
    const b = fresh();
    b.own(b.X, 1);
    b.X.garrisonArmies = units('Shieldwall Levies', 'Green', ['the Gate Watch']);
    const c = hero(b, { player: 0, at: b.X, troops: 12, quality: 'Elite' });
    b.X._battleUnresolved = true;
    resolveStalledBattles(b.tc, PH);
    expect(allText(b)).not.toContain('unopposed');
    expect(allText(b)).toMatch(/Battle for /);
    expect(b.X._hadBattleThisTurn).toBe(true);
    expect(allText(b)).toContain(`${c.name} overcomes the defenders and claims ${b.X.name}`);
    expect([b.X.owner, b.X.garrisonArmies]).toEqual([0, []]);
  });
  test('two warring hosts: the invader presses the attack, spending a point; each has had his battle for the phase', () => {
    const b = fresh();
    b.own(b.X, 1);
    b.own(must(b.ring1[0], 'a neighbour'), 1); // where the beaten owner falls back
    const c = hero(b, { player: 0, at: b.X, troops: 12, quality: 'Elite', land: 2 });
    const d = hero(b, { player: 1, at: b.X, troops: 1, quality: 'Green', land: 2 });
    b.X._battleUnresolved = true;
    resolveStalledBattles(b.tc, PH);
    const text = allText(b);
    expect(text).toContain(`⚔ The unfinished battle for ${b.X.name} resumes — ${c.name} and ${d.name} clash again.`);
    expect([c._foughtStalledBattlePhase, d._foughtStalledBattlePhase]).toEqual([PH, PH]);
    expect([points(b, c).land, points(b, d).land]).toEqual([1, 2]);
    expect(text).toContain(`${c.name}'s forces defeat`);
    expect(text).toContain(`${c.name} secures ${b.X.name}!`);
    expect([b.X.owner, b.X._battleUnresolved]).toEqual([0, false]);
  });
  test('a neutral guard is pressed again: the attacker spends a point and has had his battle; won ground is his', () => {
    const b = fresh();
    const c = hero(b, { player: 0, at: b.X, troops: 12, quality: 'Elite', land: 1 });
    const g = hero(b, { player: null, at: b.X, troops: 2, quality: 'Green' });
    Object.assign(g, { name: 'Ulric', _isNeutralGuard: true });
    b.X.neutralDefenders = [...g.armies];
    b.X.npcArmies = 2;
    b.X._battleUnresolved = true;
    resolveStalledBattles(b.tc, PH);
    expect(allText(b)).toContain(
      `⚔ The unfinished battle for ${b.X.name} resumes — ${c.name} presses the attack on Ulric.`,
    );
    expect([c._foughtStalledBattlePhase, points(b, c).land]).toEqual([PH, 0]);
    // the guard's survivors may hold on (the dice): then the province is still contested; otherwise it is his. (Once
    // his, it can still be flagged contested for the rest of the phase, when the battle had pinned the guard: found in
    // P1-08i3, parked.)
    expect(b.X.owner === 0 || flagged(b.X)).toBe(true);
    expect(b.X.owner === 0).toBe(
      allText(b).includes(`${c.name} finally overcomes the defenders and claims ${b.X.name}!`),
    );
  });
  test('an attacker the guard throws back retreats to his own ground next door, or with no way out stays pinned', () => {
    for (const way of ['home', 'none'] as const) {
      const b = fresh();
      const A = must(b.ring1[0], 'a neighbour');
      if (way === 'home') b.own(A, 0);
      else
        b.ring1.forEach((p) => {
          b.own(p, 1);
        });
      const c = hero(b, { player: 0, at: b.X, troops: 3, quality: 'Green' });
      const g = hero(b, { player: null, at: b.X, troops: 12, quality: 'Elite' });
      Object.assign(g, { name: 'Ulric', _isNeutralGuard: true });
      b.X.neutralDefenders = [...g.armies];
      b.X._battleUnresolved = true;
      resolveStalledBattles(b.tc, PH);
      const text = allText(b);
      expect(text).toMatch(/forces are repelled!/);
      // a host cut down to the last company has nothing left to move; one that stands has fallen back (in the battle,
      // or breaking off after it) or, with no way out, is pinned there and the battle goes on
      const gone = c.armies.length === 0;
      expect(
        gone ||
          (way === 'home'
            ? c.location === A.id && new RegExp(`retreats? to ${A.name}\\.`).test(text)
            : c.location === b.X.id && flagged(b.X)),
      ).toBe(true);
      expect(b.X.owner).toBe(null);
    }
  });
});

// ── A host gained in a province ────
describe('a host gained in a province (resolveUnitGainInProvince)', () => {
  test('nothing to settle: no realm, his own province, or no troops', () => {
    const b = fresh();
    b.own(b.X, 0);
    const mine = hero(b, { player: 0, at: b.X, troops: 2 });
    const empty = hero(b, { player: 1, at: b.X, troops: 0 });
    const wild = hero(b, { player: null, at: b.X, troops: 2 });
    const before = JSON.stringify(b.G);
    expect([mine, empty, wild].map((c) => resolveUnitGainInProvince(b.tc, c, b.X, PH))).toEqual([false, false, false]);
    expect([JSON.stringify(b.G), b.lines()]).toEqual([before, []]);
  });
  test('in an ally’s or a neutral realm’s province he makes no move against it, and its owner is told', () => {
    for (const [mine, owner, why] of [
      [0, 2, 'your realms are allied'],
      [1, 2, 'your realms are not at war'],
    ] as const) {
      const b = fresh();
      b.own(b.X, owner);
      const c = hero(b, { player: mine, at: b.X, troops: 2 });
      expect(resolveUnitGainInProvince(b.tc, c, b.X, PH)).toBe(false);
      expect(b.X.owner).toBe(owner);
      expect(b.lines().some((l) => (l.targets ?? []).includes(owner) && l.text.includes(why))).toBe(true);
    }
  });
  test('ground with nobody to defend it is taken at once; a realm’s is remembered as taken from it', () => {
    for (const owner of [null, 1] as const) {
      const b = fresh();
      b.own(b.X, owner);
      const c = hero(b, { player: 0, at: b.X, troops: 2 });
      expect(resolveUnitGainInProvince(b.tc, c, b.X, PH)).toBe(false);
      expect([
        b.X.owner,
        b.G.players[0]?.provinces.includes(b.X.id),
        b.G.players[1]?.provinces.includes(b.X.id),
      ]).toEqual([0, true, false]);
      expect(b.X.visitedBy).toContain(0);
      expect(b.X['_takenByUnitGain']).toEqual(owner == null ? undefined : { turn: b.G.turn, ph: PH, from: 1 });
      expect(allText(b)).toContain(`With fresh troops now at their back, ${c.name} takes control of ${b.X.name} for `);
    }
  });
  test('a war front’s host is told that no one stands to defend it', () => {
    const b = fresh();
    b.own(b.X, 1);
    const c = hero(b, { player: 0, at: b.X, troops: 2 });
    c['_warFront'] = true;
    resolveUnitGainInProvince(b.tc, c, b.X, PH);
    expect(allText(b)).toContain(`No one stands to defend ${b.X.name} — ${c.name} takes control of it for `);
  });
  test('while the Defend step is open, a host a Defend general would answer waits for it, queued once', () => {
    const b = fresh();
    b.own(b.X, 1);
    const watcher = hero(b, { player: 1, at: must(b.ring1[0], 'a neighbour'), troops: 2 });
    watcher._defend = { active: true };
    const c = hero(b, { player: 0, at: b.X, troops: 2 });
    b.tc['_tier0Open'] = true;
    expect(resolveUnitGainInProvince(b.tc, c, b.X, PH)).toBe(false);
    expect(resolveUnitGainInProvince(b.tc, c, b.X, PH)).toBe(false);
    const queue = b.tc['_unitGainQueue'] as { c: Character; prov: Province }[];
    expect(queue.map((q) => [q.c.id, q.prov.id])).toEqual([[c.id, b.X.id]]);
    expect([b.X.owner, watcher.location]).toEqual([1, must(b.ring1[0], 'a neighbour').id]);
    expect(allText(b)).toContain(`${c.name}'s new host is still forming up in ${b.X.name}`);
    // with no general to answer, nothing waits
    const b2 = fresh();
    b2.own(b2.X, 1);
    const c2 = hero(b2, { player: 0, at: b2.X, troops: 2 });
    b2.tc['_tier0Open'] = true;
    resolveUnitGainInProvince(b2.tc, c2, b2.X, PH);
    expect([(b2.tc['_unitGainQueue'] as unknown[]).length, b2.X.owner]).toEqual([0, 0]);
  });
  test('an enemy realm’s garrison is stormed: a battle is fought, and won ground is his', () => {
    const b = fresh();
    b.own(b.X, 1);
    b.own(must(b.ring1[0], 'a neighbour'), 1);
    b.X.garrisonArmies = units('Shieldwall Levies', 'Green', ['the Gate Watch']);
    const c = hero(b, { player: 0, at: b.X, troops: 12, quality: 'Elite' });
    expect(resolveUnitGainInProvince(b.tc, c, b.X, PH)).toBe(true);
    expect([b.X._hadBattleThisTurn, c['_resumeBattle'], c['_openingClash']]).toEqual([true, undefined, undefined]);
    expect(allText(b)).toMatch(/Battle for /);
    expect(allText(b)).toContain(`${c.name} overcomes the defenders and claims ${b.X.name} for `);
    expect([b.X.owner, b.X.garrisonArmies]).toEqual([0, []]);
  });
  test('a leaderless neutral garrison fights on: the ground is his, or its survivors still contest it', () => {
    const b = fresh();
    b.X._leaderlessDefenders = true;
    b.X.neutralDefenders = units('Shieldwall Levies', 'Green', ['Levy L1', 'Levy L2']);
    b.X.npcArmies = 2;
    const c = hero(b, { player: 0, at: b.X, troops: 12, quality: 'Elite' });
    expect(resolveUnitGainInProvince(b.tc, c, b.X, PH)).toBe(true);
    expect(allText(b)).toMatch(/Battle for /);
    expect(b.X.owner === 0 || flagged(b.X)).toBe(true);
    expect(b.X.owner === 0).toBe(allText(b).includes(`${c.name} overcomes the defenders and claims ${b.X.name} for `));
    expect(leaderless(b.X)).toBe(b.X.neutralDefenders.length > 0);
    expect(b.X.npcArmies).toBe(b.X.neutralDefenders.length);
  });
});

// ── War fronts and stand-offs ────
const standing = fc.record({
  player: fc.constantFrom<number | null>(0, 0, 1, 1, 2, null),
  where: fc.constantFrom(0, 0, 0, 0, 1, 2, 3, 4, 5, 6), // most of them in X, to meet each other
  troops: fc.constantFrom(0, 1, 2),
  phantom: fc.constantFrom(false, false, false, true),
  veiled: fc.constantFrom(false, false, false, true),
  dead: fc.constantFrom(false, false, false, false, true),
});
const field = fc.record({
  heroes: fc.array(standing, { minLength: 1, maxLength: 8 }),
  owners: fc.array(fc.constantFrom<number | null>(null, 0, 1, 2), { minLength: 7, maxLength: 7 }),
  flagged: fc.array(fc.constantFrom(false, false, false, true), { minLength: 7, maxLength: 7 }),
  except: fc.array(fc.constantFrom(false, false, false, true), { minLength: 7, maxLength: 7 }),
});
type Field = typeof field extends fc.Arbitrary<infer T> ? T : never;
/** Heroes standing about X and its neighbours (seven provinces), some armed, some veiled, some dead. */
function stageField(f: Field) {
  const b = fresh();
  const seven = [b.X, ...b.ring1];
  seven.forEach((p, i) => {
    b.own(p, f.owners[i] ?? null);
    if (f.flagged[i]) p._battleUnresolved = true;
  });
  const hs = f.heroes.map((s) => {
    const c = hero(b, { player: s.player, at: must(seven[s.where % 7], 'a province'), troops: s.troops });
    if (s.phantom) c.armies.forEach((a) => (a['_phantom'] = true));
    if (s.veiled) Object.assign(c, { _veilTurn: b.G.turn, _veilCastPhase: PH });
    if (s.dead) c.alive = false;
    return c;
  });
  return { b, seven, hs };
}
const visible = (c: Character) => c.alive && c['_veilTurn'] == null;
const armedReal = (c: Character) => c.armies.some((a) => !a['_phantom']);

describe('war fronts and enemy stand-offs', () => {
  test('warFrontThreats: exactly the armed, unveiled hosts on enemy-owned ground or beside an armed enemy host', () => {
    fc.assert(
      fc.property(field, (f) => {
        const { b, hs } = stageField(f);
        const want = hs.flatMap((c) => {
          if (!visible(c) || c.player == null || !armedReal(c)) return [];
          const p = must(b.G.world.provinces[c.location], 'his province');
          const onEnemyLand = ENEMIES(c.player, p.owner);
          const facesEnemyHost = hs.some(
            (o) => o !== c && visible(o) && o.location === p.id && armedReal(o) && ENEMIES(c.player, o.player),
          );
          return onEnemyLand || facesEnemyHost ? [{ id: c.id, prov: p.id, onEnemyLand, facesEnemyHost }] : [];
        });
        expect(
          warFrontThreats(b.tc).map((t) => ({
            id: t.c.id,
            prov: t.prov.id,
            onEnemyLand: t.onEnemyLand,
            facesEnemyHost: t.facesEnemyHost,
          })),
        ).toEqual(want);
      }),
    );
  });
  test('flagEnemyStandoffs: a province where two warring realms’ armed, unveiled forces stand is a battle waiting', () => {
    fc.assert(
      fc.property(field, (f) => {
        const { b, seven, hs } = stageField(f);
        const except = new Set(seven.filter((_, i) => f.except[i]).map((p) => p.id));
        const was = seven.map((p) => p._battleUnresolved ?? false);
        flagEnemyStandoffs(b.tc, except);
        const want = seven.map((p, i) => {
          if (was[i]) return true;
          if (except.has(p.id)) return false;
          const here = hs.filter((c) => visible(c) && c.location === p.id && c.armies.length > 0 && c.player != null);
          return here.some((c) => here.some((o) => ENEMIES(c.player, o.player)));
        });
        expect(seven.map((p) => p._battleUnresolved ?? false)).toEqual(want);
      }),
    );
  });

  test('flagEnemyStandoffs: a veiled host stands with an enemy host unseen, and no battle waits', () => {
    for (const veiled of [false, true]) {
      const b = fresh();
      hero(b, { player: 0, at: b.X, troops: 1 });
      const e = hero(b, { player: 1, at: b.X, troops: 1 });
      if (veiled) Object.assign(e, { _veilTurn: b.G.turn, _veilCastPhase: PH });
      flagEnemyStandoffs(b.tc, null);
      expect(flagged(b.X)).toBe(!veiled);
    }
  });
  /** Lists the war fronts as the turn does when it begins (resolveTurn, before the phase loop). */
  const startOfTurn = (b: Board) => {
    const at = b.tc['_warFrontAtStart'] as Map<number, number>;
    const provs = b.tc['_warFrontProvs'] as Set<number>;
    warFrontThreats(b.tc).forEach(({ c, prov }) => {
      if (!prov._battleUnresolved) at.set(c.id, prov.id);
    });
    at.forEach((pid) => provs.add(pid));
  };
  test('with no war front at the turn’s start, nothing happens', () => {
    const b = fresh();
    startOfTurn(b);
    resolveWarFronts(b.tc, 0);
    expect(b.lines()).toEqual([]);
  });
  test('a host standing on undefended enemy ground since the turn began turns on it at the end of Spring', () => {
    const b = fresh();
    b.own(b.X, 1);
    const c = hero(b, { player: 0, at: b.X, troops: 2 });
    startOfTurn(b);
    resolveWarFronts(b.tc, 0);
    const text = allText(b);
    expect(text).toMatch(new RegExp(`^⚔ War stands between .* and ${c.name}`, 'm'));
    expect(text).toContain(`No one stands to defend ${b.X.name} — ${c.name} takes control of it for `);
    expect([b.X.owner, c['_warFront']]).toEqual([0, undefined]);
  });
  test('not where the province has been fought over already, nor once the host has gone', () => {
    for (const stage of [
      (b: Board) => {
        b.X._hadBattleThisTurn = true;
      },
      (b: Board, c: Character) => {
        const A = must(b.ring1[0], 'a neighbour');
        b.X.characters = b.X.characters.filter((id) => id !== c.id);
        A.characters.push(c.id);
        c.location = A.id;
      },
    ]) {
      const b = fresh();
      b.own(b.X, 1);
      const c = hero(b, { player: 0, at: b.X, troops: 2 });
      startOfTurn(b);
      stage(b, c);
      resolveWarFronts(b.tc, 0);
      expect([b.X.owner, allText(b).includes('War stands between')]).toEqual([1, false]);
    }
  });
  test('two warring hosts on ground nobody owns: the stronger turns on the province, and they fight', () => {
    const b = fresh();
    const strong = hero(b, { player: 0, at: b.X, troops: 6, quality: 'Elite' });
    const weak = hero(b, { player: 1, at: b.X, troops: 1, quality: 'Green' });
    startOfTurn(b);
    resolveWarFronts(b.tc, 0);
    const text = allText(b);
    expect(text).toMatch(new RegExp(`^⚔ War stands between .* and ${strong.name}`, 'm'));
    expect(text).not.toMatch(new RegExp(`and ${weak.name}\\S* has held`));
    expect(text).toMatch(/Battle for /);
    expect(b.X._hadBattleThisTurn).toBe(true);
  });
  test('two warring hosts on a third realm’s land fight each other there, as a war front’s first clash', () => {
    const b = fresh();
    b.own(b.X, 2);
    const c = hero(b, { player: 0, at: b.X, troops: 6, quality: 'Elite' });
    const d = hero(b, { player: 1, at: b.X, troops: 1, quality: 'Green' });
    startOfTurn(b);
    resolveWarFronts(b.tc, 0);
    const text = allText(b);
    expect(text).toMatch(/⚔ War has come to .* have stood on the same ground since the season opened/);
    expect([c._foughtStalledBattlePhase, d._foughtStalledBattlePhase]).toEqual([0, 0]);
    // Not checked: who holds the province afterwards. resolveWarFronts' comment says it stays with its owner, but the
    // stalled-battle sweep it calls gives it to the winner when no enemy of his is left, even an ally's or a neutral
    // realm's province (found in P1-08i3, parked: its own PR).
  });
});

// ── The max-HP resync ────
describe('every hero’s maximum HP kept in step (syncAllMaxHp)', () => {
  test('each living hero’s maximum is brought in line and told once; a second pass finds nothing', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            off: fc.integer({ min: -6, max: 6 }),
            hp: fc.nat(40),
            dead: fc.boolean(),
            realm: fc.constantFrom<number | null>(0, 1, null),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        (hs) => {
          const b = fresh();
          const cs = hs.map((h) => {
            const c = hero(b, { player: h.realm, at: b.X });
            const right = computeMaxHp(c, b.G.players);
            c.maxHp = right + h.off;
            c.hp = Math.min(h.hp, c.maxHp);
            if (h.dead) c.alive = false;
            return { c, right, was: { maxHp: c.maxHp, hp: c.hp } };
          });
          syncAllMaxHp(b.tc);
          for (const { c, right, was } of cs) {
            const changed = c.alive && was.maxHp !== right;
            expect(c.maxHp).toBe(c.alive ? right : was.maxHp);
            const told = b.lines().filter((l) => l.text.includes(`${c.name}'s maximum HP`));
            expect(told).toHaveLength(changed ? 1 : 0);
            expect(c.hp).toBe(
              !changed
                ? was.hp
                : right > was.maxHp
                  ? Math.min(right, was.hp + right - was.maxHp)
                  : Math.max(Math.min(1, was.hp), Math.min(was.hp, right)),
            );
          }
          const n = b.lines().length;
          syncAllMaxHp(b.tc);
          expect(b.lines()).toHaveLength(n);
        },
      ),
    );
  });
});
