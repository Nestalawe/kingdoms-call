import { kcRng } from '../rng.ts';
import { QUALITY_TIERS, demoteOrDisband, unitRef } from '../army-tables.ts';
import type { ArmyInABattle } from '../army-tables.ts';
import type { TheFactOfOneOfABattlesSentences, WhomAUnitFaced } from './the-facts-a-battles-lines-record.ts';
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
//   o.diedVerb / o.promoteVerb  the site's wording ("were annihilated in the rout!", "are hardened by
//                victory to"); o.notable stamps a._notable on a demoted or promoted unit (the NPC loser's
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
/** What rollUnitFates is told by the battle that calls it (the header above): the dice, the thresholds, the words. */
interface TheOptionsOfEveryUnitsFate {
  /** The dice (the tests feed their own); else kcRng. */
  rng?: (() => number) | null;
  /** The quality tiers, lowest first; else QUALITY_TIERS. */
  tiers?: readonly string[] | null;
  /** Receives each unit's line. */
  say?: ((line: string | TheFactOfOneOfABattlesSentences) => void) | null;
  /** How a unit is named in its line; else unitRef. */
  unitRef?: ((ownerName: string, a: ArmyInABattle) => string) | null;
  /** The units' owner, as each line names him. */
  owner?: string | null;
  diedVerb?: string | null;
  promoteVerb?: string | null;
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
    ref = o.unitRef ?? unitRef,
    who = o.owner ?? '';
  const whomItFaced = (a: ArmyInABattle | null | undefined): WhomAUnitFaced | null => {
    const f = o.faced;
    if (!f || !a) return null;
    const c = typeof f === 'function' ? f(a) : typeof f.get === 'function' ? f.get(a) : null;
    return c ?? null;
  };
  // A unit as its line names it (its reference, and whom it faced, which the line's words put after it).
  const head = (a: ArmyInABattle, q0?: string) => ref(who, q0 ? { ...a, quality: q0 } : a);
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
        say({ kind: lives, unitReference: head(a), whomItFaced: whomItFaced(a) });
        return;
      }
      a._died = true;
      r.died++;
      say({
        kind: 'a unit dies in the battle',
        unitReference: head(a),
        whomItFaced: whomItFaced(a),
        diedVerb: o.diedVerb,
        itsSideWon: o.won,
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
          kind: 'a unit is promoted after the battle',
          unitReferenceAtItsOldQuality: head(a, q0),
          whomItFaced: whomItFaced(a),
          promoteVerb: o.promoteVerb,
          unitQuality: a.quality,
        });
      } else r.survived++;
      return;
    }
    const roll2 = rng();
    if (roll2 < o.demoteAt(a)) {
      if (o.shieldFort) {
        r.held++;
        say({
          kind: 'a unit falls back behind the shield wall in good order',
          unitReference: head(a),
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
        say({ kind: holds, unitReference: head(a), whomItFaced: whomItFaced(a) });
      } else {
        const q0 = a.quality;
        if (demoteOrDisband(a)) {
          r.disbanded++;
          const whom = whomItFaced(a);
          say({
            kind: 'a beaten unit has had enough and disbands',
            ownerName: who,
            unitName: a.unitName,
            unitType: a.type,
            whomItFaced: whom,
          });
        } else {
          r.demoted++;
          if (o.notable) a._notable = true;
          say({
            kind: 'a unit loses heart in defeat and is reduced a tier',
            unitReferenceAtItsOldQuality: head(a, q0),
            whomItFaced: whomItFaced(a),
            unitQuality: a.quality,
          });
        }
      }
    } else if (roll2 < o.promoteTo(a) && idx >= 0 && idx < 4) {
      const q0 = a.quality;
      a.quality = tiers[idx + 1] ?? q0;
      r.promoted++;
      if (o.notable) a._notable = true;
      say({
        kind: 'a unit improves a tier despite defeat',
        unitReferenceAtItsOldQuality: head(a, q0),
        whomItFaced: whomItFaced(a),
        unitQuality: a.quality,
      });
    } else r.survived++;
  });
  return r;
}

