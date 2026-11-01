import { kcRng } from '../rng.ts';
import { temperOf } from '../world/tables.ts';
import { activeItems, hasItemBase, settleTheItemsAHeroGained } from '../items/equipment.ts';
import { applyItemMaxHp, transferableItems } from './helpers.ts';
import { pcFoeCat } from '../titles/perks.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import {
  SKILLGAIN_COMMON,
  SKILLGAIN_STD,
  awardHpRoll,
  trySkillGain,
} from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { pcSpeedOf } from './speed-encounter-plans-and-combatants.ts';
import { pcHitChance, pcMeleeDamage, pcRoundStart, pcTakeHit } from './to-hit-wounds-stuns-and-courage.ts';
import { pcAttemptFlee } from './melee-flight-and-archery.ts';
import { pcAct } from './tactics-combat-items-and-actions.ts';
import {
  isALineForEveryoneInTheFight,
  narrateAll,
  narrateAt,
  takeBackLinesFrom,
  narrate,
} from '../turn/events-and-their-audiences.ts';
import {
  aFightersPerkNameAsTheLineTellsIt,
  isAPersonalCombatsLine,
} from './the-facts-a-personal-combats-lines-record.ts';
import type {
  AFighterOfAPersonalCombat,
  TheFactOfAPersonalCombatsLine,
} from './the-facts-a-personal-combats-lines-record.ts';
import { asItsGuardReadsIt } from './to-hit-wounds-stuns-and-courage.ts';
import { theChanceAMirrorImageIsSeenThrough } from '../rules/the-registry-of-spell-effects.ts';
import {
  theAuraPenaltyAFightersAuraLaysOnHisFoe,
  theHarmAFightersBurnSearsHisFoeWith,
  whatAHerosItemsChangeInHisCombatSpells,
} from '../rules/the-registry-of-magic-item-effects.ts';
import type { Character, Item } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { AFatalMark, AFighterInAPersonalCombat } from './helpers.ts';
import type { AMirrorImageInAFight } from './combat-spells-and-guardian-abilities.ts';

// Its types (plan P1-10b16): each parameter typed as wide as the body's guards (plan P1-10's Decision 2), so each guard
// stays; a fighter is AFighterInAPersonalCombat (helpers.ts), and a value the code guards here but reads unguarded
// elsewhere is read through asItsGuardReadsIt (to-hit-wounds-stuns-and-courage.ts).
/** The fight's state as an action reads it (pcAct's, tactics-combat-items-and-actions.ts). */
type TheFightAsAnActionReadsIt = Parameters<typeof pcAct>[4];
/** The fight's state as the whole fight keeps it: who fled, stole or talked the guardian down, and the Mirror Image,
 *  each set from the start. */
type TheFightAsItIsKept = TheFightAsAnActionReadsIt & {
  fledBy: AFighterInAPersonalCombat | null;
  parley: boolean;
  stoleBy: AFighterInAPersonalCombat | null;
  mirror: AMirrorImageInAFight | null;
};
/** How a personal combat is run: its rounds at most, the lair it is fought at (none in a duel), and whether a side
 *  that holds the field when the other flees wins it (a duel's). */
interface HowAPersonalCombatIsRun {
  readonly maxRounds?: number | undefined;
  readonly feature?: TheFightAsAnActionReadsIt['feature'];
  readonly heldFieldWins?: boolean | undefined;
}
/** A fighter's hero as the fight reads and writes him (a guardian has none of these fields): the same object. His id
 *  may be a string (a Hunting Rumours copy's). */
type AHeroAsTheFightReadsHim = object & {
  readonly skills?: Character['skills'] | null | undefined;
  readonly _druidNegated?: unknown;
  readonly _curseHalveStat?: unknown;
  readonly id?: Character['id'] | string | null | undefined;
  hp?: number | undefined;
};
/** A hero of the world as the wound's roll finds him: his id, and whether he lives (an older save's may say none). */
interface AHeroAsTheWoundRollFindsHim {
  readonly id: Character['id'];
  readonly alive?: boolean | undefined;
}
/** A fighter's hero as the mercy reads and writes him (a guardian has none of these fields): the same object. */
type AHeroAsTheMercyReadsHim = object &
  Omit<NonNullable<Parameters<typeof applyItemMaxHp>[0]>, 'id' | 'items' | 'name' | 'alignment'> & {
    readonly name?: string | undefined;
    readonly alignment?: string | null | undefined;
    items?: Item[] | undefined;
    _mercyFledTurn?: number | undefined;
  };
