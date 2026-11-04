import { kcRng } from '../rng.ts';
import { SEA_TYPES } from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { rollHpGain, syncMaxHp } from './skills-and-hp.ts';
import {
  theFactorARealmsDiscoveriesHardenTheKingBy,
  whatARealmsDiscoveriesAddToASkillsRise,
} from '../rules/the-registry-of-discovery-effects.ts';
import { recalcHeroPay, theSkillInPlayAsALineTellsIt } from './effective-skills-and-hidden-heroes.ts';
import { refreshMovePool } from '../units/movement-pools.ts';
import {
  narrate,
  emit,
  writeDeferredSkillLines,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../turn/events-and-their-audiences.ts';
import { aHitPointRiseAsTheLineTellsIt } from '../personal-combat/the-facts-a-personal-combats-lines-record.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { AHitPointRiseAsTheLineTellsIt } from '../personal-combat/the-facts-a-personal-combats-lines-record.ts';
import type { TheFactOfAHerosExperienceLine } from './the-facts-a-heros-experience-lines-record.ts';
import type { EventButItsWords, NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { TurnContext } from '../turn/context.ts';
import type { Character } from '../../schemas/saved-game-state.ts';

// Its types (plan P1-10b32): each parameter typed from what its callers pass and as wide as the body's guards (plan
// P1-10's Decision 2), so each guard stays.
/** A skill rise waiting for the phase's draw: its skill, the province of the battle it was earned in, its phase, and
 *  the foe of the duel it was earned in (null: none of them). */
interface ACandidateRise {
  readonly skill: string;
  readonly prov: number | null;
  readonly phase: number | null;
  readonly duelWith: string | null;
}
/** The rises a hero waits on this phase (the save holds none: they are drawn before it is written). */
interface TheRisesWaitingForThePhasesDraw {
  readonly turn: number;
  readonly phase: number | null;
  readonly list: ACandidateRise[];
  done: boolean;
}
/** A hero's book of his lessons this turn (`_sgLog`), each record read by any skill's name (the provinces' by a
 *  province, the phases' by a phase); the records its guards test may be missing. */
interface TheBookOfHisLessonsThisTurn {
  readonly turn: number;
  phaseNo: number | null;
  phaseSkills: Partial<Record<string, boolean>>;
  readonly provSkills: Partial<Record<string, Partial<Record<string, boolean>>>>;
  turnGains?: Partial<Record<string, number>> | undefined;
  turnSkills?: Partial<Record<string, boolean>> | undefined;
  gainedPhases?: Partial<Record<string, boolean>> | undefined;
}
/** A hero as a rise is rolled for him and drawn, or his maximum HP rolled: a hero of the world, a battle's copy of one,
 *  a fight's hero (a Hunting Rumours copy's id is words) or a guardian (a fighter's \`ref\`, which holds none of these),
 *  each field as the guards read it, his skills by any skill's name. */
type AHeroAsHisRisesAreRolled = object & {
  readonly id?: Character['id'] | string;
  readonly name?: string | undefined;
  readonly alive?: boolean;
  readonly killedThisTurn?: boolean | undefined;
  readonly player?: Character['player'];
  readonly isKing?: boolean;
  readonly race?: string;
  readonly location?: Character['location'];
  readonly armies?: Character['armies'];
  readonly _hireAlignWage?: number | undefined;
  skills?: Partial<Record<string, number>>;
  pay?: number | undefined;
  hp?: number | undefined;
  maxHp?: number | undefined;
  hpEarned?: number | undefined;
  _neutralXpTurn?: number | undefined;
  _sgLog?: TheBookOfHisLessonsThisTurn | undefined;
  _sgPending?: TheRisesWaitingForThePhasesDraw | null | undefined;
};
/** The world's heroes as their rises are rolled: a gap among them, as the guards read them. */
type TheHeroesAsTheirRisesAreRolled = readonly (AHeroAsHisRisesAreRolled | null | undefined)[];
/** A maximum-HP roll as a win and the Golden Shield mark it (rollHpGain's result, and the marks added to it). */
type AnHpRollAsTheWinMarksIt = ReturnType<typeof rollHpGain> & {
  winBonus?: number | undefined;
  wound?: boolean | undefined;
  sd35?: boolean | undefined;
};
/** A skill rise's line as it is built: his name and maximum HP as his record holds them. */
type ARiseAsItIsBuilt = Omit<
  Extract<TheFactOfAHerosExperienceLine, { kind: "a hero's skill rises through experience" }>,
  'heroName' | 'maxHp'
> & { readonly heroName: string | undefined; readonly maxHp: number | undefined };

/** A hero whose maximum HP is rolled or whose rise is drawn: no fight's copy (a Hunting Rumours fight is simulated, and
 *  rolls neither). Throws for one. */
function theHeroIsNoFightsCopy<Hero extends AHeroAsHisRisesAreRolled>(
  hero: Hero,
): asserts hero is Hero & { readonly id?: Character['id'] } {
  if (typeof hero.id === 'string') throw new TypeError("a fight's copy of a hero rolls no rise");
}
/** Whether a hero's name is words, as every hero of the world's is (the saved schema's). */
function aRisingHerosNameIsWords<Hero extends AHeroAsHisRisesAreRolled>(
  hero: Hero,
): hero is Hero & { readonly name: string } {
  return typeof hero.name === 'string';
}
/** Whether a skill rise's line names its hero in words and gives his maximum HP (syncMaxHp has just worked it out), as
 *  the line of every hero of the world does. */
function aRiseAsItIsTold(line: ARiseAsItIsBuilt): line is ARiseAsItIsBuilt & { heroName: string; maxHp: number } {
  return typeof line.heroName === 'string' && typeof line.maxHp === 'number';
}
/** Whether a maximum-HP roll gives his maximum (syncMaxHp has just worked it out), as every roll that gains does. */
function aRollAsItIsTold(r: AnHpRollAsTheWinMarksIt): r is AnHpRollAsTheWinMarksIt & AHitPointRiseAsTheLineTellsIt {
  return typeof r.maxHp === 'number';
}

// ── EXPERIENCE, SKILL RISES AND EARNED HP (plan P1-08c: lifted out of resolveTurn) ────
// A hero's chance to raise a skill by using it (trySkillGain, and rollNavalVoyage for a voyage), the one rise a phase
// drawn from the candidates (resolvePendingSkillGain), the rise lines held back until the end of the phase
// (flushDeferredSkillLogsFor; writeDeferredSkillLines, which places them in the GM's log, is in
// turn/events-and-their-audiences.ts), and the maximum-HP roll after a fight (awardKillXP, awardWinHp,
// awardHpRoll), and every hero's current HP kept in step with his maximum after each phase (syncAllMaxHp, plan
// P1-08i3, below). Each takes the turn's context first (src/engine/turn/context.ts). The reassigned values they read,
// _deferredSkillLogs, _pcSimulating, _combatSkillProv, _chieftainDuelGain and _duelFoes, are read and written as
// turnContext.<name>, as resolveTurn reads them. Every line they write is a fact (plan P1-12d12): a hero's experience
// lines' kinds (heroes/the-facts-a-heros-experience-lines-record.ts), and a hit-point rise in a fight personal
// combat's; the prose writes the words.
// ── SKILL GAIN THROUGH EXPERIENCE ────
// Characters may improve a skill by performing the matching action. Base 10% at level 0, easing
// off slightly as the skill rises. Common actions (move/explore) use a lower base because they
// happen so often. Combat resolves on COPIES, so we award to the real character.
export const SKILLGAIN_STD = 0.1,
  SKILLGAIN_COMMON = 0.04;

// The skill rises held back to the end of the phase are written out by writeDeferredSkillLines
// (src/engine/turn/events-and-their-audiences.ts: it places them in the GM's log).
export function flushDeferredSkillLogsFor(turnContext: TurnContext, charId: number | null | undefined) {
  const { G } = turnContext;
  if (charId != null) {
    const _pc = (asItsGuardReadsIt<TheHeroesAsTheirRisesAreRolled>(G.characters) ?? []).find(
      (r) => r && r.id === charId,
    );
    if (_pc && _pc._sgPending) resolvePendingSkillGain(turnContext, _pc);
  } // 2026-09-26b: a falling hero's phase rise is settled first
  if (charId == null || !turnContext._deferredSkillLogs.length) return;
  const mine = turnContext._deferredSkillLogs.filter(([, place]) => asItsGuardReadsIt(place)?.hero === charId);
  if (!mine.length) return;
  turnContext._deferredSkillLogs = turnContext._deferredSkillLogs.filter(
    ([, place]) => !(asItsGuardReadsIt(place)?.hero === charId),
  );
  writeDeferredSkillLines(turnContext, mine, true);
}

// Its return type written for its typed callers (plan P1-10b12): every path returns nothing. `narr` (the fight's lines
// its callers hand it) is read by nothing.
export function trySkillGain(
  turnContext: TurnContext,
  char: AHeroAsHisRisesAreRolled | null | undefined,
  skill: string,
  base?: number | null,
  narr?: unknown,
  mult?: number,
): void {
  const { G } = turnContext;
  if (!char || turnContext._pcSimulating) return;
  mult = mult !== undefined && mult > 0 ? mult : 1;
  const real =
    (char.id != null
      ? (asItsGuardReadsIt<TheHeroesAsTheirRisesAreRolled>(G.characters) ?? []).find((r) => r && r.id === char.id)
      : undefined) ?? char; // 2026-09-21: match by id, never by array index — an index lookup could check a DIFFERENT character's alive flag
  if (!real.alive) return;
  // 2026-09-26 (Toby): NEUTRALS MAY LEARN FROM BATTLE. Wandering heroes and chieftains were
  // excluded from every experience path (`real.player==null` returned here), so their only growth
  // was the idle 25% roll in progressNeutralHeroes. They now take the same checks a player's hero
  // does, but ONLY inside a battle series (`_combatSkillProv!=null`, set by combatVsNPC /
  // combatVsChar) — not from moves, exploration, orders or practice, none of which a neutral
  // performs. A neutral who gains this way is stamped `_neutralXpTurn` when the rise is APPLIED,
  // and progressNeutralHeroes skips them that turn: fighting replaces the idle roll, never stacks.
  if (real.player == null && (real.isKing || turnContext._combatSkillProv == null)) return;
  const hisSkills = real.skills ?? {};
  const lvl = (hisSkills[skill] ?? 0) || 0;
  if (lvl >= 9) return; // SKILL CAP raised to 9 — but only EXPERIENCE (this path) may pass level 5.
  // ── RAISE-ONCE GUARDS ────
  // A character may raise a given skill AT MOST once per phase, and at most once per series of
  // ongoing battles in a province (the opening battle + every carry-on — which can span phases).
  // We test BEFORE rolling and only stamp on a real gain, so failed rolls don't burn the
  // allowance and a single success closes it. The log is keyed to the current turn and reset each
  // turn.
  const _sgPh = turnContext._logCtx.phase ?? turnContext._currentPhase;
  if (real._sgLog?.turn !== G.turn)
    real._sgLog = { turn: G.turn, phaseNo: null, phaseSkills: {}, provSkills: {}, turnGains: {}, turnSkills: {} };
  real._sgLog.turnSkills ??= {};
  // 2026-09-27 (Toby item 5): ONE EXPERIENCE RISE PER SKILL PER HERO PER TURN. Once a skill has
  // risen through experience this turn, no further experience check is rolled for that skill for
  // the rest of the turn — not in a later phase, not in another battle, not from a move. The
  // PRACTICE order is deliberately outside this rule: it neither sets the lock nor is stopped by
  // it (a drilled skill still feeds the ×0.8 diminishing return below).
  if (real._sgLog.turnSkills[skill]) return;
  if (real._sgLog.phaseNo !== _sgPh) {
    real._sgLog.phaseNo = _sgPh;
    real._sgLog.phaseSkills = {};
  }
  if (real._sgLog.phaseSkills[skill]) return; // already raised this skill this phase
  // 2026-09-26b (Toby item 7): one rise per phase. A pending candidate list left over from an
  // earlier phase is settled first; then no further roll once this phase has already produced a
  // rise (e.g. a Practice success), and no second candidate for a skill already in the draw.
  if (real._sgPending && (real._sgPending.done || real._sgPending.turn !== G.turn)) real._sgPending = null; // stale (earlier turn) — dropped
  if (real._sgPending && real._sgPending.phase !== _sgPh) resolvePendingSkillGain(turnContext, real);
  if (real._sgLog.gainedPhases?.[String(_sgPh)]) return; // this phase has already produced its one rise
  real._sgPending ??= { turn: G.turn, phase: _sgPh, list: [], done: false };
  if (real._sgPending.list.some((e) => e.skill === skill)) return;
  if (turnContext._chieftainDuelGain?.used) return; // one advance only per chieftain duel (any skill)
  if (turnContext._combatSkillProv != null) {
    const _ps = (real._sgLog.provSkills[turnContext._combatSkillProv] ??= {});
    if (_ps[skill]) return; // already raised it in this province's battle series
  }
  // skill-gain chances ramp DOWN with level so skills get off the ground fast and mastery slows
  // toward the top. Two curves:
  // • STANDARD experience (SKILLGAIN_STD): 20% @ L0 → 10% @ L8 (linear).
  // • FREQUENT actions (SKILLGAIN_COMMON — moves, explore, pursuit, which roll several times a
  // turn): now LIFTED to its own ramp of 10% @ L0 → 5% @ L8 — half the standard curve, so these
  // train meaningfully faster than before (was 4% → 0.8%) while staying throttled below STD.
  // Levels above 8 never reach here (level 9 is capped out above).
  const _b = base ?? SKILLGAIN_STD;
  const chance =
    _b === SKILLGAIN_COMMON
      ? Math.max(0.05, 0.1 - 0.00625 * lvl) // frequent actions: 10% @ L0 → 5% @ L8
      : Math.max(0.1, 0.2 - 0.0125 * lvl); // standard experience: 20% @ L0 → 10% @ L8
  // a Human character of a Human realm learns 50% faster — every skill, and every chance-based
  // experience path (experience, moves…) flows through here; Practice applies the same ×1.5 itself.
  // (his realm by his index, as JavaScript reads G.players[null] for a hero of none)
  const hisRealm = real.player == null ? undefined : G.players[real.player];
  const _humanLearn =
    (real.race === 'Human' && hisRealm?.race === 'Human' ? 1.5 : 1) *
    (1 + whatARealmsDiscoveriesAddToASkillsRise(hisRealm, { theSkill: skill })); // skillGain discoveries (all skills, or a listed few: the discoveries' registry's since plan P1-19ac)
  // diminishing returns — every time this skill has ALREADY risen this turn, the next chance to
  // raise it through experience is ×0.8 (cumulative). Reset each turn with _sgLog.
  const _gainsThisTurn = (real._sgLog.turnGains?.[skill] ?? 0) || 0;
  const _diminish = Math.pow(0.8, _gainsThisTurn);
  if (kcRng() < Math.min(1, chance * _humanLearn * _diminish * mult)) {
    if (turnContext._chieftainDuelGain) turnContext._chieftainDuelGain.used = true; // this duel's single advance is spent
    // (the foes of the duels by a hero's id, looked up by any hero's id: a fight's copy's is words, and finds none)
    const theDuelFoes: ReadonlyMap<unknown, string> | null = turnContext._duelFoes;
    // 2026-09-26b (Toby item 7): ONE skill rise per character per phase. A successful roll no
    // longer raises the skill on the spot — it becomes a CANDIDATE for this phase. When the phase
    // ends (or the character falls, or the engine moves on to another phase) one candidate is
    // drawn at random and applied; the others are dropped silently, with no notice to anyone.
    real._sgPending.list.push({
      skill,
      prov: turnContext._combatSkillProv,
      phase: _sgPh,
      duelWith: (theDuelFoes && real.id != null ? (theDuelFoes.get(real.id) ?? '') : '') || null,
    }); // item 6: earned in a duel
  }
  // the acting object may be a SHALLOW battle copy whose keys syncLeaderCopy writes back —
  // mirror the (possibly replaced) bookkeeping objects so a write-back can never roll them back.
  if (char !== real) {
    char._sgLog = real._sgLog;
    char._sgPending = real._sgPending;
  }
}
// Draw ONE of the character's pending skill-rise candidates for the phase at random and apply it.
// Rise lines go to the deferred (end-of-phase) log, private to the owner, in that character's
// Chronicle section. The losing candidates are discarded without a word.
// ── NAVAL FROM A VOYAGE (2026-10-14, batch item 9, Toby) ── a hero learns Naval at sea only when
// leading ships or sea beasts of their own; a passenger (carried in another's hulls, or riding out
// by sea with no fleet) learns nothing from the voyage. Every voyage path rolls through here — a sea
// move, a Defend ride-out by sea, a reinforcement or a pursuit step at sea. (From 2026-09-21 until
// now a passenger rolled at the frequent-action rate.)
export function rollNavalVoyage(
  turnContext: TurnContext,
  c: AHeroAsHisRisesAreRolled | null | undefined,
  base: number | null | undefined,
): void {
  if (
    !c ||
    !(c.armies ?? []).some(
      (a: Character['armies'][number] | null | undefined) => a && !a._died && SEA_TYPES.has(a.type),
    )
  )
    return;
  trySkillGain(turnContext, c, 'naval', base);
}
export function resolvePendingSkillGain(turnContext: TurnContext, real: AHeroAsHisRisesAreRolled | null | undefined) {
  const { G } = turnContext;
  const P = real && real._sgPending;
  if (!P) return;
  real._sgPending = null;
  if (P.done) return;
  P.done = true;
  if (real._sgLog?.turn !== G.turn)
    real._sgLog = { turn: G.turn, phaseNo: null, phaseSkills: {}, provSkills: {}, turnGains: {}, turnSkills: {} };
  real._sgLog.turnSkills ??= {};
  // 2026-09-27 (Toby item 5): a candidate whose skill has already risen through experience this
  // turn (a Practice-driven phase change, or a rise settled between the roll and the draw) is
  // dropped before the draw, so the lock cannot be slipped by a stale pending entry.
  const theSkillsDone = real._sgLog.turnSkills;
  const list = (asItsGuardReadsIt(P.list) ?? []).filter(
    (e: ACandidateRise | null | undefined) => e?.skill && !theSkillsDone[e.skill],
  );
  if (!list.length) return;
  const e = list[Math.floor(kcRng() * list.length)];
  // (a pick from the list just found not empty)
  if (!e) throw new TypeError("Cannot read properties of undefined (reading 'skill')");
  const skill = e.skill;
  const hisSkills = real.skills ?? {};
  const lvl = (hisSkills[skill] ?? 0) || 0;
  if (lvl >= 9) return;
  (real._sgLog.gainedPhases ?? (real._sgLog.gainedPhases = {}))[String(e.phase)] = true;
  real._sgLog.turnSkills[skill] = true; // 2026-09-27 (Toby item 5): this skill is done with experience for the turn
  real._sgLog.turnGains = real._sgLog.turnGains ?? {};
  real._sgLog.turnGains[skill] = ((real._sgLog.turnGains[skill] ?? 0) || 0) + 1;
  real.skills = real.skills ?? {};
  real.skills[skill] = lvl + 1;
  if (real.player == null) real._neutralXpTurn = G.turn; // battle-earned: this turn's idle roll is spent
  // record the raise so this skill can't rise again this phase, nor again in this province's
  // ongoing battle series (carry-on battles span phases).
  real._sgLog.phaseSkills[skill] = true;
  if (e.prov != null) {
    (real._sgLog.provSkills[e.prov] ?? (real._sgLog.provSkills[e.prov] = {}))[skill] = true;
  }
  const _payBefore = Number(real.pay) || 0;
  recalcHeroPay(real); // a more skilled hero commands a higher wage
  const _payAfter = Number(real.pay) || 0;
  theHeroIsNoFightsCopy(real);
  const _hpRise = syncMaxHp(real, G.players);
  // A March/Naval rise increases pace immediately: recompute this character's move pool so the
  // extra reach is available for the rest of THIS turn (preserving points already spent).
  if (skill === 'march' || skill === 'naval') refreshMovePool(turnContext, real);
  // 2026-10-13 (item 6, Toby): a rise earned in a battle says where, and one earned in a pre-battle
  // duel says against whom — the duel itself is folded inside the battle's full report, so a
  // player reading the short account would otherwise never learn why the skill went up.
  const _riseProv =
    e.prov != null && asItsGuardReadsIt(G.world) && asItsGuardReadsIt(G.world.provinces)
      ? G.world.provinces[e.prov]
      : null;
  const line: ARiseAsItIsBuilt = {
    kind: "a hero's skill rises through experience",
    heroName: real.name,
    skill,
    level: lvl + 1,
    duelWith: (e.duelWith ?? '') || null,
    provinceName: _riseProv ? _riseProv.name : null,
    skillInPlay: theSkillInPlayAsALineTellsIt(turnContext, real, skill),
    maxHpRise: _hpRise,
    maxHp: real.maxHp,
  };
  // Battle-driven gains pass the battle narrative: the line then appears at the point it is
  // pushed (end of the battle report), not before the battle even starts in the chronicle. the
  // deferred (non-battle) skill-rise carries the character's id and the phase it happened in,
  // so it is reported inside THAT character's Chronicle section at the end of the phase — not
  // adrift in Realm Events. (_logCtx holds the acting character + phase here.)
  const _skCharId = real.id,
    _skPhase = e.phase;
  const _after = e.prov != null ? { afterBattleIn: e.prov } : {}; // item 6: reported straight after that battle
  // a skill rise is the OWNER'S news — the deferred log is private to this realm. (2026-09-26b:
  // battle-earned rises no longer go into the shared battle narrative; they are settled with the
  // phase's single draw and reported at the end of the phase in the character's own section.)
  // A NEUTRAL's rise is nobody's private news (actor/targets would both be null, which no realm
  // reads): it is logged like the idle progression sweep, as a system line with no targets.
  if (real.player == null) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a wandering hero learns from the fighting', heroName: real.name ?? '', skill, level: lvl + 1 },
      audience: { realms: [] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: e.prov ?? real.location,
      system: true,
    });
  } else {
    // (a hero of a realm is one of the world's: his id a number, his name words)
    if (typeof _skCharId !== 'number' || !aRisingHerosNameIsWords(real) || !aRiseAsItIsTold(line))
      throw new TypeError("a realm's hero of no id, no name or no maximum HP");
    turnContext._deferredSkillLogs.push([
      line,
      {
        audience: { actor: real.player, realms: [real.player] },
        hero: _skCharId,
        phase: _skPhase ?? THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        ..._after,
      },
    ]);
    // crossing a mastery threshold (6/7/8/9) earns a congratulation that spells out the new
    // level's benefits — the passive that deepens, and any new mastery order or spell now
    // available. Fires exactly once per crossing (each gain is a single level).
    const _newLvl = lvl + 1;
    if (_newLvl >= 6) {
      const _mline: TheFactOfAHerosExperienceLine = {
        kind: 'a hero attains mastery of a skill',
        heroName: real.name,
        skill,
        level: _newLvl,
      };
      turnContext._deferredSkillLogs.push([
        _mline,
        {
          audience: { actor: real.player, realms: [real.player] },
          hero: _skCharId,
          phase: _skPhase ?? THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          ..._after,
        },
      ]);
    }
  }
  // when the higher skill raises the hero's wage, say so in the player's report. (A neutral has
  // no realm to tell, and their wage is set by the hire itself, so this is player-led only.)
  if (real.player != null && _payAfter > _payBefore) {
    // (a hero of a realm is one of the world's: his id a number, his name words, made sure above)
    if (typeof _skCharId !== 'number' || !aRisingHerosNameIsWords(real))
      throw new TypeError("a realm's hero of no id or no name");
    const wline: TheFactOfAHerosExperienceLine = {
      kind: "a hero's growing renown raises his wage",
      heroName: real.name,
      wageBefore: _payBefore,
      wageAfter: _payAfter,
    };
    turnContext._deferredSkillLogs.push([
      wline,
      {
        audience: { actor: real.player, realms: [real.player] },
        hero: _skCharId,
        phase: _skPhase ?? THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        ..._after,
      },
    ]);
  }
}
export function resolveAllPendingSkillGains(turnContext: TurnContext) {
  const { G } = turnContext;
  (asItsGuardReadsIt<TheHeroesAsTheirRisesAreRolled>(G.characters) ?? []).forEach((c) => {
    if (c && c._sgPending) resolvePendingSkillGain(turnContext, c);
  });
}

