// ── THE WORDS OF THE CAST SPELL ORDER'S LINES (plan P1-12d9: P1-12's Decisions of 2026-10-26, Decisions 6 and 7) ──
// The views write the words of each fact the Cast Spell order's lines record (src/engine/orders/the-facts-the-cast-
// spell-orders-lines-record.ts), in the same words the engine wrote before (orders/cast-spell-order-white-psychic-
// illusory-elemental-and-necromancy-spells.ts): why a charmed mind turns on its enchanter, the companies a Telekinetic
// Storm strikes and the graves Control Undead counts are written here as the engine wrote them there. The skills'
// names, fmtRoll, itemNameList and dispFloor are the engine's, read here on plain values; a realm's tag after its hero's
// name is written as realmTag wrote it (theRealmsTag, the realm works' prose). A kind with no words here is a compile
// error (the `never` below).
import type {
  ACompanyTheStormStrikes,
  AGraveAsTheLineCountsIt,
  ASkillACurseHalves,
  TheFactOfTheCastSpellOrdersLine,
  WhyAnEnchantedHeroMayTurnOnHisEnchanter,
} from '../../engine/orders/the-facts-the-cast-spell-orders-lines-record.ts';
import { SKILL_LABELS } from '../../engine/army-tables.ts';
import { fmtRoll } from '../../engine/dice-and-army-names.ts';
import { itemNameList } from '../../engine/heroes/fame-and-consecration.ts';
import { dispFloor } from '../../engine/rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { theWordsInATableFor } from './the-words-of-the-order-dispatchs-lines.ts';
import { theRealmsTag } from './the-words-of-the-realm-works-orders-lines.ts';

/** A skill's name, by its slug (the slug itself when the table has none). */
function theSkillsName(skill: string): string {
  return theWordsInATableFor(SKILL_LABELS, skill) ?? skill;
}

/** Why a charmed mind may turn on its enchanter, as the backlash's roll names it. */
function whyAnEnchantedHeroMayTurn(why: WhyAnEnchantedHeroMayTurnOnHisEnchanter): string {
  switch (why.kind) {
    case 'the Charm fizzled':
      return 'the spell fizzled';
    case 'the mind is closed to enchantment this season':
      return 'closed to enchantment this season';
    case 'the Charm was resisted':
      return 'the Charm was resisted';
    default: {
      const unknown: never = why;
      return unknown;
    }
  }
}

/** A company a Telekinetic Storm strikes: shattered, torn apart, or down one level ("Free Lances Veteran→Average"). */
function aCompanyTheStormStrikes(unit: ACompanyTheStormStrikes): string {
  switch (unit.kind) {
    case 'a skeletal company the storm shatters to dust':
      return `${unit.unitName} shattered to dust — the storm scatters every bone`;
    case 'a company the storm tears apart for good':
      return `${unit.unitName} (${unit.qualityBefore}) torn apart and scattered for good`;
    case 'a company the storm reduces one experience level':
      return `${unit.unitName} ${unit.qualityBefore}→${unit.qualityAfter}`;
    default: {
      const unknown: never = unit;
      return unknown;
    }
  }
}

/** The skills a Curse halves: "Melee 4→2, Spy 1→0". */
function theSkillsACurseHalves(skills: readonly ASkillACurseHalves[]): string {
  return skills
    .map((s) => `${theSkillsName(s.skill)} ${String(s.levelBefore)}→${String(Math.floor(s.levelBefore / 2))}`)
    .join(', ');
}

