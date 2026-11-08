// The order form's forecasts agree with the turn (plan P1-11d1 to d4; since P1-11e43 imported from their files, with
// no vm and no syntax tree): where the form says a hero will stand after his marches, what it says he will carry and
// lead and a garrison will hold, the order list it offers him, its treasury ledger and its Practice Skill note, each on
// a staged world in the engine's shape handed through the report's own projection, against what the turn does with the
// same orders; each known difference pinned (questions 42 and 43, forecast limits). The forecasts' and the ledger's
// files (src/ui/player/the-order-forms-forecast-…, the-order-forms-ledger-…, P1-11e41, e42) read the report and the
// orders handed them, so the checks of tests/lib/the-worlds-and-the-checks-of-the-portals-forecasts-and-copies-against-the-turn.ts
// ask them on the orders staged, made into the snapshot the page's form holds (theOrdersAsTheFormHoldsThem).
// Level 1 (unit): functions on plain values against the turn's own functions; a page would ask the same functions
// through the DOM, and a static test can't compare two functions' answers.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// On a staged world with no guards (`marchingWorld`), where the forecast says a hero will stand is where
// `processOrder` leaves him: a compass step, a province next door, a Forced March next door or by direction, a Move by a
// province's bare number (R-128) and his own province; a march the turn refuses (ships over land, too little lift for
// the sea, a neutral realm's border, the war declared this turn: then a Search Lair after it names where he stands); a
// march past his pace (the report's pools, each step spending the pool the turn's rule names); one step toward a far
// province (the turn's route on the report's map); a hero who joins this turn, or whose pace the report doesn't show,
// marches at no pace (a forecast limit); and the answer follows the orders, the war declared and the report as they
// change. On a staged world with no guards (`holdingWorld`, each case on its own province), what the forecasts say a
// hero will carry and lead, and a garrison hold, as the season after his orders begins, is what the turn's phases leave
// them: items handed over, sent by courier and passed on, companies recruited, handed over, left, taken up and
// disbanded, the beast command, a garrison band, risen dead, a season's heroes in the turn's order; the Move note's
// column and the Pick Up field's garrison as the turn gives them; pinned where it is not (question 42: the Stone, a
// chain of company hand-overs in one season). Each of the 46 names of the order list is the order `normaliseAction`
// reads it as, and on staged heroes of realm 0 under each creed the list offered is what `processOrder` lets him give.
// The treasury ledger says what the turn spends and adds to Early Winter's wages (R-134), pinned where it can't know
// (question 43: the Host-Leader on a report that doesn't name him); the Practice Skill note quotes the chance the turn
// rolls (R-134).
import { describe, expect, test } from 'vitest';
import {
  aSearchLairAfterEachMarchTheTurnRefuses,
  sameAnswer,
  theForecastsImported,
  theLedgerAgainstTheTurn,
  theMarchForecastAgainstTheTurn,
  theMarchForecastAsWhatItReadsChanges,
  theMarchPastHisPaceOfAHeroTheReportShowsNoPaceOf,
  theMoveNoteOfAComradeHandedCompaniesAgainstTheTurn,
  theOrderEachNameOfTheListGives,
  theOrderListAgainstTheTurn,
  thePickUpFieldAsAComradeLeavesAgainstTheTurn,
  thePracticeNoteAgainstTheTurn,
  whatAHeroHoldsAgainstTheTurn,
  THE_HOLDINGS_THE_FORECAST_GETS_RIGHT,
  THE_HOLDINGS_THE_FORECAST_GETS_WRONG,
  THE_LEDGERS_THE_TURN_AGREES_WITH,
  THE_LEDGERS_THE_TURN_DISAGREES_WITH,
  THE_MARCHES_A_SEARCH_LAIR_FOLLOWS,
  THE_MARCHES_ONE_STEP_TOWARD_A_FAR_PROVINCE,
  THE_MARCHES_STOPPED_BY_HIS_PACE,
  THE_MARCHES_THE_FORECAST_GETS_RIGHT,
  THE_MARCHES_THE_TURN_REFUSES,
  THE_PRACTICE_NOTES_THE_TURN_AGREES_WITH,
  THE_TURNS_REFUSALS_THE_ORDER_LIST_RESTATES,
  type Comparison,
} from '../lib/the-worlds-and-the-checks-of-the-portals-forecasts-and-copies-against-the-turn.ts';

