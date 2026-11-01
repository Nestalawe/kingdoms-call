// ── LINES IN THE GM'S LOG (plan P1-08a: lifted out of resolveTurn) ────
// The spell records, the silent heroes' line and a realm's name tag. Each takes the turn's context first
// (src/engine/turn/context.ts). The helpers that write a line of a
// fight's narrative, to a hero or a province's owner, or a private line with a public twin are in
// events-and-their-audiences.ts (plan P1-12a2), beside emit, the one door into the GM's log. At the end, the
// telemetry's two snapshots of a realm, its situation and its orders (telRealmSnapshot, telOrdersFor: moved from
// src/views/turn-report.ts in plan P1-12b1, so the engine imports no view), which read no turn context.
import { emit, recordForTheStatistics } from './events-and-their-audiences.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { consecratedIds, relOfReport } from '../heroes/fame-and-consecration.ts';
import { LEGENDARY_NAMES_P } from '../items/equipment.ts';
import type { UnitOfATypeAndQuality } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import type { TurnContext } from './context.ts';

// Its types (plan P1-10b18): each parameter typed as wide as the body's guards (plan P1-10's Decision 2), so each guard
// stays: the telemetry's snapshots read a loaded state, any save's, and guard every list in it.
/** A fighter a spell record names: whose he is and his id (a hero's copy may hold it as words; a guardian has
 *  neither). */
interface AHeroAsASpellRecordNamesHim {
  readonly player?: number | null | undefined;
  readonly id?: number | string | null | undefined;
}
/** A province as the silent heroes' line reads it: its name. */
interface AProvinceAsItsNameIsRead {
  readonly name?: string | undefined;
}
/** The state as the silent heroes' line reads it: the heroes (guarded as if a gap may be among them) and the
 *  provinces' names. */
interface TheStateAsTheSilentHeroesReadIt {
  readonly characters?:
    | readonly (
        | {
            readonly id: number;
            readonly name: string;
            readonly alive?: boolean | undefined;
            readonly player?: number | null | undefined;
            readonly location?: number | null | undefined;
          }
        | null
        | undefined
      )[]
    | null
    | undefined;
  readonly world: { readonly provinces: readonly (AProvinceAsItsNameIsRead | null | undefined)[] };
}
/** A unit as the telemetry's snapshot reads it: its type and quality, and whether it is a phantom or skeletal. */
interface AUnitAsTheSnapshotReadsIt extends UnitOfATypeAndQuality {
  readonly _phantom?: boolean | undefined;
  readonly _isSkeletal?: boolean | undefined;
}
/** A hero as the telemetry reads him: as the snapshot sums his host and items, and as the orders' record names him. */
interface AHeroAsTheTelemetryReadsHim {
  readonly id: number;
  readonly name: string;
  readonly player?: number | null | undefined;
  readonly alive?: boolean | undefined;
  readonly isKing?: boolean | undefined;
  readonly killedThisTurn?: boolean | undefined;
  readonly location?: number | null | undefined;
  readonly hp?: number | undefined;
  readonly maxHp?: number | undefined;
  readonly skills?: Readonly<Partial<Record<string, number>>> | null | undefined;
  readonly armies?: readonly (AUnitAsTheSnapshotReadsIt | null | undefined)[] | null | undefined;
  readonly items?: readonly ({ readonly name: string } | null | undefined)[] | null | undefined;
}
/** A province as the telemetry's snapshot reads it: whose it is, its land, tax and garrison, and the realms that have
 *  seen it (tested with `Array.isArray`, so not `readonly`). */
interface AProvinceAsTheSnapshotReadsIt {
  readonly owner?: number | null | undefined;
  readonly terrain?: string | undefined;
  readonly tax?: number | null | undefined;
  readonly garrisonArmies?: readonly (AUnitAsTheSnapshotReadsIt | null | undefined)[] | null | undefined;
  readonly visitedBy?: number[] | null | undefined;
}
/** A realm as the telemetry's snapshot reads it: as consecration reads it, and its gold, discoveries and fate. */
interface ARealmAsTheSnapshotReadsIt extends NonNullable<Parameters<typeof consecratedIds>[0]> {
  readonly gold?: number | null | undefined;
  readonly discoveries?: readonly unknown[] | null | undefined;
  readonly conceded?: boolean | undefined;
  readonly _eliminated?: boolean | undefined;
}
/** An order as the telemetry records it, as the turn holds it once the realms' orders are merged: its target and extra
 *  may be held as a number, and every field may be missing in an older save. */
