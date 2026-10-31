import { kcRng } from './rng.ts';
import { QUALITY_TIERS } from './army-tables.ts';
import { unitBaseStrength } from './rules-on-plain-values/unit-types-and-base-strength.ts';
import { effSkillOf } from './heroes/skills-and-hp.ts';
import { armyUnitName } from './dice-and-army-names.ts';
import { noteServedRealm } from './heroes/charms-and-neutrals.ts';
import { whatARealmsDiscoveriesAddToAFallenUnitsFlightHome } from './rules/the-registry-of-discovery-effects.ts';
import type { Army, Character, Grave, Realm } from '../schemas/saved-game-state.ts';
import type { ElvenEscape } from './turn/context.ts';

// Its types (plan P1-10b19): each parameter typed as wide as the body's guards (plan P1-10's Decision 2), so each guard
// stays.
/** A realm's record of one province's graves (the schema's): the turn it was learned, and the roll of the dead if a
 *  reading named them. */
type AGraveRecord = NonNullable<Realm['_graveIntel']>[string];
/** A realm's grave lore as its guards read it: a record by province (a gap among them), or none, or (in a save no
 *  build of the game writes) a value that isn't a record. */
type TheGraveLoreAsItsGuardsReadIt =
  Partial<Record<string, AGraveRecord>> | unknown[] | string | number | boolean | null | undefined;
/** A realm as its grave lore is kept: the lore, written whole where it isn't a record. */
interface ARealmAsItsGraveLoreIsKept {
  _graveIntel?: TheGraveLoreAsItsGuardsReadIt;
}
/** A grave as the lore counts it: its unit's type and quality (each may be missing). */
interface AGraveAsTheLoreCountsIt {
  readonly type?: string | undefined;
  readonly quality?: string | undefined;
}
/** A hero as his skill's level is read (effSkillOf's hero): his skills, curses and items, where he stands and whose he
 *  is. */
type AHeroAsHisSkillIsRead = NonNullable<Parameters<typeof effSkillOf>[0]>;
/** A hero as the graves underfoot are sensed: his skill's hero, and the provinces he has read this turn. */
interface AHeroAsTheGravesAreSensed extends AHeroAsHisSkillIsRead {
  _gravesSensedTurn?: number | undefined;
  _gravesSensedIds?: number[] | null | undefined;
}
/** A province as its graves are sensed: its id and its graves (none in an older save). */
interface AProvinceAsItsGravesAreSensed {
  readonly id: number;
  readonly battleGraves?: readonly unknown[] | null | undefined;
}
/** The state as the graves underfoot are sensed: the turn, the heroes (for an aura's bearer) and the realms, each list
 *  guarded as if it may be missing. */
interface TheStateAsTheGravesAreSensed {
  readonly turn: number;
  readonly characters?: Parameters<typeof effSkillOf>[2];
  readonly players?: readonly (ARealmAsItsGraveLoreIsKept | null | undefined)[] | null | undefined;
}
/** A hero as his grave records him (Resurrect's): the fields the grave copies, and the realms he served. Whether he is
 *  a king may be missing, as the guard below reads it (a hero an untyped caller hands over). */
type AHeroAsHisGraveRecordsHim = { readonly isKing?: boolean | undefined } & Pick<
  Character,
  | 'id'
  | 'name'
  | 'player'
  | 'race'
  | 'alignment'
  | 'temper'
  | 'skills'
  | 'maxHp'
  | 'location'
  | '_servedRealms'
  | '_releasedBy'
>;
/** A unit as a battle's graves record it: the battle's unit, and the marks that keep it from a grave (summoned for a
 *  while, fled home already) or that its flight home carries. */
interface AUnitAsItsGraveIsRecorded extends Army {
  readonly _temporary?: boolean | undefined;
  _elvenEscaped?: boolean | undefined;
  readonly strength?: number | undefined;
}
/** A realm as a fallen unit's flight home reads it: its race, and its discoveries as the registry reads them. */
type ARealmAsAFallenUnitsFlightHomeReadsIt = NonNullable<
  Parameters<typeof whatARealmsDiscoveriesAddToAFallenUnitsFlightHome>[0]
> & { readonly race?: string | null | undefined };
/** A province as a battle's graves are left in it: its ground, and the graves (none until the first). */
interface AProvinceAsItsGravesAreLeft {
  readonly terrain?: string | null | undefined;
  battleGraves?: Army[] | null | undefined;
}
/** A realm's knowledge of the dead heroes as a sighting writes it (each list may be missing in an older save). */
interface ARealmAsItsDeadAreSighted {
  seenDeadHeroIds?: unknown[] | null | undefined;
  knownDeadHeroIds?: number[] | null | undefined;
}