const forecasts = theForecastsImported();
/** `make`'s answer, made once. */
function lazily<T>(make: () => T): () => T {
  let kept: { value: T } | null = null;
  return () => (kept ??= { value: make() }).value;
}
const marches = lazily(() => theMarchForecastAgainstTheTurn(forecasts));
const holdings = lazily(() => whatAHeroHoldsAgainstTheTurn(forecasts));
const orderList = lazily(() => theOrderListAgainstTheTurn(forecasts));
const ledgers = lazily(() => theLedgerAgainstTheTurn(forecasts));
const practiceNotes = lazily(() => thePracticeNoteAgainstTheTurn(forecasts));

/** A value in a line short enough to read (cut to 160 characters). */
const short = (x: unknown) =>
  JSON.stringify(x, (_k, v: unknown) => (v === undefined ? '(undefined)' : v)).slice(0, 160);
/** The comparisons that differ, each in a line. */
function differences(list: Comparison[]): string[] {
  return list
    .filter((c) => !sameAnswer(c.copy, c.engine))
    .map((c) => `on ${short(c.on)}: the copy ${short(c.copy)}, the engine ${short(c.engine)}`);
}

describe('the march: where the order form says a hero will stand (P1-11d1)', () => {
  test("where the order form says a hero will stand after a march is where the turn leaves him: a compass step, a province next door, a Forced March next door or by direction, a Move by a province's bare number, his own province, a march the turn refuses, a march past his pace, one step toward a far province (R-128)", () => {
    // On a staged world (no guards, no foes on the way): a Move by direction, by a province next door (prov:<id>, as the
    // form writes it), a Forced March to a province next door (its bare number, as the form writes it), a Move into
    // the province he stands in (the form's "Stay in", the turn's "already there"), and since R-128 a Forced March by
    // direction (dir:, a bot's) and a Move by a province's bare number (a bot's joint assault's): the form reads both
    // targets by the turn's own rule, whatAMarchsOrderNames; a Move naming no province on the map leaves him there.
    // Since P1-11e10 a march the turn refuses leaves him where he is, by the turn's own rules on the column the Move
    // note counts: ships ordered over land, too little lift ordered to sea, companies at a neutral realm's border (a
    // war declared this turn stands from the first phase only for an Evil realm); a lone hero, a realm at war and
    // ships that carry the column pass. Since P1-11e11 a march past his pace stops where his pools run out: the pools
    // the report gives (Men-at-Arms march 2 a turn, a Galleon Fleet sails 3), each step spending the pool the turn's
    // rule names (a voyage the sea pool: Men-at-Arms with Orcish Longships sail three seas past their land pace of 2),
    // and a march the turn refuses spends none of it. Since P1-11e12 a far province (prov:<id> or a Forced March's bare
    // number) is one step toward it, as the turn marches: the first step of a shortest route the column may take on
    // the report's map (the turn's own search), of a route as short over safe ground (his own, an ally's) that one's,
    // so a column goes round a neutral realm's province; the step his pace or the turn may refuse as any other, and
    // where no route reaches it (a fleet ordered inland) he stays.
    const list = marches();
    expect(list.map((x) => x.kind)).toEqual([...THE_MARCHES_THE_FORECAST_GETS_RIGHT]);
    expect(differences(list)).toEqual([]);
    const refused = (x: (typeof list)[number]) => (THE_MARCHES_THE_TURN_REFUSES as readonly string[]).includes(x.kind);
    expect(list.filter((x) => x.copy !== (x.stopsAt ?? (refused(x) ? x.from : x.named)))).toEqual([]);
    expect(list.filter((x) => refused(x) && x.from === x.named)).toEqual([]);
    // (each march his pace stops is stopped part way: neither where he set out nor where his orders name)
    const stopped = list.filter((x) => (THE_MARCHES_STOPPED_BY_HIS_PACE as readonly string[]).includes(x.kind));
    expect(stopped.map((x) => x.kind)).toEqual([...THE_MARCHES_STOPPED_BY_HIS_PACE]);
    expect(stopped.filter((x) => x.stopsAt === undefined || [x.from, x.named].includes(x.stopsAt))).toEqual([]);
    // (each step toward a far province is to a province next door both to where he set out and to the one named)
    const steps = list.filter((x) =>
      (THE_MARCHES_ONE_STEP_TOWARD_A_FAR_PROVINCE as readonly string[]).includes(x.kind),
    );
    expect(steps.map((x) => x.kind)).toEqual([...THE_MARCHES_ONE_STEP_TOWARD_A_FAR_PROVINCE]);
    expect(steps.filter((x) => !x.nextDoorToBoth.includes(x.copy))).toEqual([]);
  });

  test('each march the turn refuses leaves him where he set out, or where his pace stops him, and a Search Lair the form sends after it names the province he stands in, where the turn lets him search (R-128)', () => {
    // doSubmitOrders sends predictedLocation's province with every Search Lair (its `prov`); the turn sends a searcher
    // standing anywhere else to rest ("never reaches the lair"). So once the forecast follows the turn, the order
    // names where he stands, and the turn lets him go in: where he set out, or where his pace stopped him (P1-11e11).
    const list = aSearchLairAfterEachMarchTheTurnRefuses(forecasts);
    expect(list.map((x) => x.kind)).toEqual([...THE_MARCHES_A_SEARCH_LAIR_FOLLOWS]);
    const stands = new Map(marches().map((m) => [m.kind, m.stopsAt ?? m.from]));
    expect(list.map((x) => [x.kind, x.sent, x.heStands, x.heNeverReachesTheLair])).toEqual(
      list.map((x) => [x.kind, stands.get(x.kind), stands.get(x.kind), false]),
    );
  });

  test('a hero who joins this turn, or whose pace the report does not show, marches at no pace on the form (a forecast limit, P1-11e11)', () => {
    // The form's stand-in for a hero hired, charmed or raised this turn carries a pace of the page's own (5 on land,
    // none at sea), not the turn's pools; and a report that shows no pace gives none. Neither stops a march: the
    // column past his pace, so staged, is forecast where his orders name, as before P1-11e11.
    const { joined, noPace, named, stopsAt } = theMarchPastHisPaceOfAHeroTheReportShowsNoPaceOf(forecasts);
    expect([joined, noPace]).toEqual([named, named]);
    expect(named).not.toBe(stopsAt);
  });

  test('the march forecast follows the orders, the war declared and the report as they change between one ask and the next', () => {
    // The forecast keeps each answer while what it was worked out from stands (the report, the order fields of the
    // phases before, the declarations): one hero, ordered next door, then to a neutral realm's border (turned back);
    // his Evil realm declares war on it (he crosses), then doesn't (turned back); the first report again (turned
    // back); a report where the two are at war (he crosses).
    const { answers, start, first, border } = theMarchForecastAsWhatItReadsChanges(forecasts);
    expect(answers).toEqual([first, start, border, start, start, border]);
  });
});

