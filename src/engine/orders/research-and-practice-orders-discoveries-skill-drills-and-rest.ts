// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { QUALITY_TIERS } from '../army-tables.ts';
import { homeFounderOf } from '../grand-design.ts';
import { activeItems } from '../items/equipment.ts';
import { theHealTheRestersItemsAdd } from '../rules/the-registry-of-magic-item-effects.ts';
import { syncMaxHp } from '../heroes/skills-and-hp.ts';
import { UNIT_DRILL_BASE, humanXPMult } from '../units/drill-and-spoils.ts';
import { d100 } from '../dice-and-army-names.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { provOf } from '../world/map-helpers.ts';
import { TM, perkTier, skillLevel } from '../titles/perks.ts';
import {
  HIDDEN_DISCOVERY_CAP_PCT,
  HIDDEN_DISCOVERY_DIVISOR,
  RESEARCH_HIDDEN_CATS,
  discAvailableFor,
} from '../discoveries.ts';
import {
  aRealmsDiscoveriesHealARestingHeroInFull,
  whatARealmsDiscoveriesAddToARestsHeal,
  whatARealmsDiscoveriesAddToPractice,
  whatARealmsDiscoveriesAddToResearch,
} from '../rules/the-registry-of-discovery-effects.ts';
import { charMinor } from '../titles/title-holders-and-battle-merit.ts';
import { effStat, recalcHeroPay, theSkillInPlayAsALineTellsIt } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { SKILLGAIN_COMMON, SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../turn/events-and-their-audiences.ts';

// ── THE RESEARCH AND PRACTICE ORDERS (plan P1-08j4: the fourth family taken out of processOrder in resolveTurn) ──
// Research (a Sage's roll for a discovery of the realm, or an unlooked-for find in a hidden field), Practice Skill (a
// chance to raise a skill, with comrades, a mentor and Perseverance; Tactical and Naval also drill the troops he
// leads), Rest (hit points back) and Research Breakthrough (Sage 7: a discovery, no roll), each once processOrder has
// read the order and checked he may act (a bot's Practice on a skill already at 5 switched there first). Each takes
// the turn's context first (src/engine/turn/context.ts), then the values processOrder worked out before it that it
// reads, in the order processOrder declares them. Each body keeps processOrder's indent (plan P1-08's Decisions); a
// case-level break became a return.
// ── RESEARCH ── the scholar's own order: a roll for a Sage discovery. Available to any
// character with Sage 1+ (the player portal hides it below that; the engine re-checks). Does
// NOT train the Sage skill unless a discovery is actually made.
export function resolveResearchOrder(turnContext, c, ph, target, player) {
  const { G } = turnContext;
  const sageRaw = skillLevel(c, 'sage');
  if (sageRaw < 1) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero without Sage learning cannot research', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const sageLevel = effStat(turnContext, c, 'sage');
  // the order names a CATEGORY (target); blank/'any' = the whole eligible table. Item 11: the
  // Heroic and Special fields can no longer be named or seen — they are found only as an
  // unlooked-for side result of researching any other field (roll below).
  const _rcatRaw = (target || '').trim();
  let _rcat = RESEARCH_HIDDEN_CATS.has(_rcatRaw) ? '' : _rcatRaw;
  // 2026-09-23d (Toby): a field with nothing left to find — typically because another Sage of
  // this realm took its last discovery EARLIER THIS TURN — no longer wastes the order. The
  // study shifts to a random other field that still holds something for the realm; only when
  // every field is spent is the order refused. Decided BEFORE the chance is worked out, so a
  // field-scoped research bonus (az10's own-creed field) follows the field actually studied.
  {
    const _knownPre = new Set((player.discoveries || []).map((d) => d.id));
    const _avPre = discAvailableFor(turnContext, c.player, _knownPre).filter(
      (d) => !RESEARCH_HIDDEN_CATS.has(d.category),
    );
    if (
      _rcat &&
      _rcat.toLowerCase() !== 'any' &&
      !_avPre.some((d) => (d.category || '').toLowerCase() === _rcat.toLowerCase())
    ) {
      const _fields = [...new Set(_avPre.map((d) => d.category).filter(Boolean))];
      if (!_fields.length) {
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: 'every field of discovery is spent and nothing is left to research',
            heroName: c.name,
            field: _rcat,
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        });
        return;
      }
      const _to = _fields[Math.floor(kcRng() * _fields.length)];
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a field's archives are spent and the research turns to another",
          heroName: c.name,
          field: _rcat,
          turnsTo: _to,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      _rcat = _to;
    }
  }
  // Neutral alignment: double sage discovery chance (pragmatic scholars)
  const neutralSageBonus = G.players[c.player]?.alignment === 'Neutral' ? sageLevel * 5 : 0;
  const perLevel = 5;
  // The discovery-chance benefit CAPS at level 5 (via effStat); levels 6+ grant the Sage's
  // distinct mastery orders instead of a further per-level climb.
  const _discBase =
    sageLevel * perLevel +
    neutralSageBonus +
    (charMinor(turnContext, c, 'loreseeker') ? perLevel : 0) +
    whatARealmsDiscoveriesAddToResearch(G.players[c.player], {
      isTheFieldStudiedItsOwnCreed: () =>
        String(_rcat || '')
          .trim()
          .toLowerCase() === String((player.alignment || '') + ' Creed').toLowerCase(),
    }); // + Loreseeker; research discoveries (az10: own creed field only — the field actually studied; the discoveries'
  // registry's since plan P1-19ad: "orderOutcome: a realm's discoveries add to research")
  // 2026-10-13 (Toby, item 18): PERSEVERANCE, as Practice has it — every Research order of this
  // hero that has failed earlier this turn makes this one ×1.2 likelier, cumulatively. A
  // discovery (the hidden-field find included) resets it; each turn starts afresh.
  const _rStreak = c._researchFailStreak && c._researchFailStreak.turn === G.turn ? c._researchFailStreak.n : 0;
  const _rPersevere = Math.pow(1.2, _rStreak);
  const discoveryChance = Math.min(100, dispFloor(_discBase * _rPersevere));
  const _catFilter = (d) =>
    !RESEARCH_HIDDEN_CATS.has(d.category) &&
    (!_rcat || _rcat.toLowerCase() === 'any' || (d.category || '').toLowerCase() === _rcat.toLowerCase());
  // the HIDDEN-FIELD roll is made FIRST and, when it lands, it is the discovery this research
  // yields — an unlooked-for find INSTEAD of the ordinary one, never as well as it. Half the
  // discovery chance, as before.
  let _sideFound = false;
  // THE HIDDEN FIELDS GROW RARER. Was half the ordinary discovery chance, which put a Neutral
  // Sage 5 holding the Loreseeker at 27% a turn for a Heroic or Special find — eight of them,
  // so a scholar-realm swept the hidden table in a dozen turns. Now a FIFTH of the ordinary
  // chance, hard-capped at 10%: an ordinary Sage 5 rolls 5%, and no stack of Neutral doubling
  // and title bonuses can push it past one in ten.
  {
    const _sRoll = d100();
    const _sChance = Math.max(
      1,
      Math.min(HIDDEN_DISCOVERY_CAP_PCT, Math.floor(discoveryChance / HIDDEN_DISCOVERY_DIVISOR)),
    );
    if (_sRoll <= _sChance) {
      if (!player.discoveries) player.discoveries = [];
      const _known2 = new Set(player.discoveries.map((d) => d.id));
      const _side = discAvailableFor(turnContext, c.player, _known2).filter((d) =>
        RESEARCH_HIDDEN_CATS.has(d.category),
      );
      if (_side.length > 0) {
        const disc = _side[Math.floor(kcRng() * _side.length)];
        player.discoveries.push({
          id: disc.id,
          name: disc.name,
          category: disc.category,
          desc: disc.desc,
          turnDiscovered: G.turn,
        });
        TM(c).discoveries += 1;
        if (perkTier(c, 'sage') > 0) {
          player.gold = (player.gold || 0) + 5;
        }
        if (perkTier(c, 'sage') >= 3) {
          const _sp = provOf(turnContext, c);
          if (_sp && _sp.owner === c.player) {
            const _sb = _sp.tax || 0;
            _sp.tax = Math.min(10, _sb + 1);
          }
        }
        emit(turnContext, {
          type: 'explore',
          fact: {
            kind: 'an unlooked-for discovery in a hidden field',
            heroName: c.name,
            discoveryName: disc.name,
            discoveryCategory: disc.category,
            discoveryDescription: disc.desc,
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        });
        trySkillGain(turnContext, c, 'sage', SKILLGAIN_STD);
        _sideFound = true;
        c._researchFailStreak = { turn: G.turn, n: 0 }; // a find resets Perseverance (item 18)
      }
    }
  }
  if (_sideFound) return; // one discovery per Research order
  const dRoll = d100();
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: "a Sage's discovery roll",
      field: _rcat,
      chance: discoveryChance,
      sageLevel,
      neutralBonus: neutralSageBonus,
      earlierFailures: _rStreak,
      perseverance: _rPersevere,
      roll: dRoll,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
  });
  c._researchFailStreak = { turn: G.turn, n: dRoll <= discoveryChance ? 0 : _rStreak + 1 }; // item 18: the next Research this turn is ×1.2 likelier after a failure
  if (dRoll <= discoveryChance) {
    if (!player.discoveries) player.discoveries = [];
    const known = new Set(player.discoveries.map((d) => d.id));
    const available = discAvailableFor(turnContext, c.player, known).filter(_catFilter); // race/alignment eligibility; category
    if (available.length >= 2) {
      // RESEARCH CHOICE: two finds, one to keep next turn (see discBlockedIds)
      const _i1 = Math.floor(kcRng() * available.length);
      let _i2 = Math.floor(kcRng() * (available.length - 1));
      if (_i2 >= _i1) _i2++;
      const d1 = available[_i1],
        d2 = available[_i2];
      player.pendingDiscoveryChoices = player.pendingDiscoveryChoices || [];
      player.pendingDiscoveryChoices.push({
        key: `rc${G.turn}_${c.id}_${ph}`,
        turn: G.turn,
        charId: c.id,
        charName: c.name,
        category: _rcat && _rcat.toLowerCase() !== 'any' ? _rcat : '',
        options: [d1.id, d2.id],
      });
      TM(c).discoveries += 1; // TITLE MERIT: Loremaster — the deed is the research, whichever is kept
      if (perkTier(c, 'sage') > 0) {
        player.gold = (player.gold || 0) + 5;
      } // SAGE L6: +5g per new discovery
      if (perkTier(c, 'sage') >= 3) {
        const _sp = provOf(turnContext, c);
        if (_sp && _sp.owner === c.player) {
          const _sb = _sp.tax || 0;
          _sp.tax = Math.min(10, _sb + 1);
        }
      } // SAGE L8
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'research brings two discoveries to light and one is to be kept',
          heroName: c.name,
          firstName: d1.name,
          firstCategory: d1.category,
          secondName: d2.name,
          secondCategory: d2.category,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      trySkillGain(turnContext, c, 'sage', SKILLGAIN_STD); // Sage: made a discovery
    } else if (available.length > 0) {
      const disc = available[Math.floor(kcRng() * available.length)];
      player.discoveries.push({
        id: disc.id,
        name: disc.name,
        category: disc.category,
        desc: disc.desc,
        turnDiscovered: G.turn,
      });
      TM(c).discoveries += 1; // TITLE MERIT: Loremaster
      if (perkTier(c, 'sage') > 0) {
        player.gold = (player.gold || 0) + 5;
      } // SAGE L6: +5g per new discovery
      if (perkTier(c, 'sage') >= 3) {
        const _sp = provOf(turnContext, c);
        if (_sp && _sp.owner === c.player) {
          const _sb = _sp.tax || 0;
          _sp.tax = Math.min(10, _sb + 1);
        }
      } // SAGE L8 (2026-09-27, Toby item 4): +1 tax (max 10) to the province you are in — was +2
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: "research makes the field's last discovery",
          heroName: c.name,
          discoveryName: disc.name,
          discoveryCategory: disc.category,
          discoveryDescription: disc.desc,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      trySkillGain(turnContext, c, 'sage', SKILLGAIN_STD); // Sage: made a discovery
    } else {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'the research roll succeeds but every discovery is already made', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
    }
  } else {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'research makes no discovery this turn', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    trySkillGain(turnContext, c, 'sage', SKILLGAIN_COMMON); // 2026-09-21 (Toby): even a fruitless season in the archives teaches a little
  }
  return;
}
// Practice Skill: a chance to raise one skill (to 5 at most), likelier beside comrades of the same level, certain beside a better one, and likelier after each failure this turn; Tactical drills the land and air companies he leads, Naval his fleets.
export function resolvePracticeSkillOrder(turnContext, c, ph, target) {
  const { G } = turnContext;
  const skill = target;
  if (!skill) return;
  // Read skill levels frozen at the START of this phase (see G._phaseSkillSnapshot) so that
  // group-training comparisons are all made before anyone has trained up this phase.
  const _snap = G._phaseSkillSnapshot || {};
  // The snapshot is a copy of each character's skills object at phase start. A skill the
  // character had at level 0 is usually ABSENT from that object — it must still read as 0,
  // never fall through to the LIVE value. (The old fallback meant two level-0 characters
  // co-training the same new skill cascaded: the first to succeed instantly became a "more
  // skilled mentor" for the second, guaranteeing a second success in the same phase.)
  const snapLvl = (ch) => {
    const snap = _snap[ch.id];
    if (snap) return snap[skill] || 0;
    return (ch.skills || {})[skill] || 0;
  };
  const current = snapLvl(c);
  // Sept 2026: the Sage discovery roll no longer rides on Practice — it is its own order,
  // RESEARCH (case 'research' below), open to any character with Sage 1+. Practising Sage is
  // now an ordinary practice: a chance to level the skill, nothing more. Mastery: no further
  // levels to gain, but the discovery roll above has already happened. Sept 2026 (bot
  // strategy batch): a maxed (5) skill no longer BREAKS out of the case — it skips the level
  // roll but still falls through to the unit-drilling block below, so a Tactical-5 / Naval-5
  // general practising their command skill drills their troops.
  const _practiceMaxed = current >= 5;
  if (_practiceMaxed) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a skill is drilled as far as practice can take it', heroName: c.name, skill },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
  }
  if (!_practiceMaxed) {
    // Group training bonus: find all other characters in the same province who are also
    // practising the same skill in this same phase Find co-trainers: same province, same phase,
    // same skill Orders may be stored as 'practice', 'Practice Skill', etc — normalise
    const coTrainers = (G.characters || []).filter((other) => {
      if (!other.alive || other.id === c.id || other.location !== c.location) return false;
      // Only FRIENDLY characters train together: an enemy (or neutral wanderer) drilling in the
      // same province is no mentor and no training partner — soldiers do not share their drills
      // with the other side's officers.
      if (other.player !== c.player) return false;
      const otherOrder = (G.turnOrders[other.id] || [])[ph];
      if (!otherOrder) return false;
      const otherAction = (otherOrder.action || '').toLowerCase().replace(/[^a-z]/g, '');
      const isPractice =
        otherAction === 'practice' || otherAction === 'practiceskill' || otherAction === 'practiceability';
      if (!isPractice) return false;
      const otherSkill = (otherOrder.target || '').toLowerCase().trim();
      return otherSkill === skill.toLowerCase();
    });

    // Base practice chance now DECREASES as the character's current level rises — mastery is
    // progressively harder to attain. These are the solo base rates; the peer group bonus
    // (half the solo chance) and the guaranteed-success mentor rule below apply on top.
    const PRACTICE_BASE_BY_LEVEL = [0.25, 0.2, 0.15, 0.1, 0.05]; // level 0→25% … level 4→5%
    const baseByLevel = PRACTICE_BASE_BY_LEVEL[Math.min(current, 4)];
    // practice discoveries (sd26 Astronomical Tables is one; the discoveries' registry's since plan P1-19ad:
    // "orderOutcome: a realm's discoveries add to practice")
    const astroBonus = whatARealmsDiscoveriesAddToPractice(G.players[c.player], { theSkill: skill });
    // perseverance. Each FAILED practice this turn multiplies the character's next practice
    // chance by 1.2 (cumulative); a success resets it. The streak is per character, any skill,
    // and starts fresh each turn.
    const _streak = c._practiceFailStreak && c._practiceFailStreak.turn === G.turn ? c._practiceFailStreak.n : 0;
    const _persevere = Math.pow(1.2, _streak);
    // 2026-10-14 (batch item 10, Toby): QUICK LEARNERS on the Practice ground too — a Human of a
    // Human realm practises at ×1.5, as they learn in the field (trySkillGain).
    const _prHuman = c.race === 'Human' && G.players[c.player] && G.players[c.player].race === 'Human' ? 1.5 : 1;
    const soloChance = (baseByLevel + astroBonus) * _persevere * _prHuman; // this character's normal (solo) chance to improve
    // Mentor rule: if any co-trainer had a HIGHER level in this skill AT PHASE START, they
    // teach the character — the improvement is automatic (guaranteed). Levels are read from the
    // start-of-phase snapshot, so a peer who trained up earlier this phase is NOT a mentor.
    const mentors = coTrainers.filter((t) => snapLvl(t) > current);
    // Peers: co-trainers at the SAME start-of-phase level (they justify the group bonus).
    const peers = coTrainers.filter((t) => snapLvl(t) === current);
    // the characters THIS one mentors (lower start-of-phase level) are named in this
    // character's own line, mirroring the trainee's 'trained by' note.
    const pupils = coTrainers.filter((t) => snapLvl(t) < current);
    const _pupils = pupils.map((t) => ({ name: t.name, level: snapLvl(t) }));
    // why the chance is what it is, and the comrades he trains: the prose writes them (P1-12d6)
    let successChance, theChance;
    if (mentors.length > 0) {
      successChance = 1.0; // guaranteed — learning from a more skilled mentor
      const bestMentor = mentors.reduce((a, b) => (snapLvl(b) > snapLvl(a) ? b : a));
      theChance = {
        kind: 'a more skilled mentor trains a hero at practice',
        mentorName: bestMentor.name,
        mentorsLevel: snapLvl(bestMentor),
      };
    } else if (peers.length > 0) {
      // Group practice among equals — the shared drilling adds a bonus equal to HALF each
      // character's normal chance of improving (i.e. total = 1.5× the solo chance).
      successChance = soloChance * 1.5;
      theChance = {
        kind: 'a hero practises alongside peers of his level',
        peerNames: peers.map((t) => t.name),
        baseChance: dispFloor(baseByLevel * 100),
        level: current,
        astronomicalTables: astroBonus > 0,
      };
    } else {
      successChance = soloChance; // solo practice (or only lower-skilled trainees present)
      theChance = {
        kind: 'a hero practises alone',
        baseChance: dispFloor(baseByLevel * 100),
        level: current,
        astronomicalTables: astroBonus > 0,
      };
    }
    // roll a d100 and show the success chance and the roll, like every other action.
    const _prPct = dispFloor(successChance * 100);
    const _prRoll = d100();
    if (_prRoll <= _prPct) {
      c._practiceFailStreak = { turn: G.turn, n: 0 }; // success resets the streak
      c.skills[skill] = (c.skills[skill] || 0) + 1;
      // a practice rise counts toward the same per-turn tally that dampens EXPERIENCE gains
      // (×0.8 per earlier rise of this skill this turn, see trySkillGain), so a skill drilled
      // up in phase 1 is proportionally harder to raise again in the field later on.
      if (!c._sgLog || c._sgLog.turn !== G.turn)
        c._sgLog = { turn: G.turn, phaseNo: null, phaseSkills: {}, provSkills: {}, turnGains: {}, turnSkills: {} };
      c._sgLog.turnGains = c._sgLog.turnGains || {};
      c._sgLog.turnGains[skill] = (c._sgLog.turnGains[skill] || 0) + 1;
      // 2026-09-26b (Toby item 7): a Practice rise IS this phase's one skill rise — it closes the phase
      // to experience gains and voids any field candidates already drawn up this phase.
      {
        const _gp = turnContext._logCtx.phase != null ? turnContext._logCtx.phase : turnContext._currentPhase;
        (c._sgLog.gainedPhases || (c._sgLog.gainedPhases = {}))[_gp] = true;
        if (c._sgPending && c._sgPending.phase === _gp) c._sgPending = null;
      }
      const _prPayBefore = c.pay || 0;
      recalcHeroPay(c);
      const _prPayAfter = c.pay || 0;
      const _prHp = syncMaxHp(c, G.players);
      // a mentored improvement is guaranteed — no roll to show.
      emit(turnContext, {
        type: 'hire',
        fact: {
          kind: 'a hero practises a skill and improves',
          heroName: c.name,
          skill,
          level: c.skills[skill],
          skillInPlay: theSkillInPlayAsALineTellsIt(turnContext, c, skill),
          mentored: mentors.length > 0,
          chance: _prPct,
          roll: _prRoll,
          theChance,
          earlierFailures: _streak,
          perseverance: _persevere,
          quickLearner: _prHuman > 1,
          belowCertain: successChance < 1,
          pupils: _pupils,
          maxHpRise: _prHp,
          maxHp: c.maxHp,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      if (_prPayAfter > _prPayBefore)
        emit(turnContext, {
          type: 'hire',
          fact: {
            kind: "a hero's wage rises with his renown",
            heroName: c.name,
            wage: _prPayAfter,
            wasWage: _prPayBefore,
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        }); // 2026-09-21: practice raised the wage silently
    } else {
      c._practiceFailStreak = { turn: G.turn, n: _streak + 1 }; // the next practice this turn is ×1.2 likelier
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'a hero practises a skill but makes no progress',
          heroName: c.name,
          skill,
          chance: _prPct,
          roll: _prRoll,
          theChance,
          earlierFailures: _streak,
          perseverance: _persevere,
          quickLearner: _prHuman > 1,
          belowCertain: successChance < 1,
          pupils: _pupils,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
    }
  } // end !_practiceMaxed
  // ── Unit drilling: Tactical trains LAND/AIR units, Naval trains SEA units ── Clean
  // complements: a mixed land+fleet stack now advances its foot & flyers by practising
  // Tactical and its ships & sea-beasts by practising Naval. (Previously Tactical trained
  // every unit including fleets, and Naval trained nothing — this splits the two by domain so
  // each skill improves the troops it actually commands in battle.) Local set (self-contained
  // to avoid any resolveTurn-scope hazard) — the naval units that benefit from the Naval
  // skill in a sea battle are exactly the ones Naval practice drills.
  const NAVAL_DRILL_TYPES = new Set(KC_UNIT_CLASS.sea);
  if (skill === 'tactical' || skill === 'naval') {
    const isNaval = skill === 'naval';
    const drillLvl = c.skills[skill] || 0;
    const tiers = QUALITY_TIERS.slice();
    const DRILL_BASE = UNIT_DRILL_BASE; // module level — the end-of-turn garrison drill reads the same table
    // Tactical drills land & air units; Naval drills sea units.
    const trainable = (c.armies || []).filter(
      (a) => !a._isSkeletal && (isNaval ? NAVAL_DRILL_TYPES.has(a.type) : !NAVAL_DRILL_TYPES.has(a.type)),
    );
    let trainedAny = false;
    trainable.forEach((army) => {
      if (army.quality === 'Elite') return;
      const baseChance = (DRILL_BASE[army.quality] || 0.03) * drillLvl * humanXPMult(army, c.player, G);
      if (kcRng() < baseChance) {
        const idx = tiers.indexOf(army.quality);
        if (idx >= 0 && idx < 4) {
          army.quality = tiers[idx + 1];
          emit(turnContext, {
            type: 'hire',
            fact: {
              kind: "a commander's drills advance a unit a tier",
              heroName: c.name,
              isNaval,
              unitName: army.unitName || null,
              unitType: army.type,
              quality: army.quality,
            },
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          });
          trainedAny = true;
        }
      }
    });
    if (trainedAny) {
      // at least one promotion already logged above
    } else if (trainable.length > 0) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "a commander's drills advance no unit this season", heroName: c.name, isNaval },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
    } else {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a commander drills theory alone with no troops to train', heroName: c.name, isNaval },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
    }
  }
  return;
}
// Rest: hit points back, 30% of his maximum (more for a Divine realm, all of it with Medical Arts).
export function resolveRestOrder(turnContext, c, prov) {
  const { G } = turnContext;
  const REST_HEAL_PCT = 0.3;
  // sd28 Medical Arts: better healing on rest
  // Divine alignment: heroes heal MORE on a Rest (divine blessing). History: ×3 → ×2 (2026-09-11,
  // once the base became 30% of maximum HP and ×3 was near a full restore) → ×1.5 (2026-09-13,
  // "make it a multiplier, but only half of what it was" — the BONUS is halved, from +100% to
  // +50%, so the blessing stays a multiplier rather than becoming a flat addition). Rounded
  // UP, so the blessing is never worth nothing on a small pool.
  const isDivineKingdom = G.players[c.player]?.alignment === 'Divine';
  // Medical Arts: a single Rest fully restores HP (the discoveries' registry's since plan P1-19ad: "orderOutcome: a
  // realm's discoveries heal a resting hero in full")
  const _medArts = aRealmsDiscoveriesHealARestingHeroInFull(G.players[c.player]);
  const baseHeal = Math.max(1, Math.ceil((c.maxHp || 20) * REST_HEAL_PCT)); // 30% of maximum HP (was 2–5)
  let heal = _medArts ? Math.max(0, (c.maxHp || 20) - c.hp) : isDivineKingdom ? Math.ceil(baseHeal * 1.5) : baseHeal;
  if (charMinor(turnContext, c, 'colossus')) heal += 2; // MINOR TITLE — The Colossus
  heal += whatARealmsDiscoveriesAddToARestsHeal(G.players[c.player], {
    isItHisRealmsGround: prov.owner === c.player,
    isItHisRealmsHome: () => homeFounderOf(G, prov.id) === c.player,
    theGround: prov.terrain,
  }); // rest discoveries (the discoveries' registry's since plan P1-19ad: "orderOutcome: a realm's discoveries add to a
  // rest's heal"; the home is a question, asked only by an effect for the home, on the realm's ground, as before)
  heal += theHealTheRestersItemsAdd({ hisMaximumHp: c.maxHp || 20 }, activeItems(c)); // Iron Heart Talisman: +10% of max HP recovered (the items' registry, plan P1-19o)
  c.hp = Math.min(c.maxHp || 20, c.hp + heal);
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: 'a hero rests and recovers',
      heroName: c.name,
      healed: heal,
      hp: c.hp,
      maxHp: c.maxHp,
      isDivine: isDivineKingdom,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
  });
  return;
}
// Research Breakthrough (Sage 7): a discovery the realm can make, chosen by the dice, with no roll to fail.
export function resolveResearchBreakthroughOrder(turnContext, c) {
  const { G } = turnContext;
  if (skillLevel(c, 'sage') < 7) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Sage mastery for a Research Breakthrough', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const player = G.players[c.player];
  if (!player.discoveries) player.discoveries = [];
  const known = new Set(player.discoveries.map((d) => d.id));
  const available = discAvailableFor(turnContext, c.player, known); // race/alignment eligibility
  if (available.length === 0) {
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'a Research Breakthrough finds every discovery already made', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    trySkillGain(turnContext, c, 'sage', SKILLGAIN_STD);
    return;
  }
  const disc = available[Math.floor(kcRng() * available.length)];
  player.discoveries.push({
    id: disc.id,
    name: disc.name,
    category: disc.category,
    desc: disc.desc,
    turnDiscovered: G.turn,
  });
  TM(c).discoveries += 1;
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: 'a Research Breakthrough makes a discovery',
      heroName: c.name,
      discoveryName: disc.name,
      discoveryCategory: disc.category,
      discoveryDescription: disc.desc,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
  });
  trySkillGain(turnContext, c, 'sage', SKILLGAIN_STD);
  return;
}
