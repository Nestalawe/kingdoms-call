import { kcRng } from '../rng.js';
import { temperOf } from '../world/tables.js';
import { gainedItemNote, hasItemBase } from '../items/equipment.js';
import { applyItemMaxHp, pcFoeCat, transferableItems } from './helpers.js';
import { dispFloor } from '../dice-and-army-names.js';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.js';
import {
  SKILLGAIN_COMMON,
  SKILLGAIN_STD,
  awardHpRoll,
  trySkillGain,
} from '../heroes/experience-skill-rises-and-earned-hp.js';
import { pcSpeedOf } from './speed-encounter-plans-and-combatants.js';
import { pcHitChance, pcMeleeDamage, pcPerkWord, pcRoundStart, pcTakeHit } from './to-hit-wounds-stuns-and-courage.js';
import { pcAttemptFlee } from './melee-flight-and-archery.js';
import { pcAct } from './tactics-combat-items-and-actions.js';

// ── PERSONAL COMBAT: THE FIGHT (plan P1-08e: lifted out of resolveTurn) ────
// resolvePersonalCombat runs a whole personal fight between two combatants, round by round. It takes the turn's
// context first (src/engine/turn/context.js).
// --- Main entry: run a personal combat between two combatants ---------------- Combat runs up to
// 16 rounds. Each round both sides take exactly one action from their plan, the
// faster/higher-initiative side going first — a strict back-and-forth. opts: {maxRounds,
// feature}. Returns {winner, loser, fledBy, parley, stoleBy, aHp, bHp, narrative}
export function resolvePersonalCombat(turnContext, A, B, opts) {
  const { G } = turnContext;
  opts = opts || {};
  const maxRounds = opts.maxRounds || 20;
  const narrative = [];
  A._foeCat = pcFoeCat(B);
  B._foeCat = pcFoeCat(A); // 2026-09-10 armour: nature-keyed wards (Serpent-Scale / Grave-Iron) read the striker's kind
  A._foe = B;
  B._foe = A; // guardian weaknesses need the striker (race / realm alignment). Personal combat is strictly 1v1, so one pointer is enough.
  A._armFirstHitUsed = false;
  B._armFirstHitUsed = false;
  A._armSecondWindUsed = false;
  B._armSecondWindUsed = false;
  A._roundNo = 0;
  B._roundNo = 0;
  A._roundWardLeft = 0;
  B._roundWardLeft = 0;
  A._openGuardUsed = 0;
  B._openGuardUsed = 0;
  const state = {
    fledBy: null,
    parley: false,
    stoleBy: null,
    range: 'spell',
    mirror: null,
    feature: opts.feature || null,
  }; // all combats begin at Spell range
  // ── DRUID 3+ beast ward ── decided once, at the joining of the fight: a character of Druid 3
  // or better facing a NATURAL creature (beast or vermin) takes half damage from it. Undead,
  // fiends, constructs, dragons, giants, fey and aberrations are outside a druid's understanding,
  // and a commander whose Druid has been severed (Psychic Blast) loses the ward with it.
  const _PC_BEAST_CATS = new Set(['beast', 'vermin']);
  const _wardOf = (me, foe) => {
    if (!me || me.kind !== 'character' || !me.ref || me.ref._druidNegated) return 0;
    if (!foe || foe.kind !== 'monster' || !_PC_BEAST_CATS.has(String(foe.cat || ''))) return 0;
    let lvl = Math.min(5, effStat(turnContext, me.ref, 'druid'));
    if (me.ref._curseHalveStat === 'druid') lvl = Math.floor(lvl / 2);
    return lvl >= 3 ? lvl : 0;
  };
  A.druidBeastWard = _wardOf(A, B);
  B.druidBeastWard = _wardOf(B, A);
  // ── Guardian passives ── announced once; an aura is a standing to-hit penalty on the foe.
  for (const [me, foe] of [
    [A, B],
    [B, A],
  ]) {
    if (me.kind === 'monster' && (me.perks || []).length)
      me.perks.forEach((p) => narrative.push(`  🜏 ${me.name} — ${p.name}: ${p.desc}.`));
    else if (me.kind === 'monster' && me.passiveName)
      narrative.push(`  🜏 ${me.name} — ${me.passiveName}: ${me.passiveDesc}.`);
    if (me.aura > 0) {
      foe.status.auraPenalty = (foe.status.auraPenalty || 0) + me.aura;
    }
  }
  if (A.druidBeastWard)
    narrative.push(
      `  🍃 ${A.name} has hunted this kind before — the beast's blows will land at half force (Druid ${A.druidBeastWard}).`,
    );
  if (B.druidBeastWard)
    narrative.push(
      `  🍃 ${B.name} has hunted this kind before — the beast's blows will land at half force (Druid ${B.druidBeastWard}).`,
    );
  // Initiative: speed first, then raw martial skill; ties broken at random.
  const initA = pcSpeedOf(A) * 10 + (A.melee || 0) + (A.archery || 0) + kcRng();
  const initB = pcSpeedOf(B) * 10 + (B.melee || 0) + (B.archery || 0) + kcRng();
  const first = initA >= initB ? A : B,
    second = first === A ? B : A;
  narrative.push(`  ${first.name} has the initiative. The fight opens at spell range.`);

  // One "mirror round": the victim fights their phantom (an even duel) while the caster
  // concentrates. Shared by the round-start mirror branch and the same-round hook below.
  const _mirrorExchange = () => {
    const { caster, victim, phantasm } = state.mirror;
    narrative.push(`  🪞 ${victim.name} fights their own mirror image while ${caster.name} concentrates.`);
    // the VICTIM fights the phantom with their own Encounter Plan too
    // (spells, arrows, tactics), not a bare sword-swing — "the two mirror images fight it out" on
    // equal terms. The victim's plan pointer, spell limits and status are their real ones (to
    // them the phantom IS the enemy), but the fight runs in an isolated state so a
    // flee/parley/steal against the phantom can never end or re-range the real duel. A stunned
    // victim stands helpless.
    {
      const _vstate = { fledBy: null, parley: false, stoleBy: null, range: 'melee', mirror: null, feature: null };
      pcAct(turnContext, victim, phantasm, narrative, _vstate);
      if (_vstate.fledBy)
        narrative.push(
          `    …but there is no escaping one's own reflection — the phantom is on ${victim.name} again at once.`,
        );
      if (_vstate.mirror) narrative.push(`    …but an illusion cast upon an illusion finds no purchase, and fades.`);
    }
    // the phantom fights back exactly as the mirrored character would — it runs THEIR Encounter
    // Plan (from the start), so a spell-caster's reflection hurls the same spells, an archer's
    // looses arrows, and so on. It acts in its own isolated combat state (fresh range, no shared
    // feature/terminal flags) so a phantom can never "flee", "parley" or change the real fight's
    // range; only the damage/effects it lands on the victim
    // (a shared object) persist.
    if (phantasm.hp > 0) {
      const _mstate = { fledBy: null, parley: false, stoleBy: null, range: 'melee', mirror: null, feature: null };
      pcAct(turnContext, phantasm, victim, narrative, _mstate);
    }
    if (phantasm.hp <= 0) {
      narrative.push(`  🪞 ${victim.name} shatters the phantom — the illusion ends.`);
      state.mirror = null;
    } else if (state.mirror && --state.mirror.life <= 0) {
      narrative.push(`  🪞 The phantom of ${victim.name} thins to nothing of its own accord.`);
      state.mirror = null;
    }
    if (victim.hp <= 0) {
      narrative.push(`  ${victim.name} is struck down by their own mirror image!`);
      state.mirror = null;
    }
  };

  // Step marks for Beg-for-Mercy narration: any death not caused through pcTakeHit (lingering
  // harm, auras, thorns) is pinned to the START of the step that caused it.
  const _stepMark = () => ({ n: narrative.length, a: A.hp, b: B.hp });
  // item 16: the lowest each side's HP has fallen, so a wound later healed in the fight still counts
  A._hpStart = A.hp;
  B._hpStart = B.hp;
  A._hpLow = A.hp;
  B._hpLow = B.hp;
  const _noteLow = () => {
    A._hpLow = Math.min(A._hpLow, A.hp);
    B._hpLow = Math.min(B._hpLow, B.hp);
  };
  const _stepCheck = (m) => {
    _noteLow();
    [
      [A, m.a],
      [B, m.b],
    ].forEach(([cb, h]) => {
      if (h > 0 && cb.hp <= 0 && cb.kind === 'character') {
        const fm = cb._fatalMark;
        if (!(fm && fm.arr === narrative && fm.idx >= m.n)) cb._fatalMark = { arr: narrative, idx: m.n, blow: null };
      }
    });
  };
  A._fatalMark = null;
  B._fatalMark = null;
  for (let round = 0; round < maxRounds; round++) {
    if (A.hp <= 0 || B.hp <= 0 || state.fledBy || state.parley || state.stoleBy) break;
    let _sm = _stepMark();
    pcRoundStart(A, narrative);
    pcRoundStart(B, narrative);
    _stepCheck(_sm);
    _sm = _stepMark();
    A._fleeAttempted = false;
    B._fleeAttempted = false;
    // Guardian burn aura: a foe standing at melee range is scorched / frozen each round (never
    // soaked).
    if (state.range === 'melee')
      for (const [me, foe] of [
        [A, B],
        [B, A],
      ]) {
        if (me.burn > 0 && me.hp > 0 && foe.hp > 0) {
          foe.hp -= me.burn;
          narrative.push(
            `  🜏 ${pcPerkWord(me, 'burn', 'The aura')} sears ${foe.name} for ${me.burn}. (HP ${Math.max(0, Math.round(foe.hp))})`,
          );
        }
      }
    _stepCheck(_sm);
    _sm = _stepMark();
    if (A.hp <= 0 || B.hp <= 0) break;

    // ── Mirror Image: while an illusion fights, the victim battles their own phantom and the
    // caster concentrates (no other actions). Each round the victim may disbelieve.
    if (state.mirror) {
      const { caster, victim, phantasm } = state.mirror;
      // Disbelief chance: characters = 4% × total of all their skill levels; monsters = tougher =
      // harder to fool.
      let disbelief;
      if (victim.kind === 'character' && victim.ref && victim.ref.skills) {
        disbelief = 4 * Object.values(victim.ref.skills).reduce((s, v) => s + (v || 0), 0);
      } else {
        disbelief = 5 + 3 * (victim.melee || 0);
      }
      if (caster && caster.ref && hasItemBase(caster.ref, 'Mirror Shard')) disbelief *= 0.5; // Mirror Shard: harder to disbelieve
      disbelief = Math.max(2, Math.min(90, disbelief));
      if (kcRng() * 100 < disbelief) {
        narrative.push(
          `  ✨ ${victim.name} sees through the illusion (${disbelief.toFixed(0)}% disbelief) — the phantom dissolves and the real fight resumes.`,
        );
        state.mirror = null;
        // fall through to a normal round below
      } else {
        _mirrorExchange();
        // the caster's own action still happens. The victim is the one whose round is spent — on
        // the illusion — which is what the spell is FOR. Guarded on both being alive and on the
        // caster not having been the one struck down inside the exchange.
        if (caster.hp > 0 && victim.hp > 0) pcAct(turnContext, caster, victim, narrative, state);
        _stepCheck(_sm);
        continue; // the victim has already acted, against the phantom
      }
    }

    // ── The exchange: one action each, initiative first ──
    for (const actor of [first, second]) {
      const foe = actor === A ? B : A;
      if (actor.hp <= 0 || foe.hp <= 0) break;
      _stepCheck(_sm);
      _sm = _stepMark();
      const _mirrorBefore = state.mirror;
      pcAct(turnContext, actor, foe, narrative, state);
      // 2026-09-10 item 2: if this action just conjured a Mirror Image and the victim has NOT yet
      // acted this round (caster held the initiative), the victim's action goes against the
      // phantom at once — they must not get a free swing at the concentrating caster before the
      // illusion takes hold.
      if (!_mirrorBefore && state.mirror && actor === first && state.mirror.victim === second && second.hp > 0) {
        _mirrorExchange(); // the victim's action this round goes to the phantom, not to the caster
        break;
      }
      // consume queued free attacks (Psychic Blast) — only land as strikes at melee range
      let free = actor._freeAttacks || 0;
      while (free > 0 && foe.hp > 0 && state.range === 'melee') {
        const hit = pcHitChance(turnContext, actor, foe);
        if (kcRng() * 100 < hit) {
          const dmg = pcMeleeDamage(actor, foe);
          narrative.push(`  ⚔ ${actor.name} takes a free strike at ${foe.name}!`);
          const dealt = pcTakeHit(turnContext, foe, dmg, narrative, actor.name, 'free strike');
          if (dealt)
            narrative.push(
              `  ${actor.name}'s free strike lands for ${dealt} damage! (${foe.name} HP ${Math.max(0, Math.round(foe.hp))})`,
            );
        }
        /* 2026-09-23: announced before the armour line, as the counterattack */ free--;
      }
      actor._freeAttacks = 0;
      // Rebirth (Phoenix and kin): a banked resurrection is spent the moment it falls.
      if (foe.hp <= 0 && foe._rebirth) {
        foe._rebirth = false;
        foe.hp = Math.max(5, Math.round(foe.maxHp * 0.4));
        narrative.push(`  🔥 ${foe.name} bursts into ash — then blazes back to life! (HP ${foe.hp})`);
      }
      if (actor.hp <= 0 && actor._rebirth) {
        actor._rebirth = false;
        actor.hp = Math.max(5, Math.round(actor.maxHp * 0.4));
        narrative.push(`  🔥 ${actor.name} bursts into ash — then blazes back to life! (HP ${actor.hp})`);
      }
      if (state.fledBy || state.parley || state.stoleBy || foe.hp <= 0 || actor.hp <= 0) break;
    }
    _stepCheck(_sm);
    _sm = _stepMark();

    // ── Second Wind: a level-headed fighter steadies themselves once, when the fight turns. ──
    for (const cbt of [A, B]) {
      const tt = temperOf(cbt.temper);
      if (!tt.secondWind || cbt._secondWindUsed || cbt.hp <= 0) continue;
      if (cbt.hp / (cbt.maxHp || 20) >= tt.fleeAt + 0.05) continue;
      cbt._secondWindUsed = true;
      const back = Math.max(1, Math.round((cbt.maxHp || 20) * tt.secondWind));
      cbt.hp = Math.min(cbt.maxHp || 20, cbt.hp + back);
      narrative.push(
        `  💪 ${cbt.name} (${cbt.temper}) finds their second wind and fights on — ${back} HP recovered. (HP ${dispFloor(cbt.hp)})`,
      );
    }

    // ── Flight from Combat (AK §2.4): a fighter's Temper may make them break off when death
    // nears ──
    if (!state.fledBy && !state.parley && !state.stoleBy) {
      for (const cbt of [A, B]) {
        if (cbt.hp <= 0 || cbt.neverFlees) continue;
        if (cbt.status && cbt.status.stun > 0) continue; // a Psychic-Blasted mind cannot even run
        const foe = cbt === A ? B : A;
        if (foe.hp <= 0) continue;
        const tt = temperOf(cbt.temper);
        const ratio = cbt.hp / (cbt.maxHp || 20);
        // Even a Berserk has a breaking point — it is just a very late and unreliable one.
        const wants = ratio < tt.fleeAt && !(tt.losingOnly && cbt.hp >= foe.hp);
        if (cbt._fleeAttempted) continue; // already tried (and failed) to flee as this round's action
        if (wants && kcRng() < tt.fleeUrge) {
          if (pcAttemptFlee(turnContext, cbt, foe, narrative, state, 'temper')) break; // items 3–5: shared flee routine
          if (cbt.hp <= 0) break; // the free strike finished them
        }
      }
      if (state.fledBy) break;
    }
    _stepCheck(_sm);
  }
  // Write back HP to underlying characters.
  [A, B].forEach((cbt) => {
    if (cbt.kind === 'character' && cbt.ref) {
      cbt.ref.hp = Math.max(0, Math.round(cbt.hp));
    }
  });
  // ── Begging for Mercy (AK §2.4): a Cowardly fighter felled in combat may plead and be spared,
  // fleeing the field instead of dying. It works best against Good/similar alignments. ──
  // NARRATION (2026-09-21, Toby): the plea is told JUST BEFORE the killing blow, not after the
  // fighter has already been described falling. `_fatalMark` (set in pcTakeHit, or by the round's
  // step marks) says where that blow began in the narrative. Granted → the blow is stayed: the
  // lines of the blow are dropped (private skill-rise markers are kept) and the coward escapes.
  // Refused → the plea is spliced in before the blow, which then falls as already written.
  // The odds, the roll and every consequence are exactly as before — only the telling moved.
  let _mercyShift = []; // [index, lines inserted] — keeps a second combatant's mark true after a splice
  const _mercyAt = (fm) => {
    let at = fm && fm.arr === narrative && fm.idx <= narrative.length ? fm.idx : narrative.length;
    _mercyShift.forEach(([ix, n]) => {
      if (ix <= at) at += n;
    });
    return Math.min(at, narrative.length);
  };
  const _pick = (arr) => arr[Math.floor(kcRng() * arr.length)];
  for (const cbt of [A, B]) {
    const foe = cbt === A ? B : A;
    if (cbt.hp <= 0 && cbt.kind === 'character' && temperOf(cbt.temper).mercy && !state.fledBy && !cbt._begged) {
      const foeAlign = foe.alignment || (foe.ref && foe.ref.alignment) || '';
      let mercy = 50;
      if (foeAlign === 'Good' || foeAlign === 'Divine' || foeAlign === 'Druidic') mercy = 75;
      else if (foeAlign === 'Evil' || foeAlign === 'Undead') mercy = 20;
      const _r = kcRng() * 100,
        _granted = _r < mercy,
        _shown = Math.floor(_r) + 1; // same odds as ever; shown as a d100
      const fm = cbt._fatalMark;
      const _blow = !!(fm && fm.blow); // a struck blow (not lingering harm or an aura)
      const at = _mercyAt(fm);
      const who = cbt.name,
        foeWho = foe.kind === 'monster' ? `the ${foe.name}` : foe.name,
        FoeWho = foe.kind === 'monster' ? `The ${foe.name}` : foe.name;
      const _odds = ` (${mercy}% chance of mercy) [roll ${_shown}${_granted ? ' ✓' : ' ✗'}]`;
      // what kind of killing blow is coming: a weapon stroke, an arrow, or a spell / power
      const _k = String((fm && fm.kind) || '');
      const _cls = /^(blow|free strike|counterattack)$/i.test(_k)
        ? 'melee'
        : /arrow|shot/i.test(_k)
          ? 'ranged'
          : 'power';
      const _pow = _k && _cls === 'power' ? _k : 'its power';
      const plea = !_blow
        ? `  🙏 As their strength fails and death closes in, ${who} begs ${foeWho} for mercy!${_odds}`
        : _cls === 'ranged'
          ? _pick([
              `  🙏 As ${foeWho} draws for the killing shot, ${who} throws down their weapon and begs for their life!${_odds}`,
              `  🙏 Pinned and bleeding, ${who} cries out for mercy before the last arrow can fly!${_odds}`,
            ])
          : _cls === 'power'
            ? `  🙏 As ${foeWho} readies ${_pow} for the killing stroke, ${who} falls to their knees and begs to be spared!${_odds}`
            : _pick([
                `  🙏 Beaten and bleeding, ${who} sees the killing blow coming — they throw down their weapon and beg ${foeWho} for their life!${_odds}`,
                `  🙏 As ${foeWho} closes for the kill, ${who} flings up their hands and cries out for mercy!${_odds}`,
                `  🙏 ${who} drops to their knees before the final stroke can fall, pleading to be spared!${_odds}`,
              ]);
      const _falls =
        _cls === 'ranged'
          ? ' The arrow flies.'
          : _cls === 'power'
            ? ` ${_pow === 'its power' ? 'The power' : 'The ' + _pow} is loosed.`
            : ' The blow falls.';
      if (_granted) {
        cbt.hp = 1;
        if (cbt.ref) cbt.ref.hp = 1;
        cbt._begged = true;
        state.fledBy = cbt;
        const spared =
          foe.kind === 'monster'
            ? `  ${FoeWho} pauses over its prey — and, for reasons of its own, lets ${who} crawl away. ${who} flees the field with their life. (HP 1)`
            : !_blow
              ? `  ${FoeWho} lets them go — ${who} staggers from the field with their life. (HP 1)`
              : _cls === 'ranged'
                ? `  ${FoeWho} lowers their bow. "Go, while you still can." ${who} flees the field with their life. (HP 1)`
                : _cls === 'power'
                  ? `  ${FoeWho} lets ${_pow} die unspent and waves ${who} away. ${who} flees the field with their life. (HP 1)`
                  : _pick([
                      `  ${FoeWho} stays the blow. "Go — and never let me see your face again." ${who} scrambles away and flees the field with their life. (HP 1)`,
                      `  ${FoeWho} lowers their weapon in disgust and lets ${who} go. ${who} flees the field, alive but broken. (HP 1)`,
                      `  The stroke never falls — ${foeWho} spares them. ${who} stumbles from the field with their life. (HP 1)`,
                    ]);
        if (_blow) {
          // the killing blow never landed: drop its lines, keep the owner's private skill markers
          const tail = narrative.splice(at);
          const kept = tail.filter((x) => typeof x !== 'string' || /^\s*(📈|🎉|💰)/.test(x));
          narrative.push(plea, spared, ...kept);
        } else {
          narrative.push(plea, spared);
        }
        // Consequences of a spared coward (design update): they are broken for the rest of the
        // turn
        // (all remaining actions lost), slink back to their home province by next turn, and yield a
        // random magic item to the victor as the price of their life.
        if (cbt.ref) {
          cbt.ref._mercyFledTurn = G.turn; // out of action this turn; relocated home at end of turn
          const _giveable = transferableItems(cbt.ref.items); // a granted Mithril suit is never surrendered
          if (foe && foe.kind === 'character' && foe.ref && _giveable.length > 0) {
            const _lost = _giveable[Math.floor(kcRng() * _giveable.length)];
            cbt.ref.items.splice(cbt.ref.items.indexOf(_lost), 1);
            applyItemMaxHp(cbt.ref, _lost);
            foe.ref.items = foe.ref.items || [];
            foe.ref.items.push(_lost);
            narrative.push(`  🎒 ${cbt.name} surrenders ${_lost.name} to ${foe.name} as the price of mercy.`);
            {
              const _gn = gainedItemNote(foe.ref, [_lost]);
              if (_gn) narrative.push('  ' + _gn);
            } // item 10
          }
        }
      } else {
        const refused =
          foe.kind === 'monster'
            ? `  ${FoeWho} knows nothing of mercy.${_blow ? _falls : ''}`
            : foeAlign === 'Evil' || foeAlign === 'Undead'
              ? `  ${FoeWho} laughs at the plea.${_blow ? _falls : ''}`
              : _pick([
                  `  ${FoeWho} is deaf to the plea.${_blow ? _falls : ''}`,
                  `  There is no pity in ${foeWho} today.${_blow ? _falls : ''}`,
                ]);
        if (_blow) {
          narrative.splice(at, 0, plea, refused);
          _mercyShift.push([at, 2]);
        } else narrative.push(plea, refused);
      }
    }
  }
  let winner = null,
    loser = null;
  if (!state.fledBy && !state.parley && !state.stoleBy) {
    if (A.hp <= 0 && B.hp <= 0) {
      winner = A.melee >= B.melee ? A : B;
      loser = winner === A ? B : A;
      winner.hp = 1;
      if (winner.ref) winner.ref.hp = 1;
    } else if (A.hp <= 0) {
      winner = B;
      loser = A;
    } else if (B.hp <= 0) {
      winner = A;
      loser = B;
    }
  }
  // Skill gains: the victor who landed blows improves the matching skill; a thief who stole
  // improves Thief. Pass the encounter narrative so these lines appear at the END of the
  // encounter report (like battle-driven gains) instead of being log()'d mid-resolution — which
  // landed them ABOVE the encounter report, i.e. at the top of the phase in the player Chronicle.
  // 2026-09-29 (Toby): melee/archery experience is now rolled per successful hit as it lands
  // (pcCombatXP) — the old single end-of-fight roll for the victor is retired.
  if (state.stoleBy && state.stoleBy.kind === 'character' && state.stoleBy.ref)
    trySkillGain(turnContext, state.stoleBy.ref, 'thief', SKILLGAIN_STD, narrative);
  // ── 2026-10-08 (Toby item 16): WOUNDS HARDEN TOO ── every hero who took at least 1 HP of damage in
  // the fight rolls for maximum HP at its end, as the winner always has. The winner is left to the
  // win award (awardWinHp: kill, lair cleared, a duel's field held), which rolls once with +1 for the
  // victory, so no hero rolls twice for one fight. A hero who has fallen does not roll; forecasts
  // (simulated fights on copies) never do.
  _noteLow();
  if (!turnContext._pcSimulating) {
    const _winSide = winner || (opts.heldFieldWins && state.fledBy ? (state.fledBy === A ? B : A) : null);
    // 2026-10-14 (batch item 12, Toby): ANY HERO WHO WINS A FIGHT rolls for Melee experience at the
    // standard rate, on top of the rolls for each blow, arrow or spell that landed (trySkillGain's
    // own guards keep it to one rise of a skill a phase and a turn).
    if (_winSide && _winSide.kind === 'character' && _winSide.ref && _winSide.hp > 0)
      trySkillGain(turnContext, _winSide.ref, 'melee', SKILLGAIN_STD, narrative);
    // 2026-10-14 (batch item 11, Toby): a hero who LOSES a fight and lives — beaten and spared, or
    // fled — learns a little: Melee at the small frequent-action rate.
    for (const X of [A, B]) {
      if (X.kind !== 'character' || !X.ref || X.hp <= 0 || X === _winSide) continue;
      const _lost = (winner && winner !== X) || state.fledBy === X || (_winSide && _winSide !== X);
      if (_lost) trySkillGain(turnContext, X.ref, 'melee', SKILLGAIN_COMMON, narrative);
    }
    for (const X of [A, B]) {
      if (X === _winSide || X.kind !== 'character' || !X.ref || X.hp <= 0) continue;
      if (!(X._hpLow <= X._hpStart - 1)) continue;
      const real = X.ref.id != null ? (G.characters || []).find((r) => r && r.id === X.ref.id) : null;
      if (!real || real.alive === false) continue;
      const r = awardHpRoll(turnContext, X.ref, narrative, 'wound', false);
      if (r && r.gain > 0) {
        X.hp += r.gain;
        X.maxHp += r.gain;
      } // the rise heals into the new headroom, as on the real record
    }
  }
  return {
    winner,
    loser,
    fledBy: state.fledBy,
    parley: state.parley,
    stoleBy: state.stoleBy,
    aHp: Math.max(0, Math.round(A.hp)),
    bHp: Math.max(0, Math.round(B.hp)),
    narrative,
  };
}
