// ── THE WORDS OF A BATTLE'S LINES (plan P1-12c3, c5 and c6: P1-12's Decisions of 2026-10-24, Decisions 2 and 5) ──
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
    case 'a hero cries out his battlecry to his foe':
      return `📣 ${String(fact.heroName)} cries out to ${String(fact.foeName)}: “${String(fact.battlecry)}”`;
    case "a side's Druid cannot fully command its units":
      return `⚠ Druid shortfall — ${fact.sideName} cannot fully command ${String(fact.unitCount)} unit${fact.unitsPlural}: ${fact.shortfallUnitsWords}.`;
    case 'the attacker moves into a province held by its defenders and a battle is initiated':
      return `➡️ ${fact.cName}${fact.wordsOfTheAttackersRealm} moves into ${fact.provName}, held by ${fact.heldByName} — a battle is initiated.`;
    case 'the guard is slain before his host, and a sergeant of the garrison takes up the banner':
      return `⚑ With ${String(fact.guardName)} slain before the host, a battle-worn sergeant of the garrison takes up the fallen banner — the defenders close ranks and fight on, leaderless but unbowed.`;
    case 'the attacker is cut down before the lines join, and the eldest captain takes command':
      return `⚑ With ${fact.cName} cut down before the lines were even joined, the eldest captain of the host takes command — the attack goes in regardless, though without their fallen leader's guiding hand.`;
    case "the attacker's Tactical command does not apply at sea":
      return `📊 ${fact.cName}'s Tactical command does not apply in sea terrain.`;
    case 'the defenders of a province defend ground held justly':
      return `✝ Righteous Defence — the defenders of ${fact.provName} stand on ground they hold justly (+10% defence).`;
    case 'the defenders fight on home soil':
      return `The defenders fight on home soil, gaining an additional ×1.2 bonus.`;
    case 'the attacker casts a spell before the battle against the defenders':
      return `✨ **Pre-battle Magic: ${fact.cName} casts ${fact.spellName}** (${fact.schoolLabel} ${String(fact.spellLevel)}) — cast chance ${String(fact.castChance)}% [roll ${String(fact.castRoll)}${fact.castMark}]`;
    case "a fireball engulfs the defenders' strongest units":
      return `  🔥 Fireball engulfs the enemy's ${fact.fireballTargetsWords}, ${fact.fireballHitUnitNames} — halved this battle.`;
    case 'a telekinetic storm finds no command among leaderless defenders':
      return `  🌀 Telekinetic Storm rages, but these leaderless defenders have no tactical command to unmake.`;
    case 'a psychic blast finds no commander among the defenders':
      return `  🧠 Psychic Blast reaches out, but these defenders have no commander to unmake.`;
    case 'a lightning bolt sears the defending units':
      return `  ⚡ Lightning Bolt sears ${String(fact.unitCount)} enemy unit${fact.unitsPlural} — each loses 20% of its strength this battle.`;
    case 'a curse finds no commander among leaderless defenders':
      return `  ☠ Curse seeks a commander to wither, but these defenders are leaderless.`;
    case "control undead turns a defending undead unit to the attacker's side":
      return `  ☠ Control Undead turns the ${fact.turnedUnitName} — it defects to ${fact.cName}'s side!`;
    case 'control undead finds no undead among the defenders':
      return `  ☠ Control Undead reaches out, but the enemy fields no undead to turn.`;
    case 'a holy symbol sears the defending undead':
      return `  ✝ Holy Symbol sears the enemy undead — ${String(fact.undeadUnitCount)} undead unit${String(fact.undeadUnitsPlural)} fight at 75% strength.`;
    case 'a holy symbol finds no undead among the defenders':
      return `  ✝ Holy Symbol blazes, but no undead stand among the defenders.`;
    case "spiritwrack halves the defenders' missile units":
      return `  Spiritwrack unstrings the enemy's bows — ${String(fact.missileUnitCount)} missile unit${fact.missileUnitsPlural} fight at half strength.`;
    case 'spiritwrack finds no missile troops among the defenders':
      return `  Spiritwrack howls, but the enemy fields no missile troops.`;
    case "the attacker's spell before the battle fizzles":
      return `  The spell fizzles — no pre-battle magical effect.`;
    case "a unit's power hits every defending unit":
      return `  ${fact.powerName} hits all ${String(fact.unitCount)} defending units: −${String(fact.damage)} strength each.`;
    case "a unit's power hits one unit of the other side":
      return `  ${fact.powerName} hits ${fact.struckUnitName}: −${String(fact.damage)} strength this battle.`;
    case 'a whale cohort sinks a defending ship before a shot is fired':
      return `🌊 A whale cohort breaches beneath the ${fact.targetUnitName} and rolls her over — she goes down before a shot is fired.`;
    case "the attacker's archery volley begins":
      return `🏹 **Pre-battle Archery Phase** — ${String(fact.missileUnitCount)} ranged unit${fact.missileUnitsPlural}${fact.wordsIfDoubleVolleys}${fact.wordsIfOneMoreShot}`;
    case 'a unit fires at its target and the shot glances off':
      return `  ${String(fact.shooterName)} fires at ${String(fact.targetUnitName)}, but the shot glances off the ${String(fact.whyTheShotGlances)}.`;
    case 'a unit fires at its target and weakens it':
      return `  ${fact.shooterName} fires at ${fact.targetUnitName}: −${String(fact.damage)} strength${fact.wordsIfFlying}${fact.wordsIfThickHide}${fact.wordsIfAbilityMultiplier}${fact.wordsIfSoftenedToTheLimit}.`;
    case "an attacking unit's target is already softened as far as arrows allow":
      return `  ${String(fact.shooterName)} fires at ${String(fact.targetUnitName)}, but they are already softened as much as arrows can manage.`;
    case "the attacker's archery volley's total":
      return `📊 Archery phase total: −${String(fact.totalDamage)} strength spread across defenders (each unit softened by at most ${String(fact.arrowSofteningCapPct)}%).`;
    case 'the defender casts a spell before the battle':
      return `✨ Defender Magic: ${fact.casterName} casts ${fact.spellName} (${fact.schoolLabel} ${String(fact.spellLevel)}) — ${String(fact.castChance)}% chance [roll ${String(fact.castRoll)} ${fact.castMark}]`;
    case "a fireball halves the attackers' strongest unit":
      return `  🔥 Fireball halves the attackers' strongest unit, ${fact.targetUnitName} (−${String(fact.strengthLost)}).`;
    case 'a lightning bolt sears the attacking units':
      return `  ⚡ Lightning Bolt sears ${String(fact.unitCount)} attacking unit${fact.unitsPlural} — each loses 20% of its strength.`;
    case 'control undead finds no undead among the attackers':
      return `  ☠ Control Undead finds no undead among the attackers.`;
    case 'a holy symbol sears the attacking undead':
      return `  ✝ Holy Symbol sears the attacking undead — ${String(fact.undeadUnitCount)} unit${fact.undeadUnitsPlural} at 75% strength.`;
    case 'a holy symbol finds no undead among the attackers':
      return `  ✝ Holy Symbol blazes, but no undead assail this province.`;
    case "spiritwrack halves the attackers' missile units":
      return `  Spiritwrack unstrings the attackers' bows — ${String(fact.missileUnitCount)} missile unit${fact.missileUnitsPlural} at half strength.`;
    case 'spiritwrack finds no missile troops among the attackers':
      return `  Spiritwrack howls, but the attackers field no missile troops.`;
    case "the defender's spell before the battle fizzles":
      return `  The spell fizzles — no defensive magical effect.`;
    case "the attacker's lightning advance catches the defenders unready":
      return `⚡ ${String(fact.cName)}'s Lightning Advance catches the defenders completely unready — they fight with no terrain advantage, no pre-battle magic and no answering volley.`;
    case "the defenders' archers find no target among the attacker's forest wardens":
      return `🌲 The defenders' archers can find no target — ${fact.cName}'s Forest Wardens hold the thickets and the answering volley never comes.`;
    case "the defenders' archery volley begins":
      return `🏹 **Defender Archery Phase** — ${String(fact.missileUnitCount)} ranged unit${fact.missileUnitsPlural}${fact.wordsIfPreparedGround}`;
    case "a defending unit's target is already softened as far as arrows allow":
      return `  ${String(fact.unitName)} fires at ${String(fact.targetUnitName)}, but they are already as softened as arrows can manage.`;
    case "the defenders' archery volley's total":
      return `📊 Defender archery total: −${String(fact.totalDamage)} strength spread across attackers (each unit softened by at most ${String(fact.arrowSofteningCapPct)}%).`;
    case 'a defending unit uses its power in battle':
      return `✨ ${fact.unitName} (defending) — **${fact.powerName}**: "${fact.powerFlavour}"`;
    case "a unit's power hits every attacking unit":
      return `  ${fact.powerName} hits all ${String(fact.unitCount)} attacking units: −${String(fact.damage)} strength each.`;
    case "the terrain's effect on the attacker's units":
      return `📊 Terrain (${fact.terrain}): ${fact.cName} — ${fact.terrainNotes}`;
    case 'hosts airborne over open water fight at a penalty against the defenders':
      return `⚠ Airborne over open water: land units carried by flyers fight at ×${String(fact.seaAirborneLandPenalty)}, and the flyers carrying them at ×${String(fact.seaAirborneFlyerPenalty)}.`;
    case 'land units fight at sea at a penalty against the defenders':
      return `⚠ Land units at sea: ×${String(fact.seaLandPenalty)} strength penalty.`;
    case 'the attacker unfolds a grand stratagem against the defenders':
      return `  📜 ${String(fact.cName)} unfolds a Grand Stratagem — the assault lands at +20% strength.`;
    case 'the attacker storms ashore in a raid on the coast against the defenders':
      return `  ⚓ ${String(fact.cName)} storms ashore in a Raid the Coast — +25% strength.`;
    case "the attacker's monsters are driven to savage fury":
      return `${fact.cName}'s monsters are driven to savage fury under their Evil overlord! (+25% strength)`;
    case "the attacker's troops fight with fanatical zeal":
      return `Seized by religious fervour, ${fact.cName}'s troops fight with fanatical zeal! (+30% strength)`;
    case "the attacker's realm discoveries strengthen his army":
      return `Realm discoveries grant +${String(fact.discoveriesArmyBonusPct)}% army strength.`;
    case "the attacker's free lances find no room to ride":
      return `🐎 ${fact.cName}'s Free Lances find no room to ride in ${fact.terrain} country.`;
    case 'the attacker sweeps into a province with no one left to stand against him':
      return `${fact.cName}'s forces sweep into ${fact.provName} — nothing is left to stand against them.`;
    case 'the attacker wins the battle against the defenders':
      return `After ${fact.severityArticle} ${fact.severity} engagement (margin ${fact.marginPct}% of total strength), ${fact.cName}'s forces ${fact.winVerb} ${fact.guardName}!`;
    case "the attacker's warg riders halve his losses":
      return `🐺 The warg packs are into the defenders before they can set themselves — the business is over quickly, and ${fact.cName}'s losses are halved.`;
    case 'every defending unit was lost before the lines closed':
      return `— None left to fight: every defending unit was lost before the lines closed.`;
    case "the defenders' dwarven guard leave the attacker's free lances no broken backs":
      return `🛡 The defenders' Dwarven Guard lock shields where they stand — ${fact.cName}'s Free Lances find no broken backs to ride down.`;
    case "the attacker's free lances ride down the defenders' broken companies":
      return `🐎 ${fact.cName}'s Free Lances ride down the broken companies across open ground (+${String(fact.extraLossesPct)}% losses).`;
    case 'a defending unit is destroyed in the rout':
      return `— ${fact.defendingUnitName}${fact.facedClauseWords} were destroyed in the rout!`;
    case 'the defenders have nowhere to retreat and hold a shield fort':
      return `🛡 Shield Fort — the defenders of ${fact.provName} have nowhere to retreat, so they lock shields where they stand. None are cut down.`;
    case 'the defenders have nowhere to retreat and take further losses':
      return `The defenders of ${fact.provName} have nowhere to retreat — they are pinned against their own ground and take further losses!`;
    case 'the attacker is repelled by the defenders':
      return `${fact.cName}'s forces are repelled! After ${fact.severityArticle} ${fact.severity} engagement (margin ${fact.marginPct}%), ${fact.defName2} hold their ground — ${fact.holdWords}`;
    case 'a defending unit is destroyed in the fighting':
      return `— ${fact.defendingUnitName}${fact.facedClauseWords} were destroyed in the fighting.`;
    case "the guard's host is destroyed and he is a masterless hero":
      return `— but every soldier of ${fact.guardName}'s band lies dead. With no host left to command, they are ${fact.provName}'s guardian no more — a masterless hero now.`;
    case "the attacker's dwarven guard leave the defenders' free lances no broken backs":
      return `🛡 ${fact.cName}'s Dwarven Guard lock shields as they give ground — the defenders' Free Lances find no broken backs to ride down.`;
    case "the defenders' free lances ride down the attacker's broken companies":
      return `🐎 The defenders' Free Lances range across the open ground and ride down ${fact.cName}'s broken companies (+${String(fact.extraLossesPct)}% losses).`;
    case "the attacker's corsairs take his beaten force back to the ships":
      return `⛵ ${String(fact.cName)}'s corsairs stand off the shore with boats ready — the beaten force pulls back to the ships in good order rather than being cut down.`;
    case "the attacker's shield-wall holds and the infantry stand their ground":
      return `${fact.cName}'s Shield-Wall holds — the infantry refuse to retreat and stand their ground, come what may.`;
    case 'the attacker has nowhere to retreat and takes further losses':
      return `${fact.cName}'s forces have nowhere to retreat — they rally desperately but take heavy additional losses!`;
    case 'an attacking unit is cut down in the rout with no escape':
      return `— ${fact.unitName} are cut down in the rout — no escape!${fact.wordsIfSkeletal}`;
    case "the attacker's forces retreat to a province":
      return `${fact.cName}'s forces retreat to ${fact.retreatToName}.`;
    case "the onlookers' summary of a battle":
      return `⚔ Battle at ${fact.provName}: ${fact.outcomeWords}.`;
    case 'the most seasoned captain takes command of the combined host':
      return `\u{1F396} ${fact.leaderName} takes command of the combined host at ${fact.provName} \u2014 the most seasoned captain on the field, and ${fact.previousCommanderName}'s troops fall in behind him.`;
    case 'the blood harvest claims offerings from the fallen enemy units':
      return `\u{1FA78} Blood Harvest — the old gods claim their due from ${String(fact.fallenUnitCount)} fallen enemy unit${fact.fallenUnitsPlural}: +${String(fact.offeringsGold)}g in offerings.`;
    case "the iron throne of skulls raises the enemy's fallen as skeletons":
      return `\u{1F480} Iron Throne of Skulls — ${String(fact.raisedCount)} of the enemy's fallen claw their way up to serve as your skeletons.`;
    case 'terror radiates from a province after an evil victory':
      return `💀 Terror radiates from ${fact.provName}${fact.wordsIfTheSurroundingLands} — any army that next defends there fights demoralised (−${String(fact.terrorPctPerStack)}% per terror, stacking).`;
    case 'terror lingers in a province and its defenders fight demoralised':
      return `💀 Terror lingers in ${fact.provName} — defenders fight at −${String(fact.terrorPct)}% strength (${String(fact.terrorStacks)} terror stack${fact.terrorStacksPlural} from earlier Evil victories nearby).`;
    case 'a unit is cut down and rises again by its regenerating hide':
      return `— ${fact.unitReference} are cut down — and rise again, the Regenerating Hide knitting flesh as they stagger clear.`;
    case 'a unit dies in the battle':
      return `— ${fact.unitReference} ${fact.diedVerb}${fact.wordsIfSkeletal}`;
    case 'a unit is promoted after the battle':
      return `— ${fact.unitReferenceAtItsOldQuality} ${fact.promoteVerb} ${fact.unitQuality}!`;
    case 'a unit falls back behind the shield wall in good order':
      return `— ${fact.unitReference} fall back behind the shield wall in good order.`;
    case 'a unit keeps its nerve under the knightly example':
      return `— ${fact.unitReference} keep their nerve under the Knightly Example of the Gilded Lances and lose nothing in defeat.`;
    case 'a unit loses heart in defeat and is reduced a tier':
      return `— ${fact.unitReferenceAtItsOldQuality} lost heart in defeat, reduced to ${fact.unitQuality}.`;
    case 'a unit improves a tier despite defeat':
      return `— Despite defeat, ${fact.unitReferenceAtItsOldQuality} improved to ${fact.unitQuality}!`;
    case "a hero not at war with the province's realm gains a host inside it":
      return `👁 ${fact.cName}${fact.realmTag} now leads ${String(fact.unitCount)} unit${fact.unitsPlural} inside your province of ${fact.provName}, but makes no move against it — ${fact.relationWords}. ${fact.provName2} remains yours.`;
    case "a hero's new host is still forming up in a province":
      return `${fact.cName}'s new host is still forming up in ${fact.provName} — whether the province can be taken will be settled before the season's marches begin.`;
    case 'no one stands to defend a province and the hero takes control of it':
      return `No one stands to defend ${fact.provName} — ${fact.cName} takes control of it for ${fact.playerName}!`;
    case 'with fresh troops the hero takes control of a province':
      return `With fresh troops now at their back, ${fact.cName} takes control of ${fact.provName} for ${fact.playerName}!`;
    case 'the hero turns a newly gathered host on a province and a battle is initiated':
      return `➡️ ${fact.cName}${fact.realmTag} turns a newly-gathered host on ${fact.provName}, held by ${fact.heldByName} — a battle is initiated.`;
    case 'the defenders riding in were keeping watch and are already in the line':
      return `🛡 ${fact.ridersNames} ${fact.wasOrWere} keeping watch over ${fact.provName} and ${fact.isOrAre} already in the line when ${fact.cName}'s ${fact.whatTheHostDoes} — ${fact.provName2} is defended, not retaken.`;
    case 'the defender is reinforced by other heroes in the defence of a province':
      return `${fact.defenderName} is reinforced by ${fact.reinforcementsNames} in the defence of ${fact.provName}!`;
    case "the province's standing troops rally to the defender":
      return `🛡 The standing troops of ${fact.provName} rally to ${fact.leaderName}: the garrison (${String(fact.garrisonUnitCount)} unit${fact.garrisonUnitsPlural} — ${fact.garrisonWords}) joins the defence.`;
    case 'a hero fell in the battle line beside the commander of the defence':
      return `⚔ ${String(fact.heroName)} stood in the battle line beside ${String(fact.leaderName)} in the defence of ${String(fact.provName)}, and fell there — the full account is under ${String(fact.leaderName2)}.`;
    case 'a hero stands in the battle line beside the commander of the defence':
      return `⚔ ${fact.heroName} stands in the battle line beside ${fact.leaderName} in the defence of ${fact.provName} — the full account is under ${fact.leaderName2}.`;
    case "the province's standing troops fall back with the defender":
      return `The standing troops of ${String(fact.provName)} fall back to ${String(fact.fellBackToName)} with ${String(fact.defenderName)} rather than be left to the enemy.`;
    case "the province's standing troops fall in with the defender as the battle continues":
      return `🛡 The standing troops of ${fact.provName} fall in with ${fact.defenderName} and fight on at their side as the battle continues.`;
    case "the province's garrison is overwhelmed as the province falls":
      return `🛡 The garrison of ${fact.provName} is overwhelmed as the province falls — ${fact.overrunUnitsNames} ${fact.isOrAre} cut down defending the walls.`;
    case 'the hero has the better of the fighting but the guard still holds the field':
      return `⚔ ${fact.hostName} has the better of the fighting in ${fact.provName}, but ${fact.guardName} still holds the field with ${String(fact.guardUnitCount)} unit${fact.guardUnitsPlural} — the province is not yet taken.`;
    case 'the hero has the better of the fighting but leaderless defenders still hold the field':
      return `⚔ ${String(fact.hostName)} has the better of the fighting in ${String(fact.provName)}, but ${String(fact.leaderlessUnitCount)} leaderless defending unit${String(fact.leaderlessUnitsPlural)} still hold the field — the province is not yet taken.`;
    case 'the hero has the better of the fighting but enemy forces still hold their ground':
      return `⚔ ${fact.hostName} has the better of the fighting in ${fact.provName}, but enemy forces still hold their ground — the province is not yet taken.`;
    case "the hero has the better of the fighting but the province's garrison still holds":
      return `⚔ ${String(fact.hostName)} has the better of the fighting in ${String(fact.provName)}, but its garrison still ${String(fact.whatTheGarrisonDoes)} — the province is not yet taken.`;
    case 'the hero overcomes the defenders and claims the province for his realm':
      return `${fact.hostName} overcomes the defenders and claims ${fact.provName} for ${fact.playerName}!`;
    case "the province's owner learns his defenders still hold against the hero":
      return `⚔ ${fact.cName}${fact.realmTag} fought for ${fact.provName} this phase and had the better of it, but your defenders still hold the ground — ${fact.provName2} is not yet taken. ${fact.hostWords} stands there with ${String(fact.unitCount)} unit${fact.unitsPlural}.`;
    case "the province's owner learns the hero was beaten back":
      return `🛡 ${fact.cName}${fact.realmTag} fought for ${fact.provName} this phase and was beaten back — ${fact.provName2} remains yours.`;
    case "a beaten guard's surviving unit breaks ranks and flees as mercenaries":
      return `— ${fact.unitName} break ranks and flee${fact.wordsIfTheVictorsHost} — they now roam as mercenaries near ${fact.provName}.`;
    case "a beaten guard's surviving unit loses heart and is reduced a tier":
      return `— ${fact.unitNameAtItsOldQuality} lost heart in defeat, reduced to ${fact.unitQuality} — ${fact.wordsIfTheVictorsHost}they rally around ${fact.guardName}.`;
    case "a beaten guard's surviving unit holds its ground unbroken":
      return `— ${fact.unitName} hold their ground unbroken${fact.wordsIfTheVictorsHost} and rally around ${fact.guardName}.`;
    case "a side's strength ladder begins":
      return `  ${fact.roleWords} (${fact.sideName}): ${fact.unitsWords} — strength **${String(fact.strength)}**`;
    case "the strength ladder's units":
      return `    · Units: base ${String(fact.baseStrength)} → ${String(fact.unitsStrength)}${fact.wordsIfUnitModifiers}`;
    case "the strength ladder's command":
      return `    · Command: ${String(fact.unitsStrength)} → ${String(fact.commandStrength)}${fact.wordsIfCommand}`;
    case "the strength ladder's force-wide modifiers":
      return `    · Whole force: ${String(fact.commandStrength)} ${fact.forceModifiersWords} = ${String(fact.wholeForceStrength)}`;
    case 'the strength ladder has no force-wide modifiers':
      return `    · Whole force: no force-wide modifiers — ${String(fact.wholeForceStrength)}`;
    case "the strength ladder's pre-battle damage":
      return `    · Pre-battle volleys & spells: ${String(fact.wholeForceStrength)} − ${String(fact.preBattleDamage)} = ${String(fact.afterPreBattleDamage)} (${fact.unitsHitWords} hit; taken off the finished figures)`;
    case "the strength ladder's battle lines":
      return `    · Battle lines (front of ${String(fact.frontWidth)}): ${String(fact.afterPreBattleDamage)} → ${String(fact.battleLinesStrengthWords)} (${fact.gridStageWords})`;
    case "the strength ladder's who faces whom":
      return `    · Who faces whom: ${String(fact.battleLinesStrength)} → **${String(fact.facingStrength)}** (${fact.facingStageWords})`;
    case "the strength ladder's units behind the front":
      return `    · Battle lines: ${String(fact.afterPreBattleDamage)} → **${String(fact.battleLinesStrength)}** (${String(fact.unitsBehindTheFrontWords)} behind the ${String(fact.frontWidth)}-unit front at ${String(fact.lineMultipliersWords)})`;
    case 'the ground allows a front of a width':
      return `📊 Battle lines — the ${fact.groundWords} ${fact.allowsWord} a front of ${String(fact.frontWidth)}.`;
    case "a side's front line in the battle grid":
      return `📊 ${fact.sideLabel} 1st │ ${fact.frontLineCells} │${fact.wordsIfFlanksAirOrReserve}`;
    case "a side's second line in the battle grid":
      return `📊 ${fact.sideLabel} 2nd │ ${fact.secondLineCells} │`;
    case 'the scouting side chooses the front':
      return `📊 Scouting — ${fact.scoutName} ${fact.whyItScouts}: ${fact.scoutName2} ${fact.whatItDoesWithTheFront} and lines up second${fact.wordsIfAdjustments}.`;
    case 'each side shifts its battle line':
      return `📊 Tactics — ${fact.otherSideName} ${fact.otherSidesMoves}; ${fact.scoutName} ${fact.scoutsMoves}.`;
    case "an unfinished battle against a province's defenders resumes":
      return `⚔ The unfinished battle for ${fact.provName} resumes — ${fact.attackersHostName} presses the attack on ${fact.defendersName}.`;
    case 'the guard still holds a contested province with survivors':
      return `💢 ${fact.guardName} still holds with survivors — ${fact.provName} remains contested and will be fought over again next phase!`;
    case 'commanderless survivors still contest a province':
      return `💢 Commanderless but unbroken, ${String(fact.survivingUnitCount)} surviving unit${String(fact.survivingUnitsPlural)} still contest ${String(fact.provName)} — the fight resumes next phase!`;
    case 'the attacker finally overcomes the defenders and claims a province':
      return `${fact.attackersHostName} finally overcomes the defenders and claims ${fact.provName}!`;
    case 'the attacker breaks off a stalled battle and retreats':
      return `${String(fact.attackersHostName)} breaks off and retreats to ${String(fact.retreatToName)}.`;
    case 'the attacker is pinned in a province with no way out':
      return `${fact.attackersHostName} is pinned in ${fact.provName} with no way out — the struggle continues next phase.`;
    case 'a contest for a province lapses as the realms are no longer at war':
      return `The contest for ${fact.provName} lapses — ${fact.attackersRealmName} and ${fact.defendersRealmName} are no longer at war, and the two hosts stand down.`;
    case "war comes to a province two realms' hosts share":
      return `⚔ War has come to ${String(fact.provName)}: ${String(fact.attackersHostName)}${String(fact.attackersRealmTag)} and ${String(fact.defendersHostName)}${String(fact.defendersRealmTag)} have stood on the same ground since the season opened, and with ${String(fact.seasonName)}'s orders done they fall upon each other.`;
    case 'an unfinished battle between two hosts resumes':
      return `⚔ The unfinished battle for ${fact.provName} resumes — ${fact.attackersHostName} and ${fact.defendersHostName} clash again.`;
    case 'the winner of a stalled battle secures a province':
      return `${fact.winnersHostName} secures ${fact.provName}!`;
    case 'a host holds a province unopposed and secures it':
      return `${fact.hostName} holds ${fact.provName} unopposed and secures it.`;
    case 'the eagle riders mark the forest wardens and spoil the ambush':
      return `🦅 ${fact.shooterName}'s Eagle Riders mark the Forest Wardens in the thickets — the Ambush is spoiled and the volley flies.`;
    case 'the gyrocopters harry a flying unit off its line':
      return `  💨 Gyrocopters harry the ${fact.targetUnitName} — driven off their line (−${String(fact.strengthLost)} strength).`;
    case "a side's gyrocopters climb to meet the enemy's flyers":
      return `🌀 ${fact.sideName}'s Gnomish Gyrocopters climb to meet the enemy's flyers — ${String(fact.engagedCount)} engaged.`;
    case "a side's units fight beside their own kin":
      return `🤝 Kinship — ${fact.sideName}: ${fact.kinshipWords}.`;
    case "a hero's host turns on a province it has shared with a realm at war":
      return `⚔ War stands between ${fact.attackersRealmName} and ${fact.ownersRealmName}, and ${fact.cName}${fact.realmTag} has held ${String(fact.unitCount)} unit${fact.unitsPlural} in ${fact.provName} since the season opened. With ${fact.seasonName}'s orders done, the host turns on the province${fact.wordsIfTheOwnersRealm}.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`a battle's line records a fact with no words: ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
