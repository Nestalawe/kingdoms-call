// The hints the order form shows below a Cast Spell order, one for each spell it offers that has one (src/ui/player/
// titles.ts shows the chosen spell's). Moved here from src/ui/player/order-chances.ts (plan P1-11d13), so that a test can
// import the hints as the page shows them: that file starts the page as it loads.
//
// Where a hint states a number of a spell's effect as the content's row holds it (src/content/spell-effects-their-names-
// numbers-and-words.ts: a percentage, a count of rounds, a multiplier), it reads the row, which the turn reads too. A
// number written in words ("halved", "per two"), as the share kept ("75%"), or worked out at a level ("12% at 1"),
// stays in the hint's words. tests/static/each-spells-numbers-are-in-its-blurb-and-the-rulebooks-table.test.ts reads
// each hint against its row. The hints that say otherwise than the turn (Telekinetic Storm, Plague, Lightning Bolt and
// Hand of Death) stay as they are, numbers and all, until their words are fixed.
import { SPELL_EFFECTS_THE_REGISTRY_HOLDS } from '../../content/spell-effects-their-names-numbers-and-words.ts';

const FIREBALL = SPELL_EFFECTS_THE_REGISTRY_HOLDS.fireball.combat;
const HOLY_SYMBOL = SPELL_EFFECTS_THE_REGISTRY_HOLDS['holy-symbol'].combat;
const SPIRITWRACK = SPELL_EFFECTS_THE_REGISTRY_HOLDS.spiritwrack.combat;
const PSYCHIC_BLAST = SPELL_EFFECTS_THE_REGISTRY_HOLDS['psychic-blast'].combat;
const INVISIBILITY = SPELL_EFFECTS_THE_REGISTRY_HOLDS.invisibility.combat;