// ── BATTLE SUMMARY vs FULL REPORT (2026-09-23d, Toby item 1) ────
// Every battle is still written as ONE narrative array. emitBattle tags each line with the battle's
// id and a tier, and the player portal shows the SHORT account by default with the full report one
// click away:  'k' key (short AND full) · 'd' detail (full only) · 't' the losses tally (short only)
// · 's' the onlookers' one-line summary (shown only when the viewer has nothing else of the battle).
// The rule is a BLACKLIST of known technical lines — anything unrecognised stays in the short view,
// so a new narrative line can never silently vanish from what the player reads.
export const BATTLE_CAS_HEAD_RE = /^(⚔|🛡) \*\*(.+?)(?:'s|') forces\*\* \((attacker|defender)\):\s*$/;
/** A battle line's tier, as battleLineTiers gives it: 'k' in the short account and the full report, 'd' in the full
 *  report only (the views add 't', the tally, and 's', the onlookers' summary). */
export type ABattleLinesTier = 'k' | 'd';
export function battleLineTiers(texts: readonly (string | null | undefined)[] | null | undefined): {
  t: ABattleLinesTier[];
  casIdx: number;
} {
  const t: ABattleLinesTier[] = [];
  let inCas = false,
    casIdx = -1;
  (texts ?? []).forEach((raw, i) => {
    const s = raw ?? '';
    let tier: ABattleLinesTier = 'k';
    if (s.startsWith('\u2691FORCE\u2691'))
      tier = 'k'; // deployment — shown compact in the short view
    else if (BATTLE_CAS_HEAD_RE.test(s)) {
      inCas = true;
      if (casIdx < 0) casIdx = i;
      tier = 'd';
    } else if (inCas && s.startsWith('— '))
      tier = /masterless hero|None left to fight/.test(s) ? 'k' : 'd'; // unit fates → the tally
    else if (/^\s/.test(s))
      tier = s.includes('Fortune of battle') ? 'k' : 'd'; // duel blows, volleys, ladder rows, spell hits
    else if (s.startsWith('📊'))
      tier = s.includes('completely destroyed') ? 'k' : 'd'; // stats, ladder heads, outcome band, survivors
    else if (/^(🤝 Kinship|🏹|⚠|〰)/.test(s)) tier = 'd';
    else if (/^The \w+ terrain sets a /.test(s)) tier = 'd';
    else if (/^✨ .+ — \*\*[^*]+\*\*: /.test(s))
      tier = 'd'; // a unit's own pre-battle strike (the hit line follows)
    else if (s.includes('find no room to ride')) tier = 'd';
    t.push(tier);
  });
  return { t, casIdx };
}
// One line per side: "Vervain: 1 of 6 units lost (Shadow Archers)". Built from the casualty
// sections of the narrative, the unit type read off the side's own ⚑FORCE⚑ roster (by unit name,
// else by the longest type name in the line), so it survives any rewording of a casualty line.
// The rows are read back from the line's JSON as JavaScript reads any value's field (fieldAsJavaScriptReadsIt): the
// engine writes them (forceMarker), and whatever a row holds is read as it always was.
/** `value[key]`, as JavaScript reads it: a field of an object, of an array or of a string, undefined where it has
 *  none, and a TypeError for null or undefined. */
function fieldAsJavaScriptReadsIt(value: unknown, key: string): unknown {
  if (value === null || value === undefined) throw new TypeError(`Cannot read properties of ${String(value)}`);
  const field: unknown = Reflect.get(Object(value), key);
  return field;
}
/** `value.startsWith(prefix)`, as JavaScript calls it: a TypeError for a value that isn't a string. */
function startsWithAsJavaScriptCallsIt(value: unknown, prefix: string): boolean {
  if (typeof value !== 'string') throw new TypeError('value.startsWith is not a function');
  return value.startsWith(prefix);
}
/** `(list || []).filter((a) => a && !a.phantom)` on a row's units, as JavaScript runs it: a TypeError for a truthy
 *  value that isn't a list. */
