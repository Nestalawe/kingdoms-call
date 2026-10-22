// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { MASTERY_UNLOCKS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { SKILL_LABELS } from '../army-tables.ts';
import { SEA_TYPES } from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { hpGainLine, rollHpGain, syncMaxHp } from './skills-and-hp.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { discSum, hasDisc } from '../discoveries.ts';
import { recalcHeroPay, skillInPlayNote } from './effective-skills-and-hidden-heroes.ts';
import { refreshMovePool } from '../units/movement-pools.ts';
import { writeDeferredSkillLines } from '../turn/events-and-their-audiences.ts';

// ── EXPERIENCE, SKILL RISES AND EARNED HP (plan P1-08c: lifted out of resolveTurn) ────
// A hero's chance to raise a skill by using it (trySkillGain, and rollNavalVoyage for a voyage), the one rise a phase
// drawn from the candidates (resolvePendingSkillGain), the rise lines held back until the end of the phase
// (flushDeferredSkillLogsFor; writeDeferredSkillLines, which places them in the GM's log, is in
// turn/events-and-their-audiences.ts), and the maximum-HP roll after a fight (awardKillXP, awardWinHp,
// awardHpRoll), and every hero's current HP kept in step with his maximum after each phase (syncAllMaxHp, plan
// P1-08i3, below). Each takes the turn's context first (src/engine/turn/context.ts). The reassigned values they read,
// _deferredSkillLogs, _pcSimulating, _combatSkillProv, _chieftainDuelGain and _duelFoes, are read and written as
// turnContext.<name>, as resolveTurn reads them.
// ── SKILL GAIN THROUGH EXPERIENCE ────
// Characters may improve a skill by performing the matching action. Base 10% at level 0, easing
// off slightly as the skill rises. Common actions (move/explore) use a lower base because they
// happen so often. Combat resolves on COPIES, so we award to the real character.
export const SKILLGAIN_STD = 0.1,
  SKILLGAIN_COMMON = 0.04;

// The skill rises held back to the end of the phase are written out by writeDeferredSkillLines
// (src/engine/turn/events-and-their-audiences.ts: it places them in the GM's log).
export function flushDeferredSkillLogsFor(turnContext, charId) {
  const { G } = turnContext;
  if (charId != null) {
    const _pc = (G.characters || []).find((r) => r && r.id === charId);
    if (_pc && _pc._sgPending) resolvePendingSkillGain(turnContext, _pc);
  } // 2026-09-26b: a falling hero's phase rise is settled first
  if (charId == null || !turnContext._deferredSkillLogs.length) return;
  const mine = turnContext._deferredSkillLogs.filter(([, meta]) => meta && meta.charId === charId);
  if (!mine.length) return;
  turnContext._deferredSkillLogs = turnContext._deferredSkillLogs.filter(
    ([, meta]) => !(meta && meta.charId === charId),
  );
  writeDeferredSkillLines(turnContext, mine, true);
}

