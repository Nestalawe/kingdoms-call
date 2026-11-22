// S10 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): wild country near the two crowns. A
// Druidic king with no land Creature province within two provinces of home, and an Evil king with no land Monster
// province, gets one cell turned wild for him, in place on the provinces' list.
import { KC_UNIT_CLASS } from '../../../content/kingdoms-call-data.ts';
import { THE_WILD_COUNTRY_NEAR_THE_TWO_CROWNS } from '../../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRng } from '../../rng.ts';
import {
  doesACapitalOfTheAlignmentOpenBesideCreatures,
  doesACapitalOfTheAlignmentOpenBesideMonsters,
} from '../../rules-on-plain-values/the-world-each-creed-is-made-in-its-wild-country-its-first-skills-and-one-realm-a-game.ts';
import { shuffleP } from '../../battle/fortune.ts';
import { neutralDefCount } from '../../units/drill-and-spoils.ts';
import { armyUnitName } from '../../dice-and-army-names.ts';
import { getNeighborsP } from '../map-helpers.ts';
import {
  type AProvinceAsTheWorldIsMadeIt,
  type ARealmAsTheSetUpHandsIt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the wild country near the two crowns reads: the set-up's (S0's) map size, provinces' list and content tables,
 *  and the homes' (S9's) homes in the realms' order, realms and wild pools. */
export interface WhatTheWildCountryNearTheTwoCrownsReads {
  readonly cols: number;
  readonly rows: number;
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
  readonly primalDefs: Readonly<Partial<Record<string, { readonly race?: string | undefined }>>>;
  readonly playerStarts: readonly AProvinceAsTheWorldIsMadeIt[];
  readonly players: readonly {
    readonly homeProvinceId: number;
    readonly race: ARealmAsTheSetUpHandsIt['race'];
    readonly alignment: ARealmAsTheSetUpHandsIt['alignment'];
  }[];
  readonly creaturesByTerrain: Readonly<Partial<Record<string, readonly string[]>>>;
  readonly monstersByTerrain: Readonly<Partial<Record<string, readonly string[]>>>;
}

/** S10, wild country near the two crowns: at most one cell a crown turned wild, in place. It returns nothing: the
 *  later stages read it from the provinces' list. */