/** The graves Control Undead senses, counted by quality and type in the order first met: "2× Veteran Pikemen, …". */
function theGravesCounted(graves: readonly AGraveAsTheLineCountsIt[]): string {
  const counts = new Map<string, number>();
  for (const g of graves) {
    const k = `${g.quality || 'Average'} ${g.type}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([k, nn]) => `${String(nn)}× ${k}`).join(', ');
}

/** The words of one fact of the Cast Spell order's lines. */
export function theWordsOfTheCastSpellOrdersLine(fact: TheFactOfTheCastSpellOrdersLine): string {
  switch (fact.kind) {
    // ── A failed Charm's backlash ──
    case 'an enchanted hero may turn on his enchanter':
      return `📊 Charm backlash — ${fact.targetName} may turn on ${fact.casterName} (${whyAnEnchantedHeroMayTurn(fact.why)}): ${fmtRoll(fact.chance, fact.roll)}`;
    case 'an enchanted hero rounds on his enchanter but one of them slips away':
      return `${fact.targetName} rounds on ${fact.casterName} as the enchantment fails — but ${fact.slipsAwayName} is already slipping away, and there is no encounter.`;
    case 'an enchanted hero rounds on his enchanter and blades are drawn':
      return `⚔ ${fact.targetName} feels the enchantment clawing at their mind and rounds on ${fact.casterName} — blades are drawn!`;
    // ── The casting ──
    case 'a hero names a spell there is none of':
      return `${fact.heroName}: unknown spell "${fact.spellName}".`;
    case 'a spell cannot be worked as a phase order':
      return `${fact.heroName}: ${fact.spellName} cannot be used as a phase order.`;
    case "a charmed hero will not turn a spell on his own lord's people":
      return `${fact.heroName} lets the ${fact.spellName} die on their lips — the Charm bends their will, but not so far as to turn them on their own lord's people.`;
    case "a school's casting limit blocks a spell":
      return `${fact.heroName}: ${theSkillsName(fact.school)} level ${String(fact.schoolLevel)} casting limit (${String(fact.castsSoFar)}/${String(fact.limit)} per turn). ${fact.spellName} blocked.`;
    case 'a hero lacks the skill a spell needs after a practice that did not raise it':
      return `${fact.heroName} attempts to cast ${fact.spellName} but lacks the required ${theSkillsName(fact.school)} skill — the practice order earlier this turn did not result in a skill gain. The spell fails.`;
    case 'an item can no longer work a mastery spell':
      return `${fact.heroName}: the ${fact.itemName} can no longer work ${fact.spellName} — such mastery must be earned, not carried. The item lies inert.`;
    case 'a hero has not yet reached the level a mastery spell demands':
      return `${fact.heroName} cannot yet wield ${fact.spellName} — it demands ${theSkillsName(fact.school)} level ${String(fact.levelDemanded)}, and they have reached only ${String(fact.levelReached)}.`;
    case 'a mastery spell is worked but once a turn':
      return `${fact.heroName} has already invoked ${fact.spellName} this turn — such mastery may be worked but once per turn.`;
    case "a spell's mark has gone from the province":
      return `${fact.heroName} looks for ${fact.targetName} to work ${fact.spellName} upon, and finds them gone — ${fact.theMarkServesTheCastersRealm ? 'they had already marched' : 'they had already moved'} on to ${fact.whereTheMarkWentName ?? 'another province'} before the spell could be shaped. It is never worked, and costs ${fact.heroName} nothing.`;
    case 'a hero invokes an item to work a spell':
      return `🔮 ${fact.heroName} invokes the ${fact.itemName} to work ${fact.spellName}.`;
    case "a spell's cast is rolled":
      return `📊 ${fact.heroName} casts ${fact.spellName} (${theSkillsName(fact.school)} ${String(fact.spellLevel)}${fact.trainedLevel < fact.spellLevel ? ` — ${String(fact.trainedLevel)} trained, +${String(fact.spellLevel - fact.trainedLevel)} from ${fact.byAnItem ? 'the item' : 'items'}` : ''}): ${String(fact.chance)}% chance [roll ${String(fact.roll)}${fact.roll <= fact.chance ? ' ✓' : ' ✗'}]`;
    case 'a spell fizzles without effect':
      return `${fact.heroName}'s ${fact.spellName} fizzles — the spell dissipates without effect.`;
    case "a spell's mark has vanished":
      return `${fact.heroName}'s ${fact.spellName} gropes after ${fact.targetName} and finds only shadow — they have vanished, and nothing may touch them this season.`;
    case "a spell's mark is veiled from hostile magic":
      return `${fact.heroName}'s ${fact.spellName} cannot reach ${fact.targetName} — they and their host are veiled from all hostile magic.`;
    case "a spell's mark is cloaked from hostile magic":
      return `${fact.heroName}'s ${fact.spellName} cannot find ${fact.targetName} — they are cloaked from hostile magic.`;
    // ── White Magic ──
    case 'Resurrect finds no fallen hero known to lie in the province':
      return `${fact.heroName} casts Resurrect, but no fallen hero you know of lies in ${fact.provinceName} — perhaps another raised them first.`;
    case "a fallen monarch's crown answers only to its own realm":
      return `${fact.heroName}: the fallen crown of ${fact.fallenName} answers only to its own realm — no rival's prayer will restore it.`;
    case "a fallen monarch's spirit has passed beyond recall":
      return `${fact.heroName}: the spirit of ${fact.fallenName} has passed beyond recall — only your most recently fallen monarch may be restored.`;
    case 'a fallen king cannot be resurrected':
      return `${fact.heroName}: ${fact.fallenName} was a king — kings cannot be resurrected.`;
    case 'a fallen hero sworn to another crown will not answer':
      return `${fact.heroName}: ${fact.fallenName} once swore to another crown — that oath holds even in death, and the spirit will not answer.`;
    case 'a fallen hero has already been raised this turn':
      return `${fact.heroName}: ${fact.fallenName} has already been raised this turn.`;
    case "a fallen hero's spirit cannot be found":
      return `${fact.heroName}: the spirit of ${fact.fallenName} cannot be found.`;
    case 'kings cannot be resurrected':
      return `${fact.heroName}: kings cannot be resurrected.`;
    case 'a reigning monarch steps down as the fallen monarch is restored':
      return `👑 ${fact.regentName} steps down from the throne as ${fact.restoredName} is restored to life — the former regent now serves the realm as a hero.`;
    case 'a fallen monarch rises and reclaims the throne':
      return `✨👑 ${fact.heroName} calls upon divine power — ${fact.restoredName} rises from death at full health and reclaims the throne of ${fact.realmName}! The rightful king walks again, stripped of all possessions but restored in spirit and skill.`;
    case 'a fallen hero rises to serve the realm':
      return `✨ ${fact.heroName} calls upon divine power — ${fact.restoredName} rises from death at full health, stripped of all possessions, and now serves ${fact.realmName}!${fact.wasAFoe ? ' The fallen foe is bound to a new master.' : ''}`;
    case 'a hero takes up the orders his realm laid down for him':
      return `${fact.heroName} takes up the orders ${fact.realmName} laid down for them — ${String(fact.phasesLeft)} phase${fact.phasesLeft !== 1 ? 's' : ''} of this turn remain to be acted on.`;
    case 'Part Sea is cast beyond its reach':
      return `${fact.heroName}: Part Sea can only target a province you are in or next to.`;
    case 'the waters of a province draw back':
      return `✨ ${fact.heroName} raises their hands and the waters of ${fact.provinceName} draw back — the seabed lies bare as dry plains for the rest of the turn. Land armies may cross freely, but no fleet can enter or leave from the next phase onward.`;
    case 'a realm learns the sea was parted at its province':
      return `🌊 ${fact.heroName} (${fact.castersRealmName ?? 'a foreign realm'}) has parted the sea at ${fact.provinceName} — it lies as dry plains for the rest of the turn; land armies may cross it and no fleet may enter or leave from the next phase.`;
    case 'Part Sea finds no sea to part':
      return `✨ ${fact.heroName} calls the waters back from ${fact.provinceName}, but the ground already lies dry — the spell finds no sea to part.`;
    case 'the Holy Symbol finds no dead to cleanse':
      return `✝ ${fact.heroName} raises the Holy Symbol over ${fact.provinceName}, but no battlefield dead lie unquiet here — there is nothing to cleanse.`;
    case 'the Holy Symbol cleanses the graves of a province':
      return `✝ ${fact.heroName} raises the Holy Symbol over ${fact.provinceName} and the graves of its battlefield dead are cleansed — every fallen unit buried there is laid to rest, beyond the reach of any necromancer.`;
    case 'onlookers see a Holy Symbol cleanse the graves of a province':
      return `✝ ${fact.heroName}${theRealmsTag(fact.realmName)} raises a Holy Symbol over the battlefields of ${fact.provinceName}, and the dead buried there are laid to rest — the graves are cleansed and can no longer be raised.`;
    case 'Bless Province is cast beyond its reach':
      return `${fact.heroName}: Bless Province can only target a province you are in or adjacent to.`;
    case 'a province is already blessed this turn':
      return `${fact.heroName}: ${fact.provinceName} is already blessed this turn — a second Bless has no further effect (they do not stack).`;
    case 'a province is blessed and warded': {
      const blessPct =
        `+${String(dispFloor((fact.blessedMultiplier - 1) * 100))}% tax` +
        (fact.byADivineKing
          ? " (a Divine king's blessing — the gods answer their anointed in full)"
          : fact.byADivineRealm
            ? ' (Divine blessing)'
            : '');
      return `✨ ${fact.heroName} blesses ${fact.provinceName} — its lands flourish, yielding ${blessPct} at collection this turn. The sacred ground is warded — a ${String(fact.wardChance)}% chance to turn aside any enemy Flood, Earthquake, Plague or Part Sea cast here this turn.`;
    }
    // ── Psychic ──
    case 'Charm finds no hero to sway in the province':
      return `Charm: no valid target hero stands in ${fact.provinceName} this phase.`;
    case "Charm cannot be used on the realm's own heroes":
      return `Charm cannot be used on your own heroes.`;
    case 'Charm cannot sway a king':
      return `Charm cannot sway a king.`;
    case 'a Charm slides off a mind lately swayed':
      return `${fact.heroName}'s Charm slides off ${fact.targetName} — a mind so lately swayed is closed to enchantment for a season.`;
    case "a mind's resistance to a Charm is rolled":
      return `📊 ${fact.targetName} resists the Charm (${String(fact.resistance)}% — swayed ${String(Math.round(fact.resistance / 30))} time${fact.resistance === 30 ? '' : 's'} before): ${fmtRoll(fact.resistance, fact.roll)}`;
    case 'a Charm breaks against a mind swayed before':
      return `${fact.heroName}'s Charm breaks against ${fact.targetName}'s will — a mind that has been swayed before knows the feel of it, and shuts.`;
    case 'a hero throws off an enchantment':
      return `${fact.targetName} feels an enchantment reach for their mind — and throws it off.`;
    case "an enchanter reads a charmed hero's mind": {
      const sk = fact.skills.map(([k, level]) => `${theSkillsName(k)} ${String(level)}`);
      return `🔍 ${fact.heroName} reads ${fact.targetName}'s mind as the Charm takes hold — Skills: ${sk.length ? sk.join(', ') : 'none'}. Magic items: ${fact.items.length ? itemNameList(fact.items, true) : 'none'}.`;
    }
    case 'a Charm finds no living mind to sway':
      return `${fact.heroName}'s Charm reaches for ${fact.targetName}, but there is no living mind left to sway.`;
    case 'a Charm cannot grip a hero leading troops':
      return `${fact.heroName}'s Charm cannot grip ${fact.targetName} — a hero leading troops is beyond its reach.`;
    case 'a Charm finds a hero just dismissed unmoved':
      return `${fact.heroName}'s Charm finds ${fact.targetName} unmoved — a hero only just dismissed will not be drawn back the same season.`;
    case "a Charm cannot sway a soul across the alignments' gulf":
      return `${fact.heroName}'s Charm washes over ${fact.targetName} and finds nothing to grip — ${String(fact.targetsAlignment)} souls cannot be swayed to a ${String(fact.realmsAlignment)} crown.`;
    case 'a Charm sways a wandering hero into service':
      return `✨ ${fact.heroName}'s Charm sways ${fact.targetName} — the wandering hero joins ${fact.realmName} at no cost (you must still pay their upkeep).`;
    case 'a Charm seizes an enemy hero until the season turns':
      return `✨ ${fact.heroName}'s Charm grips ${fact.targetName} — they fall under ${fact.realmName}'s command until the season turns, when they return to their own lord (who still pays their wages).${fact.phasesOfOrders > 0 ? ` ${String(fact.phasesOfOrders)} phase${fact.phasesOfOrders !== 1 ? 's' : ''} of orders await them.` : ''}`;
    case 'a realm learns its hero is ensorcelled by an enemy Charm':
      return `⚠ ${fact.targetName} is ensorcelled by an enemy Charm and slips your command until the season turns.`;
    case "Oratory cannot stir another realm's troops":
      return `${fact.heroName}'s Oratory can only stir their own realm's troops — ${fact.targetName} serves another crown.`;
    case 'Oratory lifts the troops a hero leads':
      return `✨ ${fact.heroName}'s stirring Oratory lifts ${fact.onTheCasterHimself ? 'their own' : fact.targetName + "'s"} troops — every army travelling with ${fact.onTheCasterHimself ? fact.heroName : fact.targetName} fights ${fact.qualityLevels > 1 ? 'two quality levels' : 'one quality level'} higher this turn.`;
    case 'Clairvoyance finds its mark dead':
      return `✨ ${fact.heroName} casts Clairvoyance upon ${fact.targetName}, but reaches only silence — ${fact.targetName} is dead. Their body lies in ${fact.bodyProvinceName ?? 'parts unknown'}.`;
    case 'Clairvoyance needs a hero to watch':
      return `Clairvoyance: choose a character you have seen to watch.`;
    case 'Clairvoyance cannot fix on a mind that serves no crown':
      return `${fact.heroName}'s Clairvoyance finds no thread to follow — ${fact.targetName} serves no crown, and the spell cannot fix upon a wandering or neutral mind.`;
    case "Clairvoyance opens the mind's eye upon a hero":
      return `✨ ${fact.heroName} opens their mind's eye upon ${fact.targetName} — all that befalls them is known to you for the rest of the turn. They are currently in ${fact.provinceName ?? 'parts unknown'}.`;
    case 'Psychic Blast finds no hero in the province':
      return `Psychic Blast: no valid target hero in ${fact.provinceName} this phase.`;
    case "Psychic Blast cannot be turned on the realm's own heroes":
      return `Psychic Blast cannot be turned on your own heroes.`;
    case 'a Psychic Blast finds no trained skills left to lose':
      return `✨ ${fact.heroName}'s Psychic Blast rakes ${fact.targetName}'s mind, but they have no trained skills left to lose.`;
    case "a Psychic Blast takes a hero's skills":
      return `✨ ${fact.heroName} unleashes Psychic Blast — ${fact.targetName}'s mind buckles, losing ${fact.skillsLost.map(theSkillsName).join(' and ')}!`;
    case 'a hero reels from a Psychic Blast':
      return `🧠 ${fact.targetName} reels — ${fact.heroName}'s Psychic Blast sears away ${fact.skillsLost.map(theSkillsName).join(' and ')}.`;
    case "a hero's lost skill lowers his wage":
      return `💰 ${fact.targetName}'s lost skill lowers their wage to ${String(fact.wage)}g/turn (was ${String(fact.wageBefore)}g/turn).`;
    case 'Telekinetic Storm finds no hero in the province':
      return `Telekinetic Storm: no valid target hero in ${fact.provinceName} this phase.`;
    case "Telekinetic Storm cannot be turned on the realm's own heroes":
      return `Telekinetic Storm cannot be turned on your own heroes.`;
    case 'a Telekinetic Storm finds no armies to scatter':
      return `✨ Telekinetic Storm buffets ${fact.targetName}, but they lead no armies to scatter.`;
    case "a Telekinetic Storm hurls a hero's troops about":
      return `✨ ${fact.heroName}'s Telekinetic Storm hurls ${fact.targetName}'s troops about — ${String(fact.caught)} unit${fact.caught !== 1 ? 's' : ''} caught: ${String(fact.destroyed)} shattered outright, ${String(fact.demoted)} permanently reduced one experience level. (${fact.units.map(aCompanyTheStormStrikes).join('; ')})`;
    case "a hero's formations are scattered by a Telekinetic Storm":
      return `🌀 ${fact.heroName}'s Telekinetic Storm scatters ${fact.targetName}'s formations — ${String(fact.destroyed)} destroyed, ${String(fact.demoted)} permanently reduced one experience level. (${fact.units.map(aCompanyTheStormStrikes).join('; ')})`;
    // ── Illusory ──
    case 'Illusory Terrain is cast beyond its reach':
      return `${fact.heroName}: Illusory Terrain must target a province you are in or adjacent to.`;
    case 'Illusory Terrain cloaks a province':
      return `✨ ${fact.heroName} cloaks ${fact.provinceName} in shifting illusion — to enemy eyes the ground blurs and rearranges into ever-changing, confusing terrain. Any enemy who gives battle here is disoriented, each of their units fighting as though caught in the worst possible ground for its kind (at least −15% strength).`;
    case 'Phantasmal Armies is cast on a hero beyond its reach':
      return `${fact.heroName}: Phantasmal Armies must target yourself or an allied hero in your province.`;
    case 'Phantasmal Armies finds no humanoid armies to duplicate':
      return `${fact.heroName}: ${fact.onTheCasterHimself ? 'you have' : fact.targetName + ' has'} no humanoid armies for Phantasmal Armies to duplicate.`;
    case 'Phantasmal Armies conjures duplicates of humanoid armies':
      return `✨ ${fact.heroName} conjures phantasmal duplicates of ${String(fact.duplicates)} of ${fact.onTheCasterHimself ? 'their' : fact.targetName + "'s"} humanoid ${fact.duplicates === 1 ? 'army' : 'armies'} — spectral doubles that march and fight with the real host for the rest of the turn, melting away if their true selves fall or the force is beaten.`;
    case 'Hide Lairs is cast beyond its reach':
      return `${fact.heroName}: Hide Lairs must target a province you are in or adjacent to.`;
    case 'Hide Lairs finds no lairs left to hide':
      return `${fact.heroName}: there are no lairs left to hide in ${fact.provinceName}.`;
    case "Hide Lairs veils a province's lairs":
      return `✨ ${fact.heroName} veils ${fact.provinceName} in confounding illusion — every lair within (${String(fact.lairsHidden)}) vanishes from all other explorers' sight, and none can be freshly discovered here until the glamour fades.`;
    // ── Elemental ──
    case 'Earthquake is cast beyond its reach':
      return `${fact.heroName}: Earthquake must target your province or one adjacent.`;
    case 'an Earthquake rends a province':
      return `✨ ${fact.heroName} rends the earth beneath ${fact.provinceName} — its fields and roads are ruined, and it will yield no tax at the end of this turn.`;
    case 'a realm learns an enemy Earthquake tore through its province':
      return `🜃 An enemy Earthquake has torn through ${fact.provinceName} — it will yield no tax this turn.`;
    case 'Flood is cast beyond its reach':
      return `${fact.heroName}: Flood must target a land province you are in or adjacent to.`;
    case 'Flood is cast on the sea':
      return `${fact.heroName}: Flood can only be cast on a land province.`;
    case 'a Flood swallows a province':
      return `✨ ${fact.heroName} calls up the deluge — ${fact.provinceName} vanishes beneath the waves and acts as a sea province for the rest of the turn. Land armies are stranded; only fleets and flyers may pass.`;
    case 'a realm learns an enemy Flood swallowed its province':
      return `🌊 An enemy Flood has swallowed ${fact.provinceName} — it acts as sea for the rest of the turn, and any land army there is stranded.`;
    case 'a hero has already summoned an elemental this turn':
      return `${fact.heroName} has already summoned an elemental this turn.`;
    case 'an elemental surges forth from a rift':
      return `✨ ${fact.heroName} tears open a rift in ${fact.provinceName} and ${fact.elementalName} — a ${fact.elementalType} — surges forth to fight under your command! It will dissolve at the end of the turn.`;
    case 'onlookers see an elemental surge forth from a rift':
      return `✨ ${fact.heroName}${theRealmsTag(fact.realmName)} tears open a rift in ${fact.provinceName} — ${fact.elementalName}, a ${fact.elementalType}, surges forth to fight under their banner.`;
    // ── Necromancy ──
    case 'Control Undead senses no dead in the province':
      return `✨ ${fact.heroName}'s Control Undead searches ${fact.provinceName} for the dead — but no fallen army units lie here to sense.`;
    case 'Control Undead senses the dead of the province':
      return `💀 ${fact.heroName}'s Control Undead senses the dead of ${fact.provinceName}: ${theGravesCounted(fact.graves)}. (${String(fact.graves.length)} grave${fact.graves.length !== 1 ? 's' : ''} that could be raised as skeletal servants.)`;
    case 'the sending finds battlefield graves in the provinces around':
      return `💀 ${fact.heroName}'s sending spreads out from ${fact.provinceName} and the dead answer from beyond its borders — battlefield graves lie in ${fact.provincesWithDead.join(', ')}. How many, and what they hold, only a caster standing on that ground could say.`;
    case 'the sending finds the provinces around quiet':
      return `✨ ${fact.heroName}'s sending spreads out from ${fact.provinceName}, but the lands around it are quiet — no battlefield dead lie in any neighbouring province.`;
    case 'Control Undead finds no hero in the province':
      return `Control Undead: no valid target hero stands in ${fact.provinceName} this phase.`;
    case "Control Undead cannot be turned on the realm's own heroes":
      return `Control Undead cannot be turned on your own heroes.`;
    case "Control Undead finds no undead among a hero's forces":
      return `${fact.heroName}'s Control Undead finds no undead among ${fact.targetName}'s forces.`;
    case 'Control Undead wrests a company from a hero':
      return `✨ ${fact.heroName}'s Control Undead wrests the ${fact.unitName} from ${fact.targetName} in ${fact.provinceName} — it now marches under your banner!`;
    case 'onlookers see Control Undead wrest a company from a hero':
      return `✨ ${fact.heroName}${theRealmsTag(fact.realmName)}'s Control Undead wrests the ${fact.unitName} from ${fact.targetName}${theRealmsTag(fact.targetsRealmName)} in ${fact.provinceName} — it now marches under ${fact.heroName}'s banner.`;
    case 'a hero learns Control Undead wrested a company from him':
      return `✨ ${fact.heroName}${theRealmsTag(fact.realmName)}'s Control Undead wrests the ${fact.unitName} from ${fact.targetName} in ${fact.provinceName} — it now marches under the enemy's banner.`;
    case 'Skeletal Armies finds no dead to answer':
      return `${fact.heroName} calls out to the fallen in ${fact.provinceName}, but there are no battlefield dead here to answer. Seek a province where armies have previously perished.`;
    case 'a skeletal company rises from the graves':
      return `💀 ${fact.heroName} calls forth ${fact.unitName} — a ${fact.quality} ${fact.unitType} rises from the graves of ${fact.provinceName} to serve! (Upkeep 1g/turn.)`;
    case 'Curse finds no hero in the province':
      return `Curse: no valid target hero in ${fact.provinceName} this phase.`;
    case "Curse cannot be turned on the realm's own heroes":
      return `Curse cannot be turned on your own heroes.`;
    case 'a hero has no skills to curse':
      return `${fact.targetName} has no skills to curse.`;
    case "a Curse halves a hero's skills":
      return `✨ ${fact.heroName}'s Curse settles over ${fact.targetName} — every skill is halved for the rest of the turn (${theSkillsACurseHalves(fact.skills)})!`;
    case 'a hero learns a Curse settles over him':
      return `☠ A Curse from ${fact.heroName} settles over ${fact.targetName} — every skill is halved for the rest of the turn (${theSkillsACurseHalves(fact.skills)}).`;
    case 'Plague is cast beyond its reach':
      return `${fact.heroName}: Plague must target your province or one adjacent.`;
    case 'a province is already stricken with plague this turn':
      return `${fact.provinceName} is already stricken with plague this turn — a second casting adds nothing (not cumulative).`;
    case 'a Plague strikes a province':
      return `☠ ${fact.heroName} calls down a Plague upon ${fact.provinceName} — of ${String(fact.tested)} humanoid unit${fact.tested !== 1 ? 's' : ''}, ${String(fact.affected)} sicken and lose an experience level. It may spread to neighbouring lands in the phases to come.`;
    case 'a realm learns an enemy Plague struck its province':
      return `☠ An enemy Plague has struck ${fact.provinceName} — ${String(fact.affected)} of your unit${fact.affected !== 1 ? 's there sicken' : ' there sickens'} and may spread to neighbouring lands.`;
    // ── The mastery spells ──
    case 'Sanctuary is cast beyond its reach':
      return `${fact.heroName}: Sanctuary must ward your province or one adjacent.`;
    case 'a Sanctuary is raised over a province':
      return `✨ ${fact.heroName} raises a Sanctuary over ${fact.provinceName} — hostile armies that give battle here fight at −25% strength this turn.`;
    case 'a realm learns a Sanctuary was raised over its province':
      return `✨ ${fact.heroName} (${fact.castersRealmName ?? 'a foreign realm'}) has raised a Sanctuary over ${fact.provinceName} — armies hostile to that realm that give battle there fight at −25% strength this turn.`;
    case 'Divine Judgment finds no enemy hero in the province':
      return `Divine Judgment: no valid enemy hero in ${fact.provinceName} this phase.`;
    case "Divine Judgment cannot be turned on the realm's own heroes":
      return `Divine Judgment cannot be turned on your own heroes.`;
    case 'Divine Judgment falls on a hero':
      return `⚡ ${fact.heroName} calls down Divine Judgment on ${fact.targetName} — ${String(fact.damage)} holy damage${fact.unitsSmitten > 0 ? `, and ${String(fact.unitsSmitten)} of their unit${fact.unitsSmitten !== 1 ? 's' : ''} are smitten to ash` : ''}!`;
    case 'a hero learns Divine Judgment fell on him':
      return `⚡ Divine Judgment falls on ${fact.targetName} from ${fact.heroName} — ${String(fact.damage)} holy damage${fact.unitsSmitten > 0 ? `, ${String(fact.unitsSmitten)} unit${fact.unitsSmitten !== 1 ? 's' : ''} smitten` : ''}.`;
    case 'Mass Confusion finds no enemy hero in the province':
      return `Mass Confusion: no valid enemy hero in ${fact.provinceName} this phase.`;
    case "Mass Confusion cannot be turned on the realm's own heroes":
      return `Mass Confusion cannot be turned on your own heroes.`;
    case "Mass Confusion is sown through a hero's ranks":
      return `✨ ${fact.heroName} sows Mass Confusion through ${fact.targetName}'s ranks — their commander's Tactical genius deserts them in their next battle this turn.`;
    case 'a hero learns Mass Confusion grips him':
      return `✨ Mass Confusion from ${fact.heroName} grips ${fact.targetName} — their Tactical command deserts them in their next battle.`;
    case 'Dominate finds no enemy hero in the province':
      return `Dominate: no valid enemy hero in ${fact.provinceName} this phase.`;
    case "Dominate cannot be turned on the realm's own heroes":
      return `Dominate cannot be turned on your own heroes.`;
    case 'Dominate finds no troops to turn':
      return `✨ ${fact.heroName}'s Dominate grips ${fact.targetName}, but they lead no troops to turn.`;
    case "Dominate turns a hero's companies":
      return `✨ ${fact.heroName} Dominates ${fact.targetName} in ${fact.provinceName} — ${String(fact.seized)} of their unit${fact.seized !== 1 ? 's' : ''} turn coat and march under your banner!`;
    case "onlookers see Dominate turn a hero's companies":
      return `✨ ${fact.heroName}${theRealmsTag(fact.realmName)} Dominates ${fact.targetName}${theRealmsTag(fact.targetsRealmName)} in ${fact.provinceName} — ${String(fact.seized)} of their unit${fact.seized !== 1 ? 's' : ''} turn coat and march under ${fact.heroName}'s banner.`;
    case 'a hero learns Dominate turned his companies':
      return `✨ ${fact.heroName}${theRealmsTag(fact.realmName)} Dominates ${fact.targetName} in ${fact.provinceName} — ${String(fact.seized)} of their unit${fact.seized !== 1 ? 's' : ''} turn coat and desert to the enemy.`;
    case 'Phantom Host finds no beasts to duplicate':
      return `${fact.heroName}: you lead no monsters or creatures for Phantom Host to duplicate.`;
    case 'Phantom Host conjures duplicates of beasts':
      return `✨ ${fact.heroName} conjures a Phantom Host — spectral doubles of ${String(fact.duplicates)} of their ${fact.duplicates === 1 ? 'beast' : 'beasts'} that fight with the real host for the rest of the turn, melting away if their true selves fall or the force is beaten.`;
    case 'Invisibility holds':
      return `✨ ${fact.heroName} weaves Invisibility about themself — no enemy eye will find them for the rest of this turn. ${fmtRoll(fact.chance, fact.roll)}`;
    case 'Invisibility fails to hold':
      return `✨ ${fact.heroName}'s Invisibility shimmers and fails to hold — they remain in plain sight. ${fmtRoll(fact.chance, fact.roll)}`;
    case 'a Veil of illusion is drawn over a host':
      return `✨ ${fact.heroName} draws a Veil of illusion over their host — for this phase and the next, they and the armies they lead vanish from all enemy sight, cannot be touched by hostile magic, and cannot be brought to battle. The illusion parts as the phase after next begins.`;
    case 'Chain Lightning finds no enemy hero in the province':
      return `Chain Lightning: no valid enemy hero in ${fact.provinceName} this phase.`;
    case "Chain Lightning cannot be turned on the realm's own heroes":
      return `Chain Lightning cannot be turned on your own heroes.`;
    case 'Chain Lightning finds no troops to strike':
      return `✨ Chain Lightning crackles around ${fact.targetName}, but they lead no troops to strike.`;
    case 'Chain Lightning earths out among a handful of troops':
      return `⚡ ${fact.heroName}'s Chain Lightning crackles around ${fact.targetName}'s handful of troops but earths out without a kill.`;
    case "Chain Lightning arcs through a hero's ranks":
      return `⚡ ${fact.heroName}'s Chain Lightning arcs through ${fact.targetName}'s ranks — of ${String(fact.caught)} unit${fact.caught !== 1 ? 's' : ''} caught in the arc, ${String(fact.killed)} ${fact.killed === 1 ? 'is' : 'are'} blasted apart!`;
    case 'a hero learns Chain Lightning tore through his ranks':
      return `⚡ ${fact.heroName}'s Chain Lightning tears through ${fact.targetName}'s ranks — ${String(fact.killed)} unit${fact.killed !== 1 ? 's' : ''} blasted apart.`;
    case 'Cataclysm is cast beyond its reach':
      return `${fact.heroName}: Cataclysm must target your province or one adjacent.`;
    case 'a Cataclysm devastates a province':
      return `☄ ${fact.heroName} calls down a Cataclysm upon ${fact.provinceName} — ${String(fact.destroyed)} enemy unit${fact.destroyed !== 1 ? 's' : ''} destroyed, and the land is left permanently barren (tax base reduced to 0 for good).`;
    case 'a realm learns an enemy Cataclysm devastated its province':
      return `☄ An enemy Cataclysm has devastated ${fact.provinceName} — its tax base is permanently ruined${fact.destroyed > 0 ? ` and ${String(fact.destroyed)} of your unit${fact.destroyed !== 1 ? 's were' : ' was'} destroyed` : ''}.`;
    case 'Raise Wraiths finds no dead to answer':
      return `${fact.heroName}'s call for Wraiths finds no battlefield dead in ${fact.provinceName} to answer.`;
    case 'the dead are bound into Wraiths':
      return `💀 ${fact.heroName} binds the dead of ${fact.provinceName} into ${fact.unitName} — Elite undead at your side! (Upkeep 1g/turn.)`;
    case 'onlookers see the dead bound into Wraiths':
      return `💀 ${fact.heroName}${theRealmsTag(fact.realmName)} binds the dead of ${fact.provinceName} into ${fact.unitName} — Elite undead now march at their side.`;
    case "Death's Dominion finds no fallen army to raise":
      return `${fact.heroName}'s Death's Dominion finds no fallen army in ${fact.provinceName} to raise.`;
    case "Death's Dominion raises skeletal companies from the graves":
      return `💀 ${fact.heroName} unleashes Death's Dominion over ${fact.provinceName} — ${String(fact.raised)} skeletal unit${fact.raised !== 1 ? 's' : ''} claw up from the graves to serve!`;
    default: {
      const unknown: never = fact;
      return unknown;
    }
  }
}