// ══ GRAVEYARD LORE ════
// A character with any Necromancy at all feels the battlefield dead underfoot. At the end of their
// last phase they learn that a province they stand in HOLDS graves — nothing more. A stronger
// effect (Control Undead's province scan) records the roll of the dead as well.
//
// Stored per REALM, not per character, and kept forever: `pl._graveIntel[provId] =
// { turn, detail:[{k:'Average Orc Berserkers', n:2}]|null, detailTurn:N|null }`
// The record is deliberately allowed to go stale — the graves may have been raised or rotted since
// — so the report always stamps the turn it was learned. Detail once learned is never downgraded to
// a bare sensing; it just keeps its own (older) turn stamp. `opts.partial` marks a reading that saw
// only SOME of what lies here — the Deathpriest's Grave-sight, which picks out the crack and elite
// dead across the whole world but is blind to the lesser ranks beside them. A partial reading is
// still the freshest thing the realm knows, so it replaces an older full one, but it is flagged so
// the report can say "at least". A partial reading with nothing to show is NOT treated as "seen
// bare" — the title simply found no crack or elite dead there, which says nothing about whether
// other graves lie in the province.
export function noteGraveIntel(
  pl: ARealmAsItsGraveLoreIsKept | null | undefined,
  provId: number | null | undefined,
  turn: number,
  graves: (AGraveAsTheLoreCountsIt | null | undefined)[] | null | undefined,
  opts?: { readonly partial?: boolean | undefined },
) {
  if (!pl || provId == null) return;
  if (!pl._graveIntel || typeof pl._graveIntel !== 'object' || Array.isArray(pl._graveIntel)) pl._graveIntel = {};
  const partial = !!opts?.partial;
  const list = Array.isArray(graves) ? graves : null;
  // Standing in the province and finding it bare is knowledge too: forget the old record rather
  // than keep promising graves the character can see are not there. (Never on a partial reading.)
  if (list?.length === 0) {
    if (!partial) delete pl._graveIntel[provId];
    return;
  }
  const prev: Partial<AGraveRecord> = pl._graveIntel[provId] ?? {};
  const rec: AGraveRecord = {
    turn: turn,
    detail: prev.detail ?? null,
    detailTurn: (prev.detailTurn ?? 0) || null,
    detailPartial: !!prev.detailPartial,
  };
  if (list?.length) {
    // (each count is written only by + 1, so it is never 0 or NaN)
    const counts: Record<string, number> = {};
    list.forEach((g) => {
      const k = `${(g?.quality ?? '') || 'Average'} ${(g?.type ?? '') || 'unit'}`;
      counts[k] = (counts[k] ?? 0) + 1;
    });
    rec.detail = Object.entries(counts).map(([k, n]) => ({ k, n }));
    rec.detailTurn = turn;
    rec.detailPartial = partial;
  }
  pl._graveIntel[provId] = rec;
}
// ══ RAISING THE DEAD: THE BEST FIRST ════
// The dead do not queue by lot: the most experienced rise first. Ties within an experience tier go
// to the heavier unit (base strength), and only then to chance. Returns the grave record, already
// removed from prov.battleGraves, or null if there are none. 2026-09-15 — RAISING THE DEAD TELLS
// YOU NOTHING ELSE. The count is gone from Skeletal Armies, Harvest the Field, Raise Wraiths and
// Death's Dominion alike. The Control Undead SCAN still reports the roll of the dead in full:
// naming them is the whole point of it.
// Skeletal Armies: how many grave units one successful cast raises, by the caster's effective
// Necromancy (0-5 benefit scale): 1 at level 1-2, 2 at level 3-4, 3 at level 5+.
export function skeletalRaiseCount(lvl: number) {
  lvl = lvl || 0;
  return lvl >= 5 ? 3 : lvl >= 3 ? 2 : 1;
}
export function takeBestGrave(
  prov: { readonly battleGraves?: (Army | null | undefined)[] | null | undefined } | null | undefined,
): Army | null | undefined {
  const gs = prov?.battleGraves ?? [];
  if (!gs.length) return null;
  // the tiers looked up by a quality that may be missing
  const tiers: readonly (string | undefined)[] = QUALITY_TIERS;
  const qi = (g: Army | null | undefined) => {
    const i = tiers.indexOf(g?.quality);
    return i < 0 ? 1 : i;
  }; // unknown quality ≈ Average
  const str = (g: Army | null | undefined) => {
    try {
      if (!g) return 0; // (no grave: the read below threw, and the catch gave 0)
      return unitBaseStrength({ type: g.type, quality: g.quality || 'Average' });
    } catch (e) {
      return 0;
    }
  };
  let best = 0,
    bq = -1,
    bs = -1;
  gs.forEach((g, i) => {
    const q = qi(g),
      s = str(g);
    if (q > bq || (q === bq && s > bs)) {
      bq = q;
      bs = s;
      best = i;
    }
  });
  return gs.splice(best, 1)[0];
}
// ── GRAVES UNDERFOOT, PROVINCE BY PROVINCE ────
// A necromancer feels the battlefield dead of EVERY province they set foot in, not only the one
// they happen to finish the turn standing in. Called from the move choke-point as each march-in
// lands, and again in the end-of-turn sweep for any character who never moved. One reading per
// province per character per turn (tracked on `c._gravesSensedTurn` / `c._gravesSensedIds`), so a
// column that marches back and forth does not spam the Chronicle — and a province read on the way
// through is already in `_graveIntel`, so it shows up in the report's Graveyards Known either way.
// `tellGravesSensed` is the log function to use (the callers differ in phase/context), or null for silent.
export function senseGravesUnderfoot<AProvince extends AProvinceAsItsGravesAreSensed>(
  state: TheStateAsTheGravesAreSensed | null | undefined,
  c: AHeroAsTheGravesAreSensed | null | undefined,
  pv: AProvince | null | undefined,
  tellGravesSensed: ((pv: AProvince) => void) | null | undefined,
) {
  if (!c || !c.alive || c.player == null || !pv) return false;
  // SCOPE TRAP: runTurn declares its own effStat() helper, which is invisible to
  // this module-level function — calling it threw ReferenceError and aborted EVERY turn. Go straight
  // to the shared source of truth instead; runTurn's effStat() is only a thin wrapper over this.
  if (Number(effSkillOf(c, 'necromancy', state?.characters ?? [])) < 1) return false;
  if (!state) throw new TypeError("Cannot read properties of the state (reading 'players')");
  const pl = (state.players ?? [])[c.player];
  if (!pl) return false;
  if (c._gravesSensedTurn !== state.turn) {
    c._gravesSensedTurn = state.turn;
    c._gravesSensedIds = [];
  }
  if (!Array.isArray(c._gravesSensedIds)) c._gravesSensedIds = [];
  if (c._gravesSensedIds.includes(pv.id)) return false; // already read this ground this turn
  c._gravesSensedIds.push(pv.id);
  const n = (pv.battleGraves ?? []).length;
  if (n === 0) {
    noteGraveIntel(pl, pv.id, state.turn, []);
    return false;
  } // bare ground is knowledge too
  noteGraveIntel(pl, pv.id, state.turn, null); // existence only — Control Undead buys the roll of the dead
  if (typeof tellGravesSensed === 'function') tellGravesSensed(pv);
  return true;
}
// The realm's graveyard lore, shaped for the player report ("Graveyards known").
export function graveIntelFor(
  gs:
    | { readonly world?: { readonly provinces?: readonly unknown[] | null | undefined } | null | undefined }
    | null
    | undefined,
  pl: { readonly _graveIntel?: Readonly<Partial<Record<string, AGraveRecord>>> | null | undefined } | null | undefined,
) {
  if (!gs || !pl?._graveIntel) return [];
  // the lore, read again inside the map below
  const lore = pl._graveIntel;
  return Object.keys(lore)
    .map((k) => {
      const pv = theProvinceALoreKeyNames(gs.world?.provinces, k);
      const rec: Partial<AGraveRecord> = lore[k] ?? {};
      return {
        provinceId: isNaN(+k) ? k : +k,
        name: theNameOfTheProvinceALoreKeyNames(pv),
        turn: (rec.turn ?? 0) || null,
        detail: rec.detail ?? null,
        detailTurn: (rec.detailTurn ?? 0) || null,
        detailPartial: !!rec.detailPartial,
      };
    })
    .sort((a, b) => (b.turn ?? 0) - (a.turn ?? 0) || String(a.name).localeCompare(String(b.name)));
}
// A key of a realm's lore is a province's id written as words (noteGraveIntel's), so it reads the province at that
// index; any other key reads what JavaScript reads there, as the lore's report always did.
/** `provinces[k]`, as JavaScript reads it: the map's province at the index the key names, or none. */
function theProvinceALoreKeyNames(provinces: readonly unknown[] | null | undefined, k: string): unknown {
  if (!provinces) return provinces;
  const pv: unknown = Reflect.get(provinces, k);
  return pv;
}
/** `(pv && pv.name) || 'an unmapped province'`, as JavaScript reads it: the province's name, or the words for none. */
function theNameOfTheProvinceALoreKeyNames(pv: unknown): unknown {
  const name: unknown = pv ? Reflect.get(Object(pv), 'name') : pv;
  if (!name) return 'an unmapped province';
  return name;
}

