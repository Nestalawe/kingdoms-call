// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcRng } from '../rng.ts';
import { QUALITY_TIERS, demoteOrDisband, disbandLine, unitRef } from '../army-tables.ts';

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
//   o.faced      (2026-10-12, Toby: who beat whom) a Map army → clause, or a function of the army, from
//                battleFacedClauses: each line puts it after the company's own reference — "Aldric's Levies
//                (Shieldwall Levies, Average), facing the Iron Halberds (Gorbash's Men-at-Arms), were
//                annihilated in the rout!". Without it the lines read as they always did.
// Returns {died, promoted, demoted, disbanded, held, survived}.
export const TROLL_REGEN_CHANCE = 0.3; // Regenerating Hide (the Cave Trolls)
export function rollUnitFates(force, o) {
  const rng = o.rng || kcRng,
    tiers = o.tiers || QUALITY_TIERS,
    say = o.say || (() => {}),
    ref = o.unitRef || unitRef,
    who = o.owner || '';
  const dust = (a) => (a._isSkeletal ? ' Their bones crumble to dust — gone forever.' : '');
  const diedVerb = o.diedVerb || (o.won ? 'were destroyed in the fighting.' : 'were destroyed in the rout!'),
    promoteVerb = o.promoteVerb || 'earn promotion to';
  const clauseOf = (a) => {
    const f = o.faced;
    if (!f || !a) return '';
    const c = typeof f === 'function' ? f(a) : typeof f.get === 'function' ? f.get(a) : null;
    return c ? String(c) : '';
  };
  const head = (a, q0) => {
    const c = clauseOf(a);
    return ref(who, q0 ? { ...a, quality: q0 } : a) + (c ? `, ${c},` : '');
  };
  const r = { died: 0, promoted: 0, demoted: 0, disbanded: 0, held: 0, survived: 0 };
  // HUMAN — Knightly Example (2026-10-11, Toby): with a Gilded Lances unit in the army, Levies and
  // Men-at-Arms never lose a tier in defeat (they hold, as under a Shield Fort). o.knightly overrides.
  const knightly = o.knightly != null ? !!o.knightly : (force || []).some((a) => a && a.type === 'Gilded Lances');
  (force || []).forEach((a) => {
    if (!a) return;
    const idx = tiers.indexOf(a.quality),
      roll = rng();
    if (roll < o.dieAt(a)) {
      // PRIMAL — Regenerating Hide (2026-10-13, the beast abilities): a Cave Trolls company that fails its death roll after a
      // LOST battle shrugs it off three times in ten (the rulebook's "regenerating" brutes, now real). Not in a victory: the
      // hide knits in flight, not in the press of the win. o.regen overrides the chance (the tests feed the dice).
      if (a.type === 'Cave Trolls' && !o.won && rng() < (o.regen != null ? o.regen : TROLL_REGEN_CHANCE)) {
        r.survived++;
        say({ kind: 'a unit is cut down and rises again by its regenerating hide', unitReference: head(a) });
        return;
      }
      a._died = true;
      r.died++;
      say({ kind: 'a unit dies in the battle', unitReference: head(a), diedVerb, wordsIfSkeletal: dust(a) });
      return;
    }
    if (a._isSkeletal) {
      r.survived++;
      return;
    }
    if (o.won) {
      if (roll < o.promoteTo(a) && idx >= 0 && idx < 4) {
        const q0 = a.quality;
        a.quality = tiers[idx + 1];
        r.promoted++;
        if (o.notable) a._notable = true;
        say({
          kind: 'a unit is promoted after the battle',
          unitReferenceAtItsOldQuality: head(a, q0),
          promoteVerb,
          unitQuality: a.quality,
        });
      } else r.survived++;
      return;
    }
    const roll2 = rng();
    if (roll2 < o.demoteAt(a)) {
      if (o.shieldFort) {
        r.held++;
        say({ kind: 'a unit falls back behind the shield wall in good order', unitReference: head(a) });
      } else if (knightly && (a.type === 'Shieldwall Levies' || a.type === 'Men-at-Arms')) {
        r.held++;
        say({ kind: 'a unit keeps its nerve under the knightly example', unitReference: head(a) });
      } else {
        const q0 = a.quality;
        if (demoteOrDisband(a)) {
          r.disbanded++;
          say(disbandLine(who, a, clauseOf(a)));
        } else {
          r.demoted++;
          if (o.notable) a._notable = true;
          say({
            kind: 'a unit loses heart in defeat and is reduced a tier',
            unitReferenceAtItsOldQuality: head(a, q0),
            unitQuality: a.quality,
          });
        }
      }
    } else if (roll2 < o.promoteTo(a) && idx >= 0 && idx < 4) {
      const q0 = a.quality;
      a.quality = tiers[idx + 1];
      r.promoted++;
      if (o.notable) a._notable = true;
      say({
        kind: 'a unit improves a tier despite defeat',
        unitReferenceAtItsOldQuality: head(a, q0),
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
export function battleLineTiers(texts) {
  const t = [];
  let inCas = false,
    casIdx = -1;
  (texts || []).forEach((raw, i) => {
    const s = String(raw == null ? '' : raw);
    let tier = 'k';
    if (s.startsWith('\u2691FORCE\u2691'))
      tier = 'k'; // deployment — shown compact in the short view
    else if (BATTLE_CAS_HEAD_RE.test(s)) {
      inCas = true;
      if (casIdx < 0) casIdx = i;
      tier = 'd';
    } else if (inCas && s.startsWith('— '))
      tier = /masterless hero|None left to fight/.test(s) ? 'k' : 'd'; // unit fates → the tally
    else if (/^\s/.test(s))
      tier = /Fortune of battle/.test(s) ? 'k' : 'd'; // duel blows, volleys, ladder rows, spell hits
    else if (s.startsWith('📊'))
      tier = /completely destroyed/.test(s) ? 'k' : 'd'; // stats, ladder heads, outcome band, survivors
    else if (/^(🤝 Kinship|🏹|⚠|〰)/.test(s)) tier = 'd';
    else if (/^The \w+ terrain sets a /.test(s)) tier = 'd';
    else if (/^✨ .+ — \*\*[^*]+\*\*: /.test(s))
      tier = 'd'; // a unit's own pre-battle strike (the hit line follows)
    else if (/find no room to ride/.test(s)) tier = 'd';
    t.push(tier);
  });
  return { t, casIdx };
}
// One line per side: "Vervain: 1 of 6 units lost (Shadow Archers)". Built from the casualty
// sections of the narrative, the unit type read off the side's own ⚑FORCE⚑ roster (by unit name,
// else by the longest type name in the line), so it survives any rewording of a casualty line.
export function battleTallyLine(texts) {
  const T = (texts || []).map((x) => String(x == null ? '' : x));
  const roster = { attacker: [], defender: [] };
  T.forEach((s) => {
    if (s.startsWith('\u2691FORCE\u2691')) {
      try {
        const f = JSON.parse(s.slice(7));
        if (f && roster[f.role])
          roster[f.role] = roster[f.role].concat((f.armies || []).filter((a) => a && !a.phantom));
      } catch (_) {}
    }
  });
  const sides = [];
  let cur = null;
  // every side's casualty header first, so a unit's fate written AFTER both sections (a trapped
  // attacker cut down after the defender's list) is still credited to the side it names.
  const _heads = [];
  T.forEach((s) => {
    const h = s.match(BATTLE_CAS_HEAD_RE);
    if (h && !_heads.some((x) => x.role === h[3])) _heads.push({ name: h[2], role: h[3] });
  });
  const sideFor = (role) => {
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
  const ownerSide = (s) => {
    const body = s.replace(/^— (Despite defeat, )?/, '');
    let best = null;
    _heads.forEach((h) => {
      const i1 = body.startsWith(`${h.name}'s `) ? 0 : -1,
        i2 = body.indexOf(`(${h.name}'s `);
      const i = [i1, i2].filter((x) => x >= 0).sort((a, b) => a - b)[0];
      if (i == null) return;
      if (!best || i < best.i || (i === best.i && h.name.length > best.h.name.length)) best = { i, h };
    });
    return best ? sideFor(best.h.role) : null;
  };
  const typeOf = (s, role) => {
    const R = roster[role] || [];
    // the type printed first in the line wins ("the Red Hand (Def's Thunderbirds, Crack)"); a bare unit
    // name ("— the Red Hand are cut down") is looked up on the side's roster.
    const types = [...new Set(R.map((a) => a.type))]
      .map((ty) => ({ ty, i: s.indexOf(ty) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i || b.ty.length - a.ty.length);
    if (types[0]) return types[0].ty;
    const byName = R.filter((a) => a.unitName && a.unitName !== a.type && s.includes(a.unitName))
      .map((a) => ({ a, i: s.indexOf(a.unitName) }))
      .sort((x, y) => x.i - y.i || y.a.unitName.length - x.a.unitName.length)[0];
    return byName ? byName.a.type : null;
  };
  const _atkForceName = (() => {
    const f = T.find((s) => s.startsWith('\u2691FORCE\u2691') && /"role":"attacker"/.test(s));
    try {
      return f ? JSON.parse(f.slice(7)).name : '';
    } catch (_) {
      return '';
    }
  })();
  T.forEach((s) => {
    // a whale cohort's breach sinks a hull BEFORE the casualty lists — a real loss for the other side.
    const br = s.match(/^🌊 A (?:(.+?) )?whale cohort breaches beneath the /);
    if (br) {
      const loser = br[1] && _atkForceName && !_atkForceName.startsWith(br[1]) ? 'attacker' : 'defender';
      const sd = sideFor(loser);
      sd.lost.push(typeOf(s.slice(br[0].length), loser) || 'unit');
      return;
    }
    const h = s.match(BATTLE_CAS_HEAD_RE);
    if (h) {
      cur = sideFor(h[3]);
      return;
    }
    if (!cur || !s.startsWith('— ')) return;
    const sd = ownerSide(s) || cur;
    if (/promotion to|hardened by victory|improved to/.test(s)) sd.pro++;
    else if (/lost heart in defeat/.test(s)) sd.dem++;
    else if (/have had enough|slip away/.test(s)) sd.fled.push(typeOf(s, sd.role) || 'unit');
    else if (/annihilated|destroyed|cut down|slain|sunk|drown|lost at sea|crumble/.test(s))
      sd.lost.push(typeOf(s, sd.role) || 'unit');
  });
  if (!sides.length) return null;
  const grp = (a) => {
    const m = new Map();
    a.forEach((x) => m.set(x, (m.get(x) || 0) + 1));
    return [...m].map(([k, n]) => (n > 1 ? `${n}× ${k}` : k)).join(', ');
  };
  sides.sort((a, b) => (a.role === 'attacker' ? 0 : 1) - (b.role === 'attacker' ? 0 : 1));
  const parts = sides.map((sd) => {
    const tot = (roster[sd.role] || []).length,
      n = sd.lost.length;
    const bits = [
      n ? `${n}${tot ? ` of ${tot}` : ''} unit${(tot || n) !== 1 ? 's' : ''} lost (${grp(sd.lost)})` : 'no units lost',
    ];
    if (sd.fled.length) bits.push(`${sd.fled.length} disbanded (${grp(sd.fled)})`);
    if (sd.dem) bits.push(`${sd.dem} demoted`);
    if (sd.pro) bits.push(`${sd.pro} promoted`);
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
export function battleMarginBand(margRatio) {
  const r = Math.max(0, margRatio || 0);
  return BATTLE_MARGIN_BANDS.find((b) => r < b.max) || BATTLE_MARGIN_BANDS[BATTLE_MARGIN_BANDS.length - 1];
}
