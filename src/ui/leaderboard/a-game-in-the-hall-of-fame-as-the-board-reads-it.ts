// A game's entry in the Hall of Fame (`game_records`: one row a finished game, written by the GM page) as the board
// reads it (plan P1-16j1). Four of its columns hold JSON (setup, standings, records, totals), which the board read as
// `any` in its sums, sorts and words. Here they are read once, when the page loads them, into the views below: each
// field of a view holds the value `x.field` gave on the JSON as parsed (a value of any kind, so `unknown`), and each
// list the elements `(x || []).forEach(…)` met, so a `+`, a comparison or a sort on them gives what it gave before
// (through the readers in ../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts). The forms:
// docs/architecture/the-forms-that-keep-a-value-numbers-words-and-lists.md.
import type { AHallOfFameEntry } from '../../db/the-db-interface-and-its-areas.ts';
import { isAList, thisOrElse } from '../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';

/** `x.field` as JavaScript reads it on a value that isn't none (`Object` boxes words, numbers and flags). */
function theFieldOfSomething(held: unknown, field: string): unknown {
  return Reflect.get(Object(held), field);
}

/** A JSON column as the database client hands it, or as an older row held it in words: words parsed (none for words
 *  that aren't JSON), none as none, any other value as it is. */
export function theColumnParsed(column: unknown): unknown {
  if (column === null || column === undefined) return null;
  if (typeof column === 'string') {
    try {
      const parsed: unknown = JSON.parse(column);
      return parsed;
    } catch {
      return null;
    }
  }
  return column;
}

/** How a game was set up (its `setup` column), as the board's filters and lines read it. */
export interface TheSetUpAsTheBoardReadsIt {
  readonly bots: unknown;
  readonly realms: unknown;
  readonly humans: unknown;
  readonly cols: unknown;
  readonly rows: unknown;
  readonly mapSize: unknown;
  readonly diplomacy: unknown;
  readonly seaPct: unknown;
}
/** A game's whole tallies (its `totals` column), as its line under the standings reads them. */
export interface TheTotalsAsTheBoardReadsThem {
  readonly battles: unknown;
  readonly casualties: unknown;
  readonly captures: unknown;
  readonly lairs: unknown;
  readonly spells: unknown;
  readonly deaths: unknown;
}
/** One realm's line in a game's final standings, as the board reads it (`pi` its index, `al` its creed). */
export interface AStandingAsTheBoardReadsIt {
  readonly pi: unknown;
  readonly realm: unknown;
  readonly player: unknown;
  readonly uid: unknown;
  readonly bot: unknown;
  readonly race: unknown;
  readonly al: unknown;
  readonly winner: unknown;
  readonly rank: unknown;
  readonly score: unknown;
  readonly prov: unknown;
  readonly str: unknown;
  readonly gold: unknown;
  readonly titles: unknown;
  readonly outHow: unknown;
  readonly outTurn: unknown;
}
/** What a list of standings may hold that `!st` reads as nothing: kept as it was, so a field read on it gives (or
 *  throws) what it did. JSON holds no `NaN` and no `document.all`. */
export type NothingAListHolds = null | undefined | false | 0 | '';
/** One entry of a record (a realm's best, or the game's own): `v` its value, `d` 'min' where the least is best, `t`
 *  its turn, `det` and `who` its details, `lbl` its label; an entry written by the first build (lb1) names its realm. */
export interface AnEntryAsTheBoardReadsIt {
  readonly v: unknown;
  readonly pi: unknown;
  readonly d: unknown;
  readonly lbl: unknown;
  readonly who: unknown;
  readonly t: unknown;
  readonly det: unknown;
  readonly realm: unknown;
  readonly player: unknown;
  readonly race: unknown;
  readonly al: unknown;
  readonly bot: unknown;
}
/** A record's key and the entries the board shows of it: those `!e || e.v == null` didn't pass over. */
export interface ARecordAsTheBoardReadsIt {
  readonly key: string;
  readonly entries: readonly AnEntryAsTheBoardReadsIt[];
}
/** A column that held a value of another kind than the board reads (standings that are no list), kept as it was so
 *  that the read that meets it throws as it did: `theStandingsOf`. */
export interface AValueOfAnotherKind {
  readonly heldAsItWas: unknown;
}
/** A game's entry as the board holds it: its row's columns as the database gives them, the four JSON columns read. */
export interface AGameAsTheBoardHoldsIt extends Omit<AHallOfFameEntry, 'setup' | 'standings' | 'records' | 'totals'> {
  readonly setup: TheSetUpAsTheBoardReadsIt;
  readonly standings: readonly (AStandingAsTheBoardReadsIt | NothingAListHolds)[] | AValueOfAnotherKind;
  readonly records: readonly ARecordAsTheBoardReadsIt[];
  readonly totals: TheTotalsAsTheBoardReadsThem;
}