// ── LIFTED OUT OF resolveTurn (plan P1-08c) ── a fallen hero's grave (for Resurrect), the dead units a battle leaves
// in a province (for Skeletal Armies) or that slip away home (an Elven kingdom's units; resolveTurn's _elvenEscapeQueue,
// which joins the turn's context by reference), and the dead heroes a realm has seen. recordHeroGrave,
// recordBattleGraves and recordDeadHeroSighting take the turn's context first (src/engine/turn/context.ts).
// Record a dead hero into the persistent graveyard for Resurrect spell
export function recordHeroGrave(
  turnContext: { readonly G: { heroGraveyard?: Grave[] | null | undefined; readonly turn: number } },
  hero: AHeroAsHisGraveRecordsHim,
) {
  const { G } = turnContext;
  G.heroGraveyard ??= [];
  // Don't double-record
  if (G.heroGraveyard.find((h) => h.id === hero.id)) return;
  G.heroGraveyard.push({
    id: hero.id,
    name: hero.name.replace(' (wandering)', ''),
    player: hero.player,
    race: hero.race,
    alignment: hero.alignment,
    temper: hero.temper,
    skills: { ...hero.skills },
    maxHp: hero.maxHp || 20,
    isKing: !!hero.isKing, // was never stored, so every `g.isKing` reader (the report's
    // visibleDeadHeroes among them) silently read undefined and no fallen
    // king was ever marked as one. The Hierophant's new reading needs it.
    killedOnTurn: G.turn,
    location: hero.location,
    // every realm this hero ever served (see noteServedRealm) — Resurrect refuses a body that
    // served another realm.
    served: (() => {
      if (hero.player != null) noteServedRealm(hero, hero.player);
      return Array.isArray(hero._servedRealms) ? hero._servedRealms.slice() : [];
    })(),
    _releasedBy: hero._releasedBy ?? null,
  });
}

