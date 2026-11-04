import { kcRng } from '../rng.ts';
import { isLegendaryItem } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { activeItems, settleTheItemsAHeroGained } from '../items/equipment.ts';
import { transferableItems } from './helpers.ts';
import { d100 } from '../dice-and-army-names.ts';
import { perkTier } from '../titles/perks.ts';
import { pushBattlecry } from '../battle/battle-report-lines-and-force-markers.ts';
import { pcCharCombatant } from './speed-encounter-plans-and-combatants.ts';
import { hisNameIsWords, resolvePersonalCombat } from './resolve-personal-combat.ts';
import { narrateAll, narrate } from '../turn/events-and-their-audiences.ts';
import { theItemsAsTheLineNamesThem } from './the-facts-a-personal-combats-lines-record.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { Character, Item } from '../../schemas/saved-game-state.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { TurnContext } from '../turn/context.ts';
import type { AFighterInAPersonalCombat } from './helpers.ts';

/** An item as the fight's announcement tests it: its name, and its effect's stat and combat flag (its effect guarded as
 *  if missing). */
interface AnItemAsTheFightsAnnouncementTestsIt {
  readonly name: string;
  readonly effect?: { readonly stat: string; readonly combat?: unknown } | null | undefined;
}
/** A fighter's hero as the flee spoils read him (only a hero's fighter is a character's; a guardian passes as none of
 *  these): his id, his name and his items, each guarded as if missing, as a battle's copy may hold them. */
type AHeroAsTheSpoilsReadHim = object & {
  readonly id?: Character['id'] | string | null | undefined;
  readonly name?: string | undefined;
  items?: (Item | null | undefined)[] | null | undefined;
};
/** A fighter as the flee spoils read him: whether he is a hero's, and the hero or guardian he is. */
interface AFighterAsTheSpoilsReadHim {
  readonly kind: AFighterInAPersonalCombat['kind'];
  readonly ref: AHeroAsTheSpoilsReadHim;
}