/** A game's setup, `jp(setup) || {}` read field by field. */
export function theSetUpAsTheBoardReadsIt(column: unknown): TheSetUpAsTheBoardReadsIt {
  const setup = thisOrElse(theColumnParsed(column), {});
  return {
    bots: theFieldOfSomething(setup, 'bots'),
    realms: theFieldOfSomething(setup, 'realms'),
    humans: theFieldOfSomething(setup, 'humans'),
    cols: theFieldOfSomething(setup, 'cols'),
    rows: theFieldOfSomething(setup, 'rows'),
    mapSize: theFieldOfSomething(setup, 'mapSize'),
    diplomacy: theFieldOfSomething(setup, 'diplomacy'),
    seaPct: theFieldOfSomething(setup, 'seaPct'),
  };
}
/** A game's totals, `jp(totals) || {}` read field by field. */
export function theTotalsAsTheBoardReadsThem(column: unknown): TheTotalsAsTheBoardReadsThem {
  const totals = thisOrElse(theColumnParsed(column), {});
  return {
    battles: theFieldOfSomething(totals, 'battles'),
    casualties: theFieldOfSomething(totals, 'casualties'),
    captures: theFieldOfSomething(totals, 'captures'),
    lairs: theFieldOfSomething(totals, 'lairs'),
    spells: theFieldOfSomething(totals, 'spells'),
    deaths: theFieldOfSomething(totals, 'deaths'),
  };
}
/** Whether an element of a list is one `!x` reads as nothing (JSON's falsy values). */
function isNothing(held: unknown): held is NothingAListHolds {
  return held === null || held === undefined || held === false || held === 0 || held === '';
}
/** A standing read field by field where the board reads it without testing it first: for none (`null`), the
 *  TypeError the first field read threw; for any other nothing (`0`, `false`, `''`), each field `undefined`. */
export function theStandingAsItsFieldsRead(
  standing: AStandingAsTheBoardReadsIt | NothingAListHolds,
): AStandingAsTheBoardReadsIt {
  if (standing === null || standing === undefined) {
    throw new TypeError(`Cannot read properties of ${String(standing)} (reading a standing's field)`);
  }
  if (isNothing(standing)) return aStandingRead(standing);
  return standing;
}
/** One element of a list of standings: a nothing kept as it was, anything else read field by field. */
function aStandingRead(held: unknown): AStandingAsTheBoardReadsIt {
  return {
    pi: theFieldOfSomething(held, 'pi'),
    realm: theFieldOfSomething(held, 'realm'),
    player: theFieldOfSomething(held, 'player'),
    uid: theFieldOfSomething(held, 'uid'),
    bot: theFieldOfSomething(held, 'bot'),
    race: theFieldOfSomething(held, 'race'),
    al: theFieldOfSomething(held, 'al'),
    winner: theFieldOfSomething(held, 'winner'),
    rank: theFieldOfSomething(held, 'rank'),
    score: theFieldOfSomething(held, 'score'),
    prov: theFieldOfSomething(held, 'prov'),
    str: theFieldOfSomething(held, 'str'),
    gold: theFieldOfSomething(held, 'gold'),
    titles: theFieldOfSomething(held, 'titles'),
    outHow: theFieldOfSomething(held, 'outHow'),
    outTurn: theFieldOfSomething(held, 'outTurn'),
  };
}
/** A game's standings, `jp(standings) || []`: a list's elements read (each nothing kept), any other value kept. */
export function theStandingsAsTheBoardHoldsThem(column: unknown): AGameAsTheBoardHoldsIt['standings'] {
  const standings = thisOrElse(theColumnParsed(column), []);
  if (!isAList(standings)) return { heldAsItWas: standings };
  return standings.map((held) => (isNothing(held) ? held : aStandingRead(held)));
}
/** The standings `(g.standings || []).forEach(…)` walked: for standings that are no list, the TypeError it threw. */
export function theStandingsOf(
  game: Pick<AGameAsTheBoardHoldsIt, 'standings'>,
): readonly (AStandingAsTheBoardReadsIt | NothingAListHolds)[] {
  if (isAList(game.standings)) return game.standings;
  throw new TypeError("a game's standings are not a list");
}
/** A game's records, `Object.entries(jp(records) || {})`: each record's entries (one entry, or a list of them, as the
 *  rows before lb3 and after wrote them), those that are something with a value read field by field. */
export function theRecordsAsTheBoardReadsThem(column: unknown): readonly ARecordAsTheBoardReadsIt[] {
  const held = thisOrElse(theColumnParsed(column), {});
  if (held === null || held === undefined) return [];
  const records: readonly [string, unknown][] = Object.entries(held);
  return records.map(([key, record]) => {
    const each = isAList(record) ? record : [record];
    const entries: AnEntryAsTheBoardReadsIt[] = [];
    for (const entry of each) {
      if (isNothing(entry)) continue;
      const v = theFieldOfSomething(entry, 'v');
      if (v === null || v === undefined) continue;
      entries.push({
        v,
        pi: theFieldOfSomething(entry, 'pi'),
        d: theFieldOfSomething(entry, 'd'),
        lbl: theFieldOfSomething(entry, 'lbl'),
        who: theFieldOfSomething(entry, 'who'),
        t: theFieldOfSomething(entry, 't'),
        det: theFieldOfSomething(entry, 'det'),
        realm: theFieldOfSomething(entry, 'realm'),
        player: theFieldOfSomething(entry, 'player'),
        race: theFieldOfSomething(entry, 'race'),
        al: theFieldOfSomething(entry, 'al'),
        bot: theFieldOfSomething(entry, 'bot'),
      });
    }
    return { key, entries };
  });
}
/** A game's entry as the database gives it, held as the board reads it: its columns kept, the four JSON ones read. */
export function theGameAsTheBoardHoldsIt(row: AHallOfFameEntry): AGameAsTheBoardHoldsIt {
  return {
    ...row,
    setup: theSetUpAsTheBoardReadsIt(row.setup),
    standings: theStandingsAsTheBoardHoldsThem(row.standings),
    records: theRecordsAsTheBoardReadsThem(row.records),
    totals: theTotalsAsTheBoardReadsThem(row.totals),
  };
}
