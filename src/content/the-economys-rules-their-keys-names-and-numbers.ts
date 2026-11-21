// The economy's rules (B-06, T7, the rules pulled out: its economy family, from B-06c): one row per rule of a realm's
// gold, keyed by its slug, giving its name as the books write it and the numbers the turn reads for it. The economy's
// registry (src/engine/rules/the-registry-of-the-economys-rules.ts) has one entry for each row and no other: a row with
// no entry, or an entry with no row, fails to compile. A row holds only what the turn reads: who holds a title, a
// mastery or a Wonder is the caller's to ask, as before. How to add one:
// docs/architecture/the-economys-registry-its-stages-and-how-to-add-a-rule-of-the-economy.md.

/** A row: a rule's name, and the numbers the turn reads for it, by what each is. */
export interface ARuleOfTheEconomy {
  readonly name: string;
  readonly theNumbers: Readonly<Record<string, number>>;
}

/** The economy's rules the registry holds, by slug, in the order of their stages. */
export const THE_ECONOMYS_RULES = {
  // ── A province's tax this turn: the marks this turn's spells and spies leave (the report's forecast leaves them out) ──
  // an Earthquake cast on the province this turn: it yields nothing this turn
  'an-earthquake-wrecks-a-provinces-tax-this-turn': { name: 'Earthquake', theNumbers: {} },
  // a Spy's Sabotage on the province this turn: it yields nothing this turn
  'sabotage-wrecks-a-provinces-tax-this-turn': { name: 'Sabotage', theNumbers: {} },
  // Bless Province: the province yields its blessing's own measure this turn (×1.6, or ×2 from a Divine king, as the
  // cast recorded it), rounded; a blessing that recorded none yields the spell's ×1.6
  'bless-province-raises-a-provinces-tax-this-turn': {
    name: 'Bless Province',
    theNumbers: { theYieldOfABlessThatRecordedNone: 1.6 },
  },
  // ── A province's tax while a mark lasts ──
  // Evil's Enslave: the province's resentment costs a gold of its tax while it lasts, never below nothing
  'enslave-cuts-a-provinces-tax-while-it-resents': { name: 'Enslave', theNumbers: { theGoldItCuts: 1 } },
  // ── A province's tax from the realm's Wonder ──
  // Good's Grand Design: every province the realm holds that keeps a garrison yields more
  'the-free-city-charter-adds-to-a-garrisoned-provinces-tax': {
    name: 'Free City Charter',
    theNumbers: { theGoldItAdds: 2 },
  },
  // ── A realm's gold beyond its tax, from a hero's minor title (the holders worked out at the turn's start) ──
  'the-cutpurses-gold': { name: 'The Cutpurse', theNumbers: { theGold: 2 } },
  'the-champion-of-the-peoples-gold': { name: 'Champion of the People', theNumbers: { theGold: 2 } },
  // a gold for every so many provinces the realm holds, rounded down
  'the-castellans-gold': { name: 'The Castellan', theNumbers: { theProvincesForEachGold: 5 } },
  // ── A realm's gold beyond its tax, from a hero's mastery ──
  // the Thief's sixth mastery: a personal stipend each turn
  'the-thief-network': { name: 'Thief network', theNumbers: { theGold: 5 } },
  // ── A company's wage this turn (B-06d: Early Winter alone; the report's forecast leaves it out, as the stamped
  // wages cover it) ──
  // an Orcish company of an Orcish realm that won attacking this turn: half its wage, the half golds carried from
  // company to company so the host pays half in all, and never below the least wage
  'the-orcish-war-spoils-halve-a-companys-wage-this-turn': {
    name: 'Orcish war-spoils',
    theNumbers: { theShareOfTheWage: 0.5, theLeastWage: 1 },
  },
  // ── A company's wage under its leader ──
  // the Druid's sixth mastery (or the Druidic Wonder): a creature or a monster he leads costs half to recruit (rounded
  // down) and draws half its wage (rounded down, never below the least wage)
  'a-druid-halves-a-beasts-price-and-wage': {
    name: 'Druid',
    theNumbers: { theShareOfThePriceAndTheWage: 0.5, theLeastWage: 1 },
  },
  // ── A realm's company wages under its Host-Leader ──
  // the realm's greatest general: a gold less for each company he leads that draws a wage, the wages never below
  // nothing
  'the-host-leaders-cut-of-his-companies-wages': {
    name: 'The Host-Leader',
    theNumbers: { theGoldOnEachCompany: 1 },
  },
  // ── A company's ranks in the line to disband unpaid (B-06e: a realm that can't pay its wages disbands its
  // companies in the line these ranks give, rank by rank in this order, a die each company drew breaking a tie) ──
  // the dead (skeletal companies) go last: nothing living stays while one of them could go
  'the-dead-disband-last-for-want-of-pay': {
    name: 'Skeletal units always last',
    theNumbers: { theRankOfTheLiving: 0, theRankOfTheDead: 1 },
  },
  // then the least experienced first, by the grades' order (KC_QUALITY_TIERS); a company of no known grade ranks as
  // the grade at this place in it (Average)
  'the-least-experienced-disband-first-for-want-of-pay': {
    name: 'The least experienced first',
    theNumbers: { theRankOfACompanyOfNoKnownGrade: 1 },
  },
  // ── A company spared disbanding unpaid ──
  // a ship (KC_UNIT_CLASS.carrier) at open sea that its column still needs to carry its troops is kept at the oars
  'a-ship-carrying-troops-at-sea-is-kept-at-the-oars-unpaid': { name: 'Kept at the oars', theNumbers: {} },
  // ── An unpaid hero deserts (once no company is left that may go: each hero, the best paid first, while the
  // shortfall lasts; a shortfall left after the last is forgiven) ──
  // his loyalty holds on a die at or below this, and he deserts on one above it
  'an-unpaid-hero-deserts-unless-his-loyalty-holds': {
    name: 'Heroes desert',
    theNumbers: { theDieHisLoyaltyHoldsAtOrBelow: 0.4 },
  },
} as const satisfies Readonly<Record<string, ARuleOfTheEconomy>>;

/** A rule of the economy, by its slug. */
export type TheEconomysRuleSlug = keyof typeof THE_ECONOMYS_RULES;