export function trySkillGain(turnContext, char, skill, base, narr?, mult?) {
  const { G } = turnContext;
  if (!char || turnContext._pcSimulating) return;
  mult = mult > 0 ? mult : 1;
  const real = (char.id != null && (G.characters || []).find((r) => r && r.id === char.id)) || char; // 2026-09-21: match by id, never by array index — an index lookup could check a DIFFERENT character's alive flag
  if (!real || !real.alive) return;
  // 2026-09-26 (Toby): NEUTRALS MAY LEARN FROM BATTLE. Wandering heroes and chieftains were
  // excluded from every experience path (`real.player==null` returned here), so their only growth
  // was the idle 25% roll in progressNeutralHeroes. They now take the same checks a player's hero
  // does, but ONLY inside a battle series (`_combatSkillProv!=null`, set by combatVsNPC /
  // combatVsChar) — not from moves, exploration, orders or practice, none of which a neutral
  // performs. A neutral who gains this way is stamped `_neutralXpTurn` when the rise is APPLIED,
  // and progressNeutralHeroes skips them that turn: fighting replaces the idle roll, never stacks.
  if (real.player == null && (real.isKing || turnContext._combatSkillProv == null)) return;
  const lvl = (real.skills || {})[skill] || 0;
  if (lvl >= 9) return; // SKILL CAP raised to 9 — but only EXPERIENCE (this path) may pass level 5.
  // ── RAISE-ONCE GUARDS ────
  // A character may raise a given skill AT MOST once per phase, and at most once per series of
  // ongoing battles in a province (the opening battle + every carry-on — which can span phases).
  // We test BEFORE rolling and only stamp on a real gain, so failed rolls don't burn the
  // allowance and a single success closes it. The log is keyed to the current turn and reset each
  // turn.
  const _sgPh = turnContext._logCtx.phase != null ? turnContext._logCtx.phase : turnContext._currentPhase;
  if (!real._sgLog || real._sgLog.turn !== G.turn)
    real._sgLog = { turn: G.turn, phaseNo: null, phaseSkills: {}, provSkills: {}, turnGains: {}, turnSkills: {} };
  if (!real._sgLog.turnSkills) real._sgLog.turnSkills = {};
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
  if (real._sgLog.gainedPhases && real._sgLog.gainedPhases[_sgPh]) return; // this phase has already produced its one rise
  if (!real._sgPending) real._sgPending = { turn: G.turn, phase: _sgPh, list: [], done: false };
  if (real._sgPending.list.some((e) => e.skill === skill)) return;
  if (turnContext._chieftainDuelGain && turnContext._chieftainDuelGain.used) return; // one advance only per chieftain duel (any skill)
  if (turnContext._combatSkillProv != null) {
    const _ps =
      real._sgLog.provSkills[turnContext._combatSkillProv] ||
      (real._sgLog.provSkills[turnContext._combatSkillProv] = {});
    if (_ps[skill]) return; // already raised it in this province's battle series
  }
  // skill-gain chances ramp DOWN with level so skills get off the ground fast and mastery slows
  // toward the top. Two curves:
  // • STANDARD experience (SKILLGAIN_STD): 20% @ L0 → 10% @ L8 (linear).
  // • FREQUENT actions (SKILLGAIN_COMMON — moves, explore, pursuit, which roll several times a
  // turn): now LIFTED to its own ramp of 10% @ L0 → 5% @ L8 — half the standard curve, so these
  // train meaningfully faster than before (was 4% → 0.8%) while staying throttled below STD.
  // Levels above 8 never reach here (level 9 is capped out above).
  const _b = base == null ? SKILLGAIN_STD : base;
  const chance =
    _b === SKILLGAIN_COMMON
      ? Math.max(0.05, 0.1 - 0.00625 * lvl) // frequent actions: 10% @ L0 → 5% @ L8
      : Math.max(0.1, 0.2 - 0.0125 * lvl); // standard experience: 20% @ L0 → 10% @ L8
  // a Human character of a Human realm learns 50% faster — every skill, and every chance-based
  // experience path (experience, moves…) flows through here; Practice applies the same ×1.5 itself.
  const _humanLearn =
    (real.race === 'Human' && G.players[real.player] && G.players[real.player].race === 'Human' ? 1.5 : 1) *
    (1 + discSum(turnContext, real.player, 'skillGain', 'pct', (e) => !e.skills || e.skills.includes(skill))); // skillGain discoveries (all skills, or a listed few)
  // diminishing returns — every time this skill has ALREADY risen this turn, the next chance to
  // raise it through experience is ×0.8 (cumulative). Reset each turn with _sgLog.
  const _gainsThisTurn = (real._sgLog.turnGains && real._sgLog.turnGains[skill]) || 0;
  const _diminish = Math.pow(0.8, _gainsThisTurn);
  if (kcRng() < Math.min(1, chance * _humanLearn * _diminish * mult)) {
    if (turnContext._chieftainDuelGain) turnContext._chieftainDuelGain.used = true; // this duel's single advance is spent
    // 2026-09-26b (Toby item 7): ONE skill rise per character per phase. A successful roll no
    // longer raises the skill on the spot — it becomes a CANDIDATE for this phase. When the phase
    // ends (or the character falls, or the engine moves on to another phase) one candidate is
    // drawn at random and applied; the others are dropped silently, with no notice to anyone.
    real._sgPending.list.push({
      skill,
      prov: turnContext._combatSkillProv,
      phase: _sgPh,
      duelWith: (turnContext._duelFoes && real.id != null && turnContext._duelFoes.get(real.id)) || null,
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
export function rollNavalVoyage(turnContext, c, base) {
  if (!c || !(c.armies || []).some((a) => a && !a._died && SEA_TYPES.has(a.type))) return;
  trySkillGain(turnContext, c, 'naval', base);
}
export function resolvePendingSkillGain(turnContext, real) {
  const { G, log } = turnContext;
  const P = real && real._sgPending;
  if (!P) return;
  real._sgPending = null;
  if (P.done) return;
  P.done = true;
  if (!real._sgLog || real._sgLog.turn !== G.turn)
    real._sgLog = { turn: G.turn, phaseNo: null, phaseSkills: {}, provSkills: {}, turnGains: {}, turnSkills: {} };
  if (!real._sgLog.turnSkills) real._sgLog.turnSkills = {};
  // 2026-09-27 (Toby item 5): a candidate whose skill has already risen through experience this
  // turn (a Practice-driven phase change, or a rise settled between the roll and the draw) is
  // dropped before the draw, so the lock cannot be slipped by a stale pending entry.
  const list = (P.list || []).filter((e) => e && e.skill && !real._sgLog.turnSkills[e.skill]);
  if (!list.length) return;
  const e = list[Math.floor(kcRng() * list.length)];
  const skill = e.skill;
  const lvl = (real.skills || {})[skill] || 0;
  if (lvl >= 9) return;
  (real._sgLog.gainedPhases || (real._sgLog.gainedPhases = {}))[e.phase] = true;
  real._sgLog.turnSkills[skill] = true; // 2026-09-27 (Toby item 5): this skill is done with experience for the turn
  real._sgLog.turnGains = real._sgLog.turnGains || {};
  real._sgLog.turnGains[skill] = (real._sgLog.turnGains[skill] || 0) + 1;
  real.skills = real.skills || {};
  real.skills[skill] = lvl + 1;
  if (real.player == null) real._neutralXpTurn = G.turn; // battle-earned: this turn's idle roll is spent
  // record the raise so this skill can't rise again this phase, nor again in this province's
  // ongoing battle series (carry-on battles span phases).
  real._sgLog.phaseSkills[skill] = true;
  if (e.prov != null) {
    (real._sgLog.provSkills[e.prov] || (real._sgLog.provSkills[e.prov] = {}))[skill] = true;
  }
  const _payBefore = real.pay || 0;
  recalcHeroPay(real); // a more skilled hero commands a higher wage
  const _payAfter = real.pay || 0;
  const _hpRise = syncMaxHp(real, G.players);
  // A March/Naval rise increases pace immediately: recompute this character's move pool so the
  // extra reach is available for the rest of THIS turn (preserving points already spent).
  if ((skill === 'march' || skill === 'naval') && typeof refreshMovePool === 'function')
    refreshMovePool(turnContext, real);
  // 2026-10-13 (item 6, Toby): a rise earned in a battle says where, and one earned in a pre-battle
  // duel says against whom — the duel itself is folded inside the battle's full report, so a
  // player reading the short account would otherwise never learn why the skill went up.
  const _riseProv = e.prov != null && G.world && G.world.provinces ? G.world.provinces[e.prov] : null;
  const _why = e.duelWith
    ? ` in single combat with ${e.duelWith}${_riseProv ? ` before the Battle for ${_riseProv.name}` : ''}`
    : _riseProv
      ? ` in the fighting at ${_riseProv.name}`
      : '';
  const line = `📈 ${real.name}'s ${SKILL_LABELS[skill] || skill} rises to level ${lvl + 1} through hard-won experience${_why}${skillInPlayNote(turnContext, real, skill)}.${_hpRise > 0 ? ` (Max HP +${_hpRise} → ${real.maxHp}.)` : ''}`;
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
    log(
      'system',
      `📜 ${String(real.name || '').replace(/\s*\(wandering\)/i, '')} learns from the fighting — ${SKILL_LABELS[skill] || skill} rises to ${lvl + 1}.`,
      { targets: [], provinceId: e.prov != null ? e.prov : real.location, system: true },
    );
  } else {
    turnContext._deferredSkillLogs.push([
      line,
      { actor: real.player, targets: [real.player], charId: _skCharId, phase: _skPhase, ..._after },
    ]);
    // crossing a mastery threshold (6/7/8/9) earns a congratulation that spells out the new
    // level's benefits — the passive that deepens, and any new mastery order or spell now
    // available. Fires exactly once per crossing (each gain is a single level).
    const _newLvl = lvl + 1;
    if (_newLvl >= 6) {
      const _mu = (MASTERY_UNLOCKS[skill] || {})[_newLvl];
      const _mline = `🎉 ${real.name} attains mastery of ${SKILL_LABELS[skill] || skill} — level ${_newLvl}!${_mu ? ' ' + _mu : ''}`;
      turnContext._deferredSkillLogs.push([
        _mline,
        { actor: real.player, targets: [real.player], charId: _skCharId, phase: _skPhase, ..._after },
      ]);
    }
  }
  // when the higher skill raises the hero's wage, say so in the player's report. (A neutral has
  // no realm to tell, and their wage is set by the hire itself, so this is player-led only.)
  if (real.player != null && _payAfter > _payBefore) {
    const wline = `💰 ${real.name}'s growing renown raises their wage to ${_payAfter}g/turn (was ${_payBefore}g/turn).`;
    turnContext._deferredSkillLogs.push([
      wline,
      { actor: real.player, targets: [real.player], charId: _skCharId, phase: _skPhase, ..._after },
    ]);
  }
}
export function resolveAllPendingSkillGains(turnContext) {
  const { G } = turnContext;
  (G.characters || []).forEach((c) => {
    if (c && c._sgPending) resolvePendingSkillGain(turnContext, c);
  });
}

// Handle all consequences when a character dies killerChar: the character who caused the death
// (or null) Award permanent max-HP (combat experience) to a hero who slays an enemy commander in
// personal combat — the Encounter Character action, or a battle-opening duel between two army
// leaders. Mirrors the maxHp gain heroes get for defeating feature monsters, scaled to the fallen
// foe's toughness. If a narrative array is given (battle report), the message is pushed there;
// otherwise it is logged.
export function awardKillXP(turnContext, killer, victim, narrative?) {
  if (!killer || !victim || killer === victim || (killer.hp || 0) <= 0) return;
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
export function awardWinHp(turnContext, ch, narrative, why) {
  return awardHpRoll(turnContext, ch, narrative, why, true);
}
// 2026-10-08/09 (Toby item 16): one maximum-HP roll for a hero after a fight — for the WINNER (isWin)
// or for a hero who was wounded in it (resolvePersonalCombat). The roll sets the amount; a winner
// gains the roll +1.
export function awardHpRoll(turnContext, ch, narrative, why, isWin) {
  const { G, log } = turnContext;
  if (!ch || ch.alive === false) return null;
  const real = (ch.id != null && (G.characters || []).find((r) => r && r.id === ch.id)) || ch;
  if (real.alive === false) return null;
  const r = rollHpGain(real, G.players, why);
  if (isWin) {
    real.hpEarned = Math.max(0, Math.round(real.hpEarned || 0)) + 1;
    syncMaxHp(real, G.players);
    r.gain += 1;
    r.maxHp = real.maxHp;
    r.winBonus = 1;
  }
  r.wound = !isWin;
  if (r.gain > 0 && real.isKing && hasDisc(turnContext, real.player, 'sd35')) {
    // sd35 Order of the Golden Shield: the king's hardening is doubled
    real.hpEarned += r.gain;
    syncMaxHp(real, G.players);
    r.gain *= 2;
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
    if (r.gain > 0 && ch.hp != null) ch.hp = Math.min(real.maxHp, ch.hp + r.gain);
  }
  const line = hpGainLine(real, r);
  // 2026-10-12 (Toby item 20): a hero's maximum-HP rise is his own realm's news. Inside a shared fight
  // narrative it rides as a private line (emitNarrLine logs it to that realm alone, in its place in the
  // fight); a neutral's rise is nobody's, so it is not put in the shared report at all.
  if (!line) {
    /* nothing gained — nothing to say */
  } else if (Array.isArray(narrative)) {
    if (real.player != null) narrative.push({ text: line, onlyPlayer: real.player, charId: real.id });
  } else {
    const prov = real.location != null ? G.world.provinces[real.location] : null;
    log('combat', line, {
      actor: real.player != null ? real.player : -1,
      targets: real.player != null ? [real.player] : [],
      charId: real.id,
      provinceId: prov ? prov.id : undefined,
    });
  }
  return r;
}

// whenever a character's maximum HP rises for ANY reason (item picked up, bought or received, a
// discovery, a title…) the current HP rises by the same amount at once — syncMaxHp already heals
// into new headroom, so the rule is: resync everyone after EVERY phase, not just at turn end.
export function syncAllMaxHp(turnContext) {
  const { G, log } = turnContext;
  (G.characters || []).forEach((ch) => {
    if (!ch || !ch.alive) return;
    const d = syncMaxHp(ch, G.players);
    if (d === 0) return;
    const prov = ch.location != null ? G.world.provinces[ch.location] : null;
    const tgt =
      ch.player != null
        ? {
            actor: ch.player,
            targets: [ch.player],
            charId: ch.id,
            provinceId: prov ? prov.id : undefined,
            public: true,
          }
        : { actor: -1, targets: [] };
    log(
      'system',
      d > 0
        ? `💪 ${ch.name}'s maximum HP rises by ${d} to ${ch.maxHp} (current HP ${dispFloor(ch.hp)}).`
        : `${ch.name}'s maximum HP falls by ${-d} to ${ch.maxHp}.`,
      tgt,
    );
  });
}
