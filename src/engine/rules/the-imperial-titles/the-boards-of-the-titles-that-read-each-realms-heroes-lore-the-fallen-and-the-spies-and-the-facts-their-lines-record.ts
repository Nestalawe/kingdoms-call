// The boards of the Imperial Titles that read each realm's heroes and lore, the fallen and the spies (B-06, T7, the
// rules pulled out: its Reckoning and titles family, row B-06p): the effects of two stages of `turnEnd`, each the title
// intelligence's block of its title, moved as it was from
// imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy
// (src/engine/titles/title-intel-for-each-holder-and-the-titles-won-and-lost-this-turn.ts), and the facts their lines
// record.
// - "turnEnd: the board a hero's Imperial Title shows of each realm's heroes and lore": the Grand Marshal (each realm's
//   strongest land army), the Sea Lord (its strongest fleet), the Monster-Bane (its champion of monster-blood), the
//   Loremaster (its discoveries, and the fresh ones his scholars may copy) and the Archmage (each school's foremost mage
//   outside the holder's realm).
// - "turnEnd: the board a hero's Imperial Title shows of the fallen and of the spies in his lands": the Hierophant (what
//   each fallen hero the realm can see knew), the Deathpriest (each province's crack and elite dead, which its
//   Grave-sight files under Graveyards Known) and the Spymaster (the turn's espionage against the realm's lands).
// Each effect is handed the seat of the realm holding its title, the world as its board reads it and whether the
// holder has met a realm, and returns its board: its lines' facts, in the order the block wrote them, and, for the
// Loremaster, the fresh discoveries his scholars may copy, for the Deathpriest, what its Grave-sight files before each
// line. No effect draws a die or writes: the turn writes each line, for the holder's realm alone, files the
// Grave-sight's finds, draws the Loremaster's copy and adds it to his realm, and, after the first stage's boards, writes
// the line for the realms the holder hasn't met. The runner is in the-registry-of-the-imperial-titles-effects.ts.
// The facts (plan P1-12d13): each kind holds plain values, a realm as the line names it, a hero's, a province's or a
// discovery's name as the world holds it (null where it has none), counts, figures, a flag and a school's slug; one
// field holds words still, what an agent did, as the Spymaster's ledger stores it (the saved game's words). The prose
// writes the words (src/views/prose/the-words-of-the-title-intelligence-lines.ts). The other kinds of the title
// intelligence, and each kind's audience, are in src/engine/titles/the-facts-the-title-intelligence-lines-record.ts,
// which joins these to them.
import { SEA_TYPES } from '../../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { unitBaseStrength } from '../../rules-on-plain-values/unit-types-and-base-strength.ts';
import {
  aLevelAboveNothing,
  asItsGuardReadsIt,
} from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { AnImperialTitlesSlug } from '../../../content/kingdoms-call-data.ts';
import type {
  ACompanyAsAnImperialTitlesBoardReadsIt,
  AFallenHeroAsTheHierophantsBoardReadsHim,
  AFreshDiscoveryTheLoremastersScholarsMayCopy,
  AHeroAsAnImperialTitlesBoardReadsHim,
  AnActOfEspionageAsTheSpymastersBoardReadsIt,
  AnImperialTitlesHolderAndTheWorldHisBoardReads,
  AProvinceAsAnImperialTitlesBoardReadsIt,
  TheStagesOfEachHookPoint,
  WhatAGraveSightFilesOfAProvince,
} from '../the-registry-of-content-effects.ts';
import type { ARealmATitlesLineNames } from './the-boards-of-the-titles-that-read-each-rival-realm-and-the-facts-their-lines-record.ts';

/** A magic school the Archmage reads, by its slug. */
export type ASchoolTheArchmageReads = 'white' | 'psychic' | 'illusory' | 'elemental' | 'necromancy';

/** A realm's strongest army or fleet: its commander, where he stands (null: nowhere the world names), its strength. */
export interface AStrongestForceATitlesLineNames {
  commanderName: string;
  provinceName: string | null;
  strength: number;
}

/** A realm's foremost monster-slayer, where he stands (null: nowhere the world names), and his tally. */
interface AChampionATitlesLineNames {
  heroName: string;
  provinceName: string | null;
  monsterBlood: number;
}