function theUnitsOnAForcesRow(list: unknown): unknown[] {
  if (!list) return [];
  if (!Array.isArray(list)) throw new TypeError('list.filter is not a function');
  const each: readonly unknown[] = list;
  return each.filter((a) => a && !fieldAsJavaScriptReadsIt(a, 'phantom'));
}
/** A side of the battle, as its tally counts it: its name, its role, the types it lost and those that fled. */
interface ASidesLosses {
  name: string;
  role: string;
  lost: unknown[];
  fled: unknown[];
  dem: number;
  pro: number;
}
export function battleTallyLine(texts: readonly (string | null | undefined)[] | null | undefined): string | null {
  const T = (texts ?? []).map((x) => x ?? '');
  const roster: Record<string, unknown[]> = { attacker: [], defender: [] };
  T.forEach((s) => {
    if (s.startsWith('\u2691FORCE\u2691')) {
      try {
        const f: unknown = JSON.parse(s.slice(7));
        if (f) {
          const role = String(fieldAsJavaScriptReadsIt(f, 'role'));
          const units = roster[role];
          if (units) roster[role] = units.concat(theUnitsOnAForcesRow(fieldAsJavaScriptReadsIt(f, 'armies')));
        }
      } catch (_) {}
    }
  });
  const sides: ASidesLosses[] = [];
  let cur: ASidesLosses | null = null;
  // every side's casualty header first, so a unit's fate written AFTER both sections (a trapped
  // attacker cut down after the defender's list) is still credited to the side it names.
  const _heads: { name: string; role: string }[] = [];
  T.forEach((s) => {
    const h = BATTLE_CAS_HEAD_RE.exec(s);
    // (groups 2 and 3 are never missing from a match: the `?? ''` is never used)
    if (h && !_heads.some((x) => x.role === h[3])) _heads.push({ name: h[2] ?? '', role: h[3] ?? '' });
  });
  const sideFor = (role: string) => {
    let sd = sides.find((x) => x.role === role);
    if (!sd) {
      const h = _heads.find((x) => x.role === role);
      sd = { name: h ? h.name : role, role, lost: [], fled: [], dem: 0, pro: 0 };
      sides.push(sd);
    }
    return sd;
  };
  // 2026-10-12 (Toby: who beat whom): a fate line now names the ENEMY company too ("…, facing the Red Hand
  // (Aldric's Gnomish Gyrocopters), were annihilated…"), so the owner and the type are read from the company
  // named FIRST — its own reference always opens the line — not from the longest match anywhere in it.
  const ownerSide = (s: string) => {
    const body = s.replace(/^— (Despite defeat, )?/, '');
    let best: { i: number; h: { name: string; role: string } } | null = null;
    // (a loop, not forEach, so the compiler sees best set)
    for (const h of _heads) {
      const i1 = body.startsWith(`${h.name}'s `) ? 0 : -1,
        i2 = body.indexOf(`(${h.name}'s `);
      const i = [i1, i2].filter((x) => x >= 0).sort((a, b) => a - b)[0];
      if (i == null) continue;
      if (!best || i < best.i || (i === best.i && h.name.length > best.h.name.length)) best = { i, h };
    }
    return best ? sideFor(best.h.role) : null;
  };
  const lengthOf = (x: unknown) => Number(fieldAsJavaScriptReadsIt(x, 'length'));
  const typeOf = (s: string, role: string): unknown => {
    const R = roster[role] ?? [];
    // the type printed first in the line wins ("the Red Hand (Def's Thunderbirds, Crack)"); a bare unit
    // name ("— the Red Hand are cut down") is looked up on the side's roster.
    const types = [...new Set(R.map((a) => fieldAsJavaScriptReadsIt(a, 'type')))]
      .map((ty) => ({ ty, i: s.indexOf(String(ty)) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i || lengthOf(b.ty) - lengthOf(a.ty));
    if (types[0]) return types[0].ty;
    const nameOf = (a: unknown) => fieldAsJavaScriptReadsIt(a, 'unitName');
    const byName = R.filter(
      (a) => nameOf(a) && nameOf(a) !== fieldAsJavaScriptReadsIt(a, 'type') && s.includes(String(nameOf(a))),
    )
      .map((a) => ({ a, i: s.indexOf(String(nameOf(a))) }))
      .sort((x, y) => x.i - y.i || lengthOf(nameOf(y.a)) - lengthOf(nameOf(x.a)))[0];
    return byName ? fieldAsJavaScriptReadsIt(byName.a, 'type') : null;
  };
  // `ty || 'unit'`: a type the line names, else 'unit'
  const orUnit = (ty: unknown): unknown => {
    if (ty) return ty;
    return 'unit';
  };
  const _atkForceName = ((): unknown => {
    const f = T.find((s) => s.startsWith('\u2691FORCE\u2691') && s.includes('"role":"attacker"'));
    try {
      return f ? fieldAsJavaScriptReadsIt(JSON.parse(f.slice(7)), 'name') : '';
    } catch (_) {
      return '';
    }
  })();
  T.forEach((s) => {
    // a whale cohort's breach sinks a hull BEFORE the casualty lists — a real loss for the other side.
    const br = /^🌊 A (?:(.+?) )?whale cohort breaches beneath the /.exec(s);
    if (br) {
      const loser =
        br[1] && _atkForceName && !startsWithAsJavaScriptCallsIt(_atkForceName, br[1]) ? 'attacker' : 'defender';
      const sd = sideFor(loser);
      sd.lost.push(orUnit(typeOf(s.slice(br[0].length), loser)));
      return;
    }
    const h = BATTLE_CAS_HEAD_RE.exec(s);
    if (h) {
      cur = sideFor(h[3] ?? ''); // (group 3 is never missing from a match)
      return;
    }
    if (!cur || !s.startsWith('— ')) return;
    const sd = ownerSide(s) ?? cur;
    if (/promotion to|hardened by victory|improved to/.test(s)) sd.pro++;
    else if (s.includes('lost heart in defeat')) sd.dem++;
    else if (/have had enough|slip away/.test(s)) sd.fled.push(orUnit(typeOf(s, sd.role)));
    else if (/annihilated|destroyed|cut down|slain|sunk|drown|lost at sea|crumble/.test(s))
      sd.lost.push(orUnit(typeOf(s, sd.role)));
  });
  if (!sides.length) return null;
  const grp = (a: readonly unknown[]) => {
    const m = new Map<unknown, number>();
    a.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
    return [...m].map(([k, n]) => (n > 1 ? `${String(n)}× ${String(k)}` : k)).join(', ');
  };
  sides.sort((a, b) => (a.role === 'attacker' ? 0 : 1) - (b.role === 'attacker' ? 0 : 1));
  const parts = sides.map((sd) => {
    const tot = (roster[sd.role] ?? []).length,
      n = sd.lost.length;
    const bits = [
      n
        ? `${String(n)}${tot ? ` of ${String(tot)}` : ''} unit${(tot || n) !== 1 ? 's' : ''} lost (${grp(sd.lost)})`
        : 'no units lost',
    ];
    if (sd.fled.length) bits.push(`${String(sd.fled.length)} disbanded (${grp(sd.fled)})`);
    if (sd.dem) bits.push(`${String(sd.dem)} demoted`);
    if (sd.pro) bits.push(`${String(sd.pro)} promoted`);
    return `**${sd.name}**: ${bits.join(', ')}`;
  });
  return `⚰ Losses — ${parts.join(' · ')}.`;
}

// ── BATTLE RESULT MARGIN BANDS ────
// margRatio = |winner − loser| ÷ (winner + loser). Six bands replace the old three (narrow <10%,
// clear 10–30%, decisive >30%): the middle three keep their exact old numbers; Pyrrhic splits off
// the bottom of Narrow, Crushing and Annihilating split off the top of Decisive. Every band keeps
// at least 1% winner death and 1% loser XP (a rout still costs the victor something, and even a
// shattered army learns). Used by BOTH the NPC (combatVsNPC) and hero-vs-hero (combatVsChar) paths.
export const BATTLE_MARGIN_BANDS = [
  { label: 'pyrrhic', max: 0.04, winDeath: 0.15, loseDeath: 0.12, winXP: 0.6, loseXP: 0.2, loseDemote: 0.05 },
  { label: 'narrow', max: 0.1, winDeath: 0.12, loseDeath: 0.12, winXP: 0.5, loseXP: 0.12, loseDemote: 0.1 },
  { label: 'clear', max: 0.3, winDeath: 0.05, loseDeath: 0.18, winXP: 0.3, loseXP: 0.06, loseDemote: 0.2 },
  { label: 'decisive', max: 0.55, winDeath: 0.01, loseDeath: 0.35, winXP: 0.15, loseXP: 0.02, loseDemote: 0.3 },
  { label: 'crushing', max: 0.75, winDeath: 0.01, loseDeath: 0.5, winXP: 0.08, loseXP: 0.01, loseDemote: 0.45 },
  { label: 'annihilating', max: 9, winDeath: 0.01, loseDeath: 0.6, winXP: 0.05, loseXP: 0.01, loseDemote: 0.55 },
];
export function battleMarginBand(margRatio: number) {
  const r = Math.max(0, margRatio || 0);
  return BATTLE_MARGIN_BANDS.find((b) => r < b.max) ?? BATTLE_MARGIN_BANDS[BATTLE_MARGIN_BANDS.length - 1];
}
