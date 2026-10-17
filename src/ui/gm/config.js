// ── CONFIG ────
if(typeof KC_CONFIG==='undefined') throw new Error('kc-config.js did not load: reload the page.');
const SUPABASE_URL = KC_CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = KC_CONFIG.supabaseKey;
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SEASONS = KC_SEASONS.slice();

const ALL_SKILLS=KC_SKILLS.slice();
// TRAINING gives its benefit up to level 5; levels 6-9 buy mastery perks and mastery orders
// instead. Magic items and the Crown of Command aura stack above that ONLY for melee and archery,
// to the skill ceiling of 9. Those two are special: the engine already gives levels past 5 a real
// meaning there — meleeRaw/archeryRaw drive the damage roll, to-hit climbs +5% per level past 5,
// and perkTier reads the same scale. Every other skill (tactical, naval, sage, druid, spy, thief,
// explorer, march and the five magic schools) has no defined behaviour above 5, and the engine is
// tuned around that cap in a dozen places, so their bonuses still stop at 5.
const SKILL_BENEFIT_CAP=5, SKILL_MAX=9;
// the five magic schools JOIN melee and archery as skills whose item and aura bonuses stack on top
// of a trained 5, to the ceiling of 9. What that buys is CAST CHANCE only — +10% a level to the 95%
// ceiling — because every spell EFFECT is computed on `Math.min(lvl,5)`
// (pcCastCombatSpell's `lvlEff`, the action phase's `spellLevelEff`, the Bless ward, Phantasmal
// Armies). The per-turn cast limit already tops out at 3 from level 4, and the per-fight limit at 2
// from level 2, so neither moves either. A relic focus therefore makes a master more RELIABLE,
// never more powerful — which is the distinction Toby asked for.
const ITEM_UNCAPPED_SKILLS=new Set(KC_ITEM_UNCAPPED_SKILLS);
const SKILL_LABELS={...KC_SKILL_LABELS};
// ── ONE-SOURCE ENGINE TABLES (2026-09-27, Toby: collapse to one source) ──────────────────────────
// GM-only tables that had been re-typed at every site that needed them. Each old site now reads
// the one below. (Tables BOTH portals need live in kingdoms-call-data.js as KC_*.)
// Personal-combat tactic codes a duel keeps from an encounter plan (Steal, Talk, Scout and the rest
// are lair-only and dropped). FI / FIRE / ARROW is ARCHERY — the code the player portal writes for
// "Fire Arrow" and that autoEncounterPlan writes for every ranged hero. Four of the five copies of
// this list omitted it, so an archer's shots were silently deleted from Encounter Character,
// breaking-ranks, caught-thief and failed-charm duels (DEV_LOG §277). AR / ARCHERY are not engine
// codes (pcAct has no case for them — they fall through to melee); kept so an old plan still acts.
const COMBAT_ONLY_TACTICS=new Set(['ME','MELEE','AR','ARCHERY','FI','FIRE','ARROW','CA','SPELL','FL','FLEE']);
// Spells that also work as BATTLE MAGIC (pre-battle phase of an army battle).
const BATTLE_MAGIC_SPELL_NAMES=['Holy Symbol','Spiritwrack','Fireball','Telekinetic Storm','Lightning Bolt','Curse','Psychic Blast','Control Undead'];
// Chance an army is seized by fanatical zeal, by the realm's alignment.
const FANATIC_CHANCE_BY_ALIGN={Divine:0.50,Good:0.40,Druidic:0.20,Neutral:0.10,Pagan:0.15,Evil:0.25,Undead:0.00};
// Lair guardian grade as a number ('' = unknown). The bot's lair ladder and its target sorting.
const GUARDIAN_POWER_RANK={'':0,'Weak':1,'Moderate':2,'Powerful':3,'Legendary':4};
// Steal from a lair: the success penalty (percentage points) for the guardian's grade.
const STEAL_TIER_PEN={Weak:0,Moderate:15,Powerful:30,Legendary:45};
// The one attack spell a caster reaches for in each school (NPC guards, and duels with no named spell).
const NPC_SCHOOL_SPELL={elemental:'Lightning Bolt',necromancy:'Hand of Death',white:'Holy Symbol',psychic:'Psychic Blast',illusory:'Mirror Image'};

// ── ONCE PER TURN (mastery) ── the 20 L7/L9 mastery ORDERS; each may be attempted only once per
// turn per character (mirrors the mastery-spell once-per-turn rule in the cast handler).
const MASTERY_ORDER_KEYS=new Set(['challenge','rampage','rain_of_arrows','snipers_mark','feigned_retreat','grand_stratagem','forced_march','lightning_advance','blockade','raid_coast','research_breakthrough','grand_design','sabotage','assassinate','grand_heist','vanish','awaken_grove','wild_calling','chart_unknown','discover_ruin']);
const MASTERY_ORDER_LABEL={challenge:'Challenge',rampage:'Rampage',rain_of_arrows:'Rain of Arrows',snipers_mark:"Sniper's Mark",feigned_retreat:'Feigned Retreat',grand_stratagem:'Grand Stratagem',forced_march:'Forced March',lightning_advance:'Lightning Advance',blockade:'Blockade',raid_coast:'Raid the Coast',research_breakthrough:'Research Breakthrough',grand_design:'Grand Design',sabotage:'Sabotage',assassinate:'Assassinate',grand_heist:'Grand Heist',vanish:'Vanish',awaken_grove:'Awaken Grove',wild_calling:'Wild Calling',chart_unknown:'Chart the Unknown',discover_ruin:'Discover Lost Ruin'};
// Alignment-signature orders, by engine action key. Used with MASTERY_ORDER_KEYS to decide what a
// charmed enemy hero may not be made to do.
const ALIGNMENT_ORDER_KEYS=new Set(['consecrate','call_to_arms','broker','harvest_field','rite']);   // Awaken the Wild and Call from the Pit removed 2026-10-12 (item 22)
// the character-targeted hostile spells a seized enemy hero will not aim at their ORIGINAL lord's
// characters (the Encounter order is refused on the same grounds).
const CHARMED_NO_TURN_SPELLS=new Set(['Psychic Blast','Telekinetic Storm','Curse','Charm','Control Undead','Dominate']);

// Spells whose named CHARACTER target must be standing in the caster's own province. Each of these
// branches already refuses an absent target — but it did so BELOW the cast roll, so a caster whose
// target had marched away (most often a general on Defend who rode out at the top of the phase)
// burned the roll and the per-turn casting slot on a spell that was never worked. The guard is
// hoisted above the roll instead (DEV_LOG: "a guard after the cast roll is not a guard").
// Keyed by SPELL_DEFS_P.fn. Province-targeted spells and the remote scry (Clairvoyance) are absent.
const SPELL_FNS_NEED_COLOCATED_TARGET=new Set([
  'psychic_charm','psychic_blast','psychic_storm','psychic_oratory','illusory_phantasmal',
  'necromancy_control','necromancy_curse','white_judgment','psychic_massconfusion',
  'psychic_dominate','elemental_chainlightning',
]);


let currentUser = null;
let currentGame = null;
let currentGamePlayers = [];

