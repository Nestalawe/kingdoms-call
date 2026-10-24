// ── THE WORDS OF A BATTLE'S LINES (plan P1-12c3 and c5: P1-12's Decisions of 2026-10-24, Decisions 2 and 5) ────
// The views write the words of each fact a battle's lines record (src/engine/battle/the-facts-a-battles-lines-record.ts),
// after the engine, in the same words the engine wrote before. A kind with no words here is a compile error (the
// `never` below) and, from an untyped caller, a throw in play.
import type { TheFactOfABattlesLine } from '../../engine/battle/the-facts-a-battles-lines-record.ts';

/** The words of one fact of a battle's lines. */
export function theWordsOfABattlesLine(fact: TheFactOfABattlesLine): string {
  switch (fact.kind) {
    case 'a force drawn up for battle': {
      // The header's machine form, its keys in this order: the player page, the GM page, the battle's tiers and its
      // tally read it back (join-and-chronicle.ts, turn-log.ts, engine/battle/fates.ts).
      const { name, color, neutral, guard, role, verb, armies } = fact;
      return '⚑FORCE⚑' + JSON.stringify({ name, color, neutral, guard, role, verb, armies });
    }
    case "a battle's losses, tallied from its lines":
      throw new Error(
        "a battle's losses tally is written from the words of the battle's lines (theTurnsLinesInWords), not on its own",
      );
    case "the attacker's lightning advance catches the defender unready":
      return `⚡ ${String(fact.atkName)}'s Lightning Advance catches ${String(fact.defName)} completely unready — no terrain advantage, no pre-battle magic and no answering volley.`;
    case 'the attacker moves into the province and a battle is initiated':
      return `➡️ ${fact.atkName} (${fact.attackersRealmName}) moves into ${fact.provName}, held by ${fact.heldByName} — a battle is initiated.`;
    case 'the battle for a province begins':
      return `⚔ **Battle for ${fact.provName}**`;
    case 'the province still cowers under a reign of fear':
      return `💀 Reign of Fear — ${fact.provName} still cowers under ${fact.terrorHeroName}'s Terror, and the monsters of the host fight at ×${String(fact.reignOfFearMultiplier)}.`;
    case 'the attacker is cut down before the lines join, and a captain takes command':
      return `⚑ With ${fact.atkName} cut down before the lines were joined, the senior captain of the host takes command — the attack goes in regardless, though without their fallen leader's guiding hand.`;
    case 'the defender is slain before his army, and a veteran takes command':
      return `⚑ With ${fact.defName} slain before their army, a steady-handed veteran steps into command — the defence holds its ground, leaderless but unbowed.`;
    case "the attacker fights to win back his realm's capital":
      return `🏠 ${fact.atkName} fights to win back ${fact.provName}, the realm's own capital — home ground lends the assault ×1.5 strength.`;
    case "the attacker's siegecraft wears down the defenders' fortifications":
      return `  🏰 ${fact.atkName}'s siegecraft wears down the defenders' fortifications (province bonus −${fact.siegecraftReduction}).`;
    case "the defender's host defends ground held justly":
      return `✝ Righteous Defence — ${fact.defName}'s host defends ground held justly (+10% defence).`;
    case "the defender's realm holds its own ground the harder":
      return `  🛡 ${fact.defName}'s realm holds its own ground the harder (+${String(fact.ownGroundDefencePct)}% defence).`;
    case "the defender's banner of the realm rallies the home defence":
      return `  🛡 ${fact.defName}'s Banner of the Realm rallies the home defense (+25%).`;
    case "the attacker's siege mastery halves the defenders' fortifications":
      return `  🏰 ${String(fact.atkName)}'s siege mastery halves the defenders' fortifications.`;
    case 'the defenders fight on home ground':
      return `The defenders fight on home ground, gaining ×1.5 total defensive bonus.`;
    case "a side's skeletal legions fight with fanaticism under their undead king":
      return `${fact.sideName}'s skeletal legions fight with undying fanaticism under their Undead king! (+${String(fact.undeadKingFanaticismPct)}% strength)`;
    case "a side's monsters are driven to savage fury":
      return `${fact.sideName}'s monsters are driven to savage fury! (+25% strength)`;
    case "a side's skeletal legions know no fear":
      return `${fact.sideName}'s skeletal legions know no fear (+${String(fact.undeadHeroFanaticismPct)}% strength — undying fanaticism).`;
    case "the attacker's forces fight with fanatical zeal":
      return `${fact.atkName}'s forces fight with fanatical zeal! (+30% attacking strength)`;
    case 'the defenders fight with fanatical zeal on consecrated ground':
      return `✨ On the consecrated ground of ${fact.provName}, ${fact.defName}'s defenders fight before the altars of their gods with fanatical zeal! (+30% defending strength)`;
    case "the defender's forces fight with fanatical zeal":
      return `${fact.defName}'s forces fight with fanatical zeal! (+30% defending strength)`;
    case 'the caster casts a spell before the battle':
      return `✨ **Pre-battle Magic: ${fact.casterName} casts ${fact.spellName}** (${fact.schoolLabel} ${String(fact.spellLevel)}) — ${String(fact.castChance)}% [roll ${String(fact.castRoll)}${fact.castMark}]`;
    case 'the spell before the battle fizzles':
      return `  Spell fizzles.`;
    case "a fireball halves the enemy's strongest units":
      return `  🔥 Fireball halves the enemy's ${fact.fireballTargetsWords}, ${fact.fireballHitUnitNames}.`;
    case "a telekinetic storm scatters the enemy commander's formations":
      return `  🌀 Telekinetic Storm scatters ${fact.enemyCommanderName}'s formations — their Tactical command is cut to half effectiveness this battle.`;
    case 'a telekinetic storm finds no tactical command to disrupt':
      return `  🌀 Telekinetic Storm rages, but ${fact.enemyCommanderName} has no tactical command to disrupt here.`;
    case "a psychic blast severs the enemy commander's bond with his beasts":
      return `  🧠 Psychic Blast severs ${fact.enemyCommanderName}'s bond with their beasts — their Druid skill is negated this battle.`;
    case 'a lightning bolt weakens enemy units':
      return `  ⚡ Lightning Bolt: ${String(fact.unitCount)} enemy unit${fact.unitsPlural} lose 20% strength.`;
    case "a curse withers the enemy commander's skill":
      return `  ☠ Curse withers ${fact.enemyCommanderName}'s ${fact.cursedSkillLabel} — halved for this battle.`;
    case "control undead turns an enemy undead unit to the caster's side":
      return `  ☠ Control Undead turns the ${fact.turnedUnitName} to ${fact.casterName}'s side!`;
    case 'control undead finds no enemy undead to turn':
      return `  ☠ Control Undead finds no enemy undead to turn.`;
    case 'a holy symbol weakens enemy undead units':
      return `  ✝ Holy Symbol: ${String(fact.undeadUnitCount)} enemy undead unit${fact.undeadUnitsPlural} at 75% str.`;
    case 'a holy symbol finds no enemy undead to smite':
      return `  ✝ Holy Symbol: no enemy undead to smite.`;
    case 'spiritwrack halves enemy missile units':
      return `  Spiritwrack: ${String(fact.missileUnitCount)} enemy missile unit${fact.missileUnitsPlural} at half str.`;
    case 'spiritwrack finds no enemy missile troops':
      return `  Spiritwrack: enemy fields no missile troops.`;
    case "a unit's power gathers but never strikes":
      return `〰 ${fact.unitName} gather for **${fact.powerName}**, but the moment passes — the strike never lands (${String(fact.strikeChancePct)}% chance${fact.druidWords}).`;
    case 'a unit uses its power in battle':
      return `✨ ${fact.unitName} — **${fact.powerName}**: "${fact.powerFlavour}"`;
    case "a unit's power hits all enemy units":
      return `  Hits all ${String(fact.enemyUnitCount)} enemy units: −${String(fact.damage)} str.`;
    case "a unit's power hits one enemy unit":
      return `  Hits ${fact.struckUnitName}: −${String(fact.damage)} str.`;
    case "the hero's archers find no target among the forest wardens":
      return `🌲 ${fact.heroName}'s archers can find no target — Forest Wardens hold the thickets and the volley never comes.`;
    case "the hero's archery volley begins":
      return `🏹 ${fact.heroName}'s archery: ${String(fact.missileUnitCount)} unit${fact.missileUnitsPlural}${fact.wordsIfDoubleVolleys}${fact.wordsIfOneMoreShot}${fact.wordsIfPreparedGround}`;
    case "a unit's shot glances off its target":
      return `  ${String(fact.shooterName)} → ${String(fact.targetUnitName)}: shot glances off the ${String(fact.whyTheShotGlances)}.`;
    case "a unit's shot weakens its target":
      return `  ${fact.shooterName} → ${fact.targetUnitName}: −${String(fact.damage)} str${fact.wordsIfFlying}${fact.wordsIfThickHide}${fact.wordsIfAbilityMultiplier}${fact.wordsIfSoftenedToTheLimit}.`;
    case "a unit's target is already softened as far as arrows allow":
      return `  ${String(fact.shooterName)} → ${String(fact.targetUnitName)}: already softened as far as arrows allow.`;
    case "a side's whale cohort sinks an enemy ship":
      return `🌊 A ${String(fact.sideName)} whale cohort breaches beneath the ${String(fact.targetUnitName)} and rolls her over — she goes down with all hands before a shot is fired.`;
    case "the terrain's effect on each side":
      return `📊 Terrain (${fact.terrain}): ${fact.terrainNotes}`;
    case 'hosts airborne over open water fight at a penalty':
      return `⚠ ${fact.airborneHostsWords} airborne over open water: land units carried by flyers fight at ×${String(fact.seaAirborneLandPenalty)}, and the flyers carrying them at ×${String(fact.seaAirborneFlyerPenalty)}.`;
    case 'land units fight at sea at a penalty':
      return `⚠ Land units fighting at sea: ×${String(fact.seaLandPenalty)} strength penalty.`;
    case "a side's realm discoveries strengthen its army":
      return `${String(fact.sideName)}'s realm discoveries: +${String(fact.discoveriesBonusPct)}% army str.`;
    case "the illusory ground of the province confuses a side's forces":
      return `  🌫 The ever-shifting illusory ground of ${fact.provName} throws ${fact.sideName}'s forces into confusion — every unit fights as though mired in the worst terrain for its kind (at least −15% strength).`;
    case "the sanctuary wards of the province sap a side's attackers":
      return `  ✨ The sanctuary wards of ${String(fact.provName)} sap ${String(fact.sideName)}'s attackers (−25% strength).`;
    case 'the attacker unfolds a grand stratagem':
      return `  📜 ${fact.atkName} unfolds a Grand Stratagem — the attack lands at +20% strength.`;
    case 'the defender unfolds a grand stratagem':
      return `  📜 ${String(fact.defName)} unfolds a Grand Stratagem — the defence holds at +20% strength.`;
    case "the defender's feigned retreat springs shut":
      return `  🏳 ${String(fact.defName)}'s Feigned Retreat springs shut — the counter-attack strikes at +25% strength.`;
    case 'the attacker storms ashore in a raid on the coast':
      return `  ⚓ ${String(fact.atkName)} storms ashore in a Raid the Coast — the amphibious assault hits at +25% strength.`;
    case "the consecrated ground of the province weakens the attacker's host":
      return `✨ The ground of ${fact.provName} is consecrated — ${fact.atkName}'s ${fact.attackersAlignment} host falters on hallowed earth (−15% strength).`;
    case "the battle's statistics begin":
      return `📊 **Battle stats:**`;
    case 'the fortune of the battle':
      return `  ${fact.fortuneWords}`;
    case "the battle's outcome and its margin":
      return `📊 Outcome: **${fact.winnerName} wins** — ${fact.severity} (margin ${fact.marginPct}% of combined strength after fortune)`;
    case "a side's war-horn of the plains lets its free lances ride in rough country":
      return `📯 ${String(fact.sideName)}'s War-Horn of the Plains sounds — the Free Lances ride the broken enemy down even in ${String(fact.terrain)} country.`;
    case "a side's free lances find no room to ride":
      return `🐎 ${fact.sideName}'s Free Lances find no room to ride in ${fact.terrain} country — the broken enemy scatters into cover.`;
    case "the loser's dwarven guard leave the manticore pride nothing to hunt":
      return `🛡 ${fact.loserName}'s Dwarven Guard lock shields as they give ground — ${fact.winnerName}'s Manticore Pride find no broken backs to hunt.`;
    case "the winner's manticore pride hunt the broken companies":
      return `🦂 ${fact.winnerName}'s Manticore Pride hunt the broken companies down before they can get clear (+${String(fact.runThemDownPct)}% losses to ${fact.loserName}).`;
    case "the loser's dwarven guard leave the shark shoals nothing in the water":
      return `🛡 ${String(fact.loserName)}'s Dwarven Guard lock shields as they give ground — ${String(fact.winnerName)}'s Shark Shoals find nothing in the water.`;
    case "the winner's shark shoals tear into the beaten crews":
      return `🦈 Feeding Frenzy — ${String(fact.winnerName)}'s Shark Shoals tear into ${String(fact.loserName)}'s beaten crews as they founder (+${String(fact.runThemDownPct)}% losses to ${String(fact.loserName2)}).`;
    case 'a unit is cut down with no escape':
      return `— ${fact.unitName} are cut down with no escape!`;
    case "a side's other forces survive the engagement":
      return `— ${fact.allOrAllOther} forces survive the engagement.`;
    case 'no units were left on the field to count':
      return `— No units were left on the field to count.`;
    case 'the attacker wins the battle and seizes the province':
      return `After ${fact.severityArticle} ${fact.severity} battle, ${fact.atkName}'s forces ${fact.winVerb} ${fact.defName}'s army and seize ${fact.provName}!`;
    case "the attacker's casualties begin":
      return `⚔ **${fact.atkName}'s forces** (attacker):`;
    case "the defender's casualties begin":
      return `🛡 **${fact.defName}'s forces** (defender):`;
    case "the loser's dwarven guard leave the free lances no broken backs":
      return `🛡 ${fact.loserName}'s Dwarven Guard lock shields as they give ground — ${fact.winnerName}'s Free Lances find no broken backs to ride down.`;
    case "the winner's free lances ride down the broken companies":
      return `🐎 ${fact.winnerName}'s Free Lances ride down the broken companies (+${String(fact.rideDownPct)}% losses to ${fact.loserName}).`;
    case "the loser's dwarven guard leave the warg riders no broken backs":
      return `🛡 ${fact.loserName}'s Dwarven Guard lock shields as they give ground — ${fact.winnerName}'s Warg Riders find no broken backs to run down.`;
    case "the winner's warg riders run down the broken companies":
      return `🐺 ${fact.winnerName}'s Warg Riders run down the broken companies before they can get clear (+${String(fact.runThemDownPct)}% losses to ${fact.loserName}).`;
    case "the winner's corsairs close the sea lanes to the loser":
      return `⛵ ${String(fact.winnerName)}'s corsairs close the sea lanes — ${String(fact.loserName)} cannot slip away by water.`;
    case "the loser's skeletal host stands its ground in a deathless march":
      return `💀 Deathless March — ${fact.loserName}'s skeletal host has no fear to exploit: none are cut down in flight, and the dead stand their ground in ${fact.provName}.`;
    case "the loser's dwarven guard hold a shield fort with no road out":
      return `🛡 Shield Fort — with no road out, ${fact.loserName}'s Dwarven Guard lock shields where they stand. None are cut down in flight, and ${fact.provName} remains contested.`;
    case 'the defender has nowhere to retreat':
      return `${fact.defName} has nowhere to retreat — their forces take additional casualties!`;
    case "the defender's stronger host is pushed back but stays":
      return `${fact.defName}'s forces are pushed back but not broken — still the stronger host (${fact.stayingHostStrength} vs ${fact.victorsStrength} on the same footing, before fortune), they hold their ground in ${fact.provName} and re-form to fight on rather than retreat.`;
    case "the loser's force is destroyed to the last":
      return `📊 ${fact.loserName}'s force is destroyed to the last — commander and column both.`;
    case "the loser's dwarven guard withdraw behind a shield fort":
      return `🛡 Shield Fort — ${fact.loserName}'s Dwarven Guard withdraw in good order behind locked shields.`;
    case 'the loser retreats to a province':
      return `${fact.loserName} retreats to ${fact.retreatToName}.`;
    case "the loser's surviving forces":
      return `📊 ${fact.loserName}'s surviving forces: ${fact.survivingForces}.`;
    case "the loser's forces are completely destroyed and he retreats alone":
      return `📊 ${fact.loserName}'s forces are completely destroyed — they retreat alone.`;
    case "the attacker wins the battle but the defender's survivors hold the province":
      return `After ${fact.severityArticle} ${fact.severity} battle, ${fact.atkName}'s forces ${fact.winVerb} ${fact.defName}'s army — but ${fact.defName2}'s survivors do not yield ${fact.provName}.`;
    case "the attacker's assault is repelled and driven from the province":
      return `${fact.atkName}'s assault is repelled! After ${fact.severityArticle} ${fact.severity} engagement, ${fact.defName} drives the attackers from ${fact.provName}.`;
    case 'the attacker has nowhere to retreat':
      return `${fact.atkName} has nowhere to retreat — their forces take additional casualties, ${fact.howTheyAreCutDown} with no escape!`;
    case "the attacker's stronger host is thrown back but stays":
      return `${fact.atkName}'s assault is thrown back but their host is still the stronger (${fact.stayingHostStrength} vs ${fact.victorsStrength} on the same footing, before fortune) — they hold the field in ${fact.provName} and re-form to press the attack again rather than retreat.`;
    case "the attacker's assault is repelled but not driven from the province":
      return `${fact.atkName}'s assault is repelled! After ${fact.severityArticle} ${fact.severity} engagement, ${fact.defName} throws the attackers back — but they are not yet driven from ${fact.provName}.`;
    case "a commander's force is demoralised":
      return `\u{1F4C9} ${fact.commanderName}'s force is demoralised — ${fact.why} (−20% strength this battle).`;
    case 'a commander rides out and challenges the other to single combat':
      return `— ${fact.challengerName} rides out and challenges ${fact.challengedName} to single combat. —`;
    case 'the challenged commander will not answer the call':
      return `${fact.challengedName} will not answer the call, and the watching ranks see it.`;
    case 'a personal duel before the battle begins':
      return `\u2694 — Personal duel: ${fact.challengerName} vs ${fact.challengedName} —`;
    case "the duel's loser falls at death's door but is not slain":
      return `\u{1FA79} ${fact.loserName} falls in the duel — at death's door, but not slain.`;
    case "the duel's loser is slain":
      return `\u{1F480} ${fact.loserName} is slain in the duel!`;
    case 'the duel ends inconclusively':
      return `The duel ends inconclusively — both commanders live to fight on, and neither host loses heart.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`a battle's line records a fact with no words: ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
