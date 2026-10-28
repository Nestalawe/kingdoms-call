// ── THE WORDS OF THE MOVE ORDER'S LINES (plan P1-12d10: P1-12's Decisions of 2026-10-26, Decisions 6 and 7) ──
// The views write the words of each fact the move order's lines record (src/engine/orders/the-facts-the-move-orders-
// lines-record.ts), in the same words the engine wrote before (orders/move-order-marches-voyages-and-battles-on-
// arrival.ts): why a column has too little shipping to put to sea, how far a march mapped the province, the sites a
// hero spots on the way in and the troops that rally to a defender are written here as the engine wrote them there.
// describeArmy is the engine's, read here on the units a line copied. A kind with no words here is a compile error (the
// `never` below).
import type {
  ASiteSpottedOnTheMarchAsTheLineNamesIt,
  TheFactOfTheMoveOrdersLine,
  TheMappingOfAMarchAsTheLineTellsIt,
  TroopsThatRallyToADefender,
} from '../../engine/orders/the-facts-the-move-orders-lines-record.ts';
import { describeArmy } from '../../engine/dice-and-army-names.ts';

/** A guardian's name with its article: "a Barrow Wight", "an Ogre", a plural as it is, "a creature" for none. */
function _artM(n: string | null): string {
  if (!n) return 'a creature';
  if (n.endsWith('s')) return n;
  return (/^[aeiou]/i.test(n) ? 'an ' : 'a ') + n;
}

/** What a site spotted on the march is: a ritual site, a lair already cleared, or guarded by its guardian. */
function _featTail(f: ASiteSpottedOnTheMarchAsTheLineNamesIt): string {
  return f.isARitualSite
    ? `It is an ancient ritual site of the old gods — no guardian lairs here.`
    : f.isCleared
      ? `Its guardian has already been slain — the lair lies cleared.`
      : `Legend says it is guarded by ${_artM(f.guardianName)}.`;
}

/** A site spotted on the march, as a list of them names it. */
function _featFrag(f: ASiteSpottedOnTheMarchAsTheLineNamesIt): string {
  return f.isARitualSite
    ? `the ${f.name} (a ritual site)`
    : `the ${f.name}${f.isCleared ? ' (already cleared)' : ` (guarded by ${_artM(f.guardianName)})`}`;
}

/** How far a march mapped the province, after the line that moves a hero into it (nothing when it mapped nothing). */
function theMappingOfTheMarch(provinceName: string, m: TheMappingOfAMarchAsTheLineTellsIt): string {
  return m.now >= 100
    ? m.before >= 100
      ? ` (${provinceName} was already fully explored — 100% mapped.)`
      : ` Their passage completes the map of ${provinceName} — now 100% explored (+${String(m.gain)}%).`
    : m.gain > 0
      ? ` Exploration of ${provinceName} rises +${String(m.gain)}% to ${String(m.now)}%.`
      : '';
}

/** The standing troops that rally to a defender, as the line names them. */
function theTroopsThatRally(t: TroopsThatRallyToADefender): string {
  switch (t.kind) {
    case "the province's garrison rallies":
      return `the garrison (${String(t.units.length)} unit${t.units.length !== 1 ? 's' : ''} — ${describeArmy(t.units)})`;
    case "a fallen hero's leaderless host rallies":
      return `${t.heroName}'s leaderless host (${String(t.units.length)} unit${t.units.length !== 1 ? 's' : ''} — ${describeArmy(t.units)})`;
    default: {
      const troopsWithNoWords: never = t;
      throw new Error(`the move order's lines have no words for ${JSON.stringify(troopsWithNoWords)}`);
    }
  }
}