describe('what a hero holds: what the order form says he will carry and lead, and a garrison hold (P1-11d2)', () => {
  test('what the order form says a hero will carry and lead, and a garrison hold, after his orders is what the turn leaves them: items handed over, sent by courier and passed on, companies recruited, handed over, left, taken up and disbanded, the beast command, a garrison band, risen dead, a season’s heroes in the turn’s order', () => {
    // On a staged world (no guards, no foes; each case on its own province, its heroes realm 0's): the form's
    // predictedItems, projectedLedArmies and projectedGarrison as the phase after the orders begins, against the turn's
    // phases played one at a time. Items handed to a comrade beside him (two, by their places: the higher first), one
    // sent by courier to a comrade elsewhere (gone from the pack, not yet in his), one handed over and passed on next
    // season; a mercenary band and a company of the province recruited (the band first, whatever the ticks' order), a
    // garrison company recruited (into the garrison, whoever is named), companies recruited into the garrison and under a
    // comrade's banner; a company handed to a comrade beside him, one left in the garrison and taken up by a comrade
    // next season by its place (behind the one there before), one taken up as a comrade leaves it in the same season (the turn makes the Pick Up wait), one
    // disbanded; since P1-11e18 (R-129) a Mithril suit sent with "all" (forged to its wearer: the turn and the form keep
    // it on him, the shared theItemsASendItemOrderHandsOver); since P1-11e17 (the forecasts' replay) an item handed over by its name, every company left in the
    // garrison, one left by its type (the garrison read) and every company handed to a comrade; and since P1-11e19
    // (R-129, the turn's rules through src/shared/) a beast past a leader's beast command (his Druid, here 0) mustering
    // into the garrison, staying with the giver or going back to the garrison, a band of garrison troops hired into the
    // garrison, companies taken up last first (by their places and "all"), and risen dead handed to a comrade of a realm
    // that is not Undead going to their graves (the report's `skeletal` mark); with, for the rules' inputs, two beasts
    // recruited by a Druid 1 hero (the first fits his command), bands hired with the garrison named in a province of
    // another realm (the beasts not hired, the men into his column), a beast recruited by a Druid 1 hero whose bound and
    // summoned beasts don't count, and a beast mustered under a comrade at his beast command (into the garrison); and
    // since P1-11e20 (R-129, the turn's order of the heroes through src/shared/) an item handed to a comrade marching in
    // that season (he arrives first: handed over at once), a chain of hand-overs in one season (the hero who hands to a
    // comrade who hands on goes first), two heroes handing to one comrade (the quicker first: his items first in the
    // pack), and a comrade beside him who marches away that season (handed over before he sets out).
    const list = holdings().filter((x) => (THE_HOLDINGS_THE_FORECAST_GETS_RIGHT as readonly string[]).includes(x.kind));
    expect(list.map((x) => x.kind)).toEqual([...THE_HOLDINGS_THE_FORECAST_GETS_RIGHT]);
    expect(differences(list)).toEqual([]);
    // and each order changed what they hold, but the two a full beast command turns back (the beast stays where it was)
    expect(list.filter((x) => sameAnswer(x.engine, x.before)).map((x) => x.kind)).toEqual([
      'a beast handed to a comrade at his beast command',
      'a beast taken up past his beast command',
    ]);
  });

  test('the Move note counts what a comrade takes of the companies handed or mustered to him that season, as the turn gives them (P1-11e19, R-129)', () => {
    // The note reads his column as he marches: the companies a comrade hands him or musters under his banner that same
    // season join first. Risen dead go to their graves, a beast past his beast command stays with the giver or goes to
    // the garrison, by the turn's rules.
    // (counted: a company raised this season has no name on the form yet)
    expect(
      theMoveNoteOfAComradeHandedCompaniesAgainstTheTurn(forecasts).map((x) => [x.kind, x.note.length, x.turn.length]),
    ).toEqual([
      ["companies recruited under a comrade's banner", 1, 1],
      ['risen dead handed to a comrade', 0, 0],
      ['a beast handed to a comrade at his beast command', 0, 0],
      ['a beast recruited under the banner of a comrade at his beast command', 0, 0],
    ]);
  });

  test('the Pick Up field offers the company a comrade leaves in the garrison that season, as the turn gives it (P1-11e17)', () => {
    // The field reads the garrison as the season begins with what the hero's comrades leave in it that season (the turn
    // makes the Pick Up wait for them): the forecasts' replay with the leaves of its own phase.
    const { field, turn } = thePickUpFieldAsAComradeLeavesAgainstTheTurn(forecasts);
    expect(field).toEqual(turn);
    expect(field).toHaveLength(1);
  });

  test('what the forecast gets wrong is pinned: the Stone, a chain of company hand-overs in one phase (question 42)', () => {
    // The form replays the orders, not the turn's checks: the Philosopher's Stone used is destroyed (as an older save's
    // copy carries it: the one Use Item works), and the form keeps it in his pack; a chain of company hand-overs in one
    // season goes in the turn's order (the comrade hands on what he was handed), where the form reads each column as the
    // season begins, so the first hero's companies are lost from every column (Parked, R-129).
    const list = holdings();
    expect(
      list.map((x) => x.kind).filter((k) => !(THE_HOLDINGS_THE_FORECAST_GETS_RIGHT as readonly string[]).includes(k)),
    ).toEqual([...THE_HOLDINGS_THE_FORECAST_GETS_WRONG]);
    const kind = (k: string) => {
      const x = list.find((h) => h.kind === k);
      if (!x) throw new Error(`no staged holding of the kind ${k}`);
      return x;
    };
    const stone = kind("the Philosopher's Stone used");
    expect([stone.copy, stone.engine]).toEqual([{ bearer: ["Philosopher's Stone"] }, { bearer: [] }]);
    const chain = kind('a chain of company hand-overs in one phase');
    expect([chain.copy, chain.engine]).toEqual([
      { 'the first to hand over': [], between: [], last: ['Yeoman Longbows (Average)'] },
      { 'the first to hand over': [], between: [], last: ['Yeoman Longbows (Average)', 'Men-at-Arms (Average)'] },
    ]);
  });
});

