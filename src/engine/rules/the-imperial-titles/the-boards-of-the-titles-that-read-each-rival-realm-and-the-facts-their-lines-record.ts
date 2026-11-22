// The boards of the Imperial Titles that read each rival realm as a whole (B-06, T7, the rules pulled out: its
// Reckoning and titles family, row B-06o): the effects of two stages of `turnEnd`, each the title intelligence's block
// of its title, moved as it was from imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy
// (src/engine/titles/title-intel-for-each-holder-and-the-titles-won-and-lost-this-turn.ts), and the facts their lines
// record.
// - "turnEnd: the board an Imperial Title of the realm shows its holder": the Throne (each realm's share of the world
//   tax base) and the Vaultkeeper (each realm's treasury).
// - "turnEnd: the board a hero's Imperial Title shows his realm": the Cartographer (each realm's atlas), the Beastlord
//   (each realm's monsters under arms) and the Wildwarden (each realm's creatures in the field).
// Each effect is handed the seat of the realm holding its title, the world as its board reads it, the standings and
// whether the holder has met a realm, and returns its lines' facts, in the order the block wrote them; the turn writes
// each line, for the holder's realm alone, and then the line for the realms he hasn't met. No effect draws a die. The
// runner is in the-registry-of-the-imperial-titles-effects.ts.
// The facts (plan P1-12d13): each kind holds plain values, a realm as the line names it, a hero's or a province's name
// as the world holds it (null where it has none), counts and figures; the prose writes the words
// (src/views/prose/the-words-of-the-title-intelligence-lines.ts). The other kinds of the title intelligence, and each
// kind's audience, are in src/engine/titles/the-facts-the-title-intelligence-lines-record.ts, which joins these to them.
import { dispFloor } from '../../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { asItsGuardReadsIt } from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import type { AnImperialTitlesSlug } from '../../../content/kingdoms-call-data.ts';
import type {
  AHeroAsAnImperialTitlesBoardReadsHim,
  AProvinceAsAnImperialTitlesBoardReadsIt,
  ACompanyAsAnImperialTitlesBoardReadsIt,
  TheStagesOfEachHookPoint,
} from '../the-registry-of-content-effects.ts';

/** A realm as a title's line names it: its name as the world holds it (null: none, and the prose writes "Player N"
 *  from its seat, counted from 0). */
export interface ARealmATitlesLineNames {
  realmName: string | null;
  seat: number;
}

/** A realm's largest host of monsters or creatures: how many, whose, and where (null: nowhere the world names). */
interface ALargestHostATitlesLineNames {
  units: number;
  heroName: string;
  provinceName: string | null;
}

/** A realm's beasts under arms: whose (null: the holder's own, "Your realm"), how many, and its largest host (null:
 *  all of them garrisoned). */
interface ARealmsBeasts {
  realm: ARealmATitlesLineNames | null;
  units: number;
  largestHost: ALargestHostATitlesLineNames | null;
}

/** A realm's atlas: its provinces fully charted and its share of the world mapped. */
interface AnAtlas {
  fullyCharted: number;
  percentMapped: number;
}

/** What a line of the board of a title that reads each rival realm records. */
export type TheFactOfALineOfABoardOfRivalRealms =
  | { kind: "the Throne's holder learns his realm's share of the world tax base"; percent: number }
  | {
      kind: "the Throne's holder learns a rival's share of the world tax base";
      realm: ARealmATitlesLineNames;
      percent: number;
    }
  | { kind: "the Vaultkeeper's holder learns his realm's treasury"; gold: number }
  | { kind: "the Vaultkeeper's holder learns a rival's treasury"; realm: ARealmATitlesLineNames; gold: number }
  | ({ kind: "the Cartographer's holder learns his realm's atlas" } & AnAtlas)
  | ({ kind: "the Cartographer's holder learns a rival's atlas"; realm: ARealmATitlesLineNames } & AnAtlas)
  | { kind: "the Cartographer's holder finds no rival realm to survey" }
  | {
      kind: "the Beastlord's holder learns a realm has no monsters under arms";
      /** Null: the holder's own realm. */
      realm: ARealmATitlesLineNames | null;
    }
  | ({ kind: "the Beastlord's holder learns a realm's monsters under arms" } & ARealmsBeasts)
  | { kind: "the Beastlord's holder finds no rival realm to reckon" }
  | {
      kind: "the Wildwarden's holder learns the wild answers to no one in a realm";
      /** Null: the holder's own realm. */
      realm: ARealmATitlesLineNames | null;
    }
  | ({ kind: "the Wildwarden's holder learns a realm's creatures in the field" } & ARealmsBeasts)
  | { kind: "the Wildwarden's holder finds no rival realm to reckon" };

type TheTurnsEndsStages = TheStagesOfEachHookPoint['turnEnd'];

