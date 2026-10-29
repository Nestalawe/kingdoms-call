// ── THE WORDS OF THE TITLE INTELLIGENCE LINES (plan P1-12d13: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact the title intelligence lines record (src/engine/titles/the-facts-the-title-
// intelligence-lines-record.ts), in the same words the engine wrote before (titles/title-intel-for-each-holder-and-the-
// titles-won-and-lost-this-turn.ts). Each line opens with its title's bracketed name ("[The Throne] "): the player page
// groups the title lines by it (TITLE_INTEL_RE, src/ui/player/join-and-chronicle.ts), from the words stored. A realm
// with no name is "Player N" by its seat, a province with none "unknown"; a skill's label comes from SKILL_LABELS
// (else its slug), a school's from the Archmage's own table. A kind with no words here is a compile error (the `never`
// below).
import type {
  ARealmATitlesLineNames,
  ASchoolTheArchmageReads,
  ATitleThatCountsTheRealmsNotMet,
  AStrongestForceATitlesLineNames,
  TheFactOfATitleIntelligenceLine,
} from '../../engine/titles/the-facts-the-title-intelligence-lines-record.ts';
import { SKILL_LABELS } from '../../engine/army-tables.ts';
import { theWordsInATableFor } from './the-words-of-the-order-dispatchs-lines.ts';

/** Each title's name, as its lines open with it in brackets. */
const THE_NAME_OF_EACH_TITLE_THAT_COUNTS_THE_REALMS_NOT_MET: Readonly<Record<ATitleThatCountsTheRealmsNotMet, string>> =
  {
    throne: 'The Throne',
    vault: 'The Vaultkeeper',
    marshal: 'The Grand Marshal',
    sea: 'The Sea Lord',
    monster: 'The Monster-Bane',
    lore: 'The Loremaster',
    arch: 'The Archmage',
    carto: 'The Cartographer',
    beast: 'The Beastlord',
    wild: 'The Wildwarden',
  };

/** Each school's name, as the Archmage's lines write it. */
const THE_NAME_OF_EACH_SCHOOL_THE_ARCHMAGE_READS: Readonly<Record<ASchoolTheArchmageReads, string>> = {
  white: 'White',
  psychic: 'Psychic',
  illusory: 'Illusory',
  elemental: 'Elemental',
  necromancy: 'Necromancy',
};

/** A realm's name, else "Player N" by its seat. */
function theRealmsName(realm: ARealmATitlesLineNames): string {
  return realm.realmName ?? 'Player ' + String(realm.seat + 1);
}

/** A province's name, else "unknown". */
function theProvincesName(provinceName: string | null): string {
  return provinceName ?? 'unknown';
}

/** "led by Aldric in Highmoor (strength 12)". */
function theForce(force: AStrongestForceATitlesLineNames): string {
  return `led by ${force.commanderName} in ${theProvincesName(force.provinceName)} (strength ${String(force.strength)})`;
}

/** "s" for any count but one. */
function theS(count: number): string {
  return count === 1 ? '' : 's';
}