export function elvenEscapeChance(terrain: string | null | undefined) {
  return terrain === 'desert' || terrain === 'mountain' ? 30 : terrain === 'forest' || terrain === 'jungle' ? 60 : 45;
}
export function recordBattleGraves(
  turnContext: {
    readonly G: { readonly players: readonly (ARealmAsAFallenUnitsFlightHomeReadsIt | null | undefined)[] };
    readonly _elvenEscapeQueue: ElvenEscape[];
  },
  prov: AProvinceAsItsGravesAreLeft,
  killedArmies: readonly AUnitAsItsGraveIsRecorded[] | null | undefined,
  ownerPlayer?: number | null,
) {
  const { G, _elvenEscapeQueue } = turnContext;
  if (!killedArmies?.length) return;
  prov.battleGraves ??= [];
  // the graves, the same list each push below fills
  const graves = prov.battleGraves;
  const ownerIsElven = ownerPlayer != null && G.players[ownerPlayer]?.race === 'Elven';
  killedArmies.forEach((a) => {
    // Don't record skeletal armies — they don't leave useful remains
    if (a._isSkeletal) return;
    if (a._phantom) return; // spectral doubles leave no graves and never flee home
    // (no unit at all threw above, so each test below reads one)
    if (ownerIsElven && a.race === 'Elven' && !a._temporary && a._wildHuntUntilTurn == null && !a._elvenEscaped) {
      if (
        kcRng() * 100 <
        elvenEscapeChance(prov.terrain) + whatARealmsDiscoveriesAddToAFallenUnitsFlightHome(G.players[ownerPlayer])
      ) {
        // Homeward Song
        a._elvenEscaped = true;
        _elvenEscapeQueue.push({
          player: ownerPlayer,
          unit: {
            type: a.type,
            quality: a.quality,
            race: 'Elven',
            unitName: a.unitName || armyUnitName(a.type),
            strength: a.strength,
          },
        });
        return; // fled toward home — no grave left here
      }
    }
    graves.push({ type: a.type, quality: a.quality, race: a.race || 'Human', unitName: a.unitName });
  });
}

// When a player's character visits/spies a province, record any dead heroes there as seen
export function recordDeadHeroSighting(
  turnContext: {
    readonly G: {
      readonly heroGraveyard?: readonly Pick<Grave, 'id' | 'location'>[] | null | undefined;
      readonly players: readonly (ARealmAsItsDeadAreSighted | null | undefined)[];
    };
  },
  playerIdx: number,
  provId: number,
) {
  const { G } = turnContext;
  if (!G.heroGraveyard) return;
  G.heroGraveyard
    .filter((g) => g.location === provId)
    .forEach((g) => {
      const p = G.players[playerIdx];
      if (!p) return;
      if (!Array.isArray(p.seenDeadHeroIds)) p.seenDeadHeroIds = [];
      if (!p.seenDeadHeroIds.includes(g.id)) p.seenDeadHeroIds.push(g.id);
      if (!Array.isArray(p.knownDeadHeroIds)) p.knownDeadHeroIds = [];
      if (!p.knownDeadHeroIds.includes(g.id)) p.knownDeadHeroIds.push(g.id);
    });
}