/** "turnEnd: the board an Imperial Title of the realm shows its holder": the Throne's and the Vaultkeeper's. */
export const THE_BOARD_AN_IMPERIAL_TITLE_OF_THE_REALM_SHOWS_ITS_HOLDER = {
  // THE THRONE — each rival's share of the world tax base. Uses the SAME denominator as the
  // Reckoning (STD.worldTax = every province, land AND sea), so these %s correlate across
  // reports. 2026-09-09: every comparative title report now opens with the holder's OWN figure,
  // so the rivals' numbers can be read against something.
  throne: ({ theHoldersSeat: pi, theWorld: G, theStandings: STD, heHasMet: met }) => {
    const theLines: TheFactOfALineOfABoardOfRivalRealms[] = [];
    const world = STD.worldTax || 1;
    const own = dispFloor((100 * ((STD.taxByPlayer[pi] ?? 0) || 0)) / world);
    theLines.push({ kind: "the Throne's holder learns his realm's share of the world tax base", percent: own });
    G.players.forEach((pl, i) => {
      if (i === pi || !met(pi, i)) return;
      const pct = Math.round((100 * ((STD.taxByPlayer[i] ?? 0) || 0)) / world);
      theLines.push({
        kind: "the Throne's holder learns a rival's share of the world tax base",
        realm: { realmName: (G.players[i]?.name ?? '') || null, seat: i },
        percent: pct,
      });
    });
    return theLines;
  },
  // THE VAULTKEEPER — each rival's treasury (own line).
  vault: ({ theHoldersSeat: pi, theWorld: G, heHasMet: met }) => {
    const theLines: TheFactOfALineOfABoardOfRivalRealms[] = [];
    theLines.push({
      kind: "the Vaultkeeper's holder learns his realm's treasury",
      gold: (G.players[pi]?.gold ?? 0) || 0,
    });
    G.players.forEach((pl, i) => {
      if (i === pi || !met(pi, i)) return;
      theLines.push({
        kind: "the Vaultkeeper's holder learns a rival's treasury",
        realm: { realmName: (G.players[i]?.name ?? '') || null, seat: i },
        gold: pl.gold || 0,
      });
    });
    return theLines;
  },
} satisfies Partial<
  Record<AnImperialTitlesSlug, TheTurnsEndsStages['the board an Imperial Title of the realm shows its holder']>
>;

/** A realm's census of the beasts of a set: how many it fields (its heroes' companies and its garrisons'), and the hero
 *  leading the most of them and how many (the Beastlord's and the Wildwarden's boards, each as its block counted). */
type TheCensusOfARealmsBeasts = (
  i: number,
  set: ReadonlySet<string>,
) => { total: number; best: AHeroAsAnImperialTitlesBoardReadsHim | null; bn: number };

/** "turnEnd: the board a hero's Imperial Title shows his realm": the Cartographer's, the Beastlord's and the
 *  Wildwarden's. */
