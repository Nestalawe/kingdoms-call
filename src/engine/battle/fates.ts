import { kcRng } from '../rng.ts';
import { QUALITY_TIERS, demoteOrDisband } from '../army-tables.ts';
import type { ArmyInABattle } from '../army-tables.ts';
import type {
  AUnitAsALineNamesIt,
  TheFactOfOneOfABattlesSentences,
  TheOwnerOfABattlesUnits,
  TheSeverityOfABattle,
  WhomAUnitFaced,
} from './the-facts-a-battles-lines-record.ts';
import {
  theLineByWhichABeatenUnitHoldsItsTier,
  theLineByWhichAUnitLivesThroughItsDeathRoll,
} from '../rules/the-registry-of-content-effects.ts';

// ── UNIT FATES AFTER A BATTLE (2026-10-11, refactor only) ── the per-unit rolls that four casualty loops
// used to repeat (the NPC attacker winning or losing; a realm battle's winner and loser). The numbers stay
// at the call sites, which pass the thresholds their battle computed; this owns the order of the rolls,
// the flags and the wording, so a test can drive it with its own dice (o.rng) and a later change to one
// line changes it everywhere. The dice are drawn exactly as before: one roll per unit; a beaten unit that
// neither died nor is skeletal draws a second.
//   o.won        the winner's rolls: below dieAt(a) it dies; else (not skeletal) below promoteTo(a) it
//                rises a tier (a unit that cannot rise simply survives).
//   !o.won       the loser's rolls: below dieAt(a) it dies; else (not skeletal) a second roll: below
//                demoteAt(a) it falls back in good order (o.shieldFort) or loses a tier / disbands; else
//                below promoteTo(a) it rises a tier despite defeat.
//   o.inTheRout / o.hardenedByVictory  how the site's lines tell a death and a promotion (P1-12d20: the words "were
//                annihilated in the rout!" and "are hardened by victory to" are the prose's; since P1-12d27 each line is
//                one kind, a unit's fate in the battle, its fate a slug); o.notable stamps a._notable on a demoted or promoted unit (the NPC loser's
//                "All other forces survive" line reads it); o.say receives each unit's line.
//   o.faced      (2026-10-12, Toby: who beat whom) a Map army → whom it faced, or a function of the army, from
//                battleFacedClauses: each line holds it beside the company's own reference, and its words put the
//                clause after it — "Aldric's Levies (Shieldwall Levies, Average), facing the Iron Halberds (Gorbash's
//                Men-at-Arms), were annihilated in the rout!". Without it the lines read as they always did.
//   The unit abilities at a fate (Regenerating Hide, Knightly Example) are the rule registry's (plan P1-19d): the stages
//   "a beaten unit fails its death roll" and "… its demotion roll" (src/engine/rules/), asked where they were inline.
// Returns {died, promoted, demoted, disbanded, held, survived}.
/** A unit's chance, as the battle that rolls its fate works it out: a roll below it, and the unit dies (dieAt), loses a
 *  tier (demoteAt) or rises one (promoteTo). */
type AUnitsChanceOfAFate = (a: ArmyInABattle) => number;
/** What rollUnitFates is told by the battle that calls it (the header above): the dice, the thresholds, how its lines
 *  are told. */
interface TheOptionsOfEveryUnitsFate {
  /** The dice (the tests feed their own); else kcRng. */
  rng?: (() => number) | null;
  /** The quality tiers, lowest first; else QUALITY_TIERS. */
  tiers?: readonly string[] | null;
  /** Receives each unit's line. */
  say?: ((line: string | TheFactOfOneOfABattlesSentences) => void) | null;
  /** The units' owner, as each line names him (plan P1-12d28: a side's record or the defenders'; the prose writes the
   *  label); none named where it is missing. */
  owner?: TheOwnerOfABattlesUnits | null;
  /** A beaten host's rout: its deaths are told as an annihilation. */
  inTheRout?: boolean | null;
  /** A victorious defender: its promotions are told as hardened by victory. */
  hardenedByVictory?: boolean | null;
  /** Whom each unit faced (battleFacedClauses): a Map army → whom (the tests' Map comes from another window, hence
   *  the check on its get), or a function of the army. */
  faced?:
    | ((a: ArmyInABattle) => WhomAUnitFaced | null | undefined)
    | { readonly get?: (a: ArmyInABattle) => WhomAUnitFaced | null | undefined }
    | null;
  /** Stamps a._notable on a demoted or promoted unit. */
  notable?: boolean | null;
  /** The Knightly Example, given; else it holds when a Gilded Lances unit is in the force (its content row). */
  knightly?: boolean | null;
  /** Regenerating Hide's chance, given; else its content row's. */
  regen?: number | null;
  /** A Shield Fort: a unit that would lose a tier falls back in good order. */
  shieldFort?: boolean | null;
  dieAt: AUnitsChanceOfAFate;
  promoteTo: AUnitsChanceOfAFate;
}
/** rollUnitFates' options: the winner's rolls, or the loser's, which roll demoteAt too. */
export type UnitFateOptions = TheOptionsOfEveryUnitsFate &
  ({ won: true } | { won: false; demoteAt: AUnitsChanceOfAFate });
