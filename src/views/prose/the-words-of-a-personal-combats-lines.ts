// ── THE WORDS OF A PERSONAL COMBAT'S LINES (plan P1-12c4: P1-12's Decisions of 2026-10-24, Decision 5) ────
// The views write the words of each fact a personal combat's lines record (src/engine/personal-combat/the-facts-a-
// personal-combats-lines-record.ts), after the engine, in the same words the engine wrote before. A kind with no words
// here is a compile error (the `never` below) and, from an untyped caller, a throw in play.
import type { TheFactOfAPersonalCombatsLine } from '../../engine/personal-combat/the-facts-a-personal-combats-lines-record.ts';

/** The words of one fact of a personal combat's lines. */
export function theWordsOfAPersonalCombatsLine(fact: TheFactOfAPersonalCombatsLine): string {
  switch (fact.kind) {
    case 'the caster cannot cast a spell without its skill':
      return `  ${fact.casterName} cannot cast ${fact.spellName} (no ${fact.schoolLabel} skill).`;
    case "the caster's spell already cast this combat":
      return `  ${String(fact.casterName)}: ${String(fact.spellName)} already cast this combat.`;
    case "the caster's spell limit reached this combat":
      return `  ${String(fact.casterName)}: ${String(fact.schoolLabel)} spell limit reached this combat.`;
    case "the caster calls on a school's arts, weaving a spell":
      return `  ${fact.casterName} calls on the ${fact.schoolWeave} arts, weaving ${fact.spellName} (${String(fact.castChance)}% to cast successfully${fact.wordsIfSw}) [roll ${String(fact.castRoll)} ${fact.castRollCastChanceMark}].`;
    case 'but the spell guts and fizzles':
      return `  …but the spell guts and fizzles, coming to nothing.`;
    case "the target is open to the school's arts":
      return `  💥 ${fact.targetName} is open to the ${fact.schoolWeave} arts — ${fact.targetWeakName}: the weave takes hold at once and bites twice as deep.`;
    case "the caster marks the target's weakness well":
      return `  📖 ${fact.casterName} marks it well: ${fact.targetWeakDesc}. Your realm will remember this of every ${fact.targetName}.`;
    case "the caster's lightning bolt arcs into the target":
      return `  ⚡ ${fact.casterName}'s Lightning Bolt arcs into ${fact.targetName} for ${String(fact.dealt)} damage. (HP ${String(fact.targetHp)})`;
    case 'a fireball engulfs the target and will burn':
      return `  🔥 Fireball engulfs ${String(fact.targetName)} — it will burn for ${String(fact.fbPct)}% of its health each round for ${String(fact.burnRounds)} rounds${String(fact.wordsIfFbWard)}.`;
    case 'the caster raises a holy symbol':
      return `  ✝ ${fact.casterName} raises a Holy Symbol — ${fact.targetName} suffers −${String(fact.pen)}% to hit${fact.wordsIfHoly}.`;
    case "the light closes the caster's hurts":
      return `  ✝ The light closes ${fact.casterName}'s hurts — ${String(fact.healed)} recovered. (HP ${String(fact.casterHp)})`;
    case "the holy light's damage":
      return `  ✝ ${fact.wordsIfHoly} — ${String(fact.dealt)} damage. (HP ${String(fact.targetHp)})`;
    case 'the caster binds the target with spiritwrack':
      return `  ${String(fact.casterName)} binds ${String(fact.targetName)} with Spiritwrack — for ${String(fact.swR)} round${String(fact.swRPlural)} it cannot cast, use its powers or use archery, and its melee is halved.${String(fact.wordsIfShr)}`;
    case "psychic blast sears the target's mind":
      return `  🧠 Psychic Blast sears ${fact.targetName}'s mind — for their next ${String(fact.stunN)} rounds they can do nothing at all: no blow, no arrow, no spell, and no flight.`;
    case 'a telekinetic storm rips the target':
      return `  🌀 Telekinetic Storm rips ${String(fact.targetName)} for ${String(fact.dealt)} damage; the strain costs ${String(fact.casterName)} ${String(fact.self)} damage. (Target HP ${String(fact.targetHp)})`;
    case 'the caster conjures a mirror image':
      return `  ${String(fact.casterName)} conjures a Mirror Image.`;
    case 'the caster weaves a second mirror image':
      return `  ${String(fact.casterName)} weaves a second Mirror Image — the competing illusions unravel and both vanish.`;
    case 'the caster conjures a phantom of the target':
      return `  🪞 ${fact.casterName} conjures a phantom of ${fact.targetName} — ${fact.targetName2} turns on their own mirror, and ${fact.casterName2} is left free to act.`;
    case 'the caster fades from sight':
      return `  ${String(fact.casterName)} fades from sight — enemies suffer \u2212${String(fact.invPct)}% to hit, +30% flee.`;
    case "the hand of death claims part of the target's health":
      return `  ☠ Hand of Death claims ${String(fact.handOfDeathBitePct)}% of ${fact.targetName}'s health — ${String(fact.dealt)} damage! (HP ${String(fact.targetHp)})`;
    case "the caster's hand of death fails":
      return `  ${fact.casterName}'s Hand of Death fails to take hold. [${String(fact.handOfDeathChancePct)}%]`;
    case "the caster's curse withers the target":
      return `  ${String(fact.casterName)}'s Curse withers ${String(fact.targetName)}'s ${String(fact.bestAbility)} — halved to ${String(fact.bestAbilityLevel)} for the fight.`;
    case "the caster's curse finds no ability":
      return `  ${String(fact.casterName)}'s Curse finds no ability in ${String(fact.targetName)} worth withering.`;
    case 'the caster seizes the undead target':
      return `  ${String(fact.casterName)} seizes the undead ${String(fact.targetName)} — helpless for ${String(fact.cuR)} rounds.`;
    case 'control undead has no hold over the living':
      return `  Control Undead has no hold over the living ${String(fact.targetName)}.`;
    case "the caster's charm washes over a crowned will":
      return `  ${String(fact.casterName)}'s Charm washes over ${String(fact.targetName)} and finds nothing to grip — a crowned will cannot be swayed.`;
    case "the caster's charm slides off a mind lately swayed":
      return `  ${String(fact.casterName)}'s Charm slides off ${String(fact.targetName)} — a mind so lately swayed is closed to enchantment for a season.`;
    case "the caster's charm breaks against the target's will":
      return `  ${String(fact.casterName)}'s Charm breaks against ${String(fact.targetName)}'s will (${String(fact.targetRefCharmResist)}% resistance) — a mind swayed before knows the feel of it, and shuts.`;
    case "the caster charms the target's wits":
      return `  ${String(fact.casterName)} charms ${String(fact.targetName)}'s wits — their next attempt to slip away will come far more easily.`;
    case 'the caster casts a spell':
      return `  ${String(fact.casterName)} casts ${String(fact.spellName)}.`;
    case 'a fighter uses a power':
      return `  ✨ ${fact.actorName} uses **${fact.spName}**!${fact.wordsIfSpFlavour}`;
    case 'a power tears into the foe':
      return `  ${fact.spName} tears into ${fact.foeName} for ${String(fact.dealt)} damage. (HP ${String(fact.foeHp)})`;
    case 'the guardian reaches for its own wounds again but the well is dry':
      return `  The ${String(fact.actorName)} reaches for its own wounds again — but that well is dry; it has already drawn on it this fight.`;
    case 'the guardian knits its wounds':
      return `  The ${String(fact.actorName)} knits its wounds for ${String(fact.heal)}. (HP ${String(fact.actorHp)})`;
    case 'the foe reels from the blow, losing actions':
      return `  ${fact.foeName} reels from the blow — ${String(fact.stun)} action${fact.stunPlural} will be lost from the next round.`;
    case 'the foe is caught helpless, losing actions':
      return `  ${fact.foeName} is caught helpless — ${String(fact.stun)} action${fact.stunPlural} lost.`;
    case 'the foe is thrown off balance from the next round':
      return `  ${fact.foeName} is thrown off balance — −${String(fact.pen)}% to hit from the next round.`;
    case 'the foe is thrown off balance':
      return `  ${String(fact.foeName)} is thrown off balance (−${String(fact.pen)}% to hit).`;
    case "the foe's guard is beaten down next round":
      return `  ${fact.foeName}'s guard is beaten down — Melee ${String(fact.now)} next round.`;
    case "the foe's guard is beaten down now":
      return `  ${String(fact.foeName)}'s guard is beaten down — Melee now ${String(fact.now)}.`;
    case "the guardian's melee surges":
      return `  The ${String(fact.actorName)}'s Melee surges to ${String(fact.actorMelee)}!`;
    case 'a power festers on the foe':
      return `  ${fact.spName} festers on ${fact.foeName} — ${String(fact.eDmg)} a round for ${String(fact.eRounds)} round${fact.eRoundsPlural}.`;
    case 'every blow against the guardian will bite back':
      return `  Every blow against the ${String(fact.actorName)} will bite back for ${String(fact.actorStatusReflect)}.`;
    case 'a ward shrouds the guardian':
      return `  A ward shrouds the ${fact.actorName}, ready to drink ${String(fact.actorStatusAbsorb)} damage.`;
    case "death's touch tears the foe's strength in half":
      return `  ☠ Death's touch takes hold — ${String(fact.foeName)}'s strength is torn in half (−${String(fact.cut)}). (HP ${String(fact.foeHp)})`;
    case 'the foe is struck down where they stand':
      return `  ☠ ${String(fact.foeName)} is struck down where they stand!`;
    case 'the foe cannot be gripped by it':
      return `  ${String(fact.foeName)} cannot be gripped by it — the terror washes over them and passes.`;
    case 'the foe must hold their nerve':
      return `  ${String(fact.foeName)} must hold their nerve (${String(fact.tc)}% to break) [roll ${String(fact.tr)} ${String(fact.trTcMark)}].`;
    case 'the foe is overcome with sheer terror':
      return `  ${String(fact.foeName)} is overcome with sheer terror and flees!`;
    case 'the foe steels their nerve':
      return `  ${String(fact.foeName)} steels their nerve.`;
    case 'the foe feels dragged towards the creature':
      return `  ${String(fact.foeName)} feels dragged towards the creature — escape will be far harder.`;
    case 'a hero bears magic items into the fight':
      return `  ⚜ ${fact.chName} bears ${fact.itemNames} into the fight.`;
    case 'the runner scrambles clear with a chance of dropping something':
      return `  ${fact.runnerName} scrambles clear — ${String(fact.chance)}% chance of dropping something in the rout [roll ${String(fact.roll)}${fact.rollChanceMark}]`;
    case 'in the rout the runner drops an item the one who stays claims':
      return `  💎 In the rout ${fact.runnerName} drops ${fact.itName}${fact.wordsIfIsLegendaryItemIt} — ${fact.stayerName} claims it.`;
    case 'a gained item noted':
      return `  ${fact.gainedItemNote}`;
    case 'the runner breaks off the duel and slips away':
      return `${fact.runnerName} breaks off the duel and slips away — ${fact.stayerName} holds the field.`;
    case 'the attacker meets the defender in a personal encounter':
      return `${fact.atkName} (${fact.atkRace}, ${fact.atkTemper}) meets ${fact.defName} (${fact.defRace}, ${fact.defRealmName}) in a personal encounter.`;
    case "the attacker goes for the defender's purse and comes away with nothing":
      return `${String(fact.atkName)} goes for ${String(fact.defName)}'s purse and comes away with nothing — a master thief keeps their own coin far better hidden.`;
    case "the attacker lifts gold from the defender's purse":
      return `${String(fact.atkName)} lifts ${String(fact.stolen)}g from ${String(fact.defName)}'s purse and is gone.`;
    case "the attacker finds the defender's purse empty":
      return `${String(fact.atkName)} finds ${String(fact.defName)}'s purse empty.`;
    case 'the one who flees breaks away and escapes':
      return `${fact.resFledByName} breaks away and escapes the encounter.`;
    case 'the attacker is overwhelmed':
      return `${fact.atkName} is overwhelmed!`;
    case 'the defender is overcome':
      return `${fact.defName} is overcome!`;
    case "the guardian has turned the hoard's magic to its own use":
      return `The ${fact.mName} has turned the hoard's magic to its own use — it bears ${fact.wieldedItemNames}.`;
    case 'the hero enters the feature':
      return `${fact.cName} ${fact.entryVerb} the ${fact.featureName} in ${fact.provName}.`;
    case 'within lurks the guardian blocking the path':
      return `Within lurks ${fact.monHpDesc} ${fact.mName}${fact.wordsIfMonsterCatLabelM}${fact.powerDesc}, blocking the path to the treasure.`;
    case 'the guardian is already wounded by someone before':
      return `It is already ${String(fact.woundDesc)} — someone has been here before ${String(fact.cName)} this year. (${String(fact.monHp)}/${String(fact.monFullHp)} HP)`;
    case "the guardian's speed and plan":
      return `The ${fact.mName} is ${fact.monSpeedName}-moving${fact.wordsIfMonSpeedNameFast}${fact.wordsIfPcHasRangedMon}. Its plan: ${fact.guardianTactics}…`;
    case 'after tense negotiations the guardian agrees':
      return `After tense negotiations, the ${String(fact.mName)} agrees to step aside and allow passage to the treasure.`;
    case 'the hero slips away with the prize':
      return `${fact.cName} slips away with the prize — the ${fact.mName} never even notices.`;
    case 'the hero turns and flees from the guardian':
      return `${fact.cName} turns and flees from the ${fact.mName}, escaping into the surrounding terrain!`;
    case 'in the rout the hero drops an item into the hoard':
      return `  💎 In the rout ${fact.cName} drops ${fact.itName}${fact.wordsIfIsLegendaryItemIt} — it lies among the ${fact.mName}'s hoard now${fact.wordsIfGuardianCanUseItemMIt}.`;
    case 'with a final effort the guardian is defeated':
      return `With a final ${fact.blowOrBurst}, the ${fact.mName} is defeated!`;
    case 'the hero falls to their knees overwhelmed':
      return `${fact.cName} falls to their knees, overwhelmed by the ${fact.mName}!`;
    case 'neither the hero nor the guardian gains the upper hand':
      return `Neither ${String(fact.cName)} nor the ${String(fact.mName)} can gain the upper hand. ${String(fact.cName2)} withdraws to recover.`;
    case 'the guardian draws back into its lair':
      return `The ${fact.mName} draws back into its lair; by the time anyone dares it again, its wounds will have closed.`;
    case 'the hero seizes the opening and counterattacks':
      return `  ↩ ${fact.heroName} seizes the opening and counterattacks! (${fact.src})`;
    case 'the counterstroke strikes the foe':
      return `  ↩ The counterstroke strikes ${fact.foeName} for ${String(fact.dealt)} damage! (${fact.foeName2} HP ${String(fact.foeHp)})`;
    case 'the hero lunges to counterattack but the foe recovers':
      return `  ↩ ${fact.heroName} lunges to counterattack, but ${fact.foeName} recovers in time. (${fact.src})`;
    case "a fighter's attack fails, still reeling from a crippling wound":
      return `  ${fact.actorName} is still reeling from a crippling wound — the attack fails. (Trueshot)`;
    case 'a fighter attacks with a roll to hit':
      return `  ${fact.actorName} attacks (${fact.actorMeleeSkillLabel}, ${String(fact.hitI)}% to hit [roll ${String(fact.roll)}]${fact.rollHitIMark})`;
    case 'a fighter strikes the foe':
      return `  ${fact.actorName} strikes ${fact.foeName} for ${String(fact.dealt)} damage! (HP ${String(fact.foeHp)})`;
    case 'a fighter drinks the wound':
      return `  ${fact.actorName} drinks the wound — +${String(fact.dr)} HP${fact.wordsIfSm}. (${fact.actorDrainWord}, HP ${String(fact.actorHp)})`;
    case "the foe's shield lashes back":
      return `  ${String(fact.foeName)}'s shield lashes back for ${String(fact.foeStatusReflect)} damage. (${String(fact.actorName)} HP ${String(fact.actorHp)})`;
    case "the foe's thorns bite a fighter":
      return `  ${fact.foeWardIcon} ${fact.wordsIfFoeKindMonster} bites ${fact.actorName} for ${String(fact.foeArmThorns)}. (${fact.actorName2} HP ${String(fact.actorHp)})`;
    case "a fighter's blow is turned aside":
      return `  ${fact.actorName}'s blow is turned aside.`;
    case 'but a fighter is too dazed to punish it':
      return `  …but ${fact.actorName} is too dazed to punish it.`;
    case 'but a fighter is still reeling and the chance is lost':
      return `  …but ${String(fact.actorName)} is still reeling and the chance is lost. (Trueshot)`;
    case "a fighter takes a free strike at the foe's back":
      return `  ⚔ ${fact.actorName} takes a free strike at ${fact.foeName}'s back (${fact.actorMeleeSkillLabel}, ${String(fact.hitI)}% to hit [roll ${String(fact.roll)}]${fact.rollHitIMark})`;
    case 'a fighter lands the free strike':
      return `  ${fact.actorName} lands it for ${String(fact.dealt)} damage! (${fact.foeName} HP ${String(fact.foeHp)})`;
    case 'the foe bursts into ash then blazes back to life':
      return `  🔥 ${String(fact.foeName)} bursts into ash — then blazes back to life! (HP ${String(fact.foeHp)})`;
    case 'the free strike misses':
      return `  The free strike misses.`;
    case 'a fighter tries to flee':
      return `  🏃 ${fact.lead} (${String(fact.chance)}% [roll ${String(fact.roll)}]${fact.rollChanceMark})`;
    case 'a fighter escapes the fight':
      return `  ${fact.actorName} escapes the fight!`;
    case 'a fighter fails to get clear':
      return `  ${fact.actorName} fails to get clear.`;
    case 'a fighter advances and the combatants close':
      return `  ${fact.actorName} ${fact.advanceWords} — the combatants close to ${fact.stateRange} range.`;
    case 'the foe looses a parting shot as a fighter comes on':
      return `  🏹 ${fact.foeName} looses an arrow as ${fact.actorName} comes on. (parting shot)`;
    case 'a fighter draws as they come and looses a snap shot':
      return `  ${fact.actorName} draws as they come and looses a snap shot.`;
    case "a fighter's shot fails, still reeling from a crippling wound":
      return `  ${fact.actorName} is still reeling from a crippling wound — the shot fails. (Trueshot)`;
    case 'a fighter draws and looses a volley':
      return `  ${fact.actorName} draws and looses a volley of ${String(fact.volley)} arrows (${fact.actorArcherySkillLabel}).`;
    case 'a fighter shoots with a roll to hit':
      return `  ${fact.actorName} shoots (${fact.actorArcherySkillLabel}, ${String(fact.hit)}% to hit [roll ${String(fact.roll)}]${fact.rollHitMark})`;
    case "a fighter's shot hits the foe":
      return `  ${fact.actorName}'s shot hits ${fact.foeName} for ${String(fact.dealt)} damage. (HP ${String(fact.foeHp)})`;
    case "a fighter's arrow impales the foe":
      return `  🩸 ${fact.actorName}'s arrow impales ${fact.foeName} — it will bleed ${String(fact.impDmg)} a round for ${String(fact.impRounds)} rounds. (Impalement)`;
    case "a fighter's shot strikes a vital point":
      return `  🎯 ${fact.actorName}'s shot strikes a vital point — ${fact.foeName}'s next attack will fail. (Trueshot)`;
    case "a fighter's shot flies wide":
      return `  ${fact.actorName}'s shot flies wide.`;
    case "a guardian's perk is named":
      return `  🜏 ${fact.meName} — ${fact.pName}: ${fact.pDesc}.`;
    case 'a druid has hunted this kind of beast before':
      return `  🍃 ${fact.aName} has hunted this kind before — the beast's blows will land at half force (Druid ${String(fact.aDruidBeastWard)}).`;
    case 'one fighter has the initiative':
      return `  ${fact.firstName} has the initiative. The fight opens at spell range.`;
    case 'the victim fights their own mirror image':
      return `  🪞 ${fact.victimName} fights their own mirror image while ${fact.casterName} concentrates.`;
    case "but there is no escaping one's own reflection":
      return `    …but there is no escaping one's own reflection — the phantom is on ${fact.victimName} again at once.`;
    case 'but an illusion cast upon an illusion':
      return `    …but an illusion cast upon an illusion finds no purchase, and fades.`;
    case 'the victim shatters the phantom':
      return `  🪞 ${fact.victimName} shatters the phantom — the illusion ends.`;
    case 'the phantom of the victim thins to nothing':
      return `  🪞 The phantom of ${fact.victimName} thins to nothing of its own accord.`;
    case 'the victim is struck down by their own mirror image':
      return `  ${fact.victimName} is struck down by their own mirror image!`;
    case "a guardian's aura sears the foe":
      return `  🜏 ${fact.meBurnWord} sears ${fact.foeName} for ${String(fact.meBurn)}. (HP ${String(fact.foeHp)})`;
    case 'the victim sees through the illusion':
      return `  ✨ ${fact.victimName} sees through the illusion (${fact.disbeliefPct}% disbelief) — the phantom dissolves and the real fight resumes.`;
    case 'a fighter takes a free strike at the foe':
      return `  ⚔ ${String(fact.actorName)} takes a free strike at ${String(fact.foeName)}!`;
    case "a fighter's free strike lands":
      return `  ${String(fact.actorName)}'s free strike lands for ${String(fact.dealt)} damage! (${String(fact.foeName)} HP ${String(fact.foeHp)})`;
    case 'a fighter finds their second wind and fights on':
      return `  💪 ${fact.cbtName} (${fact.cbtTemper}) finds their second wind and fights on — ${String(fact.back)} HP recovered. (HP ${String(fact.cbtHp)})`;
    case 'as their strength fails a fighter begs the foe for mercy':
      return `  🙏 As their strength fails and death closes in, ${fact.who} begs ${fact.foeWho} for mercy!${fact.odds}`;
    case 'as the foe draws for the killing shot a fighter begs for their life':
      return `  🙏 As ${fact.foeWho} draws for the killing shot, ${fact.who} throws down their weapon and begs for their life!${fact.odds}`;
    case 'pinned and bleeding a fighter cries out for mercy':
      return `  🙏 Pinned and bleeding, ${fact.who} cries out for mercy before the last arrow can fly!${fact.odds}`;
    case 'as the foe readies a power for the killing stroke a fighter begs':
      return `  🙏 As ${fact.foeWho} readies ${fact.pow} for the killing stroke, ${fact.who} falls to their knees and begs to be spared!${fact.odds}`;
    case 'beaten and bleeding a fighter sees the killing blow coming':
      return `  🙏 Beaten and bleeding, ${fact.who} sees the killing blow coming — they throw down their weapon and beg ${fact.foeWho} for their life!${fact.odds}`;
    case 'as the foe closes for the kill a fighter cries out for mercy':
      return `  🙏 As ${fact.foeWho} closes for the kill, ${fact.who} flings up their hands and cries out for mercy!${fact.odds}`;
    case 'a fighter drops to their knees before the final stroke':
      return `  🙏 ${fact.who} drops to their knees before the final stroke can fall, pleading to be spared!${fact.odds}`;
    case 'the guardian pauses over its prey and lets a fighter crawl away':
      return `  ${fact.foeWho} pauses over its prey — and, for reasons of its own, lets ${fact.who} crawl away. ${fact.who2} flees the field with their life. (HP 1)`;
    case 'the foe lets a fighter go':
      return `  ${String(fact.foeWho)} lets them go — ${String(fact.who)} staggers from the field with their life. (HP 1)`;
    case 'the foe lowers their bow and lets a fighter go':
      return `  ${fact.foeWho} lowers their bow. "Go, while you still can." ${fact.who} flees the field with their life. (HP 1)`;
    case 'the foe lets a power die unspent':
      return `  ${fact.foeWho} lets ${fact.pow} die unspent and waves ${fact.who} away. ${fact.who2} flees the field with their life. (HP 1)`;
    case 'the foe stays the blow and lets a fighter go':
      return `  ${fact.foeWho} stays the blow. "Go — and never let me see your face again." ${fact.who} scrambles away and flees the field with their life. (HP 1)`;
    case 'the foe lowers their weapon in disgust and lets a fighter go':
      return `  ${fact.foeWho} lowers their weapon in disgust and lets ${fact.who} go. ${fact.who2} flees the field, alive but broken. (HP 1)`;
    case 'the stroke never falls and the foe spares a fighter':
      return `  The stroke never falls — ${fact.foeWho} spares them. ${fact.who} stumbles from the field with their life. (HP 1)`;
    case 'a fighter surrenders an item to the foe as the price of mercy':
      return `  🎒 ${fact.cbtName} surrenders ${fact.lostName} to ${fact.foeName} as the price of mercy.`;
    case 'the foe knows nothing of mercy':
      return `  ${fact.foeWho} knows nothing of mercy.${fact.wordsIfABlowFalls}`;
    case 'the foe laughs at the plea':
      return `  ${fact.foeWho} laughs at the plea.${fact.wordsIfABlowFalls}`;
    case 'the foe is deaf to the plea':
      return `  ${fact.foeWho} is deaf to the plea.${fact.wordsIfABlowFalls}`;
    case 'there is no pity in the foe':
      return `  There is no pity in ${fact.foeWho} today.${fact.wordsIfABlowFalls}`;
    case 'a combat item strikes the foe':
      return `  ${fact.nm} strikes ${fact.foeName} for ${String(fact.dealt)} damage. (HP ${String(fact.foeHp)})`;
    case 'a fighter uses a combat item':
      return `  🧪 ${fact.who} uses the ${fact.nm}!`;
    case 'a fighter recovers hit points':
      return `  ${String(fact.who)} recovers ${String(fact.healed)} HP. (HP ${String(fact.actorHp)})`;
    case 'warmth spreads through a fighter each round':
      return `  Warmth spreads through ${String(fact.actorName)} — ${String(fact.eAmt)} HP a round for ${String(fact.eRounds)} rounds.`;
    case 'a fighter recovers hit points and every lingering affliction lifts':
      return `  ${String(fact.who)} recovers ${String(fact.healed)} HP and every lingering affliction lifts. (HP ${String(fact.actorHp)})`;
    case 'a combat item blazes twice as bright against the foe':
      return `  The ${String(fact.nm)} blazes twice as bright against ${String(fact.foeName)}!`;
    case 'a combat item keeps burning on the foe':
      return `  ${String(fact.nm)} keeps burning on ${String(fact.foeName)} — ${String(fact.deDmg)} a round for ${String(fact.deRounds)} round${String(fact.deRoundsPlural)}.`;
    case 'the foe is thrown off from the next round':
      return `  ${fact.foeName} is thrown off (−${String(fact.eHitPen)}% to hit from the next round).`;
    case 'the foe reels losing actions from the next round':
      return `  ${String(fact.foeName)} reels — ${String(fact.eStun)} action${String(fact.eStunPlural)} lost from the next round.`;
    case 'a fighter drinks the stolen vigour':
      return `  ${String(fact.who)} drinks the stolen vigour — +${String(fact.healed)} HP. (HP ${String(fact.actorHp)})`;
    case 'the foe is held fast, losing actions':
      return `  ${fact.foeName} is held fast — ${String(fact.eStun)} action${fact.eStunPlural} lost.`;
    case 'the foe can barely see to strike':
      return `  ${fact.foeName} can barely see to strike (−${String(fact.eHitPen)}% to hit for the rest of the fight).`;
    case 'the foe can barely see to strike for now':
      return `  ${fact.foeName} can barely see to strike (−${String(fact.eHitPen)}% to hit).`;
    case 'the foe is sapped for the rest of the fight':
      return `  ${String(fact.foeName)} is sapped — Melee ${String(fact.foeMelee)}${String(fact.wordsIfEArchery)} for the rest of the fight.`;
    case 'the foe is overcome with dread and flees':
      return `  ${String(fact.foeName)} is overcome with dread and flees!`;
    case 'the foe holds their ground badly shaken':
      return `  ${String(fact.foeName)} holds their ground, badly shaken (−${String(fact.eHitPen)}% to hit).`;
    case "the foe's magic and powers are bound":
      return `  ${String(fact.foeName)}'s magic and powers are bound for ${String(fact.eRounds)} rounds.`;
    case 'a fighter surges with strength':
      return `  ${fact.who} surges with strength — Melee ${String(fact.actorMelee)}${fact.wordsIfEArchery}.`;
    case "a fighter's eye sharpens":
      return `  ${String(fact.who)}'s eye sharpens (+${String(fact.eHitBonus)}% to hit).`;
    case 'a ward settles over a fighter':
      return `  A ward settles over ${fact.actorName}, ready to drink ${String(fact.stAbsorb)} damage${fact.wordsIfEReflect}.`;
    case 'shimmering doubles step out of a fighter':
      return `  ${String(fact.eImages)} shimmering doubles step out of ${String(fact.actorName)}.`;
    case 'a fighter is ready to break away':
      return `  ${String(fact.who)} is ready to break away (+${String(fact.eFleeBonus)}% to flee${String(fact.wordsIfEToHitReduce)}).`;
    case 'a fighter fades from sight the foe':
      return `  ${fact.who} fades from sight — ${fact.foeName} strikes at shadows (−${String(fact.eToHitReduce)}% to hit).`;
    case 'every poison burn and blinding on a fighter lifts':
      return `  Every poison, burn and blinding on ${fact.actorName} lifts.`;
    case 'but nothing happens':
      return `  …but nothing happens.`;
    case 'a fighter is stunned and cannot act':
      return `  ${fact.actorName} is stunned and cannot act. (${String(fact.actorStatusStun)} left)`;
    case 'a fighter bound by spiritwrack cannot shoot and closes in':
      return `  ${String(fact.actorName)} cannot shoot (bound by Spiritwrack) — they close in instead.`;
    case 'a fighter has no ranged attack and presses forward':
      return `  ${fact.actorName} has no ranged attack — they press forward instead.`;
    case 'a fighter gives ground and gets to firing range first':
      return `  ${fact.actorName} gives ground and gets to firing range before anything can reach them. (${fact.actorTemper} — opening shot)`;
    case 'a fighter moves up to firing range':
      return `  ${fact.actorName} moves up to firing range (${String(fact.rangeChance)}% [roll ${String(fact.roll)}]${fact.rollChMark})`;
    case 'a fighter cannot close the distance in time':
      return `  ${fact.actorName} cannot close the distance in time — no shot.`;
    case 'a fighter tries to break away to firing range':
      return `  ${fact.actorName} tries to break away to firing range (${String(fact.rangeChance)}% [roll ${String(fact.roll)}]${fact.rollChMark})`;
    case 'the foe stays right on top of a fighter':
      return `  ${fact.foeName} stays right on top of ${fact.actorName} — no room to draw.`;
    case 'a fighter disengages to bow range':
      return `  ${fact.actorName} disengages to bow range.`;
    case "a fighter's power is bound and it attacks with tooth and claw":
      return `  ${String(fact.actorName)}'s power is bound and will not answer — it falls on ${String(fact.foeName)} with tooth and claw instead.`;
    case 'a fighter gathers itself for a power but the moment slips away':
      return `  ${fact.actorName} gathers itself for ${fact.spName} but the moment slips away — it attacks instead. [${String(fact.castChancePct)}%]`;
    case 'a fighter is silenced and cannot cast':
      return `  ${String(fact.actorName)} is silenced and cannot cast — they attack instead.`;
    case 'a fighter knows nothing of retreat':
      return `  ${fact.actorName} knows nothing of retreat.`;
    case "a fighter calls for parley with a druid's roll":
      return `  ${String(fact.actorName)} calls for parley (Druid ${String(fact.dr)}, ${String(fact.chance)}%${String(fact.chanceMark)})`;
    case 'the foe lowers its guard and stands aside':
      return `  ${String(fact.foeName)} lowers its guard and stands aside.`;
    case 'the foe answers with a roar':
      return `  ${String(fact.foeName)} answers with a roar.`;
    case 'a fighter calls for parley but blades are already drawn':
      return `  ${String(fact.actorName)} calls for parley, but blades are already drawn.`;
    case 'a fighter has no thief skill and cannot steal':
      return `  ${String(fact.actorName)} has no Thief skill and cannot attempt a steal — they press forward instead.`;
    case 'a fighter slips past the guardian and seizes the prize':
      return `  ${fact.actorName} slips past the ${fact.tierWord} guardian and seizes the prize! [${String(fact.chance)}%${fact.wordsIfTierPen}]`;
    case "a fighter's theft is noticed":
      return `  ${fact.actorName}'s theft is noticed. [${String(fact.chance)}%${fact.wordsIfTierPen}]`;
    case 'a fighter scouts the feature and its guardian':
      return `  🔍 ${String(fact.actorName)} scouts the ${String(fact.featName)}: ${String(fact.foeName)}${String(fact.wordsIfPower)} stands guard at ${String(fact.curHp)}/${String(fact.fullHp)} HP.${String(fact.descClause)}${String(fact.abilityClause)}${String(fact.vulnClause)} Defeating it will yield exactly ${String(fact.clearGold)}g${String(fact.itemOut)}.`;
    case 'a fighter scouts the ground but there is nothing to guard':
      return `  ${String(fact.actorName)} scouts the ground, but there is nothing here to guard.`;
    case 'a fighter reads the ground and steadies their aim':
      return `  ${String(fact.actorName)} reads the ground and steadies — ${String(fact.cut)}% of their to-hit penalty is shaken off (Explorer ${String(fact.ex)}).`;
    case 'the target cannot be held':
      return `  ${fact.targetWardIcon} ${fact.targetName} cannot be held (${fact.why}${fact.wordsIfW}) — ${fact.what} finds no hold.`;
    case "a fighter's harm strikes a mirror image":
      return `  ${String(fact.srcName)}'s ${String(fact.harmKind)} strikes a Mirror Image of ${String(fact.targetName)}! (${String(fact.targetStatusMirrorImages)} image${String(fact.targetStatusMirrorImagesPlural)} left)`;
    case 'the first harm to reach the target is drunk by their armour':
      return `  🛡 The first ${String(fact.harmArrowOrBlow)} to reach ${String(fact.targetName)} is drunk by their armour — no damage. (${String(fact.armourNames)})`;
    case "the target's shield takes the blow square on":
      return `  🛡 ${String(fact.targetName)}'s shield takes the ${String(fact.arrowOrBlow)} square on — blocked outright. (${String(fact.armBlock)}%)`;
    case "the arrow glances off the target's shield":
      return `  🛡 The arrow glances off ${fact.targetName}'s shield. (${String(fact.armArrowBlock)}%)`;
    case "the target's shield turns the harm away":
      return `  🛡 ${fact.targetName}'s shield turns the ${fact.harmKind} away harmlessly. (${String(fact.armSpellBlock)}%)`;
    case "the ward on the target's shield soaks some of the harm":
      return `  🛡 The ward on ${fact.targetName}'s shield soaks ${String(fact.rw)}.`;
    case "the target's mithril armour turns aside some of the harm":
      return `  🛡 ${fact.targetName}'s Mithril Armour turns aside ${String(fact.damageTurnedAside)} of the ${fact.arrowOrBlow}.`;
    case "the hunter finds the target's weakness":
      return `  💥 The ${fact.wword} finds ${fact.targetName}'s weakness — ${fact.targetWeakName}: ${String(fact.wb)} becomes ${String(fact.damage)}.`;
    case "the hunter sees the target's weakness plainly now":
      return `  📖 ${fact.wsrcName} sees it plainly now: ${fact.targetWeakDesc}. Your realm will remember this of every ${fact.targetName}.`;
    case "the target reads the beast's every move":
      return `  🍃 ${fact.targetName} reads the beast's every move — ${String(fact.damageTurnedAside)} of the ${fact.strikeOrBlow} turned aside (Druid ${String(fact.targetDruidBeastWard)}).`;
    case 'the target rolls with the blow and takes less':
      return `  ${fact.targetName} rolls with the blow and takes ${String(fact.damageRolledWith)} less. (${fact.targetTemper} guard)`;
    case 'the target takes the harm on raw fury':
      return `  ${fact.targetName} takes the ${fact.harmKind} on raw fury and shrugs off ${String(fact.damageShruggedOff)} of it. (Rage −${String(fact.soakPct)}%)`;
    case 'a ward around the target drinks some of the blow':
      return `  A ward around ${fact.targetName} drinks ${String(fact.soak)} of the blow.`;
    case 'the target parries turning aside some of the blow':
      return `  ⚔ ${fact.targetName} parries, turning aside ${String(fact.damageTurnedAside)} of the blow. (Parry)`;
    case "the target's elemental armour absorbs some of the harm":
      return `  🜂 ${fact.targetName}'s Elemental Armour absorbs ${String(fact.damageAbsorbed)} of the ${fact.harmKind}. (Elemental Armour)`;
    case "the target's armour turns aside some of the harm":
      return `  ${fact.targetWardIcon} ${fact.targetArmourWord} turns aside ${String(fact.damageTurnedAside)} of the ${fact.harmArrowOrBlow}.${fact.wordsIfTargetKindMonster}`;
    case 'the target turns aside all they can but the harm still lands':
      return `  ${fact.targetName} turns aside all they can, but the ${fact.harmArrowOrBlow} still lands for ${String(fact.floor)}. (no ward may take a hit below half)`;
    case "the target's armour will not let any single hit bite deeper":
      return `  ${fact.targetWardIcon} ${fact.targetCapWord} will not let any single hit bite deeper than ${String(fact.capAt)}.`;
    case 'the target will not go down and restores hit points':
      return `  ${fact.targetWardIcon} ${fact.targetName} will not go down — ${fact.wordsIfTargetKindMonster} restores ${String(fact.back)} HP. (HP ${String(fact.targetHp)})`;
    case 'a fighter ignores the daze':
      return `  ${String(fact.cbtWardIcon)} ${String(fact.wordsIfCbtKindMonster)} — the daze is ignored.`;
    case "a fighter's armour sloughs off every burn poison and bleeding":
      return `  ${fact.cbtWardIcon} ${fact.cbtDotWardWord} sloughs off every burn, poison and bleeding.`;
    case "a guardian's regeneration knits its flesh":
      return `  ${fact.cbtWardIcon} ${fact.cbtRegenWord} knits flesh for ${String(fact.healed)}${fact.wordsIfSm}. (HP ${String(fact.cbtHp)})`;
    case 'a fighter has nothing left to knit':
      return `  🜏 ${fact.cbtName} has nothing left to knit with — its wounds stay open.`;
    case 'a fighter shrugs off the daze, held steady by their armour':
      return `  🛡 ${String(fact.cbtName)} shrugs off the daze — their armour holds them steady.`;
    case 'a lingering harm afflicts a fighter':
      return `  ${fact.harmName} afflicts ${fact.cbtName} for ${String(fact.harmDealt)} damage${fact.wordsIfDw}. (HP ${String(fact.cbtHp)})`;
    case 'a healing knits a fighter':
      return `  ${String(fact.healingName)} knits ${String(fact.cbtName)} for ${String(fact.healed)}. (HP ${String(fact.cbtHp)})`;
    case 'a fighter tears free of the spiritwrack':
      return `  ⛓ ${String(fact.cbtName)} tears free of the Spiritwrack binding! (${String(fact.rollShown)} to shrug it off)`;
    case "a hero's hit points rise in a fight, for his realm alone":
    case 'the surgeons reach a fallen duellist too late, for his realm alone':
      return fact.words;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`a personal combat's line records a fact with no words: ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