interface AnOrderAsTheTelemetryReadsIt {
  readonly action?: string | null | undefined;
  readonly target?: string | number | null | undefined;
  readonly extra?: string | number | null | undefined;
  readonly desc?: string | null | undefined;
  readonly _pinned?: boolean | undefined;
  readonly _unifiedWith?: number | null | undefined;
}
/** The state as a realm's stance toward another is read (relOfReport's): its relations. */
type TheRelationsAsTheyAreRead = Parameters<typeof relOfReport>[0];
/** A loaded state as the telemetry reads it (any save's: every list guarded). */
interface TheStateAsTheTelemetryReadsIt extends TheRelationsAsTheyAreRead {
  readonly players?: readonly (ARealmAsTheSnapshotReadsIt | null | undefined)[] | null | undefined;
  readonly world?:
    | { readonly provinces?: readonly (AProvinceAsTheSnapshotReadsIt | null | undefined)[] | null | undefined }
    | null
    | undefined;
  readonly characters?: readonly (AHeroAsTheTelemetryReadsHim | null | undefined)[] | null | undefined;
  readonly turnOrders?:
    Readonly<Partial<Record<number, readonly (AnOrderAsTheTelemetryReadsIt | null | undefined)[]>>> | null | undefined;
}
/** A hero's phase in the orders' record: the action, and what else it held. */
interface APhaseAsTheOrdersRecordHoldsIt {
  a: string;
  t?: string;
  x?: string;
  d?: string;
  pinned?: number;
  unified?: number;
}
/** A spell worked in a battle or a duel, as the statistics record it: its phase; the caster's realm and id (as his
 *  copy holds it); the spell, its school and the caster's level in it; the chance, whether the roll landed, and where
 *  it was worked ('battle' or 'duel'). Not a line: db/telemetry.ts writes it into turn_events (plan P1-12d33). */
export interface ASpellWorkedInAFightAsTheStatisticsRecordIt {
  ph: number | null;
  pi: number;
  charId: number | string | null | undefined;
  spell: string;
  school: string | null | undefined;
  lvl: number;
  chance: number;
  ok: boolean;
  ctx: string;
}
/** A spell worked in a battle or a duel, for the statistics: the record, as it was kept before it was a fact. */
export interface TheFactOfASpellWorkedInAFightForTheStatistics {
  kind: 'a spell worked in a battle or a duel, for the statistics';
  record: ASpellWorkedInAFightAsTheStatisticsRecordIt;
}
// A spell worked inside a battle or a duel (2026-10-09, Toby item 5): only the Cast order logged its
// casts, so pre-battle, defender and duel magic never reached the spell records. ctx says where. Filed through
// recordForTheStatistics (plan P1-12d33).
export const telSpell = (
  turnContext: Pick<TurnContext, '_tel' | '_logCtx' | '_currentPhase'>,
  ch: (object & AHeroAsASpellRecordNamesHim) | null | undefined,
  spell: string,
  school: string | null | undefined,
  lvl: number,
  chance: number,
  roll: number,
  ctx: string,
) => {
  try {
    if (ch?.player != null)
      recordForTheStatistics(turnContext, {
        kind: 'a spell worked in a battle or a duel, for the statistics',
        record: {
          ph: turnContext._logCtx.phase ?? turnContext._currentPhase,
          pi: ch.player,
          charId: ch.id,
          spell,
          school,
          lvl,
          chance,
          ok: roll <= chance,
          ctx,
        },
      });
  } catch (_te) {}
};

