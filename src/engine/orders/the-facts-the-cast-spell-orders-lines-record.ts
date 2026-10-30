// ── THE FACTS THE CAST SPELL ORDER'S LINES RECORD (plan P1-12d9: P1-12's Decisions of 2026-10-26, Decisions 2, 6 and
// 7) ──
// The lines the Cast Spell order writes (orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-
// spells.ts): the casting itself (the spell named, the casting limits, a mastery spell once a turn, a mark gone, the
// cast's roll, a fizzle, a mark vanished, veiled or cloaked) and every spell a hero works as a phase order, school by
// school (White Magic, Psychic, Illusory, Elemental, Necromancy, and the mastery spells), each refused or worked, with
// what the realm whose hero or province it touches is told; and a failed Charm's backlash. Each kind holds plain
// values: a hero's, a realm's, a province's, a unit's or an item's name as the world holds it (null where the world has
// none: the prose writes the words for it), a school's slug, a level, a chance and its roll, a count, a flag for a
// clause chosen by it, and lists copied as the line is told (a charmed hero's skills and items, the skills a Psychic
// Blast takes or a Curse halves, the companies a Telekinetic Storm strikes, the graves Control Undead senses, the
// provinces around that hold dead); why a charmed mind may turn on its enchanter is a record its callers hand. The
// prose writes every word (src/views/prose/the-words-of-the-cast-spell-orders-lines.ts). Each is filed on its own, with
// the audience its event names (Decision 6: its event's): no audience, hero, `spy` flag or province changes, so every
// realm is told exactly what it was told before. A hero slain by the enchanter he turned on is told by reportHeroFall
// (heroes/), as a hero's death's kind "a hero is slain outside a battle", the way he fell a value (P1-12d11).
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type { AnItemAsTheLineNamesIt } from '../personal-combat/the-facts-a-personal-combats-lines-record.ts';

/** Why a charmed mind may turn on its enchanter, as the backlash's roll tells it. */
export type WhyAnEnchantedHeroMayTurnOnHisEnchanter =
  | { kind: 'the Charm fizzled' }
  | { kind: 'the mind is closed to enchantment this season' }
  | { kind: 'the Charm was resisted' };

/** A company a Telekinetic Storm strikes, as its line tells it: its name (else its type) and its quality before and
 *  after. */
export type ACompanyTheStormStrikes =
  | { kind: 'a skeletal company the storm shatters to dust'; unitName: string }
  | { kind: 'a company the storm tears apart for good'; unitName: string; qualityBefore: string }
  | {
      kind: 'a company the storm reduces one experience level';
      unitName: string;
      qualityBefore: string;
      qualityAfter: string;
    };

/** A skill a Curse halves: its slug, and its level before (the prose halves it, rounded down, as the Curse did). */
export interface ASkillACurseHalves {
  readonly skill: string;
  readonly levelBefore: number;
}

/** A grave Control Undead senses, as its line counts it: its quality (none: the prose writes "Average") and type. */
export interface AGraveAsTheLineCountsIt {
  readonly quality: string;
  readonly type: string;
}

/** The graves of a province, each as the line counts it, copied as the line is told. */
export function theGravesAsTheLineCountsThem(
  graves: readonly { readonly quality: string; readonly type: string }[],
): AGraveAsTheLineCountsIt[] {
  return graves.map((g) => ({ quality: g.quality, type: g.type }));
}

/** The caster: the hero whose order it is, by his name. */
interface ACaster {
  heroName: string;
}