/** The words of one fact of the title intelligence lines. */
export function theWordsOfATitleIntelligenceLine(fact: TheFactOfATitleIntelligenceLine): string {
  switch (fact.kind) {
    case "a title's holder learns how many realms his crown has not met": {
      const n = fact.count;
      return `[${THE_NAME_OF_EACH_TITLE_THAT_COUNTS_THE_REALMS_NOT_MET[fact.title]}] ${n === 1 ? 'One realm' : `${String(n)} realms`} your crown has not yet met — nothing may be gleaned of ${n === 1 ? 'it' : 'them'} until you do.`;
    }
    case "the Throne's holder learns his realm's share of the world tax base":
      return `[The Throne] Your realm: ${String(fact.percent)}% of the world tax base.`;
    case "the Throne's holder learns a rival's share of the world tax base":
      return `[The Throne] ${theRealmsName(fact.realm)}: ${String(fact.percent)}% of the world tax base.`;
    case "the Vaultkeeper's holder learns his realm's treasury":
      return `[The Vaultkeeper] Your realm: ${String(fact.gold)}g in treasury.`;
    case "the Vaultkeeper's holder learns a rival's treasury":
      return `[The Vaultkeeper] ${theRealmsName(fact.realm)}: ${String(fact.gold)}g in treasury.`;
    case "the Grand Marshal's holder learns his realm's strongest land army":
      return `[The Grand Marshal] Your realm: ${fact.army ? `strongest land army ${theForce(fact.army)}` : 'no land army in the field'}.`;
    case "the Grand Marshal's holder learns a rival's strongest land army":
      return `[The Grand Marshal] ${theRealmsName(fact.realm)}: strongest land army ${theForce(fact.army)}.`;
    case "the Grand Marshal's holder learns no rival fields a land army":
      return `[The Grand Marshal] No rival fields a land army this turn.`;
    case "the Sea Lord's holder learns his realm's strongest fleet":
      return `[The Sea Lord] Your realm: ${fact.fleet ? `strongest fleet ${theForce(fact.fleet)}` : 'no fleet at sea'}.`;
    case "the Sea Lord's holder learns a rival's strongest fleet":
      return `[The Sea Lord] ${theRealmsName(fact.realm)}: strongest fleet ${theForce(fact.fleet)}.`;
    case "the Sea Lord's holder learns no rival fields a fleet":
      return `[The Sea Lord] No rival fields a fleet this turn.`;
    case "the Monster-Bane's holder learns his realm's champion": {
      const own = fact.champion;
      return `[The Monster-Bane] Your champion: ${own ? `${own.heroName} in ${theProvincesName(own.provinceName)} with ${String(own.monsterBlood)} monster-blood to their name` : 'no hero of yours has drawn monster-blood'}.`;
    }
    case "the Monster-Bane's holder learns a rival's champion":
      return `[The Monster-Bane] ${theRealmsName(fact.realm)}: ${fact.champion.heroName} in ${theProvincesName(fact.champion.provinceName)} — ${String(fact.champion.monsterBlood)} monster-blood.`;
    case "the Monster-Bane's holder learns no rival's hero has drawn monster-blood":
      return `[The Monster-Bane] No rival realm has a hero who has drawn monster-blood worth noting.`;
    case "the Loremaster's holder learns a rival's discoveries": {
      const n = fact.discoveries.length;
      return `[The Loremaster] ${theRealmsName(fact.realm)} holds ${String(n)} discover${n === 1 ? 'y' : 'ies'}: ${fact.discoveries.join(', ')}.`;
    }
    case "the Loremaster's holder learns a rival holds no discoveries":
      return `[The Loremaster] ${theRealmsName(fact.realm)} holds no discoveries at all.`;
    case "the Loremaster's holder learns no rival has learned anything worth copying":
      return `[The Loremaster] No rival realm has yet learned anything worth copying.`;
    case "the Loremaster's scholars copy a rival's fresh discovery":
      return `[The Loremaster] Your scholars copy ${fact.discoveryName} from a rival's fresh notes — you now hold this discovery.`;
    case "the Archmage's holder learns a school's foremost mage outside his realm": {
      const mage = `${fact.heroName} (Level ${String(fact.level)})`;
      const where = theProvincesName(fact.provinceName);
      return `[The Archmage] ${THE_NAME_OF_EACH_SCHOOL_THE_ARCHMAGE_READS[fact.school]}: ${fact.realm ? `${mage} of ${theRealmsName(fact.realm)} in ${where}` : `${mage}, an independent hero guarding ${where}`}.`;
    }
    case "the Archmage's holder learns of no mage of a school outside his realm":
      return `[The Archmage] ${THE_NAME_OF_EACH_SCHOOL_THE_ARCHMAGE_READS[fact.school]}: no mage of note outside your own realm.`;
    case "the Hierophant's holder hears what a fallen hero knew": {
      const skills =
        fact.skills
          .map((s) => `${theWordsInATableFor(SKILL_LABELS, s.skill) ?? s.skill} ${String(s.level)}`)
          .join(', ') || 'no skills the grave remembers';
      return `[The Hierophant] The dead speak: ${fact.heroName}${fact.realm ? ` of ${theRealmsName(fact.realm)}` : ''}${fact.isKing ? ', a king,' : ''} lying in ${theProvincesName(fact.provinceName)} — ${skills}.`;
    }
    case "the Hierophant's holder finds no fallen hero to read":
      return `[The Hierophant] No fallen hero lies where your priests can read them this turn.`;
    case "the Deathpriest's Grave-sight finds crack and elite dead in a province":
      return `[The Deathpriest] Grave-sight: ${theProvincesName(fact.provinceName)} holds ${String(fact.count)} crack/elite dead. (Filed under Graveyards Known.)`;
    case "the Deathpriest's Grave-sight finds no crack or elite dead":
      return `[The Deathpriest] Grave-sight finds no crack or elite dead lying unclaimed this turn.`;
    case "the Spymaster's holder learns of an act of espionage against his lands": {
      const agent = `${fact.agentIsKing ? '♛ ' : ''}${fact.agentName ?? 'an unknown agent'}${fact.agentsRealm ? ` of ${theRealmsName(fact.agentsRealm)}` : ', unsworn to any crown'}`;
      return `[The Spymaster] ${agent} ${fact.whatTheAgentDid} in ${theProvincesName(fact.provinceName)}.`;
    }
    case "the Spymaster's holder learns who intruded into his lands this turn": {
      const roll = fact.heroes.map(
        (r) =>
          `${r.heroName ?? '?'}${r.realm ? ` (${theRealmsName(r.realm)})` : ''}${r.times > 1 ? ` ×${String(r.times)}` : ''}`,
      );
      const heroes = fact.heroes.length;
      return `[The Spymaster] ${String(fact.intrusions)} intrusion${theS(fact.intrusions)} into your lands this turn by ${String(heroes)} hero${heroes === 1 ? '' : 'es'}: ${roll.join(', ')}.`;
    }
    case "the Spymaster's holder learns no hand was raised against his lands":
      return `[The Spymaster] Your counter-intelligence reports a quiet turn — no hand was raised against your lands.`;
    case "the Cartographer's holder learns his realm's atlas":
      return `[The Cartographer] Your atlas: ${String(fact.fullyCharted)} province${theS(fact.fullyCharted)} fully charted, ${String(fact.percentMapped)}% of the world mapped.`;
    case "the Cartographer's holder learns a rival's atlas":
      return `[The Cartographer] ${theRealmsName(fact.realm)}: ${String(fact.fullyCharted)} province${theS(fact.fullyCharted)} fully charted, ${String(fact.percentMapped)}% of the world mapped.`;
    case "the Cartographer's holder finds no rival realm to survey":
      return `[The Cartographer] No rival realm remains to survey.`;
    case "the Beastlord's holder learns a realm has no monsters under arms":
      return `[The Beastlord] ${fact.realm ? theRealmsName(fact.realm) : 'Your realm'}: no monsters under arms.`;
    case "the Beastlord's holder learns a realm's monsters under arms": {
      const host = fact.largestHost;
      return `[The Beastlord] ${fact.realm ? theRealmsName(fact.realm) : 'Your realm'}: ${String(fact.units)} monster unit${theS(fact.units)} under arms${host ? `, the largest host — ${String(host.units)} — with ${host.heroName} in ${theProvincesName(host.provinceName)}` : ' (all of them garrisoned)'}.`;
    }
    case "the Beastlord's holder finds no rival realm to reckon":
      return `[The Beastlord] No rival realm remains to reckon.`;
    case "the Wildwarden's holder learns the wild answers to no one in a realm":
      return `[The Wildwarden] ${fact.realm ? theRealmsName(fact.realm) : 'Your realm'}: the wild answers to no one here.`;
    case "the Wildwarden's holder learns a realm's creatures in the field": {
      const host = fact.largestHost;
      return `[The Wildwarden] ${fact.realm ? theRealmsName(fact.realm) : 'Your realm'}: ${String(fact.units)} creature unit${theS(fact.units)} in the field${host ? `, the greatest host — ${String(host.units)} — with ${host.heroName} in ${theProvincesName(host.provinceName)}` : ' (all of them garrisoned)'}.`;
    }
    case "the Wildwarden's holder finds no rival realm to reckon":
      return `[The Wildwarden] No rival realm remains to reckon.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the title intelligence lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
