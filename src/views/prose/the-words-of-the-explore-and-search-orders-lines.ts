// ── THE WORDS OF THE EXPLORE AND SEARCH ORDERS' LINES (plan P1-12d8: P1-12's Decisions of 2026-10-26, Decisions 6 and
// 7) ──
// The views write the words of each fact the explore and search orders' lines record (src/engine/orders/the-facts-the-
// explore-and-search-orders-lines-record.ts), in the same words the engine wrote before (orders/explore-and-search-
// orders-maps-lairs-rites-and-rumours.ts). fmtRoll, a guardian's kind (monsterCatLabel), the odds' bands
// (rumourOddsBand), a list of items (itemNameList) and their lore (itemLoreLines) are the engine's, on the values a
// fact holds. A kind with no words here is a compile error (the `never` below).
import type {
  ASiteFoundAsTheLineNamesIt,
  TheFactOfTheExploreAndSearchOrdersLine,
} from '../../engine/orders/the-facts-the-explore-and-search-orders-lines-record.ts';
import { fmtRoll } from '../../engine/dice-and-army-names.ts';
import { itemNameList } from '../../engine/heroes/fame-and-consecration.ts';
import { itemLoreLines, monsterCatLabel } from '../../engine/items/tiers-and-hoards.ts';
import { rumourOddsBand } from '../../engine/personal-combat/lair-guardians-and-the-odds.ts';

/** A guardian's name with its article: "a Barrow Wight", "an Ogre", a plural as it is, "a creature" for none. */
function _art(n: string | null): string {
  if (!n) return 'a creature';
  if (n.endsWith('s')) return n;
  return (/^[aeiou]/i.test(n) ? 'an ' : 'a ') + n;
}

/** What a site found is: an ancient ritual site, or guarded by its guardian. */
function _rtTail(f: ASiteFoundAsTheLineNamesIt): string {
  return f.isARitualSite
    ? `It is an ancient ritual site of the old gods — no guardian lairs here.`
    : `Legend says it is guarded by ${_art(f.guardianName)}.`;
}

/** The band Hunting Rumours reads a hero's chances in (rumourOddsBand: the last band past the others). */
function theBandOfTheOdds(winPercent: number): { text: (guardianName: string) => string } {
  const band = rumourOddsBand(winPercent);
  if (!band) throw new Error(`no band of the odds for ${String(winPercent)}%`);
  return band;
}

/** The class Discover Lost Ruin names, as its lines say it: the old stones, or "weak lairs". */
function theLairsOfAClass(lairClass: string, ritual: string): string {
  return lairClass === 'Ritual' ? ritual : `${lairClass.toLowerCase()} lairs`;
}

