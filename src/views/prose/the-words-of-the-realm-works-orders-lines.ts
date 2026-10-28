// ── THE WORDS OF THE REALM WORKS ORDERS' LINES (plan P1-12d7: P1-12's Decisions of 2026-10-26, Decisions 6 and 7) ──
// The views write the words of each fact the realm works orders' lines record (src/engine/orders/the-facts-the-realm-
// works-orders-lines-record.ts), in the same words the engine wrote before (orders/realm-works-orders-consecration-
// muster-broker-the-wild-and-grand-design.ts): a realm's tag after its hero's name (realmTag, turn/log-line-helpers.ts)
// and where a Wild Calling tore its beasts from (_wcHeard) are written as the engine wrote them there. A kind with no
// words here is a compile error (the `never` below).
import type {
  TheFactOfTheRealmWorksOrdersLine,
  WhereAWildCallingToreBeastsFrom,
} from '../../engine/orders/the-facts-the-realm-works-orders-lines-record.ts';

/** A realm's tag after its hero's name, as realmTag wrote it: " (Westmarch)", or nothing for no realm (the Cast Spell
 *  order's prose writes it too). */
export function theRealmsTag(realmName: string | null): string {
  return realmName !== null ? ` (${realmName})` : '';
}

/** Where a Wild Calling tore beasts from, as the line names it. */
function whereAWildCallingToreBeastsFrom(from: WhereAWildCallingToreBeastsFrom): string {
  switch (from.kind) {
    case 'the garrison of a province':
      return `the garrison of ${from.provinceName}`;
    case "a hero's host":
      return from.heroName;
  }
}