// ── NO SILENT SEASON (2026-10-09, Toby item 1) ────
// Every hero of a realm has at least one line in every season of his Chronicle. A hero can still
// be moved or swept into a fight by code that files its lines under someone else (a veiled march,
// a pooled host, a stalled battle resumed by the strongest force); his season then read as if he
// did nothing. Run at the end of each phase: a living realm hero with no line of his own for the
// phase — by charId, by charIds, or as a commander of one of its battles (the same tests the report
// uses to file a line under him) — gets a plain line saying where the season leaves him. The line is a fact (since
// P1-12d15: the-facts-a-silent-heros-season-line-records.ts), each province's name as the world holds it (none where
// the line says "the field"), its words written in the views.
export function noteSilentHeroes(
  turnContext: TurnContext,
  ph: number,
  startLoc: Readonly<Partial<Record<number, number | null>>> | null | undefined,
) {
  const { turnLog, battleCommanders } = turnContext;
  const { G }: { readonly G: TheStateAsTheSilentHeroesReadIt } = turnContext;
  const heard = new Set<number>();
  turnLog.forEach((e) => {
    if (e.phase !== ph) return;
    if (e.charId != null) heard.add(e.charId);
    if (Array.isArray(e.charIds)) e.charIds.forEach((id) => heard.add(id));
  });
  // the commanders by any battle's key
  const theCommanders: Readonly<Partial<Record<string, readonly number[]>>> = battleCommanders;
  Object.keys(battleCommanders).forEach((k) => {
    if (k.endsWith(`@${String(ph)}`)) (theCommanders[k] ?? []).forEach((id) => heard.add(id));
  });
  (G.characters ?? []).forEach((c) => {
    if (!c?.alive || c.player == null || heard.has(c.id)) return;
    const from = startLoc ? startLoc[c.id] : undefined;
    emit(turnContext, {
      type: 'move',
      fact:
        from != null && from !== c.location
          ? {
              kind: 'a hero with no line of his own leaves a province and ends the season in another',
              heroName: c.name,
              fromProvinceName: (G.world.provinces[from]?.name ?? '') || null,
              provinceName: (c.location != null ? (G.world.provinces[c.location]?.name ?? '') : '') || null,
            }
          : {
              kind: 'a hero with no line of his own remains where he is this season',
              heroName: c.name,
              provinceName: (c.location != null ? (G.world.provinces[c.location]?.name ?? '') : '') || null,
            },
      audience: { actor: c.player, realms: [c.player] },
      hero: c.id,
      phase: ph,
      province: c.location ?? null,
    });
  });
}

// A realm's name as a line's fact holds it for the tag after a hero's name, or null for no realm: the prose writes
// " (Westmarch)" (theRealmsTag, the realm works' prose; plan P1-12d25: realmTag moved there as its words).
export function theNameOfAPlayersRealm(
  turnContext: { readonly G: { readonly players: readonly { readonly name: string }[] } },
  pi: number | null | undefined,
) {
  const { G } = turnContext;
  const theRealm = pi != null ? G.players[pi] : undefined;
  return theRealm ? theRealm.name : null;
}