describe('the orders: what the order form offers a hero (P1-11d3)', () => {
  test('every name the order list holds is the order the turn reads it as: all 46, none of them read as a Defend but Defend', () => {
    // The form sends an order by its name in the list (ACTIONS); the turn reads it through its table of names
    // (normaliseAction), and a name the table doesn't hold is read as a Defend (P1-19's item 6).
    expect(theOrderEachNameOfTheListGives(forecasts)).toEqual([
      ['Move', 'move'],
      ['Explore', 'explore'],
      ['Search Lair', 'search'],
      ['Hunting Rumours', 'hunt_rumours'],
      ['Recruit Armies', 'recruit'],
      ['Hire Hero', 'hire'],
      ['Release Hero', 'release'],
      ['Encounter Character', 'encounter'],
      ['Steal', 'steal'],
      ['Disband Army', 'disband_army'],
      ['Leave/Transfer Army', 'leave_army'],
      ['Pick Up Army', 'pickup_army'],
      ['Send Item', 'give_item'],
      ['Cast Spell', 'cast_spell'],
      ['Use Item', 'use_item'],
      ['Equip Items', 'equip_items'],
      ['Spy', 'spy'],
      ['Practice Skill', 'practice'],
      ['Research', 'research'],
      ['Perform Rite', 'rite'],
      ['Consecrate', 'consecrate'],
      ['Call to Arms', 'call_to_arms'],
      ['Broker', 'broker'],
      ['Harvest the Field', 'harvest_field'],
      ['Sabotage', 'sabotage'],
      ['Forced March', 'forced_march'],
      ['Grand Heist', 'grand_heist'],
      ['Awaken Grove', 'awaken_grove'],
      ['Chart the Unknown', 'chart_unknown'],
      ['Discover Lost Ruin', 'discover_ruin'],
      ['Blockade', 'blockade'],
      ['Research Breakthrough', 'research_breakthrough'],
      ['Assassinate', 'assassinate'],
      ['Vanish', 'vanish'],
      ['Challenge', 'challenge'],
      ['Rampage', 'rampage'],
      ['Rain of Arrows', 'rain_of_arrows'],
      ["Sniper's Mark", 'snipers_mark'],
      ['Feigned Retreat', 'feigned_retreat'],
      ['Grand Stratagem', 'grand_stratagem'],
      ['Lightning Advance', 'lightning_advance'],
      ['Raid the Coast', 'raid_coast'],
      ['Wild Calling', 'wild_calling'],
      ['Grand Design', 'grand_design'],
      ['Defend', 'defend'],
      ['Rest', 'rest'],
    ]);
  });

  test('the order list offers a hero exactly the orders the turn lets him give: each mastery from its level, each creed’s orders to its realm (the king’s to the king), Steal, Research, Release Hero, the Grand Design once, and a hero held by a charm or new to the realm', () => {
    // On staged heroes of realm 0 (its report as the engine builds it, under each creed and with its Wonder raised):
    // the form's actionsFor against processOrder's refusals the list restates. Each mastery of the form's table by a
    // hero one level below it (refused) and one at it; the five creeds' orders by the king and a hero of each of the
    // seven creeds; Steal and Research at levels 0 and 1, and at 0 wearing a Sage +2 item (Research reads the trained
    // Sage) or the Gloves of the Nightcrawler (Steal reads the Thief his items give: since P1-11e21, R-130); Release
    // Hero by a hero, not the king; the Grand Design until the realm has raised its Wonder; every order by a hero seized
    // from an enemy by a charm and one hired this turn, each with the card the page makes him.
    const list = orderList();
    expect(differences(list)).toEqual([]);
    expect(list.length).toBe(212);
    // the gloves' Thief is offered Steal, as the turn lets him steal (question 40)
    expect(
      list.filter((x) => x.order === 'Steal' && x.who.includes('wearing')).map((x) => [x.who, x.copy, x.engine]),
    ).toEqual([['thief 0, wearing Gloves of the Nightcrawler', true, true]]);
    // every refusal the list restates is met, each mastery's too, and each order is both offered and hidden somewhere
    const met = new Set(list.map((x) => x.refusal));
    expect(THE_TURNS_REFUSALS_THE_ORDER_LIST_RESTATES.filter((k) => !met.has(k))).toEqual([]);
    expect([...met].filter((k) => k?.startsWith('a hero lacks the ')).length).toBe(20);
    const gated = [
      ...new Set(list.filter((x) => x.kind !== 'a hero under a charm, or new to the realm').map((x) => x.order)),
    ];
    expect(
      gated.filter((o) => !(list.some((x) => x.order === o && x.copy) && list.some((x) => x.order === o && !x.copy))),
    ).toEqual([]);
  });
});