export function theTwoCrownsGivenWildCountryWithinTwoProvincesOfHome({
  cols,
  rows,
  provinces,
  primalDefs,
  playerStarts,
  players,
  creaturesByTerrain,
  monstersByTerrain,
}: WhatTheWildCountryNearTheTwoCrownsReads) {
  // ── WILD COUNTRY NEAR THE TWO CROWNS (2026-10-13, Toby item 12) ── A Druidic king must have at
  // least one land CREATURE province within two provinces of home, and an Evil king a land MONSTER
  // province, so each crown can reach its speciality early. The alignment pass above only tries to
  // put one beside the home, and it can find no free neighbour; later homes' cap passes can also
  // re-race a primal province that sits two steps from an earlier home. This pass runs after every
  // home is tailored and is the authority. Where nothing within two steps qualifies it converts one
  // cell, choosing in order: a cell exactly two steps away that borders no home (so no ring breaks
  // its one-primal cap), then a free cell in this home's own ring if that ring holds no primal yet.
  // It never touches a home, any king's poor/prosperous pair, or a primal cell that is another
  // crown's only qualifying province. Wrong-family primal cells are preferred over humanoid ones (the
  // wild country only changes sides), then cells not of the king's own race.
  {
    const _nb = (p: AProvinceAsTheWorldIsMadeIt) => getNeighborsP(p, cols, rows, provinces).filter(Boolean);
    const _within2 = (h: AProvinceAsTheWorldIsMadeIt) => {
      const one = _nb(h),
        seen = new Map(one.map((n): [number, number] => [n.id, 1]));
      one.forEach((n) => {
        _nb(n).forEach((m) => {
          if (m.id !== h.id && !seen.has(m.id)) seen.set(m.id, 2);
        });
      });
      return seen;
    };
    // the units of each family, looked up by a type that may be missing
    const creatureUnits: readonly (string | undefined)[] = KC_UNIT_CLASS.creature;
    const monsterUnits: readonly (string | undefined)[] = KC_UNIT_CLASS.monster;
    const _famOf = (p: AProvinceAsTheWorldIsMadeIt) => {
      if (p.terrain === 'sea' || !(p.race ?? '').startsWith('Primal')) return null;
      const t = p.armyTypes[0];
      return creatureUnits.includes(t) ? 'creature' : monsterUnits.includes(t) ? 'monster' : null;
    };
    const _homeIds = new Set(players.map((pl) => pl.homeProvinceId));
    const _pairIds = new Set(playerStarts.flatMap((h) => h._homePairIds ?? []));
    const _ringIds = new Set<number>();
    playerStarts.forEach((h) => {
      _nb(h).forEach((n) => _ringIds.add(n.id));
    });
    /** A crown that wants wild country near home: its realm, the family it wants, its home. */
    interface ACrownWantingWildCountry {
      readonly pl: (typeof players)[number];
      readonly want: 'creature' | 'monster';
      readonly home: AProvinceAsTheWorldIsMadeIt;
    }
    const _crowns = players
      .map((pl) => ({
        pl,
        want: doesACapitalOfTheAlignmentOpenBesideCreatures(pl.alignment)
          ? 'creature'
          : doesACapitalOfTheAlignmentOpenBesideMonsters(pl.alignment)
            ? 'monster'
            : null,
        home: provinces[pl.homeProvinceId],
      }))
      .filter((x): x is ACrownWantingWildCountry => Boolean(x.want && x.home));
    const _matches = (cr: ACrownWantingWildCountry) =>
      [..._within2(cr.home).keys()].filter((id) => {
        const q = provinces[id];
        return q && q.owner == null && _famOf(q) === cr.want;
      });
    _crowns.forEach((cr) => {
      if (_matches(cr).length) return;
      const near = _within2(cr.home);
      const soleFor = (id: number) =>
        _crowns.some((o) => o !== cr && _matches(o).length === 1 && _matches(o)[0] === id);
      const ok = (q: AProvinceAsTheWorldIsMadeIt | undefined): q is AProvinceAsTheWorldIsMadeIt =>
        Boolean(
          q && q.terrain !== 'sea' && q.owner == null && !_homeIds.has(q.id) && !_pairIds.has(q.id) && !soleFor(q.id),
        );
      const ringHasPrimal = _nb(cr.home).some((n) => n.terrain !== 'sea' && (n.race ?? '').startsWith('Primal'));
      const rank = (list: AProvinceAsTheWorldIsMadeIt[]) =>
        list.sort(
          (x, y) =>
            (_famOf(y) ? 1 : 0) - (_famOf(x) ? 1 : 0) ||
            (x.race === cr.pl.race ? 1 : 0) - (y.race === cr.pl.race ? 1 : 0),
        );
      const far = rank(
        shuffleP(
          [...near.entries()]
            .filter(([, d]) => d === 2)
            .map(([id]) => provinces[id])
            .filter((q): q is AProvinceAsTheWorldIsMadeIt => ok(q) && !_ringIds.has(q.id)),
        ),
      );
      const ring = ringHasPrimal ? [] : rank(shuffleP(_nb(cr.home).filter(ok)));
      const cand = far[0] ?? ring[0] ?? null;
      if (!cand) return;
      const bank = (cr.want === 'creature' ? creaturesByTerrain : monstersByTerrain)[cand.terrain] ?? [
        cr.want === 'creature' ? 'Stone Giants' : 'Cave Trolls',
      ];
      const unit = theOneMadeSure(bank[Math.floor(kcRng() * bank.length)]);
      const candsRace = 'Primal:' + ((primalDefs[unit]?.race ?? '') || unit);
      cand.race = candsRace;
      cand.armyTypes = [unit];
      cand.neutralDefenders = Array.from({ length: neutralDefCount(cand.tax) }, () => ({
        type: unit,
        quality:
          kcRng() < THE_WILD_COUNTRY_NEAR_THE_TWO_CROWNS.theChanceItsDefendersAreVeterans ? 'Veteran' : 'Average',
        race: candsRace,
        unitName: theOneMadeSure(armyUnitName(unit)),
      }));
      cand.npcArmies = cand.neutralDefenders.length;
      cand.name = null; // renamed by the thematic naming pass below
    });
  }
}