// ── PERSONAL COMBAT: DUELS AND CHARACTER ENCOUNTERS (plan P1-08f: lifted out of resolveTurn) ────
// The magic items a fighter brings to bear (magicItemsLine), the item a character may drop when they break off a fight
// with another character (duelFleeItemDrop), a duel between two commanders (resolveDuel) and a character's Encounter
// with another character (resolveCharVsChar). duelFleeItemDrop, resolveDuel and resolveCharVsChar take the turn's
// context first (src/engine/turn/context.ts); magicItemsLine reads no turn state.
// which magic items a combatant brings to bear — announced at the start of a battle or duel so
// every item "in play" is acknowledged (passive stat items boost the fight; Mithril also calls
// out each blow it turns aside, see pcTakeHit). Only combat-relevant effects are listed.
export const _COMBAT_ITEM_STATS = new Set([
  'melee',
  'archery',
  'druid',
  'tactical',
  'mithrilArmour',
  'armour',
  'maxHp',
  'white',
  'black',
  'pagan',
  'psychic',
  'elemental',
  'illusory',
  'necromancy',
  'spellcasting',
  'pc',
  'combatUse',
]); // + illusory, pc riders, combat-item riders. consumables
export function magicItemsLine(
  ch: Character,
): Extract<NarrativeLine, { kind: 'a hero bears magic items into the fight' }> | null {
  const its = activeItems(ch).filter(
    (it: AnItemAsTheFightsAnnouncementTestsIt | null | undefined) =>
      it?.name && (!it.effect || _COMBAT_ITEM_STATS.has(it.effect.stat) || it.effect.combat),
  );
  if (!its.length) return null;
  return {
    kind: 'a hero bears magic items into the fight',
    chName: ch.name,
    items: theItemsAsTheLineNamesThem(its),
  };
}
// ── FLEE SPOILS ── A character who breaks off a duel or an Encounter against another character
// has a DUEL_FLEE_DROP chance of dropping one magic item in the scramble; the character who held
// the field keeps it. Mithril never drops (granted relic). Both ends are resolved on the REAL
// character records since fights are often fought on pooled copies. Returns the item or null.
export const DUEL_FLEE_DROP = 0.5; // 2026-09-10 item 2: raised 30% → 50%; the same odds apply to a flight from a lair guardian (lairFleeItemDrop)
export function duelFleeItemDrop(
  turnContext: TurnContext,
  runnerCbt: AFighterAsTheSpoilsReadHim | null | undefined,
  stayerCbt: AFighterAsTheSpoilsReadHim | null | undefined,
  narrative: NarrativeLine[],
) {
  const { G } = turnContext;
  if (!runnerCbt || !stayerCbt || runnerCbt.kind !== 'character' || stayerCbt.kind !== 'character') return null;
  const _real = (x: AHeroAsTheSpoilsReadHim | null | undefined): AHeroAsTheSpoilsReadHim | null | undefined => {
    if (!x || x.id == null) return x;
    // the world's heroes, read as the guard reads them (a gap among them)
    const theHeroes: readonly (Character | null | undefined)[] = asItsGuardReadsIt(G.characters) ?? [];
    return theHeroes.find((r) => r && r.id === x.id) ?? x;
  };
  const runner = _real(runnerCbt.ref),
    stayer = _real(stayerCbt.ref);
  if (!runner || !stayer || runner === stayer) return null;
  const pool = transferableItems(runner.items ?? []);
  if (!pool.length) return null;
  // every hero's name is words (the saved schema's); a hero of none would be a broken save, refused here
  if (!hisNameIsWords(runner)) throw new TypeError('a hero of no name');
  const roll = d100(),
    chance = Math.round(DUEL_FLEE_DROP * 100);
  narrate(narrative, {
    kind: 'the runner scrambles clear with a chance of dropping something',
    runnerName: runner.name,
    chance,
    roll,
  });
  if (roll > chance) return null;
  const it = pool[Math.floor(kcRng() * pool.length)];
  // a pick from a pack just found not empty, of no gap (the saved schema's); for a gap, a TypeError
  if (!it) throw new TypeError('a pick from a pack fell on a gap');
  runner.items = (runner.items ?? []).filter((x) => x !== it);
  if (runnerCbt.ref !== runner && Array.isArray(runnerCbt.ref.items))
    runnerCbt.ref.items = runnerCbt.ref.items.filter((x) => x !== it && !(x?.name === it.name && x.tier === it.tier)); // keep the battle copy in step
  delete it.equipped; // re-slotted by normaliseEquipment on the new owner
  stayer.items = (stayer.items ?? []).concat([it]);
  if (stayerCbt.ref !== stayer && Array.isArray(stayerCbt.ref.items))
    stayerCbt.ref.items = stayerCbt.ref.items.concat([it]);
  // every hero's name is words (the saved schema's); a hero of none would be a broken save, refused here
  if (!hisNameIsWords(stayer)) throw new TypeError('a hero of no name');
  narrate(narrative, {
    kind: 'in the rout the runner drops an item the one who stays claims',
    runnerName: runner.name,
    itName: it.name,
    itIsLegendary: isLegendaryItem(it),
    stayerName: stayer.name,
  });
  {
    const _gn = settleTheItemsAHeroGained(stayer, [it]);
    if (_gn) narrate(narrative, { kind: 'a gained item noted', theItemsHeGained: _gn });
  } // item 10
  return it;
}
/** How a duel ends (resolveDuel's result): the runner and the one who held the field, the winner and the loser, or
 *  neither (a draw: resolvePersonalCombat names a winner and a loser together or not at all); each is one of the two
 *  heroes the duel was fought by. */
type HowADuelEnds =
  | { fled: Character; heldField: Character; winner?: undefined; loser?: undefined }
  | { winner: Character; loser: Character; fled?: undefined; heldField?: undefined }
  | { winner: null; loser: null; fled?: undefined; heldField?: undefined };
/** One of the two heroes a duel is fought by, as a fighter of the duel holds him (pcCharCombatant makes each fighter's
 *  `ref` the hero it is built from, and a duel ends only by one of its two fighters); for any other, a TypeError. The
 *  same object. */