/** What a line of the board of a title that reads each realm's heroes and lore, the fallen or the spies records. */
export type TheFactOfALineOfABoardOfEachRealmsHeroesLoreTheFallenAndTheSpies =
  | {
      kind: "the Grand Marshal's holder learns his realm's strongest land army";
      /** Null: no land army in the field. */
      army: AStrongestForceATitlesLineNames | null;
    }
  | {
      kind: "the Grand Marshal's holder learns a rival's strongest land army";
      realm: ARealmATitlesLineNames;
      army: AStrongestForceATitlesLineNames;
    }
  | { kind: "the Grand Marshal's holder learns no rival fields a land army" }
  | {
      kind: "the Sea Lord's holder learns his realm's strongest fleet";
      /** Null: no fleet at sea. */
      fleet: AStrongestForceATitlesLineNames | null;
    }
  | {
      kind: "the Sea Lord's holder learns a rival's strongest fleet";
      realm: ARealmATitlesLineNames;
      fleet: AStrongestForceATitlesLineNames;
    }
  | { kind: "the Sea Lord's holder learns no rival fields a fleet" }
  | {
      kind: "the Monster-Bane's holder learns his realm's champion";
      /** Null: no hero of his has drawn monster-blood. */
      champion: AChampionATitlesLineNames | null;
    }
  | {
      kind: "the Monster-Bane's holder learns a rival's champion";
      realm: ARealmATitlesLineNames;
      champion: AChampionATitlesLineNames;
    }
  | { kind: "the Monster-Bane's holder learns no rival's hero has drawn monster-blood" }
  | {
      kind: "the Loremaster's holder learns a rival's discoveries";
      realm: ARealmATitlesLineNames;
      /** Each discovery's name as the world holds it, in the rival's order (at least one). */
      discoveries: readonly string[];
    }
  | { kind: "the Loremaster's holder learns a rival holds no discoveries"; realm: ARealmATitlesLineNames }
  | { kind: "the Loremaster's holder learns no rival has learned anything worth copying" }
  | {
      kind: "the Archmage's holder learns a school's foremost mage outside his realm";
      school: ASchoolTheArchmageReads;
      heroName: string;
      level: number;
      /** Null: a hero who serves no realm (the prose says he guards his province). */
      realm: ARealmATitlesLineNames | null;
      provinceName: string | null;
    }
  | { kind: "the Archmage's holder learns of no mage of a school outside his realm"; school: ASchoolTheArchmageReads }
  | {
      kind: "the Hierophant's holder hears what a fallen hero knew";
      heroName: string;
      /** Null: a hero who served no realm. */
      realm: ARealmATitlesLineNames | null;
      isKing: boolean;
      provinceName: string | null;
      /** Each skill he carried (above 0), highest first, by its slug, with its level. */
      skills: readonly { skill: string; level: number }[];
    }
  | { kind: "the Hierophant's holder finds no fallen hero to read" }
  | {
      kind: "the Deathpriest's Grave-sight finds crack and elite dead in a province";
      provinceName: string | null;
      count: number;
    }
  | { kind: "the Deathpriest's Grave-sight finds no crack or elite dead" }
  | {
      kind: "the Spymaster's holder learns of an act of espionage against his lands";
      agentIsKing: boolean;
      /** Null: the ledger names none (the prose writes "an unknown agent"). */
      agentName: string | null;
      /** Null: an agent sworn to no crown. */
      agentsRealm: ARealmATitlesLineNames | null;
      /** What the agent did, as the Spymaster's ledger stores it ("spied out the province"): the saved game's words. */
      whatTheAgentDid: string;
      provinceName: string | null;
    }
  | {
      kind: "the Spymaster's holder learns who intruded into his lands this turn";
      intrusions: number;
      /** Each hero who intruded, most acts first: his name (null: none the ledger names), his realm, how often. */
      heroes: readonly { heroName: string | null; realm: ARealmATitlesLineNames | null; times: number }[];
    }
  | { kind: "the Spymaster's holder learns no hand was raised against his lands" };

type TheTurnsEndsStages = TheStagesOfEachHookPoint['turnEnd'];
type TheWorld = AnImperialTitlesHolderAndTheWorldHisBoardReads['theWorld'];

// The Grand Marshal's and the Sea Lord's measures, as the title intelligence's function kept them for both boards.
const isNaval = (t: string) => SEA_TYPES.has(t);
const kindStr = (ch: AHeroAsAnImperialTitlesBoardReadsHim, naval: boolean) =>
  (asItsGuardReadsIt(ch.armies) ?? [])
    .filter((a) => (naval ? isNaval(a.type) : !isNaval(a.type)))
    .reduce((s, a) => s + unitBaseStrength(a), 0);