// ── 2026-09-17: ALL THREE ARE NOW RIVAL-BY-RIVAL BOARDS ────
// These three shipped as WORLD-facing lines (the far horizon, the breeding grounds, battles on
// wild ground). Toby's ruling: each should say something about every OTHER player, the shape
// the Throne, Vaultkeeper, Grand Marshal and Sea Lord already use. One line per rival, opening
// with the holder's own figure so the rivals' numbers can be read against something.
export const THE_BOARD_A_HEROS_IMPERIAL_TITLE_SHOWS_HIS_REALM = {
  // THE CARTOGRAPHER — the rival atlas. For each realm: how many provinces they have charted to
  // 100%, and their mapped ground as a share of the whole world. `exploredBy` is already kept per
  // realm per province, so this is a straight read — nothing new is tracked for it.
  carto: ({ theHoldersSeat: pi, theWorld: G, theProvinces: provs, heHasMet: met }) => {
    const theLines: TheFactOfALineOfABoardOfRivalRealms[] = [];
    const land = provs.filter((pv): pv is AProvinceAsAnImperialTitlesBoardReadsIt => Boolean(pv));
    const world = land.length || 1;
    const atlas = (i: number) => {
      let full = 0,
        pts = 0;
      land.forEach((pv) => {
        const e = Number(pv.exploredBy?.[String(i)]) || 0;
        pts += e;
        if (e >= 100) full++;
      });
      return { full, pct: Math.round(pts / world) }; // pts is a sum of 0-100 figures, so /world is the mean = the share
    };
    const own = atlas(pi);
    theLines.push({
      kind: "the Cartographer's holder learns his realm's atlas",
      fullyCharted: own.full,
      percentMapped: own.pct,
    });
    let any = false;
    for (const [i] of G.players.entries()) {
      if (i === pi || !met(pi, i)) continue;
      any = true;
      const a = atlas(i);
      theLines.push({
        kind: "the Cartographer's holder learns a rival's atlas",
        realm: { realmName: (G.players[i]?.name ?? '') || null, seat: i },
        fullyCharted: a.full,
        percentMapped: a.pct,
      });
    }
    if (!any) theLines.push({ kind: "the Cartographer's holder finds no rival realm to survey" });
    return theLines;
  },
  // THE BEASTLORD — the rival menagerie. For each realm: how many Monster-category units they
  // field, and the province holding their largest monster host. Garrisoned beasts are counted in
  // the TOTAL (a realm can muster straight into a garrison) but the named host is always a
  // commander's, because a garrison cannot march at you.
  beast: ({ theHoldersSeat: pi, theWorld: G, theProvinces: provs, heHasMet: met }) => {
    const theLines: TheFactOfALineOfABoardOfRivalRealms[] = [];
    const census: TheCensusOfARealmsBeasts = (i, set) => {
      let total = 0,
        best: AHeroAsAnImperialTitlesBoardReadsHim | null = null,
        bn = 0;
      for (const c of (asItsGuardReadsIt(G.characters) ?? []).filter(
        (c: AHeroAsAnImperialTitlesBoardReadsHim | null | undefined) => c?.alive && c.player === i,
      )) {
        const n = (asItsGuardReadsIt(c.armies) ?? []).filter(
          (a: ACompanyAsAnImperialTitlesBoardReadsIt | null | undefined) => a && set.has(a.type),
        ).length;
        total += n;
        if (n > bn) {
          bn = n;
          best = c;
        }
      }
      provs.forEach((pv) => {
        if (pv?.owner === i)
          total += (asItsGuardReadsIt(pv.garrisonArmies) ?? []).filter(
            (a: ACompanyAsAnImperialTitlesBoardReadsIt | null | undefined) => a && set.has(a.type),
          ).length;
      });
      return { total, best, bn };
    };
    const line = (i: number, realm: ARealmATitlesLineNames | null) => {
      const r = census(i, MONSTER_ARMIES);
      if (r.total === 0) {
        theLines.push({ kind: "the Beastlord's holder learns a realm has no monsters under arms", realm });
        return;
      }
      theLines.push({
        kind: "the Beastlord's holder learns a realm's monsters under arms",
        realm,
        units: r.total,
        largestHost: r.best
          ? { units: r.bn, heroName: r.best.name, provinceName: (provs[r.best.location]?.name ?? '') || null }
          : null,
      });
    };
    line(pi, null);
    let any = false;
    for (const [i] of G.players.entries()) {
      if (i === pi || !met(pi, i)) continue;
      any = true;
      line(i, { realmName: (G.players[i]?.name ?? '') || null, seat: i });
    }
    if (!any) theLines.push({ kind: "the Beastlord's holder finds no rival realm to reckon" });
    return theLines;
  },
  // THE WILDWARDEN — the rival wild host. The same census, for the free beasts: thunderbirds, ents,
  // bears, giants, unicorns, mammoths, rocs, whale cohorts and great turtles (KC_UNIT_CLASS.creature). Deliberately symmetrical with the Beastlord's board so
  // a player holding both reads one format twice rather than two.
  wild: ({ theHoldersSeat: pi, theWorld: G, theProvinces: provs, heHasMet: met }) => {
    const theLines: TheFactOfALineOfABoardOfRivalRealms[] = [];
    const census: TheCensusOfARealmsBeasts = (i, set) => {
      let total = 0,
        best: AHeroAsAnImperialTitlesBoardReadsHim | null = null,
        bn = 0;
      for (const c of (asItsGuardReadsIt(G.characters) ?? []).filter(
        (c: AHeroAsAnImperialTitlesBoardReadsHim | null | undefined) => c?.alive && c.player === i,
      )) {
        const n = (asItsGuardReadsIt(c.armies) ?? []).filter(
          (a: ACompanyAsAnImperialTitlesBoardReadsIt | null | undefined) => a && set.has(a.type),
        ).length;
        total += n;
        if (n > bn) {
          bn = n;
          best = c;
        }
      }
      provs.forEach((pv) => {
        if (pv?.owner === i)
          total += (asItsGuardReadsIt(pv.garrisonArmies) ?? []).filter(
            (a: ACompanyAsAnImperialTitlesBoardReadsIt | null | undefined) => a && set.has(a.type),
          ).length;
      });
      return { total, best, bn };
    };
    const line = (i: number, realm: ARealmATitlesLineNames | null) => {
      const r = census(i, CREATURE_ARMIES);
      if (r.total === 0) {
        theLines.push({ kind: "the Wildwarden's holder learns the wild answers to no one in a realm", realm });
        return;
      }
      theLines.push({
        kind: "the Wildwarden's holder learns a realm's creatures in the field",
        realm,
        units: r.total,
        largestHost: r.best
          ? { units: r.bn, heroName: r.best.name, provinceName: (provs[r.best.location]?.name ?? '') || null }
          : null,
      });
    };
    line(pi, null);
    let any = false;
    for (const [i] of G.players.entries()) {
      if (i === pi || !met(pi, i)) continue;
      any = true;
      line(i, { realmName: (G.players[i]?.name ?? '') || null, seat: i });
    }
    if (!any) theLines.push({ kind: "the Wildwarden's holder finds no rival realm to reckon" });
    return theLines;
  },
} satisfies Partial<
  Record<AnImperialTitlesSlug, TheTurnsEndsStages["the board a hero's Imperial Title shows his realm"]>
>;
