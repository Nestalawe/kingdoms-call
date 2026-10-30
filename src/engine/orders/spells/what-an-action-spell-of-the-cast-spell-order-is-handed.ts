// What an action spell of the Cast Spell order is handed (plan P1-19z).
// The types the order marks its heroes, provinces and orders with, the helpers its branches use, and the one object
// of 14 names each spell takes; moved as they were from the order file, with the object and the work's type new.
import type { ArmyInABattle, HeroInABattle } from '../../army-tables.ts';
import type { GameState, Grave, Province, Realm } from '../../../schemas/saved-game-state.ts';
import type { TurnContext, TurnOrder } from '../../turn/context.ts';

/** A hero as the Cast Spell order marks him: a hero in a turn (the battle's marks: Oratory's tiers, the Charm's
 *  seizure), his companies as a battle marks them (the Telekinetic Storm's), and the turn's marks only the spells write.
 *  None is in the saved state's schema; each is wiped by the new turn, or never saved. */
export type AHeroAsTheCastMarksHim = Omit<HeroInABattle, 'armies'> & {
  armies: ArmyInABattle[];
  /** The Wailing Phylactery's sure Necromancy cast is spent for the turn. */
  _necroAutoUsed?: boolean;
  /** He has summoned an elemental this turn (Summon Elemental, once a turn). */
  _elementalSummonedThisTurn?: boolean;
  /** The realms that watch him with Clairvoyance (one watch a realm). */
  _clairvoyantBy?: number[];
  /** The levels each Curse this turn has taken from each skill. */
  _curses?: Record<string, number>;
};
/** A province as the Cast Spell order marks it: a province, and the marks of Part Sea and Flood, which the new turn
 *  takes back. */
export type AProvinceAsTheCastMarksIt = Province & {
  /** A Flood's older mark (the new turn wipes it): Part Sea and a Flood cancel it. */
  _flooded?: unknown;
  /** Part Sea's waters drawn back: the terrain it had, the turn, and the phase from which no fleet sails there. */
  _partSea?: { orig: string; turn: number; blockFleetsFromPhase: number };
  /** A Flood: the terrain it had, and the turn. */
  _flood?: { orig: string; turn: number };
};
/** A hero's order as the Cast Spell order marks it: the turn's order, and whether it was refused before it was worked
 *  (it spends no casting slot). */
export type AnOrderAsTheCastMarksIt = TurnOrder & { _castNotWorked?: boolean };
/** A realm's orders for a hero it means to raise or charm, held by the merge until the spell takes (each field compared
 *  as it is; the orders a list of the phases', with gaps). */
export interface OrdersHeldForAHero {
  readonly heroId?: unknown;
  readonly casterId?: unknown;
  readonly player?: unknown;
  readonly orders?: (TurnOrder | null | undefined)[] | null | undefined;
}
/** The state as the Cast Spell order reads it: its heroes and provinces as it marks them, the graveyard as a guard
 *  reads
 *  it (an older save may lack it), the heroes' orders for the turn (the saved state holds them cleared), and the turn's
 *  lists of the heroes raised and the orders held for a hero a realm means to raise or charm. */
export type TheStateAsTheCastReadsIt = Omit<GameState, 'characters' | 'world' | 'heroGraveyard' | 'turnOrders'> & {
  characters: AHeroAsTheCastMarksHim[];
  world: Omit<GameState['world'], 'provinces'> & { provinces: AProvinceAsTheCastMarksIt[] };
  heroGraveyard?: Grave[] | undefined;
  turnOrders: Record<string, (AnOrderAsTheCastMarksIt | null | undefined)[] | undefined>;
  _resurrectedThisTurn?: number[];
  _pendingResurrectOrders?: readonly OrdersHeldForAHero[] | undefined;
  _pendingCharmOrders?: readonly OrdersHeldForAHero[] | undefined;
  _pendingSynthPlans?: unknown;
};
/** A spell's row as the order reads it by any name. */
export interface ASpellAsTheCastReadsIt {
  readonly school: string;
  readonly phase: boolean;
  readonly fn: string;
  readonly reqLevel?: number;
}
/** Whether a hero serves a realm. */
export function servesARealm<Hero extends { readonly player: number | null }>(
  h: Hero,
): h is Hero & { readonly player: NonNullable<Hero['player']> } {
  return h.player !== null;
}
/** The caster's realm's name: processOrder hands a hero of a realm his realm, so there is one; for none, the TypeError
 *  the read of its name would throw. */