export function rollUnitFates(
  force: readonly (ArmyInABattle | null | undefined)[] | null | undefined,
  o: UnitFateOptions,
) {
  const rng = o.rng ?? kcRng,
    tiers = o.tiers ?? QUALITY_TIERS,
    say =
      o.say ??
      (() => {
        // no line is said
      }),
    who = o.owner ?? null;
  const whomItFaced = (a: ArmyInABattle | null | undefined): WhomAUnitFaced | null => {
    const f = o.faced;
    if (!f || !a) return null;
    const c = typeof f === 'function' ? f(a) : typeof f.get === 'function' ? f.get(a) : null;
    return c ?? null;
  };
  // A unit as its line names it (its reference, and whom it faced, which the line's words put after it): the record
  // unitRef's form is written from (plan P1-12d28; the prose writes the label), at its old quality where one is given.
  const head = (a: ArmyInABattle, q0?: string): AUnitAsALineNamesIt => {
    const theUnit = q0 ? { ...a, quality: q0 } : a;
    return {
      kind: 'a unit named with its quality',
      owner: who,
      unitName: theUnit.unitName,
      type: theUnit.type,
      quality: theUnit.quality,
    };
  };
  const r = { died: 0, promoted: 0, demoted: 0, disbanded: 0, held: 0, survived: 0 };
  const theForce = force ?? [];
  theForce.forEach((a) => {
    if (!a) return;
    const idx = tiers.indexOf(a.quality),
      roll = rng();
    if (roll < o.dieAt(a)) {
      // The registry's "a beaten unit fails its death roll" (Regenerating Hide): a line by which the unit lives, or none.
      const lives = theLineByWhichAUnitLivesThroughItsDeathRoll({
        unitType: a.type,
        itsSideWon: o.won,
        theDice: rng,
        theChanceOfRegeneratingHideTheCallGives: o.regen,
      });
      if (lives) {
        r.survived++;
        say({
          kind: "a unit's fate in the battle",
          itsSideWon: o.won,
          fate: lives,
          theUnit: head(a),
          whomItFaced: whomItFaced(a),
        });
        return;
      }
      a._died = true;
      r.died++;
      say({
        kind: "a unit's fate in the battle",
        itsSideWon: o.won,
        fate: 'dies',
        theUnit: head(a),
        whomItFaced: whomItFaced(a),
        inTheRout: o.inTheRout ?? false,
        itsBonesCrumble: a._isSkeletal,
      });
      return;
    }
    if (a._isSkeletal) {
      r.survived++;
      return;
    }
    if (o.won) {
      if (roll < o.promoteTo(a) && idx >= 0 && idx < 4) {
        const q0 = a.quality;
        a.quality = tiers[idx + 1] ?? q0;
        r.promoted++;
        if (o.notable) a._notable = true;
        say({
          kind: "a unit's fate in the battle",
          itsSideWon: o.won,
          fate: 'rises a tier',
          theUnit: head(a, q0),
          whomItFaced: whomItFaced(a),
          hardenedByVictory: o.hardenedByVictory ?? false,
          itsQualityAfter: a.quality,
        });
      } else r.survived++;
      return;
    }
    const roll2 = rng();
    if (roll2 < o.demoteAt(a)) {
      if (o.shieldFort) {
        r.held++;
        say({
          kind: "a unit's fate in the battle",
          itsSideWon: o.won,
          fate: 'falls back behind the shield wall in good order',
          theUnit: head(a),
          whomItFaced: whomItFaced(a),
        });
        return;
      }
      // The registry's "a beaten unit fails its demotion roll" (Knightly Example): a line by which it holds, or none.
      const holds = theLineByWhichABeatenUnitHoldsItsTier({
        unitType: a.type,
        itsForce: theForce,
        theKnightlyExampleTheCallGives: o.knightly,
      });
      if (holds) {
        r.held++;
        say({
          kind: "a unit's fate in the battle",
          itsSideWon: o.won,
          fate: holds,
          theUnit: head(a),
          whomItFaced: whomItFaced(a),
        });
      } else {
        const q0 = a.quality;
        if (demoteOrDisband(a)) {
          r.disbanded++;
          const whom = whomItFaced(a);
          say({
            kind: "a unit's fate in the battle",
            itsSideWon: o.won,
            fate: 'has had enough and disbands',
            theUnitsOwner: who,
            unitName: a.unitName,
            unitType: a.type,
            whomItFaced: whom,
          });
        } else {
          r.demoted++;
          if (o.notable) a._notable = true;
          say({
            kind: "a unit's fate in the battle",
            itsSideWon: o.won,
            fate: 'loses heart and falls a tier',
            theUnit: head(a, q0),
            whomItFaced: whomItFaced(a),
            itsQualityAfter: a.quality,
          });
        }
      }
    } else if (roll2 < o.promoteTo(a) && idx >= 0 && idx < 4) {
      const q0 = a.quality;
      a.quality = tiers[idx + 1] ?? q0;
      r.promoted++;
      if (o.notable) a._notable = true;
      say({
        kind: "a unit's fate in the battle",
        itsSideWon: o.won,
        fate: 'rises a tier',
        theUnit: head(a, q0),
        whomItFaced: whomItFaced(a),
        hardenedByVictory: false,
        itsQualityAfter: a.quality,
      });
    } else r.survived++;
  });
  return r;
}

