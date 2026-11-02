// ── L79_ORDERS: a constant read as the page loads ────
// Moved here unchanged (plan P1-09b) from src/ui/player/items-and-heroes.ts, the file just after this one in the page.
// src/ui/player/pre-orders.ts reads it as the page loads, and the two files are in one cycle of files that read each
// other: once the page is made of modules (P1-09d), the file that runs second could meet it before its line has run. A
// file that imports nothing of the page's cycle runs before every file that reads it (docs/traps.md, "Top-level
// declaration order"): this one imports only the content's rows.
// L7/L9 mastery ORDERS — gated by the hero's RAW skill level (past-5 comes from experience only). Each order's name,
// skill and level are its row's (src/content/mastery-orders-their-keys-names-skills-and-levels.ts, P1-11d10), which the
// turn's set of the masteries reads too; its target and its hint are the form's own, below, by the row's key, in the
// form's order.
// target: 'none' (self/current province), 'province' (a seen province), or 'character' (an enemy
// hero here).
import { THE_MASTERY_ORDERS } from '../../content/mastery-orders-their-keys-names-skills-and-levels.ts';

/** What the form holds of a mastery order besides its row: what it aims at, the provinces it offers, and its hint. */
interface TheFormsFieldsOfAMasteryOrder {
  readonly target: string;
  readonly provKind?: string;
  readonly hint: string;
}
const THE_FORMS_FIELDS_OF_EACH_MASTERY_ORDER: readonly (readonly [
  keyof typeof THE_MASTERY_ORDERS,
  TheFormsFieldsOfAMasteryOrder,
])[] = [
  [
    'sabotage',
    {
      target: 'province',
      provKind: 'enemy',
      hint: 'Spy 7: wreck an enemy province you can see — it yields no tax next turn and loses a garrison unit.',
    },
  ],
  [
    'forced_march',
    {
      target: 'province',
      provKind: 'move_adjacent',
      hint: 'March 7: march to an adjacent province — if an enemy army or a Defend order awaits, a 50% chance to slip in without a battle this phase (the fight comes next phase if you stay, or at turn end).',
    },
  ],
  [
    'grand_heist',
    {
      target: 'here',
      hint: "Thief 7 · ONE attempt per thief per turn (spent win or lose). You crack the vaults of THE PROVINCE YOU STAND IN — no hero is targeted. Where: the province must be held by a realm you are AT WAR with, and be their HOME CAPITAL or RICH country (tax 7+). Take: 25% of that realm's treasury (doubled at Thief 8, even past what they can cover) AND one magic item — cut from a courier still on the road inside their realm, from a Send Item order made earlier this turn (a heist never touches what a hero carries in their own pack — that is the Steal order). Odds: 60% +5% per Thief level past 5, halved if the vaults are guarded (a garrison stands there, or an enemy commander of that realm is present with troops). Fail and you are seen unless you slip away (Thief × 20%) — then a hero of that realm draws steel on you (lead with Flee in your Encounter Plan if you would rather not fight), or if none is there the guards beat you off.",
    },
  ],
  [
    'awaken_grove',
    {
      target: 'none',
      hint: 'Druid 7: while in an owned forest, jungle or wild (Creature or Monster) province, raise a temporary Creature host that fights until turn\u2019s end.',
    },
  ],
  [
    'chart_unknown',
    {
      target: 'here_or_adjacent',
      hint: 'Explorer 7: fully chart the province you stand in OR one bordering it — 100% mapped, every lair in it revealed, and all ITS neighbours glimpsed at 25%.',
    },
  ],
  [
    'discover_ruin',
    {
      target: 'lair_tier',
      hint: "Explorer 9: name a class of lair. EVERY lair of that class in your province and in each bordering province is laid bare at once. A rival's Hide Lairs glamour still conceals what it covers.",
    },
  ],
  [
    'blockade',
    {
      target: 'province',
      provKind: 'sea_adjacent',
      hint: 'Naval 7: seal a sea province you are in or adjacent to — enemy fleets may not cross it this turn.',
    },
  ],
  [
    'research_breakthrough',
    {
      target: 'none',
      hint: 'Sage 7: a guaranteed scholarly discovery this turn (if any remain undiscovered by your realm).',
    },
  ],
  [
    'assassinate',
    {
      target: 'character',
      hint: 'Spy 9: attempt to slay an enemy hero in the province you stand in — a spy-level chance to kill.',
    },
  ],
  [
    'vanish',
    {
      target: 'none',
      hint: 'Thief 9: melt into the shadows — for the rest of this turn no pursuit, Encounter or ambush can bring you to bay, and no thief caught in the act can be cornered.',
    },
  ],
  [
    'challenge',
    {
      target: 'character',
      hint: 'Melee 7: call out a LONE enemy hero in your province to single combat — the loser is wounded, or slain.',
    },
  ],
  [
    'rampage',
    {
      target: 'character',
      hint: 'Melee 9: hurl yourself at an enemy force in your province — cut down several of its units and wound its commander.',
    },
  ],
  [
    'rain_of_arrows',
    {
      target: 'character',
      hint: 'Archery 7: loose a volley on an enemy force in your province, felling several of its units.',
    },
  ],
  [
    'snipers_mark',
    {
      target: 'character',
      hint: 'Archery 9: mark an enemy commander in your province — a telling shot that wounds, and may slay.',
    },
  ],
  [
    'feigned_retreat',
    {
      target: 'none',
      hint: 'Tactical 7: bait your attacker — if you are attacked this turn, your defence counters at +25% strength.',
    },
  ],
  [
    'grand_stratagem',
    {
      target: 'none',
      hint: 'Tactical 9: dictate the terms of battle — your next battle this turn is fought at +20% strength.',
    },
  ],
  [
    'lightning_advance',
    {
      target: 'none',
      hint: 'March 9: strike before they can set — enemies you attack this turn lose their defensive footing (−20%).',
    },
  ],
  [
    'raid_coast',
    {
      target: 'none',
      hint: 'Naval 9: an amphibious assault — when you come ashore from the sea this turn and fight for the coast you land on, you hit at +25% strength (the whole landing does, even if another hero takes command of it).',
    },
  ],
  [
    'wild_calling',
    {
      target: 'none',
      hint: 'Druid 9: while standing in a wild (Creature or Monster) province, call its wild host to your banner — several of its beasts defect to you.',
    },
  ],
  // 2026-09-27 (Toby item 3): the old hint promised "+1 tax in every province, forever" — an effect
  // no Wonder has had for a long time. Each alignment raises a DIFFERENT Wonder (see GD_BY_ALIGNMENT
  // below, and _GD_DEFS in the GM engine's 'grand_design' case), so the hint is rewritten for the
  // reader's OWN realm by gdHintFor() as the order form is drawn. This string is only the fallback
  // for a report that carries no alignment.
  [
    'grand_design',
    {
      target: 'none',
      hint: 'Sage 9: complete your realm\u2019s Grand Design — a unique, once-ever Wonder whose blessing is set by your realm\u2019s alignment.',
    },
  ],
];
export const L79_ORDERS = Object.fromEntries(
  THE_FORMS_FIELDS_OF_EACH_MASTERY_ORDER.map(([key, fields]) => {
    const row = THE_MASTERY_ORDERS[key];
    return [row.name, { skill: row.skill, lvl: row.level, ...fields }];
  }),
);