/** The words of one fact of the realm works orders' lines. */
export function theWordsOfTheRealmWorksOrdersLine(fact: TheFactOfTheRealmWorksOrdersLine): string {
  switch (fact.kind) {
    case 'only the king can consecrate ground':
      return `${fact.heroName} may pray, but only the anointed King can consecrate ground — the rite belongs to the crown alone.`;
    case 'the gods answer a consecration only from a Divine crown':
      return `${fact.heroName} kneels and prays, but the gods answer only Divine crowns — Consecration is not for this realm.`;
    case 'only a province of the realm can be consecrated':
      return `${fact.heroName}: only a province of your own realm can be consecrated — take and hold this land first.`;
    case 'the home marches were anointed at the coronation':
      return `${fact.heroName}: the crown's own hearth was anointed at the coronation — its grace already shelters the throne and the lands in its shadow. The gods charge their servants to carry the light OUTWARD: consecrate a province beyond the home marches.`;
    case 'the province is already consecrated':
      return `${fact.provinceName} is already consecrated — the ground is holy and needs no second blessing.`;
    case 'two consecrated provinces may not lie side by side':
      return `${fact.heroName}: ${fact.provinceName} borders ${fact.neighbourName ?? 'already-hallowed ground'} — two consecrated provinces may not lie side by side. Carry the light to ground set apart from your other holy lands.`;
    case 'consecration flows from the White arts':
      return `${fact.heroName}: consecration flows from the White arts — learn White magic before you can sanctify ground.`;
    case 'the White faith can sustain no more consecrated provinces':
      return `${fact.heroName}: your White faith can sustain only ${String(fact.limit)} consecrated province${fact.limit !== 1 ? 's' : ''} at once (${fact.consecratedNames.join(', ') || '—'}). One must be lost or captured before you can hallow ${fact.provinceName}. (Raise your White skill to consecrate more.)`;
    case 'a king consecrates a province':
      return `✨ ${fact.heroName} consecrates ${fact.provinceName}! Holy ground: +50% tax, defenders twice as likely to fight with fanatical zeal, Undead and Evil invaders fight at −15%, and your fallen can be restored only here — they rise in the nearest consecrated province, which then gives up its consecration. If it is captured the consecration breaks at once and the conquerors are emboldened. (${String(fact.consecrated)}/${String(fact.limit)} consecrated — set by your White skill; a consecrated province that is captured frees a slot.)`;
    case "only a Good realm's folk answer a Call to Arms":
      return `${fact.heroName}'s call goes unanswered — only the folk of a Good realm rise for their king unpaid.`;
    case "only the king's voice carries the Call to Arms":
      return `${fact.heroName}: only the KING's voice carries the Call to Arms.`;
    case 'the realm has already answered a Call to Arms this turn':
      return `${fact.heroName}: the realm has already answered one Call to Arms this turn — the folk cannot muster twice in a season.`;
    case 'a Call to Arms must name a province of the realm':
      return `${fact.heroName}: Call to Arms must name a province you control this phase.`;
    case 'only the folk of settled land answer a Call to Arms':
      return `${fact.heroName}: only the humanoid folk of settled land answer a Call to Arms — ${fact.provinceName} has no villages to raise.`;
    case 'the folk answer a Call to Arms':
      return `📯 Call to Arms! The folk of ${fact.provinceName} answer their king — ${fact.quality === 'Green' ? 'a Green' : 'an ' + fact.quality} ${fact.unitType} joins the province garrison, free of wages this muster. (Once per turn.)`;
    case 'only a Neutral crown keeps brokers':
      return `${fact.heroName}: only a Neutral crown keeps the web of factors and go-betweens that Brokering requires.`;
    case "only the king commands the realm's brokers":
      return `${fact.heroName}: only the KING commands the realm's brokers.`;
    case 'the brokers find no such hero within reach':
      return `${fact.heroName}'s brokers find no such hero within reach of the realm's agents.`;
    case 'a hero will not treat with the brokers across the alignment gulf':
      return `${fact.heroName} will not treat with your brokers — the alignment gulf is too wide.`;
    case 'a king cannot afford a brokered hero':
      return `${fact.heroName} cannot afford ${fact.wantedName} — needs ${String(fact.wage)}g/turn.`;
    case "a wandering hero accepts the realm's terms by courier": {
      const _bActs = `They may act from ${fact.seasonName ?? 'next turn'} onwards, from where they stand.`;
      return `🤝 Brokered: ${fact.heroName} (${fact.race}, ${fact.alignment}) in ${fact.provinceName} accepts ${fact.realmName}'s terms by courier — ${String(fact.wage)}g/turn. ${_bActs}`;
    }
    case 'the brokers reach only provinces the realm has seen':
      return `${fact.heroName}: your brokers can only reach provinces the realm has seen.`;
    case 'the treasury cannot pay for brokered word':
      return `${fact.heroName}: brokered intelligence costs 2g — the treasury cannot cover it.`;
    case 'the brokers buy word from a province':
      return `🤝 ${fact.heroName}'s brokers buy word from ${fact.provinceName} (2g).`;
    case 'a Broker order names no target':
      return `${fact.heroName}: Broker requires a target — a hero to hire or a province to buy word from.`;
    case 'the orders that called beasts are no more': {
      const _gone = fact.itWasCallFromThePit ? 'Call from the Pit' : 'Awaken the Wild';
      return `${fact.heroName}: ${_gone} is no more — Creatures and Monsters now come only by recruiting them where they live.`;
    }
    case 'only Undead realms keep corpse-carters':
      return `${fact.heroName} has neither the craft nor the stomach for grave-harvesting — only Undead realms keep corpse-carters.`;
    case 'no battlefield dead lie here to raise':
      return `${fact.heroName} walks the field of ${fact.provinceName}, but there are no battlefield dead here to raise.`;
    case 'the treasury cannot pay the corpse-carters':
      return `${fact.heroName}: the corpse-carters and grave-wights want their ${String(fact.cost)}g — the treasury cannot pay.`;
    case 'the corpse-carters raise a skeletal company':
      return `💀 Harvest the Field — ${fact.heroName}'s carters work the graves of ${fact.provinceName}: ${fact.unitName} (${fact.quality}) rises to serve, no magic required. (${String(fact.cost)}g; upkeep 1g/turn.)`;
    case 'a raiser with no Necromancy is warned his dead will crumble':
      return `⚠ ${fact.heroName} has no Necromancy of their own — ${fact.unitName} will crumble to dust at the end of this turn unless it is handed to a character with at least Necromancy 1. The dead do not stand without a master, and a garrison is no master at all.`;
    case 'a hero lacks the Druid mastery to Awaken a Grove':
      return `${fact.heroName} lacks the Druid mastery (7) to Awaken a Grove.`;
    case 'Awaken Grove works only in an owned forest, jungle or wild province':
      return `${fact.heroName}: Awaken Grove works only while standing in an OWNED forest, jungle or wild (Creature or Monster) province.`;
    case 'a druid awakens the grove':
      return `🌳 ${fact.heroName} awakens the grove of ${fact.provinceName} — Forest Ents tear their roots from the earth to march under your banner until the turn's end.`;
    case 'onlookers see a druid awaken the grove':
      return `🌳 ${fact.heroName}${theRealmsTag(fact.realmName)} awakens the grove of ${fact.provinceName} — Forest Ents tear their roots from the earth to march under their banner until the turn's end.`;
    case 'a hero lacks the Druid mastery to sound a Wild Calling':
      return `${fact.heroName} lacks the Druid mastery (9) to sound a Wild Calling.`;
    case "the beasts of a hero's host answer a Wild Calling":
      return `🐾 The beasts of ${fact.heroName}'s host break their bonds and answer a Wild Calling in ${fact.provinceName} — ${String(fact.lost)} unit${fact.lost !== 1 ? 's' : ''} lost.`;
    case 'nothing wild stands here to answer a Wild Calling':
      return `${fact.heroName} sounds a Wild Calling, but nothing wild stands in ${fact.provinceName} to answer it.`;
    case 'not one wild creature breaks for a Wild Calling':
      return `🐾 ${fact.heroName} sounds a Wild Calling over ${String(fact.called)} wild creature${fact.called !== 1 ? 's' : ''} in ${fact.provinceName} — not one of them breaks for the call.`;
    case 'wild creatures answer a Wild Calling': {
      const _wcFrom = fact.tornFrom.length
        ? ` (torn from ${fact.tornFrom.map(whereAWildCallingToreBeastsFrom).join(' and ')})`
        : '';
      return `🐾 ${fact.heroName} sounds a Wild Calling in ${fact.provinceName} — ${String(fact.won)} of ${String(fact.called)} wild creature${fact.called !== 1 ? 's' : ''} answer and fall in behind your banner${_wcFrom}!`;
    }
    case 'onlookers see wild creatures answer a Wild Calling':
      return `🐾 ${fact.heroName}${theRealmsTag(fact.realmName)} sounds a Wild Calling in ${fact.provinceName} — ${String(fact.won)} wild creature${fact.won !== 1 ? 's' : ''} answer and fall in behind their banner.`;
    case 'a hero lacks the Sage mastery to realise a Grand Design':
      return `${fact.heroName} lacks the Sage mastery (9) to realise a Grand Design.`;
    case 'the realm has already completed its Grand Design':
      return `${fact.realmName} has already completed its Grand Design — there can be only one.`;
    case "a hero completes the realm's Grand Design":
      return `🏗 ${fact.heroName} completes ${fact.realmName}'s Grand Design — the ${fact.wonderName}, a Wonder of the age, raised in ${fact.provinceName}! ${fact.wonderDescription} Its blessings last only while ${fact.realmName} holds ${fact.provinceName} — lose the province and they lapse; retake it and they return.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the realm works orders' lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
