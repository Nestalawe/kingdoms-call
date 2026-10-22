// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcRng } from '../rng.ts';
import { SEA_TYPES_GEN } from '../world/tables.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { botBattleForce } from '../bots/intel.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';

// ── ORC WAR-SPOILS ── Flag the Orcish units of an Orcish realm that just won a battle as part of
// an ATTACKING force. The wage pass at end of turn halves that turn's upkeep for any unit stamped
// with the current turn (stale stamps from earlier turns are simply ignored).
// 2026-09-24 (Toby item 3): when `battle` is passed, a closing line is appended to its narrative
// naming how many Orcish units earned the spoils — so it is called BEFORE emitBattle.
export function markOrcAttackWin(ch, gs, battle) {
  if (!ch || ch.player == null || !gs.players[ch.player] || gs.players[ch.player].race !== 'Orcish') return 0;
  let n = 0;
  (ch.armies || []).forEach((a) => {
    if (a && a.race === 'Orcish' && !a._phantom) {
      a._orcAtkWinTurn = gs.turn;
      n++;
    }
  });
  if (n > 0 && battle && Array.isArray(battle.narrative))
    narrate(
      battle.narrative,
      `🪓 **Orcish war-spoils**: ${n} Orcish unit${n !== 1 ? 's' : ''} of ${ch.name.replace(' (wandering)', '')}'s host plunder${n === 1 ? 's' : ''} the field — their wages are halved this turn.`,
    );
  return n;
}

// ── HUMAN DRILLMASTERS ── Human army units of a Human realm improve their experience level twice
// as readily — from a leading character's drills and from surviving battle. Returns the multiplier
// applied to their promotion CHANCE (2× for qualifying units, else 1×).
// Unit drilling table — the chance per drill that a unit rises one quality tier, multiplied by the
// drilling skill level. Read by Practice Tactical / Naval and by the end-of-turn GARRISON DRILL,
// which drills every garrisoned unit as a commander of GARRISON_DRILL_LEVEL would (2026-09-23c, Toby:
// land and air units as if by Tactical 1, fleets and sea-beasts as if by Naval 1).
export const UNIT_DRILL_BASE = { Green: 0.05, Average: 0.04, Veteran: 0.03, Crack: 0.02, Elite: 0 };
export const GARRISON_DRILL_LEVEL = 1;
export function humanXPMult(a, ownerPi, gs) {
  return a && a.race === 'Human' && ownerPi != null && gs.players[ownerPi] && gs.players[ownerPi].race === 'Human'
    ? 2
    : 1;
}

export function rP(a, b) {
  return Math.floor(kcRng() * (b - a + 1)) + a;
}
// Starting neutral defender count by wealth tier. MUST use the SAME tax thresholds as the
// player-facing wealth label (tax>=7 Rich / tax>=4 Prosperous / else Poor) — otherwise a province
// shown as "Prosperous"
// (e.g. tax 3) quietly fell into the poor band and was defended by a single unit. Rich 3-4 / Prosperous 2-3 / Poor 1-2.
// 2026-09-21 (Toby): the Poor/Prosperous cut moved from tax 3 to tax 4, so the bands now read
// Poor 2-3 · Prosperous 4-6 · Rich 7-10 — matching the rulebook and the 'Poor is 2-3 tax' rule.
// The LABEL and the GARRISON BAND must move together or a province shown as Poor is defended like
// a Prosperous one (the bug this single source of truth exists to prevent).
// Single source of truth used by every world-gen defender pass (land, sea, primal, home-race
// conversion). 2026-09-13: the BAND is split out so the count and the audit sweep can never drift
// apart. neutralDefBand returns [lo,hi] for a tax value; neutralDefCount rolls inside it.
export function neutralDefBand(tax) {
  return tax >= 7 ? [3, 4] : tax >= 4 ? [2, 3] : [1, 2];
}
export function neutralDefCount(tax) {
  const b = neutralDefBand(tax);
  return rP(b[0], b[1]);
}
// Bring a neutral LAND province's defender list back inside the band its FINAL tax demands. Called
// by the end-of-worldgen audit below, because several home-tailoring passes raise or lower a
// province's tax AFTER its garrison was rolled (see the sweep's comment). No-ops when the count is
// already legal, so a province that generated correctly is never re-rolled. Sea is never touched —
// open water is deliberately undefended and the home coastal guarantee depends on that.
export function resyncNeutralDefenders(prov) {
  if (!prov || prov.terrain === 'sea' || prov.owner != null) return false;
  const defs = prov.neutralDefenders || (prov.neutralDefenders = []);
  const [lo, hi] = neutralDefBand(prov.tax || 0);
  if (defs.length >= lo && defs.length <= hi) return false;
  const want = rP(lo, hi);
  if (defs.length > want) {
    defs.length = want;
  } else {
    // Draw extras from the same pool world gen uses: the province's own recruitable types, minus
    // garrison units (no neutral army starts the game as a garrison) and minus sea types on land.
    const pool = (prov.armyTypes || []).filter(
      (t) => !String(t).toLowerCase().includes('garrison') && !SEA_TYPES_GEN.has(t),
    );
    const draw = pool.length ? pool : prov.armyTypes || [];
    const proto = defs[0] || null;
    while (defs.length < want) {
      const dt = draw.length ? draw[Math.floor(kcRng() * draw.length)] : proto ? proto.type : 'Shieldwall Levies';
      defs.push({
        type: dt,
        quality: proto ? proto.quality : 'Average',
        race: proto ? proto.race : prov.race || 'Human',
        unitName: armyUnitName(dt),
      });
    }
  }
  prov.npcArmies = defs.length;
  return true;
}

// 2026-10-13 (Toby, item 13): a neutral province's starting army is the MOST EFFECTIVE mix of the
// units it offers, not a random draw. Every mix of `slots` units (repeats allowed) from the
// province's own land types (no garrisons, no ships) is scored with botBattleForce — the battle
// estimate the bots use for a neutral province: each unit's base strength and quality on the battle
// grid (front width of the terrain, archers behind the line, riders on the flanks, spare units
// behind). Unit-by-terrain multipliers live inside runTurn and are not in the score. `quals` are the
// slots' qualities, kept as they were dealt. Ties keep the first mix in the province's own type
// order. Draws no dice. Returns the list of types, one per slot, or null when there is nothing to
// choose.
export function bestNeutralMix(armyTypes, quals, terrain, race) {
  const types = [
    ...new Set((armyTypes || []).filter((t) => !String(t).toLowerCase().includes('garrison') && !SEA_TYPES_GEN.has(t))),
  ];
  const n = (quals || []).length;
  if (types.length < 2 || !n) return null;
  const G = { players: [], turn: -1 };
  let best = null,
    bestF = -1;
  const pick = [];
  const walk = (from) => {
    if (pick.length === n) {
      const armies = pick.map((t, i) => ({ type: t, quality: quals[i], race }));
      const f = botBattleForce(G, null, armies, terrain, { defending: true });
      if (f > bestF + 1e-9) {
        bestF = f;
        best = pick.slice();
      }
      return;
    }
    for (let i = from; i < types.length; i++) {
      pick.push(types[i]);
      walk(i);
      pick.pop();
    }
  };
  walk(0);
  return best;
}