// ── SNAPSHOT of one realm's situation, from a parsed game state. Module level: uses only module-level
// helpers (unitBaseStrength, relOfReport, consecratedIds), so buildGameResultRows can call it on any
// loaded state, not just inside runTurn.
export function telRealmSnapshot(gs: TheStateAsTheTelemetryReadsIt | null | undefined, pi: number) {
  if (!gs) return null;
  const pl = (gs.players ?? [])[pi];
  if (!pl) return null;
  const provs = gs.world?.provinces ?? [];
  const owned = provs.filter((p): p is AProvinceAsTheSnapshotReadsIt => p?.owner === pi);
  const chars = (gs.characters ?? []).filter(
    (c): c is AHeroAsTheTelemetryReadsHim => c?.player === pi && c.alive === true,
  );
  const king = chars.find((c) => c.isKing) ?? null;
  const unitRec = (a: AUnitAsTheSnapshotReadsIt) => ({
    t: a.type,
    q: (a.quality ?? '') || 'Average',
    ...(a._isSkeletal ? { sk: 1 } : {}),
  });
  let ledUnits = 0,
    ledStr = 0,
    garUnits = 0,
    garStr = 0;
  const characters = chars.map((c) => {
    const units = (c.armies ?? []).filter((a): a is AUnitAsTheSnapshotReadsIt => !!a && !a._phantom);
    units.forEach((a) => {
      ledUnits++;
      ledStr += unitBaseStrength(a);
    });
    const pv = c.location != null ? provs[c.location] : null;
    const skills: Record<string, number> = {};
    Object.entries(c.skills ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v > 0) skills[k] = v;
    });
    return {
      id: c.id,
      name: c.name,
      king: !!c.isKing,
      loc: c.location,
      terrain: pv ? pv.terrain : null,
      home: pv?.owner === pi,
      hp: c.hp,
      maxHp: c.maxHp,
      skills,
      units: units.map(unitRec),
      items: (c.items ?? []).map((it) => it?.name).filter(Boolean),
    };
  });
  owned.forEach((p) => {
    (p.garrisonArmies ?? []).forEach((a) => {
      if (a) {
        garUnits++;
        garStr += unitBaseStrength(a);
      }
    });
  });
  // heroes who fell THIS turn, as they were at death (the Hall of Fame counts their peaks; no totals
  // above include them). Units and items are what death left on them, usually nothing.
  const fallen = (gs.characters ?? [])
    .filter((c): c is AHeroAsTheTelemetryReadsHim => c?.player === pi && !c.alive && c.killedThisTurn === true)
    .map((c) => {
      const skills: Record<string, number> = {};
      Object.entries(c.skills ?? {}).forEach(([k, v]) => {
        if (v !== undefined && v > 0) skills[k] = v;
      });
      return {
        id: c.id,
        name: c.name,
        king: !!c.isKing,
        fell: 1,
        hp: 0,
        maxHp: c.maxHp,
        skills,
        units: (c.armies ?? []).filter((a): a is AUnitAsTheSnapshotReadsIt => !!a && !a._phantom).map(unitRec),
        items: (c.items ?? []).map((it) => it?.name).filter(Boolean),
      };
    });
  const tax = owned.reduce((s, p) => s + (Number(p.tax) || 0), 0);
  const worldTax = provs.reduce((s, p) => s + (Number(p?.tax) || 0), 0);
  const rel: { enemies: number[]; allies: number[] } = { enemies: [], allies: [] };
  (gs.players ?? []).forEach((o, oi) => {
    if (oi === pi || !o) return;
    const r = relOfReport(gs, pi, oi);
    if (r === 'enemy') rel.enemies.push(oi);
    else if (r === 'allied') rel.allies.push(oi);
  });
  const explored = provs.filter((p) => p && Array.isArray(p.visitedBy) && p.visitedBy.includes(pi)).length;
  const legNames = typeof LEGENDARY_NAMES_P !== 'undefined' ? LEGENDARY_NAMES_P : new Set();
  let items = 0,
    relics = 0;
  chars.forEach((c) => {
    (c.items ?? []).forEach((it) => {
      if (!it) return;
      items++;
      if (legNames.has(it.name)) relics++;
    });
  });
  return {
    gold: Math.round(Number(pl.gold) || 0),
    provinces: owned.length,
    land: owned.filter((p) => p.terrain !== 'sea').length,
    sea: owned.filter((p) => p.terrain === 'sea').length,
    tax,
    taxShare: worldTax > 0 ? Math.round((1000 * tax) / worldTax) / 10 : 0,
    chars: chars.length,
    heroes: chars.length - (king ? 1 : 0),
    kingAlive: !!king,
    kingHp: king ? king.hp : null,
    ledUnits,
    ledStr: Math.round(ledStr),
    garUnits,
    garStr: Math.round(garStr),
    units: ledUnits + garUnits,
    str: Math.round(ledStr + garStr),
    items,
    relics,
    discoveries: (pl.discoveries ?? []).length,
    consecrated: consecratedIds(pl).length,
    explored,
    conceded: !!pl.conceded,
    eliminated: !!pl._eliminated,
    rel,
    characters,
    ...(fallen.length ? { fallen } : {}),
  };
}
// The orders a realm gave this turn, as resolved by runTurn's ingestion (humans' submitted orders,
// bots' planned ones, Defend for anything missing). One entry per living character, five phases each.
export function telOrdersFor(
  gs: TheStateAsTheTelemetryReadsIt,
  pi: number,
  extras: Readonly<Record<string, unknown>> | null | undefined,
) {
  const chars = (gs.characters ?? []).filter(
    (c): c is AHeroAsTheTelemetryReadsHim => c?.player === pi && c.alive === true,
  );
  const byChar: Record<number, { name: string; king: boolean; ph: APhaseAsTheOrdersRecordHoldsIt[] }> = {};
  chars.forEach((c) => {
    const slots = gs.turnOrders?.[c.id] ?? [];
    byChar[c.id] = {
      name: c.name,
      king: !!c.isKing,
      ph: [0, 1, 2, 3, 4].map((i): APhaseAsTheOrdersRecordHoldsIt => {
        const o = slots[i];
        if (!o) return { a: 'defend' };
        const r: APhaseAsTheOrdersRecordHoldsIt = { a: ((o.action ?? '') || 'defend').toLowerCase() };
        if (o.target != null && o.target !== '') r.t = String(o.target).slice(0, 80);
        if (o.extra != null && o.extra !== '') r.x = String(o.extra).slice(0, 80);
        if (o.desc) r.d = o.desc.slice(0, 140);
        if (o._pinned) r.pinned = 1;
        if (o._unifiedWith != null) r.unified = o._unifiedWith;
        return r;
      }),
    };
  });
  const out: Record<string, unknown> = { chars: byChar };
  if (extras) {
    Object.entries(extras).forEach(([k, v]) => {
      if (
        v !== undefined &&
        v !== null &&
        !(Array.isArray(v) && !v.length) &&
        !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)
      )
        out[k] = v;
    });
  }
  return out;
}