/** A coward's plea for mercy, the foe sparing him, or the foe refusing him: the lines of a plea. */
type APleasLine = Extract<
  TheFactOfAPersonalCombatsLine,
  {
    kind:
      | 'as their strength fails a fighter begs the foe for mercy'
      | 'as the foe draws for the killing shot a fighter begs for their life'
      | 'pinned and bleeding a fighter cries out for mercy'
      | 'as the foe readies a power for the killing stroke a fighter begs'
      | 'beaten and bleeding a fighter sees the killing blow coming'
      | 'as the foe closes for the kill a fighter cries out for mercy'
      | 'a fighter drops to their knees before the final stroke'
      | 'the guardian pauses over its prey and lets a fighter crawl away'
      | 'the foe lets a fighter go'
      | 'the foe lowers their bow and lets a fighter go'
      | 'the foe lets a power die unspent'
      | 'the foe stays the blow and lets a fighter go'
      | 'the foe lowers their weapon in disgust and lets a fighter go'
      | 'the stroke never falls and the foe spares a fighter'
      | 'the foe knows nothing of mercy'
      | 'the foe laughs at the plea'
      | 'the foe is deaf to the plea'
      | 'there is no pity in the foe';
  }
>;
/** The fight's state as it is now: an action or a flight may have changed it since the code last tested it, which the
 *  compiler's narrowing doesn't see. The same object. */
function theFightAsItIsNow(fight: TheFightAsItIsKept): TheFightAsItIsKept {
  return fight;
}
/** Whether a hero's name is words, as every hero's is (the saved schema's, and the fight's lines name him by it). */
function hisNameIsWords<Hero extends { readonly name?: string | undefined }>(
  hero: Hero,
): hero is Hero & { readonly name: string } {
  return typeof hero.name === 'string';
}
/** A fighter's hero or guardian as his items are asked about (a guardian has none): the same object. */
type AHeroOrGuardianAsHisItemsAreAsked = object & NonNullable<Parameters<typeof hasItemBase>[0]>;
/** Each fighter and his foe, in the order the fight takes them. */
type EachFighterAndHisFoe = readonly (readonly [me: AFighterInAPersonalCombat, foe: AFighterInAPersonalCombat])[];

// ── PERSONAL COMBAT: THE FIGHT (plan P1-08e: lifted out of resolveTurn) ────
// resolvePersonalCombat runs a whole personal fight between two combatants, round by round. It takes the turn's
// context first (src/engine/turn/context.ts).
// --- Main entry: run a personal combat between two combatants ---------------- Combat runs up to
// 16 rounds. Each round both sides take exactly one action from their plan, the
// faster/higher-initiative side going first — a strict back-and-forth. opts: {maxRounds,
// feature}. Returns {winner, loser, fledBy, parley, stoleBy, aHp, bHp, narrative}
/** How a personal combat ends (resolvePersonalCombat's result): who won and lost (none for a draw, a flight, a parley
 *  or a theft), who fled or stole, whether the guardian was talked down, both sides' hit points left and the lines. */