// Handle all consequences when a character dies killerChar: the character who caused the death
// (or null) Award permanent max-HP (combat experience) to a hero who slays an enemy commander in
// personal combat — the Encounter Character action, or a battle-opening duel between two army
// leaders. Mirrors the maxHp gain heroes get for defeating feature monsters, scaled to the fallen
// foe's toughness. If a narrative array is given (battle report), the message is pushed there;
// otherwise it is logged.
export function awardKillXP(
  turnContext: TurnContext,
  killer: AHeroAsHisRisesAreRolled | null | undefined,
  victim: AHeroAsHisRisesAreRolled | null | undefined,
  narrative?: NarrativeLine[] | null,
) {
  if (!killer || !victim || killer === victim || (Number(killer.hp) || 0) <= 0) return;
  if (victim.alive === true && !victim.killedThisTurn) return; // the victim was saved (Battlefield Surgery / unkillable) — no kill, no lesson
  // Sept 2026 redesign: no permanent-HP reward. A kill is a hard lesson in the killer's fighting
  // skill instead — one extra experience roll in Melee (or Archery for a bowman), weighted by how
  // tough the fallen foe was. Skill drives max HP, so seasoned killers still end up the hardiest.
  // 2026-09-10: the extra fighting-skill experience roll on a kill is DROPPED — a win now pays
  // only the earned-HP gain below (skill still rises through ordinary fight experience and
  // practice).
  awardWinHp(turnContext, killer, narrative, 'kill'); // a slain enemy commander hardens the victor (earned HP)
}
// ── EARNED HP ── one combat win = one rollHpGain on the REAL character. Wins that count: lair
// guardian cleared, enemy character slain (any personal-combat path), pre-battle duel won
// (kill or the loser breaking off). A fled Encounter/chase/thief fight and a pacified beast do NOT count.
export function awardWinHp(
  turnContext: TurnContext,
  ch: AHeroAsHisRisesAreRolled | null | undefined,
  narrative: NarrativeLine[] | null | undefined,
  why: string,
) {
  return awardHpRoll(turnContext, ch, narrative, why, true);
}
// 2026-10-08/09 (Toby item 16): one maximum-HP roll for a hero after a fight — for the WINNER (isWin)
// or for a hero who was wounded in it (resolvePersonalCombat). The roll sets the amount; a winner
// gains the roll +1.
export function awardHpRoll(
  turnContext: TurnContext,
  ch: AHeroAsHisRisesAreRolled | null | undefined,
  narrative: NarrativeLine[] | null | undefined,
  why: string,
  isWin: boolean,
) {
  const { G } = turnContext;
  if (!ch || ch.alive === false) return null;
  const real =
    (ch.id != null
      ? (asItsGuardReadsIt<TheHeroesAsTheirRisesAreRolled>(G.characters) ?? []).find((r) => r && r.id === ch.id)
      : undefined) ?? ch;
  if (real.alive === false) return null;
  theHeroIsNoFightsCopy(real);
  const r: AnHpRollAsTheWinMarksIt = rollHpGain(real, G.players, why);
  if (isWin) {
    real.hpEarned = Math.max(0, Math.round(Number(real.hpEarned) || 0)) + 1;
    syncMaxHp(real, G.players);
    r.gain += 1;
    r.maxHp = real.maxHp;
    r.winBonus = 1;
  }
  r.wound = !isWin;
  // the discoveries' registry's since plan P1-19ac: "experience: a realm's discoveries harden the king", its factor
  const _kingsFactor =
    r.gain > 0 && real.isKing
      ? theFactorARealmsDiscoveriesHardenTheKingBy(real.player == null ? undefined : G.players[real.player])
      : null;
  if (_kingsFactor !== null) {
    // sd35 Order of the Golden Shield: the king's hardening is doubled
    // (his earned pool, which rollHpGain has just set)
    const hisEarnedPool = real.hpEarned;
    if (hisEarnedPool === undefined) throw new TypeError("a hero's earned pool rollHpGain set is gone");
    real.hpEarned = hisEarnedPool + r.gain * (_kingsFactor - 1);
    syncMaxHp(real, G.players);
    r.gain *= _kingsFactor;
    r.maxHp = real.maxHp;
    r.sd35 = true;
  }
  // ── 2026-09-17 — THE HARDENING THAT UNDID ITSELF ────
  // A battle (and its opening duel) is fought on a SHALLOW COPY of the commander, and
  // syncLeaderCopy writes every own key of that copy back onto the real character afterwards.
  // `hpEarned` is a NUMBER, so the copy holds a snapshot taken before the fight. rollHpGain
  // raises real.hpEarned and real.maxHp; then the write-back restored the STALE hpEarned while
  // leaving the raised maxHp in place. The next syncAllMaxHp recomputed maxHp from the reverted
  // pool and reported "maximum HP falls by 3" — one fall per duel won. Mirroring every primitive
  // the win touched onto the copy makes the write-back a no-op instead of a rollback. `pay` rides
  // along for the same reason (a skill-rise wage recalculation was being reverted by the same
  // mechanism).
  if (ch !== real) {
    ch.hpEarned = real.hpEarned;
    ch.maxHp = real.maxHp;
    ch.pay = real.pay;
    if (r.gain > 0 && ch.hp != null) ch.hp = Math.min(Number(real.maxHp), ch.hp + r.gain);
  }
  // A roll that gains nothing has no line (hpGainLine, which writes its words in the prose, writes none for it).
  const aRise = r.gain > 0;
  // 2026-10-12 (Toby item 20): a hero's maximum-HP rise is his own realm's news. Inside a shared fight
  // narrative it rides as a private line (emitNarrLine logs it to that realm alone, in its place in the
  // fight); a neutral's rise is nobody's, so it is not put in the shared report at all.
  if (!aRise) {
    /* nothing gained — nothing to say */
  } else if (Array.isArray(narrative)) {
    if (real.player != null) {
      // (a roll that gains is told of a hero whose maximum syncMaxHp has just worked out; a hero of a realm is named)
      if (!aRollAsItIsTold(r) || !aRisingHerosNameIsWords(real))
        throw new TypeError("a realm's hero of no name or no maximum HP");
      narrate(narrative, {
        kind: "a hero's hit points rise in a fight, for his realm alone",
        realm: real.player,
        hero: real.id,
        heroName: real.name,
        rise: aHitPointRiseAsTheLineTellsIt(r),
      });
    }
  } else {
    // Told to his realm alone, with no deed (R-118: a spy who stays in the province doesn't read it); its fact names
    // that realm, as the rise in a fight's does.
    const prov = real.location != null ? G.world.provinces[real.location] : null;
    // (emit throws for an event that names no hero; a roll that gains is told of a hero whose maximum is worked out)
    if (real.id === undefined || !aRollAsItIsTold(r) || !aRisingHerosNameIsWords(real))
      throw new Error("a hero's hardening of no id, no name or no maximum HP");
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: 'a hero is hardened after a fight',
        realm: real.player ?? null,
        heroName: real.name,
        rise: aHitPointRiseAsTheLineTellsIt(r),
      },
      audience: { realms: real.player != null ? [real.player] : [] },
      hero: real.id,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov ? prov.id : undefined,
    });
  }
  return r;
}