/** What a line of the Cast Spell order records. */
export type TheFactOfTheCastSpellOrdersLine =
  // ── A failed Charm's backlash ──
  | {
      kind: 'an enchanted hero may turn on his enchanter';
      targetName: string;
      casterName: string;
      why: WhyAnEnchantedHeroMayTurnOnHisEnchanter;
      chance: number;
      roll: number;
    }
  | {
      kind: 'an enchanted hero rounds on his enchanter but one of them slips away';
      targetName: string;
      casterName: string;
      slipsAwayName: string;
    }
  | { kind: 'an enchanted hero rounds on his enchanter and blades are drawn'; targetName: string; casterName: string }
  // ── The casting ──
  | ({ kind: 'a hero names a spell there is none of'; spellName: string | undefined } & ACaster)
  | ({ kind: 'a spell cannot be worked as a phase order'; spellName: string } & ACaster)
  | ({ kind: "a charmed hero will not turn a spell on his own lord's people"; spellName: string } & ACaster)
  | ({
      kind: "a school's casting limit blocks a spell";
      school: string;
      schoolLevel: number;
      castsSoFar: number;
      limit: number;
      spellName: string;
    } & ACaster)
  | ({
      kind: 'a hero lacks the skill a spell needs after a practice that did not raise it';
      spellName: string;
      school: string;
    } & ACaster)
  | ({ kind: 'an item can no longer work a mastery spell'; itemName: string; spellName: string } & ACaster)
  | ({
      kind: 'a hero has not yet reached the level a mastery spell demands';
      spellName: string;
      school: string;
      levelDemanded: number;
      levelReached: number;
    } & ACaster)
  | ({ kind: 'a mastery spell is worked but once a turn'; spellName: string } & ACaster)
  | ({
      kind: "a spell's mark has gone from the province";
      targetName: string;
      spellName: string;
      /** The mark serves the caster's realm ("marched"), else another ("moved"). */
      theMarkServesTheCastersRealm: boolean;
      /** Where the mark went; null: no such province (the prose writes "another province"). */
      whereTheMarkWentName: string | null;
    } & ACaster)
  | ({ kind: 'a hero invokes an item to work a spell'; itemName: string; spellName: string } & ACaster)
  | ({
      kind: "a spell's cast is rolled";
      spellName: string;
      school: string;
      /** The level he casts at (a spell item's at least 3). */
      spellLevel: number;
      /** His trained level in the school: below the cast's level, the rest is the items'. */
      trainedLevel: number;
      /** A spell item's cast ("the item"), else his items ("items"). */
      byAnItem: boolean;
      chance: number;
      roll: number;
    } & ACaster)
  | ({ kind: 'a spell fizzles without effect'; spellName: string } & ACaster)
  | ({ kind: "a spell's mark has vanished"; spellName: string; targetName: string } & ACaster)
  | ({ kind: "a spell's mark is veiled from hostile magic"; spellName: string; targetName: string } & ACaster)
  | ({ kind: "a spell's mark is cloaked from hostile magic"; spellName: string; targetName: string } & ACaster)
  // ── White Magic ──
  | ({ kind: 'Resurrect finds no fallen hero known to lie in the province'; provinceName: string } & ACaster)
  | ({ kind: "a fallen monarch's crown answers only to its own realm"; fallenName: string } & ACaster)
  | ({ kind: "a fallen monarch's spirit has passed beyond recall"; fallenName: string } & ACaster)
  | ({ kind: 'a fallen king cannot be resurrected'; fallenName: string } & ACaster)
  | ({ kind: 'a fallen hero sworn to another crown will not answer'; fallenName: string } & ACaster)
  | ({ kind: 'a fallen hero has already been raised this turn'; fallenName: string } & ACaster)
  | ({ kind: "a fallen hero's spirit cannot be found"; fallenName: string } & ACaster)
  | ({ kind: 'kings cannot be resurrected' } & ACaster)
  | {
      kind: 'a reigning monarch steps down as the fallen monarch is restored';
      regentName: string;
      restoredName: string;
    }
  | ({ kind: 'a fallen monarch rises and reclaims the throne'; restoredName: string; realmName: string } & ACaster)
  | ({
      kind: 'a fallen hero rises to serve the realm';
      restoredName: string;
      realmName: string;
      /** He served another realm in life. */
      wasAFoe: boolean;
    } & ACaster)
  | {
      kind: 'a hero takes up the orders his realm laid down for him';
      heroName: string;
      realmName: string;
      phasesLeft: number;
    }
  | ({ kind: 'Part Sea is cast beyond its reach' } & ACaster)
  | ({ kind: 'the waters of a province draw back'; provinceName: string } & ACaster)
  | ({
      kind: 'a realm learns the sea was parted at its province';
      /** The caster's realm; null: none (the prose writes "a foreign realm"). */
      castersRealmName: string | null;
      provinceName: string;
    } & ACaster)
  | ({ kind: 'Part Sea finds no sea to part'; provinceName: string } & ACaster)
  | ({ kind: 'the Holy Symbol finds no dead to cleanse'; provinceName: string } & ACaster)
  | ({ kind: 'the Holy Symbol cleanses the graves of a province'; provinceName: string } & ACaster)
  | ({
      kind: 'onlookers see a Holy Symbol cleanse the graves of a province';
      /** The caster's realm, named after him; null: none. */
      realmName: string | null;
      provinceName: string;
    } & ACaster)
  | ({ kind: 'Bless Province is cast beyond its reach' } & ACaster)
  | ({ kind: 'a province is already blessed this turn'; provinceName: string } & ACaster)
  | ({
      kind: 'a province is blessed and warded';
      provinceName: string;
      /** The tax's multiplier at collection (the prose shows the rise in percent, rounded down). */
      blessedMultiplier: number;
      byADivineKing: boolean;
      byADivineRealm: boolean;
      /** The ward's chance to turn aside an enemy Flood, Earthquake, Plague or Part Sea, in percent. */
      wardChance: number;
    } & ACaster)
  // ── Psychic ──
  | { kind: 'Charm finds no hero to sway in the province'; provinceName: string }
  | { kind: "Charm cannot be used on the realm's own heroes" }
  | { kind: 'Charm cannot sway a king' }
  | ({ kind: 'a Charm slides off a mind lately swayed'; targetName: string } & ACaster)
  | { kind: "a mind's resistance to a Charm is rolled"; targetName: string; resistance: number; roll: number }
  | ({ kind: 'a Charm breaks against a mind swayed before'; targetName: string } & ACaster)
  | { kind: 'a hero throws off an enchantment'; targetName: string }
  | ({
      kind: "an enchanter reads a charmed hero's mind";
      targetName: string;
      /** Each skill above 0 and its level, in the skills' order, copied as the line is told. */
      skills: [skill: string, level: number][];
      /** The magic items he carries, copied as the line is told. */
      items: AnItemAsTheLineNamesIt[];
    } & ACaster)
  | ({ kind: 'a Charm finds no living mind to sway'; targetName: string } & ACaster)
  | ({ kind: 'a Charm cannot grip a hero leading troops'; targetName: string } & ACaster)
  | ({ kind: 'a Charm finds a hero just dismissed unmoved'; targetName: string } & ACaster)
  | ({
      kind: "a Charm cannot sway a soul across the alignments' gulf";
      targetName: string;
      targetsAlignment: string | undefined;
      realmsAlignment: string | undefined;
    } & ACaster)
  | ({ kind: 'a Charm sways a wandering hero into service'; targetName: string; realmName: string } & ACaster)
  | ({
      kind: 'a Charm seizes an enemy hero until the season turns';
      targetName: string;
      realmName: string;
      /** The phases of orders the realm wrote for him that await him. */
      phasesOfOrders: number;
    } & ACaster)
  | { kind: 'a realm learns its hero is ensorcelled by an enemy Charm'; targetName: string }
  | ({ kind: "Oratory cannot stir another realm's troops"; targetName: string } & ACaster)
  | ({
      kind: 'Oratory lifts the troops a hero leads';
      /** The caster stirs his own troops. */
      onTheCasterHimself: boolean;
      targetName: string;
      qualityLevels: number;
    } & ACaster)
  | ({
      kind: 'Clairvoyance finds its mark dead';
      targetName: string;
      /** Where his body lies; null: nowhere known (the prose writes "parts unknown"). */
      bodyProvinceName: string | null;
    } & ACaster)
  | { kind: 'Clairvoyance needs a hero to watch' }
  | ({ kind: 'Clairvoyance cannot fix on a mind that serves no crown'; targetName: string } & ACaster)
  | ({
      kind: "Clairvoyance opens the mind's eye upon a hero";
      targetName: string;
      /** Where he is; null: nowhere known (the prose writes "parts unknown"). */
      provinceName: string | null;
    } & ACaster)
  | { kind: 'Psychic Blast finds no hero in the province'; provinceName: string }
  | { kind: "Psychic Blast cannot be turned on the realm's own heroes" }
  | ({ kind: 'a Psychic Blast finds no trained skills left to lose'; targetName: string } & ACaster)
  | ({
      kind: "a Psychic Blast takes a hero's skills";
      targetName: string;
      /** Each skill a level is taken from, by its slug (twice when both levels came from it), copied. */
      skillsLost: string[];
    } & ACaster)
  | ({ kind: 'a hero reels from a Psychic Blast'; targetName: string; skillsLost: string[] } & ACaster)
  | { kind: "a hero's lost skill lowers his wage"; targetName: string; wage: number; wageBefore: number }
  | { kind: 'Telekinetic Storm finds no hero in the province'; provinceName: string }
  | { kind: "Telekinetic Storm cannot be turned on the realm's own heroes" }
  | { kind: 'a Telekinetic Storm finds no armies to scatter'; targetName: string }
  | ({
      kind: "a Telekinetic Storm hurls a hero's troops about";
      targetName: string;
      caught: number;
      destroyed: number;
      demoted: number;
      /** Each company struck, copied as the line is told. */
      units: ACompanyTheStormStrikes[];
    } & ACaster)
  | ({
      kind: "a hero's formations are scattered by a Telekinetic Storm";
      targetName: string;
      destroyed: number;
      demoted: number;
      units: ACompanyTheStormStrikes[];
    } & ACaster)
  // ── Illusory ──
  | ({ kind: 'Illusory Terrain is cast beyond its reach' } & ACaster)
  | ({ kind: 'Illusory Terrain cloaks a province'; provinceName: string } & ACaster)
  | ({ kind: 'Phantasmal Armies is cast on a hero beyond its reach' } & ACaster)
  | ({
      kind: 'Phantasmal Armies finds no humanoid armies to duplicate';
      /** The caster himself ("you have"), else the hero named. */
      onTheCasterHimself: boolean;
      targetName: string;
    } & ACaster)
  | ({
      kind: 'Phantasmal Armies conjures duplicates of humanoid armies';
      duplicates: number;
      onTheCasterHimself: boolean;
      targetName: string;
    } & ACaster)
  | ({ kind: 'Hide Lairs is cast beyond its reach' } & ACaster)
  | ({ kind: 'Hide Lairs finds no lairs left to hide'; provinceName: string } & ACaster)
  | ({ kind: "Hide Lairs veils a province's lairs"; provinceName: string; lairsHidden: number } & ACaster)
  // ── Elemental ──
  | ({ kind: 'Earthquake is cast beyond its reach' } & ACaster)
  | ({ kind: 'an Earthquake rends a province'; provinceName: string } & ACaster)
  | { kind: 'a realm learns an enemy Earthquake tore through its province'; provinceName: string }
  | ({ kind: 'Flood is cast beyond its reach' } & ACaster)
  | ({ kind: 'Flood is cast on the sea' } & ACaster)
  | ({ kind: 'a Flood swallows a province'; provinceName: string } & ACaster)
  | { kind: 'a realm learns an enemy Flood swallowed its province'; provinceName: string }
  | ({ kind: 'a hero has already summoned an elemental this turn' } & ACaster)
  | ({
      kind: 'an elemental surges forth from a rift';
      provinceName: string;
      /** The elemental's name and type, as the unit holds them. */
      elementalName: string;
      elementalType: string;
    } & ACaster)
  | ({
      kind: 'onlookers see an elemental surge forth from a rift';
      realmName: string | null;
      provinceName: string;
      elementalName: string;
      elementalType: string;
    } & ACaster)
  // ── Necromancy ──
  | ({ kind: 'Control Undead senses no dead in the province'; provinceName: string } & ACaster)
  | ({
      kind: 'Control Undead senses the dead of the province';
      provinceName: string;
      /** The graves, copied as the line is told: the prose counts them by quality and type. */
      graves: AGraveAsTheLineCountsIt[];
    } & ACaster)
  | ({
      kind: 'the sending finds battlefield graves in the provinces around';
      provinceName: string;
      /** The names of the provinces around that hold dead, sorted as the engine sorted them. */
      provincesWithDead: string[];
    } & ACaster)
  | ({ kind: 'the sending finds the provinces around quiet'; provinceName: string } & ACaster)
  | { kind: 'Control Undead finds no hero in the province'; provinceName: string }
  | { kind: "Control Undead cannot be turned on the realm's own heroes" }
  | ({ kind: "Control Undead finds no undead among a hero's forces"; targetName: string } & ACaster)
  | ({
      kind: 'Control Undead wrests a company from a hero';
      /** The company's name, else its type. */
      unitName: string;
      targetName: string;
      provinceName: string;
    } & ACaster)
  | ({
      kind: 'onlookers see Control Undead wrest a company from a hero';
      realmName: string | null;
      unitName: string;
      targetName: string;
      targetsRealmName: string | null;
      provinceName: string;
    } & ACaster)
  | ({
      kind: 'a hero learns Control Undead wrested a company from him';
      realmName: string | null;
      unitName: string;
      targetName: string;
      provinceName: string;
    } & ACaster)
  | ({ kind: 'Skeletal Armies finds no dead to answer'; provinceName: string } & ACaster)
  | ({
      kind: 'a skeletal company rises from the graves';
      /** The company's name, quality and type, as the unit holds them. */
      unitName: string;
      quality: string;
      unitType: string;
      provinceName: string;
    } & ACaster)
  | { kind: 'Curse finds no hero in the province'; provinceName: string }
  | { kind: "Curse cannot be turned on the realm's own heroes" }
  | { kind: 'a hero has no skills to curse'; targetName: string }
  | ({
      kind: "a Curse halves a hero's skills";
      targetName: string;
      /** Each skill halved, copied as the line is told. */
      skills: ASkillACurseHalves[];
    } & ACaster)
  | ({ kind: 'a hero learns a Curse settles over him'; targetName: string; skills: ASkillACurseHalves[] } & ACaster)
  | ({ kind: 'Plague is cast beyond its reach' } & ACaster)
  | { kind: 'a province is already stricken with plague this turn'; provinceName: string }
  | ({ kind: 'a Plague strikes a province'; provinceName: string; tested: number; affected: number } & ACaster)
  | { kind: 'a realm learns an enemy Plague struck its province'; provinceName: string; affected: number }
  // ── The mastery spells ──
  | ({ kind: 'Sanctuary is cast beyond its reach' } & ACaster)
  | ({ kind: 'a Sanctuary is raised over a province'; provinceName: string } & ACaster)
  | ({
      kind: 'a realm learns a Sanctuary was raised over its province';
      castersRealmName: string | null;
      provinceName: string;
    } & ACaster)
  | { kind: 'Divine Judgment finds no enemy hero in the province'; provinceName: string }
  | { kind: "Divine Judgment cannot be turned on the realm's own heroes" }
  | ({ kind: 'Divine Judgment falls on a hero'; targetName: string; damage: number; unitsSmitten: number } & ACaster)
  | ({
      kind: 'a hero learns Divine Judgment fell on him';
      targetName: string;
      damage: number;
      unitsSmitten: number;
    } & ACaster)
  | { kind: 'Mass Confusion finds no enemy hero in the province'; provinceName: string }
  | { kind: "Mass Confusion cannot be turned on the realm's own heroes" }
  | ({ kind: "Mass Confusion is sown through a hero's ranks"; targetName: string } & ACaster)
  | ({ kind: 'a hero learns Mass Confusion grips him'; targetName: string } & ACaster)
  | { kind: 'Dominate finds no enemy hero in the province'; provinceName: string }
  | { kind: "Dominate cannot be turned on the realm's own heroes" }
  | ({ kind: 'Dominate finds no troops to turn'; targetName: string } & ACaster)
  | ({
      kind: "Dominate turns a hero's companies";
      targetName: string;
      provinceName: string;
      seized: number;
    } & ACaster)
  | ({
      kind: "onlookers see Dominate turn a hero's companies";
      realmName: string | null;
      targetName: string;
      targetsRealmName: string | null;
      provinceName: string;
      seized: number;
    } & ACaster)
  | ({
      kind: 'a hero learns Dominate turned his companies';
      realmName: string | null;
      targetName: string;
      provinceName: string;
      seized: number;
    } & ACaster)
  | ({ kind: 'Phantom Host finds no beasts to duplicate' } & ACaster)
  | ({ kind: 'Phantom Host conjures duplicates of beasts'; duplicates: number } & ACaster)
  | ({ kind: 'Invisibility holds'; chance: number; roll: number } & ACaster)
  | ({ kind: 'Invisibility fails to hold'; chance: number; roll: number } & ACaster)
  | ({ kind: 'a Veil of illusion is drawn over a host' } & ACaster)
  | { kind: 'Chain Lightning finds no enemy hero in the province'; provinceName: string }
  | { kind: "Chain Lightning cannot be turned on the realm's own heroes" }
  | { kind: 'Chain Lightning finds no troops to strike'; targetName: string }
  | ({ kind: 'Chain Lightning earths out among a handful of troops'; targetName: string } & ACaster)
  | ({
      kind: "Chain Lightning arcs through a hero's ranks";
      targetName: string;
      caught: number;
      killed: number;
    } & ACaster)
  | ({ kind: 'a hero learns Chain Lightning tore through his ranks'; targetName: string; killed: number } & ACaster)
  | ({ kind: 'Cataclysm is cast beyond its reach' } & ACaster)
  | ({ kind: 'a Cataclysm devastates a province'; provinceName: string; destroyed: number } & ACaster)
  | { kind: 'a realm learns an enemy Cataclysm devastated its province'; provinceName: string; destroyed: number }
  | ({ kind: 'Raise Wraiths finds no dead to answer'; provinceName: string } & ACaster)
  | ({
      kind: 'the dead are bound into Wraiths';
      provinceName: string;
      /** The Wraiths' name, as the unit holds it. */
      unitName: string;
    } & ACaster)
  | ({
      kind: 'onlookers see the dead bound into Wraiths';
      realmName: string | null;
      provinceName: string;
      unitName: string;
    } & ACaster)
  | ({ kind: "Death's Dominion finds no fallen army to raise"; provinceName: string } & ACaster)
  | ({
      kind: "Death's Dominion raises skeletal companies from the graves";
      provinceName: string;
      raised: number;
    } & ACaster);