interface HowAPersonalCombatEnds {
  winner: AFighterInAPersonalCombat | null;
  loser: AFighterInAPersonalCombat | null;
  fledBy: AFighterInAPersonalCombat | null;
  parley: boolean;
  stoleBy: AFighterInAPersonalCombat | null;
  aHp: number;
  bHp: number;
  narrative: NarrativeLine[];
}
export function resolvePersonalCombat(
  turnContext: TurnContext,
  A: AFighterInAPersonalCombat,
  B: AFighterInAPersonalCombat,
  opts?: HowAPersonalCombatIsRun | null,
): HowAPersonalCombatEnds {
  const { G } = turnContext;
  opts = opts ?? {};
  const maxRounds = (opts.maxRounds ?? 0) || 20;
  const narrative: NarrativeLine[] = [];
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
  const state: TheFightAsItIsKept = {
    fledBy: null,
    parley: false,
    stoleBy: null,
    range: 'spell',
    mirror: null,
    feature: opts.feature ?? null,
  }; // all combats begin at Spell range
  // ── DRUID 3+ beast ward ── decided once, at the joining of the fight: a character of Druid 3
  // or better facing a NATURAL creature (beast or vermin) takes half damage from it. Undead,
  // fiends, constructs, dragons, giants, fey and aberrations are outside a druid's understanding,
  // and a commander whose Druid has been severed (Psychic Blast) loses the ward with it.
  const _PC_BEAST_CATS = new Set(['beast', 'vermin']);
  const _wardOf = (
    me: AFighterInAPersonalCombat | null | undefined,
    foe: AFighterInAPersonalCombat | null | undefined,
  ) => {
    const myHero = me ? asItsGuardReadsIt<AHeroAsTheFightReadsHim>(me.ref) : null;
    if (me?.kind !== 'character' || !myHero || myHero._druidNegated) return 0;
    if (foe?.kind !== 'monster' || !_PC_BEAST_CATS.has(foe.cat ?? '')) return 0;
    let lvl = Math.min(5, effStat(turnContext, myHero, 'druid'));
    if (myHero._curseHalveStat === 'druid') lvl = Math.floor(lvl / 2);
    return lvl >= 3 ? lvl : 0;
  };
  A.druidBeastWard = _wardOf(A, B);
  B.druidBeastWard = _wardOf(B, A);
  // ── Guardian passives ── announced once; an aura is a standing to-hit penalty on the foe.
  const eachFighterAndHisFoe: EachFighterAndHisFoe = [
    [A, B],
    [B, A],
  ];
  for (const [me, foe] of eachFighterAndHisFoe) {
    if (me.kind === 'monster' && me.perks?.length)
      me.perks.forEach((p) => {
        narrate(narrative, { kind: "a guardian's perk is named", meName: me.name, pName: p.name, pDesc: p.desc });
      });
    else if (me.kind === 'monster' && me.passiveName)
      narrate(narrative, {
        kind: "a guardian's perk is named",
        meName: me.name,
        pName: me.passiveName,
        pDesc: me.passiveDesc,
      });
    // the items' registry's since plan P1-19ak: "personalCombat: the fight opens: a fighter's aura hinders his foe"
    const theFoesAuraPenalty = theAuraPenaltyAFightersAuraLaysOnHisFoe({
      theRiders: me,
      theFoesAuraPenaltySoFar: foe.status.auraPenalty,
    });
    if (theFoesAuraPenalty !== null) {
      foe.status.auraPenalty = theFoesAuraPenalty;
    }
  }
  if (A.druidBeastWard)
    narrate(narrative, {
      kind: 'a druid has hunted this kind of beast before',
      aName: A.name,
      aDruidBeastWard: A.druidBeastWard,
    });
  if (B.druidBeastWard)
    narrate(narrative, {
      kind: 'a druid has hunted this kind of beast before',
      aName: B.name,
      aDruidBeastWard: B.druidBeastWard,
    });
  // Initiative: speed first, then raw martial skill; ties broken at random.
  const initA = pcSpeedOf(A) * 10 + (A.melee || 0) + (A.archery || 0) + kcRng();
  const initB = pcSpeedOf(B) * 10 + (B.melee || 0) + (B.archery || 0) + kcRng();
  const first = initA >= initB ? A : B,
    second = first === A ? B : A;
  narrate(narrative, { kind: 'one fighter has the initiative', firstName: first.name });

  // One "mirror round": the victim fights their phantom (an even duel) while the caster
  // concentrates. Shared by the round-start mirror branch and the same-round hook below.
  const _mirrorExchange = () => {
    // called only with an illusion fighting (both callers test it first); the old destructuring threw without one
    if (!state.mirror) throw new TypeError("Cannot destructure property 'caster' of 'state.mirror' as it is null.");
    const { caster, victim, phantasm } = state.mirror;
    narrate(narrative, {
      kind: 'the victim fights their own mirror image',
      victimName: victim.name,
      casterName: caster.name,
    });
    // the VICTIM fights the phantom with their own Encounter Plan too
    // (spells, arrows, tactics), not a bare sword-swing — "the two mirror images fight it out" on
    // equal terms. The victim's plan pointer, spell limits and status are their real ones (to
    // them the phantom IS the enemy), but the fight runs in an isolated state so a
    // flee/parley/steal against the phantom can never end or re-range the real duel. A stunned
    // victim stands helpless.
    {
      const _vstate: TheFightAsItIsKept = {
        fledBy: null,
        parley: false,
        stoleBy: null,
        range: 'melee',
        mirror: null,
        feature: null,
      };
      pcAct(turnContext, victim, phantasm, narrative, _vstate);
      if (_vstate.fledBy)
        narrate(narrative, { kind: "but there is no escaping one's own reflection", victimName: victim.name });
      if (_vstate.mirror) narrate(narrative, { kind: 'but an illusion cast upon an illusion' });
    }
    // the phantom fights back exactly as the mirrored character would — it runs THEIR Encounter
    // Plan (from the start), so a spell-caster's reflection hurls the same spells, an archer's
    // looses arrows, and so on. It acts in its own isolated combat state (fresh range, no shared
    // feature/terminal flags) so a phantom can never "flee", "parley" or change the real fight's
    // range; only the damage/effects it lands on the victim
    // (a shared object) persist.
    if (phantasm.hp > 0) {
      const _mstate: TheFightAsItIsKept = {
        fledBy: null,
        parley: false,
        stoleBy: null,
        range: 'melee',
        mirror: null,
        feature: null,
      };
      pcAct(turnContext, phantasm, victim, narrative, _mstate);
    }
    const theMirrorNow = theFightAsItIsNow(state).mirror;
    if (phantasm.hp <= 0) {
      narrate(narrative, { kind: 'the victim shatters the phantom', victimName: victim.name });
      state.mirror = null;
    } else if (theMirrorNow && --theMirrorNow.life <= 0) {
      narrate(narrative, { kind: 'the phantom of the victim thins to nothing', victimName: victim.name });
      state.mirror = null;
    }
    if (victim.hp <= 0) {
      narrate(narrative, { kind: 'the victim is struck down by their own mirror image', victimName: victim.name });
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
    A._hpLow = Math.min(Number(A._hpLow), A.hp); // set at the fight's start; Math.min reads each as a number
    B._hpLow = Math.min(Number(B._hpLow), B.hp);
  };
  const _stepCheck = (m: ReturnType<typeof _stepMark>) => {
    _noteLow();
    const eachFighterAndHisHpAtTheMark: [fighter: AFighterInAPersonalCombat, hp: number][] = [
      [A, m.a],
      [B, m.b],
    ];
    eachFighterAndHisHpAtTheMark.forEach(([cb, h]) => {
      if (h > 0 && cb.hp <= 0 && cb.kind === 'character') {
        const fm = cb._fatalMark;
        if (!(fm?.arr === narrative && fm.idx >= m.n)) cb._fatalMark = { arr: narrative, idx: m.n, blow: null };
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
      for (const [me, foe] of eachFighterAndHisFoe) {
        // the items' registry's since plan P1-19ak: "personalCombat: a melee round: his burn"
        const theBurn = theHarmAFightersBurnSearsHisFoeWith(me);
        if (theBurn !== null && me.hp > 0 && foe.hp > 0) {
          foe.hp -= theBurn.theHarm;
          narrate(narrative, {
            kind: "a guardian's aura sears the foe",
            meBurnPerk: aFightersPerkNameAsTheLineTellsIt(me, theBurn.theRiderTheLineNames),
            foeName: foe.name,
            meBurn: theBurn.theHarm,
            foeHp: Math.max(0, Math.round(foe.hp)),
          });
        }
      }
    _stepCheck(_sm);
    _sm = _stepMark();
    if (A.hp <= 0 || B.hp <= 0) break;

    // ── Mirror Image: while an illusion fights, the victim battles their own phantom and the
    // caster concentrates (no other actions). Each round the victim may disbelieve.
    if (state.mirror) {
      const { caster, victim, phantasm } = state.mirror;
      // Disbelief chance (the spells' registry, plan P1-19x): a hero's by all his skill levels together; a guardian,
      // tougher, harder to fool; a Mirror Shard's half (the items' registry).
      const theVictimsHero = asItsGuardReadsIt<AHeroAsTheFightReadsHim>(victim.ref);
      const casterAsGuarded = asItsGuardReadsIt(caster);
      const theCastersHeroOrGuardian = casterAsGuarded
        ? asItsGuardReadsIt<AHeroOrGuardianAsHisItemsAreAsked>(casterAsGuarded.ref)
        : null;
      const disbelief = theChanceAMirrorImageIsSeenThrough({
        theVictimsSkillLevels:
          victim.kind === 'character' && theVictimsHero?.skills ? Object.values(theVictimsHero.skills) : null,
        theVictimsMelee: victim.melee,
        // a guardian's hoard or a hero's active items, as hasItemBase read them
        whatTheCastersItemsChange: () => whatAHerosItemsChangeInHisCombatSpells(activeItems(theCastersHeroOrGuardian)),
      });
      if (kcRng() * 100 < disbelief) {
        narrate(narrative, {
          kind: 'the victim sees through the illusion',
          victimName: victim.name,
          disbelief,
        });
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
      const _mirrorBefore = theFightAsItIsNow(state).mirror;
      pcAct(turnContext, actor, foe, narrative, state);
      // 2026-09-10 item 2: if this action just conjured a Mirror Image and the victim has NOT yet
      // acted this round (caster held the initiative), the victim's action goes against the
      // phantom at once — they must not get a free swing at the concentrating caster before the
      // illusion takes hold.
      const theMirrorNow = theFightAsItIsNow(state).mirror;
      if (!_mirrorBefore && theMirrorNow && actor === first && theMirrorNow.victim === second && second.hp > 0) {
        _mirrorExchange(); // the victim's action this round goes to the phantom, not to the caster
        break;
      }
      // consume queued free attacks (Psychic Blast) — only land as strikes at melee range
      let free = (actor._freeAttacks ?? 0) || 0;
      while (free > 0 && foe.hp > 0 && state.range === 'melee') {
        const hit = pcHitChance(turnContext, actor, foe);
        if (kcRng() * 100 < hit) {
          const dmg = pcMeleeDamage(actor, foe);
          narrate(narrative, {
            kind: 'a fighter takes a free strike at the foe',
            actorName: actor.name,
            foeName: foe.name,
          });
          const dealt = pcTakeHit(turnContext, foe, dmg, narrative, actor.name, 'free strike');
          if (dealt)
            narrate(narrative, {
              kind: "a fighter's free strike lands",
              actorName: actor.name,
              dealt,
              foeName: foe.name,
              foeHp: Math.max(0, Math.round(foe.hp)),
            });
        }
        /* 2026-09-23: announced before the armour line, as the counterattack */ free--;
      }
      actor._freeAttacks = 0;
      // Rebirth (Phoenix and kin): a banked resurrection is spent the moment it falls.
      if (foe.hp <= 0 && foe._rebirth) {
        foe._rebirth = false;
        foe.hp = Math.max(5, Math.round(foe.maxHp * 0.4));
        narrate(narrative, {
          kind: 'the foe bursts into ash then blazes back to life',
          foeName: foe.name,
          foeHp: foe.hp,
        });
      }
      if (actor.hp <= 0 && actor._rebirth) {
        actor._rebirth = false;
        actor.hp = Math.max(5, Math.round(actor.maxHp * 0.4));
        narrate(narrative, {
          kind: 'the foe bursts into ash then blazes back to life',
          foeName: actor.name,
          foeHp: actor.hp,
        });
      }
      const theFightNow = theFightAsItIsNow(state);
      if (theFightNow.fledBy || theFightNow.parley || theFightNow.stoleBy || foe.hp <= 0 || actor.hp <= 0) break;
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
      narrate(narrative, {
        kind: 'a fighter finds their second wind and fights on',
        cbtName: cbt.name,
        cbtTemper: cbt.temper,
        back,
        cbtHp: dispFloor(cbt.hp),
      });
    }

    // ── Flight from Combat (AK §2.4): a fighter's Temper may make them break off when death
    // nears ──
    const theFightNow = theFightAsItIsNow(state);
    if (!theFightNow.fledBy && !theFightNow.parley && !theFightNow.stoleBy) {
      for (const cbt of [A, B]) {
        if (cbt.hp <= 0 || cbt.neverFlees) continue;
        const hisStatus = asItsGuardReadsIt(cbt.status);
        if (hisStatus && hisStatus.stun > 0) continue; // a Psychic-Blasted mind cannot even run
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
      if (theFightAsItIsNow(state).fledBy) break;
    }
    _stepCheck(_sm);
  }
  // Write back HP to underlying characters.
  [A, B].forEach((cbt) => {
    const hisHero = asItsGuardReadsIt<AHeroAsTheFightReadsHim>(cbt.ref);
    if (cbt.kind === 'character' && hisHero) {
      hisHero.hp = Math.max(0, Math.round(cbt.hp));
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
  let _mercyShift: [index: number, inserted: number][] = []; // [index, lines inserted] — keeps a second combatant's mark true after a splice
  const _mercyAt = (fm: AFatalMark | null | undefined) => {
    let at = fm?.arr === narrative && fm.idx <= narrative.length ? fm.idx : narrative.length;
    _mercyShift.forEach(([ix, n]) => {
      if (ix <= at) at += n;
    });
    return Math.min(at, narrative.length);
  };
  // one of a few lines, by the dice (each list holds two or three, so the dice always find one)
  const _pick = <Line>(arr: readonly Line[]): Line => {
    const one = arr[Math.floor(kcRng() * arr.length)];
    if (one === undefined) throw new TypeError('no line at that place');
    return one;
  };
  for (const cbt of [A, B]) {
    const foe = cbt === A ? B : A;
    if (cbt.hp <= 0 && cbt.kind === 'character' && temperOf(cbt.temper).mercy && !state.fledBy && !cbt._begged) {
      const theFoesHero = asItsGuardReadsIt<AHeroAsTheMercyReadsHim>(foe.ref);
      const foeAlign = (foe.alignment ?? '') || (theFoesHero?.alignment ?? '');
      let mercy = 50;
      if (foeAlign === 'Good' || foeAlign === 'Divine' || foeAlign === 'Druidic') mercy = 75;
      else if (foeAlign === 'Evil' || foeAlign === 'Undead') mercy = 20;
      const _r = kcRng() * 100,
        _granted = _r < mercy,
        _shown = Math.floor(_r) + 1; // same odds as ever; shown as a d100
      const fm = cbt._fatalMark;
      const _blow = !!fm?.blow; // a struck blow (not lingering harm or an aura)
      const at = _mercyAt(fm);
      const who = cbt.name,
        // The foe as the lines' facts hold him (plan P1-12d25): the prose writes "the <name>" or "The <name>" for a
        // guardian, else his name (theLabelOfAFighter).
        foeWho: AFighterOfAPersonalCombat = { name: foe.name, isAGuardian: foe.kind === 'monster' };
      const _odds = { mercy, shown: _shown, granted: _granted };
      // what kind of killing blow is coming: a weapon stroke, an arrow, or a spell / power
      const _k = fm?.kind ?? '';
      const _cls = /^(blow|free strike|counterattack)$/i.test(_k)
        ? 'melee'
        : /arrow|shot/i.test(_k)
          ? 'ranged'
          : 'power';
      const plea: APleasLine = !_blow
        ? { kind: 'as their strength fails a fighter begs the foe for mercy', who, foeWho, odds: _odds }
        : _cls === 'ranged'
          ? _pick<APleasLine>([
              { kind: 'as the foe draws for the killing shot a fighter begs for their life', foeWho, who, odds: _odds },
              { kind: 'pinned and bleeding a fighter cries out for mercy', who, odds: _odds },
            ])
          : _cls === 'power'
            ? {
                kind: 'as the foe readies a power for the killing stroke a fighter begs',
                foeWho,
                strikeKind: _k,
                strikeClass: _cls,
                who,
                odds: _odds,
              }
            : _pick<APleasLine>([
                { kind: 'beaten and bleeding a fighter sees the killing blow coming', who, foeWho, odds: _odds },
                { kind: 'as the foe closes for the kill a fighter cries out for mercy', foeWho, who, odds: _odds },
                { kind: 'a fighter drops to their knees before the final stroke', who, odds: _odds },
              ]);
      if (_granted) {
        cbt.hp = 1;
        const hisHero = asItsGuardReadsIt<AHeroAsTheMercyReadsHim>(cbt.ref);
        if (hisHero) hisHero.hp = 1;
        cbt._begged = true;
        state.fledBy = cbt;
        const spared: APleasLine =
          foe.kind === 'monster'
            ? {
                kind: 'the guardian pauses over its prey and lets a fighter crawl away',
                foeWho,
                who,
                who2: who,
              }
            : !_blow
              ? { kind: 'the foe lets a fighter go', foeWho, who }
              : _cls === 'ranged'
                ? { kind: 'the foe lowers their bow and lets a fighter go', foeWho, who }
                : _cls === 'power'
                  ? {
                      kind: 'the foe lets a power die unspent',
                      foeWho,
                      strikeKind: _k,
                      strikeClass: _cls,
                      who,
                      who2: who,
                    }
                  : _pick<APleasLine>([
                      { kind: 'the foe stays the blow and lets a fighter go', foeWho, who },
                      {
                        kind: 'the foe lowers their weapon in disgust and lets a fighter go',
                        foeWho,
                        who,
                        who2: who,
                      },
                      { kind: 'the stroke never falls and the foe spares a fighter', foeWho, who },
                    ]);
        if (_blow) {
          // the killing blow never landed: drop its lines, keep the owner's private skill markers (a skill rise's
          // words; a line for one realm alone, another area's fact). Since P1-12c4 the fight's own lines are facts of
          // personal combat's kinds, none of whose words starts with those markers: a kind check, not a test of words.
          const tail = takeBackLinesFrom(narrative, at);
          const kept = tail.filter((x): boolean =>
            typeof x === 'string'
              ? /^\s*(📈|🎉|💰)/.test(x)
              : !(isAPersonalCombatsLine(x) && isALineForEveryoneInTheFight(x)),
          );
          // the plea, the sparing, then what is kept (built in two steps: the compiler can't reduce one literal of them)
          const thePleaAndWhatIsKept: NarrativeLine[] = [plea, spared];
          thePleaAndWhatIsKept.push(...kept);
          narrateAll(narrative, thePleaAndWhatIsKept);
        } else {
          narrate(narrative, plea);
          narrate(narrative, spared);
        }
        // Consequences of a spared coward (design update): they are broken for the rest of the
        // turn
        // (all remaining actions lost), slink back to their home province by next turn, and yield a
        // random magic item to the victor as the price of their life.
        if (hisHero) {
          hisHero._mercyFledTurn = G.turn; // out of action this turn; relocated home at end of turn
          const _giveable = transferableItems(hisHero.items); // a granted Mithril suit is never surrendered
          const foeAsGuarded = asItsGuardReadsIt(foe);
          if (foeAsGuarded?.kind === 'character' && theFoesHero && _giveable.length > 0) {
            const _lost = _giveable[Math.floor(kcRng() * _giveable.length)];
            if (_lost === undefined || !hisHero.items) throw new TypeError('no item at that place'); // one of his, by the dice
            hisHero.items.splice(hisHero.items.indexOf(_lost), 1);
            applyItemMaxHp(hisHero, _lost);
            theFoesHero.items = theFoesHero.items ?? [];
            theFoesHero.items.push(_lost);
            narrate(narrative, {
              kind: 'a fighter surrenders an item to the foe as the price of mercy',
              cbtName: cbt.name,
              lostName: _lost.name,
              foeName: foe.name,
            });
            {
              // every hero's name is words (above); a hero of none would be a broken save, refused here
              if (!hisNameIsWords(theFoesHero)) throw new TypeError('a hero of no name');
              const _gn = settleTheItemsAHeroGained(theFoesHero, [_lost]);
              if (_gn) narrate(narrative, { kind: 'a gained item noted', theItemsHeGained: _gn });
            } // item 10
          }
        }
      } else {
        const refused: APleasLine =
          foe.kind === 'monster'
            ? {
                kind: 'the foe knows nothing of mercy',
                foeWho,
                aBlowFalls: _blow,
                strikeKind: _k,
                strikeClass: _cls,
              }
            : foeAlign === 'Evil' || foeAlign === 'Undead'
              ? {
                  kind: 'the foe laughs at the plea',
                  foeWho,
                  aBlowFalls: _blow,
                  strikeKind: _k,
                  strikeClass: _cls,
                }
              : _pick<APleasLine>([
                  {
                    kind: 'the foe is deaf to the plea',
                    foeWho,
                    aBlowFalls: _blow,
                    strikeKind: _k,
                    strikeClass: _cls,
                  },
                  { kind: 'there is no pity in the foe', foeWho, aBlowFalls: _blow, strikeKind: _k, strikeClass: _cls },
                ]);
        if (_blow) {
          narrateAt(narrative, at, [plea, refused]);
          _mercyShift.push([at, 2]);
        } else {
          narrate(narrative, plea);
          narrate(narrative, refused);
        }
      }
    }
  }
  let winner: AFighterInAPersonalCombat | null = null,
    loser: AFighterInAPersonalCombat | null = null;
  if (!state.fledBy && !state.parley && !state.stoleBy) {
    if (A.hp <= 0 && B.hp <= 0) {
      winner = A.melee >= B.melee ? A : B;
      loser = winner === A ? B : A;
      winner.hp = 1;
      const theWinnersHero = asItsGuardReadsIt<AHeroAsTheFightReadsHim>(winner.ref);
      if (theWinnersHero) theWinnersHero.hp = 1;
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
  // encounter report (like battle-driven gains) instead of being emitted mid-resolution — which
  // landed them ABOVE the encounter report, i.e. at the top of the phase in the player Chronicle.
  // 2026-09-29 (Toby): melee/archery experience is now rolled per successful hit as it lands
  // (pcCombatXP) — the old single end-of-fight roll for the victor is retired.
  if (state.stoleBy?.kind === 'character' && asItsGuardReadsIt(state.stoleBy.ref))
    trySkillGain(turnContext, state.stoleBy.ref, 'thief', SKILLGAIN_STD, narrative);
  // ── 2026-10-08 (Toby item 16): WOUNDS HARDEN TOO ── every hero who took at least 1 HP of damage in
  // the fight rolls for maximum HP at its end, as the winner always has. The winner is left to the
  // win award (awardWinHp: kill, lair cleared, a duel's field held), which rolls once with +1 for the
  // victory, so no hero rolls twice for one fight. A hero who has fallen does not roll; forecasts
  // (simulated fights on copies) never do.
  _noteLow();
  if (!turnContext._pcSimulating) {
    const _winSide = winner ?? (opts.heldFieldWins && state.fledBy ? (state.fledBy === A ? B : A) : null);
    // 2026-10-14 (batch item 12, Toby): ANY HERO WHO WINS A FIGHT rolls for Melee experience at the
    // standard rate, on top of the rolls for each blow, arrow or spell that landed (trySkillGain's
    // own guards keep it to one rise of a skill a phase and a turn).
    if (_winSide?.kind === 'character' && asItsGuardReadsIt(_winSide.ref) && _winSide.hp > 0)
      trySkillGain(turnContext, _winSide.ref, 'melee', SKILLGAIN_STD, narrative);
    // 2026-10-14 (batch item 11, Toby): a hero who LOSES a fight and lives — beaten and spared, or
    // fled — learns a little: Melee at the small frequent-action rate.
    for (const X of [A, B]) {
      if (X.kind !== 'character' || !asItsGuardReadsIt(X.ref) || X.hp <= 0 || X === _winSide) continue;
      const _lost = (winner !== null && winner !== X) || state.fledBy === X || (_winSide && _winSide !== X);
      if (_lost) trySkillGain(turnContext, X.ref, 'melee', SKILLGAIN_COMMON, narrative);
    }
    for (const X of [A, B]) {
      const hisHero = asItsGuardReadsIt<AHeroAsTheFightReadsHim>(X.ref);
      if (X === _winSide || X.kind !== 'character' || !hisHero || X.hp <= 0) continue;
      if (!(Number(X._hpLow) <= Number(X._hpStart) - 1)) continue; // both set at the fight's start
      // the world's heroes, read as the guard reads them (a gap among them)
      const theHeroes: readonly (AHeroAsTheWoundRollFindsHim | null | undefined)[] =
        asItsGuardReadsIt(G.characters) ?? [];
      const hisId = hisHero.id;
      const real = hisId != null ? theHeroes.find((r) => r?.id === hisId) : null;
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