// Strongest land/sea force for a rival → the COMMANDING character, so we can name them AND give
// their current province.
const strongestChar = (G: TheWorld, pi: number, naval: boolean) => {
  let best = -1,
    bc: AHeroAsAnImperialTitlesBoardReadsHim | null = null;
  for (const c of (asItsGuardReadsIt(G.characters) ?? []).filter((c) => c.alive && c.player === pi)) {
    const st = kindStr(c, naval);
    if (st > best) {
      best = st;
      bc = c;
    }
  }
  return best > 0 ? bc : null;
};

/** "turnEnd: the board a hero's Imperial Title shows of each realm's heroes and lore": the Grand Marshal's, the Sea
 *  Lord's, the Monster-Bane's, the Loremaster's and the Archmage's. */
export const THE_BOARD_A_HEROS_IMPERIAL_TITLE_SHOWS_OF_EACH_REALMS_HEROES_AND_LORE = {
  // THE GRAND MARSHAL — each rival's strongest land army: commander + province (own line).
  marshal: ({ theHoldersSeat: pi, theWorld: G, theProvinces: provs, heHasMet: met }) => {
    const theLines: TheFactOfALineOfABoardOfEachRealmsHeroesLoreTheFallenAndTheSpies[] = [];
    let any = false;
    {
      const oc = strongestChar(G, pi, false);
      theLines.push({
        kind: "the Grand Marshal's holder learns his realm's strongest land army",
        army: oc
          ? {
              commanderName: oc.name,
              provinceName: (provs[oc.location]?.name ?? '') || null,
              strength: kindStr(oc, false),
            }
          : null,
      });
    }
    for (const [i] of G.players.entries()) {
      if (i === pi || !met(pi, i)) continue;
      const c = strongestChar(G, i, false);
      if (c) {
        any = true;
        theLines.push({
          kind: "the Grand Marshal's holder learns a rival's strongest land army",
          realm: { realmName: (G.players[i]?.name ?? '') || null, seat: i },
          army: {
            commanderName: c.name,
            provinceName: (provs[c.location]?.name ?? '') || null,
            strength: kindStr(c, false),
          },
        });
      }
    }
    if (!any) theLines.push({ kind: "the Grand Marshal's holder learns no rival fields a land army" });
    return { theLines };
  },
  // THE SEA LORD — each rival's strongest fleet: commander + province (own line).
  sea: ({ theHoldersSeat: pi, theWorld: G, theProvinces: provs, heHasMet: met }) => {
    const theLines: TheFactOfALineOfABoardOfEachRealmsHeroesLoreTheFallenAndTheSpies[] = [];
    let any = false;
    {
      const oc = strongestChar(G, pi, true);
      theLines.push({
        kind: "the Sea Lord's holder learns his realm's strongest fleet",
        fleet: oc
          ? {
              commanderName: oc.name,
              provinceName: (provs[oc.location]?.name ?? '') || null,
              strength: kindStr(oc, true),
            }
          : null,
      });
    }
    for (const [i] of G.players.entries()) {
      if (i === pi || !met(pi, i)) continue;
      const c = strongestChar(G, i, true);
      if (c) {
        any = true;
        theLines.push({
          kind: "the Sea Lord's holder learns a rival's strongest fleet",
          realm: { realmName: (G.players[i]?.name ?? '') || null, seat: i },
          fleet: {
            commanderName: c.name,
            provinceName: (provs[c.location]?.name ?? '') || null,
            strength: kindStr(c, true),
          },
        });
      }
    }
    if (!any) theLines.push({ kind: "the Sea Lord's holder learns no rival fields a fleet" });
    return { theLines };
  },
  // THE MONSTER-BANE — 2026-09-17: was the single runner-up for the title. Now the foremost
  // monster-slayer of EVERY rival realm, each on their own line with province and tally, so the
  // holder can see the whole field coming rather than only the nearest challenger. An unsworn
  // hero
  // (player==null) is nobody's champion and is left out.
  monster: ({ theHoldersSeat: pi, theWorld: G, theProvinces: provs, heHasMet: met }) => {
    const theLines: TheFactOfALineOfABoardOfEachRealmsHeroesLoreTheFallenAndTheSpies[] = [];
    const bestOf = (i: number) => {
      let b: AHeroAsAnImperialTitlesBoardReadsHim | null = null,
        bm = 0;
      for (const c of (asItsGuardReadsIt(G.characters) ?? []).filter((c) => c.alive && c.player === i)) {
        const m = Number(c.tm?.monster) || 0;
        if (m > bm) {
          bm = m;
          b = c;
        }
      }
      return b ? { c: b, m: bm } : null;
    };
    const own = bestOf(pi);
    theLines.push({
      kind: "the Monster-Bane's holder learns his realm's champion",
      champion: own
        ? { heroName: own.c.name, provinceName: (provs[own.c.location]?.name ?? '') || null, monsterBlood: own.m }
        : null,
    });
    let any = false;
    for (const [i] of G.players.entries()) {
      if (i === pi || !met(pi, i)) continue;
      const r = bestOf(i);
      if (r) {
        any = true;
        theLines.push({
          kind: "the Monster-Bane's holder learns a rival's champion",
          realm: { realmName: (G.players[i]?.name ?? '') || null, seat: i },
          champion: {
            heroName: r.c.name,
            provinceName: (provs[r.c.location]?.name ?? '') || null,
            monsterBlood: r.m,
          },
        });
      }
    }
    if (!any) theLines.push({ kind: "the Monster-Bane's holder learns no rival's hero has drawn monster-blood" });
    return { theLines };
  },
  // THE LOREMASTER — 2026-09-17: was this turn's discoveries only, which in most turns is nothing
  // at all. Now the FULL holding of every rival realm, so the holder can see the whole shape of
  // what others know. The free copy still comes from what was discovered THIS turn: the title
  // reads a rival's library, it does not empty it. (The turn draws the copy from the fresh
  // discoveries handed back, and adds it to the holder's realm.)
  lore: ({ theHoldersSeat: pi, theWorld: G, heHasMet: met }) => {
    const theLines: TheFactOfALineOfABoardOfEachRealmsHeroesLoreTheFallenAndTheSpies[] = [];
    const tt = G.turn - 1;
    const fresh: AFreshDiscoveryTheLoremastersScholarsMayCopy[] = [];
    let anyHeld = false;
    for (const [i, pl] of G.players.entries()) {
      if (i === pi || !met(pi, i)) continue;
      const ds = asItsGuardReadsIt(pl)?.discoveries ?? [];
      if (ds.length) {
        anyHeld = true;
        theLines.push({
          kind: "the Loremaster's holder learns a rival's discoveries",
          realm: { realmName: (G.players[i]?.name ?? '') || null, seat: i },
          discoveries: ds.map((d) => d.name),
        });
      } else
        theLines.push({
          kind: "the Loremaster's holder learns a rival holds no discoveries",
          realm: { realmName: (G.players[i]?.name ?? '') || null, seat: i },
        });
      ds.forEach((d) => {
        if (d.turnDiscovered === tt) fresh.push({ d, i });
      });
    }
    if (!anyHeld) theLines.push({ kind: "the Loremaster's holder learns no rival has learned anything worth copying" });
    const lp = G.players[pi];
    let learn: readonly AFreshDiscoveryTheLoremastersScholarsMayCopy[] = [];
    if (lp && fresh.length) {
      const owned = new Set((lp.discoveries ?? []).map((d) => d.id));
      learn = fresh.filter((f) => !owned.has(f.d.id));
    }
    return { theLines, theFreshDiscoveriesHisScholarsMayCopy: learn };
  },
  // THE ARCHMAGE — 2026-09-17: the foremost mage of each school OUTSIDE the holder's own realm.
  // Naming the holder's own archmage back to them was the one line in the whole title system that
  // told a player something they already knew; this is a rivals' board.
  arch: ({ theHoldersSeat: pi, theWorld: G, theProvinces: provs, heHasMet: met }) => {
    const theLines: TheFactOfALineOfABoardOfEachRealmsHeroesLoreTheFallenAndTheSpies[] = [];
    const tot = (c: AHeroAsAnImperialTitlesBoardReadsHim) => {
      const itsSkills: AHeroAsAnImperialTitlesBoardReadsHim['skills'] = asItsGuardReadsIt(c.skills) ?? {};
      return Object.values(itsSkills).reduce((s: number, v) => s + (Number(v) || 0), 0);
    };
    (['white', 'psychic', 'illusory', 'elemental', 'necromancy'] as const).forEach((sk) => {
      let best: AHeroAsAnImperialTitlesBoardReadsHim | null = null,
        bl = -1,
        bt = -1;
      for (const c of (asItsGuardReadsIt(G.characters) ?? []).filter(
        (c) => c.alive && c.player !== pi && (c.player == null || met(pi, c.player)),
      )) {
        const l = Number(asItsGuardReadsIt(c.skills)?.[sk]) || 0;
        if (l > bl || (l === bl && tot(c) > bt)) {
          bl = l;
          bt = tot(c);
          best = c;
        }
      }
      if (best && bl > 0)
        theLines.push({
          kind: "the Archmage's holder learns a school's foremost mage outside his realm",
          school: sk,
          heroName: best.name,
          level: bl,
          realm:
            best.player != null ? { realmName: (G.players[best.player]?.name ?? '') || null, seat: best.player } : null,
          provinceName: (provs[best.location]?.name ?? '') || null,
        });
      else theLines.push({ kind: "the Archmage's holder learns of no mage of a school outside his realm", school: sk });
    });
    return { theLines };
  },
} satisfies Partial<
  Record<
    AnImperialTitlesSlug,
    TheTurnsEndsStages["the board a hero's Imperial Title shows of each realm's heroes and lore"]
  >