describe('gold and practice: what the treasury ledger and the Practice Skill note say (P1-11d4)', () => {
  test('the treasury ledger says what the turn spends and adds to the wages: companies of the province, at the capital and for the garrison, a mercenary band, a wandering hero, Supply Depots under its cap and past it (a company to the garrison too, room for one of two, an older report), Granaries under its cap and past it (room for one of two), Inspiring Leadership, a Druid 5 hero’s beast, a Druid 6 hero’s beast at half price and wage, a beast under a Druidic Wonder, the Host-Leader’s column where the report names him, Harvest the Field (with Corpse-Carters too), the Wild Hunt', () => {
    // On realm 0's report as the engine builds it from each world, the form's computeOrderLedgerP (its spend, and its
    // new wages) against the turn: the gold its phase takes from the treasury, and what Early Winter's wages rise by.
    // The Broker's word from a province is two gold on a report that prices it, and on an older one that names no
    // price (the row's number is the ledger's fallback: P1-11d8); so are the carters', and nothing with Corpse-Carters
    // (P1-11e26).
    const list = ledgers().filter((x) => (THE_LEDGERS_THE_TURN_AGREES_WITH as readonly string[]).includes(x.kind));
    expect(list.map((x) => x.kind)).toEqual([...THE_LEDGERS_THE_TURN_AGREES_WITH]);
    expect(differences(list)).toEqual([]);
    // each order is carried out: the turn takes gold for it, but the carters' with Corpse-Carters (nothing: P1-11e26)
    const spent = (x: (typeof list)[number]) => Number((x.engine as Record<string, unknown>)['spend']);
    expect(list.filter((x) => !(spent(x) > 0)).map((x) => x.kind)).toEqual([
      'Harvest the Field, by a realm with Corpse-Carters',
    ]);
    // and each is carried out all the same: the carters raise a company, which adds its wage
    const added = (x: (typeof list)[number]) => Number((x.engine as Record<string, unknown>)['new wages']);
    expect(list.filter((x) => x.kind === 'Harvest the Field, by a realm with Corpse-Carters').map(added)).toEqual([1]);
  });

  test('what the treasury ledger can’t know is pinned: the Host-Leader on a report that doesn’t name him (question 43, a forecast limit)', () => {
    // The ledger leaves out the Host-Leader's 1g a company he leads where the report doesn't name him (the titles not
    // yet public: a forecast limit, Decision 6; since P1-11e29 it counts it where the report names him, as it does a
    // Druid 6 leader's half price and half wage for a beast; since P1-11e30 it shares the upkeep and hero-wage
    // discoveries' savings under their caps, as the turn does).
    const list = ledgers();
    expect(
      list.map((x) => x.kind).filter((k) => !(THE_LEDGERS_THE_TURN_AGREES_WITH as readonly string[]).includes(k)),
    ).toEqual([...THE_LEDGERS_THE_TURN_DISAGREES_WITH]);
    const kind = (k: string) => {
      const x = list.find((l) => l.kind === k);
      if (!x) throw new Error(`no staged ledger of the kind ${k}`);
      return [x.copy, x.engine];
    };
    expect(
      kind(
        "a company raised into the Host-Leader's column, on a report that doesn't name him (the titles not yet public)",
      ),
    ).toEqual([
      { spend: 3, 'new wages': 3 },
      { spend: 3, 'new wages': 2 },
    ]);
  });

  test("the treasury ledger charges a beast mustered to a comrade the wage of the comrade's column, not the recruiter's Druid (P1-21n)", () => {
    // R-134: a beast in the column of a Druid 6 leader pays half wages. A Druid 6 hero musters a Great Bear (4g) into
    // the column of a Druid 2 comrade beside him: the full 4g; into his own: 2g.
    const hero = (id: number, druid: number) => ({
      id,
      name: `Hero ${String(id)}`,
      locationId: 1,
      locationName: 'Province 1',
      effectiveSpeed: 2,
      effectiveSeaSpeed: 0,
      skills: { druid },
      items: [],
      armies: [],
    });
    const provinces = Array.from({ length: 8 }, (_, id) => ({
      id,
      row: Math.floor(id / 4),
      col: id % 4,
      name: `Province ${String(id)}`,
      terrain: 'plains',
      owner: 0,
    }));
    const report = {
      playerIndex: 0,
      kingdom: { alignment: 'Good' },
      diplomacy: { known: [] },
      worldMeta: { cols: 4, rows: 2, provinces },
      ownedProvinces: provinces.map((p) => ({ id: p.id })),
      provinceOrderData: { 1: { garrisonArmies: [], armyTypes: [{ type: 'Great Bears', cost: 6 }] } },
      orderPrices: { unitCost: { 'Great Bears': 4 } },
      characters: [hero(1, 6), hero(2, 2)],
    };
    const newWages = (to: string): unknown => {
      const ledger = forecasts.theLedgerOn(report, {
        1: [{ action: 'Recruit Armies', target: `Great Bears|1,${to}` }],
      });
      return typeof ledger === 'object' && ledger !== null ? Reflect.get(ledger, 'new wages') : ledger;
    };
    expect([newWages('to:2'), newWages('to:self')]).toEqual([4, 2]);
  });

  test('the Practice Skill note quotes the chance the turn rolls: Melee 0 to 4, a Human hero of another realm and of a Human realm, a practice discovery of the realm and one of other skills; no roll at Melee 5', () => {
    // The form's orderChanceNote (its "Improvement: N% at <skill> L.", and whether it says he learns half as fast
    // again) against the chance processOrder's line gives and whether it counts him a quick learner, each hero
    // practising alone: an Elven hero of a Human realm at each level a practice can raise, a Human hero of an Elven
    // realm, and a realm with Astronomical Tables (+3), Blooded Retinues (Melee +10) and Tradecraft Manuals (Spy and
    // Thief: none for Melee). Since P1-11e28 (R-134, question 43 (b)): a Human hero of a Human realm (x1.5, the turn's
    // quick learner, on the base and the realm's discoveries both: (25 + 3) x 1.5 = 42 with Astronomical Tables), and
    // an Elven hero at Melee 5 (the note says no roll is made; the turn makes none).
    const list = practiceNotes().filter((x) =>
      (THE_PRACTICE_NOTES_THE_TURN_AGREES_WITH as readonly string[]).includes(x.kind),
    );
    expect(list.map((x) => x.kind)).toEqual([...THE_PRACTICE_NOTES_THE_TURN_AGREES_WITH]);
    expect(differences(list)).toEqual([]);
    expect(list.map((x) => (x.copy as Record<string, unknown>)['chance'])).toEqual([
      25,
      20,
      15,
      10,
      5,
      15,
      28,
      30,
      20,
      22,
      42,
      '(no roll: drilled as far as practice can take it)',
    ]);
    expect(list.map((x) => (x.copy as Record<string, unknown>)['a quick learner'])).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      true,
      undefined,
    ]);
  });
});