// whenever a character's maximum HP rises for ANY reason (item picked up, bought or received, a
// discovery, a title…) the current HP rises by the same amount at once — syncMaxHp already heals
// into new headroom, so the rule is: resync everyone after EVERY phase, not just at turn end.
// A rise is his own realm's news alone (R-117, as a rise in a fight is, R-101): told to it, with no deed and no sight,
// in a province or in none, and its fact names that realm. A fall keeps its audience until Toby rules on it.
export function syncAllMaxHp(turnContext: TurnContext) {
  const { G } = turnContext;
  (asItsGuardReadsIt(G.characters) ?? []).forEach((ch: Character | null | undefined) => {
    if (!ch?.alive) return;
    const d = syncMaxHp(ch, G.players);
    if (d === 0) return;
    const prov = asItsGuardReadsIt(ch.location) != null ? G.world.provinces[ch.location] : null;
    const tgt: EventButItsWords =
      ch.player != null
        ? {
            audience:
              d > 0
                ? { realms: [ch.player] }
                : { actor: ch.player, realms: [ch.player], seen: prov ? 'there' : 'world' },
            hero: ch.id,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            province: prov ? prov.id : undefined,
          }
        : {
            audience: { actor: -1, realms: [] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          };
    emit(turnContext, {
      type: 'system',
      fact:
        d > 0
          ? {
              kind: "a hero's maximum hit points rise as the phase ends",
              realm: ch.player,
              heroName: ch.name,
              by: d,
              maxHp: ch.maxHp,
              hp: ch.hp,
            }
          : { kind: "a hero's maximum hit points fall as the phase ends", heroName: ch.name, by: -d, maxHp: ch.maxHp },
      ...tgt,
    });
  });
}