/** The words of one fact of the move order's lines. */
export function theWordsOfTheMoveOrdersLine(fact: TheFactOfTheMoveOrdersLine): string {
  switch (fact.kind) {
    case 'a hero has no movement points left this turn':
      return `${fact.heroName} has no movement points remaining this turn.`;
    case 'a march to the edge of the world finds the icy wastes':
      return `${fact.heroName} marches ${fact.direction} to the edge of the world, but the impassable icy wastelands bar the way — no army can cross them to the far north or south.`;
    case 'a move names no province to march to':
      return `${fact.heroName}: invalid move target.`;
    case 'a hero is already in the province his move names':
      return `${fact.heroName} is already in ${fact.provinceName} — the move order is moot.`;
    case 'a displaced column finds no route to the province it meant to reach':
      return `${fact.heroName} intended to march to ${fact.wantedProvinceName}, but from ${fact.fromProvinceName} no passable route leads there this phase — the column holds.`;
    case 'a displaced column turns toward its province by another way':
      return `${fact.heroName} intended to march to ${fact.wantedProvinceName}, but after being displaced it no longer lies adjacent — the column turns toward it by way of ${fact.viaProvinceName}.`;
    case "a column is turned back at a neutral realm's border":
      return `${fact.heroName}'s column is turned back at the border of ${fact.provinceName} — ${fact.realmName} and ${fact.otherRealmName ?? 'that realm'} are at peace. Neither may march an army across the other's frontier without a treaty of alliance or a declaration of war.`;
    case 'a column finds the waters sealed by an enemy blockade':
      return `${fact.heroName} finds the waters of ${fact.provinceName} sealed by an enemy blockade — the crossing is barred this turn.`;
    case 'a column is turned back at a flooded province':
      return `${fact.heroName} is turned back at ${fact.provinceName}: the province has been FLOODED and acts as open sea this turn. Land armies cannot wade across — only fleets (or flying units) may pass until the waters recede at turn's end.`;
    case 'a fleet cannot move between land provinces without crossing the sea':
      return `${fact.heroName} leads only naval armies (${fact.unitTypes.join(', ')}) and cannot move directly between land provinces without crossing sea.`;
    case 'a column has too little shipping to put to sea':
      return (
        `${fact.heroName} cannot put to sea: ${String(fact.landUnitTypes.length)} land arm${fact.landUnitTypes.length !== 1 ? 'ies' : 'y'} (${fact.landUnitTypes.join(', ')}) need ${String(fact.hullsNeeded)} hull${fact.hullsNeeded !== 1 ? 's' : ''} of shipping, but the force has only ${String(fact.berths)} berth${fact.berths !== 1 ? 's' : ''} aboard its hulls` +
        (fact.flyers > 0
          ? ` and ${String(fact.flyers)} flying unit${fact.flyers !== 1 ? 's' : ''} to carry the leftovers (one foot soldier each)`
          : ` and no flyers to carry the leftovers`) +
        `.` +
        (fact.unliftableUnitTypes.length > 0
          ? ` The ${fact.unliftableUnitTypes.join(', ')} cannot be lifted at all — cavalry, siege and beasts must go aboard ship.`
          : '') +
        (fact.swimmingUnitTypes.length > 0
          ? ` The ${fact.swimmingUnitTypes.join(' and ')} swim under their own power but cannot carry troops.`
          : '') +
        ` (Light foot take half a hull each; cavalry, heavy foot, siege and beasts take a full hull; a humanoid flyer lifts one foot soldier.) Move blocked.`
      );
    case 'a column cannot enter a flooded province without sea movement':
      return `${fact.heroName} cannot enter ${fact.provinceName}: the province has been FLOODED and lies under open sea this turn, and ${fact.heroName} has no sea movement to cross water. Only fleets or flyers may enter until the waters recede at turn's end.`;
    case 'a column is stranded by a flood with no sea movement':
      return `${fact.heroName} is stranded in ${fact.provinceName}: a FLOOD has turned the province to open sea this turn, and ${fact.heroName} has no sea movement to sail out of it. The column must wait for the waters to recede at turn's end.`;
    case 'a hero has no sea movement points left this turn':
      return `${fact.heroName} has no sea movement points remaining this turn.`;
    case 'a hero moves across the sea':
      return `${fact.heroName} moves across sea to ${fact.provinceName}.`;
    case 'a land column is stranded by a flood and cannot wade ashore':
      return `${fact.heroName} is stranded in ${fact.provinceName}: a FLOOD has turned the province to open sea this turn, and a land column cannot wade out to ${fact.destinationName}. The waters recede at turn's end — ${fact.heroName} may move again next turn.`;
    case 'a hero has no sea movement points left to land':
      return `${fact.heroName} has no sea movement points remaining to make a coastal landing in ${fact.provinceName}.`;
    case "a hero's reavers drive their longships onto the shingle":
      return `${fact.heroName}'s longships drive onto the shingle at ${fact.provinceName} — the reavers are over the side before the keels stop moving.`;
    case 'a hero makes a coastal landing':
      return `${fact.heroName} makes a coastal landing in ${fact.provinceName}.`;
    case 'a column leading naval units cannot march overland':
      return `${fact.heroName} cannot march overland while leading naval units (${fact.navalUnitTypes.join(', ')}) — ships and sea-beasts cannot cross land. Leave them behind to march, or sail to an adjacent sea province.`;
    case 'a fleet on land can only sail to an adjacent sea province':
      return `${fact.heroName} leads only naval armies (${fact.unitTypes.join(', ')}) and cannot march overland — from a land province a fleet can only sail to an adjacent sea province.`;
    case 'a column cannot enter the terrain of a province':
      return `${fact.heroName} cannot enter ${fact.provinceName} (${fact.terrain}).`;
    case 'a hero has no land movement points left this turn':
      return `${fact.heroName} has no land movement points left this turn.`;
    case 'a necromancer senses graves underfoot on the march':
      return `💀 ${fact.heroName} crosses into ${fact.provinceName} and the dead stir underfoot — battlefield graves lie in this province, though nothing tells how many or what they hold.`;
    case "a veiling illusion clouds a hero's search on the march":
      return `🌫 Something clouds ${fact.heroName}'s search of ${fact.provinceName} — a veiling illusion conceals lairs hidden here, blocking any discovery.`;
    case 'a hero spots a site as he marches into a province':
      return `Moving into ${fact.provinceName}, ${fact.heroName} discovers the ${fact.site.name}! ${_featTail(fact.site)}`;
    case 'a hero spots several sites as he marches into a province': {
      const frags = fact.sites.map(_featFrag);
      const list = frags.slice(0, -1).join(', ') + ' and ' + String(frags[frags.length - 1]);
      return `Moving into ${fact.provinceName}, ${fact.heroName} discovers ${list}.`;
    }
    case "a contingent joins a hero's assault on a guarded province":
      return `📊 Contingent unify: ${fact.allyName} joins ${fact.heroName}'s assault on ${fact.provinceName}! (March ${String(fact.marchLevel)}: ${String(fact.chance)}% chance, roll ${String(fact.roll)} ✓)`;
    case 'a contingent cannot link up in time against a guarded province':
      return `${fact.allyName} cannot link up with ${fact.heroName} in time — they will attack ${fact.provinceName} separately. (March ${String(fact.marchLevel)}: ${String(fact.chance)}% chance, roll ${String(fact.roll)} ✗)`;
    case 'a combined force goes into battle against a guarded province':
      return `${fact.leaderName} leads a combined force of ${String(fact.units)} units into battle, reinforced by ${fact.reinforcedBy.join(', ')}.`;
    case 'a Forced March slips into a province without giving battle':
      return `⚡ ${fact.heroName}'s Forced March filters into ${fact.provinceName} without giving battle this phase — but the enemy still holds the ground, and the reckoning only waits.`;
    case "a hero marches in another hero's host against a province":
      return fact.fellThere
        ? `⚔ ${fact.heroName} marched in ${fact.commanderName}'s host against ${fact.provinceName}, and fell there — the full account is under ${fact.commanderName}.`
        : `⚔ ${fact.heroName} marches in ${fact.commanderName}'s host against ${fact.provinceName} — the full account is under ${fact.commanderName}.`;
    case "a fallen guard's garrison refuses to yield":
      return `💢 Though their commander lies dead, ${String(fact.survivors)} surviving unit${fact.survivors !== 1 ? 's' : ''} of the garrison refuse to yield ${fact.provinceName} — the leaderless remnant will contest it again in the next action phase!`;
    case 'a beaten guard rallies his surviving units':
      return `💢 ${fact.guardName.replace(' (wandering)', '')} rallies ${String(fact.survivors)} surviving unit${fact.survivors !== 1 ? 's' : ''} — they will contest ${fact.provinceName} again in the next action phase!`;
    case 'the battle for a guarded province is not over':
      return `⚔ The battle for ${fact.provinceName} is not over — ${fact.guardName.replace(' (wandering)', '')} rallies and will fight again!`;
    case 'a beaten guard flees to a neighbouring province':
      return `💀 ${fact.guardName.replace(' (wandering)', '')} has been defeated — all forces destroyed, they flee bitterly to ${fact.destinationName}.`;
    case 'a beaten guard retreats into the wilderness':
      return `💀 ${fact.guardName.replace(' (wandering)', '')} has been defeated — all forces destroyed, they retreat into the wilderness.`;
    case 'a hero claims a guarded province':
      return `${fact.heroFell ? `${fact.heroName}'s leaderless host` : fact.heroName} claims ${fact.provinceName} for ${fact.realmName}!${fact.heroFell ? '' : ` (+${String(fact.merit)} merit)`}`;
    case "a fallen guard's garrison holds the province":
      return `🛡 Their commander fell, but the garrison of ${fact.provinceName} held — the leaderless defenders keep the province.`;
    case 'leaderless troops form up with the garrison':
      return `⚑ With no commander to lead them, the leaderless troops in ${fact.provinceName} form up with the garrison to hold the ground.`;
    case "a contingent joins a hero's assault on a rival's province":
      return `📊 ${fact.allyName} unifies with ${fact.heroName} for the assault on ${fact.provinceName}! (${String(fact.chance)}% → roll ${String(fact.roll)} ✓)`;
    case "a contingent misses the timing against a rival's province":
      return `${fact.allyName} misses the timing — will attack ${fact.provinceName} separately this phase.`;
    case 'a defender is reinforced by the heroes beside him':
      return `${fact.heroName} is reinforced by ${fact.reinforcedBy.join(', ')} in the defence of ${fact.provinceName}!`;
    case "a province's standing troops rally to its defender":
      return `🛡 The standing troops of ${fact.provinceName} rally to ${fact.defenderName}: ${fact.troops.map(theTroopsThatRally).join(', ')} join the defence.`;
    case "a hero stands in the battle line beside his realm's defender":
      return fact.fellThere
        ? `⚔ ${fact.heroName} stood in the battle line beside ${fact.defenderName} in the defence of ${fact.provinceName}, and fell there — the full account is under ${fact.defenderName}.`
        : `⚔ ${fact.heroName} stands in the battle line beside ${fact.defenderName} in the defence of ${fact.provinceName} — the full account is under ${fact.defenderName}.`;
    case "a defender's allies fall back with him":
      return `${fact.allyNames.join(', ')} fall back to ${fact.destinationName} alongside ${fact.defenderName}.`;
    case "a province's standing troops fall back with its defender":
      return `The standing troops of ${fact.provinceName} fall back to ${fact.destinationName} with ${fact.defenderName} rather than be left to the enemy.`;
    case "a hero carries the field but the rival's province stays contested":
      return `${fact.heroFell ? `${fact.heroName}'s leaderless host` : fact.heroName} carries the field at ${fact.provinceName}, but enemy forces still hold their ground — the province remains contested.`;
    case "a hero claims a rival's province":
      return `${fact.heroIsAlive ? fact.heroName : `${fact.heroName}'s leaderless host`} claims ${fact.provinceName} for ${fact.realmName}!`;
    case "a province's standing troops fall in with its defender":
      return `🛡 The standing troops of ${fact.provinceName} fall in with ${fact.defenderName} and fight on at their side as the battle continues.`;
    case 'a broken garrison falls back to a neighbouring province':
      return `The garrison of ${fact.provinceName} is broken and falls back to ${fact.destinationName} rather than be overrun.`;
    case 'a hero takes a province as its garrison withdraws':
      return `${fact.heroName} takes ${fact.provinceName} as its garrison withdraws!`;
    case 'a garrison is driven back but not broken':
      return `💢 The garrison of ${fact.provinceName} is driven back but not broken — ${String(fact.survivors)} unit${fact.survivors !== 1 ? 's' : ''} still hold the ground, and the fight resumes next phase.`;
    case 'a hero breaks through the last of the garrison':
      return `${fact.heroName} breaks through the last of the garrison and seizes ${fact.provinceName}!`;
    case "a garrison throws a hero's attack back":
      return fact.heroIsTrapped
        ? `The garrison of ${fact.provinceName} throws ${fact.heroName} back, but there is no ${fact.atSea ? 'open water to escape by' : 'road out'} — leaderless troops can hold ${fact.atSea ? 'their waters' : 'walls'}, and the struggle goes on.`
        : `The garrison of ${fact.provinceName} repels ${fact.heroName}'s attack — leaderless troops can hold ${fact.atSea ? 'their waters' : 'walls'}!`;
    case 'a hero seizes an undefended province':
      return `${fact.heroName} seizes the undefended province of ${fact.provinceName}${fact.previousOwnerName ? ` from ${fact.previousOwnerName}` : ''} for ${fact.realmName}!`;
    case 'a leaderless garrison refuses to yield':
      return `💢 The leaderless garrison of ${fact.provinceName} refuses to yield — ${String(fact.survivors)} unit${fact.survivors !== 1 ? 's' : ''} still contest the province!`;
    case 'a hero overcomes the leaderless defenders':
      return `${fact.heroName} overcomes the last of the leaderless defenders and claims ${fact.provinceName} for ${fact.realmName}! (+${String(fact.merit)} merit)`;
    case 'a leaderless garrison throws a hero back':
      return `Even without a commander, the garrison of ${fact.provinceName} throws ${fact.heroName} back!`;
    case 'a hero claims an unguarded province':
      return `${fact.heroName} claims ${fact.provinceName} for ${fact.realmName}!`;
    case 'a hero without armies ventures in to explore':
      return `${fact.heroName} ventures into ${fact.provinceName} to explore — without armies at their back, they can only observe, not conquer.${theMappingOfTheMarch(fact.provinceName, fact.mapping)}`;
    case 'a hero moves to a province':
      return `${fact.heroName} moves to ${fact.provinceName}.${theMappingOfTheMarch(fact.provinceName, fact.mapping)}`;
    case "a hero's coastal raid sacks a province":
      return `💰 ${fact.heroName}'s coastal raid sacks ${fact.provinceName} — ${String(fact.loot)}g plundered${fact.fromARealm ? ` from ${fact.previousOwnerName ?? 'the enemy'}` : ''}.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the move order's lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