/** The hint shown below the order form for each spell, by its name. */
export const SPELL_HINTS = {
  Resurrect:
    'Target: a dead hero whose body lies in your caster\u2019s province. Revives at full HP, stripped of all items and armies, and joins your command. Only a hero who never served ANOTHER realm can be raised \u2014 your own fallen, or a wanderer who was never in a rival\u2019s pay; a hero who ever served another crown (even one later released or who deserted) will not answer. Your own fallen KING can also be recalled — their body is borne to your home province (or wealthiest if home is lost); only your most recently fallen monarch may be raised, and only by your realm. A resurrected king reclaims the throne; any reigning heir steps down to a normal hero.',
  'Part Sea':
    'Target: any sea OR land province you\u2019re in or next to (so you can pre-empt a Flood). A sea province \u2014 including a land province flooded to sea earlier this turn \u2014 becomes dry plains for the rest of the turn (land armies may cross); no fleet may enter or leave from the next phase on. Cast on still-dry land it simply finds no sea to part. Cancels Flood.',
  'Bless Province':
    'Target: a province you\u2019re in or adjacent to. +60% tax base at collection this turn (+80% for Divine realms; +100% when the Divine KING casts it). The ground is also warded \u2014 50% + 5% per White level (counted to 5, so 50\u201375%) to turn aside each enemy Flood, Earthquake, Plague or Part Sea cast here this turn. One Bless per province \u2014 does not stack.',
  'Holy Symbol': `Action: no target \u2014 cleanses the province you stand in of ALL its battlefield dead. Every grave there is laid to rest and can never be raised by a necromancer. Combat: enemy \u2212${String(HOLY_SYMBOL.theCutToTheTargetsAimALevel.value)}%/level to hit and seared for ${String(HOLY_SYMBOL.theShareOfMaximumHpItSears.value)}% of its health, both \u00d7${String(HOLY_SYMBOL.theMultiplierAgainstTheUndeadAndFiends.value)} against undead and fiends; you recover ${String(HOLY_SYMBOL.theShareOfHisOwnMaximumHpTheCasterRecovers.value)}% of your health. Battle: enemy undead units fight at 75% strength.`,
  Spiritwrack: `Combat: silences the target for ${String(SPIRITWRACK.theRoundsItSilences.value)} round + 1 per two White levels (max ${String(SPIRITWRACK.theMostRounds.value)}) \u2014 it can\u2019t cast or use archery (it attacks instead) and its melee is halved. Against a guardian weak to White Magic it takes at 95% and lasts ${String(SPIRITWRACK.theRoundsLongerAgainstAGuardianWeakToWhite.value)} round longer (max 4); Powerful and Legendary guardians may shrug it off each round after the first. Battle: all missile units fight at half strength.`,
  Charm:
    "Target: a lone hero (wandering or enemy) leading NO armies, in your province. Wandering joins you free (you still pay upkeep); enemy comes under your command until end of turn, then returns to their lord (and will not attack their own lord's heroes). On success you learn their skills and magic items. Kings and army-leaders are immune; each past Charm gives a hero +30% resistance (cumulative). A Charm that fails may provoke a personal encounter with the target — unless either leads their encounter plan with Flee. Combat: doubles a later Flee attempt.",
  Oratory:
    'Target: yourself or an ally in your province. Every army travelling with them fights one quality tier higher for the rest of the turn. Not cumulative.',
  Clairvoyance:
    'Target: any enemy character you\u2019ve ever seen, anywhere (not neutral or wandering heroes). You learn all that happens to them this turn — reported in your Realm Events — and see their full skills. At turn\u2019s end you also know exactly where they stand: they are marked on your map and open to Encounter, even through Invisibility. Only one active at a time.',
  'Psychic Blast': `Target: an enemy/neutral hero in your province. They permanently lose TWO skill levels, each taken from a randomly chosen skill they hold (both picks can land on the same skill, dropping it by 2). Combat: they can do nothing at all for ${String(PSYCHIC_BLAST.theRoundsItStuns.value)} round + 1 per two Psychic levels (3 at Psychic 5; doubled against a foe weak to Psychic; Dreamstone +1, after any doubling), unless a stun ward turns it. Battle: negates the enemy commander\u2019s Druid.`,
  'Telekinetic Storm':
    'Target: an enemy hero leading armies in your province. A number of their units equal to your skill level are struck: Green units are destroyed and every other struck unit PERMANENTLY drops one experience level (skeletal units unaffected). Combat: 12% of the target\u2019s max HP, +3% per Psychic level (15% at 1, 27% at 5), as damage (you take a quarter of that). Battle: negates the enemy commander\u2019s Tactical.',
  'Illusory Terrain':
    'Target: a province you\u2019re in or adjacent to. Cloaks it in a false, ever-shifting terrain: enemies who fight there are disoriented, each unit fighting as if in the worst terrain for its kind (at least \u221215%). An enemy hero who enters dispels it at the end of that turn; 20%/turn natural fade.',
  'Phantasmal Armies':
    'Target: yourself or any friendly hero in your province. Spectral duplicates of their humanoid armies \u2014 10% of the host per caster level, counted to level 5, at least one \u2014 march and fight with the real host for the rest of the turn. The doubles never appear in the roster, need no berth aboard ship, and melt away if their originals fall or the force is beaten.',
  'Hide Lairs':
    'Target: a province you\u2019re in or adjacent to. Hides every lair there from all other players \u2014 they cannot discover any lair in it while the glamour holds (one already found stays theirs). 20% chance to fade each turn.',
  Invisibility: `Combat: enemies suffer \u2212${String(INVISIBILITY.theCutToHisFoesAim.value)}%, and a further \u2212${String(INVISIBILITY.theCutMoreALevel.value)}% per Illusory level (\u221214% at 1, \u221230% at 5), to hit you (melee and arrows) for the fight, +${String(INVISIBILITY.theFlightAdded.value)}% to Flee, and +${String(INVISIBILITY.theStealAdded.value)}% to a following Steal. Action: cast on yourself — 80% chance no enemy player sees you (sightings, spies, Encounter targeting, the map) for the rest of the turn, and every enemy order and ambush aimed at you misses you.`,
  'Lightning Bolt':
    'Combat: 1\u20133 damage per caster level to your opponent. Battle: your-level enemy armies each lose 20% strength.',
  Fireball: `Combat: burns the target for ${String(FIREBALL.theShareOfMaximumHpItBurnsARound.value)}% of its health each round, +${String(FIREBALL.theShareMoreALevel.value)}% per Elemental level (12% at 1, 20% at 5), for ${String(FIREBALL.theRoundsItBurns.value)} rounds. Battle: the strongest enemy unit\u2019s strength is halved.`,
  Earthquake: 'Target: a province you\u2019re in or adjacent to. It yields no tax at the end of this turn.',
  Flood:
    'Target: a land province you\u2019re in or adjacent to. It acts as a sea province for the rest of the turn (land armies stranded). Cancels Part Sea.',
  'Elemental Summon':
    'Summons a random elemental (Air/Fire/Earth/Water/Darkness, Veteran) to fight under you for the rest of the turn, then it dissolves. One per turn.',
  'Control Undead':
    'Target: an enemy/neutral hero here to seize one random undead unit \u2014 OR cast on THIS province to reveal the dead army units lying here one by one, AND to sense which surrounding provinces hold graves of their own (that they do, not how many or what). All of it is filed under Graveyards Known in your report. Combat: an undead foe is frozen for a round per Necromancy level (counted to 5), unless a stun ward turns it. Battle: one enemy undead unit defects.',
  'Skeletal Armies':
    'Raises the most experienced battlefield-grave units in your province as Skeletal (Undead) units under your command (1g upkeep each): 1 unit at Necromancy 1–2, 2 at Necromancy 3–4, 3 at Necromancy 5+ — never more than lie buried there. Needs fallen armies present.',
  Curse:
    'Target: an enemy/neutral hero here. EVERY skill they have is halved (rounded down) for the rest of the turn. Combat: their best combat ability halved. Battle: the enemy commander\u2019s best combat skill (Tactical/Druid/Naval) halved.',
  'Hand of Death':
    'Combat: 10% per Necromancy level (at most 60%) to strike for 40% of the target\u2019s max HP (\u00d71.1 with Death\u2019s Finger Ring).',
  Plague:
    'Target: your province or an adjacent one. Each humanoid unit has a (10% + 5%/level) chance to lose a level; survivors are immunised. Spreads to neighbours over the turn. Not cumulative.',
};