/** The words of one fact of the explore and search orders' lines. */
export function theWordsOfTheExploreAndSearchOrdersLine(fact: TheFactOfTheExploreAndSearchOrdersLine): string {
  switch (fact.kind) {
    case "an Explorer's survey reveals richer land":
      return `⛰ ${fact.heroName}'s keen survey of ${fact.provinceName} reveals richer land — its tax base rises to ${String(fact.tax)}.`;
    case "the Philosopher's Lens shows a hero a hidden site":
      return `🔍 The Philosopher's Lens shows ${fact.heroName} what the ground itself hides — the ${fact.siteName}.`;
    case "a veiling illusion clouds a hero's exploring":
      return `🌫 Something clouds ${fact.heroName}'s exploration of ${fact.provinceName} — a veiling illusion conceals lairs hidden here, and none can be discovered while it holds.`;
    case 'a hero explores a province and discovers a site':
      return `${fact.heroName} explores ${fact.provinceName} (+${String(fact.gain)}%, now ${String(fact.explored)}% mapped) and discovers the ${fact.site.name}! ${_rtTail(fact.site)}`;
    case 'a hero explores a province and uncovers several sites': {
      const frags = fact.sites.map((f) =>
        f.isARitualSite ? `the ${f.name} (a ritual site)` : `the ${f.name} (guarded by ${_art(f.guardianName)})`,
      );
      const list = frags.slice(0, -1).join(', ') + ' and ' + String(frags[frags.length - 1]);
      return `${fact.heroName} explores ${fact.provinceName} (+${String(fact.gain)}%, now ${String(fact.explored)}% mapped) and uncovers ${String(fact.sites.length)} sites: ${list}.`;
    }
    case 'a hero explores a province and finds no new site':
      return `${fact.heroName} explores ${fact.provinceName} (+${String(fact.gain)}%, now ${String(fact.explored)}% mapped). ${fact.explored < 30 ? 'Much of the province remains uncharted.' : fact.explored < 70 ? 'The province is becoming well-known.' : 'The province is thoroughly explored.'}`;
    case 'a hero who does not keep the old faith cannot perform rites':
      return `${fact.heroName} does not keep the old faith — only Pagan realms may perform rites.`;
    case 'a hero finds no ritual site for a rite':
      return `${fact.heroName} finds no ritual site in ${fact.provinceName} — rites need standing stones, and stones must first be found.`;
    case 'the stones have already answered a rite this turn':
      return `${fact.heroName} comes to the ${fact.siteName} in ${fact.provinceName}, but the stones have already answered once this turn — the old gods will hear no second rite here until the turn has passed.`;
    case 'nothing wild answers the Wild Hunt':
      return `${fact.heroName} calls the Wild Hunt at the ${fact.siteName}, but nothing wild answers in ${fact.provinceName} — the rite needs a province where Creatures or Monsters still roam.`;
    case 'a hero cannot afford the Wild Hunt offerings':
      return `${fact.heroName} cannot afford the Wild Hunt offerings (${String(fact.price)}g).`;
    case 'a hero performs the Rite of the Wild Hunt':
      return `\u{1F525} ${fact.heroName} performs the Rite of the Wild Hunt at the ${fact.siteName} (${String(fact.price)}g — the price of a single beast, whatever number answer). The old gods answer: ${fact.beasts.map((b) => `${b.unitName} (${b.type})`).join(' and ')} come down from the wilds to serve as veterans — they draw no wages, and hold until the end of next turn, when the binding fails.`;
    case 'a hero makes no Blood Offering':
      return `${fact.heroName} makes no Blood Offering — name units to sacrifice and an equal number to empower (needs at least two of its own units).`;
    case 'a hero makes a Blood Offering':
      return `\u{1FA78} ${fact.heroName} makes a Blood Offering at the ${fact.siteName} — ${fact.offered.join(', ')} (${String(fact.count)} unit${fact.count !== 1 ? 's' : ''}) are given to the old gods, and their strength passes to ${fact.empowered.map((a) => `${a.name} (rise to ${a.quality})`).join(', ')}.`;
    case 'a hero asks after the lairs of a province but none is known':
      return `${fact.heroName} asks after the lairs of ${fact.provinceName}, but no one has anything to tell — there is no known lair here to ask about.`;
    case 'a hero spends the season hunting rumours of lairs':
      return `🍺 ${fact.heroName} spends the season in the taverns and on the roads of ${fact.provinceName}, hunting rumours of ${String(fact.lairs)} lair${fact.lairs !== 1 ? 's' : ''}.`;
    case "a hero cannot afford a lair's rumours":
      return `  ${fact.heroName} cannot afford the ${String(fact.price)}g the ${fact.siteName}'s rumours would cost (${String(fact.treasury)}g in the treasury) — the rest of the hunt is abandoned.`;
    case "a lair's rumours are bought": {
      const gname = `${fact.guardianName}${monsterCatLabel(fact.guardianKind) ? ` (${monsterCatLabel(fact.guardianKind)})` : ''}`;
      return `  💰 ${String(fact.price)}g buys the talk of the ${fact.siteName} — ${gname}, a ${(fact.grade ?? 'Weak').toLowerCase()} guardian.`;
    }
    case "the rumours tell a guardian's weakness":
      return `  ✓ Its weakness: ${fact.weaknessName} — ${fact.weaknessDesc}.${fact.theRealmMarksItNow ? ' Your realm marks every ' + fact.guardianName + ' with it from now on.' : ''}`;
    case 'the rumours tell a guardian has no weakness':
      return `  ✓ Its weakness: none that anyone knows of — the ${fact.guardianName} has no exploitable flaw.`;
    case "the rumours tell a lair's hoard": {
      const _hi = fact.hoardItems,
        _st = fact.stolenItemNames;
      let itemOut = _hi.length ? `, and ${itemNameList(_hi)}` : '';
      if (!_hi.length)
        itemOut = _st.length
          ? ` — its magic (${_st.join(', ')}) has already been lifted by a thief`
          : ' — no magic lies there';
      else if (_st.length) itemOut += ` (a thief has already made off with ${_st.join(', ')})`;
      const _wield = fact.wieldedItemNames;
      if (_wield.length) itemOut += `. Beware: it wields ${_wield.join(', ')} against all comers`;
      return `  ✓ Its hoard: the ${fact.guardianName} sits on exactly ${String(fact.gold)}g${itemOut}.`;
    }
    case "the rumours tell a hero's chances against a guardian":
      return `  ✓ Your chances: as you stand today, ${theBandOfTheOdds(fact.winPercent).text(fact.guardianName)}.`;
    case 'nobody could say how a hero would fare against a guardian':
      return `  ✓ Your chances: nobody could say how ${fact.heroName} would fare.`;
    case 'a hero searches a province with no sites':
      return `${fact.heroName} searches ${fact.provinceName} but finds nothing of note.`;
    case 'the lair a hero meant to search is not here':
      return `${fact.heroName} looks for the lair they meant to search in ${fact.provinceName}, but it is not here.`;
    case 'a hero walks a ritual site':
      return `${fact.heroName} walks the ${fact.siteName} of ${fact.provinceName}. The old stones hum with something older than realms${fact.isPagan ? ' — a Pagan may Perform Rites here' : ', but they do not answer'}.`;
    case 'a hero revisits a cleared lair':
      return `${fact.heroName} revisits the cleared ${fact.siteName} in ${fact.provinceName}.`;
    case "a guardian drags a fallen hero's possessions into its hoard":
      return `The ${fact.guardianName ?? 'guardian'} drags ${fact.heroName}'s possessions into its hoard — ${fact.itemNames.join(', ')} now lie among the bones, waiting for a stronger hand.`;
    case 'a thief finds a hoard already picked clean':
      return `${fact.heroName} slips past the ${fact.guardianName ?? 'guardian'} of the ${fact.siteName}, but the hoard is already picked clean — nothing left to steal.`;
    case "a thief escapes with gold from a lair's hoard": {
      const _dregs =
        fact.left <= 0
          ? ` They have cleaned out the last of it — the hoard is empty.`
          : ` (~${String(fact.left)}g still hidden here.)`;
      return `${fact.heroName} escapes with ${String(fact.gold)}g lifted from the ${fact.siteName}'s hoard (Thief ${String(fact.thiefLevel)}: ${String(fact.thiefLevel * 10)}% of the original hoard)! The ${fact.guardianName ?? 'guardian'} still guards the site.${_dregs}`;
    }
    case 'a Legendary relic cannot be lifted from a lair':
      return `${fact.heroName} eyes the ${fact.guardianName ?? 'guardian'}'s relic, but a Legendary treasure is not something that can be spirited away — it must be won by defeating its keeper.`;
    case "a thief slips a magic item from a lair's hoard":
      return `🗝 ${fact.heroName} also slips ${fact.isLegendary ? 'the LEGENDARY ' : 'the '}${fact.itemName} (${fact.itemDesc}) out from under the guardian's nose! ${fmtRoll(fact.chance, fact.roll)}`;
    case 'a hero notes how he carries what a lair gave up':
      return fact.gainedItemNote;
    case "a thief cannot get near a hoard's magic":
      return `${fact.heroName} eyes the hoard's magic but cannot get near it. ${fmtRoll(fact.chance, fact.roll)}`;
    case "the realm's lore yields an extra find":
      return `Your realm's lore yields an extra find: the ${fact.itemName}!`;
    case 'the lore of the items a lair gave up':
      return itemLoreLines(fact.items);
    case 'a hero clears a lair and hauls out its magic':
      return `Victory! ${fact.heroName} claims ${String(fact.gold)}g from the ${fact.siteName} and hauls out ${itemNameList(fact.items, false)}.`;
    case 'among the bones a hero recovers what the fallen left':
      return `Among the bones of the fallen, ${fact.heroName} recovers ${itemNameList(fact.items, false)}.`;
    case 'a hero clears a lair that holds no magic':
      return `Victory! ${fact.heroName} claims ${String(fact.gold)}g from the ${fact.siteName}, though the lair holds no magic${fact.stolenItemNames.length ? ` — a thief got here first and lifted ${fact.stolenItemNames.join(', ')}` : ''}.`;
    case 'a hero is forced to retreat from a lair':
      return `${fact.heroName} is forced to retreat from the ${fact.siteName}, wounded. HP: ${String(fact.hp)}/${String(fact.maxHp)}`;
    case 'a hero lacks the Explorer mastery to Chart the Unknown':
      return `${fact.heroName} lacks the Explorer mastery (7) to Chart the Unknown.`;
    case 'Chart the Unknown reaches no further than a bordering province':
      return `${fact.heroName} cannot chart that ground from ${fact.provinceName} — Chart the Unknown reaches this province or one bordering it.`;
    case 'a hero charts a province in full':
      return `🧭 ${fact.heroName} charts ${fact.provinceName}${fact.fromProvinceName !== null ? ` from across the border in ${fact.fromProvinceName}` : ''} in full and scouts its ${String(fact.neighbours)} neighbour${fact.neighbours !== 1 ? 's' : ''}${fact.newlyGlimpsed ? ` (${String(fact.newlyGlimpsed)} newly glimpsed)` : ''}.`;
    case 'a hero lacks the Explorer mastery to Discover a Lost Ruin':
      return `${fact.heroName} lacks the Explorer mastery (9) to Discover a Lost Ruin.`;
    case 'a hero finds no site of a class left to lay bare':
      return `${fact.heroName} combs ${fact.provinceName} and the country about it for ${theLairsOfAClass(fact.lairClass, 'ritual sites')}, but every such secret hereabouts is already laid bare.`;
    case 'a hero lays bare the sites of a class': {
      const _drTxt = fact.byProvince
        .map((g) => `${g.siteNames.map((name) => name ?? 'a hidden lair').join(', ')} in ${g.provinceName}`)
        .join('; ');
      const provinces = fact.byProvince.length;
      return `🏛 ${fact.heroName} reads the land for ${theLairsOfAClass(fact.lairClass, 'the old stones')} and lays bare ${String(fact.sites)} site${fact.sites !== 1 ? 's' : ''} across ${String(provinces)} province${provinces !== 1 ? 's' : ''} — ${_drTxt}.`;
    }
    default: {
      const unknown: never = fact;
      return unknown;
    }
  }
}