>;

/** "turnEnd: the board a hero's Imperial Title shows of the fallen and of the spies in his lands": the Hierophant's,
 *  the Deathpriest's and the Spymaster's. */
export const THE_BOARD_A_HEROS_IMPERIAL_TITLE_SHOWS_OF_THE_FALLEN_AND_OF_THE_SPIES_IN_HIS_LANDS = {
  // THE HIEROPHANT — 2026-09-17: was the largest skeletal army, which is the Deathpriest's ground
  // and read as a necromancer's perk on a title of the White faith. Now the priest reads the
  // dead: every fallen hero this realm can SEE gives up the skills they carried in life.
  // Visibility mirrors buildTurnReport's `visibleDeadHeroes` — own dead, a fall witnessed this
  // turn, or a body lying in a province the realm holds or has a character standing in — so the
  // title never reveals a corpse the player could not already see on their map, only what that
  // corpse knew.
  hiero: ({ theHoldersSeat: pi, theWorld: G, theProvinces: provs }) => {
    const theLines: TheFactOfALineOfABoardOfEachRealmsHeroesLoreTheFallenAndTheSpies[] = [];
    const seen = new Set(G.players[pi]?.seenDeadHeroIds ?? []);
    const eyes = new Set(
      provs.filter((pv): pv is AProvinceAsAnImperialTitlesBoardReadsIt => pv?.owner === pi).map((pv) => pv.id),
    );
    (asItsGuardReadsIt(G.characters) ?? [])
      .filter((c: AHeroAsAnImperialTitlesBoardReadsHim | null | undefined) => c?.alive && c.player === pi)
      .forEach((c) => {
        if (asItsGuardReadsIt(c.location) != null) eyes.add(c.location);
      });
    const vis = (asItsGuardReadsIt(G.heroGraveyard) ?? []).filter(
      (g: AFallenHeroAsTheHierophantsBoardReadsHim | null | undefined) =>
        g && (g.player === pi || seen.has(g.id) || (asItsGuardReadsIt(g.location) != null && eyes.has(g.location))),
    );
    if (vis.length) {
      vis.forEach((g) => {
        const itsSkills: AFallenHeroAsTheHierophantsBoardReadsHim['skills'] = asItsGuardReadsIt(g.skills) ?? {};
        const skills = Object.entries(itsSkills)
          .filter(aLevelAboveNothing)
          .sort((a, b) => b[1] - a[1])
          .map(([skill, level]) => ({ skill, level }));
        theLines.push({
          kind: "the Hierophant's holder hears what a fallen hero knew",
          heroName: g.name,
          realm: g.player != null ? { realmName: (G.players[g.player]?.name ?? '') || null, seat: g.player } : null,
          isKing: Boolean(asItsGuardReadsIt(g.isKing)),
          provinceName: (provs[g.location]?.name ?? '') || null,
          skills,
        });
      });
    } else theLines.push({ kind: "the Hierophant's holder finds no fallen hero to read" });
    return { theLines };
  },
  // THE DEATHPRIEST — Grave-sight: each province with Crack/Elite dead (own line). Item 8: every
  // Grave-sight find is also written into the realm's graveyard lore, so the Deathpriest's
  // provinces appear in the report's Graveyards Known alongside what their own necromancers have
  // walked over. The reading is PARTIAL — the title picks out crack and elite dead only and is
  // blind to whatever lesser ranks lie beside them — so it is flagged as such and the report says
  // "at least". A province with no crack/elite dead is left alone, never marked bare: Grave-sight
  // seeing nothing worth naming there is not the same as seeing empty ground. (The turn files each
  // find, handed back beside its line, just before it writes the line.)
  necro: ({ theWorld: G, theProvinces: provs }) => {
    const theLines: TheFactOfALineOfABoardOfEachRealmsHeroesLoreTheFallenAndTheSpies[] = [];
    const theGraveSightItFilesBeforeEachLine: WhatAGraveSightFilesOfAProvince[] = [];
    let any = false;
    const theProvinces: readonly (AProvinceAsAnImperialTitlesBoardReadsIt | null | undefined)[] =
      asItsGuardReadsIt(G.world.provinces) ?? [];
    for (const pv of theProvinces) {
      if (!pv) continue;
      const _fine = (pv.battleGraves ?? []).filter(
        (g: ACompanyAsAnImperialTitlesBoardReadsIt | null | undefined) =>
          g && (g.quality === 'Crack' || g.quality === 'Elite'),
      );
      const n = _fine.length;
      if (n > 0) {
        any = true;
        theGraveSightItFilesBeforeEachLine.push({ theProvinceId: pv.id, theDead: _fine });
        theLines.push({
          kind: "the Deathpriest's Grave-sight finds crack and elite dead in a province",
          provinceName: (provs[pv.id]?.name ?? '') || null,
          count: n,
        });
      }
    }
    if (!any) theLines.push({ kind: "the Deathpriest's Grave-sight finds no crack or elite dead" });
    return { theLines, theGraveSightItFilesBeforeEachLine };
  },
  // ── THE FOUR NEW TITLES ────
  // THE SPYMASTER — the counter-intelligence ledger. Every successful act of espionage worked
  // against THIS realm's provinces this turn, named with the realm that worked it and where. This
  // is the RAW ledger: a disguised agent who beat the province watch is still listed here, which
  // is the whole point of the title. Only espionage against ground this realm actually owns is
  // reported.
  spy: ({ theHoldersSeat: pi, theWorld: G, theProvinces: provs }) => {
    const theLines: TheFactOfALineOfABoardOfEachRealmsHeroesLoreTheFallenAndTheSpies[] = [];
    const led = (G._espionageLedger ?? []).filter(
      (e: AnActOfEspionageAsTheSpymastersBoardReadsIt | null | undefined) =>
        e && provs[e.provId]?.owner === pi && e.byPi !== pi,
    );
    if (led.length) {
      // NAME THE AGENT, not the crown. Knowing "Arden pried into your lands" is barely
      // actionable; knowing WHICH hero did it, and where they were standing when they did,
      // tells you who to hunt and where they are. The realm is still given, after the name.
      led.forEach((e) => {
        theLines.push({
          kind: "the Spymaster's holder learns of an act of espionage against his lands",
          agentIsKing: Boolean(asItsGuardReadsIt(e.isKing)),
          agentName: e.charName || null,
          agentsRealm:
            asItsGuardReadsIt(e.byPi) != null
              ? { realmName: (G.players[e.byPi]?.name ?? '') || null, seat: e.byPi }
              : null,
          whatTheAgentDid: e.kind,
          provinceName: (provs[e.provId]?.name ?? '') || null,
        });
      });
      // A hero who worked twice in one turn is ONE name on the roll, with a count — the per-act
      // lines above already carry the detail, and the roll is meant to be read at a glance.
      const byChar = new Map<number, { name: string; pi: number; n: number }>();
      led.forEach((e) => {
        const k = e.charId;
        const r = byChar.get(k) ?? { name: e.charName, pi: e.byPi, n: 0 };
        r.n++;
        byChar.set(k, r);
      });
      const heroes = [...byChar.values()]
        .sort((a, b) => b.n - a.n)
        .map((r) => ({
          heroName: r.name || null,
          realm:
            asItsGuardReadsIt(r.pi) != null ? { realmName: (G.players[r.pi]?.name ?? '') || null, seat: r.pi } : null,
          times: r.n,
        }));
      theLines.push({
        kind: "the Spymaster's holder learns who intruded into his lands this turn",
        intrusions: led.length,
        heroes,
      });
    } else theLines.push({ kind: "the Spymaster's holder learns no hand was raised against his lands" });
    return { theLines };
  },
} satisfies Partial<
  Record<
    AnImperialTitlesSlug,
    TheTurnsEndsStages["the board a hero's Imperial Title shows of the fallen and of the spies in his lands"]
  >
>;