export function theCastersRealmsName(player: Realm | undefined) {
  if (!player) throw new TypeError("Cannot read properties of undefined (reading 'name')");
  return player.name;
}
/** A realm's name by its index, as a line names a hero's realm: none for no realm (a wanderer's), or no realm there. */
export function aRealmsNameOrNone(players: readonly Realm[], pi: number | null) {
  const realm = pi === null ? undefined : players[pi];
  return realm ? realm.name : null;
}
/** The province the caster stands in, as a spell's reach is measured from it: every living hero stands in a province of
 *  the map (the matrix's invariant "armies in real provinces"), so there is one; for none, the TypeError its first read
 *  throws. */
export function theProvinceTheCasterStandsIn(p: AProvinceAsTheCastMarksIt | undefined) {
  if (!p) throw new TypeError("Cannot destructure property 'row' of 'prov' as it is undefined.");
  return p;
}
/** What a die picks from a list the code has just made sure holds something (an index below its length); for none, a
 *  TypeError. */
export function theOneThePickFell<Picked>(picked: Picked | undefined): Picked {
  if (picked === undefined) throw new TypeError('a pick from a list fell on nothing');
  return picked;
}
/** The one taken out of a list at an index the code has just drawn from it (there is always one); for none, a
 *  TypeError. */
export function theOneTakenOut<Taken>(list: Taken[], i: number): Taken {
  const [taken] = list.splice(i, 1);
  return theOneThePickFell(taken);
}
/** The caster as the order knows him once it has made sure he serves a realm. */
export type TheCasterWhoServesARealm = AHeroAsTheCastMarksHim & { readonly player: number };
/** The 14 names a spell's branch reads from resolveCastSpellOrder (each branch takes the ones it reads): the turn's
 *  context; the state; the caster, his order, the phase, the spell's target text, the province he casts in, his
 *  realm; the realms watching by Clairvoyance; the spell's school and the levels it counts (the caster's, and capped
 *  at 5 for its effects); the target text as a number, the province it names (or the caster's) and the living hero
 *  it names. */
export interface TheNamesAnActionSpellIsHanded {
  readonly turnContext: TurnContext;
  readonly G: TheStateAsTheCastReadsIt;
  readonly c: TheCasterWhoServesARealm;
  readonly ph: number;
  readonly extra: string | null | undefined;
  readonly prov: AProvinceAsTheCastMarksIt;
  readonly player: Realm | undefined;
  readonly clairWatch: TurnContext['clairWatch'];
  readonly school: string;
  readonly spellLevel: number;
  readonly spellLevelEff: number;
  readonly extraId: number;
  readonly targetProv: AProvinceAsTheCastMarksIt;
  readonly targetChar: AHeroAsTheCastMarksHim | undefined;
}
/** What a fizzled cast is handed: the names a fizzled Charm's backlash reads. */
export type TheNamesAFizzledCastIsHanded = Pick<
  TheNamesAnActionSpellIsHanded,
  'turnContext' | 'G' | 'c' | 'extra' | 'prov'
>;
/** An action spell's work, found by its slug: it returns false where the cast ends here (no skill gain) and true where
 *  the spell is worked; a fizzled cast of some spells does one thing more first. */
export interface AnActionSpellsWork {
  readonly worked: (hands: TheNamesAnActionSpellIsHanded) => boolean;
  readonly whenItFizzles?: (hands: TheNamesAFizzledCastIsHanded) => void;
}