// ── BATTLE RESULT MARGIN BANDS ────
// margRatio = |winner − loser| ÷ (winner + loser). Six bands replace the old three (narrow <10%,
// clear 10–30%, decisive >30%): the middle three keep their exact old numbers; Pyrrhic splits off
// the bottom of Narrow, Crushing and Annihilating split off the top of Decisive. Every band keeps
// at least 1% winner death and 1% loser XP (a rout still costs the victor something, and even a
// shattered army learns). Used by BOTH the NPC (combatVsNPC) and hero-vs-hero (combatVsChar) paths.
/** One margin band: its slug (the severity a battle's outcome line tells: P1-12d20, the words are the prose's), the
 *  margin it runs up to, and its chances. */
interface AMarginBand {
  slug: TheSeverityOfABattle;
  max: number;
  winDeath: number;
  loseDeath: number;
  winXP: number;
  loseXP: number;
  loseDemote: number;
}
export const BATTLE_MARGIN_BANDS: readonly AMarginBand[] = [
  { slug: 'pyrrhic', max: 0.04, winDeath: 0.15, loseDeath: 0.12, winXP: 0.6, loseXP: 0.2, loseDemote: 0.05 },
  { slug: 'narrow', max: 0.1, winDeath: 0.12, loseDeath: 0.12, winXP: 0.5, loseXP: 0.12, loseDemote: 0.1 },
  { slug: 'clear', max: 0.3, winDeath: 0.05, loseDeath: 0.18, winXP: 0.3, loseXP: 0.06, loseDemote: 0.2 },
  { slug: 'decisive', max: 0.55, winDeath: 0.01, loseDeath: 0.35, winXP: 0.15, loseXP: 0.02, loseDemote: 0.3 },
  { slug: 'crushing', max: 0.75, winDeath: 0.01, loseDeath: 0.5, winXP: 0.08, loseXP: 0.01, loseDemote: 0.45 },
  { slug: 'annihilating', max: 9, winDeath: 0.01, loseDeath: 0.6, winXP: 0.05, loseXP: 0.01, loseDemote: 0.55 },
];
export function battleMarginBand(margRatio: number) {
  const r = Math.max(0, margRatio || 0);
  return BATTLE_MARGIN_BANDS.find((b) => r < b.max) ?? BATTLE_MARGIN_BANDS[BATTLE_MARGIN_BANDS.length - 1];
}