function theDuellistTheFighterIs(ref: AFighterInAPersonalCombat['ref'], atk: Character, def: Character): Character {
  if (ref === atk) return atk;
  if (ref === def) return def;
  throw new TypeError('a duel ended by a fighter who is neither duellist');
}
export function resolveDuel(
  turnContext: TurnContext,
  atk: Character,
  def: Character,
  narrative: NarrativeLine[],
): HowADuelEnds {
  const _ia = magicItemsLine(atk),
    _ib = magicItemsLine(def); // item 5
  if (_ia) narrate(narrative, _ia);
  if (_ib) narrate(narrative, _ib);
  const A = pcCharCombatant(turnContext, atk),
    B = pcCharCombatant(turnContext, def);
  turnContext._duelFoes = new Map([
    [atk.id, (def.name || '').replace(/\s*\(wandering\)/i, '')],
    [def.id, (atk.name || '').replace(/\s*\(wandering\)/i, '')],
  ]); // item 6
  let res: ReturnType<typeof resolvePersonalCombat>;
  try {
    res = resolvePersonalCombat(turnContext, A, B, { maxRounds: 20, heldFieldWins: true });
  } finally {
    turnContext._duelFoes = null;
  } // a duel's field held is a win (preBattleDuel awards it)
  narrateAll(narrative, res.narrative);
  if (res.fledBy) {
    const runner = theDuellistTheFighterIs(res.fledBy.ref, atk, def),
      stayer = runner === atk ? def : atk;
    narrate(narrative, {
      kind: 'the runner breaks off the duel and slips away',
      runnerName: runner.name,
      stayerName: stayer.name,
    });
    duelFleeItemDrop(turnContext, res.fledBy, res.fledBy === A ? B : A, narrative); // flee spoils
    // Nobody is slain, but breaking off IS losing the duel — the caller demoralises their force.
    return { fled: runner, heldField: stayer };
  }
  const { winner, loser } = res;
  if (winner && loser)
    return {
      winner: theDuellistTheFighterIs(winner.ref, atk, def),
      loser: theDuellistTheFighterIs(loser.ref, atk, def),
    };
  // resolvePersonalCombat names a winner and a loser together or not at all; one without the other, a TypeError
  if (winner || loser) throw new TypeError('a duel with a winner and no loser, or a loser and no winner');
  return { winner: null, loser: null };
}

// ── ENCOUNTER ENGINE (AK 5.0–5.8) ────
// Resolves a full encounter between a character and a feature monster. Returns {won, fled,
// damageToHero, narrative:[...strings]} Character vs Character encounter (triggered by 'Encounter
// Character' order). Runs on the unified personal-combat engine — identical rounds, ranges and
// alternation to duels and monster encounters. The only difference is who is on the other side.
/** How a personal encounter between two heroes ends (resolveCharVsChar's result): each side's hit points left, whether
 *  each was slain (a felled hero may capitulate instead), and the lines. */