/** Each kind's audience: its event's (Decision 6), as written at its place in the order's file. */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_CAST_SPELL_ORDERS_LINE: Readonly<
  Record<TheFactOfTheCastSpellOrdersLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'an enchanted hero may turn on his enchanter': "its event's",
  'an enchanted hero rounds on his enchanter but one of them slips away': "its event's",
  'an enchanted hero rounds on his enchanter and blades are drawn': "its event's",
  'a hero names a spell there is none of': "its event's",
  'a spell cannot be worked as a phase order': "its event's",
  "a charmed hero will not turn a spell on his own lord's people": "its event's",
  "a school's casting limit blocks a spell": "its event's",
  'a hero lacks the skill a spell needs after a practice that did not raise it': "its event's",
  'an item can no longer work a mastery spell': "its event's",
  'a hero has not yet reached the level a mastery spell demands': "its event's",
  'a mastery spell is worked but once a turn': "its event's",
  "a spell's mark has gone from the province": "its event's",
  'a hero invokes an item to work a spell': "its event's",
  "a spell's cast is rolled": "its event's",
  'a spell fizzles without effect': "its event's",
  "a spell's mark has vanished": "its event's",
  "a spell's mark is veiled from hostile magic": "its event's",
  "a spell's mark is cloaked from hostile magic": "its event's",
  'Resurrect finds no fallen hero known to lie in the province': "its event's",
  "a fallen monarch's crown answers only to its own realm": "its event's",
  "a fallen monarch's spirit has passed beyond recall": "its event's",
  'a fallen king cannot be resurrected': "its event's",
  'a fallen hero sworn to another crown will not answer': "its event's",
  'a fallen hero has already been raised this turn': "its event's",
  "a fallen hero's spirit cannot be found": "its event's",
  'kings cannot be resurrected': "its event's",
  'a reigning monarch steps down as the fallen monarch is restored': "its event's",
  'a fallen monarch rises and reclaims the throne': "its event's",
  'a fallen hero rises to serve the realm': "its event's",
  'a hero takes up the orders his realm laid down for him': "its event's",
  'Part Sea is cast beyond its reach': "its event's",
  'the waters of a province draw back': "its event's",
  'a realm learns the sea was parted at its province': "its event's",
  'Part Sea finds no sea to part': "its event's",
  'the Holy Symbol finds no dead to cleanse': "its event's",
  'the Holy Symbol cleanses the graves of a province': "its event's",
  'onlookers see a Holy Symbol cleanse the graves of a province': "its event's",
  'Bless Province is cast beyond its reach': "its event's",
  'a province is already blessed this turn': "its event's",
  'a province is blessed and warded': "its event's",
  'Charm finds no hero to sway in the province': "its event's",
  "Charm cannot be used on the realm's own heroes": "its event's",
  'Charm cannot sway a king': "its event's",
  'a Charm slides off a mind lately swayed': "its event's",
  "a mind's resistance to a Charm is rolled": "its event's",
  'a Charm breaks against a mind swayed before': "its event's",
  'a hero throws off an enchantment': "its event's",
  "an enchanter reads a charmed hero's mind": "its event's",
  'a Charm finds no living mind to sway': "its event's",
  'a Charm cannot grip a hero leading troops': "its event's",
  'a Charm finds a hero just dismissed unmoved': "its event's",
  "a Charm cannot sway a soul across the alignments' gulf": "its event's",
  'a Charm sways a wandering hero into service': "its event's",
  'a Charm seizes an enemy hero until the season turns': "its event's",
  'a realm learns its hero is ensorcelled by an enemy Charm': "its event's",
  "Oratory cannot stir another realm's troops": "its event's",
  'Oratory lifts the troops a hero leads': "its event's",
  'Clairvoyance finds its mark dead': "its event's",
  'Clairvoyance needs a hero to watch': "its event's",
  'Clairvoyance cannot fix on a mind that serves no crown': "its event's",
  "Clairvoyance opens the mind's eye upon a hero": "its event's",
  'Psychic Blast finds no hero in the province': "its event's",
  "Psychic Blast cannot be turned on the realm's own heroes": "its event's",
  'a Psychic Blast finds no trained skills left to lose': "its event's",
  "a Psychic Blast takes a hero's skills": "its event's",
  'a hero reels from a Psychic Blast': "its event's",
  "a hero's lost skill lowers his wage": "its event's",
  'Telekinetic Storm finds no hero in the province': "its event's",
  "Telekinetic Storm cannot be turned on the realm's own heroes": "its event's",
  'a Telekinetic Storm finds no armies to scatter': "its event's",
  "a Telekinetic Storm hurls a hero's troops about": "its event's",
  "a hero's formations are scattered by a Telekinetic Storm": "its event's",
  'Illusory Terrain is cast beyond its reach': "its event's",
  'Illusory Terrain cloaks a province': "its event's",
  'Phantasmal Armies is cast on a hero beyond its reach': "its event's",
  'Phantasmal Armies finds no humanoid armies to duplicate': "its event's",
  'Phantasmal Armies conjures duplicates of humanoid armies': "its event's",
  'Hide Lairs is cast beyond its reach': "its event's",
  'Hide Lairs finds no lairs left to hide': "its event's",
  "Hide Lairs veils a province's lairs": "its event's",
  'Earthquake is cast beyond its reach': "its event's",
  'an Earthquake rends a province': "its event's",
  'a realm learns an enemy Earthquake tore through its province': "its event's",
  'Flood is cast beyond its reach': "its event's",
  'Flood is cast on the sea': "its event's",
  'a Flood swallows a province': "its event's",
  'a realm learns an enemy Flood swallowed its province': "its event's",
  'a hero has already summoned an elemental this turn': "its event's",
  'an elemental surges forth from a rift': "its event's",
  'onlookers see an elemental surge forth from a rift': "its event's",
  'Control Undead senses no dead in the province': "its event's",
  'Control Undead senses the dead of the province': "its event's",
  'the sending finds battlefield graves in the provinces around': "its event's",
  'the sending finds the provinces around quiet': "its event's",
  'Control Undead finds no hero in the province': "its event's",
  "Control Undead cannot be turned on the realm's own heroes": "its event's",
  "Control Undead finds no undead among a hero's forces": "its event's",
  'Control Undead wrests a company from a hero': "its event's",
  'onlookers see Control Undead wrest a company from a hero': "its event's",
  'a hero learns Control Undead wrested a company from him': "its event's",
  'Skeletal Armies finds no dead to answer': "its event's",
  'a skeletal company rises from the graves': "its event's",
  'Curse finds no hero in the province': "its event's",
  "Curse cannot be turned on the realm's own heroes": "its event's",
  'a hero has no skills to curse': "its event's",
  "a Curse halves a hero's skills": "its event's",
  'a hero learns a Curse settles over him': "its event's",
  'Plague is cast beyond its reach': "its event's",
  'a province is already stricken with plague this turn': "its event's",
  'a Plague strikes a province': "its event's",
  'a realm learns an enemy Plague struck its province': "its event's",
  'Sanctuary is cast beyond its reach': "its event's",
  'a Sanctuary is raised over a province': "its event's",
  'a realm learns a Sanctuary was raised over its province': "its event's",
  'Divine Judgment finds no enemy hero in the province': "its event's",
  "Divine Judgment cannot be turned on the realm's own heroes": "its event's",
  'Divine Judgment falls on a hero': "its event's",
  'a hero learns Divine Judgment fell on him': "its event's",
  'Mass Confusion finds no enemy hero in the province': "its event's",
  "Mass Confusion cannot be turned on the realm's own heroes": "its event's",
  "Mass Confusion is sown through a hero's ranks": "its event's",
  'a hero learns Mass Confusion grips him': "its event's",
  'Dominate finds no enemy hero in the province': "its event's",
  "Dominate cannot be turned on the realm's own heroes": "its event's",
  'Dominate finds no troops to turn': "its event's",
  "Dominate turns a hero's companies": "its event's",
  "onlookers see Dominate turn a hero's companies": "its event's",
  'a hero learns Dominate turned his companies': "its event's",
  'Phantom Host finds no beasts to duplicate': "its event's",
  'Phantom Host conjures duplicates of beasts': "its event's",
  'Invisibility holds': "its event's",
  'Invisibility fails to hold': "its event's",
  'a Veil of illusion is drawn over a host': "its event's",
  'Chain Lightning finds no enemy hero in the province': "its event's",
  "Chain Lightning cannot be turned on the realm's own heroes": "its event's",
  'Chain Lightning finds no troops to strike': "its event's",
  'Chain Lightning earths out among a handful of troops': "its event's",
  "Chain Lightning arcs through a hero's ranks": "its event's",
  'a hero learns Chain Lightning tore through his ranks': "its event's",
  'Cataclysm is cast beyond its reach': "its event's",
  'a Cataclysm devastates a province': "its event's",
  'a realm learns an enemy Cataclysm devastated its province': "its event's",
  'Raise Wraiths finds no dead to answer': "its event's",
  'the dead are bound into Wraiths': "its event's",
  'onlookers see the dead bound into Wraiths': "its event's",
  "Death's Dominion finds no fallen army to raise": "its event's",
  "Death's Dominion raises skeletal companies from the graves": "its event's",
};