interface HowAnEncounterBetweenHeroesEnds {
  atkHp: number;
  defHp: number;
  atkKilled: boolean;
  defKilled: boolean;
  narrative: NarrativeLine[];
}
export function resolveCharVsChar(
  turnContext: TurnContext,
  atk: Character,
  def: Character,
  atkTactics: string[] | null | undefined,
  defTactics: string[] | null | undefined,
  prov: unknown, // handed by every caller, read by none
  effStat: unknown, // handed by every caller, read by none
  rng: (lo: number, hi: number) => number,
  G: TurnContext['G'],
): HowAnEncounterBetweenHeroesEnds {
  const narrative: NarrativeLine[] = [];
  narrate(narrative, {
    kind: 'the attacker meets the defender in a personal encounter',
    atkName: atk.name,
    atkRace: atk.race,
    atkTemper: atk.temper,
    defName: def.name,
    defRace: def.race,
    defRealm: def.player,
    defRealmName: (def.player === null ? undefined : G.players[def.player])?.name,
  });
  pushBattlecry(narrative, atk, def.name);
  pushBattlecry(narrative, def, atk.name);

  const A = pcCharCombatant(turnContext, atk),
    B = pcCharCombatant(turnContext, def);
  if (Array.isArray(atkTactics) && atkTactics.length) A.tactics = atkTactics.slice();
  if (Array.isArray(defTactics) && defTactics.length) B.tactics = defTactics.slice();

  const res = resolvePersonalCombat(turnContext, A, B, { maxRounds: 20 });
  narrateAll(narrative, res.narrative);

  // A successful Steal in a character encounter is a pickpocketing of the victim's treasury.
  // THIEF L8: a master thief's own purse cannot be picked.
  const _pickProof = (x: Character) => perkTier(x, 'thief') >= 3;
  if (res.stoleBy === A && def.player !== null && atk.player !== null && _pickProof(def)) {
    narrate(narrative, {
      kind: "the attacker goes for the defender's purse and comes away with nothing",
      atkName: atk.name,
      defName: def.name,
    });
  } else if (res.stoleBy === B && atk.player !== null && def.player !== null && _pickProof(atk)) {
    narrate(narrative, {
      kind: "the attacker goes for the defender's purse and comes away with nothing",
      atkName: def.name,
      defName: atk.name,
    });
  } else if (res.stoleBy === A && def.player !== null && atk.player !== null) {
    const purse = (G.players[def.player]?.gold ?? 0) || 0;
    const stolen = Math.min(purse, rng(1, 5));
    if (stolen > 0) {
      // a purse above nothing is a realm's; for none, the TypeError its read throws
      const theRobbedRealm = G.players[def.player];
      if (!theRobbedRealm) throw new TypeError("Cannot read properties of undefined (reading 'gold')");
      theRobbedRealm.gold -= stolen;
      // every realm's index names a realm of the state, so the thief's is one; for none, the TypeError its read throws
      const theThiefsRealm = G.players[atk.player];
      if (!theThiefsRealm) throw new TypeError("Cannot read properties of undefined (reading 'gold')");
      theThiefsRealm.gold = (theThiefsRealm.gold || 0) + stolen;
      narrate(narrative, {
        kind: "the attacker lifts gold from the defender's purse",
        atkName: atk.name,
        stolen,
        defName: def.name,
      });
    } else
      narrate(narrative, {
        kind: "the attacker finds the defender's purse empty",
        atkName: atk.name,
        defName: def.name,
      });
  } else if (res.stoleBy === B && atk.player !== null && def.player !== null) {
    const purse = (G.players[atk.player]?.gold ?? 0) || 0;
    const stolen = Math.min(purse, rng(1, 5));
    if (stolen > 0) {
      // a purse above nothing is a realm's; for none, the TypeError its read throws
      const theRobbedRealm = G.players[atk.player];
      if (!theRobbedRealm) throw new TypeError("Cannot read properties of undefined (reading 'gold')");
      theRobbedRealm.gold -= stolen;
      // every realm's index names a realm of the state, so the thief's is one; for none, the TypeError its read throws
      const theThiefsRealm = G.players[def.player];
      if (!theThiefsRealm) throw new TypeError("Cannot read properties of undefined (reading 'gold')");
      theThiefsRealm.gold = (theThiefsRealm.gold || 0) + stolen;
      narrate(narrative, {
        kind: "the attacker lifts gold from the defender's purse",
        atkName: def.name,
        stolen,
        defName: atk.name,
      });
    }
  }
  if (res.fledBy) {
    narrate(narrative, { kind: 'the one who flees breaks away and escapes', resFledByName: res.fledBy.name });
    duelFleeItemDrop(turnContext, res.fledBy, res.fledBy === A ? B : A, narrative);
  } // flee spoils

  const atkHp = res.aHp,
    defHp = res.bHp;
  // A felled commander is not always slain — a third of the time the fight ends in capitulation
  // rather than death. Kings are always spared this way.
  let atkKilled = false,
    defKilled = false;
  if (atkHp <= 0) {
    narrate(narrative, { kind: 'the attacker is overwhelmed', atkName: atk.name });
    atkKilled = atk.isKing ? false : kcRng() < 0.3;
  }
  if (defHp <= 0) {
    narrate(narrative, { kind: 'the defender is overcome', defName: def.name });
    defKilled = !def.isKing && def.player !== null && kcRng() < 0.3;
  }

  return { atkHp, defHp, atkKilled, defKilled, narrative };
}
